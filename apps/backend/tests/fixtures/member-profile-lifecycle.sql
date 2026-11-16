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
create temporary table member_time_pages(first_page jsonb,expected_ids jsonb,all_ids jsonb) on commit drop;
create temporary table member_clock(value timestamptz) on commit drop;
create function pg_temp.member_clock() returns timestamptz language sql volatile as $$select value from pg_temp.member_clock$$;
do $member_time_first$
declare c pg_temp.member_context;d uuid:=(pg_temp.bank(1))[1];policy uuid:=(pg_temp.bank(1))[1];sid uuid;rid uuid;at_time timestamptz:=statement_timestamp();i int;r jsonb;all_ids jsonb:='[]';upcoming jsonb:='[]';body jsonb;
begin
 select * into c from pg_temp.member_context;
 insert into core.disciplines(id,org_id,name,state) values(d,c.org,'Time test','active');
 insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values((pg_temp.bank(1))[1],c.org,c.center,d,'active');
 insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values(policy,c.org,c.center,'student_cancel_group',now(),false,'{"kind":"cancellation","terms":{"cutoff_minutes":0,"before_cutoff":"release","after_cutoff":"consume","no_show":"consume"}}');
 for i in 1..5 loop
  sid:=(pg_temp.bank(1))[1];rid:=(pg_temp.bank(1))[1];
  insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state)
  values(sid,c.org,c.center,d,'group',at_time+case when i=1 then interval '-2 hours' when i=2 then interval '-30 minutes' when i in (3,4) then interval '0' else interval '1 hour' end,at_time+case when i=1 then interval '-1 hour' when i=2 then interval '30 minutes' else interval '2 hours' end,10,10,'planned','open');
  insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values(rid,c.org,c.center,sid,c.source,'flexible','active',policy);
  all_ids:=all_ids||to_jsonb(rid);if i>=3 then upcoming:=upcoming||to_jsonb(rid);end if;
 end loop;
 select jsonb_agg(v.id order by s.starts_at,v.id),jsonb_agg(v.id order by s.starts_at,v.id) filter(where s.starts_at>=at_time)
 into all_ids,upcoming from core.reservations v join core.sessions s on s.org_id=v.org_id and s.id=v.session_id where v.org_id=c.org and v.person_id=c.source and v.center_id=c.center;
 body:=jsonb_build_object('person_id',c.source,'time_filter','upcoming','page',jsonb_build_object('limit',1,'sort','starts_at_asc'));
 r:=pg_temp.member_must('reservation_list_v1',body);
 if jsonb_array_length(r->'items')<>1 or r#>>'{items,0,id}'<>upcoming->>0 or r->>'next_cursor' is null or (r->>'as_of')::timestamptz<>at_time then raise exception 'TIME_EQUAL_BOUNDARY_FAILED %',r;end if;
 insert into pg_temp.member_time_pages values(r,upcoming,all_ids);
 r:=pg_temp.member_must('reservation_list_v1',body||jsonb_build_object('time_filter','past','page',jsonb_build_object('limit',200,'sort','starts_at_asc')));
 if (select jsonb_agg(v->'id' order by n) from jsonb_array_elements(r->'items') with ordinality e(v,n))<>jsonb_build_array(all_ids->0,all_ids->1) then raise exception 'TIME_ONGOING_NOT_ONLY_PAST %',r;end if;
 r:=pg_temp.member_must('reservation_list_v1',body||jsonb_build_object('time_filter','all','page',jsonb_build_object('limit',200,'sort','starts_at_asc')));
 if jsonb_array_length(r->'items')<>5 then raise exception 'TIME_ALL_INCOMPLETE';end if;
 r:=pg_temp.member_must('reservation_list_v1',body-'time_filter'||jsonb_build_object('page',jsonb_build_object('limit',200,'sort','starts_at_asc')));
 if jsonb_array_length(r->'items')<>5 then raise exception 'TIME_LEGACY_CHANGED';end if;
end$member_time_first$;
-- A separate statement has a later server clock. Both sessions exactly on the
-- original boundary must still be upcoming, even when split across pages.
do $member_time_next$
declare c pg_temp.member_context;p pg_temp.member_time_pages;r jsonb;b jsonb;seen jsonb;cursor_value text;f text;
begin
 select * into c from pg_temp.member_context;select * into p from pg_temp.member_time_pages;
 b:=jsonb_build_object('person_id',c.source,'time_filter','upcoming','page',jsonb_build_object('limit',1,'sort','starts_at_asc','cursor',p.first_page->'next_cursor'));
 r:=pg_temp.member_must('reservation_list_v1',b);
 if r->'as_of'<>p.first_page->'as_of' or r#>>'{items,0,id}'<>p.expected_ids->>1 then raise exception 'TIME_CUTOFF_MOVED %',r;end if;
 r:=pg_temp.member_must('reservation_list_v1',jsonb_set(b,'{page,cursor}',r->'next_cursor'));
 if r#>>'{items,0,id}'<>p.expected_ids->>2 or r->'next_cursor'<>'null'::jsonb then raise exception 'TIME_CURSOR_MISSED_RECORD %',r;end if;
 foreach f in array array['all','past'] loop
  r:=pg_temp.member_call('reservation_list_v1',b||jsonb_build_object('time_filter',f));if r#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'TIME_FILTER_REBOUND %',r;end if;
 end loop;
 r:=pg_temp.member_call('reservation_list_v1',b||jsonb_build_object('person_id',c.target));if r#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'TIME_PERSON_REBOUND %',r;end if;
 r:=pg_temp.member_call('reservation_list_v1',b||jsonb_build_object('center_id',c.other_center));if r#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'TIME_CENTER_REBOUND %',r;end if;
 r:=pg_temp.member_call('reservation_list_v1',jsonb_set(b,'{page,sort}','"created_at_desc"'));if r#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'TIME_SORT_REBOUND %',r;end if;
 -- Authority is evaluated on every page; cursor possession never grants access.
 update core.account_links set state='revoked' where org_id=c.org and person_id=c.actor;
 r:=pg_temp.member_call('reservation_list_v1',b);if r->>'ok'='true' then raise exception 'TIME_REVOKED_AUTHORITY_ALLOWED';end if;
 update core.account_links set state='active' where org_id=c.org and person_id=c.actor;
end$member_time_next$;
do $member_cancel$
#variable_conflict use_variable
declare c pg_temp.member_context;d uuid;terms jsonb;product uuid;sale uuid;sid uuid;rid uuid;tail_id uuid;freeze_id uuid;p jsonb;r jsonb;b jsonb;f jsonb;before_movements jsonb;before_allocations jsonb;k uuid;base_end date:=current_date+30;st date:=current_date+3;en date:=current_date+7;original_dates jsonb;plan_id uuid;features text[];original_fn text;
begin
 select * into c from pg_temp.member_context;select id into d from core.disciplines where org_id=c.org limit 1;
 perform pg_temp.member_must('policy_publish_v1',jsonb_build_object('center_id',null,'key','debt_booking','value',jsonb_build_object('kind','boolean','value',false),'effective_at',clock_timestamp(),'mandatory',false));
 perform pg_temp.member_must('policy_publish_v1',jsonb_build_object('center_id',null,'key','reservation_window','value',jsonb_build_object('kind','window','opens_minutes_before',600000,'closes_minutes_before',0,'manager_exception',false),'effective_at',clock_timestamp(),'mandatory',false));
 terms:=jsonb_build_object('name','Planned cancellation','kind','credits','booking_mode','flexible','credits',8,'price_minor','800','currency','TRY','freeze',jsonb_build_object('enabled',true,'extends_validity',true,'max_days',10),'refund',jsonb_build_object('method','none'),'scopes',jsonb_build_array(jsonb_build_object('scope_kind','organization_all','center_id',null,'discipline_id',null,'usage_targets',jsonb_build_array('lesson'))));
 product:=(pg_temp.member_must('product_publish_v1',jsonb_build_object('terms',terms))->>'primary_id')::uuid;
 p:=pg_temp.member_must('sale_preview_v1',jsonb_build_object('person_id',c.source,'product_version_id',product,'start_date',(current_date+1)::text,'end_date',base_end::text));
 sale:=(pg_temp.member_must('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')))->>'primary_id')::uuid;
 p:=pg_temp.member_must('session_create_v1',jsonb_build_object('class_id',null,'discipline_id',d,'format','group','interval',jsonb_build_object('starts_at',st::timestamptz+interval '12 hours','ends_at',st::timestamptz+interval '13 hours'),'resources','[]'::jsonb,'assignments','[]'::jsonb,'capacity',jsonb_build_object('total',10)));
 sid:=(p->>'primary_id')::uuid;
 rid:=(pg_temp.member_must('reservation_create_v1',jsonb_build_object('session_id',sid,'person_id',c.source,'mode','flexible','source_sale_id',sale))->>'primary_id')::uuid;
 p:=pg_temp.member_must('freeze_preview_v1',jsonb_build_object('sale_id',sale,'dates',jsonb_build_object('start_date',st::text,'end_date',en::text),'reason','Plan freeze'));
 freeze_id:=(pg_temp.member_must('freeze_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')))->>'primary_id')::uuid;
 if private.available_for(c.org,sale,st::timestamptz+interval '12 hours')<>0 then raise exception 'FREEZE_DID_NOT_RESTRICT';end if;
 -- A later independent extension is not owned by the freeze being cancelled.
 update core.sales set end_date=end_date+2,valid_until=valid_until+interval '2 days',version=version+1 where id=sale;
 -- A confirmed reservation in the extension tail must survive the shortening.
 p:=pg_temp.member_must('session_create_v1',jsonb_build_object('class_id',null,'discipline_id',d,'format','group','interval',jsonb_build_object('starts_at',(base_end+5)::timestamptz+interval '12 hours','ends_at',(base_end+5)::timestamptz+interval '13 hours'),'resources','[]'::jsonb,'assignments','[]'::jsonb,'capacity',jsonb_build_object('total',10)));
 tail_id:=(pg_temp.member_must('reservation_create_v1',jsonb_build_object('session_id',p->'primary_id','person_id',c.source,'mode','flexible','source_sale_id',sale))->>'primary_id')::uuid;
 select jsonb_agg(to_jsonb(m) order by id) into before_movements from core.entitlement_movements m where m.sale_id=sale;
 select jsonb_agg(to_jsonb(m) order by id) into before_allocations from core.entitlement_allocations m where m.sale_id=sale;
 select jsonb_build_object('starts_at',starts_at,'planned_end',planned_end,'actual_end',actual_end) into original_dates from core.freezes where id=freeze_id;
 b:=jsonb_build_object('freeze_id',freeze_id,'reason','Cancel planned freeze');p:=pg_temp.member_must('freeze_cancel_preview_v1',b);
 if p#>>'{freeze_cancellation,removed_extension_days}'<>'4' or (p#>>'{freeze_cancellation,end_date}')::date<>base_end+2 or p#>>'{freeze_cancellation,preserves_reservations}'<>'true' then raise exception 'CANCEL_IMPACT_WRONG %',p;end if;
 if not exists(select 1 from jsonb_array_elements(p->'effects') x where x#>>'{entity,id}'=tail_id::text) then raise exception 'CANCEL_TAIL_OBLIGATION_HIDDEN';end if;
 r:=pg_temp.member_must('preview_get_v1',jsonb_build_object('preview_id',p->'id'));if r->'freeze_cancellation'<>p->'freeze_cancellation' then raise exception 'CANCEL_PREVIEW_RECOVERY_LOST_IMPACT';end if;
 r:=pg_temp.member_call('freeze_cancel_preview_v1',b||jsonb_build_object('center_id',c.other_center));if r->>'ok'='true' then raise exception 'CANCEL_WRONG_CENTER_ALLOWED';end if;
 update core.role_assignments set state='inactive' where org_id=c.org and person_id=c.actor and role='center_manager';
 r:=pg_temp.member_call('freeze_cancel_preview_v1',b);if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'CANCEL_NONMANAGER_ALLOWED %',r;end if;
 update core.role_assignments set state='active' where org_id=c.org and person_id=c.actor and role='center_manager';
 r:=pg_temp.member_call('freeze_cancel_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token','wrong-approval-token')));if r#>>'{error,code}' is distinct from 'PREVIEW_STALE' then raise exception 'CANCEL_WRONG_TOKEN_ALLOWED %',r;end if;
 -- A changed sale invalidates approval; a fresh preview retains the new end.
 update core.sales set version=version+1 where id=sale;
 r:=pg_temp.member_call('freeze_cancel_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')));if r#>>'{error,code}' is distinct from 'PREVIEW_STALE' then raise exception 'CANCEL_STALE_SALE_ALLOWED %',r;end if;
 p:=pg_temp.member_must('freeze_cancel_preview_v1',b);
 select plan_version_id into plan_id from core.saas_subscriptions where org_id=c.org;select q.features into features from core.saas_plan_versions q where id=plan_id;
 update core.saas_plan_versions set features=array_remove(features,'F17') where id=plan_id;
 r:=pg_temp.member_call('freeze_cancel_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')));if r#>>'{error,code}' is distinct from 'PLAN_FEATURE_UNAVAILABLE' then raise exception 'CANCEL_PLAN_GATE_BYPASSED %',r;end if;
 update core.saas_plan_versions set features=features||array['F17'] where id=plan_id;
 p:=pg_temp.member_must('freeze_cancel_preview_v1',b);
 -- Crossing the start between preview and apply must fail without mutation.
 update core.freezes set starts_at=clock_timestamp()-interval '1 second',version=version+1 where id=freeze_id;
 r:=pg_temp.member_call('freeze_cancel_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')));if r#>>'{error,code}' is distinct from 'PREVIEW_STALE' then raise exception 'CANCEL_STARTED_APPROVAL_ALLOWED %',r;end if;
 r:=pg_temp.member_call('freeze_cancel_preview_v1',b);if r#>>'{error,code}' is distinct from 'INVALID_STATE_TRANSITION' then raise exception 'CANCEL_STARTED_PREVIEW_ALLOWED %',r;end if;
 update core.freezes set starts_at=(original_dates->>'starts_at')::timestamptz,version=version+1 where id=freeze_id;
 p:=pg_temp.member_must('freeze_cancel_preview_v1',b);k:=(pg_temp.bank(1))[1];b:=jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token'),'operation_key',k);
 r:=pg_temp.member_must('freeze_cancel_apply_v1',b);f:=pg_temp.member_must('freeze_cancel_apply_v1',b);if f->>'replayed'<>'true' or f-'replayed'<>r-'replayed' then raise exception 'CANCEL_REPLAY_CHANGED';end if;
 r:=pg_temp.member_call('freeze_cancel_apply_v1',jsonb_set(b,'{preview,token}','"changed-payload-token"'));if r#>>'{error,code}' is distinct from 'IDEMPOTENCY_PAYLOAD_MISMATCH' then raise exception 'CANCEL_KEY_PAYLOAD_UNBOUND %',r;end if;
 r:=pg_temp.member_call('freeze_cancel_apply_v1',b-'operation_key');if r#>>'{error,code}' is distinct from 'PREVIEW_STALE' then raise exception 'CANCEL_APPLIED_PREVIEW_REUSED %',r;end if;
 update core.role_assignments set state='inactive' where org_id=c.org and person_id=c.actor and role='center_manager';
 r:=pg_temp.member_call('freeze_cancel_apply_v1',b);if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'CANCEL_REPLAY_BYPASSED_LIVE_ROLE %',r;end if;
 update core.role_assignments set state='active' where org_id=c.org and person_id=c.actor and role='center_manager';
 r:=pg_temp.member_call('freeze_cancel_preview_v1',jsonb_build_object('freeze_id',freeze_id,'reason','Already cancelled'));if r#>>'{error,code}' is distinct from 'INVALID_STATE_TRANSITION' then raise exception 'CANCELLED_FREEZE_CANCELLED_AGAIN %',r;end if;
 if not exists(select 1 from core.freezes where id=freeze_id and state='cancelled' and extension_until is null and jsonb_build_object('starts_at',starts_at,'planned_end',planned_end,'actual_end',actual_end)=original_dates) then raise exception 'CANCEL_ERASED_HISTORY';end if;
 if (select end_date from core.sales where id=sale)<>base_end+2 then raise exception 'CANCEL_REMOVED_UNRELATED_EXTENSION';end if;
 if (select jsonb_agg(to_jsonb(m) order by id) from core.entitlement_movements m where m.sale_id=sale) is distinct from before_movements or (select jsonb_agg(to_jsonb(m) order by id) from core.entitlement_allocations m where m.sale_id=sale) is distinct from before_allocations then raise exception 'CANCEL_CHANGED_RIGHTS_LEDGER';end if;
 if (select count(*) from core.reservations where id in (rid,tail_id) and state='active')<>2 then raise exception 'CANCEL_DROPPED_CONFIRMED_RESERVATION';end if;
 if private.available_for(c.org,sale,st::timestamptz+interval '12 hours')<=0 then raise exception 'CANCEL_DID_NOT_RESTORE_ELIGIBILITY';end if;
 if private.available_for(c.org,sale,(base_end+5)::timestamptz+interval '12 hours')<>0 then raise exception 'CANCEL_LEFT_TAIL_ELIGIBILITY';end if;
 -- Cancelled days no longer count against max_days or overlap a new freeze.
 p:=pg_temp.member_must('freeze_preview_v1',jsonb_build_object('sale_id',sale,'dates',jsonb_build_object('start_date',st::text,'end_date',(st+10)::text),'reason','Reuse cancelled days'));
 -- The separate non-extending product has no date adjustment to reverse.
 terms:=jsonb_set(terms,'{freeze,extends_validity}','false');product:=(pg_temp.member_must('product_publish_v1',jsonb_build_object('terms',terms))->>'primary_id')::uuid;
 p:=pg_temp.member_must('sale_preview_v1',jsonb_build_object('person_id',c.target,'product_version_id',product,'start_date',(current_date+1)::text,'end_date',base_end::text));sale:=(pg_temp.member_must('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')))->>'primary_id')::uuid;
 p:=pg_temp.member_must('freeze_preview_v1',jsonb_build_object('sale_id',sale,'dates',jsonb_build_object('start_date',st::text,'end_date',en::text),'reason','Nonextending freeze'));freeze_id:=(pg_temp.member_must('freeze_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')))->>'primary_id')::uuid;
 p:=pg_temp.member_must('freeze_cancel_preview_v1',jsonb_build_object('freeze_id',freeze_id,'reason','Cancel nonextending'));
 if p#>>'{freeze_cancellation,removed_extension_days}'<>'0' or (p#>>'{freeze_cancellation,end_date}')::date<>base_end then raise exception 'NONEXTENDING_CANCEL_CHANGED_END';end if;
 update private.preview_payloads set expires_at=clock_timestamp()-interval '1 second' where preview_id=(p->>'id')::uuid;
 r:=pg_temp.member_call('freeze_cancel_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')));if r#>>'{error,code}' is distinct from 'PREVIEW_STALE' then raise exception 'CANCEL_EXPIRED_PREVIEW_ALLOWED %',r;end if;
 -- Execute the same lifecycle body with a transaction-local clock. Only time
 -- advances: no sale/freeze/dependency/version or approval row changes.
 original_fn:=pg_get_functiondef('private.p02_freeze(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 execute replace(original_fn,'clock_timestamp()','pg_temp.member_clock()');
 insert into pg_temp.member_clock values(st::timestamptz-interval '1 minute');
 p:=pg_temp.member_must('freeze_cancel_preview_v1',jsonb_build_object('freeze_id',freeze_id,'reason','Clock boundary'));
 update pg_temp.member_clock set value=st::timestamptz;
 if (p->>'expires_at')::timestamptz<=st::timestamptz then raise exception 'CLOCK_TEST_APPROVAL_ALREADY_EXPIRED';end if;
 r:=pg_temp.member_call('freeze_cancel_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')));if r#>>'{error,code}' is distinct from 'PREVIEW_STALE' then raise exception 'CANCEL_TIME_ONLY_BOUNDARY_ALLOWED %',r;end if;
 if (select state from core.freezes where id=freeze_id)<>'scheduled' then raise exception 'CANCEL_TIME_ONLY_MUTATED';end if;
 execute original_fn;
 p:=pg_temp.member_must('freeze_cancel_preview_v1',jsonb_build_object('freeze_id',freeze_id,'reason','Fresh nonextending'));
 perform pg_temp.member_must('freeze_cancel_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')));
end$member_cancel$;
