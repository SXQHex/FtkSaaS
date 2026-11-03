-- One effective commercial policy; accepted prices and historical catalog rows stay unchanged.
begin;
create function private.commercial_plan_limits(plan_name text)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select case plan_name
 when 'starter' then private.starter_limits()
 when 'pro' then '{"entries":[{"key":"centers","value":1},{"key":"rooms","unlimited":true},{"key":"instructors","unlimited":true},{"key":"active_students","value":250}]}'::jsonb
 when 'business' then '{"entries":[{"key":"centers","value":5},{"key":"rooms","unlimited":true},{"key":"instructors","unlimited":true},{"key":"active_students","value":1250}]}'::jsonb
 end
$$;
create or replace function private.lesson_plan(org uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(p)||jsonb_build_object('limits',private.commercial_plan_limits(p.name))||
 case when p.name='starter' then jsonb_build_object('features',
  (select coalesce(jsonb_agg(f),'[]'::jsonb) from
   (select distinct f from unnest(p.features||array['F11','F13','F16','F25']) f where f not in ('F05','F12','F17','F18','F20','F21','F22','F23','F24','F27','F29')) q))
 else '{}'::jsonb end
 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id
 where s.org_id=org order by s.created_at desc,s.id desc limit 1
$$;
create or replace function private.plan_limit(org uuid,key_name text)
returns bigint language plpgsql stable security invoker set search_path='' as $$
declare definition jsonb;
begin
 select e into definition from jsonb_array_elements(private.lesson_plan(org)#>'{limits,entries}') e where e->>'key'=key_name;
 if definition is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 -- NULL means explicitly unlimited here, never absent configuration. All current
 -- numeric command consumers request the finite centers/active_students keys.
 if definition->>'unlimited'='true' then return null;end if;
 return (definition->>'value')::bigint;
end$$;
create function private.commercial_plan_usage(org uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select case when private.current_plan_name(org)='starter' then private.starter_usage(org) else
 jsonb_build_object('entries',jsonb_build_array(
  jsonb_build_object('key','centers','value',(select count(*) from core.centers where org_id=org and state='active')),
  jsonb_build_object('key','rooms','value',(select count(*) from core.rooms where org_id=org and state='active')),
  jsonb_build_object('key','disciplines','value',(select count(*) from core.disciplines where org_id=org and state='active')),
  jsonb_build_object('key','instructors','value',(select count(distinct person_id) from core.role_assignments where org_id=org and state='active' and role='instructor')),
  jsonb_build_object('key','active_students','value',private.starter_student_count(org)))) end
$$;
do $patch$
declare body text;old text;replacement text;
begin
 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:=$old$'limits',case when plan.name='starter' then private.starter_limits() else plan.limits end$old$;
 if strpos(body,old)=0 then raise exception 'Effective subscription limit anchor missing';end if;
 body:=replace(body,old,$new$'limits',private.commercial_plan_limits(plan.name)$new$);
 old:=$old$'usage',jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('key','active_students','value',private.starter_student_count(org)),jsonb_build_object('key','centers','value',(select count(*) from core.centers where org_id=org and state='active')),jsonb_build_object('key','instructors','value',(select count(distinct person_id) from private.person_center_relationships where org_id=org and kind='instructor' and state='active'))))$old$;
 if strpos(body,old)=0 then raise exception 'Effective usage value anchor missing';end if;
 body:=replace(body,old,$new$'usage',private.commercial_plan_usage(org)$new$);
 old:=$old$if plan.name='starter' then out:=out||jsonb_build_object('usage',private.starter_usage(org));end if;$old$;
 if strpos(body,old)=0 then raise exception 'Old Starter usage override anchor missing';end if;
 execute replace(body,old,'');
 -- A period change compares effective scope rather than obsolete raw catalog
 -- limits. The original accepted raw plan rows remain frozen by the S16 trigger.
 body:=pg_get_functiondef('private.subscription_billing(uuid)'::regprocedure);
 old:='t.limits=p.limits';
 if strpos(body,old)=0 then raise exception 'Period option limit anchor missing';end if;
 execute replace(body,old,'private.commercial_plan_limits(t.name)=private.commercial_plan_limits(p.name)');
 body:=pg_get_functiondef('private.p07_subscription_command(text,jsonb,uuid,uuid,uuid,uuid[])'::regprocedure);
 old:='t.limits<>p.limits';
 if strpos(body,old)=0 then raise exception 'Period command limit anchor missing';end if;
 execute replace(body,old,'private.commercial_plan_limits(t.name)<>private.commercial_plan_limits(p.name)');
end$patch$;
revoke all on function private.commercial_plan_limits(text),private.commercial_plan_usage(uuid) from public,anon,authenticated;
grant execute on function private.commercial_plan_limits(text),private.commercial_plan_usage(uuid) to service_role;
notify pgrst,'reload schema';
commit;
