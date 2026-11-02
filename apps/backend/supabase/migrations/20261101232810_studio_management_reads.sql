begin;
-- S02: inspect existing classes/programs under the original live schedule authority.
create function private.studio_management_page(r jsonb,org uuid,center uuid,person uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';lim int:=coalesce((r#>>'{page,limit}')::int,50);
 cur jsonb;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();items jsonb;token text;
 h text:=md5(jsonb_build_object('account',account,'request',r-'request_id'-'page')::text);
begin
 if center is null or not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
 if not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 if op not in ('class_save_v1','program_preview_v1') or r#>>'{selector,operation}' is distinct from op
  or lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 perform private.require_feature(org,'F10');
 if op='program_preview_v1' then
  perform private.require_feature(org,'F08');
  if not exists(select 1 from core.classes c where c.org_id=org and c.center_id=center and c.id=(k->>'class_id')::uuid
   and private.starter_selected(org,'discipline',c.discipline_id)) then perform private.fail('NOT_FOUND');end if;
 end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb then
  if op='class_save_v1' and (k->>'class_id' is null or r->'entity'<>jsonb_build_object('type','classes','id',k->'class_id'))
   or op='program_preview_v1' and (k->>'program_id' is null or r->'entity'<>jsonb_build_object('type','program_versions','id',k->'program_id')) then perform private.fail('NOT_FOUND');end if;
 end if;
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or last_at is null or last_id is null or asof is null
    or not isfinite(last_at) or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with candidates as(
  select c.created_at,c.id,jsonb_build_object('operation',op,'entity',jsonb_build_object('type','classes','id',c.id),'exists',true,'state',c.state,
   'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','classes','id',c.id),'version',c.version)),
   'as_of',asof,'current',jsonb_build_object('operation',op,'values',jsonb_build_object('class_id',c.id,'discipline_id',c.discipline_id,'name',c.name,'external_open',c.external_open))) item
  from core.classes c where op='class_save_v1' and c.org_id=org and c.center_id=center
   and (k->>'class_id' is null or c.id=(k->>'class_id')::uuid) and (k->>'discipline_id' is null or c.discipline_id=(k->>'discipline_id')::uuid)
   and private.starter_selected(org,'discipline',c.discipline_id)
  union all
  select p.created_at,p.id,jsonb_build_object('operation',op,'entity',jsonb_build_object('type','program_versions','id',p.id),'exists',true,'state',p.state,
   'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','program_versions','id',p.id),'version',p.version),jsonb_build_object('entity',jsonb_build_object('type','classes','id',c.id),'version',c.version)),
   'as_of',asof,'current',jsonb_build_object('operation',op,'values',jsonb_build_object('class_id',c.id,'program_id',p.id)
    ||case when p.timezone is null then '{}'::jsonb else jsonb_build_object('timezone',p.timezone) end
    ||case when p.spec_snapshot is null then '{}'::jsonb else jsonb_build_object('schedule',
     case when p.spec_snapshot#>'{capacity,nominal}' is null then p.spec_snapshot else jsonb_set(p.spec_snapshot,'{capacity}',
      jsonb_build_object('total',p.spec_snapshot#>'{capacity,nominal}')||case when p.spec_snapshot#>'{capacity,categories}' is null or p.spec_snapshot#>'{capacity,categories}'='null'::jsonb then '{}'::jsonb else jsonb_build_object('categories',p.spec_snapshot#>'{capacity,categories}') end) end) end)) item
  from core.program_versions p join core.classes c on c.org_id=p.org_id and c.center_id=p.center_id and c.id=p.class_id
  where op='program_preview_v1' and p.org_id=org and p.center_id=center and p.class_id=(k->>'class_id')::uuid
   and (k->>'program_id' is null or p.id=(k->>'program_id')::uuid) and private.starter_selected(org,'discipline',c.discipline_id)
 ),page as(select * from candidates where created_at<=asof and (cur is null or (created_at,id)>(last_at,last_id)) order by created_at,id limit lim+1)
 select coalesce(jsonb_agg(item||jsonb_build_object('_at',created_at) order by created_at,id),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)>lim then
  items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',(items->-1)#>'{entity,id}','as_of',asof)::text,'utf8'),'hex');
 end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text:=$a$ if p_operation='management_state_get_v1' and r->>'operation'='room_save_v1' then$a$;
begin
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Studio management dispatch anchor drift';end if;
 execute replace(b,anchor,$a$ if p_operation='management_state_get_v1' and r->>'operation' in ('class_save_v1','program_preview_v1') then
  out:=private.studio_management_page(r,org,center,person,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
 if p_operation='management_state_get_v1' and r->>'operation'='room_save_v1' then$a$);
end$patch$;
revoke all on function private.studio_management_page(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.studio_management_page(jsonb,uuid,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
