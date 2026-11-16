-- W1-BE-21/22/23: discover only the live native student's own resources.
begin;
create index member_waitlist_history on core.waitlist_entries(org_id,center_id,person_id,joined_at,id);
create index member_offer_history on core.seat_offers(org_id,center_id,person_id,created_at,id);
create function private.member_self_access(org uuid,center uuid,actor uuid,operations text[]) returns void
language plpgsql stable security invoker set search_path='' as $$
begin
 if actor is null or center is null or not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 if not exists(select 1 from core.people where org_id=org and id=actor and state='active')
  or not exists(select 1 from core.center_relationships where org_id=org and center_id=center and private.p07_same_person(org,person_id,actor) and kind='student' and state='active') then perform private.fail('FORBIDDEN');end if;
 if not private.member_summary_enabled(org,operations,jsonb_build_object('org_id',org,'center_id',center,'person_id',actor)) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
end$$;
create function private.member_waitlist_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';view_name text:=k->>'view';lim int:=coalesce((r#>>'{page,limit}')::int,50);
 h text;cur jsonb;last_at timestamptz;last_id uuid;items jsonb;token text;v jsonb;stamp timestamptz:=statement_timestamp();members uuid[]:=private.p07_person_members(org,actor);
begin
 perform private.member_self_access(org,center,actor,array['waitlist_join_v1']);
 if r#>>'{selector,operation}' is distinct from 'waitlist_join_v1' or view_name is null or view_name not in ('entries','offers')
  or lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 if k->>'status' is not null and not (k->>'status'=any(case when view_name='entries' then array['all','waiting','offered','converted','left','closed'] else array['all','active','accepted','rejected','expired','withdrawn'] end)) then perform private.fail('VALIDATION_FAILED');end if;
 h:=encode(extensions.digest(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page','sort','created_at_asc')::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;
   if not isfinite(last_at) then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with candidates as (
  select w.id,w.joined_at at_time,w.state,w.id entry_id,null::uuid offer_id from core.waitlist_entries w
   where view_name='entries' and w.org_id=org and w.center_id=center and w.person_id=any(members)
  union all
  select o.id,o.created_at,o.state,o.entry_id,o.id from core.seat_offers o
   where view_name='offers' and o.org_id=org and o.center_id=center and o.person_id=any(members)
 ), visible as (
  select q.*,w,s from candidates q join core.waitlist_entries w on w.org_id=org and w.center_id=center and w.id=q.entry_id and w.person_id=any(members)
   join core.sessions s on s.org_id=org and s.center_id=center and s.id=w.session_id
  where (coalesce(k->>'status','all')='all' or q.state=k->>'status') and (last_id is null or (q.at_time,q.id)>(last_at,last_id))
   and (r->'entity' is null or r->'entity'='null'::jsonb or r->'entity'=jsonb_build_object('type',case when view_name='entries' then 'waitlist_entries' else 'seat_offers' end,'id',q.id))
 ) select coalesce(jsonb_agg(q.item order by q.at_time,q.id),'[]') into items from (
  select z.at_time,z.id,jsonb_build_object('operation','waitlist_join_v1','entity',jsonb_build_object('type',case when view_name='entries' then 'waitlist_entries' else 'seat_offers' end,'id',z.id),
   'exists',true,'state',z.state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','waitlist_entries','id',(z.w).id),'version',(z.w).version))
    ||coalesce((select jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','seat_offers','id',o.id),'version',o.version)) from core.seat_offers o where o.org_id=org and o.id=z.offer_id),'[]'),
   'as_of',stamp,'current',null,'waitlist_detail',(to_jsonb(z.w)-'org_id')||jsonb_build_object('offers',
    coalesce((select jsonb_build_array(to_jsonb(o)-'org_id'-'center_id') from core.seat_offers o where o.org_id=org and o.center_id=center and o.id=z.offer_id and o.person_id=any(members)),'[]')),
   'waitlist_session',jsonb_build_object('id',(z.s).id,'title',coalesce((select name from core.classes where org_id=org and id=(z.s).class_id),(select name from core.disciplines where org_id=org and id=(z.s).discipline_id)),
    'interval',jsonb_build_object('starts_at',(z.s).starts_at,'ends_at',(z.s).ends_at),'timezone',(select timezone from core.centers where org_id=org and id=center),'state',(z.s).state,'version',(z.s).version),'_at',z.at_time) item
  from visible z order by z.at_time,z.id limit lim+1
 ) q;
 if jsonb_array_length(items)>lim then items:=items-lim;v:=items->(lim-1);token:=encode(convert_to(jsonb_build_object('scope',h,'at',v->>'_at','id',v#>>'{entity,id}')::text,'utf8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]') into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',stamp);
end$$;
alter function private.purchased_rights(jsonb,uuid,uuid,uuid) rename to purchased_rights_before_purchase_summary;
create function private.purchased_rights(r jsonb,org uuid,actor uuid,center uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 result:=private.purchased_rights_before_purchase_summary(r,org,actor,center);
 if not coalesce((r->>'include_purchase_summary')::bool,false) then return result;end if;
 perform private.member_self_access(org,center,actor,array['entitlements_get_v1']);
 if not private.p07_same_person(org,actor,(r->>'person_id')::uuid) then perform private.fail('FORBIDDEN');end if;
 return coalesce((select jsonb_agg(x||jsonb_build_object('purchase_summary',jsonb_build_object('product_name',v.published_name,'initial_credits',case when v.kind='credits' then v.credits else null end)) order by n)
  from jsonb_array_elements(result) with ordinality a(x,n) join core.product_versions v on v.org_id=org and v.id=(x->>'product_version_id')::uuid),'[]'::jsonb);
end$$;
create function private.member_finance_currencies(r jsonb,org uuid,center uuid,actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare currencies jsonb;members uuid[]:=private.p07_person_members(org,actor);
begin
 perform private.member_self_access(org,center,actor,array['finance_get_v1']);
 if r?'person_id' or r?'currency' or r?'page' then perform private.fail('VALIDATION_FAILED');end if;
 select coalesce(jsonb_agg(currency order by currency),'[]') into currencies from (
  select currency from core.debts where org_id=org and center_id=center and person_id=any(members)
  union select currency from core.cash_movements where org_id=org and center_id=center and person_id=any(members)
  union select currency from core.student_credit_movements where org_id=org and center_id=center and person_id=any(members)
 ) q;
 return jsonb_build_object('person_id',actor,'currencies',currencies,'as_of',statement_timestamp());
end$$;
create function private.member_document_requirements(org uuid,center uuid,actor uuid,account uuid,ctx jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare request jsonb:=jsonb_build_object('context',ctx);facts jsonb;
begin
 -- Reuse the exact native requirements access/context/acceptance rules. Only
 -- an explicit Starter resource restriction filters a context; read errors fail.
 perform private.p05_access('document_requirements_get_v1',request,org,center,actor,account);
 facts:=private.p05_context(org,center,actor,ctx);
 return private.digital_document_projection_v2(private.p05_requirements(org,actor,ctx,facts),request,org,actor);
exception when sqlstate 'P0001' then
 if private.current_plan_name(org)='starter' and sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','PLAN_LIMIT_REACHED') then return null;end if;raise;
end$$;
create function private.member_document_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);h text;cur jsonb;last_at timestamptz;last_key text;items jsonb:='[]';token text;v record;requirements jsonb;stamp timestamptz:=statement_timestamp();members uuid[]:=private.p07_person_members(org,actor);
begin
 perform private.member_self_access(org,center,actor,array['document_requirements_get_v1']);
 if r?'context' or r?'person_id' or r?'content_file_id' or lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 h:=encode(extensions.digest(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page','sort','created_at_asc')::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'key' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_key:=cur->>'key';
   if not isfinite(last_at) then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 for v in
  with contexts as (
   select s.created_at at_time,'sales' typ,s.id,'sale' gate,null::uuid purchase from core.sales s
    where s.org_id=org and s.center_id=center and s.person_id=any(members) and s.state='active'
   union all
   select v.created_at,'reservations',v.id,g.gate,null::uuid from core.reservations v join core.sessions s on s.org_id=org and s.center_id=center and s.id=v.session_id
    cross join (values('reservation'),('attendance')) g(gate)
    where v.org_id=org and v.center_id=center and v.person_id=any(members) and v.state='active' and s.state in ('planned','occurred')
     and (g.gate='reservation' and s.state='planned' or g.gate='attendance' and s.attendance_state='open')
   union all
   select v.created_at,'lesson_requests',v.id,'reservation',null::uuid from core.lesson_requests v
    where v.org_id=org and v.center_id=center and v.person_id=any(members) and v.state in ('pending','alternative_offered')
   union all
   select v.created_at,'event_registrations',v.id,g.gate,null::uuid from core.event_registrations v join core.events e on e.org_id=org and e.center_id=center and e.id=v.event_id
    cross join (values('event_registration'),('attendance')) g(gate)
    where v.org_id=org and v.center_id=center and v.person_id=any(members) and v.state='active' and e.state in ('published','occurred')
     and (g.gate='event_registration' and e.state='published' or g.gate='attendance' and e.attendance_state='open')
   union all
   select min(w.created_at),'sessions',s.id,'reservation',null::uuid from core.waitlist_entries w join core.sessions s on s.org_id=org and s.center_id=center and s.id=w.session_id
    where w.org_id=org and w.center_id=center and w.person_id=any(members) and w.state in ('waiting','offered') and s.state='planned' group by s.id
   union all
   select v.created_at,'product_versions',p.product_version_id,'sale',p.preview_id from private.purchase_documents p
    join core.previews v on v.org_id=org and v.id=p.preview_id and v.operation='sale_apply_v1' and v.state='current'
    join private.preview_payloads x on x.preview_id=v.id and x.expires_at>stamp
    where p.org_id=org and p.center_id=center and p.person_id=any(members) and not exists(select 1 from private.purchase_document_uses u where u.purchase_preview_id=p.preview_id)
  ), keyed as (
   select c.*,typ||'/'||id::text||'/'||gate||'/'||coalesce(purchase::text,'') row_key,
    jsonb_build_object('gate',gate,'subject',jsonb_build_object('type',typ,'id',id))||case when purchase is null then '{}'::jsonb else jsonb_build_object('purchase_preview_id',purchase) end ctx from contexts c
  ) select * from keyed where last_key is null or (at_time,row_key)>(last_at,last_key) order by at_time,row_key
 loop
  requirements:=private.member_document_requirements(org,center,actor,account,v.ctx);
  if requirements is null or jsonb_array_length(requirements)=0 then continue;end if;
  if jsonb_array_length(items)=lim then
   token:=encode(convert_to(jsonb_build_object('scope',h,'at',last_at,'key',last_key)::text,'utf8'),'hex');exit;
  end if;
  items:=items||jsonb_build_array(jsonb_build_object('context',v.ctx,'requirements',requirements));last_at:=v.at_time;last_key:=v.row_key;
 end loop;
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',stamp);
end$$;
do $alias$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p05_context(uuid,uuid,uuid,jsonb)'::regprocedure);a:='(p is not null and p<>target)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Document context ownership anchor drift';end if;
 execute replace(b,a,'(p is not null and not private.p07_same_person(org,p,target))');
 b:=pg_get_functiondef('private.purchase_document_context(uuid,uuid,uuid,jsonb)'::regprocedure);a:='and person_id=target';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Purchase document ownership anchor drift';end if;
 execute replace(b,a,'and private.p07_same_person(org,person_id,target)');
 b:=pg_get_functiondef('private.p05_requirements(uuid,uuid,jsonb,jsonb)'::regprocedure);a:='a.person_id=target';
 if array_length(string_to_array(b,a),1)<>3 then raise exception 'Document acceptance alias anchors drift';end if;
 execute replace(b,a,'private.p07_same_person(org,a.person_id,target)');
 b:=pg_get_functiondef('private.digital_document_projection_v2(jsonb,jsonb,uuid,uuid)'::regprocedure);a:='a.person_id=target and a.context=r->''context'';';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Document acceptance projection anchor drift';end if;
 execute replace(b,a,'private.p07_same_person(org,a.person_id,target) and a.context=r->''context'' order by a.accepted_at desc,a.id desc limit 1;');
end$alias$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=$a$and r#>>'{selector,key,directory}' is distinct from 'session' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Member waitlist context anchor drift';end if;
 b:=replace(b,a,$a$and coalesce(r#>>'{selector,key,directory}','') not in ('session','self') then$a$);
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Member self discovery dispatch anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation'='waitlist_join_v1' and r#>>'{selector,key,directory}'='self' then
  out:=private.member_waitlist_directory(r,org,center,person,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
 if p_operation='member_document_contexts_get_v1' then
  out:=private.member_document_directory(r,org,center,person,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
 if p_operation='member_finance_currencies_get_v1' then
  out:=private.member_finance_currencies(r,org,center,person);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
end$patch$;
revoke all on function private.member_document_requirements(uuid,uuid,uuid,uuid,jsonb),private.member_document_directory(jsonb,uuid,uuid,uuid,uuid),private.member_self_access(uuid,uuid,uuid,text[]),private.member_waitlist_directory(jsonb,uuid,uuid,uuid,uuid),private.purchased_rights(jsonb,uuid,uuid,uuid),private.member_finance_currencies(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.member_document_requirements(uuid,uuid,uuid,uuid,jsonb),private.member_document_directory(jsonb,uuid,uuid,uuid,uuid),private.member_self_access(uuid,uuid,uuid,text[]),private.member_waitlist_directory(jsonb,uuid,uuid,uuid,uuid),private.purchased_rights(jsonb,uuid,uuid,uuid),private.member_finance_currencies(jsonb,uuid,uuid,uuid) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('member_finance_currencies_get_v1','finance.read','read',array['F06','F19']::text[]);
create function api_v1.member_finance_currencies_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('member_finance_currencies_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.member_finance_currencies_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.member_finance_currencies_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('member_document_contexts_get_v1','person.read','read',array['F30']::text[]);
create function api_v1.member_document_contexts_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('member_document_contexts_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.member_document_contexts_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.member_document_contexts_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
commit;
