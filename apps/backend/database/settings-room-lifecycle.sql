begin;
alter table core.rooms add column if not exists description text not null default '' check(char_length(description)<=2000);
alter table core.rooms add column if not exists location text not null default '' check(char_length(location)<=1000);
create function private.room_deactivation_effects(org uuid,center uuid,room uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with refs as(
 select distinct 'sessions'::text entity_type,s.id,s.version,s.starts_at,s.ends_at from core.resource_bookings b join core.sessions s on s.org_id=b.org_id and s.id=b.session_id
 where b.org_id=$1 and b.center_id=$2 and b.resource_kind='room' and b.resource_id=$3 and b.state='active' and s.state<>'cancelled' and s.ends_at>clock_timestamp()
 union all
 select 'events'::text,e.id,e.version,e.starts_at,e.ends_at from core.events e
 where e.org_id=$1 and e.center_id=$2 and e.venue->>'kind'='internal' and e.venue->>'room_id'=$3::text and e.state in ('draft','published') and e.ends_at>clock_timestamp()),
 page as(select * from refs order by starts_at,entity_type,id limit 200)
 select jsonb_build_object('count',(select count(*) from refs),'truncated',(select count(*)>200 from refs),
 'items',coalesce((select jsonb_agg(jsonb_build_object('type',p.entity_type,'id',p.id,'version',p.version,'starts_at',p.starts_at,'ends_at',p.ends_at) order by starts_at,entity_type,id) from page p),'[]'))
$$;
do $patch$
declare b text;a text;room_clause text;changed text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=E' when ''room_save_v1'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Room lifecycle dispatch drift';end if;
 room_clause:=split_part(split_part(b,a,2),E' when ''',1);changed:=room_clause;
 changed:=replace(changed,'name,state,capacity) values(record_id,org,center,r->>''name'',''active'',(r->>''capacity'')::bigint)',
 'name,state,capacity,description,location) values(record_id,org,center,r->>''name'',coalesce(r->>''state'',''active''),(r->>''capacity'')::bigint,coalesce(r->>''description'',''''),coalesce(r->>''location'',''''))');
 changed:=replace(changed,'if row_record.state<>''active'' then perform private.fail(''VALIDATION_FAILED'');end if;',
 'if row_record.state<>''active'' and not r?''state'' then perform private.fail(''VALIDATION_FAILED'');end if;
   if r->>''state''=''inactive'' and (private.room_deactivation_effects(org,center,record_id)->>''count'')::bigint>0 then perform private.fail(''OPEN_OPERATIONS_EXIST'');end if;');
 changed:=replace(changed,'''name'',row_record.name,''capacity'',row_record.capacity)',
 '''name'',row_record.name,''capacity'',row_record.capacity,''state'',row_record.state,''description'',row_record.description,''location'',row_record.location)');
 changed:=replace(changed,'capacity=(r->>''capacity'')::bigint,version=version+1',
 'capacity=(r->>''capacity'')::bigint,state=coalesce(r->>''state'',state),description=coalesce(r->>''description'',description),location=coalesce(r->>''location'',location),version=version+1');
 changed:=replace(changed,'''name'',r->>''name'',''capacity'',r->''capacity'')',
 '''name'',r->>''name'',''capacity'',r->''capacity'',''state'',(select state from core.rooms where id=record_id),''description'',(select description from core.rooms where id=record_id),''location'',(select location from core.rooms where id=record_id))');
 if changed=room_clause or strpos(changed,'room_deactivation_effects')=0 or strpos(changed,'location=coalesce')=0 then raise exception 'Room lifecycle writer anchors drift';end if;
 execute replace(b,room_clause,changed);
 b:=pg_get_functiondef('private.capacity_rooms_page(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:='''room_id'',z.id,''name'',z.name,''capacity'',z.capacity)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Room details reader drift';end if;
 execute replace(b,a,a||' ||case when coalesce((r#>>''{selector,key,include_details}'')::boolean,false) then jsonb_build_object(''description'',z.description,''location'',z.location,''state'',z.state,''deactivation_effects'',private.room_deactivation_effects(org,center,z.id)) else ''{}''::jsonb end');
end$patch$;
revoke all on function private.room_deactivation_effects(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.room_deactivation_effects(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
