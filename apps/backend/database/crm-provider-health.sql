-- Native operator read: safe counts only, including disabled or blocked routes.
begin;
create function private.crm_meta_status(external_form text,external_page text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f private.crm_intake_forms;admitted boolean:=true;stats jsonb;
begin
 if not pg_has_role(session_user,'ftk_crm_ingress_worker','member') then perform private.fail('FORBIDDEN');end if;
 select a.* into f from private.crm_intake_forms a join private.crm_provider_receiver_scopes s on s.form_id=a.id and s.db_role=session_user where a.channel='meta' and a.external_form_id=external_form and a.external_page_id=external_page;
 if not found then perform private.fail('FORBIDDEN');end if;
 begin perform private.crm_provider_authorize('meta',external_form,external_page);exception when SQLSTATE 'P0001' then admitted:=false;end;
 select jsonb_build_object(
  'admission_open',admitted,
  'pending',count(*) filter(where completed_at is null),
  'ready',count(*) filter(where admitted and completed_at is null and available_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp()) and org_id=f.org_id and center_id is not distinct from f.center_id),
  'leased',count(*) filter(where completed_at is null and lease_until>clock_timestamp()),
  'expired',count(*) filter(where completed_at is null and lease_until<=clock_timestamp()),
  'completed',count(*) filter(where completed_at is not null),
  'blocked_snapshot',count(*) filter(where completed_at is null and (org_id is distinct from f.org_id or center_id is distinct from f.center_id)),
  'oldest_pending_seconds',coalesce(greatest(0,floor(extract(epoch from clock_timestamp()-min(enqueued_at) filter(where completed_at is null)))),0)::bigint,
  'max_attempts',coalesce(max(attempts) filter(where completed_at is null),0)
 ) into stats from private.crm_meta_notifications where form_id=f.id and org_id=f.org_id;
 return stats;
end$$;
revoke all on function private.crm_meta_status(text,text) from public,anon,authenticated,service_role;
grant execute on function private.crm_meta_status(text,text) to ftk_crm_ingress_worker;
commit;
