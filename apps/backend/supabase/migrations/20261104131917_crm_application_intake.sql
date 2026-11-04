-- P05/P06: one application history, trusted form routing and explicit person review.
begin;
create table private.crm_intake_forms(
 id uuid primary key,org_id uuid not null references core.organizations(id),center_id uuid,
 channel text not null check(channel='web_form'),form_key text not null check(length(form_key) between 1 and 256),
 source_url text not null check(source_url ~ '^https://[^[:space:]]+$' and length(source_url)<=2048),enabled boolean not null,
 unique(org_id,id),unique(org_id,channel,form_key),foreign key(org_id,center_id) references core.centers(org_id,id)
);
alter table private.crm_intake_forms enable row level security;
revoke all on private.crm_intake_forms from public,anon,authenticated;
grant select,insert,update,delete on private.crm_intake_forms to service_role;
alter table core.public_applications alter column publication_id drop not null;
alter table core.public_applications alter column center_id drop not null;
alter table core.public_applications add column if not exists crm_form_id uuid;
alter table core.public_applications add column if not exists source_snapshot jsonb not null default '{}';
alter table core.public_applications add column if not exists intake jsonb;
alter table core.public_applications add column if not exists routing_history jsonb not null default '[]';
alter table core.public_applications add constraint crm_application_form foreign key(org_id,crm_form_id) references private.crm_intake_forms(org_id,id);
alter table core.public_applications add constraint crm_application_origin check ((publication_id is not null)<>(crm_form_id is not null));
create unique index crm_application_delivery on core.public_applications(org_id,crm_form_id,request_reference) where crm_form_id is not null;
create index crm_application_phone on core.public_applications(org_id,(intake->>'phone')) where crm_form_id is not null;
alter table private.p04_public_requests alter column publication_id drop not null;
alter table private.p04_public_requests add column if not exists crm_form_id uuid references private.crm_intake_forms(id);
alter table private.p04_public_requests add column if not exists application_id uuid references core.public_applications(id);

create function private.crm_normalize_phone(value text) returns text language plpgsql immutable security invoker set search_path='' as $$
declare phone text:=regexp_replace(btrim(value),'[[:space:]().-]','','g');
begin
 if left(phone,2)='00' then phone:='+'||substr(phone,3);end if;
 if phone is null or phone !~ '^\+[1-9][0-9]{6,14}$' then perform private.fail('VALIDATION_FAILED');end if;
 return phone;
end$$;
-- Matching an older unnormalised contact must never abort an otherwise safe list.
create function private.crm_contact_phone(value text) returns text language plpgsql immutable security invoker set search_path='' as $$
begin return private.crm_normalize_phone(value);exception when SQLSTATE 'P0001' then return null;end$$;

create function private.crm_intake_submit(r jsonb,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare f private.crm_intake_forms;org uuid;c uuid;phone text;body jsonb:=r->'intake';proof jsonb;entry jsonb;trace uuid:=private.new_id(ids,1);
 v_key_hash text;v_payload_hash text;old_hash text;v_target_hash text;ip_hash text:=aux->>'ip_hash';bucket timestamptz;n bigint;app_id uuid:=private.new_id(ids,2);source jsonb;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;
 select * into f from private.crm_intake_forms where id=(r->>'form_id')::uuid and enabled;
 if not found then perform private.fail('SERVICE_UNAVAILABLE');end if;org:=f.org_id;
 perform 1 from core.organizations where id=org for update;
 -- Re-read after the same organization lock used by human commands/revocations.
 select * into f from private.crm_intake_forms where id=f.id and enabled;
 if not found or private.access_mode(org) not in ('normal','grace') then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if private.current_plan_name(org)='starter' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 perform private.require_feature(org,'F21');perform private.require_feature(org,'F25');
 c:=f.center_id;
 if c is null and private.plan_limit(org,'centers')=1 then
  select id into c from core.centers where org_id=org and state='active' and private.center_accessible(org,id);
  if c is null then perform private.fail('SERVICE_UNAVAILABLE');end if;
 end if;
 if c is not null then perform private.assert_center(org,c);end if;
 if r->>'center_id' is not null and (r->>'center_id')::uuid is distinct from c then perform private.fail('NOT_FOUND');end if;
 if r ? 'publication_id' or r ? 'contact' or jsonb_typeof(body) is distinct from 'object' then perform private.fail('VALIDATION_FAILED');end if;
 phone:=private.crm_normalize_phone(body->>'phone');body:=jsonb_set(body,'{phone}',to_jsonb(phone));
 if length(btrim(coalesce(body->>'display_name','')))=0 or length(body->>'display_name')>200 or jsonb_typeof(body->'consents') is distinct from 'array' or jsonb_array_length(body->'consents')>20 then perform private.fail('VALIDATION_FAILED');end if;
 if body->>'email' is not null and (length(body->>'email')>320 or body->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then perform private.fail('VALIDATION_FAILED');end if;
 proof:='[]';
 for entry in select value from jsonb_array_elements(body->'consents') loop
  if jsonb_typeof(entry) is distinct from 'object' or length(btrim(coalesce(entry->>'purpose','')))=0 or length(btrim(coalesce(entry->>'version','')))=0 or jsonb_typeof(entry->'accepted') is distinct from 'boolean' or entry->>'occurred_at' is null or not isfinite((entry->>'occurred_at')::timestamptz) or (entry->>'occurred_at')::timestamptz>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from jsonb_array_elements(proof) x where x->>'purpose'=entry->>'purpose') then perform private.fail('VALIDATION_FAILED');end if;
  proof:=proof||jsonb_build_array(entry);
 end loop;
 source:=jsonb_build_object('channel',f.channel,'form_key',f.form_key,'source_url',f.source_url,'form_id',f.id);
 v_key_hash:=encode(extensions.digest(r->>'client_request_key','sha256'),'hex');
 v_payload_hash:=encode(extensions.digest(jsonb_build_object('form_id',f.id,'intake',body,'center_id',r->'center_id')::text,'sha256'),'hex');
 select q.payload_hash into old_hash from private.p04_public_requests q where q.key_hash=v_key_hash;
 if old_hash is not null then
  if old_hash<>v_payload_hash then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('accepted',true),'trace_id',trace);
 end if;
 if ip_hash is null or ip_hash !~ '^[a-f0-9]{64}$' or aux->>'target_hash' is null or aux->>'target_hash' !~ '^[a-f0-9]{64}$' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 v_target_hash:=encode(extensions.digest(org::text||':'||(aux->>'target_hash'),'sha256'),'hex');
 if aux->>'phase'='preflight' then
  delete from core.rate_limit_windows where ends_at<clock_timestamp()-interval '1 hour';
  perform pg_advisory_xact_lock(hashtextextended(ip_hash,104));
  bucket:=date_bin(interval '15 minutes',clock_timestamp(),'2000-01-01'::timestamptz);
  insert into core.rate_limit_windows(id,key_hash,dimension,starts_at,ends_at,attempt_count,accepted_count) values(private.new_id(ids,40),ip_hash,'ip',bucket,bucket+interval '15 minutes',1,0)
  on conflict(dimension,key_hash,starts_at) do update set attempt_count=core.rate_limit_windows.attempt_count+1;
  select sum(attempt_count) into n from core.rate_limit_windows where dimension='ip' and key_hash=ip_hash and ends_at>clock_timestamp()-interval '15 minutes';
  if n>(select ip_max from private.p04_public_security where singleton) then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','RATE_LIMITED','retryable',false,'trace_id',trace));end if;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('bot_required',true),'trace_id',trace);
 end if;
 if aux->>'bot_verified' is distinct from 'true' then perform private.fail('BOT_VERIFICATION_FAILED');end if;
 select coalesce(sum(accepted_count),0) into n from core.rate_limit_windows where dimension='target_org' and key_hash=v_target_hash and ends_at>clock_timestamp()-interval '1 hour';
 if n>=(select target_org_max from private.p04_public_security where singleton) then perform private.fail('RATE_LIMITED');end if;
 body:=jsonb_set(body,'{consents}',coalesce((select jsonb_agg(x||jsonb_build_object('source',source,'received_at',clock_timestamp())) from jsonb_array_elements(proof) x),'[]'));
 insert into core.public_applications(id,org_id,center_id,crm_form_id,target_contact,target_hash,state,bot_verified_at,request_reference,source_snapshot,intake)
 values(app_id,org,c,f.id,phone,v_target_hash,'pending',clock_timestamp(),(r->>'client_request_key')::uuid,source,body);
 insert into private.p04_public_requests(key_hash,payload_hash,crm_form_id,application_id) values(v_key_hash,v_payload_hash,f.id,app_id);
 bucket:=date_bin(interval '1 hour',clock_timestamp(),'2000-01-01'::timestamptz);
 insert into core.rate_limit_windows(id,key_hash,dimension,starts_at,ends_at,attempt_count,accepted_count) values(private.new_id(ids,41),v_target_hash,'target_org',bucket,bucket+interval '1 hour',1,1)
 on conflict(dimension,key_hash,starts_at) do update set attempt_count=core.rate_limit_windows.attempt_count+1,accepted_count=core.rate_limit_windows.accepted_count+1;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('accepted',true),'trace_id',trace);
exception when others then
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end,'retryable',false,'trace_id',trace));
end$$;

create function private.crm_application_access(r jsonb,org uuid,c uuid,actor uuid) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if private.is_org_reader(org,actor) then return;end if;
 if c is null then perform private.fail('FORBIDDEN');end if;
 perform private.assert_center(org,c);
 if private.is_manager(org,actor,c) then return;end if;
 if r->>'action' is null and private.staff_grant(org,actor,c,'crm.daily') then return;end if;
 perform private.fail('FORBIDDEN');
end$$;
create function private.crm_application_review(r jsonb,org uuid,c uuid,actor uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare app core.public_applications;target uuid;destination uuid;version_n bigint;entry jsonb;
begin
 perform private.crm_application_access(r,org,c,actor);
 select * into app from core.public_applications where org_id=org and id=(r->>'application_id')::uuid for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 if app.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if app.state<>'pending' then perform private.fail('INVALID_STATE_TRANSITION');end if;
 if r->>'action'='assign_center' then
  if not private.is_org_reader(org,actor) then perform private.fail('FORBIDDEN');end if;
  destination:=(r->>'target_center_id')::uuid;
  if destination is null or r->>'person_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
  perform private.assert_center(org,destination);
  update core.public_applications set center_id=destination,version=version+1,
   routing_history=routing_history||jsonb_build_array(jsonb_build_object('from_center_id',center_id,'to_center_id',destination,'actor_person_id',actor,'occurred_at',clock_timestamp()))
   where id=app.id returning version into version_n;
 elsif r->>'action'='close' then
  if r->>'person_id' is not null or r->>'target_center_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
  update core.public_applications set state='closed',version=version+1 where id=app.id returning version into version_n;
 else
  if c is null then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'target_center_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'action'='match_existing' then
   target:=(r->>'person_id')::uuid;
   if target is null or not exists(select 1 from core.people where org_id=org and id=target and state='active') then perform private.fail('NOT_FOUND');end if;
   if not private.is_org_reader(org,actor) and not (exists(select 1 from core.center_relationships where org_id=org and center_id=c and person_id=target and state='active') or (exists(select 1 from private.person_origins where org_id=org and center_id=c and person_id=target) and not exists(select 1 from core.center_relationships where org_id=org and person_id=target))) then perform private.fail('NOT_FOUND');end if;
  elsif r->>'action'='create_candidate' then
   if r->>'person_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
   target:=private.new_id(ids,24);
   insert into core.people(id,org_id,display_name,state) values(target,org,app.intake->>'display_name','active');
   insert into core.person_contacts(id,org_id,person_id,kind,value) values(private.new_id(ids,25),org,target,'phone',app.intake->>'phone');
   if app.intake->>'email' is not null then insert into core.person_contacts(id,org_id,person_id,kind,value) values(private.new_id(ids,23),org,target,'email',lower(btrim(app.intake->>'email')));end if;
  else perform private.fail('VALIDATION_FAILED');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and center_id=c and person_id=target and kind in ('candidate','student') and state='active') then
   insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values(private.new_id(ids,26),org,c,target,'candidate','active',clock_timestamp());
  end if;
  if not exists(select 1 from core.leads where org_id=org and center_id=c and person_id=target and state='open') then
   insert into core.leads(id,org_id,center_id,person_id,source,interest,state) values(private.new_id(ids,27),org,c,target,'public_application',coalesce(app.intake->>'interest',app.source_snapshot->>'form_key'),'open');
  end if;
  update core.public_applications set person_id=target,state='reviewed',version=version+1 where id=app.id returning version into version_n;
 end if;
 return jsonb_build_object('primary_id',app.id,'version',version_n,'subject','public_applications');
end$$;

create function private.crm_phone_matches(org uuid,c uuid,actor uuid,phone text) returns jsonb language sql stable security invoker set search_path='' as $$
 with candidates as (
  select p.id,p.display_name from core.people p where p.org_id=org and p.state='active'
   and exists(select 1 from core.person_contacts pc where pc.org_id=org and pc.person_id=p.id and pc.kind='phone' and private.crm_contact_phone(pc.value)=phone)
   and (private.is_org_reader(org,actor) or exists(select 1 from core.center_relationships rel where rel.org_id=org and rel.center_id=c and rel.person_id=p.id and rel.state='active') or (exists(select 1 from private.person_origins po where po.org_id=org and po.center_id=c and po.person_id=p.id) and not exists(select 1 from core.center_relationships rel where rel.org_id=org and rel.person_id=p.id)))
  order by p.id limit 51
 ), first_page as (select * from candidates order by id limit 50)
 select jsonb_build_object('phone_matches',coalesce((select jsonb_agg(jsonb_build_object('person_id',id,'display_name',display_name) order by id) from first_page),'[]'),
  'phone_matches_truncated',(select count(*)>50 from candidates))
$$;

create function private.crm_application_page(r jsonb,org uuid,c uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';lim int:=coalesce((r#>>'{page,limit}')::int,50);cur jsonb;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();items jsonb;token text;
 h text:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page')::text);
begin
 if r#>>'{selector,operation}' is distinct from 'public_application_review_v1' or lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 perform private.crm_application_access(r||k,org,c,actor);
 perform private.require_feature(org,'F21');perform private.require_feature(org,'F25');
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(x.item order by x.at,x.id),'[]'::jsonb) into items from (
  select a.id,a.created_at at,jsonb_build_object('operation','public_application_review_v1','entity',jsonb_build_object('type','public_applications','id',a.id),'exists',true,'state',a.state,
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','public_applications','id',a.id),'version',a.version)),
  'as_of',asof,'current',jsonb_build_object('operation','public_application_review_v1','values',
   jsonb_build_object('application_id',a.id,'person_id',a.person_id,'contact',a.target_contact)||
   case when a.publication_id is not null then jsonb_build_object('publication_id',a.publication_id) else
    jsonb_build_object('form_id',a.crm_form_id,'center_id',a.center_id,'source',a.source_snapshot,'intake',a.intake,'routing_history',a.routing_history)||private.crm_phone_matches(org,c,actor,a.intake->>'phone') end),'_at',a.created_at) item
  from core.public_applications a where a.org_id=org and (c is null or a.center_id=c) and (a.center_id is null or private.center_accessible(org,a.center_id))
   and (private.current_plan_name(org)<>'starter' or a.crm_form_id is null)
   and (k->>'application_id' is null or a.id=(k->>'application_id')::uuid) and (k->>'person_id' is null or a.person_id=(k->>'person_id')::uuid)
   and a.created_at<=asof and (cur is null or (a.created_at,a.id)>(last_at,last_id)) order by a.created_at,a.id limit lim+1
 ) x;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',(items->-1)#>'{entity,id}','as_of',asof)::text,'utf8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]') into items from jsonb_array_elements(items) with ordinality z(x,n);
 return jsonb_build_object('data',jsonb_build_object('items',items,'next_cursor',token,'as_of',asof),'primary_id',coalesce(c,org),'subject',case when c is null then 'organizations' else 'centers' end);
end$$;

do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.p04_public(text,jsonb,uuid[],jsonb)'::regprocedure);
 old:=$a$ if op='public_calendar_get_v1' then$a$;
 if strpos(b,old)=0 then raise exception 'CRM public route anchor missing';end if;
 execute replace(b,old,$a$ if op='public_application_submit_v1' and r ? 'form_id' then return private.crm_intake_submit(r,ids,aux);end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_center(text,jsonb,uuid)'::regprocedure);
 old:=$a$ if op='public_application_review_v1' and r->>'application_id' is null then return c;end if;$a$;
 if strpos(b,old)=0 then raise exception 'CRM application scope anchor missing';end if;
 execute replace(b,old,$a$ if op='public_application_review_v1' then
  if r->>'application_id' is null then return c;end if;
  select a.center_id into actual from core.public_applications a where a.org_id=org and a.id=(r->>'application_id')::uuid;
  if not found or (c is not null and c is distinct from actual) then perform private.fail('NOT_FOUND');end if;return actual;
 end if;$a$);
 b:=pg_get_functiondef('private.p04_access(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 old:=$a$ if op='publication_set_v1' then$a$;
 if strpos(b,old)=0 then raise exception 'CRM application access anchor missing';end if;
 execute replace(b,old,$a$ if op='public_application_review_v1' then perform private.crm_application_access(r,org,center,actor);return;end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 old:=$a$ if op='crm_followup_list_v1' then$a$;
 if strpos(b,old)=0 then raise exception 'CRM application command anchor missing';end if;
 execute replace(b,old,$a$ if op='public_application_review_v1' then
  if exists(select 1 from core.public_applications where org_id=org and id=(r->>'application_id')::uuid and crm_form_id is not null) then return private.crm_application_review(r,org,center,actor,ids);end if;
  if r->>'action'='assign_center' or r ? 'target_center_id' then perform private.fail('VALIDATION_FAILED');end if;
  if r ? 'expected_version' and (select version from core.public_applications where org_id=org and id=(r->>'application_id')::uuid) is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_management(jsonb,uuid,uuid,uuid)'::regprocedure);
 old:=$a$ if r#>>'{selector,operation}' is distinct from op$a$;
 if strpos(b,old)=0 then raise exception 'CRM application read anchor missing';end if;
 execute replace(b,old,$a$ if op='public_application_review_v1' then return private.crm_application_page(r,org,center,actor);end if;
$a$||old);
end$patch$;
revoke all on function private.crm_normalize_phone(text),private.crm_contact_phone(text),private.crm_intake_submit(jsonb,uuid[],jsonb),private.crm_application_access(jsonb,uuid,uuid,uuid),private.crm_application_review(jsonb,uuid,uuid,uuid,uuid[]),private.crm_application_page(jsonb,uuid,uuid,uuid),private.crm_phone_matches(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.crm_normalize_phone(text),private.crm_contact_phone(text),private.crm_intake_submit(jsonb,uuid[],jsonb),private.crm_application_access(jsonb,uuid,uuid,uuid),private.crm_application_review(jsonb,uuid,uuid,uuid,uuid[]),private.crm_application_page(jsonb,uuid,uuid,uuid),private.crm_phone_matches(uuid,uuid,uuid,text) to service_role;
commit;
