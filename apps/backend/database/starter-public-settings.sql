begin;
-- Public descriptions are a closed projection, never the internal settings document.
create function private.settings_public_profile(org uuid,center uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare common jsonb;v jsonb;selected jsonb;result jsonb:='{}';label text;zone text;image jsonb;
begin
 if org is null or private.access_mode(org) not in ('normal','grace') then return null;end if;
 begin perform private.require_feature(org,'F25');exception when SQLSTATE 'P0001' then if SQLERRM='PLAN_FEATURE_UNAVAILABLE' then return null;else raise;end if;end;
 select values into common from private.frontend_settings where scope_key='organization:'||org;
 if not coalesce((common->>'public_profile_enabled')::bool,false) then return null;end if;
 if center is null then v:=common;select name into label from core.organizations where id=org;
 else
  if not private.center_accessible(org,center) then return null;end if;
  select name,timezone into label,zone from core.centers where org_id=org and id=center;
  if not found then return null;end if;
  select values into v from private.frontend_settings where scope_key='center:'||org||':'||center;
  if not coalesce((v->>'public_profile_enabled')::bool,false) then return null;end if;
 end if;
 selected:=coalesce(v->'public_fields','[]');
 if selected?'name' then result:=result||jsonb_build_object('name',label);end if;
 if selected?'description' then result:=result||jsonb_build_object('description',coalesce(v->>'description',''));end if;
 if selected?'address' then result:=result||jsonb_build_object('address',coalesce(v->>'address',''));end if;
 if selected?'contact' then result:=result||jsonb_build_object('contact',jsonb_build_object('phone',coalesce(v->>'contact_phone',''),'email',v->'contact_email'));end if;
 if selected?'hours' then result:=result||jsonb_build_object('hours',coalesce(v->'public_hours','[]'));end if;
 -- A center cannot override the organization's brand or reopen a hidden logo.
 if selected?'logo' and coalesce(common->'public_fields','[]')?'logo' then
  select jsonb_build_object('asset',private.settings_media_asset('organization:'||org),'data_base64',replace(encode(a.body,'base64'),E'\n','')) into image
   from private.settings_media_current c join private.settings_media_assets a on a.id=c.asset_id and a.scope_key=c.scope_key where c.scope_key='organization:'||org;
  result:=result||jsonb_build_object('logo',image);
 end if;
 return result;
end$$;
create function private.settings_public_slug(slug text) returns uuid language sql stable security invoker set search_path='' as $$
 select o.id from core.organizations o where lower(o.id::text)=lower($1)
 or exists(select 1 from core.publications p where p.org_id=o.id and p.slug=$1 and p.published)
 order by o.id limit 1
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p04_public(text,jsonb,uuid[],jsonb)'::regprocedure);
 a:=$a$'items',items,'next_cursor',token,'as_of',asof$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public profile projection anchor drift';end if;
 execute replace(b,a,a||$a$,'organization_profile',private.settings_public_profile(private.settings_public_slug(r->>'slug')),'center_profile',case when r->>'center_id' is not null then private.settings_public_profile(private.settings_public_slug(r->>'slug'),(r->>'center_id')::uuid) end$a$);
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);
 a:=' for item in select * from jsonb_each(patch) loop';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public hours validation anchor drift';end if;
 execute replace(b,a,$a$ if patch?'public_hours' and exists(select 1 from jsonb_array_elements(patch->'public_hours') h where h->>'local_start'=h->>'local_end' or not exists(select 1 from pg_timezone_names z where z.name=h->>'timezone')) then perform private.fail('VALIDATION_FAILED');end if;
$a$||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',4';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public settings catalog version anchor drift';end if;
 execute replace(b,a,'''catalog_version'',5');
end$patch$;
revoke all on function private.settings_public_profile(uuid,uuid),private.settings_public_slug(text) from public,anon,authenticated;
grant execute on function private.settings_public_profile(uuid,uuid),private.settings_public_slug(text) to service_role;
commit;
