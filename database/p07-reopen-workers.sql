begin;
create function private.p07_due_allowed(org uuid,due_at timestamptz) returns boolean language sql stable security invoker set search_path='' as $$
 select due_at is not null and not exists(select 1 from private.p07_closure_epochs e where e.org_id=org and due_at>=e.closed_at and due_at<coalesce(e.reopened_at,'infinity'::timestamptz))
$$;
create function private.p07_reminder_allowed(org uuid,center uuid,kind text,target uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare due_at timestamptz;days_or_hours int;
begin
 if not exists(select 1 from private.p07_closure_epochs where org_id=org) then return true;end if;
 if kind='lesson' then
  select s.starts_at-interval '24 hours' into due_at from core.reservations r join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.center_id=center and r.id=target;
 elsif kind='entitlement' then
  select (p.value->>'value')::int into days_or_hours from private.policy_at(org,center,'entitlement_reminder_days',clock_timestamp()) p;
  select valid_until-make_interval(days=>days_or_hours) into due_at from core.sales where org_id=org and center_id=center and id=target;
 else return false;end if;
 return private.p07_due_allowed(org,due_at);
end$$;
create function private.p07_automation_allowed(org uuid,center uuid,trigger jsonb,target uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare due_at timestamptz;days int:=(trigger->>'offset_days')::int;
begin
 if not exists(select 1 from private.p07_closure_epochs where org_id=org) then return true;end if;
 if trigger->>'kind'='lead_followup_due' then
  select a.due_at-make_interval(days=>days) into due_at from core.crm_activities a where a.org_id=org and a.center_id=center and a.id=target;
 elsif trigger->>'kind'='entitlement_expiring' then
  select valid_until-make_interval(days=>days) into due_at from core.sales where org_id=org and center_id=center and id=target;
 elsif trigger->>'kind'='student_inactive' then
  select coalesce(last_seen.at,cr.started_at)+make_interval(days=>days) into due_at from core.center_relationships cr left join lateral(select max(coalesce(s.actual_started_at,s.starts_at)) at from core.attendance_entries a join core.reservations r on r.org_id=a.org_id and r.id=a.reservation_id join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.center_id=center and r.person_id=cr.person_id and a.result='attended' and r.state='completed') last_seen on true where cr.org_id=org and cr.center_id=center and cr.id=target;
 else return false;end if;
 return private.p07_due_allowed(org,due_at);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.p05_jobs_claim(uuid,uuid[],integer)'::regprocedure);a text;
begin
 a:=$a$where r.org_id=org and r.state='active' and s.state='planned'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 reopened lesson reminder anchor mismatch';end if;
 b:=replace(b,a,$a$where r.org_id=org and private.p07_reminder_allowed(org,r.center_id,'lesson',r.id) and r.state='active' and s.state='planned'$a$);
 a:=$a$where s.org_id=org and s.state='active' and s.valid_until>clock_timestamp()$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 reopened entitlement reminder anchor mismatch';end if;
 b:=replace(b,a,$a$where s.org_id=org and private.p07_reminder_allowed(org,s.center_id,'entitlement',s.id) and s.state='active' and s.valid_until>clock_timestamp()$a$);
 a:=$a$z where not exists(select 1 from core.outbox_jobs$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 reopened automation anchor mismatch';end if;
 b:=replace(b,a,$a$z where private.p07_automation_allowed(org,c,cfg.trigger,z.target_id) and not exists(select 1 from core.outbox_jobs$a$);
 execute b;
end$patch$;
revoke all on function private.p07_due_allowed(uuid,timestamptz),private.p07_reminder_allowed(uuid,uuid,text,uuid),private.p07_automation_allowed(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.p07_due_allowed(uuid,timestamptz),private.p07_reminder_allowed(uuid,uuid,text,uuid),private.p07_automation_allowed(uuid,uuid,jsonb,uuid) to service_role;
commit;
