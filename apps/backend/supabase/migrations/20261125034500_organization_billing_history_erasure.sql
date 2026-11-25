begin;

create table private.organization_billing_history_erasures(
 request_id uuid primary key,org_id uuid not null,
 source_fingerprint text not null check(source_fingerprint~'^[a-f0-9]{64}$'),
 source_project_ref text not null check(source_project_ref~'^[a-z]{20}$'),
 archive_scope_sha256 text not null check(archive_scope_sha256~'^[a-f0-9]{64}$'),
 archive_sha256 text not null check(archive_sha256~'^[a-f0-9]{64}$'),
 approval_id uuid not null unique,retain_until timestamptz not null,
 worker_role name not null,attestor_role name not null check(attestor_role<>worker_role),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 permit_transaction xid8,permit_event_ids uuid[],completed_at timestamptz,erased_subject_ids uuid[],
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id),
 check((permit_transaction is null)=(permit_event_ids is null)),
 check((completed_at is null and erased_subject_ids is null) or
       (completed_at is not null and permit_transaction is null and coalesce(cardinality(erased_subject_ids),0)>0))
);
alter table private.organization_billing_history_erasures enable row level security;
revoke all on private.organization_billing_history_erasures from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger organization_billing_history_immutable before update or delete on private.organization_billing_history_erasures
 for each row when(old.completed_at is not null) execute function private.append_only();

-- Keep the general append-only audit rule. A valid permit exists only inside
-- the attestor transaction that compared the approved archive and locked rows.
create function private.organization_billing_audit_guard() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' and exists(
  select 1 from private.organization_billing_history_erasures a
  join private.p07_privacy_jobs j on j.request_id=a.request_id and j.org_id=a.org_id
  where a.org_id=old.org_id and old.id=any(a.permit_event_ids) and a.attestor_role=session_user
   and a.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
   and a.permit_transaction=pg_catalog.pg_current_xact_id_if_assigned() and a.completed_at is null
   and a.retain_until>clock_timestamp() and j.state='running' and j.lease_until>clock_timestamp()
 ) then return old;end if;
 perform private.fail('INTEGRITY_VIOLATION');
 return null;
end$$;
drop trigger runtime_append_only on core.audit_events;
create trigger runtime_append_only before update or delete on core.audit_events
 for each row execute function private.organization_billing_audit_guard();

create function private.organization_billing_history_source(target_request uuid,target_org uuid) returns jsonb
 language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare policy_request core.privacy_requests;org core.organizations;scope jsonb;selected_rows jsonb;row_fingerprint jsonb;
 operation_ids uuid[];event_ids uuid[];notification_ids uuid[];job_ids uuid[];source_ids uuid[];
 operation_count bigint;authority private.settlement_authority_versions;clear_authority boolean;fingerprint text;
 billing_operations constant text[]:=array['platform_invoice_publish_v1','platform_invoice_upload_prepare_v1','saas_payment_submit_v1','saas_payment_verify_v1'];
begin
 select * into policy_request from core.privacy_requests p where p.id=target_request and p.org_id=target_org
  and p.kind='organization_delete' and p.state in ('requested','running','partial')
  and p.scope=jsonb_build_object('kind','organization','org_id',target_org,'account_id',null,'all_data',true);
 select * into org from core.organizations where id=target_org and state='deletion_pending';
 if policy_request.id is null or org.id is null then perform private.fail('FORBIDDEN');end if;
 select count(*) into operation_count from core.operation_receipts r
 where r.org_id=target_org and r.operation=any(billing_operations);
 if operation_count=0 then return jsonb_build_object('state','blocked','reason','billing_history_missing');end if;

 with rows as (
  select r as receipt,e as event,n as notice,q as job,coalesce(i.invoice_id,e.subject_id) as source_record_id
  from core.operation_receipts r
  join core.audit_events e on e.org_id=r.org_id and e.operation_id=r.id and e.action=r.operation
  left join private.organization_invoice_erasures i
   on i.request_id=target_request and i.org_id=r.org_id and i.completed_at is not null
   and i.invoice_id::text=e.diff->>'invoice_id'
   and r.operation in ('platform_invoice_publish_v1','platform_invoice_upload_prepare_v1')
  left join private.organization_billing_erasures b
   on b.request_id=target_request and b.org_id=r.org_id and b.completed_at is not null
   and e.subject_id=any(b.payment_subject_ids)
  left join core.outbox_jobs q on q.org_id=r.org_id and q.dedupe_key=r.id::text
  left join core.notifications n on n.org_id=q.org_id and n.id=q.notification_id
  where r.org_id=target_org and r.operation=any(billing_operations) and r.state in ('succeeded','result_expired')
   and (
    (i.invoice_id is not null and e.subject_table='organizations' and e.subject_id=target_org
     and r.business_reference=target_org and e.diff=jsonb_build_object('invoice_id',i.invoice_id)
     and (r.result is null or
          case r.operation when 'platform_invoice_publish_v1' then r.result#>>'{data,id}'
                           else r.result#>>'{data,invoice_id}' end=i.invoice_id::text))
    or
    (b.request_id is not null and r.operation in ('saas_payment_submit_v1','saas_payment_verify_v1')
     and e.subject_table='saas_payment_verifications' and r.business_reference=e.subject_id
     and (r.result is null or r.result#>>'{data,primary_id}'=e.subject_id::text))
   )
   and (q.id is null or (q.kind='in_app' and q.state<>'running' and q.lease_until is null and q.provider_reference is null
    and n.id is not null and n.recipient_person_id=org.owner_person_id and n.kind=e.action and n.subject_id=e.subject_id
    and n.payload=jsonb_build_object('template_key',e.action,'subject',jsonb_build_object('type',e.subject_table,'id',e.subject_id))))
 ), archive_rows as (
  select (x.receipt).id as operation_id,(x.event).id as audit_id,x.source_record_id,(x.event).action,
   (x.event).created_at as occurred_at,(x.event).subject_id,(x.event).subject_table from rows x
 )
 select
  array(select a.operation_id from archive_rows a order by a.operation_id),
  array(select a.audit_id from archive_rows a order by a.audit_id),
  array(select (x.notice).id from rows x where (x.notice).id is not null order by (x.notice).id),
  array(select (x.job).id from rows x where (x.job).id is not null order by (x.job).id),
  array(select distinct a.source_record_id from archive_rows a order by a.source_record_id),
  (select jsonb_agg(to_jsonb(a) order by a.operation_id) from archive_rows a),
  (select jsonb_agg(to_jsonb(x) order by (x.receipt).id) from rows x)
 into operation_ids,event_ids,notification_ids,job_ids,source_ids,scope,row_fingerprint;

 if cardinality(operation_ids)<>operation_count or
  cardinality(array(select distinct id from unnest(operation_ids) id))<>operation_count then
  return jsonb_build_object('state','blocked','reason','unproved_billing_history');
 end if;
 if exists(
  select 1 from private.p06_contexts c join core.operation_receipts r on r.id=c.receipt_id
  where c.receipt_id=any(operation_ids) and (c.org_id is distinct from target_org or c.operation<>r.operation)
 ) then return jsonb_build_object('state','blocked','reason','mixed_billing_context');end if;

 if exists(select 1 from core.retention_holds h where
  (h.org_id=target_org and h.subject_id=any(array[target_request,target_org]||source_ids||operation_ids||event_ids||notification_ids||job_ids))
  or (h.org_id is null and h.subject_table='accounts' and h.subject_id=policy_request.requester_account_id)) then
  return jsonb_build_object('state','held');
 end if;
 select * into authority from private.settlement_authority_versions where org_id=target_org;
 clear_authority:=authority.org_id is not null and authority.version=1 and not exists(
  select 1 from private.settlement_grants where org_id=target_org union all
  select 1 from private.settlement_requests where org_id=target_org union all
  select 1 from private.settlement_movements where org_id=target_org union all
  select 1 from private.settlement_records where org_id=target_org union all
  select 1 from private.settlement_allocations where org_id=target_org
 );
 selected_rows:=jsonb_build_object('operations',operation_ids,'events',event_ids,
  'notifications',notification_ids,'jobs',job_ids,'clear_authority_version',clear_authority);
 fingerprint:=encode(extensions.digest(jsonb_build_array(row_fingerprint,selected_rows,to_jsonb(authority),
  (select jsonb_agg(to_jsonb(c) order by c.receipt_id) from private.p06_contexts c where c.receipt_id=any(operation_ids)))::text,'sha256'),'hex');
 return jsonb_build_object('state','ready',
  'scope',jsonb_build_object('request_id',target_request,'org_id',target_org,'events',scope),
  'source_fingerprint',fingerprint,'selected',selected_rows);
end$$;

create function private.organization_billing_history_stage(r jsonb,phase text,archive_digest text default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;a private.organization_billing_history_erasures;src jsonb;
 operation_ids uuid[];event_ids uuid[];notification_ids uuid[];job_ids uuid[];removed bigint;
begin
 if phase is null or phase not in ('prepare','confirm') then perform private.fail('FORBIDDEN');end if;
 j:=private.p07_storage_erasure_job(r);
 if phase='prepare' then perform private.p07_privacy_scope(j.org_id);
 elsif not pg_has_role(session_user,'ftk_p07_storage_attestor','member') then perform private.fail('FORBIDDEN');end if;

 select * into a from private.organization_billing_history_erasures where request_id=j.request_id and org_id=j.org_id
  and instance_id=(pg_catalog.pg_control_system()).system_identifier::text for update;
 if a.request_id is null and phase='prepare' then return jsonb_build_object('state','unbound');end if;
 if a.request_id is null or (phase='prepare' and a.worker_role<>session_user)
  or (phase='confirm' and (a.attestor_role<>session_user or archive_digest is distinct from a.archive_sha256))
  or not pg_has_role(a.worker_role,'ftk_p07_privacy_worker','member')
  or not pg_has_role(a.attestor_role,'ftk_p07_storage_attestor','member')
  or not exists(select 1 from private.p07_privacy_worker_scopes s where s.db_role=a.worker_role and s.org_id=j.org_id for share)
  then perform private.fail('FORBIDDEN');end if;
 if a.completed_at is not null then return jsonb_build_object('state','completed','archive_sha256',a.archive_sha256);end if;
 if j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp() then
  perform private.fail('OPERATION_IN_PROGRESS');
 end if;
 if a.retain_until<=clock_timestamp() then perform private.fail('FORBIDDEN');end if;

 if phase='confirm' then
  perform 1 from core.organizations where id=j.org_id and state='deletion_pending' for no key update;
  if not found then perform private.fail('FORBIDDEN');end if;
  begin
   lock table core.retention_holds,private.settlement_grants,private.settlement_requests,private.settlement_movements,
    private.settlement_records,private.settlement_allocations in share mode nowait;
   lock table core.operation_receipts,core.audit_events,core.notifications,core.outbox_jobs,
    private.p06_contexts,private.settlement_authority_versions in share row exclusive mode nowait;
  exception when lock_not_available then
   return jsonb_build_object('state','retry_wait');
  end;
 end if;

 src:=private.organization_billing_history_source(j.request_id,j.org_id);
 if src->>'state'<>'ready' then return src;end if;
 if src->>'source_fingerprint' is distinct from a.source_fingerprint then perform private.fail('BILLING_HISTORY_ARCHIVE_SOURCE_CHANGED');end if;
 if phase='prepare' then return (src-'selected')||jsonb_build_object(
  'source_project_ref',a.source_project_ref,'approval_id',a.approval_id,'retain_until',a.retain_until,
  'archive_scope_sha256',a.archive_scope_sha256,'archive_sha256',a.archive_sha256);
 end if;
 if a.retain_until<=clock_timestamp() or j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 select array(select id::uuid from jsonb_array_elements_text(src#>'{selected,operations}') as ids(id)),
  array(select id::uuid from jsonb_array_elements_text(src#>'{selected,events}') as ids(id)),
  array(select id::uuid from jsonb_array_elements_text(src#>'{selected,notifications}') as ids(id)),
  array(select id::uuid from jsonb_array_elements_text(src#>'{selected,jobs}') as ids(id))
 into operation_ids,event_ids,notification_ids,job_ids;

 delete from core.outbox_jobs where org_id=j.org_id and id=any(job_ids);
 get diagnostics removed=row_count;
 if removed<>cardinality(job_ids) then perform private.fail('INTEGRITY_VIOLATION');end if;
 delete from core.notifications where org_id=j.org_id and id=any(notification_ids);
 get diagnostics removed=row_count;
 if removed<>cardinality(notification_ids) then perform private.fail('INTEGRITY_VIOLATION');end if;
 update private.organization_billing_history_erasures set permit_transaction=pg_catalog.pg_current_xact_id(),permit_event_ids=event_ids
 where request_id=j.request_id;
 delete from core.audit_events where org_id=j.org_id and id=any(event_ids);
 get diagnostics removed=row_count;
 if removed<>cardinality(event_ids) then perform private.fail('INTEGRITY_VIOLATION');end if;
 delete from private.p06_contexts where org_id=j.org_id and receipt_id=any(operation_ids);
 delete from core.operation_receipts where org_id=j.org_id and id=any(operation_ids);
 get diagnostics removed=row_count;
 if removed<>cardinality(operation_ids) then perform private.fail('INTEGRITY_VIOLATION');end if;
 if src#>'{selected,clear_authority_version}'='true'::jsonb then
  delete from private.settlement_authority_versions where org_id=j.org_id and version=1;
  if not found then perform private.fail('INTEGRITY_VIOLATION');end if;
 end if;
 set constraints all immediate;
 if j.lease_until<=clock_timestamp() or a.retain_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 update private.organization_billing_history_erasures
 set completed_at=clock_timestamp(),permit_transaction=null,permit_event_ids=null,
  erased_subject_ids=operation_ids||event_ids||notification_ids||job_ids where request_id=j.request_id;
 return jsonb_build_object('state','completed','archive_sha256',a.archive_sha256);
end$$;

revoke all on function private.organization_billing_audit_guard(),private.organization_billing_history_source(uuid,uuid),
 private.organization_billing_history_stage(jsonb,text,text)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
grant execute on function private.organization_billing_history_stage(jsonb,text,text) to ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$  when 'private.organization_billing_erasures'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Billing history DB footprint anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_billing_history_erasures' then 'r.request_id=$6 and r.org_id=$2 and r.completed_at is not null'
$q$||anchor);

 body:=pg_get_functiondef('private.organization_live_database_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}');$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Billing history DB scope anchor mismatch';end if;
 execute replace(body,anchor,$q$    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}')
  ||coalesce((select a.erased_subject_ids from private.organization_billing_history_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}');$q$);
end$patch$;
commit;
