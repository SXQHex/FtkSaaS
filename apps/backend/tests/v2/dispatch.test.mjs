import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {selectImpact} from '../../scripts/ci/v2/scope.mjs';
import {assertShadowResults,createDispatchPlan} from '../../scripts/ci/v2/dispatch.mjs';

test('frontend backend and common changes require only their selected domains plus baseline controls',()=>{
 for(const [file,frontend,backend] of [['apps/web/src/page.tsx',true,false],['apps/backend/database/kernel.sql',false,true],['packages/api-contracts/src/index.ts',true,true],['docs/workflows.md',false,false]]){
  const impact=selectImpact([file]);assert.equal(impact.frontend,frontend);assert.equal(impact.backend,backend);
  const results={common:'success',frontend:frontend?'success':'skipped',backend:backend?'success':'skipped'};
  assert.doesNotThrow(()=>assertShadowResults(impact,results));
  for(const [name,value] of Object.entries(results))for(const status of ['failure','cancelled',undefined,value==='skipped'?'success':'skipped'])assert.throws(()=>assertShadowResults(impact,{...results,[name]:status}));
  assert.equal(impact.backend_matrix.length,backend?20:0);
 }
 assert.equal(selectImpact(['apps/web/src/page.tsx']).common,false);
});

test('invalid scope cannot manufacture successful shadow completion',()=>{
 for(const impact of [{},{baseline:'true',frontend:false,backend:false},{baseline:true,frontend:false,backend:true,backend_matrix:[]}])assert.throws(()=>assertShadowResults(impact,{common:'success',frontend:'skipped',backend:'skipped'}));
});

test('dispatch uses an exact committed range and rejects changed symlinks',t=>{
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'ftk-v2-dispatch-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','-q');git('config','user.email','fixture@ftksaas.invalid');git('config','user.name','Synthetic fixture');
 fs.mkdirSync(path.join(cwd,'apps/web/src'),{recursive:true});fs.writeFileSync(path.join(cwd,'README.md'),'fixture\n');git('add','.');git('commit','-qm','base');const base=git('rev-parse','HEAD');
 fs.writeFileSync(path.join(cwd,'apps/web/src/page.ts'),'export const page=1;\n');git('add','.');git('commit','-qm','frontend');
 const plan=createDispatchPlan({cwd,base,head:git('rev-parse','HEAD')});assert.equal(plan.kind,'shadow-dispatch');assert.equal(plan.acceptance,false);assert.equal(plan.impact.backend,false);assert.equal(plan.frontend_execution,'selected');
 fs.symlinkSync('../../../README.md',path.join(cwd,'apps/web/src/link.ts'));git('add','.');git('commit','-qm','unsafe link');
 assert.throws(()=>createDispatchPlan({cwd,base,head:git('rev-parse','HEAD')}),/SOURCE_MODE/);
});
