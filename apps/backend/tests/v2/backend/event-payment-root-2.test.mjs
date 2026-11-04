import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call} from '../../api-client.mjs';
import {connect} from '../../../scripts/db.mjs';
import {newUuidV7 as key} from '../../../scripts/uuid.mjs';



test('P03 linked finance corrections, frozen refunds and instructor payments',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('p03-owner'),stranger=await authUser('p03-stranger');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P03 '+key(),initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'P03 center',timezone:'Europe/Istanbul'},key())).primary_id;
 const db=await connect();const scope=b=>({org_id:org,center_id:center,...b});
 const m=(op,b,k=key())=>must(owner,op,scope(b),k),read=b=>must(owner,'finance_get_v1',scope({currency:'TRY',page:{limit:2,sort:'created_at_asc'},...b}));
 const bad=async(op,b,code,user=owner,k=key())=>{const r=await call(user,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r));assert.equal(r.result.error.code,code,JSON.stringify(r));return r;};
 const now=()=>new Date().toISOString(),row=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
 const pvref=p=>({preview:{id:p.id,token:p.token}});
 try{
 const operson=(await row('select owner_person_id from core.organizations where id=$1',[org])).owner_person_id;
 await m('center_manager_assign_v1',{person_id:operson});
 const payment=await m('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic P03',occurred_at:now()});
 await must(platform,'saas_payment_verify_v1',scope({payment_id:payment.primary_id,accepted:true}),key());
 const person=(await m('person_create_v1',{display_name:'P03 student',contacts:[]})).primary_id;await m('student_activate_v1',{person_id:person});
 let cash,sale;
 await t.test('finance reads filter currency and center; corrections append, replay and stale previews',async()=>{
  cash=(await m('collection_record_v1',{person_id:person,amount_minor:'500',currency:'TRY',occurred_at:now()})).primary_id;
  assert.equal((await read({person_id:person})).credit_available_minor,'500');
  await bad('finance_get_v1',{person_id:person,currency:'TRY',page:{}},'NOT_FOUND',stranger);
  const staff=await authUser('p03-collection-staff'),staffAccount=await must(staff,'account_get_v1');
  const staffPerson=(await m('person_create_v1',{display_name:'P03 collection staff',contacts:[]})).primary_id;
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,staffAccount.id,staffPerson]);
  await m('role_assign_v1',{person_id:staffPerson,role:'staff',scope:{center_id:center}});
  const staffVersion=(await must(owner,'person_get_v1',scope({person_id:staffPerson}))).version;
  assert.equal(staffVersion,2); // Verified link projected the account name over the organization-only name.
  await bad('permission_set_v1',{person_id:staffPerson,permission:'finance.collect',expected_version:1,enabled:true},'VERSION_CONFLICT');
  await m('permission_set_v1',{person_id:staffPerson,permission:'finance.collect',expected_version:staffVersion,enabled:true});
  await bad('finance_get_v1',{person_id:person,currency:'TRY',page:{}},'FORBIDDEN',staff);

  const q={cash_movement_id:cash,correction:{amount_minor:'100',currency:'TRY',occurred_at:now(),direction:'decrease'},reason:'P03 amount correction'};
  await bad('collection_correct_preview_v1',{...q,correction:{...q.correction,amount_minor:'0'}},'VALIDATION_FAILED');
  await bad('collection_correct_preview_v1',{...q,correction:{...q.correction,currency:'EUR'}},'CURRENCY_MISMATCH');
  const p=await must(owner,'collection_correct_preview_v1',scope(q));assert.deepEqual(p.blockers,[]);
  assert.equal((await read({person_id:person})).credit_available_minor,'500');
  const k=key(),a=await m('collection_correct_apply_v1',pvref(p),k);assert.equal((await m('collection_correct_apply_v1',pvref(p),k)).primary_id,a.primary_id);
  assert.equal((await read({person_id:person})).credit_available_minor,'400');
  assert.equal((await row('select amount_minor::text amount from core.cash_movements where id=$1',[cash])).amount,'500');
  const other=await m('collection_record_v1',{person_id:person,amount_minor:'10',currency:'EUR',occurred_at:now()});
  const eur=await read({person_id:person,currency:'EUR'});assert.equal(eur.credit_available_minor,'10');assert(eur.movements.items.every(x=>x.currency==='EUR'));
  const stale=await must(owner,'collection_correct_preview_v1',scope(q));await m('collection_record_v1',{person_id:person,amount_minor:'1',currency:'TRY',occurred_at:now()});
  await bad('collection_correct_apply_v1',pvref(stale),'PREVIEW_STALE');
  const first=await read({person_id:person});assert(first.movements.next_cursor);
  const second=await read({person_id:person,page:{limit:2,sort:'created_at_asc',cursor:first.movements.next_cursor}});
  assert(!first.movements.items.some(x=>second.movements.items.some(y=>x.id===y.id)));
  await bad('finance_get_v1',{person_id:person,currency:'EUR',page:{cursor:first.movements.next_cursor}},'VALIDATION_FAILED');
  assert(other.primary_id);
 });
 await t.test('collection reduction cannot erase spent surplus and late audit failure rolls back',async()=>{
  await m('student_credit_refund_v1',{person_id:person,amount_minor:'400',currency:'TRY',occurred_at:now(),reason:'P03 spent credit'});
  const q={cash_movement_id:cash,correction:{amount_minor:'100',currency:'TRY',occurred_at:now(),direction:'decrease'},reason:'P03 cannot erase'};
  const p=await must(owner,'collection_correct_preview_v1',scope(q));
  await bad('collection_correct_apply_v1',pvref(p),'INSUFFICIENT_STUDENT_CREDIT');
  const q2={cash_movement_id:cash,correction:{amount_minor:'30',currency:'TRY',occurred_at:now(),direction:'increase'},reason:'P03 rollback'};
  const p2=await must(owner,'collection_correct_preview_v1',scope(q2)),k=key();
  await db.query("create function private.p03_test_reject() returns trigger language plpgsql as $$begin if new.org_id='"+org+"'::uuid and new.action='collection_correct_apply_v1' then raise exception 'INTEGRITY_VIOLATION';end if;return new;end$$");
  await db.query('create trigger p03_test_reject before insert on core.audit_events for each row execute function private.p03_test_reject()');
  try{await bad('collection_correct_apply_v1',pvref(p2),'INTEGRITY_VIOLATION',owner,k);}
  finally{await db.query('drop trigger p03_test_reject on core.audit_events');await db.query('drop function private.p03_test_reject()');}
  assert.equal((await row('select private.p03_cash_net($1,$2)::text net',[org,cash])).net,'400');
  await m('collection_correct_apply_v1',pvref(p2),k);
 });
 await t.test('frozen sale refund decreases debt once, credits only collected excess and preserves rights',async()=>{
  const terms={name:'P03 refundable',kind:'credits',booking_mode:'flexible',credits:10,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'credit_ratio'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson','event']}]};
  const product=(await m('product_publish_v1',{terms})).primary_id;
  const p=await must(owner,'sale_preview_v1',scope({person_id:person,product_version_id:product,start_date:new Date(Date.now()+86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+366*86400000).toISOString().slice(0,10)}));
  sale=(await m('sale_apply_v1',pvref(p))).primary_id;
  const debt=(await row('select id from core.debts where org_id=$1 and sale_id=$2',[org,sale])).id;
  const paid=(await m('collection_record_v1',{person_id:person,debt_ids:[debt],amount_minor:'600',currency:'TRY',occurred_at:now()})).primary_id;
  const before=await row('select count(*)::int n from core.entitlement_movements where org_id=$1 and sale_id=$2',[org,sale]);
  const refund=await must(owner,'sale_refund_preview_v1',scope({sale_id:sale,reason:'P03 frozen refund'}));assert.deepEqual(refund.blockers,[]);
  const keys=[key(),key()],attempts=await Promise.all(keys.map(k=>call(owner,'sale_refund_apply_v1',scope(pvref(refund)),k)));
  assert.equal(attempts.filter(x=>x.result.ok).length,1,JSON.stringify(attempts));
  assert.equal(attempts.find(x=>!x.result.ok).result.error.code,'PREVIEW_STALE');
  const winner=attempts.find(x=>x.result.ok).result.data;assert.equal(winner.primary_id,sale);
  const replay=await m('sale_refund_apply_v1',pvref(refund),keys[attempts.findIndex(x=>x.result.ok)]);assert.equal(replay.primary_id,sale);assert.equal(replay.version,winner.version);
  const audit=await row('select subject_table,subject_id from core.audit_events where org_id=$1 and operation_id=$2',[org,winner.operation_id]);assert.equal(audit.subject_table,'sales');assert.equal(audit.subject_id,sale);
  assert.equal((await row('select business_reference from core.operation_receipts where id=$1',[winner.operation_id])).business_reference,sale);
  assert.equal((await row('select private.debt_net($1,$2)::text net,private.debt_claimed($1,$2)::text claimed',[org,debt])).net,'0');
  assert.equal((await row('select private.debt_claimed($1,$2)::text claimed',[org,debt])).claimed,'600');
  assert.equal((await row('select count(*)::int n from core.entitlement_movements where org_id=$1 and sale_id=$2',[org,sale])).n,before.n);
  const again=await must(owner,'sale_refund_preview_v1',scope({sale_id:sale,reason:'P03 repeat cannot claim'}));await m('sale_refund_apply_v1',pvref(again));
  assert.equal((await row('select private.debt_claimed($1,$2)::text claimed',[org,debt])).claimed,'600');
  const corrected=await must(owner,'collection_correct_preview_v1',scope({cash_movement_id:paid,correction:{amount_minor:'100',currency:'TRY',occurred_at:now(),direction:'decrease'},reason:'P03 linked prior claim'}));
  await m('collection_correct_apply_v1',pvref(corrected));assert.equal((await row('select private.debt_claimed($1,$2)::text claimed',[org,debt])).claimed,'500');
  const debtVersion=(await row('select version from core.debts where id=$1',[debt])).version;
  await m('debt_adjust_v1',{debt_id:debt,amount_minor:'1000',direction:'increase',reason:'P03 later independent charge'});
  assert.equal((await row('select private.debt_remaining($1,$2)::text remaining',[org,debt])).remaining,'1000');
  const creditBefore=(await read({person_id:person})).credit_available_minor;
  const next=await must(owner,'collection_correct_preview_v1',scope({cash_movement_id:paid,correction:{amount_minor:'100',currency:'TRY',occurred_at:now(),direction:'decrease'},reason:'P03 bounded reverse after new debt'}));
  const creditEffect=next.effects.filter(x=>x.entity.type==='people').reduce((n,x)=>n+BigInt(x.amount_minor),0n);assert(creditEffect<=100n);
  await m('collection_correct_apply_v1',pvref(next));
  assert.equal(BigInt(creditBefore)-BigInt((await read({person_id:person})).credit_available_minor),100n);
  assert.equal((await row('select private.debt_remaining($1,$2)::text remaining',[org,debt])).remaining,'1000');

  const topup=await must(owner,'collection_correct_preview_v1',scope({cash_movement_id:paid,correction:{amount_minor:'900',currency:'TRY',occurred_at:now(),direction:'increase'},reason:'P03 second allocation source'}));await m('collection_correct_apply_v1',pvref(topup));
  const undo=await must(owner,'collection_correct_preview_v1',scope({cash_movement_id:paid,correction:{amount_minor:'1000',currency:'TRY',occurred_at:now(),direction:'decrease'},reason:'P03 split linked reversals'}));
  const undone=await m('collection_correct_apply_v1',pvref(undo));
  assert.equal((await row('select count(*)::int n from core.debt_allocations where org_id=$1 and cash_movement_id=$2 and amount_minor<0',[org,undone.primary_id])).n,2);
  assert.equal((await row('select count(*)::int n from core.debt_allocations p where p.org_id=$1 and p.amount_minor>0 and p.amount_minor+coalesce((select sum(n.amount_minor) from core.debt_allocations n where n.org_id=$1 and n.previous_id=p.id),0)<0',[org])).n,0);
  assert.equal((await row('select private.debt_remaining($1,$2)::text remaining',[org,debt])).remaining,'700');


 });

 await t.test('actual P02 product change settlement is consumed by P03 refund without a second claim',async()=>{
  const p=(await m('person_create_v1',{display_name:'P03 P02 chain student',contacts:[]})).primary_id;await m('student_activate_v1',{person_id:p});
  const terms={name:'P03 chain old',kind:'credits',booking_mode:'flexible',credits:4,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'credit_ratio'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson','event']}]};
  const oldProduct=(await m('product_publish_v1',{terms})).primary_id;
  const newProduct=(await m('product_publish_v1',{terms:{...terms,name:'P03 chain new',price_minor:'500'}})).primary_id;
  const dates={start_date:new Date(Date.now()+86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+366*86400000).toISOString().slice(0,10)};
  const pre=await must(owner,'sale_preview_v1',scope({person_id:p,product_version_id:oldProduct,...dates}));
  const oldSale=(await m('sale_apply_v1',pvref(pre))).primary_id;
  const debt=(await row('select id from core.debts where org_id=$1 and sale_id=$2',[org,oldSale])).id;
  await m('collection_record_v1',{person_id:p,debt_ids:[debt],amount_minor:'1000',currency:'TRY',occurred_at:now()});
  const change=await must(owner,'sale_change_preview_v1',scope({sale_id:oldSale,new_product_version_id:newProduct,...dates,keep_reservation_ids:[],cancel_reservation_ids:[],offset_minor:'0',reason:'P03 real P02 linked change'}));
  assert.deepEqual(change.blockers,[]);await m('sale_change_apply_v1',pvref(change));
  assert.equal((await row('select private.debt_claimed($1,$2)::text claimed',[org,debt])).claimed,'1000');
  assert.equal((await row('select count(*)::int n from private.p02_sale_settlements where org_id=$1 and sale_id=$2',[org,oldSale])).n,1);
  const before=(await read({person_id:p})).credit_available_minor;
  const refund=await must(owner,'sale_refund_preview_v1',scope({sale_id:oldSale,reason:'P03 cannot duplicate P02 claim'}));
  assert(refund.effects.every(x=>BigInt(x.amount_minor??'0')===0n));await m('sale_refund_apply_v1',pvref(refund));
  assert.equal((await read({person_id:p})).credit_available_minor,before);
  assert.equal((await row('select private.debt_claimed($1,$2)::text claimed',[org,debt])).claimed,'1000');
 });

 await t.test('collection correction updates event payment preparation without cancelling an active registration',async()=>{
  const student=(await m('person_create_v1',{display_name:'P03 event finance student',contacts:[]})).primary_id;await m('student_activate_v1',{person_id:student});
  const starts=Date.now()+86400000;
  const event=(await m('event_save_v1',{name:'P03 financial correction event',interval:{starts_at:new Date(starts).toISOString(),ends_at:new Date(starts+3600000).toISOString()},timezone:'Europe/Istanbul',
   venue:{kind:'external',name:'P03 synthetic',address:'Synthetic',timezone:'Europe/Istanbul'},capacity:{nominal:10,maximum:10},discipline_ids:[],
   assignments:[{person_id:operson,duty:'instructor',fee_minor:'0',currency:'TRY'}],
   terms:{fee_minor:'1000',currency:'TRY',full_payment_required:true,allowed_product_version_ids:[],cancellation:{before_cutoff:'release',after_cutoff:'consume',no_show:'consume'},refund:{method:'none'}}})).primary_id;
  await m('event_publish_v1',{event_id:event,published:true});
  const prepared=await m('event_payment_prepare_v1',{event_id:event,person_id:student});
  const original=(await m('collection_record_v1',{person_id:student,debt_ids:[prepared.debt_id],amount_minor:'1000',currency:'TRY',occurred_at:now()})).primary_id;
  const registration=(await m('event_register_v1',{event_id:event,person_id:student,preparation_id:prepared.id})).primary_id;
  const preview=await must(owner,'collection_correct_preview_v1',scope({cash_movement_id:original,correction:{amount_minor:'100',currency:'TRY',occurred_at:now(),direction:'decrease'},reason:'P03 linked event correction'}));
  await m('collection_correct_apply_v1',pvref(preview));
  const current=await must(owner,'event_payment_get_v1',scope({preparation_id:prepared.id}));
  assert.equal(current.paid_minor,'900');assert.equal(current.remaining_minor,'100');
  assert.equal((await row('select state from core.event_registrations where id=$1',[registration])).state,'active');
  assert.equal((await row('select count(*)::int n from core.student_credit_movements where org_id=$1 and person_id=$2',[org,student])).n,0);
 });

 await t.test('instructor payment selected net earnings; concurrent overpay, correction version and separate cash',async()=>{
  // Financial-only synthetic earning facts; actual attendance earning creation remains in instructor suite.
  const earning=key(),receipt=(await row('select id from core.operation_receipts where org_id=$1 order by created_at,id limit 1',[org])).id;
  await db.query("insert into core.earnings(id,org_id,center_id,person_id,amount_minor,currency,basis,operation_id,direction) values($1,$2,$3,$4,1000,'TRY',$5,$6,'add')",[earning,org,center,operson,{source:'event_fee',currency:'TRY',quantity:1,excluded_blocked:0},receipt]);
  const body={person_id:operson,earning_ids:[earning],amount_minor:'600',currency:'TRY',occurred_at:now()};
  const results=await Promise.all([call(owner,'instructor_payment_record_v1',scope(body),key()),call(owner,'instructor_payment_record_v1',scope(body),key())]);
  assert.equal(results.filter(x=>x.result.ok).length,1,JSON.stringify(results));const payment=results.find(x=>x.result.ok).result.data.primary_id;
  const paid=await row('select sum(amount_minor)::text paid from core.earning_allocations where org_id=$1 and earning_id=$2',[org,earning]);assert.equal(paid.paid,'600');
  const correct={payment_id:payment,expected_version:1,correction:{amount_minor:'200',currency:'TRY',occurred_at:now(),direction:'decrease'},reason:'P03 payment correction'};
  const k=key(),correctionResult=await m('instructor_payment_correct_v1',correct,k);assert.equal(correctionResult.primary_id,payment);assert.equal(correctionResult.version,2);assert(correctionResult.related.some(x=>x.type==='instructor_payments'&&x.id!==payment));await m('instructor_payment_correct_v1',correct,k);
  await bad('instructor_payment_correct_v1',correct,'VERSION_CONFLICT');
  assert.equal((await row('select private.p03_payment_net($1,$2)::text net',[org,payment])).net,'400');
  assert.equal((await row('select amount_minor::text amount from core.instructor_payments where id=$1',[payment])).amount,'600');
  assert.equal((await row('select count(*)::int n from core.cash_movements where org_id=$1 and person_id=$2',[org,operson])).n,0);
  const reads=await must(owner,'earnings_list_v1',scope({person_id:operson,interval:{starts_at:'2026-01-01T00:00:00Z',ends_at:'2027-01-01T00:00:00Z'},page:{}}));
  const view=reads.items.find(x=>x.id===earning);assert(view);assert.equal(view.paid_minor,'400');assert.equal(view.remaining_minor,'600');assert.equal(view.payments[0].version,2);
  await bad('instructor_payment_record_v1',{...body,currency:'EUR'},'CURRENCY_MISMATCH');

  await m('instructor_payment_correct_v1',{...correct,expected_version:2,correction:{...correct.correction,amount_minor:'600',direction:'increase'}});
  await m('instructor_payment_correct_v1',{...correct,expected_version:3,correction:{...correct.correction,amount_minor:'800',direction:'decrease'}});
  assert.equal((await row('select count(*)::int n from core.earning_allocations p where p.org_id=$1 and p.amount_minor>0 and p.amount_minor+coalesce((select sum(n.amount_minor) from core.earning_allocations n where n.org_id=$1 and n.previous_id=p.id),0)<0',[org])).n,0);
  assert.equal((await row('select private.p03_payment_net($1,$2)::text net',[org,payment])).net,'200');
  await m('instructor_payment_correct_v1',{...correct,expected_version:4,correction:{...correct.correction,amount_minor:'200',direction:'increase'}});

  await db.query("insert into core.earnings(id,org_id,center_id,person_id,amount_minor,currency,basis,operation_id,direction,previous_id) values($1,$2,$3,$4,800,'TRY',$5,$6,'subtract',$7)",[key(),org,center,operson,{source:'event_fee',currency:'TRY',quantity:1,excluded_blocked:0},receipt,earning]);
  const revised=await must(owner,'earnings_list_v1',scope({person_id:operson,interval:{starts_at:'2026-01-01T00:00:00Z',ends_at:'2027-01-01T00:00:00Z'},page:{}}));
  assert.equal(revised.items.find(x=>x.id===earning).overpaid_minor,'200');
 });
 }finally{await db.end();}
});
