-- P10: existing import jobs, explicit CRM kind, one application history.
begin;
alter table core.public_applications add column if not exists import_row_id uuid;
alter table core.public_applications add constraint crm_application_import_row foreign key(org_id,import_row_id) references core.import_rows(org_id,id);
alter table core.public_applications drop constraint crm_application_origin;
alter table core.public_applications add constraint crm_application_origin check(num_nonnulls(publication_id,crm_form_id,import_row_id)=1);
alter table core.public_applications drop constraint crm_application_verification;
alter table core.public_applications add constraint crm_application_verification check(
 (import_row_id is not null and provider_lead_id is null and provider_payload_hash is null and bot_verified_at is null) or
 (import_row_id is null and ((provider_lead_id is null and provider_payload_hash is null and bot_verified_at is not null) or
 (provider_lead_id is not null and octet_length(provider_lead_id) between 1 and 2048 and provider_payload_hash ~ '^[a-f0-9]{64}$' and provider_payload_hash is not null and crm_form_id is not null and publication_id is null and bot_verified_at is null))));
create unique index crm_import_application_row on core.public_applications(import_row_id) where import_row_id is not null;
alter table private.p06_sources alter column person_id drop not null;
alter table private.p06_sources add column import_kind text not null default 'students';
alter table private.p06_sources add column application_id uuid;
alter table private.p06_sources add constraint p10_source_application foreign key(org_id,application_id) references core.public_applications(org_id,id);
alter table private.p06_sources add constraint p10_source_kind check((import_kind='students' and person_id is not null and application_id is null) or (import_kind='crm_applications' and person_id is null and application_id is not null));
alter table private.p06_jobs add column selected_row_numbers int[];
alter table core.import_rows add column if not exists field_errors text[] not null default '{}';

create function private.crm_import_access(org uuid,center uuid,actor uuid,writing boolean default true) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 perform private.p06_import_access(org,center,actor,writing);perform private.require_feature(org,'F21');
 perform private.crm_application_access('{}',org,center,actor);
end$$;
create function private.crm_import_body(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(payload) is distinct from 'object' or jsonb_typeof(payload->'source_key') is distinct from 'string' or length(btrim(payload->>'source_key')) not between 1 and 500 then perform private.fail('VALIDATION_FAILED');end if;
 if payload ? 'source_url' and (jsonb_typeof(payload->'source_url') is distinct from 'string' or length(payload->>'source_url')>2048 or payload->>'source_url' !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$') then perform private.fail('VALIDATION_FAILED');end if;
 return private.crm_validate_intake(payload-'source_key'-'source_url');
end$$;
create function private.crm_import_source(row_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('channel','legacy_import','form_key',j.source_namespace,'source_namespace',j.source_namespace,'source_key',r.source_key,'source_url',r.payload->'source_url','file_checksum',j.file_checksum,'import_job_id',j.id,'row_number',r.row_number)
 from core.import_rows r join core.import_jobs j on j.org_id=r.org_id and j.id=r.job_id where r.id=row_id
$$;
create function private.crm_import_row_check(org uuid,center uuid,payload jsonb,namespace text) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare prior private.p06_sources;
begin
 perform private.crm_import_body(payload);
 select * into prior from private.p06_sources where org_id=org and source_namespace=namespace and source_key=payload->>'source_key';
 if found and (prior.import_kind<>'crm_applications' or prior.center_id<>center or prior.payload_hash<>encode(extensions.digest(payload::text,'sha256'),'hex')) then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
end$$;
create function private.crm_import_row_apply(row_id uuid,operation uuid,ids uuid[],offset_i int) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare x core.import_rows;j core.import_jobs;prior private.p06_sources;body jsonb;source jsonb;app uuid:=private.new_id(ids,offset_i);refs jsonb;
begin
 select * into x from core.import_rows where id=row_id for update;
 select * into j from core.import_jobs where org_id=x.org_id and id=x.job_id;
 if x.id is null or j.mapping->>'kind' is distinct from 'crm_applications' then perform private.fail('FORBIDDEN');end if;
 perform private.crm_import_row_check(x.org_id,x.center_id,x.payload,x.source_namespace);
 select * into prior from private.p06_sources where org_id=x.org_id and source_namespace=x.source_namespace and source_key=x.source_key;
 if found then return prior.created_references;end if;
 body:=private.crm_import_body(x.payload);source:=private.crm_import_source(x.id);
 body:=jsonb_set(body,'{consents}',coalesce((select jsonb_agg(p||jsonb_build_object('source',source,'received_at',clock_timestamp())) from jsonb_array_elements(body->'consents') p),'[]'::jsonb));
 insert into core.public_applications(id,org_id,center_id,import_row_id,target_contact,target_hash,state,bot_verified_at,request_reference,source_snapshot,intake)
 values(app,x.org_id,x.center_id,x.id,body->>'phone',encode(extensions.digest(x.org_id::text||':'||encode(extensions.digest(body->>'phone','sha256'),'hex'),'sha256'),'hex'),'pending',null,x.id,source,body);
 refs:=jsonb_build_array(jsonb_build_object('type','public_applications','id',app));
 insert into private.p06_sources(org_id,source_namespace,source_key,center_id,payload_hash,person_id,created_references,operation_id,import_kind,application_id)
 values(x.org_id,x.source_namespace,x.source_key,x.center_id,encode(extensions.digest(x.payload::text,'sha256'),'hex'),null,refs,operation,'crm_applications',app);
 return refs;
end$$;
create function private.crm_import_row_view(row_id uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare x core.import_rows;j core.import_jobs;body jsonb;
begin
 select * into x from core.import_rows where id=row_id;select * into j from core.import_jobs where id=x.job_id;
 if j.mapping->>'kind' is distinct from 'crm_applications' or x.state not in ('valid','applied') then return null;end if;
 perform private.crm_import_access(x.org_id,x.center_id,actor,false);body:=private.crm_import_body(x.payload);
 return jsonb_build_object('intake',body,'source',private.crm_import_source(x.id))||private.crm_phone_matches(x.org_id,x.center_id,actor,body->>'phone');
end$$;
-- Every patch is source-anchored; old student code stays in the else branch.
do $patch$
declare b text;anchor text;
begin
 b:=pg_get_functiondef('private.p06_import_dependencies(uuid)'::regprocedure);
 anchor:=$p10$'mapping',j.mapping,'namespace',j.source_namespace,$p10$;if strpos(b,anchor)=0 then raise exception 'P10 selection dependency anchor';end if;
 execute replace(b,anchor,anchor||$p10$'selected_row_numbers',(select selected_row_numbers from private.p06_jobs where job_id=j.id),$p10$);
 b:=pg_get_functiondef('private.p06_import_row_apply(uuid,uuid,uuid[],int)'::regprocedure);
 anchor:='select * into x from core.import_rows where id=row_id for update;';if strpos(b,anchor)=0 then raise exception 'P10 student row anchor';end if;
 b:=replace(b,anchor,anchor||E'\n'||$a$ if exists(select 1 from core.import_jobs where id=x.job_id and mapping->>'kind'='crm_applications') then return private.crm_import_row_apply(row_id,operation,ids,offset_i);end if;$a$);
 anchor:='insert into private.p06_sources values(';if strpos(b,anchor)=0 then raise exception 'P10 positional source anchor';end if;
 b:=replace(b,anchor,'insert into private.p06_sources(org_id,source_namespace,source_key,center_id,payload_hash,person_id,created_references,operation_id) values(');execute b;
 b:=pg_get_functiondef('private.p06_import_row_check(uuid,uuid,jsonb,text)'::regprocedure);
 anchor:='if prior.org_id is not null then';if strpos(b,anchor)=0 then raise exception 'P10 student identity anchor';end if;
 execute replace(b,anchor,anchor||' if prior.import_kind<>''students'' then perform private.fail(''IDEMPOTENCY_PAYLOAD_MISMATCH'');end if;');
 b:=pg_get_functiondef('private.p06_job_authorize(private.p06_jobs)'::regprocedure);
 anchor:=$p10$else perform private.p06_import_access(j.org_id,j.center_id,actor);end if;$p10$;if strpos(b,anchor)=0 then raise exception 'P10 worker permission anchor';end if;
 execute replace(b,anchor,$p10$else if j.request#>>'{mapping,kind}'='crm_applications' then perform private.crm_import_access(j.org_id,j.center_id,actor);else perform private.p06_import_access(j.org_id,j.center_id,actor);end if;end if;$p10$);
 b:=pg_get_functiondef('private.p06_access(text,jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:=$p10$elsif op in ('import_upload_prepare_v1','import_preview_v1') then perform private.p06_import_access(org,center,actor);$p10$;if strpos(b,anchor)=0 then raise exception 'P10 preview permission anchor';end if;
 b:=replace(b,anchor,anchor||$p10$ if r#>>'{mapping,kind}'='crm_applications' then perform private.crm_import_access(org,center,actor);end if;$p10$);
 anchor:=$p10$perform private.p06_import_access(org,(ctx.request->>'center_id')::uuid,actor);$p10$;if strpos(b,anchor)=0 then raise exception 'P10 apply permission anchor';end if;
 b:=replace(b,anchor,anchor||$p10$ if ctx.request#>>'{mapping,kind}'='crm_applications' then perform private.crm_import_access(org,(ctx.request->>'center_id')::uuid,actor);end if;$p10$);
 anchor:='else perform private.p06_import_access(org,j.center_id,actor,false);end if;';if strpos(b,anchor)=0 then raise exception 'P10 read permission anchor';end if;
 b:=replace(b,anchor,anchor||$p10$ if j.request#>>'{mapping,kind}'='crm_applications' then perform private.crm_import_access(org,j.center_id,actor,false);end if;$p10$);execute b;
 b:=pg_get_functiondef('private.p06_import(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$p10$  update core.previews set state='applied',version=version+1 where id=p.id;$p10$;if strpos(b,anchor)=0 then raise exception 'P10 selection anchor';end if;
 b:=replace(b,anchor,$a$
  if j.mapping->>'kind'='crm_applications' then
   perform private.crm_import_access(org,j.center_id,actor);
   if jsonb_typeof(r->'selected_row_numbers') is distinct from 'array' or jsonb_array_length(r->'selected_row_numbers') not between 1 and 5000 or exists(select 1 from jsonb_array_elements(r->'selected_row_numbers') v where jsonb_typeof(v)<>'number' or v::text !~ '^[1-9][0-9]{0,3}$' or (v::text)::int>5000) then perform private.fail('VALIDATION_FAILED');end if;
   if r->'selected_row_numbers' is distinct from (select jsonb_agg(n order by n) from (select distinct value::int n from jsonb_array_elements_text(r->'selected_row_numbers')) s) or exists(select 1 from jsonb_array_elements_text(r->'selected_row_numbers') n where not exists(select 1 from core.import_rows where job_id=j.id and row_number=n::bigint and state='valid')) then perform private.fail('VALIDATION_FAILED');end if;
   update private.p06_jobs set selected_row_numbers=array(select value::int from jsonb_array_elements_text(r->'selected_row_numbers')) where job_id=j.id;
  elsif r ? 'selected_row_numbers' then perform private.fail('VALIDATION_FAILED');end if;
$a$||anchor);
 anchor:=$p10$idx:=idx+1;
  end loop;
  insert into core.outbox_jobs$p10$;if strpos(b,anchor)=0 then raise exception 'P10 parser error fields anchor';end if;
 b:=replace(b,anchor,$p10$idx:=idx+1;
   if r#>>'{mapping,kind}'='crm_applications' then update core.import_rows set field_errors=array(select value from jsonb_array_elements_text(coalesce(item->'field_errors','[]'::jsonb))) where job_id=pid and row_number=(item->>'row_number')::bigint;end if;
  end loop;
  insert into core.outbox_jobs$p10$);
 anchor:=$p10$'created_references',coalesce(z.created_references,'[]'::jsonb)) order by x.row_number)$p10$;if strpos(b,anchor)=0 then raise exception 'P10 preview row view anchor';end if;
 b:=replace(b,anchor,$p10$'created_references',coalesce(z.created_references,'[]'::jsonb))||case when j.mapping->>'kind'='crm_applications' then jsonb_build_object('application',private.crm_import_row_view(x.id,actor),'source_key',left(x.source_key,500),'field_errors',to_jsonb(x.field_errors)) else '{}'::jsonb end order by x.row_number)$p10$);execute b;
 b:=pg_get_functiondef('private.p06_import(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$p10$pid:=j.id;data:=jsonb_build_object('job_id',pid,'state','pending');$p10$;if strpos(b,anchor)=0 then raise exception 'P10 apply result anchor';end if;
 execute replace(b,anchor,anchor||$p10$if j.mapping->>'kind'='crm_applications' then data:=data||jsonb_build_object('selected_rows_count',jsonb_array_length(r->'selected_row_numbers'));update private.p06_jobs set total_count=cardinality(selected_row_numbers) where job_id=j.id;end if;$p10$);
 b:=pg_get_functiondef('private.p06_worker_execute(text,jsonb,uuid[])'::regprocedure);
 anchor:=$p10$   for x in select * from core.import_rows where org_id=org and job_id=j.id and state=case when c.phase='preview' then 'pending' else 'valid' end order by row_number limit 25 for update loop$p10$;
 if strpos(b,anchor)=0 then raise exception 'P10 worker batch anchor';end if;
 b:=replace(b,anchor,$a$
   if c.phase='apply' and ij.mapping->>'kind'='crm_applications' then
    needed_ids:=101+cardinality(c.selected_row_numbers);
    if needed_ids>cardinality(ids) then raise exception using errcode='54000',message='UUID_BANK_EXHAUSTED',detail=needed_ids::text;end if;
   end if;
   for x in select * from core.import_rows where org_id=org and job_id=j.id and state=case when c.phase='preview' then 'pending' else 'valid' end and (c.phase<>'apply' or c.selected_row_numbers is null or row_number=any(c.selected_row_numbers)) order by row_number limit case when c.phase='apply' and ij.mapping->>'kind'='crm_applications' then 5000 else 25 end for update loop$a$);
 anchor:=$p10$needed_ids:=case when c.phase='apply' then private.p06_opening_id_count(org,x.payload) else 1 end;$p10$;if strpos(b,anchor)=0 then raise exception 'P10 UUID bank anchor';end if;
 b:=replace(b,anchor,$p10$needed_ids:=case when c.phase='apply' and coalesce(ij.mapping->>'kind','students')<>'crm_applications' then private.p06_opening_id_count(org,x.payload) else 1 end;$p10$);
 anchor:='perform private.p06_import_row_check(org,c.center_id,x.payload,ij.source_namespace);';if strpos(b,anchor)=0 then raise exception 'P10 worker row check anchor';end if;
 b:=replace(b,anchor,$p10$if ij.mapping->>'kind'='crm_applications' then perform private.crm_import_row_check(org,c.center_id,x.payload,ij.source_namespace);else $p10$||anchor||'end if;');
 anchor:=$p10$     if SQLSTATE<>'P0001' then raise;end if;$p10$;if strpos(b,anchor)=0 then raise exception 'P10 atomic apply anchor';end if;
 b:=replace(b,anchor,$p10$     if c.phase='apply' and ij.mapping->>'kind'='crm_applications' then raise;end if;$p10$||E'\n'||anchor);
 anchor:='from core.import_rows where job_id=j.id and org_id=org;phase_done:=progress=total;';if strpos(b,anchor)=0 then raise exception 'P10 selected progress anchor';end if;
 b:=replace(b,anchor,$p10$from core.import_rows where job_id=j.id and org_id=org and (c.phase<>'apply' or c.selected_row_numbers is null or row_number=any(c.selected_row_numbers));phase_done:=progress=total;$p10$);
 anchor:=$p10$  job_state:=case when phase_done then 'succeeded' else 'pending' end;$p10$;if strpos(b,anchor)=0 then raise exception 'P10 lease completion anchor';end if;
 b:=replace(b,anchor,$p10$  if op='import_rows_process_v1' and c.phase='apply' and ij.mapping->>'kind'='crm_applications' and j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;$p10$||E'\n'||anchor);execute b;
 b:=pg_get_functiondef('private.p06_worker_execute(text,jsonb,uuid[])'::regprocedure);
 anchor:=$p10$update core.import_rows set state=case when c.phase='preview' then 'invalid' else 'failed' end,error_code=code,version=version+1 where id=x.id;$p10$;if strpos(b,anchor)=0 then raise exception 'P10 native row error fields anchor';end if;
 execute replace(b,anchor,$p10$update core.import_rows set state=case when c.phase='preview' then 'invalid' else 'failed' end,error_code=code,field_errors=case when ij.mapping->>'kind'='crm_applications' then array[case when code='IDEMPOTENCY_PAYLOAD_MISMATCH' then 'source_key' else 'row' end] else field_errors end,version=version+1 where id=x.id;$p10$);
 b:=pg_get_functiondef('private.p04_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 anchor:='and crm_form_id is not null) then return private.crm_application_review';if strpos(b,anchor)=0 then raise exception 'P10 CRM review anchor';end if;
 execute replace(b,anchor,'and (crm_form_id is not null or import_row_id is not null)) then return private.crm_application_review');
 b:=pg_get_functiondef('private.crm_application_page(jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor:=$p10$jsonb_build_object('form_id',a.crm_form_id,'center_id',a.center_id,'source',a.source_snapshot,'intake',a.intake,'routing_history',a.routing_history)$p10$;if strpos(b,anchor)=0 then raise exception 'P10 CRM inbox source anchor';end if;
 b:=replace(b,anchor,$p10$jsonb_build_object('center_id',a.center_id,'source',a.source_snapshot,'intake',a.intake,'routing_history',a.routing_history)||case when a.crm_form_id is not null then jsonb_build_object('form_id',a.crm_form_id) else '{}'::jsonb end$p10$);
 b:=replace(b,$p10$private.current_plan_name(org)<>'starter' or a.crm_form_id is null$p10$,$p10$private.current_plan_name(org)<>'starter' or a.publication_id is not null$p10$);execute b;
end$patch$;
alter function private.p06_import_summary(uuid) rename to p06_import_summary_students;
create function private.p06_import_summary(job uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare j core.import_jobs;stats jsonb;
begin
 select * into j from core.import_jobs where id=job;
 if j.mapping->>'kind' is distinct from 'crm_applications' then return private.p06_import_summary_students(job);end if;
 select jsonb_build_object('import_kind','crm_applications','total_rows',count(*),'valid_rows',count(*) filter(where r.state='valid'),'invalid_rows',count(*) filter(where r.state='invalid'),'new_people',0,
 'new_applications',count(*) filter(where r.state='valid' and z.org_id is null),'replayed_rows',count(*) filter(where r.state='valid' and z.org_id is not null),'opening_credits',0,'existing_negative_credits',0,'opening_debt_totals','[]'::jsonb,'original_credit_basis_totals','[]'::jsonb)
 into stats from core.import_rows r left join private.p06_sources z on z.org_id=r.org_id and z.source_namespace=r.source_namespace and z.source_key=r.source_key and z.import_kind='crm_applications' and z.center_id=r.center_id and z.payload_hash=encode(extensions.digest(r.payload::text,'sha256'),'hex') where r.job_id=job;
 return stats;
end$$;
revoke all on function private.crm_import_access(uuid,uuid,uuid,boolean),private.crm_import_body(jsonb),private.crm_import_source(uuid),private.crm_import_row_check(uuid,uuid,jsonb,text),private.crm_import_row_apply(uuid,uuid,uuid[],int),private.crm_import_row_view(uuid,uuid) from public,anon,authenticated;
grant execute on function private.crm_import_access(uuid,uuid,uuid,boolean),private.crm_import_body(jsonb),private.crm_import_source(uuid),private.crm_import_row_check(uuid,uuid,jsonb,text),private.crm_import_row_apply(uuid,uuid,uuid[],int),private.crm_import_row_view(uuid,uuid) to service_role;
commit;
