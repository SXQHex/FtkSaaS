-- P03 reversals preserve the exact positive allocation provenance.
begin;
do $patch$
declare b text:=pg_get_functiondef('private.p03_finance(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;
begin
 old:=$old$claimed bigint;excess bigint;$old$;
 if strpos(b,old)=0 then raise exception 'P03 allocation provenance anchor missing';end if;
 b:=replace(b,old,$new$claimed bigint;excess bigint;pending bigint;take bigint;source_allocation record;$new$);
 old:=$old$     insert into core.debt_allocations(id,org_id,center_id,debt_id,cash_movement_id,amount_minor,previous_id)
      values(private.new_id(ids,idx),org,center,a.debt_id,pid,-part,(select x.id from core.debt_allocations x where x.org_id=org and x.debt_id=a.debt_id and x.cash_movement_id=c.id order by x.created_at,x.id limit 1));idx:=idx+1;
$old$;
 if strpos(b,old)=0 then raise exception 'P03 allocation provenance anchor missing';end if;
 b:=replace(b,old,$new$     pending:=part;
     for source_allocation in
      select x.id,x.amount_minor+coalesce((select sum(y.amount_minor) from core.debt_allocations y where y.org_id=org and y.previous_id=x.id),0) available
      from core.debt_allocations x where x.org_id=org and x.debt_id=a.debt_id and x.amount_minor>0
       and x.cash_movement_id in(select q.id from core.cash_movements q where q.org_id=org and (q.id=c.id or q.previous_id=c.id))
      order by x.created_at,x.id
     loop
      take:=least(pending,greatest(0,source_allocation.available));if take<=0 then continue;end if;
      insert into core.debt_allocations(id,org_id,center_id,debt_id,cash_movement_id,amount_minor,previous_id)
       values(private.new_id(ids,idx),org,center,a.debt_id,pid,-take,source_allocation.id);
      idx:=idx+1;pending:=pending-take;exit when pending=0;
     end loop;
     if pending<>0 then perform private.fail('INTEGRITY_VIOLATION');end if;
$new$);
 old:=$old$    insert into core.earning_allocations(id,org_id,center_id,payment_id,earning_id,amount_minor,previous_id)
     values(private.new_id(ids,idx),org,center,pid,a.earning_id,-part,(select x.id from core.earning_allocations x where x.org_id=org and x.payment_id=root and x.earning_id=a.earning_id order by x.created_at,x.id limit 1));idx:=idx+1;remaining:=remaining-part;$old$;
 if strpos(b,old)=0 then raise exception 'P03 allocation provenance anchor missing';end if;
 b:=replace(b,old,$new$    pending:=part;
    for source_allocation in
     select x.id,x.amount_minor+coalesce((select sum(y.amount_minor) from core.earning_allocations y where y.org_id=org and y.previous_id=x.id),0) available
     from core.earning_allocations x where x.org_id=org and x.earning_id=a.earning_id and x.amount_minor>0
      and x.payment_id in(select q.id from core.instructor_payments q where q.org_id=org and (q.id=root or q.previous_id=root))
     order by x.created_at,x.id
    loop
     take:=least(pending,greatest(0,source_allocation.available));if take<=0 then continue;end if;
     insert into core.earning_allocations(id,org_id,center_id,payment_id,earning_id,amount_minor,previous_id)
      values(private.new_id(ids,idx),org,center,pid,a.earning_id,-take,source_allocation.id);
     idx:=idx+1;pending:=pending-take;exit when pending=0;
    end loop;
    if pending<>0 then perform private.fail('INTEGRITY_VIOLATION');end if;
    remaining:=remaining-part;$new$);
 old:=$old$   for e in select * from core.earnings where org_id=org and id in(select x::uuid from jsonb_array_elements_text(coalesce(r->'earning_ids',
    (select jsonb_agg(distinct x.earning_id) from core.earning_allocations x where x.org_id=org and x.payment_id=root)))) order by created_at,id for update loop$old$;
 if strpos(b,old)=0 then raise exception 'P03 execution guard anchor missing';end if;
 b:=replace(b,old,$new$   for e in select z.* from core.earnings z where z.org_id=org and z.id in(
    select candidate.value::uuid from jsonb_array_elements_text(coalesce(r->'earning_ids',
     (select jsonb_agg(distinct x.earning_id) from core.earning_allocations x where x.org_id=org and x.payment_id=root))) as candidate(value))
    order by z.created_at,z.id for update loop$new$);
 old:=$old$   current_net:=private.p03_cash_net(org,c.id);$old$;
 if strpos(b,old)=0 then raise exception 'P03 execution guard anchor missing';end if;
 b:=replace(b,old,$new$   if amount<=0 then perform private.fail('VALIDATION_FAILED');end if;
   current_net:=private.p03_cash_net(org,c.id);$new$);
 old:=$old$  direction:=coalesce(req#>>'{correction,direction}','increase');$old$;
 if strpos(b,old)=0 then raise exception 'P03 execution guard anchor missing';end if;
 b:=replace(b,old,$new$  if amount<=0 then perform private.fail('VALIDATION_FAILED');end if;
  direction:=coalesce(req#>>'{correction,direction}','increase');$new$);
 execute b;
end$patch$;
commit;
