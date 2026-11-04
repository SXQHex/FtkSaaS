-- P05: basic manual candidate tracking reuses the person/lead/activity registry.
begin;
create function private.starter_basic_crm_request(op text,r jsonb,org uuid) returns void language plpgsql security invoker set search_path='' as $$
declare q jsonb:=r||coalesce(r#>'{selector,key}','{}'::jsonb);center uuid:=(r->>'center_id')::uuid;
begin
 if center is null then perform private.fail('VALIDATION_FAILED');end if;
 perform private.assert_center(org,center);
 if private.starter_scope_required(org) then perform private.fail('PLAN_LIMIT_REACHED');end if;
 if op='lead_save_v1' and r->>'operation' is null and q->>'source' not in ('manual','phone','whatsapp') then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 if op='crm_activity_save_v1' then
  -- Person-only student renewal/automation followups remain an advanced feature.
  if q->>'lead_id' is null then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
  if r->>'operation' is null and q->>'kind'='followup' and q->>'due_at' is null then perform private.fail('VALIDATION_FAILED');end if;
 end if;
end$$;
-- Checked replacements preserve all other Starter admission and paid-plan behavior.
do $patch$
declare body text;old text;
begin
 body:=pg_get_functiondef('private.starter_request_guard(text,jsonb,uuid)'::regprocedure);
 old:=$a$ if op='management_state_get_v1' then effective_op:=r->>'operation';end if;$a$;
 if array_length(string_to_array(body,old),1)<>2 then raise exception 'Starter CRM request anchor drift';end if;
 execute replace(body,old,old||E'\n'||$a$ if effective_op in ('leads_list_v1','lead_save_v1','crm_activity_save_v1') then
  perform private.starter_basic_crm_request(effective_op,r,org);return;
 end if;$a$);
 body:=pg_get_functiondef('private.require_feature(uuid,text)'::regprocedure);
 old:=$a$ if private.current_plan_name(org)='starter' then$a$;
 if array_length(string_to_array(body,old),1)<>2 then raise exception 'Starter CRM feature anchor drift';end if;
 execute replace(body,old,old||E'\n'||$a$  if feature='F21' then return;end if;$a$);
 body:=pg_get_functiondef('private.lesson_plan(uuid)'::regprocedure);
 old:=$a$p.features||array['F11','F13','F16','F25']$a$;
 if array_length(string_to_array(body,old),1)<>2 then raise exception 'Starter CRM plan anchor drift';end if;
 body:=replace(body,old,$a$p.features||array['F11','F13','F16','F21','F25']$a$);
 old:=$a$'F20','F21','F22'$a$;
 if array_length(string_to_array(body,old),1)<>2 then raise exception 'Starter CRM plan exclusion anchor drift';end if;
 execute replace(body,old,$a$'F20','F22'$a$);
 body:=pg_get_functiondef('private.p05_person_activity_access(uuid,uuid,uuid,jsonb)'::regprocedure);
 old:='begin';
 if array_length(string_to_array(body,old),1)<>2 then raise exception 'CRM advanced followup anchor drift';end if;
 execute replace(body,old,old||E'\n'||$a$ perform private.require_feature(org,'F23');$a$);
end$patch$;
-- Lead-bound notes/followups use F21; no-lead followups retain F23 above.
insert into private.runtime_operations(name,permission,billing_class,features) values('crm_activity_save_v1','crm.daily','maintenance',array['F21']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
revoke all on function private.starter_basic_crm_request(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.starter_basic_crm_request(text,jsonb,uuid) to service_role;
notify pgrst,'reload schema';
commit;
