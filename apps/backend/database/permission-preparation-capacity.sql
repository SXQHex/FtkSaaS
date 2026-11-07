begin;
create or replace function private.permission_preparation_schema() returns jsonb language sql immutable security invoker set search_path='' as $schema$select '{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"grants":{"type":"array","minItems":1,"maxItems":8,"uniqueItems":true,"items":{"type":"object","properties":{"permission":{"type":"string","enum":["person.manage","person.activate","invite.student","reservation.write","attendance.draft","sale.write","finance.collect","reservation.capacity_override"]},"enabled":{"type":"boolean"}},"required":["permission","enabled"],"additionalProperties":false}}},"required":["key","name","grants"],"additionalProperties":false}'::jsonb$schema$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.permission_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 a:=$anchor$'person.manage','person.activate','invite.student','reservation.write','attendance.draft','sale.write','finance.collect'$anchor$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Permission discovery allowlist drift';end if;
 b:=replace(b,a,a||$extra$,'reservation.capacity_override'$extra$);
 a:=' if permission_code not in (';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Capacity target authority drift';end if;
 execute replace(b,a,$guard$ if permission_code='reservation.capacity_override' and not private.has_role(org,target,'staff',center) then perform private.fail('FORBIDDEN');end if;
$guard$||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',14';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Permission catalog version drift';end if;
 execute replace(b,a,'''catalog_version'',15');
end$patch$;
notify pgrst,'reload schema';
commit;
