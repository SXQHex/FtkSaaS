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
