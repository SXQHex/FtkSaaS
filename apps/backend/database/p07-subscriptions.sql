begin;
-- Prices and quote validity are explicit deployment configuration; no invented tariff.
create table private.p07_billing_config(singleton boolean primary key default true check(singleton),quote_ttl_seconds int not null check(quote_ttl_seconds between 1 and 86400));
create table private.p07_subscription_scope(subscription_id uuid primary key references core.saas_subscriptions(id),kept_center_id uuid references core.centers(id),period_start timestamptz);
create table private.p07_quote_context(quote_id uuid primary key references core.saas_quotes(id),subscription_id uuid not null references core.saas_subscriptions(id),subscription_version bigint not null,original_period_end timestamptz not null,period_start timestamptz not null,period_end timestamptz not null,arrears_minor bigint not null,delta_minor bigint not null);
create table private.p07_payment_quotes(payment_id uuid primary key references core.saas_payment_verifications(id),quote_id uuid not null references core.saas_quotes(id));
create index p07_payment_quote on private.p07_payment_quotes(quote_id);
alter table private.p07_billing_config enable row level security;alter table private.p07_subscription_scope enable row level security;alter table private.p07_quote_context enable row level security;alter table private.p07_payment_quotes enable row level security;
revoke all on private.p07_billing_config,private.p07_subscription_scope,private.p07_quote_context,private.p07_payment_quotes from public,anon,authenticated;
grant select on private.p07_billing_config to service_role;
grant select,insert,update,delete on private.p07_subscription_scope,private.p07_quote_context,private.p07_payment_quotes to service_role;
create table private.p07_payment_origins(payment_id uuid primary key references core.saas_payment_verifications(id),kind text not null check(kind in ('payment','quote_confirmation')));
create table private.p07_payment_allocations(payment_id uuid not null references core.saas_payment_verifications(id),operation_id uuid not null references core.operation_receipts(id),subscription_id uuid not null references core.saas_subscriptions(id),amount_minor bigint not null check(amount_minor>0),primary key(payment_id,operation_id));
create index p07_allocated_subscription on private.p07_payment_allocations(subscription_id);
alter table private.p07_payment_origins enable row level security;alter table private.p07_payment_allocations enable row level security;
revoke all on private.p07_payment_origins,private.p07_payment_allocations from public,anon,authenticated;
grant select,insert on private.p07_payment_origins,private.p07_payment_allocations to service_role;
create function private.p07_funds(org uuid,currency text) returns bigint language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
begin
 -- Legacy accepted money needs proven reconciliation, never a guessed burn.
 if exists(select 1 from core.saas_payment_verifications p where p.org_id=org and p.currency=currency and p.state='accepted' and not exists(select 1 from private.p07_payment_origins x where x.payment_id=p.id)) then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 return (select coalesce(sum(p.amount_minor-coalesce((select sum(a.amount_minor) from private.p07_payment_allocations a where a.payment_id=p.id),0)),0) from core.saas_payment_verifications p join private.p07_payment_origins o on o.payment_id=p.id where p.org_id=org and p.currency=currency and p.state='accepted');
end$$;
create function private.p07_allocate(org uuid,currency text,sub uuid,operation uuid,amount bigint) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare p record;remaining bigint:=amount;n bigint;
begin
 if amount<0 or private.p07_funds(org,currency)<amount then perform private.fail('INTEGRITY_VIOLATION');end if;
 for p in select x.id,x.amount_minor-coalesce((select sum(a.amount_minor) from private.p07_payment_allocations a where a.payment_id=x.id),0) available from core.saas_payment_verifications x where x.org_id=org and x.currency=currency and x.state='accepted' order by x.verified_at,x.id for update of x loop
  exit when remaining=0;n:=least(remaining,p.available);if n>0 then insert into private.p07_payment_allocations values(p.id,operation,sub,n);remaining:=remaining-n;end if;
 end loop;if remaining<>0 then perform private.fail('INTEGRITY_VIOLATION');end if;
end$$;
create function private.p07_period_start(s core.saas_subscriptions) returns timestamptz language plpgsql stable security invoker set search_path='' as $$
declare start_at timestamptz;step interval;n int:=0;
begin
 select x.period_start into start_at from private.p07_subscription_scope x where x.subscription_id=s.id;if start_at is not null then return start_at;end if;
 select case p.period when 'monthly' then interval '1 month' when 'yearly' then interval '1 year' end into step from core.saas_plan_versions p where p.id=s.plan_version_id;
 if step is null or s.starts_at is null or s.period_end is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 start_at:=s.starts_at;
 while start_at+step<s.period_end loop start_at:=start_at+step;n:=n+1;if n>1200 then perform private.fail('POLICY_NOT_CONFIGURED');end if;end loop;
 if start_at+step<>s.period_end then perform private.fail('POLICY_NOT_CONFIGURED');end if;return start_at;
end$$;
create function private.p07_plan_rank(plan_name text) returns int language sql immutable security invoker set search_path='' as $$select case plan_name when 'starter' then 1 when 'pro' then 2 when 'business' then 3 else null end$$;
create function private.p07_subscription_command(op text,r jsonb,org uuid,actor_account uuid,operation_id uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.saas_subscriptions;p core.saas_plan_versions;t core.saas_plan_versions;c core.saas_change_requests;q core.saas_quotes;cfg private.p07_billing_config;ctx private.p07_quote_context;pay core.saas_payment_verifications;id uuid:=private.new_id(ids,2);v bigint:=1;at timestamptz:=clock_timestamp();period_start timestamptz;period_end timestamptz;step interval;cycles int;paid bigint;arrears bigint;delta bigint;due bigint;kept uuid;data jsonb;subject text;
begin
 select * into s from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1 for update;
 if s.id is null then perform private.fail('NOT_FOUND');end if;
 select * into p from core.saas_plan_versions where id=s.plan_version_id;
 if op='subscription_upgrade_quote_v1' then
  select * into cfg from private.p07_billing_config where singleton;if cfg.singleton is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  select * into t from core.saas_plan_versions where id=(r->>'target_plan_id')::uuid and effective_at<=at;
  if t.id is null then perform private.fail('NOT_FOUND');end if;
  if s.starts_at is null or s.period_end is null or s.state in ('pending_payment','ended') or (s.cancel_at_period_end and s.period_end<=at) then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
  if t.period<>p.period or t.currency<>p.currency or private.p07_plan_rank(t.name)<=private.p07_plan_rank(p.name) or t.price_minor<p.price_minor then perform private.fail('VALIDATION_FAILED');end if;
  step:=case p.period when 'monthly' then interval '1 month' when 'yearly' then interval '1 year' else null end;if step is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  period_start:=private.p07_period_start(s);period_end:=s.period_end;cycles:=0;
  -- Financial arrears only; no missed automation or notification is replayed.
  if at>=s.period_end then
   for period_start in select x from generate_series(s.period_end,at,step) x limit 1201 loop
    cycles:=cycles+1;if cycles>1200 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   end loop;
   period_end:=period_start+step;
  end if;
  paid:=private.p07_funds(org,p.currency);
  arrears:=cycles*p.price_minor;
  delta:=ceil((t.price_minor-p.price_minor)::numeric*greatest(0,extract(epoch from period_end-at))/nullif(extract(epoch from period_end-period_start),0));
  due:=greatest(0,arrears+delta-paid);
  insert into core.saas_quotes(id,org_id,from_plan_id,to_plan_id,amount_minor,currency,expires_at,state) values(id,org,p.id,t.id,due,p.currency,least(at+make_interval(secs=>cfg.quote_ttl_seconds),period_end),'active') returning version into v;
  insert into private.p07_quote_context values(id,s.id,s.version,s.period_end,period_start,period_end,arrears,delta);
  data:=jsonb_build_object('id',id,'from_plan',p.name,'to_plan',t.name,'period_start',period_start,'period_end',period_end,'amount_minor',due::text,'currency',p.currency,'expires_at',least(at+make_interval(secs=>cfg.quote_ttl_seconds),period_end));subject:='saas_quotes';
 elsif op='subscription_downgrade_request_v1' then
  if s.period_end is null or at>=s.period_end or s.state<>'active' then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
  select * into t from core.saas_plan_versions where id=(r->>'target_plan_id')::uuid and effective_at<=at;if t.id is null then perform private.fail('NOT_FOUND');end if;
  if t.period<>p.period or t.currency<>p.currency or private.p07_plan_rank(t.name)>=private.p07_plan_rank(p.name) then perform private.fail('VALIDATION_FAILED');end if;
  kept:=(r->>'kept_center_id')::uuid;
  if t.name<>'business' then
   if kept is null or not exists(select 1 from core.centers where org_id=org and id=kept and state='active') then perform private.fail('VALIDATION_FAILED');end if;
  end if;
  update core.saas_change_requests set state='cancelled',version=version+1 where org_id=org and state='scheduled';
  insert into core.saas_change_requests(id,org_id,target_plan_id,kept_center_id,effective_at,state) values(id,org,t.id,kept,s.period_end,'scheduled') returning version into v;subject:='saas_change_requests';
 elsif op='subscription_change_cancel_v1' then
  select * into c from core.saas_change_requests where org_id=org and id=(r->>'change_id')::uuid for update;if c.id is null then perform private.fail('NOT_FOUND');end if;
  if c.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if c.state<>'scheduled' or c.effective_at<=at then perform private.fail('VALIDATION_FAILED');end if;
  update core.saas_change_requests set state='cancelled',version=version+1 where id=c.id returning id,version into id,v;subject:='saas_change_requests';
 elsif op='subscription_renewal_set_v1' then
  if s.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if s.period_end is null or s.period_end<=at or s.state<>'active' then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
  update core.saas_subscriptions set cancel_at_period_end=not (r->>'renew')::bool,version=version+1 where id=s.id returning id,version into id,v;subject:='saas_subscriptions';
 elsif op='saas_grace_extend_v1' then
  if s.period_end is null or s.period_end>at or s.cancel_at_period_end or s.state in ('pending_payment','ended') or (r->>'until')::timestamptz<=greatest(at,coalesce(s.grace_until,s.period_end+interval '7 days')) or btrim(coalesce(r->>'reason',''))='' then perform private.fail('VALIDATION_FAILED');end if;
  update core.saas_subscriptions set grace_until=(r->>'until')::timestamptz,state='grace',version=version+1 where id=s.id returning id,version into id,v;subject:='saas_subscriptions';
 elsif op='saas_payment_submit_v1' then
  select * into q from core.saas_quotes where org_id=org and id=(r->>'quote_id')::uuid for update;select * into ctx from private.p07_quote_context where quote_id=q.id;
  if q.id is null then perform private.fail('NOT_FOUND');end if;
  if q.state<>'active' or q.expires_at<=at or ctx.subscription_id<>s.id or ctx.subscription_version<>s.version or ctx.original_period_end<>s.period_end then perform private.fail('VERSION_CONFLICT');end if;
  if r->>'currency'<>q.currency or (r->>'amount_minor')::bigint<0 or ((r->>'amount_minor')::bigint=0 and q.amount_minor<>0) then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.saas_payment_verifications(id,org_id,amount_minor,currency,occurred_at,state,reference,period_key) values(id,org,(r->>'amount_minor')::bigint,r->>'currency',(r->>'occurred_at')::timestamptz,'pending',r->>'reference',s.period_end) returning version into v;
  insert into private.p07_payment_quotes values(id,q.id);
  insert into private.p07_payment_origins values(id,case when (r->>'amount_minor')::bigint=0 then 'quote_confirmation' else 'payment' end);subject:='saas_payment_verifications';
 elsif op='saas_payment_verify_v1' then
  select * into pay from core.saas_payment_verifications where org_id=org and id=(r->>'payment_id')::uuid for update;
  select x.* into q from core.saas_quotes x join private.p07_payment_quotes b on b.quote_id=x.id where b.payment_id=pay.id and x.org_id=org for update of x;
  select * into ctx from private.p07_quote_context where quote_id=q.id;
  if pay.id is null or q.id is null then perform private.fail('NOT_FOUND');end if;
  if pay.state<>'pending' or q.state<>'active' or ctx.subscription_id<>s.id or ctx.subscription_version<>s.version or ctx.original_period_end<>s.period_end then perform private.fail('VERSION_CONFLICT');end if;
  if (r->>'accepted')::bool and q.expires_at<=at then perform private.fail('VERSION_CONFLICT');end if;
  update core.saas_payment_verifications set state=case when (r->>'accepted')::bool then 'accepted' else 'rejected' end,verified_at=at,verified_by=actor_account,version=version+1 where id=pay.id returning id,version into id,v;
  paid:=private.p07_funds(org,p.currency);
  if paid>=ctx.arrears_minor+ctx.delta_minor and (r->>'accepted')::bool then
   perform private.p07_allocate(org,p.currency,s.id,operation_id,ctx.arrears_minor+ctx.delta_minor);
   insert into private.p07_subscription_scope(subscription_id,period_start) values(s.id,ctx.period_start) on conflict(subscription_id) do update set period_start=excluded.period_start;
   update core.saas_subscriptions set plan_version_id=q.to_plan_id,starts_at=ctx.period_start,period_end=ctx.period_end,grace_until=ctx.period_end+interval '7 days',state='active',version=version+1 where id=s.id;
   update core.saas_quotes set state='accepted',version=version+1 where id=q.id;
  end if;subject:='saas_payment_verifications';
 else perform private.fail('NOT_FOUND');end if;
 if data is null then data:=jsonb_build_object('primary_id',id,'version',v,'affected',jsonb_build_array(jsonb_build_object('type',subject,'id',id)),'replayed',false);end if;
 return jsonb_build_object('data',data,'primary_id',id,'version',v,'subject',subject);
end$$;
commit;
