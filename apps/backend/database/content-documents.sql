begin;
create table private.content_invalidations(template_id uuid primary key references private.content_templates(id),invalidated_at timestamptz not null default clock_timestamp());
create table private.rendered_documents(
 id uuid primary key,org_id uuid not null references core.organizations(id),center_id uuid,
 template_id uuid not null references private.content_templates(id),document_version_id uuid,agreement_id uuid,
 content jsonb not null,language text not null,source_version text not null,content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),source_content_hash text not null,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(org_id,center_id) references core.centers(org_id,id),foreign key(org_id,document_version_id) references core.document_versions(org_id,id),foreign key(org_id,agreement_id) references core.instructor_agreements(org_id,id),
 check((document_version_id is null)<>(agreement_id is null)),unique(template_id,document_version_id),unique(template_id,agreement_id),unique(org_id,id)
);
create table private.document_presentations(
 org_id uuid not null,person_id uuid not null,document_version_id uuid not null,context jsonb not null,rendered_document_id uuid not null,
 primary key(org_id,person_id,document_version_id,context),foreign key(org_id,person_id) references core.people(org_id,id),foreign key(org_id,document_version_id) references core.document_versions(org_id,id),foreign key(org_id,rendered_document_id) references private.rendered_documents(org_id,id)
);
create table private.purchase_documents(
 preview_id uuid primary key references core.previews(id),org_id uuid not null,center_id uuid not null,person_id uuid not null,product_version_id uuid not null,requirements jsonb not null,
 foreign key(org_id,person_id) references core.people(org_id,id),foreign key(org_id,center_id) references core.centers(org_id,id),foreign key(org_id,product_version_id) references core.product_versions(org_id,id)
);
create table private.purchase_document_uses(
 sale_id uuid primary key,purchase_preview_id uuid not null unique references private.purchase_documents(preview_id),
 foreign key(sale_id) references core.sales(id) deferrable initially deferred
);
alter table private.digital_document_acceptances alter column displayed_content drop not null,alter column content_hash drop not null,alter column source_content_hash drop not null,add column rendered_document_id uuid,add foreign key(org_id,rendered_document_id) references private.rendered_documents(org_id,id),add check((rendered_document_id is null)<>(displayed_content is null));
alter table core.document_acceptances add column center_id uuid,add column account_link_id uuid,add column auth_session_id uuid;
alter table private.digital_agreement_acceptances alter column displayed_content drop not null,alter column content_hash drop not null,alter column source_content_hash drop not null,alter column source_facts drop not null,add column rendered_document_id uuid,add column center_id uuid,add column account_link_id uuid,add column auth_session_id uuid,add foreign key(org_id,rendered_document_id) references private.rendered_documents(org_id,id),add check((rendered_document_id is null)<>(displayed_content is null));
-- A session UUID is historical evidence, deliberately not a cascading Auth FK.
do $$declare n text;begin foreach n in array array['content_invalidations','rendered_documents','document_presentations','purchase_documents','purchase_document_uses'] loop
 execute format('alter table private.%I enable row level security',n);execute format('revoke all on private.%I from public,anon,authenticated',n);execute format('grant select,insert on private.%I to service_role',n);
 execute format('create trigger %I before update or delete on private.%I for each row execute function private.p05_immutable()',n||'_immutable',n);
end loop;end$$;
create function private.content_document_publication() returns trigger language plpgsql set search_path='' as $$
declare source private.digital_document_contents;c uuid;t private.content_templates;
begin
 select * into source from private.digital_document_contents where org_id=new.org_id and file_id=new.file_id;
 if source.file_id is null then return new;end if;
 select scope_center_id into c from core.documents where org_id=new.org_id and id=new.document_id;
 t:=private.content_store(jsonb_build_object('scope_key',case when c is null then 'organization:'||new.org_id else 'center:'||new.org_id||':'||c end,'org_id',new.org_id,'center_id',c,'code','document.'||new.document_id,'channel','document','language',lower(source.content->>'language'),'version',1,'source_version',new.id::text,'content',source.content,'action','publish'),new.id);
 return new;
end$$;
create trigger content_document_publication after insert on core.document_versions for each row execute function private.content_document_publication();
-- Each source version has its own translation family. Catalog revisions do not
-- make a translation of an earlier source applicable to a later document.
-- Multiple source versions may use the same language/revision number.
alter table private.content_templates drop constraint content_templates_scope_key_code_channel_language_version_key;
create unique index content_template_identity on private.content_templates(scope_key,code,channel,language,source_version,version);
create unique index content_non_document_identity on private.content_templates(scope_key,code,channel,language,version) where channel<>'document';
-- Existing organization-authored sources stay in DB; no customer text enters Git.
do $$declare v core.document_versions;begin
 for v in select x.* from core.document_versions x join private.digital_document_contents d on d.org_id=x.org_id and d.file_id=x.file_id loop
  insert into private.content_templates(id,scope_key,org_id,center_id,code,channel,language,version,source_version,content,state,published_at)
  select v.id,case when d.scope_center_id is null then 'organization:'||v.org_id else 'center:'||v.org_id||':'||d.scope_center_id end,v.org_id,d.scope_center_id,'document.'||v.document_id,'document',lower(c.content->>'language'),1,v.id::text,c.content,'published',clock_timestamp()
  from core.documents d join private.digital_document_contents c on c.org_id=d.org_id and c.file_id=v.file_id where d.org_id=v.org_id and d.id=v.document_id;
 end loop;
end$$;
create function private.rendered_document_valid(doc uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from private.rendered_documents d where d.id=$1 and not exists(select 1 from private.content_invalidations i where i.template_id=d.template_id))
$$;
create function private.rendered_document_view(d private.rendered_documents) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',d.id,'language',d.language,'source_version',d.source_version,'content_hash',d.content_hash,'source_content_hash',d.source_content_hash,'content',d.content,'created_at',d.created_at)
$$;
create function private.document_snapshot(org uuid,vid uuid,target uuid,ctx jsonb) returns private.rendered_documents language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare v core.document_versions;d core.documents;t private.content_templates;s private.rendered_documents;body jsonb;
begin
 select x.* into s from private.document_presentations p join private.rendered_documents x on x.org_id=p.org_id and x.id=p.rendered_document_id where p.org_id=org and p.document_version_id=vid and p.person_id=target and p.context=ctx;
 if s.id is not null then return s;end if;
 select * into v from core.document_versions where org_id=org and id=vid;select * into d from core.documents where org_id=org and id=v.document_id;
 t:=private.content_pick(case when d.scope_center_id is null then 'organization:'||org else 'center:'||org||':'||d.scope_center_id end,'document.'||d.id,'document',private.content_languages(org,target,'document'),vid::text);
 if t.id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 body:=private.content_render(t,'{}');
 insert into private.rendered_documents(id,org_id,center_id,template_id,document_version_id,content,language,source_version,content_hash,source_content_hash)
 values(t.id,org,d.scope_center_id,t.id,vid,body,t.language,vid::text,private.digital_document_hash(body),v.content_hash) on conflict do nothing;
 select * into s from private.rendered_documents where template_id=t.id and document_version_id=vid;
 insert into private.document_presentations values(org,target,vid,ctx,s.id) on conflict do nothing;return s;
end$$;
create function private.purchase_document_context(org uuid,center uuid,target uuid,ctx jsonb) returns private.purchase_documents language plpgsql stable set search_path='' as $$
declare p private.purchase_documents;v core.previews;
begin
 select * into p from private.purchase_documents where preview_id=(ctx->>'purchase_preview_id')::uuid and org_id=org and center_id=center and person_id=target;
 select * into v from core.previews where org_id=org and id=p.preview_id and operation='sale_apply_v1';
 if p.preview_id is null or v.id is null or not exists(select 1 from private.preview_payloads x where x.preview_id=v.id and x.expires_at>clock_timestamp()) or p.product_version_id is distinct from (ctx#>>'{subject,id}')::uuid or ctx#>>'{subject,type}'<>'product_versions' or ctx->>'gate'<>'sale' then perform private.fail('NOT_FOUND');end if;
 return p;
end$$;
alter function private.p05_requirements(uuid,uuid,jsonb,jsonb) rename to p05_requirements_current;
create function private.p05_requirements(org uuid,target uuid,ctx jsonb,context_data jsonb) returns jsonb language plpgsql stable set search_path='' as $$
#variable_conflict use_variable
declare items jsonb;item jsonb;result jsonb:='[]';p private.purchase_documents;accepted boolean;
begin
 if ctx?'purchase_preview_id' then p:=private.purchase_document_context(org,(context_data->>'center_id')::uuid,target,ctx);items:=p.requirements;
 else items:=private.p05_requirements_current(org,target,ctx,context_data);end if;
 for item in select * from jsonb_array_elements(items) loop
  if exists(select 1 from private.digital_document_contents where org_id=org and file_id=(item#>>'{file,id}')::uuid) then
   if ctx?'purchase_preview_id' then
    select exists(select 1 from core.document_acceptances a join private.digital_document_acceptances e on e.org_id=a.org_id and e.acceptance_id=a.id
     where a.org_id=org and a.person_id=target and a.document_version_id=(item->>'version_id')::uuid and a.context=ctx and e.rendered_document_id is not null and private.rendered_document_valid(e.rendered_document_id)) into accepted;
   else
    -- Historical acceptance and renewed_acceptance=false keep their original
    -- eligibility. Provenance is preserved, never promoted to server evidence.
    select exists(select 1 from core.document_acceptances a join core.document_versions av on av.org_id=a.org_id and av.id=a.document_version_id
     join core.document_versions current_v on current_v.org_id=av.org_id and current_v.id=(item->>'version_id')::uuid
     join core.document_requirements q on q.org_id=current_v.org_id and q.document_version_id=current_v.id and q.operation=ctx->>'gate'
     left join private.digital_document_acceptances e on e.org_id=a.org_id and e.acceptance_id=a.id
     where a.org_id=org and a.person_id=target and a.context->>'gate'=q.operation and (av.id=current_v.id or not q.renewed_acceptance and av.document_id=current_v.document_id)
     and (e.rendered_document_id is null or private.rendered_document_valid(e.rendered_document_id))) into accepted;
   end if;
   item:=item||jsonb_build_object('accepted',accepted);
  end if;
  result:=result||jsonb_build_array(item);
 end loop;return result;
end$$;
create function private.digital_document_projection_v2(items jsonb,r jsonb,org uuid,target uuid) returns jsonb language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare item jsonb;result jsonb:='[]';snap private.rendered_documents;e jsonb;
begin
 for item in select * from jsonb_array_elements(items) loop
  if exists(select 1 from private.digital_document_contents where org_id=org and file_id=(item#>>'{file,id}')::uuid) then
   item:=item||'{"content_kind":"digital"}';
   if (item#>>'{file,id}')::uuid=(r->>'content_file_id')::uuid then
    snap:=private.document_snapshot(org,(item->>'version_id')::uuid,target,r->'context');
    select private.digital_acceptance_view(a) into e from core.document_acceptances a where a.org_id=org and a.document_version_id=(item->>'version_id')::uuid and a.person_id=target and a.context=r->'context';
    item:=item||jsonb_build_object('rendered_document',private.rendered_document_view(snap),'digital_content',snap.content,'content_hash',snap.content_hash,'language',snap.language,'content',jsonb_build_object('mime','text/plain','encoding','base64','data',replace(encode(convert_to(snap.content->>'text','UTF8'),'base64'),E'\n','')));
    if e is not null then item:=item||jsonb_build_object('digital_acceptance',e);end if;
   end if;
  else item:=item||'{"content_kind":"file"}';end if;
  result:=result||jsonb_build_array(item);
 end loop;return result;
end$$;
create function private.digital_acceptance_view(a core.document_acceptances) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',a.id,'account_id',a.account_id,'person_id',a.person_id,'accepted_at',a.accepted_at,'content_hash',coalesce(d.content_hash,e.content_hash),'source_content_hash',coalesce(d.source_content_hash,e.source_content_hash),'displayed_content',coalesce(d.content,e.displayed_content),'rendered_document_id',e.rendered_document_id,'evidence_kind',case when e.rendered_document_id is null then 'legacy_client' else 'server_document' end)
 from private.digital_document_acceptances e left join private.rendered_documents d on d.org_id=e.org_id and d.id=e.rendered_document_id where e.org_id=a.org_id and e.acceptance_id=a.id
$$;
create or replace function private.digital_document_record(r jsonb,org uuid,acceptance uuid,version_id uuid) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare s private.rendered_documents;p private.document_presentations;link uuid;session uuid;
begin
 if not exists(select 1 from core.document_versions v join private.digital_document_contents d on d.org_id=v.org_id and d.file_id=v.file_id where v.org_id=org and v.id=version_id) then
  if r?'displayed_content' or r?'rendered_document_id' then perform private.fail('VALIDATION_FAILED');end if;return;
 end if;
 if r?'displayed_content' or r?'displayed_content_hash' or not r?'rendered_document_id' then perform private.fail('VALIDATION_FAILED');end if;
 select * into s from private.rendered_documents d where d.org_id=org and d.id=(r->>'rendered_document_id')::uuid and d.document_version_id=version_id;
 select p0.* into p from private.document_presentations p0 join core.document_acceptances a on a.org_id=p0.org_id and a.person_id=p0.person_id and a.context=p0.context and a.document_version_id=p0.document_version_id where a.org_id=org and a.id=acceptance and p0.rendered_document_id=s.id;
 if s.id is null or p.rendered_document_id is null or not private.rendered_document_valid(s.id) then perform private.fail('NOT_FOUND');end if;
 insert into private.digital_document_acceptances(org_id,acceptance_id,rendered_document_id) values(org,acceptance,s.id) on conflict do nothing;
 if not exists(select 1 from private.digital_document_acceptances where org_id=org and acceptance_id=acceptance and rendered_document_id=s.id) then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
end$$;
commit;
begin;
create function private.agreement_acceptance_view(e private.digital_agreement_acceptances) returns jsonb language sql stable set search_path='' as $$
 select case when e.id is null then null else jsonb_build_object('id',e.id,'agreement_id',e.agreement_id,'account_id',e.account_id,'person_id',e.person_id,'accepted_at',e.accepted_at,'content_hash',coalesce(d.content_hash,e.content_hash),'source_content_hash',coalesce(d.source_content_hash,e.source_content_hash),'displayed_content',coalesce(d.content,e.displayed_content),'rendered_document_id',e.rendered_document_id,'evidence_kind',case when e.rendered_document_id is null then 'legacy_client' else 'server_document' end) end
 from (select 1) x left join private.rendered_documents d on d.org_id=e.org_id and d.id=e.rendered_document_id
$$;
alter function private.digital_agreement_execute(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]) rename to digital_agreement_execute_legacy;
create function private.digital_agreement_execute(op text,r jsonb,org uuid,center uuid,person uuid,account uuid,operation uuid,ids uuid[],session uuid default null) returns jsonb language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare a core.instructor_agreements;e private.digital_agreement_acceptances;facts jsonb;h text;result jsonb;t private.content_templates;s private.rendered_documents;body jsonb;link uuid;
begin
 perform private.digital_agreement_access(op,r,org,center,person);
 select * into a from core.instructor_agreements where org_id=org and id=(r->>'agreement_id')::uuid;
 facts:=private.digital_agreement_view(a);h:=encode(extensions.digest(convert_to(facts::text,'UTF8'),'sha256'),'hex');
 if op='instructor_agreement_accept_v1' then
  if r?'expected_version' and a.version is distinct from (r->>'expected_version')::bigint or r?'source_content_hash' and h is distinct from r->>'source_content_hash' then perform private.fail('VERSION_CONFLICT');end if;
  if r?'displayed_content' or r?'displayed_content_hash' or not r?'rendered_document_id' then perform private.fail('VALIDATION_FAILED');end if;
  select * into s from private.rendered_documents where org_id=org and id=(r->>'rendered_document_id')::uuid and agreement_id=a.id and center_id=center and source_content_hash=h;
  if s.id is null or not private.rendered_document_valid(s.id) then perform private.fail('NOT_FOUND');end if;
  select l.id into link from core.account_links l where l.org_id=org and l.account_id=account and l.person_id=person and l.state='active' and l.verified_at is not null;
  if link is null then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
  insert into private.digital_agreement_acceptances(id,org_id,agreement_id,person_id,account_id,operation_id,rendered_document_id,center_id,account_link_id,auth_session_id)
   values(private.new_id(ids,2),org,a.id,person,account,operation,s.id,center,link,session) on conflict(org_id,agreement_id,account_id) do nothing;
  select * into e from private.digital_agreement_acceptances where org_id=org and agreement_id=a.id and account_id=account;
  if e.rendered_document_id is distinct from s.id then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
  result:=jsonb_build_object('operation_id',operation,'primary_id',a.id,'version',a.version,'replayed',false,'related',jsonb_build_array(jsonb_build_object('type','instructor_agreements','id',a.id)));
 else
  select * into e from private.digital_agreement_acceptances where org_id=org and agreement_id=a.id and person_id=a.person_id order by accepted_at,id limit 1;
  -- An existing presentation remains pinned even after another translation publishes.
  select * into s from private.rendered_documents where org_id=org and agreement_id=a.id and source_content_hash=h order by created_at,id limit 1;
  if s.id is null then
   t:=private.content_pick('center:'||org||':'||center,'instructor.agreement','document',private.content_languages(org,a.person_id,'document'),a.id::text);
   if t.id is not null then
    body:=private.content_render(t,jsonb_build_object('facts',facts::text));
    insert into private.rendered_documents(id,org_id,center_id,template_id,agreement_id,content,language,source_version,content_hash,source_content_hash)
     values(private.new_id(ids,12),org,center,t.id,a.id,body,t.language,a.id::text,private.digital_document_hash(body),h) returning * into s;
   end if;
  end if;
  result:=jsonb_build_object('agreement',facts,'source_content_hash',h,'acceptance',private.agreement_acceptance_view(e),'rendered_document',case when s.id is not null then private.rendered_document_view(s) end,'document_error',case when s.id is null then 'POLICY_NOT_CONFIGURED' end);
 end if;
 return jsonb_build_object('data',result,'primary_id',a.id,'subject','instructor_agreements','version',a.version);
end$$;
create function private.purchase_pin(preview uuid,org uuid,center uuid,target uuid,product uuid) returns void language plpgsql set search_path='' as $$
begin
 insert into private.purchase_documents values(preview,org,center,target,product,private.p05_requirements_current(org,target,jsonb_build_object('gate','sale'),jsonb_build_object('center_id',center,'product_version_id',product))) on conflict do nothing;
end$$;
create function private.purchase_sale_requirements(org uuid,target uuid,r jsonb,center uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare original jsonb;
begin
 if r?'document_purchase_id' then
  select payload into original from private.preview_payloads where preview_id=(r->>'document_purchase_id')::uuid;
  if (original-'request_id'-'document_purchase_id') is distinct from (r-'request_id'-'document_purchase_id') then perform private.fail('VERSION_CONFLICT');end if;
 end if;
 return private.p05_requirements(org,target,jsonb_build_object('gate','sale','subject',jsonb_build_object('type','product_versions','id',r->'product_version_id'))||case when r?'document_purchase_id' then jsonb_build_object('purchase_preview_id',r->'document_purchase_id') else '{}'::jsonb end,jsonb_build_object('center_id',center,'product_version_id',r->'product_version_id'));
end$$;
create function private.purchase_use(sale uuid,org uuid,center uuid,target uuid,r jsonb) returns void language plpgsql set search_path='' as $$
declare ctx jsonb;p private.purchase_documents;
begin
 if r?'document_purchase_id' then
  ctx:=jsonb_build_object('gate','sale','subject',jsonb_build_object('type','product_versions','id',r->'product_version_id'),'purchase_preview_id',r->'document_purchase_id');
  p:=private.purchase_document_context(org,center,target,ctx);
  if exists(select 1 from private.purchase_document_uses where purchase_preview_id=p.preview_id) then perform private.fail('INVALID_STATE_TRANSITION');end if;
  insert into private.purchase_document_uses values(sale,p.preview_id);
 elsif exists(select 1 from jsonb_array_elements(private.purchase_sale_requirements(org,target,r,center)) x join private.digital_document_contents d on d.org_id=org and d.file_id=(x#>>'{file,id}')::uuid) then perform private.fail('DOCUMENT_REQUIRED');end if;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.content_store(jsonb,uuid)'::regprocedure);
 a:='c.version=(r->>''version'')::bigint';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Content source identity drift';end if;b:=replace(b,a,a||' and (c.source_version=r->>''source_version'' or c.channel<>''document'')');
 b:=replace(b,$a$action not in ('draft','publish','retire')$a$,$a$action not in ('draft','publish','retire','invalidate')$a$);
 b:=replace(b,$a$if action='retire' then$a$,$a$if action in ('retire','invalidate') then$a$);
 b:=replace(b,$a$insert into private.content_retirements(template_id) values(t.id) on conflict do nothing;return t;$a$,$a$if action='retire' then insert into private.content_retirements(template_id) values(t.id) on conflict do nothing;else insert into private.content_invalidations(template_id) values(t.id) on conflict do nothing;end if;return t;$a$);execute b;
 b:=pg_get_functiondef('private.content_pick(text,text,text,text[],text)'::regprocedure);
 a:='and not exists(select 1 from private.content_retirements x where x.template_id=c.id)';if strpos(b,a)=0 then raise exception 'Content invalidation selection drift';end if;execute replace(b,a,a||' and not exists(select 1 from private.content_invalidations x where x.template_id=c.id)');
 b:=pg_get_functiondef('private.p05_documents(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='private.digital_document_projection(requirements,r,org,coalesce((r->>''person_id'')::uuid,actor))';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Server document projection drift';end if;b:=replace(b,a,'private.digital_document_projection_v2(requirements,r,org,coalesce((r->>''person_id'')::uuid,actor))');
 a:='document_version_id,accepted_at,operation_id,context) values(fid,org,actor,account,vid,clock_timestamp(),operation,r->''context'')';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Document relationship evidence drift';end if;
 b:=replace(b,a,$a$document_version_id,accepted_at,operation_id,context,center_id,account_link_id,auth_session_id) values(fid,org,actor,account,vid,clock_timestamp(),operation,r->'context',(ctx->>'center_id')::uuid,(select l.id from core.account_links l where l.org_id=org and l.person_id=actor and l.account_id=account and l.state='active' and l.verified_at is not null),(aux->>'catalog_session_id')::uuid)$a$);execute b;
 b:=pg_get_functiondef('private.sale_impact(jsonb,uuid,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$private.p05_requirements(org,target,jsonb_build_object('gate','sale'),jsonb_build_object('center_id',center,'product_version_id',p.id))$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'Purchase requirement selection drift';end if;execute replace(b,a,'private.purchase_sale_requirements(org,target,r,center)');
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='private.p05_documents(p_operation,r,org,center,person,actor.id,operation_id,p_ids,p_aux)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Document verified session handoff drift';end if;b:=replace(b,a,$a$private.p05_documents(p_operation,r,org,center,person,actor.id,operation_id,p_ids,coalesce(p_aux,'{}')||jsonb_build_object('catalog_session_id',p_session_id))$a$);
 a:='private.digital_agreement_execute(p_operation,r,org,center,person,actor.id,operation_id,p_ids)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement verified session handoff drift';end if;b:=replace(b,a,'private.digital_agreement_execute(p_operation,r,org,center,person,actor.id,operation_id,p_ids,p_session_id)');
 a:='  update core.previews set dependencies=terms->''dependencies'',result=out-''token'' where id=record_id;';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Purchase source pin drift';end if;
 b:=replace(b,a,a||$a$if not r?'document_purchase_id' then perform private.purchase_pin(record_id,org,center,(r->>'person_id')::uuid,(r->>'product_version_id')::uuid);end if;$a$);
 a:='  insert into core.sales(id,org_id,center_id,person_id,product_version_id,net_minor,currency,valid_from,valid_until,state,terms_hash,start_date,end_date,timezone,paid_days)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Purchase source consume drift';end if;
 b:=replace(b,a,'  perform private.purchase_use(record_id,org,center,target,entry);'||E'\n'||a);execute b;
 b:=pg_get_functiondef('private.p05_document_gate()'::regprocedure);
 a:=' perform private.p05_assert_documents(org,c,target,ctx);';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Purchase deferred gate drift';end if;
 execute replace(b,a,$a$ if tg_table_name='sales' then
  select jsonb_build_object('gate','sale','subject',jsonb_build_object('type','product_versions','id',p.product_version_id),'purchase_preview_id',p.preview_id) into ctx from private.purchase_document_uses u join private.purchase_documents p on p.preview_id=u.purchase_preview_id where u.sale_id=new.id;
  if ctx is null then ctx:=jsonb_build_object('gate','sale','subject',jsonb_build_object('type','sales','id',new.id));
  elsif exists(select 1 from jsonb_array_elements(private.p05_requirements(org,target,ctx,jsonb_build_object('center_id',c,'product_version_id',new.product_version_id))) x where not (x->>'accepted')::boolean) then perform private.fail('DOCUMENT_REQUIRED');
  else return new;end if;
 end if;
$a$||a);
 b:=pg_get_functiondef('private.p05_management(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$jsonb_build_object('id',a.id,'account_id',a.account_id,'person_id',a.person_id,'accepted_at',a.accepted_at,'content_hash',e.content_hash,'source_content_hash',e.source_content_hash,'displayed_content',e.displayed_content)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Document history source projection drift';end if;execute replace(b,a,'private.digital_acceptance_view(a)');
end$patch$;
commit;
begin;
revoke all on function private.content_document_publication(),private.rendered_document_valid(uuid),private.rendered_document_view(private.rendered_documents),private.document_snapshot(uuid,uuid,uuid,jsonb),private.purchase_document_context(uuid,uuid,uuid,jsonb),private.p05_requirements(uuid,uuid,jsonb,jsonb),private.digital_document_projection_v2(jsonb,jsonb,uuid,uuid),private.digital_acceptance_view(core.document_acceptances),private.agreement_acceptance_view(private.digital_agreement_acceptances),private.digital_agreement_execute(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],uuid),private.purchase_pin(uuid,uuid,uuid,uuid,uuid),private.purchase_sale_requirements(uuid,uuid,jsonb,uuid),private.purchase_use(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.rendered_document_valid(uuid),private.rendered_document_view(private.rendered_documents),private.document_snapshot(uuid,uuid,uuid,jsonb),private.purchase_document_context(uuid,uuid,uuid,jsonb),private.p05_requirements(uuid,uuid,jsonb,jsonb),private.digital_document_projection_v2(jsonb,jsonb,uuid,uuid),private.digital_acceptance_view(core.document_acceptances),private.agreement_acceptance_view(private.digital_agreement_acceptances),private.digital_agreement_execute(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],uuid),private.purchase_pin(uuid,uuid,uuid,uuid,uuid),private.purchase_sale_requirements(uuid,uuid,jsonb,uuid),private.purchase_use(uuid,uuid,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
begin;
-- Infer the legacy version selector from the immutable document; if both are
-- sent they must describe the same server-owned resource.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' -- Central permission mapping;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Document selector normalization drift';end if;
 execute replace(b,a,$a$ if p_operation='document_accept_v1' and r?'rendered_document_id' then
  select document_version_id into linked from private.rendered_documents where org_id=org and id=(r->>'rendered_document_id')::uuid;
  if linked is null then perform private.fail('NOT_FOUND');end if;
  if r?'document_version_id' and (r->>'document_version_id')::uuid is distinct from linked then perform private.fail('NOT_FOUND');end if;
  r:=r||jsonb_build_object('document_version_id',linked);
 end if;
$a$||a);
end$patch$;
commit;
