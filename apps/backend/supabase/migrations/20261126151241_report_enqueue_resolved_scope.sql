begin;

-- Both fresh exports and explicit retries persist the same queue, context and
-- outbox rows. The caller resolves the authorized centers before calling this.
create function private.p06_enqueue_report(
 r jsonb, org uuid, center uuid, actor uuid, account uuid, jid uuid,
 centers uuid[], retry_of uuid
) returns jsonb language plpgsql security invoker set search_path='' as $enqueue$
begin
 if center is null and r#>'{filters,center_ids}'='[]'::jsonb and cardinality(centers)>0 then
  r:=jsonb_set(r,'{filters,center_ids}',to_jsonb(centers));
 end if;
 if not exists(select 1 from private.p06_configuration c where c.org_id=org) then
  perform private.fail('POLICY_NOT_CONFIGURED');
 end if;
 insert into core.report_jobs(id,org_id,requester_account_id,report_kind,filters,state)
 values(jid,org,account,r->>'report',r->'filters','pending');
 insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at)
 values(jid,org,'p06.report','p06.report:'||jid::text,'pending',0,clock_timestamp());
 insert into private.p06_jobs(job_id,org_id,account_id,person_id,center_id,operation,request,phase,report_retry_of)
 values(jid,org,account,actor,center,'report_build_v1',r,'report',retry_of);
 return jsonb_build_object('data',jsonb_build_object('job_id',jid,'state','pending'),'primary_id',jid,'subject','report_jobs');
end
$enqueue$;

revoke all on function private.p06_enqueue_report(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],uuid) from public,anon,authenticated;
grant execute on function private.p06_enqueue_report(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],uuid) to service_role;

do $migration$
declare
 report_body text:=pg_get_functiondef('private.p06_report(text,jsonb,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 dispatcher text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 first_export integer:=strpos(report_body,E'\n elsif op=''report_export_start_v1'' then\n');
 next_file integer:=strpos(report_body,E'\n elsif op=''report_file_get_v1'' then\n');
 access_call text:=$access$ if p_operation in ('report_get_v1','report_export_start_v1','report_file_get_v1','import_upload_prepare_v1','import_preview_v1','import_apply_v1','import_rows_list_v1','import_rows_process_v1','report_build_v1','operation_status_get_v1','preview_get_v1','job_status_get_v1','audit_list_v1') then perform private.p06_access(p_operation,r,org,center,person,actor.id);end if;$access$;
 report_case text:=$case$ when 'report_get_v1','report_export_start_v1','report_file_get_v1' then
  terms:=private.p06_report(p_operation,r,org,center,person,actor.id,p_ids,p_aux);out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';$case$;
 case_start text:=E'\n case p_operation\n';
 locals text:=E'\ndeclare\n claims jsonb';
begin
 if first_export<=0 or next_file<=first_export
  or cardinality(string_to_array(report_body,E'\n elsif op=''report_export_start_v1'' then\n'))<>2
  or cardinality(string_to_array(report_body,E'\n elsif op=''report_file_get_v1'' then\n'))<>2
  or cardinality(string_to_array(dispatcher,access_call))<>2
  or cardinality(string_to_array(dispatcher,report_case))<>2
  or cardinality(string_to_array(dispatcher,case_start))<>2
  or cardinality(string_to_array(dispatcher,locals))<>2 then
  raise exception 'Report enqueue source changed';
 end if;

 -- Keep the retry source lock, current authorization and original filters.
 report_body:=left(report_body,first_export-1)||$delegate$
 elsif op='report_export_start_v1' then
  return private.p06_enqueue_report(r,org,center,actor,account,jid,centers,source.job_id);$delegate$
  ||substr(report_body,next_file);
 execute report_body;

 -- Resolve scope at the existing pre-replay access gate. Only this local value
 -- can supply the enqueue path. Retry and original-operation authorization keep
 -- their existing checks.
 dispatcher:=replace(dispatcher,locals,E'\ndeclare\n report_centers uuid[];\n claims jsonb');
 dispatcher:=replace(dispatcher,access_call,$resolve$ if p_operation='report_export_start_v1' and not (r ? 'retry_job_id') then
  report_centers:=private.p06_report_scope(r,org,center,person,true);
$resolve$||replace(access_call,' if p_operation',' elsif p_operation'));

 -- Enter the report branch before planning unrelated operation comparisons.
 dispatcher:=replace(dispatcher,report_case,replace(report_case,'''report_export_start_v1'',',''));
 dispatcher:=replace(dispatcher,case_start,case_start||$route$ when 'report_export_start_v1' then
  if report_centers is not null then
   terms:=private.p06_enqueue_report(r,org,center,person,actor.id,private.new_id(p_ids,2),report_centers,null);
  else
   terms:=private.p06_report(p_operation,r,org,center,person,actor.id,p_ids,p_aux);
  end if;
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';
$route$);
 execute dispatcher;
end
$migration$;

commit;
