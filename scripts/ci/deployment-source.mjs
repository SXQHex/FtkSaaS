import {validateJobs} from './shards.mjs';
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

export async function resolveDeployment(github,context,core) {
 const id=context.payload.workflow_run?.id??Number(context.payload.inputs?.acceptance_run_id);
 if(!Number.isSafeInteger(id)||id<=0)throw Error('Exact main acceptance run ID required');
 const repo=context.repo;
 const run=(await github.rest.actions.getWorkflowRun({...repo,run_id:id})).data;
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{...repo,run_id:id,filter:'latest',per_page:100});
 const currentMain=(await github.rest.git.getRef({...repo,ref:'heads/main'})).data.object.sha;
 const proof=deploymentSource({run,jobs,currentMain,repository:repo.owner+'/'+repo.repo,attempt:context.payload.workflow_run?.run_attempt});
 core.setOutput('deploy',String(proof.deploy));
 if(proof.deploy){core.setOutput('sha',proof.sha);core.setOutput('acceptance_run_id',String(id));}
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
    fs.mkdirSync('.ci',{recursive:true});fs.writeFileSync('.ci/previous-development-delivery.json',JSON.stringify(receipt));return;
   }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
}
