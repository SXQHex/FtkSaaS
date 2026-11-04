import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import suites from '../../../tests/v2/backend-suites.json' with {type:'json'};
import {backendRoot,repoFile} from '../../paths.mjs';
import {backendShardCount} from './settings.mjs';

export function backendPlan(entries=suites){
 if(!Array.isArray(entries)||entries.length<backendShardCount)throw Error('CI_V2_INSUFFICIENT_SUITES');
 const ids=new Set(),files=new Set();
 for(const entry of entries){
  if(!/^[a-z0-9-]+$/.test(entry.id)||!/^apps\/backend\/tests\/(?:v2\/backend\/)?[a-z0-9-]+(?:\.test)?\.mjs$/.test(entry.file)
   ||ids.has(entry.id)||files.has(entry.file)||!Number.isFinite(entry.estimated_seconds)||entry.estimated_seconds<=0)throw Error('CI_V2_INVALID_SUITE');
  ids.add(entry.id);files.add(entry.file);
 }
 const jobs=Array.from({length:backendShardCount},(_,i)=>({shard:i+1,estimated_seconds:0,files:[]}));
 for(const entry of [...entries].sort((a,b)=>b.estimated_seconds-a.estimated_seconds||a.id.localeCompare(b.id))){
  const job=[...jobs].sort((a,b)=>a.estimated_seconds-b.estimated_seconds||a.shard-b.shard)[0];
  job.files.push(entry.file);job.estimated_seconds+=entry.estimated_seconds;
 }
 if(jobs.some(job=>!job.files.length))throw Error('CI_V2_EMPTY_SHARD');
 return jobs;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const plan=backendPlan(),output=repoFile('.artifacts/ci-v2');fs.mkdirSync(output,{recursive:true});
 if(process.argv[2]==='plan'){
  fs.writeFileSync(path.join(output,'backend-plan.json'),JSON.stringify({kind:'shadow',acceptance:false,source:process.env.GITHUB_SHA,plan},null,2)+'\n');
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify({include:plan.map(({shard})=>({shard}))})+'\n');
  console.log('Twenty nonempty backend shards planned; estimated weights are not current measurements.');
 }else{
  const shard=process.argv[2];if(!/^(?:[1-9]|1[0-9]|20)$/.test(shard??''))throw Error('CI_V2_INVALID_SHARD');
  const job=plan.find(job=>String(job.shard)===shard);
  const result=spawnSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=spec','--test-reporter-destination=stdout',
   '--test-reporter=junit','--test-reporter-destination='+path.join(output,'backend-'+shard+'.junit.xml'),...job.files.map(file=>repoFile(file))],{cwd:backendRoot,stdio:'inherit'});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
 }
}
