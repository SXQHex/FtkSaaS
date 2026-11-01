import assert from 'node:assert/strict';
import {coverageHash} from '../scripts/ci/shards.mjs';
import fs,{mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';

export const valid=()=>({binding:{kind:'full',profile:'four-isolated-v1',balance_policy:'api-wall-v1',coverage:coverageHash(),pr:1,head:'H',base:'B',merge:'M',tree:'T',run_id:5,attempt:1},pr:{number:1,head:{sha:'H'},base:{sha:'B'}},run:{id:5,run_attempt:1,head_sha:'H',event:'pull_request',path:'.github/workflows/ci-full.yml',status:'completed',conclusion:'success'},tested:{sha:'M',tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]},currentTree:'T',workflowMatches:true,jobs:['core','api-1','api-2','api-3','api-4','full-clean'].map(name=>({name,status:'completed',conclusion:'success',run_id:5,run_attempt:1,head_sha:'H',steps:[{name:name==='full-clean'?'Verify all required jobs':'Clean acceptance',conclusion:'success',started_at:'2026-01-01T00:00:00Z',completed_at:'2026-01-01T00:01:00Z'},{name:'Verify tested merge',conclusion:'success'}]}))});

export function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'ci-selection-'));const git=(...a)=>execFileSync('git',a,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();try{git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');writeFileSync(join(dir,'README.md'),'Initial\n');git('add','.');git('commit','-m','base');git('update-ref','refs/remotes/origin/main',git('rev-parse','HEAD'));return fn(dir,git);}finally{rmSync(dir,{recursive:true,force:true});}}




export const change=path=>({path,status:'M'});

export function scopedGithub(paths,{truncated=false,moved=false}={}){
 const pr={number:9,state:'open',draft:false,labels:[],base:{sha:'B',ref:'main'},head:{sha:'H'},merged_at:'now',merge_commit_sha:'M'};
 const statuses=[];
 const github={rest:{
  pulls:{get:async()=>({data:moved?{...pr,head:{sha:'changed'}}:pr})},
  git:{getRef:async()=>({data:{object:{sha:'M'}}}),getCommit:async()=>({data:{sha:'M',tree:{sha:'T'},parents:[{sha:'B'},{sha:'H'}]}}),
   getTree:async({tree_sha})=>({data:{truncated,tree:paths.map(path=>({path,type:'blob',mode:'100644',sha:tree_sha+path}))}}),
   getBlob:async()=>({data:{encoding:'base64',content:Buffer.from('prose').toString('base64')}})},
  repos:{listPullRequestsAssociatedWithCommit:'prs',createCommitStatus:async s=>{statuses.push(s);}},
  actions:{listWorkflowRuns:'runs'}
 },paginate:async method=>method==='prs'?[pr]:[]};
 attachQualityFixture(github,pr);
 return {github,pr,statuses};
}

export function candidateProofFixture(dir,{kind='full',rerun=false}={}){
 const v=valid(),pr={...v.pr,state:'closed',draft:false,merged_at:'now',merge_commit_sha:'A',labels:[]};
 if(rerun){v.run.run_attempt=2;v.binding={...v.binding,profile:'four-isolated-v2',attempt:2,source_attempt:1};v.jobs.forEach(j=>j.run_attempt=2);v.jobs[0].steps.push({name:'Upload schema baseline',conclusion:'success'});}
 if(kind==='documentation'){v.binding.kind=kind;v.jobs=[{...v.jobs[0],name:'documentation',steps:[{name:'Documentation acceptance',conclusion:'success'},{name:'Verify tested merge',conclusion:'success'}]}];}
 writeFileSync(join(dir,'binding.json'),JSON.stringify(v.binding));execFileSync('zip',['-q',join(dir,'proof.zip'),'binding.json'],{cwd:dir});const zip=fs.readFileSync(join(dir,'proof.zip'));
 const qualityZip=qualityFixture(dir,rerun?{...v.run,run_attempt:1}:v.run,pr);
 v.jobs.push(qualityJob(v.run));
 const repo={owner:'synthetic',repo:'test'};
 const github={rest:{git:{getTree:async({tree_sha})=>({data:{tree:[{path:kind==='documentation'?'README.md':'apps/backend/database/kernel.sql',type:'blob',mode:'100644',sha:tree_sha}]}}),getBlob:async()=>({data:{encoding:'base64',content:Buffer.from('regular prose').toString('base64')}}),getCommit:async({commit_sha})=>({data:{...v.tested,sha:commit_sha,tree:{sha:commit_sha==='bad-tree'?'wrong':'T'}}})},repos:{listPullRequestsAssociatedWithCommit:'prs'},actions:{getWorkflowRun:async({run_id})=>({data:{...v.run,id:run_id}}),listWorkflowRuns:'runs',listJobsForWorkflowRun:'jobs',listWorkflowRunArtifacts:'artifacts',downloadArtifact:async({artifact_id})=>({data:artifact_id===2?qualityZip:zip})}},paginate:async(method,args)=>method==='prs'?[pr]:method==='runs'?[{...v.run,id:10,conclusion:'cancelled'},{...v.run,id:9},{...v.run,id:7},v.run]:method==='jobs'?v.jobs.map(j=>({...j,run_id:args.run_id})):args.run_id===9?[]:[{id:1,name:(kind==='documentation'?'document-binding-':'candidate-binding-')+v.run.run_attempt},{id:2,name:'quality-binding'}]};
 return {v,pr,repo,github};
}

export function jobsWithApiSeconds(values){
 const v=valid();for(let i=0;i<4;i++){const job=v.jobs.find(j=>j.name==='api-'+(i+1));job.steps[0].completed_at=new Date(Date.parse(job.steps[0].started_at)+values[i]*1000).toISOString();}return v;
}

export function qualityJob(run){return {name:'quality',run_id:run.id,run_attempt:run.run_attempt,head_sha:run.head_sha,status:'completed',conclusion:'success',steps:['Verify quality source','Quality floor','Secret scan','Upload quality binding'].map(name=>({name,conclusion:'success'}))};}

export function qualityFixture(dir,run,pr){
 writeFileSync(join(dir,'binding.json'),JSON.stringify({kind:'quality-v1',pr:pr.number,head:pr.head.sha,base:pr.base.sha,tree:'T',run_id:run.id,attempt:run.run_attempt}));
 execFileSync('zip',['-q',join(dir,'quality.zip'),'binding.json'],{cwd:dir});return fs.readFileSync(join(dir,'quality.zip'));
}

export function attachQualityFixture(github,pr){
 const dir=mkdtempSync(join(tmpdir(),'quality-proof-'));
 const run={id:5,run_attempt:1,head_sha:'H',path:'.github/workflows/ci-full.yml',event:'pull_request',status:'completed',conclusion:'success'};
 let zip;try{zip=qualityFixture(dir,run,pr);}finally{rmSync(dir,{recursive:true,force:true});}
 Object.assign(github.rest.actions,{listJobsForWorkflowRun:'quality-jobs',listWorkflowRunArtifacts:'quality-artifacts',downloadArtifact:async()=>({data:zip}),getWorkflowRun:async()=>({data:run})});
 const original=github.paginate;
 github.paginate=async(method,args)=>method==='runs'?[run]:method==='quality-jobs'?[qualityJob(run)]:method==='quality-artifacts'?[{id:2,name:'quality-binding'}]:original(method,args);
}
