begin;

-- Unfinished follow-ups inherit their assignee from the open CRM lead.
create function private.staff_revoke_impact(org uuid,center uuid,target uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with open_leads as materialized (
  select l.id,l.person_id,l.version from core.leads l
  where l.org_id=$1 and l.center_id=$2 and l.assigned_person_id=$3 and l.state='open'
   and not private.is_manager($1,$3,$2)
 )
 select jsonb_build_object(
  'lost_permissions',coalesce((
   select jsonb_agg(p.code order by p.position)
   from unnest(private.settable_team_permissions()) with ordinality p(code,position)
   where not private.is_manager($1,$3,$2)
    and case p.code
     when 'invite.student' then private.current_plan_name($1)<>'starter'
      and private.has_role($1,$3,'staff',$2)
      and not exists(select 1 from core.permission_overrides o
       where o.org_id=$1 and o.center_id=$2 and o.person_id=$3 and o.permission=p.code and not o.enabled)
     when 'sale.discount' then private.staff_grant($1,$3,$2,'sale.write')
      and private.staff_grant($1,$3,$2,p.code)
     else private.staff_grant($1,$3,$2,p.code)
    end
  ),'[]'::jsonb),
  'open_leads',coalesce((
   select jsonb_agg(jsonb_build_object('lead_id',l.id,'person_id',l.person_id,'version',l.version,
    'followups',coalesce((
     select jsonb_agg(jsonb_build_object('activity_id',f.id,'version',f.version,'due_at',f.due_at)
      order by f.due_at,f.id)
     from core.crm_activities f
     where f.org_id=$1 and f.center_id=$2 and f.lead_id=l.id and f.kind='followup' and f.completed_at is null
    ),'[]'::jsonb)) order by l.id) from open_leads l
  ),'[]'::jsonb),
  'handover_required',exists(select 1 from open_leads),
  'recipients',coalesce((
   select jsonb_agg(jsonb_build_object('person_id',p.id,'display_name',p.display_name) order by p.id)
   from core.people p
   where exists(select 1 from open_leads) and p.org_id=$1 and p.id<>$3
    and p.state='active' and p.merged_into_id is null
    and private.p04_can_lead($1,$2,p.id,p.id)
    and exists(select 1 from core.role_assignments r
     where r.org_id=$1 and r.scope_center_id=$2 and r.person_id=p.id and r.role in ('center_manager','staff')
      and private.role_account_access_granted($1,r.id))
  ),'[]'::jsonb)
 )
$$;

create function private.staff_revoke_preview(r jsonb,org uuid,center uuid,account uuid,ids uuid[],aux jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare
 a core.role_assignments;
 impact jsonb;
 pid uuid:=private.new_id(ids,2);
 token text:=aux->>'token';
 expires timestamptz:=clock_timestamp()+interval '15 minutes';
 result jsonb;
begin
 select * into a from core.role_assignments q where q.org_id=org and q.scope_center_id=center
  and q.id=(r->>'assignment_id')::uuid and q.state='active' and q.role='staff' for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 if a.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if token is null then perform private.fail('INTEGRITY_VIOLATION');end if;
 impact:=private.staff_revoke_impact(org,center,a.person_id);
 if (impact->>'handover_required')::boolean then perform private.require_feature(org,'F21');end if;
 result:=jsonb_build_object('id',pid,'token',token,'expires_at',expires,'assignment_id',a.id,
  'assignment_version',a.version,'sessions','[]'::jsonb,'staff_impact',impact);
 insert into core.previews(id,org_id,operation,actor_account_id,scope_hash,dependencies,result,state)
 values(pid,org,'role_revoke_v1',account,md5(jsonb_build_array(org,center,account,a.id)::text),
  jsonb_build_object('assignment_version',a.version,'impact',impact,'authority',private.p07_merge_authority(org,account)),
  result-'token','current');
 insert into private.preview_payloads(preview_id,payload,expires_at,token_hash)
 values(pid,jsonb_build_object('kind','staff_role_revoke','center_id',center,'assignment_id',a.id),
  expires,encode(extensions.digest(token,'sha256'),'hex'));
 return result;
end$$;

create function private.staff_revoke_effect(r jsonb,org uuid,center uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare
 a core.role_assignments;
 impact jsonb;
 preview core.previews;
 payload private.preview_payloads;
 recipient uuid:=(r->>'handover_person_id')::uuid;
 moved jsonb;
begin
 select * into a from core.role_assignments q where q.org_id=org and q.scope_center_id=center
  and q.id=(r->>'assignment_id')::uuid and q.state='active' and q.role='staff' for update;
 if not found then
  if recipient is not null then perform private.fail('VALIDATION_FAILED');end if;
  return '{}'::jsonb;
 end if;
 if a.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;

 -- The dispatcher holds the same organization lock as CRM, role and permission writes.
 impact:=private.staff_revoke_impact(org,center,a.person_id);
 if (impact->>'handover_required')::boolean or r?'impact_approval' then
  select * into preview from core.previews p where p.org_id=org and p.id=(r#>>'{impact_approval,id}')::uuid for update;
  select * into payload from private.preview_payloads p where p.preview_id=preview.id;
  if preview.id is null or preview.operation<>'role_revoke_v1' or preview.actor_account_id<>account
   or preview.state<>'current' or payload.expires_at<=clock_timestamp()
   or payload.token_hash is distinct from encode(extensions.digest(r#>>'{impact_approval,token}','sha256'),'hex')
   or payload.payload is distinct from jsonb_build_object('kind','staff_role_revoke','center_id',center,'assignment_id',a.id)
   or preview.dependencies is distinct from jsonb_build_object('assignment_version',a.version,'impact',impact,
    'authority',private.p07_merge_authority(org,account)) then perform private.fail('PREVIEW_STALE');end if;
 end if;
 if (impact->>'handover_required')::boolean then
  perform private.require_feature(org,'F21');
  if recipient is null then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  if not (impact->'recipients' @> jsonb_build_array(jsonb_build_object('person_id',recipient))) then
   perform private.fail('FORBIDDEN');
  end if;
  with updated as (
   update core.leads l set assigned_person_id=recipient,version=l.version+1
   from jsonb_array_elements(impact->'open_leads') as w(item)
   where l.org_id=org and l.center_id=center and l.id=(w.item->>'lead_id')::uuid and l.state='open'
    and l.assigned_person_id=a.person_id and l.version=(w.item->>'version')::bigint
   returning l.id,l.version
  )
  select coalesce(jsonb_agg(jsonb_build_object('lead_id',id,'version',version) order by id),'[]'::jsonb)
  into moved from updated;
  if jsonb_array_length(moved)<>jsonb_array_length(impact->'open_leads') then perform private.fail('PREVIEW_STALE');end if;
 elsif recipient is not null then
  perform private.fail('VALIDATION_FAILED');
 end if;
 if preview.id is not null then update core.previews set state='applied',version=version+1 where id=preview.id;end if;
 if moved is null then return '{}'::jsonb;end if;
 return jsonb_build_object('staff_handover',jsonb_build_object(
  'from_person_id',a.person_id,'to_person_id',recipient,'leads',moved));
end$$;

do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text;
begin
 anchor:=$a$  out:=private.instructor_revoke_preview(r,org,center,actor.id,p_ids,p_aux);$a$;
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Staff revoke preview anchor drift';end if;
 body:=replace(body,anchor,$a$  if exists(select 1 from core.role_assignments a
   where a.org_id=org and a.scope_center_id=center and a.id=(r->>'assignment_id')::uuid and a.state='active' and a.role='staff') then
   out:=private.staff_revoke_preview(r,org,center,actor.id,p_ids,p_aux);
  else
$a$||anchor||E'\n  end if;');
 anchor:=$a$   audit_delta:=coalesce(audit_delta,'{}'::jsonb)||private.instructor_revoke_effect(r,org,center,actor.id,p_ids);$a$;
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Staff revoke effect anchor drift';end if;
 execute replace(body,anchor,anchor||E'\n'||$a$   audit_delta:=coalesce(audit_delta,'{}'::jsonb)||private.staff_revoke_effect(r,org,center,actor.id);$a$);
end$patch$;

revoke all on function private.staff_revoke_impact(uuid,uuid,uuid),
 private.staff_revoke_preview(jsonb,uuid,uuid,uuid,uuid[],jsonb),
 private.staff_revoke_effect(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.staff_revoke_impact(uuid,uuid,uuid),
 private.staff_revoke_preview(jsonb,uuid,uuid,uuid,uuid[],jsonb),
 private.staff_revoke_effect(jsonb,uuid,uuid,uuid) to service_role;

commit;
