
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


test('Cross-center sale provenance, valuation and consumption',async t=>{
 const {platform,plan,owner,outside,db,rows,account,org,A,B,C,person,body,mut,read,fail,D,linked,manager,student,teacher,om,authority,grant,movements,requests,get,line,proposal,submit,decide,product,sell,lesson,correct}=await settlementFixture(t);
 let sale,l1,m1,pending,approved,baseProduct;
 // These are real source sales, actual attendance and approved payment; no synthetic movement rows.
 await grant(person,A);await grant(person,B);await grant(person,C);await grant(manager.p,A);
 const authorityVersion=await authority(om.p);
 await mut('settlement_delegation_set_v1',{person_id:om.p,expected_version:authorityVersion.version,granted:true,reason:'Native independent settlement fixture'},null);
 await grant(manager.p,B,true,om.u);
 baseProduct=await product();
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
});


