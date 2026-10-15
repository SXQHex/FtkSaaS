import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {stackStatus,connect} from './db.mjs';
function run(command,args,options={}) {
 const r=spawnSync(command,args,{stdio:'inherit',...options});
 if(r.error)throw r.error;
 if(r.status!==0)throw new Error('CLEAN_ACCEPTANCE_STEP_FAILED: '+command+' '+args.join(' '));
}
run('npm',['run','dev:start']);
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
run('npm',['test']);
run('npm',['run','dev:seed']);
run('npm',['run','dev:health']);
// Parsing the written report also catches invalid JSON serialization.
const report=JSON.parse(fs.readFileSync('reports/environment.json','utf8'));
assert(report.checks.every(x=>x.passed));
console.log('Clean acceptance completed: migrations, tests, synthetic seed and service health');
