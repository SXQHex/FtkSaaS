-- A scalar composite SQL function returns a null row on absence. EXISTS alone
-- must not turn missing followup configuration into a successful empty page.
begin;
do $patch$
declare b text:=pg_get_functiondef('private.p04_followups_page(jsonb,uuid,uuid,uuid)'::regprocedure);old text;
begin
 old:=$p$if not exists(select 1 from private.policy_at(org,center,case when r->>'kind'='inactive_student' then 'inactive_student_days' else 'entitlement_reminder_days' end,asof)) then$p$;
 if strpos(b,old)=0 then raise exception 'P04 followup policy guard anchor missing';end if;
 execute replace(b,old,$p$if not exists(select 1 from private.policy_at(org,center,case when r->>'kind'='inactive_student' then 'inactive_student_days' else 'entitlement_reminder_days' end,asof) configured where configured.id is not null) then$p$);
end$patch$;
commit;
