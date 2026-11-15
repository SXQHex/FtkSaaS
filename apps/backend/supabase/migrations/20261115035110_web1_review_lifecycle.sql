-- W1-BE-03/04/05: additive scoped review and explicit resource lifecycle.
begin;
-- Explicit lifecycle states preserve the original rule/closure and its audit.
alter table core.availability_rules add column if not exists state text not null default 'active' check(state in ('active','inactive'));
alter table core.availability_exceptions add column if not exists state text not null default 'active' check(state in ('active','cancelled'));
create function private.availability_lifecycle(op text,r jsonb,org uuid,center uuid,actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare item record;selected_id uuid;v bigint;
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if r->>'reason' is null or btrim(r->>'reason')='' or length(r->>'reason')>2000 then perform private.fail('VALIDATION_FAILED');end if;
 perform private.assert_resource(org,center,r#>>'{resource,kind}',(r#>>'{resource,id}')::uuid);
 if op='availability_save_v1' and r->>'action'='retire' then
  selected_id:=(r->>'rule_id')::uuid;
  select * into item from core.availability_rules a where a.org_id=org and a.center_id=center and a.id=selected_id and a.resource_kind=r#>>'{resource,kind}' and a.resource_id=(r#>>'{resource,id}')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if item.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if item.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  update core.availability_rules a set state='inactive',version=a.version+1 where a.org_id=org and a.id=selected_id returning a.version into v;
  return jsonb_build_object('primary_id',selected_id,'version',v,'subject','availability_rules','audit',jsonb_build_object('before',to_jsonb(item),'state','inactive'));
 elsif op='availability_exception_save_v1' and r->>'action'='cancel' then
  -- Same lock/version aggregate as append: cancellation cannot race a closure edit.
  perform 1 from core.centers c where c.org_id=org and c.id=center for update;
  selected_id:=(r->>'exception_id')::uuid;
  select * into item from core.availability_exceptions a where a.org_id=org and a.center_id=center and a.id=selected_id and a.resource_kind=r#>>'{resource,kind}' and a.resource_id=(r#>>'{resource,id}')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if item.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  update core.centers c set version=c.version+1 where c.org_id=org and c.id=center and c.version=(r->>'expected_version')::bigint returning c.version into v;
  if not found then perform private.fail('VERSION_CONFLICT');end if;
  update core.availability_exceptions a set state='cancelled',version=a.version+1 where a.org_id=org and a.id=selected_id;
  return jsonb_build_object('primary_id',selected_id,'version',v,'subject','availability_exceptions','audit',jsonb_build_object('before',to_jsonb(item),'state','cancelled'));
 end if;
 perform private.fail('VALIDATION_FAILED');
end$$;
do $patch$
declare b text;a text;fn record;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$anchor$ when 'availability_save_v1' then
  perform private.assert_resource$anchor$;
 if strpos(b,a)=0 then raise exception 'Availability lifecycle command anchor drift';end if;
 b:=replace(b,a,$anchor$ when 'availability_save_v1' then
 if r->>'action'='retire' then
  terms:=private.availability_lifecycle(p_operation,r,org,center,person);record_id:=(terms->>'primary_id')::uuid;version_n:=(terms->>'version')::bigint;subject:=terms->>'subject';audit_delta:=terms->'audit';
 else
  perform private.assert_resource$anchor$);
 a:=$anchor$  end if;subject:='availability_rules';
 when 'availability_exception_save_v1' then
  perform private.assert_resource$anchor$;
 if strpos(b,a)=0 then raise exception 'Availability exception lifecycle anchor drift';end if;
 b:=replace(b,a,$anchor$  end if;subject:='availability_rules';
 end if;
 when 'availability_exception_save_v1' then
 if r->>'action'='cancel' then
  terms:=private.availability_lifecycle(p_operation,r,org,center,person);record_id:=(terms->>'primary_id')::uuid;version_n:=(terms->>'version')::bigint;subject:=terms->>'subject';audit_delta:=terms->'audit';
 else
  perform private.assert_resource$anchor$);
 a:=$anchor$r->>'reason');subject:='availability_exceptions';
 when 'policy_publish_v1' then$anchor$;
 if strpos(b,a)=0 then raise exception 'Availability exception lifecycle end drift';end if;
 b:=replace(b,a,$anchor$r->>'reason');subject:='availability_exceptions';
 end if;
 when 'policy_publish_v1' then$anchor$);
 a:=$anchor$   audit_delta:=jsonb_build_object('before',to_jsonb(row_record),'after',r->'rule');$anchor$;
 if strpos(b,a)=0 then raise exception 'Availability inactive write anchor drift';end if;
 b:=replace(b,a,$anchor$   if row_record.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
$anchor$||a);
 execute b;
 -- Filter operational readers only. Merge snapshots retain historical rows.
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname=any(array['assert_availability','p06_available_seconds','p06_report_rows','p07_merge_conflicts']) loop
  b:=pg_get_functiondef(fn.signature);
  b:=replace(b,'core.availability_rules','(select * from core.availability_rules where state=''active'')');
  b:=replace(b,'core.availability_exceptions','(select * from core.availability_exceptions where state=''active'')');
  execute b;
 end loop;
 b:=pg_get_functiondef('private.starter_availability_management(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=$a$'exists',true,'state','active',$a$;
 if strpos(b,a)=0 then raise exception 'Availability lifecycle read state drift';end if;
 execute replace(b,a,$a$'exists',true,'state',state,$a$);
 b:=pg_get_functiondef('private.starter_resource_page(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$'exists',true,'state','active',$a$;
 if strpos(b,a)=0 then raise exception 'Exception lifecycle read state drift';end if;
 b:=replace(b,a,$a$'exists',true,'state',state,$a$);
 a:=$a$'values',jsonb_build_object('resource',k->'resource','interval'$a$;
 if strpos(b,a)=0 then raise exception 'Exception lifecycle read identity drift';end if;
 b:=replace(b,a,$a$'values',jsonb_build_object('exception_id',id,'resource',k->'resource','interval'$a$);
 execute b;
end$patch$;
revoke all on function private.availability_lifecycle(text,jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.availability_lifecycle(text,jsonb,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
alter table core.merge_requests add column if not exists reason text;
alter table core.merge_requests add column if not exists decided_at timestamptz;
alter table core.merge_requests add column if not exists decision text not null default 'merge' check(decision in ('merge','not_duplicate'));
alter table core.merge_requests add column if not exists decision_center_id uuid;
alter table core.merge_requests add column if not exists affected_center_ids uuid[] not null default '{}';
alter table core.merge_requests add constraint merge_decision_center foreign key(org_id,decision_center_id) references core.centers(org_id,id) deferrable initially deferred;
create unique index merge_not_duplicate_pair on core.merge_requests(org_id,decision_center_id,least(source_person_id,target_person_id),greatest(source_person_id,target_person_id)) where decision='not_duplicate';
create index merge_review_contacts on core.person_contacts(org_id,kind,lower(btrim(value)),person_id) where not account_projection_retired and kind in ('email','phone');
-- Only fields already readable by person_get are used in a suggestion or history.
create function private.merge_review_person(org uuid,center uuid,actor uuid,pid uuid,contacts boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare name text;root uuid:=private.p07_person_root(org,pid);
begin
 name:=private.directory_person_name(org,center,actor,pid);
 if name is null or not private.person_operational_access(org,actor,center,pid) then return null;end if;
 if contacts and not (private.p07_same_person(org,actor,pid) or private.is_org_reader(org,actor) or private.person_operational_access(org,actor,center,pid)) then return null;end if;
 return (select jsonb_build_object('id',pid,'display_name',name,'version',p.version) from core.people p where p.org_id=org and p.id=pid);
end$$;
create function private.merge_review_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';raw jsonb;filtered jsonb;result jsonb;summary jsonb;items jsonb;at timestamptz:=clock_timestamp();
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 perform private.assert_center(org,center);
 if k->>'directory' is distinct from 'center' or coalesce(k->>'status','suggested') not in ('suggested','completed','not_duplicate','all') then perform private.fail('VALIDATION_FAILED');end if;
 with matched as materialized(
  select distinct least(private.p07_person_root(org,a.person_id),private.p07_person_root(org,b.person_id)) source_id,
   greatest(private.p07_person_root(org,a.person_id),private.p07_person_root(org,b.person_id)) target_id,a.kind
  from core.person_contacts a join core.person_contacts b on b.org_id=a.org_id and b.kind=a.kind
   and lower(btrim(b.value))=lower(btrim(a.value)) and a.person_id<b.person_id
  where a.org_id=org and a.kind in ('email','phone') and btrim(a.value)<>'' and not a.account_projection_retired and not b.account_projection_retired
 ), suggested as(
  select m.source_id,m.target_id,'suggested'::text kind,null::uuid history_id,null::timestamptz recorded_at,null::text reason,jsonb_agg(distinct m.kind order by m.kind) matching_kinds
  from matched m join core.people a on a.org_id=org and a.id=m.source_id and a.state='active'
   join core.people b on b.org_id=org and b.id=m.target_id and b.state='active'
  where m.source_id<>m.target_id and not exists(select 1 from core.merge_requests d where d.org_id=org and d.decision='not_duplicate' and d.decision_center_id=center and
   ((private.p07_same_person(org,d.source_person_id,m.source_id) and private.p07_same_person(org,d.target_person_id,m.target_id)) or
    (private.p07_same_person(org,d.source_person_id,m.target_id) and private.p07_same_person(org,d.target_person_id,m.source_id))))
  group by m.source_id,m.target_id
 ), history as(
  select m.source_person_id,m.target_person_id,case when m.decision='not_duplicate' then 'not_duplicate' else 'completed' end,m.id,m.decided_at,m.reason,'[]'::jsonb
  from core.merge_requests m left join private.preview_payloads pp on pp.preview_id=m.preview_id
  where m.org_id=org and ((m.decision='merge' and m.state='accepted' and (center=any(m.affected_center_ids) or pp.payload#>'{snapshot,centers}' ? center::text or pp.payload->>'center_id'=center::text))
   or (m.decision='not_duplicate' and m.state='rejected' and m.decision_center_id=center))
 ), rows as(select * from suggested union all select * from history), visible as materialized(
  select x.*,private.merge_review_person(org,center,actor,x.source_id,x.kind='suggested') source,private.merge_review_person(org,center,actor,x.target_id,x.kind='suggested') target from rows x
 )
 select coalesce(jsonb_agg(jsonb_build_object('source',source,'target',target,'state',kind,'record_id',history_id,'recorded_at',recorded_at,'reason',reason,'matching_kinds',matching_kinds)
  order by kind,recorded_at nulls first,source_id,target_id,history_id),'[]') into raw
 from visible where source is not null and target is not null and (coalesce(k->>'query','')='' or strpos(lower(source->>'display_name'),lower(k->>'query'))>0 or strpos(lower(target->>'display_name'),lower(k->>'query'))>0);
 select coalesce(jsonb_agg(x order by n),'[]') into filtered from jsonb_array_elements(raw) with ordinality v(x,n) where coalesce(k->>'status','suggested')='all' or x->>'state'=coalesce(k->>'status','suggested');
 select jsonb_build_object('total',jsonb_array_length(raw),'filtered',jsonb_array_length(filtered),'by_state',coalesce(jsonb_agg(jsonb_build_object('state',state,'count',n) order by state),'[]')) into summary
 from (select x->>'state' state,count(*) n from jsonb_array_elements(raw) x group by x->>'state') counts;
 result:=private.p06_page(filtered,r->'page',md5(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page')::text),at);
 select coalesce(jsonb_agg(jsonb_build_object('operation','person_merge_preview_v1','entity',jsonb_build_object('type','people','id',x#>'{target,id}'),'exists',true,
  'state',case x->>'state' when 'suggested' then 'pending' when 'completed' then 'accepted' else 'rejected' end,
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',x#>'{source,id}'),'version',x#>'{source,version}'),jsonb_build_object('entity',jsonb_build_object('type','people','id',x#>'{target,id}'),'version',x#>'{target,version}')),
  'as_of',at,'current',jsonb_build_object('operation','person_merge_preview_v1','values',jsonb_build_object('source_id',x#>'{source,id}','target_id',x#>'{target,id}')),'merge_review',x-'record_id') order by n),'[]') into items from jsonb_array_elements(result->'items') with ordinality v(x,n);
 return jsonb_build_object('data',jsonb_set(result,'{items}',items)||jsonb_build_object('merge_review_summary',summary),'primary_id',center,'subject','centers');
end$$;
create function private.merge_review_dismiss(r jsonb,org uuid,center uuid,actor uuid,account uuid,source uuid,target uuid,preview_id uuid,ids uuid[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare item core.merge_requests;why text:=r->>'reason';v bigint;
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if why is null or btrim(why)='' or length(why)>2000 then perform private.fail('VALIDATION_FAILED');end if;
 if private.merge_review_person(org,center,actor,source,false) is null or private.merge_review_person(org,center,actor,target,false) is null then perform private.fail('NOT_FOUND');end if;
 if source=target then perform private.fail('VALIDATION_FAILED');end if;
 insert into core.merge_requests(id,org_id,source_person_id,target_person_id,preview_id,state,decision,decision_center_id,reason,decided_at)
 values(private.new_id(ids,11),org,least(source,target),greatest(source,target),preview_id,'rejected','not_duplicate',center,why,clock_timestamp()) on conflict do nothing;
 select * into item from core.merge_requests m where m.org_id=org and m.decision_center_id=center and m.decision='not_duplicate'
  and least(m.source_person_id,m.target_person_id)=least(source,target) and greatest(m.source_person_id,m.target_person_id)=greatest(source,target);
 if item.id is null then perform private.fail('INTEGRITY_VIOLATION');end if;
 if item.reason is distinct from why then perform private.fail('VERSION_CONFLICT');end if;
 update core.previews p set state='applied',version=p.version+1 where p.org_id=org and p.id=preview_id;
 select p.version into v from core.people p where p.org_id=org and p.id=target;
 return jsonb_build_object('primary_id',target,'version',v,'subject','people','audit_reason',why,'audit',jsonb_build_object('decision','not_duplicate','source_id',source,'target_id',target,'center_id',center,'merge_request_id',item.id));
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p07_merge_management(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$ if op='person_merge_preview_v1' then$a$;
 if strpos(b,a)=0 then raise exception 'Merge review directory anchor drift';end if;
 execute replace(b,a,$a$ if op='person_merge_preview_v1' and k->>'directory'='center' then return private.merge_review_directory(r,org,center,actor,account);
 elsif op='person_merge_preview_v1' then$a$);
 b:=pg_get_functiondef('private.p07_merge(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$ if op='person_merge_preview_v1' then$a$;
 if strpos(b,a)=0 then raise exception 'Merge review preview anchor drift';end if;
 b:=replace(b,a,a||$a$
  if r?'reason' and (r->>'reason' is null or btrim(r->>'reason')='' or length(r->>'reason')>2000) then perform private.fail('VALIDATION_FAILED');end if;
  if coalesce(r->>'decision','merge') not in ('merge','not_duplicate') then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'decision'='not_duplicate' and (r->>'reason' is null or center is null or private.merge_review_person(org,center,actor,source,false) is null or private.merge_review_person(org,center,actor,target,false) is null) then perform private.fail('VALIDATION_FAILED');end if;$a$);
 a:=$a$blocks:=private.p07_merge_conflicts(org,source,target);$a$;
 if array_length(string_to_array(b,a),1)<>3 then raise exception 'Merge review conflict anchors drift';end if;
 -- A nonduplicate review does not transfer account links or reservations.
 b:=replace(b,a,$a$blocks:=case when coalesce(r->>'decision',payload->>'decision')='not_duplicate' then '[]'::jsonb else private.p07_merge_conflicts(org,source,target) end;$a$);
 a:=$a$'authority_hash',private.p07_merge_authority(org,account),'center_id',center);$a$;
 if strpos(b,a)=0 then raise exception 'Merge reason payload anchor drift';end if;
 b:=replace(b,a,$a$'authority_hash',private.p07_merge_authority(org,account),'center_id',center,'reason',r->'reason','decision',coalesce(r->>'decision','merge'));$a$);
 a:=$a$'linked_history',true),'expires_at'$a$;
 if strpos(b,a)=0 then raise exception 'Merge reason summary anchor drift';end if;
 b:=replace(b,a,$a$'linked_history',coalesce(r->>'decision','merge')<>'not_duplicate','reason',r->'reason','decision',coalesce(r->>'decision','merge')),'expires_at'$a$);
 a:=$a$'reason','merge alias; history IDs and center ownership retained'$a$;
 if strpos(b,a)=0 then raise exception 'Merge decision effect description drift';end if;
 b:=replace(b,a,$a$'reason',case when r->>'decision'='not_duplicate' then 'Mark this pair as not duplicate in this center; no identity or history transfer' else 'merge alias; history IDs and center ownership retained' end$a$);
 a:=$a$case when ref.tab='resource_bookings' then ' and x.state=''active''' else '' end$a$;
 if strpos(b,a)=0 then raise exception 'Merge inactive availability history drift';end if;
 b:=replace(b,a,$a$' and x.state=''active'''$a$);
 a:=$a$'required_approval_center_ids',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements_text(snap->'centers') x where not private.is_manager(org,actor,x::uuid))$a$;
 if strpos(b,a)=0 then raise exception 'Merge decision approvals anchor drift';end if;
 b:=replace(b,a,$a$'required_approval_center_ids',case when r->>'decision'='not_duplicate' then '[]'::jsonb else (select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements_text(snap->'centers') x where not private.is_manager(org,actor,x::uuid)) end$a$);
 a:=$a$ blocks:=case when coalesce(r->>'decision',payload->>'decision')='not_duplicate' then '[]'::jsonb else private.p07_merge_conflicts(org,source,target) end;if jsonb_array_length(blocks)>0$a$;
 if strpos(b,a)=0 then raise exception 'Merge decision apply anchor drift';end if;
 b:=replace(b,a,$a$ if r?'reason' and r->>'reason' is distinct from payload->>'reason' then perform private.fail('PREVIEW_STALE');end if;
 if payload->>'decision'='not_duplicate' then
  if op<>'person_merge_apply_v1' then perform private.fail('VALIDATION_FAILED');end if;
  if center is distinct from (payload->>'center_id')::uuid then perform private.fail('FORBIDDEN');end if;
  return private.merge_review_dismiss(jsonb_build_object('reason',payload->'reason'),org,(payload->>'center_id')::uuid,actor,account,source,target,preview.id,ids);
 end if;
 blocks:=private.p07_merge_conflicts(org,source,target);if jsonb_array_length(blocks)>0$a$);
 a:=$a$insert into core.merge_requests(id,org_id,source_person_id,target_person_id,preview_id,state) values(private.new_id(ids,11),org,source,target,preview.id,'pending')$a$;
 if strpos(b,a)=0 then raise exception 'Merge reason durable record drift';end if;
 b:=replace(b,a,$a$insert into core.merge_requests(id,org_id,source_person_id,target_person_id,preview_id,state,reason,decision_center_id,affected_center_ids) values(private.new_id(ids,11),org,source,target,preview.id,'pending',payload->>'reason',center,array(select x::uuid from jsonb_array_elements_text(snap->'centers') x))$a$);
 a:=$a$update core.merge_requests set state='accepted',version=version+1 where id=req.id;$a$;
 if strpos(b,a)=0 then raise exception 'Merge completion time drift';end if;
 b:=replace(b,a,$a$update core.merge_requests set state='accepted',decided_at=clock_timestamp(),version=version+1 where id=req.id;$a$);
 a:=$a$return jsonb_build_object('primary_id',target,'version',vtarget,'subject','people');$a$;
 if strpos(b,a)=0 then raise exception 'Merge reason audit result drift';end if;
 b:=replace(b,a,$a$return jsonb_build_object('primary_id',target,'version',vtarget,'subject','people','audit_reason',payload->>'reason','audit',jsonb_build_object('source_id',source,'target_id',target,'merge_request_id',req.id));$a$);
 execute b;
 b:=pg_get_functiondef('private.merge_approval_discovery(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$  ticket:=private.merge_approval_ticket(org,pv.id,account,c);$a$;
 if strpos(b,a)=0 then raise exception 'Nonduplicate approval discovery drift';end if;
 b:=replace(b,a,$a$  if exists(select 1 from private.preview_payloads p where p.preview_id=pv.id and p.payload->>'decision'='not_duplicate') then continue;end if;
$a$||a);
 a:=$a$'linked_history',true,$a$;
 if strpos(b,a)=0 then raise exception 'Merge approval reason drift';end if;
 b:=replace(b,a,$a$'linked_history',true,'reason',pp.payload->'reason',$a$);
 execute b;
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$terms:=private.p07_merge(p_operation,r,org,center,person,actor.id,operation_id,p_ids,p_aux);$a$;
 if strpos(b,a)=0 then raise exception 'Merge audit domain anchor drift';end if;
 b:=replace(b,a,a||$a$audit_delta:=terms->'audit';$a$);
 a:=$a$,r->>'reason',operation_id,audit_delta$a$;
 if strpos(b,a)=0 then raise exception 'Merge immutable audit reason drift';end if;
 b:=replace(b,a,$a$,case when p_operation='person_merge_apply_v1' then terms->>'audit_reason' else r->>'reason' end,operation_id,audit_delta$a$);
 execute b;
end$patch$;
revoke all on function private.merge_review_person(uuid,uuid,uuid,uuid,boolean),private.merge_review_directory(jsonb,uuid,uuid,uuid,uuid),private.merge_review_dismiss(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.merge_review_person(uuid,uuid,uuid,uuid,boolean),private.merge_review_directory(jsonb,uuid,uuid,uuid,uuid),private.merge_review_dismiss(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid[]) to service_role;
notify pgrst,'reload schema';
-- One canonical visible person per row, including people without any link.
-- The legacy link-record directory remains unchanged.
create function private.account_person_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare k jsonb:=r#>'{selector,key}';raw jsonb;filtered jsonb;result jsonb;items jsonb;summary jsonb;at timestamptz:=clock_timestamp();
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 perform private.assert_center(org,center);
 if private.access_mode(org)='bootstrap' then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
 if private.access_mode(org)='closed' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if k->>'directory' is distinct from 'center' or k->>'view' is distinct from 'people' or coalesce(k->>'status','all') not in ('linked','unlinked','all') then perform private.fail('VALIDATION_FAILED');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb then perform private.fail('VALIDATION_FAILED');end if;
 with eligible as materialized(
  select p.id,p.version,p.created_at,private.directory_person_name(org,center,actor,p.id) display_name
  from core.people p where p.org_id=org and p.merged_into_id is null
   and (exists(select 1 from private.person_center_relationships x where x.org_id=org and x.center_id=center and private.p07_same_person(org,x.person_id,p.id))
    or exists(select 1 from core.invitations x where x.org_id=org and x.center_id=center and private.p07_same_person(org,x.person_id,p.id))
    or exists(select 1 from core.role_assignments x where x.org_id=org and private.p07_same_person(org,x.person_id,p.id) and (x.scope_center_id=center or x.scope_center_id is null)))
 ), rows as(
  select p.*,l.id link_id,l.version link_version from eligible p left join lateral(
   select x.id,x.version from core.account_links x where x.org_id=org and x.state='active' and private.p07_same_person(org,x.person_id,p.id) order by x.created_at,x.id limit 1
  ) l on true where p.display_name is not null and (k->>'query' is null or strpos(lower(p.display_name),lower(k->>'query'))>0)
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'created_at',created_at,'display_name',display_name,'link_id',link_id,'link_version',link_version,
  'status',case when link_id is null then 'unlinked' else 'linked' end) order by created_at,id),'[]') into raw from rows;
 select coalesce(jsonb_agg(x order by n),'[]') into filtered from jsonb_array_elements(raw) with ordinality a(x,n) where coalesce(k->>'status','all')='all' or x->>'status'=k->>'status';
 select jsonb_build_object('total',jsonb_array_length(raw),'filtered',jsonb_array_length(filtered),'by_state',coalesce(jsonb_agg(jsonb_build_object('state',state,'count',n) order by state),'[]')) into summary
 from(select x->>'status' state,count(*) n from jsonb_array_elements(raw) x group by x->>'status') counts;
 result:=private.p06_page(filtered,r->'page',md5(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page')::text),at);
 select coalesce(jsonb_agg(case when x->>'link_id' is not null then private.access_directory_item('account_link_remove_v1',org,center,actor,account,(x->>'link_id')::uuid,at)
  else jsonb_build_object('operation','account_link_remove_v1','entity',jsonb_build_object('type','people','id',x->'id'),'exists',true,'state','inactive',
   'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',x->'id'),'version',x->'version')),'as_of',at,
   'current',jsonb_build_object('operation','account_link_remove_v1','values',jsonb_build_object('person_id',x->'id','actionable',false))) end
  ||jsonb_build_object('access_detail',jsonb_build_object('kind','person_account','person_id',x->'id','display_name',x->'display_name','created_at',x->'created_at','linked',x->>'link_id' is not null,'can_send_invitation',private.directory_resend_allowed(org,center,actor,(x->>'id')::uuid))) order by n),'[]') into items from jsonb_array_elements(result->'items') with ordinality a(x,n);
 return jsonb_build_object('data',jsonb_set(result,'{items}',items)||jsonb_build_object('access_summary',summary),'subject','people');
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.p07_revoke_management(jsonb,uuid,uuid,uuid)'::regprocedure);a text;
begin
 a:=$a$ if k->>'directory' is distinct from 'center' then$a$;
 if strpos(b,a)=0 then raise exception 'Account person directory anchor drift';end if;
 execute replace(b,a,$a$ if op='account_link_remove_v1' and k->>'view'='people' then
  select l.account_id into account from core.account_links l where l.org_id=org and l.person_id=actor and l.state='active' and l.verified_at is not null;
  return private.account_person_directory(r,org,center,actor,account);
 end if;
$a$||a);
 -- Invitation lifecycle groups are evaluated before pagination, using effective expiry.
 b:=pg_get_functiondef('private.p07_revoke_management(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=$a$where k->>'status' is null or state=k->>'status'$a$;
 if strpos(b,a)=0 then raise exception 'Invitation grouped status anchor drift';end if;
 execute replace(b,a,$a$where k->>'status' is null or k->>'status'='all' or state=k->>'status' or (op='account_access_revoke_v1' and ((k->>'status'='open' and state='pending') or (k->>'status'='closed' and state in ('expired','accepted','revoked'))))$a$);
end$patch$;
revoke all on function private.account_person_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.account_person_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;
-- Two selected merge records can reuse the exact page-summary semantics,
-- without guessing currencies or fetching their reservation histories.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=$a$ if p_operation='people_list_v1' and coalesce((r->>'include_member_summary')::boolean,false) then$a$;
 if strpos(b,a)=0 then raise exception 'Selected person summary anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation='person_get_v1' and coalesce((r->>'include_member_summary')::boolean,false) then
  if center is null then perform private.fail('VALIDATION_FAILED');end if;
  out:=out||jsonb_build_object('member_summary',private.member_page_summary(org,center,person,(r->>'person_id')::uuid));
 end if;
$a$||a);
 execute b;
end$patch$;
commit;
