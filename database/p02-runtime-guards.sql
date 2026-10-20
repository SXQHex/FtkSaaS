-- Complete source dependency and original-authority guards found by targeted CI.
begin;
do $patch$
declare b text;old text;name text;
begin
 b:=pg_get_functiondef('private.p02_dependencies(uuid,uuid,uuid,uuid)'::regprocedure);
 old:=$p$'collections','student_credit_movements'$p$;
 if strpos(b,old)=0 then raise exception 'P02 dependency anchor missing';end if;
 execute replace(b,old,$p$'cash_movements','student_credit_movements','event_registrations','events','attendance_entries','attendance_closures'$p$);
 b:=pg_get_functiondef('private.lesson_impact_authorize(uuid,uuid,uuid,jsonb)'::regprocedure);
 old:=$p$ else perform private.fail('POLICY_NOT_CONFIGURED');end if;$p$;
 if strpos(b,old)=0 then raise exception 'P02 original authority anchor missing';end if;
 execute replace(b,old,$p$ elsif change->>'kind' in ('credit_adjust','entitlement_extend') then
  if center is null or not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
  if not exists(select 1 from core.sales s where s.org_id=org and s.center_id=center and s.id=(change->>'sale_id')::uuid) then perform private.fail('NOT_FOUND');end if;
 else perform private.fail('POLICY_NOT_CONFIGURED');end if;$p$);
 -- Rights/freeze technical previews do not send notifications. Their confirmed
 -- mutation reports to the affected student as well as the existing actor audit.
 foreach name in array array['p02_rights','p02_freeze'] loop
  b:=pg_get_functiondef(('private.'||name||'(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)')::regprocedure);
  old:=$p$
 return jsonb_build_object('data',data,'primary_id',$p$;
  if strpos(b,old)=0 then raise exception 'P02 notification anchor missing';end if;
  b:=replace(b,old,$p$
 perform private.p02_sale_notice(org,s.person_id,s.id,operation,ids,idx,op);
$p$||old);execute b;
 end loop;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
