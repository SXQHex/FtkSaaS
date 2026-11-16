begin;
-- Center finance discovery shares the existing finance.read boundary. The
-- collection-only grant does not disclose other people's balances or history.
create function private.finance_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare view_name text:=r->>'view';lo timestamptz:=(r#>>'{interval,starts_at}')::timestamptz;hi timestamptz:=(r#>>'{interval,ends_at}')::timestamptz;
 all_rows jsonb;items jsonb;totals jsonb;result jsonb;at timestamptz:=clock_timestamp();is_starter bool:=private.current_plan_name(org)='starter';
begin
 if center is null or not (private.is_org_reader(org,actor) or private.is_manager(org,actor,center)) then perform private.fail('FORBIDDEN');end if;
 if view_name is null or view_name not in ('movements','debts','credits') or lo is null or hi is null or not isfinite(lo) or not isfinite(hi) or lo>=hi or hi-lo>interval '366 days' then perform private.fail('VALIDATION_FAILED');end if;
 with candidates as materialized(
  select distinct private.p07_person_root(org,c.person_id) id from private.person_center_relationships c where c.org_id=org and c.center_id=center
  union select actor
 ), visible as materialized(
  select c.id from candidates c where not is_starter or private.member_summary_enabled(org,array['finance_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',c.id))
 ), raw as(
  select s.id,s.person_id,s.created_at,s.created_at occurred_at,s.version,'sale'::text kind,s.net_minor amount,s.currency,s.id sale_id,null::text method,null::timestamptz due_at,'sales'::text entity_type
   from core.sales s where s.org_id=org and s.center_id=center and s.created_at>=lo and s.created_at<hi
  union all
  select c.id,c.person_id,c.created_at,c.occurred_at,c.version,c.kind,c.amount_minor,c.currency,null::uuid,coalesce(c.payment,p.payment)->>'method',null::timestamptz,'cash_movements'
   from core.cash_movements c left join core.cash_movements p on p.org_id=c.org_id and p.id=c.previous_id where c.org_id=org and c.center_id=center and c.occurred_at>=lo and c.occurred_at<hi
  union all
  select d.id,d.person_id,d.created_at,d.created_at,d.version,'debt',private.debt_remaining(org,d.id),d.currency,d.sale_id,null::text,d.due_at,'debts'
   from core.debts d where d.org_id=org and d.center_id=center
  union all
  select p.id,p.id,max(m.created_at),max(m.created_at),p.version,'credit',sum(private.student_credit_effect(org,m.id)),m.currency,null::uuid,null::text,null::timestamptz,'people'
   from core.student_credit_movements m join core.people p on p.org_id=m.org_id and p.id=private.p07_person_root(org,m.person_id)
   where m.org_id=org and m.center_id=center group by p.id,p.version,m.currency
 ), resolved as materialized(
  select x.*,private.p07_person_root(org,x.person_id) canonical_person from raw x
 ) select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'entity',jsonb_build_object('type',x.entity_type,'id',x.id),'person_id',x.canonical_person,
  'display_name',private.directory_person_name(org,center,actor,x.canonical_person),'created_at',x.created_at,'occurred_at',x.occurred_at,'version',x.version,
  'kind',x.kind,'amount_minor',x.amount::text,'currency',x.currency,'source_sale_id',x.sale_id,'method',x.method,'due_at',x.due_at,
  'product_name',(select v.published_name from core.sales s join core.product_versions v on v.org_id=s.org_id and v.id=s.product_version_id where s.org_id=org and s.id=x.sale_id)) order by x.created_at,x.id,x.currency,x.kind),'[]')
 into all_rows from resolved x join visible v on v.id=x.canonical_person;
 -- Period flows and current balances are different quantities. Currency totals
 -- are independent, unconverted, and cover the authorized center before search.
 select coalesce(jsonb_agg(jsonb_build_object('currency',currency,'sales_minor',sales::text,'collections_minor',collections::text,
  'refunds_minor',refunds::text,'debt_minor',debts::text,'credit_minor',credits::text,'debt_people',debt_people,'credit_people',credit_people) order by currency),'[]') into totals
 from(select x->>'currency' currency,
  coalesce(sum((x->>'amount_minor')::numeric) filter(where x->>'kind'='sale' and (x->>'occurred_at')::timestamptz>=lo and (x->>'occurred_at')::timestamptz<hi),0) sales,
  coalesce(sum(case when x->>'kind'='correction_out' then -(x->>'amount_minor')::numeric else (x->>'amount_minor')::numeric end) filter(where x->>'kind' in ('collection','correction_in','correction_out') and (x->>'occurred_at')::timestamptz>=lo and (x->>'occurred_at')::timestamptz<hi),0) collections,
  coalesce(sum((x->>'amount_minor')::numeric) filter(where x->>'kind'='refund' and (x->>'occurred_at')::timestamptz>=lo and (x->>'occurred_at')::timestamptz<hi),0) refunds,
  coalesce(sum((x->>'amount_minor')::numeric) filter(where x->>'kind'='debt'),0) debts,
  coalesce(sum((x->>'amount_minor')::numeric) filter(where x->>'kind'='credit'),0) credits,
  count(distinct x->>'person_id') filter(where x->>'kind'='debt' and (x->>'amount_minor')::numeric>0) debt_people,
  count(distinct x->>'person_id') filter(where x->>'kind'='credit' and (x->>'amount_minor')::numeric>0) credit_people
 from jsonb_array_elements(all_rows) x group by x->>'currency') sums;
 select coalesce(jsonb_agg(x order by n),'[]') into items from jsonb_array_elements(all_rows) with ordinality a(x,n)
 where ((view_name='movements' and x->>'kind' not in ('debt','credit') and (x->>'occurred_at')::timestamptz>=lo and (x->>'occurred_at')::timestamptz<hi)
  or (view_name='debts' and x->>'kind'='debt' and (x->>'amount_minor')::numeric>0)
  or (view_name='credits' and x->>'kind'='credit' and (x->>'amount_minor')::numeric>0))
 and (r->>'query' is null or strpos(lower(coalesce(x->>'display_name','')),lower(r->>'query'))>0)
 and (r->>'kind' is null or x->>'kind'=r->>'kind') and (r->>'method' is null or x->>'method'=r->>'method');
 result:=private.p06_page(items,r->'page',md5(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page')::text),at);
 return result||jsonb_build_object('view',view_name,'totals',totals);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Finance directory dispatch anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='finance_directory_get_v1' then
  out:=private.finance_directory(r,org,center,person,actor.id);
  return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
end$patch$;
revoke all on function private.finance_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.finance_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('finance_directory_get_v1','finance.read','read',array['F06','F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create function api_v1.finance_directory_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('finance_directory_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.finance_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.finance_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
commit;
