begin;

create function private.audit_center_csv(items jsonb,p_org uuid,p_center uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare csv text;byte_limit bigint;
begin
 select max_export_bytes into byte_limit from private.p06_configuration where org_id=p_org;
 if not found then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 select 'id,created_at,module,action,actor_display,subject_type,subject_id,subject_title,result,operation_state'||E'\r\n'||
  coalesce(string_agg(concat_ws(',',
   private.p06_csv_cell(x->>'id'),private.p06_csv_cell(x->>'created_at'),private.p06_csv_cell(x->>'module'),
   private.p06_csv_cell(x->>'action'),private.p06_csv_cell(x->>'actor_display'),
   private.p06_csv_cell(x#>>'{subject,type}'),private.p06_csv_cell(x#>>'{subject,id}'),
   private.p06_csv_cell(x->>'subject_title'),private.p06_csv_cell(x->>'result'),
   private.p06_csv_cell(x->>'operation_state')),E'\r\n' order by n)||E'\r\n','') into csv
 from jsonb_array_elements(items) with ordinality visible(x,n);
 if octet_length(csv)>byte_limit then perform private.fail('PLAN_LIMIT_REACHED');end if;
 return jsonb_build_object('filename','audit-'||p_center||'.csv','mime','text/csv','csv',csv,
  'row_count',jsonb_array_length(items),'as_of',statement_timestamp());
end$$;

create function private.tracking_job_result(c private.p06_jobs,queue_state text,actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare retry_mode text:='none';summary jsonb;applied bigint;excluded bigint;unprocessed bigint:=0;
begin
 if queue_state='retry_wait' then
  retry_mode:='automatic';
 elsif queue_state='failed' and c.operation='report_build_v1' and not exists(
  select 1 from private.p06_jobs where report_retry_of=c.job_id
 ) then
  begin
   perform private.p06_report_retry_source(c.job_id,c.org_id,c.center_id,actor,c.account_id);
   retry_mode:='report_export';
  exception when sqlstate 'P0001' then
   if sqlerrm not in ('NOT_FOUND','FORBIDDEN','OPERATION_IN_PROGRESS','VERSION_CONFLICT') then raise;end if;
  end;
 end if;
 if queue_state in ('succeeded','failed') and c.operation='import_rows_process_v1' and c.phase='apply' then
  summary:=private.p06_import_apply_result(c.org_id,c.job_id,actor,c.account_id,false);
  if summary is not null then
   applied:=(summary->>'applied_rows')::bigint+(summary->>'replayed_rows')::bigint;
   excluded:=(summary->>'skipped_rows')::bigint+(summary->>'failed_rows')::bigint;
   if queue_state='failed' then
    select count(*) into unprocessed from core.import_rows x
    where x.org_id=c.org_id and x.job_id=c.job_id and x.state in ('pending','valid')
     and (c.selected_row_numbers is null or x.row_number=any(c.selected_row_numbers));
   end if;
   summary:=summary||jsonb_build_object('skipped_rows',(summary->>'skipped_rows')::bigint-unprocessed,
    'unprocessed_rows',unprocessed,'outcome',case
    when applied=0 and (excluded>0 or queue_state='failed') then 'not_applied'
    when excluded>0 then 'partial' else 'complete' end);
  end if;
 end if;
 return jsonb_strip_nulls(jsonb_build_object('retry_mode',retry_mode,'import_result',summary));
end$$;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.audit_discovery(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:=' perform private.assert_center(p_org,p_center);';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Audit export permission drift';end if;
 body:=replace(body,anchor,anchor||E'\n'||$a$
 if r->'export_csv'='true'::jsonb and not private.is_org_reader(p_org,p_actor)
  and not private.is_manager(p_org,p_actor,p_center) and not private.p06_granted(p_org,p_actor,p_center,'report.export')
 then perform private.fail('FORBIDDEN');end if;
$a$);
 anchor:=$a$ return private.p06_page(items,r->'page',$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Audit export projection drift';end if;
 execute replace(body,anchor,$a$ if r->'export_csv'='true'::jsonb then return private.audit_center_csv(items,p_org,p_center);end if;
$a$||anchor);

 body:=pg_get_functiondef('private.tracking_directory(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 anchor:=$a$'result_reference',c.result_reference)$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Tracking result projection drift';end if;
 execute replace(body,anchor,anchor||' || private.tracking_job_result(c,q.state,p_actor)');

 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$ elsif p_operation='tracking_directory_get_v1' then null;$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Audit export dispatch permission drift';end if;
 body:=replace(body,anchor,$a$ elsif p_operation in ('tracking_directory_get_v1','audit_center_export_v1') then null;$a$);
 anchor:=' -- DOMAIN_CASES';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Audit export dispatch drift';end if;
 execute replace(body,anchor,$a$
 when 'audit_center_export_v1' then
  out:=private.audit_discovery(r||'{"export_csv":true}'::jsonb,org,center,person,actor.id);
$a$||anchor);
end$patch$;

insert into private.runtime_operations(name,permission,billing_class,features) values('audit_center_export_v1','report.export','read',array['F33']::text[]);
create function api_v1.audit_center_export_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$
 select private.execute_operation('audit_center_export_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)
$$;
revoke all on function private.audit_center_csv(jsonb,uuid,uuid),private.tracking_job_result(private.p06_jobs,text,uuid),
 api_v1.audit_center_export_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.audit_center_csv(jsonb,uuid,uuid),private.tracking_job_result(private.p06_jobs,text,uuid),
 api_v1.audit_center_export_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
commit;
