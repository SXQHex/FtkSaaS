begin;
create function private.public_program_details(p core.publications) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare s core.sessions;e core.events;zone text;occupancy jsonb;instructors jsonb;
begin
 if p.session_id is not null then
  select * into s from core.sessions where org_id=p.org_id and id=p.session_id;
  select timezone into zone from core.centers where org_id=p.org_id and id=p.center_id;
  if coalesce((p.public_details->>'show_occupancy')::bool,false) then
   occupancy:=jsonb_build_object('registered',(select count(*) from core.reservations where org_id=p.org_id and session_id=s.id and state='active'),'capacity',s.nominal);
  end if;
  if coalesce((p.public_details->>'show_instructors')::bool,false) then
   select coalesce(jsonb_agg(name order by name),'[]') into instructors from (
    select distinct person.display_name name from core.session_assignments a join core.people person on person.org_id=a.org_id and person.id=private.p07_person_root(p.org_id,a.person_id)
    where a.org_id=p.org_id and a.session_id=s.id and a.duty='instructor' and a.state='active' and person.state='active'
   ) names;
  end if;
 else
  select * into e from core.events where org_id=p.org_id and id=p.event_id;zone:=e.timezone;
  if coalesce((p.public_details->>'show_occupancy')::bool,false) then
   occupancy:=jsonb_build_object('registered',(select count(*) from core.event_registrations where org_id=p.org_id and event_id=e.id and state='active'),'capacity',e.nominal);
  end if;
  if coalesce((p.public_details->>'show_instructors')::bool,false) then
   select coalesce(jsonb_agg(name order by name),'[]') into instructors from (
    select distinct person.display_name name from core.event_assignments a join core.people person on person.org_id=a.org_id and person.id=private.p07_person_root(p.org_id,a.person_id)
    where a.org_id=p.org_id and a.event_id=e.id and a.duty='instructor' and person.state='active'
   ) names;
  end if;
 end if;
 return jsonb_build_object('kind',case when p.session_id is not null then 'lesson' else 'event' end,'timezone',zone,'occupancy',occupancy,'instructors',instructors);
end$$;
create function private.public_program_page_context(r jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare org uuid:=private.settings_public_slug(r->>'slug');center uuid:=(r->>'center_id')::uuid;app jsonb;available boolean:=false;
begin
 if org is not null then
  app:=private.public_form_discovery(org,center);
  available:=app->>'state'='open' or private.settings_public_profile(org,center) is not null or exists(
   select 1 from core.publications p left join core.sessions s on s.org_id=p.org_id and s.id=p.session_id left join core.events e on e.org_id=p.org_id and e.id=p.event_id
   where p.slug=r->>'slug' and p.published and p.public_details is not null and (center is null or p.center_id=center)
   and private.access_mode(p.org_id) in ('normal','grace') and private.center_accessible(p.org_id,p.center_id)
   and exists(select 1 from core.saas_subscriptions z join core.saas_plan_versions v on v.id=z.plan_version_id where z.org_id=p.org_id and 'F25'=any(v.features))
   and ((s.id is not null and s.state='planned') or (e.id is not null and e.state='published')));
 end if;
 return jsonb_build_object('publication_state',case when available then 'available' else 'unavailable' end,'application',coalesce(app,jsonb_build_object('state','closed','form',null)));
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.p04_public(text,jsonb,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=$a$p.public_details||jsonb_build_object('publication_id'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public program item projection drift';end if;
 b:=replace(b,a,$a$(p.public_details-'show_occupancy'-'show_instructors')||case when coalesce((r->>'include_details')::bool,false) then private.public_program_details(p) else '{}'::jsonb end||jsonb_build_object('publication_id'$a$);
 a:='   and (cur is null or (coalesce(s.starts_at,e.starts_at),p.id)>(last_at,last_id))';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public discipline scope drift';end if;
 b:=replace(b,a,$a$   and (r->>'discipline_id' is null or s.discipline_id=(r->>'discipline_id')::uuid or exists(select 1 from core.event_disciplines d where d.org_id=p.org_id and d.event_id=e.id and d.discipline_id=(r->>'discipline_id')::uuid))
$a$||a);
 a:=$a$'data',jsonb_build_object('items',items,'next_cursor',token,'as_of',asof$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public page state projection drift';end if;
 execute replace(b,a,$a$'data',case when coalesce((r->>'include_details')::bool,false) then private.public_program_page_context(r) else '{}'::jsonb end||jsonb_build_object('items',items,'next_cursor',token,'as_of',asof$a$);
end$patch$;
revoke all on function private.public_program_details(core.publications),private.public_program_page_context(jsonb) from public,anon,authenticated;
grant execute on function private.public_program_details(core.publications),private.public_program_page_context(jsonb) to service_role;
commit;
