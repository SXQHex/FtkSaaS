-- Native reporting and account-scoped import discovery.
begin;
-- Reuse native report/export scope and worker; sales are not collections.
alter table core.report_jobs drop constraint report_jobs_report_kind_check;
alter table core.report_jobs add constraint report_jobs_report_kind_check check(report_kind in ('collections_debts','lesson_attendance','renewal','occupancy','resource_usage','earnings','crm_conversion','cross_center_usage','sales','session_metrics','collection_breakdown','instructor_balances'));
create function private.report_discovery_rows(r jsonb,p_org uuid,centers uuid[]) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare kind text:=r->>'report';lo timestamptz:=(r#>>'{filters,interval,starts_at}')::timestamptz;hi timestamptz:=(r#>>'{filters,interval,ends_at}')::timestamptz;
 grouping text:=coalesce(r#>>'{filters,breakdown}',case when r->>'report'='sales' then 'week' else 'person' end);items jsonb;
begin
 if r?'group_by' and r->>'group_by'<>'person' or coalesce(r->>'report_order','group_key_asc') not in ('group_key_asc','group_key_desc') then perform private.fail('VALIDATION_FAILED');end if;
 if kind='instructor_balances' and r#>>'{filters,state}' is not null then perform private.fail('VALIDATION_FAILED');end if;
 if kind not in ('sales','collection_breakdown') and r#>>'{filters,breakdown}' is not null then perform private.fail('VALIDATION_FAILED');end if;
 if kind='sales' then
  if grouping not in ('week','product','person') then perform private.fail('VALIDATION_FAILED');end if;
  with facts as (
   select s.center_id,s.person_id,s.product_version_id,s.currency,s.net_minor,
   case when grouping='week' then date_trunc('week',s.created_at at time zone z.timezone)::date::text
    when grouping='product' then s.product_version_id::text else private.p07_person_root(p_org,s.person_id)::text end bucket
   from core.sales s join core.centers z on z.org_id=s.org_id and z.id=s.center_id
   where s.org_id=p_org and s.center_id=any(centers) and s.created_at>=lo and s.created_at<hi
   and (r#>>'{filters,state}' is null or s.state=r#>>'{filters,state}')
   and (r#>>'{filters,currency}' is null or s.currency=r#>>'{filters,currency}')
   and (coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0 or exists(select 1 from jsonb_array_elements_text(r#>'{filters,person_ids}') p where private.p07_same_person(p_org,s.person_id,p.value::uuid)))
  ),groups as(select center_id,currency,bucket,count(*) n,sum(net_minor)::numeric amount from facts group by center_id,currency,bucket)
  select coalesce(jsonb_agg(jsonb_build_object('group_key','gross_sales:'||bucket,'center_id',g.center_id,'currency',currency,'count',n,'amount_minor',amount::text,
   'period_start',case when grouping='week' then bucket end,'product_version_id',case when grouping='product' then bucket::uuid end,
   'product_name',case when grouping='product' then (select published_name from core.product_versions where org_id=p_org and id=bucket::uuid) end,
   'person_id',case when grouping='person' then bucket::uuid end,'display_name',case when grouping='person' then (select display_name from core.people where org_id=p_org and id=bucket::uuid) end) order by bucket,g.center_id,currency),'[]') into items from groups g;
 elsif kind='session_metrics' then
  with sessions as (
   select s.*,coalesce(c.name,d.name) name,(select count(*) from core.reservations v where v.org_id=p_org and v.session_id=s.id and v.state in ('active','completed')) registered
   from core.sessions s left join core.classes c on c.org_id=s.org_id and c.id=s.class_id left join core.disciplines d on d.org_id=s.org_id and d.id=s.discipline_id
   where s.org_id=p_org and s.center_id=any(centers) and s.starts_at>=lo and s.starts_at<hi and s.state<>'cancelled'
   and (r#>>'{filters,state}' is null or s.state=r#>>'{filters,state}')
   and (coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0 or exists(select 1 from core.session_assignments a cross join jsonb_array_elements_text(r#>'{filters,person_ids}') p where a.org_id=p_org and a.session_id=s.id and a.state='active' and private.p07_same_person(p_org,a.person_id,p.value::uuid)))
  ),facts as (
   select s.id,s.center_id,s.name,'occupancy'::text metric,s.registered::bigint n,s.nominal::bigint basis from sessions s
   union all select s.id,s.center_id,s.name,'closed_attendance',case when s.attendance_state='closed' then 1 else 0 end,1 from sessions s
  )select coalesce(jsonb_agg(jsonb_build_object('group_key',metric,'center_id',center_id,'session_id',id,'session_name',name,'count',n,'basis_count',basis,
   'ratio_bps',case when basis>0 then floor(n*10000::numeric/basis)::bigint end) order by id,metric),'[]') into items from facts;
 elsif kind='collection_breakdown' then
  if grouping not in ('person','product') then perform private.fail('VALIDATION_FAILED');end if;
  with movements as(
   select c.*,private.p03_cash_net(p_org,c.id)::numeric net from core.cash_movements c
   where c.org_id=p_org and c.center_id=any(centers) and c.previous_id is null and c.kind='collection' and c.occurred_at>=lo and c.occurred_at<hi
   and (r#>>'{filters,state}' is null or c.kind=r#>>'{filters,state}') and (r#>>'{filters,currency}' is null or c.currency=r#>>'{filters,currency}')
   and (coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0 or exists(select 1 from jsonb_array_elements_text(r#>'{filters,person_ids}') p where private.p07_same_person(p_org,c.person_id,p.value::uuid)))
  ),allocations as (
   select c.id,c.center_id,c.person_id,c.currency,s.product_version_id,sum(a.amount_minor)::numeric amount
   from movements c join core.cash_movements m on m.org_id=p_org and (m.id=c.id or m.previous_id=c.id)
   join core.debt_allocations a on a.org_id=p_org and a.cash_movement_id=m.id
   join core.debts d on d.org_id=p_org and d.id=a.debt_id left join core.sales s on s.org_id=p_org and s.id=d.sale_id
   group by c.id,c.center_id,c.person_id,c.currency,s.product_version_id
  ),facts as (
   select c.id,c.center_id,c.person_id,c.currency,null::uuid product_version_id,c.net amount from movements c where grouping='person'
   union all select id,center_id,person_id,currency,product_version_id,amount from allocations where grouping='product'
   union all select c.id,c.center_id,c.person_id,c.currency,null,greatest(0,c.net-coalesce((select sum(a.amount) from allocations a where a.id=c.id),0)) from movements c where grouping='product'
  ),groups as (
   select center_id,currency,case when grouping='person' then private.p07_person_root(p_org,person_id) end person_id,product_version_id,count(distinct id) n,sum(amount) amount
   from facts where amount<>0 group by center_id,currency,case when grouping='person' then private.p07_person_root(p_org,person_id) end,product_version_id
  )select coalesce(jsonb_agg(jsonb_build_object('group_key','collections','center_id',g.center_id,'person_id',g.person_id,'display_name',p.display_name,'product_version_id',g.product_version_id,'product_name',v.published_name,'currency',g.currency,'count',g.n,'amount_minor',g.amount::text) order by g.center_id,g.person_id,g.product_version_id,g.currency),'[]') into items
  from groups g left join core.people p on p.org_id=p_org and p.id=g.person_id left join core.product_versions v on v.org_id=p_org and v.id=g.product_version_id;
 elsif kind='instructor_balances' then
  with persons as (
   select distinct e.center_id,private.p07_person_root(p_org,e.person_id) person_id from core.earnings e where e.org_id=p_org and e.center_id=any(centers)
   union select distinct p.center_id,private.p07_person_root(p_org,p.person_id) from core.instructor_payments p where p.org_id=p_org and p.center_id=any(centers)
  ),totals as (
   select p.center_id,p.person_id,x from persons p cross join lateral jsonb_array_elements(private.instructor_finance_totals(jsonb_build_object('person_id',p.person_id,'interval',r#>'{filters,interval}'),p_org,p.center_id)) x
   where coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0 or exists(select 1 from jsonb_array_elements_text(r#>'{filters,person_ids}') f where private.p07_same_person(p_org,p.person_id,f.value::uuid))
  ),facts as (
   select t.*,m.metric,m.value from totals t cross join lateral (values ('earning_accrual',x->>'earned_minor'),('instructor_paid',x->>'paid_minor'),('instructor_remaining',x->>'remaining_minor'),('instructor_overpaid',x->>'overpaid_minor')) m(metric,value)
  )select coalesce(jsonb_agg(jsonb_build_object('group_key',metric,'center_id',f.center_id,'person_id',f.person_id,'display_name',p.display_name,'currency',x->>'currency','amount_minor',value,'count',1) order by metric,f.center_id,f.person_id,x->>'currency'),'[]') into items
  from facts f join core.people p on p.org_id=p_org and p.id=f.person_id where r#>>'{filters,currency}' is null or x->>'currency'=r#>>'{filters,currency}';
  select items||coalesce(jsonb_agg(jsonb_build_object('group_key','closed_sessions','center_id',g.center_id,'person_id',g.person_id,'display_name',p.display_name,'count',g.n) order by g.center_id,g.person_id),'[]') into items
  from (select e.center_id,private.p07_person_root(p_org,e.person_id) person_id,count(distinct e.session_id) n from core.earnings e join core.sessions s on s.org_id=e.org_id and s.id=e.session_id
   where e.org_id=p_org and e.center_id=any(centers) and e.previous_id is null and s.attendance_state='closed' and e.created_at>=lo and e.created_at<hi
   and (coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0 or exists(select 1 from jsonb_array_elements_text(r#>'{filters,person_ids}') f where private.p07_same_person(p_org,e.person_id,f.value::uuid)))
   and (r#>>'{filters,currency}' is null or e.currency=r#>>'{filters,currency}') group by e.center_id,private.p07_person_root(p_org,e.person_id)) g
  join core.people p on p.org_id=p_org and p.id=g.person_id;
 else perform private.fail('VALIDATION_FAILED');end if;
 select coalesce(jsonb_agg(x order by case when coalesce(r->>'report_order','group_key_asc')='group_key_asc' then x->>'group_key' end,case when r->>'report_order'='group_key_desc' then x->>'group_key' end desc,x->>'center_id',x->>'person_id',x->>'currency',x->>'session_id',x->>'product_version_id',x->>'period_start'),'[]') into items from jsonb_array_elements(coalesce(items,'[]')) x;
 return items;
end$$;
do $patch$ declare b text;a text;begin
 b:=pg_get_functiondef('private.p06_report_scope(jsonb,uuid,uuid,uuid,boolean)'::regprocedure);
 a:='(''collections_debts'',''earnings'',''cross_center_usage'')';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Report financial classification drift';end if;
 b:=replace(b,a,'(''collections_debts'',''earnings'',''cross_center_usage'',''sales'',''collection_breakdown'',''instructor_balances'')');
 a:='(''collections_debts'',''lesson_attendance'',''renewal'',''occupancy'',''resource_usage'',''earnings'',''crm_conversion'',''cross_center_usage'')';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Report kind allowlist drift';end if;
 b:=replace(b,a,replace(a,')',',''sales'',''session_metrics'',''collection_breakdown'',''instructor_balances'')'));
 a:='if kind=''earnings'' then';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor report feature drift';end if;
 execute replace(b,a,'if kind in (''earnings'',''instructor_balances'') then');
 b:=pg_get_functiondef('private.p06_report_rows(jsonb,uuid,uuid[])'::regprocedure);a:=' select array_agg(value::uuid) into persons';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Report discovery dispatch drift';end if;
 execute replace(b,a,$a$ if report_kind in ('sales','session_metrics','collection_breakdown','instructor_balances') then return private.report_discovery_rows(r,org,centers);end if;
$a$||a);
end$patch$;
revoke all on function private.report_discovery_rows(jsonb,uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.report_discovery_rows(jsonb,uuid,uuid[]) to service_role;
do $patch$ declare b text:=pg_get_functiondef('private.work_report_csv(jsonb,jsonb,bigint)'::regprocedure);a text:='(''group_key'',''center_id'',''person_id'',''currency'',''count'',''amount_minor'',''credits'',''basis_count'',''ratio_bps'',''subscriber_number'')';begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Report selected CSV columns drift';end if;
 execute replace(b,a,replace(a,')',',''period_start'',''product_version_id'',''product_name'',''display_name'',''session_id'',''session_name'')'));
end$patch$;
do $patch$ declare b text:=pg_get_functiondef('private.p06_report(text,jsonb,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:='jid:=org;';begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Session report whole-filter totals drift';end if;
 execute replace(b,a,a||$a$
  if r->>'report'='session_metrics' then
   select coalesce(jsonb_agg(jsonb_build_object('group_key',g.metric,'currency',null,'count',g.n,'amount_minor',null,'basis_count',g.basis,
    'ratio_bps',case when g.basis>0 then floor(g.n*10000::numeric/g.basis)::bigint end) order by g.metric),'[]') into totals
   from (select x->>'group_key' metric,sum((x->>'count')::bigint)::bigint n,sum((x->>'basis_count')::bigint)::bigint basis from jsonb_array_elements(rows) x group by x->>'group_key') g;
   data:=jsonb_set(data,'{totals}',totals);
  end if;
$a$);
end$patch$;
do $patch$ declare b text:=pg_get_functiondef('private.p06_report(text,jsonb,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:='  if r->>''report''=''session_metrics'' then';begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Collection whole-filter count drift';end if;
 execute replace(b,a,$a$  if r->>'report'='collection_breakdown' then
   select coalesce(jsonb_agg(jsonb_build_object('group_key','collections','currency',g.currency,'count',g.n,'amount_minor',g.amount::text) order by g.currency),'[]') into totals
   from (select m.currency,count(*) n,sum(private.p03_cash_net(org,m.id))::numeric amount from core.cash_movements m
    where m.org_id=org and m.center_id=any(centers) and m.kind='collection' and m.previous_id is null
    and m.occurred_at>=(r#>>'{filters,interval,starts_at}')::timestamptz and m.occurred_at<(r#>>'{filters,interval,ends_at}')::timestamptz
    and (r#>>'{filters,currency}' is null or m.currency=r#>>'{filters,currency}') and (r#>>'{filters,state}' is null or m.kind=r#>>'{filters,state}')
    and (coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0 or exists(select 1 from jsonb_array_elements_text(r#>'{filters,person_ids}') p where private.p07_same_person(org,m.person_id,p.value::uuid))) group by m.currency) g;
   data:=jsonb_set(data,'{totals}',totals);
  end if;
$a$||a);
end$patch$;
do $patch$ declare b text:=pg_get_functiondef('private.p06_report(text,jsonb,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:='  if r->>''report''=''session_metrics'' then';begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor closed session totals drift';end if;
 execute replace(b,a,$a$  if r->>'report'='instructor_balances' then
   totals:=coalesce((select jsonb_agg(x) from jsonb_array_elements(totals) x where x->>'group_key'<>'closed_sessions'),'[]')||jsonb_build_array(jsonb_build_object('group_key','closed_sessions','currency',null,'amount_minor',null,'count',
    (select count(distinct e.session_id) from core.earnings e join core.sessions s on s.org_id=e.org_id and s.id=e.session_id
     where e.org_id=org and e.center_id=any(centers) and e.previous_id is null and s.attendance_state='closed'
     and e.created_at>=(r#>>'{filters,interval,starts_at}')::timestamptz and e.created_at<(r#>>'{filters,interval,ends_at}')::timestamptz
     and (r#>>'{filters,currency}' is null or e.currency=r#>>'{filters,currency}')
     and (coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0 or exists(select 1 from jsonb_array_elements_text(r#>'{filters,person_ids}') p where private.p07_same_person(org,e.person_id,p.value::uuid))))));
   data:=jsonb_set(data,'{totals}',totals);
  end if;
$a$||a);
end$patch$;

create function private.import_row_discovery(row_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('display_name',case when jsonb_typeof(r.payload->'display_name')='string' then left(r.payload->>'display_name',500) end,
 'contacts',coalesce((select jsonb_agg(jsonb_build_object('kind',x->>'kind','value',left(x->>'value',320)) order by n)
 from jsonb_array_elements(case when jsonb_typeof(r.payload->'contacts')='array' then r.payload->'contacts' else '[]'::jsonb end) with ordinality t(x,n)
 where n<=20 and x->>'kind' in ('phone','email') and jsonb_typeof(x->'value')='string'),'[]'),
 'warnings',to_jsonb(array_remove(array[
 case when exists(select 1 from core.import_rows d where d.org_id=r.org_id and d.job_id=r.job_id and d.id<>r.id and d.source_key=r.source_key) then 'duplicate_source_key' end,
 case when exists(select 1 from private.p06_sources s where s.org_id=r.org_id and s.source_namespace=r.source_namespace and s.source_key=r.source_key) then 'source_already_applied' end],null)))
 from core.import_rows r where r.id=row_id
$$;
create function private.import_rows_discovery(rows jsonb,r jsonb,job uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x||case when coalesce((r->>'include_details')::bool,false) then jsonb_build_object('student_preview',private.import_row_discovery(source.id)) else '{}'::jsonb end order by (x->>'row_number')::bigint),'[]')
 from jsonb_array_elements(rows) x join core.import_rows source on source.job_id=job and source.row_number=(x->>'row_number')::bigint
 where (r->>'state' is null or x->>'state'=r->>'state')
 and (r->>'query' is null or source.source_key ilike '%'||(r->>'query')||'%' or source.payload->>'display_name' ilike '%'||(r->>'query')||'%')
$$;
create function private.import_discovery_job_allowed(r jsonb,p_org uuid,p_center uuid,p_actor uuid,p_account uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform private.p06_access('job_status_get_v1',r,p_org,p_center,p_actor,p_account);return true;
exception when sqlstate 'P0001' then
 if sqlerrm in ('FORBIDDEN','NOT_FOUND','PLAN_FEATURE_UNAVAILABLE','BILLING_OPERATION_RESTRICTED','SERVICE_UNAVAILABLE') then return false;end if;raise;
end$$;
create function private.import_directory(r jsonb,p_org uuid,p_center uuid,p_actor uuid,p_account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg private.p06_configuration;items jsonb;data jsonb;
begin
 perform private.p06_import_access(p_org,p_center,p_actor,false);
 select * into cfg from private.p06_configuration where org_id=p_org;
 select coalesce(jsonb_agg(jsonb_build_object('job_id',j.id,'created_at',j.created_at,'state',j.state,'phase',c.phase,'progress_count',c.progress_count,'total_count',c.total_count,
 'preview_id',j.preview_id,'safe_error_code',c.safe_error_code,'kind',coalesce(j.mapping->>'kind','students')) order by j.created_at,j.id),'[]') into items
 from core.import_jobs j join private.p06_jobs c on c.job_id=j.id and c.org_id=j.org_id
 where j.org_id=p_org and j.center_id=p_center and j.requester_account_id=p_account and c.account_id=p_account
 and (r->>'state' is null or j.state=r->>'state')
 and private.import_discovery_job_allowed(jsonb_build_object('job_id',j.id),p_org,p_center,p_actor,p_account);
 data:=private.p06_page(items,r->'page',encode(extensions.digest(jsonb_build_object('account',p_account,'actor',p_actor,'request',r-'request_id'-'page')::text,'sha256'),'hex'),statement_timestamp());
 return data||jsonb_build_object('limits',case when cfg.org_id is not null then jsonb_build_object('max_bytes',cfg.max_import_bytes,'max_rows',cfg.max_import_rows) end);
end$$;
do $patch$ declare b text;a text;begin
 b:=pg_get_functiondef('private.p06_import(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='data:=private.p06_page(rows,r->''page''';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Import row discovery drift';end if;
 execute replace(b,a,'rows:=private.import_rows_discovery(rows,r,j.id);'||a);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a:=' elsif perm_code=''invite.student'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Import directory permission drift';end if;
 b:=replace(b,a,$a$ elsif p_operation='import_directory_get_v1' then perform private.p06_import_access(org,center,person,false);
$a$||a);
 a:=' -- DOMAIN_CASES';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Import directory dispatch drift';end if;
 execute replace(b,a,$a$ when 'import_directory_get_v1' then out:=private.import_directory(r,org,center,person,actor.id);
$a$||a);
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('import_directory_get_v1','import.execute','read',array['F31']::text[]);
create function api_v1.import_directory_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('import_directory_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.import_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb),private.import_row_discovery(uuid),private.import_rows_discovery(jsonb,jsonb,uuid),private.import_discovery_job_allowed(jsonb,uuid,uuid,uuid,uuid),private.import_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function api_v1.import_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb),private.import_row_discovery(uuid),private.import_rows_discovery(jsonb,jsonb,uuid),private.import_discovery_job_allowed(jsonb,uuid,uuid,uuid,uuid),private.import_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;

commit;
