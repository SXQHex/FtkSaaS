begin;

-- A permit is visible only inside the worker transaction that scrubs the
-- matching audit field and preview. The audit event and operation stay intact.
create table private.organization_erasure_intake_permits(
 event_id uuid primary key,org_id uuid not null,db_role name not null,transaction_id xid8 not null
);
alter table private.organization_erasure_intake_permits enable row level security;
revoke all on private.organization_erasure_intake_permits
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $audit$
declare body text;anchor text:=' if tg_op=''DELETE'' and exists(';
begin
 body:=pg_get_functiondef('private.organization_billing_audit_guard()'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Intake audit guard anchor mismatch';end if;
 execute replace(body,anchor,$q$ if tg_op='UPDATE' and old.action='organization_delete_apply_v1'
  and old.subject_table='privacy_requests' and old.reason is not null and new.reason is null
  and (to_jsonb(new)-'reason')=(to_jsonb(old)-'reason') and exists(
   select 1 from private.organization_erasure_intake_permits a
   where a.event_id=old.id and a.org_id=old.org_id and a.db_role=session_user
    and a.transaction_id=pg_catalog.pg_current_xact_id_if_assigned()
  ) then return new;end if;
$q$||anchor);
end$audit$;

create function private.organization_erasure_scrub_intake(target_request uuid,target_org uuid,stage_receipt uuid)
 returns text language plpgsql security invoker set search_path='' as $$
declare
 p core.privacy_requests;j private.p07_privacy_jobs;
 audit_row core.audit_events;preview_row private.p07_lifecycle_previews;
 expected_payload jsonb;
begin
 select * into j from private.p07_privacy_jobs where request_id=target_request and org_id=target_org for update;
 select * into p from core.privacy_requests where id=target_request and org_id=target_org for share;
 if j.id is null or j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp()
  or p.id is null or p.kind<>'organization_delete' or p.state not in ('requested','running','partial')
  or p.scope is distinct from jsonb_build_object('kind','organization','org_id',target_org,'account_id',null,'all_data',true)
  or pg_catalog.current_setting('transaction_isolation')<>'read committed'
  or not exists(select 1 from private.organization_live_database_erasure_scopes s
   where s.request_id=target_request and s.org_id=target_org and s.db_role=session_user
    and s.instance_id=(pg_catalog.pg_control_system()).system_identifier::text)
  or not exists(select 1 from core.operation_receipts r where r.id=stage_receipt and r.org_id=target_org
   and r.operation='privacy_execute_v1' and r.state='in_progress' and r.actor_fingerprint='worker:privacy:'||session_user)
 then perform private.fail('FORBIDDEN');end if;

 begin
  select a.* into strict audit_row from core.audit_events a
  join core.operation_receipts r on r.id=a.operation_id and r.org_id=a.org_id
  join private.p07_lifecycle_events e on e.operation_id=r.id and e.action=r.operation and e.account_id=r.actor_account_id
  where a.org_id=target_org and a.action='organization_delete_apply_v1' and a.subject_table='privacy_requests'
   and a.subject_id=target_request and a.actor_account_id=p.requester_account_id
   and a.diff=jsonb_build_object('after',jsonb_build_object('job_id',j.id,'state','pending'),'physical_erasure_complete',false)
   and r.operation=a.action and r.state='succeeded' and r.business_reference=target_request
   and r.actor_account_id=p.requester_account_id and e.detail->>'privacy_request_id'=target_request::text
   and e.detail->'scope'=p.scope
  for update of a;
  select v.* into strict preview_row from private.p07_lifecycle_previews v
  where v.org_id=target_org and v.account_id=p.requester_account_id
   and v.operation='organization_delete_apply_v1' and v.used
  for update;
 exception when no_data_found or too_many_rows then
  return 'blocked';
 end;

 expected_payload:=jsonb_build_object('client_api_version',1,'org_id',target_org,'all_data',true);
 if (preview_row.payload-'reason') is distinct from expected_payload
  or (preview_row.payload->'reason') is distinct from to_jsonb(audit_row.reason) then return 'blocked';end if;
 -- The parent owns the shared hold lock. Also honor holds attached to
 -- either of the resolved source IDs with no organizational scope.
 if exists(select 1 from core.retention_holds where subject_id in (audit_row.id,preview_row.id)) then return 'held';end if;
 if audit_row.reason is null then return 'completed';end if;
 if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;

 insert into private.organization_erasure_intake_permits(event_id,org_id,db_role,transaction_id)
 values(audit_row.id,target_org,session_user,pg_catalog.pg_current_xact_id());
 update core.audit_events set reason=null where id=audit_row.id and org_id=target_org;
 delete from private.organization_erasure_intake_permits where event_id=audit_row.id;
 update private.p07_lifecycle_previews set payload=expected_payload where id=preview_row.id and org_id=target_org;
 return 'completed';
end$$;
revoke all on function private.organization_erasure_scrub_intake(uuid,uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_live_database_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$ scope_pattern:=array_to_string(references_ids,'|');$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization intake census anchor mismatch';end if;
 execute replace(body,anchor,$q$ case private.organization_erasure_scrub_intake(target_request,target_org,stage_receipt)
  when 'held' then return jsonb_build_object('state','held');
  when 'blocked' then return jsonb_build_object('state','blocked','blocked_relations',
   jsonb_build_array('core.audit_events','private.p07_lifecycle_previews'));
  else null;
 end case;
$q$||anchor);
 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$r.subject_id=$6 and r.reason=$2::text$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization intake audit census anchor mismatch';end if;
 body:=replace(body,anchor,$q$r.subject_id=$6 and r.reason is null$q$);
 anchor:=$q$,true,''reason'',$2::text)$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization intake preview census anchor mismatch';end if;
 execute replace(body,anchor,$q$,true)$q$);
end$patch$;

commit;
