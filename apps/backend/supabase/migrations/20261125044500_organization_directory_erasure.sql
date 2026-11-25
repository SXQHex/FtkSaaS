begin;

create table private.organization_directory_erasures(
 request_id uuid primary key,org_id uuid not null,
 source_fingerprint text not null check(source_fingerprint~'^[a-f0-9]{64}$'),
 source_project_ref text not null check(source_project_ref~'^[a-z]{20}$'),
 archive_scope_sha256 text not null check(archive_scope_sha256~'^[a-f0-9]{64}$'),
 archive_sha256 text not null check(archive_sha256~'^[a-f0-9]{64}$'),
 approval_id uuid not null unique,retain_until timestamptz not null,
 worker_role name not null,attestor_role name not null check(attestor_role<>worker_role),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 permit_transaction xid8,permit_rows jsonb,completed_at timestamptz,erased_subject_ids uuid[],
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id),
 check((permit_transaction is null)=(permit_rows is null)),
 check((completed_at is null and erased_subject_ids is null) or
       (completed_at is not null and permit_transaction is null and coalesce(cardinality(erased_subject_ids),0)>0))
);
alter table private.organization_directory_erasures enable row level security;
revoke all on private.organization_directory_erasures from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger organization_directory_erasure_immutable before update or delete on private.organization_directory_erasures
 for each row when(old.completed_at is not null) execute function private.append_only();

create function private.organization_directory_history_delete_permitted(kind text,row_id uuid,row_org uuid,settings_scope text default null)
 returns boolean language sql volatile security invoker set search_path='' as $$
 select exists(
  select 1 from private.organization_directory_erasures a
  join private.p07_privacy_jobs j on j.request_id=a.request_id and j.org_id=a.org_id
  where (row_org=a.org_id or (settings_scope is not null and (a.permit_rows->'settings')?settings_scope))
   and (a.permit_rows->kind)?row_id::text and a.attestor_role=session_user
   and a.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
   and a.permit_transaction=pg_catalog.pg_current_xact_id_if_assigned() and a.completed_at is null
   and a.retain_until>clock_timestamp() and j.state='running' and j.lease_until>clock_timestamp()
 )
$$;

create function private.organization_directory_settings_history_guard() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' and private.organization_directory_history_delete_permitted('settings_history',old.id,null,old.scope_key)
 then return old;end if;
 perform private.fail('INTEGRITY_VIOLATION');
 return null;
end$$;
drop trigger frontend_settings_history_immutable on private.frontend_settings_history;
create trigger frontend_settings_history_immutable before update or delete on private.frontend_settings_history
 for each row execute function private.organization_directory_settings_history_guard();

do $audit$
declare body text;anchor text:=' if tg_op=''DELETE'' and exists(';
begin
 body:=pg_get_functiondef('private.organization_billing_audit_guard()'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory audit guard anchor mismatch';end if;
 execute replace(body,anchor,$q$ if tg_op='DELETE' and private.organization_directory_history_delete_permitted('events',old.id,old.org_id)
 then return old;end if;
$q$||anchor);
end$audit$;

-- Only reviewed subjects can be detached from the live operation history.
create function private.organization_directory_operation_subject(operation text) returns text
 language sql immutable security invoker set search_path='' as $$
 select case operation
  when 'availability_save_v1' then 'availability_rules'
  when 'center_create_v1' then 'centers'
  when 'center_discipline_set_v1' then 'center_disciplines'
  when 'center_manager_assign_v1' then 'role_assignments'
  when 'class_save_v1' then 'classes'
  when 'discipline_save_v1' then 'disciplines'
  when 'document_accept_v1' then 'document_acceptances'
  when 'document_upload_prepare_v1' then 'files'
  when 'document_version_publish_v1' then 'document_versions'
  when 'file_upload_complete_v1' then 'files'
  when 'person_create_v1' then 'people'
  when 'product_publish_v1' then 'product_versions'
  when 'role_assign_v1' then 'role_assignments'
  when 'room_save_v1' then 'rooms'
  when 'sale_apply_v1' then 'sales'
  when 'sale_terminate_apply_v1' then 'sales'
  when 'settings_update_v1' then 'accounts'
  when 'student_activate_v1' then 'center_relationships'
 end
$$;

create function private.organization_directory_archive_source(target_request uuid,target_org uuid) returns jsonb
 language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare policy_request core.privacy_requests;organization core.organizations;owner_link uuid;
 root_ops uuid[];ops uuid[];events uuid[];notice_ids uuid[];job_ids uuid[];
 sale_subjects uuid[];document_subjects uuid[];setting_keys text[];
 selected jsonb;fingerprint text;scope jsonb;counts jsonb;
begin
 select * into policy_request from core.privacy_requests p where p.id=target_request and p.org_id=target_org
  and p.kind='organization_delete' and p.state in ('requested','running','partial')
  and p.scope=jsonb_build_object('kind','organization','org_id',target_org,'account_id',null,'all_data',true);
 select * into organization from core.organizations where id=target_org and state='deletion_pending';
 if policy_request.id is null or organization.id is null then perform private.fail('FORBIDDEN');end if;
 select l.id into owner_link from core.account_links l join core.accounts a on a.id=l.account_id and a.state='active'
 where l.org_id=target_org and l.person_id=organization.owner_person_id and l.account_id=policy_request.requester_account_id
  and l.state='active' and l.verified_at is not null;
 if owner_link is null then perform private.fail('INTEGRITY_VIOLATION');end if;

 if exists(select 1 from core.retention_holds h where h.org_id=target_org or (
  h.org_id is null and h.subject_table in ('accounts','core.accounts','users','auth.users')
  and exists(select 1 from core.account_links l join core.accounts a on a.id=l.account_id
   where l.org_id=target_org and h.subject_id in (a.id,a.auth_user_id))
 )) then return jsonb_build_object('state','held');end if;

 -- Domain stages and the file census must already have processed their live
 -- sources. This archive handles only the remaining directory and audit data.
 if not exists(select 1 from private.organization_managed_file_erasure_receipts where request_id=target_request and org_id=target_org)
  or exists(select 1 from core.sales where org_id=target_org)
  or exists(select 1 from core.documents where org_id=target_org)
  or exists(select 1 from private.platform_invoices where org_id=target_org)
  or exists(select 1 from core.saas_payment_verifications where org_id=target_org)
  or exists(select 1 from core.saas_subscriptions s where s.org_id=target_org and not (
   s.state='pending_payment' and s.cancel_at_period_end and s.starts_at is null and s.period_end is null and s.grace_until is null))
 then return jsonb_build_object('state','blocked','reason','open_domain_erasure');end if;

 sale_subjects:=coalesce((select a.erased_subject_ids from private.organization_sale_erasures a
  where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}');
 document_subjects:=coalesce((select a.erased_subject_ids from private.organization_signed_document_erasures a
  where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}');

 root_ops:=array(select r.id from core.operation_receipts r where r.org_id=target_org and r.state='succeeded'
  and ((r.operation in ('privacy_execute_v1','organization_delete_apply_v1') and r.business_reference=target_request)
   or (r.operation='organization_create_v1' and r.business_reference=target_org
    and r.result#>>'{data,primary_id}'=target_org::text)));
 ops:=array(select r.id from core.operation_receipts r where r.org_id=target_org and not r.id=any(root_ops) order by r.id);
 events:=array(select e.id from core.audit_events e where e.org_id=target_org and e.operation_id=any(ops) order by e.id);
 if cardinality(ops)=0 then return jsonb_build_object('state','blocked','reason','directory_history_missing');end if;
 if cardinality(events)<>cardinality(ops) or exists(
   select 1 from core.audit_events e where e.org_id=target_org and not e.id=any(events)
    and (e.operation_id is null or not e.operation_id=any(root_ops))
 ) or exists(
  select 1 from core.operation_receipts r
  left join core.audit_events e on e.org_id=r.org_id and e.operation_id=r.id
  where r.id=any(ops) and (
   r.state not in ('succeeded','result_expired') or e.action is distinct from r.operation
   or private.organization_directory_operation_subject(r.operation) is distinct from e.subject_table
   or e.subject_id is distinct from r.business_reference
   or case e.subject_table
     when 'document_acceptances' then not e.subject_id=any(document_subjects)
     when 'document_versions' then not e.subject_id=any(document_subjects)
     when 'files' then not e.subject_id=any(document_subjects)
     when 'sales' then not e.subject_id=any(sale_subjects)
     when 'product_versions' then not e.subject_id=any(sale_subjects)
     when 'accounts' then not exists(select 1 from private.frontend_settings_history x where x.operation_id=r.id
       and x.actor_account_id=r.actor_account_id and x.actor_account_id=e.subject_id
       and (x.scope_key='organization:'||target_org or x.scope_key like 'center:'||target_org||':%'
        or x.scope_key like 'member:'||target_org||':%'))
     when 'availability_rules' then not exists(select 1 from core.availability_rules x where x.org_id=target_org and x.id=e.subject_id)
     when 'centers' then not exists(select 1 from core.centers x where x.org_id=target_org and x.id=e.subject_id)
     when 'center_disciplines' then not exists(select 1 from core.center_disciplines x where x.org_id=target_org and x.id=e.subject_id)
     when 'center_relationships' then not exists(select 1 from core.center_relationships x where x.org_id=target_org and x.id=e.subject_id)
     when 'role_assignments' then not exists(select 1 from core.role_assignments x where x.org_id=target_org and x.id=e.subject_id)
     when 'classes' then not exists(select 1 from core.classes x where x.org_id=target_org and x.id=e.subject_id)
     when 'disciplines' then not exists(select 1 from core.disciplines x where x.org_id=target_org and x.id=e.subject_id)
     when 'people' then not exists(select 1 from core.people x where x.org_id=target_org and x.id=e.subject_id)
     when 'rooms' then not exists(select 1 from core.rooms x where x.org_id=target_org and x.id=e.subject_id)
     else true end
  )
 ) then return jsonb_build_object('state','blocked','reason','unproved_directory_history');end if;

 select array(select s.scope_key from private.frontend_settings s
  where (s.scope='organization' and s.scope_key='organization:'||target_org)
   or (s.scope='center' and exists(select 1 from core.centers c where c.org_id=target_org and s.scope_key='center:'||target_org||':'||c.id))
   or (s.scope='member' and s.scope_key~('^member:'||target_org||':[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'))
  order by s.scope_key) into setting_keys;
 if exists(select 1 from private.frontend_settings_history h
  where (h.operation_id=any(ops)) is distinct from (h.scope_key=any(setting_keys)))
  or exists(select 1 from private.p06_contexts c where c.receipt_id=any(ops))
  or exists(select 1 from private.frontend_settings_previews v where v.scope_key=any(setting_keys))
 then return jsonb_build_object('state','blocked','reason','unproved_directory_settings');end if;

 with selected_queue as (
  select q.id,q.notification_id from core.outbox_jobs q
  join core.notifications n on n.org_id=q.org_id and n.id=q.notification_id
  join core.audit_events e on e.org_id=q.org_id and e.id=any(events)
   and n.kind=e.action and n.subject_id=e.subject_id
  where q.org_id=target_org and q.kind='in_app' and q.state<>'running' and q.lease_until is null and q.provider_reference is null
   and exists(select 1 from core.people p where p.org_id=target_org and p.id=n.recipient_person_id)
   and n.payload=jsonb_build_object('template_key',e.action,'subject',jsonb_build_object('type',e.subject_table,'id',e.subject_id))
   and (q.dedupe_key=e.operation_id::text or (e.action='sale_terminate_apply_v1'
    and q.dedupe_key=e.operation_id||':'||n.recipient_person_id||':'||n.subject_id))
 )
 select array(select q.id from selected_queue q order by q.id),
  array(select distinct q.notification_id from selected_queue q order by q.notification_id)
 into job_ids,notice_ids;
 if exists(select 1 from core.outbox_jobs q where q.org_id=target_org and not q.id=any(job_ids)
  and not exists(select 1 from unnest(root_ops) id where q.dedupe_key=id::text))
  or exists(select 1 from core.notifications n where n.org_id=target_org and not n.id=any(notice_ids)
   and not exists(select 1 from core.audit_events e where e.org_id=target_org and e.operation_id=any(root_ops)
     and e.action=n.kind and e.subject_id=n.subject_id))
  or exists(select 1 from core.outbox_jobs q where q.notification_id=any(notice_ids) and not q.id=any(job_ids))
 then return jsonb_build_object('state','blocked','reason','unproved_directory_queue');end if;

 -- Snapshot only owned rows. Raw values contribute to a digest and stay out
 -- of the archive, which carries only reviewed critical audit evidence.
 with sources(kind,id,body) as (
  select 'links',l.id::text,to_jsonb(l) from core.account_links l where l.org_id=target_org and l.id<>owner_link
  union all select 'events',e.id::text,to_jsonb(e) from core.audit_events e where e.id=any(events)
  union all select 'operations',r.id::text,to_jsonb(r) from core.operation_receipts r where r.id=any(ops)
  union all select 'notices',n.id::text,to_jsonb(n) from core.notifications n where n.id=any(notice_ids)
  union all select 'jobs',q.id::text,to_jsonb(q) from core.outbox_jobs q where q.id=any(job_ids)
  union all select 'availability',r.id::text,to_jsonb(r) from core.availability_rules r where r.org_id=target_org
  union all select 'center_disciplines',r.id::text,to_jsonb(r) from core.center_disciplines r where r.org_id=target_org
  union all select 'relationships',r.id::text,to_jsonb(r) from core.center_relationships r where r.org_id=target_org
  union all select 'centers',r.id::text,to_jsonb(r) from core.centers r where r.org_id=target_org
  union all select 'classes',r.id::text,to_jsonb(r) from core.classes r where r.org_id=target_org
  union all select 'disciplines',r.id::text,to_jsonb(r) from core.disciplines r where r.org_id=target_org
  union all select 'roles',r.id::text,to_jsonb(r) from core.role_assignments r where r.org_id=target_org
  union all select 'rooms',r.id::text,to_jsonb(r) from core.rooms r where r.org_id=target_org
  union all select 'center_origins',r.center_id::text,to_jsonb(r) from private.center_preparation_origins r where r.org_id=target_org
  union all select 'person_origins',r.person_id::text,to_jsonb(r) from private.person_origins r where r.org_id=target_org
  union all select 'settings',s.scope_key,to_jsonb(s) from private.frontend_settings s where s.scope_key=any(setting_keys)
  union all select 'settings_history',s.id::text,to_jsonb(s) from private.frontend_settings_history s where s.scope_key=any(setting_keys)
  union all select 'uploads',r.org_id::text,to_jsonb(r) from private.p05_upload_configuration r where r.org_id=target_org
  union all select 'subscriber_numbers',r.number::text,to_jsonb(r) from private.subscriber_numbers r where r.org_id=target_org
  union all select 'subscriber_counter',r.org_id::text,to_jsonb(r) from private.subscriber_counters r where r.org_id=target_org
 ), groups as (
  select kind,jsonb_agg(id order by id) ids,count(*) n,
   encode(extensions.digest(jsonb_agg(body order by id)::text,'sha256'),'hex') digest
  from sources group by kind
 )
 select jsonb_object_agg(kind,ids),jsonb_object_agg(kind,n),encode(extensions.digest(jsonb_object_agg(kind,digest)::text,'sha256'),'hex')
 into selected,counts,fingerprint from groups;

 select jsonb_build_object('org_id',target_org,'request_id',target_request,'row_counts',counts,'events',coalesce((
  select jsonb_agg(jsonb_build_object('audit_id',e.id,'operation_id',e.operation_id,'action',e.action,
    'occurred_at',e.created_at,'subject_table',e.subject_table,'subject_id',e.subject_id)
    order by e.id)
  from core.audit_events e where e.id=any(events) and e.action in (
   'center_manager_assign_v1','role_assign_v1','document_accept_v1','document_version_publish_v1','sale_apply_v1','sale_terminate_apply_v1'
  )
 ),'[]'::jsonb)) into scope;
 return jsonb_build_object('state','ready','scope',scope,'source_fingerprint',fingerprint,'selected',selected);
end$$;

create function private.organization_directory_erasure_stage(r jsonb,phase text,archive_digest text default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;a private.organization_directory_erasures;src jsonb;selection jsonb;erased_ids uuid[];
begin
 if phase is null or phase not in ('prepare','confirm') then perform private.fail('FORBIDDEN');end if;
 j:=private.p07_storage_erasure_job(r);
 if phase='prepare' then perform private.p07_privacy_scope(j.org_id);
 elsif not pg_has_role(session_user,'ftk_p07_storage_attestor','member') then perform private.fail('FORBIDDEN');end if;

 select * into a from private.organization_directory_erasures where request_id=j.request_id and org_id=j.org_id
  and instance_id=(pg_catalog.pg_control_system()).system_identifier::text for update;
 if a.request_id is null and phase='prepare' then return jsonb_build_object('state','unbound');end if;
 if a.request_id is null or (phase='prepare' and a.worker_role<>session_user)
  or (phase='confirm' and (a.attestor_role<>session_user or archive_digest is distinct from a.archive_sha256))
  or not pg_has_role(a.worker_role,'ftk_p07_privacy_worker','member') or not pg_has_role(a.attestor_role,'ftk_p07_storage_attestor','member')
  or not exists(select 1 from private.p07_privacy_worker_scopes where db_role=a.worker_role and org_id=j.org_id for share)
 then perform private.fail('FORBIDDEN');end if;
 if a.completed_at is not null then return jsonb_build_object('state','completed','archive_sha256',a.archive_sha256);end if;
 if j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if a.retain_until<=clock_timestamp() then perform private.fail('FORBIDDEN');end if;

 if phase='confirm' then
  perform 1 from core.organizations where id=j.org_id and state='deletion_pending' for update;
  if not found then perform private.fail('FORBIDDEN');end if;
  begin
   lock table core.retention_holds,core.people,core.accounts,core.sales,core.documents,core.saas_subscriptions,
    core.saas_payment_verifications,private.platform_invoices,private.p06_contexts,private.frontend_settings_previews in share mode nowait;
   lock table core.account_links,core.audit_events,core.operation_receipts,core.notifications,core.outbox_jobs,
    core.availability_rules,core.center_disciplines,core.center_relationships,core.centers,core.classes,core.disciplines,
    core.role_assignments,core.rooms,private.center_preparation_origins,private.person_origins,private.frontend_settings,
    private.frontend_settings_history,private.p05_upload_configuration,private.subscriber_numbers,private.subscriber_counters
    in share row exclusive mode nowait;
  exception when lock_not_available then
   return jsonb_build_object('state','retry_wait');
  end;
 end if;

 src:=private.organization_directory_archive_source(j.request_id,j.org_id);
 if src->>'state'<>'ready' then return src;end if;
 if src->>'source_fingerprint' is distinct from a.source_fingerprint then perform private.fail('ORGANIZATION_DIRECTORY_ARCHIVE_SOURCE_CHANGED');end if;
 if phase='prepare' then return (src-'selected')||jsonb_build_object(
  'source_project_ref',a.source_project_ref,'approval_id',a.approval_id,'retain_until',a.retain_until,
  'archive_scope_sha256',a.archive_scope_sha256,'archive_sha256',a.archive_sha256);
 end if;
 if j.lease_until<=clock_timestamp() or a.retain_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;

 selection:=src->'selected';
 erased_ids:=array(select distinct id::uuid from jsonb_each(selection) s cross join lateral jsonb_array_elements_text(s.value) id
  where s.key not in ('person_origins','settings','uploads','subscriber_numbers','subscriber_counter') order by id::uuid);
 update private.organization_directory_erasures set permit_transaction=pg_catalog.pg_current_xact_id(),permit_rows=selection where request_id=j.request_id;
 delete from core.outbox_jobs where org_id=j.org_id and (selection->'jobs')?id::text;
 delete from core.notifications where org_id=j.org_id and (selection->'notices')?id::text;
 delete from core.audit_events where org_id=j.org_id and (selection->'events')?id::text;
 delete from private.frontend_settings_history where (selection->'settings_history')?id::text and (selection->'settings')?scope_key;
 delete from private.frontend_settings where (selection->'settings')?scope_key;
 delete from core.operation_receipts where org_id=j.org_id and (selection->'operations')?id::text;

 delete from core.availability_rules where org_id=j.org_id and (selection->'availability')?id::text;
 delete from core.role_assignments where org_id=j.org_id and (selection->'roles')?id::text;
 delete from core.account_links where org_id=j.org_id and (selection->'links')?id::text;
 delete from core.center_relationships where org_id=j.org_id and (selection->'relationships')?id::text;
 delete from private.person_origins where org_id=j.org_id and (selection->'person_origins')?person_id::text;
 delete from private.center_preparation_origins where org_id=j.org_id and (selection->'center_origins')?center_id::text;
 delete from private.p05_upload_configuration where org_id=j.org_id and (selection->'uploads')?org_id::text;
 delete from core.classes where org_id=j.org_id and (selection->'classes')?id::text;
 delete from core.rooms where org_id=j.org_id and (selection->'rooms')?id::text;
 delete from core.center_disciplines where org_id=j.org_id and (selection->'center_disciplines')?id::text;
 delete from core.disciplines where org_id=j.org_id and (selection->'disciplines')?id::text;
 delete from core.centers where org_id=j.org_id and (selection->'centers')?id::text;
 update private.subscriber_numbers set person_id=null where org_id=j.org_id and person_id is not null and (selection->'subscriber_numbers')?number::text;
 set constraints all immediate;

 if exists(select 1 from core.outbox_jobs where id=any(erased_ids))
  or exists(select 1 from core.notifications where id=any(erased_ids))
  or exists(select 1 from core.audit_events where id=any(erased_ids))
  or exists(select 1 from private.frontend_settings_history where (selection->'settings')?scope_key)
  or exists(select 1 from private.frontend_settings where (selection->'settings')?scope_key)
  or exists(select 1 from core.operation_receipts where id=any(erased_ids))
  or exists(select 1 from core.availability_rules where org_id=j.org_id)
  or exists(select 1 from core.role_assignments where org_id=j.org_id)
  or exists(select 1 from core.account_links where id=any(erased_ids))
  or exists(select 1 from core.center_relationships where org_id=j.org_id)
  or exists(select 1 from private.person_origins where org_id=j.org_id)
  or exists(select 1 from private.center_preparation_origins where org_id=j.org_id)
  or exists(select 1 from private.p05_upload_configuration where org_id=j.org_id)
  or exists(select 1 from core.classes where org_id=j.org_id)
  or exists(select 1 from core.rooms where org_id=j.org_id)
  or exists(select 1 from core.center_disciplines where org_id=j.org_id)
  or exists(select 1 from core.disciplines where org_id=j.org_id)
  or exists(select 1 from core.centers where org_id=j.org_id)
  or exists(select 1 from private.subscriber_numbers where org_id=j.org_id and person_id is not null)
 then perform private.fail('INTEGRITY_VIOLATION');end if;
 if j.lease_until<=clock_timestamp() or a.retain_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 update private.organization_directory_erasures set completed_at=clock_timestamp(),erased_subject_ids=erased_ids,
  permit_transaction=null,permit_rows=null where request_id=j.request_id;
 return jsonb_build_object('state','completed','archive_sha256',a.archive_sha256);
end$$;

revoke all on function private.organization_directory_history_delete_permitted(text,uuid,uuid,text),
 private.organization_directory_settings_history_guard(),private.organization_directory_operation_subject(text),
 private.organization_directory_archive_source(uuid,uuid),private.organization_directory_erasure_stage(jsonb,text,text)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
grant execute on function private.organization_directory_erasure_stage(jsonb,text,text) to ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$  when 'private.organization_sale_erasures'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory DB footprint anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_directory_erasures' then 'r.request_id=$6 and r.org_id=$2 and r.completed_at is not null'
  when 'private.subscriber_counters' then 'r.org_id=$2 and r.last_number>=1000 and exists(
   select 1 from private.organization_directory_erasures a where a.org_id=$2 and a.request_id=$6 and a.completed_at is not null
  )'
  when 'private.subscriber_numbers' then 'r.org_id=$2 and r.person_id is null and exists(
   select 1 from private.subscriber_counters c where c.org_id=r.org_id and c.last_number>=r.number
  ) and exists(select 1 from private.organization_directory_erasures a where a.org_id=$2 and a.request_id=$6 and a.completed_at is not null)'
$q$||anchor);
 body:=pg_get_functiondef('private.organization_live_database_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$  ||coalesce((select a.erased_subject_ids from private.organization_sale_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}')$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory DB scope anchor mismatch';end if;
 execute replace(body,anchor,anchor||$q$
  ||coalesce((select a.erased_subject_ids from private.organization_directory_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}')$q$);
end$patch$;
commit;
