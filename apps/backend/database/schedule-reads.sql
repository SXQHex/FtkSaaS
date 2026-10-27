-- Scoped schedule reads. Business data stays read-only; authority is evaluated on every page.
begin;
create index schedule_sessions_interval on core.sessions(org_id,center_id,starts_at,id);
create index schedule_reservations_person on core.reservations(org_id,person_id,created_at,id);
create index schedule_reservations_session on core.reservations(org_id,session_id,created_at,id);
create or replace function private.schedule_staff(org uuid,actor uuid,center uuid)
returns bool language sql stable security invoker set search_path='' as $$
 select private.staff_grant(org,actor,center,'reservation.write')
 or private.staff_grant(org,actor,center,'attendance.draft')
$$;
create or replace function private.schedule_scope(org uuid,actor uuid,center uuid)
returns bool language sql stable security invoker set search_path='' as $$
 select private.center_accessible(org,center) and (
 private.is_org_reader(org,actor) or private.is_manager(org,actor,center) or private.schedule_staff(org,actor,center)
 or private.has_role(org,actor,'instructor',center) or private.has_role(org,actor,'assistant',center)
 or exists(select 1 from core.center_relationships c where c.org_id=org and c.center_id=center and c.person_id=actor and c.kind='student')
 )
$$;
create or replace function private.session_assignee(org uuid,actor uuid,session uuid)
returns bool language sql stable security invoker set search_path='' as $$
 select exists(select 1 from core.sessions s where s.org_id=org and s.id=session and (
 exists(select 1 from core.session_assignments a where a.org_id=org and a.center_id=s.center_id and a.session_id=s.id and a.person_id=actor and a.state='active' and private.has_role(org,actor,a.duty,s.center_id))
 or exists(select 1 from core.class_assignments a where a.org_id=org and a.center_id=s.center_id and a.class_id=s.class_id and a.person_id=actor and a.state='active' and private.has_role(org,actor,a.duty,s.center_id))
 ))
$$;
create or replace function private.session_readable(org uuid,actor uuid,session uuid)
returns bool language sql stable security invoker set search_path='' as $$
 select exists(select 1 from core.sessions s where s.org_id=org and s.id=session and private.center_accessible(org,s.center_id) and (
 private.is_org_reader(org,actor) or private.is_manager(org,actor,s.center_id) or private.schedule_staff(org,actor,s.center_id)
 or private.session_assignee(org,actor,s.id)
 or exists(select 1 from core.reservations r where r.org_id=org and r.session_id=s.id and r.person_id=actor)
 ))
$$;
create or replace function private.schedule_session_view(org uuid,session uuid,financial bool)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',s.id,'class_id',s.class_id,'format',s.format,'discipline_id',s.discipline_id,
 'starts_at',s.starts_at,'ends_at',s.ends_at,'nominal',s.nominal,'maximum',s.maximum,'state',s.state,'attendance_state',s.attendance_state,'version',s.version,
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('person_id',a.person_id,'duty',a.duty) ||
 case when financial then jsonb_build_object('agreement_id',a.agreement_id) else '{}'::jsonb end order by a.person_id,a.duty)
 from core.session_assignments a where a.org_id=org and a.session_id=s.id and a.state='active'),'[]'::jsonb))
 from core.sessions s where s.org_id=org and s.id=session
$$;
create or replace function private.schedule_calendar_rows(org uuid,actor uuid)
returns table(id uuid,kind text,center_id uuid,starts_at timestamptz,ends_at timestamptz,title text,discipline_id uuid,discipline_ids jsonb,nominal bigint,maximum bigint)
language sql stable security invoker set search_path='' as $$
 select s.id,'session'::text,s.center_id,s.starts_at,s.ends_at,coalesce(c.name,d.name),s.discipline_id,null::jsonb,s.nominal,s.maximum
 from core.sessions s left join core.classes c on c.org_id=s.org_id and c.id=s.class_id
 join core.disciplines d on d.org_id=s.org_id and d.id=s.discipline_id
 where s.org_id=org and private.session_readable(org,actor,s.id)
 union all
 select e.id,'event'::text,e.center_id,e.starts_at,e.ends_at,e.name,null::uuid,
 coalesce((select jsonb_agg(d.discipline_id order by d.discipline_id) from core.event_disciplines d where d.org_id=org and d.event_id=e.id),'[]'::jsonb),e.nominal,e.maximum
 from core.events e where e.org_id=org and private.center_accessible(org,e.center_id)
 and exists(select 1 from core.saas_subscriptions b join core.saas_plan_versions p on p.id=b.plan_version_id where b.org_id=org and 'F29'=any(p.features))
 and (private.is_org_reader(org,actor) or private.is_manager(org,actor,e.center_id) or private.schedule_staff(org,actor,e.center_id)
 or private.event_assignee(org,actor,e.id) or exists(select 1 from core.event_registrations r where r.org_id=org and r.event_id=e.id and r.person_id=actor))
$$;
create or replace function private.schedule_page(op text,r jsonb,org uuid,actor uuid,center uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare sort_name text:=coalesce(r#>>'{page,sort}',case when op='calendar_get_v1' then 'starts_at_asc' else 'created_at_asc' end);
 lim int:=coalesce((r#>>'{page,limit}')::int,50);scope_hash text;cur jsonb;at_time timestamptz;last_id uuid;last_kind text;items jsonb;token text;last_item jsonb;
 lo timestamptz:=(r#>>'{interval,starts_at}')::timestamptz;hi timestamptz:=(r#>>'{interval,ends_at}')::timestamptz;
begin
 if lim<1 or lim>200 or (lo is not null and (hi is null or lo>=hi)) then perform private.fail('VALIDATION_FAILED');end if;
 if (op='calendar_get_v1' and sort_name<>'starts_at_asc') or (op='reservation_list_v1' and sort_name not in ('created_at_asc','created_at_desc','starts_at_asc')) then perform private.fail('VALIDATION_FAILED');end if;
 scope_hash:=encode(extensions.digest(jsonb_build_object('request',r-'request_id'-'page','actor',actor,'operation',op,'sort',sort_name)::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;
   if jsonb_typeof(cur) is distinct from 'object' or cur->>'scope' is distinct from scope_hash or cur->>'at' is null or cur->>'id' is null or cur->>'kind' is null then perform private.fail('VALIDATION_FAILED');end if;
   at_time:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;last_kind:=cur->>'kind';
   if not isfinite(at_time) or last_kind not in ('session','event','reservation') then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 if op='calendar_get_v1' then
  select coalesce(jsonb_agg(x.item order by x.starts_at,x.id,x.kind),'[]'::jsonb) into items from (
   select c.starts_at,c.id,c.kind,jsonb_build_object('id',c.id,'type',c.kind,'center_id',c.center_id,'starts_at',c.starts_at,'ends_at',c.ends_at,'title',c.title,
   'capacity',jsonb_build_object('nominal',c.nominal,'maximum',c.maximum),
   'resources',coalesce((select jsonb_agg(jsonb_build_object('kind',b.resource_kind,'id',b.resource_id) order by b.resource_kind,b.resource_id)
    from core.resource_bookings b where b.org_id=org and b.state='active' and ((c.kind='session' and b.session_id=c.id) or (c.kind='event' and b.event_id=c.id))),'[]'::jsonb)) ||
   case when c.kind='session' then jsonb_build_object('discipline_id',c.discipline_id) else jsonb_build_object('discipline_ids',c.discipline_ids) end ||
   jsonb_build_object('_at',c.starts_at,'_kind',c.kind) as item
   from private.schedule_calendar_rows(org,actor) c
   where (center is null or c.center_id=center) and c.starts_at<hi and c.ends_at>lo
   and (cur is null or (c.starts_at,c.id,c.kind)>(at_time,last_id,last_kind))
   and (r->>'resource' is null or r->'resource'='null'::jsonb
    or exists(select 1 from core.resource_bookings b where b.org_id=org and b.state='active' and b.resource_kind=r#>>'{resource,kind}' and b.resource_id=(r#>>'{resource,id}')::uuid and ((c.kind='session' and b.session_id=c.id) or (c.kind='event' and b.event_id=c.id)))
    or (r#>>'{resource,kind}'='person' and (
     (c.kind='session' and (exists(select 1 from core.session_assignments a where a.org_id=org and a.session_id=c.id and a.person_id=(r#>>'{resource,id}')::uuid and a.state='active') or exists(select 1 from core.class_assignments a join core.sessions s on s.org_id=a.org_id and s.class_id=a.class_id and s.center_id=a.center_id where s.org_id=org and s.id=c.id and a.person_id=(r#>>'{resource,id}')::uuid and a.state='active')))
     or (c.kind='event' and exists(select 1 from core.event_assignments a where a.org_id=org and a.event_id=c.id and a.person_id=(r#>>'{resource,id}')::uuid)))))
   order by c.starts_at,c.id,c.kind limit lim+1
  ) x;
 else
  select coalesce(jsonb_agg(x.item order by case when sort_name='created_at_desc' then x.at_time end desc,
   case when sort_name<>'created_at_desc' then x.at_time end,
   case when sort_name='created_at_desc' then x.id end desc,case when sort_name<>'created_at_desc' then x.id end) ,'[]'::jsonb) into items from (
   select v.id,case when sort_name='starts_at_asc' then s.starts_at else v.created_at end at_time,
   jsonb_build_object('id',v.id,'session_id',v.session_id,'person_id',v.person_id,'state',v.state,'mode',v.mode,'version',v.version,
   '_at',case when sort_name='starts_at_asc' then s.starts_at else v.created_at end,'_kind','reservation') item
   from core.reservations v join core.sessions s on s.org_id=v.org_id and s.id=v.session_id and s.center_id=v.center_id
   where v.org_id=org and private.center_accessible(org,v.center_id) and (center is null or v.center_id=center)
   and (r->>'person_id' is null or v.person_id=(r->>'person_id')::uuid)
   and (r->>'session_id' is null or v.session_id=(r->>'session_id')::uuid)
   and (lo is null or (s.starts_at<hi and s.ends_at>lo))
   and (private.is_org_reader(org,actor) or private.is_manager(org,actor,v.center_id) or private.schedule_staff(org,actor,v.center_id)
    or v.person_id=actor or (v.state in ('active','completed') and private.session_assignee(org,actor,s.id)))
   and (cur is null or (sort_name='created_at_desc' and (v.created_at,v.id)<(at_time,last_id))
    or (sort_name<>'created_at_desc' and (case when sort_name='starts_at_asc' then s.starts_at else v.created_at end,v.id)>(at_time,last_id)))
   order by case when sort_name='created_at_desc' then v.created_at end desc,
    case when sort_name='starts_at_asc' then s.starts_at when sort_name='created_at_asc' then v.created_at end,
    case when sort_name='created_at_desc' then v.id end desc,
    case when sort_name<>'created_at_desc' then v.id end
   limit lim+1
  ) x;
 end if;
 if jsonb_array_length(items)>lim then
  items:=items-(jsonb_array_length(items)-1);last_item:=items->(lim-1);
  token:=encode(convert_to(jsonb_build_object('scope',scope_hash,'at',last_item->>'_at','id',last_item->>'id','kind',last_item->>'_kind')::text,'UTF8'),'hex');
 end if;
 select coalesce(jsonb_agg(v-'_at'-'_kind' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(v,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',now());
end$$;
do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text:=$a$ -- DOMAIN_CASES$a$;
begin
 if strpos(body,anchor)=0 then raise exception 'Schedule dispatch anchor missing';end if;
 body:=replace(body,anchor,$cases$
 when 'session_get_v1','calendar_get_v1','reservation_list_v1' then
  if not exists(select 1 from core.centers c where c.org_id=org and (center is null or c.id=center) and private.schedule_scope(org,person,c.id)) then perform private.fail('FORBIDDEN');end if;
  if p_operation='session_get_v1' then
   select * into ses from core.sessions s where s.org_id=org and s.id=(r->>'session_id')::uuid and (center is null or s.center_id=center);
   if not found or not private.session_readable(org,person,ses.id) then perform private.fail('NOT_FOUND');end if;
   out:=private.schedule_session_view(org,ses.id,org_reader or private.is_manager(org,person,ses.center_id));
  else
   if r->>'session_id' is not null and not exists(select 1 from core.sessions s where s.org_id=org and s.id=(r->>'session_id')::uuid and (center is null or s.center_id=center) and private.session_readable(org,person,s.id)) then perform private.fail('NOT_FOUND');end if;
   out:=private.schedule_page(p_operation,r,org,person,center);
  end if;
 -- DOMAIN_CASES
 $cases$);
 execute body;
end
$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
notify pgrst,'reload schema';
commit;
