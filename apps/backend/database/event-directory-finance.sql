-- W1-BE-26/27: existing event readers and the existing explicit debt links.
begin;
create index event_directory_period on core.events(org_id,center_id,starts_at,id);
create index event_registration_debt_read on core.debts(org_id,center_id,event_registration_id) where event_registration_id is not null;
create function private.event_registration_debts(org uuid,center uuid,registration uuid) returns setof core.debts
language sql stable security invoker set search_path='' as $$
 select d.* from core.event_registrations v join core.debts d on d.org_id=v.org_id and d.center_id=v.center_id
  and private.p07_same_person(org,d.person_id,v.person_id)
 where v.org_id=org and v.center_id=center and v.id=registration and (
  d.event_registration_id=v.id or (d.event_registration_id is null and exists(
   select 1 from core.event_payment_preparations p where p.org_id=org and p.center_id=center and p.event_id=v.event_id
    and p.registration_id=v.id and p.debt_id=d.id and private.p07_same_person(org,p.person_id,v.person_id))))
$$;
create function private.event_registration_payment(org uuid,center uuid,actor uuid,event uuid,registration uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare v core.event_registrations;debts jsonb;empty jsonb:=jsonb_build_object('amount_minor',null,'currency',null,'net_minor',null,'paid_minor',null,'remaining_minor',null,'credited_minor',null,'cancelled_minor',null,'debts','[]'::jsonb);result jsonb;
begin
 select * into v from core.event_registrations where org_id=org and center_id=center and event_id=event and id=registration;
 if v.id is null then perform private.fail('NOT_FOUND');end if;
 if not (private.is_manager(org,actor,center) or private.is_org_reader(org,actor) or private.event_assignee(org,actor,event) or private.p07_same_person(org,actor,v.person_id))
  or not (private.is_manager(org,actor,center) or private.is_org_reader(org,actor) or private.staff_grant(org,actor,center,'finance.collect') or private.p07_same_person(org,actor,v.person_id)) then return empty||'{"status":"restricted"}';end if;
 perform private.require_feature(org,'F29');
 if exists(select 1 from private.event_registration_debts(org,center,v.id) d where d.currency<>v.currency) then perform private.fail('INTEGRITY_VIOLATION');end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'version',d.version,'preparation_id',(
   select p.id from core.event_payment_preparations p where p.org_id=org and p.center_id=center and p.event_id=event and p.registration_id=v.id and p.debt_id=d.id and private.p07_same_person(org,p.person_id,v.person_id)),
  'currency',d.currency,'amount_minor',d.amount_minor::text,'net_minor',private.debt_net(org,d.id)::text,'paid_minor',private.debt_paid(org,d.id)::text,
  'remaining_minor',private.debt_remaining(org,d.id)::text,'credited_minor',private.debt_claimed(org,d.id)::text,
  'cancelled_minor',coalesce((select sum(case when a.direction='decrease' then a.amount_minor else -a.amount_minor end) from core.debt_adjustments a
   join core.operation_receipts o on o.org_id=a.org_id and o.id=a.operation_id where a.org_id=org and a.center_id=center and a.debt_id=d.id
    and o.operation in ('event_registration_cancel_v1','event_cancel_apply_v1')),0)::text) order by d.id),'[]') into debts
  from private.event_registration_debts(org,center,v.id) d;
 if jsonb_array_length(debts)=0 then
  if v.amount_minor<>0 then return empty||jsonb_build_object('status','missing','amount_minor',v.amount_minor::text,'currency',v.currency);end if;
  return empty||jsonb_build_object('status','no_cash_due','amount_minor','0','currency',v.currency,'net_minor','0','paid_minor','0','remaining_minor','0','credited_minor','0','cancelled_minor','0');
 end if;
 select jsonb_build_object('status','available','amount_minor',v.amount_minor::text,'currency',v.currency,'debts',debts,
  'net_minor',sum((d->>'net_minor')::numeric)::text,'paid_minor',sum((d->>'paid_minor')::numeric)::text,'remaining_minor',sum((d->>'remaining_minor')::numeric)::text,
  'credited_minor',sum((d->>'credited_minor')::numeric)::text,'cancelled_minor',sum((d->>'cancelled_minor')::numeric)::text) into result from jsonb_array_elements(debts) d;
 return result;
end$$;
create function private.event_directory_scope(r jsonb,org uuid,center uuid,actor uuid) returns setof core.events
language sql stable security invoker set search_path='' as $$
 select e.* from core.events e where e.org_id=org and (center is null or e.center_id=center) and private.center_accessible(org,e.center_id)
  and e.starts_at<(r#>>'{interval,ends_at}')::timestamptz and e.ends_at>(r#>>'{interval,starts_at}')::timestamptz
  and (private.is_org_reader(org,actor) or private.is_manager(org,actor,e.center_id) or e.published or exists(
   select 1 from core.event_registrations v where v.org_id=org and v.event_id=e.id and private.p07_same_person(org,v.person_id,actor)))
  and (r->>'discipline_id' is null or exists(select 1 from core.event_disciplines d where d.org_id=org and d.event_id=e.id and d.discipline_id=(r->>'discipline_id')::uuid))
  and (r->>'query' is null or strpos(lower(e.name),lower(btrim(r->>'query')))>0)
$$;
create function private.event_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare lo timestamptz:=(r#>>'{interval,starts_at}')::timestamptz;hi timestamptz:=(r#>>'{interval,ends_at}')::timestamptz;
 lim int:=coalesce((r#>>'{page,limit}')::int,50);status_name text:=coalesce(r->>'status','all');summary_requested bool:=coalesce((r->>'include_summary')::bool,false);
 h text;cur jsonb;last_at timestamptz;last_id uuid;items jsonb;token text;summary jsonb;stamp timestamptz:=statement_timestamp();
begin
 if actor is null then perform private.fail('NOT_FOUND');end if;
 perform private.require_feature(org,'F29');
 if lo is null or hi is null or not isfinite(lo) or not isfinite(hi) or lo>=hi or lim<1 or lim>200
  or coalesce(r#>>'{page,sort}','starts_at_asc')<>'starts_at_asc' or status_name not in ('all','published','draft','occurred','cancelled')
  or (r?'query' and length(btrim(r->>'query'))=0) then perform private.fail('VALIDATION_FAILED');end if;
 if summary_requested then
  if center is null then perform private.fail('VALIDATION_FAILED');end if;
  if not (private.is_org_reader(org,actor) or private.is_manager(org,actor,center)) then perform private.fail('FORBIDDEN');end if;
  if not private.member_summary_enabled(org,array['finance_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',actor)) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
 h:=encode(extensions.digest(jsonb_build_object('actor',actor,'account',account,'org',org,'center',center,'request',r-'request_id'-'page','sort','starts_at_asc')::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;stamp:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(stamp) or stamp>statement_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(private.event_view(org,e.id)||case when summary_requested then jsonb_build_object('active_registration_count',(
  select count(*) from core.event_registrations v where v.org_id=org and v.center_id=e.center_id and v.event_id=e.id and v.state='active')) else '{}'::jsonb end order by e.starts_at,e.id),'[]') into items
 from (select * from private.event_directory_scope(r,org,center,actor) e where (status_name='all' or e.state=status_name)
  and (last_id is null or (e.starts_at,e.id)>(last_at,last_id)) order by e.starts_at,e.id limit lim+1) e;
 if jsonb_array_length(items)>lim then
  items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1#>'{interval,starts_at}','id',items->-1->'id','as_of',stamp)::text,'utf8'),'hex');
 end if;
 if summary_requested then
  with scoped as materialized(select * from private.event_directory_scope(r,org,center,actor)),
  registrations as materialized(select v.* from core.event_registrations v join scoped e on e.id=v.event_id where v.org_id=org and v.center_id=center and e.state='published'),
  debt_rows as materialized(select v.id registration_id,d.* from registrations v cross join lateral private.event_registration_debts(org,center,v.id) d),
  pending as (select currency,sum(private.debt_remaining(org,id)) amount,count(distinct registration_id) n from debt_rows where private.debt_remaining(org,id)>0 group by currency)
  select jsonb_build_object('published',(select count(*) from scoped where state='published'),'draft',(select count(*) from scoped where state='draft'),
   'occurred',(select count(*) from scoped where state='occurred'),'cancelled',(select count(*) from scoped where state='cancelled'),
   'published_active_registrations',(select count(*) from registrations where state='active'),
   'unresolved_payment_registrations',(select count(*) from registrations v where v.amount_minor>0 and not exists(select 1 from debt_rows d where d.registration_id=v.id)),
   'pending_payments',coalesce((select jsonb_agg(jsonb_build_object('currency',currency,'remaining_minor',amount::text,'registration_count',n) order by currency) from pending),'[]'::jsonb)) into summary;
 end if;
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',stamp)||case when summary_requested then jsonb_build_object('summary',summary) else '{}'::jsonb end;
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Event directory dispatch anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation='event_list_v1' and (r?'query' or r?'status' or coalesce((r->>'include_summary')::bool,false)) then
  out:=private.event_directory(r,org,center,person,actor.id);
  return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
 a:=$a$ if out is null then out:=jsonb_build_object('operation_id'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Event payment projection response anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='event_get_v1' and coalesce((r->>'include_payment_summary')::bool,false) then
  select coalesce(jsonb_agg(x||jsonb_build_object('payment_summary',private.event_registration_payment(org,center,person,(out->>'id')::uuid,(x->>'id')::uuid)) order by n),'[]')
   into terms from jsonb_array_elements(out->'registrations') with ordinality t(x,n);
  out:=jsonb_set(out,'{registrations}',terms);
 end if;
$a$||a);
end$patch$;
revoke all on function private.event_registration_debts(uuid,uuid,uuid),private.event_registration_payment(uuid,uuid,uuid,uuid,uuid),private.event_directory_scope(jsonb,uuid,uuid,uuid),private.event_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.event_registration_debts(uuid,uuid,uuid),private.event_registration_payment(uuid,uuid,uuid,uuid,uuid),private.event_directory_scope(jsonb,uuid,uuid,uuid),private.event_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;
commit;
