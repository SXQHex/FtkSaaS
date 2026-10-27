begin;
-- UUID text is case-insensitive at the wire. All settings, locks and consumers
-- must address one document; a differently cased opt-out cannot fork consent.
lock table private.frontend_settings in share row exclusive mode;
create table private.settings_legacy_scope_snapshots(
 scope_key text primary key,scope text not null,values jsonb not null,version bigint not null,
 captured_at timestamptz not null default clock_timestamp()
);
alter table private.settings_legacy_scope_snapshots enable row level security;
revoke all on private.settings_legacy_scope_snapshots from public,anon,authenticated,service_role;
insert into private.settings_legacy_scope_snapshots(scope_key,scope,values,version)
 select scope_key,scope,values,version from private.frontend_settings where lower(scope_key) in
 (select lower(scope_key) from private.frontend_settings where scope_key<>lower(scope_key));
grant select on private.settings_legacy_scope_snapshots to service_role;
create trigger settings_legacy_scope_snapshots_immutable before update or delete on private.settings_legacy_scope_snapshots for each row execute function private.append_only();
do $canonical$
declare group_key text;doc record;field record;merged jsonb;version_n bigint;scope_n text;enabled bool;
begin
 for group_key in select distinct lower(scope_key) from private.frontend_settings where scope_key<>lower(scope_key) loop
  merged:='{}';version_n:=0;
  for doc in select * from private.frontend_settings where lower(scope_key)=group_key order by scope_key loop
   scope_n:=doc.scope;version_n:=greatest(version_n,doc.version);
   for field in select * from jsonb_each(doc.values) loop
    if merged?field.key and merged->field.key is distinct from field.value then
     if field.key in ('profile_visible','photo_visible','email_visible','phone_visible','history_recommendations','marketing_in_app','in_app_marketing','in_app_reminders','ad_personalization','ad_measurement','optional_analytics') then
      merged:=jsonb_set(merged,array[field.key],to_jsonb((merged->>field.key)::bool and (field.value#>>'{}')::bool));
     else
      -- No arbitrary winner for conflicting non-privacy values. Preserve all
      -- documents and stop the transaction for an explicit scoped resolution.
      raise exception 'AMBIGUOUS_LEGACY_SETTINGS_SCOPE';
     end if;
    else merged:=merged||jsonb_build_object(field.key,field.value);end if;
   end loop;
  end loop;
  -- A missing field in a fork still had its scope default. If any old view
  -- showed a privacy choice as closed, merging must not silently open it.
  for field in select * from jsonb_each(private.frontend_settings_defaults(scope_n)) where key in ('profile_visible','photo_visible','email_visible','phone_visible','history_recommendations','marketing_in_app','in_app_marketing','in_app_reminders','ad_personalization','ad_measurement','optional_analytics') loop
   select bool_and(coalesce((values->>field.key)::bool,(field.value#>>'{}')::bool)) into enabled from private.frontend_settings where lower(scope_key)=group_key;
   merged:=jsonb_set(merged,array[field.key],to_jsonb(enabled));
  end loop;
  delete from private.frontend_settings where lower(scope_key)=group_key and scope_key<>group_key;
  insert into private.frontend_settings(scope_key,scope,values,version) values(group_key,scope_n,merged,version_n+1)
  on conflict(scope_key) do update set values=excluded.values,version=excluded.version;
  update private.frontend_settings_previews set applied=true where lower(scope_key)=group_key and not applied;
 end loop;
end$canonical$;
create or replace function private.frontend_settings_key(r jsonb,account uuid,person uuid) returns text language sql immutable security invoker set search_path='' as $$
 select case r->>'scope' when 'user' then 'user:'||account when 'member' then 'member:'||(r->>'org_id')::uuid||':'||account when 'center' then 'center:'||(r->>'org_id')::uuid||':'||(r->>'center_id')::uuid when 'organization' then 'organization:'||(r->>'org_id')::uuid when 'platform' then 'platform' end
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='where scope_key=skey and at<=history_asof';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Canonical settings history anchor drift';end if;
 execute replace(b,a,'where lower(scope_key)=skey and at<=history_asof');
end$patch$;
revoke all on function private.frontend_settings_key(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function private.frontend_settings_key(jsonb,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
