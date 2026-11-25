begin;

create table private.organization_billing_erasures(
 request_id uuid primary key,org_id uuid not null,
 source_fingerprint text not null check(source_fingerprint~'^[a-f0-9]{64}$'),
 source_project_ref text not null check(source_project_ref~'^[a-z]{20}$'),
 archive_scope_sha256 text not null check(archive_scope_sha256~'^[a-f0-9]{64}$'),
 archive_sha256 text not null check(archive_sha256~'^[a-f0-9]{64}$'),
 approval_id uuid not null unique,retain_until timestamptz not null,
 worker_role name not null,attestor_role name not null check(attestor_role<>worker_role),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 completed_at timestamptz,erased_subject_ids uuid[],payment_subject_ids uuid[],
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id),
 check((completed_at is null and erased_subject_ids is null and payment_subject_ids is null) or
       (completed_at is not null and coalesce(cardinality(erased_subject_ids),0)>0
        and coalesce(cardinality(payment_subject_ids),0)>0 and payment_subject_ids<@erased_subject_ids))
);
alter table private.organization_billing_erasures enable row level security;
revoke all on private.organization_billing_erasures from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger organization_billing_erasure_immutable before update or delete on private.organization_billing_erasures
 for each row when(old.completed_at is not null) execute function private.append_only();

create function private.organization_billing_archive_source(target_request uuid,target_org uuid) returns jsonb
 language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare policy_request core.privacy_requests;payment_ids uuid[];subscription_ids uuid[];scope jsonb;fingerprint text;
begin
 select * into policy_request from core.privacy_requests where id=target_request and org_id=target_org
  and kind='organization_delete' and state in ('requested','running','partial')
  and core.privacy_requests.scope=jsonb_build_object('kind','organization','org_id',target_org,'account_id',null,'all_data',true);
 if policy_request.id is null or not exists(select 1 from core.organizations o where o.id=target_org and o.state='deletion_pending') then
  perform private.fail('FORBIDDEN');
 end if;
 select array(select x.id from core.saas_payment_verifications x where x.org_id=target_org order by x.id),
  array(select x.id from core.saas_subscriptions x where x.org_id=target_org order by x.id)
 into payment_ids,subscription_ids;
 if cardinality(payment_ids)=0 or cardinality(subscription_ids)=0 then
  return jsonb_build_object('state','blocked','reason','billing_scope_incomplete');
 end if;
 if exists(select 1 from core.retention_holds h where
  (h.org_id=target_org and (h.subject_id in (policy_request.id,target_org) or h.subject_id=any(payment_ids) or h.subject_id=any(subscription_ids)
   or exists(select 1 from private.p07_payment_allocations a where a.payment_id=any(payment_ids) and a.operation_id=h.subject_id)))
  or (h.org_id is null and h.subject_table='accounts' and h.subject_id=policy_request.requester_account_id)) then
  return jsonb_build_object('state','held');
 end if;
 -- Privacy requests disable renewals immediately. Keep the live records during
 -- any remaining paid period, grace period or scheduled billing work.
 if exists(select 1 from core.saas_subscriptions s where s.id=any(subscription_ids)
  and (not s.cancel_at_period_end or s.starts_at is null or s.period_end is null
   or s.period_end<=s.starts_at or greatest(s.period_end,s.grace_until)>statement_timestamp()
   or s.state not in ('active','ended','grace','suspended'))) then
  return jsonb_build_object('state','blocked','reason','active_subscription');
 end if;
 if exists(select 1 from private.p07_subscription_scope s where s.subscription_id=any(subscription_ids) and s.kept_center_id is not null)
  or exists(select 1 from private.p07_quote_context q where q.subscription_id=any(subscription_ids))
  or exists(select 1 from private.p07_payment_quotes q where q.payment_id=any(payment_ids))
  or exists(select 1 from private.p07_jobs j where j.subscription_id=any(subscription_ids))
  or exists(select 1 from core.saas_change_requests c where c.org_id=target_org or c.subscription_id=any(subscription_ids)) then
  return jsonb_build_object('state','blocked','reason','dependent_billing_work');
 end if;
 if exists(
  select 1 from private.p07_payment_allocations a
  left join core.operation_receipts r on r.id=a.operation_id
  where (a.payment_id=any(payment_ids) or a.subscription_id=any(subscription_ids))
   and (not a.payment_id=any(payment_ids) or not a.subscription_id=any(subscription_ids) or r.org_id is distinct from target_org
    or r.state is distinct from 'succeeded' or r.operation not in ('saas_payment_verify_v1','subscription_boundary_apply_v1'))
 ) then return jsonb_build_object('state','blocked','reason','mixed_allocation');end if;

 if exists(
  select 1 from core.saas_payment_verifications x left join private.p07_payment_origins o on o.payment_id=x.id
  where x.id=any(payment_ids) and (x.state not in ('accepted','rejected') or x.verified_at is null
   or x.amount_minor<=0 or o.kind is distinct from 'payment'
   or case when x.state='accepted' then
    x.amount_minor<>(select coalesce(sum(a.amount_minor),0) from private.p07_payment_allocations a where a.payment_id=x.id)
   else exists(select 1 from private.p07_payment_allocations a where a.payment_id=x.id) end)
 ) then return jsonb_build_object('state','blocked','reason','unreconciled_payment');end if;

 with payment_rows as (
  select x,o.kind from core.saas_payment_verifications x join private.p07_payment_origins o on o.payment_id=x.id
  where x.id=any(payment_ids)
 ), subscription_rows as (
  select x,s.period_start from core.saas_subscriptions x left join private.p07_subscription_scope s on s.subscription_id=x.id
  where x.id=any(subscription_ids)
 ), allocations as (
  select a.payment_id,a.subscription_id,a.operation_id,a.amount_minor::text as amount_minor
  from private.p07_payment_allocations a where a.payment_id=any(payment_ids)
 )
 select jsonb_build_object(
   'request_id',target_request,'org_id',target_org,
   'payments',(select jsonb_agg(jsonb_build_object('payment_id',(p.x).id,'amount_minor',(p.x).amount_minor::text,
    'currency',(p.x).currency,'state',(p.x).state,'occurred_at',(p.x).occurred_at,'verified_at',(p.x).verified_at,'origin',p.kind)
    order by (p.x).id) from payment_rows p),
   'subscriptions',(select jsonb_agg(jsonb_build_object('subscription_id',(s.x).id,'plan_version_id',(s.x).plan_version_id,
    'starts_at',(s.x).starts_at,'period_start',s.period_start,'period_end',(s.x).period_end,'state',(s.x).state)
    order by (s.x).id) from subscription_rows s),
   'allocations',(select coalesce(jsonb_agg(to_jsonb(a) order by a.payment_id,a.operation_id),'[]'::jsonb) from allocations a)
  ),
  encode(extensions.digest(jsonb_build_array(
   (select jsonb_agg(to_jsonb(p) order by (p.x).id) from payment_rows p),
   (select jsonb_agg(to_jsonb(s) order by (s.x).id) from subscription_rows s),
   (select jsonb_agg(to_jsonb(a) order by a.payment_id,a.operation_id) from allocations a)
  )::text,'sha256'),'hex') into scope,fingerprint;
 return jsonb_build_object('state','ready','scope',scope,'source_fingerprint',fingerprint);
end$$;

create function private.organization_billing_erasure_stage(r jsonb,phase text,archive_digest text default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;a private.organization_billing_erasures;src jsonb;
 payment_ids uuid[];subscription_ids uuid[];removed bigint;
begin
 if phase is null or phase not in ('prepare','confirm') then perform private.fail('FORBIDDEN');end if;
 j:=private.p07_storage_erasure_job(r);
 if phase='prepare' then perform private.p07_privacy_scope(j.org_id);
 elsif not pg_has_role(session_user,'ftk_p07_storage_attestor','member') then perform private.fail('FORBIDDEN');end if;

 select * into a from private.organization_billing_erasures where request_id=j.request_id and org_id=j.org_id
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
  -- Prevent a new dependent row or hold between archive reconciliation and
  -- the atomic removal. A concurrent write leaves the original data intact.
  begin
   lock table core.retention_holds,core.operation_receipts,core.saas_change_requests,
    private.p07_quote_context,private.p07_payment_quotes,private.p07_jobs in share mode nowait;
   lock table core.saas_payment_verifications,core.saas_subscriptions,private.p07_payment_origins,
    private.p07_payment_allocations,private.p07_subscription_scope in share row exclusive mode nowait;
  exception when lock_not_available then
   return jsonb_build_object('state','retry_wait');
  end;
 end if;

 src:=private.organization_billing_archive_source(j.request_id,j.org_id);
 if src->>'state'<>'ready' then return src;end if;
 if src->>'source_fingerprint' is distinct from a.source_fingerprint then perform private.fail('BILLING_ARCHIVE_SOURCE_CHANGED');end if;
 if phase='prepare' then return src||jsonb_build_object(
  'source_project_ref',a.source_project_ref,'approval_id',a.approval_id,'retain_until',a.retain_until,
  'archive_scope_sha256',a.archive_scope_sha256,'archive_sha256',a.archive_sha256);
 end if;
 if a.retain_until<=clock_timestamp() or j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 select array(select (x->>'payment_id')::uuid from jsonb_array_elements(src->'scope'->'payments') x),
  array(select (x->>'subscription_id')::uuid from jsonb_array_elements(src->'scope'->'subscriptions') x)
 into payment_ids,subscription_ids;

 delete from private.p07_payment_allocations where payment_id=any(payment_ids);
 get diagnostics removed=row_count;
 if removed<>jsonb_array_length(src->'scope'->'allocations') then perform private.fail('INTEGRITY_VIOLATION');end if;
 delete from private.p07_payment_origins where payment_id=any(payment_ids);
 get diagnostics removed=row_count;
 if removed<>cardinality(payment_ids) then perform private.fail('INTEGRITY_VIOLATION');end if;
 delete from private.p07_subscription_scope where subscription_id=any(subscription_ids);
 delete from core.saas_payment_verifications where org_id=j.org_id and id=any(payment_ids);
 get diagnostics removed=row_count;
 if removed<>cardinality(payment_ids) then perform private.fail('INTEGRITY_VIOLATION');end if;
 delete from core.saas_subscriptions where org_id=j.org_id and id=any(subscription_ids);
 get diagnostics removed=row_count;
 if removed<>cardinality(subscription_ids) then perform private.fail('INTEGRITY_VIOLATION');end if;
 set constraints all immediate;
 if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 update private.organization_billing_erasures set completed_at=clock_timestamp(),erased_subject_ids=payment_ids||subscription_ids,payment_subject_ids=payment_ids
 where request_id=j.request_id;
 return jsonb_build_object('state','completed','archive_sha256',a.archive_sha256);
end$$;

revoke all on function private.organization_billing_archive_source(uuid,uuid),private.organization_billing_erasure_stage(jsonb,text,text)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
grant execute on function private.organization_billing_erasure_stage(jsonb,text,text) to ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$  when 'private.organization_invoice_erasures'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Billing DB footprint anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_billing_erasures' then 'r.request_id=$6 and r.org_id=$2 and r.completed_at is not null'
$q$||anchor);

 body:=pg_get_functiondef('private.organization_live_database_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null);$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Billing DB scope anchor mismatch';end if;
 execute replace(body,anchor,$q$    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null)
  ||coalesce((select a.erased_subject_ids from private.organization_billing_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}');$q$);
end$patch$;
commit;
