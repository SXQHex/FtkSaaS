begin;
-- FD06/FD11: inspect the existing availability command under its live write authority.
create function private.starter_availability_management(r jsonb,org uuid,center uuid,actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';lim int:=coalesce((r#>>'{page,limit}')::int,50);
 cur jsonb;at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();token text;items jsonb;
 h text:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page')::text);
begin
 if r->>'operation'<>'availability_save_v1' or r#>>'{selector,operation}' is distinct from r->>'operation'
  or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' or lim<1 or lim>200 then perform private.fail('VALIDATION_FAILED');end if;
 perform private.assert_resource(org,center,k#>>'{resource,kind}',(k#>>'{resource,id}')::uuid);
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;
   at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or at is null or last_id is null or asof is null or not isfinite(at) or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with page as(
  select a.* from core.availability_rules a
  where a.org_id=org and a.center_id=center and a.resource_kind=k#>>'{resource,kind}' and a.resource_id=(k#>>'{resource,id}')::uuid
   and (k->>'rule_id' is null or a.id=(k->>'rule_id')::uuid) and a.created_at<=asof
   and (cur is null or (a.created_at,a.id)>(at,last_id))
  order by a.created_at,a.id limit lim+1
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'operation','availability_save_v1','entity',jsonb_build_object('type','availability_rules','id',id),'exists',true,'state','active',
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','availability_rules','id',id),'version',version)),
  'as_of',asof,'current',jsonb_build_object('operation','availability_save_v1','values',jsonb_build_object(
   'rule_id',id,'resource',k->'resource','rule',jsonb_build_object('weekdays',weekdays,'local_start',local_start,'local_end',local_end,'valid_from',valid_from,'valid_until',valid_until)
  )),'_at',created_at) order by created_at,id),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)>lim then
  items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',(items->-1)#>'{entity,id}','as_of',asof)::text,'UTF8'),'hex');
 end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('data',jsonb_build_object('items',items,'next_cursor',token,'as_of',asof),'primary_id',org,'subject','organizations');
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$elsif perm_code='management.inspect' then
  if r->>'operation'<>'negcredit_valuation_set_v1'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Availability management permission anchor drift';end if;
 b:=replace(b,a,$a$elsif perm_code='management.inspect' and r->>'operation'='availability_save_v1' then
  if not cm then perform private.fail('FORBIDDEN');end if;
  perform private.require_feature(org,'F02');
 elsif perm_code='management.inspect' then
  if r->>'operation'<>'negcredit_valuation_set_v1'$a$);
 a:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Availability management dispatch anchor drift';end if;
 b:=replace(b,a,'if p_operation=''management_state_get_v1'' and r->>''operation''=''availability_save_v1'' then terms:=private.starter_availability_management(r,org,center,actor.id);else '||a||'end if;');
 execute b;
end$patch$;
revoke all on function private.starter_availability_management(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.starter_availability_management(jsonb,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
