
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



test('Cross-center live authority, plan snapshots and request races',async t=>{
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
});

