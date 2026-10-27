-- DS-2026-10-17: a newly published attendance document cannot withdraw an
-- already confirmed booking's obligation. Explicit approval is source-bound.
begin;
create table private.p05_document_protections(org_id uuid not null references core.organizations(id),document_version_id uuid not null,subject_type text not null check(subject_type in ('reservations','event_registrations')),subject_id uuid not null,person_id uuid not null,approved_by uuid not null references core.accounts(id),operation_id uuid not null,primary key(org_id,document_version_id,subject_type,subject_id),foreign key(org_id,document_version_id) references core.document_versions(org_id,id),foreign key(org_id,person_id) references core.people(org_id,id),foreign key(org_id,operation_id) references core.operation_receipts(org_id,id) deferrable initially deferred);
alter table private.p05_document_protections enable row level security;
revoke all on private.p05_document_protections from public,anon,authenticated;
grant all on private.p05_document_protections to service_role;
create function private.p05_scope_matches(scope jsonb,facts jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select (coalesce(jsonb_array_length(scope->'center_ids'),0)=0 or scope->'center_ids' ? (facts->>'center_id')) and (coalesce(jsonb_array_length(scope->'session_ids'),0)=0 or scope->'session_ids' ? (facts->>'session_id')) and (coalesce(jsonb_array_length(scope->'event_ids'),0)=0 or scope->'event_ids' ? (facts->>'event_id')) and (coalesce(jsonb_array_length(scope->'product_version_ids'),0)=0 or scope->'product_version_ids' ? (facts->>'product_version_id'))
$$;
create function private.p05_publication_affected(r jsonb,org uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with bookings as(
 select v.id,v.version,v.person_id,v.center_id,'reservations'::text typ,jsonb_build_object('center_id',v.center_id,'session_id',v.session_id,'product_version_id',(select s.product_version_id from core.entitlement_allocations a join core.sales s on s.org_id=a.org_id and s.id=a.sale_id where a.org_id=org and a.reservation_id=v.id and a.state in ('reserved','consumed') order by a.created_at desc,a.id desc limit 1)) facts from core.reservations v where v.org_id=org and v.state in ('active','completed')
 union all select v.id,v.version,v.person_id,v.center_id,'event_registrations',jsonb_build_object('center_id',v.center_id,'event_id',v.event_id,'product_version_id',(select s.product_version_id from core.entitlement_allocations a join core.sales s on s.org_id=a.org_id and s.id=a.sale_id where a.org_id=org and a.event_registration_id=v.id and a.state in ('reserved','consumed') order by a.created_at desc,a.id desc limit 1)) from core.event_registrations v where v.org_id=org and v.state in ('active','completed'))
 select coalesce(jsonb_agg(jsonb_build_object('subject',jsonb_build_object('type',b.typ,'id',b.id),'version',b.version,'person_id',b.person_id,'center_id',b.center_id) order by b.typ,b.id),'[]'::jsonb) from bookings b
 where (r#>>'{scope,kind}'='organization' or b.center_id=(r#>>'{scope,center_id}')::uuid)
 and exists(select 1 from jsonb_array_elements(r->'requirements') q where q->>'gate'='attendance' and private.p05_scope_matches(q->'scope',b.facts)
 and ((q->>'renewed_acceptance')::bool or not exists(select 1 from core.document_acceptances a join core.document_versions v on v.org_id=a.org_id and v.id=a.document_version_id where a.org_id=org and a.person_id=b.person_id and v.document_id=(r->>'document_id')::uuid and a.context->>'gate'='attendance')))
$$;
create function private.p05_publication_dependencies(r jsonb,org uuid,actor uuid,account uuid,affected jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('versions',coalesce((select jsonb_agg(x) from(
 select jsonb_build_object('entity',jsonb_build_object('type','files','id',f.id),'version',f.version) x from core.files f where f.org_id=org and f.id=(r->>'file_id')::uuid
 union all select jsonb_build_object('entity',jsonb_build_object('type','documents','id',d.id),'version',d.version) from core.documents d where d.org_id=org and d.id=(r->>'document_id')::uuid) v),'[]'::jsonb),
 'policy_hashes',jsonb_build_array(md5((r-'client_api_version'-'request_id'-'operation_key'-'impact_approval')::text),md5(affected::text)),
 'permission_hash',md5(jsonb_build_object('actor',account,'org',org,'roles',(select jsonb_agg(to_jsonb(x) order by x.id) from core.role_assignments x where x.org_id=org and x.person_id=actor),'links',(select jsonb_agg(to_jsonb(x) order by x.id) from core.account_links x where x.org_id=org and x.person_id=actor))::text))
$$;
create function private.p05_publication_preview(r jsonb,org uuid,actor uuid,account uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare affected jsonb:=private.p05_publication_affected(r,org);dep jsonb;result jsonb;pid uuid:=private.new_id(ids,2);token text:=aux->>'token';scope_hash text;
begin
 if token is null then perform private.fail('INTEGRITY_VIOLATION');end if;
 if not exists(select 1 from core.files where org_id=org and id=(r->>'file_id')::uuid and state='ready') then perform private.fail('VALIDATION_FAILED');end if;
 dep:=private.p05_publication_dependencies(r,org,actor,account,affected);scope_hash:=md5(jsonb_build_object('actor',account,'org',org,'request',r-'request_id')::text);
 result:=jsonb_build_object('id',pid,'token',token,'scope_hash',scope_hash,'dependencies',dep,'effects','[]'::jsonb,'blockers','[]'::jsonb,'expires_at',clock_timestamp()+interval '15 minutes');
 insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(pid,org,account,'document_version_publish_v1',scope_hash,dep,result-'token','current');
 insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(pid,jsonb_build_object('request',r,'affected',affected),(result->>'expires_at')::timestamptz,encode(extensions.digest(token,'sha256'),'hex'));
 return jsonb_build_object('data',jsonb_build_object('preview',result,'affected',affected,'preserves_reservations',true),'primary_id',pid,'subject','previews');
end$$;
create function private.p05_publication_check(r jsonb,org uuid,actor uuid,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare affected jsonb:=private.p05_publication_affected(r,org);p core.previews;data private.preview_payloads;ack jsonb;expected jsonb;
begin
 if r->'impact_approval' is null then if jsonb_array_length(affected)>0 then perform private.fail('PREVIEW_STALE');end if;return affected;end if;
 select * into p from core.previews where org_id=org and id=(r#>>'{impact_approval,preview,id}')::uuid for update;
 select * into data from private.preview_payloads where preview_id=p.id;
 if p.id is null or p.actor_account_id<>account or p.operation<>'document_version_publish_v1' or p.state<>'current' or data.expires_at<=clock_timestamp() or data.token_hash is distinct from encode(extensions.digest(r#>>'{impact_approval,preview,token}','sha256'),'hex')
 or private.p05_publication_dependencies(r,org,actor,account,affected) is distinct from p.dependencies then perform private.fail('PREVIEW_STALE');end if;
 select coalesce(jsonb_agg(x->'subject' order by x#>>'{subject,type}',x#>>'{subject,id}'),'[]'::jsonb) into expected from jsonb_array_elements(affected) x;
 select coalesce(jsonb_agg(x order by x->>'type',x->>'id'),'[]'::jsonb) into ack from jsonb_array_elements(r#>'{impact_approval,accepted_subjects}') x;
 if ack is distinct from expected then perform private.fail('VALIDATION_FAILED');end if;
 update core.previews set state='applied',version=version+1 where id=p.id;return affected;
end$$;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.p05_assert_documents(uuid,uuid,uuid,jsonb)'::regprocedure);
 old:=$a$if exists(select 1 from jsonb_array_elements(private.p05_requirements(org,target,ctx,private.p05_context(org,center,target,ctx))) x where not (x->>'accepted')::boolean)$a$;if strpos(b,old)=0 then raise exception 'P05 protected gate anchor missing';end if;b:=replace(b,old,$a$if exists(select 1 from jsonb_array_elements(private.p05_requirements(org,target,ctx,private.p05_context(org,center,target,ctx))) x where not (x->>'accepted')::boolean and not (ctx->>'gate'='attendance' and exists(select 1 from private.p05_document_protections p where p.org_id=org and p.document_version_id=(x->>'version_id')::uuid and p.person_id=target and p.subject_type=ctx#>>'{subject,type}' and p.subject_id=(ctx#>>'{subject,id}')::uuid)))$a$);execute b;
 b:=pg_get_functiondef('private.p05_documents(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:=$a$data jsonb;ver bigint:=1;$a$;if strpos(b,old)=0 then raise exception 'P05 document protection declaration anchor missing';end if;b:=replace(b,old,old||'protection jsonb;');
 old:=$a$ if op='document_upload_prepare_v1' then$a$;if strpos(b,old)=0 then raise exception 'P05 document preview anchor missing';end if;b:=replace(b,old,$a$ if op='document_publication_preview_v1' then return private.p05_publication_preview(r,org,actor,account,ids,aux);end if;
$a$||old);
 old:=$a$  did:=(r->>'document_id')::uuid;$a$;if strpos(b,old)=0 then raise exception 'P05 publication protection check anchor missing';end if;b:=replace(b,old,'  protection:=private.p05_publication_check(r,org,actor,account);'||old);
 old:=$a$  subject:='document_versions';data:=$a$;if strpos(b,old)=0 then raise exception 'P05 publication protection store anchor missing';end if;b:=replace(b,old,$a$  insert into private.p05_document_protections(org_id,document_version_id,subject_type,subject_id,person_id,approved_by,operation_id) select org,vid,x#>>'{subject,type}',(x#>>'{subject,id}')::uuid,(x->>'person_id')::uuid,account,operation from jsonb_array_elements(protection) x;
$a$||old);execute b;
end$patch$;
commit;
