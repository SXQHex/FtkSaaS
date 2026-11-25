begin;

-- A reviewed legacy application can acquire a person and lead after P06
-- finishes. Resolve holds through its durable application link, not intake text.
create function private.p06_held_crm_import_rows(target_org uuid,target_job uuid) returns setof uuid
 language sql stable security invoker set search_path='' as $$
 select distinct r.id
 from core.import_jobs j
 join core.import_rows r on r.org_id=j.org_id and r.center_id=j.center_id and r.job_id=j.id
  and r.source_namespace=j.source_namespace
 left join private.p06_sources s on s.org_id=r.org_id and s.center_id=r.center_id
  and s.source_namespace=r.source_namespace and s.source_key=r.source_key and s.import_kind='crm_applications'
  and r.state='applied' and s.application_id=any(r.created_references)
 join core.public_applications a on a.org_id=r.org_id and (a.import_row_id=r.id or a.id=s.application_id)
 join core.retention_holds h on h.org_id=a.org_id
 where j.org_id=target_org and j.id=target_job and j.mapping->>'kind'='crm_applications'
  and (
   (h.subject_table in ('public_applications','core.public_applications') and h.subject_id=a.id)
   or (h.subject_table in ('people','core.people') and h.subject_id=a.person_id)
   or (h.subject_table in ('person_contacts','core.person_contacts') and exists(
    select 1 from core.person_contacts c where c.id=h.subject_id and c.org_id=a.org_id and c.person_id=a.person_id))
   or (h.subject_table in ('leads','core.leads') and exists(
    select 1 from core.leads l where l.id=h.subject_id and l.org_id=a.org_id and l.center_id=a.center_id and l.person_id=a.person_id))
  )
$$;

create function private.p06_lock_crm_import_hold_graph() returns boolean
 language plpgsql security invoker set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then return false;end if;
 lock table core.public_applications,core.person_contacts,core.leads,private.p06_sources in share mode nowait;
 return true;
exception when lock_not_available then
 return false;
end$$;

revoke all on function private.p06_held_crm_import_rows(uuid,uuid),private.p06_lock_crm_import_hold_graph()
 from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p06_import_copy_candidates(uuid,uuid)'::regprocedure);
 anchor:=$q$ ), staged_rows as materialized ($q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM copy held rows anchor mismatch';end if;
 body:=replace(body,anchor,$q$ ), crm_held_rows as materialized (
  select held.row_id from terminal j cross join lateral private.p06_held_crm_import_rows(target_org,j.id) held(row_id)
$q$||anchor);
 anchor:=$q$j.hold_job or exists (
   select 1 from core.retention_holds h
   where h.org_id=x.org_id and ($q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM copy hold predicate anchor mismatch';end if;
 execute replace(body,anchor,$q$j.hold_job or exists(select 1 from crm_held_rows c where c.row_id=x.id) or exists (
   select 1 from core.retention_holds h
   where h.org_id=x.org_id and ($q$);

 body:=pg_get_functiondef('private.organization_import_copy_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$ rows_removed int:=0;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM privacy graph state anchor mismatch';end if;
 body:=replace(body,anchor,$q$ crm_graph_ready boolean:=true;
$q$||anchor);
 anchor:=$q$ for item in select c.* from private.p06_import_copy_candidates(target_org,target_request) c$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM privacy hold graph lock anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if exists(
  select 1 from core.import_jobs i
  join core.outbox_jobs o on o.id=i.id and o.org_id=i.org_id and o.kind='p06.import' and o.state=i.state and o.lease_until is null
  join private.p06_jobs w on w.job_id=i.id and w.org_id=i.org_id and w.center_id=i.center_id
  where i.org_id=target_org and i.mapping->>'kind'='crm_applications'
   and (i.state in ('failed','cancelled') or (i.state='succeeded' and w.phase='apply'))
   and (exists(select 1 from core.import_rows r where r.org_id=i.org_id and r.job_id=i.id and r.payload<>'{}'::jsonb)
    or exists(select 1 from private.p06_previews p where p.org_id=i.org_id and p.preview_id=i.preview_id)
    or exists(select 1 from private.preview_payloads p where p.preview_id=i.preview_id)
    or exists(select 1 from private.p06_contexts c join core.operation_receipts r on r.id=c.receipt_id and r.org_id=c.org_id
      where c.org_id=i.org_id and r.business_reference=i.id and c.operation in ('import_preview_v1','import_apply_v1'))))
 then crm_graph_ready:=private.p06_lock_crm_import_hold_graph();end if;
 if crm_graph_ready then
$q$||anchor);
 anchor:=$q$ from private.p06_import_copy_candidates(target_org,target_request) c;
 if lease<=clock_timestamp()$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM privacy graph lock scope anchor mismatch';end if;
 body:=replace(body,anchor,$q$ from private.p06_import_copy_candidates(target_org,target_request) c;
 end if;
 if lease<=clock_timestamp()$q$);
 anchor:=$q$case when eligible then 'retry_wait'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM privacy graph retry anchor mismatch';end if;
 execute replace(body,anchor,$q$case when not crm_graph_ready or eligible then 'retry_wait'$q$);

 body:=pg_get_functiondef('private.p06_jobs_claim(uuid,uuid[],integer)'::regprocedure);
 anchor:=$q$idx int:=20;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM expiry graph state anchor mismatch';end if;
 body:=replace(body,anchor,anchor||$q$crm_graph_ready boolean:=false;$q$);
 anchor:=$q$ delete from private.p06_previews p
 where p.org_id=org and p.expires_at<=clock_timestamp()$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM expiry preview anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if exists(select 1 from core.import_jobs i where i.org_id=org and i.mapping->>'kind'='crm_applications'
  and (exists(select 1 from private.p06_previews p where p.preview_id=i.preview_id and p.org_id=i.org_id and p.expires_at<=clock_timestamp())
   or exists(select 1 from private.p06_contexts c join core.operation_receipts r on r.id=c.receipt_id and r.org_id=c.org_id
    where c.org_id=i.org_id and r.business_reference=i.id and c.operation in ('import_preview_v1','import_apply_v1')
     and r.result_expires_at<=clock_timestamp())))
 then crm_graph_ready:=private.p06_lock_crm_import_hold_graph();end if;
$q$||anchor||$q$
  and not exists (select 1 from core.import_jobs i where i.org_id=p.org_id and i.preview_id=p.preview_id
   and i.mapping->>'kind'='crm_applications'
   and (not crm_graph_ready or exists(select 1 from private.p06_held_crm_import_rows(i.org_id,i.id))))$q$);
 anchor:=$q$ where c.receipt_id=r.id and c.org_id=org and r.result_expires_at<=clock_timestamp()$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM expiry context anchor mismatch';end if;
 execute replace(body,anchor,anchor||$q$
  and not exists (select 1 from core.import_jobs i where i.org_id=c.org_id and i.org_id=r.org_id and i.id=r.business_reference
   and c.operation in ('import_preview_v1','import_apply_v1') and i.mapping->>'kind'='crm_applications'
   and (not crm_graph_ready or exists(select 1 from private.p06_held_crm_import_rows(i.org_id,i.id))))$q$);
end$patch$;

commit;
