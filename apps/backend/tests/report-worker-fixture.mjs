import pg from 'pg';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
// A tenant-scoped real native worker login; never a service-role worker shortcut.
export async function reportWorker(t,db,org){
 const role='report_discovery_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');
 await db.query(`create role "${role}" login password '${password}'`);await db.query(`grant ftk_p06_worker to "${role}"`);await db.query('insert into private.p06_worker_scopes values($1,$2)',[role,org]);
 const url=new URL(context().env.DB_URL);url.username=role;url.password=password;const worker=new pg.Client({connectionString:url.href});await worker.connect();
 t.after(async()=>{try{await worker.end();await db.query('delete from private.p06_worker_scopes where db_role=$1',[role]);await db.query(`drop role "${role}"`);}finally{await db.end();}});
 const bank=()=>Array.from({length:4096},key);
 return {async drain(){for(let i=0;i<10;i++){const jobs=(await worker.query('select private.p06_jobs_claim($1,$2,10) jobs',[org,bank()])).rows[0].jobs;if(!jobs.length)return;for(const j of jobs){const result=(await worker.query('select private.p06_worker_execute($1,$2,$3) result',[j.operation,j.request,bank()])).rows[0].result;assert.equal(result.ok,true,JSON.stringify(result));}}throw Error('Native report worker did not drain within fixture bound');}};
}
