-- Keep the dedicated DB worker independent of human Auth dispatcher compilation.
-- Previous applied migrations remain immutable; no Auth schema/table grant added.
begin;
revoke execute on function private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb),private.new_id(uuid[],integer) from ftk_p01_worker;
revoke execute on function api_v1.seat_offer_issue_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.seat_offer_expire_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.request_expire_v1(jsonb,uuid,uuid,uuid[],jsonb) from ftk_p01_worker;
revoke usage on schema core from ftk_p01_worker;
commit;
begin;
-- These existing bounded private functions verify session_user + live org scope,
-- immutable job/operation/target, lease and payload binding before domain writes.
grant usage on schema api_v1,private to ftk_p01_worker;
grant execute on function api_v1.p01_jobs_claim(uuid,uuid[],int),private.p01_jobs_claim(uuid,uuid[],int),private.p01_worker_execute(text,jsonb,uuid[]) to ftk_p01_worker;
commit;
