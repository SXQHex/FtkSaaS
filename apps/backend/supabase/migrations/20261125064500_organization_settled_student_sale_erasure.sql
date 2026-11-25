begin;

-- The first paid case is one original cash collection for one settled sale debt.
create function private.organization_settled_student_sales(target_org uuid,sale_ids uuid[]) returns jsonb
 language sql stable security invoker set search_path='' as $$
 with paid as materialized (
  select s.* from core.sales s where s.org_id=target_org and s.id=any(sale_ids) and s.net_minor<>0
 ), proved as materialized (
  select s.id sale_id,d debt,a allocation,c collection,r receipt,e event,n notice,q job,x context
  from paid s
  join core.debts d on d.org_id=s.org_id and d.center_id=s.center_id and d.person_id=s.person_id
   and d.sale_id=s.id and d.amount_minor=s.net_minor and d.currency=s.currency
   and d.event_registration_id is null and d.state='settled'
  join core.debt_allocations a on a.org_id=d.org_id and a.center_id=d.center_id and a.debt_id=d.id
   and a.amount_minor=d.amount_minor and a.previous_id is null and a.credit_movement_id is null
  join core.cash_movements c on c.org_id=a.org_id and c.center_id=a.center_id and c.id=a.cash_movement_id
   and c.person_id=s.person_id and c.currency=s.currency and c.amount_minor=a.amount_minor
   and c.kind='collection' and c.previous_id is null and c.payment->>'method'='cash'
  join core.operation_receipts r on r.org_id=c.org_id and r.id=c.operation_id and r.business_reference=c.id
   and r.operation='collection_record_v1' and r.actor_account_id is not null
   and ((r.state='succeeded' and r.result#>>'{data,primary_id}'=c.id::text)
     or (r.state='result_expired' and r.result is null))
  join core.audit_events e on e.org_id=r.org_id and e.operation_id=r.id and e.action=r.operation
   and e.subject_table='cash_movements' and e.subject_id=c.id and e.actor_account_id=r.actor_account_id
  join core.outbox_jobs q on q.org_id=e.org_id and q.dedupe_key=r.id::text
   and q.kind='in_app' and q.state<>'running' and q.lease_until is null and q.provider_reference is null
  join core.notifications n on n.org_id=q.org_id and n.id=q.notification_id
   and n.recipient_person_id=e.actor_person_id and n.kind=e.action and n.subject_id=e.subject_id
   and n.payload=jsonb_build_object('template_key',e.action,'subject',jsonb_build_object('type',e.subject_table,'id',e.subject_id))
  left join private.p06_contexts x on x.receipt_id=r.id
  where s.net_minor>0 and s.previous_sale_id is null and private.debt_remaining(s.org_id,d.id)=0
   and not exists(select 1 from core.sales y where y.org_id=s.org_id and y.previous_sale_id=s.id)
   and not exists(select 1 from core.debts y where y.org_id=s.org_id and y.sale_id=s.id and y.id<>d.id)
   and not exists(select 1 from core.debt_allocations y where y.org_id=s.org_id and y.id<>a.id
     and (y.debt_id=d.id or y.cash_movement_id=c.id or y.previous_id=a.id))
   and not exists(select 1 from core.cash_movements y where y.org_id=s.org_id and y.previous_id=c.id)
   and not exists(select 1 from core.debt_adjustments y where y.org_id=s.org_id and y.debt_id=d.id)
   and not exists(select 1 from core.event_payment_preparations y where y.org_id=s.org_id and y.debt_id=d.id)
   and not exists(select 1 from core.student_credit_movements y where y.org_id=s.org_id
     and (y.source_cash_id=c.id or y.source_debt_id=d.id))
   and not exists(select 1 from core.operation_receipts y where y.org_id=s.org_id
     and y.business_reference=c.id and y.id<>r.id)
   and not exists(select 1 from core.audit_events y where y.org_id=s.org_id and y.id<>e.id
     and (y.operation_id=r.id or (y.subject_table='cash_movements' and y.subject_id=c.id)))
   and not exists(select 1 from core.notifications y where y.org_id=s.org_id and y.subject_id=c.id and y.id<>n.id)
   and not exists(select 1 from core.outbox_jobs y where y.org_id=s.org_id and y.notification_id=n.id and y.id<>q.id)
   and not exists(select 1 from private.p05_jobs y where y.job_id=q.id)
   and not exists(select 1 from private.transactional_email_jobs y where y.job_id=q.id)
   and (x.receipt_id is null or (x.org_id=s.org_id and x.account_id=r.actor_account_id
    and x.operation=r.operation and x.subject='cash_movements'))
 ), scope as (
  select jsonb_agg(jsonb_build_object(
   'sale_id',x.sale_id,'debt_id',(x.debt).id,'allocation_id',(x.allocation).id,'collection_id',(x.collection).id,
   'operation_id',(x.receipt).id,'audit_id',(x.event).id,'center_id',(x.debt).center_id,'person_id',(x.debt).person_id,
   'action',(x.event).action,'outcome','succeeded','cashier_person_id',(x.event).actor_person_id,
   'debt_minor',(x.debt).amount_minor::text,'collected_minor',(x.collection).amount_minor::text,
   'allocated_minor',(x.allocation).amount_minor::text,'currency',(x.debt).currency,'state',(x.debt).state,
   'debt_created_at',(x.debt).created_at,'due_at',(x.debt).due_at,'allocated_at',(x.allocation).created_at,
   'occurred_at',(x.collection).occurred_at,'recorded_at',(x.event).created_at
  ) order by x.sale_id) evidence
  from proved x
 )
 select case
  when (select count(*) from paid)=0 then jsonb_build_object('state','none')
  when (select count(*) from paid)<>(select count(distinct x.sale_id) from proved x)
   or (select count(*) from proved)<>(select count(distinct x.sale_id) from proved x)
   then jsonb_build_object('state','blocked')
  else jsonb_build_object('state','ready','evidence',scope.evidence,
   'selected',jsonb_build_object(
    'sale_debts',array(select (x.debt).id from proved x order by x.sale_id),
    'sale_allocations',array(select (x.allocation).id from proved x order by x.sale_id),
    'sale_collections',array(select (x.collection).id from proved x order by x.sale_id),
    'collection_operations',array(select (x.receipt).id from proved x order by x.sale_id),
    'collection_events',array(select (x.event).id from proved x order by x.sale_id),
    'collection_notices',array(select (x.notice).id from proved x order by x.sale_id),
    'collection_jobs',array(select (x.job).id from proved x order by x.sale_id)),
   'actors',array(select (x.receipt).actor_account_id from proved x
    union select (x.event).actor_person_id from proved x),
   'digest',(select encode(extensions.digest(jsonb_agg(to_jsonb(x) order by x.sale_id)::text,'sha256'),'hex') from proved x))
 end from scope
$$;
revoke all on function private.organization_settled_student_sales(uuid,uuid[])
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

drop trigger runtime_append_only on core.debt_allocations;
create trigger runtime_append_only before update or delete on core.debt_allocations
 for each row execute function private.organization_sale_history_delete_guard('sale_allocations','id');
drop trigger runtime_append_only on core.cash_movements;
create trigger runtime_append_only before update or delete on core.cash_movements
 for each row execute function private.organization_sale_history_delete_guard('sale_collections','id');

alter table private.organization_sale_erasures add column prepared_lease_hash text
 check(prepared_lease_hash~'^[a-f0-9]{64}$');

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_sale_archive_source(uuid,uuid)'::regprocedure);
 anchor:=$q$declare p core.privacy_requests;scope jsonb;selected jsonb;fingerprint text;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale declaration anchor mismatch';end if;
 body:=replace(body,anchor,anchor||' collections jsonb;');
 anchor:=$q$ if exists(select 1 from core.sales where org_id=target_org and id=any(sale_ids) and net_minor<>0)
  or exists(select 1 from core.debts where org_id=target_org and sale_id=any(sale_ids))$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale admission anchor mismatch';end if;
 body:=replace(body,anchor,$q$ collections:=private.organization_settled_student_sales(target_org,sale_ids);
 if collections->>'state'='blocked'
  or exists(select 1 from core.debts where org_id=target_org and sale_id=any(sale_ids)
   and not coalesce((collections#>'{selected,sale_debts}')?id::text,false))$q$);
 anchor:=$q$ if exists(select 1 from core.retention_holds h where h.subject_id=any(hold_ids)$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale hold anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if collections->>'state'='ready' then
  hold_ids:=hold_ids||array(select id::uuid from jsonb_each(collections->'selected') s
    cross join lateral jsonb_array_elements_text(s.value) id)
   ||array(select id::uuid from jsonb_array_elements_text(collections->'actors') id);
 end if;
$q$||anchor);
 anchor:=$q$ return jsonb_build_object('state','ready','scope',scope,'source_fingerprint',fingerprint,'selected',selected);$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale archive anchor mismatch';end if;
 execute replace(body,anchor,$q$ if collections->>'state'='ready' then
  scope:=scope||jsonb_build_object('settled_collections',collections->'evidence');
  selected:=selected||(collections->'selected');
  fingerprint:=encode(extensions.digest(jsonb_build_array(fingerprint,scope,selected,collections->>'digest')::text,'sha256'),'hex');
 end if;
$q$||anchor);

 body:=pg_get_functiondef('private.organization_billing_audit_guard()'::regprocedure);
 anchor:=$q$ if tg_op='DELETE' and private.organization_directory_history_delete_permitted$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale audit permit anchor mismatch';end if;
 execute replace(body,anchor,$q$ if tg_op='DELETE' and old.action='collection_record_v1' and old.subject_table='cash_movements'
  and exists(select 1 from private.organization_sale_erasures a
   join private.p07_privacy_jobs j on j.request_id=a.request_id and j.org_id=a.org_id
   where a.org_id=old.org_id and (a.permit_rows->'collection_events')?old.id::text
    and a.attestor_role=session_user and a.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
    and a.permit_transaction=pg_catalog.pg_current_xact_id_if_assigned() and a.completed_at is null
    and a.retain_until>clock_timestamp() and j.state='running' and j.lease_until>clock_timestamp())
 then return old;end if;
$q$||anchor);

 body:=pg_get_functiondef('private.organization_sale_erasure_stage(jsonb,text,text)'::regprocedure);
 anchor:=$q$ if phase='confirm' then
  perform 1 from core.organizations$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale request fence anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if phase='confirm' then
  if a.prepared_lease_hash is distinct from j.lease_hash then perform private.fail('FORBIDDEN');end if;
  perform 1 from core.privacy_requests p where p.id=j.request_id and p.org_id=j.org_id and p.kind='organization_delete'
   and p.state in ('requested','running','partial')
   and p.scope=jsonb_build_object('kind','organization','org_id',j.org_id,'account_id',null,'all_data',true) for share;
  if not found then perform private.fail('FORBIDDEN');end if;
  perform 1 from core.organizations$q$);
 anchor:=$q$ if phase='prepare' then return (src-'selected')||jsonb_build_object($q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale preparation fence anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if phase='prepare' then
  update private.organization_sale_erasures set prepared_lease_hash=j.lease_hash where request_id=j.request_id;
  return (src-'selected')||jsonb_build_object($q$);
 anchor:=$q$  permit_transaction=null,permit_rows=null where request_id=j.request_id;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale preparation settlement anchor mismatch';end if;
 body:=replace(body,anchor,$q$  permit_transaction=null,permit_rows=null,prepared_lease_hash=null where request_id=j.request_id;$q$);
 anchor:=$q$   lock table core.retention_holds,core.debts,core.student_credit_movements,core.entitlement_allocations,$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale dependencies anchor mismatch';end if;
 body:=replace(body,anchor,$q$   lock table core.retention_holds,core.student_credit_movements,core.entitlement_allocations,
    core.debt_adjustments,core.event_payment_preparations,private.p05_jobs,private.transactional_email_jobs,$q$);
 anchor:=$q$core.trial_offers,core.operation_receipts,$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale receipt locks anchor mismatch';end if;
 body:=replace(body,anchor,'core.trial_offers,');
 anchor:=$q$   lock table core.sales,core.entitlement_accounts,$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale write locks anchor mismatch';end if;
 body:=replace(body,anchor,$q$   lock table core.debts,core.debt_allocations,core.cash_movements,core.operation_receipts,
    core.audit_events,core.notifications,core.outbox_jobs,private.p06_contexts,
    core.sales,core.entitlement_accounts,$q$);
 anchor:=$q$ delete from core.sales where org_id=j.org_id and (selected->'sales')?id::text;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale removal anchor mismatch';end if;
 body:=replace(body,anchor,$q$ delete from core.debt_allocations where org_id=j.org_id and (selected->'sale_allocations')?id::text;
 delete from core.debts where org_id=j.org_id and (selected->'sale_debts')?id::text;
 delete from core.cash_movements where org_id=j.org_id and (selected->'sale_collections')?id::text;
 delete from core.outbox_jobs where org_id=j.org_id and (selected->'collection_jobs')?id::text;
 delete from core.notifications where org_id=j.org_id and (selected->'collection_notices')?id::text;
 delete from core.audit_events where org_id=j.org_id and (selected->'collection_events')?id::text;
 delete from private.p06_contexts where org_id=j.org_id and (selected->'collection_operations')?receipt_id::text;
 delete from core.operation_receipts where org_id=j.org_id and (selected->'collection_operations')?id::text;
$q$||anchor);
 anchor:=$q$  or exists(select 1 from core.sales where id=any(erased_ids))$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Settled student sale absence anchor mismatch';end if;
 execute replace(body,anchor,anchor||$q$
  or exists(select 1 from core.debts where id=any(erased_ids))
  or exists(select 1 from core.debt_allocations where id=any(erased_ids))
  or exists(select 1 from core.cash_movements where id=any(erased_ids))
  or exists(select 1 from core.outbox_jobs where id=any(erased_ids))
  or exists(select 1 from core.notifications where id=any(erased_ids))
  or exists(select 1 from core.audit_events where id=any(erased_ids))
  or exists(select 1 from private.p06_contexts where receipt_id=any(erased_ids))
  or exists(select 1 from core.operation_receipts where id=any(erased_ids))$q$);
end$patch$;

commit;
