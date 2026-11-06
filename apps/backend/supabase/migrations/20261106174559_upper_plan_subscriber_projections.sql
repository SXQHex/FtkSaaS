begin;
-- Add the canonical org subscriber number only to rows already authorized by
-- the existing projections. This read never allocates or changes a number.
do $patch$
declare item record;body text;
begin
 for item in select * from (values
  ('private.earnings_read(uuid,uuid,uuid,jsonb)',$a$'person_id',e.person_id,'center_id'$a$,$a$'person_id',e.person_id,'subscriber_number',private.subscriber_number(org,e.person_id),'center_id'$a$),
  ('private.earnings_management(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])',$a$'person_id',a.person_id,'center_id'$a$,$a$'person_id',a.person_id,'subscriber_number',private.subscriber_number(org,a.person_id),'center_id'$a$),
  ('private.p04_lead_view(core.leads,timestamp with time zone)',$a$'person_id',l.person_id,'source'$a$,$a$'person_id',l.person_id,'subscriber_number',private.subscriber_number(l.org_id,l.person_id),'source'$a$),
  ('private.event_projection(uuid,uuid,uuid,boolean,boolean)',$a$'person_id',r.person_id,'display_name'$a$,$a$'person_id',r.person_id,'subscriber_number',private.subscriber_number(org,r.person_id),'display_name'$a$),
  ('private.event_projection(uuid,uuid,uuid,boolean,boolean)',$a$'person_id',a.person_id,'duty'$a$,$a$'person_id',a.person_id,'subscriber_number',private.subscriber_number(org,a.person_id),'duty'$a$),
  ('private.preparation_view(uuid,uuid)',$a$'person_id',p.person_id,'center_id'$a$,$a$'person_id',p.person_id,'subscriber_number',private.subscriber_number(org,p.person_id),'center_id'$a$),
  ('private.settlement_dispatch(text,jsonb,uuid,uuid,uuid,uuid,uuid[])',$a$'person_id',target,'version'$a$,$a$'person_id',target,'subscriber_number',private.subscriber_number(org,target),'version'$a$),
  ('private.p04_followups_page(jsonb,uuid,uuid,uuid)',$a$'person_id',person_id,'center_id'$a$,$a$'person_id',person_id,'subscriber_number',private.subscriber_number(org,person_id),'center_id'$a$),
  ('private.p05_activity_page(jsonb,uuid,uuid,uuid,boolean)',$a$'person_id',target,'center_id'$a$,$a$'person_id',target,'subscriber_number',private.subscriber_number(org,target),'center_id'$a$)
 ) as patches(signature,anchor,replacement) loop
  body:=pg_get_functiondef(item.signature::regprocedure);
  if array_length(string_to_array(body,item.anchor),1)<>2 then raise exception 'Upper-plan subscriber projection anchor drift: %',item.signature;end if;
  execute replace(body,item.anchor,item.replacement);
 end loop;
end$patch$;
notify pgrst,'reload schema';
commit;
