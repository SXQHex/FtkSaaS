import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentFixture} from './crm-lifecycle-fixture.mjs';

test('P11 Pro worker keeps event dedupe and live disable feature and LOGIN scope gates',{timeout:300000},async t=>{
 const {db,plan,org,center,api,denied,managed,nativeWorker,target,excluded,configScope,definition,createAutomation}=await segmentFixture(t);
 const automation=await createAutomation('Synthetic Pro dedupe followup');
 const automationView=await managed('automation_save_v1',{scope:configScope,automation_id:automation});assert.equal(automationView.items.length,1);assert.deepEqual(automationView.items[0].current.values.definition.execution_center_ids,[center]);
 const {claim,invoke,role}=await nativeWorker();
 const claimed=await claim();let selected;
 for(const job of claimed){
  const context=(await db.query('select automation_id from private.p05_jobs where job_id=$1',[job.request.job_id])).rows[0];
  if(context.automation_id===automation)selected=job;else assert.equal((await invoke(job)).ok,true);
 }
 assert(selected,'Pro worker must claim its eligible automation');
 const result=await invoke(selected);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(await invoke(selected),result);
 const followups=await api('crm_followup_list_v1',{kind:'automation_followup',page:{}});assert.equal(followups.items.filter(x=>x.person_id===target).length,1);assert(!followups.items.some(x=>x.person_id===excluded));
 assert.equal(followups.items.find(x=>x.person_id===target).subscriber_number,(await db.query('select private.subscriber_number($1,$2) n',[org,target])).rows[0].n);
 const activityCount=async()=>Number((await db.query('select count(*) n from private.p05_automation_activities where automation_id=$1',[automation])).rows[0].n);
 assert.equal(await activityCount(),1);
 for(let round=0;round<4;round++){const jobs=await claim();if(!jobs.length)break;for(const job of jobs)assert.equal((await invoke(job)).ok,true);}
 assert.equal(await activityCount(),1);assert.equal(Number((await db.query('select count(*) n from core.automation_runs where org_id=$1 and automation_id=$2',[org,automation])).rows[0].n),1);
 await db.query('update private.p05_configuration_scopes set enabled=false where entity_id=$1',[automation]);
 await assert.rejects(invoke(selected),/FORBIDDEN/);assert.equal(await activityCount(),1);
 await db.query('update private.p05_configuration_scopes set enabled=true where entity_id=$1',[automation]);
 await db.query("update core.saas_plan_versions set features=array_remove(features,'F24') where id=$1",[plan]);
 await assert.rejects(invoke(selected),/PLAN_FEATURE_UNAVAILABLE/);await denied('segment_save_v1',{name:'Lost feature',scope:configScope,definition},'PLAN_FEATURE_UNAVAILABLE');
 await db.query("update core.saas_plan_versions set features=array_append(features,'F24') where id=$1",[plan]);
 assert.deepEqual(await invoke(selected),result);assert.equal(await activityCount(),1);
 await db.query('delete from private.p05_worker_scopes where db_role=$1',[role]);await assert.rejects(invoke(selected),/FORBIDDEN/);
 await db.query('insert into private.p05_worker_scopes values($1,$2)',[role,org]);assert.deepEqual(await invoke(selected),result);
});
