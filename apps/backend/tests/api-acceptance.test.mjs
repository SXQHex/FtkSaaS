import {deliverDevInvitation} from '../scripts/deliver-dev-invitations.mjs';import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';import {connect} from '../scripts/db.mjs';import {newUuidV7} from '../scripts/uuid.mjs';import {version} from 'uuid';
const key=()=>newUuidV7();
test('Real Auth → Edge UUID producer → named RPC → PostgreSQL acceptance',async t=>{
 const {platform,plan}=await fixturePlatform();const owner=await authUser('owner');const student=await authUser('student');const stranger=await authUser('stranger');
 const ownerAccount=await must(owner,'account_get_v1');const platformAccount=await must(platform,'account_get_v1');await must(student,'account_get_v1');
 const createKey=key();const orgData=await must(platform,'organization_create_v1',{verified_account_id:ownerAccount.id,name:'API '+key(),initial_plan_id:plan},createKey);
 const org=orgData.primary_id;const db=await connect();let center,ownerPerson,studentPerson,discipline,product,sale,eventA,eventB,registration;
 const scoped=(b={})=>({org_id:org,center_id:center,...b});const mutate=(u,op,b={},k=key())=>must(u,op,scoped(b),k);
 const error=async(u,op,b,code,k=key())=>{const r=await call(u,op,b,k);assert.equal(r.result.ok,false,op);assert.equal(r.result.error.code,code,JSON.stringify(r.result));return r;};
 async function persist(){fs.mkdirSync('.dev',{recursive:true});fs.writeFileSync('.dev/api-suite.json',JSON.stringify({platform,owner,student,stranger,ownerAccount,platformAccount,org,plan,center,ownerPerson,studentPerson,discipline,product,sale,eventA,eventB,registration}));}
 try{
 ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await t.test('backend-created records are UUIDv7 and bootstrap starts only after verified payment',async()=>{
  await error(owner,'account_get_v1',{client_api_version:2},'CLIENT_UPDATE_REQUIRED');
  assert.equal(version(org),7);assert.equal(version(ownerAccount.id),7);assert.equal((await must(owner,'organization_get_v1',{org_id:org})).access_mode,'bootstrap');
  await error(owner,'person_create_v1',scoped({display_name:'blocked',contacts:[]}),'SUBSCRIPTION_NOT_STARTED');
  await error(owner,'organization_create_v1',{verified_account_id:ownerAccount.id,name:'no',initial_plan_id:plan},'FORBIDDEN');
 });
 await t.test('bootstrap retry is idempotent; UUID production does not create a second organization',async()=>{
  const replay=await must(platform,'organization_create_v1',{verified_account_id:ownerAccount.id,name:(await db.query('select name from core.organizations where id=$1',[org])).rows[0].name,initial_plan_id:plan},createKey);assert.equal(replay.primary_id,org);assert.equal(replay.replayed,true);
 });
 center=(await must(owner,'center_create_v1',{org_id:org,name:'Center',timezone:'Europe/Istanbul'},key())).primary_id;await persist();
 await error(owner,'account_access_send_v1',scoped({person_id:ownerPerson}),'SUBSCRIPTION_NOT_STARTED');
 await mutate(owner,'center_manager_assign_v1',{person_id:ownerPerson});
 const pay=await mutate(owner,'saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic',occurred_at:new Date().toISOString()});
 await mutate(platform,'saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true});
 await t.test('first verified payment activates service; customer cannot verify own SaaS payment',async()=>{
  const subscription=await must(owner,'subscription_get_v1',{org_id:org});assert.equal(subscription.state,'active');assert(subscription.period_start);await error(owner,'saas_payment_verify_v1',scoped({payment_id:pay.primary_id,accepted:true}),'FORBIDDEN');
 });
 studentPerson=(await mutate(owner,'person_create_v1',{display_name:'Student',contacts:[{kind:'email',value:student.email}]})).primary_id;
 await mutate(owner,'student_activate_v1',{person_id:studentPerson});
 discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Salsa',state:'active'},key())).primary_id;
 await mutate(owner,'center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 await db.query("insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values($1,$2,$3,'student_cancel_group',now(),false,$4)",[key(),org,center,{kind:'cancellation',cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}]);
 await must(owner,'policy_publish_v1',{org_id:org,key:'reservation_window',value:{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false},effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false},key());
 await persist();
 await t.test('tenant isolation through API; request cannot impersonate an actor or platform role',async()=>{
  await error(stranger,'organization_get_v1',{org_id:org},'NOT_FOUND',undefined);
  await error(owner,'event_save_v1',scoped({actor_role:'platform'}),'VALIDATION_FAILED');
 });
 const terms={name:'One shared right',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson','event']}]};
 product=(await mutate(owner,'product_publish_v1',{terms})).primary_id;
 const dates={start_date:'2026-01-01',end_date:'2027-01-01'};
 const preview=await must(owner,'sale_preview_v1',scoped({person_id:studentPerson,product_version_id:product,...dates}));
 sale=(await mutate(owner,'sale_apply_v1',{preview:{id:preview.id,token:preview.token}})).primary_id;
 await mutate(owner,'collection_record_v1',{person_id:studentPerson,amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()});
 const eventTerms={fee_minor:'0',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[product],cancellation:{before_cutoff:'release',after_cutoff:'release',no_show:'release'},refund:{method:'none'}};
 let slot=0;
 function eventInput(extra={}){const start=Date.now()-20*86400000+(slot++)*7200000;return {name:'Event '+key(),interval:{starts_at:new Date(start).toISOString(),ends_at:new Date(start+3600000).toISOString()},timezone:'Europe/Istanbul',venue:{kind:'external',name:'Venue',address:'Synthetic',timezone:'Europe/Istanbul'},capacity:{nominal:10,maximum:10},terms:eventTerms,discipline_ids:[discipline],assignments:[{person_id:ownerPerson,duty:'instructor',fee_minor:'0',currency:'TRY'}],...extra};}
 function lessonInterval(){const d=new Date(Date.now()+86400000);d.setUTCHours(9,0,0,0);return {starts_at:d.toISOString(),ends_at:new Date(+d+3600000).toISOString()};}
 async function newEvent(extra={}){const input=eventInput(extra);const data=await mutate(owner,'event_save_v1',input);await mutate(owner,'event_publish_v1',{event_id:data.primary_id,published:true});return {id:data.primary_id,input};}
 await t.test('sale creates one shared ledger-backed right and a single account',async()=>{
  const balance=await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}));assert.equal(balance.find(x=>x.sale_id===sale).available,1);
  assert.equal((await db.query('select count(*)::int n from core.entitlement_accounts where org_id=$1 and sale_id=$2',[org,sale])).rows[0].n,1);
 });
 const a=await newEvent(),b=await newEvent();eventA=a.id;eventB=b.id;await persist();
 await t.test('event_save is versioned; read projection returns discipline IDs',async()=>{
  const view=await must(owner,'event_get_v1',scoped({event_id:eventA}));assert.deepEqual(view.discipline_ids,[discipline]);assert.equal(view.version,2);
  await error(owner,'event_save_v1',scoped({...a.input,event_id:eventA,expected_version:1}),'VERSION_CONFLICT');
 });
 await t.test('atomic event save rolls back tags, assignments, receipt and event on a late foreign-person failure',async()=>{
  const input=eventInput({assignments:[{person_id:ownerPerson,duty:'instructor',fee_minor:'0',currency:'TRY'},{person_id:newUuidV7(),duty:'assistant',fee_minor:'0',currency:'TRY'}]});const k=key();
  await error(owner,'event_save_v1',scoped(input),'NOT_FOUND',k);
  assert.equal((await db.query('select count(*)::int n from core.events where org_id=$1 and name=$2',[org,input.name])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')])).rows[0].n,0);
 });
 await t.test('last shared right: event vs event named RPC race allocates only once',async()=>{
  const results=await Promise.all([call(owner,'event_register_v1',scoped({event_id:eventA,person_id:studentPerson,sale_id:sale}),key()),call(owner,'event_register_v1',scoped({event_id:eventB,person_id:studentPerson,sale_id:sale}),key())]);
  assert.equal(results.filter(x=>x.result.ok).length,1,JSON.stringify(results.map(x=>x.result)));assert.equal(results.find(x=>!x.result.ok).result.error?.code,'ENTITLEMENT_UNAVAILABLE',JSON.stringify(results.map(x=>x.result)));
  registration=results.find(x=>x.result.ok).result.data.primary_id;
  assert.equal((await db.query("select count(*)::int n from core.event_registrations where org_id=$1 and event_id=any($2::uuid[]) and state='active'",[org,[eventA,eventB]])).rows[0].n,1);
  const balance=await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}));assert.equal(balance.find(x=>x.sale_id===sale).available,0);
  const loser=results.findIndex(x=>!x.result.ok);
  assert.equal((await db.query('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(results[loser].request.operation_key).digest('hex')])).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int n from core.entitlement_allocations where org_id=$1 and sale_id=$2 and state='reserved'",[org,sale])).rows[0].n,1);
 });
 await persist();
 await t.test('cancel releases the same shared pool; payment record is unchanged',async()=>{
  await mutate(owner,'event_registration_cancel_v1',{registration_id:registration,expected_version:1,reason:'synthetic'});
  const balance=await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}));assert.equal(balance.find(x=>x.sale_id===sale).available,1);assert.equal((await db.query('select count(*)::int n from core.cash_movements where org_id=$1',[org])).rows[0].n,1);
 });
 await t.test('same idempotency key replay and changed payload; no second reservation or credit allocation',async()=>{
  const k=key(),body={event_id:eventA,person_id:studentPerson,sale_id:sale};const first=await mutate(owner,'event_register_v1',body,k);const second=await mutate(owner,'event_register_v1',body,k);assert.equal(second.primary_id,first.primary_id);assert.equal(second.replayed,true);
  await error(owner,'event_register_v1',scoped({...body,event_id:eventB}),'IDEMPOTENCY_PAYLOAD_MISMATCH',k);registration=first.primary_id;
 });
 await t.test('draft attendance does not consume; close consumes and correction releases by linked movement',async()=>{
  await mutate(owner,'event_attendance_mark_v1',{registration_id:registration,expected_version:1,result:'attended'});
  assert.equal((await db.query("select count(*)::int n from core.entitlement_movements where org_id=$1 and kind='consume'",[org])).rows[0].n,0);
  const view=await must(owner,'event_get_v1',scoped({event_id:eventA}));
  await mutate(owner,'event_attendance_close_v1',{event_id:eventA,expected_version:view.version});
  let balance=await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}));assert.equal(balance.find(x=>x.sale_id===sale).consumed,1);
  await mutate(owner,'event_attendance_correct_v1',{registration_id:registration,expected_version:3,result:'no_show',reason:'synthetic correction'});
  balance=await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}));assert.equal(balance.find(x=>x.sale_id===sale).available,1);
  assert.equal((await db.query("select count(*)::int n from core.entitlement_movements where org_id=$1 and kind='reverse' and previous_id is not null",[org])).rows[0].n,1);
 });
 const classId=(await mutate(owner,'class_save_v1',{name:'Class',discipline_id:discipline,external_open:true})).primary_id;
 const session=(await mutate(owner,'session_create_v1',{class_id:classId,discipline_id:discipline,format:'group',interval:lessonInterval(),resources:[],assignments:[],capacity:{total:10}})).primary_id;
 const ev=await newEvent();
 await t.test('last shared right: event vs lesson named RPC race cannot double spend',async()=>{
  const results=await Promise.all([call(owner,'event_register_v1',scoped({event_id:ev.id,person_id:studentPerson,sale_id:sale}),key()),call(owner,'reservation_create_v1',scoped({session_id:session,person_id:studentPerson,mode:'flexible',source_sale_id:sale}),key())]);
  assert.equal(results.filter(x=>x.result.ok).length,1,JSON.stringify(results.map(x=>x.result)));assert.equal(results.find(x=>!x.result.ok).result.error?.code,'ENTITLEMENT_UNAVAILABLE',JSON.stringify(results));
  const rows=await db.query("select count(*)::int n from core.entitlement_allocations where org_id=$1 and sale_id=$2 and state='reserved'",[org,sale]);assert.equal(rows.rows[0].n,1);
  assert.equal((await db.query("select (select count(*) from core.event_registrations where org_id=$1 and event_id=$2 and state='active')+(select count(*) from core.reservations where org_id=$1 and session_id=$3 and state='active') as n",[org,ev.id,session])).rows[0].n,'1');
  const balance=await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}));assert.equal(balance.find(x=>x.sale_id===sale).available,0);
  const loser=results.findIndex(x=>!x.result.ok);
  assert.equal((await db.query('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(results[loser].request.operation_key).digest('hex')])).rows[0].n,0);
 });
 await t.test('events never create negative credit, even if normal lesson policy allows it',async()=>{
  await db.query("insert into core.policy_versions(id,org_id,key,effective_at,mandatory,value) values($1,$2,'negative_default',now(),false,$3)",[key(),org,{kind:'integer',value:100}]);
  await db.query("insert into core.policy_versions(id,org_id,key,effective_at,mandatory,value) values($1,$2,'negative_upper',now(),true,$3)",[key(),org,{kind:'integer',value:100}]);
  const next=await newEvent();
  await error(owner,'event_register_v1',scoped({event_id:next.id,person_id:studentPerson,sale_id:sale}),'ENTITLEMENT_UNAVAILABLE');
  assert.equal((await db.query('select count(*)::int n from core.credit_deficits where org_id=$1',[org])).rows[0].n,0);
 });
 await t.test('direct client RPC and private schema access cannot bypass verified gateway context',async()=>{
  const {env}=context();const res=await fetch(env.API_URL+'/rest/v1/rpc/event_save_v1',{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+owner.jwt,'content-type':'application/json','content-profile':'api_v1'},body:JSON.stringify({p_request:{},p_actor_auth_id:platform.id,p_session_id:platform.session_id,p_ids:[key()],p_aux:null})});assert(res.status>=400);
  const read=await fetch(env.API_URL+'/rest/v1/accounts?select=*',{headers:{apikey:env.ANON_KEY,authorization:'Bearer '+owner.jwt,'accept-profile':'core'}});assert(read.status>=400);
 });
 await t.test('verified-email invitation reaches local SMTP; acceptance grants self access without management roles',async()=>{
  await error(owner,'role_assign_v1',scoped({person_id:studentPerson,role:'staff',scope:{center_id:center}}),'ACCOUNT_LINK_REQUIRED');
  const job=await mutate(owner,'account_access_send_v1',{person_id:studentPerson});
  await deliverDevInvitation(job.job_id);
  const {env}=context();const messages=await (await fetch(env.MAILPIT_URL+'/api/v1/messages')).json();const message=messages.messages.find(m=>m.To.some(a=>a.Address===student.email));assert(message,'SMTP message exists');
  const detail=await(await fetch(env.MAILPIT_URL+'/api/v1/message/'+message.ID)).json();const token=detail.Text.match(/Token: ([a-f0-9]{64})/)[1];
  await error(stranger,'account_access_accept_v1',{token},'INVITATION_UNAVAILABLE');
  await must(student,'account_access_accept_v1',{token},key());
  assert.equal((await db.query('select count(*)::int n from core.role_assignments where org_id=$1 and person_id=$2',[org,studentPerson])).rows[0].n,0);
  assert((await must(student,'entitlements_get_v1',scoped({person_id:studentPerson}))).length>0);
  await error(student,'event_save_v1',scoped(eventInput()),'FORBIDDEN');
  const stored=(await db.query('select token_hash from core.invitations where org_id=$1 and person_id=$2',[org,studentPerson])).rows[0];assert.notEqual(stored.token_hash,token);
 });
 await t.test('staff grants and revocations are live; a center grant cannot target a different center',async()=>{
  const assignment=await mutate(owner,'role_assign_v1',{person_id:studentPerson,role:'staff',scope:{center_id:center}});
  await error(student,'person_create_v1',scoped({display_name:'denied',contacts:[]}),'FORBIDDEN');
  let personVersion=(await db.query('select version from core.people where id=$1',[studentPerson])).rows[0].version;
  await mutate(owner,'permission_set_v1',{person_id:studentPerson,permission:'person.manage',enabled:true,expected_version:Number(personVersion)});
  await mutate(student,'person_create_v1',{display_name:'Allowed by explicit grant',contacts:[]});
  await mutate(owner,'role_revoke_v1',{assignment_id:assignment.primary_id,expected_version:1,reason:'synthetic'});
  await error(student,'person_create_v1',scoped({display_name:'revoked',contacts:[]}),'FORBIDDEN');
  const other=(await must(owner,'center_create_v1',{org_id:org,name:'Other center',timezone:'Europe/Istanbul'},key())).primary_id;
  await error(student,'role_assign_v1',scoped({person_id:ownerPerson,role:'staff',scope:{center_id:other}}),'FORBIDDEN');
 });
 await t.test('organization manager may explicitly assign self to a center; owner transfer remains platform-only',async()=>{
  await must(owner,'org_manager_assign_v1',{org_id:org,person_id:studentPerson},key());
  await must(student,'manager_self_assign_center_v1',{org_id:org,target_center_id:center},key());
  await mutate(student,'person_create_v1',{display_name:'Self assigned CM',contacts:[]});
  await must(owner,'org_manager_revoke_v1',{org_id:org,person_id:studentPerson,expected_version:1,reason:'synthetic'},key());
  await mutate(owner,'center_manager_revoke_v1',{person_id:studentPerson,expected_version:1,reason:'synthetic'});
  await error(owner,'platform_owner_set_v1',scoped({verified_account_id:ownerAccount.id,reason:'forged platform'}),'FORBIDDEN');
  await error(platform,'platform_owner_remove_v1',scoped({reason:'no replacement'}),'OWNER_TRANSFER_REQUIRED');
 });
 await t.test('two real organizations cannot read each other or attach foreign people, disciplines and centers',async()=>{
  const otherAccount=await must(stranger,'account_get_v1');const other=(await must(platform,'organization_create_v1',{verified_account_id:otherAccount.id,name:'Other tenant',initial_plan_id:plan},key())).primary_id;
  await error(owner,'organization_get_v1',{org_id:other},'NOT_FOUND');
  await error(stranger,'event_get_v1',scoped({event_id:eventA}),'NOT_FOUND');
  await error(stranger,'center_manager_assign_v1',{org_id:other,center_id:center,person_id:ownerPerson},'NOT_FOUND');
  await error(owner,'event_save_v1',scoped(eventInput({discipline_ids:[key()]})),'NOT_FOUND');
 });
 await t.test('capacity race reserves one seat; losing transaction writes no debt, receipt or allocation',async()=>{
  const one=await newEvent({capacity:{nominal:1,maximum:1},terms:{...eventTerms,fee_minor:'1000',allowed_product_version_ids:[]}});const twoPeople=[];
  for(let i=0;i<2;i++){const p=(await mutate(owner,'person_create_v1',{display_name:'Capacity '+i,contacts:[]})).primary_id;await mutate(owner,'student_activate_v1',{person_id:p});twoPeople.push(p);}
  const keys=[key(),key()];const results=await Promise.all(twoPeople.map((p,i)=>call(owner,'event_register_v1',scoped({event_id:one.id,person_id:p}),keys[i])));
  assert.equal(results.filter(r=>r.result.ok).length,1,JSON.stringify(results));assert.equal(results.find(r=>!r.result.ok).result.error?.code,'CAPACITY_FULL',JSON.stringify(results));
  const loser=results.findIndex(r=>!r.result.ok);assert.equal((await db.query('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(keys[loser]).digest('hex')])).rows[0].n,0);
  const winner=results.findIndex(r=>r.result.ok);
  assert.equal((await db.query('select count(*)::int n from core.event_registrations where org_id=$1 and event_id=$2',[org,one.id])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from core.event_registrations where org_id=$1 and event_id=$2 and person_id=$3',[org,one.id,twoPeople[loser]])).rows[0].n,0);
  const debts=(await db.query('select person_id,amount_minor from core.debts where org_id=$1 and person_id=any($2::uuid[])',[org,twoPeople])).rows;
  assert.deepEqual(debts,[{person_id:twoPeople[winner],amount_minor:'1000'}]);
  assert.equal((await db.query('select count(*)::int n from core.entitlement_allocations a join core.event_registrations r on r.org_id=a.org_id and r.id=a.event_registration_id where r.org_id=$1 and r.event_id=$2',[org,one.id])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from core.credit_deficits where org_id=$1 and person_id=any($2::uuid[])',[org,twoPeople])).rows[0].n,0);
 });
 await t.test('event cancellation preview is dependency checked and atomically releases the common right',async()=>{
  const allocated=(await db.query("select a.*,r.version registration_version from core.entitlement_allocations a left join core.event_registrations r on r.id=a.event_registration_id where a.org_id=$1 and a.sale_id=$2 and a.state='reserved'",[org,sale])).rows[0];
  if(allocated.event_registration_id)await mutate(owner,'event_registration_cancel_v1',{registration_id:allocated.event_registration_id,expected_version:Number(allocated.registration_version),reason:'prepare cancellation test'});
  else {const reservation=(await db.query('select version from core.reservations where id=$1',[allocated.reservation_id])).rows[0];await mutate(owner,'reservation_cancel_v1',{reservation_id:allocated.reservation_id,expected_version:Number(reservation.version),reason:'prepare cancellation test'});}
  const future=Date.now()+86400000;const next=await newEvent({interval:{starts_at:new Date(future).toISOString(),ends_at:new Date(future+3600000).toISOString()}});const pv=await must(owner,'event_registration_preview_v1',scoped({event_id:next.id,person_id:studentPerson,sale_id:sale}));assert.deepEqual(pv.blockers,[]);
  const reg=await mutate(owner,'event_register_v1',{event_id:next.id,person_id:studentPerson,sale_id:sale,preview:{id:pv.id,token:pv.token}});
  const stale=await must(owner,'event_cancel_preview_v1',scoped({event_id:next.id,reason:'synthetic'}));
  const view=await must(owner,'event_get_v1',scoped({event_id:next.id}));await mutate(owner,'event_save_v1',{...next.input,event_id:next.id,expected_version:view.version,name:'Updated without invalidating rights'});
  await error(owner,'event_cancel_apply_v1',scoped({preview:{id:stale.id,token:stale.token}}),'PREVIEW_STALE');
  const valid=await must(owner,'event_cancel_preview_v1',scoped({event_id:next.id,reason:'synthetic'}));const k=key();const done=await mutate(owner,'event_cancel_apply_v1',{preview:{id:valid.id,token:valid.token}},k);const repeat=await mutate(owner,'event_cancel_apply_v1',{preview:{id:valid.id,token:valid.token}},k);assert.equal(done.primary_id,repeat.primary_id);assert.equal(repeat.replayed,true);
  assert.equal((await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}))).find(s=>s.sale_id===sale).available,1);
  assert.equal((await db.query('select state from core.event_registrations where id=$1',[reg.primary_id])).rows[0].state,'cancelled');
  assert.equal((await db.query('select count(*)::int n from core.debts where org_id=$1 and event_registration_id=$2',[org,reg.primary_id])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from core.student_credit_movements where org_id=$1',[org])).rows[0].n,0);

 });
 await t.test('event duty earnings require occurrence and explicit CM verification; corrections append linked movements',async()=>{
  const fee=await newEvent({assignments:[{person_id:ownerPerson,duty:'instructor',fee_minor:'500',currency:'TRY'}]});const a=(await db.query('select id from core.event_assignments where org_id=$1 and event_id=$2',[org,fee.id])).rows[0].id;
  await error(owner,'event_duty_verify_v1',scoped({assignment_id:a,expected_version:1,performed:true}),'INVALID_STATE_TRANSITION');
  await mutate(owner,'event_complete_v1',{event_id:fee.id});await mutate(owner,'event_duty_verify_v1',{assignment_id:a,expected_version:1,performed:true});
  await mutate(owner,'event_duty_verify_v1',{assignment_id:a,expected_version:2,performed:false,reason:'did not perform'});
  const rows=(await db.query('select amount_minor,direction,previous_id from core.earnings where org_id=$1 and event_assignment_id=$2 order by created_at,id',[org,a])).rows;assert.equal(rows.length,2);assert.equal(rows[0].direction,'add');assert.equal(rows[1].direction,'subtract');assert(rows[1].previous_id);
 });

 await t.test('Q-D01 actual RPC rejects narrow products for zero/multiple tags and requires explicit event usage',async()=>{
  const second=(await must(owner,'discipline_save_v1',{org_id:org,name:'Yoga',state:'active'},key())).primary_id;
  async function sell(scopes){const pv=(await mutate(owner,'product_publish_v1',{terms:{...terms,name:'Scope fixture',price_minor:'0',scopes}})).primary_id;const p=await must(owner,'sale_preview_v1',scoped({person_id:studentPerson,product_version_id:pv,...dates}));const s=(await mutate(owner,'sale_apply_v1',{preview:{id:p.id,token:p.token}})).primary_id;return {pv,s};}
  const narrow=await sell([{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['event']}]);
  for(const tags of [[],[discipline,second]]){const e=await newEvent({discipline_ids:tags,terms:{...eventTerms,allowed_product_version_ids:[narrow.pv]}});await error(owner,'event_register_v1',scoped({event_id:e.id,person_id:studentPerson,sale_id:narrow.s}),'CLASS_ACCESS_DENIED');}
  const matching=await newEvent({terms:{...eventTerms,allowed_product_version_ids:[narrow.pv]}});await mutate(owner,'event_register_v1',{event_id:matching.id,person_id:studentPerson,sale_id:narrow.s});
  const lesson=await sell([{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]);const e=await newEvent({terms:{...eventTerms,allowed_product_version_ids:[lesson.pv]}});await error(owner,'event_register_v1',scoped({event_id:e.id,person_id:studentPerson,sale_id:lesson.s}),'CLASS_ACCESS_DENIED');
 });
 await t.test('timed weekly quota is one shared bucket across events and cancellation releases it',async()=>{
  const pv=(await mutate(owner,'product_publish_v1',{terms:{...terms,name:'Weekly fixture',kind:'timed',credits:null,quota:{period:'week',limit:1},price_minor:'0'}})).primary_id;
  const p=await must(owner,'sale_preview_v1',scoped({person_id:studentPerson,product_version_id:pv,...dates}));const s=(await mutate(owner,'sale_apply_v1',{preview:{id:p.id,token:p.token}})).primary_id;
  // Sale starts on 2026-01-01; both fixtures must stay inside its first
  // seven-day bucket. The general Date.now()/slot helper can cross midnight
  // into the next sale-anchored week, where a second reservation is valid.
  const weeklyEvent=async starts_at=>newEvent({interval:{starts_at,ends_at:new Date(Date.parse(starts_at)+3600000).toISOString()},terms:{...eventTerms,allowed_product_version_ids:[pv]}});
  const es=[await weeklyEvent('2026-01-02T09:00:00Z'),await weeklyEvent('2026-01-02T11:00:00Z')];
  const first=await mutate(owner,'event_register_v1',{event_id:es[0].id,person_id:studentPerson,sale_id:s});await error(owner,'event_register_v1',scoped({event_id:es[1].id,person_id:studentPerson,sale_id:s}),'ENTITLEMENT_UNAVAILABLE');
  await mutate(owner,'event_registration_cancel_v1',{registration_id:first.primary_id,expected_version:1,reason:'synthetic'});await mutate(owner,'event_register_v1',{event_id:es[1].id,person_id:studentPerson,sale_id:s});
  const buckets=(await db.query('select reserved_count,consumed_count from core.quota_buckets where org_id=$1 and sale_id=$2',[org,s])).rows;assert.equal(buckets.length,1);assert.equal(Number(buckets[0].reserved_count),1);
  const nextWeek=await weeklyEvent('2026-01-09T09:00:00Z');await mutate(owner,'event_register_v1',{event_id:nextWeek.id,person_id:studentPerson,sale_id:s});
  const separate=(await db.query('select reserved_count,consumed_count from core.quota_buckets where org_id=$1 and sale_id=$2',[org,s])).rows;
  assert.equal(separate.length,2);assert(separate.every(b=>Number(b.reserved_count)===1&&Number(b.consumed_count)===0));
 });
 await t.test('same-key simultaneous requests share a receipt and create exactly one registration',async()=>{
  const e=await newEvent();const k=key(),b=scoped({event_id:e.id,person_id:studentPerson});const result=await Promise.all([call(owner,'event_register_v1',b,k),call(owner,'event_register_v1',b,k)]);assert(result.every(x=>x.result.ok),JSON.stringify(result));assert.equal(result[0].result.data.primary_id,result[1].result.data.primary_id);assert(result.some(x=>x.result.data.replayed));
  assert.equal((await db.query('select count(*)::int n from core.event_registrations where org_id=$1 and event_id=$2',[org,e.id])).rows[0].n,1);
 });
 await t.test('event list keyset paging is stable and rejects a cursor for another filter',async()=>{
  const interval={starts_at:'2026-01-01T00:00:00Z',ends_at:'2027-01-01T00:00:00Z'};let cursor=null;const ids=[];
  do{const page=await must(owner,'event_list_v1',scoped({interval,page:{limit:7,sort:'starts_at_asc',cursor}}));ids.push(...page.items.map(i=>i.id));cursor=page.next_cursor;}while(cursor);
  assert.equal(new Set(ids).size,ids.length);assert(ids.length>7);
  const page=await must(owner,'event_list_v1',scoped({interval,page:{limit:1}}));await error(owner,'event_list_v1',scoped({interval:{...interval,ends_at:'2026-12-01T00:00:00Z'},page:{limit:1,cursor:page.next_cursor}}),'VALIDATION_FAILED');
 });
 await t.test('manual event creates a separate money debt; partial collection never cancels the registration or changes rights',async()=>{
  const e=await newEvent({terms:{...eventTerms,fee_minor:'700',allowed_product_version_ids:[]}});const r=await mutate(owner,'event_register_v1',{event_id:e.id,person_id:studentPerson});const debt=(await db.query('select id from core.debts where org_id=$1 and event_registration_id=$2',[org,r.primary_id])).rows[0].id;
  const movements=(await db.query('select count(*)::int n from core.entitlement_movements where org_id=$1',[org])).rows[0].n;
  await mutate(owner,'collection_record_v1',{person_id:studentPerson,debt_ids:[debt],amount_minor:'300',currency:'TRY',occurred_at:new Date().toISOString()});
  assert.equal(Number((await db.query('select private.debt_remaining($1,$2) n',[org,debt])).rows[0].n),400);assert.equal((await db.query('select state from core.event_registrations where id=$1',[r.primary_id])).rows[0].state,'active');assert.equal((await db.query('select count(*)::int n from core.entitlement_movements where org_id=$1',[org])).rows[0].n,movements);
 });
 await t.test('new domain writes across all tenant tables use UUIDv7; journals reject edits',async()=>{
  const tables=(await db.query("select table_name from information_schema.columns where table_schema='core' and column_name='org_id' and table_name<>'organizations'")).rows;
  for(const {table_name} of tables){assert(/^[a-z_]+$/.test(table_name));const rows=(await db.query('select id from core.'+table_name+' where org_id=$1',[org])).rows;for(const r of rows)assert.equal(version(r.id),7,table_name);}
  await assert.rejects(db.query('update core.entitlement_movements set quantity=quantity where org_id=$1',[org]),e=>e.message==='INTEGRITY_VIOLATION');
 });

 await t.test('platform owner transfer updates live authority without implicitly granting center management',async()=>{
  const studentAccount=await must(student,'account_get_v1');await mutate(platform,'platform_owner_set_v1',{verified_account_id:studentAccount.id,reason:'synthetic transfer'});
  assert.equal((await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id,studentPerson);
  await error(owner,'org_manager_assign_v1',{org_id:org,person_id:ownerPerson},'FORBIDDEN');
  await error(student,'event_save_v1',scoped(eventInput()),'FORBIDDEN');
  await must(student,'subscription_get_v1',{org_id:org});
  await mutate(platform,'platform_owner_remove_v1',{replacement_verified_account_id:ownerAccount.id,reason:'restore synthetic owner'});
  assert.equal((await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id,ownerPerson);
 });
 await t.test('invitation acceptance rechecks the inviter after revocation, even with a delivered token',async()=>{
  const invitee=await authUser('revocation-invitee');const p=(await mutate(owner,'person_create_v1',{display_name:'Revocation invitee',contacts:[{kind:'email',value:invitee.email}]})).primary_id;await mutate(owner,'student_activate_v1',{person_id:p});
  const job=await mutate(owner,'account_access_send_v1',{person_id:p});await deliverDevInvitation(job.job_id);
  const {env}=context();const messages=await(await fetch(env.MAILPIT_URL+'/api/v1/messages')).json();const message=messages.messages.find(m=>m.To.some(a=>a.Address===invitee.email));const detail=await(await fetch(env.MAILPIT_URL+'/api/v1/message/'+message.ID)).json();const token=detail.Text.match(/Token: ([a-f0-9]{64})/)[1];
  await error(owner,'center_manager_revoke_v1',scoped({person_id:ownerPerson,expected_version:99,reason:'wrong version'}),'VERSION_CONFLICT');
  await mutate(owner,'center_manager_revoke_v1',{person_id:ownerPerson,expected_version:1,reason:'synthetic'});
  await error(invitee,'account_access_accept_v1',{token},'INVITATION_UNAVAILABLE');assert.equal((await db.query("select count(*)::int n from core.account_links where org_id=$1 and person_id=$2 and state='active'",[org,p])).rows[0].n,0);
  await mutate(owner,'center_manager_assign_v1',{person_id:ownerPerson});
 });

 await t.test('event read projection supplies registration/duty IDs and versions while restricting participant and fee data',async()=>{
  const role=await mutate(owner,'role_assign_v1',{person_id:studentPerson,role:'assistant',scope:{center_id:center}});
  const e=await newEvent({assignments:[{person_id:ownerPerson,duty:'instructor',fee_minor:'100',currency:'TRY'},{person_id:studentPerson,duty:'assistant',fee_minor:'50',currency:'TRY'}]});
  const p=(await mutate(owner,'person_create_v1',{display_name:'Projected attendee',contacts:[]})).primary_id;await mutate(owner,'student_activate_v1',{person_id:p});const registration=await mutate(owner,'event_register_v1',{event_id:e.id,person_id:p});
  const manager=await must(owner,'event_get_v1',scoped({event_id:e.id}));assert.equal(manager.registrations[0].id,registration.primary_id);assert.equal(manager.registrations[0].version,1);assert.equal(manager.duties.length,2);
  const assistant=await must(student,'event_get_v1',scoped({event_id:e.id}));assert.equal(assistant.registrations.length,1);assert.equal(assistant.duties.length,1);assert.equal(assistant.duties[0].person_id,studentPerson);
  await mutate(student,'event_attendance_mark_v1',{registration_id:registration.primary_id,expected_version:1,result:'attended'});await error(student,'event_attendance_close_v1',scoped({event_id:e.id,expected_version:4}),'FORBIDDEN');
  await mutate(owner,'role_revoke_v1',{assignment_id:role.primary_id,expected_version:1,reason:'synthetic'});
  await error(student,'event_attendance_mark_v1',scoped({registration_id:registration.primary_id,expected_version:2,result:'no_show'}),'FORBIDDEN');
  const revoked=await must(student,'event_get_v1',scoped({event_id:e.id}));assert.deepEqual(revoked.registrations,[]);
 });
 await t.test('UUID-bank exhaustion rolls back a late named-RPC write; retry uses the same operation key safely',async()=>{
  const {env}=context();const input=eventInput();const k=key();const request={client_api_version:1,request_id:key(),operation_key:k,...scoped(input)};
  const res=await fetch(env.API_URL+'/rest/v1/rpc/event_save_v1',{method:'POST',headers:{apikey:env.SERVICE_ROLE_KEY,authorization:'Bearer '+env.SERVICE_ROLE_KEY,'content-profile':'api_v1','content-type':'application/json'},body:JSON.stringify({p_request:request,p_actor_auth_id:owner.id,p_session_id:owner.session_id,p_ids:Array.from({length:21},key),p_aux:null})});
  const internal=await res.json();assert.equal(internal._internal_retry,'uuid_bank_exhausted');assert.equal((await db.query('select count(*)::int n from core.events where org_id=$1 and name=$2',[org,input.name])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')])).rows[0].n,0);
  await mutate(owner,'event_save_v1',input,k);assert.equal((await db.query('select count(*)::int n from core.events where org_id=$1 and name=$2',[org,input.name])).rows[0].n,1);
 });
 await t.test('configured lesson deficits are scoped by center/discipline and a later sale settles the same pool',async()=>{
  await db.query("insert into core.policy_versions(id,org_id,key,effective_at,mandatory,value) values($1,$2,'negative_upper',now(),true,$3)",[key(),org,{kind:'integer',value:1}]);
  const p=(await mutate(owner,'person_create_v1',{display_name:'Scoped deficit student',contacts:[]})).primary_id;await mutate(owner,'student_activate_v1',{person_id:p});
  const second=(await must(owner,'discipline_save_v1',{org_id:org,name:'Deficit other discipline',state:'active'},key())).primary_id;await mutate(owner,'center_discipline_set_v1',{discipline_id:second,state:'active'});
  async function sessionFor(d){const c=(await mutate(owner,'class_save_v1',{name:'Deficit class',discipline_id:d,external_open:true})).primary_id;return(await mutate(owner,'session_create_v1',{class_id:c,discipline_id:d,format:'group',interval:lessonInterval(),resources:[],assignments:[],capacity:{total:10}})).primary_id;}
  const sessions=[await sessionFor(discipline),await sessionFor(discipline),await sessionFor(second)];
  const first=await mutate(owner,'reservation_create_v1',{session_id:sessions[0],person_id:p,mode:'flexible'});await error(owner,'reservation_create_v1',scoped({session_id:sessions[1],person_id:p,mode:'flexible'}),'CREDIT_LIMIT_EXCEEDED');await mutate(owner,'reservation_create_v1',{session_id:sessions[2],person_id:p,mode:'flexible'});
  await mutate(owner,'reservation_cancel_v1',{reservation_id:first.primary_id,expected_version:1,reason:'synthetic'});await mutate(owner,'reservation_create_v1',{session_id:sessions[1],person_id:p,mode:'flexible'});
  const pv=(await mutate(owner,'product_publish_v1',{terms:{...terms,name:'Deficit settlement fixture',credits:2,price_minor:'0'}})).primary_id;const preview=await must(owner,'sale_preview_v1',scoped({person_id:p,product_version_id:pv,...dates}));const sale=(await mutate(owner,'sale_apply_v1',{preview:{id:preview.id,token:preview.token}})).primary_id;
  assert.equal((await db.query("select count(*)::int n from core.credit_deficits where org_id=$1 and person_id=$2 and state in ('reserved','consumed')",[org,p])).rows[0].n,0);assert.equal((await db.query("select count(*)::int n from core.entitlement_allocations where org_id=$1 and sale_id=$2 and state='reserved'",[org,sale])).rows[0].n,2);
 });

 await t.test('event full-payment gate checks the selected sale debt on the real write path',async()=>{
  const preview=await must(owner,'sale_preview_v1',scoped({person_id:studentPerson,product_version_id:product,...dates}));const s=(await mutate(owner,'sale_apply_v1',{preview:{id:preview.id,token:preview.token}})).primary_id;
  const e=await newEvent({terms:{...eventTerms,full_payment_required:true}});await error(owner,'event_register_v1',scoped({event_id:e.id,person_id:studentPerson,sale_id:s}),'ENTITLEMENT_UNAVAILABLE');
  const debt=(await db.query('select id from core.debts where org_id=$1 and sale_id=$2',[org,s])).rows[0].id;await mutate(owner,'collection_record_v1',{person_id:studentPerson,debt_ids:[debt],amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()});await mutate(owner,'event_register_v1',{event_id:e.id,person_id:studentPerson,sale_id:s});
 });
 await t.test('Q-E01 missing preparation blocks full-payment registration; Q-E02 center cancellation overrides refund terms',async()=>{
  const required=await newEvent({terms:{...eventTerms,fee_minor:'500',full_payment_required:true,allowed_product_version_ids:[]}});const preview=await must(owner,'event_registration_preview_v1',scoped({event_id:required.id,person_id:studentPerson}));assert.equal(preview.blockers[0].code,'ENTITLEMENT_UNAVAILABLE');await error(owner,'event_register_v1',scoped({event_id:required.id,person_id:studentPerson}),'ENTITLEMENT_UNAVAILABLE');assert.equal((await db.query('select count(*)::int n from core.event_registrations where org_id=$1 and event_id=$2',[org,required.id])).rows[0].n,0);
  const refundable=await newEvent({terms:{...eventTerms,fee_minor:'500',allowed_product_version_ids:[],refund:{method:'credit_ratio'}}});await mutate(owner,'event_register_v1',{event_id:refundable.id,person_id:studentPerson});const cancel=await must(owner,'event_cancel_preview_v1',scoped({event_id:refundable.id,reason:'synthetic'}));assert.deepEqual(cancel.blockers,[]);await mutate(owner,'event_cancel_apply_v1',{preview:{id:cancel.id,token:cancel.token}});assert.equal((await must(owner,'event_get_v1',scoped({event_id:refundable.id}))).state,'cancelled');
 });

 for(const paid of [0,200,500])await t.test('Q-E02 student cancels own past-planned registration without monetary reversal: '+paid,async()=>{
  const e=await newEvent({terms:{...eventTerms,fee_minor:'500',allowed_product_version_ids:[]}});
  const r=await mutate(student,'event_register_v1',{event_id:e.id,person_id:studentPerson});
  const d=(await db.query('select id from core.debts where org_id=$1 and event_registration_id=$2',[org,r.primary_id])).rows[0].id;
  if(paid)await mutate(owner,'collection_record_v1',{person_id:studentPerson,debt_ids:[d],amount_minor:String(paid),currency:'TRY',occurred_at:new Date().toISOString()});
  const k=key(),body={registration_id:r.primary_id,expected_version:1,reason:'self cancellation'};
  await mutate(student,'event_registration_cancel_v1',body,k);assert.equal((await mutate(student,'event_registration_cancel_v1',body,k)).replayed,true);
  assert.equal((await db.query('select private.debt_remaining($1,$2) n',[org,d])).rows[0].n,String(500-paid));
  assert.equal((await db.query('select count(*)::int n from core.student_credit_movements where org_id=$1 and source_debt_id=$2',[org,d])).rows[0].n,0);
  await error(student,'event_cancel_preview_v1',scoped({event_id:e.id,reason:'no center authority'}),'FORBIDDEN');
 });
 await t.test('role revocation invalidates an existing JWT immediately at the next command',async()=>{
  await mutate(owner,'center_manager_revoke_v1',{person_id:ownerPerson,expected_version:1,reason:'synthetic'});
  await error(owner,'event_save_v1',scoped(eventInput()),'FORBIDDEN');
  await mutate(owner,'center_manager_assign_v1',{person_id:ownerPerson});
 });
 await t.test('revoked Auth session cannot use its unexpired JWT',async()=>{
  const {env}=context();await fetch(env.API_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{authorization:'Bearer '+stranger.jwt,apikey:env.ANON_KEY}});
  const result=await call(stranger,'account_get_v1');assert.equal(result.result.ok,false);assert(['SESSION_REVOKED','AUTH_REQUIRED'].includes(result.result.error.code));
 });
 await t.test('bootstrap, grace and closed subscription boundaries are enforced on actual API calls',async()=>{
  await db.query("update core.saas_subscriptions set period_end=now()-interval '1 day',grace_until=now()+interval '6 days' where org_id=$1",[org]);
  await error(owner,'event_save_v1',scoped(eventInput()),'BILLING_OPERATION_RESTRICTED');
  await db.query("update core.saas_subscriptions set period_end=now()-interval '8 days',grace_until=now()-interval '1 day' where org_id=$1",[org]);
  await error(owner,'event_get_v1',scoped({event_id:eventA}),'SERVICE_UNAVAILABLE',undefined);
  assert((await must(owner,'subscription_get_v1',{org_id:org})).state==='suspended');
  await db.query("update core.saas_subscriptions set period_end=now()+interval '1 month',grace_until=now()+interval '1 month 7 days' where org_id=$1",[org]);
 });
 await persist();
 }finally{await db.end();}
});
