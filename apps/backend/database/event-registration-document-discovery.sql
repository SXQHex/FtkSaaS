-- Discover a member's existing registration previews without exposing apply tokens.
begin;
create function private.event_registration_document_contexts(
 p_org uuid,p_center uuid,p_person uuid,p_preview uuid default null
) returns table(created_at timestamptz,row_key text,context jsonb)
language sql stable security invoker set search_path='' as $$
 select v.created_at,'events/'||e.id::text||'/event_registration/'||v.id::text,
  jsonb_build_object('gate','event_registration','subject',jsonb_build_object('type','events','id',e.id),'event_registration_preview_id',v.id)
  ||case when sale.product_version_id is null then '{}'::jsonb else jsonb_build_object('product_version_id',sale.product_version_id) end
 from core.previews v
 join private.preview_payloads x on x.preview_id=v.id
 join core.people person on person.org_id=v.org_id and person.id=p_person and person.state='active'
 join core.events e on e.org_id=v.org_id and e.id=(x.payload->>'event_id')::uuid and e.center_id=p_center
 left join core.sales sale on sale.org_id=v.org_id and sale.id=(x.payload->>'sale_id')::uuid and sale.person_id=p_person
 where v.org_id=p_org and v.operation='event_register_v1' and v.state='current' and (p_preview is null or v.id=p_preview)
  and x.expires_at>statement_timestamp() and x.payload->>'center_id'=p_center::text and x.payload->>'person_id'=p_person::text
  and e.state='published' and e.published and (v.dependencies#>>'{versions,0,version}')::bigint=e.version
  and v.result->'blockers'='[]'::jsonb
  and (x.payload->>'sale_id' is null or sale.id is not null)
  and (x.payload->>'preparation_id' is null or v.dependencies->'policy_hashes'=jsonb_build_array(private.event_financial_fingerprint(p_org,e.id)))
  and not exists (
   select from jsonb_array_elements(v.dependencies->'versions') dep
   where dep#>>'{entity,type}'='entitlement_accounts' and not exists (
    select from core.entitlement_accounts a where a.org_id=p_org and a.id=(dep#>>'{entity,id}')::uuid and a.version=(dep->>'version')::bigint
   )
  )
  and private.member_summary_enabled(p_org,array['event_registration_preview_v1','event_register_v1'],x.payload)
  and private.event_eligibility(p_org,e.id,p_person,sale.id) is null
  and (sale.id is not null or private.preparation_eligibility(p_org,e.id,p_person,(x.payload->>'preparation_id')::uuid) is null)
$$;
revoke all on function private.event_registration_document_contexts(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.event_registration_document_contexts(uuid,uuid,uuid,uuid) to service_role;

do $patch$
declare body text; anchor text;
begin
 body:=pg_get_functiondef('private.member_document_directory(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:='from private.document_active_contexts(org,center,actor) where last_key';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Member document discovery anchor drift';end if;
 execute replace(body,anchor,$new$from (
   select created_at,row_key,context from private.document_active_contexts(org,center,actor)
   union all
   select created_at,row_key,context from private.event_registration_document_contexts(org,center,actor)
  ) contexts where last_key$new$);

 body:=pg_get_functiondef('private.p05_context(uuid,uuid,uuid,jsonb)'::regprocedure);
 anchor:=$old$ if typ='lesson_requests' and ctx->>'gate'='reservation' then$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Document context anchor drift';end if;
 execute replace(body,anchor,$new$ if ctx?'event_registration_preview_id' then
  if center is null then select center_id into c from core.events where org_id=org and id=sid;
  else c:=center;end if;
  if not exists (
   select from private.event_registration_document_contexts(org,c,target,(ctx->>'event_registration_preview_id')::uuid) candidate
   where ctx-'on_behalf_of_person_id'=candidate.context
  ) then perform private.fail('NOT_FOUND');end if;
  perform private.assert_center(org,c);
  return jsonb_build_object('center_id',c,'event_id',sid,'product_version_id',ctx->'product_version_id');
 end if;
$new$||anchor);

 -- Preserve the published event-only document flow. A draft or a product
 -- without a real registration/preview must not become a document context.
 body:=pg_get_functiondef('private.p05_access(text,jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:=$old$  ctx:=private.p05_context(org,center,target,r->'context');$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Document access anchor drift';end if;
 execute replace(body,anchor,$new$  if r#>>'{context,subject,type}'='events'
     and exists(select from core.events e where e.org_id=org and e.id=(r#>>'{context,subject,id}')::uuid and e.state='draft') then
   perform private.fail('NOT_FOUND');
  end if;
  if r#>>'{context,gate}'='event_registration' and r#>>'{context,product_version_id}' is not null
     and r#>>'{context,subject,type}' in ('events','event_registrations')
     and not ((r->'context')?'event_registration_preview_id') and not exists(
    select from core.event_registrations v
    join core.entitlement_allocations a on a.org_id=v.org_id and a.event_registration_id=v.id and a.state in ('reserved','consumed')
    join core.sales s on s.org_id=v.org_id and s.id=a.sale_id
    where v.org_id=org and v.state='active'
     and (case r#>>'{context,subject,type}' when 'events' then v.event_id else v.id end)=(r#>>'{context,subject,id}')::uuid
     and private.p07_same_person(org,v.person_id,target) and s.product_version_id=(r#>>'{context,product_version_id}')::uuid
   ) then perform private.fail('NOT_FOUND');end if;
$new$||anchor);

 -- Eligibility-only registrations do not create an allocation. When a package
 -- was explicitly chosen, enforce its actual scoped documents before insertion.
 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$old$   insert into core.event_registrations(id,org_id,center_id,event_id,person_id,amount_minor,currency,terms_hash,state,attendance_result,terms_snapshot)$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Event registration gate anchor drift';end if;
 execute replace(body,anchor,$new$   if r->>'sale_id' is not null and terms->>'package_usage'='eligibility_only' then
    select product_version_id into selected from core.sales where org_id=org and id=(r->>'sale_id')::uuid and person_id=target;
    perform private.p05_assert_documents(org,center,target,jsonb_build_object(
     'gate','event_registration','subject',jsonb_build_object('type','events','id',e.id),'product_version_id',selected
    ));
   end if;
$new$||anchor);
end$patch$;
commit;
