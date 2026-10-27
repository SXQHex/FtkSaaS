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
