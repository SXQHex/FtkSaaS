-- Single read-only, parameterized query. Bind the 50 private fixture rows as
-- $1::jsonb before and after the run. Add ACK IDs to the same rows after load.
-- Output contains counts, money totals and booleans only.
with actors as materialized (
 select * from jsonb_to_recordset($1::jsonb) a(
  account uuid,org uuid,student uuid,debt uuid,cash uuid,booked_reservation uuid,
  attendance_session uuid,attendance_reservation uuid,report_jobs uuid[]
 )
), tenants as (
 select org,count(*) as actors from actors group by org
), profile as (
 select t.*,private.current_plan_name(t.org) as plan, (select count(distinct cr.person_id) from core.center_relationships cr
  where cr.org_id=t.org and cr.kind='student' and cr.state='active') as students
 from tenants t
), reports as (
 select a.org,id from actors a cross join lateral unnest(a.report_jobs) jobs(id)
), report_states as (
 select j.state,count(distinct j.id) as jobs from reports r join core.outbox_jobs j on j.org_id=r.org and j.id=r.id
 where j.kind='p06.report' group by j.state
), finished as (
 select j.id from reports r join core.outbox_jobs j on j.org_id=r.org and j.id=r.id
 join private.p06_export_files f on f.job_id=j.id join core.files cf on cf.id=f.file_id
 where j.kind='p06.report' and j.state='succeeded' and j.attempts=1 and octet_length(f.body)>0
 and encode(sha256(f.body),'hex')=cf.checksum
)
select (select count(*) from actors) as actors,(select count(distinct account) from actors) as distinct_actors,
 (select count(*) from profile) as organizations,
 (select count(*) from profile where actors=5 and students=500 and plan='business') as tenants_matching_profile,
 (select count(distinct r.id) from reports r) as requested_report_ids,
 (select count(distinct f.id) from finished f) as completed_reports_with_verified_bytes,
 (select coalesce(jsonb_object_agg(state,jobs),'{}'::jsonb) from report_states) as report_states,
 (select count(distinct c.id) from actors a join core.cash_movements c on c.org_id=a.org and c.id=a.cash
  where c.person_id=a.student and c.currency='TRY' and c.amount_minor=1000) as expected_collections,
 (select coalesce(sum(c.amount_minor),0)::text from core.cash_movements c where c.currency='TRY'
  and exists(select 1 from actors a where a.org=c.org_id and a.cash=c.id)) as collected_try_minor,
 (select count(distinct d.id) from actors a join core.debts d on d.org_id=a.org and d.id=a.debt
  where d.person_id=a.student and private.debt_remaining(d.org_id,d.id)=0) as settled_debts,
 (select count(distinct r.id) from actors a join core.reservations r on r.org_id=a.org and r.id=a.booked_reservation
  where r.person_id=a.student and r.state='cancelled') as cancelled_reservations,
 (select count(distinct r.id) from actors a join core.reservations r on r.org_id=a.org and r.id=a.attendance_reservation
  join core.sessions s on s.org_id=a.org and s.id=r.session_id
  where s.id=a.attendance_session and s.attendance_state='closed' and r.person_id=a.student
   and (select count(*) from core.entitlement_allocations ea where ea.reservation_id=r.id and ea.state='consumed')=1) as attendances_with_one_consumption,
 (select count(*) from core.saas_payment_verifications p where p.org_id in(select org from tenants)) as subscription_collections,
 (select coalesce(sum(p.amount_minor),0)::text from core.saas_payment_verifications p where p.org_id in(select org from tenants)) as subscription_total_minor,
 (select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(p)::text,E'\n' order by p.id),''),'UTF8')),'hex')
  from core.saas_payment_verifications p where p.org_id in(select org from tenants)) as subscription_rows_sha256
