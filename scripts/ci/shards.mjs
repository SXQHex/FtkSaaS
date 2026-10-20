import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {apiSuites} from './select-tests.mjs';
export const durations=JSON.parse(fs.readFileSync(new URL('./suite-durations.json',import.meta.url)));
export function shardPlan(suites=apiSuites,seconds=durations.seconds){
 if(new Set(suites).size!==suites.length)throw Error('Duplicate API inventory');
 if(JSON.stringify([...suites].sort())!==JSON.stringify(Object.keys(seconds).map(n=>'tests/'+n+'.test.mjs').sort()))throw Error('Missing/unknown duration inventory; remeasure new suite');
 const bins=Array.from({length:4},(_,i)=>({shard:i+1,weight:0,suites:[]}));
 const name=p=>p.replace(/^tests\//,'').replace(/\.test\.mjs$/,'');
 for(const suite of [...suites].sort((a,b)=>seconds[name(b)]-seconds[name(a)]||a.localeCompare(b))){
  const weight=seconds[name(suite)];if(!Number.isFinite(weight)||weight<=0)throw Error('Invalid duration');
  const bin=[...bins].sort((a,b)=>a.weight-b.weight||a.shard-b.shard)[0];
  bin.suites.push(suite);bin.weight+=weight;
 }
 const flattened=bins.flatMap(b=>b.suites);
 if(flattened.length!==suites.length||new Set(flattened).size!==suites.length||bins.some(b=>!b.suites.length))throw Error('Incomplete shard inventory');
 return bins;
}
export function coverageHash(){return createHash('sha256').update(JSON.stringify({api:[...apiSuites].sort(),plan:shardPlan(),core:['verify','test:db','dev:seed','dev:health','db:advisors'],reset:'34-or-current-manifest; empty auth/tenant/receipts per runner',concurrency:2})).digest('hex');}
export const roleName=j=>j.name.split(' / ').at(-1);
export function validateJobs(jobs,run,{benchmark=false,collector=false}={}){
 const names=['core','api-1','api-2','api-3','api-4',...(benchmark?['serial-reference']:[]),...(collector?['full-clean']:[])];
 for(const name of names){
  const matches=jobs.filter(j=>roleName(j)===name);
  if(matches.length!==1)throw Error('Missing/duplicate required job: '+name);
  const j=matches[0];
  if(j.conclusion!=='success'||j.status!=='completed'||j.run_id!==run.id||j.run_attempt!==run.run_attempt||j.head_sha!==run.head_sha)throw Error('Failed/skipped/cancelled/stale job: '+name);
  const step=name==='full-clean'?'Verify all required jobs':'Clean acceptance';
  if(!j.steps?.some(s=>s.name===step&&s.conclusion==='success'))throw Error('Unexecuted acceptance step: '+name);
 }
 return true;
}
