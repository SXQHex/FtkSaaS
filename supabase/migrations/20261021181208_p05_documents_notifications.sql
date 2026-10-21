-- P05 private files and append-only acceptance evidence. No client Storage grants.
begin;
insert into storage.buckets(id,name,public) values('ftksaas-documents','ftksaas-documents',false) on conflict(id) do nothing;
do $$begin if exists(select 1 from storage.buckets where id='ftksaas-documents' and public) then raise exception 'Document bucket must be private';end if;end$$;
update storage.buckets set file_size_limit=least(coalesce(file_size_limit,2097152),2097152),allowed_mime_types=case when allowed_mime_types is null then array['text/plain','application/pdf'] else array(select m from unnest(allowed_mime_types) m where m in ('text/plain','application/pdf')) end where id='ftksaas-documents';
create table private.p05_upload_configuration(org_id uuid primary key references core.organizations(id),max_bytes bigint not null check(max_bytes between 1 and 2097152),allowed_mime text[] not null check(cardinality(allowed_mime)>0));
create table private.p05_files(file_id uuid primary key references core.files(id),account_id uuid not null references core.accounts(id),name text not null);
alter table private.p05_upload_configuration enable row level security;
alter table private.p05_files enable row level security;
revoke all on private.p05_upload_configuration,private.p05_files from public,anon,authenticated;
grant all on private.p05_upload_configuration,private.p05_files to service_role;
create unique index p05_document_label on core.document_versions(org_id,document_id,version_label);
create unique index p05_acceptance on core.document_acceptances(org_id,person_id,document_version_id,(context::text));

create function private.p05_configuration(org uuid,center uuid,actor uuid,scope jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare c uuid;
begin
 if scope->>'kind'='organization' then
  if scope->>'center_id' is not null or center is not null then perform private.fail('VALIDATION_FAILED');end if;
  if not private.is_org_reader(org,actor) then perform private.fail('FORBIDDEN');end if;
 elsif scope->>'kind'='center' then
  c:=(scope->>'center_id')::uuid;
  if c is null or (center is not null and center<>c) then perform private.fail('VALIDATION_FAILED');end if;
  perform private.assert_center(org,c);
  if not private.is_manager(org,actor,c) then perform private.fail('FORBIDDEN');end if;
 else perform private.fail('VALIDATION_FAILED');end if;
 return c;
end$$;
create function private.p05_context(org uuid,center uuid,target uuid,ctx jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare typ text:=ctx#>>'{subject,type}';sid uuid:=(ctx#>>'{subject,id}')::uuid;c uuid;s uuid;e uuid;pv uuid;p uuid;
begin
 if typ='lesson_requests' and ctx->>'gate'='reservation' then select center_id,person_id into c,p from core.lesson_requests where org_id=org and id=sid;
 elsif typ='sessions' and ctx->>'gate' in ('reservation','attendance') then select center_id,id into c,s from core.sessions where org_id=org and id=sid;
 elsif typ='reservations' and ctx->>'gate' in ('reservation','attendance') then select center_id,session_id,person_id into c,s,p from core.reservations where org_id=org and id=sid;
 elsif typ='events' and ctx->>'gate' in ('event_registration','attendance') then select center_id,id into c,e from core.events where org_id=org and id=sid;
 elsif typ='event_registrations' and ctx->>'gate' in ('event_registration','attendance') then select center_id,event_id,person_id into c,e,p from core.event_registrations where org_id=org and id=sid;
 elsif typ='product_versions' and ctx->>'gate'='sale' then select coalesce(v.center_id,center),v.id into c,pv from core.product_versions v where v.org_id=org and v.id=sid;
 elsif typ='sales' and ctx->>'gate'='sale' then select center_id,product_version_id,person_id into c,pv,p from core.sales where org_id=org and id=sid;
 else perform private.fail('VALIDATION_FAILED');end if;
 if c is null or (center is not null and c<>center) or (p is not null and p<>target) then perform private.fail('NOT_FOUND');end if;
 perform private.assert_center(org,c);
 if not exists(select 1 from core.people where org_id=org and id=target and state='active') then perform private.fail('NOT_FOUND');end if;
 if s is not null then
  select sa.product_version_id into pv from core.entitlement_allocations a join core.sales sa on sa.org_id=a.org_id and sa.id=a.sale_id
  join core.reservations r on r.org_id=a.org_id and r.id=a.reservation_id where a.org_id=org and r.session_id=s and r.person_id=target and a.state in ('reserved','consumed') order by a.created_at desc,a.id desc limit 1;
 end if;
 if e is not null then
  select sa.product_version_id into pv from core.event_registrations r join core.entitlement_allocations a on a.org_id=r.org_id and a.event_registration_id=r.id and a.state in ('reserved','consumed') join core.sales sa on sa.org_id=a.org_id and sa.id=a.sale_id where r.org_id=org and r.event_id=e and r.person_id=target order by r.created_at desc,r.id desc limit 1;
 end if;
 if ctx->>'product_version_id' is not null then
  if pv is not null and pv<>(ctx->>'product_version_id')::uuid then perform private.fail('NOT_FOUND');end if;
  pv:=(ctx->>'product_version_id')::uuid;
  if not exists(select 1 from core.product_versions where org_id=org and id=pv) or (s is not null and not private.lesson_scope_matches(org,s,pv)) or (e is not null and not private.event_package_scope_matches(org,e,pv)) then perform private.fail('NOT_FOUND');end if;
 end if;
 return jsonb_build_object('center_id',c,'session_id',s,'event_id',e,'product_version_id',pv);
end$$;
create function private.p05_requirements(org uuid,target uuid,ctx jsonb,context_data jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 with latest as(select distinct on(v.document_id) v.* from core.document_versions v where v.org_id=org and v.effective_at<=clock_timestamp() order by v.document_id,v.effective_at desc,v.created_at desc,v.id desc)
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'version_id',v.id,'name',d.name,'content_hash',v.content_hash,'required_at',r.operation,
 'accepted',exists(select 1 from core.document_acceptances a join core.document_versions av on av.org_id=a.org_id and av.id=a.document_version_id where a.org_id=org and a.person_id=target and a.context->>'gate'=r.operation
  and (a.document_version_id=v.id or (not r.renewed_acceptance and av.document_id=v.document_id))),
 'file',jsonb_build_object('type','files','id',v.file_id)) order by d.created_at,d.id,r.id),'[]'::jsonb)
 from latest v join core.documents d on d.org_id=v.org_id and d.id=v.document_id join core.document_requirements r on r.org_id=v.org_id and r.document_version_id=v.id
 join core.files f on f.org_id=v.org_id and f.id=v.file_id and f.state='ready'
 where d.state='active' and r.operation=ctx->>'gate' and (d.scope_center_id is null or d.scope_center_id=(context_data->>'center_id')::uuid)
 and (coalesce(jsonb_array_length(r.scope->'center_ids'),0)=0 or r.scope->'center_ids' ? (context_data->>'center_id'))
 and (coalesce(jsonb_array_length(r.scope->'session_ids'),0)=0 or r.scope->'session_ids' ? (context_data->>'session_id'))
 and (coalesce(jsonb_array_length(r.scope->'event_ids'),0)=0 or r.scope->'event_ids' ? (context_data->>'event_id'))
 and (coalesce(jsonb_array_length(r.scope->'product_version_ids'),0)=0 or r.scope->'product_version_ids' ? (context_data->>'product_version_id'))
$$;
create function private.p05_assert_documents(org uuid,center uuid,target uuid,ctx jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 -- An absent requirement must not add new person/center lifecycle checks to
 -- unrelated historical fixtures or to an organization without documents.
 if not exists(select 1 from core.documents d join lateral(select v.id from core.document_versions v where v.org_id=d.org_id and v.document_id=d.id and v.effective_at<=clock_timestamp() order by v.effective_at desc,v.created_at desc,v.id desc limit 1) v on true
 join core.document_requirements r on r.org_id=d.org_id and r.document_version_id=v.id where d.org_id=org and d.state='active' and r.operation=ctx->>'gate' and (d.scope_center_id is null or d.scope_center_id=center) and (coalesce(jsonb_array_length(r.scope->'center_ids'),0)=0 or r.scope->'center_ids' ? center::text)) then return;end if;
 if exists(select 1 from jsonb_array_elements(private.p05_requirements(org,target,ctx,private.p05_context(org,center,target,ctx))) x where not (x->>'accepted')::boolean) then perform private.fail('DOCUMENT_REQUIRED');end if;
end$$;
create or replace function private.p01_request_documents(org uuid,reservation uuid) returns void language plpgsql security invoker set search_path='' as $$
declare r core.reservations;
begin
 select * into r from core.reservations where org_id=org and id=reservation;
 if not found then perform private.fail('NOT_FOUND');end if;
 perform private.p05_assert_documents(org,r.center_id,r.person_id,jsonb_build_object('gate','reservation','subject',jsonb_build_object('type','reservations','id',reservation)));
end$$;

create function private.p05_file_access(org uuid,center uuid,actor uuid,account uuid,fid uuid) returns core.files language plpgsql stable security invoker set search_path='' as $$
declare f core.files;
begin
 select x.* into f from core.files x join private.p05_files p on p.file_id=x.id where x.org_id=org and x.id=fid and p.account_id=account and x.owner_person_id=actor;
 if f.id is null or (center is not null and f.center_id is distinct from center) then perform private.fail('NOT_FOUND');end if;
 if f.center_id is null then if not private.is_org_reader(org,actor) then perform private.fail('FORBIDDEN');end if;
 else perform private.assert_center(org,f.center_id);if not private.is_manager(org,actor,f.center_id) then perform private.fail('FORBIDDEN');end if;end if;
 if f.purpose<>'document' then perform private.fail('NOT_FOUND');end if;
 perform private.require_feature(org,'F30');return f;
end$$;
create function private.p05_access(op text,r jsonb,org uuid,center uuid,actor uuid,account uuid) returns void language plpgsql security invoker set search_path='' as $$
declare c uuid;f core.files;ctx jsonb;target uuid;
begin
 if op='document_accept_v1' and r->>'operation'='document_accept_v1' and not(r?'context') then
  perform private.require_feature(org,'F30');
  if not exists(select 1 from core.document_acceptances where org_id=org and person_id=actor and document_version_id=(r->>'document_version_id')::uuid) then perform private.fail('NOT_FOUND');end if;return;
 end if;
 if op='document_upload_prepare_v1' then c:=private.p05_configuration(org,center,actor,case when center is null then '{"kind":"organization"}'::jsonb else jsonb_build_object('kind','center','center_id',center) end);perform private.require_feature(org,'F30');
 elsif op in ('document_version_publish_v1','document_publication_preview_v1') then
  c:=private.p05_configuration(org,center,actor,r->'scope');perform private.require_feature(org,'F30');
  f:=private.p05_file_access(org,c,actor,account,(r->>'file_id')::uuid);
  if f.center_id is distinct from c then perform private.fail('NOT_FOUND');end if;
  if r->>'document_id' is not null and not exists(select 1 from core.documents where org_id=org and id=(r->>'document_id')::uuid and scope_center_id is not distinct from c and state='active') then perform private.fail('NOT_FOUND');end if;
 elsif op='file_upload_complete_v1' then f:=private.p05_file_access(org,center,actor,account,(r->>'file_id')::uuid);
 elsif op in ('document_requirements_get_v1','document_accept_v1') then
  target:=case when op='document_requirements_get_v1' then (r->>'person_id')::uuid else actor end;
  if r#>>'{context,on_behalf_of_person_id}' is not null then perform private.fail('FORBIDDEN');end if;
  ctx:=private.p05_context(org,center,target,r->'context');c:=(ctx->>'center_id')::uuid;
  if actor<>target and not coalesce(private.person_operational_access(org,actor,c,target),false) and not private.is_org_reader(org,actor) then perform private.fail('FORBIDDEN');end if;
  if actor=target and not exists(select 1 from core.center_relationships where org_id=org and center_id=c and person_id=actor and state='active') and not private.is_manager(org,actor,c) then perform private.fail('FORBIDDEN');end if;
 elsif op='notification_mark_read_v1' then
  if not exists(select 1 from core.notifications where org_id=org and id=(r->>'notification_id')::uuid and recipient_person_id=actor) then perform private.fail('NOT_FOUND');end if;perform private.require_feature(org,'F26');
 elsif op in ('notification_preferences_set_v1','notifications_list_v1') then perform private.require_feature(org,'F26');
  if r->>'channel'='email' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 elsif op in ('segment_save_v1','automation_save_v1') then
  c:=private.p05_configuration(org,center,actor,r->'scope');perform private.require_feature(org,'F24');
 else perform private.fail('FORBIDDEN');end if;
end$$;

create function private.p05_documents(op text,r jsonb,org uuid,center uuid,actor uuid,account uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare f core.files;cfg private.p05_upload_configuration;fid uuid:=private.new_id(ids,2);did uuid;vid uuid;idx int:=30;c uuid;req jsonb;kv text;entry jsonb;requirements jsonb;ctx jsonb;subject text:='files';data jsonb;ver bigint:=1;
begin
 if op='document_upload_prepare_v1' then
  select * into cfg from private.p05_upload_configuration where org_id=org;
  if not found then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  if (r->>'bytes')::bigint<1 or (r->>'bytes')::bigint>cfg.max_bytes or r->>'mime' not in ('application/pdf','text/plain') or not(r->>'mime'=any(cfg.allowed_mime)) or length(btrim(r->>'name'))=0 then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.files(id,org_id,center_id,owner_person_id,object_key,mime,size_bytes,purpose,state,expires_at) values(fid,org,center,actor,org::text||'/'||fid::text,r->>'mime',(r->>'bytes')::bigint,'document','pending_upload',clock_timestamp()+interval '2 hours') returning * into f;
  insert into private.p05_files values(fid,account,r->>'name');
  data:=jsonb_build_object('file_id',fid,'upload_url',f.object_key,'expires_at',f.expires_at,'allowed_mime',array[f.mime],'max_bytes',f.size_bytes);
 elsif op='file_upload_complete_v1' then
  f:=private.p05_file_access(org,center,actor,account,(r->>'file_id')::uuid);fid:=f.id;
  if f.state<>'pending_upload' or f.expires_at<=clock_timestamp() then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if aux->>'storage_verified' is distinct from 'true' or aux->>'object_key' is distinct from f.object_key or (aux->>'bytes')::bigint is distinct from f.size_bytes or aux->>'mime' is distinct from f.mime or aux->>'checksum' is distinct from lower(r->>'checksum') or lower(r->>'checksum') !~ '^[a-f0-9]{64}$' then perform private.fail('VALIDATION_FAILED');end if;
  update core.files set state='ready',checksum=lower(r->>'checksum'),expires_at=null,version=version+1 where id=fid returning version into ver;
 elsif op='document_version_publish_v1' then
  c:=private.p05_configuration(org,center,actor,r->'scope');f:=private.p05_file_access(org,c,actor,account,(r->>'file_id')::uuid);
  if f.state<>'ready' or f.checksum is null then perform private.fail('VALIDATION_FAILED');end if;
  did:=(r->>'document_id')::uuid;
  if did is null then did:=private.new_id(ids,20);insert into core.documents(id,org_id,scope_center_id,name,state) values(did,org,c,(select name from private.p05_files where file_id=f.id),'active');
  else update core.documents set version=version+1 where org_id=org and id=did returning version into ver;end if;
  if length(btrim(r->>'version_label'))=0 then perform private.fail('VALIDATION_FAILED');end if;
  vid:=fid;insert into core.document_versions(id,org_id,document_id,file_id,version_label,content_hash,effective_at) values(vid,org,did,f.id,r->>'version_label',f.checksum,clock_timestamp());
  for req in select value from jsonb_array_elements(r->'requirements') loop
   if c is not null and (coalesce(jsonb_array_length(req#>'{scope,center_ids}'),0)<>1 or req#>>'{scope,center_ids,0}'<>c::text) then perform private.fail('FORBIDDEN');end if;
   for kv,entry in select key,value from jsonb_each(req->'scope') loop
    if kv not in ('center_ids','product_version_ids','session_ids','event_ids') then perform private.fail('VALIDATION_FAILED');end if;
    if exists(select 1 from jsonb_array_elements_text(entry) x where case kv
     when 'center_ids' then not exists(select 1 from core.centers where org_id=org and id=x::uuid and (c is null or id=c))
     when 'product_version_ids' then not exists(select 1 from core.product_versions where org_id=org and id=x::uuid and (c is null or center_id is null or center_id=c))
     when 'session_ids' then not exists(select 1 from core.sessions where org_id=org and id=x::uuid and (c is null or center_id=c))
     when 'event_ids' then not exists(select 1 from core.events where org_id=org and id=x::uuid and (c is null or center_id=c)) end) then perform private.fail('NOT_FOUND');end if;
   end loop;
   insert into core.document_requirements(id,org_id,document_version_id,scope,operation,renewed_acceptance) values(private.new_id(ids,idx),org,vid,req->'scope',req->>'gate',(req->>'renewed_acceptance')::bool);idx:=idx+1;
  end loop;
  subject:='document_versions';data:=jsonb_build_object('operation_id',operation,'primary_id',vid,'version',1,'replayed',false,'related',jsonb_build_array(jsonb_build_object('type','documents','id',did)));
 elsif op in ('document_requirements_get_v1','document_accept_v1') then
  ctx:=private.p05_context(org,center,case when op='document_requirements_get_v1' then (r->>'person_id')::uuid else actor end,r->'context');
  requirements:=private.p05_requirements(org,case when op='document_requirements_get_v1' then (r->>'person_id')::uuid else actor end,r->'context',ctx);
  if op='document_requirements_get_v1' then data:=requirements;
  else
   vid:=(r->>'document_version_id')::uuid;
   if not exists(select 1 from jsonb_array_elements(requirements) x where x->>'version_id'=vid::text) then perform private.fail('NOT_FOUND');end if;
   insert into core.document_acceptances(id,org_id,person_id,account_id,document_version_id,accepted_at,operation_id,context) values(fid,org,actor,account,vid,clock_timestamp(),operation,r->'context') on conflict do nothing;
   select id,version into fid,ver from core.document_acceptances where org_id=org and person_id=actor and document_version_id=vid and context=r->'context';subject:='document_acceptances';
  end if;
 else perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('data',data,'primary_id',fid,'subject',subject,'version',ver);
end$$;

-- Acceptance and published source evidence cannot be overwritten or removed.
create function private.p05_immutable() returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'INTEGRITY_VIOLATION';end$$;
create trigger p05_acceptance_immutable before update or delete on core.document_acceptances for each row execute function private.p05_immutable();
create trigger p05_version_immutable before update or delete on core.document_versions for each row execute function private.p05_immutable();
create trigger p05_requirement_immutable before update or delete on core.document_requirements for each row execute function private.p05_immutable();
commit;
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
begin;
create table private.p05_configuration_scopes(entity_id uuid primary key,org_id uuid not null references core.organizations(id),center_id uuid,creator_person_id uuid not null,execution_center_ids uuid[],enabled boolean not null default true,foreign key(org_id,center_id) references core.centers(org_id,id),foreign key(org_id,creator_person_id) references core.people(org_id,id));
alter table private.p05_configuration_scopes enable row level security;
revoke all on private.p05_configuration_scopes from public,anon,authenticated;
grant all on private.p05_configuration_scopes to service_role;
create unique index p05_preference_identity on core.notification_preferences(org_id,person_id,channel,purpose);
create function private.p05_notification_payload(n core.notifications) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('template_key',coalesce(nullif(n.payload->>'template_key',''),n.kind),'subject',case
 when n.payload#>>'{subject,id}' ~ '^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$' and to_regclass('core.'||quote_ident(n.payload#>>'{subject,type}')) is not null then jsonb_build_object('type',n.payload#>>'{subject,type}','id',n.payload#>>'{subject,id}')
 when n.kind='seat_offer' then jsonb_build_object('type','seat_offers','id',n.subject_id)
 when n.kind='p01_expired' then jsonb_build_object('type',case when n.payload->>'operation'='request_expire_v1' then 'lesson_requests' else 'seat_offers' end,'id',n.subject_id)
 else jsonb_build_object('type','notifications','id',n.id) end)
$$;
create function private.p05_notification_page(r jsonb,org uuid,actor uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);cur jsonb;at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();items jsonb;token text;
 h text:=md5(jsonb_build_object('person',actor,'request',r-'request_id'-'page')::text);
begin
 if coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' or lim<1 or lim>200 then perform private.fail('VALIDATION_FAILED');end if;
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or at is null or last_id is null or asof is null or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'payload',private.p05_notification_payload(n),'created_at',n.created_at,'read_at',n.read_at) order by n.created_at,n.id),'[]'::jsonb) into items from
 (select * from core.notifications where org_id=org and recipient_person_id=actor and created_at<=asof and (not(r->>'unread_only')::bool or read_at is null) and (cur is null or (created_at,id)>(at,last_id)) order by created_at,id limit lim+1) n;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'created_at','id',items->-1->'id','as_of',asof)::text,'UTF8'),'hex');end if;
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof);
end$$;
create function private.p05_notifications(op text,r jsonb,org uuid,center uuid,actor uuid,operation uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare pid uuid:=private.new_id(ids,2);ver bigint:=1;data jsonb;subject text;c uuid;definition jsonb;row_data record;existing private.p05_configuration_scopes;cid uuid;segment uuid;condition jsonb;
begin
 if op='notifications_list_v1' then data:=private.p05_notification_page(r,org,actor);subject:='notifications';
 elsif op='notification_mark_read_v1' then
  update core.notifications set read_at=coalesce(read_at,clock_timestamp()),version=version+1 where org_id=org and id=(r->>'notification_id')::uuid and recipient_person_id=actor and version=(r->>'expected_version')::bigint returning id,version into pid,ver;
  if not found then perform private.fail('VERSION_CONFLICT');end if;subject:='notifications';
 elsif op='notification_preferences_set_v1' then
  -- Transactional in-app notices are mandatory. Optional messages default off.
  if r->>'purpose'='transactional' and not(r->>'enabled')::bool then perform private.fail('FORBIDDEN');end if;
  insert into core.notification_preferences(id,org_id,person_id,channel,purpose,enabled) values(pid,org,actor,'in_app',r->>'purpose',r->>'purpose'='transactional') on conflict do nothing;
  update core.notification_preferences set enabled=(r->>'enabled')::bool,version=version+1 where org_id=org and person_id=actor and channel='in_app' and purpose=r->>'purpose' and version=(r->>'expected_version')::bigint returning id,version into pid,ver;
  if not found then perform private.fail('VERSION_CONFLICT');end if;subject:='notification_preferences';
 elsif op in ('segment_save_v1','automation_save_v1') then
  c:=private.p05_configuration(org,center,actor,r->'scope');definition:=r->'definition';
  subject:=case when op='segment_save_v1' then 'segments' else 'automations' end;pid:=coalesce((r->>(case when op='segment_save_v1' then 'segment_id' else 'automation_id' end))::uuid,pid);
  select * into existing from private.p05_configuration_scopes where entity_id=pid and org_id=org;
  if existing.entity_id is null then
   if r->>'expected_version' is not null or r->>(case when op='segment_save_v1' then 'segment_id' else 'automation_id' end) is not null then perform private.fail('VERSION_CONFLICT');end if;
  elsif existing.center_id is distinct from c then perform private.fail('NOT_FOUND');
  elsif r->>'expected_version' is null then perform private.fail('VERSION_CONFLICT');end if;
  if op='segment_save_v1' then
   if coalesce(jsonb_array_length(definition->'all'),0)+coalesce(jsonb_array_length(definition->'any'),0)=0 then perform private.fail('VALIDATION_FAILED');end if;
   for condition in select value from jsonb_array_elements(coalesce(definition->'all','[]')||coalesce(definition->'any','[]')) loop
    if condition->>'operator'<>'is_null' and not(condition?'value') then perform private.fail('VALIDATION_FAILED');end if;
   end loop;
   if existing.entity_id is null then insert into core.segments(id,org_id,name,definition,state) values(pid,org,r->>'name',definition,'active');
   else update core.segments set name=r->>'name',definition=r->'definition',version=version+1 where org_id=org and id=pid and version=(r->>'expected_version')::bigint returning version into ver;if not found then perform private.fail('VERSION_CONFLICT');end if;end if;
  else
   if definition#>>'{action,channel}'<>'in_app' then perform private.fail('SERVICE_UNAVAILABLE');end if;
   if coalesce(jsonb_array_length(definition->'execution_center_ids'),0)=0 then perform private.fail('VALIDATION_FAILED');end if;
   for cid in select value::text::uuid from jsonb_array_elements_text(definition->'execution_center_ids') loop
    perform private.assert_center(org,cid);if c is not null and c<>cid then perform private.fail('FORBIDDEN');end if;
   end loop;
   segment:=(definition->>'segment_id')::uuid;
   if segment is not null and not exists(select 1 from core.segments s join private.p05_configuration_scopes x on x.entity_id=s.id where s.org_id=org and s.id=segment and s.state='active' and (x.center_id is null or (c is not null and x.center_id=c))) then perform private.fail('NOT_FOUND');end if;
   if existing.entity_id is null then insert into core.automations(id,org_id,name,trigger,segment_id,action,state) values(pid,org,definition->>'name',definition->'trigger',segment,definition->'action','active');
   else update core.automations set name=definition->>'name',trigger=definition->'trigger',segment_id=segment,action=definition->'action',version=version+1 where org_id=org and id=pid and version=(r->>'expected_version')::bigint returning version into ver;if not found then perform private.fail('VERSION_CONFLICT');end if;end if;
  end if;
  insert into private.p05_configuration_scopes(entity_id,org_id,center_id,creator_person_id,execution_center_ids,enabled) values(pid,org,c,actor,case when op='automation_save_v1' then array(select jsonb_array_elements_text(definition->'execution_center_ids')::uuid) end,coalesce((definition->>'enabled')::bool,true))
  on conflict(entity_id) do update set execution_center_ids=excluded.execution_center_ids,enabled=excluded.enabled,creator_person_id=excluded.creator_person_id;
 else perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('data',data,'primary_id',pid,'subject',subject,'version',ver);
end$$;
commit;
-- A system-created followup can belong to an existing student without inventing a CRM lead.
begin;
alter table core.crm_activities add column if not exists person_id uuid;
alter table core.crm_activities alter column lead_id drop not null;
alter table core.crm_activities add constraint p05_activity_person foreign key(org_id,person_id) references core.people(org_id,id);
alter table core.crm_activities add constraint p05_activity_target check(lead_id is not null or person_id is not null);
create unique index p05_lead_person on core.leads(org_id,center_id,id,person_id);
alter table core.crm_activities add constraint p05_activity_lead_person foreign key(org_id,center_id,lead_id,person_id) references core.leads(org_id,center_id,id,person_id);
create table private.p05_automation_activities(activity_id uuid primary key references core.crm_activities(id),automation_id uuid not null references core.automations(id),run_id uuid not null references core.automation_runs(id));
alter table private.p05_automation_activities enable row level security;
revoke all on private.p05_automation_activities from public,anon,authenticated;
grant all on private.p05_automation_activities to service_role;
create function private.p05_person_activity_access(org uuid,center uuid,actor uuid,r jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if center is null or r->>'lead_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
 if not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if not exists(select 1 from core.people p join core.center_relationships x on x.org_id=p.org_id and x.person_id=p.id where p.org_id=org and p.id=(r->>'person_id')::uuid and p.state='active' and x.center_id=center and x.state='active') then perform private.fail('NOT_FOUND');end if;
end$$;
create function private.p05_person_activity(r jsonb,org uuid,center uuid,actor uuid,operation uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare aid uuid:=private.new_id(ids,2);ver bigint:=1;
begin
 perform private.p05_person_activity_access(org,center,actor,r);
 if r->>'activity_id' is null then
  if r->>'expected_version' is not null then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.crm_activities(id,org_id,center_id,person_id,kind,due_at,outcome,note,completed_at) values(aid,org,center,(r->>'person_id')::uuid,r->>'kind',(r->>'due_at')::timestamptz,r->>'outcome',r->>'note',case when r->>'kind' in ('contact','outcome') then clock_timestamp() end);
 else
  update core.crm_activities set kind=r->>'kind',due_at=(r->>'due_at')::timestamptz,outcome=r->>'outcome',note=r->>'note',completed_at=case when r->>'kind' in ('contact','outcome') then clock_timestamp() end,version=version+1 where org_id=org and center_id=center and id=(r->>'activity_id')::uuid and person_id=(r->>'person_id')::uuid and lead_id is null and version=(r->>'expected_version')::bigint returning id,version into aid,ver;
  if not found then perform private.fail('VERSION_CONFLICT');end if;
 end if;
 return jsonb_build_object('primary_id',aid,'subject','crm_activities','version',ver,'data',jsonb_build_object('operation_id',operation,'primary_id',aid,'version',ver,'replayed',false,'related','[]'::jsonb));
end$$;
create function private.p05_activity_page(r jsonb,org uuid,center uuid,actor uuid,management boolean default false) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);sorting text:=coalesce(r#>>'{page,sort}',case when management then 'created_at_asc' else 'due_at_asc' end);cur jsonb;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();token text;items jsonb;k jsonb:=coalesce(r#>'{selector,key}','{}');h text:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page','sort',sorting)::text);
begin
 if lim<1 or lim>200 or sorting not in ('created_at_asc','due_at_asc') then perform private.fail('VALIDATION_FAILED');end if;
 if management then perform private.p05_person_activity_access(org,center,actor,r||k);end if;
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or last_at is null or last_id is null or asof is null or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with rows as(select a.*,coalesce(a.person_id,l.person_id) target,l.assigned_person_id,case when sorting='created_at_asc' then a.created_at else coalesce(a.due_at,a.created_at) end at
 from core.crm_activities a left join core.leads l on l.org_id=a.org_id and l.id=a.lead_id where a.org_id=org and (center is null or a.center_id=center) and a.created_at<=asof and private.center_accessible(org,a.center_id)
 and (private.is_manager(org,actor,a.center_id) or (l.assigned_person_id=actor and private.staff_grant(org,actor,a.center_id,'crm.daily')))
 and ((management and a.lead_id is null and a.person_id=(k->>'person_id')::uuid and (k->>'activity_id' is null or a.id=(k->>'activity_id')::uuid)) or (not management and a.kind='followup' and a.completed_at is null and exists(select 1 from private.p05_automation_activities generated where generated.activity_id=a.id)))
 and (r->'interval' is null or r->'interval'='null'::jsonb or (a.due_at>=(r#>>'{interval,starts_at}')::timestamptz and a.due_at<(r#>>'{interval,ends_at}')::timestamptz))),
 page as(select * from rows where cur is null or (at,id)>(last_at,last_id) order by at,id limit lim+1)
 select coalesce(jsonb_agg(case when management then jsonb_build_object('operation','crm_activity_save_v1','entity',jsonb_build_object('type','crm_activities','id',id),'exists',true,'state',case when completed_at is null then 'open' else 'completed' end,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','crm_activities','id',id),'version',version)),'as_of',asof,'current',jsonb_build_object('operation','crm_activity_save_v1','values',jsonb_build_object('person_id',person_id,'lead_id',lead_id,'activity_id',id,'kind',kind,'due_at',due_at,'outcome',outcome,'note',note)),'_at',at)
 else jsonb_build_object('id',id,'person_id',target,'center_id',center_id,'lead_id',lead_id,'assigned_to',assigned_person_id,'kind','automation_followup','due_at',coalesce(due_at,created_at),'_at',at) end order by at,id),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',case when management then (items->-1)#>'{entity,id}' else items->-1->'id' end,'as_of',asof)::text,'UTF8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof);
end$$;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.p04_center(text,jsonb,uuid)'::regprocedure);old:=$a$ if op in ('lead_save_v1','leads_list_v1','crm_followup_list_v1')$a$;
 if strpos(b,old)=0 then raise exception 'P05 person activity center anchor missing';end if;
 execute replace(b,old,$a$ if op='crm_activity_save_v1' and r->>'person_id' is not null then if c is null then perform private.fail('VALIDATION_FAILED');end if;return c;end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_access(text,jsonb,uuid,uuid,uuid)'::regprocedure);old:=$a$ if op='publication_set_v1' then$a$;
 if strpos(b,old)=0 then raise exception 'P05 person activity access anchor missing';end if;
 execute replace(b,old,$a$ if op='crm_activity_save_v1' and r->>'person_id' is not null then perform private.p05_person_activity_access(org,center,actor,r);return;end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);old:=$a$ if op='crm_followup_list_v1' then$a$;
 if strpos(b,old)=0 then raise exception 'P05 person activity command anchor missing';end if;
 execute replace(b,old,$a$ if op='crm_activity_save_v1' and r->>'person_id' is not null then return private.p05_person_activity(r,org,center,actor,operation,ids);end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_management(jsonb,uuid,uuid,uuid)'::regprocedure);old:=$a$ if r#>>'{selector,operation}' is distinct from op$a$;
 if strpos(b,old)=0 then raise exception 'P05 person activity read anchor missing';end if;
 execute replace(b,old,$a$ if op='crm_activity_save_v1' and k->>'person_id' is not null then return jsonb_build_object('data',private.p05_activity_page(r,org,center,actor,true),'primary_id',center,'subject','centers');end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_followups_page(jsonb,uuid,uuid,uuid)'::regprocedure);old:=$a$ if lim<1 or lim>200$a$;
 if strpos(b,old)=0 then raise exception 'P05 person followup read anchor missing';end if;
 execute replace(b,old,$a$ if r->>'kind'='automation_followup' then return private.p05_activity_page(r,org,center,actor);end if;
$a$||old);
end$patch$;
commit;
begin;
do $$begin if not exists(select 1 from pg_roles where rolname='ftk_p05_worker') then create role ftk_p05_worker nologin;end if;end$$;
create table private.p05_worker_scopes(db_role name not null,org_id uuid not null references core.organizations(id),primary key(db_role,org_id));
create table private.p05_jobs(job_id uuid primary key references core.outbox_jobs(id),org_id uuid not null references core.organizations(id),operation text not null check(operation in ('outbox_deliver_v1','reminder_schedule_v1','automation_run_v1')),target_id uuid not null,center_id uuid,person_id uuid,automation_id uuid,event_key text,operation_key uuid,lease_hash text,payload_hash text,result jsonb);
alter table private.p05_worker_scopes enable row level security;alter table private.p05_jobs enable row level security;
revoke all on private.p05_worker_scopes,private.p05_jobs from public,anon,authenticated,ftk_p05_worker;
create unique index p05_automation_event on core.automation_runs(org_id,automation_id,person_id,event_key);
create function private.p05_worker_scope(org uuid) returns void language plpgsql security invoker set search_path='' as $$
begin if not pg_has_role(session_user,'ftk_p05_worker','member') or not exists(select 1 from private.p05_worker_scopes where db_role=session_user and org_id=org) then perform private.fail('FORBIDDEN');end if;end$$;
create function private.p05_optional_allowed(org uuid,person uuid,purpose text) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select p.enabled from core.notification_preferences p where p.org_id=org and p.person_id=person and p.channel='in_app' and p.purpose=$3),false)
$$;
-- No dynamic SQL: typed segment fields/operators are evaluated on a safe snapshot.
create function private.p05_segment_condition(condition jsonb,fields jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare lhs jsonb:=fields->(condition->>'field');rhs jsonb:=condition->'value';op text:=condition->>'operator';
begin
 if op='is_null' then return lhs is null or lhs='null'::jsonb;end if;
 if lhs is null or lhs='null'::jsonb or rhs is null then return false;end if;
 if op='eq' then return lhs=rhs;elsif op='neq' then return lhs<>rhs;elsif op='in' then return jsonb_typeof(rhs)='array' and rhs@>jsonb_build_array(lhs);end if;
 if jsonb_typeof(lhs)<>jsonb_typeof(rhs) or jsonb_typeof(lhs) not in ('number','string') then return false;end if;
 if jsonb_typeof(lhs)='number' then
  return case op when 'lt' then (lhs#>>'{}')::numeric<(rhs#>>'{}')::numeric when 'lte' then (lhs#>>'{}')::numeric<=(rhs#>>'{}')::numeric when 'gt' then (lhs#>>'{}')::numeric>(rhs#>>'{}')::numeric when 'gte' then (lhs#>>'{}')::numeric>=(rhs#>>'{}')::numeric else false end;
 end if;
 if condition->>'field' in ('last_attended_at','entitlement_ends_at') then
  return case op when 'lt' then (lhs#>>'{}')::timestamptz<(rhs#>>'{}')::timestamptz when 'lte' then (lhs#>>'{}')::timestamptz<=(rhs#>>'{}')::timestamptz when 'gt' then (lhs#>>'{}')::timestamptz>(rhs#>>'{}')::timestamptz when 'gte' then (lhs#>>'{}')::timestamptz>=(rhs#>>'{}')::timestamptz else false end;
 end if;
 return false;
exception when others then return false;
end$$;
create function private.p05_segment_matches(org uuid,center uuid,person uuid,segment uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare d jsonb;fields jsonb;c jsonb;l core.leads;last_at timestamptz;end_at timestamptz;credits bigint;
begin
 if segment is null then return true;end if;
 select s.definition into d from core.segments s join private.p05_configuration_scopes x on x.entity_id=s.id where s.org_id=org and s.id=segment and s.state='active' and (x.center_id is null or x.center_id=center);
 if d is null then return false;end if;
 select * into l from core.leads where org_id=org and center_id=center and person_id=person order by created_at desc,id desc limit 1;
 select max(coalesce(s.actual_started_at,s.starts_at)) into last_at from core.attendance_entries a join core.reservations r on r.org_id=a.org_id and r.id=a.reservation_id join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.center_id=center and r.person_id=person and a.result='attended' and r.state='completed';
 select min(s.valid_until) into end_at from core.sales s where s.org_id=org and s.center_id=center and s.person_id=person and s.state='active' and s.valid_until>clock_timestamp();
 select coalesce(sum(private.available_for(org,s.id,clock_timestamp())),0) into credits from core.sales s where s.org_id=org and s.person_id=person and s.center_id=center and s.state='active';
 fields:=jsonb_build_object('last_attended_at',last_at,'entitlement_ends_at',end_at,'remaining_credits',credits,'lead_source',l.source,'lead_interest',l.interest,'active_student',exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=person and kind='student' and state='active'),'center_id',center);
 for c in select value from jsonb_array_elements(coalesce(d->'all','[]')) loop if not private.p05_segment_condition(c,fields) then return false;end if;end loop;
 if jsonb_array_length(coalesce(d->'any','[]'))>0 and not exists(select 1 from jsonb_array_elements(d->'any') v(value) where private.p05_segment_condition(v.value,fields)) then return false;end if;
 return true;
end$$;
create function private.p05_automation_candidates(org uuid,center uuid,trigger jsonb) returns table(person_id uuid,target_id uuid,event_key text) language plpgsql stable security invoker set search_path='' as $$
declare days int:=(trigger->>'offset_days')::int;policy core.policy_versions;
begin
 if trigger->>'kind'='lead_followup_due' then
  return query select l.person_id,a.id,'activity:'||a.id::text||':'||a.version::text from core.crm_activities a join core.leads l on l.org_id=a.org_id and l.id=a.lead_id where a.org_id=org and a.center_id=center and l.state='open' and a.completed_at is null and not exists(select 1 from private.p05_automation_activities generated where generated.activity_id=a.id) and a.due_at<=clock_timestamp()+make_interval(days=>days);return;
 end if;
 select * into policy from private.policy_at(org,center,case when trigger->>'kind'='student_inactive' then 'inactive_student_days' else 'entitlement_reminder_days' end,clock_timestamp());
 if policy.id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if policy.mandatory and (policy.value->>'value')::int<>days then perform private.fail('FORBIDDEN');end if;
 if trigger->>'kind'='entitlement_expiring' then
  return query select s.person_id,s.id,'sale:'||s.id::text||':'||s.version::text from core.sales s where s.org_id=org and s.center_id=center and s.state='active' and s.valid_until>clock_timestamp() and s.valid_until<=clock_timestamp()+make_interval(days=>days)
  and not exists(select 1 from core.sales n where n.org_id=org and n.previous_sale_id=s.id and n.state='active');
 elsif trigger->>'kind'='student_inactive' then
  return query select cr.person_id,cr.id,'inactive:'||cr.id::text||':'||coalesce(last_seen.at,cr.started_at)::text from core.center_relationships cr
  left join lateral(select max(coalesce(s.actual_started_at,s.starts_at)) at from core.attendance_entries a join core.reservations r on r.org_id=a.org_id and r.id=a.reservation_id join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.center_id=center and r.person_id=cr.person_id and a.result='attended' and r.state='completed') last_seen on true
  where cr.org_id=org and cr.center_id=center and cr.kind='student' and cr.state='active' and coalesce(last_seen.at,cr.started_at)+make_interval(days=>days)<=clock_timestamp();
 end if;
end$$;
create function private.p05_jobs_claim(org uuid,ids uuid[],lim int default 1) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare j core.outbox_jobs;item record;jid uuid;idx int:=1;tok text;out_data jsonb:='[]';cfg record;candidate record;c uuid;fingerprint text;
begin
 perform private.p05_worker_scope(org);
 if lim<1 or lim>50 then perform private.fail('VALIDATION_FAILED');end if;
 perform 1 from core.organizations where id=org for update;
 if private.access_mode(org) not in ('normal','grace') then return '[]';end if;
 perform private.require_feature(org,'F26');
 insert into private.p05_jobs(job_id,org_id,operation,target_id,person_id) select j.id,j.org_id,'outbox_deliver_v1',j.notification_id,n.recipient_person_id from core.outbox_jobs j join core.notifications n on n.org_id=j.org_id and n.id=j.notification_id where j.org_id=org and j.kind='in_app' and j.state in ('pending','retry_wait','running') on conflict(job_id) do nothing;
 if exists(select 1 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id where s.org_id=org and p.name in ('pro','business') and 'F27'=any(p.features)) then
  for item in select r.id,r.center_id,r.person_id from core.reservations r join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.state='active' and s.state='planned' and s.starts_at>clock_timestamp() and s.starts_at<=clock_timestamp()+interval '24 hours' and private.center_accessible(org,r.center_id) and not exists(select 1 from core.outbox_jobs j where j.org_id=org and j.kind='p05.reminder' and j.dedupe_key='p05.lesson:'||r.id::text) order by s.starts_at,r.id limit 100 loop
   fingerprint:='p05.lesson:'||item.id::text;jid:=private.new_id(ids,idx);idx:=idx+1;
   insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,org,'p05.reminder',fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
   if found then insert into private.p05_jobs(job_id,org_id,operation,target_id,center_id,person_id,event_key) values(jid,org,'reminder_schedule_v1',item.id,item.center_id,item.person_id,'lesson');end if;
  end loop;
  for item in select s.id,s.center_id,s.person_id from core.sales s cross join lateral private.policy_at(org,s.center_id,'entitlement_reminder_days',clock_timestamp()) p where s.org_id=org and s.state='active' and s.valid_until>clock_timestamp() and s.valid_until<=clock_timestamp()+make_interval(days=>(p.value->>'value')::int) and private.center_accessible(org,s.center_id)
  and not exists(select 1 from core.sales n where n.org_id=org and n.previous_sale_id=s.id and n.state='active') and not exists(select 1 from core.outbox_jobs j where j.org_id=org and j.kind='p05.reminder' and j.dedupe_key='p05.entitlement:'||s.id::text) order by s.valid_until,s.id limit 100 loop
   fingerprint:='p05.entitlement:'||item.id::text;jid:=private.new_id(ids,idx);idx:=idx+1;
   insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,org,'p05.reminder',fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
   if found then insert into private.p05_jobs(job_id,org_id,operation,target_id,center_id,person_id,event_key) values(jid,org,'reminder_schedule_v1',item.id,item.center_id,item.person_id,'entitlement');end if;
  end loop;
 end if;
 for cfg in select a.*,x.execution_center_ids,x.creator_person_id from core.automations a join private.p05_configuration_scopes x on x.entity_id=a.id join core.saas_subscriptions s on s.org_id=a.org_id join core.saas_plan_versions p on p.id=s.plan_version_id where a.org_id=org and a.state='active' and x.enabled and p.name='business' and 'F24'=any(p.features) order by a.created_at,a.id loop
  exit when idx>200;
  foreach c in array cfg.execution_center_ids loop
   exit when idx>200;
   if not private.center_accessible(org,c) or not private.is_manager(org,cfg.creator_person_id,c) then continue;end if;
   begin
   for candidate in select z.* from private.p05_automation_candidates(org,c,cfg.trigger) z where not exists(select 1 from core.outbox_jobs j where j.org_id=org and j.kind='p05.automation' and j.dedupe_key='p05.automation:'||cfg.id::text||':'||cfg.version::text||':'||z.person_id::text||':'||z.event_key) and private.p05_segment_matches(org,c,z.person_id,cfg.segment_id) order by person_id,target_id limit 100 loop
    exit when idx>200;
    fingerprint:='p05.automation:'||cfg.id::text||':'||cfg.version::text||':'||candidate.person_id::text||':'||candidate.event_key;
    jid:=private.new_id(ids,idx);idx:=idx+1;
    insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,org,'p05.automation',fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
    if found then insert into private.p05_jobs(job_id,org_id,operation,target_id,center_id,person_id,automation_id,event_key) values(jid,org,'automation_run_v1',candidate.target_id,c,candidate.person_id,cfg.id,cfg.version::text||':'||candidate.event_key);end if;
   end loop;
   exception when SQLSTATE 'P0001' then if SQLERRM not in ('POLICY_NOT_CONFIGURED','FORBIDDEN','PLAN_FEATURE_UNAVAILABLE','NOT_FOUND') then raise;end if;end;
  end loop;
 end loop;
 update core.outbox_jobs j set state='failed',lease_until=null,version=version+1 from private.p05_jobs c where c.job_id=j.id and c.org_id=org and j.state='running' and j.lease_until<=clock_timestamp() and j.attempts>=3;
 for j in select j.* from core.outbox_jobs j join private.p05_jobs c on c.job_id=j.id where c.org_id=org and j.attempts<3 and ((j.state in ('pending','retry_wait') and coalesce(j.next_attempt_at,clock_timestamp())<=clock_timestamp()) or (j.state='running' and j.lease_until<=clock_timestamp())) order by j.created_at,j.id limit lim for update of j skip locked loop
  tok:=encode(extensions.gen_random_bytes(32),'hex');update private.p05_jobs set lease_hash=encode(extensions.digest(tok,'sha256'),'hex'),operation_key=private.new_id(ids,idx),payload_hash=null,result=null where job_id=j.id;idx:=idx+1;
  update core.outbox_jobs set state='running',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds',version=version+1 where id=j.id;
  select operation into fingerprint from private.p05_jobs where job_id=j.id;
  out_data:=out_data||jsonb_build_array(jsonb_build_object('operation',fingerprint,'request',jsonb_build_object('client_api_version',1,'request_id',private.new_id(ids,idx),'org_id',org,'operation_key',(select operation_key from private.p05_jobs where job_id=j.id),'job_id',j.id,'lease_token',tok)));idx:=idx+1;
 end loop;
 return out_data;
end$$;
create function private.p05_worker_execute(op text,r jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare org uuid:=(r->>'org_id')::uuid;j core.outbox_jobs;c private.p05_jobs;a core.automations;x private.p05_configuration_scopes;res core.reservations;sal core.sales;policy core.policy_versions;run_id uuid:=private.new_id(ids,2);nid uuid:=private.new_id(ids,20);out_data jsonb;code text;did uuid;subject text:='outbox_jobs';l core.leads;allowed boolean:=true;
begin
 perform private.p05_worker_scope(org);perform 1 from core.organizations where id=org for update;
 select * into j from core.outbox_jobs where org_id=org and id=(r->>'job_id')::uuid for update;
 select * into c from private.p05_jobs where job_id=j.id and org_id=org;
 if c.job_id is null or c.operation<>op or c.operation_key is distinct from (r->>'operation_key')::uuid or c.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') or r->>'center_id' is not null then perform private.fail('FORBIDDEN');end if;
 if c.payload_hash is not null and c.payload_hash<>encode(extensions.digest((r-'request_id')::text,'sha256'),'hex') then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if j.state<>'succeeded' and (j.state<>'running' or j.lease_until<=clock_timestamp()) then perform private.fail('OPERATION_IN_PROGRESS');end if;
 begin
 if private.access_mode(org) not in ('normal','grace') then perform private.fail('SERVICE_UNAVAILABLE');end if;
 perform private.require_feature(org,'F26');
 if c.center_id is not null and not private.center_accessible(org,c.center_id) then perform private.fail('NOT_FOUND');end if;
 if op='automation_run_v1' then
  perform private.require_feature(org,'F24');select * into a from core.automations where org_id=org and id=c.automation_id;select * into x from private.p05_configuration_scopes where entity_id=a.id and org_id=org;
  if a.id is null or x.entity_id is null or not exists(select 1 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id where s.org_id=org and p.name='business') or not x.enabled or a.state<>'active' or not(c.center_id=any(x.execution_center_ids)) or not private.is_manager(org,x.creator_person_id,c.center_id) then perform private.fail('FORBIDDEN');end if;
 elsif op='reminder_schedule_v1' then
  perform private.require_feature(org,'F27');
  if not exists(select 1 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id where s.org_id=org and p.name in ('pro','business')) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
 if j.state='succeeded' and c.result is not null then return c.result;end if;

  if op='outbox_deliver_v1' then
   if j.kind<>'in_app' or j.notification_id is null or not exists(select 1 from core.notifications where org_id=org and id=j.notification_id and recipient_person_id=c.person_id) then perform private.fail('NOT_FOUND');end if;
   did:=j.notification_id;subject:='notifications';
  elsif op='reminder_schedule_v1' then
   allowed:=private.p05_optional_allowed(org,c.person_id,'reminder');
   if c.event_key='lesson' then
    select * into res from core.reservations where org_id=org and id=c.target_id and person_id=c.person_id and center_id=c.center_id and state='active';
    allowed:=allowed and res.id is not null and exists(select 1 from core.sessions where org_id=org and id=res.session_id and state='planned' and starts_at>clock_timestamp() and starts_at<=clock_timestamp()+interval '24 hours');
    subject:='reservations';
   else
    select * into sal from core.sales where org_id=org and id=c.target_id and person_id=c.person_id and center_id=c.center_id and state='active';
    select * into policy from private.policy_at(org,c.center_id,'entitlement_reminder_days',clock_timestamp());
    if policy.id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
    allowed:=allowed and sal.id is not null and sal.valid_until>clock_timestamp() and sal.valid_until<=clock_timestamp()+make_interval(days=>(policy.value->>'value')::int) and not exists(select 1 from core.sales where org_id=org and previous_sale_id=sal.id and state='active');subject:='sales';
   end if;
   if allowed then insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(nid,org,c.person_id,'reminder',c.target_id,jsonb_build_object('template_key','p05.'||c.event_key,'subject',jsonb_build_object('type',subject,'id',c.target_id)));did:=nid;subject:='notifications';else did:=j.id;subject:='outbox_jobs';end if;
  elsif op='automation_run_v1' then
   allowed:=exists(select 1 from private.p05_automation_candidates(org,c.center_id,a.trigger) z where z.person_id=c.person_id and z.target_id=c.target_id and a.version::text||':'||z.event_key=c.event_key) and private.p05_segment_matches(org,c.center_id,c.person_id,a.segment_id);
   if allowed then
    insert into core.automation_runs(id,org_id,automation_id,person_id,event_key,state) values(run_id,org,a.id,c.person_id,c.event_key,'running');
    if a.action->>'kind'='send_reminder' then
     perform private.require_feature(org,'F27');
     if a.action->>'channel'<>'in_app' then perform private.fail('SERVICE_UNAVAILABLE');end if;
     if private.p05_optional_allowed(org,c.person_id,'reminder') then insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(nid,org,c.person_id,'reminder',c.person_id,jsonb_build_object('template_key',a.action->>'template_key','subject',jsonb_build_object('type','people','id',c.person_id)));end if;
    elsif a.action->>'kind'='create_followup' then
     select * into l from core.leads where org_id=org and center_id=c.center_id and person_id=c.person_id and state='open' order by created_at,id limit 1;
     insert into core.crm_activities(id,org_id,center_id,lead_id,person_id,kind,due_at,note) values(nid,org,c.center_id,l.id,c.person_id,'followup',clock_timestamp(),a.action->>'template_key');
     insert into private.p05_automation_activities values(nid,a.id,run_id);
    else perform private.fail('VALIDATION_FAILED');end if;
    update core.automation_runs set state='succeeded',version=version+1 where id=run_id;did:=run_id;subject:='automation_runs';
   else did:=j.id;subject:='outbox_jobs';end if;
  else perform private.fail('FORBIDDEN');end if;
  out_data:=jsonb_build_object('ok',true,'data',jsonb_build_object('job_id',j.id,'state','succeeded','result_reference',jsonb_build_object('type',subject,'id',did)),'trace_id',private.new_id(ids,1));
  insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result,result_expires_at,business_reference) values(private.new_id(ids,3),org,'worker:p05:'||session_user,op,encode(extensions.digest(r->>'operation_key','sha256'),'hex'),encode(extensions.digest((r-'request_id')::text,'sha256'),'hex'),'succeeded',out_data,clock_timestamp()+interval '30 days',did);
  insert into core.audit_events(id,org_id,action,subject_table,subject_id,operation_id,diff) values(private.new_id(ids,4),org,op,subject,did,private.new_id(ids,3),jsonb_build_object('worker_role',session_user,'job_id',j.id,'center_id',c.center_id,'creator_person_id',x.creator_person_id));
  update core.outbox_jobs set state='succeeded',lease_until=null,version=version+1 where id=j.id;
  update private.p05_jobs set result=out_data,payload_hash=encode(extensions.digest((r-'request_id')::text,'sha256'),'hex') where job_id=j.id;
  set constraints all immediate;set constraints all deferred;return out_data;
 exception when others then if j.state='succeeded' then raise;end if;code:=case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end;end;
 update core.outbox_jobs set state=case when attempts>=3 then 'failed' else 'retry_wait' end,lease_until=null,next_attempt_at=clock_timestamp()+interval '5 seconds',version=version+1 where id=j.id;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',j.attempts<3,'trace_id',private.new_id(ids,1)));
end$$;
revoke all on function private.p05_worker_execute(text,jsonb,uuid[]),private.p05_jobs_claim(uuid,uuid[],int) from public,anon,authenticated;
grant usage on schema private to ftk_p05_worker;
grant execute on function private.p05_worker_execute(text,jsonb,uuid[]),private.p05_jobs_claim(uuid,uuid[],int) to ftk_p05_worker;
commit;
begin;
create function private.p05_management(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';items jsonb;lim int:=coalesce((r#>>'{page,limit}')::int,50);cur jsonb;at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();token text;h text:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page')::text);
begin
 if r#>>'{selector,operation}' is distinct from op or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' or lim<1 or lim>200 then perform private.fail('VALIDATION_FAILED');end if;
 perform private.p05_access(op,r||k,org,center,actor,account);
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or at is null or last_id is null or asof is null or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with rows as(
 select f.id,f.created_at,f.version,f.state,'files'::text subject,jsonb_build_object('name',p.name,'mime',f.mime,'bytes',f.size_bytes) vals from core.files f join private.p05_files p on p.file_id=f.id where op='document_upload_prepare_v1' and f.org_id=org and f.center_id is not distinct from center and p.account_id=account
 union all select v.id,v.created_at,v.version,'published','document_versions',jsonb_build_object('document_id',v.document_id,'file_id',v.file_id,'version_label',v.version_label,'requirements',coalesce((select jsonb_agg(jsonb_build_object('gate',q.operation,'scope',q.scope,'renewed_acceptance',q.renewed_acceptance) order by q.id) from core.document_requirements q where q.org_id=org and q.document_version_id=v.id),'[]'::jsonb),'scope',k->'scope') from core.document_versions v join core.documents d on d.org_id=v.org_id and d.id=v.document_id where op in ('document_version_publish_v1','document_publication_preview_v1') and v.org_id=org and v.file_id=(k->>'file_id')::uuid and d.scope_center_id is not distinct from (k#>>'{scope,center_id}')::uuid and (k->>'document_id' is null or v.document_id=(k->>'document_id')::uuid)
 union all select f.id,f.created_at,f.version,f.state,'files',jsonb_build_object('file_id',f.id,'checksum',f.checksum) from core.files f join private.p05_files p on p.file_id=f.id where op='file_upload_complete_v1' and f.org_id=org and f.id=(k->>'file_id')::uuid and p.account_id=account
 union all select n.id,n.created_at,n.version,case when n.read_at is null then 'unread' else 'read' end,'notifications',jsonb_build_object('notification_id',n.id) from core.notifications n where op='notification_mark_read_v1' and n.org_id=org and n.id=(k->>'notification_id')::uuid and n.recipient_person_id=actor
 union all select n.id,n.created_at,n.version,'active','notification_preferences',jsonb_build_object('channel',n.channel,'purpose',n.purpose,'enabled',n.enabled) from core.notification_preferences n where op='notification_preferences_set_v1' and n.org_id=org and n.person_id=actor and n.channel=k->>'channel' and n.purpose=k->>'purpose'
 union all select s.id,s.created_at,s.version,s.state,'segments',jsonb_build_object('segment_id',s.id,'name',s.name,'definition',s.definition,'scope',k->'scope') from core.segments s join private.p05_configuration_scopes x on x.entity_id=s.id where op='segment_save_v1' and s.org_id=org and x.center_id is not distinct from (k#>>'{scope,center_id}')::uuid and (k->>'segment_id' is null or s.id=(k->>'segment_id')::uuid)
 union all select a.id,a.created_at,a.version,a.state,'automations',jsonb_build_object('automation_id',a.id,'definition',jsonb_build_object('name',a.name,'trigger',a.trigger,'action',a.action,'segment_id',a.segment_id,'execution_center_ids',x.execution_center_ids,'enabled',x.enabled),'scope',k->'scope') from core.automations a join private.p05_configuration_scopes x on x.entity_id=a.id where op='automation_save_v1' and a.org_id=org and x.center_id is not distinct from (k#>>'{scope,center_id}')::uuid and (k->>'automation_id' is null or a.id=(k->>'automation_id')::uuid)
 union all select a.id,a.created_at,a.version,'accepted','document_acceptances',jsonb_build_object('document_version_id',a.document_version_id,'context',a.context) from core.document_acceptances a where op='document_accept_v1' and a.org_id=org and a.person_id=actor and a.document_version_id=(k->>'document_version_id')::uuid
 ),page as(select * from rows where created_at<=asof and (cur is null or (created_at,id)>(at,last_id)) order by created_at,id limit lim+1)
 select coalesce(jsonb_agg(jsonb_build_object('operation',op,'entity',jsonb_build_object('type',subject,'id',id),'exists',true,'state',state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',subject,'id',id),'version',version)),'as_of',asof,'current',jsonb_build_object('operation',op,'values',vals),'_at',created_at) order by created_at,id),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',(items->-1)#>'{entity,id}','as_of',asof)::text,'UTF8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('data',jsonb_build_object('items',items,'next_cursor',token,'as_of',asof),'primary_id',org,'subject','organizations');
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);ops text:=$o$'document_publication_preview_v1','document_upload_prepare_v1','document_version_publish_v1','document_requirements_get_v1','document_accept_v1','file_upload_complete_v1','notifications_list_v1','notification_mark_read_v1','notification_preferences_set_v1','segment_save_v1','automation_save_v1'$o$;
 managed text:=$o$'document_publication_preview_v1','document_upload_prepare_v1','document_version_publish_v1','file_upload_complete_v1','notification_mark_read_v1','notification_preferences_set_v1','segment_save_v1','automation_save_v1','document_accept_v1'$o$;old text;
begin
 old:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if strpos(b,old)=0 then raise exception 'P05 access anchor missing';end if;
 b:=replace(b,old,old||' if p_operation in ('||ops||') then perform private.p05_access(p_operation,r,org,center,person,actor.id);end if;');
 old:=$a$ elsif perm_code='invite.student' then$a$;
 if strpos(b,old)=0 then raise exception 'P05 permission anchor missing';end if;
 b:=replace(b,old,' elsif p_operation in ('||ops||') then null;'||old);
 old:=$a$elsif perm_code='management.inspect' then$a$;
 if strpos(b,old)=0 then raise exception 'P05 management access anchor missing';end if;
 b:=replace(b,old,'elsif perm_code=''management.inspect'' and r->>''operation'' in ('||managed||') then perform private.p05_access(r->>''operation'',r||(r#>''{selector,key}''),org,center,person,actor.id);'||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';
 if strpos(b,old)=0 then raise exception 'P05 management domain anchor missing';end if;
 b:=replace(b,old,'if p_operation=''management_state_get_v1'' and r->>''operation'' in ('||managed||') then terms:=private.p05_management(r,org,center,person,actor.id);else '||old||'end if;');
 old:=' if mutable then';
 if strpos(b,old)=0 then raise exception 'P05 storage context anchor missing';end if;
 -- Only a trusted Edge may request internal metadata. This return is after live
 -- Auth/session/org/billing/permission checks and before any receipt mutation.
 b:=replace(b,old,$a$
 if p_operation='file_upload_complete_v1' and p_aux->>'phase'='storage_context' then
  select * into row_record from core.files where org_id=org and id=(r->>'file_id')::uuid;
  return jsonb_build_object('_internal_storage',jsonb_build_object('object_key',row_record.object_key,'bytes',row_record.size_bytes,'mime',row_record.mime,'checksum',row_record.checksum,'state',row_record.state));
 end if;
$a$||old);
 old:=' -- DOMAIN_CASES';
 if strpos(b,old)=0 then raise exception 'P05 case anchor missing';end if;
 b:=replace(b,old,$a$
 when 'document_publication_preview_v1','document_upload_prepare_v1','document_version_publish_v1','document_requirements_get_v1','document_accept_v1','file_upload_complete_v1' then
  terms:=private.p05_documents(p_operation,r,org,center,person,actor.id,operation_id,p_ids,p_aux);out:=terms->'data';if out='null'::jsonb then out:=null;end if;record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';version_n:=coalesce((terms->>'version')::bigint,1);
 when 'notifications_list_v1','notification_mark_read_v1','notification_preferences_set_v1','segment_save_v1','automation_save_v1' then
  terms:=private.p05_notifications(p_operation,r,org,center,person,operation_id,p_ids);out:=terms->'data';if out='null'::jsonb then out:=null;end if;record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';version_n:=coalesce((terms->>'version')::bigint,1);
 -- DOMAIN_CASES$a$);
 old:='   insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload)';
 if strpos(b,old)=0 then raise exception 'P05 notification ack anchor missing';end if;
 b:=replace(b,old,'   if p_operation not in (''notification_mark_read_v1'',''notification_preferences_set_v1'') then'||old);
 old:=$a$'in_app',operation_id::text,'pending',0,now());$a$;
 if strpos(b,old)=0 then raise exception 'P05 notification ack end missing';end if;
 b:=replace(b,old,old||'end if;');execute b;
end$patch$;
create function private.p05_document_gate() returns trigger language plpgsql security invoker set search_path='' as $$
declare ctx jsonb;target uuid;c uuid;g text;sid uuid;org uuid:=new.org_id;
begin
 if tg_table_name='reservations' then target:=new.person_id;c:=new.center_id;g:='reservation';sid:=new.id;
 elsif tg_table_name='sales' then target:=new.person_id;c:=new.center_id;g:='sale';sid:=new.id;
 elsif tg_table_name='event_registrations' then
  if tg_op='UPDATE' then if new.attendance_result is not distinct from old.attendance_result or new.attendance_result<>'attended' then return new;end if;g:='attendance';else g:='event_registration';end if;
  target:=new.person_id;c:=new.center_id;sid:=new.id;
 else
  if new.result<>'attended' then return new;end if;
  if tg_op='UPDATE' then if new.result is not distinct from old.result then return new;end if;end if;
  select person_id,center_id into target,c from core.reservations where org_id=org and id=new.reservation_id;g:='attendance';sid:=new.reservation_id;
 end if;
 ctx:=jsonb_build_object('gate',g,'subject',jsonb_build_object('type',case when tg_table_name='attendance_entries' then 'reservations' else tg_table_name end,'id',sid));
 perform private.p05_assert_documents(org,c,target,ctx);return new;
end$$;
create constraint trigger p05_reservation_document after insert on core.reservations deferrable initially deferred for each row execute function private.p05_document_gate();
create constraint trigger p05_sale_document after insert on core.sales deferrable initially deferred for each row execute function private.p05_document_gate();
create constraint trigger p05_event_document after insert or update on core.event_registrations deferrable initially deferred for each row execute function private.p05_document_gate();
create constraint trigger p05_attendance_document after insert or update on core.attendance_entries deferrable initially deferred for each row execute function private.p05_document_gate();
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('segment_save_v1','crm.manage','config',array['F24']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.segment_save_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('segment_save_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.segment_save_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.segment_save_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('automation_save_v1','crm.manage','config',array['F24']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.automation_save_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('automation_save_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.automation_save_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.automation_save_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('notifications_list_v1','notification.self','read',array['F26']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.notifications_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('notifications_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.notifications_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.notifications_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('notification_mark_read_v1','notification.self','maintenance',array['F26']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.notification_mark_read_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('notification_mark_read_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.notification_mark_read_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.notification_mark_read_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('notification_preferences_set_v1','notification.self','maintenance',array['F26']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.notification_preferences_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('notification_preferences_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.notification_preferences_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.notification_preferences_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('document_upload_prepare_v1','document.manage','config',array['F30']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.document_upload_prepare_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('document_upload_prepare_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.document_upload_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.document_upload_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('document_version_publish_v1','document.manage','config',array['F30']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.document_version_publish_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('document_version_publish_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.document_version_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.document_version_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('document_requirements_get_v1','person.read','read',array['F30']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.document_requirements_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('document_requirements_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.document_requirements_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.document_requirements_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('document_accept_v1','document.accept','maintenance',array['F30']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.document_accept_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('document_accept_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.document_accept_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.document_accept_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('outbox_deliver_v1','system.worker','worker',array['F26']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.outbox_deliver_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('outbox_deliver_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.outbox_deliver_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.outbox_deliver_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('reminder_schedule_v1','system.worker','worker',array['F27']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.reminder_schedule_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('reminder_schedule_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.reminder_schedule_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.reminder_schedule_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('automation_run_v1','system.worker','worker',array['F24']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.automation_run_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('automation_run_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.automation_run_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.automation_run_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('file_upload_complete_v1','account.self','maintenance',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.file_upload_complete_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('file_upload_complete_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.file_upload_complete_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.file_upload_complete_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('document_publication_preview_v1','document.manage','config',array['F30']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.document_publication_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('document_publication_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.document_publication_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.document_publication_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
notify pgrst,'reload schema';
commit;
