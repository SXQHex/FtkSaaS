import assert from 'node:assert/strict';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import * as validators from '../supabase/functions/backend-v1/validators.js';

export async function lifecycleFixture(t){
 const db=await connect();let worker,role;
 t.after(async()=>{try{if(worker)await worker.end();if(role){await db.query('delete from private.p05_worker_scopes where db_role=$1',[role]);await db.query(`drop role "${role}"`);}}finally{await db.end();}});
 const {platform,plan}=await fixturePlatform(),owner=await authUser('crm-lifecycle');
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic CRM lifecycle',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'CRM lifecycle center',timezone:'UTC'},key())).primary_id;
 const scope=body=>({org_id:org,center_id:center,...body});
 const request=async(op,body={},operationKey=key(),user=owner)=>{
  const result=await call(user,op,scope(body),operationKey);
  assert.equal(validators['request_'+op](result.request),true,JSON.stringify(validators['request_'+op].errors));
  return result.result;
 };
 const api=async(op,body={},operationKey=key(),user=owner)=>{const result=await request(op,body,operationKey,user);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(validators['success_'+op](result),true,JSON.stringify(validators['success_'+op].errors));return result.data;};
 const denied=async(op,body,code,operationKey=key(),user=owner)=>{const result=await request(op,body,operationKey,user);assert.equal(result.ok,false,JSON.stringify(result));assert.equal(result.error.code,code,JSON.stringify(result));};
 const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await api('center_manager_assign_v1',{person_id:ownerPerson});
 const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic CRM lifecycle',occurred_at:new Date().toISOString()});
 await api('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},key(),platform);
 const managed=(operation,k)=>api('management_state_get_v1',{operation,selector:{operation,key:k},page:{}});
 const person=async name=>(await api('person_create_v1',{display_name:name,contacts:[]})).primary_id;
 async function nativeWorker(){
  role='crm_lifecycle_'+key().replaceAll('-','');const password=randomBytes(24).toString('hex');
  await db.query(`create role "${role}" login password '${password}'`);await db.query(`grant ftk_p05_worker to "${role}"`);
  await db.query('insert into private.p05_worker_scopes values($1,$2)',[role,org]);
  const url=new URL(context().env.DB_URL);url.username=role;url.password=password;worker=new pg.Client({connectionString:url.href});await worker.connect();
  assert.equal((await worker.query('select session_user role')).rows[0].role,role);
  const ids=()=>Array.from({length:4096},key);
  const claim=async()=>(await worker.query('select private.p05_jobs_claim($1,$2,50) jobs',[org,ids()])).rows[0].jobs;
  const invoke=async({operation,request})=>{assert(validators['request_'+operation](request));const result=(await worker.query('select private.p05_worker_execute($1,$2,$3) result',[operation,request,ids()])).rows[0].result;if(result.ok)assert(validators['success_'+operation](result));return result;};
  return {claim,invoke,role};
 }
 return {db,plan,org,center,owner,ownerPerson,scope,api,denied,managed,person,nativeWorker};
}

export async function segmentFixture(t){
 const fixture=await lifecycleFixture(t),{db,org,center,api,person}=fixture;
 const target=await person('Synthetic eligible student'),excluded=await person('Synthetic excluded student');
 for(const [id,interest] of [[target,'eligible'],[excluded,'excluded']]){
  await api('lead_save_v1',{person_id:id,source:'phone',interest});await api('student_activate_v1',{person_id:id});
 }
 await db.query("update core.center_relationships set started_at=now()-interval '2 days' where org_id=$1 and kind='student'",[org]);
 await db.query("insert into core.policy_versions(id,org_id,key,effective_at,mandatory,value) values($1,$2,'inactive_student_days',now(),false,$3)",[key(),org,{kind:'integer',value:1}]);
 const configScope={kind:'center',center_id:center},definition={all:[{field:'active_student',operator:'eq',value:true}],any:[{field:'lead_interest',operator:'eq',value:'eligible'}]};
 const segment=(await api('segment_save_v1',{name:'Eligible active students',scope:configScope,definition})).primary_id;
 const createAutomation=async name=>(await api('automation_save_v1',{scope:configScope,definition:{name,trigger:{kind:'student_inactive',offset_days:1},segment_id:segment,action:{kind:'create_followup',channel:'in_app',template_key:'synthetic.followup'},execution_center_ids:[center],enabled:true}})).primary_id;
 return {...fixture,target,excluded,configScope,definition,segment,createAutomation};
}
