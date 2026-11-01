import test from 'node:test';
import assert from 'node:assert/strict';
import {apiSuites} from '../scripts/ci/select-tests.mjs';
import {join} from 'node:path';
import {shardPlan,predictedWall,apiBalancePolicy,durations,apiTimeBalance} from '../scripts/ci/shards.mjs';
import {measurements} from '../scripts/ci/collect.mjs';
import {durationSnapshot} from '../scripts/ci/refresh-suite-durations.mjs';
import fs,{mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {validateBinding} from '../scripts/ci/gate.mjs';
import {repositoryRoot} from '../scripts/paths.mjs';
import {jobsWithApiSeconds,valid} from './ci-fixtures.mjs';
process.chdir(repositoryRoot);

function measuredMainBundle(){
 const run={id:99,run_attempt:2,head_sha:'a'.repeat(40),head_branch:'main',event:'push',name:'Main clean acceptance',status:'completed',conclusion:'success'};
 const jobs=['core','api-1','api-2','api-3','api-4','full-clean'].map((role,i)=>({id:i+10,name:'clean / '+role,run_id:run.id,run_attempt:run.run_attempt,head_sha:run.head_sha,status:'completed',conclusion:'success',steps:[{name:role==='full-clean'?'Verify all required jobs':'Clean acceptance',conclusion:'success'}]}));
 const logs={};for(let i=0;i<4;i++){
  const samples=apiSuites.filter((_,j)=>j%4===i).map(p=>'### '+p.split('/').at(-1)+'\n\nProcess wall: 10.00 s (includes setup/waits);').join('\n');
  logs[jobs[i+1].id]='Supabase CLI: 2.122.0\nClean phase timings: '+JSON.stringify({role:'api',shard:i+1,tests_s:100})+'\n'+samples+'\n';
 }
 return {run,jobs,logs};
}

test('four deterministic measured shards partition every suite exactly once with bounded weight imbalance',()=>{
 const bins=shardPlan();assert.equal(bins.length,4);
 assert.deepEqual(bins.flatMap(b=>b.suites).sort(),[...apiSuites].sort());
 assert.equal(new Set(bins.flatMap(b=>b.suites)).size,apiSuites.length);
 assert.deepEqual(bins,shardPlan([...apiSuites].reverse()));
 assert(Math.max(...bins.map(b=>b.weight))/Math.min(...bins.map(b=>b.weight))<1.08);
 assert.throws(()=>shardPlan([...apiSuites,apiSuites[0]]));
 assert.throws(()=>shardPlan([...apiSuites,'apps/backend/tests/unknown.test.mjs']));
 assert.throws(()=>shardPlan(apiSuites.slice(1)));
});

test('measurement distinguishes queue setup test wall and runner time',()=>{
 const rows=measurements([{name:'clean / api-1',status:'completed',conclusion:'success',created_at:'2026-01-01T00:00:00Z',started_at:'2026-01-01T00:00:10Z',completed_at:'2026-01-01T00:02:00Z',steps:[{name:'Clean acceptance',started_at:'2026-01-01T00:00:30Z',completed_at:'2026-01-01T00:01:50Z'}]}],'2026-01-01T00:00:00Z');
 assert.equal(rows[0].queue_s,10);assert.equal(rows[0].setup_s,20);assert.equal(rows[0].test_s,80);assert.equal(rows[0].runner_s,110);
});

test('duration refresh requires successful same-source same-attempt executed jobs and one complete measured inventory',()=>{
 const source=measuredMainBundle(),snapshot=durationSnapshot(source);
 assert.equal(snapshot.source,source.run.head_sha);assert.equal(snapshot.run_attempt,2);assert.equal(snapshot.cli_version,'2.122.0');assert.equal(Object.keys(snapshot.seconds).length,apiSuites.length);
 for(const mutate of [
  x=>x.run.conclusion='failure',x=>x.run.event='pull_request',x=>x.run.head_branch='other',x=>x.run.head_sha='invalid',
  x=>x.jobs[2].run_attempt=1,x=>x.jobs[2].head_sha='b'.repeat(40),x=>x.jobs[5].conclusion='failure',x=>x.jobs[1].steps[0].conclusion='skipped',
  x=>delete x.logs[11],x=>x.logs[11]=x.logs[11].replace('Process wall: 10.00','Process wall: 0.00'),
  x=>x.logs[11]+='### unknown.test.mjs\n\nProcess wall: 1.00 s\n',
  x=>x.logs[11]+=x.logs[12].split('Clean phase timings:')[0]+'### '+apiSuites[0].split('/').at(-1)+'\n\nProcess wall: 10.00 s\n',
  x=>x.logs[11]=x.logs[11].replace('2.122.0','2.121.0'),x=>x.logs[11]+='Supabase CLI: 2.121.0\n',x=>x.logs[11]+='currently installed v2.121.0)\n',x=>x.logs[11]=x.logs[11].replace('"shard":1','"shard":2'),
  x=>x.logs[11]=x.logs[11].replace('### '+apiSuites[0].split('/').at(-1),'### missing')
 ]){const input=measuredMainBundle();mutate(input);assert.throws(()=>durationSnapshot(input));}
});

test('current two-slot balance avoids the late long-suite queue and retains the measured weight bound',()=>{
 assert.equal(predictedWall(['apps/backend/tests/c.test.mjs','apps/backend/tests/b.test.mjs','apps/backend/tests/a.test.mjs'],{a:1,b:1,c:100}),101);
 const bins=shardPlan(),walls=bins.map(b=>predictedWall(b.suites));
 assert(Math.max(...walls)/Math.min(...walls)<=apiBalancePolicy.max_ratio);
 const lowerBound=Math.max(...Object.values(durations.seconds),Object.values(durations.seconds).reduce((a,b)=>a+b,0)/8);
 assert(Math.max(...walls)<=lowerBound*1.08);
 // A caller cannot alter a later runner's cached coverage/scheduling decision.
 const copy=shardPlan();copy[0].suites.pop();assert.deepEqual(shardPlan([...apiSuites].reverse()),bins);
 for(const bad of [0,-1,NaN,Infinity])assert.throws(()=>shardPlan(apiSuites,{...durations.seconds,[Object.keys(durations.seconds)[0]]:bad}));
});

test('installed Node runner really queues explicit files lexically in the two process slots modeled by the planner',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ftk-queue-model-')),trace=join(dir,'starts.jsonl');
 try{
  for(const name of ['a','b','c']){
   const script=["import fs from 'node:fs';import test from 'node:test';",`test('${name}',async()=>{`,
    ` const trace=${JSON.stringify(trace)};fs.appendFileSync(trace,JSON.stringify('${name}')+'\\n');`,
    ` if('${name}'!=='c'){const deadline=Date.now()+4000;while(!['a','b'].every(n=>fs.readFileSync(trace,'utf8').trim().split('\\n').map(JSON.parse).includes(n))){if(Date.now()>deadline)throw Error('First two runner slots did not start');await new Promise(r=>setTimeout(r,5));}}`,
    '});'].join('\n');
   writeFileSync(join(dir,name+'.test.mjs'),script);
  }
  execFileSync(process.execPath,['--test','--test-concurrency=2',...['c','b','a'].map(n=>join(dir,n+'.test.mjs'))],{stdio:'pipe',timeout:10000,env:Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.startsWith('NODE_TEST_')))});
  const starts=fs.readFileSync(trace,'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(starts.slice(0,2).sort(),['a','b']);assert.equal(starts[2],'c');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('measurement maintenance accepts actual PR clean logs but rejects proof-only main as test evidence',()=>{
 const input=measuredMainBundle();input.run={...input.run,name:'PR #78 · exact-head',path:'.github/workflows/ci-full.yml',event:'pull_request',head_branch:'candidate'};
 assert.equal(Object.keys(durationSnapshot(input).seconds).length,apiSuites.length);
 input.run={...input.run,name:'Main acceptance',path:'.github/workflows/backend.yml',event:'push',head_branch:'main'};assert.throws(()=>durationSnapshot(input),/full clean run/);
});

test('historical suite measurement still retains its original eight-percent predicted-wall regression',()=>{
 const seconds={'api-acceptance':353.15,'availability-policies':157.42,'cross-center-settlement':646.05,'event-cancellation':801.18,'event-payment':663.4,'instructor-earnings':649.3,'p01-catalog-entitlement-reads':161.7,'p01-lesson-requests':169.06,'p01-waitlist-workers':141.83,'person-registry':310.53,'program-session-lifecycle':723.19,registry:855.73,'room-role-registry':122.54,'schedule-reads':228.36,'starter-attendance-protection':433.87};
 const walls=shardPlan(apiSuites,seconds).map(b=>predictedWall(b.suites,seconds));assert(Math.max(...walls)/Math.min(...walls)<1.08);
});

test('real PR77 imbalance is visible without blocking successful functional and source acceptance',()=>{
 const v=jobsWithApiSeconds([1651,1102,793,1167]),report=apiTimeBalance(v.jobs,v.run);
 assert.equal(report.gap_s,858);assert(report.ratio>2);assert.equal(report.balanced,false);assert.equal(report.balanced,false);
 assert(validateBinding(v));
 const balanced=jobsWithApiSeconds([1600,1450,1490,1400]);assert(validateBinding(balanced));
 // New assertions inside an existing file require no inventory delta to be caught.
 balanced.jobs.find(j=>j.name==='api-3').steps[0].completed_at='2026-01-01T00:40:00Z';assert(validateBinding(balanced));assert.equal(apiTimeBalance(balanced.jobs,balanced.run).balanced,false);
});

test('actual balance uses explicit jitter bounds and rejects missing mixed or duplicate timing evidence',()=>{
 for(const values of [[600,600,600,750],[60,60,60,180]]){const v=jobsWithApiSeconds(values);assert.equal(apiTimeBalance(v.jobs,v.run).balanced,true);}
 const tooSlow=jobsWithApiSeconds([600,600,600,751]);assert.equal(apiTimeBalance(tooSlow.jobs,tooSlow.run).balanced,false);
 for(const mutate of [v=>v.jobs.splice(1,1),v=>v.jobs.push(structuredClone(v.jobs[1])),v=>v.jobs[1].run_attempt=2,v=>v.jobs[1].head_sha='other',v=>v.jobs[1].conclusion='skipped',v=>delete v.jobs[1].steps[0].started_at,v=>v.jobs[1].steps[0].completed_at='invalid',v=>v.jobs[1].steps[0].completed_at=v.jobs[1].steps[0].started_at,v=>v.jobs[1].steps.push(structuredClone(v.jobs[1].steps[0]))]){const v=valid();mutate(v);assert.throws(()=>apiTimeBalance(v.jobs,v.run));}
 const old=valid();delete old.binding.balance_policy;assert(validateBinding(old));
});
