begin;
-- Sharing keeps its existing field/revision/live-link approval model; new
-- evidence points at the immutable notice instead of recopying its text.
alter table private.rendered_documents add column notice_field text;
alter table private.rendered_documents drop constraint rendered_documents_check;
alter table private.rendered_documents add check(num_nonnulls(document_version_id,agreement_id,notice_field)=1);
create unique index rendered_notice_identity on private.rendered_documents(template_id,notice_field) where notice_field is not null;
create function private.sharing_catalog_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if new.state='published' and new.channel='document' and new.code like 'notice.sharing.%' then
  if new.org_id is null or new.center_id is not null or substr(new.code,16) not in ('profile_visible','photo_visible','email_visible','phone_visible') or new.source_version!~'^[1-9][0-9]*$' then perform private.fail('VALIDATION_FAILED');end if;
  insert into private.rendered_documents(id,org_id,template_id,notice_field,content,language,source_version,content_hash,source_content_hash)
  values(new.id,new.org_id,new.id,substr(new.code,16),new.content,new.language,new.source_version,private.digital_document_hash(new.content),private.digital_document_hash(new.content)) on conflict do nothing;
 end if;return new;
end$$;
create trigger sharing_catalog_snapshot after insert or update of state on private.content_templates for each row execute function private.sharing_catalog_snapshot();
create function private.sharing_catalog_publish(org uuid,ids uuid[]) returns void language plpgsql set search_path='' as $$
declare s private.frontend_settings;n jsonb;t private.content_templates;idx int:=20;source text;
begin
 select * into s from private.frontend_settings where scope_key='organization:'||org;
 for n in select * from jsonb_array_elements(coalesce(s.values->'sharing_notices','[]')) loop
  source:=s.sharing_notice_epochs->>(n->>'field');
  if source is not null then
   t:=private.content_store(jsonb_build_object('scope_key','organization:'||org,'org_id',org,'code','notice.sharing.'||(n->>'field'),'channel','document','language',lower(n#>>'{content,language}'),'version',1,'source_version',source,'content',n->'content','action','publish'),private.new_id(ids,idx));
  end if;idx:=idx+1;
 end loop;
end$$;
alter function private.sharing_notice_views(uuid) rename to sharing_notice_views_legacy;
create function private.sharing_notice_views(org uuid,account uuid default null) returns jsonb language plpgsql stable set search_path='' as $$
declare s private.frontend_settings;n jsonb;t private.content_templates;result jsonb:='[]';preferred text;
begin
 select * into s from private.frontend_settings where scope_key='organization:'||org;
 select nullif(values->>'language','auto') into preferred from private.frontend_settings where scope_key='user:'||account;
 for n in select * from jsonb_array_elements(coalesce(s.values->'sharing_notices','[]')) loop
  t:=private.content_pick('organization:'||org,'notice.sharing.'||(n->>'field'),'document',array[preferred,private.organization_regional_defaults(org)->>'document_language'],s.sharing_notice_epochs->>(n->>'field'));
  if t.id is null then continue;end if;
  result:=result||jsonb_build_array(jsonb_build_object('field',n->'field','content',t.content,'notice_hash',private.digital_document_hash(t.content),'notice_revision',(s.sharing_notice_epochs->>(n->>'field'))::bigint,'rendered_document_id',t.id,'language',t.language));
 end loop;return result;
end$$;
create or replace function private.sharing_consent_valid(org uuid,account uuid,person uuid,field text) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((e->>'accepted')::boolean and e->>'person_id'=$3::text and exists(
  select 1 from core.account_links l join core.accounts a on a.id=l.account_id where l.org_id=$1 and l.account_id=$2 and l.person_id=$3 and l.state='active' and l.verified_at is not null and a.state='active' and l.id=(e->>'account_link_id')::uuid and l.verified_at=(e->>'link_verified_at')::timestamptz)
 and exists(select 1 from private.frontend_settings s cross join lateral jsonb_array_elements(coalesce(s.values->'sharing_notices','[]')) n
  where s.scope_key='organization:'||$1 and n->>'field'=$4 and s.sharing_notice_epochs->>$4=e->>'notice_revision'
  and ((e->>'rendered_document_id' is null and private.digital_document_hash(n->'content')=e->>'notice_hash' and n->'content'=e->'content') or exists(select 1 from private.rendered_documents d where d.id=(e->>'rendered_document_id')::uuid and d.org_id=$1 and d.notice_field=$4 and d.source_version=e->>'notice_revision' and d.content_hash=e->>'notice_hash' and d.content=e->'content' and private.rendered_document_valid(d.id)))),false)
 from (select private.sharing_latest_consent($1,$2,$4) e) x
$$;
create function private.sharing_notice_errors(org uuid,account uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('field',n->'field','code','POLICY_NOT_CONFIGURED') order by n->>'field'),'[]'::jsonb)
 from private.frontend_settings s cross join lateral jsonb_array_elements(coalesce(s.values->'sharing_notices','[]')) n
 where s.scope_key='organization:'||$1 and not exists(select 1 from jsonb_array_elements(private.sharing_notice_views($1,$2)) v where v->>'field'=n->>'field')
$$;
create function private.sharing_content_expand(entries jsonb) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(e||case when e?'rendered_document_id' then jsonb_build_object('content',d.content) else '{}'::jsonb end order by n),'[]'::jsonb)
 from jsonb_array_elements(entries) with ordinality x(e,n) left join private.rendered_documents d on d.id=(e->>'rendered_document_id')::uuid
$$;
alter function private.sharing_evidence(jsonb,uuid,uuid,jsonb,jsonb) rename to sharing_evidence_source;
create function private.sharing_evidence(r jsonb,account uuid,person uuid,before_values jsonb,after_values jsonb,session uuid default null) returns jsonb language plpgsql set search_path='' as $$
declare entries jsonb;entry jsonb;result jsonb:='[]';doc uuid;
begin
 entries:=private.sharing_evidence_source(r,account,person,before_values,after_values);
 for entry in select * from jsonb_array_elements(entries) loop
  select d.id into doc from private.rendered_documents d where d.org_id=(r->>'org_id')::uuid and d.notice_field=entry->>'field' and d.source_version=entry->>'notice_revision' and d.content=entry->'content' order by d.created_at,d.id limit 1;
  if doc is not null then entry:=(entry-'content')||jsonb_build_object('rendered_document_id',doc);end if;
  entry:=entry||jsonb_build_object('auth_session_id',session);
  result:=result||jsonb_build_array(entry);
 end loop;return result;
end$$;
-- Same revision and live account-link checks remain mandatory. A preference
-- change does not withdraw an otherwise valid consent to that source revision.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.sharing_latest_consent(uuid,uuid,text)'::regprocedure);
 a:=' select e from';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing evidence expansion drift';end if;execute replace(b,a,' select private.sharing_content_expand(jsonb_build_array(e))->0 from');
 b:=pg_get_functiondef('private.sharing_settings_access(jsonb,uuid,uuid)'::regprocedure);
 a:='private.sharing_notice_views(org)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing acceptance language drift';end if;execute replace(b,a,'private.sharing_notice_views(org,account)');
 b:=pg_get_functiondef('private.sharing_evidence_source(jsonb,uuid,uuid,jsonb,jsonb)'::regprocedure);
 a:='private.sharing_notice_views((r->>''org_id'')::uuid)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing evidence language drift';end if;execute replace(b,a,'private.sharing_notice_views((r->>''org_id'')::uuid,account)');
 b:=pg_get_functiondef('private.frontend_settings_view(jsonb,uuid,uuid)'::regprocedure);
 a:='private.sharing_notice_views(org)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing read language drift';end if;b:=replace(b,a,'private.sharing_notice_views(org,account)');a:='''sharing_notices'',private.sharing_notice_views(org,account)';execute replace(b,a,a||',''sharing_notice_errors'',private.sharing_notice_errors(org,account)');
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='perform private.sharing_notice_revision(r,before,after);';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing source publication drift';end if;b:=replace(b,a,a||'if r->>''scope''=''organization'' then perform private.sharing_catalog_publish(org,ids);end if;');
 a:='private.sharing_evidence(r,account,person,before,after)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing verified session evidence drift';end if;b:=replace(b,a,'private.sharing_evidence(r,account,person,before,after,(aux->>''catalog_session_id'')::uuid)');
 a:='''sharing_consents'',h.sharing_consents';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing history content view drift';end if;execute replace(b,a,'''sharing_consents'',private.sharing_content_expand(h.sharing_consents)');
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='private.frontend_settings_access(r,actor.id,person,platform)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing authorized hydration drift';end if;
 b:=replace(b,'perform '||a,'if r->>''scope''=''member'' then perform private.sharing_catalog_publish(org,p_ids);end if;perform '||a);
 a:='private.frontend_settings_execute(p_operation,r,actor.id,person,operation_id,p_ids,p_aux)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing verified session handoff drift';end if;execute replace(b,a,'private.frontend_settings_execute(p_operation,r,actor.id,person,operation_id,p_ids,coalesce(p_aux,''{}'')||jsonb_build_object(''catalog_session_id'',p_session_id))');
 b:=pg_get_functiondef('private.content_catalog_access(jsonb,uuid,uuid,uuid,boolean)'::regprocedure);
 a:=$a$r->>'code' not like 'document.%' and r->>'code'<>'instructor.agreement'$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing catalog scope drift';end if;execute replace(b,a,a||$a$ and r->>'code' not like 'notice.sharing.%'$a$);
end$patch$;
revoke all on function private.sharing_catalog_snapshot(),private.sharing_catalog_publish(uuid,uuid[]),private.sharing_notice_views(uuid,uuid),private.sharing_notice_errors(uuid,uuid),private.sharing_content_expand(jsonb),private.sharing_evidence(jsonb,uuid,uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.sharing_catalog_publish(uuid,uuid[]),private.sharing_notice_views(uuid,uuid),private.sharing_notice_errors(uuid,uuid),private.sharing_content_expand(jsonb),private.sharing_evidence(jsonb,uuid,uuid,jsonb,jsonb,uuid) to service_role;
notify pgrst,'reload schema';
commit;
