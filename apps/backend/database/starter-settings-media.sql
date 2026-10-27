begin;
-- Bounded private image bytes, never public Storage or an arbitrary remote URL.
-- Removing a pointer revokes new reads; physical retention is the OPS lifecycle.
create table private.settings_media_assets(
 id uuid primary key,scope_key text not null,mime text not null check(mime in ('image/png','image/jpeg','image/webp')),
 body bytea not null check(octet_length(body) between 1 and 1048576),checksum text not null check(checksum~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp()
);
create table private.settings_media_current(scope_key text primary key,asset_id uuid references private.settings_media_assets(id));
create table private.settings_media_history(
 operation_id uuid primary key references core.operation_receipts(id),scope_key text not null,
 before_asset_id uuid references private.settings_media_assets(id),after_asset_id uuid references private.settings_media_assets(id)
);
alter table private.settings_media_assets enable row level security;
alter table private.settings_media_current enable row level security;
alter table private.settings_media_history enable row level security;
revoke all on private.settings_media_assets,private.settings_media_current,private.settings_media_history from public,anon,authenticated;
grant select,insert on private.settings_media_assets,private.settings_media_history to service_role;
grant select,insert,update on private.settings_media_current to service_role;
create trigger settings_media_assets_immutable before update or delete on private.settings_media_assets for each row execute function private.append_only();
create trigger settings_media_history_immutable before update or delete on private.settings_media_history for each row execute function private.append_only();
create function private.settings_media_asset(skey text) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',a.id,'mime',a.mime,'bytes',octet_length(a.body),'checksum',a.checksum)
 from private.settings_media_current c join private.settings_media_assets a on a.id=c.asset_id and a.scope_key=c.scope_key where c.scope_key=$1
$$;
create function private.settings_media_change(operation uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('before_asset_id',before_asset_id,'after_asset_id',after_asset_id) from private.settings_media_history where operation_id=$1
$$;
create function private.settings_media_set(skey text,image jsonb,operation uuid,ids uuid[],aux jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare asset uuid;previous uuid;bytes bytea;
begin
 select asset_id into previous from private.settings_media_current where scope_key=skey;
 if image is distinct from 'null'::jsonb then
  if image is null or aux->>'image_verified' is distinct from 'true' or aux->>'image_mime' is distinct from image->>'mime' or aux->>'image_checksum' is distinct from image->>'checksum' then perform private.fail('VALIDATION_FAILED');end if;
  bytes:=decode(image->>'data_base64','base64');
  if octet_length(bytes) not between 1 and 1048576 or octet_length(bytes) is distinct from (aux->>'image_bytes')::int or encode(extensions.digest(bytes,'sha256'),'hex') is distinct from image->>'checksum' then perform private.fail('VALIDATION_FAILED');end if;
  asset:=private.new_id(ids,30);
  insert into private.settings_media_assets(id,scope_key,mime,body,checksum) values(asset,skey,image->>'mime',bytes,image->>'checksum');
 end if;
 insert into private.settings_media_current(scope_key,asset_id) values(skey,asset) on conflict(scope_key) do update set asset_id=excluded.asset_id;
 insert into private.settings_media_history(operation_id,scope_key,before_asset_id,after_asset_id) values(operation,skey,previous,asset);
end$$;
create function private.settings_media_access(r jsonb,org uuid,account uuid,person uuid) returns text language plpgsql volatile security invoker set search_path='' as $$
declare skey text;target uuid;item jsonb;
begin
 if r->>'scope'='user' then
  if org is not null then perform private.fail('VALIDATION_FAILED');end if;skey:='user:'||account;
 elsif r->>'scope'='organization' then
  if org is null or person is null then perform private.fail('NOT_FOUND');end if;skey:='organization:'||org;
 elsif r->>'scope'='lesson_participant' then
  select x into item from jsonb_array_elements(private.session_shared_participants(org,(r->>'session_id')::uuid,person)) x where x->>'person_id'=((r->>'person_id')::uuid)::text and x#>>'{photo,id}'=((r->>'asset_id')::uuid)::text;
  if item is null then perform private.fail('NOT_FOUND');end if;
  select l.account_id into target from core.account_links l join core.accounts a on a.id=l.account_id and a.state='active' where l.org_id=org and l.person_id=(r->>'person_id')::uuid and l.state='active' and l.verified_at is not null;
  if target is null then perform private.fail('NOT_FOUND');end if;skey:='user:'||target;
 else perform private.fail('VALIDATION_FAILED');end if;
 if (private.settings_media_asset(skey)->>'id')::uuid is distinct from (r->>'asset_id')::uuid then perform private.fail('NOT_FOUND');end if;
 return skey;
end$$;
create function private.settings_media_get(r jsonb,org uuid,account uuid,person uuid) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare skey text:=private.settings_media_access(r,org,account,person);result jsonb;
begin
 select jsonb_build_object('asset',private.settings_media_asset(skey),'data_base64',replace(encode(a.body,'base64'),E'\n','')) into result from private.settings_media_current c join private.settings_media_assets a on a.id=c.asset_id and a.scope_key=c.scope_key where c.scope_key=skey;
 if result is null then perform private.fail('NOT_FOUND');end if;return result;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$if op='settings_update_v1' then patch:=r->'patch';perform private.frontend_settings_patch(r,patch,person);local:=local||patch;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media settings write anchor drift';end if;
 b:=replace(b,a,$a$if op='settings_update_v1' then
  patch:=r->'patch';
  if patch<>'{}'::jsonb then perform private.frontend_settings_patch(r,patch,person);
  elsif not (r?'logo_image') then perform private.fail('VALIDATION_FAILED');end if;
  if r?'logo_image' then
   if r->>'scope'<>'organization' then perform private.fail('VALIDATION_FAILED');end if;
   perform private.settings_media_set(skey,r->'logo_image',operation,ids,aux);
  end if;
  local:=local||patch;$a$);
 a:=$a$'reason',h.reason)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media settings history anchor drift';end if;
 b:=replace(b,a,$a$'reason',h.reason,'media_change',private.settings_media_change(h.operation_id))$a$);
 a:='Only system branding is approved; color/font assets, logos and external providers are not implemented by this API.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media catalog limitation anchor drift';end if;
 execute replace(b,a,'Only system color/font packages are approved. Logo images use logo_image and authenticated media_get_v1. External providers remain unavailable.');
 b:=pg_get_functiondef('private.frontend_settings_view(jsonb,uuid,uuid)'::regprocedure);
 a:=$a$else '{}'::jsonb end;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media settings view anchor drift';end if;
 execute replace(b,a,$a$else '{}'::jsonb end||case when r->>'scope'='organization' then jsonb_build_object('logo',private.settings_media_asset('organization:'||org)) else '{}'::jsonb end;$a$);
 b:=pg_get_functiondef('private.session_shared_participants(uuid,uuid,uuid)'::regprocedure);
 a:=$a$  ||case when coalesce((v.values->>'email_visible')$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media peer projection anchor drift';end if;
 execute replace(b,a,$a$  ||case when coalesce((v.values->>'photo_visible')::bool,false) and private.settings_media_asset('user:'||m.account_id) is not null then jsonb_build_object('photo',private.settings_media_asset('user:'||m.account_id)) else '{}'::jsonb end
$a$||a);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media read permission anchor drift';end if;
 b:=replace(b,a,a||E'\n'||$a$ if p_operation='media_get_v1' then perform private.settings_media_access(r,org,actor.id,person);end if;$a$);
 a:=' if perm_code=''settings.access'' then null;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media permission branch anchor drift';end if;
 b:=replace(b,a,' if perm_code=''media.read'' then null;elsif perm_code=''settings.access'' then null;');
 a:=$a$  insert into private.p07_profiles values(actor.id,r->>'display_name') on conflict(account_id) do update set display_name=excluded.display_name;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media own photo write anchor drift';end if;
 b:=replace(b,a,a||E'\n'||$a$  if r?'photo' then perform private.settings_media_set('user:'||actor.id,r->'photo',operation_id,p_ids,p_aux);end if;$a$);
 a:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media read dispatch anchor drift';end if;
 b:=replace(b,a,$a$ when 'media_get_v1' then out:=private.settings_media_get(r,org,actor.id,person);
 -- DOMAIN_CASES$a$);
 a:=' if out is null then out:=jsonb_build_object(''operation_id''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media view consumer anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation='account_get_v1' then out:=out||jsonb_build_object('photo',private.settings_media_asset('user:'||actor.id));
 elsif p_operation='organization_get_v1' then out:=out||jsonb_build_object('logo',private.settings_media_asset('organization:'||org));
 elsif p_operation='centers_list_v1' then
  out:=jsonb_set(out,'{items}',coalesce((select jsonb_agg(x||jsonb_build_object('organization_logo',private.settings_media_asset('organization:'||org)) order by n) from jsonb_array_elements(out->'items') with ordinality t(x,n)),'[]'::jsonb));
 end if;
$a$||a);
 execute b;
 b:=pg_get_functiondef('private.p06_scrub(jsonb)'::regprocedure);a:='''authorization'')';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media context scrub anchor drift';end if;
 execute replace(b,a,'''authorization'',''logo_image'',''photo'')');
 b:=pg_get_functiondef('private.p07_profile_management(jsonb,uuid)'::regprocedure);
 a:=$a$'display_name',private.p07_profile(account)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Media profile management read anchor drift';end if;
 execute replace(b,a,a||$a$,'photo',private.settings_media_asset('user:'||account)$a$);
end$patch$;
revoke all on function private.settings_media_asset(text),private.settings_media_change(uuid),private.settings_media_set(text,jsonb,uuid,uuid[],jsonb),private.settings_media_access(jsonb,uuid,uuid,uuid),private.settings_media_get(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.settings_media_asset(text),private.settings_media_change(uuid),private.settings_media_set(text,jsonb,uuid,uuid[],jsonb),private.settings_media_access(jsonb,uuid,uuid,uuid),private.settings_media_get(jsonb,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
