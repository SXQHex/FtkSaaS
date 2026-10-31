import {ciFile} from '../paths.mjs';
import fs from 'node:fs';
import {validateJobs,coverageHash,roleName,shardPlan,apiTimeBalance} from './shards.mjs';
import {currentAttemptBinding} from './source.mjs';

export function measurements(jobs,created){
 const seconds=(a,b)=>(Date.parse(b)-Date.parse(a))/1000;
 // validateJobs runs first and rejects every skipped/failed required role.
 // An optional serial-reference is intentionally skipped on routine main runs;
 // it has neither a Clean acceptance step nor an execution duration to measure.
 return jobs.filter(j=>j.status==='completed'&&j.conclusion==='success'&&['core','api-1','api-2','api-3','api-4','serial-reference'].includes(roleName(j))).map(j=>{
  const step=j.steps.find(s=>s.name==='Clean acceptance');
  return {role:roleName(j),job_id:j.id,accepted_attempt:j.run_attempt,started:j.started_at,queue_s:seconds(j.created_at,j.started_at),since_run_s:seconds(created,j.started_at),setup_s:seconds(j.started_at,step.started_at),test_s:seconds(step.started_at,step.completed_at),runner_s:seconds(j.started_at,j.completed_at),finished:j.completed_at};
 });
}
export async function collect(github,context,core,binding){
 fs.rmSync(ciFile('binding.json'),{force:true});
 binding=currentAttemptBinding(binding,context);
 if(binding.kind!=='full'||binding.profile!=='four-isolated-v2'||binding.coverage!==coverageHash())throw Error('Collector profile/coverage mismatch');
 const run=(await github.rest.actions.getWorkflowRun({...context.repo,run_id:context.runId})).data;
 if(run.id!==binding.run_id||run.run_attempt!==binding.attempt||run.head_sha!==binding.head||run.event!=='pull_request'||run.path!=='.github/workflows/ci-full.yml')throw Error('Collector workflow/source/attempt mismatch');
 // GitHub includes retained successful jobs in the requested attempt view.
 // Do not assemble successes from arbitrary historical attempts or runs.
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt,{...context.repo,run_id:context.runId,attempt_number:binding.attempt,per_page:100});
 validateJobs(jobs,run,{benchmark:binding.benchmark,sourceChecks:true});
 const live=(await github.rest.actions.getWorkflowRun({...context.repo,run_id:context.runId})).data;
 if(live.id!==run.id||live.run_attempt!==run.run_attempt||live.head_sha!==run.head_sha)throw Error('Workflow source/attempt changed during collection');
 let balance;
 try{balance=apiTimeBalance(jobs,run);}catch(error){balance={balanced:null,status:'unavailable',reason:String(error.message)};}
 if(balance.balanced!==true)core.warning?.(balance.status==='unavailable'?'API timing unavailable: '+balance.reason:'API time imbalance (advisory): ratio '+balance.ratio.toFixed(3)+', gap '+balance.gap_s+'s; functional/source acceptance is unchanged');
 const rows=measurements(jobs,run.created_at),sharded=rows.filter(r=>r.role!=='serial-reference');
 const total=rs=>rs.reduce((n,r)=>n+r.runner_s,0)/60;
 const end=Math.max(...sharded.map(r=>Date.parse(r.finished)));
 const report={balance_mode:'advisory',balance,test_step_includes_backend_setup:true,backend_phase_details:'Each required job summary and timings artifact separately measures backend setup/tests/seed-health-advisors; queue/setup below refers to GitHub job and checkout/package installation.',source:binding,distribution:shardPlan(),jobs:rows,sharded_wait_s:(end-Date.parse(run.created_at))/1000,longest_api_s:Math.max(...rows.filter(r=>r.role.startsWith('api-')).map(r=>r.test_s)),sharded_runner_minutes:total(sharded),serial_runner_minutes:total(rows.filter(r=>r.role==='serial-reference')),acceptance_roles_runner_minutes:total(rows),completed_workflow_runner_minutes:jobs.filter(j=>j.status==='completed'&&j.started_at&&j.completed_at).reduce((s,j)=>s+(Date.parse(j.completed_at)-Date.parse(j.started_at))/60000,0),workflow_total_note:'Collector is still running; final total workflow runner minutes must be measured after completion'};
 fs.mkdirSync(ciFile(),{recursive:true});fs.writeFileSync(ciFile('measurements.json'),JSON.stringify(report,null,2));
 await core.summary.addRaw('## API time balance (advisory)\n\n'+JSON.stringify(balance)+'\n\nAll required tests succeeded for this unchanged run source. GitHub may retain successful executions from earlier attempts; job IDs and accepted_attempt describe the current API view, while timestamps describe execution. Timing optimization never blocks functional/source acceptance.\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n').write();
 fs.writeFileSync(ciFile('binding.json'),JSON.stringify({...binding,balance_mode:'advisory',balance_policy:balance.version}));
}
