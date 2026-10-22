-- P06 private execution context; clients have no table grants or file policies.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ftksaas-imports','ftksaas-imports',false,2097152,array['text/csv']) on conflict(id) do nothing;
do $$begin if exists(select 1 from storage.buckets where id='ftksaas-imports' and (public or (file_size_limit is null or file_size_limit>2097152) or allowed_mime_types is distinct from array['text/csv'])) then raise exception 'Import bucket configuration mismatch';end if;end$$;
create table private.p06_configuration(org_id uuid primary key references core.organizations(id),max_import_bytes bigint not null check(max_import_bytes between 1 and 2097152),max_import_rows int not null check(max_import_rows between 1 and 5000),max_export_bytes bigint not null check(max_export_bytes between 1 and 16777216));
create table private.p06_files(file_id uuid primary key references core.files(id),account_id uuid not null references core.accounts(id),filename text not null);
create table private.p06_contexts(receipt_id uuid primary key references core.operation_receipts(id),org_id uuid,account_id uuid not null references core.accounts(id),operation text not null,request jsonb not null,subject text not null);
create table private.p06_previews(preview_id uuid primary key references core.previews(id),org_id uuid not null references core.organizations(id),account_id uuid not null references core.accounts(id),operation text not null,request jsonb not null,response jsonb not null,expires_at timestamptz not null);
create table private.p06_jobs(job_id uuid primary key references core.outbox_jobs(id),org_id uuid not null references core.organizations(id),account_id uuid not null references core.accounts(id),person_id uuid not null,center_id uuid,operation text not null check(operation in ('report_build_v1','import_rows_process_v1')),request jsonb not null,phase text not null check(phase in ('report','preview','apply')),progress_count bigint not null default 0,total_count bigint,result_reference jsonb,safe_error_code text,operation_key uuid,lease_hash text,payload_hash text,result jsonb,approved_dependencies jsonb);
create index p06_jobs_org on private.p06_jobs(org_id,job_id);
create table private.p06_export_files(file_id uuid primary key references core.files(id),job_id uuid not null references core.report_jobs(id),body bytea not null);
create table private.p06_sources(org_id uuid not null references core.organizations(id),source_namespace text not null,source_key text not null,center_id uuid not null,payload_hash text not null,person_id uuid not null,created_references jsonb not null,operation_id uuid not null,primary key(org_id,source_namespace,source_key),foreign key(org_id,person_id) references core.people(org_id,id),foreign key(org_id,operation_id) references core.operation_receipts(org_id,id) deferrable initially deferred);
create unique index p06_import_row_number on core.import_rows(org_id,job_id,row_number);
create index p06_import_pending on core.import_rows(org_id,job_id,state,row_number);
create index p06_receipt_lookup on core.operation_receipts(actor_account_id,org_id,operation,key_hash);
create index p06_audit_subject on core.audit_events(org_id,subject_table,subject_id,created_at,id);
do $$declare t text;begin foreach t in array array['p06_configuration','p06_files','p06_contexts','p06_previews','p06_jobs','p06_export_files','p06_sources'] loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated',t);execute format('grant all on private.%I to service_role',t);end loop;end$$;
create function private.p06_granted(org uuid,actor uuid,center uuid,perm text) returns boolean language sql stable security invoker set search_path='' as $$
 select private.has_role(org,actor,'staff',center) and exists(select 1 from core.permission_overrides p where p.org_id=org and p.person_id=actor and p.center_id=center and p.permission=perm and p.enabled)
$$;
create function private.p06_report_scope(r jsonb,org uuid,center uuid,actor uuid,exporting boolean default false) returns uuid[] language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare centers uuid[];c uuid;kind text:=r->>'report';plan text;financial boolean:=kind in ('collections_debts','earnings','cross_center_usage');s timestamptz:=(r#>>'{filters,interval,starts_at}')::timestamptz;e timestamptz:=(r#>>'{filters,interval,ends_at}')::timestamptz;
begin
 perform private.require_feature(org,'F28');
 if kind not in ('collections_debts','lesson_attendance','renewal','occupancy','resource_usage','earnings','crm_conversion','cross_center_usage') or s is null or e is null or not isfinite(s) or not isfinite(e) or s>=e or e-s>interval '366 days' then perform private.fail('VALIDATION_FAILED');end if;
 select p.name into plan from core.saas_subscriptions sub join core.saas_plan_versions p on p.id=sub.plan_version_id where sub.org_id=org order by sub.created_at desc,sub.id desc limit 1;
 if plan is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if plan='starter' and kind not in ('collections_debts','lesson_attendance') or kind='cross_center_usage' and plan<>'business' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 if financial then perform private.require_feature(org,'F06');perform private.require_feature(org,'F19');end if;
 if kind='crm_conversion' then perform private.require_feature(org,'F21');end if;
 if kind='earnings' then perform private.require_feature(org,'F20');end if;
 if kind='cross_center_usage' then perform private.require_feature(org,'F18');end if;
 select array_agg(distinct value::uuid order by value::uuid) into centers from jsonb_array_elements_text(r#>'{filters,center_ids}');
 if centers is null then
  if center is not null then centers:=array[center];
  elsif private.is_org_reader(org,actor) then select array_agg(c.id order by c.id) into centers from core.centers c where c.org_id=org and private.center_accessible(org,c.id);
  else perform private.fail('FORBIDDEN');end if;
 end if;
 if center is not null and exists(select 1 from unnest(centers) c where c<>center) then perform private.fail('FORBIDDEN');end if;
 if cardinality(centers)>1 and plan<>'business' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 foreach c in array coalesce(centers,'{}'::uuid[]) loop
  perform private.assert_center(org,c);
  if not private.is_org_reader(org,actor) and not private.is_manager(org,actor,c) and not private.p06_granted(org,actor,c,'report.read') then perform private.fail('FORBIDDEN');end if;
  if financial and not private.is_org_reader(org,actor) and not private.is_manager(org,actor,c) and not private.p06_granted(org,actor,c,'finance.read') then perform private.fail('FORBIDDEN');end if;
  if exporting and not private.is_org_reader(org,actor) and not private.is_manager(org,actor,c) and (not private.p06_granted(org,actor,c,'report.export') or kind='crm_conversion') then perform private.fail('FORBIDDEN');end if;
 end loop;
 if exists(select 1 from jsonb_array_elements_text(coalesce(r#>'{filters,person_ids}','[]')) p where not exists(select 1 from core.people x join core.center_relationships cr on cr.org_id=x.org_id and cr.person_id=x.id where x.org_id=org and x.id=p.value::uuid and cr.center_id=any(centers))) then perform private.fail('NOT_FOUND');end if;
 return coalesce(centers,'{}'::uuid[]);
end$$;
create function private.p06_import_access(org uuid,center uuid,actor uuid,writing boolean default true) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if center is null then perform private.fail('VALIDATION_FAILED');end if;perform private.assert_center(org,center);perform private.require_feature(org,'F31');
 if not private.is_manager(org,actor,center) and not private.p06_granted(org,actor,center,'import.execute') then perform private.fail('FORBIDDEN');end if;
 if writing and private.access_mode(org)<>'normal' then perform private.fail('BILLING_OPERATION_RESTRICTED');end if;
end$$;
-- Scope is derived from immutable server-side job/preview context, never caller flags.
create function private.p06_import_file_access(org uuid,center uuid,actor uuid,account uuid,fid uuid) returns core.files language plpgsql stable security invoker set search_path='' as $$
declare f core.files;
begin
 select x.* into f from core.files x join private.p06_files p on p.file_id=x.id and p.account_id=account where x.org_id=org and x.id=fid and x.purpose='import' and x.owner_person_id=actor;
 if f.id is null or center is not null and center is distinct from f.center_id then perform private.fail('NOT_FOUND');end if;
 perform private.p06_import_access(org,f.center_id,actor);return f;
end$$;
create function private.p06_access(op text,r jsonb,org uuid,center uuid,actor uuid,account uuid) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare j private.p06_jobs;ctx private.p06_previews;
begin
 if op in ('report_get_v1','report_export_start_v1') then perform private.p06_report_scope(r,org,center,actor,op='report_export_start_v1');
 elsif op in ('report_file_get_v1','job_status_get_v1','import_rows_list_v1') then
  select * into j from private.p06_jobs where org_id=org and job_id=(r->>'job_id')::uuid and account_id=account;
  if j.job_id is null or center is not null and center is distinct from j.center_id then perform private.fail('NOT_FOUND');end if;
  if op='report_file_get_v1' and j.operation<>'report_build_v1' or op='import_rows_list_v1' and j.operation<>'import_rows_process_v1' then perform private.fail('NOT_FOUND');end if;
  if j.operation='report_build_v1' then perform private.p06_report_scope(j.request,org,j.center_id,actor,true);else perform private.p06_import_access(org,j.center_id,actor,false);end if;
 elsif op in ('import_upload_prepare_v1','import_preview_v1') then perform private.p06_import_access(org,center,actor);
 elsif op='import_apply_v1' then
  select * into ctx from private.p06_previews where org_id=org and account_id=account and preview_id=(r#>>'{preview,id}')::uuid and operation='import_preview_v1';
  if ctx.preview_id is null or center is not null and center is distinct from (ctx.request->>'center_id')::uuid then perform private.fail('NOT_FOUND');end if;
  perform private.p06_import_access(org,(ctx.request->>'center_id')::uuid,actor);
 elsif op in ('operation_status_get_v1','preview_get_v1') then null; -- original authorization is checked before returning a result
 elsif op in ('import_rows_process_v1','report_build_v1') then perform private.fail('FORBIDDEN');
 elsif op='audit_list_v1' then null; -- static subject resolver below
 else perform private.fail('FORBIDDEN');end if;
end$$;
commit;
