import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
test('Instructor agreement and earnings through Auth -> Edge -> RPC',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('earning-owner'),outsider=await authUser('earning-outsider');
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 try{
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Starter acceptance',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Starter',timezone:'Europe/Istanbul'},key())).primary_id;
 const scope=b=>({org_id:org,center_id:center,...b}),mut=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));return r;};
 const person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 await mut('center_manager_assign_v1',{person_id:person});
 const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic starter',occurred_at:new Date().toISOString()});
 await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},key(),platform);
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Starter lesson',state:'active'},key())).primary_id;
 await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 async function linked(label,role){
  const p=(await mut('person_create_v1',{display_name:label,contacts:[]})).primary_id;await mut('student_activate_v1',{person_id:p});
  const u=await authUser(label),a=await must(u,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
  const grant=role?await mut('role_assign_v1',{person_id:p,role,scope:{center_id:center}}):null;
  return {p,u,a,grant};
 }
 const student=await linked('starter-student'),instructor=await linked('starter-instructor','instructor');
 await mut('availability_save_v1',{resource:{kind:'person',id:instructor.p},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
 const effective_at=new Date(Date.now()-10000).toISOString();
 const publish=(k,value)=>mut('policy_publish_v1',{center_id:null,key:k,value,effective_at:new Date().toISOString(),mandatory:false});
 await publish('participation_block_credit',{kind:'blocked_credit',effect:'release'});
 await publish('negative_default',{kind:'integer',value:2});await publish('negative_upper',{kind:'integer',value:2});
 await publish('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
 await publish('reservation_window',{kind:'window',opens_minutes_before:60000,closes_minutes_before:0,manager_exception:false});
 await publish('negative_valuation',{kind:'valuation',discipline_id:discipline,format:'group',amount_minor:'100',currency:'TRY'});
 let sequence=0;const makeSession=async(extra={})=>{sequence++;return mut('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:new Date(new Date().setUTCHours(10,0,0,0)+sequence*86400000).toISOString(),ends_at:new Date(new Date().setUTCHours(11,0,0,0)+sequence*86400000).toISOString()},resources:[],assignments:[],capacity:{total:8},assignments:[{person_id:instructor.p,duty:'instructor'}],...extra});};
 const book=(sid,p=student.p,k=key())=>mut('reservation_create_v1',{session_id:sid,person_id:p,mode:'flexible'},k);
 const get=sid=>must(owner,'attendance_get_v1',scope({session_id:sid}));
 const token=p=>({id:p.id,token:p.token});
 const preview=change=>must(owner,'reservation_impact_preview_v1',scope({change,reason:'Explicit impact approval'}));

 const fixed=n=>({kind:'session_fixed',amount_minor:String(n)});
 const personFee=n=>({kind:'per_person',amount_minor:String(n)});
 const percent=n=>({kind:'percentage',rate_bps:n,basis:{mode:'sale_unit'},entitlement_kind:'credits'});
 const terms=(parts,extra={})=>({model:'explicit_mixed',currency:'TRY',components:parts,room_fee:{kind:'free',order:'before_instructor_share'},...extra});
 const agreementRequest=(t,extra={})=>({person_id:instructor.p,discipline_id:discipline,format:'group',valid:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},terms:t,reason:'Explicit instructor terms',...extra});
 const agree=(t,extra={},k=key())=>mut('instructor_agreement_publish_v1',agreementRequest(t,extra),k);
 const list=()=>must(owner,'instructor_agreements_list_v1',scope({person_id:instructor.p,page:{}}));
 const product=async(kind='credits',extras={})=>mut('product_publish_v1',{terms:{name:'Earning source',kind,booking_mode:'flexible',...(kind==='credits'?{credits:2}:{}),price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}],...extras}});
 const sell=async(p,version,net_minor)=>{const pr=await must(owner,'sale_preview_v1',scope({person_id:p,product_version_id:version,start_date:'2026-01-01',end_date:'2027-01-01',net_minor}));return (await mut('sale_apply_v1',{preview:token(pr)})).primary_id;};
 // Keep the scheduled interval inside configured availability even when CI runs
 // across local midnight. Record the synthetic early start through the real API.
 const mark=async(sid)=>{
  const scheduled=(await rows('select starts_at,ends_at from core.sessions where id=$1',[sid]))[0];
  let v=await get(sid);
  await mut('attendance_start_v1',{session_id:sid,expected_version:v.session_version,actual_started_at:new Date().toISOString(),reason:'Synthetic explicit start for earnings acceptance'});
  v=await get(sid);assert(v.actual_started_at);
  assert.deepEqual((await rows('select starts_at,ends_at from core.sessions where id=$1',[sid]))[0],scheduled);
  for(const e of v.entries)await mut('attendance_mark_v1',{reservation_id:e.reservation_id,expected_version:e.version,result:'attended'});
  return get(sid);
 };
 const close=async(sid,k=key(),u=owner,performed=true)=>{const v=await get(sid);return mut('attendance_close_v1',{session_id:sid,expected_version:v.session_version,performed,performed_instructor_ids:performed?[instructor.p]:[]},k,u);};
 const earningRows=sid=>rows('select * from core.earnings where session_id=$1 order by created_at,id',[sid]);
 const earningRead=(u=owner)=>must(u,'earnings_list_v1',scope({person_id:instructor.p,interval:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},page:{}}));
 let agreement,original,sid,rid,rv2,closureKey,closurePayload,startReceipt;
 await t.test('immutable publication and management read use original live authority',async()=>{
  await fail('instructor_agreements_list_v1',{person_id:instructor.p,page:{}},'FORBIDDEN',student.u);
  await fail('instructor_agreement_publish_v1',agreementRequest(terms([fixed(100)])),'NOT_FOUND',outsider);
  await fail('instructor_agreement_publish_v1',agreementRequest(terms([fixed(100),fixed(200)])),'VALIDATION_FAILED');
  await fail('instructor_agreement_publish_v1',agreementRequest(terms([{kind:'session_fixed',amount_minor:'100',rate_bps:2000}])),'VALIDATION_FAILED');
  await fail('instructor_agreement_publish_v1',agreementRequest(terms([fixed('9223372036854775808')])),'VALIDATION_FAILED');
  agreement=await agree(terms([fixed(100),personFee(50),percent(5000)]));original=agreement;
  const a=await list();assert.equal(a.items[0].id,agreement.primary_id);assert.equal(a.items[0].version,1);
  const legacy=key();await db.query("insert into core.instructor_agreements(id,org_id,center_id,person_id,discipline_id,format,valid_from,model,terms,state) values($1,$2,$3,$4,$5,'group','2020-01-01','session_fixed',$6,'inactive')",[legacy,org,center,instructor.p,discipline,terms([fixed(1)])]);
  const oldView=(await list()).items.find(x=>x.id===legacy);assert.equal(oldView.valid.ends_at,null);assert.equal(oldView.published_at,null);
  const replay=key(),request=agreementRequest(terms([fixed(100)]),{format:'private'});const first=await mut('instructor_agreement_publish_v1',request,replay);assert((await mut('instructor_agreement_publish_v1',request,replay)).replayed);
  await assert.rejects(db.query("update core.instructor_agreements set model='session_fixed' where id=$1",[first.primary_id]),/INTEGRITY_VIOLATION/);
  await fail('instructor_agreement_publish_v1',agreementRequest(terms([fixed(200)])),'VERSION_CONFLICT');
 });
 await t.test('successor publication rejects independent-chain overlap and permits exact adjacent boundaries',async()=>{
  const other=await linked('earning-independent-chains','instructor');
  const publishChain=(valid,extra={})=>agree(terms([fixed(10)]),{person_id:other.p,valid,...extra});
  const a=await publishChain({starts_at:'2027-01-01T00:00:00Z',ends_at:'2027-06-01T00:00:00Z'});
  const b=await publishChain({starts_at:'2027-06-01T00:00:00Z',ends_at:'2027-12-01T00:00:00Z'});
  const count=Number((await rows('select count(*) n from core.instructor_agreements where person_id=$1',[other.p]))[0].n);
  await fail('instructor_agreement_publish_v1',agreementRequest(terms([fixed(99)]),{person_id:other.p,supersedes_id:a.primary_id,expected_version:a.version,valid:{starts_at:'2027-03-01T00:00:00Z',ends_at:'2027-09-01T00:00:00Z'}}),'VERSION_CONFLICT');
  assert.equal(Number((await rows('select count(*) n from core.instructor_agreements where person_id=$1',[other.p]))[0].n),count);
  const replacement=await publishChain({starts_at:'2027-03-01T00:00:00Z',ends_at:'2027-05-01T00:00:00Z'},{supersedes_id:a.primary_id,expected_version:a.version});
  const next=await publishChain({starts_at:'2027-04-01T00:00:00Z',ends_at:'2027-06-01T00:00:00Z'},{supersedes_id:replacement.primary_id,expected_version:replacement.version});
  assert.equal(next.version,3);
  const view=await must(owner,'instructor_agreements_list_v1',scope({person_id:other.p,page:{}}));
  assert.equal(view.items.find(x=>x.id===b.primary_id).supersedes_id,null);
  // Multi-generation replacement still permits an exact independent-chain boundary.
  const gap=await publishChain({starts_at:'2027-05-01T00:00:00Z',ends_at:'2027-06-01T00:00:00Z'},{supersedes_id:next.primary_id,expected_version:next.version});
  assert.equal(gap.version,4);
 });
 let pa,pb,saleA;
 await t.test('package identity override replaces variable conditions; fixed fee occurs once; cash is not required',async()=>{
  pa=await product('credits',{price_minor:'800'});pb=await product('credits',{price_minor:'1001'});
  const identity=(await rows('select product_id from core.product_versions where id=$1',[pa.primary_id]))[0].product_id;
  const replacement={supersedes_id:agreement.primary_id,expected_version:agreement.version,valid:{starts_at:'2021-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'}};
  agreement=await agree(terms([fixed(100),personFee(50),percent(5000)],{package_overrides:[{product_id:identity,components:[percent(2500)]}]}),replacement);
  const p2=await linked('earning-student-2');
  const a=await sell(student.p,pa.primary_id,'800'),b=await sell(p2.p,pb.primary_id,'1001');
  saleA=a;sid=(await makeSession()).primary_id;
  rid=(await mut('reservation_create_v1',{session_id:sid,person_id:student.p,source_sale_id:a,mode:'flexible'})).primary_id;
  rv2=(await mut('reservation_create_v1',{session_id:sid,person_id:p2.p,source_sale_id:b,mode:'flexible'})).primary_id;
  const v=await mark(sid);closureKey=key();closurePayload={session_id:sid,expected_version:v.session_version,performed:true,performed_instructor_ids:[instructor.p]};
  await mut('attendance_close_v1',closurePayload,closureKey);
  const es=await earningRows(sid);assert.equal(es.length,1);assert.equal(es[0].amount_minor,'500');assert.equal(es[0].agreement_id,agreement.primary_id);assert(es[0].closure_id);
  assert((await mut('attendance_close_v1',closurePayload,closureKey)).replayed);
  assert.equal((await rows('select count(*)::int n from core.cash_movements where org_id=$1',[org]))[0].n,0);
  const read=await earningRead(instructor.u);assert.equal(read.items.find(x=>x.session_id===sid).amount_minor,'500');
  assert.equal((await rows("select count(*)::int n from core.entitlement_allocations where reservation_id=any($1) and state='consumed'",[[rid,rv2]]))[0].n,2);
 });

 await t.test('same product override covers old and new sale versions without catalog repricing',async()=>{
  const identity=(await rows('select product_id from core.product_versions where id=$1',[pa.primary_id]))[0].product_id;
  const newer=(await mut('product_publish_v1',{product_id:identity,terms:{name:'New catalog price',kind:'credits',booking_mode:'flexible',credits:2,price_minor:'1200',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
  const p=await linked('earning-new-sale'),sale=await sell(p.p,newer,'1200'),ses=(await makeSession()).primary_id;
  await mut('reservation_create_v1',{session_id:ses,person_id:student.p,source_sale_id:saleA,mode:'flexible'});
  await mut('reservation_create_v1',{session_id:ses,person_id:p.p,source_sale_id:sale,mode:'flexible'});
  await mark(ses);await close(ses);assert.equal((await earningRows(ses))[0].amount_minor,'350');
  assert.equal((await rows('select net_minor from core.sales where id=$1',[saleA]))[0].net_minor,'800');
 });

 await t.test('negative booking settled before closure still uses general terms and its frozen valuation',async()=>{
  const p=await linked('earning-preclose-negative'),ses=(await makeSession()).primary_id,rv=(await book(ses,p.p)).primary_id;
  await sell(p.p,pa.primary_id,'800');
  assert.equal((await rows('select state from core.credit_deficits where reservation_id=$1',[rv]))[0].state,'settled');
  await mark(ses);await close(ses);assert.equal((await earningRows(ses))[0].amount_minor,'200');
 });
 await t.test('reasoned correction previews and appends a linked difference from the frozen original agreement',async()=>{
  const replacement={supersedes_id:agreement.primary_id,expected_version:agreement.version,valid:{starts_at:new Date(Date.now()-30000).toISOString(),ends_at:'2030-01-01T00:00:00Z'}};
  agreement=await agree(terms([fixed(9999)]),replacement);
  const originalEarning=(await earningRows(sid))[0],payment=key();
  await db.query("insert into core.instructor_payments(id,org_id,center_id,person_id,amount_minor,currency,occurred_at,reason) values($1,$2,$3,$4,500,'TRY',now(),'Historical payment fixture')",[payment,org,center,instructor.p]);
  await db.query('insert into core.earning_allocations(id,org_id,center_id,payment_id,earning_id,amount_minor) values($1,$2,$3,$4,$5,500)',[key(),org,center,payment,originalEarning.id]);
  const req={session_id:sid,corrections:[{reservation_id:rid,result:'no_show'}],reason:'Correct the observed attendance'};
  const p=await must(owner,'attendance_correct_preview_v1',scope(req));assert(p.effects.some(x=>x.amount_minor==='100'&&x.action==='reverse'));
  const stale=await must(owner,'attendance_correct_preview_v1',scope(req));
  const k=key(),res=await Promise.all([1,2].map(()=>mut('attendance_correct_apply_v1',{preview:token(p)},k)));assert.equal(res.filter(x=>x.replayed).length,1);
  const es=await earningRows(sid);assert.equal(es.length,2);assert.equal(es[1].amount_minor,'100');assert.equal(es[1].direction,'subtract');assert.equal(es[1].previous_id,es[0].id);assert.equal(es[1].agreement_id,es[0].agreement_id);
  await fail('attendance_correct_apply_v1',{preview:token(stale)},'PREVIEW_STALE');
  assert.equal((await rows('select amount_minor from core.instructor_payments where id=$1',[payment]))[0].amount_minor,'500');
  assert.equal((await rows('select amount_minor from core.earning_allocations where payment_id=$1',[payment]))[0].amount_minor,'500');
  const view=await earningRead();assert.equal(view.items.filter(x=>x.session_id===sid).length,2);
 });
 await t.test('negative valuation writer is versioned, read by format, and frozen at reservation',async()=>{
  const sel={operation:'negcredit_valuation_set_v1',selector:{operation:'negcredit_valuation_set_v1',key:{discipline_id:discipline,format:'group'}}};
  const before=(await must(owner,'management_state_get_v1',scope(sel))).items[0];
  const version=before.versions[0].version;
  const payload={discipline_id:discipline,format:'group',amount_minor:'240',currency:'TRY',effective_at:new Date().toISOString(),expected_version:version};
  await mut('negcredit_valuation_set_v1',payload);await fail('negcredit_valuation_set_v1',payload,'VERSION_CONFLICT');
  const current=(await must(owner,'management_state_get_v1',scope(sel))).items[0];assert.equal(current.current.values.amount_minor,'240');
  const neg=await linked('earning-negative'),ses=(await makeSession()).primary_id,rv=(await book(ses,neg.p)).primary_id;
  assert.equal((await rows('select negative_basis_minor from core.reservations where id=$1',[rv]))[0].negative_basis_minor,'240');
  const old=agreement;agreement=await agree(terms([percent(5000)]),{supersedes_id:old.primary_id,expected_version:old.version,valid:{starts_at:new Date(Date.now()-10000).toISOString(),ends_at:'2030-01-01T00:00:00Z'}});
  await mut('negcredit_valuation_set_v1',{...payload,amount_minor:'900',expected_version:current.versions[0].version});
  await mark(ses);await close(ses);assert.equal((await earningRows(ses))[0].amount_minor,'120');
  const sale=await sell(neg.p,pb.primary_id,'1001');assert(sale);assert.equal((await earningRows(ses)).length,1);
  const correction=await must(owner,'attendance_correct_preview_v1',scope({session_id:ses,corrections:[{reservation_id:rv,result:'no_show'}],reason:'Reverse later settled deficit'}));
  await mut('attendance_correct_apply_v1',{preview:token(correction)});assert.equal((await earningRows(ses))[1].direction,'subtract');
 });

 await t.test('timed percentage needs explicit fixed-unit basis; no implicit fee is chosen',async()=>{
  const p=await linked('earning-timed'),prod=await product('timed'),sale=await sell(p.p,prod.primary_id,'1000');
  const missing=(await makeSession()).primary_id;await mut('reservation_create_v1',{session_id:missing,person_id:p.p,source_sale_id:sale,mode:'flexible'});
  await mark(missing);let v=await get(missing);
  await fail('attendance_close_v1',{session_id:missing,expected_version:v.session_version,performed:true,performed_instructor_ids:[instructor.p]},'POLICY_NOT_CONFIGURED');
  const prev=agreement;agreement=await agree(terms([percent(5000),{kind:'percentage',rate_bps:4000,basis:{mode:'fixed_unit',unit_minor:'300'},entitlement_kind:'timed'}]),{supersedes_id:prev.primary_id,expected_version:prev.version,valid:{starts_at:new Date(Date.now()-5000).toISOString(),ends_at:'2030-01-01T00:00:00Z'}});
  const configured=(await makeSession()).primary_id;await mut('reservation_create_v1',{session_id:configured,person_id:p.p,source_sale_id:sale,mode:'flexible'});
  await mark(configured);await close(configured);assert.equal((await earningRows(configured))[0].amount_minor,'120');
 });
 await t.test('late outbox failure rolls back linked correction, earning, rights, audit and receipt',async()=>{
  const preview=await must(owner,'attendance_correct_preview_v1',scope({session_id:sid,corrections:[{reservation_id:rv2,result:'no_show'}],reason:'Correct second attendance'}));
  const snapshot=async()=>{const x={};for(const table of ['earnings','attendance_closures','attendance_entries','reservations','sessions','entitlement_allocations','entitlement_movements','operation_receipts','audit_events','outbox_jobs'])x[table]=await rows('select to_jsonb(q) d from core.'+table+' q where org_id=$1 order by id',[org]);return x;};
  const before=await snapshot(),fn='earning_late_'+key().replaceAll('-','');
  await db.query("create function private."+fn+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query("create trigger "+fn+" before insert on core.outbox_jobs for each row when(new.org_id='"+org+"'::uuid) execute function private."+fn+"()");
  try{await fail('attendance_correct_apply_v1',{preview:token(preview)},'INTEGRITY_VIOLATION');assert.deepEqual(await snapshot(),before);}
  finally{await db.query('drop trigger '+fn+' on core.outbox_jobs');await db.query('drop function private.'+fn+'()');}
  await mut('attendance_correct_apply_v1',{preview:token(preview)});assert.equal((await earningRows(sid)).at(-1).amount_minor,'300');
 });
 await t.test('closure failure is atomic and competing closures cannot earn twice',async()=>{
  const p=await linked('earning-rollback'),ses=(await makeSession()).primary_id;await book(ses,p.p);await mark(ses);const v=await get(ses);
  const fn='earning_close_'+key().replaceAll('-',''),counts=async()=>{const x={};for(const table of ['earnings','attendance_closures','entitlement_movements','credit_deficits','operation_receipts','audit_events','outbox_jobs'])x[table]=await rows('select to_jsonb(q) d from core.'+table+' q where org_id=$1 order by id',[org]);return x;};
  const before=await counts();
  await db.query("create function private."+fn+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query("create trigger "+fn+" before insert on core.audit_events for each row when(new.org_id='"+org+"'::uuid and new.action='attendance_close_v1') execute function private."+fn+"()");
  const payload={session_id:ses,expected_version:v.session_version,performed:true,performed_instructor_ids:[instructor.p]};
  try{await fail('attendance_close_v1',payload,'INTEGRITY_VIOLATION');assert.deepEqual(await counts(),before);}
  finally{await db.query('drop trigger '+fn+' on core.audit_events');await db.query('drop function private.'+fn+'()');}
  const r=await Promise.all([1,2].map(()=>call(owner,'attendance_close_v1',scope(payload),key())));assert.equal(r.filter(x=>x.result.ok).length,1);assert.equal(r.find(x=>!x.result.ok).result.error.code,'ATTENDANCE_CLOSED');assert.equal((await earningRows(ses)).length,1);
 });

 await t.test('Pro uses the explicit agreement path with the same atomic right and earning result',async()=>{
  const sub=(await rows('select * from core.saas_subscriptions where org_id=$1',[org]))[0],pro=key();
  await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) select $1,'pro',now(),price_minor,currency,period,limits,features from core.saas_plan_versions where id=$2",[pro,plan]);
  await db.query('update core.saas_subscriptions set plan_version_id=$1 where id=$2',[pro,sub.id]);
  try{const p=await linked('earning-pro'),ses=(await makeSession()).primary_id;await book(ses,p.p);await mark(ses);await close(ses);assert.equal((await earningRows(ses))[0].amount_minor,'450');}
  finally{await db.query('update core.saas_subscriptions set plan_version_id=$1 where id=$2',[plan,sub.id]);}
 });


 await t.test('acknowledged negative-limit protection survives paid closure and earns the frozen fee',async()=>{
  const p=await linked('earning-protected'),ses=(await makeSession()).primary_id,rv=(await book(ses,p.p)).primary_id;
  const change={kind:'negative_limit',person_id:p.p,discipline_id:discipline,allowed_negative_credits:0};
  const approval=await must(owner,'reservation_impact_preview_v1',scope({change,reason:'Protect existing paid obligation'}));assert(approval.affected.some(x=>x.reservation_id===rv));
  await mut('reservation_impact_apply_v1',{preview:token(approval.preview),accepted_reservation_ids:approval.affected.map(x=>x.reservation_id)});
  await mark(ses);assert((await get(ses)).entries[0].protected);await close(ses);assert.equal((await earningRows(ses))[0].amount_minor,'450');
 });
 await t.test('explicit early start pins historically published terms and blocks later schedule edits',async()=>{
  const p=await linked('earning-early-start'),ses=(await makeSession()).primary_id,rv=(await book(ses,p.p)).primary_id,old=agreement;
  let v=await get(ses);const k=key(),payload={session_id:ses,expected_version:v.session_version,actual_started_at:new Date().toISOString(),reason:'Instructor explicitly records real start'};
  startReceipt={payload,k};await mut('attendance_start_v1',payload,k,instructor.u);assert((await mut('attendance_start_v1',payload,k,instructor.u)).replayed);
  v=await get(ses);assert(v.actual_started_at);
  await fail('attendance_start_v1',{...payload,expected_version:v.session_version},'INVALID_STATE_TRANSITION');
  agreement=await agree(terms([fixed(333)]),{supersedes_id:old.primary_id,expected_version:old.version,valid:{starts_at:new Date().toISOString(),ends_at:'2030-01-01T00:00:00Z'}});
  assert.equal((await rows('select agreement_id from core.session_assignments where session_id=$1',[ses]))[0].agreement_id,old.primary_id);
  const preview=await must(owner,'session_change_preview_v1',scope({session_id:ses,scope:'single',patch:{capacity:{total:9}},reason:'Cannot edit a started session'}));assert.equal(preview.blockers[0].code,'INVALID_STATE_TRANSITION');
  v=await get(ses);await mut('attendance_mark_v1',{reservation_id:rv,expected_version:v.entries[0].version,result:'attended'});await close(ses);assert.equal((await earningRows(ses))[0].amount_minor,'450');
 });

 await t.test('late start evidence excludes a replacement published after the stated real start',async()=>{
  const ses=(await makeSession()).primary_id,old=agreement,actual=new Date().toISOString();
  agreement=await agree(terms([fixed(9000)]),{supersedes_id:old.primary_id,expected_version:old.version,valid:{starts_at:new Date().toISOString(),ends_at:'2030-01-01T00:00:00Z'}});
  const v=await get(ses);await mut('attendance_start_v1',{session_id:ses,expected_version:v.session_version,actual_started_at:actual,reason:'Late factual start record'});
  const started=(await rows('select started_agreements from core.sessions where id=$1',[ses]))[0].started_agreements;assert.equal(started[0].agreement_id,old.primary_id);
  await close(ses);assert.equal((await earningRows(ses))[0].amount_minor,'333');
 });
 await t.test('started assignments retain old agreement while future sessions select the successor',async()=>{
  const past=(await makeSession()).primary_id,future=(await makeSession()).primary_id;
  await db.query("update core.sessions set starts_at=now()-interval '1 minute' where id=$1",[past]);
  const old=agreement;agreement=await agree(terms([fixed(333)]),{supersedes_id:old.primary_id,expected_version:old.version,valid:{starts_at:new Date().toISOString(),ends_at:'2030-01-01T00:00:00Z'}});
  const a=await rows('select session_id,agreement_id from core.session_assignments where session_id=any($1)',[[past,future]]);
  assert.equal(a.find(x=>x.session_id===past).agreement_id,old.primary_id);assert.equal(a.find(x=>x.session_id===future).agreement_id,agreement.primary_id);
  const r=await Promise.all([1,2].map(()=>call(owner,'instructor_agreement_publish_v1',scope(agreementRequest(terms([fixed(222)]),{supersedes_id:agreement.primary_id,expected_version:agreement.version,valid:{starts_at:'2027-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'}})),key())));
  assert.equal(r.filter(x=>x.result.ok).length,1);assert.equal(r.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');
  agreement=r.find(x=>x.result.ok).result.data;
  const boundary='2027-02-01T10:00:00Z',equal=(await makeSession({interval:{starts_at:boundary,ends_at:'2027-02-01T11:00:00Z'}})).primary_id;
  agreement=await agree(terms([fixed(444)]),{supersedes_id:agreement.primary_id,expected_version:agreement.version,valid:{starts_at:boundary,ends_at:'2030-01-01T00:00:00Z'}});
  assert.equal((await rows('select agreement_id from core.session_assignments where session_id=$1',[equal]))[0].agreement_id,agreement.primary_id);
 });
 await t.test('missing occurrence declaration cannot create a paid closure; explicitly unperformed creates no earning',async()=>{
  const ses=(await makeSession()).primary_id;await db.query("update core.sessions set starts_at=now()-interval '1 second' where id=$1",[ses]);const v=await get(ses);
  await fail('attendance_close_v1',{session_id:ses,expected_version:v.session_version},'VALIDATION_FAILED');
  await close(ses,key(),owner,false);assert.equal((await earningRows(ses)).length,0);
  const privateLesson=(await makeSession({format:'private'})).primary_id;
  await db.query("update core.sessions set starts_at=now()-interval '1 second' where id=$1",[privateLesson]);await close(privateLesson,key(),owner,false);
  const correction=await must(owner,'attendance_correct_preview_v1',scope({session_id:privateLesson,corrections:[],performed:true,performed_instructor_ids:[instructor.p],reason:'Correct actual performance declaration'}));
  assert(correction.effects.some(x=>x.amount_minor==='100'));
  await mut('attendance_correct_apply_v1',{preview:token(correction)});assert.equal((await earningRows(privateLesson))[0].amount_minor,'100');
 });

 await t.test('blocked participation can consume configured rights but never a variable earning',async()=>{
  await publish('participation_block_credit',{kind:'blocked_credit',effect:'consume'});
  const policyChange={kind:'policy',key:'debt_participation',value:{kind:'boolean',value:true},effective_at:new Date().toISOString(),mandatory:false};
  const approval=await must(owner,'reservation_impact_preview_v1',scope({center_id:null,change:policyChange,reason:'Explicit debt participation impact'}));
  await mut('reservation_impact_apply_v1',{center_id:null,preview:token(approval.preview),accepted_reservation_ids:approval.affected.map(x=>x.reservation_id)});
  try{
   const oldPrivate=(await list()).items.find(x=>x.format==='private');
   await agree(terms([fixed(25),percent(5000)]),{format:'private',supersedes_id:oldPrivate.id,expected_version:oldPrivate.version,valid:{starts_at:'2021-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'}});
   await publish('student_cancel_private',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
   await publish('negative_valuation',{kind:'valuation',discipline_id:discipline,format:'private',amount_minor:'100',currency:'TRY'});
   const p=await linked('earning-blocked'),ses=(await makeSession({format:'private'})).primary_id,rv=(await book(ses,p.p)).primary_id;
   const prod=await product('timed');await sell(p.p,prod.primary_id,'1000');
   await db.query("update core.sessions set starts_at=now()-interval '1 second',ends_at=now()+interval '59 minutes' where id=$1",[ses]);
   const v=await get(ses);await mut('attendance_block_v1',{reservation_id:rv,expected_version:v.entries[0].version,reason:'debt_policy'});
   await close(ses);const beforeEarning=(await earningRows(ses))[0];assert.equal(beforeEarning.amount_minor,'25');
   const projected=(await earningRead()).items.find(x=>x.id===beforeEarning.id);assert.equal(projected.basis.quantity,0);assert.equal(projected.basis.excluded_blocked,1);
   const cp=await must(owner,'attendance_correct_preview_v1',scope({session_id:ses,corrections:[{reservation_id:rv,result:'attended'}],reason:'Correct blocked observation'}));
   await mut('attendance_correct_apply_v1',{preview:token(cp)});
   const corrected=await earningRead();assert.equal(corrected.items.find(x=>x.id===beforeEarning.id).basis.excluded_blocked,1);
   const newRow=corrected.items.find(x=>x.session_id===ses&&x.id!==beforeEarning.id);assert.equal(newRow.basis.quantity,1);assert.equal(newRow.basis.excluded_blocked,0);
   assert.equal((await rows('select state from core.credit_deficits where reservation_id=$1',[rv]))[0].state,'consumed');
  }finally{await publish('debt_participation',{kind:'boolean',value:false});await publish('participation_block_credit',{kind:'blocked_credit',effect:'release'});}
 });

 await t.test('room deduction order uses its explicit sale basis once, separately from instructor fixed-unit basis',async()=>{
  let prior=(await list()).items.filter(x=>x.format==='private').at(-1);
  const component={kind:'percentage',rate_bps:5000,basis:{mode:'fixed_unit',unit_minor:'600'},entitlement_kind:'credits'};
  const room=order=>({kind:'percentage',rate_bps:2000,basis:{mode:'sale_unit'},order});
  let next=await agree(terms([fixed(100),personFee(50),component],{room_fee:room('after_instructor_share')}),{format:'private',supersedes_id:prior.id,expected_version:prior.version,valid:{starts_at:'2022-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'}});
  const p=await linked('earning-room'),prod=await product(),sale=await sell(p.p,prod.primary_id,'1000');
  let ses=(await makeSession({format:'private'})).primary_id;await mut('reservation_create_v1',{session_id:ses,person_id:p.p,source_sale_id:sale,mode:'flexible'});await mark(ses);await close(ses);assert.equal((await earningRows(ses))[0].amount_minor,'350');
  next=await agree(terms([component],{room_fee:room('before_instructor_share')}),{format:'private',supersedes_id:next.primary_id,expected_version:next.version,valid:{starts_at:'2023-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'}});
  ses=(await makeSession({format:'private'})).primary_id;await mut('reservation_create_v1',{session_id:ses,person_id:p.p,source_sale_id:sale,mode:'flexible'});await mark(ses);await close(ses);assert.equal((await earningRows(ses))[0].amount_minor,'250');
 });
 await t.test('center-only manager cannot read or publish another center financial conditions',async()=>{
  const c2=(await mut('center_create_v1',{name:'Other earning center',timezone:'Europe/Istanbul'})).primary_id;
  const manager=await linked('earning-center-manager');await mut('center_manager_assign_v1',{person_id:manager.p});
  const read=await earningRead(manager.u);assert(read.items.length>0);
  await fail('earnings_list_v1',{center_id:c2,person_id:instructor.p,interval:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},page:{}},'FORBIDDEN',manager.u);
  await fail('instructor_agreement_publish_v1',{center_id:c2,...agreementRequest(terms([fixed(1)]))},'FORBIDDEN',manager.u);
 });
 await t.test('live role revocation blocks instructor read and manager receipt replay',async()=>{
  await mut('role_revoke_v1',{assignment_id:instructor.grant.primary_id,expected_version:instructor.grant.version,reason:'Revoke instructor access'});
  await fail('attendance_start_v1',startReceipt.payload,'FORBIDDEN',instructor.u,startReceipt.k);
  await fail('earnings_list_v1',{person_id:instructor.p,interval:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},page:{}},'FORBIDDEN',instructor.u);
  await mut('center_manager_revoke_v1',{person_id:person,expected_version:1,reason:'Revoke operation access'});
  await fail('attendance_close_v1',closurePayload,'FORBIDDEN',owner,closureKey);
 });
 }finally{await db.end();}
});
