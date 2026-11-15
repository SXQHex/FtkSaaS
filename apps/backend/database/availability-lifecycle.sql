begin;
-- Explicit lifecycle states preserve the original rule/closure and its audit.
alter table core.availability_rules add column if not exists state text not null default 'active' check(state in ('active','inactive'));
alter table core.availability_exceptions add column if not exists state text not null default 'active' check(state in ('active','cancelled'));
create function private.availability_lifecycle(op text,r jsonb,org uuid,center uuid,actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare item record;selected_id uuid;v bigint;
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if r->>'reason' is null or btrim(r->>'reason')='' or length(r->>'reason')>2000 then perform private.fail('VALIDATION_FAILED');end if;
 perform private.assert_resource(org,center,r#>>'{resource,kind}',(r#>>'{resource,id}')::uuid);
 if op='availability_save_v1' and r->>'action'='retire' then
  selected_id:=(r->>'rule_id')::uuid;
  select * into item from core.availability_rules a where a.org_id=org and a.center_id=center and a.id=selected_id and a.resource_kind=r#>>'{resource,kind}' and a.resource_id=(r#>>'{resource,id}')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if item.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if item.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  update core.availability_rules a set state='inactive',version=a.version+1 where a.org_id=org and a.id=selected_id returning a.version into v;
  return jsonb_build_object('primary_id',selected_id,'version',v,'subject','availability_rules','audit',jsonb_build_object('before',to_jsonb(item),'state','inactive'));
 elsif op='availability_exception_save_v1' and r->>'action'='cancel' then
  -- Same lock/version aggregate as append: cancellation cannot race a closure edit.
  perform 1 from core.centers c where c.org_id=org and c.id=center for update;
  selected_id:=(r->>'exception_id')::uuid;
  select * into item from core.availability_exceptions a where a.org_id=org and a.center_id=center and a.id=selected_id and a.resource_kind=r#>>'{resource,kind}' and a.resource_id=(r#>>'{resource,id}')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if item.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  update core.centers c set version=c.version+1 where c.org_id=org and c.id=center and c.version=(r->>'expected_version')::bigint returning c.version into v;
  if not found then perform private.fail('VERSION_CONFLICT');end if;
  update core.availability_exceptions a set state='cancelled',version=a.version+1 where a.org_id=org and a.id=selected_id;
  return jsonb_build_object('primary_id',selected_id,'version',v,'subject','availability_exceptions','audit',jsonb_build_object('before',to_jsonb(item),'state','cancelled'));
 end if;
 perform private.fail('VALIDATION_FAILED');
end$$;
do $patch$
declare b text;a text;fn record;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$anchor$ when 'availability_save_v1' then
  perform private.assert_resource$anchor$;
 if strpos(b,a)=0 then raise exception 'Availability lifecycle command anchor drift';end if;
 b:=replace(b,a,$anchor$ when 'availability_save_v1' then
 if r->>'action'='retire' then
  terms:=private.availability_lifecycle(p_operation,r,org,center,person);record_id:=(terms->>'primary_id')::uuid;version_n:=(terms->>'version')::bigint;subject:=terms->>'subject';audit_delta:=terms->'audit';
 else
  perform private.assert_resource$anchor$);
 a:=$anchor$  end if;subject:='availability_rules';
 when 'availability_exception_save_v1' then
  perform private.assert_resource$anchor$;
 if strpos(b,a)=0 then raise exception 'Availability exception lifecycle anchor drift';end if;
 b:=replace(b,a,$anchor$  end if;subject:='availability_rules';
 end if;
 when 'availability_exception_save_v1' then
 if r->>'action'='cancel' then
  terms:=private.availability_lifecycle(p_operation,r,org,center,person);record_id:=(terms->>'primary_id')::uuid;version_n:=(terms->>'version')::bigint;subject:=terms->>'subject';audit_delta:=terms->'audit';
 else
  perform private.assert_resource$anchor$);
 a:=$anchor$r->>'reason');subject:='availability_exceptions';
 when 'policy_publish_v1' then$anchor$;
 if strpos(b,a)=0 then raise exception 'Availability exception lifecycle end drift';end if;
 b:=replace(b,a,$anchor$r->>'reason');subject:='availability_exceptions';
 end if;
 when 'policy_publish_v1' then$anchor$);
 a:=$anchor$   audit_delta:=jsonb_build_object('before',to_jsonb(row_record),'after',r->'rule');$anchor$;
 if strpos(b,a)=0 then raise exception 'Availability inactive write anchor drift';end if;
 b:=replace(b,a,$anchor$   if row_record.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
$anchor$||a);
 execute b;
 -- Filter operational readers only. Merge snapshots retain historical rows.
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname=any(array['assert_availability','p06_available_seconds','p06_report_rows','p07_merge_conflicts']) loop
  b:=pg_get_functiondef(fn.signature);
  b:=replace(b,'core.availability_rules','(select * from core.availability_rules where state=''active'')');
  b:=replace(b,'core.availability_exceptions','(select * from core.availability_exceptions where state=''active'')');
  execute b;
 end loop;
 b:=pg_get_functiondef('private.starter_availability_management(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=$a$'exists',true,'state','active',$a$;
 if strpos(b,a)=0 then raise exception 'Availability lifecycle read state drift';end if;
 execute replace(b,a,$a$'exists',true,'state',state,$a$);
 b:=pg_get_functiondef('private.starter_resource_page(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$'exists',true,'state','active',$a$;
 if strpos(b,a)=0 then raise exception 'Exception lifecycle read state drift';end if;
 b:=replace(b,a,$a$'exists',true,'state',state,$a$);
 a:=$a$'values',jsonb_build_object('resource',k->'resource','interval'$a$;
 if strpos(b,a)=0 then raise exception 'Exception lifecycle read identity drift';end if;
 b:=replace(b,a,$a$'values',jsonb_build_object('exception_id',id,'resource',k->'resource','interval'$a$);
 execute b;
end$patch$;
revoke all on function private.availability_lifecycle(text,jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.availability_lifecycle(text,jsonb,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
