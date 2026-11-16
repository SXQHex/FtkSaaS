-- Synthetic fixtures only; caller uses BEGIN/ROLLBACK.
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
create temporary table member_context(org uuid,center uuid,other_center uuid,auth uuid,session uuid,actor uuid,source uuid,target uuid,third uuid,room uuid) on commit drop;
create temporary table member_responses(operation text,request jsonb,response jsonb) on commit drop;
create function pg_temp.member_call(op text,body jsonb) returns jsonb language plpgsql as $$
declare c pg_temp.member_context;r jsonb;result jsonb;
begin
 select * into c from pg_temp.member_context;
 r:=jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'org_id',c.org,'center_id',c.center)||body;
 if op not like '%_get_v1' and op not like '%_list_v1' and op not like '%_preview_v1' and not r?'operation_key' then r:=r||jsonb_build_object('operation_key',(pg_temp.bank(1))[1]);end if;
 if op in ('operation_status_get_v1','preview_get_v1') then r:=r-'center_id';end if;
 result:=private.execute_operation(op,r,c.auth,c.session,pg_temp.bank(512),jsonb_build_object('token',encode(extensions.gen_random_bytes(32),'hex')));
 insert into pg_temp.member_responses values(op,r,result);
 return result;
end$$;
create function pg_temp.member_must(op text,body jsonb) returns jsonb language plpgsql as $$
declare r jsonb:=pg_temp.member_call(op,body);
begin if r->>'ok' is distinct from 'true' then raise exception 'WEB1_OPERATION_FAILED % %',op,r;end if;return r->'data';end$$;
do $setup$
declare x uuid[]:=pg_temp.bank(32);features text[];p uuid;v jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(x[4],'member-probe@example.invalid',now());
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(x[5],x[4],now(),now(),'aal1');
 insert into core.accounts(id,auth_user_id,state) values(x[6],x[4],'active');
 insert into core.organizations(id,org_id,name,owner_person_id,state) values(x[1],x[1],'Synthetic member review',x[7],'active');
 insert into core.people(id,org_id,display_name,state) values(x[7],x[1],'Probe manager','active'),(x[8],x[1],'Match A','active'),(x[9],x[1],'Match B','active'),(x[10],x[1],'Match C','active');
 insert into core.centers(id,org_id,center_id,name,timezone,state) values(x[2],x[1],x[2],'Probe center','UTC','active'),(x[3],x[1],x[3],'Other center','UTC','active');
 insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values(x[11],x[1],x[6],x[7],'active',now());
 insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values(x[12],x[1],x[7],'center_manager',x[2],'active',x[11]);
 foreach p in array array[x[8],x[9],x[10]] loop insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values((pg_temp.bank(1))[1],x[1],x[2],p,'student','active',now());end loop;
 select array_agg('F'||lpad(i::text,2,'0')) into features from generate_series(1,33) i;
 insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) values(x[13],'business',now(),1000,'TRY','monthly','{"entries":[]}',features);
 insert into core.saas_subscriptions(id,org_id,plan_version_id,state,starts_at,period_end,cancel_at_period_end) values(x[14],x[1],x[13],'active',now(),now()+interval '1 month',false);
 insert into core.rooms(id,org_id,center_id,name,state) values(x[15],x[1],x[2],'Probe room','active');
 insert into core.person_contacts(id,org_id,person_id,kind,value) values(x[16],x[1],x[8],'email','same@example.invalid'),(x[17],x[1],x[9],'email','SAME@example.invalid'),(x[18],x[1],x[10],'email','same@example.invalid');
 perform set_config('request.jwt.claim.role','service_role',true);
 insert into pg_temp.member_context values(x[1],x[2],x[3],x[4],x[5],x[7],x[8],x[9],x[10],x[15]);
end$setup$;
do $roster$
declare c pg_temp.member_context;d uuid:=(pg_temp.bank(1))[1];sid uuid:=(pg_temp.bank(1))[1];w1 uuid:=(pg_temp.bank(1))[1];w2 uuid:=(pg_temp.bank(1))[1];w3 uuid:=(pg_temp.bank(1))[1];offer uuid:=(pg_temp.bank(1))[1];o2 uuid:=(pg_temp.bank(1))[1];b jsonb;p jsonb;q jsonb;cursor text;original_actor uuid;plan uuid;saved_features text[];before_count bigint;
begin
 select * into c from pg_temp.member_context;original_actor:=c.actor;
 insert into core.disciplines(id,org_id,name,state) values(d,c.org,'Roster discipline','active');
 insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values((pg_temp.bank(1))[1],c.org,c.center,d,'active');
 insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values(sid,c.org,c.center,d,'group',now()+interval '3 days',now()+interval '3 days 1 hour',10,10,'planned','open');
 -- Deliberately reverse created/joined order; FIFO is joined_at and UUID.
 insert into core.waitlist_entries(id,org_id,center_id,session_id,person_id,joined_at,created_at,state) values
 (w1,c.org,c.center,sid,c.source,now()-interval '3 hours',now(),'waiting'),
 (w2,c.org,c.center,sid,c.target,now()-interval '2 hours',now()-interval '1 day','waiting'),
 (w3,c.org,c.center,sid,c.third,now()-interval '1 hour',now(),'closed');
 insert into core.seat_offers(id,org_id,center_id,session_id,entry_id,person_id,expires_at,state) values
 (offer,c.org,c.center,sid,w3,c.third,now()-interval '1 hour','expired'),(o2,c.org,c.center,sid,w3,c.third,now()+interval '1 hour','rejected');
 b:=jsonb_build_object('operation','waitlist_join_v1','selector',jsonb_build_object('operation','waitlist_join_v1','key',jsonb_build_object('directory','session','session_id',sid,'view','entries','status','waiting')),'page',jsonb_build_object('limit',1));
 select count(*) into before_count from core.operation_receipts where org_id=c.org;
 p:=pg_temp.member_must('management_state_get_v1',b);cursor:=p->>'next_cursor';
 if p#>>'{items,0,entity,id}'<>w1::text or p#>>'{items,0,waitlist_display_name}'<>'Match A' or p#>>'{items,0,waitlist_detail,state}'<>'waiting' or p#>'{items,0,waitlist_detail,offers}'<>'[]'::jsonb or cursor is null then raise exception 'FIFO_FIRST_WRONG %',p;end if;
 p:=pg_temp.member_must('management_state_get_v1',b||jsonb_build_object('page',jsonb_build_object('limit',1,'cursor',cursor)));
 if p#>>'{items,0,entity,id}'<>w2::text or p->>'next_cursor' is not null then raise exception 'FIFO_SECOND_WRONG %',p;end if;
 p:=pg_temp.member_call('management_state_get_v1',jsonb_set(b,'{selector,key,status}','"all"')||jsonb_build_object('page',jsonb_build_object('cursor',cursor)));
 if p#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'FIFO_FILTER_CURSOR_UNBOUND %',p;end if;
 p:=pg_temp.member_call('management_state_get_v1',b||jsonb_build_object('center_id',c.other_center));if p->>'ok'='true' then raise exception 'FIFO_OTHER_CENTER_LEAK';end if;
 p:=pg_temp.member_must('management_state_get_v1',jsonb_set(b,'{selector,key,view}','"offers"')#-'{selector,key,status}');
 if jsonb_array_length(p->'items')<>1 or jsonb_array_length(p#>'{items,0,waitlist_detail,offers}')<>1 or p->>'next_cursor' is null then raise exception 'OFFER_PAGE_UNBOUNDED %',p;end if;
 q:=pg_temp.member_must('management_state_get_v1',(jsonb_set(b,'{selector,key,view}','"offers"')#-'{selector,key,status}')||jsonb_build_object('page',jsonb_build_object('limit',1,'cursor',p->>'next_cursor')));
 if q->>'next_cursor' is not null or jsonb_array_length(q->'items')<>1 or q#>>'{items,0,entity,id}'=p#>>'{items,0,entity,id}' then raise exception 'OFFER_HISTORY_INCOMPLETE %',q;end if;
 if (select count(*) from core.operation_receipts where org_id=c.org)<>before_count then raise exception 'ROSTER_READ_WROTE_RECEIPT';end if;
 -- A self identity may use the old person reader, but cannot browse others.
 update core.account_links set person_id=c.source where org_id=c.org and account_id=(select id from core.accounts where auth_user_id=c.auth);
 p:=pg_temp.member_call('management_state_get_v1',b);if p#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'ROSTER_SELF_ESCALATION %',p;end if;
 update core.account_links set person_id=original_actor where org_id=c.org and account_id=(select id from core.accounts where auth_user_id=c.auth);
 select plan_version_id into plan from core.saas_subscriptions where org_id=c.org;select f.features into saved_features from core.saas_plan_versions f where id=plan;
 update core.saas_plan_versions set features=array_remove(saved_features,'F12') where id=plan;
 p:=pg_temp.member_call('management_state_get_v1',b);if p#>>'{error,code}' is distinct from 'PLAN_FEATURE_UNAVAILABLE' then raise exception 'ROSTER_F12_BYPASS %',p;end if;
 update core.saas_plan_versions set features=saved_features||array['F12'] where id=plan;
 update core.saas_subscriptions set state='pending_payment' where org_id=c.org;
 p:=pg_temp.member_call('management_state_get_v1',b);if p#>>'{error,code}' is distinct from 'SUBSCRIPTION_NOT_STARTED' then raise exception 'ROSTER_BOOTSTRAP_BYPASS %',p;end if;
 update core.saas_subscriptions set state='suspended' where org_id=c.org;
 p:=pg_temp.member_call('management_state_get_v1',b);if p#>>'{error,code}' is distinct from 'SERVICE_UNAVAILABLE' then raise exception 'ROSTER_SUBSCRIPTION_CLOSED_BYPASS %',p;end if;
 update core.saas_subscriptions set state='active' where org_id=c.org;
 update core.organizations set state='closed' where id=c.org;
 p:=pg_temp.member_call('management_state_get_v1',b);if p#>>'{error,code}' is distinct from 'SERVICE_UNAVAILABLE' then raise exception 'ROSTER_ORG_CLOSED_BYPASS %',p;end if;
 update core.organizations set state='active' where id=c.org;
 insert into core.saas_change_requests(id,org_id,target_plan_id,effective_at,state) values((pg_temp.bank(1))[1],c.org,plan,now()-interval '1 minute','scheduled');
 p:=pg_temp.member_call('management_state_get_v1',b);if p#>>'{error,code}' is distinct from 'OPERATION_IN_PROGRESS' then raise exception 'ROSTER_PENDING_BOUNDARY_BYPASS %',p;end if;
 delete from core.saas_change_requests where org_id=c.org and source_plan_id is null;

 update core.role_assignments set state='inactive' where org_id=c.org and person_id=original_actor and role='center_manager';
 p:=pg_temp.member_call('management_state_get_v1',b||jsonb_build_object('page',jsonb_build_object('cursor',cursor)));if p->>'ok'='true' then raise exception 'ROSTER_STALE_ROLE_CURSOR';end if;
 update core.role_assignments set state='active' where org_id=c.org and person_id=original_actor and role='center_manager';
end$roster$;
do $source$
declare c pg_temp.member_context;d uuid;terms jsonb;product uuid;sale uuid;sale2 uuid;sid uuid;sid2 uuid;rid uuid;rid2 uuid;policy uuid:=(pg_temp.bank(1))[1];p jsonb;q jsonb;b jsonb;plan uuid;saved_features text[];saved_end date;original_actor uuid;unassigned uuid:=(pg_temp.bank(1))[1];alias_id uuid:=(pg_temp.bank(1))[1];ss jsonb;
begin
 select * into c from pg_temp.member_context;original_actor:=c.actor;select id into d from core.disciplines where org_id=c.org limit 1;
 perform pg_temp.member_must('policy_publish_v1',jsonb_build_object('center_id',null,'key','debt_booking','value',jsonb_build_object('kind','boolean','value',false),'effective_at',clock_timestamp(),'mandatory',false));
 perform pg_temp.member_must('policy_publish_v1',jsonb_build_object('center_id',null,'key','reservation_window','value',jsonb_build_object('kind','window','opens_minutes_before',600000,'closes_minutes_before',0,'manager_exception',false),'effective_at',clock_timestamp(),'mandatory',false));
 terms:=jsonb_build_object('name','Original package','kind','credits','booking_mode','flexible','credits',8,'price_minor','800','currency','TRY','freeze',jsonb_build_object('enabled',false,'extends_validity',false),'refund',jsonb_build_object('method','none'),'scopes',jsonb_build_array(jsonb_build_object('scope_kind','organization_all','center_id',null,'discipline_id',null,'usage_targets',jsonb_build_array('lesson'))));
 product:=(pg_temp.member_must('product_publish_v1',jsonb_build_object('terms',terms))->>'primary_id')::uuid;
 p:=pg_temp.member_must('sale_preview_v1',jsonb_build_object('person_id',c.source,'product_version_id',product,'start_date',(current_date+1)::text,'end_date',(current_date+30)::text));
 sale:=(pg_temp.member_must('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')))->>'primary_id')::uuid;
 p:=pg_temp.member_must('sale_preview_v1',jsonb_build_object('person_id',c.source,'product_version_id',product,'start_date',(current_date+1)::text,'end_date',(current_date+40)::text));
 sale2:=(pg_temp.member_must('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')))->>'primary_id')::uuid;
 p:=pg_temp.member_must('session_create_v1',jsonb_build_object('class_id',null,'discipline_id',d,'format','group','interval',jsonb_build_object('starts_at',(current_date+3)::timestamptz+interval '12 hours','ends_at',(current_date+3)::timestamptz+interval '13 hours'),'resources','[]'::jsonb,'assignments','[]'::jsonb,'capacity',jsonb_build_object('total',10)));
 sid:=(p->>'primary_id')::uuid;
 insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values(policy,c.org,c.center,'student_cancel_group',now(),false,'{"kind":"cancellation","terms":{"cutoff_minutes":0,"before_cutoff":"release","after_cutoff":"consume","no_show":"consume"}}');
 -- Explicitly use the later sale, not the oldest/first eligible one.
 rid:=(pg_temp.member_must('reservation_create_v1',jsonb_build_object('session_id',sid,'person_id',c.source,'mode','flexible','source_sale_id',sale2))->>'primary_id')::uuid;
 insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values(unassigned,c.org,c.center,sid,c.target,'flexible','active',policy);
 b:=jsonb_build_object('session_id',sid,'page',jsonb_build_object('limit',200),'include_source_summary',true);
 p:=pg_temp.member_must('reservation_list_v1',b);
 select x->'source_summary' into ss from jsonb_array_elements(p->'items') x where x->>'id'=rid::text;
 if ss->>'source_sale_id'<>sale2::text or ss->>'product_name'<>'Original package' or ss->>'available_credits'<>'7' or ss->>'reserved'<>'1' or ss ? 'account_id' then raise exception 'RESERVATION_SOURCE_NOT_ACTUAL %',ss;end if;
 select x->'source_summary' into ss from jsonb_array_elements(p->'items') x where x->>'id'=unassigned::text;
 if ss->>'status'<>'unassigned' or ss ? 'source_sale_id' then raise exception 'SOURCE_NONE_INFERRED %',ss;end if;
 p:=pg_temp.member_must('reservation_list_v1',b||jsonb_build_object('page',jsonb_build_object('limit',1)));
 if jsonb_array_length(p->'items')<>1 or p->>'next_cursor' is null then raise exception 'SOURCE_PAGE_NOT_BOUNDED %',p;end if;
 q:=pg_temp.member_call('reservation_list_v1',(b-'include_source_summary')||jsonb_build_object('page',jsonb_build_object('limit',1,'cursor',p->>'next_cursor')));
 if q#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'SOURCE_OPTIN_CURSOR_UNBOUND %',q;end if;
 p:=pg_temp.member_must('reservation_list_v1',b-'include_source_summary');if exists(select 1 from jsonb_array_elements(p->'items') x where x ? 'source_summary') then raise exception 'SOURCE_SUMMARY_NOT_OPTIN';end if;
 update core.products set name='Renamed product' where org_id=c.org;
 update core.sales set state='terminated',end_date=current_date-1,valid_until=now()-interval '1 day' where id=sale2;
 p:=pg_temp.member_must('reservation_list_v1',b);
 select x->'source_summary' into ss from jsonb_array_elements(p->'items') x where x->>'id'=rid::text;
 if ss->>'source_sale_id'<>sale2::text or ss->>'sale_state'<>'terminated' or ss->>'available_credits'<>'0' or ss->>'product_name'<>'Original package' then raise exception 'HISTORICAL_SOURCE_HIDDEN_OR_RELABELED %',ss;end if;
 -- Remove the separate owner grant: roster-only staff must not inherit owner rights.
 update core.organizations set owner_person_id=c.third where id=c.org;
 -- Create a valid cross-center Business reservation; never move a sale away
 -- from its entitlement account/debt FK scope just to simulate a hidden source.
 sid2:=(pg_temp.bank(1))[1];rid2:=(pg_temp.bank(1))[1];
 insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values((pg_temp.bank(1))[1],c.org,c.other_center,d,'active');
 insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values((pg_temp.bank(1))[1],c.org,c.other_center,c.source,'student','active',now());
 insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values(sid2,c.org,c.other_center,d,'group',now()+interval '4 days',now()+interval '4 days 1 hour',10,10,'planned','open');
 insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id,source_sale_id) values(rid2,c.org,c.other_center,sid2,c.source,'flexible','active',policy,sale2);
 update core.role_assignments set scope_center_id=c.other_center where org_id=c.org and person_id=original_actor and role='center_manager';
 p:=pg_temp.member_must('reservation_list_v1',b||jsonb_build_object('center_id',c.other_center,'session_id',sid2));
 select x->'source_summary' into ss from jsonb_array_elements(p->'items') x where x->>'id'=rid2::text;
 if ss->>'status'<>'restricted' or ss ? 'source_sale_id' then raise exception 'CROSS_CENTER_SOURCE_LEAK %',ss;end if;
 update core.role_assignments set scope_center_id=c.center where org_id=c.org and person_id=original_actor and role='center_manager';


 -- Role permits roster but not the no-session entitlement reader.
 update core.role_assignments set state='inactive' where org_id=c.org and person_id=original_actor and role='center_manager';
 insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) select (pg_temp.bank(1))[1],c.org,original_actor,'staff',c.center,'active',id from core.account_links where org_id=c.org and person_id=original_actor;
 insert into core.permission_overrides(id,org_id,person_id,center_id,permission,enabled) values((pg_temp.bank(1))[1],c.org,original_actor,c.center,'reservation.write',true);
 p:=pg_temp.member_must('reservation_list_v1',b);
 if exists(select 1 from jsonb_array_elements(p->'items') x where x#>>'{source_summary,status}'<>'restricted' or x#>'{source_summary}' ? 'source_sale_id') then raise exception 'ROSTER_LEAKED_RIGHTS %',p;end if;
 update core.role_assignments set state='active' where org_id=c.org and person_id=original_actor and role='center_manager';
 select plan_version_id into plan from core.saas_subscriptions where org_id=c.org;select f.features into saved_features from core.saas_plan_versions f where id=plan;
 update core.saas_plan_versions set features=array_remove(saved_features,'F16') where id=plan;
 update core.product_versions set kind='timed' where id=product;
 p:=pg_temp.member_must('reservation_list_v1',b);
 select x->'source_summary' into ss from jsonb_array_elements(p->'items') x where x->>'id'=rid::text;
 if ss->>'status'<>'not_enabled' or ss ? 'source_sale_id' then raise exception 'TIMED_SOURCE_PLAN_BYPASS %',ss;end if;
 update core.saas_plan_versions set features=saved_features||array['F16'] where id=plan;
 p:=pg_temp.member_must('reservation_list_v1',b);
 select x->'source_summary' into ss from jsonb_array_elements(p->'items') x where x->>'id'=rid::text;
 if ss->>'status'<>'available' or ss->>'kind'<>'timed' or ss->'available_credits'<>'null'::jsonb then raise exception 'TIMED_SOURCE_FABRICATED_CREDITS %',ss;end if;
 insert into core.people(id,org_id,display_name,state,merged_into_id) values(alias_id,c.org,'Legacy source alias','merged',c.source);
 update core.reservations set person_id=alias_id where id=rid;
 p:=pg_temp.member_must('reservation_list_v1',b);
 select x->'source_summary' into ss from jsonb_array_elements(p->'items') x where x->>'id'=rid::text;
 if ss is null or ss->>'status'<>'available' or ss->>'source_sale_id'<>sale2::text then raise exception 'CANONICAL_SOURCE_ALIAS_LOST %',ss;end if;
end$source$;
