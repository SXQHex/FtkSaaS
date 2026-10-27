import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {spawnSync,execFileSync} from 'node:child_process';
import {apiSuites} from './ci/select-tests.mjs';
import {shardPlan,coverageHash} from './ci/shards.mjs';
import {stackStatus,connect} from './db.mjs';
function run(command,args,options={}) {
 const r=spawnSync(command,args,{stdio:'inherit',...options});
 if(r.error)throw r.error;
 if(r.status!==0)throw new Error('CLEAN_ACCEPTANCE_STEP_FAILED: '+command+' '+args.join(' '));
}
const args=process.argv.slice(2),role=args[0]??'serial';
if(!['serial','core','api'].includes(role)||args.length>(role==='api'?2:1))throw Error('Unknown clean role/arguments');
const shard=role==='api'?shardPlan().find(b=>String(b.shard)===args[1]):null;
if(role==='api'&&!shard)throw Error('Unknown shard');
console.log('Supabase CLI:',execFileSync('node_modules/.bin/supabase',['--version'],{encoding:'utf8'}).trim());
console.log('Clean coverage:',coverageHash(),'role:',role,'shard:',shard?.shard??'none');
const phaseStart=performance.now();
run('pnpm',['run','dev:start']);
const url=stackStatus().env?.DB_URL;
if(!url||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw new Error('LOCAL_DB_REQUIRED');
fs.mkdirSync('.dev',{recursive:true,mode:0o700});
const fd=fs.openSync('.dev/clean-reset.log','w',0o600);
try { run('node_modules/.bin/supabase',['db','reset','--local','--no-seed','--yes'],{stdio:['ignore',fd,fd]}); }
finally { fs.closeSync(fd); }
await import('./wait-local.mjs');
const db=await connect();
try {
 const expected=Object.keys(JSON.parse(fs.readFileSync('database/migrations.sha256.json'))).map(x=>x.split('_')[0]).sort();
 const actual=(await db.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(x=>x.version);
 assert.deepEqual(actual,expected);
 for(const table of ['core.organizations','core.operation_receipts','auth.users'])assert.equal((await db.query('select count(*)::int n from '+table)).rows[0].n,0,'Reset must remove fixture data: '+table);
 console.log('Clean database confirmed: '+actual.length+' ordered migrations; no organizations, receipts or Auth users');
} finally { await db.end(); }
const preparedAt=performance.now();
if(role!=='api'){
 run('node',['scripts/ci/docs-check.mjs','README.md']);
 run('pnpm',['run','verify']);
 run('pnpm',['run','test:db']);
}
if(role!=='core')run('node',['--test','--test-concurrency=2',...(shard?.suites??apiSuites)]);
const testsAt=performance.now();
if(role!=='api'){
run('pnpm',['run','dev:seed']);
run('pnpm',['run','dev:health']);
run('pnpm',['run','db:advisors']);
// Parsing the written report also catches invalid JSON serialization.
const report=JSON.parse(fs.readFileSync('reports/environment.json','utf8'));
assert(report.checks.every(x=>x.passed));
console.log('Clean acceptance completed: migrations, tests, synthetic seed and service health');

}
console.log('Completed clean role:',role,shard?.shard??'',coverageHash());

const phases={role,shard:shard?.shard??null,coverage:coverageHash(),backend_setup_s:(preparedAt-phaseStart)/1000,tests_s:(testsAt-preparedAt)/1000,seed_health_advisors_s:(performance.now()-testsAt)/1000};
fs.mkdirSync('.ci/timings',{recursive:true});fs.writeFileSync('.ci/timings/clean-'+role+(shard?.shard??'')+'.json',JSON.stringify({clean_phases:phases}));
console.log('Clean phase timings:',JSON.stringify(phases));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\nClean phase timings (backend setup separate from tests):\n```json\n'+JSON.stringify(phases,null,2)+'\n```\n');
