begin;

create table private.organization_live_database_erasure_scopes(
 db_role name not null,request_id uuid not null,org_id uuid not null,
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 primary key(db_role,request_id),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id)
);
create table private.organization_live_database_erasure_receipts(
 request_id uuid primary key,org_id uuid not null,completed_at timestamptz not null default clock_timestamp(),
 covered_tables text[] not null check(cardinality(covered_tables)>0),
 erased_subject_ids uuid[] not null,
 census_sha256 text not null check(census_sha256~'^[a-f0-9]{64}$'),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id)
);
alter table private.organization_live_database_erasure_scopes enable row level security;
alter table private.organization_live_database_erasure_receipts enable row level security;
revoke all on private.organization_live_database_erasure_scopes,private.organization_live_database_erasure_receipts
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
create trigger organization_live_database_erasure_receipts_immutable before update or delete
 on private.organization_live_database_erasure_receipts for each row execute function private.append_only();

-- Only this explicitly reviewed structural footprint may remain in the live DB.
-- A lawful archive or a table with unclear ownership needs its own verified disposition.
create function private.organization_live_database_footprint(qualified text) returns text
 language sql immutable security invoker set search_path='' as $$
 select case qualified
  when 'core.organizations' then 'r.id=$2 and r.org_id=$2 and r.owner_person_id=$3'
  when 'core.people' then 'r.org_id=$2 and (r.id=$3 or r.id=any($4))'
  when 'core.account_links' then 'r.org_id=$2 and r.person_id=$3 and r.account_id=$5 and r.state=''active'' and r.verified_at is not null'
  when 'core.privacy_requests' then 'r.id=$6 and r.org_id=$2'
  when 'core.operation_receipts' then 'r.org_id=$2 and r.id=any($8)'
  when 'core.saas_subscriptions' then
   'r.org_id=$2 and r.state=''pending_payment'' and r.cancel_at_period_end and r.starts_at is null and r.period_end is null and r.grace_until is null'
  when 'core.policy_versions' then
   'r.org_id=$2 and r.id=any($11)'
  when 'core.audit_events' then
   'r.org_id=$2 and r.operation_id=any($8) and (
      (r.action=''organization_create_v1'' and r.subject_table=''organizations'' and r.subject_id=$2 and r.reason is null and r.diff is not distinct from $12)
      or (r.action=''organization_delete_apply_v1'' and r.subject_table=''privacy_requests'' and r.subject_id=$6 and r.reason=$2::text
       and r.diff=jsonb_build_object(''after'',jsonb_build_object(''job_id'',$7,''state'',''pending''),''physical_erasure_complete'',false))
    )'
  when 'core.notifications' then 'r.org_id=$2 and r.id=any($10)'
  when 'core.outbox_jobs' then
   'r.org_id=$2 and r.kind=''in_app'' and r.notification_id=any($10) and r.lease_until is null and r.provider_reference is null
    and exists(select 1 from unnest($8) id where r.dedupe_key=id::text)'
  when 'private.p06_contexts' then
   'r.org_id=$2 and r.account_id=$5 and r.receipt_id=any($8) and r.operation=''organization_delete_apply_v1'' and r.subject=''privacy_requests''
    and r.request->>''org_id''=$2::text and r.request->>''reason''=$2::text and r.request->''all_data''=''true''::jsonb
    and (r.request-array[''org_id'',''reason'',''all_data'',''operation_key'',''request_id'',''client_api_version'',''preview''])=''{}''::jsonb
    and ((r.request->''preview'')-''id''::text)=''{}''::jsonb'
  when 'private.p07_lifecycle_previews' then
   'r.org_id=$2 and r.account_id=$5 and r.operation=''organization_delete_apply_v1'' and r.used
    and r.payload=jsonb_build_object(''client_api_version'',1,''org_id'',$2,''all_data'',true,''reason'',$2::text)'
  when 'private.p07_privacy_jobs' then 'r.id=$7 and r.org_id=$2 and r.request_id=$6'
  when 'private.p07_privacy_manifests' then 'r.request_id=$6'
  when 'private.p07_lifecycle_events' then
   'r.operation_id=any($8) and r.action in (''organization_delete_apply_v1'',''privacy_execute_v1'') and (r.detail->>''request_id''=$6::text or r.detail->>''privacy_request_id''=$6::text)'
  when 'private.organization_contact_erasures' then 'r.request_id=$6 and r.org_id=$2'
  when 'private.organization_operational_erasures' then 'r.request_id=$6 and r.org_id=$2'
  when 'private.organization_projected_contact_erasures' then 'r.request_id=$6 and r.org_id=$2'
  when 'core.files' then 'r.org_id=$2 and r.id=any($9) and r.center_id is null and (r.owner_person_id is null or r.owner_person_id=$3) and r.object_key=($2::text||''/''||r.id::text)'
  when 'private.p05_files' then 'r.file_id=any($9) and r.account_id=$5 and r.name=r.file_id::text'
  when 'private.p06_files' then 'r.file_id=any($9) and r.account_id=$5 and r.filename=r.file_id::text'
  when 'private.p07_storage_erasure_scopes' then 'r.request_id=$6 and r.file_id=any($9)'
  when 'private.p07_storage_erasure_intents' then 'r.request_id=$6 and r.job_id=$7 and r.file_id=any($9)'
  when 'private.p07_storage_erasures' then 'r.request_id=$6 and r.file_id=any($9)'
  when 'private.organization_managed_file_erasure_receipts' then 'r.request_id=$6 and r.org_id=$2 and r.operation_id=any($8)'
  when 'private.organization_file_copy_erasure_receipts' then 'r.request_id=$6 and r.org_id=$2 and r.operation_id=any($8)'
  when 'private.organization_managed_file_erasure_scopes' then
   'r.request_id=$6 and r.db_role=session_user and r.instance_id=(pg_catalog.pg_control_system()).system_identifier::text'
  when 'private.organization_managed_storage_census' then
   'r.request_id=$6 and exists(
     select 1 from private.p07_storage_erasures e join core.files f on f.id=e.file_id
     where e.request_id=$6 and e.object_id=r.object_id and f.id=any($9)
      and r.bucket_id=case f.purpose when ''document'' then ''ftksaas-documents'' when ''import'' then ''ftksaas-imports'' end
      and r.object_key_hash=encode(extensions.digest(f.object_key,''sha256''),''hex'')
   )'
  when 'private.organization_live_database_erasure_receipts' then 'r.request_id=$6 and r.org_id=$2'
  when 'private.organization_live_database_erasure_scopes' then 'r.request_id=$6 and r.org_id=$2'
  when 'private.p07_privacy_worker_scopes' then 'r.org_id=$2'
  when 'private.organization_contact_erasure_scopes' then 'r.org_id=$2'
  when 'private.organization_operational_erasure_scopes' then 'r.org_id=$2'
  when 'private.organization_projected_contact_erasure_scopes' then 'r.org_id=$2'
  else 'false'
 end
$$;
revoke all on function private.organization_live_database_footprint(text) from public,anon,authenticated,service_role,ftk_p07_privacy_worker;

create function private.organization_live_database_erasure(target_request uuid,target_org uuid,stage_receipt uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare j private.p07_privacy_jobs;p core.privacy_requests;o core.organizations;proof private.organization_live_database_erasure_receipts;
 rel record;qualified text;allowed text;scope_pattern text;erasures_pattern text;found_residual boolean;
 people_ids uuid[];erased_ids uuid[];shared_user uuid;link uuid;operation_ids uuid[];references_ids uuid[];file_ids uuid[];
 notification_ids uuid[];default_ids uuid[];initial_policy jsonb;
 covered text[]:='{}';blocked text[]:='{}';fingerprint text;removed bigint;
begin
 perform private.p07_privacy_scope(target_org);
 perform 1 from private.organization_live_database_erasure_scopes
 where db_role=session_user and request_id=target_request and org_id=target_org
  and instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share;
 if not found then return jsonb_build_object('state','unbound');end if;
 select * into j from private.p07_privacy_jobs where request_id=target_request and org_id=target_org for update;
 if j.id is null or j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp() then
  perform private.fail('OPERATION_IN_PROGRESS');
 end if;
 select * into p from core.privacy_requests where id=target_request and org_id=target_org for update;
 if p.id is null or p.kind<>'organization_delete' or p.state not in ('requested','running','partial')
  or p.scope is distinct from jsonb_build_object('kind','organization','org_id',target_org,'account_id',null,'all_data',true) then
  perform private.fail('FORBIDDEN');
 end if;
 select * into o from core.organizations where id=target_org and state='deletion_pending' for no key update;
 if o.id is null then perform private.fail('FORBIDDEN');end if;

 -- A closed source can still receive a privileged write or a provider callback.
 -- Bind the classified footprint to one quiescent transaction without waiting for a writer.
 for rel in
  select n.nspname as schema_name,c.relname as table_name
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p') and not c.relispartition and n.nspname in ('core','private','public')
  order by n.nspname,c.relname
 loop
  execute format('lock table %I.%I in share mode nowait',rel.schema_name,rel.table_name);
  covered:=array_append(covered,format('%I.%I',rel.schema_name,rel.table_name));
 end loop;
 select a.auth_user_id,l.id into shared_user,link from core.account_links l
 join core.accounts a on a.id=l.account_id and a.state='active'
 join auth.users u on u.id=a.auth_user_id
 where l.org_id=target_org and l.person_id=o.owner_person_id and l.account_id=p.requester_account_id
  and l.state='active' and l.verified_at is not null;
 if link is null or not exists(
  select 1 from core.people where id=o.owner_person_id and org_id=target_org and state='active' and merged_into_id is null
 ) then perform private.fail('INTEGRITY_VIOLATION');end if;
 select * into proof from private.organization_live_database_erasure_receipts where request_id=target_request;
 if proof.request_id is not null and proof.org_id<>target_org then perform private.fail('INTEGRITY_VIOLATION');end if;
 select array(
  select id from core.people where org_id=target_org and id<>o.owner_person_id
   and state='active' and merged_into_id is null order by id limit 101
 ) into people_ids;
 if cardinality(people_ids)>100 then return jsonb_build_object('state','blocked','blocked_relations',jsonb_build_array('core.people'));end if;
 if proof.request_id is not null and cardinality(people_ids)>0 then
  return jsonb_build_object('state','blocked','blocked_relations',jsonb_build_array('core.people'));
 end if;
 erased_ids:=coalesce(proof.erased_subject_ids,people_ids);
 select array(
  select id from core.operation_receipts r where r.org_id=target_org and (
   (r.id=stage_receipt and r.operation='privacy_execute_v1' and r.state='in_progress')
   or (r.business_reference=target_request and r.operation in ('privacy_execute_v1','organization_delete_apply_v1') and r.state='succeeded')
   or (r.business_reference=target_org and r.operation='organization_create_v1' and r.state='succeeded'
    and r.result#>>'{data,primary_id}'=target_org::text)
  ) order by id
 ) into operation_ids;
 if not stage_receipt=any(operation_ids) then perform private.fail('INTEGRITY_VIOLATION');end if;
 select array(
  select f.id from core.files f join private.p07_storage_erasures e on e.file_id=f.id and e.request_id=target_request
  where f.org_id=target_org and f.checksum=e.checksum and f.size_bytes=e.removed_bytes
   and ((f.purpose='document' and exists(
    select 1 from private.p05_files s where s.file_id=f.id and s.account_id=p.requester_account_id and s.name=s.file_id::text
   )) or (f.purpose='import' and exists(
    select 1 from private.p06_files s where s.file_id=f.id and s.account_id=p.requester_account_id and s.filename=s.file_id::text
   ))) order by f.id
 ) into file_ids;
 select array(
  select n.id from core.notifications n where n.org_id=target_org and n.recipient_person_id=o.owner_person_id
   and ((n.kind='organization_create_v1' and n.subject_id=target_org
    and n.payload=jsonb_build_object('template_key',n.kind,'subject',jsonb_build_object('type','organizations','id',target_org)))
   or (n.kind='organization_delete_apply_v1' and n.subject_id=target_request
    and n.payload=jsonb_build_object('template_key',n.kind,'subject',jsonb_build_object('type','privacy_requests','id',target_request))))
  order by n.id
 ) into notification_ids;
 with defaults as (
  select v.key,v.id from core.policy_versions v
  where v.org_id=target_org and v.scope_center_id is null and v.previous_id is null and v.version=1 and not v.mandatory
   and ((v.key='negative_default' and v.value='{"kind":"integer","value":0}'::jsonb)
    or (v.key in ('debt_booking','debt_participation') and v.value='{"kind":"boolean","value":true}'::jsonb)
    or (v.key='reservation_window' and v.value='{"kind":"window","opens_minutes_before":10080,"closes_minutes_before":0,"manager_exception":false}'::jsonb))
   and exists(select 1 from core.operation_receipts r where r.id=any(operation_ids) and r.operation='organization_create_v1')
 )
 select array(select id from defaults order by id),case when count(*)=4 and count(distinct key)=4 then
  jsonb_build_object('initial_policy',jsonb_build_object('key','negative_default','value',0,'source','FD07',
   'policy_version_id',min(id::text) filter(where key='negative_default'),
   'debt_booking_policy_id',min(id::text) filter(where key='debt_booking'),
   'debt_participation_policy_id',min(id::text) filter(where key='debt_participation'),
   'reservation_window_policy_id',min(id::text) filter(where key='reservation_window')))
 end into default_ids,initial_policy from defaults;
 if cardinality(default_ids)<>4 or initial_policy is null then default_ids:='{}';end if;
 references_ids:=array[target_org,target_request,j.id,o.owner_person_id,link]||erased_ids||operation_ids||file_ids||notification_ids||default_ids
  ||array(select id from private.p07_lifecycle_events where operation_id=any(operation_ids));
 if exists(
  select 1 from core.retention_holds h where h.org_id=target_org or h.subject_id=any(references_ids)
   or (h.subject_table in ('accounts','core.accounts','users','auth.users') and h.subject_id in (p.requester_account_id,shared_user))
 ) then return jsonb_build_object('state','held');end if;

 scope_pattern:=array_to_string(references_ids,'|');
 erasures_pattern:=nullif(array_to_string(erased_ids,'|'),'');
 foreach qualified in array covered loop
  if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
  allowed:=private.organization_live_database_footprint(qualified);
  execute format('select exists(select 1 from %s r where lower(to_jsonb(r)::text)~$1 and not coalesce((%s),false))',
   qualified,allowed)
  into found_residual using scope_pattern,target_org,o.owner_person_id,people_ids,p.requester_account_id,target_request,j.id,operation_ids,file_ids,
   notification_ids,default_ids,initial_policy;
  if found_residual then blocked:=array_append(blocked,qualified);end if;
 end loop;
 if cardinality(blocked)>0 then return jsonb_build_object('state','blocked','blocked_relations',blocked);end if;
 if proof.request_id is null then
  delete from core.people where org_id=target_org and id=any(people_ids);
  get diagnostics removed=row_count;
  if removed<>cardinality(people_ids) then perform private.fail('INTEGRITY_VIOLATION');end if;
  update core.people set display_name=id::text,given_name=null,family_name=null
  where org_id=target_org and id=o.owner_person_id;
  update core.organizations set name=id::text where id=target_org;
 end if;
 if not exists(select 1 from core.organizations where id=target_org and name=id::text and state='deletion_pending')
  or not exists(select 1 from core.people where id=o.owner_person_id and org_id=target_org
   and display_name=id::text and given_name is null and family_name is null) then
  return jsonb_build_object('state','blocked','blocked_relations',jsonb_build_array('core.organizations','core.people'));
 end if;
 if erasures_pattern is not null then
  foreach qualified in array covered loop
   if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
   if qualified='private.organization_live_database_erasure_receipts' then continue;end if;
   execute format('select exists(select 1 from %s r where lower(to_jsonb(r)::text)~$1)',qualified)
   into found_residual using erasures_pattern;
   if found_residual then
    if proof.request_id is null then perform private.fail('INTEGRITY_VIOLATION');end if;
    blocked:=array_append(blocked,qualified);
   end if;
  end loop;
 end if;
 if cardinality(blocked)>0 then return jsonb_build_object('state','blocked','blocked_relations',blocked);end if;
 if proof.request_id is null then
  fingerprint:=encode(extensions.digest(jsonb_build_object(
   'request_id',target_request,'org_id',target_org,'covered_tables',covered,'erased_subject_ids',erased_ids
  )::text,'sha256'),'hex');
  insert into private.organization_live_database_erasure_receipts(request_id,org_id,covered_tables,erased_subject_ids,census_sha256)
  values(target_request,target_org,covered,erased_ids,fingerprint) returning * into proof;
 end if;
 return jsonb_build_object('state','completed','completed_at',proof.completed_at,'removed_rows',cardinality(proof.erased_subject_ids));
end$$;
revoke all on function private.organization_live_database_erasure(uuid,uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker;

do $patch$
declare body text;anchor text:=' insert into private.p07_privacy_manifests(request_id,scopes)';
begin
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization live database erasure manifest anchor mismatch';end if;
 execute replace(body,anchor,$a$ if org is not null then
  scopes:=jsonb_set(scopes,'{database,live_database}',private.organization_live_database_erasure(p.id,org,receipt_id));
  if scopes#>>'{database,live_database,state}'='completed' then
   scopes:=jsonb_set(scopes,'{database,state}','"completed"'::jsonb);
  end if;
 end if;
$a$||anchor);
end$patch$;

commit;
