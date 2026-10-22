-- P06 private execution context; clients have no table grants or file policies.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ftksaas-imports','ftksaas-imports',false,2097152,array['text/csv']) on conflict(id) do nothing;
do $$begin if exists(select 1 from storage.buckets where id='ftksaas-imports' and (public or (file_size_limit is null or file_size_limit>2097152) or allowed_mime_types is distinct from array['text/csv'])) then raise exception 'Import bucket configuration mismatch';end if;end$$;
create table private.p06_configuration(org_id uuid primary key references core.organizations(id),max_import_bytes bigint not null check(max_import_bytes between 1 and 2097152),max_import_rows int not null check(max_import_rows between 1 and 5000),max_export_bytes bigint not null check(max_export_bytes between 1 and 16777216));
create table private.p06_files(file_id uuid primary key references core.files(id),account_id uuid not null references core.accounts(id),filename text not null);
create table private.p06_contexts(receipt_id uuid primary key references core.operation_receipts(id),org_id uuid,account_id uuid not null references core.accounts(id),operation text not null,request jsonb not null,subject text not null);
create table private.p06_previews(preview_id uuid primary key references core.previews(id),org_id uuid not null references core.organizations(id),account_id uuid not null references core.accounts(id),operation text not null,request jsonb not null,response jsonb not null,expires_at timestamptz not null);
create table private.p06_jobs(job_id uuid primary key references core.outbox_jobs(id),org_id uuid not null references core.organizations(id),account_id uuid not null references core.accounts(id),person_id uuid not null,center_id uuid,operation text not null check(operation in ('report_build_v1','import_rows_process_v1')),request jsonb not null,phase text not null check(phase in ('report','preview','apply')),progress_count bigint not null default 0,total_count bigint,result_reference jsonb,safe_error_code text,operation_key uuid,lease_hash text,payload_hash text,result jsonb,approved_dependencies jsonb);
create index p06_jobs_org on private.p06_jobs(org_id,job_id);
create table private.p06_export_files(file_id uuid primary key references core.files(id),job_id uuid not null references core.report_jobs(id),body bytea not null);
create table private.p06_sources(org_id uuid not null references core.organizations(id),source_namespace text not null,source_key text not null,center_id uuid not null,payload_hash text not null,person_id uuid not null,created_references jsonb not null,operation_id uuid not null,primary key(org_id,source_namespace,source_key),foreign key(org_id,person_id) references core.people(org_id,id),foreign key(org_id,operation_id) references core.operation_receipts(org_id,id) deferrable initially deferred);
create unique index p06_import_row_number on core.import_rows(org_id,job_id,row_number);
create index p06_import_pending on core.import_rows(org_id,job_id,state,row_number);
create index p06_receipt_lookup on core.operation_receipts(actor_account_id,org_id,operation,key_hash);
create index p06_audit_subject on core.audit_events(org_id,subject_table,subject_id,created_at,id);
do $$declare t text;begin foreach t in array array['p06_configuration','p06_files','p06_contexts','p06_previews','p06_jobs','p06_export_files','p06_sources'] loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated',t);execute format('grant all on private.%I to service_role',t);end loop;end$$;
create function private.p06_granted(org uuid,actor uuid,center uuid,perm text) returns boolean language sql stable security invoker set search_path='' as $$
 select private.has_role(org,actor,'staff',center) and exists(select 1 from core.permission_overrides p where p.org_id=org and p.person_id=actor and p.center_id=center and p.permission=perm and p.enabled)
$$;
create function private.p06_report_scope(r jsonb,org uuid,center uuid,actor uuid,exporting boolean default false) returns uuid[] language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare centers uuid[];c uuid;kind text:=r->>'report';plan text;financial boolean:=kind in ('collections_debts','earnings','cross_center_usage');s timestamptz:=(r#>>'{filters,interval,starts_at}')::timestamptz;e timestamptz:=(r#>>'{filters,interval,ends_at}')::timestamptz;
begin
 perform private.require_feature(org,'F28');
 if kind not in ('collections_debts','lesson_attendance','renewal','occupancy','resource_usage','earnings','crm_conversion','cross_center_usage') or s is null or e is null or not isfinite(s) or not isfinite(e) or s>=e or e-s>interval '366 days' then perform private.fail('VALIDATION_FAILED');end if;
 select p.name into plan from core.saas_subscriptions sub join core.saas_plan_versions p on p.id=sub.plan_version_id where sub.org_id=org order by sub.created_at desc,sub.id desc limit 1;
 if plan is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if plan='starter' and kind not in ('collections_debts','lesson_attendance') or kind='cross_center_usage' and plan<>'business' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 if financial then perform private.require_feature(org,'F06');perform private.require_feature(org,'F19');end if;
 if kind='crm_conversion' then perform private.require_feature(org,'F21');end if;
 if kind='earnings' then perform private.require_feature(org,'F20');end if;
 if kind='cross_center_usage' then perform private.require_feature(org,'F18');end if;
 select array_agg(distinct value::uuid order by value::uuid) into centers from jsonb_array_elements_text(r#>'{filters,center_ids}');
 if centers is null then
  if center is not null then centers:=array[center];
  elsif private.is_org_reader(org,actor) then select array_agg(c.id order by c.id) into centers from core.centers c where c.org_id=org and private.center_accessible(org,c.id);
  else perform private.fail('FORBIDDEN');end if;
 end if;
 if center is not null and exists(select 1 from unnest(centers) c where c<>center) then perform private.fail('FORBIDDEN');end if;
 if cardinality(centers)>1 and plan<>'business' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 foreach c in array coalesce(centers,'{}'::uuid[]) loop
  perform private.assert_center(org,c);
  if not private.is_org_reader(org,actor) and not private.is_manager(org,actor,c) and not private.p06_granted(org,actor,c,'report.read') then perform private.fail('FORBIDDEN');end if;
  if financial and not private.is_org_reader(org,actor) and not private.is_manager(org,actor,c) and not private.p06_granted(org,actor,c,'finance.read') then perform private.fail('FORBIDDEN');end if;
  if exporting and not private.is_org_reader(org,actor) and not private.is_manager(org,actor,c) and (not private.p06_granted(org,actor,c,'report.export') or kind='crm_conversion') then perform private.fail('FORBIDDEN');end if;
 end loop;
 if exists(select 1 from jsonb_array_elements_text(coalesce(r#>'{filters,person_ids}','[]')) p where not exists(select 1 from core.people x join core.center_relationships cr on cr.org_id=x.org_id and cr.person_id=x.id where x.org_id=org and x.id=p.value::uuid and cr.center_id=any(centers))) then perform private.fail('NOT_FOUND');end if;
 return coalesce(centers,'{}'::uuid[]);
end$$;
create function private.p06_import_access(org uuid,center uuid,actor uuid,writing boolean default true) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if center is null then perform private.fail('VALIDATION_FAILED');end if;perform private.assert_center(org,center);perform private.require_feature(org,'F31');
 if not private.is_manager(org,actor,center) and not private.p06_granted(org,actor,center,'import.execute') then perform private.fail('FORBIDDEN');end if;
 if writing and private.access_mode(org)<>'normal' then perform private.fail('BILLING_OPERATION_RESTRICTED');end if;
end$$;
-- Scope is derived from immutable server-side job/preview context, never caller flags.
create function private.p06_import_file_access(org uuid,center uuid,actor uuid,account uuid,fid uuid) returns core.files language plpgsql stable security invoker set search_path='' as $$
declare f core.files;
begin
 select x.* into f from core.files x join private.p06_files p on p.file_id=x.id and p.account_id=account where x.org_id=org and x.id=fid and x.purpose='import' and x.owner_person_id=actor;
 if f.id is null or center is not null and center is distinct from f.center_id then perform private.fail('NOT_FOUND');end if;
 perform private.p06_import_access(org,f.center_id,actor);return f;
end$$;
create function private.p06_access(op text,r jsonb,org uuid,center uuid,actor uuid,account uuid) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare j private.p06_jobs;ctx private.p06_previews;
begin
 if op in ('report_get_v1','report_export_start_v1') then perform private.p06_report_scope(r,org,center,actor,op='report_export_start_v1');
 elsif op in ('report_file_get_v1','job_status_get_v1','import_rows_list_v1') then
  select * into j from private.p06_jobs where org_id=org and job_id=(r->>'job_id')::uuid and account_id=account;
  if j.job_id is null or center is not null and center is distinct from j.center_id then perform private.fail('NOT_FOUND');end if;
  if op='report_file_get_v1' and j.operation<>'report_build_v1' or op='import_rows_list_v1' and j.operation<>'import_rows_process_v1' then perform private.fail('NOT_FOUND');end if;
  if j.operation='report_build_v1' then perform private.p06_report_scope(j.request,org,j.center_id,actor,true);else perform private.p06_import_access(org,j.center_id,actor,false);end if;
 elsif op in ('import_upload_prepare_v1','import_preview_v1') then perform private.p06_import_access(org,center,actor);
 elsif op='import_apply_v1' then
  select * into ctx from private.p06_previews where org_id=org and account_id=account and preview_id=(r#>>'{preview,id}')::uuid and operation='import_preview_v1';
  if ctx.preview_id is null or center is not null and center is distinct from (ctx.request->>'center_id')::uuid then perform private.fail('NOT_FOUND');end if;
  perform private.p06_import_access(org,(ctx.request->>'center_id')::uuid,actor);
 elsif op in ('operation_status_get_v1','preview_get_v1') then null; -- original authorization is checked before returning a result
 elsif op in ('import_rows_process_v1','report_build_v1') then perform private.fail('FORBIDDEN');
 elsif op='audit_list_v1' then null; -- static subject resolver below
 else perform private.fail('FORBIDDEN');end if;
end$$;
commit;
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
begin;
create function private.p06_import_dependencies(job uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','import_jobs','id',j.id),'version',j.version)),
 'policy_hashes',jsonb_build_array(md5(jsonb_build_object('file',jsonb_build_object('checksum',f.checksum,'state',f.state),'mapping',j.mapping,'namespace',j.source_namespace,
 'rows',(select jsonb_agg(jsonb_build_object('id',x.id,'version',x.version,'state',x.state,'payload',x.payload) order by x.row_number) from core.import_rows x where x.job_id=j.id),
 'people',(select jsonb_agg(to_jsonb(p) order by p.id) from core.people p where p.org_id=j.org_id and p.id in(select (x.payload->>'person_ref')::uuid from core.import_rows x where x.job_id=j.id and x.payload->>'person_ref' is not null and x.state='valid')),
 'products',(select jsonb_agg(to_jsonb(p) order by p.id) from core.product_versions p where p.org_id=j.org_id and p.id in(select (x.payload->>'product_version_ref')::uuid from core.import_rows x where x.job_id=j.id and x.payload->>'product_version_ref' is not null and x.state='valid')),
 'config',(select to_jsonb(c) from private.p06_configuration c where c.org_id=j.org_id),
 'plan',(select jsonb_agg(to_jsonb(s) order by s.id) from core.saas_subscriptions s where s.org_id=j.org_id),
 'documents',(select jsonb_agg(to_jsonb(d) order by d.id) from core.document_requirements d where d.org_id=j.org_id and d.operation='sale' and exists(select 1 from core.import_rows r where r.job_id=j.id and r.state='valid' and coalesce((r.payload->>'opening_credits')::bigint,0)>0 and private.p05_scope_matches(d.scope,jsonb_build_object('center_id',j.center_id,'product_version_id',r.payload->'product_version_ref')))),
 'sources',(select jsonb_agg(to_jsonb(z) order by z.source_key) from private.p06_sources z where z.org_id=j.org_id and z.source_namespace=j.source_namespace and exists(select 1 from core.import_rows r where r.job_id=j.id and r.source_key=z.source_key)),
 'deficits',(select jsonb_agg(jsonb_build_object('deficit',to_jsonb(d),'session',to_jsonb(s),'closures',(select jsonb_agg(to_jsonb(c) order by c.revision,c.id) from core.attendance_closures c where c.org_id=d.org_id and c.session_id=d.session_id)) order by d.id) from core.credit_deficits d join core.sessions s on s.org_id=d.org_id and s.id=d.session_id where d.org_id=j.org_id and exists(select 1 from core.import_rows r where r.job_id=j.id and r.state='valid' and coalesce((r.payload->>'opening_credits')::bigint,0)>0 and d.person_id=(case when r.state='valid' then r.payload->>'person_ref' end)::uuid and private.lesson_scope_matches(j.org_id,d.session_id,(case when r.state='valid' then r.payload->>'product_version_ref' end)::uuid))),
 'centers',(select jsonb_agg(to_jsonb(c) order by c.id) from core.centers c where c.org_id=j.org_id and (c.id=j.center_id or exists(select 1 from core.credit_deficits d join core.import_rows r on r.job_id=j.id and d.person_id=(case when r.state='valid' then r.payload->>'person_ref' end)::uuid where d.org_id=j.org_id and d.center_id=c.id and r.state='valid'))))::text)),
 'permission_hash',md5(jsonb_build_object('roles',(select jsonb_agg(to_jsonb(x) order by x.id) from core.role_assignments x where x.org_id=j.org_id and x.person_id=private.person_for(j.org_id,j.requester_account_id) and (x.scope_center_id is null or x.scope_center_id=j.center_id)),'links',(select jsonb_agg(to_jsonb(x) order by x.id) from core.account_links x where x.org_id=j.org_id and x.account_id=j.requester_account_id),'overrides',(select jsonb_agg(to_jsonb(x) order by x.id) from core.permission_overrides x where x.org_id=j.org_id and x.person_id=private.person_for(j.org_id,j.requester_account_id) and x.center_id=j.center_id))::text))
 from core.import_jobs j join core.files f on f.org_id=j.org_id and f.id=j.file_id where j.id=job
$$;
create function private.p06_import_row_check(org uuid,center uuid,payload jsonb,namespace text) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare p core.people;pv core.product_versions;c jsonb;credits bigint:=coalesce((payload->>'opening_credits')::bigint,0);debt bigint:=coalesce((payload->>'opening_debt_minor')::bigint,0);n bigint;prior private.p06_sources;
begin
 if payload->>'source_key' is null or payload->>'display_name' is null or length(btrim(payload->>'source_key')) not between 1 and 500 or length(btrim(payload->>'display_name')) not between 1 and 500 then perform private.fail('VALIDATION_FAILED');end if;
 select * into prior from private.p06_sources where org_id=org and source_namespace=namespace and source_key=payload->>'source_key';
 if prior.org_id is not null then
  if prior.center_id<>center or prior.payload_hash<>encode(extensions.digest(payload::text,'sha256'),'hex') then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;return;
 end if;
 if payload->>'person_ref' is not null then
  select * into p from core.people where org_id=org and id=(payload->>'person_ref')::uuid and state='active';
  if p.id is null or not exists(select 1 from core.center_relationships where org_id=org and person_id=p.id and center_id=center) then perform private.fail('NOT_FOUND');end if;
 end if;
 for c in select value from jsonb_array_elements(coalesce(payload->'contacts','[]')) loop
  if c->>'kind' not in ('email','phone') or length(c->>'value') not between 1 and 320 then perform private.fail('VALIDATION_FAILED');end if;
 end loop;
 if credits<0 or debt<0 or (credits>0 or debt>0) and (payload->>'currency' is null or payload->>'currency' !~ '^[A-Z]{3}$') then perform private.fail('VALIDATION_FAILED');end if;
 if debt>0 then perform private.require_feature(org,'F19');end if;
 if credits>0 then
  perform private.require_feature(org,'F15');perform private.require_feature(org,'F19');
  select * into pv from core.product_versions where org_id=org and id=(payload->>'product_version_ref')::uuid and effective_at<=clock_timestamp();
  if pv.id is null or pv.kind<>'credits' or pv.currency is distinct from payload->>'currency' or credits>pv.credits then perform private.fail('VALIDATION_FAILED');end if;
  if pv.center_id<>center and not exists(select 1 from core.product_scopes where org_id=org and product_version_id=pv.id and scope_kind='organization_all') then perform private.fail('FORBIDDEN');end if;
  -- Explicit full-package historical basis, never current catalog price or a
  -- fabricated payment. Remaining credits may be lower than original quantity.
  if payload->>'opening_credit_value_minor' is null or (payload->>'opening_credit_value_minor')::bigint<0 or payload->>'start_date' is null or payload->>'end_date' is null or (payload->>'end_date')::date<=(payload->>'start_date')::date then perform private.fail('VALIDATION_FAILED');end if;
  -- Opening balances do not reconstruct historical consumption or cent slots.
  -- Never overquote a historical-used-price refund or guess a remaining slice.
  if pv.refund_method not in ('none','credit_ratio') or credits<pv.credits and mod((payload->>'opening_credit_value_minor')::bigint,pv.credits)<>0 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 end if;
 perform private.require_feature(org,'F07');
 if not exists(select 1 from core.center_relationships where org_id=org and person_id=p.id and kind='student' and state='active') then
  n:=private.plan_limit(org,'active_students');if n is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  if (select count(distinct person_id) from core.center_relationships where org_id=org and kind='student' and state='active')>=n then perform private.fail('PLAN_LIMIT_REACHED');end if;
 end if;
end$$;
-- Reuse the accepted sale rule: settle existing eligible negative balances,
-- consumed past first and future reservations second, without rewriting snapshots.
create function private.p06_opening_id_count(org uuid,payload jsonb) returns int language sql stable security invoker set search_path='' as $$
 select 12+coalesce(jsonb_array_length(payload->'contacts'),0)+3*(select count(*)::int from core.credit_deficits d where d.org_id=org and d.person_id=(payload->>'person_ref')::uuid and coalesce((payload->>'opening_credits')::bigint,0)>0 and d.state in ('consumed','reserved') and private.lesson_scope_matches(org,d.session_id,(payload->>'product_version_ref')::uuid))
$$;
create function private.p06_settle_opening(org uuid,sale_id uuid,person uuid,product uuid,operation uuid,ids uuid[],idx int) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare d record;
begin
 for d in select d.*,s.starts_at from core.credit_deficits d join core.sessions s on s.org_id=d.org_id and s.id=d.session_id where d.org_id=org and d.person_id=person and d.state in ('consumed','reserved') and private.lesson_scope_matches(org,d.session_id,product) order by case when d.state='consumed' then 0 else 1 end,s.starts_at,d.id for update of d loop
  if private.credit_available(org,sale_id)<d.quantity then exit;end if;
  insert into core.entitlement_allocations(id,org_id,sale_id,reservation_id,quantity,state) values(private.new_id(ids,idx),org,sale_id,d.reservation_id,d.quantity,d.state);
  insert into core.entitlement_movements(id,org_id,sale_id,person_id,reservation_id,kind,quantity,operation_id) values(private.new_id(ids,idx+1),org,sale_id,person,d.reservation_id,case when d.state='consumed' then 'consume' else 'reserve' end,d.quantity,operation);
  update core.credit_deficits set state='settled',settled_sale_id=sale_id,version=version+1 where id=d.id;idx:=idx+2;
 end loop;
end$$;
create function private.p06_import_row_apply(row_id uuid,operation uuid,ids uuid[],offset_i int) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare x core.import_rows;prior private.p06_sources;person uuid;sale_id uuid;debt_id uuid;rel uuid;contact jsonb;refs jsonb:='[]';idx int:=offset_i;row_end int;deficit_count int;tz text;credits bigint;start_at timestamptz;end_at timestamptz;
begin
 select * into x from core.import_rows where id=row_id for update;
 if x.id is null then perform private.fail('NOT_FOUND');end if;row_end:=offset_i+private.p06_opening_id_count(x.org_id,x.payload)-1;deficit_count:=(row_end-offset_i+1-12-coalesce(jsonb_array_length(x.payload->'contacts'),0))/3;
 perform private.p06_import_row_check(x.org_id,x.center_id,x.payload,x.source_namespace);
 select * into prior from private.p06_sources where org_id=x.org_id and source_namespace=x.source_namespace and source_key=x.source_key;
 if prior.org_id is not null then return prior.created_references;end if;
 person:=(x.payload->>'person_ref')::uuid;
 if person is null then
  person:=private.new_id(ids,idx);idx:=idx+1;
  insert into core.people(id,org_id,display_name,state) values(person,x.org_id,x.payload->>'display_name','active');
  for contact in select value from jsonb_array_elements(coalesce(x.payload->'contacts','[]')) loop
   insert into core.person_contacts(id,org_id,person_id,kind,value) values(private.new_id(ids,idx),x.org_id,person,contact->>'kind',contact->>'value');idx:=idx+1;
  end loop;
 end if;
 refs:=jsonb_build_array(jsonb_build_object('type','people','id',person));
 if not exists(select 1 from core.center_relationships where org_id=x.org_id and center_id=x.center_id and person_id=person and kind='student' and state='active') then
  rel:=private.new_id(ids,idx);idx:=idx+1;insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values(rel,x.org_id,x.center_id,person,'student','active',clock_timestamp());refs:=refs||jsonb_build_array(jsonb_build_object('type','center_relationships','id',rel));
 end if;
 credits:=coalesce((x.payload->>'opening_credits')::bigint,0);
 if credits>0 then
  select timezone into tz from core.centers where org_id=x.org_id and id=x.center_id;
  start_at:=(x.payload->>'start_date')::date::timestamp at time zone tz;end_at:=(x.payload->>'end_date')::date::timestamp at time zone tz;
  if to_char(start_at at time zone tz,'YYYY-MM-DD HH24:MI')<>x.payload->>'start_date'||' 00:00' or to_char(end_at at time zone tz,'YYYY-MM-DD HH24:MI')<>x.payload->>'end_date'||' 00:00' then perform private.fail('VALIDATION_FAILED');end if;
  sale_id:=private.new_id(ids,idx);idx:=idx+1;
  insert into core.sales(id,org_id,center_id,person_id,product_version_id,net_minor,currency,valid_from,valid_until,state,terms_hash,start_date,end_date,timezone,paid_days) values(sale_id,x.org_id,x.center_id,person,(x.payload->>'product_version_ref')::uuid,(x.payload->>'opening_credit_value_minor')::bigint,x.payload->>'currency',start_at,end_at,'active',encode(extensions.digest(x.payload::text,'sha256'),'hex'),(x.payload->>'start_date')::date,(x.payload->>'end_date')::date,tz,(x.payload->>'end_date')::date-(x.payload->>'start_date')::date);
  perform private.p05_assert_documents(x.org_id,x.center_id,person,jsonb_build_object('gate','sale','subject',jsonb_build_object('type','sales','id',sale_id)));
  insert into core.entitlement_accounts(id,org_id,sale_id,person_id,state,balance_version) values(private.new_id(ids,idx),x.org_id,sale_id,person,'active',1);idx:=idx+1;
  insert into core.entitlement_movements(id,org_id,sale_id,person_id,kind,quantity,operation_id) values(private.new_id(ids,idx),x.org_id,sale_id,person,'grant',credits,operation);idx:=idx+1;
  perform private.p06_settle_opening(x.org_id,sale_id,person,(x.payload->>'product_version_ref')::uuid,operation,ids,idx);
  -- The accepted reconciler starts its bank at300. Adapt its bank without
  -- altering its financial algorithm; reserve one extra ID per possible allocation.
  if deficit_count>0 then perform private.settlement_sync(x.org_id,null,sale_id,operation,array_fill(null::uuid,array[299])||ids[row_end-deficit_count:row_end-1]);end if;idx:=row_end;
  refs:=refs||jsonb_build_array(jsonb_build_object('type','sales','id',sale_id));
 end if;
 if coalesce((x.payload->>'opening_debt_minor')::bigint,0)>0 then
  debt_id:=private.new_id(ids,idx);idx:=idx+1;
  insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state) values(debt_id,x.org_id,x.center_id,person,(x.payload->>'opening_debt_minor')::bigint,x.payload->>'currency',clock_timestamp(),'open');refs:=refs||jsonb_build_array(jsonb_build_object('type','debts','id',debt_id));
 end if;
 insert into private.p06_sources values(x.org_id,x.source_namespace,x.source_key,x.center_id,encode(extensions.digest(x.payload::text,'sha256'),'hex'),person,refs,operation);
 return refs;
end$$;
create function private.p06_import_summary(job uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with all_rows as(select r.*,exists(select 1 from private.p06_sources z where z.org_id=r.org_id and z.source_namespace=r.source_namespace and z.source_key=r.source_key and z.center_id=r.center_id and z.payload_hash=encode(extensions.digest(r.payload::text,'sha256'),'hex')) replay from core.import_rows r where r.job_id=job),
 fresh as materialized(select * from all_rows where state='valid' and not replay),
 debt_totals as(select payload->>'currency' currency,sum((payload->>'opening_debt_minor')::numeric)::text amount_minor from fresh where coalesce((payload->>'opening_debt_minor')::numeric,0)>0 group by payload->>'currency'),
 basis_totals as(select payload->>'currency' currency,sum((payload->>'opening_credit_value_minor')::numeric)::text amount_minor from fresh where coalesce((payload->>'opening_credits')::bigint,0)>0 group by payload->>'currency')
 select jsonb_build_object('total_rows',(select count(*) from all_rows),'valid_rows',(select count(*) from all_rows where state='valid'),'invalid_rows',(select count(*) from all_rows where state='invalid'),'new_people',(select count(*) from fresh where payload->>'person_ref' is null),'replayed_rows',(select count(*) from all_rows where state='valid' and replay),'opening_credits',(select coalesce(sum((payload->>'opening_credits')::bigint),0) from fresh),
 'opening_debt_totals',coalesce((select jsonb_agg(jsonb_build_object('currency',currency,'amount_minor',amount_minor) order by currency) from debt_totals),'[]'::jsonb),
 'original_credit_basis_totals',coalesce((select jsonb_agg(jsonb_build_object('currency',currency,'amount_minor',amount_minor) order by currency) from basis_totals),'[]'::jsonb),
 'existing_negative_credits',(select coalesce(sum(d.quantity),0) from core.credit_deficits d where d.state in ('consumed','reserved') and exists(select 1 from fresh f where f.org_id=d.org_id and d.person_id=(f.payload->>'person_ref')::uuid and coalesce((f.payload->>'opening_credits')::bigint,0)>0 and private.lesson_scope_matches(d.org_id,d.session_id,(f.payload->>'product_version_ref')::uuid))))
$$;
create function private.p06_import(op text,r jsonb,org uuid,center uuid,actor uuid,account uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare cfg private.p06_configuration;f core.files;j core.import_jobs;p core.previews;pp private.preview_payloads;item jsonb;data jsonb;rows jsonb;pid uuid:=private.new_id(ids,2);idx int:=40;c uuid:=center;
begin
 if op in ('import_upload_prepare_v1','import_preview_v1') then
  select * into cfg from private.p06_configuration where org_id=org;if cfg.org_id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 end if;
 if op='import_upload_prepare_v1' then
  if (r->>'bytes')::bigint<1 or (r->>'bytes')::bigint>cfg.max_import_bytes or r->>'mime'<>'text/csv' or length(btrim(r->>'filename')) not between 1 and 255 or r->>'checksum' !~ '^[a-f0-9]{64}$' then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.files(id,org_id,center_id,owner_person_id,object_key,mime,size_bytes,checksum,purpose,state,expires_at) values(pid,org,center,actor,org::text||'/'||pid::text,'text/csv',(r->>'bytes')::bigint,r->>'checksum','import','pending_upload',clock_timestamp()+interval '2 hours') returning * into f;
  insert into private.p06_files values(pid,account,r->>'filename');data:=jsonb_build_object('file_id',pid,'upload_url',f.object_key,'expires_at',f.expires_at,'allowed_mime',array['text/csv'],'max_bytes',f.size_bytes);
 elsif op='import_preview_v1' then
  select f.* into f from core.files f join private.p06_files x on x.file_id=f.id and x.account_id=account where f.org_id=org and f.id=(r->>'file_id')::uuid and f.center_id=center and f.purpose='import' for update of f;
  if f.id is null then perform private.fail('NOT_FOUND');end if;
  if f.size_bytes>cfg.max_import_bytes then perform private.fail('VALIDATION_FAILED');end if;
  if f.expires_at<=clock_timestamp() and f.state='pending_upload' then perform private.fail('VALIDATION_FAILED');end if;
  if aux->>'phase'='p06_import_file' then return jsonb_build_object('_internal_import',jsonb_build_object('object_key',f.object_key,'bytes',f.size_bytes,'checksum',f.checksum,'max_rows',cfg.max_import_rows));end if;
  if aux->>'import_verified' is distinct from 'true' or aux->>'checksum' is distinct from f.checksum or jsonb_typeof(aux->'rows')<>'array' or jsonb_array_length(aux->'rows') not between 1 and cfg.max_import_rows or length(btrim(r->>'source_namespace')) not between 1 and 100 then perform private.fail('VALIDATION_FAILED');end if;
  if cardinality(ids)<idx+jsonb_array_length(aux->'rows') then return jsonb_build_object('_internal_retry','uuid_bank_exhausted','required_uuid_count',idx+jsonb_array_length(aux->'rows'));end if;
  update core.files set state='ready',expires_at=null,version=version+1 where id=f.id and state='pending_upload';
  insert into core.import_jobs(id,org_id,center_id,requester_account_id,file_id,mapping,state,file_checksum,source_namespace) values(pid,org,center,account,f.id,r->'mapping','pending',f.checksum,r->>'source_namespace');
  for item in select value from jsonb_array_elements(aux->'rows') loop
   insert into core.import_rows(id,org_id,center_id,job_id,row_number,source_key,payload,state,created_references,error_code,source_namespace) values(private.new_id(ids,idx),org,center,pid,(item->>'row_number')::bigint,coalesce(item#>>'{payload,source_key}',''),item->'payload',case when item->>'error_code' is null then 'pending' else 'invalid' end,'{}',case when item->>'error_code' is null then null else 'VALIDATION_FAILED' end,r->>'source_namespace');idx:=idx+1;
  end loop;
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(pid,org,'p06.import','p06.import:'||pid::text,'pending',0,clock_timestamp());
  insert into private.p06_jobs(job_id,org_id,account_id,person_id,center_id,operation,request,phase,total_count) values(pid,org,account,actor,center,'import_rows_process_v1',r,'preview',jsonb_array_length(aux->'rows'));data:=jsonb_build_object('job_id',pid,'state','pending');
 elsif op='import_apply_v1' then
  select * into p from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid and actor_account_id=account for update;select * into pp from private.preview_payloads where preview_id=p.id;
  select * into j from core.import_jobs where org_id=org and preview_id=p.id for update;
  if p.id is null or j.id is null or p.operation<>'import_apply_v1' or p.state<>'current' or pp.expires_at<=clock_timestamp() or pp.token_hash is distinct from encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') or p.dependencies is distinct from private.p06_import_dependencies(j.id) then perform private.fail('PREVIEW_STALE');end if;
  perform private.p06_import_access(org,j.center_id,actor);
  update core.previews set state='applied',version=version+1 where id=p.id;
  update core.import_jobs set state='pending',version=version+1 where id=j.id;
  update core.outbox_jobs set state='pending',attempts=0,lease_until=null,next_attempt_at=clock_timestamp(),version=version+1 where id=j.id;
  update private.p06_jobs set phase='apply',progress_count=0,result_reference=null,safe_error_code=null,operation_key=null,lease_hash=null,payload_hash=null,result=null where job_id=j.id;
  update private.p06_jobs set approved_dependencies=private.p06_import_dependencies(j.id)-'versions' where job_id=j.id;
  pid:=j.id;data:=jsonb_build_object('job_id',pid,'state','pending');
 elsif op='import_rows_list_v1' then
  select * into j from core.import_jobs where org_id=org and id=(r->>'job_id')::uuid and requester_account_id=account;
  select coalesce(jsonb_agg(jsonb_build_object('row_number',x.row_number,'state',x.state,'error_code',x.error_code,'created_references',coalesce(z.created_references,'[]'::jsonb)) order by x.row_number),'[]'::jsonb) into rows from core.import_rows x left join private.p06_sources z on z.org_id=x.org_id and z.source_namespace=x.source_namespace and z.source_key=x.source_key and z.center_id=x.center_id and x.state='applied' where x.org_id=org and x.job_id=j.id;
  data:=private.p06_page(rows,r->'page',md5(jsonb_build_object('account',account,'request',r-'page'-'request_id')::text),clock_timestamp());pid:=j.id;
 else perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('data',data,'primary_id',pid,'subject',case when op='import_upload_prepare_v1' then 'files' else 'import_jobs' end);
end$$;
commit;
begin;
do $$begin if not exists(select 1 from pg_roles where rolname='ftk_p06_worker') then create role ftk_p06_worker nologin;end if;end$$;
create table private.p06_worker_scopes(db_role name not null,org_id uuid not null references core.organizations(id),primary key(db_role,org_id));
alter table private.p06_worker_scopes enable row level security;revoke all on private.p06_worker_scopes from public,anon,authenticated,ftk_p06_worker;
create function private.p06_worker_scope(org uuid) returns void language plpgsql security invoker set search_path='' as $$
begin if not pg_has_role(session_user,'ftk_p06_worker','member') or not exists(select 1 from private.p06_worker_scopes where db_role=session_user and org_id=org) then perform private.fail('FORBIDDEN');end if;end$$;
create function private.p06_job_authorize(j private.p06_jobs) returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid;
begin
 if not exists(select 1 from core.accounts a join auth.users u on u.id=a.auth_user_id where a.id=j.account_id and a.state='active' and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<clock_timestamp())) then perform private.fail('FORBIDDEN');end if;
 actor:=private.person_for(j.org_id,j.account_id);if actor is null or actor is distinct from j.person_id then perform private.fail('FORBIDDEN');end if;
 if private.access_mode(j.org_id) not in ('normal','grace') then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if j.operation='report_build_v1' then perform private.p06_report_scope(j.request,j.org_id,j.center_id,actor,true);else perform private.p06_import_access(j.org_id,j.center_id,actor);end if;
end$$;
create function private.p06_jobs_claim(org uuid,ids uuid[],lim int default 1) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare j core.outbox_jobs;c private.p06_jobs;token text;result jsonb:='[]';idx int:=20;
begin
 perform private.p06_worker_scope(org);if lim not between 1 and 50 then perform private.fail('VALIDATION_FAILED');end if;
 perform 1 from core.organizations where id=org for update;
 delete from private.p06_previews where org_id=org and expires_at<=clock_timestamp();
 delete from private.p06_contexts c using core.operation_receipts r where c.receipt_id=r.id and c.org_id=org and r.result_expires_at<=clock_timestamp();
 delete from private.p06_export_files x using core.files f where f.id=x.file_id and f.org_id=org and f.expires_at<=clock_timestamp();
 update core.outbox_jobs j set state='failed',lease_until=null,version=version+1 from private.p06_jobs c where c.job_id=j.id and c.org_id=org and j.state='running' and j.lease_until<=clock_timestamp() and j.attempts>=3;
 update private.p06_jobs c set safe_error_code='TEMPORARY_FAILURE' from core.outbox_jobs j where j.id=c.job_id and c.org_id=org and j.state='failed' and c.safe_error_code is null;
 update core.report_jobs x set state='failed',version=x.version+1 from core.outbox_jobs j where j.id=x.id and x.org_id=org and j.state='failed' and x.state<>'failed';
 update core.import_jobs x set state='failed',version=x.version+1 from core.outbox_jobs j where j.id=x.id and x.org_id=org and j.state='failed' and x.state<>'failed';
 for j in select j.* from core.outbox_jobs j join private.p06_jobs c on c.job_id=j.id where c.org_id=org and j.attempts<3 and ((j.state in ('pending','retry_wait') and coalesce(j.next_attempt_at,clock_timestamp())<=clock_timestamp()) or (j.state='running' and j.lease_until<=clock_timestamp())) order by j.created_at,j.id limit lim for update of j skip locked loop
  token:=encode(extensions.gen_random_bytes(32),'hex');
  update private.p06_jobs set operation_key=private.new_id(ids,idx),lease_hash=encode(extensions.digest(token,'sha256'),'hex'),payload_hash=null,result=null where job_id=j.id returning * into c;idx:=idx+1;
  update core.outbox_jobs set state='running',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds',version=version+1 where id=j.id;
  result:=result||jsonb_build_array(jsonb_build_object('operation',c.operation,'request',jsonb_build_object('client_api_version',1,'request_id',private.new_id(ids,idx),'org_id',org,'operation_key',c.operation_key,'job_id',j.id,'lease_token',token)));idx:=idx+1;
 end loop;return result;
end$$;
create function private.p06_worker_execute(op text,r jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare org uuid:=(r->>'org_id')::uuid;j core.outbox_jobs;c private.p06_jobs;x core.import_rows;ij core.import_jobs;cfg private.p06_configuration;rows jsonb;refs jsonb;row_result jsonb;dep jsonb;preview jsonb;token text;body text;bin bytea;field text;item jsonb;line text;data jsonb;out_result jsonb;code text;idx int:=100;row_offset int;needed_ids int;processed int:=0;total bigint;progress bigint;phase_done bool;job_state text;pid uuid:=private.new_id(ids,20);fid uuid:=private.new_id(ids,21);receipt_id uuid:=private.new_id(ids,3);lease_digest text:=encode(extensions.digest(r->>'lease_token','sha256'),'hex');payload_digest text:=encode(extensions.digest((r-'request_id')::text,'sha256'),'hex');centers uuid[];
begin
 perform private.p06_worker_scope(org);perform 1 from core.organizations where id=org for update;
 select * into j from core.outbox_jobs where org_id=org and id=(r->>'job_id')::uuid for update;select * into c from private.p06_jobs where org_id=org and job_id=j.id;
 if c.job_id is null or c.operation<>op or c.operation_key is distinct from (r->>'operation_key')::uuid or c.lease_hash is distinct from lease_digest or r->>'center_id' is not null then perform private.fail('FORBIDDEN');end if;
 if c.payload_hash is not null and c.payload_hash<>payload_digest then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if c.result is not null then perform private.p06_job_authorize(c);return c.result;end if;
 if j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 begin
  perform private.p06_job_authorize(c);
  insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at) values(receipt_id,org,'worker:p06:'||session_user,op,encode(extensions.digest(r->>'operation_key','sha256'),'hex'),payload_digest,'in_progress',clock_timestamp()+interval '30 days');
  if op='report_build_v1' then
   select * into cfg from private.p06_configuration where org_id=org;if cfg.org_id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   centers:=private.p06_report_scope(c.request,org,c.center_id,c.person_id,true);rows:=private.p06_report_rows(c.request,org,centers);
   body:='group_key,center_id,person_id,currency,count,amount_minor,credits,basis_count,ratio_bps'||E'\r\n';
   for item in select value from jsonb_array_elements(rows) loop
    line:='';foreach field in array array['group_key','center_id','person_id','currency','count','amount_minor','credits','basis_count','ratio_bps'] loop line:=line||case when line='' then '' else ',' end||private.p06_csv_cell(item->>field);end loop;
    body:=body||line||E'\r\n';if octet_length(body)>cfg.max_export_bytes then perform private.fail('PLAN_LIMIT_REACHED');end if;
   end loop;
   bin:=convert_to(body,'UTF8');if octet_length(bin)>cfg.max_export_bytes then perform private.fail('PLAN_LIMIT_REACHED');end if;
   insert into core.files(id,org_id,center_id,owner_person_id,object_key,mime,size_bytes,checksum,purpose,state,expires_at) values(fid,org,c.center_id,c.person_id,'p06-db-export/'||org::text||'/'||fid::text,'text/csv',octet_length(bin),encode(extensions.digest(bin,'sha256'),'hex'),'export','ready',clock_timestamp()+interval '7 days');
   insert into private.p06_export_files values(fid,j.id,bin);
   update core.report_jobs set state='succeeded',file_id=fid,expires_at=clock_timestamp()+interval '7 days',version=version+1 where id=j.id;
   progress:=jsonb_array_length(rows);total:=progress;phase_done:=true;refs:=jsonb_build_object('type','files','id',fid);
  elsif op='import_rows_process_v1' then
   select * into ij from core.import_jobs where org_id=org and id=j.id for update;
   if c.phase='apply' and c.approved_dependencies is distinct from private.p06_import_dependencies(j.id)-'versions' then perform private.fail('PREVIEW_STALE');end if;
   for x in select * from core.import_rows where org_id=org and job_id=j.id and state=case when c.phase='preview' then 'pending' else 'valid' end order by row_number limit 25 for update loop
    -- Each row owns a disjoint bank; an exhausted bank aborts the batch safely.
    needed_ids:=case when c.phase='apply' then private.p06_opening_id_count(org,x.payload) else 1 end;
    if idx+needed_ids>cardinality(ids) then
     if processed>0 then exit;end if;
     raise exception using errcode='54000',message='UUID_BANK_EXHAUSTED',detail=(idx+needed_ids)::text;
    end if;
    row_offset:=idx;idx:=idx+needed_ids;processed:=processed+1;
    begin
     perform private.p06_import_row_check(org,c.center_id,x.payload,ij.source_namespace);
     if c.phase='apply' then
      row_result:=private.p06_import_row_apply(x.id,receipt_id,ids,row_offset);
      update core.import_rows set state='applied',error_code=null,created_references=array(select (v->>'id')::uuid from jsonb_array_elements(row_result) v),version=version+1 where id=x.id;
     else update core.import_rows set state='valid',error_code=null,version=version+1 where id=x.id;end if;
    exception when others then
     if SQLSTATE<>'P0001' then raise;end if;
     code:=case when SQLERRM in ('VALIDATION_FAILED','NOT_FOUND','FORBIDDEN','IDEMPOTENCY_PAYLOAD_MISMATCH','PLAN_LIMIT_REACHED','PLAN_FEATURE_UNAVAILABLE','POLICY_NOT_CONFIGURED','DOCUMENT_REQUIRED') then SQLERRM else 'INTEGRITY_VIOLATION' end;
     update core.import_rows set state=case when c.phase='preview' then 'invalid' else 'failed' end,error_code=code,version=version+1 where id=x.id;
    end;
   end loop;
   select count(*),count(*) filter(where case when c.phase='preview' then state<>'pending' else state in ('applied','failed','invalid') end) into total,progress from core.import_rows where job_id=j.id and org_id=org;phase_done:=progress=total;
   if phase_done and c.phase='preview' then
    update core.import_jobs set state='succeeded',preview_id=pid,version=version+1 where id=j.id;
    dep:=private.p06_import_dependencies(j.id);token:=encode(extensions.gen_random_bytes(32),'hex');
    preview:=jsonb_build_object('id',pid,'token',token,'scope_hash',md5(c.request::text),'dependencies',dep,'effects',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','import_jobs','id',j.id),'action','create','quantity',(select count(*) from core.import_rows where job_id=j.id and state='valid'),'reason','Apply valid rows; invalid rows remain unchanged and visible')),'blockers','[]'::jsonb,'expires_at',clock_timestamp()+interval '15 minutes');
    preview:=preview||jsonb_build_object('import_summary',private.p06_import_summary(j.id));
    insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(pid,org,c.account_id,'import_apply_v1',preview->>'scope_hash',dep,preview-'token','current');
    insert into private.preview_payloads values(pid,jsonb_build_object('center_id',c.center_id,'job_id',j.id),(preview->>'expires_at')::timestamptz,encode(extensions.digest(token,'sha256'),'hex'));
    insert into private.p06_previews values(pid,org,c.account_id,'import_preview_v1',c.request,preview,(preview->>'expires_at')::timestamptz);refs:=jsonb_build_object('type','previews','id',pid);
   elsif phase_done then
    update core.import_jobs set state='succeeded',version=version+1 where id=j.id;refs:=jsonb_build_object('type','import_jobs','id',j.id);
   else update core.import_jobs set state='pending',version=version+1 where id=j.id;refs:=jsonb_build_object('type','import_jobs','id',j.id);end if;
  else perform private.fail('FORBIDDEN');end if;
  job_state:=case when phase_done then 'succeeded' else 'pending' end;
  out_result:=jsonb_build_object('ok',true,'data',jsonb_build_object('job_id',j.id,'state',job_state,'result_reference',refs),'trace_id',private.new_id(ids,1));
  insert into core.audit_events(id,org_id,actor_account_id,actor_person_id,action,subject_table,subject_id,operation_id,diff) values(private.new_id(ids,4),org,c.account_id,c.person_id,op,case when op='report_build_v1' then 'report_jobs' else 'import_jobs' end,j.id,receipt_id,jsonb_build_object('progress_count',progress,'total_count',total,'phase',c.phase));
  if phase_done then
   insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(private.new_id(ids,5),org,c.person_id,op,j.id,jsonb_build_object('template_key',op,'subject',jsonb_build_object('type',case when op='report_build_v1' then 'report_jobs' else 'import_jobs' end,'id',j.id)));
   insert into core.outbox_jobs(id,org_id,notification_id,kind,dedupe_key,state,attempts,next_attempt_at) values(private.new_id(ids,6),org,private.new_id(ids,5),'in_app',receipt_id::text,'pending',0,clock_timestamp());
  end if;
  update core.operation_receipts set state='succeeded',result=out_result,business_reference=j.id where id=receipt_id;
  update core.outbox_jobs set state=job_state,attempts=case when phase_done then attempts else 0 end,lease_until=null,next_attempt_at=clock_timestamp(),version=version+1 where id=j.id;
  update private.p06_jobs set progress_count=progress,total_count=total,result_reference=refs,safe_error_code=null,result=out_result,payload_hash=payload_digest where job_id=j.id;
  if c.phase='apply' then update private.p06_jobs set approved_dependencies=private.p06_import_dependencies(j.id)-'versions' where job_id=j.id;end if;
  set constraints all immediate;set constraints all deferred;return out_result;
 exception when SQLSTATE '54000' then
  get stacked diagnostics needed_ids=PG_EXCEPTION_DETAIL;
  return jsonb_build_object('_internal_retry','uuid_bank_exhausted','required_uuid_count',needed_ids);
 when others then code:=case when SQLSTATE='P0001' and SQLERRM in ('FORBIDDEN','NOT_FOUND','PLAN_FEATURE_UNAVAILABLE','PLAN_LIMIT_REACHED','POLICY_NOT_CONFIGURED','SERVICE_UNAVAILABLE','BILLING_OPERATION_RESTRICTED','PREVIEW_STALE') then SQLERRM else 'INTEGRITY_VIOLATION' end;end;
 update core.outbox_jobs set state=case when attempts>=3 then 'failed' else 'retry_wait' end,lease_until=null,next_attempt_at=clock_timestamp()+interval '5 seconds',version=version+1 where id=j.id;
 update private.p06_jobs set safe_error_code=code where job_id=j.id;
 update core.report_jobs x set state=q.state,version=x.version+1 from core.outbox_jobs q where q.id=j.id and x.id=q.id;
 update core.import_jobs x set state=q.state,version=x.version+1 from core.outbox_jobs q where q.id=j.id and x.id=q.id;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',j.attempts<3,'trace_id',private.new_id(ids,1)));
end$$;
revoke all on function private.p06_worker_execute(text,jsonb,uuid[]),private.p06_jobs_claim(uuid,uuid[],int) from public,anon,authenticated;
grant usage on schema private to ftk_p06_worker;
grant execute on function private.p06_worker_execute(text,jsonb,uuid[]),private.p06_jobs_claim(uuid,uuid[],int) to ftk_p06_worker;
commit;
begin;
-- Persist only original business requests; approval secrets are not receipt context.
create function private.p06_scrub(value jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb;begin
 if jsonb_typeof(value)='object' then select coalesce(jsonb_object_agg(k,private.p06_scrub(v)),'{}'::jsonb) into result from jsonb_each(value) e(k,v) where k not in ('token','password','secret','bot_proof','sealed_token','authorization');return result;
 elsif jsonb_typeof(value)='array' then select coalesce(jsonb_agg(private.p06_scrub(v) order by n),'[]'::jsonb) into result from jsonb_array_elements(value) with ordinality e(v,n);return result;end if;return value;
end$$;
create function private.p06_trackable(op text) returns boolean language sql immutable security invoker set search_path='' as $$
 select op !~ '^(account_|public_|platform_|saas_|operation_status_|preview_get_|job_status_)' and op not in ('organization_create_v1','report_file_get_v1','import_rows_process_v1','report_build_v1','outbox_deliver_v1','reminder_schedule_v1','automation_run_v1','waitlist_offer_v1','offer_expire_v1')
$$;
create function private.p06_capture(op text,r jsonb,org uuid,account uuid,receipt uuid,subject text,out_data jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare preview jsonb;
begin
 if not private.p06_trackable(op) then return;end if;
 if r ? 'operation_key' then
  insert into private.p06_contexts values(receipt,org,account,op,private.p06_scrub(r),subject) on conflict(receipt_id) do nothing;
 end if;
 if op like '%\_preview\_v1' escape '\' and op<>'import_preview_v1' then
  preview:=case when out_data ? 'preview' then out_data->'preview' else out_data end;
  if preview ? 'token' and preview ? 'expires_at' and exists(select 1 from core.previews where id=(preview->>'id')::uuid and actor_account_id=account and org_id=org) then
   insert into private.p06_previews values((preview->>'id')::uuid,org,account,op,private.p06_scrub(r),preview,(preview->>'expires_at')::timestamptz) on conflict(preview_id) do nothing;
  end if;
 end if;
end$$;
create function private.p06_original_authorize(op text,r jsonb,auth_id uuid,session_id uuid,ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
declare response jsonb;
begin
 if not private.p06_trackable(op) then perform private.fail('NOT_FOUND');end if;
 response:=private.execute_operation(op,r,auth_id,session_id,ids,jsonb_build_object('phase','p06_authorize_original'));
 if response->>'_internal_authorized' is distinct from 'true' then
  if response#>>'{error,code}' in ('FORBIDDEN','NOT_FOUND','SESSION_REVOKED','SERVICE_UNAVAILABLE','PLAN_FEATURE_UNAVAILABLE','SUBSCRIPTION_NOT_STARTED','BILLING_OPERATION_RESTRICTED') then perform private.fail(response#>>'{error,code}');else perform private.fail('FORBIDDEN');end if;
 end if;
end$$;
-- A fixed catalog of auditable domain entities. The SQL identifier is never a
-- client string outside this catalog; arbitrary private/Auth tables are impossible.
create function private.p06_audit_scope(r jsonb,org uuid,center uuid,actor uuid) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare typ text:=r#>>'{subject,type}';sid uuid:=(r#>>'{subject,id}')::uuid;row_data jsonb;c uuid;financial bool;
begin
 if typ not in ('organizations','centers','rooms','people','center_relationships','sessions','reservations','attendance_entries','sales','debts','cash_movements','earnings','leads','crm_activities','documents','document_versions','notifications','report_jobs','import_jobs','import_rows','files','products','product_versions','role_assignments','policy_versions','classes','events','event_registrations','lesson_requests') then perform private.fail('NOT_FOUND');end if;
 execute format('select to_jsonb(t) from core.%I t where t.org_id=$1 and t.id=$2',typ) into row_data using org,sid;
 if row_data is null then perform private.fail('NOT_FOUND');end if;
 c:=case when typ='centers' then sid when typ in ('documents','role_assignments') then (row_data->>'scope_center_id')::uuid else (row_data->>'center_id')::uuid end;
 if typ='people' and center is not null and exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=sid) then c:=center;end if;
 if center is not null and c is distinct from center then perform private.fail('NOT_FOUND');end if;
 if c is null then if not private.is_org_reader(org,actor) then perform private.fail('FORBIDDEN');end if;
 else
  perform private.assert_center(org,c);
  if not private.is_org_reader(org,actor) and not private.is_manager(org,actor,c) and not private.p06_granted(org,actor,c,'report.read') then perform private.fail('FORBIDDEN');end if;
 end if;
 financial:=typ in ('sales','debts','cash_movements','earnings');
 if financial and not private.is_org_reader(org,actor) and not private.is_manager(org,actor,c) and not private.p06_granted(org,actor,c,'finance.read') then perform private.fail('FORBIDDEN');end if;
end$$;
create function private.p06_tracking(op text,r jsonb,org uuid,center uuid,actor uuid,account uuid,auth_id uuid,session_id uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare ctx private.p06_contexts;receipt core.operation_receipts;pc private.p06_previews;p core.previews;j private.p06_jobs;q core.outbox_jobs;items jsonb;data jsonb;s timestamptz;e timestamptz;pid uuid:=org;asof timestamptz:=clock_timestamp();
begin
 if op='operation_status_get_v1' then
  select * into receipt from core.operation_receipts where actor_account_id=account and org_id is not distinct from org and operation=r->>'operation' and key_hash=encode(extensions.digest(r->>'key','sha256'),'hex');
  select * into ctx from private.p06_contexts where receipt_id=receipt.id and account_id=account;
  if ctx.receipt_id is null or center is not null and center is distinct from (ctx.request->>'center_id')::uuid then perform private.fail('NOT_FOUND');end if;
  perform private.p06_original_authorize(ctx.operation,ctx.request,auth_id,session_id,ids);
  data:=jsonb_build_object('operation',receipt.operation,'key',r->>'key','status',case when receipt.result_expires_at<=clock_timestamp() then 'result_expired' else receipt.state end,'result_available',receipt.state='succeeded' and receipt.result_expires_at>clock_timestamp(),'result_reference',case when receipt.business_reference is not null and receipt.result_expires_at>clock_timestamp() and exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='core' and c.relname=ctx.subject and c.relkind='r') then jsonb_build_object('type',ctx.subject,'id',receipt.business_reference) end);pid:=receipt.id;
 elsif op='preview_get_v1' then
  select * into pc from private.p06_previews where org_id=org and account_id=account and preview_id=(r->>'preview_id')::uuid;select * into p from core.previews where org_id=org and id=pc.preview_id and actor_account_id=account;
  if pc.preview_id is null or p.state<>'current' or pc.expires_at<=clock_timestamp() or center is not null and center is distinct from (pc.request->>'center_id')::uuid then perform private.fail('NOT_FOUND');end if;
  perform private.p06_original_authorize(pc.operation,pc.request,auth_id,session_id,ids);data:=pc.response;pid:=pc.preview_id;
 elsif op='job_status_get_v1' then
  select * into j from private.p06_jobs where org_id=org and account_id=account and job_id=(r->>'job_id')::uuid;select * into q from core.outbox_jobs where id=j.job_id and org_id=org;
  if q.id is null then perform private.fail('NOT_FOUND');end if;
  data:=jsonb_build_object('id',q.id,'state',q.state,'progress_count',j.progress_count,'total_count',j.total_count,'result_reference',j.result_reference,'safe_error_code',j.safe_error_code);pid:=q.id;
 elsif op='audit_list_v1' then
  perform private.p06_audit_scope(r,org,center,actor);s:=(r#>>'{interval,starts_at}')::timestamptz;e:=(r#>>'{interval,ends_at}')::timestamptz;
  if s is null or e is null or not isfinite(s) or not isfinite(e) or s>=e then perform private.fail('VALIDATION_FAILED');end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'subject',jsonb_build_object('type',a.subject_table,'id',a.subject_id),'actor_display',coalesce(p.display_name,'System'),'created_at',a.created_at,'reason',null,'diff',case when changes.v is not null then jsonb_build_object('changes',changes.v) end) order by a.created_at,a.id),'[]'::jsonb) into items
  from core.audit_events a left join core.people p on p.org_id=a.org_id and p.id=a.actor_person_id
  left join lateral(select jsonb_agg(jsonb_build_object('field',k,'old_value',null,'new_value',v) order by k) v from jsonb_each(coalesce(a.diff,'{}'::jsonb)) d(k,v) where k in ('state','version','progress_count','total_count') and jsonb_typeof(v) in ('string','number','boolean','null')) changes on true
  where a.org_id=org and exists(select 1 from private.runtime_operations o where o.name=a.action) and a.subject_table=r#>>'{subject,type}' and a.subject_id=(r#>>'{subject,id}')::uuid and a.created_at>=s and a.created_at<e;
  data:=private.p06_page(items,r->'page',md5(jsonb_build_object('account',account,'request',r-'page'-'request_id')::text),asof);
 else perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('data',data,'primary_id',pid,'subject','organizations');
end$$;
commit;
begin;
create function private.p06_management(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';j record;c private.p06_jobs;items jsonb:='[]';vals jsonb;typ text;data jsonb;original jsonb;
begin
 if r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;
 if op='import_upload_prepare_v1' then perform private.p06_import_access(org,center,actor,false);
  for j in select f.*,x.filename from core.files f join private.p06_files x on x.file_id=f.id and x.account_id=account where f.org_id=org and f.center_id=center order by f.created_at,f.id loop
   vals:=jsonb_build_object('filename',j.filename,'mime',j.mime,'bytes',j.size_bytes,'checksum',j.checksum);typ:='files';
   items:=items||jsonb_build_array(jsonb_build_object('operation',op,'entity',jsonb_build_object('type',typ,'id',j.id),'exists',true,'state',j.state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',typ,'id',j.id),'version',j.version)),'as_of',j.created_at,'current',jsonb_build_object('operation',op,'values',vals)));
  end loop;
 else
  for c in select x.* from private.p06_jobs x where x.org_id=org and x.account_id=account and x.center_id is not distinct from center and ((op='report_export_start_v1' and x.operation='report_build_v1') or (op='import_preview_v1' and x.operation='import_rows_process_v1' and x.request->>'file_id'=k->>'file_id') or (op='import_apply_v1' and x.operation='import_rows_process_v1' and exists(select 1 from core.import_jobs z where z.id=x.job_id and z.preview_id=(k->>'preview_id')::uuid))) order by x.job_id loop
   perform private.p06_job_authorize(c);
   typ:=case when c.operation='report_build_v1' then 'report_jobs' else 'import_jobs' end;
   original:=c.request;vals:=case when op='report_export_start_v1' then jsonb_build_object('report',original->'report','filters',original->'filters','format','csv') when op='import_preview_v1' then jsonb_build_object('file_id',original->'file_id','mapping',original->'mapping','source_namespace',original->'source_namespace') else '{}'::jsonb end;
   if typ='report_jobs' then select jsonb_build_object('state',state,'version',version,'at',created_at) into data from core.report_jobs where org_id=org and id=c.job_id;else select jsonb_build_object('state',state,'version',version,'at',created_at) into data from core.import_jobs where org_id=org and id=c.job_id;end if;
   items:=items||jsonb_build_array(jsonb_build_object('operation',op,'entity',jsonb_build_object('type',typ,'id',c.job_id),'exists',true,'state',data->'state','versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',typ,'id',c.job_id),'version',data->'version')),'as_of',data->'at','current',jsonb_build_object('operation',op,'values',vals)));
  end loop;
 end if;
 return jsonb_build_object('data',private.p06_page(items,r->'page',md5(jsonb_build_object('account',account,'request',r-'page'-'request_id')::text),clock_timestamp()),'primary_id',org,'subject','organizations');
end$$;
-- Each hook asserts its exact, unique anchor. Newlines keep the authorization
-- statement out of the preceding SQL comment (the P05 regression boundary).
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;replacement text;
 ops text:=$o$'report_get_v1','report_export_start_v1','report_file_get_v1','import_upload_prepare_v1','import_preview_v1','import_apply_v1','import_rows_list_v1','import_rows_process_v1','report_build_v1','operation_status_get_v1','preview_get_v1','job_status_get_v1','audit_list_v1'$o$;
 managed text:=$o$'report_export_start_v1','import_upload_prepare_v1','import_preview_v1','import_apply_v1'$o$;
begin
 old:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 access anchor mismatch';end if;
 b:=replace(b,old,old||E'\n'||' if p_operation in ('||ops||') then perform private.p06_access(p_operation,r,org,center,person,actor.id);end if;');
 old:=$a$ elsif perm_code='invite.student' then$a$;if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 permission anchor mismatch';end if;
 b:=replace(b,old,' elsif p_operation in ('||ops||') then null;'||old);
 old:=$a$elsif perm_code='management.inspect' then$a$;if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 management access anchor mismatch';end if;
 b:=replace(b,old,'elsif perm_code=''management.inspect'' and r->>''operation'' in ('||managed||') then perform private.p06_management(r,org,center,person,actor.id);'||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 management domain anchor mismatch';end if;
 b:=replace(b,old,'if p_operation=''management_state_get_v1'' and r->>''operation'' in ('||managed||') then terms:=private.p06_management(r,org,center,person,actor.id);else '||old||'end if;');
 old:=E' if mutable then\n  payload_digest:=';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 authorization preflight anchor mismatch';end if;
 replacement:=$a$
 if p_operation='report_file_get_v1' then mutable:=false;end if;
 if p_aux->>'phase'='p06_authorize_original' then
  if not private.p06_trackable(p_operation) then perform private.fail('FORBIDDEN');end if;
  -- Generic registration/cancellation gates resolve some targets in the case
  -- branch. Recovery must resolve those targets before an early authorization.
  if perm_code in ('event.register','reservation.write','person.read','org.read','schedule.read') and not org_reader and not cm then
   target:=coalesce((r->>'person_id')::uuid,(select person_id from core.reservations where org_id=org and id=(r->>'reservation_id')::uuid),(select person_id from core.event_registrations where org_id=org and id=(r->>'registration_id')::uuid));
   if target is distinct from person then perform private.fail('FORBIDDEN');end if;
  end if;
  return jsonb_build_object('_internal_authorized',true);
 end if;
 -- File preflight is live-authorized but does not create a job or a receipt.
 if p_operation='import_preview_v1' and p_aux->>'phase'='p06_import_file' then
  select * into receipt from core.operation_receipts where org_id=org and actor_account_id=actor.id and operation=p_operation and key_hash=encode(extensions.digest(r->>'operation_key','sha256'),'hex');
  if receipt.id is not null then
   if receipt.payload_hash is distinct from encode(extensions.digest((r-'operation_key'-'request_id')::text,'sha256'),'hex') then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
   if receipt.state='succeeded' then
    if receipt.result_expires_at<=clock_timestamp() then perform private.fail('OPERATION_RESULT_EXPIRED');end if;
    return jsonb_set(receipt.result,'{trace_id}',to_jsonb(trace));
   end if;
  end if;
  return private.p06_import(p_operation,r,org,center,person,actor.id,operation_id,p_ids,p_aux);
 end if;
 if p_operation='import_preview_v1' and p_aux->>'import_verified'='true' and cardinality(p_ids)<40+jsonb_array_length(p_aux->'rows') then return jsonb_build_object('_internal_retry','uuid_bank_exhausted','required_uuid_count',40+jsonb_array_length(p_aux->'rows'));end if;
 -- Check a ready file on every descriptor/download read, before any replay.
 if p_operation='report_file_get_v1' and p_aux->>'phase'='p06_download' then return private.p06_report(p_operation,r,org,center,person,actor.id,p_ids,p_aux);end if;
$a$;
 b:=replace(b,old,replacement||old);
 old:=' -- DOMAIN_CASES';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 domain anchor mismatch';end if;
 b:=replace(b,old,$a$
 when 'report_get_v1','report_export_start_v1','report_file_get_v1' then
  terms:=private.p06_report(p_operation,r,org,center,person,actor.id,p_ids,p_aux);out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';
 when 'import_upload_prepare_v1','import_preview_v1','import_apply_v1','import_rows_list_v1' then
  terms:=private.p06_import(p_operation,r,org,center,person,actor.id,operation_id,p_ids,p_aux);if terms ? '_internal_retry' then return terms;end if;out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';
 when 'operation_status_get_v1','preview_get_v1','job_status_get_v1','audit_list_v1' then
  terms:=private.p06_tracking(p_operation,r,org,center,person,actor.id,p_actor_auth_id,p_session_id,p_ids);out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';
 -- DOMAIN_CASES$a$);
 old:=E' set constraints all immediate;\n set constraints all deferred;\n return out;';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 context capture anchor mismatch';end if;
 b:=replace(b,old,' perform private.p06_capture(p_operation,r,org,actor.id,operation_id,subject,out->''data'');'||E'\n'||old);
 old:=$a$   insert into core.audit_events(id,org_id,actor_account_id,actor_person_id,action,subject_table,subject_id,reason,operation_id,diff,created_at)
    values(private.new_id(p_ids,4),org,actor.id,person,p_operation,subject,case when p_operation like 'settlement_%' then org else record_id end,r->>'reason',operation_id,audit_delta,coalesce(audit_recorded_at,now()));$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 preview audit anchor mismatch';end if;
 b:=replace(b,old,'   if p_operation<>''import_preview_v1'' then '||old||'end if;');
 old:=$a$if p_operation not in ('notification_mark_read_v1','notification_preferences_set_v1') then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 preview notification anchor mismatch';end if;
 b:=replace(b,old,$a$if p_operation not in ('notification_mark_read_v1','notification_preferences_set_v1','import_preview_v1') then$a$);
 execute b;
end$patch$;
-- Complete generic uploads in their original module; never broaden document
-- publication or private document-file access to import files.
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.p05_access(text,jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 old:=$a$ if op='document_accept_v1' and r->>'operation'='document_accept_v1' and not(r?'context') then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 generic upload access anchor mismatch';end if;
 b:=replace(b,old,$a$ if op='file_upload_complete_v1' and exists(select 1 from core.files where org_id=org and id=(r->>'file_id')::uuid and purpose='import') then perform private.p06_import_file_access(org,center,actor,account,(r->>'file_id')::uuid);return;end if;
$a$||old);execute b;
 b:=pg_get_functiondef('private.p05_documents(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:=$a$  f:=private.p05_file_access(org,center,actor,account,(r->>'file_id')::uuid);fid:=f.id;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 generic upload completion anchor mismatch';end if;
 b:=replace(b,old,$a$  if exists(select 1 from core.files where org_id=org and id=(r->>'file_id')::uuid and purpose='import') then f:=private.p06_import_file_access(org,center,actor,account,(r->>'file_id')::uuid);else f:=private.p05_file_access(org,center,actor,account,(r->>'file_id')::uuid);end if;fid:=f.id;$a$);execute b;
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:=$a$'checksum',row_record.checksum,'state',row_record.state$a$;
 if strpos(b,old)=0 then raise exception 'P06 generic upload metadata anchor missing';end if;
 b:=replace(b,old,old||$a$,'purpose',row_record.purpose$a$);execute b;
 b:=pg_get_functiondef('private.p05_management(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 old:=$a$from core.files f join private.p05_files p on p.file_id=f.id where op='file_upload_complete_v1' and f.org_id=org and f.id=(k->>'file_id')::uuid and p.account_id=account$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P06 generic upload management anchor mismatch';end if;
 b:=replace(b,old,$a$from core.files f where op='file_upload_complete_v1' and f.org_id=org and f.id=(k->>'file_id')::uuid and (exists(select 1 from private.p05_files p where p.file_id=f.id and p.account_id=account) or exists(select 1 from private.p06_files p where p.file_id=f.id and p.account_id=account))$a$);execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('report_get_v1','report.read','read',array['F28']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.report_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('report_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.report_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.report_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('report_export_start_v1','report.export','read',array['F28']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.report_export_start_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('report_export_start_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.report_export_start_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.report_export_start_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('report_file_get_v1','report.export','read',array['F28']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.report_file_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('report_file_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.report_file_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.report_file_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('import_upload_prepare_v1','import.execute','import',array['F31']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.import_upload_prepare_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('import_upload_prepare_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.import_upload_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.import_upload_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('import_preview_v1','import.execute','import',array['F31']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.import_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('import_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.import_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.import_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('import_apply_v1','import.execute','import',array['F31']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.import_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('import_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.import_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.import_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('import_rows_list_v1','import.execute','read',array['F31']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.import_rows_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('import_rows_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.import_rows_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.import_rows_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('operation_status_get_v1','account.self','exempt',array['F33']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.operation_status_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('operation_status_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.operation_status_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.operation_status_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('preview_get_v1','account.self','read',array['F33']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.preview_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('preview_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.preview_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.preview_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('job_status_get_v1','account.self','read',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.job_status_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('job_status_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.job_status_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.job_status_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('audit_list_v1','report.read','read',array['F33']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.audit_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('audit_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.audit_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.audit_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('import_rows_process_v1','system.worker','worker',array['F31']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.import_rows_process_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('import_rows_process_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.import_rows_process_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.import_rows_process_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('report_build_v1','system.worker','worker',array['F28']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.report_build_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('report_build_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.report_build_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.report_build_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
notify pgrst,'reload schema';
commit;
