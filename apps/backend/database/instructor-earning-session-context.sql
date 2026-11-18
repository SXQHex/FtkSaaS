-- W1-BE-45: read the session facts used by each own earning revision.
begin;

create function private.instructor_earning_session_context(e core.earnings) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'title',snapshot.display->'title',
  'scheduled_duration_seconds',snapshot.display->'scheduled_duration_seconds',
  'agreement_version',agreement.version,
  'attended_count',case when first_close.rights_snapshot is not null then (
   select count(*) from (
    select distinct on (fact->>'reservation_id') fact->>'result' result
    from core.attendance_closures h cross join lateral jsonb_array_elements(h.rights_snapshot) fact
    where h.org_id=e.org_id and h.center_id=e.center_id and h.session_id=e.session_id and h.revision<=cl.revision
    order by fact->>'reservation_id',h.revision desc
   ) attendance where result='attended'
  ) end
 )
 from core.attendance_closures cl
 left join core.attendance_closures first_close on first_close.org_id=cl.org_id and first_close.center_id=cl.center_id
  and first_close.session_id=cl.session_id and first_close.revision=1
 left join core.instructor_agreements agreement on agreement.org_id=e.org_id and agreement.center_id=e.center_id
  and agreement.id=e.agreement_id and private.p07_same_person(e.org_id,agreement.person_id,e.person_id)
 left join lateral (
  select d->'session_display' display from jsonb_array_elements(cl.earnings_snapshot) d
  where d->>'agreement_id'=e.agreement_id::text
  limit 1
 ) snapshot on true
 where cl.org_id=e.org_id and cl.center_id=e.center_id and cl.id=e.closure_id and cl.session_id=e.session_id
$$;

revoke all on function private.instructor_earning_session_context(core.earnings) from public,anon,authenticated;
grant execute on function private.instructor_earning_session_context(core.earnings) to service_role;

do $patch$
declare
 body text;
 anchor text;
begin
 body:=pg_get_functiondef('private.lesson_finance_snapshot(uuid,uuid,jsonb)'::regprocedure);
 anchor:=$old$result jsonb:='[]';participants jsonb;$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Earning display declaration anchor drift';end if;
 body:=replace(body,anchor,anchor||'session_display jsonb;');

 anchor:=$old$ select * into ss from core.sessions where org_id=org and id=session;$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Earning display source anchor drift';end if;
 body:=replace(body,anchor,anchor||$new$
 select jsonb_build_object('title',coalesce(c.name,d.name),'scheduled_duration_seconds',extract(epoch from ss.ends_at-ss.starts_at))
 into session_display from core.disciplines d
 left join core.classes c on c.org_id=d.org_id and c.center_id=ss.center_id and c.id=ss.class_id
 where d.org_id=org and d.id=ss.discipline_id;$new$);

 anchor:=$old$'agreement_id',ag.id,'terms',ag.terms,'participants',participants,$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Earning display snapshot anchor drift';end if;
 execute replace(body,anchor,anchor||$new$'session_display',session_display,$new$);

 body:=pg_get_functiondef('private.instructor_self_account(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:=$old$  select p->'items',p->>'next_cursor' into items,token from (select private.earnings_read(org,center,account,r) p) q;$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Self earning context anchor drift';end if;
 execute replace(body,anchor,anchor||$new$
  if coalesce((r->>'include_session_context')::bool,false) then
   select coalesce(jsonb_agg(item||case when context is not null then jsonb_build_object('session_context',context) else '{}'::jsonb end order by ordinal),'[]')
   into items from jsonb_array_elements(items) with ordinality page_row(item,ordinal)
   left join core.earnings er on er.org_id=org and er.center_id=center and er.id=(item->>'id')::uuid and er.person_id=any(members)
   cross join lateral (select private.instructor_earning_session_context(er) context) source;
  end if;$new$);
end$patch$;

commit;
