begin;
-- Reuse the one organization change queue; NULL source denotes existing plan changes.
alter table core.saas_change_requests add column if not exists source_plan_id uuid references core.saas_plan_versions(id);
alter table core.saas_change_requests add column if not exists subscription_id uuid;
alter table core.saas_change_requests add constraint saas_period_change_subscription_fk foreign key(org_id,subscription_id) references core.saas_subscriptions(org_id,id),
 add constraint saas_period_change_source check((source_plan_id is null)=(subscription_id is null));
create unique index saas_one_scheduled_change on core.saas_change_requests(org_id) where state='scheduled';

create function private.subscription_plan_terms(p core.saas_plan_versions) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',p.id,'period',p.period,'amount_minor',p.price_minor::text,'currency',p.currency)
$$;
create function private.subscription_billing(org uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.saas_subscriptions;p core.saas_plan_versions;data jsonb;
begin
 select * into s from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1;
 select * into p from core.saas_plan_versions where id=s.plan_version_id;
 data:=jsonb_build_object('current',private.subscription_plan_terms(p),
  'period_change_options',coalesce((select jsonb_agg(private.subscription_plan_terms(t) order by t.effective_at,t.id)
   from core.saas_plan_versions t where t.name=p.name and t.currency=p.currency and t.period<>p.period and t.effective_at<=statement_timestamp()
   and t.price_minor>0 and t.features=p.features and t.limits=p.limits),'[]'::jsonb),
  'pending_period_change',(select jsonb_build_object('id',c.id,'version',c.version,'target',private.subscription_plan_terms(t),'effective_at',c.effective_at)
   from core.saas_change_requests c join core.saas_plan_versions t on t.id=c.target_plan_id
   where c.org_id=org and c.subscription_id=s.id and c.source_plan_id is not null and c.state='scheduled'));
 return data;
end$$;
-- A referenced version's agreed terms stay immutable, including cancelled history.
create function private.subscription_period_plan_immutable() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (new.name,new.period,new.price_minor,new.currency,new.features,new.limits) is distinct from
    (old.name,old.period,old.price_minor,old.currency,old.features,old.limits)
 and exists(select 1 from core.saas_change_requests where source_plan_id is not null and old.id in (source_plan_id,target_plan_id))
 then perform private.fail('INVALID_STATE_TRANSITION');end if;
 return new;
end$$;
create trigger subscription_period_plan_immutable before update on core.saas_plan_versions
 for each row execute function private.subscription_period_plan_immutable();

do $patch$
declare b text:=pg_get_functiondef('private.p07_subscription_command(text,jsonb,uuid,uuid,uuid,uuid[])'::regprocedure);anchor text;
begin
 anchor:=$a$ if op='subscription_upgrade_quote_v1' then$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Period request command anchor drift';end if;
 b:=replace(b,anchor,$a$
 if op in ('subscription_upgrade_quote_v1','subscription_downgrade_request_v1')
    or (op='subscription_renewal_set_v1' and not (r->>'renew')::bool) then
  if exists(select 1 from core.saas_change_requests where org_id=org and state='scheduled' and source_plan_id is not null)
  then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
 end if;
 if op='subscription_period_change_request_v1' then
  if s.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if s.state<>'active' or s.period_end is null or s.period_end<=at then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
  if s.cancel_at_period_end then perform private.fail('INVALID_STATE_TRANSITION');end if;
  -- Same deterministic lock order for opposing monthly/yearly requests.
  perform 1 from core.saas_plan_versions where id in (s.plan_version_id,(r->>'target_plan_id')::uuid) order by id for share;
  select * into p from core.saas_plan_versions where id=s.plan_version_id;
  select * into t from core.saas_plan_versions where id=(r->>'target_plan_id')::uuid and effective_at<=at;
  if t.id is null then perform private.fail('NOT_FOUND');end if;
  if t.name<>p.name or t.currency<>p.currency or t.period=p.period or t.features<>p.features or t.limits<>p.limits or t.price_minor<=0
  then perform private.fail('VALIDATION_FAILED');end if;
  if t.price_minor is distinct from (r->>'amount_minor')::bigint or t.currency is distinct from r->>'currency'
     or s.period_end is distinct from (r->>'effective_at')::timestamptz then perform private.fail('VERSION_CONFLICT');end if;
  if exists(select 1 from core.saas_change_requests where org_id=org and state='scheduled' and source_plan_id is null)
  then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  update core.saas_change_requests set state='cancelled',version=version+1 where org_id=org and state='scheduled';
  insert into core.saas_change_requests(id,org_id,target_plan_id,effective_at,state,source_plan_id,subscription_id)
   values(id,org,t.id,s.period_end,'scheduled',p.id,s.id) returning version into v;
  update core.saas_subscriptions set version=version+1 where id=s.id;
  subject:='saas_change_requests';
 elsif op='subscription_upgrade_quote_v1' then$a$);
 anchor:=$a$update core.saas_change_requests set state='cancelled',version=version+1 where id=c.id returning id,version into id,v;subject:='saas_change_requests';$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Period cancellation anchor drift';end if;
 b:=replace(b,anchor,anchor||$a$
  if c.source_plan_id is not null then update core.saas_subscriptions set version=version+1 where id=s.id;end if;$a$);
 execute b;
end$patch$;

-- Current editable values share the same canonical billing options read.
do $patch$
declare b text:=pg_get_functiondef('private.p07_subscription_management(jsonb,uuid,uuid,boolean)'::regprocedure);anchor text;
begin
 anchor:=$a$ elsif op='subscription_renewal_set_v1' then$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Period management anchor drift';end if;
 b:=replace(b,anchor,$a$ elsif op='subscription_period_change_request_v1' then
  select x into vals from jsonb_array_elements(private.subscription_billing(org)->'period_change_options') x
   where x->>'id'=r#>>'{selector,key,target_plan_id}';
  if vals is null then perform private.fail('NOT_FOUND');end if;
  vals:=(vals-'id'-'period')||jsonb_build_object('target_plan_id',vals->'id','expected_version',s.version,'effective_at',s.period_end);
 elsif op='subscription_renewal_set_v1' then$a$);
 execute b;
end$patch$;

-- Both payment verification and the fenced boundary worker call this renewal path.
create or replace function private.p07_renew(org uuid,sub_id uuid,operation_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare s core.saas_subscriptions;p core.saas_plan_versions;c core.saas_change_requests;at timestamptz:=clock_timestamp();
 period_start timestamptz;period_end timestamptz;step interval;cycles int:=0;due bigint;
begin
 select * into s from core.saas_subscriptions where org_id=org and id=sub_id for update;
 select * into p from core.saas_plan_versions where id=s.plan_version_id;
 if not exists(select 1 from core.organizations where id=org and state='active') then return false;end if;
 select * into c from core.saas_change_requests where org_id=org and subscription_id=s.id and source_plan_id is not null
  and state='scheduled' and effective_at<=at for update;
 if c.id is not null then
  if c.source_plan_id<>s.plan_version_id or c.effective_at<>s.period_end or s.cancel_at_period_end
  then perform private.fail('INVALID_STATE_TRANSITION');end if;
  select * into p from core.saas_plan_versions where id=c.target_plan_id;
 end if;
 step:=case p.period when 'monthly' then interval '1 month' when 'yearly' then interval '1 year' else null end;
 if step is null or p.price_minor<=0 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if s.state='pending_payment' or s.state='ended' or (s.cancel_at_period_end and s.period_end<=at) then
  period_start:=at;period_end:=at+step;cycles:=1;
 elsif at<s.period_end then return false;
 else
  period_start:=s.period_end;period_end:=period_start+step;cycles:=1;
  while period_end<=at loop period_start:=period_end;period_end:=period_start+step;cycles:=cycles+1;if cycles>1200 then perform private.fail('POLICY_NOT_CONFIGURED');end if;end loop;
 end if;
 due:=cycles*p.price_minor;if private.p07_funds(org,p.currency)<due then return false;end if;
 perform private.p07_allocate(org,p.currency,s.id,operation_id,due);
 insert into private.p07_subscription_scope(subscription_id,period_start) values(s.id,period_start) on conflict(subscription_id) do update set period_start=excluded.period_start;
 update core.saas_subscriptions set plan_version_id=p.id,starts_at=period_start,period_end=period_end,grace_until=period_end+interval '7 days',
  state='active',cancel_at_period_end=false,version=version+1 where id=s.id;
 if c.id is not null then update core.saas_change_requests set state='applied',version=version+1 where id=c.id;end if;
 return true;
end$$;

do $patch$
declare b text:=pg_get_functiondef('private.p07_boundary(uuid,uuid,uuid,uuid[])'::regprocedure);anchor text;
begin
 anchor:=$a$where org_id=org and state='scheduled' and effective_at<=at$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Period boundary selection anchor drift';end if;
 execute replace(b,anchor,$a$where org_id=org and source_plan_id is null and state='scheduled' and effective_at<=at$a$);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 -- Existing owner permission, exempt billing and atomic receipt/audit paths.
 anchor:=$a$'subscription_upgrade_quote_v1','subscription_downgrade_request_v1'$a$;
 if strpos(b,anchor)=0 then raise exception 'Period operation routing anchor drift';end if;
 b:=replace(b,anchor,$a$'subscription_period_change_request_v1','subscription_upgrade_quote_v1','subscription_downgrade_request_v1'$a$);
 -- Period-only changes do not hide normal paid/grace access or block payment.
 anchor:=$a$where org_id=org and state='scheduled' and effective_at<=clock_timestamp()$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Period due guard anchor drift';end if;
 b:=replace(b,anchor,$a$where org_id=org and source_plan_id is null and state='scheduled' and effective_at<=clock_timestamp()$a$);
 anchor:=$a$'pending_change',(select jsonb_build_object$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Period billing read anchor drift';end if;
 b:=replace(b,anchor,$a$'billing',private.subscription_billing(org),'subscription_version',sub.version,'pending_change',(select jsonb_build_object$a$);
 execute b;
end$patch$;
revoke all on function private.subscription_plan_terms(core.saas_plan_versions),private.subscription_billing(uuid),private.subscription_period_plan_immutable() from public,anon,authenticated;
grant execute on function private.subscription_plan_terms(core.saas_plan_versions),private.subscription_billing(uuid),private.subscription_period_plan_immutable() to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('subscription_period_change_request_v1','subscription.owner','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.subscription_period_change_request_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('subscription_period_change_request_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.subscription_period_change_request_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.subscription_period_change_request_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
