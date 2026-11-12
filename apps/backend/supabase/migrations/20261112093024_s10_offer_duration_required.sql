begin;
-- FD06 requires an explicit organization/center policy before producing offers.
-- Joining the waiting list remains an intent and does not choose a duration.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p01_worker_execute(text,jsonb,uuid[])'::regprocedure);
 a:='select coalesce((p.value->>''value'')::int,30) into minutes from private.policy_at(org,s.center_id,''waitlist_offer_minutes'',clock_timestamp()) p;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Offer duration policy lookup drift';end if;
 b:=replace(b,a,'select (p.value->>''value'')::int into minutes from private.policy_at(org,s.center_id,''waitlist_offer_minutes'',clock_timestamp()) p;');
 a:='minutes:=coalesce(minutes,30);if minutes<=0 then perform private.fail(''POLICY_NOT_CONFIGURED'');end if;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Offer duration policy requirement drift';end if;
 execute replace(b,a,'if minutes is null or minutes<=0 then perform private.fail(''POLICY_NOT_CONFIGURED'');end if;');
 -- A new effective duration policy must recover the same waiting intent even
 -- after the previous policy's job exhausted its bounded retry allowance.
 b:=pg_get_functiondef('private.p01_jobs_claim(uuid,uuid[],integer)'::regprocedure);
 a:='||'':''||p.id::text||'':''||(select count(*)::text from core.reservations rr';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Offer duration recovery fingerprint drift';end if;
 execute replace(b,a,$a$||':'||p.id::text||':'||coalesce((select duration_policy.id::text from private.policy_at(p_org,s.center_id,'waitlist_offer_minutes',clock_timestamp()) duration_policy),'unconfigured')||':'||(select count(*)::text from core.reservations rr$a$);
end$patch$;
commit;
