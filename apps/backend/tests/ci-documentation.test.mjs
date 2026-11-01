import test from 'node:test';
import assert from 'node:assert/strict';
import fs,{writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {documentScope,rendererOnlyProse} from '../scripts/ci/document-scope.mjs';
import {markdownAnchors,checkDocuments,historicalSnapshot} from '../scripts/ci/docs-check.mjs';
import {workflowPath,validateWorkflows,renderReferences} from '../scripts/update-docs.mjs';
import {structure,validateCapture} from '../scripts/capture-docs.mjs';
import {project} from '../scripts/ci/deploy-development.mjs';
import {classifyChanges,ownerOf} from '../scripts/ci/scope.mjs';
import {parseChanges} from '../scripts/ci/select-tests.mjs';
import {registryPath,livingMarkdown,validateDocumentRegistry,renderDocumentMap} from '../scripts/document-registry.mjs';
import {repositoryRoot} from '../scripts/paths.mjs';
import {fixture,change} from './ci-fixtures.mjs';
process.chdir(repositoryRoot);

test('deleting or renaming referenced documentation is detected through unchanged inbound links',()=>fixture((dir,git)=>{writeFileSync(join(dir,'README.md'),'[Target](target.md)\n');writeFileSync(join(dir,'target.md'),'Target\n');git('add','.');git('commit','-m','links');fs.renameSync(join(dir,'target.md'),join(dir,'renamed.md'));assert.throws(()=>execFileSync(process.execPath,[resolve('apps/backend/scripts/ci/docs-check.mjs'),'target.md'],{cwd:dir,stdio:'pipe'}),/Command failed/);}));

test('reviewed documentation scope excludes runtime with document-looking paths or labels',()=>{
 const read=()=>'',mode=()=>'100644';
 assert(documentScope([{path:'README.md',status:'M'}],read,mode).safe);
 for(const path of ['docs/runtime.md','../../docs/endpoint-inventory.json','packages/api-contracts/schema/contract.json','packages/api-contracts/index.ts','apps/backend/scripts/ci/gate.mjs','.github/workflows/ci-full.yml','package-lock.json','apps/backend/supabase/migrations/document.md'])assert(!documentScope([{path,status:'M'}],read,mode).safe,path);
 assert(!documentScope([{path:'README.md',status:'M'}],read,()=>'120000').safe);
 assert(!documentScope([{path:'README.md',status:'M'},{path:'apps/backend/database/kernel.sql',status:'M'}],read,mode).safe);
 assert(!documentScope([],read,mode).safe);
});

test('renderer prose proof retains historical evidence and rejects current executable path changes',()=>{
 const base='7577b2f1873c6b1fcf83390bfa94a34374c44082',head='4e80716fdd6f12c3972635903c9435f253b34905';
 const old=execFileSync('git',['show',base+':scripts/render_catalogs.py'],{encoding:'utf8'}),historical=execFileSync('git',['show',head+':scripts/render_catalogs.py'],{encoding:'utf8'}),now=fs.readFileSync('apps/backend/scripts/render_catalogs.py','utf8');
 assert(rendererOnlyProse(old,historical));
 assert(!rendererOnlyProse(old,now)); // Moving executable input/output paths requires full acceptance.
 assert(!rendererOnlyProse(now,now.replace('domain tablo tanımı','domain tablo listesi'))); // New renderer has no inherited prose-only exception.
 for(const source of [now.replace("inventory={'runtime_version'","inventory={'injected':True,'runtime_version'"),now.replace("emit('../../docs/endpoint-inventory.json'","emit('docs/runtime.json'"),now+"\nimport os\nos.system('false')\n",now.replace("len(c['tables'])","len(c['operations'])")])assert(!rendererOnlyProse(now,source));
});

test('document links reject missing fragments and ignore fenced example headings',()=>fixture((dir)=>{
 const target=join(dir,'target.md'),source=join(dir,'source.md');
 writeFileSync(target,'# Güncel kabul\n\n# Güncel kabul\n\n```md\n# Örnek\n```\n<a id="stable-wire"></a>\n');
 const anchors=markdownAnchors(fs.readFileSync(target,'utf8'));
 assert(anchors.has('güncel-kabul'));assert(anchors.has('güncel-kabul-1'));assert(anchors.has('stable-wire'));assert(!anchors.has('örnek'));
 writeFileSync(source,'[Kabul](target.md#güncel-kabul-1) [Wire](target.md#stable-wire)');assert.equal(checkDocuments([source]),2);
 writeFileSync(source,'[Yanlış](target.md#örnek)');assert.throws(()=>checkDocuments([source]),/BROKEN_LOCAL_ANCHOR/);
 writeFileSync(source,'[Silindi](deleted.md)');assert.throws(()=>checkDocuments([source]),/BROKEN_LOCAL_LINK/);
}));

test('only exact source-manifest snapshots retain historical link context',()=>{
 const records=JSON.parse(fs.readFileSync('docs/history/manifest.json')).files;
 for(const {path:file} of records){const text=fs.readFileSync(file,'utf8');assert(historicalSnapshot(file,text));assert.throws(()=>historicalSnapshot(file,text+'tampered'),/HISTORICAL_SNAPSHOT_DRIFT/);}
 assert.equal(historicalSnapshot('docs/history/reports/unreviewed.md','[bad](missing.md)'),false);
 assert.equal(checkDocuments(records.filter(r=>r.path.endsWith('.md')).map(r=>r.path)),0);
});

test('workflow map rejects missing duplicate unknown APIs and worker promotion to UI',()=>{
 const root=resolve('.'),manifest=JSON.parse(fs.readFileSync(workflowPath)),contract=JSON.parse(fs.readFileSync('packages/api-contracts/schema/contract.json'));
 assert.equal(validateWorkflows(manifest,contract,root).size,contract['x-contract'].operations.length);
 for(const mutate of [
  m=>m.flows[0].operations.pop(),
  m=>m.flows[0].operations.push(m.flows[1].operations[0]),
  m=>m.flows[0].operations.push('invented_operation_v1'),
  m=>m.flows.find(f=>f.audience==='backend-only').audience='starter',
  m=>m.flows[0].guide='docs/workflows.md#missing',
  m=>m.flows[0].tests=['apps/backend/tests/missing.mjs'],
  m=>m.flows[0].sources=['../.env'],
  m=>m.flows[0].review.fingerprint='0'.repeat(64)
 ]){const m=structuredClone(manifest);mutate(m);assert.throws(()=>validateWorkflows(m,contract,root));}
 const changed=structuredClone(contract);changed['x-contract'].operations[0].permission='different';
 assert.throws(()=>validateWorkflows(manifest,changed,root),/WORKFLOW_REVIEW_REQUIRED/);
 const outputs=renderReferences(root,manifest,contract).outputs;
 for(const [p,content] of Object.entries(outputs))assert.equal(fs.readFileSync(p,'utf8'),content,p);
});

test('documentation metadata comparison distinguishes schema drift from environment ACL and requires exact successful CD',()=>{
 const catalog={format:1,relations:[{name:'example',rls:true,columns:[{name:'id',type:'uuid'}]}],functions:[],policies:[],grants:{relations:[]}};
 const reordered={grants:{relations:['different worker role']},policies:[],functions:[],relations:catalog.relations,format:1};
 assert.equal(structure(catalog),structure(reordered));
 const drift=structuredClone(catalog);drift.relations[0].rls=false;assert.notEqual(structure(catalog),structure(drift));
 const source='a'.repeat(40),receipt={success:true,project:'gwyprhenabtpkbojephw',source};validateCapture(receipt,source);
 for(const invalid of [{...receipt,success:false},{...receipt,project:'other'},{...receipt,source:'b'.repeat(40)}])assert.throws(()=>validateCapture(invalid,source));
});

test('every staged document move is classifiable at both ends and retired paths cannot silently return',()=>{
 const moves=JSON.parse(fs.readFileSync('apps/backend/scripts/ci/document-moves.json'));
 for(const [oldPath,newPath] of Object.entries(moves)){
  assert.equal(classifyChanges([change(oldPath)]).kind,'documentation',oldPath);
  assert.equal(classifyChanges([change(newPath)]).kind,'documentation',newPath);
  assert(!fs.existsSync(oldPath),oldPath);assert(fs.existsSync(newPath),newPath);
 }
 // Inspect the actual complete branch delta, including deleted rename sources.
 const changes=parseChanges(execFileSync('git',['diff','--name-status','-z','--no-renames','HEAD'],{encoding:'utf8'}));
 for(const item of changes)assert.doesNotThrow(()=>ownerOf(item.path),item.path);
});

test('unassigned integration runtime sources and transport dependency drift require review',()=>{
 const root=resolve('.'),p='apps/backend/transports/unassigned-documentation-fixture.mjs';
 const manifest=JSON.parse(fs.readFileSync(workflowPath)),contract=JSON.parse(fs.readFileSync('packages/api-contracts/schema/contract.json'));
 assert(manifest.flows.find(f=>f.id==='WF09').sources.includes('apps/backend/transports/calendar-proxy.mjs'));
 for(const name of ['p01-worker.mjs','p05-worker.mjs','p06-worker.mjs'])assert(manifest.flows.find(f=>f.id==='WF20').sources.includes('apps/backend/scripts/'+name));
 fs.writeFileSync(p,'// test fixture; no execution\n');
 try{assert.throws(()=>validateWorkflows(manifest,contract,root),/UNASSIGNED_WORKFLOW_SOURCE/);}finally{fs.rmSync(p);}
 const altered=structuredClone(manifest),flow=altered.flows.find(f=>f.id==='WF09');flow.sources=flow.sources.filter(p=>!p.includes('calendar-proxy'));
 assert.throws(()=>validateWorkflows(altered,contract,root),/WORKFLOW_REVIEW_REQUIRED|UNASSIGNED_WORKFLOW_SOURCE/);
});

test('document ownership rejects unregistered prose, duplicate topic authorities and stale records',()=>{
 const root=resolve('.'),registry=JSON.parse(fs.readFileSync(registryPath)),files=livingMarkdown(root);
 assert.equal(validateDocumentRegistry(registry,files,root),files.length);
 const duplicate=structuredClone(registry);duplicate.documents[1].topics=[registry.documents[0].topics[0]];
 assert.throws(()=>validateDocumentRegistry(duplicate,files,root),/DUPLICATE_TOPIC_OWNER/);
 assert.throws(()=>validateDocumentRegistry(registry,[...files,'docs/unreviewed-topic.md'],root),/UNREGISTERED_DOCUMENT/);
 assert.throws(()=>validateDocumentRegistry(registry,files.slice(1),root),/STALE_DOCUMENT_REGISTRY/);
 const archived=structuredClone(registry);archived.documents[0].path='docs/history/reports/decision-sprint-review.md';
 assert.throws(()=>validateDocumentRegistry(archived,files,root),/INVALID_LIVING_DOCUMENT/);
 const traversal=structuredClone(registry);traversal.documents[0].path='../outside.md';
 assert.throws(()=>validateDocumentRegistry(traversal,files,root),/INVALID_LIVING_DOCUMENT/);
 for(const role of ['status','backlog','queue']){
  const misplaced=structuredClone(registry);misplaced.documents.find(d=>d.path==='docs/workflows.md').role=role;
  assert.throws(()=>validateDocumentRegistry(misplaced,files,root),/DEVELOPMENT_STATE_OUTSIDE_APP_DOCS/);
 }
 const secondRequests=structuredClone(registry);secondRequests.documents.find(d=>d.path==='docs/workflows.md').role='coordination';
 assert.throws(()=>validateDocumentRegistry(secondRequests,files,root),/INVALID_COORDINATION_DOCUMENT/);
 const lostRequestsOwner=structuredClone(registry);lostRequestsOwner.documents.find(d=>d.path==='docs/requests.md').role='guide';
 assert.throws(()=>validateDocumentRegistry(lostRequestsOwner,files,root),/INVALID_COORDINATION_DOCUMENT/);
 assert.equal(fs.readFileSync('docs/documentation-map.md','utf8'),renderDocumentMap(registry));
});

test('active documentation cannot use historical snapshots as current instructions',()=>{
 const p='.artifacts/docs-current-history-negative.md';fs.mkdirSync('.artifacts',{recursive:true});
 fs.writeFileSync(p,'[old decision](../docs/history/reports/decision-sprint-review.md)\n');
 try{assert.throws(()=>checkDocuments([p]),/HISTORICAL_DOCUMENT_AS_CURRENT/);}finally{fs.rmSync(p);}
});

test('workflow prose cannot recommend an operation absent from the machine contract',()=>{
 const root=resolve('.'),manifest=JSON.parse(fs.readFileSync(workflowPath)),contract=JSON.parse(fs.readFileSync('packages/api-contracts/schema/contract.json'));
 // A removed operation is still cited by the guide: prose validation must reject it before mapping/coverage.
 contract['x-contract'].operations=contract['x-contract'].operations.filter(o=>o.name!=='preview_get_v1');
 assert.throws(()=>validateWorkflows(manifest,contract,root),/UNKNOWN_WORKFLOW_API preview_get_v1/);
});
