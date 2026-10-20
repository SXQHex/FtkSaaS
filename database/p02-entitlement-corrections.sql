-- P02-B: exact preview-bound corrections; existing confirmed obligations stay intact.
begin;
create function private.p02_dependencies(org uuid,center uuid,account uuid,sale_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare hashes jsonb:='{}';t text;h text;versions jsonb;
begin
 foreach t in array array['organizations','centers','people','center_relationships','disciplines','center_disciplines','sales','products','product_versions','product_scopes','entitlement_accounts','entitlement_movements','entitlement_allocations','credit_deficits','quota_buckets','freezes','reservations','sessions','policy_versions','negative_limit_overrides','debts','debt_adjustments','debt_allocations','collections','student_credit_movements','saas_subscriptions','account_links','role_assignments','permission_overrides'] loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(q) order by q.id)::text,'''')) from core.%I q where org_id=$1',t) into h using org;
  hashes:=hashes||jsonb_build_object(t,h);
 end loop;
 select jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'version',s.version),jsonb_build_object('entity',jsonb_build_object('type','entitlement_accounts','id',a.id),'version',a.version)) into versions from core.sales s join core.entitlement_accounts a on a.org_id=s.org_id and a.sale_id=s.id where s.org_id=org and s.id=sale_id;
 return jsonb_build_object('versions',coalesce(versions,'[]'::jsonb),'policy_hashes',jsonb_build_array(md5(hashes::text)),'permission_hash',md5(jsonb_build_object('actor',account,'center',center,'links',hashes->'account_links','roles',hashes->'role_assignments','permissions',hashes->'permission_overrides')::text));
end$$;
create function private.p02_protect(org uuid,sale_id uuid,preview_id uuid,change jsonb,account uuid,operation uuid,ids uuid[],idx int) returns int language plpgsql security invoker set search_path='' as $$
declare v core.reservations;
begin
 for v in select * from core.reservations where org_id=org and source_sale_id=sale_id and state='active' order by id for update loop
  insert into private.reservation_protections(id,org_id,reservation_id,preview_id,change,obligation,actor_account_id) values(private.new_id(ids,idx),org,v.id,preview_id,change,private.lesson_obligation(org,v.id),account);idx:=idx+1;
  update core.reservations set version=version+1 where org_id=org and id=v.id;
 end loop;
 return idx;
end$$;
create function private.p02_rights(op text,r jsonb,org uuid,center uuid,account uuid,person uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare change jsonb:=r->'change';request_data jsonb:=r;pv core.previews;pp private.preview_payloads;s core.sales;a core.entitlement_accounts;p core.product_versions;dep jsonb;affected jsonb;ack jsonb;data jsonb;effects jsonb:='[]';pid uuid:=private.new_id(ids,2);idx int:=20;qty bigint;total bigint;consumed bigint;until_time timestamptz;ver bigint;before_data jsonb;
begin
 if op<>'reservation_impact_preview_v1' then
  select * into pv from core.previews where org_id=org and id=coalesce((r#>>'{preview,id}')::uuid,(r#>>'{impact_approval,id}')::uuid) for update;
  select * into pp from private.preview_payloads where preview_id=pv.id;
  if pv.id is null or pv.operation<>'reservation_impact_apply_v1' or pv.actor_account_id<>account or pv.state<>'current' or pp.expires_at<=clock_timestamp() or pp.token_hash is distinct from encode(extensions.digest(coalesce(r#>>'{preview,token}',r#>>'{impact_approval,token}'),'sha256'),'hex') or (pp.payload->>'center_id')::uuid is distinct from center then perform private.fail('PREVIEW_STALE');end if;
  request_data:=pp.payload->'request';change:=request_data->'change';
 end if;
 if not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
 if change->>'kind' not in ('credit_adjust','entitlement_extend') then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 select * into s from core.sales where org_id=org and center_id=center and id=(change->>'sale_id')::uuid for update;
 if s.id is null then perform private.fail('NOT_FOUND');end if;
 if s.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
 select * into a from core.entitlement_accounts where org_id=org and sale_id=s.id for update;
 select * into p from core.product_versions where org_id=org and id=s.product_version_id;
 if a.state<>'active' or length(btrim(coalesce(request_data->>'reason','')))=0 then perform private.fail('VALIDATION_FAILED');end if;
 before_data:=jsonb_build_object('sale',to_jsonb(s),'account',to_jsonb(a));
 if change->>'kind'='credit_adjust' then
  qty:=(change->>'quantity')::bigint;
  if p.kind<>'credits' or qty<=0 or change->>'direction' not in ('increase','decrease') then perform private.fail('VALIDATION_FAILED');end if;
  select coalesce(sum(case when kind in ('grant','adjust_add') then quantity when kind='adjust_subtract' then -quantity else 0 end),0) into total from core.entitlement_movements where org_id=org and sale_id=s.id;
  select coalesce(sum(quantity),0) into consumed from core.entitlement_allocations where org_id=org and sale_id=s.id and state='consumed';
  if change->>'direction'='decrease' and qty>greatest(0,total-consumed) then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;
  effects:=jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','entitlement_accounts','id',a.id),'action','adjust','quantity',qty,'reason',request_data->>'reason'));
 else
  until_time:=(change->>'end_date')::date::timestamp at time zone s.timezone;
  if until_time<=s.valid_until or until_time<=clock_timestamp() or to_char(until_time at time zone s.timezone,'YYYY-MM-DD HH24:MI')<>change->>'end_date'||' 00:00' then perform private.fail('VALIDATION_FAILED');end if;
  effects:=jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'action','adjust','reason',request_data->>'reason'));
 end if;
 select coalesce(jsonb_agg(private.lesson_obligation(org,v.id) order by v.id),'[]'::jsonb) into affected from core.reservations v where v.org_id=org and v.source_sale_id=s.id and v.state='active' and change->>'kind'='credit_adjust' and change->>'direction'='decrease';
 dep:=private.p02_dependencies(org,center,account,s.id);
 if op='reservation_impact_preview_v1' then
  if aux->>'token' is null then perform private.fail('INTEGRITY_VIOLATION');end if;
  data:=jsonb_build_object('id',pid,'token',aux->>'token','scope_hash',md5(jsonb_build_object('actor',account,'org',org,'center',center,'change',change,'reason',request_data->'reason')::text),'dependencies',dep,'effects',effects,'blockers','[]'::jsonb,'expires_at',clock_timestamp()+interval '15 minutes');
  insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(pid,org,account,'reservation_impact_apply_v1',data->>'scope_hash',dep,data-'token','current');
  insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(pid,jsonb_build_object('center_id',center,'request',request_data,'affected',affected),(data->>'expires_at')::timestamptz,encode(extensions.digest(aux->>'token','sha256'),'hex'));
  return jsonb_build_object('data',jsonb_build_object('preview',data,'change',change,'affected',affected,'preserves_reservations',true,'waives_independent_blocks',false),'primary_id',pid,'subject','previews');
 end if;
 if dep<>pv.dependencies then perform private.fail('PREVIEW_STALE');end if;
 if op='credit_adjust_v1' and (change<>jsonb_build_object('kind','credit_adjust','sale_id',r->'sale_id','quantity',r->'quantity','direction',r->'direction') or r->>'reason'<>request_data->>'reason') then perform private.fail('PREVIEW_STALE');end if;
 if op='entitlement_extend_v1' then
  if change<>jsonb_build_object('kind','entitlement_extend','sale_id',r->'sale_id','end_date',r->'end_date') or r->>'reason'<>request_data->>'reason' then perform private.fail('PREVIEW_STALE');end if;
  if a.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 end if;
 select coalesce(jsonb_agg(x->'reservation_id' order by x->>'reservation_id'),'[]'::jsonb) into data from jsonb_array_elements(affected) x;
 select coalesce(jsonb_agg(x order by x#>>'{}'),'[]'::jsonb) into ack from jsonb_array_elements(r->'accepted_reservation_ids') x;
 if ack is distinct from data then perform private.fail('VALIDATION_FAILED');end if;
 if change->>'kind'='credit_adjust' then
  insert into core.entitlement_movements(id,org_id,sale_id,person_id,kind,quantity,operation_id) values(private.new_id(ids,idx),org,s.id,s.person_id,case when change->>'direction'='increase' then 'adjust_add' else 'adjust_subtract' end,qty,operation);idx:=idx+1;
  if change->>'direction'='decrease' then idx:=private.p02_protect(org,s.id,pv.id,change,account,operation,ids,idx);end if;
 else update core.sales set valid_until=until_time,end_date=(change->>'end_date')::date,version=version+1 where org_id=org and id=s.id;end if;
 update core.entitlement_accounts set version=version+1,balance_version=balance_version+1 where org_id=org and id=a.id returning version into ver;
 update core.previews set state='applied',version=version+1 where id=pv.id;
 data:=jsonb_build_object('operation_id',operation,'primary_id',a.id,'version',ver,'replayed',false,'related',jsonb_build_array(jsonb_build_object('type','sales','id',s.id)));
 return jsonb_build_object('data',data,'primary_id',a.id,'subject','entitlement_accounts','audit',jsonb_build_object('before',before_data,'request',request_data,'after',(select to_jsonb(q) from core.entitlement_accounts q where q.org_id=org and q.id=a.id)));
end$$;
do $read$
declare b text:=pg_get_functiondef('private.purchased_rights(jsonb,uuid,uuid,uuid)'::regprocedure);
begin
 if strpos(b,'''sale_id'',s.id')=0 then raise exception 'P02 entitlement projection anchor missing';end if;
 execute replace(b,'''sale_id'',s.id','''sale_id'',s.id,''version'',a.version,''account_id'',a.id,''sale_version'',s.version,''sale_state'',s.state,''freezes'',coalesce((select jsonb_agg(to_jsonb(f) order by f.starts_at,f.id) from core.freezes f where f.org_id=org and f.sale_id=s.id),''[]''::jsonb)');
end$read$;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.lesson_dispatch(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:=$p$ if op='negative_limits_get_v1' then$p$;
 if strpos(b,old)=0 then raise exception 'P02 impact anchor missing';end if;
 b:=replace(b,old,$p$ if op in ('reservation_impact_preview_v1','reservation_impact_apply_v1') and coalesce(r#>>'{change,kind}',(select p.payload#>>'{request,change,kind}' from private.preview_payloads p join core.previews v on v.id=p.preview_id where v.org_id=org and v.id=(r#>>'{preview,id}')::uuid)) in ('credit_adjust','entitlement_extend') then return private.p02_rights(op,r,org,center,account,person,operation,ids,aux);end if;
$p$||old);execute b;
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:='  cm:=center is not null and private.is_manager(org,person,center);org_reader:=private.is_org_reader(org,person);';
 if strpos(b,old)=0 then raise exception 'P02 rights scope anchor missing';end if;
 b:=replace(b,old,$p$  if p_operation in ('credit_adjust_v1','entitlement_extend_v1') or (p_operation='reservation_impact_preview_v1' and r#>>'{change,kind}' in ('credit_adjust','entitlement_extend')) then
   select s.center_id into selected from core.sales s where s.org_id=org and s.id=coalesce((r->>'sale_id')::uuid,(r#>>'{change,sale_id}')::uuid);
   if selected is null or (center is not null and center<>selected) then perform private.fail('NOT_FOUND');end if;center:=selected;
  end if;
$p$||old);
 b:=replace(b,' -- DOMAIN_CASES',$p$
 when 'credit_adjust_v1','entitlement_extend_v1' then
  terms:=private.p02_rights(p_operation,r,org,center,actor.id,person,operation_id,p_ids,p_aux);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';audit_delta:=terms->'audit';
 -- DOMAIN_CASES$p$);execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
