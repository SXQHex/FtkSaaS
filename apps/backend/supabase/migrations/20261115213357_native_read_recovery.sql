-- Web1 backend discovery, recovery and explicit sale/product policies.
begin;

-- Source: account-person-directory-query.sql
create or replace function private.account_person_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare k jsonb:=r#>'{selector,key}';raw jsonb;filtered jsonb;result jsonb;items jsonb;summary jsonb;at timestamptz:=clock_timestamp();
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 perform private.assert_center(org,center);
 if private.access_mode(org)='bootstrap' then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
 if private.access_mode(org)='closed' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if k->>'directory' is distinct from 'center' or k->>'view' is distinct from 'people' or coalesce(k->>'status','all') not in ('linked','unlinked','all') then perform private.fail('VALIDATION_FAILED');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb then perform private.fail('VALIDATION_FAILED');end if;
 -- Resolve each participating identity once. Calling same_person inside a
 -- correlated EXISTS for every person/relationship pair made this directory
 -- quadratic, before its cursor page was even selected.
 with center_people as materialized(
  select x.person_id from private.person_center_relationships x where x.org_id=org and x.center_id=center
  union select x.person_id from core.invitations x where x.org_id=org and x.center_id=center
  union select x.person_id from core.role_assignments x where x.org_id=org and (x.scope_center_id=center or x.scope_center_id is null)
 ), roots as materialized(
  select distinct private.p07_person_root(org,x.person_id) id from center_people x
 ), links as materialized(
  select x.id,x.version,x.created_at,private.p07_person_root(org,x.person_id) person_id from core.account_links x where x.org_id=org and x.state='active'
 ), eligible as materialized(
  select p.id,p.version,p.created_at,private.directory_person_name(org,center,actor,p.id) display_name
  from core.people p join roots z on z.id=p.id where p.org_id=org and p.merged_into_id is null
 ), rows as(
  select p.*,l.id link_id,l.version link_version from eligible p left join lateral(
   select x.id,x.version from links x where x.person_id=p.id order by x.created_at,x.id limit 1
  ) l on true where p.display_name is not null and (k->>'query' is null or strpos(lower(p.display_name),lower(k->>'query'))>0)
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'created_at',created_at,'display_name',display_name,'link_id',link_id,'link_version',link_version,
  'status',case when link_id is null then 'unlinked' else 'linked' end) order by created_at,id),'[]') into raw from rows;
 select coalesce(jsonb_agg(x order by n),'[]') into filtered from jsonb_array_elements(raw) with ordinality a(x,n) where coalesce(k->>'status','all')='all' or x->>'status'=k->>'status';
 select jsonb_build_object('total',jsonb_array_length(raw),'filtered',jsonb_array_length(filtered),'by_state',coalesce(jsonb_agg(jsonb_build_object('state',state,'count',n) order by state),'[]')) into summary
 from(select x->>'status' state,count(*) n from jsonb_array_elements(raw) x group by x->>'status') counts;
 result:=private.p06_page(filtered,r->'page',md5(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page')::text),at);
 select coalesce(jsonb_agg(case when x->>'link_id' is not null then private.access_directory_item('account_link_remove_v1',org,center,actor,account,(x->>'link_id')::uuid,at)
  else jsonb_build_object('operation','account_link_remove_v1','entity',jsonb_build_object('type','people','id',x->'id'),'exists',true,'state','inactive',
   'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',x->'id'),'version',x->'version')),'as_of',at,
   'current',jsonb_build_object('operation','account_link_remove_v1','values',jsonb_build_object('person_id',x->'id','actionable',false))) end
  ||jsonb_build_object('access_detail',jsonb_build_object('kind','person_account','person_id',x->'id','display_name',x->'display_name','created_at',x->'created_at','linked',x->>'link_id' is not null,'can_send_invitation',private.directory_resend_allowed(org,center,actor,(x->>'id')::uuid))) order by n),'[]') into items from jsonb_array_elements(result->'items') with ordinality a(x,n);
 return jsonb_build_object('data',jsonb_set(result,'{items}',items)||jsonb_build_object('access_summary',summary),'subject','people');
end$$;

-- Source: capacity-recovery.sql
-- Receipt/preview contexts written before this migration contain the internal
-- capacity representation. Restore the public shape only at this private replay
-- boundary; public capacity_input remains strict and is never broadened.
create function private.capacity_recovery_request(op text,r jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare path text[];v jsonb;
begin
 path:=case when op in ('session_create_v1','replacement_session_create_v1','session_capacity_set_v1') then array['capacity']
  when op='program_preview_v1' then array['schedule','capacity']
  when op='session_change_preview_v1' then array['patch','capacity'] end;
 if path is null then return r;end if;
 v:=r#>path;
 if v is not null and not v?'total' and v?'nominal' and v?'maximum' then
  if v->'nominal' is distinct from v->'maximum' then perform private.fail('INTEGRITY_VIOLATION');end if;
  r:=jsonb_set(r,path,jsonb_build_object('total',v->'nominal')||case when v->'categories' is not null and v->'categories'<>'null'::jsonb then jsonb_build_object('categories',v->'categories') else '{}'::jsonb end);
 end if;
 return r;
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.p06_original_authorize(text,jsonb,uuid,uuid,uuid[])'::regprocedure);a text:='response:=private.execute_operation(op,r,auth_id,session_id,ids,';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Capacity recovery authorization anchor drift';end if;
 execute replace(b,a,'response:=private.execute_operation(op,private.capacity_recovery_request(op,r),auth_id,session_id,ids,');
end$patch$;
revoke all on function private.capacity_recovery_request(text,jsonb) from public,anon,authenticated;
grant execute on function private.capacity_recovery_request(text,jsonb) to service_role;

-- Source: session-management-reads.sql
create function private.session_management_page(r jsonb,org uuid,center uuid,account uuid,auth_id uuid,session_id uuid,ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';source core.sessions;x core.sessions;probe jsonb;vals jsonb;items jsonb:='[]';at timestamptz:=clock_timestamp();
begin
 if center is null or op not in ('session_change_preview_v1','replacement_session_create_v1') or r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;
 select s.* into source from core.sessions s where s.org_id=org and s.center_id=center and s.id=coalesce((k->>'session_id')::uuid,(k->>'replaces_id')::uuid);
 if source.id is null then perform private.fail('NOT_FOUND');end if;
 if op='session_change_preview_v1' and coalesce(k->>'scope','') not in ('single','this_and_future') then perform private.fail('VALIDATION_FAILED');end if;
 probe:=jsonb_build_object('client_api_version',1,'request_id',r->'request_id','org_id',org,'center_id',center)||k;
 if op='replacement_session_create_v1' then probe:=probe||jsonb_build_object('capacity',jsonb_build_object('total',source.nominal));end if;
 perform private.p06_original_authorize(op,probe,auth_id,session_id,ids);
 for x in select s.* from core.sessions s where s.org_id=org and s.center_id=center and (
  (op='replacement_session_create_v1' and s.replaces_id=source.id)
  or (op='session_change_preview_v1' and (s.id=source.id or (k->>'scope'='this_and_future' and source.program_id is not null and s.program_id=source.program_id and s.starts_at>=source.starts_at)))) order by s.created_at,s.id loop
  if r->'entity' is not null and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type','sessions','id',x.id) then continue;end if;
  vals:=jsonb_build_object('interval',jsonb_build_object('starts_at',x.starts_at,'ends_at',x.ends_at),
   'capacity',jsonb_build_object('total',x.nominal)||case when x.category_capacities is not null then jsonb_build_object('categories',x.category_capacities) else '{}'::jsonb end,
   'resources',coalesce((select jsonb_agg(jsonb_build_object('kind',b.resource_kind,'id',b.resource_id) order by b.resource_kind,b.resource_id) from core.resource_bookings b where b.org_id=org and b.center_id=center and b.session_id=x.id and b.state='active'),'[]'::jsonb));
  vals:=case when op='session_change_preview_v1' then jsonb_build_object('session_id',x.id,'scope',k->'scope','patch',vals)
   else vals||jsonb_build_object('replaces_id',x.replaces_id) end;
  items:=items||jsonb_build_array(jsonb_build_object('operation',op,'entity',jsonb_build_object('type','sessions','id',x.id),'exists',true,'state',x.state,
   'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sessions','id',x.id),'version',x.version)),
   'current',jsonb_build_object('operation',op,'values',vals)));
 end loop;
 probe:=private.p06_page(items,r->'page',md5(jsonb_build_object('account',account,'request',r-'request_id'-'page')::text),at);
 select coalesce(jsonb_agg(x||jsonb_build_object('as_of',at) order by n),'[]') into items from jsonb_array_elements(probe->'items') with ordinality a(x,n);
 return jsonb_set(probe,'{items}',items);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Session management dispatch anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation' in ('session_change_preview_v1','replacement_session_create_v1') then
  out:=private.session_management_page(r,org,center,actor.id,p_actor_auth_id,p_session_id,p_ids);
  return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
end$patch$;
revoke all on function private.session_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.session_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[]) to service_role;

-- Source: sale-discount.sql
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

-- Source: entitlement-ledger-read.sql
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

-- Source: person-membership-date.sql
-- User decision: membership means the first recorded student relationship in
-- the selected center, including inactive history and canonical aliases.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=$a$ if p_operation='people_list_v1' and coalesce((r->>'include_member_summary')::boolean,false) then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Membership date projection anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='person_get_v1' and coalesce((r->>'include_membership_date')::boolean,false) then
  if center is null then perform private.fail('VALIDATION_FAILED');end if;
  out:=out||jsonb_build_object('membership_started_at',(select min(c.started_at) from core.center_relationships c
   where c.org_id=org and c.center_id=center and c.kind='student' and c.person_id=any(private.p07_person_members(org,(r->>'person_id')::uuid))));
 end if;
$a$||a);
end$patch$;

-- Source: finance-directory.sql
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

-- Source: class-student-discovery.sql
-- Fixed-group membership is the accepted priority-reservation model. No new
-- permanent membership, automatic sale choice, or future-booking worker exists.
create function private.class_student_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';cls core.classes;items jsonb;result jsonb;at timestamptz:=clock_timestamp();lo timestamptz:=(k#>>'{interval,starts_at}')::timestamptz;hi timestamptz:=(k#>>'{interval,ends_at}')::timestamptz;feature text;
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if lo is null or hi is null or not isfinite(lo) or not isfinite(hi) or lo>=hi or hi-lo>interval '366 days' then perform private.fail('VALIDATION_FAILED');end if;
 select c.* into cls from core.classes c where c.org_id=org and c.center_id=center and c.id=(k->>'class_id')::uuid;
 if cls.id is null then perform private.fail('NOT_FOUND');end if;
 perform private.require_feature(org,'F10');
 for feature in select unnest(o.features) from private.runtime_operations o where o.name='reservation_list_v1' loop perform private.require_feature(org,feature);end loop;
 perform private.starter_request_guard('reservation_list_v1',jsonb_build_object('center_id',center,'class_id',cls.id,'discipline_id',cls.discipline_id),org);
 if k->>'program_id' is not null and not exists(select 1 from core.program_versions p where p.org_id=org and p.center_id=center and p.class_id=cls.id and p.id=(k->>'program_id')::uuid) then perform private.fail('NOT_FOUND');end if;
 with selected as materialized(
  select v.*,s.starts_at,s.ends_at,private.p07_person_root(org,v.person_id) root from core.reservations v
  join core.sessions s on s.org_id=v.org_id and s.center_id=v.center_id and s.id=v.session_id
  where v.org_id=org and v.center_id=center and s.class_id=cls.id and v.mode='priority'
   and (k->>'program_id' is null or s.program_id=(k->>'program_id')::uuid)
   and s.starts_at<hi and s.ends_at>lo and private.member_summary_enabled(org,array['reservation_list_v1','session_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'session_id',s.id,'person_id',private.p07_person_root(org,v.person_id))) and (coalesce(k->>'status','active')='all' or v.state=coalesce(k->>'status','active'))
 ), grouped as(
  select p.id,p.version,p.state,p.created_at,private.directory_person_name(org,center,actor,p.id) display_name,
   jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'session_id',v.session_id,'starts_at',v.starts_at,'ends_at',v.ends_at,
    'source_sale_id',v.source_sale_id,'mode',v.mode,'state',v.state) order by v.starts_at,v.id) reservations,
   jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','reservations','id',v.id),'version',v.version) order by v.starts_at,v.id) versions
  from selected v join core.people p on p.org_id=org and p.id=v.root group by p.id,p.version,p.state,p.created_at
 ) select coalesce(jsonb_agg(jsonb_build_object('operation','reservation_cancel_v1','entity',jsonb_build_object('type','people','id',p.id),'exists',true,'state',p.state,
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',p.id),'version',p.version))||p.versions,
  'current',null,'group_student',jsonb_build_object('person_id',p.id,'display_name',p.display_name,'reservations',p.reservations)) order by p.created_at,p.id),'[]')
 into items from grouped p where p.display_name is not null and (k->>'query' is null or strpos(lower(p.display_name),lower(k->>'query'))>0)
  and (r->'entity' is null or r->'entity'='null'::jsonb or r->'entity'=jsonb_build_object('type','people','id',p.id));
 result:=private.p06_page(items,r->'page',md5(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page')::text),at);
 select coalesce(jsonb_agg(x||jsonb_build_object('as_of',at) order by n),'[]') into items from jsonb_array_elements(result->'items') with ordinality a(x,n);
 return jsonb_set(result,'{items}',items);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Class student dispatch anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation'='reservation_cancel_v1' and r#>>'{selector,key,directory}'='class' then
  out:=private.class_student_directory(r,org,center,person,actor.id);
  return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
end$patch$;
revoke all on function private.class_student_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.class_student_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;

-- Source: product-management.sql
do $state$
declare c record;col smallint;seen bool:=false;
begin
 select attnum into col from pg_attribute where attrelid='core.products'::regclass and attname='state';
 for c in select conname from pg_constraint where conrelid='core.products'::regclass and contype='c' and conkey=array[col] loop
  execute format('alter table core.products drop constraint %I',c.conname);seen:=true;
 end loop;
 if not seen then raise exception 'Product state CHECK anchor missing';end if;
 alter table core.products add constraint products_lifecycle_state check(state in ('active','inactive','archived'));
end$state$;
create function private.product_lifecycle(r jsonb,org uuid,center uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare p core.products;new_state text:=case r->>'action' when 'open' then 'active' when 'close' then 'inactive' when 'archive' then 'archived' end;
begin
 if new_state is null or nullif(btrim(r->>'reason'),'') is null or length(r->>'reason')>2000 then perform private.fail('VALIDATION_FAILED');end if;
 select x.* into p from core.products x where x.org_id=org and x.center_id=center and x.id=(r->>'product_id')::uuid for update;
 if p.id is null then perform private.fail('NOT_FOUND');end if;
 if (select v.kind from core.product_versions v where v.org_id=org and v.product_id=p.id order by v.effective_at desc,v.created_at desc,v.id desc limit 1)='timed' then perform private.require_feature(org,'F16');end if;
 if p.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if p.state=new_state then perform private.fail('INVALID_STATE_TRANSITION');end if;
 update core.products set state=new_state,version=version+1 where org_id=org and id=p.id;
 return jsonb_build_object('id',p.id,'version',p.version+1,'audit',jsonb_build_object('before',to_jsonb(p),'state',new_state));
end$$;
create function private.product_management_page(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare view_name text:=coalesce(r->>'view','products');items jsonb;totals jsonb;result jsonb;at timestamptz:=clock_timestamp();is_starter bool:=private.current_plan_name(org)='starter';
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if view_name not in ('products','versions','sales') then perform private.fail('VALIDATION_FAILED');end if;
 if view_name<>'products' and r->>'product_id' is null then perform private.fail('VALIDATION_FAILED');end if;
 if r->>'product_id' is not null and not exists(select 1 from core.products p where p.org_id=org and p.center_id=center and p.id=(r->>'product_id')::uuid) then perform private.fail('NOT_FOUND');end if;
 if coalesce((r->>'include_timed_products')::bool,false) then perform private.require_feature(org,'F16');end if;
 with catalog as materialized(
  select p.* from core.products p join lateral(select v.id,v.kind from core.product_versions v where v.org_id=org and v.product_id=p.id and v.effective_at<=at order by v.effective_at desc,v.created_at desc,v.id desc limit 1) v on true
  where p.org_id=org and p.center_id=center and (not is_starter or private.starter_product_allowed(org,v.id)) and (v.kind='credits' or coalesce((r->>'include_timed_products')::bool,false))
 ), current_rights as materialized(
  select s.id,s.person_id,s.product_version_id from core.sales s join core.entitlement_accounts a on a.org_id=s.org_id and a.sale_id=s.id
  join core.product_versions v on v.org_id=s.org_id and v.id=s.product_version_id join catalog p on p.id=v.product_id
  where s.org_id=org and s.center_id=center and (not is_starter or private.member_summary_enabled(org,array['finance_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',private.p07_person_root(org,s.person_id)))) and s.state='active' and a.state='active' and s.valid_from<=at and s.valid_until>at
   and (v.kind='timed' or private.credit_available(org,s.id)+(select coalesce(sum(x.quantity),0) from core.entitlement_allocations x where x.org_id=org and x.sale_id=s.id and x.state='reserved')>0)
 ) select jsonb_build_object('on_sale',(select count(*) from catalog p where p.state='active'),'closed',(select count(*) from catalog p where p.state='inactive'),
  'archived',(select count(*) from catalog p where p.state='archived'),'active_right_holders',(select count(distinct private.p07_person_root(org,s.person_id)) from current_rights s),
  'last_30_days',coalesce((select jsonb_agg(jsonb_build_object('currency',q.currency,'sales',q.n,'net_minor',q.net::text) order by q.currency) from(
   select s.currency,count(*) n,sum(s.net_minor::numeric) net from core.sales s join core.product_versions v on v.org_id=s.org_id and v.id=s.product_version_id join catalog p on p.id=v.product_id
   where s.org_id=org and s.center_id=center and (not is_starter or private.member_summary_enabled(org,array['finance_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',private.p07_person_root(org,s.person_id)))) and s.created_at>=at-interval '30 days' and s.created_at<=at group by s.currency) q),'[]'::jsonb)) into totals;
 if view_name='products' then
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'version',p.version,'created_at',p.created_at,'state',p.state,'name',p.name,'version_id',v.id,'terms',private.catalog_terms(org,p.id,v.id),
   'active_right_holders',(select count(distinct private.p07_person_root(org,s.person_id)) from core.sales s join core.entitlement_accounts a on a.org_id=s.org_id and a.sale_id=s.id join core.product_versions x on x.org_id=s.org_id and x.id=s.product_version_id
    where s.org_id=org and s.center_id=center and (not is_starter or private.member_summary_enabled(org,array['finance_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',private.p07_person_root(org,s.person_id)))) and x.product_id=p.id and s.state='active' and a.state='active' and s.valid_from<=at and s.valid_until>at
     and (x.kind='timed' or private.credit_available(org,s.id)+(select coalesce(sum(z.quantity),0) from core.entitlement_allocations z where z.org_id=org and z.sale_id=s.id and z.state='reserved')>0))) order by p.created_at,p.id),'[]') into items
  from core.products p join lateral(select x.* from core.product_versions x where x.org_id=org and x.product_id=p.id and x.effective_at<=at order by x.effective_at desc,x.created_at desc,x.id desc limit 1) v on true
  where p.org_id=org and p.center_id=center and (not is_starter or private.starter_product_allowed(org,v.id)) and (r->>'product_id' is null or p.id=(r->>'product_id')::uuid)
   and (v.kind='credits' or coalesce((r->>'include_timed_products')::bool,false))
   and (coalesce(r->>'status','all')='all' or p.state=case r->>'status' when 'on_sale' then 'active' when 'closed' then 'inactive' when 'archived' then 'archived' end)
   and (r->>'query' is null or strpos(lower(p.name),lower(r->>'query'))>0);
 elsif view_name='versions' then
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'created_at',v.created_at,'product_id',v.product_id,'terms',private.catalog_terms(org,v.product_id,v.id)) order by v.created_at,v.id),'[]') into items
  from core.product_versions v where v.org_id=org and v.center_id=center and (not is_starter or private.starter_product_allowed(org,v.id)) and v.product_id=(r->>'product_id')::uuid
   and (v.kind='credits' or coalesce((r->>'include_timed_products')::bool,false)) and (r->>'query' is null or strpos(lower(v.published_name),lower(r->>'query'))>0);
 else
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'version',s.version,'created_at',s.created_at,'person_id',private.p07_person_root(org,s.person_id),
   'display_name',private.directory_person_name(org,center,actor,s.person_id),'product_version_id',v.id,'product_name',v.published_name,'net_minor',s.net_minor::text,'currency',s.currency,'state',s.state) order by s.created_at,s.id),'[]') into items
  from core.sales s join core.product_versions v on v.org_id=s.org_id and v.id=s.product_version_id where s.org_id=org and s.center_id=center and (not is_starter or private.member_summary_enabled(org,array['finance_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',private.p07_person_root(org,s.person_id)))) and (not is_starter or private.starter_product_allowed(org,v.id)) and v.product_id=(r->>'product_id')::uuid
   and (v.kind='credits' or coalesce((r->>'include_timed_products')::bool,false)) and (r->>'query' is null or strpos(lower(v.published_name),lower(r->>'query'))>0);
 end if;
 result:=private.p06_page(items,r->'page',md5(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page')::text),at);
 return result||jsonb_build_object('view',view_name,'totals',totals);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product management dispatch anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation='products_management_list_v1' then
  out:=private.product_management_page(r,org,center,person,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
 a:=$a$ when 'product_publish_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product lifecycle write anchor drift';end if;
 b:=replace(b,a,$a$ when 'product_state_set_v1' then
  terms:=private.product_lifecycle(r,org,center);record_id:=(terms->>'id')::uuid;version_n:=(terms->>'version')::bigint;subject:='products';audit_delta:=terms->'audit';
$a$||a||$a$
  if r->>'expected_version' is not null and not exists(select 1 from core.products p where p.org_id=org and p.center_id=center and p.id=(r->>'product_id')::uuid and p.version=(r->>'expected_version')::bigint) then perform private.fail('VERSION_CONFLICT');end if;
$a$);
 a:=$a$case when private.current_plan_name(org)='starter' then terms->>'name' else (select name from core.products where org_id=org and id=selected) end$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product version name anchor drift';end if;
 b:=replace(b,a,$a$terms->>'name'$a$);
 a:=$a$if private.current_plan_name(org)='starter' then update core.products set name=terms->>'name',version=version+1 where org_id=org and id=selected and name is distinct from terms->>'name';end if;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product master name anchor drift';end if;
 b:=replace(b,a,$a$if r->>'product_id' is not null then update core.products set name=terms->>'name',version=version+1 where org_id=org and id=selected;end if;$a$);
 a:=$a$ if p_aux->>'phase'='p06_authorize_original' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product state feature preflight anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation='product_state_set_v1' and (select v.kind from core.product_versions v where v.org_id=org and v.center_id=center and v.product_id=(r->>'product_id')::uuid order by v.effective_at desc,v.created_at desc,v.id desc limit 1)='timed' then perform private.require_feature(org,'F16');end if;
$a$||a);
 execute b;
 b:=pg_get_functiondef('private.starter_request_guard(text,jsonb,uuid)'::regprocedure);a:=$a$ if op='product_publish_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Starter product lifecycle anchor drift';end if;
 execute replace(b,a,$a$ if op='product_state_set_v1' then
  select v.id into target from core.product_versions v where v.org_id=org and v.product_id=(r->>'product_id')::uuid order by v.effective_at desc,v.created_at desc,v.id desc limit 1;
  if target is null or not private.starter_product_allowed(org,target) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
$a$||a);
 b:=pg_get_functiondef('private.starter_replay_guard(text,uuid,uuid)'::regprocedure);a:=$a$elsif op='product_publish_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Starter product lifecycle replay anchor drift';end if;
 execute replace(b,a,$a$elsif op='product_state_set_v1' then
  select v.id into product from core.product_versions v where v.org_id=org and v.product_id=reference order by v.effective_at desc,v.created_at desc,v.id desc limit 1;
  if not coalesce(private.starter_product_allowed(org,product),false) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
$a$||a);
 b:=pg_get_functiondef('private.sale_discount_amount(uuid,uuid,uuid,uuid,text)'::regprocedure);a:=' if price is null then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product sale gate anchor drift';end if;
 execute replace(b,a,$a$ if not exists(select 1 from core.product_versions v join core.products p on p.org_id=v.org_id and p.id=v.product_id where v.org_id=org and v.id=product_version and p.state='active') then perform private.fail('FORBIDDEN');end if;
$a$||a);
 b:=pg_get_functiondef('private.sale_impact(jsonb,uuid,uuid,uuid,uuid,uuid)'::regprocedure);a:=$a$'product',to_jsonb(p),$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product publication sale dependency anchor drift';end if;
 execute replace(b,a,a||$a$'catalog_product',(select to_jsonb(x) from core.products x where x.org_id=org and x.id=p.product_id),$a$);
end$patch$;
revoke all on function private.product_lifecycle(jsonb,uuid,uuid),private.product_management_page(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.product_lifecycle(jsonb,uuid,uuid),private.product_management_page(jsonb,uuid,uuid,uuid,uuid) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('products_management_list_v1','product.manage','read',array['F15','F06','F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
insert into private.runtime_operations(name,permission,billing_class,features) values('product_state_set_v1','product.manage','config',array['F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create function api_v1.products_management_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('products_management_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
create function api_v1.product_state_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('product_state_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.products_management_list_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.product_state_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.products_management_list_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.product_state_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
