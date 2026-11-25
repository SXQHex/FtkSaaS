begin;

-- Both account directory views use the same canonical center membership.
create function private.account_directory_center_roots(org uuid,center uuid)
returns table(id uuid) language sql stable security invoker set search_path='' as $$
 select distinct case when p.merged_into_id is null then p.id else private.p07_person_root($1,p.id) end
 from (
  select x.person_id from private.person_center_relationships x where x.org_id=$1 and x.center_id=$2
  union select x.person_id from core.invitations x where x.org_id=$1 and x.center_id=$2
  union select x.person_id from core.role_assignments x where x.org_id=$1 and (x.scope_center_id=$2 or x.scope_center_id is null)
 ) scope join core.people p on p.org_id=$1 and p.id=scope.person_id
$$;
revoke all on function private.account_directory_center_roots(uuid,uuid) from public,anon,authenticated;
grant execute on function private.account_directory_center_roots(uuid,uuid) to service_role;

do $patch$
declare body text;anchor text;first_pos integer;last_pos integer;
begin
 body:=pg_get_functiondef('private.account_person_directory(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:='at timestamptz:=clock_timestamp();';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Person directory declaration anchor drift';end if;
 body:=replace(body,anchor,anchor||' starter boolean;org_reader boolean;names_enabled boolean;actor_root uuid;');
 first_pos:=strpos(body,' with center_people as materialized(');
 last_pos:=strpos(body,' ), links as materialized(');
 if first_pos=0 or last_pos<=first_pos then raise exception 'Person directory membership anchors drift';end if;
 body:=overlay(body placing $a$ starter:=private.current_plan_name(org)='starter';
 if not starter then
  org_reader:=private.is_org_reader(org,actor);
  actor_root:=private.p07_person_root(org,actor);
  names_enabled:=private.member_summary_enabled(org,array['person_get_v1'],jsonb_build_object('org_id',org,'center_id',center));
 end if;
 with roots as materialized(
  select x.id from private.account_directory_center_roots(org,center) x
$a$ from first_pos for last_pos-first_pos);
 anchor:=$a$private.directory_person_name(org,center,actor,p.id) display_name$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Person directory projection anchor drift';end if;
 -- Starter keeps its per-person plan checks in the existing projection.
 body:=replace(body,anchor,$a$case
   when starter is distinct from false then private.directory_person_name(org,center,actor,p.id)
   when not names_enabled then null
   when org_reader or p.id=actor_root then p.display_name
   when private.person_operational_scope_matches(org,center,p.id,true) then p.display_name
   when private.person_assigned_access(org,actor,center,p.id) then p.display_name
   end display_name$a$);
 anchor:=$a$  select x.id,x.version,x.created_at,private.p07_person_root(org,x.person_id) person_id from core.account_links x where x.org_id=org and x.state='active'$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Person directory active link anchor drift';end if;
 body:=replace(body,anchor,$a$  select distinct on (x.person_id) x.id,x.version,x.person_id
  from (
   select l.id,l.version,l.created_at,case when p.merged_into_id is null then p.id else private.p07_person_root(org,p.id) end person_id
   from core.account_links l join core.people p on p.org_id=l.org_id and p.id=l.person_id
   where l.org_id=org and l.state='active'
  ) x
  order by x.person_id,x.created_at,x.id$a$);
 anchor:=$a$from eligible p left join lateral(
   select x.id,x.version from links x where x.person_id=p.id order by x.created_at,x.id limit 1
  ) l on true$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Person directory link join anchor drift';end if;
 execute replace(body,anchor,'from eligible p left join links l on l.person_id=p.id');

 body:=pg_get_functiondef('private.p07_revoke_management(jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor:=' with eligible as materialized(';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Link directory CTE anchor drift';end if;
 body:=replace(body,anchor,$a$ with link_roots as materialized (
  select x.id from private.account_directory_center_roots(org,center) x where op='account_link_remove_v1'
 ), eligible as materialized($a$);
 first_pos:=strpos(body,$a$    and (exists(select 1 from private.person_center_relationships x where x.org_id=org and x.center_id=center and private.p07_same_person(org,x.person_id,l.person_id))$a$);
 last_pos:=strpos(substr(body,first_pos),$a$    and (k->>'query' is null or strpos(lower(private.directory_person_name(org,center,actor,l.person_id)),lower(k->>'query'))>0)$a$);
 if first_pos=0 or last_pos<=1 then raise exception 'Link directory membership anchors drift';end if;
 execute overlay(body placing $a$    and exists(select 1 from link_roots x where x.id=p.id)
$a$ from first_pos for last_pos-1);
end$patch$;

commit;
