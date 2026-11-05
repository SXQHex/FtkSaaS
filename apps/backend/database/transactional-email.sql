begin;
alter table private.invitation_sender_config add column transactional_enabled boolean not null default false;
create table private.transactional_email_jobs(job_id uuid primary key,org_id uuid not null references core.organizations(id),center_id uuid not null,subject_version bigint not null,lease_hash text,first_attempt_at timestamptz,recipient text,account_id uuid,resend_secret_id uuid,payload jsonb,safe_error_code text,foreign key(org_id,center_id) references core.centers(org_id,id),foreign key(org_id,job_id) references core.outbox_jobs(org_id,id));
alter table private.transactional_email_jobs enable row level security;
revoke all on private.transactional_email_jobs from public,anon,authenticated;
grant all on private.transactional_email_jobs to service_role;
create function private.transactional_email_ready(org uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from private.invitation_sender_config c where c.org_id=org and c.enabled and c.transactional_enabled) or coalesce(private.current_plan_name(org),'') not in ('pro','business') then return false;end if;
 perform private.require_feature(org,'F26');return coalesce(private.access_mode(org) in ('normal','grace'),false);
exception when sqlstate 'P0001' then if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','POLICY_NOT_CONFIGURED','SUBSCRIPTION_NOT_STARTED') then return false;end if;raise;
end$$;
-- Closed event/subject mapping: never render arbitrary payload text in email.
create function private.transactional_email_context(n core.notifications) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare c uuid;v bigint;target uuid:=n.subject_id;typ text:=n.payload#>>'{subject,type}';title text;
begin
 title:=case
 when n.kind in ('reservation_create_v1','reservation_cancel_v1','reservation_impact_apply_v1') then 'Rezervasyon sonucu'
 when n.kind in ('lesson_request_reject_v1','lesson_request_offer_alternative_v1','lesson_request_accept_alternative_v1','lesson_request_approve_v1') then 'Ders talebi sonucu'
 when n.kind in ('session_cancelled_by_center','session_cancel_apply_v1') then 'Ders iptali'
 when n.kind='session_change_apply_v1' then 'Ders değişikliği'
 when n.kind in ('seat_offer','seat_offer_accept_v1','seat_offer_reject_v1','p01_expired') then 'Yer teklifi sonucu'
 when n.kind in ('collection_record_v1','collection_correct_apply_v1') then 'Tahsilat sonucu'
 when n.kind in ('sale_refund_apply_v1','student_credit_refund_v1') then 'İade sonucu'
 when n.kind in ('role_assign_v1','role_revoke_v1') then 'Erişim değişikliği' end;
 if title is null then return null;end if;
 if n.kind='seat_offer' then typ:='seat_offers';end if;
 if n.kind='p01_expired' then typ:=case when n.payload->>'operation'='request_expire_v1' then 'lesson_requests' else 'seat_offers' end;end if;
 case typ
 when 'sessions' then select center_id,version into c,v from core.sessions where org_id=n.org_id and id=target;
 when 'reservations' then select center_id,version into c,v from core.reservations where org_id=n.org_id and id=target;
 when 'lesson_requests' then select center_id,version into c,v from core.lesson_requests where org_id=n.org_id and id=target;
 when 'seat_offers' then select center_id,version into c,v from core.seat_offers where org_id=n.org_id and id=target and (n.kind<>'seat_offer' or (state='active' and expires_at>clock_timestamp()));
 when 'sales' then select center_id,version into c,v from core.sales where org_id=n.org_id and id=target;
 when 'cash_movements' then select center_id,version into c,v from core.cash_movements where org_id=n.org_id and id=target;
 when 'role_assignments' then select scope_center_id,version into c,v from core.role_assignments where org_id=n.org_id and id=target;
 else return null;end case;
 if c is null or v is null or not private.center_accessible(n.org_id,c) then return null;end if;
 return jsonb_build_object('center_id',c,'version',v,'title',title);
end$$;
-- Deferred firing occurs after a bounded worker's SECURITY DEFINER function
-- has returned. Keep the trigger's fixed internal work under its own owner; do
-- not grant core/private table access to the invoking worker role.
create function private.transactional_email_enqueue() returns trigger language plpgsql security definer set search_path='' as $$
declare ctx jsonb;
begin
 if not private.transactional_email_ready(new.org_id) or not exists(select 1 from core.notification_preferences p where p.org_id=new.org_id and p.person_id=new.recipient_person_id and p.channel='email' and p.purpose='transactional' and p.enabled) then return new;end if;
 ctx:=private.transactional_email_context(new);if ctx is null then return new;end if;
 -- Existing notification UUIDv7 deterministically identifies its email job.
 insert into core.outbox_jobs(id,org_id,notification_id,kind,dedupe_key,state,attempts,next_attempt_at) values(new.id,new.org_id,new.id,'transactional_email','transactional_email:'||new.id::text,'pending',0,clock_timestamp());
 insert into private.transactional_email_jobs(job_id,org_id,center_id,subject_version) values(new.id,new.org_id,(ctx->>'center_id')::uuid,(ctx->>'version')::bigint);return new;
end$$;
-- Notices can precede the source UPDATE; freeze only the final transaction state.
create constraint trigger transactional_email_enqueue after insert on core.notifications deferrable initially deferred for each row execute function private.transactional_email_enqueue();
create function private.transactional_email_recipient(org uuid,person uuid,center uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('account_id',a.id,'email',lower(btrim(u.email))) from core.account_links l join core.accounts a on a.id=l.account_id and a.state='active'
 join auth.users u on u.id=a.auth_user_id and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp())
 join core.people p on p.id=l.person_id and p.org_id=l.org_id and p.state='active'
 where l.org_id=org and l.person_id=person and l.state='active' and l.verified_at is not null and u.email is not null and u.email !~ '[\r\n]' and u.email like '%@%'
 and (exists(select 1 from core.center_relationships r where r.org_id=org and r.center_id=center and r.person_id=person and r.state='active') or private.is_manager(org,person,center)) order by l.created_at,l.id limit 1
$$;
create function private.transactional_email_allowed(j core.outbox_jobs,s private.transactional_email_jobs) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare n core.notifications;ctx jsonb;recipient jsonb;
begin
 select * into n from core.notifications where org_id=j.org_id and id=j.notification_id;
 if n.id is null or not private.transactional_email_ready(j.org_id) then return false;end if;
 ctx:=private.transactional_email_context(n);recipient:=private.transactional_email_recipient(j.org_id,n.recipient_person_id,s.center_id);
 return coalesce((ctx->>'center_id')::uuid=s.center_id and (ctx->>'version')::bigint=s.subject_version and recipient is not null and (s.recipient is null or (s.recipient=recipient->>'email' and s.account_id=(recipient->>'account_id')::uuid)) and exists(select 1 from core.notification_preferences p where p.org_id=j.org_id and p.person_id=n.recipient_person_id and p.channel='email' and p.purpose='transactional' and p.enabled),false);
end$$;
create function private.transactional_email_worker(r jsonb,aux jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare j core.outbox_jobs;s private.transactional_email_jobs;n core.notifications;cfg private.invitation_sender_config;resolved_recipient jsonb;token text;api_key text;phase text:=aux->>'email_phase';ok boolean;
begin
 if phase='claim' then
  select q.* into j from core.outbox_jobs q join private.transactional_email_jobs t on t.job_id=q.id where q.kind='transactional_email' and ((q.state in ('pending','retry_wait') and coalesce(q.next_attempt_at,clock_timestamp())<=clock_timestamp()) or (q.state='running' and q.lease_until<=clock_timestamp())) order by q.created_at,q.id limit 1;
  if j.id is null then return jsonb_build_object('_internal_invitation',null);end if;
  perform 1 from core.organizations where id=j.org_id for update;
  select q.* into j from core.outbox_jobs q where q.id=j.id and ((q.state in ('pending','retry_wait') and coalesce(q.next_attempt_at,clock_timestamp())<=clock_timestamp()) or (q.state='running' and q.lease_until<=clock_timestamp())) for update skip locked;
  if j.id is null then return jsonb_build_object('_internal_invitation',null);end if;
  select * into s from private.transactional_email_jobs where job_id=j.id for update;ok:=private.transactional_email_allowed(j,s);
  if not ok or j.attempts>=3 or s.first_attempt_at<clock_timestamp()-interval '23 hours' then
   update core.outbox_jobs set state=case when not ok then 'cancelled' else 'failed' end,lease_until=null,version=version+1 where id=j.id;
   update private.transactional_email_jobs set safe_error_code=case when not ok then 'NOTIFICATION_UNAVAILABLE' else 'DELIVERY_OUTCOME_UNKNOWN' end where job_id=j.id;return jsonb_build_object('_internal_invitation',null);
  end if;
  select * into cfg from private.invitation_sender_config where org_id=j.org_id;
  select decrypted_secret into api_key from vault.decrypted_secrets where id=coalesce(s.resend_secret_id,cfg.resend_secret_id);
  if api_key is null or api_key='' then
   update core.outbox_jobs set state='failed',lease_until=null,version=version+1 where id=j.id;
   update private.transactional_email_jobs set safe_error_code='SERVICE_UNAVAILABLE' where job_id=j.id;return jsonb_build_object('_internal_invitation',null);
  end if;
  select * into n from core.notifications where org_id=j.org_id and id=j.notification_id;
  resolved_recipient:=private.transactional_email_recipient(j.org_id,n.recipient_person_id,s.center_id);token:=encode(extensions.gen_random_bytes(32),'hex');
  update private.transactional_email_jobs set lease_hash=encode(extensions.digest(token,'sha256'),'hex'),first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),recipient=coalesce(s.recipient,resolved_recipient->>'email'),account_id=coalesce(s.account_id,(resolved_recipient->>'account_id')::uuid),resend_secret_id=coalesce(s.resend_secret_id,cfg.resend_secret_id),safe_error_code=null,
   payload=coalesce(s.payload,jsonb_build_object('from',cfg.from_email,'to',jsonb_build_array(resolved_recipient->>'email'),'subject','['||left(regexp_replace((select name from core.organizations where id=j.org_id),'[\r\n]',' ','g'),100)||'] '||(private.transactional_email_context(n)->>'title'),'text','Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: '||cfg.app_origin)) where job_id=j.id returning * into s;
  update core.outbox_jobs set state='running',attempts=attempts+1,lease_until=clock_timestamp()+interval '2 minutes',version=version+1 where id=j.id;
  return jsonb_build_object('_internal_email',jsonb_build_object('job_id',j.id,'org_id',j.org_id,'lease_token',token,'api_key',api_key,'payload',s.payload));
 end if;
 if phase is null or phase not in ('authorize','finish') then perform private.fail('FORBIDDEN');end if;
 perform 1 from core.organizations where id=(r->>'org_id')::uuid for update;
 select * into j from core.outbox_jobs where org_id=(r->>'org_id')::uuid and id=(r->>'job_id')::uuid and kind='transactional_email' for update;
 select * into s from private.transactional_email_jobs where job_id=j.id for update;
 if j.id is null or s.job_id is null or s.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') then perform private.fail('FORBIDDEN');end if;
 if phase='finish' and j.state='succeeded' and j.provider_reference=aux->>'provider_reference' then return jsonb_build_object('state',j.state);end if;
 if j.state<>'running' or j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 ok:=private.transactional_email_allowed(j,s);if phase='authorize' then return jsonb_build_object('authorized',ok);end if;
 if aux->>'provider_reference' is not null and aux->>'provider_reference' !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then perform private.fail('VALIDATION_FAILED');end if;
 update core.outbox_jobs set state=case when aux->>'provider_reference' is not null then 'succeeded' when not ok then 'cancelled' when aux->>'retryable'='true' and attempts<3 and s.first_attempt_at>clock_timestamp()-interval '23 hours' then 'retry_wait' else 'failed' end,provider_reference=coalesce(aux->>'provider_reference',provider_reference),lease_until=null,next_attempt_at=clock_timestamp()+make_interval(secs=>30*(2^greatest(attempts-1,0))::int),version=version+1 where id=j.id returning * into j;
 update private.transactional_email_jobs set safe_error_code=case when j.state='succeeded' then null when j.state='cancelled' then 'NOTIFICATION_UNAVAILABLE' when aux->>'retryable'='false' then 'EMAIL_REJECTED' else 'DELIVERY_OUTCOME_UNKNOWN' end where job_id=j.id;
 return jsonb_build_object('state',j.state);
end$$;
-- Retry payloads are needed only while a job can still send. Keep outcome
-- metadata but erase the copied address/body/credential reference on terminal state.
create function private.transactional_email_scrub_terminal() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='transactional_email' and new.state in ('succeeded','failed','cancelled') then
  update private.transactional_email_jobs set recipient=null,account_id=null,resend_secret_id=null,payload=null where job_id=new.id;
 end if;return new;
end$$;
create trigger transactional_email_scrub_terminal after update of state on core.outbox_jobs for each row execute function private.transactional_email_scrub_terminal();
revoke all on function private.transactional_email_scrub_terminal() from public,anon,authenticated;
create function private.transactional_email_status(nid uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',j.id,'state',j.state,'progress_count',case when j.state='succeeded' then 1 else 0 end,'total_count',1,'result_reference',case when j.state='succeeded' then jsonb_build_object('type','notifications','id',j.notification_id) end,'safe_error_code',s.safe_error_code,'email_delivery',private.email_delivery_status(j.provider_reference)) from core.outbox_jobs j join private.transactional_email_jobs s on s.job_id=j.id where j.notification_id=nid and j.kind='transactional_email'
$$;
create or replace function private.notification_channel_guard(r jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if r->>'channel'='email' then
  if r->>'purpose'<>'transactional' or not private.transactional_email_ready((r->>'org_id')::uuid) then perform private.fail('SERVICE_UNAVAILABLE');end if;
 elsif not private.notification_channel_ready(r->>'channel') then perform private.fail('SERVICE_UNAVAILABLE');end if;
end$$;
-- Keep the existing worker tick's durable single-use request fence. Only when
-- no invitation is selected may that same tick claim one transactional job.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.invitation_worker(jsonb,jsonb)'::regprocedure);
 a:=$a$if q.id is null then return jsonb_build_object('_internal_invitation',null);end if;$a$;
 if array_length(string_to_array(b,a),1)<>3 then raise exception 'Email claim anchor drift';end if;
 -- Only the first (no candidate) branch falls through, never a lost claim race.
 b:=overlay(b placing replace(a,$a$jsonb_build_object('_internal_invitation',null)$a$,$a$private.transactional_email_worker(r,jsonb_build_object('email_phase','claim'))$a$) from strpos(b,a) for length(a));execute b;
 b:=pg_get_functiondef('private.p05_access(text,jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$if r->>'channel'='email' then perform private.fail('SERVICE_UNAVAILABLE');end if;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Email preference access anchor drift';end if;
 execute replace(b,a,$a$if op='notification_preferences_set_v1' then perform private.notification_channel_guard(r);end if;$a$);
 b:=pg_get_functiondef('private.p05_notifications(text,jsonb,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 b:=replace(b,$a$if r->>'purpose'='transactional' and not(r->>'enabled')::bool then$a$,$a$if r->>'channel'='in_app' and r->>'purpose'='transactional' and not(r->>'enabled')::bool then$a$);
 b:=replace(b,$a$values(pid,org,actor,'in_app',r->>'purpose',r->>'purpose'='transactional')$a$,$a$values(pid,org,actor,r->>'channel',r->>'purpose',r->>'channel'='in_app' and r->>'purpose'='transactional')$a$);
 b:=replace(b,$a$and channel='in_app' and purpose=r->>'purpose'$a$,$a$and channel=r->>'channel' and purpose=r->>'purpose'$a$);execute b;
 b:=pg_get_functiondef('private.p05_notification_page(jsonb,uuid,uuid)'::regprocedure);
 a:=$a$'read_at',n.read_at)$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'Email list projection anchor drift';end if;
 b:=replace(b,a,$a$'read_at',n.read_at,'email_job',private.transactional_email_status(n.id))$a$);
 a:=$a$'next_cursor',token,'as_of',asof)$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'Email preference read anchor drift';end if;
 execute replace(b,a,$a$'next_cursor',token,'as_of',asof,'email_preference',jsonb_build_object('enabled',coalesce((select p.enabled from core.notification_preferences p where p.org_id=org and p.person_id=actor and p.channel='email' and p.purpose='transactional'),false),'version',coalesce((select p.version from core.notification_preferences p where p.org_id=org and p.person_id=actor and p.channel='email' and p.purpose='transactional'),1),'available',private.transactional_email_ready(org)))$a$);
 b:=pg_get_functiondef('private.notification_delivery_support(uuid)'::regprocedure);
 execute replace(b,$a$'email',private.notification_channel_ready('email')$a$,$a$'email',private.transactional_email_ready(org)$a$);
end$patch$;
create or replace function api_v1.outbox_deliver_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$
 select case when p_actor_auth_id is null and p_session_id is null and p_aux->>'email_event'='true' then private.email_event_ingest(p_request)
 when p_actor_auth_id is null and p_session_id is null and p_aux ? 'email_phase' then private.transactional_email_worker(p_request,p_aux)
 when p_actor_auth_id is null and p_session_id is null and p_aux ? 'invitation_phase' then private.invitation_worker(p_request,p_aux)
 else private.execute_operation('outbox_deliver_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux) end
$$;
-- Keep delivery evidence for all referenced jobs. Prune only orphan provider
-- metadata after the existing 30-day delivery-log horizon, in bounded batches.
create function private.email_events_prune() returns void language sql security invoker set search_path='' as $$
 delete from private.email_provider_events e where e.event_id in(select x.event_id from private.email_provider_events x where x.received_at<clock_timestamp()-interval '30 days' and not exists(select 1 from core.outbox_jobs j where j.provider_reference=x.provider_reference::text) order by x.received_at,x.event_id limit 100)
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.invitation_worker(jsonb,jsonb)'::regprocedure);a:=$a$if phase='claim' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Email retention tick anchor drift';end if;
 execute replace(b,a,a||' perform private.email_events_prune();');
end$patch$;
revoke all on function private.transactional_email_ready(uuid),private.transactional_email_context(core.notifications),private.transactional_email_enqueue(),private.transactional_email_recipient(uuid,uuid,uuid),private.transactional_email_allowed(core.outbox_jobs,private.transactional_email_jobs),private.transactional_email_worker(jsonb,jsonb),private.transactional_email_status(uuid),private.email_events_prune() from public,anon,authenticated;
grant execute on function private.transactional_email_ready(uuid),private.transactional_email_context(core.notifications),private.transactional_email_recipient(uuid,uuid,uuid),private.transactional_email_allowed(core.outbox_jobs,private.transactional_email_jobs),private.transactional_email_worker(jsonb,jsonb),private.transactional_email_status(uuid),private.email_events_prune() to service_role;
revoke all on function api_v1.outbox_deliver_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.outbox_deliver_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
