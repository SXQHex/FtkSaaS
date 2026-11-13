begin;
create function private.content_catalog_access(r jsonb,org uuid,center uuid,person uuid,platform boolean) returns void language plpgsql set search_path='' as $$
declare sk text:=r->>'scope_key';
begin
 if sk='platform' then
  if org is not null or center is not null or not platform then perform private.fail('FORBIDDEN');end if;
 elsif org is not null and sk=(case when center is null then 'organization:'||org else 'center:'||org||':'||center end) then
  if r->>'channel'<>'document' or r->>'code' not like 'document.%' and r->>'code'<>'instructor.agreement' then perform private.fail('FORBIDDEN');end if;
  perform private.p05_configuration(org,center,person,case when center is null then '{"kind":"organization"}'::jsonb else jsonb_build_object('kind','center','center_id',center) end);
  perform private.require_feature(org,case when r->>'code'='instructor.agreement' then 'F20' else 'F30' end);
 else perform private.fail('FORBIDDEN');end if;
end$$;
create function private.content_catalog_execute(op text,r jsonb,ids uuid[]) returns jsonb language plpgsql set search_path='' as $$
declare t private.content_templates;data jsonb;
begin
 if op='content_catalog_save_v1' then
  t:=private.content_store(r,private.new_id(ids,2));
  data:=jsonb_build_object('operation_id',private.new_id(ids,3),'primary_id',t.id,'version',t.revision,'replayed',false,'related','[]'::jsonb);
 else
  select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('retired',exists(select 1 from private.content_retirements x where x.template_id=c.id)) order by c.language,c.version),'[]'::jsonb)) into data
  from private.content_templates c where c.scope_key=r->>'scope_key' and c.code=r->>'code' and c.channel=r->>'channel';
 end if;
 return jsonb_build_object('data',data,'primary_id',t.id,'subject','content_templates','version',t.revision);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' -- Central permission mapping;';if strpos(b,a)=0 then raise exception 'Catalog access anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation in ('content_catalog_get_v1','content_catalog_save_v1') then perform private.content_catalog_access(r,org,center,person,platform);end if;
$a$||a);
 -- Existing permission implementation has an earlier digital agreement branch.
 a:='elsif perm_code=''preparation.resolve'' then null;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog permission anchor drift';end if;
 b:=replace(b,a,'elsif p_operation in (''content_catalog_get_v1'',''content_catalog_save_v1'') then null;'||a);
 a:=' -- DOMAIN_CASES';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog domain anchor drift';end if;
 execute replace(b,a,$a$ when 'content_catalog_get_v1','content_catalog_save_v1' then
  terms:=private.content_catalog_execute(p_operation,r,p_ids);out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';version_n:=(terms->>'version')::bigint;
$a$||a);
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('content_catalog_get_v1','document.manage','read',array[]::text[]);
insert into private.runtime_operations(name,permission,billing_class,features) values('content_catalog_save_v1','document.manage','config',array[]::text[]);
create function api_v1.content_catalog_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('content_catalog_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
create function api_v1.content_catalog_save_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('content_catalog_save_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function private.content_catalog_access(jsonb,uuid,uuid,uuid,boolean),private.content_catalog_execute(text,jsonb,uuid[]),api_v1.content_catalog_get_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.content_catalog_save_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.content_catalog_access(jsonb,uuid,uuid,uuid,boolean),private.content_catalog_execute(text,jsonb,uuid[]),api_v1.content_catalog_get_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.content_catalog_save_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
