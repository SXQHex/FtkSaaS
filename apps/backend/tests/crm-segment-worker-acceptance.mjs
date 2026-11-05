import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentFixture} from './crm-lifecycle-fixture.mjs';

test('P11 native worker rechecks current segment between claim and action',{timeout:300000},async t=>{
 const {db,org,api,denied,managed,nativeWorker,configScope,definition,segment,createAutomation}=await segmentFixture(t);
 const segmentList=await managed('segment_save_v1',{scope:configScope}),segmentDetail=await managed('segment_save_v1',{scope:configScope,segment_id:segment});
 assert(segmentList.items.some(x=>x.entity.id===segment));assert.equal(segmentDetail.items.length,1);assert.deepEqual(segmentDetail.items[0].current.values.definition,definition);
 const version=segmentDetail.items[0].versions[0].version;
 await api('segment_save_v1',{segment_id:segment,expected_version:version,name:'Eligible students renamed',scope:configScope,definition});
 await denied('segment_save_v1',{segment_id:segment,expected_version:version,name:'Stale segment',scope:configScope,definition},'VERSION_CONFLICT');
 const automation=await createAutomation('Synthetic included followup'),filteredAutomation=await createAutomation('Synthetic live segment exclusion');
 const {claim,invoke}=await nativeWorker();
 const claimed=await claim();let selected,filteredJob;
 for(const job of claimed){
  const context=(await db.query('select automation_id from private.p05_jobs where job_id=$1',[job.request.job_id])).rows[0];
  if(context.automation_id===automation)selected=job;else if(context.automation_id===filteredAutomation)filteredJob=job;else assert.equal((await invoke(job)).ok,true);
 }
 assert(selected,'Pro worker must claim its eligible automation');assert(filteredJob,'Second automation must be independently claimed');
 const currentSegment=(await managed('segment_save_v1',{scope:configScope,segment_id:segment})).items[0];
 const excludedDefinition={all:[{field:'lead_interest',operator:'eq',value:'nobody'}]};
 const changed=await api('segment_save_v1',{segment_id:segment,expected_version:currentSegment.versions[0].version,name:'Temporarily excludes everyone',scope:configScope,definition:excludedDefinition});
 const skipped=await invoke(filteredJob);assert.equal(skipped.ok,true,JSON.stringify(skipped));assert.equal(skipped.data.result_reference.type,'outbox_jobs');
 assert.equal(Number((await db.query('select count(*) n from core.automation_runs where org_id=$1 and automation_id=$2',[org,filteredAutomation])).rows[0].n),0);
 assert.equal(Number((await db.query('select count(*) n from private.p05_automation_activities where automation_id=$1',[filteredAutomation])).rows[0].n),0);
 await api('segment_save_v1',{segment_id:segment,expected_version:changed.version,name:'Eligible students restored',scope:configScope,definition});
 const result=await invoke(selected);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(await invoke(selected),result);
 assert.equal(Number((await db.query('select count(*) n from private.p05_automation_activities where automation_id=$1',[automation])).rows[0].n),1);
});
