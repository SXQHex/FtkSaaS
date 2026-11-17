-- Native managerial discovery; historical facts do not depend on current duties.
begin;
create function private.earning_view(e core.earnings) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',e.id,'person_id',e.person_id,'subscriber_number',private.subscriber_number(e.org_id,e.person_id),'center_id',e.center_id,'session_id',e.session_id,'event_assignment_id',e.event_assignment_id,
  'amount_minor',e.amount_minor::text,'currency',e.currency,'paid_minor',coalesce(a.paid,0)::text,'remaining_minor',case when e.previous_id is null then greatest(0,private.p03_earning_net(e.org_id,e.id)-coalesce(a.paid,0)) else 0 end::text,
 'overpaid_minor',case when e.previous_id is null then greatest(0,coalesce(a.paid,0)-private.p03_earning_net(e.org_id,e.id)) else 0 end::text,'payments',private.p03_payment_views(e.org_id,e.id),'basis',e.basis,
  'direction',e.direction,'previous_id',e.previous_id,'closure_id',e.closure_id,'created_at',e.created_at,'version',e.version) from lateral(select sum(x.amount_minor) paid from core.earning_allocations x where x.org_id=e.org_id and x.earning_id=e.id) a
$$;
-- Both readers share the exact native row projection, including live chain balances.
do $patch$ declare b text:=pg_get_functiondef('private.earnings_read(uuid,uuid,uuid,jsonb)'::regprocedure);a text:=$a$jsonb_build_object('id',e.id,'person_id',e.person_id,'subscriber_number',private.subscriber_number(org,e.person_id),'center_id',e.center_id,'session_id',e.session_id,'event_assignment_id',e.event_assignment_id,
  'amount_minor',e.amount_minor::text,'currency',e.currency,'paid_minor',coalesce(a.paid,0)::text,'remaining_minor',case when e.previous_id is null then greatest(0,private.p03_earning_net(org,e.id)-coalesce(a.paid,0)) else 0 end::text,
 'overpaid_minor',case when e.previous_id is null then greatest(0,coalesce(a.paid,0)-private.p03_earning_net(org,e.id)) else 0 end::text,'payments',private.p03_payment_views(org,e.id),'basis',e.basis,
  'direction',e.direction,'previous_id',e.previous_id,'closure_id',e.closure_id,'created_at',e.created_at,'version',e.version)$a$;
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Earning projection drift';end if;
 execute replace(b,a,'private.earning_view(e)');
end$patch$;
create function private.instructor_finance_totals(r jsonb,p_org uuid,p_center uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with earned as (
 select e.currency,sum(case when e.direction='add' then e.amount_minor else -e.amount_minor end)::numeric amount
 from core.earnings e where e.org_id=p_org and e.center_id=p_center
 and (r->>'person_id' is null or private.p07_same_person(p_org,e.person_id,(r->>'person_id')::uuid))
 and (not r?'interval' or e.created_at>=(r#>>'{interval,starts_at}')::timestamptz and e.created_at<(r#>>'{interval,ends_at}')::timestamptz) group by e.currency
 ),paid as (
 select p.currency,sum(case when p.direction='increase' then p.amount_minor else -p.amount_minor end)::numeric amount
 from core.instructor_payments p where p.org_id=p_org and p.center_id=p_center
 and (r->>'person_id' is null or private.p07_same_person(p_org,p.person_id,(r->>'person_id')::uuid))
 and (not r?'interval' or p.occurred_at>=(r#>>'{interval,starts_at}')::timestamptz and p.occurred_at<(r#>>'{interval,ends_at}')::timestamptz) group by p.currency
 ),roots as (
 select e.currency,private.p03_earning_net(p_org,e.id)::numeric net,
 coalesce((select sum(a.amount_minor)::numeric from core.earning_allocations a where a.org_id=p_org and a.earning_id=e.id),0) allocated
 from core.earnings e where e.org_id=p_org and e.center_id=p_center and e.previous_id is null
 and (r->>'person_id' is null or private.p07_same_person(p_org,e.person_id,(r->>'person_id')::uuid))
 and (not r?'interval' or e.created_at>=(r#>>'{interval,starts_at}')::timestamptz and e.created_at<(r#>>'{interval,ends_at}')::timestamptz)
 ),balances as(select currency,sum(greatest(0,net-allocated)) remaining,sum(greatest(0,allocated-net)) overpaid from roots group by currency),
 currencies as(select currency from earned union select currency from paid union select currency from balances)
 select coalesce(jsonb_agg(jsonb_build_object('currency',c.currency,'earned_minor',coalesce(e.amount,0)::text,'paid_minor',coalesce(p.amount,0)::text,
 'remaining_minor',coalesce(b.remaining,0)::text,'overpaid_minor',coalesce(b.overpaid,0)::text) order by c.currency),'[]')
 from currencies c left join earned e using(currency) left join paid p using(currency) left join balances b using(currency)
$$;
create function private.instructor_finance_directory(r jsonb,p_org uuid,p_center uuid,p_actor uuid,p_account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare items jsonb;data jsonb;closed_count bigint;stamp timestamptz:=statement_timestamp();
begin
 if p_center is null then perform private.fail('VALIDATION_FAILED');end if;
 perform private.assert_center(p_org,p_center);perform private.require_feature(p_org,'F20');
 if not private.is_org_reader(p_org,p_actor) and not private.is_manager(p_org,p_actor,p_center) then perform private.fail('FORBIDDEN');end if;
 if r?'interval' and ((r#>>'{interval,starts_at}')::timestamptz>=(r#>>'{interval,ends_at}')::timestamptz) then perform private.fail('VALIDATION_FAILED');end if;
 if r->>'view' not in ('instructors','earnings','payments') then perform private.fail('VALIDATION_FAILED');end if;
 if r->>'person_id' is not null and not exists(select 1 from core.people where org_id=p_org and id=(r->>'person_id')::uuid) then perform private.fail('NOT_FOUND');end if;
 if r->>'view'='earnings' then
  select coalesce(jsonb_agg(jsonb_build_object('kind','earning','earning',private.earning_view(e),'display_name',p.display_name,
   'session_name',coalesce(c.name,d.name,ev.name),'agreement_id',e.agreement_id,'agreement_version',ag.version) order by e.created_at,e.id),'[]') into items
  from core.earnings e join core.people p on p.org_id=e.org_id and p.id=private.p07_person_root(p_org,e.person_id)
  left join core.sessions s on s.org_id=e.org_id and s.id=e.session_id left join core.classes c on c.org_id=s.org_id and c.id=s.class_id
  left join core.disciplines d on d.org_id=s.org_id and d.id=s.discipline_id
  left join core.event_assignments ea on ea.org_id=e.org_id and ea.id=e.event_assignment_id left join core.events ev on ev.org_id=ea.org_id and ev.id=ea.event_id
  left join core.instructor_agreements ag on ag.org_id=e.org_id and ag.id=e.agreement_id
  where e.org_id=p_org and e.center_id=p_center and (r->>'person_id' is null or private.p07_same_person(p_org,e.person_id,(r->>'person_id')::uuid))
   and (not r?'interval' or e.created_at>=(r#>>'{interval,starts_at}')::timestamptz and e.created_at<(r#>>'{interval,ends_at}')::timestamptz);
 elsif r->>'view'='payments' then
  select coalesce(jsonb_agg(jsonb_build_object('kind','payment','id',p.id,'person_id',p.person_id,'display_name',n.display_name,
   'root_payment_id',coalesce(p.previous_id,p.id),'version',case when p.previous_id is null then private.p03_payment_version(p_org,p.id) else p.version end,
   'previous_id',p.previous_id,'direction',p.direction,'amount_minor',p.amount_minor::text,'currency',p.currency,'occurred_at',p.occurred_at,
   'payment',p.payment_details,'reason',p.reason) order by p.occurred_at,p.id),'[]') into items
  from core.instructor_payments p join core.people n on n.org_id=p.org_id and n.id=private.p07_person_root(p_org,p.person_id)
  where p.org_id=p_org and p.center_id=p_center and (r->>'person_id' is null or private.p07_same_person(p_org,p.person_id,(r->>'person_id')::uuid))
   and (not r?'interval' or p.occurred_at>=(r#>>'{interval,starts_at}')::timestamptz and p.occurred_at<(r#>>'{interval,ends_at}')::timestamptz);
 else
  with subjects as (
   select person_id from core.instructor_agreements where org_id=p_org and center_id=p_center
   union select person_id from core.earnings where org_id=p_org and center_id=p_center
   union select person_id from core.instructor_payments where org_id=p_org and center_id=p_center
   union select person_id from core.center_relationships where org_id=p_org and center_id=p_center and kind='instructor' and state='active'
  ),people as(select distinct private.p07_person_root(p_org,person_id) id from subjects)
  select coalesce(jsonb_agg(jsonb_build_object('kind','instructor','person_id',p.id,'display_name',p.display_name,
   'totals',private.instructor_finance_totals(r||jsonb_build_object('person_id',p.id),p_org,p_center),
   'agreement_ids',(select coalesce(jsonb_agg(a.id order by a.created_at,a.id),'[]') from core.instructor_agreements a where a.org_id=p_org and a.center_id=p_center and private.p07_same_person(p_org,a.person_id,p.id)),
   'current_agreement_ids',(select coalesce(jsonb_agg(a.id order by a.created_at,a.id),'[]') from core.instructor_agreements a where a.org_id=p_org and a.center_id=p_center and private.p07_same_person(p_org,a.person_id,p.id)
    and a.id=private.agreement_at(p_org,p_center,a.person_id,a.discipline_id,a.format,stamp))) order by p.created_at,p.id),'[]') into items
  from people x join core.people p on p.org_id=p_org and p.id=x.id
  where r->>'person_id' is null or private.p07_same_person(p_org,p.id,(r->>'person_id')::uuid);
 end if;
 select count(distinct e.session_id) into closed_count from core.earnings e join core.sessions s on s.org_id=e.org_id and s.id=e.session_id
 where e.org_id=p_org and e.center_id=p_center and s.attendance_state='closed' and e.previous_id is null
 and (r->>'person_id' is null or private.p07_same_person(p_org,e.person_id,(r->>'person_id')::uuid))
 and (not r?'interval' or e.created_at>=(r#>>'{interval,starts_at}')::timestamptz and e.created_at<(r#>>'{interval,ends_at}')::timestamptz);
 data:=private.p06_page(items,r->'page',encode(extensions.digest(jsonb_build_object('actor',p_actor,'account',p_account,'request',r-'page'-'request_id')::text,'sha256'),'hex'),stamp);
 return jsonb_build_object('data',data||jsonb_build_object('view',r->'view','totals',private.instructor_finance_totals(r,p_org,p_center),'closed_session_count',closed_count),'primary_id',p_center,'subject','centers');
end$$;
do $patch$ declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:=' -- DOMAIN_CASES';begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor directory dispatch drift';end if;
 execute replace(b,a,$a$ when 'instructor_finance_directory_get_v1' then out:=private.instructor_finance_directory(r,org,center,person,actor.id)->'data';
$a$||a);
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('instructor_finance_directory_get_v1','earnings.read','read',array['F20']::text[]);
create function api_v1.instructor_finance_directory_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('instructor_finance_directory_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.instructor_finance_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb),private.earning_view(core.earnings),private.instructor_finance_totals(jsonb,uuid,uuid),private.instructor_finance_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function api_v1.instructor_finance_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb),private.earning_view(core.earnings),private.instructor_finance_totals(jsonb,uuid,uuid),private.instructor_finance_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;
commit;
