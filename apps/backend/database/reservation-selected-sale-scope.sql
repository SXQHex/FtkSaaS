begin;

do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text:=$old$   perform private.reserve_negative(org,target,ses.id,record_id,p_ids,idx);selected:=(r->>'source_sale_id')::uuid;$old$;
begin
 if array_length(string_to_array(body,anchor),1)<>2 then
  raise exception 'Selected reservation sale fallback drift';
 end if;
 execute replace(body,anchor,$new$   selected:=(r->>'source_sale_id')::uuid;
   if selected is not null and not exists (
    select 1 from core.sales s where s.org_id=org and s.id=selected
     and private.p07_same_person(org,s.person_id,target)
     and private.lesson_scope_matches(org,ses.id,s.product_version_id)
   ) then raise;end if;
   perform private.reserve_negative(org,target,ses.id,record_id,p_ids,idx);$new$);
end$patch$;

commit;
