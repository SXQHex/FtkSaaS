-- XREQ-021: narrow read-only choices through the existing request management reader.
begin;
create function private.p01_request_catalog(r jsonb,org uuid,actor uuid,center uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare kind text:=r->>'catalog';lim int:=coalesce((r#>>'{page,limit}')::int,50);h text;cur jsonb;last_at timestamptz;last_id uuid;items jsonb;token text;v jsonb;
begin
 if r->>'operation'<>'lesson_request_create_v1' or kind not in ('disciplines','instructors') or kind is null then perform private.fail('VALIDATION_FAILED');end if;
 h:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page')::text);
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with choices as (
  select d.id,d.created_at,coalesce(d.version,1) version,d.name display_name,'disciplines'::text typ,'discipline_id'::text key from core.disciplines d
  where kind='disciplines' and d.org_id=org and d.state='active' and coalesce(private.starter_selected(org,'discipline',d.id),false) and exists(select 1 from core.center_disciplines c where c.org_id=org and c.center_id=center and c.discipline_id=d.id and c.state='active')
  union all
  select p.id,p.created_at,coalesce(p.version,1),p.display_name,'people','preferred_instructor_id' from core.people p
  where kind='instructors' and p.org_id=org and p.state='active' and coalesce(private.starter_selected(org,'instructor',p.id),false) and private.has_role(org,p.id,'instructor',center)
  and (private.current_plan_name(org)='starter' or exists(select 1 from core.center_relationships c where c.org_id=org and c.center_id=center and c.person_id=p.id and c.state='active'))
 ), page as(select * from choices where (last_id is null or (created_at,id)>(last_at,last_id)) order by created_at,id limit lim+1)
 select coalesce(jsonb_agg(jsonb_build_object('operation','lesson_request_create_v1','entity',jsonb_build_object('type',typ,'id',id),'exists',true,'state','active',
 'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',typ,'id',id),'version',version)),'as_of',clock_timestamp(),
 'current',jsonb_build_object('operation','lesson_request_create_v1','values',jsonb_build_object(key,id,'display_name',display_name))) order by created_at,id),'[]') into items from page;
 if jsonb_array_length(items)>lim then
  items:=items-(jsonb_array_length(items)-1);v:=items->(jsonb_array_length(items)-1);
  if kind='disciplines' then select created_at into last_at from core.disciplines where org_id=org and id=(v#>>'{entity,id}')::uuid;
  else select created_at into last_at from core.people where org_id=org and id=(v#>>'{entity,id}')::uuid;end if;
  token:=encode(convert_to(jsonb_build_object('scope',h,'at',last_at,'id',v#>>'{entity,id}')::text,'utf8'),'hex');
 end if;
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',clock_timestamp());
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p01_requests_page(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=$a$ h:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page')::text);$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Request catalog access anchor drift';end if;
 execute replace(b,a,$a$ if r ? 'catalog' then return private.p01_request_catalog(r,org,actor,center);end if;
$a$||a);
 b:=pg_get_functiondef('private.p01_request_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 a:=$a$not exists(select 1 from core.center_disciplines where org_id=org and center_id=center and discipline_id=(r->>'discipline_id')::uuid and state='active')$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Request discipline write anchor drift';end if;
 execute replace(b,a,$a$not exists(select 1 from core.center_disciplines c join core.disciplines d on d.org_id=c.org_id and d.id=c.discipline_id where c.org_id=org and c.center_id=center and c.discipline_id=(r->>'discipline_id')::uuid and c.state='active' and d.state='active')$a$);
end$patch$;
revoke all on function private.p01_request_catalog(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.p01_request_catalog(jsonb,uuid,uuid,uuid) to service_role;
commit;
