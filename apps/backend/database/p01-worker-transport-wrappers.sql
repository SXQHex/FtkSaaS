begin;
-- These existing bounded private functions verify session_user + live org scope,
-- immutable job/operation/target, lease and payload binding before domain writes.
grant usage on schema api_v1,private to ftk_p01_worker;
grant execute on function api_v1.p01_jobs_claim(uuid,uuid[],int),private.p01_jobs_claim(uuid,uuid[],int),private.p01_worker_execute(text,jsonb,uuid[]) to ftk_p01_worker;
commit;
