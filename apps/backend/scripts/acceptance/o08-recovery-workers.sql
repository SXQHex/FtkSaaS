-- Run on the private source and isolated recovery target, using an operator
-- connection that can see every binding and cron job. Never emits tenant IDs,
-- cron command text, credentials, request bodies or Vault contents.
begin isolation level repeatable read read only;
set local row_security = off;
with lanes(lane) as (values ('p01'),('p05'),('p06'),('p07'),('p07_privacy')),
bindings(lane,db_role,org_id) as (
 select 'p01',db_role,org_id from private.p01_worker_scopes union all
 select 'p05',db_role,org_id from private.p05_worker_scopes union all
 select 'p06',db_role,org_id from private.p06_worker_scopes union all
 select 'p07',db_role,org_id from private.p07_worker_scopes union all
 select 'p07_privacy',db_role,org_id from private.p07_privacy_worker_scopes
)
select l.lane, coalesce(r.rolcanlogin and r.rolinherit and not
 (r.rolsuper or r.rolcreatedb or r.rolcreaterole or r.rolreplication or r.rolbypassrls),false) as restricted_login,
 (select count(*)=1 and coalesce(bool_and(parent.rolname='ftk_'||l.lane||'_worker'),false)
  from pg_auth_members m join pg_roles parent on parent.oid=m.roleid where m.member=r.oid) as expected_membership,
 coalesce(has_function_privilege(r.oid,'private.ops_run(text)','EXECUTE'),false) as can_run,
 scopes.count,scopes.global_bindings,scopes.scope_sha256,
 (select count(*) from bindings b where b.lane=l.lane and b.db_role is distinct from r.rolname) as other_role_bindings,h.enabled as lane_enabled,
 jobs.total as cron_jobs,jobs.active as active_jobs,jobs.expected as exact_definitions
from lanes l left join pg_roles r on r.rolname='ftk_ops_'||l.lane
left join private.ops_worker_health h on h.lane=l.lane
cross join lateral (
 select count(*) as count,count(*) filter(where org_id is null) as global_bindings,
  encode(sha256(convert_to(coalesce(string_agg(coalesce(org_id::text,'global'),',' order by org_id),''),
   'UTF8')),'hex') as scope_sha256
 from bindings b where b.lane=l.lane and b.db_role=r.rolname
) scopes
cross join lateral (
 select count(*) as total,count(*) filter(where j.active) as active,
  count(*) filter(where j.username=r.rolname and j.database=current_database() and j.schedule='5 seconds'
   and j.command=format('call private.ops_run(%L)',l.lane)) as expected
 from cron.job j where j.jobname='ftksaas-ops-'||l.lane
) jobs order by l.lane;

-- No outbound invocation. Unknown or unexpectedly active jobs need review
-- even when the five expected lane definitions all match.
select count(*) as total_jobs,count(*) filter(where active) as active_jobs,
 count(*) filter(where active and jobname='ftksaas-invitations') as active_invitation_jobs
from cron.job;
commit;
