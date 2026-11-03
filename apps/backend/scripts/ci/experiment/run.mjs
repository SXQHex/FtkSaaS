import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {buildInventory,partition,materialize,executionPhases} from './suites.mjs';

const [root,mode,shardText]=process.argv.slice(2);
if(!root||!path.isAbsolute(root)||!['plan','api'].includes(mode))throw Error('Absolute source root and experiment mode required');
const inventory=buildInventory(root),bins=partition(inventory.units);
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const reference=JSON.parse(process.env.EXPERIMENT_REFERENCE??'null');
if(!reference||git('rev-parse','HEAD')!==reference.merge||git('rev-parse','HEAD^{tree}')!==reference.tree)throw Error('Experiment source mismatch');
const output=path.join(root,'.artifacts/ci/experiment');fs.mkdirSync(output,{recursive:true});
const plan={kind:'measurement-only',test_timeout:'unlimited',job_timeout_minutes:90,reference,originals:inventory.originals,splitOriginals:inventory.splitOriginals,units:inventory.units.length,bins:bins.map(b=>({shard:b.shard,estimated_seconds:b.estimated_seconds,projected_wall_seconds:b.projected_wall_seconds,units:b.units.map(u=>({id:u.id,source:u.source,exclusive:u.exclusive,weight_source:u.weight_source}))})),note:'Source-bound completed process-wall samples guide scheduling; unmatched samples use source-size seeds. Projected wall includes serial fixtures and two parallel lanes, not a speed claim. Test registration timeout is Infinity only in the experiment; request/SQL deadlines and assertions are unchanged. Not equivalent timeout acceptance to baseline.'};
fs.writeFileSync(path.join(output,'plan.json'),JSON.stringify(plan,null,2)+'\n');
if(mode==='api'){
 const bin=bins.find(b=>String(b.shard)===shardText);if(!bin)throw Error('Invalid experiment shard');
 const cwd=path.join(root,'apps/backend');
 const run=(args)=>{const r=spawnSync(process.execPath,args,{cwd,stdio:'inherit'});if(r.error||r.status!==0)throw Error('Experimental clean step failed: '+args[0]);};
 const before=performance.now();
 run(['scripts/start-dev.mjs']);
 // Reuse the existing isolated migration/empty Auth/tenant/receipt verifier.
 run(['scripts/ci/reset-local.mjs']);
 const prepared=performance.now();
 let phaseIndex=0;
 for(const phase of executionPhases(bin.units)){
  const files=materialize({...inventory,units:phase.units},path.join(cwd,'.artifacts/eight-shard'),{measurement:true});
  const reporter=new URL('./timing-reporter.mjs',import.meta.url).pathname;
  run(['--test','--test-concurrency='+phase.concurrency,'--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter='+reporter,'--test-reporter-destination='+path.join(output,'tests-'+bin.shard+'-'+(++phaseIndex)+'.jsonl'),...files]);
 }
 const timings={reference,shard:bin.shard,setup_s:(prepared-before)/1000,tests_s:(performance.now()-prepared)/1000,units:bin.units.map(u=>u.id)};
 fs.writeFileSync(path.join(output,'shard-'+bin.shard+'.json'),JSON.stringify(timings,null,2)+'\n');
 console.log('Experimental shard timings:',JSON.stringify(timings));
}else console.log(JSON.stringify(plan,null,2));
