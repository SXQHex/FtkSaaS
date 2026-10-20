import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Program lifecycle through real Auth -> Edge -> RPC',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('program-owner'),outsider=await authUser('program-outsider');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Program lifecycle',initial_plan_id:plan},key())).primary_id;
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 const scope=b=>({org_id:org,center_id:c1,...b}),mut=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const req=(op,b,u=owner,k=key())=>call(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await req(op,b,u,k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));return r;};
 const c1=(await must(owner,'center_create_v1',{org_id:org,name:'Program Istanbul',timezone:'Europe/Istanbul'},key())).primary_id;
 const c2=(await must(owner,'center_create_v1',{org_id:org,name:'Program Berlin',timezone:'Europe/Berlin'},key())).primary_id;
 let fault;
 try{
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 for(const c of [c1,c2])await mut('center_manager_assign_v1',{center_id:c,person_id:ownerPerson});
 const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic program',occurred_at:new Date().toISOString()});
 await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},key(),platform);
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Program discipline',state:'active'},key())).primary_id;
 for(const c of [c1,c2])await mut('center_discipline_set_v1',{center_id:c,discipline_id:discipline,state:'active'});
 const cls=async(name,c=c1)=>(await mut('class_save_v1',{center_id:c,name,discipline_id:discipline,external_open:true})).primary_id;
 const allDay={weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'};
 const available=async(kind,id,c=c1)=>mut('availability_save_v1',{center_id:c,resource:{kind,id},rule:allDay});
 async function person(label,role=null,c=c1){
  const p=(await mut('person_create_v1',{center_id:c,display_name:label,contacts:[]})).primary_id;
  await mut('student_activate_v1',{center_id:c,person_id:p});
  if(!role)return {p};
  const u=await authUser(label),a=await must(u,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
  const grant=role==='student'?null:await mut(role==='center_manager'?'center_manager_assign_v1':'role_assign_v1',{center_id:c,person_id:p,...(role==='center_manager'?{}:{role,scope:{center_id:c}})});
  return {p,u,a,grant};
 }
 async function instructor(label){
  const a=await person(label,'instructor');await available('person',a.p);
  a.agreement=key();await db.query("insert into core.instructor_agreements(id,org_id,center_id,person_id,discipline_id,format,valid_from,model,terms,state) values($1,$2,$3,$4,$5,'group','2020-01-01','session_fixed',$6,'active')",[a.agreement,org,c1,a.p,discipline,{model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'100'}],room_fee:{kind:'free',order:'before_instructor_share'}}]);
  return a;
 }
 const i1=await instructor('program-instructor-one'),i2=await instructor('program-instructor-two'),assistant=await person('program-assistant','assistant'),student=await person('program-student','student'),cm=await person('program-cm','center_manager'),staff=await person('program-staff','staff');
 await available('person',assistant.p);
 const room=(await mut('room_save_v1',{name:'Program room',capacities:[{discipline_id:discipline,nominal:8,maximum:10}]})).primary_id;await available('room',room);
 const class1=await cls('Main program');
 const spec=(extra={})=>({weekdays:[1],local_start:'12:00:00',duration_minutes:60,starts_on:'2027-01-04',ends_on:'2027-02-01',assignments:[],capacity:{nominal:8,maximum:10},...extra});
 const preview=(cl=class1,s=spec(),c=c1,u=owner)=>must(u,'program_preview_v1',scope({center_id:c,class_id:cl,schedule:s}));
 const token=p=>({id:p.id,token:p.token});
 const apply=(p,k=key(),c=c1,u=owner)=>mut('program_apply_v1',{center_id:c,preview:token(p)},k,u);
 const get=(id,u=owner)=>must(u,'session_get_v1',scope({session_id:id}));
 const change=(id,patch,s='single',extra={})=>must(owner,'session_change_preview_v1',scope({session_id:id,patch,scope:s,reason:'Synthetic accepted change',...extra}));
 const applyChange=(p,k=key())=>mut('session_change_apply_v1',{preview:token(p)},k);
 const interval=(start,end)=>({starts_at:start,ends_at:end});
 const session=async(cl=class1,at='2027-02-08T09:00:00Z',extra={})=>mut('session_create_v1',{class_id:cl,discipline_id:discipline,format:'group',interval:interval(at,new Date(Date.parse(at)+3600000).toISOString()),resources:[],assignments:[],capacity:{nominal:8,maximum:10},...extra});
 const ledger=async()=>rows('select id,sale_id,reservation_id,state,quantity from core.entitlement_allocations where org_id=$1 order by id',[org]);
 async function counts(){
  const out={};for(const table of ['program_versions','sessions','session_assignments','resource_bookings','operation_receipts','audit_events','entitlement_allocations','notifications','outbox_jobs'])out[table]=(await rows('select count(*)::int n from core.'+table+' where org_id=$1',[org]))[0].n;return out;
 }
 async function inject(action){
  fault='program_'+key().replaceAll('-','');await db.query('create function private.'+fault+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query('create trigger '+fault+" before insert on core.audit_events for each row when(new.org_id='"+org+"'::uuid and new.action='"+action+"') execute function private."+fault+'()');
 }
 async function clearFault(){await db.query('drop trigger '+fault+' on core.audit_events');await db.query('drop function private.'+fault+'()');fault=null;}
 let base,sids;
 await t.test('preview is business-read-only; apply creates finite program, duties, bookings, and existing reads expose it',async()=>{
  await mut('class_assignment_set_v1',{class_id:class1,person_id:i1.p,duty:'instructor'});
  const before=await counts();base=await preview(class1,spec({room_id:room}));assert.deepEqual(base.blockers,[]);assert.deepEqual(await counts(),before);
  assert.equal(base.sessions.length,4);assert.deepEqual(base.sessions.map(x=>x.interval.starts_at),['2027-01-04T09:00:00+00:00','2027-01-11T09:00:00+00:00','2027-01-18T09:00:00+00:00','2027-01-25T09:00:00+00:00']);
  assert(base.sessions.every(x=>x.assignments[0].agreement_id===i1.agreement));
  assert.equal(base.class_assignments[0].version,1);assert.equal(base.class_version,2);
  const k=key(),made=await apply(base,k);sids=base.sessions.map(x=>x.session_id);assert.equal(made.related.length,4);
  assert.equal((await apply(base,k)).replayed,true);await fail('program_apply_v1',{preview:{id:base.id,token:'changed-token-value'}},'IDEMPOTENCY_PAYLOAD_MISMATCH',owner,k);
  await fail('program_apply_v1',{preview:token(base)},'PREVIEW_STALE');
  const cal=await must(owner,'calendar_get_v1',scope({interval:interval('2027-01-01T00:00:00Z','2027-02-01T00:00:00Z'),page:{}}));
  assert.deepEqual(cal.items.map(x=>x.id),sids);assert.equal((await get(sids[0])).assignments[0].person_id,i1.p);
  assert.equal((await get(sids[0],i1.u)).id,sids[0]);assert(!('class_assignments' in await get(sids[0],i1.u)));
  assert.deepEqual((await must(i1.u,'reservation_list_v1',scope({session_id:sids[0],page:{}}))).items,[]);
  assert.equal((await rows('select count(*)::int n from core.resource_bookings where org_id=$1 and session_id=any($2) and state=\'active\'',[org,sids]))[0].n,8);
 });
 await t.test('role/tenant scopes, wrong actor and wrong center cannot apply or replay a program',async()=>{
  const cl=await cls('Authority'),p=await preview(cl,spec({local_start:'18:00:00'}));
  for(const u of [student.u,i1.u,staff.u])await fail('program_preview_v1',{class_id:cl,schedule:spec()},'FORBIDDEN',u);
  await fail('program_preview_v1',{class_id:cl,schedule:spec()},'NOT_FOUND',outsider);
  await fail('program_preview_v1',{center_id:c2,class_id:cl,schedule:spec()},'NOT_FOUND');
  await fail('program_preview_v1',{center_id:c2,class_id:cl,schedule:spec()},'FORBIDDEN',cm.u);
  await fail('program_apply_v1',{preview:token(p)},'PREVIEW_STALE',cm.u);
  await fail('program_apply_v1',{center_id:c2,preview:token(p)},'PREVIEW_STALE');
  const foreignAccount=await must(outsider,'account_get_v1'),foreignOrg=(await must(platform,'organization_create_v1',{verified_account_id:foreignAccount.id,name:'Foreign program',initial_plan_id:plan},key())).primary_id;
  await fail('program_preview_v1',{org_id:foreignOrg,class_id:cl,schedule:spec()},'NOT_FOUND',outsider);
  const p2=await preview(cl,spec({local_start:'19:00:00'}),c1,cm.u),k=key();await apply(p2,k,c1,cm.u);
  await mut('center_manager_revoke_v1',{person_id:cm.p,expected_version:1,reason:'Synthetic live revoke'});
  await fail('program_apply_v1',{preview:token(p2)},'FORBIDDEN',cm.u,k);
  await fail('session_capacity_set_v1',{session_id:sids[0],expected_version:1,nominal:1,maximum:1,reason:'Denied'},'FORBIDDEN',cm.u);
  await mut('center_manager_revoke_v1',{center_id:c2,person_id:ownerPerson,expected_version:1,reason:'Owner must hold operational center role'});
  await fail('program_preview_v1',{center_id:c2,class_id:cl,schedule:spec()},'FORBIDDEN');
  await mut('center_manager_assign_v1',{center_id:c2,person_id:ownerPerson});
 });
 await t.test('stale preview detects configuration, expiration, token and session versions without partial writes',async()=>{
  const cl=await cls('Stale'),p=await preview(cl,spec({local_start:'20:00:00'}));await available('person',i2.p);
  const n=await counts();await fail('program_apply_v1',{preview:token(p)},'PREVIEW_STALE');assert.deepEqual(await counts(),n);
  const p2=await preview(cl,spec({local_start:'20:00:00'}));await db.query("update private.preview_payloads set expires_at=now()-interval '1 second' where preview_id=$1",[p2.id]);
  await fail('program_apply_v1',{preview:token(p2)},'PREVIEW_STALE');
  const p3=await change(sids[0],{capacity:{nominal:6,maximum:9}});
  await mut('session_capacity_set_v1',{session_id:sids[0],expected_version:1,nominal:7,maximum:9,reason:'Concurrent manager'});
  await fail('session_change_apply_v1',{preview:token(p3)},'PREVIEW_STALE');
 });
 await t.test('availability, legacy assignments and ordinary session writer share global resource conflict checks',async()=>{
  const cl=await cls('Conflicts'),p=await preview(cl,spec({room_id:room}));assert.equal(p.blockers[0].code,'RESOURCE_CONFLICT');
  const before=await counts();await fail('program_apply_v1',{preview:token(p)},'RESOURCE_CONFLICT');assert.deepEqual(await counts(),before);
  await fail('session_create_v1',{class_id:cl,discipline_id:discipline,format:'group',interval:interval('2027-01-04T09:15:00Z','2027-01-04T10:15:00Z'),resources:[{kind:'room',id:room}],assignments:[],capacity:{nominal:1,maximum:2}},'RESOURCE_CONFLICT');
  const adjacent=await preview(cl,spec({room_id:room,local_start:'13:00:00'}));assert.deepEqual(adjacent.blockers,[]);await apply(adjacent);
  const unavailable=(await mut('room_save_v1',{name:'No availability',capacities:[{discipline_id:discipline,nominal:8,maximum:10}]})).primary_id;
  assert.equal((await preview(cl,spec({room_id:unavailable,local_start:'16:00:00'}))).blockers[0].code,'POLICY_NOT_CONFIGURED');
  await available('room',unavailable);
  await mut('availability_exception_save_v1',{resource:{kind:'room',id:unavailable},interval:interval('2027-01-04T12:00:00Z','2027-01-04T14:00:00Z'),reason:'Synthetic exception',expected_version:Number((await rows('select version from core.centers where id=$1',[c1]))[0].version)});
  assert.equal((await preview(cl,spec({room_id:unavailable,local_start:'16:00:00'}))).blockers[0].code,'RESOURCE_CONFLICT');
 });
 await t.test('local date boundaries, DST gaps/folds and explicit offsets are deterministic',async()=>{
  const cl=await cls('Berlin DST',c2),fold=spec({weekdays:[7],local_start:'02:30:00',duration_minutes:15,starts_on:'2027-10-31',ends_on:'2027-11-01'});
  await fail('program_preview_v1',{center_id:c2,class_id:cl,schedule:{...fold,starts_on:'2027-03-28',ends_on:'2027-03-29'}},'VALIDATION_FAILED');
  await fail('program_preview_v1',{center_id:c2,class_id:cl,schedule:fold},'VALIDATION_FAILED');
  await fail('program_preview_v1',{center_id:c2,class_id:cl,schedule:{...fold,offset_choices:[{date:'2027-10-31',offset_minutes:90}]}},'VALIDATION_FAILED');
  const p=await preview(cl,{...fold,offset_choices:[{date:'2027-10-31',offset_minutes:120}]},c2);assert.deepEqual(p.blockers,[]);assert.equal(Date.parse(p.sessions[0].interval.starts_at),Date.parse('2027-10-31T00:30:00Z'));await apply(p,key(),c2);
  const p2=await preview(cl,{...fold,offset_choices:[{date:'2027-10-31',offset_minutes:60}]},c2);assert.equal(Date.parse(p2.sessions[0].interval.starts_at),Date.parse('2027-10-31T01:30:00Z'));await apply(p2,key(),c2);
  await fail('program_preview_v1',{class_id:class1,schedule:spec({local_start:'25:00:00'})},'VALIDATION_FAILED');
  await fail('program_preview_v1',{class_id:class1,schedule:spec({starts_on:'2027-02-01',ends_on:'2027-01-01'})},'VALIDATION_FAILED');
  const transition=await preview(cl,spec({weekdays:[7],local_start:'12:00:00',starts_on:'2027-03-21',ends_on:'2027-04-05'}),c2);assert.deepEqual(transition.sessions.map(x=>new Date(x.interval.starts_at).getUTCHours()),[11,10,10]);await apply(transition,key(),c2);
  const anchor=transition.sessions[0].session_id;
  const cp=await must(owner,'session_change_preview_v1',scope({center_id:c2,session_id:anchor,patch:{interval:interval('2027-03-21T12:00:00Z','2027-03-21T13:00:00Z')},scope:'this_and_future',reason:'Wall time shift'}));
  assert.deepEqual(cp.sessions.map(x=>new Date(x.interval.starts_at).getUTCHours()),[12,11,11]);await mut('session_change_apply_v1',{center_id:c2,preview:token(cp)});
 });
 await t.test('idempotent concurrent program apply and optimistic session writes admit one committed effect',async()=>{
  const cl=await cls('Races'),p=await preview(cl,spec({local_start:'21:00:00'})),k=key();
  const replies=await Promise.all([apply(p,k),apply(p,k)]);assert.equal(replies.filter(x=>x.replayed).length,1);assert.equal(replies[0].primary_id,replies[1].primary_id);
  const id=p.sessions[0].session_id,results=await Promise.all([1,2].map(n=>req('session_capacity_set_v1',{session_id:id,expected_version:1,nominal:n,maximum:n,reason:'Version race'})));
  assert.equal(results.filter(x=>x.result.ok).length,1,JSON.stringify(results));assert.equal(results.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');assert.equal((await get(id)).version,2);
  const p2=await preview(cl,spec({local_start:'22:00:00'})),r=await Promise.all([req('program_apply_v1',{preview:token(p2)}),req('program_apply_v1',{preview:token(p2)})]);assert.equal(r.filter(x=>x.result.ok).length,1);assert.equal(r.find(x=>!x.result.ok).result.error.code,'PREVIEW_STALE');
 });
 await t.test('late failure rolls back complete program, preview state, receipt, audit and outbox; same key retries',async()=>{
  const cl=await cls('Rollback'),p=await preview(cl,spec({local_start:'23:00:00'})),before=await counts(),k=key();
  await inject('program_apply_v1');await fail('program_apply_v1',{preview:token(p)},'INTEGRITY_VIOLATION',owner,k);
  assert.deepEqual(await counts(),before);assert.equal((await rows('select state from core.previews where id=$1',[p.id]))[0].state,'current');
  assert.equal((await rows('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')]))[0].n,0);
  await clearFault();assert.equal((await apply(p,k)).related.length,4);
 });
 let reservation,sale;
 await t.test('existing reservation and entitlement identity survive single time/resource edits and capacity below occupancy',async()=>{
  await mut('policy_publish_v1',{center_id:null,key:'student_cancel_group',mandatory:true,effective_at:'2020-01-01T00:00:00Z',value:{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'consume',no_show:'consume'}}});
  await mut('policy_publish_v1',{center_id:null,key:'reservation_window',mandatory:true,effective_at:'2020-01-01T00:00:00Z',value:{kind:'window',opens_minutes_before:10000000,closes_minutes_before:0,manager_exception:false}});
  const terms={name:'Program synthetic credits',kind:'credits',booking_mode:'flexible',credits:10,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
  const pv=(await mut('product_publish_v1',{terms})).primary_id,p=await mut('sale_preview_v1',{person_id:student.p,product_version_id:pv,start_date:'2027-01-01',end_date:'2027-02-15'});sale=(await mut('sale_apply_v1',{preview:token(p)})).primary_id;
  reservation=(await mut('reservation_create_v1',{session_id:sids[0],person_id:student.p,mode:'flexible',source_sale_id:sale})).primary_id;
  const before=await ledger(),s=await get(sids[0]),cp=await change(sids[0],{interval:interval('2027-01-04T08:00:00Z','2027-01-04T09:00:00Z')});
  assert.deepEqual(cp.blockers,[]);await applyChange(cp);assert.equal((await get(sids[0])).version,s.version+1);assert.equal((await get(sids[1])).version,1);
  assert.deepEqual(await ledger(),before);assert.equal((await rows('select session_id,state from core.reservations where id=$1',[reservation]))[0].session_id,sids[0]);
  const v=await get(sids[0]);await mut('session_capacity_set_v1',{session_id:sids[0],expected_version:v.version,nominal:0,maximum:0,reason:'Preserve existing reservation'});
  assert.equal((await rows('select state from core.reservations where id=$1',[reservation]))[0].state,'active');assert.deepEqual(await ledger(),before);
  const other=await person('program-second-student');await fail('reservation_create_v1',{session_id:sids[0],person_id:other.p,mode:'flexible',source_sale_id:sale},'CAPACITY_FULL');
  const tooLate=await change(sids[0],{interval:interval('2027-03-01T08:00:00Z','2027-03-01T09:00:00Z')});assert.equal(tooLate.blockers[0].code,'ENTITLEMENT_UNAVAILABLE');
  const beforeFail=await counts();await fail('session_change_apply_v1',{preview:token(tooLate)},'ENTITLEMENT_UNAVAILABLE');assert.deepEqual(await counts(),beforeFail);assert.deepEqual(await ledger(),before);
  const own=await must(student.u,'reservation_list_v1',scope({page:{}}));assert.equal(own.items[0].id,reservation);assert.equal((await get(sids[0],student.u)).starts_at,'2027-01-04T08:00:00+00:00');
 });
 await t.test('session and class duty changes validate agreements, preserve explicit overrides, and never grant login roles',async()=>{
  const cl=await cls('Duty changes'),p=await preview(cl,spec({local_start:'15:00:00',assignments:[{person_id:i2.p,duty:'instructor'}]}));await apply(p);
  const ids=p.sessions.map(x=>x.session_id),a=await mut('class_assignment_set_v1',{class_id:cl,person_id:assistant.p,duty:'assistant'});
  assert.equal(a.related.length,4);assert((await get(ids[0])).assignments.some(x=>x.person_id===assistant.p));
  await fail('class_assignment_set_v1',{class_id:cl,person_id:assistant.p,duty:'assistant'},'VERSION_CONFLICT');
  await fail('class_assignment_set_v1',{class_id:cl,person_id:i1.p,duty:'assistant',expected_version:1},'VERSION_CONFLICT');
  let s=await get(ids[0]);await mut('session_assignment_set_v1',{session_id:ids[0],expected_version:s.version,person_id:assistant.p,duty:'assistant',state:'inactive'});
  assert(!(await get(ids[0])).assignments.some(x=>x.person_id===assistant.p));
  await mut('class_assignment_set_v1',{class_id:cl,person_id:assistant.p,duty:'assistant',state:'inactive',expected_version:1});
  await mut('class_assignment_set_v1',{class_id:cl,person_id:assistant.p,duty:'assistant',state:'active',expected_version:2});
  assert(!(await get(ids[0])).assignments.some(x=>x.person_id===assistant.p));assert((await get(ids[1])).assignments.some(x=>x.person_id===assistant.p));
  const cp=await change(ids[1],{assignments:[]});assert.deepEqual(cp.blockers,[]);await applyChange(cp);
  await mut('class_assignment_set_v1',{class_id:cl,person_id:assistant.p,duty:'assistant',state:'inactive',expected_version:3});assert.deepEqual((await get(ids[1])).assignments,[]);
  s=await get(ids[1]);const noPay=await person('program-no-agreement');await available('person',noPay.p);
  await fail('session_assignment_set_v1',{session_id:ids[1],expected_version:s.version,person_id:noPay.p,duty:'instructor'},'POLICY_NOT_CONFIGURED');
  await fail('session_assignment_set_v1',{session_id:ids[1],expected_version:s.version,person_id:i2.p,duty:'instructor',agreement_id:i1.agreement},'POLICY_NOT_CONFIGURED');
  const offline=await person('program-offline');await available('person',offline.p);await mut('session_assignment_set_v1',{session_id:ids[1],expected_version:s.version,person_id:offline.p,duty:'assistant'});
  assert.equal((await rows("select count(*)::int n from core.role_assignments where org_id=$1 and person_id=$2 and state='active'",[org,offline.p]))[0].n,0);
  const v=(await get(sids[0])).version;await available('person',student.p);await fail('session_assignment_set_v1',{session_id:sids[0],expected_version:v,person_id:student.p,duty:'assistant'},'ASSISTANT_PARTICIPANT_CONFLICT');
 });
 await t.test('class batch failure restores class, assignments and every occurrence version',async()=>{
  const cl=await cls('Class rollback'),p=await preview(cl,spec({local_start:'17:00:00'}));await apply(p);
  const before=await rows('select id,version,assignment_mode from core.sessions where org_id=$1 and class_id=$2 order by id',[org,cl]),classBefore=await rows('select version from core.classes where id=$1',[cl]),n=await counts(),k=key();
  await inject('class_assignment_set_v1');await fail('class_assignment_set_v1',{class_id:cl,person_id:assistant.p,duty:'assistant'},'INTEGRITY_VIOLATION',owner,k);
  assert.deepEqual(await counts(),n);assert.deepEqual(await rows('select id,version,assignment_mode from core.sessions where org_id=$1 and class_id=$2 order by id',[org,cl]),before);assert.deepEqual(await rows('select version from core.classes where id=$1',[cl]),classBefore);
  await clearFault();assert.equal((await mut('class_assignment_set_v1',{class_id:cl,person_id:assistant.p,duty:'assistant'},k)).related.length,4);
 });
 await t.test('this-and-future protects terminal/past rows and late occurrence conflicts roll back the whole set',async()=>{
  const cl=await cls('Future changes'),p=await preview(cl,spec({local_start:'10:00:00'}));await apply(p);const ids=p.sessions.map(x=>x.session_id);
  await db.query("update core.sessions set attendance_state='closed' where id=$1",[ids[3]]);
  const cp=await change(ids[0],{interval:interval('2027-01-04T08:00:00Z','2027-01-04T09:00:00Z')},'this_and_future');assert.equal(cp.sessions.length,3);await applyChange(cp);
  assert.equal((await get(ids[3])).version,1);
  const standalone=(await session(null,'2027-02-08T09:00:00Z')).primary_id;
  await fail('session_change_preview_v1',{session_id:standalone,patch:{capacity:{nominal:1,maximum:1}},scope:'this_and_future',reason:'Unconfigured series'},'POLICY_NOT_CONFIGURED');
  await db.query("update core.sessions set starts_at='2020-01-01',ends_at='2020-01-01 01:00Z' where id=$1",[standalone]);
  await fail('session_capacity_set_v1',{session_id:standalone,expected_version:1,nominal:1,maximum:1,reason:'Past'},'INVALID_STATE_TRANSITION');
  const before=await rows('select id,starts_at,version from core.sessions where class_id=$1 order by id',[cl]);
  const blocked=await change(ids[0],{resources:[{kind:'room',id:room}],interval:interval('2027-01-04T09:00:00Z','2027-01-04T10:00:00Z')},'this_and_future');assert.equal(blocked.blockers[0].code,'RESOURCE_CONFLICT');
  await fail('session_change_apply_v1',{preview:token(blocked)},'RESOURCE_CONFLICT');assert.deepEqual(await rows('select id,starts_at,version from core.sessions where class_id=$1 order by id',[cl]),before);
 });

 await t.test('timed quota is checked against the whole proposal and old/new buckets track time moves without changing allocations',async()=>{
  const cl=await cls('Quota moves'),learner=await person('program-quota-student'),p=await preview(cl,spec({local_start:'06:00:00',ends_on:'2027-01-18'}));await apply(p);const ids=p.sessions.map(x=>x.session_id);
  const terms={name:'Program weekly quota',kind:'timed',booking_mode:'flexible',credits:null,quota:{period:'week',limit:1},price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
  const pv=(await mut('product_publish_v1',{terms})).primary_id,sp=await mut('sale_preview_v1',{person_id:learner.p,product_version_id:pv,start_date:'2027-01-01',end_date:'2027-02-15'}),saleId=(await mut('sale_apply_v1',{preview:token(sp)})).primary_id;
  for(const id of ids)await mut('reservation_create_v1',{session_id:id,person_id:learner.p,mode:'flexible',source_sale_id:saleId});
  const before=await ledger(),blocked=await change(ids[1],{interval:interval('2027-01-05T03:00:00Z','2027-01-05T04:00:00Z')});assert.equal(blocked.blockers[0].code,'QUOTA_EXCEEDED');
  const snapshot=await counts();await fail('session_change_apply_v1',{preview:token(blocked)},'QUOTA_EXCEEDED');assert.deepEqual(await counts(),snapshot);assert.deepEqual(await ledger(),before);
  const valid=await change(ids[1],{interval:interval('2027-01-18T03:00:00Z','2027-01-18T04:00:00Z')});assert.deepEqual(valid.blockers,[]);await applyChange(valid);assert.deepEqual(await ledger(),before);
  const buckets=await rows('select starts_at,reserved_count,consumed_count,version from core.quota_buckets where org_id=$1 and sale_id=$2 order by starts_at',[org,saleId]);
  assert.deepEqual(buckets.map(x=>Number(x.reserved_count)),[1,0,1]);assert(buckets.every(x=>Number(x.consumed_count)===0));
  const v=(await get(ids[1])).version;await mut('session_capacity_set_v1',{session_id:ids[1],expected_version:v,nominal:0,maximum:0,reason:'No quota side effect'});
  assert.deepEqual(await rows('select starts_at,reserved_count,consumed_count,version from core.quota_buckets where org_id=$1 and sale_id=$2 order by starts_at',[org,saleId]),buckets);
  // A bulk shift crosses buckets only after all target times have changed.
  const both=await change(ids[0],{interval:interval('2027-01-11T03:00:00Z','2027-01-11T04:00:00Z')},'this_and_future');assert.deepEqual(both.blockers,[]);await applyChange(both);assert.deepEqual(await ledger(),before);
 });
 await t.test('late session change failure restores all existing reservations, rights, versions and preview; retry succeeds',async()=>{
  const v=await get(sids[0]),p=await change(sids[0],{interval:interval('2027-01-04T07:00:00Z','2027-01-04T08:00:00Z')},'this_and_future');assert.deepEqual(p.blockers,[]);
  const before=await rows('select id,starts_at,ends_at,version from core.sessions where id=any($1) order by id',[sids]),alloc=await ledger(),n=await counts(),k=key();
  await inject('session_change_apply_v1');await fail('session_change_apply_v1',{preview:token(p)},'INTEGRITY_VIOLATION',owner,k);
  assert.deepEqual(await rows('select id,starts_at,ends_at,version from core.sessions where id=any($1) order by id',[sids]),before);assert.deepEqual(await ledger(),alloc);assert.deepEqual(await counts(),n);assert.equal((await rows('select state from core.previews where id=$1',[p.id]))[0].state,'current');
  await clearFault();const a=await applyChange(p,k);assert.equal(a.related.length,4);assert.equal((await get(sids[0])).version,v.version+1);assert.deepEqual(await ledger(),alloc);
 });
 await t.test('global person conflicts include other centers and legacy duties; missing and expired agreements block',async()=>{
  const cl=await cls('Legacy conflicts'),legacy=key();
  await db.query("insert into core.sessions(id,org_id,center_id,class_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,$5,'group','2027-02-08T09:00:00Z','2027-02-08T10:00:00Z',8,10,'planned','open')",[legacy,org,c1,cl,discipline]);
  await db.query("insert into core.session_assignments(id,org_id,center_id,session_id,person_id,duty,state) values($1,$2,$3,$4,$5,'instructor','active')",[key(),org,c1,legacy,i1.p]);
  const p=await preview(cl,spec({starts_on:'2027-02-08',ends_on:'2027-02-09',assignments:[{person_id:i1.p,duty:'instructor'}]}));assert.equal(p.blockers[0].code,'RESOURCE_CONFLICT');
  await mut('student_activate_v1',{center_id:c2,person_id:i1.p});await available('person',i1.p,c2);const foreignClass=await cls('Other center conflict',c2);
  const p2=await preview(foreignClass,spec({starts_on:'2027-02-08',ends_on:'2027-02-09',local_start:'10:00:00',assignments:[{person_id:i1.p,duty:'assistant'}]}),c2);assert.equal(p2.blockers[0].code,'RESOURCE_CONFLICT');
  const noAgreement=await person('program-missing-pay');await available('person',noAgreement.p);
  const p3=await preview(cl,spec({starts_on:'2027-02-15',ends_on:'2027-02-16',assignments:[{person_id:noAgreement.p,duty:'instructor'}]}));assert.equal(p3.blockers[0].code,'POLICY_NOT_CONFIGURED');
  const limited=await person('program-finite-agreement');await available('person',limited.p);
  await db.query("insert into core.instructor_agreements(id,org_id,center_id,person_id,discipline_id,format,valid_from,valid_until,model,terms,state) select $1,org_id,center_id,$2,discipline_id,format,valid_from,'2027-02-01',model,terms,state from core.instructor_agreements where id=$3",[key(),limited.p,i1.agreement]);
  const p4=await preview(cl,spec({starts_on:'2027-02-01',ends_on:'2027-02-02',assignments:[{person_id:limited.p,duty:'instructor'}]}));assert.equal(p4.blockers[0].code,'POLICY_NOT_CONFIGURED');
 });
 await t.test('late default conflict leaves no partial class duty or earlier occurrence update',async()=>{
  const cl=await cls('Late class blocker'),p=await preview(cl,spec({local_start:'05:00:00'}));await apply(p);
  await session(null,'2027-01-25T02:00:00Z',{assignments:[{person_id:assistant.p,duty:'assistant'}]});
  const before=await rows('select id,version from core.sessions where class_id=$1 order by id',[cl]),n=await counts();
  await fail('class_assignment_set_v1',{class_id:cl,person_id:assistant.p,duty:'assistant'},'RESOURCE_CONFLICT');
  assert.deepEqual(await counts(),n);assert.deepEqual(await rows('select id,version from core.sessions where class_id=$1 order by id',[cl]),before);assert.deepEqual(await rows('select id from core.class_assignments where class_id=$1',[cl]),[]);
 });
 await t.test('preview/apply racing a source exception serializes into success-before-config or stale; no partial program',async()=>{
  const cl=await cls('Source config race'),r=(await mut('room_save_v1',{name:'Race room',capacities:[{discipline_id:discipline,nominal:8,maximum:10}]})).primary_id;await available('room',r);
  const p=await preview(cl,spec({local_start:'04:00:00',room_id:r})),v=Number((await rows('select version from core.centers where id=$1',[c1]))[0].version);
  const results=await Promise.all([req('program_apply_v1',{preview:token(p)}),req('availability_exception_save_v1',{resource:{kind:'room',id:r},interval:interval('2027-01-04T01:00:00Z','2027-01-04T02:00:00Z'),reason:'Concurrent configuration',expected_version:v})]);
  assert.equal(results[1].result.ok,true,JSON.stringify(results));assert(results[0].result.ok||results[0].result.error.code==='PREVIEW_STALE',JSON.stringify(results));
  assert.equal((await rows('select count(*)::int n from core.sessions where id=any($1)',[p.sessions.map(x=>x.session_id)]))[0].n,results[0].result.ok?4:0);
 });
 await t.test('explicit anchor offset and future ambiguous local time choices are checked; invalid capacities cannot mutate',async()=>{
  const cl=await cls('Fold shifts',c2),p=await preview(cl,spec({weekdays:[7],local_start:'01:30:00',starts_on:'2027-10-24',ends_on:'2027-11-01'}),c2);await apply(p,key(),c2);
  const b={center_id:c2,session_id:p.sessions[0].session_id,patch:{interval:interval('2027-10-24T00:30:00Z','2027-10-24T01:30:00Z')},scope:'this_and_future',reason:'Explicit fold'};
  await fail('session_change_preview_v1',b,'VALIDATION_FAILED');
  await fail('session_change_preview_v1',{...b,offset_choices:[{date:'2027-10-24',offset_minutes:60},{date:'2027-10-31',offset_minutes:60}]},'VALIDATION_FAILED');
  const cp=await must(owner,'session_change_preview_v1',scope({...b,offset_choices:[{date:'2027-10-24',offset_minutes:120},{date:'2027-10-31',offset_minutes:60}]}));assert.deepEqual(cp.blockers,[]);assert.equal(Date.parse(cp.sessions[1].interval.starts_at),Date.parse('2027-10-31T01:30:00Z'));await mut('session_change_apply_v1',{center_id:c2,preview:token(cp)});
  const v=(await get(sids[0])).version;
  await fail('session_capacity_set_v1',{session_id:sids[0],expected_version:v,nominal:2,maximum:1,reason:'Invalid'},'VALIDATION_FAILED');
  await fail('session_capacity_set_v1',{session_id:sids[0],expected_version:v,nominal:-1,maximum:1,reason:'Invalid'},'VALIDATION_FAILED');
  assert.equal((await get(sids[0])).version,v);
 });

 await t.test('legacy class defaults materialize together on time edits and explicit overrides stop calendar fallback',async()=>{
  const cl=await cls('Legacy class defaults'),id=key();
  await db.query("insert into core.sessions(id,org_id,center_id,class_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,$5,'group','2027-02-22T09:00:00Z','2027-02-22T10:00:00Z',8,10,'planned','open')",[id,org,c1,cl,discipline]);
  for(const [personId,duty] of [[i1.p,'instructor'],[assistant.p,'assistant']])await db.query("insert into core.class_assignments(id,org_id,center_id,class_id,person_id,duty,state) values($1,$2,$3,$4,$5,$6,'active')",[key(),org,c1,cl,personId,duty]);
  const other=await cls('Legacy duty blocker'),p=await preview(other,spec({starts_on:'2027-02-22',ends_on:'2027-02-23',assignments:[{person_id:i1.p,duty:'instructor'}]}));assert.equal(p.blockers[0].code,'RESOURCE_CONFLICT');
  const direct=key();await db.query("insert into core.sessions(id,org_id,center_id,class_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,$5,'group','2027-02-23T10:00:00Z','2027-02-23T11:00:00Z',8,10,'planned','open')",[direct,org,c1,cl,discipline]);
  assert.equal((await get(direct,i1.u)).id,direct);
  const removed=await mut('session_assignment_set_v1',{session_id:direct,person_id:i1.p,duty:'instructor',state:'inactive',expected_version:1});assert.equal(removed.version,2);
  await fail('session_get_v1',{session_id:direct},'NOT_FOUND',i1.u);assert.deepEqual((await get(direct)).assignments.map(x=>x.person_id),[assistant.p]);
  const tombstone=(await rows("select state,origin_class_assignment_id from core.session_assignments where session_id=$1 and person_id=$2",[direct,i1.p]))[0];assert.deepEqual(tombstone,{state:'inactive',origin_class_assignment_id:null});
  await mut('class_assignment_set_v1',{class_id:cl,person_id:i1.p,duty:'instructor',state:'inactive',expected_version:1});
  await mut('class_assignment_set_v1',{class_id:cl,person_id:i1.p,duty:'instructor',state:'active',expected_version:2});
  assert(!(await get(direct)).assignments.some(x=>x.person_id===i1.p));await fail('session_get_v1',{session_id:direct},'NOT_FOUND',i1.u);
  const cp=await change(id,{interval:interval('2027-02-22T10:00:00Z','2027-02-22T11:00:00Z')});assert.deepEqual(cp.blockers,[]);assert.equal(cp.sessions[0].assignments.length,2);await applyChange(cp);
  assert.equal((await get(id)).assignments.length,2);assert.equal((await rows('select assignment_mode from core.sessions where id=$1',[id]))[0].assignment_mode,'inherit');
  const explicit=await change(id,{assignments:[]});await applyChange(explicit);await fail('session_get_v1',{session_id:id},'NOT_FOUND',i1.u);
  const cal=await must(owner,'calendar_get_v1',scope({interval:interval('2027-02-22T00:00:00Z','2027-02-23T00:00:00Z'),resource:{kind:'person',id:i1.p},page:{}}));assert(!cal.items.some(x=>x.id===id));
 });
 await t.test('P02 center cancellation previews, protects source freshness, releases rights atomically and creates an empty linked replacement',async()=>{
  const id=sids[0],request={session_id:id,reason:'Center explicit cancellation'},cp=()=>must(owner,'session_cancel_preview_v1',scope(request)),applyCancel=(p,k=key(),u=owner)=>mut('session_cancel_apply_v1',{preview:token(p)},k,u);
  await fail('session_cancel_preview_v1',request,'FORBIDDEN',staff.u);
  const before=await counts(),p=await cp();assert.deepEqual(await counts(),before);assert(p.effects.some(e=>e.entity.id===reservation&&e.action==='cancel'));
  await fail('session_cancel_apply_v1',{preview:token(p)},'FORBIDDEN',cm.u);
  await fail('session_cancel_apply_v1',{center_id:c2,preview:token(p)},'PREVIEW_STALE');
  await db.query('update core.reservations set version=version+1 where id=$1',[reservation]);await fail('session_cancel_apply_v1',{preview:token(p)},'PREVIEW_STALE');
  const p2=await cp(),k=key(),beforeFault=await counts();await inject('session_cancel_apply_v1');
  await fail('session_cancel_apply_v1',{preview:token(p2)},'INTEGRITY_VIOLATION',owner,k);assert.deepEqual(await counts(),beforeFault);assert.equal((await get(id)).state,'planned');await clearFault();
  const outcomes=await Promise.all([req('session_cancel_apply_v1',{preview:token(p2)},owner,k),req('session_cancel_apply_v1',{preview:token(p2)},owner,k)]);assert.equal(outcomes[0].result.ok,true,JSON.stringify(outcomes));assert.equal(outcomes[1].result.ok,true,JSON.stringify(outcomes));
  assert.equal((await applyCancel(p2,k)).replayed,true);assert.equal((await get(id)).state,'cancelled');
  assert.equal((await rows('select state from core.reservations where id=$1',[reservation]))[0].state,'cancelled');assert((await ledger()).filter(a=>a.reservation_id===reservation).every(a=>a.state==='released'));
  assert.equal((await rows("select count(*)::int n from core.notifications where org_id=$1 and subject_id=$2 and recipient_person_id=$3 and kind='session_cancelled_by_center'",[org,id,student.p]))[0].n,1);
  const replacement={replaces_id:id,interval:interval('2027-02-10T11:00:00Z','2027-02-10T12:00:00Z'),resources:[],capacity:{nominal:8,maximum:10}},rk=key();
  await fail('replacement_session_create_v1',{...replacement,center_id:c2},'NOT_FOUND');
  const made=await mut('replacement_session_create_v1',replacement,rk);assert.equal((await mut('replacement_session_create_v1',replacement,rk)).replayed,true);
  assert.equal((await rows('select replaces_id from core.sessions where id=$1',[made.primary_id]))[0].replaces_id,id);assert.equal((await rows('select count(*)::int n from core.reservations where session_id=$1',[made.primary_id]))[0].n,0);
  await fail('replacement_session_create_v1',{...replacement,replaces_id:made.primary_id},'INVALID_STATE_TRANSITION');
 });
 await t.test('P02 credit correction and explicit extension consume exact impact approval once and keep confirmed obligations',async()=>{
  const sid=(await session(null,'2027-02-11T11:00:00Z')).primary_id,rid=(await mut('reservation_create_v1',{session_id:sid,person_id:student.p,mode:'flexible',source_sale_id:sale})).primary_id;
  const reason='Explicit synthetic correction',change={kind:'credit_adjust',sale_id:sale,quantity:10,direction:'decrease'},previewImpact=change=>must(owner,'reservation_impact_preview_v1',scope({change,reason}));
  const dep=(await rows('select private.p02_dependencies($1,$2,$3,$4) value',[org,c1,account.id,sale]))[0].value;assert(dep.versions.some(x=>x.entity.id===sale));
  const p=await previewImpact(change);assert(p.affected.some(x=>x.reservation_id===rid));assert.equal(p.preserves_reservations,true);
  const request={sale_id:sale,quantity:10,direction:'decrease',reason,impact_approval:token(p.preview),accepted_reservation_ids:p.affected.map(x=>x.reservation_id)};
  await fail('credit_adjust_v1',{...request,quantity:9},'PREVIEW_STALE');await fail('credit_adjust_v1',{...request,accepted_reservation_ids:[]},'VALIDATION_FAILED');
  const k=key(),before=await counts();await inject('credit_adjust_v1');await fail('credit_adjust_v1',request,'INTEGRITY_VIOLATION',owner,k);assert.deepEqual(await counts(),before);await clearFault();await mut('credit_adjust_v1',request,k);assert.equal((await mut('credit_adjust_v1',request,k)).replayed,true);
  await fail('reservation_impact_apply_v1',{preview:token(p.preview),accepted_reservation_ids:request.accepted_reservation_ids},'PREVIEW_STALE');assert.equal((await rows('select state from core.reservations where id=$1',[rid]))[0].state,'active');
  const increase=await previewImpact({...change,quantity:3,direction:'increase'});await mut('reservation_impact_apply_v1',{preview:token(increase.preview),accepted_reservation_ids:[]});
  const ext={kind:'entitlement_extend',sale_id:sale,end_date:'2027-03-01'},e=await previewImpact(ext),view=(await must(owner,'entitlements_get_v1',scope({person_id:student.p}))).find(x=>x.sale_id===sale);assert.equal(view.version>1,true);
  const extend={sale_id:sale,expected_version:view.version,end_date:ext.end_date,reason,impact_approval:token(e.preview),accepted_reservation_ids:[]};
  await fail('entitlement_extend_v1',{...extend,expected_version:1},'VERSION_CONFLICT');await mut('entitlement_extend_v1',extend);
  const after=(await must(owner,'entitlements_get_v1',scope({person_id:student.p}))).find(x=>x.sale_id===sale);assert.equal(after.end_date,'2027-03-01');assert.equal(after.available,2);assert.equal(after.reserved,1);assert.equal(after.sale_state,'active');
  await fail('reservation_impact_preview_v1',{change:{...ext,end_date:'2026-01-01'},reason},'VALIDATION_FAILED');
 });
 await t.test('P02 freeze and reasoned early end preserve reservations, block new rights and extend only local frozen days',async()=>{
  const learner=await person('p02-freeze-student'),terms={name:'Freeze credits',kind:'credits',booking_mode:'flexible',credits:8,price_minor:'800',currency:'TRY',freeze:{enabled:true,extends_validity:true,max_days:30},refund:{method:'credit_ratio'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
  const pv=(await mut('product_publish_v1',{terms})).primary_id,sp=await must(owner,'sale_preview_v1',scope({person_id:learner.p,product_version_id:pv,start_date:'2027-03-01',end_date:'2027-04-01'})),sold=(await mut('sale_apply_v1',{preview:token(sp)})).primary_id;
  const sid=(await session(null,'2027-03-12T11:00:00Z')).primary_id,rid=(await mut('reservation_create_v1',{session_id:sid,person_id:learner.p,mode:'flexible',source_sale_id:sold})).primary_id;
  const request={sale_id:sold,dates:{start_date:'2027-03-10',end_date:'2027-03-20'},reason:'Explicit freeze'},before=await ledger(),p=await must(owner,'freeze_preview_v1',scope(request));assert(p.effects.some(x=>x.entity.id===rid));assert.deepEqual(await ledger(),before);
  await fail('freeze_preview_v1',{...request,center_id:c2},'NOT_FOUND');await fail('freeze_preview_v1',request,'FORBIDDEN',staff.u);
  const k=key(),f=await mut('freeze_apply_v1',{preview:token(p)},k);assert.equal((await mut('freeze_apply_v1',{preview:token(p)},k)).replayed,true);assert.deepEqual(await ledger(),before);assert.equal((await rows('select state from core.reservations where id=$1',[rid]))[0].state,'active');
  const view=()=>must(owner,'entitlements_get_v1',scope({person_id:learner.p}));let v=(await view()).find(x=>x.sale_id===sold);assert.equal(v.end_date,'2027-04-11');assert.equal(v.freezes[0].id,f.primary_id);
  const blocked=(await session(null,'2027-03-13T11:00:00Z')).primary_id;await fail('reservation_create_v1',{session_id:blocked,person_id:learner.p,mode:'flexible',source_sale_id:sold},'ENTITLEMENT_UNAVAILABLE');
  const end={freeze_id:f.primary_id,end_date:'2027-03-15',reason:'Explicit early end'},e=await must(owner,'freeze_end_preview_v1',scope(end));await mut('freeze_end_apply_v1',{preview:token(e)});v=(await view()).find(x=>x.sale_id===sold);assert.equal(v.end_date,'2027-04-06');assert.equal(v.freezes[0].actual_end,'2027-03-14T21:00:00+00:00');assert.deepEqual(await ledger(),before);
  const resourceOnly=await change(sid,{resources:[]});assert.deepEqual(resourceOnly.blockers,[]);await applyChange(resourceOnly);
  await mut('attendance_start_v1',{session_id:sid,expected_version:(await get(sid)).version,actual_started_at:new Date(Date.now()-1000).toISOString(),reason:'Explicit start of protected frozen obligation'});
  await mut('attendance_mark_v1',{reservation_id:rid,expected_version:Number((await rows('select version from core.reservations where id=$1',[rid]))[0].version),result:'attended'});await mut('attendance_close_v1',{session_id:sid,expected_version:(await get(sid)).version,performed:false,performed_instructor_ids:[]});assert.equal((await rows('select state from core.entitlement_allocations where reservation_id=$1',[rid]))[0].state,'consumed');
  const reopened=(await session(null,'2027-03-16T11:00:00Z')).primary_id;await mut('reservation_create_v1',{session_id:reopened,person_id:learner.p,mode:'flexible',source_sale_id:sold});
  assert.equal((await rows('select paid_days from core.sales where id=$1',[sold]))[0].paid_days,31);await fail('freeze_end_apply_v1',{preview:token(e)},'PREVIEW_STALE');
  await fail('freeze_preview_v1',{...request,dates:{start_date:'2020-01-01',end_date:'2020-01-02'}},'VALIDATION_FAILED');
 });
 await t.test('P02 standalone termination preserves reservations and debt; linked renewal carries no old rights',async()=>{
  const learner=await person('p02-terminate-student'),terms={name:'Termination credits',kind:'credits',booking_mode:'flexible',credits:5,price_minor:'500',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'credit_ratio'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
  const pv=(await mut('product_publish_v1',{terms})).primary_id,sp=await must(owner,'sale_preview_v1',scope({person_id:learner.p,product_version_id:pv,start_date:'2027-04-01',end_date:'2027-05-01'})),sold=(await mut('sale_apply_v1',{preview:token(sp)})).primary_id;
  const sid=(await session(null,'2027-04-12T11:00:00Z')).primary_id,rid=(await mut('reservation_create_v1',{session_id:sid,person_id:learner.p,mode:'flexible',source_sale_id:sold})).primary_id;
  const debt=await rows('select id,amount_minor from core.debts where sale_id=$1',[sold]),p=await must(owner,'sale_terminate_preview_v1',scope({sale_id:sold,reason:'Explicit termination'})),before=await counts(),k=key();
  await inject('sale_terminate_apply_v1');await fail('sale_terminate_apply_v1',{preview:token(p)},'INTEGRITY_VIOLATION',owner,k);assert.deepEqual(await counts(),before);await clearFault();await mut('sale_terminate_apply_v1',{preview:token(p)},k);assert.equal((await mut('sale_terminate_apply_v1',{preview:token(p)},k)).replayed,true);
  assert.deepEqual(await rows('select id,amount_minor from core.debts where sale_id=$1',[sold]),debt);assert.equal((await rows('select state from core.reservations where id=$1',[rid]))[0].state,'active');assert.equal((await rows('select state from core.entitlement_allocations where reservation_id=$1',[rid]))[0].state,'reserved');
  const view=()=>must(owner,'entitlements_get_v1',scope({person_id:learner.p}));assert.equal((await view()).find(x=>x.sale_id===sold).available,0);
  const resourceOnly=await change(sid,{resources:[]});assert.deepEqual(resourceOnly.blockers,[]);await applyChange(resourceOnly);
  await mut('attendance_start_v1',{session_id:sid,expected_version:(await get(sid)).version,actual_started_at:new Date(Date.now()-1000).toISOString(),reason:'Explicit start of protected terminated obligation'});
  await mut('attendance_mark_v1',{reservation_id:rid,expected_version:Number((await rows('select version from core.reservations where id=$1',[rid]))[0].version),result:'attended'});await mut('attendance_close_v1',{session_id:sid,expected_version:(await get(sid)).version,performed:false,performed_instructor_ids:[]});assert.equal((await rows('select state from core.entitlement_allocations where reservation_id=$1',[rid]))[0].state,'consumed');
  const renewal={previous_sale_id:sold,product_version_id:pv,start_date:'2027-04-20',end_date:'2027-05-20'},n=await must(owner,'sale_renew_preview_v1',scope(renewal));assert.equal(n.sale_lifecycle.overlap_days,11);assert.equal(n.sale_lifecycle.refund,null);
  const beforeRenew=await counts();await inject('sale_renew_apply_v1');await fail('sale_renew_apply_v1',{preview:token(n)},'INTEGRITY_VIOLATION');assert.deepEqual(await counts(),beforeRenew);await clearFault();
  const renewed=await mut('sale_renew_apply_v1',{preview:token(n)});assert.equal((await rows('select previous_sale_id from core.sales where id=$1',[renewed.primary_id]))[0].previous_sale_id,sold);assert.equal((await rows('select source_sale_id from core.reservations where id=$1',[rid]))[0].source_sale_id,sold);assert.equal((await view()).find(x=>x.sale_id===renewed.primary_id).available,5);
  const eur=(await mut('product_publish_v1',{terms:{...terms,name:'Independent EUR renewal',currency:'EUR'}})).primary_id,ep=await must(owner,'sale_renew_preview_v1',scope({...renewal,previous_sale_id:renewed.primary_id,product_version_id:eur,start_date:'2027-05-20',end_date:'2027-06-20'}));assert.deepEqual(ep.blockers,[]);const eurSale=await mut('sale_renew_apply_v1',{preview:token(ep)});assert.equal((await rows('select currency from core.sales where id=$1',[eurSale.primary_id]))[0].currency,'EUR');
  await fail('sale_change_preview_v1',{sale_id:renewed.primary_id,new_product_version_id:eur,keep_reservation_ids:[],cancel_reservation_ids:[],start_date:'2027-05-20',end_date:'2027-06-20',reason:'No currency conversion'},'CURRENCY_MISMATCH');

 });
 await t.test('P02 product change previews all choices, rolls back simulation and atomically rebinds seats, debt and explicit credit offset',async()=>{
  const learner=await person('p02-change-student'),terms={name:'Change old credits',kind:'credits',booking_mode:'flexible',credits:10,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'credit_ratio'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
  const pv=(await mut('product_publish_v1',{terms})).primary_id,nextProduct=(await mut('product_publish_v1',{terms:{...terms,name:'Change next credits',credits:4,price_minor:'500'}})).primary_id,sp=await must(owner,'sale_preview_v1',scope({person_id:learner.p,product_version_id:pv,start_date:'2027-05-01',end_date:'2027-06-01'})),sold=(await mut('sale_apply_v1',{preview:token(sp)})).primary_id;
  const sid1=(await session(null,'2027-05-12T11:00:00Z')).primary_id,sid2=(await session(null,'2027-05-13T11:00:00Z')).primary_id,keep=(await mut('reservation_create_v1',{session_id:sid1,person_id:learner.p,mode:'flexible',source_sale_id:sold})).primary_id,cancel=(await mut('reservation_create_v1',{session_id:sid2,person_id:learner.p,mode:'flexible',source_sale_id:sold})).primary_id;
  const debt=(await rows('select id from core.debts where sale_id=$1',[sold]))[0].id,collect=amount=>mut('collection_record_v1',{person_id:learner.p,debt_ids:[debt],amount_minor:String(amount),currency:'TRY',occurred_at:new Date().toISOString()});await collect(300);
  const request={sale_id:sold,new_product_version_id:nextProduct,keep_reservation_ids:[keep],cancel_reservation_ids:[cancel],start_date:'2027-05-01',end_date:'2027-06-01',reason:'Explicit product change',offset_minor:'300'},previewChange=()=>must(owner,'sale_change_preview_v1',scope(request));
  await fail('sale_change_preview_v1',{...request,cancel_reservation_ids:[]},'VALIDATION_FAILED');const before=await counts(),p=await previewChange();assert.deepEqual(await counts(),before);assert.deepEqual(p.blockers,[]);assert.equal(p.sale_lifecycle.refund.calculated_minor,'1000');assert.equal(p.sale_lifecycle.refund.credit_added_minor,'300');
  await collect(100);await fail('sale_change_apply_v1',{preview:token(p)},'PREVIEW_STALE');const p2=await previewChange();assert.equal(p2.sale_lifecycle.refund.credit_added_minor,'400');
  const snapshot=async()=>({counts:await counts(),sales:await rows('select id,state,version from core.sales where org_id=$1 order by id',[org]),debt:await rows('select private.debt_remaining($1,$2)::text remaining',[org,debt]),allocations:await ledger()});
  const state=await snapshot(),k=key();await inject('sale_change_apply_v1');await fail('sale_change_apply_v1',{preview:token(p2)},'INTEGRITY_VIOLATION',owner,k);assert.deepEqual(await snapshot(),state);await clearFault();
  const changed=await mut('sale_change_apply_v1',{preview:token(p2)},k);assert.equal((await mut('sale_change_apply_v1',{preview:token(p2)},k)).replayed,true);
  assert.equal((await rows('select state,source_sale_id from core.reservations where id=$1',[keep]))[0].source_sale_id,changed.primary_id);assert.equal((await rows('select state from core.reservations where id=$1',[cancel]))[0].state,'cancelled');
  assert.equal((await rows('select state from core.sales where id=$1',[sold]))[0].state,'terminated');assert.equal((await rows('select private.debt_remaining($1,$2)::text remaining',[org,debt]))[0].remaining,'0');assert.equal((await rows("select private.student_credit_available($1,$2,$3,'TRY')::text amount",[org,c1,learner.p]))[0].amount,'100');
  const newDebt=(await rows('select id from core.debts where sale_id=$1',[changed.primary_id]))[0].id;assert.equal((await rows('select private.debt_remaining($1,$2)::text remaining',[org,newDebt]))[0].remaining,'200');assert.equal((await rows('select count(*)::int n from private.p02_sale_settlements where sale_id=$1',[sold]))[0].n,1);
  await fail('sale_change_apply_v1',{preview:token(p2)},'PREVIEW_STALE');
 });
 await t.test('P02 cancellation binds waitlist membership and closes waiting entries, live offers and their notices once',async()=>{
  const sid=(await session(null,'2027-06-12T11:00:00Z')).primary_id,one=await person('p02-wait-one'),two=await person('p02-wait-two'),three=await person('p02-wait-three');
  const join=p=>mut('waitlist_join_v1',{session_id:sid,person_id:p}),a=await join(one.p);await join(two.p);
  const offer=key();await db.query("insert into core.seat_offers(id,org_id,center_id,entry_id,session_id,person_id,expires_at,state) values($1,$2,$3,$4,$5,$6,clock_timestamp()+interval '15 minutes','active')",[offer,org,c1,a.primary_id,sid,one.p]);await db.query("update core.waitlist_entries set state='offered',version=version+1 where id=$1",[a.primary_id]);
  const body={session_id:sid,reason:'Explicit queue cancellation'},p=await must(owner,'session_cancel_preview_v1',scope(body));assert(p.effects.some(x=>x.entity.id===offer));
  await join(three.p);await fail('session_cancel_apply_v1',{preview:token(p)},'PREVIEW_STALE');const p2=await must(owner,'session_cancel_preview_v1',scope(body));await mut('session_cancel_apply_v1',{preview:token(p2)});
  assert((await rows('select state from core.waitlist_entries where session_id=$1',[sid])).every(x=>x.state==='closed'));assert.equal((await rows('select state from core.seat_offers where id=$1',[offer]))[0].state,'withdrawn');
  assert.equal((await rows("select count(*)::int n from core.notifications where org_id=$1 and subject_id=$2 and kind='session_cancelled_by_center'",[org,sid]))[0].n,3);
 });
 await t.test('P02 frozen refund methods use consumed rights and paid local days; free extensions never increase money',async()=>{
  const make=async(label,kind,refund,freeze={enabled:false,extends_validity:false},price='1000')=>{
   const learner=await person(label),terms={name:label,kind,booking_mode:'flexible',...(kind==='credits'?{credits:4}:{}),price_minor:price,currency:'TRY',freeze,refund,scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
   const pv=(await mut('product_publish_v1',{terms})).primary_id,sp=await must(owner,'sale_preview_v1',scope({person_id:learner.p,product_version_id:pv,start_date:'2027-07-01',end_date:'2027-08-01'})),sold=(await mut('sale_apply_v1',{preview:token(sp)})).primary_id;return {learner,pv,sold,terms};
  };
  const target=(await mut('product_publish_v1',{terms:{name:'Refund next',kind:'credits',booking_mode:'flexible',credits:4,price_minor:'500',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
  const previewChange=sold=>must(owner,'sale_change_preview_v1',scope({sale_id:sold,new_product_version_id:target,keep_reservation_ids:[],cancel_reservation_ids:[],start_date:'2027-07-01',end_date:'2027-08-01',reason:'Explicit frozen refund terms'}));
  const used=await make('p02-used-unit','credits',{method:'used_at_unit_price',used_unit_minor:'400'}),sid=(await session(null,'2027-07-12T11:00:00Z')).primary_id,rid=(await mut('reservation_create_v1',{session_id:sid,person_id:used.learner.p,mode:'flexible',source_sale_id:used.sold})).primary_id;
  await mut('attendance_start_v1',{session_id:sid,expected_version:(await get(sid)).version,actual_started_at:new Date(Date.now()-1000).toISOString(),reason:'Explicit early synthetic start'});
  await mut('attendance_mark_v1',{reservation_id:rid,expected_version:1,result:'no_show'});await mut('attendance_close_v1',{session_id:sid,expected_version:(await get(sid)).version,performed:false,performed_instructor_ids:[]});
  const original=await rows('select id,rights_snapshot,earnings_snapshot from core.attendance_closures where session_id=$1',[sid]);let p=await previewChange(used.sold);assert.equal(p.sale_lifecycle.refund.consumed,1);assert.equal(p.sale_lifecycle.refund.calculated_minor,'600');await mut('sale_change_apply_v1',{preview:token(p)});assert.deepEqual(await rows('select id,rights_snapshot,earnings_snapshot from core.attendance_closures where session_id=$1',[sid]),original);
  const timed=await make('p02-time-ratio','timed',{method:'time_ratio'},{enabled:true,extends_validity:true,max_days:30}),f=await must(owner,'freeze_preview_v1',scope({sale_id:timed.sold,dates:{start_date:'2027-07-10',end_date:'2027-07-17'},reason:'Free extension'}));await mut('freeze_apply_v1',{preview:token(f)});
  p=await previewChange(timed.sold);assert.equal(p.sale_lifecycle.refund.paid_days,31);assert.equal(p.sale_lifecycle.refund.calculated_minor,'1000');assert.equal((await rows('select end_date::text from core.sales where id=$1',[timed.sold]))[0].end_date,'2027-08-08');
  const localToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),day=n=>new Date(Date.parse(localToday+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const historical=await make('p02-time-elapsed','timed',{method:'time_ratio'},{enabled:true,extends_validity:true,max_days:30},'3100'),hp=await must(owner,'freeze_preview_v1',scope({sale_id:historical.sold,dates:{start_date:'2027-07-05',end_date:'2027-07-12'},reason:'Elapsed freeze fixture'})),hf=await mut('freeze_apply_v1',{preview:token(hp)});
  // Fixture represents an already completed seven-day freeze; the quote is exercised through Auth/Edge/RPC.
  await db.query("update core.sales set start_date=$2::date,end_date=$3::date,valid_from=$2::date::timestamp at time zone timezone,valid_until=$3::date::timestamp at time zone timezone,paid_days=31,version=version+1 where id=$1",[historical.sold,day(-19),day(19)]);
  await db.query("update core.freezes set starts_at=$2::date::timestamp at time zone 'Europe/Istanbul',planned_end=$3::date::timestamp at time zone 'Europe/Istanbul',actual_end=$3::date::timestamp at time zone 'Europe/Istanbul',state='ended',extension_until=$4::date::timestamp at time zone 'Europe/Istanbul',version=version+1 where id=$1",[hf.primary_id,day(-15),day(-8),day(19)]);
  const h=await must(owner,'sale_change_preview_v1',scope({sale_id:historical.sold,new_product_version_id:target,keep_reservation_ids:[],cancel_reservation_ids:[],start_date:localToday,end_date:day(31),reason:'Elapsed paid and frozen days'}));assert.equal(h.sale_lifecycle.refund.paid_days,31);assert.equal(h.sale_lifecycle.refund.unused,19);assert.equal(h.sale_lifecycle.refund.calculated_minor,'1900');
  const none=await make('p02-no-refund','credits',{method:'none'});p=await previewChange(none.sold);assert.equal(p.sale_lifecycle.refund.calculated_minor,'0');assert.equal(p.sale_lifecycle.refund.credit_added_minor,'0');
 });
 await t.test('revoked Auth session and direct authenticated RPC cannot bypass Edge',async()=>{
  const u=await authUser('program-revoked'),{env}=context();const response=await fetch(env.API_URL+'/auth/v1/logout?scope=global',{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+u.jwt}});assert(response.ok);
  const r=await req('program_preview_v1',{class_id:class1,schedule:spec()},u);assert.equal(r.result.ok,false);assert(['SESSION_REVOKED','AUTH_REQUIRED'].includes(r.result.error.code));
  const raw=await fetch(env.API_URL+'/rest/v1/rpc/program_preview_v1',{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+owner.jwt,'content-type':'application/json'},body:JSON.stringify({})});assert([401,403,404].includes(raw.status));
 });
 }finally{if(fault){await db.query('drop trigger if exists '+fault+' on core.audit_events');await db.query('drop function if exists private.'+fault+'()');}await db.end();}
});
