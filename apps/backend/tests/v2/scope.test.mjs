import test from 'node:test';
import assert from 'node:assert/strict';
import {selectImpact,parseNameStatus} from '../../scripts/ci/v2/scope.mjs';
import webTasks from '../../../web/turbo.json' with {type:'json'};

test('frontend source never selects backend tests or Supabase delivery',()=>{
 const p=selectImpact(['apps/web/src/app/page.tsx']);
 assert.equal(p.frontend,true);assert.equal(p.backend,false);
 assert.deepEqual(p.deploy,{vercel:true,supabase:false});
 assert.equal(p.backend_matrix.length,0);
});

test('backend runtime selects exactly twenty shards without frontend execution',()=>{
 const p=selectImpact(['apps/backend/supabase/migrations/20261104000000_room.sql']);
 assert.equal(p.frontend,false);assert.equal(p.backend,true);
 assert.deepEqual(p.deploy,{vercel:false,supabase:true});
 assert.deepEqual(p.backend_matrix,Array.from({length:20},(_,i)=>({shard:i+1})));
});

test('test, documentation and CI changes do not authorize application deployment',()=>{
 for(const file of ['apps/backend/tests/registry.test.mjs','apps/web/tests/api.test.ts',
  'apps/backend/docs/remaining-work.md','docs/workflows.md','.github/workflows/ci-v2-pilot.yml',
  'apps/backend/scripts/ci/v2/scope.mjs','docs/workflows.json','AGENTS.md',
  'apps/web/vitest.config.ts','packages/ui/vitest.config.ts','packages/ui/README.md','apps/web/scripts/verify-isolation.mjs']){
  assert.deepEqual(selectImpact([file]).deploy,{vercel:false,supabase:false},file);
 }
 assert.equal(selectImpact(['apps/backend/tests/registry.test.mjs']).frontend,false);
 assert.equal(selectImpact(['apps/web/tests/api.test.ts']).backend,false);
 const docs=selectImpact(['docs/workflows.md']);
 assert.equal(docs.backend,false);assert.equal(docs.frontend,false);assert.equal(docs.common,true);
});

test('common runtime dependencies select both consumers; compatibility stays diagnostic',()=>{
 for(const file of ['packages/api-contracts/schema/contract.json','packages/typescript-config/base.json','pnpm-lock.yaml']){
  const p=selectImpact([file]);assert.equal(p.common,true);assert.equal(p.frontend,true);assert.equal(p.backend,true);
  assert.deepEqual(p.deploy,{vercel:true,supabase:true});
 }
 assert.equal(selectImpact(['packages/api-contracts/src/generated.ts']).compatibility,'diagnostic');
});

test('the actual server bridge is a web input, not a Supabase deployment',()=>{
 const paths=webTasks.tasks.build.inputs.filter(input=>input.startsWith('$TURBO_ROOT$/apps/backend/')).map(input=>input.slice('$TURBO_ROOT$/'.length));
 assert(paths.includes('apps/backend/scripts/uuid.mjs'));
 assert(paths.includes('apps/backend/scripts/p04-public-ingress.mjs'));
 for(const file of paths){
  const p=selectImpact([file]);assert.equal(p.frontend,true,file);assert.equal(p.backend,true,file);
  assert.deepEqual(p.deploy,{vercel:true,supabase:false},file);
 }
 assert.equal(selectImpact(['apps/backend/package.json']).deploy.vercel,true);
});

test('unknown scope fails wide and sandbox renames cannot hide a removed production source',()=>{
 const unknown=selectImpact(['packages/future-runtime/index.ts']);
 assert.equal(unknown.frontend,true);assert.equal(unknown.backend,true);assert.equal(unknown.common,true);
 assert.deepEqual(unknown.deploy,{vercel:true,supabase:true});
 const changes=parseNameStatus('R100\0apps/backend/database/kernel.sql\0apps/web1/kernel.sql\0');
 assert.deepEqual(changes,['apps/backend/database/kernel.sql','apps/web1/kernel.sql']);
 assert.equal(selectImpact(changes).backend,true);
 assert.equal(selectImpact(['apps/web1/page.tsx']).backend,false);
});

test('full and backend requests always retain twenty backend shards',()=>{
 const backend=selectImpact(['docs/workflows.md'],'backend');
 assert.equal(backend.backend_matrix.length,20);assert.equal(backend.frontend,false);
 const full=selectImpact(['docs/workflows.md'],'full');
 assert.equal(full.backend_matrix.length,20);assert.equal(full.frontend,true);assert.equal(full.common,true);
 // A wider verification request never turns a docs change into deployment.
 assert.deepEqual(full.deploy,{vercel:false,supabase:false});
});

test('truncated, invalid or empty change lists cannot become successful no-op plans',()=>{
 for(const paths of [[],['../apps/web/a.ts'],['/apps/web/a.ts'],['apps/web/../backend/a.ts'],['a\nb']]){
  assert.throws(()=>selectImpact(paths));
 }
 for(const raw of ['M\0file','R100\0old\0','X\0file\0'])assert.throws(()=>parseNameStatus(raw));
 assert.throws(()=>selectImpact(['README.md'],'fast'));
});
