// Diagnostic full clean. This module never emits candidate/main acceptance proof.
import fs from 'node:fs';
import {ciFile} from '../paths.mjs';
import {loadCandidateInventory} from './candidate-inventory.mjs';
import {freezeSchedule,latestReference,artifactJson,validateSchedule,scheduledPlan} from './duration-reference.mjs';
import {acceptanceProfile,coverageHash,validateJobs} from './shards.mjs';
import {measurements} from './collect.mjs';
const fullSha=s=>/^[a-f0-9]{40}$/.test(s??'');
const attemptNow=()=>Number(process.env.GITHUB_RUN_ATTEMPT);
const write=(name,value)=>{fs.mkdirSync(ciFile(),{recursive:true});fs.writeFileSync(ciFile(name),JSON.stringify(value,null,2));};

export function manualRequest(context,attempt=attemptNow()){
 const tested=context.payload?.inputs?.tested_sha;
 if(context.eventName!=='workflow_dispatch'||context.ref!=='refs/heads/main'||context.repo?.owner+'/'+context.repo?.repo!=='SXQHex/FtkSaaS'||!fullSha(context.sha)||!fullSha(tested)||!Number.isSafeInteger(context.runId)||context.runId<1||!Number.isSafeInteger(attempt)||attempt<1)throw Error('Manual full requires main dispatch and exact tested SHA');
 return {kind:'manual-full',head:context.sha,tested_sha:tested,merge:tested,run_id:context.runId,attempt};
}
export function manualBinding(request,commit,candidate,reference){
 if(commit.sha!==request.tested_sha||!fullSha(commit.tree?.sha)||request.attempt!==1)throw Error('Manual tested commit mismatch');
 return {...request,tree:commit.tree.sha,profile:acceptanceProfile,coverage:coverageHash(acceptanceProfile,candidate),benchmark:false,schedule:freezeSchedule(candidate.inventory.units,reference)};
}
export function restoreManualBinding(original,request,candidate){
 for(const key of ['kind','head','tested_sha','merge','run_id'])if(original[key]!==request[key])throw Error('Frozen manual source changed');
 if(original.attempt!==1||original.tree!==candidate.tree||original.profile!==acceptanceProfile||original.coverage!==coverageHash(acceptanceProfile,candidate)||original.benchmark!==false)throw Error('Frozen manual inventory changed');
 validateSchedule(original.schedule,candidate.inventory.units);return original;
}
async function inventory(github,repo,tested){
 const commit=(await github.rest.git.getCommit({...repo,commit_sha:tested})).data;
 if(commit.sha!==tested||!fullSha(commit.tree?.sha))throw Error('Manual tested commit mismatch');
 return {commit,...await loadCandidateInventory(github,repo,commit.tree.sha),tree:commit.tree.sha};
}
export async function resolveManualFull(github,context,core){
 const request=manualRequest(context),candidate=await inventory(github,context.repo,request.tested_sha);
 let binding;
 if(request.attempt===1){
  const reference=await latestReference(github,context.repo,m=>core.warning(m));
  binding=manualBinding(request,candidate.commit,candidate,reference);
 }else{
  const rows=await github.paginate(github.rest.actions.listWorkflowRunArtifacts,{...context.repo,run_id:context.runId,per_page:100});
  const matches=rows.filter(a=>a.name==='manual-source'&&!a.expired);
  if(matches.length!==1)throw Error('Missing/duplicate frozen manual source');
  const original=await artifactJson(github,context.repo,matches[0],'manual-source.json');
  binding=restoreManualBinding(original,request,candidate);
 }
 write('manual-source.json',binding);
 core.setOutput('tested_sha',binding.tested_sha);core.setOutput('binding',JSON.stringify(binding));
 await core.summary.addRaw('Manual full clean (diagnostic only):\n```json\n'+JSON.stringify(binding,null,2)+'\n```\n').write();
}
export function validateManualRun(run,binding,attempt){
 if(binding.kind!=='manual-full'||run.id!==binding.run_id||run.head_sha!==binding.head||run.run_attempt!==attempt||run.event!=='workflow_dispatch'||run.path!=='.github/workflows/ci-full.yml'||run.head_branch!=='main')throw Error('Manual workflow/source/attempt mismatch');
 return true;
}
export function manualTestBalance(phases,coverage){
 if(phases.length!==12||new Set(phases.map(p=>p.shard)).size!==12||phases.some(p=>p.role!=='api'||!Number.isSafeInteger(p.shard)||p.shard<1||p.shard>12||p.coverage!==coverage||!Number.isFinite(p.tests_s)||p.tests_s<=0||!Number.isFinite(p.backend_setup_s)||p.backend_setup_s<0))throw Error('Incomplete/invalid manual phase measurements');
 const seconds=phases.map(p=>p.tests_s),ratio=Math.max(...seconds)/Math.min(...seconds);
 return {max_ratio:1.20,ratio,gap_s:Math.max(...seconds)-Math.min(...seconds),balanced:ratio<=1.20,mode:'advisory',basis:'tests only; excludes backend setup and runner queue'};
}
export async function collectManualFull(github,context,core,original){
 for(const name of ['manual-binding.json','manual-measurements.json'])fs.rmSync(ciFile(name),{force:true});
 const request=manualRequest(context),candidate=await inventory(github,context.repo,request.tested_sha);
 restoreManualBinding(original,request,candidate);
 const binding={...original,source_attempt:original.attempt,attempt:request.attempt};
 const readRun=async()=>{
  const run=(await github.rest.actions.getWorkflowRun({...context.repo,run_id:context.runId})).data;
  validateManualRun(run,binding,request.attempt);return run;
 };
 const run=await readRun();
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt,{...context.repo,run_id:context.runId,attempt_number:binding.attempt,per_page:100});
 validateJobs(jobs,run,{sourceChecks:true,profile:binding.profile});
 const artifacts=await github.paginate(github.rest.actions.listWorkflowRunArtifacts,{...context.repo,run_id:context.runId,per_page:100}),phases=[];
 for(let shard=1;shard<=12;shard++){
  const prefix='timings-api-'+shard+'-';
  const matches=artifacts.filter(a=>a.name.startsWith(prefix)&&/^\d+$/.test(a.name.slice(prefix.length))&&Number(a.name.slice(prefix.length))<=binding.attempt&&!a.expired).sort((a,b)=>Number(b.name.slice(prefix.length))-Number(a.name.slice(prefix.length)));
  if(!matches.length)throw Error('Missing manual shard timings: '+shard);
  phases.push((await artifactJson(github,context.repo,matches[0],'clean-api'+shard+'.json')).clean_phases);
 }
 const balance=manualTestBalance(phases,binding.coverage);
 const distribution=scheduledPlan(candidate.inventory.units,binding.schedule).map(b=>({shard:b.shard,units:b.units.map(u=>u.id),projected_wall_seconds:b.projected_wall_seconds,...phases.find(p=>p.shard===b.shard)}));
 const report={kind:'manual-full',source:binding,balance,distribution,jobs:measurements(jobs,run.created_at,binding.profile)};
 await readRun();
 write('manual-measurements.json',report);write('manual-binding.json',binding);
 if(!balance.balanced)core.warning('Manual test-only shard ratio '+balance.ratio.toFixed(3)+' exceeds advisory target 1.20');
 await core.summary.addRaw('## Manual full clean — diagnostic only\n\nNo PR/main acceptance or deployment authorization. New dispatch selects fresh successful PR measurements; reruns retain their frozen plan.\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n').write();
}
