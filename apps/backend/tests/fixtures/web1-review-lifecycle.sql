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
create temporary table web1_context(org uuid,center uuid,other_center uuid,auth uuid,session uuid,actor uuid,source uuid,target uuid,third uuid,room uuid) on commit drop;
create temporary table web1_responses(operation text,response jsonb) on commit drop;
create function pg_temp.web1_call(op text,body jsonb) returns jsonb language plpgsql as $$
declare c pg_temp.web1_context;r jsonb;result jsonb;
begin
 select * into c from pg_temp.web1_context;
 r:=jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'org_id',c.org,'center_id',c.center)||body;
 if op not like '%_get_v1' and op not like '%_list_v1' and op not like '%_preview_v1' and not r?'operation_key' then r:=r||jsonb_build_object('operation_key',(pg_temp.bank(1))[1]);end if;
 result:=private.execute_operation(op,r,c.auth,c.session,pg_temp.bank(512),jsonb_build_object('token',encode(extensions.gen_random_bytes(32),'hex')));
 if result->>'ok'='true' then insert into pg_temp.web1_responses values(op,result);end if;
 return result;
end$$;
create function pg_temp.web1_must(op text,body jsonb) returns jsonb language plpgsql as $$
declare r jsonb:=pg_temp.web1_call(op,body);
begin if r->>'ok' is distinct from 'true' then raise exception 'WEB1_OPERATION_FAILED % %',op,r;end if;return r->'data';end$$;
do $setup$
declare x uuid[]:=pg_temp.bank(32);features text[];p uuid;v jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(x[4],'web1-probe@example.invalid',now());
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(x[5],x[4],now(),now(),'aal1');
 insert into core.accounts(id,auth_user_id,state) values(x[6],x[4],'active');
 insert into core.organizations(id,org_id,name,owner_person_id,state) values(x[1],x[1],'Synthetic web1 review',x[7],'active');
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
 insert into pg_temp.web1_context values(x[1],x[2],x[3],x[4],x[5],x[7],x[8],x[9],x[10],x[15]);
end$setup$;
do $acceptance$
declare c pg_temp.web1_context;resource jsonb;rule jsonb;r jsonb;first_rule jsonb;second_rule jsonb;closure jsonb;read jsonb;request jsonb;pv jsonb;token jsonb;before_count bigint;v bigint;opkey uuid:= (pg_temp.bank(1))[1];before_version bigint;after_version bigint;session_snapshot jsonb;dis uuid:=(pg_temp.bank(1))[1];outs uuid[]:=pg_temp.bank(8);
begin
 select * into c from pg_temp.web1_context;resource:=jsonb_build_object('kind','room','id',c.room);rule:='{"weekdays":[1,2,3,4,5,6,7],"local_start":"00:00:00","local_end":"24:00:00","valid_from":"2020-01-01"}';
 insert into core.disciplines(id,org_id,name,state) values(dis,c.org,'Synthetic preserved session discipline','active');
 insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values((pg_temp.bank(1))[1],c.org,c.center,dis,'active');
 insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values((pg_temp.bank(1))[1],c.org,c.center,dis,'group','2031-01-01T10:00:00Z','2031-01-01T11:00:00Z',4,4,'planned','open');
 select jsonb_agg(to_jsonb(s) order by s.id) into session_snapshot from core.sessions s where s.org_id=c.org;
 first_rule:=pg_temp.web1_must('availability_save_v1',jsonb_build_object('resource',resource,'rule',rule));second_rule:=pg_temp.web1_must('availability_save_v1',jsonb_build_object('resource',resource,'rule',rule));
 select version into before_version from core.availability_rules where id=(second_rule->>'primary_id')::uuid;
 request:=jsonb_build_object('resource',resource,'rule_id',first_rule->'primary_id','expected_version',first_rule->'version','action','retire','reason','Retire one rule','operation_key',opkey);
 r:=pg_temp.web1_must('availability_save_v1',request);read:=pg_temp.web1_must('availability_save_v1',request);if r-'replayed'<>read-'replayed' or read->>'replayed'<>'true' then raise exception 'RETIRE_REPLAY_CHANGED';end if;
 if not exists(select 1 from core.availability_rules where id=(first_rule->>'primary_id')::uuid and state='inactive' and weekdays=array[1,2,3,4,5,6,7]::bigint[]) then raise exception 'RETIRE_LOST_SOURCE';end if;
 select version into after_version from core.availability_rules where id=(second_rule->>'primary_id')::uuid;if before_version<>after_version then raise exception 'RETIRE_CHANGED_OTHER_RULE';end if;
 r:=pg_temp.web1_call('availability_save_v1',request||jsonb_build_object('reason','Changed same intent'));if r#>>'{error,code}' is distinct from 'IDEMPOTENCY_PAYLOAD_MISMATCH' then raise exception 'RETIRE_KEY_NOT_BOUND %',r;end if;
 r:=pg_temp.web1_call('availability_save_v1',request||jsonb_build_object('operation_key',(pg_temp.bank(1))[1]));if r#>>'{error,code}' is distinct from 'VERSION_CONFLICT' then raise exception 'RETIRE_STALE_ALLOWED %',r;end if;
 perform pg_temp.web1_must('availability_save_v1',jsonb_build_object('resource',resource,'rule_id',second_rule->'primary_id','expected_version',second_rule->'version','action','retire','reason','Retire last rule'));
 begin perform private.assert_availability(c.org,c.center,'room',c.room,'2031-01-01T10:00:00Z','2031-01-01T11:00:00Z');raise exception 'RETIRED_LAST_RULE_ALLOWED';exception when SQLSTATE 'P0001' then if SQLERRM<>'POLICY_NOT_CONFIGURED' then raise;end if;end;
 perform pg_temp.web1_must('availability_save_v1',jsonb_build_object('resource',resource,'rule',rule));
 select version into v from core.centers where id=c.center;
 closure:=pg_temp.web1_must('availability_exception_save_v1',jsonb_build_object('resource',resource,'expected_version',v,'interval',jsonb_build_object('starts_at','2031-01-01T10:00:00Z','ends_at','2031-01-01T11:00:00Z'),'reason','Private original reason'));
 r:=pg_temp.web1_must('management_state_get_v1',jsonb_build_object('operation','availability_exception_save_v1','selector',jsonb_build_object('operation','availability_exception_save_v1','key',jsonb_build_object('resource',resource))));if r::text like '%Private original reason%' then raise exception 'CLOSURE_REASON_LEAK';end if;
 begin perform private.assert_availability(c.org,c.center,'room',c.room,'2031-01-01T10:00:00Z','2031-01-01T11:00:00Z');raise exception 'ACTIVE_CLOSURE_IGNORED';exception when SQLSTATE 'P0001' then if SQLERRM<>'RESOURCE_CONFLICT' then raise;end if;end;
 select version into v from core.centers where id=c.center;
 r:=pg_temp.web1_call('availability_exception_save_v1',jsonb_build_object('center_id',c.other_center,'resource',resource,'exception_id',closure->'primary_id','expected_version',v,'action','cancel','reason','Wrong scope'));if r->>'ok'='true' then raise exception 'WRONG_CENTER_CANCELLED';end if;
 r:=pg_temp.web1_call('availability_exception_save_v1',jsonb_build_object('resource',resource,'exception_id',closure->'primary_id','expected_version',v-1,'action','cancel','reason','Stale selected closure'));if r#>>'{error,code}' is distinct from 'VERSION_CONFLICT' then raise exception 'STALE_CLOSURE_CANCELLED %',r;end if;
 perform pg_temp.web1_must('availability_exception_save_v1',jsonb_build_object('resource',resource,'exception_id',closure->'primary_id','expected_version',v,'action','cancel','reason','Reopen selected interval'));
 perform private.assert_availability(c.org,c.center,'room',c.room,'2031-01-01T10:00:00Z','2031-01-01T11:00:00Z');
 if not exists(select 1 from core.availability_exceptions where id=(closure->>'primary_id')::uuid and state='cancelled' and reason='Private original reason') then raise exception 'CANCEL_LOST_HISTORY';end if;
 if (select jsonb_agg(to_jsonb(s) order by s.id) from core.sessions s where s.org_id=c.org) is distinct from session_snapshot then raise exception 'LIFECYCLE_CHANGED_EXISTING_SESSIONS';end if;
 -- Current people view includes never-linked people and never fabricates a link ID.
 request:=jsonb_build_object('operation','account_link_remove_v1','selector',jsonb_build_object('operation','account_link_remove_v1','key',jsonb_build_object('directory','center','view','people','status','unlinked','query','Match')),'page',jsonb_build_object('limit',1));
 r:=pg_temp.web1_must('management_state_get_v1',request);if (r#>>'{access_summary,filtered}')::int<>3 or r#>>'{items,0,access_detail,linked}'<>'false' or r#>>'{items,0,current,values,actionable}'<>'false' or r#>>'{items,0,current,values,link_id}' is not null then raise exception 'UNLINKED_DISCOVERY_WRONG %',r;end if;
 if r->>'next_cursor' is null then raise exception 'UNLINKED_PAGE_MISSING';end if;
 read:=pg_temp.web1_must('management_state_get_v1',request||jsonb_build_object('page',jsonb_build_object('limit',1,'cursor',r->'next_cursor')));if read#>>'{items,0,entity,id}'=r#>>'{items,0,entity,id}' then raise exception 'UNLINKED_DUPLICATE_PAGE';end if;
 -- Effective expiry and lifecycle groups filter the whole invitation set before paging.
 insert into core.invitations(id,org_id,center_id,person_id,email,token_hash,inviter_account_id,expires_at,state)
 select (pg_temp.bank(1))[1],c.org,c.center,pid,'probe@example.invalid',encode(extensions.gen_random_bytes(32),'hex'),l.account_id,expiry,st
 from (values(c.source,clock_timestamp()+interval '1 day','pending'),(c.target,clock_timestamp()-interval '1 day','pending'),(c.third,clock_timestamp()+interval '1 day','revoked')) v(pid,expiry,st)
 cross join core.account_links l where l.org_id=c.org and l.person_id=c.actor and l.state='active';
 read:=pg_temp.web1_must('management_state_get_v1',jsonb_build_object('operation','account_access_revoke_v1','selector',jsonb_build_object('operation','account_access_revoke_v1','key',jsonb_build_object('directory','center','query','Match','status','closed')),'page',jsonb_build_object('limit',1)));
 if (read#>>'{access_summary,total}')::int<>3 or (read#>>'{access_summary,filtered}')::int<>2 or read->>'next_cursor' is null then raise exception 'CLOSED_INVITATION_PAGE_WRONG %',read;end if;
 r:=pg_temp.web1_must('management_state_get_v1',jsonb_build_object('operation','account_access_revoke_v1','selector',jsonb_build_object('operation','account_access_revoke_v1','key',jsonb_build_object('directory','center','query','Match','status','open')),'page',jsonb_build_object('limit',1)));
 if (r#>>'{access_summary,filtered}')::int<>1 or r#>>'{items,0,state}'<>'pending' then raise exception 'OPEN_INVITATION_GROUP_WRONG %',r;end if;
 -- Exact normalized contact matching suggests three pairs, never merges them.
 request:=jsonb_build_object('operation','person_merge_preview_v1','selector',jsonb_build_object('operation','person_merge_preview_v1','key',jsonb_build_object('directory','center','query','Match','status','suggested')),'page',jsonb_build_object('limit',1));
 -- A manager of another center cannot discover these contacts/pairs or mutate them.
 insert into auth.users(id,email,email_confirmed_at) values(outs[1],'web1-other-manager@example.invalid',now());
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(outs[2],outs[1],now(),now(),'aal1');
 insert into core.accounts(id,auth_user_id,state) values(outs[3],outs[1],'active');
 insert into core.people(id,org_id,display_name,state) values(outs[4],c.org,'Other scope manager','active');
 insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values(outs[5],c.org,outs[3],outs[4],'active',now());
 insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values(outs[6],c.org,outs[4],'center_manager',c.other_center,'active',outs[5]);
 update pg_temp.web1_context set auth=outs[1],session=outs[2],actor=outs[4];
 read:=pg_temp.web1_call('management_state_get_v1',request);if read->>'ok'='true' then raise exception 'OTHER_MANAGER_READ_SELECTED_CENTER';end if;
 read:=pg_temp.web1_must('management_state_get_v1',request||jsonb_build_object('center_id',c.other_center));if jsonb_array_length(read->'items')<>0 or (read#>>'{merge_review_summary,total}')::int<>0 then raise exception 'OTHER_CENTER_PAIR_LEAK %',read;end if;
 update pg_temp.web1_context set auth=c.auth,session=c.session,actor=c.actor;
 select count(*) into before_count from core.audit_events where org_id=c.org;
 r:=pg_temp.web1_must('management_state_get_v1',request);if (r#>>'{merge_review_summary,filtered}')::int<>3 or r->>'next_cursor' is null then raise exception 'SUGGESTIONS_WRONG %',r;end if;
 if (select count(*) from core.audit_events where org_id=c.org)<>before_count then raise exception 'MERGE_READ_MUTATED';end if;
 if r::text like '%same@example.invalid%' or r::text like '%token%' or r::text like '%account_id%' then raise exception 'MERGE_READ_PRIVATE_LEAK';end if;
 pv:=pg_temp.web1_must('person_merge_preview_v1',jsonb_build_object('source_id',c.source,'target_id',c.target,'decision','not_duplicate','reason','Different people'));
 if pv#>>'{merge_summary,linked_history}'<>'false' or pv#>>'{effects,0,reason}' not like 'Mark this pair%' then raise exception 'DISMISS_PREVIEW_FALSE_EFFECT';end if;
 -- Both centers are managed, so only the exact preview scope pin rejects this.
 insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) select (pg_temp.bank(1))[1],c.org,c.actor,'center_manager',c.other_center,'active',l.id from core.account_links l where l.org_id=c.org and l.person_id=c.actor and l.state='active';
 insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values((pg_temp.bank(1))[1],c.org,c.other_center,c.source,'student','active',now()),((pg_temp.bank(1))[1],c.org,c.other_center,c.target,'student','active',now());
 -- New authority invalidates an earlier preview; explicitly obtain a fresh one.
 pv:=pg_temp.web1_must('person_merge_preview_v1',jsonb_build_object('source_id',c.source,'target_id',c.target,'decision','not_duplicate','reason','Different people'));
 token:=jsonb_build_object('id',pv->'id','token',pv->'token');
 read:=pg_temp.web1_call('person_merge_apply_v1',jsonb_build_object('center_id',c.other_center,'preview',token));if read#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'DISMISS_CROSS_CENTER_ALLOWED %',read;end if;
 if exists(select 1 from core.merge_requests where org_id=c.org and decision='not_duplicate') then raise exception 'DISMISS_CROSS_CENTER_MUTATED';end if;

 read:=pg_temp.web1_call('person_merge_apply_v1',jsonb_build_object('preview',token,'reason','Changed explanation'));if read#>>'{error,code}' is distinct from 'PREVIEW_STALE' then raise exception 'MERGE_REASON_NOT_PINNED %',read;end if;
 opkey:=(pg_temp.bank(1))[1];read:=pg_temp.web1_must('person_merge_apply_v1',jsonb_build_object('preview',token,'operation_key',opkey));perform pg_temp.web1_must('person_merge_apply_v1',jsonb_build_object('preview',token,'operation_key',opkey));
 if exists(select 1 from core.people where id in(c.source,c.target) and state<>'active') then raise exception 'DISMISS_MERGED_PEOPLE';end if;
 if not exists(select 1 from core.merge_requests where org_id=c.org and decision='not_duplicate' and reason='Different people' and decision_center_id=c.center) then raise exception 'DISMISS_NOT_PERSISTED';end if;
 if not exists(select 1 from core.audit_events where org_id=c.org and action='person_merge_apply_v1' and reason='Different people' and diff->>'decision'='not_duplicate') then raise exception 'DISMISS_AUDIT_REASON_LOST';end if;
 read:=pg_temp.web1_must('management_state_get_v1',request);if (read#>>'{merge_review_summary,filtered}')::int<>2 then raise exception 'DISMISS_REAPPEARED %',read;end if;
 read:=pg_temp.web1_call('management_state_get_v1',request||jsonb_build_object('page',jsonb_build_object('limit',1,'cursor',r->'next_cursor')));if read#>>'{error,code}' is distinct from 'VERSION_CONFLICT' then raise exception 'MERGE_CURSOR_IGNORED_CHANGE %',read;end if;
 -- Inactive person availability remains historical and cannot block a merge.
 insert into core.availability_rules(id,org_id,center_id,resource_kind,resource_id,weekdays,local_start,local_end,valid_from,state) values
 ((pg_temp.bank(1))[1],c.org,c.center,'person',c.third,array[1]::bigint[],'09:00:00','10:00:00','2020-01-01','inactive'),
 ((pg_temp.bank(1))[1],c.org,c.center,'person',c.target,array[1]::bigint[],'09:00:00','10:00:00','2020-01-01','active');
 if jsonb_array_length(private.p07_merge_conflicts(c.org,c.third,c.target))<>0 then raise exception 'INACTIVE_AVAILABILITY_BLOCKED_MERGE';end if;
 -- Selected-record comparison reuses bounded authorized summaries; default stays unchanged.
 read:=pg_temp.web1_must('person_get_v1',jsonb_build_object('person_id',c.source));if read?'member_summary' then raise exception 'LEGACY_PERSON_DETAIL_CHANGED';end if;
 read:=pg_temp.web1_must('person_get_v1',jsonb_build_object('person_id',c.source,'include_member_summary',true));if not read?'member_summary' or read#>>'{member_summary,debt,status}' is null then raise exception 'SELECTED_SUMMARY_MISSING';end if;
 -- A normal merge pins and records its reason without rewriting historical IDs.
 pv:=pg_temp.web1_must('person_merge_preview_v1',jsonb_build_object('source_id',c.third,'target_id',c.target,'reason','Duplicate registration'));
 perform pg_temp.web1_must('person_merge_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',pv->'id','token',pv->'token')));
 read:=pg_temp.web1_must('management_state_get_v1',jsonb_build_object('operation','person_merge_preview_v1','selector',jsonb_build_object('operation','person_merge_preview_v1','key',jsonb_build_object('directory','center','status','completed')),'page',jsonb_build_object('limit',1)));
 if jsonb_array_length(read->'items')<>1 or read#>>'{items,0,merge_review,reason}' is distinct from 'Duplicate registration' then raise exception 'MERGE_HISTORY_MISSING %',read;end if;
 if not exists(select 1 from core.audit_events where org_id=c.org and action='person_merge_apply_v1' and reason='Duplicate registration') then raise exception 'MERGE_AUDIT_REASON_MISSING';end if;
 if not exists(select 1 from core.availability_rules where org_id=c.org and resource_id=c.third and state='inactive') then raise exception 'MERGE_REWROTE_RETIRED_RULE_HISTORY';end if;

end$acceptance$;
