-- Isolate the Data API surface from the service-only api_v1 RPCs.
begin;

create schema api_read;
revoke all on schema api_read from public,anon,authenticated,service_role;
grant usage on schema api_read to authenticated;

do $$
begin
 if not exists(select 1 from pg_roles where rolname='ftk_centers_read') then
  create role ftk_centers_read nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
 end if;
end$$;
grant ftk_centers_read to current_user with set true;
grant usage on schema core,private to ftk_centers_read;
grant select (id,org_id,name,timezone,state,version) on core.centers to ftk_centers_read;

-- The scope comes from the dispatcher after its existing account and organization checks.
-- Only the projection's restricted owner can read core.centers through this policy.
create function private.centers_read_visible(row_org uuid,row_center uuid,scope jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select row_org=(scope->>'org')::uuid
  and ((scope->>'org_reader')::boolean
   or private.is_manager(row_org,(scope->>'person')::uuid,row_center)
   or exists(select 1 from private.person_center_relationships
    where org_id=row_org and center_id=row_center and person_id=(scope->>'person')::uuid and state='active'))
$$;
revoke all on function private.centers_read_visible(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.centers_read_visible(uuid,uuid,jsonb) to ftk_centers_read;

create policy centers_read_api on core.centers for select to ftk_centers_read using (
 private.centers_read_visible(org_id,id,(select nullif(current_setting('ftk.centers_read_scope',true),'')::jsonb))
);

create function private.centers_read_rows(p_org uuid,p_person uuid,p_org_reader boolean) returns jsonb
language plpgsql security definer set search_path='' set row_security='on' as $$
declare
 items jsonb;
 prior_scope text:=current_setting('ftk.centers_read_scope',true);
begin
 perform set_config('ftk.centers_read_scope',jsonb_build_object('org',p_org,'person',p_person,'org_reader',p_org_reader)::text,true);
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'name',c.name,'timezone',c.timezone,'state',c.state,'accessible',true,'version',c.version
 )),'[]'::jsonb) into items from core.centers c where c.org_id=p_org;
 perform set_config('ftk.centers_read_scope',coalesce(prior_scope,''),true);
 return jsonb_build_object('items',items,'next_cursor',null);
end$$;
revoke all on function private.centers_read_rows(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant create on schema private to ftk_centers_read;
alter function private.centers_read_rows(uuid,uuid,boolean) owner to ftk_centers_read;
revoke create on schema private from ftk_centers_read;
grant execute on function private.centers_read_rows(uuid,uuid,boolean) to current_user,service_role;

-- Reuse the native factor and stored session AAL check on both transports.
create function private.account_mfa_check_verified(auth_id uuid,session uuid,aux jsonb) returns void
language plpgsql stable set search_path='' as $$
begin
 if exists(select 1 from auth.mfa_factors f where f.user_id=auth_id and f.status::text='verified')
  and (aux->>'verified_aal' is distinct from 'aal2' or not exists(select 1 from auth.sessions s
   where s.id=session and s.user_id=auth_id and to_jsonb(s)->>'aal'='aal2'))
 then perform private.fail('AUTH_REQUIRED');end if;
end$$;
revoke all on function private.account_mfa_check_verified(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create or replace function private.account_mfa_assert(auth_id uuid,session uuid,aux jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
  and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role'
 then perform private.fail('FORBIDDEN');end if;
 perform private.account_mfa_check_verified(auth_id,session,aux);
end$$;

-- Keep all lifecycle, tenant, permission, billing and response logic in the existing dispatcher.
do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 changes text[][]:=array[
  array[$old$ r jsonb:=private.capacity_request(p_operation,p_request);$old$,
        $new$ claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 data_api boolean:=p_operation='centers_list_v1' and claims->>'role'='authenticated'
  and claims->>'sub'=p_actor_auth_id::text and claims->>'session_id'=p_session_id::text
  and p_request->'include_setup_status' is distinct from 'true'::jsonb;
 r jsonb:=private.capacity_request(p_operation,p_request);$new$],
  array[$old$  and coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;$old$,
        $new$  and coalesce(claims->>'role','')<>'service_role' and not coalesce(data_api,false) then perform private.fail('FORBIDDEN');end if;$new$],
  array[$old$ if not (p_operation='account_sessions_revoke_v1' and r->>'mode'='current') then perform private.account_mfa_assert(usr.id,p_session_id,p_aux);end if;$old$,
        $new$ if data_api then
  perform private.account_mfa_check_verified(usr.id,p_session_id,jsonb_build_object('verified_aal',claims->>'aal'));
 elsif not (p_operation='account_sessions_revoke_v1' and r->>'mode'='current') then
  perform private.account_mfa_assert(usr.id,p_session_id,p_aux);
 end if;$new$],
  array[$old$  select owner_person_id into owner from core.organizations where id=org for update;$old$,
        $new$  if data_api then
   select owner_person_id into owner from core.organizations where id=org for share;
  else
   select owner_person_id into owner from core.organizations where id=org for update;
  end if;$new$],
  array[$old$  out:=jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'timezone',c.timezone,'state',c.state,'accessible',true,'version',c.version)) from core.centers c where c.org_id=org and (org_reader or private.is_manager(org,person,c.id) or exists(select 1 from private.person_center_relationships where org_id=org and center_id=c.id and person_id=person and state='active'))),'[]'::jsonb),'next_cursor',null);$old$,
        $new$  out:=private.centers_read_rows(org,person,org_reader);$new$]
 ];
 change text[];
begin
 foreach change slice 1 in array changes loop
  if cardinality(string_to_array(body,change[1]))<>2 then
   raise exception 'Center Data API dispatcher anchor changed: %',left(change[1],72);
  end if;
  body:=replace(body,change[1],change[2]);
 end loop;
 execute body;
end$patch$;

-- Request_centers_list from the shared contract. This endpoint accepts the plain list.
create function private.centers_read_request_valid(r jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare
 page jsonb:=r->'page';
 uuid_format constant text:='^(urn:uuid:)?[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$';
 page_limit numeric;
begin
 if jsonb_typeof(r) is distinct from 'object'
  or not (r ?& array['client_api_version','request_id','org_id','page'])
  or r-array['client_api_version','request_id','org_id','center_id','page','include_setup_status']<>'{}'::jsonb
 then return false;end if;
 if jsonb_typeof(r->'request_id')<>'string' or r->>'request_id' !~* uuid_format
  or jsonb_typeof(r->'org_id')<>'string' or r->>'org_id' !~* uuid_format
  or (r?'center_id' and r->'center_id'<>'null'::jsonb and (jsonb_typeof(r->'center_id')<>'string' or r->>'center_id' !~* uuid_format))
  or (r?'include_setup_status' and jsonb_typeof(r->'include_setup_status')<>'boolean')
 then return false;end if;
 if jsonb_typeof(page) is distinct from 'object' or page-array['limit','cursor','sort']<>'{}'::jsonb
  or (page?'cursor' and page->'cursor'<>'null'::jsonb and (jsonb_typeof(page->'cursor')<>'string' or page->>'cursor'=''))
  or (page?'sort' and (jsonb_typeof(page->'sort')<>'string' or page->>'sort' not in (
   'created_at_asc','created_at_desc','starts_at_asc','display_name_asc','due_at_asc')))
 then return false;end if;
 if page?'limit' then
  if jsonb_typeof(page->'limit')<>'number' then return false;end if;
  page_limit:=(page->>'limit')::numeric;
  if page_limit not between 1 and 200 or page_limit<>trunc(page_limit) then return false;end if;
 end if;
 return true;
end$$;
revoke all on function private.centers_read_request_valid(jsonb) from public,anon,authenticated,service_role;

-- Browser rollout is opt-in per environment from the existing Edge allowlist.
create table private.centers_read_browser_origins(origin text primary key);
alter table private.centers_read_browser_origins enable row level security;
revoke all on table private.centers_read_browser_origins from public,anon,authenticated,service_role;

create function api_read.centers_list_v1(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 request_origin text:=nullif(current_setting('request.headers',true),'')::jsonb->>'origin';
 request_epoch numeric:=extract(epoch from statement_timestamp());
 auth_id uuid;
 session_id uuid;
 result jsonb;
 error_code text;
 status text;
begin
 if request_origin is not null and not exists(
  select 1 from private.centers_read_browser_origins allowed where allowed.origin=request_origin
 ) then
  error_code:='FORBIDDEN';status:='403';
 elsif current_setting('request.method',true) is distinct from 'POST' then
  error_code:='VALIDATION_FAILED';status:='400';
 elsif length(p_request::text)>2097152 then
  error_code:='VALIDATION_FAILED';status:='400';
 elsif p_request is null or p_request='null'::jsonb then
  error_code:='TEMPORARY_FAILURE';status:='503';
 elsif p_request->'client_api_version' is distinct from '1'::jsonb then
  error_code:='CLIENT_UPDATE_REQUIRED';status:='426';
 elsif not private.centers_read_request_valid(p_request) or p_request->'include_setup_status'='true'::jsonb then
  error_code:='VALIDATION_FAILED';status:='400';
 elsif claims->>'role' is distinct from 'authenticated' or claims->>'sub' is null then
  error_code:='AUTH_REQUIRED';status:='401';
 -- Native Auth uses strict time bounds. PostgREST's verification allows leeway.
 elsif (case when jsonb_typeof(claims->'exp')='number' then (claims->>'exp')::numeric<=request_epoch else true end)
  or (case when not claims?'nbf' then false
           when jsonb_typeof(claims->'nbf')='number' then (claims->>'nbf')::numeric>request_epoch else true end)
 then error_code:='AUTH_REQUIRED';status:='401';
 elsif claims->>'session_id' is null then
  error_code:='SESSION_REVOKED';status:='401';
 else
  auth_id:=(claims->>'sub')::uuid;
  session_id:=(claims->>'session_id')::uuid;
  -- Match the live native Auth user lookup before the dispatcher's transaction checks.
  if not exists(select 1 from auth.users u where u.id=auth_id and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=statement_timestamp()))
   or not exists(select 1 from auth.sessions s where s.id=session_id and s.user_id=auth_id)
   or (claims->>'aal' is distinct from 'aal2' and exists(
    select 1 from auth.mfa_factors f where f.user_id=auth_id and f.status::text='verified'))
  then error_code:='AUTH_REQUIRED';status:='401';
  end if;
 end if;

 perform set_config('response.headers','[{"Cache-Control":"private, no-store"},{"Vary":"Origin"}]',true);
 if error_code is not null then
  perform set_config('response.status',status,true);
  return jsonb_build_object('ok',false,'error',jsonb_build_object(
   'code',error_code,'retryable',error_code='TEMPORARY_FAILURE','trace_id',(private.ops_uuid_bank(1))[1]));
 end if;
 result:=private.execute_operation('centers_list_v1',p_request,auth_id,session_id,
  private.ops_uuid_bank(10),jsonb_build_object('verified_aal',claims->>'aal'));
 -- UUID, states, item shape and media properties are fixed by the SQL projection.
 -- The legacy success validator also rejects empty timezones and missing versions.
 if result->'ok'='true'::jsonb and exists(
  select 1 from jsonb_array_elements(result#>'{data,items}') item
  where item->>'timezone'='' or item->>'version' is null
 ) then
  perform set_config('response.status','500',true);
  return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INTEGRITY_VIOLATION',
   'retryable',false,'trace_id',result->'trace_id'));
 end if;
 return result;
end$$;
revoke all on function api_read.centers_list_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function api_read.centers_list_v1(jsonb) to authenticated;

-- Extend the exposure established by 20261017015505_api_schema_exposure.sql.
do $$
declare schemas text;
begin
 select substring(setting from length('pgrst.db_schemas=')+1) into schemas
 from pg_roles role cross join lateral unnest(role.rolconfig) setting
 where role.rolname='authenticator' and setting like 'pgrst.db_schemas=%';
 if schemas is null then raise exception 'Existing Data API schema configuration is missing';end if;
 if not 'api_read'=any(regexp_split_to_array(schemas,'\s*,\s*')) then
  execute format('alter role authenticator set pgrst.db_schemas=%L',schemas||', api_read');
 end if;
end$$;
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
