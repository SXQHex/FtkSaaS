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
create temporary table pcm_context(org uuid,center uuid,other_center uuid,auth uuid,session uuid,actor uuid,source uuid,target uuid,third uuid,room uuid) on commit drop;
create temporary table pcm_responses(operation text,request jsonb,response jsonb) on commit drop;
create function pg_temp.pcm_call(op text,body jsonb) returns jsonb language plpgsql as $$
declare c pg_temp.pcm_context;r jsonb;result jsonb;
begin
 select * into c from pg_temp.pcm_context;
 r:=jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'org_id',c.org,'center_id',c.center)||body;
 if op not like '%_get_v1' and op not like '%_list_v1' and op not like '%_preview_v1' and not r?'operation_key' then r:=r||jsonb_build_object('operation_key',(pg_temp.bank(1))[1]);end if;
 if op in ('operation_status_get_v1','preview_get_v1') then r:=r-'center_id';end if;
 result:=private.execute_operation(op,r,c.auth,c.session,pg_temp.bank(512),jsonb_build_object('token',encode(extensions.gen_random_bytes(32),'hex')));
 insert into pg_temp.pcm_responses values(op,r,result);
 return result;
end$$;
create function pg_temp.pcm_must(op text,body jsonb) returns jsonb language plpgsql as $$
declare r jsonb:=pg_temp.pcm_call(op,body);
begin if r->>'ok' is distinct from 'true' then raise exception 'WEB1_OPERATION_FAILED % %',op,r;end if;return r->'data';end$$;
do $setup$
declare x uuid[]:=pg_temp.bank(32);features text[];p uuid;v jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(x[4],'pcm-probe@example.invalid',now());
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(x[5],x[4],now(),now(),'aal1');
 insert into core.accounts(id,auth_user_id,state) values(x[6],x[4],'active');
 insert into core.organizations(id,org_id,name,owner_person_id,state) values(x[1],x[1],'Synthetic pcm review',x[7],'active');
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
 insert into pg_temp.pcm_context values(x[1],x[2],x[3],x[4],x[5],x[7],x[8],x[9],x[10],x[15]);
end$setup$;
do $product_management_acceptance$
declare c pg_temp.pcm_context;terms jsonb;first_version uuid;new_version uuid;product uuid;other_version uuid;request jsonb;read jsonb;r jsonb;quote jsonb;sold jsonb;v bigint;original_sale jsonb;original_movements jsonb;version_count bigint;close_key uuid:=(pg_temp.bank(1))[1];cursor_value jsonb;pending_quote jsonb;sale_request jsonb;
begin
 select * into c from pg_temp.pcm_context;
 terms:='{"name":"Original synthetic product","kind":"credits","booking_mode":"flexible","credits":10,"price_minor":"120000","currency":"TRY","freeze":{"enabled":false,"extends_validity":false},"refund":{"method":"none"},"scopes":[{"scope_kind":"organization_all","center_id":null,"discipline_id":null,"usage_targets":["lesson"]}]}';
 first_version:=(pg_temp.pcm_must('product_publish_v1',jsonb_build_object('terms',terms))->>'primary_id')::uuid;
 select product_id into product from core.product_versions where id=first_version;
 other_version:=(pg_temp.pcm_must('product_publish_v1',jsonb_build_object('terms',terms||jsonb_build_object('name','Second synthetic product')))->>'primary_id')::uuid;
 quote:=pg_temp.pcm_must('sale_preview_v1',jsonb_build_object('person_id',c.source,'product_version_id',first_version,'start_date',current_date::text,'end_date',(current_date+30)::text));
 sold:=pg_temp.pcm_must('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',quote->'id','token',quote->'token')));
 select to_jsonb(s) into original_sale from core.sales s where id=(sold->>'primary_id')::uuid;
 select jsonb_agg(to_jsonb(m) order by id) into original_movements from core.entitlement_movements m where m.sale_id=(sold->>'primary_id')::uuid;
 select version into v from core.products where id=product;
 new_version:=(pg_temp.pcm_must('product_publish_v1',jsonb_build_object('product_id',product,'expected_version',v,'terms',terms||jsonb_build_object('name','Renamed synthetic product','price_minor','130000')))->>'primary_id')::uuid;
 if not exists(select 1 from core.products where id=product and name='Renamed synthetic product')
  or not exists(select 1 from core.product_versions where id=first_version and published_name='Original synthetic product' and price_minor=120000)
  or not exists(select 1 from core.product_versions where id=new_version and published_name='Renamed synthetic product' and price_minor=130000) then raise exception 'PRODUCT_RENAME_REWROTE_VERSION_HISTORY';end if;
 request:=jsonb_build_object('view','products','status','all','page',jsonb_build_object('limit',1));
 read:=pg_temp.pcm_must('products_management_list_v1',request);cursor_value:=read->'next_cursor';if cursor_value='null'::jsonb then raise exception 'PRODUCT_MANAGEMENT_CURSOR_MISSING';end if;
 r:=pg_temp.pcm_call('products_management_list_v1',request||jsonb_build_object('query','Renamed','page',jsonb_build_object('limit',1,'cursor',cursor_value)));if r#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'PRODUCT_CURSOR_REBOUND %',r;end if;
 read:=pg_temp.pcm_must('products_management_list_v1',request||jsonb_build_object('query','Renamed','page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>1 or read#>>'{items,0,id}'<>product::text or read#>>'{items,0,active_right_holders}'<>'1' then raise exception 'PRODUCT_CURRENT_VIEW_WRONG %',read;end if;
 read:=pg_temp.pcm_must('products_management_list_v1',jsonb_build_object('view','versions','product_id',product,'page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>2 or not exists(select 1 from jsonb_array_elements(read->'items') x where x->>'id'=first_version::text and x#>>'{terms,name}'='Original synthetic product') then raise exception 'PRODUCT_VERSION_VIEW_WRONG %',read;end if;
 read:=pg_temp.pcm_must('products_management_list_v1',jsonb_build_object('view','sales','product_id',product,'page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>1 or read#>>'{items,0,id}'<>sold->>'primary_id' or read#>>'{items,0,product_name}'<>'Original synthetic product' then raise exception 'PRODUCT_SALE_HISTORY_NAME_CHANGED %',read;end if;
 r:=pg_temp.pcm_call('products_management_list_v1',jsonb_build_object('view','versions','page',jsonb_build_object('limit',100)));if r#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'UNSCOPED_PRODUCT_HISTORY_ALLOWED';end if;
 select z.request into sale_request from pg_temp.pcm_responses z where operation='sale_apply_v1' and response#>>'{data,primary_id}'=sold->>'primary_id' limit 1;
 pending_quote:=pg_temp.pcm_must('sale_preview_v1',jsonb_build_object('person_id',c.target,'product_version_id',new_version,'start_date',current_date::text,'end_date',(current_date+30)::text));
 select count(*) into version_count from core.product_versions where product_id=product;
 select version into v from core.products where id=product;
 request:=jsonb_build_object('product_id',product,'expected_version',v,'action','close','reason','Explicit closure','operation_key',close_key);
 read:=pg_temp.pcm_must('product_state_set_v1',request);r:=pg_temp.pcm_must('product_state_set_v1',request);if r->>'replayed'<>'true' or r->>'primary_id' is distinct from read->>'primary_id' or r->>'version' is distinct from read->>'version' then raise exception 'PRODUCT_CLOSE_REPLAY_CHANGED';end if;
 r:=pg_temp.pcm_call('product_state_set_v1',request||jsonb_build_object('operation_key',(pg_temp.bank(1))[1]));if r#>>'{error,code}' is distinct from 'VERSION_CONFLICT' then raise exception 'PRODUCT_CLOSE_STALE_ALLOWED';end if;
 read:=pg_temp.pcm_must('products_management_list_v1',jsonb_build_object('view','products','status','closed','page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>1 or read#>>'{items,0,id}'<>product::text or read#>>'{items,0,state}'<>'inactive' then raise exception 'PRODUCT_CLOSED_VIEW_WRONG';end if;
 r:=pg_temp.pcm_call('sale_preview_v1',jsonb_build_object('person_id',c.source,'product_version_id',first_version,'start_date',current_date::text,'end_date',(current_date+30)::text));if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'CLOSED_PRODUCT_SALE_ALLOWED %',r;end if;
 r:=pg_temp.pcm_must('sale_apply_v1',sale_request);if r->>'primary_id' is distinct from sold->>'primary_id' or r->>'replayed'<>'true' then raise exception 'CLOSED_PRODUCT_ACK_REPLAY_LOST %',r;end if;
 r:=pg_temp.pcm_call('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',pending_quote->'id','token',pending_quote->'token')));
 if coalesce(r#>>'{error,code}','') not in ('FORBIDDEN','PREVIEW_STALE') then raise exception 'CLOSED_PRODUCT_PENDING_SALE_ALLOWED %',r;end if;
 select version into v from core.products where id=product;
 perform pg_temp.pcm_must('product_state_set_v1',jsonb_build_object('product_id',product,'expected_version',v,'action','open','reason','Explicit reopen'));
 r:=pg_temp.pcm_call('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',pending_quote->'id','token',pending_quote->'token')));if r#>>'{error,code}' is distinct from 'PREVIEW_STALE' then raise exception 'REOPEN_PRODUCT_STALE_DEPENDENCY_IGNORED %',r;end if;
 select version into v from core.products where id=product;
 perform pg_temp.pcm_must('product_state_set_v1',jsonb_build_object('product_id',product,'expected_version',v,'action','archive','reason','Explicit archive'));
 read:=pg_temp.pcm_must('products_management_list_v1',jsonb_build_object('view','products','status','archived','page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>1 or read#>>'{items,0,id}'<>product::text then raise exception 'PRODUCT_ARCHIVE_VIEW_WRONG';end if;
 if (select count(*) from core.product_versions where product_id=product)<>version_count
  or (select to_jsonb(s) from core.sales s where id=(sold->>'primary_id')::uuid) is distinct from original_sale
  or (select jsonb_agg(to_jsonb(m) order by id) from core.entitlement_movements m where m.sale_id=(sold->>'primary_id')::uuid) is distinct from original_movements
  or private.credit_available(c.org,(sold->>'primary_id')::uuid)<>10 then raise exception 'PRODUCT_LIFECYCLE_MUTATED_EXISTING_RIGHTS';end if;
 r:=pg_temp.pcm_call('product_state_set_v1',jsonb_build_object('center_id',c.other_center,'product_id',product,'expected_version',(select version from core.products where id=product),'action','open','reason','Wrong center'));if coalesce(r#>>'{error,code}','') not in ('NOT_FOUND','FORBIDDEN') then raise exception 'PRODUCT_OTHER_CENTER_WRITE_ALLOWED %',r;end if;
 update core.saas_plan_versions set features=array_remove(features,'F15') where id=(select plan_version_id from core.saas_subscriptions where org_id=c.org);
 r:=pg_temp.pcm_call('products_management_list_v1',jsonb_build_object('view','products','page',jsonb_build_object('limit',1)));
 if r#>>'{error,code}' is distinct from 'PLAN_FEATURE_UNAVAILABLE' then raise exception 'PRODUCT_MANAGEMENT_F15_BYPASS %',r;end if;
 r:=pg_temp.pcm_call('product_state_set_v1',jsonb_build_object('product_id',product,'expected_version',(select version from core.products where id=product),'action','open','reason','Feature missing'));
 if r#>>'{error,code}' is distinct from 'PLAN_FEATURE_UNAVAILABLE' then raise exception 'PRODUCT_LIFECYCLE_F15_BYPASS %',r;end if;
 update core.saas_plan_versions set features=array_append(features,'F15') where id=(select plan_version_id from core.saas_subscriptions where org_id=c.org);

end$product_management_acceptance$;
do $conditional_product_features$
declare c pg_temp.pcm_context;terms jsonb;version_id uuid;product uuid;request jsonb;r jsonb;read jsonb;
begin
 select * into c from pg_temp.pcm_context;
 terms:='{"name":"Timed feature probe","kind":"timed","booking_mode":"flexible","price_minor":"120000","currency":"TRY","freeze":{"enabled":false,"extends_validity":false},"refund":{"method":"none"},"scopes":[{"scope_kind":"organization_all","center_id":null,"discipline_id":null,"usage_targets":["lesson"]}]}';
 version_id:=(pg_temp.pcm_must('product_publish_v1',jsonb_build_object('terms',terms))->>'primary_id')::uuid;
 select product_id into product from core.product_versions where id=version_id;
 request:=jsonb_build_object('product_id',product,'expected_version',(select version from core.products where id=product),'action','close','reason','Timed feature acceptance','operation_key',(pg_temp.bank(1))[1]);
 perform pg_temp.pcm_must('product_state_set_v1',request);
 update core.saas_plan_versions set features=array_remove(features,'F16') where id=(select plan_version_id from core.saas_subscriptions where org_id=c.org);
 r:=pg_temp.pcm_call('product_state_set_v1',request);
 if r#>>'{error,code}' is distinct from 'PLAN_FEATURE_UNAVAILABLE' then raise exception 'TIMED_STATE_ACK_REPLAY_F16_BYPASS %',r;end if;
 r:=pg_temp.pcm_call('product_state_set_v1',request||jsonb_build_object('operation_key',(pg_temp.bank(1))[1],'expected_version',(select version from core.products where id=product),'action','open'));
 if r#>>'{error,code}' is distinct from 'PLAN_FEATURE_UNAVAILABLE' then raise exception 'TIMED_STATE_WRITE_F16_BYPASS %',r;end if;
 if not exists(select 1 from core.products where id=product and state='inactive') then raise exception 'TIMED_FEATURE_REJECTION_MUTATED_STATE';end if;
 update core.saas_plan_versions set features=array_append(features,'F16') where id=(select plan_version_id from core.saas_subscriptions where org_id=c.org);
 update core.saas_plan_versions set features=array_remove(features,'F19') where id=(select plan_version_id from core.saas_subscriptions where org_id=c.org);
 r:=pg_temp.pcm_call('products_management_list_v1',jsonb_build_object('view','products','page',jsonb_build_object('limit',1)));
 if r#>>'{error,code}' is distinct from 'PLAN_FEATURE_UNAVAILABLE' then raise exception 'PRODUCT_FINANCE_PROJECTION_F19_BYPASS %',r;end if;
 read:=pg_temp.pcm_must('products_list_v1',jsonb_build_object('page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>1 then raise exception 'LEGACY_CATALOG_NEW_FINANCE_GATE %',read;end if;
 update core.saas_plan_versions set features=array_append(features,'F19') where id=(select plan_version_id from core.saas_subscriptions where org_id=c.org);
 insert into private.p07_subscription_scope(subscription_id,kept_center_id,starter_scope) select id,c.center,jsonb_build_object('student_person_ids',jsonb_build_array(c.target)) from core.saas_subscriptions where org_id=c.org;
 update core.saas_plan_versions set name='starter' where id=(select plan_version_id from core.saas_subscriptions where org_id=c.org);
 read:=pg_temp.pcm_must('products_management_list_v1',jsonb_build_object('view','products','page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>0 or read#>>'{totals,on_sale}'<>'0' then raise exception 'STARTER_INELIGIBLE_CATALOG_LEAK %',read;end if;
 r:=pg_temp.pcm_call('product_state_set_v1',request||jsonb_build_object('operation_key',(pg_temp.bank(1))[1],'expected_version',(select version from core.products where id=product),'action','open'));
 if r#>>'{error,code}' is distinct from 'PLAN_FEATURE_UNAVAILABLE' then raise exception 'STARTER_INELIGIBLE_PRODUCT_WRITE %',r;end if;
 update core.saas_plan_versions set name='business' where id=(select plan_version_id from core.saas_subscriptions where org_id=c.org);
 delete from private.p07_subscription_scope where subscription_id=(select id from core.saas_subscriptions where org_id=c.org);
end$conditional_product_features$;
do $class_student_acceptance$
declare c pg_temp.pcm_context;ids uuid[]:=pg_temp.bank(32);dis uuid;cls uuid;other_class uuid;policy uuid;request jsonb;read jsonb;r jsonb;cursor_value jsonb;before_relationships bigint;before_reservations bigint;before_audits bigint;item jsonb;group_request jsonb;
begin
 select * into c from pg_temp.pcm_context;dis:=ids[1];cls:=ids[2];other_class:=ids[3];
 insert into core.disciplines(id,org_id,name,state) values(dis,c.org,'Priority directory discipline','active');
 insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values(ids[4],c.org,c.center,dis,'active');
 insert into core.classes(id,org_id,center_id,name,discipline_id,state,external_open) values(cls,c.org,c.center,'Selected fixed group',dis,'active',false),(other_class,c.org,c.center,'Different fixed group',dis,'active',false);
 insert into core.program_versions(id,org_id,center_id,class_id,weekdays,local_start,duration_minutes,starts_on,ends_on,state,timezone)
 values(ids[5],c.org,c.center,cls,array[1,2,3,4,5,6,7]::bigint[],'10:00:00',60,'2031-01-01','2031-02-01','active','UTC'),
 (ids[6],c.org,c.center,cls,array[1,2,3,4,5,6,7]::bigint[],'10:00:00',60,'2031-01-01','2031-02-01','active','UTC'),
 (ids[7],c.org,c.center,other_class,array[1,2,3,4,5,6,7]::bigint[],'10:00:00',60,'2031-01-01','2031-02-01','active','UTC');
 insert into core.sessions(id,org_id,center_id,class_id,program_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state)
 values(ids[8],c.org,c.center,cls,ids[5],dis,'group','2031-01-01T10:00:00Z','2031-01-01T11:00:00Z',10,10,'planned','open'),
 (ids[9],c.org,c.center,cls,ids[5],dis,'group','2031-01-02T10:00:00Z','2031-01-02T11:00:00Z',10,10,'planned','open'),
 (ids[10],c.org,c.center,cls,ids[6],dis,'group','2031-01-03T10:00:00Z','2031-01-03T11:00:00Z',10,10,'planned','open'),
 (ids[11],c.org,c.center,other_class,ids[7],dis,'group','2031-01-04T10:00:00Z','2031-01-04T11:00:00Z',10,10,'planned','open');
 policy:=(pg_temp.pcm_must('policy_publish_v1',jsonb_build_object('center_id',null,'key','student_cancel_group','value','{"kind":"cancellation","terms":{"cutoff_minutes":0,"before_cutoff":"release","after_cutoff":"release","no_show":"consume"}}'::jsonb,'effective_at',clock_timestamp(),'mandatory',false))->>'primary_id')::uuid;
 insert into core.people(id,org_id,display_name,state,merged_into_id) values(ids[12],c.org,'Priority historical alias','merged',c.source);
 insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id,version)
 values(ids[13],c.org,c.center,ids[8],c.source,'priority','active',policy,1),
 (ids[14],c.org,c.center,ids[9],c.source,'priority','active',policy,2),
 (ids[15],c.org,c.center,ids[8],c.target,'priority','active',policy,1),
 (ids[16],c.org,c.center,ids[8],c.third,'flexible','active',policy,1),
 (ids[17],c.org,c.center,ids[10],c.source,'priority','cancelled',policy,3),
 (ids[18],c.org,c.center,ids[9],ids[12],'priority','cancelled',policy,4),
 (ids[19],c.org,c.center,ids[11],c.third,'priority','active',policy,1);
 select count(*) into before_relationships from core.center_relationships where org_id=c.org;
 select count(*) into before_reservations from core.reservations where org_id=c.org;
 select count(*) into before_audits from core.audit_events where org_id=c.org;
 request:=jsonb_build_object('operation','reservation_cancel_v1','selector',jsonb_build_object('operation','reservation_cancel_v1','key',jsonb_build_object('directory','class','class_id',cls,'interval',jsonb_build_object('starts_at','2031-01-01T00:00:00Z','ends_at','2031-01-05T00:00:00Z'),'status','active')),'page',jsonb_build_object('limit',1));
 read:=pg_temp.pcm_must('management_state_get_v1',request);cursor_value:=read->'next_cursor';if cursor_value='null'::jsonb then raise exception 'GROUP_PERSON_CURSOR_MISSING';end if;
 r:=pg_temp.pcm_must('management_state_get_v1',request||jsonb_build_object('page',jsonb_build_object('limit',1,'cursor',cursor_value)));if r#>>'{items,0,entity,id}' is not distinct from read#>>'{items,0,entity,id}' then raise exception 'GROUP_NEXT_PAGE_REPEATED_PERSON';end if;
 read:=pg_temp.pcm_must('management_state_get_v1',request||jsonb_build_object('page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>2 or exists(select 1 from jsonb_array_elements(read->'items') x where x#>>'{entity,id}'=c.third::text) then raise exception 'GROUP_INCLUDED_FLEXIBLE_OR_OTHER_CLASS %',read;end if;
 select x into item from jsonb_array_elements(read->'items') x where x#>>'{entity,id}'=c.source::text;
 if jsonb_array_length(item#>'{group_student,reservations}')<>2 or jsonb_array_length(item->'versions')<>3
  or not exists(select 1 from jsonb_array_elements(item->'versions') x where x#>>'{entity,id}'=ids[14]::text and x->>'version'='2') then raise exception 'GROUP_DROPPED_OCCURRENCE_OR_VERSION %',item;end if;
 request:=jsonb_set(request,'{selector,key,status}','"all"');
 read:=pg_temp.pcm_must('management_state_get_v1',request||jsonb_build_object('page',jsonb_build_object('limit',100)));
 select x into item from jsonb_array_elements(read->'items') x where x#>>'{entity,id}'=c.source::text;
 if jsonb_array_length(item#>'{group_student,reservations}')<>4 then raise exception 'GROUP_STATUS_ALL_OR_ALIAS_HISTORY_MISSING %',read;end if;
 r:=pg_temp.pcm_call('management_state_get_v1',request||jsonb_build_object('page',jsonb_build_object('limit',1,'cursor',cursor_value)));if r#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'GROUP_CURSOR_STATUS_REBOUND %',r;end if;
 request:=jsonb_set(request,'{selector,key,program_id}',to_jsonb(ids[5]));
 read:=pg_temp.pcm_must('management_state_get_v1',request||jsonb_build_object('page',jsonb_build_object('limit',100)));
 select x into item from jsonb_array_elements(read->'items') x where x#>>'{entity,id}'=c.source::text;
 if jsonb_array_length(item#>'{group_student,reservations}')<>3 then raise exception 'GROUP_PROGRAM_FILTER_WRONG %',read;end if;
 r:=pg_temp.pcm_call('management_state_get_v1',jsonb_set(request,'{selector,key,program_id}',to_jsonb(ids[7])));if r#>>'{error,code}' is distinct from 'NOT_FOUND' then raise exception 'GROUP_FOREIGN_PROGRAM_ALLOWED %',r;end if;
 r:=pg_temp.pcm_call('management_state_get_v1',request||jsonb_build_object('center_id',c.other_center));if coalesce(r#>>'{error,code}','') not in ('FORBIDDEN','NOT_FOUND') then raise exception 'GROUP_OTHER_CENTER_ALLOWED %',r;end if;
 request:=jsonb_set(request,'{selector,key,query}','"no such synthetic student"');read:=pg_temp.pcm_must('management_state_get_v1',request);
 if jsonb_array_length(read->'items')<>0 then raise exception 'GROUP_NAME_FILTER_WRONG';end if;
 if (select count(*) from core.center_relationships where org_id=c.org)<>before_relationships or (select count(*) from core.reservations where org_id=c.org)<>before_reservations or (select count(*) from core.audit_events where org_id=c.org)<>before_audits then raise exception 'GROUP_DISCOVERY_CREATED_PERMANENT_MEMBERSHIP_OR_WRITE';end if;
 group_request:=request;
 -- Center account directory includes unlinked identities and canonicalizes historical aliases.
 insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values((pg_temp.bank(1))[1],c.org,c.center,ids[12],'student','inactive',now()-interval '1 year');
 request:=jsonb_build_object('operation','account_link_remove_v1','selector',jsonb_build_object('operation','account_link_remove_v1','key',jsonb_build_object('directory','center','view','people','status','all')),'page',jsonb_build_object('limit',100));
 read:=pg_temp.pcm_must('management_state_get_v1',request);
 if jsonb_array_length(read->'items')<>4 or read#>>'{access_summary,total}'<>'4'
  or (select count(*) from jsonb_array_elements(read->'items') x where x#>>'{access_detail,person_id}'=c.source::text)<>1
  or exists(select 1 from jsonb_array_elements(read->'items') x where x#>>'{access_detail,person_id}'=ids[12]::text)
  or not exists(select 1 from jsonb_array_elements(read->'items') x where x#>>'{access_detail,person_id}'=c.actor::text and x#>>'{access_detail,linked}'='true')
 then raise exception 'ACCOUNT_DIRECTORY_UNFILTERED_OR_ALIAS_WRONG %',read;end if;
 if read::text ~ '"(account_id|auth_user_id|token|recipient|provider_reference)"[ ]*:' then raise exception 'ACCOUNT_DIRECTORY_PRIVATE_SOURCE_LEAK %',read;end if;
 r:=pg_temp.pcm_must('management_state_get_v1',jsonb_set(request,'{selector,key,status}','"unlinked"'));
 if jsonb_array_length(r->'items')<>3 or r#>>'{access_summary,filtered}'<>'3' then raise exception 'ACCOUNT_DIRECTORY_UNLINKED_MISSING %',r;end if;
 r:=pg_temp.pcm_must('management_state_get_v1',jsonb_set(request,'{selector,key,status}','"linked"'));
 if jsonb_array_length(r->'items')<>1 or r#>>'{items,0,access_detail,person_id}'<>c.actor::text then raise exception 'ACCOUNT_DIRECTORY_LINKED_WRONG %',r;end if;
 r:=pg_temp.pcm_must('management_state_get_v1',jsonb_set(request,'{selector,key,query}','"Match A"'));
 if jsonb_array_length(r->'items')<>1 or r#>>'{items,0,access_detail,person_id}'<>c.source::text then raise exception 'ACCOUNT_DIRECTORY_QUERY_WRONG %',r;end if;
 request:=jsonb_set(request,'{page}','{"limit":1}');read:=pg_temp.pcm_must('management_state_get_v1',request);cursor_value:=read->'next_cursor';
 r:=pg_temp.pcm_must('management_state_get_v1',jsonb_set(request,'{page}',jsonb_build_object('limit',1,'cursor',cursor_value)));
 if r#>>'{items,0,access_detail,person_id}' is not distinct from read#>>'{items,0,access_detail,person_id}' then raise exception 'ACCOUNT_DIRECTORY_CURSOR_REPEATED';end if;
 r:=pg_temp.pcm_call('management_state_get_v1',jsonb_set(jsonb_set(request,'{selector,key,status}','"unlinked"'),'{page}',jsonb_build_object('limit',1,'cursor',cursor_value)));
 if r#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'ACCOUNT_DIRECTORY_CURSOR_REBOUND %',r;end if;
 update core.role_assignments set state='inactive',version=version+1 where org_id=c.org and person_id=c.actor and role='center_manager';
 r:=pg_temp.pcm_call('management_state_get_v1',group_request);if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'GROUP_CM_REVOCATION_IGNORED %',r;end if;
 r:=pg_temp.pcm_call('products_management_list_v1',jsonb_build_object('view','products','page',jsonb_build_object('limit',1)));if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'PRODUCT_CM_REVOCATION_IGNORED %',r;end if;
 r:=pg_temp.pcm_call('management_state_get_v1',request);if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'ACCOUNT_DIRECTORY_CM_REVOCATION_IGNORED %',r;end if;
end$class_student_acceptance$;
