-- Catalog and history use their own projections and never consume effective settings.
begin;

do $patch$
declare
 body text:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 changes text[][]:=array[
  array[$old$view jsonb:=private.frontend_settings_view(r,account,person);before jsonb:=view->'values';after jsonb;local jsonb;ver bigint:=(view->>'version')::bigint;$old$,
        $new$view jsonb;before jsonb;after jsonb;local jsonb;ver bigint;$new$],
  array[$old$begin
 if op='settings_update_v1' and r?'history_source' then$old$,
        $new$begin
 if op is distinct from 'settings_catalog_get_v1' and op is distinct from 'settings_history_get_v1' then
  view:=private.frontend_settings_view(r,account,person);
  before:=view->'values';
  ver:=(view->>'version')::bigint;
 end if;
 if op='settings_update_v1' and r?'history_source' then$new$]
 ];
 change text[];
begin
 foreach change slice 1 in array changes loop
  if cardinality(string_to_array(body,change[1]))<>2 then
   raise exception 'Effective settings projection anchor changed';
  end if;
  body:=replace(body,change[1],change[2]);
 end loop;
 execute body;
end$patch$;

commit;
