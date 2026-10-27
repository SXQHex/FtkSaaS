begin;
-- FD06/FD11: a new center copies preparation defaults once. Existing centers
-- and published programs never inherit later template edits.
create table private.center_preparation_origins(
 center_id uuid primary key,org_id uuid not null,organization_version bigint not null,
 duration_minutes int not null check(duration_minutes>0),active boolean not null default true,
 foreign key(org_id,center_id) references core.centers(org_id,id)
);
alter table private.center_preparation_origins enable row level security;
revoke all on private.center_preparation_origins from public,anon,authenticated;
grant select,insert,update on private.center_preparation_origins to service_role;
create function private.center_preparation_copy() returns trigger language plpgsql security invoker set search_path='' as $$
declare template private.frontend_settings;duration int;
begin
 select * into template from private.frontend_settings where scope_key='organization:'||new.org_id;
 duration:=coalesce((template.values->>'program_duration_minutes')::int,60);
 insert into private.frontend_settings(scope_key,scope,values,version)
 values('center:'||new.org_id||':'||new.id,'center',jsonb_build_object('program_duration_minutes',duration),0);
 insert into private.center_preparation_origins(center_id,org_id,organization_version,duration_minutes)
 values(new.id,new.org_id,coalesce(template.version,0),duration);
 return new;
end$$;
create trigger center_preparation_copy after insert on core.centers for each row execute function private.center_preparation_copy();
create function private.center_preparation_override() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.scope='center' and new.values->'program_duration_minutes' is distinct from old.values->'program_duration_minutes' then
  update private.center_preparation_origins set active=false where 'center:'||org_id||':'||center_id=new.scope_key and active;
 end if;
 return new;
end$$;
create trigger center_preparation_override after update on private.frontend_settings for each row execute function private.center_preparation_override();
create function private.program_preparation_duration(org uuid,center uuid) returns int language sql stable security invoker set search_path='' as $$
 select coalesce((select (values->>'program_duration_minutes')::int from private.frontend_settings where scope_key='center:'||$1||':'||$2),60)
$$;
create function private.program_preparation_source(org uuid,center uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select case
 when not exists(select 1 from private.frontend_settings where scope_key='center:'||$1||':'||$2 and values?'program_duration_minutes') then jsonb_build_object('kind','system_default')
 when exists(select 1 from private.center_preparation_origins where org_id=$1 and center_id=$2 and active) then
  (select jsonb_build_object('kind','organization_copy','organization_version',organization_version) from private.center_preparation_origins where org_id=$1 and center_id=$2)
 else jsonb_build_object('kind','center_local') end
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',2';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Preparation catalog version anchor drift';end if;
 execute replace(b,a,'''catalog_version'',3');
 b:=pg_get_functiondef('private.frontend_settings_view(jsonb,uuid,uuid)'::regprocedure);
 a:='''as_of'',clock_timestamp());';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Preparation source view anchor drift';end if;
 execute replace(b,a,$a$'as_of',clock_timestamp())||case when r->>'scope'='center' then jsonb_build_object('program_duration_source',private.program_preparation_source(org,(r->>'center_id')::uuid)) else '{}'::jsonb end;$a$);
 b:=pg_get_functiondef('private.schedule_build_program(uuid,uuid,jsonb,uuid[])'::regprocedure);
 a:=' select timezone into tz from core.centers where org_id=org and id=center;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Preparation program consumer anchor drift';end if;
 execute replace(b,a,a||$a$
 if not spec?'duration_minutes' then
  spec:=jsonb_set(spec,'{duration_minutes}',to_jsonb(private.program_preparation_duration(org,center)));
 end if;
$a$);
end$patch$;
revoke all on function private.center_preparation_copy(),private.center_preparation_override(),private.program_preparation_duration(uuid,uuid),private.program_preparation_source(uuid,uuid) from public,anon,authenticated;
grant execute on function private.center_preparation_copy(),private.center_preparation_override(),private.program_preparation_duration(uuid,uuid),private.program_preparation_source(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
