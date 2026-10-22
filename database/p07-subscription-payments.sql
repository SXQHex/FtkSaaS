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
