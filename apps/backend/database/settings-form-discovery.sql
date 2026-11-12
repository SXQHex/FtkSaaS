begin;
create function private.configured_forms_page(r jsonb,org uuid,person uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare center uuid:=(r->>'center_id')::uuid;lim int:=coalesce((r#>>'{configured_forms_page,limit}')::int,50);
 last_id uuid;cursor_data jsonb;items jsonb;token text;scope_hash text:=md5(jsonb_build_object('org',org,'center',center,'person',person,'scope',r->>'scope')::text);
begin
 if r->>'scope' not in ('organization','center') or org is null then perform private.fail('VALIDATION_FAILED');end if;
 if (r->>'scope'='organization' and not coalesce(private.is_org_reader(org,person),false)) or
    (r->>'scope'='center' and (center is null or not coalesce(private.is_manager(org,person,center),false))) then perform private.fail('FORBIDDEN');end if;
 if not private.pro_preparation_licensed(org,'crm') then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 if center is not null then perform private.assert_center(org,center);end if;
 if lim<1 or lim>200 then perform private.fail('VALIDATION_FAILED');end if;
 if r#>>'{configured_forms_page,cursor}' is not null then
  begin
   cursor_data:=convert_from(decode(r#>>'{configured_forms_page,cursor}','hex'),'utf8')::jsonb;
   last_id:=(cursor_data->>'id')::uuid;
   if last_id is null or cursor_data->>'scope' is distinct from scope_hash then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('form_id',f.id,'center_id',f.center_id,'channel',f.channel,'form_key',f.form_key,'enabled',f.enabled) order by f.id),'[]')
 into items from(select * from private.crm_intake_forms x where x.org_id=org and x.channel='web_form' and (r->>'scope'='organization' or x.center_id=center) and (last_id is null or x.id>last_id) order by x.id limit lim+1) f;
 if jsonb_array_length(items)>lim then
  items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',scope_hash,'id',items->-1->'form_id')::text,'utf8'),'hex');
 end if;
 return jsonb_build_object('items',items,'next_cursor',token);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
a text:='''Consent is separate from stored advertising or analytics preferences.''));';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Configured forms catalog drift';end if;
 execute replace(b,a,'''Consent is separate from stored advertising or analytics preferences.'')) || case when coalesce((r->>''include_configured_forms'')::boolean,false) then jsonb_build_object(''configured_forms'',private.configured_forms_page(r,org,person)) else ''{}''::jsonb end;');
end$patch$;
revoke all on function private.configured_forms_page(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function private.configured_forms_page(jsonb,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
