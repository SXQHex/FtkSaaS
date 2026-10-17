import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Availability and policies through real Auth -> Edge -> RPC',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('configuration-owner'),stranger=await authUser('configuration-stranger');
 const account=await must(owner,'account_get_v1'),org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Configuration',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Main',timezone:'Europe/Istanbul'},key())).primary_id;
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'Other',timezone:'Europe/Istanbul'},key())).primary_id;
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 const scope=b=>({org_id:org,center_id:center,...b}),mut=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 await mut('center_manager_assign_v1',{person_id:person});
 const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic configuration',occurred_at:new Date().toISOString()});
 await must(platform,'saas_payment_verify_v1',scope({payment_id:pay.primary_id,accepted:true}),key());
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Salsa',state:'active'},key())).primary_id;
 await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const room=(await mut('room_save_v1',{name:'Room',capacities:[{discipline_id:discipline,nominal:4,maximum:4}]})).primary_id;
 const resource={kind:'room',id:room},rule={weekdays:[1,2,3,4,5,6,7],local_start:'08:00:00',local_end:'22:00:00',valid_from:'2020-01-01'};
 const at=new Date();at.setUTCDate(at.getUTCDate()+2);at.setUTCHours(9,0,0,0);
 const interval={starts_at:at.toISOString(),ends_at:new Date(+at+3600000).toISOString()};
 const sessionBody={discipline_id:discipline,format:'group',interval,resources:[resource],assignments:[],capacity:{nominal:4,maximum:4}};
 let saved,session,trigger;
 const effective_at=new Date(Date.now()-5000).toISOString();
 const publish=(k,value,mandatory=false,b={},u=owner,opkey=key())=>mut('policy_publish_v1',{center_id:null,key:k,value,effective_at,mandatory,...b},opkey,u);
 const get=(keys=[],b={},u=owner)=>must(u,'policies_get_v1',scope({keys,...b}));
 const centerVersion=async()=>Number((await rows('select version from core.centers where id=$1',[center]))[0].version);
 async function linked(label,role,c=center){
  const p=(await mut('person_create_v1',{center_id:c,display_name:label,contacts:[]})).primary_id,u=await authUser(label),a=await must(u,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
  if(role==='center_manager')await mut('center_manager_assign_v1',{center_id:c,person_id:p});
  else await mut('role_assign_v1',{center_id:c,person_id:p,role,scope:{center_id:c}});
  return {u,p};
 }
 try{
 await t.test('unconfigured resource does not silently accept a new session; no partial session',async()=>{
  const n=(await rows('select count(*)::int n from core.sessions where org_id=$1',[org]))[0].n;
  await fail('session_create_v1',sessionBody,'POLICY_NOT_CONFIGURED');
  assert.equal((await rows('select count(*)::int n from core.sessions where org_id=$1',[org]))[0].n,n);
 });
 await t.test('availability creation and exact concurrent retry produce one rule and one audit/outbox',async()=>{
  const k=key(),b={resource,rule};const rs=await Promise.all([mut('availability_save_v1',b,k),mut('availability_save_v1',b,k)]);
  saved=rs[0];assert.equal(rs[1].primary_id,saved.primary_id);assert(rs.some(x=>x.replayed));
  assert.equal((await rows('select count(*)::int n from core.audit_events where operation_id=$1',[saved.operation_id]))[0].n,1);
  assert.equal((await rows('select count(*)::int n from core.outbox_jobs where dedupe_key=$1',[saved.operation_id]))[0].n,1);
  await fail('availability_save_v1',{resource,rule:{...rule,local_end:'21:00:00'}},'IDEMPOTENCY_PAYLOAD_MISMATCH',owner,k);
 });
 await t.test('time, date, overnight and create/update invariants are enforced',async()=>{
  for(const r of [{...rule,local_start:'25:00:00'},{...rule,local_start:'22:00:00',local_end:'08:00:00'},{...rule,valid_until:'2019-01-01'},{...rule,weekdays:[1,1]}])await fail('availability_save_v1',{resource,rule:r},'VALIDATION_FAILED');
  await fail('availability_save_v1',{resource,rule,expected_version:1},'VERSION_CONFLICT');
  await fail('availability_save_v1',{resource,rule,rule_id:saved.primary_id},'VERSION_CONFLICT');
  await fail('availability_save_v1',{resource:{kind:'room',id:key()},rule},'NOT_FOUND');
 });
 await t.test('optimistic update race accepts exactly one writer',async()=>{
  const rs=await Promise.all(['20:00:00','21:00:00'].map(local_end=>call(owner,'availability_save_v1',scope({resource,rule:{...rule,local_end},rule_id:saved.primary_id,expected_version:1}),key())));
  assert.equal(rs.filter(x=>x.result.ok).length,1);assert.equal(rs.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');
 });
 await t.test('session resource path enforces recurring hours and [start,end) boundaries',async()=>{
  session=(await mut('session_create_v1',sessionBody)).primary_id;
  const early={starts_at:new Date(+at-6*3600000).toISOString(),ends_at:new Date(+at-5*3600000).toISOString()};
  await fail('session_create_v1',{...sessionBody,interval:early},'RESOURCE_CONFLICT');
 });
 await t.test('exception appends with center aggregate version; same-key replay and stale-key race',async()=>{
  const k=key(),v=await centerVersion(),b={resource,interval,reason:'Maintenance',expected_version:v};
  const a=await mut('availability_exception_save_v1',b,k);assert.equal(a.version,v+1);assert((await mut('availability_exception_save_v1',b,k)).replayed);
  await fail('availability_exception_save_v1',b,'VERSION_CONFLICT');
  assert.equal((await rows('select state from core.sessions where id=$1',[session]))[0].state,'planned');
  await fail('session_create_v1',sessionBody,'RESOURCE_CONFLICT');
  await mut('session_create_v1',{...sessionBody,interval:{starts_at:interval.ends_at,ends_at:new Date(Date.parse(interval.ends_at)+3600000).toISOString()}});
  const v2=await centerVersion(),rs=await Promise.all([1,2].map(n=>call(owner,'availability_exception_save_v1',scope({resource,interval:{starts_at:new Date(+at+n*86400000).toISOString(),ends_at:new Date(+at+n*86400000+3600000).toISOString()},reason:'Race',expected_version:v2}),key())));
  assert.equal(rs.filter(x=>x.result.ok).length,1);assert.equal(rs.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');
  await fail('availability_exception_save_v1',{...b,expected_version:await centerVersion(),interval:{starts_at:interval.ends_at,ends_at:interval.starts_at}},'VALIDATION_FAILED');
 });
 await t.test('advisory organization policy allows a center exception; mandatory supersedes it at its effective time',async()=>{
  await publish('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
  await publish('waitlist_offer_minutes',{kind:'integer',value:30});
  await publish('waitlist_offer_minutes',{kind:'integer',value:20},false,{center_id:center});
  assert.equal((await get(['waitlist_offer_minutes']))[0].value.value,20);
  const future=new Date(Date.now()+60000).toISOString();
  await publish('waitlist_offer_minutes',{kind:'integer',value:10},true,{effective_at:future});
  assert.equal((await get(['waitlist_offer_minutes']))[0].value.value,20);
  await publish('waitlist_offer_minutes',{kind:'integer',value:15},true,{effective_at:new Date(Date.now()-100).toISOString()});
  assert.equal((await get(['waitlist_offer_minutes']))[0].value.value,15);
  assert.equal((await get(['waitlist_offer_minutes']))[0].scope.kind,'organization');
  await fail('policy_publish_v1',{key:'waitlist_offer_minutes',value:{kind:'integer',value:40},effective_at,mandatory:false},'FORBIDDEN');
 });
 await t.test('policy value kinds and windows are validated; no default is manufactured',async()=>{
  await fail('policy_publish_v1',{center_id:null,key:'reservation_window',value:{kind:'integer',value:3},effective_at,mandatory:false},'VALIDATION_FAILED');
  await fail('policy_publish_v1',{center_id:null,key:'reservation_window',value:{kind:'window',opens_minutes_before:1,closes_minutes_before:2,manager_exception:false},effective_at,mandatory:false},'VALIDATION_FAILED');
  assert.deepEqual((await get(['inactive_student_days'])),[]);
 });
 await t.test('concurrent policy publications form one version chain; retry adds no version',async()=>{
  const rs=await Promise.all([1,2].map(value=>publish('trial_repeat_limit',{kind:'integer',value})));
  assert.deepEqual(rs.map(x=>x.version).sort(),[1,2]);
  const vs=await rows("select id,previous_id,version from core.policy_versions where org_id=$1 and key='trial_repeat_limit' order by version",[org]);assert.equal(vs[1].previous_id,vs[0].id);
  const k=key(),b={key:'trial_repeat_limit',value:{kind:'integer',value:3},effective_at,mandatory:false,center_id:null};
  const a=await mut('policy_publish_v1',b,k);assert.equal((await mut('policy_publish_v1',b,k)).primary_id,a.primary_id);
  await fail('policy_publish_v1',{...b,value:{kind:'integer',value:4}},'IDEMPOTENCY_PAYLOAD_MISMATCH',owner,k);
 });
 const cm=await linked('config-cm','center_manager'),student=await linked('config-student','student'),staff=await linked('config-staff','staff');
 await t.test('tenant, center, owner and role boundaries remain live on retry',async()=>{
  for(const u of [student.u,staff.u]){
   await fail('availability_save_v1',{resource,rule},'FORBIDDEN',u);
   await fail('policies_get_v1',{keys:[]},'FORBIDDEN',u);
   await fail('policy_publish_v1',{center_id:null,key:'trial_repeat_limit',value:{kind:'integer',value:3},effective_at,mandatory:false},'FORBIDDEN',u);
  }
  await fail('policies_get_v1',{keys:[]},'NOT_FOUND',stranger);
  await fail('availability_save_v1',{center_id:other,resource,rule},'FORBIDDEN',cm.u);
  await fail('policies_get_v1',{center_id:other,keys:[]},'FORBIDDEN',cm.u);
  await fail('policy_publish_v1',{center_id:null,key:'trial_repeat_limit',value:{kind:'integer',value:3},effective_at,mandatory:false},'FORBIDDEN',cm.u);
  await fail('policy_publish_v1',{key:'trial_repeat_limit',value:{kind:'integer',value:3},effective_at,mandatory:true},'FORBIDDEN',cm.u);
  await publish('trial_repeat_limit',{kind:'integer',value:2},false,{center_id:center},cm.u);
 });
 await t.test('new reservation rechecks exception without cancelling existing session or consuming rights',async()=>{
  await mut('student_activate_v1',{person_id:student.p});
  const n=(await rows('select count(*)::int n from core.reservations where session_id=$1',[session]))[0].n;
  await fail('reservation_create_v1',{session_id:session,person_id:student.p,mode:'flexible'},'RESOURCE_CONFLICT');
  assert.equal((await rows('select count(*)::int n from core.reservations where session_id=$1',[session]))[0].n,n);
 });
 await t.test('reservation window, typed cancellation snapshot and mandatory policy selection are applied by existing API',async()=>{
  await publish('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'consume',no_show:'consume'}},true);
  await publish('negative_default',{kind:'integer',value:20});
  await publish('negative_upper',{kind:'integer',value:20},true);
  const si={...sessionBody,resources:[],interval:{starts_at:new Date(+at+5*86400000).toISOString(),ends_at:new Date(+at+5*86400000+3600000).toISOString()}};
  const sid=(await mut('session_create_v1',si)).primary_id;
  await publish('reservation_window',{kind:'window',opens_minutes_before:0,closes_minutes_before:0,manager_exception:true},false,{effective_at:new Date(Date.now()-50).toISOString()});
  await fail('reservation_create_v1',{session_id:sid,person_id:student.p,mode:'flexible'},'FORBIDDEN');
  await publish('reservation_window',{kind:'window',opens_minutes_before:20000,closes_minutes_before:0,manager_exception:false},false,{effective_at:new Date(Date.now()-50).toISOString()});
  const res=await mut('reservation_create_v1',{session_id:sid,person_id:student.p,mode:'flexible'});
  const original=(await rows('select policy_version_id from core.reservations where id=$1',[res.primary_id]))[0].policy_version_id;
  await publish('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'consume',after_cutoff:'consume',no_show:'consume'}},true,{effective_at:new Date(Date.now()-50).toISOString()});
  assert.equal((await rows('select policy_version_id from core.reservations where id=$1',[res.primary_id]))[0].policy_version_id,original);
  await mut('reservation_cancel_v1',{reservation_id:res.primary_id,expected_version:1,reason:'Snapshot'});
  assert.equal((await rows("select count(*)::int n from core.credit_deficits where reservation_id=$1 and state in ('reserved','consumed')",[res.primary_id]))[0].n,0);
 });
 await t.test('exception versus session creation serializes with no partial resource booking',async()=>{
  const it={starts_at:new Date(+at+8*86400000).toISOString(),ends_at:new Date(+at+8*86400000+3600000).toISOString()};
  const results=await Promise.all([call(owner,'availability_exception_save_v1',scope({resource,interval:it,reason:'Race session',expected_version:await centerVersion()}),key()),call(owner,'session_create_v1',scope({...sessionBody,interval:it}),key())]);
  assert(results[0].result.ok);const created=results[1].result;
  if(!created.ok)assert.equal(created.error.code,'RESOURCE_CONFLICT');
  const sessions=await rows('select id from core.sessions where org_id=$1 and starts_at=$2',[org,it.starts_at]);
  assert.equal(sessions.length,created.ok?1:0);
  assert.equal((await rows('select count(*)::int n from core.resource_bookings where org_id=$1 and starts_at=$2',[org,it.starts_at]))[0].n,created.ok?1:0);
 });
 await t.test('late audit failure rolls back every configuration, receipt, notification and aggregate version; retry works',async()=>{
  const snapshot=async()=>JSON.stringify(await rows("select (select jsonb_agg(x order by id) from core.policy_versions x where org_id=$1) p,(select jsonb_agg(x order by id) from core.availability_rules x where org_id=$1) a,(select jsonb_agg(x order by id) from core.availability_exceptions x where org_id=$1) e,(select jsonb_agg(x order by id) from core.centers x where org_id=$1) c,(select count(*) from core.audit_events where org_id=$1) audit,(select count(*) from core.outbox_jobs where org_id=$1) outbox",[org]));
  trigger='configuration_'+key().replaceAll('-','');
  await db.query('create function private.'+trigger+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query('create trigger '+trigger+" before insert on core.audit_events for each row when (new.org_id='"+org+"'::uuid) execute function private."+trigger+'()');
  const before=await snapshot(),cases=[['availability_save_v1',{resource,rule}],['availability_exception_save_v1',{resource,interval,reason:'Rollback',expected_version:await centerVersion()}],['policy_publish_v1',{center_id:null,key:'trial_repeat_limit',value:{kind:'integer',value:5},effective_at,mandatory:false}]];
  const keys=cases.map(()=>key());
  for(let i=0;i<cases.length;i++){await fail(cases[i][0],cases[i][1],'INTEGRITY_VIOLATION',owner,keys[i]);assert.equal(await snapshot(),before);assert.equal((await rows('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(keys[i]).digest('hex')]))[0].n,0);}
  await db.query('drop trigger '+trigger+' on core.audit_events');await db.query('drop function private.'+trigger+'()');trigger=null;
  for(let i=0;i<cases.length;i++)await mut(cases[i][0],cases[i][1],keys[i]);
 });
 await t.test('revocation blocks both fresh commands and successful-result replay',async()=>{
  const k=key(),b={key:'inactive_student_days',value:{kind:'integer',value:7},effective_at,mandatory:false};
  await publish('inactive_student_days',{kind:'integer',value:30});
  await mut('policy_publish_v1',b,k,cm.u);
  const a=(await rows("select version from core.role_assignments where org_id=$1 and person_id=$2 and role='center_manager' and scope_center_id=$3 and state='active'",[org,cm.p,center]))[0];
  await mut('center_manager_revoke_v1',{person_id:cm.p,expected_version:Number(a.version),reason:'Revoke configuration access'});
  await fail('policy_publish_v1',b,'FORBIDDEN',cm.u,k);
  await fail('policies_get_v1',{keys:[]},'FORBIDDEN',cm.u);
 });
 await t.test('feature gates cannot be bypassed by an owner or a configuration replay',async()=>{
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F03') where id=$1",[plan]);
  try{await fail('policies_get_v1',{keys:[]},'PLAN_FEATURE_UNAVAILABLE');await fail('policy_publish_v1',{center_id:null,key:'trial_repeat_limit',value:{kind:'integer',value:2},effective_at,mandatory:false},'PLAN_FEATURE_UNAVAILABLE');}
  finally{await db.query("update core.saas_plan_versions set features=array_append(features,'F03') where id=$1",[plan]);}
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F02') where id=$1",[plan]);
  try{await fail('availability_save_v1',{resource,rule},'PLAN_FEATURE_UNAVAILABLE');}
  finally{await db.query("update core.saas_plan_versions set features=array_append(features,'F02') where id=$1",[plan]);}
 });
 await t.test('direct authenticated RPC cannot bypass service-only wrappers',async()=>{
  const {env}=context();const res=await fetch(env.API_URL+'/rest/v1/rpc/policy_publish_v1',{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+owner.jwt,'Content-Profile':'api_v1','content-type':'application/json'},body:JSON.stringify({p_request:{},p_actor_auth_id:owner.id,p_session_id:owner.session_id,p_ids:[]})});assert(!res.ok);
 });
 }finally{
  if(trigger){await db.query('drop trigger if exists '+trigger+' on core.audit_events');await db.query('drop function if exists private.'+trigger+'()');}
  await db.end();
 }
});
