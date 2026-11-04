import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
// Trusted production selector: this file deliberately lives outside the V2 area.
const workflows=new Set(['.github/workflows/ci-v2-pilot.yml','.github/workflows/ci-v2-backend.yml','.github/workflows/ci-v2-frontend.yml','.github/workflows/ci-v2-scope.yml']);
export function isV2DevelopmentPath(path){
 return typeof path==='string'&&!path.includes('\\')&&!path.split('/').some(p=>!p||p==='.'||p==='..')&&(
  workflows.has(path)||/^apps\/backend\/scripts\/ci\/v2\/[a-z0-9-]+\.mjs$/.test(path)
  ||/^apps\/backend\/tests\/v2\/(?:backend\/)?[a-z0-9-]+(?:\.test)?\.(?:mjs|json)$/.test(path));
}
export function isV2DevelopmentOnly(changes){
 return Array.isArray(changes)&&changes.length>0&&changes.every(c=>/^[ADMT]$/.test(c.status)&&isV2DevelopmentPath(c.path));
}
export const v2DevelopmentSteps=['Verify tested merge','V2 development checks','Upload V2 development binding'];
export function validateV2Development({binding,pr,run,jobs,tested,currentTree,workflowMatches}){
 if(!workflowMatches)throw Error('V2 policy installation requires review and explicit authorization');
 if(run.path!=='.github/workflows/ci-full.yml'||run.event!=='pull_request'||run.status!=='completed'||run.conclusion!=='success')throw Error('Missing V2 development run');
 if(binding.kind!=='v2-development'||binding.run_id!==run.id||binding.attempt!==run.run_attempt||binding.pr!==pr.number||binding.head!==pr.head.sha||binding.base!==pr.base.sha||run.head_sha!==binding.head)throw Error('Stale V2 source/run/attempt');
 if(!Number.isSafeInteger(binding.source_attempt)||binding.source_attempt<1||binding.source_attempt>binding.attempt)throw Error('Invalid V2 source attempt');
 if(binding.merge!==tested.sha||binding.tree!==tested.tree.sha||binding.tree!==currentTree||tested.parents.length!==2||tested.parents[0].sha!==binding.base||tested.parents[1].sha!==binding.head)throw Error('V2 merge parents/tree mismatch');
 const matches=jobs.filter(j=>j.name==='v2-development'),job=matches[0];
 if(matches.length!==1||job.status!=='completed'||job.conclusion!=='success'||job.run_id!==run.id||job.run_attempt!==run.run_attempt||job.head_sha!==run.head_sha||!v2DevelopmentSteps.every(name=>job.steps?.some(s=>s.name===name&&s.conclusion==='success')))throw Error('V2 checks or upload incomplete');
 return true;
}

// Reviewed production code must not add a dependency on the experimental tree.
// This checks literal paths; computed dependencies remain a review obligation.
export function assertV2Isolation(files,read){
 for(const file of files){
  if(isV2DevelopmentPath(file)||file==='apps/backend/scripts/ci/v2-development.mjs'||file==='apps/backend/tests/ci-v2-development-unit.mjs'||file.startsWith('apps/web1/')||file.startsWith('docs/')||file.includes('/docs/'))continue;
  if(!/\.(?:mjs|cjs|js|jsx|ts|tsx|json|ya?ml|sql|sh)$/.test(file))continue;
  let text=read(file);
  if(file==='.github/workflows/ci-full.yml')text=text.replace(/\n  v2-development:\n[\s\S]*?(?=\n  [a-z][a-z-]*:\n|$)/,'');
  if(/(?:scripts\/ci\/v2\/|tests\/v2\/|['"`]\.{1,2}\/(?:[^'"`\n]*\/)?v2\/)/.test(text))throw Error('PRODUCTION_DEPENDS_ON_V2 '+file);
 }
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
 const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 assertV2Isolation(files,file=>fs.readFileSync(path.join(root,file),'utf8'));
}
