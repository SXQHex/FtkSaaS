import test from 'node:test';
import assert from 'node:assert/strict';
import {coverageHash,validateJobs} from '../scripts/ci/shards.mjs';
import {ciFile,repoFile,repositoryRoot} from '../scripts/paths.mjs';
import fs,{rmSync,writeFileSync,mkdtempSync} from 'node:fs';
import {validateBinding,verifyMerged,validateDocumentBinding,checkPr,findCandidateProof,schemaBaselineName} from '../scripts/ci/gate.mjs';
import {assertReady,assertParents,policyPath,resolveCandidate,currentAttemptBinding} from '../scripts/ci/source.mjs';
import {measurements,collect} from '../scripts/ci/collect.mjs';
import {classifyChanges} from '../scripts/ci/scope.mjs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {valid,scopedGithub,change,candidateProofFixture,jobsWithApiSeconds} from './ci-fixtures.mjs';
process.chdir(repositoryRoot);

const rerunFixture=()=>{
 const binding={kind:'full',profile:'four-isolated-v2',coverage:coverageHash(),pr:9,head:'H',base:'B',merge:'M',tree:'T',run_id:5,attempt:1,benchmark:false};
 const pr={number:9,state:'open',draft:false,head:{sha:'H'},base:{sha:'B',ref:'main'}};
 const run={id:5,run_attempt:2,head_sha:'H',event:'pull_request',path:'.github/workflows/ci-full.yml',status:'in_progress',created_at:'2026-01-01T00:00:00Z'};
 // GitHub's attempt view carries retained successes under the current attempt
 // and new job IDs, while preserving their original execution timestamps.
 const jobs=['core','api-1','api-2','api-3','api-4'].map((name,i)=>({id:100+i,name:'clean / '+name,run_id:5,run_attempt:2,head_sha:'H',status:'completed',conclusion:'success',created_at:run.created_at,started_at:'2026-01-01T00:00:01Z',completed_at:'2026-01-01T00:02:00Z',steps:[{name:'Verify tested merge',conclusion:'success'},{name:'Clean acceptance',conclusion:'success',started_at:'2026-01-01T00:00:02Z',completed_at:'2026-01-01T00:01:02Z'}]}));
 jobs[0].steps.push({name:'Upload schema baseline',conclusion:'success'});
 const context={repo:{},runId:5,sha:'M',payload:{pull_request:structuredClone(pr)}};
 const github={rest:{actions:{getWorkflowRun:async()=>({data:run}),listJobsForWorkflowRunAttempt:'attempt-jobs'}},paginate:async(method,args)=>{assert.equal(method,'attempt-jobs');assert.equal(args.attempt_number,2);return jobs;}};
 const core={warning(){},summary:{addRaw(){return this;},async write(){}}};
 return{binding,pr,run,jobs,context,github,core};
};

async function collectorFiles(fn){
 const files=['binding.json','measurements.json'].map(name=>ciFile(name)),previous=process.env.GITHUB_RUN_ATTEMPT;
 const saved=files.map(p=>fs.existsSync(p)?fs.readFileSync(p):null);
 process.env.GITHUB_RUN_ATTEMPT='2';
 try{await fn();}finally{
  if(previous===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=previous;
  files.forEach((p,i)=>{if(saved[i]===null)fs.rmSync(p,{force:true});else fs.writeFileSync(p,saved[i]);});
 }
}

test('merge acceptance binds live head base merge tree workflow and attempt',()=>{assert(validateBinding(valid()));for(const mutate of [v=>v.pr.head.sha='new',v=>v.pr.base.sha='new',v=>v.currentTree='new',v=>v.binding.attempt=2,v=>v.run.event='push',v=>v.workflowMatches=false,v=>v.tested.parents[1].sha='other']){const v=valid();mutate(v);assert.throws(()=>validateBinding(v));}});

test('label, skipped job or skipped clean step never constitutes acceptance',()=>{for(const mutate of [v=>v.jobs=[],v=>v.jobs[0].conclusion='skipped',v=>v.jobs[0].steps[0].conclusion='skipped',v=>v.run.conclusion='cancelled']){const v=valid();mutate(v);assert.throws(()=>validateBinding(v));}});

test('main verification rejects missing proof before running expensive acceptance',async()=>{const g={rest:{repos:{listPullRequestsAssociatedWithCommit:'prs'},actions:{listWorkflowRuns:'runs'}},paginate:async method=>method==='prs'?[{number:1,merged_at:'now',merge_commit_sha:'M',head:{sha:'H'},base:{sha:'B'}}]:[]};g.rest.git={getTree:async({tree_sha})=>({data:{tree:[{path:'apps/backend/database/kernel.sql',type:'blob',mode:'100644',sha:tree_sha+'kernel'}],truncated:false}}),getCommit:async()=>({data:{sha:'M',tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]}})};await assert.rejects(()=>verifyMerged(g,{repo:{owner:'synthetic',repo:'test'},sha:'M'},{summary:{}}),/No successful source-bound full acceptance/);});

test('main verification rejects direct push without a merged PR proof',async()=>{const g={rest:{repos:{listPullRequestsAssociatedWithCommit:'prs'}},paginate:async()=>[]};await assert.rejects(()=>verifyMerged(g,{repo:{},sha:'direct'},{}),/PR merge/);});

test('Draft and closed PR cannot merge even with successful automatic tests',()=>{
 for(const p of [{state:'open',draft:true,labels:[]},{state:'closed',draft:false,labels:[]}])assert.throws(()=>assertReady(p));
 assertReady({state:'open',draft:false,labels:[]});
 assertReady({state:'open',draft:false,labels:[{name:'development'}]});
 assert.throws(()=>assertParents({parents:[{sha:'B'},{sha:'X'}]},'B','H'));
 assert(policyPath('apps/backend/scripts/ci/document-paths.json'));assert(policyPath('docs/history/manifest.json'));assert(policyPath('.github/workflows/ci-docs.yml'));
});

test('documentation proof is separate, source bound and rejects stale/missing/skipped evidence',()=>{
 const v=valid();v.binding.kind='documentation';v.run.path='.github/workflows/ci-full.yml';v.jobs[0].name='documentation';v.jobs[0].steps[0].name='Documentation acceptance';
 assert(validateDocumentBinding(v));
 for(const mutate of [x=>x.binding.kind='full',x=>x.run.path='.github/workflows/ci-docs.yml',x=>x.pr.base.sha='new',x=>x.binding.attempt=2,x=>x.currentTree='new',x=>x.workflowMatches=false,x=>x.jobs=[],x=>x.jobs[0].steps[0].conclusion='skipped']){const x=structuredClone(v);mutate(x);assert.throws(()=>validateDocumentBinding(x));}
});

test('all required shard jobs must succeed in the same run attempt view and head; benchmark cannot be omitted',()=>{
 const v=valid();assert(validateJobs(v.jobs,v.run,{collector:true}));
 for(const mutate of [x=>x.jobs.splice(2,1),x=>x.jobs.push(structuredClone(x.jobs[1])),x=>x.jobs[1].conclusion='skipped',x=>x.jobs[2].conclusion='cancelled',x=>x.jobs[3].conclusion='failure',x=>x.jobs[4].run_attempt=2,x=>x.jobs[4].run_id=6,x=>x.jobs[4].head_sha='other',x=>x.jobs[4].steps[0].conclusion='skipped',x=>x.binding.coverage='other',x=>x.binding.benchmark=true]){
  const x=valid();mutate(x);assert.throws(()=>validateBinding(x));
 }
});

test('reusable full clean retains all obligations while automatic admission and privileged merge are separate',()=>{
 const clean=fs.readFileSync('.github/workflows/clean-suite.yml','utf8'),runner=fs.readFileSync('apps/backend/scripts/test-clean.mjs','utf8');
 assert(clean.includes('shard: [1, 2, 3, 4]'));assert(clean.includes('fail-fast: false'));assert(!clean.includes('max-parallel: 1'));
 assert(clean.includes('needs: [core, api, serial-reference]'));assert(clean.includes('if: always()'));assert(clean.includes('Verify all required jobs'));
 for(const op of ['test:db','dev:seed','dev:health','db:advisors'])assert(runner.includes("['run','"+op+"']"));
 assert(runner.includes("['--dir',repoFile(),'exec','turbo','run','verify','--filter=@ftksaas/backend...']"));
 assert(runner.includes("['db','reset','--local','--no-seed','--yes']"));assert(runner.includes("'auth.users'"));
 const full=fs.readFileSync('.github/workflows/ci-full.yml','utf8'),gate=fs.readFileSync('.github/workflows/ci-gate.yml','utf8');
 assert(full.includes("needs.candidate.outputs.kind == 'full'"));assert(full.includes("needs.candidate.outputs.kind == 'documentation'"));assert(full.includes('synchronize'));assert(!full.includes('statuses: write'));assert(!full.includes('secrets:'));
 assert(!fs.existsSync('.github/workflows/ci-docs.yml'));assert(!fs.existsSync('apps/backend/scripts/ci/recovery.mjs'));
 assert(gate.includes('converted_to_draft'));assert(gate.includes('branches: [main]'));assert(gate.includes('ref: main'));assert(gate.includes('statuses: write'));

});

test('metadata-only serial labels do not invalidate automatic acceptance or create extra tests',()=>{
 const v=valid();v.pr.labels=[{name:'ci:measure-serial'}];assert(validateBinding(v));
 v.binding.benchmark=true;assert.throws(()=>validateBinding(v));
});

test('routine main collector measures five executed roles and excludes skipped optional serial without weakening mandatory jobs',()=>{
 const v=valid(),time={created_at:'2026-01-01T00:00:00Z',started_at:'2026-01-01T00:00:03Z',completed_at:'2026-01-01T00:01:00Z'};
 const jobs=v.jobs.filter(j=>j.name!=='full-clean').map(j=>({...j,...time,steps:j.steps.map(s=>({...s,started_at:'2026-01-01T00:00:10Z',completed_at:'2026-01-01T00:00:50Z'}))}));
 jobs.push({name:'clean / serial-reference',status:'completed',conclusion:'skipped',run_id:5,run_attempt:1,head_sha:'H',started_at:null,completed_at:null,steps:[]});
 assert(validateJobs(jobs,v.run,{benchmark:false}));
 const rows=measurements(jobs,time.created_at);
 assert.equal(rows.length,5);assert(!rows.some(r=>r.role==='serial-reference'));
 assert(rows.every(r=>Number.isFinite(r.setup_s)&&Number.isFinite(r.test_s)&&Number.isFinite(r.runner_s)));
 assert.throws(()=>validateJobs(jobs,v.run,{benchmark:true}),/serial-reference/);
 for(const conclusion of ['skipped','cancelled','failure']){
  const broken=structuredClone(jobs);broken[1].conclusion=conclusion;broken[1].steps=[];
  assert.throws(()=>validateJobs(broken,v.run,{benchmark:false}),/api-1/);
 }
});

test('frontend-only PR passes backend scope without inventing a full-test receipt; mixed and unknown scope cannot skip',async()=>{
 for(const paths of [['apps/web/page.tsx'],['apps/web/page.tsx','apps/backend/database/kernel.sql'],['packages/unknown/a.ts']]){
  const {github,statuses}=scopedGithub(paths);const result=await checkPr(github,{repo:{}},9);
  assert.equal(result.state,paths.length===1&&paths[0].startsWith('apps/web/')?'success':'failure');
  if(result.state==='success')assert(statuses[0].description.includes('no backend tests accepted'));
 }
 const {github}=scopedGithub(['apps/web/a.ts'],{truncated:true});assert.equal((await checkPr(github,{repo:{}},9)).state,'failure');
});

test('frontend candidate never starts backend clean, while actual merge verifies parents before non-backend classification',async()=>{
 const {github,pr}=scopedGithub(['apps/web/page.tsx']);const outputs={},core={setOutput:(k,v)=>outputs[k]=v,summary:{addRaw(){return this;},async write(){}}};
 await resolveCandidate(github,{repo:{},issue:{number:9},payload:{pull_request:pr},runId:1,sha:'M'},core,'full');assert.equal(outputs.eligible,'false');assert.equal(outputs.merge,undefined);
 assert.equal((await verifyMerged(github,{repo:{},sha:'M'},core)).kind,'frontend');assert.equal(outputs.kind,'frontend');
 github.rest.git.getCommit=async()=>({data:{sha:'M',tree:{sha:'T'},parents:[{sha:'X'},{sha:'H'}]}});
 await assert.rejects(verifyMerged(github,{repo:{},sha:'M'},core),/parents/);
});

test('every workflow is trusted policy including frontend; its scope marker cannot authorize policy installation',async()=>{
 assert(policyPath('.github/dependabot.yml'));assert.equal(classifyChanges([change('.github/dependabot.yml')]).kind,'full');
 assert(policyPath('.github/workflows/frontend.yml'));assert(policyPath('.github/workflows/new.yml'));
 assert.equal(classifyChanges([change('.github/workflows/new.yml')]).kind,'full');
 assert.equal(classifyChanges([{path:'.github/workflows/ci-docs.yml',status:'D'}]).kind,'full');
 const {github}=scopedGithub(['.github/workflows/frontend.yml']);const result=await checkPr(github,{repo:{}},9);assert.equal(result.state,'failure');assert(result.description.includes('policy installation'));
});

test('cancelled incomplete and stale successful runs cannot shadow valid source-bound full or documentation evidence',async()=>{
 for(const kind of ['full','documentation']){
  const dir=mkdtempSync(join(tmpdir(),'ci-proof-'));
  try{const f=candidateProofFixture(dir,{kind});const found=await findCandidateProof(f.github,f.repo,f.pr,kind,'T','B');assert.equal(found.run.id,5);
   const out={},core={setOutput:(k,v)=>out[k]=v,summary:{addRaw(){return this;},async write(){}}};
   await verifyMerged(f.github,{repo:f.repo,sha:'A',runId:20},core);assert.equal(out.kind,kind);assert.equal(JSON.parse(out.binding).candidate_run_id,5);
   await assert.rejects(findCandidateProof(f.github,f.repo,f.pr,kind,'different','B'),/tree/);
   f.github.paginate=async(method,args)=>method==='runs'?[{...f.v.run,conclusion:'cancelled'}]:[];await assert.rejects(findCandidateProof(f.github,f.repo,f.pr,kind,'T','B'),/No successful/);
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
});

test('collector publishes functional proof despite imbalance or unavailable timing but rejects failed or mixed source jobs',async()=>{
 const {collect}=await import('../scripts/ci/collect.mjs'),file=repoFile('.artifacts/ci/binding.json'),reportFile=repoFile('.artifacts/ci/measurements.json');
 const previous=process.env.GITHUB_RUN_ATTEMPT;process.env.GITHUB_RUN_ATTEMPT='1';
 const preserved=new Map([file,reportFile].map(p=>[p,fs.existsSync(p)?fs.readFileSync(p):null]));
 try{
  for(const unavailable of [false,true]){
   const v=jobsWithApiSeconds([1154,1239,1488,1629]),warnings=[];
   v.binding.profile='four-isolated-v2';v.jobs[0].steps.push({name:'Upload schema baseline',conclusion:'success'});
   const context={repo:{},runId:5,sha:'M',payload:{pull_request:v.pr}};
   if(unavailable)delete v.jobs[1].steps[0].started_at;
   const github={rest:{actions:{getWorkflowRun:async()=>({data:{...v.run,created_at:'2026-01-01T00:00:00Z'}}),listJobsForWorkflowRunAttempt:'jobs'}},paginate:async()=>v.jobs};
   const core={warning:s=>warnings.push(s),summary:{addRaw(){return this;},async write(){}}};
   await collect(github,context,core,v.binding);
   assert.equal(JSON.parse(fs.readFileSync(file)).head,'H');assert.equal(warnings.length,1);
   const report=JSON.parse(fs.readFileSync(reportFile));assert.equal(report.balance.balanced,unavailable?null:false);
   if(unavailable)assert.equal(report.balance.status,'unavailable');
   v.jobs[1].conclusion='failure';await assert.rejects(collect(github,context,core,v.binding),/Failed/);assert(!fs.existsSync(file));
   v.jobs[1].conclusion='success';v.binding.attempt=2;await assert.rejects(collect(github,context,core,v.binding),/mismatch/);assert(!fs.existsSync(file));
  }
 }finally{
  if(previous===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=previous;
  for(const [p,bytes] of preserved){if(bytes===null)fs.rmSync(p,{force:true});else fs.writeFileSync(p,bytes);}
 }
});

test('failed-job rerun accepts GitHub retained successes on the exact original source',async()=>collectorFiles(async()=>{
 const f=rerunFixture();await collect(f.github,f.context,f.core,f.binding);
 const binding=JSON.parse(fs.readFileSync(ciFile('binding.json')));
 assert.equal(binding.attempt,2);assert.equal(binding.source_attempt,1);assert.equal(binding.merge,'M');assert.equal(binding.profile,'four-isolated-v2');
 const collector={id:200,name:'clean / full-clean',status:'completed',conclusion:'success',run_id:5,run_attempt:2,head_sha:'H',steps:[{name:'Verify all required jobs',conclusion:'success'}]};
 assert(validateBinding({binding,pr:f.pr,run:{...f.run,status:'completed',conclusion:'success'},jobs:[...f.jobs,collector],tested:{sha:'M',tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]},currentTree:'T',workflowMatches:true}));
}));

test('rerun cannot borrow another source, run, future attempt or missing acceptance',async()=>collectorFiles(async()=>{
 for(const mutate of [
  f=>f.binding.run_id=6,f=>f.binding.head='other',f=>f.binding.base='other',f=>f.binding.pr=10,f=>f.binding.merge='other',f=>f.binding.coverage='other',f=>f.binding.attempt=3,f=>f.binding.attempt=0,f=>f.run.run_attempt=3,f=>f.run.event='push',f=>f.run.path='.github/workflows/other.yml',
  f=>f.jobs[1].conclusion='failure',f=>f.jobs[1].conclusion='cancelled',f=>f.jobs[1].conclusion='skipped',f=>f.jobs[1].run_id=6,f=>f.jobs[1].head_sha='other',f=>f.jobs[1].run_attempt=1,f=>f.jobs[1].steps[0].conclusion='skipped',f=>f.jobs[1].steps[1].conclusion='skipped',f=>f.jobs[0].steps[2].conclusion='skipped',f=>f.jobs.splice(1,1),f=>f.jobs.push(structuredClone(f.jobs[1]))
 ]){
  const f=rerunFixture();mutate(f);await assert.rejects(collect(f.github,f.context,f.core,f.binding));assert(!fs.existsSync(ciFile('binding.json')));
 }
}));

test('a newer failed execution cannot be replaced by an older success or collector-only rerun',async()=>collectorFiles(async()=>{
 const f=rerunFixture();f.jobs[1].conclusion='failure';
 await assert.rejects(collect(f.github,f.context,f.core,f.binding),/Failed/);
 const older={...f.jobs[1],id:50,run_attempt:1,conclusion:'success'};f.jobs.push(older);
 await assert.rejects(collect(f.github,f.context,f.core,f.binding),/duplicate/);
}));

test('candidate resolution stays on the original event merge even if the merge ref is regenerated',async()=>{
 const f=rerunFixture(),outputs={};
 f.context.issue={number:9};
 f.github.rest.pulls={get:async()=>({data:f.pr})};
 f.github.rest.git={getRef:async()=>{throw Error('Mutable merge ref must not be read');},getCommit:async({commit_sha})=>{assert.equal(commit_sha,'M');return{data:{sha:'M',tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]}};},getTree:async({tree_sha})=>({data:{tree:[{type:'blob',mode:'100644',path:'apps/backend/database/kernel.sql',sha:tree_sha}]}})};
 await resolveCandidate(f.github,f.context,{setOutput:(k,v)=>outputs[k]=v},'auto');assert.equal(outputs.merge,'M');
 f.pr.base.sha='new-main';await assert.rejects(resolveCandidate(f.github,f.context,{setOutput(){}},'auto'),/base/);
});

test('retained core baseline is run scoped; historical accepted receipts keep their original name',()=>{
 assert.equal(schemaBaselineName({profile:'four-isolated-v2',attempt:7,source_attempt:3}),'documentation-baseline');
 assert.equal(schemaBaselineName({profile:'four-isolated-v1',attempt:3}),'documentation-baseline-3');
 assert.throws(()=>schemaBaselineName({profile:'unknown'}));
});

test('documentation failed-job rerun records the accepting attempt on the original source',async()=>collectorFiles(async()=>{
 const f=rerunFixture(),binding={...f.binding,kind:'documentation'};
 const accepted=currentAttemptBinding(binding,f.context);
 assert.equal(accepted.attempt,2);assert.equal(accepted.source_attempt,1);assert.equal(accepted.merge,binding.merge);
}));

test('collector rejects a new attempt starting while job evidence is being read',async()=>collectorFiles(async()=>{
 const f=rerunFixture();let reads=0;
 f.github.rest.actions.getWorkflowRun=async()=>({data:{...f.run,run_attempt:++reads===1?2:3}});
 await assert.rejects(collect(f.github,f.context,f.core,f.binding),/changed during collection/);
 assert(!fs.existsSync(ciFile('binding.json')));
}));

test('merge proof rechecks current attempt and success after downloading evidence',async()=>{
 for(const change of [{run_attempt:2},{status:'in_progress',conclusion:null},{conclusion:'failure'}]){
  const dir=mkdtempSync(join(tmpdir(),'ci-rerun-race-'));
  try{
   const f=candidateProofFixture(dir);f.github.rest.actions.getWorkflowRun=async()=>({data:{...f.v.run,...change}});
   await assert.rejects(findCandidateProof(f.github,f.repo,f.pr,'full','T','B'),/changed during proof/);
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
});

test('v2 merge proof retains source and upload obligations for inherited jobs',()=>{
 const f=rerunFixture(),binding={...f.binding,attempt:2,source_attempt:1};
 const collector={name:'clean / full-clean',status:'completed',conclusion:'success',run_id:5,run_attempt:2,head_sha:'H',steps:[{name:'Verify all required jobs',conclusion:'success'}]};
 const v={binding,pr:f.pr,run:{...f.run,status:'completed',conclusion:'success'},jobs:[...f.jobs,collector],tested:{sha:'M',tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]},currentTree:'T',workflowMatches:true};
 assert(validateBinding(v));
 for(const mutate of [x=>x.binding.source_attempt=0,x=>x.binding.source_attempt=3,x=>delete x.binding.source_attempt,x=>x.binding.tree='other',x=>x.binding.coverage='other',x=>x.pr.base.sha='other',x=>x.jobs[0].conclusion='failure',x=>x.jobs[0].steps[2].conclusion='failure',x=>x.jobs[0].steps.push(structuredClone(x.jobs[0].steps[0])),x=>x.jobs[1].steps[0].conclusion='skipped']){
  const x=structuredClone(v);mutate(x);assert.throws(()=>validateBinding(x));
 }
});

test('quality thresholds and nested checker config cannot escape trusted policy', () => {
 for(const file of ['CONSTRAINTS.md','apps/web/.gitignore','apps/web/src/.ignore','apps/web/tsconfig.json','packages/typescript-config/base.json','packages/api-contracts/package.json','apps/web/src/nested/.oxlintrc.json','apps/web/vitest.config.ts','apps/web/scripts/verify-isolation.mjs','turbo.json']) assert(policyPath(file),file);
});
