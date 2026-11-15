begin;
create function private.member_summary_enabled(org uuid,operations text[],request jsonb) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare op text;features text[];feature text;
begin
 foreach op in array operations loop
  select x.features into features from private.runtime_operations x where x.name=op;
  if features is null then perform private.fail('INTEGRITY_VIOLATION');end if;
  foreach feature in array features loop perform private.require_feature(org,feature);end loop;
  perform private.starter_request_guard(op,request,org);
 end loop;return true;
exception when sqlstate 'P0001' then
 if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','PLAN_LIMIT_REACHED') then return false;end if;raise;
end$$;
create function private.member_page_summary(org uuid,center uuid,actor uuid,target uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare members uuid[]:=private.p07_person_members(org,target);stamp timestamptz:=statement_timestamp();self boolean:=private.p07_same_person(org,actor,target);
 org_reader boolean:=private.is_org_reader(org,actor);cm boolean:=private.is_manager(org,actor,center);rights jsonb;debt jsonb;lesson jsonb;data jsonb;timed boolean;request jsonb:=jsonb_build_object('org_id',org,'center_id',center,'person_id',target);
begin
 if center is null then perform private.fail('VALIDATION_FAILED');end if;
 if not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 -- The no-session entitlement reader's original person/role boundary.
 if not (self or org_reader or (cm and private.person_operational_access(org,actor,center,target))) then rights:='{"status":"restricted"}';
 elsif not private.member_summary_enabled(org,array['entitlements_get_v1'],request) then rights:='{"status":"not_enabled"}';
 else
  timed:=true;
  begin perform private.require_feature(org,'F16');exception when sqlstate 'P0001' then if sqlerrm='PLAN_FEATURE_UNAVAILABLE' then timed:=false;else raise;end if;end;
  select jsonb_build_object('status','available','available_credits',coalesce(sum(greatest(0,private.available_for(org,s.id,stamp))) filter(where p.kind='credits'),0)::text)
   ||case when timed then jsonb_build_object('available_timed_packages',count(*) filter(where p.kind='timed' and private.available_for(org,s.id,stamp)>0)) else '{}'::jsonb end
   into rights from core.sales s join core.product_versions p on p.org_id=s.org_id and p.id=s.product_version_id
   where s.org_id=org and s.center_id=center and s.person_id=any(members) and (p.kind='credits' or timed);
 end if;
 -- finance.collect intentionally does not authorize finance_get/debt disclosure.
 if not (self or org_reader or cm) or (not self and not exists(select 1 from private.person_center_relationships x where x.org_id=org and x.center_id=center and x.person_id=any(members))) then debt:='{"status":"restricted"}';
 elsif not private.member_summary_enabled(org,array['finance_get_v1'],request) then debt:='{"status":"not_enabled"}';
 else
  select coalesce(jsonb_agg(jsonb_build_object('currency',x.currency,'remaining_minor',x.remaining::text) order by x.currency),'[]'::jsonb) into data
   from(select d.currency,sum(private.debt_remaining(org,d.id)) remaining from core.debts d
    where d.org_id=org and d.center_id=center and d.person_id=any(members) group by d.currency) x where x.remaining>0;
  debt:=jsonb_build_object('status','available','by_currency',data);
 end if;
 if not private.schedule_scope(org,actor,center) then lesson:='{"status":"restricted"}';
 elsif not private.member_summary_enabled(org,array['reservation_list_v1','session_get_v1'],request) then lesson:='{"status":"not_enabled"}';
 else
  -- Existing schedule_sessions_interval plus active_reservation supports a
  -- future-session lookup; no client or server pagination through old bookings.
  select jsonb_build_object('session_id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at) into data
   from core.sessions s where s.org_id=org and s.center_id=center
    and s.state='planned' and s.actual_started_at is null and s.starts_at>=stamp
    and private.session_readable(org,actor,s.id)
    and private.member_summary_enabled(org,array['session_get_v1'],request||jsonb_build_object('session_id',s.id))
    and exists(select 1 from core.reservations v where v.org_id=s.org_id and v.center_id=s.center_id and v.session_id=s.id
     and v.person_id=any(members) and v.state='active'
     and (org_reader or cm or private.schedule_staff(org,actor,center) or private.p07_same_person(org,v.person_id,actor) or private.session_assignee(org,actor,s.id)))
   order by s.starts_at,s.id limit 1;
  lesson:=jsonb_build_object('status','available','lesson',data);
 end if;
 return jsonb_build_object('as_of',stamp,'rights',rights,'debt',debt,'next_lesson',lesson);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=$a$ when 'people_list_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Member summary scope anchor drift';end if;
 b:=replace(b,a,a||$a$
  if coalesce((r->>'include_member_summary')::boolean,false) and center is null then perform private.fail('VALIDATION_FAILED');end if;$a$);
 a:=$a$ if out is null then out:=jsonb_build_object('operation_id'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Member summary final page anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='people_list_v1' and coalesce((r->>'include_member_summary')::boolean,false) then
  out:=jsonb_set(out,'{items}',coalesce((select jsonb_agg(x||jsonb_build_object('member_summary',private.member_page_summary(org,center,person,(x->>'id')::uuid)) order by n)
   from jsonb_array_elements(out->'items') with ordinality t(x,n)),'[]'::jsonb));
 end if;
$a$||a);
end$patch$;
revoke all on function private.member_summary_enabled(uuid,text[],jsonb),private.member_page_summary(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.member_summary_enabled(uuid,text[],jsonb),private.member_page_summary(uuid,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
