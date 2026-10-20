-- P03: claim-aware debt balance and bounded linked credit correction.
begin;
create or replace function private.debt_remaining(org uuid,debt uuid) returns bigint language sql stable set search_path='' as $$
 select greatest(0,private.debt_net(org,debt)-private.debt_paid(org,debt)+private.debt_claimed(org,debt))
$$;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.p03_finance(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:='excess:=greatest(0,claimed-greatest(0,private.debt_paid(org,a.debt_id)-private.debt_net(org,a.debt_id)));';
 if strpos(b,old)=0 then raise exception 'P03 credit reduction cap anchor missing';end if;
 b:=replace(b,old,'excess:=least(part,greatest(0,claimed-greatest(0,private.debt_paid(org,a.debt_id)-private.debt_net(org,a.debt_id))));');
 old:=$p$   effects:=jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'action','adjust','amount_minor',quote->>'debt_reduction_minor','currency',s.currency,'reason',reason||'; debt reduction before student credit; no cash or rights mutation'));$p$;
 if strpos(b,old)=0 then raise exception 'P03 refund effects anchor missing';end if;
 b:=replace(b,old,$p$
   select coalesce(jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','debts','id',x->'debt_id'),'action','adjust','amount_minor',x->>'reduction_minor','currency',s.currency,'reason',reason) order by x->>'debt_id'),'[]'::jsonb) into effects from jsonb_array_elements(quote->'debts') x;
   effects:=effects||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',s.person_id),'action','create','amount_minor',quote->>'credit_added_minor','currency',s.currency,'reason',reason||'; student credit entitlement, no cash or rights mutation'));
$p$);
 execute b;
 b:=pg_get_functiondef('private.p03_collection_effects(uuid,uuid,uuid,jsonb,uuid)'::regprocedure);
 old:='claimed_loss:=greatest(0,private.debt_claimed(org,a.debt_id)-greatest(0,private.debt_paid(org,a.debt_id)-part-private.debt_net(org,a.debt_id)));';
 if strpos(b,old)=0 then raise exception 'P03 preview credit reduction cap anchor missing';end if;
 execute replace(b,old,'claimed_loss:=least(part,greatest(0,private.debt_claimed(org,a.debt_id)-greatest(0,private.debt_paid(org,a.debt_id)-part-private.debt_net(org,a.debt_id))));');
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
