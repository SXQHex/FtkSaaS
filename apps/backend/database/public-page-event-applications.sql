begin;

-- Address reservations outlive renames. Existing unmanaged organizations keep their native addresses.
create table private.public_page_addresses(
 slug text primary key,
 org_id uuid not null references core.organizations(id),
 check(length(slug) between 3 and 63 and slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
  and slug !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
);
create index public_page_addresses_org on private.public_page_addresses(org_id);
alter table private.public_page_addresses enable row level security;
revoke all on private.public_page_addresses from public,anon,authenticated;
grant select,insert on private.public_page_addresses to service_role;

create function private.public_page_address_reserve() returns trigger language plpgsql security invoker set search_path='' as $$
declare org uuid; alias text; owner_org uuid;
begin
 if new.scope<>'organization' or jsonb_typeof(new.values->'public_page') is distinct from 'object' then return new;end if;
 org:=split_part(new.scope_key,':',2)::uuid;alias:=new.values#>>'{public_page,slug}';
 if exists(select 1 from core.publications p where lower(p.slug)=alias and p.org_id<>org) then perform private.fail('RESOURCE_CONFLICT');end if;
 insert into private.public_page_addresses(slug,org_id) values(alias,org) on conflict(slug) do nothing;
 select a.org_id into owner_org from private.public_page_addresses a where a.slug=alias;
 if owner_org is distinct from org then perform private.fail('RESOURCE_CONFLICT');end if;
 return new;
end$$;
create trigger public_page_address_reserve before insert or update of values on private.frontend_settings
 for each row execute function private.public_page_address_reserve();

create function private.public_page_value(org uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when jsonb_typeof(s.values->'public_page')='object' then s.values->'public_page'
  when exists(select 1 from private.public_page_addresses a where a.org_id=$1) then '{"enabled":false}'::jsonb
  end
 from core.organizations o left join private.frontend_settings s on s.scope_key='organization:'||o.id
 where o.id=$1
$$;
create function private.public_page_accepts(org uuid,slug text default null) returns boolean
language sql stable security invoker set search_path='' as $$
 select page is null or (page->'enabled'='true'::jsonb and ($2 is null or page->>'slug'=$2))
 from (select private.public_page_value($1) page) configuration
$$;

create or replace function private.settings_public_slug(slug text) returns uuid language sql stable security invoker set search_path='' as $$
 select c.org_id from (
  select a.org_id from private.public_page_addresses a where a.slug=$1
  union
  select o.id from core.organizations o where o.id=(case when $1 ~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then $1::uuid end)
  union
  select p.org_id from core.publications p where p.slug=$1 and p.published
 ) c where private.public_page_accepts(c.org_id,$1)
 order by c.org_id limit 1
$$;

create function private.public_page_matches(pub core.publications,slug text) returns boolean
language sql stable security invoker set search_path='' as $$
 select private.public_page_accepts(($1).org_id,$2)
 and (private.public_page_value(($1).org_id) is not null or ($1).slug=$2)
$$;

do $patch$
declare body text; anchor text;
begin
 body:=pg_get_functiondef('private.frontend_settings_field_access(text,jsonb,uuid,uuid)'::regprocedure);
 anchor:=' for key in select jsonb_array_elements_text(keys) loop';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Public page field permission drift';end if;
 execute replace(body,anchor,anchor||$a$
  if key='public_page' then perform private.require_feature(org,'F25');end if;
$a$);

 body:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$'catalog_version',24$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Public page catalog version drift';end if;
 execute replace(body,anchor,$a$'catalog_version',25$a$);

 body:=pg_get_functiondef('private.public_program_page_context(jsonb)'::regprocedure);
 anchor:=$a$where p.slug=r->>'slug' and p.published$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Public page availability drift';end if;
 execute replace(body,anchor,$a$where p.org_id=org and private.public_page_matches(p,r->>'slug') and p.published$a$);

 body:=pg_get_functiondef('private.crm_intake_submit(jsonb,uuid[],jsonb)'::regprocedure);
 anchor:=$a$ if private.current_plan_name(org)='starter' then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Public page form gate drift';end if;
 execute replace(body,anchor,$a$ if not private.public_page_accepts(org) and exists(
  select 1 from private.frontend_settings s
  where s.scope_key=case when f.center_id is null then 'organization:'||org else 'center:'||org||':'||f.center_id end
   and s.values#>>'{public_application_form,form_id}'=f.id::text
 ) then perform private.fail('SERVICE_UNAVAILABLE');end if;
$a$||anchor);

 body:=pg_get_functiondef('private.p04_public(text,jsonb,uuid[],jsonb)'::regprocedure);
 anchor:=$a$where p.slug=r->>'slug' and p.published$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Public page list drift';end if;
 body:=replace(body,anchor,$a$where p.org_id=org and private.public_page_matches(p,r->>'slug') and p.published$a$);
 anchor:=$a$ if op='public_calendar_get_v1' then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Public page route resolution drift';end if;
 body:=replace(body,anchor,anchor||$a$
  org:=private.settings_public_slug(r->>'slug');$a$);
 anchor:=$a$ if not found or private.access_mode(org) not in ('normal','grace')$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Public page submit availability drift';end if;
 body:=replace(body,anchor,$a$ if not found or not private.public_page_accepts(org) or private.access_mode(org) not in ('normal','grace')$a$);
 anchor:=$a$ if contact is null or length(contact)>320$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Event application target gate drift';end if;
 body:=replace(body,anchor,$a$ if r?'event_application' and (r->'event_application' is distinct from 'true'::jsonb
  or pub.event_id is null or r->>'page_slug' is null
  or private.settings_public_slug(r->>'page_slug') is distinct from org
  or not private.public_page_matches(pub,r->>'page_slug')) then perform private.fail('SERVICE_UNAVAILABLE');end if;
$a$||anchor);
 anchor:=$a$jsonb_build_object('publication',pub.id,'contact',contact)::text$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Event application replay digest drift';end if;
 body:=replace(body,anchor,$a$(jsonb_build_object('publication',pub.id,'contact',contact)
  ||case when r?'event_application' then jsonb_build_object('event_application',true,'page_slug',r->'page_slug') else '{}'::jsonb end)::text$a$);
 anchor:=$a$jsonb_build_object('accepted',true),'trace_id',trace$a$;
 if array_length(string_to_array(body,anchor),1)<>3 then raise exception 'Event application acknowledgment drift';end if;
 execute replace(body,anchor,$a$jsonb_build_object('accepted',true)
  ||case when r?'event_application' then '{"application_state":"pending"}'::jsonb else '{}'::jsonb end,'trace_id',trace$a$);
end$patch$;

revoke all on function private.public_page_address_reserve(),private.public_page_value(uuid),
 private.public_page_accepts(uuid,text),private.public_page_matches(core.publications,text) from public,anon,authenticated;
grant execute on function private.public_page_address_reserve(),private.public_page_value(uuid),
 private.public_page_accepts(uuid,text),private.public_page_matches(core.publications,text) to service_role;
commit;
