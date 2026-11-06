begin;
create function private.reminder_licensed(org uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if coalesce(private.current_plan_name(org),'') not in ('pro','business') then return false;end if;
 perform private.require_feature(org,'F27');return true;
exception when sqlstate 'P0001' then if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','SUBSCRIPTION_NOT_STARTED','POLICY_NOT_CONFIGURED') then return false;end if;raise;
end$$;
-- Migration compatibility uses source time even when the recipient is opted
-- out. Eligibility must never erase dedupe evidence for an already-sent event.
create function private.reminder_source_generation(org uuid,kind text,target uuid) returns text language sql stable security invoker set search_path='' as $$
 select extract(epoch from expires_at)::text from (
  select s.starts_at expires_at from core.reservations r join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where $2='lesson' and r.org_id=$1 and r.id=$3
  union all select s.valid_until from core.sales s where $2='entitlement' and s.org_id=$1 and s.id=$3
  union all select e.starts_at from core.event_registrations r join core.events e on e.org_id=r.org_id and e.id=r.event_id where $2='event' and r.org_id=$1 and r.id=$3
  union all select d.due_at from core.debts d where $2='payment' and d.org_id=$1 and d.id=$3
 ) source
$$;
-- Only reminder email observes this window. ISO weekdays name the day on which
-- an interval starts; PostgreSQL resolves DST gaps/folds using the IANA zone.
create function private.reminder_quiet_until(settings jsonb,at_time timestamptz) returns timestamptz language plpgsql stable security invoker set search_path='' as $$
declare tz text:=settings->>'timezone_name';local_time timestamp;day date;start_time time;end_time time;finish timestamptz;
begin
 if coalesce((settings->>'quiet_hours_enabled')::bool,false)=false then return at_time;end if;
 if tz is null or not exists(select 1 from pg_timezone_names where name=tz) then return null;end if;
 start_time:=(settings->>'quiet_hours_start')::time;end_time:=(settings->>'quiet_hours_end')::time;
 if start_time is null or end_time is null or start_time=end_time or coalesce(jsonb_array_length(settings->'quiet_hours_weekdays'),0)=0 then return null;end if;
 local_time:=at_time at time zone tz;
 for day in select (local_time::date-i)::date from generate_series(0,1) i loop
  if not coalesce(settings->'quiet_hours_weekdays' @> to_jsonb(array[extract(isodow from day)::int]),false) then continue;end if;
  finish:=(day+end_time+case when end_time<start_time then interval '1 day' else interval '0' end) at time zone tz;
  if at_time>=(day+start_time) at time zone tz and at_time<finish then
   return greatest(at_time,finish);
  end if;
 end loop;
 return at_time;
end$$;
create function private.reminder_settings(org uuid,center uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with template as(select private.frontend_settings_defaults('organization')||coalesce((select values from private.frontend_settings where scope_key='organization:'||$1),'{}') v)
 select v||case when private.current_plan_name($1)='business' and (v->>'reminder_center_overrides_enabled')::bool then
 coalesce((select jsonb_object_agg(key,value) from private.frontend_settings s cross join lateral jsonb_each(s.values) where s.scope_key='center:'||$1||':'||$2 and key in ('lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days')),'{}') else '{}'::jsonb end from template
$$;
create function private.reminder_member_allowed(org uuid,person uuid,kind text) returns boolean language sql stable security invoker set search_path='' as $$
 select private.p05_optional_allowed($1,$2,'reminder') and coalesce((select (s.values->>(case $3 when 'lesson' then 'lesson_reminders_enabled' when 'event' then 'lesson_reminders_enabled' when 'entitlement' then 'package_reminders_enabled' when 'payment' then 'payment_reminders_enabled' end))::bool from core.account_links l join private.frontend_settings s on s.scope_key='member:'||$1||':'||l.account_id where l.org_id=$1 and l.person_id=$2 and l.state='active' and l.verified_at is not null order by l.created_at,l.id limit 1),true)
$$;
-- A closed source projection is shared by scheduling, execution and email
-- authorization. All calendar-day offsets use the source center's time zone.
create function private.reminder_context(org uuid,center uuid,person uuid,kind text,target uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare cfg jsonb:=private.reminder_settings(org,center);tz text;expires timestamptz;due timestamptz;ver text;subject text;title text;enabled bool;
begin
 if not private.center_accessible(org,center) or not private.reminder_member_allowed(org,person,kind) then return null;end if;
 select timezone into tz from core.centers where org_id=org and id=center and state='active';if tz is null then return null;end if;
 if kind='lesson' then
  select s.starts_at,r.version::text||':'||s.version::text into expires,ver from core.reservations r join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.center_id=center and r.person_id=person and r.id=target and r.state='active' and s.state='planned' and s.actual_started_at is null;
  subject:='reservations';title:='Ders hatırlatması';enabled:=(cfg->>'lesson_reminders_enabled')::bool;due:=expires-make_interval(hours=>(cfg->>'lesson_reminder_hours')::int);
 elsif kind='event' then
  begin perform private.require_feature(org,'F29');exception when sqlstate 'P0001' then if sqlerrm='PLAN_FEATURE_UNAVAILABLE' then return null;end if;raise;end;
  select e.starts_at,r.version::text||':'||e.version::text into expires,ver from core.event_registrations r join core.events e on e.org_id=r.org_id and e.id=r.event_id where r.org_id=org and r.center_id=center and r.person_id=person and r.id=target and r.state='active' and e.state='published' and e.actual_started_at is null;
  subject:='event_registrations';title:='Etkinlik hatırlatması';enabled:=(cfg->>'lesson_reminders_enabled')::bool;due:=expires-make_interval(hours=>(cfg->>'lesson_reminder_hours')::int);
 elsif kind='entitlement' then
  select s.valid_until,s.version::text into expires,ver from core.sales s where s.org_id=org and s.center_id=center and s.person_id=person and s.id=target and s.state='active' and not exists(select 1 from core.sales n where n.org_id=org and n.previous_sale_id=s.id and n.state='active');
  subject:='sales';title:='Paket bitişi hatırlatması';enabled:=(cfg->>'package_reminders_enabled')::bool;due:=((expires at time zone tz)-make_interval(days=>(cfg->>'package_reminder_days')::int)) at time zone tz;
 elsif kind='payment' then
  select d.due_at,d.version::text into expires,ver from core.debts d where d.org_id=org and d.center_id=center and d.person_id=person and d.id=target and d.state='open' and private.debt_remaining(org,d.id)>0;
  subject:='debts';title:='Ödeme vadesi hatırlatması';enabled:=(cfg->>'payment_reminders_enabled')::bool;due:=((expires at time zone tz)-make_interval(days=>(cfg->>'payment_reminder_days')::int)) at time zone tz;
 else return null;end if;
 if not coalesce(enabled,false) or expires is null or expires<=clock_timestamp() or not private.p07_due_allowed(org,due) then return null;end if;
 ver:=extract(epoch from expires)::text;
 return jsonb_build_object('center_id',center,'version',1,'source_version',ver,'due_at',due,'expires_at',expires,'title',title,'subject_type',subject,'kind',kind,'target_id',target);
end$$;
create function private.reminder_settings_validate(r jsonb,v jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 if r->>'scope'='user' and v->>'quiet_hours_enabled'='true' and (v->>'quiet_hours_start' is null or v->>'quiet_hours_end' is null or v->>'quiet_hours_start'=v->>'quiet_hours_end' or coalesce(jsonb_array_length(v->'quiet_hours_weekdays'),0)=0 or v->>'timezone_name' is null or not exists(select 1 from pg_timezone_names where name=v->>'timezone_name')) then perform private.fail('VALIDATION_FAILED');end if;
end$$;
create function private.reminder_field_writable(scope text,key text,org uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select case when $2 not in ('lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days','reminder_center_overrides_enabled') then true
 when not private.reminder_licensed($3) then false
 when $1='center' then private.current_plan_name($3)='business' and coalesce((select (values->>'reminder_center_overrides_enabled')::bool from private.frontend_settings where scope_key='organization:'||$3),false)
 else true end
$$;
create table private.reminder_reset_versions(preview_id uuid primary key references private.frontend_settings_previews(id),org_id uuid not null references core.organizations(id),organization_version bigint not null);
alter table private.reminder_reset_versions enable row level security;
revoke all on private.reminder_reset_versions from public,anon,authenticated;
grant select,insert on private.reminder_reset_versions to service_role;
create function private.reminder_reset_defaults(r jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.frontend_settings_defaults($1->>'scope')||case when $1->>'scope'='center' then
 coalesce((select jsonb_object_agg(key,value) from jsonb_each(private.frontend_settings_defaults('organization')||coalesce((select values from private.frontend_settings where scope_key='organization:'||($1->>'org_id')::uuid),'{}')) where key in ('lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days')),'{}') else '{}'::jsonb end
$$;
-- Settings stay on the existing versioned update/reset/history surface.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_settings_field_access(text,jsonb,uuid,uuid)'::regprocedure);
 a:='  if scope=''organization'' and key like ''billing_%''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder field authority anchor drift';end if;
 execute replace(b,a,$a$  if key in ('lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days','reminder_center_overrides_enabled') and scope in ('organization','center','member') then
   perform private.require_feature(org,'F27');
   if private.current_plan_name(org) not in ('pro','business') then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
   if scope='center' and (private.current_plan_name(org)<>'business' or not coalesce((select (values->>'reminder_center_overrides_enabled')::bool from private.frontend_settings where scope_key='organization:'||org),false)) then perform private.fail('FORBIDDEN');end if;
  end if;
$a$||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='perform private.frontend_settings_patch(r,patch,person);';
 if strpos(b,a)=0 then raise exception 'Quiet effective validation anchor drift';end if;
 execute replace(b,a,a||'perform private.reminder_settings_validate(r,before||patch);');
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='private.frontend_settings_defaults(r->>''scope'')->field';
 if array_length(string_to_array(b,a),1)<>3 then raise exception 'Reminder inherited reset default drift';end if;
 b:=replace(b,a,'private.reminder_reset_defaults(r)->field');
 a:='  return jsonb_build_object(''id'',pid,''token'',token,';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder reset parent snapshot drift';end if;
 b:=replace(b,a,$a$  if r->>'scope'='center' and exists(select 1 from jsonb_array_elements_text(keys) k where k like '%reminder%') then
   insert into private.reminder_reset_versions values(pid,org,coalesce((select version from private.frontend_settings where scope_key='organization:'||org),0));
  end if;
$a$||a);
 a:='  keys:=p.fields;patch:=';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder reset parent validation drift';end if;
 b:=replace(b,a,$a$  if exists(select 1 from private.reminder_reset_versions z where z.preview_id=p.id and z.organization_version<>coalesce((select version from private.frontend_settings where scope_key='organization:'||org),0)) then perform private.fail('PREVIEW_STALE');end if;
$a$||a);execute b;
 b:=pg_get_functiondef('private.frontend_settings_view(jsonb,uuid,uuid)'::regprocedure);
 a:='ver:=coalesce(doc.version,0);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder settings inheritance view drift';end if;
 execute replace(b,a,a||$a$
 if r->>'scope'='center' then
  if not private.reminder_field_writable('center','lesson_reminder_hours',org) then doc.values:=doc.values-array['lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days'];end if;
  values:=values||(select jsonb_object_agg(key,value) from jsonb_each(private.reminder_settings(org,(r->>'center_id')::uuid)) where key in ('lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days'));
 end if;
$a$);
 b:=pg_get_functiondef('private.notification_delivery_support(uuid)'::regprocedure);
 b:=replace(b,'''timing_controls_available'',false','''timing_controls_available'',reminders');
 b:=replace(b,'''quiet_hours'',jsonb_build_object(''controls_available'',false','''quiet_hours'',jsonb_build_object(''controls_available'',org is null or reminders');execute b;
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''writable'',(';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder writable descriptor drift';end if;
 b:=replace(b,a,'''writable'',private.reminder_field_writable(r->>''scope'',f->>''key'',org) and (');
 a:='''catalog_version'',10';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder catalog version drift';end if;execute replace(b,a,'''catalog_version'',11');
end$patch$;
revoke all on function private.reminder_licensed(uuid),private.reminder_source_generation(uuid,text,uuid),private.reminder_reset_defaults(jsonb),private.reminder_field_writable(text,text,uuid),private.reminder_settings_validate(jsonb,jsonb),private.reminder_quiet_until(jsonb,timestamptz),private.reminder_settings(uuid,uuid),private.reminder_member_allowed(uuid,uuid,text),private.reminder_context(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.reminder_licensed(uuid),private.reminder_source_generation(uuid,text,uuid),private.reminder_reset_defaults(jsonb),private.reminder_field_writable(text,text,uuid),private.reminder_settings_validate(jsonb,jsonb),private.reminder_quiet_until(jsonb,timestamptz),private.reminder_settings(uuid,uuid),private.reminder_member_allowed(uuid,uuid,text),private.reminder_context(uuid,uuid,uuid,text,uuid) to service_role;
commit;
