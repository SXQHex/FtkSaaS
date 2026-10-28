import {validateJobs,coverageHash,roleName} from './shards.mjs';
import {assertReady,assertParents,policyMatches,resolveMerged,remoteSourceScope} from './source.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
export const gateContext='ftksaas/merge-clean';
export function validateBinding({binding,pr,run,jobs,tested,currentTree,workflowMatches}) {
 if(pr.state==='open')assertReady(pr);
 if(!workflowMatches)throw Error('Candidate workflow differs from trusted base; reviewed policy installation required');
 if(run.event!=='pull_request'||run.path!=='.github/workflows/ci-full.yml'||run.conclusion!=='success'||run.status!=='completed')throw Error('No successful candidate workflow');
 if(binding.run_id!==run.id||binding.attempt!==run.run_attempt||binding.pr!==pr.number||binding.head!==pr.head.sha||binding.base!==pr.base.sha||run.head_sha!==binding.head)throw Error('Stale head/base/attempt');
 if(binding.merge!==tested.sha||binding.tree!==tested.tree.sha||binding.tree!==currentTree||tested.parents.length!==2||tested.parents[0].sha!==binding.base||tested.parents[1].sha!==binding.head)throw Error('Tested merge parents/tree mismatch');
 if(binding.kind!=='full'||binding.profile!=='four-isolated-v1'||binding.coverage!==coverageHash())throw Error('Unrecognized/incomplete full coverage');
 validateJobs(jobs,run,{benchmark:binding.benchmark,collector:true});
 return true;
}
export async function receipt(github,repo,run,kind="full"){
 const artifacts=await github.paginate(github.rest.actions.listWorkflowRunArtifacts,{...repo,run_id:run.id,per_page:100});
 const matches=artifacts.filter(a=>a.name===(kind==='documentation'?'document-binding-':'candidate-binding-')+run.run_attempt&&!a.expired);const a=matches[0];if(matches.length!==1)throw Error('Missing source binding');
 const zip=await github.rest.actions.downloadArtifact({...repo,artifact_id:a.id,archive_format:'zip'});const dir=mkdtempSync(join(tmpdir(),'ftk-binding-'));
 try{const file=join(dir,'receipt.zip');writeFileSync(file,Buffer.from(zip.data));return JSON.parse(execFileSync('unzip',['-p',file,'binding.json'],{encoding:'utf8',maxBuffer:16000}));}finally{rmSync(dir,{recursive:true,force:true});}
}
// A cancelled, stale or incomplete run cannot shadow a valid receipt for the
// same live source. Each attempt is validated independently; proofs never mix.
export async function findCandidateProof(github,repo,pr,kind,currentTree,policyBase){
 const runs=await github.paginate(github.rest.actions.listWorkflowRuns,{...repo,workflow_id:'ci-full.yml',head_sha:pr.head.sha,event:'pull_request',per_page:100});
 const workflowMatches=await policyMatches(github,repo,policyBase,pr.head.sha);
 if(!workflowMatches)throw Error('Candidate policy differs from trusted base; reviewed policy installation required');
 let reason='No successful source-bound '+kind+' acceptance for current head/base/tree';
 for(const run of runs){
  if(run.status!=='completed'||run.conclusion!=='success')continue;
  try{
   const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{...repo,run_id:run.id,filter:'latest',per_page:100});
   if(!jobs.some(j=>roleName(j)===(kind==='documentation'?'documentation':'full-clean')&&j.conclusion==='success'))continue;
   const binding=await receipt(github,repo,run,kind);
   const tested=(await github.rest.git.getCommit({...repo,commit_sha:binding.merge})).data;
   (kind==='documentation'?validateDocumentBinding:validateBinding)({binding,pr,run,jobs,tested,currentTree,workflowMatches});
   return {binding,run};
  }catch(e){reason=String(e.message);}
 }
 throw Error(reason);
}
export async function checkPr(github,context,number){
 const repo=context.repo;const pr=(await github.rest.pulls.get({...repo,pull_number:number})).data;if(pr.state!=='open')return;
 let state='failure',description='Waiting for automatic acceptance of current head/base',target_url;
 try{
  const current=(await github.rest.git.getRef({...repo,ref:'pull/'+number+'/merge'})).data.object.sha;
  const currentCommit=(await github.rest.git.getCommit({...repo,commit_sha:current})).data;
  assertReady(pr);
  if(pr.base.ref!=='main')throw Error('Candidate must target main');
  assertParents(currentCommit,pr.base.sha,pr.head.sha);
  const scope=await remoteSourceScope(github,repo,pr.base.sha,pr.head.sha);
  const kind=scope.kind;
  if(kind==='frontend'){
   if(!await policyMatches(github,repo,pr.base.sha,pr.head.sha))throw Error('Workflow policy installation requires review and explicit authorization');
   const live=(await github.rest.pulls.get({...repo,pull_number:number})).data;assertReady(live);
   if(live.head.sha!==pr.head.sha||live.base.sha!==pr.base.sha)throw Error('Head/base moved during verification');
   state='success';description='Backend scope unchanged; no backend tests accepted; frontend checks are independent';
  }else{
  const {binding,run}=await findCandidateProof(github,repo,pr,kind,currentCommit.tree.sha,pr.base.sha);
  const live=(await github.rest.pulls.get({...repo,pull_number:number})).data;
  assertReady(live);
  if(live.head.sha!==pr.head.sha||live.base.sha!==pr.base.sha)throw Error('Head/base moved during verification');
  state='success';description=kind==='documentation'?'Verified source-bound documentation acceptance (no full clean)':'Verified head/base/merge tree and executed full clean';target_url=run.html_url;
  }
 }catch(e){description=String(e.message).slice(0,140);}
 await github.rest.repos.createCommitStatus({...repo,sha:pr.head.sha,state,context:gateContext,description,...(target_url?{target_url}:{})});
 return {pr:number,head:pr.head.sha,base:pr.base.sha,state,description};
}
export async function main(github,context,core){
 let numbers=[];
 if(context.eventName==='pull_request_target')numbers=[context.payload.pull_request.number];
 else if(context.eventName==='workflow_run'){
  const run=context.payload.workflow_run;
  if(run.path!=='.github/workflows/ci-full.yml'||run.event!=='pull_request')return;
  numbers=(run.pull_requests??[]).map(p=>p.number);
  if(!numbers.length){const prs=await github.paginate(github.rest.pulls.list,{...context.repo,state:'open',base:'main',per_page:100});numbers=prs.filter(p=>p.head.sha===run.head_sha).map(p=>p.number);}
 }else numbers=(await github.paginate(github.rest.pulls.list,{...context.repo,state:'open',base:'main',per_page:100})).map(p=>p.number);
 for(const number of numbers){const result=await checkPr(github,context,number);if(result)await core.summary.addRaw(JSON.stringify(result)+'\n').write();}
}

export function validateDocumentBinding(v){
 const {binding,pr,run,jobs,tested,currentTree,workflowMatches}=v;
 if(pr.state==='open')assertReady(pr);
 if(!workflowMatches)throw Error('Documentation policy differs from trusted base');
 if(binding.kind!=='documentation'||run.event!=='pull_request'||run.path!=='.github/workflows/ci-full.yml'||run.conclusion!=='success'||run.status!=='completed')throw Error('No successful documentation acceptance');
 if(binding.run_id!==run.id||binding.attempt!==run.run_attempt||binding.pr!==pr.number||binding.head!==pr.head.sha||binding.base!==pr.base.sha||run.head_sha!==binding.head)throw Error('Stale documentation head/base/attempt');
 assertParents(tested,binding.base,binding.head);
 if(binding.merge!==tested.sha||binding.tree!==tested.tree.sha||binding.tree!==currentTree)throw Error('Documentation merge tree mismatch');
 const matches=jobs.filter(j=>j.name==='documentation');
 if(matches.length!==1)throw Error('Missing or duplicate documentation job');
 const job=matches[0];
 if(!job||job.conclusion!=='success'||job.status!=='completed'||job.run_id!==run.id||job.run_attempt!==run.run_attempt||job.head_sha!==run.head_sha||!['Verify tested merge','Documentation acceptance'].every(n=>job.steps.some(s=>s.name===n&&s.conclusion==='success')))throw Error('Documentation job/steps did not succeed');
 return true;
}
export async function verifyMerged(github,context,core){
 const repo=context.repo,sha=context.sha;
 const {pr,merged}=await resolveMerged(github,context);
 const scope=await remoteSourceScope(github,repo,pr.base.sha,pr.head.sha);
 const kind=scope.kind;
 if(kind==='frontend'){
  core.setOutput('kind','frontend');
  await core.summary.addRaw('Actual merge parents verified; backend scope unchanged. No backend test or frontend acceptance claimed.\n').write();
  return {kind:'frontend',actual:sha};
 }
 // Installed policy must be identical to the candidate; original base changes
 // still need the separate reviewed, source-specific installation process.
 const {binding:accepted}=await findCandidateProof(github,repo,pr,kind,merged.tree.sha,sha);
 assertParents(merged,accepted.base,accepted.head);
 await core.summary.addRaw('Merged source verified: '+JSON.stringify(accepted)+'\n').write();
 core.setOutput('kind',kind);core.setOutput('binding',JSON.stringify({...accepted,actual:sha,candidate_run_id:accepted.run_id,candidate_attempt:accepted.attempt,run_id:context.runId,attempt:Number(process.env.GITHUB_RUN_ATTEMPT),benchmark:false}));
 return accepted;
}
