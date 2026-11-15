begin;
-- Fixed-group membership is the accepted priority-reservation model. No new
-- permanent membership, automatic sale choice, or future-booking worker exists.
create function private.class_student_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';cls core.classes;items jsonb;result jsonb;at timestamptz:=clock_timestamp();lo timestamptz:=(k#>>'{interval,starts_at}')::timestamptz;hi timestamptz:=(k#>>'{interval,ends_at}')::timestamptz;feature text;
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if lo is null or hi is null or not isfinite(lo) or not isfinite(hi) or lo>=hi or hi-lo>interval '366 days' then perform private.fail('VALIDATION_FAILED');end if;
 select c.* into cls from core.classes c where c.org_id=org and c.center_id=center and c.id=(k->>'class_id')::uuid;
 if cls.id is null then perform private.fail('NOT_FOUND');end if;
 perform private.require_feature(org,'F10');
 for feature in select unnest(o.features) from private.runtime_operations o where o.name='reservation_list_v1' loop perform private.require_feature(org,feature);end loop;
 perform private.starter_request_guard('reservation_list_v1',jsonb_build_object('center_id',center,'class_id',cls.id,'discipline_id',cls.discipline_id),org);
 if k->>'program_id' is not null and not exists(select 1 from core.program_versions p where p.org_id=org and p.center_id=center and p.class_id=cls.id and p.id=(k->>'program_id')::uuid) then perform private.fail('NOT_FOUND');end if;
 with selected as materialized(
  select v.*,s.starts_at,s.ends_at,private.p07_person_root(org,v.person_id) root from core.reservations v
  join core.sessions s on s.org_id=v.org_id and s.center_id=v.center_id and s.id=v.session_id
  where v.org_id=org and v.center_id=center and s.class_id=cls.id and v.mode='priority'
   and (k->>'program_id' is null or s.program_id=(k->>'program_id')::uuid)
   and s.starts_at<hi and s.ends_at>lo and private.member_summary_enabled(org,array['reservation_list_v1','session_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'session_id',s.id,'person_id',private.p07_person_root(org,v.person_id))) and (coalesce(k->>'status','active')='all' or v.state=coalesce(k->>'status','active'))
 ), grouped as(
  select p.id,p.version,p.state,p.created_at,private.directory_person_name(org,center,actor,p.id) display_name,
   jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'session_id',v.session_id,'starts_at',v.starts_at,'ends_at',v.ends_at,
    'source_sale_id',v.source_sale_id,'mode',v.mode,'state',v.state) order by v.starts_at,v.id) reservations,
   jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','reservations','id',v.id),'version',v.version) order by v.starts_at,v.id) versions
  from selected v join core.people p on p.org_id=org and p.id=v.root group by p.id,p.version,p.state,p.created_at
 ) select coalesce(jsonb_agg(jsonb_build_object('operation','reservation_cancel_v1','entity',jsonb_build_object('type','people','id',p.id),'exists',true,'state',p.state,
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',p.id),'version',p.version))||p.versions,
  'current',null,'group_student',jsonb_build_object('person_id',p.id,'display_name',p.display_name,'reservations',p.reservations)) order by p.created_at,p.id),'[]')
 into items from grouped p where p.display_name is not null and (k->>'query' is null or strpos(lower(p.display_name),lower(k->>'query'))>0)
  and (r->'entity' is null or r->'entity'='null'::jsonb or r->'entity'=jsonb_build_object('type','people','id',p.id));
 result:=private.p06_page(items,r->'page',md5(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page')::text),at);
 select coalesce(jsonb_agg(x||jsonb_build_object('as_of',at) order by n),'[]') into items from jsonb_array_elements(result->'items') with ordinality a(x,n);
 return jsonb_set(result,'{items}',items);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Class student dispatch anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation'='reservation_cancel_v1' and r#>>'{selector,key,directory}'='class' then
  out:=private.class_student_directory(r,org,center,person,actor.id);
  return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
end$patch$;
revoke all on function private.class_student_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.class_student_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;
commit;
