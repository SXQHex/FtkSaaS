
import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
test('Cross-center settlement Auth -> Edge -> RPC',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('settlement-owner'),outside=await authUser('settlement-outsider');
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 try{
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Settlement synthetic',initial_plan_id:plan},key())).primary_id;
 const A=(await must(owner,'center_create_v1',{org_id:org,name:'A',timezone:'Europe/Istanbul'},key())).primary_id;
 const B=(await must(owner,'center_create_v1',{org_id:org,name:'B',timezone:'Europe/Istanbul'},key())).primary_id;
 const C=(await must(owner,'center_create_v1',{org_id:org,name:'C',timezone:'Europe/Istanbul'},key())).primary_id;
 const person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 const body=(b={},c=A)=>({org_id:org,...(c===null?{}:{center_id:c}),...b});
 const mut=(op,b={},c=A,u=owner,k=key())=>must(u,op,body(b,c),k);
 const read=(op,b={},c=A,u=owner)=>must(u,op,body(b,c));
 const fail=async(op,b,code,c=A,u=owner,k=key())=>{const x=await call(u,op,body(b,c),k);assert.equal(x.result.ok,false,JSON.stringify(x.result));assert.equal(x.result.error.code,code,JSON.stringify(x.result));return x;};
 for(const center of [A,B,C])await mut('center_manager_assign_v1',{person_id:person},center);
 const payment=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic',occurred_at:new Date().toISOString()});
 await mut('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},A,platform);
 const D=(await must(owner,'discipline_save_v1',{org_id:org,name:'Settlement discipline',state:'active'},key())).primary_id;
 for(const c of [A,B,C])await mut('center_discipline_set_v1',{discipline_id:D,state:'active'},c);
 async function linked(label,role,centers=[A,B]){
  const p=(await mut('person_create_v1',{display_name:label,contacts:[]})).primary_id;
  const u=await authUser(label),a=await must(u,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
  for(const c of centers){await mut('student_activate_v1',{person_id:p},c);if(role==='center_manager')await mut('center_manager_assign_v1',{person_id:p},c);else if(role)await mut('role_assign_v1',{person_id:p,role,scope:{center_id:c}},c);}
  return {p,u,a};
 }
 const manager=await linked('settlement-manager','center_manager'),student=await linked('settlement-student',null,[A,B,C]),teacher=await linked('settlement-teacher','instructor',[A,B,C]);
 const om=await linked('settlement-org-manager',null);
 await mut('org_manager_assign_v1',{person_id:om.p},null);
 const authority=(p=person,c=null,u=owner)=>read('settlement_authority_get_v1',{person_id:p},c,u);
 async function grant(p,c,granted=true,u=owner){const v=await authority(p,c,u);return mut('settlement_authority_set_v1',{person_id:p,expected_version:v.version,granted,reason:'Explicit settlement authority'},c,u);}
 const movements=async(c=A,u=owner,page)=>{
  if(page!==undefined)return read('settlement_movements_list_v1',{currency:'TRY',page},c,u);
  const items=[];let cursor;do{const p=await read('settlement_movements_list_v1',{currency:'TRY',page:{limit:100,...(cursor?{cursor}:{})}},c,u);items.push(...p.items);cursor=p.next_cursor;}while(cursor);return {items,next_cursor:null};
 };
 const requests=(c=A,u=owner,page={})=>read('settlement_requests_list_v1',{page},c,u);
 const get=(id,c=A,u=owner)=>read('settlement_request_get_v1',{settlement_request_id:id},c,u);
 const line=(m,n=m.open_minor)=>({movement_id:m.id,expected_version:m.version,amount_minor:String(n)});
 const proposal=(lines,amount)=>({kind:'payment',lines,amount_minor:String(amount),occurred_at:new Date(Date.now()-1000).toISOString()});
 const submit=(p,from=A,to=B,u=owner,extra={},k=key())=>mut('settlement_request_submit_v1',{from_center_id:from,to_center_id:to,currency:'TRY',proposal:p,reason:'Actual payment or explicit offset',...extra},from,u,k);
 const decide=(q,decision='approve',u=owner,k=key())=>mut('settlement_request_decide_v1',{settlement_request_id:q.id,expected_version:q.version,decision,reason:'B decision'},q.to_center_id,u,k);
 await t.test('DS-AUTH owner delegation and exact center grant chain does not imply operational authority',async()=>{
  assert.equal((await authority()).version,1);
  await fail('settlement_movements_list_v1',{currency:'TRY',page:{}},'FORBIDDEN');
  await fail('settlement_authority_get_v1',{person_id:person},'FORBIDDEN',A,student.u);
  await fail('settlement_authority_get_v1',{person_id:person},'NOT_FOUND',A,outside);
  await grant(person,A);await grant(person,B);await grant(person,C);await grant(manager.p,A);
  assert.equal((await movements()).items.length,0);
  await fail('settlement_authority_set_v1',{person_id:student.p,expected_version:(await authority()).version,granted:true,reason:'invalid target'},'NOT_FOUND');
  await fail('settlement_delegation_set_v1',{person_id:om.p,expected_version:(await authority()).version,granted:true,reason:'forbidden'},'FORBIDDEN',null,manager.u);
  const v=await authority(om.p);await mut('settlement_delegation_set_v1',{person_id:om.p,expected_version:v.version,granted:true,reason:'Owner delegates'},null);
  await grant(manager.p,B,true,om.u);
  await fail('settlement_movements_list_v1',{currency:'TRY',page:{}},'FORBIDDEN',A,om.u);
  await fail('settlement_authority_set_v1',{person_id:person,expected_version:1,granted:true,reason:'stale'},'VERSION_CONFLICT');
 });
 for(const c of [A,B]){
  const publish=(k,v)=>mut('policy_publish_v1',{key:k,value:v,effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false},null);
  if(c===A){
   await publish('participation_block_credit',{kind:'blocked_credit',effect:'release'});
   await publish('negative_default',{kind:'integer',value:10});await publish('negative_upper',{kind:'integer',value:10});
   await publish('negative_valuation',{kind:'valuation',discipline_id:D,format:'group',amount_minor:'100',currency:'TRY'});
   await publish('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
   await publish('reservation_window',{kind:'window',opens_minutes_before:600000,closes_minutes_before:0,manager_exception:false});
  }
 }
 for(const c of [A,B,C]){
 await mut('availability_save_v1',{resource:{kind:'person',id:teacher.p},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}},c);
 await mut('instructor_agreement_publish_v1',{person_id:teacher.p,discipline_id:D,format:'group',valid:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},terms:{model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:c===A?'999':'75'}],room_fee:{kind:'free',order:'before_instructor_share'}},reason:'B agreement'},c);
 }
 async function product(c=A,kind='credits',price='1000',credits=4,scopes=[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]){
  return mut('product_publish_v1',{terms:{name:'Cross center actual sale',kind,booking_mode:'flexible',...(kind==='credits'?{credits}:{}),price_minor:price,currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes}},c);
 }
 async function sell(p,c=A,target=student.p){
  const pr=await read('sale_preview_v1',{person_id:target,product_version_id:p.primary_id,start_date:'2026-01-01',end_date:'2027-12-31'},c);
  return (await mut('sale_apply_v1',{preview:{id:pr.id,token:pr.token}},c)).primary_id;
 }
 let seq=0;
 async function lesson(sale,performed=true,result='attended',p=student.p,c=B,cancel=false){
  seq++;const start=new Date(Date.now()+seq*3600000+86400000);start.setUTCMinutes(10,0,0);
  const ss=await mut('session_create_v1',{discipline_id:D,format:'group',interval:{starts_at:start.toISOString(),ends_at:new Date(+start+1800000).toISOString()},resources:[],assignments:[{person_id:teacher.p,duty:'instructor'}],capacity:{nominal:10,maximum:12}},c);
  const rid=(await mut('reservation_create_v1',{session_id:ss.primary_id,person_id:p,mode:'flexible',...(sale?{source_sale_id:sale}:{})},c)).primary_id;
  await db.query("update core.sessions set starts_at=now()-interval '1 second',ends_at=now()+interval '29 minutes' where id=$1",[ss.primary_id]);
  if(cancel){const rv=(await rows('select version from core.reservations where id=$1',[rid]))[0];await mut('reservation_cancel_v1',{reservation_id:rid,expected_version:Number(rv.version),reason:'Late consuming cancellation'},c);}
  let v=await read('attendance_get_v1',{session_id:ss.primary_id},c);
  assert.equal(v.actual_started_at,null,'Legacy closure acceptance must not use an explicit start record');
  if(!cancel)await mut('attendance_mark_v1',{reservation_id:rid,expected_version:v.entries[0].version,result},c);
  v=await read('attendance_get_v1',{session_id:ss.primary_id},c);
  const k=key(),payload={session_id:ss.primary_id,expected_version:v.session_version,performed,performed_instructor_ids:performed?[teacher.p]:[]};
  await mut('attendance_close_v1',payload,c,owner,k);
  return {sid:ss.primary_id,rid,k,payload,c};
 }
 async function correct(l,result,performed){
  const pr=await read('attendance_correct_preview_v1',{session_id:l.sid,reason:'Reasoned attendance correction',corrections:result?[{reservation_id:l.rid,result}]:[],...(performed===undefined?{}:{performed,performed_instructor_ids:performed?[teacher.p]:[]})},l.c);
  return mut('attendance_correct_apply_v1',{preview:{id:pr.id,token:pr.token}},l.c);
 }
 let sale,l1,m1,pending,approved,baseProduct;
 await t.test('DS-SET actual credited sale consumption creates A to B share independent of cash and B earning cost',async()=>{
  baseProduct=await product();sale=await sell(baseProduct);
  l1=await lesson(sale);
  assert.equal((await rows('select actual_started_at from core.sessions where id=$1',[l1.sid]))[0].actual_started_at,null);
  const list=await movements();m1=list.items.find(x=>x.kind==='accrual');
  assert(m1);assert.equal(m1.amount_minor,'250');assert.equal(m1.open_minor,'250');assert.equal(m1.debtor_center_id,A);assert.equal(m1.creditor_center_id,B);
  assert.equal((await rows('select count(*) n from core.cash_movements where org_id=$1 and person_id=$2',[org,student.p]))[0].n,'0');
  assert.equal((await rows('select amount_minor from core.earnings where session_id=$1',[l1.sid]))[0].amount_minor,'75');
  await mut('attendance_close_v1',l1.payload,B,owner,l1.k);
  assert.equal((await movements()).items.filter(x=>x.kind==='accrual').length,1);
 });
 await t.test('DS-SCOPE same account may submit under A and approve under independently verified B; partial payment closes only on approval',async()=>{
  const k=key(),p=proposal([line(m1,100)],100);
  pending=await submit(p,A,B,owner,{},k);
  assert.equal((await movements()).items.find(x=>x.id===m1.id).open_minor,'250');
  const q=await get(pending.primary_id);assert.equal(q.state,'pending');assert.equal(q.record,null);
  assert.equal(q.initiator_authority.center_id,A);
  assert((await submit(p,A,B,owner,{},k)).replayed);
  await fail('settlement_request_submit_v1',{from_center_id:A,to_center_id:B,currency:'TRY',proposal:p,reason:'different payload'},'IDEMPOTENCY_PAYLOAD_MISMATCH',A,owner,k);
  await fail('settlement_request_decide_v1',{settlement_request_id:q.id,expected_version:q.version,decision:'approve',reason:'A cannot impersonate B'},'FORBIDDEN',A);
  await decide(q);approved=await get(q.id);
  assert.equal(approved.state,'approved');assert.equal(approved.record.amount_minor,'100');
  assert.equal(approved.initiator_account_id,approved.decision_account_id);
  assert.equal(approved.decision_authority.center_id,B);
  assert.equal((await movements()).items.find(x=>x.id===m1.id).open_minor,'150');
 });
 await t.test('DS-SET selected-only stale; unrelated new lesson does not invalidate a pending request',async()=>{
  let m=(await movements()).items.find(x=>x.id===m1.id);
  const p=await submit(proposal([line(m,25)],25));
  await lesson(sale);
  await decide(await get(p.primary_id));
  m=(await movements()).items.find(x=>x.id===m1.id);
  const stale=await submit(proposal([line(m,25)],25)),other=await submit(proposal([line(m,25)],25));
  await decide(await get(other.primary_id));
  await fail('settlement_request_decide_v1',{settlement_request_id:stale.primary_id,expected_version:1,decision:'approve',reason:'stale selected'},'PREVIEW_STALE',B);
 });
 await t.test('DS-AUTH A-only authority cannot decide; revoked B grant blocks same-key replay',async()=>{
  const m=(await movements()).items.find(x=>x.id===m1.id),p=await submit(proposal([line(m,10)],10),A,B,manager.u);
  const q=await get(p.primary_id,A,manager.u);await grant(manager.p,B,false);
  await fail('settlement_request_decide_v1',{settlement_request_id:q.id,expected_version:q.version,decision:'approve',reason:'missing B'},'FORBIDDEN',B,manager.u);
  await grant(manager.p,B,true);const k=key();await decide(q,'approve',manager.u,k);await grant(manager.p,B,false);
  await fail('settlement_request_decide_v1',{settlement_request_id:q.id,expected_version:q.version,decision:'approve',reason:'B decision'},'FORBIDDEN',B,manager.u,k);
  await grant(manager.p,B,true);
 });
 await t.test('DS-SET withdrawal and reasoned rejection have no balance record and rejection notifies A',async()=>{
  const m=(await movements()).items.find(x=>x.id===m1.id),before=m.open_minor;
  const a=await submit(proposal([line(m,5)],5)),b=await submit(proposal([line(m,5)],5));
  await mut('settlement_request_withdraw_v1',{settlement_request_id:a.primary_id,expected_version:1,reason:'A withdraws'});
  await decide(await get(b.primary_id),'reject',manager.u);
  assert.equal((await get(a.primary_id)).record,null);assert.equal((await get(b.primary_id)).record,null);
  assert.equal((await movements()).items.find(x=>x.id===m1.id).open_minor,before);
  const n=await rows("select recipient_person_id,subject_id,payload from core.notifications where org_id=$1 and payload->>'settlement_request_id'=$2 and kind='settlement_request_decide_v1'",[org,b.primary_id]);assert.equal(n[0].recipient_person_id,person);
  assert.equal(n[0].subject_id,org);assert.equal(n[0].payload.subject.id,org);
  assert.equal(n[0].payload.reason,'B decision');assert.equal(n[0].payload.step_authority.center_id,B);
  const audit=(await rows("select subject_table,subject_id,diff from core.audit_events where org_id=$1 and action='settlement_request_decide_v1' and diff->>'settlement_request_id'=$2",[org,b.primary_id]))[0];
  assert.equal(audit.subject_table,'organizations');assert.equal(audit.subject_id,org);assert.equal(audit.diff.step_authority.center_id,B);
 });
 await t.test('DS-SET explicit partial correction preserves original payment and uses exact original allocation versions',async()=>{
  const q=await get(approved.id),rec=q.record,al=rec.allocations[0];
  const cp={kind:'correction',original_record_id:rec.id,expected_version:rec.version,amount_minor:'40',allocations:[{allocation_id:al.id,expected_version:al.version,amount_minor:'40'}]};
  const before=(await movements()).items.find(x=>x.id===m1.id).open_minor;
  const p=await submit(cp);await decide(await get(p.primary_id));
  const after=await get(approved.id);assert.equal(after.record.amount_minor,'100');assert.equal(after.record.allocations[0].unreversed_minor,'60');assert.equal(after.record.version,2);
  assert.equal(BigInt((await movements()).items.find(x=>x.id===m1.id).open_minor),BigInt(before)+40n);
  await fail('settlement_request_submit_v1',{from_center_id:A,to_center_id:B,currency:'TRY',proposal:cp,reason:'stale correction'},'PREVIEW_STALE');
 });
 await t.test('DS-SET rights reversal retains actual paid history and creates B to A refund residual at original amount',async()=>{
  const before=(await movements()).items.find(x=>x.id===m1.id);await correct(l1,'no_show');
  const list=await movements(),reversal=list.items.find(x=>x.kind==='reversal'&&x.previous_id===m1.id);
  assert.equal(reversal.amount_minor,m1.amount_minor);assert.equal(reversal.open_minor,String(BigInt(m1.amount_minor)-BigInt(before.open_minor)));
  assert.equal(reversal.debtor_center_id,B);assert.equal(reversal.creditor_center_id,A);
  assert.equal((await get(approved.id)).record.amount_minor,'100');
 });
 await t.test('DS-SET explicit opposite-direction offset reduces both selected sides atomically and can be corrected',async()=>{
  let ms=(await movements()).items;const debit=ms.find(x=>x.kind==='accrual'&&x.open_minor!=='0'),credit=ms.find(x=>x.kind==='reversal'&&x.open_minor!=='0');
  const p=await submit({kind:'offset',debit_lines:[line(debit,20)],credit_lines:[line(credit,20)],amount_minor:'20'});
  await decide(await get(p.primary_id));const q=await get(p.primary_id);assert.equal(q.record.allocations.length,2);
  const cp={kind:'correction',original_record_id:q.record.id,expected_version:q.record.version,amount_minor:'10',allocations:q.record.allocations.map(a=>({allocation_id:a.id,expected_version:a.version,amount_minor:'10'}))};
  const c=await submit(cp);await decide(await get(c.primary_id));
  assert.equal((await get(p.primary_id)).record.allocations.every(a=>a.unreversed_minor==='10'),true);
 });
 await t.test('DS-SET malformed offset, duplicate lines, cross-currency and foreign pair cannot close balances',async()=>{
  const m=(await movements()).items.find(x=>x.kind==='accrual'&&x.open_minor!=='0');
  await fail('settlement_request_submit_v1',{from_center_id:A,to_center_id:B,currency:'TRY',proposal:proposal([line(m,1),line(m,1)],2),reason:'duplicate'},'VALIDATION_FAILED');
  await fail('settlement_request_submit_v1',{from_center_id:A,to_center_id:B,currency:'USD',proposal:proposal([line(m,1)],1),reason:'FX forbidden'},'CURRENCY_MISMATCH');
  await fail('settlement_request_submit_v1',{from_center_id:A,to_center_id:C,currency:'TRY',proposal:proposal([line(m,1)],1),reason:'wrong pair'},'VALIDATION_FAILED');
 });
 await t.test('DS-SET source-less negative initially creates no transfer; later eligible A sale settles past deficit without reprice',async()=>{
  const p=await linked('settlement-negative'),before=(await movements()).items.filter(x=>x.kind==='accrual').length;
  const l=await lesson(null,true,'attended',p.p);
  assert.equal((await movements()).items.filter(x=>x.kind==='accrual').length,before);
  const old=await rows('select id,amount_minor,basis from core.earnings where session_id=$1',[l.sid]);
  const ns=await sell(baseProduct,A,p.p);
  const alloc=(await rows('select id from core.entitlement_allocations where org_id=$1 and sale_id=$2 and reservation_id=$3',[org,ns,l.rid]))[0];
  assert(alloc);assert((await movements()).items.some(x=>x.kind==='accrual'&&x.source_allocation_id===alloc.id));
  assert.deepEqual(await rows('select id,amount_minor,basis from core.earnings where session_id=$1',[l.sid]),old);
  await correct(l,'no_show');assert((await movements()).items.some(x=>x.kind==='reversal'&&x.source_allocation_id===alloc.id));
 });
 await t.test('DS-SET timed, same-center, released and not performed consumption create no transfer',async()=>{
  const before=(await movements()).items.filter(x=>x.kind==='accrual').length;
  const timed=await sell(await product(A,'timed'));const tl=await lesson(timed);assert.equal((await rows('select amount_minor from core.earnings where session_id=$1',[tl.sid]))[0].amount_minor,'75');
  const own=await sell(await product(B),B);await lesson(own);
  const p=await sell(await product());await lesson(p,false);
  const q=await sell(await product());await lesson(q,true,'no_show');
  assert.equal((await movements()).items.filter(x=>x.kind==='accrual').length,before);
 });

 await t.test('DS-SET stable largest remainder includes local use and survives release and reconsume',async()=>{
  const p=await product(A,'credits','100',3),s=await sell(p);
  await lesson(s,true,'attended',student.p,A);
  const b=await lesson(s),c=await lesson(s,true,'attended',student.p,C);
  let list=(await movements(B)).items.filter(x=>x.source_sale_id===s&&x.kind==='accrual');
  assert.equal(list.length,1);assert.equal(list[0].amount_minor,'33');
  assert.equal((await movements(C)).items.find(x=>x.source_sale_id===s&&x.kind==='accrual').amount_minor,'33');
  await correct(b,'no_show');await correct(b,'attended');
  list=(await movements(B)).items.filter(x=>x.source_sale_id===s);
  assert.equal(list.filter(x=>x.kind==='accrual').length,2);
  assert.equal(list.find(x=>x.kind==='reversal').amount_minor,'33');
  assert.equal(list.filter(x=>x.kind==='accrual').every(x=>x.amount_minor==='33'),true);
  assert.equal((await rows('select sum(amount_minor)::text n from private.settlement_credit_units where org_id=$1 and sale_id=$2',[org,s]))[0].n,'100');
 });
 await t.test('DS-SET correction rejects foreign and duplicated allocations; later correction after rights reversal preserves history',async()=>{
  const q=await get(approved.id),rec=q.record,al=rec.allocations[0];
  const another=(await rows('select id,version from private.settlement_allocations where org_id=$1 and record_id<>$2 limit 1',[org,rec.id]))[0];
  const base={kind:'correction',original_record_id:rec.id,expected_version:rec.version,amount_minor:'1',allocations:[{allocation_id:another.id,expected_version:Number(another.version),amount_minor:'1'}]};
  await fail('settlement_request_submit_v1',{from_center_id:A,to_center_id:B,currency:'TRY',proposal:base,reason:'foreign allocation'},'NOT_FOUND');
  const selection={allocation_id:al.id,expected_version:al.version,amount_minor:'1'};
  await fail('settlement_request_submit_v1',{from_center_id:A,to_center_id:B,currency:'TRY',proposal:{...base,amount_minor:'2',allocations:[selection,selection]},reason:'duplicate correction'},'VALIDATION_FAILED');
  const p=await submit({...base,allocations:[selection]});await decide(await get(p.primary_id));
  const after=await get(approved.id);assert.equal(after.record.amount_minor,'100');assert.equal(after.record.allocations[0].unreversed_minor,'59');
 });
 await t.test('DS-SET consuming no-show accrues share; pure release does not',async()=>{
  const terms={kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'consume',no_show:'consume'}};
  await mut('policy_publish_v1',{key:'student_cancel_group',value:terms,effective_at:new Date(Date.now()-500).toISOString(),mandatory:false},null);
  const s=await sell(await product()),l=await lesson(s,true,'no_show');
  const a=(await rows('select id from core.entitlement_allocations where reservation_id=$1',[l.rid]))[0];
  assert((await movements()).items.some(x=>x.source_allocation_id===a.id&&x.kind==='accrual'));
  const cancelled=await lesson(await sell(await product()),true,'attended',student.p,B,true);
  assert.equal((await rows('select state from core.entitlement_allocations where reservation_id=$1',[cancelled.rid]))[0].state,'consumed');
  const ca=(await rows('select id from core.entitlement_allocations where reservation_id=$1',[cancelled.rid]))[0];assert((await movements()).items.some(x=>x.kind==='accrual'&&x.source_allocation_id===ca.id));
  await mut('policy_publish_v1',{key:'student_cancel_group',value:{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}},effective_at:new Date(Date.now()-100).toISOString(),mandatory:false},null);
 });
 await t.test('DS-AUTH revoke versus approve serializes and cannot commit after lost live B authority',async()=>{
  const m=(await movements()).items.find(x=>x.kind==='accrual'&&x.debtor_center_id===A&&x.creditor_center_id===B&&BigInt(x.open_minor)>=1n);
  const p=await submit(proposal([line(m,1)],1)),q=await get(p.primary_id),v=await authority(manager.p,B);
  const [decision,revoke]=await Promise.all([
   call(manager.u,'settlement_request_decide_v1',body({settlement_request_id:q.id,expected_version:q.version,decision:'approve',reason:'concurrent B decision'},B),key()),
   call(owner,'settlement_authority_set_v1',body({person_id:manager.p,expected_version:v.version,granted:false,reason:'concurrent revoke'},B),key())
  ]);
  assert(revoke.result.ok,JSON.stringify(revoke.result));
  const state=(await get(q.id)).state;
  if(decision.result.ok)assert.equal(state,'approved');else{assert.equal(decision.result.error.code,'FORBIDDEN');assert.equal(state,'pending');}
  await grant(manager.p,B,true);
 });

 await t.test('DS-SET concurrent approvals and distinct requests never double-close selected balance',async()=>{
  const m=(await movements()).items.find(x=>x.kind==='accrual'&&x.debtor_center_id===A&&x.creditor_center_id===B&&BigInt(x.open_minor)>=10n);
  const p=await submit(proposal([line(m,10)],10)),q=await get(p.primary_id);
  const answers=await Promise.all([call(owner,'settlement_request_decide_v1',body({settlement_request_id:q.id,expected_version:q.version,decision:'approve',reason:'race'},B),key()),call(owner,'settlement_request_decide_v1',body({settlement_request_id:q.id,expected_version:q.version,decision:'approve',reason:'race'},B),key())]);
  assert.equal(answers.filter(x=>x.result.ok).length,1);
  assert.equal((await rows('select count(*) n from private.settlement_records where request_id=$1',[q.id]))[0].n,'1');
 });
 await t.test('DS-ATOMIC late outbox failure rolls back request record allocations balances and receipt',async()=>{
  const m=(await movements()).items.find(x=>x.kind==='accrual'&&x.debtor_center_id===A&&x.creditor_center_id===B&&BigInt(x.open_minor)>=1n);
  const p=await submit(proposal([line(m,1)],1)),q=await get(p.primary_id),k=key();
  await db.query("create function private.settlement_test_fail() returns trigger language plpgsql as $$begin if new.org_id='"+org+"'::uuid then raise exception 'late synthetic';end if;return new;end$$;create trigger settlement_test_fail before insert on core.outbox_jobs for each row execute function private.settlement_test_fail()");
  try{const x=await call(owner,'settlement_request_decide_v1',body({settlement_request_id:q.id,expected_version:q.version,decision:'approve',reason:'rollback'},B),k);assert.equal(x.result.ok,false);}
  finally{await db.query('drop trigger settlement_test_fail on core.outbox_jobs;drop function private.settlement_test_fail()');}
  assert.equal((await get(q.id)).state,'pending');assert.equal((await get(q.id)).record,null);
  assert.equal((await movements()).items.find(x=>x.id===m.id).open_minor,m.open_minor);
  assert.equal((await rows("select count(*) n from core.operation_receipts where org_id=$1 and operation='settlement_request_decide_v1' and key_hash=encode(extensions.digest($2,'sha256'),'hex')",[org,k]))[0].n,'0');
 });
 await t.test('DS-SET large immutable selection provisions stored-scope UUID bank',async()=>{
  const ids=Array.from({length:260},()=>key());
  const fixtures=await rows("insert into private.settlement_movements(id,org_id,debtor_center_id,creditor_center_id,currency,amount_minor,open_minor,kind,operation_id) select id,$1,$2,$3,'TRY',1,1,'accrual',$4 from unnest($5::uuid[]) id returning id,version",[org,A,B,key(),ids]);
  const p=await submit(proposal(fixtures.map(x=>({movement_id:x.id,expected_version:Number(x.version),amount_minor:'1'})),260));
  await decide(await get(p.primary_id));
  assert.equal((await get(p.primary_id)).record.allocations.length,260);
  assert.equal((await rows('select sum(open_minor)::text n from private.settlement_movements where org_id=$1 and id=any($2::uuid[])',[org,ids]))[0].n,'0');
 });
 await t.test('DS-AUTH revoked delegation and B role reject old session and receipt',async()=>{
  const version=(await authority(om.p)).version;
  await mut('settlement_delegation_set_v1',{person_id:om.p,expected_version:version,granted:false,reason:'Owner revokes delegation'},null);
  await fail('settlement_authority_set_v1',{person_id:manager.p,expected_version:(await authority()).version,granted:true,reason:'revoked OM'},'FORBIDDEN',B,om.u);
  const m=(await movements()).items.find(x=>x.kind==='accrual'&&x.debtor_center_id===A&&x.creditor_center_id===B&&BigInt(x.open_minor)>=1n);
  const p=await submit(proposal([line(m,1)],1)),q=await get(p.primary_id),k=key();await decide(q,'approve',manager.u,k);
  const role=(await rows("select id,version from core.role_assignments where org_id=$1 and person_id=$2 and scope_center_id=$3 and role='center_manager' and state='active'",[org,manager.p,B]))[0];
  await mut('center_manager_revoke_v1',{person_id:manager.p,expected_version:Number(role.version),reason:'Revoke live B role'},B);
  await fail('settlement_request_decide_v1',{settlement_request_id:q.id,expected_version:q.version,decision:'approve',reason:'B decision'},'FORBIDDEN',B,manager.u,k);
  await mut('center_manager_assign_v1',{person_id:manager.p},B);
 });
 await t.test('DS-SET local-only sale cannot settle B deficit and unknown selection stays hidden',async()=>{
  const p=await linked('settlement-local-only'),negative=await lesson(null,true,'attended',p.p);
  const prod=await product(A,'credits','100',2,[{scope_kind:'center_all_disciplines',center_id:A,discipline_id:null,usage_targets:['lesson']}]);
  const localSale=await sell(prod,A,p.p);
  assert.equal((await rows('select state from core.credit_deficits where org_id=$1 and reservation_id=$2',[org,negative.rid]))[0].state,'consumed');
  assert.equal((await movements()).items.some(x=>x.source_sale_id===localSale),false);
  const otherDiscipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Settlement unrelated discipline',state:'active'},key())).primary_id;
  for(const c of [A,B])await mut('center_discipline_set_v1',{discipline_id:otherDiscipline,state:'active'},c);
  const wrongDiscipline=await product(A,'credits','100',2,[{scope_kind:'organization_discipline',center_id:null,discipline_id:otherDiscipline,usage_targets:['lesson']}]);
  const wrongSale=await sell(wrongDiscipline,A,p.p);
  assert.equal((await rows('select state from core.credit_deficits where org_id=$1 and reservation_id=$2',[org,negative.rid]))[0].state,'consumed');
  assert.equal((await movements()).items.some(x=>x.source_sale_id===wrongSale),false);
  const unknown=key();await fail('settlement_request_get_v1',{settlement_request_id:unknown},'NOT_FOUND');
  await fail('settlement_request_submit_v1',{from_center_id:A,to_center_id:B,currency:'TRY',proposal:proposal([{movement_id:unknown,expected_version:1,amount_minor:'1'}],1),reason:'unknown movement'},'NOT_FOUND');
 });
 await t.test('DS-SET frozen plan rejects version transitions and ABA but ignores billing bookkeeping',async()=>{
  const sub=(await rows('select id,plan_version_id from core.saas_subscriptions where org_id=$1 order by created_at desc,id desc limit 1',[org]))[0];
  const clone=async(features)=>{const id=key();await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) select $1,name,now(),price_minor,currency,period,limits,"+(features?"array_remove(features,'F18')":"features")+" from core.saas_plan_versions where id=$2",[id,sub.plan_version_id]);return id;};
  const business=await clone(false),pro=await clone(true);
  const pending=async()=>{const m=(await movements()).items.find(x=>x.kind==='accrual'&&x.debtor_center_id===A&&x.creditor_center_id===B&&BigInt(x.open_minor)>=1n);return get((await submit(proposal([line(m,1)],1))).primary_id);};
  const first=await pending();await db.query('update core.saas_subscriptions set version=version+1 where id=$1',[sub.id]);await decide(first);
  const old=await pending();
  try{
   await db.query('update core.saas_subscriptions set plan_version_id=$2,version=version+1 where id=$1',[sub.id,business]);
   await fail('settlement_request_decide_v1',{settlement_request_id:old.id,expected_version:old.version,decision:'approve',reason:'stale plan'},'PREVIEW_STALE',B);
   await decide(await pending());
   await db.query('update core.saas_subscriptions set plan_version_id=$2,version=version+1 where id=$1',[sub.id,pro]);
   await fail('settlement_movements_list_v1',{currency:'TRY',page:{}},'PLAN_FEATURE_UNAVAILABLE');
  }finally{await db.query('update core.saas_subscriptions set plan_version_id=$2,version=version+1 where id=$1',[sub.id,sub.plan_version_id]);}
  await fail('settlement_request_decide_v1',{settlement_request_id:old.id,expected_version:old.version,decision:'approve',reason:'ABA plan'},'PREVIEW_STALE',B);
 });
 await t.test('DS-SET B package override applies to A source sale independently of share',async()=>{
  const prod=await product(),identity=(await rows('select product_id from core.product_versions where id=$1',[prod.primary_id]))[0].product_id;
  const prev=(await read('instructor_agreements_list_v1',{person_id:teacher.p,page:{}},B)).items[0];
  await mut('instructor_agreement_publish_v1',{person_id:teacher.p,discipline_id:D,format:'group',supersedes_id:prev.id,expected_version:prev.version,valid:{starts_at:'2021-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},terms:{model:'explicit_mixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'75'},{kind:'per_person',amount_minor:'50'}],package_overrides:[{product_id:identity,components:[{kind:'percentage',rate_bps:2000,basis:{mode:'sale_unit'},entitlement_kind:'credits'}]}],room_fee:{kind:'free',order:'before_instructor_share'}},reason:'B explicit product override'},B);
  const sale=await sell(prod),l=await lesson(sale);
  assert.equal((await rows('select amount_minor from core.earnings where session_id=$1',[l.sid]))[0].amount_minor,'125');
  assert.equal((await movements()).items.find(x=>x.source_sale_id===sale&&x.kind==='accrual').amount_minor,'250');
 });
 await t.test('DS-SET B source settles its past deficit without any cross-center share',async()=>{
  const p=await linked('settlement-b-negative'),l=await lesson(null,true,'attended',p.p),before=await rows('select id,amount_minor,basis from core.earnings where session_id=$1',[l.sid]);
  const s=await sell(await product(B),B,p.p);
  assert.equal((await rows('select state from core.credit_deficits where reservation_id=$1',[l.rid]))[0].state,'settled');
  assert.equal((await movements()).items.some(x=>x.source_sale_id===s),false);
  assert.deepEqual(await rows('select id,amount_minor,basis from core.earnings where session_id=$1',[l.sid]),before);
 });
 await t.test('DS-SET linked replacement freezes changed scope and requires a new B approval',async()=>{
  const m=(await movements()).items.find(x=>x.kind==='accrual'&&x.debtor_center_id===A&&x.creditor_center_id===B&&BigInt(x.open_minor)>=2n),old=await get((await submit(proposal([line(m,1)],1))).primary_id);
  await mut('settlement_request_withdraw_v1',{settlement_request_id:old.id,expected_version:old.version,reason:'Revise proposal'});
  const prior=await get(old.id),before=m.open_minor;
  const replacement=await get((await submit(proposal([line(m,2)],2),A,B,owner,{previous_id:prior.id,previous_version:prior.version})).primary_id);
  assert.equal(replacement.previous_id,prior.id);assert.equal(replacement.state,'pending');assert.equal(replacement.record,null);
  assert.equal((await movements()).items.find(x=>x.id===m.id).open_minor,before);
  await decide(replacement);assert.equal((await get(replacement.id)).record.amount_minor,'2');assert.equal((await get(prior.id)).state,'withdrawn');
 });
 await t.test('DS-SET multi-line payment correction reverses only selected original allocation',async()=>{
  const ms=(await movements()).items.filter(x=>x.kind==='accrual'&&x.debtor_center_id===A&&x.creditor_center_id===B&&BigInt(x.open_minor)>=2n).slice(0,2);assert.equal(ms.length,2);
  const q=await get((await submit(proposal(ms.map(m=>line(m,2)),4))).primary_id);await decide(q);const rec=(await get(q.id)).record;
  const a=rec.allocations[0],other=rec.allocations[1],before=(await movements()).items.find(x=>x.id===other.movement_id).open_minor;
  const correction=await get((await submit({kind:'correction',original_record_id:rec.id,expected_version:rec.version,amount_minor:'1',allocations:[{allocation_id:a.id,expected_version:a.version,amount_minor:'1'}]})).primary_id);await decide(correction);
  const after=(await get(q.id)).record;assert.equal(after.amount_minor,'4');assert.equal(after.allocations.find(x=>x.id===a.id).unreversed_minor,'1');assert.equal(after.allocations.find(x=>x.id===other.id).unreversed_minor,'2');assert.equal((await movements()).items.find(x=>x.id===other.movement_id).open_minor,before);
 });
 await t.test('DS-ATOMIC distinct payment offset and correction requests serialize competing dependencies',async()=>{
  const debit=(await movements()).items.find(x=>x.kind==='accrual'&&x.debtor_center_id===A&&x.creditor_center_id===B&&BigInt(x.open_minor)>=6n),credit=(await movements()).items.find(x=>x.kind==='reversal'&&BigInt(x.open_minor)>=2n);assert(credit);
  const initial=await get((await submit(proposal([line(debit,2)],2))).primary_id);await decide(initial);const rec=(await get(initial.id)).record,al=rec.allocations[0];
  const m=(await movements()).items.find(x=>x.id===debit.id);
  const proposals=[proposal([line(m,2)],2),{kind:'offset',debit_lines:[line(m,2)],credit_lines:[line(credit,2)],amount_minor:'2'},{kind:'correction',original_record_id:rec.id,expected_version:rec.version,amount_minor:'1',allocations:[{allocation_id:al.id,expected_version:al.version,amount_minor:'1'}]}];
  const qs=[];for(const p of proposals)qs.push(await get((await submit(p)).primary_id));
  const outcomes=await Promise.all(qs.map(q=>call(owner,'settlement_request_decide_v1',body({settlement_request_id:q.id,expected_version:q.version,decision:'approve',reason:'competing commands'},B),key())));
  assert.equal(outcomes.filter(x=>x.result.ok).length,1);for(const x of outcomes.filter(x=>!x.result.ok))assert.equal(x.result.error.code,'PREVIEW_STALE');
  const winner=outcomes.findIndex(x=>x.result.ok),after=(await movements()).items.find(x=>x.id===m.id);assert.equal(BigInt(after.open_minor),BigInt(m.open_minor)+(winner===2?1n:-2n));
  assert.equal((await rows('select count(*) n from private.settlement_records where request_id=any($1::uuid[])',[qs.map(q=>q.id)]))[0].n,'1');
 });
 await t.test('DS-ATOMIC ledger audit and receipt failures rollback the entire multi-line batch',async()=>{
  const snapshot=async()=>rows("select name,(select coalesce(jsonb_agg(row_data order by row_data->>'id'),'[]'::jsonb) from (select to_jsonb(t) row_data from private.settlement_movements t where org_id=$1) z) data from (values('movements')) n(name) union all select 'records',coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from private.settlement_records t where org_id=$1 union all select 'allocations',coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from private.settlement_allocations t where org_id=$1 union all select 'requests',coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from private.settlement_requests t where org_id=$1 union all select 'audit',coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from core.audit_events t where org_id=$1 union all select 'outbox',coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from core.outbox_jobs t where org_id=$1 union all select 'notifications',coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from core.notifications t where org_id=$1 union all select 'receipts',coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from core.operation_receipts t where org_id=$1",[org]);
  for(const table of ['private.settlement_allocations','core.audit_events','core.operation_receipts']){
   const ms=(await movements()).items.filter(x=>x.kind==='accrual'&&x.debtor_center_id===A&&x.creditor_center_id===B&&BigInt(x.open_minor)>=1n).slice(0,2),q=await get((await submit(proposal(ms.map(m=>line(m,1)),2))).primary_id),before=await snapshot();
   const filter=table==='core.audit_events'?" and new.action='settlement_request_decide_v1'":table==='core.operation_receipts'?" and new.operation='settlement_request_decide_v1' and new.state='succeeded'":"";
   await db.query("create function private.settlement_batch_fail() returns trigger language plpgsql as $$begin if TG_TABLE_NAME='settlement_allocations' and not exists(select 1 from private.settlement_allocations where record_id=(to_jsonb(new)->>'record_id')::uuid) then return new;end if;raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$;create trigger settlement_batch_fail before "+(table==='core.operation_receipts'?'update':'insert')+" on "+table+" for each row when(new.org_id='"+org+"'::uuid"+filter+") execute function private.settlement_batch_fail()");
   try{await fail('settlement_request_decide_v1',{settlement_request_id:q.id,expected_version:q.version,decision:'approve',reason:'rollback all selected lines'},'INTEGRITY_VIOLATION',B);assert.deepEqual(await snapshot(),before);}
   finally{await db.query('drop trigger settlement_batch_fail on '+table+';drop function private.settlement_batch_fail()');}
   await decide(q);assert.equal((await get(q.id)).record.allocations.length,2);
  }
 });
 await t.test('DS-SCOPE cursor bound to actor center currency filters; unrelated center and student reads denied',async()=>{
  const page=await movements(A,owner,{limit:1});assert(page.next_cursor);
  await fail('settlement_movements_list_v1',{currency:'TRY',page:{limit:1,cursor:page.next_cursor}},'VALIDATION_FAILED',B);
  await fail('settlement_movements_list_v1',{currency:'TRY',page:{}},'FORBIDDEN',A,student.u);
  await fail('settlement_request_get_v1',{settlement_request_id:approved.id},'NOT_FOUND',C);
  assert((await requests()).items.length>0);
 });
 }finally{await db.end();}
});
