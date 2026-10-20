-- P03 source-bound collection impact and single settlement guardrails.
begin;
create function private.p03_collection_effects(org uuid,center uuid,account uuid,req jsonb,trace uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare c core.cash_movements;d core.debts;a record;amount bigint:=(req#>>'{correction,amount_minor}')::bigint;remaining bigint:=amount;part bigint;credit_delta bigint:=0;claimed_loss bigint;source_surplus bigint;
 effects jsonb:='[]';blockers jsonb:='[]';direction text:=req#>>'{correction,direction}';
begin
 select * into c from core.cash_movements where org_id=org and id=(req->>'cash_movement_id')::uuid and center_id=center;
 effects:=jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','cash_movements','id',c.id),'action','adjust','amount_minor',amount::text,'currency',c.currency,'reason',req->>'reason'));
 if direction='decrease' then
  select coalesce(sum(private.student_credit_effect(org,m.id)),0) into source_surplus from core.student_credit_movements m where m.org_id=org and m.source_debt_id is null
   and m.source_cash_id in(select q.id from core.cash_movements q where q.org_id=org and (q.id=c.id or q.previous_id=c.id));
  credit_delta:=least(remaining,greatest(0,source_surplus));remaining:=remaining-credit_delta;
  for a in select x.debt_id,sum(x.amount_minor)::bigint allocated from core.debt_allocations x where x.org_id=org
    and x.cash_movement_id in(select q.id from core.cash_movements q where q.org_id=org and (q.id=c.id or q.previous_id=c.id)) group by x.debt_id having sum(x.amount_minor)>0 order by x.debt_id loop
   part:=least(remaining,a.allocated);exit when part<=0;
   claimed_loss:=greatest(0,private.debt_claimed(org,a.debt_id)-greatest(0,private.debt_paid(org,a.debt_id)-part-private.debt_net(org,a.debt_id)));
   credit_delta:=credit_delta+claimed_loss;
   effects:=effects||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','debts','id',a.debt_id),'action','reverse','amount_minor',part::text,'currency',c.currency,'reason','Reverse source allocation; keep registration/history; claim reduction='||claimed_loss));
   remaining:=remaining-part;
  end loop;
  if credit_delta>private.student_credit_available(org,center,c.person_id,c.currency) then blockers:=jsonb_build_array(jsonb_build_object('code','INSUFFICIENT_STUDENT_CREDIT','retryable',false,'trace_id',trace));end if;
 else
  for d in select * from core.debts where org_id=org and center_id=center and person_id=c.person_id and currency=c.currency and id in
   (select x.debt_id from core.debt_allocations x where x.org_id=org and x.cash_movement_id=c.id) order by due_at,id loop
   part:=least(remaining,private.debt_remaining(org,d.id));if part<=0 then continue;end if;
   effects:=effects||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','debts','id',d.id),'action','adjust','amount_minor',part::text,'currency',c.currency,'reason','Allocate correction to original selected debt scope'));
   remaining:=remaining-part;exit when remaining=0;
  end loop;
  credit_delta:=remaining;
 end if;
 effects:=effects||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',c.person_id),'action',case when direction='decrease' then 'reverse' else 'create' end,'amount_minor',credit_delta::text,'currency',c.currency,'reason','Student credit '||direction||'; no automatic cash refund or offset'));
 return jsonb_build_object('effects',effects,'blockers',blockers);
end$$;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.p03_finance(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:='  dep:=private.p03_dependencies(org,center,account,s.id);';
 if strpos(b,old)=0 then raise exception 'P03 collection quote anchor missing';end if;
 b:=replace(b,old,$p$  if not is_refund then quote:=private.p03_collection_effects(org,center,account,req,pid);effects:=quote->'effects';end if;
$p$||old);
 old:=$p$'dependencies',dep,'effects',effects,'blockers','[]'::jsonb,'expires_at'$p$;
 if strpos(b,old)=0 then raise exception 'P03 blocker anchor missing';end if;
 b:=replace(b,old,$p$'dependencies',dep,'effects',effects,'blockers',case when is_refund then '[]'::jsonb else quote->'blockers' end,'expires_at'$p$);
 execute b;
 b:=pg_get_functiondef('private.p02_refund_quote(uuid,uuid)'::regprocedure);
 old:=' remaining:=calculated;';
 if strpos(b,old)=0 then raise exception 'P03 once-only quote anchor missing';end if;
 b:=replace(b,old,$p$
 if exists(select 1 from private.p02_sale_settlements x where x.org_id=org and x.sale_id=s.id)
 or exists(select 1 from private.p03_sale_refunds x where x.org_id=org and x.sale_id=s.id) then calculated:=0;end if;
 remaining:=calculated;$p$);execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
