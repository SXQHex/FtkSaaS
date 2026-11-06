begin;
-- Inspect a fixed action using its original live authorization preflight. No
-- command payload/amount, approval, receipt or financial effect is synthesized.
create function private.action_management_page(r jsonb,org uuid,center uuid,account uuid,auth_id uuid,session_id uuid,ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';probe jsonb;
 target uuid;entity_id uuid;typ text;ver bigint;entity_state text;members uuid[];item jsonb;at timestamptz:=clock_timestamp();
begin
 if center is null then perform private.fail('VALIDATION_FAILED');end if;
 if op not in ('collection_record_v1','reservation_capacity_override_v1','student_credit_refund_v1','student_credit_offset_v1','debt_adjust_v1','sale_refund_preview_v1')
  or r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;
 probe:=jsonb_build_object('client_api_version',1,'request_id',r->'request_id','org_id',org,'center_id',center)||k;
 -- The capacity authorizer requires a reason but does not record it. This
 -- internal label is never persisted or presented as a user's command reason.
 if op='reservation_capacity_override_v1' then probe:=probe||jsonb_build_object('reason','Read action authority');end if;
 perform private.p06_original_authorize(op,probe,auth_id,session_id,ids);
 if op='sale_refund_preview_v1' then
  select s.id,s.person_id,s.version,s.state into entity_id,target,ver,entity_state from core.sales s where s.org_id=org and s.center_id=center and s.id=(k->>'sale_id')::uuid;typ:='sales';
 elsif op in ('debt_adjust_v1','student_credit_offset_v1') then
  select d.id,d.person_id,d.version,d.state into entity_id,target,ver,entity_state from core.debts d where d.org_id=org and d.center_id=center and d.id=(k->>'debt_id')::uuid;typ:='debts';
  if op='student_credit_offset_v1' and not coalesce(private.p07_same_person(org,target,(k->>'person_id')::uuid),false) then perform private.fail('NOT_FOUND');end if;
 elsif op='reservation_capacity_override_v1' then
  select s.id,s.version,s.state into entity_id,ver,entity_state from core.sessions s where s.org_id=org and s.center_id=center and s.id=(k->>'session_id')::uuid;
  target:=(k->>'person_id')::uuid;typ:='sessions';
 else
  target:=(k->>'person_id')::uuid;
  select p.id,p.version,p.state into entity_id,ver,entity_state from core.people p where p.org_id=org and p.id=target;typ:='people';
 end if;
 if entity_id is null or target is null then perform private.fail('NOT_FOUND');end if;
 members:=private.p07_person_members(org,target);
 if cardinality(members)=0 then perform private.fail('NOT_FOUND');end if;
 -- Person-only actions have no source transaction to establish center scope.
 -- Keep the finance reader's relationship boundary and canonical self exception.
 if op in ('collection_record_v1','student_credit_refund_v1','reservation_capacity_override_v1')
  and not coalesce(private.p07_same_person(org,target,private.person_for(org,account)),false) and not exists(
  select 1 from core.center_relationships x where x.org_id=org and x.center_id=center and x.person_id=any(members)
 ) then perform private.fail('NOT_FOUND');end if;
 if k->>'source_sale_id' is not null and not exists(
  select 1 from core.sales s where s.org_id=org and s.id=(k->>'source_sale_id')::uuid and s.person_id=any(members)
 ) then perform private.fail('NOT_FOUND');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type',typ,'id',entity_id) then perform private.fail('NOT_FOUND');end if;
 item:=jsonb_build_object('operation',op,'entity',jsonb_build_object('type',typ,'id',entity_id),'exists',true,'state',entity_state,
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',typ,'id',entity_id),'version',ver)),
  'as_of',at,'current',jsonb_build_object('operation',op,'values',k));
 return private.p06_page(jsonb_build_array(item),r->'page',md5(jsonb_build_object('account',account,'request',r-'request_id'-'page')::text),at);
end$$;
revoke all on function private.action_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.action_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]) to service_role;
do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
begin
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Action discovery dispatch anchor drift';end if;
 execute replace(body,anchor,$a$ if p_operation='management_state_get_v1' and r->>'operation' in
 ('collection_record_v1','reservation_capacity_override_v1','student_credit_refund_v1','student_credit_offset_v1','debt_adjust_v1','sale_refund_preview_v1') then
  out:=private.action_management_page(r,org,center,actor.id,p_actor_auth_id,p_session_id,p_ids);
  return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||anchor);
end$patch$;
notify pgrst,'reload schema';
commit;
