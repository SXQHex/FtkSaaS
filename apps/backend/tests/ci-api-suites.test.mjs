import {historicalApiUnitIds,declaredApiUnitIds} from './ci-fixtures.mjs';
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
 assert.deepEqual(Object.keys(reference.units).sort(),units.map(u=>u.id).sort());
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
 const added=new Set(['document-self-requirements-acceptance','crm-application-intake-acceptance','crm-application-review-acceptance','starter-operations-report-shaping','starter-operations-import-templates','starter-operations-report-access','starter-operations-inbox','crm-provider-delivery-acceptance','crm-provider-authority-acceptance','crm-provider-webhook-acceptance','crm-meta-queue-acceptance','crm-meta-queue-authority-acceptance','crm-provider-host-acceptance','crm-import-acceptance','crm-import-authority-acceptance','crm-lifecycle-authority-acceptance','crm-lifecycle-acceptance','crm-followup-projections-acceptance','crm-segment-worker-acceptance','crm-followup-acceptance']);
 for(const [retired,parts] of Object.entries(behaviorSplits)){
  assert(!inventory.units.some(u=>u.id===retired),'Retired acceptance unit '+retired);
  for(const id of parts)assert(inventory.units.some(u=>u.id===id),'Missing behavior '+id);
  // One representative replaces the original unit; other behaviors add capacity.
  for(const id of parts.slice(1))added.add(id);
 }
 assert.deepEqual(inventory.units.map(u=>u.id).sort(),declaredApiUnitIds().sort());
 for(const id of added)assert(inventory.units.some(u=>u.id===id),'Missing new acceptance unit '+id);
 // Keep 64 original units/representatives and their eight-shard invariant.
 {
  const inventory={units:buildInventory(repositoryRoot).units.filter(u=>historicalApiUnitIds.includes(u.id))};
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

test('manual full source requires main dispatch, exact commit and separate workflow identity',async()=>{
 const {manualRequest,manualBinding}=await import('../scripts/ci/manual-full.mjs');
 const context={eventName:'workflow_dispatch',ref:'refs/heads/main',sha:'a'.repeat(40),runId:77,payload:{inputs:{tested_sha:'b'.repeat(40)}},repo:{owner:'SXQHex',repo:'FtkSaaS'}};
 const request=manualRequest(context,1),inventory=buildInventory(repositoryRoot),manifest=JSON.parse(fs.readFileSync(path.join(repositoryRoot,'apps/backend/scripts/ci/api-suites.json')));
 const binding=manualBinding(request,{sha:'b'.repeat(40),tree:{sha:'c'.repeat(40)}},{inventory,manifest},null);
 assert.equal(binding.kind,'manual-full');assert.equal(binding.head,context.sha);assert.equal(binding.merge,context.payload.inputs.tested_sha);
 assert.equal(binding.schedule.plan.length,12);assert.equal(binding.pr,undefined);assert.equal(binding.benchmark,false);
 assert.deepEqual(binding.schedule.plan.flatMap(p=>p.units).sort(),inventory.units.map(u=>u.id).sort());
 for(const patch of [{eventName:'pull_request'},{ref:'refs/heads/feature'},{sha:'main'},{repo:{owner:'other',repo:'FtkSaaS'}},{payload:{inputs:{tested_sha:'main'}}}])assert.throws(()=>manualRequest({...context,...patch},1));
 assert.throws(()=>manualRequest(context,0));
 assert.throws(()=>manualBinding(request,{sha:'d'.repeat(40),tree:{sha:'c'.repeat(40)}},{inventory,manifest},null));
});

test('manual full new dispatch learns measurements while rerun preserves frozen source and plan',async()=>{
 const {manualRequest,manualBinding,restoreManualBinding}=await import('../scripts/ci/manual-full.mjs');
 const context={eventName:'workflow_dispatch',ref:'refs/heads/main',sha:'a'.repeat(40),runId:77,payload:{inputs:{tested_sha:'b'.repeat(40)}},repo:{owner:'SXQHex',repo:'FtkSaaS'}};
 const request=manualRequest(context,1),inventory=buildInventory(repositoryRoot),manifest=JSON.parse(fs.readFileSync(path.join(repositoryRoot,'apps/backend/scripts/ci/api-suites.json'))),candidate={inventory,manifest,tree:'c'.repeat(40)};
 const unit=inventory.units[0],reference={run_id:50,attempt:1,head:'d'.repeat(40),merge:'e'.repeat(40),tree:'f'.repeat(40),units:{[unit.id]:{sha256:createHash('sha256').update(unit.code).digest('hex'),seconds:123}}};
 const frozen=manualBinding(request,{sha:request.tested_sha,tree:{sha:'c'.repeat(40)}},candidate,reference);
 assert.equal(frozen.schedule.units[unit.id].seconds,123);assert.equal(frozen.schedule.reference.run_id,50);
 const rerun=restoreManualBinding(frozen,manualRequest(context,2),candidate);
 assert.deepEqual(rerun,frozen);
 for(const patch of [{run_id:78},{head:'f'.repeat(40)},{tested_sha:'d'.repeat(40)},{kind:'full'},{attempt:2},{tree:'d'.repeat(40)}])assert.throws(()=>restoreManualBinding({...frozen,...patch},manualRequest(context,2),candidate));
 const tampered=structuredClone(frozen);tampered.schedule.plan[0].units.pop();assert.throws(()=>restoreManualBinding(tampered,manualRequest(context,2),candidate));
});

test('manual full collection rejects stale workflow jobs and validates test-only phase measurements',async()=>{
 const {validateManualRun,manualTestBalance}=await import('../scripts/ci/manual-full.mjs');
 const binding={kind:'manual-full',head:'a'.repeat(40),run_id:77,attempt:1};
 const run={id:77,head_sha:binding.head,run_attempt:2,event:'workflow_dispatch',path:'.github/workflows/ci-full.yml',head_branch:'main'};
 assert(validateManualRun(run,binding,2));
 for(const patch of [{event:'pull_request'},{head_branch:'feature'},{head_sha:'b'.repeat(40)},{run_attempt:3},{id:78},{path:'.github/workflows/backend.yml'}])assert.throws(()=>validateManualRun({...run,...patch},binding,2));
 const phases=Array.from({length:12},(_,i)=>({role:'api',shard:i+1,coverage:'hash',tests_s:i===11?120:100,backend_setup_s:10}));
 assert.equal(manualTestBalance(phases,'hash').ratio,1.2);assert.equal(manualTestBalance(phases,'hash').balanced,true);
 phases[11].tests_s=121;assert.equal(manualTestBalance(phases,'hash').balanced,false);
 for(const bad of [phases.slice(1),[...phases.slice(0,11),phases[0]],phases.map(p=>({...p,coverage:'other'})),phases.map(p=>({...p,tests_s:NaN}))])assert.throws(()=>manualTestBalance(bad,'hash'));
});

test('manual dispatch resolves immutable Git data, freezes reruns and reports without merge status',async()=>{
 const {resolveManualFull,collectManualFull}=await import('../scripts/ci/manual-full.mjs');
 const {main:mergeGate}=await import('../scripts/ci/gate.mjs');
 const git=(...args)=>execFileSync('git',args,{cwd:repositoryRoot,encoding:'utf8'}).trim();
 const sha=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
 const entries=git('ls-tree','-r','HEAD').split('\n').map(line=>{const [meta,path]=line.split('\t'),[mode,type,sha]=meta.split(' ');return {path,mode,type,sha};});
 const context={eventName:'workflow_dispatch',ref:'refs/heads/main',sha,runId:77,payload:{inputs:{tested_sha:sha}},repo:{owner:'SXQHex',repo:'FtkSaaS'}};
 const run={id:77,head_sha:sha,run_attempt:1,event:'workflow_dispatch',path:'.github/workflows/ci-full.yml',head_branch:'main',created_at:'2026-11-12T00:00:00Z'};
 const outputs={},core={setOutput(k,v){outputs[k]=v;},warning(){},summary:{addRaw(){return this;},async write(){}}};
 const files=['manual-source.json','manual-binding.json','manual-measurements.json'].map(name=>path.join(repositoryRoot,'.artifacts/ci',name)),saved=files.map(file=>fs.existsSync(file)?fs.readFileSync(file):null),prior=process.env.GITHUB_RUN_ATTEMPT;
 let artifacts=[],jobs=[],zip;
 const github={rest:{git:{getCommit:async()=>({data:{sha,tree:{sha:tree}}}),getTree:async()=>({data:{tree:entries}})},actions:{listWorkflowRuns:async()=>({data:{workflow_runs:[]}}),listWorkflowRunArtifacts:'artifacts',listJobsForWorkflowRunAttempt:'jobs',getWorkflowRun:async()=>({data:run}),downloadArtifact:async()=>({data:zip})}},paginate:async method=>method==='jobs'?jobs:artifacts};
 try{
  process.env.GITHUB_RUN_ATTEMPT='1';await resolveManualFull(github,context,core);
  const binding=JSON.parse(outputs.binding);assert.equal(binding.merge,sha);assert.equal(binding.kind,'manual-full');
  const members={'manual-source.json':binding};
  for(let n=1;n<=12;n++)members['clean-api'+n+'.json']={clean_phases:{role:'api',shard:n,coverage:binding.coverage,tests_s:100+n,backend_setup_s:10}};
  zip=execFileSync('python3',['-c','import io,json,sys,zipfile;b=io.BytesIO();z=zipfile.ZipFile(b,"w");[z.writestr(k,json.dumps(v)) for k,v in json.loads(sys.argv[1]).items()];z.close();sys.stdout.buffer.write(b.getvalue())',JSON.stringify(members)]);
  artifacts=[{id:1,name:'manual-source',size_in_bytes:zip.length},...Array.from({length:12},(_,i)=>({id:i+2,name:'timings-api-'+(i+1)+'-1',size_in_bytes:zip.length}))];
  github.rest.actions.listWorkflowRuns=async()=>{throw Error('Rerun must not query latest reference');};
  process.env.GITHUB_RUN_ATTEMPT='2';run.run_attempt=2;
  await resolveManualFull(github,context,core);assert.deepEqual(JSON.parse(outputs.binding),binding);
  jobs=['core',...Array.from({length:12},(_,i)=>'api-'+(i+1))].map((role,i)=>({id:i+1,name:'clean / '+role,run_id:77,run_attempt:2,head_sha:sha,status:'completed',conclusion:'success',created_at:run.created_at,started_at:run.created_at,completed_at:'2026-11-12T00:03:00Z',steps:['Verify tested merge','Clean acceptance',...(role==='core'?['Upload schema baseline']:[])].map(name=>({name,conclusion:'success',started_at:run.created_at,completed_at:'2026-11-12T00:02:00Z'}))}));
  await collectManualFull(github,context,core,binding);
  const report=JSON.parse(fs.readFileSync(files[2]));assert.equal(report.kind,'manual-full');assert.equal(report.distribution.length,12);assert.equal(report.source.attempt,2);assert.equal(report.source.source_attempt,1);assert.equal(report.balance.balanced,true);
  await mergeGate({}, {eventName:'workflow_run',payload:{workflow_run:run}},core);
  jobs[0].conclusion='skipped';await assert.rejects(collectManualFull(github,context,core,binding),/Failed\/skipped/);
 }finally{
  if(prior===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=prior;
  files.forEach((file,i)=>{if(saved[i]===null)fs.rmSync(file,{force:true});else fs.writeFileSync(file,saved[i]);});
 }
});
