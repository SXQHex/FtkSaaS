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
const valid=()=>({binding:{pr:1,head:'H',base:'B',merge:'M',tree:'T',run_id:5,attempt:1},pr:{number:1,head:{sha:'H'},base:{sha:'B'}},run:{id:5,run_attempt:1,head_sha:'H',event:'pull_request',path:'.github/workflows/ci-full.yml',status:'completed',conclusion:'success'},tested:{sha:'M',tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]},currentTree:'T',workflowMatches:true,jobs:[{name:'full-clean',conclusion:'success',steps:[{name:'Full clean acceptance',conclusion:'success'},{name:'Verify tested merge',conclusion:'success'}]}]});
test('merge acceptance binds live head base merge tree workflow and attempt',()=>{assert(validateBinding(valid()));for(const mutate of [v=>v.pr.head.sha='new',v=>v.pr.base.sha='new',v=>v.currentTree='new',v=>v.binding.attempt=2,v=>v.run.event='push',v=>v.workflowMatches=false,v=>v.tested.parents[1].sha='other']){const v=valid();mutate(v);assert.throws(()=>validateBinding(v));}});
test('label, skipped job or skipped clean step never constitutes acceptance',()=>{for(const mutate of [v=>v.jobs=[],v=>v.jobs[0].conclusion='skipped',v=>v.jobs[0].steps[0].conclusion='skipped',v=>v.run.conclusion='cancelled']){const v=valid();mutate(v);assert.throws(()=>validateBinding(v));}});
test('workflow event boundaries prevent duplicate expensive runs and cross-PR cancellation',()=>{const fast=fs.readFileSync('.github/workflows/ci-fast.yml','utf8'),full=fs.readFileSync('.github/workflows/ci-full.yml','utf8'),main=fs.readFileSync('.github/workflows/backend.yml','utf8');assert(!fast.includes('pull_request:'));assert(full.includes('types: [labeled]'));assert(full.includes("github.event.label.name == 'ci:full-clean'"));assert(fast.includes('development-${{ github.ref }}'));assert(main.includes('main-acceptance-${{ github.sha }}'));assert(main.includes('cancel-in-progress: false'));});

import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';import {execFileSync} from 'node:child_process';
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'ci-selection-'));const git=(...a)=>execFileSync('git',a,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();try{git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');writeFileSync(join(dir,'README.md'),'Initial\n');git('add','.');git('commit','-m','base');git('update-ref','refs/remotes/origin/main',git('rev-parse','HEAD'));return fn(dir,git);}finally{rmSync(dir,{recursive:true,force:true});}}
test('cumulative selector retains canceled API commit coverage when next commit changes docs',()=>fixture((dir,git)=>{mkdirSync(join(dir,'database'));writeFileSync(join(dir,'database/instructor-earnings.sql'),'-- synthetic');git('add','.');git('commit','-m','module');const before=git('rev-parse','HEAD');writeFileSync(join(dir,'README.md'),'Later documentation\n');git('add','.');git('commit','-m','docs');const head=git('rev-parse','HEAD');execFileSync(process.execPath,[resolve('scripts/ci/select-tests.mjs'),before,head],{cwd:dir});const p=JSON.parse(fs.readFileSync(join(dir,'.ci/selection.json')));assert(p.api.includes('tests/cross-center-settlement.test.mjs'));assert(p.db);}));
test('deleting or renaming referenced documentation is detected through unchanged inbound links',()=>fixture((dir,git)=>{writeFileSync(join(dir,'README.md'),'[Target](target.md)\n');writeFileSync(join(dir,'target.md'),'Target\n');git('add','.');git('commit','-m','links');fs.renameSync(join(dir,'target.md'),join(dir,'renamed.md'));assert.throws(()=>execFileSync(process.execPath,[resolve('scripts/ci/docs-check.mjs'),'target.md'],{cwd:dir,stdio:'pipe'}),/Command failed/);}));

import {verifyMerged} from '../scripts/ci/gate.mjs';
test('main verification rejects missing proof before running expensive acceptance',async()=>{const g={rest:{repos:{listPullRequestsAssociatedWithCommit:'prs'},actions:{listWorkflowRuns:'runs'}},paginate:async method=>method==='prs'?[{number:1,merged_at:'now',merge_commit_sha:'M',head:{sha:'H'},base:{sha:'B'}}]:[]};g.rest.git={getCommit:async()=>({data:{sha:'M',tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]}})};await assert.rejects(()=>verifyMerged(g,{repo:{owner:'synthetic',repo:'test'},sha:'M'},{summary:{}}),/No source-bound full clean evidence/);});
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
