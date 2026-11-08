import pg from 'pg';
import {isIP} from 'node:net';
import {sha256} from './restore-guard.mjs';
import {guardedRestore} from './guarded-restore.mjs';

const identifier=/^[a-z_][a-z0-9_]{0,62}$/;
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const qualified=t=>quote(t.schema)+'.'+quote(t.table);
const names=tables=>tables.map(t=>t.schema+'.'+t.table).sort().join(',');

// This is an isolated, data-only loader, never a hosted reset/SQL dump runner.
// Schema, roles, ACL/RLS, extensions and sequences must be provisioned separately.
export function validateRestoreTarget(connectionString,target){
 let url;try{url=new URL(connectionString);}catch{throw Error('ISOLATED_RESTORE_TARGET_REQUIRED');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.search||url.hash
  ||!target||!/^ftk_restore_[a-z0-9_]{1,40}$/.test(target.database)||decodeURIComponent(url.pathname.slice(1))!==target.database
  ||(target.server_address!==null&&(typeof target.server_address!=='string'||!isIP(target.server_address)))
  ||typeof target.system_identifier!=='string'||!/^\d+$/.test(target.system_identifier)||!Array.isArray(target.tables)||!target.tables.length
  ||target.tables.some(t=>!t||Object.keys(t).sort().join(',')!=='schema,table'||!identifier.test(t.schema)||!identifier.test(t.table)||['pg_catalog','information_schema','pg_toast'].includes(t.schema))
  ||new Set(target.tables.map(t=>t.schema+'.'+t.table)).size!==target.tables.length)throw Error('ISOLATED_RESTORE_TARGET_REQUIRED');
 return structuredClone(target);
}

export async function restorePostgresSnapshot({connectionString,target,readCheckpoint,...evidence}){
 const approved=validateRestoreTarget(connectionString,target);
 if(typeof readCheckpoint!=='function')throw Error('CURRENT_CHECKPOINT_REQUIRED');
 let client,observer,started=false,closed=false,gated=false,dataConnectionFailed=false,controlConnectionFailed=false,identity,gateState,closeGate;
 const end=async()=>{if(!closed){closed=true;try{if(client)await client.end();}finally{if(observer)await observer.end();}}};
 const transaction={
  async prepare(validated,proof,bytes){
   if(sha256(bytes)!==proof.snapshot_sha256)throw Error('SNAPSHOT_DIGEST_MISMATCH');
   // Keep exact numeric tokens, including bigint/decimal and nested JSON values.
   const snapshot=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes),(_key,value,context)=>typeof value==='number'?JSON.rawJSON(context.source):value);
   if(names(snapshot.tables)!==names(approved.tables))throw Error('RESTORE_TABLE_SET_MISMATCH');
   client=new pg.Client({connectionString,connectionTimeoutMillis:10000,query_timeout:30000});client.on('error',()=>{dataConnectionFailed=true;});await client.connect();
   identity=async()=>(await client.query(`select current_database() as database,
    (pg_catalog.pg_control_system()).system_identifier::text as system_identifier,
    host(inet_server_addr()) as address,pg_backend_pid() as pid, current_setting('session_replication_role') as replication_role,
    (select datallowconn from pg_database where datname=current_database()) as connections_allowed,
    (select count(*)::int from pg_stat_activity where datid=(select oid from pg_database where datname=current_database()) and pid<>pg_backend_pid()) as other_sessions`)).rows[0];
   const before=await identity();
   if(before.database!==approved.database||before.system_identifier!==approved.system_identifier||before.address!==approved.server_address||before.replication_role!=='origin')throw Error('RESTORE_TARGET_IDENTITY_MISMATCH');
   // Closing connections survives a data rollback and is never reversed here.
   // Recheck existing sessions after the gate closes to cover the connect race.
   const maintenance=new URL(connectionString);maintenance.pathname='/postgres';
   observer=new pg.Client({connectionString:maintenance.href,options:'-c default_transaction_read_only=on',connectionTimeoutMillis:10000,query_timeout:30000});observer.on('error',()=>{controlConnectionFailed=true;});await observer.connect();
   // A separate autocommit reader avoids SERIALIZABLE's stale catalog snapshot.
   gateState=async()=>{
    if(controlConnectionFailed)throw Error('RESTORE_CONTROL_CONNECTION_LOST');
    const state=(await observer.query(`select (pg_control_system()).system_identifier::text as system_identifier,host(inet_server_addr()) as address,
     (select datallowconn from pg_database where datname=$1) as connections_allowed,
     (select count(*)::int from pg_stat_activity where datname=$1 and pid<>$2) as other_sessions`,[approved.database,before.pid])).rows[0];
    if(state.system_identifier!==approved.system_identifier||state.address!==approved.server_address)throw Error('RESTORE_TARGET_IDENTITY_MISMATCH');
    return state;
   };
   // PostgreSQL forbids disabling connections from the target DB itself.
   // Validate the maintenance identity before its narrow gate-only write.
   closeGate=async()=>{
    await gateState();
    await observer.query('begin read write');
    try{
     await observer.query('alter database '+quote(approved.database)+' allow_connections false');
     await observer.query('commit');gated=true;
    }catch(error){await observer.query('rollback');throw error;}
   };
   await closeGate();
   if((await gateState()).other_sessions!==0)throw Error('RESTORE_TARGET_NOT_EXCLUSIVE');
   await client.query('begin isolation level serializable');started=true;
   await client.query("set local search_path='pg_catalog';set local row_security=off;set local lock_timeout='5s';set local statement_timeout='30s';set constraints all deferred");
   const tables=[...snapshot.tables].sort((a,b)=>qualified(a).localeCompare(qualified(b)));
   await client.query('lock table '+tables.map(qualified).join(',')+' in access exclusive mode');
   for(const t of tables){
    const meta=await client.query(`select c.relkind,a.attname,a.attgenerated,a.attidentity from pg_class c
     join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
     where n.nspname=$1 and c.relname=$2 and a.attnum>0 and not a.attisdropped order by a.attnum`,[t.schema,t.table]);
    if(!meta.rows.length||meta.rows.some(r=>r.relkind!=='r'||r.attgenerated||r.attidentity))throw Error('RESTORE_UNSUPPORTED_TABLE');
    const sideEffects=(await client.query(`select exists(select 1 from pg_trigger where tgrelid=$1::regclass and not tgisinternal)
     or exists(select 1 from pg_inherits where inhrelid=$1::regclass or inhparent=$1::regclass)
     or exists(select 1 from pg_rewrite where ev_class=$1::regclass) as present`,[qualified(t)])).rows[0].present;
    if(sideEffects)throw Error('RESTORE_UNSUPPORTED_SIDE_EFFECTS');
    const columns=meta.rows.map(r=>r.attname),expected=JSON.stringify([...columns].sort());
    if(t.rows.some(r=>JSON.stringify(Object.keys(r).sort())!==expected))throw Error('RESTORE_COLUMN_SET_MISMATCH');
    if((await client.query('select exists(select 1 from '+qualified(t)+') as populated')).rows[0].populated)throw Error('RESTORE_TARGET_NOT_EMPTY');
   }
   // Keep snapshot dependency order; immediate FKs/triggers are never disabled.
   for(const t of snapshot.tables){
    if(t.rows.length)await client.query('insert into '+qualified(t)+' select * from jsonb_populate_recordset(null::'+qualified(t)+',$1::jsonb)',[JSON.stringify(t.rows)]);
   }
   await client.query('set constraints all immediate');
   for(const t of snapshot.tables){
    const equal=(await client.query(`with expected as (select to_jsonb(r) as row from jsonb_populate_recordset(null::${qualified(t)},$1::jsonb) r),
     actual as (select to_jsonb(r) as row from ${qualified(t)} r)
     select not exists((select * from expected except all select * from actual) union all (select * from actual except all select * from expected)) as equal`,[JSON.stringify(t.rows)])).rows[0].equal;
    if(!equal)throw Error('RESTORE_READBACK_MISMATCH');
   }
   const after=await gateState();
   if(after.connections_allowed||after.other_sessions!==0)throw Error('RESTORE_TARGET_GATE_CHANGED');
  },
  async commit(){
   if(dataConnectionFailed)throw Error('RESTORE_DATA_CONNECTION_LOST');
   const state=await gateState();
   if(state.connections_allowed||state.other_sessions!==0)throw Error('RESTORE_TARGET_GATE_CHANGED');
   await client.query('commit');started=false;
  },
  async rollback(){
   let rollbackFailed=false;
   try{if(started)await client.query('rollback');}
   catch{rollbackFailed=true;}
   finally{
    started=false;
    // A dead data socket must never skip the independent maintenance fence.
    try{if(gated)await closeGate();}finally{await end();}
   }
   if(rollbackFailed)throw Error('RESTORE_DATA_ROLLBACK_FAILED');
  }
 };
 try{
  const result=await guardedRestore({...evidence,readCheckpoint,transaction});
  return{...result,result:'isolated_postgres_rows_restored',target_database:approved.database,scope:'data rows only; database connection gate remains closed; schema/Auth login/Storage/config/workers and full recovery acceptance remain separate'};
 }catch(error){
  // Provider messages/detail/query/cause may include complete failing rows.
  const safe=/^(?:RESTORE_[A-Z_]+|ISOLATED_RESTORE_TARGET_REQUIRED|CURRENT_CHECKPOINT_[A-Z_]+|ERASED_SUBJECT_PRESENT|SNAPSHOT_[A-Z_]+|LEDGER_[A-Z_]+|INVALID_[A-Z_]+|FUTURE_LEDGER|REGISTER_[A-Z_]+)$/.test(error.message)?error.message:'POSTGRES_RESTORE_FAILED';
  const sanitized=new Error(safe);
  if(typeof error.code==='string'&&/^[0-9A-Z]{5}$/.test(error.code))sanitized.sqlstate=error.code;
  throw sanitized;
 }finally{await end();}
}
