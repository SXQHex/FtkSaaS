import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import {repositoryRoot} from '../scripts/paths.mjs';
import {buildInventory,partition,executionPhases,materialize} from '../scripts/ci/api-suites.mjs';
import {freezeSchedule,scheduledPlan,validateSchedule,measuredReference,candidateSchedule,latestReference} from '../scripts/ci/duration-reference.mjs';
import {createHash} from 'node:crypto';
import {receipt} from '../scripts/ci/gate.mjs';

test('frozen timing schedules bind weights and complete inventory to one plan',()=>{
 const units=buildInventory(repositoryRoot).units;
 const reference={run_id:4,attempt:1,head:'a'.repeat(40),merge:'b'.repeat(40),tree:'c'.repeat(40),units:{[units[0].id]:{seconds:42,sha256:'bad'}}};
 const frozen=freezeSchedule(units,reference);
 assert.equal(frozen.units[units[0].id].seconds,units[0].estimated_seconds);
 assert.equal(frozen.units[units[0].id].origin,'source-snapshot');
 assert.equal(scheduledPlan(units,frozen).flatMap(b=>b.units).length,units.length);
 assert.equal(validateSchedule(frozen,units),true);
 for(const mutate of [x=>x.units[units[0].id].seconds++,x=>delete x.units[units[0].id],x=>x.plan[0].units.pop(),x=>x.reference.attempt++]){
  const changed=structuredClone(frozen);mutate(changed);assert.throws(()=>validateSchedule(changed,units));
 }
});

test('all completed process samples are required, including SQL-only units',()=>{
 const units=buildInventory(repositoryRoot).units,schedule=freezeSchedule(units);
 const binding={profile:'twelve-timed-v1',run_id:4,attempt:2,head:'a'.repeat(40),merge:'b'.repeat(40),tree:'c'.repeat(40),schedule};
 const samples={},jobs=schedule.plan.map(b=>({id:b.shard+100,name:'clean / api-'+b.shard}));
 for(const b of schedule.plan)samples['api-'+b.shard]={role:'api-'+b.shard,run_id:4,attempt:1,head:binding.head,merge:binding.merge,schedule:schedule.sha256,units:b.units.map(id=>({id,sha256:schedule.units[id].sha256,seconds:2,exit_code:0}))};
 const reference=measuredReference(binding,jobs,samples);
 assert.equal(Object.keys(reference.units).length,91);
 assert(reference.units['canonical-settings-migration-acceptance']);
 const frozen=freezeSchedule(units,reference);assert(Object.values(frozen.units).every(u=>u.origin==='previous-success'&&u.seconds===2));
 for(const mutate of [x=>x['api-12'].units.pop(),x=>x['api-1'].attempt=3,x=>x['api-1'].run_id=5,x=>x['api-1'].schedule='other',x=>x['api-1'].units[0].sha256='other',x=>x['api-1'].units[0].seconds=0,x=>x['api-1'].units[0].exit_code=1]){
  const bad=structuredClone(samples);mutate(bad);assert.throws(()=>measuredReference(binding,jobs,bad));
 }
 const changed=structuredClone(reference);changed.units[units[0].id].sha256='other';
 assert.equal(freezeSchedule(units,changed).units[units[0].id].origin,'source-snapshot');
});

test('candidate reruns recover the original schedule without consulting latest timings',async()=>{
 const schedule=freezeSchedule(buildInventory(repositoryRoot).units),binding={kind:'full',profile:'twelve-timed-v1',coverage:'coverage',pr:1,head:'H',base:'B',merge:'M',tree:'T',run_id:4,attempt:1,schedule};
 const zip=execFileSync('python3',['-c','import io,json,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,"w"); z.writestr("candidate-source.json",sys.argv[1]); z.close(); sys.stdout.buffer.write(b.getvalue())',JSON.stringify(binding)]);
 const github={paginate:async()=>[{id:1,name:'candidate-source',size_in_bytes:zip.length}],rest:{actions:{listWorkflowRunArtifacts:'artifacts',downloadArtifact:async()=>({data:zip}),listWorkflowRuns:async()=>{throw Error('Rerun must never reselect durations');}}}};
 assert.deepEqual(await candidateSchedule(github,{repo:{}},{...binding,attempt:2},()=>{}),binding);
 await assert.rejects(candidateSchedule(github,{repo:{}},{...binding,attempt:2,base:'changed'},()=>{}),/source changed/);
 github.paginate=async()=>[];await assert.rejects(candidateSchedule(github,{repo:{}},{...binding,attempt:2},()=>{}),/Missing/);
});

test('failed and in-progress workflows never become a timing reference',async()=>{
 const warnings=[];
 const github={rest:{actions:{listWorkflowRuns:async()=>({data:{workflow_runs:[{id:1,status:'completed',conclusion:'failure'},{id:2,status:'in_progress',conclusion:null}]}})}},paginate:async()=>{throw Error('Failed run artifacts must not be read');}};
 assert.equal(await latestReference(github,{},m=>warnings.push(m)),null);
 assert.equal(warnings.length,1);
});

test('native materialized processes record wall time and source hash without API requests',()=>{
 const dir=fs.mkdtempSync(path.join(tmpdir(),'ftk-unit-wall-'));
 try{
  const source='tests/sql-only.mjs',code="import test from 'node:test';\ntest('SQL-only probe',()=>{});\n";
  fs.mkdirSync(path.join(dir,'tests'));fs.writeFileSync(path.join(dir,source),code);
  const timingDirectory=path.join(dir,'timings');
  const [file]=materialize({root:dir,units:[{id:'sql-only',source,code}]},path.join(dir,'wrappers'),{timingDirectory});
  execFileSync(process.execPath,['--test',file],{stdio:'pipe',env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('NODE_TEST_')))});
  const sample=JSON.parse(fs.readFileSync(path.join(timingDirectory,'sql-only.json')));
  assert.equal(sample.id,'sql-only');assert.equal(sample.exit_code,0);
  assert.equal(sample.sha256,createHash('sha256').update(code).digest('hex'));
  assert(sample.seconds>0&&sample.seconds<30);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a successful source-bound reference is reused and a newer failed attempt cannot be borrowed',async()=>{
 const units=buildInventory(repositoryRoot).units,schedule=freezeSchedule(units);
 const binding={kind:'full',profile:'twelve-timed-v1',run_id:91,attempt:1,head:'a'.repeat(40),base:'d'.repeat(40),merge:'b'.repeat(40),tree:'c'.repeat(40),schedule};
 const reference={version:1,run_id:91,attempt:1,head:binding.head,merge:binding.merge,tree:binding.tree,units:Object.fromEntries(units.map(u=>[u.id,{seconds:3,sha256:schedule.units[u.id].sha256}]))};
 const run={id:91,run_attempt:1,head_sha:binding.head,path:'.github/workflows/ci-full.yml',status:'completed',conclusion:'success',updated_at:'2026-11-05T01:00:00Z'};
 const jobs=['core',...schedule.plan.map(b=>'api-'+b.shard),'full-clean'].map(name=>({name:'clean / '+name,status:'completed',conclusion:'success',run_id:91,run_attempt:1,head_sha:binding.head,steps:[{name:name==='full-clean'?'Verify all required jobs':'Clean acceptance',conclusion:'success'},{name:'Verify tested merge',conclusion:'success'},...(name==='core'?[{name:'Upload schema baseline',conclusion:'success'}]:[])]}));
 const buffers=[reference,binding].map((body,i)=>execFileSync('python3',['-c','import io,sys,zipfile;b=io.BytesIO();z=zipfile.ZipFile(b,"w");z.writestr(sys.argv[1],sys.argv[2]);z.close();sys.stdout.buffer.write(b.getvalue())',i?'binding.json':'duration-reference.json',JSON.stringify(body)]));
 let live={...run};
 const github={rest:{git:{getCommit:async()=>({data:{tree:{sha:binding.tree},parents:[{sha:binding.base},{sha:binding.head}]}})},actions:{listWorkflowRuns:async()=>({data:{workflow_runs:[run]}}),listWorkflowRunArtifacts:'artifacts',listJobsForWorkflowRunAttempt:'jobs',downloadArtifact:async({artifact_id})=>({data:buffers[artifact_id]}),getWorkflowRun:async()=>({data:live})}},paginate:async method=>method==='jobs'?jobs:[{id:0,name:'api-duration-reference-1',size_in_bytes:buffers[0].length},{id:1,name:'candidate-binding-1',size_in_bytes:buffers[1].length}]};
 const accepted=await latestReference(github,{});assert.deepEqual(accepted,reference);
 assert.deepEqual(await receipt(github,{},run),binding);
 assert(Object.values(freezeSchedule(units,accepted).units).every(u=>u.seconds===3&&u.origin==='previous-success'));
 live={...run,run_attempt:2,conclusion:'failure'};assert.equal(await latestReference(github,{}),null);
 live={...run};jobs[1].conclusion='skipped';assert.equal(await latestReference(github,{}),null);
});

const behaviorSplits={
 'instructor-earnings-root-1':['earnings-publication','earnings-packages-corrections','earnings-valuation-closure','earnings-occurrence-authority','earnings-pilot'],
 'cross-center-provenance':['cross-center-deficit-sources','cross-center-no-transfer','cross-center-rounding','cross-center-source-scope'],
 'event-payment-root-1':['event-preparation','event-paid-capacity','event-financial-cancellation','event-payment-authority'],
 'api-acceptance-root-1':['api-bootstrap','api-shared-rights','api-live-authority','api-event-finance'],
 'event-cancellation-monetary':['event-cancellation-center-money','event-cancellation-participant-money'],
};

test('production inventory owns every original line and import once and compiles every payload',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../scripts/ci/api-suites.json',import.meta.url)));
 const inventory=buildInventory(repositoryRoot),bins=partition(inventory.units);
 const added=new Set(['document-self-requirements-acceptance','crm-application-intake-acceptance','crm-application-review-acceptance','starter-operations-report-shaping','starter-operations-import-templates','starter-operations-report-access','starter-operations-inbox','crm-provider-delivery-acceptance','crm-provider-authority-acceptance','crm-provider-webhook-acceptance','crm-meta-queue-acceptance','crm-meta-queue-authority-acceptance','crm-provider-host-acceptance']);
 for(const [retired,parts] of Object.entries(behaviorSplits)){
  assert(!inventory.units.some(u=>u.id===retired),'Retired acceptance unit '+retired);
  for(const id of parts)assert(inventory.units.some(u=>u.id===id),'Missing behavior '+id);
  // One representative replaces the original unit; other behaviors add capacity.
  for(const id of parts.slice(1))added.add(id);
 }
 assert.equal(inventory.units.length,64+added.size);
 for(const id of added)assert(inventory.units.some(u=>u.id===id),'Missing new acceptance unit '+id);
 // Keep 64 original units/representatives and their eight-shard invariant.
 {
  const inventory={units:buildInventory(repositoryRoot).units.filter(u=>!added.has(u.id))};
  const bins=partition(inventory.units);
 assert.equal(bins.length,8);assert.equal(inventory.units.length,64);
 }

 assert.deepEqual(bins.flatMap(b=>b.units.map(u=>u.id)).sort(),inventory.units.map(u=>u.id).sort());
 assert.deepEqual(partition([...inventory.units].reverse()),bins);
 assert.throws(()=>buildInventory(repositoryRoot,{read:p=>fs.readFileSync(path.join(repositoryRoot,p),'utf8')+'\n'}),/source changed/);
 const missing=structuredClone(manifest);missing.suites[0].parts[0].ranges[0][0]++;
 assert.throws(()=>buildInventory(repositoryRoot,{manifest:missing}),/coverage/);
 const duplicate=structuredClone(manifest);duplicate.suites[0].parts.push(structuredClone(duplicate.suites[0].parts[0]));
 assert.throws(()=>buildInventory(repositoryRoot,{manifest:duplicate}),/coverage|Duplicate/);
 const dir=fs.mkdtempSync(path.join(tmpdir(),'ftk-production-suites-'));
 try{for(const unit of inventory.units){const file=path.join(dir,unit.id+'.mjs');fs.writeFileSync(file,unit.code);execFileSync(process.execPath,['--check',file],{stdio:'pipe'});}}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
 const phases=executionPhases(inventory.units);
 assert.equal(inventory.units.filter(u=>u.exclusive).length,5);
 for(const phase of phases){if(phase.units.some(u=>u.exclusive)){assert.equal(phase.units.length,1);assert.equal(phase.concurrency,1);}else assert.equal(phase.concurrency,2);}

});

test('twelve-runner plan preserves every unit and serial fixture without dedicated assignment',()=>{
 const inventory=buildInventory(repositoryRoot),bins=partition(inventory.units,12);
 assert.equal(bins.length,12);
 assert(bins.every(b=>b.units.length>0));
 assert(inventory.units.every(u=>!u.dedicated));
 assert.deepEqual(bins.flatMap(b=>b.units.map(u=>u.id)).sort(),inventory.units.map(u=>u.id).sort());
 assert.deepEqual(partition([...inventory.units].reverse(),12),bins);
 for(const count of [0,-1,1.5,NaN,Infinity,inventory.units.length+1])assert.throws(()=>partition(inventory.units,count),/Invalid shard count/);
});

test('each behavior payload registers exactly one native root without running fixtures',()=>{
 const inventory=buildInventory(repositoryRoot),ids=new Set(Object.values(behaviorSplits).flat());
 for(const unit of inventory.units.filter(u=>ids.has(u.id))){
  const registered=[];
  const code=transformSync(unit.code,{format:'cjs',platform:'node',target:'node24'}).code;
  // Probe registration only: imports and native runtime fixtures never execute.
  const require=specifier=>specifier==='node:test'?(name,callback)=>registered.push({name,callback}):{};
  runInNewContext(code,{require},{timeout:1000});
  assert.equal(registered.length,1,'Missing/duplicate native root '+unit.id);
  assert.equal(typeof registered[0].callback,'function',unit.id);
 }
});

test('production hook preserves native test deadlines and failure propagation',()=>{
 const dir=fs.mkdtempSync(path.join(tmpdir(),'ftk-production-hook-'));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('NODE_TEST_')));
 try{
  fs.mkdirSync(path.join(dir,'tests'));
  const source='tests/probe.mjs',target=path.join(dir,source);
  const body="import test from 'node:test';import assert from 'node:assert/strict';\ntest('deadline',{timeout:1},async()=>{await new Promise(r=>setTimeout(r,50));assert(true);});\n";
  fs.writeFileSync(target,body);
  const inventory={root:dir,units:[{id:'probe',source,code:body}]};
  const [file]=materialize(inventory,path.join(dir,'wrappers'));
  const wrapper=fs.readFileSync(file,'utf8');assert(!wrapper.includes('measurement'));assert(!wrapper.includes('Infinity'));
  assert.throws(()=>execFileSync(process.execPath,['--test',file],{stdio:'pipe',env}));
  const bad=body.replace("{timeout:1}","{timeout:1000}").replace('assert(true)','assert(false)');
  const [failure]=materialize({...inventory,units:[{id:'failure',source,code:bad}]},path.join(dir,'wrappers'));
  assert.throws(()=>execFileSync(process.execPath,['--test',failure],{stdio:'pipe',env}));
  const good=body.replace('{timeout:1}','{timeout:1000}');
  const [success]=materialize({...inventory,units:[{id:'success',source,code:good}]},path.join(dir,'wrappers'));
  execFileSync(process.execPath,['--test',success],{stdio:'pipe',env});
  assert.equal(fs.readFileSync(target,'utf8'),body);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
