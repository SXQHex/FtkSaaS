begin;
create function private.import_row_discovery(row_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('display_name',case when jsonb_typeof(r.payload->'display_name')='string' then left(r.payload->>'display_name',500) end,
 'contacts',coalesce((select jsonb_agg(jsonb_build_object('kind',x->>'kind','value',left(x->>'value',320)) order by n)
 from jsonb_array_elements(case when jsonb_typeof(r.payload->'contacts')='array' then r.payload->'contacts' else '[]'::jsonb end) with ordinality t(x,n)
 where n<=20 and x->>'kind' in ('phone','email') and jsonb_typeof(x->'value')='string'),'[]'),
 'warnings',to_jsonb(array_remove(array[
 case when exists(select 1 from core.import_rows d where d.org_id=r.org_id and d.job_id=r.job_id and d.id<>r.id and d.source_key=r.source_key) then 'duplicate_source_key' end,
 case when exists(select 1 from private.p06_sources s where s.org_id=r.org_id and s.source_namespace=r.source_namespace and s.source_key=r.source_key) then 'source_already_applied' end],null)))
 from core.import_rows r where r.id=row_id
$$;
create function private.import_rows_discovery(rows jsonb,r jsonb,job uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x||case when coalesce((r->>'include_details')::bool,false) then jsonb_build_object('student_preview',private.import_row_discovery(source.id)) else '{}'::jsonb end order by (x->>'row_number')::bigint),'[]')
 from jsonb_array_elements(rows) x join core.import_rows source on source.job_id=job and source.row_number=(x->>'row_number')::bigint
 where (r->>'state' is null or x->>'state'=r->>'state')
 and (r->>'query' is null or source.source_key ilike '%'||(r->>'query')||'%' or source.payload->>'display_name' ilike '%'||(r->>'query')||'%')
$$;
create function private.import_discovery_job_allowed(r jsonb,p_org uuid,p_center uuid,p_actor uuid,p_account uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform private.p06_access('job_status_get_v1',r,p_org,p_center,p_actor,p_account);return true;
exception when sqlstate 'P0001' then
 if sqlerrm in ('FORBIDDEN','NOT_FOUND','PLAN_FEATURE_UNAVAILABLE','BILLING_OPERATION_RESTRICTED','SERVICE_UNAVAILABLE') then return false;end if;raise;
end$$;
create function private.import_directory(r jsonb,p_org uuid,p_center uuid,p_actor uuid,p_account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg private.p06_configuration;items jsonb;data jsonb;
begin
 perform private.p06_import_access(p_org,p_center,p_actor,false);
 select * into cfg from private.p06_configuration where org_id=p_org;
 select coalesce(jsonb_agg(jsonb_build_object('job_id',j.id,'created_at',j.created_at,'state',j.state,'phase',c.phase,'progress_count',c.progress_count,'total_count',c.total_count,
 'preview_id',j.preview_id,'safe_error_code',c.safe_error_code,'kind',coalesce(j.mapping->>'kind','students')) order by j.created_at,j.id),'[]') into items
 from core.import_jobs j join private.p06_jobs c on c.job_id=j.id and c.org_id=j.org_id
 where j.org_id=p_org and j.center_id=p_center and j.requester_account_id=p_account and c.account_id=p_account
 and (r->>'state' is null or j.state=r->>'state')
 and private.import_discovery_job_allowed(jsonb_build_object('job_id',j.id),p_org,p_center,p_actor,p_account);
 data:=private.p06_page(items,r->'page',encode(extensions.digest(jsonb_build_object('account',p_account,'actor',p_actor,'request',r-'request_id'-'page')::text,'sha256'),'hex'),statement_timestamp());
 return data||jsonb_build_object('limits',case when cfg.org_id is not null then jsonb_build_object('max_bytes',cfg.max_import_bytes,'max_rows',cfg.max_import_rows) end);
end$$;
do $patch$ declare b text;a text;begin
 b:=pg_get_functiondef('private.p06_import(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='data:=private.p06_page(rows,r->''page''';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Import row discovery drift';end if;
 execute replace(b,a,'rows:=private.import_rows_discovery(rows,r,j.id);'||a);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a:=' elsif perm_code=''invite.student'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Import directory permission drift';end if;
 b:=replace(b,a,$a$ elsif p_operation='import_directory_get_v1' then perform private.p06_import_access(org,center,person,false);
$a$||a);
 a:=' -- DOMAIN_CASES';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Import directory dispatch drift';end if;
 execute replace(b,a,$a$ when 'import_directory_get_v1' then out:=private.import_directory(r,org,center,person,actor.id);
$a$||a);
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('import_directory_get_v1','import.execute','read',array['F31']::text[]);
create function api_v1.import_directory_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('import_directory_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.import_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb),private.import_row_discovery(uuid),private.import_rows_discovery(jsonb,jsonb,uuid),private.import_discovery_job_allowed(jsonb,uuid,uuid,uuid,uuid),private.import_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function api_v1.import_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb),private.import_row_discovery(uuid),private.import_rows_discovery(jsonb,jsonb,uuid),private.import_discovery_job_allowed(jsonb,uuid,uuid,uuid,uuid),private.import_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;
commit;
