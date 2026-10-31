begin;
-- XREQ-001: only the signup proxy participates in this dispatch fence. Native
-- OAuth/link/email-change paths keep their own provider transactions.
create table private.account_signup_claims (
 target_hash text primary key check(target_hash ~ '^[a-f0-9]{64}$'),
 attempt_id uuid not null,
 dispatched_at timestamptz not null default clock_timestamp()
);
create table private.account_signup_rates (
 ip_hash text not null check(ip_hash ~ '^[a-f0-9]{64}$'),
 bucket bigint not null,
 hits integer not null check(hits>0),
 primary key(ip_hash,bucket)
);
alter table private.account_signup_claims enable row level security;
alter table private.account_signup_rates enable row level security;
revoke all on private.account_signup_claims,private.account_signup_rates from public,anon,authenticated,service_role;

create function private.account_signup_gate(r jsonb,ids uuid[],aux jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare address text:=lower(btrim(r->>'email')); target text:=aux->>'target_hash';
 ip text:=aux->>'ip_hash'; phase text:=aux->>'phase'; attempt uuid; n integer; rate_bucket bigint;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then
  return jsonb_build_object('error','TEMPORARY_FAILURE');
 end if;
 if coalesce(target,'')!~'^[a-f0-9]{64}$' or coalesce(ip,'')!~'^[a-f0-9]{64}$' or address is null or length(address)>254 or address!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or (r-array['client_api_version','request_id','email'])<>'{}'::jsonb then
  return jsonb_build_object('error','VALIDATION_FAILED');
 end if;
 if phase='dispatch' then
  -- The accepted native signup IP policy (S04): 30 requests / 5 minutes.
  -- This extra counter covers existence responses that never reach Auth.
  rate_bucket:=floor(extract(epoch from clock_timestamp())/300)::bigint;
  insert into private.account_signup_rates values(ip,rate_bucket,1)
   on conflict(ip_hash,bucket) do update set hits=least(private.account_signup_rates.hits+1,31) returning hits into n;
  if n>30 then return jsonb_build_object('error','RATE_LIMITED');end if;
  delete from private.account_signup_rates where (ip_hash,bucket) in
   (select x.ip_hash,x.bucket from private.account_signup_rates x where x.bucket<rate_bucket-2 order by x.bucket limit 1000);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('account.signup.'||target,0));
 if phase='dispatch' then
  -- Include unconfirmed/disabled accounts. Only authoritative Auth identity
  -- fields qualify; raw_user_meta_data and organization contacts never do.
  if exists(select 1 from auth.users u where lower(btrim(u.email))=address)
   or exists(select 1 from auth.identities i where i.provider='google' and lower(btrim(i.identity_data->>'email'))=address) then
   return jsonb_build_object('data',jsonb_build_object('status','account_exists'));
  end if;
  if exists(select 1 from private.account_signup_claims c where c.target_hash=target) then
   return jsonb_build_object('error','RESULT_NOT_CONFIRMED');
  end if;
  attempt:=private.new_id(ids,2);
  insert into private.account_signup_claims(target_hash,attempt_id) values(target,attempt);
  return jsonb_build_object('_internal_signup_dispatch',true,'attempt_id',attempt);
 end if;
 select c.attempt_id into attempt from private.account_signup_claims c where c.target_hash=target for update;
 if attempt is null or attempt::text is distinct from aux->>'attempt_id' then return jsonb_build_object('error','RESULT_NOT_CONFIRMED');end if;
 if phase='reject' and aux->>'rejection' in ('weak_password','captcha_failed') then
  delete from private.account_signup_claims where target_hash=target;
  return jsonb_build_object('_internal_signup_released',true);
 end if;
 if phase='complete' and exists(select 1 from auth.users u where u.id::text=aux->>'auth_user_id' and lower(btrim(u.email))=address and u.email_confirmed_at is null) then
  -- Native success and the real unconfirmed row agree. No user/session payload
  -- crosses the anonymous boundary; future requests are caught by existence.
  delete from private.account_signup_claims where target_hash=target;
  return jsonb_build_object('data',jsonb_build_object('status','confirmation_required'));
 end if;
 return jsonb_build_object('error','RESULT_NOT_CONFIRMED');
end$$;
revoke all on function private.account_signup_gate(jsonb,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.account_signup_gate(jsonb,uuid[],jsonb) to service_role;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_signup_request_v1','auth.signup','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_signup_request_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.account_signup_gate(p_request,p_ids,p_aux)$$;
revoke all on function api_v1.account_signup_request_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_signup_request_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
