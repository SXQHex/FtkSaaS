import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Person registry real Auth/API authorization and contact privacy',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('people-owner');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'People',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'First',timezone:'Europe/Istanbul'},key())).primary_id;
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'Second',timezone:'Europe/Istanbul'},key())).primary_id;
 const db=await connect(),scope=b=>({org_id:org,center_id:center,...b});
 const mutate=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 let trigger;
 try{
 await mutate('center_manager_assign_v1',{person_id:ownerPerson});await mutate('center_manager_assign_v1',{center_id:other,person_id:ownerPerson});
 const payment=await mutate('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic people',occurred_at:new Date().toISOString()});await must(platform,'saas_payment_verify_v1',scope({payment_id:payment.primary_id,accepted:true}),key());
 const create=async(name,c=center)=>{const id=(await mutate('person_create_v1',{display_name:name,contacts:[{kind:'email',value:name+'@ftksaas.invalid'}]})).primary_id;await mutate('student_activate_v1',{center_id:c,person_id:id});return id;};
 const p=await create('Student one'),p2=await create('Student two',other);
 async function loginPerson(label,pid,role){const user=await authUser(label),a=await must(user,'account_get_v1');await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,pid]);let grant;if(role)grant=await mutate(role==='center_manager'?'center_manager_assign_v1':'role_assign_v1',{person_id:pid,...(role==='center_manager'?{}:{role,scope:{center_id:center}})});return {user,grant};}
 const student=(await loginPerson('self',p)).user;
 const cmPerson=await create('Scoped manager'),{user:cm}=await loginPerson('cm',cmPerson,'center_manager');
 const instructorPerson=await create('Instructor'),{user:instructor,grant:instructorGrant}=await loginPerson('instructor',instructorPerson,'instructor');
 const outsider=await authUser('people-outsider');
 const get=(u,id,c=center)=>must(u,'person_get_v1',{org_id:org,center_id:c,person_id:id});
 await t.test('current manager scope, self scope and organization read scope are distinct',async()=>{
  assert.equal((await get(cm,p)).contacts[0].value,'Student one@ftksaas.invalid');
  const unassigned=(await mutate('person_create_v1',{center_id:other,display_name:'Unassigned',contacts:[]})).primary_id;
  await fail('person_get_v1',{person_id:unassigned},'NOT_FOUND',cm);await fail('person_update_v1',{person_id:unassigned,expected_version:1,patch:{display_name:'denied'}},'NOT_FOUND',cm);assert.equal((await get(owner,unassigned,null)).id,unassigned);
  const ownNew=(await mutate('person_create_v1',{display_name:'Same center new',contacts:[]})).primary_id;assert.equal((await get(cm,ownNew)).id,ownNew);await mutate('person_update_v1',{person_id:ownNew,expected_version:1,patch:{display_name:'Allowed before activation'}},key(),cm);
  await mutate('student_activate_v1',{person_id:ownNew});await mutate('student_deactivate_v1',{person_id:ownNew,reason:'synthetic inactive'});
  await fail('person_get_v1',{person_id:ownNew},'NOT_FOUND',cm);await fail('person_update_v1',{person_id:ownNew,expected_version:2,patch:{display_name:'denied'}},'NOT_FOUND',cm);
  const hidden=await must(cm,'people_list_v1',scope({query:'Allowed before activation',page:{}}));assert.deepEqual(hidden.items,[]);
  await fail('person_get_v1',{person_id:p2},'NOT_FOUND',cm);await fail('person_update_v1',{person_id:p2,expected_version:1,patch:{display_name:'denied'}},'NOT_FOUND',cm);
  assert.equal((await get(owner,p2,null)).id,p2);assert.equal((await get(student,p)).id,p);
  await fail('person_get_v1',{person_id:p2},'NOT_FOUND',student);await fail('person_update_v1',{person_id:p,expected_version:1,patch:{display_name:'denied'}},'FORBIDDEN',student);
  await fail('person_get_v1',{person_id:p},'NOT_FOUND',outsider);
  const own=await must(student,'people_list_v1',scope({page:{},relationship:null}));assert.deepEqual(own.items.map(x=>x.id),[p]);
 });
 await t.test('people list filters, stable cursor, other-center exclusion and closed response',async()=>{
  await db.query("update core.people set created_at='2026-01-01T00:00:00Z' where org_id=$1",[org]);
  const first=await must(cm,'people_list_v1',scope({page:{limit:1},query:'Student'}));assert.equal(first.items.length,1);assert.equal(first.items[0].id,p);assert.equal(first.next_cursor,null);
  const a=await must(owner,'people_list_v1',{org_id:org,page:{limit:1},query:'Student'});assert(a.next_cursor);
  const b=await must(owner,'people_list_v1',{org_id:org,page:{limit:1,cursor:a.next_cursor},query:'Student'});assert.deepEqual([a.items[0].id,b.items[0].id].sort(),[p,p2].sort());assert.equal(b.next_cursor,null);
  await fail('people_list_v1',{center_id:undefined,page:{cursor:a.next_cursor},query:'other'},'VALIDATION_FAILED');
  await fail('people_list_v1',{page:{cursor:'broken'}},'VALIDATION_FAILED');
 });
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Salsa',state:'active'},key())).primary_id;await mutate('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 await t.test('discipline catalog requires org.read and filters manager center projection',async()=>{
  const hidden=(await must(owner,'discipline_save_v1',{org_id:org,name:'Other center discipline',state:'active'},key())).primary_id;await mutate('center_discipline_set_v1',{center_id:other,discipline_id:hidden,state:'active'});
  const b={org_id:org,page:{}};
  assert.deepEqual((await must(cm,'disciplines_list_v1',b)).items.map(x=>x.id),[discipline]);
  assert((await must(owner,'disciplines_list_v1',b)).items.some(x=>x.id===hidden));
  await mutate('center_discipline_set_v1',{discipline_id:discipline,state:'inactive',expected_version:1});assert.deepEqual((await must(cm,'disciplines_list_v1',b)).items,[]);
  await mutate('center_discipline_set_v1',{discipline_id:discipline,state:'active',expected_version:2});
  await must(owner,'discipline_save_v1',{org_id:org,discipline_id:discipline,name:'Salsa',state:'inactive',expected_version:1},key());assert.deepEqual((await must(cm,'disciplines_list_v1',b)).items,[]);assert((await must(owner,'disciplines_list_v1',b)).items.some(x=>x.id===discipline&&x.state==='inactive'));
  await must(owner,'discipline_save_v1',{org_id:org,discipline_id:discipline,name:'Salsa',state:'active',expected_version:2},key());
  for(const u of [student,instructor]){const r=await call(u,'disciplines_list_v1',b);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,'FORBIDDEN');}
 });
 const cls=(await mutate('class_save_v1',{name:'People class',discipline_id:discipline,external_open:true})).primary_id;
 await mutate('availability_save_v1',{resource:{kind:'person',id:instructorPerson},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
 await db.query("insert into core.instructor_agreements(id,org_id,center_id,person_id,discipline_id,format,valid_from,model,terms,state) values($1,$2,$3,$4,$5,'group','2020-01-01','session_fixed',$6,'active')",[key(),org,center,instructorPerson,discipline,{model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'100'}],room_fee:{kind:'free',order:'before_instructor_share'}}]);
 const future=new Date(Date.now()+86400000);future.setUTCHours(9,0,0,0);
 const at=+future,session=(await mutate('session_create_v1',{class_id:cls,discipline_id:discipline,format:'group',interval:{starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()},resources:[],assignments:[{person_id:instructorPerson,duty:'instructor'}],capacity:{nominal:10,maximum:10}})).primary_id;
 const policy=key();await db.query("insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values($1,$2,$3,'student_cancel_group',now(),false,$4)",[policy,org,center,{kind:'cancellation',cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}]);
 await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[key(),org,center,session,p,policy]);
 await t.test('assigned instructor receives necessary participant fields without contacts; revocation is immediate',async()=>{
  const view=await get(instructor,p);assert.equal(view.id,p);assert(!('contacts' in view));assert(view.relationships.every(x=>x.center_id===center));
  await fail('person_get_v1',{person_id:p2},'NOT_FOUND',instructor);
  const list=await must(instructor,'people_list_v1',scope({page:{},query:'Student'}));assert.deepEqual(list.items.map(x=>x.id),[p]);assert(!('contacts' in list.items[0]));
  await mutate('role_revoke_v1',{assignment_id:instructorGrant.primary_id,expected_version:1,reason:'synthetic revoke'});await fail('person_get_v1',{person_id:p},'NOT_FOUND',instructor);
 });
 await t.test('contact replacement preserves existing verification, clears new evidence and never changes Auth identity',async()=>{
  await db.query('update core.person_contacts set verified_at=$1 where org_id=$2 and person_id=$3',['2026-01-01T00:00:00Z',org,p]);
  const beforeIdentity=await rows('select auth_user_id from core.accounts where id=$1',[(await must(student,'account_get_v1')).id]);
  const k=key(),b={person_id:p,expected_version:1,patch:{display_name:'Updated student',contacts:[{kind:'email',value:'Student one@ftksaas.invalid'},{kind:'phone',value:'+905551234567'}]}};
  const a=await mutate('person_update_v1',b,k);assert.equal(a.version,2);assert.equal((await mutate('person_update_v1',b,k)).replayed,true);
  await fail('person_update_v1',b,'VERSION_CONFLICT');await fail('person_update_v1',{...b,patch:{display_name:'changed'}},'IDEMPOTENCY_PAYLOAD_MISMATCH',owner,k);
  const v=await get(student,p);assert.equal(v.display_name,'Updated student');assert(v.contacts.find(x=>x.kind==='email').verified_at);assert.equal(v.contacts.find(x=>x.kind==='phone').verified_at,null);
  assert.deepEqual(await rows('select auth_user_id from core.accounts where id=$1',[(await must(student,'account_get_v1')).id]),beforeIdentity);
 });
 await t.test('same expected person version admits one concurrent update',async()=>{
  const results=await Promise.all(['one','two'].map(display_name=>call(owner,'person_update_v1',scope({person_id:p,expected_version:2,patch:{display_name}}),key())));
  assert.equal(results.filter(x=>x.result.ok).length,1,JSON.stringify(results));assert.equal(results.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');assert.equal((await get(owner,p)).version,3);
 });
 await t.test('late audit failure restores removed contacts and version; exact key can retry',async()=>{
  const before=await get(owner,p),k=key(),b={person_id:p,expected_version:3,patch:{display_name:'Final',contacts:[]}};
  trigger='people_'+key().replaceAll('-','');await db.query('create function private.'+trigger+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query('create trigger '+trigger+" before insert on core.audit_events for each row when (new.org_id='"+org+"'::uuid and new.action='person_update_v1') execute function private."+trigger+'()');
  await fail('person_update_v1',b,'INTEGRITY_VIOLATION',owner,k);assert.deepEqual(await get(owner,p),before);
  assert.equal((await rows('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')]))[0].n,0);
  await db.query('drop trigger '+trigger+' on core.audit_events');await db.query('drop function private.'+trigger+'()');trigger=null;
  assert.equal((await mutate('person_update_v1',b,k)).version,4);assert.deepEqual((await get(owner,p)).contacts,[]);
 });
 }finally{if(trigger){await db.query('drop trigger if exists '+trigger+' on core.audit_events');await db.query('drop function if exists private.'+trigger+'()');}await db.end();}
});

test('P04 CRM/public intent -> review -> trial -> student, real Auth/Edge and isolated service-only public RPC',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('p04-owner'),staff=await authUser('p04-staff'),outsider=await authUser('p04-outsider');
 const account=await must(owner,'account_get_v1'),org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P04',initial_plan_id:plan},key())).primary_id;
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'P04 center',timezone:'UTC'},key())).primary_id;
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'P04 other',timezone:'UTC'},key())).primary_id;
 const scope=b=>({org_id:org,center_id:center,...b}),mut=(op,b={},u=owner,k=key())=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const managed=(operation,k={},u=owner,page={})=>must(u,'management_state_get_v1',scope({operation,selector:{operation,key:k},page}));
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 try{
 await mut('center_manager_assign_v1',{person_id:ownerPerson});await mut('center_manager_assign_v1',{center_id:other,person_id:ownerPerson});
 const payment=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic P04',occurred_at:new Date().toISOString()});await mut('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},platform);
 const staffPerson=(await mut('person_create_v1',{display_name:'P04 staff',contacts:[]})).primary_id,staffAccount=await must(staff,'account_get_v1');
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,staffAccount.id,staffPerson]);
 await mut('role_assign_v1',{person_id:staffPerson,role:'staff',scope:{center_id:center}});
 const grantVersion=async()=>Number((await rows('select version from core.people where id=$1',[staffPerson]))[0].version);
 await mut('permission_set_v1',{person_id:staffPerson,permission:'crm.daily',enabled:true,expected_version:await grantVersion()});
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'P04 dance',state:'active'},key())).primary_id;
 await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const ses=key(),start=new Date(Date.now()+86400000),end=new Date(+start+3600000);
 await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,2,2,'planned','open')",[ses,org,center,discipline,start,end]);
 const publicDetails={title:'Public dance',venue_public_label:'Public studio',fee_minor:'0',currency:'TRY',public_conditions:'Application only; no seat held'};
 let publication,application,person,lead,offer,version;
 const publicRequest=(contact,k=key())=>({client_api_version:1,request_id:key(),publication_id:publication,contact,bot_proof:'synthetic-provider-proof',client_request_key:k});
 async function publicRpc(r,aux={}){
  const ids=Array.from({length:64},key),salt='p04-synthetic';
  const h=v=>createHash('sha256').update(salt+v).digest('hex');
  // Local test DB only: emulate the private Edge context after independent ingress/provider unit tests.
  return (await rows("select set_config('request.jwt.claim.role','service_role',false)"),await rows("select api_v1.public_application_submit_v1($1::jsonb,null,null,$2::uuid[],$3::jsonb) result",[r,ids,{ip_hash:h('ip:'+r.client_request_key),target_hash:h(r.contact.trim().toLowerCase()),phase:'submit',bot_verified:true,...aux}]))[0].result;
 }
 await t.test('publication is explicit, public projection is closed, unavailable provider fails closed',async()=>{
  await fail('publication_set_v1',{session_id:ses,published:true},'POLICY_NOT_CONFIGURED');
  publication=(await mut('publication_set_v1',{session_id:ses,published:true,public_details:publicDetails})).primary_id;
  const {context}=await import('./api-client.mjs'),anon={jwt:context().env.ANON_KEY};
  const calendar=await must(anon,'public_calendar_get_v1',{slug:org,interval:{starts_at:new Date(+start-1000).toISOString(),ends_at:new Date(+end+1000).toISOString()},page:{}});
  assert.equal(calendar.items.length,1);assert.deepEqual(Object.keys(calendar.items[0]).sort(),['publication_id','title','interval','venue_public_label','fee_minor','currency','public_conditions','discipline_ids'].sort());
  assert.equal(calendar.items[0].publication_id,publication);
  const missing=await call(anon,'public_application_submit_v1',publicRequest('first@ftksaas.invalid'));assert.equal(missing.result.ok,false);assert.equal(missing.result.error.code,'SERVICE_UNAVAILABLE');
  assert.equal((await rows('select count(*)::int n from core.public_applications where org_id=$1',[org]))[0].n,0);
  const view=await managed('publication_set_v1',{session_id:ses});assert.equal(view.items[0].versions[0].version,1);assert.deepEqual(view.items[0].current.values.public_details,publicDetails);
 });
 await t.test('independent request keys and contacts; replay, duplicate, bot, rate and service gates create intent only',async()=>{
  const first=publicRequest('first@ftksaas.invalid'),second=publicRequest('second@ftksaas.invalid');
  assert.equal((await publicRpc(first)).ok,true);assert.equal((await publicRpc(second)).ok,true);
  assert.deepEqual((await publicRpc(first)).data,{accepted:true});
  assert.equal((await publicRpc({...first,contact:'changed@ftksaas.invalid'})).error.code,'VALIDATION_FAILED');
  assert.equal((await publicRpc(publicRequest(first.contact))).ok,true);
  assert.equal((await publicRpc(publicRequest('bot@ftksaas.invalid'),{bot_verified:false})).error.code,'BOT_VERIFICATION_FAILED');
  const apps=await rows('select * from core.public_applications where org_id=$1 order by created_at,id',[org]);assert.equal(apps.length,2);application=apps.find(a=>a.target_contact===first.contact).id;
  for(const table of ['reservations','trial_offers','sales'])assert.equal((await rows(`select count(*)::int n from core.${table} where org_id=$1`,[org]))[0].n,0);
  assert.equal((await rows("select count(*)::int n from core.people where org_id=$1 and display_name=$2",[org,first.contact]))[0].n,0);
  assert.equal((await publicRpc(publicRequest('unavailable@ftksaas.invalid'),{phase:'preflight',ip_hash:'0'.repeat(64)})).data.bot_required,true);
  for(let i=1;i<5;i++)assert.equal((await publicRpc(publicRequest('limit@ftksaas.invalid'),{phase:'preflight',ip_hash:'0'.repeat(64)})).ok,true);
  assert.equal((await publicRpc(publicRequest('limit@ftksaas.invalid'),{phase:'preflight',ip_hash:'0'.repeat(64)})).error.code,'RATE_LIMITED');
  await db.query("update core.organizations set state='closed' where id=$1",[org]);
  try{assert.equal((await publicRpc(publicRequest('closed@ftksaas.invalid'))).error.code,'SERVICE_UNAVAILABLE');}finally{await db.query("update core.organizations set state='active' where id=$1",[org]);}
 });
 await t.test('manager intake review creates one unverified candidate, not an account/student; staff cannot claim it',async()=>{
  await fail('public_application_review_v1',{application_id:application,action:'create_candidate'},'FORBIDDEN',staff);
  const inbox=await managed('public_application_review_v1',{});assert.equal(inbox.items.length,2);assert.equal(inbox.items.find(a=>a.entity.id===application).current.values.contact,'first@ftksaas.invalid');
  await mut('public_application_review_v1',{application_id:application,action:'create_candidate'});
  await fail('public_application_review_v1',{application_id:application,action:'create_candidate'},'INVALID_STATE_TRANSITION');
  person=(await rows('select person_id from core.public_applications where id=$1',[application]))[0].person_id;
  const l=(await rows('select * from core.leads where org_id=$1 and person_id=$2',[org,person]))[0];lead=l.id;version=Number(l.version);
  assert.equal((await rows('select count(*)::int n from core.account_links where org_id=$1 and person_id=$2',[org,person]))[0].n,0);
  assert.equal((await rows("select count(*)::int n from core.center_relationships where org_id=$1 and person_id=$2 and kind='student'",[org,person]))[0].n,0);
  assert.equal((await rows('select verified_at from core.person_contacts where org_id=$1 and person_id=$2',[org,person]))[0].verified_at,null);
  await fail('lead_save_v1',{center_id:other,lead_id:lead,person_id:person,expected_version:version,source:'x',interest:'x'},'NOT_FOUND');
  await mut('lead_save_v1',{lead_id:lead,person_id:person,expected_version:version,source:'public',interest:'dance',assigned_to:staffPerson});
 });
 await t.test('assigned staff followup/update is versioned, cannot reassign, convert, sell or replay after revoke',async()=>{
  const ls=await must(staff,'leads_list_v1',scope({page:{}}));assert.deepEqual(ls.items.map(x=>x.id),[lead]);assert.equal(ls.items[0].version,2);
  await fail('lead_save_v1',{lead_id:lead,person_id:person,expected_version:1,source:'x',interest:'x'},'VERSION_CONFLICT',staff);
  await fail('lead_save_v1',{lead_id:lead,person_id:person,expected_version:2,source:'x',interest:'x',assigned_to:ownerPerson},'FORBIDDEN',staff);
  const activityKey=key(),body={lead_id:lead,kind:'followup',due_at:new Date().toISOString(),note:'Internal-only'};
  const activity=await mut('crm_activity_save_v1',body,staff,activityKey);assert.equal((await mut('crm_activity_save_v1',body,staff,activityKey)).replayed,true);
  const activityView=await managed('crm_activity_save_v1',{lead_id:lead},staff);assert.equal(activityView.items[0].entity.id,activity.primary_id);assert.equal(activityView.items[0].current.values.note,'Internal-only');
  await fail('lead_convert_v1',{lead_id:lead},'FORBIDDEN',staff);
  await mut('permission_set_v1',{person_id:staffPerson,permission:'crm.daily',enabled:false,expected_version:await grantVersion()});
  await fail('crm_activity_save_v1',body,'FORBIDDEN',staff,activityKey);
  await mut('permission_set_v1',{person_id:staffPerson,permission:'crm.daily',enabled:true,expected_version:await grantVersion()});
  await fail('leads_list_v1',{page:{}},'NOT_FOUND',outsider);
 });
 const terms={name:'P04 trial',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
 const product=(await mut('product_publish_v1',{terms})).primary_id;
 await t.test('trial requires explicit config/cap and shares capacity, creates free candidate reservation without debt/earnings',async()=>{
  await fail('trial_offer_create_v1',{lead_id:lead,product_version_id:product,session_id:ses},'POLICY_NOT_CONFIGURED');
  await db.query('insert into private.p04_trial_configuration values($1,$2,$3,60,true)',[org,center,product]);
  await fail('trial_offer_create_v1',{lead_id:lead,product_version_id:product,session_id:ses},'POLICY_NOT_CONFIGURED');
  for(const [policy,value] of [['trial_repeat_limit',{kind:'integer',value:1}],['reservation_window',{kind:'window',opens_minutes_before:4320,closes_minutes_before:0,manager_exception:false}],['student_cancel_group',{kind:'cancellation',cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}]])await db.query('insert into core.policy_versions(id,org_id,key,effective_at,mandatory,value) values($1,$2,$3,now(),false,$4)',[key(),org,policy,value]);
  offer=(await mut('trial_offer_create_v1',{lead_id:lead,product_version_id:product,session_id:ses},staff)).primary_id;
  await fail('trial_offer_create_v1',{lead_id:lead,product_version_id:product,session_id:ses},'QUOTA_EXCEEDED');
  const offers=await managed('trial_offer_create_v1',{lead_id:lead,product_version_id:product},staff);assert.equal(offers.items[0].entity.id,offer);
  await db.query('update core.sessions set nominal=1,maximum=1 where id=$1',[ses]);
  const nonTrial=(await mut('person_create_v1',{display_name:'No overbook',contacts:[]})).primary_id;await mut('student_activate_v1',{person_id:nonTrial});
  await fail('reservation_create_v1',{session_id:ses,person_id:nonTrial,mode:'flexible'},'CAPACITY_FULL');
  const confirmKey=key();await mut('trial_registration_confirm_v1',{offer_id:offer},staff,confirmKey);assert.equal((await mut('trial_registration_confirm_v1',{offer_id:offer},staff,confirmKey)).replayed,true);
  await fail('trial_registration_confirm_v1',{offer_id:offer},'OFFER_UNAVAILABLE');
  const reservations=await rows('select * from core.reservations where org_id=$1 and person_id=$2',[org,person]);assert.equal(reservations.length,1);assert.equal(reservations[0].trial_offer_id,offer);assert.equal(reservations[0].source_sale_id,null);
  assert.equal((await rows('select count(*)::int n from core.trial_usages where org_id=$1 and person_id=$2',[org,person]))[0].n,1);
  assert.equal((await rows('select count(*)::int n from core.debts where org_id=$1 and person_id=$2',[org,person]))[0].n,0);
  // The authenticated instructor needs an active center relationship as well as a role.
  await mut('student_activate_v1',{person_id:ownerPerson});
  assert.equal((await rows("select count(*)::int n from core.center_relationships where org_id=$1 and center_id=$2 and person_id=$3 and kind='student' and state='active'",[org,center,ownerPerson]))[0].n,1);
  // Close real attendance before conversion: a per-person fee must still exclude the free trial.
  await mut('role_assign_v1',{person_id:ownerPerson,role:'instructor',scope:{center_id:center}});
  await mut('availability_save_v1',{resource:{kind:'person',id:ownerPerson},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
  const agreement=(await mut('instructor_agreement_publish_v1',{person_id:ownerPerson,discipline_id:discipline,format:'group',valid:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},terms:{model:'explicit_mixed',currency:'TRY',components:[{kind:'per_person',amount_minor:'100'}],room_fee:{kind:'free',order:'before_instructor_share'}},reason:'Synthetic free trial exclusion'})).primary_id;
  await db.query("insert into core.session_assignments(id,org_id,center_id,session_id,person_id,duty,agreement_id,state) values($1,$2,$3,$4,$5,'instructor',$6,'active')",[key(),org,center,ses,ownerPerson,agreement]);
  let attendance=await must(owner,'attendance_get_v1',scope({session_id:ses}));
  await mut('attendance_start_v1',{session_id:ses,expected_version:attendance.session_version,actual_started_at:new Date().toISOString(),reason:'Synthetic explicit trial start'});
  attendance=await must(owner,'attendance_get_v1',scope({session_id:ses}));
  for(const e of attendance.entries)await mut('attendance_mark_v1',{reservation_id:e.reservation_id,expected_version:e.version,result:'attended'});
  attendance=await must(owner,'attendance_get_v1',scope({session_id:ses}));
  const closeBody={session_id:ses,expected_version:attendance.session_version,performed:true,performed_instructor_ids:[ownerPerson]};
  const usage=(await rows('select * from core.trial_usages where org_id=$1 and offer_id=$2',[org,offer]))[0];assert.equal(usage.used_at,null);
  await db.query('delete from core.trial_usages where id=$1',[usage.id]);
  try{await fail('attendance_close_v1',closeBody,'INTEGRITY_VIOLATION');}
  finally{await db.query('insert into core.trial_usages select * from jsonb_populate_record(null::core.trial_usages,$1::jsonb)',[usage]);}
  await mut('attendance_close_v1',closeBody);
  assert((await rows('select used_at from core.trial_usages where id=$1',[usage.id]))[0].used_at);

  const frozen=(await rows('select earnings_snapshot from core.attendance_closures where org_id=$1 and session_id=$2',[org,ses]))[0].earnings_snapshot;
  assert.equal(frozen[0].participants[0].trial,true);assert.equal((await rows('select count(*)::int n from core.earnings where org_id=$1 and session_id=$2',[org,ses]))[0].n,0);
 });
 await t.test('paid trial uses a separate existing sale and allocates rights without CRM financial writes',async()=>{
  const p=(await mut('person_create_v1',{display_name:'Paid trial student',contacts:[]})).primary_id;
  const l=(await mut('lead_save_v1',{person_id:p,source:'center',interest:'paid trial',assigned_to:staffPerson})).primary_id;await mut('student_activate_v1',{person_id:p});
  const paid=(await mut('product_publish_v1',{terms:{...terms,name:'Paid fixed trial',price_minor:'1000'}})).primary_id;
  const paidSession=key();await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,2,2,'planned','open')",[paidSession,org,center,discipline,new Date(+start+7200000),new Date(+end+7200000)]);
  await db.query('insert into private.p04_trial_configuration values($1,$2,$3,60,true)',[org,center,paid]);
  const preview=await must(owner,'sale_preview_v1',scope({person_id:p,product_version_id:paid,start_date:new Date(Date.now()-86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+30*86400000).toISOString().slice(0,10)}));
  const sale=(await mut('sale_apply_v1',{preview:{id:preview.id,token:preview.token}})).primary_id;
  const financial=async()=>({sales:await rows('select * from core.sales where org_id=$1 and person_id=$2 order by id',[org,p]),debts:await rows('select * from core.debts where org_id=$1 and person_id=$2 order by id',[org,p]),cash:await rows('select * from core.cash_movements where org_id=$1 and person_id=$2 order by id',[org,p])});
  const before=await financial(),o=(await mut('trial_offer_create_v1',{lead_id:l,product_version_id:paid,session_id:paidSession},staff)).primary_id;
  await mut('trial_registration_confirm_v1',{offer_id:o},staff);assert.deepEqual(await financial(),before);
  const reservation=(await rows('select * from core.reservations where org_id=$1 and trial_offer_id=$2',[org,o]))[0];assert.equal(reservation.source_sale_id,sale);
  assert.equal((await rows("select count(*)::int n from core.entitlement_allocations where org_id=$1 and reservation_id=$2 and sale_id=$3 and state='reserved'",[org,reservation.id,sale]))[0].n,1);
 });
 await t.test('conversion enforces distinct org student limit, idempotency, plan gating and preserves free history',async()=>{
  const before=(await rows('select limits from core.saas_plan_versions where id=$1',[plan]))[0].limits;
  await db.query('update core.saas_plan_versions set limits=$2 where id=$1',[plan,{entries:[{key:'active_students',value:0},{key:'centers',value:10},{key:'instructors',value:50}]}]);
  try{await fail('lead_convert_v1',{lead_id:lead},'PLAN_LIMIT_REACHED');}finally{await db.query('update core.saas_plan_versions set limits=$2 where id=$1',[plan,before]);}
  const k=key();await mut('lead_convert_v1',{lead_id:lead},owner,k);assert.equal((await mut('lead_convert_v1',{lead_id:lead},owner,k)).replayed,true);await fail('lead_convert_v1',{lead_id:lead},'INVALID_STATE_TRANSITION');
  assert.equal((await rows("select count(*)::int n from core.center_relationships where org_id=$1 and person_id=$2 and kind='student' and state='active'",[org,person]))[0].n,1);
  assert.equal((await rows('select source_sale_id from core.reservations where org_id=$1 and person_id=$2',[org,person]))[0].source_sale_id,null);
  assert.equal((await rows('select count(*)::int n from core.earnings where org_id=$1 and session_id=$2',[org,ses]))[0].n,0);assert.equal((await rows('select earnings_snapshot from core.attendance_closures where org_id=$1 and session_id=$2',[org,ses]))[0].earnings_snapshot[0].participants[0].trial,true);
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F21') where id=$1",[plan]);
  try{await fail('leads_list_v1',{page:{}},'PLAN_FEATURE_UNAVAILABLE');}finally{await db.query("update core.saas_plan_versions set features=array_append(features,'F21') where id=$1",[plan]);}
  await fail('crm_followup_list_v1',{kind:'inactive_student',page:{}},'POLICY_NOT_CONFIGURED');
  await fail('crm_followup_list_v1',{kind:'renewal_due',page:{}},'POLICY_NOT_CONFIGURED');
  await db.query("insert into core.policy_versions(id,org_id,key,effective_at,mandatory,value) values($1,$2,'inactive_student_days',now(),false,$3)",[key(),org,{kind:'integer',value:0}]);
  await fail('crm_followup_list_v1',{kind:'renewal_due',page:{}},'POLICY_NOT_CONFIGURED');
  const followup=await must(owner,'crm_followup_list_v1',scope({kind:'inactive_student',page:{}}));assert(followup.items.some(x=>x.person_id===person));assert(followup.items.some(x=>x.lead_id===null));
 });
 }finally{await db.end();}
});
