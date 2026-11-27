begin;

-- Both permission readers use the existing writable cells and native grant calculation.
create function private.team_permission_overrides(
 org uuid,center uuid,target uuid,target_staff boolean,target_instructor boolean,target_manager boolean
) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'permission',p.code,'override_exists',o.id is not null,'enabled',o.enabled,'override_version',o.version,
  'effective_staff_grant',coalesce(private.staff_grant($1,$3,$2,p.code),false)
 ) order by p.position),'[]'::jsonb)
 from unnest(private.settable_team_permissions()) with ordinality p(code,position)
 left join core.permission_overrides o on o.org_id=$1 and o.center_id=$2 and o.person_id=$3 and o.permission=p.code
 where $4 or ($5 and p.code<>'reservation.capacity_override') or ($6 and p.code='sale.discount')
$$;

create function private.team_permission_matrix(r jsonb,org uuid,center uuid,account uuid,actor uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 lim integer:=coalesce((r#>>'{page,limit}')::integer,50);
 scope_hash text:=encode(extensions.digest(jsonb_build_object(
  'account',account,'actor',actor,'request',r-'page'-'request_id'
 )::text,'sha256'),'hex');
 read_at timestamptz:=statement_timestamp();
 asof timestamptz:=read_at;
 cur jsonb;
 last_at timestamptz;
 last_id uuid;
 items jsonb;
 next_cursor text;
begin
 if lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then
  perform private.fail('VALIDATION_FAILED');
 end if;
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   last_at:=(cur->>'at')::timestamptz;
   last_id:=(cur->>'id')::uuid;
   asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from scope_hash or last_at is null or last_id is null
     or asof is null or not isfinite(last_at) or not isfinite(asof) or last_at>asof or asof>read_at then
    perform private.fail('VALIDATION_FAILED');
   end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;

 -- Match has_role's active verified link. Page people before expanding permission cells.
 with bounded as materialized(
  select p.id,p.created_at,p.version,array_agg(a.role order by a.role) roles
  from core.role_assignments a
  join core.account_links l on l.id=a.account_link_id and l.org_id=a.org_id and l.person_id=a.person_id
   and l.state='active' and l.verified_at is not null
  join core.people p on p.org_id=a.org_id and p.id=a.person_id
  where a.org_id=org and a.scope_center_id=center and a.state='active'
   and a.role in ('center_manager','staff','instructor')
   and p.state='active' and p.merged_into_id is null and p.created_at<=asof
   and (cur is null or (p.created_at,p.id)>(last_at,last_id))
  group by p.id,p.created_at,p.version
  order by p.created_at,p.id limit lim+1
 ), selected as materialized(
  select b.*,jsonb_build_object('type','people','id',b.id) entity
  from bounded b order by b.created_at,b.id limit lim
 )
 select coalesce((
  select jsonb_agg(jsonb_build_object(
   'operation','permission_set_v1','entity',s.entity,'exists',true,'state','active','as_of',read_at,
   'versions',jsonb_build_array(jsonb_build_object('entity',s.entity,'version',s.version)),
   'current',jsonb_build_object('operation','permission_set_v1','values',jsonb_build_object(
    'person_id',s.id,'display_name',private.directory_person_name(org,center,actor,s.id),'team_roles',s.roles,
    'permission_overrides',(
     select coalesce(jsonb_agg(c.cell||'{"writable":true}'::jsonb order by c.position),'[]'::jsonb)
     from jsonb_array_elements(private.team_permission_overrides(org,center,s.id,
      'staff'=any(s.roles),'instructor'=any(s.roles),'center_manager'=any(s.roles)
     )) with ordinality c(cell,position)
    )
   ))
  ) order by s.created_at,s.id) from selected s
 ),'[]'::jsonb),case when (select count(*) from bounded)>lim then (
  select encode(convert_to(jsonb_build_object('scope',scope_hash,'id',s.id,'at',s.created_at,'as_of',asof)::text,'utf8'),'hex')
  from selected s order by s.created_at desc,s.id desc limit 1
 ) end into items,next_cursor;
 return jsonb_build_object('items',items,'next_cursor',next_cursor,'as_of',read_at);
end$$;

do $patch$
declare
 body text:=pg_get_functiondef('private.permission_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean)'::regprocedure);
 anchor text;
begin
 anchor:=$a$ if center is null or r->>'operation' is distinct from op$a$;
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Team permission selector anchor drift';end if;
 body:=replace(body,anchor,$a$ if k->>'directory'='center' then
  if center is null or r->>'operation' is distinct from op or r#>>'{selector,operation}' is distinct from op
    or coalesce(r->'entity','null'::jsonb)<>'null'::jsonb or k<>'{"directory":"center"}'::jsonb then
   perform private.fail('VALIDATION_FAILED');
  end if;
  perform private.management_center_command_authorize(op,jsonb_build_object('org_id',org,'center_id',center),
   org,center,account,auth_id,session_id,person,owner,cm);
  return private.team_permission_matrix(r,org,center,account,person);
 end if;
$a$||anchor);
 anchor:=$a$  select jsonb_build_object('person_id',target,'permission_overrides',$a$;
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Team permission summary anchor drift';end if;
 execute overlay(body placing $a$  vals:=jsonb_build_object('person_id',target,'permission_overrides',
   private.team_permission_overrides(org,center,target,target_staff,target_instructor,target_manager));
$a$ from strpos(body,anchor) for strpos(body,$a$ else
  select * into choice$a$)-strpos(body,anchor));
end$patch$;

revoke all on function private.team_permission_overrides(uuid,uuid,uuid,boolean,boolean,boolean),
 private.team_permission_matrix(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.team_permission_overrides(uuid,uuid,uuid,boolean,boolean,boolean),
 private.team_permission_matrix(jsonb,uuid,uuid,uuid,uuid) to service_role;

commit;
