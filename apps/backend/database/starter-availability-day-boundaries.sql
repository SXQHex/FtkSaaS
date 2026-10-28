begin;
-- A daily availability interval has an exclusive end; 24:00 names the next
-- midnight, so explicit overnight splits have no fabricated one-second gap.
create function private.availability_day_window(day date,local_start text,local_end text,tz text) returns tstzrange language plpgsql stable security invoker set search_path='' as $$
declare lo timestamptz;hi timestamptz;
begin
 lo:=private.schedule_local_instant(day+local_start::time,tz);
 hi:=private.schedule_local_instant(case when local_end='24:00:00' then (day+1)::timestamp else day+local_end::time end,tz);
 if lo>=hi then return null;end if;return tstzrange(lo,hi,'[)');
exception when SQLSTATE 'P0001' then
 -- Existing local-time resolver rejects absent/ambiguous boundaries. Never
 -- choose an offset or silently shift a weekly boundary on the caller's behalf.
 if sqlerrm<>'VALIDATION_FAILED' then raise;end if;return null;
end$$;
create or replace function private.assert_availability(org uuid,center uuid,kind text,resource uuid,starts timestamptz,ends timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare tz text;first_day date;last_day date;coverage tstzmultirange;
begin
 if starts>=ends or not isfinite(starts) or not isfinite(ends) then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from core.availability_exceptions x where x.org_id=org and x.center_id=center and x.resource_kind=kind and x.resource_id=resource and x.starts_at<ends and x.ends_at>starts) then perform private.fail('RESOURCE_CONFLICT');end if;
 if not exists(select 1 from core.availability_rules a where a.org_id=org and a.center_id=center and a.resource_kind=kind and a.resource_id=resource) then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 select c.timezone into tz from core.centers c where c.org_id=org and c.id=center;if tz is null then perform private.fail('NOT_FOUND');end if;
 first_day:=least((starts at time zone tz)::date,(ends at time zone tz)::date);last_day:=greatest((starts at time zone tz)::date,(ends at time zone tz)::date);
 select coalesce(range_agg(private.availability_day_window(d::date,a.local_start,a.local_end,tz)),'{}'::tstzmultirange) into coverage
 from generate_series(first_day::timestamp,last_day::timestamp,interval '1 day') d
 join core.availability_rules a on a.org_id=org and a.center_id=center and a.resource_kind=kind and a.resource_id=resource
 and extract(isodow from d)=any(a.weekdays) and d::date>=a.valid_from and (a.valid_until is null or d::date<a.valid_until);
 if not (coverage @> tstzrange(starts,ends,'[)')) then perform private.fail('RESOURCE_CONFLICT');end if;
end$$;
-- Resource-usage denominators share the exact same daily windows. This does
-- not grant Starter the report feature or change already-generated snapshots.
create or replace function private.p06_available_seconds(org uuid,center uuid,kind text,resource uuid,s timestamptz,e timestamptz) returns numeric language sql stable security invoker set search_path='' as $$
 with tz as(select timezone from core.centers where org_id=org and id=center),
 days as(select d::date d,tz.timezone from tz cross join lateral generate_series(least((s at time zone tz.timezone)::date,(e at time zone tz.timezone)::date)::timestamp,greatest((s at time zone tz.timezone)::date,(e at time zone tz.timezone)::date)::timestamp,interval '1 day') d),
 rules as(select private.availability_day_window(d.d,r.local_start,r.local_end,d.timezone) span from days d join core.availability_rules r on r.org_id=org and r.center_id=center and r.resource_kind=kind and r.resource_id=resource and d.d>=r.valid_from and (r.valid_until is null or d.d<r.valid_until) and extract(isodow from d.d)::bigint=any(r.weekdays)),
 available as(select coalesce(range_agg(span*tstzrange(s,e,'[)')),'{}'::tstzmultirange) spans from rules where span&&tstzrange(s,e,'[)')),
 exceptions as(select coalesce(range_agg(tstzrange(greatest(s,x.starts_at),least(e,x.ends_at),'[)')),'{}'::tstzmultirange) spans from core.availability_exceptions x where x.org_id=org and x.center_id=center and x.resource_kind=kind and x.resource_id=resource and x.starts_at<e and x.ends_at>s)
 select coalesce(sum(extract(epoch from upper(v)-lower(v))),0) from available a cross join exceptions x cross join lateral unnest(a.spans-x.spans) v
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$(r#>>'{rule,local_end}')!~'^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Availability exclusive day-end anchor drift';end if;
 execute replace(b,a,$a$(r#>>'{rule,local_end}')!~'^(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]|24:00:00)$'$a$);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',7';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Availability day-end catalog version anchor drift';end if;
 execute replace(b,a,'''catalog_version'',8');
end$patch$;
revoke all on function private.availability_day_window(date,text,text,text),private.assert_availability(uuid,uuid,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function private.availability_day_window(date,text,text,text),private.assert_availability(uuid,uuid,text,uuid,timestamptz,timestamptz) to service_role;
commit;
