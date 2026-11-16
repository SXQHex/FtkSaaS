-- W1-BE-20: opt-in member calendar discovery; existing schedule/roster reads stay unchanged.
begin;
create function private.member_lesson_cancellation(org uuid,center uuid,sid uuid,reservation uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare p core.policy_versions;s core.sessions;t jsonb;origin text:=case when reservation is null then 'current_policy' else 'reservation_policy' end;
begin
 select * into s from core.sessions where org_id=org and center_id=center and id=sid;
 if reservation is null then
  select * into p from private.policy_at(org,center,case when s.format='private' then 'student_cancel_private' else 'student_cancel_group' end,statement_timestamp());
 else
  select q.* into p from core.policy_versions q join core.reservations v on v.org_id=q.org_id and v.policy_version_id=q.id
   where v.org_id=org and v.center_id=center and v.session_id=sid and v.id=reservation;
 end if;
 t:=coalesce(p.value->'terms',p.value);
 if p.id is null or t->>'before_cutoff' is null or t->>'after_cutoff' is null or t->>'no_show' is null then
  return jsonb_build_object('status','not_configured','source',origin,'policy_version_id',null,'terms',null,'cutoff_at',null);
 end if;
 return jsonb_build_object('status','available','source',origin,'policy_version_id',p.id,'terms',jsonb_build_object('cutoff_minutes',t->'cutoff_minutes','before_cutoff',t->'before_cutoff','after_cutoff',t->'after_cutoff','no_show',t->'no_show'),
  'cutoff_at',s.starts_at-make_interval(mins=>coalesce((t->>'cutoff_minutes')::int,0)));
end$$;
create function private.member_lesson_item(org uuid,center uuid,actor uuid,sid uuid,wait_enabled bool) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.sessions;v core.reservations;w core.waitlist_entries;p core.policy_versions;instructors jsonb;rooms jsonb;window_data jsonb;own jsonb;waiting jsonb;
 opens timestamptz;closes timestamptz;stamp timestamptz:=statement_timestamp();members uuid[]:=private.p07_person_members(org,actor);
begin
 select * into s from core.sessions where org_id=org and center_id=center and id=sid;
 wait_enabled:=wait_enabled and (s.class_id is null or coalesce((select waitlist_enabled from core.classes where org_id=org and id=s.class_id),false));
 -- Effective session assignments (including legacy inheritance) without fees,
 -- agreements, account identity, contact details or participant information.
 select coalesce(jsonb_agg(q.name order by q.person_id),'[]') into instructors from (
  select distinct private.p07_person_root(org,p.id) person_id,p.display_name name
   from jsonb_array_elements(private.schedule_snapshot(org,sid)->'assignments') a
   join core.people p on p.org_id=org and p.id=private.p07_person_root(org,(a->>'person_id')::uuid)
   where a->>'duty'='instructor' and p.state='active' and private.starter_instructor_active(org,center,p.id)
    and private.starter_selected(org,'instructor',p.id)
 ) q;
 select coalesce(jsonb_agg(q.name order by q.id),'[]') into rooms from (
  select distinct room.id,room.name from core.resource_bookings b join core.rooms room on room.org_id=b.org_id and room.center_id=b.center_id and room.id=b.resource_id
   where b.org_id=org and b.center_id=center and b.session_id=sid and b.resource_kind='room' and b.state='active'
 ) q;
 select * into p from private.policy_at(org,center,'reservation_window',stamp);
 if p.id is null or p.value->>'kind' is distinct from 'window' then
  window_data:=jsonb_build_object('state','not_configured','policy_version_id',null,'opens_at',null,'closes_at',null);
 else
  opens:=s.starts_at-make_interval(mins=>(p.value->>'opens_minutes_before')::int);
  closes:=least(s.starts_at,s.starts_at-make_interval(mins=>(p.value->>'closes_minutes_before')::int));
  window_data:=jsonb_build_object('state',case when stamp<opens then 'not_open' when stamp>=closes then 'closed' else 'open' end,'policy_version_id',p.id,'opens_at',opens,'closes_at',closes);
 end if;
 select * into v from core.reservations where org_id=org and center_id=center and session_id=sid and person_id=any(members)
  order by (state='active') desc,created_at desc,id desc limit 1;
 if v.id is not null then own:=jsonb_build_object('id',v.id,'version',v.version,'state',v.state,'mode',v.mode,
  'cancellation',private.member_lesson_cancellation(org,center,sid,v.id));end if;
 if wait_enabled then
  select * into w from core.waitlist_entries where org_id=org and center_id=center and session_id=sid and person_id=any(members) and state in ('waiting','offered')
   order by joined_at desc,id desc limit 1;
  if w.id is not null then
   waiting:=jsonb_build_object('id',w.id,'version',w.version,'state',w.state,'offer',(
    select jsonb_build_object('id',o.id,'version',o.version,'state',o.state,'expires_at',o.expires_at) from core.seat_offers o
     where o.org_id=org and o.center_id=center and o.entry_id=w.id and o.person_id=any(members) and o.state='active' and o.expires_at>stamp
     order by o.created_at desc,o.id desc limit 1));
  end if;
 end if;
 return jsonb_build_object('id',s.id,'type','session','center_id',center,'starts_at',s.starts_at,'ends_at',s.ends_at,
  'title',coalesce((select name from core.classes where org_id=org and id=s.class_id),(select name from core.disciplines where org_id=org and id=s.discipline_id)),
  'discipline_id',s.discipline_id,'capacity',private.capacity_view(org,sid),
  'member_lesson',jsonb_build_object('version',s.version,'format',s.format,'state',s.state,'attendance_state',s.attendance_state,
   'instructor_labels',instructors,'room_labels',rooms,'booking_window',window_data,'cancellation',private.member_lesson_cancellation(org,center,sid),
   'own_reservation',own,'waitlist_enabled',wait_enabled,'own_waitlist',waiting));
end$$;
create function private.member_lesson_discovery(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare lo timestamptz:=(r#>>'{interval,starts_at}')::timestamptz;hi timestamptz:=(r#>>'{interval,ends_at}')::timestamptz;
 lim int:=coalesce((r#>>'{page,limit}')::int,50);stamp timestamptz:=statement_timestamp();h text;cur jsonb;last_at timestamptz;last_id uuid;items jsonb;token text;
 members uuid[];wait_enabled bool;request jsonb;
begin
 if center is null or not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 members:=private.p07_person_members(org,actor);
 if not exists(select 1 from core.people p where p.org_id=org and p.id=actor and p.state='active')
  or not exists(select 1 from core.center_relationships c where c.org_id=org and c.center_id=center and c.person_id=any(members) and c.kind='student' and c.state='active') then perform private.fail('FORBIDDEN');end if;
 request:=r||jsonb_build_object('person_id',actor);
 if not private.member_summary_enabled(org,array['calendar_get_v1','reservation_create_v1'],request) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 wait_enabled:=private.member_summary_enabled(org,array['waitlist_join_v1'],request);
 if lo is null or hi is null or not isfinite(lo) or not isfinite(hi) or lo>=hi or lim<1 or lim>200
  or coalesce(r#>>'{page,sort}','starts_at_asc')<>'starts_at_asc' or r?'resource' or r?'needs_instructor'
  or coalesce((r->>'interest_filter')::bool,false) or coalesce((r->>'include_room_labels')::bool,false) then perform private.fail('VALIDATION_FAILED');end if;
 h:=encode(extensions.digest(jsonb_build_object('actor',actor,'account',account,'org',org,'center',center,'request',r-'request_id'-'page','sort','starts_at_asc')::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;stamp:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(stamp) or stamp>statement_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 -- Exact current writer class-access rule: a closed class needs a class-specific
 -- purchased scope; broad org credits do not establish closed-class access.
 with visible as materialized (
  select s.id,s.starts_at from core.sessions s left join core.classes c on c.org_id=s.org_id and c.center_id=s.center_id and c.id=s.class_id
  where s.org_id=org and s.center_id=center and s.state='planned' and s.starts_at>=statement_timestamp() and s.actual_started_at is null
   and s.starts_at<hi and s.ends_at>lo and private.starter_session_allowed(org,s.id,true)
   and (s.class_id is null or c.external_open or exists(
    select 1 from core.sales sale join core.product_scopes sc on sc.org_id=sale.org_id and sc.product_version_id=sale.product_version_id
     where sale.org_id=org and sale.person_id=any(members) and sc.class_id=s.class_id and private.lesson_scope_matches(org,s.id,sale.product_version_id)))
   and (last_id is null or (s.starts_at,s.id)>(last_at,last_id))
  order by s.starts_at,s.id limit lim+1
 ) select coalesce(jsonb_agg(private.member_lesson_item(org,center,actor,v.id,wait_enabled) order by v.starts_at,v.id),'[]') into items from visible v;
 if jsonb_array_length(items)>lim then
  items:=items-lim;
  token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'starts_at','id',items->-1->'id','as_of',stamp)::text,'utf8'),'hex');
 end if;
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',stamp);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a text:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Member lesson discovery dispatch anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='calendar_get_v1' and coalesce((r->>'member_discovery')::bool,false) then
  out:=private.member_lesson_discovery(r,org,center,person,actor.id);
  return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
end$patch$;
revoke all on function private.member_lesson_cancellation(uuid,uuid,uuid,uuid),private.member_lesson_item(uuid,uuid,uuid,uuid,bool),private.member_lesson_discovery(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.member_lesson_cancellation(uuid,uuid,uuid,uuid),private.member_lesson_item(uuid,uuid,uuid,uuid,bool),private.member_lesson_discovery(jsonb,uuid,uuid,uuid,uuid) to service_role;
commit;
