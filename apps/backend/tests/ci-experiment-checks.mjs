import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {repositoryRoot} from '../scripts/paths.mjs';
import {buildInventory,partition,materialize,executionPhases} from '../scripts/ci/experiment/suites.mjs';

test('experimental inventory covers every original byte and every imported acceptance exactly once',()=>{
 const inventory=buildInventory(repositoryRoot);
 assert.equal(inventory.originals,15);
 assert(inventory.splitOriginals>=9);
 assert(inventory.units.length>30);
 assert.equal(new Set(inventory.units.map(u=>u.id)).size,inventory.units.length);
 const bins=partition(inventory.units);
 assert.equal(bins.length,8);
 assert(bins.every(b=>b.units.length>0));
 assert.deepEqual(bins.flatMap(b=>b.units.map(u=>u.id)).sort(),inventory.units.map(u=>u.id).sort());
 assert.deepEqual(bins,partition([...inventory.units].reverse()));
 assert.throws(()=>partition([...inventory.units,inventory.units[0]]),/Duplicate/);
});

test('changed source, missing source, range gap and duplicate ownership fail before running any API',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../scripts/ci/experiment/suites.json',import.meta.url)));
 const read=p=>fs.readFileSync(path.join(repositoryRoot,p),'utf8');
 assert.throws(()=>buildInventory(repositoryRoot,{read:p=>read(p)+'\n'}),/source changed/);
 assert.throws(()=>buildInventory(repositoryRoot,{read:()=>{throw Error('missing');}}),/missing/);
 const gap=structuredClone(manifest);gap.suites.find(s=>s.shared).shared[0][0]++;
 assert.throws(()=>buildInventory(repositoryRoot,{manifest:gap}),/coverage/);
 const duplicate=structuredClone(manifest);duplicate.suites[0].parts.push(structuredClone(duplicate.suites[0].parts[0]));
 assert.throws(()=>buildInventory(repositoryRoot,{manifest:duplicate}),/coverage|Duplicate/);
});

test('generated fragments compile with original import locations and unchanged assertion bodies',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'ftk-experiment-'));
 try{
  const inventory=buildInventory(repositoryRoot);
  const files=materialize(inventory,dir);
  assert.equal(files.length,inventory.units.length);
  for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  for(const unit of inventory.units)execFileSync(process.execPath,['--input-type=module','--check'],{input:unit.code,stdio:['pipe','pipe','pipe']});
  const room=inventory.units.find(u=>u.id==='room-role-registry-root-1');
  assert(room.code.includes('import.meta.url'));
  const output=fs.readFileSync(files[inventory.units.indexOf(room)],'utf8');
  assert(output.includes(JSON.stringify(path.join(repositoryRoot,'apps/backend/tests/room-role-registry.test.mjs')).slice(1,-1)));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

// Execute the actual native hook, including relative dynamic import and module URL.
test('fragment execution keeps original module URLs and does not execute excluded source',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'ftk-hook-'));
 try{
  fs.writeFileSync(path.join(dir,'original.mjs'),"throw Error('original body must be replaced');\n");
  fs.writeFileSync(path.join(dir,'helper.mjs'),"export default 42;\n");
  const code="import value from './helper.mjs'; const dynamic=await import('./helper.mjs'); if(value!==42||dynamic.default!==42)throw Error('import mismatch'); console.log(import.meta.url);";
  const [file]=materialize({root:dir,units:[{id:'probe',source:'original.mjs',code}]},path.join(dir,'generated'));
  assert.equal(execFileSync(process.execPath,[file],{encoding:'utf8'}).trim(),new URL('file://'+path.join(dir,'original.mjs')).href);
  assert(fs.readFileSync(path.join(dir,'original.mjs'),'utf8').startsWith('throw Error'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

import {resolveReference,assertUnchangedRun,jobMeasurements,summarize} from '../scripts/ci/experiment/reference.mjs';
test('baseline changes and failed attempts cannot be used in a comparison',()=>{
 const reference={run_id:12,attempt:2,head:'head'};
 const live={id:12,run_attempt:2,head_sha:'head',status:'completed',conclusion:'success'};
 assertUnchangedRun(reference,live);
 for(const delta of [{id:13},{run_attempt:3},{head_sha:'other'},{status:'in_progress'},{conclusion:'failure'}])assert.throws(()=>assertUnchangedRun(reference,{...live,...delta}),/changed/);
});

test('comparison separates queue, executed runner and clean test wall time',()=>{
 const rows=jobMeasurements([{name:'api',conclusion:'success',created_at:'2026-01-01T00:00:00Z',started_at:'2026-01-01T00:00:10Z',completed_at:'2026-01-01T00:02:00Z',steps:[{name:'Experimental API tests',started_at:'2026-01-01T00:00:30Z',completed_at:'2026-01-01T00:01:50Z'}]}]);
 assert.deepEqual(rows,[{name:'api',conclusion:'success',started_at:'2026-01-01T00:00:10Z',completed_at:'2026-01-01T00:02:00Z',queue_s:10,runner_s:110,test_s:80}]);
});

import {candidateProofFixture} from './ci-fixtures.mjs';
test('reference requires complete original candidate and quality receipts on the same source/attempt',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'ftk-reference-'));
 try{
  for(const mutation of [null,'event','path','job','quality','attempt','manual-branch']){
   const f=candidateProofFixture(dir,{rerun:true});
   const context={repo:f.repo,sha:'installed',ref:'refs/heads/main',eventName:'workflow_dispatch'};
   f.github.rest.actions.listJobsForWorkflowRunAttempt='attempt-jobs';
   const paginate=f.github.paginate;
   f.github.paginate=async(method,args)=>method==='attempt-jobs'?f.v.jobs:paginate(method,args);
   if(mutation==='event')f.v.run.event='push';
   if(mutation==='path')f.v.run.path='.github/workflows/backend-experiment.yml';
   if(mutation==='job')f.v.jobs.find(j=>j.name==='api-1').conclusion='failure';
   if(mutation==='quality')f.v.jobs.find(j=>j.name==='quality').steps[2].conclusion='skipped';
   if(mutation==='attempt')f.v.run.run_attempt=3;
   if(mutation==='manual-branch')context.ref='refs/heads/other';
   if(mutation)await assert.rejects(()=>resolveReference(f.github,context,'5'));
   else{const result=await resolveReference(f.github,context,'5');assert.equal(result.merge,'M');assert.equal(result.attempt,2);}
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('global worker and security fixtures never overlap another file in the same database',()=>{
 const inventory=buildInventory(repositoryRoot);
 const exclusive=inventory.units.filter(u=>u.exclusive);
 assert.equal(exclusive.length,5);
 const phases=executionPhases(inventory.units);
 assert.equal(phases.filter(p=>p.concurrency===1).length,5);
 for(const phase of phases){
  if(phase.units.some(u=>u.exclusive)){assert.equal(phase.concurrency,1);assert.equal(phase.units.length,1);}
 }
 assert.deepEqual(phases.flatMap(p=>p.units.map(u=>u.id)).sort(),inventory.units.map(u=>u.id).sort());
 const manifest=JSON.parse(fs.readFileSync(new URL('../scripts/ci/experiment/suites.json',import.meta.url)));
 manifest.exclusive=[];
 assert.throws(()=>buildInventory(repositoryRoot,{manifest}),/Global fixture/);
});

test('collector compares matched core/API costs and rejects missing experimental source steps',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'ftk-compare-')),cwd=process.cwd();
 try{
  process.chdir(dir);
  const reference={run_id:5,attempt:1,head:'H'};
  const current={id:50,run_attempt:1,head_sha:'D',status:'in_progress'};
  const baseline={id:5,run_attempt:1,head_sha:'H',status:'completed',conclusion:'success'};
  const make=(name,run)=>({name,run_id:run.id,run_attempt:run.run_attempt,head_sha:run.head_sha,status:'completed',conclusion:'success',created_at:'2026-01-01T00:00:00Z',started_at:'2026-01-01T00:00:10Z',completed_at:'2026-01-01T00:01:10Z',steps:(name==='reference'?['Validate baseline','Validate experiment inventory']:['Verify source checkout',name==='core'?'Clean acceptance':'Experimental API tests']).map(name=>({name,conclusion:'success'}))});
  const jobs=['reference','core',...Array.from({length:8},(_,i)=>'experiment-api-'+(i+1))].map(n=>make(n,current));
  const old=['core','api-1','api-2','api-3','api-4','quality','full-clean'].map(n=>make(n,baseline));
  const github={rest:{actions:{getWorkflowRun:async({run_id})=>({data:run_id===5?baseline:current}),listJobsForWorkflowRunAttempt:'jobs'}},paginate:async(method,args)=>args.run_id===5?old:jobs};
  const context={repo:{},runId:50,sha:'D'},core={summary:{addRaw(){return this;},async write(){}}};
  await summarize(github,context,core,reference);
  const result=JSON.parse(fs.readFileSync('.artifacts/ci/experiment/comparison.json'));
  assert.deepEqual(result.matched_core_api.runner_minutes,{baseline:5,experiment:9});
  assert.deepEqual(result.matched_core_api.execution_window_s,{baseline:60,experiment:60});
  assert.equal(result.overhead.baseline.length,2);assert.equal(result.overhead.experiment.length,1);
  jobs[2].steps[0].conclusion='failure';
  await assert.rejects(()=>summarize(github,context,core,reference),/Unexecuted/);
 }finally{process.chdir(cwd);rmSync(dir,{recursive:true,force:true});}
});

test('optional dedicated placement retains the original complete ST-02 body and timeout',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../scripts/ci/experiment/suites.json',import.meta.url)));
 manifest.dedicatedRunners=['starter-operations-acceptance'];
 const full=manifest.suites.flatMap(s=>s.imports).find(item=>item.path.endsWith('starter-operations-acceptance.mjs'));
 delete full.parts;delete full.shared;
 const inventory=buildInventory(repositoryRoot,{manifest});
 const bins=partition(inventory.units);
 const bin=bins.find(b=>b.units.some(u=>u.id==='starter-operations-acceptance'));
 assert.equal(bin.units.length,1,'ST-02 cannot compete with ST-03 or another file for the same native Edge runtime');
 const unit=bin.units[0];
 assert.equal(unit.code,fs.readFileSync(path.join(repositoryRoot,unit.source),'utf8'));
 assert(unit.code.includes('{timeout:300000}'));
 assert.equal(bins.length,8);
 assert.deepEqual(bins.flatMap(b=>b.units.map(u=>u.id)).sort(),inventory.units.map(u=>u.id).sort());
 assert.deepEqual(bins,partition([...inventory.units].reverse()));
});

test('measurement balances eight active runners with completed source-bound samples',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../scripts/ci/experiment/suites.json',import.meta.url)));
 // The historical run retains 47 samples; changed root bodies must not reuse them as current measurements.
 let inventory={units:Object.entries(manifest.measurements.units).map(([id,sample])=>({...sample,id,weight_source:'measured'}))};
 assert.equal(inventory.units.filter(u=>u.weight_source==='measured').length,47);
 inventory=buildInventory(repositoryRoot);const bins=partition(inventory.units);
 const {createHash}=await import('node:crypto');
 for(const unit of inventory.units){
  const matches=manifest.measurements.units[unit.id]?.sha256===createHash('sha256').update(unit.code).digest('hex');
  assert.equal(unit.weight_source==='measured',matches);
 }
 assert(bins.find(b=>b.units.some(u=>u.id==='starter-operations-acceptance')).units.length>1);
 assert.equal(inventory.units.find(u=>u.id==='starter-operations-acceptance').dedicated,false);
 const heavy=bins.map(b=>b.projected_wall_seconds);
 const lowerBound=Math.max(...inventory.units.map(u=>u.estimated_seconds),inventory.units.reduce((sum,u)=>sum+u.estimated_seconds,0)/16);
 assert(Math.max(...heavy)<=lowerBound*1.05);
});

test('measurement removes root and nested test budgets while request deadlines and assertions still fail',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'ftk-measurement-'));
 try{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>key!=='NODE_TEST_CONTEXT'));
  const source=path.join(dir,'tests','probe.mjs');fs.mkdirSync(path.dirname(source));
  const body=`import test from 'node:test'; import assert from 'node:assert/strict';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('root',{timeout:1},async t=>{await wait(30); const original=t.test.bind(t);t.test=(name,options,fn)=>original(name,{timeout:1,...options},fn); await t.test('nested',{timeout:1},async t=>{await wait(30);await t.test('deep',{timeout:1},async()=>{await wait(30);assert.equal(2,2);});});});`;
  fs.writeFileSync(source,body);
  const inventory={root:dir,units:[{id:'probe',source:'tests/probe.mjs',code:body}]};
  const [file]=materialize(inventory,path.join(dir,'normal'));
  assert.throws(()=>execFileSync(process.execPath,['--test',file],{stdio:'pipe',env}));
  const [measured]=materialize(inventory,path.join(dir,'measurement'),{measurement:true});
  const report=path.join(dir,'tests.jsonl');
  const reporter=new URL('../scripts/ci/experiment/timing-reporter.mjs',import.meta.url).pathname;
  const result=execFileSync(process.execPath,['--test','--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter='+reporter,'--test-reporter-destination='+report,measured],{encoding:'utf8',env});
  assert(result.includes('pass 3'));
  const rows=fs.readFileSync(report,'utf8').trim().split('\n').map(row=>JSON.parse(row));
  assert.deepEqual(rows.map(row=>row.name).sort(),['deep','nested','root']);
  assert(rows.every(row=>row.type==='test:pass'&&row.duration_ms>=30));
  assert.equal(fs.readFileSync(source,'utf8'),body);
  for(const failing of [body.replace('assert.equal(2,2)','assert.equal(2,3)'),body.replace('await wait(30);assert.equal(2,2);','await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("REQUEST_DEADLINE")),10);});')]){
   const [bad]=materialize({...inventory,units:[{id:'failing',source:'tests/probe.mjs',code:failing}]},path.join(dir,'failure'),{measurement:true});
   assert.throws(()=>execFileSync(process.execPath,['--test',bad],{stdio:'pipe',env}));
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('stale duration samples fall back to explicit seeds and invalid matching samples fail closed',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../scripts/ci/experiment/suites.json',import.meta.url)));
 const id='account-identity-acceptance';
 manifest.measurements.units[id].sha256='0'.repeat(64);
 const stale=buildInventory(repositoryRoot,{manifest}).units.find(unit=>unit.id===id);
 assert.equal(stale.weight_source,'source-size-seed');
 const current=JSON.parse(fs.readFileSync(new URL('../scripts/ci/experiment/suites.json',import.meta.url)));
 current.measurements.units[id].seconds=-1;
 assert.throws(()=>buildInventory(repositoryRoot,{manifest:current}),/Invalid measured duration/);
});


test('imported multi-root modules have complete ownership and reject missing or duplicate root ranges',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../scripts/ci/experiment/suites.json',import.meta.url)));
 const imported=manifest.suites.flatMap(s=>s.imports).find(item=>item.path.endsWith('starter-operations-acceptance.mjs'));
 assert.equal(imported.parts.length,2);
 imported.parts[0].ranges[0][0]++;
 assert.throws(()=>buildInventory(repositoryRoot,{manifest}),/coverage/);
 const duplicate=JSON.parse(fs.readFileSync(new URL('../scripts/ci/experiment/suites.json',import.meta.url)));
 const entry=duplicate.suites.flatMap(s=>s.imports).find(item=>item.path.endsWith('starter-operations-acceptance.mjs'));
 entry.parts.push(structuredClone(entry.parts[0]));
 assert.throws(()=>buildInventory(repositoryRoot,{manifest:duplicate}),/coverage|Duplicate/);
});

test('singleton platform setting writers retain one ordered file unit while user roots remain independent',()=>{
 const units=buildInventory(repositoryRoot).units.filter(unit=>unit.source.endsWith('frontend-settings-acceptance.mjs'));
 const tenant=units.find(unit=>unit.code.includes("test('Tenant settings authority"));
 const catalog=units.find(unit=>unit.code.includes("test('Typed settings catalog"));
 const user=units.find(unit=>unit.code.includes("test('User settings concurrency"));
 assert.equal(tenant,catalog);
 assert.notEqual(tenant,user);
 assert(tenant.code.indexOf("test('Tenant settings authority")<tenant.code.indexOf("test('Typed settings catalog"));
 assert.equal(units.length,4);
});
