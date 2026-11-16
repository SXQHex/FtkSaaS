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
do $requests$
declare c pg_temp.member_context;d uuid:=(pg_temp.bank(1))[1];d2 uuid:=(pg_temp.bank(1))[1];iid uuid:=(pg_temp.bank(1))[1];pid uuid;st text;rid uuid;expected jsonb;b jsonb;p jsonb;q jsonb;cursor text;n int:=0;saved_features text[];plan uuid;
begin
 select * into c from pg_temp.member_context;
 insert into core.disciplines(id,org_id,name,state) values(d,c.org,'Private requests','active'),(d2,c.org,'Other discipline','active');
 insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values((pg_temp.bank(1))[1],c.org,c.center,d,'active'),((pg_temp.bank(1))[1],c.org,c.center,d2,'active'),((pg_temp.bank(1))[1],c.org,c.other_center,d,'active');
 foreach pid in array array[c.source,c.target] loop
  foreach st in array array['pending','alternative_offered','approved','rejected','withdrawn','expired'] loop
   n:=n+1;rid:=(pg_temp.bank(1))[1];
   insert into core.lesson_requests(id,org_id,center_id,person_id,format,discipline_id,requested_start,duration_minutes,state,created_at) values(rid,c.org,c.center,pid,'private',d,now()+n*interval '1 day',60,st,now()-n*interval '1 minute');
  end loop;
 end loop;
 insert into core.lesson_requests(id,org_id,center_id,person_id,format,discipline_id,requested_start,duration_minutes,state) values((pg_temp.bank(1))[1],c.org,c.other_center,c.source,'private',d,now()+interval '30 days',60,'pending'),((pg_temp.bank(1))[1],c.org,c.center,c.source,'private',d2,now()+interval '31 days',60,'pending');
 b:=jsonb_build_object('operation','lesson_request_create_v1','selector',jsonb_build_object('operation','lesson_request_create_v1','key',jsonb_build_object('discipline_id',d,'status','pending','include_summary',true)),'page',jsonb_build_object('limit',1));
 p:=pg_temp.member_must('management_state_get_v1',b);cursor:=p->>'next_cursor';
 expected:='{"pending":2,"alternative_offered":2,"approved":2,"rejected":2}';
 if p->'lesson_request_summary' is distinct from expected or jsonb_array_length(p->'items')<>1 or p#>>'{items,0,state}'<>'pending' or cursor is null then raise exception 'REQUEST_STATUS_FIRST_PAGE_WRONG %',p;end if;
 q:=pg_temp.member_must('management_state_get_v1',b||jsonb_build_object('page',jsonb_build_object('limit',1,'cursor',cursor)));
 if q->'lesson_request_summary' is distinct from expected or jsonb_array_length(q->'items')<>1 or q->>'next_cursor' is not null or q#>>'{items,0,entity,id}'=p#>>'{items,0,entity,id}' then raise exception 'REQUEST_SUMMARY_PAGE_DEPENDENT %',q;end if;
 foreach st in array array['all','alternative_offered','resolved'] loop
  q:=pg_temp.member_must('management_state_get_v1',jsonb_set(b,'{selector,key,status}',to_jsonb(st))||jsonb_build_object('page',jsonb_build_object('limit',200)));
  if q->'lesson_request_summary' is distinct from expected or jsonb_array_length(q->'items')<>(case st when 'all' then 12 when 'alternative_offered' then 2 else 8 end) then raise exception 'REQUEST_FILTER_MAPPING_WRONG % %',st,q;end if;
  if st='resolved' and exists(select 1 from jsonb_array_elements(q->'items') x where x->>'state' not in ('approved','rejected','withdrawn','expired')) then raise exception 'REQUEST_RESOLVED_INCLUDES_OPEN';end if;
  q:=pg_temp.member_call('management_state_get_v1',jsonb_set(b,'{selector,key,status}',to_jsonb(st))||jsonb_build_object('page',jsonb_build_object('limit',1,'cursor',cursor)));
  if q#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'REQUEST_STATUS_CURSOR_UNBOUND %',q;end if;
 end loop;
 q:=pg_temp.member_must('management_state_get_v1',jsonb_set(b,'{selector,key}',jsonb_build_object('status','all','include_summary',true))||jsonb_build_object('page',jsonb_build_object('limit',1)));
 if q#>>'{lesson_request_summary,pending}'<>'3' then raise exception 'REQUEST_DISCIPLINE_SUMMARY_NOT_SCOPED %',q;end if;
 insert into core.disciplines(id,org_id,name,state) values(iid,c.org,'No requests','active');
 insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values((pg_temp.bank(1))[1],c.org,c.center,iid,'active');
 q:=pg_temp.member_must('management_state_get_v1',jsonb_set(b,'{selector,key,discipline_id}',to_jsonb(iid)));
 if q->'lesson_request_summary' is distinct from '{"pending":0,"alternative_offered":0,"approved":0,"rejected":0}'::jsonb or q->'items'<>'[]'::jsonb then raise exception 'REQUEST_EMPTY_SUMMARY_NOT_ZERO %',q;end if;
 q:=pg_temp.member_must('management_state_get_v1',(b#-'{selector,key,include_summary}')#-'{selector,key,status}');if q ? 'lesson_request_summary' then raise exception 'REQUEST_SUMMARY_NOT_OPTIN';end if;
 q:=pg_temp.member_call('management_state_get_v1',b||jsonb_build_object('center_id',c.other_center));if q->>'ok'='true' then raise exception 'REQUEST_UNMANAGED_CENTER_LEAK';end if;
 -- Existing person-scoped reader remains self-only after role/owner grants are gone.
 update core.organizations set owner_person_id=c.third where id=c.org;
 update core.account_links set person_id=c.source where org_id=c.org and account_id=(select id from core.accounts where auth_user_id=c.auth);
 q:=pg_temp.member_call('management_state_get_v1',b);if q#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'REQUEST_SELF_CENTER_TOTAL_LEAK %',q;end if;
 b:=jsonb_set(b,'{selector,key,person_id}',to_jsonb(c.source));
 q:=pg_temp.member_must('management_state_get_v1',b||jsonb_build_object('page',jsonb_build_object('limit',200)));
 expected:='{"pending":1,"alternative_offered":1,"approved":1,"rejected":1}';
 if q->'lesson_request_summary' is distinct from expected or exists(select 1 from jsonb_array_elements(q->'items') x where x#>>'{request_detail,person_id}'<>c.source::text) then raise exception 'REQUEST_SELF_SUMMARY_LEAK %',q;end if;
 q:=pg_temp.member_call('management_state_get_v1',jsonb_set(b,'{selector,key,person_id}',to_jsonb(c.target)));if q->>'ok'='true' then raise exception 'REQUEST_OTHER_PERSON_SUMMARY_LEAK';end if;
 update core.people set merged_into_id=c.source,state='merged' where org_id=c.org and id=c.target;
 q:=pg_temp.member_call('management_state_get_v1',jsonb_set(b,'{selector,key,person_id}',to_jsonb(c.target)));if q#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'REQUEST_ALIAS_SELF_PERMISSION_CHANGED %',q;end if;
 update core.account_links set person_id=c.actor where org_id=c.org and account_id=(select id from core.accounts where auth_user_id=c.auth);
 q:=pg_temp.member_must('management_state_get_v1',jsonb_set(b,'{selector,key,person_id}',to_jsonb(c.target))||jsonb_build_object('page',jsonb_build_object('limit',200)));
 if q->'lesson_request_summary' is distinct from expected then raise exception 'REQUEST_ALIAS_MANAGER_SUMMARY_LOST %',q;end if;
 update core.people set merged_into_id=null,state='active' where org_id=c.org and id=c.target;
 update core.account_links set person_id=c.actor where org_id=c.org and account_id=(select id from core.accounts where auth_user_id=c.auth);
 select plan_version_id into plan from core.saas_subscriptions where org_id=c.org;select features into saved_features from core.saas_plan_versions where id=plan;
 update core.saas_plan_versions set features=array_remove(saved_features,'F09') where id=plan;
 q:=pg_temp.member_call('management_state_get_v1',b);if q#>>'{error,code}' is distinct from 'PLAN_FEATURE_UNAVAILABLE' then raise exception 'REQUEST_SUMMARY_F09_BYPASS %',q;end if;
 update core.saas_plan_versions set features=saved_features where id=plan;
 update core.saas_subscriptions set state='pending_payment' where org_id=c.org;
 q:=pg_temp.member_call('management_state_get_v1',b);if q#>>'{error,code}' is distinct from 'SUBSCRIPTION_NOT_STARTED' then raise exception 'REQUEST_SUMMARY_BOOTSTRAP_BYPASS %',q;end if;
 update core.saas_subscriptions set state='active' where org_id=c.org;
 update core.organizations set state='closed' where id=c.org;
 q:=pg_temp.member_call('management_state_get_v1',b);if q#>>'{error,code}' is distinct from 'SERVICE_UNAVAILABLE' then raise exception 'REQUEST_SUMMARY_CLOSED_BYPASS %',q;end if;
 update core.organizations set state='active' where id=c.org;
 update core.role_assignments set state='inactive' where org_id=c.org and person_id=c.actor and role='center_manager';
 q:=pg_temp.member_call('management_state_get_v1',b);if q->>'ok'='true' then raise exception 'REQUEST_SUMMARY_REVOKED_ROLE_BYPASS';end if;
end$requests$;
