-- P01-C: human intent/offer conversion and a database worker with no human authority.
begin;
do $$begin if not exists(select 1 from pg_roles where rolname='ftk_p01_worker') then create role ftk_p01_worker nologin;end if;end$$;
create table private.p01_worker_scopes(db_role name not null,org_id uuid not null references core.organizations(id),primary key(db_role,org_id));
create table private.p01_jobs(job_id uuid primary key references core.outbox_jobs(id),org_id uuid not null references core.organizations(id),operation text not null check(operation in ('seat_offer_issue_v1','seat_offer_expire_v1','request_expire_v1')),target_id uuid not null,operation_key uuid,lease_hash text,payload_hash text,result jsonb);
alter table private.p01_worker_scopes enable row level security;
alter table private.p01_jobs enable row level security;
revoke all on private.p01_worker_scopes,private.p01_jobs from public,anon,authenticated,ftk_p01_worker;
create unique index p01_open_waitlist_identity on core.waitlist_entries(org_id,session_id,person_id) where state in ('waiting','offered');
create unique index p01_active_offer_entry on core.seat_offers(org_id,entry_id) where state='active';
create index p01_due_offers on core.seat_offers(org_id,expires_at,id) where state='active';
create index p01_waitlist_fifo on core.waitlist_entries(org_id,session_id,joined_at,id) where state='waiting';

create function private.p01_worker_scope(org uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not pg_has_role(session_user,'ftk_p01_worker','member') or not exists(select 1 from private.p01_worker_scopes w where w.db_role=session_user and w.org_id=org) then perform private.fail('FORBIDDEN');end if;
end$$;
create function private.p01_wait_context(op text,r jsonb,org uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare sid uuid;pid uuid;cid uuid;
begin
 if op='waitlist_join_v1' then sid:=(r->>'session_id')::uuid;pid:=(r->>'person_id')::uuid;
 elsif op='waitlist_leave_v1' then select session_id,person_id into sid,pid from core.waitlist_entries where org_id=org and id=(r->>'entry_id')::uuid;
 else select session_id,person_id into sid,pid from core.seat_offers where org_id=org and id=(r->>'offer_id')::uuid;end if;
 select center_id into cid from core.sessions where org_id=org and id=sid;
 if cid is null or pid is null or (r->>'center_id' is not null and (r->>'center_id')::uuid<>cid) then perform private.fail('NOT_FOUND');end if;
 return r||jsonb_build_object('center_id',cid,'session_id',sid,'person_id',pid);
end$$;
create function private.p01_wait_access(r jsonb,org uuid,actor uuid,center uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if actor is null or ((r->>'person_id')::uuid<>actor and not private.is_manager(org,actor,center) and not private.staff_grant(org,actor,center,'reservation.write')) then perform private.fail('FORBIDDEN');end if;
 if not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
end$$;
create function private.p01_wait_window(org uuid,s core.sessions) returns timestamptz language plpgsql security invoker set search_path='' as $$
declare p jsonb;close_at timestamptz;
begin
 select x.value into p from private.policy_at(org,s.center_id,'reservation_window',clock_timestamp()) x;
 if p is null or p->>'kind'<>'window' then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 close_at:=least(s.starts_at,s.starts_at-make_interval(mins=>(p->>'closes_minutes_before')::int));
 if s.state<>'planned' or clock_timestamp()>=close_at then perform private.fail('OFFER_UNAVAILABLE');end if;
 if clock_timestamp()<s.starts_at-make_interval(mins=>(p->>'opens_minutes_before')::int) then perform private.fail('FORBIDDEN');end if;
 return close_at;
end$$;
create function private.p01_wait_eligible(org uuid,s core.sessions,pid uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from core.people where org_id=org and id=pid and state='active') or not exists(select 1 from core.center_relationships where org_id=org and center_id=s.center_id and person_id=pid and kind='student' and state='active') then return false;end if;
 if exists(select 1 from core.reservations where org_id=org and session_id=s.id and person_id=pid and state='active') or exists(select 1 from core.session_assignments where org_id=org and session_id=s.id and person_id=pid and duty='assistant' and state='active') then return false;end if;
 if s.class_id is not null and not (select external_open from core.classes where org_id=org and id=s.class_id) and not exists(select 1 from core.sales x where x.org_id=org and x.person_id=pid and private.lesson_scope_matches(org,s.id,x.product_version_id)) then return false;end if;
 return true;
end$$;
create function private.p01_wait_page(r jsonb,org uuid,actor uuid,center uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare items jsonb;lim int:=coalesce((r#>>'{page,limit}')::int,50);h text;cur jsonb;last_at timestamptz;last_id uuid;token text;v jsonb;
begin
 if lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 h:=md5(jsonb_build_object('actor',actor,'scope',r-'request_id'-'page')::text);
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(x.item order by x.created_at,x.id),'[]'::jsonb) into items from (
  select w.created_at,w.id,jsonb_build_object('operation',r->'operation','entity',jsonb_build_object('type','waitlist_entries','id',w.id),'exists',true,'state',w.state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','waitlist_entries','id',w.id),'version',w.version)),'as_of',clock_timestamp(),'current',null,'waitlist_detail',(to_jsonb(w)-'org_id')||jsonb_build_object('offers',coalesce((select jsonb_agg(to_jsonb(o)-'org_id'-'center_id' order by o.created_at,o.id) from core.seat_offers o where o.org_id=org and o.entry_id=w.id),'[]'::jsonb))) item
  from core.waitlist_entries w where w.org_id=org and w.center_id=center and w.session_id=(r->>'session_id')::uuid and w.person_id=(r->>'person_id')::uuid
  and (r->>'entry_id' is null or w.id=(r->>'entry_id')::uuid)
  and (last_id is null or (w.created_at,w.id)>(last_at,last_id)) order by w.created_at,w.id limit lim+1
 ) x;
 if jsonb_array_length(items)>lim then
  items:=items-(jsonb_array_length(items)-1);v:=items->(jsonb_array_length(items)-1);
  token:=encode(convert_to(jsonb_build_object('scope',h,'at',v#>>'{waitlist_detail,created_at}','id',v#>>'{waitlist_detail,id}')::text,'utf8'),'hex');
 end if;
 return jsonb_build_object('items',items,'next_cursor',token);
end$$;
create function private.p01_wait_command(op text,r jsonb,org uuid,center uuid,auth_id uuid,auth_session uuid,operation uuid,ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s core.sessions;w core.waitlist_entries;o core.seat_offers;entity_id uuid:=private.new_id(ids,2);ver bigint:=1;answer jsonb;reservation_id uuid;related jsonb:='[]';
begin
 select * into s from core.sessions where org_id=org and center_id=center and id=(r->>'session_id')::uuid for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 if op='waitlist_join_v1' then
  perform private.p01_wait_window(org,s);
  if not private.p01_wait_eligible(org,s,(r->>'person_id')::uuid) then perform private.fail('OFFER_UNAVAILABLE');end if;
  if exists(select 1 from core.waitlist_entries where org_id=org and session_id=s.id and person_id=(r->>'person_id')::uuid and state in ('waiting','offered')) then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  insert into core.waitlist_entries(id,org_id,center_id,session_id,person_id,joined_at,state) values(entity_id,org,center,s.id,(r->>'person_id')::uuid,clock_timestamp(),'waiting');
 elsif op='waitlist_leave_v1' then
  select * into w from core.waitlist_entries where org_id=org and center_id=center and id=(r->>'entry_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if w.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if w.state not in ('waiting','offered') then perform private.fail('INVALID_STATE_TRANSITION');end if;
  entity_id:=w.id;update core.waitlist_entries set state='left',version=version+1 where org_id=org and id=w.id returning version into ver;
  update core.seat_offers set state='withdrawn',version=version+1 where org_id=org and entry_id=w.id and state='active';
 else
  select * into o from core.seat_offers where org_id=org and center_id=center and id=(r->>'offer_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if o.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if o.state<>'active' or o.expires_at<=clock_timestamp() or s.state<>'planned' then perform private.fail('OFFER_UNAVAILABLE');end if;
  perform private.p01_wait_window(org,s);
  select * into w from core.waitlist_entries where org_id=org and id=o.entry_id for update;
  if w.state<>'offered' then perform private.fail('OFFER_UNAVAILABLE');end if;
  entity_id:=o.id;
  if op='seat_offer_reject_v1' then
   update core.seat_offers set state='rejected',version=version+1 where org_id=org and id=o.id returning version into ver;
   update core.waitlist_entries set state='closed',version=version+1 where org_id=org and id=w.id;
  else
   -- Replace this offer's held place inside the same organization/session lock.
   -- Failure of the nested guarded writer restores the original offer and expiry.
   update core.seat_offers set state='accepted',version=version+1 where org_id=org and id=o.id returning version into ver;
   answer:=private.execute_operation('reservation_create_v1',jsonb_build_object('client_api_version',1,'request_id',r->'request_id','org_id',org,'center_id',center,'operation_key',private.new_id(ids,61),'session_id',s.id,'person_id',o.person_id,'mode','flexible'),auth_id,auth_session,ids[65:cardinality(ids)],null);
   if answer->>'_internal_retry'='uuid_bank_exhausted' then raise exception using errcode='54000',message='UUID_BANK_EXHAUSTED';end if;
   if not coalesce((answer->>'ok')::bool,false) then perform private.fail(answer#>>'{error,code}');end if;
   reservation_id:=(answer#>>'{data,primary_id}')::uuid;
   perform private.p01_request_documents(org,reservation_id);
   update core.waitlist_entries set state='converted',version=version+1 where org_id=org and id=w.id;
   related:=jsonb_build_array(jsonb_build_object('type','reservations','id',reservation_id));
  end if;
 end if;
 return jsonb_build_object('operation_id',operation,'primary_id',entity_id,'version',ver,'replayed',false,'related',related);
end$$;

-- SECURITY DEFINER is limited to dedicated DB worker entrypoints. No client
-- role gains table access or a way to select an arbitrary operation/tenant.
create function private.p01_jobs_claim(p_org uuid,p_ids uuid[],p_limit int default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare item record;job core.outbox_jobs;ctx private.p01_jobs;jid uuid;idx int:=1;tok text;out_json jsonb:='[]';fingerprint text;
begin
 perform private.p01_worker_scope(p_org);
 if p_limit<1 or p_limit>50 then perform private.fail('VALIDATION_FAILED');end if;
 perform 1 from core.organizations where id=p_org for update;
 -- Bound discovery; every job has immutable operation and domain target.
 for item in select 'seat_offer_expire_v1' op,o.id target,'offer:'||o.id::text fingerprint from core.seat_offers o join core.sessions s on s.org_id=o.org_id and s.id=o.session_id where o.org_id=p_org and o.state='active' and (o.expires_at<=clock_timestamp() or s.state<>'planned') and not exists(select 1 from core.outbox_jobs j where j.org_id=p_org and j.dedupe_key='offer:'||o.id::text) order by o.expires_at,o.id limit 50 loop
  jid:=private.new_id(p_ids,idx);idx:=idx+1;
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,p_org,'p01.'||item.op,item.fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
  if found then insert into private.p01_jobs(job_id,org_id,operation,target_id) values(jid,p_org,item.op,item.target);end if;
 end loop;
 for item in select s.id target from core.sessions s where s.org_id=p_org and s.state<>'planned' and exists(select 1 from core.waitlist_entries w where w.org_id=p_org and w.session_id=s.id and w.state in ('waiting','offered')) and not exists(select 1 from core.outbox_jobs j where j.org_id=p_org and j.dedupe_key='p01.cancel:'||s.id::text) order by s.id limit 50 loop
  jid:=private.new_id(p_ids,idx);idx:=idx+1;
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,p_org,'p01.seat_offer_expire_v1','p01.cancel:'||item.target::text,'pending',0,clock_timestamp()) on conflict do nothing;
  if found then insert into private.p01_jobs(job_id,org_id,operation,target_id) values(jid,p_org,'seat_offer_expire_v1',item.target);end if;
 end loop;
 for item in select 'request_expire_v1' op,q.id target,'request:'||q.id::text||':'||q.version::text fingerprint from core.lesson_requests q where q.org_id=p_org and q.state in ('pending','alternative_offered') and coalesce(q.expires_at,q.requested_start)<=clock_timestamp() and (q.state='pending' or not exists(select 1 from core.request_alternatives a where a.org_id=p_org and a.request_id=q.id and a.state in ('offered','accepted') and a.starts_at>clock_timestamp())) and not exists(select 1 from core.outbox_jobs j where j.org_id=p_org and j.dedupe_key='request:'||q.id::text||':'||q.version::text) order by q.created_at,q.id limit 50 loop
  jid:=private.new_id(p_ids,idx);idx:=idx+1;
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,p_org,'p01.'||item.op,item.fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
  if found then insert into private.p01_jobs(job_id,org_id,operation,target_id) values(jid,p_org,item.op,item.target);end if;
 end loop;
 for item in with candidates as (
  select s.id target,s.starts_at,md5(coalesce(string_agg(w.id::text||':'||w.version::text,',' order by w.joined_at,w.id),'')||':'||s.version::text||':'||p.id::text||':'||(select count(*)::text from core.reservations rr where rr.org_id=p_org and rr.session_id=s.id and rr.state='active')||':'||(select count(*)::text from core.seat_offers oo where oo.org_id=p_org and oo.session_id=s.id and oo.state='active' and oo.expires_at>clock_timestamp())) fingerprint
  from core.sessions s join core.waitlist_entries w on w.org_id=s.org_id and w.session_id=s.id and w.state='waiting'
  cross join lateral private.policy_at(p_org,s.center_id,'reservation_window',clock_timestamp()) p
  where s.org_id=p_org and s.state='planned' and p.value->>'kind'='window'
  and clock_timestamp()>=s.starts_at-make_interval(mins=>(p.value->>'opens_minutes_before')::int)
  and clock_timestamp()<least(s.starts_at,s.starts_at-make_interval(mins=>(p.value->>'closes_minutes_before')::int))
  and (select count(*) from core.reservations rr where rr.org_id=p_org and rr.session_id=s.id and rr.state='active')+(select count(*) from core.seat_offers oo where oo.org_id=p_org and oo.session_id=s.id and oo.state='active' and oo.expires_at>clock_timestamp())<s.nominal
  group by s.id,p.id
 ) select c.target,c.fingerprint from candidates c where not exists(select 1 from core.outbox_jobs j where j.org_id=p_org and j.dedupe_key='issue:'||c.target::text||':'||c.fingerprint) order by c.starts_at,c.target limit 50 loop
  jid:=private.new_id(p_ids,idx);idx:=idx+1;
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,p_org,'p01.seat_offer_issue_v1','issue:'||item.target::text||':'||item.fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
  if found then insert into private.p01_jobs(job_id,org_id,operation,target_id) values(jid,p_org,'seat_offer_issue_v1',item.target);end if;
 end loop;
 -- Exhausted crashed leases become terminal instead of being silently retried forever.
 update core.outbox_jobs j set state='failed',lease_until=null,version=version+1 from private.p01_jobs c where c.job_id=j.id and c.org_id=p_org and j.state='running' and j.lease_until<=clock_timestamp() and j.attempts>=3;
 for job in select j.* from core.outbox_jobs j join private.p01_jobs c on c.job_id=j.id and c.org_id=p_org where j.org_id=p_org and j.attempts<3 and ((j.state in ('pending','retry_wait') and coalesce(j.next_attempt_at,clock_timestamp())<=clock_timestamp()) or (j.state='running' and j.lease_until<=clock_timestamp())) order by j.created_at,j.id limit p_limit for update of j skip locked loop
  tok:=private.new_id(p_ids,idx)::text||private.new_id(p_ids,idx+1)::text;idx:=idx+2;
  update private.p01_jobs set lease_hash=encode(extensions.digest(tok,'sha256'),'hex'),operation_key=private.new_id(p_ids,idx),payload_hash=null,result=null where job_id=job.id returning * into ctx;idx:=idx+1;
  update core.outbox_jobs set state='running',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds',version=version+1 where id=job.id;
  out_json:=out_json||jsonb_build_array(jsonb_build_object('operation',ctx.operation,'request',jsonb_build_object('client_api_version',1,'request_id',private.new_id(p_ids,idx),'org_id',p_org,'operation_key',ctx.operation_key,'job_id',job.id,'lease_token',tok)));idx:=idx+1;
 end loop;
 return out_json;
end$$;

create function private.p01_worker_execute(op text,r jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(r->>'org_id')::uuid;job core.outbox_jobs;c private.p01_jobs;s core.sessions;w core.waitlist_entries;o core.seat_offers;q core.lesson_requests;entity_id uuid;subject text;pid uuid;receipt_id uuid:=private.new_id(ids,3);idx int:=20;lim int;places bigint;close_at timestamptz;minutes int;code text;answer_result jsonb;trace uuid:=private.new_id(ids,1);mode text;
begin
 perform private.p01_worker_scope(org);
 perform 1 from core.organizations where id=org for update;
 select * into job from core.outbox_jobs where org_id=org and id=(r->>'job_id')::uuid for update;
 select * into c from private.p01_jobs where org_id=org and job_id=job.id;
 if c.job_id is null or c.operation<>op or c.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') or c.operation_key is distinct from (r->>'operation_key')::uuid then perform private.fail('FORBIDDEN');end if;
 if c.payload_hash is not null and c.payload_hash<>encode(extensions.digest((r-'request_id')::text,'sha256'),'hex') then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 perform private.require_feature(org,case when op='request_expire_v1' then 'F09' else 'F12' end);
 if job.state='succeeded' and c.result is not null then return c.result;end if;
 if job.state<>'running' or job.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 begin
  if op='request_expire_v1' then
   perform private.require_feature(org,'F09');
   select * into q from core.lesson_requests where org_id=org and id=c.target_id for update;
   entity_id:=q.id;subject:='lesson_requests';pid:=q.person_id;
   if q.state in ('pending','alternative_offered') and coalesce(q.expires_at,q.requested_start)<=clock_timestamp() and (q.state='pending' or not exists(select 1 from core.request_alternatives a where a.org_id=org and a.request_id=q.id and a.state in ('offered','accepted') and a.starts_at>clock_timestamp())) then
    update core.lesson_requests set state='expired',version=version+1 where org_id=org and id=q.id;
    update core.request_alternatives set state='expired',version=version+1 where org_id=org and request_id=q.id and state in ('offered','accepted');
   else pid:=null;end if;
  elsif op='seat_offer_expire_v1' then
   perform private.require_feature(org,'F12');
   select ss.* into s from core.sessions ss join core.seat_offers oo on oo.org_id=ss.org_id and oo.session_id=ss.id where oo.org_id=org and oo.id=c.target_id for update of ss;
   if s.id is null then select * into s from core.sessions where org_id=org and id=c.target_id for update;end if;
   select * into o from core.seat_offers where org_id=org and id=c.target_id for update;
   entity_id:=o.id;subject:='seat_offers';pid:=o.person_id;
   if o.state='active' and (o.expires_at<=clock_timestamp() or s.state<>'planned') then
    update core.seat_offers set state=case when s.state<>'planned' then 'withdrawn' else 'expired' end,version=version+1 where org_id=org and id=o.id;
    update core.waitlist_entries set state='closed',version=version+1 where org_id=org and id=o.entry_id;
   else pid:=null;end if;
   if s.state<>'planned' then
    entity_id:=s.id;subject:='sessions';pid:=null;
    update core.seat_offers set state='withdrawn',version=version+1 where org_id=org and session_id=s.id and state='active';
    update core.waitlist_entries set state='closed',version=version+1 where org_id=org and session_id=s.id and state in ('waiting','offered');
   end if;
  elsif op='seat_offer_issue_v1' then
   perform private.require_feature(org,'F12');
   mode:=private.access_mode(org);if mode not in ('normal','grace') then perform private.fail('SERVICE_UNAVAILABLE');end if;
   select * into s from core.sessions where org_id=org and id=c.target_id for update;
   entity_id:=s.id;subject:='sessions';close_at:=private.p01_wait_window(org,s);
   select coalesce((p.value->>'value')::int,30) into minutes from private.policy_at(org,s.center_id,'waitlist_offer_minutes',clock_timestamp()) p;
   minutes:=coalesce(minutes,30);if minutes<=0 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   close_at:=least(close_at,clock_timestamp()+make_interval(mins=>minutes));
   select (select count(*) from core.reservations where org_id=org and session_id=s.id and state='active')+(select count(*) from core.seat_offers where org_id=org and session_id=s.id and state='active' and expires_at>clock_timestamp()) into places;
   for w in select * from core.waitlist_entries where org_id=org and session_id=s.id and state='waiting' order by joined_at,id for update loop
    exit when places>=s.nominal or idx>cardinality(ids)-10;
    if not private.p01_wait_eligible(org,s,w.person_id) then continue;end if;
    entity_id:=private.new_id(ids,idx);idx:=idx+1;subject:='seat_offers';pid:=w.person_id;
    insert into core.seat_offers(id,org_id,center_id,entry_id,session_id,person_id,expires_at,state) values(entity_id,org,s.center_id,w.id,s.id,w.person_id,close_at,'active');
    update core.waitlist_entries set state='offered',version=version+1 where org_id=org and id=w.id;
    insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(private.new_id(ids,idx),org,pid,'seat_offer',entity_id,jsonb_build_object('offer_id',entity_id,'expires_at',close_at));idx:=idx+1;
    places:=places+1;
   end loop;
   pid:=null; -- Each newly issued offer has its own inbox row above.
  else perform private.fail('FORBIDDEN');end if;
  if entity_id is null then perform private.fail('NOT_FOUND');end if;
  answer_result:=jsonb_build_object('ok',true,'data',jsonb_build_object('job_id',job.id,'state','succeeded','result_reference',jsonb_build_object('type',subject,'id',entity_id)),'trace_id',trace);
  insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result,result_expires_at,business_reference) values(receipt_id,org,'worker:'||session_user,op,encode(extensions.digest(r->>'operation_key','sha256'),'hex'),encode(extensions.digest((r-'request_id')::text,'sha256'),'hex'),'succeeded',answer_result,clock_timestamp()+interval '30 days',entity_id);
  insert into core.audit_events(id,org_id,action,subject_table,subject_id,operation_id,diff) values(private.new_id(ids,4),org,op,subject,entity_id,receipt_id,jsonb_build_object('worker_role',session_user,'job_id',job.id));
  if pid is not null then insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(private.new_id(ids,5),org,pid,'p01_expired',entity_id,jsonb_build_object('operation',op));end if;
  update core.outbox_jobs set state='succeeded',lease_until=null,version=version+1 where id=job.id;
  update private.p01_jobs set result=answer_result,payload_hash=encode(extensions.digest((r-'request_id')::text,'sha256'),'hex') where job_id=job.id;
  return answer_result;
 exception when others then
  code:=case when SQLSTATE='P0001' then SQLERRM else 'TEMPORARY_FAILURE' end;
 end;
 update core.outbox_jobs set state=case when attempts>=3 then 'failed' else 'retry_wait' end,lease_until=null,next_attempt_at=clock_timestamp()+interval '5 seconds',version=version+1 where id=job.id;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',job.attempts<3,'trace_id',trace));
end$$;

create function api_v1.p01_jobs_claim(p_org uuid,p_ids uuid[],p_limit int default 1) returns jsonb language sql security invoker set search_path='' as $$select private.p01_jobs_claim(p_org,p_ids,p_limit)$$;

-- Append dispatch without modifying any previously installed migration.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;new text;
begin
 old:=$p$ if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'$p$;
 new:=$p$ if p_operation in ('seat_offer_issue_v1','seat_offer_expire_v1','request_expire_v1') then return private.p01_worker_execute(p_operation,r,p_ids);end if;
$p$||old;
 if strpos(b,old)=0 then raise exception 'P01 worker dispatch anchor missing';end if;b:=replace(b,old,new);
 old:='  cm:=center is not null and private.is_manager(org,person,center);org_reader:=private.is_org_reader(org,person);';
 new:=$p$  if p_operation in ('waitlist_join_v1','waitlist_leave_v1','seat_offer_accept_v1','seat_offer_reject_v1') then
   r:=private.p01_wait_context(p_operation,r,org);center:=(r->>'center_id')::uuid;
  elsif p_operation='management_state_get_v1' and r->>'operation' in ('waitlist_join_v1','waitlist_leave_v1','seat_offer_accept_v1','seat_offer_reject_v1') then
   r:=private.p01_wait_context(r->>'operation',r||(r#>'{selector,key}'),org);center:=(r->>'center_id')::uuid;
  end if;
$p$||old;
 if strpos(b,old)=0 then raise exception 'P01 wait scope anchor missing';end if;b:=replace(b,old,new);
 old:=$p$elsif perm_code='management.inspect' and r->>'operation' like 'lesson_request_%' then$p$;
 new:=$p$elsif perm_code='reservation.write' and p_operation in ('waitlist_join_v1','waitlist_leave_v1','seat_offer_accept_v1','seat_offer_reject_v1') then
  perform private.p01_wait_access(r,org,person,center);
 elsif perm_code='management.inspect' and r->>'operation' in ('waitlist_join_v1','waitlist_leave_v1','seat_offer_accept_v1','seat_offer_reject_v1') then
  perform private.require_feature(org,'F12');
  if r#>>'{selector,operation}' is distinct from r->>'operation' then perform private.fail('VALIDATION_FAILED');end if;
  perform private.p01_wait_access(r,org,person,center);
 $p$||old;
 if strpos(b,old)=0 then raise exception 'P01 wait permission anchor missing';end if;b:=replace(b,old,new);
 old:=$p$if p_operation='management_state_get_v1' and r->>'operation' like 'lesson_request_%' then
   out:=private.p01_requests_page$p$;
 new:=$p$if p_operation='management_state_get_v1' and r->>'operation' in ('waitlist_join_v1','waitlist_leave_v1','seat_offer_accept_v1','seat_offer_reject_v1') then
   out:=private.p01_wait_page(r,org,person,center);terms:=jsonb_build_object('data',out,'subject','waitlist_entries');
  elsif p_operation='management_state_get_v1' and r->>'operation' like 'lesson_request_%' then
   out:=private.p01_requests_page$p$;
 if strpos(b,old)=0 then raise exception 'P01 wait read anchor missing';end if;b:=replace(b,old,new);
 old:=' -- DOMAIN_CASES';new:=$p$
 when 'waitlist_join_v1','waitlist_leave_v1','seat_offer_accept_v1','seat_offer_reject_v1' then
  out:=private.p01_wait_command(p_operation,r,org,center,p_actor_auth_id,p_session_id,operation_id,p_ids);
  record_id:=(out->>'primary_id')::uuid;subject:=case when p_operation like 'seat_offer_%' then 'seat_offers' else 'waitlist_entries' end;
 -- DOMAIN_CASES$p$;
 if strpos(b,old)=0 then raise exception 'P01 wait command anchor missing';end if;execute replace(b,old,new);
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated,ftk_p01_worker;
grant execute on all functions in schema private to service_role;
grant usage on schema api_v1,private,core to ftk_p01_worker;
grant execute on function private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb),private.p01_worker_execute(text,jsonb,uuid[]),private.new_id(uuid[],integer),private.p01_jobs_claim(uuid,uuid[],int) to ftk_p01_worker;
revoke all on function api_v1.p01_jobs_claim(uuid,uuid[],int) from public,anon,authenticated,service_role;
grant execute on function api_v1.p01_jobs_claim(uuid,uuid[],int) to ftk_p01_worker;
commit;
