-- Synthetic fixtures only. Caller MUST use BEGIN and ROLLBACK.
create function pg_temp.bank(n int) returns uuid[] language plpgsql volatile security invoker set search_path='' as $$
declare result uuid[]:='{}';b bytea;ms bigint;i int;j int;
begin
 if n is null or n<1 or n>116574 then raise exception using errcode='P0001',message='VALIDATION_FAILED';end if;
 for i in 1..n loop
  ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;b:=extensions.gen_random_bytes(16);
  for j in 0..5 loop b:=set_byte(b,j,((ms>>((5-j)*8))&255)::int);end loop;
  b:=set_byte(b,6,(get_byte(b,6)&15)|112);b:=set_byte(b,8,(get_byte(b,8)&63)|128);
  result:=array_append(result,encode(b,'hex')::uuid);
 end loop;return result;
end$$;
create function pg_temp.invoke(op text,body jsonb,actor_auth uuid,actor_session uuid) returns jsonb language plpgsql as $$
declare data jsonb;req jsonb:=body||jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1]);
begin
 if op not like '%_preview_v1' and op not like '%_get_v1' then req:=req||jsonb_build_object('operation_key',(pg_temp.bank(1))[1]);end if;
 data:=private.execute_operation(op,req,actor_auth,actor_session,pg_temp.bank(512),jsonb_build_object('token',encode(extensions.gen_random_bytes(32),'hex')));
 if data->>'ok' is distinct from 'true' then raise exception 'NATIVE_OPERATION_FAILED %: %',op,data;end if;return data->'data';
end$$;
do $probe$
declare u uuid[]:=array['01a16438-8521-72aa-a411-73f9919135a5'::uuid,'01a16438-8522-75c9-9f1a-a1b6a0d7ca1e'::uuid,'01a16438-8522-75c9-9f1a-a55663bb6768'::uuid,'01a16438-8522-75c9-9f1a-aa90222c600a'::uuid,'01a16438-8522-75c9-9f1a-ae82bddf7ca7'::uuid,'01a16438-8522-75c9-9f1a-b31bce5de6cf'::uuid,'01a16438-8522-75c9-9f1a-b43e50f89b06'::uuid,'01a16438-8522-75c9-9f1a-bb2675adcc8b'::uuid,'01a16438-8522-75c9-9f1a-bda762d23b8f'::uuid,'01a16438-8522-75c9-9f1a-c08607bbe124'::uuid,'01a16438-8523-7530-9292-72f32040eb39'::uuid,'01a16438-8523-7530-9292-77ab0dadfc27'::uuid,'01a16438-8523-7530-9292-796303ac438b'::uuid,'01a16438-8523-7530-9292-7f4a074c342d'::uuid,'01a16438-8523-7530-9292-83c9b012b1af'::uuid,'01a16438-8523-7530-9292-8575487d9651'::uuid,'01a16438-8523-7530-9292-8876c66e06b1'::uuid,'01a16438-8523-7530-9292-8c5f87a7cc43'::uuid,'01a16438-8523-7530-9292-92968dc33526'::uuid,'01a16438-8523-7530-9292-97f3388c0e94'::uuid,'01a16438-8523-7530-9292-9b4b8731a40c'::uuid,'01a16438-8523-7530-9292-9dd82c42f01f'::uuid,'01a16438-8523-7530-9292-a19855bbb1d2'::uuid,'01a16438-8523-7530-9292-a6806d876269'::uuid,'01a16438-8523-7530-9292-a868f2f94b4a'::uuid,'01a16438-8523-7530-9292-ac3e8e0c03d6'::uuid,'01a16438-8523-7530-9292-b1f9d030f5f7'::uuid,'01a16438-8523-7530-9292-b7d0266466d7'::uuid,'01a16438-8523-7530-9292-b9747df1d0b4'::uuid,'01a16438-8523-7530-9292-bead186010d0'::uuid,'01a16438-8523-7530-9292-c3d9354f4662'::uuid,'01a16438-8523-7530-9292-c4bee8a4dd31'::uuid,'01a16438-8523-7530-9292-c81a01817fdb'::uuid,'01a16438-8523-7530-9292-cf157367c93d'::uuid,'01a16438-8523-7530-9292-d13b41fa2928'::uuid,'01a16438-8523-7530-9292-d573cde22556'::uuid,'01a16438-8523-7530-9292-d8668cbd8eaa'::uuid,'01a16438-8523-7530-9292-dda53733514b'::uuid,'01a16438-8523-7530-9292-e3c7c681d8bb'::uuid,'01a16438-8523-7530-9292-e7aba847e66f'::uuid,'01a16438-8523-7530-9292-eb9bc7a2c965'::uuid,'01a16438-8523-7530-9292-ec582c1aa391'::uuid,'01a16438-8523-7530-9292-f04b1c4b8e55'::uuid,'01a16438-8523-7530-9292-f594e0a9ad7f'::uuid,'01a16438-8523-7530-9292-fa236e503c1c'::uuid,'01a16438-8523-7530-9292-fccf610a4323'::uuid,'01a16438-8523-7530-9293-01b4f1a978b7'::uuid,'01a16438-8523-7530-9293-059737ee4351'::uuid];answer jsonb;preview jsonb;fresh jsonb;before_debt jsonb;w uuid[]:=pg_temp.bank(64);disc uuid;cls uuid;product uuid;sold uuid;sp jsonb;rv uuid;quote_id uuid;due bigint;sub_id uuid;original_end timestamptz;payment_id uuid;change_id uuid;result_data jsonb;proof jsonb;period_row core.saas_subscriptions;
begin
 insert into core.accounts(id,state) values(u[1],'active'),(u[2],'active'),(u[3],'active'),(u[4],'active');
 insert into core.organizations(id,org_id,name,owner_person_id,state) values(u[5],u[5],'P07 rollback A',u[9],'active'),(u[6],u[6],'P07 rollback B',u[11],'active');
 insert into core.people(id,org_id,display_name,state) values(u[9],u[5],'Manager','active'),(u[10],u[5],'Target','active'),(u[11],u[6],'Foreign manager','active'),(u[12],u[6],'Foreign target','active');
 insert into core.centers(id,org_id,center_id,name,timezone,state) values(u[7],u[5],u[7],'A','UTC','active'),(u[8],u[6],u[8],'B','UTC','active');
 insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values(u[13],u[5],u[1],u[9],'active',now()),(u[14],u[5],u[2],u[10],'active',now()),(u[15],u[6],u[3],u[11],'active',now()),(u[16],u[6],u[4],u[12],'active',now());
 insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values(u[17],u[5],u[9],'center_manager',u[7],'active',u[13]),(u[18],u[5],u[10],'staff',u[7],'active',u[14]),(u[19],u[6],u[11],'center_manager',u[8],'active',u[15]),(u[20],u[6],u[12],'staff',u[8],'active',u[16]);
 insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) values(u[21],'business',now(),1000,'TRY','monthly','{"entries":[]}',array['F04']);
 insert into core.saas_subscriptions(id,org_id,plan_version_id,state,starts_at,period_end,cancel_at_period_end) values(u[22],u[5],u[21],'active',now(),now()+interval '30 days',false),(u[23],u[6],u[21],'active',now(),now()+interval '30 days',false);
 insert into core.invitations(id,org_id,center_id,person_id,email,token_hash,inviter_account_id,expires_at,state) values(u[24],u[5],u[7],u[10],'a@ftksaas.invalid',repeat('a',64),u[1],now()+interval '1 day','pending'),(u[25],u[6],u[8],u[12],'b@ftksaas.invalid',repeat('b',64),u[3],now()-interval '1 day','pending');
 insert into core.permission_overrides(id,org_id,center_id,person_id,permission,enabled) values(u[26],u[5],u[7],u[10],'person.manage',true),(u[27],u[6],u[8],u[12],'person.manage',true);
 insert into private.settlement_grants values(u[5],u[10],u[7],true,1),(u[6],u[12],u[8],true,1);

 insert into core.accounts(id,state) values(u[31],'active');
 insert into auth.users(id,email,email_confirmed_at) values(u[1],'probe-owner@ftksaas.invalid',now()),(u[31],'probe-approver@ftksaas.invalid',now());
 update core.accounts set auth_user_id=id where id in (u[1],u[31]);
 insert into core.people(id,org_id,display_name,state) values(u[28],u[5],'Canonical target','active'),(u[30],u[5],'Second manager','active');
 insert into core.centers(id,org_id,center_id,name,timezone,state) values(u[29],u[5],u[29],'Second affected center','UTC','active');
 insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values(u[32],u[5],u[31],u[30],'active',now());
 insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values(u[33],u[5],u[30],'center_manager',u[29],'active',u[32]);
 insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values(u[34],u[5],u[7],u[10],'student','active',now()),(u[35],u[5],u[29],u[28],'student','active',now());
 update core.saas_plan_versions set features=(select array_agg('F'||lpad(i::text,2,'0')) from generate_series(1,33) i) where id=u[21];
 perform set_config('request.jwt.claim.role','service_role',true);
 insert into auth.sessions(id,user_id,created_at,updated_at) values(w[1],u[1],clock_timestamp(),clock_timestamp());
 insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state) values(u[36],u[5],u[7],u[10],100,'TRY',now(),'open');
 select to_jsonb(d) into before_debt from core.debts d where d.id=u[36];

 insert into private.platform_operators(auth_user_id) values(u[1]);
 insert into private.p07_billing_config values(true,900) on conflict(singleton) do update set quote_ttl_seconds=excluded.quote_ttl_seconds;
 insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) values(w[30],'starter',now(),100,'TRY','monthly','{"entries":[]}',array['F32']),(w[31],'pro',now(),400,'TRY','monthly','{"entries":[]}',array['F32']),(w[32],'business',now(),1000,'TRY','yearly','{"entries":[]}',array['F32']);
 update core.saas_subscriptions set plan_version_id=w[30],starts_at=now()-interval '15 days',period_end=(now()-interval '15 days')+interval '1 month' where org_id=u[5] returning id,period_end into sub_id,original_end;
 for answer in select jsonb_build_object('name',n,'permission',case when n='saas_grace_extend_v1' then 'saas.operator' else 'subscription.owner' end) from unnest(array['subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1','saas_grace_extend_v1']) n loop
  insert into private.runtime_operations(name,permission,billing_class,features) values(answer->>'name',answer->>'permission','exempt','{}') on conflict(name) do nothing;
 end loop;
 answer:=private.execute_operation('subscription_upgrade_quote_v1',jsonb_build_object('client_api_version',1,'request_id',w[40],'operation_key',w[41],'org_id',u[5],'target_plan_id',w[32]),u[1],w[1],pg_temp.bank(512),null);
 if answer#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'BILLING_PERIOD_CONVERSION_ALLOWED %',answer;end if;
 answer:=pg_temp.invoke('subscription_upgrade_quote_v1',jsonb_build_object('org_id',u[5],'target_plan_id',w[31]),u[1],w[1]);quote_id:=(answer->>'id')::uuid;due:=(answer->>'amount_minor')::bigint;
 if due not between 154 and 155 then raise exception 'PRORATION_WRONG %',answer;end if;
 answer:=pg_temp.invoke('saas_payment_submit_v1',jsonb_build_object('org_id',u[5],'quote_id',quote_id,'amount_minor',(due-1)::text,'currency','TRY','reference','partial','occurred_at',clock_timestamp()),u[1],w[1]);payment_id:=(answer->>'primary_id')::uuid;
 perform pg_temp.invoke('saas_payment_verify_v1',jsonb_build_object('org_id',u[5],'payment_id',payment_id,'accepted',true),u[1],w[1]);
 if (select plan_version_id from core.saas_subscriptions where id=sub_id)<>w[30] then raise exception 'PARTIAL_PAYMENT_UPGRADED';end if;
 update core.saas_quotes set expires_at=clock_timestamp()-interval '1 second' where id=quote_id;
 answer:=pg_temp.invoke('subscription_renewal_set_v1',jsonb_build_object('org_id',u[5],'expected_version',(select version from core.saas_subscriptions where id=sub_id),'renew',true),u[1],w[1]);
 answer:=pg_temp.invoke('subscription_upgrade_quote_v1',jsonb_build_object('org_id',u[5],'target_plan_id',w[31]),u[1],w[1]);quote_id:=(answer->>'id')::uuid;
 if (answer->>'amount_minor')::bigint<>1 then raise exception 'EXPIRED_QUOTE_PARTIAL_MONEY_LOST %',answer;end if;
 answer:=pg_temp.invoke('saas_payment_submit_v1',jsonb_build_object('org_id',u[5],'quote_id',quote_id,'amount_minor','1','currency','TRY','reference','remaining','occurred_at',clock_timestamp()),u[1],w[1]);payment_id:=(answer->>'primary_id')::uuid;
 perform pg_temp.invoke('saas_payment_verify_v1',jsonb_build_object('org_id',u[5],'payment_id',payment_id,'accepted',true),u[1],w[1]);
 if not exists(select 1 from core.saas_subscriptions where id=sub_id and plan_version_id=w[31] and period_end=original_end) then raise exception 'UPGRADE_RENEWAL_CHANGED';end if;
 -- Isolated financial case rolls back its own additional money and plan changes.
 begin
  update core.saas_subscriptions set plan_version_id=w[30],version=version+1 where id=sub_id;
  answer:=pg_temp.invoke('saas_payment_submit_v1',jsonb_build_object('org_id',u[5],'amount_minor','1000','currency','TRY','reference','prepaid zero quote','occurred_at',clock_timestamp()),u[1],w[1]);payment_id:=(answer->>'primary_id')::uuid;
  perform pg_temp.invoke('saas_payment_verify_v1',jsonb_build_object('org_id',u[5],'payment_id',payment_id,'accepted',true),u[1],w[1]);
  if (select period_end from core.saas_subscriptions where id=sub_id)<>original_end then raise exception 'PREPAYMENT_MOVED_ANCHOR';end if;
  answer:=pg_temp.invoke('subscription_upgrade_quote_v1',jsonb_build_object('org_id',u[5],'target_plan_id',w[31]),u[1],w[1]);
  if answer->>'amount_minor'<>'0' then raise exception 'PREPAID_ZERO_QUOTE_WRONG %',answer;end if;
  answer:=pg_temp.invoke('saas_payment_submit_v1',jsonb_build_object('org_id',u[5],'quote_id',answer->'id','amount_minor','0','currency','TRY','reference','zero confirmation','occurred_at',clock_timestamp()),u[1],w[1]);payment_id:=(answer->>'primary_id')::uuid;
  perform pg_temp.invoke('saas_payment_verify_v1',jsonb_build_object('org_id',u[5],'payment_id',payment_id,'accepted',true),u[1],w[1]);
  if not exists(select 1 from private.p07_payment_origins x where x.payment_id=(answer->>'primary_id')::uuid and kind='quote_confirmation') or (select plan_version_id from core.saas_subscriptions where id=sub_id)<>w[31] or private.p07_funds(u[5],'TRY') not between 845 and 846 then raise exception 'ZERO_QUOTE_DOUBLE_CASH_OR_NO_UPGRADE';end if;
  raise exception 'P07_ZERO_CASE_ROLLBACK';
 exception when SQLSTATE 'P0001' then if SQLERRM<>'P07_ZERO_CASE_ROLLBACK' then raise;end if;
 end;
 answer:=pg_temp.invoke('subscription_downgrade_request_v1',jsonb_build_object('org_id',u[5],'target_plan_id',w[30],'kept_center_id',u[29]),u[1],w[1]);change_id:=(answer->>'primary_id')::uuid;
 if not exists(select 1 from core.saas_change_requests where id=change_id and effective_at=original_end and state='scheduled') then raise exception 'DOWNGRADE_NOT_PERIOD_BOUND';end if;
 answer:=pg_temp.invoke('management_state_get_v1',jsonb_build_object('org_id',u[5],'operation','subscription_change_cancel_v1','selector',jsonb_build_object('operation','subscription_change_cancel_v1','key',jsonb_build_object('change_id',change_id))),u[1],w[1]);
 if answer#>>'{items,0,entity,id}' is distinct from change_id::text then raise exception 'CHANGE_SELECTOR_KEY_NOT_RESOLVED %',answer;end if;
 perform pg_temp.invoke('subscription_change_cancel_v1',jsonb_build_object('org_id',u[5],'change_id',change_id,'expected_version',1),u[1],w[1]);
 answer:=pg_temp.invoke('subscription_downgrade_request_v1',jsonb_build_object('org_id',u[5],'target_plan_id',w[30],'kept_center_id',u[29]),u[1],w[1]);change_id:=(answer->>'primary_id')::uuid;
 update core.saas_change_requests set effective_at=clock_timestamp()-interval '1 second' where id=change_id;
 insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at) values(w[42],u[5],'probe','subscription_boundary_apply_v1','probe-42','probe','in_progress',now()+interval '1 day');
 perform private.p07_boundary(u[5],sub_id,w[42],pg_temp.bank(512));
 if private.center_accessible(u[5],u[7]) or not private.center_accessible(u[5],u[29]) then raise exception 'KEPT_CENTER_NOT_ENFORCED';end if;
 if not exists(select 1 from core.people where id=u[10] and org_id=u[5]) or not exists(select 1 from core.debts where id=u[36] and amount_minor=100) then raise exception 'DOWNGRADE_MUTATED_HISTORY';end if;
 update core.saas_subscriptions set period_end=clock_timestamp()-interval '1 second',cancel_at_period_end=true,state='active' where id=sub_id;
 insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at) values(w[43],u[5],'probe','subscription_boundary_apply_v1','probe-43','probe','in_progress',now()+interval '1 day');
 perform private.p07_boundary(u[5],sub_id,w[43],pg_temp.bank(512));
 if private.access_mode(u[5])<>'closed' or not exists(select 1 from core.saas_subscriptions where id=sub_id and state='ended') then raise exception 'VOLUNTARY_CANCELLATION_GOT_GRACE';end if;
 begin perform private.p07_worker_scope(u[5]);raise exception 'UNSCOPED_WORKER_ALLOWED';exception when SQLSTATE 'P0001' then if SQLERRM<>'FORBIDDEN' then raise;end if;end;
 select * into period_row from core.saas_subscriptions where id=sub_id;period_row.id:=w[60];period_row.starts_at:='2024-11-30T00:00Z';period_row.period_end:='2025-02-28T00:00Z';
 if private.p07_period_start(period_row)<>'2025-01-30T00:00Z'::timestamptz then raise exception 'MONTH_END_PRORATION_START_WRONG';end if;
 if private.p07_funds(u[5],'TRY')<>0 or (select sum(amount_minor) from private.p07_payment_allocations where subscription_id=sub_id)<>due then raise exception 'PAYMENT_ALLOCATION_NOT_EXACT';end if;

 -- Closed subscription reads stay narrow and retain owner/platform separation.
 delete from private.platform_operators where auth_user_id=u[1];
 answer:=pg_temp.invoke('management_state_get_v1',jsonb_build_object('org_id',u[5],'operation','subscription_renewal_set_v1','selector',jsonb_build_object('operation','subscription_renewal_set_v1','key','{}'::jsonb)),u[1],w[1]);
 if answer#>>'{items,0,entity,id}' is distinct from sub_id::text then raise exception 'CLOSED_OWNER_BILLING_MANAGEMENT_UNAVAILABLE %',answer;end if;
 proof:=private.execute_operation('management_state_get_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'org_id',u[5],'operation','saas_grace_extend_v1'),u[1],w[1],pg_temp.bank(512),null);
 if proof#>>'{error,code}' is distinct from 'SERVICE_UNAVAILABLE' then raise exception 'CLOSED_OWNER_PLATFORM_MANAGEMENT_LEAK %',proof;end if;
 proof:=private.execute_operation('management_state_get_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'org_id',u[5]),u[1],w[1],pg_temp.bank(512),null);
 if proof#>>'{error,code}' is distinct from 'SERVICE_UNAVAILABLE' then raise exception 'CLOSED_MISSING_MANAGEMENT_SELECTOR_LEAK %',proof;end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(w[61],u[31],clock_timestamp(),clock_timestamp());
 proof:=private.execute_operation('management_state_get_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'org_id',u[5],'operation','subscription_renewal_set_v1'),u[31],w[61],pg_temp.bank(512),null);
 if proof#>>'{error,code}' is distinct from 'SERVICE_UNAVAILABLE' then raise exception 'CLOSED_NON_OWNER_MANAGEMENT_LEAK %',proof;end if;

 insert into private.p07_lifecycle_config values(true,300) on conflict(singleton) do update set reauth_max_age_seconds=excluded.reauth_max_age_seconds;
 for answer in select jsonb_build_object('name',n,'permission',case when n like 'account_%' then 'account.self' else 'org.owner' end) from unnest(array['account_delete_preview_v1','account_delete_apply_v1','organization_close_preview_v1','organization_close_apply_v1','organization_reopen_v1','organization_delete_preview_v1','organization_delete_apply_v1']) n loop
  insert into private.runtime_operations(name,permission,billing_class,features) values(answer->>'name',answer->>'permission','exempt','{}') on conflict(name) do nothing;
 end loop;
 preview:=pg_temp.invoke('account_delete_preview_v1','{}',u[1],w[1]);
 if preview#>>'{blockers,0,code}' is distinct from 'OWNER_TRANSFER_REQUIRED' then raise exception 'ACTIVE_OWNER_DELETE_NOT_BLOCKED %',preview;end if;
 preview:=pg_temp.invoke('organization_close_preview_v1',jsonb_build_object('org_id',u[5],'reason','synthetic close'),u[1],w[1]);
 if preview#>>'{lifecycle_impact,open_debts}' is distinct from '1' or preview#>>'{lifecycle_impact,physical_erasure_complete}' is distinct from 'false' then raise exception 'CLOSE_IMPACT_WRONG %',preview;end if;
 update core.debts set amount_minor=101 where id=u[36];
 proof:=private.execute_operation('organization_close_apply_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'operation_key',(pg_temp.bank(1))[1],'org_id',u[5],'expected_version',(select version from core.organizations where id=u[5]),'preview',jsonb_build_object('id',preview->'id','token',preview->'token')),u[1],w[1],pg_temp.bank(512),null);
 if proof#>>'{error,code}' is distinct from 'PREVIEW_STALE' then raise exception 'CLOSE_FINANCIAL_SNAPSHOT_STALE %',proof;end if;
 update core.debts set amount_minor=100 where id=u[36];
 preview:=pg_temp.invoke('organization_close_preview_v1',jsonb_build_object('org_id',u[5],'reason','synthetic close'),u[1],w[1]);
 answer:=pg_temp.invoke('organization_close_apply_v1',jsonb_build_object('org_id',u[5],'expected_version',(select version from core.organizations where id=u[5]),'preview',jsonb_build_object('id',preview->'id','token',preview->'token')),u[1],w[1]);
 if private.access_mode(u[5])<>'closed' or not exists(select 1 from core.debts where id=u[36] and amount_minor=100) then raise exception 'CLOSURE_LOST_HISTORY';end if;
 proof:=private.execute_operation('organization_reopen_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'operation_key',(pg_temp.bank(1))[1],'org_id',u[5]),u[1],w[1],pg_temp.bank(512),null);
 if proof#>>'{error,code}' is distinct from 'SERVICE_UNAVAILABLE' then raise exception 'UNPAID_REOPEN_ALLOWED %',proof;end if;
 update core.saas_subscriptions set state='active',period_end=clock_timestamp()+interval '2 days' where id=sub_id;
 answer:=pg_temp.invoke('organization_reopen_v1',jsonb_build_object('org_id',u[5]),u[1],w[1]);
 if private.access_mode(u[5])<>'normal' then raise exception 'PAID_REOPEN_FAILED';end if;
 if private.p07_due_allowed(u[5],(select closed_at from private.p07_closure_epochs where org_id=u[5])) or not private.p07_due_allowed(u[5],clock_timestamp()+interval '1 day') then raise exception 'REOPEN_DUE_BOUNDARY_WRONG';end if;

 -- Reopened organizations suppress missed work while keeping every future trigger live.
 update private.p07_closure_epochs set closed_at=clock_timestamp()-interval '2 days',reopened_at=clock_timestamp()-interval '1 hour' where org_id=u[5];
 update core.center_relationships set started_at=clock_timestamp()-interval '5 days' where id=u[34];
 if private.p07_automation_allowed(u[5],u[7],'{"kind":"student_inactive","offset_days":4}',u[34]) then raise exception 'MISSED_INACTIVE_REPLAYED';end if;
 update core.center_relationships set started_at=clock_timestamp() where id=u[34];
 if not private.p07_automation_allowed(u[5],u[7],'{"kind":"student_inactive","offset_days":4}',u[34]) then raise exception 'FUTURE_INACTIVE_SUPPRESSED';end if;
 insert into core.leads(id,org_id,center_id,person_id,source,interest,state) values(w[2],u[5],u[7],u[10],'synthetic','synthetic','open');
 insert into core.crm_activities(id,org_id,center_id,lead_id,kind,due_at) values(w[3],u[5],u[7],w[2],'followup',clock_timestamp()+interval '1 day');
 if private.p07_automation_allowed(u[5],u[7],'{"kind":"lead_followup_due","offset_days":2}',w[3]) then raise exception 'MISSED_FOLLOWUP_REPLAYED';end if;
 update core.crm_activities set due_at=clock_timestamp()+interval '3 days' where id=w[3];
 if not private.p07_automation_allowed(u[5],u[7],'{"kind":"lead_followup_due","offset_days":2}',w[3]) then raise exception 'FUTURE_FOLLOWUP_SUPPRESSED';end if;
 insert into core.products(id,org_id,center_id,name,state) values(w[4],u[5],u[7],'Synthetic filter product','active');
 insert into core.product_versions(id,org_id,center_id,product_id,kind,booking_mode,credits,price_minor,currency,refund_method,freeze_terms,effective_at) values(w[5],u[5],u[7],w[4],'credits','flexible',4,100,'TRY','none','{"enabled":false,"extends_validity":false}',clock_timestamp());
 insert into core.sales(id,org_id,center_id,person_id,product_version_id,net_minor,currency,valid_from,valid_until,state,terms_hash,start_date,end_date,timezone,paid_days) values(w[6],u[5],u[7],u[10],w[5],100,'TRY',clock_timestamp()-interval '10 days',clock_timestamp()+interval '1 day','active','synthetic',current_date-10,current_date+3,'UTC',13);
 if private.p07_automation_allowed(u[5],u[7],'{"kind":"entitlement_expiring","offset_days":2}',w[6]) then raise exception 'MISSED_ENTITLEMENT_REPLAYED';end if;
 insert into core.policy_versions(id,org_id,key,effective_at,mandatory,value) values(w[7],u[5],'entitlement_reminder_days',clock_timestamp(),false,'{"kind":"integer","value":2}');
 if private.p07_reminder_allowed(u[5],u[7],'entitlement',w[6]) then raise exception 'MISSED_ENTITLEMENT_REMINDER_REPLAYED';end if;
 -- Sales are immutable: a different future sale proves the positive path.
 insert into core.sales(id,org_id,center_id,person_id,product_version_id,net_minor,currency,valid_from,valid_until,state,terms_hash,start_date,end_date,timezone,paid_days) values(w[8],u[5],u[7],u[10],w[5],100,'TRY',clock_timestamp()-interval '10 days',clock_timestamp()+interval '3 days','active','synthetic',current_date-10,current_date+3,'UTC',13);
 if not private.p07_automation_allowed(u[5],u[7],'{"kind":"entitlement_expiring","offset_days":2}',w[8]) or not private.p07_reminder_allowed(u[5],u[7],'entitlement',w[8]) then raise exception 'FUTURE_ENTITLEMENT_SUPPRESSED';end if;
 insert into core.disciplines(id,org_id,name,state) values(w[9],u[5],'Synthetic reminder','active');
 insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values(w[10],u[5],u[7],w[9],'active');
 insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values(w[11],u[5],u[7],w[9],'group',clock_timestamp()+interval '12 hours',clock_timestamp()+interval '13 hours',10,10,'planned','open'),(w[12],u[5],u[7],w[9],'group',clock_timestamp()+interval '30 hours',clock_timestamp()+interval '31 hours',10,10,'planned','open');
 insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values(w[13],u[5],u[7],w[11],u[10],'flexible','active',w[7]),(w[14],u[5],u[7],w[12],u[10],'flexible','active',w[7]);
 if private.p07_reminder_allowed(u[5],u[7],'lesson',w[13]) or not private.p07_reminder_allowed(u[5],u[7],'lesson',w[14]) then raise exception 'LESSON_REOPEN_WINDOW_WRONG';end if;
 -- A non-owner account deletion is global and preserves tenant business history.
 preview:=pg_temp.invoke('account_delete_preview_v1','{}',u[31],w[61]);
 if jsonb_array_length(preview->'blockers')<>0 then raise exception 'NON_OWNER_DELETE_BLOCKED';end if;
 proof:=private.execute_operation('account_delete_apply_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'operation_key',w[62],'preview',jsonb_build_object('id',preview->'id','token',preview->'token'),'reauth','never-store-this-proof'),u[31],w[61],pg_temp.bank(512),null);
 if proof#>>'{error,code}' is distinct from 'AUTH_REQUIRED' then raise exception 'DELETE_WITHOUT_REAUTH_ALLOWED %',proof;end if;
 answer:=private.execute_operation('account_delete_apply_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'operation_key',w[62],'preview',jsonb_build_object('id',preview->'id','token',preview->'token'),'reauth','never-store-this-proof'),u[31],w[61],pg_temp.bank(512),jsonb_build_object('reauth_verified',true,'reauth_auth_id',u[31],'reauth_session_id',w[61]));
 if answer->>'ok' is distinct from 'true' then raise exception 'DELETE_APPLY_FAILED %',answer;end if;
 if not exists(select 1 from core.accounts where id=u[31] and state='deletion_pending') or exists(select 1 from core.role_assignments where account_link_id=u[32] and state='active') or exists(select 1 from core.account_links where id=u[32] and state='active') then raise exception 'ACCOUNT_DELETE_ACCESS_NOT_REVOKED';end if;
 if not exists(select 1 from core.privacy_requests where requester_account_id=u[31] and org_id is null and scope->>'kind'='account' and state='requested') then raise exception 'GLOBAL_PRIVACY_TENANT_INVENTED';end if;
 proof:=private.execute_operation('account_get_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1]),u[31],w[61],pg_temp.bank(512),null);
 if proof#>>'{error,code}' is distinct from 'SESSION_REVOKED' then raise exception 'OLD_ACCOUNT_SESSION_STILL_ACTIVE';end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(w[61],u[31],clock_timestamp(),clock_timestamp());
 proof:=private.execute_operation('account_delete_apply_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'operation_key',w[62],'preview',jsonb_build_object('id',preview->'id','token',preview->'token'),'reauth','fresh-proof-not-persisted'),u[31],w[61],pg_temp.bank(512),jsonb_build_object('reauth_verified',true,'reauth_auth_id',u[31],'reauth_session_id',w[61]));
 if proof#>>'{data,job_id}' is distinct from answer#>>'{data,job_id}' then raise exception 'DELETE_LOST_RESPONSE_REPLAY_FAILED %',proof;end if;
 proof:=private.execute_operation('job_status_get_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'org_id',null,'job_id',answer#>'{data,job_id}'),u[31],w[61],pg_temp.bank(512),jsonb_build_object('reauth_verified',true,'reauth_auth_id',u[31],'reauth_session_id',w[61]));
 if proof#>>'{data,privacy,request_state}' is distinct from 'requested' then raise exception 'OWN_GLOBAL_PRIVACY_STATUS_UNAVAILABLE %',proof;end if;
 proof:=private.execute_operation('job_status_get_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'org_id',null,'job_id',answer#>'{data,job_id}'),u[1],w[1],pg_temp.bank(512),jsonb_build_object('reauth_verified',true,'reauth_auth_id',u[1],'reauth_session_id',w[1]));
 if proof#>>'{error,code}' is distinct from 'NOT_FOUND' then raise exception 'FOREIGN_GLOBAL_PRIVACY_STATUS_LEAK %',proof;end if;

 preview:=pg_temp.invoke('organization_delete_preview_v1',jsonb_build_object('org_id',u[5],'reason','synthetic delete','all_data',true),u[1],w[1]);
 answer:=private.execute_operation('organization_delete_apply_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'operation_key',w[63],'org_id',u[5],'all_data',true,'preview',jsonb_build_object('id',preview->'id','token',preview->'token'),'reauth','never-store-this-proof'),u[1],w[1],pg_temp.bank(512),jsonb_build_object('reauth_verified',true,'reauth_auth_id',u[1],'reauth_session_id',w[1]));
 if answer->>'ok' is distinct from 'true' or not exists(select 1 from core.organizations where id=u[5] and state='deletion_pending') then raise exception 'ORG_DELETE_NOT_FENCED %',answer;end if;
 proof:=private.execute_operation('organization_delete_apply_v1',jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'operation_key',w[63],'org_id',u[5],'all_data',true,'preview',jsonb_build_object('id',preview->'id','token',preview->'token'),'reauth','fresh-proof-not-persisted'),u[1],w[1],pg_temp.bank(512),jsonb_build_object('reauth_verified',true,'reauth_auth_id',u[1],'reauth_session_id',w[1]));
 if proof#>>'{data,job_id}' is distinct from answer#>>'{data,job_id}' then raise exception 'ORG_DELETE_LOST_RESPONSE_REPLAY_FAILED %',proof;end if;

 if not exists(select 1 from core.organizations where id=u[6] and state='active') or exists(select 1 from core.privacy_requests where (org_id=u[5] or requester_account_id=u[31]) and state='completed') then raise exception 'FALSE_ERASURE_OR_FOREIGN_ORG_CHANGE';end if;
 if exists(select 1 from private.p07_lifecycle_previews where payload::text like '%never-store-this-proof%') or exists(select 1 from core.audit_events where diff::text like '%never-store-this-proof%') then raise exception 'REAUTH_PROOF_PERSISTED';end if;
 set constraints all immediate;
 raise notice 'BILLING PROBE OK: exact ratio, partial payment, renewal anchor, same period, downgrade date/cancel, kept center, retained data, voluntary no grace, fenced worker';
end$probe$;
select 'billing rollback probes passed' as verified;
