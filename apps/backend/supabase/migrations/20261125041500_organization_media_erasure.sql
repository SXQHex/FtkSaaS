begin;

create table private.organization_media_erasures(
 request_id uuid primary key,org_id uuid not null,operation_id uuid not null,
 worker_role name not null,permit_transaction xid8,completed_at timestamptz,
 erased_asset_ids uuid[] not null,asset_bytes bigint not null check(asset_bytes>=0),
 history_rows bigint not null check(history_rows>=0),pointer_rows bigint not null check(pointer_rows between 0 and 1),
 sources_sha256 text not null check(sources_sha256~'^[a-f0-9]{64}$'),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id),
 foreign key(org_id,operation_id) references core.operation_receipts(org_id,id),
 check((completed_at is null)<>(permit_transaction is null)),
 check(cardinality(erased_asset_ids)+history_rows+pointer_rows>0),
 check((asset_bytes>0)=(cardinality(erased_asset_ids)>0))
);
alter table private.organization_media_erasures enable row level security;
revoke all on private.organization_media_erasures from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger organization_media_erasure_immutable before update or delete on private.organization_media_erasures
 for each row when(old.completed_at is not null) execute function private.append_only();

-- Native organization media is bounded bytea. Its current pointer, previous
-- references and original bytes move through one leased PostgreSQL commit.
create function private.organization_media_erase(target_request uuid,target_org uuid,stage_receipt uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare skey text:='organization:'||target_org::text;j private.p07_privacy_jobs;
 privacy_target core.privacy_requests;proof private.organization_media_erasures;
 asset_ids uuid[];history_ids uuid[];pointer_count bigint;byte_count bigint;source_digest text;
begin
 perform private.p07_privacy_scope(target_org);
 perform 1 from private.organization_managed_file_erasure_scopes s where s.db_role=session_user
  and s.request_id=target_request and s.instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share;
 if not found then perform private.fail('FORBIDDEN');end if;
 select * into j from private.p07_privacy_jobs where request_id=target_request and org_id=target_org for update;
 if j.id is null or j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp()
  then perform private.fail('OPERATION_IN_PROGRESS');end if;
 select * into privacy_target from core.privacy_requests p where p.id=target_request and p.org_id=target_org
  and p.kind='organization_delete' and p.state in ('requested','running','partial')
  and p.scope=jsonb_build_object('kind','organization','org_id',target_org,'account_id',null,'all_data',true) for share;
 if privacy_target.id is null or not exists(select 1 from core.organizations where id=target_org and state='deletion_pending' for share)
  or not exists(select 1 from core.operation_receipts r where r.org_id=target_org and r.id=stage_receipt
   and r.operation='privacy_execute_v1' and r.state='in_progress' and r.actor_fingerprint='worker:privacy:'||session_user)
  then perform private.fail('FORBIDDEN');end if;
 select * into proof from private.organization_media_erasures where request_id=target_request and org_id=target_org;

 if exists(select 1 from private.settings_media_assets where scope_key=skey)
  or exists(select 1 from private.settings_media_current where scope_key=skey)
  or exists(select 1 from private.settings_media_history where scope_key=skey) then
  if proof.completed_at is not null then return jsonb_build_object('state','blocked_reappearance');end if;
  if proof.request_id is not null then perform private.fail('INTEGRITY_VIOLATION');end if;
  begin
   lock table core.retention_holds in share mode nowait;
   lock table private.settings_media_assets,private.settings_media_current,private.settings_media_history in share row exclusive mode nowait;
  exception when lock_not_available then
   return jsonb_build_object('state','retry_wait');
  end;

  select coalesce(array_agg(a.id order by a.id),'{}'),coalesce(sum(octet_length(a.body)),0),
   encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(a.id,octet_length(a.body),a.checksum) order by a.id),'[]'::jsonb)::text,'sha256'),'hex')
  into asset_ids,byte_count,source_digest from private.settings_media_assets a where a.scope_key=skey;
  select coalesce(array_agg(h.operation_id order by h.operation_id),'{}') into history_ids
  from private.settings_media_history h where h.scope_key=skey;
  select count(*) into pointer_count from private.settings_media_current c where c.scope_key=skey;
  if cardinality(asset_ids)+cardinality(history_ids)+pointer_count=0 then return null;end if;

  if exists(select 1 from core.retention_holds h
    where (h.org_id=target_org or h.org_id is null)
     and h.subject_id=any(array[target_org,target_request,privacy_target.requester_account_id]||asset_ids||history_ids))
   then return jsonb_build_object('state','held');end if;
  if exists(select 1 from private.settings_media_assets a where a.id=any(asset_ids)
     and encode(extensions.digest(a.body,'sha256'),'hex')<>a.checksum)
   or exists(select 1 from private.settings_media_current c where c.asset_id is not null
    and (c.scope_key=skey) is distinct from (c.asset_id=any(asset_ids)))
   or exists(select 1 from private.settings_media_history h where
     ((h.scope_key=skey) is distinct from (h.before_asset_id=any(asset_ids)) and h.before_asset_id is not null)
     or ((h.scope_key=skey) is distinct from (h.after_asset_id=any(asset_ids)) and h.after_asset_id is not null))
   or exists(select 1 from core.operation_receipts r where r.id=any(history_ids)
    and (r.org_id is distinct from target_org or r.operation<>'settings_update_v1'
     or r.state not in ('succeeded','result_expired')))
   then return jsonb_build_object('state','blocked_mixed_media');end if;

  if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
  insert into private.organization_media_erasures(request_id,org_id,operation_id,worker_role,permit_transaction,
   erased_asset_ids,asset_bytes,history_rows,pointer_rows,sources_sha256)
  values(target_request,target_org,stage_receipt,session_user,pg_catalog.pg_current_xact_id(),asset_ids,byte_count,
   cardinality(history_ids),pointer_count,source_digest);
  delete from private.settings_media_current where scope_key=skey;
  delete from private.settings_media_history where scope_key=skey and operation_id=any(history_ids);
  delete from private.settings_media_assets where scope_key=skey and id=any(asset_ids);
  if exists(select 1 from private.settings_media_current where scope_key=skey)
   or exists(select 1 from private.settings_media_history where scope_key=skey)
   or exists(select 1 from private.settings_media_assets where scope_key=skey)
   then perform private.fail('INTEGRITY_VIOLATION');end if;
  if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
  update private.organization_media_erasures set completed_at=clock_timestamp(),permit_transaction=null
   where request_id=target_request returning * into proof;
 end if;
 if proof.completed_at is null then return null;end if;
 return jsonb_build_object('state','completed','assets',cardinality(proof.erased_asset_ids),'asset_bytes',proof.asset_bytes,
  'history_rows',proof.history_rows,'pointer_rows',proof.pointer_rows,'sources_sha256',proof.sources_sha256);
end$$;
revoke all on function private.organization_media_erase(uuid,uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.account_profile_media_erasure_guard()'::regprocedure);
 anchor:=$q$  request:=nullif(current_setting('ftk.profile_erasure_request',true),'')::uuid;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization media trigger anchor mismatch';end if;
 execute replace(body,anchor,$q$  if exists(
   select 1 from private.organization_media_erasures e
   join private.p07_privacy_jobs j on j.request_id=e.request_id and j.org_id=e.org_id
   where e.worker_role=session_user and e.completed_at is null and old.scope_key='organization:'||e.org_id::text
    and e.permit_transaction=pg_catalog.pg_current_xact_id_if_assigned()
    and j.state='running' and j.lease_until>clock_timestamp()
  ) then return old;end if;
$q$||anchor);

 body:=pg_get_functiondef('private.organization_managed_file_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:='declare lease timestamptz;source jsonb;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization media declaration anchor mismatch';end if;
 body:=replace(body,anchor,anchor||'media_result jsonb;');
 anchor:=' -- Retain the provenance identifiers and digest, but clear an upload name';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization media execution anchor mismatch';end if;
 body:=replace(body,anchor,$q$ media_result:=private.organization_media_erase(target_request,target_org,receipt);

$q$||anchor);
 anchor:=$q$ select count(*) into live_org_media from private.settings_media_assets m where m.scope_key='organization:'||target_org;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization media inventory anchor mismatch';end if;
 body:=replace(body,anchor,$q$ select (select count(*) from private.settings_media_assets m where m.scope_key='organization:'||target_org)
  +(select count(*) from private.settings_media_current m where m.scope_key='organization:'||target_org)
  +(select count(*) from private.settings_media_history m where m.scope_key='organization:'||target_org)
 into live_org_media;$q$);
 anchor:=' if live_objects+unknown_files+unconfirmed_deletions+live_exports+live_import_copies+live_previews+live_contexts+live_org_media';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization media disposition anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if media_result is not null then source:=source||jsonb_build_object('organization_media',media_result);end if;
$q$||anchor);
 anchor:='  +unarchived_invoices+unproved_observations+pending_invoice_purges>0 then';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization media incomplete guard anchor mismatch';end if;
 execute replace(body,anchor,$q$  +unarchived_invoices+unproved_observations+pending_invoice_purges>0
  or (media_result is not null and media_result->>'state'<>'completed') then$q$);

 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$  when 'private.organization_signed_document_erasures'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization media DB footprint anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_media_erasures' then 'r.request_id=$6 and r.org_id=$2 and r.completed_at is not null'
$q$||anchor);

 body:=pg_get_functiondef('private.organization_live_database_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$  ||coalesce((select a.erased_subject_ids from private.organization_signed_document_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}');$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization media DB scope anchor mismatch';end if;
 execute replace(body,anchor,$q$  ||coalesce((select a.erased_subject_ids from private.organization_signed_document_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}')
  ||coalesce((select a.erased_asset_ids from private.organization_media_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}');$q$);
end$patch$;
commit;
