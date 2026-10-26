begin;
alter table core.people add column given_name text,add column family_name text;
alter table core.person_contacts add column account_projection_retired boolean not null default false;
-- Global current identity is separate from immutable sales/document snapshots.
create table private.account_identity_names(
 account_id uuid primary key references core.accounts(id),
 given_name text check(given_name is null or (length(btrim(given_name)) between 1 and 100 and given_name !~ '[[:cntrl:]]')),
 unverified_phone text check(unverified_phone is null or unverified_phone ~ '^\+[1-9][0-9]{7,14}$'),
 family_name text check(family_name is null or (length(btrim(family_name)) between 1 and 100 and family_name !~ '[[:cntrl:]]'))
);
create table private.account_contact_projections(
 org_id uuid not null,person_id uuid not null,kind text not null check(kind in('email','phone')),
 account_id uuid not null references core.accounts(id),contact_id uuid not null unique references core.person_contacts(id) on delete cascade,
 primary key(org_id,person_id,kind),foreign key(org_id,person_id) references core.people(org_id,id)
);
alter table private.account_identity_names enable row level security;alter table private.account_contact_projections enable row level security;
revoke all on private.account_identity_names,private.account_contact_projections from public,anon,authenticated,service_role;
grant select,insert,update on private.account_identity_names to service_role;
grant select on private.account_contact_projections to service_role;

create function private.account_identity_view(account uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('given_name',n.given_name,'family_name',n.family_name,
 'email',case when u.email_confirmed_at is not null then nullif(u.email,'') end,
 'phone',case when u.phone_confirmed_at is not null then nullif(u.phone,'') end,
 'unverified_phone',case when u.phone_confirmed_at is not null and ltrim(n.unverified_phone,'+')=ltrim(u.phone,'+') then null else n.unverified_phone end,'email_verified_at',u.email_confirmed_at,'phone_verified_at',u.phone_confirmed_at,
 'pending_email',nullif(to_jsonb(u)->>'email_change',''),'pending_phone',nullif(to_jsonb(u)->>'phone_change',''))
 from core.accounts a join auth.users u on u.id=a.auth_user_id left join private.account_identity_names n on n.account_id=a.id where a.id=account
$$;

create function private.account_identity_sync(account uuid) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare link record;contact record;contact_kind text;wanted text;verified timestamptz;contact_id uuid;identity jsonb;name text;
begin
 -- Fail fast instead of waiting after a trigger caller already owns link/person rows.
 if not pg_try_advisory_xact_lock(hashtextextended('account.identity.'||account,0)) then perform private.fail('TEMPORARY_FAILURE');end if;
 identity:=private.account_identity_view(account);if identity is null or not exists(select 1 from core.accounts a where a.id=account and a.state='active') then return;end if;
 select display_name into name from private.p07_profiles where account_id=account;
 for link in select l.org_id,l.person_id from core.account_links l join core.organizations o on o.id=l.org_id join core.people p on p.org_id=l.org_id and p.id=l.person_id where l.account_id=account and l.state='active' and l.verified_at is not null and o.state='active' and p.state='active' order by l.org_id,l.person_id for share of l loop
  update core.people p set display_name=coalesce(name,p.display_name),given_name=identity->>'given_name',family_name=identity->>'family_name',version=p.version+1 where p.org_id=link.org_id and p.id=link.person_id and (p.display_name is distinct from coalesce(name,p.display_name) or p.given_name is distinct from identity->>'given_name' or p.family_name is distinct from identity->>'family_name');
  foreach contact_kind in array array['email','phone'] loop
   wanted:=identity->>contact_kind;verified:=(identity->>(contact_kind||'_verified_at'))::timestamptz;
   select m.contact_id into contact_id from private.account_contact_projections m where m.org_id=link.org_id and m.person_id=link.person_id and m.kind=contact_kind for update;
   if wanted is null then
    if contact_id is not null then delete from core.person_contacts c where c.id=contact_id;end if;
    continue;
   end if;
   if contact_id is null then
    -- Adopt an exact existing contact; never rewrite unrelated organization contacts.
    select c.id into contact_id from core.person_contacts c where c.org_id=link.org_id and c.person_id=link.person_id and c.kind=contact_kind and c.value=wanted and not exists(select 1 from private.account_contact_projections m where m.contact_id=c.id) order by c.created_at,c.id limit 1 for update;
    if contact_id is null then
     contact_id:=(private.ops_uuid_bank(1))[1];insert into core.person_contacts(id,org_id,person_id,kind,value,verified_at) values(contact_id,link.org_id,link.person_id,contact_kind,wanted,verified);
    end if;
    insert into private.account_contact_projections values(link.org_id,link.person_id,contact_kind,account,contact_id);
   else
    update private.account_contact_projections m set account_id=account where m.org_id=link.org_id and m.person_id=link.person_id and m.kind=contact_kind;
   end if;
   update core.person_contacts c set value=wanted,verified_at=verified,account_projection_retired=false,version=c.version+1 where c.id=contact_id and (c.value is distinct from wanted or c.verified_at is distinct from verified or c.account_projection_retired);
  end loop;
 end loop;
end$$;

create function private.account_identity_refresh() returns trigger language plpgsql security definer set search_path='' as $$
declare account uuid;
begin
 if TG_TABLE_NAME='organizations' then
  if new.state='active' and old.state is distinct from 'active' then for account in select distinct l.account_id from core.account_links l where l.org_id=new.id and l.state='active' and l.verified_at is not null order by l.account_id loop perform private.account_identity_sync(account);end loop;end if;return new;
 elsif TG_TABLE_SCHEMA='auth' then select a.id into account from core.accounts a where a.auth_user_id=new.id;
 elsif TG_TABLE_NAME='account_links' then
  if new.state='active' and new.verified_at is not null and not pg_try_advisory_xact_lock(hashtextextended('account.identity.'||new.account_id,0)) then perform private.fail('TEMPORARY_FAILURE');end if;
  if TG_OP='UPDATE' and (old.org_id,old.person_id,old.account_id) is distinct from (new.org_id,new.person_id,new.account_id) and not pg_try_advisory_xact_lock(hashtextextended('account.identity.'||old.account_id,0)) then perform private.fail('TEMPORARY_FAILURE');end if;
  if TG_OP='UPDATE' and (old.org_id,old.person_id,old.account_id) is distinct from (new.org_id,new.person_id,new.account_id) then update core.person_contacts c set account_projection_retired=true,version=c.version+1 from private.account_contact_projections m where m.org_id=old.org_id and m.person_id=old.person_id and m.account_id=old.account_id and c.id=m.contact_id and not c.account_projection_retired;delete from private.account_contact_projections m where m.org_id=old.org_id and m.person_id=old.person_id and m.account_id=old.account_id;end if;
  if new.state<>'active' or new.verified_at is null then return new;end if;account:=new.account_id;
 else account:=new.account_id;end if;
 if account is not null then perform private.account_identity_sync(account);end if;return new;
end$$;
create trigger account_identity_profile after insert or update on private.p07_profiles for each row execute function private.account_identity_refresh();
create trigger account_identity_link after insert or update on core.account_links for each row execute function private.account_identity_refresh();
create trigger account_identity_org_reopen after update of state on core.organizations for each row execute function private.account_identity_refresh();
create trigger account_identity_native_contact after update of email,email_confirmed_at,phone,phone_confirmed_at on auth.users for each row execute function private.account_identity_refresh();

create function private.account_identity_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare account uuid;name text;identity jsonb;expected text;expected_at timestamptz;
begin
 if TG_TABLE_NAME='people' then
  select a.id,p.display_name into account,name from core.account_links l join core.accounts a on a.id=l.account_id and a.state='active' join private.p07_profiles p on p.account_id=a.id where l.org_id=new.org_id and l.person_id=new.id and l.state='active' and l.verified_at is not null;
  if account is not null and new.state='active' and exists(select 1 from core.organizations o where o.id=new.org_id and o.state='active') then
   identity:=private.account_identity_view(account);
   if new.display_name is distinct from name or new.given_name is distinct from identity->>'given_name' or new.family_name is distinct from identity->>'family_name' then perform private.fail('FORBIDDEN');end if;
  end if;return new;
 end if;
 select m.account_id,private.account_identity_view(m.account_id) into account,identity from private.account_contact_projections m join core.account_links l on l.org_id=m.org_id and l.person_id=m.person_id and l.account_id=m.account_id and l.state='active' and l.verified_at is not null join core.accounts a on a.id=m.account_id and a.state='active' where m.contact_id=old.id;
 if account is not null then
  expected:=identity->>old.kind;expected_at:=(identity->>(old.kind||'_verified_at'))::timestamptz;
  if TG_OP='DELETE' then if expected is not null then perform private.fail('FORBIDDEN');end if;
  elsif expected is not null and (new.value is distinct from expected or new.verified_at is distinct from expected_at or new.kind is distinct from old.kind or new.person_id is distinct from old.person_id or new.org_id is distinct from old.org_id) then perform private.fail('FORBIDDEN');end if;
 end if;
 if TG_OP='DELETE' then return old;else return new;end if;
end$$;
create trigger account_identity_name_guard before update of display_name,given_name,family_name on core.people for each row execute function private.account_identity_guard();
create trigger account_identity_contact_guard before update or delete on core.person_contacts for each row execute function private.account_identity_guard();
revoke all on function private.account_identity_sync(uuid),private.account_identity_refresh(),private.account_identity_guard() from public,anon,authenticated,service_role;
revoke all on function private.account_identity_view(uuid) from public,anon,authenticated;
grant execute on function private.account_identity_view(uuid) to service_role;

do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;
begin
 old:=$a$'profile_notices',private.p07_profile_inbox(actor.id)$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Identity account projection anchor mismatch';end if;
 b:=replace(b,old,old||$a$,'identity',private.account_identity_view(actor.id)$a$);
 old:=$a$  insert into private.p07_profiles values(actor.id,r->>'display_name') on conflict(account_id) do update set display_name=excluded.display_name;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Identity profile write anchor mismatch';end if;
 b:=replace(b,old,$a$
  insert into private.account_identity_names(account_id,given_name,family_name,unverified_phone) values(actor.id,r->>'given_name',r->>'family_name',r->>'unverified_phone') on conflict(account_id) do update set given_name=case when r?'given_name' then excluded.given_name else private.account_identity_names.given_name end,family_name=case when r?'family_name' then excluded.family_name else private.account_identity_names.family_name end,unverified_phone=case when r?'unverified_phone' then excluded.unverified_phone else private.account_identity_names.unverified_phone end;
$a$||old);
 old:=$a$  terms:=jsonb_build_object('before',jsonb_build_object('display_name',private.p07_profile(actor.id)),'after',jsonb_build_object('display_name',r->>'display_name'));$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Identity audit anchor mismatch';end if;
 b:=replace(b,old,$a$  terms:=jsonb_build_object('before',jsonb_build_object('display_name',private.p07_profile(actor.id))||(private.account_identity_view(actor.id)-'email'-'phone'-'email_verified_at'-'phone_verified_at'-'pending_email'-'pending_phone'),'after',jsonb_build_object('display_name',r->>'display_name','given_name',case when r?'given_name' then r->'given_name' else private.account_identity_view(actor.id)->'given_name' end,'family_name',case when r?'family_name' then r->'family_name' else private.account_identity_view(actor.id)->'family_name' end,'unverified_phone',case when r?'unverified_phone' then r->'unverified_phone' else private.account_identity_view(actor.id)->'unverified_phone' end));$a$);
 old:=$a$private.p07_same_person(org,c.person_id,target) and not exists(select 1 from jsonb_array_elements(r#>$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Retired contact replacement delete anchor mismatch';end if;
 b:=replace(b,old,$a$private.p07_same_person(org,c.person_id,target) and not c.account_projection_retired and not exists(select 1 from jsonb_array_elements(r#>$a$);
 old:=$a$private.p07_same_person(org,c.person_id,target) and c.kind=entry->>'kind' and c.value=entry->>'value'$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Retired contact replacement insert anchor mismatch';end if;
 b:=replace(b,old,$a$private.p07_same_person(org,c.person_id,target) and not c.account_projection_retired and c.kind=entry->>'kind' and c.value=entry->>'value'$a$);
 execute b;
 b:=pg_get_functiondef('private.person_projection(uuid,uuid,uuid,boolean,boolean)'::regprocedure);
 old:=$a$'display_name',p.display_name,$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Identity person projection anchor mismatch';end if;
 b:=replace(b,old,old||$a$'given_name',p.given_name,'family_name',p.family_name,$a$);
 old:='from core.person_contacts c where';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Identity alias contact projection anchor mismatch';end if;
 b:=replace(b,old,$a$from (select distinct on (source.kind,source.value) source.* from core.person_contacts source where source.org_id=org and not source.account_projection_retired and private.p07_same_person(org,source.person_id,target) order by source.kind,source.value,source.verified_at desc nulls last,source.created_at,source.id)c where$a$);execute b;
 b:=pg_get_functiondef('private.p07_profile_management(jsonb,uuid)'::regprocedure);
 b:=replace(b,$a$jsonb_build_object('display_name',private.p07_profile(account))$a$,$a$jsonb_build_object('display_name',private.p07_profile(account),'unverified_phone',private.account_identity_view(account)->'unverified_phone','given_name',private.account_identity_view(account)->'given_name','family_name',private.account_identity_view(account)->'family_name')$a$);execute b;
end$patch$;
-- Native Auth owns proofs. These triggers record committed provider changes only.
alter table private.account_security_events drop constraint account_security_events_action_check;
alter table private.account_security_events drop constraint account_security_events_check;
alter table private.account_security_events add constraint account_security_events_action_check check(action in('session_labelled','session_revoked','other_sessions_revoked','totp_enabled','totp_disabled','email_changed','phone_changed','identity_linked','identity_unlinked'));
alter table private.account_security_events add constraint account_security_events_check check((action in('totp_enabled','totp_disabled','email_changed','phone_changed','identity_linked','identity_unlinked'))=(operation_id is null));
create function private.account_native_security_event() returns trigger language plpgsql security definer set search_path='' as $$
declare account uuid;action text;uid uuid;kind text;
begin
 if TG_TABLE_NAME='users' then uid:=new.id;else if TG_OP='DELETE' then uid:=old.user_id;else uid:=new.user_id;end if;end if;
 select a.id into account from core.accounts a where a.auth_user_id=uid and a.state='active';
 if account is null then if TG_OP='DELETE' then return old;else return new;end if;end if;
 if TG_TABLE_NAME='users' then
  foreach kind in array array['email','phone'] loop
   if nullif(to_jsonb(old)->>kind,'') is distinct from nullif(to_jsonb(new)->>kind,'') and to_jsonb(old)->>(kind||'_confirmed_at') is not null and to_jsonb(new)->>(kind||'_confirmed_at') is not null then
    insert into private.account_security_events(id,account_id,action,affected_count) values((private.ops_uuid_bank(1))[1],account,kind||'_changed',1);
   end if;
  end loop;
 else
  -- Native email/phone identity rows may be refreshed as part of contact updates;
  -- the explicit additional login method in this delivery is Google only.
  if (case when TG_OP='DELETE' then old.provider else new.provider end)='google' then
   action:=case when TG_OP='DELETE' then 'identity_unlinked' else 'identity_linked' end;
   insert into private.account_security_events(id,account_id,action,affected_count) values((private.ops_uuid_bank(1))[1],account,action,1);
  end if;
 end if;
 if TG_OP='DELETE' then return old;else return new;end if;
end$$;
create function private.account_identity_unlink_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare account uuid;usable bigint;
begin
 select a.id into account from core.accounts a where a.auth_user_id=old.user_id and a.state='active';
 if account is null then return old;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('account.identity.'||account,0)) then perform private.fail('TEMPORARY_FAILURE');end if;
 -- Do not count TOTP, unconfirmed contacts, unsupported phone login or an
 -- email identity without a password as a surviving login method.
 select count(*) into usable from auth.identities i join auth.users u on u.id=i.user_id
 where i.user_id=old.user_id and i.id<>old.id and (
  (i.provider='google' and i.identity_data->>'email_verified'='true') or
  (i.provider='email' and u.email_confirmed_at is not null and nullif(u.encrypted_password,'') is not null)
 );
 if usable=0 then perform private.fail('FORBIDDEN');end if;
 return old;
end$$;
create trigger account_native_contact_security after update of email,email_confirmed_at,phone,phone_confirmed_at on auth.users for each row execute function private.account_native_security_event();
create trigger account_native_identity_security after insert or delete on auth.identities for each row execute function private.account_native_security_event();
create trigger account_identity_unlink_guard before delete on auth.identities for each row execute function private.account_identity_unlink_guard();
revoke all on function private.account_native_security_event(),private.account_identity_unlink_guard() from public,anon,authenticated,service_role;

create table private.account_google_link_intents(account_id uuid primary key references core.accounts(id),session_id uuid not null references auth.sessions(id) on delete cascade,expires_at timestamptz not null,completed boolean not null default false,provider_subject text not null);
alter table private.account_google_link_intents enable row level security;
revoke all on private.account_google_link_intents from public,anon,authenticated,service_role;
create function private.account_google_link_prepare(r jsonb,auth_id uuid,session uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare checked jsonb;account uuid;max_age int;until_at timestamptz;code text;trace uuid:=private.new_id(ids,1);
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;
 checked:=private.execute_operation('account_get_v1',r-'google_id_token'-'reauth',auth_id,session,ids,aux);if checked->>'ok' is distinct from 'true' then return checked;end if;account:=(checked#>>'{data,id}')::uuid;
 perform private.p07_lifecycle_reauth(account,aux);
 if aux->>'reauth_session_id' is distinct from session::text then perform private.fail('AUTH_REQUIRED');end if;
 select reauth_max_age_seconds into max_age from private.p07_lifecycle_config where singleton;
 select least(clock_timestamp()+interval '10 seconds',s.created_at+make_interval(secs=>max_age)) into until_at from auth.sessions s where s.id=session and s.user_id=auth_id;
 if until_at is null or until_at<=clock_timestamp() then perform private.fail('AUTH_REQUIRED');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('account.identity.'||account,0)) then perform private.fail('TEMPORARY_FAILURE');end if;
 if aux->>'google_subject' is null or length(aux->>'google_subject') not between 1 and 255 then perform private.fail('VALIDATION_FAILED');end if;
 insert into private.account_google_link_intents values(account,session,until_at,false,aux->>'google_subject') on conflict(account_id) do update set session_id=excluded.session_id,expires_at=excluded.expires_at,completed=false,provider_subject=excluded.provider_subject;
 return jsonb_build_object('_internal_google_link',true);
exception when others then
 code:=case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',code='TEMPORARY_FAILURE','trace_id',trace));
end$$;
create function private.account_google_link_fence() returns trigger language plpgsql security definer set search_path='' as $$
declare account uuid;intent private.account_google_link_intents;max_age int;
begin
 if new.provider<>'google' then return new;end if;
 select a.id into account from core.accounts a where a.auth_user_id=new.user_id;
 -- New native signup has no platform account yet; it is not account linking.
 if account is null then if not exists(select 1 from auth.identities i where i.user_id=new.user_id) then return new;else perform private.fail('AUTH_REQUIRED');end if;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('account.identity.'||account,0)) then perform private.fail('TEMPORARY_FAILURE');end if;
 select reauth_max_age_seconds into max_age from private.p07_lifecycle_config where singleton;
 select i.* into intent from private.account_google_link_intents i join core.accounts a on a.id=i.account_id and a.state='active' where i.account_id=account and i.provider_subject=new.provider_id and not i.completed and i.expires_at>clock_timestamp() for update of i;
 if not found or max_age is null or not exists(select 1 from auth.users u where u.id=new.user_id and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp())) or not exists(select 1 from auth.sessions s where s.id=intent.session_id and s.user_id=new.user_id and s.created_at>=clock_timestamp()-make_interval(secs=>max_age) and s.created_at<=clock_timestamp() and (s.not_after is null or s.not_after>clock_timestamp()) and (not exists(select 1 from auth.mfa_factors f where f.user_id=new.user_id and f.status::text='verified') or to_jsonb(s)->>'aal'='aal2')) then perform private.fail('AUTH_REQUIRED');end if;
 update private.account_google_link_intents set completed=true where account_id=account;
 return new;
end$$;
create trigger account_google_link_fence before insert on auth.identities for each row execute function private.account_google_link_fence();
revoke all on function private.account_google_link_prepare(jsonb,uuid,uuid,uuid[],jsonb),private.account_google_link_fence() from public,anon,authenticated,service_role;
grant execute on function private.account_google_link_prepare(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_google_link_prepare_v1','account.self','exempt',array[]::text[]);
create function api_v1.account_google_link_prepare_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.account_google_link_prepare(p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.account_google_link_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_google_link_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;

-- Freeze the initial native display name exactly once; later raw metadata/email
-- updates must not create a second, unsynchronized profile read source.
insert into private.p07_profiles(account_id,display_name)
 select a.id,coalesce(u.raw_user_meta_data->>'display_name',u.email,u.phone,a.id::text)
 from core.accounts a join auth.users u on u.id=a.auth_user_id
 on conflict(account_id) do nothing;
create or replace function private.p07_profile(account uuid) returns text language sql stable security invoker set search_path='' as $$
 select display_name from private.p07_profiles where account_id=account
$$;
create function private.account_identity_initialize() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.p07_profiles(account_id,display_name)
  select new.id,coalesce(u.raw_user_meta_data->>'display_name',u.email,u.phone,new.id::text)
  from auth.users u where u.id=new.auth_user_id
  on conflict(account_id) do nothing;
 return new;
end$$;
create trigger account_identity_initialize after insert on core.accounts for each row execute function private.account_identity_initialize();
revoke all on function private.account_identity_initialize() from public,anon,authenticated,service_role;
-- Existing active safe links acquire only confirmed current contacts.
do $$declare account uuid;begin for account in select id from core.accounts where state='active' order by id loop perform private.account_identity_sync(account);end loop;end$$;
commit;
