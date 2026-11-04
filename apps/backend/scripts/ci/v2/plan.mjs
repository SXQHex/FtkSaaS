import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {repositoryRoot} from '../../paths.mjs';
import {parseNameStatus,selectImpact} from './scope.mjs';

export function createPlan({cwd=repositoryRoot,base,head,mode='auto'}){
 if(![base,head].every(sha=>typeof sha==='string'&&/^[a-f0-9]{40}$/.test(sha)))throw Error('CI_V2_EXACT_RANGE_REQUIRED');
 const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
 if(git('rev-parse','HEAD').trim()!==head||git('status','--porcelain').trim())throw Error('CI_V2_CLEAN_SOURCE_REQUIRED');
 git('merge-base','--is-ancestor',base,head);
 const paths=parseNameStatus(git('diff','--name-status','-z','--find-renames',base,head,'--'));
 return {format:1,kind:'diagnostic-plan',acceptance:false,backend_execution:'not-implemented',
  source:{base,head,tree:git('rev-parse','HEAD^{tree}').trim()},mode,paths,impact:selectImpact(paths,mode)};
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const plan=createPlan({base:process.env.CI_V2_BASE_SHA,head:process.env.GITHUB_SHA??process.env.CI_V2_HEAD_SHA,mode:process.env.CI_V2_MODE??'auto'});
 const output=path.join(repositoryRoot,'.artifacts/ci-v2-plan');fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'plan.json'),JSON.stringify(plan,null,2)+'\n');
 const {baseline,common,frontend,backend,deploy,backend_matrix}=plan.impact;
 const summary=['## CI v2 diagnostic plan','',`Source: ${plan.source.head}`,
  `Baseline controls: ${baseline}; common: ${common}; frontend: ${frontend}; backend: ${backend}.`,
  `Backend matrix: ${backend_matrix.length}; Vercel impact: ${deploy.vercel}; Supabase impact: ${deploy.supabase}.`,
  'Planning only: twenty backend shards are not executed or accepted by this job. No deployment authorization.',''].join('\n');
 fs.writeFileSync(path.join(output,'summary.md'),summary);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 console.log(summary);
}
