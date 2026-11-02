begin;
-- F04 instructor discovery, not a general F05 personnel reader.
create function private.instructor_management_page(r jsonb,org uuid,center uuid,person uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';lim int:=coalesce((r#>>'{page,limit}')::int,50);
 cur jsonb;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();items jsonb;token text;
 h text:=md5(jsonb_build_object('account',account,'request',r-'request_id'-'page')::text);
begin
 if center is null or not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
 if not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 if r#>>'{selector,operation}' is distinct from 'role_assign_v1' or (k#>>'{scope,center_id}')::uuid is distinct from center
  or lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 perform private.require_feature(org,'F04');
 if k->>'role' is distinct from 'instructor' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb and r#>>'{entity,type}'<>'role_assignments' then perform private.fail('NOT_FOUND');end if;
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or last_at is null or last_id is null or asof is null
    or not isfinite(last_at) or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with page as(
  select a.* from core.role_assignments a
  where a.org_id=org and a.scope_center_id=center and a.role='instructor'
   and (k->>'person_id' is null or a.person_id=(k->>'person_id')::uuid)
   and (r#>>'{entity,id}' is null or a.id=(r#>>'{entity,id}')::uuid)
   and a.created_at<=asof and (cur is null or (a.created_at,a.id)>(last_at,last_id))
  order by a.created_at,a.id limit lim+1
 )
 select coalesce(jsonb_agg(jsonb_build_object('operation','role_assign_v1','entity',jsonb_build_object('type','role_assignments','id',id),'exists',true,'state',state,
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','role_assignments','id',id),'version',version)),
  'as_of',asof,'current',jsonb_build_object('operation','role_assign_v1','values',jsonb_build_object('person_id',person_id,'role','instructor','scope',jsonb_build_object('center_id',center))),
  '_at',created_at) order by created_at,id),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)>lim then
  items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',(items->-1)#>'{entity,id}','as_of',asof)::text,'utf8'),'hex');
 end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof);
end$$;
-- Session identity is independent of the currently selected Starter instructor.
create function private.instructor_revoke_sessions(org uuid,center uuid,pid uuid,stamp timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('session_id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at,'version',s.version,
 'will_require_instructor',not exists(select 1 from jsonb_array_elements(private.schedule_snapshot(org,s.id)->'assignments') a where a->>'duty'='instructor' and a->>'person_id'<>pid::text)) order by s.starts_at,s.id),'[]'::jsonb)
 from core.sessions s where s.org_id=org and s.center_id=center and s.state='planned' and s.attendance_state='open' and s.actual_started_at is null and s.starts_at>stamp
 and exists(select 1 from jsonb_array_elements(private.schedule_snapshot(org,s.id)->'assignments') a where a->>'duty'='instructor' and a->>'person_id'=pid::text)
$$;
create function private.instructor_revoke_snapshot(org uuid,center uuid,assignment uuid,stamp timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('assignment',to_jsonb(a),'sessions',private.instructor_revoke_sessions(org,center,a.person_id,stamp),
 'snapshots',(select coalesce(jsonb_agg(private.schedule_snapshot(org,(e->>'session_id')::uuid) order by e->>'session_id'),'[]'::jsonb) from jsonb_array_elements(private.instructor_revoke_sessions(org,center,a.person_id,stamp)) e))
 from core.role_assignments a where a.org_id=org and a.scope_center_id=center and a.id=assignment and a.state='active'
$$;
create function private.instructor_revoke_preview(r jsonb,org uuid,center uuid,account uuid,ids uuid[],aux jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare a core.role_assignments;snap jsonb;pid uuid:=private.new_id(ids,2);token text:=aux->>'token';expires timestamptz:=clock_timestamp()+interval '15 minutes';out jsonb;
begin
 select * into a from core.role_assignments q where q.org_id=org and q.scope_center_id=center and q.id=(r->>'assignment_id')::uuid and q.state='active' and q.role='instructor' for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 if a.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if token is null then perform private.fail('INTEGRITY_VIOLATION');end if;
 snap:=private.instructor_revoke_snapshot(org,center,a.id,clock_timestamp());
 out:=jsonb_build_object('id',pid,'token',token,'expires_at',expires,'assignment_id',a.id,'assignment_version',a.version,'sessions',snap->'sessions');
 insert into core.previews(id,org_id,operation,actor_account_id,scope_hash,dependencies,result,state)
 values(pid,org,'role_revoke_v1',account,md5(jsonb_build_array(org,center,account,a.id)::text),jsonb_build_object('snapshot',snap,'authority',private.p07_merge_authority(org,account)),out-'token','current');
 insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(pid,jsonb_build_object('center_id',center,'assignment_id',a.id),expires,encode(extensions.digest(token,'sha256'),'hex'));
 return out;
end$$;
create function private.instructor_revoke_effect(r jsonb,org uuid,center uuid,account uuid,ids uuid[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare a core.role_assignments;snap jsonb;pv core.previews;payload private.preview_payloads;e jsonb;sid uuid;s core.sessions;d jsonb;remaining jsonb;idx int:=20;before_rows jsonb:='[]';after_rows jsonb:='[]';stamp timestamptz:=clock_timestamp();
begin
 select * into a from core.role_assignments q where q.org_id=org and q.scope_center_id=center and q.id=(r->>'assignment_id')::uuid and q.state='active' and q.role='instructor' for update;
 if not found then return '{}'::jsonb;end if;
 if a.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 snap:=private.instructor_revoke_snapshot(org,center,a.id,stamp);
 if jsonb_array_length(snap->'sessions')>0 or r?'impact_approval' then
  select * into pv from core.previews p where p.org_id=org and p.id=(r#>>'{impact_approval,id}')::uuid for update;
  select * into payload from private.preview_payloads p where p.preview_id=pv.id;
  if pv.id is null or pv.operation<>'role_revoke_v1' or pv.actor_account_id<>account or pv.state<>'current' or payload.expires_at<=stamp
   or payload.token_hash is distinct from encode(extensions.digest(r#>>'{impact_approval,token}','sha256'),'hex')
   or payload.payload is distinct from jsonb_build_object('center_id',center,'assignment_id',a.id)
   or pv.dependencies is distinct from jsonb_build_object('snapshot',snap,'authority',private.p07_merge_authority(org,account)) then perform private.fail('PREVIEW_STALE');end if;
 end if;
 for e in select x from jsonb_array_elements(snap->'sessions') x order by x->>'session_id' loop
  sid:=(e->>'session_id')::uuid;
  select * into s from core.sessions q where q.org_id=org and q.id=sid for update;
  d:=private.schedule_snapshot(org,sid);before_rows:=before_rows||jsonb_build_array(d);
  select coalesce(jsonb_agg(x order by x->>'person_id',x->>'duty'),'[]'::jsonb) into remaining from jsonb_array_elements(d->'assignments') x where not (x->>'person_id'=a.person_id::text and x->>'duty'='instructor');
  update core.session_assignments q set state='inactive',version=q.version+1,origin_class_assignment_id=null where q.org_id=org and q.session_id=sid and q.person_id=a.person_id and q.duty='instructor' and q.state='active';
  -- Materialize remaining legacy defaults before disabling fallback. Completed/begun rows and class templates remain untouched.
  for e in select x from jsonb_array_elements(remaining) x loop
   if not exists(select 1 from core.session_assignments q where q.org_id=org and q.session_id=sid and q.person_id=(e->>'person_id')::uuid and q.duty=e->>'duty' and q.state='active') then
    insert into core.session_assignments(id,org_id,center_id,session_id,person_id,duty,agreement_id,origin_class_assignment_id,state)
    values(private.new_id(ids,idx),org,center,sid,(e->>'person_id')::uuid,e->>'duty',(e->>'agreement_id')::uuid,(e->>'origin_class_assignment_id')::uuid,'active');idx:=idx+1;
   end if;
  end loop;
  update core.resource_bookings q set state='inactive',version=q.version+1 where q.org_id=org and q.session_id=sid and q.resource_kind='person' and q.resource_id=a.person_id and q.duty_assignment and q.state='active'
   and not exists(select 1 from jsonb_array_elements(remaining) x where x->>'person_id'=a.person_id::text);
  update core.sessions q set assignment_mode='explicit',version=q.version+1 where q.org_id=org and q.id=sid;
  after_rows:=after_rows||jsonb_build_array(private.schedule_snapshot(org,sid));
 end loop;
 if pv.id is not null then update core.previews set state='applied',version=version+1 where id=pv.id;end if;
 return jsonb_build_object('instructor_revocation',jsonb_build_object('sessions',snap->'sessions','before',before_rows,'after',after_rows));
end$$;
create function private.session_needs_instructor(org uuid,sid uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from core.sessions s where s.org_id=org and s.id=sid and s.state='planned' and s.attendance_state='open' and s.actual_started_at is null
 and not exists(select 1 from jsonb_array_elements(private.schedule_snapshot(org,s.id)->'assignments') a where a->>'duty'='instructor'))
$$;
create function private.session_management_attention(org uuid,sid uuid,actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when exists(select 1 from core.sessions s where s.org_id=org and s.id=sid and private.is_manager(org,actor,s.center_id)) and private.session_needs_instructor(org,sid)
 then jsonb_build_object('management_attention','instructor_required') else '{}'::jsonb end
$$;
-- Durable manager work list: no calendar interval can hide an overdue unresolved session.
create function private.instructor_attention_page(r jsonb,org uuid,center uuid,person uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';lim int:=coalesce((r#>>'{page,limit}')::int,50);cur jsonb;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();items jsonb;token text;
 h text:=md5(jsonb_build_object('account',account,'request',r-'request_id'-'page')::text);
begin
 if center is null or not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
 if not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 perform private.require_feature(org,'F13');
 if r#>>'{selector,operation}' is distinct from 'session_assignment_set_v1' or lim<1 or lim>200 or coalesce(r#>>'{page,sort}','starts_at_asc')<>'starts_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 if k?'person_id' or k?'agreement_id' or (k?'duty' and k->>'duty'<>'instructor') then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb and r#>>'{entity,type}'<>'sessions' then perform private.fail('NOT_FOUND');end if;
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or last_at is null or last_id is null or asof is null or not isfinite(last_at) or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with page as(
  select s.* from core.sessions s where s.org_id=org and s.center_id=center and s.created_at<=asof and private.session_needs_instructor(org,s.id)
   and private.starter_session_allowed(org,s.id,false) and (k->>'session_id' is null or s.id=(k->>'session_id')::uuid)
   and (r#>>'{entity,id}' is null or s.id=(r#>>'{entity,id}')::uuid) and (cur is null or (s.starts_at,s.id)>(last_at,last_id))
  order by s.starts_at,s.id limit lim+1
 ) select coalesce(jsonb_agg(jsonb_build_object('operation','session_assignment_set_v1','entity',jsonb_build_object('type','sessions','id',id),'exists',true,'state',state,
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sessions','id',id),'version',version)),'as_of',asof,'management_attention','instructor_required',
  'current',jsonb_build_object('operation','session_assignment_set_v1','values',jsonb_build_object('session_id',id,'duty','instructor')),
  'session_detail',private.schedule_session_view(org,id,true)||jsonb_build_object('management_attention','instructor_required'),'_at',starts_at) order by starts_at,id),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)>lim then
  items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',(items->-1)#>'{entity,id}','as_of',asof)::text,'utf8'),'hex');
 end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof);
end$$;
create or replace function private.starter_session_allowed(org uuid,target uuid,operational boolean default true) returns boolean language sql stable set search_path='' as $$
 select private.current_plan_name(org) is distinct from 'starter' or exists(select 1 from core.sessions s where s.org_id=org and s.id=target
 and private.center_accessible(org,s.center_id) and private.starter_selected(org,'discipline',s.discipline_id)
 and (not operational or ((select count(distinct b.resource_id) from core.resource_bookings b where b.org_id=org and b.session_id=s.id and (b.state='active' or s.attendance_state='closed') and b.resource_kind='room')=1 and jsonb_array_length(private.schedule_snapshot(org,s.id)->'assignments')<=1))
 and not exists(select 1 from core.resource_bookings b where b.org_id=org and b.session_id=s.id and (b.state='active' or s.attendance_state='closed' or not operational) and b.resource_kind='room' and not private.starter_selected(org,'room',b.resource_id))
 and not exists(select 1 from jsonb_array_elements(private.schedule_snapshot(org,s.id)->'assignments') a where a->>'duty'<>'instructor' or (operational and not private.starter_selected(org,'instructor',(a->>'person_id')::uuid))))
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$ if p_operation='management_state_get_v1' and r->>'operation'='room_save_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor management dispatch anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation'='role_assign_v1' then
  out:=private.instructor_management_page(r,org,center,person,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
 if p_operation='management_state_get_v1' and r->>'operation'='session_assignment_set_v1' then
  out:=private.instructor_attention_page(r,org,center,person,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
 if p_operation='management_state_get_v1' and r->>'operation'='room_save_v1' then$a$);
 a:=$a$ when 'center_manager_revoke_v1','org_manager_revoke_v1','role_revoke_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor preview dispatch anchor drift';end if;
 b:=replace(b,a,$a$ when 'role_revoke_preview_v1' then
  out:=private.instructor_revoke_preview(r,org,center,actor.id,p_ids,p_aux);
 when 'center_manager_revoke_v1','org_manager_revoke_v1','role_revoke_v1' then$a$);
 a:=$a$  if p_operation='role_revoke_v1' then
   update core.role_assignments$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor revoke anchor drift';end if;
 b:=replace(b,a,$a$  if p_operation='role_revoke_v1' then
   audit_delta:=coalesce(audit_delta,'{}'::jsonb)||private.instructor_revoke_effect(r,org,center,actor.id,p_ids);
   update core.role_assignments$a$);
 a:=$a$   out:=private.schedule_session_view(org,ses.id,org_reader or private.is_manager(org,person,ses.center_id));$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor attention detail anchor drift';end if;
 b:=replace(b,a,a||E'\n'||'   out:=out||private.session_management_attention(org,ses.id,person);');execute b;
 -- Keep the existing creation requirement; an already unassigned session can continue normally.
 b:=pg_get_functiondef('private.starter_schedule_guard(uuid,jsonb)'::regprocedure);
 a:=$a$(select count(*) from jsonb_array_elements(d->'assignments') x where x->>'duty'='instructor')<>1$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor lifecycle schedule anchor drift';end if;
 execute replace(b,a,$a$((select count(*) from jsonb_array_elements(d->'assignments') x where x->>'duty'='instructor')<>1
 and not (jsonb_array_length(d->'assignments')=0 and exists(select 1 from core.sessions s where s.org_id=org and s.id=(d->>'id')::uuid and jsonb_array_length(private.schedule_snapshot(org,s.id)->'assignments')=0)))$a$);
 b:=pg_get_functiondef('private.starter_request_guard(text,jsonb,uuid)'::regprocedure);
 a:=$a$op not in ('session_get_v1','attendance_get_v1','attendance_history_v1','replacement_session_create_v1')$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor repair request anchor drift';end if;
 execute replace(b,a,$a$op not in ('session_get_v1','attendance_get_v1','attendance_history_v1','replacement_session_create_v1','session_assignment_set_v1','reservation_list_v1','reservation_cancel_v1','session_cancel_preview_v1','session_cancel_apply_v1')$a$);
 b:=pg_get_functiondef('private.starter_reservation_guard()'::regprocedure);
 a:='not private.starter_session_allowed(new.org_id,new.session_id)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor orphan reservation maintenance anchor drift';end if;
 execute replace(b,a,'not private.starter_session_allowed(new.org_id,new.session_id,new.state<>''cancelled'')');
 b:=pg_get_functiondef('private.starter_schedule_write_guard(uuid,jsonb)'::regprocedure);
 a:='not private.starter_session_allowed(org,ses)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor repair write anchor drift';end if;
 b:=replace(b,a,'not private.starter_session_allowed(org,ses,false)');
 a:=$a$if not coalesce((d->>'_touch')::boolean,true) then continue;end if;ses:=(d->>'id')::uuid;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor repair proposal anchor drift';end if;
 execute replace(b,a,a||' perform private.starter_schedule_guard(org,d);');
 b:=pg_get_functiondef('private.schedule_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=$a$ if op='calendar_get_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor attention permission anchor drift';end if;
 b:=replace(b,a,$a$ if op='calendar_get_v1' and coalesce((r->>'needs_instructor')::bool,false) and (center is null or not private.is_manager(org,actor,center)) then perform private.fail('FORBIDDEN');end if;
 if op='calendar_get_v1' then$a$);
 a:=$a$where (center is null or c.center_id=center) and c.starts_at<hi and c.ends_at>lo$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor attention filter anchor drift';end if;
 b:=replace(b,a,a||$a$ and (not coalesce((r->>'needs_instructor')::bool,false) or (c.kind='session' and private.session_needs_instructor(org,c.id)))$a$);
 a:=$a$case when c.kind='session' then jsonb_build_object('discipline_id',c.discipline_id) else jsonb_build_object('discipline_ids',c.discipline_ids) end ||$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor attention projection anchor drift';end if;
 execute replace(b,a,a||' private.session_management_attention(org,c.id,actor) ||');
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('role_revoke_preview_v1','center.manage','config',array['F04']::text[]);
create function api_v1.role_revoke_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('role_revoke_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.role_revoke_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.role_revoke_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
revoke all on function private.instructor_attention_page(jsonb,uuid,uuid,uuid,uuid),private.instructor_management_page(jsonb,uuid,uuid,uuid,uuid),private.instructor_revoke_sessions(uuid,uuid,uuid,timestamptz),private.instructor_revoke_snapshot(uuid,uuid,uuid,timestamptz),private.instructor_revoke_preview(jsonb,uuid,uuid,uuid,uuid[],jsonb),private.instructor_revoke_effect(jsonb,uuid,uuid,uuid,uuid[]),private.session_needs_instructor(uuid,uuid),private.session_management_attention(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.instructor_attention_page(jsonb,uuid,uuid,uuid,uuid),private.instructor_management_page(jsonb,uuid,uuid,uuid,uuid),private.instructor_revoke_sessions(uuid,uuid,uuid,timestamptz),private.instructor_revoke_snapshot(uuid,uuid,uuid,timestamptz),private.instructor_revoke_preview(jsonb,uuid,uuid,uuid,uuid[],jsonb),private.instructor_revoke_effect(jsonb,uuid,uuid,uuid,uuid[]),private.session_needs_instructor(uuid,uuid),private.session_management_attention(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
