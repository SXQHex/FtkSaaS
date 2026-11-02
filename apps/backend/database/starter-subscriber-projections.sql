begin;
-- Starter person-bearing operational reads. Enrich already authorized rows only;
-- subscriber_number resolves aliases, never allocates numbers or grants access.
do $patch$
declare item record;body text;
begin
 for item in select * from (values
  ('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$a$'person_id',x.person_id,'role',x.role$a$,$a$'person_id',x.person_id,'subscriber_number',private.subscriber_number(org,x.person_id),'role',x.role$a$),
  ('private.schedule_class_views(uuid,uuid)',$a$'person_id',a.person_id,'duty',a.duty$a$,$a$'person_id',a.person_id,'subscriber_number',private.subscriber_number(org,a.person_id),'duty',a.duty$a$),
  ('private.lesson_obligation(uuid,uuid)',$a$'person_id',v.person_id,'existing_version'$a$,$a$'person_id',v.person_id,'subscriber_number',private.subscriber_number(org,v.person_id),'existing_version'$a$),
  ('private.p01_requests_page(jsonb,uuid,uuid,uuid)',$a$jsonb_build_object('alternatives',$a$,$a$jsonb_build_object('subscriber_number',private.subscriber_number(org,q.person_id),'alternatives',$a$),
  ('private.p01_wait_page(jsonb,uuid,uuid,uuid)',$a$jsonb_build_object('offers',$a$,$a$jsonb_build_object('subscriber_number',private.subscriber_number(org,w.person_id),'offers',$a$),
  ('private.p01_wait_page(jsonb,uuid,uuid,uuid)',$a$jsonb_agg(to_jsonb(o)-'org_id'-'center_id' order by$a$,$a$jsonb_agg((to_jsonb(o)-'org_id'-'center_id')||jsonb_build_object('subscriber_number',private.subscriber_number(org,o.person_id)) order by$a$)
 ) as patches(signature,anchor,replacement) loop
  body:=pg_get_functiondef(item.signature::regprocedure);
  if array_length(string_to_array(body,item.anchor),1)<>2 then raise exception 'Starter subscriber projection anchor drift: %',item.signature;end if;
  execute replace(body,item.anchor,item.replacement);
 end loop;
end$patch$;
notify pgrst,'reload schema';
commit;
