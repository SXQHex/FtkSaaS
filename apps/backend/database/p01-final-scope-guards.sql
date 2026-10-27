-- Complete accepted request-window and live worker-center boundaries.
begin;
create function private.p01_request_window(org uuid,center uuid,requested timestamptz,r jsonb,actor uuid) returns void language plpgsql security invoker set search_path='' as $$
declare policy jsonb;checked_at timestamptz:=clock_timestamp();exception_requested boolean:=coalesce((r->>'window_exception')::boolean,false);
begin
 select p.value into policy from private.policy_at(org,center,'request_window',checked_at) p;
 if policy is null or policy->>'kind'<>'window' then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if exception_requested and (not coalesce((policy->>'manager_exception')::boolean,false) or not private.is_manager(org,actor,center) or length(btrim(coalesce(r->>'reason','')))=0) then perform private.fail('FORBIDDEN');end if;
 if (checked_at<requested-make_interval(mins=>(policy->>'opens_minutes_before')::int) or checked_at>=requested-make_interval(mins=>(policy->>'closes_minutes_before')::int)) and not exception_requested then perform private.fail('FORBIDDEN');end if;
end$$;
revoke all on function private.p01_request_window(uuid,uuid,timestamptz,jsonb,uuid) from public,anon,authenticated,ftk_p01_worker;
grant execute on function private.p01_request_window(uuid,uuid,timestamptz,jsonb,uuid) to service_role;

do $patch$
declare b text;old text;new text;
begin
 b:=pg_get_functiondef('private.p01_request_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 old:=$p$ if op='lesson_request_create_v1' then$p$;
 new:=old||$p$
  perform private.p01_request_window(org,center,(r->>'requested_start')::timestamptz,r,actor);$p$;
 if strpos(b,old)=0 then raise exception 'P01 request create window anchor missing';end if;b:=replace(b,old,new);
 old:=$p$    if starts<=clock_timestamp() or ends<=starts then perform private.fail('VALIDATION_FAILED');end if;$p$;
 new:=old||$p$
    perform private.p01_request_window(org,center,starts,r,actor);$p$;
 if strpos(b,old)=0 then raise exception 'P01 alternative offer window anchor missing';end if;b:=replace(b,old,new);
 old:=$p$   if a.instructor_id is not null then perform private.p01_request_instructor(org,center,a.instructor_id);end if;$p$;
 new:=$p$   perform private.p01_request_window(org,center,a.starts_at,r,actor);
$p$||old;
 if strpos(b,old)=0 then raise exception 'P01 alternative accept window anchor missing';end if;execute replace(b,old,new);
 -- Explicit manager exception authority is live before receipt replay as well.
 b:=pg_get_functiondef('private.p01_request_access(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 old:=$p$ if actor is null then perform private.fail('FORBIDDEN');end if;$p$;
 new:=old||$p$
 if coalesce((r->>'window_exception')::boolean,false) and not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;$p$;
 if strpos(b,old)=0 then raise exception 'P01 live exception authority anchor missing';end if;execute replace(b,old,new);
 -- Exclude inaccessible centers before bounded discovery, not after LIMIT.
 b:=pg_get_functiondef('private.p01_jobs_claim(uuid,uuid[],integer)'::regprocedure);
 old:=$p$  where s.org_id=p_org and s.state='planned' and p.value->>'kind'='window'$p$;
 new:=old||$p$ and private.center_accessible(p_org,s.center_id)$p$;
 if strpos(b,old)=0 then raise exception 'P01 worker discovery center anchor missing';end if;execute replace(b,old,new);
 -- Recheck after claim and before replay; cleanup remains possible in closed centers.
 b:=pg_get_functiondef('private.p01_worker_execute(text,jsonb,uuid[])'::regprocedure);
 old:=$p$ if job.state='succeeded' and c.result is not null then return c.result;end if;$p$;
 new:=$p$ if op='seat_offer_issue_v1' and not coalesce((select private.center_accessible(org,ss.center_id) from core.sessions ss where ss.org_id=org and ss.id=c.target_id),false) then perform private.fail('NOT_FOUND');end if;
$p$||old;
 if strpos(b,old)=0 then raise exception 'P01 worker live center anchor missing';end if;execute replace(b,old,new);
end$patch$;
commit;
