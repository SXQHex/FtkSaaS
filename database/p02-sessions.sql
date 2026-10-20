-- P02-A: explicit center session cancellation and linked replacement creation.
begin;
create function private.p02_notice(org uuid,recipient uuid,subject uuid,kind text,operation uuid,ids uuid[],idx int) returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(private.new_id(ids,idx),org,recipient,kind,subject,jsonb_build_object('template_key',kind,'subject',jsonb_build_object('type','sessions','id',subject)));
 insert into core.outbox_jobs(id,org_id,notification_id,kind,dedupe_key,state,attempts,next_attempt_at) values(private.new_id(ids,idx+1),org,private.new_id(ids,idx),'in_app',operation::text||':'||recipient::text||':'||subject::text,'pending',0,clock_timestamp());
end$$;
create function private.p02_session_dispatch(op text,r jsonb,org uuid,center uuid,account uuid,person uuid,operation uuid,ids uuid[],aux jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.sessions;v core.reservations;recipient record;pv core.previews;pp private.preview_payloads;request_data jsonb:=r;data jsonb;dep jsonb;effects jsonb:='[]';proposal jsonb;rows_data jsonb;pid uuid:=private.new_id(ids,2);idx int:=20;reason text;before_data jsonb;ver bigint:=1;
begin
 if op='session_cancel_apply_v1' then
  select * into pv from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid for update;
  select * into pp from private.preview_payloads where preview_id=pv.id;
  if pv.id is null or pv.state<>'current' or pv.operation<>op or pv.actor_account_id<>account or pp.expires_at<=clock_timestamp() or pp.token_hash is distinct from encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') or (pp.payload->>'center_id')::uuid is distinct from center then perform private.fail('PREVIEW_STALE');end if;
  request_data:=pp.payload->'request';
 end if;
 select * into s from core.sessions where org_id=org and center_id=center and id=coalesce((request_data->>'session_id')::uuid,(r->>'replaces_id')::uuid) for update;
 if s.id is null then perform private.fail('NOT_FOUND');end if;
 before_data:=to_jsonb(s);reason:=request_data->>'reason';
 if op='replacement_session_create_v1' then
  if s.state<>'cancelled' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  proposal:=private.schedule_snapshot(org,s.id)-'expected_version';
  proposal:=proposal||jsonb_build_object('id',pid,'program_id',null,'starts_at',r#>'{interval,starts_at}','ends_at',r#>'{interval,ends_at}','nominal',r#>'{capacity,nominal}','maximum',r#>'{capacity,maximum}','resources',r->'resources','assignment_mode','explicit','_touch',true);
  rows_data:=private.schedule_validate(org,center,jsonb_build_array(proposal));
  perform private.schedule_write(org,rows_data,ids,idx);
  update core.sessions set replaces_id=s.id where org_id=org and id=pid;
 else
  if s.attendance_state<>'open' then perform private.fail('ATTENDANCE_CLOSED');end if;
  if s.state<>'planned' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if length(btrim(coalesce(reason,'')))=0 then perform private.fail('VALIDATION_FAILED');end if;
  rows_data:=jsonb_build_array(private.schedule_snapshot(org,s.id));
  dep:=private.schedule_dependencies(org,center,account,s.class_id,rows_data);
  dep:=jsonb_set(dep,'{policy_hashes}',(dep->'policy_hashes')||jsonb_build_array(md5(coalesce((select jsonb_agg(to_jsonb(w) order by w.id)::text from core.waitlist_entries w where w.org_id=org and w.session_id=s.id),''))));
  if op='session_cancel_preview_v1' then
   select coalesce(jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','reservations','id',q.id),'action','cancel','reason',reason) order by q.id),'[]'::jsonb) into effects from core.reservations q where q.org_id=org and q.session_id=s.id and q.state='active';
   effects:=effects||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sessions','id',s.id),'action','cancel','reason',reason));
   select effects||coalesce(jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','entitlement_allocations','id',a.id),'action','release','quantity',a.quantity,'reason',case when x.valid_until<=clock_timestamp() then 'Returned rights are outside sale validity; explicit extension is separate' else reason end) order by a.id),'[]'::jsonb) into effects from core.entitlement_allocations a join core.reservations q on q.org_id=a.org_id and q.id=a.reservation_id join core.sales x on x.org_id=a.org_id and x.id=a.sale_id where q.org_id=org and q.session_id=s.id and q.state='active' and a.state in ('reserved','consumed');
   select effects||coalesce(jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','waitlist_entries','id',w.id),'action','close','reason',reason) order by w.id),'[]'::jsonb) into effects from core.waitlist_entries w where w.org_id=org and w.session_id=s.id and w.state in ('waiting','offered');
   select effects||coalesce(jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','seat_offers','id',w.id),'action','close','reason',reason) order by w.id),'[]'::jsonb) into effects from core.seat_offers w where w.org_id=org and w.session_id=s.id and w.state='active';
   if aux->>'token' is null then perform private.fail('INTEGRITY_VIOLATION');end if;
   data:=jsonb_build_object('id',pid,'token',aux->>'token','scope_hash',md5(jsonb_build_object('org',org,'center',center,'actor',account,'request',r-'request_id')::text),'dependencies',dep,'effects',effects,'blockers','[]'::jsonb,'expires_at',clock_timestamp()+interval '15 minutes');
   insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(pid,org,account,'session_cancel_apply_v1',data->>'scope_hash',dep,data-'token','current');
   insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(pid,jsonb_build_object('center_id',center,'request',r),(data->>'expires_at')::timestamptz,encode(extensions.digest(aux->>'token','sha256'),'hex'));
   return jsonb_build_object('data',data,'primary_id',pid,'subject','previews');
  end if;
  if dep<>pv.dependencies then perform private.fail('PREVIEW_STALE');end if;
  for recipient in select person_id from core.reservations where org_id=org and session_id=s.id and state='active' union select person_id from core.waitlist_entries where org_id=org and session_id=s.id and state in ('waiting','offered') union select person_id from core.seat_offers where org_id=org and session_id=s.id and state='active' loop
   perform private.p02_notice(org,recipient.person_id,s.id,'session_cancelled_by_center',operation,ids,idx);idx:=idx+2;
  end loop;
  for v in select * from core.reservations where org_id=org and session_id=s.id and state='active' order by id for update loop
   perform private.lesson_right(org,v.id,false,operation,ids,idx,true);idx:=idx+4;
   update core.reservations set state='cancelled',cancellation_reason=reason,version=version+1 where org_id=org and id=v.id;
  end loop;
  update core.sessions set state='cancelled',version=version+1 where org_id=org and id=s.id returning version into ver;
  update core.resource_bookings set state='inactive',version=version+1 where org_id=org and session_id=s.id and state='active';
  update core.seat_offers set state='withdrawn',version=version+1 where org_id=org and session_id=s.id and state='active';
  update core.waitlist_entries set state='closed',version=version+1 where org_id=org and session_id=s.id and state in ('waiting','offered');
  update core.previews set state='applied',version=version+1 where id=pv.id;
  pid:=s.id;
 end if;
 data:=jsonb_build_object('operation_id',operation,'primary_id',pid,'version',ver,'replayed',false,'related',case when op='replacement_session_create_v1' then jsonb_build_array(jsonb_build_object('type','sessions','id',s.id)) else '[]'::jsonb end);
 return jsonb_build_object('data',data,'primary_id',pid,'subject','sessions','version',ver,'reason',reason,'audit',jsonb_build_object('before',before_data,'request',request_data,'after',(select to_jsonb(q) from core.sessions q where q.org_id=org and q.id=pid)));
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;new text;
begin
 old:='  cm:=center is not null and private.is_manager(org,person,center);org_reader:=private.is_org_reader(org,person);';
 new:=$p$  if p_operation='replacement_session_create_v1' then
   select s.center_id into selected from core.sessions s where s.org_id=org and s.id=(r->>'replaces_id')::uuid;
   if selected is null or (center is not null and center<>selected) then perform private.fail('NOT_FOUND');end if;center:=selected;
  end if;
$p$||old;
 if strpos(b,old)=0 then raise exception 'P02 session scope anchor missing';end if;b:=replace(b,old,new);
 old:=' -- DOMAIN_CASES';new:=$p$
 when 'session_cancel_preview_v1','session_cancel_apply_v1','replacement_session_create_v1' then
  terms:=private.p02_session_dispatch(p_operation,r,org,center,actor.id,person,operation_id,p_ids,p_aux);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';version_n:=(terms->>'version')::bigint;audit_delta:=terms->'audit';
  if terms->>'reason' is not null then r:=r||jsonb_build_object('reason',terms->>'reason');end if;
 -- DOMAIN_CASES$p$;
 if strpos(b,old)=0 then raise exception 'P02 session domain anchor missing';end if;execute replace(b,old,new);
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
