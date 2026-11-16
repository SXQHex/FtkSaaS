begin;
-- Receipt/preview contexts written before this migration contain the internal
-- capacity representation. Restore the public shape only at this private replay
-- boundary; public capacity_input remains strict and is never broadened.
create function private.capacity_recovery_request(op text,r jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare path text[];v jsonb;
begin
 path:=case when op in ('session_create_v1','replacement_session_create_v1','session_capacity_set_v1') then array['capacity']
  when op='program_preview_v1' then array['schedule','capacity']
  when op='session_change_preview_v1' then array['patch','capacity'] end;
 if path is null then return r;end if;
 v:=r#>path;
 if v is not null and not v?'total' and v?'nominal' and v?'maximum' then
  if v->'nominal' is distinct from v->'maximum' then perform private.fail('INTEGRITY_VIOLATION');end if;
  r:=jsonb_set(r,path,jsonb_build_object('total',v->'nominal')||case when v->'categories' is not null and v->'categories'<>'null'::jsonb then jsonb_build_object('categories',v->'categories') else '{}'::jsonb end);
 end if;
 return r;
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.p06_original_authorize(text,jsonb,uuid,uuid,uuid[])'::regprocedure);a text:='response:=private.execute_operation(op,r,auth_id,session_id,ids,';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Capacity recovery authorization anchor drift';end if;
 execute replace(b,a,'response:=private.execute_operation(op,private.capacity_recovery_request(op,r),auth_id,session_id,ids,');
end$patch$;
revoke all on function private.capacity_recovery_request(text,jsonb) from public,anon,authenticated;
grant execute on function private.capacity_recovery_request(text,jsonb) to service_role;
commit;
