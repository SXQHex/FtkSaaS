// Scheduling data is advisory. Source coverage and required jobs remain mandatory.
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildInventory,partition} from './api-suites.mjs';
import {acceptanceProfile,apiRoles,validateJobs} from './shards.mjs';
import {repositoryRoot,ciFile} from '../paths.mjs';
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const validSeconds=n=>Number.isFinite(n)&&n>0&&n<=5400;
const sourceKeys=['run_id','attempt','head','merge','tree'];
const sourceOf=b=>Object.fromEntries(sourceKeys.map(k=>[k,b[k]]));
const compact=bins=>bins.map(b=>({shard:b.shard,units:b.units.map(u=>u.id)}));

function weighted(units,schedule){
 if(JSON.stringify(Object.keys(schedule.units).sort())!==JSON.stringify(units.map(u=>u.id).sort()))throw Error('Incomplete scheduled inventory');
 return units.map(u=>{
  const w=schedule.units[u.id];
  if(!validSeconds(w.seconds)||w.sha256!==hash(u.code))throw Error('Invalid scheduled weight/source: '+u.id);
  return {...u,estimated_seconds:w.seconds,weight_source:w.origin};
 });
}
export function freezeSchedule(units,reference=null){
 const schedule={version:1,reference:reference?sourceOf(reference):null,units:{}};
 for(const u of [...units].sort((a,b)=>a.id.localeCompare(b.id))){
  const sha256=hash(u.code),sample=reference?.units?.[u.id];
  const measured=sample?.sha256===sha256&&validSeconds(sample.seconds);
  schedule.units[u.id]={sha256,seconds:measured?sample.seconds:u.estimated_seconds,origin:measured?'previous-success':'source-snapshot'};
 }
 schedule.plan=compact(partition(weighted(units,schedule),12));
 return {...schedule,sha256:hash(schedule)};
}
export function validateSchedule(schedule,units=buildInventory(repositoryRoot).units){
 if(!schedule||schedule.version!==1)throw Error('Missing frozen schedule');
 const {sha256,...payload}=schedule;
 if(sha256!==hash(payload))throw Error('Frozen schedule hash mismatch');
 const plan=compact(partition(weighted(units,schedule),12));
 if(JSON.stringify(plan)!==JSON.stringify(schedule.plan))throw Error('Frozen schedule plan mismatch');
 return true;
}
export function scheduledPlan(units,schedule){validateSchedule(schedule,units);return partition(weighted(units,schedule),12);}

export async function artifactJson(github,repo,artifact,filename){
 if(!artifact||artifact.expired||artifact.size_in_bytes>5_000_000)throw Error('Missing/oversized/expired timing artifact');
 const zip=await github.rest.actions.downloadArtifact({...repo,artifact_id:artifact.id,archive_format:'zip'});
 const dir=fs.mkdtempSync(path.join(tmpdir(),'ftk-timing-'));
 try{
  const file=path.join(dir,'data.zip');fs.writeFileSync(file,Buffer.from(zip.data));
  const names=execFileSync('unzip',['-Z1',file],{encoding:'utf8',maxBuffer:100000}).trim().split('\n');
  const selected=names.filter(n=>n===filename||n.endsWith('/'+filename));
  if(selected.length!==1)throw Error('Missing/duplicate timing artifact member');
  return JSON.parse(execFileSync('unzip',['-p',file,selected[0]],{encoding:'utf8',maxBuffer:2_000_000}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
async function artifacts(github,repo,run_id){return github.paginate(github.rest.actions.listWorkflowRunArtifacts,{...repo,run_id,per_page:100});}
function uniqueArtifact(rows,name){const found=rows.filter(a=>a.name===name&&!a.expired);if(found.length!==1)throw Error('Missing/duplicate '+name);return found[0];}
export async function latestReference(github,repo,warning=()=>{}){
 // Bounded search. Expired or missing measurements fall back to the source snapshot.
 const response=await github.rest.actions.listWorkflowRuns({...repo,workflow_id:'ci-full.yml',event:'pull_request',status:'success',per_page:20});
 const runs=response.data.workflow_runs.filter(r=>r.status==='completed'&&r.conclusion==='success'&&r.path==='.github/workflows/ci-full.yml').sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
 for(const run of runs){
  try{
   const rows=await artifacts(github,repo,run.id),reference=await artifactJson(github,repo,uniqueArtifact(rows,'api-duration-reference-'+run.run_attempt),'duration-reference.json');
   const binding=await artifactJson(github,repo,uniqueArtifact(rows,'candidate-binding-'+run.run_attempt),'binding.json');
   if(binding.kind!=='full'||binding.profile!==acceptanceProfile||binding.run_id!==run.id||binding.attempt!==run.run_attempt||binding.head!==run.head_sha||JSON.stringify(sourceOf(binding))!==JSON.stringify(sourceOf(reference)))throw Error('Timing reference source mismatch');
   const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt,{...repo,run_id:run.id,attempt_number:run.run_attempt,per_page:100});
   validateJobs(jobs,run,{collector:true,sourceChecks:true,profile:binding.profile});
   const tested=(await github.rest.git.getCommit({...repo,commit_sha:binding.merge})).data;
   if(tested.tree.sha!==binding.tree||tested.parents.length!==2||tested.parents[0].sha!==binding.base||tested.parents[1].sha!==binding.head)throw Error('Timing reference tested source mismatch');
   if(reference.version!==1||!reference.units||Object.values(reference.units).some(s=>!validSeconds(s.seconds)||!/^[a-f0-9]{64}$/.test(s.sha256)))throw Error('Invalid timing reference samples');
   const scheduled=binding.schedule?.units;
   if(!scheduled||JSON.stringify(Object.keys(reference.units).sort())!==JSON.stringify(Object.keys(scheduled).sort())||Object.entries(reference.units).some(([id,s])=>s.sha256!==scheduled[id].sha256))throw Error('Incomplete timing reference source inventory');
   const live=(await github.rest.actions.getWorkflowRun({...repo,run_id:run.id})).data;
   if(live.run_attempt!==run.run_attempt||live.head_sha!==run.head_sha||live.status!=='completed'||live.conclusion!=='success')throw Error('Timing reference attempt changed');
   return reference;
  }catch{ /* No executable artifact is loaded; invalid measurements are not acceptance. */ }
 }
 warning('No eligible successful API timing reference; using source snapshot weights');return null;
}

export async function candidateSchedule(github,context,binding,warning){
 if(!Number.isSafeInteger(binding.attempt)||binding.attempt<1)throw Error('Invalid candidate schedule attempt');
 if(binding.attempt===1){
  let reference=null;
  try{reference=await latestReference(github,context.repo,warning);}catch{warning('API timing lookup unavailable; using source snapshot weights');}
  const result={...binding,schedule:freezeSchedule(buildInventory(repositoryRoot).units,reference)};
  fs.mkdirSync(ciFile(),{recursive:true});fs.writeFileSync(ciFile('candidate-source.json'),JSON.stringify(result));
  return result;
 }
 // Never query latest timings on a rerun, including a rerun of the candidate job.
 const rows=await artifacts(github,context.repo,binding.run_id);
 const original=await artifactJson(github,context.repo,uniqueArtifact(rows,'candidate-source'),'candidate-source.json');
 for(const k of ['kind','profile','coverage','pr','head','base','merge','tree','run_id'])if(original[k]!==binding[k])throw Error('Frozen candidate source changed');
 if(original.attempt!==1)throw Error('Invalid original schedule attempt');
 validateSchedule(original.schedule);return original;
}

export function measuredReference(binding,jobs,samples){
 validateSchedule(binding.schedule);
 const units=buildInventory(repositoryRoot).units,byId=new Map(units.map(u=>[u.id,u])),seen=new Set(),result={version:1,...sourceOf(binding),units:{}};
 for(const role of apiRoles(binding.profile)){
  const shard=Number(role.slice(4)),job=jobs.find(j=>j.name.split(' / ').at(-1)===role),sample=samples[role];
  const expected=binding.schedule.plan.find(b=>b.shard===shard).units;
  if(!job||!sample||sample.role!==role||sample.run_id!==binding.run_id||sample.head!==binding.head||sample.merge!==binding.merge||sample.schedule!==binding.schedule.sha256||!Number.isSafeInteger(sample.attempt)||sample.attempt<1||sample.attempt>binding.attempt)throw Error('Invalid measured shard source');
  if(JSON.stringify(sample.units.map(u=>u.id).sort())!==JSON.stringify([...expected].sort()))throw Error('Incomplete measured shard inventory');
  for(const row of sample.units){
   if(seen.has(row.id)||!byId.has(row.id)||row.sha256!==hash(byId.get(row.id).code)||!validSeconds(row.seconds)||row.exit_code!==0)throw Error('Invalid completed process measurement');
   seen.add(row.id);result.units[row.id]={seconds:row.seconds,sha256:row.sha256,job_id:job.id,execution_attempt:sample.attempt};
  }
 }
 if(seen.size!==units.length)throw Error('Incomplete API timing reference');return result;
}
export async function publishReference(github,context,binding,jobs,warning){
 fs.rmSync(ciFile('duration-reference.json'),{force:true});
 try{
  const rows=await artifacts(github,context.repo,binding.run_id),samples={};
  for(const role of apiRoles(binding.profile)){
   const prefix='timings-'+role+'-';
   const matches=rows.filter(a=>a.name.startsWith(prefix)&&/^\d+$/.test(a.name.slice(prefix.length))&&Number(a.name.slice(prefix.length))<=binding.attempt&&!a.expired).sort((a,b)=>Number(b.name.slice(prefix.length))-Number(a.name.slice(prefix.length)));
   if(!matches.length)throw Error('Missing '+role+' timing artifact');
   const sample=await artifactJson(github,context.repo,matches[0],'unit-durations.json');
   if(sample.attempt!==Number(matches[0].name.slice(prefix.length)))throw Error('Timing artifact attempt mismatch');
   samples[role]=sample;
  }
  const reference=measuredReference(binding,jobs,samples);
  fs.writeFileSync(ciFile('duration-reference.json'),JSON.stringify(reference));
 }catch(error){warning('API duration reference unavailable: '+error.message);}
}
