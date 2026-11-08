begin;
create table private.digital_agreement_acceptances(
 id uuid primary key,org_id uuid not null references core.organizations(id),agreement_id uuid not null,person_id uuid not null,account_id uuid not null references core.accounts(id),
 accepted_at timestamptz not null default clock_timestamp(),displayed_content jsonb not null,content_hash text not null,
 source_content_hash text not null,source_facts jsonb not null,operation_id uuid not null,
 unique(org_id,agreement_id,account_id),foreign key(org_id,agreement_id) references core.instructor_agreements(org_id,id),
 foreign key(org_id,person_id) references core.people(org_id,id),foreign key(org_id,operation_id) references core.operation_receipts(org_id,id) deferrable initially deferred
);
alter table private.digital_agreement_acceptances enable row level security;
revoke all on private.digital_agreement_acceptances from public,anon,authenticated;
grant select,insert on private.digital_agreement_acceptances to service_role;
create trigger digital_agreement_acceptance_immutable before update or delete on private.digital_agreement_acceptances for each row execute function private.p05_immutable();
create function private.digital_agreement_view(a core.instructor_agreements) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',a.id,'version',a.version,'person_id',a.person_id,'center_id',a.center_id,'discipline_id',a.discipline_id,'format',a.format,
 'valid',jsonb_build_object('starts_at',to_char(a.valid_from at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'ends_at',to_char(a.valid_until at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),'supersedes_id',a.supersedes_id,'terms',a.terms,'published_at',to_char(a.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
$$;
create function private.digital_agreement_access(op text,r jsonb,org uuid,center uuid,person uuid) returns void language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare a core.instructor_agreements;
begin
 perform private.require_feature(org,'F20');perform private.assert_center(org,center);
 select * into a from core.instructor_agreements x where x.org_id=org and x.center_id=center and x.id=(r->>'agreement_id')::uuid;
 if a.id is null then perform private.fail('NOT_FOUND');end if;
 if op='instructor_agreement_accept_v1' then
  if a.person_id is distinct from person or not private.starter_instructor_active(org,center,person) then perform private.fail('FORBIDDEN');end if;
 elsif not private.is_manager(org,person,center) and not(a.person_id=person and private.starter_instructor_active(org,center,person)) then perform private.fail('FORBIDDEN');end if;
end$$;
create function private.digital_agreement_execute(op text,r jsonb,org uuid,center uuid,person uuid,account uuid,operation uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare a core.instructor_agreements;e private.digital_agreement_acceptances;facts jsonb;h text;display_hash text;result jsonb;aid uuid:=private.new_id(ids,2);
begin
 perform private.digital_agreement_access(op,r,org,center,person);
 select * into a from core.instructor_agreements x where x.org_id=org and x.id=(r->>'agreement_id')::uuid;
 facts:=private.digital_agreement_view(a);h:=encode(extensions.digest(convert_to(facts::text,'UTF8'),'sha256'),'hex');
 if op='instructor_agreement_accept_v1' then
  if a.version is distinct from (r->>'expected_version')::bigint or h is distinct from r->>'source_content_hash' then perform private.fail('VERSION_CONFLICT');end if;
  display_hash:=private.digital_document_hash(r->'displayed_content');
  if display_hash is distinct from r->>'displayed_content_hash' then perform private.fail('VALIDATION_FAILED');end if;
  insert into private.digital_agreement_acceptances(id,org_id,agreement_id,person_id,account_id,displayed_content,content_hash,source_content_hash,source_facts,operation_id)
   values(aid,org,a.id,person,account,r->'displayed_content',display_hash,h,facts,operation) on conflict(org_id,agreement_id,account_id) do nothing;
  select * into e from private.digital_agreement_acceptances x where x.org_id=org and x.agreement_id=a.id and x.account_id=account;
  if e.displayed_content is distinct from r->'displayed_content' or e.source_content_hash is distinct from h then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
  result:=jsonb_build_object('operation_id',operation,'primary_id',a.id,'version',a.version,'replayed',false,'related',jsonb_build_array(jsonb_build_object('type','instructor_agreements','id',a.id)));
 else
  select * into e from private.digital_agreement_acceptances x where x.org_id=org and x.agreement_id=a.id and x.person_id=a.person_id order by x.accepted_at,x.id limit 1;
  result:=jsonb_build_object('agreement',facts,'source_content_hash',h,'acceptance',case when e.id is not null then jsonb_build_object('id',e.id,'agreement_id',a.id,'account_id',e.account_id,'person_id',e.person_id,'accepted_at',e.accepted_at,'content_hash',e.content_hash,'source_content_hash',e.source_content_hash,'displayed_content',e.displayed_content) end);
 end if;
 return jsonb_build_object('data',result,'primary_id',a.id,'subject','instructor_agreements','version',a.version);
end$$;
create function private.digital_agreement_management(r jsonb,org uuid,center uuid,person uuid,account uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare body jsonb:=r||(r#>'{selector,key}');v jsonb;entity jsonb;at timestamptz:=clock_timestamp();
begin
 if r#>>'{selector,operation}' is distinct from 'instructor_agreement_accept_v1' or r#>>'{page,cursor}' is not null then perform private.fail('VALIDATION_FAILED');end if;
 perform private.digital_agreement_access('instructor_agreement_accept_v1',body,org,center,person);
 v:=private.digital_agreement_execute('instructor_agreement_get_v1',body,org,center,person,account,null,ids)->'data';
 entity:=jsonb_build_object('type','instructor_agreements','id',body->'agreement_id');
 return jsonb_build_object('items',jsonb_build_array(jsonb_build_object('operation','instructor_agreement_accept_v1','entity',entity,'exists',true,'state','published','versions',jsonb_build_array(jsonb_build_object('entity',entity,'version',v#>'{agreement,version}')),'as_of',at,'current',jsonb_build_object('operation','instructor_agreement_accept_v1','values',jsonb_build_object('agreement_id',body->'agreement_id','source_content_hash',v->'source_content_hash')))),'next_cursor',null,'as_of',at);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$ if perm_code='preparation.resolve' then null;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Digital agreement permission dispatch drift';end if;
 b:=replace(b,a,$a$ if p_operation in ('instructor_agreement_get_v1','instructor_agreement_accept_v1') or (p_operation='management_state_get_v1' and r->>'operation'='instructor_agreement_accept_v1') then perform private.digital_agreement_access(case when p_operation='management_state_get_v1' then 'instructor_agreement_accept_v1' else p_operation end,case when p_operation='management_state_get_v1' then r||(r#>'{selector,key}') else r end,org,center,person);elsif perm_code='preparation.resolve' then null;$a$);
 a:=E' if mutable then\n  payload_digest:=';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Digital agreement management dispatch drift';end if;
 b:=replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation'='instructor_agreement_accept_v1' then return jsonb_build_object('ok',true,'data',private.digital_agreement_management(r,org,center,person,actor.id,p_ids),'trace_id',trace);end if;
$a$||a);
 a:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Digital agreement domain dispatch drift';end if;
 execute replace(b,a,$a$ when 'instructor_agreement_get_v1','instructor_agreement_accept_v1' then
  terms:=private.digital_agreement_execute(p_operation,r,org,center,person,actor.id,operation_id,p_ids);out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';version_n:=(terms->>'version')::bigint;
$a$||a);
end$patch$;
revoke all on function private.digital_agreement_management(jsonb,uuid,uuid,uuid,uuid,uuid[]),private.digital_agreement_view(core.instructor_agreements),private.digital_agreement_access(text,jsonb,uuid,uuid,uuid),private.digital_agreement_execute(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.digital_agreement_management(jsonb,uuid,uuid,uuid,uuid,uuid[]),private.digital_agreement_view(core.instructor_agreements),private.digital_agreement_access(text,jsonb,uuid,uuid,uuid),private.digital_agreement_execute(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('instructor_agreement_get_v1','earnings.read','read',array['F20']::text[]);
create function api_v1.instructor_agreement_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('instructor_agreement_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.instructor_agreement_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.instructor_agreement_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('instructor_agreement_accept_v1','document.accept','maintenance',array['F20']::text[]);
create function api_v1.instructor_agreement_accept_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('instructor_agreement_accept_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.instructor_agreement_accept_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.instructor_agreement_accept_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
