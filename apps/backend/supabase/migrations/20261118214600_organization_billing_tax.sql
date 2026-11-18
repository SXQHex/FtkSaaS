begin;

create table private.organization_billing_tax(
 org_id uuid primary key references core.organizations(id),
 tax_office text check(length(btrim(tax_office)) between 1 and 200),
 tax_identifier text check(length(btrim(tax_identifier)) between 1 and 100),
 version bigint not null default 1 check(version>0)
);
alter table private.organization_billing_tax enable row level security;
revoke all on private.organization_billing_tax from public,anon,authenticated;
grant select,insert,update on private.organization_billing_tax to service_role;

create function private.organization_billing_tax_get(org uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('org_id',o.id,'version',coalesce(t.version,0),'tax_office',t.tax_office,'tax_identifier',t.tax_identifier)
 from core.organizations o left join private.organization_billing_tax t on t.org_id=o.id where o.id=$1
$$;
create function private.organization_billing_tax_set(org uuid,r jsonb) returns bigint
language plpgsql security invoker set search_path='' as $$
declare version_n bigint;
begin
 select p.version into version_n from private.organization_billing_tax p where p.org_id=org for update;
 if coalesce(version_n,0) is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 insert into private.organization_billing_tax(org_id,tax_office,tax_identifier)
 values(org,btrim(r->>'tax_office'),btrim(r->>'tax_identifier'))
 on conflict(org_id) do update set tax_office=excluded.tax_office,tax_identifier=excluded.tax_identifier,
  version=organization_billing_tax.version+1
 returning version into version_n;
 return version_n;
end$$;

do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);anchor text:=' -- DOMAIN_CASES';
begin
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Billing tax profile dispatch drift';end if;
 execute replace(body,anchor,$a$
 when 'organization_billing_tax_get_v1' then out:=private.organization_billing_tax_get(org);
 when 'organization_billing_tax_set_v1' then
  record_id:=org;subject:='organizations';version_n:=private.organization_billing_tax_set(org,r);
$a$||anchor);
end$patch$;

-- Receipt digests retain replay identity while tracking omits tax data.
create or replace function private.p06_scrub(value jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb;
begin
 if jsonb_typeof(value)='object' then
  select coalesce(jsonb_object_agg(k,private.p06_scrub(v)),'{}'::jsonb) into result
   from jsonb_each(value) e(k,v)
   where k not in ('token','password','secret','bot_proof','sealed_token','authorization','tax_office','tax_identifier');
  return result;
 elsif jsonb_typeof(value)='array' then
  select coalesce(jsonb_agg(private.p06_scrub(v) order by n),'[]'::jsonb) into result
   from jsonb_array_elements(value) with ordinality e(v,n);
  return result;
 end if;
 return value;
end$$;

insert into private.runtime_operations(name,permission,billing_class,features) values('organization_billing_tax_get_v1','org.owner','read',array[]::text[]);
insert into private.runtime_operations(name,permission,billing_class,features) values('organization_billing_tax_set_v1','org.owner','config',array[]::text[]);
create function api_v1.organization_billing_tax_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organization_billing_tax_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
create function api_v1.organization_billing_tax_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organization_billing_tax_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function private.organization_billing_tax_get(uuid),private.organization_billing_tax_set(uuid,jsonb),
 api_v1.organization_billing_tax_get_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.organization_billing_tax_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.organization_billing_tax_get(uuid),private.organization_billing_tax_set(uuid,jsonb),
 api_v1.organization_billing_tax_get_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.organization_billing_tax_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;

do $patch$
declare body text:=pg_get_functiondef('private.tracking_operation_module(text)'::regprocedure);
 anchor text:='"saas_payment_verify_v1":"M12"';
begin
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Billing tax audit module drift';end if;
 execute replace(body,anchor,anchor||',"organization_billing_tax_set_v1":"M12"');
end$patch$;
commit;
