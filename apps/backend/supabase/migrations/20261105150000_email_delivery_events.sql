begin;
-- Verified provider metadata only: never retain raw body, address, subject or headers.
-- Events may precede worker finish; correlate at read time after the job owns the reference.
create table private.email_provider_events(
 event_id text primary key check(event_id ~ '^[a-zA-Z0-9_-]{1,128}$'),
 provider_reference uuid not null,kind text not null check(kind in ('accepted','delayed','delivered','bounced','complained','failed')),
 occurred_at timestamptz not null check(isfinite(occurred_at)),payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 received_at timestamptz not null default clock_timestamp()
);
create index email_provider_reference on private.email_provider_events(provider_reference);
alter table private.email_provider_events enable row level security;
revoke all on private.email_provider_events from public,anon,authenticated;
grant select,insert on private.email_provider_events to service_role;
create function private.email_event_ingest(r jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.email_provider_events;
begin
 if jsonb_typeof(r) is distinct from 'object' or (r-array['event_id','provider_reference','kind','occurred_at','payload_hash'])<>'{}'::jsonb
  or jsonb_typeof(r->'event_id') is distinct from 'string' or r->>'event_id' !~ '^[a-zA-Z0-9_-]{1,128}$'
  or jsonb_typeof(r->'provider_reference') is distinct from 'string' or r->>'provider_reference' !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
  or jsonb_typeof(r->'kind') is distinct from 'string' or r->>'kind' not in ('accepted','delayed','delivered','bounced','complained','failed')
  or jsonb_typeof(r->'payload_hash') is distinct from 'string' or r->>'payload_hash' !~ '^[a-f0-9]{64}$'
  or jsonb_typeof(r->'occurred_at') is distinct from 'string' or not isfinite((r->>'occurred_at')::timestamptz)
  or (r->>'occurred_at')::timestamptz>clock_timestamp()+interval '5 minutes' then perform private.fail('VALIDATION_FAILED');end if;
 insert into private.email_provider_events(event_id,provider_reference,kind,occurred_at,payload_hash)
  values(r->>'event_id',(r->>'provider_reference')::uuid,r->>'kind',(r->>'occurred_at')::timestamptz,r->>'payload_hash') on conflict(event_id) do nothing;
 select * into existing from private.email_provider_events where event_id=r->>'event_id';
 if existing.payload_hash is distinct from r->>'payload_hash' or existing.provider_reference is distinct from (r->>'provider_reference')::uuid
  or existing.kind is distinct from r->>'kind' or existing.occurred_at is distinct from (r->>'occurred_at')::timestamptz then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 return jsonb_build_object('accepted',true);
end$$;
-- Terminal adverse evidence wins even if events arrive out of order. Delayed or
-- accepted never downgrades delivered; delivery is mail-server acceptance, not inbox/read.
create function private.email_delivery_status(reference text) returns jsonb language sql stable security invoker set search_path='' as $$
 select case when reference is null then null else coalesce((select jsonb_build_object('state',e.kind,'occurred_at',e.occurred_at)
  from private.email_provider_events e where e.provider_reference=reference::uuid
  order by case e.kind when 'complained' then 6 when 'bounced' then 5 when 'failed' then 4 when 'delivered' then 3 when 'delayed' then 2 else 1 end desc,e.occurred_at desc,e.event_id desc limit 1),
  jsonb_build_object('state','accepted','occurred_at',null)) end
$$;
-- Only the existing invitation branch gains a delivery projection. Authorization,
-- queue state, other jobs and accepted/unknown retry ownership remain unchanged.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p06_tracking(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 a:=$a$'safe_error_code',(select s.safe_error_code from private.invitation_delivery_state s where s.job_id=q.id));pid:=q.id;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Email delivery projection anchor mismatch';end if;
 execute replace(b,a,$a$'safe_error_code',(select s.safe_error_code from private.invitation_delivery_state s where s.job_id=q.id),'email_delivery',private.email_delivery_status(q.provider_reference));pid:=q.id;$a$);
end$patch$;
create or replace function api_v1.outbox_deliver_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$
 select case when p_actor_auth_id is null and p_session_id is null and p_aux->>'email_event'='true' then private.email_event_ingest(p_request)
 when p_actor_auth_id is null and p_session_id is null and p_aux ? 'invitation_phase' then private.invitation_worker(p_request,p_aux)
 else private.execute_operation('outbox_deliver_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux) end
$$;
revoke all on function private.email_event_ingest(jsonb),private.email_delivery_status(text) from public,anon,authenticated;
grant execute on function private.email_event_ingest(jsonb),private.email_delivery_status(text) to service_role;
revoke all on function api_v1.outbox_deliver_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.outbox_deliver_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
