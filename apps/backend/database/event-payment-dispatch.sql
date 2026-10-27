create or replace function private.execute_operation(p_operation text,p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare
 r jsonb:=p_request; org uuid:=(r->>'org_id')::uuid;center uuid:=(r->>'center_id')::uuid;actor core.accounts;usr auth.users;
 person uuid;owner uuid;cm bool:=false;org_reader bool:=false;platform bool:=false;perm_code text;billing text;feature text;mode text;
 trace uuid:=private.new_id(p_ids,1);record_id uuid:=private.new_id(p_ids,2);operation_id uuid:=private.new_id(p_ids,3);idx int:=20;
 version_n bigint:=1;subject text:='organizations';out jsonb;entry jsonb;row_record record;target uuid;
 receipt core.operation_receipts;payload_digest text;key_digest text;mutable bool:=r ? 'operation_key';linked uuid;
 e core.events; reg core.event_registrations;ses core.sessions;sale core.sales;pv core.product_versions;sub core.saas_subscriptions;plan core.saas_plan_versions;inv core.invitations;
 before_count bigint;limit_n bigint;available bigint;amount bigint;remaining bigint;part bigint;cash_id uuid;selected uuid;policy uuid;
 prep core.event_payment_preparations;debt core.debts;
 preview core.previews;preview_data private.preview_payloads;dependencies jsonb;token text;scope_hash text;
 start_at timestamptz;end_at timestamptz;terms jsonb;do_consume bool;role_name text;state_name text;count_n int;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
  and coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;
 select * into usr from auth.users where id=p_actor_auth_id and deleted_at is null and (banned_until is null or banned_until<now());
 if not found or usr.email_confirmed_at is null then perform private.fail('AUTH_REQUIRED');end if;
 perform 1 from auth.sessions where id=p_session_id and user_id=p_actor_auth_id and (not_after is null or not_after>now());
 if not found then perform private.fail('SESSION_REVOKED');end if;
 insert into core.accounts(id,auth_user_id,state) values(private.new_id(p_ids,10),usr.id,'active') on conflict(auth_user_id) do nothing;
 select * into actor from core.accounts where auth_user_id=usr.id for share;
 if actor.state<>'active' then perform private.fail('SESSION_REVOKED');end if;
 platform:=exists(select 1 from private.platform_operators where auth_user_id=usr.id);
 select o.permission,o.billing_class into perm_code,billing from private.runtime_operations o where o.name=p_operation;
 if not found then perform private.fail('NOT_FOUND');end if;
 if p_operation='account_access_accept_v1' then
  select * into inv from core.invitations where token_hash=encode(extensions.digest(r->>'token','sha256'),'hex');
  if not found then perform private.fail('INVITATION_UNAVAILABLE');end if;org:=inv.org_id;center:=inv.center_id;
 end if;
 if org is not null then
  -- Shared access gate. Revocations and commands take the same organization lock.
  select owner_person_id into owner from core.organizations where id=org for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  person:=private.person_for(org,actor.id);
  if person is null and not platform and p_operation<>'account_access_accept_v1' then perform private.fail('NOT_FOUND');end if;
  if center is null and r ? 'preparation_id' then select center_id into center from core.event_payment_preparations where org_id=org and id=(r->>'preparation_id')::uuid;end if;
  if center is null and r ? 'debt_id' then select center_id into center from core.debts where org_id=org and id=(r->>'debt_id')::uuid;end if;
  if center is null and r ? 'event_id' then select center_id into center from core.events where org_id=org and id=(r->>'event_id')::uuid;end if;
  if center is null and r ? 'registration_id' then select center_id into center from core.event_registrations where org_id=org and id=(r->>'registration_id')::uuid;end if;
  if center is null and r ? 'session_id' then select center_id into center from core.sessions where org_id=org and id=(r->>'session_id')::uuid;end if;
  if center is null and r ? 'assignment_id' then select center_id into center from core.event_assignments where org_id=org and id=(r->>'assignment_id')::uuid;end if;
  if center is null and r ? 'reservation_id' then select center_id into center from core.reservations where org_id=org and id=(r->>'reservation_id')::uuid;end if;
  if p_operation='role_assign_v1' then
   center:=(r#>>'{scope,center_id}')::uuid;
  end if;
  if center is null and r ? 'preview' then select (v.payload->>'center_id')::uuid into center from private.preview_payloads v join core.previews p on p.id=v.preview_id where p.org_id=org and p.actor_account_id=actor.id and p.id=(r#>>'{preview,id}')::uuid;end if;
  cm:=center is not null and private.is_manager(org,person,center);org_reader:=private.is_org_reader(org,person);
  if center is not null then perform private.assert_center(org,center);end if;
  mode:=private.access_mode(org);
  if not platform and p_operation not in ('account_access_accept_v1') then
   if mode='bootstrap' and p_operation not in ('organization_get_v1','subscription_get_v1','saas_payment_submit_v1','center_create_v1','centers_list_v1','center_manager_assign_v1','manager_self_assign_center_v1') then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
   if mode='closed' and not (person=owner and p_operation in ('subscription_get_v1','saas_payment_submit_v1')) then perform private.fail('SERVICE_UNAVAILABLE');end if;
   if mode='grace' and billing in ('new','config','sale','program') then perform private.fail('BILLING_OPERATION_RESTRICTED');end if;
  end if;
  if mode not in ('bootstrap','closed') then
   for feature in select unnest(o.features) from private.runtime_operations o where o.name=p_operation loop perform private.require_feature(org,feature);end loop;
  end if;
 end if;
 -- Central permission mapping; no user_metadata or request actor/role can grant access.
 if perm_code in ('platform.owner','saas.operator') then if not platform then perform private.fail('FORBIDDEN');end if;
 elsif p_operation in ('account_get_v1','organizations_list_v1','account_access_accept_v1') then null;
 elsif perm_code in ('org.owner','subscription.owner') then if person is distinct from owner then perform private.fail('FORBIDDEN');end if;
 elsif perm_code in ('org.manage','org.configuration') then if not org_reader then perform private.fail('FORBIDDEN');end if;
 elsif perm_code='center.manager.assign' then
  if person is distinct from owner then perform private.fail('FORBIDDEN');end if;
  if mode='bootstrap' and (r->>'person_id')::uuid is distinct from person then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
 elsif perm_code in ('center.manage','schedule.manage','product.manage','entitlement.correct','finance.refund','event.manage','event.close','attendance.correct','attendance.block') then if not cm then perform private.fail('FORBIDDEN');end if;
 elsif perm_code in ('person.manage','person.activate','sale.write','finance.collect') then
  if not cm and not (private.has_role(org,person,'staff',center) and exists(select 1 from core.permission_overrides where org_id=org and center_id=center and person_id=person and permission=perm_code and enabled)) then
   -- CM only until a matching explicit staff grant exists.
   if not cm then perform private.fail('FORBIDDEN');end if;
  end if;
 elsif perm_code='invite.student' then
  if not private.can_invite(org,person,center,(r->>'person_id')::uuid) then perform private.fail('FORBIDDEN');end if;
 elsif perm_code in ('event.register','reservation.write') then
  if not cm and (r->>'person_id')::uuid is distinct from person and not exists(select 1 from core.permission_overrides where org_id=org and center_id=center and person_id=person and permission='reservation.write' and enabled and private.has_role(org,person,'staff',center)) then
   -- Cancellation resolves the target person in its case branch; no target supplied is not broad access.
   if p_operation not in ('event_registration_cancel_v1','reservation_cancel_v1') then perform private.fail('FORBIDDEN');end if;
  end if;
 elsif perm_code='event.attendance' then
  if not cm and not private.event_assignee(org,person,coalesce((r->>'event_id')::uuid,(select event_id from core.event_registrations where org_id=org and id=(r->>'registration_id')::uuid))) then perform private.fail('FORBIDDEN');end if;
 elsif perm_code in ('org.read','person.read','schedule.read') then
  if person is null then perform private.fail('NOT_FOUND');end if;
 else perform private.fail('FORBIDDEN');
 end if;
 if mutable then
  payload_digest:=encode(extensions.digest((r-'operation_key'-'request_id')::text,'sha256'),'hex');key_digest:=encode(extensions.digest(r->>'operation_key','sha256'),'hex');
  insert into core.operation_receipts(id,org_id,actor_account_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at)
   values(operation_id,org,actor.id,actor.id::text,p_operation,key_digest,payload_digest,'in_progress',now()+interval '30 days')
   on conflict do nothing;
  select * into receipt from core.operation_receipts where (org_id is not distinct from org or p_operation='organization_create_v1') and actor_fingerprint=actor.id::text and operation=p_operation and key_hash=key_digest for update;
  if receipt.payload_hash<>payload_digest then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
  operation_id:=receipt.id;
  if receipt.state='succeeded' then
   if receipt.result_expires_at<now() then perform private.fail('OPERATION_RESULT_EXPIRED');end if;
   out:=receipt.result;
   if out->'data' ? 'replayed' then out:=jsonb_set(out,'{data,replayed}','true');end if;
   return jsonb_set(out,'{trace_id}',to_jsonb(trace));
  end if;
 end if;
 case p_operation
 when 'account_get_v1' then
  out:=jsonb_build_object('id',actor.id,'state',actor.state,'display_name',coalesce(usr.raw_user_meta_data->>'display_name',usr.email));
 when 'organizations_list_v1' then
  out:=jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'state',o.state,'access_mode',private.access_mode(o.id))) from core.account_links l join core.organizations o on o.id=l.org_id where l.account_id=actor.id and l.state='active'),'[]'::jsonb),'next_cursor',null);
 when 'organization_create_v1' then
  select * into row_record from core.accounts a join auth.users u on u.id=a.auth_user_id where a.id=coalesce((r->>'verified_account_id')::uuid,(r->>'replacement_verified_account_id')::uuid) and a.state='active' and u.email_confirmed_at is not null;
  if not found then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
  if not exists(select 1 from core.saas_plan_versions where id=(r->>'initial_plan_id')::uuid) then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  org:=record_id;owner:=private.new_id(p_ids,11);
  insert into core.organizations(id,org_id,name,owner_person_id,state) values(org,org,r->>'name',owner,'active');
  insert into core.people(id,org_id,display_name,state) values(owner,org,coalesce(row_record.raw_user_meta_data->>'display_name',row_record.email),'active');
  insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values(private.new_id(p_ids,12),org,(r->>'verified_account_id')::uuid,owner,'active',now());
  insert into core.saas_subscriptions(id,org_id,plan_version_id,state,cancel_at_period_end) values(private.new_id(p_ids,13),org,(r->>'initial_plan_id')::uuid,'pending_payment',false);
  subject:='organizations';
 when 'organization_get_v1' then
  if not org_reader and not exists(select 1 from core.role_assignments where org_id=org and person_id=person and role='center_manager' and state='active') then perform private.fail('FORBIDDEN');end if;
  select jsonb_build_object('id',id,'name',name,'state',state,'access_mode',private.access_mode(org)) into out from core.organizations where id=org;
 when 'platform_owner_set_v1','platform_owner_remove_v1' then
  if p_operation='platform_owner_remove_v1' and r->>'replacement_verified_account_id' is null then perform private.fail('OWNER_TRANSFER_REQUIRED');end if;
  select a.id as account_id,u.email,u.raw_user_meta_data into row_record from core.accounts a join auth.users u on u.id=a.auth_user_id where a.id=coalesce((r->>'verified_account_id')::uuid,(r->>'replacement_verified_account_id')::uuid) and a.state='active' and u.email_confirmed_at is not null;
  if not found then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
  selected:=private.person_for(org,row_record.account_id);
  if selected is null then
   selected:=record_id;
   insert into core.people(id,org_id,display_name,state) values(selected,org,coalesce(row_record.raw_user_meta_data->>'display_name',row_record.email),'active');
   insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values(private.new_id(p_ids,11),org,row_record.account_id,selected,'active',now());
  end if;
  update core.organizations set owner_person_id=selected,version=version+1 where id=org returning version into version_n;record_id:=org;subject:='organizations';
 when 'center_create_v1' then
  if not exists(select 1 from pg_timezone_names where name=r->>'timezone') then perform private.fail('VALIDATION_FAILED');end if;
  limit_n:=private.plan_limit(org,'centers');if limit_n is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  if (select count(*) from core.centers where org_id=org and state='active')>=limit_n then perform private.fail('PLAN_LIMIT_REACHED');end if;
  insert into core.centers(id,org_id,center_id,name,timezone,state) values(record_id,org,record_id,r->>'name',r->>'timezone','active');subject:='centers';
 when 'centers_list_v1' then
  out:=jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'timezone',c.timezone,'state',c.state,'accessible',true)) from core.centers c where c.org_id=org and (org_reader or private.is_manager(org,person,c.id) or exists(select 1 from core.center_relationships where org_id=org and center_id=c.id and person_id=person and state='active'))),'[]'::jsonb),'next_cursor',null);
 when 'center_manager_assign_v1','manager_self_assign_center_v1','org_manager_assign_v1','role_assign_v1' then
  if p_operation='manager_self_assign_center_v1' then center:=(r->>'target_center_id')::uuid;target:=person;role_name:='center_manager';perform private.assert_center(org,center);
  elsif p_operation='center_manager_assign_v1' then target:=(r->>'person_id')::uuid;role_name:='center_manager';
  elsif p_operation='org_manager_assign_v1' then target:=(r->>'person_id')::uuid;role_name:='org_manager';center:=null;
  else target:=(r->>'person_id')::uuid;role_name:=r->>'role';center:=coalesce((r#>>'{scope,center_id}')::uuid,center);
   if role_name not in ('staff','instructor','assistant','student') then perform private.fail('FORBIDDEN');end if;
  end if;
  select id into linked from core.account_links where org_id=org and person_id=target and state='active' and verified_at is not null;
  if linked is null then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
  if role_name='center_manager' and center is null then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values(record_id,org,target,role_name,center,'active',linked);
  subject:='role_assignments';
 when 'center_manager_revoke_v1','org_manager_revoke_v1','role_revoke_v1' then
  if p_operation='role_revoke_v1' then
   update core.role_assignments set state='inactive',version=version+1 where org_id=org and id=(r->>'assignment_id')::uuid and scope_center_id=center and role in ('staff','instructor','assistant','student') and version=(r->>'expected_version')::bigint and state='active' returning id,version into record_id,version_n;
  else
   role_name:=case when p_operation='org_manager_revoke_v1' then 'org_manager' else 'center_manager' end;
   update core.role_assignments set state='inactive',version=version+1 where org_id=org and person_id=(r->>'person_id')::uuid and role=role_name and scope_center_id is not distinct from (case when role_name='org_manager' then null else center end) and state='active' and version=(r->>'expected_version')::bigint returning id,version into record_id,version_n;
  end if;
  if not found then perform private.fail('VERSION_CONFLICT');end if;subject:='role_assignments';
 when 'discipline_save_v1' then
  if r->>'discipline_id' is null then insert into core.disciplines(id,org_id,name,state) values(record_id,org,r->>'name',r->>'state');
  else
   record_id:=(r->>'discipline_id')::uuid;
   update core.disciplines set name=r->>'name',state=r->>'state',version=version+1 where org_id=org and id=record_id and version=(r->>'expected_version')::bigint returning version into version_n;
   if not found then perform private.fail('VERSION_CONFLICT');end if;
  end if;subject:='disciplines';
 when 'center_discipline_set_v1' then
  if not exists(select 1 from core.disciplines where org_id=org and id=(r->>'discipline_id')::uuid and state='active') then perform private.fail('NOT_FOUND');end if;
  select id into selected from core.center_disciplines where org_id=org and center_id=center and discipline_id=(r->>'discipline_id')::uuid;
  if found then
   update core.center_disciplines set state=r->>'state',version=version+1 where id=selected and version=(r->>'expected_version')::bigint returning version into version_n;
   if not found then perform private.fail('VERSION_CONFLICT');end if;record_id:=selected;
  else
   if r ? 'expected_version' then perform private.fail('VERSION_CONFLICT');end if;
   insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values(record_id,org,center,(r->>'discipline_id')::uuid,r->>'state');
  end if;subject:='center_disciplines';
 when 'person_create_v1' then
  insert into core.people(id,org_id,display_name,state) values(record_id,org,r->>'display_name','active');
  for entry in select * from jsonb_array_elements(r->'contacts') loop
   insert into core.person_contacts(id,org_id,person_id,kind,value) values(private.new_id(p_ids,idx),org,record_id,entry->>'kind',entry->>'value');idx:=idx+1;
  end loop;subject:='people';
 when 'student_activate_v1' then
  target:=(r->>'person_id')::uuid;
  if not exists(select 1 from core.people where org_id=org and id=target and state='active') then perform private.fail('NOT_FOUND');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and person_id=target and kind='student' and state='active') then
   limit_n:=private.plan_limit(org,'active_students');if limit_n is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   if (select count(distinct person_id) from core.center_relationships where org_id=org and kind='student' and state='active')>=limit_n then perform private.fail('PLAN_LIMIT_REACHED');end if;
  end if;
  if exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind='student' and state='active') then perform private.fail('INVALID_STATE_TRANSITION');end if;
  insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values(record_id,org,center,target,'student','active',now());subject:='center_relationships';
 when 'account_access_send_v1' then
  target:=(r->>'person_id')::uuid;
  if not exists(select 1 from core.people where org_id=org and id=target) then perform private.fail('NOT_FOUND');end if;
  if exists(select 1 from core.account_links where org_id=org and person_id=target and state='active') then perform private.fail('ACCOUNT_ALREADY_LINKED');end if;
  select value into token from core.person_contacts where org_id=org and person_id=target and kind='email' order by created_at,id limit 1;
  if token is null then perform private.fail('VALIDATION_FAILED');end if;
  update core.invitations set state='revoked',version=version+1 where org_id=org and person_id=target and state='pending';
  insert into core.invitations(id,org_id,center_id,person_id,email,token_hash,inviter_account_id,expires_at,state)
   values(record_id,org,center,target,token,p_aux->>'token_hash',actor.id,now()+interval '7 days','pending');
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at)
   values(private.new_id(p_ids,15),org,'account_invitation',record_id::text,'pending',0,now());
  insert into private.invitation_deliveries(invitation_id,job_id,recipient,sealed_token)
   values(record_id,private.new_id(p_ids,15),token,p_aux->>'sealed_token');
  out:=jsonb_build_object('job_id',private.new_id(p_ids,15),'state','pending');subject:='invitations';
 when 'account_access_accept_v1' then
  select * into inv from core.invitations where id=inv.id for update;
  if inv.state<>'pending' or inv.expires_at<=now() or lower(inv.email)<>lower(usr.email) then perform private.fail('INVITATION_UNAVAILABLE');end if;
  selected:=private.person_for(org,inv.inviter_account_id);
  if not private.can_invite(org,selected,inv.center_id,inv.person_id) then perform private.fail('INVITATION_UNAVAILABLE');end if;
  if exists(select 1 from core.account_links where org_id=org and (account_id=actor.id or person_id=inv.person_id) and state='active') then perform private.fail('ACCOUNT_LINK_CONFLICT');end if;
  insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values(record_id,org,actor.id,inv.person_id,'active',now());
  update core.invitations set state='accepted',version=version+1 where id=inv.id;person:=inv.person_id;subject:='account_links';
 when 'saas_payment_submit_v1' then
  select * into sub from core.saas_subscriptions where org_id=org order by created_at desc limit 1;
  if (r->>'amount_minor')::bigint<=0 then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'quote_id' is not null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  insert into core.saas_payment_verifications(id,org_id,amount_minor,currency,occurred_at,state,reference,period_key)
   values(record_id,org,(r->>'amount_minor')::bigint,r->>'currency',(r->>'occurred_at')::timestamptz,'pending',r->>'reference',coalesce(sub.period_end,'epoch'::timestamptz));subject:='saas_payment_verifications';
 when 'saas_payment_verify_v1' then
  select * into sub from core.saas_subscriptions where org_id=org order by created_at desc limit 1 for update;
  select * into plan from core.saas_plan_versions where id=sub.plan_version_id;
  if not exists(select 1 from core.saas_payment_verifications where org_id=org and id=(r->>'payment_id')::uuid and state='pending' and currency=plan.currency and period_key=coalesce(sub.period_end,'epoch'::timestamptz)) then perform private.fail('INVALID_STATE_TRANSITION');end if;
  update core.saas_payment_verifications set state=case when (r->>'accepted')::bool then 'accepted' else 'rejected' end,verified_at=now(),verified_by=person,version=version+1 where org_id=org and id=(r->>'payment_id')::uuid;
  select coalesce(sum(amount_minor),0) into amount from core.saas_payment_verifications where org_id=org and state='accepted' and period_key=coalesce(sub.period_end,'epoch'::timestamptz);
  if amount>=plan.price_minor then
   start_at:=case when sub.starts_at is null then now() else sub.period_end end;
   end_at:=start_at+case when plan.period='monthly' then interval '1 month' else interval '1 year' end;
   update core.saas_subscriptions set starts_at=coalesce(starts_at,start_at),period_end=end_at,grace_until=end_at+interval '7 days',state='active',version=version+1 where id=sub.id;
  end if;
  record_id:=(r->>'payment_id')::uuid;subject:='saas_payment_verifications';
 when 'subscription_get_v1' then
  select * into sub from core.saas_subscriptions where org_id=org order by created_at desc limit 1;
  select * into plan from core.saas_plan_versions where id=sub.plan_version_id;
  out:=jsonb_build_object('state',case when private.access_mode(org)='closed' and sub.state='active' then 'suspended' when private.access_mode(org)='grace' then 'grace' else sub.state end,'plan',plan.name,'period_start',sub.starts_at,'period_end',sub.period_end,'grace_until',sub.grace_until,'cancel_at_period_end',sub.cancel_at_period_end,'pending_change',null,'limits',plan.limits,'usage',jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('key','active_students','value',(select count(distinct person_id) from core.center_relationships where org_id=org and kind='student' and state='active')),jsonb_build_object('key','centers','value',(select count(*) from core.centers where org_id=org and state='active')),jsonb_build_object('key','instructors','value',(select count(distinct person_id) from core.center_relationships where org_id=org and kind='instructor' and state='active')))));
 when 'product_publish_v1' then
  terms:=r->'terms';
  if terms->>'kind'='credits' and coalesce((terms->>'credits')::int,0)<=0 then perform private.fail('VALIDATION_FAILED');end if;
  if terms->>'kind'='timed' then perform private.require_feature(org,'F16');if terms->>'credits' is not null then perform private.fail('VALIDATION_FAILED');end if;end if;
  if jsonb_array_length(terms->'scopes')=0 then perform private.fail('VALIDATION_FAILED');end if;
  selected:=coalesce((r->>'product_id')::uuid,private.new_id(p_ids,11));
  if r->>'product_id' is null then insert into core.products(id,org_id,center_id,name,state) values(selected,org,center,terms->>'name','active');
  elsif not exists(select 1 from core.products where org_id=org and center_id=center and id=selected) then perform private.fail('NOT_FOUND');end if;
  insert into core.product_versions(id,org_id,center_id,product_id,kind,booking_mode,credits,price_minor,currency,refund_method,freeze_terms,quota,effective_at,refund_terms)
   values(record_id,org,center,selected,terms->>'kind',terms->>'booking_mode',(terms->>'credits')::int,(terms->>'price_minor')::bigint,terms->>'currency',terms#>>'{refund,method}',terms->'freeze',nullif(terms->'quota','null'),now(),terms->'refund');
  for entry in select * from jsonb_array_elements(terms->'scopes') loop
   if entry->>'center_id' is not null and not exists(select 1 from core.centers where org_id=org and id=(entry->>'center_id')::uuid) then perform private.fail('NOT_FOUND');end if;
   if entry->>'discipline_id' is not null and not exists(select 1 from core.disciplines where org_id=org and id=(entry->>'discipline_id')::uuid) then perform private.fail('NOT_FOUND');end if;
   insert into core.product_scopes(id,org_id,product_version_id,scope_kind,center_id,discipline_id,class_id,event_id,usage_targets)
    values(private.new_id(p_ids,idx),org,record_id,entry->>'scope_kind',(entry->>'center_id')::uuid,(entry->>'discipline_id')::uuid,(entry->>'class_id')::uuid,(entry->>'event_id')::uuid,array(select jsonb_array_elements_text(entry->'usage_targets')));
   idx:=idx+1;
  end loop;subject:='product_versions';
 when 'sale_preview_v1' then
  target:=(r->>'person_id')::uuid;
  if not exists(select 1 from core.people where org_id=org and id=target) then perform private.fail('NOT_FOUND');end if;
  select * into pv from core.product_versions where org_id=org and center_id=center and id=(r->>'product_version_id')::uuid;
  if not found then perform private.fail('NOT_FOUND');end if;
  if (r->>'end_date')::date<=(r->>'start_date')::date then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'net_minor' is not null and (r->>'net_minor')::bigint<>pv.price_minor then perform private.fail('FORBIDDEN');end if;
  scope_hash:=encode(extensions.digest(r::text,'sha256'),'hex');token:=p_aux->>'token';
  dependencies:=jsonb_build_object('versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','product_versions','id',pv.id),'version',coalesce(pv.version,1))),'policy_hashes','[]'::jsonb,'permission_hash',actor.id::text);
  out:=jsonb_build_object('id',record_id,'token',token,'scope_hash',scope_hash,'dependencies',dependencies,'effects','[]'::jsonb,'blockers','[]'::jsonb,'expires_at',now()+interval '15 minutes');
  insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(record_id,org,actor.id,'sale_apply_v1',scope_hash,dependencies,jsonb_build_object('effects',out->'effects','blockers',out->'blockers'),'current');
  insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(record_id,r,now()+interval '15 minutes',encode(extensions.digest(token,'sha256'),'hex'));
 when 'sale_apply_v1' then
  select * into preview from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid for update;
  select * into preview_data from private.preview_payloads where preview_id=preview.id;
  if preview.id is null or preview.state<>'current' or preview.actor_account_id<>actor.id or preview.operation<>p_operation or preview_data.expires_at<=now() or preview_data.token_hash<>encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') then perform private.fail('PREVIEW_STALE');end if;
  entry:=preview_data.payload;target:=(entry->>'person_id')::uuid;
  if (entry->>'center_id')::uuid is distinct from center then perform private.fail('PREVIEW_STALE');end if;
  select * into pv from core.product_versions where org_id=org and center_id=center and id=(entry->>'product_version_id')::uuid;
  if pv.id is null or coalesce(pv.version,1)<>(preview.dependencies#>>'{versions,0,version}')::bigint then perform private.fail('PREVIEW_STALE');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind='student' and state='active') then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  select timezone into token from core.centers where org_id=org and id=center;
  start_at:=(entry->>'start_date')::date::timestamp at time zone token;end_at:=(entry->>'end_date')::date::timestamp at time zone token;
  if to_char(start_at at time zone token,'YYYY-MM-DD HH24:MI')<>entry->>'start_date'||' 00:00'
    or to_char(end_at at time zone token,'YYYY-MM-DD HH24:MI')<>entry->>'end_date'||' 00:00'
    or (start_at-interval '1 hour') at time zone token=start_at at time zone token or (start_at+interval '1 hour') at time zone token=start_at at time zone token then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.sales(id,org_id,center_id,person_id,product_version_id,net_minor,currency,valid_from,valid_until,state,terms_hash,start_date,end_date,timezone,paid_days)
   values(record_id,org,center,target,pv.id,pv.price_minor,pv.currency,start_at,end_at,'active',preview.scope_hash,(entry->>'start_date')::date,(entry->>'end_date')::date,token,(entry->>'end_date')::date-(entry->>'start_date')::date);
  insert into core.entitlement_accounts(id,org_id,sale_id,person_id,state,balance_version) values(private.new_id(p_ids,11),org,record_id,target,'active',1);
  if pv.kind='credits' then insert into core.entitlement_movements(id,org_id,sale_id,person_id,kind,quantity,operation_id) values(private.new_id(p_ids,12),org,record_id,target,'grant',pv.credits,operation_id);end if;
  if pv.price_minor>0 then insert into core.debts(id,org_id,center_id,person_id,sale_id,amount_minor,currency,due_at,state) values(private.new_id(p_ids,13),org,center,target,record_id,pv.price_minor,pv.currency,now(),'open');end if;
  -- Existing eligible deficits settle consumed past first, then future reserved; original snapshots/earnings are untouched.
  for row_record in select d.*,s.starts_at from core.credit_deficits d join core.sessions s on s.org_id=d.org_id and s.id=d.session_id
   where d.org_id=org and d.person_id=target and d.state in ('consumed','reserved') and private.lesson_scope_matches(org,d.session_id,pv.id)
   order by case when d.state='consumed' then 0 else 1 end,s.starts_at,d.id for update of d loop
   if pv.kind<>'credits' or private.credit_available(org,record_id)<row_record.quantity then exit;end if;
   insert into core.entitlement_allocations(id,org_id,sale_id,reservation_id,quantity,state) values(private.new_id(p_ids,idx),org,record_id,row_record.reservation_id,row_record.quantity,case when row_record.state='consumed' then 'consumed' else 'reserved' end);
   insert into core.entitlement_movements(id,org_id,sale_id,person_id,reservation_id,kind,quantity,operation_id) values(private.new_id(p_ids,idx+1),org,record_id,target,row_record.reservation_id,case when row_record.state='consumed' then 'consume' else 'reserve' end,row_record.quantity,operation_id);
   update core.credit_deficits set state='settled',settled_sale_id=record_id,version=version+1 where id=row_record.id;idx:=idx+2;
  end loop;
  update core.previews set state='applied' where id=preview.id;subject:='sales';
 when 'collection_record_v1' then
  target:=(r->>'person_id')::uuid;remaining:=(r->>'amount_minor')::bigint;
  if not exists(select 1 from core.people where org_id=org and id=target) then perform private.fail('NOT_FOUND');end if;
  if r->>'debt_ids' is not null then
   for entry in select value from jsonb_array_elements(r->'debt_ids') loop
    select * into debt from core.debts where org_id=org and center_id=center and person_id=target and id=(entry#>>'{}')::uuid;
    if not found then perform private.fail('NOT_FOUND');end if;
    if debt.currency<>r->>'currency' then perform private.fail('CURRENCY_MISMATCH');end if;
   end loop;
  end if;
  insert into core.cash_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,occurred_at,reason,operation_id)
   values(record_id,org,center,target,'collection',remaining,r->>'currency',(r->>'occurred_at')::timestamptz,r->>'note',operation_id);
  for row_record in select * from core.debts d where d.org_id=org and d.center_id=center and d.person_id=target and d.currency=r->>'currency'
   and (r->>'debt_ids' is null or d.id=any(array(select x::uuid from jsonb_array_elements_text(r->'debt_ids') x))) order by due_at,created_at,id for update loop
   part:=least(remaining,private.debt_remaining(org,row_record.id));if part<=0 then continue;end if;
   insert into core.debt_allocations(id,org_id,center_id,debt_id,cash_movement_id,amount_minor) values(private.new_id(p_ids,idx),org,center,row_record.id,record_id,part);idx:=idx+1;
   remaining:=remaining-part;
   update core.debts set state=case when private.debt_remaining(org,row_record.id)=0 then 'settled' else 'open' end,version=version+1 where id=row_record.id;
   exit when remaining=0;
  end loop;
  if remaining>0 then insert into core.student_credit_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,source_cash_id) values(private.new_id(p_ids,idx),org,center,target,'surplus_add',remaining,r->>'currency',record_id);end if;
  subject:='cash_movements';
 when 'entitlements_get_v1' then
  target:=(r->>'person_id')::uuid;
  if target<>person and not org_reader and not cm then perform private.fail('FORBIDDEN');end if;
  out:=coalesce((select jsonb_agg(jsonb_build_object('sale_id',s.id,'person_id',s.person_id,'start_date',s.start_date,'end_date',s.end_date,'timezone',s.timezone,'state',a.state,
    'available',case when p.kind='credits' then greatest(0,private.credit_available(org,s.id)) else 0 end,
    'reserved',coalesce((select sum(quantity) from core.entitlement_allocations where org_id=org and sale_id=s.id and state='reserved'),0),
    'consumed',coalesce((select sum(private.credit_effect(org,m.id)*-1) from core.entitlement_movements m where m.org_id=org and m.sale_id=s.id and m.kind in ('consume','reverse')),0),
    'deficit',coalesce((select sum(quantity) from core.credit_deficits where org_id=org and person_id=target and state in ('reserved','consumed')),0),
    'deficit_scopes',coalesce((select jsonb_agg(jsonb_build_object('center_id',x.center_id,'discipline_id',x.discipline_id,'reserved',x.r,'consumed',x.c)) from
     (select center_id,discipline_id,coalesce(sum(quantity) filter(where state='reserved'),0) r,coalesce(sum(quantity) filter(where state='consumed'),0) c from core.credit_deficits where org_id=org and person_id=target and state in ('reserved','consumed') group by center_id,discipline_id) x),'[]'::jsonb),
    'quotas',coalesce((select jsonb_agg(jsonb_build_object('starts_at',q.starts_at,'ends_at',q.ends_at,'limit',q.limit_count,'reserved',q.reserved_count,'consumed',q.consumed_count)) from core.quota_buckets q where q.org_id=org and q.sale_id=s.id),'[]'::jsonb)))
   from core.sales s join core.entitlement_accounts a on a.org_id=s.org_id and a.sale_id=s.id join core.product_versions p on p.org_id=s.org_id and p.id=s.product_version_id where s.org_id=org and s.person_id=target),'[]'::jsonb);
 when 'class_save_v1' then
  if not exists(select 1 from core.center_disciplines where org_id=org and center_id=center and discipline_id=(r->>'discipline_id')::uuid and state='active') then perform private.fail('NOT_FOUND');end if;
  if r->>'class_id' is null then insert into core.classes(id,org_id,center_id,name,discipline_id,external_open,state) values(record_id,org,center,r->>'name',(r->>'discipline_id')::uuid,(r->>'external_open')::bool,'active');
  else record_id:=(r->>'class_id')::uuid;update core.classes set name=r->>'name',external_open=(r->>'external_open')::bool,version=version+1 where org_id=org and center_id=center and id=record_id and discipline_id=(r->>'discipline_id')::uuid and version=(r->>'expected_version')::bigint returning version into version_n;if not found then perform private.fail('VERSION_CONFLICT');end if;
  end if;subject:='classes';
 when 'session_create_v1' then
  if not exists(select 1 from core.center_disciplines where org_id=org and center_id=center and discipline_id=(r->>'discipline_id')::uuid and state='active') then perform private.fail('NOT_FOUND');end if;
  insert into core.sessions(id,org_id,center_id,discipline_id,class_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state)
   values(record_id,org,center,(r->>'discipline_id')::uuid,(r->>'class_id')::uuid,r->>'format',(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,(r#>>'{capacity,nominal}')::int,(r#>>'{capacity,maximum}')::int,'planned','open');
  for entry in select * from jsonb_array_elements(r->'assignments') loop
   if not exists(select 1 from core.people where org_id=org and id=(entry->>'person_id')::uuid) then perform private.fail('NOT_FOUND');end if;
   insert into core.session_assignments(id,org_id,center_id,session_id,person_id,duty,agreement_id,state) values(private.new_id(p_ids,idx),org,center,record_id,(entry->>'person_id')::uuid,entry->>'duty',(entry->>'agreement_id')::uuid,'active');idx:=idx+1;
  end loop;
  for entry in select * from jsonb_array_elements(r->'resources') loop
   if entry->>'kind'='room' and not exists(select 1 from core.rooms where org_id=org and center_id=center and id=(entry->>'id')::uuid) then perform private.fail('NOT_FOUND');end if;
   if entry->>'kind'='person' and not exists(select 1 from core.people where org_id=org and id=(entry->>'id')::uuid) then perform private.fail('NOT_FOUND');end if;
   if exists(select 1 from core.resource_bookings where org_id=org and resource_kind=entry->>'kind' and resource_id=(entry->>'id')::uuid and state='active' and starts_at<(r#>>'{interval,ends_at}')::timestamptz and ends_at>(r#>>'{interval,starts_at}')::timestamptz) then perform private.fail('RESOURCE_CONFLICT');end if;
   insert into core.resource_bookings(id,org_id,center_id,session_id,resource_kind,resource_id,starts_at,ends_at,state) values(private.new_id(p_ids,idx),org,center,record_id,entry->>'kind',(entry->>'id')::uuid,(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,'active');idx:=idx+1;
  end loop;subject:='sessions';
 when 'reservation_create_v1' then
  select * into ses from core.sessions where org_id=org and id=(r->>'session_id')::uuid and center_id=center for update;
  if not found then perform private.fail('NOT_FOUND');end if;if ses.state<>'planned' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  target:=(r->>'person_id')::uuid;
  if not cm and not private.staff_grant(org,person,center,'reservation.write') and (target<>person or r->>'mode'<>'flexible') then perform private.fail('FORBIDDEN');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind='student' and state='active') then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  if exists(select 1 from core.session_assignments where org_id=org and session_id=ses.id and person_id=target and duty='assistant' and state='active') then perform private.fail('ASSISTANT_PARTICIPANT_CONFLICT');end if;
  if exists(select 1 from core.reservations where org_id=org and session_id=ses.id and person_id=target and state='active') then perform private.fail('RESERVATION_EXISTS');end if;
  select (select count(*) from core.reservations where org_id=org and session_id=ses.id and state='active')+(select count(*) from core.seat_offers where org_id=org and session_id=ses.id and state='active' and expires_at>now()) into before_count;
  if before_count>=(case when r->>'mode'='priority' then ses.maximum else ses.nominal end) then perform private.fail('CAPACITY_FULL');end if;
  select id into policy from core.policy_versions where org_id=org and (scope_center_id is null or scope_center_id=center) and key=case when ses.format='private' then 'student_cancel_private' else 'student_cancel_group' end and effective_at<=now() order by mandatory desc,scope_center_id nulls last,effective_at desc,id limit 1;
  if policy is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  if ses.class_id is not null and not (select external_open from core.classes where org_id=org and id=ses.class_id) and not exists(select 1 from core.product_scopes sc join core.sales s on s.org_id=sc.org_id and s.product_version_id=sc.product_version_id where s.org_id=org and s.person_id=target and sc.class_id=ses.class_id and private.lesson_scope_matches(org,ses.id,s.product_version_id)) then perform private.fail('CLASS_ACCESS_DENIED');end if;
  insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id,source_sale_id)
   values(record_id,org,center,ses.id,target,r->>'mode','active',policy,(r->>'source_sale_id')::uuid);
  begin
   selected:=private.reserve_right(org,target,(r->>'source_sale_id')::uuid,ses.id,null,null,record_id,operation_id,p_ids,idx);
  exception when sqlstate 'P0001' then
   if SQLERRM<>'ENTITLEMENT_UNAVAILABLE' then raise;end if;
   perform private.reserve_negative(org,target,ses.id,record_id,p_ids,idx);selected:=(r->>'source_sale_id')::uuid;
  end;
  update core.reservations set source_sale_id=selected where id=record_id;subject:='reservations';
 when 'reservation_cancel_v1' then
  select * into row_record from core.reservations where org_id=org and center_id=center and id=(r->>'reservation_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if not cm and not private.staff_grant(org,person,center,'reservation.write') and row_record.person_id<>person then perform private.fail('FORBIDDEN');end if;
  if row_record.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if row_record.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  select * into ses from core.sessions where org_id=org and id=row_record.session_id;
  select value into terms from core.policy_versions where id=row_record.policy_version_id and org_id=org;
  do_consume:=case when now()<ses.starts_at-make_interval(mins=>coalesce((terms->>'cutoff_minutes')::int,0)) then terms->>'before_cutoff'='consume' else terms->>'after_cutoff'='consume' end;
  perform private.set_right_state(org,null,row_record.id,do_consume,operation_id,p_ids,idx,false);
  record_id:=row_record.id;update core.reservations set state='cancelled',cancellation_reason=r->>'reason',version=version+1 where id=record_id returning version into version_n;subject:='reservations';
 when 'event_save_v1' then
  if not exists(select 1 from pg_timezone_names where name=r->>'timezone') or (r#>>'{venue,kind}'='external' and not exists(select 1 from pg_timezone_names where name=r#>>'{venue,timezone}')) then perform private.fail('VALIDATION_FAILED');end if;
  if (r#>>'{capacity,nominal}')::bigint>(r#>>'{capacity,maximum}')::bigint or (r#>>'{interval,starts_at}')::timestamptz>=(r#>>'{interval,ends_at}')::timestamptz then perform private.fail('VALIDATION_FAILED');end if;
  if r#>>'{venue,kind}'='external' and (r#>>'{venue,name}' is null or r#>>'{venue,address}' is null) then perform private.fail('VALIDATION_FAILED');end if;
  if r#>>'{venue,kind}'='internal' and not exists(select 1 from core.rooms where org_id=org and center_id=center and id=(r#>>'{venue,room_id}')::uuid) then perform private.fail('NOT_FOUND');end if;
  for entry in select * from jsonb_array_elements(r->'discipline_ids') loop if not exists(select 1 from core.disciplines where org_id=org and id=(entry#>>'{}')::uuid) then perform private.fail('NOT_FOUND');end if;end loop;
  for entry in select * from jsonb_array_elements(r#>'{terms,allowed_product_version_ids}') loop if not exists(select 1 from core.product_versions where org_id=org and id=(entry#>>'{}')::uuid) then perform private.fail('NOT_FOUND');end if;end loop;
  if r->>'event_id' is null then
   if r ? 'expected_version' then perform private.fail('VERSION_CONFLICT');end if;
   insert into core.events(id,org_id,center_id,name,starts_at,ends_at,timezone,venue,nominal,maximum,state,terms,published,attendance_state,attendance_revision)
   values(record_id,org,center,r->>'name',(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,r->>'timezone',r->'venue',(r#>>'{capacity,nominal}')::int,(r#>>'{capacity,maximum}')::int,'draft',r->'terms',false,'open',0);
  else
   record_id:=(r->>'event_id')::uuid;select * into e from core.events where org_id=org and center_id=center and id=record_id for update;
   if not found then perform private.fail('NOT_FOUND');end if;
   if e.version<>(r->>'expected_version')::bigint or not r ? 'expected_version' then perform private.fail('VERSION_CONFLICT');end if;
   if e.state not in ('draft','published') or e.attendance_state<>'open' then perform private.fail('INVALID_STATE_TRANSITION');end if;
   update core.events set name=r->>'name',starts_at=(r#>>'{interval,starts_at}')::timestamptz,ends_at=(r#>>'{interval,ends_at}')::timestamptz,timezone=r->>'timezone',venue=r->'venue',nominal=(r#>>'{capacity,nominal}')::int,maximum=(r#>>'{capacity,maximum}')::int,terms=r->'terms',version=version+1 where id=record_id returning version into version_n;
   delete from core.event_disciplines where org_id=org and event_id=record_id;
   delete from core.resource_bookings where org_id=org and event_id=record_id;
   delete from core.event_assignments where org_id=org and event_id=record_id;
  end if;
  if (select count(*) from core.event_registrations where org_id=org and event_id=record_id and state='active')>(r#>>'{capacity,nominal}')::int then perform private.fail('CAPACITY_FULL');end if;
  for entry in select * from jsonb_array_elements(r->'discipline_ids') loop
   insert into core.event_disciplines(id,org_id,center_id,event_id,discipline_id) values(private.new_id(p_ids,idx),org,center,record_id,(entry#>>'{}')::uuid);idx:=idx+1;
  end loop;
  for entry in select * from jsonb_array_elements(r->'assignments') loop
   if not exists(select 1 from core.people where org_id=org and id=(entry->>'person_id')::uuid) then perform private.fail('NOT_FOUND');end if;
   if entry->>'duty'='assistant' and exists(select 1 from core.event_registrations where org_id=org and event_id=record_id and person_id=(entry->>'person_id')::uuid and state='active') then perform private.fail('ASSISTANT_PARTICIPANT_CONFLICT');end if;
   if exists(select 1 from core.resource_bookings where org_id=org and resource_kind='person' and resource_id=(entry->>'person_id')::uuid and state='active' and starts_at<(r#>>'{interval,ends_at}')::timestamptz and ends_at>(r#>>'{interval,starts_at}')::timestamptz) then perform private.fail('RESOURCE_CONFLICT');end if;
   insert into core.event_assignments(id,org_id,center_id,event_id,person_id,duty,fee_minor,currency) values(private.new_id(p_ids,idx),org,center,record_id,(entry->>'person_id')::uuid,entry->>'duty',(entry->>'fee_minor')::bigint,entry->>'currency');
   insert into core.resource_bookings(id,org_id,center_id,event_id,resource_kind,resource_id,starts_at,ends_at,state) values(private.new_id(p_ids,idx+1),org,center,record_id,'person',(entry->>'person_id')::uuid,(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,'active');idx:=idx+2;
  end loop;
  -- Revalidate every existing allocation after the proposed atomic edit; never silently cancel it.
  for row_record in select a.*,er.person_id from core.entitlement_allocations a join core.event_registrations er on er.org_id=a.org_id and er.id=a.event_registration_id where er.org_id=org and er.event_id=record_id and er.state='active' and a.state='reserved' order by a.sale_id,a.id loop
   select * into sale from core.sales where org_id=org and id=row_record.sale_id;
   perform 1 from core.entitlement_accounts where org_id=org and sale_id=sale.id for update;
   if not private.event_package_scope_matches(org,record_id,sale.product_version_id) then perform private.fail('CLASS_ACCESS_DENIED');end if;
   if sale.state<>'active' or (r#>>'{interval,starts_at}')::timestamptz<sale.valid_from or (sale.valid_until is not null and (r#>>'{interval,starts_at}')::timestamptz>=sale.valid_until) then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;
   perform private.sync_quota(org,sale.id,(r#>>'{interval,starts_at}')::timestamptz,private.new_id(p_ids,idx));idx:=idx+1;
  end loop;
  if r#>>'{venue,kind}'='internal' then
   if exists(select 1 from core.resource_bookings where org_id=org and resource_kind='room' and resource_id=(r#>>'{venue,room_id}')::uuid and state='active' and starts_at<(r#>>'{interval,ends_at}')::timestamptz and ends_at>(r#>>'{interval,starts_at}')::timestamptz) then perform private.fail('RESOURCE_CONFLICT');end if;
   insert into core.resource_bookings(id,org_id,center_id,event_id,resource_kind,resource_id,starts_at,ends_at,state) values(private.new_id(p_ids,idx),org,center,record_id,'room',(r#>>'{venue,room_id}')::uuid,(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,'active');
  end if;subject:='events';
 when 'event_publish_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if e.state not in ('draft','published') then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if not exists(select 1 from core.event_assignments where org_id=org and event_id=e.id and duty in ('instructor','assistant')) then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  record_id:=e.id;update core.events set state='published',published=(r->>'published')::bool,version=version+1 where id=record_id returning version into version_n;subject:='events';
 when 'event_get_v1' then
  select * into e from core.events where org_id=org and id=(r->>'event_id')::uuid and center_id=center;
  if not found then perform private.fail('NOT_FOUND');end if;
  if not org_reader and not cm and not private.event_assignee(org,person,e.id) and not e.published and not exists(select 1 from core.event_registrations where org_id=org and event_id=e.id and person_id=person) then perform private.fail('NOT_FOUND');end if;
  perform private.assert_center(org,e.center_id);
  out:=private.event_projection(org,e.id,person,cm,org_reader);
  if cm then out:=out||jsonb_build_object('assignment_terms',coalesce((select jsonb_agg(jsonb_build_object('person_id',person_id,'duty',duty,'fee_minor',fee_minor::text,'currency',currency)) from core.event_assignments where org_id=org and event_id=e.id),'[]'::jsonb));end if;
 when 'event_list_v1' then
  if r#>>'{page,sort}' is not null and r#>>'{page,sort}'<>'starts_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
  scope_hash:=encode(extensions.digest((r-'request_id'-'page')::text,'sha256'),'hex');entry:=null;
  if r#>>'{page,cursor}' is not null then
   begin entry:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;
   exception when others then perform private.fail('VALIDATION_FAILED');end;
   if entry->>'scope' is distinct from scope_hash then perform private.fail('VALIDATION_FAILED');end if;
  end if;
  limit_n:=coalesce((r#>>'{page,limit}')::int,50);
  select coalesce(jsonb_agg(private.event_view(org,x.id) order by x.starts_at,x.id),'[]'::jsonb) into out from
   (select e.id,e.starts_at from core.events e where e.org_id=org and (center is null or e.center_id=center)
    and private.center_accessible(org,e.center_id)
    and e.starts_at<(r#>>'{interval,ends_at}')::timestamptz and e.ends_at>(r#>>'{interval,starts_at}')::timestamptz
    and (org_reader or private.is_manager(org,person,e.center_id) or e.published or exists(select 1 from core.event_registrations where org_id=org and event_id=e.id and person_id=person))
    and (r->>'discipline_id' is null or exists(select 1 from core.event_disciplines where org_id=org and event_id=e.id and discipline_id=(r->>'discipline_id')::uuid))
    and (entry is null or (e.starts_at,e.id)>((entry->>'at')::timestamptz,(entry->>'id')::uuid))
    order by e.starts_at,e.id limit limit_n+1) x;
  token:=null;
  if jsonb_array_length(out)>limit_n then
   out:=out-(jsonb_array_length(out)-1);entry:=out->(jsonb_array_length(out)-1);
   token:=encode(convert_to(jsonb_build_object('scope',scope_hash,'at',entry#>>'{interval,starts_at}','id',entry->>'id')::text,'UTF8'),'hex');
  end if;
  out:=jsonb_build_object('items',out,'next_cursor',token);
 when 'event_payment_prepare_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  target:=(r->>'person_id')::uuid;
  if e.state<>'published' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if not (e.terms->>'full_payment_required')::bool or (e.terms->>'fee_minor')::bigint<=0 then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind='student' and state='active') then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  if exists(select 1 from core.event_assignments where org_id=org and event_id=e.id and person_id=target and duty='assistant') then perform private.fail('ASSISTANT_PARTICIPANT_CONFLICT');end if;
  if exists(select 1 from core.event_registrations where org_id=org and event_id=e.id and person_id=target and state='active') then perform private.fail('RESERVATION_EXISTS');end if;
  select * into prep from core.event_payment_preparations where org_id=org and event_id=e.id and person_id=target and state='prepared' for update;
  if found then
   record_id:=prep.id;
  else
   insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state)
   values(private.new_id(p_ids,idx),org,center,target,(e.terms->>'fee_minor')::bigint,e.terms->>'currency',now(),'open');
   insert into core.event_payment_preparations(id,org_id,center_id,event_id,person_id,debt_id,state,terms_snapshot,terms_hash)
   values(record_id,org,center,e.id,target,private.new_id(p_ids,idx),'prepared',e.terms,encode(extensions.digest(e.terms::text,'sha256'),'hex'));
   update core.events set version=version+1 where id=e.id;
  end if;
  out:=private.preparation_view(org,record_id);subject:='event_payment_preparations';
 when 'event_payment_get_v1' then
  select * into prep from core.event_payment_preparations where org_id=org and center_id=center and id=(r->>'preparation_id')::uuid;
  if not found then perform private.fail('NOT_FOUND');end if;
  if not cm and not private.staff_grant(org,person,center,'finance.collect') and prep.person_id<>person then perform private.fail('FORBIDDEN');end if;
  out:=private.preparation_view(org,prep.id);
 when 'debt_adjust_v1' then
  select * into debt from core.debts where org_id=org and center_id=center and id=(r->>'debt_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if private.event_debt_closed(org,debt.id) then perform private.fail('INVALID_STATE_TRANSITION');end if;
  amount:=(r->>'amount_minor')::bigint;
  if r->>'direction'='decrease' and amount>private.debt_net(org,debt.id) then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.debt_adjustments(id,org_id,center_id,debt_id,amount_minor,direction,reason,operation_id)
  values(record_id,org,center,debt.id,amount,r->>'direction',r->>'reason',operation_id);
  perform private.claim_debt_overpayment(org,debt.id,operation_id,p_ids,idx);
  update core.debts set version=version+1,state=case when private.debt_remaining(org,debt.id)=0 then 'settled' else 'open' end where id=debt.id;
  subject:='debt_adjustments';
 when 'student_credit_refund_v1','student_credit_offset_v1' then
  target:=(r->>'person_id')::uuid;amount:=(r->>'amount_minor')::bigint;
  if not exists(select 1 from core.people where org_id=org and id=target) then perform private.fail('NOT_FOUND');end if;
  if private.student_credit_available(org,center,target,r->>'currency')<amount then perform private.fail('INSUFFICIENT_STUDENT_CREDIT');end if;
  if p_operation='student_credit_offset_v1' then
   select * into debt from core.debts where org_id=org and center_id=center and person_id=target and id=(r->>'debt_id')::uuid for update;
   if not found then perform private.fail('NOT_FOUND');end if;
   if debt.currency<>r->>'currency' then perform private.fail('CURRENCY_MISMATCH');end if;
   if debt.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   if private.debt_remaining(org,debt.id)<amount then perform private.fail('VALIDATION_FAILED');end if;
   insert into core.student_credit_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,source_debt_id,operation_id)
   values(record_id,org,center,target,'offset_subtract',amount,r->>'currency',debt.id,operation_id);
   insert into core.debt_allocations(id,org_id,center_id,debt_id,credit_movement_id,amount_minor)
   values(private.new_id(p_ids,idx),org,center,debt.id,record_id,amount);
   update core.debts set version=version+1,state=case when private.debt_remaining(org,debt.id)=0 then 'settled' else 'open' end where id=debt.id;
  else
   insert into core.cash_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,occurred_at,reason,operation_id)
   values(record_id,org,center,target,'refund',amount,r->>'currency',(r->>'occurred_at')::timestamptz,r->>'reason',operation_id);
   insert into core.student_credit_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,source_cash_id,operation_id)
   values(private.new_id(p_ids,idx),org,center,target,'refund_subtract',amount,r->>'currency',record_id,operation_id);
  end if;
  subject:=case when p_operation='student_credit_refund_v1' then 'cash_movements' else 'student_credit_movements' end;
 when 'event_registration_preview_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid;
  if not found then perform private.fail('NOT_FOUND');end if;
  target:=(r->>'person_id')::uuid;
  if not cm and not private.staff_grant(org,person,center,'reservation.write') and target<>person then perform private.fail('FORBIDDEN');end if;
  if r->>'preparation_id' is not null and r->>'sale_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
  scope_hash:=encode(extensions.digest(r::text,'sha256'),'hex');token:=p_aux->>'token';
  dependencies:=jsonb_build_object('versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','events','id',e.id),'version',e.version)),'policy_hashes','[]'::jsonb,'permission_hash',actor.id::text);
  if r->>'sale_id' is not null then
   select * into row_record from core.entitlement_accounts where org_id=org and person_id=target and sale_id=(r->>'sale_id')::uuid;
   if found then dependencies:=jsonb_set(dependencies,'{versions}',(dependencies->'versions')||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','entitlement_accounts','id',row_record.id),'version',row_record.version)));end if;
  end if;
  if r->>'preparation_id' is not null then dependencies:=jsonb_set(dependencies,'{policy_hashes}',jsonb_build_array(private.event_financial_fingerprint(org,e.id)));end if;
  out:=jsonb_build_object('id',record_id,'token',token,'scope_hash',scope_hash,'dependencies',dependencies,'effects','[]'::jsonb,'blockers','[]'::jsonb,'expires_at',now()+interval '15 minutes');
  state_name:=private.event_eligibility(org,e.id,target,(r->>'sale_id')::uuid);
  if state_name is null and r->>'sale_id' is null then state_name:=private.preparation_eligibility(org,e.id,target,(r->>'preparation_id')::uuid);end if;
  if state_name is not null then out:=jsonb_set(out,'{blockers}',jsonb_build_array(jsonb_build_object('code',state_name,'retryable',false,'trace_id',trace)));end if;
  insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(record_id,org,actor.id,'event_register_v1',scope_hash,dependencies,jsonb_build_object('effects',out->'effects','blockers',out->'blockers'),'current');
  insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(record_id,r,now()+interval '15 minutes',encode(extensions.digest(token,'sha256'),'hex'));
 when 'event_register_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if not cm and not e.published then perform private.fail('NOT_FOUND');end if;
  target:=(r->>'person_id')::uuid;
  if r->>'preparation_id' is not null and r->>'sale_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
  if not cm and not private.staff_grant(org,person,center,'reservation.write') and target<>person then perform private.fail('FORBIDDEN');end if;
  if r->>'preparation_id' is not null then
   select * into prep from core.event_payment_preparations where org_id=org and center_id=center and event_id=e.id and person_id=target and id=(r->>'preparation_id')::uuid for update;
   if not found then perform private.fail('NOT_FOUND');end if;
  end if;
  if r ? 'preview' and r->>'preview' is not null then
   select * into preview from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid for update;
   select * into preview_data from private.preview_payloads where preview_id=preview.id;
   if preview.id is null or preview.operation<>'event_register_v1' or preview.actor_account_id<>actor.id or preview.state<>'current' or preview_data.expires_at<=now() or preview_data.token_hash<>encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex')
    or (preview.dependencies#>>'{versions,0,version}')::bigint<>e.version
    or preview_data.payload->>'person_id' is distinct from r->>'person_id' or preview_data.payload->>'event_id' is distinct from r->>'event_id'
    or preview_data.payload->>'sale_id' is distinct from r->>'sale_id' or preview_data.payload->>'preparation_id' is distinct from r->>'preparation_id'
    or exists(select 1 from jsonb_array_elements(preview.dependencies->'versions') dep where dep#>>'{entity,type}'='entitlement_accounts' and not exists(select 1 from core.entitlement_accounts a where a.org_id=org and a.id=(dep#>>'{entity,id}')::uuid and a.version=(dep->>'version')::bigint))
    or (prep.id is not null and preview.dependencies->'policy_hashes' <> jsonb_build_array(private.event_financial_fingerprint(org,e.id)))
    then perform private.fail('PREVIEW_STALE');end if;
  end if;
  state_name:=private.event_eligibility(org,e.id,target,(r->>'sale_id')::uuid);
  -- All non-capacity gates are rechecked before committing the exceptional financial outcome.
  if state_name is not null and state_name<>'CAPACITY_FULL' then perform private.fail(state_name);end if;
  if r->>'sale_id' is null then
   token:=private.preparation_eligibility(org,e.id,target,(r->>'preparation_id')::uuid);
   if token is not null then perform private.fail(token);end if;
  end if;
  if state_name='CAPACITY_FULL' and prep.id is not null then
   entry:=private.cancel_event_debt(org,prep.debt_id,operation_id,p_ids,idx,'Q-E01 capacity full');
   record_id:=prep.id;
   update core.event_payment_preparations set state='capacity_closed',version=version+1 where id=prep.id returning version into version_n;
   out:=jsonb_build_object('outcome','capacity_closed','operation_id',operation_id,'preparation_id',prep.id,'debt_id',prep.debt_id,'version',version_n,'replayed',false)
    || (entry-'debt_id');
   subject:='event_payment_preparations';
  else
   if state_name is not null then perform private.fail(state_name);end if;
   terms:=coalesce(prep.terms_snapshot,e.terms);
   amount:=case when r->>'sale_id' is null then (terms->>'fee_minor')::bigint else 0 end;
   insert into core.event_registrations(id,org_id,center_id,event_id,person_id,amount_minor,currency,terms_hash,state,attendance_result,terms_snapshot)
   values(record_id,org,center,e.id,target,amount,terms->>'currency',encode(extensions.digest(terms::text,'sha256'),'hex'),'active','unmarked',terms);
   if r->>'sale_id' is not null then
    selected:=private.reserve_right(org,target,(r->>'sale_id')::uuid,null,e.id,record_id,null,operation_id,p_ids,idx);
   elsif prep.id is not null then
    update core.debts set event_registration_id=record_id,version=version+1 where org_id=org and id=prep.debt_id;
    update core.event_payment_preparations set state='registered',registration_id=record_id,version=version+1 where id=prep.id;
   elsif amount>0 then
    insert into core.debts(id,org_id,center_id,person_id,event_registration_id,amount_minor,currency,due_at,state)
    values(private.new_id(p_ids,idx),org,center,target,record_id,amount,terms->>'currency',now(),'open');
   end if;
   subject:='event_registrations';
   out:=jsonb_build_object('outcome','registered','operation_id',operation_id,'primary_id',record_id,'version',version_n,'replayed',false,'related','[]'::jsonb);
  end if;
  if preview.id is not null then update core.previews set state='applied' where id=preview.id;end if;
  update core.events set version=version+1 where id=e.id;
 when 'event_registration_cancel_v1' then
  select * into reg from core.event_registrations where org_id=org and center_id=center and id=(r->>'registration_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if not cm and not private.staff_grant(org,person,center,'reservation.write') and reg.person_id<>person then perform private.fail('FORBIDDEN');end if;
  if reg.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if reg.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  select * into e from core.events where org_id=org and id=reg.event_id;
  do_consume:=case when now()<e.starts_at-make_interval(mins=>coalesce((reg.terms_snapshot#>>'{cancellation,cutoff_minutes}')::int,0)) then reg.terms_snapshot#>>'{cancellation,before_cutoff}'='consume' else reg.terms_snapshot#>>'{cancellation,after_cutoff}'='consume' end;
  perform private.set_right_state(org,reg.id,null,do_consume,operation_id,p_ids,idx,false);
  record_id:=reg.id;update core.event_registrations set state='cancelled',version=version+1 where id=record_id returning version into version_n;
  update core.events set version=version+1 where id=e.id;subject:='event_registrations';
 when 'event_attendance_mark_v1' then
  select * into reg from core.event_registrations where org_id=org and center_id=center and id=(r->>'registration_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  select * into e from core.events where org_id=org and id=reg.event_id;
  if e.attendance_state<>'open' then perform private.fail('ATTENDANCE_CLOSED');end if;
  if reg.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if r->>'result'='blocked' and not cm then perform private.fail('FORBIDDEN');end if;
  record_id:=reg.id;update core.event_registrations set attendance_result=r->>'result',version=version+1 where id=record_id and version=(r->>'expected_version')::bigint returning version into version_n;
  if not found then perform private.fail('VERSION_CONFLICT');end if;
  update core.events set version=version+1 where id=reg.event_id;subject:='event_registrations';
 when 'event_attendance_close_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if e.attendance_state<>'open' then perform private.fail('ATTENDANCE_CLOSED');end if;
  if r ? 'expected_version' and e.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if now()<e.starts_at then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if exists(select 1 from core.event_registrations where org_id=org and event_id=e.id and state='active' and attendance_result='unmarked') then perform private.fail('ATTENDANCE_INCOMPLETE');end if;
  for reg in select * from core.event_registrations where org_id=org and event_id=e.id and state='active' order by id for update loop
   do_consume:=private.event_consumes(org,center,reg.attendance_result,reg.terms_snapshot);
   perform private.set_right_state(org,reg.id,null,do_consume,operation_id,p_ids,idx,false);idx:=idx+3;
   update core.event_registrations set state='completed',version=version+1 where id=reg.id;
  end loop;
  record_id:=e.id;update core.events set attendance_state='closed',attendance_revision=attendance_revision+1,version=version+1 where id=record_id returning version into version_n;subject:='events';
 when 'event_attendance_correct_v1' then
  select * into reg from core.event_registrations where org_id=org and center_id=center and id=(r->>'registration_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  select * into e from core.events where org_id=org and id=reg.event_id;
  if e.attendance_state<>'closed' or reg.state<>'completed' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if reg.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  do_consume:=private.event_consumes(org,center,r->>'result',reg.terms_snapshot);
  perform private.set_right_state(org,reg.id,null,do_consume,operation_id,p_ids,idx,true);
  record_id:=reg.id;update core.event_registrations set attendance_result=r->>'result',version=version+1 where id=record_id returning version into version_n;
  update core.events set attendance_revision=attendance_revision+1,version=version+1 where id=e.id;subject:='event_registrations';
 when 'event_complete_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if e.state<>'published' or now()<e.starts_at then perform private.fail('INVALID_STATE_TRANSITION');end if;
  record_id:=e.id;update core.events set state='occurred',version=version+1 where id=record_id returning version into version_n;subject:='events';

 when 'permission_set_v1' then
  target:=(r->>'person_id')::uuid;
  if not private.has_role(org,target,'staff',center) and not private.has_role(org,target,'instructor',center) then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
  if r->>'permission' not in ('person.manage','person.activate','invite.student','reservation.write','attendance.draft','sale.write','finance.collect') then perform private.fail('FORBIDDEN');end if;
  update core.people set version=version+1 where org_id=org and id=target and version=(r->>'expected_version')::bigint returning version into version_n;
  if not found then perform private.fail('VERSION_CONFLICT');end if;
  insert into core.permission_overrides(id,org_id,center_id,person_id,permission,enabled) values(record_id,org,center,target,r->>'permission',(r->>'enabled')::bool)
  on conflict(org_id,center_id,person_id,permission) do update set enabled=excluded.enabled,version=core.permission_overrides.version+1 returning id into record_id;subject:='permission_overrides';
 when 'event_duty_verify_v1' then
  select * into row_record from core.event_assignments where org_id=org and center_id=center and id=(r->>'assignment_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if row_record.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  select * into e from core.events where org_id=org and id=row_record.event_id;
  if e.state<>'occurred' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if row_record.verified_at is not null and row_record.performed is distinct from (r->>'performed')::bool and coalesce(r->>'reason','')='' then perform private.fail('VALIDATION_FAILED');end if;
  if row_record.performed is distinct from (r->>'performed')::bool then
   select id into linked from core.earnings where org_id=org and event_assignment_id=row_record.id order by created_at desc,id desc limit 1;
   if (r->>'performed')::bool or row_record.performed then
    insert into core.earnings(id,org_id,center_id,person_id,event_assignment_id,amount_minor,currency,basis,previous_id,operation_id,direction)
    values(private.new_id(p_ids,idx),org,center,row_record.person_id,row_record.id,row_record.fee_minor,row_record.currency,
     jsonb_build_object('source','event_fee','currency',row_record.currency,'quantity',1,'excluded_blocked',0),linked,operation_id,case when (r->>'performed')::bool then 'add' else 'subtract' end);
   end if;
  end if;
  record_id:=row_record.id;update core.event_assignments set performed=(r->>'performed')::bool,verified_at=now(),verified_by=person,version=version+1 where id=record_id returning version into version_n;subject:='event_assignments';
 when 'event_cancel_preview_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid;
  if not found then perform private.fail('NOT_FOUND');end if;
  if e.state not in ('draft','published') then perform private.fail('INVALID_STATE_TRANSITION');end if;
  scope_hash:=encode(extensions.digest(r::text,'sha256'),'hex');token:=p_aux->>'token';
  dependencies:=jsonb_build_object('versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','events','id',e.id),'version',e.version)),
  'policy_hashes',jsonb_build_array(private.event_financial_fingerprint(org,e.id)),'permission_hash',actor.id::text);
  entry:='[]'::jsonb;
  for debt in select * from core.debts where org_id=org and id in(select private.event_debt_ids(org,e.id)) order by id loop
   entry:=entry||jsonb_build_array(
    jsonb_build_object('entity',jsonb_build_object('type','debts','id',debt.id),'action','adjust','amount_minor',private.debt_remaining(org,debt.id)::text,'currency',debt.currency,'reason','remaining_debt_removed'),
    jsonb_build_object('entity',jsonb_build_object('type','debts','id',debt.id),'action','create','amount_minor',greatest(0,private.debt_paid(org,debt.id)-private.debt_claimed(org,debt.id))::text,'currency',debt.currency,'reason','student_credit_added'));
  end loop;
  entry:=entry||coalesce((select jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','entitlement_allocations','id',a.id),'action','release','quantity',a.quantity)) from core.entitlement_allocations a join core.event_registrations er on er.org_id=a.org_id and er.id=a.event_registration_id where er.org_id=org and er.event_id=e.id and er.state='active' and a.state='reserved'),'[]'::jsonb);
  entry:=entry||coalesce((select jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','event_payment_preparations','id',p.id),'action','close')) from core.event_payment_preparations p where p.org_id=org and p.event_id=e.id and p.state='prepared'),'[]'::jsonb);
  out:=jsonb_build_object('id',record_id,'token',token,'scope_hash',scope_hash,'dependencies',dependencies,'effects',entry,'blockers','[]'::jsonb,'expires_at',now()+interval '15 minutes');
  if now()>=e.starts_at then
   out:=jsonb_set(out,'{blockers}',jsonb_build_array(jsonb_build_object('code','POLICY_NOT_CONFIGURED','retryable',false,'trace_id',trace)));
  end if;
  insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(record_id,org,actor.id,'event_cancel_apply_v1',scope_hash,dependencies,jsonb_build_object('effects',out->'effects','blockers',out->'blockers'),'current');
  insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(record_id,r,now()+interval '15 minutes',encode(extensions.digest(token,'sha256'),'hex'));
 when 'event_cancel_apply_v1' then
  select * into preview from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid for update;
  select * into preview_data from private.preview_payloads where preview_id=preview.id;
  if preview.id is null or preview.operation<>'event_cancel_apply_v1' or preview.actor_account_id<>actor.id or preview.state<>'current' or preview_data.expires_at<=now() or preview_data.token_hash<>encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') then perform private.fail('PREVIEW_STALE');end if;
  select * into e from core.events where org_id=org and center_id=center and id=(preview_data.payload->>'event_id')::uuid for update;
  if not found or e.version<>(preview.dependencies#>>'{versions,0,version}')::bigint then perform private.fail('PREVIEW_STALE');end if;
  if preview.dependencies->'policy_hashes' <> jsonb_build_array(private.event_financial_fingerprint(org,e.id)) then perform private.fail('PREVIEW_STALE');end if;
  if e.state not in ('draft','published') then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if now()>=e.starts_at or jsonb_array_length(preview.result->'blockers')>0 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  for debt in select * from core.debts where org_id=org and id in(select private.event_debt_ids(org,e.id)) order by id for update loop
   perform private.cancel_event_debt(org,debt.id,operation_id,p_ids,idx,preview_data.payload->>'reason');idx:=idx+2;
  end loop;
  for reg in select * from core.event_registrations where org_id=org and event_id=e.id and state='active' order by id for update loop
   perform private.set_right_state(org,reg.id,null,false,operation_id,p_ids,idx,false);idx:=idx+3;
   update core.event_registrations set state='cancelled',version=version+1 where id=reg.id;
  end loop;
  update core.event_payment_preparations set state='event_cancelled',version=version+1 where org_id=org and event_id=e.id and state in ('prepared','registered');
  update core.resource_bookings set state='inactive',version=version+1 where org_id=org and event_id=e.id and state='active';
  record_id:=e.id;update core.events set state='cancelled',published=false,version=version+1 where id=record_id returning version into version_n;
  update core.previews set state='applied' where id=preview.id;subject:='events';

 -- DOMAIN_CASES
 else perform private.fail('NOT_FOUND');
 end case;
 if out ? 'items' then out:=out||jsonb_build_object('as_of',now());end if;
 if out is null then out:=jsonb_build_object('operation_id',operation_id,'primary_id',record_id,'version',version_n,'replayed',false,'related','[]'::jsonb);end if;
 out:=jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 if mutable then
  if p_operation='organization_create_v1' then update core.operation_receipts set org_id=org where id=operation_id;end if;
  if org is not null then
   insert into core.audit_events(id,org_id,actor_account_id,actor_person_id,action,subject_table,subject_id,reason,operation_id)
    values(private.new_id(p_ids,4),org,actor.id,person,p_operation,subject,record_id,r->>'reason',operation_id);
   insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload)
    values(private.new_id(p_ids,5),org,coalesce(person,(select owner_person_id from core.organizations where id=org)),p_operation,record_id,jsonb_build_object('template_key',p_operation,'subject',jsonb_build_object('type',subject,'id',record_id)));
   insert into core.outbox_jobs(id,org_id,notification_id,kind,dedupe_key,state,attempts,next_attempt_at)
    values(private.new_id(p_ids,6),org,private.new_id(p_ids,5),'in_app',operation_id::text,'pending',0,now());
  end if;
  update core.operation_receipts set state='succeeded',result=out,business_reference=record_id where id=operation_id;
 end if;
 set constraints all immediate;
 set constraints all deferred;
 return out;
exception when others then
 if SQLSTATE='54000' and SQLERRM='UUID_BANK_EXHAUSTED' then return jsonb_build_object('_internal_retry','uuid_bank_exhausted');end if;
 state_name:=SQLERRM;
 if SQLSTATE<>'P0001' then state_name:='INTEGRITY_VIOLATION';end if;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',state_name,'retryable',state_name in ('TEMPORARY_FAILURE','OPERATION_IN_PROGRESS'),'trace_id',trace));
end$$;
revoke all on function private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb) to service_role;

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
notify pgrst,'reload schema';
