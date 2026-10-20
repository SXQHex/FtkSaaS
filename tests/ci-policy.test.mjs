import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {select,parseChanges,apiSuites} from '../scripts/ci/select-tests.mjs';
import {validateBinding} from '../scripts/ci/gate.mjs';
import {analyzeDelta} from '../scripts/ci/delta-analysis.mjs';
import {runApiPhases} from '../scripts/ci/run-targeted.mjs';
const plan=p=>select([{path:p,status:'M'}]);
test('documentation only has no backend setup and retains link checks',()=>{const p=plan('docs/remaining-work.md');assert.equal(p.db,false);assert.equal(p.structural,false);assert.equal(p.docs.length,1);});
test('module changes include explicitly declared shared economic consumers',()=>{const p=plan('database/instructor-earnings.sql');for(const n of ['instructor-earnings','cross-center-settlement','starter-attendance-protection','program-session-lifecycle','api-acceptance'])assert(p.api.includes('tests/'+n+'.test.mjs'));assert(!p.api.includes('tests/person-registry.test.mjs'));});
test('shared auth tenant finance gateway migrations infrastructure and unknown files expand safely',()=>{for(const p of ['database/kernel.sql','database/dispatch.sql','supabase/migrations/next.sql','tests/api-client.mjs','scripts/new-unknown.mjs','contracts/example.json','.github/workflows/ci-fast.yml'])assert.deepEqual(plan(p).api,apiSuites,p);});
test('contract generator/shared types cannot silently omit structural coverage',()=>{for(const p of ['contracts/08.json','contracts/01-product.md','docs/decisions/example.md','scripts/generate.mjs','packages/api-contracts/index.ts'])assert(plan(p).structural);});
test('rename and deletion cover both source and destination; malformed diffs reject',()=>{const c=parseChanges('R100\0database/instructor-earnings.sql\0docs/moved.md\0D\0tests/api-client.mjs\0');assert.equal(c.length,3);assert.deepEqual(select(c).api,apiSuites);assert.throws(()=>parseChanges('R100\0one\0'));});
test('missing diff, empty set, missing path and moved checkout expand to all suites',()=>{for(const p of [select([]),select([{status:'M'}]),select([{path:'docs/a.md'}],{diffAvailable:false}),select([{path:'docs/a.md'}],{headMatches:false})])assert.deepEqual(p.api,apiSuites);});
test('API suite inventory exactly matches package test command; no shard loses tests',()=>{const command=JSON.parse(fs.readFileSync('package.json')).scripts['test:api'];assert.deepEqual([...command.matchAll(/tests\/[\w-]+\.test\.mjs/g)].map(m=>m[0]).sort(),[...apiSuites].sort());});
const valid=()=>({binding:{kind:'full',profile:'four-isolated-v1',coverage:coverageHash(),pr:1,head:'H',base:'B',merge:'M',tree:'T',run_id:5,attempt:1},pr:{number:1,head:{sha:'H'},base:{sha:'B'}},run:{id:5,run_attempt:1,head_sha:'H',event:'pull_request',path:'.github/workflows/ci-full.yml',status:'completed',conclusion:'success'},tested:{sha:'M',tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]},currentTree:'T',workflowMatches:true,jobs:['core','api-1','api-2','api-3','api-4','full-clean'].map(name=>({name,status:'completed',conclusion:'success',run_id:5,run_attempt:1,head_sha:'H',steps:[{name:name==='full-clean'?'Verify all required jobs':'Clean acceptance',conclusion:'success'},{name:'Verify tested merge',conclusion:'success'}]}))});
test('merge acceptance binds live head base merge tree workflow and attempt',()=>{assert(validateBinding(valid()));for(const mutate of [v=>v.pr.head.sha='new',v=>v.pr.base.sha='new',v=>v.currentTree='new',v=>v.binding.attempt=2,v=>v.run.event='push',v=>v.workflowMatches=false,v=>v.tested.parents[1].sha='other']){const v=valid();mutate(v);assert.throws(()=>validateBinding(v));}});
test('label, skipped job or skipped clean step never constitutes acceptance',()=>{for(const mutate of [v=>v.jobs=[],v=>v.jobs[0].conclusion='skipped',v=>v.jobs[0].steps[0].conclusion='skipped',v=>v.run.conclusion='cancelled']){const v=valid();mutate(v);assert.throws(()=>validateBinding(v));}});
test('workflow event boundaries prevent duplicate expensive runs and cross-PR cancellation',()=>{const fast=fs.readFileSync('.github/workflows/ci-fast.yml','utf8'),full=fs.readFileSync('.github/workflows/ci-full.yml','utf8'),main=fs.readFileSync('.github/workflows/backend.yml','utf8');assert(!fast.includes('pull_request:'));assert(full.includes('types: [labeled]'));assert(full.includes("github.event.label.name == 'ci:full-clean'"));assert(fast.includes('development-${{ github.ref }}'));assert(main.includes('main-acceptance-${{ github.sha }}'));assert(main.includes('cancel-in-progress: false'));});

import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';import {execFileSync} from 'node:child_process';
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'ci-selection-'));const git=(...a)=>execFileSync('git',a,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();try{git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');writeFileSync(join(dir,'README.md'),'Initial\n');git('add','.');git('commit','-m','base');git('update-ref','refs/remotes/origin/main',git('rev-parse','HEAD'));return fn(dir,git);}finally{rmSync(dir,{recursive:true,force:true});}}
test('cumulative selector retains canceled API commit coverage when next commit changes docs',()=>fixture((dir,git)=>{mkdirSync(join(dir,'database'));writeFileSync(join(dir,'database/instructor-earnings.sql'),'-- synthetic');git('add','.');git('commit','-m','module');const before=git('rev-parse','HEAD');writeFileSync(join(dir,'README.md'),'Later documentation\n');git('add','.');git('commit','-m','docs');const head=git('rev-parse','HEAD');execFileSync(process.execPath,[resolve('scripts/ci/select-tests.mjs'),before,head],{cwd:dir});const p=JSON.parse(fs.readFileSync(join(dir,'.ci/selection.json')));assert(p.api.includes('tests/cross-center-settlement.test.mjs'));assert(p.db);}));
test('deleting or renaming referenced documentation is detected through unchanged inbound links',()=>fixture((dir,git)=>{writeFileSync(join(dir,'README.md'),'[Target](target.md)\n');writeFileSync(join(dir,'target.md'),'Target\n');git('add','.');git('commit','-m','links');fs.renameSync(join(dir,'target.md'),join(dir,'renamed.md'));assert.throws(()=>execFileSync(process.execPath,[resolve('scripts/ci/docs-check.mjs'),'target.md'],{cwd:dir,stdio:'pipe'}),/Command failed/);}));

import {verifyMerged} from '../scripts/ci/gate.mjs';
test('main verification rejects missing proof before running expensive acceptance',async()=>{const g={rest:{repos:{listPullRequestsAssociatedWithCommit:'prs'},actions:{listWorkflowRuns:'runs'}},paginate:async method=>method==='prs'?[{number:1,merged_at:'now',merge_commit_sha:'M',head:{sha:'H'},base:{sha:'B'}}]:[]};g.rest.git={getTree:async()=>({data:{tree:[],truncated:false}}),getCommit:async()=>({data:{sha:'M',tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]}})};await assert.rejects(()=>verifyMerged(g,{repo:{owner:'synthetic',repo:'test'},sha:'M'},{summary:{}}),/No source-bound full clean evidence/);});
test('main verification rejects direct push without a merged PR proof',async()=>{const g={rest:{repos:{listPullRequestsAssociatedWithCommit:'prs'}},paginate:async()=>[]};await assert.rejects(()=>verifyMerged(g,{repo:{},sha:'direct'},{}),/PR merge/);});
const p01Suite='tests/p01-catalog-entitlement-reads.test.mjs';
const profile={id:'p01-reads',sources:['p01-catalog-entitlement-reads'],operations:['products_list_v1','entitlements_get_v1'],migrationCheckLabel:'P01 reads source drift',suites:[p01Suite]};
const source='database/p01-catalog-entitlement-reads.sql',wrapper='database/p01-catalog-entitlement-reads-wrappers.sql';
const migration='supabase/migrations/20990101000000_p01_catalog_entitlement_reads.sql';
const contractPath='contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json';
function deltaFixture(){
 const defs={Uuid:{type:'string'},Input:{type:'object',properties:{id:{$ref:'#/$defs/Uuid'}}},Output:{type:'object',properties:{id:{$ref:'#/$defs/Uuid'}}},OtherInput:{type:'object',properties:{id:{$ref:'#/$defs/Uuid'}}}};
 const contract={$schema:'synthetic', $defs:defs,'x-contract':{operations:[
  {name:'entitlements_get_v1',request:{$ref:'#/$defs/Input'},success:{$ref:'#/$defs/Output'}},
  {name:'unmapped_v1',request:{$ref:'#/$defs/OtherInput'},success:{$ref:'#/$defs/Uuid'}}
 ],permissions:{read:true},tables:[],uuid_field_map:[],feature_delivery:{}}};
 const oldPackage={name:'synthetic',scripts:{'test:api':'node --test --test-concurrency=2 tests/api-acceptance.test.mjs'},dependencies:{pinned:'1.0.0'}};
 const base={[contractPath]:JSON.stringify(contract),'database/migrations.sha256.json':JSON.stringify({'old.sql':'old'}),'scripts/check-migrations.py':'# original\n','package.json':JSON.stringify(oldPackage),'supabase/functions/backend-v1/implemented.json':JSON.stringify({operations:['entitlements_get_v1']}),'supabase/functions/backend-v1/index.ts':'old generated'};
 const head=structuredClone(base),c=structuredClone(contract);
 c.$defs.Input.properties.session_id={$ref:'#/$defs/Uuid'};head[contractPath]=JSON.stringify(c);
 head[source]='begin;\n-- mapped source\ncommit;\n';head[wrapper]='begin;\n-- wrappers\ncommit;\n';head[migration]=head[source]+head[wrapper];
 head['database/migrations.sha256.json']=JSON.stringify({'old.sql':'old',[migration.split('/').at(-1)]:'new'});
 head['scripts/check-migrations.py']=base['scripts/check-migrations.py']+"\nassert next(Path('supabase/migrations').glob('*_p01_catalog_entitlement_reads.sql')).read_text()==Path('database/p01-catalog-entitlement-reads.sql').read_text()+Path('database/p01-catalog-entitlement-reads-wrappers.sql').read_text(),'P01 reads source drift'\n";
 head['package.json']=JSON.stringify({...oldPackage,scripts:{...oldPackage.scripts,'test:api':oldPackage.scripts['test:api']+' '+p01Suite}});
 head['supabase/functions/backend-v1/index.ts']='new generated';head[p01Suite]='// new behavior test';
 const changes=()=>[...new Set([...Object.keys(base),...Object.keys(head)])].filter(p=>base[p]!==head[p]).map(path=>({path,status:!(path in head)?'D':!(path in base)?'A':'M'}));
 return {base,head,changes,run(){const c=changes();const read=(side,path)=>(side==='base'?base:head)[path]??null;const evidence=analyzeDelta(c,read,[profile]);return select(c,{evidence});}};
}
test('module contract, generated bundle and exact appended migration select only mapped behavior plus common regression',()=>{
 const f=deltaFixture(),p=f.run();assert.equal(p.broad,false);assert(p.structural&&p.db);
 assert.deepEqual(p.api,['tests/api-acceptance.test.mjs',p01Suite]);assert.deepEqual(p.priority,[p01Suite]);
 assert(p.reasons.some(r=>r.includes('transitive definition consumers')));assert(p.reasons.some(r=>r.includes('exactly matches mapped source')));
});
test('shared definition consumer or shared permission change forces broad fallback',()=>{
 for(const mutate of [
  c=>c.$defs.Uuid.type='number',
  c=>c['x-contract'].permissions.read=false,
  c=>c.$defs.Orphan={type:'boolean'},
  c=>c['x-contract'].operations.push({name:'unknown_new_v1',request:{$ref:'#/$defs/Input'}}),
  c=>c.$defs.Table_sales={type:'object'},
  c=>c.$schema='changed',
  c=>c.$defs.Input.properties.external={$ref:'https://example.invalid/schema'}
 ]){
  const f=deltaFixture(),c=JSON.parse(f.head[contractPath]);mutate(c);f.head[contractPath]=JSON.stringify(c);assert.deepEqual(f.run().api,apiSuites);
 }
});
test('persistent table transitive consumers force broad fallback in either snapshot',()=>{
 for(const side of ['base','head']){
  const f=deltaFixture(),c=JSON.parse(f[side][contractPath]);
  c.$defs.Table_rights={type:'object',properties:{nested:{$ref:'#/$defs/TableLink'}}};
  c.$defs.TableLink={$ref:'#/$defs/Input'};f[side][contractPath]=JSON.stringify(c);
  // Keep table definitions identical, so only the existing mapped Input delta
  // changes. Its indirect persistent-table consumer must still force broad.
  const other=side==='base'?'head':'base',o=JSON.parse(f[other][contractPath]);
  o.$defs.Table_rights=c.$defs.Table_rights;o.$defs.TableLink=c.$defs.TableLink;f[other][contractPath]=JSON.stringify(o);
  assert.equal(f.run().broad,true);
 }
});
test('diagnostic report alone requires structural verification without API setup',()=>{
 const p=plan('reports/p01-a-targeted-diagnosis.json');assert(p.structural);assert.equal(p.db,false);
});
test('unknown, altered historical or unbound migration cannot use a known module filename as proof',()=>{
 for(const mutate of [
  f=>f.head[migration]+='-- unbound DDL\n',
  f=>{f.base[migration]='-- historical';},
  f=>{f.head['supabase/migrations/20990102000000_unknown.sql']='-- unknown';},
  f=>{delete f.head[source];},
  f=>{f.head['scripts/check-migrations.py']=f.head['scripts/check-migrations.py'].replace('# original','# rewritten');},
  f=>{f.head['database/migrations.sha256.json']=JSON.stringify({'old.sql':'changed',[migration.split('/').at(-1)]:'new'});}
 ]){const f=deltaFixture();mutate(f);assert.deepEqual(f.run().api,apiSuites);}
});
test('shared package dependency, changed runner flags, test removal or unknown suite remains broad',()=>{
 for(const mutate of [
  p=>p.dependencies.pinned='2.0.0',
  p=>p.scripts['test:api']=p.scripts['test:api'].replace('--test-concurrency=2','--test-concurrency=4'),
  p=>p.scripts['test:api']='node --test --test-concurrency=2 '+p01Suite,
  p=>p.scripts['test:api']+=' tests/unknown.test.mjs',
  p=>p.scripts['test:api']+=' ; echo unexpected',
  p=>p.scripts['test:api']+=' '+p01Suite,
  p=>p.scripts.verify='skip verification'
 ]){const f=deltaFixture(),p=JSON.parse(f.head['package.json']);mutate(p);f.head['package.json']=JSON.stringify(p);assert.deepEqual(f.run().api,apiSuites);}
});
test('standalone generated edit, unmapped registration or shared kernel edit cannot silently narrow',()=>{
 const f=deltaFixture();for(const p of Object.keys(f.head))delete f.head[p];Object.assign(f.head,f.base);f.head['supabase/functions/backend-v1/index.ts']='unexplained';
 assert.deepEqual(f.run().api,apiSuites);
 for(const mutate of [
  x=>x.head['supabase/functions/backend-v1/handler.ts']='shared gateway',
  x=>x.head['database/kernel.sql']='shared rights kernel',
  x=>x.head['scripts/generate-validators.mjs']='shared generator',
  x=>x.head['supabase/functions/backend-v1/implemented.json']=JSON.stringify({operations:['entitlements_get_v1','unknown_v1']}),
  x=>x.head['supabase/functions/backend-v1/implemented.json']=JSON.stringify({operations:[]}),
  x=>x.head['packages/contracts/src/unknown.ts']='unknown shared type',
  x=>x.head['scripts/ci/unknown-runner.mjs']='unknown infrastructure'
 ]){const x=deltaFixture();mutate(x);assert.deepEqual(x.run().api,apiSuites);}
});
test('mapped priorities never drop another selected suite and a failed priority does not start deferred work',()=>{
 const f=deltaFixture(),p=f.run(),calls=[];
 runApiPhases(p,(cmd,args)=>calls.push(args.slice(2)));
 assert.deepEqual(calls,[[p01Suite],['tests/api-acceptance.test.mjs']]);
 const attempted=[];assert.throws(()=>runApiPhases(p,(cmd,args)=>{attempted.push(args.slice(2));throw Error('synthetic behavior failure');}),/synthetic behavior failure/);
 assert.deepEqual(attempted,[[p01Suite]]);
 const broad={...p,api:apiSuites},all=[];runApiPhases(broad,(cmd,args)=>all.push(...args.slice(2)));
 assert.deepEqual([...all].sort(),[...apiSuites].sort());assert.equal(new Set(all).size,apiSuites.length);
});
test('actual P01-A branch delta selects two suites even with accumulated generated, contract and migration edits',t=>{
 const base='9ce0a5639417f959111b11f70157156733e3de18',head='635e148651b2a85b18f5d40fe1fdea938ea94bf2';
 // This regression fixture is optional in shallow external test checkouts;
 // normal workflow uses full git history and the pure snapshot cases above always run.
 try{execFileSync('git',['cat-file','-e',head+'^{commit}'],{stdio:'pipe'});}catch{t.skip('Historical snapshot unavailable in shallow checkout; pure snapshot cases still run');return;}
 const changes=parseChanges(execFileSync('git',['diff','--name-status','-z',base,head],{encoding:'utf8'}));
 const cache=new Map(),read=(side,path)=>{const k=side+':'+path;if(!cache.has(k)){try{cache.set(k,execFileSync('git',['show',(side==='base'?base:head)+':'+path],{encoding:'utf8',maxBuffer:20*1024*1024,stdio:'pipe'}));}catch{cache.set(k,null);}}return cache.get(k);};
 const p=select(changes,{evidence:analyzeDelta(changes,read,[profile])});
 assert.equal(p.broad,false);assert.deepEqual(p.api,['tests/api-acceptance.test.mjs',p01Suite]);assert.deepEqual(p.priority,[p01Suite]);
});

test('request projection focus cannot own unrelated shared management contract changes',()=>{
 const path=contractPath,owned='lesson_request_create_v1',suite='tests/p01-lesson-requests.test.mjs';
 const p={id:'requests',sources:[],operations:[owned],managementRequestProjection:true,suites:[suite]};
 const snapshot={$defs:{ManagementStateView:{type:'object',properties:{current:{type:'string'}},required:['current']},Request_management_state_get:{type:'object',properties:{page:{type:'string'}},allOf:[]}},'x-contract':{operations:[{name:'management_state_get_v1',request:{$ref:'#/$defs/Request_management_state_get'},success:{$ref:'#/$defs/ManagementStateView'},features:[],conditional_features:[],runtime_selectors:['negcredit_valuation_set_v1'],permission:'management.inspect'}]}};
 const focused=structuredClone(snapshot);focused.$defs.ManagementStateView.properties.request_detail={$ref:'#/$defs/LessonRequestView'};focused.$defs.LessonRequestView={type:'object',properties:{id:{type:'string'}}};
 focused['x-contract'].operations[0].runtime_selectors.push(owned);
 const changes=[{status:'M',path}],run=head=>select(changes,{evidence:analyzeDelta(changes,(side,file)=>file===path?JSON.stringify(side==='base'?snapshot:head):null,[p])});
 assert.equal(run(focused).broad,false);
 for(const mutate of [
  h=>h.$defs.ManagementStateView.properties.current.type='number',
  h=>h.$defs.Request_management_state_get.properties.page.type='number',
  h=>h['x-contract'].operations[0].permission='account.self',
  h=>h['x-contract'].operations[0].runtime_selectors.push('unrelated_v1'),
  h=>h.$defs.ManagementStateView.required.push('request_detail')
 ]){const h=structuredClone(focused);mutate(h);assert.equal(run(h).broad,true);}
});

import {documentScope,rendererOnlyProse,gitDocumentScope} from '../scripts/ci/document-scope.mjs';
import {assertReady,assertParents,policyPath} from '../scripts/ci/source.mjs';
import {validateDocumentBinding} from '../scripts/ci/gate.mjs';
test('reviewed documentation scope excludes runtime with document-looking paths or labels',()=>{
 const read=()=>'',mode=()=>'100644';
 assert(documentScope([{path:'README.md',status:'M'}],read,mode).safe);
 for(const path of ['docs/runtime.md','docs/endpoint-inventory.json','contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json','packages/api-contracts/index.ts','scripts/ci/gate.mjs','.github/workflows/ci-full.yml','package-lock.json','supabase/migrations/document.md'])assert(!documentScope([{path,status:'M'}],read,mode).safe,path);
 assert(!documentScope([{path:'README.md',status:'M'}],read,()=>'120000').safe);
 assert(!documentScope([{path:'README.md',status:'M'},{path:'database/kernel.sql',status:'M'}],read,mode).safe);
 assert(!documentScope([],read,mode).safe);
});
test('PR24 cumulative delta is documentation; all other renderer logic remains executable scope',()=>{
 const base='7577b2f1873c6b1fcf83390bfa94a34374c44082',head='4e80716fdd6f12c3972635903c9435f253b34905';
 const old=execFileSync('git',['show',base+':scripts/render_catalogs.py'],{encoding:'utf8'}),now=fs.readFileSync('scripts/render_catalogs.py','utf8');
 assert(rendererOnlyProse(old,now));assert(gitDocumentScope(base,head).safe);
 for(const source of [now.replace("inventory={'runtime_version'","inventory={'injected':True,'runtime_version'"),now.replace("emit('docs/endpoint-inventory.json'","emit('docs/runtime.json'"),now+"\nimport os\nos.system('false')\n",now.replace("len(c['tables'])","len(c['operations'])")])assert(!rendererOnlyProse(old,source));
});
test('draft/development cannot receive acceptance even if full clean is green',()=>{
 for(const p of [{state:'open',draft:true,labels:[]},{state:'open',draft:false,labels:[{name:'development'}]},{state:'closed',draft:false,labels:[]}])assert.throws(()=>assertReady(p));
 assertReady({state:'open',draft:false,labels:[]});
 assert.throws(()=>assertParents({parents:[{sha:'B'},{sha:'X'}]},'B','H'));
 assert(policyPath('scripts/ci/document-paths.json'));assert(policyPath('.github/workflows/ci-docs.yml'));
});
test('documentation proof is separate, source bound and rejects stale/missing/skipped evidence',()=>{
 const v=valid();v.binding.kind='documentation';v.run.path='.github/workflows/ci-docs.yml';v.jobs[0].name='documentation';v.jobs[0].steps[0].name='Documentation acceptance';
 assert(validateDocumentBinding(v));
 for(const mutate of [x=>x.binding.kind='full',x=>x.pr.base.sha='new',x=>x.binding.attempt=2,x=>x.currentTree='new',x=>x.workflowMatches=false,x=>x.jobs=[],x=>x.jobs[0].steps[0].conclusion='skipped']){const x=structuredClone(v);mutate(x);assert.throws(()=>validateDocumentBinding(x));}
});

import {shardPlan,coverageHash,validateJobs} from '../scripts/ci/shards.mjs';
import {measurements} from '../scripts/ci/collect.mjs';
test('four deterministic measured shards partition every suite exactly once with bounded weight imbalance',()=>{
 const bins=shardPlan();assert.equal(bins.length,4);
 assert.deepEqual(bins.flatMap(b=>b.suites).sort(),[...apiSuites].sort());
 assert.equal(new Set(bins.flatMap(b=>b.suites)).size,apiSuites.length);
 assert.deepEqual(bins,shardPlan([...apiSuites].reverse()));
 assert(Math.max(...bins.map(b=>b.weight))/Math.min(...bins.map(b=>b.weight))<1.08);
 assert.throws(()=>shardPlan([...apiSuites,apiSuites[0]]));
 assert.throws(()=>shardPlan([...apiSuites,'tests/unknown.test.mjs']));
 assert.throws(()=>shardPlan(apiSuites.slice(1)));
});
test('all required shard jobs must execute in the same run attempt and head; benchmark cannot be omitted',()=>{
 const v=valid();assert(validateJobs(v.jobs,v.run,{collector:true}));
 for(const mutate of [x=>x.jobs.splice(2,1),x=>x.jobs.push(structuredClone(x.jobs[1])),x=>x.jobs[1].conclusion='skipped',x=>x.jobs[2].conclusion='cancelled',x=>x.jobs[3].conclusion='failure',x=>x.jobs[4].run_attempt=2,x=>x.jobs[4].run_id=6,x=>x.jobs[4].head_sha='other',x=>x.jobs[4].steps[0].conclusion='skipped',x=>x.binding.coverage='other',x=>x.binding.benchmark=true]){
  const x=valid();mutate(x);assert.throws(()=>validateBinding(x));
 }
});
test('reusable full clean retains all obligations and isolated setup; final trigger never comes from readiness',()=>{
 const clean=fs.readFileSync('.github/workflows/clean-suite.yml','utf8'),runner=fs.readFileSync('scripts/test-clean.mjs','utf8');
 assert(clean.includes('shard: [1, 2, 3, 4]'));assert(clean.includes('fail-fast: false'));assert(!clean.includes('max-parallel: 1'));
 assert(clean.includes('needs: [core, api, serial-reference]'));assert(clean.includes('if: always()'));assert(clean.includes('Verify all required jobs'));
 for(const op of ['verify','test:db','dev:seed','dev:health','db:advisors'])assert(runner.includes("['run','"+op+"']"));
 assert(runner.includes("['db','reset','--local','--no-seed','--yes']"));assert(runner.includes("'auth.users'"));
 const full=fs.readFileSync('.github/workflows/ci-full.yml','utf8'),docs=fs.readFileSync('.github/workflows/ci-docs.yml','utf8'),gate=fs.readFileSync('.github/workflows/ci-gate.yml','utf8');
 assert(full.includes("github.event.pull_request.draft == false"));assert(full.includes("'development'"));assert(!full.includes('ready_for_review'));assert(!full.includes('synchronize'));
 assert(!docs.includes('test:clean'));assert(gate.includes('converted_to_draft'));assert(gate.includes("branches: [main]"));assert(gate.includes("ref: main"));
});
test('CI-only cumulative proof cannot hide runtime or unknown markdown in later documentation commits',()=>fixture((dir,git)=>{
 mkdirSync(join(dir,'.github/workflows'),{recursive:true});writeFileSync(join(dir,'.github/workflows/ci-full.yml'),'# synthetic harness');git('add','.');git('commit','-m','ci');
 const run=()=>{execFileSync(process.execPath,[resolve('scripts/ci/select-tests.mjs'),'unused',git('rev-parse','HEAD')],{cwd:dir});return JSON.parse(fs.readFileSync(join(dir,'.ci/selection.json')));};
 assert.equal(run().db,false);assert(run().structural);
 writeFileSync(join(dir,'README.md'),'Later docs');git('add','README.md');git('commit','-m','docs');assert.equal(run().db,false);
 mkdirSync(join(dir,'database'));writeFileSync(join(dir,'database/kernel.sql'),'-- runtime');git('add','database');git('commit','-m','runtime');assert.equal(run().db,true);
 writeFileSync(join(dir,'README.md'),'Final docs');git('add','README.md');git('commit','-m','final docs');assert.equal(run().api.length,apiSuites.length);
}));
test('measurement distinguishes queue setup test wall and runner time',()=>{
 const rows=measurements([{name:'clean / api-1',status:'completed',conclusion:'success',created_at:'2026-01-01T00:00:00Z',started_at:'2026-01-01T00:00:10Z',completed_at:'2026-01-01T00:02:00Z',steps:[{name:'Clean acceptance',started_at:'2026-01-01T00:00:30Z',completed_at:'2026-01-01T00:01:50Z'}]}],'2026-01-01T00:00:00Z');
 assert.equal(rows[0].queue_s,10);assert.equal(rows[0].setup_s,20);assert.equal(rows[0].test_s,80);assert.equal(rows[0].runner_s,110);
});

test('every test file is accounted for in structural DB or API clean obligations',()=>{const actual=fs.readdirSync('tests').filter(p=>p.endsWith('.test.mjs')).map(p=>'tests/'+p).sort();assert.deepEqual(actual,[...apiSuites,...['contract','governance','ci-policy','database','event-scope'].map(n=>'tests/'+n+'.test.mjs')].sort());});
test('requesting serial comparison invalidates a prior candidate that never ran it',()=>{
 const v=valid();v.pr.labels=[{name:'ci:measure-serial'}];assert.throws(()=>validateBinding(v),/serial comparison/);
});

import {resolveRecovery} from '../scripts/ci/recovery.mjs';
test('new-source documentation recovery preserves github-script context getters and binds actual merge',async()=>{
 const sha='d'.repeat(40),repo={owner:'synthetic',repo:'test'},out={};
 // actions/github context.repo is a prototype getter, not an own property.
 const context=Object.assign(Object.create({get repo(){return repo;}}),{sha:'new-policy',runId:7,payload:{inputs:{merge_sha:sha}}});
 const pr={number:24,merged_at:'now',merge_commit_sha:sha,base:{sha:'B'},head:{sha:'H'}};
 const g={rest:{repos:{listPullRequestsAssociatedWithCommit:'prs'},git:{
  getCommit:async args=>{assert.equal(args.owner,'synthetic');return {data:{sha,tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]}};},
  getTree:async args=>({data:{tree:[{path:'README.md',mode:'100644',type:'blob',sha:args.tree_sha+'-doc'}]}}),
  getBlob:async()=>({data:{encoding:'base64',content:Buffer.from('Regular documentation').toString('base64')}})
 }},paginate:async(method,args)=>{assert.equal(args.owner,'synthetic');assert.equal(args.repo,'test');return [pr];}};
 await resolveRecovery(g,context,{setOutput:(k,v)=>out[k]=v});
 const b=JSON.parse(out.binding);assert.equal(b.actual,sha);assert.equal(b.head,'H');assert.equal(b.base,'B');assert.equal(b.tree,'T');assert.equal(b.policy_sha,'new-policy');assert.equal(b.kind,'documentation-recovery');
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
