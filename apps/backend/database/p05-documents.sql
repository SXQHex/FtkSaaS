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
 elsif typ='product_versions' and ctx->>'gate'='sale' then select v.center_id,v.id into c,pv from core.product_versions v where v.org_id=org and v.id=sid;
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
     when 'product_version_ids' then not exists(select 1 from core.product_versions where org_id=org and id=x::uuid and (c is null or center_id=c))
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
