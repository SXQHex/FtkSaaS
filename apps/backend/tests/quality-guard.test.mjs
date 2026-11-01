import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {inspectDiff,collectDiff,applyExceptions} from '../scripts/ci/floor-guard.mjs';
import {validateQuality,qualitySteps} from '../scripts/ci/quality-proof.mjs';
const patch = (name, lines) => `diff --git a/${name} b/${name}\n--- a/${name}\n+++ b/${name}\n@@ -1 +1 @@\n${lines}\n`;
const suppressed = ['// @ts', 'ignore'].join('-');
const disabled = ['test', 'skip("case", () => {});'].join('.');
test('new suppressions and disabled tests fail without exposing source', () => {
  const result = inspectDiff(patch('apps/web/tests/example.test.ts',`+${suppressed}\n+${disabled}`));
  assert.deepEqual(result.map(f=>f.rule),['silenced-checker','test-disabled']);
  assert(result.every(f=>!Object.hasOwn(f,'text')));
});
test('assertion replacement is reviewable; exact movement is not a weakening', () => {
  const name='apps/backend/tests/example.test.mjs';
  assert.equal(inspectDiff(patch(name,'-assert.equal(value, 2);\n+assert.equal(value, 1);'))[0].rule,'assertion-changed');
  assert.deepEqual(inspectDiff(patch(name,'-assert.equal(value, 2);\n+  assert.equal(value, 2);')),[]);
});
test('deleted tests, stubs and empty catches are findings; prose is not code', () => {
  const deleted = 'diff --git a/a.test.ts b/a.test.ts\n--- a/a.test.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-old';
  assert.equal(inspectDiff(deleted)[0].rule,'test-deleted');
  const stub = ['throw new Error("Not', ' implemented");'].join('');
  assert.equal(inspectDiff(patch('src/a.ts','+'+stub))[0].rule,'unfinished-work');
  assert.equal(inspectDiff(patch('src/a.ts','+'+['catch {','}'].join('')))[0].rule,'unfinished-work');
  assert.deepEqual(inspectDiff(patch('CONSTRAINTS.md','+'+suppressed)),[]);
});
test('real git input includes staged, unstaged, untracked files from a subdirectory', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quality-fixture-'));
  const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe',encoding:'utf8'}).trim();
  try {
    git('init','-q'); git('config','user.name','Quality fixture');git('config','user.email','fixture@example.invalid');
    fs.writeFileSync(path.join(dir,'a.ts'),'export const a=1;\n');git('add','.');git('commit','-qm','fixture');
    const base=git('rev-parse','HEAD');
    fs.writeFileSync(path.join(dir,'a.ts'),suppressed+'\n');git('add','a.ts');
    fs.appendFileSync(path.join(dir,'a.ts'),suppressed+'\n');
    fs.mkdirSync(path.join(dir,'nested'));fs.writeFileSync(path.join(dir,'new.test.ts'),disabled+'\n');
    const findings=inspectDiff(collectDiff(base,path.join(dir,'nested')));
    assert.equal(findings.filter(f=>f.rule==='silenced-checker').length,2);
    assert.equal(findings.filter(f=>f.rule==='test-disabled').length,1);
    assert.throws(()=>collectDiff('missing-ref',dir));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
const proof=()=>({pr:{number:1,head:{sha:'head'},base:{sha:'base'}},currentTree:'tree',
  binding:{kind:'quality-v1',pr:1,head:'head',base:'base',tree:'tree',run_id:7,attempt:1},
  run:{id:7,run_attempt:2,head_sha:'head',event:'pull_request',path:'.github/workflows/ci-full.yml',status:'completed',conclusion:'success'},
  jobs:[{name:'quality',run_id:7,run_attempt:2,head_sha:'head',status:'completed',conclusion:'success',steps:qualitySteps.map(name=>({name,conclusion:'success'}))}]});
test('quality proof accepts retained success but rejects stale source or skipped scan', () => {
  validateQuality(proof());
  for(const field of ['head','base','tree','run_id']) {
    const value=proof(); value.binding[field]='wrong';assert.throws(()=>validateQuality(value));
  }
  const value=proof(); value.jobs[0].steps[2].conclusion='skipped';assert.throws(()=>validateQuality(value));
  const absent=proof(); absent.jobs=[];assert.throws(()=>validateQuality(absent));
});
test('quality Turbo task has no dependency fanout and cannot use cached Git evidence', () => {
  const turbo=JSON.parse(fs.readFileSync(new URL('../../../turbo.json',import.meta.url)));
  assert.equal(turbo.tasks.quality.cache,false);
  assert.deepEqual(turbo.tasks.quality.dependsOn??[],[]);
  assert(turbo.tasks.quality.env.includes('QUALITY_BASE'));
});

test('Node callback skips and conditional test disabling are detected', () => {
  for(const [receiver,method] of [['t','skip'],['context','todo'],['test','skipIf']]) {
    const row='+'+receiver+'.'+method+'("reason");';
    assert.equal(inspectDiff(patch('tests/example.test.mjs',row))[0].rule,'test-disabled');
  }
});
test('exception is specific, time bounded, and never hides another finding', () => {
  const findings=inspectDiff(patch('tests/example.test.ts','+'+suppressed));
  const entry={rule:findings[0].rule,path:findings[0].file,fingerprint:findings[0].fingerprint,owner:'owner',reason:'Reviewed precise synthetic exception for this test.',created:'2026-11-01',expires:'2026-11-30'};
  assert.deepEqual(applyExceptions(findings,[entry],new Date('2026-11-02')),[]);
  assert.equal(applyExceptions([...findings,{...findings[0],file:'other.ts'}],[entry],new Date('2026-11-02')).length,1);
  for(const edit of [{expires:'2026-10-30'},{expires:'2027-11-01'},{owner:''},{fingerprint:'invalid'}]) {
    assert.throws(()=>applyExceptions(findings,[{...entry,...edit}],new Date('2026-11-02')));
  }
});
