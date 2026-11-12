begin;
-- Preserve existing lists; only newly created classes default to closed.
alter table core.classes add column if not exists waitlist_enabled boolean not null default true;
alter table core.classes alter column waitlist_enabled set default false;
create function private.class_waitlist_impact(org uuid,class_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with pending as(select w.id,w.version,w.session_id,w.state from core.waitlist_entries w join core.sessions s on s.org_id=w.org_id and s.id=w.session_id
 where w.org_id=$1 and s.class_id=$2 and w.state in ('waiting','offered')),
 page as(select * from pending order by id limit 200)
 select jsonb_build_object('count',(select count(*) from pending),'truncated',(select count(*)>200 from pending),'entries',coalesce((select jsonb_agg(to_jsonb(p) order by id) from page p),'[]'))
$$;
create function private.class_waitlist_change(r jsonb,org uuid,center uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare c core.classes;
begin
 if not r?'waitlist_enabled' or r->>'class_id' is null then return;end if;
 -- Lock class before the session set: a new session's FK cannot slip past a
 -- close, while join/issue already serialize on their existing session row.
 select * into c from core.classes where org_id=org and center_id=center and id=(r->>'class_id')::uuid for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 if c.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if not (r->>'waitlist_enabled')::boolean then
  perform s.id from core.sessions s where s.org_id=org and s.class_id=c.id and s.state='planned' and s.ends_at>clock_timestamp() order by s.id for update;
  if (private.class_waitlist_impact(org,c.id)->>'count')::bigint>0 then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
 end if;
end$$;
do $patch$
declare b text;a text;old_clause text;changed text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a:=E' when ''class_save_v1'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Class waitlist dispatch drift';end if;
 old_clause:=split_part(split_part(b,a,2),E' when ''',1);changed:=E'\n  perform private.class_waitlist_change(r,org,center);'||old_clause;
 changed:=replace(changed,'discipline_id,external_open,state) values(record_id,org,center,r->>''name'',(r->>''discipline_id'')::uuid,(r->>''external_open'')::bool,''active'')',
 'discipline_id,external_open,state,waitlist_enabled) values(record_id,org,center,r->>''name'',(r->>''discipline_id'')::uuid,(r->>''external_open'')::bool,''active'',coalesce((r->>''waitlist_enabled'')::boolean,false))');
 changed:=replace(changed,'external_open=(r->>''external_open'')::bool,version=version+1','external_open=(r->>''external_open'')::bool,waitlist_enabled=coalesce((r->>''waitlist_enabled'')::boolean,waitlist_enabled),version=version+1');
 if strpos(changed,'state,waitlist_enabled')=0 then raise exception 'New class waitlist default drift';end if;
 execute replace(b,old_clause,changed);
 b:=pg_get_functiondef('private.p01_wait_eligible(uuid,core.sessions,uuid)'::regprocedure);a:=E'begin\n';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Waitlist eligibility drift';end if;
 execute replace(b,a,a||' if s.class_id is not null and not coalesce((select waitlist_enabled from core.classes where org_id=org and id=s.class_id),false) then return false;end if;'||E'\n');
 b:=pg_get_functiondef('private.studio_management_page(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:='''external_open'',c.external_open)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Class waitlist management drift';end if;
 execute replace(b,a,a||' ||case when coalesce((k->>''include_waitlist'')::boolean,false) then jsonb_build_object(''waitlist_enabled'',c.waitlist_enabled,''waitlist_impact'',private.class_waitlist_impact(org,c.id)) else ''{}''::jsonb end');
end$patch$;
revoke all on function private.class_waitlist_impact(uuid,uuid),private.class_waitlist_change(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function private.class_waitlist_impact(uuid,uuid),private.class_waitlist_change(jsonb,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
