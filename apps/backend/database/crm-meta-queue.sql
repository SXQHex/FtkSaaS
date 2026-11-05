-- P08: durable minimal Meta notifications. No credentials or lead answers here.
begin;
create table private.crm_meta_notifications(
 id uuid primary key,form_id uuid not null references private.crm_intake_forms(id) on delete cascade,
 org_id uuid not null,center_id uuid,external_lead_id text not null,notification jsonb not null,identity jsonb not null,
 enqueued_at timestamptz not null default clock_timestamp(),available_at timestamptz not null default clock_timestamp(),
 lease_token uuid,lease_owner name,lease_until timestamptz,attempts bigint not null default 0,
 completed_at timestamptz,application_id uuid,
 unique(form_id,external_lead_id),
 check((lease_token is null and lease_owner is null and lease_until is null) or (lease_token is not null and lease_owner is not null and lease_until is not null))
);
create index crm_meta_pending on private.crm_meta_notifications(form_id,available_at,enqueued_at,id) where completed_at is null;
alter table private.crm_meta_notifications enable row level security;
revoke all on private.crm_meta_notifications from public,anon,authenticated,service_role,ftk_crm_ingress_worker;

-- One nonce can never become valid again, including after delayed retry.
create table private.crm_meta_lease_tokens(nonce uuid primary key,item_id uuid not null references private.crm_meta_notifications(id) on delete cascade);
alter table private.crm_meta_lease_tokens enable row level security;
revoke all on private.crm_meta_lease_tokens from public,anon,authenticated,service_role,ftk_crm_ingress_worker;

create function private.crm_meta_enqueue(events jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare e jsonb;f private.crm_intake_forms;stable jsonb;previous private.crm_meta_notifications;ordinal int:=0;part record;stamp timestamptz;
begin
 if not pg_has_role(session_user,'ftk_crm_ingress_worker','member') then perform private.fail('FORBIDDEN');end if;
 if jsonb_typeof(events) is distinct from 'array' or jsonb_array_length(events)>1000 or octet_length(events::text)>1048576 then perform private.fail('VALIDATION_FAILED');end if;
 for e in select value from jsonb_array_elements(events) loop
  ordinal:=ordinal+1;
  if jsonb_typeof(e) is distinct from 'object' or not(e ?& array['provider','external_page_id','external_form_id','external_lead_id','notification_sent_at','lead_created_at','attribution']) or exists(select 1 from jsonb_object_keys(e) k where k not in ('provider','external_page_id','external_form_id','external_lead_id','notification_sent_at','lead_created_at','attribution')) or e->>'provider' is distinct from 'meta' then perform private.fail('VALIDATION_FAILED');end if;
  for part in select key,value from jsonb_each(e) where key in ('external_page_id','external_form_id','external_lead_id') loop
   if jsonb_typeof(part.value) is distinct from 'string' or part.value#>>'{}' !~ '^[1-9][0-9]{0,31}$' then perform private.fail('VALIDATION_FAILED');end if;
  end loop;
  for part in select key,value from jsonb_each(e) where key in ('notification_sent_at','lead_created_at') loop
   if jsonb_typeof(part.value)<>'null' then
    if jsonb_typeof(part.value) is distinct from 'string' or part.value#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-5][0-9](\.[0-9]+)?Z$' then perform private.fail('VALIDATION_FAILED');end if;
    begin stamp:=(part.value#>>'{}')::timestamptz;exception when invalid_datetime_format or datetime_field_overflow then perform private.fail('VALIDATION_FAILED');end;
    if not isfinite(stamp) then perform private.fail('VALIDATION_FAILED');end if;
   end if;
  end loop;
  if jsonb_typeof(e->'attribution') is distinct from 'object' or exists(select 1 from jsonb_each(e->'attribution') x where x.key not in ('ad_id','adgroup_id') or jsonb_typeof(x.value) is distinct from 'string' or x.value#>>'{}' !~ '^[1-9][0-9]{0,31}$') then perform private.fail('VALIDATION_FAILED');end if;
  perform private.crm_provider_authorize('meta',e->>'external_form_id',e->>'external_page_id');
  select * into f from private.crm_intake_forms where channel='meta' and external_form_id=e->>'external_form_id' and external_page_id=e->>'external_page_id';
  stable:=e-'notification_sent_at';
  insert into private.crm_meta_notifications(id,form_id,org_id,center_id,external_lead_id,notification,identity) values(private.new_id(ids,ordinal),f.id,f.org_id,f.center_id,e->>'external_lead_id',e,stable) on conflict(form_id,external_lead_id) do nothing;
  select * into previous from private.crm_meta_notifications where form_id=f.id and external_lead_id=e->>'external_lead_id';
  if previous.identity is distinct from stable or previous.org_id is distinct from f.org_id or previous.center_id is distinct from f.center_id then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 end loop;
 return jsonb_build_object('accepted',ordinal);
end$$;

create function private.crm_meta_claim(external_form text,external_page text,nonce uuid,lease_seconds int) returns jsonb language plpgsql security definer set search_path='' as $$
declare item private.crm_meta_notifications;f private.crm_intake_forms;
begin
 perform private.crm_provider_authorize('meta',external_form,external_page);
 if nonce is null or lease_seconds not between 30 and 300 or lease_seconds is null then perform private.fail('VALIDATION_FAILED');end if;
 select * into f from private.crm_intake_forms where channel='meta' and external_form_id=external_form and external_page_id=external_page;
 select * into item from private.crm_meta_notifications where form_id=f.id and org_id=f.org_id and center_id is not distinct from f.center_id and completed_at is null and available_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp()) order by available_at,enqueued_at,id limit 1 for update skip locked;
 if not found then return null;end if;
 insert into private.crm_meta_lease_tokens(nonce,item_id) values(nonce,item.id);
 update private.crm_meta_notifications set lease_token=nonce,lease_owner=session_user,lease_until=clock_timestamp()+make_interval(secs=>lease_seconds),available_at=clock_timestamp()+make_interval(secs=>lease_seconds),attempts=attempts+1 where id=item.id;
 return jsonb_build_object('id',item.id,'lease_token',nonce,'notification',item.notification);
end$$;

create function private.crm_meta_complete(item_id uuid,nonce uuid,delivery jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare item private.crm_meta_notifications;receipt jsonb;f private.crm_intake_forms;
begin
 if not pg_has_role(session_user,'ftk_crm_ingress_worker','member') then perform private.fail('FORBIDDEN');end if;
 select * into item from private.crm_meta_notifications where id=item_id for update;
 if not found or item.completed_at is not null or item.lease_token is distinct from nonce or item.lease_owner is distinct from session_user or item.lease_until<=clock_timestamp() or item.lease_until is null then perform private.fail('FORBIDDEN');end if;
 perform 1 from core.organizations where id=item.org_id for update;
 select * into f from private.crm_intake_forms where id=item.form_id for share;
 if not found or f.org_id is distinct from item.org_id or f.center_id is distinct from item.center_id or f.external_form_id is distinct from item.notification->>'external_form_id' or f.external_page_id is distinct from item.notification->>'external_page_id' then perform private.fail('FORBIDDEN');end if;
 if delivery->>'provider' is distinct from 'meta' or delivery->>'external_page_id' is distinct from item.notification->>'external_page_id' or delivery->>'external_form_id' is distinct from item.notification->>'external_form_id' or delivery->>'external_lead_id' is distinct from item.external_lead_id or (item.notification->'attribution' ? 'ad_id' and delivery->'attribution'->>'ad_id' is distinct from item.notification->'attribution'->>'ad_id') then perform private.fail('VALIDATION_FAILED');end if;
 receipt:=private.crm_provider_submit(delivery,ids);
 -- Recheck after submit's organization lock: an expired holder rolls everything back.
 if item.lease_until<=clock_timestamp() then perform private.fail('FORBIDDEN');end if;
 update private.crm_meta_notifications set completed_at=clock_timestamp(),application_id=(receipt->>'application_id')::uuid,lease_token=null,lease_owner=null,lease_until=null where id=item.id;
 return receipt;
end$$;

create function private.crm_meta_retry(item_id uuid,nonce uuid,retry_seconds int) returns boolean language plpgsql security definer set search_path='' as $$
declare item private.crm_meta_notifications;
begin
 if not pg_has_role(session_user,'ftk_crm_ingress_worker','member') then perform private.fail('FORBIDDEN');end if;
 if retry_seconds is null or retry_seconds not between 1 and 3600 then perform private.fail('VALIDATION_FAILED');end if;
 select * into item from private.crm_meta_notifications where id=item_id for update;
 if not found or item.completed_at is not null or item.lease_token is distinct from nonce or item.lease_owner is distinct from session_user or item.lease_until<=clock_timestamp() or item.lease_until is null then perform private.fail('FORBIDDEN');end if;
 update private.crm_meta_notifications set available_at=clock_timestamp()+make_interval(secs=>retry_seconds),lease_token=null,lease_owner=null,lease_until=null where id=item.id;
 return true;
end$$;
revoke all on function private.crm_meta_enqueue(jsonb,uuid[]),private.crm_meta_claim(text,text,uuid,int),private.crm_meta_complete(uuid,uuid,jsonb,uuid[]),private.crm_meta_retry(uuid,uuid,int) from public,anon,authenticated,service_role;
grant execute on function private.crm_meta_enqueue(jsonb,uuid[]),private.crm_meta_claim(text,text,uuid,int),private.crm_meta_complete(uuid,uuid,jsonb,uuid[]),private.crm_meta_retry(uuid,uuid,int) to ftk_crm_ingress_worker;
commit;
