begin;

alter table private.organization_r2_erasure_bindings add column pending_started_at timestamptz;
drop trigger organization_r2_erasure_binding_immutable on private.organization_r2_erasure_bindings;
create function private.organization_r2_erasure_binding_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and new.pending_started_at is null
  and new.instance_id=(pg_catalog.pg_control_system()).system_identifier::text then return new;end if;
 if tg_op='UPDATE' and old.pending_started_at is null and new.pending_started_at is not null
  and new.pending_started_at<=clock_timestamp()
  and (to_jsonb(new)-'pending_started_at')=(to_jsonb(old)-'pending_started_at')
  and new.instance_id=(pg_catalog.pg_control_system()).system_identifier::text then return new;end if;
 perform private.fail('INTEGRITY_VIOLATION');
 return null;
end$$;
create trigger organization_r2_erasure_binding_immutable before insert or update or delete on private.organization_r2_erasure_bindings
 for each row execute function private.organization_r2_erasure_binding_guard();

create function private.organization_require_erasure_fence(target_request uuid,target_org uuid) returns void
 language plpgsql security invoker set search_path='' as $$
begin
 if not exists(
  select 1 from private.organization_r2_erasure_bindings b
  where b.request_id=target_request and b.org_id=target_org and b.pending_started_at is not null
   and b.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
 ) then perform private.fail('OPERATION_IN_PROGRESS');end if;
end$$;
revoke all on function private.organization_r2_erasure_binding_guard(),private.organization_require_erasure_fence(uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 anchor:=$q$ insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at)$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization native worker fence anchor mismatch';end if;
 execute replace(body,anchor,$q$ if org is not null then perform private.organization_require_erasure_fence(p.id,org);end if;
$q$||anchor);

 body:=pg_get_functiondef('private.p07_storage_erasure_job(jsonb)'::regprocedure);
 anchor:=$q$ return j;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization Storage worker fence anchor mismatch';end if;
 execute replace(body,anchor,$q$ if org is not null then perform private.organization_require_erasure_fence(j.request_id,org);end if;
$q$||anchor);
end$patch$;

commit;
