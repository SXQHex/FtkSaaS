begin;

create table private.organization_import_copy_erasure_scopes(
 db_role name not null,request_id uuid not null references core.privacy_requests(id),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 primary key(db_role,request_id)
);
create table private.organization_import_copy_erasures(
 operation_id uuid primary key,request_id uuid not null,org_id uuid not null,
 completed_at timestamptz not null default clock_timestamp(),
 removed_rows int not null check(removed_rows>=0),removed_previews int not null check(removed_previews>=0),
 removed_preview_payloads int not null check(removed_preview_payloads>=0),removed_contexts int not null check(removed_contexts>=0),
 check(removed_rows+removed_previews+removed_preview_payloads+removed_contexts between 1 and 100),
 foreign key(org_id,operation_id) references core.operation_receipts(org_id,id),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id)
);
create index organization_import_copy_erasures_request on private.organization_import_copy_erasures(request_id);
alter table private.organization_import_copy_erasure_scopes enable row level security;
alter table private.organization_import_copy_erasures enable row level security;
revoke all on private.organization_import_copy_erasure_scopes,private.organization_import_copy_erasures
 from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker;
create trigger organization_import_copy_erasures_immutable before update or delete on private.organization_import_copy_erasures
 for each row execute function private.append_only();

create function private.p06_import_copy_candidates(target_org uuid)
 returns table(kind text,copy_id uuid,held boolean,unproved boolean)
 language sql stable security invoker set search_path='' as $$
 with terminal as materialized (
  select j.id,j.requester_account_id,j.center_id,j.file_id,j.preview_id,j.source_namespace,
   exists (
    select 1 from core.retention_holds h
    cross join lateral (values
     ('organizations',j.org_id),('import_jobs',j.id),('outbox_jobs',j.id),('p06_jobs',j.id),
     ('accounts',j.requester_account_id),('people',f.owner_person_id),('people',w.person_id),
     ('centers',j.center_id),('files',j.file_id),('p06_files',j.file_id),('previews',j.preview_id)
    ) ref(kind,id)
    where h.subject_id=ref.id and h.subject_table in(ref.kind,'core.'||ref.kind,'private.'||ref.kind)
     and (ref.kind='accounts' or h.org_id=j.org_id)
   ) or exists (
    select 1 from core.retention_holds h join storage.objects o on o.id=h.subject_id
    where h.org_id=j.org_id and h.subject_table in ('objects','storage.objects')
     and o.bucket_id='ftksaas-imports' and o.name=f.object_key
   ) hold_job
  from core.import_jobs j
  join core.outbox_jobs o on o.id=j.id and o.org_id=j.org_id and o.kind='p06.import'
  join private.p06_jobs w on w.job_id=j.id and w.org_id=j.org_id and w.center_id=j.center_id
   and w.account_id=j.requester_account_id and w.operation='import_rows_process_v1' and w.request->>'file_id'=j.file_id::text
  join core.files f on f.id=j.file_id and f.org_id=j.org_id and f.center_id=j.center_id
   and f.purpose='import' and f.checksum=j.file_checksum
  join private.p06_files a on a.file_id=f.id and a.account_id=j.requester_account_id
  left join core.previews p on p.id=j.preview_id and p.org_id=j.org_id and p.actor_account_id=j.requester_account_id
   and p.operation='import_apply_v1'
  where j.org_id=target_org and o.lease_until is null and j.state=o.state
   and (j.state in ('failed','cancelled') or (j.state='succeeded' and w.phase='apply' and p.state='applied'))
   and (j.preview_id is null or (p.id is not null and not exists(
    select 1 from core.import_jobs q where q.org_id=j.org_id and q.preview_id=p.id and q.id<>j.id
   )))
 ), staged_rows as materialized (
  select x.id,x.job_id,x.payload<>'{}'::jsonb has_payload,j.hold_job or exists (
   select 1 from core.retention_holds h
   where h.org_id=x.org_id and (
    (h.subject_table in ('import_rows','core.import_rows') and h.subject_id=x.id)
    or h.subject_id=any(x.created_references)
    or (h.subject_table in ('people','core.people') and h.subject_id::text=x.payload->>'person_ref')
    or (h.subject_table in ('operation_receipts','core.operation_receipts') and h.subject_id=s.operation_id)
   )
  ) hold_row,
  case when x.payload='{}'::jsonb then false
   when x.source_namespace is distinct from j.source_namespace then true
   when x.state='applied' then s.payload_hash is distinct from encode(extensions.digest(x.payload::text,'sha256'),'hex')
   or x.created_references is distinct from array(select (ref->>'id')::uuid from jsonb_array_elements(s.created_references) ref)
   else cardinality(x.created_references)<>0 or exists(
    select 1 from core.public_applications a where a.org_id=x.org_id and a.import_row_id=x.id
   )
  end unproved
  from core.import_rows x join terminal j on j.id=x.job_id
  left join private.p06_sources s on s.org_id=x.org_id and s.source_namespace=x.source_namespace
   and s.source_key=x.source_key and s.center_id=x.center_id
  where x.org_id=target_org and x.center_id=j.center_id
 ), protected_jobs as materialized (
  select j.*,j.hold_job or exists(select 1 from staged_rows x where x.job_id=j.id and x.hold_row)
   or exists(select 1 from core.retention_holds h where h.org_id=target_org and h.subject_id=j.preview_id
    and h.subject_table in ('p06_previews','private.p06_previews','preview_payloads','private.preview_payloads')) hold_artifacts,
   exists(select 1 from staged_rows x where x.job_id=j.id and x.unproved) unproved_rows
  from terminal j
 )
 select 'row',x.id,x.hold_row,x.unproved from staged_rows x where x.has_payload
 union all
 select 'preview',p.preview_id,j.hold_artifacts,j.unproved_rows
 from protected_jobs j join private.p06_previews p on p.preview_id=j.preview_id
  and p.org_id=target_org and p.account_id=j.requester_account_id and p.operation='import_preview_v1'
  and p.request->>'file_id'=j.file_id::text
 union all
 select 'preview_payload',p.preview_id,j.hold_artifacts,j.unproved_rows
 from protected_jobs j join private.preview_payloads p on p.preview_id=j.preview_id
  and p.payload->>'job_id'=j.id::text and p.payload->>'center_id'=j.center_id::text
 union all
 select 'context',c.receipt_id,j.hold_artifacts or exists(
  select 1 from core.retention_holds h where h.org_id=target_org and h.subject_id=c.receipt_id
   and h.subject_table in ('operation_receipts','core.operation_receipts','p06_contexts','private.p06_contexts')
 ),j.unproved_rows
 from protected_jobs j join core.operation_receipts r on r.org_id=target_org and r.business_reference=j.id
  and r.actor_account_id=j.requester_account_id and r.state='succeeded'
 join private.p06_contexts c on c.receipt_id=r.id and c.org_id=target_org and c.account_id=j.requester_account_id
  and c.operation=r.operation and c.operation in ('import_preview_v1','import_apply_v1')
$$;

create function private.organization_import_copy_erasure(target_request uuid,target_org uuid,receipt uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare lease timestamptz;item record;n int;eligible boolean;held boolean;unproved boolean;
 rows_removed int:=0;previews_removed int:=0;payloads_removed int:=0;contexts_removed int:=0;
begin
 perform private.p07_privacy_scope(target_org);
 perform 1 from private.organization_import_copy_erasure_scopes s where s.db_role=session_user and s.request_id=target_request
  and s.instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share;
 if not found then return jsonb_build_object('state','unbound');end if;
 select j.lease_until into lease from private.p07_privacy_jobs j
 where j.request_id=target_request and j.org_id=target_org and j.state='running' for update;
 if lease is null or lease<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 perform 1 from core.privacy_requests p where p.id=target_request and p.org_id=target_org and p.kind='organization_delete'
  and p.state in ('requested','running','partial') and p.scope->>'org_id'=target_org::text and p.scope->'all_data'='true'::jsonb for share;
 if not found then perform private.fail('FORBIDDEN');end if;
 perform 1 from core.organizations where id=target_org and state='deletion_pending' for no key update;
 if not found then perform private.fail('FORBIDDEN');end if;
 lock table core.retention_holds in share mode;

 for item in select c.* from private.p06_import_copy_candidates(target_org) c
  where not c.held and not c.unproved order by c.kind,c.copy_id limit 100 loop
  if lease<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
  case item.kind
   when 'row' then
    update core.import_rows set payload='{}'::jsonb,version=version+1 where id=item.copy_id and org_id=target_org;
    get diagnostics n=row_count;rows_removed:=rows_removed+n;
   when 'preview' then
    delete from private.p06_previews where preview_id=item.copy_id and org_id=target_org;
    get diagnostics n=row_count;previews_removed:=previews_removed+n;
   when 'preview_payload' then
    delete from private.preview_payloads where preview_id=item.copy_id;
    get diagnostics n=row_count;payloads_removed:=payloads_removed+n;
   when 'context' then
    delete from private.p06_contexts where receipt_id=item.copy_id and org_id=target_org;
    get diagnostics n=row_count;contexts_removed:=contexts_removed+n;
  end case;
  if n<>1 then perform private.fail('INTEGRITY_VIOLATION');end if;
 end loop;
 if rows_removed+previews_removed+payloads_removed+contexts_removed>0 then
  insert into private.organization_import_copy_erasures(operation_id,request_id,org_id,removed_rows,removed_previews,removed_preview_payloads,removed_contexts)
  values(receipt,target_request,target_org,rows_removed,previews_removed,payloads_removed,contexts_removed);
 end if;
 select bool_or(not c.held and not c.unproved),bool_or(c.held),bool_or(c.unproved) into eligible,held,unproved
 from private.p06_import_copy_candidates(target_org) c;
 if lease<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 return (
  select jsonb_build_object('state',case when eligible then 'retry_wait' when unproved then 'blocked_provenance' when held then 'held' else 'completed' end,
   'removed_rows',coalesce(sum(removed_rows),0),'removed_previews',coalesce(sum(removed_previews),0),
   'removed_preview_payloads',coalesce(sum(removed_preview_payloads),0),'removed_contexts',coalesce(sum(removed_contexts),0))
  from private.organization_import_copy_erasures where request_id=target_request and org_id=target_org
 );
end$$;

do $patch$
declare body text;anchor text:=' insert into private.p07_privacy_manifests(request_id,scopes)';
begin
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization import copy manifest anchor mismatch';end if;
 execute replace(body,anchor,$a$ if org is not null then
  scopes:=jsonb_set(scopes,'{exports,import_processing_copies}',private.organization_import_copy_erasure(p.id,org,receipt_id));
 end if;
$a$||anchor);
end$patch$;
revoke all on function private.p06_import_copy_candidates(uuid),private.organization_import_copy_erasure(uuid,uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

commit;
