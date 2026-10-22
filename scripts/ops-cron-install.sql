-- Run only after this exact source passes candidate/main clean and development CD.
-- No tenant or product limits are invented: unbound workers heartbeat idle.
begin;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to ftk_ops_p01,ftk_ops_p05,ftk_ops_p06;
grant ftk_ops_p01,ftk_ops_p05,ftk_ops_p06 to postgres;
set local role ftk_ops_p01;
select cron.schedule('ftksaas-ops-p01','5 seconds',$$call private.ops_run('p01')$$);
reset role;
set local role ftk_ops_p05;
select cron.schedule('ftksaas-ops-p05','5 seconds',$$call private.ops_run('p05')$$);
reset role;
set local role ftk_ops_p06;
select cron.schedule('ftksaas-ops-p06','5 seconds',$$call private.ops_run('p06')$$);
reset role;
revoke ftk_ops_p01,ftk_ops_p05,ftk_ops_p06 from postgres;
revoke usage on schema cron from ftk_ops_p01,ftk_ops_p05,ftk_ops_p06;
update private.ops_worker_health set enabled=true;
commit;
