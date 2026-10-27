begin;
-- Page cursors bind actor/request, order and the complete projection. A changed
-- result invalidates the cursor rather than silently omitting or duplicating rows.
create function private.p06_page(items jsonb,page jsonb,scope text,asof timestamptz) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare lim int:=coalesce((page->>'limit')::int,50);off int:=0;c jsonb;fingerprint text:=md5(items::text);next_token text;result jsonb;
begin
 if lim<1 or lim>200 or coalesce(page->>'sort','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 if page->>'cursor' is not null then
  begin c:=convert_from(decode(page->>'cursor','hex'),'UTF8')::jsonb;off:=(c->>'offset')::int;
   if c->>'scope' is distinct from scope or off is null or off<0 or off>jsonb_array_length(items) then perform private.fail('VALIDATION_FAILED');end if;
   if c->>'fingerprint' is distinct from fingerprint then perform private.fail('VERSION_CONFLICT');end if;
  exception when SQLSTATE 'P0001' then raise;when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(x order by n),'[]'::jsonb) into result from jsonb_array_elements(items) with ordinality a(x,n) where n>off and n<=off+lim;
 if off+lim<jsonb_array_length(items) then next_token:=encode(convert_to(jsonb_build_object('offset',off+lim,'scope',scope,'fingerprint',fingerprint)::text,'UTF8'),'hex');end if;
 return jsonb_build_object('items',result,'next_cursor',next_token,'as_of',asof);
end$$;
create function private.p06_available_seconds(org uuid,center uuid,kind text,resource uuid,s timestamptz,e timestamptz) returns numeric language sql stable security invoker set search_path='' as $$
 with tz as(select timezone from core.centers where org_id=org and id=center),
 days as(select d::date d,tz.timezone from tz cross join lateral generate_series((s at time zone tz.timezone)::date::timestamp,(e at time zone tz.timezone)::date::timestamp,interval '1 day') d),
 rules as(select tstzrange(greatest(s,(d.d+r.local_start::time) at time zone d.timezone),least(e,(d.d+r.local_end::time) at time zone d.timezone),'[)') span from days d join core.availability_rules r on r.org_id=org and r.center_id=center and r.resource_kind=kind and r.resource_id=resource and d.d>=r.valid_from and (r.valid_until is null or d.d<r.valid_until) and extract(isodow from d.d)::bigint=any(r.weekdays) where (d.d+r.local_start::time) at time zone d.timezone<e and (d.d+r.local_end::time) at time zone d.timezone>s),
 available as(select coalesce(range_agg(span),'{}'::tstzmultirange) spans from rules),
 exceptions as(select coalesce(range_agg(tstzrange(greatest(s,x.starts_at),least(e,x.ends_at),'[)')),'{}'::tstzmultirange) spans from core.availability_exceptions x where x.org_id=org and x.center_id=center and x.resource_kind=kind and x.resource_id=resource and x.starts_at<e and x.ends_at>s)
 select coalesce(sum(extract(epoch from upper(v)-lower(v))),0) from available a cross join exceptions x cross join lateral unnest(a.spans-x.spans) v
$$;
create function private.p06_report_rows(r jsonb,org uuid,centers uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare report_kind text:=r->>'report';s timestamptz:=(r#>>'{filters,interval,starts_at}')::timestamptz;e timestamptz:=(r#>>'{filters,interval,ends_at}')::timestamptz;persons uuid[];rows jsonb;
begin
 select array_agg(value::uuid) into persons from jsonb_array_elements_text(coalesce(r#>'{filters,person_ids}','[]'));
 with facts as(
 select 'collections'::text metric,c.center_id,c.person_id,c.currency,1::bigint count_n,greatest(0,private.p03_cash_net(org,c.id))::numeric amount,null::bigint credits,null::numeric basis,c.kind source_state from core.cash_movements c where report_kind='collections_debts' and c.org_id=org and c.previous_id is null and c.kind='collection' and c.occurred_at>=s and c.occurred_at<e
 union all select 'refunds',c.center_id,c.person_id,c.currency,1,c.amount_minor,null,null,c.kind from core.cash_movements c where report_kind='collections_debts' and c.org_id=org and c.kind='refund' and c.occurred_at>=s and c.occurred_at<e
 union all select 'outstanding_debt',d.center_id,d.person_id,d.currency,1,private.debt_remaining(org,d.id),null,null,d.state from core.debts d where report_kind='collections_debts' and d.org_id=org and d.due_at>=s and d.due_at<e
 union all select 'attendance:'||coalesce(a.result,'unrecorded'),v.center_id,v.person_id,null,1,null,null,null,coalesce(a.result,'unrecorded') from core.reservations v join core.sessions ses on ses.org_id=v.org_id and ses.id=v.session_id left join core.attendance_entries a on a.org_id=v.org_id and a.reservation_id=v.id where report_kind='lesson_attendance' and v.org_id=org and v.state in ('active','completed') and ses.starts_at>=s and ses.starts_at<e
 union all select case when exists(select 1 from core.sales n where n.org_id=org and n.previous_sale_id=v.id and n.state='active') then 'renewed' else 'expiring_unrenewed' end,v.center_id,v.person_id,null,1,null,greatest(0,private.credit_available(org,v.id)),null,v.state from core.sales v where report_kind='renewal' and v.org_id=org and v.state in ('active','ended') and v.valid_until>=s and v.valid_until<e
 union all select 'occupancy',ses.center_id,null,null,(select count(*) from core.reservations v where v.org_id=org and v.session_id=ses.id and v.state in ('active','completed')),null,null,ses.nominal,ses.state from core.sessions ses where report_kind='occupancy' and ses.org_id=org and ses.state in ('planned','occurred') and ses.starts_at>=s and ses.starts_at<e
 union all select 'resource:'||b.resource_kind||':'||b.resource_id::text,b.center_id,case when b.resource_kind='person' then b.resource_id end,null,extract(epoch from upper(span)-lower(span))::bigint,null,null,null,'active' from (select b.center_id,b.resource_kind,b.resource_id,range_agg(tstzrange(greatest(s,b.starts_at),least(e,b.ends_at),'[)')) spans from core.resource_bookings b where report_kind='resource_usage' and b.org_id=org and b.state='active' and b.starts_at<e and b.ends_at>s group by b.center_id,b.resource_kind,b.resource_id) b cross join lateral unnest(b.spans) span
 union all select 'resource:'||a.resource_kind||':'||a.resource_id::text,a.center_id,case when a.resource_kind='person' then a.resource_id end,null,0,null,null,null,'active' from (select distinct resource_kind,resource_id,center_id from core.availability_rules where report_kind='resource_usage' and org_id=org) a
 union all select 'earning_accrual',a.center_id,a.person_id,a.currency,1,greatest(0,private.p03_earning_net(org,a.id)),null,null,a.direction from core.earnings a where report_kind='earnings' and a.org_id=org and a.previous_id is null and a.created_at>=s and a.created_at<e
 union all select 'crm_conversion',l.center_id,null,null,case when l.state='converted' then 1 else 0 end,null,null,1,l.state from core.leads l where report_kind='crm_conversion' and l.org_id=org and l.created_at>=s and l.created_at<e
 union all select 'outgoing_to:'||m.creditor_center_id::text,m.debtor_center_id,sa.person_id,m.currency,1,m.open_minor,null,null,m.kind from private.settlement_movements m left join core.sales sa on sa.org_id=m.org_id and sa.id=m.source_sale_id where report_kind='cross_center_usage' and m.org_id=org and m.kind='accrual' and m.created_at>=s and m.created_at<e union all select 'incoming_from:'||m.debtor_center_id::text,m.creditor_center_id,sa.person_id,m.currency,1,m.open_minor,null,null,m.kind from private.settlement_movements m left join core.sales sa on sa.org_id=m.org_id and sa.id=m.source_sale_id where report_kind='cross_center_usage' and m.org_id=org and m.kind='accrual' and m.created_at>=s and m.created_at<e
 ), grouped as(
 select metric,center_id,person_id,currency,sum(count_n)::bigint n,sum(amount) amount,sum(credits)::bigint credits,
 case when report_kind='resource_usage' then private.p06_available_seconds(org,center_id,split_part(metric,':',2),split_part(metric,':',3)::uuid,s,e) else sum(basis) end basis
 from facts where center_id=any(centers) and (r#>>'{filters,state}' is null or source_state=r#>>'{filters,state}') and (persons is null or person_id=any(persons)) and (r#>>'{filters,currency}' is null or currency=r#>>'{filters,currency}') group by metric,center_id,person_id,currency)
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('group_key',metric,'center_id',center_id,'person_id',person_id,'currency',currency,'count',n,'amount_minor',amount::text,'credits',credits,'basis_count',basis::bigint,'ratio_bps',case when basis>0 then floor(n*10000/basis)::bigint end)) order by metric,center_id,person_id,currency),'[]'::jsonb) into rows from grouped;
 return rows;
end$$;
create function private.p06_report(op text,r jsonb,org uuid,center uuid,actor uuid,account uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare centers uuid[];rows jsonb;totals jsonb;data jsonb;j core.report_jobs;f core.files;cfg private.p06_configuration;jid uuid:=private.new_id(ids,2);asof timestamptz:=clock_timestamp();
begin
 if op in ('report_get_v1','report_export_start_v1') then centers:=private.p06_report_scope(r,org,center,actor,op='report_export_start_v1');end if;
 if op='report_get_v1' then
  rows:=private.p06_report_rows(r,org,centers);
  select coalesce(jsonb_agg(jsonb_build_object('group_key',metric,'currency',currency,'count',n,'amount_minor',amount) order by metric,currency),'[]'::jsonb) into totals from (select x->>'group_key' metric,x->>'currency' currency,sum((x->>'count')::bigint)::bigint n,sum((x->>'amount_minor')::numeric)::text amount from jsonb_array_elements(rows) x group by x->>'group_key',x->>'currency') a;
  data:=jsonb_build_object('report_kind',r->'report','as_of',asof,'filters',r->'filters','rows',private.p06_page(rows,r->'page',md5(jsonb_build_object('actor',account,'request',r-'page'-'request_id')::text),asof),'totals',totals);jid:=org;
 elsif op='report_export_start_v1' then
  select * into cfg from private.p06_configuration where org_id=org;if cfg.org_id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  insert into core.report_jobs(id,org_id,requester_account_id,report_kind,filters,state) values(jid,org,account,r->>'report',r->'filters','pending');
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,org,'p06.report','p06.report:'||jid::text,'pending',0,clock_timestamp());
  insert into private.p06_jobs(job_id,org_id,account_id,person_id,center_id,operation,request,phase) values(jid,org,account,actor,center,'report_build_v1',r,'report');data:=jsonb_build_object('job_id',jid,'state','pending');
 elsif op='report_file_get_v1' then
  select * into j from core.report_jobs where org_id=org and id=(r->>'job_id')::uuid and requester_account_id=account;
  if j.id is null then perform private.fail('NOT_FOUND');end if;
  select * into f from core.files where org_id=org and id=j.file_id and purpose='export';
  if j.state<>'succeeded' or f.id is null then perform private.fail('OPERATION_IN_PROGRESS');end if;
  if j.expires_at<=clock_timestamp() or f.expires_at<=clock_timestamp() then perform private.fail('OPERATION_RESULT_EXPIRED');end if;
  if aux->>'phase'='p06_download' then select jsonb_build_object('_internal_download',jsonb_build_object('body',encode(body,'base64'),'mime','text/csv','filename','report-'||j.id::text||'.csv')) into data from private.p06_export_files where file_id=f.id and job_id=j.id;return data;end if;
  data:=jsonb_build_object('file_id',f.id,'download_path','/functions/v1/backend-v1/report_file_get_v1?download=csv','expires_at',f.expires_at);jid:=j.id;
 else perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('data',data,'primary_id',jid,'subject',case when op='report_get_v1' then 'organizations' else 'report_jobs' end);
end$$;
-- RFC4180 quoting plus spreadsheet formula neutralization. Never concatenate raw fields.
create function private.p06_csv_cell(value text) returns text language sql immutable security invoker set search_path='' as $$
 select '"'||replace(case when value ~ '^[[:space:]]*[=+@-]' or value ~ '^[\t\r\n]' then ''''||value else coalesce(value,'') end,'"','""')||'"'
$$;
commit;
