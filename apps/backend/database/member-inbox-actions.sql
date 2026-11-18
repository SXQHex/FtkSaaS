-- W1-BE-47/48: organization inbox mark-all and recipient-scoped session navigation.
begin;

alter function private.notification_source_state(core.notifications,uuid) rename to notification_source_before_participant;
create function private.notification_source_state(n core.notifications, actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 source_center uuid;
 informational jsonb:=jsonb_build_object('state','informational','center_id',null,'selector',null);
begin
 if n.kind<>'session_changed_for_participant' then
  return private.notification_source_before_participant(n,actor);
 end if;
 select s.center_id into source_center
 from core.sessions s
 where s.org_id=n.org_id and s.id=n.subject_id and s.state<>'cancelled'
  and exists(
   select 1 from core.reservations v
   where v.org_id=s.org_id and v.center_id=s.center_id and v.session_id=s.id
    and v.state='active' and v.person_id=any(private.p07_person_members(n.org_id,actor))
  );
 if source_center is null then return informational;end if;
 perform private.member_self_access(n.org_id,source_center,actor,array['reservation_list_v1']);
 if not private.starter_session_allowed(n.org_id,n.subject_id,false)
  or not private.session_readable(n.org_id,actor,n.subject_id) then return informational;end if;

 return informational||jsonb_build_object('reservation_target',
  jsonb_build_object('operation','reservation_list_v1','center_id',source_center,
   'key',jsonb_build_object('session_id',n.subject_id)));
exception when sqlstate 'P0001' then
 if sqlerrm in ('FORBIDDEN','NOT_FOUND','PLAN_FEATURE_UNAVAILABLE','PLAN_LIMIT_REACHED',
  'SERVICE_UNAVAILABLE','SUBSCRIPTION_NOT_STARTED','BILLING_OPERATION_RESTRICTED') then return informational;end if;
 raise;
end$$;

alter function private.notification_read_scope(jsonb,uuid,uuid) rename to notification_selection_scope;
create function private.notification_read_scope(r jsonb,org uuid,actor uuid) returns void
language plpgsql stable security invoker set search_path='' as $$
begin
 if not (r?'all_unread') then
  perform private.notification_selection_scope(r,org,actor);
  return;
 end if;
 if r->'all_unread' is distinct from 'true'::jsonb or r->'read' is distinct from 'true'::jsonb
  or r?'notifications' or r->>'center_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
 perform private.require_feature(org,'F26');
 if not exists(select 1 from core.people p where p.org_id=org and p.id=actor and p.state='active') then
  perform private.fail('NOT_FOUND');
 end if;
end$$;

alter function private.notification_read_set(jsonb,uuid,uuid,uuid) rename to notification_selection_read_set;
create function private.notification_read_set(r jsonb,org uuid,actor uuid,operation uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 members uuid[];
 affected bigint;
 stamp timestamptz:=statement_timestamp();
begin
 if not (r?'all_unread') then return private.notification_selection_read_set(r,org,actor,operation);end if;

 perform private.notification_read_scope(r,org,actor);
 members:=private.p07_person_members(org,actor);
 -- Match the explicit batch's lock order when either command touches the same row.
 with selected as materialized (
  select n.id from core.notifications n where n.org_id=org and n.recipient_person_id=any(members)
   and n.read_at is null and n.created_at<=stamp
  order by n.id for update
 )
 update core.notifications n set read_at=stamp,version=n.version+1
 from selected where n.org_id=org and n.id=selected.id;
 get diagnostics affected=row_count;

 return jsonb_build_object('data',jsonb_build_object('operation_id',operation,'primary_id',actor,
  'related','[]'::jsonb,'replayed',false),'primary_id',actor,'subject','people',
  'audit',jsonb_build_object('all_unread',true,'updated_count',affected));
end$$;

do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text:=$old$  if receipt.payload_hash<>payload_digest then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;$old$;
begin
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Inbox receipt scope anchor drift';end if;
 body:=replace(body,anchor,anchor||$new$
  if p_operation='notifications_read_set_v1' and r?'all_unread' and receipt.state='succeeded'
   and private.p07_same_person(org,(receipt.result#>>'{data,primary_id}')::uuid,person) is not true then perform private.fail('NOT_FOUND');end if;$new$);
 anchor:=$old$ if p_aux->>'phase'='p06_authorize_original' then$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Inbox recovery scope anchor drift';end if;
 execute replace(body,anchor,anchor||$new$
  if p_operation='notifications_read_set_v1' and r?'all_unread' and not exists(
   select 1 from core.operation_receipts o where o.org_id=org and o.actor_account_id=actor.id
    and o.operation=p_operation and o.key_hash=encode(extensions.digest(r->>'operation_key','sha256'),'hex')
    and private.p07_same_person(org,o.business_reference,person)
  ) then perform private.fail('NOT_FOUND');end if;$new$);
end$patch$;

revoke all on function private.notification_source_state(core.notifications,uuid),
 private.notification_read_scope(jsonb,uuid,uuid),private.notification_read_set(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.notification_source_state(core.notifications,uuid),
 private.notification_read_scope(jsonb,uuid,uuid),private.notification_read_set(jsonb,uuid,uuid,uuid) to service_role;
commit;
