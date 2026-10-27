begin;
create function private.p07_merge_management(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';ctx jsonb;payload jsonb;pv core.previews;source uuid;target uuid;c uuid;data jsonb;vals jsonb;versions jsonb;at timestamptz:=clock_timestamp();
begin
 if r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;
 if op='person_merge_preview_v1' then
  ctx:=private.p07_merge_access(op,k,org,center,actor,account);source:=(ctx->>'source_id')::uuid;target:=(ctx->>'target_id')::uuid;vals:=k;
 elsif op='person_merge_approve_v1' then
  select * into pv from core.previews p where p.org_id=org and p.id=(k->>'preview_id')::uuid and p.operation='person_merge_preview_v1';
  if not found then perform private.fail('NOT_FOUND');end if;
  select p.payload into payload from private.preview_payloads p where p.preview_id=pv.id;
  source:=(payload->>'source_id')::uuid;target:=(payload->>'target_id')::uuid;c:=(k->>'approval_center_id')::uuid;
  if not private.is_manager(org,actor,c) or (center is not null and center<>c) or not (private.p07_merge_snapshot(org,source,target)->'centers' ? c::text) then perform private.fail('FORBIDDEN');end if;
  vals:=jsonb_build_object('approval_center_id',c);
 else perform private.fail('FORBIDDEN');end if;
 if r?'entity' and r->'entity'<>'null'::jsonb and r->'entity' is distinct from jsonb_build_object('type','people','id',target) then perform private.fail('NOT_FOUND');end if;
 select jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','people','id',p.id),'version',p.version) order by p.id) into versions from core.people p where p.org_id=org and p.id in (source,target);
 data:=jsonb_build_object('operation',op,'entity',jsonb_build_object('type','people','id',target),'exists',true,'state',(select state from core.people where org_id=org and id=target),'versions',versions,'as_of',at,'current',jsonb_build_object('operation',op,'values',vals));
 return jsonb_build_object('data',jsonb_build_object('items',jsonb_build_array(data),'next_cursor',null,'as_of',at),'primary_id',target,'subject','people');
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;ops text:=$o$'person_merge_preview_v1','person_merge_approve_v1','person_merge_apply_v1'$o$;
begin
 old:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 merge access anchor mismatch';end if;
 b:=replace(b,old,old||E'\n'||' if p_operation in ('||ops||') then perform private.p07_merge_access(p_operation,r,org,center,person,actor.id);end if;');
 old:=$a$ elsif perm_code='invite.student' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 merge permission anchor mismatch';end if;
 b:=replace(b,old,' elsif p_operation in ('||ops||') then null;'||old);
 old:=$a$elsif perm_code='management.inspect' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 merge management access anchor mismatch';end if;
 b:=replace(b,old,'elsif perm_code=''management.inspect'' and r->>''operation'' in (''person_merge_preview_v1'',''person_merge_approve_v1'') then perform private.p07_merge_management(r,org,center,person,actor.id);'||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 merge management domain anchor mismatch';end if;
 b:=replace(b,old,'if p_operation=''management_state_get_v1'' and r->>''operation'' in (''person_merge_preview_v1'',''person_merge_approve_v1'') then terms:=private.p07_merge_management(r,org,center,person,actor.id);else '||old||'end if;');
 old:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 merge domain anchor mismatch';end if;
 b:=replace(b,old,$a$
 when 'person_merge_preview_v1','person_merge_approve_v1','person_merge_apply_v1' then
  terms:=private.p07_merge(p_operation,r,org,center,person,actor.id,operation_id,p_ids,p_aux);out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;version_n:=coalesce((terms->>'version')::bigint,1);subject:=terms->>'subject';
 -- DOMAIN_CASES$a$);
 execute b;
end$patch$;
-- Only read/eligibility functions widen equality to an alias component. Business
-- UPDATE predicates remain exact IDs; historical ledger rows are never changed.
do $patch$
declare fn record;b text;before_body text;pattern text;replacement text;lhs text;
begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname=any(array['person_projection','person_operational_access','person_assigned_access','purchased_rights','reserve_right','reserve_negative','student_credit_available','p03_finance_read','p03_collection_effects','event_eligibility','preparation_eligibility','event_assignee','event_projection','session_readable','session_assignee','schedule_page','schedule_calendar_rows','lesson_eligibility','lesson_protected','lesson_future_policy_protected','lesson_change_adverse','lesson_affected','lesson_duty','lesson_limits','agreement_at','earnings_read','p01_requests_page','p01_wait_page','p01_wait_eligible','p05_context','p05_requirements','p05_person_activity_access','p05_activity_page','p05_notification_page','p05_file_access','p06_import_file_access']) loop
  b:=pg_get_functiondef(fn.signature);before_body:=b;
  b:=regexp_replace(b,'(([a-z_][a-z0-9_]*\.)?([a-z_]+_)?person_id)\s*=\s*(person|actor|target|pid)(\M)','private.p07_same_person(org,\1,\4)','g');
  b:=replace(b,'target<>person','not private.p07_same_person(org,target,person)');
  b:=replace(b,'target=person','private.p07_same_person(org,target,person)');
  b:=replace(b,'actor<>target','not private.p07_same_person(org,actor,target)');
  b:=replace(b,'target<>actor','not private.p07_same_person(org,target,actor)');
  b:=replace(b,'target=actor','private.p07_same_person(org,target,actor)');
  b:=replace(b,'q.person_id=v.person_id','private.p07_same_person(org,q.person_id,v.person_id)');
  b:=replace(b,'d.person_id=v.person_id','private.p07_same_person(org,d.person_id,v.person_id)');
  if fn.signature::text like 'private.lesson_limits(%' then b:=replace(b,'private.p07_same_person(org,n.person_id,target)','n.person_id=private.p07_person_root(org,target)');end if;
  if fn.signature::text like 'private.reserve_negative(%' then b:=replace(b,'from core.negative_limit_overrides where org_id=org and private.p07_same_person(org,person_id,target)','from core.negative_limit_overrides where org_id=org and person_id=private.p07_person_root(org,target)');end if;
  if b<>before_body then execute b;end if;
 end loop;
 -- Self/history authorization checks in the dispatcher do not mutate target IDs.
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 b:=replace(b,'target is distinct from person','not private.p07_same_person(org,target,person)');
 b:=replace(b,'target=person','private.p07_same_person(org,target,person)');
 b:=replace(b,'target<>person','not private.p07_same_person(org,target,person)');
 -- Exact ownership SELECT/eligibility anchors, never broaden a business UPDATE.
 if strpos(b,'q.person_id=target and private.debt_remaining')=0 then raise exception 'P07 debt booking alias anchor mismatch';end if;
 b:=replace(b,'q.person_id=target and private.debt_remaining','private.p07_same_person(org,q.person_id,target) and private.debt_remaining');
 if strpos(b,'s.person_id=target and sc.class_id')=0 then raise exception 'P07 closed class alias anchor mismatch';end if;
 b:=replace(b,'s.person_id=target and sc.class_id','private.p07_same_person(org,s.person_id,target) and sc.class_id');
 if strpos(b,'from core.debts where org_id=org and center_id=center and person_id=target')=0 then raise exception 'P07 debt ownership alias anchor mismatch';end if;
 b:=replace(b,'from core.debts where org_id=org and center_id=center and person_id=target','from core.debts where org_id=org and center_id=center and private.p07_same_person(org,person_id,target)');
 b:=replace(b,'from core.credit_deficits d where d.org_id=org and d.person_id=target','from core.credit_deficits d where d.org_id=org and private.p07_same_person(org,d.person_id,target)');
 b:=replace(b,'from core.debts d where d.org_id=org and d.center_id=center and d.person_id=target','from core.debts d where d.org_id=org and d.center_id=center and private.p07_same_person(org,d.person_id,target)');
 -- Mutable contact replacement must cover the same component shown by person_get.
 if strpos(b,'c.person_id=target and not exists(select 1 from jsonb_array_elements(r#>')=0 then raise exception 'P07 contact replacement alias anchor mismatch';end if;
 b:=replace(b,'c.person_id=target and not exists(select 1 from jsonb_array_elements(r#>','private.p07_same_person(org,c.person_id,target) and not exists(select 1 from jsonb_array_elements(r#>');
 b:=replace(b,$a$c.person_id=target and c.kind=entry->>'kind' and c.value=entry->>'value'$a$,$a$private.p07_same_person(org,c.person_id,target) and c.kind=entry->>'kind' and c.value=entry->>'value'$a$);
 -- The main detail/list projection advertises linked IDs for historical reads.
 execute b;
 b:=pg_get_functiondef('private.person_projection(uuid,uuid,uuid,boolean,boolean)'::regprocedure);
 b:=replace(b,$a$'id',p.id,'display_name',p.display_name$a$,$a$'id',p.id,'display_name',p.display_name,'linked_person_ids',to_jsonb(private.p07_person_members(org,target))$a$);
 b:=replace(b,'p.id=target','p.id=private.p07_person_root(org,target)');execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
