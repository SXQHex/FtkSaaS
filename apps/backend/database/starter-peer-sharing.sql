begin;
-- FD05: opt-in fields are projected only between confirmed participants in the
-- same future/ongoing lesson. Staff's operational person projection is separate.
create function private.session_shared_participants(org uuid,session uuid,viewer uuid) returns jsonb language sql volatile security invoker set search_path='' as $$
 with audience as (
  select s.id from core.sessions s
  where s.org_id=$1 and s.id=$2 and s.state='planned' and s.ends_at>clock_timestamp()
  and exists(select 1 from core.reservations r where r.org_id=s.org_id and r.session_id=s.id and r.person_id=$3 and r.state='active')
 ), members as (
  select distinct p.id,a.id account_id
  from audience s join core.reservations r on r.org_id=$1 and r.session_id=s.id and r.state='active'
  join core.people p on p.org_id=r.org_id and p.id=r.person_id and p.state='active'
  join core.account_links l on l.org_id=p.org_id and l.person_id=p.id and l.state='active' and l.verified_at is not null
  join core.accounts a on a.id=l.account_id and a.state='active'
  where p.id<>$3
 ), fields as (
  select m.id,jsonb_build_object('person_id',m.id)
  ||case when coalesce((v.values->>'profile_visible')::bool,false) then jsonb_build_object('display_name',private.p07_profile(m.account_id)) else '{}'::jsonb end
  ||case when coalesce((v.values->>'email_visible')::bool,false) and private.account_identity_view(m.account_id)->>'email' is not null then jsonb_build_object('email',private.account_identity_view(m.account_id)->>'email') else '{}'::jsonb end
  ||case when coalesce((v.values->>'phone_visible')::bool,false) and private.account_identity_view(m.account_id)->>'phone' is not null then jsonb_build_object('phone',private.account_identity_view(m.account_id)->>'phone') else '{}'::jsonb end item
  from members m left join private.frontend_settings v on v.scope_key='member:'||$1||':'||m.account_id
 )
 select coalesce(jsonb_agg(item order by id) filter(where item-'person_id'<>'{}'::jsonb),'[]'::jsonb) from fields
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='   out:=private.schedule_session_view(org,ses.id,org_reader or private.is_manager(org,person,ses.center_id));';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Peer sharing session projection anchor drift';end if;
 execute replace(b,a,a||E'\n'||$a$   out:=out||jsonb_build_object('shared_participants',private.session_shared_participants(org,ses.id,person));$a$);
 -- An explicit local choice is local even when it equals the copied value.
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' insert into private.frontend_settings(scope_key,scope,values,version) values(skey,r->>''scope'',local,1)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Preparation explicit override anchor drift';end if;
 execute replace(b,a,$a$ if r->>'scope'='center' and patch?'program_duration_minutes' then
  update private.center_preparation_origins set active=false where 'center:'||org_id||':'||center_id=skey and active;
 end if;
$a$||a);
end$patch$;
revoke all on function private.session_shared_participants(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.session_shared_participants(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
