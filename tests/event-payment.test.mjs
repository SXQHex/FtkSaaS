import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Q-E01 real Auth/API payment preparation and financial cancellation acceptance',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('qe01-owner'),outsider=await authUser('qe01-outsider');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Q-E01 '+key(),initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Q-E01 center',timezone:'Europe/Istanbul'},key())).primary_id;
 const db=await connect();
 const scoped=b=>({org_id:org,center_id:center,...b}),mutate=(op,b,k=key())=>must(owner,op,scoped(b),k);
 const fail=async(op,b,code,k=key(),user=owner)=>{const r=await call(user,op,scoped(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));return r;};
 const count=async(sql,args=[])=>(await db.query(sql,args)).rows[0].n;
 const receiptCount=async k=>count('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')]);
 const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 let slot=0;
 const terms={fee_minor:'1000',currency:'TRY',full_payment_required:true,allowed_product_version_ids:[],cancellation:{before_cutoff:'release',after_cutoff:'consume',no_show:'consume'},refund:{method:'none'}};
 async function person(){const p=(await mutate('person_create_v1',{display_name:'Q-E01 student '+key(),contacts:[]})).primary_id;await mutate('student_activate_v1',{person_id:p});return p;}
 async function event(extra={}){const at=Date.now()+86400000+(slot++)*7200000;const input={name:'Q-E01 event '+key(),interval:{starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()},timezone:'Europe/Istanbul',venue:{kind:'external',name:'Test',address:'Synthetic',timezone:'Europe/Istanbul'},capacity:{nominal:10,maximum:10},terms,discipline_ids:[],assignments:[{person_id:ownerPerson,duty:'instructor',fee_minor:'0',currency:'TRY'}],...extra};const id=(await mutate('event_save_v1',input)).primary_id;await mutate('event_publish_v1',{event_id:id,published:true});return id;}
 const prepare=(e,p,k=key())=>mutate('event_payment_prepare_v1',{event_id:e,person_id:p},k);
 const get=p=>must(owner,'event_payment_get_v1',scoped({preparation_id:p}));
 const collect=(p,debt,amount,k=key())=>mutate('collection_record_v1',{person_id:p,debt_ids:[debt],amount_minor:String(amount),currency:'TRY',occurred_at:new Date().toISOString()},k);
 const register=(e,p,prep,k=key())=>mutate('event_register_v1',{event_id:e,person_id:p,preparation_id:prep},k);
 const preview=e=>must(owner,'event_cancel_preview_v1',scoped({event_id:e,reason:'Q-E01 operator cancellation'}));
 const apply=(p,k=key())=>mutate('event_cancel_apply_v1',{preview:{id:p.id,token:p.token}},k);
 async function debtForRegistration(r){return(await db.query('select * from core.debts where org_id=$1 and event_registration_id=$2',[org,r])).rows[0];}
 let trigger;
 async function rejectAudit(action,subject){
  trigger='qe01_'+key().replaceAll('-','');
  await db.query("create function private."+trigger+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  const condition="new.action='"+action+"' and new.org_id='"+org+"'::uuid"+(subject?" and new.subject_id='"+subject+"'::uuid":"");
  await db.query("create trigger "+trigger+" before insert on core.audit_events for each row when ("+condition+") execute function private."+trigger+"()");
 }
 async function removeTrigger(){if(trigger){await db.query('drop trigger if exists '+trigger+' on core.audit_events');await db.query('drop function private.'+trigger+'()');trigger=null;}}
 try{
 await mutate('center_manager_assign_v1',{person_id:ownerPerson});
 const pay=await mutate('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC Q-E01',occurred_at:new Date().toISOString()});
 await must(platform,'saas_payment_verify_v1',scoped({payment_id:pay.primary_id,accepted:true}),key());

 await t.test('preparation creates one scoped debt and no seat; same and different-key repeats reuse it',async()=>{
  const e=await event(),p=await person(),k=key(),a=await prepare(e,p,k),b=await prepare(e,p,k),c=await prepare(e,p);
  assert.equal(a.id,b.id);assert.equal(a.id,c.id);assert.equal(a.debt_id,c.debt_id);assert.equal(a.remaining_minor,'1000');
  assert.equal(await count('select count(*)::int n from core.event_registrations where org_id=$1 and event_id=$2',[org,e]),0);
  assert.equal(await count('select count(*)::int n from core.debts where org_id=$1 and person_id=$2',[org,p]),1);
  await fail('event_payment_prepare_v1',{event_id:e,person_id:await person()},'IDEMPOTENCY_PAYLOAD_MISMATCH',k);
  const view=await must(owner,'event_get_v1',scoped({event_id:e}));
  await mutate('event_save_v1',{event_id:e,expected_version:view.version,name:view.name,interval:view.interval,timezone:view.timezone,venue:view.venue,capacity:view.capacity,terms:{...view.terms,full_payment_required:false},discipline_ids:view.discipline_ids,assignments:view.assignment_terms});
  await fail('event_register_v1',{event_id:e,person_id:p},'ENTITLEMENT_UNAVAILABLE');
  assert.equal(await count('select count(*)::int n from core.debts where org_id=$1 and person_id=$2',[org,p]),1);

 });
 await t.test('partial or wrong-debt payment cannot register; explicit full allocation reuses the debt',async()=>{
  const e=await event(),p=await person(),a=await prepare(e,p),other=await prepare(await event(),p);
  await collect(p,other.debt_id,1000);await fail('event_register_v1',{event_id:e,person_id:p,preparation_id:a.id},'ENTITLEMENT_UNAVAILABLE');
  await fail('collection_record_v1',{person_id:p,debt_ids:[a.debt_id],amount_minor:'1000',currency:'EUR',occurred_at:new Date().toISOString()},'CURRENCY_MISMATCH');
  await collect(p,a.debt_id,400);assert.equal((await get(a.id)).paid_minor,'400');
  await fail('event_register_v1',{event_id:e,person_id:p,preparation_id:a.id},'ENTITLEMENT_UNAVAILABLE');
  await collect(p,a.debt_id,600);const pv=await must(owner,'event_registration_preview_v1',scoped({event_id:e,person_id:p,preparation_id:a.id}));assert.deepEqual(pv.blockers,[]);
  const k=key(),r=await mutate('event_register_v1',{event_id:e,person_id:p,preparation_id:a.id,preview:{id:pv.id,token:pv.token}},k);
  assert.equal(r.outcome,'registered');assert.equal((await get(a.id)).registration_id,r.primary_id);
  assert.equal((await debtForRegistration(r.primary_id)).id,a.debt_id);
  assert.equal((await mutate('event_register_v1',{event_id:e,person_id:p,preparation_id:a.id,preview:{id:pv.id,token:pv.token}},k)).replayed,true);
  await fail('event_register_v1',{event_id:e,person_id:p,preparation_id:a.id},'RESERVATION_EXISTS');
 });
 let raceEvent,racePeople,racePreparations,loserPreparation;
 await t.test('two fully paid preparations race for the last seat: one registration and one committed credit closure',async()=>{
  raceEvent=await event({capacity:{nominal:1,maximum:1}});racePeople=[await person(),await person()];
  racePreparations=await Promise.all(racePeople.map(p=>prepare(raceEvent,p)));
  for(let i=0;i<2;i++)await collect(racePeople[i],racePreparations[i].debt_id,1000);
  assert.equal(await count('select count(*)::int n from core.event_registrations where org_id=$1 and event_id=$2',[org,raceEvent]),0);
  const keys=[key(),key()],rs=await Promise.all(racePeople.map((p,i)=>register(raceEvent,p,racePreparations[i].id,keys[i])));
  assert.equal(rs.filter(r=>r.outcome==='registered').length,1);assert.equal(rs.filter(r=>r.outcome==='capacity_closed').length,1);
  const loser=rs.findIndex(r=>r.outcome==='capacity_closed');loserPreparation=racePreparations[loser];
  const closed=rs[loser];assert.equal(closed.student_credit_added_minor,'1000');assert.equal(closed.remaining_removed_minor,'0');
  const state=await get(loserPreparation.id);assert.equal(state.state,'capacity_closed');assert.equal(state.registration_id,null);assert.equal(state.remaining_minor,'0');assert.equal(state.student_credit_available_minor,'1000');
  assert.equal(await count('select count(*)::int n from core.event_registrations where org_id=$1 and event_id=$2',[org,raceEvent]),1);
  assert.equal(await count('select count(*)::int n from core.debts where org_id=$1 and person_id=any($2::uuid[])',[org,racePeople]),2);
  assert.equal(await count("select count(*)::int n from core.student_credit_movements where org_id=$1 and source_debt_id=$2 and kind='refund_claim_add'",[org,loserPreparation.debt_id]),1);
  for(let i=0;i<2;i++){const replay=await register(raceEvent,racePeople[i],racePreparations[i].id,keys[i]);assert.equal(replay.outcome,rs[i].outcome);assert.equal(replay.replayed,true);}
  await fail('event_register_v1',{event_id:raceEvent,person_id:racePeople[loser],preparation_id:loserPreparation.id},'INVALID_STATE_TRANSITION');
  assert.equal(await receiptCount(keys[loser]),1);
 });
 await t.test('explicit offset and cash refund stay separate, scoped and bounded; later cancellation never credits twice',async()=>{
  const p=racePeople[racePreparations.findIndex(x=>x.id===loserPreparation.id)];
  const otherEvent=await event({terms:{...terms,full_payment_required:false,fee_minor:'700'}});
  const r=await mutate('event_register_v1',{event_id:otherEvent,person_id:p}),d=await debtForRegistration(r.primary_id);
  const offsetKey=key();await mutate('student_credit_offset_v1',{person_id:p,debt_id:d.id,expected_version:Number(d.version),amount_minor:'300',currency:'TRY'},offsetKey);
  await mutate('student_credit_offset_v1',{person_id:p,debt_id:d.id,expected_version:Number(d.version),amount_minor:'300',currency:'TRY'},offsetKey);
  assert.equal((await get(loserPreparation.id)).student_credit_available_minor,'700');
  const cashBefore=await count('select count(*)::int n from core.cash_movements where org_id=$1 and person_id=$2',[org,p]);
  await apply(await preview(raceEvent));
  assert.equal((await get(loserPreparation.id)).student_credit_available_minor,'700');
  assert.equal(await count('select count(*)::int n from core.cash_movements where org_id=$1 and person_id=$2',[org,p]),cashBefore);
  assert.equal((await db.query('select private.debt_remaining($1,$2) n',[org,d.id])).rows[0].n,'400');
  const refundKey=key(),body={person_id:p,amount_minor:'700',currency:'TRY',occurred_at:new Date().toISOString(),reason:'explicit cash refund'};
  await mutate('student_credit_refund_v1',body,refundKey);await mutate('student_credit_refund_v1',body,refundKey);
  await fail('student_credit_refund_v1',{...body,amount_minor:'1'},'INSUFFICIENT_STUDENT_CREDIT');
  assert.equal((await get(loserPreparation.id)).student_credit_available_minor,'0');
 });
 for(const paid of [0,400,1000])await t.test('prestart operator cancellation of preparation and manual registration: paid '+paid+' reverses remaining debt and credits exactly paid',async()=>{
  const e=await event(),p=await person(),a=await prepare(e,p);if(paid)await collect(p,a.debt_id,paid);
  const pv=await preview(e);assert.deepEqual(pv.blockers,[]);
  assert.equal(pv.effects.find(x=>x.reason==='remaining_debt_removed').amount_minor,String(1000-paid));
  assert.equal(pv.effects.find(x=>x.reason==='student_credit_added').amount_minor,String(paid));
  const k=key();await apply(pv,k);assert.equal((await apply(pv,k)).replayed,true);
  const state=await get(a.id);assert.equal(state.state,'event_cancelled');assert.equal(state.remaining_minor,'0');assert.equal(state.student_credit_available_minor,String(paid));
  assert.equal(await count("select count(*)::int n from core.cash_movements where org_id=$1 and person_id=$2 and kind='refund'",[org,p]),0);
  const manualEvent=await event({terms:{...terms,full_payment_required:false}}),manualPerson=await person();
  const registration=await mutate('event_register_v1',{event_id:manualEvent,person_id:manualPerson}),manualDebt=await debtForRegistration(registration.primary_id);
  if(paid)await collect(manualPerson,manualDebt.id,paid);
  const manualPreview=await preview(manualEvent);
  assert.equal(manualPreview.effects.find(x=>x.reason==='remaining_debt_removed').amount_minor,String(1000-paid));
  assert.equal(manualPreview.effects.find(x=>x.reason==='student_credit_added').amount_minor,String(paid));
  await apply(manualPreview);
  assert.equal((await db.query('select private.debt_remaining($1,$2) n',[org,manualDebt.id])).rows[0].n,'0');
  assert.equal((await db.query('select private.student_credit_available($1,$2,$3,$4) n',[org,center,manualPerson,'TRY'])).rows[0].n,String(paid));
 });
 await t.test('previous discount, generated credit and explicit cash refund are deducted once for a registered manual attendee',async()=>{
  const e=await event({terms:{...terms,full_payment_required:false}}),p=await person(),r=await mutate('event_register_v1',{event_id:e,person_id:p}),d=await debtForRegistration(r.primary_id);
  await collect(p,d.id,1000);
  await mutate('debt_adjust_v1',{debt_id:d.id,amount_minor:'200',direction:'decrease',reason:'prior discount'});
  await mutate('student_credit_refund_v1',{person_id:p,amount_minor:'200',currency:'TRY',occurred_at:new Date().toISOString(),reason:'prior explicit refund'});
  const pv=await preview(e);assert.equal(pv.effects.find(x=>x.reason==='student_credit_added').amount_minor,'800');
  const k=key();await apply(pv,k);await apply(pv,k);
  await fail('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}},'PREVIEW_STALE');
  assert.equal((await db.query('select private.student_credit_available($1,$2,$3,$4) n',[org,center,p,'TRY'])).rows[0].n,'800');
  assert.equal((await db.query('select sum(amount_minor)::text n from core.student_credit_movements where org_id=$1 and source_debt_id=$2 and kind=$3',[org,d.id,'refund_claim_add'])).rows[0].n,'1000');
  await fail('debt_adjust_v1',{debt_id:d.id,amount_minor:'1',direction:'increase',reason:'must not reopen'},'INVALID_STATE_TRANSITION');
 });
 await t.test('financial changes invalidate cancellation and registration previews',async()=>{
  const e=await event(),p=await person(),a=await prepare(e,p),pv=await preview(e);
  await collect(p,a.debt_id,400);await fail('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}},'PREVIEW_STALE');
  const registrationPreview=await must(owner,'event_registration_preview_v1',scoped({event_id:e,person_id:p,preparation_id:a.id}));
  await collect(p,a.debt_id,600);
  await fail('event_register_v1',{event_id:e,person_id:p,preparation_id:a.id,preview:{id:registrationPreview.id,token:registrationPreview.token}},'PREVIEW_STALE');
  assert.equal((await register(e,p,a.id)).outcome,'registered');
 });
 await t.test('late failure rolls back a paid capacity closure; retry commits its financial resolution exactly once',async()=>{
  const e=await event({capacity:{nominal:1,maximum:1}}),people=[await person(),await person()],a=await prepare(e,people[0]),b=await prepare(e,people[1]);
  await collect(people[0],a.debt_id,1000);await collect(people[1],b.debt_id,1000);await register(e,people[0],a.id);
  await rejectAudit('event_register_v1',b.id);const k=key();
  await fail('event_register_v1',{event_id:e,person_id:people[1],preparation_id:b.id},'INTEGRITY_VIOLATION',k);
  assert.equal((await get(b.id)).state,'prepared');assert.equal((await get(b.id)).credited_minor,'0');assert.equal(await receiptCount(k),0);
  assert.equal(await count('select count(*)::int n from core.debt_adjustments where org_id=$1 and debt_id=$2',[org,b.debt_id]),0);
  await removeTrigger();const r=await register(e,people[1],b.id,k);assert.equal(r.outcome,'capacity_closed');assert.equal(r.student_credit_added_minor,'1000');assert.equal((await register(e,people[1],b.id,k)).replayed,true);
 });
 await t.test('late cancellation failure rolls back debt, credit, preparation, preview and receipt together',async()=>{
  const e=await event(),p=await person(),a=await prepare(e,p);await collect(p,a.debt_id,400);const pv=await preview(e),k=key();await rejectAudit('event_cancel_apply_v1',e);
  await fail('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}},'INTEGRITY_VIOLATION',k);
  const state=await get(a.id);assert.equal(state.state,'prepared');assert.equal(state.remaining_minor,'600');assert.equal(state.credited_minor,'0');assert.equal(await receiptCount(k),0);
  assert.equal((await db.query('select state from core.previews where id=$1',[pv.id])).rows[0].state,'current');
  await removeTrigger();await apply(pv,k);assert.equal((await get(a.id)).student_credit_available_minor,'400');
 });
 await t.test('tenant/person/center mismatches cannot use preparation, collection, refund or cancel authority',async()=>{
  const e=await event(),p=await person(),a=await prepare(e,p),other=await person();
  await fail('event_register_v1',{event_id:e,person_id:other,preparation_id:a.id},'NOT_FOUND');
  await fail('event_register_v1',{event_id:e,person_id:p,preparation_id:a.id,sale_id:key()},'VALIDATION_FAILED');
  await fail('collection_record_v1',{person_id:other,debt_ids:[a.debt_id],amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()},'NOT_FOUND');
  await fail('event_payment_get_v1',{preparation_id:a.id},'NOT_FOUND',key(),outsider);
  const otherCenter=(await must(owner,'center_create_v1',{org_id:org,name:'Other center',timezone:'Europe/Istanbul'},key())).primary_id;
  await fail('event_payment_get_v1',{preparation_id:a.id,center_id:otherCenter},'NOT_FOUND');
  await fail('student_credit_refund_v1',{person_id:p,center_id:otherCenter,amount_minor:'1',currency:'TRY',occurred_at:new Date().toISOString(),reason:'wrong center'},'FORBIDDEN');
  await mutate('center_manager_assign_v1',{person_id:ownerPerson,center_id:otherCenter});
  await fail('event_register_v1',{event_id:e,person_id:p,preparation_id:a.id,center_id:otherCenter},'NOT_FOUND');
  await fail('student_credit_refund_v1',{person_id:p,center_id:otherCenter,amount_minor:'1',currency:'TRY',occurred_at:new Date().toISOString(),reason:'no cross-center credit'},'INSUFFICIENT_STUDENT_CREDIT');
  const foreignAccount=await must(outsider,'account_get_v1');
  const foreignOrg=(await must(platform,'organization_create_v1',{verified_account_id:foreignAccount.id,name:'Foreign Q-E01',initial_plan_id:plan},key())).primary_id;
  const foreignCenter=(await must(outsider,'center_create_v1',{org_id:foreignOrg,name:'Foreign',timezone:'Europe/Istanbul'},key())).primary_id;
  const foreignPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[foreignOrg])).rows[0].owner_person_id;
  await must(outsider,'center_manager_assign_v1',{org_id:foreignOrg,center_id:foreignCenter,person_id:foreignPerson},key());
  const payment=await must(outsider,'saas_payment_submit_v1',{org_id:foreignOrg,center_id:foreignCenter,amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC TENANT',occurred_at:new Date().toISOString()},key());
  await must(platform,'saas_payment_verify_v1',{org_id:foreignOrg,center_id:foreignCenter,payment_id:payment.primary_id,accepted:true},key());
  await fail('event_payment_get_v1',{org_id:foreignOrg,center_id:foreignCenter,preparation_id:a.id},'NOT_FOUND',key(),outsider);
  await fail('collection_record_v1',{org_id:foreignOrg,center_id:foreignCenter,person_id:foreignPerson,debt_ids:[a.debt_id],amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()},'NOT_FOUND',key(),outsider);
  await fail('event_cancel_preview_v1',{org_id:foreignOrg,center_id:foreignCenter,event_id:e,reason:'cross tenant'},'NOT_FOUND',key(),outsider);
  assert.equal((await get(a.id)).paid_minor,'0');
 });

 await t.test('discounted preparation uses its current debt and the remaining linked payment, not a client paid flag',async()=>{
  const e=await event(),p=await person(),a=await prepare(e,p);
  await collect(p,a.debt_id,400);await mutate('debt_adjust_v1',{debt_id:a.debt_id,amount_minor:'600',direction:'decrease',reason:'explicit authorized discount'});
  const r=await register(e,p,a.id);assert.equal(r.outcome,'registered');
  const pv=await preview(e);assert.equal(pv.effects.find(x=>x.reason==='student_credit_added').amount_minor,'400');await apply(pv);
  assert.equal((await get(a.id)).student_credit_available_minor,'400');
 });
 await t.test('same-key concurrent prepared registrations return one registration and never create a second debt',async()=>{
  const e=await event(),p=await person(),a=await prepare(e,p),k=key();await collect(p,a.debt_id,1000);
  const rs=await Promise.all([register(e,p,a.id,k),register(e,p,a.id,k)]);
  assert(rs.every(r=>r.outcome==='registered'));assert.equal(rs[0].primary_id,rs[1].primary_id);assert.equal(rs.filter(r=>r.replayed).length,1);
  assert.equal(await count('select count(*)::int n from core.debts where org_id=$1 and person_id=$2',[org,p]),1);
 });
 await t.test('late collection failure leaves no cash/allocation/receipt; same-key retry records one linked payment',async()=>{
  const e=await event(),p=await person(),a=await prepare(e,p),k=key();
  await rejectAudit('collection_record_v1',null);
  await fail('collection_record_v1',{person_id:p,debt_ids:[a.debt_id],amount_minor:'400',currency:'TRY',occurred_at:'2026-10-16T00:00:00Z'},'INTEGRITY_VIOLATION',k);
  assert.equal((await get(a.id)).paid_minor,'0');assert.equal(await receiptCount(k),0);
  assert.equal(await count('select count(*)::int n from core.cash_movements where org_id=$1 and person_id=$2',[org,p]),0);
  assert.equal(await count('select count(*)::int n from core.debt_allocations where org_id=$1 and debt_id=$2',[org,a.debt_id]),0);
  await removeTrigger();
  const body={person_id:p,debt_ids:[a.debt_id],amount_minor:'400',currency:'TRY',occurred_at:'2026-10-16T00:00:00Z'};
  await mutate('collection_record_v1',body,k);await mutate('collection_record_v1',body,k);assert.equal((await get(a.id)).paid_minor,'400');
 });
 await t.test('live center-role revocation blocks collecting or converting a paid preparation with the old JWT',async()=>{
  const e=await event(),p=await person(),a=await prepare(e,p);await collect(p,a.debt_id,1000);
  await mutate('center_manager_revoke_v1',{person_id:ownerPerson,expected_version:1,reason:'Q-E01 authority revocation'});
  await fail('event_register_v1',{event_id:e,person_id:p,preparation_id:a.id},'FORBIDDEN');
  await fail('collection_record_v1',{person_id:p,debt_ids:[a.debt_id],amount_minor:'1',currency:'TRY',occurred_at:new Date().toISOString()},'FORBIDDEN');
  await mutate('center_manager_assign_v1',{person_id:ownerPerson});assert.equal((await get(a.id)).state,'prepared');
 });
 await t.test('past planned time does not block operator cancellation and is not proof of actual start',async()=>{
  const at=Date.now()-3600000,e=await event({interval:{starts_at:new Date(at).toISOString(),ends_at:new Date(at+7200000).toISOString()}});
  const pv=await preview(e);assert.deepEqual(pv.blockers,[]);await apply(pv);
  assert.equal((await must(owner,'event_get_v1',scoped({event_id:e}))).state,'cancelled');
 });
 }finally{await removeTrigger();await db.end();}
});


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
  await m('permission_set_v1',{person_id:staffPerson,permission:'finance.collect',expected_version:1,enabled:true});
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
  await m('sale_refund_apply_v1',pvref(refund),keys[attempts.findIndex(x=>x.result.ok)]);
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
