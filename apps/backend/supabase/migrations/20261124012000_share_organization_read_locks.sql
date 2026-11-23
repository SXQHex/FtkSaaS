begin;

do $migration$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old_lock text:=$old$  if data_api then
   select owner_person_id into owner from core.organizations where id=org for share;
  else
   select owner_person_id into owner from core.organizations where id=org for update;
  end if;$old$;
 new_lock text:=$new$  if data_api or p_operation in (
   'centers_list_v1','people_list_v1','roles_list_v1',
   'settings_catalog_get_v1','settings_get_v1','subscription_get_v1'
  ) then
   -- Reads can overlap, but still conflict with organization writes and revocations.
   select owner_person_id into owner from core.organizations where id=org for share;
  else
   select owner_person_id into owner from core.organizations where id=org for update;
  end if;$new$;
begin
 if cardinality(string_to_array(body,old_lock))<>2 then
  raise exception 'Organization access lock anchor changed';
 end if;
 execute replace(body,old_lock,new_lock);
end$migration$;

commit;
