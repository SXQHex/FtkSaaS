-- W1-BE-52/53/54: CRM report cohort, visible directory counters and application state filters.
begin;

create index crm_pipeline_transition_history on core.audit_events(org_id,subject_id,created_at)
 where subject_table='leads' and action='lead_save_v1' and diff?'pipeline_after';

create function private.crm_report_funnel(r jsonb,p_org uuid,p_centers uuid[]) returns jsonb
language sql stable security invoker set search_path='' as $$
 with period as (
  select (r#>>'{filters,interval,starts_at}')::timestamptz lo,(r#>>'{filters,interval,ends_at}')::timestamptz hi
 ), cohort as materialized (
  select l.id,l.created_at,
   case when lower(btrim(l.source)) in ('manual','phone','whatsapp','web','website','instagram','facebook','referral','public_application','legacy_import')
    then lower(btrim(l.source)) else 'other' end source
  from core.leads l cross join period
  where l.org_id=p_org and l.center_id=any(p_centers) and l.created_at>=lo and l.created_at<hi
   and (r#>>'{filters,state}' is null or l.state=r#>>'{filters,state}')
   and r#>>'{filters,currency}' is null and coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0
 ), converted as materialized (
  select distinct l.id from cohort l join core.audit_events a on a.org_id=p_org and a.subject_id=l.id
  cross join period where a.subject_table='leads' and a.action='lead_convert_v1' and a.created_at>=l.created_at and a.created_at<hi
 ), stage_counts as (
  select a.diff#>>'{pipeline_after,stage,key}' stage_key,count(distinct l.id) count
  from cohort l join core.audit_events a on a.org_id=p_org and a.subject_id=l.id
  cross join period
  where a.subject_table='leads' and a.action='lead_save_v1' and a.diff?'pipeline_after'
   and a.created_at>=l.created_at and a.created_at<hi and a.diff#>>'{pipeline_after,stage,key}' is not null
  group by 1
 ), source_counts as (
  select l.source,count(*) count,count(c.id) converted_count from cohort l left join converted c on c.id=l.id group by l.source
 )
 select jsonb_build_object('cohort_count',(select count(*) from cohort),'converted_count',(select count(*) from converted),
  'stages',coalesce((select jsonb_agg(to_jsonb(s) order by s.stage_key) from stage_counts s),'[]'),
  'sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.source) from source_counts s),'[]'))
$$;

create function private.crm_pipeline_summary(r jsonb,p_org uuid,p_center uuid,p_actor uuid,stamp timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 with visible as materialized (
  select id,org_id,center_id,state,pipeline#>>'{stage,key}' stage_key
  from private.crm_visible_leads(r-'stage_key',p_org,p_center,p_actor,stamp)
 ), stage_counts as (
  select stage_key,count(*) count from visible group by stage_key
 ), stage_keys as (
  select s->>'key' stage_key from jsonb_array_elements(private.crm_pipeline_catalog(p_org,p_center)->'stages') s
  union select stage_key from stage_counts
 ), stages as (
  select k.stage_key,coalesce(n.count,0) count
  from stage_keys k left join stage_counts n on n.stage_key is not distinct from k.stage_key
 ), trials as (
  select count(distinct l.id) filter(where l.state='open' and o.state='active' and o.expires_at>stamp) offered,
   count(distinct l.id) filter(where v.state in ('active','completed')) registered,
   count(distinct l.id) filter(where v.state='completed' and a.result='attended') attended
  from visible l join core.trial_offers o on o.org_id=l.org_id and o.center_id=l.center_id and o.lead_id=l.id and o.created_at<=stamp
  left join core.reservations v on v.org_id=o.org_id and v.center_id=o.center_id and v.trial_offer_id=o.id and v.created_at<=stamp
  left join core.attendance_entries a on a.org_id=v.org_id and a.center_id=v.center_id and a.reservation_id=v.id
 )
 select jsonb_build_object('stages',coalesce((select jsonb_agg(to_jsonb(s) order by s.stage_key nulls last) from stages s),'[]'),
  'trials',(select to_jsonb(t) from trials t))
$$;

revoke all on function private.crm_report_funnel(jsonb,uuid,uuid[]),private.crm_pipeline_summary(jsonb,uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.crm_report_funnel(jsonb,uuid,uuid[]),private.crm_pipeline_summary(jsonb,uuid,uuid,uuid,timestamptz) to service_role;

do $patch$
declare body text; anchor text;
begin
 body:=pg_get_functiondef('private.p06_report(text,jsonb,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$old$  rows:=private.p06_report_rows(r,org,centers);$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM report filter anchor drift';end if;
 body:=replace(body,anchor,$new$  if coalesce((r->>'include_crm_funnel')::bool,false) and r->>'report'<>'crm_conversion' then perform private.fail('VALIDATION_FAILED');end if;
$new$||anchor);
 anchor:=$old$jid:=org;$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM report result anchor drift';end if;
 execute replace(body,anchor,anchor||$new$
  if coalesce((r->>'include_crm_funnel')::bool,false) then
   data:=data||jsonb_build_object('crm_funnel',private.crm_report_funnel(r,org,centers));
  end if;$new$);

 body:=pg_get_functiondef('private.p04_leads_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor:=$old$ if r?'stage_key' then perform private.crm_pipeline_feature(org);end if;$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM pipeline summary authority anchor drift';end if;
 body:=replace(body,anchor,anchor||$new$
 if coalesce((r->>'include_pipeline_summary')::bool,false) then
  if op<>'leads_list_v1' or center is null then perform private.fail('VALIDATION_FAILED');end if;
  perform private.crm_pipeline_feature(org);
 end if;$new$);
 anchor:=$old$ return case when coalesce((r->>'include_summary')::bool,false) then$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM pipeline summary projection anchor drift';end if;
 execute replace(body,anchor,$new$ return case when coalesce((r->>'include_pipeline_summary')::bool,false)
  then jsonb_build_object('pipeline_summary',private.crm_pipeline_summary(r,org,center,actor,asof)) else '{}'::jsonb end||
  case when coalesce((r->>'include_summary')::bool,false) then$new$);

 body:=pg_get_functiondef('private.crm_application_page(jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor:=$old$   and a.created_at<=asof$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM application state predicate anchor drift';end if;
 execute replace(body,anchor,$new$   and (not k?'states' or k->'states' ? a.state)
$new$||anchor);
end$patch$;
commit;
