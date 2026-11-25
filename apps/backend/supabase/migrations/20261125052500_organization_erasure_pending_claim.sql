begin;

alter table private.organization_r2_erasure_bindings add column register_binding_sha256 text
 check(register_binding_sha256~'^[a-f0-9]{64}$');

create or replace function private.organization_r2_erasure_binding_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and new.pending_started_at is null and new.register_binding_sha256 is not null
  and new.instance_id=(pg_catalog.pg_control_system()).system_identifier::text then return new;end if;
 if tg_op='UPDATE' and old.pending_started_at is null and new.pending_started_at is not null
  and new.register_binding_sha256 is not null and new.pending_started_at<=clock_timestamp()
  and (to_jsonb(new)-'pending_started_at')=(to_jsonb(old)-'pending_started_at')
  and new.instance_id=(pg_catalog.pg_control_system()).system_identifier::text then return new;end if;
 perform private.fail('INTEGRITY_VIOLATION');
 return null;
end$$;

create function private.organization_erasure_fence_ready(target_request uuid,target_org uuid) returns boolean
 language sql stable security invoker set search_path='' as $$
 select exists(
  select 1 from private.organization_r2_erasure_bindings b
  where b.request_id=target_request and b.org_id=target_org and b.pending_started_at is not null and b.register_binding_sha256 is not null
   and b.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
 )
$$;
revoke all on function private.organization_erasure_fence_ready(uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

create or replace function private.organization_require_erasure_fence(target_request uuid,target_org uuid) returns void
 language plpgsql security invoker set search_path='' as $$
begin
 if not private.organization_erasure_fence_ready(target_request,target_org)
 then perform private.fail('OPERATION_IN_PROGRESS');end if;
end$$;

create function private.organization_check_untracked_storage_delete(target_bucket text,target_key text) returns void
 language plpgsql security invoker set search_path='' as $$
declare prefix text:=lower(split_part(target_key,'/',1));o core.organizations;p core.privacy_requests;
begin
 if target_bucket not in ('ftksaas-documents','ftksaas-imports','ftksaas-invoices')
  or prefix!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return;end if;
 select * into o from core.organizations where id=prefix::uuid for share;
 if o.state is distinct from 'deletion_pending' then return;end if;
 select * into p from core.privacy_requests where org_id=o.id and kind='organization_delete'
  and state in ('requested','running','partial');
 if p.id is null then perform private.fail('FORBIDDEN');end if;
 perform private.organization_require_erasure_fence(p.id,o.id);
end$$;
revoke all on function private.organization_check_untracked_storage_delete(text,text)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p07_privacy_claim(uuid,uuid[],integer)'::regprocedure);
 anchor:=$q$where org_id is not distinct from org and state='running'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization expired lease fence anchor mismatch';end if;
 body:=replace(body,anchor,$q$where org_id is not distinct from org
  and (org is null or private.organization_erasure_fence_ready(request_id,org)) and state='running'$q$);
 anchor:=$q$where x.org_id is not distinct from org and x.attempts<3$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization privacy claim fence anchor mismatch';end if;
 execute replace(body,anchor,$q$where x.org_id is not distinct from org
  and (org is null or private.organization_erasure_fence_ready(x.request_id,org)) and x.attempts<3$q$);

 body:=pg_get_functiondef('private.p07_storage_object_fence()'::regprocedure);
 anchor:=$q$ if i.file_id is null then return old;end if;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization untracked Storage delete anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if i.file_id is null then
  perform private.organization_check_untracked_storage_delete(old.bucket_id,old.name);
  return old;
 end if;$q$);
 anchor:=$q$ f:=private.p07_managed_file_target(j,i.file_id);$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization managed Storage delete anchor mismatch';end if;
 execute replace(body,anchor,$q$ if j.org_id is not null then perform private.organization_require_erasure_fence(j.request_id,j.org_id);end if;
$q$||anchor);

 body:=pg_get_functiondef('private.organization_invoice_object_fence()'::regprocedure);
 anchor:=$q$ i:=private.organization_invoice_erasure_source(j,a);$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization invoice Storage delete anchor mismatch';end if;
 execute replace(body,anchor,$q$ perform private.organization_require_erasure_fence(j.request_id,j.org_id);
$q$||anchor);

 body:=pg_get_functiondef('private.organization_signed_document_storage_fence()'::regprocedure);
 anchor:=$q$ perform 1 from core.organizations where id=e.org_id and state='deletion_pending' for share;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization signed document Storage delete anchor mismatch';end if;
 execute replace(body,anchor,$q$ perform private.organization_require_erasure_fence(j.request_id,j.org_id);
$q$||anchor);
end$patch$;

commit;
