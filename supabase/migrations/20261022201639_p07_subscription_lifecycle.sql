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
begin;
create function private.p07_renew(org uuid,sub_id uuid,operation_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare s core.saas_subscriptions;p core.saas_plan_versions;at timestamptz:=clock_timestamp();period_start timestamptz;period_end timestamptz;step interval;cycles int:=0;due bigint;
begin
 select * into s from core.saas_subscriptions where org_id=org and id=sub_id for update;select * into p from core.saas_plan_versions where id=s.plan_version_id;
 step:=case p.period when 'monthly' then interval '1 month' when 'yearly' then interval '1 year' else null end;
 if step is null or p.price_minor<=0 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if not exists(select 1 from core.organizations where id=org and state='active') then return false;end if;
 if s.state='pending_payment' or s.state='ended' or (s.cancel_at_period_end and s.period_end<=at) then period_start:=at;period_end:=at+step;cycles:=1;
 elsif at<s.period_end then return false;
 else
  period_start:=s.period_end;period_end:=period_start+step;cycles:=1;
  while period_end<=at loop period_start:=period_end;period_end:=period_start+step;cycles:=cycles+1;if cycles>1200 then perform private.fail('POLICY_NOT_CONFIGURED');end if;end loop;
 end if;
 due:=cycles*p.price_minor;if private.p07_funds(org,p.currency)<due then return false;end if;
 perform private.p07_allocate(org,p.currency,s.id,operation_id,due);
 insert into private.p07_subscription_scope(subscription_id,period_start) values(s.id,period_start) on conflict(subscription_id) do update set period_start=excluded.period_start;
 update core.saas_subscriptions set starts_at=period_start,period_end=period_end,grace_until=period_end+interval '7 days',state='active',cancel_at_period_end=false,version=version+1 where id=s.id;
 return true;
end$$;
create function private.p07_normal_payment(op text,r jsonb,org uuid,account uuid,operation_id uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.saas_subscriptions;p core.saas_plan_versions;x core.saas_payment_verifications;id uuid:=private.new_id(ids,2);v bigint:=1;
begin
 select * into s from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1 for update;if s.id is null then perform private.fail('NOT_FOUND');end if;
 select * into p from core.saas_plan_versions where id=s.plan_version_id;
 if op='saas_payment_submit_v1' then
  if r->>'currency'<>p.currency or (r->>'amount_minor')::bigint<=0 then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.saas_payment_verifications(id,org_id,amount_minor,currency,occurred_at,state,reference,period_key) values(id,org,(r->>'amount_minor')::bigint,r->>'currency',(r->>'occurred_at')::timestamptz,'pending',r->>'reference',coalesce(s.period_end,'epoch'::timestamptz)) returning version into v;
  insert into private.p07_payment_origins values(id,'payment');
 else
  select * into x from core.saas_payment_verifications where org_id=org and id=(r->>'payment_id')::uuid for update;
  if x.id is null then perform private.fail('NOT_FOUND');end if;
  if x.state<>'pending' or x.currency<>p.currency then perform private.fail('INVALID_STATE_TRANSITION');end if;
  insert into private.p07_payment_origins values(x.id,'payment') on conflict do nothing;
  update core.saas_payment_verifications set state=case when (r->>'accepted')::bool then 'accepted' else 'rejected' end,verified_at=clock_timestamp(),verified_by=account,version=version+1 where id=x.id returning id,version into id,v;
  if (r->>'accepted')::bool then perform private.p07_renew(org,s.id,operation_id);end if;
 end if;
 return jsonb_build_object('data',jsonb_build_object('primary_id',id,'version',v,'affected',jsonb_build_array(jsonb_build_object('type','saas_payment_verifications','id',id)),'replayed',false),'primary_id',id,'version',v,'subject','saas_payment_verifications');
end$$;
commit;
begin;
do $$begin if not exists(select 1 from pg_roles where rolname='ftk_p07_worker') then create role ftk_p07_worker nologin;end if;end$$;
create table private.p07_worker_scopes(db_role name not null,org_id uuid not null references core.organizations(id),primary key(db_role,org_id));
create table private.p07_jobs(job_id uuid primary key references core.outbox_jobs(id),org_id uuid not null references core.organizations(id),operation text not null check(operation in ('subscription_boundary_apply_v1','privacy_execute_v1')),subscription_id uuid references core.saas_subscriptions(id),operation_key uuid,lease_hash text,payload_hash text,result jsonb);
alter table private.p07_worker_scopes enable row level security;alter table private.p07_jobs enable row level security;
revoke all on private.p07_worker_scopes,private.p07_jobs from public,anon,authenticated,ftk_p07_worker;
grant select,insert,update,delete on private.p07_jobs to service_role;
create function private.p07_worker_scope(org uuid) returns void language plpgsql security invoker set search_path='' as $$
begin if not pg_has_role(session_user,'ftk_p07_worker','member') or not exists(select 1 from private.p07_worker_scopes where db_role=session_user and org_id=org) then perform private.fail('FORBIDDEN');end if;end$$;
create function private.p07_boundary(org uuid,sub_id uuid,operation_id uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.saas_subscriptions;c core.saas_change_requests;p core.saas_plan_versions;owner uuid;changed bool:=false;at timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from core.organizations where id=org and state='active') then return jsonb_build_object('type','saas_subscriptions','id',sub_id);end if;
 select * into s from core.saas_subscriptions where org_id=org and id=sub_id for update;if s.id is null then perform private.fail('NOT_FOUND');end if;
 select * into c from core.saas_change_requests where org_id=org and state='scheduled' and effective_at<=at order by effective_at,id limit 1 for update;
 if c.id is not null then
  select * into p from core.saas_plan_versions where id=c.target_plan_id;
  if p.name<>'business' and not exists(select 1 from core.centers where org_id=org and id=c.kept_center_id and state='active') then perform private.fail('VALIDATION_FAILED');end if;
  update core.saas_subscriptions set plan_version_id=c.target_plan_id,version=version+1 where id=s.id;
  insert into private.p07_subscription_scope(subscription_id,kept_center_id) values(s.id,c.kept_center_id) on conflict(subscription_id) do update set kept_center_id=excluded.kept_center_id;
  update core.saas_change_requests set state='applied',version=version+1 where id=c.id;changed:=true;
 end if;
 if s.period_end<=at and s.state<>'pending_payment' then
  if not s.cancel_at_period_end and private.p07_renew(org,s.id,operation_id) then
   select * into s from core.saas_subscriptions where id=s.id;changed:=true;
  end if;
 end if;
 if s.period_end<=at and s.state<>'pending_payment' then
  update core.saas_subscriptions set state=case when cancel_at_period_end or state='ended' then 'ended' when at<coalesce(grace_until,period_end+interval '7 days') then 'grace' else 'suspended' end,version=version+1 where id=s.id and state is distinct from case when cancel_at_period_end or state='ended' then 'ended' when at<coalesce(grace_until,period_end+interval '7 days') then 'grace' else 'suspended' end;
  changed:=changed or found;
 end if;
 if changed then
  select owner_person_id into owner from core.organizations where id=org;
  insert into core.audit_events(id,org_id,action,subject_table,subject_id,operation_id,diff) values(private.new_id(ids,4),org,'subscription_boundary_apply_v1','saas_subscriptions',s.id,operation_id,jsonb_build_object('old_plan_id',s.plan_version_id,'change_id',c.id,'period_end',s.period_end));
  insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(private.new_id(ids,5),org,owner,'subscription_boundary_apply_v1',s.id,jsonb_build_object('template_key','subscription_boundary_apply_v1','subject',jsonb_build_object('type','saas_subscriptions','id',s.id)));
  insert into core.outbox_jobs(id,org_id,notification_id,kind,dedupe_key,state,attempts,next_attempt_at) values(private.new_id(ids,6),org,private.new_id(ids,5),'in_app',operation_id::text,'pending',0,at);
 end if;
 return jsonb_build_object('type','saas_subscriptions','id',s.id);
end$$;
create function private.p07_jobs_claim(org uuid,ids uuid[],lim int default 1) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare j core.outbox_jobs;s core.saas_subscriptions;c private.p07_jobs;id uuid;token text;idx int:=20;data jsonb:='[]';
begin
 perform private.p07_worker_scope(org);if lim not between 1 and 50 then perform private.fail('VALIDATION_FAILED');end if;
 perform 1 from core.organizations where id=org and state='active' for update;if not found then return '[]'::jsonb;end if;
 for s in select x.* from core.saas_subscriptions x where x.org_id=org and ((x.period_end<=clock_timestamp() and x.state not in ('pending_payment','ended') and (x.state='active' or (x.state='grace' and coalesce(x.grace_until,x.period_end+interval '7 days')<=clock_timestamp()))) or exists(select 1 from core.saas_change_requests z where z.org_id=org and z.state='scheduled' and z.effective_at<=clock_timestamp())) order by x.created_at,x.id desc limit 1 loop
  id:=private.new_id(ids,idx);idx:=idx+1;
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(id,org,'p07.boundary','p07.boundary:'||s.id::text||':'||s.version::text,'pending',0,clock_timestamp()) on conflict(org_id,dedupe_key) do nothing;
  if found then insert into private.p07_jobs(job_id,org_id,operation,subscription_id) values(id,org,'subscription_boundary_apply_v1',s.id);end if;
 end loop;
 update core.outbox_jobs j set state='failed',lease_until=null,version=version+1 from private.p07_jobs c where c.job_id=j.id and c.org_id=org and j.state='running' and j.lease_until<=clock_timestamp() and j.attempts>=3;
 for j in select j.* from core.outbox_jobs j join private.p07_jobs c on c.job_id=j.id where c.org_id=org and c.operation='subscription_boundary_apply_v1' and j.attempts<3 and ((j.state in ('pending','retry_wait') and coalesce(j.next_attempt_at,clock_timestamp())<=clock_timestamp()) or (j.state='running' and j.lease_until<=clock_timestamp())) order by j.created_at,j.id limit lim for update of j skip locked loop
  token:=encode(extensions.gen_random_bytes(32),'hex');update private.p07_jobs set operation_key=private.new_id(ids,idx),lease_hash=encode(extensions.digest(token,'sha256'),'hex'),result=null,payload_hash=null where job_id=j.id returning * into c;idx:=idx+1;
  update core.outbox_jobs set state='running',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds',version=version+1 where id=j.id;
  data:=data||jsonb_build_array(jsonb_build_object('operation',c.operation,'request',jsonb_build_object('client_api_version',1,'request_id',private.new_id(ids,idx),'org_id',org,'job_id',j.id,'operation_key',c.operation_key,'lease_token',token)));idx:=idx+1;
 end loop;return data;
end$$;
create function private.p07_worker_execute(op text,r jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare org uuid:=(r->>'org_id')::uuid;j core.outbox_jobs;c private.p07_jobs;out_result jsonb;reference jsonb;receipt_id uuid:=private.new_id(ids,3);hash text:=encode(extensions.digest((r-'request_id')::text,'sha256'),'hex');code text;
begin
 perform private.p07_worker_scope(org);perform 1 from core.organizations where id=org for update;
 select * into j from core.outbox_jobs where org_id=org and id=(r->>'job_id')::uuid for update;select * into c from private.p07_jobs where job_id=j.id and org_id=org;
 if c.job_id is null or c.operation<>op or c.operation_key is distinct from (r->>'operation_key')::uuid or c.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') or r->>'center_id' is not null then perform private.fail('FORBIDDEN');end if;
 if c.payload_hash is not null and c.payload_hash<>hash then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if c.result is not null then return c.result;end if;
 if j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 begin
  insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at) values(receipt_id,org,'worker:p07:'||session_user,op,encode(extensions.digest(r->>'operation_key','sha256'),'hex'),hash,'in_progress',clock_timestamp()+interval '30 days');
  if op='subscription_boundary_apply_v1' then reference:=private.p07_boundary(org,c.subscription_id,receipt_id,ids);else perform private.fail('FORBIDDEN');end if;
  out_result:=jsonb_build_object('ok',true,'data',jsonb_build_object('job_id',j.id,'state','succeeded','result_reference',reference),'trace_id',private.new_id(ids,1));
  update core.operation_receipts set state='succeeded',result=out_result,business_reference=c.subscription_id where id=receipt_id;
  update core.outbox_jobs set state='succeeded',lease_until=null,version=version+1 where id=j.id;
  update private.p07_jobs set result=out_result,payload_hash=hash where job_id=j.id;
  set constraints all immediate;set constraints all deferred;return out_result;
 exception when others then
  code:=case when SQLSTATE='P0001' and SQLERRM in ('VALIDATION_FAILED','NOT_FOUND','FORBIDDEN','POLICY_NOT_CONFIGURED') then SQLERRM else 'INTEGRITY_VIOLATION' end;
  out_result:=jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',false,'trace_id',private.new_id(ids,1)));return out_result;
 end;
exception when others then
 code:=case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end;return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',code='OPERATION_IN_PROGRESS','trace_id',private.new_id(ids,1)));
end$$;
revoke all on function private.p07_jobs_claim(uuid,uuid[],int),private.p07_worker_execute(text,jsonb,uuid[]) from public,anon,authenticated,service_role;
grant usage on schema private,api_v1 to ftk_p07_worker;
grant execute on function private.p07_jobs_claim(uuid,uuid[],int),private.p07_worker_execute(text,jsonb,uuid[]) to ftk_p07_worker;
commit;
begin;
create or replace function private.center_accessible(org uuid,center uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from core.centers c join core.saas_subscriptions s on s.org_id=c.org_id join core.saas_plan_versions p on p.id=s.plan_version_id left join private.p07_subscription_scope x on x.subscription_id=s.id
 where c.org_id=org and c.id=center and c.state='active' and (p.name='business' or c.id=coalesce(x.kept_center_id,(select id from core.centers where org_id=org and state='active' order by created_at,id limit 1))))
$$;
create or replace function private.assert_center(org uuid,center uuid) returns void language plpgsql stable set search_path='' as $$
begin if not exists(select 1 from core.centers where org_id=org and id=center and state='active') then perform private.fail('NOT_FOUND');end if;if not private.center_accessible(org,center) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;end$$;
create function private.p07_subscription_management(r jsonb,org uuid,actor uuid,platform bool) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.saas_subscriptions;c core.saas_change_requests;op text:=r->>'operation';vals jsonb:='{}';id uuid;typ text;v bigint;state text;
begin
 if r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;
 if op='saas_grace_extend_v1' then if not platform then perform private.fail('FORBIDDEN');end if;
 elsif actor is distinct from (select owner_person_id from core.organizations where id=org) then perform private.fail('FORBIDDEN');end if;
 select * into s from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1;
 id:=s.id;typ:='saas_subscriptions';v:=s.version;state:=s.state;
 if op='subscription_change_cancel_v1' then
  select * into c from core.saas_change_requests where org_id=org and id=(r#>>'{selector,key,change_id}')::uuid;if c.id is null then perform private.fail('NOT_FOUND');end if;id:=c.id;typ:='saas_change_requests';v:=c.version;state:=c.state;vals:=jsonb_build_object('change_id',id);
 elsif op='subscription_renewal_set_v1' then vals:=jsonb_build_object('renew',not s.cancel_at_period_end);
 elsif op='saas_grace_extend_v1' then vals:=jsonb_build_object('until',s.grace_until);
 elsif op in ('subscription_upgrade_quote_v1','subscription_downgrade_request_v1') then
  if r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;vals:=r#>'{selector,key}';
  if not exists(select 1 from core.saas_plan_versions where id=(vals->>'target_plan_id')::uuid) then perform private.fail('NOT_FOUND');end if;
 else perform private.fail('FORBIDDEN');end if;
 if id is null then perform private.fail('NOT_FOUND');end if;
 if r?'entity' and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type',typ,'id',id) then perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('data',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('operation',op,'entity',jsonb_build_object('type',typ,'id',id),'exists',true,'state',state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',typ,'id',id),'version',v)),'as_of',clock_timestamp(),'current',jsonb_build_object('operation',op,'values',vals))),'next_cursor',null,'as_of',clock_timestamp()),'primary_id',id,'subject',typ);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;new text;ops text:=$o$'subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1','saas_grace_extend_v1'$o$;
begin
 old:=$a$ if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 worker anchor mismatch';end if;
 b:=replace(b,old,' if p_operation=''subscription_boundary_apply_v1'' then return private.p07_worker_execute(p_operation,r,p_ids);end if;'||E'\n'||old);
 old:=$a$p_operation in ('subscription_get_v1','saas_payment_submit_v1')$a$;
 if strpos(b,old)=0 then raise exception 'P07 owner billing closed anchor mismatch';end if;
 b:=replace(b,old,$a$(p_operation in ('subscription_get_v1','saas_payment_submit_v1','subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1') or (p_operation='management_state_get_v1' and coalesce(r->>'operation','') in ('subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1')))$a$);
 old:='  mode:=private.access_mode(org);';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 due guard anchor mismatch';end if;
 -- Until the fenced boundary job executes, never expose the expired old plan.
 new:=$a$  if exists(select 1 from core.saas_change_requests where org_id=org and state='scheduled' and effective_at<=clock_timestamp()) and p_operation not in ('subscription_get_v1','subscription_change_cancel_v1','saas_grace_extend_v1') and not (p_operation='management_state_get_v1' and coalesce(r->>'operation','') in ('subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1','saas_grace_extend_v1')) then perform private.fail('OPERATION_IN_PROGRESS');end if;
$a$||old;b:=replace(b,old,new);
 old:=$a$elsif perm_code='management.inspect' then$a$;if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 subscription management permission anchor mismatch';end if;
 b:=replace(b,old,'elsif perm_code=''management.inspect'' and r->>''operation'' in ('||ops||') then perform private.p07_subscription_management(r,org,person,platform);'||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 subscription management domain anchor mismatch';end if;
 b:=replace(b,old,'if p_operation=''management_state_get_v1'' and r->>''operation'' in ('||ops||') then terms:=private.p07_subscription_management(r,org,person,platform);else '||old||'end if;');
 old:=' -- DOMAIN_CASES';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 subscription command anchor mismatch';end if;
 b:=replace(b,old,' when '||ops||' then terms:=private.p07_subscription_command(p_operation,r,org,actor.id,operation_id,p_ids);out:=terms->''data'';record_id:=(terms->>''primary_id'')::uuid;version_n:=(terms->>''version'')::bigint;subject:=terms->>''subject'';'||E'\n'||old);
 old:=substring(b from strpos(b,$a$ when 'saas_payment_submit_v1' then$a$) for strpos(b,$a$ when 'subscription_get_v1' then$a$)-strpos(b,$a$ when 'saas_payment_submit_v1' then$a$));
 if old is null or length(old)<100 then raise exception 'P07 payment cases anchor mismatch';end if;
 b:=replace(b,old,$a$ when 'saas_payment_submit_v1','saas_payment_verify_v1' then
  if r->>'quote_id' is not null or exists(select 1 from private.p07_payment_quotes x join core.saas_payment_verifications p on p.id=x.payment_id where p.org_id=org and x.payment_id=(r->>'payment_id')::uuid) then
   terms:=private.p07_subscription_command(p_operation,r,org,actor.id,operation_id,p_ids);
  else terms:=private.p07_normal_payment(p_operation,r,org,actor.id,operation_id,p_ids);end if;
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;version_n:=(terms->>'version')::bigint;subject:=terms->>'subject';
$a$);
 old:=$a$'pending_change',null$a$;if strpos(b,old)=0 then raise exception 'P07 pending subscription read anchor mismatch';end if;
 b:=replace(b,old,$a$'pending_change',(select jsonb_build_object('type','saas_change_requests','id',id) from core.saas_change_requests where org_id=org and state='scheduled' order by created_at desc,id desc limit 1)$a$);
 b:=replace(b,$a$'period_start',sub.starts_at$a$,$a$'period_start',case when sub.state='pending_payment' then null else private.p07_period_start(sub) end$a$);
 execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
begin;
-- Account deletion has global scope; previews and technical audit never invent a tenant.
create table private.p07_lifecycle_config(singleton boolean primary key default true check(singleton),reauth_max_age_seconds int not null check(reauth_max_age_seconds between 1 and 900));
create table private.p07_lifecycle_previews(id uuid primary key,account_id uuid not null references core.accounts(id),org_id uuid references core.organizations(id),operation text not null,token_hash text not null,snapshot_hash text not null,payload jsonb not null,expires_at timestamptz not null,used boolean not null default false);
create table private.p07_lifecycle_events(id uuid primary key,account_id uuid not null references core.accounts(id),operation_id uuid not null references core.operation_receipts(id),action text not null,created_at timestamptz not null default clock_timestamp(),detail jsonb not null);
create trigger p07_lifecycle_event_immutable before update or delete on private.p07_lifecycle_events for each row execute function private.append_only();
create table private.p07_closure_epochs(org_id uuid not null references core.organizations(id),closed_at timestamptz not null,reopened_at timestamptz,primary key(org_id,closed_at));
alter table private.p07_lifecycle_config enable row level security;
alter table private.p07_lifecycle_previews enable row level security;
alter table private.p07_lifecycle_events enable row level security;
alter table private.p07_closure_epochs enable row level security;
revoke all on private.p07_lifecycle_config,private.p07_lifecycle_previews,private.p07_lifecycle_events,private.p07_closure_epochs from public,anon,authenticated;
grant select on private.p07_lifecycle_config to service_role;
grant select,insert,update on private.p07_lifecycle_previews,private.p07_closure_epochs to service_role;
grant select,insert on private.p07_lifecycle_events to service_role;
alter table core.privacy_requests add constraint p07_privacy_scope check((kind='account_delete' and org_id is null and scope->>'kind'='account' and scope->>'account_id' is not null) or (kind in ('organization_close','organization_delete') and org_id is not null and scope->>'kind'='organization' and scope->>'org_id'=org_id::text));

create function private.p07_lifecycle_snapshot(org uuid,account uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare snapshot jsonb;part jsonb;t text;
begin
 if org is null then
  return jsonb_build_object('account',(select to_jsonb(a) from core.accounts a where id=account),'links',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') from core.account_links l where l.account_id=account),'owned_organizations',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]') from core.organizations o where exists(select 1 from core.account_links l where l.account_id=account and l.org_id=o.id and l.person_id=o.owner_person_id)));
 end if;
 snapshot:='{}';
 -- Fixed reviewed table allowlist. Hash private snapshots; never expose financial rows in previews.
 foreach t in array array['organizations','saas_subscriptions','saas_change_requests','account_links','role_assignments','centers','sessions','reservations','lesson_requests','waitlist_entries','event_registrations','debts','debt_allocations','cash_movements','student_credit_movements','sales','earnings','files'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x) order by x.id),''[]''::jsonb) from core.%I x where x.org_id=$1',t) into part using org;
  snapshot:=snapshot||jsonb_build_object(t,part);
 end loop;return snapshot;
end$$;
create function private.p07_lifecycle_hash(org uuid,account uuid) returns text language sql stable security invoker set search_path='' as $$select encode(extensions.digest(private.p07_lifecycle_snapshot(org,account)::text,'sha256'),'hex')$$;
create function private.p07_lifecycle_owner_blocked(account uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from core.organizations o join core.account_links l on l.org_id=o.id and l.person_id=o.owner_person_id where l.account_id=account and l.state='active' and o.state in ('active','deletion_pending'))
$$;
create function private.p07_lifecycle_impact(org uuid,account uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('active_account_links',(select count(*) from core.account_links l where l.account_id=account and l.state='active' and ($1 is null or l.org_id=$1)),
 'open_sessions',(select count(*) from core.sessions s where s.org_id=$1 and s.state='planned'),
 'open_requests',(select count(*) from core.lesson_requests q where q.org_id=$1 and q.state not in ('cancelled','expired','rejected','completed')),
 'active_reservations',(select count(*) from core.reservations r where r.org_id=$1 and r.state='active'),
 'active_event_registrations',(select count(*) from core.event_registrations r where r.org_id=$1 and r.state='active'),
 'open_debts',(select count(*) from core.debts d where d.org_id=$1 and private.debt_remaining($1,d.id)>0),
 'student_credit_accounts',(select count(*) from (select distinct person_id,center_id,currency from core.student_credit_movements where org_id=$1) x),
 'export_operation','report_export_start_v1','export_requires_scope_check',true,'export_before_closure',true,'physical_erasure_complete',false)
$$;
create function private.p07_lifecycle_reauth(account uuid,aux jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare max_age int;auth_id uuid;
begin
 select reauth_max_age_seconds into max_age from private.p07_lifecycle_config where singleton;
 if max_age is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 select auth_user_id into auth_id from core.accounts where id=account and state in ('active','deletion_pending');
 if aux->>'reauth_verified' is distinct from 'true' or aux->>'reauth_auth_id' is distinct from auth_id::text or not exists(select 1 from auth.sessions s where s.id=(aux->>'reauth_session_id')::uuid and s.user_id=auth_id and s.created_at>=clock_timestamp()-make_interval(secs=>max_age) and s.created_at<=clock_timestamp() and (s.not_after is null or s.not_after>clock_timestamp())) then perform private.fail('AUTH_REQUIRED');end if;
end$$;
create function private.p07_invalidate_auth_sessions(account uuid) returns void language plpgsql security definer set search_path='' as $$
declare auth_id uuid;
begin
 -- Only the validated lifecycle command calls this private administrative primitive.
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;
 select auth_user_id into auth_id from core.accounts a where a.id=account and a.state='deletion_pending';
 if auth_id is null then perform private.fail('FORBIDDEN');end if;
 -- Auth's FK cascades session-bound refresh tokens and AMR claims. Legacy refresh
 -- rows without a session also lose validity; Auth user/identity erasure is a later scope.
 delete from auth.refresh_tokens where user_id=auth_id::text;
 delete from auth.sessions where user_id=auth_id;
end$$;
create function private.p07_lifecycle_preview(op text,r jsonb,org uuid,account uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare preview_id_v uuid:=private.new_id(ids,2);h text;blocks jsonb:='[]';effects jsonb;entity jsonb;deps jsonb;until_at timestamptz:=clock_timestamp()+interval '15 minutes';
begin
 if org is null then
  if op<>'account_delete_preview_v1' then perform private.fail('VALIDATION_FAILED');end if;
  entity:=jsonb_build_object('type','accounts','id',account);
  if private.p07_lifecycle_owner_blocked(account) then blocks:=jsonb_build_array(jsonb_build_object('code','OWNER_TRANSFER_REQUIRED','retryable',false,'trace_id',private.new_id(ids,1)));end if;
 else
  if not exists(select 1 from core.organizations o join core.account_links l on l.org_id=o.id and l.person_id=o.owner_person_id where o.id=org and l.account_id=account and l.state='active' and l.verified_at is not null) then perform private.fail('FORBIDDEN');end if;
  if exists(select 1 from core.organizations where id=org and state in ('deletion_pending','deleted')) then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if btrim(coalesce(r->>'reason',''))='' or (op='organization_delete_preview_v1' and r->>'all_data' is distinct from 'true') then perform private.fail('VALIDATION_FAILED');end if;
  entity:=jsonb_build_object('type','organizations','id',org);
 end if;
 if coalesce(aux->>'token','')='' then perform private.fail('TEMPORARY_FAILURE');end if;
 h:=private.p07_lifecycle_hash(org,account);
 deps:=jsonb_build_object('versions',jsonb_build_array(jsonb_build_object('entity',entity,'version',case when org is null then (select version from core.accounts where id=account) else (select version from core.organizations where id=org) end)),'policy_hashes',jsonb_build_array(h),'permission_hash',account::text);
 effects:=jsonb_build_array(jsonb_build_object('entity',entity,'action',case when op='organization_close_preview_v1' then 'close' else 'delete' end,'reason',case when op='organization_close_preview_v1' then 'Immediate service closure; obligations/history retained; no automatic refunds or attendance.' else 'Immediate access revocation; physical erasure separately tracked, legal holds and external copies require confirmation.' end));
 insert into private.p07_lifecycle_previews(id,account_id,org_id,operation,token_hash,snapshot_hash,payload,expires_at) values(preview_id_v,account,org,replace(op,'_preview_','_apply_'),encode(extensions.digest(aux->>'token','sha256'),'hex'),h,r-'request_id',until_at);
 return jsonb_build_object('id',preview_id_v,'token',aux->'token','scope_hash',h,'dependencies',deps,'effects',effects,'blockers',blocks,'expires_at',until_at,'lifecycle_impact',private.p07_lifecycle_impact(org,account));
end$$;
create function private.p07_lifecycle_command(op text,r jsonb,org uuid,account uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare p private.p07_lifecycle_previews;o core.organizations;s core.saas_subscriptions;request_id_v uuid:=private.new_id(ids,2);ver bigint:=1;scope jsonb;link core.account_links;email_v text;at timestamptz:=clock_timestamp();
begin
 if org is null and op<>'account_delete_apply_v1' then perform private.fail('VALIDATION_FAILED');end if;
 if org is not null then
  select * into o from core.organizations where id=org for update;
  if not exists(select 1 from core.account_links where org_id=org and account_id=account and person_id=o.owner_person_id and state='active' and verified_at is not null) then perform private.fail('FORBIDDEN');end if;
 end if;
 if op='organization_reopen_v1' then
  if o.state<>'closed' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  select * into s from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1 for update;
  if s.state<>'active' or s.starts_at is null or s.starts_at>at or s.period_end<=at then perform private.fail('SERVICE_UNAVAILABLE');end if;
  -- Suppress stale queued notifications/automation; preserve their source history.
  update core.outbox_jobs set state='cancelled',lease_until=null,version=version+1 where org_id=org and (kind='in_app' or kind like 'p05.%') and state in ('pending','running','retry_wait');
  update private.p07_closure_epochs set reopened_at=at where org_id=org and reopened_at is null;
  update core.organizations set state='active',closed_at=null,version=version+1 where id=org returning version into ver;
  return jsonb_build_object('data',jsonb_build_object('operation_id',operation,'primary_id',org,'version',ver,'replayed',false,'related','[]'::jsonb),'primary_id',org,'version',ver,'subject','organizations');
 end if;
 select * into p from private.p07_lifecycle_previews where id=(r#>>'{preview,id}')::uuid for update;
 if p.id is null or p.used or p.account_id<>account or p.org_id is distinct from org or p.operation<>op or p.expires_at<=at or p.token_hash is distinct from encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') then perform private.fail('PREVIEW_STALE');end if;
 if org is null then
  -- Stable lock order across all affected organizations; do not fabricate a tenant for the global request.
  perform 1 from core.organizations where id in (select org_id from core.account_links where account_id=account) order by id for update;
 else
  if o.state in ('deletion_pending','deleted') then perform private.fail('INVALID_STATE_TRANSITION');end if;
 end if;
 if p.snapshot_hash<>private.p07_lifecycle_hash(org,account) then perform private.fail('PREVIEW_STALE');end if;
 if op='organization_close_apply_v1' then
  if o.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if o.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  update core.organizations set state='closed',closed_at=at,version=version+1 where id=org returning version into ver;
  insert into private.p07_closure_epochs(org_id,closed_at) values(org,at);
  update core.saas_subscriptions set cancel_at_period_end=true,version=version+1 where org_id=org and not cancel_at_period_end;
  update core.saas_change_requests set state='cancelled',version=version+1 where org_id=org and state='scheduled';
  update private.p07_lifecycle_previews set used=true where id=p.id;
  return jsonb_build_object('data',jsonb_build_object('operation_id',operation,'primary_id',org,'version',ver,'replayed',false,'related','[]'::jsonb),'primary_id',org,'version',ver,'subject','organizations','reason',p.payload->'reason');
 end if;
 perform private.p07_lifecycle_reauth(account,aux);
 if op='account_delete_apply_v1' then
  if private.p07_lifecycle_owner_blocked(account) then perform private.fail('OWNER_TRANSFER_REQUIRED');end if;
  select u.email into email_v from auth.users u join core.accounts a on a.auth_user_id=u.id where a.id=account;
  for link in select * from core.account_links where account_id=account and state='active' order by org_id,id for update loop
   update core.role_assignments set state='inactive',version=version+1 where account_link_id=link.id and state='active';
   update core.permission_overrides set enabled=false,version=version+1 where org_id=link.org_id and person_id=link.person_id and enabled;
   update private.settlement_grants set granted=false,version=version+1 where org_id=link.org_id and person_id=link.person_id and granted;
  end loop;
  update core.account_links set state='revoked',version=version+1 where account_id=account and state='active';
  update core.invitations set state='revoked',version=version+1 where state='pending' and (lower(email)=lower(email_v) or inviter_account_id=account);
  update core.accounts set state='deletion_pending',disabled_at=at,version=version+1 where id=account;
  perform private.p07_invalidate_auth_sessions(account);
  scope:=jsonb_build_object('kind','account','account_id',account,'org_id',null,'all_data',false);
 else
  if op<>'organization_delete_apply_v1' or r->>'all_data' is distinct from 'true' or p.payload->>'all_data' is distinct from 'true' then perform private.fail('VALIDATION_FAILED');end if;
  update core.organizations set state='deletion_pending',closed_at=coalesce(closed_at,at),version=version+1 where id=org;
  update core.invitations set state='revoked',version=version+1 where org_id=org and state='pending';
  update core.saas_subscriptions set cancel_at_period_end=true,version=version+1 where org_id=org and not cancel_at_period_end;
  update core.saas_change_requests set state='cancelled',version=version+1 where org_id=org and state='scheduled';
  scope:=jsonb_build_object('kind','organization','account_id',null,'org_id',org,'all_data',true);
 end if;
 insert into core.privacy_requests(id,org_id,kind,requester_account_id,scope,state,requested_at) values(request_id_v,org,case when org is null then 'account_delete' else 'organization_delete' end,account,scope,'requested',at);
 perform private.p07_privacy_enqueue(request_id_v,org,private.new_id(ids,12));
 insert into private.p07_lifecycle_events(id,account_id,operation_id,action,detail) values(private.new_id(ids,11),account,operation,op,jsonb_build_object('privacy_request_id',request_id_v,'scope',scope,'state','requested'));
 update private.p07_lifecycle_previews set used=true where id=p.id;
 return jsonb_build_object('data',jsonb_build_object('job_id',private.new_id(ids,12),'state','pending'),'primary_id',request_id_v,'version',1,'subject','privacy_requests','reason',p.payload->'reason');
end$$;
commit;
begin;
-- Global account requests deliberately do not use the tenant-only outbox.
do $$begin if not exists(select 1 from pg_roles where rolname='ftk_p07_privacy_worker') then create role ftk_p07_privacy_worker nologin;end if;end$$;
grant usage on schema private to ftk_p07_privacy_worker;
create table private.p07_privacy_worker_scopes(db_role name not null,org_id uuid references core.organizations(id),unique nulls not distinct(db_role,org_id));
create table private.p07_privacy_jobs(id uuid primary key,request_id uuid not null unique references core.privacy_requests(id),org_id uuid references core.organizations(id),state text not null check(state in ('pending','running','retry_wait','succeeded','failed')),attempts int not null default 0,stage_runs bigint not null default 0,lease_until timestamptz,next_attempt_at timestamptz not null default clock_timestamp(),operation_key uuid,lease_hash text,payload_hash text,result jsonb);
create table private.p07_privacy_manifests(request_id uuid primary key references core.privacy_requests(id),updated_at timestamptz not null default clock_timestamp(),scopes jsonb not null);
alter table private.p07_privacy_worker_scopes enable row level security;alter table private.p07_privacy_jobs enable row level security;alter table private.p07_privacy_manifests enable row level security;
revoke all on private.p07_privacy_worker_scopes,private.p07_privacy_jobs,private.p07_privacy_manifests from public,anon,authenticated,ftk_p07_privacy_worker;
grant select,insert,update on private.p07_privacy_jobs,private.p07_privacy_manifests to service_role;
create function private.p07_privacy_scope(org uuid) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if not pg_has_role(session_user,'ftk_p07_privacy_worker','member') or not exists(select 1 from private.p07_privacy_worker_scopes s where s.db_role=session_user and s.org_id is not distinct from org) then perform private.fail('FORBIDDEN');end if;
end$$;
create function private.p07_privacy_enqueue(request uuid,org uuid,job uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from core.privacy_requests r where r.id=request and r.org_id is not distinct from org and ((org is null and r.kind='account_delete' and r.scope->>'kind'='account') or (org is not null and r.kind='organization_delete' and r.scope->>'org_id'=org::text))) then perform private.fail('NOT_FOUND');end if;
 insert into private.p07_privacy_jobs(id,request_id,org_id,state) values(job,request,org,'pending');
end$$;
create function private.p07_privacy_claim(org uuid,ids uuid[],lim int default 1) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare j private.p07_privacy_jobs;token text;idx int:=20;out_result jsonb:='[]';
begin
 perform private.p07_privacy_scope(org);if lim not between 1 and 50 then perform private.fail('VALIDATION_FAILED');end if;
 update private.p07_privacy_jobs set state='failed',lease_until=null where org_id is not distinct from org and state='running' and lease_until<=clock_timestamp() and attempts>=3;
 for j in select x.* from private.p07_privacy_jobs x where x.org_id is not distinct from org and x.attempts<3 and ((x.state in ('pending','retry_wait') and x.next_attempt_at<=clock_timestamp()) or (x.state='running' and x.lease_until<=clock_timestamp())) order by x.next_attempt_at,x.id limit lim for update skip locked loop
  token:=encode(extensions.gen_random_bytes(32),'hex');
  update private.p07_privacy_jobs set state='running',attempts=attempts+1,operation_key=private.new_id(ids,idx),lease_hash=encode(extensions.digest(token,'sha256'),'hex'),lease_until=clock_timestamp()+interval '60 seconds',result=null,payload_hash=null where id=j.id returning * into j;idx:=idx+1;
  out_result:=out_result||jsonb_build_array(jsonb_build_object('operation','privacy_execute_v1','request',jsonb_build_object('client_api_version',1,'request_id',private.new_id(ids,idx),'org_id',org,'job_id',j.id,'operation_key',j.operation_key,'lease_token',token)));idx:=idx+1;
 end loop;return out_result;
end$$;
create function private.p07_privacy_execute(r jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(r->>'org_id')::uuid;j private.p07_privacy_jobs;p core.privacy_requests;h text:=encode(extensions.digest((r-'request_id')::text,'sha256'),'hex');scopes jsonb;out_result jsonb;code text;receipt_id uuid:=private.new_id(ids,3);
begin
 perform private.p07_privacy_scope(org);
 select * into j from private.p07_privacy_jobs where id=(r->>'job_id')::uuid and org_id is not distinct from org for update;
 if j.id is null or j.operation_key is distinct from (r->>'operation_key')::uuid or j.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') or r->>'center_id' is not null then perform private.fail('FORBIDDEN');end if;
 if j.payload_hash is not null and j.payload_hash<>h then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if j.result is not null then return j.result;end if;
 if j.state<>'running' or j.lease_until<=clock_timestamp() or j.lease_until is null then perform private.fail('OPERATION_IN_PROGRESS');end if;
 select * into p from core.privacy_requests where id=j.request_id and org_id is not distinct from org for update;
 if p.id is null or (org is null and (p.kind<>'account_delete' or p.scope->>'kind'<>'account' or p.scope->>'account_id' is distinct from p.requester_account_id::text)) or (org is not null and (p.kind<>'organization_delete' or p.scope->>'org_id' is distinct from org::text)) then perform private.fail('FORBIDDEN');end if;
 insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at) values(receipt_id,org,'worker:privacy:'||session_user,'privacy_execute_v1',encode(extensions.digest(r->>'operation_key','sha256'),'hex'),h,'in_progress',clock_timestamp()+interval '30 days');
 -- Infrastructure is an explicit completion boundary. Do not equate a successful
 -- lease/stage with erasure, nor invent legal approval, object deletion or backup receipts.
 scopes:=jsonb_build_object('database',jsonb_build_object('state','pending','reason','retention policy, legal holds and scoped purge proof required'),'auth',jsonb_build_object('state',case when org is null then 'pending' else 'not_applicable' end,'reason',case when org is null then 'native Auth identity/session erasure proof required' else 'shared global accounts must be preserved' end),'storage',jsonb_build_object('state','pending','reason','private object deletion and absence proof required'),'exports',jsonb_build_object('state','pending','reason','DB exports, source uploads and temporary copies need verified purge'),'backups',jsonb_build_object('state','pending','reason','backup inventory/expiry and restore non-resurrection proof required'));
 insert into private.p07_privacy_manifests(request_id,scopes) values(p.id,scopes) on conflict(request_id) do update set scopes=excluded.scopes,updated_at=clock_timestamp();
 update core.privacy_requests set state='partial',completed_at=null,version=version+1 where id=p.id;
 out_result:=jsonb_build_object('ok',true,'data',jsonb_build_object('job_id',j.id,'state','retry_wait','result_reference',jsonb_build_object('type','privacy_requests','id',p.id)),'trace_id',private.new_id(ids,1));
 update private.p07_privacy_jobs set state='retry_wait',attempts=greatest(0,attempts-1),stage_runs=stage_runs+1,next_attempt_at=clock_timestamp()+interval '5 minutes',lease_until=null,payload_hash=h,result=out_result where id=j.id;
 update core.operation_receipts set state='succeeded',result=out_result,business_reference=p.id where id=receipt_id;
 insert into private.p07_lifecycle_events(id,account_id,operation_id,action,detail) values(private.new_id(ids,4),p.requester_account_id,receipt_id,'privacy_execute_v1',jsonb_build_object('request_id',p.id,'job_id',j.id,'state','partial','physical_erasure_complete',false));
 return out_result;
exception when others then
 code:=case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',code in ('TEMPORARY_FAILURE','OPERATION_IN_PROGRESS'),'trace_id',private.new_id(ids,1)));
end$$;
create function private.p07_privacy_status(r jsonb,account uuid,aux jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare j private.p07_privacy_jobs;p core.privacy_requests;org uuid:=(r->>'org_id')::uuid;manifest jsonb;
begin
 select * into j from private.p07_privacy_jobs where id=(r->>'job_id')::uuid and org_id is not distinct from org;
 if j.id is null then return null;end if;
 if r->>'center_id' is not null then perform private.fail('NOT_FOUND');end if;
 select * into p from core.privacy_requests where id=j.request_id;
 if org is null then
  if p.requester_account_id is distinct from account then perform private.fail('NOT_FOUND');end if;
  perform private.p07_lifecycle_reauth(account,aux);
 elsif not exists(select 1 from core.organizations o join core.account_links l on l.org_id=o.id and l.person_id=o.owner_person_id where o.id=org and l.account_id=account and l.state='active' and l.verified_at is not null) then perform private.fail('NOT_FOUND');end if;
 select scopes into manifest from private.p07_privacy_manifests where request_id=p.id;
 return jsonb_build_object('id',j.id,'state',j.state,'progress_count',0,'total_count',null,'result_reference',jsonb_build_object('type','privacy_requests','id',p.id),'safe_error_code',case when p.state='partial' then 'RESULT_NOT_CONFIRMED' end,'privacy',jsonb_build_object('request_state',p.state,'completed_at',p.completed_at,'pending_scopes',coalesce((select jsonb_agg(k order by k) from jsonb_each(manifest) e(k,v) where v->>'state'='pending'),case when org is null then '["database","auth","storage","exports","backups"]'::jsonb else '["database","storage","exports","backups"]'::jsonb end)));
end$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
revoke all on function private.p07_privacy_scope(uuid),private.p07_privacy_claim(uuid,uuid[],int),private.p07_privacy_execute(jsonb,uuid[]) from service_role;
grant execute on function private.p07_privacy_scope(uuid),private.p07_privacy_claim(uuid,uuid[],int),private.p07_privacy_execute(jsonb,uuid[]) to ftk_p07_privacy_worker;
commit;
begin;
create function private.p07_account_delete_replay(r jsonb,account uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt core.operation_receipts;h text;
begin
 perform private.p07_lifecycle_reauth(account,aux);
 h:=encode(extensions.digest((r-'operation_key'-'request_id'-'reauth')::text,'sha256'),'hex');
 select * into receipt from core.operation_receipts where org_id is null and actor_fingerprint=account::text and operation='account_delete_apply_v1' and key_hash=encode(extensions.digest(r->>'operation_key','sha256'),'hex');
 if receipt.id is null or receipt.state<>'succeeded' then perform private.fail('SESSION_REVOKED');end if;
 if receipt.payload_hash<>h then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if receipt.result_expires_at<=clock_timestamp() then perform private.fail('OPERATION_RESULT_EXPIRED');end if;
 return jsonb_set(receipt.result,'{trace_id}',to_jsonb(private.new_id(ids,1)));
end$$;
create function private.p07_organization_delete_replay(r jsonb,account uuid,org uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare receipt core.operation_receipts;h text;
begin
 perform private.p07_lifecycle_reauth(account,aux);
 if not exists(select 1 from core.organizations o join core.account_links l on l.org_id=o.id and l.person_id=o.owner_person_id where o.id=org and l.account_id=account and l.state='active' and l.verified_at is not null) then perform private.fail('FORBIDDEN');end if;
 h:=encode(extensions.digest((r-'operation_key'-'request_id'-'reauth')::text,'sha256'),'hex');
 select * into receipt from core.operation_receipts where org_id=org and actor_fingerprint=account::text and operation='organization_delete_apply_v1' and key_hash=encode(extensions.digest(r->>'operation_key','sha256'),'hex');
 if receipt.id is null or receipt.state<>'succeeded' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if receipt.payload_hash<>h then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if receipt.result_expires_at<=clock_timestamp() then perform private.fail('OPERATION_RESULT_EXPIRED');end if;
 if not exists(select 1 from core.privacy_requests p where p.id=receipt.business_reference and p.org_id=org and p.kind='organization_delete' and p.requester_account_id=account) then perform private.fail('NOT_FOUND');end if;
 return jsonb_set(receipt.result,'{trace_id}',to_jsonb(private.new_id(ids,1)));
end$$;
create function private.p07_lifecycle_management(r jsonb,account uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare op text:=r->>'operation';org uuid:=(r->>'org_id')::uuid;entity jsonb;v bigint;st text;at timestamptz:=clock_timestamp();
begin
 if r#>>'{selector,operation}' is distinct from op or r->>'center_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
 if op='account_delete_preview_v1' then
  if org is not null then perform private.fail('VALIDATION_FAILED');end if;
  select version,state into v,st from core.accounts where id=account;
  entity:=jsonb_build_object('type','accounts','id',account);
 elsif op in ('organization_close_preview_v1','organization_reopen_v1','organization_delete_preview_v1') then
  select o.version,o.state into v,st from core.organizations o join core.account_links l on l.org_id=o.id and l.person_id=o.owner_person_id where o.id=org and l.account_id=account and l.state='active' and l.verified_at is not null and o.state in ('active','closed');
  if v is null then perform private.fail('NOT_FOUND');end if;
  entity:=jsonb_build_object('type','organizations','id',org);
 else perform private.fail('FORBIDDEN');end if;
 if r?'entity' and r->'entity'<>'null'::jsonb and r->'entity' is distinct from entity then perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('items',jsonb_build_array(jsonb_build_object('operation',op,'entity',entity,'exists',true,'state',st,'versions',jsonb_build_array(jsonb_build_object('entity',entity,'version',v)),'as_of',at,'current',jsonb_build_object('operation',op,'values','{}'::jsonb))),'next_cursor',null,'as_of',at);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;new text;
begin
 old:=$a$ if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 privacy worker entry anchor mismatch';end if;
 b:=replace(b,old,' if p_operation=''privacy_execute_v1'' then return private.p07_privacy_execute(r,p_ids);end if;'||E'\n'||old);
 old:=$a$ if p_operation='account_profile_update_v1' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle account lock anchor mismatch';end if;
 b:=replace(b,old,$a$ if p_operation in ('account_profile_update_v1','account_delete_apply_v1') then$a$);
 old:=$a$ if actor.state<>'active' then perform private.fail('SESSION_REVOKED');end if;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle replay anchor mismatch';end if;
 b:=replace(b,old,$a$ if p_operation='job_status_get_v1' then out:=private.p07_privacy_status(r,actor.id,p_aux);if out is not null then return jsonb_build_object('ok',true,'data',out,'trace_id',trace);end if;if org is null then perform private.fail('NOT_FOUND');end if;end if;
 if actor.state='deletion_pending' and p_operation='account_delete_apply_v1' then return private.p07_account_delete_replay(r,actor.id,p_ids,p_aux);end if;
 if actor.state<>'active' then perform private.fail('SESSION_REVOKED');end if;
 -- Reauth is trusted server context only; never retain the bearer proof in audit/receipt context.
 if p_operation in ('account_delete_apply_v1','organization_delete_apply_v1') then r:=r-'reauth';end if;
 if p_operation='organization_delete_apply_v1' and exists(select 1 from core.organizations where id=org and state in ('deletion_pending','deleted')) then return private.p07_organization_delete_replay(r,actor.id,org,p_ids,p_aux);end if;
 if p_operation='management_state_get_v1' and r->>'operation' in ('account_delete_preview_v1','organization_close_preview_v1','organization_reopen_v1','organization_delete_preview_v1') then out:=private.p07_lifecycle_management(r,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);end if;$a$);
 old:=$a$ if org is not null then
  -- Shared access gate.$a$;
 if strpos(b,old)=0 then raise exception 'P07 lifecycle tenant gate anchor mismatch';end if;
 -- Account lifecycle is global, regardless of caller-supplied transport context.
 b:=replace(b,old,$a$ if p_operation in ('account_delete_preview_v1','account_delete_apply_v1') and (org is not null or center is not null) then perform private.fail('VALIDATION_FAILED');end if;
 if org is not null then
  -- Shared access gate.$a$);
 old:=$a$'manager_self_assign_center_v1') then perform private.fail('SUBSCRIPTION_NOT_STARTED');$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle bootstrap owner anchor mismatch';end if;
 b:=replace(b,old,$a$'manager_self_assign_center_v1','organization_close_preview_v1','organization_close_apply_v1','organization_delete_preview_v1','organization_delete_apply_v1') then perform private.fail('SUBSCRIPTION_NOT_STARTED');$a$);
 old:=$a$  mode:=private.access_mode(org);$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle closed tenant anchor mismatch';end if;
 b:=replace(b,old,old||E'\n'||$a$  if exists(select 1 from core.organizations where id=org and state in ('deletion_pending','deleted')) then perform private.fail('SERVICE_UNAVAILABLE');end if;$a$);
 old:=$a$p_operation not in ('subscription_get_v1','subscription_change_cancel_v1','saas_grace_extend_v1')$a$;
 if strpos(b,old)=0 then raise exception 'P07 lifecycle due boundary anchor mismatch';end if;
 b:=replace(b,old,$a$p_operation not in ('subscription_get_v1','subscription_change_cancel_v1','saas_grace_extend_v1','organization_close_preview_v1','organization_close_apply_v1','organization_reopen_v1','organization_delete_preview_v1','organization_delete_apply_v1')$a$);
 -- Owner lifecycle metadata must remain available after service closure/expiration.
 old:=$a$p_operation in ('subscription_get_v1','saas_payment_submit_v1','subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1')$a$;
 if strpos(b,old)=0 then raise exception 'P07 lifecycle closed owner anchor mismatch';end if;
 b:=replace(b,old,$a$p_operation in ('subscription_get_v1','saas_payment_submit_v1','subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1','organization_close_preview_v1','organization_close_apply_v1','organization_reopen_v1','organization_delete_preview_v1','organization_delete_apply_v1')$a$);
 old:=$a$ elsif p_operation='account_profile_update_v1' then null;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle self permission anchor mismatch';end if;
 b:=replace(b,old,$a$ elsif p_operation in ('account_profile_update_v1','account_delete_preview_v1','account_delete_apply_v1') then null;$a$);
 old:=' -- DOMAIN_CASES';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle dispatch anchor mismatch';end if;
 new:=$a$
 when 'account_delete_preview_v1','organization_close_preview_v1','organization_delete_preview_v1' then
  out:=private.p07_lifecycle_preview(p_operation,r,org,actor.id,p_ids,p_aux);
 when 'account_delete_apply_v1','organization_close_apply_v1','organization_reopen_v1','organization_delete_apply_v1' then
  terms:=private.p07_lifecycle_command(p_operation,r,org,actor.id,operation_id,p_ids,p_aux);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;version_n:=(terms->>'version')::bigint;subject:=terms->>'subject';
  audit_delta:=jsonb_build_object('after',out,'physical_erasure_complete',false);
  if terms->>'reason' is not null then r:=r||jsonb_build_object('reason',terms->>'reason');end if;
 -- DOMAIN_CASES$a$;
 b:=replace(b,old,new);execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
-- Worker-only functions do not become an HTTP service-role bypass.
revoke all on function private.p07_worker_scope(uuid),private.p07_jobs_claim(uuid,uuid[],int),private.p07_worker_execute(text,jsonb,uuid[]),private.p07_privacy_scope(uuid),private.p07_privacy_claim(uuid,uuid[],int),private.p07_privacy_execute(jsonb,uuid[]) from service_role;
commit;
begin;
create function private.p07_due_allowed(org uuid,due_at timestamptz) returns boolean language sql stable security invoker set search_path='' as $$
 select due_at is not null and not exists(select 1 from private.p07_closure_epochs e where e.org_id=org and due_at>=e.closed_at and due_at<coalesce(e.reopened_at,'infinity'::timestamptz))
$$;
create function private.p07_reminder_allowed(org uuid,center uuid,kind text,target uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare due_at timestamptz;days_or_hours int;
begin
 if not exists(select 1 from private.p07_closure_epochs where org_id=org) then return true;end if;
 if kind='lesson' then
  select s.starts_at-interval '24 hours' into due_at from core.reservations r join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.center_id=center and r.id=target;
 elsif kind='entitlement' then
  select (p.value->>'value')::int into days_or_hours from private.policy_at(org,center,'entitlement_reminder_days',clock_timestamp()) p;
  select valid_until-make_interval(days=>days_or_hours) into due_at from core.sales where org_id=org and center_id=center and id=target;
 else return false;end if;
 return private.p07_due_allowed(org,due_at);
end$$;
create function private.p07_automation_allowed(org uuid,center uuid,trigger jsonb,target uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare due_at timestamptz;days int:=(trigger->>'offset_days')::int;
begin
 if not exists(select 1 from private.p07_closure_epochs where org_id=org) then return true;end if;
 if trigger->>'kind'='lead_followup_due' then
  select a.due_at-make_interval(days=>days) into due_at from core.crm_activities a where a.org_id=org and a.center_id=center and a.id=target;
 elsif trigger->>'kind'='entitlement_expiring' then
  select valid_until-make_interval(days=>days) into due_at from core.sales where org_id=org and center_id=center and id=target;
 elsif trigger->>'kind'='student_inactive' then
  select coalesce(last_seen.at,cr.started_at)+make_interval(days=>days) into due_at from core.center_relationships cr left join lateral(select max(coalesce(s.actual_started_at,s.starts_at)) at from core.attendance_entries a join core.reservations r on r.org_id=a.org_id and r.id=a.reservation_id join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.center_id=center and r.person_id=cr.person_id and a.result='attended' and r.state='completed') last_seen on true where cr.org_id=org and cr.center_id=center and cr.id=target;
 else return false;end if;
 return private.p07_due_allowed(org,due_at);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.p05_jobs_claim(uuid,uuid[],integer)'::regprocedure);a text;
begin
 a:=$a$where r.org_id=org and r.state='active' and s.state='planned'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 reopened lesson reminder anchor mismatch';end if;
 b:=replace(b,a,$a$where r.org_id=org and private.p07_reminder_allowed(org,r.center_id,'lesson',r.id) and r.state='active' and s.state='planned'$a$);
 a:=$a$where s.org_id=org and s.state='active' and s.valid_until>clock_timestamp()$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 reopened entitlement reminder anchor mismatch';end if;
 b:=replace(b,a,$a$where s.org_id=org and private.p07_reminder_allowed(org,s.center_id,'entitlement',s.id) and s.state='active' and s.valid_until>clock_timestamp()$a$);
 a:=$a$z where not exists(select 1 from core.outbox_jobs$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 reopened automation anchor mismatch';end if;
 b:=replace(b,a,$a$z where private.p07_automation_allowed(org,c,cfg.trigger,z.target_id) and not exists(select 1 from core.outbox_jobs$a$);
 execute b;
end$patch$;
revoke all on function private.p07_due_allowed(uuid,timestamptz),private.p07_reminder_allowed(uuid,uuid,text,uuid),private.p07_automation_allowed(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.p07_due_allowed(uuid,timestamptz),private.p07_reminder_allowed(uuid,uuid,text,uuid),private.p07_automation_allowed(uuid,uuid,jsonb,uuid) to service_role;
commit;
begin;
-- Extend the accepted native scheduler; new lanes stay disabled and unbound until installation.
do $$declare lane text;r text;begin
 foreach lane in array array['p07','p07_privacy'] loop
  r:='ftk_ops_'||lane;
  if not exists(select 1 from pg_roles where rolname=r) then execute format('create role %I login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null',r);end if;
  if exists(select 1 from pg_roles where rolname=r and (not rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then raise exception 'UNSAFE_HOSTED_WORKER_ROLE';end if;
  if exists(select 1 from pg_auth_members m join pg_roles child on child.oid=m.member join pg_roles parent on parent.oid=m.roleid where child.rolname=r and parent.rolname<>'ftk_'||lane||'_worker') then raise exception 'UNEXPECTED_HOSTED_WORKER_MEMBERSHIP';end if;
  execute format('alter role %I password null',r);
  execute format('grant %I to %I','ftk_'||lane||'_worker',r);
  execute format('grant usage on schema private,extensions to %I',r);
  execute format('alter role %I connection limit 2',r);
  execute format('alter role %I set statement_timeout = %L',r,'30s');
  execute format('alter role %I set lock_timeout = %L',r,'5s');
  execute format('alter role %I set idle_in_transaction_session_timeout = %L',r,'30s');
 end loop;
end$$;
alter table private.ops_worker_health drop constraint ops_worker_health_lane_check;
alter table private.ops_worker_health add constraint ops_worker_health_lane_check check(lane in ('p01','p05','p06','p07','p07_privacy'));
insert into private.ops_worker_health(lane) values('p07'),('p07_privacy');
revoke all on private.ops_worker_health from ftk_p07_worker,ftk_p07_privacy_worker;
create function private.p07_ops_begin(lane text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict error
declare h private.ops_worker_health;orgs uuid[];chosen uuid;
begin
 perform private.ops_identity(lane);
 select * into h from private.ops_worker_health w where w.lane=p07_ops_begin.lane for update;
 if not h.enabled then return jsonb_build_object('enabled',false);end if;
 if lane='p07' then select array_agg(w.org_id order by w.org_id) into orgs from private.p07_worker_scopes w where w.db_role=session_user;
 elsif lane='p07_privacy' then select array_agg(w.org_id order by w.org_id nulls first) into orgs from private.p07_privacy_worker_scopes w where w.db_role=session_user;
 else perform private.fail('FORBIDDEN');end if;
 if h.last_started_at is null then chosen:=orgs[1];
 else
  select u into chosen from unnest(orgs) u where u is not null and (h.last_org is null or u>h.last_org) order by u limit 1;
  if not found then chosen:=orgs[1];end if;
 end if;
 update private.ops_worker_health w set last_started_at=clock_timestamp(),last_status='running',last_error_code=null,last_org=chosen,ticks=w.ticks+1 where w.lane=p07_ops_begin.lane;
 return jsonb_build_object('enabled',true,'org',chosen,'has_scope',coalesce(cardinality(orgs),0)>0);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.ops_identity(text)'::regprocedure);
 a:=$a$lane not in ('p01','p05','p06')$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler identity anchor mismatch';end if;
 execute replace(b,a,$a$lane not in ('p01','p05','p06','p07','p07_privacy')$a$);
 b:=pg_get_functiondef('private.ops_begin(text)'::regprocedure);
 a:=' perform private.ops_identity(lane);';if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler begin anchor mismatch';end if;
 execute replace(b,a,$a$ if lane in ('p07','p07_privacy') then return private.p07_ops_begin(lane);end if;$a$||E'\n'||a);
 b:=pg_get_functiondef('private.ops_run(text)'::regprocedure);
 a:=' if org is null then';if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler global scope anchor mismatch';end if;
 b:=replace(b,a,$a$ if org is null and coalesce(ctx->>'has_scope','false')<>'true' then$a$);
 a:='  else jobs:=private.p06_jobs_claim';if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler claim anchor mismatch';end if;
 b:=replace(b,a,$a$  elsif lane='p07' then jobs:=private.p07_jobs_claim(org,private.ops_uuid_bank(4096),1);
  elsif lane='p07_privacy' then jobs:=private.p07_privacy_claim(org,private.ops_uuid_bank(4096),1);
$a$||a);
 a:=$a$   else
    n:=4096;$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler execute anchor mismatch';end if;
 b:=replace(b,a,$a$   elsif lane='p07' then answer:=private.p07_worker_execute(j->>'operation',j->'request',private.ops_uuid_bank(4096));
   elsif lane='p07_privacy' then answer:=private.p07_privacy_execute(j->'request',private.ops_uuid_bank(4096));
$a$||a);execute b;
 b:=pg_get_functiondef('private.ops_finish(text,text,text,integer,integer,integer)'::regprocedure);
 a:=$a$'ftksaas-ops-p01','ftksaas-ops-p05','ftksaas-ops-p06'$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler retention anchor mismatch';end if;
 execute replace(b,a,a||$a$,'ftksaas-ops-p07','ftksaas-ops-p07_privacy'$a$);
end$patch$;
revoke all on function private.p07_ops_begin(text) from public,anon,authenticated,service_role;
grant execute on function private.ops_identity(text),private.ops_uuid_bank(int),private.ops_begin(text),private.ops_finish(text,text,text,int,int,int) to ftk_ops_p07,ftk_ops_p07_privacy;
grant execute on procedure private.ops_run(text) to ftk_ops_p07,ftk_ops_p07_privacy;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_delete_preview_v1','account.self','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_delete_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('account_delete_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.account_delete_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_delete_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_delete_apply_v1','account.self','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_delete_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('account_delete_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.account_delete_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_delete_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('organization_close_preview_v1','org.owner','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.organization_close_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organization_close_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.organization_close_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organization_close_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('organization_close_apply_v1','org.owner','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.organization_close_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organization_close_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.organization_close_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organization_close_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('organization_reopen_v1','org.owner','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.organization_reopen_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organization_reopen_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.organization_reopen_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organization_reopen_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('organization_delete_preview_v1','org.owner','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.organization_delete_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organization_delete_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.organization_delete_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organization_delete_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('organization_delete_apply_v1','org.owner','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.organization_delete_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organization_delete_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.organization_delete_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organization_delete_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('subscription_upgrade_quote_v1','subscription.owner','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.subscription_upgrade_quote_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('subscription_upgrade_quote_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.subscription_upgrade_quote_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.subscription_upgrade_quote_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('subscription_downgrade_request_v1','subscription.owner','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.subscription_downgrade_request_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('subscription_downgrade_request_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.subscription_downgrade_request_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.subscription_downgrade_request_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('subscription_change_cancel_v1','subscription.owner','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.subscription_change_cancel_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('subscription_change_cancel_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.subscription_change_cancel_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.subscription_change_cancel_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('subscription_renewal_set_v1','subscription.owner','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.subscription_renewal_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('subscription_renewal_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.subscription_renewal_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.subscription_renewal_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('saas_grace_extend_v1','saas.operator','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.saas_grace_extend_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('saas_grace_extend_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.saas_grace_extend_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.saas_grace_extend_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('privacy_execute_v1','system.worker','worker',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.privacy_execute_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('privacy_execute_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.privacy_execute_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.privacy_execute_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('subscription_boundary_apply_v1','system.worker','worker',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.subscription_boundary_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('subscription_boundary_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.subscription_boundary_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.subscription_boundary_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
revoke all on function private.p07_worker_scope(uuid),private.p07_jobs_claim(uuid,uuid[],int),private.p07_worker_execute(text,jsonb,uuid[]),private.p07_privacy_scope(uuid),private.p07_privacy_claim(uuid,uuid[],int),private.p07_privacy_execute(jsonb,uuid[]) from service_role;
notify pgrst,'reload schema';
commit;
