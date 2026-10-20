import fs from 'node:fs';
import {validateJobs,coverageHash,roleName,shardPlan} from './shards.mjs';

export function measurements(jobs,created){
 const seconds=(a,b)=>(Date.parse(b)-Date.parse(a))/1000;
 return jobs.filter(j=>['core','api-1','api-2','api-3','api-4','serial-reference'].includes(roleName(j))).map(j=>{
  const step=j.steps.find(s=>s.name==='Clean acceptance');
  return {role:roleName(j),queue_s:seconds(j.created_at,j.started_at),since_run_s:seconds(created,j.started_at),setup_s:seconds(j.started_at,step.started_at),test_s:seconds(step.started_at,step.completed_at),runner_s:seconds(j.started_at,j.completed_at),finished:j.completed_at};
 });
}
export async function collect(github,context,core,binding){
 if(binding.run_id!==context.runId||binding.attempt!==Number(process.env.GITHUB_RUN_ATTEMPT)||binding.coverage!==coverageHash())throw Error('Collector source/run/attempt/coverage mismatch');
 const run=(await github.rest.actions.getWorkflowRun({...context.repo,run_id:context.runId})).data;
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt,{...context.repo,run_id:context.runId,attempt_number:binding.attempt,per_page:100});
 validateJobs(jobs,run,{benchmark:binding.benchmark});
 const rows=measurements(jobs,run.created_at),sharded=rows.filter(r=>r.role!=='serial-reference');
 const total=rs=>rs.reduce((n,r)=>n+r.runner_s,0)/60;
 const end=Math.max(...sharded.map(r=>Date.parse(r.finished)));
 const report={source:binding,distribution:shardPlan(),jobs:rows,sharded_wait_s:(end-Date.parse(run.created_at))/1000,longest_api_s:Math.max(...rows.filter(r=>r.role.startsWith('api-')).map(r=>r.test_s)),sharded_runner_minutes:total(sharded),serial_runner_minutes:total(rows.filter(r=>r.role==='serial-reference')),all_runner_minutes:total(rows)};
 fs.mkdirSync('.ci',{recursive:true});fs.writeFileSync('.ci/binding.json',JSON.stringify({...binding,profile:'four-isolated-v1'}));fs.writeFileSync('.ci/measurements.json',JSON.stringify(report,null,2));
 await core.summary.addRaw('## Source-bound full clean\n\nAll required jobs executed successfully in this run/attempt.\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n').write();
}
