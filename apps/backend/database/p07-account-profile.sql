begin;
-- Account data is global: never borrow an arbitrary tenant for its audit/inbox.
create table private.p07_profiles(account_id uuid primary key references core.accounts(id),display_name text not null);
create table private.p07_account_events(id uuid primary key,account_id uuid not null references core.accounts(id),operation_id uuid not null unique references core.operation_receipts(id),created_at timestamptz not null default clock_timestamp(),diff jsonb not null);
create table private.p07_account_inbox(id uuid primary key,event_id uuid not null unique references private.p07_account_events(id),account_id uuid not null references core.accounts(id),created_at timestamptz not null default clock_timestamp(),kind text not null check(kind='account_profile_updated'));
create index p07_account_inbox_scope on private.p07_account_inbox(account_id,created_at desc,id desc);
alter table private.p07_profiles enable row level security;alter table private.p07_account_events enable row level security;alter table private.p07_account_inbox enable row level security;
revoke all on private.p07_profiles,private.p07_account_events,private.p07_account_inbox from public,anon,authenticated;
grant select,insert,update on private.p07_profiles to service_role;grant select,insert on private.p07_account_events,private.p07_account_inbox to service_role;
create function private.p07_profile(account uuid) returns text language sql stable security invoker set search_path='' as $$select coalesce((select display_name from private.p07_profiles where account_id=account),(select coalesce(u.raw_user_meta_data->>'display_name',u.email) from core.accounts a join auth.users u on u.id=a.auth_user_id where a.id=account))$$;
create function private.p07_profile_inbox(account uuid) returns jsonb language sql stable security invoker set search_path='' as $$select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'created_at',n.created_at) order by n.created_at desc,n.id desc),'[]'::jsonb) from (select * from private.p07_account_inbox where account_id=account order by created_at desc,id desc limit 20) n$$;
create function private.p07_profile_management(r jsonb,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare data jsonb;ver bigint;at timestamptz:=clock_timestamp();
begin
 if r->>'org_id' is not null or r->>'center_id' is not null or r#>>'{selector,operation}' is distinct from 'account_profile_update_v1' then perform private.fail('VALIDATION_FAILED');end if;
 if r?'entity' and r->'entity'<>'null'::jsonb and r->'entity' is distinct from jsonb_build_object('type','accounts','id',account) then perform private.fail('NOT_FOUND');end if;
 select version into ver from core.accounts where id=account;
 data:=jsonb_build_object('operation','account_profile_update_v1','entity',jsonb_build_object('type','accounts','id',account),'exists',true,'state','active','versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','accounts','id',account),'version',ver)),'as_of',at,'current',jsonb_build_object('operation','account_profile_update_v1','values',jsonb_build_object('display_name',private.p07_profile(account))));
 return jsonb_build_object('data',jsonb_build_object('items',jsonb_build_array(data),'next_cursor',null,'as_of',at),'primary_id',account,'subject','accounts');
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;
begin
 old:=' select * into actor from core.accounts where auth_user_id=usr.id for share;';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile account lock anchor mismatch';end if;
 b:=replace(b,old,' if p_operation=''account_profile_update_v1'' then select * into actor from core.accounts where auth_user_id=usr.id for update;else '||old||'end if;');
 old:=$a$ elsif p_operation in ('account_get_v1','organizations_list_v1','account_access_accept_v1') then null;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile permission anchor mismatch';end if;
 b:=replace(b,old,old||E'\n'||' elsif p_operation=''account_profile_update_v1'' then null;');
 old:=$a$elsif perm_code='management.inspect' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile management access anchor mismatch';end if;
 b:=replace(b,old,'elsif perm_code=''management.inspect'' and r->>''operation''=''account_profile_update_v1'' then perform private.p07_profile_management(r,actor.id);'||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile management domain anchor mismatch';end if;
 b:=replace(b,old,'if p_operation=''management_state_get_v1'' and r->>''operation''=''account_profile_update_v1'' then terms:=private.p07_profile_management(r,actor.id);else '||old||'end if;');
 old:=$a$out:=jsonb_build_object('id',actor.id,'state',actor.state,'display_name',coalesce(usr.raw_user_meta_data->>'display_name',usr.email));$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile read anchor mismatch';end if;
 b:=replace(b,old,$a$out:=jsonb_build_object('id',actor.id,'state',actor.state,'display_name',private.p07_profile(actor.id),'profile_notices',private.p07_profile_inbox(actor.id));$a$);
 old:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile domain anchor mismatch';end if;
 b:=replace(b,old,$a$
 when 'account_profile_update_v1' then
  if btrim(r->>'display_name')='' then perform private.fail('VALIDATION_FAILED');end if;
  if actor.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  terms:=jsonb_build_object('before',jsonb_build_object('display_name',private.p07_profile(actor.id)),'after',jsonb_build_object('display_name',r->>'display_name'));
  insert into private.p07_profiles values(actor.id,r->>'display_name') on conflict(account_id) do update set display_name=excluded.display_name;
  update core.accounts set version=version+1 where id=actor.id returning version into version_n;
  insert into private.p07_account_events values(private.new_id(p_ids,11),actor.id,operation_id,clock_timestamp(),terms);
  insert into private.p07_account_inbox(id,event_id,account_id,kind) values(private.new_id(p_ids,12),private.new_id(p_ids,11),actor.id,'account_profile_updated');
  record_id:=actor.id;subject:='accounts';
 -- DOMAIN_CASES$a$);
 execute b;
end$patch$;
revoke all on function private.p07_profile(uuid),private.p07_profile_inbox(uuid),private.p07_profile_management(jsonb,uuid) from public,anon,authenticated;
grant execute on function private.p07_profile(uuid),private.p07_profile_inbox(uuid),private.p07_profile_management(jsonb,uuid) to service_role;
commit;
