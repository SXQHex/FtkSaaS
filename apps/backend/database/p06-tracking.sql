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
