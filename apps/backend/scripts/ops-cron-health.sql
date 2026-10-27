-- Admin-only diagnostics. No payloads, request tokens, passwords or person data.
select lane,enabled,last_started_at,last_finished_at,last_status,last_error_code,claimed,succeeded,failed,ticks,
 case when not enabled then 'disabled' when last_finished_at is null or last_finished_at<clock_timestamp()-interval '2 minutes' then 'stale' when last_status in ('claim_error','job_error') then 'error' else 'healthy' end health
from private.ops_worker_health order by lane;
select jobid,jobname,username,active,schedule from cron.job where jobname in ('ftksaas-ops-p01','ftksaas-ops-p05','ftksaas-ops-p06','ftksaas-ops-p07','ftksaas-ops-p07_privacy');
