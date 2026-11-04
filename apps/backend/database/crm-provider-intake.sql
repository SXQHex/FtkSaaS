-- P08/P09: native receiver identity, trusted form routing and one CRM history.
begin;
do $$begin if not exists(select 1 from pg_roles where rolname='ftk_crm_ingress_worker') then create role ftk_crm_ingress_worker nologin;end if;end$$;
alter table private.crm_intake_forms drop constraint crm_intake_forms_channel_check;
alter table private.crm_intake_forms add constraint crm_intake_forms_channel_check check(channel in ('web_form','meta','google_ads'));
alter table private.crm_intake_forms add column external_form_id text;
alter table private.crm_intake_forms add column external_page_id text;
alter table private.crm_intake_forms add constraint crm_provider_form_identity check(
 (channel='web_form' and external_form_id is null and external_page_id is null) or
 (channel='meta' and external_form_id ~ '^[1-9][0-9]{0,31}$' and external_form_id is not null and external_page_id ~ '^[1-9][0-9]{0,31}$' and external_page_id is not null) or
 (channel='google_ads' and external_form_id ~ '^[1-9][0-9]{0,18}$' and external_form_id is not null and external_page_id is null));
create unique index crm_provider_form_route on private.crm_intake_forms(channel,external_form_id) where channel<>'web_form';
create table private.crm_provider_receiver_scopes(db_role name not null,form_id uuid not null references private.crm_intake_forms(id),primary key(db_role,form_id));
alter table private.crm_provider_receiver_scopes enable row level security;
revoke all on private.crm_provider_receiver_scopes from public,anon,authenticated,ftk_crm_ingress_worker;
grant select,insert,update,delete on private.crm_provider_receiver_scopes to service_role;
alter table core.public_applications add column if not exists provider_lead_id text;
alter table core.public_applications add column if not exists provider_payload_hash text;
alter table core.public_applications alter column bot_verified_at drop not null;
alter table core.public_applications add constraint crm_application_verification check(
 (provider_lead_id is null and provider_payload_hash is null and bot_verified_at is not null) or
 (provider_lead_id is not null and octet_length(provider_lead_id) between 1 and 2048 and provider_payload_hash ~ '^[a-f0-9]{64}$' and provider_payload_hash is not null and crm_form_id is not null and publication_id is null and bot_verified_at is null));
create unique index crm_provider_delivery on core.public_applications(crm_form_id,provider_lead_id) where provider_lead_id is not null;

-- Share the existing web validation without giving providers a fake CAPTCHA.
create function private.crm_validate_intake(body jsonb) returns jsonb language plpgsql security invoker set search_path='' as $validate$
declare phone text;proof jsonb:='[]';entry jsonb;part record;stamp timestamptz;
begin
 if jsonb_typeof(body) is distinct from 'object' or octet_length(body::text)>65536 then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from jsonb_object_keys(body) k where k not in ('display_name','phone','email','interest','message','partner_name','mode','attribution','consents')) or jsonb_typeof(body->'display_name') is distinct from 'string' or jsonb_typeof(body->'phone') is distinct from 'string' then perform private.fail('VALIDATION_FAILED');end if;
 for part in select key,value from jsonb_each(body) loop
  if part.key in ('display_name','phone','email','interest','message','partner_name','mode') and (jsonb_typeof(part.value) is distinct from 'string' or length(part.value#>>'{}')>case part.key when 'display_name' then 200 when 'phone' then 40 when 'email' then 320 when 'interest' then 1000 when 'message' then 10000 else 200 end) then perform private.fail('VALIDATION_FAILED');end if;
 end loop;
 if length(body->>'phone')<7 or body ? 'interest' and length(body->>'interest')=0 then perform private.fail('VALIDATION_FAILED');end if;
 if body ? 'attribution' then
  if jsonb_typeof(body->'attribution') is distinct from 'object' then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from jsonb_each(body->'attribution') x where x.key not in ('campaign_id','ad_id','utm_source','utm_medium','utm_campaign','utm_term','utm_content','page_url') or jsonb_typeof(x.value) is distinct from 'string' or length(x.value#>>'{}')>2048) then perform private.fail('VALIDATION_FAILED');end if;
 end if;
 phone:=private.crm_normalize_phone(body->>'phone');body:=jsonb_set(body,'{phone}',to_jsonb(phone));
 if length(btrim(coalesce(body->>'display_name','')))=0 or length(body->>'display_name')>200 or jsonb_typeof(body->'consents') is distinct from 'array' or jsonb_array_length(body->'consents')>20 then perform private.fail('VALIDATION_FAILED');end if;
 if body->>'email' is not null and (length(body->>'email')>320 or (body->>'email') collate "C" !~* $email$^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$$email$) then perform private.fail('VALIDATION_FAILED');end if;
 for entry in select value from jsonb_array_elements(body->'consents') loop
  if jsonb_typeof(entry) is distinct from 'object' or length(btrim(coalesce(entry->>'purpose','')))=0 or length(btrim(coalesce(entry->>'version','')))=0 or jsonb_typeof(entry->'accepted') is distinct from 'boolean' or entry->>'occurred_at' is null then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from jsonb_object_keys(entry) k where k not in ('purpose','accepted','version','occurred_at')) or jsonb_typeof(entry->'purpose') is distinct from 'string' or length(entry->>'purpose')>100 or jsonb_typeof(entry->'version') is distinct from 'string' or length(entry->>'version')>200 or jsonb_typeof(entry->'occurred_at') is distinct from 'string' or entry->>'occurred_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[Tt ][0-9]{2}:[0-9]{2}:[0-5][0-9](\.[0-9]+)?([Zz]|[+-][0-9]{2}:[0-9]{2})$' then perform private.fail('VALIDATION_FAILED');end if;
  begin stamp:=(entry->>'occurred_at')::timestamptz;exception when invalid_datetime_format or datetime_field_overflow then perform private.fail('VALIDATION_FAILED');end;
  if not isfinite(stamp) or stamp>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from jsonb_array_elements(proof) x where x->>'purpose'=entry->>'purpose') then perform private.fail('VALIDATION_FAILED');end if;
  proof:=proof||jsonb_build_array(entry);
 end loop;
 return jsonb_set(body,'{consents}',proof);
exception when others then if SQLSTATE='P0001' then raise;end if;perform private.fail('VALIDATION_FAILED');
end$validate$;
do $patch$
declare b text;start_at int;end_at int;old text;
begin
 b:=pg_get_functiondef('private.crm_intake_submit(jsonb,uuid[],jsonb)'::regprocedure);
 old:='where id=(r->>''form_id'')::uuid and enabled;';if strpos(b,old)=0 then raise exception 'CRM web form route anchor missing';end if;
 b:=replace(b,old,'where id=(r->>''form_id'')::uuid and enabled and channel=''web_form'';');
 old:='where id=f.id and enabled;';if strpos(b,old)=0 then raise exception 'CRM web form recheck anchor missing';end if;
 b:=replace(b,old,'where id=f.id and enabled and channel=''web_form'';');
 start_at:=strpos(b,' phone:=private.crm_normalize_phone(body->>''phone'');');end_at:=strpos(b,' source:=jsonb_build_object(');
 if start_at=0 or end_at<=start_at then raise exception 'CRM shared validation anchor missing';end if;
 execute substr(b,1,start_at-1)||' body:=private.crm_validate_intake(body);phone:=body->>''phone'';proof:=body->''consents'';'||E'\n'||substr(b,end_at);
end$patch$;

create function private.crm_provider_submit(r jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare f private.crm_intake_forms;org uuid;c uuid;body jsonb;source jsonb;payload_hash text;old core.public_applications;app_id uuid:=private.new_id(ids,1);submitted timestamptz;
begin
 if not pg_has_role(session_user,'ftk_crm_ingress_worker','member') then perform private.fail('FORBIDDEN');end if;
 if jsonb_typeof(r) is distinct from 'object' or octet_length(r::text)>65536 or exists(select 1 from jsonb_object_keys(r) k where k not in ('provider','external_form_id','external_page_id','external_lead_id','submitted_at','is_test','attribution','intake')) then perform private.fail('VALIDATION_FAILED');end if;
 if not (r ?& array['provider','external_form_id','external_page_id','external_lead_id','submitted_at','is_test','attribution','intake']) then perform private.fail('VALIDATION_FAILED');end if;
 if r->>'provider' not in ('meta','google_ads') or r->>'provider' is null or jsonb_typeof(r->'external_lead_id') is distinct from 'string' or octet_length(r->>'external_lead_id') not between 1 and 2048 or jsonb_typeof(r->'external_form_id') is distinct from 'string' or (not (r ? 'is_test') or jsonb_typeof(r->'is_test') not in ('boolean','null')) or jsonb_typeof(r->'attribution') is distinct from 'object' then perform private.fail('VALIDATION_FAILED');end if;
 if r->>'provider'='meta' and (jsonb_typeof(r->'external_page_id') is distinct from 'string' or r->>'external_lead_id' !~ '^[1-9][0-9]{0,31}$') or r->>'provider'='google_ads' and jsonb_typeof(r->'external_page_id') is distinct from 'null' then perform private.fail('VALIDATION_FAILED');end if;
 select a.* into f from private.crm_intake_forms a join private.crm_provider_receiver_scopes s on s.form_id=a.id and s.db_role=session_user
 where a.channel=r->>'provider' and a.external_form_id=r->>'external_form_id' and a.external_page_id is not distinct from r->>'external_page_id' and a.enabled;
 if not found then perform private.fail('FORBIDDEN');end if;org:=f.org_id;
 perform 1 from core.organizations where id=org for update;
 select a.* into f from private.crm_intake_forms a join private.crm_provider_receiver_scopes s on s.form_id=a.id and s.db_role=session_user where a.id=f.id and a.org_id=org and a.channel=r->>'provider' and a.external_form_id=r->>'external_form_id' and a.external_page_id is not distinct from r->>'external_page_id' and a.enabled for share of a,s;
 if not found then perform private.fail('FORBIDDEN');end if;
 if private.access_mode(org) not in ('normal','grace') then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if private.current_plan_name(org)='starter' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 perform private.require_feature(org,'F21');perform private.require_feature(org,'F25');c:=f.center_id;
 if c is null and private.plan_limit(org,'centers')=1 then select id into c from core.centers where org_id=org and state='active' and private.center_accessible(org,id);if c is null then perform private.fail('SERVICE_UNAVAILABLE');end if;end if;
 if c is not null then perform private.assert_center(org,c);end if;
 body:=private.crm_validate_intake(r->'intake');
 if exists(select 1 from jsonb_each(r->'attribution') x where x.key not in ('ad_id','adset_id','campaign_id','adgroup_id','creative_id','asset_group_id','gcl_id','platform') or jsonb_typeof(x.value) is distinct from 'string' or length(x.value#>>'{}')>2048) then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from jsonb_each(r->'attribution') x where x.key in ('ad_id','adset_id','campaign_id','adgroup_id','creative_id','asset_group_id') and x.value#>>'{}' !~ '^[1-9][0-9]{0,31}$' or x.key='platform' and length(x.value#>>'{}') not between 1 and 64) then perform private.fail('VALIDATION_FAILED');end if;
 if jsonb_typeof(r->'submitted_at') is distinct from 'null' then
  if jsonb_typeof(r->'submitted_at') is distinct from 'string' or r->>'submitted_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[Tt ][0-9]{2}:[0-9]{2}:[0-5][0-9](\.[0-9]+)?([Zz]|[+-][0-9]{2}:[0-9]{2})$' then perform private.fail('VALIDATION_FAILED');end if;
  begin submitted:=(r->>'submitted_at')::timestamptz;exception when invalid_datetime_format or datetime_field_overflow then perform private.fail('VALIDATION_FAILED');end;
  if not isfinite(submitted) then perform private.fail('VALIDATION_FAILED');end if;
 end if;
 source:=jsonb_build_object('channel',f.channel,'form_id',f.id,'form_key',f.form_key,'source_url',f.source_url,'external_form_id',f.external_form_id,'external_page_id',f.external_page_id,'external_lead_id',r->>'external_lead_id','submitted_at',to_char(submitted at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'is_test',r->'is_test','attribution',r->'attribution');
 payload_hash:=encode(extensions.digest(jsonb_build_object('source',source,'intake',body)::text,'sha256'),'hex');
 select * into old from core.public_applications where crm_form_id=f.id and provider_lead_id=r->>'external_lead_id';
 if found then if old.provider_payload_hash<>payload_hash then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;return jsonb_build_object('application_id',old.id,'replayed',true);end if;
 body:=jsonb_set(body,'{consents}',coalesce((select jsonb_agg(x||jsonb_build_object('source',source,'received_at',clock_timestamp())) from jsonb_array_elements(body->'consents') x),'[]'));
 insert into core.public_applications(id,org_id,center_id,crm_form_id,target_contact,target_hash,state,request_reference,source_snapshot,intake,provider_lead_id,provider_payload_hash)
 values(app_id,org,c,f.id,body->>'phone',encode(extensions.digest(org::text||':'||encode(extensions.digest(body->>'phone','sha256'),'hex'),'sha256'),'hex'),'pending',private.new_id(ids,2),source,body,r->>'external_lead_id',payload_hash);
 return jsonb_build_object('application_id',app_id,'replayed',false);
end$$;
revoke all on function private.crm_validate_intake(jsonb) from public,anon,authenticated;
grant execute on function private.crm_validate_intake(jsonb) to service_role;
revoke all on function private.crm_provider_submit(jsonb,uuid[]) from public,anon,authenticated,service_role;
grant usage on schema private to ftk_crm_ingress_worker;
grant execute on function private.crm_provider_submit(jsonb,uuid[]) to ftk_crm_ingress_worker;
commit;
