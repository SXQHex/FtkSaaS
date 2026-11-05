import {repoFile,ciFile,backendArtifact} from './paths.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {spawnSync,execFileSync} from 'node:child_process';
import {acceptancePlan,coverageHash,acceptanceProfile} from './ci/shards.mjs';
import {buildInventory,materialize,executionPhases} from './ci/api-suites.mjs';
import {scheduledPlan} from './ci/duration-reference.mjs';
import path from 'node:path';
import {stackStatus,connect} from './db.mjs';
function run(command,args,options={}) {
 const r=spawnSync(command,args,{stdio:'inherit',...options});
 if(r.error)throw r.error;
 if(r.status!==0)throw new Error('CLEAN_ACCEPTANCE_STEP_FAILED: '+command+' '+args.join(' '));
}
const args=process.argv.slice(2),role=args[0]??'serial';
if(!['serial','core','api'].includes(role)||args.length>(role==='api'?2:1))throw Error('Unknown clean role/arguments');
const binding=process.env.FTK_CI_BINDING?JSON.parse(process.env.FTK_CI_BINDING):null;
if(role==='api'&&process.env.GITHUB_ACTIONS==='true'){
 assert.equal(binding?.profile,acceptanceProfile);assert.equal(binding.coverage,coverageHash(acceptanceProfile));
 assert.equal(String(binding.run_id),process.env.GITHUB_RUN_ID);
 assert.equal(binding.merge,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
}
const plan=binding?scheduledPlan(buildInventory(repoFile()).units,binding.schedule):acceptancePlan();
const shard=role==='api'?plan.find(b=>String(b.shard)===args[1]):null;
if(role==='api'&&!shard)throw Error('Unknown shard');
console.log('Supabase CLI:',execFileSync('node_modules/.bin/supabase',['--version'],{encoding:'utf8'}).trim());
console.log('Clean coverage:',coverageHash(acceptanceProfile),'role:',role,'shard:',shard?.shard??'none');
const phaseStart=performance.now();
run('pnpm',['run','dev:start']);
const startDone=performance.now();
const startTiming=JSON.parse(fs.readFileSync('.dev/start-timings.json','utf8'));
const url=stackStatus().env?.DB_URL;
if(!url||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw new Error('LOCAL_DB_REQUIRED');
fs.mkdirSync('.dev',{recursive:true,mode:0o700});
const fd=fs.openSync('.dev/clean-reset.log','w',0o600);
const resetStart=performance.now();
try { run('node_modules/.bin/supabase',['db','reset','--no-seed','--yes'],{stdio:['ignore',fd,fd]}); }
finally { fs.closeSync(fd); }
const resetDone=performance.now();
await import('./wait-local.mjs');
const readyAt=performance.now();
const db=await connect();
try {
 const expected=Object.keys(JSON.parse(fs.readFileSync('database/migrations.sha256.json'))).map(x=>x.split('_')[0]).sort();
 const actual=(await db.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(x=>x.version);
 assert.deepEqual(actual,expected);
 for(const table of ['core.organizations','core.operation_receipts','auth.users'])assert.equal((await db.query('select count(*)::int n from '+table)).rows[0].n,0,'Reset must remove fixture data: '+table);
 console.log('Clean database confirmed: '+actual.length+' ordered migrations; no organizations, receipts or Auth users');
} finally { await db.end(); }
const preparedAt=performance.now();
// Capture pristine migration metadata before tests/fixtures can create objects.
if(role==='core')run('node',['scripts/capture-docs.mjs','--local']);
if(role!=='api'){
 run('node',['scripts/ci/docs-check.mjs',repoFile('README.md')]);
 run('pnpm',['--dir',repoFile(),'exec','turbo','run','verify','--filter=@ftksaas/backend...']);
 run('pnpm',['run','test:db']);
}
if(role!=='core'){
 const inventory=buildInventory(repoFile()),units=shard?.units??inventory.units;
 const timingDirectory=path.join(ciFile('api-tests'),'process-wall');
 fs.rmSync(timingDirectory,{recursive:true,force:true});
 fs.mkdirSync(ciFile('api-tests'),{recursive:true});
 for(const [index,phase] of executionPhases(units).entries()){
  const files=materialize({...inventory,units:phase.units},path.join(ciFile('api-tests'),String(index)),{timingDirectory:process.env.FTK_TEST_TIMINGS==='1'?timingDirectory:undefined});
  run('node',['--test','--test-concurrency='+phase.concurrency,'--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter='+new URL('./ci/timing-reporter.mjs',import.meta.url).pathname,'--test-reporter-destination='+ciFile('api-tests','tests-'+index+'.jsonl'),...files]);
 }
 if(binding&&shard){
  try{
   const samples=units.map(u=>JSON.parse(fs.readFileSync(path.join(timingDirectory,u.id+'.json'))));
   fs.writeFileSync(ciFile('api-tests','unit-durations.json'),JSON.stringify({role:'api-'+shard.shard,run_id:binding.run_id,head:binding.head,merge:binding.merge,attempt:Number(process.env.GITHUB_RUN_ATTEMPT),schedule:binding.schedule.sha256,units:samples}));
  }catch{console.warn('API unit process timings incomplete; no next-run reference for this shard');}
 }
}
const testsAt=performance.now();
if(role!=='api'){
run('pnpm',['run','dev:seed']);
run('pnpm',['run','dev:health']);
run('pnpm',['run','db:advisors']);
// Parsing the written report also catches invalid JSON serialization.
const report=JSON.parse(fs.readFileSync(backendArtifact('environment.json'),'utf8'));
assert(report.checks.every(x=>x.passed));
console.log('Clean acceptance completed: migrations, tests, synthetic seed and service health');

}
console.log('Completed clean role:',role,shard?.shard??'',coverageHash(acceptanceProfile));

const phases={role,shard:shard?.shard??null,coverage:coverageHash(acceptanceProfile),backend_setup_s:(preparedAt-phaseStart)/1000,setup:{...startTiming,start_command_s:(startDone-phaseStart)/1000,reset_migrations_s:(resetDone-resetStart)/1000,post_reset_readiness_s:(readyAt-resetDone)/1000,empty_database_verification_s:(preparedAt-readyAt)/1000},tests_s:(testsAt-preparedAt)/1000,seed_health_advisors_s:(performance.now()-testsAt)/1000};
fs.mkdirSync(ciFile('timings'),{recursive:true});fs.writeFileSync(ciFile('timings','clean-'+role+(shard?.shard??'')+'.json'),JSON.stringify({clean_phases:phases}));
console.log('Clean phase timings:',JSON.stringify(phases));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\nClean phase timings (backend setup separate from tests):\n```json\n'+JSON.stringify(phases,null,2)+'\n```\n');
