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
