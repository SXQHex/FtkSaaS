begin;
-- Catalog translations cannot bypass the existing canonical source publication
-- and impact/reconsent gates by calling a different publication API.
create function private.content_source_guard(r jsonb) returns void language plpgsql stable set search_path='' as $$
declare source jsonb;epoch text;
begin
 if r->>'channel'<>'document' then return;end if;
 if r->>'code' like 'document.%' then
  if r->>'source_version'!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then perform private.fail('VERSION_CONFLICT');end if;
  select c.content into source from core.document_versions v join core.documents d on d.org_id=v.org_id and d.id=v.document_id join private.digital_document_contents c on c.org_id=v.org_id and c.file_id=v.file_id
  where v.org_id=(r->>'org_id')::uuid and v.id=(r->>'source_version')::uuid and 'document.'||d.id=r->>'code' and d.scope_center_id is not distinct from (r->>'center_id')::uuid;
  if source is null then perform private.fail('NOT_FOUND');end if;
 elsif r->>'code' like 'notice.sharing.%' then
  select n->'content',s.sharing_notice_epochs->>(n->>'field') into source,epoch from private.frontend_settings s cross join lateral jsonb_array_elements(coalesce(s.values->'sharing_notices','[]')) n
  where s.scope_key='organization:'||(r->>'org_id')::uuid and 'notice.sharing.'||(n->>'field')=r->>'code';
  if source is null or epoch is distinct from r->>'source_version' or r->>'center_id' is not null then perform private.fail('VERSION_CONFLICT');end if;
 elsif r->>'code'='instructor.agreement' then
  if r->>'source_version'!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' or not exists(select 1 from core.instructor_agreements where org_id=(r->>'org_id')::uuid and center_id=(r->>'center_id')::uuid and id=(r->>'source_version')::uuid) then perform private.fail('NOT_FOUND');end if;
 end if;
 if source is not null and r->>'language'=lower(source->>'language') and source is distinct from r->'content' then perform private.fail('VERSION_CONFLICT');end if;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.content_store(jsonb,uuid)'::regprocedure);
 a:=' perform private.content_validate(r->>''code'',r->>''channel'',r->>''language'',r->''content'');';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Canonical source guard drift';end if;execute replace(b,a,' perform private.content_source_guard(r);'||E'\n'||a);
end$patch$;
revoke all on function private.content_source_guard(jsonb) from public,anon,authenticated;
grant execute on function private.content_source_guard(jsonb) to service_role;
commit;
