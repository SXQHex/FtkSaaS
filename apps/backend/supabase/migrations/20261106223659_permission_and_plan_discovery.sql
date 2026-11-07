begin;
-- Read stored permission choice, not a synthetic effective permission. The
-- existing writer remains responsible for contextual role and operation rules.
create function private.permission_management_page(r jsonb,org uuid,center uuid,account uuid,auth_id uuid,session_id uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';op text:='permission_set_v1';target uuid:=(k->>'person_id')::uuid;permission_code text:=k->>'permission';p core.people;choice core.permission_overrides;vals jsonb;item jsonb;at timestamptz:=clock_timestamp();
begin
 if center is null or r->>'operation' is distinct from op or r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;
 perform private.p06_original_authorize(op,jsonb_build_object('org_id',org,'center_id',center)||k,auth_id,session_id,ids);
 if permission_code not in ('person.manage','person.activate','invite.student','reservation.write','attendance.draft','sale.write','finance.collect') then perform private.fail('FORBIDDEN');end if;
 select * into p from core.people where org_id=org and id=target;if p.id is null then perform private.fail('NOT_FOUND');end if;
 if not private.has_role(org,target,'staff',center) and not private.has_role(org,target,'instructor',center) then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type','people','id',target) then perform private.fail('NOT_FOUND');end if;
 select * into choice from core.permission_overrides where org_id=org and center_id=center and person_id=target and core.permission_overrides.permission=permission_code;
 vals:=k||jsonb_build_object('override_exists',choice.id is not null)||case when choice.id is null then '{}'::jsonb else jsonb_build_object('enabled',choice.enabled) end;
 item:=jsonb_build_object('operation',op,'entity',jsonb_build_object('type','people','id',p.id),'exists',true,'state',p.state,
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',p.id),'version',p.version)),
  'as_of',at,'current',jsonb_build_object('operation',op,'values',vals));
 return private.p06_page(jsonb_build_array(item),r->'page',md5(jsonb_build_object('account',account,'request',r-'page'-'request_id')::text),at);
end$$;
create function private.subscription_downgrade_options(org uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.saas_subscriptions;p core.saas_plan_versions;result jsonb;
begin
 if person is distinct from (select owner_person_id from core.organizations where id=org) then return '[]'::jsonb;end if;
 select * into s from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1;
 if s.id is null or s.state<>'active' or s.period_end is null or s.period_end<=statement_timestamp()
  or exists(select 1 from core.saas_change_requests where org_id=org and state='scheduled' and source_plan_id is not null) then return '[]'::jsonb;end if;
 select * into p from core.saas_plan_versions where id=s.plan_version_id;
 select coalesce(jsonb_agg(jsonb_build_object('plan',t.name,'target',private.subscription_plan_terms(t),'effective_at',s.period_end,'kept_center_required',t.name<>'business') order by private.p07_plan_rank(t.name),t.effective_at,t.id),'[]'::jsonb) into result
 from core.saas_plan_versions t where t.effective_at<=statement_timestamp() and t.period=p.period and t.currency=p.currency and t.price_minor>0
 and private.p07_plan_rank(t.name)<private.p07_plan_rank(p.name);
 return result;
end$$;
revoke all on function private.permission_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]),private.subscription_downgrade_options(uuid,uuid) from public,anon,authenticated;
grant execute on function private.permission_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]),private.subscription_downgrade_options(uuid,uuid) to service_role;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Permission management dispatch anchor drift';end if;
 b:=replace(b,a,$branch$ if p_operation='management_state_get_v1' and r->>'operation'='permission_set_v1' then
  out:=private.permission_management_page(r,org,center,actor.id,p_actor_auth_id,p_session_id,p_ids);
  return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$branch$||a);
 a:='''billing'',private.subscription_billing(org)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Downgrade target catalog anchor drift';end if;
 execute replace(b,a,'''billing'',(private.subscription_billing(org)||jsonb_build_object(''downgrade_options'',private.subscription_downgrade_options(org,person)))');
end$patch$;
notify pgrst,'reload schema';
commit;
