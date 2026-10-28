begin;
create function private.collection_payment_valid(payment jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
begin
 if payment is null then return true;end if;
 if jsonb_typeof(payment)<>'object' then return false;end if;
 return coalesce((
  jsonb_typeof($1)='object' and $1?'method' and ($1->>'method') in ('cash','bank_transfer','card_pos')
  and not exists(select 1 from jsonb_object_keys($1) k where k not in ('method','reference'))
  and (not $1?'reference' or $1->'reference'='null' or jsonb_typeof($1->'reference')='string' and ($1->>'reference') ~ U&'[^\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]')
  and ($1->>'method'='cash' or $1?'reference' and jsonb_typeof($1->'reference')='string' and ($1->>'reference') ~ U&'[^\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]')
 ),false);
end$$;
-- Existing records remain unspecified. Do not manufacture a cash method for history.
alter table core.cash_movements add column payment jsonb;
alter table core.cash_movements add constraint cash_collection_payment check(payment is null or kind='collection' and private.collection_payment_valid(payment));
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$  insert into core.cash_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,occurred_at,reason,operation_id)
   values(record_id,org,center,target,'collection',remaining,r->>'currency',(r->>'occurred_at')::timestamptz,r->>'note',operation_id);$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Collection payment write anchor drift';end if;
 execute replace(b,a,$a$  if not private.collection_payment_valid(r->'payment') then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.cash_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,occurred_at,reason,operation_id,payment)
   values(record_id,org,center,target,'collection',remaining,r->>'currency',(r->>'occurred_at')::timestamptz,r->>'note',operation_id,r->'payment');$a$);
 b:=pg_get_functiondef('private.p03_finance_read(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$'previous_id',c.previous_id,'version',c.version$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Collection payment read anchor drift';end if;
 execute replace(b,a,a||$a$,'payment',c.payment$a$);
end$patch$;
revoke all on function private.collection_payment_valid(jsonb) from public,anon,authenticated;
grant execute on function private.collection_payment_valid(jsonb) to service_role;
commit;
