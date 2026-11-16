begin;
create function private.session_management_page(r jsonb,org uuid,center uuid,account uuid,auth_id uuid,session_id uuid,ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';source core.sessions;x core.sessions;probe jsonb;vals jsonb;items jsonb:='[]';at timestamptz:=clock_timestamp();
begin
 if center is null or op not in ('session_change_preview_v1','replacement_session_create_v1') or r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;
 select s.* into source from core.sessions s where s.org_id=org and s.center_id=center and s.id=coalesce((k->>'session_id')::uuid,(k->>'replaces_id')::uuid);
 if source.id is null then perform private.fail('NOT_FOUND');end if;
 if op='session_change_preview_v1' and coalesce(k->>'scope','') not in ('single','this_and_future') then perform private.fail('VALIDATION_FAILED');end if;
 probe:=jsonb_build_object('client_api_version',1,'request_id',r->'request_id','org_id',org,'center_id',center)||k;
 if op='replacement_session_create_v1' then probe:=probe||jsonb_build_object('capacity',jsonb_build_object('total',source.nominal));end if;
 perform private.p06_original_authorize(op,probe,auth_id,session_id,ids);
 for x in select s.* from core.sessions s where s.org_id=org and s.center_id=center and (
  (op='replacement_session_create_v1' and s.replaces_id=source.id)
  or (op='session_change_preview_v1' and (s.id=source.id or (k->>'scope'='this_and_future' and source.program_id is not null and s.program_id=source.program_id and s.starts_at>=source.starts_at)))) order by s.created_at,s.id loop
  if r->'entity' is not null and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type','sessions','id',x.id) then continue;end if;
  vals:=jsonb_build_object('interval',jsonb_build_object('starts_at',x.starts_at,'ends_at',x.ends_at),
   'capacity',jsonb_build_object('total',x.nominal)||case when x.category_capacities is not null then jsonb_build_object('categories',x.category_capacities) else '{}'::jsonb end,
   'resources',coalesce((select jsonb_agg(jsonb_build_object('kind',b.resource_kind,'id',b.resource_id) order by b.resource_kind,b.resource_id) from core.resource_bookings b where b.org_id=org and b.center_id=center and b.session_id=x.id and b.state='active'),'[]'::jsonb));
  vals:=case when op='session_change_preview_v1' then jsonb_build_object('session_id',x.id,'scope',k->'scope','patch',vals)
   else vals||jsonb_build_object('replaces_id',x.replaces_id) end;
  items:=items||jsonb_build_array(jsonb_build_object('operation',op,'entity',jsonb_build_object('type','sessions','id',x.id),'exists',true,'state',x.state,
   'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sessions','id',x.id),'version',x.version)),
   'current',jsonb_build_object('operation',op,'values',vals)));
 end loop;
 probe:=private.p06_page(items,r->'page',md5(jsonb_build_object('account',account,'request',r-'request_id'-'page')::text),at);
 select coalesce(jsonb_agg(x||jsonb_build_object('as_of',at) order by n),'[]') into items from jsonb_array_elements(probe->'items') with ordinality a(x,n);
 return jsonb_set(probe,'{items}',items);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Session management dispatch anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation' in ('session_change_preview_v1','replacement_session_create_v1') then
  out:=private.session_management_page(r,org,center,actor.id,p_actor_auth_id,p_session_id,p_ids);
  return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
end$patch$;
revoke all on function private.session_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.session_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]) to service_role;
commit;
