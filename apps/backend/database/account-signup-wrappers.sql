begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_signup_request_v1','auth.signup','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_signup_request_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.account_signup_gate(p_request,p_ids,p_aux)$$;
revoke all on function api_v1.account_signup_request_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_signup_request_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
