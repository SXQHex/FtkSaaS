begin;
create function private.lesson_request_actionable(q core.lesson_requests) returns boolean
language sql stable security invoker set search_path='' as $$
 select (q.expires_at is null or q.expires_at>clock_timestamp()) and (
  (q.state='pending' and q.requested_start>clock_timestamp())
  or (q.state='alternative_offered' and exists(select 1 from core.request_alternatives a where a.org_id=q.org_id and a.center_id=q.center_id and a.request_id=q.id and a.state in ('offered','accepted') and a.starts_at>clock_timestamp()))
 )
$$;
revoke all on function private.lesson_request_actionable(core.lesson_requests) from public,anon,authenticated;
grant execute on function private.lesson_request_actionable(core.lesson_requests) to service_role;
commit;
