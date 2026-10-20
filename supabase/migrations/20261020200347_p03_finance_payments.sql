-- P03: linked finance corrections and isolated instructor payment ledger.
begin;
alter table core.instructor_payments add column previous_id uuid, add column direction text not null default 'increase', add column operation_id uuid;
alter table core.instructor_payments add constraint p03_payment_previous foreign key(org_id,center_id,previous_id) references core.instructor_payments(org_id,center_id,id);
alter table core.instructor_payments add constraint p03_payment_operation foreign key(org_id,operation_id) references core.operation_receipts(org_id,id);
alter table core.instructor_payments add constraint p03_payment_direction check(direction in ('increase','decrease'));
alter table core.earning_allocations add column previous_id uuid;
alter table core.earning_allocations add constraint p03_allocation_previous foreign key(org_id,center_id,previous_id) references core.earning_allocations(org_id,center_id,id);
create index p03_payment_chain on core.instructor_payments(org_id,previous_id);
create index p03_earning_payment on core.earning_allocations(org_id,payment_id);
create trigger p03_payment_immutable before update or delete on core.instructor_payments for each row execute function private.append_only();
create trigger p03_allocation_immutable before update or delete on core.earning_allocations for each row execute function private.append_only();
create table private.p03_sale_refunds(
 id uuid primary key,org_id uuid not null,sale_id uuid not null,operation_id uuid not null,quote jsonb not null,
 created_at timestamptz not null default clock_timestamp(),unique(org_id,sale_id),
 foreign key(org_id,sale_id) references core.sales(org_id,id),foreign key(org_id,operation_id) references core.operation_receipts(org_id,id)
);
alter table private.p03_sale_refunds enable row level security;
create trigger p03_refund_immutable before update or delete on private.p03_sale_refunds for each row execute function private.append_only();
revoke all on private.p03_sale_refunds from public,anon,authenticated;
grant select,insert on private.p03_sale_refunds to service_role;

-- A collection reduction can reverse a previously created unspent claim.
-- Spent credit cannot disappear: the caller verifies the full balance first.
create or replace function private.debt_claimed(org uuid,debt uuid) returns bigint language sql stable set search_path='' as $$
 select coalesce(sum(case when kind='refund_claim_add' then amount_minor when kind='correction_subtract' then -amount_minor else 0 end),0)
 from core.student_credit_movements where org_id=org and source_debt_id=debt
$$;
create function private.p03_credit_take(org uuid,center uuid,target uuid,currency text,amount bigint,cash uuid,debt uuid,operation uuid,id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if amount<=0 then return;end if;
 if private.student_credit_available(org,center,target,currency)<amount then perform private.fail('INSUFFICIENT_STUDENT_CREDIT');end if;
 insert into core.student_credit_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,source_cash_id,source_debt_id,operation_id)
 values(id,org,center,target,'correction_subtract',amount,currency,cash,debt,operation);
end$$;
-- Reuse the frozen refund algorithm; never produce the same entitlement twice.
do $patch$
declare b text:=pg_get_functiondef('private.p02_refund_quote(uuid,uuid)'::regprocedure);old text;
begin
 old:=' remaining:=calculated;';
 if strpos(b,old)=0 then raise exception 'P03 refund quote anchor missing';end if;
 b:=replace(b,old,$p$
 calculated:=greatest(0,calculated-coalesce((select (x.quote->>'calculated_minor')::bigint from private.p02_sale_settlements x where x.org_id=org and x.sale_id=s.id),0)
 -coalesce((select (x.quote->>'calculated_minor')::bigint from private.p03_sale_refunds x where x.org_id=org and x.sale_id=s.id),0));
 remaining:=calculated;$p$);
 old:='from core.entitlement_movements where org_id=org and sale_id=s.id;';
 if strpos(b,old)=0 then raise exception 'P03 terminated rights anchor missing';end if;
 b:=replace(b,old,$p$from core.entitlement_movements em where em.org_id=org and em.sale_id=s.id
 and not (em.kind='adjust_subtract' and exists(select 1 from core.operation_receipts rr where rr.org_id=org and rr.id=em.operation_id and rr.operation in ('sale_terminate_apply_v1','sale_change_apply_v1')));$p$);
 execute b;
end$patch$;
create function private.p03_dependencies(org uuid,center uuid,account uuid,sale_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_set(private.p02_dependencies(org,center,account,sale_id),'{policy_hashes}',
 private.p02_dependencies(org,center,account,sale_id)->'policy_hashes'||jsonb_build_array(md5(jsonb_build_object(
 'p02',(select jsonb_agg(x order by x.id) from private.p02_sale_settlements x where x.org_id=org),
 'p03',(select jsonb_agg(x order by x.id) from private.p03_sale_refunds x where x.org_id=org))::text)))
$$;
create function private.p03_cash_net(org uuid,cash uuid) returns bigint language sql stable security invoker set search_path='' as $$
 select coalesce(sum(case when c.kind in ('collection','correction_in') then c.amount_minor else -c.amount_minor end),0)
 from core.cash_movements c where c.org_id=org and (c.id=cash or c.previous_id=cash)
$$;
create function private.p03_earning_root(org uuid,earning uuid) returns uuid language sql stable security invoker set search_path='' as $$
 with recursive chain as(select id,previous_id from core.earnings where org_id=org and id=earning
 union all select e.id,e.previous_id from core.earnings e join chain c on e.id=c.previous_id where e.org_id=org)
 select id from chain where previous_id is null
$$;
create function private.p03_earning_net(org uuid,earning uuid) returns bigint language sql stable security invoker set search_path='' as $$
 with recursive chain as(select id,amount_minor,direction from core.earnings where org_id=org and id=earning
 union all select e.id,e.amount_minor,e.direction from core.earnings e join chain c on e.previous_id=c.id where e.org_id=org)
 select coalesce(sum(case when direction='add' then amount_minor else -amount_minor end),0) from chain
$$;
create function private.p03_payment_version(org uuid,payment uuid) returns bigint language sql stable security invoker set search_path='' as $$
 select 1+count(*) from core.instructor_payments where org_id=org and previous_id=payment
$$;
create function private.p03_payment_net(org uuid,payment uuid) returns bigint language sql stable security invoker set search_path='' as $$
 select coalesce(sum(case when direction='increase' then amount_minor else -amount_minor end),0) from core.instructor_payments where org_id=org and (id=payment or previous_id=payment)
$$;
create function private.p03_payment_views(org uuid,earning uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'version',private.p03_payment_version(org,p.id),'amount_minor',p.amount_minor::text,
 'net_minor',private.p03_payment_net(org,p.id)::text,'currency',p.currency,'occurred_at',p.occurred_at,
 'corrections',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'previous_id',q.previous_id,'direction',q.direction,'amount_minor',q.amount_minor::text,'occurred_at',q.occurred_at,'reason',q.reason) order by q.created_at,q.id)
 from core.instructor_payments q where q.org_id=org and q.previous_id=p.id),'[]'::jsonb)) order by p.created_at,p.id),'[]'::jsonb)
 from core.instructor_payments p where p.org_id=org and p.previous_id is null and exists(select 1 from core.earning_allocations a where a.org_id=org and a.payment_id=p.id and a.earning_id=earning)
$$;
create function private.p03_finance_read(r jsonb,org uuid,center uuid,account uuid,person uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare target uuid:=(r->>'person_id')::uuid;wanted_currency text:=r->>'currency';lim int:=coalesce((r#>>'{page,limit}')::int,50);sorting text:=coalesce(r#>>'{page,sort}','created_at_asc');
 scope text:=md5(jsonb_build_object('actor',account,'org',org,'center',center,'person',target,'currency',wanted_currency,'sort',sorting)::text);
 cur jsonb;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();items jsonb;debts jsonb;token text;credit bigint;
begin
 if lim<1 or lim>200 or sorting not in ('created_at_asc','created_at_desc') then perform private.fail('VALIDATION_FAILED');end if;
 if not exists(select 1 from core.people where org_id=org and id=target) then perform private.fail('NOT_FOUND');end if;
 if target<>person and not private.is_org_reader(org,person) and not (center is not null and (private.is_manager(org,person,center) or private.staff_grant(org,person,center,'finance.collect'))) then perform private.fail('FORBIDDEN');end if;
 if target<>person and center is not null and not exists(select 1 from core.center_relationships x where x.org_id=org and x.center_id=center and x.person_id=target) then perform private.fail('NOT_FOUND');end if;
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from scope or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'due_at',d.due_at,'remaining_minor',private.debt_remaining(org,d.id)::text,
 'center_id',d.center_id,'version',d.version,'net_minor',private.debt_net(org,d.id)::text,'paid_minor',private.debt_paid(org,d.id)::text,'claimed_minor',private.debt_claimed(org,d.id)::text) order by d.due_at,d.id),'[]'::jsonb)
 into debts from core.debts d where d.org_id=org and d.person_id=target and d.currency=wanted_currency and (center is null or d.center_id=center);
 select coalesce(sum(private.student_credit_effect(org,m.id)),0) into credit from core.student_credit_movements m where m.org_id=org and m.person_id=target and m.currency=wanted_currency and (center is null or m.center_id=center);
 select coalesce(jsonb_agg(q.data order by case when sorting='created_at_asc' then q.at end,case when sorting='created_at_desc' then q.at end desc,
 case when sorting='created_at_asc' then q.id end,case when sorting='created_at_desc' then q.id end desc),'[]'::jsonb) into items from(
 select c.created_at at,c.id,jsonb_build_object('id',c.id,'kind',c.kind,'amount_minor',c.amount_minor::text,'currency',c.currency,'occurred_at',c.occurred_at,
 'center_id',c.center_id,'previous_id',c.previous_id,'version',c.version,'_at',c.created_at) data from core.cash_movements c
 where c.org_id=org and c.person_id=target and c.currency=wanted_currency and (center is null or c.center_id=center) and c.created_at<=asof
 and (cur is null or (sorting='created_at_asc' and (c.created_at,c.id)>(last_at,last_id)) or (sorting='created_at_desc' and (c.created_at,c.id)<(last_at,last_id)))
 order by case when sorting='created_at_asc' then c.created_at end,case when sorting='created_at_desc' then c.created_at end desc,
 case when sorting='created_at_asc' then c.id end,case when sorting='created_at_desc' then c.id end desc limit lim+1) q;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',scope,'at',items->-1->'_at','id',items->-1->'id','as_of',asof)::text,'utf8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality t(x,n);
 return jsonb_build_object('person_id',target,'currency',wanted_currency,'debts',debts,'credit_available_minor',credit::text,'movements',jsonb_build_object('items',items,'next_cursor',token,'as_of',asof));
end$$;

create function private.p03_finance(op text,r jsonb,org uuid,center uuid,account uuid,person uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare req jsonb:=r;pv core.previews;pp private.preview_payloads;s core.sales;c core.cash_movements;d core.debts;p core.instructor_payments;e core.earnings;a record;
 pid uuid:=private.new_id(ids,2);idx int:=20;dep jsonb;data jsonb;quote jsonb;entry jsonb;effects jsonb:='[]';before_data jsonb;
 target uuid;root uuid;amount bigint;remaining bigint;part bigint;claimed bigint;excess bigint;current_net bigint;ver bigint:=1;direction text;reason text;
 is_preview bool:=op like '%_preview_v1';is_refund bool:=op in ('sale_refund_preview_v1','sale_refund_apply_v1');
begin
 if op='finance_get_v1' then return jsonb_build_object('data',private.p03_finance_read(r,org,center,account,person),'primary_id',r->'person_id','subject','people');end if;
 if op in ('sale_refund_apply_v1','collection_correct_apply_v1') then
  select * into pv from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid for update;
  select * into pp from private.preview_payloads where preview_id=pv.id;
  if pv.id is null or pv.state<>'current' or pv.operation<>op or pv.actor_account_id<>account or pp.expires_at<=clock_timestamp()
  or pp.token_hash is distinct from encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') or (pp.payload->>'center_id')::uuid is distinct from center then perform private.fail('PREVIEW_STALE');end if;
  req:=pp.payload->'request';
 end if;
 reason:=req->>'reason';
 if op<>'instructor_payment_record_v1' and length(btrim(coalesce(reason,'')))=0 then perform private.fail('VALIDATION_FAILED');end if;
 if is_refund or op in ('collection_correct_preview_v1','collection_correct_apply_v1') then
  if is_refund then
   select * into s from core.sales where org_id=org and center_id=center and id=(req->>'sale_id')::uuid for update;
   if s.id is null then perform private.fail('NOT_FOUND');end if;
   quote:=private.p02_refund_quote(org,s.id);target:=s.person_id;before_data:=to_jsonb(s);
   effects:=jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'action','adjust','amount_minor',quote->>'debt_reduction_minor','currency',s.currency,'reason',reason||'; debt reduction before student credit; no cash or rights mutation'));
  else
   select * into c from core.cash_movements where org_id=org and center_id=center and id=(req->>'cash_movement_id')::uuid for update;
   if c.id is null then perform private.fail('NOT_FOUND');end if;
   if c.kind<>'collection' or c.previous_id is not null then perform private.fail('VALIDATION_FAILED');end if;
   if c.currency<>req#>>'{correction,currency}' then perform private.fail('CURRENCY_MISMATCH');end if;
   amount:=(req#>>'{correction,amount_minor}')::bigint;direction:=req#>>'{correction,direction}';target:=c.person_id;before_data:=to_jsonb(c);
   if (req#>>'{correction,occurred_at}')::timestamptz>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
   current_net:=private.p03_cash_net(org,c.id);
   if direction='decrease' and amount>current_net then perform private.fail('VALIDATION_FAILED');end if;
   effects:=jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','cash_movements','id',c.id),'action','adjust','amount_minor',amount::text,'currency',c.currency,'reason',reason||'; linked '||direction||'; debt allocation and credit correction; no automatic reservation cancellation'));
  end if;
  dep:=private.p03_dependencies(org,center,account,s.id);
  if is_preview then
   if aux->>'token' is null then perform private.fail('INTEGRITY_VIOLATION');end if;
   data:=jsonb_build_object('id',pid,'token',aux->>'token','scope_hash',md5(jsonb_build_object('actor',account,'center',center,'request',r-'request_id')::text),
    'dependencies',dep,'effects',effects,'blockers','[]'::jsonb,'expires_at',clock_timestamp()+interval '15 minutes');
   insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(pid,org,account,replace(op,'_preview_v1','_apply_v1'),data->>'scope_hash',dep,data-'token','current');
   insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(pid,jsonb_build_object('center_id',center,'request',r),(data->>'expires_at')::timestamptz,encode(extensions.digest(aux->>'token','sha256'),'hex'));
   return jsonb_build_object('data',data,'primary_id',pid,'subject','previews');
  end if;
  if dep<>pv.dependencies then perform private.fail('PREVIEW_STALE');end if;
  if is_refund then
   for entry in select value from jsonb_array_elements(quote->'debts') loop
    select * into d from core.debts where org_id=org and id=(entry->>'debt_id')::uuid for update;
    part:=(entry->>'reduction_minor')::bigint;
    insert into core.debt_adjustments(id,org_id,center_id,debt_id,amount_minor,direction,reason,operation_id) values(private.new_id(ids,idx),org,center,d.id,part,'decrease',reason,operation);
    perform private.claim_debt_overpayment(org,d.id,operation,ids,idx+1);idx:=idx+2;
    update core.debts set state=case when private.debt_remaining(org,d.id)=0 then 'settled' else 'open' end,version=version+1 where id=d.id;
   end loop;
   insert into private.p03_sale_refunds(id,org_id,sale_id,operation_id,quote) values(pid,org,s.id,operation,quote) on conflict(org_id,sale_id) do nothing;
  else
   insert into core.cash_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,occurred_at,previous_id,reason,operation_id)
    values(pid,org,center,target,case when direction='increase' then 'correction_in' else 'correction_out' end,amount,c.currency,(req#>>'{correction,occurred_at}')::timestamptz,c.id,reason,operation);
   remaining:=amount;
   if direction='decrease' then
    -- Remove only the remaining surplus attributable to this collection chain.
    select coalesce(sum(private.student_credit_effect(org,m.id)),0) into part from core.student_credit_movements m where m.org_id=org and m.source_debt_id is null
     and m.source_cash_id in(select q.id from core.cash_movements q where q.org_id=org and (q.id=c.id or q.previous_id=c.id));
    part:=least(remaining,greatest(0,part));
    perform private.p03_credit_take(org,center,target,c.currency,part,pid,null,operation,private.new_id(ids,idx));idx:=idx+1;remaining:=remaining-part;
    for a in select x.debt_id,sum(x.amount_minor)::bigint allocated from core.debt_allocations x where x.org_id=org
      and x.cash_movement_id in(select q.id from core.cash_movements q where q.org_id=org and (q.id=c.id or q.previous_id=c.id)) group by x.debt_id having sum(x.amount_minor)>0 order by x.debt_id loop
     part:=least(remaining,a.allocated);exit when part<=0;
     insert into core.debt_allocations(id,org_id,center_id,debt_id,cash_movement_id,amount_minor,previous_id)
      values(private.new_id(ids,idx),org,center,a.debt_id,pid,-part,(select x.id from core.debt_allocations x where x.org_id=org and x.debt_id=a.debt_id and x.cash_movement_id=c.id order by x.created_at,x.id limit 1));idx:=idx+1;
     claimed:=private.debt_claimed(org,a.debt_id);excess:=greatest(0,claimed-greatest(0,private.debt_paid(org,a.debt_id)-private.debt_net(org,a.debt_id)));
     perform private.p03_credit_take(org,center,target,c.currency,excess,null,a.debt_id,operation,private.new_id(ids,idx));idx:=idx+1;
     update core.debts set version=version+1,state=case when private.debt_remaining(org,a.debt_id)=0 then 'settled' else 'open' end where id=a.debt_id;
     remaining:=remaining-part;
    end loop;
    if remaining<>0 then perform private.fail('INTEGRITY_VIOLATION');end if;
   else
    for d in select * from core.debts where org_id=org and center_id=center and person_id=target and currency=c.currency and id in
     (select x.debt_id from core.debt_allocations x where x.org_id=org and x.cash_movement_id=c.id) order by due_at,id for update loop
     part:=least(remaining,private.debt_remaining(org,d.id));if part<=0 then continue;end if;
     insert into core.debt_allocations(id,org_id,center_id,debt_id,cash_movement_id,amount_minor) values(private.new_id(ids,idx),org,center,d.id,pid,part);idx:=idx+1;remaining:=remaining-part;
     update core.debts set version=version+1,state=case when private.debt_remaining(org,d.id)=0 then 'settled' else 'open' end where id=d.id;exit when remaining=0;
    end loop;
    if remaining>0 then insert into core.student_credit_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,source_cash_id,operation_id) values(private.new_id(ids,idx),org,center,target,'surplus_add',remaining,c.currency,pid,operation);end if;
   end if;
  end if;
  update core.previews set state='applied',version=version+1 where id=pv.id;
 else
  -- Payments and student cash are deliberately separate ledgers.
  amount:=(coalesce(req->>'amount_minor',req#>>'{correction,amount_minor}'))::bigint;
  direction:=coalesce(req#>>'{correction,direction}','increase');
  if op='instructor_payment_correct_v1' then
   select * into p from core.instructor_payments where org_id=org and center_id=center and id=(r->>'payment_id')::uuid for update;
   if p.id is null then perform private.fail('NOT_FOUND');end if;
   if p.previous_id is not null then perform private.fail('VALIDATION_FAILED');end if;
   root:=p.id;target:=p.person_id;
   if p.currency<>r#>>'{correction,currency}' then perform private.fail('CURRENCY_MISMATCH');end if;
   ver:=private.p03_payment_version(org,root);
   if ver<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   if direction='decrease' and amount>private.p03_payment_net(org,root) then perform private.fail('VALIDATION_FAILED');end if;
  else
   target:=(r->>'person_id')::uuid;
   if (select count(*) from core.earnings z where z.org_id=org and z.id in(select x::uuid from jsonb_array_elements_text(r->'earning_ids') x))<>jsonb_array_length(r->'earning_ids') then perform private.fail('NOT_FOUND');end if;
   if jsonb_array_length(r->'earning_ids')=0 or jsonb_array_length(r->'earning_ids')<>(select count(distinct x) from jsonb_array_elements_text(r->'earning_ids') x) then perform private.fail('VALIDATION_FAILED');end if;
  end if;
  if (coalesce(r->>'occurred_at',r#>>'{correction,occurred_at}'))::timestamptz>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.instructor_payments(id,org_id,center_id,person_id,amount_minor,currency,occurred_at,reason,previous_id,direction,operation_id)
   values(pid,org,center,target,amount,coalesce(r->>'currency',p.currency),(coalesce(r->>'occurred_at',r#>>'{correction,occurred_at}'))::timestamptz,reason,root,direction,operation);
  remaining:=amount;
  if direction='decrease' then
   for a in select x.earning_id,sum(x.amount_minor)::bigint allocated from core.earning_allocations x where x.org_id=org and x.payment_id in
    (select q.id from core.instructor_payments q where q.org_id=org and (q.id=root or q.previous_id=root)) group by x.earning_id having sum(x.amount_minor)>0 order by x.earning_id loop
    part:=least(remaining,a.allocated);exit when part<=0;
    insert into core.earning_allocations(id,org_id,center_id,payment_id,earning_id,amount_minor,previous_id)
     values(private.new_id(ids,idx),org,center,pid,a.earning_id,-part,(select x.id from core.earning_allocations x where x.org_id=org and x.payment_id=root and x.earning_id=a.earning_id order by x.created_at,x.id limit 1));idx:=idx+1;remaining:=remaining-part;
   end loop;
  else
   for e in select * from core.earnings where org_id=org and id in(select x::uuid from jsonb_array_elements_text(coalesce(r->'earning_ids',
    (select jsonb_agg(distinct x.earning_id) from core.earning_allocations x where x.org_id=org and x.payment_id=root)))) order by created_at,id for update loop
    if e.center_id<>center or e.person_id<>target then perform private.fail('NOT_FOUND');end if;
    if e.currency<>coalesce(r->>'currency',p.currency) then perform private.fail('CURRENCY_MISMATCH');end if;
    if e.previous_id is not null or e.direction<>'add' then perform private.fail('VALIDATION_FAILED');end if;
    part:=least(remaining,greatest(0,private.p03_earning_net(org,e.id)-(select coalesce(sum(x.amount_minor),0) from core.earning_allocations x where x.org_id=org and x.earning_id=e.id)));
    if part<=0 then continue;end if;
    insert into core.earning_allocations(id,org_id,center_id,payment_id,earning_id,amount_minor) values(private.new_id(ids,idx),org,center,pid,e.id,part);idx:=idx+1;remaining:=remaining-part;
   end loop;
  end if;
  if remaining<>0 then perform private.fail('VALIDATION_FAILED');end if;
  if root is not null then ver:=ver+1;end if;
 end if;
 data:=jsonb_build_object('operation_id',operation,'primary_id',pid,'version',ver,'replayed',false,'related','[]'::jsonb);
 return jsonb_build_object('data',data,'primary_id',pid,'version',ver,'subject',case when is_refund then 'sales' when op like 'collection_%' then 'cash_movements' else 'instructor_payments' end,
 'reason',reason,'audit',jsonb_build_object('request',req,'before',before_data,'quote',quote,'root_payment',root));
end$$;

-- Central scope resolution and permission checks remain before receipt replay.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;
begin
 old:='  cm:=center is not null and private.is_manager(org,person,center);org_reader:=private.is_org_reader(org,person);';
 if strpos(b,old)=0 then raise exception 'P03 scope anchor missing';end if;
 b:=replace(b,old,$p$
  if p_operation in ('sale_refund_preview_v1','collection_correct_preview_v1','instructor_payment_correct_v1') then
   selected:=null;
   if p_operation='sale_refund_preview_v1' then select x.center_id into selected from core.sales x where x.org_id=org and x.id=(r->>'sale_id')::uuid;
   elsif p_operation='collection_correct_preview_v1' then select x.center_id into selected from core.cash_movements x where x.org_id=org and x.id=(r->>'cash_movement_id')::uuid;
   else select x.center_id into selected from core.instructor_payments x where x.org_id=org and x.id=(r->>'payment_id')::uuid;end if;
   if selected is null or (center is not null and center<>selected) then perform private.fail('NOT_FOUND');end if;center:=selected;
  end if;
$p$||old);
 old:=' elsif perm_code in (''org.read'',''person.read'',''schedule.read'') then';
 if strpos(b,old)=0 then raise exception 'P03 read permission anchor missing';end if;
 b:=replace(b,old,$p$ elsif perm_code='finance.read' then
  if person is null then perform private.fail('NOT_FOUND');end if;
$p$||old);
 old:=' -- DOMAIN_CASES';
 if strpos(b,old)=0 then raise exception 'P03 domain anchor missing';end if;
 b:=replace(b,old,$p$
 when 'finance_get_v1','collection_correct_preview_v1','collection_correct_apply_v1','sale_refund_preview_v1','sale_refund_apply_v1','instructor_payment_record_v1','instructor_payment_correct_v1' then
  terms:=private.p03_finance(p_operation,r,org,center,actor.id,person,operation_id,p_ids,p_aux);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';version_n:=coalesce((terms->>'version')::bigint,1);audit_delta:=terms->'audit';
  if terms->>'reason' is not null then r:=r||jsonb_build_object('reason',terms->>'reason');end if;
 -- DOMAIN_CASES$p$);
 execute b;
 b:=pg_get_functiondef('private.earnings_read(uuid,uuid,uuid,jsonb)'::regprocedure);
 old:=$p$'paid_minor',coalesce(a.paid,0)::text,'remaining_minor',greatest(0,e.amount_minor-coalesce(a.paid,0))::text$p$;
 if strpos(b,old)=0 then raise exception 'P03 earnings read anchor missing';end if;
 b:=replace(b,old,$p$'paid_minor',coalesce(a.paid,0)::text,'remaining_minor',case when e.previous_id is null then greatest(0,private.p03_earning_net(org,e.id)-coalesce(a.paid,0)) else 0 end::text,
 'overpaid_minor',case when e.previous_id is null then greatest(0,coalesce(a.paid,0)-private.p03_earning_net(org,e.id)) else 0 end::text,'payments',private.p03_payment_views(org,e.id)$p$);
 execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('sale_refund_preview_v1','finance.refund','maintenance',array['F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.sale_refund_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('sale_refund_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.sale_refund_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.sale_refund_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('sale_refund_apply_v1','finance.refund','maintenance',array['F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.sale_refund_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('sale_refund_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.sale_refund_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.sale_refund_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('finance_get_v1','finance.read','read',array['F06','F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.finance_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('finance_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.finance_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.finance_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('collection_correct_preview_v1','finance.refund','maintenance',array['F19','F33']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.collection_correct_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('collection_correct_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.collection_correct_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.collection_correct_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('collection_correct_apply_v1','finance.refund','maintenance',array['F19','F33']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.collection_correct_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('collection_correct_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.collection_correct_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.collection_correct_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('instructor_payment_record_v1','earnings.manage','collection',array['F20']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.instructor_payment_record_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('instructor_payment_record_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.instructor_payment_record_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.instructor_payment_record_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('instructor_payment_correct_v1','earnings.manage','maintenance',array['F20','F33']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.instructor_payment_correct_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('instructor_payment_correct_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.instructor_payment_correct_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.instructor_payment_correct_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
