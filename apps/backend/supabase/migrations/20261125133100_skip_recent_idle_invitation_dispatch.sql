begin;
create index outbox_email_open_jobs_idx on core.outbox_jobs(kind,state,next_attempt_at,lease_until)
 where kind in ('account_invitation','transactional_email') and state in ('pending','retry_wait','running');

create function private.invitation_dispatch_needed(at_time timestamptz)
returns boolean language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from private.invitation_ticks where created_at>at_time-interval '45 seconds')
  or exists(
   select 1 from core.outbox_jobs j
   where j.kind in ('account_invitation','transactional_email') and j.state in ('pending','retry_wait','running')
    and ((j.state in ('pending','retry_wait') and (j.next_attempt_at is null or j.next_attempt_at<=at_time))
     or (j.state='running' and j.lease_until<=at_time))
    and case when j.kind='account_invitation' then exists(
      select 1 from private.invitation_deliveries d
      join private.invitation_sender_config c on c.org_id=j.org_id and c.enabled where d.job_id=j.id
     ) else exists(select 1 from private.transactional_email_jobs d where d.job_id=j.id) end
  )
$$;
revoke all on function private.invitation_dispatch_needed(timestamptz) from public,anon,authenticated,service_role;

do $patch$
declare body text; anchor text:=' if cfg.singleton is null then return;end if;';
begin
 body:=pg_get_functiondef('private.invitation_dispatch()'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Invitation dispatch config anchor drift';end if;
 -- The Cron role still probes every 30 seconds. A fresh signed worker receipt
 -- allows one idle dispatch to be skipped before the next signed health tick.
 -- An open due email always permits dispatch; the worker still owns eligibility.
 execute replace(body,anchor,anchor||E'\n if not private.invitation_dispatch_needed(statement_timestamp()) then return;end if;');
end$patch$;
commit;
