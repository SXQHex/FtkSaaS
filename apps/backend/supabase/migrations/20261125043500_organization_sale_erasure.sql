begin;

create table private.organization_sale_erasures(
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
alter table private.organization_sale_erasures enable row level security;
revoke all on private.organization_sale_erasures from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger organization_sale_erasure_immutable before update or delete on private.organization_sale_erasures
 for each row when(old.completed_at is not null) execute function private.append_only();

create function private.organization_sale_history_delete_guard() returns trigger
 language plpgsql security definer set search_path='' as $$
declare old_data jsonb:=to_jsonb(old);
begin
 if tg_op='DELETE' and exists(
  select 1 from private.organization_sale_erasures a
  join private.p07_privacy_jobs j on j.request_id=a.request_id and j.org_id=a.org_id
  where (old_data->>'org_id' is null or a.org_id=(old_data->>'org_id')::uuid)
   and (a.permit_rows->tg_argv[0])?(old_data->>tg_argv[1]) and a.attestor_role=session_user
   and a.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
   and a.permit_transaction=pg_catalog.pg_current_xact_id_if_assigned() and a.completed_at is null
   and a.retain_until>clock_timestamp() and j.state='running' and j.lease_until>clock_timestamp()
 ) then return old;end if;
 perform private.fail('INTEGRITY_VIOLATION');
 return null;
end$$;

drop trigger runtime_append_only on core.entitlement_movements;
create trigger runtime_append_only before update or delete on core.entitlement_movements
 for each row execute function private.organization_sale_history_delete_guard('movements','id');
drop trigger purchase_documents_immutable on private.purchase_documents;
create trigger purchase_documents_immutable before update or delete on private.purchase_documents
 for each row execute function private.organization_sale_history_delete_guard('purchases','preview_id');
drop trigger purchase_document_uses_immutable on private.purchase_document_uses;
create trigger purchase_document_uses_immutable before update or delete on private.purchase_document_uses
 for each row execute function private.organization_sale_history_delete_guard('used_sales','sale_id');

create function private.organization_sale_archive_source(target_request uuid,target_org uuid) returns jsonb
 language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare p core.privacy_requests;scope jsonb;selected jsonb;fingerprint text;
 sale_ids uuid[];account_ids uuid[];movement_ids uuid[];product_ids uuid[];version_ids uuid[];scope_ids uuid[];
 purchase_ids uuid[];used_sales uuid[];preview_ids uuid[];operation_ids uuid[];hold_ids uuid[];
begin
 select * into p from core.privacy_requests q where q.id=target_request and q.org_id=target_org
  and q.kind='organization_delete' and q.state in ('requested','running','partial')
  and q.scope=jsonb_build_object('kind','organization','org_id',target_org,'account_id',null,'all_data',true);
 if p.id is null or not exists(select 1 from core.organizations where id=target_org and state='deletion_pending')
 then perform private.fail('FORBIDDEN');end if;

 select array(select s.id from core.sales s where s.org_id=target_org order by s.id),
  array(select distinct s.product_version_id from core.sales s where s.org_id=target_org order by s.product_version_id)
 into sale_ids,version_ids;
 if cardinality(sale_ids)=0 then return jsonb_build_object('state','blocked','reason','sale_source_missing');end if;

 if exists(select 1 from core.sales s where s.org_id=target_org and s.id=any(sale_ids)
   and (s.state<>'terminated' or (s.previous_sale_id is not null and not s.previous_sale_id=any(sale_ids))
    or not exists(select 1 from core.entitlement_accounts a where a.org_id=s.org_id and a.sale_id=s.id
      and a.person_id=s.person_id and a.state='closed')
    or exists(select 1 from core.entitlement_accounts a where a.org_id=s.org_id and a.sale_id=s.id
      and (a.person_id<>s.person_id or a.state<>'closed'))
    or private.credit_available(target_org,s.id)<>0))
 then return jsonb_build_object('state','blocked','reason','open_sale_work');end if;

 -- Finance, service consumption and settlement are separate retention scopes.
 -- No sale proof may stand in for a retained or still-live dependency.
 if exists(select 1 from core.sales where org_id=target_org and id=any(sale_ids) and net_minor<>0)
  or exists(select 1 from core.debts where org_id=target_org and sale_id=any(sale_ids))
  or exists(select 1 from core.student_credit_movements where org_id=target_org and source_sale_id=any(sale_ids))
  or exists(select 1 from core.entitlement_allocations where org_id=target_org and sale_id=any(sale_ids))
  or exists(select 1 from core.credit_deficits where org_id=target_org and settled_sale_id=any(sale_ids))
  or exists(select 1 from core.reservations where org_id=target_org and source_sale_id=any(sale_ids))
  or exists(select 1 from core.freezes where org_id=target_org and sale_id=any(sale_ids))
  or exists(select 1 from core.quota_buckets where org_id=target_org and sale_id=any(sale_ids))
  or exists(select 1 from private.p02_sale_settlements where org_id=target_org and sale_id=any(sale_ids))
  or exists(select 1 from private.p03_sale_refunds where org_id=target_org and sale_id=any(sale_ids))
  or exists(select 1 from private.settlement_credit_units where org_id=target_org and sale_id=any(sale_ids))
  or exists(select 1 from private.settlement_movements where org_id=target_org and source_sale_id=any(sale_ids))
 then return jsonb_build_object('state','blocked','reason','dependent_sale_work');end if;

 select array(select a.id from core.entitlement_accounts a where a.org_id=target_org and a.sale_id=any(sale_ids) order by a.id),
  array(select m.id from core.entitlement_movements m where m.org_id=target_org and m.sale_id=any(sale_ids) order by m.id),
  array(select distinct v.product_id from core.product_versions v where v.org_id=target_org and v.id=any(version_ids)
    and not exists(select 1 from core.product_versions sibling where sibling.org_id=target_org
     and sibling.product_id=v.product_id and not sibling.id=any(version_ids)) order by v.product_id),
  array(select s.id from core.product_scopes s where s.org_id=target_org and s.product_version_id=any(version_ids) order by s.id),
  array(select d.preview_id from private.purchase_documents d where d.org_id=target_org and d.product_version_id=any(version_ids) order by d.preview_id),
  array(select u.sale_id from private.purchase_document_uses u where u.sale_id=any(sale_ids) order by u.sale_id)
 into account_ids,movement_ids,product_ids,scope_ids,purchase_ids,used_sales;

 if exists(select 1 from core.entitlement_movements m join core.sales s on s.org_id=m.org_id and s.id=m.sale_id
    where m.id=any(movement_ids) and (m.person_id<>s.person_id
     or m.reservation_id is not null or m.event_registration_id is not null
     or (m.previous_id is not null and not m.previous_id=any(movement_ids))
     or m.kind not in ('grant','adjust_add','adjust_subtract')))
  or exists(select 1 from core.trial_offers where org_id=target_org and product_version_id=any(version_ids))
  or exists(select 1 from private.p04_trial_configuration where org_id=target_org and product_version_id=any(version_ids))
  or exists(select 1 from private.purchase_document_uses u
   where (u.purchase_preview_id=any(purchase_ids)) is distinct from (u.sale_id=any(used_sales)))
  or exists(select 1 from private.purchase_document_uses u join private.purchase_documents d on d.preview_id=u.purchase_preview_id
    join core.sales s on s.id=u.sale_id where u.sale_id=any(used_sales)
     and (s.org_id,s.center_id,s.person_id,s.product_version_id) is distinct from (d.org_id,d.center_id,d.person_id,d.product_version_id))
 then return jsonb_build_object('state','blocked','reason','dependent_sale_work');end if;

 select array(
  select v.id from core.previews v left join private.preview_payloads q on q.preview_id=v.id
  left join private.p06_previews t on t.preview_id=v.id
  where v.org_id=target_org and (v.id=any(purchase_ids)
    or (v.operation='sale_terminate_apply_v1'
     and coalesce(q.payload#>>'{request,sale_id}',t.request->>'sale_id') in (select id::text from unnest(sale_ids) id)))
   and v.state in ('applied','expired','invalidated')
  order by v.id
 ),array(select distinct m.operation_id from core.entitlement_movements m where m.id=any(movement_ids) order by m.operation_id)
 into preview_ids,operation_ids;
 if exists(select 1 from private.purchase_documents d where d.preview_id=any(purchase_ids)
   and (not d.preview_id=any(preview_ids) or jsonb_typeof(d.requirements)<>'array'))
  or exists(select 1 from core.previews v left join private.preview_payloads q on q.preview_id=v.id
   left join private.p06_previews t on t.preview_id=v.id
   where v.org_id=target_org and v.operation='sale_terminate_apply_v1'
   and exists(select 1 from unnest(sale_ids) id where id::text in (q.payload#>>'{request,sale_id}',t.request->>'sale_id'))
   and (not v.id=any(preview_ids) or (t.preview_id is not null and (
    t.org_id<>target_org or t.account_id<>v.actor_account_id or t.operation<>'sale_terminate_preview_v1'
    or t.request->>'org_id' is distinct from target_org::text
    or (q.preview_id is not null and q.payload#>>'{request,sale_id}' is distinct from t.request->>'sale_id')
   ))))
 then return jsonb_build_object('state','blocked','reason','dependent_sale_preview');end if;

 hold_ids:=array[target_request,target_org,p.requester_account_id]||sale_ids||account_ids||movement_ids||
  version_ids||product_ids||scope_ids||preview_ids||operation_ids
  ||array(select s.person_id from core.sales s where s.id=any(sale_ids))
  ||array(select s.center_id from core.sales s where s.id=any(sale_ids))
  ||array(select r.actor_account_id from core.operation_receipts r where r.id=any(operation_ids));
 if exists(select 1 from core.retention_holds h where h.subject_id=any(hold_ids) and (h.org_id=target_org or h.org_id is null))
 then return jsonb_build_object('state','held');end if;

 select jsonb_build_object('request_id',target_request,'org_id',target_org,
  'sales',(select jsonb_agg(jsonb_build_object('sale_id',s.id,'person_id',s.person_id,'center_id',s.center_id,
    'product_version_id',s.product_version_id,'net_minor',s.net_minor::text,'currency',s.currency,
    'valid_from',s.valid_from,'valid_until',s.valid_until,'start_date',s.start_date,'end_date',s.end_date,
    'state',s.state,'terms_hash',s.terms_hash,'created_at',s.created_at,'previous_sale_id',s.previous_sale_id) order by s.id)
   from core.sales s where s.id=any(sale_ids)),
  'movements',(select coalesce(jsonb_agg(jsonb_build_object('movement_id',m.id,'sale_id',m.sale_id,
    'kind',m.kind,'quantity',m.quantity::text,'operation_id',m.operation_id,'created_at',m.created_at,'previous_id',m.previous_id)
   order by m.created_at,m.id),'[]'::jsonb) from core.entitlement_movements m where m.id=any(movement_ids)),
  'purchase_links',(select coalesce(jsonb_agg(jsonb_build_object('sale_id',u.sale_id,'purchase_preview_id',u.purchase_preview_id,
   'required_versions',coalesce((select jsonb_agg(x->>'version_id' order by x->>'version_id')
      from jsonb_array_elements(d.requirements) x),'[]'::jsonb)) order by u.sale_id),'[]'::jsonb)
   from private.purchase_document_uses u join private.purchase_documents d on d.preview_id=u.purchase_preview_id
   where u.sale_id=any(used_sales))
 ) into scope;

 selected:=jsonb_build_object('sales',sale_ids,'accounts',account_ids,'movements',movement_ids,'products',product_ids,
  'versions',version_ids,'scopes',scope_ids,'purchases',purchase_ids,'used_sales',used_sales,'previews',preview_ids);
 fingerprint:=encode(extensions.digest(jsonb_build_array(scope,selected,
  (select jsonb_agg(to_jsonb(s) order by s.id) from core.sales s where s.id=any(sale_ids)),
  (select jsonb_agg(to_jsonb(a) order by a.id) from core.entitlement_accounts a where a.id=any(account_ids)),
  (select jsonb_agg(to_jsonb(m) order by m.id) from core.entitlement_movements m where m.id=any(movement_ids)),
  (select jsonb_agg(to_jsonb(v) order by v.id) from core.product_versions v where v.id=any(version_ids)),
  (select jsonb_agg(to_jsonb(product) order by product.id) from core.products product where product.id=any(product_ids)),
  (select jsonb_agg(to_jsonb(s) order by s.id) from core.product_scopes s where s.id=any(scope_ids)),
  (select jsonb_agg(to_jsonb(d) order by d.preview_id) from private.purchase_documents d where d.preview_id=any(purchase_ids)),
  (select jsonb_agg(to_jsonb(v) order by v.id) from core.previews v where v.id=any(preview_ids)),
  (select jsonb_agg(to_jsonb(v) order by v.preview_id) from private.preview_payloads v where v.preview_id=any(preview_ids)),
  (select jsonb_agg(to_jsonb(v) order by v.preview_id) from private.p06_previews v where v.org_id=target_org and v.preview_id=any(preview_ids))
 )::text,'sha256'),'hex');
 return jsonb_build_object('state','ready','scope',scope,'source_fingerprint',fingerprint,'selected',selected);
end$$;

create function private.organization_sale_erasure_stage(r jsonb,phase text,archive_digest text default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;a private.organization_sale_erasures;src jsonb;selected jsonb;erased_ids uuid[];
begin
 if phase is null or phase not in ('prepare','confirm') then perform private.fail('FORBIDDEN');end if;
 j:=private.p07_storage_erasure_job(r);
 if phase='prepare' then perform private.p07_privacy_scope(j.org_id);
 elsif not pg_has_role(session_user,'ftk_p07_storage_attestor','member') then perform private.fail('FORBIDDEN');end if;

 select * into a from private.organization_sale_erasures where request_id=j.request_id and org_id=j.org_id
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
  perform 1 from core.organizations where id=j.org_id and state='deletion_pending' for no key update;
  if not found then perform private.fail('FORBIDDEN');end if;
  begin
   lock table core.retention_holds,core.debts,core.student_credit_movements,core.entitlement_allocations,
    core.credit_deficits,core.reservations,core.freezes,core.quota_buckets,core.trial_offers,core.operation_receipts,
    private.p02_sale_settlements,private.p03_sale_refunds,private.settlement_credit_units,private.settlement_movements,
    private.p04_trial_configuration in share mode nowait;
   lock table core.sales,core.entitlement_accounts,core.entitlement_movements,core.products,core.product_versions,core.product_scopes,
    core.previews,private.purchase_documents,private.purchase_document_uses,private.preview_payloads,private.p06_previews
    in share row exclusive mode nowait;
  exception when lock_not_available then
   return jsonb_build_object('state','retry_wait');
  end;
 end if;

 src:=private.organization_sale_archive_source(j.request_id,j.org_id);
 if src->>'state'<>'ready' then return src;end if;
 if src->>'source_fingerprint' is distinct from a.source_fingerprint then perform private.fail('ORGANIZATION_SALE_ARCHIVE_SOURCE_CHANGED');end if;
 if phase='prepare' then return (src-'selected')||jsonb_build_object(
  'source_project_ref',a.source_project_ref,'approval_id',a.approval_id,'retain_until',a.retain_until,
  'archive_scope_sha256',a.archive_scope_sha256,'archive_sha256',a.archive_sha256);
 end if;
 if j.lease_until<=clock_timestamp() or a.retain_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;

 selected:=src->'selected';
 erased_ids:=array(select distinct id::uuid from jsonb_each(selected) s cross join lateral jsonb_array_elements_text(s.value) id order by id::uuid);
 update private.organization_sale_erasures set permit_transaction=pg_catalog.pg_current_xact_id(),permit_rows=selected where request_id=j.request_id;
 delete from private.purchase_document_uses where (selected->'used_sales')?sale_id::text;
 delete from private.purchase_documents where org_id=j.org_id and (selected->'purchases')?preview_id::text;
 delete from private.preview_payloads where (selected->'previews')?preview_id::text;
 delete from private.p06_previews where org_id=j.org_id and (selected->'previews')?preview_id::text;
 delete from core.previews where org_id=j.org_id and (selected->'previews')?id::text;
 delete from core.entitlement_movements where org_id=j.org_id and (selected->'movements')?id::text;
 delete from core.entitlement_accounts where org_id=j.org_id and (selected->'accounts')?id::text;
 delete from core.sales where org_id=j.org_id and (selected->'sales')?id::text;
 delete from core.product_scopes where org_id=j.org_id and (selected->'scopes')?id::text;
 delete from core.product_versions where org_id=j.org_id and (selected->'versions')?id::text;
 delete from core.products where org_id=j.org_id and (selected->'products')?id::text;
 set constraints all immediate;

 if exists(select 1 from private.purchase_document_uses where sale_id=any(erased_ids))
  or exists(select 1 from private.purchase_documents where preview_id=any(erased_ids))
  or exists(select 1 from private.preview_payloads where preview_id=any(erased_ids))
  or exists(select 1 from private.p06_previews where preview_id=any(erased_ids))
  or exists(select 1 from core.previews where id=any(erased_ids))
  or exists(select 1 from core.entitlement_movements where id=any(erased_ids))
  or exists(select 1 from core.entitlement_accounts where id=any(erased_ids))
  or exists(select 1 from core.sales where id=any(erased_ids))
  or exists(select 1 from core.product_scopes where id=any(erased_ids))
  or exists(select 1 from core.product_versions where id=any(erased_ids))
  or exists(select 1 from core.products where id=any(erased_ids))
 then perform private.fail('INTEGRITY_VIOLATION');end if;
 if j.lease_until<=clock_timestamp() or a.retain_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 update private.organization_sale_erasures set completed_at=clock_timestamp(),erased_subject_ids=erased_ids,
  permit_transaction=null,permit_rows=null where request_id=j.request_id;
 return jsonb_build_object('state','completed','archive_sha256',a.archive_sha256);
end$$;

revoke all on function private.organization_sale_history_delete_guard(),
 private.organization_sale_archive_source(uuid,uuid),private.organization_sale_erasure_stage(jsonb,text,text)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
grant execute on function private.organization_sale_erasure_stage(jsonb,text,text) to ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$  when 'private.organization_signed_document_erasures'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Sale DB footprint anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_sale_erasures' then 'r.request_id=$6 and r.org_id=$2 and r.completed_at is not null'
$q$||anchor);

 body:=pg_get_functiondef('private.organization_live_database_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$  ||coalesce((select a.erased_subject_ids from private.organization_signed_document_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}')$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Sale DB scope anchor mismatch';end if;
 execute replace(body,anchor,anchor||$q$
  ||coalesce((select a.erased_subject_ids from private.organization_sale_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}')$q$);
end$patch$;
commit;
