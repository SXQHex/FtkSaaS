begin;
create or replace function private.center_accessible(org uuid,center uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from core.centers c join core.saas_subscriptions s on s.org_id=c.org_id join core.saas_plan_versions p on p.id=s.plan_version_id left join private.p07_subscription_scope x on x.subscription_id=s.id
 where c.org_id=org and c.id=center and c.state='active' and (p.name='business' or c.id=coalesce(x.kept_center_id,(select id from core.centers where org_id=org and state='active' order by created_at,id limit 1))))
$$;
create or replace function private.assert_center(org uuid,center uuid) returns void language plpgsql stable set search_path='' as $$
begin if not exists(select 1 from core.centers where org_id=org and id=center and state='active') then perform private.fail('NOT_FOUND');end if;if not private.center_accessible(org,center) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;end$$;
create function private.p07_subscription_management(r jsonb,org uuid,actor uuid,platform bool) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.saas_subscriptions;c core.saas_change_requests;op text:=r->>'operation';vals jsonb:='{}';id uuid;typ text;v bigint;state text;
begin
 if op='saas_grace_extend_v1' then if not platform then perform private.fail('FORBIDDEN');end if;
 elsif actor is distinct from (select owner_person_id from core.organizations where id=org) then perform private.fail('FORBIDDEN');end if;
 select * into s from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1;
 id:=s.id;typ:='saas_subscriptions';v:=s.version;state:=s.state;
 if op='subscription_change_cancel_v1' then
  select * into c from core.saas_change_requests where org_id=org and id=(r#>>'{entity,id}')::uuid;if c.id is null then perform private.fail('NOT_FOUND');end if;id:=c.id;typ:='saas_change_requests';v:=c.version;state:=c.state;vals:=jsonb_build_object('change_id',id);
 elsif op='subscription_renewal_set_v1' then vals:=jsonb_build_object('renew',not s.cancel_at_period_end);
 elsif op='saas_grace_extend_v1' then vals:=jsonb_build_object('until',s.grace_until);
 elsif op in ('subscription_upgrade_quote_v1','subscription_downgrade_request_v1') then
  if r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;vals:=r#>'{selector,key}';
  if not exists(select 1 from core.saas_plan_versions where id=(vals->>'target_plan_id')::uuid) then perform private.fail('NOT_FOUND');end if;
 else perform private.fail('FORBIDDEN');end if;
 if id is null then perform private.fail('NOT_FOUND');end if;
 if r?'entity' and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type',typ,'id',id) then perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('data',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('operation',op,'entity',jsonb_build_object('type',typ,'id',id),'exists',true,'state',state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',typ,'id',id),'version',v)),'as_of',clock_timestamp(),'current',jsonb_build_object('operation',op,'values',vals))),'next_cursor',null,'as_of',clock_timestamp()),'primary_id',id,'subject',typ);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;new text;ops text:=$o$'subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1','saas_grace_extend_v1'$o$;
begin
 old:=$a$ if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 worker anchor mismatch';end if;
 b:=replace(b,old,' if p_operation=''subscription_boundary_apply_v1'' then return private.p07_worker_execute(p_operation,r,p_ids);end if;'||E'\n'||old);
 old:=$a$p_operation in ('subscription_get_v1','saas_payment_submit_v1')$a$;
 if strpos(b,old)=0 then raise exception 'P07 owner billing closed anchor mismatch';end if;
 b:=replace(b,old,$a$p_operation in ('subscription_get_v1','saas_payment_submit_v1','subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1')$a$);
 old:='  mode:=private.access_mode(org);';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 due guard anchor mismatch';end if;
 -- Until the fenced boundary job executes, never expose the expired old plan.
 new:=$a$  if exists(select 1 from core.saas_change_requests where org_id=org and state='scheduled' and effective_at<=clock_timestamp()) and p_operation not in ('subscription_get_v1','subscription_change_cancel_v1','saas_grace_extend_v1') then perform private.fail('OPERATION_IN_PROGRESS');end if;
$a$||old;b:=replace(b,old,new);
 old:=$a$elsif perm_code='management.inspect' then$a$;if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 subscription management permission anchor mismatch';end if;
 b:=replace(b,old,'elsif perm_code=''management.inspect'' and r->>''operation'' in ('||ops||') then perform private.p07_subscription_management(r,org,person,platform);'||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 subscription management domain anchor mismatch';end if;
 b:=replace(b,old,'if p_operation=''management_state_get_v1'' and r->>''operation'' in ('||ops||') then terms:=private.p07_subscription_management(r,org,person,platform);else '||old||'end if;');
 old:=' -- DOMAIN_CASES';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 subscription command anchor mismatch';end if;
 b:=replace(b,old,' when '||ops||' then terms:=private.p07_subscription_command(p_operation,r,org,actor.id,operation_id,p_ids);out:=terms->''data'';record_id:=(terms->>''primary_id'')::uuid;version_n:=(terms->>''version'')::bigint;subject:=terms->>''subject'';'||E'\n'||old);
 old:=substring(b from strpos(b,$a$ when 'saas_payment_submit_v1' then$a$) for strpos(b,$a$ when 'subscription_get_v1' then$a$)-strpos(b,$a$ when 'saas_payment_submit_v1' then$a$));
 if old is null or length(old)<100 then raise exception 'P07 payment cases anchor mismatch';end if;
 b:=replace(b,old,$a$ when 'saas_payment_submit_v1','saas_payment_verify_v1' then
  if r->>'quote_id' is not null or exists(select 1 from private.p07_payment_quotes x join core.saas_payment_verifications p on p.id=x.payment_id where p.org_id=org and x.payment_id=(r->>'payment_id')::uuid) then
   terms:=private.p07_subscription_command(p_operation,r,org,actor.id,operation_id,p_ids);
  else terms:=private.p07_normal_payment(p_operation,r,org,actor.id,operation_id,p_ids);end if;
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;version_n:=(terms->>'version')::bigint;subject:=terms->>'subject';
$a$);
 old:=$a$'pending_change',null$a$;if strpos(b,old)=0 then raise exception 'P07 pending subscription read anchor mismatch';end if;
 b:=replace(b,old,$a$'pending_change',(select jsonb_build_object('type','saas_change_requests','id',id) from core.saas_change_requests where org_id=org and state='scheduled' order by created_at desc,id desc limit 1)$a$);
 b:=replace(b,$a$'period_start',sub.starts_at$a$,$a$'period_start',case when sub.state='pending_payment' then null else private.p07_period_start(sub) end$a$);
 execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
