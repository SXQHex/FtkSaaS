begin;
create or replace function private.organization_regional_schema() returns jsonb language sql immutable security invoker set search_path='' as $schema$select '{"type":"object","properties":{"application_language":{"type":"string","enum":["tr","en"]},"public_language":{"type":"string","enum":["tr","en"]},"document_language":{"type":"string","pattern":"^[a-z]{2,8}(-[a-z0-9]{1,8})*$","maxLength":35},"notification_language":{"type":"string","pattern":"^[a-z]{2,8}(-[a-z0-9]{1,8})*$","maxLength":35},"date_format":{"type":"string","enum":["dd.MM.yyyy"]},"time_format":{"type":"string","enum":["12","24"]},"number_format":{"type":"string","enum":["tr-TR","en-US"]},"week_start":{"type":"string","enum":["monday","sunday"]},"fallback_language":{"type":"string","enum":["tr"]},"new_center_timezone":{"type":"string","minLength":1,"maxLength":100}},"required":["application_language","public_language","document_language","notification_language","date_format","time_format","number_format","week_start","fallback_language","new_center_timezone"],"additionalProperties":false}'::jsonb$schema$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);a:='''catalog_version'',22';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Content settings version drift';end if;execute replace(b,a,'''catalog_version'',23');
end$patch$;
commit;
