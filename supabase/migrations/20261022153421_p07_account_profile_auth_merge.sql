begin;
-- Account data is global: never borrow an arbitrary tenant for its audit/inbox.
create table private.p07_profiles(account_id uuid primary key references core.accounts(id),display_name text not null);
create table private.p07_account_events(id uuid primary key,account_id uuid not null references core.accounts(id),operation_id uuid not null unique references core.operation_receipts(id),created_at timestamptz not null default clock_timestamp(),diff jsonb not null);
create table private.p07_account_inbox(id uuid primary key,event_id uuid not null unique references private.p07_account_events(id),account_id uuid not null references core.accounts(id),created_at timestamptz not null default clock_timestamp(),kind text not null check(kind='account_profile_updated'));
create index p07_account_inbox_scope on private.p07_account_inbox(account_id,created_at desc,id desc);
alter table private.p07_profiles enable row level security;alter table private.p07_account_events enable row level security;alter table private.p07_account_inbox enable row level security;
revoke all on private.p07_profiles,private.p07_account_events,private.p07_account_inbox from public,anon,authenticated;
grant select,insert,update on private.p07_profiles to service_role;grant select,insert on private.p07_account_events,private.p07_account_inbox to service_role;
create function private.p07_profile(account uuid) returns text language sql stable security invoker set search_path='' as $$select coalesce((select display_name from private.p07_profiles where account_id=account),(select coalesce(u.raw_user_meta_data->>'display_name',u.email) from core.accounts a join auth.users u on u.id=a.auth_user_id where a.id=account))$$;
create function private.p07_profile_inbox(account uuid) returns jsonb language sql stable security invoker set search_path='' as $$select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'created_at',n.created_at) order by n.created_at desc,n.id desc),'[]'::jsonb) from (select * from private.p07_account_inbox where account_id=account order by created_at desc,id desc limit 20) n$$;
create function private.p07_profile_management(r jsonb,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare data jsonb;ver bigint;at timestamptz:=clock_timestamp();
begin
 if r->>'org_id' is not null or r->>'center_id' is not null or r#>>'{selector,operation}' is distinct from 'account_profile_update_v1' then perform private.fail('VALIDATION_FAILED');end if;
 if r?'entity' and r->'entity'<>'null'::jsonb and r->'entity' is distinct from jsonb_build_object('type','accounts','id',account) then perform private.fail('NOT_FOUND');end if;
 select version into ver from core.accounts where id=account;
 data:=jsonb_build_object('operation','account_profile_update_v1','entity',jsonb_build_object('type','accounts','id',account),'exists',true,'state','active','versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','accounts','id',account),'version',ver)),'as_of',at,'current',jsonb_build_object('operation','account_profile_update_v1','values',jsonb_build_object('display_name',private.p07_profile(account))));
 return jsonb_build_object('data',jsonb_build_object('items',jsonb_build_array(data),'next_cursor',null,'as_of',at),'primary_id',account,'subject','accounts');
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;
begin
 old:=' select * into actor from core.accounts where auth_user_id=usr.id for share;';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile account lock anchor mismatch';end if;
 b:=replace(b,old,' if p_operation=''account_profile_update_v1'' then select * into actor from core.accounts where auth_user_id=usr.id for update;else '||old||'end if;');
 old:=$a$ elsif p_operation in ('account_get_v1','organizations_list_v1','account_access_accept_v1') then null;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile permission anchor mismatch';end if;
 b:=replace(b,old,old||E'\n'||' elsif p_operation=''account_profile_update_v1'' then null;');
 old:=$a$elsif perm_code='management.inspect' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile management access anchor mismatch';end if;
 b:=replace(b,old,'elsif perm_code=''management.inspect'' and r->>''operation''=''account_profile_update_v1'' then perform private.p07_profile_management(r,actor.id);'||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile management domain anchor mismatch';end if;
 b:=replace(b,old,'if p_operation=''management_state_get_v1'' and r->>''operation''=''account_profile_update_v1'' then terms:=private.p07_profile_management(r,actor.id);else '||old||'end if;');
 old:=$a$out:=jsonb_build_object('id',actor.id,'state',actor.state,'display_name',coalesce(usr.raw_user_meta_data->>'display_name',usr.email));$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile read anchor mismatch';end if;
 b:=replace(b,old,$a$out:=jsonb_build_object('id',actor.id,'state',actor.state,'display_name',private.p07_profile(actor.id),'profile_notices',private.p07_profile_inbox(actor.id));$a$);
 old:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 profile domain anchor mismatch';end if;
 b:=replace(b,old,$a$
 when 'account_profile_update_v1' then
  if btrim(r->>'display_name')='' then perform private.fail('VALIDATION_FAILED');end if;
  if actor.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  terms:=jsonb_build_object('before',jsonb_build_object('display_name',private.p07_profile(actor.id)),'after',jsonb_build_object('display_name',r->>'display_name'));
  insert into private.p07_profiles values(actor.id,r->>'display_name') on conflict(account_id) do update set display_name=excluded.display_name;
  update core.accounts set version=version+1 where id=actor.id returning version into version_n;
  insert into private.p07_account_events values(private.new_id(p_ids,11),actor.id,operation_id,clock_timestamp(),terms);
  insert into private.p07_account_inbox(id,event_id,account_id,kind) values(private.new_id(p_ids,12),private.new_id(p_ids,11),actor.id,'account_profile_updated');
  record_id:=actor.id;subject:='accounts';
 -- DOMAIN_CASES$a$);
 execute b;
end$patch$;
revoke all on function private.p07_profile(uuid),private.p07_profile_inbox(uuid),private.p07_profile_management(jsonb,uuid) from public,anon,authenticated;
grant execute on function private.p07_profile(uuid),private.p07_profile_inbox(uuid),private.p07_profile_management(jsonb,uuid) to service_role;
commit;
begin;
create table private.p07_recovery_config(singleton boolean primary key default true check(singleton),window_seconds int not null check(window_seconds between 1 and 86400),max_ip int not null check(max_ip>0),max_target int not null check(max_target>0));
create table private.p07_recovery_rates(kind text not null check(kind in ('ip','target')),fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),bucket bigint not null,hits int not null,primary key(kind,fingerprint,bucket));
alter table private.p07_recovery_config enable row level security;alter table private.p07_recovery_rates enable row level security;
revoke all on private.p07_recovery_config,private.p07_recovery_rates from public,anon,authenticated;
grant select on private.p07_recovery_config to service_role;grant select,insert,update,delete on private.p07_recovery_rates to service_role;
create function private.p07_password_preflight(r jsonb,auth_id uuid,session uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare checked jsonb;
begin
 checked:=private.execute_operation('account_get_v1',r,auth_id,session,ids,null);
 if checked->>'ok' is distinct from 'true' then return checked;end if;
 return jsonb_build_object('_internal_auth_ready',true);
end$$;
create function private.p07_recovery_gate(r jsonb,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg private.p07_recovery_config;rate_bucket bigint;n int;rate_kind text;rate_fingerprint text;trace uuid:=private.new_id(ids,1);code text;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then perform private.fail('TEMPORARY_FAILURE');end if;
 if aux->>'bot_verified' is distinct from 'true' or coalesce(aux->>'ip_hash','')!~'^[a-f0-9]{64}$' or coalesce(aux->>'target_hash','')!~'^[a-f0-9]{64}$' then perform private.fail('TEMPORARY_FAILURE');end if;
 select * into cfg from private.p07_recovery_config where singleton;
 if not found then perform private.fail('TEMPORARY_FAILURE');end if;
 rate_bucket:=floor(extract(epoch from clock_timestamp())/cfg.window_seconds)::bigint;
 -- Fixed order and shared hash keys serialize concurrent callers on both limits.
 foreach rate_kind in array array['ip','target'] loop
  rate_fingerprint:=aux->>(rate_kind||'_hash');
  perform pg_advisory_xact_lock(hashtextextended('p07.recovery.'||rate_kind||rate_fingerprint,0));
  insert into private.p07_recovery_rates values(rate_kind,rate_fingerprint,rate_bucket,1) on conflict(kind,fingerprint,bucket) do update set hits=private.p07_recovery_rates.hits+1 returning hits into n;
  if n>(case when rate_kind='ip' then cfg.max_ip else cfg.max_target end) then perform private.fail('RATE_LIMITED');end if;
 end loop;
 delete from private.p07_recovery_rates where (kind,fingerprint,bucket) in (select x.kind,x.fingerprint,x.bucket from private.p07_recovery_rates x where x.bucket<rate_bucket-2 order by x.bucket limit 1000);
 return jsonb_build_object('_internal_recovery_ready',true);
exception when others then
 code:=case when SQLSTATE='P0001' and SQLERRM='RATE_LIMITED' then 'RATE_LIMITED' else 'TEMPORARY_FAILURE' end;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',code='TEMPORARY_FAILURE','trace_id',trace));
end$$;
revoke all on function private.p07_password_preflight(jsonb,uuid,uuid,uuid[],jsonb),private.p07_recovery_gate(jsonb,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.p07_password_preflight(jsonb,uuid,uuid,uuid[],jsonb),private.p07_recovery_gate(jsonb,uuid[],jsonb) to service_role;
commit;
begin;
-- Aliases retain original history IDs. No financial, attendance or audit row is
-- rewritten; readers resolve identity and apply their original center filters.
create function private.p07_person_root(org uuid,pid uuid) returns uuid language sql stable security invoker set search_path='' as $$
 with recursive chain as (select p.id,p.merged_into_id,array[p.id] seen from core.people p where p.org_id=org and p.id=pid union all select p.id,p.merged_into_id,c.seen||p.id from chain c join core.people p on p.org_id=org and p.id=c.merged_into_id where not p.id=any(c.seen) and cardinality(c.seen)<64) select id from chain where merged_into_id is null limit 1
$$;
create function private.p07_same_person(org uuid,a uuid,b uuid) returns boolean language sql stable security invoker set search_path='' as $$select a is not null and b is not null and private.p07_person_root(org,a)=private.p07_person_root(org,b)$$;
create function private.p07_person_members(org uuid,pid uuid) returns uuid[] language sql stable security invoker set search_path='' as $$select coalesce(array_agg(p.id order by p.id),'{}'::uuid[]) from core.people p where p.org_id=org and private.p07_same_person(org,p.id,pid)$$;
create table private.p07_merge_approval_context(approval_id uuid primary key references core.merge_approvals(id),account_id uuid not null references core.accounts(id),authority_hash text not null);
alter table private.p07_merge_approval_context enable row level security;revoke all on private.p07_merge_approval_context from public,anon,authenticated;grant select,insert,update on private.p07_merge_approval_context to service_role;
create unique index p07_merge_preview on core.merge_requests(org_id,preview_id);
create unique index p07_merge_center on core.merge_approvals(org_id,merge_request_id,center_id);
create function private.p07_merge_authority(org uuid,account uuid) returns text language sql stable security invoker set search_path='' as $$select md5(coalesce((select jsonb_agg(jsonb_build_array(r.id,r.version,r.scope_center_id,l.id,l.version) order by r.id)::text from core.role_assignments r join core.account_links l on l.org_id=r.org_id and l.id=r.account_link_id and l.person_id=r.person_id join core.accounts ac on ac.id=l.account_id and ac.state='active' join auth.users usr on usr.id=ac.auth_user_id and usr.deleted_at is null and usr.email_confirmed_at is not null and (usr.banned_until is null or usr.banned_until<clock_timestamp()) where r.org_id=org and l.account_id=account and l.state='active' and l.verified_at is not null and r.state='active' and r.role='center_manager'),'[]'))$$;
-- Catalog-driven FK discovery includes every physical people reference. Audit,
-- notification and merge workflow rows cannot stale their own approval process.
create function private.p07_merge_snapshot(org uuid,source uuid,target uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare ids uuid[]:=private.p07_person_members(org,source)||private.p07_person_members(org,target);ref record;rows_data jsonb;all_data jsonb:='[]';centers uuid[]:='{}';c uuid;entry jsonb;global_scope boolean:=false;table_name text;
begin
 select jsonb_build_array(jsonb_build_object('table','people','rows',jsonb_agg(to_jsonb(p) order by p.id))) into all_data from core.people p where p.org_id=org and p.id=any(ids);
 for ref in select distinct cl.relname tab,a.attname col from pg_constraint fk join pg_class cl on cl.oid=fk.conrelid join pg_namespace n on n.oid=cl.relnamespace join pg_attribute a on a.attrelid=cl.oid and a.attnum=any(fk.conkey) where fk.contype='f' and fk.confrelid='core.people'::regclass and n.nspname='core' and a.attname<>'org_id' and cl.relname not in ('audit_events','notifications','merge_requests','merge_approvals','previews') order by cl.relname,a.attname loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x) order by x.id),''[]''::jsonb) from core.%I x where x.org_id=$1 and x.%I=any($2)',ref.tab,ref.col) into rows_data using org,ids;
  all_data:=all_data||jsonb_build_array(jsonb_build_object('table',ref.tab,'column',ref.col,'rows',rows_data));
  if ref.tab<>'people' then
   for entry in select value from jsonb_array_elements(rows_data) loop
    c:=coalesce((entry->>'center_id')::uuid,(entry->>'scope_center_id')::uuid);
    if c is not null then centers:=array_append(centers,c);
    elsif ref.tab in ('role_assignments','organizations','instructor_agreements') then global_scope:=true;end if;
   end loop;
  end if;
 end loop;
 foreach table_name in array array['resource_bookings','availability_rules','availability_exceptions'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x) order by x.id),''[]''::jsonb) from core.%I x where x.org_id=$1 and x.resource_kind=''person'' and x.resource_id=any($2)',table_name) into rows_data using org,ids;
  all_data:=all_data||jsonb_build_array(jsonb_build_object('table',table_name,'rows',rows_data));
  for entry in select value from jsonb_array_elements(rows_data) loop centers:=array_append(centers,(entry->>'center_id')::uuid);end loop;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(g) order by g.person_id,g.center_id),'[]') into rows_data from private.settlement_grants g where g.org_id=org and g.person_id=any(ids);
 all_data:=all_data||jsonb_build_array(jsonb_build_object('table','settlement_grants','rows',rows_data));
 for entry in select value from jsonb_array_elements(rows_data) loop c:=(entry->>'center_id')::uuid;if c is null then global_scope:=true;else centers:=array_append(centers,c);end if;end loop;
 if exists(select 1 from core.sales s join core.product_scopes p on p.org_id=s.org_id and p.product_version_id=s.product_version_id where s.org_id=org and s.person_id=any(ids) and p.scope_kind='organization_all') then global_scope:=true;end if;
 if global_scope then select array_agg(c.id order by c.id) into centers from core.centers c where c.org_id=org;end if;
 select coalesce(array_agg(distinct x order by x),'{}'::uuid[]) into centers from unnest(centers) x;
 return jsonb_build_object('hash',encode(extensions.digest(all_data::text,'sha256'),'hex'),'centers',to_jsonb(centers),'ids',to_jsonb(ids));
end$$;
create function private.p07_merge_conflicts(org uuid,source uuid,target uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare ids uuid[]:=private.p07_person_members(org,source)||private.p07_person_members(org,target);blocks jsonb:='[]';ref record;bad boolean;
begin
 if (select count(*) from core.account_links l where l.org_id=org and l.person_id=any(ids) and l.state='active')>1 then blocks:=blocks||jsonb_build_array(jsonb_build_object('code','ACCOUNT_LINK_CONFLICT','retryable',false));end if;
 -- Conflicting live bookings must be resolved explicitly by their own commands.
 for ref in select * from (values('session_assignments','session_id','active'),('reservations','session_id','active'),('event_registrations','event_id','active'),('waitlist_entries','session_id','waiting'),('seat_offers','session_id','active')) v(tab,key,state) loop
  execute format('select exists(select 1 from core.%I where org_id=$1 and person_id=any($2) and state=$3 group by %I having count(*)>1)',ref.tab,ref.key) into bad using org,ids,ref.state;
  if bad then blocks:=blocks||jsonb_build_array(jsonb_build_object('code','RESERVATION_EXISTS','retryable',false));exit;end if;
 end loop;
 if exists(select 1 from core.resource_bookings a join core.resource_bookings b on b.org_id=a.org_id and b.id>a.id and b.resource_kind='person' and b.state='active' and b.resource_id<>a.resource_id and b.resource_id=any(ids) and b.starts_at<a.ends_at and b.ends_at>a.starts_at where a.org_id=org and a.resource_kind='person' and a.resource_id=any(ids) and a.state='active') then blocks:=blocks||jsonb_build_array(jsonb_build_object('code','RESOURCE_CONFLICT','retryable',false));end if;
 if exists(select 1 from core.availability_rules a join core.availability_rules b on b.org_id=a.org_id and b.center_id=a.center_id and b.resource_kind='person' and b.resource_id<>a.resource_id and b.resource_id=any(ids) where a.org_id=org and a.resource_kind='person' and a.resource_id=any(ids)) then blocks:=blocks||jsonb_build_array(jsonb_build_object('code','VALIDATION_FAILED','retryable',false));end if;
 if exists(select 1 from core.negative_limit_overrides p where p.org_id=org and p.person_id in (source,target) group by p.center_id,p.discipline_id having count(distinct p.limit_count)>1) then blocks:=blocks||jsonb_build_array(jsonb_build_object('code','VALIDATION_FAILED','retryable',false));end if;
 if exists(select 1 from core.permission_overrides p where p.org_id=org and p.person_id=any(ids) group by p.center_id,p.permission having count(distinct p.enabled)>1) or exists(select 1 from private.settlement_grants p where p.org_id=org and p.person_id=any(ids) group by p.center_id having count(distinct p.granted)>1) then blocks:=blocks||jsonb_build_array(jsonb_build_object('code','VALIDATION_FAILED','retryable',false));end if;
 return blocks;
end$$;
create function private.p07_merge_access(op text,r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare payload jsonb;snap jsonb;source uuid;target uuid;preview core.previews;allowed boolean;c uuid;
begin
 if op='person_merge_preview_v1' then source:=(r->>'source_id')::uuid;target:=(r->>'target_id')::uuid;
 else
  select p.* into preview from core.previews p where p.org_id=org and p.id=(r#>>'{preview,id}')::uuid and p.operation='person_merge_preview_v1' and exists(select 1 from private.preview_payloads v where v.preview_id=p.id and v.token_hash=encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex'));
  if not found then perform private.fail('NOT_FOUND');end if;
  select p.payload into payload from private.preview_payloads p where p.preview_id=preview.id;
  source:=(payload->>'source_id')::uuid;target:=(payload->>'target_id')::uuid;
  if op='person_merge_apply_v1' and preview.actor_account_id<>account then perform private.fail('FORBIDDEN');end if;
 end if;
 if source=target or not exists(select 1 from core.people p where p.org_id=org and p.id=source) or not exists(select 1 from core.people p where p.org_id=org and p.id=target) then perform private.fail('NOT_FOUND');end if;
 snap:=private.p07_merge_snapshot(org,source,target);
 if op='person_merge_approve_v1' then
  c:=(r->>'approval_center_id')::uuid;
  if not snap->'centers' ? c::text or not private.is_manager(org,actor,c) then perform private.fail('FORBIDDEN');end if;
 elsif center is not null then
  if not private.is_manager(org,actor,center) or (jsonb_array_length(snap->'centers')>0 and not snap->'centers' ? center::text) then perform private.fail('FORBIDDEN');end if;
 else
  select exists(select 1 from core.centers c where c.org_id=org and (jsonb_array_length(snap->'centers')=0 or snap->'centers' ? c.id::text) and private.is_manager(org,actor,c.id)) into allowed;
  if not allowed then perform private.fail('FORBIDDEN');end if;
 end if;
 return jsonb_build_object('source_id',source,'target_id',target,'snapshot',snap,'preview_id',preview.id,'payload',payload);
end$$;
create function private.p07_merge(op text,r jsonb,org uuid,center uuid,actor uuid,account uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare ctx jsonb;source uuid;target uuid;snap jsonb;payload jsonb;preview core.previews;preview_private private.preview_payloads;vsource bigint;vtarget bigint;dep jsonb;blocks jsonb;pid uuid;token text;scoped_hash text;req core.merge_requests;approval uuid;c uuid;ref record;members uuid[];has_link boolean;grant_owner uuid;
begin
 ctx:=private.p07_merge_access(op,r,org,center,actor,account);source:=(ctx->>'source_id')::uuid;target:=(ctx->>'target_id')::uuid;snap:=ctx->'snapshot';
 if op='person_merge_preview_v1' then
  if exists(select 1 from core.people p where p.org_id=org and p.id in (source,target) and p.state<>'active') then perform private.fail('PREVIEW_STALE');end if;
  select version into vsource from core.people where org_id=org and id=source;select version into vtarget from core.people where org_id=org and id=target;
  token:=aux->>'token';if token is null then perform private.fail('INTEGRITY_VIOLATION');end if;pid:=private.new_id(ids,2);
  dep:=jsonb_build_object('versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',source),'version',vsource),jsonb_build_object('entity',jsonb_build_object('type','people','id',target),'version',vtarget)),'policy_hashes',jsonb_build_array(snap->>'hash'),'permission_hash',private.p07_merge_authority(org,account));
  scoped_hash:=md5(jsonb_build_object('actor',account,'org',org,'source',source,'target',target,'centers',snap->'centers')::text);
  blocks:=private.p07_merge_conflicts(org,source,target);
  select coalesce(jsonb_agg(x||jsonb_build_object('trace_id',private.new_id(ids,1))),'[]'::jsonb) into blocks from jsonb_array_elements(blocks) x;
  insert into core.previews(id,org_id,operation,actor_account_id,scope_hash,dependencies,result,state) values(pid,org,op,account,scoped_hash,dep,'{}','current');
  payload:=jsonb_build_object('source_id',source,'target_id',target,'snapshot',snap,'account',account,'authority_hash',private.p07_merge_authority(org,account),'center_id',center);
  insert into private.preview_payloads values(pid,payload,clock_timestamp()+interval '15 minutes',encode(extensions.digest(token,'sha256'),'hex'));
  return jsonb_build_object('data',jsonb_build_object('id',pid,'token',token,'scope_hash',scoped_hash,'dependencies',dep,'effects',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',source),'action','adjust','reason','merge alias; history IDs and center ownership retained')),'blockers',blocks,'merge_summary',jsonb_build_object('source_id',source,'target_id',target,'affected_center_ids',snap->'centers','required_approval_center_ids',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements_text(snap->'centers') x where not private.is_manager(org,actor,x::uuid)),'linked_history',true),'expires_at',(select expires_at from private.preview_payloads where preview_id=pid)),'primary_id',pid,'subject','previews');
 end if;
 select p.* into preview from core.previews p where p.id=(ctx->>'preview_id')::uuid for update;payload:=ctx->'payload';select * into preview_private from private.preview_payloads where preview_id=preview.id;
 if preview.state<>'current' or preview_private.expires_at<=clock_timestamp() or snap->>'hash' is distinct from payload#>>'{snapshot,hash}' or private.p07_merge_authority(org,(payload->>'account')::uuid) is distinct from payload->>'authority_hash' then perform private.fail('PREVIEW_STALE');end if;
 blocks:=private.p07_merge_conflicts(org,source,target);if jsonb_array_length(blocks)>0 then perform private.fail(blocks->0->>'code');end if;
 insert into core.merge_requests(id,org_id,source_person_id,target_person_id,preview_id,state) values(private.new_id(ids,11),org,source,target,preview.id,'pending') on conflict(org_id,preview_id) do nothing;
 select m.* into req from core.merge_requests m where m.org_id=org and m.preview_id=preview.id for update;
 if op='person_merge_approve_v1' then
  c:=(r->>'approval_center_id')::uuid;approval:=private.new_id(ids,12);
  insert into core.merge_approvals(id,org_id,center_id,merge_request_id,approver_person_id,scope_hash,approved_at) values(approval,org,c,req.id,actor,snap->>'hash',clock_timestamp()) on conflict(org_id,merge_request_id,center_id) do update set approver_person_id=excluded.approver_person_id,scope_hash=excluded.scope_hash,approved_at=excluded.approved_at,version=core.merge_approvals.version+1 returning id into approval;
  insert into private.p07_merge_approval_context values(approval,account,private.p07_merge_authority(org,account)) on conflict(approval_id) do update set account_id=excluded.account_id,authority_hash=excluded.authority_hash;
  return jsonb_build_object('primary_id',approval,'version',(select version from core.merge_approvals where id=approval),'subject','merge_approvals');
 end if;
 for c in select value::uuid from jsonb_array_elements_text(snap->'centers') loop
  if not private.is_manager(org,actor,c) and not exists(select 1 from core.merge_approvals m join private.p07_merge_approval_context a on a.approval_id=m.id where m.org_id=org and m.merge_request_id=req.id and m.center_id=c and m.scope_hash=snap->>'hash' and private.person_for(org,a.account_id)=m.approver_person_id and private.is_manager(org,m.approver_person_id,c) and a.authority_hash=private.p07_merge_authority(org,a.account_id)) then perform private.fail('APPROVAL_REQUIRED');end if;
 end loop;
 members:=private.p07_person_members(org,source);
 select l.person_id into grant_owner from core.account_links l where l.org_id=org and l.person_id=any(members) and l.state='active' and l.verified_at is not null;has_link:=grant_owner is not null;
 -- Current operational references move; inactive rows remain linked history.
 for ref in select * from (values('center_relationships','center_id,kind'),('person_disciplines','center_id,discipline_id,kind')) v(tab,keys) loop
  execute format('update core.%I s set state=''inactive'',version=s.version+1 where s.org_id=$1 and s.person_id=any($2) and s.state=''active'' and exists(select 1 from core.%I t where t.org_id=s.org_id and t.person_id=$3 and t.state=''active'' and %s)',ref.tab,ref.tab,(select string_agg(format('t.%I is not distinct from s.%I',k,k),' and ') from unnest(string_to_array(ref.keys,',')) k)) using org,members,target;
  execute format('update core.%I s set person_id=$3,version=s.version+1 where s.org_id=$1 and s.person_id=any($2) and s.state=''active''',ref.tab) using org,members,target;
 end loop;
 for ref in select * from (values('reservations',array['active']),('event_registrations',array['active']),('event_payment_preparations',array['prepared']),('lesson_requests',array['pending','alternative_offered']),('waitlist_entries',array['waiting','offered']),('seat_offers',array['active']),('session_assignments',array['active']),('class_assignments',array['active'])) v(tab,states) loop
  execute format('update core.%I s set person_id=$3,version=s.version+1 where s.org_id=$1 and s.person_id=any($2) and s.state=any($4)'||case when ref.tab='session_assignments' then ' and exists(select 1 from core.sessions p where p.org_id=s.org_id and p.id=s.session_id and p.state=''planned'' and p.actual_started_at is null)' else '' end,ref.tab) using org,members,target,ref.states;
 end loop;
 update core.negative_limit_overrides s set person_id=target,version=s.version+1 where s.org_id=org and s.person_id=source and not exists(select 1 from core.negative_limit_overrides t where t.org_id=org and t.person_id=target and t.center_id=s.center_id and t.discipline_id=s.discipline_id);
 for ref in select unnest(array['resource_bookings','availability_rules','availability_exceptions']) tab loop
  execute format('update core.%I x set resource_id=$3,version=x.version+1 where x.org_id=$1 and x.resource_kind=''person'' and x.resource_id=any($2)'||case when ref.tab='resource_bookings' then ' and x.state=''active''' else '' end,ref.tab) using org,members,target;
 end loop;
 if has_link then
  update core.role_assignments s set state='inactive',version=s.version+1 where s.org_id=org and (s.person_id=any(members) or s.person_id=target) and s.state='active' and not exists(select 1 from core.account_links l where l.id=s.account_link_id and l.org_id=s.org_id and l.state='active' and l.verified_at is not null);
  update core.account_links l set person_id=target,version=l.version+1 where l.org_id=org and l.person_id=any(members) and l.state='active';
  update core.role_assignments s set state='inactive',version=s.version+1 where s.org_id=org and s.person_id=any(members) and s.state='active' and exists(select 1 from core.role_assignments t where t.org_id=org and t.person_id=target and t.state='active' and t.role=s.role and t.scope_center_id is not distinct from s.scope_center_id);
  update core.role_assignments s set person_id=target,version=s.version+1 where s.org_id=org and s.person_id=any(members) and s.state='active' and exists(select 1 from core.account_links l where l.id=s.account_link_id and l.org_id=s.org_id and l.state='active' and l.verified_at is not null);
  update core.permission_overrides s set enabled=false,version=s.version+1 where s.org_id=org and s.person_id=any(members) and exists(select 1 from core.permission_overrides t where t.org_id=org and t.person_id=target and t.center_id=s.center_id and t.permission=s.permission);
  update core.permission_overrides s set person_id=target,version=s.version+1 where s.org_id=org and s.person_id=grant_owner and s.enabled;
  update private.settlement_grants s set granted=false,version=s.version+1 where s.org_id=org and s.person_id=any(members) and exists(select 1 from private.settlement_grants t where t.org_id=org and t.person_id=target and t.center_id is not distinct from s.center_id);
  update private.settlement_grants s set person_id=target,version=s.version+1 where s.org_id=org and s.person_id=grant_owner and s.granted;
  update core.permission_overrides s set enabled=false,version=s.version+1 where s.org_id=org and s.person_id=any(members) and s.enabled;
  update private.settlement_grants s set granted=false,version=s.version+1 where s.org_id=org and s.person_id=any(members) and s.granted;
  update core.organizations o set owner_person_id=target,version=o.version+1 where o.id=org and o.owner_person_id=any(members);
 else
  update core.permission_overrides s set enabled=false,version=s.version+1 where s.org_id=org and s.person_id=any(members) and s.enabled;
  update private.settlement_grants s set granted=false,version=s.version+1 where s.org_id=org and s.person_id=any(members) and s.granted;
 end if;
 update core.people p set state='merged',merged_into_id=target,version=p.version+1 where p.org_id=org and p.id=any(members);
 update core.people p set version=p.version+1 where p.org_id=org and p.id=target returning p.version into vtarget;
 update core.merge_requests set state='accepted',version=version+1 where id=req.id;
 update core.previews set state='applied',version=version+1 where id=preview.id;
 return jsonb_build_object('primary_id',target,'version',vtarget,'subject','people');
end$$;
revoke all on function private.p07_person_root(uuid,uuid),private.p07_same_person(uuid,uuid,uuid),private.p07_person_members(uuid,uuid),private.p07_merge_authority(uuid,uuid),private.p07_merge_snapshot(uuid,uuid,uuid),private.p07_merge_conflicts(uuid,uuid,uuid),private.p07_merge_access(text,jsonb,uuid,uuid,uuid,uuid),private.p07_merge(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.p07_person_root(uuid,uuid),private.p07_same_person(uuid,uuid,uuid),private.p07_person_members(uuid,uuid),private.p07_merge_authority(uuid,uuid),private.p07_merge_snapshot(uuid,uuid,uuid),private.p07_merge_conflicts(uuid,uuid,uuid),private.p07_merge_access(text,jsonb,uuid,uuid,uuid,uuid),private.p07_merge(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb) to service_role;
commit;
begin;
create function private.p07_merge_management(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';ctx jsonb;payload jsonb;pv core.previews;source uuid;target uuid;c uuid;data jsonb;vals jsonb;versions jsonb;at timestamptz:=clock_timestamp();
begin
 if r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;
 if op='person_merge_preview_v1' then
  ctx:=private.p07_merge_access(op,k,org,center,actor,account);source:=(ctx->>'source_id')::uuid;target:=(ctx->>'target_id')::uuid;vals:=k;
 elsif op='person_merge_approve_v1' then
  select * into pv from core.previews p where p.org_id=org and p.id=(k->>'preview_id')::uuid and p.operation='person_merge_preview_v1';
  if not found then perform private.fail('NOT_FOUND');end if;
  select p.payload into payload from private.preview_payloads p where p.preview_id=pv.id;
  source:=(payload->>'source_id')::uuid;target:=(payload->>'target_id')::uuid;c:=(k->>'approval_center_id')::uuid;
  if not private.is_manager(org,actor,c) or (center is not null and center<>c) or not (private.p07_merge_snapshot(org,source,target)->'centers' ? c::text) then perform private.fail('FORBIDDEN');end if;
  vals:=jsonb_build_object('approval_center_id',c);
 else perform private.fail('FORBIDDEN');end if;
 if r?'entity' and r->'entity'<>'null'::jsonb and r->'entity' is distinct from jsonb_build_object('type','people','id',target) then perform private.fail('NOT_FOUND');end if;
 select jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','people','id',p.id),'version',p.version) order by p.id) into versions from core.people p where p.org_id=org and p.id in (source,target);
 data:=jsonb_build_object('operation',op,'entity',jsonb_build_object('type','people','id',target),'exists',true,'state',(select state from core.people where org_id=org and id=target),'versions',versions,'as_of',at,'current',jsonb_build_object('operation',op,'values',vals));
 return jsonb_build_object('data',jsonb_build_object('items',jsonb_build_array(data),'next_cursor',null,'as_of',at),'primary_id',target,'subject','people');
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;ops text:=$o$'person_merge_preview_v1','person_merge_approve_v1','person_merge_apply_v1'$o$;
begin
 old:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 merge access anchor mismatch';end if;
 b:=replace(b,old,old||E'\n'||' if p_operation in ('||ops||') then perform private.p07_merge_access(p_operation,r,org,center,person,actor.id);end if;');
 old:=$a$ elsif perm_code='invite.student' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 merge permission anchor mismatch';end if;
 b:=replace(b,old,' elsif p_operation in ('||ops||') then null;'||old);
 old:=$a$elsif perm_code='management.inspect' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 merge management access anchor mismatch';end if;
 b:=replace(b,old,'elsif perm_code=''management.inspect'' and r->>''operation'' in (''person_merge_preview_v1'',''person_merge_approve_v1'') then perform private.p07_merge_management(r,org,center,person,actor.id);'||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 merge management domain anchor mismatch';end if;
 b:=replace(b,old,'if p_operation=''management_state_get_v1'' and r->>''operation'' in (''person_merge_preview_v1'',''person_merge_approve_v1'') then terms:=private.p07_merge_management(r,org,center,person,actor.id);else '||old||'end if;');
 old:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 merge domain anchor mismatch';end if;
 b:=replace(b,old,$a$
 when 'person_merge_preview_v1','person_merge_approve_v1','person_merge_apply_v1' then
  terms:=private.p07_merge(p_operation,r,org,center,person,actor.id,operation_id,p_ids,p_aux);out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;version_n:=coalesce((terms->>'version')::bigint,1);subject:=terms->>'subject';
 -- DOMAIN_CASES$a$);
 execute b;
end$patch$;
-- Only read/eligibility functions widen equality to an alias component. Business
-- UPDATE predicates remain exact IDs; historical ledger rows are never changed.
do $patch$
declare fn record;b text;before_body text;pattern text;replacement text;lhs text;
begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname=any(array['person_projection','person_operational_access','person_assigned_access','purchased_rights','reserve_right','reserve_negative','student_credit_available','p03_finance_read','p03_collection_effects','event_eligibility','preparation_eligibility','event_assignee','event_projection','session_readable','session_assignee','schedule_page','schedule_calendar_rows','lesson_eligibility','lesson_protected','lesson_future_policy_protected','lesson_change_adverse','lesson_affected','lesson_duty','lesson_limits','agreement_at','earnings_read','p01_requests_page','p01_wait_page','p01_wait_eligible','p05_context','p05_requirements','p05_person_activity_access','p05_activity_page','p05_notification_page','p05_file_access','p06_import_file_access']) loop
  b:=pg_get_functiondef(fn.signature);before_body:=b;
  b:=regexp_replace(b,'(([a-z_][a-z0-9_]*\.)?([a-z_]+_)?person_id)\s*=\s*(person|actor|target|pid)(\M)','private.p07_same_person(org,\1,\4)','g');
  b:=replace(b,'target<>person','not private.p07_same_person(org,target,person)');
  b:=replace(b,'target=person','private.p07_same_person(org,target,person)');
  b:=replace(b,'actor<>target','not private.p07_same_person(org,actor,target)');
  b:=replace(b,'target<>actor','not private.p07_same_person(org,target,actor)');
  b:=replace(b,'target=actor','private.p07_same_person(org,target,actor)');
  b:=replace(b,'q.person_id=v.person_id','private.p07_same_person(org,q.person_id,v.person_id)');
  b:=replace(b,'d.person_id=v.person_id','private.p07_same_person(org,d.person_id,v.person_id)');
  if fn.signature::text like 'private.lesson_limits(%' then b:=replace(b,'private.p07_same_person(org,n.person_id,target)','n.person_id=private.p07_person_root(org,target)');end if;
  if fn.signature::text like 'private.reserve_negative(%' then b:=replace(b,'from core.negative_limit_overrides where org_id=org and private.p07_same_person(org,person_id,target)','from core.negative_limit_overrides where org_id=org and person_id=private.p07_person_root(org,target)');end if;
  if b<>before_body then execute b;end if;
 end loop;
 -- Self/history authorization checks in the dispatcher do not mutate target IDs.
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 b:=replace(b,'target is distinct from person','not private.p07_same_person(org,target,person)');
 b:=replace(b,'target=person','private.p07_same_person(org,target,person)');
 b:=replace(b,'target<>person','not private.p07_same_person(org,target,person)');
 -- Exact ownership SELECT/eligibility anchors, never broaden a business UPDATE.
 if strpos(b,'q.person_id=target and private.debt_remaining')=0 then raise exception 'P07 debt booking alias anchor mismatch';end if;
 b:=replace(b,'q.person_id=target and private.debt_remaining','private.p07_same_person(org,q.person_id,target) and private.debt_remaining');
 if strpos(b,'s.person_id=target and sc.class_id')=0 then raise exception 'P07 closed class alias anchor mismatch';end if;
 b:=replace(b,'s.person_id=target and sc.class_id','private.p07_same_person(org,s.person_id,target) and sc.class_id');
 if strpos(b,'from core.debts where org_id=org and center_id=center and person_id=target')=0 then raise exception 'P07 debt ownership alias anchor mismatch';end if;
 b:=replace(b,'from core.debts where org_id=org and center_id=center and person_id=target','from core.debts where org_id=org and center_id=center and private.p07_same_person(org,person_id,target)');
 b:=replace(b,'from core.credit_deficits d where d.org_id=org and d.person_id=target','from core.credit_deficits d where d.org_id=org and private.p07_same_person(org,d.person_id,target)');
 b:=replace(b,'from core.debts d where d.org_id=org and d.center_id=center and d.person_id=target','from core.debts d where d.org_id=org and d.center_id=center and private.p07_same_person(org,d.person_id,target)');
 -- Mutable contact replacement must cover the same component shown by person_get.
 if strpos(b,'c.person_id=target and not exists(select 1 from jsonb_array_elements(r#>')=0 then raise exception 'P07 contact replacement alias anchor mismatch';end if;
 b:=replace(b,'c.person_id=target and not exists(select 1 from jsonb_array_elements(r#>','private.p07_same_person(org,c.person_id,target) and not exists(select 1 from jsonb_array_elements(r#>');
 b:=replace(b,$a$c.person_id=target and c.kind=entry->>'kind' and c.value=entry->>'value'$a$,$a$private.p07_same_person(org,c.person_id,target) and c.kind=entry->>'kind' and c.value=entry->>'value'$a$);
 -- The main detail/list projection advertises linked IDs for historical reads.
 execute b;
 b:=pg_get_functiondef('private.person_projection(uuid,uuid,uuid,boolean,boolean)'::regprocedure);
 b:=replace(b,$a$'id',p.id,'display_name',p.display_name$a$,$a$'id',p.id,'display_name',p.display_name,'linked_person_ids',to_jsonb(private.p07_person_members(org,target))$a$);
 b:=replace(b,'p.id=target','p.id=private.p07_person_root(org,target)');execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_profile_update_v1','account.self','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_profile_update_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('account_profile_update_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.account_profile_update_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_profile_update_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_password_change_v1','account.self','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_password_change_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.p07_password_preflight(p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.account_password_change_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_password_change_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_password_reset_request_v1','auth.recover','exempt',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_password_reset_request_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.p07_recovery_gate(p_request,p_ids,p_aux)$$;
revoke all on function api_v1.account_password_reset_request_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_password_reset_request_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('person_merge_preview_v1','person.merge','maintenance',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.person_merge_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('person_merge_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.person_merge_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.person_merge_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('person_merge_approve_v1','person.merge','maintenance',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.person_merge_approve_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('person_merge_approve_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.person_merge_approve_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.person_merge_approve_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('person_merge_apply_v1','person.merge','maintenance',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.person_merge_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('person_merge_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.person_merge_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.person_merge_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
