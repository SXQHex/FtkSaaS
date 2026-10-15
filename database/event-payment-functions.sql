create or replace function private.debt_net(org uuid,debt uuid) returns bigint language sql stable set search_path='' as $$
 select d.amount_minor+coalesce((select sum(case when direction='increase' then amount_minor else -amount_minor end) from core.debt_adjustments a where a.org_id=org and a.debt_id=d.id),0) from core.debts d where d.org_id=org and d.id=debt
$$;
create or replace function private.debt_paid(org uuid,debt uuid) returns bigint language sql stable set search_path='' as $$
 select coalesce(sum(a.amount_minor),0) from core.debt_allocations a where a.org_id=org and a.debt_id=debt
$$;
create or replace function private.debt_claimed(org uuid,debt uuid) returns bigint language sql stable set search_path='' as $$
 select coalesce(sum(amount_minor),0) from core.student_credit_movements where org_id=org and source_debt_id=debt and kind='refund_claim_add'
$$;
create or replace function private.student_credit_effect(org uuid,movement uuid) returns bigint language plpgsql stable set search_path='' as $$
declare m core.student_credit_movements;
begin
 select * into m from core.student_credit_movements where org_id=org and id=movement;
 if not found then perform private.fail('INTEGRITY_VIOLATION');end if;
 if m.kind='reverse' then
  if m.previous_id is null or m.previous_id=m.id then perform private.fail('INTEGRITY_VIOLATION');end if;
  return -private.student_credit_effect(org,m.previous_id);
 end if;
 return case when m.kind in ('surplus_add','refund_claim_add') then m.amount_minor else -m.amount_minor end;
end$$;
create or replace function private.student_credit_available(org uuid,center uuid,person uuid,currency text) returns bigint language sql stable set search_path='' as $$
 select coalesce(sum(private.student_credit_effect(org,m.id)),0) from core.student_credit_movements m where m.org_id=org and m.center_id=center and m.person_id=person and m.currency=currency
$$;
-- Caller owns the org/debt lock. Credit claims track the gross entitlement already created;
-- later cash refunds or offsets never make that entitlement available a second time.
create or replace function private.claim_debt_overpayment(org uuid,debt uuid,operation uuid,ids uuid[],idx int) returns bigint language plpgsql set search_path='' as $$
declare d core.debts; amount bigint;
begin
 select * into d from core.debts where org_id=org and id=debt for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 amount:=greatest(0,private.debt_paid(org,debt)-private.debt_net(org,debt)-private.debt_claimed(org,debt));
 if amount>0 then
  insert into core.student_credit_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,source_debt_id,operation_id)
  values(private.new_id(ids,idx),org,d.center_id,d.person_id,'refund_claim_add',amount,d.currency,debt,operation);
 end if;
 return amount;
end$$;
create or replace function private.cancel_event_debt(org uuid,debt uuid,operation uuid,ids uuid[],idx int,reason text) returns jsonb language plpgsql set search_path='' as $$
declare d core.debts; net bigint; removed bigint; credit bigint;
begin
 select * into d from core.debts where org_id=org and id=debt for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 net:=private.debt_net(org,debt);removed:=private.debt_remaining(org,debt);
 if net<0 then perform private.fail('INTEGRITY_VIOLATION');end if;
 if net>0 then insert into core.debt_adjustments(id,org_id,center_id,debt_id,amount_minor,direction,reason,operation_id)
 values(private.new_id(ids,idx),org,d.center_id,d.id,net,'decrease',reason,operation);end if;
 credit:=private.claim_debt_overpayment(org,debt,operation,ids,idx+1);
 update core.debts set state='settled',version=version+1 where id=debt;
 return jsonb_build_object('debt_id',debt,'remaining_removed_minor',removed::text,'student_credit_added_minor',credit::text,'currency',d.currency);
end$$;
create or replace function private.event_debt_ids(org uuid,event uuid) returns setof uuid language sql stable set search_path='' as $$
 select d.id from core.debts d where d.org_id=org and (exists(select 1 from core.event_registrations r where r.org_id=org and r.id=d.event_registration_id and r.event_id=event)
 or exists(select 1 from core.event_payment_preparations p where p.org_id=org and p.debt_id=d.id and p.event_id=event))
$$;
create or replace function private.event_financial_fingerprint(org uuid,event uuid) returns text language sql stable set search_path='' as $$
 select encode(extensions.digest(jsonb_build_object(
 'debts',coalesce((select jsonb_agg(jsonb_build_array(d.id,d.version,private.debt_net(org,d.id),private.debt_paid(org,d.id),private.debt_claimed(org,d.id)) order by d.id) from core.debts d where d.org_id=org and d.id in(select private.event_debt_ids(org,event))),'[]'::jsonb),
 'preparations',coalesce((select jsonb_agg(jsonb_build_array(p.id,p.version,p.state) order by p.id) from core.event_payment_preparations p where p.org_id=org and p.event_id=event),'[]'::jsonb))::text,'sha256'),'hex')
$$;
create or replace function private.preparation_view(org uuid,preparation uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'event_id',p.event_id,'person_id',p.person_id,'center_id',p.center_id,'debt_id',p.debt_id,'registration_id',p.registration_id,'state',p.state,'version',p.version,
 'amount_minor',d.amount_minor::text,'currency',d.currency,'paid_minor',private.debt_paid(org,d.id)::text,'remaining_minor',private.debt_remaining(org,d.id)::text,
 'credited_minor',private.debt_claimed(org,d.id)::text,'student_credit_available_minor',private.student_credit_available(org,p.center_id,p.person_id,d.currency)::text,'terms',p.terms_snapshot)
 from core.event_payment_preparations p join core.debts d on d.org_id=p.org_id and d.id=p.debt_id where p.org_id=org and p.id=preparation
$$;
create or replace function private.preparation_eligibility(org uuid,event uuid,target uuid,preparation uuid) returns text language plpgsql stable set search_path='' as $$
declare p core.event_payment_preparations;e core.events;d core.debts;
begin
 select * into e from core.events where org_id=org and id=event;
 if preparation is null then
  if exists(select 1 from core.event_payment_preparations existing where existing.org_id=org and existing.event_id=event and existing.person_id=target and existing.state='prepared') then return 'ENTITLEMENT_UNAVAILABLE';end if;
  if (e.terms->>'full_payment_required')::bool and (e.terms->>'fee_minor')::bigint>0 then return 'ENTITLEMENT_UNAVAILABLE';end if;return null;
 end if;
 select * into p from core.event_payment_preparations where org_id=org and center_id=e.center_id and event_id=event and person_id=target and id=preparation;
 if not found then return 'NOT_FOUND';end if;
 if p.state<>'prepared' then return 'INVALID_STATE_TRANSITION';end if;
 select * into d from core.debts where org_id=org and id=p.debt_id;
 -- Recheck the current obligation against its explicitly linked allocations; no client-paid flag.
 if private.debt_remaining(org,d.id)>0 then return 'ENTITLEMENT_UNAVAILABLE';end if;
 return null;
end$$;
create or replace function private.event_debt_closed(org uuid,debt uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from core.event_payment_preparations p where p.org_id=org and p.debt_id=debt and p.state in ('capacity_closed','event_cancelled'))
 or exists(select 1 from core.debts d join core.event_registrations r on r.org_id=d.org_id and r.id=d.event_registration_id join core.events e on e.org_id=r.org_id and e.id=r.event_id where d.org_id=org and d.id=debt and e.state='cancelled')
$$;
create or replace function private.event_eligibility(org uuid,event uuid,target uuid,source uuid) returns text language plpgsql stable set search_path='' as $$
#variable_conflict use_column
declare e core.events;s core.sales;
begin
 select * into e from core.events where org_id=org and id=event;
 if not found then return 'NOT_FOUND';end if;
 if e.state<>'published' then return 'INVALID_STATE_TRANSITION';end if;
 if not exists(select 1 from core.center_relationships where org_id=org and center_id=e.center_id and person_id=target and kind='student' and state='active') then return 'OPEN_OPERATIONS_EXIST';end if;
 if exists(select 1 from core.event_assignments where org_id=org and event_id=event and person_id=target and duty='assistant') then return 'ASSISTANT_PARTICIPANT_CONFLICT';end if;
 if exists(select 1 from core.event_registrations where org_id=org and event_id=event and person_id=target and state='active') then return 'RESERVATION_EXISTS';end if;
 if (select count(*) from core.event_registrations where org_id=org and event_id=event and state='active')>=e.nominal then return 'CAPACITY_FULL';end if;
 if source is null then
  return null;
 end if;
 select * into s from core.sales where org_id=org and id=source and person_id=target;
 if not found then return 'NOT_FOUND';end if;
 if not private.event_package_scope_matches(org,event,s.product_version_id) or not e.terms->'allowed_product_version_ids' @> to_jsonb(array[s.product_version_id::text]) then return 'CLASS_ACCESS_DENIED';end if;
 if private.available_for(org,s.id,e.starts_at)<1 then return 'ENTITLEMENT_UNAVAILABLE';end if;
 if coalesce((e.terms->>'full_payment_required')::bool,false) and exists(select 1 from core.debts d where d.org_id=org and d.sale_id=s.id and private.debt_remaining(org,d.id)>0) then return 'ENTITLEMENT_UNAVAILABLE';end if;
 return null;
end$$;
