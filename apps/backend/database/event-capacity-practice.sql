-- P08 event capacity and package-only participation share the existing event lifecycle.
begin;
alter table core.events alter column nominal drop not null,alter column maximum drop not null;
alter table core.events add constraint event_capacity_pair check((nominal is null and maximum is null) or (nominal is not null and maximum is not null and 0<=nominal and nominal<=maximum));
alter table core.events add constraint event_room_requires_finite_capacity check(venue->>'kind'<>'internal' or nominal is not null);
alter table core.event_registrations add column if not exists package_eligible_at_attendance boolean;

create function private.event_capacity_error(org uuid,center uuid,venue jsonb,maximum bigint) returns text language plpgsql stable security invoker set search_path='' as $$
declare lim bigint;
begin
 if venue->>'kind'<>'internal' then return null;end if;
 if maximum is null then return 'VALIDATION_FAILED';end if;
 select capacity into lim from core.rooms where org_id=org and center_id=center and id=(venue->>'room_id')::uuid and state='active';
 if not found then return 'NOT_FOUND';end if;
 if lim is null then return 'POLICY_NOT_CONFIGURED';end if;
 if maximum>lim then return 'CAPACITY_FULL';end if;
 return null;
end$$;
create function private.event_capacity_request(org uuid,center uuid,r jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare error text;n bigint:=(r#>>'{capacity,nominal}')::bigint;m bigint:=(r#>>'{capacity,maximum}')::bigint;
begin
 if r#>>'{capacity,kind}'='unlimited' then
  if r#>>'{venue,kind}'='internal' then perform private.fail('VALIDATION_FAILED');end if;
 elsif n is null or m is null or n<0 or n>m then perform private.fail('VALIDATION_FAILED');end if;
 error:=private.event_capacity_error(org,center,r->'venue',m);
 if error is not null then perform private.fail(error);end if;
 if r#>>'{terms,package_usage}'='eligibility_only' and ((r#>>'{terms,fee_minor}')::bigint<>0 or jsonb_array_length(r#>'{terms,allowed_product_version_ids}')=0) then perform private.fail('VALIDATION_FAILED');end if;
end$$;
create function private.event_room_capacity_guard(org uuid,center uuid,room uuid,lim bigint) returns void language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from core.events e where e.org_id=org and e.center_id=center and e.venue->>'kind'='internal' and (e.venue->>'room_id')::uuid=room and e.state in ('draft','published') and
  (lim is null or e.maximum>lim or (select count(*) from core.event_registrations r where r.org_id=org and r.event_id=e.id and r.state='active')>lim)) then perform private.fail('CAPACITY_FULL');end if;
end$$;
-- No copied eligibility state: callers already hold the same organization lock as
-- sales/freeze/lesson commands. Reads are advisory; commands recompute atomically.
create function private.event_package_scope_matches(p_org_id uuid,p_event_id uuid,p_product_version_id uuid,p_usage text)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(
  select 1 from core.events e
  cross join lateral (
   select count(*) n,(array_agg(ed.discipline_id))[1] single_id
   from core.event_disciplines ed where ed.org_id=e.org_id and ed.event_id=e.id
  ) tags
  join core.product_scopes s on s.org_id=e.org_id and s.product_version_id=p_product_version_id
  where e.org_id=p_org_id and e.id=p_event_id
   and p_usage=any(s.usage_targets)
   and s.class_id is null
   and (s.event_id is null or s.event_id=e.id)
   and (
    (s.scope_kind in ('center_discipline','center_all_disciplines') and s.center_id=e.center_id)
    or s.scope_kind in ('organization_discipline','organization_all')
   )
   and (
    s.scope_kind in ('center_all_disciplines','organization_all')
    or (tags.n=1 and s.scope_kind in ('center_discipline','organization_discipline') and s.discipline_id=tags.single_id)
   )
 );
$$;
create or replace function private.event_package_scope_matches(p_org_id uuid,p_event_id uuid,p_product_version_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select private.event_package_scope_matches(p_org_id,p_event_id,p_product_version_id,'event')
$$;
create function private.event_package_eligible(org uuid,event uuid,target uuid,p_terms jsonb,source uuid default null) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from core.sales s join core.events e on e.org_id=s.org_id and e.id=event
 where s.org_id=org and s.person_id=target and (source is null or s.id=source)
 and p_terms->'allowed_product_version_ids' @> to_jsonb(array[s.product_version_id::text])
 and private.event_package_scope_matches(org,event,s.product_version_id)
 and private.event_package_scope_matches(org,event,s.product_version_id,'lesson')
 and private.available_for(org,s.id,e.starts_at)>=1
 and (not coalesce((p_terms->>'full_payment_required')::bool,false) or not exists(select 1 from core.debts d where d.org_id=org and d.sale_id=s.id and private.debt_remaining(org,d.id)>0)))
$$;
create function private.event_attendance_package(org uuid,reg uuid,result text,cm bool,r jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare v core.event_registrations;eligible bool;
begin
 select * into v from core.event_registrations where org_id=org and id=reg;
 if v.terms_snapshot->>'package_usage' is distinct from 'eligibility_only' then
  if coalesce((r->>'record_ineligible_attendance')::bool,false) then perform private.fail('VALIDATION_FAILED');end if;
  return;
 end if;
 eligible:=private.event_package_eligible(org,v.event_id,v.person_id,v.terms_snapshot);
 if coalesce((r->>'record_ineligible_attendance')::bool,false) and (not cm or result<>'attended' or eligible or length(btrim(coalesce(r->>'reason','')))=0) then perform private.fail('FORBIDDEN');end if;
 if result='attended' and not eligible and not coalesce((r->>'record_ineligible_attendance')::bool,false) then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;
 update core.event_registrations set package_eligible_at_attendance=eligible where org_id=org and id=reg;
end$$;
-- A migration-only checked replacement avoids copying the evolving dispatcher.
create function private.event_access_patch(signature text,old_text text,new_text text) returns void language plpgsql set search_path='' as $$
declare body text:=pg_get_functiondef(signature::regprocedure);
begin
 if array_length(string_to_array(body,old_text),1)<>2 then raise exception 'Event access source anchor drift: %',signature;end if;
 execute replace(body,old_text,new_text);
end$$;
select private.event_access_patch('private.event_consumes(uuid,uuid,text,jsonb)',$old$ if result='attended' then return true;end if;$old$,$new$ if terms->>'package_usage'='eligibility_only' and result in ('attended','no_show','blocked') then return false;end if;
 if result='attended' then return true;end if;$new$);
select private.event_access_patch('private.event_view(uuid,uuid)',$old$'capacity',jsonb_build_object('nominal',e.nominal,'maximum',e.maximum)$old$,$new$'capacity',case when e.nominal is null then jsonb_build_object('kind','unlimited') else jsonb_build_object('nominal',e.nominal,'maximum',e.maximum) end$new$);
select private.event_access_patch('private.event_projection(uuid,uuid,uuid,boolean,boolean)',$old$'participant_cancellation',r.participant_cancellation$old$,$new$'participant_cancellation',r.participant_cancellation,'package_eligible',case when r.terms_snapshot->>'package_usage'='eligibility_only' then private.event_package_eligible(org,r.event_id,r.person_id,r.terms_snapshot) else null end,'package_eligible_at_attendance',r.package_eligible_at_attendance$new$);
select private.event_access_patch('private.event_eligibility(uuid,uuid,uuid,uuid)',$old$declare e core.events;s core.sales;$old$,$new$declare e core.events;s core.sales;capacity_error text;$new$);
select private.event_access_patch('private.event_eligibility(uuid,uuid,uuid,uuid)',$old$ if (select count(*) from core.event_registrations where org_id=org and event_id=event and state='active')>=e.nominal$old$,$new$ capacity_error:=private.event_capacity_error(org,e.center_id,e.venue,e.maximum);
 if capacity_error is not null then return capacity_error;end if;
 if (select count(*) from core.event_registrations where org_id=org and event_id=event and state='active')>=e.nominal$new$);
select private.event_access_patch('private.event_eligibility(uuid,uuid,uuid,uuid)',$old$ if source is null then$old$,$new$ if e.terms->>'package_usage'='eligibility_only' then
  if private.event_package_eligible(org,event,target,e.terms,source) then return null;end if;
  return 'ENTITLEMENT_UNAVAILABLE';
 end if;
 if source is null then$new$);
select private.event_access_patch('private.preparation_eligibility(uuid,uuid,uuid,uuid)',$old$ if preparation is null then$old$,$new$ if e.terms->>'package_usage'='eligibility_only' then
  if preparation is not null then return 'VALIDATION_FAILED';end if;
  return null;
 end if;
 if preparation is null then$new$);
select private.event_access_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$ when 'event_save_v1' then$old$,$new$ when 'event_save_v1' then
  perform private.event_capacity_request(org,center,r);$new$);
select private.event_access_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$   audit_delta:=jsonb_build_object('before',jsonb_build_object('name',row_record.name,'capacity',row_record.capacity));$old$,$new$   perform private.event_room_capacity_guard(org,center,record_id,(r->>'capacity')::bigint);
   audit_delta:=jsonb_build_object('before',jsonb_build_object('name',row_record.name,'capacity',row_record.capacity));$new$);
select private.event_access_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$ when 'event_payment_prepare_v1' then$old$,$new$ when 'event_payment_prepare_v1' then
  if exists(select 1 from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid and terms->>'package_usage'='eligibility_only') then perform private.fail('VALIDATION_FAILED');end if;$new$);
select private.event_access_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$   if r->>'sale_id' is not null then
    selected:=private.reserve_right$old$,$new$   if r->>'sale_id' is not null and terms->>'package_usage' is distinct from 'eligibility_only' then
    selected:=private.reserve_right$new$);
select private.event_access_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$  record_id:=reg.id;update core.event_registrations set attendance_result=r->>'result',version=version+1 where id=record_id and version=(r->>'expected_version')::bigint returning version into version_n;$old$,$new$  perform private.event_attendance_package(org,reg.id,r->>'result',cm,r);
  record_id:=reg.id;update core.event_registrations set attendance_result=r->>'result',version=version+1 where id=record_id and version=(r->>'expected_version')::bigint returning version into version_n;$new$);
-- Closed correction has a separate revision update; it uses the same gate and
-- factual snapshot, never a second implementation of package eligibility.
select private.event_access_patch('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)',$old$  do_consume:=private.event_consumes(org,center,r->>'result',reg.terms_snapshot);$old$,$new$  perform private.event_attendance_package(org,reg.id,r->>'result',cm,r);
  do_consume:=private.event_consumes(org,center,r->>'result',reg.terms_snapshot);$new$);
drop function private.event_access_patch(text,text,text);
revoke all on function private.event_package_scope_matches(uuid,uuid,uuid,text),private.event_capacity_error(uuid,uuid,jsonb,bigint),private.event_capacity_request(uuid,uuid,jsonb),private.event_room_capacity_guard(uuid,uuid,uuid,bigint),private.event_package_eligible(uuid,uuid,uuid,jsonb,uuid),private.event_attendance_package(uuid,uuid,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function private.event_package_scope_matches(uuid,uuid,uuid,text),private.event_capacity_error(uuid,uuid,jsonb,bigint),private.event_capacity_request(uuid,uuid,jsonb),private.event_room_capacity_guard(uuid,uuid,uuid,bigint),private.event_package_eligible(uuid,uuid,uuid,jsonb,uuid),private.event_attendance_package(uuid,uuid,text,boolean,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
