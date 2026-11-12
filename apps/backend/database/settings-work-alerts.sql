begin;
-- A work alert is an optional in-app reminder, never a domain state change.
create table private.work_alert_activations(
 automation_id uuid primary key references core.automations(id),
 enabled_at timestamptz not null,trigger_kind text not null
);
alter table private.work_alert_activations enable row level security;
revoke all on private.work_alert_activations from public,anon,authenticated;
grant select,insert,update,delete on private.work_alert_activations to service_role;
create function private.work_alert_recipient(org uuid,center uuid,person uuid,kind text,subject uuid default null)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from core.people p where p.org_id=org and p.id=person and p.state='active')
 and (private.is_manager(org,person,center)
 or private.staff_grant(org,person,center,case kind when 'pending_request' then 'request.resolve' else 'attendance.draft' end)
 or (kind='unclosed_attendance' and subject is not null and private.lesson_duty(org,person,subject,false)))
$$;
create function private.work_alert_validate(org uuid,definition jsonb) returns void
language plpgsql stable security invoker set search_path='' as $$
declare kind text:=definition#>>'{trigger,kind}';p uuid;c uuid;
begin
 if kind not in ('pending_request','unclosed_attendance') then return;end if;
 if definition#>>'{action,kind}' is distinct from 'send_reminder' or definition#>>'{action,channel}' is distinct from 'in_app' or definition->>'segment_id' is not null
 or jsonb_typeof(definition#>'{trigger,recipient_person_ids}') is distinct from 'array'
 or jsonb_array_length(definition#>'{trigger,recipient_person_ids}') not between 1 and 50 then perform private.fail('VALIDATION_FAILED');end if;
 if (select count(*)<>count(distinct value::text::uuid) from jsonb_array_elements_text(definition#>'{trigger,recipient_person_ids}')) then perform private.fail('VALIDATION_FAILED');end if;
 for p in select value::uuid from jsonb_array_elements_text(definition#>'{trigger,recipient_person_ids}') loop
  if not exists(select 1 from core.people where org_id=org and id=p and state='active') then perform private.fail('NOT_FOUND');end if;
 end loop;
 for c in select value::uuid from jsonb_array_elements_text(definition->'execution_center_ids') loop
  for p in select value::uuid from jsonb_array_elements_text(definition#>'{trigger,recipient_person_ids}') loop
   if not private.work_alert_recipient(org,c,p,kind) then perform private.fail('FORBIDDEN');end if;
  end loop;
 end loop;
end$$;
create function private.work_alert_activation() returns trigger language plpgsql security invoker set search_path='' as $$
declare kind text;
begin
 select a.trigger->>'kind' into kind from core.automations a where a.id=new.entity_id;
 if kind is null or kind not in ('pending_request','unclosed_attendance') or not new.enabled then
  delete from private.work_alert_activations where automation_id=new.entity_id;return new;
 end if;
 if TG_OP='INSERT' or not old.enabled or not exists(select 1 from private.work_alert_activations where automation_id=new.entity_id and trigger_kind=kind) then
  insert into private.work_alert_activations values(new.entity_id,clock_timestamp(),kind) on conflict(automation_id) do update set enabled_at=excluded.enabled_at,trigger_kind=excluded.trigger_kind;
 end if;
 return new;
end$$;
create trigger work_alert_activation after insert or update on private.p05_configuration_scopes for each row execute function private.work_alert_activation();
create function private.work_alert_after_activation(automation uuid,org uuid,kind text,target uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select case when kind='pending_request' then exists(select 1 from core.lesson_requests q join private.work_alert_activations a on a.automation_id=automation where q.org_id=org and q.id=target and q.created_at>=a.enabled_at)
 when kind='unclosed_attendance' then exists(select 1 from core.sessions s join private.work_alert_activations a on a.automation_id=automation where s.org_id=org and s.id=target and s.actual_started_at>=a.enabled_at)
 else true end
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p05_notifications(text,jsonb,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 a:='  else'||E'\n'||'   if definition#>>''{action,channel}''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work alert configuration validation drift';end if;
 execute replace(b,a,'  else'||E'\n'||'   perform private.work_alert_validate(org,definition);'||E'\n'||'   if definition#>>''{action,channel}''');
 b:=pg_get_functiondef('private.p05_automation_candidates(uuid,uuid,jsonb)'::regprocedure);
 a:=' if trigger->>''kind''=''lead_followup_due'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work alert candidates drift';end if;
 execute replace(b,a,$a$ if trigger->>'kind'='pending_request' then
  return query select p.value::uuid,q.id,'request:'||q.id::text from core.lesson_requests q cross join jsonb_array_elements_text(trigger->'recipient_person_ids') p(value)
  where q.org_id=org and q.center_id=center and private.lesson_request_actionable(q) and q.created_at+make_interval(days=>days)<=clock_timestamp()
  and private.work_alert_recipient(org,center,p.value::uuid,'pending_request',q.id);return;
 elsif trigger->>'kind'='unclosed_attendance' then
  return query select p.value::uuid,s.id,'attendance:'||s.id::text from core.sessions s cross join jsonb_array_elements_text(trigger->'recipient_person_ids') p(value)
  where s.org_id=org and s.center_id=center and s.state<>'cancelled' and s.attendance_state<>'closed' and s.actual_started_at is not null
  and s.actual_started_at+make_interval(days=>days)<=clock_timestamp() and s.starts_at<=clock_timestamp()
  and private.work_alert_recipient(org,center,p.value::uuid,'unclosed_attendance',s.id);return;
 end if;
$a$||a);
 b:=pg_get_functiondef('private.p05_jobs_claim(uuid,uuid[],integer)'::regprocedure);
 a:='private.p05_automation_candidates(org,c,cfg.trigger) z where';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work alert activation claim drift';end if;
 execute replace(b,a,a||' private.work_alert_after_activation(cfg.id,org,cfg.trigger->>''kind'',z.target_id) and');
 b:=pg_get_functiondef('private.p05_worker_execute(text,jsonb,uuid[])'::regprocedure);
 a:='z.target_id=c.target_id and a.version::text';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work alert activation execution drift';end if;
 b:=replace(b,a,'z.target_id=c.target_id and private.work_alert_after_activation(a.id,org,a.trigger->>''kind'',z.target_id) and a.version::text');
 a:='''reminder'',c.person_id,jsonb_build_object(''template_key'',a.action->>''template_key'',''subject'',jsonb_build_object(''type'',''people'',''id'',c.person_id))';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work alert notification subject drift';end if;
 b:=replace(b,a,$a$'reminder',case when a.trigger->>'kind' in ('pending_request','unclosed_attendance') then c.target_id else c.person_id end,jsonb_build_object('template_key',a.action->>'template_key','subject',jsonb_build_object('type',case a.trigger->>'kind' when 'pending_request' then 'lesson_requests' when 'unclosed_attendance' then 'sessions' else 'people' end,'id',case when a.trigger->>'kind' in ('pending_request','unclosed_attendance') then c.target_id else c.person_id end))$a$);
 execute b;
 b:=pg_get_functiondef('private.p07_automation_allowed(uuid,uuid,jsonb,uuid)'::regprocedure);
 a:=' else return false;end if;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work alert reopen epoch drift';end if;
 execute replace(b,a,$a$ elsif trigger->>'kind'='pending_request' then select q.created_at+make_interval(days=>days) into due_at from core.lesson_requests q where q.org_id=org and q.center_id=center and q.id=target;
 elsif trigger->>'kind'='unclosed_attendance' then select s.actual_started_at+make_interval(days=>days) into due_at from core.sessions s where s.org_id=org and s.center_id=center and s.id=target;
$a$||a);
end$patch$;
revoke all on function private.work_alert_recipient(uuid,uuid,uuid,text,uuid),private.work_alert_validate(uuid,jsonb),private.work_alert_activation(),private.work_alert_after_activation(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.work_alert_recipient(uuid,uuid,uuid,text,uuid),private.work_alert_validate(uuid,jsonb),private.work_alert_activation(),private.work_alert_after_activation(uuid,uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
