-- Accepted 25 October capacity revision. Previous migrations stay immutable.
begin;
alter table core.rooms add column if not exists capacity bigint check(capacity>=0);
-- Physical occupancy cannot be inferred from discipline-specific historical values.
-- Existing rooms remain explicitly unconfigured until an authorized room_save.
alter table core.sessions add column if not exists category_capacities jsonb;
alter table core.reservations add column if not exists booking_category text check(booking_category in ('male','female'));
alter table core.waitlist_entries add column if not exists booking_category text check(booking_category in ('male','female'));
alter table core.seat_offers add column if not exists booking_category text check(booking_category in ('male','female'));
alter table core.trial_offers add column if not exists booking_category text check(booking_category in ('male','female'));
-- Historical maximum is retained as storage only. All live booking paths use nominal
-- as the single total; no priority path can use the former higher threshold.
create function private.capacity_input(v jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare n bigint;c jsonb;
begin
 if v is null or jsonb_typeof(v)<>'object' or not v ? 'total' then perform private.fail('VALIDATION_FAILED');end if;
 n:=(v->>'total')::bigint;c:=v->'categories';
 if n<0 or (c is not null and c<>'null'::jsonb and (jsonb_typeof(c)<>'object' or not(c ? 'male' and c ? 'female') or (c->>'male')::bigint<0 or (c->>'female')::bigint<0)) then perform private.fail('VALIDATION_FAILED');end if;
 return jsonb_build_object('nominal',n,'maximum',n,'categories',c);
end$$;
create function private.capacity_request(op text,r jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
begin
 if op in ('session_create_v1','replacement_session_create_v1','session_capacity_set_v1') then r:=jsonb_set(r,'{capacity}',private.capacity_input(r->'capacity'));
 elsif op='program_preview_v1' then r:=jsonb_set(r,'{schedule,capacity}',private.capacity_input(r#>'{schedule,capacity}'));
 elsif op='session_change_preview_v1' and r#>'{patch,capacity}' is not null then r:=jsonb_set(r,'{patch,capacity}',private.capacity_input(r#>'{patch,capacity}'));end if;
 return r;
end$$;
create function private.capacity_holds(org uuid,sid uuid,category text default null) returns bigint language sql stable set search_path='' as $$
 select (select count(*) from core.reservations r where r.org_id=org and r.session_id=sid and r.state='active' and (category is null or r.booking_category=category))
 +(select count(*) from core.seat_offers o where o.org_id=org and o.session_id=sid and o.state='active' and o.expires_at>clock_timestamp() and (category is null or o.booking_category=category))
 +(select count(*) from core.trial_offers o where o.org_id=org and o.session_id=sid and o.state='active' and o.expires_at>clock_timestamp() and (category is null or o.booking_category=category))
$$;
create function private.capacity_room_limit(org uuid,sid uuid) returns bigint language plpgsql stable set search_path='' as $$
declare lim bigint;missing bool;
begin
 select min(r.capacity),bool_or(r.capacity is null) into lim,missing from core.resource_bookings b join core.rooms r on r.org_id=b.org_id and r.center_id=b.center_id and r.id=b.resource_id where b.org_id=org and b.session_id=sid and b.resource_kind='room' and b.state='active';
 if missing then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 return lim;
end$$;
create function private.capacity_check(org uuid,sid uuid,category text,override_requested bool default false) returns jsonb language plpgsql set search_path='' as $$
declare s core.sessions;lim bigint;n bigint;used bigint;cat_limit bigint;delta jsonb:='{}';
begin
 select * into s from core.sessions where org_id=org and id=sid for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 lim:=private.capacity_room_limit(org,sid);n:=private.capacity_holds(org,sid);
 if lim is not null and (s.nominal>lim or n>=lim) then perform private.fail('CAPACITY_FULL');end if;
 if s.category_capacities is not null then
  if category is null or not s.category_capacities ? category then perform private.fail('VALIDATION_FAILED');end if;
  used:=private.capacity_holds(org,sid,category);cat_limit:=(s.category_capacities->>category)::bigint;
  if used>=cat_limit then
   if not override_requested then perform private.fail('CAPACITY_FULL');end if;
   delta:=delta||jsonb_build_object('category',category,'category_limit',cat_limit,'category_before',used,'category_excess',used+1-cat_limit);
  end if;
 elsif category is not null then perform private.fail('VALIDATION_FAILED');end if;
 if n>=s.nominal then
  if not override_requested then perform private.fail('CAPACITY_FULL');end if;
  delta:=delta||jsonb_build_object('total_limit',s.nominal,'total_before',n,'total_excess',n+1-s.nominal);
 end if;
 return delta||jsonb_build_object('room_limit',lim);
end$$;
create function private.capacity_can_hold(org uuid,sid uuid,category text) returns bool language plpgsql set search_path='' as $$
begin perform private.capacity_check(org,sid,category,false);return true;
exception when sqlstate 'P0001' then
 if SQLERRM in ('CAPACITY_FULL','VALIDATION_FAILED','POLICY_NOT_CONFIGURED') then return false;end if;raise;
end$$;
create function private.capacity_authorize(org uuid,actor uuid,center uuid,sid uuid,reason text) returns void language plpgsql set search_path='' as $$
begin
 if length(btrim(coalesce(reason,'')))=0 then perform private.fail('VALIDATION_FAILED');end if;
 if not exists(select 1 from core.sessions s where s.org_id=org and s.center_id=center and s.id=sid) then perform private.fail('NOT_FOUND');end if;
 if private.is_manager(org,actor,center) or private.staff_grant(org,actor,center,'reservation.capacity_override') or (private.has_role(org,actor,'instructor',center) and private.lesson_duty(org,actor,sid,true)) then return;end if;
 perform private.fail('FORBIDDEN');
end$$;
create function private.capacity_view(org uuid,sid uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('total',s.nominal,'categories',s.category_capacities,'held',private.capacity_holds(org,sid),
 'remaining',greatest(0,s.nominal-private.capacity_holds(org,sid)),
 'category_held',case when s.category_capacities is null then null else jsonb_build_object('male',private.capacity_holds(org,sid,'male'),'female',private.capacity_holds(org,sid,'female')) end,
 'category_remaining',case when s.category_capacities is null then null else jsonb_build_object('male',greatest(0,(s.category_capacities->>'male')::bigint-private.capacity_holds(org,sid,'male')),'female',greatest(0,(s.category_capacities->>'female')::bigint-private.capacity_holds(org,sid,'female'))) end,
 'room_capacity',(select case when bool_or(z.capacity is null) then null else min(z.capacity) end from core.resource_bookings b join core.rooms z on z.org_id=b.org_id and z.center_id=b.center_id and z.id=b.resource_id where b.org_id=org and b.session_id=sid and b.resource_kind='room' and b.state='active'))
 from core.sessions s where s.org_id=org and s.id=sid
$$;
create function private.capacity_rooms_page(r jsonb,org uuid,center uuid,actor uuid) returns jsonb language plpgsql set search_path='' as $$
#variable_conflict use_column
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);cur jsonb;last_at timestamptz;last_id uuid;h text:=md5(jsonb_build_object('org',org,'center',center,'actor',actor,'request',r-'request_id'-'page')::text);items jsonb;token text;v jsonb;
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 if r#>>'{selector,operation}'<>'room_save_v1' or lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;
   if last_at is null or last_id is null then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(q.item order by q.created_at,q.id),'[]'::jsonb) into items from (
  select z.created_at,z.id,jsonb_build_object('operation','room_save_v1','entity',jsonb_build_object('type','rooms','id',z.id),'exists',true,'state',z.state,
   'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','rooms','id',z.id),'version',z.version)),'as_of',clock_timestamp(),
   'current',jsonb_build_object('operation','room_save_v1','values',jsonb_build_object('room_id',z.id,'name',z.name,'capacity',z.capacity))) item
  from core.rooms z where z.org_id=org and z.center_id=center and (r#>>'{selector,key,room_id}' is null or z.id=(r#>>'{selector,key,room_id}')::uuid)
  and (last_id is null or (z.created_at,z.id)>(last_at,last_id)) order by z.created_at,z.id limit lim+1
 ) q;
 if jsonb_array_length(items)>lim then
  items:=items-(jsonb_array_length(items)-1);v:=items->-1;
  token:=encode(convert_to(jsonb_build_object('scope',h,'at',(select z.created_at from core.rooms z where z.org_id=org and z.id=(v#>>'{entity,id}')::uuid),'id',v#>'{entity,id}')::text,'utf8'),'hex');
 end if;
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',clock_timestamp());
end$$;
-- Reviewable, checked rewrites of installed functions. Missing anchors abort migration.
create function private.capacity_patch(signature text,old text,replacement text) returns void language plpgsql set search_path='' as $$
declare b text:=pg_get_functiondef(signature::regprocedure);
begin if strpos(b,old)=0 then raise exception 'Capacity patch anchor missing: % / %',signature,left(old,140);end if;execute replace(b,old,replacement);end$$;

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$ -- Central permission mapping; no user_metadata or request actor/role can grant access.$old$,$new$ if p_operation='management_state_get_v1' and r->>'operation'='room_save_v1' then
  out:=private.capacity_rooms_page(r,org,center,person);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
 -- Central permission mapping; no user_metadata or request actor/role can grant access.$new$);
select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$r jsonb:=p_request;$old$,$new$r jsonb:=private.capacity_request(p_operation,p_request);$new$);

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$ if mutable then
  payload_digest$old$,$new$ if p_operation='reservation_capacity_override_v1' then perform private.capacity_authorize(org,person,center,(r->>'session_id')::uuid,r->>'reason');end if;
 if mutable then
  payload_digest$new$);

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$ elsif perm_code in ('event.register','reservation.write') then$old$,$new$ elsif perm_code='reservation.capacity_override' then
  perform private.capacity_authorize(org,person,center,(r->>'session_id')::uuid,r->>'reason');
 elsif perm_code in ('event.register','reservation.write') then$new$);

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$ when 'reservation_create_v1' then$old$,$new$ when 'reservation_create_v1','reservation_capacity_override_v1' then$new$);

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$  if not cm and not private.staff_grant(org,person,center,'reservation.write') and (not private.p07_same_person(org,target,person) or r->>'mode'<>'flexible') then$old$,$new$  if p_operation<>'reservation_capacity_override_v1' and not cm and not private.staff_grant(org,person,center,'reservation.write') and (not private.p07_same_person(org,target,person) or r->>'mode'<>'flexible') then$new$);

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$  if before_count>=(case when r->>'mode'='priority' then ses.maximum else ses.nominal end) then perform private.fail('CAPACITY_FULL');end if;$old$,$new$  audit_delta:=private.capacity_check(org,ses.id,r->>'booking_category',p_operation='reservation_capacity_override_v1');$new$);

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$update core.reservations set source_sale_id=selected,booking_obligation=$old$,$new$update core.reservations set source_sale_id=selected,booking_category=r->>'booking_category',booking_obligation=$new$);



select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$'nominal',r#>'{capacity,nominal}','maximum',r#>'{capacity,maximum}','resources'$old$,$new$'nominal',r#>'{capacity,nominal}','maximum',r#>'{capacity,maximum}','category_capacities',r#>'{capacity,categories}','resources'$new$);

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$proposal:=proposal||jsonb_build_object('nominal',r->'nominal','maximum',r->'maximum');$old$,$new$proposal:=proposal||jsonb_build_object('nominal',r#>'{capacity,nominal}','maximum',r#>'{capacity,maximum}','category_capacities',r#>'{capacity,categories}','_capacity_touch',true);$new$);

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$ when 'room_save_v1' then
  if center is null then perform private.fail('FORBIDDEN');end if;
  if exists(select 1 from jsonb_array_elements(r->'capacities') v where (v->>'nominal')::bigint>(v->>'maximum')::bigint)
   or (select count(*) from jsonb_array_elements(r->'capacities'))<>(select count(distinct v->>'discipline_id') from jsonb_array_elements(r->'capacities') v) then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from jsonb_array_elements(r->'capacities') v where not exists(
   select 1 from core.center_disciplines cd join core.disciplines d on d.org_id=cd.org_id and d.id=cd.discipline_id
   where cd.org_id=org and cd.center_id=center and cd.discipline_id=(v->>'discipline_id')::uuid and cd.state='active' and d.state='active')) then perform private.fail('NOT_FOUND');end if;
  if r->>'room_id' is null then
   if r ? 'expected_version' then perform private.fail('VERSION_CONFLICT');end if;
   insert into core.rooms(id,org_id,center_id,name,state) values(record_id,org,center,r->>'name','active');
  else
   record_id:=(r->>'room_id')::uuid;
   select * into row_record from core.rooms where org_id=org and center_id=center and id=record_id for update;
   if not found then perform private.fail('NOT_FOUND');end if;
   if row_record.state<>'active' then perform private.fail('VALIDATION_FAILED');end if;
   audit_delta:=jsonb_build_object('before',jsonb_build_object('name',row_record.name,'capacities',coalesce((select jsonb_agg(jsonb_build_object('discipline_id',c.discipline_id,'nominal',c.nominal,'maximum',c.maximum) order by c.discipline_id) from core.room_capacities c where c.org_id=org and c.center_id=center and c.room_id=record_id),'[]'::jsonb)));
   update core.rooms set name=r->>'name',version=version+1 where org_id=org and center_id=center and id=record_id and version=(r->>'expected_version')::bigint returning version into version_n;
   if not found then perform private.fail('VERSION_CONFLICT');end if;
  end if;
  delete from core.room_capacities c where c.org_id=org and c.center_id=center and c.room_id=record_id and not exists(select 1 from jsonb_array_elements(r->'capacities') v where (v->>'discipline_id')::uuid=c.discipline_id);
  for entry in select v from jsonb_array_elements(r->'capacities') v order by v->>'discipline_id' loop
   update core.room_capacities set nominal=(entry->>'nominal')::bigint,maximum=(entry->>'maximum')::bigint,version=version+1 where org_id=org and center_id=center and room_id=record_id and discipline_id=(entry->>'discipline_id')::uuid;
   if not found then
    insert into core.room_capacities(id,org_id,center_id,room_id,discipline_id,nominal,maximum) values(private.new_id(p_ids,idx),org,center,record_id,(entry->>'discipline_id')::uuid,(entry->>'nominal')::bigint,(entry->>'maximum')::bigint);idx:=idx+1;
   end if;
  end loop;
  audit_delta:=coalesce(audit_delta,'{}'::jsonb)||jsonb_build_object('after',jsonb_build_object('name',r->>'name','capacities',r->'capacities'));subject:='rooms';
$old$,$new$ when 'room_save_v1' then
  if center is null then perform private.fail('FORBIDDEN');end if;
  if (r->>'capacity')::bigint<0 then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'room_id' is null then
   if r ? 'expected_version' then perform private.fail('VERSION_CONFLICT');end if;
   insert into core.rooms(id,org_id,center_id,name,state,capacity) values(record_id,org,center,r->>'name','active',(r->>'capacity')::bigint);
  else
   record_id:=(r->>'room_id')::uuid;
   select * into row_record from core.rooms where org_id=org and center_id=center and id=record_id for update;
   if not found then perform private.fail('NOT_FOUND');end if;
   if row_record.state<>'active' then perform private.fail('VALIDATION_FAILED');end if;
   if exists(select 1 from core.resource_bookings b join core.sessions s on s.org_id=b.org_id and s.id=b.session_id where b.org_id=org and b.center_id=center and b.resource_id=record_id and b.resource_kind='room' and b.state='active' and s.state='planned' and (s.nominal>(r->>'capacity')::bigint or private.capacity_holds(org,s.id)>(r->>'capacity')::bigint)) then perform private.fail('CAPACITY_FULL');end if;
   audit_delta:=jsonb_build_object('before',jsonb_build_object('name',row_record.name,'capacity',row_record.capacity));
   update core.rooms set name=r->>'name',capacity=(r->>'capacity')::bigint,version=version+1 where org_id=org and center_id=center and id=record_id and version=(r->>'expected_version')::bigint returning version into version_n;
   if not found then perform private.fail('VERSION_CONFLICT');end if;
  end if;
  audit_delta:=coalesce(audit_delta,'{}'::jsonb)||jsonb_build_object('after',jsonb_build_object('name',r->>'name','capacity',r->'capacity'));subject:='rooms';
$new$);

select private.capacity_patch('private.schedule_snapshot(uuid,uuid)',$old$'maximum',s.maximum,'expected_version'$old$,$new$'maximum',s.nominal,'category_capacities',s.category_capacities,'expected_version'$new$);

select private.capacity_patch('private.schedule_build_program(uuid,uuid,jsonb,uuid[])',$old$'maximum',spec#>'{capacity,maximum}',$old$,$new$'maximum',spec#>'{capacity,maximum}','category_capacities',spec#>'{capacity,categories}',$new$);

select private.capacity_patch('private.schedule_build_change(uuid,uuid,jsonb)',$old$'maximum',p#>'{capacity,maximum}');$old$,$new$'maximum',p#>'{capacity,maximum}','category_capacities',p#>'{capacity,categories}');$new$);

select private.capacity_patch('private.schedule_validate(uuid,uuid,jsonb)',$old$  if not exists(select 1 from core.center_disciplines$old$,$new$  if coalesce((d->>'_touch')::bool,true) or coalesce((d->>'_capacity_touch')::bool,false) then
   if d->'category_capacities' is not null and d->'category_capacities'<>'null'::jsonb then
    perform private.capacity_input(jsonb_build_object('total',d->'nominal','categories',d->'category_capacities'));
    if exists(select 1 from core.reservations v where v.org_id=org and v.session_id=(d->>'id')::uuid and v.state='active' and v.booking_category is null)
     or exists(select 1 from core.seat_offers v where v.org_id=org and v.session_id=(d->>'id')::uuid and v.state='active' and v.expires_at>clock_timestamp() and v.booking_category is null)
     or exists(select 1 from core.trial_offers v where v.org_id=org and v.session_id=(d->>'id')::uuid and v.state='active' and v.expires_at>clock_timestamp() and v.booking_category is null) then perform private.fail('VALIDATION_FAILED');end if;
   end if;
   for e in select x from jsonb_array_elements(d->'resources') x where x->>'kind'='room' loop
    select * into r from core.rooms z where z.org_id=org and z.center_id=center and z.id=(e->>'id')::uuid for update;
    if not found then perform private.fail('NOT_FOUND');end if;
    if r.capacity is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
    if (d->>'nominal')::bigint>r.capacity or private.capacity_holds(org,(d->>'id')::uuid)>r.capacity then perform private.fail('CAPACITY_FULL');end if;
   end loop;
  end if;
  if not exists(select 1 from core.center_disciplines$new$);

select private.capacity_patch('private.schedule_write(uuid,jsonb,uuid[],integer)',$old$  end if;
 end loop;
 for d in select x from jsonb_array_elements(rows_data) x order by x->>'id' loop$old$,$new$  end if;
  update core.sessions set category_capacities=nullif(d->'category_capacities','null'::jsonb),maximum=nominal where org_id=org and id=(d->>'id')::uuid;
 end loop;
 for d in select x from jsonb_array_elements(rows_data) x order by x->>'id' loop$new$);

select private.capacity_patch('private.schedule_preview_rows(jsonb)',$old$'capacity',jsonb_build_object('nominal',n->'nominal','maximum',n->'maximum')$old$,$new$'capacity',jsonb_build_object('total',n->'nominal','categories',n->'category_capacities')$new$);

select private.capacity_patch('private.schedule_session_view(uuid,uuid,boolean)',$old$'nominal',s.nominal,'maximum',s.maximum,$old$,$new$'capacity',private.capacity_view(org,s.id),$new$);

select private.capacity_patch('private.schedule_page(text,jsonb,uuid,uuid,uuid)',$old$'capacity',jsonb_build_object('nominal',c.nominal,'maximum',c.maximum)$old$,$new$'capacity',case when c.kind='session' then private.capacity_view(org,c.id) else jsonb_build_object('nominal',c.nominal,'maximum',c.maximum) end$new$);

select private.capacity_patch('private.p02_session_dispatch(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)',$old$'maximum',r#>'{capacity,maximum}','resources'$old$,$new$'maximum',r#>'{capacity,maximum}','category_capacities',r#>'{capacity,categories}','resources'$new$);

select private.capacity_patch('private.p01_wait_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])',$old$  if exists(select 1 from core.waitlist_entries$old$,$new$  if (s.category_capacities is not null and (r->>'booking_category' is null or not s.category_capacities ? (r->>'booking_category'))) or (s.category_capacities is null and r->>'booking_category' is not null) then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from core.waitlist_entries$new$);

select private.capacity_patch('private.p01_wait_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])',$old$clock_timestamp(),'waiting');$old$,$new$clock_timestamp(),'waiting');
  update core.waitlist_entries set booking_category=r->>'booking_category' where org_id=org and id=entity_id;$new$);

select private.capacity_patch('private.p01_wait_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])',$old$'person_id',o.person_id,'mode','flexible'$old$,$new$'person_id',o.person_id,'mode','flexible','booking_category',o.booking_category$new$);

select private.capacity_patch('private.p01_worker_execute(text,jsonb,uuid[])',$old$    if not private.p01_wait_eligible(org,s,w.person_id) then continue;end if;$old$,$new$    if not private.p01_wait_eligible(org,s,w.person_id) or not private.capacity_can_hold(org,s.id,w.booking_category) then continue;end if;$new$);

select private.capacity_patch('private.p01_worker_execute(text,jsonb,uuid[])',$old$w.person_id,close_at,'active');$old$,$new$w.person_id,close_at,'active');
    update core.seat_offers set booking_category=w.booking_category where org_id=org and id=entity_id;$new$);

select private.capacity_patch('private.p04_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])',$old$  if sid is not null then perform private.p04_trial_session(org,center,l.person_id,pv.id,sid);end if;$old$,$new$  if sid is not null then perform private.p04_trial_session(org,center,l.person_id,pv.id,sid);perform private.capacity_check(org,sid,r->>'booking_category',false);end if;$new$);

select private.capacity_patch('private.p04_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])',$old$  subject:='trial_offers';
 elsif op='trial_registration_confirm_v1'$old$,$new$  update core.trial_offers set booking_category=r->>'booking_category' where org_id=org and id=pid;
  subject:='trial_offers';
 elsif op='trial_registration_confirm_v1'$new$);

select private.capacity_patch('private.p04_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])',$old$  perform private.p04_trial_session(org,center,l.person_id,o.product_version_id,o.session_id,o.id);$old$,$new$  perform private.p04_trial_session(org,center,l.person_id,o.product_version_id,o.session_id,o.id);
  perform private.capacity_check(org,o.session_id,o.booking_category,false);$new$);

select private.capacity_patch('private.p04_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])',$old$  perform private.p01_request_documents(org,private.new_id(ids,22));$old$,$new$  update core.reservations set booking_category=o.booking_category where org_id=org and id=private.new_id(ids,22);
  perform private.p01_request_documents(org,private.new_id(ids,22));$new$);

select private.capacity_patch('private.p01_request_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[])',$old$'person_id',q.person_id,'mode','flexible'$old$,$new$'person_id',q.person_id,'mode','flexible','booking_category',r->'booking_category'$new$);

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$'person.manage','person.activate','invite.student','reservation.write','attendance.draft','sale.write','finance.collect'$old$,$new$'person.manage','person.activate','invite.student','reservation.write','attendance.draft','sale.write','finance.collect','reservation.capacity_override'$new$);

select private.capacity_patch('private.schedule_page(text,jsonb,uuid,uuid,uuid)',$old$'state',v.state,'mode',v.mode,'version',v.version,$old$,$new$'state',v.state,'mode',v.mode,'version',v.version,'booking_category',v.booking_category,$new$);

select private.capacity_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$  if r->>'permission' not in ($old$,$new$  if r->>'permission'='reservation.capacity_override' and not private.has_role(org,target,'staff',center) then perform private.fail('FORBIDDEN');end if;
  if r->>'permission' not in ($new$);

insert into private.runtime_operations(name,permission,billing_class,features) values('reservation_capacity_override_v1','reservation.capacity_override','reservation',array['F15']::text[]);
create function api_v1.reservation_capacity_override_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('reservation_capacity_override_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.reservation_capacity_override_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.reservation_capacity_override_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
drop function private.capacity_patch(text,text,text);
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
notify pgrst,'reload schema';
commit;
