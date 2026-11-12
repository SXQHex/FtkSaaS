begin;
-- Both audiences consume the same per-field consent and current media pointer.
create function private.sharing_peer_profile(org uuid,center uuid,account uuid,person uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$
 select jsonb_build_object('person_id',$4)
 ||case when private.sharing_allowed($1,$2,$3,$4,'profile_visible') then jsonb_build_object('display_name',private.p07_profile($3)) else '{}'::jsonb end
 ||case when private.sharing_allowed($1,$2,$3,$4,'photo_visible') and private.settings_media_asset('user:'||$3) is not null
  then jsonb_build_object('photo',private.settings_media_asset('user:'||$3)) else '{}'::jsonb end
 ||case when private.sharing_allowed($1,$2,$3,$4,'email_visible') and private.account_identity_view($3)->>'email' is not null
  then jsonb_build_object('email',private.account_identity_view($3)->>'email') else '{}'::jsonb end
 ||case when private.sharing_allowed($1,$2,$3,$4,'phone_visible') and private.account_identity_view($3)->>'phone' is not null
  then jsonb_build_object('phone',private.account_identity_view($3)->>'phone') else '{}'::jsonb end
$$;
create or replace function private.session_shared_participants(org uuid,session uuid,viewer uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$
 with audience as(select s.id,s.center_id from core.sessions s where s.org_id=$1 and s.id=$2 and s.state='planned' and s.ends_at>clock_timestamp()
  and exists(select 1 from core.reservations r where r.org_id=$1 and r.session_id=s.id and r.person_id=$3 and r.state='active')),
 members as(select distinct p.id,a.id account_id,s.center_id from audience s
  join core.reservations r on r.org_id=$1 and r.session_id=s.id and r.state='active'
  join core.people p on p.org_id=$1 and p.id=r.person_id and p.state='active'
  join core.account_links l on l.org_id=$1 and l.person_id=p.id and l.state='active' and l.verified_at is not null
  join core.accounts a on a.id=l.account_id and a.state='active' where p.id<>$3),
 fields as(select m.id,private.sharing_peer_profile($1,m.center_id,m.account_id,m.id) item from members m)
 select coalesce(jsonb_agg(item order by id) filter(where item-'person_id'<>'{}'::jsonb),'[]'::jsonb) from fields
$$;
create function private.event_shared_participants(org uuid,event uuid,viewer uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$
 with audience as(select e.id,e.center_id from core.events e where e.org_id=$1 and e.id=$2 and e.state='published' and e.ends_at>clock_timestamp()
  and exists(select 1 from core.event_registrations r where r.org_id=$1 and r.event_id=e.id and r.person_id=$3 and r.state='active')),
 members as(select distinct p.id,a.id account_id,e.center_id from audience e
  join core.event_registrations r on r.org_id=$1 and r.event_id=e.id and r.state='active'
  join core.people p on p.org_id=$1 and p.id=r.person_id and p.state='active'
  join core.account_links l on l.org_id=$1 and l.person_id=p.id and l.state='active' and l.verified_at is not null
  join core.accounts a on a.id=l.account_id and a.state='active' where p.id<>$3),
 fields as(select m.id,private.sharing_peer_profile($1,m.center_id,m.account_id,m.id) item from members m)
 select coalesce(jsonb_agg(item order by id) filter(where item-'person_id'<>'{}'::jsonb),'[]'::jsonb) from fields
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='out:=private.event_projection(org,e.id,person,cm,org_reader);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Event participant sharing projection drift';end if;
 execute replace(b,a,a||E'\n'||'  out:=out||jsonb_build_object(''shared_participants'',private.event_shared_participants(org,e.id,person));');
 b:=pg_get_functiondef('private.settings_media_access(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=' elsif r->>''scope''=''lesson_participant'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Event participant media scope drift';end if;
 execute replace(b,a,$a$ elsif r->>'scope'='event_participant' then
  perform private.require_feature(org,'F29');
  select x into item from jsonb_array_elements(private.event_shared_participants(org,(r->>'event_id')::uuid,person)) x
   where x->>'person_id'=((r->>'person_id')::uuid)::text and x#>>'{photo,id}'=((r->>'asset_id')::uuid)::text;
  if item is null then perform private.fail('NOT_FOUND');end if;
  select l.account_id into target from core.account_links l join core.accounts a on a.id=l.account_id and a.state='active'
   where l.org_id=org and l.person_id=(r->>'person_id')::uuid and l.state='active' and l.verified_at is not null;
  if target is null then perform private.fail('NOT_FOUND');end if;skey:='user:'||target;
$a$||a||E'\n'||'  perform private.require_feature(org,''F08'');');
end$patch$;
revoke all on function private.sharing_peer_profile(uuid,uuid,uuid,uuid),private.event_shared_participants(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.sharing_peer_profile(uuid,uuid,uuid,uuid),private.event_shared_participants(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
