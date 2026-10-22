begin;
create table private.p05_configuration_scopes(entity_id uuid primary key,org_id uuid not null references core.organizations(id),center_id uuid,creator_person_id uuid not null,execution_center_ids uuid[],enabled boolean not null default true,foreign key(org_id,center_id) references core.centers(org_id,id),foreign key(org_id,creator_person_id) references core.people(org_id,id));
alter table private.p05_configuration_scopes enable row level security;
revoke all on private.p05_configuration_scopes from public,anon,authenticated;
grant all on private.p05_configuration_scopes to service_role;
create unique index p05_preference_identity on core.notification_preferences(org_id,person_id,channel,purpose);
create function private.p05_notification_payload(n core.notifications) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('template_key',coalesce(nullif(n.payload->>'template_key',''),n.kind),'subject',case
 when n.payload#>>'{subject,id}' ~ '^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$' and to_regclass('core.'||quote_ident(n.payload#>>'{subject,type}')) is not null then jsonb_build_object('type',n.payload#>>'{subject,type}','id',n.payload#>>'{subject,id}')
 when n.kind='seat_offer' then jsonb_build_object('type','seat_offers','id',n.subject_id)
 when n.kind='p01_expired' then jsonb_build_object('type',case when n.payload->>'operation'='request_expire_v1' then 'lesson_requests' else 'seat_offers' end,'id',n.subject_id)
 else jsonb_build_object('type','notifications','id',n.id) end)
$$;
create function private.p05_notification_page(r jsonb,org uuid,actor uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);cur jsonb;at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();items jsonb;token text;
 h text:=md5(jsonb_build_object('person',actor,'request',r-'request_id'-'page')::text);
begin
 if coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' or lim<1 or lim>200 then perform private.fail('VALIDATION_FAILED');end if;
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or at is null or last_id is null or asof is null or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'payload',private.p05_notification_payload(n),'created_at',n.created_at,'read_at',n.read_at) order by n.created_at,n.id),'[]'::jsonb) into items from
 (select * from core.notifications where org_id=org and recipient_person_id=actor and created_at<=asof and (not(r->>'unread_only')::bool or read_at is null) and (cur is null or (created_at,id)>(at,last_id)) order by created_at,id limit lim+1) n;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'created_at','id',items->-1->'id','as_of',asof)::text,'UTF8'),'hex');end if;
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof);
end$$;
create function private.p05_notifications(op text,r jsonb,org uuid,center uuid,actor uuid,operation uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare pid uuid:=private.new_id(ids,2);ver bigint:=1;data jsonb;subject text;c uuid;definition jsonb;row_data record;existing private.p05_configuration_scopes;cid uuid;segment uuid;condition jsonb;
begin
 if op='notifications_list_v1' then data:=private.p05_notification_page(r,org,actor);subject:='notifications';
 elsif op='notification_mark_read_v1' then
  update core.notifications set read_at=coalesce(read_at,clock_timestamp()),version=version+1 where org_id=org and id=(r->>'notification_id')::uuid and recipient_person_id=actor and version=(r->>'expected_version')::bigint returning id,version into pid,ver;
  if not found then perform private.fail('VERSION_CONFLICT');end if;subject:='notifications';
 elsif op='notification_preferences_set_v1' then
  -- Transactional in-app notices are mandatory. Optional messages default off.
  if r->>'purpose'='transactional' and not(r->>'enabled')::bool then perform private.fail('FORBIDDEN');end if;
  insert into core.notification_preferences(id,org_id,person_id,channel,purpose,enabled) values(pid,org,actor,'in_app',r->>'purpose',r->>'purpose'='transactional') on conflict do nothing;
  update core.notification_preferences set enabled=(r->>'enabled')::bool,version=version+1 where org_id=org and person_id=actor and channel='in_app' and purpose=r->>'purpose' and version=(r->>'expected_version')::bigint returning id,version into pid,ver;
  if not found then perform private.fail('VERSION_CONFLICT');end if;subject:='notification_preferences';
 elsif op in ('segment_save_v1','automation_save_v1') then
  c:=private.p05_configuration(org,center,actor,r->'scope');definition:=r->'definition';
  subject:=case when op='segment_save_v1' then 'segments' else 'automations' end;pid:=coalesce((r->>(case when op='segment_save_v1' then 'segment_id' else 'automation_id' end))::uuid,pid);
  select * into existing from private.p05_configuration_scopes where entity_id=pid and org_id=org;
  if existing.entity_id is null then
   if r->>'expected_version' is not null or r->>(case when op='segment_save_v1' then 'segment_id' else 'automation_id' end) is not null then perform private.fail('VERSION_CONFLICT');end if;
  elsif existing.center_id is distinct from c then perform private.fail('NOT_FOUND');
  elsif r->>'expected_version' is null then perform private.fail('VERSION_CONFLICT');end if;
  if op='segment_save_v1' then
   if coalesce(jsonb_array_length(definition->'all'),0)+coalesce(jsonb_array_length(definition->'any'),0)=0 then perform private.fail('VALIDATION_FAILED');end if;
   for condition in select value from jsonb_array_elements(coalesce(definition->'all','[]')||coalesce(definition->'any','[]')) loop
    if condition->>'operator'<>'is_null' and not(condition?'value') then perform private.fail('VALIDATION_FAILED');end if;
   end loop;
   if existing.entity_id is null then insert into core.segments(id,org_id,name,definition,state) values(pid,org,r->>'name',definition,'active');
   else update core.segments set name=r->>'name',definition=r->'definition',version=version+1 where org_id=org and id=pid and version=(r->>'expected_version')::bigint returning version into ver;if not found then perform private.fail('VERSION_CONFLICT');end if;end if;
  else
   if definition#>>'{action,channel}'<>'in_app' then perform private.fail('SERVICE_UNAVAILABLE');end if;
   if coalesce(jsonb_array_length(definition->'execution_center_ids'),0)=0 then perform private.fail('VALIDATION_FAILED');end if;
   for cid in select value::text::uuid from jsonb_array_elements_text(definition->'execution_center_ids') loop
    perform private.assert_center(org,cid);if c is not null and c<>cid then perform private.fail('FORBIDDEN');end if;
   end loop;
   segment:=(definition->>'segment_id')::uuid;
   if segment is not null and not exists(select 1 from core.segments s join private.p05_configuration_scopes x on x.entity_id=s.id where s.org_id=org and s.id=segment and s.state='active' and (x.center_id is null or (c is not null and x.center_id=c))) then perform private.fail('NOT_FOUND');end if;
   if existing.entity_id is null then insert into core.automations(id,org_id,name,trigger,segment_id,action,state) values(pid,org,definition->>'name',definition->'trigger',segment,definition->'action','active');
   else update core.automations set name=definition->>'name',trigger=definition->'trigger',segment_id=segment,action=definition->'action',version=version+1 where org_id=org and id=pid and version=(r->>'expected_version')::bigint returning version into ver;if not found then perform private.fail('VERSION_CONFLICT');end if;end if;
  end if;
  insert into private.p05_configuration_scopes(entity_id,org_id,center_id,creator_person_id,execution_center_ids,enabled) values(pid,org,c,actor,case when op='automation_save_v1' then array(select jsonb_array_elements_text(definition->'execution_center_ids')::uuid) end,coalesce((definition->>'enabled')::bool,true))
  on conflict(entity_id) do update set execution_center_ids=excluded.execution_center_ids,enabled=excluded.enabled,creator_person_id=excluded.creator_person_id;
 else perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('data',data,'primary_id',pid,'subject',subject,'version',ver);
end$$;
commit;
