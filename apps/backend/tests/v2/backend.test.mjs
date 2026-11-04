import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import suites from './backend-suites.json' with {type:'json'};
import {buildInventory} from '../../scripts/ci/api-suites.mjs';
import {repositoryRoot,repoFile} from '../../scripts/paths.mjs';
import {backendPlan} from '../../scripts/ci/v2/backend.mjs';
import {relocateImports} from '../../scripts/ci/v2/migration.mjs';

test('twelve nonempty shards cover every direct suite exactly once',()=>{
 const plan=backendPlan();assert.equal(plan.length,12);
 assert(plan.every(job=>job.files.length>0));
 assert.deepEqual(plan.flatMap(job=>job.files).sort(),suites.map(s=>s.file).sort());
 assert.equal(new Set(plan.flatMap(job=>job.files)).size,suites.length);
 assert.deepEqual(backendPlan([...suites].reverse()),plan);
 for(const broken of [suites.slice(0,11),[...suites,suites[0]],suites.map((s,i)=>i?s:{...s,file:'../private.mjs'}),suites.map((s,i)=>i?s:{...s,estimated_seconds:0})])assert.throws(()=>backendPlan(broken));
});

test('direct migration retains all legacy unit bodies, assertions and resource paths',()=>{
 const inventory=buildInventory(repositoryRoot);
 assert.deepEqual(suites.map(s=>s.id).sort(),inventory.units.map(u=>u.id).sort());
 for(const suite of suites){
  const unit=inventory.units.find(u=>u.id===suite.id);
  assert.equal(suite.legacy_source,unit.source);
  const expected=suite.file===unit.source?unit.code:relocateImports(unit.code,unit.source,suite.file);
  assert.equal(fs.readFileSync(repoFile(suite.file),'utf8'),expected,suite.id);
  const check=spawnSync(process.execPath,['--check',repoFile(suite.file)],{stdio:'pipe'});
  assert.equal(check.status,0,suite.id+' syntax');
 }
});

test('module/resource relocation leaves ordinary strings, comments and assertions intact',()=>{
 const source=`import {x} from './helper.mjs';\nconst other=import('../scripts/other.mjs');\nconst fixture=new URL('./fixtures/a.sql',import.meta.url);\nconst text="import('./keep.mjs')";\n// import './keep-comment.mjs';\nassert.equal(x,42);\n`;
 const moved=relocateImports(source,'apps/backend/tests/example.mjs','apps/backend/tests/v2/backend/example.test.mjs');
 assert(moved.includes("from '../../helper.mjs'"));
 assert(moved.includes('import("../../../scripts/other.mjs")'));
 assert(moved.includes("new URL('../../fixtures/a.sql',import.meta.url)"));
 assert(moved.includes(`const text="import('./keep.mjs')";`));
 assert(moved.includes("// import './keep-comment.mjs';"));
 assert(moved.includes('assert.equal(x,42);'));
});
