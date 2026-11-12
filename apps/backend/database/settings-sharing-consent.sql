begin;
-- The notice is supplied explicitly by the organization. No legal text or
-- legacy consent is fabricated. Evidence shares the existing immutable history.
alter table private.frontend_settings add column sharing_notice_epochs jsonb not null default '{}' check(jsonb_typeof(sharing_notice_epochs)='object');
alter table private.frontend_settings_history add column sharing_consents jsonb not null default '[]' check(jsonb_typeof(sharing_consents)='array');

create function private.sharing_notice_valid(v jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
begin
 if jsonb_typeof(v) is distinct from 'object' or not v ?& array['field','content']
  or exists(select 1 from jsonb_object_keys(v) k where k not in ('field','content'))
  or coalesce(v->>'field','') not in ('profile_visible','photo_visible','email_visible','phone_visible') then return false;end if;
 perform private.digital_document_hash(v->'content');return true;
exception when sqlstate 'P0001' then
 if sqlerrm='VALIDATION_FAILED' then return false;end if;raise;
end$$;

create function private.sharing_notice_views(org uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('field',n->'field','content',n->'content',
 'notice_hash',private.digital_document_hash(n->'content'),'notice_revision',(s.sharing_notice_epochs->>(n->>'field'))::bigint) order by n->>'field'),'[]'::jsonb)
 from private.frontend_settings s cross join lateral jsonb_array_elements(coalesce(s.values->'sharing_notices','[]')) n
 where s.scope_key='organization:'||$1 and (s.sharing_notice_epochs->>(n->>'field'))::bigint>0
$$;
create function private.sharing_latest_consent(org uuid,account uuid,field text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select e from private.frontend_settings_history h cross join lateral jsonb_array_elements(h.sharing_consents) e
 where h.scope_key='member:'||$1||':'||$2 and e->>'field'=$3 order by h.at desc,h.id desc limit 1
$$;
create function private.sharing_consent_valid(org uuid,account uuid,person uuid,field text) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((e->>'accepted')::boolean and e->>'person_id'=$3::text and exists(
  select 1 from core.account_links l join core.accounts a on a.id=l.account_id
  where l.org_id=$1 and l.account_id=$2 and l.person_id=$3 and l.state='active' and l.verified_at is not null and a.state='active'
   and l.id=(e->>'account_link_id')::uuid and l.verified_at=(e->>'link_verified_at')::timestamptz)
 and exists(select 1 from jsonb_array_elements(private.sharing_notice_views($1)) n
  where n->>'field'=$4 and n->>'notice_hash'=e->>'notice_hash' and n->'notice_revision'=e->'notice_revision' and n->'content'=e->'content'),false)
 from (select private.sharing_latest_consent($1,$2,$4) e) x
$$;
create function private.sharing_allowed(org uuid,center uuid,account uuid,person uuid,field text) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((s.values->>$5)::boolean,false) and private.sharing_consent_valid($1,$3,$4,$5)
 and not (coalesce((o.values->>'allow_center_sharing_restrictions')::boolean,false)
  and coalesce(c.values->'sharing_restrictions','[]') ? $5)
 from (select 1) x left join private.frontend_settings s on s.scope_key='member:'||$1||':'||$3
 left join private.frontend_settings o on o.scope_key='organization:'||$1
 left join private.frontend_settings c on c.scope_key='center:'||$1||':'||$2
$$;

create function private.sharing_settings_access(r jsonb,account uuid,person uuid) returns void
language plpgsql volatile security invoker set search_path='' as $$
declare org uuid:=(r->>'org_id')::uuid;field text;provided jsonb;notice jsonb;link core.account_links;
begin
 if r?'sharing_consents' and (r->>'scope'<>'member' or r?'history_source') then perform private.fail('VALIDATION_FAILED');end if;
 -- Notice publishing and affirmative acceptance serialize before the ordinary
 -- scope lock. Withdrawal never needs the current notice or its publication gate.
 if org is not null and ((r->>'scope'='organization' and (r#>'{patch,sharing_notices}' is not null or r#>'{history_source,fields}' ? 'sharing_notices' or r?'preview'))
  or (r->>'scope'='center' and (r#>'{patch,sharing_restrictions}' is not null or r#>'{history_source,fields}' ? 'sharing_restrictions' or r?'preview'))
  or (r->>'scope'='member' and exists(select 1 from jsonb_each(coalesce(r->'patch','{}')) p
   where p.key in ('profile_visible','photo_visible','email_visible','phone_visible') and p.value='true')))
 then perform pg_advisory_xact_lock(hashtextextended('frontend.sharing.'||org,0));end if;
 if r->>'scope'<>'member' then return;end if;
 if r?'sharing_consents' then
  if jsonb_typeof(r->'sharing_consents') is distinct from 'array' or jsonb_array_length(r->'sharing_consents')>4
   or exists(select 1 from jsonb_array_elements(r->'sharing_consents') e group by e->>'field' having count(*)>1)
   or exists(select 1 from jsonb_array_elements(r->'sharing_consents') e where jsonb_typeof(e) is distinct from 'object'
    or not e ?& array['field','notice_hash','notice_revision'] or exists(select 1 from jsonb_object_keys(e) k where k not in ('field','notice_hash','notice_revision'))
    or coalesce(e->>'field','') not in ('profile_visible','photo_visible','email_visible','phone_visible')
    or coalesce(r->'patch'->(e->>'field'),'null')<>'true') then perform private.fail('VALIDATION_FAILED');end if;
 end if;
 for field in select p.key from jsonb_each(coalesce(r->'patch','{}')) p
  where p.key in ('profile_visible','photo_visible','email_visible','phone_visible') and p.value='true' loop
  select n into notice from jsonb_array_elements(private.sharing_notice_views(org)) n where n->>'field'=field;
  if notice is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  select e into provided from jsonb_array_elements(coalesce(r->'sharing_consents','[]')) e where e->>'field'=field;
  if provided is null then perform private.fail('VALIDATION_FAILED');end if;
  if provided->>'notice_hash' is distinct from notice->>'notice_hash' or provided->'notice_revision' is distinct from notice->'notice_revision' then perform private.fail('VERSION_CONFLICT');end if;
  select * into link from core.account_links l where l.org_id=org and l.account_id=account and l.person_id=person and l.state='active' and l.verified_at is not null;
  if not found then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
 end loop;
end$$;

create function private.sharing_notice_patch(r jsonb,patch jsonb) returns void
language plpgsql stable security invoker set search_path='' as $$
declare n jsonb;
begin
 if patch?'sharing_notices' then
  if r->>'scope'<>'organization' or jsonb_typeof(patch->'sharing_notices') is distinct from 'array' or jsonb_array_length(patch->'sharing_notices')>4
   or exists(select 1 from jsonb_array_elements(patch->'sharing_notices') e group by e->>'field' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
  for n in select * from jsonb_array_elements(patch->'sharing_notices') loop
   if jsonb_typeof(n) is distinct from 'object' or not n ?& array['field','content']
    or exists(select 1 from jsonb_object_keys(n) k where k not in ('field','content'))
    or coalesce(n->>'field','') not in ('profile_visible','photo_visible','email_visible','phone_visible') then perform private.fail('VALIDATION_FAILED');end if;
   perform private.digital_document_hash(n->'content');
  end loop;
 end if;
 if patch?'sharing_restrictions' and (r->>'scope'<>'center' or jsonb_typeof(patch->'sharing_restrictions') is distinct from 'array'
  or jsonb_array_length(patch->'sharing_restrictions')>4 or exists(select 1 from jsonb_array_elements_text(patch->'sharing_restrictions') f
   where f not in ('profile_visible','photo_visible','email_visible','phone_visible'))
  or (select count(*)<>count(distinct f) from jsonb_array_elements(patch->'sharing_restrictions') f)) then perform private.fail('VALIDATION_FAILED');end if;
end$$;
create function private.sharing_notice_revision(r jsonb,before_values jsonb,after_values jsonb) returns void
language plpgsql volatile security invoker set search_path='' as $$
declare field text;previous jsonb;current_notice jsonb;epochs jsonb;
begin
 if r->>'scope'<>'organization' then return;end if;
 select sharing_notice_epochs into epochs from private.frontend_settings where scope_key='organization:'||(r->>'org_id')::uuid;
 foreach field in array array['profile_visible','photo_visible','email_visible','phone_visible'] loop
  select n into previous from jsonb_array_elements(coalesce(before_values->'sharing_notices','[]')) n where n->>'field'=field;
  select n into current_notice from jsonb_array_elements(coalesce(after_values->'sharing_notices','[]')) n where n->>'field'=field;
  if previous is distinct from current_notice then epochs:=jsonb_set(epochs,array[field],to_jsonb(coalesce((epochs->>field)::bigint,0)+1));end if;
 end loop;
 update private.frontend_settings set sharing_notice_epochs=epochs where scope_key='organization:'||(r->>'org_id')::uuid;
end$$;
create function private.sharing_evidence(r jsonb,account uuid,person uuid,before_values jsonb,after_values jsonb) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare field text;notice jsonb;prior jsonb;link core.account_links;accepted boolean;result jsonb:='[]';
begin
 if r->>'scope'<>'member' then return result;end if;
 select * into link from core.account_links l where l.org_id=(r->>'org_id')::uuid and l.account_id=account and l.person_id=person and l.state='active' and l.verified_at is not null;
 foreach field in array array['profile_visible','photo_visible','email_visible','phone_visible'] loop
  if not coalesce(r->'patch' ? field,false) and before_values->field is not distinct from after_values->field then continue;end if;
  accepted:=coalesce((after_values->>field)::boolean,false);
  if accepted then
   -- History/reset cannot generate a new positive decision from an old snapshot.
   if not coalesce(r->'patch' ? field,false) then perform private.fail('VALIDATION_FAILED');end if;
   select n into notice from jsonb_array_elements(private.sharing_notice_views((r->>'org_id')::uuid)) n where n->>'field'=field;
   if notice is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  else
   prior:=private.sharing_latest_consent((r->>'org_id')::uuid,account,field);
   notice:=jsonb_build_object('content',prior->'content','notice_hash',prior->'notice_hash','notice_revision',prior->'notice_revision');
  end if;
  if link.id is null then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
  result:=result||jsonb_build_array(jsonb_build_object('field',field,'purpose','participant_'||replace(field,'_visible',''),'accepted',accepted,'org_id',(r->>'org_id')::uuid,'person_id',person,'account_link_id',link.id,
   'link_verified_at',link.verified_at,'audience','confirmed_participants','channel','in_app','occurred_at',clock_timestamp(),
   'content',notice->'content','notice_hash',notice->'notice_hash','notice_revision',notice->'notice_revision'));
 end loop;return result;
end$$;

do $patch$
declare b text;a text;field text;
begin
 b:=pg_get_functiondef('private.frontend_setting_valid(jsonb,jsonb)'::regprocedure);
 a:=' if s->>''$ref''=''#/$defs/FtkUuid'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Closed sharing schema reference drift';end if;
 execute replace(b,a,$a$ if s->>'$ref'='#/$defs/SharingNotice' then return private.sharing_notice_valid(v);end if;
 if s->>'$ref'='#/$defs/SharingField' then return jsonb_typeof(v)='string' and v#>>'{}' in ('profile_visible','photo_visible','email_visible','phone_visible');end if;
$a$||a);
 b:=pg_get_functiondef('private.frontend_settings_access(jsonb,uuid,uuid,boolean)'::regprocedure);
 a:=' -- Same lock serializes absent-row creation, writes, reset preview and receipt replay.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing acceptance lock anchor drift';end if;
 execute replace(b,a,' perform private.sharing_settings_access(r,account,person);'||E'\n'||a);
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);
 a:='begin';
 if strpos(b,a)=0 then raise exception 'Sharing patch validation anchor drift';end if;
 b:=overlay(b placing 'begin perform private.sharing_notice_patch(r,patch);' from strpos(b,a) for length(a));execute b;
 b:=pg_get_functiondef('private.frontend_settings_field_access(text,jsonb,uuid,uuid)'::regprocedure);
 a:='begin';
 if strpos(b,a)=0 then raise exception 'Sharing restriction authority anchor drift';end if;
 b:=overlay(b placing $a$begin
 if scope='center' and keys ? 'sharing_restrictions' and not coalesce((select (values->>'allow_center_sharing_restrictions')::boolean from private.frontend_settings where scope_key='organization:'||org),false) then perform private.fail('FORBIDDEN');end if;
$a$ from strpos(b,a) for length(a));execute b;
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' insert into private.frontend_settings_history(id,scope_key,actor_account_id,before_values,after_values,reason,operation_id)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing immutable history anchor drift';end if;
 b:=replace(b,a,' perform private.sharing_notice_revision(r,before,after);'||E'\n'||a);
 a:='reason,operation_id) values(private.new_id(ids,11),skey,account,before,after,coalesce(r->>''reason'',''''),operation)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing evidence insertion drift';end if;
 b:=replace(b,a,'reason,operation_id,sharing_consents) values(private.new_id(ids,11),skey,account,before,after,coalesce(r->>''reason'',''''),operation,private.sharing_evidence(r,account,person,before,after))');
 a:='''media_change'',private.settings_media_change(h.operation_id))';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing evidence projection drift';end if;
 b:=replace(b,a,a||'||case when h.sharing_consents<>''[]'' then jsonb_build_object(''sharing_consents'',h.sharing_consents) else ''{}''::jsonb end');
 a:='''catalog_version'',21';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing catalogue version drift';end if;
 execute replace(b,a,'''catalog_version'',22');
 b:=pg_get_functiondef('private.frontend_settings_view(jsonb,uuid,uuid)'::regprocedure);
 a:='''as_of'',clock_timestamp())';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing member view drift';end if;
 execute replace(b,a,a||$a$||case when r->>'scope'='member' then jsonb_build_object('sharing_notices',private.sharing_notice_views(org),
 'sharing_approved_fields',coalesce((select jsonb_agg(f order by f) from unnest(array['profile_visible','photo_visible','email_visible','phone_visible']) f
 where coalesce((values->>f)::boolean,false) and private.sharing_consent_valid(org,account,person,f)),'[]'::jsonb)) else '{}'::jsonb end$a$);
 b:=pg_get_functiondef('private.session_shared_participants(uuid,uuid,uuid)'::regprocedure);
 foreach field in array array['profile_visible','photo_visible','email_visible','phone_visible'] loop
  a:='coalesce((v.values->>'''||field||''')::bool,false)';
  if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing peer field anchor drift: %',field;end if;
  b:=replace(b,a,'private.sharing_allowed($1,(select center_id from core.sessions where org_id=$1 and id=$2),m.account_id,m.id,'''||field||''')');
 end loop;execute b;
end$patch$;
revoke all on function private.sharing_notice_valid(jsonb) from public,anon,authenticated;
grant execute on function private.sharing_notice_valid(jsonb) to service_role;
revoke all on function private.sharing_notice_views(uuid),private.sharing_latest_consent(uuid,uuid,text),private.sharing_consent_valid(uuid,uuid,uuid,text),private.sharing_allowed(uuid,uuid,uuid,uuid,text),private.sharing_settings_access(jsonb,uuid,uuid),private.sharing_notice_patch(jsonb,jsonb),private.sharing_notice_revision(jsonb,jsonb,jsonb),private.sharing_evidence(jsonb,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.sharing_notice_views(uuid),private.sharing_latest_consent(uuid,uuid,text),private.sharing_consent_valid(uuid,uuid,uuid,text),private.sharing_allowed(uuid,uuid,uuid,uuid,text),private.sharing_settings_access(jsonb,uuid,uuid),private.sharing_notice_patch(jsonb,jsonb),private.sharing_notice_revision(jsonb,jsonb,jsonb),private.sharing_evidence(jsonb,uuid,uuid,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
