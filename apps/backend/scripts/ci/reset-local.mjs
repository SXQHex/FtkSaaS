import fs from 'node:fs';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {stackStatus,connect} from '../db.mjs';
const url=stackStatus().env?.DB_URL;if(!url||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('LOCAL_DB_REQUIRED');
fs.mkdirSync('.dev',{recursive:true,mode:0o700});const fd=fs.openSync('.dev/targeted-reset.log','w',0o600);
try{const r=spawnSync('node_modules/.bin/supabase',['db','reset','--local','--no-seed','--yes'],{stdio:['ignore',fd,fd]});if(r.error||r.status!==0)throw Error('TARGETED_RESET_FAILED');}finally{fs.closeSync(fd);}
await import('../wait-local.mjs');const db=await connect();try{
 const expected=Object.keys(JSON.parse(fs.readFileSync('database/migrations.sha256.json'))).map(x=>x.split('_')[0]).sort();
 assert.deepEqual((await db.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(x=>x.version),expected);
 for(const t of ['core.organizations','core.operation_receipts','auth.users'])assert.equal((await db.query('select count(*)::int n from '+t)).rows[0].n,0,t);
 console.log('Targeted isolated DB verified:',expected.length,'migrations; no tenant/Auth/receipt residue');
}finally{await db.end();}
