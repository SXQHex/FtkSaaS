-- W1-BE-28: recipient inbox projections and explicit atomic read-state changes.
begin;
create index notification_recipient_history on core.notifications(org_id,recipient_person_id,created_at,id);
create function private.notification_source_state(n core.notifications,actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare src jsonb:=private.p05_notification_payload(n)->'subject';kind text:=src->>'type';target uuid:=(src->>'id')::uuid;
 o core.seat_offers;l core.lesson_requests;a core.crm_activities;c uuid;selector jsonb;work_state text;req jsonb;
 empty jsonb:=jsonb_build_object('state','unavailable','center_id',null,'selector',null);
begin
 if kind='seat_offers' then
  select * into o from core.seat_offers where org_id=n.org_id and id=target;
  if o.id is null then return empty;end if;c:=o.center_id;
  req:=jsonb_build_object('org_id',n.org_id,'center_id',c,'person_id',o.person_id,'offer_id',o.id);
  perform private.p01_wait_access(req,n.org_id,actor,c);
  if not private.member_summary_enabled(n.org_id,array['seat_offer_accept_v1'],req) then return empty;end if;
  work_state:=case when o.state='active' and o.expires_at>statement_timestamp() then 'pending' when o.state='active' then 'unavailable' else 'completed' end;
  selector:=jsonb_build_object('operation','seat_offer_accept_v1','key',jsonb_build_object('offer_id',o.id));
 elsif kind='lesson_requests' then
  select * into l from core.lesson_requests where org_id=n.org_id and id=target;
  if l.id is null then return empty;end if;c:=l.center_id;
  req:=jsonb_build_object('org_id',n.org_id,'center_id',c,'lesson_request_id',l.id);
  perform private.p01_request_access('lesson_request_withdraw_v1',req,n.org_id,actor,c);
  if not private.member_summary_enabled(n.org_id,array['lesson_request_withdraw_v1'],req) then return empty;end if;
  work_state:=case when l.state in ('pending','alternative_offered') then 'pending' else 'completed' end;
  selector:=jsonb_build_object('operation','lesson_request_withdraw_v1','key',jsonb_build_object('lesson_request_id',l.id));
 elsif kind='crm_activities' then
  select * into a from core.crm_activities where org_id=n.org_id and id=target;
  if a.id is null then return empty;end if;c:=a.center_id;
  req:=jsonb_build_object('org_id',n.org_id,'center_id',c,'activity_id',a.id,'lead_id',a.lead_id,'person_id',a.person_id);
  if a.lead_id is null then perform private.p05_person_activity_access(n.org_id,c,actor,req);
  else perform private.p04_access('crm_activity_save_v1',req,n.org_id,c,actor);end if;
  if not private.member_summary_enabled(n.org_id,array['crm_activity_save_v1'],req) then return empty;end if;
  work_state:=case when a.kind<>'followup' then 'informational' when a.completed_at is null then 'pending' else 'completed' end;
  selector:=jsonb_build_object('operation','crm_activity_save_v1','key',jsonb_build_object('activity_id',a.id)||
   case when a.lead_id is null then jsonb_build_object('person_id',a.person_id) else jsonb_build_object('lead_id',a.lead_id) end);
 else return jsonb_build_object('state','informational','center_id',null,'selector',null);
 end if;
 if not private.center_accessible(n.org_id,c) then return empty;end if;
 if work_state='unavailable' then return empty;end if;
 return jsonb_build_object('state',work_state,'center_id',c,'selector',selector);
exception when sqlstate 'P0001' then
 if sqlerrm in ('FORBIDDEN','NOT_FOUND','PLAN_FEATURE_UNAVAILABLE','PLAN_LIMIT_REACHED','SERVICE_UNAVAILABLE','SUBSCRIPTION_NOT_STARTED','BILLING_OPERATION_RESTRICTED') then return empty;end if;raise;
end$$;
alter function private.p05_notification_page(jsonb,uuid,uuid) rename to notification_page_before_work;
create function private.p05_notification_page(r jsonb,org uuid,actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);stamp timestamptz:=statement_timestamp();cur jsonb;last_at timestamptz;last_id uuid;h text;items jsonb;token text;summary jsonb;base jsonb;
 wanted text:=coalesce(r->>'work_state','all');want_summary bool:=coalesce((r->>'include_summary')::bool,false);
begin
 if not(r?'query' or r?'work_state' or coalesce((r->>'include_work')::bool,false) or want_summary) then return private.notification_page_before_work(r,org,actor);end if;
 if actor is null then perform private.fail('NOT_FOUND');end if;
 perform private.require_feature(org,'F26');
 if lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' or wanted not in ('all','pending','completed','informational','unavailable')
  or (r?'query' and length(btrim(r->>'query'))=0) then perform private.fail('VALIDATION_FAILED');end if;
 h:=encode(extensions.digest(jsonb_build_object('actor',actor,'org',org,'request',r-'request_id'-'page','sort','created_at_asc')::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;stamp:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(stamp) or stamp>statement_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 -- Native preferences and provider readiness retain one implementation. This
 -- bounded one-row read contributes only its top-level metadata, never totals.
 base:=private.notification_page_before_work(jsonb_build_object('unread_only',false,'page',jsonb_build_object('limit',1)),org,actor)-'items'-'next_cursor'-'as_of';
 with source as materialized(
  select n.*,private.p05_notification_payload(n) safe_payload,private.notification_source_state(n,actor) work
   from core.notifications n where n.org_id=org and private.p07_same_person(org,n.recipient_person_id,actor) and n.created_at<=stamp
 ), matching as materialized(
  select * from source n where r->>'query' is null or strpos(lower(coalesce(n.safe_payload->>'title','')||' '||coalesce(n.safe_payload->>'body','')),lower(btrim(r->>'query')))>0
 ), selected as (
  select * from matching where (not coalesce((r->>'unread_only')::bool,false) or read_at is null) and (wanted='all' or work->>'state'=wanted)
   and (last_id is null or (created_at,id)>(last_at,last_id)) order by created_at,id limit lim+1
 ) select
  coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'version',n.version,'kind',n.kind,'payload',n.safe_payload,'created_at',n.created_at,'read_at',n.read_at,
    'email_job',private.transactional_email_status(n.id),'work',n.work) order by n.created_at,n.id) from selected n),'[]'),
  jsonb_build_object('total',(select count(*) from matching),'unread',(select count(*) from matching where read_at is null),
   'pending',(select count(*) from matching where work->>'state'='pending'),'completed',(select count(*) from matching where work->>'state'='completed'),
   'informational',(select count(*) from matching where work->>'state'='informational'),'unavailable',(select count(*) from matching where work->>'state'='unavailable')) into items,summary;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'created_at','id',items->-1->'id','as_of',stamp)::text,'utf8'),'hex');end if;
 return base||jsonb_build_object('items',items,'next_cursor',token,'as_of',stamp)||case when want_summary then jsonb_build_object('summary',summary) else '{}'::jsonb end;
end$$;
create function private.notification_read_scope(r jsonb,org uuid,actor uuid) returns void
language plpgsql stable security invoker set search_path='' as $$
begin
 if actor is null then perform private.fail('NOT_FOUND');end if;
 perform private.require_feature(org,'F26');
 if jsonb_array_length(r->'notifications') not between 1 and 100 or (select count(distinct x->>'id') from jsonb_array_elements(r->'notifications') x)<>jsonb_array_length(r->'notifications') then perform private.fail('VALIDATION_FAILED');end if;
 if (select count(*) from core.notifications n where n.org_id=org and private.p07_same_person(org,n.recipient_person_id,actor)
  and n.id in (select (x->>'id')::uuid from jsonb_array_elements(r->'notifications') x))<>jsonb_array_length(r->'notifications') then perform private.fail('NOT_FOUND');end if;
 -- Versions are checked after replay/row locking; valid same-key replay must
 -- not fail because the first successful command advanced those versions.
end$$;
create function private.notification_read_set(r jsonb,org uuid,actor uuid,operation uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare n core.notifications;entry jsonb;refs jsonb:='[]';changes jsonb:='[]';primary_id uuid:=(r#>>'{notifications,0,id}')::uuid;root_version bigint;
begin
 perform private.notification_read_scope(r,org,actor);
 for entry in select * from jsonb_array_elements(r->'notifications') x order by x->>'id' loop
  select * into n from core.notifications where org_id=org and id=(entry->>'id')::uuid and private.p07_same_person(org,recipient_person_id,actor) for update;
  if n.id is null then perform private.fail('NOT_FOUND');end if;
  if n.version<>(entry->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  update core.notifications set read_at=case when (r->>'read')::bool then coalesce(read_at,statement_timestamp()) else null end,version=version+1 where org_id=org and id=n.id returning version into n.version;
  refs:=refs||jsonb_build_array(jsonb_build_object('type','notifications','id',n.id));changes:=changes||jsonb_build_array(jsonb_build_object('id',n.id,'version',n.version));
  if n.id=primary_id then root_version:=n.version;end if;
 end loop;
 return jsonb_build_object('data',jsonb_build_object('operation_id',operation,'primary_id',primary_id,'version',root_version,'related',refs,'replayed',false),
  'primary_id',primary_id,'version',root_version,'subject','notifications','audit',jsonb_build_object('read',r->'read','notifications',changes));
end$$;
create function private.notification_selected_state(r jsonb,org uuid,actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare ids jsonb:=r#>'{selector,key,notification_ids}';scope jsonb;items jsonb;stamp timestamptz:=statement_timestamp();
begin
 scope:=jsonb_build_object('notifications',(select jsonb_agg(jsonb_build_object('id',v,'expected_version',1)) from jsonb_array_elements(ids) v));
 perform private.notification_read_scope(scope,org,actor);
 if r#>>'{selector,operation}' is distinct from 'notifications_read_set_v1' or r->>'operation' is distinct from 'notifications_read_set_v1'
  or r#>>'{page,cursor}' is not null or coalesce((r#>>'{page,limit}')::int,50)<jsonb_array_length(ids)
  or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 select coalesce(jsonb_agg(jsonb_build_object('operation','notifications_read_set_v1','entity',jsonb_build_object('type','notifications','id',n.id),'exists',true,
  'state',case when n.read_at is null then 'unread' else 'read' end,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','notifications','id',n.id),'version',n.version)),
  'as_of',stamp,'current',null) order by n.created_at,n.id),'[]') into items from core.notifications n
  where n.org_id=org and n.id in (select v::uuid from jsonb_array_elements_text(ids) v) and private.p07_same_person(org,n.recipient_person_id,actor);
 return jsonb_build_object('items',items,'next_cursor',null,'as_of',stamp);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=$a$ elsif p_operation in ('document_publication_preview_v1','document_upload_prepare_v1'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Notification batch permission anchor drift';end if;
 b:=replace(b,a,$a$ elsif p_operation='notifications_read_set_v1' then
  perform private.notification_read_scope(r,org,person);
$a$||a);
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Notification selected read dispatch anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation'='notifications_read_set_v1' then
  out:=private.notification_selected_state(r,org,person);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
 a:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Notification batch domain anchor drift';end if;
 b:=replace(b,a,$a$ when 'notifications_read_set_v1' then
  terms:=private.notification_read_set(r,org,person,operation_id);out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;version_n:=(terms->>'version')::bigint;subject:=terms->>'subject';audit_delta:=terms->'audit';
$a$||a);
 a:=$a$('notification_mark_read_v1','notification_preferences_set_v1','import_preview_v1')$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Read-state notification suppression anchor drift';end if;
 execute replace(b,a,$a$('notification_mark_read_v1','notifications_read_set_v1','notification_preferences_set_v1','import_preview_v1')$a$);
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('notifications_read_set_v1','notification.self','maintenance',array['F26']::text[]);
create function api_v1.notifications_read_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb
language sql security invoker set search_path='' as $$select private.execute_operation('notifications_read_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function private.notification_selected_state(jsonb,uuid,uuid),private.notification_read_scope(jsonb,uuid,uuid),private.notification_source_state(core.notifications,uuid),private.p05_notification_page(jsonb,uuid,uuid),private.notification_read_set(jsonb,uuid,uuid,uuid),api_v1.notifications_read_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.notification_selected_state(jsonb,uuid,uuid),private.notification_read_scope(jsonb,uuid,uuid),private.notification_source_state(core.notifications,uuid),private.p05_notification_page(jsonb,uuid,uuid),private.notification_read_set(jsonb,uuid,uuid,uuid),api_v1.notifications_read_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
