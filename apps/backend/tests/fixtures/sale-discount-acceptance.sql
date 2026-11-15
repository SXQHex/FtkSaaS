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
create temporary table sda_context(org uuid,center uuid,other_center uuid,auth uuid,session uuid,actor uuid,source uuid,target uuid,third uuid,room uuid) on commit drop;
create temporary table sda_responses(operation text,request jsonb,response jsonb) on commit drop;
create function pg_temp.sda_call(op text,body jsonb) returns jsonb language plpgsql as $$
declare c pg_temp.sda_context;r jsonb;result jsonb;
begin
 select * into c from pg_temp.sda_context;
 r:=jsonb_build_object('client_api_version',1,'request_id',(pg_temp.bank(1))[1],'org_id',c.org,'center_id',c.center)||body;
 if op not like '%_get_v1' and op not like '%_list_v1' and op not like '%_preview_v1' and not r?'operation_key' then r:=r||jsonb_build_object('operation_key',(pg_temp.bank(1))[1]);end if;
 if op in ('operation_status_get_v1','preview_get_v1') then r:=r-'center_id';end if;
 result:=private.execute_operation(op,r,c.auth,c.session,pg_temp.bank(512),jsonb_build_object('token',encode(extensions.gen_random_bytes(32),'hex')));
 insert into pg_temp.sda_responses values(op,r,result);
 return result;
end$$;
create function pg_temp.sda_must(op text,body jsonb) returns jsonb language plpgsql as $$
declare r jsonb:=pg_temp.sda_call(op,body);
begin if r->>'ok' is distinct from 'true' then raise exception 'WEB1_OPERATION_FAILED % %',op,r;end if;return r->'data';end$$;
do $setup$
declare x uuid[]:=pg_temp.bank(32);features text[];p uuid;v jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(x[4],'sda-probe@example.invalid',now());
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(x[5],x[4],now(),now(),'aal1');
 insert into core.accounts(id,auth_user_id,state) values(x[6],x[4],'active');
 insert into core.organizations(id,org_id,name,owner_person_id,state) values(x[1],x[1],'Synthetic sda review',x[7],'active');
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
 insert into pg_temp.sda_context values(x[1],x[2],x[3],x[4],x[5],x[7],x[8],x[9],x[10],x[15]);
end$setup$;
do $discount_acceptance$
declare c pg_temp.sda_context;product uuid;terms jsonb;base jsonb;r jsonb;p jsonb;stale jsonb;sold jsonb;free_sale jsonb;debt uuid;v bigint;movement_count bigint;refund jsonb;
begin
 select * into c from pg_temp.sda_context;
 terms:='{"name":"Synthetic explicit discounted sale","kind":"credits","booking_mode":"flexible","credits":10,"price_minor":"120000","currency":"TRY","freeze":{"enabled":false,"extends_validity":false},"refund":{"method":"credit_ratio"},"quota":null,"scopes":[{"scope_kind":"organization_all","center_id":null,"discipline_id":null,"usage_targets":["lesson"]}]}';
 product:=(pg_temp.sda_must('product_publish_v1',jsonb_build_object('terms',terms))->>'primary_id')::uuid;
 base:=jsonb_build_object('person_id',c.source,'product_version_id',product,'start_date','2031-01-01','end_date','2031-02-01');
 if exists(select 1 from core.permission_overrides where org_id=c.org and person_id=c.actor and permission='sale.discount') then raise exception 'DISCOUNT_AUTOMATICALLY_GRANTED';end if;
 p:=pg_temp.sda_must('sale_preview_v1',base);if p#>>'{sale,debt_minor}'<>'120000' then raise exception 'UNDISCOUNTED_PREVIEW_CHANGED';end if;
 p:=pg_temp.sda_must('sale_preview_v1',base||jsonb_build_object('net_minor','120000'));if p#>>'{sale,debt_minor}'<>'120000' then raise exception 'EQUAL_NET_REQUIRES_DISCOUNT';end if;
 r:=pg_temp.sda_call('sale_preview_v1',base||jsonb_build_object('net_minor','100000'));if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'CM_DISCOUNT_WITHOUT_GRANT %',r;end if;
 -- A manager is eligible for this explicit choice but does not receive it automatically.
 select version into v from core.people where id=c.actor;
 perform pg_temp.sda_must('permission_set_v1',jsonb_build_object('person_id',c.actor,'permission','sale.discount','enabled',true,'expected_version',v));
 if not exists(select 1 from core.permission_overrides where org_id=c.org and center_id=c.center and person_id=c.actor and permission='sale.discount' and enabled) then raise exception 'EXPLICIT_DISCOUNT_GRANT_NOT_SAVED';end if;
 r:=pg_temp.sda_call('sale_preview_v1',base||jsonb_build_object('net_minor','100000'));if r#>>'{error,code}' is distinct from 'POLICY_NOT_CONFIGURED' then raise exception 'MISSING_DISCOUNT_POLICY_ALLOWED %',r;end if;
 perform pg_temp.sda_must('policy_publish_v1',jsonb_build_object('center_id',null,'key','sale_discount_percent_upper','value',jsonb_build_object('kind','integer','value',20),'effective_at',clock_timestamp()-interval '1 second','mandatory',false));
 p:=pg_temp.sda_must('sale_preview_v1',base||jsonb_build_object('net_minor','96000'));if p#>>'{sale,debt_minor}'<>'96000' then raise exception 'EXACT_DISCOUNT_BOUND_WRONG';end if;
 r:=pg_temp.sda_call('sale_preview_v1',base||jsonb_build_object('net_minor','95999'));if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'EXCESS_DISCOUNT_ALLOWED %',r;end if;
 for r in select value from jsonb_array_elements('["-1","120001"]'::jsonb) loop
  p:=pg_temp.sda_call('sale_preview_v1',base||jsonb_build_object('net_minor',r));if p#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'INVALID_NET_ALLOWED %',p;end if;
 end loop;
 stale:=pg_temp.sda_must('sale_preview_v1',base||jsonb_build_object('net_minor','100000'));
 perform pg_temp.sda_must('policy_publish_v1',jsonb_build_object('center_id',null,'key','sale_discount_percent_upper','value',jsonb_build_object('kind','integer','value',30),'effective_at',clock_timestamp(),'mandatory',false));
 r:=pg_temp.sda_call('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',stale->'id','token',stale->'token')));if r#>>'{error,code}' is distinct from 'PREVIEW_STALE' then raise exception 'DISCOUNT_POLICY_CHANGE_NOT_STALE %',r;end if;
 stale:=pg_temp.sda_must('sale_preview_v1',base||jsonb_build_object('net_minor','100000'));
 select version into v from core.people where id=c.actor;
 perform pg_temp.sda_must('permission_set_v1',jsonb_build_object('person_id',c.actor,'permission','sale.discount','enabled',false,'expected_version',v));
 r:=pg_temp.sda_call('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',stale->'id','token',stale->'token')));if r->>'ok'='true' or coalesce(r#>>'{error,code}','') not in ('FORBIDDEN','PREVIEW_STALE') then raise exception 'DISCOUNT_REVOKED_GRANT_APPLIED %',r;end if;
 select version into v from core.people where id=c.actor;
 perform pg_temp.sda_must('permission_set_v1',jsonb_build_object('person_id',c.actor,'permission','sale.discount','enabled',true,'expected_version',v));
 p:=pg_temp.sda_must('sale_preview_v1',base||jsonb_build_object('net_minor','100000'));if p#>>'{sale,debt_minor}'<>'100000' or p#>>'{sale,granted}'<>'10' or p#>>'{sale,available}'<>'10' then raise exception 'DISCOUNT_CHANGED_PREVIEW_RIGHTS %',p;end if;
 sold:=pg_temp.sda_must('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')));
 select id into debt from core.debts where org_id=c.org and sale_id=(sold->>'primary_id')::uuid;
 if not exists(select 1 from core.sales where id=(sold->>'primary_id')::uuid and net_minor=100000)
  or not exists(select 1 from core.debts where id=debt and amount_minor=100000)
  or private.credit_available(c.org,(sold->>'primary_id')::uuid)<>10 then raise exception 'DISCOUNT_SALE_DEBT_OR_RIGHTS_WRONG';end if;
 perform pg_temp.sda_must('collection_record_v1',jsonb_build_object('person_id',c.source,'amount_minor','40000','currency','TRY','debt_ids',jsonb_build_array(debt),'occurred_at',clock_timestamp()));
 if private.debt_remaining(c.org,debt)<>60000 then raise exception 'PARTIAL_COLLECTION_NOT_NET_BASED';end if;
 select count(*) into movement_count from core.entitlement_movements where org_id=c.org and sale_id=(sold->>'primary_id')::uuid;
 r:=private.p02_refund_quote(c.org,(sold->>'primary_id')::uuid);if r->>'calculated_minor'<>'100000' then raise exception 'REFUND_QUOTE_USED_LIST_PRICE %',r;end if;
 refund:=pg_temp.sda_must('sale_refund_preview_v1',jsonb_build_object('sale_id',sold->'primary_id','reason','Refund actual discounted sale'));
 perform pg_temp.sda_must('sale_refund_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',refund->'id','token',refund->'token')));
 if private.debt_net(c.org,debt)<>0 or private.debt_claimed(c.org,debt)<>40000 then raise exception 'REFUND_USED_LIST_PRICE_NOT_NET';end if;
 if (select count(*) from core.entitlement_movements where org_id=c.org and sale_id=(sold->>'primary_id')::uuid)<>movement_count then raise exception 'REFUND_REWROTE_CREDIT_GRANT';end if;
 perform pg_temp.sda_must('policy_publish_v1',jsonb_build_object('center_id',null,'key','sale_discount_percent_upper','value',jsonb_build_object('kind','integer','value',0),'effective_at',clock_timestamp(),'mandatory',false));
 p:=pg_temp.sda_must('sale_preview_v1',base||jsonb_build_object('net_minor','120000'));if p#>>'{sale,debt_minor}'<>'120000' then raise exception 'ZERO_PERCENT_EQUAL_NET_FAILED';end if;
 r:=pg_temp.sda_call('sale_preview_v1',base||jsonb_build_object('net_minor','119999'));if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'ZERO_PERCENT_DISCOUNT_ALLOWED';end if;
 perform pg_temp.sda_must('policy_publish_v1',jsonb_build_object('center_id',null,'key','sale_discount_percent_upper','value',jsonb_build_object('kind','integer','value',100),'effective_at',clock_timestamp(),'mandatory',false));
 p:=pg_temp.sda_must('sale_preview_v1',base||jsonb_build_object('net_minor','0'));if p#>>'{sale,debt_minor}'<>'0' or p#>>'{sale,granted}'<>'10' then raise exception 'FULL_DISCOUNT_PREVIEW_WRONG';end if;
 free_sale:=pg_temp.sda_must('sale_apply_v1',jsonb_build_object('preview',jsonb_build_object('id',p->'id','token',p->'token')));
 if not exists(select 1 from core.sales where id=(free_sale->>'primary_id')::uuid and net_minor=0) or exists(select 1 from core.debts where org_id=c.org and sale_id=(free_sale->>'primary_id')::uuid)
  or private.credit_available(c.org,(free_sale->>'primary_id')::uuid)<>10 then raise exception 'FULL_DISCOUNT_CREATED_DEBT_OR_LOST_RIGHTS';end if;
end$discount_acceptance$;
do $ledger_membership_acceptance$
declare c pg_temp.sda_context;ids uuid[]:=pg_temp.bank(12);selected_sale uuid;other_sale uuid;grant_id uuid;receipt_id uuid;baseline jsonb;with_ledger jsonb;page jsonb;r jsonb;request jsonb;cursor_value jsonb;sum_delta bigint;before_audit bigint;item jsonb;movement_at timestamptz:=clock_timestamp();
begin
 select * into c from pg_temp.sda_context;
 select id into selected_sale from core.sales where org_id=c.org and person_id=c.source and net_minor=0;
 select id into other_sale from core.sales where org_id=c.org and person_id=c.source and net_minor=100000;
 select id,operation_id into grant_id,receipt_id from core.entitlement_movements where org_id=c.org and sale_id=selected_sale and kind='grant';
 -- Real append-only movements exercise signed adjustments and linked reversals.
 insert into core.entitlement_movements(id,org_id,sale_id,person_id,kind,quantity,operation_id,created_at)
 values(ids[1],c.org,selected_sale,c.source,'adjust_subtract',3,receipt_id,movement_at);
 insert into core.entitlement_movements(id,org_id,sale_id,person_id,kind,quantity,operation_id,created_at)
 values(ids[11],c.org,selected_sale,c.source,'consume',2,receipt_id,movement_at+interval '1 millisecond');
 insert into core.entitlement_movements(id,org_id,sale_id,person_id,kind,quantity,previous_id,operation_id,created_at)
 values(ids[2],c.org,selected_sale,c.source,'reverse',2,ids[11],receipt_id,movement_at+interval '2 milliseconds');
 baseline:=pg_temp.sda_must('entitlements_get_v1',jsonb_build_object('person_id',c.source));
 if exists(select 1 from jsonb_array_elements(baseline) x where x?'movements') then raise exception 'DEFAULT_RIGHTS_ADDED_LEDGER';end if;
 select count(*) into before_audit from core.audit_events where org_id=c.org;
 request:=jsonb_build_object('person_id',c.source,'ledger_sale_id',selected_sale,'ledger_page',jsonb_build_object('limit',1));
 with_ledger:=pg_temp.sda_must('entitlements_get_v1',request);
 select x into item from jsonb_array_elements(with_ledger) x where x->>'sale_id'=selected_sale::text;
 if item->'movements' is null or jsonb_array_length(item#>'{movements,items}')<>1 or item#>>'{movements,items,0,kind}'<>'grant' or item#>>'{movements,items,0,balance_delta}'<>'10' then raise exception 'LEDGER_GRANT_PAGE_WRONG %',item;end if;
 if (select jsonb_agg(x-'movements' order by n) from jsonb_array_elements(with_ledger) with ordinality a(x,n)) is distinct from baseline then raise exception 'LEDGER_CHANGED_RIGHTS_PROJECTION';end if;
 cursor_value:=item#>'{movements,next_cursor}';if cursor_value='null'::jsonb then raise exception 'LEDGER_CURSOR_MISSING';end if;
 with_ledger:=pg_temp.sda_must('entitlements_get_v1',request||jsonb_build_object('ledger_page',jsonb_build_object('limit',1,'cursor',cursor_value)));
 select x->'movements' into page from jsonb_array_elements(with_ledger) x where x->>'sale_id'=selected_sale::text;
 if page#>>'{items,0,id}'<>ids[1]::text or page#>>'{items,0,balance_delta}'<>'-3' or page#>>'{items,0,source,id}'<>selected_sale::text then raise exception 'LEDGER_ADJUSTMENT_SIGN_WRONG %',page;end if;
 with_ledger:=pg_temp.sda_must('entitlements_get_v1',request||jsonb_build_object('ledger_page',jsonb_build_object('limit',1,'cursor',page->'next_cursor')));
 select x->'movements' into page from jsonb_array_elements(with_ledger) x where x->>'sale_id'=selected_sale::text;
 if page#>>'{items,0,id}'<>ids[11]::text or page#>>'{items,0,balance_delta}'<>'-2' then raise exception 'LEDGER_CONSUMPTION_SIGN_WRONG %',page;end if;
 with_ledger:=pg_temp.sda_must('entitlements_get_v1',request||jsonb_build_object('ledger_page',jsonb_build_object('limit',1,'cursor',page->'next_cursor')));
 select x->'movements' into page from jsonb_array_elements(with_ledger) x where x->>'sale_id'=selected_sale::text;
 if page#>>'{items,0,id}'<>ids[2]::text or page#>>'{items,0,previous_id}'<>ids[11]::text or page#>>'{items,0,balance_delta}'<>'2' or page->'next_cursor'<>'null'::jsonb then raise exception 'LEDGER_REVERSE_LINK_OR_SIGN_WRONG %',page;end if;
 if private.credit_available(c.org,selected_sale)<>7 then raise exception 'LEDGER_READ_MUTATED_BALANCE';end if;
 r:=pg_temp.sda_call('entitlements_get_v1',request||jsonb_build_object('person_id',c.target));if r#>>'{error,code}' is distinct from 'NOT_FOUND' then raise exception 'LEDGER_WRONG_PERSON_LEAK %',r;end if;
 r:=pg_temp.sda_call('entitlements_get_v1',request||jsonb_build_object('ledger_sale_id',(pg_temp.bank(1))[1]));if r#>>'{error,code}' is distinct from 'NOT_FOUND' then raise exception 'LEDGER_UNKNOWN_SALE_LEAK %',r;end if;
 r:=pg_temp.sda_call('entitlements_get_v1',request||jsonb_build_object('center_id',c.other_center));if coalesce(r#>>'{error,code}','') not in ('NOT_FOUND','FORBIDDEN') then raise exception 'LEDGER_OTHER_CENTER_LEAK %',r;end if;
 r:=pg_temp.sda_call('entitlements_get_v1',request||jsonb_build_object('ledger_sale_id',other_sale,'ledger_page',jsonb_build_object('limit',1,'cursor',cursor_value)));if r#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'LEDGER_CURSOR_REBOUND %',r;end if;
 -- The student's native self rights do not require manager/audit privileges.
 insert into auth.users(id,email,email_confirmed_at) values(ids[7],'ledger-self@example.invalid',now());
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(ids[8],ids[7],now(),now(),'aal1');
 insert into core.accounts(id,auth_user_id,state) values(ids[9],ids[7],'active');
 insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values(ids[10],c.org,ids[9],c.source,'active',now());
 update pg_temp.sda_context set auth=ids[7],session=ids[8],actor=c.source;
 r:=pg_temp.sda_call('audit_list_v1',jsonb_build_object('subject',jsonb_build_object('type','sales','id',selected_sale),'interval',jsonb_build_object('starts_at','2020-01-01T00:00:00Z','ends_at','2032-01-01T00:00:00Z'),'page',jsonb_build_object('limit',1)));
 if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'SELF_LEDGER_FIXTURE_HAS_AUDIT_AUTHORITY %',r;end if;
 with_ledger:=pg_temp.sda_must('entitlements_get_v1',request);
 select x->'movements' into page from jsonb_array_elements(with_ledger) x where x->>'sale_id'=selected_sale::text;
 if page#>>'{items,0,balance_delta}'<>'10' then raise exception 'SELF_LEDGER_REQUIRED_AUDIT_PERMISSION';end if;
 update pg_temp.sda_context set auth=c.auth,session=c.session,actor=c.actor;
 if (select count(*) from core.audit_events where org_id=c.org)<>before_audit then raise exception 'LEDGER_READ_CREATED_AUDIT';end if;
 -- Membership is the first actual student start, including inactive aliases.
 insert into core.people(id,org_id,display_name,state,merged_into_id) values(ids[3],c.org,'Historical alias','merged',c.source),(ids[4],c.org,'No student membership','active',null);
 insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at,ended_at) values
 (ids[5],c.org,c.center,ids[3],'student','inactive','2020-01-03T00:00:00Z','2020-02-03T00:00:00Z'),
 (ids[6],c.org,c.other_center,c.source,'student','inactive','2010-01-03T00:00:00Z','2010-02-03T00:00:00Z');
 baseline:=pg_temp.sda_must('person_get_v1',jsonb_build_object('person_id',c.source));if baseline?'membership_started_at' then raise exception 'DEFAULT_PERSON_ADDED_MEMBERSHIP';end if;
 r:=pg_temp.sda_must('person_get_v1',jsonb_build_object('person_id',c.source,'include_membership_date',true));
 if (r->>'membership_started_at')::timestamptz is distinct from '2020-01-03T00:00:00Z'::timestamptz then raise exception 'MEMBERSHIP_IGNORED_INACTIVE_ALIAS_OR_CENTER %',r;end if;
 if r-'membership_started_at' is distinct from baseline then raise exception 'MEMBERSHIP_CHANGED_PERSON_PROJECTION';end if;
 r:=pg_temp.sda_must('person_get_v1',jsonb_build_object('person_id',ids[4],'include_membership_date',true));if r->'membership_started_at' is distinct from 'null'::jsonb then raise exception 'MEMBERSHIP_DATE_FABRICATED';end if;
end$ledger_membership_acceptance$;
do $finance_directory_acceptance$
declare c pg_temp.sda_context;ids uuid[]:=pg_temp.bank(16);request jsonb;base_view jsonb;r jsonb;read jsonb;usd jsonb;try_total jsonb;cursor_value jsonb;lo timestamptz:=clock_timestamp()-interval '1 day';hi timestamptz:=clock_timestamp()+interval '1 day';alias_person uuid;receipt_id uuid;v bigint;source_name text;student_auth uuid;student_session uuid;
begin
 select * into c from pg_temp.sda_context;
 insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state) values(ids[1],c.org,c.center,c.source,500,'USD',clock_timestamp(),'open');
 perform pg_temp.sda_must('collection_record_v1',jsonb_build_object('person_id',c.source,'amount_minor','100','currency','USD','debt_ids',jsonb_build_array(ids[1]),'occurred_at',clock_timestamp(),'payment',jsonb_build_object('method','bank_transfer','reference','Synthetic USD transfer')));
 perform pg_temp.sda_must('collection_record_v1',jsonb_build_object('person_id',c.target,'amount_minor','200','currency','USD','debt_ids','[]'::jsonb,'occurred_at',clock_timestamp(),'payment',jsonb_build_object('method','cash')));
 select id into alias_person from core.people where org_id=c.org and merged_into_id=c.source;
 select operation_id into receipt_id from core.entitlement_movements where org_id=c.org and person_id=c.source and kind='grant' limit 1;
 insert into core.student_credit_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,operation_id) values(ids[2],c.org,c.center,alias_person,'surplus_add',500,'TRY',receipt_id);
 request:=jsonb_build_object('view','movements','interval',jsonb_build_object('starts_at',lo,'ends_at',hi),'page',jsonb_build_object('limit',1));
 base_view:=pg_temp.sda_must('finance_directory_get_v1',request);
 if base_view->>'next_cursor' is null then raise exception 'FINANCE_CURSOR_MISSING';end if;
 cursor_value:=base_view->'next_cursor';
 select x into usd from jsonb_array_elements(base_view->'totals') x where x->>'currency'='USD';
 select x into try_total from jsonb_array_elements(base_view->'totals') x where x->>'currency'='TRY';
 if usd->>'sales_minor'<>'0' or usd->>'collections_minor'<>'300' or usd->>'debt_minor'<>'400' or usd->>'credit_minor'<>'200'
  or try_total->>'sales_minor'<>'100000' or try_total->>'collections_minor'<>'40000' or try_total->>'debt_minor'<>'0' or try_total->>'credit_minor'<>'40500' then raise exception 'FINANCE_CURRENCY_TOTALS_WRONG %',base_view->'totals';end if;
 read:=pg_temp.sda_must('finance_directory_get_v1',request||jsonb_build_object('page',jsonb_build_object('limit',100)));
 if not exists(select 1 from jsonb_array_elements(read->'items') x where x->>'kind'='sale' and x->>'amount_minor'='100000' and x->>'source_sale_id' is not null and x->>'product_name'='Synthetic explicit discounted sale')
  or not exists(select 1 from jsonb_array_elements(read->'items') x where x->>'kind'='collection' and x->>'amount_minor'='100' and x->>'currency'='USD' and x->>'method'='bank_transfer') then raise exception 'FINANCE_SOURCE_ROWS_MISSING %',read;end if;
 read:=pg_temp.sda_must('finance_directory_get_v1',request||jsonb_build_object('query','no such synthetic person','page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>0 or read->'totals' is distinct from base_view->'totals' then raise exception 'FINANCE_SEARCH_CHANGED_TOTALS';end if;
 read:=pg_temp.sda_must('finance_directory_get_v1',request||jsonb_build_object('kind','collection','method','bank_transfer','page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>1 or read#>>'{items,0,currency}'<>'USD' or read->'totals' is distinct from base_view->'totals' then raise exception 'FINANCE_METHOD_FILTER_WRONG %',read;end if;
 r:=pg_temp.sda_call('finance_directory_get_v1',request||jsonb_build_object('kind','collection','page',jsonb_build_object('limit',1,'cursor',cursor_value)));if r#>>'{error,code}' is distinct from 'VALIDATION_FAILED' then raise exception 'FINANCE_CURSOR_FILTER_REBOUND %',r;end if;
 read:=pg_temp.sda_must('finance_directory_get_v1',request||jsonb_build_object('interval',jsonb_build_object('starts_at',lo-interval '30 days','ends_at',lo-interval '29 days'),'page',jsonb_build_object('limit',100)));
 select x into usd from jsonb_array_elements(read->'totals') x where x->>'currency'='USD';
 if jsonb_array_length(read->'items')<>0 or usd->>'collections_minor'<>'0' or usd->>'debt_minor'<>'400' or usd->>'credit_minor'<>'200' then raise exception 'FINANCE_PERIOD_MIXED_WITH_CURRENT_BALANCE %',read;end if;
 read:=pg_temp.sda_must('finance_directory_get_v1',request||jsonb_build_object('view','debts','page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>1 or read#>>'{items,0,currency}'<>'USD' or read#>>'{items,0,amount_minor}'<>'400' then raise exception 'FINANCE_CURRENT_DEBT_VIEW_WRONG %',read;end if;
 read:=pg_temp.sda_must('finance_directory_get_v1',request||jsonb_build_object('view','credits','page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>2 or not exists(select 1 from jsonb_array_elements(read->'items') x where x->>'currency'='TRY' and x->>'person_id'=c.source::text and x->>'amount_minor'='40500') then raise exception 'FINANCE_ALIAS_CREDIT_NOT_GROUPED %',read;end if;
 -- A Starter center directory must admit people through the native selected-student rule.
 insert into private.p07_subscription_scope(subscription_id,kept_center_id,starter_scope) select id,c.center,jsonb_build_object('student_person_ids',jsonb_build_array(c.target)) from core.saas_subscriptions where org_id=c.org;
 update core.saas_plan_versions set name='starter' where id=(select plan_version_id from core.saas_subscriptions where org_id=c.org);
 read:=pg_temp.sda_must('finance_directory_get_v1',request||jsonb_build_object('page',jsonb_build_object('limit',100)));
 if jsonb_array_length(read->'items')<>1 or read#>>'{items,0,person_id}'<>c.target::text or read#>>'{items,0,amount_minor}'<>'200'
  or jsonb_array_length(read->'totals')<>1 or read#>>'{totals,0,currency}'<>'USD' or read#>>'{totals,0,credit_minor}'<>'200' or read#>>'{totals,0,debt_minor}'<>'0'
 then raise exception 'FINANCE_STARTER_UNSELECTED_PERSON_LEAK %',read;end if;
 update core.saas_plan_versions set name='business' where id=(select plan_version_id from core.saas_subscriptions where org_id=c.org);
 delete from private.p07_subscription_scope where subscription_id=(select id from core.saas_subscriptions where org_id=c.org);
 -- An independent center manager cannot use this reader in another center.
 insert into auth.users(id,email,email_confirmed_at) values(ids[3],'finance-scope@example.invalid',now());
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(ids[4],ids[3],now(),now(),'aal1');
 insert into core.accounts(id,auth_user_id,state) values(ids[5],ids[3],'active');
 insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values(ids[6],c.org,ids[5],c.target,'active',now());
 insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values(ids[7],c.org,c.target,'center_manager',c.center,'active',ids[6]);
 update pg_temp.sda_context set auth=ids[3],session=ids[4],actor=c.target;
 r:=pg_temp.sda_call('finance_directory_get_v1',request||jsonb_build_object('center_id',c.other_center));if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'FINANCE_OTHER_CENTER_GRANTED %',r;end if;
 -- Collection authority alone remains insufficient for whole-center finance.
 update core.role_assignments set state='inactive',version=version+1 where id=ids[7];
 insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values(ids[8],c.org,c.target,'staff',c.center,'active',ids[6]);
 insert into core.permission_overrides(id,org_id,center_id,person_id,permission,enabled) values(ids[9],c.org,c.center,c.target,'finance.collect',true);
 r:=pg_temp.sda_call('finance_directory_get_v1',request);if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'FINANCE_COLLECTION_GRANT_LEAK %',r;end if;
 select u.id,s.id into student_auth,student_session from auth.users u join auth.sessions s on s.user_id=u.id where u.email='ledger-self@example.invalid';
 update pg_temp.sda_context set auth=student_auth,session=student_session,actor=c.source;
 r:=pg_temp.sda_call('finance_directory_get_v1',request);if r#>>'{error,code}' is distinct from 'FORBIDDEN' then raise exception 'FINANCE_SELF_STUDENT_CENTER_LEAK %',r;end if;
 update pg_temp.sda_context set auth=c.auth,session=c.session,actor=c.actor;
end$finance_directory_acceptance$;
