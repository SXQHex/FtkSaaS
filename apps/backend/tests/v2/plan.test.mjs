import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createPlan} from '../../scripts/ci/v2/plan.mjs';

function repository(t){
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'ftk-v2-plan-'));
 t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 git('init','-q');git('config','user.email','fixture@ftksaas.invalid');git('config','user.name','Synthetic fixture');
 fs.mkdirSync(path.join(cwd,'apps/web/src'),{recursive:true});
 fs.writeFileSync(path.join(cwd,'apps/web/src/page.ts'),'export const version=1;\n');
 git('add','.');git('commit','-qm','base');
 const base=git('rev-parse','HEAD').trim();
 fs.writeFileSync(path.join(cwd,'apps/web/src/page.ts'),'export const version=2;\n');
 git('add','.');git('commit','-qm','web change');
 return {cwd,git,base,head:git('rev-parse','HEAD').trim()};
}

test('real committed diff produces a source-bound diagnostic with no backend or deploy authorization',t=>{
 const f=repository(t),p=createPlan({...f,mode:'auto'});
 assert.equal(p.source.head,f.head);assert.equal(p.source.base,f.base);
 assert.equal(p.source.tree,f.git('rev-parse','HEAD^{tree}').trim());
 assert.deepEqual(p.paths,['apps/web/src/page.ts']);
 assert.equal(p.impact.frontend,true);assert.equal(p.impact.backend,false);
 assert.equal(p.impact.baseline,true);assert.equal(p.acceptance,false);
 assert.equal(p.backend_execution,'not-implemented');
 const full=createPlan({...f,mode:'full'});
 assert.equal(full.impact.backend_matrix.length,12);
});

test('wrong checkout, symbolic refs, non-ancestor base, dirty source and empty diff are rejected',t=>{
 const f=repository(t);
 for(const change of [{head:f.base},{head:'main'},{base:'HEAD'},{base:f.head,head:f.base},{base:f.head}]){
  assert.throws(()=>createPlan({...f,...change}));
 }
 fs.writeFileSync(path.join(f.cwd,'untracked.txt'),'uncommitted input');
 assert.throws(()=>createPlan(f));
});

test('a clean unrelated history cannot be used as the comparison baseline',t=>{
 const f=repository(t);
 f.git('checkout','--orphan','unrelated');f.git('commit','-qm','unrelated history');
 const head=f.git('rev-parse','HEAD').trim();
 assert.equal(f.git('status','--porcelain').trim(),'');
 assert.throws(()=>createPlan({cwd:f.cwd,base:f.base,head}));
});
