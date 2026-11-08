begin;
-- This capability authorizes only the selected manager's approval. It never
-- exposes the creator's original preview/apply token retained by p06 tracking.
create function private.merge_approval_ticket(org uuid,pid uuid,account uuid,center uuid) returns text language plpgsql stable security invoker set search_path='' as $$
declare pv core.previews;pp private.preview_payloads;actor uuid;snap jsonb;
begin
 actor:=private.person_for(org,account);
 if actor is null or not private.is_manager(org,actor,center) or not private.center_accessible(org,center) then return null;end if;
 select * into pv from core.previews p where p.org_id=org and p.id=pid and p.operation='person_merge_preview_v1' and p.state='current';
 if pv.id is null then return null;end if;
 select * into pp from private.preview_payloads where preview_id=pid;
 if pp.expires_at is null or pp.expires_at<=statement_timestamp() then return null;end if;
 snap:=private.p07_merge_snapshot(org,(pp.payload->>'source_id')::uuid,(pp.payload->>'target_id')::uuid);
 if not snap->'centers'?center::text or snap->>'hash' is distinct from pp.payload#>>'{snapshot,hash}' or
  private.p07_merge_authority(org,pv.actor_account_id) is distinct from pp.payload->>'authority_hash' then return null;end if;
 if jsonb_array_length(private.p07_merge_conflicts(org,(pp.payload->>'source_id')::uuid,(pp.payload->>'target_id')::uuid))>0 then return null;end if;
 return encode(extensions.hmac(convert_to(jsonb_build_array('person_merge_approve_v1:v1',org,pid,account,center,private.p07_merge_authority(org,account),extract(epoch from pp.expires_at))::text,'UTF8'),decode(pp.token_hash,'hex'),'sha256'),'hex');
end$$;
create function private.merge_approval_discovery(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare k jsonb:=r#>'{selector,key}';c uuid:=(k->>'approval_center_id')::uuid;pv core.previews;pp private.preview_payloads;ticket text;item jsonb;items jsonb:='[]';result jsonb;approvals jsonb;versions jsonb;at timestamptz:=clock_timestamp();
begin
 if r->>'operation'<>'person_merge_approve_v1' or r#>>'{selector,operation}'<>'person_merge_approve_v1' or c is null then perform private.fail('VALIDATION_FAILED');end if;
 if not private.is_manager(org,actor,c) or (center is not null and center<>c) then perform private.fail('FORBIDDEN');end if;
 perform private.assert_center(org,c);
 for pv in select * from core.previews p where p.org_id=org and p.operation='person_merge_preview_v1' and (k->>'preview_id' is null or p.id=(k->>'preview_id')::uuid) order by p.created_at,p.id loop
  ticket:=private.merge_approval_ticket(org,pv.id,account,c);
  if ticket is null then
   if k->>'preview_id' is not null then perform private.fail('PREVIEW_STALE');end if;continue;
  end if;
  select * into pp from private.preview_payloads where preview_id=pv.id;
  if r->'entity' is not null and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type','people','id',pp.payload->'target_id') then continue;end if;
  select coalesce(jsonb_agg(jsonb_build_object('center_id',x,'approved',exists(
   select 1 from core.merge_requests mr join core.merge_approvals a on a.org_id=mr.org_id and a.merge_request_id=mr.id join private.p07_merge_approval_context ac on ac.approval_id=a.id
   where mr.org_id=org and mr.preview_id=pv.id and a.center_id=x::uuid and a.scope_hash=pp.payload#>>'{snapshot,hash}'
    and private.person_for(org,ac.account_id)=a.approver_person_id and private.is_manager(org,a.approver_person_id,a.center_id) and ac.authority_hash=private.p07_merge_authority(org,ac.account_id))) order by x),'[]') into approvals
   from jsonb_array_elements_text(pp.payload#>'{snapshot,centers}') x where not private.is_manager(org,private.person_for(org,pv.actor_account_id),x::uuid);
  select jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','people','id',p.id),'version',p.version) order by p.id) into versions from core.people p where p.org_id=org and p.id in ((pp.payload->>'source_id')::uuid,(pp.payload->>'target_id')::uuid);
  item:=jsonb_build_object('operation','person_merge_approve_v1','entity',jsonb_build_object('type','people','id',pp.payload->'target_id'),'exists',true,'state','current','versions',versions,
   'current',jsonb_build_object('operation','person_merge_approve_v1','values',jsonb_build_object('approval_center_id',c)),
   'merge_approval',jsonb_build_object('source_id',pp.payload->'source_id','target_id',pp.payload->'target_id','approval_center_id',c,'preview',jsonb_build_object('id',pv.id,'token',ticket),'expires_at',pp.expires_at,'affected_center_ids',pp.payload#>'{snapshot,centers}','required_approvals',approvals,'linked_history',true,
    'effects',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',pp.payload->'source_id'),'action','adjust','reason','merge alias; history IDs and center ownership retained'))));
  items:=items||jsonb_build_array(item);
 end loop;
 if k->>'preview_id' is not null and jsonb_array_length(items)=0 then perform private.fail('NOT_FOUND');end if;
 result:=private.p06_page(items,r->'page',md5(jsonb_build_object('account',account,'request',r-'page'-'request_id')::text),at);
 select coalesce(jsonb_agg(x||jsonb_build_object('as_of',at) order by n),'[]') into items from jsonb_array_elements(result->'items') with ordinality a(x,n);
 return jsonb_build_object('data',jsonb_set(result,'{items}',items),'primary_id',c,'subject','centers');
end$$;
do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p07_merge_management(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:=$a$ elsif op='person_merge_approve_v1' then
  select * into pv from core.previews p where p.org_id=org and p.id=(k->>'preview_id')::uuid and p.operation='person_merge_preview_v1';
  if not found then perform private.fail('NOT_FOUND');end if;
  select p.payload into payload from private.preview_payloads p where p.preview_id=pv.id;
  source:=(payload->>'source_id')::uuid;target:=(payload->>'target_id')::uuid;c:=(k->>'approval_center_id')::uuid;
  if not private.is_manager(org,actor,c) or (center is not null and center<>c) or not (private.p07_merge_snapshot(org,source,target)->'centers' ? c::text) then perform private.fail('FORBIDDEN');end if;
  vals:=jsonb_build_object('approval_center_id',c);
$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Merge approval discovery dispatch drift';end if;
 execute replace(body,anchor,$a$ elsif op='person_merge_approve_v1' then return private.merge_approval_discovery(r,org,center,actor,account);
$a$);
 body:=pg_get_functiondef('private.p07_merge_access(text,jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:=$a$v.token_hash=encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex')$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Merge approval capability guard drift';end if;
 execute replace(body,anchor,'('||anchor||$a$ or (op='person_merge_approve_v1' and r#>>'{preview,token}'=private.merge_approval_ticket(org,p.id,account,(r->>'approval_center_id')::uuid)))$a$);
end$patch$;
revoke all on function private.merge_approval_ticket(uuid,uuid,uuid,uuid),private.merge_approval_discovery(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.merge_approval_ticket(uuid,uuid,uuid,uuid),private.merge_approval_discovery(jsonb,uuid,uuid,uuid,uuid) to service_role;
commit;
