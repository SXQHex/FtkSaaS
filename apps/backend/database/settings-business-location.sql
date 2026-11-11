begin;
-- These are published business links, never fetch targets or session locations.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.settings_public_profile(uuid,uuid)'::regprocedure);
 a:=' return result;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Business location public projection drift';end if;
 execute replace(b,a,$a$ if selected?'location' then result:=result||jsonb_build_object('location',jsonb_build_object('map_url',v->'map_url','directions',coalesce(v->>'directions','')));end if;
 if selected?'website' then result:=result||jsonb_build_object('website_url',v->'website_url');end if;
$a$||a);
end$patch$;
notify pgrst,'reload schema';
commit;
