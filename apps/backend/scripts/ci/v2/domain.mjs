import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createDispatchPlan,validateDispatchImpact} from './dispatch.mjs';
import {repositoryRoot} from '../../paths.mjs';

export function evaluateDomain(impact,domain,results){
 if(!['frontend','backend'].includes(domain)||results.plan!=='success')throw Error('CI_V2_INVALID_DOMAIN_SOURCE');
 // Validate the complete plan shape without requiring the other domain's result.
 validateDispatchImpact(impact);
 if(!impact.deploy||!['vercel','supabase'].every(key=>typeof impact.deploy[key]==='boolean')||impact.deploy.vercel&&!impact.frontend||impact.deploy.supabase&&!impact.backend)throw Error('CI_V2_INVALID_DEPLOY_IMPACT');
 if(results.common!==(impact.baseline?'success':'skipped')||results[domain]!==(impact[domain]?'success':'skipped'))throw Error('CI_V2_INCOMPLETE_DOMAIN: '+domain);
 return {kind:'domain-shadow',domain,checks:impact[domain]?'passed':'not-selected',deployment:impact.deploy[domain==='backend'?'supabase':'vercel']?'required':'not-required',acceptance:false,deploy_authorized:false};
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_EVENT_NAME!=='workflow_dispatch')throw Error('CI_V2_MANUAL_RUN_REQUIRED');
 const plan=createDispatchPlan({base:process.env.CI_V2_BASE_SHA,head:process.env.GITHUB_SHA,mode:process.env.CI_V2_MODE??'auto'});
 const domain=process.argv[2],decision=evaluateDomain(plan.impact,domain,{plan:process.env.PLAN_RESULT,common:process.env.COMMON_RESULT,[domain]:process.env.DOMAIN_RESULT});
 if(!/^\d+$/.test(process.env.GITHUB_RUN_ID??'')||!/^\d+$/.test(process.env.GITHUB_RUN_ATTEMPT??''))throw Error('CI_V2_INVALID_RUN');
 const report={...decision,source:plan.source,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,repository:process.env.GITHUB_REPOSITORY};
 const dir=path.join(repositoryRoot,'.artifacts/ci-v2-domain');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,domain+'.json'),JSON.stringify(report,null,2)+'\n');
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`${domain}: ${decision.checks}; deployment impact: ${decision.deployment}. Shadow only; no merge or deploy authorization.\n`);
}
