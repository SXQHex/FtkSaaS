import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {newUuidV7 as id} from '../scripts/uuid.mjs';
import {runHostedPilot} from '../scripts/acceptance/o10-hosted-pilot.mjs';
import {capturePilot,pilotPlan,recoveryTimings,summarizePilot} from '../scripts/acceptance/o10-pilot.mjs';

function fixtureToken(project,subject,expiresAt=Math.floor(Date.now()/1000)+600){
 return 'e30.'+Buffer.from(JSON.stringify({iss:'https://'+project+'.supabase.co/auth/v1',sub:subject,exp:expiresAt})).toString('base64url')+'.fixture';
}
function hostedFixture(){
 const orgs=Array.from({length:10},()=>id()),projectRef='fuiidquhnqevrozizdcj';
 return {projectRef,sourceSha:'a'.repeat(40),deploymentId:projectRef+'_'+id()+'_7',publishableKey:'sb_publishable_synthetic',
  activeStudents:Object.fromEntries(orgs.map(org=>[org,500])),actors:Array.from({length:50},(_,i)=>{
   const account=id();
   return {org:orgs[Math.floor(i/5)],account,center:id(),student:id(),debt:id(),sale:id(),booking_session:id(),attendance_session:id(),
    access_token:fixtureToken(projectRef,account),close_version:3,occurred_at:'2026-11-24T00:00:00Z',week:{starts_at:'2026-11-23T00:00:00Z',ends_at:'2026-11-30T00:00:00Z'}};
  })};
}

test('pilot collects only 600 expected operations, correlates backend duration and uses the booking ACK',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ftk-pilot-test-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const config=hostedFixture(),{projectRef}=config;
 const actors=new Map(config.actors.map(actor=>['Bearer '+actor.access_token,actor])),provider=[],bookings=new Map(),commandKeys=new Set();
 let sessions=0,peak=0,inflight=0;
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  const actor=actors.get(init.headers.authorization);
  assert.equal(new URL(url).origin,'https://'+projectRef+'.supabase.co');
  if(url.endsWith('/auth/v1/user')){sessions++;return Response.json({id:actor.account});}
  inflight++;peak=Math.max(peak,inflight);
  await new Promise(resolve=>setImmediate(resolve));
  inflight--;
  const op=url.split('/').pop(),body=JSON.parse(init.body),providerId=id();
  assert.equal(body.org_id,actor.org);assert.equal(body.center_id,actor.center);
  let data;
  switch(op){
   case 'people_list_v1':data={items:Array(25).fill({})};break;
   case 'person_get_v1':data={id:actor.student,subscriber_number:'12345'};break;
   case 'calendar_get_v1':data={items:[{},{}]};break;
   case 'report_export_start_v1':data={job_id:id()};break;
   case 'collection_record_v1':assert.equal(body.amount_minor,'1000');data={primary_id:id()};break;
   case 'reservation_create_v1':data={primary_id:id(),version:3};bookings.set(actor.account,data);break;
   case 'reservation_cancel_v1':
    data=bookings.get(actor.account);assert.equal(body.reservation_id,data.primary_id);assert.equal(body.expected_version,data.version);break;
   case 'attendance_close_v1':data={primary_id:actor.attendance_session};break;
   default:assert.fail('unexpected operation');
  }
  if(body.operation_key){assert(!commandKeys.has(body.operation_key));commandKeys.add(body.operation_key);}
  provider.push({operation:op,project_ref:projectRef,deployment_id:config.deploymentId,provider_id:providerId,execution_time_ms:10});
  return Response.json({ok:true,data},{headers:{'sb-request-id':providerId}});
 });
 const output=path.join(directory,'run');
 await runHostedPilot(config,output);
 assert.equal(sessions,50);assert.equal(peak,50);assert.equal(commandKeys.size,300);
 const waves=JSON.parse(fs.readFileSync(path.join(output,'waves.json')));
 const report=summarizePilot(waves,provider.toReversed());
 assert.equal(report.latency_and_responses_ok,true);
 assert.deepEqual(report.results.map(r=>r.samples),[100,100,100,100,50,50,50,50]);
 assert.equal(pilotPlan().flat().length,600);
 const late=provider.map(r=>({...r,execution_time_ms:r.operation==='people_list_v1'?1100:10}));
 assert.equal(summarizePilot(waves,late).latency_and_responses_ok,false);
 assert.throws(()=>summarizePilot(waves,[...provider.slice(1),provider[1]]),/PROVIDER_ROWS_INVALID/);
 assert.throws(()=>summarizePilot(waves,provider.slice(1)),/COMPLETE_CAPTURE_REQUIRED/);
 assert.throws(()=>summarizePilot(waves,provider.map(r=>({...r,deployment_id:'wrong'}))),/PROVIDER_ROWS_INVALID/);
 assert.throws(()=>summarizePilot(waves,provider.map(r=>({...r,operation:'calendar_get_v1'}))),/CORRELATION_FAILED/);
 assert(!JSON.stringify(waves).includes(config.actors[0].access_token));
});

test('expired test sessions are rejected before querying any account or creating a run',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ftk-pilot-expired-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const config=hostedFixture(),actor=config.actors.at(-1);
 actor.access_token=fixtureToken(config.projectRef,actor.account,Math.floor(Date.now()/1000)-1);
 const fetchMock=t.mock.method(globalThis,'fetch',async()=>assert.fail('Expired fixture reached the network'));
 const output=path.join(directory,'run');
 await assert.rejects(runHostedPilot(config,output),/PILOT_ACTOR_SESSION_EXPIRED/);
 assert.equal(fetchMock.mock.callCount(),0);
 assert.equal(fs.existsSync(output),false);
});

test('failed hosted calls preserve HTTP and provider trace evidence without persisting response bodies',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ftk-pilot-observations-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const config=hostedFixture();
 const actors=new Map(config.actors.map((a,index)=>['Bearer '+a.access_token,{account:a.account,index}]));
 const providerIds=Array.from({length:50},()=>id());
 let measurementCalls=0;
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  const actor=actors.get(init.headers.authorization);
  if(url.endsWith('/auth/v1/user'))return Response.json({id:actor.account});
  measurementCalls++;
  const headers={'sb-request-id':providerIds[actor.index]};
  if(actor.index===0)return new Response('private provider HTML',{status:503,headers});
  if(actor.index===2)throw new DOMException('private timeout details','TimeoutError');
  return Response.json({ok:false,error:{code:actor.index===3?'UNKNOWN_PRIVATE_CODE':'TEMPORARY_FAILURE',message:'private provider body'}},{status:503,headers});
 });
 const output=path.join(directory,'run');
 await assert.rejects(runHostedPilot(config,output),/PILOT_INCOMPLETE_WAVE_RECONCILE_BEFORE_RETRY/);
 assert.equal(measurementCalls,50);
 assert.equal(fs.existsSync(path.join(output,'wave-1.json')),false);
 const persisted=fs.readFileSync(path.join(output,'wave-0.json'),'utf8');
 const wave=JSON.parse(persisted);
 assert(wave.samples.every(sample=>sample.ok===false));
 assert.equal(wave.samples[0].provider_id,providerIds[0]);
 assert.deepEqual(wave.samples[0].failure,{kind:'invalid_json',http_status:503});
 assert.equal(wave.samples[1].provider_id,providerIds[1]);
 assert.deepEqual(wave.samples[1].failure,{kind:'http_error',http_status:503,error_code:'TEMPORARY_FAILURE'});
 assert.equal(wave.samples[2].provider_id,null);
 assert.deepEqual(wave.samples[2].failure,{kind:'timeout',http_status:null});
 assert.deepEqual(wave.samples[3].failure,{kind:'http_error',http_status:503});
 assert(!persisted.includes('private provider')&&!persisted.includes('private timeout')&&!persisted.includes('UNKNOWN_PRIVATE_CODE'));
});

test('recovery clocks measure lost time and time since detection separately',()=>{
 const clock={recovery_point_at:'2026-11-23T10:00:00.000Z',incident_at:'2026-11-24T10:00:00.000Z',
  detected_at:'2026-11-24T10:03:00.000Z',recovered_at:'2026-11-24T18:03:00.000Z'};
 assert.deepEqual(recoveryTimings(clock),{rpo_ms:86400000,rto_ms:28800000,rpo_within_24h:true,rto_within_8h:true});
 assert.equal(recoveryTimings({...clock,recovered_at:'2026-11-24T18:03:00.001Z'}).rto_within_8h,false);
 assert.throws(()=>recoveryTimings({...clock,incident_at:clock.recovered_at}),/TIMELINE_INVALID/);
});


test('pilot persists an ambiguous first wave and leaves later writes unissued',async()=>{
 const projectRef='fuiidquhnqevrozizdcj',orgs=Array.from({length:10},()=>id());
 const config={projectRef,sourceSha:'b'.repeat(40),deploymentId:projectRef+'_'+id()+'_2',
  actors:Array.from({length:50},(_,i)=>({account:id(),org:orgs[Math.floor(i/5)]})),
  activeStudents:Object.fromEntries(orgs.map(org=>[org,500]))};
 const waves=[];
 let calls=0;
 const adapters={invoke:async({slot})=>{
  calls++;
  if(slot.actor===0)throw Error('synthetic diagnostic not retained');
  return {ok:true,provider_request_id:id()};
 },saveWave:async wave=>waves.push(wave)};
 await assert.rejects(capturePilot({...config,projectRef:'other',...adapters}),/SOURCE_TARGET/);
 await assert.rejects(capturePilot({...config,activeStudents:{},...adapters}),/TENANT_PROFILE/);
 assert.equal(calls,0);
 await assert.rejects(capturePilot({...config,...adapters}),/INCOMPLETE_WAVE/);
 assert.equal(calls,50);assert.equal(waves.length,1);
 assert.equal(waves[0].samples.filter(row=>!row.ok).length,1);
 assert.equal(waves[0].samples[0].provider_id,null);
 assert(!JSON.stringify(waves).includes('synthetic diagnostic'));
});
