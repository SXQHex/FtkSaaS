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
create temporary table ncr_context(org uuid,center uuid,other_center uuid,auth uuid,session uuid,actor uuid,source uuid,target uuid,third uuid,room uuid) on commit drop;
create temporary table ncr_responses(operation text,request jsonb,response jsonb) on commit drop;
create function pg_temp.ncr_call(op text,body jsonb) returns jsonb language plpgsql as $$
declare c pg_temp.ncr_context;r jsonb;result jsonb;
begin
 select * into c from pg_temp.ncr_context;
 r:=jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'org_id',c.org,'center_id',c.center)||body;
 if op not like '%_get_v1' and op not like '%_list_v1' and op not like '%_preview_v1' and not r?'operation_key' then r:=r||jsonb_build_object('operation_key',(pg_temp.bank(1))[1]);end if;
 if op in ('operation_status_get_v1','preview_get_v1') then r:=r-'center_id';end if;
 result:=private.execute_operation(op,r,c.auth,c.session,pg_temp.bank(512),jsonb_build_object('token',encode(extensions.gen_random_bytes(32),'hex')));
 insert into pg_temp.ncr_responses values(op,r,result);
 return result;
end$$;
create function pg_temp.ncr_must(op text,body jsonb) returns jsonb language plpgsql as $$
declare r jsonb:=pg_temp.ncr_call(op,body);
begin if r->>'ok' is distinct from 'true' then raise exception 'WEB1_OPERATION_FAILED % %',op,r;end if;return r->'data';end$$;
do $setup$
declare x uuid[]:=pg_temp.bank(32);features text[];p uuid;v jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(x[4],'ncr-probe@example.invalid',now());
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(x[5],x[4],now(),now(),'aal1');
 insert into core.accounts(id,auth_user_id,state) values(x[6],x[4],'active');
 insert into core.organizations(id,org_id,name,owner_person_id,state) values(x[1],x[1],'Synthetic ncr review',x[7],'active');
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
 insert into pg_temp.ncr_context values(x[1],x[2],x[3],x[4],x[5],x[7],x[8],x[9],x[10],x[15]);
end$setup$;
do $capacity_recovery$
declare c pg_temp.ncr_context;ids uuid[]:=pg_temp.bank(16);dis uuid;cls uuid;agreement uuid;created jsonb;replacement jsonb;changed jsonb;preview jsonb;program_preview jsonb;read jsonb;r jsonb;wire jsonb;request jsonb;ctx record;
 create_key uuid:=(pg_temp.bank(1))[1];replace_key uuid:=(pg_temp.bank(1))[1];capacity_key uuid:=(pg_temp.bank(1))[1];before_rows jsonb;after_rows jsonb;management_change jsonb;management_replacement jsonb;
begin
 select * into c from pg_temp.ncr_context;dis:=ids[1];cls:=ids[2];agreement:=ids[3];
 insert into core.disciplines(id,org_id,name,state) values(dis,c.org,'Capacity recovery discipline','active');
 insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values(ids[4],c.org,c.center,dis,'active');
 insert into core.classes(id,org_id,center_id,name,discipline_id,state,external_open) values(cls,c.org,c.center,'Capacity recovery class',dis,'active',true);
 insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id)
 select ids[5],c.org,c.actor,'instructor',c.center,'active',l.id from core.account_links l where l.org_id=c.org and l.person_id=c.actor and l.state='active';
 insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values(ids[6],c.org,c.center,c.actor,'student','active',now());
 insert into core.availability_rules(id,org_id,center_id,resource_kind,resource_id,weekdays,local_start,local_end,valid_from)
 values(ids[7],c.org,c.center,'person',c.actor,array[1,2,3,4,5,6,7]::bigint[],'00:00:00','23:59:59','2020-01-01');
 insert into core.instructor_agreements(id,org_id,center_id,person_id,discipline_id,format,valid_from,model,terms,state)
 values(agreement,c.org,c.center,c.actor,dis,'group','2020-01-01','session_fixed','{"model":"session_fixed","currency":"TRY","components":[{"kind":"session_fixed","amount_minor":"100"}],"room_fee":{"kind":"free","order":"before_instructor_share"}}','active');
 wire:=jsonb_build_object('discipline_id',dis,'format','group','class_id',cls,'interval',jsonb_build_object('starts_at','2031-01-01T10:00:00Z','ends_at','2031-01-01T11:00:00Z'),'resources','[]'::jsonb,'assignments',jsonb_build_array(jsonb_build_object('person_id',c.actor,'duty','instructor')),'capacity',jsonb_build_object('total',8,'categories',jsonb_build_object('male',4,'female',4)),'operation_key',create_key);
 created:=pg_temp.ncr_must('session_create_v1',wire);
 -- Keep the exact canonical representation written by releases before this fix.
 update private.p06_contexts x set request=private.capacity_request(x.operation,x.request) where x.org_id=c.org and x.operation='session_create_v1' and x.request->>'operation_key'=create_key::text and x.request#>'{capacity,total}' is not null;
 read:=pg_temp.ncr_must('operation_status_get_v1',jsonb_build_object('operation','session_create_v1','key',create_key));
 if read->>'status'<>'succeeded' or read->>'result_available'<>'true' or read#>>'{result_reference,id}' is distinct from created->>'primary_id' then raise exception 'CREATE_ACK_RECOVERY_WRONG %',read;end if;
 -- Synthetic cancelled source retains its real assignment; no cancellation API is under test here.
 update core.sessions set state='cancelled',version=version+1 where id=(created->>'primary_id')::uuid;
 update core.resource_bookings set state='inactive',version=version+1 where org_id=c.org and session_id=(created->>'primary_id')::uuid and state='active';
 replacement:=pg_temp.ncr_must('replacement_session_create_v1',jsonb_build_object('replaces_id',created->'primary_id','interval',jsonb_build_object('starts_at','2031-01-02T10:00:00Z','ends_at','2031-01-02T11:00:00Z'),'resources','[]'::jsonb,'capacity',jsonb_build_object('total',6),'operation_key',replace_key));
 update private.p06_contexts x set request=private.capacity_request(x.operation,x.request) where x.org_id=c.org and x.operation='replacement_session_create_v1' and x.request->>'operation_key'=replace_key::text and x.request#>'{capacity,total}' is not null;
 select jsonb_agg(to_jsonb(s) order by s.id) into before_rows from core.sessions s where s.org_id=c.org;
 read:=pg_temp.ncr_must('operation_status_get_v1',jsonb_build_object('operation','replacement_session_create_v1','key',replace_key));
 if read->>'status'<>'succeeded' or read->>'result_available'<>'true' or read#>>'{result_reference,id}' is distinct from replacement->>'primary_id' then raise exception 'REPLACEMENT_ACK_RECOVERY_WRONG %',read;end if;
 select jsonb_agg(to_jsonb(s) order by s.id) into after_rows from core.sessions s where s.org_id=c.org;
 if before_rows is distinct from after_rows then raise exception 'RECOVERY_REPLAYED_REPLACEMENT';end if;
 changed:=pg_temp.ncr_must('session_capacity_set_v1',jsonb_build_object('session_id',replacement->'primary_id','expected_version',replacement->'version','capacity',jsonb_build_object('total',5),'reason','Explicit synthetic capacity change','operation_key',capacity_key));
 update private.p06_contexts x set request=private.capacity_request(x.operation,x.request) where x.org_id=c.org and x.operation='session_capacity_set_v1' and x.request->>'operation_key'=capacity_key::text and x.request#>'{capacity,total}' is not null;
 read:=pg_temp.ncr_must('operation_status_get_v1',jsonb_build_object('operation','session_capacity_set_v1','key',capacity_key));
 if read->>'status'<>'succeeded' or read#>>'{result_reference,id}' is distinct from replacement->>'primary_id' then raise exception 'CAPACITY_ACK_RECOVERY_WRONG %',read;end if;
 preview:=pg_temp.ncr_must('session_change_preview_v1',jsonb_build_object('session_id',replacement->'primary_id','scope','single','patch',jsonb_build_object('capacity',jsonb_build_object('total',4)),'reason','Explicit selected capacity preview'));
 update private.p06_previews x set request=private.capacity_request(x.operation,x.request) where x.org_id=c.org and x.preview_id=(preview->>'id')::uuid and x.request#>'{patch,capacity,total}' is not null;
 read:=pg_temp.ncr_must('preview_get_v1',jsonb_build_object('preview_id',preview->'id'));
 if read->>'id' is distinct from preview->>'id' or read->>'token' is distinct from preview->>'token' then raise exception 'PATCH_PREVIEW_RECOVERY_WRONG';end if;
 program_preview:=pg_temp.ncr_must('program_preview_v1',jsonb_build_object('class_id',cls,'schedule',jsonb_build_object('weekdays',jsonb_build_array(1,2,3,4,5,6,7),'local_start','10:00:00','duration_minutes',60,'starts_on','2031-01-03','ends_on','2031-01-04','assignments',jsonb_build_array(jsonb_build_object('person_id',c.actor,'duty','instructor')),'capacity',jsonb_build_object('total',8))));
 update private.p06_previews x set request=private.capacity_request(x.operation,x.request) where x.org_id=c.org and x.preview_id=(program_preview->>'id')::uuid and x.request#>'{schedule,capacity,total}' is not null;
 read:=pg_temp.ncr_must('preview_get_v1',jsonb_build_object('preview_id',program_preview->'id'));
 if read->>'id' is distinct from program_preview->>'id' or read->>'token' is distinct from program_preview->>'token' then raise exception 'PROGRAM_PREVIEW_RECOVERY_WRONG';end if;
 -- Source-specific discovery exposes the selected occurrence and permanent replacement edge.
 management_change:=jsonb_build_object('operation','session_change_preview_v1','selector',jsonb_build_object('operation','session_change_preview_v1','key',jsonb_build_object('session_id',replacement->'primary_id','scope','single')),'page',jsonb_build_object('limit',1));
 read:=pg_temp.ncr_must('management_state_get_v1',management_change);
 if jsonb_array_length(read->'items')<>1 or read#>>'{items,0,entity,id}' is distinct from replacement->>'primary_id'
  or read#>>'{items,0,current,values,patch,capacity,total}'<>'5' or read#>'{items,0,current,values,patch,interval}' is null
  or jsonb_typeof(read#>'{items,0,current,values,patch,resources}') is distinct from 'array'
  or read#>>'{items,0,versions,0,version}' is distinct from changed->>'version' then raise exception 'SESSION_CHANGE_DISCOVERY_WRONG %',read;end if;
 management_replacement:=jsonb_build_object('operation','replacement_session_create_v1','selector',jsonb_build_object('operation','replacement_session_create_v1','key',jsonb_build_object('replaces_id',created->'primary_id')),'page',jsonb_build_object('limit',1));
 read:=pg_temp.ncr_must('management_state_get_v1',management_replacement);
 if jsonb_array_length(read->'items')<>1 or read#>>'{items,0,entity,id}' is distinct from replacement->>'primary_id'
  or read#>>'{items,0,current,values,replaces_id}' is distinct from created->>'primary_id'
  or read#>>'{items,0,versions,0,version}' is distinct from changed->>'version' then raise exception 'REPLACEMENT_DISCOVERY_EDGE_LOST %',read;end if;
 for request in select value from jsonb_array_elements(jsonb_build_array(management_change,management_replacement)) loop
  r:=pg_temp.ncr_call('management_state_get_v1',request||jsonb_build_object('center_id',c.other_center));
  if r#>>'{error,code}' is distinct from 'NOT_FOUND' then raise exception 'SESSION_DISCOVERY_WRONG_CENTER_ALLOWED %',r;end if;
 end loop;
 -- An expired stored result remains discoverable without invoking the old write.
 update core.operation_receipts set result_expires_at=clock_timestamp()-interval '1 second' where org_id=c.org and operation='replacement_session_create_v1' and key_hash=encode(extensions.digest(replace_key::text,'sha256'),'hex');
 read:=pg_temp.ncr_must('operation_status_get_v1',jsonb_build_object('operation','replacement_session_create_v1','key',replace_key));
 if read->>'status'<>'result_expired' or read->>'result_available'<>'false' or read->'result_reference'<>'null'::jsonb then raise exception 'EXPIRED_ACK_RECOVERY_WRONG %',read;end if;
 -- Recovery never turns an old receipt/capability into current center authority.
 update core.role_assignments set state='inactive',version=version+1 where org_id=c.org and person_id=c.actor and role='center_manager';
 for ctx in select * from (values('session_create_v1',create_key),('replacement_session_create_v1',replace_key),('session_capacity_set_v1',capacity_key)) x(op,k) loop
  r:=pg_temp.ncr_call('operation_status_get_v1',jsonb_build_object('operation',ctx.op,'key',ctx.k));
  if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'RECOVERY_AUTHORITY_LOSS_IGNORED % %',ctx.op,r;end if;
 end loop;
 for request in select value from jsonb_array_elements(jsonb_build_array(management_change,management_replacement)) loop
  r:=pg_temp.ncr_call('management_state_get_v1',request);
  if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'SESSION_DISCOVERY_AUTHORITY_LOSS_IGNORED %',r;end if;
 end loop;
 for ctx in select id from (values((preview->>'id')::uuid),((program_preview->>'id')::uuid)) x(id) loop
  r:=pg_temp.ncr_call('preview_get_v1',jsonb_build_object('preview_id',ctx.id));
  if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'PREVIEW_AUTHORITY_LOSS_IGNORED %',r;end if;
 end loop;
end$capacity_recovery$;
