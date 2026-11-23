begin;

-- Use the same fact set for the selected instructor, the directory and the directory's returned rows.
create function private.closed_earning_session_count(p_org uuid,p_center uuid,p_person uuid,p_interval jsonb)
returns bigint language sql stable security invoker set search_path='' as $$
 select count(distinct e.session_id)
 from core.earnings e join core.sessions s on s.org_id=e.org_id and s.id=e.session_id
 where e.org_id=p_org and e.center_id=p_center and s.attendance_state='closed' and e.previous_id is null
  and (p_person is null or private.p07_same_person(p_org,e.person_id,p_person))
  and (p_interval is null or e.created_at>=(p_interval->>'starts_at')::timestamptz
   and e.created_at<(p_interval->>'ends_at')::timestamptz)
$$;

create function private.earnings_period_summary(p_org uuid,p_center uuid,p_person uuid,p_interval jsonb)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('currency',q.currency,'net_minor',q.net::text) order by q.currency),'[]'::jsonb)
 from (
  select e.currency,sum(case when e.direction='add' then e.amount_minor else -e.amount_minor end) net
  from core.earnings e
  where e.org_id=p_org and e.center_id=p_center
   and e.person_id=any(private.p07_person_members(p_org,p_person))
   and e.created_at>=(p_interval->>'starts_at')::timestamptz and e.created_at<(p_interval->>'ends_at')::timestamptz
  group by e.currency
 ) q
$$;

do $patch$
declare
 body text:=pg_get_functiondef('private.instructor_finance_directory(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 old_count constant text:=$old$ select count(distinct e.session_id) into closed_count from core.earnings e join core.sessions s on s.org_id=e.org_id and s.id=e.session_id
 where e.org_id=p_org and e.center_id=p_center and s.attendance_state='closed' and e.previous_id is null
 and (r->>'person_id' is null or private.p07_same_person(p_org,e.person_id,(r->>'person_id')::uuid))
 and (not r?'interval' or e.created_at>=(r#>>'{interval,starts_at}')::timestamptz and e.created_at<(r#>>'{interval,ends_at}')::timestamptz);$old$;
 reply constant text:=$old$ return jsonb_build_object('data',data||jsonb_build_object('view',r->'view','totals',$old$;
begin
 if cardinality(string_to_array(body,old_count))<>2 or cardinality(string_to_array(body,reply))<>2 then
  raise exception 'Instructor closed session count anchor changed';
 end if;
 body:=replace(body,old_count,$new$ closed_count:=private.closed_earning_session_count(p_org,p_center,(r->>'person_id')::uuid,r->'interval');$new$);
 execute replace(body,reply,$new$ if r->'include_closed_session_count'='true'::jsonb then
  if r->>'view'<>'instructors' then perform private.fail('VALIDATION_FAILED');end if;
  select coalesce(jsonb_agg(x||jsonb_build_object('closed_session_count',
   private.closed_earning_session_count(p_org,p_center,(x->>'person_id')::uuid,r->'interval')) order by n),'[]')
  into items from jsonb_array_elements(data->'items') with ordinality q(x,n);
  data:=jsonb_set(data,'{items}',items);
 end if;
$new$||reply);
end$patch$;

do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor constant text:=$old$  out:=private.earnings_read(org,center,actor.id,r);$old$;
begin
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Self earnings dispatch anchor changed';end if;
 execute replace(body,anchor,$new$  if r->'summary_only'='true'::jsonb then
   if center is null or r#>>'{interval,starts_at}' is null or r#>>'{interval,ends_at}' is null
    or (r#>>'{interval,starts_at}')::timestamptz>=(r#>>'{interval,ends_at}')::timestamptz
    or r#>>'{page,cursor}' is not null or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc'
   then perform private.fail('VALIDATION_FAILED');end if;
   if (r->>'person_id')::uuid is distinct from person or not private.has_role(org,person,'instructor',center) then
    perform private.fail('FORBIDDEN');
   end if;
   out:=jsonb_build_object('items','[]'::jsonb,'next_cursor',null,'as_of',statement_timestamp(),
    'period_totals',private.earnings_period_summary(org,center,person,r->'interval'));
  else
$new$||anchor||$new$
  end if;$new$);
end$patch$;

do $patch$
declare
 body text:=pg_get_functiondef('private.studio_setup_list(jsonb,uuid,boolean)'::regprocedure);
 scope constant text:=$old$ bounds:=private.offset_page_bounds(r->'page','studio-setup:'||account||':'||queue);$old$;
 eligible constant text:=$old$  where (queue and s.organization_id is null and exists($old$;
 self_scope constant text:=$old$   or (not queue and s.account_id=account)$old$;
begin
 if cardinality(string_to_array(body,scope))<>2 or cardinality(string_to_array(body,eligible))<>2
  or cardinality(string_to_array(body,self_scope))<>2 then raise exception 'Studio setup queue selector anchor changed';end if;
 body:=replace(body,scope,$new$ bounds:=private.offset_page_bounds(r->'page','studio-setup:'||account||':'||queue||
  coalesce(':'||(r->>'setup_request_id'),''));$new$);
 body:=replace(body,eligible,$new$  where (r->>'setup_request_id' is null or s.id=(r->>'setup_request_id')::uuid)
   and ((queue and s.organization_id is null and exists($new$);
 execute replace(body,self_scope,self_scope||')');
end$patch$;

do $patch$
declare
 body text:=pg_get_functiondef('private.p04_public(text,jsonb,uuid[],jsonb)'::regprocedure);
 dispatch constant text:=$old$  org:=private.settings_public_slug(r->>'slug');$old$;
 interval_filter constant text:=$old$   and coalesce(s.starts_at,e.starts_at)>=(r#>>'{interval,starts_at}')::timestamptz and coalesce(s.starts_at,e.starts_at)<(r#>>'{interval,ends_at}')::timestamptz$old$;
 details constant text:=$old$case when coalesce((r->>'include_details')::bool,false) then private.public_program_details(p)$old$;
 reply constant text:=$old$  return jsonb_build_object('ok',true,'data',case when coalesce((r->>'include_details')::bool,false) then private.public_program_page_context(r)$old$;
begin
 if cardinality(string_to_array(body,dispatch))<>2 or cardinality(string_to_array(body,interval_filter))<>2
  or cardinality(string_to_array(body,details))<>2 or cardinality(string_to_array(body,reply))<>2 then
  raise exception 'Public calendar selection anchor changed';
 end if;
 body:=replace(body,dispatch,dispatch||$new$
  if coalesce(r->>'mode','calendar') not in ('calendar','context','event') then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'mode' in ('context','event') then
   if r?'interval' or r?'discipline_id' or r?'include_disciplines' or r?'include_details' or r#>>'{page,cursor}' is not null
    or coalesce(r#>>'{page,sort}','starts_at_asc')<>'starts_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
   if r->>'mode'='context' then
    if r?'publication_id' then perform private.fail('VALIDATION_FAILED');end if;
    return jsonb_build_object('ok',true,'data',private.public_program_page_context(r)||
     jsonb_build_object('items','[]'::jsonb,'next_cursor',null,'as_of',asof),'trace_id',trace);
   end if;
   if r->>'center_id' is null or r->>'publication_id' is null then perform private.fail('VALIDATION_FAILED');end if;
  elsif not r?'interval' or r?'publication_id' then perform private.fail('VALIDATION_FAILED');end if;$new$);
 body:=replace(body,interval_filter,$new$   and case when r->>'mode'='event' then
    p.id=(r->>'publication_id')::uuid and e.id is not null and e.starts_at>asof
   else coalesce(s.starts_at,e.starts_at)>=(r#>>'{interval,starts_at}')::timestamptz
    and coalesce(s.starts_at,e.starts_at)<(r#>>'{interval,ends_at}')::timestamptz end$new$);
 body:=replace(body,details,$new$case when r->>'mode'='event' or coalesce((r->>'include_details')::bool,false) then private.public_program_details(p)$new$);
 execute replace(body,reply,$new$  if r->>'mode'='event' then
   return jsonb_build_object('ok',true,'data',case when jsonb_array_length(items)>0 then private.public_program_page_context(r)
     || '{"publication_state":"available"}'::jsonb
    else '{"publication_state":"unavailable","application":{"state":"closed","form":null}}'::jsonb end||
    jsonb_build_object('items',items,'next_cursor',null,'as_of',asof),'trace_id',trace);
  end if;
$new$||reply);
end$patch$;

revoke all on function private.closed_earning_session_count(uuid,uuid,uuid,jsonb),
 private.earnings_period_summary(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.closed_earning_session_count(uuid,uuid,uuid,jsonb),
 private.earnings_period_summary(uuid,uuid,uuid,jsonb) to service_role;

commit;
