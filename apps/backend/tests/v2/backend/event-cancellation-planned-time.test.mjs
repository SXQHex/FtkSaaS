import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call} from '../../api-client.mjs';
import {connect} from '../../../scripts/db.mjs';
import {newUuidV7 as key} from '../../../scripts/uuid.mjs';

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

 }finally{await removeTrigger();await db.end();}
});
