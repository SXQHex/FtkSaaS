begin;
create table core."event_disciplines" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1 not null check(version>=1),
  "org_id" uuid not null,
  "center_id" uuid not null,
  "event_id" uuid not null,
  "discipline_id" uuid not null,
  unique(org_id,id),
  unique(org_id,center_id,id),
  unique(org_id,event_id,discipline_id),
  foreign key(org_id) references core.organizations(id) deferrable initially deferred,
  foreign key(org_id,center_id) references core.centers(org_id,id) deferrable initially deferred,
  foreign key(org_id,center_id,event_id) references core.events(org_id,center_id,id) deferrable initially deferred,
  foreign key(org_id,discipline_id) references core.disciplines(org_id,id) deferrable initially deferred
);
alter table core."event_disciplines" enable row level security;
revoke all on core."event_disciplines" from public, anon, authenticated;
create index event_disciplines_by_tag on core.event_disciplines(org_id,discipline_id,event_id);
create index event_disciplines_center on core.event_disciplines(org_id,center_id,event_id);
comment on table core.event_disciplines is 'Q-D01: labels only, zero/one/many; no role or entitlement grant.';

-- Shared scope filter for future preview/register paths. This does not authorize or reserve.
create function private.event_package_scope_matches(p_org_id uuid,p_event_id uuid,p_product_version_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(
  select 1 from core.events e
  cross join lateral (
   select count(*) n,(array_agg(ed.discipline_id))[1] single_id
   from core.event_disciplines ed where ed.org_id=e.org_id and ed.event_id=e.id
  ) tags
  join core.product_scopes s on s.org_id=e.org_id and s.product_version_id=p_product_version_id
  where e.org_id=p_org_id and e.id=p_event_id
   and 'event'=any(s.usage_targets)
   and s.class_id is null
   and (s.event_id is null or s.event_id=e.id)
   and (
    (s.scope_kind in ('center_discipline','center_all_disciplines') and s.center_id=e.center_id)
    or s.scope_kind in ('organization_discipline','organization_all')
   )
   and (
    s.scope_kind in ('center_all_disciplines','organization_all')
    or (tags.n=1 and s.scope_kind in ('center_discipline','organization_discipline') and s.discipline_id=tags.single_id)
   )
 );
$$;
revoke all on function private.event_package_scope_matches(uuid,uuid,uuid) from public,anon,authenticated;
comment on function private.event_package_scope_matches(uuid,uuid,uuid) is
 'Read-only Q-D01 scope matrix. Caller still enforces live actor, plan, center access, event terms, dates, capacity and atomic available entitlement.';

-- available must come from the authoritative locked pool. No negative-limit argument or fallback.
create function private.require_event_available_credit(p_available bigint)
returns void language plpgsql immutable security invoker set search_path='' as $$
begin
 if p_available is null or p_available<1 then
  raise exception using errcode='P0001',message='ENTITLEMENT_UNAVAILABLE';
 end if;
end;
$$;
revoke all on function private.require_event_available_credit(bigint) from public,anon,authenticated;
comment on function private.require_event_available_credit(bigint) is
 'Positive available-right gate only. Does not compute balances, lock, reserve, charge or create a deficit.';
commit;
