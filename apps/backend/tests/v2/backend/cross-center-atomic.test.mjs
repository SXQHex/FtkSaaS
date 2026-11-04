
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




test('Cross-center multi-line settlement and atomic ledger failures',async t=>{
 const {platform,plan,owner,outside,db,rows,account,org,A,B,C,person,body,mut,read,fail,D,linked,manager,student,teacher,om,authority,grant,movements,requests,get,line,proposal,submit,decide,product,sell,lesson,correct}=await settlementFixture(t);
 let sale,l1,m1,pending,approved,baseProduct;
 // These are real source sales, actual attendance and approved payment; no synthetic movement rows.
 await grant(person,A);await grant(person,B);await grant(person,C);await grant(manager.p,A);
 const authorityVersion=await authority(om.p);
 await mut('settlement_delegation_set_v1',{person_id:om.p,expected_version:authorityVersion.version,granted:true,reason:'Native independent settlement fixture'},null);
 await grant(manager.p,B,true,om.u);
 baseProduct=await product();
 sale=await sell(baseProduct);l1=await lesson(sale);await lesson(sale);await lesson(sale);
 m1=(await movements()).items.find(x=>x.kind==='accrual');
 const paymentRequest=await get((await submit(proposal([line(m1,100)],100))).primary_id);
 await decide(paymentRequest);await correct(l1,'no_show');
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
});
