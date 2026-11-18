begin;

alter table private.personal_calendar_links drop constraint personal_calendar_links_kinds_check;
alter table private.personal_calendar_links
 add column studio_center_id uuid,
 add foreign key(org_id,studio_center_id) references core.centers(org_id,id),
 add constraint personal_calendar_links_kinds_check check (
  (studio_center_id is not null and kinds=array['studio_program']) or
  (studio_center_id is null and cardinality(kinds) between 1 and 2 and kinds<@array['lessons','duties']::text[]
   and array_position(kinds,null) is null and (cardinality(kinds)=1 or kinds[1]<>kinds[2]))
 );

create function private.studio_calendar_authorize(org uuid,person uuid,center uuid) returns void
language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.center_accessible(org,center) or not private.is_manager(org,person,center) then
  perform private.fail('NOT_FOUND');
 end if;
end$$;

create or replace function private.personal_calendar_view(link private.personal_calendar_links) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',($1).id,'org_id',($1).org_id,'kinds',to_jsonb(($1).kinds),'state',($1).state,'version',($1).version,'created_at',($1).created_at)
 || case when ($1).studio_center_id is null then '{}'::jsonb else jsonb_build_object('center_id',($1).studio_center_id) end
$$;

create function private.p06_import_apply_result(org uuid,job uuid,actor uuid,account uuid,download boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;csv text;
begin
 -- The same job ID is reused for preview and apply. A successful preview has no final result.
 if not exists(
  select 1 from core.import_jobs i
  join private.p06_jobs p on p.org_id=i.org_id and p.job_id=i.id and p.account_id=account
  join core.outbox_jobs q on q.org_id=i.org_id and q.id=i.id
  where i.org_id=org and i.id=job and i.requester_account_id=account
   and p.phase='apply' and i.state in ('succeeded','failed') and q.state=i.state
 ) then
  if download then perform private.fail('NOT_FOUND');end if;
  return null;
 end if;
 if download and not exists(
  select 1 from core.import_jobs i
  join core.files f on f.org_id=i.org_id and f.id=i.file_id and f.center_id=i.center_id
  join private.p06_files p on p.file_id=f.id and p.account_id=account
  where i.org_id=org and i.id=job and f.owner_person_id=actor and f.purpose='import' and f.state='ready'
   and (f.expires_at is null or f.expires_at>statement_timestamp())
 ) then perform private.fail('NOT_FOUND');end if;

 with outcomes as (
  select x.row_number,x.error_code,
   case when x.state='applied' and receipt.business_reference=job then 'applied'
        when x.state='applied' then 'replayed'
        when x.state='failed' then 'failed'
        else 'skipped' end as outcome
  from core.import_rows x
  left join private.p06_sources s on x.state='applied' and s.org_id=x.org_id and s.source_namespace=x.source_namespace
   and s.source_key=x.source_key and s.center_id=x.center_id
  left join core.operation_receipts receipt on receipt.org_id=s.org_id and receipt.id=s.operation_id
  where x.org_id=org and x.job_id=job
 )
 select jsonb_build_object('total_rows',count(*),'applied_rows',count(*) filter(where outcome='applied'),
  'skipped_rows',count(*) filter(where outcome='skipped'),'failed_rows',count(*) filter(where outcome='failed'),
  'replayed_rows',count(*) filter(where outcome='replayed')),
  string_agg(row_number::text||','||outcome||','||private.p06_csv_cell(error_code),E'\r\n' order by row_number)
   filter(where download and outcome<>'applied')
 into result,csv from outcomes;

 if download then
  csv:='row_number,outcome,error_code'||E'\r\n'||coalesce(csv||E'\r\n','');
  return jsonb_build_object('_internal_download',jsonb_build_object(
   'body',encode(convert_to(csv,'UTF8'),'base64'),'mime','text/csv','filename','import-skipped-'||job||'.csv'));
 end if;
 return result;
end$$;

alter table private.p06_jobs add column report_retry_of uuid references core.report_jobs(id);
create unique index p06_single_report_retry on private.p06_jobs(report_retry_of) where report_retry_of is not null;

create function private.p06_report_retry_source(job uuid,org uuid,center uuid,actor uuid,account uuid) returns private.p06_jobs
language plpgsql stable security invoker set search_path='' as $$
declare source private.p06_jobs;report_state text;queue_state text;
begin
 select p.* into source from private.p06_jobs p
 where p.job_id=job and p.org_id=org and p.account_id=account and p.operation='report_build_v1'
  and (center is null or p.center_id=center);
 if not found then perform private.fail('NOT_FOUND');end if;
 perform private.p06_report_scope(source.request,org,source.center_id,actor,true);
 select j.state,q.state into report_state,queue_state
 from core.report_jobs j join core.outbox_jobs q on q.org_id=j.org_id and q.id=j.id
 where j.org_id=org and j.id=job and j.requester_account_id=account;
 if not found then perform private.fail('NOT_FOUND');end if;
 if report_state in ('pending','running','retry_wait') or queue_state in ('pending','running','retry_wait') then
  perform private.fail('OPERATION_IN_PROGRESS');
 end if;
 if report_state<>'failed' or queue_state<>'failed'
  or (source.center_id is null and coalesce(jsonb_array_length(source.request#>'{filters,center_ids}'),0)=0) then
  perform private.fail('VERSION_CONFLICT');
 end if;
 return source;
end$$;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.personal_calendar_authorize(text,jsonb,uuid,jsonb)'::regprocedure);
 anchor:='org uuid;previous uuid;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Studio calendar scope declaration drift';end if;
 body:=replace(body,anchor,anchor||'person uuid;requested_center uuid;');
 anchor:='  perform private.personal_calendar_person(org,account);';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Studio calendar scope check drift';end if;
 execute replace(body,anchor,$a$  person:=private.personal_calendar_person(org,account);
  requested_center:=(r#>>'{organization_scope,center_id}')::uuid;
  if op='calendar_link_create_v1' then
   if (r->'kinds'='["studio_program"]'::jsonb) is distinct from (requested_center is not null)
    or (r->'kinds' ? 'studio_program' and r->'kinds'<>'["studio_program"]'::jsonb) then perform private.fail('VALIDATION_FAILED');end if;
  elsif requested_center is distinct from link.studio_center_id then perform private.fail('NOT_FOUND');end if;
  if requested_center is not null then perform private.studio_calendar_authorize(org,person,requested_center);end if;$a$);

 body:=pg_get_functiondef('private.personal_calendar_execute(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$  select coalesce(jsonb_agg(private.personal_calendar_view(l) order by l.created_at,l.id),'[]') into items from private.personal_calendar_links l where l.account_id=account;
  return private.p06_page(items,r->'page','personal-calendar:'||account,clock_timestamp());$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Studio calendar list scope drift';end if;
 body:=replace(body,anchor,$a$  select coalesce(jsonb_agg(private.personal_calendar_view(l) order by l.created_at,l.id),'[]') into items
  from private.personal_calendar_links l where l.account_id=account
   and (l.studio_center_id is null and not (r ? 'studio_program_scope') or
    (l.org_id=(r#>>'{studio_program_scope,org_id}')::uuid and l.studio_center_id=(r#>>'{studio_program_scope,center_id}')::uuid));
  return private.p06_page(items,r->'page','personal-calendar:'||account||coalesce(':'||(r->'studio_program_scope')::text,''),clock_timestamp());$a$);
 anchor:=$a$insert into private.personal_calendar_links(id,account_id,org_id,kinds,token_hash) values(private.new_id(ids,11),account,org,array(select jsonb_array_elements_text(r->'kinds')),aux->>'calendar_token_hash')$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Studio calendar link insert drift';end if;
 execute replace(body,anchor,$a$insert into private.personal_calendar_links(id,account_id,org_id,kinds,token_hash,studio_center_id)
  values(private.new_id(ids,11),account,org,array(select jsonb_array_elements_text(r->'kinds')),aux->>'calendar_token_hash',(r#>>'{organization_scope,center_id}')::uuid)$a$);

 body:=pg_get_functiondef('private.personal_calendar_feed(jsonb,uuid[],jsonb)'::regprocedure);
 anchor:=' person:=private.personal_calendar_person(link.org_id,link.account_id,false);';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Studio calendar feed authorization drift';end if;
 body:=replace(body,anchor,anchor||$a$
 if link.studio_center_id is not null then perform private.studio_calendar_authorize(link.org_id,person,link.studio_center_id);end if;$a$);
 anchor:=$a$ and (('lessons'=any(link.kinds)$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Studio calendar feed selection drift';end if;
 execute replace(body,anchor,$a$ and ((s.center_id=link.studio_center_id and s.starts_at>stamp)
 or ('lessons'=any(link.kinds)$a$);

 body:=pg_get_functiondef('private.p06_import(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 -- Both apply and rows-list set the primary ID. Only the paged read gets a summary.
 anchor:=$a$::text),clock_timestamp());pid:=j.id;$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import result projection drift';end if;
 execute replace(body,anchor,anchor||$a$
  if r->>'include_apply_summary'='true' then
   data:=data||jsonb_strip_nulls(jsonb_build_object('apply_summary',private.p06_import_apply_result(org,j.id,actor,account,false)));
  end if;$a$);

 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$ if p_operation='report_file_get_v1' and p_aux->>'phase'='p06_download' then return private.p06_report(p_operation,r,org,center,person,actor.id,p_ids,p_aux);end if;$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import CSV preflight drift';end if;
 execute replace(body,anchor,anchor||$a$
 if p_operation='import_rows_list_v1' and p_aux->>'phase'='p06_import_skipped_download' then
  return private.p06_import_apply_result(org,(r->>'job_id')::uuid,person,actor.id,true);
 end if;$a$);

 body:=pg_get_functiondef('private.p06_access(text,jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:=$a$ if op in ('report_get_v1','report_export_start_v1') then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Report retry permission drift';end if;
 execute replace(body,anchor,$a$ if op='report_export_start_v1' and r ? 'retry_job_id' then
  perform private.p06_report_retry_source((r->>'retry_job_id')::uuid,org,center,actor,account);
 elsif op in ('report_get_v1','report_export_start_v1') then$a$);

 body:=pg_get_functiondef('private.p06_report(text,jsonb,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:='declare centers uuid[];';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Report retry declaration drift';end if;
 body:=replace(body,anchor,anchor||'source private.p06_jobs;');
 anchor:=$a$ if op in ('report_get_v1','report_export_start_v1') then centers:=private.p06_report_scope$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Report retry command drift';end if;
 body:=replace(body,anchor,$a$ if op='report_export_start_v1' and r ? 'retry_job_id' then
  source:=private.p06_report_retry_source((r->>'retry_job_id')::uuid,org,center,actor,account);
  perform 1 from core.report_jobs where id=source.job_id for update;
  if exists(select 1 from private.p06_jobs where report_retry_of=source.job_id) then perform private.fail('VERSION_CONFLICT');end if;
  center:=source.center_id;
  r:=source.request||jsonb_build_object('request_id',r->'request_id','operation_key',r->'operation_key');
 end if;
$a$||anchor);
 anchor:=$a$ elsif op='report_export_start_v1' then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Report export captured scope drift';end if;
 body:=replace(body,anchor,anchor||$a$
  -- Persist the resolved center set for otherwise organization-wide exports.
  if center is null and r#>'{filters,center_ids}'='[]'::jsonb and cardinality(centers)>0 then
   r:=jsonb_set(r,'{filters,center_ids}',to_jsonb(centers));
  end if;$a$);
 anchor:=$a$insert into private.p06_jobs(job_id,org_id,account_id,person_id,center_id,operation,request,phase) values(jid,org,account,actor,center,'report_build_v1',r,'report');$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Report retry job insert drift';end if;
 execute replace(body,anchor,$a$insert into private.p06_jobs(job_id,org_id,account_id,person_id,center_id,operation,request,phase,report_retry_of)
  values(jid,org,account,actor,center,'report_build_v1',r,'report',source.job_id);$a$);
end$patch$;

revoke all on function private.studio_calendar_authorize(uuid,uuid,uuid),private.p06_import_apply_result(uuid,uuid,uuid,uuid,boolean),
 private.p06_report_retry_source(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.studio_calendar_authorize(uuid,uuid,uuid),private.p06_import_apply_result(uuid,uuid,uuid,uuid,boolean),
 private.p06_report_retry_source(uuid,uuid,uuid,uuid,uuid) to service_role;
commit;
