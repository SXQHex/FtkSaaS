
import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from '../../api-client.mjs';
import {connect} from '../../../scripts/db.mjs';
import {newUuidV7 as key} from '../../../scripts/uuid.mjs';
async function settlementFixture(t){
 const {platform,plan}=await fixturePlatform(),owner=await authUser('settlement-owner'),outside=await authUser('settlement-outsider');
 const db=await connect();t.after(()=>db.end());const rows=async(q,a=[])=>(await db.query(q,a)).rows;
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
  const ss=await mut('session_create_v1',{discipline_id:D,format:'group',interval:{starts_at:start.toISOString(),ends_at:new Date(+start+1800000).toISOString()},resources:[],assignments:[{person_id:teacher.p,duty:'instructor'}],capacity:{total:10}},c);
  const rid=(await mut('reservation_create_v1',{session_id:ss.primary_id,person_id:p,mode:'flexible',...(sale?{source_sale_id:sale}:{})},c)).primary_id;
  // Preserve all30 minutes and legacy actual_started_at=null without crossing Istanbul midnight.
  const elapsed=new Date();elapsed.setUTCHours(9,0,0,0);if(+elapsed>=Date.now())elapsed.setUTCDate(elapsed.getUTCDate()-1);
  await db.query('update core.sessions set starts_at=$1,ends_at=$2 where id=$3',[elapsed,new Date(+elapsed+1800000),ss.primary_id]);
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
 return {platform,plan,owner,outside,db,rows,account,org,A,B,C,person,body,mut,read,fail,D,linked,manager,student,teacher,om,authority,grant,movements,requests,get,line,proposal,submit,decide,product,sell,lesson,correct};
}

test('Cross-center payment, correction, reversal and scope chain',async t=>{
 const {platform,plan,owner,outside,db,rows,account,org,A,B,C,person,body,mut,read,fail,D,linked,manager,student,teacher,om,authority,grant,movements,requests,get,line,proposal,submit,decide,product,sell,lesson,correct}=await settlementFixture(t);
 let sale,l1,m1,pending,approved,baseProduct;
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
 await t.test('DS-SCOPE cursor bound to actor center currency filters; unrelated center and student reads denied',async()=>{
  const page=await movements(A,owner,{limit:1});assert(page.next_cursor);
  await fail('settlement_movements_list_v1',{currency:'TRY',page:{limit:1,cursor:page.next_cursor}},'VALIDATION_FAILED',B);
  await fail('settlement_movements_list_v1',{currency:'TRY',page:{}},'FORBIDDEN',A,student.u);
  await fail('settlement_request_get_v1',{settlement_request_id:approved.id},'NOT_FOUND',C);
  assert((await requests()).items.length>0);
 });
});



