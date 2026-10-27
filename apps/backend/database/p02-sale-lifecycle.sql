-- P02-D: linked renewal/change; termination is not an implicit financial refund.
begin;
create table private.p02_sale_settlements(
 id uuid primary key,org_id uuid not null,sale_id uuid not null,operation_id uuid not null,quote jsonb not null,
 created_at timestamptz not null default clock_timestamp(),unique(org_id,sale_id),
 foreign key(org_id,sale_id) references core.sales(org_id,id),foreign key(org_id,operation_id) references core.operation_receipts(org_id,id)
);
alter table private.p02_sale_settlements enable row level security;
create trigger p02_sale_settlement_immutable before update or delete on private.p02_sale_settlements for each row execute function private.lesson_immutable();
revoke all on private.p02_sale_settlements from public,anon,authenticated;
grant select,insert on private.p02_sale_settlements to service_role;
create function private.p02_refund_quote(org uuid,sale_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.sales;p core.product_versions;consumed bigint;granted bigint;unused bigint;calculated bigint:=0;part bigint;remaining bigint;credit bigint:=0;decrease bigint:=0;d core.debts;local_day date;elapsed int;frozen int;details jsonb:='[]';
begin
 select * into s from core.sales where org_id=org and id=sale_id;
 select * into p from core.product_versions where org_id=org and id=s.product_version_id;
 select coalesce(sum(quantity),0) into consumed from core.entitlement_allocations where org_id=org and sale_id=s.id and state='consumed';
 select coalesce(sum(case when kind in ('grant','adjust_add') then quantity when kind='adjust_subtract' then -quantity else 0 end),0) into granted from core.entitlement_movements where org_id=org and sale_id=s.id;
 if p.refund_method='credit_ratio' then
  if p.kind<>'credits' or p.credits<=0 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  unused:=greatest(0,least(p.credits-consumed,granted-consumed));calculated:=floor(s.net_minor::numeric*unused/p.credits)::bigint;
 elsif p.refund_method='used_at_unit_price' then
  if p.refund_terms->>'used_unit_minor' is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  calculated:=greatest(0,s.net_minor::numeric-consumed*(p.refund_terms->>'used_unit_minor')::numeric)::bigint;
 elsif p.refund_method='time_ratio' then
  if s.paid_days<=0 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  local_day:=(clock_timestamp() at time zone s.timezone)::date;
  select coalesce(sum(greatest(0,least(local_day,(coalesce(f.actual_end,f.planned_end) at time zone s.timezone)::date)-greatest(s.start_date,(f.starts_at at time zone s.timezone)::date))),0)::int into frozen from core.freezes f where f.org_id=org and f.sale_id=s.id and f.state<>'cancelled';
  elapsed:=greatest(0,least(s.paid_days,local_day-s.start_date-frozen));unused:=s.paid_days-elapsed;
  calculated:=floor(s.net_minor::numeric*unused/s.paid_days)::bigint;
 elsif p.refund_method<>'none' then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 remaining:=calculated;
 for d in select * from core.debts where org_id=org and sale_id=s.id order by created_at,id loop
  part:=least(remaining,greatest(0,private.debt_net(org,d.id)));
  if part>0 then
   decrease:=decrease+part;credit:=credit+greatest(0,private.debt_paid(org,d.id)-(private.debt_net(org,d.id)-part)-private.debt_claimed(org,d.id));
   details:=details||jsonb_build_array(jsonb_build_object('debt_id',d.id,'reduction_minor',part::text));remaining:=remaining-part;
  end if;
 end loop;
 return jsonb_build_object('method',p.refund_method,'calculated_minor',calculated::text,'debt_reduction_minor',decrease::text,'credit_added_minor',credit::text,'currency',s.currency,'consumed',consumed,'unused',coalesce(unused,0),'paid_days',s.paid_days,'debts',details);
end$$;
create function private.p02_sale_notice(org uuid,recipient uuid,sale_id uuid,operation uuid,ids uuid[],idx int,kind text) returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(private.new_id(ids,idx),org,recipient,kind,sale_id,jsonb_build_object('template_key',kind,'subject',jsonb_build_object('type','sales','id',sale_id)));
 insert into core.outbox_jobs(id,org_id,notification_id,kind,dedupe_key,state,attempts,next_attempt_at) values(private.new_id(ids,idx+1),org,private.new_id(ids,idx),'in_app',operation::text||':'||recipient::text||':'||sale_id::text,'pending',0,clock_timestamp());
end$$;
create function private.p02_sale(op text,r jsonb,org uuid,center uuid,account uuid,person uuid,operation uuid,ids uuid[],aux jsonb,auth_id uuid,auth_session uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare request_data jsonb:=r;pv core.previews;pp private.preview_payloads;s core.sales;p core.product_versions;target_product core.product_versions;v core.reservations;ses core.sessions;a core.entitlement_allocations;
 bank uuid[];preview_bank uuid[];apply_bank uuid[];idx int:=10;pid uuid;ver bigint:=1;dep jsonb;data jsonb;effects jsonb:='[]';blockers jsonb:='[]';quote jsonb;reason text;before_data jsonb;related jsonb:='[]';inner_preview jsonb;answer jsonb;new_sale uuid;entry jsonb;part bigint;offset_amount bigint;remaining bigint;new_debt core.debts;
 is_preview bool:=op like '%_preview_v1';is_change bool:=op in ('sale_change_preview_v1','sale_change_apply_v1');is_renew bool:=op in ('sale_renew_preview_v1','sale_renew_apply_v1');starts timestamptz;ends timestamptz;keep_ids uuid[];cancel_ids uuid[];all_ids uuid[];selected_ids uuid[];qty bigint;gap int;overlap int;
begin
 -- Outer execute reserves IDs1..19. Partition the rest without fixed participant limits.
 select array_agg(x order by n) filter(where (n-20)%3=0),array_agg(x order by n) filter(where (n-20)%3=1),array_agg(x order by n) filter(where (n-20)%3=2) into bank,preview_bank,apply_bank from unnest(ids) with ordinality u(x,n) where n>=20;
 pid:=private.new_id(bank,1);
 if not is_preview then
  select * into pv from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid for update;
  select * into pp from private.preview_payloads where preview_id=pv.id;
  if pv.id is null or pv.state<>'current' or pv.operation<>op or pv.actor_account_id<>account or pp.expires_at<=clock_timestamp() or pp.token_hash is distinct from encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') or (pp.payload->>'center_id')::uuid is distinct from center then perform private.fail('PREVIEW_STALE');end if;
  request_data:=pp.payload->'request';
 end if;
 select * into s from core.sales where org_id=org and center_id=center and id=coalesce((request_data->>'sale_id')::uuid,(request_data->>'previous_sale_id')::uuid) for update;
 if s.id is null then perform private.fail('NOT_FOUND');end if;
 if not is_renew and s.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
 before_data:=to_jsonb(s);reason:=request_data->>'reason';
 if not is_renew and length(btrim(coalesce(reason,'')))=0 then perform private.fail('VALIDATION_FAILED');end if;
 select * into p from core.product_versions where org_id=org and id=s.product_version_id;
 if is_change or is_renew then
  select * into target_product from core.product_versions where org_id=org and center_id=center and id=coalesce((request_data->>'new_product_version_id')::uuid,(request_data->>'product_version_id')::uuid);
  if target_product.id is null then perform private.fail('NOT_FOUND');end if;
  if target_product.currency<>s.currency then perform private.fail('VALIDATION_FAILED');end if;
  starts:=(request_data->>'start_date')::date::timestamp at time zone s.timezone;ends:=(request_data->>'end_date')::date::timestamp at time zone s.timezone;
  if ends<=starts or starts<date_trunc('day',clock_timestamp() at time zone s.timezone) at time zone s.timezone or to_char(starts at time zone s.timezone,'YYYY-MM-DD HH24:MI')<>request_data->>'start_date'||' 00:00' or to_char(ends at time zone s.timezone,'YYYY-MM-DD HH24:MI')<>request_data->>'end_date'||' 00:00' then perform private.fail('VALIDATION_FAILED');end if;
  gap:=greatest(0,(request_data->>'start_date')::date-s.end_date);overlap:=greatest(0,least((request_data->>'end_date')::date,s.end_date)-greatest((request_data->>'start_date')::date,s.start_date));
  effects:=jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'action','create','amount_minor',target_product.price_minor::text,'currency',target_product.currency,'reason','Linked new sale; explicit dates; gap='||gap||' overlap='||overlap||'; no right carry or cash refund'));
 end if;
 if is_change then
  keep_ids:=array(select jsonb_array_elements_text(request_data->'keep_reservation_ids')::uuid);cancel_ids:=array(select jsonb_array_elements_text(request_data->'cancel_reservation_ids')::uuid);
  select coalesce(array_agg(v.id order by v.id),array[]::uuid[]) into all_ids from core.reservations v join core.sessions ss on ss.org_id=v.org_id and ss.id=v.session_id where v.org_id=org and v.source_sale_id=s.id and v.state='active' and ss.starts_at>=clock_timestamp();
  select coalesce(array_agg(q order by q),array[]::uuid[]) into selected_ids from unnest(keep_ids||cancel_ids) q;
  if selected_ids<>all_ids then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from core.event_registrations er join core.events e on e.org_id=er.org_id and e.id=er.event_id where er.org_id=org and exists(select 1 from core.entitlement_allocations ea where ea.org_id=org and ea.event_registration_id=er.id and ea.sale_id=s.id and ea.state in ('reserved','consumed')) and er.state='active' and e.starts_at>=clock_timestamp()) then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','OPEN_OPERATIONS_EXIST','retryable',false,'trace_id',pid));end if;
  for v in select * from core.reservations where org_id=org and id=any(all_ids) order by id loop
   if not private.is_manager(org,person,v.center_id) then perform private.fail('FORBIDDEN');end if;
   select * into ses from core.sessions where org_id=org and id=v.session_id;
   select * into a from core.entitlement_allocations where org_id=org and reservation_id=v.id order by created_at desc,id desc limit 1;
   if v.id=any(keep_ids) and (ses.state<>'planned' or ses.attendance_state<>'open' or ses.starts_at<starts or ses.starts_at>=ends or not private.lesson_scope_matches(org,ses.id,target_product.id) or a.state is distinct from 'reserved' or a.quantity<>1 or v.mode<>target_product.booking_mode) then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','ENTITLEMENT_UNAVAILABLE','retryable',false,'trace_id',pid,'field_paths',jsonb_build_array('keep_reservation_ids')));
   end if;
   effects:=effects||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','reservations','id',v.id),'action',case when v.id=any(keep_ids) then 'adjust' else 'cancel' end,'reason',reason));
  end loop;
  quote:=private.p02_refund_quote(org,s.id);
  offset_amount:=coalesce((request_data->>'offset_minor')::bigint,0);
  if offset_amount<0 or offset_amount>target_product.price_minor or offset_amount>private.student_credit_available(org,center,s.person_id,s.currency)+(quote->>'credit_added_minor')::bigint then perform private.fail('VALIDATION_FAILED');end if;
  effects:=effects||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'action','adjust','amount_minor',quote->>'debt_reduction_minor','currency',s.currency,'reason','Frozen refund method '||(quote->>'method')||'; debt reduction before student credit; explicit offset='||offset_amount));
 elsif not is_renew then
  select coalesce(jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','reservations','id',v.id),'action','adjust','reason','Existing confirmed obligation preserved; no automatic cancellation') order by v.id),'[]'::jsonb) into effects from core.reservations v where v.org_id=org and v.source_sale_id=s.id and v.state='active';
  effects:=effects||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'action','close','reason',reason||'; no refund, debt waiver or automatic reservation cancellation'));
 end if;
 dep:=private.p02_dependencies(org,center,account,s.id);
 if is_preview then
  if aux->>'token' is null then perform private.fail('INTEGRITY_VIOLATION');end if;
  if (is_change or is_renew) and jsonb_array_length(blockers)=0 then
   answer:=private.execute_operation('sale_preview_v1',jsonb_build_object('client_api_version',1,'request_id',r->'request_id','org_id',org,'center_id',center,'person_id',s.person_id,'product_version_id',target_product.id,'start_date',request_data->'start_date','end_date',request_data->'end_date'),auth_id,auth_session,preview_bank,aux);
   if answer->>'_internal_retry'='uuid_bank_exhausted' then raise exception using errcode='54000',message='UUID_BANK_EXHAUSTED';end if;
   if not coalesce((answer->>'ok')::bool,false) then perform private.fail(answer#>>'{error,code}');end if;inner_preview:=answer->'data';
   -- Exercise the existing writer and all selected allocations in a rollback-only
   -- subtransaction. A preview never leaves a sale/debt/receipt/allocation behind.
   begin
    answer:=private.execute_operation('sale_apply_v1',jsonb_build_object('client_api_version',1,'request_id',r->'request_id','org_id',org,'center_id',center,'operation_key',private.new_id(bank,3),'preview',jsonb_build_object('id',inner_preview->'id','token',inner_preview->'token')),auth_id,auth_session,apply_bank,null);
    if answer->>'_internal_retry'='uuid_bank_exhausted' then raise exception using errcode='54000',message='UUID_BANK_EXHAUSTED';end if;
    if not coalesce((answer->>'ok')::bool,false) then perform private.fail(answer#>>'{error,code}');end if;
    if is_change then
     for v in select * from core.reservations where org_id=org and id=any(keep_ids) order by id loop
      perform private.lesson_right(org,v.id,false,(answer#>>'{data,operation_id}')::uuid,bank,idx,true);idx:=idx+4;
      perform private.reserve_right(org,s.person_id,(answer#>>'{data,primary_id}')::uuid,v.session_id,null,null,v.id,(answer#>>'{data,operation_id}')::uuid,bank,idx);idx:=idx+3;
     end loop;
    end if;
    raise exception using errcode='P0002',message='P02_PREVIEW_ROLLBACK';
   exception when others then
    if SQLSTATE='54000' and SQLERRM='UUID_BANK_EXHAUSTED' then raise;end if;
    if not (SQLSTATE='P0002' and SQLERRM='P02_PREVIEW_ROLLBACK') then blockers:=blockers||jsonb_build_array(jsonb_build_object('code',case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end,'retryable',false,'trace_id',pid));end if;
   end;

  end if;
  data:=jsonb_build_object('id',pid,'token',aux->>'token','scope_hash',md5(jsonb_build_object('actor',account,'org',org,'center',center,'request',r-'request_id')::text),'dependencies',dep,'effects',effects,'blockers',blockers,'expires_at',clock_timestamp()+interval '15 minutes');
  if is_change or is_renew then data:=data||jsonb_build_object('sale_lifecycle',jsonb_build_object('previous_sale_id',s.id,'product_version_id',target_product.id,'start_date',request_data->'start_date','end_date',request_data->'end_date','previous_end_date',s.end_date,'gap_days',gap,'overlap_days',overlap,'refund',quote,'offset_minor',coalesce(offset_amount,0)::text));end if;
  insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(pid,org,account,replace(op,'_preview_','_apply_'),data->>'scope_hash',dep,data-'token','current');
  insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(pid,jsonb_build_object('center_id',center,'request',r,'sale_preview',inner_preview,'quote',quote),(data->>'expires_at')::timestamptz,encode(extensions.digest(aux->>'token','sha256'),'hex'));
  return jsonb_build_object('data',data,'primary_id',pid,'subject','previews');
 end if;
 if dep<>pv.dependencies then perform private.fail('PREVIEW_STALE');end if;
 if jsonb_array_length(blockers)>0 then perform private.fail(blockers->0->>'code');end if;
 if not is_renew then
  idx:=private.p02_protect(org,s.id,pv.id,jsonb_build_object('kind',case when is_change then 'sale_change' else 'sale_terminate' end,'request',request_data),account,operation,bank,idx);
 end if;
 if is_change then
  if quote is distinct from pp.payload->'quote' then perform private.fail('PREVIEW_STALE');end if;
  insert into private.p02_sale_settlements(id,org_id,sale_id,operation_id,quote) values(private.new_id(bank,idx),org,s.id,operation,quote);idx:=idx+1;
  for entry in select x from jsonb_array_elements(quote->'debts') x loop
   insert into core.debt_adjustments(id,org_id,center_id,debt_id,amount_minor,direction,reason,operation_id) values(private.new_id(bank,idx),org,center,(entry->>'debt_id')::uuid,(entry->>'reduction_minor')::bigint,'decrease',reason,operation);
   perform private.claim_debt_overpayment(org,(entry->>'debt_id')::uuid,operation,bank,idx+1);idx:=idx+2;
   update core.debts set state=case when private.debt_remaining(org,id)=0 then 'settled' else 'open' end,version=version+1 where org_id=org and id=(entry->>'debt_id')::uuid;
  end loop;
  for v in select * from core.reservations where org_id=org and id=any(cancel_ids||keep_ids) order by id for update loop
   perform private.lesson_right(org,v.id,false,operation,bank,idx,true);idx:=idx+4;
   if v.id=any(cancel_ids) then update core.reservations set state='cancelled',cancellation_reason=reason,version=version+1 where org_id=org and id=v.id;end if;
  end loop;
 end if;
 if is_change or is_renew then
  inner_preview:=pp.payload->'sale_preview';
  answer:=private.execute_operation('sale_apply_v1',jsonb_build_object('client_api_version',1,'request_id',r->'request_id','org_id',org,'center_id',center,'operation_key',private.new_id(bank,3),'preview',jsonb_build_object('id',inner_preview->'id','token',inner_preview->'token')),auth_id,auth_session,apply_bank,null);
  if answer->>'_internal_retry'='uuid_bank_exhausted' then raise exception using errcode='54000',message='UUID_BANK_EXHAUSTED';end if;
  if not coalesce((answer->>'ok')::bool,false) then perform private.fail(answer#>>'{error,code}');end if;new_sale:=(answer#>>'{data,primary_id}')::uuid;
  update core.sales set previous_sale_id=s.id where org_id=org and id=new_sale;
  if is_change then
   for v in select * from core.reservations where org_id=org and id=any(keep_ids) order by id for update loop
    perform private.reserve_right(org,s.person_id,new_sale,v.session_id,null,null,v.id,operation,bank,idx);idx:=idx+3;
    update core.reservations set source_sale_id=new_sale,version=version+1,booking_obligation=coalesce(booking_obligation,'{}'::jsonb)||jsonb_build_object('explicit_source_change',jsonb_build_object('previous_sale_id',s.id,'sale_id',new_sale,'operation_id',operation)) where org_id=org and id=v.id;
   end loop;
   remaining:=offset_amount;
   for new_debt in select * from core.debts where org_id=org and sale_id=new_sale order by created_at,id for update loop
    part:=least(remaining,private.debt_remaining(org,new_debt.id));
    if part>0 then
     if private.student_credit_available(org,center,s.person_id,s.currency)<part then perform private.fail('INSUFFICIENT_STUDENT_CREDIT');end if;
     insert into core.student_credit_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,source_sale_id,operation_id) values(private.new_id(bank,idx),org,center,s.person_id,'offset_subtract',part,s.currency,new_sale,operation);
     insert into core.debt_allocations(id,org_id,center_id,debt_id,credit_movement_id,amount_minor) values(private.new_id(bank,idx+1),org,center,new_debt.id,private.new_id(bank,idx),part);idx:=idx+2;remaining:=remaining-part;
     update core.debts set state=case when private.debt_remaining(org,id)=0 then 'settled' else 'open' end,version=version+1 where org_id=org and id=new_debt.id;
    end if;
   end loop;
   if remaining<>0 then perform private.fail('INTEGRITY_VIOLATION');end if;
  end if;
  related:=jsonb_build_array(jsonb_build_object('type','sales','id',s.id));pid:=new_sale;
 else pid:=s.id;end if;
 if not is_renew then
  -- Close only the free remainder. Reserved/consumed historical obligations remain linked.
  qty:=greatest(0,private.credit_available(org,s.id));
  if p.kind='credits' and qty>0 then insert into core.entitlement_movements(id,org_id,sale_id,person_id,kind,quantity,operation_id) values(private.new_id(bank,idx),org,s.id,s.person_id,'adjust_subtract',qty,operation);idx:=idx+1;end if;
  update core.sales set state='terminated',version=version+1 where org_id=org and id=s.id returning version into ver;
  update core.entitlement_accounts set state='closed',balance_version=balance_version+1,version=version+1 where org_id=org and sale_id=s.id;
 end if;
 perform private.p02_sale_notice(org,s.person_id,pid,operation,bank,idx,op);idx:=idx+2;
 update core.previews set state='applied',version=version+1 where id=pv.id;
 if is_renew or is_change then ver:=1;end if;
 data:=jsonb_build_object('operation_id',operation,'primary_id',pid,'version',ver,'replayed',false,'related',related);
 return jsonb_build_object('data',data,'primary_id',pid,'subject','sales','audit',jsonb_build_object('before',before_data,'request',request_data,'quote',quote,'after',(select to_jsonb(q) from core.sales q where q.org_id=org and q.id=pid)));
end$$;
do $obligations$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.schedule_validate(uuid,uuid,jsonb)'::regprocedure);
 old:=$p$    then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;$p$;
 if strpos(b,old)=0 then raise exception 'P02 protected schedule anchor missing';end if;
 b:=replace(b,$p$    if sale.state<>'active'$p$,$p$    if (sale.state<>'active'$p$);
 b:=replace(b,old,$p$    ) and not (private.lesson_protected(org,r.reservation_id) and at_time=(select q.starts_at from core.sessions q where q.org_id=org and q.id=(d->>'id')::uuid)) then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;$p$);execute b;
 b:=pg_get_functiondef('private.purchased_rights(jsonb,uuid,uuid,uuid)'::regprocedure);
 old:=$p$'available',case when p.kind='credits'$p$;
 if strpos(b,old)=0 then raise exception 'P02 closed pool projection anchor missing';end if;
 execute replace(b,old,$p$'available',case when s.state<>'active' or a.state<>'active' then 0 when p.kind='credits'$p$);
end$obligations$;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old:='  cm:=center is not null and private.is_manager(org,person,center);org_reader:=private.is_org_reader(org,person);';
 if strpos(b,old)=0 then raise exception 'P02 sale scope anchor missing';end if;
 b:=replace(b,old,$p$  if p_operation in ('sale_terminate_preview_v1','sale_change_preview_v1','sale_renew_preview_v1') then
   select s.center_id into selected from core.sales s where s.org_id=org and s.id=coalesce((r->>'sale_id')::uuid,(r->>'previous_sale_id')::uuid);
   if selected is null or (center is not null and center<>selected) then perform private.fail('NOT_FOUND');end if;center:=selected;
  end if;
$p$||old);
 b:=replace(b,' -- DOMAIN_CASES',$p$
 when 'sale_terminate_preview_v1','sale_terminate_apply_v1','sale_change_preview_v1','sale_change_apply_v1','sale_renew_preview_v1','sale_renew_apply_v1' then
  terms:=private.p02_sale(p_operation,r,org,center,actor.id,person,operation_id,p_ids,p_aux,p_actor_auth_id,p_session_id);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';audit_delta:=terms->'audit';
  if terms#>>'{audit,request,reason}' is not null then r:=r||jsonb_build_object('reason',terms#>>'{audit,request,reason}');end if;
 -- DOMAIN_CASES$p$);execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
