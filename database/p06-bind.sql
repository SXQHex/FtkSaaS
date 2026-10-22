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
