
begin;
-- Private settlement ledger: original facts immutable, only eligibility aggregates change.
create table private.settlement_authority_versions(
 org_id uuid primary key references core.organizations(id),version bigint not null default 1 check(version>0));
create table private.settlement_grants(
 org_id uuid not null,person_id uuid not null,center_id uuid,granted boolean not null,version bigint not null check(version>0),
 foreign key(org_id,person_id) references core.people(org_id,id),
 foreign key(org_id,center_id) references core.centers(org_id,id));
create unique index settlement_grant_scope on private.settlement_grants(org_id,person_id,coalesce(center_id,'00000000-0000-0000-0000-000000000000'::uuid));
create table private.settlement_movements(
 id uuid primary key,org_id uuid not null references core.organizations(id),version bigint not null default 1,
 debtor_center_id uuid not null,creditor_center_id uuid not null,currency text not null,amount_minor bigint not null check(amount_minor>0),
 open_minor bigint not null check(open_minor>=0 and open_minor<=amount_minor),
 kind text not null check(kind in('accrual','reversal','payment','offset','payment_reversal')),
 source_allocation_id uuid,source_sale_id uuid,previous_id uuid,operation_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(org_id,id),check(debtor_center_id<>creditor_center_id),
 foreign key(org_id,debtor_center_id) references core.centers(org_id,id),
 foreign key(org_id,creditor_center_id) references core.centers(org_id,id),
 foreign key(org_id,source_allocation_id) references core.entitlement_allocations(org_id,id),
 foreign key(org_id,source_sale_id) references core.sales(org_id,id),
 foreign key(org_id,previous_id) references private.settlement_movements(org_id,id));
create unique index settlement_one_right_reversal on private.settlement_movements(org_id,previous_id) where kind='reversal';
create index settlement_pair_read on private.settlement_movements(org_id,debtor_center_id,creditor_center_id,created_at,id);
create table private.settlement_requests(
 id uuid primary key,org_id uuid not null references core.organizations(id),version bigint not null default 1,
 from_center_id uuid not null,to_center_id uuid not null,currency text not null,state text not null check(state in('pending','approved','rejected','withdrawn')),
 initiator_account_id uuid not null references core.accounts(id),decision_account_id uuid references core.accounts(id),
 reason text not null,previous_id uuid,proposal jsonb not null,dependencies jsonb not null,
 initiator_authority jsonb not null,decision_authority jsonb,created_at timestamptz not null default clock_timestamp(),
 unique(org_id,id),check(from_center_id<>to_center_id),
 foreign key(org_id,from_center_id) references core.centers(org_id,id),
 foreign key(org_id,to_center_id) references core.centers(org_id,id),
 foreign key(org_id,previous_id) references private.settlement_requests(org_id,id));
create table private.settlement_records(
 id uuid primary key,org_id uuid not null,request_id uuid not null,version bigint not null default 1,
 kind text not null check(kind in('payment','offset','correction')),amount_minor bigint not null check(amount_minor>0),currency text not null,
 approved_by_account_id uuid not null references core.accounts(id),original_record_id uuid,created_at timestamptz not null default clock_timestamp(),
 unique(org_id,id),unique(org_id,request_id),
 foreign key(org_id,request_id) references private.settlement_requests(org_id,id),
 foreign key(org_id,original_record_id) references private.settlement_records(org_id,id));
create table private.settlement_allocations(
 id uuid primary key,org_id uuid not null,record_id uuid not null,movement_id uuid not null,side text not null check(side in('payment','debit','credit')),
 amount_minor bigint not null check(amount_minor>0),unreversed_minor bigint not null check(unreversed_minor>=0 and unreversed_minor<=amount_minor),
 version bigint not null default 1,previous_id uuid,unique(org_id,id),
 foreign key(org_id,record_id) references private.settlement_records(org_id,id),
 foreign key(org_id,movement_id) references private.settlement_movements(org_id,id),
 foreign key(org_id,previous_id) references private.settlement_allocations(org_id,id));
-- Prevent edits to original economics while allowing versioned balance/correction aggregates.
create function private.settlement_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='DELETE' then perform private.fail('INTEGRITY_VIOLATION');end if;
 if TG_TABLE_NAME='settlement_movements' then
  if (to_jsonb(new)-'version'-'open_minor') is distinct from (to_jsonb(old)-'version'-'open_minor') then perform private.fail('INTEGRITY_VIOLATION');end if;
 elsif TG_TABLE_NAME='settlement_requests' then
  if old.state<>'pending' or (to_jsonb(new)-'version'-'state'-'decision_account_id'-'decision_authority'-'reason') is distinct from
   (to_jsonb(old)-'version'-'state'-'decision_account_id'-'decision_authority'-'reason') then perform private.fail('INTEGRITY_VIOLATION');end if;
 elsif TG_TABLE_NAME='settlement_records' then
  if (to_jsonb(new)-'version') is distinct from (to_jsonb(old)-'version') then perform private.fail('INTEGRITY_VIOLATION');end if;
 elsif TG_TABLE_NAME='settlement_allocations' then
  if (to_jsonb(new)-'version'-'unreversed_minor') is distinct from (to_jsonb(old)-'version'-'unreversed_minor') then perform private.fail('INTEGRITY_VIOLATION');end if;
 end if;
 return new;
end$$;
do $$declare t text;begin
 foreach t in array array['settlement_authority_versions','settlement_grants','settlement_movements','settlement_requests','settlement_records','settlement_allocations'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update on private.%I to service_role',t);
 end loop;
 foreach t in array array['settlement_movements','settlement_requests','settlement_records','settlement_allocations'] loop
 execute format('create trigger settlement_immutable before update or delete on private.%I for each row execute function private.settlement_immutable()',t);
 end loop;
end$$;
create function private.settlement_step(org uuid,center uuid,account uuid,person uuid,permission text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare role_row core.role_assignments;g private.settlement_grants;
begin
 perform private.assert_center(org,center);
 if not private.center_accessible(org,center) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 select * into role_row from core.role_assignments x where x.org_id=org and x.person_id=person and x.scope_center_id=center
 and x.role='center_manager' and x.state='active' and private.has_role(org,person,'center_manager',center) order by x.id limit 1;
 select * into g from private.settlement_grants x where x.org_id=org and x.person_id=person and x.center_id=center and x.granted;
 if role_row.id is null or g.person_id is null then perform private.fail('FORBIDDEN');end if;
 return jsonb_build_object('account_id',account,'person_id',person,'org_id',org,'center_id',center,'permission',permission,
 'manager_role_id',role_row.id,'manager_role_version',role_row.version,'settlement_grant_version',g.version,'checked_at',clock_timestamp());
end$$;
create function private.settlement_admin(org uuid,person uuid,op text,r jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare owner uuid;target uuid:=(r->>'person_id')::uuid;delegated boolean;
begin
 select owner_person_id into owner from core.organizations where id=org;
 delegated:=private.has_role(org,person,'org_manager') and exists(select 1 from private.settlement_grants g where g.org_id=org and g.person_id=person and g.center_id is null and g.granted);
 if op='settlement_delegation_set_v1' then
  if person<>owner then perform private.fail('FORBIDDEN');end if;
  if not private.has_role(org,target,'org_manager') then perform private.fail('NOT_FOUND');end if;
 elsif op='settlement_authority_set_v1' then
  if person<>owner and not delegated then perform private.fail('FORBIDDEN');end if;
  perform private.assert_center(org,(r->>'center_id')::uuid);
  if not private.is_manager(org,target,(r->>'center_id')::uuid) then perform private.fail('NOT_FOUND');end if;
 else
  if not exists(select 1 from core.people p where p.org_id=org and p.id=target) then perform private.fail('NOT_FOUND');end if;
  if person<>owner and not delegated and not(person=target and exists(select 1 from core.role_assignments a where a.org_id=org and a.person_id=person and a.role='center_manager' and a.state='active')) then perform private.fail('FORBIDDEN');end if;
  if person<>owner and person<>target and not exists(select 1 from core.role_assignments a where a.org_id=org and a.person_id=target and a.role='center_manager' and a.state='active') then perform private.fail('FORBIDDEN');end if;
 end if;
end$$;
create function private.settlement_authorize(op text,r jsonb,org uuid,account uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare q private.settlement_requests;center uuid;scope jsonb;
begin
 if op in('settlement_authority_get_v1','settlement_authority_set_v1','settlement_delegation_set_v1') then
  perform private.settlement_admin(org,person,op,r);return null;
 end if;
 if op='settlement_request_submit_v1' then center:=(r->>'from_center_id')::uuid;
 elsif op in('settlement_request_decide_v1','settlement_request_withdraw_v1') then
  select * into q from private.settlement_requests x where x.org_id=org and x.id=(r->>'settlement_request_id')::uuid;
  if q.id is null then perform private.fail('NOT_FOUND');end if;
  center:=case when op='settlement_request_decide_v1' then q.to_center_id else q.from_center_id end;
  if op='settlement_request_withdraw_v1' and q.initiator_account_id<>account then perform private.fail('FORBIDDEN');end if;
 else center:=(r->>'center_id')::uuid;end if;
 scope:=private.settlement_step(org,center,account,person,case when op='settlement_request_decide_v1' then 'settlement.decide' when op in('settlement_request_submit_v1','settlement_request_withdraw_v1') then 'settlement.request' else 'settlement.read' end);
 if op in('settlement_request_submit_v1','settlement_request_decide_v1','settlement_request_withdraw_v1') and r->>'center_id' is not null and (r->>'center_id')::uuid<>center then perform private.fail('FORBIDDEN');end if;
 return scope;
end$$;
create function private.settlement_request_view(org uuid,request uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',q.id,'version',q.version,'from_center_id',q.from_center_id,'to_center_id',q.to_center_id,'currency',q.currency,
 'state',q.state,'initiator_account_id',q.initiator_account_id,'decision_account_id',q.decision_account_id,'reason',q.reason,'previous_id',q.previous_id,
 'proposal',q.proposal,'initiator_authority',q.initiator_authority,'decision_authority',q.decision_authority,'record',(
 select jsonb_build_object('id',z.id,'version',z.version,'request_id',z.request_id,'kind',z.kind,'amount_minor',z.amount_minor::text,
 'currency',z.currency,'approved_by_account_id',z.approved_by_account_id,'original_record_id',z.original_record_id,'created_at',z.created_at,
 'allocations',(select jsonb_agg(jsonb_build_object('id',a.id,'version',a.version,'movement_id',a.movement_id,'side',a.side,'amount_minor',a.amount_minor::text,'unreversed_minor',a.unreversed_minor::text) order by a.id)
 from private.settlement_allocations a where a.org_id=org and a.record_id=z.id))
 from private.settlement_records z where z.org_id=org and z.request_id=q.id))
 from private.settlement_requests q where q.org_id=org and q.id=request
$$;
-- Validate exact selected lines at submission and approval. No unrelated movement participates.
create function private.settlement_validate(org uuid,a uuid,b uuid,currency_name text,proposal jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare line jsonb;m private.settlement_movements;al private.settlement_allocations;rec private.settlement_records;
 side text;lines jsonb;total numeric;expected numeric:=(proposal->>'amount_minor')::numeric;selected jsonb:='[]';seen text[]:=array[]::text[];
begin
 if expected<=0 or expected>9223372036854775807 then perform private.fail('VALIDATION_FAILED');end if;
 if proposal->>'kind'='correction' then
  select * into rec from private.settlement_records x where x.org_id=org and x.id=(proposal->>'original_record_id')::uuid;
  if rec.id is null then perform private.fail('NOT_FOUND');end if;
  if rec.kind='correction' then perform private.fail('VALIDATION_FAILED');end if;
  if rec.version<>(proposal->>'expected_version')::bigint then perform private.fail('PREVIEW_STALE');end if;
  if rec.currency<>currency_name or not exists(select 1 from private.settlement_requests q where q.org_id=org and q.id=rec.request_id and q.from_center_id=a and q.to_center_id=b) then perform private.fail('VALIDATION_FAILED');end if;
  for line in select e from jsonb_array_elements(proposal->'allocations') e loop
   if line->>'allocation_id'=any(seen) then perform private.fail('VALIDATION_FAILED');end if;seen:=array_append(seen,line->>'allocation_id');
   select * into al from private.settlement_allocations x where x.org_id=org and x.record_id=rec.id and x.id=(line->>'allocation_id')::uuid;
   if al.id is null then perform private.fail('NOT_FOUND');end if;
   if al.version<>(line->>'expected_version')::bigint or (line->>'amount_minor')::numeric>al.unreversed_minor then perform private.fail('PREVIEW_STALE');end if;
   if (line->>'amount_minor')::numeric<=0 then perform private.fail('VALIDATION_FAILED');end if;
   selected:=selected||jsonb_build_array(jsonb_build_object('allocation_id',al.id,'version',al.version,'side',al.side,'movement_id',al.movement_id,'amount_minor',line->>'amount_minor'));
  end loop;
  if rec.kind='payment' then
   select sum((e->>'amount_minor')::numeric) into total from jsonb_array_elements(selected) e;
   if total is distinct from expected then perform private.fail('VALIDATION_FAILED');end if;
  else
   foreach side in array array['debit','credit'] loop
    select sum((e->>'amount_minor')::numeric) into total from jsonb_array_elements(selected) e where e->>'side'=side;
    if total is distinct from expected then perform private.fail('VALIDATION_FAILED');end if;
   end loop;
  end if;
 else
  foreach side in array case when proposal->>'kind'='payment' then array['payment'] else array['debit','credit'] end loop
   lines:=case when side='payment' then proposal->'lines' when side='debit' then proposal->'debit_lines' else proposal->'credit_lines' end;
   total:=0;
   for line in select e from jsonb_array_elements(lines) e loop
    if line->>'movement_id'=any(seen) then perform private.fail('VALIDATION_FAILED');end if;seen:=array_append(seen,line->>'movement_id');
    select * into m from private.settlement_movements x where x.org_id=org and x.id=(line->>'movement_id')::uuid;
    if m.id is null then perform private.fail('NOT_FOUND');end if;
    if m.currency<>currency_name then perform private.fail('CURRENCY_MISMATCH');end if;
    if m.debtor_center_id<>(case when side='credit' then b else a end) or m.creditor_center_id<>(case when side='credit' then a else b end) then perform private.fail('VALIDATION_FAILED');end if;
    if m.version<>(line->>'expected_version')::bigint or (line->>'amount_minor')::numeric>m.open_minor then perform private.fail('PREVIEW_STALE');end if;
    if (line->>'amount_minor')::numeric<=0 then perform private.fail('VALIDATION_FAILED');end if;
    total:=total+(line->>'amount_minor')::numeric;
    selected:=selected||jsonb_build_array(jsonb_build_object('movement_id',m.id,'version',m.version,'side',side,'amount_minor',line->>'amount_minor'));
   end loop;
   if total<>expected then perform private.fail('VALIDATION_FAILED');end if;
  end loop;
  if proposal->>'kind'='payment' and (proposal->>'occurred_at')::timestamptz>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
 end if;
 return selected;
end$$;
create function private.settlement_dispatch(op text,r jsonb,org uuid,account uuid,person uuid,operation uuid,ids uuid[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare primary_id uuid:=private.new_id(ids,2);ver bigint:=1;target uuid:=(r->>'person_id')::uuid;center uuid:=(r->>'center_id')::uuid;scope jsonb;
 q private.settlement_requests;prior private.settlement_requests;rec private.settlement_records;al private.settlement_allocations;m private.settlement_movements;
 proposal jsonb:=r->'proposal';selected jsonb;line jsonb;idx int:=30;record_id uuid;amount bigint;result jsonb;items jsonb;
 lim int:=coalesce((r#>>'{page,limit}')::int,50);last_time timestamptz;last_id uuid;cur jsonb;token text;hash text;
begin
 scope:=private.settlement_authorize(op,r,org,account,person);
 if r ? 'operation_key' and length(btrim(r->>'reason'))=0 then perform private.fail('VALIDATION_FAILED');end if;
 if op in('settlement_authority_set_v1','settlement_delegation_set_v1') then
  insert into private.settlement_authority_versions(org_id) values(org) on conflict do nothing;
  select version into ver from private.settlement_authority_versions where org_id=org for update;
  if ver<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if op='settlement_delegation_set_v1' then center:=null;end if;
  update private.settlement_authority_versions set version=version+1 where org_id=org returning version into ver;
  update private.settlement_grants g set granted=(r->>'granted')::bool,version=ver where g.org_id=org and g.person_id=target and g.center_id is not distinct from center;
  if not found then insert into private.settlement_grants values(org,target,center,(r->>'granted')::bool,ver);end if;
  primary_id:=org;
 elsif op='settlement_authority_get_v1' then
  select coalesce((select version from private.settlement_authority_versions where org_id=org),1) into ver;
  select jsonb_build_object('org_id',org,'person_id',target,'version',ver,
  'delegation_allowed',case when person=(select owner_person_id from core.organizations where id=org) or person=target then
   private.has_role(org,target,'org_manager') and exists(select 1 from private.settlement_grants g where g.org_id=org and g.person_id=target and g.center_id is null and g.granted) else false end,
  'center_grants',coalesce((select jsonb_agg(jsonb_build_object('center_id',c.id,'granted',coalesce(g.granted,false) and private.is_manager(org,target,c.id)) order by c.id)
    from core.centers c left join private.settlement_grants g on g.org_id=c.org_id and g.center_id=c.id and g.person_id=target
    where c.org_id=org and (center is null or c.id=center) and (private.is_org_reader(org,person) or private.is_manager(org,person,c.id))),'[]'::jsonb)) into result;
 elsif op='settlement_request_submit_v1' then
  perform private.assert_center(org,(r->>'to_center_id')::uuid);
  if (r->>'from_center_id')::uuid=(r->>'to_center_id')::uuid then perform private.fail('VALIDATION_FAILED');end if;
  if not private.center_accessible(org,(r->>'to_center_id')::uuid) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
  if r->>'previous_id' is not null then
   select * into prior from private.settlement_requests x where x.org_id=org and x.id=(r->>'previous_id')::uuid;
   if prior.id is null or prior.from_center_id<>(r->>'from_center_id')::uuid or prior.to_center_id<>(r->>'to_center_id')::uuid or prior.currency<>r->>'currency' then perform private.fail('NOT_FOUND');end if;
   if prior.version<>(r->>'previous_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   if prior.state='pending' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  end if;
  selected:=private.settlement_validate(org,(r->>'from_center_id')::uuid,(r->>'to_center_id')::uuid,r->>'currency',proposal);
  insert into private.settlement_requests(id,org_id,from_center_id,to_center_id,currency,state,initiator_account_id,reason,previous_id,proposal,dependencies,initiator_authority)
   values(primary_id,org,(r->>'from_center_id')::uuid,(r->>'to_center_id')::uuid,r->>'currency','pending',account,r->>'reason',prior.id,proposal,selected,scope);
 elsif op in('settlement_request_withdraw_v1','settlement_request_decide_v1') then
  select * into q from private.settlement_requests x where x.org_id=org and x.id=(r->>'settlement_request_id')::uuid for update;
  if q.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if q.state<>'pending' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if op='settlement_request_decide_v1' and r->>'decision'='approve' then
   if not private.center_accessible(org,q.from_center_id) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
   if not exists(select 1 from core.role_assignments ar join core.account_links lk on lk.id=ar.account_link_id and lk.org_id=ar.org_id
     join private.settlement_grants ag on ag.org_id=ar.org_id and ag.person_id=ar.person_id and ag.center_id=ar.scope_center_id
     where ar.org_id=org and ar.id=(q.initiator_authority->>'manager_role_id')::uuid and ar.version=(q.initiator_authority->>'manager_role_version')::bigint
     and ar.state='active' and lk.state='active' and lk.verified_at is not null and ag.granted and ag.version=(q.initiator_authority->>'settlement_grant_version')::bigint) then perform private.fail('PREVIEW_STALE');end if;
   selected:=private.settlement_validate(org,q.from_center_id,q.to_center_id,q.currency,q.proposal);
   if selected is distinct from q.dependencies then perform private.fail('PREVIEW_STALE');end if;
   record_id:=private.new_id(ids,20);
   insert into private.settlement_records(id,org_id,request_id,kind,amount_minor,currency,approved_by_account_id,original_record_id)
    values(record_id,org,q.id,q.proposal->>'kind',(q.proposal->>'amount_minor')::bigint,q.currency,account,(q.proposal->>'original_record_id')::uuid);
   for line in select e from jsonb_array_elements(selected) e loop
    amount:=(line->>'amount_minor')::bigint;
    select * into m from private.settlement_movements x where x.org_id=org and x.id=(line->>'movement_id')::uuid for update;
    if q.proposal->>'kind'='correction' then
     select * into al from private.settlement_allocations x where x.org_id=org and x.id=(line->>'allocation_id')::uuid for update;
     update private.settlement_allocations set unreversed_minor=unreversed_minor-amount,version=version+1 where org_id=org and id=al.id;
     update private.settlement_movements set open_minor=open_minor+amount,version=version+1 where org_id=org and id=m.id;
    else
     update private.settlement_movements set open_minor=open_minor-amount,version=version+1 where org_id=org and id=m.id;
    end if;
    insert into private.settlement_allocations(id,org_id,record_id,movement_id,side,amount_minor,unreversed_minor,previous_id)
     values(private.new_id(ids,idx),org,record_id,m.id,line->>'side',amount,case when q.proposal->>'kind'='correction' then 0 else amount end,
     case when q.proposal->>'kind'='correction' then al.id end);
    insert into private.settlement_movements(id,org_id,debtor_center_id,creditor_center_id,currency,amount_minor,open_minor,kind,previous_id,operation_id)
     values(private.new_id(ids,idx+1),org,case when q.proposal->>'kind'='correction' then m.debtor_center_id else m.creditor_center_id end,
     case when q.proposal->>'kind'='correction' then m.creditor_center_id else m.debtor_center_id end,q.currency,amount,0,
     case when q.proposal->>'kind'='correction' then 'payment_reversal' when q.proposal->>'kind'='offset' then 'offset' else 'payment' end,m.id,operation);
    idx:=idx+2;
   end loop;
   if q.proposal->>'kind'='correction' then update private.settlement_records set version=version+1 where org_id=org and id=(q.proposal->>'original_record_id')::uuid;end if;
  end if;
  update private.settlement_requests set state=case when op='settlement_request_withdraw_v1' then 'withdrawn' when r->>'decision'='approve' then 'approved' else 'rejected' end,
   decision_account_id=case when op='settlement_request_decide_v1' then account end,
   decision_authority=case when op='settlement_request_decide_v1' then scope end,reason=r->>'reason',version=version+1
   where org_id=org and id=q.id returning version into ver;primary_id:=q.id;
 elsif op='settlement_request_get_v1' then
  select * into q from private.settlement_requests x where x.org_id=org and x.id=(r->>'settlement_request_id')::uuid and center in(x.from_center_id,x.to_center_id);
  if q.id is null then perform private.fail('NOT_FOUND');end if;
  result:=private.settlement_request_view(org,q.id);
 else
  if coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
  hash:=md5(jsonb_build_object('actor',account,'op',op,'request',r-'request_id'-'page')::text);
  if r#>>'{page,cursor}' is not null then
   begin
    cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
    if cur->>'scope' is distinct from hash then perform private.fail('VALIDATION_FAILED');end if;
    last_time:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;
   exception when others then perform private.fail('VALIDATION_FAILED');end;
  end if;
  if op='settlement_movements_list_v1' then
   select coalesce(jsonb_agg(jsonb_build_object('data',to_jsonb(x)-'operation_id'-'org_id','at',x.created_at,'id',x.id) order by x.created_at,x.id),'[]') into items from(
    select m.* from private.settlement_movements m where m.org_id=org and center in(m.debtor_center_id,m.creditor_center_id) and m.currency=r->>'currency'
    and(last_id is null or (m.created_at,m.id)>(last_time,last_id)) order by m.created_at,m.id limit lim+1)x;
   -- Money is a decimal string, including open balances.
   select coalesce(jsonb_agg(jsonb_set(jsonb_set(e,'{data,amount_minor}',to_jsonb(e#>>'{data,amount_minor}')),'{data,open_minor}',to_jsonb(e#>>'{data,open_minor}')) order by ord),'[]') into items
   from jsonb_array_elements(items) with ordinality t(e,ord);
  else
   select coalesce(jsonb_agg(jsonb_build_object('data',private.settlement_request_view(org,x.id),'at',x.created_at,'id',x.id) order by x.created_at,x.id),'[]') into items from(
    select z.* from private.settlement_requests z where z.org_id=org and center in(z.from_center_id,z.to_center_id)
    and(last_id is null or (z.created_at,z.id)>(last_time,last_id)) order by z.created_at,z.id limit lim+1)x;
  end if;
  if jsonb_array_length(items)>lim then
   items:=items-(jsonb_array_length(items)-1);token:=encode(convert_to(jsonb_build_object('scope',hash,'at',items->-1->'at','id',items->-1->'id')::text,'utf8'),'hex');
  end if;
  result:=jsonb_build_object('items',coalesce((select jsonb_agg(e->'data' order by ord) from jsonb_array_elements(items) with ordinality t(e,ord)),'[]'),
   'next_cursor',token,'as_of',clock_timestamp());
 end if;
 if result is null then result:=jsonb_build_object('operation_id',operation,'primary_id',primary_id,'version',ver,'replayed',false)||case when op in('settlement_authority_set_v1','settlement_delegation_set_v1') then jsonb_build_object('related','[]'::jsonb) else '{}'::jsonb end;end if;
 return jsonb_build_object('data',result,'primary_id',primary_id,'subject','organizations','audit',jsonb_build_object('step_authority',scope||jsonb_build_object('actor_account_id',account),'request_id',primary_id),
 'notify_person',case when op='settlement_request_decide_v1' then private.person_for(org,q.initiator_account_id) else person end);
end$$;

-- Fixed minor-unit credit slots: largest remainder with stable unit-index tie.
-- Local and event use occupy the same source-sale slots as cross-center lessons.
create table private.settlement_credit_units(
 org_id uuid not null,sale_id uuid not null,unit_index bigint not null check(unit_index>0),
 amount_minor bigint not null check(amount_minor>=0),allocation_id uuid,
 primary key(org_id,sale_id,unit_index),
 foreign key(org_id,sale_id) references core.sales(org_id,id),
 foreign key(org_id,allocation_id) references core.entitlement_allocations(org_id,id));
alter table private.settlement_credit_units enable row level security;
revoke all on private.settlement_credit_units from public,anon,authenticated;
grant select,insert,update on private.settlement_credit_units to service_role;
create function private.settlement_slots(a core.entitlement_allocations) returns void language plpgsql security invoker set search_path='' as $$
declare credits bigint;net bigint;n bigint;slot bigint;
begin
 select p.credits,s.net_minor into credits,net from core.sales s join core.product_versions p on p.org_id=s.org_id and p.id=s.product_version_id
 where s.org_id=a.org_id and s.id=a.sale_id and p.kind='credits';
 if credits is null then return;end if;
 if a.state='released' then
  update private.settlement_credit_units set allocation_id=null where org_id=a.org_id and allocation_id=a.id;return;
 end if;
 select count(*) into n from private.settlement_credit_units where org_id=a.org_id and sale_id=a.sale_id and allocation_id=a.id;
 if n=a.quantity then return;end if;
 if n<>0 then perform private.fail('INTEGRITY_VIOLATION');end if;
 for slot in select i from generate_series(1,least(credits,(select count(*) from private.settlement_credit_units u where u.org_id=a.org_id and u.sale_id=a.sale_id and u.allocation_id is not null)+a.quantity)) i
  where not exists(select 1 from private.settlement_credit_units u where u.org_id=a.org_id and u.sale_id=a.sale_id and u.unit_index=i and u.allocation_id is not null)
  order by i limit a.quantity loop
  insert into private.settlement_credit_units(org_id,sale_id,unit_index,amount_minor,allocation_id)
   values(a.org_id,a.sale_id,slot,floor(net::numeric/credits)::bigint+case when slot<=mod(net,credits) then 1 else 0 end,a.id)
   on conflict(org_id,sale_id,unit_index) do update set allocation_id=excluded.allocation_id;
  n:=n+1;
 end loop;
 if n<>a.quantity then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;
end$$;
create function private.settlement_slots_trigger() returns trigger language plpgsql security invoker set search_path='' as $$
begin perform private.settlement_slots(new);return new;end$$;
create trigger settlement_credit_slots after insert or update of state on core.entitlement_allocations
 for each row execute function private.settlement_slots_trigger();
-- Existing allocation source values may be prepared, but no historical ledger is invented.
do $$declare a core.entitlement_allocations;begin
 for a in select * from core.entitlement_allocations where state in('reserved','consumed') order by created_at,id loop
  perform private.settlement_slots(a);
 end loop;
end$$;

-- Reconcile only the affected lesson/new sale; original recorded amount is used on every reversal.
create function private.settlement_sync(org uuid,session uuid,new_sale uuid,operation uuid,ids uuid[]) returns void
language plpgsql security invoker set search_path='' as $$
declare row_data record;prior private.settlement_movements;desired boolean;amount bigint;idx int:=300;performed boolean;closed boolean;earn jsonb;
begin
 for row_data in select a.*,s.center_id sale_center,s.net_minor,s.currency,p.credits,p.kind product_kind,v.session_id,ss.center_id service_center,ss.attendance_state
 from core.entitlement_allocations a join core.sales s on s.org_id=a.org_id and s.id=a.sale_id
 join core.product_versions p on p.org_id=s.org_id and p.id=s.product_version_id
 join core.reservations v on v.org_id=a.org_id and v.id=a.reservation_id
 join core.sessions ss on ss.org_id=v.org_id and ss.id=v.session_id
 where a.org_id=org and ((session is not null and ss.id=session) or (new_sale is not null and s.id=new_sale)) order by a.id loop
  select c.earnings_snapshot into earn from core.attendance_closures c where c.org_id=org and c.session_id=row_data.session_id order by c.revision desc limit 1;
  performed:=exists(select 1 from jsonb_array_elements(coalesce(earn,'[]')) e where (e->>'performed')::bool);
  desired:=row_data.state='consumed' and row_data.attendance_state='closed' and performed and row_data.product_kind='credits'
   and row_data.sale_center<>row_data.service_center;
  select * into prior from private.settlement_movements m where m.org_id=org and m.source_allocation_id=row_data.id and m.kind='accrual'
   and not exists(select 1 from private.settlement_movements z where z.org_id=org and z.kind='reversal' and z.previous_id=m.id) order by m.created_at desc,m.id desc limit 1;
  if desired and prior.id is null then
   perform private.require_feature(org,'F18');
   if not private.center_accessible(org,row_data.sale_center) or not private.center_accessible(org,row_data.service_center) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
   if not private.lesson_scope_matches(org,row_data.session_id,(select product_version_id from core.sales where org_id=org and id=row_data.sale_id)) then perform private.fail('CLASS_ACCESS_DENIED');end if;
   select coalesce(sum(u.amount_minor),0) into amount from private.settlement_credit_units u
    where u.org_id=org and u.sale_id=row_data.sale_id and u.allocation_id=row_data.id;
   if amount>0 then
    insert into private.settlement_movements(id,org_id,debtor_center_id,creditor_center_id,currency,amount_minor,open_minor,kind,source_allocation_id,source_sale_id,operation_id)
     values(private.new_id(ids,idx),org,row_data.sale_center,row_data.service_center,row_data.currency,amount,amount,'accrual',row_data.id,row_data.sale_id,operation);idx:=idx+1;
   end if;
  elsif not desired and prior.id is not null then
   update private.settlement_movements set open_minor=0,version=version+1 where org_id=org and id=prior.id;
   insert into private.settlement_movements(id,org_id,debtor_center_id,creditor_center_id,currency,amount_minor,open_minor,kind,source_allocation_id,source_sale_id,previous_id,operation_id)
    values(private.new_id(ids,idx),org,prior.creditor_center_id,prior.debtor_center_id,prior.currency,prior.amount_minor,prior.amount_minor-prior.open_minor,
     'reversal',prior.source_allocation_id,prior.source_sale_id,prior.id,operation);idx:=idx+1;
  end if;
 end loop;
end$$;
-- Shared organization lock serializes role/grant revoke, settlement and source consumers.
do $patch$declare b text;old text;begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:=b;
 b:=replace(b,$o$elsif perm_code='event.attendance' then$o$,$n$elsif p_operation like 'settlement_%' then
  perform private.settlement_authorize(p_operation,r,org,actor.id,person);
  if p_operation='settlement_request_decide_v1' then
   select 32+2*jsonb_array_length(q.dependencies) into count_n from private.settlement_requests q where q.org_id=org and q.id=(r->>'settlement_request_id')::uuid;
   if cardinality(p_ids)<count_n then return jsonb_build_object('_internal_retry','uuid_bank_exhausted','required_uuid_count',count_n);end if;
  end if;
 elsif perm_code='event.attendance' then$n$);
 if b=old then raise exception 'settlement authorization patch failed';end if;old:=b;
 b:=replace(b,' -- DOMAIN_CASES',$n$
 when 'settlement_movements_list_v1','settlement_requests_list_v1','settlement_request_get_v1',
 'settlement_request_submit_v1','settlement_request_withdraw_v1','settlement_request_decide_v1',
 'settlement_authority_get_v1','settlement_delegation_set_v1','settlement_authority_set_v1' then
  terms:=private.settlement_dispatch(p_operation,r,org,actor.id,person,operation_id,p_ids);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';audit_delta:=terms->'audit';
 -- DOMAIN_CASES$n$);
 if b=old then raise exception 'settlement dispatch patch failed';end if;old:=b;
 b:=replace(b,$o$ if out ? 'items' and p_operation<>'disciplines_list_v1' then$o$,$n$
 if p_operation in('attendance_close_v1','attendance_correct_apply_v1') then
  perform private.settlement_sync(org,coalesce((r->>'session_id')::uuid,(select (x.payload#>>'{request,session_id}')::uuid from private.preview_payloads x where x.preview_id=(r#>>'{preview,id}')::uuid)),null,operation_id,p_ids);
 elsif p_operation='sale_apply_v1' then perform private.settlement_sync(org,null,record_id,operation_id,p_ids);end if;
 if out ? 'items' and p_operation<>'disciplines_list_v1' then$n$);
 if b=old then raise exception 'settlement source patch failed';end if;
 -- A receives decision/rejection notification, with reason and independently verified B scope.
 b:=replace(b,$o$coalesce(person,(select owner_person_id from core.organizations where id=org))$o$,$n$coalesce(case when p_operation='settlement_request_decide_v1' then (terms->>'notify_person')::uuid end,person,(select owner_person_id from core.organizations where id=org))$n$);
 execute b;
end$patch$;

do $patch$declare b text;begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 b:=replace(b,$o$jsonb_build_object('template_key',p_operation,'subject',jsonb_build_object('type',subject,'id',record_id))$o$,
 $n$jsonb_build_object('template_key',p_operation,'subject',jsonb_build_object('type',subject,'id',record_id))||
 case when p_operation like 'settlement_%' then jsonb_build_object('reason',r->'reason','decision',r->'decision','step_authority',terms#>'{audit,step_authority}') else '{}'::jsonb end$n$);
 execute b;
end$patch$;

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
insert into private.runtime_operations(name,permission,billing_class,features) values('settlement_movements_list_v1','settlement.read','read',array['F18']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settlement_movements_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settlement_movements_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settlement_movements_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settlement_movements_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settlement_requests_list_v1','settlement.read','read',array['F18']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settlement_requests_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settlement_requests_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settlement_requests_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settlement_requests_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settlement_request_get_v1','settlement.read','read',array['F18']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settlement_request_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settlement_request_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settlement_request_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settlement_request_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settlement_request_submit_v1','settlement.request','config',array['F18']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settlement_request_submit_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settlement_request_submit_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settlement_request_submit_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settlement_request_submit_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settlement_request_withdraw_v1','settlement.request','config',array['F18']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settlement_request_withdraw_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settlement_request_withdraw_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settlement_request_withdraw_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settlement_request_withdraw_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settlement_request_decide_v1','settlement.decide','config',array['F18']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settlement_request_decide_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settlement_request_decide_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settlement_request_decide_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settlement_request_decide_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settlement_authority_get_v1','settlement.authority.inspect','read',array['F18']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settlement_authority_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settlement_authority_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settlement_authority_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settlement_authority_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settlement_delegation_set_v1','settlement.delegation.manage','config',array['F18']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settlement_delegation_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settlement_delegation_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settlement_delegation_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settlement_delegation_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settlement_authority_set_v1','settlement.authority.manage','config',array['F18']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settlement_authority_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settlement_authority_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settlement_authority_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settlement_authority_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
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
