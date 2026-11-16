-- W1-BE-19: native self discovery and immutable manual payment method evidence.
begin;
alter table core.instructor_payments add column if not exists payment_details jsonb;
alter table core.instructor_payments add constraint instructor_payment_method check(private.collection_payment_valid(payment_details));
create index instructor_payment_self_period on core.instructor_payments(org_id,center_id,person_id,occurred_at,id);
create index instructor_earning_self_period on core.earnings(org_id,center_id,person_id,created_at,id);
-- Keep the existing writer's lock, allocation, version and receipt behavior.
do $patch$
declare b text:=pg_get_functiondef('private.p03_finance(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=$a$  insert into core.instructor_payments(id,org_id,center_id,person_id,amount_minor,currency,occurred_at,reason,previous_id,direction,operation_id)
   values(pid,org,center,target,amount,coalesce(r->>'currency',p.currency),(coalesce(r->>'occurred_at',r#>>'{correction,occurred_at}'))::timestamptz,reason,root,direction,operation);$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor payment writer anchor drift';end if;
 execute replace(b,a,$a$  if not private.collection_payment_valid(r->'payment') then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.instructor_payments(id,org_id,center_id,person_id,amount_minor,currency,occurred_at,reason,previous_id,direction,operation_id,payment_details)
   values(pid,org,center,target,amount,coalesce(r->>'currency',p.currency),(coalesce(r->>'occurred_at',r#>>'{correction,occurred_at}'))::timestamptz,reason,root,direction,operation,coalesce(r->'payment',p.payment_details));$a$);
 b:=pg_get_functiondef('private.p03_payment_views(uuid,uuid)'::regprocedure);
 a:=$a$'occurred_at',p.occurred_at,$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor payment view anchor drift';end if;
 b:=replace(b,a,a||$a$'method',p.payment_details->>'method',$a$);
 a:=$a$'occurred_at',q.occurred_at,'reason',q.reason$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor correction view anchor drift';end if;
 execute replace(b,a,a||$a$,'method',q.payment_details->>'method'$a$);
end$patch$;
create function private.instructor_self_account(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare view_name text:=r->>'view';lo timestamptz:=(r#>>'{interval,starts_at}')::timestamptz;hi timestamptz:=(r#>>'{interval,ends_at}')::timestamptz;
 lim int:=coalesce((r#>>'{page,limit}')::int,50);stamp timestamptz:=statement_timestamp();h text;cur jsonb;last_at timestamptz;last_id uuid;items jsonb;totals jsonb;token text;members uuid[];
begin
 if center is null or not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 if (r->>'person_id')::uuid is distinct from actor or not private.starter_instructor_active(org,center,actor) then perform private.fail('FORBIDDEN');end if;
 perform private.require_feature(org,'F20');
 members:=private.p07_person_members(org,actor);
 if view_name is null or view_name not in ('agreements','payments') or lim<1 or lim>200 then perform private.fail('VALIDATION_FAILED');end if;
 if r?'interval' and (lo is null or hi is null or not isfinite(lo) or not isfinite(hi) or lo>=hi) then perform private.fail('VALIDATION_FAILED');end if;
 h:=encode(extensions.digest(jsonb_build_object('actor',actor,'account',account,'org',org,'center',center,'request',r-'request_id'-'page')::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;stamp:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(stamp) or stamp>statement_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 if view_name='agreements' then
  select coalesce(jsonb_agg(x.item order by x.at_time,x.id),'[]') into items from (
   select a.id,a.created_at at_time,private.digital_agreement_view(a)||jsonb_build_object('_at',a.created_at) item
   from core.instructor_agreements a where a.org_id=org and a.center_id=center and a.person_id=any(members) and a.created_at<=stamp
    and a.id=private.agreement_at(org,center,actor,a.discipline_id,a.format,stamp,stamp)
    and (last_id is null or (a.created_at,a.id)>(last_at,last_id)) order by a.created_at,a.id limit lim+1
  ) x;
 else
  select coalesce(jsonb_agg(x.item order by x.at_time,x.id),'[]') into items from (
   select p.id,p.occurred_at at_time,jsonb_build_object('id',p.id,'root_payment_id',coalesce(p.previous_id,p.id),
    'version',case when p.previous_id is null then private.p03_payment_version(org,p.id) else p.version end,'previous_id',p.previous_id,
    'direction',p.direction,'amount_minor',p.amount_minor::text,'currency',p.currency,'occurred_at',p.occurred_at,
    'method',p.payment_details->>'method','_at',p.occurred_at) item
   from core.instructor_payments p where p.org_id=org and p.center_id=center and p.person_id=any(members) and p.created_at<=stamp
    and (lo is null or p.occurred_at>=lo) and (hi is null or p.occurred_at<hi)
    and (last_id is null or (p.occurred_at,p.id)>(last_at,last_id)) order by p.occurred_at,p.id limit lim+1
  ) x;
 end if;
 if jsonb_array_length(items)>lim then
  items:=items-lim;
  token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',items->-1->'id','as_of',stamp)::text,'utf8'),'hex');
 end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]') into items from jsonb_array_elements(items) with ordinality t(x,n);
 -- Flow totals use each ledger's own timestamp. Remaining/overpaid are live
 -- balances of roots created in the selected accrual period, not earned-paid.
 with earned as (
  select e.currency,sum(case when e.direction='add' then e.amount_minor else -e.amount_minor end)::numeric amount
   from core.earnings e where e.org_id=org and e.center_id=center and e.person_id=any(members)
    and (lo is null or e.created_at>=lo) and (hi is null or e.created_at<hi) group by e.currency
 ), paid as (
  select p.currency,sum(case when p.direction='increase' then p.amount_minor else -p.amount_minor end)::numeric amount
   from core.instructor_payments p where p.org_id=org and p.center_id=center and p.person_id=any(members)
    and (lo is null or p.occurred_at>=lo) and (hi is null or p.occurred_at<hi) group by p.currency
 ), roots as (
  select e.currency,private.p03_earning_net(org,e.id)::numeric net,
   coalesce((select sum(a.amount_minor)::numeric from core.earning_allocations a where a.org_id=org and a.earning_id=e.id),0) allocated
   from core.earnings e where e.org_id=org and e.center_id=center and e.person_id=any(members) and e.previous_id is null
    and (lo is null or e.created_at>=lo) and (hi is null or e.created_at<hi)
 ), balances as (
  select currency,sum(greatest(0,net-allocated)) remaining,sum(greatest(0,allocated-net)) overpaid from roots group by currency
 ), currencies as (select currency from earned union select currency from paid union select currency from balances)
 select coalesce(jsonb_agg(jsonb_build_object('currency',c.currency,'earned_minor',coalesce(e.amount,0)::text,'paid_minor',coalesce(p.amount,0)::text,
  'remaining_minor',coalesce(b.remaining,0)::text,'overpaid_minor',coalesce(b.overpaid,0)::text) order by c.currency),'[]') into totals
 from currencies c left join earned e using(currency) left join paid p using(currency) left join balances b using(currency);
 return jsonb_build_object('view',view_name,'items',items,'next_cursor',token,'as_of',stamp,'totals',totals);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:=' -- DOMAIN_CASES';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor self account dispatch anchor drift';end if;
 execute replace(b,a,$a$ when 'instructor_account_get_v1' then
  out:=private.instructor_self_account(r,org,center,person,actor.id);
$a$||a);
end$patch$;
-- Historical facts stay immutable; a canonical self consumes preserved aliases.
do $patch$
declare b text; a text;
begin
 b:=pg_get_functiondef('private.digital_agreement_access(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 a:='a.person_id is distinct from person';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement alias accept anchor drift';end if;
 b:=replace(b,a,'not private.p07_same_person(org,a.person_id,person)');
 a:='a.person_id=person';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement alias get anchor drift';end if;
 execute replace(b,a,'private.p07_same_person(org,a.person_id,person)');
 b:=pg_get_functiondef('private.digital_agreement_execute(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],uuid)'::regprocedure);
 a:='and person_id=a.person_id order by accepted_at,id';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement alias acceptance read anchor drift';end if;
 b:=replace(b,a,'and private.p07_same_person(org,person_id,a.person_id) order by accepted_at,id');
 a:=$a$private.content_languages(org,a.person_id,'document')$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement canonical language anchor drift';end if;
 execute replace(b,a,$a$private.content_languages(org,private.p07_person_root(org,a.person_id),'document')$a$);
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('instructor_account_get_v1','earnings.read','read',array['F20']::text[]);
create function api_v1.instructor_account_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('instructor_account_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function private.instructor_self_account(jsonb,uuid,uuid,uuid,uuid),api_v1.instructor_account_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.instructor_self_account(jsonb,uuid,uuid,uuid,uuid),api_v1.instructor_account_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
commit;
