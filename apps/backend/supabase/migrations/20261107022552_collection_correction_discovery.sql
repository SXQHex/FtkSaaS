begin;
-- Extend the existing read-only action path. The original writer preflight
-- still checks live native session, tenant, center, plan and finance.refund.
-- An immutable ledger entry has no stored state; do not synthesize one.
do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.action_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 anchor:=$a$'debt_adjust_v1','sale_refund_preview_v1')$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Collection discovery operation anchor drift';end if;
 body:=replace(body,anchor,$a$'debt_adjust_v1','sale_refund_preview_v1','collection_correct_preview_v1')$a$);
 anchor:=$a$ if op='sale_refund_preview_v1' then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Collection discovery source anchor drift';end if;
 body:=replace(body,anchor,$a$ if op='collection_correct_preview_v1' then
  select c.id,c.person_id,c.version into entity_id,target,ver from core.cash_movements c
   where c.org_id=org and c.center_id=center and c.id=(k->>'cash_movement_id')::uuid and c.kind='collection' and c.previous_id is null;
  typ:='cash_movements';entity_state:=null;
 elsif op='sale_refund_preview_v1' then$a$);
 execute body;
 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$'debt_adjust_v1','sale_refund_preview_v1') then
  out:=private.action_management_page$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Collection discovery dispatch anchor drift';end if;
 execute replace(body,anchor,$a$'debt_adjust_v1','sale_refund_preview_v1','collection_correct_preview_v1') then
  out:=private.action_management_page$a$);
end$patch$;
notify pgrst,'reload schema';
commit;
