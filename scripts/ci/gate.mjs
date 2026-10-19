import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
export const gateContext='ftksaas/merge-clean';
export function validateBinding({binding,pr,run,jobs,tested,currentTree,workflowMatches}) {
 if(!workflowMatches)throw Error('Candidate workflow differs from trusted base; reviewed policy installation required');
 if(run.event!=='pull_request'||run.path!=='.github/workflows/ci-full.yml'||run.conclusion!=='success'||run.status!=='completed')throw Error('No successful candidate workflow');
 if(binding.run_id!==run.id||binding.attempt!==run.run_attempt||binding.pr!==pr.number||binding.head!==pr.head.sha||binding.base!==pr.base.sha||run.head_sha!==binding.head)throw Error('Stale head/base/attempt');
 if(binding.merge!==tested.sha||binding.tree!==tested.tree.sha||binding.tree!==currentTree||tested.parents.length!==2||tested.parents[0].sha!==binding.base||tested.parents[1].sha!==binding.head)throw Error('Tested merge parents/tree mismatch');
 const job=jobs.find(j=>j.name==='full-clean');
 if(!job||job.conclusion!=='success'||!job.steps.some(s=>s.name==='Full clean acceptance'&&s.conclusion==='success')||!job.steps.some(s=>s.name==='Verify tested merge'&&s.conclusion==='success'))throw Error('Full clean job/steps did not succeed');
 return true;
}
async function receipt(github,repo,run){
 const artifacts=await github.paginate(github.rest.actions.listWorkflowRunArtifacts,{...repo,run_id:run.id,per_page:100});
 const a=artifacts.find(a=>a.name==='candidate-binding-'+run.run_attempt&&!a.expired);if(!a)throw Error('Missing source binding');
 const zip=await github.rest.actions.downloadArtifact({...repo,artifact_id:a.id,archive_format:'zip'});const dir=mkdtempSync(join(tmpdir(),'ftk-binding-'));
 try{const file=join(dir,'receipt.zip');writeFileSync(file,Buffer.from(zip.data));return JSON.parse(execFileSync('unzip',['-p',file,'binding.json'],{encoding:'utf8',maxBuffer:16000}));}finally{rmSync(dir,{recursive:true,force:true});}
}
export async function checkPr(github,context,number){
 const repo=context.repo;const pr=(await github.rest.pulls.get({...repo,pull_number:number})).data;if(pr.state!=='open')return;
 let state='failure',description='Explicit full clean required for current head/base',target_url;
 try{
  const current=(await github.rest.git.getRef({...repo,ref:'pull/'+number+'/merge'})).data.object.sha;
  const currentCommit=(await github.rest.git.getCommit({...repo,commit_sha:current})).data;
  const runs=await github.paginate(github.rest.actions.listWorkflowRuns,{...repo,workflow_id:'ci-full.yml',head_sha:pr.head.sha,event:'pull_request',per_page:100});
  for(const run of runs){
   const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{...repo,run_id:run.id,filter:'latest',per_page:100});
   if(!jobs.some(j=>j.name==='full-clean'&&j.conclusion!=='skipped'))continue;
   const binding=await receipt(github,repo,run);
   const tested=(await github.rest.git.getCommit({...repo,commit_sha:binding.merge})).data;
   const path='.github/workflows/ci-full.yml';
   const base=(await github.rest.repos.getContent({...repo,path,ref:pr.base.sha})).data;
   const head=(await github.rest.repos.getContent({...repo,path,ref:pr.head.sha})).data;
   validateBinding({binding,pr,run,jobs,tested,currentTree:currentCommit.tree.sha,workflowMatches:base.sha===head.sha});
   const live=(await github.rest.pulls.get({...repo,pull_number:number})).data;
   if(live.head.sha!==pr.head.sha||live.base.sha!==pr.base.sha)throw Error('Head/base moved during verification');
   state='success';description='Verified head/base/merge tree and executed full clean';target_url=run.html_url;break;
  }
 }catch(e){description=String(e.message).slice(0,140);}
 await github.rest.repos.createCommitStatus({...repo,sha:pr.head.sha,state,context:gateContext,description,...(target_url?{target_url}:{})});
 return {pr:number,head:pr.head.sha,base:pr.base.sha,state,description};
}
export async function main(github,context,core){
 let numbers=[];
 if(context.eventName==='pull_request_target')numbers=[context.payload.pull_request.number];
 else if(context.eventName==='workflow_run')numbers=(context.payload.workflow_run.pull_requests??[]).map(p=>p.number);
 else numbers=(await github.paginate(github.rest.pulls.list,{...context.repo,state:'open',base:'main',per_page:100})).map(p=>p.number);
 if(context.eventName==='workflow_run'&&!numbers.length)numbers=(await github.paginate(github.rest.pulls.list,{...context.repo,state:'open',base:'main',per_page:100})).map(p=>p.number);
 for(const number of numbers){const result=await checkPr(github,context,number);if(result)await core.summary.addRaw(JSON.stringify(result)+'\n').write();}
}

export async function verifyMerged(github,context,core){
 const repo=context.repo,sha=context.sha;
 const prs=await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit,{...repo,commit_sha:sha,per_page:100});
 const pr=prs.find(p=>p.merged_at&&p.merge_commit_sha===sha);if(!pr)throw Error('Main commit must be a PR merge with candidate proof');
 const merged=(await github.rest.git.getCommit({...repo,commit_sha:sha})).data;
 const runs=await github.paginate(github.rest.actions.listWorkflowRuns,{...repo,workflow_id:'ci-full.yml',head_sha:pr.head.sha,event:'pull_request',per_page:100});
 let accepted;
 for(const run of runs){
  const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{...repo,run_id:run.id,filter:'latest',per_page:100});
  if(!jobs.some(j=>j.name==='full-clean'&&j.conclusion!=='skipped'))continue;
  const binding=await receipt(github,repo,run),tested=(await github.rest.git.getCommit({...repo,commit_sha:binding.merge})).data;
  // Final main tree must exactly equal the tested merge tree; reviewed initial workflow installation is allowed here.
  const path='.github/workflows/ci-full.yml';
  const trusted=(await github.rest.repos.getContent({...repo,path,ref:sha})).data;
  const candidate=(await github.rest.repos.getContent({...repo,path,ref:pr.head.sha})).data;
  validateBinding({binding,pr,run,jobs,tested,currentTree:merged.tree.sha,workflowMatches:trusted.sha===candidate.sha});accepted=binding;break;
 }
 if(!accepted)throw Error('No source-bound full clean evidence for merged tree');
 if(merged.parents.length!==2||merged.parents[0].sha!==accepted.base||merged.parents[1].sha!==accepted.head)throw Error('Actual merged parents differ from tested parents; no squash/rebase without a new proof');
 await core.summary.addRaw('Merged source verified: '+JSON.stringify(accepted)+'\n').write();
}
