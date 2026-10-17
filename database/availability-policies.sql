-- Append-only configuration APIs; all commands share the existing organization lock.
begin;
create or replace function private.policy_at(org uuid,center uuid,k text,at_time timestamptz)
returns core.policy_versions language sql stable security invoker set search_path='' as $$
 with current_scopes as (
  select distinct on (scope_center_id) p.* from core.policy_versions p
  where p.org_id=org and p.key=k and p.effective_at<=at_time and (p.scope_center_id is null or p.scope_center_id=center)
  order by scope_center_id,effective_at desc,version desc,id desc
 ) select p.* from current_scopes p order by (p.scope_center_id is null and p.mandatory) desc,(p.scope_center_id is not null) desc limit 1
$$;
create or replace function private.assert_availability(org uuid,center uuid,kind text,resource uuid,starts timestamptz,ends timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare tz text;ls timestamp;le timestamp;
begin
 if starts>=ends then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from core.availability_exceptions x where x.org_id=org and x.center_id=center and x.resource_kind=kind and x.resource_id=resource and x.starts_at<ends and x.ends_at>starts) then perform private.fail('RESOURCE_CONFLICT');end if;
 -- No implicit working-hours value is fabricated. An unconfigured resource needs setup.
 if not exists(select 1 from core.availability_rules a where a.org_id=org and a.center_id=center and a.resource_kind=kind and a.resource_id=resource) then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 select timezone into tz from core.centers c where c.org_id=org and c.id=center;
 ls:=starts at time zone tz;le:=ends at time zone tz;
 if not exists(select 1 from core.availability_rules a where a.org_id=org and a.center_id=center and a.resource_kind=kind and a.resource_id=resource
  and ls::date=le::date and extract(isodow from ls)=any(a.weekdays)
  and ls::date>=a.valid_from and (a.valid_until is null or ls::date<a.valid_until)
  and ls::time>=a.local_start::time and le::time<=a.local_end::time
) then perform private.fail('RESOURCE_CONFLICT');end if;
end$$;
create or replace function private.assert_resource(org uuid,center uuid,kind text,resource uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if kind='room' then
  if not exists(select 1 from core.rooms x where x.org_id=org and x.center_id=center and x.id=resource) then perform private.fail('NOT_FOUND');end if;
 elsif kind='person' then
  if not exists(select 1 from core.people x where x.org_id=org and x.id=resource and x.state='active') or not exists(select 1 from core.center_relationships x where x.org_id=org and x.center_id=center and x.person_id=resource and x.state='active') then perform private.fail('NOT_FOUND');end if;
 else perform private.fail('VALIDATION_FAILED');end if;
end$$;
create or replace function private.validate_policy(k text,v jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare expected text;
begin
 expected:=case
 when k in ('student_cancel_private','student_cancel_group') then 'cancellation'
 when k in ('reservation_window','request_window') then 'window'
 when k in ('debt_booking','debt_participation','freeze_default') then 'boolean'
 when k='participation_block_credit' then 'blocked_credit'
 when k='negative_valuation' then 'valuation'
 when k='mandatory_document' then 'documents'
 when k in ('negative_default','negative_upper','waitlist_offer_minutes','class_reminder_hours','entitlement_reminder_days','trial_repeat_limit','inactive_student_days','sensitive_money_upper','sensitive_credit_upper') then 'integer' end;
 if expected is null or v->>'kind' is distinct from expected then perform private.fail('VALIDATION_FAILED');end if;
 if expected='window' and (v->>'opens_minutes_before')::bigint<(v->>'closes_minutes_before')::bigint then perform private.fail('VALIDATION_FAILED');end if;
end$$;
do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;new text;
begin
 old:=$o$elsif perm_code='center.manager.assign' then$o$;
 new:=$n$elsif perm_code='policy.manage' then
  if center is null then if not org_reader then perform private.fail('FORBIDDEN');end if;
  elsif not cm and not org_reader then perform private.fail('FORBIDDEN');end if;
 elsif perm_code='center.manager.assign' then$n$;
 if strpos(body,old)=0 then raise exception 'permission anchor missing';end if;body:=replace(body,old,new);
 old:=$o$ -- DOMAIN_CASES$o$;
 new:=$n$
 when 'availability_save_v1' then
  perform private.assert_resource(org,center,r#>>'{resource,kind}',(r#>>'{resource,id}')::uuid);
  if (r#>>'{rule,local_start}')!~'^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$' or (r#>>'{rule,local_end}')!~'^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'
   or r#>>'{rule,local_start}'>=r#>>'{rule,local_end}' or (r#>>'{rule,valid_until}')::date<=(r#>>'{rule,valid_from}')::date then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'rule_id' is null then
   if r ? 'expected_version' then perform private.fail('VERSION_CONFLICT');end if;
   insert into core.availability_rules(id,org_id,center_id,resource_kind,resource_id,weekdays,local_start,local_end,valid_from,valid_until)
   values(record_id,org,center,r#>>'{resource,kind}',(r#>>'{resource,id}')::uuid,array(select jsonb_array_elements_text(r#>'{rule,weekdays}')::bigint),r#>>'{rule,local_start}',r#>>'{rule,local_end}',(r#>>'{rule,valid_from}')::date,(r#>>'{rule,valid_until}')::date);
  else
   record_id:=(r->>'rule_id')::uuid;
   select * into row_record from core.availability_rules where org_id=org and center_id=center and id=record_id and resource_kind=r#>>'{resource,kind}' and resource_id=(r#>>'{resource,id}')::uuid for update;
   if not found then perform private.fail('NOT_FOUND');end if;
   if row_record.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   audit_delta:=jsonb_build_object('before',to_jsonb(row_record),'after',r->'rule');
   update core.availability_rules set weekdays=array(select jsonb_array_elements_text(r#>'{rule,weekdays}')::bigint),local_start=r#>>'{rule,local_start}',local_end=r#>>'{rule,local_end}',valid_from=(r#>>'{rule,valid_from}')::date,valid_until=(r#>>'{rule,valid_until}')::date,version=version+1 where id=record_id returning version into version_n;
  end if;subject:='availability_rules';
 when 'availability_exception_save_v1' then
  perform private.assert_resource(org,center,r#>>'{resource,kind}',(r#>>'{resource,id}')::uuid);
  if (r#>>'{interval,starts_at}')::timestamptz>=(r#>>'{interval,ends_at}')::timestamptz or length(btrim(r->>'reason'))=0 then perform private.fail('VALIDATION_FAILED');end if;
  -- This command appends an exception and versions the selected center configuration aggregate.
  update core.centers set version=version+1 where org_id=org and id=center and version=(r->>'expected_version')::bigint returning version into version_n;
  if not found then perform private.fail('VERSION_CONFLICT');end if;
  insert into core.availability_exceptions(id,org_id,center_id,resource_kind,resource_id,starts_at,ends_at,reason)
   values(record_id,org,center,r#>>'{resource,kind}',(r#>>'{resource,id}')::uuid,(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,r->>'reason');subject:='availability_exceptions';
 when 'policy_publish_v1' then
  perform private.validate_policy(r->>'key',r->'value');
  if center is not null then
   select * into plan from core.saas_plan_versions where id=(select plan_version_id from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1);
   if plan.name<>'business' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
   select * into row_record from private.policy_at(org,null,r->>'key',(r->>'effective_at')::timestamptz);
   if row_record.id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   if row_record.mandatory or coalesce((select p.mandatory from private.policy_at(org,null,r->>'key',clock_timestamp()) p),false) or (r->>'mandatory')::bool then perform private.fail('FORBIDDEN');end if;
 
  end if;
  if r#>>'{value,kind}'='valuation' and not exists(select 1 from core.disciplines where org_id=org and id=(r#>>'{value,discipline_id}')::uuid and state='active') then perform private.fail('NOT_FOUND');end if;
  select * into row_record from core.policy_versions p where p.org_id=org and p.scope_center_id is not distinct from center and p.key=r->>'key' order by p.version desc,p.created_at desc,p.id desc limit 1;
  linked:=row_record.id;version_n:=coalesce(row_record.version,0)+1;
  insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value,previous_id,version)
   values(record_id,org,center,r->>'key',(r->>'effective_at')::timestamptz,(r->>'mandatory')::bool,r->'value',linked,version_n);
  audit_delta:=jsonb_build_object('before',to_jsonb(row_record),'after',r-'request_id'-'operation_key');subject:='policy_versions';
 when 'policies_get_v1' then
  if not org_reader and not cm then perform private.fail('FORBIDDEN');end if;
  select coalesce(jsonb_agg(jsonb_build_object('key',x.key,'scope',case when x.scope_center_id is null then jsonb_build_object('kind','organization') else jsonb_build_object('kind','center','center_id',x.scope_center_id) end,'value',x.value,'effective_at',x.effective_at,'mandatory',x.mandatory,'version',x.version) order by x.key),'[]'::jsonb) into out
   from (select p.* from (select distinct p.key from core.policy_versions p where p.org_id=org and (jsonb_array_length(r->'keys')=0 or p.key in(select jsonb_array_elements_text(r->'keys')))) k cross join lateral private.policy_at(org,center,k.key,clock_timestamp()) p where p.id is not null) x;
 -- DOMAIN_CASES$n$;
 if strpos(body,old)=0 then raise exception 'domain anchor missing';end if;body:=replace(body,old,new);
 -- Existing session writes must consult configured resource availability before booking.
 old:=$o$for entry in select * from jsonb_array_elements(r->'resources') loop$o$;
 new:=$n$for entry in select * from jsonb_array_elements(r->'resources') loop
   perform private.assert_resource(org,center,entry->>'kind',(entry->>'id')::uuid);
   perform private.assert_availability(org,center,entry->>'kind',(entry->>'id')::uuid,(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz);$n$;
 if strpos(body,old)=0 then raise exception 'resources anchor missing';end if;body:=replace(body,old,new);
 old:=$o$select id into policy from core.policy_versions where org_id=org and (scope_center_id is null or scope_center_id=center) and key=case when ses.format='private' then 'student_cancel_private' else 'student_cancel_group' end and effective_at<=now() order by mandatory desc,scope_center_id nulls last,effective_at desc,id limit 1;$o$;
 new:=$n$select p.id into policy from private.policy_at(org,center,case when ses.format='private' then 'student_cancel_private' else 'student_cancel_group' end,clock_timestamp()) p;$n$;
 if strpos(body,old)=0 then raise exception 'reservation policy anchor missing';end if;body:=replace(body,old,new);
 -- Cancellation still uses its stored policy ID, including legacy flattened cancellation rows.
 old:=$o$select value into terms from core.policy_versions where id=row_record.policy_version_id and org_id=org;$o$;
 new:=old||$n$
  terms:=coalesce(terms->'terms',terms);$n$;
 if strpos(body,old)=0 then raise exception 'cancel snapshot anchor missing';end if;body:=replace(body,old,new);
 old:=$o$for entry in select * from jsonb_array_elements(r->'assignments') loop$o$;
 new:=$n$for entry in select * from jsonb_array_elements(r->'assignments') loop
   if p_operation='session_create_v1' then
   perform private.assert_resource(org,center,'person',(entry->>'person_id')::uuid);
   perform private.assert_availability(org,center,'person',(entry->>'person_id')::uuid,(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz);
   end if;$n$;
 if strpos(body,old)=0 then raise exception 'assignment anchor missing';end if;body:=replace(body,old,new);
 old:=$o$target:=(r->>'person_id')::uuid;
  if not cm and not private.staff_grant(org,person,center,'reservation.write')$o$;
 new:=$n$-- Recheck resources on new reservations; old reservations are never auto-cancelled.
  for entry in select jsonb_build_object('kind',b.resource_kind,'id',b.resource_id) from core.resource_bookings b where b.org_id=org and b.session_id=ses.id and b.state='active'
   union select jsonb_build_object('kind','person','id',a.person_id) from core.session_assignments a where a.org_id=org and a.session_id=ses.id and a.state='active' loop
   perform private.assert_availability(org,center,entry->>'kind',(entry->>'id')::uuid,ses.starts_at,ses.ends_at);
  end loop;
  target:=(r->>'person_id')::uuid;
  if r->>'mode'='flexible' then
   select p.value into terms from private.policy_at(org,center,'reservation_window',clock_timestamp()) p;
   if terms is null or terms->>'kind'<>'window' then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   -- No manager-exception request/reason exists on reservation_create; it never silently bypasses the window.
   if clock_timestamp()<ses.starts_at-make_interval(mins=>(terms->>'opens_minutes_before')::int)
    or clock_timestamp()>=ses.starts_at-make_interval(mins=>(terms->>'closes_minutes_before')::int) then perform private.fail('FORBIDDEN');end if;
  end if;
  if not cm and not private.staff_grant(org,person,center,'reservation.write')$n$;
 if strpos(body,old)=0 then raise exception 'reservation guard anchor missing';end if;body:=replace(body,old,new);
 execute body;
end
$patch$;
do $consumers$
declare b text;
begin
 b:=pg_get_functiondef('private.event_consumes(uuid,uuid,text,jsonb)'::regprocedure);
 b:=replace(b,$o$select value into p from core.policy_versions where org_id=org and key='participation_block_credit' and effective_at<=now() and (scope_center_id is null or scope_center_id=center) order by (scope_center_id is not null) desc,effective_at desc,id desc limit 1;$o$,$n$select x.value into p from private.policy_at(org,center,'participation_block_credit',clock_timestamp()) x;$n$);
 execute b;
 b:=pg_get_functiondef('private.reserve_negative(uuid,uuid,uuid,uuid,uuid[],integer)'::regprocedure);
 b:=replace(b,$o$select (value->>'value')::bigint into lim from core.policy_versions where org_id=org and key='negative_default' and effective_at<=now() and (scope_center_id is null or scope_center_id=ses.center_id) order by (scope_center_id is not null) desc,effective_at desc,id desc limit 1;$o$,$n$select (p.value->>'value')::bigint into lim from private.policy_at(org,ses.center_id,'negative_default',clock_timestamp()) p;$n$);
 b:=replace(b,$o$select (value->>'value')::bigint into upper_n from core.policy_versions where org_id=org and key='negative_upper' and effective_at<=now() order by mandatory desc,effective_at desc,id desc limit 1;$o$,$n$select (p.value->>'value')::bigint into upper_n from private.policy_at(org,ses.center_id,'negative_upper',clock_timestamp()) p;$n$);
 b:=replace(b,$o$declare ses core.sessions;lim bigint;upper_n bigint;used bigint;v jsonb;$o$,$n$declare ses core.sessions;lim bigint;upper_n bigint;used bigint;v jsonb;valuation_id uuid;$n$);
 b:=replace(b,$o$select value into v from core.policy_versions where org_id=org and key='negative_valuation' and effective_at<=now() and (scope_center_id is null or scope_center_id=ses.center_id) order by (scope_center_id is not null) desc,effective_at desc,id desc limit 1;$o$,$n$select p.value,p.id into v,valuation_id from private.policy_at(org,ses.center_id,'negative_valuation',clock_timestamp()) p; if v is not null and ((v->>'discipline_id')::uuid<>ses.discipline_id or v->>'format'<>ses.format) then perform private.fail('POLICY_NOT_CONFIGURED');end if;$n$);
 b:=replace(b,$o$(select id from core.policy_versions where org_id=org and key='negative_valuation' and value=v order by effective_at desc,id desc limit 1)$o$,$n$valuation_id$n$);
 execute b;
end
$consumers$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
