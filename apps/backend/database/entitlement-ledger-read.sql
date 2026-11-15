begin;
-- A ledger is opt-in and bound to one sale already disclosed by the native
-- purchased-right reader. It grants neither audit.read nor a new person scope.
alter function private.purchased_rights(jsonb,uuid,uuid,uuid) rename to purchased_rights_before_ledger;
create function private.purchased_rights(r jsonb,org uuid,actor uuid,center uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare result jsonb;items jsonb;ledger jsonb;sale uuid:=(r->>'ledger_sale_id')::uuid;at timestamptz:=clock_timestamp();
begin
 result:=private.purchased_rights_before_ledger(r,org,actor,center);
 if sale is null then
  if r?'ledger_page' then perform private.fail('VALIDATION_FAILED');end if;
  return result;
 end if;
 if not r?'ledger_page' then perform private.fail('VALIDATION_FAILED');end if;
 if not exists(select 1 from jsonb_array_elements(result) x where (x->>'sale_id')::uuid=sale) then perform private.fail('NOT_FOUND');end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'created_at',m.created_at,'kind',m.kind,'quantity',m.quantity,
  'balance_delta',private.credit_effect(org,m.id),'previous_id',m.previous_id,
  'source',case when m.reservation_id is not null then jsonb_build_object('type','reservations','id',m.reservation_id)
   when m.event_registration_id is not null then jsonb_build_object('type','event_registrations','id',m.event_registration_id)
   else jsonb_build_object('type','sales','id',m.sale_id) end) order by m.created_at,m.id),'[]'::jsonb) into items
 from core.entitlement_movements m where m.org_id=org and m.sale_id=sale;
 ledger:=private.p06_page(items,r->'ledger_page',md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'ledger_page')::text),at);
 select jsonb_agg(case when (x->>'sale_id')::uuid=sale then x||jsonb_build_object('movements',ledger) else x end order by n)
 into result from jsonb_array_elements(result) with ordinality a(x,n);
 return result;
end$$;
revoke all on function private.purchased_rights(jsonb,uuid,uuid,uuid),private.purchased_rights_before_ledger(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.purchased_rights(jsonb,uuid,uuid,uuid),private.purchased_rights_before_ledger(jsonb,uuid,uuid,uuid) to service_role;
commit;
