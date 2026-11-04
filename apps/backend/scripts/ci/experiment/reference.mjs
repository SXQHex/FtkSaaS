import {apiRoles} from '../shards.mjs';
import {receipt,validateBinding} from '../gate.mjs';
import {validateQuality} from '../quality-proof.mjs';
import {policyMatches} from '../source.mjs';

export async function resolveReference(github,context,id){
 if(context.ref!=='refs/heads/main'||context.eventName!=='workflow_dispatch')throw Error('Experiment must use installed main workflow');
 if(!/^[1-9][0-9]*$/.test(String(id))||!Number.isSafeInteger(Number(id)))throw Error('Exact reference run ID required');
 const repo=context.repo;
 const run=(await github.rest.actions.getWorkflowRun({...repo,run_id:Number(id)})).data;
 if(run.path!=='.github/workflows/ci-full.yml'||run.event!=='pull_request'||run.status!=='completed'||run.conclusion!=='success')throw Error('Reference must be a successful original full-clean PR run');
 const binding=await receipt(github,repo,run);
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt,{...repo,run_id:run.id,attempt_number:run.run_attempt,per_page:100});
 const tested=(await github.rest.git.getCommit({...repo,commit_sha:binding.merge})).data;
 // Historical snapshots are diagnostics. A later PR base update must not rewrite
 // the baseline's head/base; all four values come from its validated receipt.
 const pr={number:binding.pr,state:'closed',head:{sha:binding.head},base:{sha:binding.base}};
 const trusted=await policyMatches(github,repo,binding.base,binding.head)||await policyMatches(github,repo,context.sha,binding.head);
 validateBinding({binding,pr,run,jobs,tested,currentTree:tested.tree.sha,workflowMatches:trusted});
 validateQuality({binding:await receipt(github,repo,run,'quality'),pr,run,jobs,currentTree:tested.tree.sha});
 const live=(await github.rest.actions.getWorkflowRun({...repo,run_id:run.id})).data;
 assertUnchangedRun(run,live);
 return {profile:binding.profile,run_id:run.id,attempt:run.run_attempt,head:binding.head,base:binding.base,merge:binding.merge,tree:binding.tree,definition:context.sha,url:run.html_url};
}

export function assertUnchangedRun(reference,live){
 if(live.id!==(reference.run_id??reference.id)||live.run_attempt!==(reference.attempt??reference.run_attempt)||live.head_sha!==(reference.head??reference.head_sha)||live.status!=='completed'||live.conclusion!=='success')throw Error('Reference run changed during experiment');
}

export function jobMeasurements(jobs){
 return jobs.filter(j=>j.started_at&&j.completed_at).map(j=>{
  const duration=(a,b)=>Math.max(0,(Date.parse(b)-Date.parse(a))/1000);
  const test=j.steps?.find(s=>['Clean acceptance','Experimental API tests'].includes(s.name));
  return {name:j.name,conclusion:j.conclusion,started_at:j.started_at,completed_at:j.completed_at,queue_s:j.created_at?duration(j.created_at,j.started_at):null,runner_s:duration(j.started_at,j.completed_at),test_s:test?.started_at&&test?.completed_at?duration(test.started_at,test.completed_at):null};
 });
}

export async function summarize(github,context,core,reference){
 const repo=context.repo,run=(await github.rest.actions.getWorkflowRun({...repo,run_id:context.runId})).data;
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt,{...repo,run_id:context.runId,attempt_number:run.run_attempt,per_page:100});
 const original=(await github.rest.actions.getWorkflowRun({...repo,run_id:reference.run_id})).data;
 assertUnchangedRun(reference,original);
 const baseline=await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt,{...repo,run_id:original.id,attempt_number:original.run_attempt,per_page:100});
 const required=['reference','core',...Array.from({length:8},(_,i)=>'experiment-api-'+(i+1))];
 for(const name of required){
  const found=jobs.filter(j=>j.name===name);
  if(found.length!==1||found[0].status!=='completed'||found[0].conclusion!=='success'||found[0].run_id!==context.runId||found[0].run_attempt!==run.run_attempt||found[0].head_sha!==context.sha)throw Error('Missing/failed/stale experiment job: '+name);
  const steps=name==='reference'?['Validate baseline','Validate experiment inventory']:['Verify source checkout',name==='core'?'Clean acceptance':'Experimental API tests'];
  for(const step of steps)if(!found[0].steps.some(s=>s.name===step&&s.conclusion==='success'))throw Error('Unexecuted experiment step: '+name+'/'+step);
 }
 const {writeFileSync,mkdirSync}=await import('node:fs');
 const role=j=>j.name.split(' / ').at(-1);
 const baselineRoles=new Set(['core',...apiRoles(reference.profile??'four-isolated-v2')]);
 const before=jobMeasurements(baseline.filter(j=>baselineRoles.has(role(j))));
 const after=jobMeasurements(jobs.filter(j=>/^(core|experiment-api-[1-8])$/.test(j.name)));
 const window=rows=>(Math.max(...rows.map(r=>Date.parse(r.completed_at)))-Math.min(...rows.map(r=>Date.parse(r.started_at))))/1000;
 const cost=rows=>Math.round(rows.reduce((sum,r)=>sum+r.runner_s,0)/60*100)/100;
 const report={kind:'measurement-only',test_timeout:'unlimited in experimental API registration; baseline budgets unchanged',reference,experiment:{run_id:context.runId,attempt:run.run_attempt,definition:context.sha},baseline:before,experimental:after,matched_core_api:{runner_minutes:{baseline:cost(before),experiment:cost(after)},execution_window_s:{baseline:window(before),experiment:window(after)}},overhead:{baseline:jobMeasurements(baseline.filter(j=>!baselineRoles.has(role(j)))),experiment:jobMeasurements(jobs.filter(j=>j.name==='reference')),note:'Overhead is separate; the currently running comparison job is excluded. These are not total billed workflow minutes.'},note:'Diagnostic measurement only; test timeout policies differ, so successful experiment is not equivalent baseline timeout acceptance. No candidate/main/CD receipt. Baseline retained jobs use actual original execution timestamps. Compare per-job and queue times; successful completion is required, a single run is not proof of lasting improvement.'};
 mkdirSync('.artifacts/ci/experiment',{recursive:true});writeFileSync('.artifacts/ci/experiment/comparison.json',JSON.stringify(report,null,2)+'\n');
 await core.summary.addRaw('## Eight-shard comparison\n\nDiagnostic only; existing merge and deployment acceptance unchanged.\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n').write();
 const live=(await github.rest.actions.getWorkflowRun({...repo,run_id:context.runId})).data;
 if(live.run_attempt!==run.run_attempt||live.head_sha!==context.sha)throw Error('Experiment attempt/source changed during collection');
 assertUnchangedRun(reference,(await github.rest.actions.getWorkflowRun({...repo,run_id:reference.run_id})).data);
}
