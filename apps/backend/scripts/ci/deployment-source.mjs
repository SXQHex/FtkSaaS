import {ciFile} from '../paths.mjs';
import {validateJobs} from './shards.mjs';
import {remoteDocumentScope} from './source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export function deploymentSource({run,jobs,currentMain,repository,attempt}) {
 if(run.path!=='.github/workflows/backend.yml'||run.event!=='push'||run.head_branch!=='main'||run.repository?.full_name!==repository||run.head_repository?.full_name!==repository)throw Error('Untrusted main acceptance source');
 if(run.status!=='completed'||run.conclusion!=='success'||(attempt&&run.run_attempt!==attempt))throw Error('Main acceptance failed or attempt changed');
 if(!/^[a-f0-9]{40}$/.test(run.head_sha))throw Error('Invalid accepted SHA');
 if(run.head_sha!==currentMain)return {deploy:false,reason:'Superseded main source'};
 const source=jobs.filter(j=>j.name==='source');
 if(source.length!==1||source[0].status!=='completed'||source[0].conclusion!=='success'||source[0].run_id!==run.id||source[0].run_attempt!==run.run_attempt||source[0].head_sha!==run.head_sha)throw Error('Missing main source verification');
 const docs=jobs.filter(j=>j.name==='documentation'&&j.conclusion==='success'&&j.status==='completed'&&j.run_id===run.id&&j.run_attempt===run.run_attempt&&j.head_sha===run.head_sha&&j.steps?.some(s=>s.name==='Documentation main acceptance (no full clean)'&&s.conclusion==='success'));
 if(docs.length===1)return {deploy:false,reason:'Documentation acceptance; backend unchanged'};
 validateJobs(jobs,run,{collector:true});
 return {deploy:true,sha:run.head_sha,run_id:run.id,attempt:run.run_attempt};
}

async function fullProof(github,repo,run,jobs,currentMain,attempt){
 const proof=deploymentSource({run,jobs,currentMain:run.head_sha,repository:repo.owner+'/'+repo.repo,attempt});
 if(!proof.deploy)return null;
 if(run.head_sha!==currentMain){
  const comparison=(await github.rest.repos.compareCommitsWithBasehead({...repo,basehead:run.head_sha+'...'+currentMain})).data;
  if(comparison.status!=='ahead'||!(await remoteDocumentScope(github,repo,run.head_sha,currentMain)).safe)return null;
 }
 return {...proof,expected_main:currentMain};
}
export async function resolveAcceptedSource(github,repo,run,jobs,currentMain,attempt){
 const initial=deploymentSource({run,jobs,currentMain:run.head_sha,repository:repo.owner+'/'+repo.repo,attempt});
 if(initial.deploy)return await fullProof(github,repo,run,jobs,currentMain,attempt)??{deploy:false,reason:'Superseded runtime source'};
 if(run.head_sha!==currentMain)return {deploy:false,reason:'Superseded documentation source'};
 // A docs-only main may have overtaken an accepted runtime before CD ran.
 // Its own documentation proof never substitutes for the full runtime proof.
 const runs=(await github.rest.actions.listWorkflowRuns({...repo,workflow_id:'backend.yml',branch:'main',event:'push',status:'success',per_page:100})).data.workflow_runs;
 for(const candidate of runs){
  if(candidate.id===run.id)continue;
  const current=(await github.rest.actions.getWorkflowRun({...repo,run_id:candidate.id})).data;
  if(current.status!=='completed'||current.conclusion!=='success')continue;
  const candidateJobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{...repo,run_id:current.id,filter:'latest',per_page:100});
  const proof=await fullProof(github,repo,current,candidateJobs,currentMain);
  if(proof)return {...proof,documentation_run_id:run.id};
 }
 return {deploy:false,reason:'Awaiting full runtime acceptance; its completion will trigger delivery'};
}
export async function revalidateDeployment(github,repo,expected){
 const run=(await github.rest.actions.getWorkflowRun({...repo,run_id:expected.run_id})).data;
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{...repo,run_id:run.id,filter:'latest',per_page:100});
 const currentMain=(await github.rest.git.getRef({...repo,ref:'heads/main'})).data.object.sha;
 if(currentMain!==expected.expected_main||run.head_sha!==expected.sha||run.run_attempt!==expected.attempt)throw Error('Accepted source/main/attempt changed before delivery');
 const proof=await fullProof(github,repo,run,jobs,currentMain,expected.attempt);
 if(!proof)throw Error('Runtime acceptance or documentation equivalence no longer valid');
 return proof;
}
export async function resolveDeployment(github,context,core) {
 const id=context.payload.workflow_run?.id??Number(context.payload.inputs?.acceptance_run_id);
 if(!Number.isSafeInteger(id)||id<=0)throw Error('Exact main acceptance run ID required');
 const repo=context.repo;
 const run=(await github.rest.actions.getWorkflowRun({...repo,run_id:id})).data;
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{...repo,run_id:id,filter:'latest',per_page:100});
 const currentMain=(await github.rest.git.getRef({...repo,ref:'heads/main'})).data.object.sha;
 let proof=await resolveAcceptedSource(github,repo,run,jobs,currentMain,context.payload.workflow_run?.run_attempt);
 if(proof.documentation_run_id){
  const previous=await previousReceipt(github,context);
  if(previous?.source===proof.sha)proof={deploy:false,reason:'Documentation-only main; accepted runtime already delivered'};
 }
 core.setOutput('deploy',String(proof.deploy));
 if(proof.deploy){core.setOutput('sha',proof.sha);core.setOutput('expected_main',proof.expected_main);core.setOutput('acceptance_run_id',String(proof.run_id));core.setOutput('acceptance_attempt',String(proof.attempt));}
 await core.summary.addRaw(JSON.stringify(proof)+'\n').write();
}

export async function previousReceipt(github,context){
 const runs=(await github.rest.actions.listWorkflowRuns({...context.repo,workflow_id:'cd-development.yml',status:'success',branch:'main',per_page:20})).data.workflow_runs;
 for(const run of runs){
  if(run.id===context.runId||run.path!=='.github/workflows/cd-development.yml')continue;
  const artifacts=await github.paginate(github.rest.actions.listWorkflowRunArtifacts,{...context.repo,run_id:run.id,per_page:100});
  const a=artifacts.find(a=>!a.expired&&a.name===`development-delivery-${run.id}-${run.run_attempt}`);if(!a)continue;
  const zip=await github.rest.actions.downloadArtifact({...context.repo,artifact_id:a.id,archive_format:'zip'});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ftk-cd-receipt-'));
  try{
   const file=path.join(dir,'receipt.zip');fs.writeFileSync(file,Buffer.from(zip.data));
   const receipt=JSON.parse(execFileSync('unzip',['-p',file,'development-delivery.json'],{encoding:'utf8',maxBuffer:100000}));
   if(receipt.success===true&&receipt.project==='gwyprhenabtpkbojephw'){
    fs.mkdirSync(ciFile(),{recursive:true});fs.writeFileSync(ciFile('previous-development-delivery.json'),JSON.stringify(receipt));return receipt;
   }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
}
