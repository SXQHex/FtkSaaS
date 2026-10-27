-- FD07: new Starter organizations begin with zero negative credit.
-- Existing organizations and explicit policy histories are never backfilled.
begin;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
a text:=$a$  insert into core.saas_subscriptions(id,org_id,plan_version_id,state,cancel_at_period_end) values(private.new_id(p_ids,13),org,(r->>'initial_plan_id')::uuid,'pending_payment',false);$a$;
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Starter initial policy anchor drift';end if;
 execute replace(b,a,a||$a$
  if exists(select 1 from core.saas_plan_versions where id=(r->>'initial_plan_id')::uuid and name='starter') then
   insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value,previous_id,version)
    values(private.new_id(p_ids,31),org,null,'negative_default',transaction_timestamp(),false,'{"kind":"integer","value":0}'::jsonb,null,1);
   audit_delta:=jsonb_build_object('initial_policy',jsonb_build_object('key','negative_default','value',0,'source','FD07','policy_version_id',private.new_id(p_ids,31)));
  end if;$a$);
end$patch$;
notify pgrst,'reload schema';
commit;
