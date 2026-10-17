-- Immutable instructor agreements, frozen lesson earning basis and linked corrections.
begin;
alter table core.sessions add column if not exists actual_started_at timestamptz;
alter table core.sessions add column if not exists started_agreements jsonb;
alter table core.instructor_agreements add column if not exists supersedes_id uuid;
alter table core.instructor_agreements add column if not exists published_at timestamptz;
alter table core.instructor_agreements add constraint instructor_agreement_predecessor foreign key(org_id,center_id,supersedes_id) references core.instructor_agreements(org_id,center_id,id);
create unique index instructor_agreement_one_successor on core.instructor_agreements(org_id,supersedes_id) where supersedes_id is not null;
create trigger instructor_agreement_immutable before update or delete on core.instructor_agreements for each row execute function private.lesson_immutable();
alter table core.attendance_closures add column if not exists earnings_snapshot jsonb;
alter table core.earnings add column if not exists closure_id uuid;
alter table core.earnings add constraint lesson_earning_closure foreign key(org_id,closure_id) references core.attendance_closures(org_id,id);

create or replace function private.agreement_at(org uuid,center uuid,person uuid,discipline uuid,format_name text,at_time timestamptz,known_at timestamptz default 'infinity')
returns uuid language sql stable security invoker set search_path='' as $$
 select a.id from core.instructor_agreements a
 where a.org_id=org and a.center_id=center and a.person_id=person and a.discipline_id=discipline and a.format=format_name
 and a.state='active' and a.valid_from<=at_time and (a.valid_until is null or at_time<a.valid_until) and coalesce(a.published_at,a.created_at)<=known_at
 and not exists(select 1 from core.instructor_agreements n where n.org_id=org and n.supersedes_id=a.id and n.valid_from<=at_time and coalesce(n.published_at,n.created_at)<=known_at)
 order by a.valid_from desc,a.version desc,a.id limit 1
$$;
create or replace function private.pay_components_validate(parts jsonb,package boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare component jsonb;
begin
 if parts is null or jsonb_array_length(parts)=0 then perform private.fail('VALIDATION_FAILED');end if;
 for component in select e from jsonb_array_elements(parts) e loop
  if component->>'amount_minor' is not null and (component->>'amount_minor')::numeric>9223372036854775807 then perform private.fail('VALIDATION_FAILED');end if;
  if component#>>'{basis,unit_minor}' is not null and (component#>>'{basis,unit_minor}')::numeric>9223372036854775807 then perform private.fail('VALIDATION_FAILED');end if;
  if component#>>'{basis,mode}'='sale_unit' and component#>>'{basis,unit_minor}' is not null then perform private.fail('VALIDATION_FAILED');end if;
  if component->>'kind'='percentage' then
   if component->>'amount_minor' is not null then perform private.fail('VALIDATION_FAILED');end if;
   if component->>'rate_bps' is null or component->'basis' is null or component->'basis'='null'::jsonb
    or (component#>>'{basis,mode}'='fixed_unit' and component#>>'{basis,unit_minor}' is null) then perform private.fail('VALIDATION_FAILED');end if;
   if component->>'entitlement_kind'='timed' and component#>>'{basis,mode}'<>'fixed_unit' then perform private.fail('VALIDATION_FAILED');end if;
  else
   if component->>'amount_minor' is null or component->>'rate_bps' is not null or (component->'basis' is not null and component->'basis'<>'null'::jsonb) then perform private.fail('VALIDATION_FAILED');end if;
   if component->>'kind'='session_fixed' and component->>'entitlement_kind' is not null then perform private.fail('VALIDATION_FAILED');end if;
  end if;
  if package and component->>'kind'='session_fixed' then perform private.fail('VALIDATION_FAILED');end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(parts) with ordinality a(x,i),jsonb_array_elements(parts) with ordinality b(y,j)
  where a.i<b.j and x->>'kind'=y->>'kind' and
  (x->>'kind'='session_fixed' or x->>'entitlement_kind' is null or y->>'entitlement_kind' is null or x->>'entitlement_kind'=y->>'entitlement_kind')) then perform private.fail('VALIDATION_FAILED');end if;
end$$;
create or replace function private.pay_terms_validate(org uuid,terms jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare x jsonb;kinds text[];model text:=terms->>'model';
begin
 perform private.pay_components_validate(terms->'components');
 if terms#>>'{room_fee,amount_minor}' is not null and (terms#>>'{room_fee,amount_minor}')::numeric>9223372036854775807 then perform private.fail('VALIDATION_FAILED');end if;
 if terms#>>'{room_fee,basis,unit_minor}' is not null and (terms#>>'{room_fee,basis,unit_minor}')::numeric>9223372036854775807 then perform private.fail('VALIDATION_FAILED');end if;
 if terms#>>'{room_fee,kind}'='free' and (terms#>>'{room_fee,amount_minor}' is not null or terms#>>'{room_fee,rate_bps}' is not null or terms#>>'{room_fee,basis,mode}' is not null) then perform private.fail('VALIDATION_FAILED');end if;
 if terms#>>'{room_fee,kind}'='fixed' and (terms#>>'{room_fee,rate_bps}' is not null or terms#>>'{room_fee,basis,mode}' is not null) then perform private.fail('VALIDATION_FAILED');end if;
 if terms#>>'{room_fee,kind}'='percentage' and terms#>>'{room_fee,amount_minor}' is not null then perform private.fail('VALIDATION_FAILED');end if;
 select array_agg(distinct e->>'kind' order by e->>'kind') into kinds from jsonb_array_elements(terms->'components') e;
 if (model='session_fixed' and kinds<>array['session_fixed']) or (model='per_person' and kinds<>array['per_person'])
 or (model='percentage' and kinds<>array['percentage']) or (model='fixed_plus_person' and kinds<>array['per_person','session_fixed']) then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from jsonb_array_elements(coalesce(terms->'package_overrides','[]')) e group by e->>'product_id' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
 for x in select e from jsonb_array_elements(coalesce(terms->'package_overrides','[]')) e loop
  if not exists(select 1 from core.products p where p.org_id=org and p.id=(x->>'product_id')::uuid) then perform private.fail('NOT_FOUND');end if;
  perform private.pay_components_validate(x->'components',true);
 end loop;
 if terms#>>'{room_fee,kind}'='fixed' and terms#>>'{room_fee,amount_minor}' is null then perform private.fail('VALIDATION_FAILED');end if;
 if terms#>>'{room_fee,kind}'='percentage' and (terms#>>'{room_fee,rate_bps}' is null or terms#>>'{room_fee,basis,mode}' is null
 or (terms#>>'{room_fee,basis,mode}'='fixed_unit' and terms#>>'{room_fee,basis,unit_minor}' is null)) then perform private.fail('VALIDATION_FAILED');end if;
end$$;


create or replace function private.valuation_at(org uuid,center uuid,discipline uuid,format_name text,at_time timestamptz)
returns core.policy_versions language sql stable security invoker set search_path='' as $$
 with candidates as (
 select distinct on(p.scope_center_id) p.* from core.policy_versions p where p.org_id=org and p.key='negative_valuation'
 and p.value->>'discipline_id'=discipline::text and p.value->>'format'=format_name and p.effective_at<=at_time
 and(p.scope_center_id is null or p.scope_center_id=center) order by p.scope_center_id,p.effective_at desc,p.version desc,p.id desc
 ) select c.* from candidates c order by (c.scope_center_id is null and c.mandatory) desc,(c.scope_center_id is not null) desc limit 1
$$;
create or replace function private.earnings_management(op text,r jsonb,org uuid,center uuid,account uuid,person uuid,operation uuid,ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare a core.instructor_agreements;prior core.instructor_agreements;primary_id uuid:=private.new_id(ids,2);ver bigint:=1;data jsonb;terms jsonb:=r->'terms';c core.centers;v core.policy_versions;effective timestamptz;scope_hash text;cur jsonb;items jsonb;lim int:=coalesce((r#>>'{page,limit}')::int,50);last_time timestamptz;last_id uuid;token text;
begin
 if op='instructor_agreement_publish_v1' then
  if length(btrim(r->>'reason'))=0 or (r#>>'{valid,starts_at}')::timestamptz>=(r#>>'{valid,ends_at}')::timestamptz then perform private.fail('VALIDATION_FAILED');end if;
  perform private.assert_resource(org,center,'person',(r->>'person_id')::uuid);
  if not exists(select 1 from core.center_disciplines x where x.org_id=org and x.center_id=center and x.discipline_id=(r->>'discipline_id')::uuid and x.state='active') then perform private.fail('NOT_FOUND');end if;
  perform private.pay_terms_validate(org,terms);
  if r->>'supersedes_id' is not null then
   select * into prior from core.instructor_agreements x where x.org_id=org and x.center_id=center and x.id=(r->>'supersedes_id')::uuid;
   if prior.id is null or prior.person_id<>(r->>'person_id')::uuid or prior.discipline_id<>(r->>'discipline_id')::uuid or prior.format<>r->>'format' then perform private.fail('NOT_FOUND');end if;
   if prior.version<>(r->>'expected_version')::bigint or exists(select 1 from core.instructor_agreements x where x.org_id=org and x.supersedes_id=prior.id) then perform private.fail('VERSION_CONFLICT');end if;
   if (r#>>'{valid,starts_at}')::timestamptz<=prior.valid_from then perform private.fail('VALIDATION_FAILED');end if;
   ver:=prior.version+1;
  end if;
  -- A replacement may only overlap its own predecessor lineage. Other chains
  -- occupy their effective interval, clipped at the next immutable successor.
  if exists(
   with recursive lineage as (
    select q.id,q.supersedes_id from core.instructor_agreements q where q.org_id=org and q.id=prior.id
    union all
    select q.id,q.supersedes_id from core.instructor_agreements q join lineage l on l.supersedes_id=q.id where q.org_id=org
   )
   select 1 from core.instructor_agreements x where x.org_id=org and x.center_id=center and x.person_id=(r->>'person_id')::uuid
    and x.discipline_id=(r->>'discipline_id')::uuid and x.format=r->>'format' and x.state='active'
    and not exists(select 1 from lineage l where l.id=x.id)
    and x.valid_from<(r#>>'{valid,ends_at}')::timestamptz
    and least(coalesce(x.valid_until,'infinity'),coalesce((select n.valid_from from core.instructor_agreements n where n.org_id=org and n.supersedes_id=x.id),'infinity'))>(r#>>'{valid,starts_at}')::timestamptz
  ) then perform private.fail('VERSION_CONFLICT');end if;
  insert into core.instructor_agreements(id,org_id,center_id,person_id,discipline_id,format,valid_from,valid_until,model,terms,state,supersedes_id,version,published_at)
   values(primary_id,org,center,(r->>'person_id')::uuid,(r->>'discipline_id')::uuid,r->>'format',(r#>>'{valid,starts_at}')::timestamptz,(r#>>'{valid,ends_at}')::timestamptz,terms->>'model',terms,'active',prior.id,ver,clock_timestamp());
  update core.session_assignments x set agreement_id=primary_id,version=x.version+1 from core.sessions ss
   where x.org_id=org and ss.org_id=x.org_id and ss.id=x.session_id and ss.center_id=center and ss.discipline_id=(r->>'discipline_id')::uuid and ss.format=r->>'format'
   and ss.state='planned' and ss.attendance_state='open' and ss.actual_started_at is null and ss.starts_at>clock_timestamp()
   and ss.starts_at>=(r#>>'{valid,starts_at}')::timestamptz and ss.starts_at<(r#>>'{valid,ends_at}')::timestamptz
   and x.person_id=(r->>'person_id')::uuid and x.state='active' and (x.agreement_id=prior.id or x.agreement_id is null);
  update core.sessions ss set version=version+1 where ss.org_id=org and ss.center_id=center and ss.state='planned' and ss.actual_started_at is null and ss.starts_at>clock_timestamp()
   and exists(select 1 from core.session_assignments x where x.org_id=org and x.session_id=ss.id and x.agreement_id=primary_id);
 elsif op='negcredit_valuation_set_v1' then
  select * into c from core.centers x where x.org_id=org and x.id=center for update;
  if exists(select 1 from private.valuation_at(org,null,(r->>'discipline_id')::uuid,r->>'format',(r->>'effective_at')::timestamptz) x where x.mandatory)
  or exists(select 1 from private.valuation_at(org,null,(r->>'discipline_id')::uuid,r->>'format',clock_timestamp()) x where x.mandatory) then perform private.fail('FORBIDDEN');end if;
  if c.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if not exists(select 1 from core.center_disciplines x where x.org_id=org and x.center_id=center and x.discipline_id=(r->>'discipline_id')::uuid and x.state='active') then perform private.fail('NOT_FOUND');end if;
  select * into v from core.policy_versions x where x.org_id=org and x.scope_center_id=center and x.key='negative_valuation'
   and x.value->>'discipline_id'=r->>'discipline_id' and x.value->>'format'=r->>'format' order by x.version desc,x.id desc limit 1;
  insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value,previous_id,version)
   values(primary_id,org,center,'negative_valuation',(r->>'effective_at')::timestamptz,false,jsonb_build_object('kind','valuation','discipline_id',r->'discipline_id','format',r->'format','amount_minor',r->'amount_minor','currency',r->'currency'),v.id,coalesce(v.version,0)+1);
  update core.centers set version=version+1 where org_id=org and id=center returning version into ver;
 elsif op='management_state_get_v1' then
  if r->>'operation'<>'negcredit_valuation_set_v1' or r#>>'{selector,operation}'<>r->>'operation' then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  select * into c from core.centers x where x.org_id=org and x.id=center;
  select * into v from core.policy_versions x where x.org_id=org and x.scope_center_id=center and x.key='negative_valuation'
   and x.value->>'discipline_id'=r#>>'{selector,key,discipline_id}' and x.value->>'format'=r#>>'{selector,key,format}' order by x.version desc,x.id desc limit 1;
  data:=jsonb_build_object('operation',r->'operation','entity',jsonb_build_object('type','centers','id',center),'exists',v.id is not null,'state',case when v.id is null then null else 'active' end,
   'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','centers','id',center),'version',c.version)),'as_of',clock_timestamp(),
   'current',jsonb_build_object('operation',r->'operation','values',case when v.id is null then '{}'::jsonb else v.value-'kind'||jsonb_build_object('effective_at',v.effective_at) end));
  return jsonb_build_object('data',jsonb_build_object('items',jsonb_build_array(data),'next_cursor',null,'as_of',clock_timestamp()),'primary_id',center,'subject','centers');
 elsif op='instructor_agreements_list_v1' then
  if coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
  scope_hash:=md5(jsonb_build_object('actor',account,'request',r-'request_id'-'page','operation',op)::text);
  if r#>>'{page,cursor}' is not null then
   begin
    cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
    if cur->>'scope' is distinct from scope_hash then perform private.fail('VALIDATION_FAILED');end if;
    last_time:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;
   exception when others then perform private.fail('VALIDATION_FAILED');end;
  end if;
  select coalesce(jsonb_agg(x.data order by x.created_at,x.id),'[]'::jsonb) into items from (
   select a.created_at,a.id,jsonb_build_object('id',a.id,'version',a.version,'person_id',a.person_id,'center_id',a.center_id,'discipline_id',a.discipline_id,'format',a.format,
    'valid',jsonb_build_object('starts_at',a.valid_from,'ends_at',a.valid_until),'supersedes_id',a.supersedes_id,'terms',a.terms,'published_at',a.published_at) data
    from core.instructor_agreements a where a.org_id=org and a.center_id=center and a.person_id=(r->>'person_id')::uuid and (last_id is null or (a.created_at,a.id)>(last_time,last_id)) order by a.created_at,a.id limit lim+1
  ) x;
  if jsonb_array_length(items)>lim then
   items:=items-(jsonb_array_length(items)-1);
   token:=encode(convert_to(jsonb_build_object('scope',scope_hash,'at',(select created_at from core.instructor_agreements z where z.org_id=org and z.id=(items->-1->>'id')::uuid),'id',items->-1->'id')::text,'utf8'),'hex');
  end if;
  return jsonb_build_object('data',jsonb_build_object('items',items,'next_cursor',token),'primary_id',null,'subject','instructor_agreements');
 else perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('data',jsonb_build_object('operation_id',operation,'primary_id',primary_id,'version',ver,'replayed',false,'related','[]'::jsonb),'primary_id',primary_id,'subject',case when op='instructor_agreement_publish_v1' then 'instructor_agreements' else 'policy_versions' end);
end$$;


create or replace function private.lesson_start(org uuid,center uuid,r jsonb) returns bigint language plpgsql security invoker set search_path='' as $$
declare ss core.sessions;d jsonb;agreement uuid;bindings jsonb:='[]';ver bigint;actual timestamptz:=(r->>'actual_started_at')::timestamptz;
begin
 select * into ss from core.sessions q where q.org_id=org and q.center_id=center and q.id=(r->>'session_id')::uuid for update;
 if ss.id is null then perform private.fail('NOT_FOUND');end if;
 if ss.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if not isfinite(actual) or actual>clock_timestamp() or length(btrim(r->>'reason'))=0 then perform private.fail('VALIDATION_FAILED');end if;
 if ss.state<>'planned' or ss.attendance_state<>'open' then perform private.fail('INVALID_STATE_TRANSITION');end if;
 if ss.actual_started_at is not null then perform private.fail('INVALID_STATE_TRANSITION');end if;
 if private.lesson_plan(org)->>'name'<>'starter' then
  perform private.require_feature(org,'F20');
  for d in select x from jsonb_array_elements(private.schedule_defaults(org,ss.class_id,
   coalesce((select jsonb_agg(jsonb_build_object('person_id',a.person_id,'duty',a.duty)) from core.session_assignments a where a.org_id=org and a.session_id=ss.id and a.state='active'),'[]'),ss.assignment_mode='legacy')) x where x->>'duty'='instructor' loop
   agreement:=private.agreement_at(org,center,(d->>'person_id')::uuid,ss.discipline_id,ss.format,ss.starts_at,actual);
   if agreement is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   bindings:=bindings||jsonb_build_array(jsonb_build_object('person_id',d->'person_id','agreement_id',agreement));
  end loop;
 end if;
 update core.sessions q set actual_started_at=actual,started_agreements=bindings,version=q.version+1 where q.org_id=org and q.id=ss.id returning version into ver;
 return ver;
end$$;
create or replace function private.lesson_finance_snapshot(org uuid,session uuid,declaration jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare ss core.sessions;d jsonb;ag core.instructor_agreements;result jsonb:='[]';participants jsonb;
begin
 select * into ss from core.sessions where org_id=org and id=session;
 if not (declaration ? 'performed') or not (declaration ? 'performed_instructor_ids') then perform private.fail('VALIDATION_FAILED');end if;
 if (declaration->>'performed')::bool and jsonb_array_length(declaration->'performed_instructor_ids')=0 then perform private.fail('VALIDATION_FAILED');end if;
 if not (declaration->>'performed')::bool and jsonb_array_length(declaration->'performed_instructor_ids')>0 then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from jsonb_array_elements_text(declaration->'performed_instructor_ids') x group by x having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;

 select coalesce(jsonb_agg(jsonb_build_object('reservation_id',v.id,'sale_id',case when v.source_sale_id is null and df.id is not null then null else a.sale_id end,'product_id',case when v.source_sale_id is null and df.id is not null then null else p.product_id end,'kind',coalesce(p.kind,'credits'),
 'trial',v.trial_offer_id is not null,'quantity',coalesce(a.quantity,df.quantity,1),'unit_minor',case when v.source_sale_id is null and df.id is not null then v.negative_basis_minor::numeric else case when p.kind='credits' then sl.net_minor::numeric/nullif(p.credits,0) else null end end::text,
 'currency',case when v.source_sale_id is null and df.id is not null then v.negative_basis_currency else sl.currency end,'negative',v.source_sale_id is null and df.id is not null)),'[]'::jsonb) into participants
 from core.reservations v
 left join lateral(select x.* from core.entitlement_allocations x where x.org_id=org and x.reservation_id=v.id order by x.created_at desc,x.id desc limit 1) a on true
 left join lateral(select x.* from core.credit_deficits x where x.org_id=org and x.reservation_id=v.id order by x.created_at desc,x.id desc limit 1) df on true
 left join core.sales sl on sl.org_id=org and sl.id=a.sale_id left join core.product_versions p on p.org_id=org and p.id=sl.product_version_id
 where v.org_id=org and v.session_id=session and v.state in('active','completed');
 for d in select x from jsonb_array_elements(private.schedule_defaults(org,ss.class_id,
  coalesce((select jsonb_agg(jsonb_build_object('person_id',a.person_id,'duty',a.duty,'agreement_id',a.agreement_id)) from core.session_assignments a where a.org_id=org and a.session_id=session and a.state='active'),'[]'),ss.assignment_mode='legacy')) x where x->>'duty'='instructor' loop
  select * into ag from core.instructor_agreements a where a.org_id=org and a.center_id=ss.center_id and a.id=coalesce((select (x->>'agreement_id')::uuid from jsonb_array_elements(coalesce(ss.started_agreements,'[]')) x where x->>'person_id'=d->>'person_id'),(d->>'agreement_id')::uuid,private.agreement_at(org,ss.center_id,(d->>'person_id')::uuid,ss.discipline_id,ss.format,ss.starts_at,greatest(ss.created_at,ss.starts_at)));
  if ag.id is null or ag.person_id<>(d->>'person_id')::uuid or ag.discipline_id<>ss.discipline_id or ag.format<>ss.format or ag.valid_from>ss.starts_at or (ag.valid_until is not null and ag.valid_until<=ss.starts_at) then
   if not (declaration->>'performed')::bool then continue;end if;
   perform private.fail('POLICY_NOT_CONFIGURED');end if;
  perform private.pay_terms_validate(org,ag.terms);
  result:=result||jsonb_build_array(jsonb_build_object('person_id',ag.person_id,'agreement_id',ag.id,'terms',ag.terms,'participants',participants,'format',ss.format,'performed',(declaration->>'performed')::bool and (declaration->'performed_instructor_ids') ? ag.person_id::text));
 end loop;
 if exists(select 1 from jsonb_array_elements_text(declaration->'performed_instructor_ids') x where not exists(select 1 from jsonb_array_elements(result) y where y->>'person_id'=x)) then perform private.fail('VALIDATION_FAILED');end if;
 if (declaration->>'performed')::bool and jsonb_array_length(result)=0 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 return result;
end$$;
create or replace function private.lesson_finance_amount(org uuid,snapshot jsonb,corrections jsonb default '[]') returns bigint language plpgsql stable security invoker set search_path='' as $$
declare p jsonb;c jsonb;terms jsonb:=snapshot->'terms';parts jsonb;override_terms jsonb;fixed numeric:=0;variable numeric:=0;base numeric;amount numeric;room numeric:=0;pool numeric:=0;total numeric;occurred boolean;currency text:=terms->>'currency';n bigint:=0;entry core.attendance_entries;new_result text;charge bool;percent_total numeric:=0;participant_pool numeric;sale_pool numeric:=0;units bigint:=0;
begin
 occurred:=coalesce((snapshot->>'performed')::bool,false);
 if not coalesce((snapshot->>'performed')::bool,false) or not occurred then return 0;end if;
 for c in select x from jsonb_array_elements(terms->'components') x where x->>'kind'='session_fixed' loop fixed:=fixed+(c->>'amount_minor')::numeric;end loop;
 for p in select x from jsonb_array_elements(snapshot->'participants') x loop
  select * into entry from core.attendance_entries a where a.org_id=org and a.reservation_id=(p->>'reservation_id')::uuid;
  select z->>'result' into new_result from jsonb_array_elements(corrections) z where z->>'reservation_id'=p->>'reservation_id';
  new_result:=coalesce(new_result,entry.result);
  charge:=private.lesson_consumes(org,entry.reservation_id,new_result,entry.policy_snapshot);
  if (p->>'trial')::bool or new_result='blocked' or not charge then continue;end if;
  n:=n+1;units:=units+(p->>'quantity')::bigint;participant_pool:=null;
  select x->'components' into override_terms from jsonb_array_elements(coalesce(terms->'package_overrides','[]')) x where x->>'product_id'=p->>'product_id';
  parts:=coalesce(override_terms,terms->'components');
  if not exists(select 1 from jsonb_array_elements(parts) z where z->>'kind'<>'session_fixed' and (z->>'entitlement_kind' is null or z->>'entitlement_kind'=p->>'kind'))
   and not exists(select 1 from jsonb_array_elements(terms->'components') z where z->>'kind'='session_fixed') then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  for c in select x from jsonb_array_elements(parts) x where x->>'kind'<>'session_fixed' and (x->>'entitlement_kind' is null or x->>'entitlement_kind'=p->>'kind') loop
   if c->>'kind'='per_person' then variable:=variable+(c->>'amount_minor')::numeric;
   else
    if (p->>'negative')::bool then base:=(p->>'unit_minor')::numeric;
    elsif c#>>'{basis,mode}'='fixed_unit' then base:=(c#>>'{basis,unit_minor}')::numeric;
    else base:=(p->>'unit_minor')::numeric;end if;
    if base is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
    if ((p->>'negative')::bool or c#>>'{basis,mode}'='sale_unit') and p->>'currency' is distinct from currency then perform private.fail('CURRENCY_MISMATCH');end if;
    amount:=base*(p->>'quantity')::numeric*(c->>'rate_bps')::numeric/10000;variable:=variable+amount;percent_total:=percent_total+amount;participant_pool:=base;
   end if;
  end loop;
  if terms#>>'{room_fee,kind}'='percentage' and terms#>>'{room_fee,basis,mode}'='sale_unit' then
   if p->>'unit_minor' is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   if p->>'currency' is distinct from currency then perform private.fail('CURRENCY_MISMATCH');end if;
  end if;
  if participant_pool is null and p->>'unit_minor' is not null and terms#>>'{room_fee,kind}'<>'free' and terms#>>'{room_fee,order}'='before_instructor_share' and p->>'currency' is distinct from currency then perform private.fail('CURRENCY_MISMATCH');end if;
  sale_pool:=sale_pool+coalesce((p->>'unit_minor')::numeric,0)*(p->>'quantity')::numeric;
  pool:=pool+coalesce(participant_pool,(p->>'unit_minor')::numeric,0)*(p->>'quantity')::numeric;
 end loop;
 if terms#>>'{room_fee,kind}'='fixed' then room:=(terms#>>'{room_fee,amount_minor}')::numeric;
 elsif terms#>>'{room_fee,kind}'='percentage' then
  if terms#>>'{room_fee,basis,mode}'='fixed_unit' then base:=(terms#>>'{room_fee,basis,unit_minor}')::numeric*units;else base:=sale_pool;end if;
  room:=base*(terms#>>'{room_fee,rate_bps}')::numeric/10000;
 end if;
 if room>0 and terms#>>'{room_fee,order}'='before_instructor_share' then
  if pool<=0 and percent_total<>0 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  variable:=variable-case when pool>0 then room*percent_total/pool else 0 end;
 elsif room>0 then variable:=variable-room;end if;
 total:=fixed+variable;
 if total<0 or total>9223372036854775807 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 return round(total)::bigint;
end$$;


create or replace function private.lesson_finance_correction(snapshot jsonb,r jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not(r ? 'performed') and not(r ? 'performed_instructor_ids') then return snapshot;end if;
 if not(r ? 'performed') or not(r ? 'performed_instructor_ids') then perform private.fail('VALIDATION_FAILED');end if;
 if (r->>'performed')::bool<>(jsonb_array_length(r->'performed_instructor_ids')>0) then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from jsonb_array_elements_text(r->'performed_instructor_ids') x group by x having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from jsonb_array_elements_text(r->'performed_instructor_ids') x where not exists(select 1 from jsonb_array_elements(snapshot) d where d->>'person_id'=x)) then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 select coalesce(jsonb_agg(d||jsonb_build_object('performed',(r->'performed_instructor_ids') ? (d->>'person_id'))),'[]'::jsonb) into result from jsonb_array_elements(snapshot) d;
 return result;
end$$;
create or replace function private.lesson_finance_write(org uuid,session uuid,closure uuid,snapshot jsonb,op uuid,ids uuid[],offset_i int) returns void language plpgsql security invoker set search_path='' as $$
declare d jsonb;amount bigint;old_total bigint;prior uuid;idx int:=offset_i;center uuid;
begin
 select s.center_id into center from core.sessions s where s.org_id=org and s.id=session;
 for d in select x from jsonb_array_elements(snapshot) x loop
  amount:=private.lesson_finance_amount(org,d);
  select coalesce(sum(case when e.direction='add' then e.amount_minor else -e.amount_minor end),0) into old_total from core.earnings e where e.org_id=org and e.session_id=session and e.person_id=(d->>'person_id')::uuid;
  if amount=old_total then continue;end if;
  select e.id into prior from core.earnings e where e.org_id=org and e.session_id=session and e.person_id=(d->>'person_id')::uuid order by e.created_at desc,e.id desc limit 1;
  insert into core.earnings(id,org_id,center_id,person_id,session_id,agreement_id,amount_minor,currency,basis,previous_id,operation_id,direction,closure_id)
   values(private.new_id(ids,idx),org,center,(d->>'person_id')::uuid,session,(d->>'agreement_id')::uuid,abs(amount-old_total),d#>>'{terms,currency}',
   jsonb_build_object('source','lesson_agreement','currency',d#>>'{terms,currency}','quantity',jsonb_array_length(d->'participants'),'excluded_blocked',0,'agreement_id',d->'agreement_id'),
   prior,op,case when amount>old_total then 'add' else 'subtract' end,closure);idx:=idx+1;
 end loop;
end$$;
create or replace function private.earnings_read(org uuid,center uuid,account uuid,r jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare scope_hash text:=md5(jsonb_build_object('actor',account,'request',r-'request_id'-'page')::text);cur jsonb;last_time timestamptz;last_id uuid;items jsonb;lim int:=coalesce((r#>>'{page,limit}')::int,50);token text;
begin
 if (r#>>'{interval,starts_at}')::timestamptz>=(r#>>'{interval,ends_at}')::timestamptz or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from scope_hash then perform private.fail('VALIDATION_FAILED');end if;
   last_time:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(x.data order by x.created_at,x.id),'[]') into items from(
  select e.created_at,e.id,jsonb_build_object('id',e.id,'person_id',e.person_id,'center_id',e.center_id,'session_id',e.session_id,'event_assignment_id',e.event_assignment_id,
  'amount_minor',e.amount_minor::text,'currency',e.currency,'paid_minor',coalesce(a.paid,0)::text,'remaining_minor',greatest(0,e.amount_minor-coalesce(a.paid,0))::text,'basis',e.basis,
  'direction',e.direction,'previous_id',e.previous_id,'closure_id',e.closure_id,'created_at',e.created_at,'version',e.version) data
  from core.earnings e left join lateral(select sum(x.amount_minor) paid from core.earning_allocations x where x.org_id=e.org_id and x.earning_id=e.id) a on true
  where e.org_id=org and (center is null or e.center_id=center) and e.person_id=(r->>'person_id')::uuid
   and e.created_at>=(r#>>'{interval,starts_at}')::timestamptz and e.created_at<(r#>>'{interval,ends_at}')::timestamptz
   and (last_id is null or (e.created_at,e.id)>(last_time,last_id)) order by e.created_at,e.id limit lim+1
 ) x;
 if jsonb_array_length(items)>lim then items:=items-(jsonb_array_length(items)-1);token:=encode(convert_to(jsonb_build_object('scope',scope_hash,'at',items->-1->'created_at','id',items->-1->'id')::text,'utf8'),'hex');end if;
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',clock_timestamp());
end$$;

do $patch$
declare b text;
begin
 b:=pg_get_functiondef('private.reserve_negative(uuid,uuid,uuid,uuid,uuid[],integer)'::regprocedure);
 b:=replace(b,$o$select p.value,p.id into v,valuation_id from private.policy_at(org,ses.center_id,'negative_valuation',clock_timestamp()) p; if v is not null and ((v->>'discipline_id')::uuid<>ses.discipline_id or v->>'format'<>ses.format) then perform private.fail('POLICY_NOT_CONFIGURED');end if;$o$,
 $n$select p.value,p.id into v,valuation_id from private.valuation_at(org,ses.center_id,ses.discipline_id,ses.format,clock_timestamp()) p;$n$);
 execute b;
end$patch$;
-- Patch the existing transaction entrypoints; all authorization precedes receipt replay.
do $patch$
declare b text;
begin
 b:=pg_get_functiondef('private.schedule_resolve_agreements(uuid,uuid,uuid,text,timestamptz,jsonb)'::regprocedure);
 b:=replace(b,'and a.state=''active'' and a.valid_from<=at_time and (a.valid_until is null or at_time<a.valid_until)',
 'and a.id=private.agreement_at(org,center,(d->>''person_id'')::uuid,discipline,format_name,at_time)');
 execute b;
 b:=pg_get_functiondef('private.lesson_dispatch(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 b:=replace(b,$o$if clock_timestamp()<s.starts_at then perform private.fail('INVALID_STATE_TRANSITION');end if;$o$,$n$if clock_timestamp()<s.starts_at and s.actual_started_at is null then perform private.fail('INVALID_STATE_TRANSITION');end if;$n$);
 b:=replace(b,'e jsonb;facts jsonb;','finance_snapshot jsonb;finance_row jsonb;finance_delta bigint;e jsonb;facts jsonb;');
 b:=replace(b,$o$if plan->>'name'<>'starter' or (plan->'features') ? 'F20' then perform private.fail('POLICY_NOT_CONFIGURED');end if;$o$,$n$if plan->>'name'<>'starter' then
    perform private.require_feature(org,'F20');finance_snapshot:=private.lesson_finance_snapshot(org,s.id,r);
    for finance_row in select x from jsonb_array_elements(finance_snapshot) x loop perform private.lesson_finance_amount(org,finance_row);end loop;
   end if;$n$);
 b:=replace(b,$o$'financial_mode','starter_no_earning'$o$,$n$'financial_mode',case when plan->>'name'='starter' then 'starter_no_earning' else 'agreement_earning' end$n$);
 b:=replace(b,$o$if last_cl.plan_snapshot->>'financial_mode' is distinct from 'starter_no_earning' then perform private.fail('POLICY_NOT_CONFIGURED');end if;$o$,$n$if last_cl.plan_snapshot->>'financial_mode'='agreement_earning' then
    perform private.require_feature(org,'F20');finance_snapshot:=last_cl.earnings_snapshot;
    if finance_snapshot is null then perform private.fail('INTEGRITY_VIOLATION');end if;
   elsif last_cl.plan_snapshot->>'financial_mode' is distinct from 'starter_no_earning' then perform private.fail('POLICY_NOT_CONFIGURED');end if;$n$);
 b:=replace(b,$o$if op='attendance_correct_preview_v1' then request_data:=r;end if;$o$,$n$if op='attendance_correct_preview_v1' then request_data:=r;end if;
   if finance_snapshot is not null then finance_snapshot:=private.lesson_finance_correction(finance_snapshot,request_data);end if;$n$);
 b:=replace(b,$o$or jsonb_array_length(request_data->'corrections')=0 or$o$,$n$or (jsonb_array_length(request_data->'corrections')=0 and not(request_data ? 'performed')) or$n$);
 b:=replace(b,'plan_snapshot,rights_snapshot)','plan_snapshot,rights_snapshot,earnings_snapshot)');
 b:=replace(b,$o$'captured_at',clock_timestamp()),effects);$o$,$n$'captured_at',clock_timestamp()),effects,finance_snapshot);$n$);
 b:=replace(b,'last_cl.plan_snapshot,effects);','last_cl.plan_snapshot,effects,finance_snapshot);');
 b:=replace(b,$o$update core.sessions set attendance_state='closed'$o$,$n$if finance_snapshot is not null then perform private.lesson_finance_write(org,s.id,private.new_id(ids,idx),finance_snapshot,operation,ids,idx+10);end if;
   update core.sessions set attendance_state='closed'$n$);
 b:=replace(b,$o$update core.previews set state='applied',version=version+1 where org_id=org and id=pv.id;$o$,$n$if finance_snapshot is not null then perform private.lesson_finance_write(org,s.id,private.new_id(ids,idx),finance_snapshot,operation,ids,idx+10);end if;
   update core.previews set state='applied',version=version+1 where org_id=org and id=pv.id;$n$);
 b:=replace(b,$o$scope_hash:=md5((r-'request_id')::text);$o$,$n$if finance_snapshot is not null then
     for finance_row in select x from jsonb_array_elements(finance_snapshot) x loop
      select private.lesson_finance_amount(org,finance_row,request_data->'corrections')-coalesce(sum(case when q.direction='add' then q.amount_minor else -q.amount_minor end),0) into finance_delta
      from core.earnings q where q.org_id=org and q.session_id=s.id and q.person_id=(finance_row->>'person_id')::uuid;
      if finance_delta<>0 then effects:=effects||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',finance_row->'person_id'),'action',case when finance_delta>0 then 'create' else 'reverse' end,'amount_minor',abs(finance_delta)::text,'currency',finance_row#>>'{terms,currency}','reason',request_data->'reason'));end if;
     end loop;
    end if;
    scope_hash:=md5((r-'request_id')::text);$n$);
 execute b;
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 b:=replace(b,$o$elsif perm_code='event.attendance' then$o$,$n$elsif perm_code='earnings.manage' then
  if not cm then perform private.fail('FORBIDDEN');end if;
 elsif perm_code='earnings.read' then
  if not org_reader and not cm and not ((r->>'person_id')::uuid=person and center is not null and private.has_role(org,person,'instructor',center)) then perform private.fail('FORBIDDEN');end if;
 elsif perm_code='management.inspect' then
  if r->>'operation'<>'negcredit_valuation_set_v1' then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  if not cm then perform private.fail('FORBIDDEN');end if;perform private.require_feature(org,'F15');
 elsif perm_code='event.attendance' then$n$);
 b:=replace(b,' -- DOMAIN_CASES',$n$
 when 'instructor_agreement_publish_v1','instructor_agreements_list_v1','negcredit_valuation_set_v1','management_state_get_v1' then
  terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';
 when 'attendance_start_v1' then
  version_n:=private.lesson_start(org,center,r);record_id:=(r->>'session_id')::uuid;subject:='sessions';
  out:=jsonb_build_object('operation_id',operation_id,'primary_id',record_id,'version',version_n,'replayed',false,'related','[]'::jsonb);
 when 'earnings_list_v1' then
  out:=private.earnings_read(org,center,actor.id,r);
 -- DOMAIN_CASES$n$);
 execute b;
end$patch$;

do $patch$
declare b text;
begin
 b:=pg_get_functiondef('private.schedule_validate(uuid,uuid,jsonb)'::regprocedure);
 b:=replace(b,$o$if s.state<>'planned' or s.starts_at<=clock_timestamp()$o$,$n$if s.actual_started_at is not null or s.state<>'planned' or s.starts_at<=clock_timestamp()$n$);execute b;
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 b:=replace(b,$o$s.starts_at>clock_timestamp() and s.assignment_mode<>'explicit'$o$,$n$s.actual_started_at is null and s.starts_at>clock_timestamp() and s.assignment_mode<>'explicit'$n$);execute b;
 b:=pg_get_functiondef('private.lesson_view(uuid,uuid,boolean)'::regprocedure);
 b:=replace(b,$o$'session_id',s.id,'session_version'$o$,$n$'actual_started_at',s.actual_started_at,'session_id',s.id,'session_version'$n$);execute b;
end$patch$;
create trigger lesson_closure_immutable before update or delete on core.attendance_closures for each row execute function private.lesson_immutable();
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_get_v1','account.self','exempt',array['F06']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('account_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.account_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('organizations_list_v1','account.self','exempt',array['F04']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.organizations_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organizations_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.organizations_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organizations_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('organization_create_v1','platform.owner','bootstrap',array['F01','F32']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.organization_create_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organization_create_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.organization_create_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organization_create_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('organization_get_v1','org.read','read',array['F01']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.organization_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organization_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.organization_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organization_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('organization_update_v1','org.manage','config',array['F01']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.organization_update_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('organization_update_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.organization_update_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organization_update_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('centers_list_v1','org.read','read',array['F01']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.centers_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('centers_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.centers_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.centers_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('center_create_v1','org.manage','bootstrap',array['F01']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.center_create_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('center_create_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.center_create_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.center_create_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('center_update_v1','center.manage','config',array['F01']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.center_update_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('center_update_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.center_update_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.center_update_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('room_save_v1','center.manage','config',array['F01']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.room_save_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('room_save_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.room_save_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.room_save_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('availability_save_v1','center.manage','config',array['F02']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.availability_save_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('availability_save_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.availability_save_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.availability_save_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('availability_exception_save_v1','center.manage','config',array['F02']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.availability_exception_save_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('availability_exception_save_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.availability_exception_save_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.availability_exception_save_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('policies_get_v1','org.read','read',array['F03']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.policies_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('policies_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.policies_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.policies_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('policy_publish_v1','policy.manage','config',array['F03']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.policy_publish_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('policy_publish_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.policy_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.policy_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('roles_list_v1','org.read','read',array['F04','F05']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.roles_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('roles_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.roles_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.roles_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('role_assign_v1','center.manage','config',array['F04']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.role_assign_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('role_assign_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.role_assign_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.role_assign_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('role_revoke_v1','center.manage','config',array['F04']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.role_revoke_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('role_revoke_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.role_revoke_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.role_revoke_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('permission_set_v1','center.manage','config',array['F05']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.permission_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('permission_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.permission_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.permission_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('org_manager_assign_v1','org.owner','config',array['F04']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.org_manager_assign_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('org_manager_assign_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.org_manager_assign_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.org_manager_assign_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('org_manager_revoke_v1','org.owner','config',array['F04']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.org_manager_revoke_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('org_manager_revoke_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.org_manager_revoke_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.org_manager_revoke_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('manager_self_assign_center_v1','org.manage','bootstrap',array['F04']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.manager_self_assign_center_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('manager_self_assign_center_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.manager_self_assign_center_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.manager_self_assign_center_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_access_send_v1','invite.student','invite',array['F04','F06']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_access_send_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('account_access_send_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.account_access_send_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_access_send_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_access_accept_v1','invite.accept','invite',array['F04','F06']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_access_accept_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('account_access_accept_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.account_access_accept_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_access_accept_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('people_list_v1','person.read','read',array['F07']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.people_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('people_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.people_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.people_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('person_get_v1','person.read','read',array['F06','F07']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.person_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('person_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.person_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.person_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('person_create_v1','person.manage','new',array['F07']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.person_create_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('person_create_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.person_create_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.person_create_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('person_update_v1','person.manage','maintenance',array['F07']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.person_update_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('person_update_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.person_update_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.person_update_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('student_activate_v1','person.activate','new',array['F07','F32']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.student_activate_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('student_activate_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.student_activate_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.student_activate_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('student_deactivate_v1','person.activate','maintenance',array['F07','F32']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.student_deactivate_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('student_deactivate_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.student_deactivate_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.student_deactivate_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('calendar_get_v1','schedule.read','read',array['F08']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.calendar_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('calendar_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.calendar_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.calendar_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('class_save_v1','schedule.manage','new',array['F10']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.class_save_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('class_save_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.class_save_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.class_save_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('program_preview_v1','schedule.manage','new',array['F08','F10']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.program_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('program_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.program_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.program_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('program_apply_v1','schedule.manage','new',array['F08','F10']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.program_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('program_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.program_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.program_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_create_v1','schedule.manage','new',array['F08']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.session_create_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('session_create_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.session_create_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.session_create_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_get_v1','schedule.read','read',array['F08']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.session_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('session_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.session_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.session_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_change_preview_v1','schedule.manage','maintenance',array['F08','F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.session_change_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('session_change_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.session_change_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.session_change_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_change_apply_v1','schedule.manage','maintenance',array['F08','F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.session_change_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('session_change_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.session_change_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.session_change_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_capacity_set_v1','schedule.manage','maintenance',array['F08']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.session_capacity_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('session_capacity_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.session_capacity_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.session_capacity_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_assignment_set_v1','schedule.manage','maintenance',array['F13']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.session_assignment_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('session_assignment_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.session_assignment_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.session_assignment_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('reservation_create_v1','reservation.write','reservation',array['F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.reservation_create_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('reservation_create_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.reservation_create_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.reservation_create_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('reservation_cancel_v1','reservation.write','maintenance',array['F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.reservation_cancel_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('reservation_cancel_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.reservation_cancel_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.reservation_cancel_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('reservation_list_v1','schedule.read','read',array['F06','F10']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.reservation_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('reservation_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.reservation_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.reservation_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('attendance_get_v1','attendance.draft','read',array['F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.attendance_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('attendance_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.attendance_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.attendance_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('attendance_mark_v1','attendance.draft','maintenance',array['F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.attendance_mark_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('attendance_mark_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.attendance_mark_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.attendance_mark_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('attendance_close_v1','attendance.close','maintenance',array['F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.attendance_close_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('attendance_close_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.attendance_close_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.attendance_close_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('attendance_correct_preview_v1','attendance.correct','maintenance',array['F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.attendance_correct_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('attendance_correct_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.attendance_correct_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.attendance_correct_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('attendance_correct_apply_v1','attendance.correct','maintenance',array['F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.attendance_correct_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('attendance_correct_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.attendance_correct_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.attendance_correct_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('product_publish_v1','product.manage','config',array['F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.product_publish_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('product_publish_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.product_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.product_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('sale_preview_v1','sale.write','new',array['F15','F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.sale_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('sale_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.sale_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.sale_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('sale_apply_v1','sale.write','new',array['F15','F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.sale_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('sale_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.sale_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.sale_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('entitlements_get_v1','person.read','read',array['F06','F15','F16']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.entitlements_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('entitlements_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.entitlements_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.entitlements_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('negative_limit_set_v1','entitlement.correct','config',array['F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.negative_limit_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('negative_limit_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.negative_limit_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.negative_limit_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('collection_record_v1','finance.collect','collection',array['F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.collection_record_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('collection_record_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.collection_record_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.collection_record_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('student_credit_refund_v1','finance.refund','collection',array['F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.student_credit_refund_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('student_credit_refund_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.student_credit_refund_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.student_credit_refund_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('student_credit_offset_v1','finance.collect','collection',array['F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.student_credit_offset_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('student_credit_offset_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.student_credit_offset_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.student_credit_offset_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('debt_adjust_v1','finance.refund','maintenance',array['F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.debt_adjust_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('debt_adjust_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.debt_adjust_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.debt_adjust_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('instructor_agreement_publish_v1','earnings.manage','config',array['F20']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.instructor_agreement_publish_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('instructor_agreement_publish_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.instructor_agreement_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.instructor_agreement_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('earnings_list_v1','earnings.read','read',array['F20']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.earnings_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('earnings_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.earnings_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.earnings_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('subscription_get_v1','subscription.owner','exempt',array['F32']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.subscription_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('subscription_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.subscription_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.subscription_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('saas_payment_submit_v1','subscription.owner','exempt',array['F32']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.saas_payment_submit_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('saas_payment_submit_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.saas_payment_submit_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.saas_payment_submit_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('saas_payment_verify_v1','saas.operator','exempt',array['F32']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.saas_payment_verify_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('saas_payment_verify_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.saas_payment_verify_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.saas_payment_verify_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_save_v1','event.manage','new',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_save_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_save_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_save_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_save_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_publish_v1','event.manage','config',array['F25','F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_publish_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_publish_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_register_v1','event.register','new',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_register_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_register_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_register_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_register_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_registration_cancel_v1','event.register','maintenance',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_registration_cancel_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_registration_cancel_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_registration_cancel_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_registration_cancel_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_complete_v1','event.manage','maintenance',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_complete_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_complete_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_complete_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_complete_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_duty_verify_v1','event.manage','maintenance',array['F20','F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_duty_verify_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_duty_verify_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_duty_verify_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_duty_verify_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_cancel_preview_v1','event.manage','maintenance',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_cancel_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_cancel_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_cancel_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_cancel_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_cancel_apply_v1','event.manage','maintenance',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_cancel_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_cancel_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_cancel_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_cancel_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_list_v1','schedule.read','read',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('class_assignment_set_v1','schedule.manage','config',array['F10','F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.class_assignment_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('class_assignment_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.class_assignment_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.class_assignment_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_attendance_mark_v1','event.attendance','maintenance',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_attendance_mark_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_attendance_mark_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_attendance_mark_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_attendance_mark_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('platform_owner_set_v1','platform.owner','exempt',array['F04']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.platform_owner_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('platform_owner_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.platform_owner_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.platform_owner_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('platform_owner_remove_v1','platform.owner','exempt',array['F04']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.platform_owner_remove_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('platform_owner_remove_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.platform_owner_remove_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.platform_owner_remove_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('center_manager_assign_v1','center.manager.assign','bootstrap',array['F04']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.center_manager_assign_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('center_manager_assign_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.center_manager_assign_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.center_manager_assign_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('center_manager_revoke_v1','center.manager.assign','bootstrap',array['F04']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.center_manager_revoke_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('center_manager_revoke_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.center_manager_revoke_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.center_manager_revoke_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('attendance_block_v1','attendance.block','maintenance',array['F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.attendance_block_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('attendance_block_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.attendance_block_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.attendance_block_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_attendance_close_v1','event.close','maintenance',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_attendance_close_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_attendance_close_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_attendance_close_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_attendance_close_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_attendance_correct_v1','event.close','maintenance',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_attendance_correct_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_attendance_correct_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_attendance_correct_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_attendance_correct_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('negcredit_valuation_set_v1','product.manage','config',array['F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.negcredit_valuation_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('negcredit_valuation_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.negcredit_valuation_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.negcredit_valuation_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('disciplines_list_v1','org.read','read',array['F01']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.disciplines_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('disciplines_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.disciplines_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.disciplines_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('discipline_save_v1','org.manage','config',array['F01']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.discipline_save_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('discipline_save_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.discipline_save_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.discipline_save_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('center_discipline_set_v1','center.manage','config',array['F01']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.center_discipline_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('center_discipline_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.center_discipline_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.center_discipline_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('person_discipline_set_v1','person.manage','config',array['F07']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.person_discipline_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('person_discipline_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.person_discipline_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.person_discipline_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_get_v1','person.read','read',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_registration_preview_v1','event.register','student',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_registration_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_registration_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_registration_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_registration_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_payment_prepare_v1','event.register','new',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_payment_prepare_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_payment_prepare_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_payment_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_payment_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_payment_get_v1','person.read','read',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_payment_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_payment_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_payment_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_payment_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_actual_start_record_v1','event.manage','maintenance',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_actual_start_record_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_actual_start_record_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_actual_start_record_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_actual_start_record_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('event_actual_start_correct_v1','event.manage','maintenance',array['F29']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.event_actual_start_correct_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('event_actual_start_correct_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.event_actual_start_correct_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.event_actual_start_correct_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('management_state_get_v1','management.inspect','read',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.management_state_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('management_state_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.management_state_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.management_state_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('instructor_agreements_list_v1','earnings.manage','read',array['F20']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.instructor_agreements_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('instructor_agreements_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.instructor_agreements_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.instructor_agreements_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('reservation_impact_preview_v1','reservation.protection.manage','config',array['F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.reservation_impact_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('reservation_impact_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.reservation_impact_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.reservation_impact_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('reservation_impact_apply_v1','reservation.protection.manage','config',array['F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.reservation_impact_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('reservation_impact_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.reservation_impact_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.reservation_impact_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('negative_limits_get_v1','entitlement.correct','read',array['F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.negative_limits_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('negative_limits_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.negative_limits_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.negative_limits_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('attendance_start_v1','attendance.close','maintenance',array['F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.attendance_start_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('attendance_start_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.attendance_start_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.attendance_start_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
notify pgrst,'reload schema';
commit;
