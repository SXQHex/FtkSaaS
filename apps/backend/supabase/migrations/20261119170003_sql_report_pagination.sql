-- Share typed report rows between page reads and CSV exports.
begin;

create type private.report_page_row as (
 metric text, center_id uuid, person_id uuid, currency text, n bigint, amount_minor text,
 credits bigint, basis_count bigint, ratio_bps bigint, subscriber_number text,
 period_start text, product_version_id uuid, product_name text, display_name text,
 session_id uuid, session_name text
);

create function private.report_discovery_facts(r jsonb,p_org uuid,centers uuid[]) returns setof private.report_page_row
language plpgsql stable security invoker set search_path='' as $$
declare kind text:=r->>'report';lo timestamptz:=(r#>>'{filters,interval,starts_at}')::timestamptz;hi timestamptz:=(r#>>'{filters,interval,ends_at}')::timestamptz;
 grouping text:=coalesce(r#>>'{filters,breakdown}',case when r->>'report'='sales' then 'week' else 'person' end);
begin
 if r?'group_by' and r->>'group_by'<>'person' or coalesce(r->>'report_order','group_key_asc') not in ('group_key_asc','group_key_desc') then perform private.fail('VALIDATION_FAILED');end if;
 if kind='instructor_balances' and r#>>'{filters,state}' is not null then perform private.fail('VALIDATION_FAILED');end if;
 if kind not in ('sales','collection_breakdown') and r#>>'{filters,breakdown}' is not null then perform private.fail('VALIDATION_FAILED');end if;
 if kind='sales' then
  if grouping not in ('week','product','person') then perform private.fail('VALIDATION_FAILED');end if;
  return query
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
  select (row('gross_sales:'||bucket,g.center_id,case when grouping='person' then bucket::uuid end,currency,n,amount::text,
   null,null,null,null,case when grouping='week' then bucket end,case when grouping='product' then bucket::uuid end,
   case when grouping='product' then (select published_name from core.product_versions where org_id=p_org and id=bucket::uuid) end,
   case when grouping='person' then (select display_name from core.people where org_id=p_org and id=bucket::uuid) end,
   null,null)::private.report_page_row).* from groups g;
 elsif kind='session_metrics' then
  return query
  with sessions as (
   select s.*,coalesce(c.name,d.name) name,(select count(*) from core.reservations v where v.org_id=p_org and v.session_id=s.id and v.state in ('active','completed')) registered
   from core.sessions s left join core.classes c on c.org_id=s.org_id and c.id=s.class_id left join core.disciplines d on d.org_id=s.org_id and d.id=s.discipline_id
   where s.org_id=p_org and s.center_id=any(centers) and s.starts_at>=lo and s.starts_at<hi and s.state<>'cancelled'
   and (r#>>'{filters,state}' is null or s.state=r#>>'{filters,state}')
   and (coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0 or exists(select 1 from core.session_assignments a cross join jsonb_array_elements_text(r#>'{filters,person_ids}') p where a.org_id=p_org and a.session_id=s.id and a.state='active' and private.p07_same_person(p_org,a.person_id,p.value::uuid)))
  ),facts as (
   select s.id,s.center_id,s.name,'occupancy'::text metric,s.registered::bigint n,s.nominal::bigint basis from sessions s
   union all select s.id,s.center_id,s.name,'closed_attendance',case when s.attendance_state='closed' then 1 else 0 end,1 from sessions s
  )
  select (row(metric,center_id,null,null,n,null,null,basis,
   case when basis>0 then floor(n*10000::numeric/basis)::bigint end,
   null,null,null,null,null,id,name)::private.report_page_row).* from facts;
 elsif kind='collection_breakdown' then
  if grouping not in ('person','product') then perform private.fail('VALIDATION_FAILED');end if;
  return query
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
  )
  select (row('collections',g.center_id,g.person_id,g.currency,g.n,g.amount::text,
   null,null,null,null,null,g.product_version_id,v.published_name,p.display_name,null,null)::private.report_page_row).*
  from groups g left join core.people p on p.org_id=p_org and p.id=g.person_id
  left join core.product_versions v on v.org_id=p_org and v.id=g.product_version_id;
 elsif kind='instructor_balances' then
  return query
  with persons as (
   select distinct e.center_id,private.p07_person_root(p_org,e.person_id) person_id from core.earnings e where e.org_id=p_org and e.center_id=any(centers)
   union select distinct p.center_id,private.p07_person_root(p_org,p.person_id) from core.instructor_payments p where p.org_id=p_org and p.center_id=any(centers)
  ),totals as (
   select p.center_id,p.person_id,x from persons p cross join lateral jsonb_array_elements(private.instructor_finance_totals(jsonb_build_object('person_id',p.person_id,'interval',r#>'{filters,interval}'),p_org,p.center_id)) x
   where coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0 or exists(select 1 from jsonb_array_elements_text(r#>'{filters,person_ids}') f where private.p07_same_person(p_org,p.person_id,f.value::uuid))
  ),facts as (
   select t.*,m.metric,m.value from totals t cross join lateral (values ('earning_accrual',x->>'earned_minor'),('instructor_paid',x->>'paid_minor'),('instructor_remaining',x->>'remaining_minor'),('instructor_overpaid',x->>'overpaid_minor')) m(metric,value)
  )
  select (row(metric,f.center_id,f.person_id,x->>'currency',1,value,null,null,null,null,null,null,null,p.display_name,null,null)::private.report_page_row).*
  from facts f join core.people p on p.org_id=p_org and p.id=f.person_id
  where r#>>'{filters,currency}' is null or x->>'currency'=r#>>'{filters,currency}';
  return query
  select (row('closed_sessions',g.center_id,g.person_id,null,g.n,null,
   null,null,null,null,null,null,null,p.display_name,null,null)::private.report_page_row).*
  from (select e.center_id,private.p07_person_root(p_org,e.person_id) person_id,count(distinct e.session_id) n from core.earnings e join core.sessions s on s.org_id=e.org_id and s.id=e.session_id
   where e.org_id=p_org and e.center_id=any(centers) and e.previous_id is null and s.attendance_state='closed' and e.created_at>=lo and e.created_at<hi
   and (coalesce(jsonb_array_length(r#>'{filters,person_ids}'),0)=0 or exists(select 1 from jsonb_array_elements_text(r#>'{filters,person_ids}') f where private.p07_same_person(p_org,e.person_id,f.value::uuid)))
   and (r#>>'{filters,currency}' is null or e.currency=r#>>'{filters,currency}') group by e.center_id,private.p07_person_root(p_org,e.person_id)) g
  join core.people p on p.org_id=p_org and p.id=g.person_id;
 else perform private.fail('VALIDATION_FAILED');end if;
end$$;

create function private.report_page_facts(r jsonb,org uuid,centers uuid[]) returns setof private.report_page_row
language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare report_kind text:=r->>'report';s timestamptz:=(r#>>'{filters,interval,starts_at}')::timestamptz;e timestamptz:=(r#>>'{filters,interval,ends_at}')::timestamptz;persons uuid[];grouping text:=coalesce(r->>'group_by','person');
 ordering text:=coalesce(r->>'report_order','group_key_asc');
begin
 if report_kind in ('sales','session_metrics','collection_breakdown','instructor_balances') then
  return query select * from private.report_discovery_facts(r,org,centers);
  return;
 end if;
 if grouping not in ('person','center','total') or ordering not in ('group_key_asc','group_key_desc')
  or (grouping<>'person' and report_kind not in ('collections_debts','lesson_attendance')) then
  perform private.fail('VALIDATION_FAILED');
 end if;
 select array_agg(value::uuid) into persons from jsonb_array_elements_text(coalesce(r#>'{filters,person_ids}','[]'));
 return query
 with facts as(
 select 'collections'::text metric,c.center_id,c.person_id,c.currency,1::bigint count_n,greatest(0,private.p03_cash_net(org,c.id))::numeric amount,null::bigint credits,null::numeric basis,c.kind source_state from core.cash_movements c where report_kind='collections_debts' and c.org_id=org and c.previous_id is null and c.kind='collection' and c.occurred_at>=s and c.occurred_at<e
 union all select 'refunds',c.center_id,c.person_id,c.currency,1,c.amount_minor,null,null,c.kind from core.cash_movements c where report_kind='collections_debts' and c.org_id=org and c.kind='refund' and c.occurred_at>=s and c.occurred_at<e
 union all select 'outstanding_debt',d.center_id,d.person_id,d.currency,1,private.debt_remaining(org,d.id),null,null,d.state from core.debts d where report_kind='collections_debts' and d.org_id=org and d.due_at>=s and d.due_at<e
 union all select 'attendance:'||coalesce(a.result,'unrecorded'),v.center_id,v.person_id,null,1,null,null,null,coalesce(a.result,'unrecorded') from core.reservations v join core.sessions ses on ses.org_id=v.org_id and ses.id=v.session_id left join core.attendance_entries a on a.org_id=v.org_id and a.reservation_id=v.id where report_kind='lesson_attendance' and v.org_id=org and v.state in ('active','completed') and ses.starts_at>=s and ses.starts_at<e
 union all select case when exists(select 1 from core.sales n where n.org_id=org and n.previous_sale_id=v.id and n.state='active') then 'renewed' else 'expiring_unrenewed' end,v.center_id,v.person_id,null,1,null,greatest(0,private.credit_available(org,v.id)),null,v.state from core.sales v where report_kind='renewal' and v.org_id=org and v.state in ('active','ended') and v.valid_until>=s and v.valid_until<e
 union all select 'occupancy',ses.center_id,null,null,(select count(*) from core.reservations v where v.org_id=org and v.session_id=ses.id and v.state in ('active','completed')),null,null,ses.nominal,ses.state from core.sessions ses where report_kind='occupancy' and ses.org_id=org and ses.state in ('planned','occurred') and ses.starts_at>=s and ses.starts_at<e
 union all select 'resource:'||b.resource_kind||':'||b.resource_id::text,b.center_id,case when b.resource_kind='person' then b.resource_id end,null,extract(epoch from upper(span)-lower(span))::bigint,null,null,null,'active' from (select b.center_id,b.resource_kind,b.resource_id,range_agg(tstzrange(greatest(s,b.starts_at),least(e,b.ends_at),'[)')) spans from core.resource_bookings b where report_kind='resource_usage' and b.org_id=org and b.state='active' and b.starts_at<e and b.ends_at>s group by b.center_id,b.resource_kind,b.resource_id) b cross join lateral unnest(b.spans) span
 union all select 'resource:'||a.resource_kind||':'||a.resource_id::text,a.center_id,case when a.resource_kind='person' then a.resource_id end,null,0,null,null,null,'active' from (select distinct resource_kind,resource_id,center_id from (select * from core.availability_rules where state='active') where report_kind='resource_usage' and org_id=org) a
 union all select 'earning_accrual',a.center_id,a.person_id,a.currency,1,greatest(0,private.p03_earning_net(org,a.id)),null,null,a.direction from core.earnings a where report_kind='earnings' and a.org_id=org and a.previous_id is null and a.created_at>=s and a.created_at<e
 union all select 'crm_conversion',l.center_id,null,null,case when l.state='converted' then 1 else 0 end,null,null,1,l.state from core.leads l where report_kind='crm_conversion' and l.org_id=org and l.created_at>=s and l.created_at<e
 union all select 'outgoing_to:'||m.creditor_center_id::text,m.debtor_center_id,sa.person_id,m.currency,1,m.open_minor,null,null,m.kind from private.settlement_movements m left join core.sales sa on sa.org_id=m.org_id and sa.id=m.source_sale_id where report_kind='cross_center_usage' and m.org_id=org and m.kind='accrual' and m.created_at>=s and m.created_at<e union all select 'incoming_from:'||m.debtor_center_id::text,m.creditor_center_id,sa.person_id,m.currency,1,m.open_minor,null,null,m.kind from private.settlement_movements m left join core.sales sa on sa.org_id=m.org_id and sa.id=m.source_sale_id where report_kind='cross_center_usage' and m.org_id=org and m.kind='accrual' and m.created_at>=s and m.created_at<e
 ), grouped as(
 select metric,center_id,person_id,currency,sum(count_n)::bigint n,sum(amount) amount,sum(credits)::bigint credits,
 case when report_kind='resource_usage' then private.p06_available_seconds(org,center_id,split_part(metric,':',2),split_part(metric,':',3)::uuid,s,e) else sum(basis) end basis
 from facts where center_id=any(centers) and (r#>>'{filters,state}' is null or source_state=r#>>'{filters,state}') and (persons is null or person_id=any(persons)) and (r#>>'{filters,currency}' is null or currency=r#>>'{filters,currency}') group by metric,center_id,person_id,currency),
 effective as (
  select metric,center_id,person_id,currency,n,amount,credits,basis
  from grouped where grouping='person'
  union all
  select metric,case when grouping='center' then center_id end,null,currency,sum(n)::bigint,sum(amount),sum(credits)::bigint,null
  from grouped where grouping<>'person' group by metric,case when grouping='center' then center_id end,currency
 )
 select (row(metric,center_id,person_id,currency,n,amount::text,credits,basis::bigint,
  case when basis>0 then floor(n*10000/basis)::bigint end,
  private.subscriber_number(org,person_id),null,null,null,null,null,null)::private.report_page_row).*
 from effective;
end$$;

create function private.report_row_view(kind text,f private.report_page_row) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select case kind
 when 'sales' then jsonb_build_object('group_key',f.metric,'center_id',f.center_id,'currency',f.currency,
  'count',f.n,'amount_minor',f.amount_minor,'period_start',f.period_start,'product_version_id',f.product_version_id,
  'product_name',f.product_name,'person_id',f.person_id,'display_name',f.display_name)
 when 'session_metrics' then jsonb_build_object('group_key',f.metric,'center_id',f.center_id,
  'session_id',f.session_id,'session_name',f.session_name,'count',f.n,'basis_count',f.basis_count,'ratio_bps',f.ratio_bps)
 when 'collection_breakdown' then jsonb_build_object('group_key',f.metric,'center_id',f.center_id,
  'person_id',f.person_id,'display_name',f.display_name,'product_version_id',f.product_version_id,
  'product_name',f.product_name,'currency',f.currency,'count',f.n,'amount_minor',f.amount_minor)
 when 'instructor_balances' then jsonb_build_object('group_key',f.metric,'center_id',f.center_id,
  'person_id',f.person_id,'display_name',f.display_name,'count',f.n)
  || case when f.metric='closed_sessions' then '{}'::jsonb
          else jsonb_build_object('currency',f.currency,'amount_minor',f.amount_minor) end
 else jsonb_strip_nulls(jsonb_build_object('group_key',f.metric,'center_id',f.center_id,
  'person_id',f.person_id,'currency',f.currency,'count',f.n,'amount_minor',f.amount_minor,'credits',f.credits,
  'basis_count',f.basis_count,'ratio_bps',f.ratio_bps,'subscriber_number',f.subscriber_number))
 end
$$;

-- Ordering uses the same textual sort keys as the legacy JSON, including its NULL ordering.
create function private.report_rows_ordered(r jsonb,org uuid,centers uuid[])
returns table(fact private.report_page_row,row_no bigint)
language sql stable security invoker set search_path='' as $$
 select f,row_number() over (
  order by case when coalesce(r->>'report_order','group_key_asc')='group_key_asc' then f.metric end,
   case when r->>'report_order'='group_key_desc' then f.metric end desc,
   f.center_id::text,f.person_id::text,f.currency,f.session_id::text,f.product_version_id::text,f.period_start
 )
 from private.report_page_facts(r,org,centers) f
$$;

create or replace function private.p06_report_rows(r jsonb,org uuid,centers uuid[]) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(private.report_row_view(r->>'report',x.fact) order by x.row_no),'[]')
 from private.report_rows_ordered(r,org,centers) x
$$;

drop function private.report_discovery_rows(jsonb,uuid,uuid[]);

create function private.report_read_page(r jsonb,org uuid,centers uuid[],account uuid,as_of timestamptz) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 kind text:=r->>'report';
 bounds private.offset_page_cursor:=private.offset_page_bounds(r->'page',
  md5(jsonb_build_object('actor',account,'request',r-'page'-'request_id')::text));
 result jsonb;
begin
 with ordered as materialized (
  select * from private.report_rows_ordered(r,org,centers)
 ), size as (select count(*) n from ordered),
 selected as (
  select * from ordered order by row_no limit bounds.page_limit offset bounds.page_offset
 ), totals as (
  select (x.fact).metric metric,(x.fact).currency currency,sum((x.fact).n)::bigint n,
   sum((x.fact).amount_minor::numeric)::text amount,
   case when kind='session_metrics' then sum((x.fact).basis_count)::bigint end basis
  from ordered x group by (x.fact).metric,(x.fact).currency
 )
 select jsonb_build_object(
  'rows',private.work_report_columns_page(private.offset_page_result(
   (select coalesce(jsonb_agg(private.report_row_view(kind,x.fact) order by x.row_no),'[]') from selected x),
   bounds,size.n,
   case when (bounds.has_cursor and not bounds.legacy) or bounds.page_offset::bigint+bounds.page_limit<size.n then
    (select 'v2:'||encode(sha256(coalesce(string_agg(sha256(pg_catalog.record_send(x.fact)),
     ''::bytea order by x.row_no),''::bytea)),'hex') from ordered x)
   end,
   case when bounds.legacy and bounds.page_offset<=size.n then
    (select md5(coalesce(jsonb_agg(private.report_row_view(kind,x.fact) order by x.row_no),'[]')::text) from ordered x)
   end,as_of),r->'columns'),
  'totals',(select coalesce(jsonb_agg(
   jsonb_build_object('group_key',t.metric,'currency',t.currency,'count',t.n,'amount_minor',t.amount)
   || case when kind='session_metrics' then jsonb_build_object('basis_count',t.basis,
         'ratio_bps',case when t.basis>0 then floor(t.n*10000::numeric/t.basis)::bigint end)
       else '{}'::jsonb end
   order by t.metric,t.currency),'[]') from totals t)
 ) into result from size;
 return result;
end$$;

do $patch$
declare
 body text:=pg_get_functiondef('private.p06_report(text,jsonb,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 changes text[][]:=array[
  array['source private.p06_jobs;rows jsonb;','source private.p06_jobs;page_result jsonb;'],
  array[$old$  rows:=private.p06_report_rows(r,org,centers);
  select coalesce(jsonb_agg(jsonb_build_object('group_key',metric,'currency',currency,'count',n,'amount_minor',amount) order by metric,currency),'[]'::jsonb) into totals from (select x->>'group_key' metric,x->>'currency' currency,sum((x->>'count')::bigint)::bigint n,sum((x->>'amount_minor')::numeric)::text amount from jsonb_array_elements(rows) x group by x->>'group_key',x->>'currency') a;
  data:=jsonb_build_object('columns',coalesce(r->'columns','["group_key","center_id","person_id","currency","count","amount_minor","credits","basis_count","ratio_bps","subscriber_number"]'::jsonb),'report_kind',r->'report','as_of',asof,'filters',r->'filters','rows',private.work_report_columns_page(private.p06_page(rows,r->'page',md5(jsonb_build_object('actor',account,'request',r-'page'-'request_id')::text),asof),r->'columns'),'totals',totals);jid:=org;$old$,
        $new$  page_result:=private.report_read_page(r,org,centers,account,asof);
  totals:=page_result->'totals';
  data:=jsonb_build_object('columns',coalesce(r->'columns','["group_key","center_id","person_id","currency","count","amount_minor","credits","basis_count","ratio_bps","subscriber_number"]'::jsonb),
   'report_kind',r->'report','as_of',asof,'filters',r->'filters')||page_result;
  jid:=org;$new$],
  array[$old$  if r->>'report'='session_metrics' then
   select coalesce(jsonb_agg(jsonb_build_object('group_key',g.metric,'currency',null,'count',g.n,'amount_minor',null,'basis_count',g.basis,
    'ratio_bps',case when g.basis>0 then floor(g.n*10000::numeric/g.basis)::bigint end) order by g.metric),'[]') into totals
   from (select x->>'group_key' metric,sum((x->>'count')::bigint)::bigint n,sum((x->>'basis_count')::bigint)::bigint basis from jsonb_array_elements(rows) x group by x->>'group_key') g;
   data:=jsonb_set(data,'{totals}',totals);
  end if;$old$,'']
 ];
 change text[];
begin
 foreach change slice 1 in array changes loop
  if cardinality(string_to_array(body,change[1]))<>2 then raise exception 'Report read pagination anchor changed';end if;
  body:=replace(body,change[1],change[2]);
 end loop;
 execute body;
end$patch$;

revoke all on function private.report_discovery_facts(jsonb,uuid,uuid[]),
 private.report_page_facts(jsonb,uuid,uuid[]),private.report_row_view(text,private.report_page_row),
 private.report_rows_ordered(jsonb,uuid,uuid[]),private.report_read_page(jsonb,uuid,uuid[],uuid,timestamptz)
 from public,anon,authenticated;
grant execute on function private.report_discovery_facts(jsonb,uuid,uuid[]),
 private.report_page_facts(jsonb,uuid,uuid[]),private.report_row_view(text,private.report_page_row),
 private.report_rows_ordered(jsonb,uuid,uuid[]),private.report_read_page(jsonb,uuid,uuid[],uuid,timestamptz)
 to service_role;

commit;
