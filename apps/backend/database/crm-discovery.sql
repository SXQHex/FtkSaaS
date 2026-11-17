-- Web1 CRM discovery reuses native lead visibility and writer projections.
begin;
create index crm_lead_stage_assignee on core.leads(org_id,center_id,assigned_person_id,created_at,id);
create index crm_conversion_history on core.audit_events(org_id,subject_id,created_at) where action='lead_convert_v1' and subject_table='leads';
create function private.crm_visible_leads(r jsonb,p_org uuid,p_center uuid,p_actor uuid,stamp timestamptz)
returns setof core.leads language sql stable security invoker set search_path='' as $$
 select l.* from core.leads l join core.people p on p.org_id=l.org_id and p.id=l.person_id
 where l.org_id=p_org and (p_center is null or l.center_id=p_center) and l.created_at<=stamp and private.center_accessible(p_org,l.center_id)
 and coalesce(private.p04_can_lead(p_org,l.center_id,p_actor,l.assigned_person_id),false)
 and (r->>'query' is null or p.display_name ilike '%'||(r->>'query')||'%' or l.source ilike '%'||(r->>'query')||'%' or l.interest ilike '%'||(r->>'query')||'%')
 and (not r?'assigned_to' or l.assigned_person_id is not distinct from (r->>'assigned_to')::uuid)
 and (r->>'stage_key' is null or private.crm_pipeline_view(l)#>>'{stage,key}'=r->>'stage_key')
$$;
create function private.crm_lead_summary(r jsonb,p_org uuid,p_center uuid,p_actor uuid,stamp timestamptz) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare zone text;day_start timestamptz;day_end timestamptz;result jsonb;
begin
 if p_center is null then perform private.fail('VALIDATION_FAILED');end if;
 select timezone into zone from core.centers where org_id=p_org and id=p_center;
 day_start:=date_trunc('day',stamp at time zone zone) at time zone zone;
 day_end:=(date_trunc('day',stamp at time zone zone)+interval '1 day') at time zone zone;
 with visible as materialized(select * from private.crm_visible_leads(r,p_org,p_center,p_actor,stamp)),due as (
  select a.* from core.crm_activities a join visible l on l.org_id=a.org_id and l.id=a.lead_id
  where a.kind='followup' and a.completed_at is null and a.due_at is not null
 ) select jsonb_build_object('total',(select count(*) from visible),'open_leads',(select count(*) from visible where state='open'),
  'followups_today',(select count(*) from due where due_at>=day_start and due_at<day_end),'overdue_followups',(select count(*) from due where due_at<stamp),
  'converted_last_30_days',(select count(distinct e.subject_id) from core.audit_events e join visible l on l.org_id=e.org_id and l.id=e.subject_id
   where e.org_id=p_org and e.subject_table='leads' and e.action='lead_convert_v1' and e.created_at>=stamp-interval '30 days' and e.created_at<=stamp)) into result;
 return result;
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.p04_leads_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);a text;
begin
 a:=' if lim<1 or lim>200';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM discovery validation drift';end if;
 b:=replace(b,a,$a$ if r?'stage_key' then perform private.crm_pipeline_feature(org);end if;
 if coalesce((r->>'include_summary')::bool,false) and center is null then perform private.fail('VALIDATION_FAILED');end if;
$a$||a);
 a:='from core.leads l';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM visible source drift';end if;
 b:=replace(b,a,'from private.crm_visible_leads(r,org,center,actor,asof) l');
 a:=$a$private.p04_lead_view(l,f.due)||jsonb_build_object('_at',t.at)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM details projection drift';end if;
 b:=replace(b,a,$a$private.p04_lead_view(l,f.due)||case when coalesce((r->>'include_details')::bool,false) then jsonb_build_object('created_at',l.created_at,'display_name',p.display_name,
  'assigned_name',(select n.display_name from core.people n where n.org_id=org and n.id=private.p07_person_root(org,l.assigned_person_id))) else '{}'::jsonb end||jsonb_build_object('_at',t.at)$a$);
 a:=$a$ return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM summary projection drift';end if;
 execute replace(b,a,$a$ return case when coalesce((r->>'include_summary')::bool,false) then jsonb_build_object('summary',private.crm_lead_summary(r,org,center,actor,asof)) else '{}'::jsonb end||jsonb_build_object('items',items,'next_cursor',token,'as_of',asof)$a$);
end$patch$;
revoke all on function private.crm_visible_leads(jsonb,uuid,uuid,uuid,timestamptz),private.crm_lead_summary(jsonb,uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.crm_visible_leads(jsonb,uuid,uuid,uuid,timestamptz),private.crm_lead_summary(jsonb,uuid,uuid,uuid,timestamptz) to service_role;
commit;
