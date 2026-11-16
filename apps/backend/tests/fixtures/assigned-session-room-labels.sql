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
do $labels$
declare c pg_temp.member_context;d uuid:=(pg_temp.bank(1))[1];sid uuid:=(pg_temp.bank(1))[1];other_sid uuid:=(pg_temp.bank(1))[1];no_room uuid:=(pg_temp.bank(1))[1];a uuid:=(pg_temp.bank(1))[1];role_id uuid:=(pg_temp.bank(1))[1];p jsonb;b jsonb;first jsonb;expected jsonb;stamp timestamptz:=statement_timestamp();
begin
 select * into c from pg_temp.member_context;
 insert into core.disciplines(id,org_id,name,state) values(d,c.org,'Assigned label test','active');
 insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values((pg_temp.bank(1))[1],c.org,c.center,d,'active');
 insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) select role_id,c.org,c.actor,'instructor',c.center,'active',id from core.account_links where org_id=c.org and person_id=c.actor;
 insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values
 (sid,c.org,c.center,d,'group',stamp+interval '1 day',stamp+interval '1 day 1 hour',10,10,'planned','open'),
 (other_sid,c.org,c.center,d,'group',stamp+interval '2 days',stamp+interval '2 days 1 hour',10,10,'planned','open'),
 (no_room,c.org,c.center,d,'group',stamp+interval '3 days',stamp+interval '3 days 1 hour',10,10,'planned','open');
 insert into core.session_assignments(id,org_id,center_id,session_id,person_id,duty,state) values(a,c.org,c.center,sid,c.actor,'instructor','active'),((pg_temp.bank(1))[1],c.org,c.center,no_room,c.actor,'instructor','active');
 insert into core.resource_bookings(id,org_id,center_id,session_id,resource_kind,resource_id,starts_at,ends_at,state) values((pg_temp.bank(1))[1],c.org,c.center,sid,'room',c.room,stamp+interval '1 day',stamp+interval '1 day 1 hour','active');
 expected:=jsonb_build_array(jsonb_build_object('room_id',c.room,'name','Probe room'));
 b:=jsonb_build_object('session_id',sid,'include_room_labels',true);
 p:=pg_temp.member_must('session_get_v1',b);if p->'room_labels' is distinct from expected then raise exception 'ASSIGNED_ROOM_LABEL_MISSING %',p;end if;
 p:=pg_temp.member_must('session_get_v1',b-'include_room_labels');if p ? 'room_labels' then raise exception 'ROOM_LABEL_NOT_OPTIN';end if;
 p:=pg_temp.member_must('session_get_v1',b||jsonb_build_object('session_id',other_sid));if p ? 'room_labels' then raise exception 'UNASSIGNED_SESSION_ROOM_LEAK';end if;
 p:=pg_temp.member_must('session_get_v1',b||jsonb_build_object('session_id',no_room));if p->'room_labels' is distinct from '[]'::jsonb then raise exception 'ROOM_ABSENCE_FABRICATED %',p;end if;
 b:=jsonb_build_object('include_room_labels',true,'interval',jsonb_build_object('starts_at',stamp,'ends_at',stamp+interval '4 days'),'resource',jsonb_build_object('kind','person','id',c.actor),'page',jsonb_build_object('limit',1,'sort','starts_at_asc'));
 first:=pg_temp.member_must('calendar_get_v1',b);if jsonb_array_length(first->'items')<>1 or first#>'{items,0,room_labels}' is distinct from expected or first->>'next_cursor' is null then raise exception 'CALENDAR_LABEL_PAGE_WRONG %',first;end if;
 p:=pg_temp.member_call('calendar_get_v1',(b-'include_room_labels')||jsonb_build_object('page',jsonb_build_object('limit',1,'sort','starts_at_asc','cursor',first->>'next_cursor')));if p#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'ROOM_LABEL_CURSOR_SCOPE_UNBOUND %',p;end if;
 -- Current display label follows the room row, never a cached/demo/UUID label.
 update core.rooms set name='Renamed live room' where org_id=c.org and id=c.room;
 p:=pg_temp.member_must('session_get_v1',jsonb_build_object('session_id',sid,'include_room_labels',true));if p#>>'{room_labels,0,name}'<>'Renamed live room' then raise exception 'ROOM_NAME_STALE %',p;end if;
 -- The owner can still read the session, but an inactive duty grants no label.
 update core.session_assignments set state='inactive' where id=a;
 p:=pg_temp.member_must('session_get_v1',jsonb_build_object('session_id',sid,'include_room_labels',true));if p ? 'room_labels' then raise exception 'ROOM_LABEL_STALE_ASSIGNMENT_LEAK';end if;
 update core.session_assignments set state='active' where id=a;
 update core.role_assignments set state='inactive' where id=role_id;
 p:=pg_temp.member_must('session_get_v1',jsonb_build_object('session_id',sid,'include_room_labels',true));if p ? 'room_labels' then raise exception 'ROOM_LABEL_STALE_ROLE_LEAK';end if;
 update core.role_assignments set state='active' where id=role_id;
 update core.resource_bookings set state='inactive' where org_id=c.org and session_id=sid;
 p:=pg_temp.member_must('session_get_v1',jsonb_build_object('session_id',sid,'include_room_labels',true));if p->'room_labels' is distinct from '[]'::jsonb then raise exception 'CANCELLED_ROOM_BOOKING_LEAK';end if;
 update core.resource_bookings set state='active' where org_id=c.org and session_id=sid;
 p:=pg_temp.member_call('session_get_v1',jsonb_build_object('session_id',sid,'include_room_labels',true,'center_id',c.other_center));if p->>'ok'='true' then raise exception 'ROOM_WRONG_CENTER_LEAK';end if;
 -- Legacy class inheritance follows native assignment_mode; explicit overrides do not inherit.
 insert into core.classes(id,org_id,center_id,name,external_open,state,discipline_id) values(other_sid,c.org,c.center,'Label class',false,'active',d);
 update core.sessions set class_id=other_sid,assignment_mode='legacy' where org_id=c.org and id=sid;
 update core.session_assignments set state='inactive' where id=a;
 insert into core.class_assignments(id,org_id,center_id,class_id,person_id,duty,state) values((pg_temp.bank(1))[1],c.org,c.center,other_sid,c.actor,'instructor','active');
 p:=pg_temp.member_must('session_get_v1',jsonb_build_object('session_id',sid,'include_room_labels',true));if p#>>'{room_labels,0,name}' is distinct from 'Renamed live room' then raise exception 'CLASS_ROOM_LABEL_MISSING';end if;
 update core.sessions set assignment_mode='explicit' where org_id=c.org and id=sid;
 p:=pg_temp.member_must('session_get_v1',jsonb_build_object('session_id',sid,'include_room_labels',true));if p ? 'room_labels' then raise exception 'EXPLICIT_CLASS_ROOM_LEAK';end if;
 update core.role_assignments set role='assistant' where id=role_id;
 update core.session_assignments set state='active',duty='assistant' where id=a;
 p:=pg_temp.member_must('session_get_v1',jsonb_build_object('session_id',sid,'include_room_labels',true));if p#>>'{room_labels,0,name}' is distinct from 'Renamed live room' then raise exception 'ASSISTANT_ROOM_LABEL_MISSING';end if;
end$labels$;
