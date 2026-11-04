import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {backendRoot,repoFile} from '../../paths.mjs';
import {assertLocalServices} from './safety.mjs';

export function validateShadowScope(mode){
 if(!['backend','core','full'].includes(mode))throw Error('CI_V2_INVALID_SHADOW_SCOPE');
 return mode;
}
export function coreStages(){return [
 {name:'pristine-schema',command:'node',args:['scripts/capture-docs.mjs','--local']},
 {name:'documentation-links',command:'node',args:['scripts/ci/docs-check.mjs','../../README.md']},
 {name:'database-security',command:'node',args:['--test','--test-concurrency=1','--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter=junit','--test-reporter-destination=../../.artifacts/ci-v2/core.junit.xml','tests/database.test.mjs','tests/event-scope.test.mjs']},
 {name:'synthetic-seed',command:'pnpm',args:['run','dev:seed']},
 {name:'service-health',command:'pnpm',args:['run','dev:health']},
 // Pinned CLI 3 targets local by default; --remote is deliberately absent.
 {name:'database-advisors',command:'node_modules/.bin/supabase',args:['db','advisors','--type','all','--level','warn','--fail-on','error']}
];}
export function validatePristineBaseline(value,source){
 if(value?.format!==1||value.source!==source||!/^[a-f0-9]{64}$/.test(value.structure_sha256??''))throw Error('CI_V2_PRISTINE_SOURCE_MISMATCH');
}
export function validateCoreHealth(value){
 const checks=value?.checks;
 if(!Array.isArray(checks)||checks.length!==2||!['auth','rest'].every(name=>checks.filter(c=>c.name===name&&c.passed===true).length===1))throw Error('CI_V2_INCOMPLETE_HEALTH');
}
export function runCoreChecks({source,run,readBaseline,readHealth,write,now=()=>performance.now()}){
 const report={kind:'core-shadow',acceptance:false,source,passed:false,stages:[]};
 try{
  for(const stage of coreStages()){
   const row={name:stage.name,passed:false},start=now();report.stages.push(row);
   run(stage.command,stage.args);
   if(stage.name==='pristine-schema'){const baseline=readBaseline();validatePristineBaseline(baseline,source);report.pristine_schema_sha256=baseline.structure_sha256;}
   if(stage.name==='service-health')validateCoreHealth(readHealth());
   row.seconds=(now()-start)/1000;row.passed=true;write(report);
  }
  report.passed=true;return report;
 }finally{write(report);}
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 process.chdir(backendRoot);
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 const identity={sha:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT};
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||process.env.CI_V2_CORE!=='true'||!/^[a-f0-9]{40}$/.test(identity.sha??'')||git('rev-parse','HEAD')!==identity.sha||git('status','--porcelain'))throw Error('CI_V2_OWNED_MANUAL_CORE_REQUIRED');
 assert.deepEqual(JSON.parse(fs.readFileSync('.dev/ci-v2-owner.json','utf8')),identity);
 const {stackStatus}=await import('../../db.mjs');assertLocalServices(stackStatus().env);
 const output=repoFile('.artifacts/ci-v2');fs.mkdirSync(output,{recursive:true});
 const reportFile=path.join(output,'core.json');
 const report=runCoreChecks({source:identity.sha,
  run:(command,args)=>{console.log('V2 core:',command,...args);const result=spawnSync(command,args,{cwd:backendRoot,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('CI_V2_CORE_STEP_FAILED: '+command+' (exit '+result.status+')');},
  readBaseline:()=>{const value=JSON.parse(fs.readFileSync(repoFile('.artifacts/docs/schema-baseline.json'),'utf8'));validatePristineBaseline(value,identity.sha);fs.writeFileSync(path.join(output,'core-schema-baseline.json'),JSON.stringify(value,null,2)+'\n');return value;},
  readHealth:()=>JSON.parse(fs.readFileSync(repoFile('.artifacts/backend/environment.json'),'utf8')),
  write:report=>fs.writeFileSync(reportFile,JSON.stringify({...report,...identity,tree:git('rev-parse','HEAD^{tree}')},null,2)+'\n')
 });
 console.log('V2 core shadow passed; no merge/CD acceptance.');
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Core shadow stages (no runtime promotion):\n```json\n'+JSON.stringify(report,null,2)+'\n```\n');
}
