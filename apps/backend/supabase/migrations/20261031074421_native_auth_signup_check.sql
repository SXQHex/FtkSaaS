begin;
-- Native Auth owns Google linking/unlinking and MFA removal. Keep application
-- contact projections, security history, live sessions and tenant authorization.
drop trigger if exists account_google_link_fence on auth.identities;
drop trigger if exists account_identity_unlink_guard on auth.identities;
drop trigger if exists ftk_account_totp_removal_fence on auth.mfa_factors;
drop function private.account_google_link_fence();
drop function private.account_identity_unlink_guard();
drop function private.account_totp_removal_fence();
-- Native SDK replaces these application Auth endpoints; no compatibility adapters.
drop function api_v1.account_google_link_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb);
drop function api_v1.account_totp_remove_v1(jsonb,uuid,uuid,uuid[],jsonb);
drop function api_v1.account_password_change_v1(jsonb,uuid,uuid,uuid[],jsonb);
drop function private.account_google_link_prepare(jsonb,uuid,uuid,uuid[],jsonb);
drop function private.account_totp_remove(jsonb,uuid,uuid,uuid[],jsonb);
drop function private.p07_password_preflight(jsonb,uuid,uuid,uuid[],jsonb);
drop table private.account_google_link_intents;
drop table private.account_totp_removal_intents;
-- Recovery uses resetPasswordForEmail(); the unused app gateway is retired.
drop function api_v1.account_password_reset_request_v1(jsonb,uuid,uuid,uuid[],jsonb);
drop function private.p07_recovery_gate(jsonb,uuid[],jsonb);
drop table private.p07_recovery_rates;
drop table private.p07_recovery_config;
-- Replace the unpublished signup proxy with an email-only availability check.
drop function api_v1.account_signup_request_v1(jsonb,uuid,uuid,uuid[],jsonb);
drop function private.account_signup_gate(jsonb,uuid[],jsonb);
drop table private.account_signup_claims;
delete from private.runtime_operations where name in ('account_signup_request_v1','account_password_reset_request_v1','account_google_link_prepare_v1','account_totp_remove_v1','account_password_change_v1');
create function private.account_signup_check(r jsonb,ids uuid[],aux jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare address text:=lower(btrim(r->>'email'));ip text:=aux->>'ip_hash';n integer;rate_bucket bigint;found_account boolean;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then
  return jsonb_build_object('error','TEMPORARY_FAILURE');
 end if;
 if coalesce(ip,'')!~'^[a-f0-9]{64}$' or address is null or length(address)>254 or address!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or (r-array['client_api_version','request_id','email'])<>'{}'::jsonb then
  return jsonb_build_object('error','VALIDATION_FAILED');
 end if;
 -- Existing public policy: 30 requests / 5 minutes per trusted connection IP.
 rate_bucket:=floor(extract(epoch from clock_timestamp())/300)::bigint;
 insert into private.account_signup_rates values(ip,rate_bucket,1)
  on conflict(ip_hash,bucket) do update set hits=least(private.account_signup_rates.hits+1,31) returning hits into n;
 if n>30 then return jsonb_build_object('error','RATE_LIMITED');end if;
 delete from private.account_signup_rates where (ip_hash,bucket) in
  (select x.ip_hash,x.bucket from private.account_signup_rates x where x.bucket<rate_bucket-2 order by x.bucket limit 1000);
 select exists(select 1 from auth.users u where lower(btrim(u.email))=address)
  or exists(select 1 from auth.identities i where i.provider='google' and lower(btrim(i.identity_data->>'email'))=address) into found_account;
 return jsonb_build_object('data',jsonb_build_object('status',case when found_account then 'account_exists' else 'available' end));
end$$;
revoke all on function private.account_signup_check(jsonb,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.account_signup_check(jsonb,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_signup_check_v1','auth.signup','exempt',array[]::text[]);
create function api_v1.account_signup_check_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$select private.account_signup_check(p_request,p_ids,p_aux)$$;
revoke all on function api_v1.account_signup_check_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_signup_check_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
