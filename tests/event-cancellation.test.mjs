import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Q-E02 real Auth/API center and participant cancellation acceptance',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('qe02-owner'),outsider=await authUser('qe02-outsider');
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
 async function event(extra={},publish=true){const at=Date.now()+86400000+(slot++)*7200000;const input={name:'Q-E01 event '+key(),interval:{starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()},timezone:'Europe/Istanbul',venue:{kind:'external',name:'Test',address:'Synthetic',timezone:'Europe/Istanbul'},capacity:{nominal:10,maximum:10},terms,discipline_ids:[],assignments:[{person_id:ownerPerson,duty:'instructor',fee_minor:'0',currency:'TRY'}],...extra};const id=(await mutate('event_save_v1',input)).primary_id;if(publish)await mutate('event_publish_v1',{event_id:id,published:true});return id;}
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


 const view=e=>must(owner,'event_get_v1',scoped({event_id:e}));
 const regView=async r=>(await db.query('select * from core.event_registrations where org_id=$1 and id=$2',[org,r])).rows[0];
 const balance=p=>must(owner,'entitlements_get_v1',scoped({person_id:p}));
 const claim=async p=>(await db.query("select private.student_credit_available($1,$2,$3,'TRY') n",[org,center,p])).rows[0].n;
 const eventState=async(e,state='occurred')=>{
  if(state==='occurred')await mutate('event_complete_v1',{event_id:e});
 };
 let historicalSlot=0,futureSlot=0;
 const past=()=>{const at=Date.now()-30*86400000+(historicalSlot++)*7200000;return {starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()};};
 const future=()=>{const at=Date.now()+30*86400000+(futureSlot++)*7200000;return {starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()};};
 async function manual(paid,{occurred=false,prior=false,interval=null}={}){
  const e=await event({interval:interval??(prior||occurred?past():future()),terms:{...terms,full_payment_required:false}});
  const p=await person(),r=await mutate('event_register_v1',{event_id:e,person_id:p}),d=await debtForRegistration(r.primary_id);
  if(paid)await collect(p,d.id,paid);
  if(occurred)await eventState(e);
  return {e,p,r:r.primary_id,d};
 }
 for(const stage of ['future','past_planned','occurred'])for(const paid of [0,400,1000])await t.test(stage+' center cancellation fully removes obligation; paid '+paid,async()=>{
  const x=await manual(paid,{occurred:stage==='occurred',prior:stage==='past_planned'});
  const other=await prepare(await event(),x.p),otherBefore=await get(other.id);
  const pv=await preview(x.e);assert.deepEqual(pv.blockers,[]);
  const k=key(),r=await apply(pv,k);assert.equal(r.primary_id,x.e);assert.equal((await apply(pv,k)).replayed,true);
  assert.equal((await view(x.e)).state,'cancelled');assert.equal((await regView(x.r)).state,'cancelled');
  assert.equal((await db.query('select private.debt_net($1,$2) n',[org,x.d.id])).rows[0].n,'0');
  assert.equal((await db.query('select private.debt_remaining($1,$2) n',[org,x.d.id])).rows[0].n,'0');
  assert.equal(await claim(x.p),String(paid));assert.deepEqual(await get(other.id),{...otherBefore,student_credit_available_minor:String(paid)});
  assert.equal(await count("select count(*)::int n from core.cash_movements where org_id=$1 and person_id=$2 and kind='refund'",[org,x.p]),0);
 });
 for(const paid of [0,400,1000])await t.test('participant cancellation preserves fee obligation and payments '+paid,async()=>{
  const x=await manual(paid,{prior:true}),k=key();
  const b={registration_id:x.r,expected_version:1,reason:'participant leaves'};
  await mutate('event_registration_cancel_v1',b,k);assert.equal((await mutate('event_registration_cancel_v1',b,k)).replayed,true);
  assert.equal((await db.query('select private.debt_net($1,$2) n',[org,x.d.id])).rows[0].n,'1000');
  assert.equal((await db.query('select private.debt_remaining($1,$2) n',[org,x.d.id])).rows[0].n,String(1000-paid));
  assert.equal(await claim(x.p),'0');
  assert.equal(await count('select count(*)::int n from core.debt_adjustments where org_id=$1 and debt_id=$2',[org,x.d.id]),0);
  // A later center cancellation must also settle this already canceled participant's event debt.
  await eventState(x.e);await apply(await preview(x.e));assert.equal(await claim(x.p),String(paid));
 });
 let product;
 async function packageRegistration(mode,{before='release',after='consume',manualPaid=null,timed=false,prior=false}={}){
  if(!product)product=(await mutate('product_publish_v1',{terms:{name:'Q-E02 shared credit',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson','event']}]}})).primary_id;
  const selectedProduct=timed?(await mutate('product_publish_v1',{terms:{name:'Q-E02 weekly',kind:'timed',booking_mode:'flexible',credits:null,quota:{period:'week',limit:1},price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson','event']}]}})).primary_id:product;
  const p=await person(),pv=await must(owner,'sale_preview_v1',scoped({person_id:p,product_version_id:selectedProduct,start_date:'2026-01-01',end_date:'2027-01-01'}));
  const sale=(await mutate('sale_apply_v1',{preview:{id:pv.id,token:pv.token}})).primary_id;
  const e=await event({interval:mode==='reserved'&&!prior?future():past(),
   terms:{...terms,fee_minor:'1000',full_payment_required:false,allowed_product_version_ids:[selectedProduct],cancellation:{before_cutoff:before,after_cutoff:after,no_show:'consume'}}});
  const r=(await mutate('event_register_v1',{event_id:e,person_id:p,sale_id:sale})).primary_id;
  let manual=null;
  if(manualPaid!==null){
   const mp=await person(),mr=(await mutate('event_register_v1',{event_id:e,person_id:mp})).primary_id,md=await debtForRegistration(mr);
   if(manualPaid)await collect(mp,md.id,manualPaid);
   manual={e,p:mp,r:mr,d:md};
   if(mode==='consumed')await mutate('event_attendance_mark_v1',{registration_id:mr,expected_version:1,result:'attended'});
  }
  if(mode==='consumed'){
   await mutate('event_attendance_mark_v1',{registration_id:r,expected_version:1,result:'attended'});
   await mutate('event_attendance_close_v1',{event_id:e,expected_version:(await view(e)).version});
   await eventState(e);
  }else if(mode==='participant_consumed'||mode==='participant_released'){
   await mutate('event_registration_cancel_v1',{registration_id:r,expected_version:1,reason:'participant cancellation'});
  }
  return {p,sale,e,r,manual};
 }
 for(const mode of ['reserved','consumed','participant_consumed','participant_released'])await t.test('center returns full package right once: '+mode,async()=>{
  const x=await packageRegistration(mode,{after:mode==='participant_released'?'release':'consume'});
  const saleDebt=(await db.query('select * from core.debts where org_id=$1 and sale_id=$2',[org,x.sale])).rows[0];
  const before=(await balance(x.p)).find(y=>y.sale_id===x.sale);
  assert.equal(before.available,mode==='participant_released'?1:0);
  const oldReg=await regView(x.r);const pv=await preview(x.e);assert.deepEqual(pv.blockers,[]);
  if(mode==='consumed'||mode==='participant_consumed')assert(pv.effects.some(y=>y.action==='reverse'&&y.quantity===1));
  const k=key();await apply(pv,k);await apply(pv,k);
  const b=(await balance(x.p)).find(y=>y.sale_id===x.sale);assert.equal(b.available,1);assert.equal(b.reserved,0);assert.equal(b.consumed,0);
  assert.equal(await claim(x.p),'0');
  assert.deepEqual((await db.query('select * from core.debts where org_id=$1 and id=$2',[org,saleDebt.id])).rows[0],saleDebt);
  const history=(await db.query('select * from core.entitlement_movements where org_id=$1 and event_registration_id=$2 order by created_at,id',[org,x.r])).rows;
  assert.equal(history.filter(y=>y.kind==='reverse').length,['consumed','participant_consumed'].includes(mode)?1:0);
  for(const m of history.filter(y=>y.kind==='reverse'))assert(history.some(y=>y.id===m.previous_id&&y.kind==='consume'));
  assert.equal((await regView(x.r)).attendance_result,oldReg.attendance_result);
  if(mode==='consumed'){
   await fail('event_attendance_correct_v1',{registration_id:x.r,expected_version:Number((await regView(x.r)).version),result:'attended',reason:'must not reconsume'},'INVALID_STATE_TRANSITION');
   await fail('event_attendance_close_v1',{event_id:x.e,expected_version:(await view(x.e)).version},'INVALID_STATE_TRANSITION');
  }
 });
 await t.test('participant package cancellation keeps the accepted cutoff terms and creates no monetary credit',async()=>{
  const consumed=await packageRegistration('participant_consumed'),released=await packageRegistration('participant_released',{after:'release'});
  assert.equal((await balance(consumed.p)).find(y=>y.sale_id===consumed.sale).consumed,1);
  assert.equal((await balance(released.p)).find(y=>y.sale_id===released.sale).available,1);
  assert.equal(await claim(consumed.p),'0');assert.equal(await claim(released.p),'0');
 });
 // Q-E03 uses a pure boundary classifier plus real API paths with server timestamps.
 const monetaryJournal=async p=>({
  cash:(await db.query('select * from core.cash_movements where org_id=$1 and person_id=$2 order by id',[org,p])).rows,
  debts:(await db.query('select * from core.debts where org_id=$1 and person_id=$2 order by id',[org,p])).rows,
  adjustments:(await db.query('select a.* from core.debt_adjustments a join core.debts d on d.org_id=a.org_id and d.id=a.debt_id where d.org_id=$1 and d.person_id=$2 order by a.id',[org,p])).rows,
  credits:(await db.query('select * from core.student_credit_movements where org_id=$1 and person_id=$2 order by id',[org,p])).rows
 });
 const basis=async r=>(await regView(r)).participant_cancellation;
 await t.test('Q-E03 exact planned boundary: before, equality, after and 21:00 / 21:15 / delayed 21:30',async()=>{
  const planned='2026-10-15T21:00:00+03:00';
  for(const [at,want] of [['2026-10-15T20:59:59.999999+03:00','before_planned_start'],[planned,'at_or_after_planned_start'],['2026-10-15T21:15:00+03:00','at_or_after_planned_start']]){
   assert.equal((await db.query('select private.participant_cancel_phase($1,$2) phase',[planned,at])).rows[0].phase,want);
  }
  // Actual start at 21:30 is deliberately not a classifier input.
 });
 for(const prior of [false,true])for(const paid of [0,400,1000])await t.test('Q-E03 API captures planned monetary phase, existing refund=none journals preserved: '+(prior?'after':'before')+' paid '+paid,async()=>{
  const x=await manual(paid,{prior}),before=await monetaryJournal(x.p),k=key();
  if(prior){const v=await view(x.e);assert.equal(v.state,'published');assert.equal(v.attendance_state,'open');assert.equal((await regView(x.r)).attendance_result,'unmarked');}
  const body={registration_id:x.r,expected_version:1,reason:'Q-E03 participant cancellation'};
  await mutate('event_registration_cancel_v1',body,k);
  const evidence=await basis(x.r);assert.equal(evidence.phase,prior?'at_or_after_planned_start':'before_planned_start');
  assert.equal(evidence.rule,'planned_start_v1');assert.equal(new Date(evidence.planned_starts_at).toISOString(),new Date((await view(x.e)).interval.starts_at).toISOString());
  assert.equal(new Date(evidence.cancelled_at)>=new Date(evidence.planned_starts_at),prior);
  assert.deepEqual((await view(x.e)).registrations.find(r=>r.id===x.r).participant_cancellation,evidence);
  assert.deepEqual(await monetaryJournal(x.p),before);
  await mutate('event_registration_cancel_v1',body,k);assert.deepEqual(await basis(x.r),evidence);assert.equal(await receiptCount(k),1);
  if(prior){
   // Delayed recording of occurrence cannot reclassify/reprice the completed cancellation.
   await eventState(x.e);assert.deepEqual(await basis(x.r),evidence);assert.deepEqual(await monetaryJournal(x.p),before);
  }
 });
 await t.test('Q-E03 no wall-clock auto occurrence/attendance/rights/earnings; package cutoff stays independent',async()=>{
  const x=await packageRegistration('reserved',{before:'consume',after:'release'});
  const v=await view(x.e);assert.equal(v.state,'published');assert.equal(v.attendance_state,'open');
  const k=key();await mutate('event_registration_cancel_v1',{registration_id:x.r,expected_version:1,reason:'existing package rule'},k);
  // This before-start cancellation consumes only because its accepted package terms say so.
  assert.equal((await basis(x.r)).phase,'before_planned_start');assert.equal((await balance(x.p)).find(z=>z.sale_id===x.sale).consumed,1);
  assert.equal((await view(x.e)).state,'published');assert.equal(await claim(x.p),'0');
  assert.equal(await count('select count(*)::int n from core.earnings where org_id=$1 and event_assignment_id in (select id from core.event_assignments where org_id=$1 and event_id=$2)',[org,x.e]),0);
  await apply(await preview(x.e));assert.equal((await balance(x.p)).find(z=>z.sale_id===x.sale).available,1);
 });
 await t.test('Q-E03 passed planned time alone keeps package reserved and earnings absent; after-cutoff release remains accepted',async()=>{
  const x=await packageRegistration('reserved',{prior:true,after:'release'}),v=await view(x.e);
  assert.equal(v.state,'published');assert.equal(v.attendance_state,'open');assert.equal((await regView(x.r)).attendance_result,'unmarked');
  assert.equal((await balance(x.p)).find(z=>z.sale_id===x.sale).reserved,1);
  assert.equal(await count('select count(*)::int n from core.earnings where org_id=$1 and event_assignment_id in (select id from core.event_assignments where org_id=$1 and event_id=$2)',[org,x.e]),0);
  await mutate('event_registration_cancel_v1',{registration_id:x.r,expected_version:1,reason:'accepted release after cutoff'});
  assert.equal((await basis(x.r)).phase,'at_or_after_planned_start');assert.equal((await balance(x.p)).find(z=>z.sale_id===x.sale).available,1);
 });
 await t.test('Q-E03 next-day center cancellation is atomic, returns payment once and preserves participant decision evidence',async()=>{
  const at=Date.now()-86400000,interval={starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()};
  const x=await manual(400,{interval}),body={registration_id:x.r,expected_version:1,reason:'left after planned start'};
  await mutate('event_registration_cancel_v1',body);const evidence=await basis(x.r),pv=await preview(x.e),k=key();
  await rejectAudit('event_cancel_apply_v1',x.e);
  await fail('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}},'INTEGRITY_VIOLATION',k);
  assert.deepEqual(await basis(x.r),evidence);assert.equal(await claim(x.p),'0');assert.equal(await receiptCount(k),0);
  assert.equal((await db.query('select private.debt_remaining($1,$2)::text n',[org,x.d.id])).rows[0].n,'600');
  await removeTrigger();await apply(pv,k);await apply(pv,k);
  assert.equal(await claim(x.p),'400');assert.deepEqual(await basis(x.r),evidence);
  assert.equal((await db.query('select private.debt_remaining($1,$2)::text n',[org,x.d.id])).rows[0].n,'0');
  assert.equal(await count("select count(*)::int n from core.cash_movements where org_id=$1 and person_id=$2 and kind='refund'",[org,x.p]),0);
 });
 await t.test('Q-E03 late participant failure rolls back phase, package right, journals and receipt; retry is atomic',async()=>{
  const x=await packageRegistration('reserved',{before:'consume'}),before=await monetaryJournal(x.p),regBefore=await regView(x.r),k=key();
  const body={registration_id:x.r,expected_version:1,reason:'Q-E03 rollback'};
  await rejectAudit('event_registration_cancel_v1',x.r);
  await fail('event_registration_cancel_v1',body,'INTEGRITY_VIOLATION',k);
  assert.deepEqual(await regView(x.r),regBefore);assert.equal(await basis(x.r),null);assert.equal(await receiptCount(k),0);
  assert.equal((await balance(x.p)).find(z=>z.sale_id===x.sale).reserved,1);assert.deepEqual(await monetaryJournal(x.p),before);
  await removeTrigger();await mutate('event_registration_cancel_v1',body,k);const evidence=await basis(x.r);
  assert.equal(evidence.phase,'before_planned_start');assert.equal((await balance(x.p)).find(z=>z.sale_id===x.sale).consumed,1);
  await mutate('event_registration_cancel_v1',body,k);assert.deepEqual(await basis(x.r),evidence);assert.deepEqual(await monetaryJournal(x.p),before);
  await assert.rejects(db.query("update core.event_registrations set participant_cancellation=jsonb_set(participant_cancellation,'{phase}','\"at_or_after_planned_start\"'::jsonb) where id=$1",[x.r]),e=>e.message==='INTEGRITY_VIOLATION');
 });
 await t.test('Q-E03 API queued across planned/package cutoff uses one post-lock decision time',async()=>{
  const x=await packageRegistration('reserved',{before:'consume',after:'release'}),locker=await connect(),k=key();
  let pending;
  try{
   // Synthetic fixture clock, not a client-visible time override. Hold the real shared gate.
   const planned=(await db.query("update core.events set starts_at=clock_timestamp()+interval '8 seconds',ends_at=clock_timestamp()+interval '1 hour',version=version+1 where id=$1 returning starts_at",[x.e])).rows[0].starts_at;
   await locker.query('begin');const pid=(await locker.query('select pg_backend_pid() pid')).rows[0].pid;
   await locker.query('select id from core.organizations where id=$1 for update',[org]);
   const body={registration_id:x.r,expected_version:1,reason:'queued across cutoff'};
   pending=call(owner,'event_registration_cancel_v1',scoped(body),k);
   const deadline=Date.now()+15000;let waited=false;
   while(Date.now()<deadline){
    const blocked=(await db.query("select xact_start < $2::timestamptz before_cutoff from pg_stat_activity where $1=any(pg_blocking_pids(pid)) and query like '%event_registration_cancel_v1%'",[pid,planned])).rows;
    if(blocked.length){assert.equal(blocked[0].before_cutoff,true);waited=true;break;}
    await new Promise(resolve=>setTimeout(resolve,25));
   }
   assert(waited,'must observe the real API transaction waiting on the organization lock before cutoff');
   while(!(await db.query('select clock_timestamp()>$1::timestamptz passed',[planned])).rows[0].passed){
    assert(Date.now()<deadline,'bounded cutoff wait');await new Promise(resolve=>setTimeout(resolve,25));
   }
   await locker.query('commit');
   const response=await pending;assert.equal(response.result.ok,true,JSON.stringify(response.result));
   const evidence=await basis(x.r);assert.equal(evidence.phase,'at_or_after_planned_start');
   assert(new Date(evidence.cancelled_at)>=new Date(evidence.planned_starts_at));
   const right=(await balance(x.p)).find(z=>z.sale_id===x.sale);assert.equal(right.available,1);assert.equal(right.consumed,0);assert.equal(right.reserved,0);
   assert.equal(await claim(x.p),'0');await mutate('event_registration_cancel_v1',body,k);assert.deepEqual(await basis(x.r),evidence);
  }finally{
   await locker.query('rollback');await locker.end();if(pending)await pending;
  }
 });
 await t.test('Q-E03 client cannot forge cancel time, planned boundary or actual-start classification',async()=>{
  const x=await manual(400,{prior:true});
  for(const extra of [{cancelled_at:'2020-01-01T00:00:00Z'},{actual_starts_at:'2099-01-01T00:00:00Z'},{participant_cancellation:{phase:'before_planned_start'}}]){
   await fail('event_registration_cancel_v1',{registration_id:x.r,expected_version:1,reason:'forged time',...extra},'VALIDATION_FAILED');
  }
  assert.equal(await basis(x.r),null);assert.equal((await regView(x.r)).state,'active');
 });
 // Actual-start evidence has its own versioned writes; it never reprices participation.
 const actualRecord=(e,at,k=key(),version=null)=>mutate('event_actual_start_record_v1',{event_id:e,expected_version:version??1,actual_started_at:at,reason:'observed actual start'},k);
 const actualCorrect=(e,version,at,k=key())=>mutate('event_actual_start_correct_v1',{event_id:e,expected_version:version,actual_started_at:at,reason:'correct observed time'},k);
 const actualHistory=e=>count("select count(*)::int n from core.audit_events where org_id=$1 and subject_id=$2 and action in ('event_actual_start_record_v1','event_actual_start_correct_v1')",[org,e]);
 await t.test('actual-start record/correct/clear appends typed audit history, versions and replay without changing event state',async()=>{
  const x=await manual(400,{prior:true}),v=await view(x.e),before=await monetaryJournal(x.p),at=new Date(Date.now()-60000).toISOString(),k=key();
  const r=await actualRecord(x.e,at,k,v.version);assert.equal(r.version,v.version+1);
  const after=await view(x.e);assert.equal(new Date(after.actual_started_at).toISOString(),at);assert.equal(after.state,'published');assert.equal(after.attendance_state,'open');
  assert.equal(after.actual_start_history.length,1);assert.equal(after.actual_start_history[0].diff.changes[0].field,'actual_started_at');assert.equal(after.actual_start_history[0].diff.changes[0].old_value,null);
  assert.equal((await actualRecord(x.e,at,k,v.version)).replayed,true);assert.equal(await actualHistory(x.e),1);
  await fail('event_actual_start_record_v1',{event_id:x.e,expected_version:after.version,actual_started_at:at,reason:'second initial'},'INVALID_STATE_TRANSITION');
  await actualCorrect(x.e,after.version,new Date(Date.now()-30000).toISOString());
  await actualCorrect(x.e,(await view(x.e)).version,null);const cleared=await view(x.e);assert.equal(cleared.actual_started_at,null);assert.equal(cleared.actual_start_history.length,3);
  await actualCorrect(x.e,cleared.version,at);assert.equal(await actualHistory(x.e),4);assert.deepEqual(await monetaryJournal(x.p),before);
  const audit=cleared.actual_start_history[0];await assert.rejects(db.query('update core.audit_events set reason=$1 where id=$2',['rewrite',audit.id]),e=>e.code==='P0001');
 });
 await t.test('actual-start rejects future time, empty reason, correction without record, stale version and draft without writes',async()=>{
  const x=await manual(0,{prior:true}),v=await view(x.e),at=new Date(Date.now()-60000).toISOString();
  await fail('event_actual_start_record_v1',{event_id:x.e,expected_version:v.version,actual_started_at:new Date(Date.now()+3600000).toISOString(),reason:'future'},'VALIDATION_FAILED');
  await fail('event_actual_start_record_v1',{event_id:x.e,expected_version:v.version,actual_started_at:at,reason:'   '},'VALIDATION_FAILED');
  await fail('event_actual_start_correct_v1',{event_id:x.e,expected_version:v.version,actual_started_at:at,reason:'no first record'},'INVALID_STATE_TRANSITION');
  await fail('event_actual_start_record_v1',{event_id:x.e,expected_version:v.version+1,actual_started_at:at,reason:'stale'},'VERSION_CONFLICT');
  assert.equal(await actualHistory(x.e),0);
  const draft=await event({},false);
  await fail('event_actual_start_record_v1',{event_id:draft,expected_version:(await view(draft)).version,actual_started_at:at,reason:'draft'},'INVALID_STATE_TRANSITION');
 });
 await t.test('actual start recorded after participant cancellation and later corrected never changes Q-E03 phase or finance',async()=>{
  const x=await manual(1000,{prior:true});await mutate('event_registration_cancel_v1',{registration_id:x.r,expected_version:1,reason:'left after planned start'});
  const evidence=await basis(x.r),before=await monetaryJournal(x.p);const actual=new Date().toISOString();
  assert(new Date(actual)>new Date(evidence.cancelled_at));await actualRecord(x.e,actual,key(),(await view(x.e)).version);
  await actualCorrect(x.e,(await view(x.e)).version,new Date(Date.now()-3600000).toISOString());
  assert.deepEqual(await basis(x.r),evidence);assert.equal(evidence.phase,'at_or_after_planned_start');assert.deepEqual(await monetaryJournal(x.p),before);
  assert.equal((await view(x.e)).state,'published');
 });
 await t.test('actual start backfill/correction after center cancellation preserves full Q-E02 settlement and returned rights',async()=>{
  const x=await packageRegistration('consumed',{manualPaid:400});await apply(await preview(x.e));
  const before=await monetaryJournal(x.manual.p),right=await balance(x.p),v=await view(x.e),at=new Date(Date.now()-86400000).toISOString();
  await actualRecord(x.e,at,key(),v.version);await actualCorrect(x.e,(await view(x.e)).version,null);
  assert.equal((await view(x.e)).state,'cancelled');assert.deepEqual(await monetaryJournal(x.manual.p),before);assert.deepEqual(await balance(x.p),right);assert.equal(await claim(x.manual.p),'400');
 });
 await t.test('actual-start late failure rolls back timestamp, version, audit, receipt and notification; same-key retry commits once',async()=>{
  const x=await manual(400,{prior:true}),v=await view(x.e),at=new Date(Date.now()-60000).toISOString(),k=key();
  const n=()=>count('select count(*)::int n from core.notifications where org_id=$1',[org]);const beforeN=await n();
  await rejectAudit('event_actual_start_record_v1',x.e);
  await fail('event_actual_start_record_v1',{event_id:x.e,expected_version:v.version,actual_started_at:at,reason:'observed actual start'},'INTEGRITY_VIOLATION',k);
  assert.equal((await view(x.e)).actual_started_at,null);assert.equal((await view(x.e)).version,v.version);assert.equal(await actualHistory(x.e),0);assert.equal(await receiptCount(k),0);assert.equal(await n(),beforeN);
  await removeTrigger();await actualRecord(x.e,at,k,v.version);await actualRecord(x.e,at,k,v.version);assert.equal(await actualHistory(x.e),1);
 });
 await t.test('actual-start concurrent first writes cannot overwrite; same key replays and changed payload rejects',async()=>{
  const x=await manual(0,{prior:true}),v=await view(x.e),at=new Date(Date.now()-60000).toISOString();
  const body={event_id:x.e,expected_version:v.version,actual_started_at:at,reason:'parallel'};
  const rs=await Promise.all([call(owner,'event_actual_start_record_v1',scoped(body),key()),call(owner,'event_actual_start_record_v1',scoped(body),key())]);
  assert.equal(rs.filter(r=>r.result.ok).length,1);assert.equal(rs.find(r=>!r.result.ok).result.error.code,'VERSION_CONFLICT');assert.equal(await actualHistory(x.e),1);
  const y=await manual(0,{prior:true}),yv=await view(y.e),k=key(),b={event_id:y.e,expected_version:yv.version,actual_started_at:at,reason:'same key'};
  const same=await Promise.all([mutate('event_actual_start_record_v1',b,k),mutate('event_actual_start_record_v1',b,k)]);assert.equal(same.filter(r=>r.replayed).length,1);
  await fail('event_actual_start_record_v1',{...b,reason:'different'},'IDEMPOTENCY_PAYLOAD_MISMATCH',k);assert.equal(await actualHistory(y.e),1);
 });
 await t.test('actual-start live CM revocation, tenant/center isolation and restricted history are enforced',async()=>{
  const x=await manual(0,{prior:true}),v=await view(x.e),at=new Date(Date.now()-60000).toISOString();
  await fail('event_actual_start_record_v1',{event_id:x.e,expected_version:v.version,actual_started_at:at,reason:'outsider'},'NOT_FOUND',key(),outsider);
  const otherCenter=(await mutate('center_create_v1',{name:'Other actual-start center',timezone:'Europe/Istanbul'})).primary_id;
  await mutate('center_manager_assign_v1',{center_id:otherCenter,person_id:ownerPerson});
  await fail('event_actual_start_record_v1',{center_id:otherCenter,event_id:x.e,expected_version:v.version,actual_started_at:at,reason:'wrong center'},'NOT_FOUND');
  await mutate('center_manager_revoke_v1',{person_id:ownerPerson,expected_version:1,reason:'revoke actual-start authority'});
  await fail('event_actual_start_record_v1',{event_id:x.e,expected_version:v.version,actual_started_at:at,reason:'revoked'},'FORBIDDEN');await mutate('center_manager_assign_v1',{person_id:ownerPerson});
  await actualRecord(x.e,at,key(),v.version);
  const student=await authUser('actual-start-student'),account=await must(student,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,x.p]);
  const sv=await must(student,'event_get_v1',scoped({event_id:x.e}));assert.equal('actual_start_history' in sv,false);assert.equal(new Date(sv.actual_started_at).toISOString(),at);
  await fail('event_actual_start_correct_v1',{event_id:x.e,expected_version:(await view(x.e)).version,actual_started_at:null,reason:'student correction'},'FORBIDDEN',key(),student);
 });
 await t.test('actual-start recording invalidates old center-cancel preview but fresh preview still settles unchanged',async()=>{
  const x=await manual(400,{prior:true}),pv=await preview(x.e),v=await view(x.e);
  await actualRecord(x.e,new Date(Date.now()-60000).toISOString(),key(),v.version);
  await fail('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}},'PREVIEW_STALE');await apply(await preview(x.e));assert.equal(await claim(x.p),'400');
 });
 await t.test('previous credit, explicit refund and offset are not recreated on occurred center cancellation',async()=>{
  const x=await manual(1000,{occurred:true});
  await mutate('debt_adjust_v1',{debt_id:x.d.id,amount_minor:'400',direction:'decrease',reason:'prior explicit reduction'});
  await mutate('student_credit_refund_v1',{person_id:x.p,amount_minor:'100',currency:'TRY',occurred_at:new Date().toISOString(),reason:'prior refund'});
  const other=await prepare(await event(),x.p),od=(await db.query('select * from core.debts where id=$1',[other.debt_id])).rows[0];
  await mutate('student_credit_offset_v1',{person_id:x.p,debt_id:od.id,expected_version:Number(od.version),amount_minor:'300',currency:'TRY'});
  const otherBefore=await get(other.id),pv=await preview(x.e);
  assert.equal(pv.effects.find(y=>y.reason==='student_credit_added').amount_minor,'600');
  await apply(pv);assert.equal(await claim(x.p),'600');assert.deepEqual(await get(other.id),{...otherBefore,student_credit_available_minor:'600'});
  assert.equal((await db.query("select sum(amount_minor)::text n from core.student_credit_movements where org_id=$1 and source_debt_id=$2 and kind='refund_claim_add'",[org,x.d.id])).rows[0].n,'1000');
  assert.equal(await count("select count(*)::int n from core.cash_movements where org_id=$1 and person_id=$2 and kind='refund'",[org,x.p]),1);
 });
 await t.test('concurrent distinct cancellation previews settle one time; concurrent same-key apply replays',async()=>{
  const x=await manual(1000,{occurred:true}),a=await preview(x.e),b=await preview(x.e);
  const rs=await Promise.all([call(owner,'event_cancel_apply_v1',scoped({preview:{id:a.id,token:a.token}}),key()),call(owner,'event_cancel_apply_v1',scoped({preview:{id:b.id,token:b.token}}),key())]);
  assert.equal(rs.filter(y=>y.result.ok).length,1);assert.equal(rs.find(y=>!y.result.ok).result.error.code,'PREVIEW_STALE');
  assert.equal(await claim(x.p),'1000');
  const y=await manual(400,{occurred:true}),pv=await preview(y.e),k=key(),same=await Promise.all([apply(pv,k),apply(pv,k)]);
  assert.equal(same.filter(z=>z.replayed).length,1);assert.equal(await claim(y.p),'400');assert.equal(await receiptCount(k),1);
 });
 // Both operations take the same org lock. Collection after cancellation is still a
 // real cash receipt: the existing surplus rule credits it without reopening debt.
 const collectionBody=x=>scoped({person_id:x.p,debt_ids:[x.d.id],amount_minor:'600',currency:'TRY',occurred_at:new Date().toISOString()});
 async function settledCollectionCancellation(x,body,ck,pv,ak,{paid,claimed,surplus}){
  assert.equal((await view(x.e)).state,'cancelled');
  const amounts=(await db.query(`select private.debt_net($1,$2)::text net,
   private.debt_remaining($1,$2)::text remaining,private.debt_paid($1,$2)::text paid,
   private.debt_claimed($1,$2)::text claimed`,[org,x.d.id])).rows[0];
  assert.deepEqual(amounts,{net:'0',remaining:'0',paid:String(paid),claimed:String(claimed)});
  assert.equal(await claim(x.p),'1000');
  const cash=(await db.query("select id,amount_minor::text amount from core.cash_movements where org_id=$1 and person_id=$2 and kind='collection' order by created_at,id",[org,x.p])).rows;
  assert.equal(cash.length,2);assert.equal(cash.reduce((sum,m)=>sum+BigInt(m.amount),0n),1000n);
  const laterCash=(await db.query("select c.id from core.cash_movements c join core.operation_receipts r on r.id=c.operation_id where c.org_id=$1 and r.key_hash=$2",[org,createHash('sha256').update(ck).digest('hex')])).rows[0].id;
  assert.equal((await db.query('select coalesce(sum(amount_minor),0)::text n from core.debt_allocations where org_id=$1 and cash_movement_id=$2',[org,laterCash])).rows[0].n,String(600-surplus));
  assert.equal((await db.query("select coalesce(sum(amount_minor),0)::text n from core.student_credit_movements where org_id=$1 and source_cash_id=$2 and kind='surplus_add'",[org,laterCash])).rows[0].n,String(surplus));
  assert.equal((await db.query("select coalesce(sum(amount_minor),0)::text n from core.student_credit_movements where org_id=$1 and person_id=$2 and kind='surplus_add'",[org,x.p])).rows[0].n,String(surplus));
  assert.equal(await count("select count(*)::int n from core.cash_movements where org_id=$1 and person_id=$2 and kind='refund'",[org,x.p]),0);
  assert.equal(await receiptCount(ck),1);assert.equal(await receiptCount(ak),1);
  const journal=async()=>({
   cash:(await db.query('select * from core.cash_movements where org_id=$1 and person_id=$2 order by id',[org,x.p])).rows,
   allocations:(await db.query('select * from core.debt_allocations where org_id=$1 and debt_id=$2 order by id',[org,x.d.id])).rows,
   credits:(await db.query('select * from core.student_credit_movements where org_id=$1 and person_id=$2 order by id',[org,x.p])).rows,
   adjustments:(await db.query('select * from core.debt_adjustments where org_id=$1 and debt_id=$2 order by id',[org,x.d.id])).rows
  });
  const before=await journal();
  assert.equal((await must(owner,'collection_record_v1',body,ck)).replayed,true);
  assert.equal((await apply(pv,ak)).replayed,true);
  assert.deepEqual(await journal(),before);assert.equal(await claim(x.p),'1000');
 }
 await t.test('cancellation before collection credits later cash as surplus without reopening event debt; retries write nothing',async()=>{
  const x=await manual(400,{occurred:true}),pv=await preview(x.e),ck=key(),ak=key(),body=collectionBody(x);
  await apply(pv,ak);assert.equal(await claim(x.p),'400');
  await must(owner,'collection_record_v1',body,ck);
  await settledCollectionCancellation(x,body,ck,pv,ak,{paid:400,claimed:400,surplus:600});
 });
 await t.test('collection before cancellation invalidates preview; failed apply leaves no receipt or adjustment',async()=>{
  const x=await manual(400,{occurred:true}),pv=await preview(x.e),ck=key(),ak=key(),body=collectionBody(x);
  await must(owner,'collection_record_v1',body,ck);
  await fail('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}},'PREVIEW_STALE',ak);
  assert.equal(await receiptCount(ak),0);assert.equal(await claim(x.p),'0');
  assert.equal(await count('select count(*)::int n from core.debt_adjustments where org_id=$1 and debt_id=$2',[org,x.d.id]),0);
  assert.equal((await view(x.e)).state,'occurred');
  const fresh=await preview(x.e);await apply(fresh,ak);
  await settledCollectionCancellation(x,body,ck,fresh,ak,{paid:1000,claimed:1000,surplus:0});
 });
 await t.test('collection racing cancellation conserves cash as linked claim or surplus; both serialized orders are valid',async()=>{
  const x=await manual(400,{occurred:true}),pv=await preview(x.e),ck=key(),ak=key(),body=collectionBody(x);
  const rs=await Promise.all([call(owner,'collection_record_v1',body,ck),call(owner,'event_cancel_apply_v1',scoped({preview:{id:pv.id,token:pv.token}}),ak)]);
  assert.equal(rs[0].result.ok,true,JSON.stringify(rs[0].result));
  let applied=pv;
  if(rs[1].result.ok){
   await settledCollectionCancellation(x,body,ck,applied,ak,{paid:400,claimed:400,surplus:600});
  }else{
   assert.equal(rs[1].result.error.code,'PREVIEW_STALE');assert.equal(await receiptCount(ak),0);assert.equal(await claim(x.p),'0');
   applied=await preview(x.e);await apply(applied,ak);
   await settledCollectionCancellation(x,body,ck,applied,ak,{paid:1000,claimed:1000,surplus:0});
  }
 });
 await t.test('late failure rolls back consumed rights, finance, operation, preview and notifications atomically',async()=>{
  const x=await packageRegistration('consumed',{manualPaid:400}),y=x.manual,before=await regView(x.r);
  const journals=async()=>({
   credits:await count('select count(*)::int n from core.student_credit_movements where org_id=$1',[org]),
   adjustments:await count('select count(*)::int n from core.debt_adjustments where org_id=$1',[org]),
   notifications:await count('select count(*)::int n from core.notifications where org_id=$1',[org]),
   outbox:await count('select count(*)::int n from core.outbox_jobs where org_id=$1',[org])
  });
  const journalBefore=await journals();
  const pv=await preview(x.e),k=key();await rejectAudit('event_cancel_apply_v1',x.e);
  await fail('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}},'INTEGRITY_VIOLATION',k);
  assert.equal((await balance(x.p)).find(z=>z.sale_id===x.sale).consumed,1);
  assert.deepEqual(await regView(x.r),before);assert.equal((await view(x.e)).state,'occurred');assert.equal(await receiptCount(k),0);
  assert.equal(await count("select count(*)::int n from core.entitlement_movements where org_id=$1 and event_registration_id=$2 and kind='reverse'",[org,x.r]),0);
  assert.equal((await db.query('select state from core.previews where id=$1',[pv.id])).rows[0].state,'current');
  assert.equal(await claim(y.p),'0');assert.equal((await db.query('select private.debt_remaining($1,$2) n',[org,y.d.id])).rows[0].n,'600');
  assert.deepEqual(await journals(),journalBefore);
  await removeTrigger();await apply(pv,k);assert.equal((await balance(x.p)).find(z=>z.sale_id===x.sale).available,1);
  assert.equal(await claim(y.p),'400');
  assert.equal((await db.query('select private.debt_remaining($1,$2) n',[org,y.d.id])).rows[0].n,'0');

 });
 await t.test('timed consumed quota returns completely by linked reversal',async()=>{
  const x=await packageRegistration('consumed',{timed:true});
  assert.equal(Number((await db.query('select consumed_count from core.quota_buckets where org_id=$1 and sale_id=$2',[org,x.sale])).rows[0].consumed_count),1);
  await apply(await preview(x.e));
  const q=(await db.query('select reserved_count,consumed_count from core.quota_buckets where org_id=$1 and sale_id=$2',[org,x.sale])).rows[0];
  assert.equal(Number(q.reserved_count),0);assert.equal(Number(q.consumed_count),0);
  assert.equal(await claim(x.p),'0');
 });
 await t.test('attendance correction invalidates cancellation preview before any return is written',async()=>{
  const x=await packageRegistration('consumed'),pv=await preview(x.e),r=await regView(x.r);
  await mutate('event_attendance_correct_v1',{registration_id:x.r,expected_version:Number(r.version),result:'no_show',reason:'historical accepted consume condition'});
  await fail('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}},'PREVIEW_STALE');
  assert.equal((await balance(x.p)).find(z=>z.sale_id===x.sale).consumed,1);await apply(await preview(x.e));
  assert.equal((await balance(x.p)).find(z=>z.sale_id===x.sale).available,1);
 });
 await t.test('live role revocation after preview denies settlement with old JWT; restored authority can apply',async()=>{
  const x=await manual(1000,{occurred:true}),pv=await preview(x.e),k=key();
  await mutate('center_manager_revoke_v1',{person_id:ownerPerson,expected_version:1,reason:'Q-E02 role revoked'});
  await fail('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}},'FORBIDDEN',k);
  assert.equal(await claim(x.p),'0');assert.equal(await receiptCount(k),0);
  await mutate('center_manager_assign_v1',{person_id:ownerPerson});await apply(pv,k);assert.equal(await claim(x.p),'1000');
 });
 await t.test('outsider cannot preview or apply another actors cancellation',async()=>{
  const x=await manual(1000,{occurred:true}),pv=await preview(x.e);
  await fail('event_cancel_preview_v1',{event_id:x.e,reason:'outsider'},'NOT_FOUND',key(),outsider);
  await fail('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}},'NOT_FOUND',key(),outsider);
  assert.equal(await claim(x.p),'0');assert.equal((await view(x.e)).state,'occurred');
 });

 }finally{await removeTrigger();await db.end();}
});
