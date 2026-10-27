-- P02-C: freeze intervals change new eligibility, not confirmed allocations.
begin;
create function private.p02_freeze(op text,r jsonb,org uuid,center uuid,account uuid,person uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare request_data jsonb:=r;pv core.previews;pp private.preview_payloads;s core.sales;p core.product_versions;f core.freezes;pid uuid:=private.new_id(ids,2);idx int:=20;dep jsonb;data jsonb;effects jsonb:='[]';starts timestamptz;ends timestamptz;days int;remaining_days int;new_end date;reason text;ver bigint:=1;before_data jsonb;is_end bool:=op in ('freeze_end_preview_v1','freeze_end_apply_v1');is_preview bool:=op in ('freeze_preview_v1','freeze_end_preview_v1');
begin
 if not is_preview then
  select * into pv from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid for update;
  select * into pp from private.preview_payloads where preview_id=pv.id;
  if pv.id is null or pv.state<>'current' or pv.operation<>op or pv.actor_account_id<>account or pp.expires_at<=clock_timestamp() or pp.token_hash is distinct from encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') or (pp.payload->>'center_id')::uuid is distinct from center then perform private.fail('PREVIEW_STALE');end if;
  request_data:=pp.payload->'request';
 end if;
 if is_end then
  select * into f from core.freezes where org_id=org and id=(request_data->>'freeze_id')::uuid for update;
  if f.id is null then perform private.fail('NOT_FOUND');end if;
 end if;
 select * into s from core.sales where org_id=org and center_id=center and id=coalesce(f.sale_id,(request_data->>'sale_id')::uuid) for update;
 if s.id is null then perform private.fail('NOT_FOUND');end if;
 if s.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
 perform private.require_feature(org,'F17');
 select * into p from core.product_versions where org_id=org and id=s.product_version_id;
 if not coalesce((p.freeze_terms->>'enabled')::bool,false) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 reason:=request_data->>'reason';if length(btrim(coalesce(reason,'')))=0 then perform private.fail('VALIDATION_FAILED');end if;
 before_data:=jsonb_build_object('sale',to_jsonb(s),'freeze',to_jsonb(f));new_end:=s.end_date;
 if is_end then
  if f.state not in ('scheduled','active') or coalesce(f.actual_end,f.planned_end)<=clock_timestamp() then perform private.fail('INVALID_STATE_TRANSITION');end if;
  starts:=f.starts_at;ends:=(request_data->>'end_date')::date::timestamp at time zone s.timezone;
  if ends<=starts or ends>=f.planned_end or ends<clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  remaining_days:=(f.planned_end at time zone s.timezone)::date-(ends at time zone s.timezone)::date;
  if coalesce((p.freeze_terms->>'extends_validity')::bool,false) then new_end:=s.end_date-remaining_days;end if;
  effects:=jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','freezes','id',f.id),'action','adjust','reason',reason));
 else
  starts:=(request_data#>>'{dates,start_date}')::date::timestamp at time zone s.timezone;ends:=(request_data#>>'{dates,end_date}')::date::timestamp at time zone s.timezone;
  days:=(request_data#>>'{dates,end_date}')::date-(request_data#>>'{dates,start_date}')::date;
  if days<=0 or starts<clock_timestamp() or starts<s.valid_from or starts>=s.valid_until or ends>s.valid_until then perform private.fail('VALIDATION_FAILED');end if;
  if p.freeze_terms->>'max_days' is not null and days+coalesce((select sum((coalesce(q.actual_end,q.planned_end) at time zone s.timezone)::date-(q.starts_at at time zone s.timezone)::date) from core.freezes q where q.org_id=org and q.sale_id=s.id and q.state<>'cancelled'),0)>(p.freeze_terms->>'max_days')::int then perform private.fail('PLAN_LIMIT_REACHED');end if;
  if exists(select 1 from core.freezes q where q.org_id=org and q.sale_id=s.id and q.state<>'cancelled' and q.starts_at<ends and coalesce(q.actual_end,q.planned_end)>starts) then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if coalesce((p.freeze_terms->>'extends_validity')::bool,false) then new_end:=s.end_date+days;end if;
  effects:=jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'action','adjust','quantity',days,'reason',reason));
 end if;
 if to_char(starts at time zone s.timezone,'HH24:MI')<>'00:00' or to_char(ends at time zone s.timezone,'HH24:MI')<>'00:00' then perform private.fail('VALIDATION_FAILED');end if;
 select effects||coalesce(jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','reservations','id',v.id),'action','adjust','reason','Confirmed obligation preserved; no cancellation or rebooking') order by v.id),'[]'::jsonb) into effects from core.reservations v where v.org_id=org and v.source_sale_id=s.id and v.state='active';
 dep:=private.p02_dependencies(org,center,account,s.id);
 if is_preview then
  if aux->>'token' is null then perform private.fail('INTEGRITY_VIOLATION');end if;
  data:=jsonb_build_object('id',pid,'token',aux->>'token','scope_hash',md5(jsonb_build_object('actor',account,'org',org,'center',center,'request',r-'request_id')::text),'dependencies',dep,'effects',effects,'blockers','[]'::jsonb,'expires_at',clock_timestamp()+interval '15 minutes');
  insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(pid,org,account,replace(op,'_preview_','_apply_'),data->>'scope_hash',dep,data-'token','current');
  insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(pid,jsonb_build_object('center_id',center,'request',r),(data->>'expires_at')::timestamptz,encode(extensions.digest(aux->>'token','sha256'),'hex'));
  return jsonb_build_object('data',data,'primary_id',pid,'subject','previews');
 end if;
 if dep<>pv.dependencies then perform private.fail('PREVIEW_STALE');end if;
 idx:=private.p02_protect(org,s.id,pv.id,jsonb_build_object('kind',case when is_end then 'freeze_end' else 'freeze' end,'request',request_data),account,operation,ids,idx);
 if is_end then
  update core.freezes set actual_end=ends,state='ended',extension_until=case when coalesce((p.freeze_terms->>'extends_validity')::bool,false) then new_end::timestamp at time zone s.timezone else null end,version=version+1 where org_id=org and id=f.id returning version into ver;pid:=f.id;
 else
  insert into core.freezes(id,org_id,sale_id,starts_at,planned_end,state,extension_until,preview_id) values(pid,org,s.id,starts,ends,case when starts<=clock_timestamp() then 'active' else 'scheduled' end,case when coalesce((p.freeze_terms->>'extends_validity')::bool,false) then new_end::timestamp at time zone s.timezone else null end,pv.id);
 end if;
 update core.sales set end_date=new_end,valid_until=new_end::timestamp at time zone s.timezone,version=version+1 where org_id=org and id=s.id;
 update core.entitlement_accounts set balance_version=balance_version+1,version=version+1 where org_id=org and sale_id=s.id;
 update core.previews set state='applied',version=version+1 where id=pv.id;
 data:=jsonb_build_object('operation_id',operation,'primary_id',pid,'version',ver,'replayed',false,'related',jsonb_build_array(jsonb_build_object('type','sales','id',s.id)));
 return jsonb_build_object('data',data,'primary_id',pid,'subject','freezes','audit',jsonb_build_object('before',before_data,'request',request_data,'after',(select to_jsonb(q) from core.freezes q where q.org_id=org and q.id=pid)));
end$$;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.available_for(uuid,uuid,timestamp with time zone)'::regprocedure);old:=$p$ select * into p from core.product_versions where org_id=org and id=s.product_version_id;$p$;
 if strpos(b,old)=0 then raise exception 'P02 freeze eligibility anchor missing';end if;
 execute replace(b,old,$p$ if exists(select 1 from core.freezes f where f.org_id=org and f.sale_id=s.id and f.state<>'cancelled' and f.starts_at<=at_time and coalesce(f.actual_end,f.planned_end)>at_time) then return 0;end if;
$p$||old);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old:='  cm:=center is not null and private.is_manager(org,person,center);org_reader:=private.is_org_reader(org,person);';
 if strpos(b,old)=0 then raise exception 'P02 freeze scope anchor missing';end if;
 b:=replace(b,old,$p$  if p_operation in ('freeze_preview_v1','freeze_end_preview_v1') then
   select s.center_id into selected from core.sales s where s.org_id=org and s.id=coalesce((r->>'sale_id')::uuid,(select f.sale_id from core.freezes f where f.org_id=org and f.id=(r->>'freeze_id')::uuid));
   if selected is null or (center is not null and center<>selected) then perform private.fail('NOT_FOUND');end if;center:=selected;
  end if;
$p$||old);
 b:=replace(b,' -- DOMAIN_CASES',$p$
 when 'freeze_preview_v1','freeze_apply_v1','freeze_end_preview_v1','freeze_end_apply_v1' then
  terms:=private.p02_freeze(p_operation,r,org,center,actor.id,person,operation_id,p_ids,p_aux);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';audit_delta:=terms->'audit';
  if terms#>>'{audit,request,reason}' is not null then r:=r||jsonb_build_object('reason',terms#>>'{audit,request,reason}');end if;
 -- DOMAIN_CASES$p$);execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('freeze_preview_v1','entitlement.correct','maintenance',array['F17']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.freeze_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('freeze_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.freeze_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.freeze_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('freeze_apply_v1','entitlement.correct','maintenance',array['F17']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.freeze_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('freeze_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.freeze_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.freeze_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('freeze_end_preview_v1','entitlement.correct','maintenance',array['F17']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.freeze_end_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('freeze_end_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.freeze_end_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.freeze_end_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('freeze_end_apply_v1','entitlement.correct','maintenance',array['F17']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.freeze_end_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('freeze_end_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.freeze_end_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.freeze_end_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
