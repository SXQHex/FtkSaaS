begin;
create index document_acceptance_directory on core.document_acceptances(org_id,center_id,document_version_id,accepted_at,id);
create function private.document_directory_access(r jsonb,p_org uuid,p_center uuid,p_actor uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_center is null then perform private.fail('VALIDATION_FAILED');end if;perform private.assert_center(p_org,p_center);perform private.require_feature(p_org,'F30');
 if coalesce(r->>'scope','center')='organization' then perform private.p05_configuration(p_org,null,p_actor,'{"kind":"organization"}');
 elsif coalesce(r->>'scope','center')='center' then perform private.p05_configuration(p_org,p_center,p_actor,jsonb_build_object('kind','center','center_id',p_center));
 else perform private.fail('VALIDATION_FAILED');end if;
end$$;
create function private.document_management_requirements(p_org uuid,p_center uuid,p_actor uuid,p_account uuid,p_target uuid,ctx jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare r jsonb:=jsonb_build_object('person_id',p_target,'context',ctx);facts jsonb;
begin
 perform private.p05_access('document_requirements_get_v1',r,p_org,p_center,p_actor,p_account);
 facts:=private.p05_context(p_org,p_center,p_target,ctx);
 return private.p05_requirements(p_org,p_target,ctx,facts);
exception when sqlstate 'P0001' then
 if sqlerrm in ('NOT_FOUND','FORBIDDEN','PLAN_FEATURE_UNAVAILABLE','PLAN_LIMIT_REACHED') then return '[]'::jsonb;end if;raise;
end$$;
create function private.document_current_facts(p_org uuid,p_center uuid,p_actor uuid,p_account uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('key',encode(extensions.digest(c.person_id::text||c.row_key||q.n::text,'sha256'),'hex'),'kind','requirement',
 'person_id',c.person_id,'display_name',p.display_name,'context',c.context,'document_id',q.x->'id','required_version_id',q.x->'version_id','accepted',q.x->'accepted',
 'status',case when (q.x->>'accepted')::bool then 'valid' when a.id is not null then 'outdated' else 'missing' end,
 'evidence_id',a.id,'evidence_version_id',a.document_version_id,'evidence_at',a.accepted_at,
 'evidence_matches_version',a.document_version_id=(q.x->>'version_id')::uuid) order by c.created_at,c.row_key,c.person_id,q.n),'[]')
 from private.document_active_contexts(p_org,p_center,null) c join core.people p on p.org_id=p_org and p.id=c.person_id and p.state='active'
 cross join lateral jsonb_array_elements(private.document_management_requirements(p_org,p_center,p_actor,p_account,c.person_id,c.context)) with ordinality q(x,n)
 left join lateral (
  select a.* from core.document_acceptances a join core.document_versions v on v.org_id=a.org_id and v.id=a.document_version_id
  left join private.digital_document_acceptances d on d.org_id=a.org_id and d.acceptance_id=a.id
  where a.org_id=p_org and private.p07_same_person(p_org,a.person_id,c.person_id) and v.document_id=(q.x->>'id')::uuid and a.context->>'gate'=c.context->>'gate'
   and (not (c.context?'purchase_preview_id' and exists(select 1 from core.document_versions rv join private.digital_document_contents dc on dc.org_id=rv.org_id and dc.file_id=rv.file_id where rv.org_id=p_org and rv.id=(q.x->>'version_id')::uuid)) or a.context=c.context and a.document_version_id=(q.x->>'version_id')::uuid)
   and (not (q.x->>'accepted')::bool or d.rendered_document_id is null or private.rendered_document_valid(d.rendered_document_id))
  order by (a.document_version_id=(q.x->>'version_id')::uuid) desc,a.accepted_at desc,a.id desc limit 1
 ) a on true
$$;
-- Historical center is evidence or the real context source, never today's membership.
create function private.document_acceptance_center(a core.document_acceptances) returns uuid language plpgsql stable security invoker set search_path='' as $$
declare sid uuid;c uuid;
begin
 if a.center_id is not null then return a.center_id;end if;
 sid:=(a.context#>>'{subject,id}')::uuid;
 case a.context#>>'{subject,type}'
 when 'sales' then select center_id into c from core.sales where org_id=a.org_id and id=sid;
 when 'reservations' then select center_id into c from core.reservations where org_id=a.org_id and id=sid;
 when 'sessions' then select center_id into c from core.sessions where org_id=a.org_id and id=sid;
 when 'lesson_requests' then select center_id into c from core.lesson_requests where org_id=a.org_id and id=sid;
 when 'events' then select center_id into c from core.events where org_id=a.org_id and id=sid;
 when 'event_registrations' then select center_id into c from core.event_registrations where org_id=a.org_id and id=sid;
 when 'product_versions' then
  if a.context?'purchase_preview_id' then select center_id into c from private.purchase_documents where org_id=a.org_id and preview_id=(a.context->>'purchase_preview_id')::uuid;
  else select center_id into c from core.product_versions where org_id=a.org_id and id=sid;end if;
 else return null;end case;
 return c;
exception when invalid_text_representation then return null;
end$$;
create function private.document_version_metadata(v core.document_versions) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version_id',v.id,'version',v.version,'version_label',v.version_label,'published_at',v.created_at,'effective_at',v.effective_at,
 'requirements',coalesce((select jsonb_agg(jsonb_build_object('gate',q.operation,'scope',q.scope,'renewed_acceptance',q.renewed_acceptance) order by q.id) from core.document_requirements q where q.org_id=v.org_id and q.document_version_id=v.id),'[]'))
$$;
create function private.document_management_directory(r jsonb,p_org uuid,p_center uuid,p_actor uuid,p_account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare facts jsonb;docs jsonb;history jsonb;items jsonb;selected jsonb;summary jsonb;data jsonb;d core.documents;version_row core.document_versions;
 view_name text:=r->>'view';org_scope boolean:=coalesce(r->>'scope','center')='organization';can_history boolean:=true;
begin
 perform private.document_directory_access(r,p_org,p_center,p_actor);
 if view_name not in ('documents','versions','acceptances') then perform private.fail('VALIDATION_FAILED');end if;
 if view_name<>'documents' and r->>'document_id' is null then perform private.fail('VALIDATION_FAILED');end if;
 facts:=private.document_current_facts(p_org,p_center,p_actor,p_account);
 -- Center catalog includes applicable organization documents only through actual requirements.
 select coalesce(jsonb_agg(jsonb_build_object('key','document/'||x.id,'kind','document','document_id',x.id,'file_id',null,'name',x.name,'created_at',x.created_at,
  'expires_at',null,'state',case when x.state<>'active' then 'inactive' else 'published' end,'scope',case when x.scope_center_id is null then 'organization' else 'center' end,
  'read_only',x.scope_center_id is null and not private.is_org_reader(p_org,p_actor),
  'latest_version',private.document_version_metadata(v)||case when x.scope_center_id is null and not private.is_org_reader(p_org,p_actor) then jsonb_build_object('requirements',null) else '{}'::jsonb end,'version_count',case when x.scope_center_id is not null or private.is_org_reader(p_org,p_actor) then (select count(*) from core.document_versions z where z.org_id=p_org and z.document_id=x.id) end) order by x.created_at,x.id),'[]') into docs
 from core.documents x join lateral (
  select z.* from core.document_versions z where z.org_id=p_org and z.document_id=x.id
   and (x.scope_center_id is not null or private.is_org_reader(p_org,p_actor) or exists(select 1 from jsonb_array_elements(facts) f where f->>'required_version_id'=z.id::text))
  order by z.effective_at desc,z.created_at desc,z.id desc limit 1
 ) v on true where x.org_id=p_org and (
  org_scope and x.scope_center_id is null or not org_scope and (x.scope_center_id=p_center or x.scope_center_id is null and exists(select 1 from jsonb_array_elements(facts) f where f->>'document_id'=x.id::text)));
 select docs||coalesce(jsonb_agg(jsonb_build_object('key','file/'||f.id,'kind','unpublished_file','document_id',null,'file_id',f.id,'name',p.name,'created_at',f.created_at,
  'state',case when f.state='pending_upload' and f.expires_at<=statement_timestamp() then 'expired_upload' when f.state='ready' then 'ready_unpublished' else f.state end,
  'expires_at',f.expires_at,'scope',case when org_scope then 'organization' else 'center' end,'read_only',p.account_id<>p_account,'latest_version',null,'version_count',0) order by f.created_at,f.id),'[]') into docs
 from core.files f join private.p05_files p on p.file_id=f.id
 where f.org_id=p_org and f.purpose='document' and f.center_id is not distinct from case when org_scope then null else p_center end
 and not exists(select 1 from core.document_versions v where v.org_id=p_org and v.file_id=f.id);
 if r->>'document_id' is not null then
  select * into d from core.documents where org_id=p_org and id=(r->>'document_id')::uuid;
  if d.id is null or not exists(select 1 from jsonb_array_elements(docs) x where x->>'document_id'=d.id::text) then perform private.fail('NOT_FOUND');end if;
  can_history:=d.scope_center_id is not null or private.is_org_reader(p_org,p_actor);
  if view_name='versions' and not can_history then perform private.fail('FORBIDDEN');end if;
 end if;
 select coalesce(jsonb_agg(x),'[]') into docs from jsonb_array_elements(docs) x
 where (r->>'document_id' is null or x->>'document_id'=r->>'document_id') and (view_name<>'documents' or r->>'query' is null or x->>'name' ilike '%'||(r->>'query')||'%');
 select coalesce(jsonb_agg(x),'[]') into facts from jsonb_array_elements(facts) x where (r->>'version_id' is null or x->>'required_version_id'=r->>'version_id') and exists(select 1 from jsonb_array_elements(docs) z where z->>'document_id'=x->>'document_id')
 and (view_name<>'acceptances' or r->>'query' is null or x->>'display_name' ilike '%'||(r->>'query')||'%');
 select coalesce(jsonb_agg(jsonb_build_object('key','acceptance/'||a.id,'kind','history','acceptance_id',a.id,'document_id',v.document_id,'version_id',a.document_version_id,'version_label',v.version_label,
  'person_id',p.id,'display_name',p.display_name,'accepted_at',a.accepted_at,'context',a.context,'evidence_state',case when e.rendered_document_id is not null and not private.rendered_document_valid(e.rendered_document_id) then 'invalidated' else 'recorded' end,
  'evidence_kind',case when e.rendered_document_id is not null then 'server_document' when e.acceptance_id is not null then 'legacy_client' else 'file' end) order by a.accepted_at,a.id),'[]') into history
 from core.document_acceptances a join core.document_versions v on v.org_id=a.org_id and v.id=a.document_version_id
 join core.people p on p.org_id=a.org_id and p.id=private.p07_person_root(p_org,a.person_id)
 left join private.digital_document_acceptances e on e.org_id=a.org_id and e.acceptance_id=a.id
 where a.org_id=p_org and private.document_acceptance_center(a)=p_center and (r->>'version_id' is null or a.document_version_id=(r->>'version_id')::uuid)
 and exists(select 1 from jsonb_array_elements(docs) z where z->>'document_id'=v.document_id::text and not (z->>'read_only')::bool)
 and (view_name<>'acceptances' or r->>'query' is null or p.display_name ilike '%'||(r->>'query')||'%');
 -- All counts use unique people, not repeated contexts or immutable history rows.
 select jsonb_build_object('published_documents',(select count(*) from jsonb_array_elements(docs) x where x->>'kind'='document' and x->>'state'='published'),
 'unpublished_files',(select count(*) from jsonb_array_elements(docs) x where x->>'kind'='unpublished_file' and x->>'state' in ('pending_upload','ready_unpublished')),
 'pending_members',(select count(*) from (select x->>'person_id' from jsonb_array_elements(facts) x group by x->>'person_id' having not bool_and((x->>'accepted')::bool)) p),
 'total_members',(select count(distinct x->>'person_id') from jsonb_array_elements(facts) x),
 'last_publication',(select max((x#>>'{latest_version,published_at}')::timestamptz) from jsonb_array_elements(docs) x),
 'acceptance_records',jsonb_array_length(history)) into summary;
 if view_name='documents' then
  select coalesce(jsonb_agg(x||jsonb_build_object('required_members',(select count(distinct f->>'person_id') from jsonb_array_elements(facts) f where f->>'document_id'=x->>'document_id'),
   'pending_members',(select count(*) from (select f->>'person_id' from jsonb_array_elements(facts) f where f->>'document_id'=x->>'document_id' group by f->>'person_id' having not bool_and((f->>'accepted')::bool)) p),
   'acceptance_records',case when (x->>'read_only')::bool then null else (select count(*) from jsonb_array_elements(history) h where h->>'document_id'=x->>'document_id') end) order by x->>'created_at',x->>'key'),'[]') into items from jsonb_array_elements(docs) x
   where coalesce(r->>'acceptance_filter','all')='all' or exists(select 1 from jsonb_array_elements(facts) f where f->>'document_id'=x->>'document_id' and not (f->>'accepted')::bool);
 elsif view_name='versions' then
  select coalesce(jsonb_agg(private.document_version_metadata(v) order by v.created_at,v.id),'[]') into items from core.document_versions v
  where v.org_id=p_org and v.document_id=d.id and (r->>'version_id' is null or v.id=(r->>'version_id')::uuid);
 else
  select coalesce(jsonb_agg(x order by x->>'key'),'[]') into items from jsonb_array_elements(facts||case when coalesce(r->>'acceptance_filter','all')='all' then history else '[]'::jsonb end) x
   where (r->>'version_id' is null or coalesce(x->>'required_version_id',x->>'version_id')=r->>'version_id')
   and (coalesce(r->>'acceptance_filter','all')='all' or x->>'kind'='requirement' and not (x->>'accepted')::bool);
 end if;
 data:=private.p06_page(items,r->'page',encode(extensions.digest(jsonb_build_object('actor',p_actor,'account',p_account,'request',r-'page'-'request_id')::text,'sha256'),'hex'),statement_timestamp());
 return data||jsonb_build_object('view',view_name,'summary',summary,'history_available',can_history);
end$$;
do $patch$ declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:=' elsif perm_code=''invite.student'' then';begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Document directory permission drift';end if;
 b:=replace(b,a,$a$ elsif p_operation='document_directory_get_v1' then perform private.document_directory_access(r,org,center,person);
$a$||a);
 a:=' -- DOMAIN_CASES';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Document directory dispatch drift';end if;
 execute replace(b,a,$a$ when 'document_directory_get_v1' then out:=private.document_management_directory(r,org,center,person,actor.id);
$a$||a);
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('document_directory_get_v1','document.manage','read',array['F30']::text[]);
create function api_v1.document_directory_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('document_directory_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.document_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb),private.document_directory_access(jsonb,uuid,uuid,uuid),private.document_management_requirements(uuid,uuid,uuid,uuid,uuid,jsonb),private.document_current_facts(uuid,uuid,uuid,uuid),private.document_acceptance_center(core.document_acceptances),private.document_version_metadata(core.document_versions),private.document_management_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function api_v1.document_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb),private.document_directory_access(jsonb,uuid,uuid,uuid),private.document_management_requirements(uuid,uuid,uuid,uuid,uuid,jsonb),private.document_current_facts(uuid,uuid,uuid,uuid),private.document_acceptance_center(core.document_acceptances),private.document_version_metadata(core.document_versions),private.document_management_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;
commit;
