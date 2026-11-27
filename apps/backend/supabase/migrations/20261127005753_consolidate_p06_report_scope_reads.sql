begin;

create or replace function private.p06_report_scope(r jsonb, org uuid, center uuid, actor uuid, exporting boolean default false)
returns uuid[] language plpgsql stable security invoker set search_path='' as $scope$
#variable_conflict use_column
declare
 centers uuid[];
 scoped_center uuid;
 kind text := r->>'report';
 plan text;
 plan_features text[];
 organization_reader boolean;
 financial boolean := kind in ('collections_debts','earnings','cross_center_usage','sales','collection_breakdown','instructor_balances');
 starts_at timestamptz := (r#>>'{filters,interval,starts_at}')::timestamptz;
 ends_at timestamptz := (r#>>'{filters,interval,ends_at}')::timestamptz;
begin
 -- The report features use the same latest plan version throughout the check.
 select p.name,p.features into plan,plan_features
 from core.saas_subscriptions sub join core.saas_plan_versions p on p.id=sub.plan_version_id
 where sub.org_id=org order by sub.created_at desc,sub.id desc limit 1;

 if not coalesce(plan_features @> array['F28'],false) then
  perform private.fail('PLAN_FEATURE_UNAVAILABLE');
 end if;
 if kind not in ('collections_debts','lesson_attendance','renewal','occupancy','resource_usage','earnings','crm_conversion','cross_center_usage','sales','session_metrics','collection_breakdown','instructor_balances')
  or starts_at is null or ends_at is null or not isfinite(starts_at) or not isfinite(ends_at)
  or starts_at>=ends_at or ends_at-starts_at>interval '366 days' then
  perform private.fail('VALIDATION_FAILED');
 end if;
 if (plan='starter' and kind not in ('collections_debts','lesson_attendance'))
  or (kind='cross_center_usage' and plan<>'business')
  or (financial and not (plan_features @> array['F06','F19']))
  or (kind='crm_conversion' and not (plan_features @> array['F21']))
  or (kind in ('earnings','instructor_balances') and not (plan_features @> array['F20']))
  or (kind='cross_center_usage' and not (plan_features @> array['F18'])) then
  perform private.fail('PLAN_FEATURE_UNAVAILABLE');
 end if;

 organization_reader:=private.is_org_reader(org,actor);
 select array_agg(distinct value::uuid order by value::uuid) into centers
 from jsonb_array_elements_text(r#>'{filters,center_ids}');
 if centers is null then
  if center is not null then
   centers:=array[center];
  elsif organization_reader then
   select array_agg(c.id order by c.id) into centers
   from core.centers c where c.org_id=org and private.center_accessible(org,c.id);
  else
   perform private.fail('FORBIDDEN');
  end if;
 end if;
 if center is not null and exists(select 1 from unnest(centers) c where c<>center) then
  perform private.fail('FORBIDDEN');
 end if;
 if cardinality(centers)>1 and plan<>'business' then
  perform private.fail('PLAN_FEATURE_UNAVAILABLE');
 end if;
 foreach scoped_center in array coalesce(centers,'{}'::uuid[]) loop
  perform private.assert_center(org,scoped_center);
  if not organization_reader and not private.is_manager(org,actor,scoped_center) then
   if not private.p06_granted(org,actor,scoped_center,'report.read')
    or (financial and not private.p06_granted(org,actor,scoped_center,'finance.read'))
    or (exporting and (not private.p06_granted(org,actor,scoped_center,'report.export') or kind='crm_conversion')) then
    perform private.fail('FORBIDDEN');
   end if;
  end if;
 end loop;
 if exists (
  select 1 from jsonb_array_elements_text(coalesce(r#>'{filters,person_ids}','[]')) p
  where not exists (
   select 1 from core.people x
   join private.person_center_relationships cr on cr.org_id=x.org_id and cr.person_id=x.id
   where x.org_id=org and x.id=p.value::uuid and cr.center_id=any(centers)
  )
 ) then
  perform private.fail('NOT_FOUND');
 end if;
 return coalesce(centers,'{}'::uuid[]);
end
$scope$;

commit;
