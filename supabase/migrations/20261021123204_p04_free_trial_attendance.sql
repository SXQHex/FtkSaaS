-- A verified free trial has no purchased allocation and must never create a deficit.
-- Ordinary missing-right corruption and paid trials retain the existing rejection.
begin;
create function private.p04_free_trial_right(org uuid,reservation uuid,consume boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare usage core.trial_usages;before_data jsonb;
begin
 select u.* into usage from core.reservations r
 join core.trial_offers o on o.org_id=r.org_id and o.center_id=r.center_id and o.id=r.trial_offer_id and o.session_id=r.session_id
 join core.leads l on l.org_id=o.org_id and l.center_id=o.center_id and l.id=o.lead_id and l.person_id=r.person_id
 join core.trial_usages u on u.org_id=r.org_id and u.offer_id=o.id and u.person_id=r.person_id and u.session_id=r.session_id
 where r.org_id=org and r.id=reservation and r.source_sale_id is null and o.state='accepted' and o.terms_snapshot->>'price_minor'='0'
 for update of u;
 if not found then return null;end if;
 before_data:=to_jsonb(usage);
 if consume and usage.used_at is null then
  update core.trial_usages set used_at=clock_timestamp(),version=version+1 where id=usage.id returning * into usage;
 end if;
 -- First usage evidence is retained on corrections; attendance_closures records
 -- each result. No entitlement, debt, negative credit or earning is introduced.
 return jsonb_build_object('kind','free_trial','consume',consume,'before',before_data,'after',to_jsonb(usage));
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.lesson_right(uuid,uuid,boolean,uuid,uuid[],integer,boolean)'::regprocedure);old text;
begin
 old:=' select * into d from core.credit_deficits q where q.org_id=org and q.reservation_id=reservation order by q.created_at desc,q.id desc limit 1 for update;';
 if strpos(b,old)=0 then raise exception 'P04 free trial right anchor missing';end if;
 execute replace(b,old,$p$
 before_data:=private.p04_free_trial_right(org,reservation,consume);
 if before_data is not null then return before_data;end if;
$p$||old);
end$patch$;
revoke all on function private.p04_free_trial_right(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.p04_free_trial_right(uuid,uuid,boolean) to service_role;
commit;
