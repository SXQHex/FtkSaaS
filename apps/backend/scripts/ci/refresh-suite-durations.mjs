// Explicit maintenance utility: input is a preserved, source-bound successful
// main run + its attempt-specific jobs + decoded API job logs. No auto updates.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {apiSuites} from './select-tests.mjs';
import {validateJobs,roleName} from './shards.mjs';
export function durationSnapshot({run,jobs,logs}){
 if(run?.status!=='completed'||run.conclusion!=='success'||run.name!=='Main clean acceptance'||run.event!=='push'||run.head_branch!=='main'||!/^[a-f0-9]{40}$/.test(run.head_sha)||!Number.isSafeInteger(run.id)||!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1)throw Error('Successful exact-source main run required');
 validateJobs(jobs,run,{collector:true});
 const seconds={},jobIds=[],versions=new Set();
 for(const job of jobs.filter(j=>/^api-[1-4]$/.test(roleName(j))).sort((a,b)=>roleName(a).localeCompare(roleName(b)))){
  const raw=logs?.[job.id];if(typeof raw!=='string')throw Error('Missing decoded job log: '+job.id);
  const text=raw.replace(/^\d{4}-\S+ /gm,'');
  const phaseLines=[...text.matchAll(/^Clean phase timings: (\{[^\n]+\})/gm)];
  if(phaseLines.length!==1)throw Error('Missing/duplicate clean measurement: '+job.id);
  const phase=JSON.parse(phaseLines[0][1]);
  if(phase.role!=='api'||phase.shard!==Number(roleName(job).slice(-1))||!Number.isFinite(phase.tests_s)||phase.tests_s<=0)throw Error('Wrong shard measurement');
  const semver='\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?';
  const seen=new Set([...text.matchAll(new RegExp('^Supabase CLI: ('+semver+')$','gm')),...text.matchAll(new RegExp('currently installed v('+semver+')(?=[)\\s])','g'))].map(m=>m[1]));
  if(!seen.size)throw Error('Missing measured CLI version');if(seen.size!==1)throw Error('Mixed measured CLI versions in one job');
  versions.add([...seen][0]);jobIds.push(job.id);
  for(const m of text.matchAll(/^### ([\w-]+)\.test\.mjs\r?\n\r?\nProcess wall: ([\d.]+) s/gm)){
   const value=Number(m[2]);if(!Number.isFinite(value)||value<=0||Object.hasOwn(seconds,m[1]))throw Error('Invalid/duplicate suite measurement: '+m[1]);seconds[m[1]]=value;
  }
 }
 if(versions.size!==1)throw Error('Mixed measured CLI versions');
 if(JSON.stringify(Object.keys(seconds).map(n=>'apps/backend/tests/'+n+'.test.mjs').sort())!==JSON.stringify([...apiSuites].sort()))throw Error('Missing/unknown measured suite; every API suite must be measured');
 return {source:run.head_sha,run_id:run.id,run_attempt:run.run_attempt,cli_version:[...versions][0],kind:'measured suite process wall seconds from successful main job summaries; overlapping at concurrency=2, not additive wall time',job_ids:jobIds,seconds:Object.fromEntries(Object.entries(seconds).sort())};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [bundle,mode]=process.argv.slice(2);if(!bundle||!['--write',undefined].includes(mode)||process.argv.length>4)throw Error('Usage: node scripts/ci/refresh-suite-durations.mjs bundle.json [--write]');
 const result=JSON.stringify(durationSnapshot(JSON.parse(fs.readFileSync(bundle,'utf8'))),null,2)+'\n';
 if(mode==='--write')fs.writeFileSync('scripts/ci/suite-durations.json',result);else process.stdout.write(result);
}
