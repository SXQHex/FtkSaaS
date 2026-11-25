begin;

-- Enrollment belongs to the operator on the source DB. A writer configured
-- for a different registry namespace cannot fence or publish this request.
create table private.organization_r2_erasure_bindings(
 request_id uuid primary key,org_id uuid not null,
 source_project_ref text not null check(source_project_ref~'^[a-z]{20}$'),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id)
);
alter table private.organization_r2_erasure_bindings enable row level security;
revoke all on private.organization_r2_erasure_bindings from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger organization_r2_erasure_binding_immutable before update or delete on private.organization_r2_erasure_bindings
 for each row execute function private.append_only();

alter table private.organization_directory_erasures add column prepared_lease_hash text
 check(prepared_lease_hash~'^[a-f0-9]{64}$');

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p07_storage_erasure_job(jsonb)'::regprocedure);
 anchor:=$q$ select * into j from private.p07_privacy_jobs$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Erasure lease isolation anchor mismatch';end if;
 execute replace(body,anchor,$q$ if pg_catalog.current_setting('transaction_isolation')<>'read committed'
 then perform private.fail('FORBIDDEN');end if;
$q$||anchor);

 body:=pg_get_functiondef('private.organization_directory_erasure_stage(jsonb,text,text)'::regprocedure);
 anchor:=$q$ if phase='confirm' then
  perform 1 from core.organizations$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory request lock anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if phase='confirm' then
  if a.prepared_lease_hash is distinct from j.lease_hash then perform private.fail('FORBIDDEN');end if;
  perform 1 from core.privacy_requests p where p.id=j.request_id and p.org_id=j.org_id and p.kind='organization_delete'
   and p.state in ('requested','running','partial')
   and p.scope=jsonb_build_object('kind','organization','org_id',j.org_id,'account_id',null,'all_data',true) for share;
  if not found then perform private.fail('FORBIDDEN');end if;
  perform 1 from core.organizations$q$);
 anchor:=$q$ if phase='prepare' then return (src-'selected')||jsonb_build_object($q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory preparation fence anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if phase='prepare' then
  update private.organization_directory_erasures set prepared_lease_hash=j.lease_hash where request_id=j.request_id;
  return (src-'selected')||jsonb_build_object($q$);
 anchor:='  permit_transaction=null,permit_rows=null where request_id=j.request_id;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory preparation settlement anchor mismatch';end if;
 execute replace(body,anchor,'  permit_transaction=null,permit_rows=null,prepared_lease_hash=null where request_id=j.request_id;');

 body:=pg_get_functiondef('private.organization_directory_archive_source(uuid,uuid)'::regprocedure);
 anchor:=$q$  and not exists(select 1 from unnest(root_ops) id where q.dedupe_key=id::text))$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory root queue fence anchor mismatch';end if;
 body:=replace(body,anchor,$q$  and not exists(
   select 1 from core.audit_events e join core.notifications n on n.org_id=e.org_id and n.id=q.notification_id
   where e.org_id=target_org and e.operation_id=any(root_ops) and q.dedupe_key=e.operation_id::text
    and n.kind=e.action and n.subject_id=e.subject_id and n.recipient_person_id=organization.owner_person_id
    and n.payload=jsonb_build_object('template_key',e.action,'subject',jsonb_build_object('type',e.subject_table,'id',e.subject_id))
    and q.kind='in_app' and q.state<>'running' and q.lease_until is null and q.provider_reference is null
  ))$q$);
 anchor:=$q$    and e.action=n.kind and e.subject_id=n.subject_id))$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory root notification fence anchor mismatch';end if;
 body:=replace(body,anchor,$q$    and e.action=n.kind and e.subject_id=n.subject_id and n.recipient_person_id=organization.owner_person_id
    and n.payload=jsonb_build_object('template_key',e.action,'subject',jsonb_build_object('type',e.subject_table,'id',e.subject_id))))$q$);
 anchor:=$q$   'center_manager_assign_v1','role_assign_v1','document_accept_v1','document_version_publish_v1','sale_apply_v1','sale_terminate_apply_v1'
  )$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory security policy evidence anchor mismatch';end if;
 body:=replace(body,anchor,$q$   'center_manager_assign_v1','role_assign_v1','document_accept_v1','document_version_publish_v1','sale_apply_v1','sale_terminate_apply_v1'
  ) or e.id=any(events) and e.action='settings_update_v1' and exists(
   select 1 from private.frontend_settings_history h where h.operation_id=e.operation_id
    and (h.before_values->'security_policy',h.before_values->'permission_templates')
     is distinct from (h.after_values->'security_policy',h.after_values->'permission_templates')
  )$q$);
 anchor:=$q$  or exists(select 1 from private.p06_contexts c where c.receipt_id=any(ops))$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory settings ownership anchor mismatch';end if;
 body:=replace(body,anchor,$q$  or exists(select 1 from private.frontend_settings_history h
   join core.operation_receipts r on r.id=h.operation_id where h.operation_id=any(ops) and (
    r.operation<>'settings_update_v1' or r.actor_account_id is distinct from h.actor_account_id
    or (h.scope_key like 'member:'||target_org||':%' and h.scope_key<>'member:'||target_org||':'||h.actor_account_id)
   ))
$q$||anchor);
 anchor:=$q$  or exists(select 1 from core.outbox_jobs q where q.notification_id=any(notice_ids) and not q.id=any(job_ids))$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Directory delivery dependency anchor mismatch';end if;
 body:=replace(body,anchor,$q$  or exists(select 1 from private.p05_jobs j where j.job_id=any(job_ids))
$q$||anchor);
 execute body;

 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$  when 'private.organization_directory_erasures'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization registry binding DB footprint anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_r2_erasure_bindings' then 'r.request_id=$6 and r.org_id=$2
    and r.instance_id=(pg_catalog.pg_control_system()).system_identifier::text'
$q$||anchor);
end$patch$;
commit;
