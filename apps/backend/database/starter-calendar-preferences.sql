begin;
-- FD05 preferences narrow an already-authorized calendar. No discovery grant,
-- campaign, reservation, receipt, or external recommendation provider is added.
create function private.calendar_preference_context(r jsonb,org uuid,account uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare pref_values jsonb;version bigint;history jsonb:='{}';interests bool:=coalesce((r->>'interest_filter')::bool,false);ranked bool:=r#>>'{page,sort}'='recommendation_desc';
begin
 if not interests and not coalesce(ranked,false) then return '{}'::jsonb;end if;
 if not exists(select 1 from core.account_links l join core.accounts a on a.id=l.account_id join core.people p on p.org_id=l.org_id and p.id=l.person_id where l.org_id=org and l.account_id=account and l.person_id=person and l.state='active' and l.verified_at is not null and a.state='active' and p.state='active') then perform private.fail('NOT_FOUND');end if;
 select s.values,s.version into pref_values,version from private.frontend_settings s where s.scope_key='member:'||org||':'||account;
 if coalesce(ranked,false) and coalesce((pref_values->>'history_recommendations')::bool,false) then
  select coalesce(jsonb_object_agg(x.discipline_id::text,x.n),'{}'::jsonb) into history from (
   select s.discipline_id,count(*) n from core.reservations v join core.sessions s on s.org_id=v.org_id and s.id=v.session_id and s.center_id=v.center_id
   join core.attendance_entries e on e.org_id=v.org_id and e.reservation_id=v.id and e.result='attended'
   where v.org_id=org and private.p07_same_person(org,v.person_id,person) and v.state='completed' and s.state='occurred' and s.attendance_state='closed' and s.ends_at<=statement_timestamp()
   and private.center_accessible(org,s.center_id) and private.starter_session_allowed(org,s.id,false)
   group by s.discipline_id
  ) x;
 end if;
 return jsonb_build_object('version',coalesce(version,0),'interest_filter',interests,
 'interest_center_ids',case when interests then coalesce(pref_values->'interest_center_ids','[]'::jsonb) else '[]'::jsonb end,
 'interest_discipline_ids',case when interests then coalesce(pref_values->'interest_discipline_ids','[]'::jsonb) else '[]'::jsonb end,'history',history);
end$$;
create function private.calendar_interest_match(pref jsonb,center uuid,discipline uuid,disciplines jsonb) returns bool language sql immutable security invoker set search_path='' as $$
 select not coalesce((pref->>'interest_filter')::bool,false) or (
 (jsonb_array_length(pref->'interest_center_ids')=0 or center in(select x::uuid from jsonb_array_elements_text(pref->'interest_center_ids') x))
 and (jsonb_array_length(pref->'interest_discipline_ids')=0 or discipline in(select x::uuid from jsonb_array_elements_text(pref->'interest_discipline_ids') x)
 or exists(select 1 from jsonb_array_elements_text(coalesce(disciplines,'[]'::jsonb)) d join jsonb_array_elements_text(pref->'interest_discipline_ids') i on d::uuid=i::uuid)))
$$;
create function private.calendar_preference_score(pref jsonb,discipline uuid) returns bigint language sql immutable security invoker set search_path='' as $$
 select coalesce((pref#>>array['history',discipline::text])::bigint,0)
$$;
do $patch$
declare b text;a text;n text;
begin
 b:=pg_get_functiondef('private.schedule_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=$a$ lo timestamptz:=(r#>>'{interval,starts_at}')::timestamptz;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference declaration anchor drift';end if;
 b:=replace(b,a,$a$ pref jsonb:=coalesce(r->'_calendar_preferences','{}'::jsonb);last_score bigint:=0;
$a$||a);
 a:=$a$(op='calendar_get_v1' and sort_name<>'starts_at_asc')$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference sort anchor drift';end if;
 b:=replace(b,a,$a$(op='calendar_get_v1' and sort_name not in ('starts_at_asc','recommendation_desc'))$a$);
 a:=$a$last_kind:=cur->>'kind';$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference cursor anchor drift';end if;
 b:=replace(b,a,a||$a$last_score:=coalesce((cur->>'score')::bigint,0);if last_score<0 then perform private.fail('VALIDATION_FAILED');end if;$a$);
 a:=$a$jsonb_agg(x.item order by x.starts_at,x.id,x.kind)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference aggregate anchor drift';end if;
 b:=replace(b,a,$a$jsonb_agg(x.item order by x.preference_score desc,x.starts_at,x.id,x.kind)$a$);
 a:=$a$select c.starts_at,c.id,c.kind,jsonb_build_object$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference score anchor drift';end if;
 b:=replace(b,a,$a$select private.calendar_preference_score(pref,c.discipline_id) preference_score,c.starts_at,c.id,c.kind,jsonb_build_object$a$);
 a:=$a$jsonb_build_object('_at',c.starts_at,'_kind',c.kind)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference metadata anchor drift';end if;
 b:=replace(b,a,$a$jsonb_build_object('_at',c.starts_at,'_kind',c.kind,'_preference_score',private.calendar_preference_score(pref,c.discipline_id))$a$);
 a:=$a$(cur is null or (c.starts_at,c.id,c.kind)>(at_time,last_id,last_kind))$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference keyset anchor drift';end if;
 b:=replace(b,a,$a$private.calendar_interest_match(pref,c.center_id,c.discipline_id,c.discipline_ids)
   and (cur is null or (-private.calendar_preference_score(pref,c.discipline_id),c.starts_at,c.id,c.kind)>(-last_score,at_time,last_id,last_kind))$a$);
 a:=$a$order by c.starts_at,c.id,c.kind limit lim+1$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference ordering anchor drift';end if;
 b:=replace(b,a,$a$order by private.calendar_preference_score(pref,c.discipline_id) desc,c.starts_at,c.id,c.kind limit lim+1$a$);
 a:=$a$'kind',last_item->>'_kind')$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference cursor score anchor drift';end if;
 b:=replace(b,a,$a$'kind',last_item->>'_kind','score',last_item->>'_preference_score')$a$);
 a:=$a$v-'_at'-'_kind'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference strip anchor drift';end if;
 execute replace(b,a,$a$v-'_at'-'_kind'-'_preference_score'$a$);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$out:=private.schedule_page(p_operation,r,org,person,center);$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference actor binding anchor drift';end if;
 execute replace(b,a,$a$out:=private.schedule_page(p_operation,case when p_operation='calendar_get_v1' then r||jsonb_build_object('_calendar_preferences',private.calendar_preference_context(r,org,actor.id,person)) else r end,org,person,center);$a$);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',6';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar preference catalog version anchor drift';end if;
 execute replace(b,a,'''catalog_version'',7');
end$patch$;
revoke all on function private.calendar_preference_context(jsonb,uuid,uuid,uuid),private.calendar_interest_match(jsonb,uuid,uuid,jsonb),private.calendar_preference_score(jsonb,uuid) from public,anon,authenticated;
grant execute on function private.calendar_preference_context(jsonb,uuid,uuid,uuid),private.calendar_interest_match(jsonb,uuid,uuid,jsonb),private.calendar_preference_score(jsonb,uuid) to service_role;
commit;
