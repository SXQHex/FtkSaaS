begin;
-- Extend the accepted native scheduler; new lanes stay disabled and unbound until installation.
do $$declare lane text;r text;begin
 foreach lane in array array['p07','p07_privacy'] loop
  r:='ftk_ops_'||lane;
  if not exists(select 1 from pg_roles where rolname=r) then execute format('create role %I login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null',r);end if;
  if exists(select 1 from pg_roles where rolname=r and (not rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then raise exception 'UNSAFE_HOSTED_WORKER_ROLE';end if;
  if exists(select 1 from pg_auth_members m join pg_roles child on child.oid=m.member join pg_roles parent on parent.oid=m.roleid where child.rolname=r and parent.rolname<>'ftk_'||lane||'_worker') then raise exception 'UNEXPECTED_HOSTED_WORKER_MEMBERSHIP';end if;
  execute format('alter role %I password null',r);
  execute format('grant %I to %I','ftk_'||lane||'_worker',r);
  execute format('grant usage on schema private,extensions to %I',r);
  execute format('alter role %I connection limit 2',r);
  execute format('alter role %I set statement_timeout = %L',r,'30s');
  execute format('alter role %I set lock_timeout = %L',r,'5s');
  execute format('alter role %I set idle_in_transaction_session_timeout = %L',r,'30s');
 end loop;
end$$;
alter table private.ops_worker_health drop constraint ops_worker_health_lane_check;
alter table private.ops_worker_health add constraint ops_worker_health_lane_check check(lane in ('p01','p05','p06','p07','p07_privacy'));
insert into private.ops_worker_health(lane) values('p07'),('p07_privacy');
revoke all on private.ops_worker_health from ftk_p07_worker,ftk_p07_privacy_worker;
create function private.p07_ops_begin(lane text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict error
declare h private.ops_worker_health;orgs uuid[];chosen uuid;
begin
 perform private.ops_identity(lane);
 select * into h from private.ops_worker_health w where w.lane=p07_ops_begin.lane for update;
 if not h.enabled then return jsonb_build_object('enabled',false);end if;
 if lane='p07' then select array_agg(w.org_id order by w.org_id) into orgs from private.p07_worker_scopes w where w.db_role=session_user;
 elsif lane='p07_privacy' then select array_agg(w.org_id order by w.org_id nulls first) into orgs from private.p07_privacy_worker_scopes w where w.db_role=session_user;
 else perform private.fail('FORBIDDEN');end if;
 if h.last_started_at is null then chosen:=orgs[1];
 else
  select u into chosen from unnest(orgs) u where u is not null and (h.last_org is null or u>h.last_org) order by u limit 1;
  if not found then chosen:=orgs[1];end if;
 end if;
 update private.ops_worker_health w set last_started_at=clock_timestamp(),last_status='running',last_error_code=null,last_org=chosen,ticks=w.ticks+1 where w.lane=p07_ops_begin.lane;
 return jsonb_build_object('enabled',true,'org',chosen,'has_scope',coalesce(cardinality(orgs),0)>0);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.ops_identity(text)'::regprocedure);
 a:=$a$lane not in ('p01','p05','p06')$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler identity anchor mismatch';end if;
 execute replace(b,a,$a$lane not in ('p01','p05','p06','p07','p07_privacy')$a$);
 b:=pg_get_functiondef('private.ops_begin(text)'::regprocedure);
 a:=' perform private.ops_identity(lane);';if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler begin anchor mismatch';end if;
 execute replace(b,a,$a$ if lane in ('p07','p07_privacy') then return private.p07_ops_begin(lane);end if;$a$||E'\n'||a);
 b:=pg_get_functiondef('private.ops_run(text)'::regprocedure);
 a:=' if org is null then';if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler global scope anchor mismatch';end if;
 b:=replace(b,a,$a$ if org is null and coalesce(ctx->>'has_scope','false')<>'true' then$a$);
 a:='  else jobs:=private.p06_jobs_claim';if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler claim anchor mismatch';end if;
 b:=replace(b,a,$a$  elsif lane='p07' then jobs:=private.p07_jobs_claim(org,private.ops_uuid_bank(4096),1);
  elsif lane='p07_privacy' then jobs:=private.p07_privacy_claim(org,private.ops_uuid_bank(4096),1);
$a$||a);
 a:=$a$   else
    n:=4096;$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler execute anchor mismatch';end if;
 b:=replace(b,a,$a$   elsif lane='p07' then answer:=private.p07_worker_execute(j->>'operation',j->'request',private.ops_uuid_bank(4096));
   elsif lane='p07_privacy' then answer:=private.p07_privacy_execute(j->'request',private.ops_uuid_bank(4096));
$a$||a);execute b;
 b:=pg_get_functiondef('private.ops_finish(text,text,text,integer,integer,integer)'::regprocedure);
 a:=$a$'ftksaas-ops-p01','ftksaas-ops-p05','ftksaas-ops-p06'$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 scheduler retention anchor mismatch';end if;
 execute replace(b,a,a||$a$,'ftksaas-ops-p07','ftksaas-ops-p07_privacy'$a$);
end$patch$;
revoke all on function private.p07_ops_begin(text) from public,anon,authenticated,service_role;
grant execute on function private.ops_identity(text),private.ops_uuid_bank(int),private.ops_begin(text),private.ops_finish(text,text,text,int,int,int) to ftk_ops_p07,ftk_ops_p07_privacy;
grant execute on procedure private.ops_run(text) to ftk_ops_p07,ftk_ops_p07_privacy;
commit;
