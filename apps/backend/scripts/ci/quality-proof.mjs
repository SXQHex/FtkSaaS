import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export const qualitySteps = ['Verify quality source', 'Quality floor', 'Secret scan', 'Upload quality binding'];
export function validateQuality({binding, pr, run, jobs, currentTree}) {
  assert.equal(run.event, 'pull_request');
  assert.equal(run.path, '.github/workflows/ci-full.yml');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert.equal(run.head_sha, pr.head.sha);
  assert.equal(binding.kind, 'quality-v1');
  assert.equal(binding.head, pr.head.sha); assert.equal(binding.base, pr.base.sha);
  assert.equal(binding.pr, pr.number); assert.equal(binding.tree, currentTree, 'Quality tree mismatch');
  assert.equal(binding.run_id, run.id);
  assert(Number.isSafeInteger(binding.attempt) && binding.attempt > 0 && binding.attempt <= run.run_attempt);
  const matches = jobs.filter(j => j.name === 'quality'); assert.equal(matches.length, 1);
  const job = matches[0];
  assert.equal(job.run_id, run.id); assert.equal(job.run_attempt, run.run_attempt);
  assert.equal(job.head_sha, run.head_sha); assert.equal(job.status, 'completed');
  assert.equal(job.conclusion, 'success');
  for(const name of qualitySteps) assert(job.steps.some(s => s.name === name && s.conclusion === 'success'), name);
}
if(import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const git = (...args) => execFileSync('git', args, {encoding:'utf8'}).trim();
  const pr = event.pull_request, merge = git('rev-parse','HEAD');
  assert.match(pr.base.sha,/^[a-f0-9]{40}$/); assert.match(pr.head.sha,/^[a-f0-9]{40}$/);
  assert.equal(merge, process.env.GITHUB_SHA);
  assert.deepEqual(git('show','-s','--format=%P',merge).split(' '),[pr.base.sha,pr.head.sha]);
  const binding = {kind:'quality-v1', pr:pr.number, head:pr.head.sha, base:pr.base.sha, merge,
    tree:git('rev-parse','HEAD^{tree}'),run_id:Number(process.env.GITHUB_RUN_ID),attempt:Number(process.env.GITHUB_RUN_ATTEMPT)};
  fs.mkdirSync('.artifacts/ci/quality',{recursive:true});
  fs.writeFileSync('.artifacts/ci/quality/binding.json',JSON.stringify(binding));
}
