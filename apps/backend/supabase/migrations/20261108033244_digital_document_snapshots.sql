begin;
-- Inline text is durable evidence. The existing file/version identity remains a
-- compatible document resource; no Storage object or signed upload is created.
create table private.digital_document_contents(
 org_id uuid not null references core.organizations(id),file_id uuid primary key,
 content jsonb not null,content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),
 foreign key(org_id,file_id) references core.files(org_id,id)
);
create table private.digital_document_acceptances(
 org_id uuid not null references core.organizations(id),acceptance_id uuid primary key,
 displayed_content jsonb not null,content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),
 source_content_hash text not null check(source_content_hash~'^[a-f0-9]{64}$'),
 foreign key(org_id,acceptance_id) references core.document_acceptances(org_id,id)
);
alter table private.digital_document_contents enable row level security;
alter table private.digital_document_acceptances enable row level security;
revoke all on private.digital_document_contents,private.digital_document_acceptances from public,anon,authenticated;
grant select,insert on private.digital_document_contents,private.digital_document_acceptances to service_role;
create trigger digital_document_contents_immutable before update or delete on private.digital_document_contents for each row execute function private.p05_immutable();
create trigger digital_document_acceptances_immutable before update or delete on private.digital_document_acceptances for each row execute function private.p05_immutable();
create function private.digital_document_hash(content jsonb) returns text language plpgsql immutable security invoker set search_path='' as $$
begin
 if jsonb_typeof(content) is distinct from 'object' or not content ?& array['name','language','template_id','template_version','text']
  or exists(select 1 from jsonb_object_keys(content) k where k not in ('name','language','template_id','template_version','text'))
  or exists(select 1 from jsonb_each(content) x where jsonb_typeof(x.value) is distinct from 'string')
  or length(btrim(content->>'name')) not between 1 and 200 or length(content->>'language')>35 or content->>'language'!~'^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
  or length(btrim(content->>'template_id')) not between 1 and 128 or length(btrim(content->>'template_version')) not between 1 and 64
  or length(btrim(content->>'text'))=0 or length(content->>'text')>262144 or octet_length(content->>'text')>262144
 then perform private.fail('VALIDATION_FAILED');end if;
 -- Hash exact UTF-8 text bytes, without whitespace/Unicode/line-ending rewriting.
 return encode(extensions.digest(convert_to(content->>'text','UTF8'),'sha256'),'hex');
end$$;
create function private.digital_document_projection(items jsonb,r jsonb,org uuid,target uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x||jsonb_build_object('content_kind',case when d.file_id is null then 'file' else 'digital' end)||
  case when d.file_id is not null and d.file_id=(r->>'content_file_id')::uuid then
   jsonb_build_object('digital_content',d.content,'content',jsonb_build_object('mime','text/plain','encoding','base64','data',replace(encode(convert_to(d.content->>'text','UTF8'),'base64'),E'\n','')))||
   coalesce((select jsonb_build_object('digital_acceptance',jsonb_build_object('id',a.id,'account_id',a.account_id,'person_id',a.person_id,'accepted_at',a.accepted_at,'content_hash',e.content_hash,'source_content_hash',e.source_content_hash,'displayed_content',e.displayed_content))
    from core.document_acceptances a join private.digital_document_acceptances e on e.org_id=a.org_id and e.acceptance_id=a.id
    where a.org_id=org and a.document_version_id=(x->>'version_id')::uuid and a.person_id=target and a.context=r->'context'),'{}'::jsonb)
  else '{}'::jsonb end order by n),'[]'::jsonb)
 from jsonb_array_elements(items) with ordinality v(x,n)
 left join private.digital_document_contents d on d.org_id=org and d.file_id=(x#>>'{file,id}')::uuid
$$;
create function private.digital_document_record(r jsonb,org uuid,acceptance uuid,version_id uuid) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare source private.digital_document_contents;e private.digital_document_acceptances;h text;
begin
 select d.* into source from private.digital_document_contents d join core.document_versions v on v.org_id=d.org_id and v.file_id=d.file_id where v.org_id=org and v.id=version_id;
 if source.file_id is null and not r?'displayed_content' then return;end if;
 h:=private.digital_document_hash(r->'displayed_content');
 if h is distinct from r->>'displayed_content_hash' then perform private.fail('VALIDATION_FAILED');end if;
 if source.file_id is not null and (r#>>'{displayed_content,template_id}' is distinct from source.content->>'template_id' or r#>>'{displayed_content,template_version}' is distinct from source.content->>'template_version') then perform private.fail('VERSION_CONFLICT');end if;
 insert into private.digital_document_acceptances(org_id,acceptance_id,displayed_content,content_hash,source_content_hash)
 select org,acceptance,r->'displayed_content',h,v.content_hash from core.document_versions v where v.org_id=org and v.id=version_id on conflict do nothing;
 select * into e from private.digital_document_acceptances where acceptance_id=acceptance and org_id=org;
 if e.acceptance_id is null or e.displayed_content is distinct from r->'displayed_content' or e.content_hash is distinct from h then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p05_access(text,jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$  f:=private.p05_file_access(org,c,actor,account,(r->>'file_id')::uuid);
  if f.center_id is distinct from c then perform private.fail('NOT_FOUND');end if;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Digital publication authority drift';end if;
 execute replace(b,a,$a$  if r?'digital_content' then
   if r?'file_id' then perform private.fail('VALIDATION_FAILED');end if;perform private.digital_document_hash(r->'digital_content');
  else
$a$||a||$a$
  end if;$a$);
 b:=pg_get_functiondef('private.p05_publication_preview(jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$ if not exists(select 1 from core.files where org_id=org and id=(r->>'file_id')::uuid and state='ready') then perform private.fail('VALIDATION_FAILED');end if;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Digital publication preview drift';end if;
 execute replace(b,a,$a$ if r?'digital_content' then perform private.digital_document_hash(r->'digital_content');else$a$||a||'end if;');
 b:=pg_get_functiondef('private.p05_management(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$jsonb_build_object('document_version_id',a.document_version_id,'context',a.context)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Digital acceptance history projection drift';end if;
 execute replace(b,a,a||$a$||coalesce((select jsonb_build_object('digital_acceptance',jsonb_build_object('id',a.id,'account_id',a.account_id,'person_id',a.person_id,'accepted_at',a.accepted_at,'content_hash',e.content_hash,'source_content_hash',e.source_content_hash,'displayed_content',e.displayed_content)) from private.digital_document_acceptances e where e.org_id=a.org_id and e.acceptance_id=a.id),'{}'::jsonb)$a$);
 b:=pg_get_functiondef('private.p05_documents(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$c:=private.p05_configuration(org,center,actor,r->'scope');f:=private.p05_file_access(org,c,actor,account,(r->>'file_id')::uuid);$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Digital publication writer drift';end if;
 b:=replace(b,a,$a$c:=private.p05_configuration(org,center,actor,r->'scope');
  if r?'digital_content' then
   if r?'file_id' then perform private.fail('VALIDATION_FAILED');end if;
   insert into core.files(id,org_id,center_id,owner_person_id,object_key,mime,size_bytes,purpose,state,checksum)
    values(fid,org,c,actor,org::text||'/'||fid::text,'text/plain',octet_length(r#>>'{digital_content,text}'),'document','ready',private.digital_document_hash(r->'digital_content')) returning * into f;
   insert into private.p05_files values(fid,account,r#>>'{digital_content,name}');
   insert into private.digital_document_contents values(org,fid,r->'digital_content',f.checksum);
  else f:=private.p05_file_access(org,c,actor,account,(r->>'file_id')::uuid);end if;$a$);
 a:=$a$  if op='document_requirements_get_v1' then data:=requirements;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Digital requirements projection drift';end if;
 b:=replace(b,a,$a$  if op='document_requirements_get_v1' then data:=private.digital_document_projection(requirements,r,org,coalesce((r->>'person_id')::uuid,actor));$a$);
 a:=$a$select id,version into fid,ver from core.document_acceptances where org_id=org and person_id=actor and document_version_id=vid and context=r->'context';$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Digital acceptance writer drift';end if;
 execute replace(b,a,a||'perform private.digital_document_record(r,org,fid,vid);');
end$patch$;
revoke all on function private.digital_document_hash(jsonb),private.digital_document_projection(jsonb,jsonb,uuid,uuid),private.digital_document_record(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.digital_document_hash(jsonb),private.digital_document_projection(jsonb,jsonb,uuid,uuid),private.digital_document_record(jsonb,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
