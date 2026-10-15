 when 'product_publish_v1' then
  terms:=r->'terms';
  if terms->>'kind'='credits' and coalesce((terms->>'credits')::int,0)<=0 then perform private.fail('VALIDATION_FAILED');end if;
  if terms->>'kind'='timed' then perform private.require_feature(org,'F16');if terms->>'credits' is not null then perform private.fail('VALIDATION_FAILED');end if;end if;
  if jsonb_array_length(terms->'scopes')=0 then perform private.fail('VALIDATION_FAILED');end if;
  selected:=coalesce((r->>'product_id')::uuid,private.new_id(p_ids,11));
  if r->>'product_id' is null then insert into core.products(id,org_id,center_id,name,state) values(selected,org,center,terms->>'name','active');
  elsif not exists(select 1 from core.products where org_id=org and center_id=center and id=selected) then perform private.fail('NOT_FOUND');end if;
  insert into core.product_versions(id,org_id,center_id,product_id,kind,booking_mode,credits,price_minor,currency,refund_method,freeze_terms,quota,effective_at,refund_terms)
   values(record_id,org,center,selected,terms->>'kind',terms->>'booking_mode',(terms->>'credits')::int,(terms->>'price_minor')::bigint,terms->>'currency',terms#>>'{refund,method}',terms->'freeze',nullif(terms->'quota','null'),now(),terms->'refund');
  for entry in select * from jsonb_array_elements(terms->'scopes') loop
   if entry->>'center_id' is not null and not exists(select 1 from core.centers where org_id=org and id=(entry->>'center_id')::uuid) then perform private.fail('NOT_FOUND');end if;
   if entry->>'discipline_id' is not null and not exists(select 1 from core.disciplines where org_id=org and id=(entry->>'discipline_id')::uuid) then perform private.fail('NOT_FOUND');end if;
   insert into core.product_scopes(id,org_id,product_version_id,scope_kind,center_id,discipline_id,class_id,event_id,usage_targets)
    values(private.new_id(p_ids,idx),org,record_id,entry->>'scope_kind',(entry->>'center_id')::uuid,(entry->>'discipline_id')::uuid,(entry->>'class_id')::uuid,(entry->>'event_id')::uuid,array(select jsonb_array_elements_text(entry->'usage_targets')));
   idx:=idx+1;
  end loop;subject:='product_versions';
 when 'sale_preview_v1' then
  target:=(r->>'person_id')::uuid;
  if not exists(select 1 from core.people where org_id=org and id=target) then perform private.fail('NOT_FOUND');end if;
  select * into pv from core.product_versions where org_id=org and center_id=center and id=(r->>'product_version_id')::uuid;
  if not found then perform private.fail('NOT_FOUND');end if;
  if (r->>'end_date')::date<=(r->>'start_date')::date then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'net_minor' is not null and (r->>'net_minor')::bigint<>pv.price_minor then perform private.fail('FORBIDDEN');end if;
  scope_hash:=encode(extensions.digest(r::text,'sha256'),'hex');token:=p_aux->>'token';
  dependencies:=jsonb_build_object('versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','product_versions','id',pv.id),'version',coalesce(pv.version,1))),'policy_hashes','[]'::jsonb,'permission_hash',actor.id::text);
  out:=jsonb_build_object('id',record_id,'token',token,'scope_hash',scope_hash,'dependencies',dependencies,'effects','[]'::jsonb,'blockers','[]'::jsonb,'expires_at',now()+interval '15 minutes');
  insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(record_id,org,actor.id,'sale_apply_v1',scope_hash,dependencies,out,'current');
  insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(record_id,r,now()+interval '15 minutes',encode(extensions.digest(token,'sha256'),'hex'));
 when 'sale_apply_v1' then
  select * into preview from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid for update;
  select * into preview_data from private.preview_payloads where preview_id=preview.id;
  if preview.id is null or preview.state<>'current' or preview.actor_account_id<>actor.id or preview.operation<>p_operation or preview_data.expires_at<=now() or preview_data.token_hash<>encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') then perform private.fail('PREVIEW_STALE');end if;
  entry:=preview_data.payload;target:=(entry->>'person_id')::uuid;
  if (entry->>'center_id')::uuid is distinct from center then perform private.fail('PREVIEW_STALE');end if;
  select * into pv from core.product_versions where org_id=org and center_id=center and id=(entry->>'product_version_id')::uuid;
  if pv.id is null or coalesce(pv.version,1)<>(preview.dependencies#>>'{versions,0,version}')::bigint then perform private.fail('PREVIEW_STALE');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind='student' and state='active') then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  select timezone into token from core.centers where org_id=org and id=center;
  start_at:=(entry->>'start_date')::date::timestamp at time zone token;end_at:=(entry->>'end_date')::date::timestamp at time zone token;
  if to_char(start_at at time zone token,'YYYY-MM-DD HH24:MI')<>entry->>'start_date'||' 00:00'
    or to_char(end_at at time zone token,'YYYY-MM-DD HH24:MI')<>entry->>'end_date'||' 00:00'
    or (start_at-interval '1 hour') at time zone token=start_at at time zone token or (start_at+interval '1 hour') at time zone token=start_at at time zone token then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.sales(id,org_id,center_id,person_id,product_version_id,net_minor,currency,valid_from,valid_until,state,terms_hash,start_date,end_date,timezone,paid_days)
   values(record_id,org,center,target,pv.id,pv.price_minor,pv.currency,start_at,end_at,'active',preview.scope_hash,(entry->>'start_date')::date,(entry->>'end_date')::date,token,(entry->>'end_date')::date-(entry->>'start_date')::date);
  insert into core.entitlement_accounts(id,org_id,sale_id,person_id,state,balance_version) values(private.new_id(p_ids,11),org,record_id,target,'active',1);
  if pv.kind='credits' then insert into core.entitlement_movements(id,org_id,sale_id,person_id,kind,quantity,operation_id) values(private.new_id(p_ids,12),org,record_id,target,'grant',pv.credits,operation_id);end if;
  if pv.price_minor>0 then insert into core.debts(id,org_id,center_id,person_id,sale_id,amount_minor,currency,due_at,state) values(private.new_id(p_ids,13),org,center,target,record_id,pv.price_minor,pv.currency,now(),'open');end if;
  -- Existing eligible deficits settle consumed past first, then future reserved; original snapshots/earnings are untouched.
  for row_record in select d.*,s.starts_at from core.credit_deficits d join core.sessions s on s.org_id=d.org_id and s.id=d.session_id
   where d.org_id=org and d.person_id=target and d.state in ('consumed','reserved') and private.lesson_scope_matches(org,d.session_id,pv.id)
   order by case when d.state='consumed' then 0 else 1 end,s.starts_at,d.id for update of d loop
   if pv.kind<>'credits' or private.credit_available(org,record_id)<row_record.quantity then exit;end if;
   insert into core.entitlement_allocations(id,org_id,sale_id,reservation_id,quantity,state) values(private.new_id(p_ids,idx),org,record_id,row_record.reservation_id,row_record.quantity,case when row_record.state='consumed' then 'consumed' else 'reserved' end);
   insert into core.entitlement_movements(id,org_id,sale_id,person_id,reservation_id,kind,quantity,operation_id) values(private.new_id(p_ids,idx+1),org,record_id,target,row_record.reservation_id,case when row_record.state='consumed' then 'consume' else 'reserve' end,row_record.quantity,operation_id);
   update core.credit_deficits set state='settled',settled_sale_id=record_id,version=version+1 where id=row_record.id;idx:=idx+2;
  end loop;
  update core.previews set state='applied' where id=preview.id;subject:='sales';
 when 'collection_record_v1' then
  target:=(r->>'person_id')::uuid;remaining:=(r->>'amount_minor')::bigint;
  if not exists(select 1 from core.people where org_id=org and id=target) then perform private.fail('NOT_FOUND');end if;
  insert into core.cash_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,occurred_at,reason,operation_id)
   values(record_id,org,center,target,'collection',remaining,r->>'currency',(r->>'occurred_at')::timestamptz,r->>'note',operation_id);
  for row_record in select * from core.debts d where d.org_id=org and d.center_id=center and d.person_id=target and d.currency=r->>'currency'
   and (r->>'debt_ids' is null or d.id=any(array(select x::uuid from jsonb_array_elements_text(r->'debt_ids') x))) order by due_at,created_at,id for update loop
   part:=least(remaining,private.debt_remaining(org,row_record.id));if part<=0 then continue;end if;
   insert into core.debt_allocations(id,org_id,center_id,debt_id,cash_movement_id,amount_minor) values(private.new_id(p_ids,idx),org,center,row_record.id,record_id,part);idx:=idx+1;
   remaining:=remaining-part;
   update core.debts set state=case when private.debt_remaining(org,row_record.id)=0 then 'settled' else 'open' end,version=version+1 where id=row_record.id;
   exit when remaining=0;
  end loop;
  if remaining>0 then insert into core.student_credit_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,source_cash_id) values(private.new_id(p_ids,idx),org,center,target,'surplus_add',remaining,r->>'currency',record_id);end if;
  subject:='cash_movements';
 when 'entitlements_get_v1' then
  target:=(r->>'person_id')::uuid;
  if target<>person and not org_reader and not cm then perform private.fail('FORBIDDEN');end if;
  out:=coalesce((select jsonb_agg(jsonb_build_object('sale_id',s.id,'person_id',s.person_id,'start_date',s.start_date,'end_date',s.end_date,'timezone',s.timezone,'state',a.state,
    'available',case when p.kind='credits' then greatest(0,private.credit_available(org,s.id)) else 0 end,
    'reserved',coalesce((select sum(quantity) from core.entitlement_allocations where org_id=org and sale_id=s.id and state='reserved'),0),
    'consumed',coalesce((select sum(private.credit_effect(org,m.id)*-1) from core.entitlement_movements m where m.org_id=org and m.sale_id=s.id and m.kind in ('consume','reverse')),0),
    'deficit',coalesce((select sum(quantity) from core.credit_deficits where org_id=org and person_id=target and state in ('reserved','consumed')),0),
    'deficit_scopes',coalesce((select jsonb_agg(jsonb_build_object('center_id',x.center_id,'discipline_id',x.discipline_id,'reserved',x.r,'consumed',x.c)) from
     (select center_id,discipline_id,coalesce(sum(quantity) filter(where state='reserved'),0) r,coalesce(sum(quantity) filter(where state='consumed'),0) c from core.credit_deficits where org_id=org and person_id=target and state in ('reserved','consumed') group by center_id,discipline_id) x),'[]'::jsonb),
    'quotas',coalesce((select jsonb_agg(jsonb_build_object('starts_at',q.starts_at,'ends_at',q.ends_at,'limit',q.limit_count,'reserved',q.reserved_count,'consumed',q.consumed_count)) from core.quota_buckets q where q.org_id=org and q.sale_id=s.id),'[]'::jsonb)))
   from core.sales s join core.entitlement_accounts a on a.org_id=s.org_id and a.sale_id=s.id join core.product_versions p on p.org_id=s.org_id and p.id=s.product_version_id where s.org_id=org and s.person_id=target),'[]'::jsonb);
 when 'class_save_v1' then
  if not exists(select 1 from core.center_disciplines where org_id=org and center_id=center and discipline_id=(r->>'discipline_id')::uuid and state='active') then perform private.fail('NOT_FOUND');end if;
  if r->>'class_id' is null then insert into core.classes(id,org_id,center_id,name,discipline_id,external_open,state) values(record_id,org,center,r->>'name',(r->>'discipline_id')::uuid,(r->>'external_open')::bool,'active');
  else record_id:=(r->>'class_id')::uuid;update core.classes set name=r->>'name',external_open=(r->>'external_open')::bool,version=version+1 where org_id=org and center_id=center and id=record_id and discipline_id=(r->>'discipline_id')::uuid and version=(r->>'expected_version')::bigint returning version into version_n;if not found then perform private.fail('VERSION_CONFLICT');end if;
  end if;subject:='classes';
 when 'session_create_v1' then
  if not exists(select 1 from core.center_disciplines where org_id=org and center_id=center and discipline_id=(r->>'discipline_id')::uuid and state='active') then perform private.fail('NOT_FOUND');end if;
  insert into core.sessions(id,org_id,center_id,discipline_id,class_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state)
   values(record_id,org,center,(r->>'discipline_id')::uuid,(r->>'class_id')::uuid,r->>'format',(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,(r#>>'{capacity,nominal}')::int,(r#>>'{capacity,maximum}')::int,'planned','open');
  for entry in select * from jsonb_array_elements(r->'assignments') loop
   if not exists(select 1 from core.people where org_id=org and id=(entry->>'person_id')::uuid) then perform private.fail('NOT_FOUND');end if;
   insert into core.session_assignments(id,org_id,center_id,session_id,person_id,duty,agreement_id,state) values(private.new_id(p_ids,idx),org,center,record_id,(entry->>'person_id')::uuid,entry->>'duty',(entry->>'agreement_id')::uuid,'active');idx:=idx+1;
  end loop;
  for entry in select * from jsonb_array_elements(r->'resources') loop
   if entry->>'kind'='room' and not exists(select 1 from core.rooms where org_id=org and center_id=center and id=(entry->>'id')::uuid) then perform private.fail('NOT_FOUND');end if;
   if entry->>'kind'='person' and not exists(select 1 from core.people where org_id=org and id=(entry->>'id')::uuid) then perform private.fail('NOT_FOUND');end if;
   if exists(select 1 from core.resource_bookings where org_id=org and resource_kind=entry->>'kind' and resource_id=(entry->>'id')::uuid and state='active' and starts_at<(r#>>'{interval,ends_at}')::timestamptz and ends_at>(r#>>'{interval,starts_at}')::timestamptz) then perform private.fail('RESOURCE_CONFLICT');end if;
   insert into core.resource_bookings(id,org_id,center_id,session_id,resource_kind,resource_id,starts_at,ends_at,state) values(private.new_id(p_ids,idx),org,center,record_id,entry->>'kind',(entry->>'id')::uuid,(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,'active');idx:=idx+1;
  end loop;subject:='sessions';
 when 'reservation_create_v1' then
  select * into ses from core.sessions where org_id=org and id=(r->>'session_id')::uuid and center_id=center for update;
  if not found then perform private.fail('NOT_FOUND');end if;if ses.state<>'planned' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  target:=(r->>'person_id')::uuid;
  if not cm and (target<>person or r->>'mode'<>'flexible') then perform private.fail('FORBIDDEN');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind='student' and state='active') then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  if exists(select 1 from core.session_assignments where org_id=org and session_id=ses.id and person_id=target and duty='assistant' and state='active') then perform private.fail('ASSISTANT_PARTICIPANT_CONFLICT');end if;
  if exists(select 1 from core.reservations where org_id=org and session_id=ses.id and person_id=target and state='active') then perform private.fail('RESERVATION_EXISTS');end if;
  select (select count(*) from core.reservations where org_id=org and session_id=ses.id and state='active')+(select count(*) from core.seat_offers where org_id=org and session_id=ses.id and state='active' and expires_at>now()) into before_count;
  if before_count>=(case when r->>'mode'='priority' then ses.maximum else ses.nominal end) then perform private.fail('CAPACITY_FULL');end if;
  select id into policy from core.policy_versions where org_id=org and (scope_center_id is null or scope_center_id=center) and key=case when ses.format='private' then 'student_cancel_private' else 'student_cancel_group' end and effective_at<=now() order by mandatory desc,scope_center_id nulls last,effective_at desc,id limit 1;
  if policy is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  if ses.class_id is not null and not (select external_open from core.classes where org_id=org and id=ses.class_id) and not exists(select 1 from core.product_scopes sc join core.sales s on s.org_id=sc.org_id and s.product_version_id=sc.product_version_id where s.org_id=org and s.person_id=target and sc.class_id=ses.class_id and private.lesson_scope_matches(org,ses.id,s.product_version_id)) then perform private.fail('CLASS_ACCESS_DENIED');end if;
  insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id,source_sale_id)
   values(record_id,org,center,ses.id,target,r->>'mode','active',policy,(r->>'source_sale_id')::uuid);
  selected:=private.reserve_right(org,target,(r->>'source_sale_id')::uuid,ses.id,null,null,record_id,operation_id,p_ids,idx);
  update core.reservations set source_sale_id=selected where id=record_id;subject:='reservations';
 when 'reservation_cancel_v1' then
  select * into row_record from core.reservations where org_id=org and center_id=center and id=(r->>'reservation_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if not cm and row_record.person_id<>person then perform private.fail('FORBIDDEN');end if;
  if row_record.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if row_record.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  select * into ses from core.sessions where org_id=org and id=row_record.session_id;
  select value into terms from core.policy_versions where id=row_record.policy_version_id and org_id=org;
  do_consume:=case when now()<ses.starts_at-make_interval(mins=>coalesce((terms->>'cutoff_minutes')::int,0)) then terms->>'before_cutoff'='consume' else terms->>'after_cutoff'='consume' end;
  perform private.set_right_state(org,null,row_record.id,do_consume,operation_id,p_ids,idx,false);
  record_id:=row_record.id;update core.reservations set state='cancelled',cancellation_reason=r->>'reason',version=version+1 where id=record_id returning version into version_n;subject:='reservations';
 when 'event_save_v1' then
  if (r#>>'{capacity,nominal}')::bigint>(r#>>'{capacity,maximum}')::bigint or (r#>>'{interval,starts_at}')::timestamptz>=(r#>>'{interval,ends_at}')::timestamptz then perform private.fail('VALIDATION_FAILED');end if;
  if r#>>'{venue,kind}'='external' and (r#>>'{venue,name}' is null or r#>>'{venue,address}' is null) then perform private.fail('VALIDATION_FAILED');end if;
  if r#>>'{venue,kind}'='internal' and not exists(select 1 from core.rooms where org_id=org and center_id=center and id=(r#>>'{venue,room_id}')::uuid) then perform private.fail('NOT_FOUND');end if;
  for entry in select * from jsonb_array_elements(r->'discipline_ids') loop if not exists(select 1 from core.disciplines where org_id=org and id=(entry#>>'{}')::uuid) then perform private.fail('NOT_FOUND');end if;end loop;
  for entry in select * from jsonb_array_elements(r#>'{terms,allowed_product_version_ids}') loop if not exists(select 1 from core.product_versions where org_id=org and id=(entry#>>'{}')::uuid) then perform private.fail('NOT_FOUND');end if;end loop;
  if r->>'event_id' is null then
   if r ? 'expected_version' then perform private.fail('VERSION_CONFLICT');end if;
   insert into core.events(id,org_id,center_id,name,starts_at,ends_at,timezone,venue,nominal,maximum,state,terms,published,attendance_state,attendance_revision)
   values(record_id,org,center,r->>'name',(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,r->>'timezone',r->'venue',(r#>>'{capacity,nominal}')::int,(r#>>'{capacity,maximum}')::int,'draft',r->'terms',false,'open',0);
  else
   record_id:=(r->>'event_id')::uuid;select * into e from core.events where org_id=org and center_id=center and id=record_id for update;
   if not found then perform private.fail('NOT_FOUND');end if;
   if e.version<>(r->>'expected_version')::bigint or not r ? 'expected_version' then perform private.fail('VERSION_CONFLICT');end if;
   if e.state not in ('draft','published') or e.attendance_state<>'open' then perform private.fail('INVALID_STATE_TRANSITION');end if;
   if exists(select 1 from core.event_registrations er join core.entitlement_allocations a on a.org_id=er.org_id and a.event_registration_id=er.id where er.org_id=org and er.event_id=e.id and er.state='active' and
     (r->'discipline_ids'<>coalesce((select jsonb_agg(d.discipline_id order by d.discipline_id) from core.event_disciplines d where d.org_id=org and d.event_id=e.id),'[]'::jsonb) or e.starts_at<>(r#>>'{interval,starts_at}')::timestamptz or e.terms<>r->'terms')) then
    perform private.fail('OPEN_OPERATIONS_EXIST');
   end if;
   update core.events set name=r->>'name',starts_at=(r#>>'{interval,starts_at}')::timestamptz,ends_at=(r#>>'{interval,ends_at}')::timestamptz,timezone=r->>'timezone',venue=r->'venue',nominal=(r#>>'{capacity,nominal}')::int,maximum=(r#>>'{capacity,maximum}')::int,terms=r->'terms',version=version+1 where id=record_id returning version into version_n;
   delete from core.event_disciplines where org_id=org and event_id=record_id;
   delete from core.resource_bookings where org_id=org and event_id=record_id;
   delete from core.event_assignments where org_id=org and event_id=record_id;
  end if;
  for entry in select * from jsonb_array_elements(r->'discipline_ids') loop
   insert into core.event_disciplines(id,org_id,center_id,event_id,discipline_id) values(private.new_id(p_ids,idx),org,center,record_id,(entry#>>'{}')::uuid);idx:=idx+1;
  end loop;
  for entry in select * from jsonb_array_elements(r->'assignments') loop
   if not exists(select 1 from core.people where org_id=org and id=(entry->>'person_id')::uuid) then perform private.fail('NOT_FOUND');end if;
   if entry->>'duty'='assistant' and exists(select 1 from core.event_registrations where org_id=org and event_id=record_id and person_id=(entry->>'person_id')::uuid and state='active') then perform private.fail('ASSISTANT_PARTICIPANT_CONFLICT');end if;
   if exists(select 1 from core.resource_bookings where org_id=org and resource_kind='person' and resource_id=(entry->>'person_id')::uuid and state='active' and starts_at<(r#>>'{interval,ends_at}')::timestamptz and ends_at>(r#>>'{interval,starts_at}')::timestamptz) then perform private.fail('RESOURCE_CONFLICT');end if;
   insert into core.event_assignments(id,org_id,center_id,event_id,person_id,duty,fee_minor,currency) values(private.new_id(p_ids,idx),org,center,record_id,(entry->>'person_id')::uuid,entry->>'duty',(entry->>'fee_minor')::bigint,entry->>'currency');
   insert into core.resource_bookings(id,org_id,center_id,event_id,resource_kind,resource_id,starts_at,ends_at,state) values(private.new_id(p_ids,idx+1),org,center,record_id,'person',(entry->>'person_id')::uuid,(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,'active');idx:=idx+2;
  end loop;
  if r#>>'{venue,kind}'='internal' then
   if exists(select 1 from core.resource_bookings where org_id=org and resource_kind='room' and resource_id=(r#>>'{venue,room_id}')::uuid and state='active' and starts_at<(r#>>'{interval,ends_at}')::timestamptz and ends_at>(r#>>'{interval,starts_at}')::timestamptz) then perform private.fail('RESOURCE_CONFLICT');end if;
   insert into core.resource_bookings(id,org_id,center_id,event_id,resource_kind,resource_id,starts_at,ends_at,state) values(private.new_id(p_ids,idx),org,center,record_id,'room',(r#>>'{venue,room_id}')::uuid,(r#>>'{interval,starts_at}')::timestamptz,(r#>>'{interval,ends_at}')::timestamptz,'active');
  end if;subject:='events';
 when 'event_publish_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if e.state not in ('draft','published') then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if not exists(select 1 from core.event_assignments where org_id=org and event_id=e.id and duty in ('instructor','assistant')) then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  record_id:=e.id;update core.events set state='published',published=(r->>'published')::bool,version=version+1 where id=record_id returning version into version_n;subject:='events';
 when 'event_get_v1' then
  select * into e from core.events where org_id=org and id=(r->>'event_id')::uuid and center_id=center;
  if not found then perform private.fail('NOT_FOUND');end if;
  if not org_reader and not cm and not e.published and not exists(select 1 from core.event_registrations where org_id=org and event_id=e.id and person_id=person) then perform private.fail('NOT_FOUND');end if;
  out:=private.event_view(org,e.id);
 when 'event_list_v1' then
  out:=jsonb_build_object('items',coalesce((select jsonb_agg(private.event_view(org,x.id)) from
   (select e.id from core.events e where e.org_id=org and (center is null or e.center_id=center) and e.starts_at<(r#>>'{interval,ends_at}')::timestamptz and e.ends_at>(r#>>'{interval,starts_at}')::timestamptz
    and (org_reader or private.is_manager(org,person,e.center_id) or e.published or exists(select 1 from core.event_registrations where org_id=org and event_id=e.id and person_id=person))
    and (r->>'discipline_id' is null or exists(select 1 from core.event_disciplines where org_id=org and event_id=e.id and discipline_id=(r->>'discipline_id')::uuid))
    order by e.starts_at,e.id limit coalesce((r#>>'{page,limit}')::int,50)) x),'[]'::jsonb),'next_cursor',null);
 when 'event_registration_preview_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid;
  if not found then perform private.fail('NOT_FOUND');end if;
  target:=(r->>'person_id')::uuid;
  if not cm and target<>person then perform private.fail('FORBIDDEN');end if;
  scope_hash:=encode(extensions.digest(r::text,'sha256'),'hex');token:=p_aux->>'token';
  dependencies:=jsonb_build_object('versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','events','id',e.id),'version',e.version)),'policy_hashes','[]'::jsonb,'permission_hash',actor.id::text);
  out:=jsonb_build_object('id',record_id,'token',token,'scope_hash',scope_hash,'dependencies',dependencies,'effects','[]'::jsonb,'blockers','[]'::jsonb,'expires_at',now()+interval '15 minutes');
  if r->>'sale_id' is not null and not exists(select 1 from core.sales s where s.org_id=org and s.person_id=target and s.id=(r->>'sale_id')::uuid and private.event_package_scope_matches(org,e.id,s.product_version_id)) then
   out:=jsonb_set(out,'{blockers}',jsonb_build_array(jsonb_build_object('code','CLASS_ACCESS_DENIED','retryable',false,'trace_id',trace)));
  elsif r->>'sale_id' is not null and private.available_for(org,(r->>'sale_id')::uuid,e.starts_at)<1 then
   out:=jsonb_set(out,'{blockers}',jsonb_build_array(jsonb_build_object('code','ENTITLEMENT_UNAVAILABLE','retryable',false,'trace_id',trace)));
  end if;
  insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(record_id,org,actor.id,'event_register_v1',scope_hash,dependencies,out,'current');
  insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(record_id,r,now()+interval '15 minutes',encode(extensions.digest(token,'sha256'),'hex'));
 when 'event_register_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if e.state<>'published' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  target:=(r->>'person_id')::uuid;
  if not cm and target<>person then perform private.fail('FORBIDDEN');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind='student' and state='active') then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  if exists(select 1 from core.event_assignments where org_id=org and event_id=e.id and person_id=target and duty='assistant') then perform private.fail('ASSISTANT_PARTICIPANT_CONFLICT');end if;
  if exists(select 1 from core.event_registrations where org_id=org and event_id=e.id and person_id=target and state='active') then perform private.fail('RESERVATION_EXISTS');end if;
  if (select count(*) from core.event_registrations where org_id=org and event_id=e.id and state='active')>=e.nominal then perform private.fail('CAPACITY_FULL');end if;
  if r ? 'preview' and r->>'preview' is not null then
   select * into preview from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid for update;
   select * into preview_data from private.preview_payloads where preview_id=preview.id;
   if preview.id is null or preview.actor_account_id<>actor.id or preview.state<>'current' or preview_data.expires_at<=now() or preview_data.token_hash<>encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') or (preview.dependencies#>>'{versions,0,version}')::bigint<>e.version
    or (preview_data.payload->>'person_id')::uuid<>target or (preview_data.payload->>'event_id')::uuid<>e.id or preview_data.payload->>'sale_id' is distinct from r->>'sale_id' then perform private.fail('PREVIEW_STALE');end if;
  end if;
  amount:=case when r->>'sale_id' is null then (e.terms->>'fee_minor')::bigint else 0 end;
  if r->>'sale_id' is null and coalesce((e.terms->>'full_payment_required')::bool,false) and amount>0 then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;
  insert into core.event_registrations(id,org_id,center_id,event_id,person_id,amount_minor,currency,terms_hash,state,attendance_result)
   values(record_id,org,center,e.id,target,amount,e.terms->>'currency',encode(extensions.digest(e.terms::text,'sha256'),'hex'),'active','unmarked');
  if r->>'sale_id' is not null then
   selected:=private.reserve_right(org,target,(r->>'sale_id')::uuid,null,e.id,record_id,null,operation_id,p_ids,idx);
  elsif amount>0 then
   insert into core.debts(id,org_id,center_id,person_id,event_registration_id,amount_minor,currency,due_at,state) values(private.new_id(p_ids,idx),org,center,target,record_id,amount,e.terms->>'currency',now(),'open');
  end if;
  if preview.id is not null then update core.previews set state='applied' where id=preview.id;end if;subject:='event_registrations';
 when 'event_registration_cancel_v1' then
  select * into reg from core.event_registrations where org_id=org and center_id=center and id=(r->>'registration_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if not cm and reg.person_id<>person then perform private.fail('FORBIDDEN');end if;
  if reg.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if reg.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  select * into e from core.events where org_id=org and id=reg.event_id;
  do_consume:=case when now()<e.starts_at-make_interval(mins=>coalesce((e.terms#>>'{cancellation,cutoff_minutes}')::int,0)) then e.terms#>>'{cancellation,before_cutoff}'='consume' else e.terms#>>'{cancellation,after_cutoff}'='consume' end;
  perform private.set_right_state(org,reg.id,null,do_consume,operation_id,p_ids,idx,false);
  record_id:=reg.id;update core.event_registrations set state='cancelled',version=version+1 where id=record_id returning version into version_n;subject:='event_registrations';
 when 'event_attendance_mark_v1' then
  select * into reg from core.event_registrations where org_id=org and center_id=center and id=(r->>'registration_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  select * into e from core.events where org_id=org and id=reg.event_id;
  if e.attendance_state<>'open' then perform private.fail('ATTENDANCE_CLOSED');end if;
  if reg.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if r->>'result'='blocked' and not cm then perform private.fail('FORBIDDEN');end if;
  record_id:=reg.id;update core.event_registrations set attendance_result=r->>'result',version=version+1 where id=record_id and version=(r->>'expected_version')::bigint returning version into version_n;
  if not found then perform private.fail('VERSION_CONFLICT');end if;subject:='event_registrations';
 when 'event_attendance_close_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if e.attendance_state<>'open' then perform private.fail('ATTENDANCE_CLOSED');end if;
  if r ? 'expected_version' and e.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if now()<e.starts_at then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if exists(select 1 from core.event_registrations where org_id=org and event_id=e.id and state='active' and attendance_result='unmarked') then perform private.fail('ATTENDANCE_INCOMPLETE');end if;
  for reg in select * from core.event_registrations where org_id=org and event_id=e.id and state='active' order by id for update loop
   if reg.attendance_result='blocked' then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   do_consume:=reg.attendance_result='attended' or (reg.attendance_result='no_show' and e.terms#>>'{cancellation,no_show}'='consume');
   perform private.set_right_state(org,reg.id,null,do_consume,operation_id,p_ids,idx,false);idx:=idx+3;
   update core.event_registrations set state='completed',version=version+1 where id=reg.id;
  end loop;
  record_id:=e.id;update core.events set attendance_state='closed',attendance_revision=attendance_revision+1,version=version+1 where id=record_id returning version into version_n;subject:='events';
 when 'event_attendance_correct_v1' then
  select * into reg from core.event_registrations where org_id=org and center_id=center and id=(r->>'registration_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  select * into e from core.events where org_id=org and id=reg.event_id;
  if e.attendance_state<>'closed' or reg.state<>'completed' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if reg.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if r->>'result' not in ('attended','no_show') then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  do_consume:=r->>'result'='attended' or (r->>'result'='no_show' and e.terms#>>'{cancellation,no_show}'='consume');
  perform private.set_right_state(org,reg.id,null,do_consume,operation_id,p_ids,idx,true);
  record_id:=reg.id;update core.event_registrations set attendance_result=r->>'result',version=version+1 where id=record_id returning version into version_n;
  update core.events set attendance_revision=attendance_revision+1,version=version+1 where id=e.id;subject:='event_registrations';
 when 'event_complete_v1' then
  select * into e from core.events where org_id=org and center_id=center and id=(r->>'event_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if e.state<>'published' or now()<e.starts_at then perform private.fail('INVALID_STATE_TRANSITION');end if;
  record_id:=e.id;update core.events set state='occurred',version=version+1 where id=record_id returning version into version_n;subject:='events';
