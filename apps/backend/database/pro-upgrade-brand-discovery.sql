begin;
-- This catalog discovers targets; quotes still determine the actual amount due.
create function private.subscription_upgrade_options(org uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.saas_subscriptions;p core.saas_plan_versions;result jsonb;
begin
 if person is distinct from (select owner_person_id from core.organizations where id=org) then return '[]'::jsonb;end if;
 select * into s from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1;
 if s.id is null or s.starts_at is null or s.period_end is null or s.state in ('pending_payment','ended')
  or (s.cancel_at_period_end and s.period_end<=statement_timestamp())
  or exists(select 1 from core.saas_change_requests where org_id=org and state='scheduled' and source_plan_id is not null) then return '[]'::jsonb;end if;
 select * into p from core.saas_plan_versions where id=s.plan_version_id;
 select coalesce(jsonb_agg(jsonb_build_object('plan',t.name,'target',private.subscription_plan_terms(t)) order by private.p07_plan_rank(t.name),t.effective_at,t.id),'[]'::jsonb) into result
 from core.saas_plan_versions t where t.effective_at<=statement_timestamp() and t.period=p.period and t.currency=p.currency and t.price_minor>0 and t.price_minor>=p.price_minor
  and private.p07_plan_rank(t.name)>private.p07_plan_rank(p.name);
 return result;
end$$;
-- Only the three approved public brand values; no billing, logo or private settings.
create function private.organization_brand_colors(org uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('primary_color',s.v->'primary_color','secondary_color',s.v->'secondary_color','accent_color',s.v->'accent_color')
 from (select coalesce((select values from private.frontend_settings where scope_key='organization:'||$1),'{}'::jsonb) v) s
$$;
revoke all on function private.subscription_upgrade_options(uuid,uuid),private.organization_brand_colors(uuid) from public,anon,authenticated;
grant execute on function private.subscription_upgrade_options(uuid,uuid),private.organization_brand_colors(uuid) to service_role;
do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$jsonb_build_object('downgrade_options',private.subscription_downgrade_options(org,person))$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Upgrade target catalog dispatch drift';end if;
 body:=replace(body,anchor,$a$jsonb_build_object('downgrade_options',private.subscription_downgrade_options(org,person),'upgrade_options',private.subscription_upgrade_options(org,person))$a$);
 anchor:=' if out is null then out:=jsonb_build_object(''operation_id''';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Member brand projection drift';end if;
 execute replace(body,anchor,$a$ if p_operation='organization_get_v1' then out:=out||jsonb_build_object('brand_colors',private.organization_brand_colors(org));
 elsif p_operation='organizations_list_v1' then
  out:=jsonb_set(out,'{items}',coalesce((select jsonb_agg(x||jsonb_build_object('brand_colors',private.organization_brand_colors((x->>'id')::uuid)) order by n)
   from jsonb_array_elements(out->'items') with ordinality e(x,n)),'[]'::jsonb));
 end if;
$a$||anchor);
 body:=pg_get_functiondef('private.settings_public_profile(uuid,uuid)'::regprocedure);
 anchor:=' return result;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Public brand projection drift';end if;
 execute replace(body,anchor,$a$ if jsonb_strip_nulls(private.organization_brand_colors(org))<>'{}'::jsonb then result:=result||jsonb_build_object('brand_colors',private.organization_brand_colors(org));end if;
 return result;$a$);
end$patch$;
notify pgrst,'reload schema';
commit;
