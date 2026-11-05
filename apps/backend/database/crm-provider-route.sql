-- Read-only native admission before any provider credential or personal-data IO.
begin;
create function private.crm_provider_authorize(provider text,external_form text,external_page text) returns boolean language plpgsql security definer set search_path='' as $$
declare f private.crm_intake_forms;c uuid;
begin
 if not pg_has_role(session_user,'ftk_crm_ingress_worker','member') then perform private.fail('FORBIDDEN');end if;
 select a.* into f from private.crm_intake_forms a join private.crm_provider_receiver_scopes s on s.form_id=a.id and s.db_role=session_user
 where a.channel=provider and a.channel in ('meta','google_ads') and a.external_form_id=external_form and a.external_page_id is not distinct from external_page and a.enabled;
 if not found then perform private.fail('FORBIDDEN');end if;
 if private.access_mode(f.org_id) not in ('normal','grace') then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if private.current_plan_name(f.org_id)='starter' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 perform private.require_feature(f.org_id,'F21');perform private.require_feature(f.org_id,'F25');
 c:=f.center_id;
 if c is null and private.plan_limit(f.org_id,'centers')=1 then select id into c from core.centers where org_id=f.org_id and state='active' and private.center_accessible(f.org_id,id);if c is null then perform private.fail('SERVICE_UNAVAILABLE');end if;end if;
 if c is not null then perform private.assert_center(f.org_id,c);end if;
 return true;
end$$;
revoke all on function private.crm_provider_authorize(text,text,text) from public,anon,authenticated,service_role;
grant execute on function private.crm_provider_authorize(text,text,text) to ftk_crm_ingress_worker;
commit;
