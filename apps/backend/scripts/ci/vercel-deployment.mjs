import {policyMatches} from './source.mjs';
import {readBinding,validateProof} from '../../../web/scripts/ci-proof.mjs';
const repository='SXQHex/FtkSaaS';
export const vercelProject='prj_shLMyVjPsCo2QrejlPGJUBKguah2';
const team='team_YifcGAWB29vV8ew4TNrHUDG3',repoId='1192151050';
const fullSha=s=>/^[a-f0-9]{40}$/.test(s??'');
export const webSourceChanged=paths=>paths.some(p=>p.startsWith('apps/web/src/'));
export const matchesVercelTarget=(deployment,target)=>!deployment.customEnvironment?.id&&!deployment.customEnvironmentId&&(target==='production'?deployment.target==='production':[null,undefined,'preview'].includes(deployment.target));

export function validateVercelRun(run,attempt){
 const event=run.path==='.github/workflows/frontend.yml'?'pull_request':run.path==='.github/workflows/backend.yml'?'push':null;
 if(!event||run.event!==event||run.status!=='completed'||run.conclusion!=='success'||run.run_attempt!==attempt||run.repository?.full_name!==repository||run.head_repository?.full_name!==repository)throw Error('Untrusted/stale Vercel acceptance run');
 return true;
}
export function vercelRequest({sha,target,run}){
 if(!fullSha(sha)||!['preview','production'].includes(target))throw Error('Exact Vercel source and environment required');
 return {name:'ftksaas-web',project:vercelProject,gitSource:{type:'github',repoId,ref:sha,sha},...(target==='production'?{target:'production'}:{}),meta:{ftk_source_sha:sha,ftk_acceptance_run:String(run)}};
}
async function changed(github,repo,base,head){
 const trees=await Promise.all([base,head].map(async tree_sha=>{
  const {data}=await github.rest.git.getTree({...repo,tree_sha,recursive:'1'});
  if(data.truncated)throw Error('Truncated deploy source tree');
  return new Map(data.tree.filter(e=>e.type==='blob'||e.mode==='160000').map(e=>[e.path,e.sha+':'+e.mode]));
 }));
 return [...new Set([...trees[0].keys(),...trees[1].keys()])].filter(p=>trees[0].get(p)!==trees[1].get(p));
}
async function runNow(github,repo,id,attempt){
 const {data:run}=await github.rest.actions.getWorkflowRun({...repo,run_id:id});if(run.id!==id)throw Error('Wrong Vercel acceptance run');validateVercelRun(run,attempt);return run;
}
async function preview(github,repo,run,main){
 const prs=await github.paginate(github.rest.pulls.list,{...repo,state:'open',base:'main',per_page:100});
 const matches=prs.filter(p=>p.head.sha===run.head_sha&&p.head.repo.full_name===repository);
 if(!matches.length)return null;if(matches.length!==1)throw Error('Ambiguous preview candidate');
 const pr=(await github.rest.pulls.get({...repo,pull_number:matches[0].number})).data;
 if(pr.state!=='open'||pr.draft||pr.base.ref!=='main'||pr.head.sha!==run.head_sha||pr.head.repo.full_name!==repository)return null;
 if(!webSourceChanged(await changed(github,repo,pr.base.sha,pr.head.sha)))return null;
 if(!await policyMatches(github,repo,main,pr.head.sha))throw Error('Preview policy installation requires review');
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt,{...repo,run_id:run.id,attempt_number:run.run_attempt,per_page:100});
 const artifacts=await github.paginate(github.rest.actions.listWorkflowRunArtifacts,{...repo,run_id:run.id,per_page:100});
 const uploads=jobs.filter(j=>j.name==='scope').flatMap(j=>j.steps??[]).filter(s=>s.name==='Upload candidate source'&&s.conclusion==='success');
 if(uploads.length!==1)throw Error('Preview source upload required');
 const upload=uploads[0],proofs=artifacts.filter(a=>/^frontend-source-frontend-\d+$/.test(a.name)&&!a.expired&&a.size_in_bytes<100000&&Date.parse(a.created_at)>=Date.parse(upload.started_at)&&Date.parse(a.created_at)<=Date.parse(upload.completed_at));
 if(proofs.length!==1)throw Error('Exact preview source artifact required');
 const zip=await github.rest.actions.downloadArtifact({...repo,artifact_id:proofs[0].id,archive_format:'zip'}),binding=readBinding(Buffer.from(zip.data));
 if(proofs[0].name!=='frontend-source-frontend-'+binding.source_attempt)throw Error('Preview artifact attempt mismatch');
 const candidate=(await github.rest.git.getCommit({...repo,commit_sha:binding.merge})).data;
 const ref=(await github.rest.git.getRef({...repo,ref:'pull/'+pr.number+'/merge'})).data;
 const commit=(await github.rest.git.getCommit({...repo,commit_sha:ref.object.sha})).data;
 validateProof(binding,{kind:'frontend',repository,pr,commit,candidate,run,jobs});
 await runNow(github,repo,run.id,run.run_attempt);
 return {sha:binding.merge,target:'preview',run:run.id,attempt:run.run_attempt,pr:pr.number,head:pr.head.sha,base:pr.base.sha};
}
async function acceptedMain(github,repo,run,main,manual,target){
 if(run.head_branch!=='main'||run.head_sha!==main)return null;
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt,{...repo,run_id:run.id,attempt_number:run.run_attempt,per_page:100});
 const sources=jobs.filter(j=>j.name==='source');
 if(sources.length!==1||sources[0].status!=='completed'||sources[0].conclusion!=='success'||sources[0].run_id!==run.id||sources[0].run_attempt!==run.run_attempt||sources[0].head_sha!==main||!sources[0].steps?.some(s=>s.name==='Verify merged candidate relation'&&s.conclusion==='success'))throw Error('Main source proof required');
 const commit=(await github.rest.git.getCommit({...repo,commit_sha:main})).data;
 if(commit.parents.length!==2)throw Error('Accepted merge commit required');
 if(!manual&&!webSourceChanged(await changed(github,repo,commit.parents[0].sha,main)))return null;
 await runNow(github,repo,run.id,run.run_attempt);
 return {sha:main,target,run:run.id,attempt:run.run_attempt,manual};
}
export async function selectVercelSource(github,context){
 if(context.repo.owner+'/'+context.repo.repo!==repository)throw Error('Unexpected Vercel repository');
 const repo=context.repo,main=(await github.rest.git.getRef({...repo,ref:'heads/main'})).data.object.sha;
 if(context.eventName==='workflow_dispatch'){
  if(context.ref!=='refs/heads/main'||context.sha!==main)throw Error('Manual Vercel delivery requires current main');
  const target=context.payload.inputs?.target??'preview';if(!['preview','production'].includes(target))throw Error('Unknown Vercel target');
  const {data}=await github.rest.actions.listWorkflowRuns({...repo,workflow_id:'backend.yml',head_sha:main,event:'push',status:'success',per_page:100});
  const run=data.workflow_runs.find(r=>r.status==='completed'&&r.conclusion==='success');
  if(!run)throw Error('Manual deployment awaits successful main acceptance');validateVercelRun(run,run.run_attempt);
  return acceptedMain(github,repo,run,main,true,target);
 }
 if(context.eventName!=='workflow_run')throw Error('Unsupported Vercel event');
 const event=context.payload.workflow_run;
 if(event.conclusion!=='success'||!['pull_request','push'].includes(event.event))return null;
 const run=await runNow(github,repo,event.id,event.run_attempt);
 return run.path==='.github/workflows/frontend.yml'?preview(github,repo,run,main):acceptedMain(github,repo,run,main,false,'production');
}

export async function deliverVercel(github,context,core,expected,{token=process.env.VERCEL_TOKEN,fetcher=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(!token)throw Error('Configure VERCEL_TOKEN in the vercel GitHub environment');
 const current=await selectVercelSource(github,context);
 if(!current||JSON.stringify(current)!==JSON.stringify(expected))throw Error('Vercel source/proof moved before delivery');
 const api=async(route,body)=>{
  const response=await fetcher('https://api.vercel.com'+route+(route.includes('?')?'&':'?')+'teamId='+team,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Vercel API HTTP '+response.status);return response.json();
 };
 const project=await api('/v9/projects/'+vercelProject);
 if(project.id!==vercelProject||project.accountId!==team||project.rootDirectory!=='apps/web'||String(project.link?.repoId)!==repoId||project.link?.type!=='github')throw Error('Vercel project/Git connection mismatch');
 const beforeWrite=await selectVercelSource(github,context);
 if(!beforeWrite||JSON.stringify(beforeWrite)!==JSON.stringify(expected))throw Error('Vercel source/proof moved before deployment request');
 // Only trusted-main orchestration runs with the token. PR code is never checked out here.
 let deployment=await api('/v13/deployments',vercelRequest(current));
 if(!/^dpl_[A-Za-z0-9]+$/.test(deployment.id??''))throw Error('Invalid Vercel deployment ID');
 const id=deployment.id,deadline=Date.now()+12*60*1000;
 while(deployment.readyState!=='READY'){
  if(['ERROR','CANCELED'].includes(deployment.readyState))throw Error('Vercel deployment '+deployment.readyState+': '+id);
  if(Date.now()>deadline)throw Error('Vercel deployment readiness deadline exceeded: '+id);
  await pause(5000);deployment=await api('/v13/deployments/'+id);
 }
 const deployedSha=deployment.gitSource?.sha??deployment.meta?.githubCommitSha;
 if(deployment.projectId!==vercelProject||deployedSha!==current.sha||!matchesVercelTarget(deployment,current.target))throw Error('Vercel deployed source/target mismatch');
 if(!/^[A-Za-z0-9.-]+\.vercel\.app$/.test(deployment.url??''))throw Error('Unexpected Vercel deployment URL');
 const result={...current,deployment:id,url:'https://'+deployment.url,state:'READY'};
 await core.summary.addRaw('Vercel delivery: '+JSON.stringify(result)+'\n').write();return result;
}
