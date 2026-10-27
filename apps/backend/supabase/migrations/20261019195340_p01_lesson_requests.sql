-- P01-B. Intent rows never allocate resources, seats or purchased rights.
begin;
create function private.p01_request_instructor(org uuid,center uuid,person uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform private.assert_resource(org,center,'person',person);
 if not private.has_role(org,person,'instructor',center) then perform private.fail('NOT_FOUND');end if;
end$$;
create unique index p01_open_request_identity on core.lesson_requests(org_id,center_id,person_id,discipline_id,requested_start,duration_minutes)
where state in ('pending','alternative_offered');

-- Narrow P05 dependency: consume existing published requirements/acceptance
-- evidence. Publishing, upload and accepting on behalf remain separate APIs.
create function private.p01_request_documents(org uuid,reservation uuid) returns void language plpgsql security invoker set search_path='' as $$
declare row_data record;res core.reservations;pv uuid;
begin
 select * into res from core.reservations where org_id=org and id=reservation;
 select s.product_version_id into pv from core.entitlement_allocations a join core.sales s on s.org_id=a.org_id and s.id=a.sale_id where a.org_id=org and a.reservation_id=reservation and a.state='reserved';
 for row_data in
  select distinct on (v.document_id,r.scope) r.*,v.document_id from core.document_requirements r
  join core.document_versions v on v.org_id=r.org_id and v.id=r.document_version_id
  join core.documents d on d.org_id=v.org_id and d.id=v.document_id
  where r.org_id=org and r.operation='reservation' and d.state='active' and v.effective_at<=clock_timestamp()
  and (d.scope_center_id is null or d.scope_center_id=res.center_id)
  and (coalesce(jsonb_array_length(r.scope->'center_ids'),0)=0 or r.scope->'center_ids' ? res.center_id::text)
  and (coalesce(jsonb_array_length(r.scope->'session_ids'),0)=0 or r.scope->'session_ids' ? res.session_id::text)
  and (coalesce(jsonb_array_length(r.scope->'product_version_ids'),0)=0 or r.scope->'product_version_ids' ? pv::text)
  and coalesce(jsonb_array_length(r.scope->'event_ids'),0)=0
  order by v.document_id,r.scope,v.effective_at desc,r.created_at desc,r.id desc
 loop
  if not exists(select 1 from core.document_acceptances a join core.document_versions v on v.org_id=a.org_id and v.id=a.document_version_id
   where a.org_id=org and a.person_id=res.person_id and a.accepted_at<=clock_timestamp()
   and (a.document_version_id=row_data.document_version_id or (not row_data.renewed_acceptance and v.document_id=row_data.document_id))) then perform private.fail('DOCUMENT_REQUIRED');end if;
 end loop;
end$$;

create function private.p01_request_center(op text,r jsonb,org uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare c uuid:=(r->>'center_id')::uuid;actual uuid;
begin
 if op in ('lesson_request_create_v1') then
  if c is null then perform private.fail('VALIDATION_FAILED');end if;return c;
 end if;
 select center_id into actual from core.lesson_requests where org_id=org and id=(r->>'lesson_request_id')::uuid;
 if actual is null or (c is not null and c<>actual) then perform private.fail('NOT_FOUND');end if;return actual;
end$$;
create function private.p01_request_access(op text,r jsonb,org uuid,actor uuid,center uuid) returns void language plpgsql security invoker set search_path='' as $$
declare target uuid;
begin
 if op='lesson_request_create_v1' then target:=(r->>'person_id')::uuid;
 else select person_id into target from core.lesson_requests where org_id=org and center_id=center and id=(r->>'lesson_request_id')::uuid;end if;
 if actor is null then perform private.fail('FORBIDDEN');end if;
 if target is null then perform private.fail('NOT_FOUND');end if;
 if op in ('lesson_request_reject_v1','lesson_request_offer_alternative_v1','lesson_request_approve_v1') then
  if not private.is_manager(org,actor,center) and not private.staff_grant(org,actor,center,'request.resolve') then perform private.fail('FORBIDDEN');end if;
 elsif target<>actor and not private.is_manager(org,actor,center) and not private.staff_grant(org,actor,center,'request.write') then perform private.fail('FORBIDDEN');end if;
 if target<>actor and not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind='student') then perform private.fail('FORBIDDEN');end if;
end$$;

create function private.p01_requests_page(r jsonb,org uuid,actor uuid,center uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);h text;cur jsonb;last_at timestamptz;last_id uuid;items jsonb;token text;v jsonb;
 manager bool:=private.is_manager(org,actor,center) or private.staff_grant(org,actor,center,'request.resolve') or private.staff_grant(org,actor,center,'request.write');
begin
 if not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 if lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 if not manager and not private.is_org_reader(org,actor) and not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=actor and kind='student' and state='active') then perform private.fail('FORBIDDEN');end if;
 h:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page')::text);
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(x.item order by x.created_at,x.id),'[]'::jsonb) into items from (
  select q.created_at,q.id,jsonb_build_object('operation',r->'operation','entity',jsonb_build_object('type','lesson_requests','id',q.id),'exists',true,'state',q.state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','lesson_requests','id',q.id),'version',q.version)),'as_of',clock_timestamp(),'current',null,'request_detail',(to_jsonb(q)-'org_id')||jsonb_build_object('alternatives',coalesce((select jsonb_agg(to_jsonb(a)-'org_id'-'center_id' order by a.created_at,a.id) from core.request_alternatives a where a.org_id=org and a.center_id=center and a.request_id=q.id),'[]'::jsonb))) item
  from core.lesson_requests q where q.org_id=org and q.center_id=center
  and (manager or private.is_org_reader(org,actor) or q.person_id=actor)
  and (r->>'lesson_request_id' is null or q.id=(r->>'lesson_request_id')::uuid)
  and (r->>'person_id' is null or q.person_id=(r->>'person_id')::uuid)
  and (r->>'discipline_id' is null or q.discipline_id=(r->>'discipline_id')::uuid)
  and (last_id is null or (q.created_at,q.id)>(last_at,last_id)) order by q.created_at,q.id limit lim+1
 ) x;
 if jsonb_array_length(items)>lim then
  items:=items-(jsonb_array_length(items)-1);v:=items->(jsonb_array_length(items)-1);
  token:=encode(convert_to(jsonb_build_object('scope',h,'at',v#>>'{request_detail,created_at}','id',v#>>'{request_detail,id}')::text,'utf8'),'hex');
 end if;
 return jsonb_build_object('items',items,'next_cursor',token);
end$$;

create function private.p01_request_command(op text,r jsonb,org uuid,center uuid,actor uuid,auth_id uuid,auth_session uuid,operation uuid,ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q core.lesson_requests;a core.request_alternatives;s core.sessions;entity_id uuid:=private.new_id(ids,2);ver bigint:=1;i int:=20;x jsonb;
 starts timestamptz;ends timestamptz;instructor uuid;answer jsonb;chosen_session uuid;chosen_reservation uuid;related jsonb:='[]';mid int:=cardinality(ids)/2;
begin
 if op='lesson_request_create_v1' then
  if (r->>'requested_start')::timestamptz<=clock_timestamp() or (r->>'duration_minutes')::bigint<=0 then perform private.fail('VALIDATION_FAILED');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=(r->>'person_id')::uuid and kind='student' and state='active') then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  if not exists(select 1 from core.center_disciplines where org_id=org and center_id=center and discipline_id=(r->>'discipline_id')::uuid and state='active') then perform private.fail('NOT_FOUND');end if;
  instructor:=(r->>'preferred_instructor_id')::uuid;
  if instructor is not null then perform private.p01_request_instructor(org,center,instructor);end if;
  if exists(select 1 from core.lesson_requests where org_id=org and center_id=center and person_id=(r->>'person_id')::uuid and discipline_id=(r->>'discipline_id')::uuid and requested_start=(r->>'requested_start')::timestamptz and duration_minutes=(r->>'duration_minutes')::bigint and state in ('pending','alternative_offered')) then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  insert into core.lesson_requests(id,org_id,center_id,person_id,format,requested_start,duration_minutes,preferred_instructor_id,state,discipline_id)
   values(entity_id,org,center,(r->>'person_id')::uuid,'private',(r->>'requested_start')::timestamptz,(r->>'duration_minutes')::bigint,instructor,'pending',(r->>'discipline_id')::uuid);
 else
  select * into q from core.lesson_requests where org_id=org and center_id=center and id=(r->>'lesson_request_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;entity_id:=q.id;
  if q.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if q.state not in ('pending','alternative_offered') or (q.expires_at is not null and q.expires_at<=clock_timestamp()) then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if op in ('lesson_request_withdraw_v1','lesson_request_reject_v1') then
   update core.lesson_requests set state=case when op='lesson_request_withdraw_v1' then 'withdrawn' else 'rejected' end,version=version+1 where org_id=org and id=q.id returning version into ver;
   update core.request_alternatives set state='superseded',version=version+1 where org_id=org and request_id=q.id and state in ('offered','accepted');
  elsif op='lesson_request_offer_alternative_v1' then
   if jsonb_array_length(r->'alternatives')=0 then perform private.fail('VALIDATION_FAILED');end if;
   update core.request_alternatives set state='superseded',version=version+1 where org_id=org and request_id=q.id and state in ('offered','accepted');
   for x in select * from jsonb_array_elements(r->'alternatives') loop
    starts:=(x#>>'{interval,starts_at}')::timestamptz;ends:=(x#>>'{interval,ends_at}')::timestamptz;instructor:=(x->>'instructor_id')::uuid;
    if starts<=clock_timestamp() or ends<=starts then perform private.fail('VALIDATION_FAILED');end if;
    if instructor is not null then perform private.p01_request_instructor(org,center,instructor);end if;
    insert into core.request_alternatives(id,org_id,center_id,request_id,starts_at,ends_at,instructor_id,state)
     values(private.new_id(ids,i),org,center,q.id,starts,ends,instructor,'offered');i:=i+1;
   end loop;
   update core.lesson_requests set state='alternative_offered',version=version+1 where org_id=org and id=q.id returning version into ver;
  elsif op='lesson_request_accept_alternative_v1' then
   select * into a from core.request_alternatives where org_id=org and center_id=center and request_id=q.id and id=(r->>'alternative_id')::uuid for update;
   if not found then perform private.fail('NOT_FOUND');end if;
   if q.state<>'alternative_offered' or a.state<>'offered' or a.starts_at<=clock_timestamp() then perform private.fail('INVALID_STATE_TRANSITION');end if;
   if a.instructor_id is not null then perform private.p01_request_instructor(org,center,a.instructor_id);end if;
   update core.request_alternatives set state='superseded',version=version+1 where org_id=org and request_id=q.id and state='accepted';
   update core.request_alternatives set state='accepted',selected_at=clock_timestamp(),version=version+1 where org_id=org and id=a.id;
   update core.lesson_requests set version=version+1 where org_id=org and id=q.id returning version into ver;
  elsif op='lesson_request_approve_v1' then
   starts:=q.requested_start;ends:=starts+make_interval(mins=>q.duration_minutes::int);instructor:=q.preferred_instructor_id;
   if q.state='alternative_offered' then
    select * into a from core.request_alternatives where org_id=org and request_id=q.id and state='accepted' and selected_at is not null;
    if not found then perform private.fail('INVALID_STATE_TRANSITION');end if;starts:=a.starts_at;ends:=a.ends_at;instructor:=a.instructor_id;
   end if;
   if starts<=clock_timestamp() then perform private.fail('INVALID_STATE_TRANSITION');end if;
   if ((r->>'session_id' is null)::int+(nullif(r->'session','null') is null)::int)<>1 then perform private.fail('VALIDATION_FAILED');end if;
   if r->>'session_id' is null then
    if r#>>'{session,format}'<>'private' or (r#>>'{session,discipline_id}')::uuid<>q.discipline_id or (r#>>'{session,interval,starts_at}')::timestamptz<>starts or (r#>>'{session,interval,ends_at}')::timestamptz<>ends then perform private.fail('VALIDATION_FAILED');end if;
    answer:=private.execute_operation('session_create_v1',(r->'session')||jsonb_build_object('client_api_version',1,'request_id',r->'request_id','org_id',org,'center_id',center,'operation_key',private.new_id(ids,61)),auth_id,auth_session,ids[65:mid],null);
    if answer->>'_internal_retry'='uuid_bank_exhausted' then raise exception using errcode='54000',message='UUID_BANK_EXHAUSTED';end if;
    if not coalesce((answer->>'ok')::bool,false) then perform private.fail(answer#>>'{error,code}');end if;
    chosen_session:=(answer#>>'{data,primary_id}')::uuid;
   else chosen_session:=(r->>'session_id')::uuid;end if;
   select * into s from core.sessions where org_id=org and center_id=center and id=chosen_session for update;
   if not found then perform private.fail('NOT_FOUND');end if;
   if s.format<>'private' or s.discipline_id<>q.discipline_id or s.starts_at<>starts or s.ends_at<>ends then perform private.fail('VALIDATION_FAILED');end if;
   if instructor is not null and not exists(select 1 from core.session_assignments where org_id=org and session_id=s.id and person_id=instructor and duty='instructor' and state='active') then perform private.fail('VALIDATION_FAILED');end if;
   -- Call the existing writer: plan, resource, capacity, window,
   -- participation, rights/negative-limit guards remain authoritative.
   answer:=private.execute_operation('reservation_create_v1',jsonb_build_object('client_api_version',1,'request_id',r->'request_id','org_id',org,'center_id',center,'operation_key',private.new_id(ids,62),'session_id',s.id,'person_id',q.person_id,'mode','flexible'),auth_id,auth_session,ids[mid+1:cardinality(ids)],null);
   if answer->>'_internal_retry'='uuid_bank_exhausted' then raise exception using errcode='54000',message='UUID_BANK_EXHAUSTED';end if;
   if not coalesce((answer->>'ok')::bool,false) then perform private.fail(answer#>>'{error,code}');end if;
   chosen_reservation:=(answer#>>'{data,primary_id}')::uuid;
   perform private.p01_request_documents(org,chosen_reservation);
   update core.lesson_requests set state='approved',reservation_id=chosen_reservation,version=version+1 where org_id=org and id=q.id returning version into ver;
   related:=jsonb_build_array(jsonb_build_object('type','sessions','id',s.id),jsonb_build_object('type','reservations','id',chosen_reservation));
  end if;
 end if;
 return jsonb_build_object('operation_id',operation,'primary_id',entity_id,'version',ver,'replayed',false,'related',related);
end$$;

do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;new text;
begin
 old:='  cm:=center is not null and private.is_manager(org,person,center);org_reader:=private.is_org_reader(org,person);';
 new:=$p$  if p_operation like 'lesson_request_%' then center:=private.p01_request_center(p_operation,r,org);
  elsif p_operation='management_state_get_v1' and r->>'operation' like 'lesson_request_%' then center:=private.p01_request_center(r->>'operation',r||(r#>'{selector,key}'),org);end if;
$p$||old;
 if strpos(b,old)=0 then raise exception 'P01 request scope anchor missing';end if;b:=replace(b,old,new);
 old:='elsif perm_code=''center.manager.assign'' then';new:=$p$elsif perm_code in ('request.write','request.resolve') then
  perform private.p01_request_access(p_operation,r,org,person,center);
 $p$||old;
 if strpos(b,old)=0 then raise exception 'P01 request permission anchor missing';end if;b:=replace(b,old,new);
 old:=$p$'person.manage','person.activate','invite.student','reservation.write','attendance.draft','sale.write','finance.collect'$p$;
 b:=replace(b,old,old||$p$,'request.write','request.resolve'$p$);
 old:=$p$elsif perm_code='management.inspect' then$p$;new:=$p$elsif perm_code='management.inspect' and r->>'operation' like 'lesson_request_%' then
  perform private.require_feature(org,'F09');
  if r#>>'{selector,operation}' is distinct from r->>'operation' then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'operation'='lesson_request_create_v1' and r#>>'{selector,key,person_id}' is null then
   if not cm and not private.staff_grant(org,person,center,'request.resolve') then perform private.fail('FORBIDDEN');end if;
  else perform private.p01_request_access(r->>'operation',r||(r#>'{selector,key}'),org,person,center);end if;
 elsif perm_code='management.inspect' then$p$;
 if strpos(b,old)=0 then raise exception 'P01 management permission anchor missing';end if;b:=replace(b,old,new);
 old:=$p$terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);$p$;
 new:=$p$if p_operation='management_state_get_v1' and r->>'operation' like 'lesson_request_%' then
   out:=private.p01_requests_page(r||(r#>'{selector,key}'),org,person,center);terms:=jsonb_build_object('data',out,'subject','lesson_requests');
  else terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);end if;$p$;
 if strpos(b,old)=0 then raise exception 'P01 management read anchor missing';end if;b:=replace(b,old,new);
 old:=' -- DOMAIN_CASES';new:=$p$
 when 'lesson_request_create_v1','lesson_request_withdraw_v1','lesson_request_reject_v1','lesson_request_offer_alternative_v1','lesson_request_accept_alternative_v1','lesson_request_approve_v1' then
  out:=private.p01_request_command(p_operation,r,org,center,person,p_actor_auth_id,p_session_id,operation_id,p_ids);
  record_id:=(out->>'primary_id')::uuid;subject:='lesson_requests';
 -- DOMAIN_CASES$p$;
 if strpos(b,old)=0 then raise exception 'P01 request domain anchor missing';end if;execute replace(b,old,new);
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('lesson_request_create_v1','request.write','request',array['F09']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.lesson_request_create_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('lesson_request_create_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.lesson_request_create_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.lesson_request_create_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('lesson_request_withdraw_v1','request.write','maintenance',array['F09']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.lesson_request_withdraw_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('lesson_request_withdraw_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.lesson_request_withdraw_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.lesson_request_withdraw_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('lesson_request_reject_v1','request.resolve','maintenance',array['F09']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.lesson_request_reject_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('lesson_request_reject_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.lesson_request_reject_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.lesson_request_reject_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('lesson_request_offer_alternative_v1','request.resolve','maintenance',array['F09']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.lesson_request_offer_alternative_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('lesson_request_offer_alternative_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.lesson_request_offer_alternative_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.lesson_request_offer_alternative_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('lesson_request_accept_alternative_v1','request.write','request',array['F09']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.lesson_request_accept_alternative_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('lesson_request_accept_alternative_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.lesson_request_accept_alternative_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.lesson_request_accept_alternative_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('lesson_request_approve_v1','request.resolve','request',array['F09']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.lesson_request_approve_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('lesson_request_approve_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.lesson_request_approve_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.lesson_request_approve_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
