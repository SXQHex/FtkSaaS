begin;
create function private.discipline_deactivation_effects(org uuid,discipline uuid,center uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 with affected_sessions as (
  select s.* from core.sessions s where s.org_id=org and s.discipline_id=discipline and (center is null or s.center_id=center)
  and s.state<>'cancelled' and s.ends_at>clock_timestamp()
 ),scope_products as(
  select distinct pv.product_id,pv.id version_id from core.product_versions pv join core.product_scopes ps on ps.org_id=pv.org_id and ps.product_version_id=pv.id
  where pv.org_id=org and (center is null or pv.center_id=center) and (ps.discipline_id=discipline or exists(select 1 from core.classes cl where cl.org_id=org and cl.id=ps.class_id and cl.discipline_id=discipline))
 ),refs as(
  select 'sessions' category,s.id,s.version,true blocking from affected_sessions s
  union all select 'reservations',r.id,r.version,true from core.reservations r join affected_sessions s on s.org_id=r.org_id and s.id=r.session_id where r.state='active'
  union all select 'requests',q.id,q.version,true from core.lesson_requests q where q.org_id=org and q.discipline_id=discipline and (center is null or q.center_id=center) and private.lesson_request_actionable(q)
  union all select 'waitlist',w.id,w.version,true from core.waitlist_entries w join affected_sessions s on s.org_id=w.org_id and s.id=w.session_id where w.state in ('waiting','offered')
  union all select 'offers',o.id,o.version,true from core.seat_offers o join affected_sessions s on s.org_id=o.org_id and s.id=o.session_id where o.state='active' and o.expires_at>clock_timestamp()
  union all select 'classes',c.id,c.version,false from core.classes c where c.org_id=org and c.discipline_id=discipline and c.state='active' and (center is null or c.center_id=center)
  union all select 'programs',p.id,p.version,false from core.program_versions p join core.classes c on c.org_id=p.org_id and c.id=p.class_id where p.org_id=org and c.discipline_id=discipline and p.state='active' and (center is null or p.center_id=center)
  union all select distinct 'products',p.id,p.version,false from core.products p join scope_products sp on sp.product_id=p.id where p.org_id=org and p.state='active'
  union all select 'sales',s.id,s.version,false from core.sales s where s.org_id=org and s.state='active' and exists(select 1 from scope_products sp where sp.version_id=s.product_version_id) and (center is null or s.center_id=center)
 ),counts as(select category,count(*) n from refs group by category),first_page as(select * from refs order by category,id limit 200)
 select jsonb_build_object('blocking',coalesce((select bool_or(blocking) from refs),false),
 'counts','{"sessions":0,"reservations":0,"requests":0,"waitlist":0,"offers":0,"classes":0,"programs":0,"products":0,"sales":0}'::jsonb||coalesce((select jsonb_object_agg(category,n) from counts),'{}'),
 'items',coalesce((select jsonb_agg(to_jsonb(p) order by category,id) from first_page p),'[]'),
 'proof',md5(org::text||':'||discipline::text||':'||coalesce(center::text,'all')||':'||coalesce((select string_agg(category||':'||id::text||':'||version::text,',' order by category,id) from refs),'')),
 'truncated',(select count(*)>200 from refs))
$$;
create function private.discipline_deactivation_access(op text,r jsonb,org uuid) returns void
language plpgsql stable security invoker set search_path='' as $$
declare center uuid:=case when op='center_discipline_set_v1' then (r->>'center_id')::uuid end;effects jsonb;
begin
 if r->>'state'<>'inactive' or r->>'discipline_id' is null then return;end if;
 if op='discipline_save_v1' and not exists(select 1 from core.disciplines where org_id=org and id=(r->>'discipline_id')::uuid and state='active') then return;end if;
 if op='center_discipline_set_v1' and not exists(select 1 from core.center_disciplines where org_id=org and center_id=center and discipline_id=(r->>'discipline_id')::uuid and state='active') then return;end if;
 effects:=private.discipline_deactivation_effects(org,(r->>'discipline_id')::uuid,center);
 if (effects->>'blocking')::boolean then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
 -- Existing class/product/right references remain immutable and require a
 -- current explicit acknowledgment. No implicit cancellation or resurrection.
 if jsonb_array_length(effects->'items')>0 and r->>'deactivation_proof' is distinct from effects->>'proof' then perform private.fail('PREVIEW_STALE');end if;
end$$;
create function private.discipline_management_page(r jsonb,org uuid,person uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare discipline uuid:=(r#>>'{selector,key,discipline_id}')::uuid;d core.disciplines;projection jsonb;at timestamptz:=clock_timestamp();
begin
 if not coalesce(private.is_org_reader(org,person),false) then perform private.fail('FORBIDDEN');end if;
 perform private.require_feature(org,'F01');
 if r#>>'{selector,operation}'<>'discipline_save_v1' or discipline is null or r#>>'{page,cursor}' is not null then perform private.fail('VALIDATION_FAILED');end if;
 select * into d from core.disciplines where org_id=org and id=discipline;
 if not found then perform private.fail('NOT_FOUND');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type','disciplines','id',d.id) then perform private.fail('NOT_FOUND');end if;
 projection:=jsonb_build_object('discipline_id',d.id,'name',d.name,'state',d.state);
 if coalesce((r#>>'{selector,key,include_deactivation_effects}')::boolean,false) then projection:=projection||jsonb_build_object('deactivation_effects',private.discipline_deactivation_effects(org,d.id));end if;
 return jsonb_build_object('items',jsonb_build_array(jsonb_build_object('operation','discipline_save_v1','entity',jsonb_build_object('type','disciplines','id',d.id),'exists',true,'state',d.state,
 'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','disciplines','id',d.id),'version',d.version)),'as_of',at,'current',jsonb_build_object('operation','discipline_save_v1','values',projection))),'next_cursor',null,'as_of',at);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.discipline_presentation_access(text,jsonb,uuid)'::regprocedure);
 a:=' if not r?''presentation'' then return;end if;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discipline deactivation live gate drift';end if;
 execute replace(b,a,' perform private.discipline_deactivation_access(op,r,org);'||E'\n'||a);
 b:=pg_get_functiondef('private.starter_resource_page(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:='  return jsonb_build_object(''items'',jsonb_build_array(item),''next_cursor'',null,''as_of'',asof);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Center discipline effects reader drift';end if;
 execute replace(b,a,$a$  if coalesce((k->>'include_deactivation_effects')::boolean,false) then item:=jsonb_set(item,'{current,values}',item#>'{current,values}'||jsonb_build_object('deactivation_effects',private.discipline_deactivation_effects(org,(k->>'discipline_id')::uuid,center)));end if;
$a$||a);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Organization discipline effects reader drift';end if;
 execute replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation'='discipline_save_v1' then
  out:=private.discipline_management_page(r,org,person);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
end$patch$;
revoke all on function private.discipline_deactivation_effects(uuid,uuid,uuid),private.discipline_deactivation_access(text,jsonb,uuid),private.discipline_management_page(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function private.discipline_deactivation_effects(uuid,uuid,uuid),private.discipline_deactivation_access(text,jsonb,uuid),private.discipline_management_page(jsonb,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
