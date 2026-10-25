import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {apiSuites} from './select-tests.mjs';
export const durations=JSON.parse(fs.readFileSync(new URL('./suite-durations.json',import.meta.url)));
const cache=new Map();
const suiteName=p=>p.replace(/^tests\//,'').replace(/\.test\.mjs$/,'');
const compare=(a,b)=>a<b?-1:a>b?1:0;
// Node's file runner queues explicit test files in lexical order, with the
// existing two process slots. Weight sums alone miss a long file queued late.
export function predictedWall(suites,seconds=durations.seconds){
 const slots=[0,0];
 for(const suite of [...suites].sort()){
  const i=slots[0]<=slots[1]?0:1;slots[i]+=seconds[suiteName(suite)];
 }
 return Math.max(...slots);
}
export function shardPlan(suites=apiSuites,seconds=durations.seconds){
 if(new Set(suites).size!==suites.length)throw Error('Duplicate API inventory');
 if(JSON.stringify([...suites].sort())!==JSON.stringify(Object.keys(seconds).map(n=>'tests/'+n+'.test.mjs').sort()))throw Error('Missing/unknown duration inventory; remeasure new suite');
 for(const suite of suites)if(!Number.isFinite(seconds[suiteName(suite)])||seconds[suiteName(suite)]<=0)throw Error('Invalid duration');
 const key=JSON.stringify([...suites].sort().map(p=>[p,seconds[suiteName(p)]]));
 if(cache.has(key))return structuredClone(cache.get(key));
 const ordered=[...suites].sort((a,b)=>seconds[suiteName(b)]-seconds[suiteName(a)]||compare(a,b));
 const bins=Array.from({length:4},(_,i)=>({shard:i+1,weight:0,suites:[]}));
 for(const suite of ordered){
  const bin=[...bins].sort((a,b)=>a.weight-b.weight||a.shard-b.shard)[0];
  bin.suites.push(suite);bin.weight+=seconds[suiteName(suite)];
 }
 const normalize=bs=>bs.map(b=>({...b,weight:Math.round(b.weight*100)/100,suites:[...b.suites].sort()}));
 const score=bs=>{
  const walls=bs.map(b=>predictedWall(b.suites,seconds));
  return [Math.max(...walls),Math.max(...walls)-Math.min(...walls),walls.reduce((a,b)=>a+b,0)];
 };
 const better=(a,b)=>{for(let i=0;i<a.length;i++){const delta=a[i]-b[i];if(Math.abs(delta)>0.000001)return delta<0;}return false;};
 let best=normalize(bins),bestScore=score(best);
 const total=bins.reduce((n,b)=>n+b.weight,0),upper=total/4*1.08,lower=total/4/1.08;
 const work=Array.from({length:4},(_,i)=>({shard:i+1,weight:0,suites:[]}));let visited=0;
 // Bounded by a node count, never wall clock: all runners compute the same plan.
 // LPT is the safe seed/fallback; search only improves it without relaxing the
 // existing measured-weight balance bound or changing suite/worker counts.
 const visit=i=>{
  if(++visited>250000)return;
  if(i===ordered.length){
   const weights=work.map(b=>b.weight);
   if(Math.min(...weights)<lower||Math.max(...weights)/Math.min(...weights)>=1.08)return;
   const candidate=normalize(work),value=score(candidate);
   if(better(value,bestScore)){best=candidate;bestScore=value;}
   return;
  }
  const suite=ordered[i],weight=seconds[suiteName(suite)];
  for(const bin of work){
   if(bin.weight+weight>upper)continue;
   const empty=bin.suites.length===0;bin.suites.push(suite);bin.weight+=weight;
   visit(i+1);bin.weight-=weight;bin.suites.pop();
   if(empty||visited>250000)break;
  }
 };
 visit(0);
 const flattened=best.flatMap(b=>b.suites);
 if(flattened.length!==suites.length||new Set(flattened).size!==suites.length||best.some(b=>!b.suites.length))throw Error('Incomplete shard inventory');
 cache.set(key,best);return structuredClone(best);
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
