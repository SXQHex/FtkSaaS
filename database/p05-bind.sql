begin;
create function private.p05_management(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';items jsonb;lim int:=coalesce((r#>>'{page,limit}')::int,50);cur jsonb;at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();token text;h text:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page')::text);
begin
 if r#>>'{selector,operation}' is distinct from op or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' or lim<1 or lim>200 then perform private.fail('VALIDATION_FAILED');end if;
 perform private.p05_access(op,r||k,org,center,actor,account);
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or at is null or last_id is null or asof is null or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with rows as(
 select f.id,f.created_at,f.version,f.state,'files'::text subject,jsonb_build_object('name',p.name,'mime',f.mime,'bytes',f.size_bytes) vals from core.files f join private.p05_files p on p.file_id=f.id where op='document_upload_prepare_v1' and f.org_id=org and f.center_id is not distinct from center and p.account_id=account
 union all select v.id,v.created_at,v.version,'published','document_versions',jsonb_build_object('document_id',v.document_id,'file_id',v.file_id,'version_label',v.version_label,'requirements',coalesce((select jsonb_agg(jsonb_build_object('gate',q.operation,'scope',q.scope,'renewed_acceptance',q.renewed_acceptance) order by q.id) from core.document_requirements q where q.org_id=org and q.document_version_id=v.id),'[]'::jsonb),'scope',k->'scope') from core.document_versions v join core.documents d on d.org_id=v.org_id and d.id=v.document_id where op in ('document_version_publish_v1','document_publication_preview_v1') and v.org_id=org and v.file_id=(k->>'file_id')::uuid and d.scope_center_id is not distinct from (k#>>'{scope,center_id}')::uuid and (k->>'document_id' is null or v.document_id=(k->>'document_id')::uuid)
 union all select f.id,f.created_at,f.version,f.state,'files',jsonb_build_object('file_id',f.id,'checksum',f.checksum) from core.files f join private.p05_files p on p.file_id=f.id where op='file_upload_complete_v1' and f.org_id=org and f.id=(k->>'file_id')::uuid and p.account_id=account
 union all select n.id,n.created_at,n.version,case when n.read_at is null then 'unread' else 'read' end,'notifications',jsonb_build_object('notification_id',n.id) from core.notifications n where op='notification_mark_read_v1' and n.org_id=org and n.id=(k->>'notification_id')::uuid and n.recipient_person_id=actor
 union all select n.id,n.created_at,n.version,'active','notification_preferences',jsonb_build_object('channel',n.channel,'purpose',n.purpose,'enabled',n.enabled) from core.notification_preferences n where op='notification_preferences_set_v1' and n.org_id=org and n.person_id=actor and n.channel=k->>'channel' and n.purpose=k->>'purpose'
 union all select s.id,s.created_at,s.version,s.state,'segments',jsonb_build_object('segment_id',s.id,'name',s.name,'definition',s.definition,'scope',k->'scope') from core.segments s join private.p05_configuration_scopes x on x.entity_id=s.id where op='segment_save_v1' and s.org_id=org and x.center_id is not distinct from (k#>>'{scope,center_id}')::uuid and (k->>'segment_id' is null or s.id=(k->>'segment_id')::uuid)
 union all select a.id,a.created_at,a.version,a.state,'automations',jsonb_build_object('automation_id',a.id,'definition',jsonb_build_object('name',a.name,'trigger',a.trigger,'action',a.action,'segment_id',a.segment_id,'execution_center_ids',x.execution_center_ids,'enabled',x.enabled),'scope',k->'scope') from core.automations a join private.p05_configuration_scopes x on x.entity_id=a.id where op='automation_save_v1' and a.org_id=org and x.center_id is not distinct from (k#>>'{scope,center_id}')::uuid and (k->>'automation_id' is null or a.id=(k->>'automation_id')::uuid)
 union all select a.id,a.created_at,a.version,'accepted','document_acceptances',jsonb_build_object('document_version_id',a.document_version_id,'context',a.context) from core.document_acceptances a where op='document_accept_v1' and a.org_id=org and a.person_id=actor and a.document_version_id=(k->>'document_version_id')::uuid
 ),page as(select * from rows where created_at<=asof and (cur is null or (created_at,id)>(at,last_id)) order by created_at,id limit lim+1)
 select coalesce(jsonb_agg(jsonb_build_object('operation',op,'entity',jsonb_build_object('type',subject,'id',id),'exists',true,'state',state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',subject,'id',id),'version',version)),'as_of',asof,'current',jsonb_build_object('operation',op,'values',vals),'_at',created_at) order by created_at,id),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',(items->-1)#>'{entity,id}','as_of',asof)::text,'UTF8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('data',jsonb_build_object('items',items,'next_cursor',token,'as_of',asof),'primary_id',org,'subject','organizations');
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);ops text:=$o$'document_publication_preview_v1','document_upload_prepare_v1','document_version_publish_v1','document_requirements_get_v1','document_accept_v1','file_upload_complete_v1','notifications_list_v1','notification_mark_read_v1','notification_preferences_set_v1','segment_save_v1','automation_save_v1'$o$;
 managed text:=$o$'document_publication_preview_v1','document_upload_prepare_v1','document_version_publish_v1','file_upload_complete_v1','notification_mark_read_v1','notification_preferences_set_v1','segment_save_v1','automation_save_v1','document_accept_v1'$o$;old text;
begin
 old:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if strpos(b,old)=0 then raise exception 'P05 access anchor missing';end if;
 b:=replace(b,old,old||E'\n'||' if p_operation in ('||ops||') then perform private.p05_access(p_operation,r,org,center,person,actor.id);end if;');
 old:=$a$ elsif perm_code='invite.student' then$a$;
 if strpos(b,old)=0 then raise exception 'P05 permission anchor missing';end if;
 b:=replace(b,old,' elsif p_operation in ('||ops||') then null;'||old);
 old:=$a$elsif perm_code='management.inspect' then$a$;
 if strpos(b,old)=0 then raise exception 'P05 management access anchor missing';end if;
 b:=replace(b,old,'elsif perm_code=''management.inspect'' and r->>''operation'' in ('||managed||') then perform private.p05_access(r->>''operation'',r||(r#>''{selector,key}''),org,center,person,actor.id);'||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';
 if strpos(b,old)=0 then raise exception 'P05 management domain anchor missing';end if;
 b:=replace(b,old,'if p_operation=''management_state_get_v1'' and r->>''operation'' in ('||managed||') then terms:=private.p05_management(r,org,center,person,actor.id);else '||old||'end if;');
 old:=' if mutable then';
 if strpos(b,old)=0 then raise exception 'P05 storage context anchor missing';end if;
 -- Only a trusted Edge may request internal metadata. This return is after live
 -- Auth/session/org/billing/permission checks and before any receipt mutation.
 b:=replace(b,old,$a$
 if p_operation='file_upload_complete_v1' and p_aux->>'phase'='storage_context' then
  select * into row_record from core.files where org_id=org and id=(r->>'file_id')::uuid;
  return jsonb_build_object('_internal_storage',jsonb_build_object('object_key',row_record.object_key,'bytes',row_record.size_bytes,'mime',row_record.mime,'checksum',row_record.checksum,'state',row_record.state));
 end if;
$a$||old);
 old:=' -- DOMAIN_CASES';
 if strpos(b,old)=0 then raise exception 'P05 case anchor missing';end if;
 b:=replace(b,old,$a$
 when 'document_publication_preview_v1','document_upload_prepare_v1','document_version_publish_v1','document_requirements_get_v1','document_accept_v1','file_upload_complete_v1' then
  terms:=private.p05_documents(p_operation,r,org,center,person,actor.id,operation_id,p_ids,p_aux);out:=terms->'data';if out='null'::jsonb then out:=null;end if;record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';version_n:=coalesce((terms->>'version')::bigint,1);
 when 'notifications_list_v1','notification_mark_read_v1','notification_preferences_set_v1','segment_save_v1','automation_save_v1' then
  terms:=private.p05_notifications(p_operation,r,org,center,person,operation_id,p_ids);out:=terms->'data';if out='null'::jsonb then out:=null;end if;record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';version_n:=coalesce((terms->>'version')::bigint,1);
 -- DOMAIN_CASES$a$);
 old:='   insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload)';
 if strpos(b,old)=0 then raise exception 'P05 notification ack anchor missing';end if;
 b:=replace(b,old,'   if p_operation not in (''notification_mark_read_v1'',''notification_preferences_set_v1'') then'||old);
 old:=$a$'in_app',operation_id::text,'pending',0,now());$a$;
 if strpos(b,old)=0 then raise exception 'P05 notification ack end missing';end if;
 b:=replace(b,old,old||'end if;');execute b;
end$patch$;
create function private.p05_document_gate() returns trigger language plpgsql security invoker set search_path='' as $$
declare ctx jsonb;target uuid;c uuid;g text;sid uuid;org uuid:=new.org_id;
begin
 if tg_table_name='reservations' then target:=new.person_id;c:=new.center_id;g:='reservation';sid:=new.id;
 elsif tg_table_name='sales' then target:=new.person_id;c:=new.center_id;g:='sale';sid:=new.id;
 elsif tg_table_name='event_registrations' then
  if tg_op='UPDATE' then if new.attendance_result is not distinct from old.attendance_result or new.attendance_result<>'attended' then return new;end if;g:='attendance';else g:='event_registration';end if;
  target:=new.person_id;c:=new.center_id;sid:=new.id;
 else
  if new.result<>'attended' then return new;end if;
  if tg_op='UPDATE' then if new.result is not distinct from old.result then return new;end if;end if;
  select person_id,center_id into target,c from core.reservations where org_id=org and id=new.reservation_id;g:='attendance';sid:=new.reservation_id;
 end if;
 ctx:=jsonb_build_object('gate',g,'subject',jsonb_build_object('type',case when tg_table_name='attendance_entries' then 'reservations' else tg_table_name end,'id',sid));
 perform private.p05_assert_documents(org,c,target,ctx);return new;
end$$;
create constraint trigger p05_reservation_document after insert on core.reservations deferrable initially deferred for each row execute function private.p05_document_gate();
create constraint trigger p05_sale_document after insert on core.sales deferrable initially deferred for each row execute function private.p05_document_gate();
create constraint trigger p05_event_document after insert or update on core.event_registrations deferrable initially deferred for each row execute function private.p05_document_gate();
create constraint trigger p05_attendance_document after insert or update on core.attendance_entries deferrable initially deferred for each row execute function private.p05_document_gate();
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
