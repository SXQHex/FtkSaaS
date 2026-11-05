-- XREQ-020: normal sale projection and dependency-bound approval. No business writes in preview.
begin;
create function private.sale_deficit_plan(org uuid,target uuid,product uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare p core.product_versions;d record;remaining bigint;open_chain boolean:=true;chosen boolean;items jsonb:='[]';
begin
 select * into p from core.product_versions where org_id=org and id=product;remaining:=coalesce(p.credits,0);
 for d in select d.*,s.starts_at,s.version session_version,v.version reservation_version from core.credit_deficits d join core.sessions s on s.org_id=d.org_id and s.id=d.session_id
 left join core.reservations v on v.org_id=d.org_id and v.id=d.reservation_id
 where d.org_id=org and d.person_id=target and d.state in ('consumed','reserved') and private.lesson_scope_matches(org,d.session_id,p.id)
 order by case when d.state='consumed' then 0 else 1 end,s.starts_at,d.id loop
  -- The existing writer stops at the first unaffordable item, rather than skipping it.
  chosen:=open_chain and p.kind='credits' and remaining>=d.quantity;
  if chosen then remaining:=remaining-d.quantity;else open_chain:=false;end if;
  items:=items||jsonb_build_array(jsonb_build_object('deficit_id',d.id,'version',d.version,'reservation_id',d.reservation_id,'reservation_version',d.reservation_version,'session_id',d.session_id,'session_version',d.session_version,'state',d.state,'quantity',d.quantity,'settles',chosen));
 end loop;return items;
end$$;
create function private.sale_impact(r jsonb,org uuid,center uuid,account uuid,actor uuid,trace uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare p core.product_versions;c core.centers;target uuid:=(r->>'person_id')::uuid;items jsonb;docs jsonb;summary jsonb;dep jsonb;blockers jsonb:='[]';effects jsonb;starts timestamptz;ends timestamptz;
begin
 select * into p from core.product_versions where org_id=org and center_id=center and id=(r->>'product_version_id')::uuid;
 select * into c from core.centers where org_id=org and id=center;
 if p.id is null or c.id is null then perform private.fail('NOT_FOUND');end if;
 starts:=(r->>'start_date')::date::timestamp at time zone c.timezone;ends:=(r->>'end_date')::date::timestamp at time zone c.timezone;
 if to_char(starts at time zone c.timezone,'YYYY-MM-DD HH24:MI')<>r->>'start_date'||' 00:00' or to_char(ends at time zone c.timezone,'YYYY-MM-DD HH24:MI')<>r->>'end_date'||' 00:00'
 or (starts-interval '1 hour') at time zone c.timezone=starts at time zone c.timezone or (starts+interval '1 hour') at time zone c.timezone=starts at time zone c.timezone then perform private.fail('VALIDATION_FAILED');end if;
 items:=private.sale_deficit_plan(org,target,p.id);
 docs:=private.p05_requirements(org,target,jsonb_build_object('gate','sale'),jsonb_build_object('center_id',center,'product_version_id',p.id));
 if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind='student' and state='active') then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','OPEN_OPERATIONS_EXIST','retryable',false,'trace_id',trace));end if;
 if exists(select 1 from jsonb_array_elements(docs) x where not (x->>'accepted')::bool) then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','DOCUMENT_REQUIRED','retryable',false,'trace_id',trace));end if;
 summary:=jsonb_build_object('person_id',target,'product_version_id',p.id,'kind',p.kind,'booking_mode',p.booking_mode,'start_date',r->>'start_date','end_date',r->>'end_date','timezone',c.timezone,'valid_from',starts,'valid_until',ends,
 'quota',p.quota,'debt_minor',p.price_minor::text,'currency',p.currency,'granted',case when p.kind='credits' then p.credits else 0 end,
 'reserved',coalesce((select sum((x->>'quantity')::bigint) from jsonb_array_elements(items) x where (x->>'settles')::bool and x->>'state'='reserved'),0),
 'consumed',coalesce((select sum((x->>'quantity')::bigint) from jsonb_array_elements(items) x where (x->>'settles')::bool and x->>'state'='consumed'),0),
 'available',case when p.kind='credits' then p.credits-coalesce((select sum((x->>'quantity')::bigint) from jsonb_array_elements(items) x where (x->>'settles')::bool),0) else 0 end,'deficits',items);
 -- Hash current authoritative rows, including removals and newly eligible deficits.
 -- First dependency remains product version for compatibility with the frozen writer.
 dep:=jsonb_build_object('versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','product_versions','id',p.id),'version',coalesce(p.version,1))),
 'policy_hashes',jsonb_build_array(encode(extensions.digest(jsonb_build_object('request',r-'request_id','product',to_jsonb(p),'center',to_jsonb(c),'summary',summary,'documents',docs,
 'person',(select to_jsonb(x) from core.people x where org_id=org and id=target),
 'relationships',(select jsonb_agg(to_jsonb(x) order by x.id) from core.center_relationships x where org_id=org and person_id=target),
 'deficit_sources',(select jsonb_agg(to_jsonb(d)||jsonb_build_object('session',to_jsonb(ss),'reservation',to_jsonb(v)) order by d.id) from core.credit_deficits d join core.sessions ss on ss.org_id=d.org_id and ss.id=d.session_id left join core.reservations v on v.org_id=d.org_id and v.id=d.reservation_id where d.org_id=org and d.person_id=target and d.state in ('consumed','reserved')),
 'scopes',(select jsonb_agg(to_jsonb(x) order by x.id) from core.product_scopes x where org_id=org and product_version_id=p.id),
 'policies',(select jsonb_agg(to_jsonb(x) order by x.id) from core.policy_versions x where org_id=org),
 'subscriptions',(select jsonb_agg(to_jsonb(x)||jsonb_build_object('plan',(select to_jsonb(v) from core.saas_plan_versions v where v.id=x.plan_version_id)) order by x.id) from core.saas_subscriptions x where org_id=org))::text,'sha256'),'hex')),
 'permission_hash',encode(extensions.digest(jsonb_build_object('account',account,'actor',actor,'organization',(select to_jsonb(x) from core.organizations x where id=org),
 'roles',(select jsonb_agg(to_jsonb(x) order by x.id) from core.role_assignments x where org_id=org and person_id=actor),
 'links',(select jsonb_agg(to_jsonb(x) order by x.id) from core.account_links x where org_id=org and person_id=actor),
 'overrides',(select jsonb_agg(to_jsonb(x) order by x.id) from core.permission_overrides x where org_id=org and person_id=actor))::text,'sha256'),'hex'));
 select coalesce(jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','credit_deficits','id',x->>'deficit_id'),'action','adjust','quantity',(x->>'quantity')::int,'reason','Settle existing '||(x->>'state')||' deficit; original reservation and earnings preserved')),'[]') into effects from jsonb_array_elements(items) x where (x->>'settles')::bool;
 return jsonb_build_object('sale',summary,'dependencies',dep,'effects',effects,'blockers',blockers);
end$$;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:=$a$  insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(record_id,r,now()+interval '15 minutes',encode(extensions.digest(token,'sha256'),'hex'));
 when 'sale_apply_v1' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Sale preview projection anchor missing or repeated';end if;
 b:=replace(b,old,replace(old,$a$
 when 'sale_apply_v1' then$a$,'')||$a$
  terms:=private.sale_impact(r,org,center,actor.id,person,trace);dependencies:=terms->'dependencies';
  out:=out||terms;
  update core.previews set dependencies=terms->'dependencies',result=out-'token' where id=record_id;
 when 'sale_apply_v1' then
$a$);
 old:=$a$  insert into core.sales(id,org_id,center_id,person_id,product_version_id,net_minor,currency,valid_from,valid_until,state,terms_hash,start_date,end_date,timezone,paid_days)$a$;
 if strpos(b,old)=0 then raise exception 'Sale apply snapshot anchor missing';end if;
 b:=replace(b,old,$a$  terms:=private.sale_impact(entry,org,center,actor.id,person,trace);
  if terms->'dependencies' is distinct from preview.dependencies or terms->'sale' is distinct from preview.result->'sale' then perform private.fail('PREVIEW_STALE');end if;
  if jsonb_array_length(terms->'blockers')>0 then perform private.fail(terms#>>'{blockers,0,code}');end if;
$a$||old);
 old:=$a$where d.org_id=org and d.person_id=target and d.state in ('consumed','reserved') and private.lesson_scope_matches(org,d.session_id,pv.id)$a$;
 if strpos(b,old)=0 then raise exception 'Sale deficit selection anchor missing';end if;
 b:=replace(b,old,$a$where d.org_id=org and d.person_id=target and d.id in (select (x->>'deficit_id')::uuid from jsonb_array_elements(terms#>'{sale,deficits}') x where (x->>'settles')::bool)$a$);
 execute b;
end$patch$;
revoke all on function private.sale_deficit_plan(uuid,uuid,uuid),private.sale_impact(jsonb,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.sale_deficit_plan(uuid,uuid,uuid),private.sale_impact(jsonb,uuid,uuid,uuid,uuid,uuid) to service_role;
commit;
