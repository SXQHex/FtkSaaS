begin;
-- Enrich only already-authorized DTO rows. UUID inputs, scope and pagination stay unchanged.
do $patch$
declare item record;body text;
begin
 for item in select * from (values
  ('private.schedule_page(text,jsonb,uuid,uuid,uuid)',
   $a$'person_id',v.person_id,'state'$a$,
   $a$'person_id',v.person_id,'subscriber_number',private.subscriber_number(org,v.person_id),'state'$a$),
  ('private.lesson_view(uuid,uuid,boolean)',
   $a$'eligibility_snapshot',case when financial$a$,
   $a$'subscriber_number',private.subscriber_number(org,v.person_id),'eligibility_snapshot',case when financial$a$),
  ('private.purchased_rights(jsonb,uuid,uuid,uuid)',
   $a$'person_id',s.person_id,'product_version_id'$a$,
   $a$'person_id',s.person_id,'subscriber_number',private.subscriber_number(org,s.person_id),'product_version_id'$a$),
  ('private.p03_finance_read(jsonb,uuid,uuid,uuid,uuid)',
   $a$return jsonb_build_object('person_id',target,'currency'$a$,
   $a$return jsonb_build_object('person_id',target,'subscriber_number',private.subscriber_number(org,target),'currency'$a$),
  ('private.lesson_dispatch(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)',
   $a$jsonb_build_object('person_id',r->'person_id','center_id',center$a$,
   $a$jsonb_build_object('person_id',r->'person_id','subscriber_number',private.subscriber_number(org,(r->>'person_id')::uuid),'center_id',center$a$)
 ) as patches(signature,anchor,replacement) loop
  body:=pg_get_functiondef(item.signature::regprocedure);
  if array_length(string_to_array(body,item.anchor),1)<>2 then raise exception 'Subscriber operation projection anchor drift: %',item.signature;end if;
  execute replace(body,item.anchor,item.replacement);
 end loop;
end$patch$;
commit;
