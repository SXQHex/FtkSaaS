begin;
-- No existing organization or user is opted into discounts by migration.
do $constraints$
declare c record;expression text;col smallint;seen bool:=false;
begin
 select attnum into col from pg_attribute where attrelid='core.permission_overrides'::regclass and attname='permission';
 for c in select oid,conname from pg_constraint where conrelid='core.permission_overrides'::regclass and contype='c' and conkey=array[col] loop
  expression:=pg_get_constraintdef(c.oid);expression:=substring(expression from 8 for length(expression)-8);
  execute format('alter table core.permission_overrides drop constraint %I',c.conname);
  execute format('alter table core.permission_overrides add constraint %I check (permission=%L or (%s))',c.conname,'sale.discount',expression);seen:=true;
 end loop;
 if not seen then raise exception 'Discount permission CHECK anchor missing';end if;
end$constraints$;
create function private.sale_discount_amount(org uuid,center uuid,actor uuid,product_version uuid,requested text) returns bigint
language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare price bigint;net bigint;lim bigint;v jsonb;
begin
 select p.price_minor into price from core.product_versions p where p.org_id=org and p.center_id=center and p.id=product_version;
 if price is null then perform private.fail('NOT_FOUND');end if;
 net:=coalesce(requested::bigint,price);
 if net=price then return net;end if;
 if net<0 or net>price then perform private.fail('VALIDATION_FAILED');end if;
 if not exists(select 1 from core.permission_overrides p where p.org_id=org and p.center_id=center and p.person_id=actor and p.permission='sale.discount' and p.enabled) then perform private.fail('FORBIDDEN');end if;
 select p.value into v from private.policy_at(org,null,'sale_discount_percent_upper',clock_timestamp()) p;
 if v is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 lim:=(v->>'value')::bigint;
 if v->>'kind' is distinct from 'integer' or lim is null or lim<0 or lim>100 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 -- Numeric arithmetic avoids int64 overflow and does not round a forbidden
 -- fraction of a minor unit into an allowed discount.
 if net::numeric*100<price::numeric*(100-lim) then perform private.fail('FORBIDDEN');end if;
 return net;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.validate_policy(text,jsonb)'::regprocedure);
 a:=' expected:=case';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discount policy validation anchor drift';end if;
 execute replace(b,a,$a$ if k='sale_discount_percent_upper' then
  if v->>'kind' is distinct from 'integer' or v->>'value' is null or (v->>'value')::numeric<>trunc((v->>'value')::numeric) or (v->>'value')::numeric not between 0 and 100 then perform private.fail('VALIDATION_FAILED');end if;
  return;
 end if;
$a$||a);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$  if r->>'net_minor' is not null and (r->>'net_minor')::bigint<>pv.price_minor then perform private.fail('FORBIDDEN');end if;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discount preview anchor drift';end if;
 b:=replace(b,a,$a$  perform private.sale_discount_amount(org,center,person,pv.id,r->>'net_minor');$a$);
 a:=$a$   values(record_id,org,center,target,pv.id,pv.price_minor,pv.currency,start_at,end_at,'active',preview.scope_hash$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discount sale amount anchor drift';end if;
 b:=replace(b,a,$a$   values(record_id,org,center,target,pv.id,private.sale_discount_amount(org,center,person,pv.id,entry->>'net_minor'),pv.currency,start_at,end_at,'active',preview.scope_hash$a$);
 a:=$a$  if pv.price_minor>0 then insert into core.debts(id,org_id,center_id,person_id,sale_id,amount_minor,currency,due_at,state) values(private.new_id(p_ids,13),org,center,target,record_id,pv.price_minor,pv.currency,now(),'open');end if;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discount debt amount anchor drift';end if;
 b:=replace(b,a,$a$  amount:=private.sale_discount_amount(org,center,person,pv.id,entry->>'net_minor');
  if amount>0 then insert into core.debts(id,org_id,center_id,person_id,sale_id,amount_minor,currency,due_at,state) values(private.new_id(p_ids,13),org,center,target,record_id,amount,pv.currency,now(),'open');end if;$a$);
 a:=$a$ when 'policy_publish_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discount org policy scope anchor drift';end if;
 b:=replace(b,a,a||$a$
  if r->>'key'='sale_discount_percent_upper' and center is not null then perform private.fail('VALIDATION_FAILED');end if;
$a$);
 a:=$a$when 'permission_set_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discount permission write anchor drift';end if;
 -- A center manager still needs an explicit override. Granting it uses the
 -- existing versioned, audited permission command, including for managers.
 b:=replace(b,$a$if not private.has_role(org,target,'staff',center) and not private.has_role(org,target,'instructor',center) then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;$a$,
 $a$if not private.has_role(org,target,'staff',center) and not private.has_role(org,target,'instructor',center) and not (r->>'permission'='sale.discount' and private.is_manager(org,target,center)) then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;$a$);
 a:=$a$'person.manage','person.activate','invite.student','reservation.write','attendance.draft','sale.write','finance.collect'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discount permission allowlist anchor drift';end if;
 b:=replace(b,a,a||$a$,'sale.discount'$a$);
 execute b;
 b:=pg_get_functiondef('private.permission_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discount permission discovery anchor drift';end if;
 b:=replace(b,a,a||$a$,'sale.discount'$a$);
 b:=replace(b,$a$if not private.has_role(org,target,'staff',center) and not private.has_role(org,target,'instructor',center) then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;$a$,
 $a$if not private.has_role(org,target,'staff',center) and not private.has_role(org,target,'instructor',center) and not (permission_code='sale.discount' and private.is_manager(org,target,center)) then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;$a$);
 execute b;
 b:=pg_get_functiondef('private.sale_impact(jsonb,uuid,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$'debt_minor',p.price_minor::text$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discount preview impact anchor drift';end if;
 execute replace(b,a,$a$'debt_minor',private.sale_discount_amount(org,center,actor,p.id,r->>'net_minor')::text$a$);
end$patch$;
revoke all on function private.sale_discount_amount(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.sale_discount_amount(uuid,uuid,uuid,uuid,text) to service_role;
commit;
