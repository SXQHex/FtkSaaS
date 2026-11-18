begin;

create table private.attendance_correction_requests(
 id uuid primary key,
 org_id uuid not null,
 center_id uuid not null,
 session_id uuid not null,
 account_id uuid not null references core.accounts(id),
 instructor_id uuid not null,
 closure_revision bigint not null check(closure_revision>0),
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 state text not null default 'pending' check(state in ('pending','accepted','declined')),
 version bigint not null default 1,
 created_at timestamptz not null default statement_timestamp(),
 reviewed_at timestamptz,
 unique(org_id,session_id,instructor_id,closure_revision),
 foreign key(org_id,session_id) references core.sessions(org_id,id),
 foreign key(org_id,center_id) references core.centers(org_id,id),
 foreign key(org_id,instructor_id) references core.people(org_id,id)
);
alter table private.attendance_correction_requests enable row level security;
revoke all on private.attendance_correction_requests from public,anon,authenticated;
grant select,insert,update on private.attendance_correction_requests to service_role;

create function private.attendance_window(s core.sessions) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when p.id is not null then jsonb_build_object('policy_id',p.id,
  'opens_at',s.starts_at-make_interval(mins=>(p.value->>'opens_minutes_before')::integer),
  'closes_at',s.ends_at+make_interval(mins=>(p.value->>'closes_minutes_after')::integer)) end
 from private.policy_at(s.org_id,s.center_id,'attendance_window',statement_timestamp()) p
$$;

create function private.attendance_window_assert(s core.sessions) returns void
language plpgsql stable security invoker set search_path='' as $$
declare bounds jsonb:=private.attendance_window(s);
begin
 if bounds is not null and (statement_timestamp()<(bounds->>'opens_at')::timestamptz
  or statement_timestamp()>=(bounds->>'closes_at')::timestamptz) then perform private.fail('INVALID_STATE_TRANSITION');end if;
end$$;

create function private.attendance_request_instructor(s core.sessions,person uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select private.has_role(s.org_id,person,'instructor',s.center_id)
 and exists(select 1 from jsonb_array_elements(private.schedule_snapshot(s.org_id,s.id)->'assignments') a
  where a->>'duty'='instructor' and a->>'person_id'=person::text)
$$;

create function private.attendance_request_session(r jsonb,org uuid,center uuid,person uuid) returns core.sessions
language plpgsql stable security invoker set search_path='' as $$
declare s core.sessions;
begin
 select q.* into s from core.sessions q where q.org_id=org and q.center_id=center and q.id=(r->>'session_id')::uuid;
 if not found or not private.starter_session_allowed(org,s.id,false) then perform private.fail('NOT_FOUND');end if;
 if r?'correction_request_id' then
  if not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
  if not exists(select 1 from private.attendance_correction_requests a where a.org_id=org
   and a.center_id=center and a.session_id=s.id and a.id=(r->>'correction_request_id')::uuid)
  then perform private.fail('NOT_FOUND');end if;
 elsif not private.attendance_request_instructor(s,person) then perform private.fail('FORBIDDEN');end if;
 return s;
end$$;

create function private.attendance_request_write(r jsonb,org uuid,center uuid,person uuid,account uuid,request_id uuid) returns bigint
language plpgsql security invoker set search_path='' as $$
declare s core.sessions:=private.attendance_request_session(r,org,center,person);
 current_revision bigint; current_request private.attendance_correction_requests;
begin
 perform 1 from core.sessions q where q.org_id=org and q.id=s.id for update;
 select max(c.revision) into current_revision from core.attendance_closures c where c.org_id=org and c.session_id=s.id;
 if s.attendance_state<>'closed' or current_revision is null then perform private.fail('INVALID_STATE_TRANSITION');end if;
 if r?'correction_request_id' then
  select a.* into current_request from private.attendance_correction_requests a where a.id=request_id and a.org_id=org and a.session_id=s.id for update;
  if current_request.version is distinct from (r->>'expected_version')::bigint or current_request.closure_revision<>current_revision
   then perform private.fail('VERSION_CONFLICT');end if;
  if current_request.state<>'pending' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  update private.attendance_correction_requests set state=r->>'decision',version=version+1,reviewed_at=statement_timestamp()
   where attendance_correction_requests.id=request_id returning version into current_request.version;
  return current_request.version;
 end if;
 if (r->>'closure_revision')::bigint is distinct from current_revision then perform private.fail('VERSION_CONFLICT');end if;
 insert into private.attendance_correction_requests(id,org_id,center_id,session_id,account_id,instructor_id,closure_revision,reason)
  values(request_id,org,center,s.id,account,person,current_revision,btrim(r->>'reason'))
 on conflict(org_id,session_id,instructor_id,closure_revision) do nothing;
 if not found then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
 return 1;
end$$;

create function private.attendance_request_read(org uuid,session uuid,person uuid,account uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('attendance_window',private.attendance_window(s),'correction_requests',
  coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'instructor_id',a.instructor_id,'closure_revision',a.closure_revision,
   'reason',a.reason,'state',a.state,'version',a.version,'created_at',a.created_at,'reviewed_at',a.reviewed_at)
   order by a.created_at,a.id) from private.attendance_correction_requests a
   where a.org_id=org and a.session_id=session and (private.is_manager(org,person,s.center_id)
    or (a.account_id=account and a.instructor_id=person and private.attendance_request_instructor(s,person)))),'[]'::jsonb))
 from core.sessions s where s.org_id=org and s.id=session
$$;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.validate_policy(text,jsonb)'::regprocedure);
 anchor:='begin';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Attendance policy validation drift';end if;
 execute replace(body,anchor,anchor||$a$
 if k='attendance_window' then
  if v->>'kind' is distinct from 'attendance_window' or (v->>'opens_minutes_before')::numeric is null
   or (v->>'closes_minutes_after')::numeric is null
   or (v->>'opens_minutes_before')::numeric not between 0 and 525600
   or (v->>'closes_minutes_after')::numeric not between 0 and 525600
   or (v->>'opens_minutes_before')::numeric<>trunc((v->>'opens_minutes_before')::numeric)
   or (v->>'closes_minutes_after')::numeric<>trunc((v->>'closes_minutes_after')::numeric)
   then perform private.fail('VALIDATION_FAILED');end if;
  return;
 end if;
$a$);

 body:=pg_get_functiondef('private.lesson_start(uuid,uuid,jsonb)'::regprocedure);
 anchor:=$a$ if ss.actual_started_at is not null then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Attendance start window drift';end if;
 execute replace(body,anchor,' perform private.attendance_window_assert(ss);'||E'\n'||anchor);

 body:=pg_get_functiondef('private.lesson_dispatch(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$  if op in('attendance_mark_v1','attendance_block_v1') then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Attendance draft window drift';end if;
 execute replace(body,anchor,anchor||E'\n   perform private.attendance_window_assert(s);');

 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$elsif perm_code in('attendance.draft','attendance.close') then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Attendance request permission drift';end if;
 body:=replace(body,anchor,$a$elsif p_operation='attendance_correction_request_v1' then
  perform private.attendance_request_session(r,org,center,person);
 $a$||anchor);
 anchor:=' -- DOMAIN_CASES';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Attendance request dispatch drift';end if;
 body:=replace(body,anchor,$a$
 when 'attendance_correction_request_v1' then
  record_id:=coalesce((r->>'correction_request_id')::uuid,record_id);
  version_n:=private.attendance_request_write(r,org,center,person,actor.id,record_id);
  out:=jsonb_build_object('operation_id',operation_id,'primary_id',record_id,'version',version_n,'replayed',false,'related','[]'::jsonb);
  record_id:=(r->>'session_id')::uuid;subject:='sessions';
$a$||anchor);
 anchor:=$a$ if out is null then out:=jsonb_build_object('operation_id',operation_id$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Attendance request projection drift';end if;
 execute replace(body,anchor,$a$ if p_operation='attendance_get_v1' and r->'include_correction_requests'='true'::jsonb then
  out:=out||private.attendance_request_read(org,(r->>'session_id')::uuid,person,actor.id);
 end if;
$a$||anchor);
end$patch$;

insert into private.runtime_operations(name,permission,billing_class,features) values('attendance_correction_request_v1','attendance.draft','maintenance',array['F14']::text[]);
create function api_v1.attendance_correction_request_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('attendance_correction_request_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function private.attendance_window(core.sessions),private.attendance_window_assert(core.sessions),
 private.attendance_request_instructor(core.sessions,uuid),private.attendance_request_session(jsonb,uuid,uuid,uuid),
 private.attendance_request_write(jsonb,uuid,uuid,uuid,uuid,uuid),private.attendance_request_read(uuid,uuid,uuid,uuid),
 api_v1.attendance_correction_request_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.attendance_window(core.sessions),private.attendance_window_assert(core.sessions),
 private.attendance_request_instructor(core.sessions,uuid),private.attendance_request_session(jsonb,uuid,uuid,uuid),
 private.attendance_request_write(jsonb,uuid,uuid,uuid,uuid,uuid),private.attendance_request_read(uuid,uuid,uuid,uuid),
 api_v1.attendance_correction_request_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
commit;
