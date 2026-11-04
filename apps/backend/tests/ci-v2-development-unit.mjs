import test from 'node:test';
import assert from 'node:assert/strict';
import {isV2DevelopmentOnly,isV2DevelopmentPath,validateV2Development,v2DevelopmentSteps,assertV2Isolation} from '../scripts/ci/v2-development.mjs';
import {classifyChanges} from '../scripts/ci/scope.mjs';
import {policyPath,remoteSourceScope} from '../scripts/ci/source.mjs';
import {deploymentSource,resolveAcceptedSource} from '../scripts/ci/deployment-source.mjs';
const sha='a'.repeat(40),base='b'.repeat(40),merge='c'.repeat(40),tree='d'.repeat(40);
const changes=[{path:'.github/workflows/ci-v2-backend.yml',status:'M'},{path:'apps/backend/tests/v2/backend/example.test.mjs',status:'A'}];

test('exception source-row metadata is not an executable V2 dependency',()=>{
 const file='apps/backend/scripts/ci/floor-exceptions.json';
 const entry={path:'apps/backend/tests/v2/backend/example.test.mjs',reason:'reviewed assertion relocation'};
 assert.doesNotThrow(()=>assertV2Isolation([file],()=>JSON.stringify([entry])));
 assert.throws(()=>assertV2Isolation([file],()=>JSON.stringify([{...entry,import:'./v2/runtime.mjs'}])));
 assert.throws(()=>assertV2Isolation([file],()=>'{invalid'));
});

test('V2 lane requires a nonempty exclusively isolated source delta; shared and mixed changes retain production coverage',()=>{
 assert(isV2DevelopmentOnly(changes));
 assert.equal(classifyChanges(changes).kind,'v2-development');assert.equal(classifyChanges(changes).backend,true);
 for(const path of ['apps/backend/scripts/ci/v2-development.mjs','apps/backend/scripts/ci/scope.mjs','apps/backend/database/kernel.sql','pnpm-lock.yaml','apps/backend/package.json','packages/api-contracts/schema/contract.json','.github/workflows/ci-v2-unknown.yml','apps/web/src/app/page.tsx','docs/ci-policy.md']){
  assert(!isV2DevelopmentPath(path),path);assert.equal(classifyChanges([...changes,{path,status:'M'}]).kind,'full',path);
 }
 for(const path of ['../apps/backend/scripts/ci/v2/a.mjs','apps/backend/scripts/ci/v2/../gate.mjs','apps/backend/scripts/ci/v2/nested/gate.mjs','apps/backend/scripts/ci/v2/a.mjs/','apps\\backend\\tests\\v2\\a.mjs'])assert(!isV2DevelopmentPath(path));
 for(const list of [[],null,[{...changes[0],status:'R100'}],[{...changes[0],status:'?'}]])assert(!isV2DevelopmentOnly(list));
 for(const c of changes)assert(policyPath(c.path)||c.path.startsWith('apps/backend/tests/'));
});

test('remote V2 selection rejects symlinks, submodules, truncated trees and rename escapes',async()=>{
 const source=(mode='100644',extra=[],truncated=false)=>({rest:{git:{getTree:async({tree_sha})=>({data:{truncated,tree:[{path:changes[0].path,type:mode==='160000'?'commit':'blob',mode,sha:tree_sha},...extra]}})}}});
 const repo={owner:'x',repo:'y'};
 assert.equal((await remoteSourceScope(source(),repo,base,sha)).kind,'v2-development');
 for(const mode of ['120000','100755','160000'])await assert.rejects(remoteSourceScope(source(mode),repo,base,sha));
 await assert.rejects(remoteSourceScope(source('100644',[],true),repo,base,sha));
 const git=source();git.rest.git.getTree=async({tree_sha})=>({data:{tree:tree_sha===base?[{path:'apps/backend/database/a.sql',type:'blob',mode:'100644',sha:base}]:[{path:changes[0].path,type:'blob',mode:'100644',sha}]}});
 assert.equal((await remoteSourceScope(git,repo,base,sha)).kind,'full');
});

function evidence(){return {binding:{kind:'v2-development',run_id:8,attempt:2,source_attempt:1,pr:9,head:sha,base,merge,tree},pr:{number:9,head:{sha},base:{sha:base}},run:{id:8,run_attempt:2,event:'pull_request',path:'.github/workflows/ci-full.yml',status:'completed',conclusion:'success',head_sha:sha},jobs:[{name:'v2-development',run_id:8,run_attempt:2,head_sha:sha,status:'completed',conclusion:'success',steps:v2DevelopmentSteps.map(name=>({name,conclusion:'success'}))}],tested:{sha:merge,tree:{sha:tree},parents:[{sha:base},{sha}]},currentTree:tree,workflowMatches:true};}

test('V2 development receipt cannot borrow runtime acceptance, stale sources, skipped tests or another run/attempt',()=>{
 assert(validateV2Development(evidence()));
 for(const mutate of [x=>x.workflowMatches=false,x=>x.binding.kind='full',x=>x.binding.base=sha,x=>x.binding.head=base,x=>x.binding.tree=sha,x=>x.binding.attempt=1,x=>x.binding.source_attempt=3,x=>x.binding.run_id=7,x=>x.run.head_sha=base,x=>x.run.conclusion='failure',x=>x.tested.parents.reverse(),x=>x.jobs.push(x.jobs[0]),x=>x.jobs[0].run_attempt=1,x=>x.jobs[0].head_sha=base,x=>x.jobs[0].conclusion='skipped',x=>x.jobs[0].steps.pop(),x=>x.jobs[0].steps[1].conclusion='skipped']){
  const x=evidence();mutate(x);assert.throws(()=>validateV2Development(x));
 }
});

test('V2 main marker never deploys or searches historical runtime proofs; malformed markers fail closed',async()=>{
 const run={id:8,path:'.github/workflows/backend.yml',event:'push',head_branch:'main',repository:{full_name:'x/y'},head_repository:{full_name:'x/y'},head_sha:sha,status:'completed',conclusion:'success',run_attempt:2};
 const job=name=>({name,run_id:8,run_attempt:2,head_sha:sha,status:'completed',conclusion:'success',steps:[{name:'V2 development only (no runtime acceptance)',conclusion:'success'}]});
 const jobs=[job('source'),job('v2-development')];
 assert.equal(deploymentSource({run,jobs,currentMain:sha,repository:'x/y'}).deploy,false);
 const unexpected=new Proxy({},{get(){throw Error('Historical search forbidden');}});
 assert.equal((await resolveAcceptedSource(unexpected,{owner:'x',repo:'y'},run,jobs,sha,2)).v2,true);
 const acceptance={...job('acceptance'),steps:[{name:'Main acceptance proof',conclusion:'success'}]};
 const skipped={...job('v2-development'),conclusion:'skipped',steps:[]};
 assert.equal(deploymentSource({run,jobs:[job('source'),acceptance,skipped],currentMain:sha,repository:'x/y'}).deploy,true);
 const frontend={...job('frontend'),steps:[{name:'Backend unchanged (no backend acceptance)',conclusion:'success'}]};
 assert.equal(deploymentSource({run,jobs:[job('source'),frontend,skipped],currentMain:sha,repository:'x/y'}).frontend,true);

 for(const mutate of [x=>x.push(x[1]),x=>x[1].conclusion='failure',x=>x[1].steps=[],x=>x[1].run_attempt=1]){const bad=structuredClone(jobs);mutate(bad);assert.throws(()=>deploymentSource({run,jobs:bad,currentMain:sha,repository:'x/y'}));}
});

test('production literal dependencies on V2 are rejected; manual V2 workflow and dedicated check job are isolated',()=>{
 assert.doesNotThrow(()=>assertV2Isolation(['apps/backend/scripts/ci/v2/local.mjs'],()=>"import './v2/helper.mjs'"));
 for(const file of ['apps/backend/transports/example.mjs','apps/backend/tests/api-acceptance.test.mjs','apps/backend/package.json','.github/workflows/clean-suite.yml'])assert.throws(()=>assertV2Isolation([file],()=>"node scripts/ci/v2/backend.mjs"));
 assert.throws(()=>assertV2Isolation(['apps/backend/scripts/start-dev.mjs'],()=>"import './ci/v2/local.mjs'"));
 assert.doesNotThrow(()=>assertV2Isolation(['.github/workflows/ci-full.yml'],()=>"name: ci\n  v2-development:\n    run: node tests/v2/plan.test.mjs"));
});
