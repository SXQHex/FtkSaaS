begin;

-- These are the two independent ways to see a session in an accessible center.
create function private.schedule_center_reader(org uuid, actor uuid, center uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select private.is_org_reader($1,$2) or private.is_manager($1,$2,$3) or private.schedule_staff($1,$2,$3)
$$;

create function private.session_participant_reader(org uuid, actor uuid, session uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select private.session_assignee($1,$2,$3) or exists(
  select 1 from core.reservations r
  where r.org_id=$1 and r.session_id=$3 and private.p07_same_person($1,r.person_id,$2)
 )
$$;

create or replace function private.session_readable(org uuid,actor uuid,session uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(
  select 1 from core.sessions s where s.org_id=$1 and s.id=$3 and private.center_accessible($1,s.center_id)
  and (private.schedule_center_reader($1,$2,s.center_id) or private.session_participant_reader($1,$2,s.id))
 )
$$;

create function private.schedule_calendar_window(org uuid,actor uuid,requested_center uuid,lo timestamptz,hi timestamptz)
returns table(id uuid,kind text,center_id uuid,starts_at timestamptz,ends_at timestamptz,title text,
              discipline_id uuid,discipline_ids jsonb,nominal bigint,maximum bigint)
language sql stable security invoker set search_path='' as $$
 with center_readers as materialized (
  select z.id,private.schedule_center_reader($1,$2,z.id) as reads_all
  from core.centers z
  where z.org_id=$1 and ($3 is null or z.id=$3) and private.center_accessible($1,z.id)
 )
 select s.id,'session'::text,s.center_id,s.starts_at,s.ends_at,coalesce(c.name,d.name),s.discipline_id,null::jsonb,s.nominal,s.maximum
 from center_readers z join core.sessions s on s.org_id=$1 and s.center_id=z.id
 left join core.classes c on c.org_id=s.org_id and c.id=s.class_id
 join core.disciplines d on d.org_id=s.org_id and d.id=s.discipline_id
 where ($4 is null or s.ends_at>$4) and ($5 is null or s.starts_at<$5)
 and (z.reads_all or private.session_participant_reader($1,$2,s.id))
 union all
 select e.id,'event'::text,e.center_id,e.starts_at,e.ends_at,e.name,null::uuid,
        coalesce((select jsonb_agg(ed.discipline_id order by ed.discipline_id) from core.event_disciplines ed
                  where ed.org_id=e.org_id and ed.event_id=e.id),'[]'::jsonb),e.nominal,e.maximum
 from center_readers z join core.events e on e.org_id=$1 and e.center_id=z.id
 where ($4 is null or e.ends_at>$4) and ($5 is null or e.starts_at<$5)
 and exists(select 1 from core.saas_subscriptions b join core.saas_plan_versions p on p.id=b.plan_version_id
            where b.org_id=$1 and 'F29'=any(p.features))
 and (z.reads_all or private.event_assignee($1,$2,e.id) or exists(
  select 1 from core.event_registrations r where r.org_id=$1 and r.event_id=e.id and private.p07_same_person($1,r.person_id,$2)
 ))
$$;

create or replace function private.schedule_calendar_rows(org uuid, actor uuid)
returns table(id uuid,kind text,center_id uuid,starts_at timestamptz,ends_at timestamptz,title text,
              discipline_id uuid,discipline_ids jsonb,nominal bigint,maximum bigint)
language sql stable security invoker set search_path='' as $$
 select * from private.schedule_calendar_window($1,$2,null,null,null)
$$;

revoke all on function private.schedule_center_reader(uuid,uuid,uuid),private.session_participant_reader(uuid,uuid,uuid),
 private.schedule_calendar_window(uuid,uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function private.schedule_center_reader(uuid,uuid,uuid),private.session_participant_reader(uuid,uuid,uuid),
 private.schedule_calendar_window(uuid,uuid,uuid,timestamptz,timestamptz) to service_role;

do $migration$
declare
 page_body text:=pg_get_functiondef('private.schedule_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 scope_body text:=pg_get_functiondef('private.schedule_scope(uuid,uuid,uuid)'::regprocedure);
 old_rows text:='private.schedule_calendar_rows(org,actor) c';
 old_roles text:='private.is_org_reader(org,actor) or private.is_manager(org,actor,center) or private.schedule_staff(org,actor,center)';
begin
 if cardinality(string_to_array(page_body,old_rows))<>2 or cardinality(string_to_array(scope_body,old_roles))<>2 then
  raise exception 'Unexpected calendar access or pagination definition';
 end if;
 execute replace(page_body,old_rows,'private.schedule_calendar_window(org,actor,center,lo,hi) c');
 execute replace(scope_body,old_roles,'private.schedule_center_reader(org,actor,center)');
end
$migration$;

commit;
