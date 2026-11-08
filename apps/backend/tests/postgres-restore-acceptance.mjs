import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {connect,stackStatus} from '../scripts/db.mjs';
import {restorePostgresSnapshot} from '../scripts/postgres-restore.mjs';
import {canonical,sha256} from '../scripts/restore-guard.mjs';

// Real isolated databases on the existing loopback CI PostgreSQL. No hosted URL,
// reset, service key, constraint bypass, provider or mocked SQL connection.
test('guarded PostgreSQL recovery retains atomic rows and a closed connection gate',async t=>{
 const admin=await connect(),rootUrl=new URL(stackStatus().env.DB_URL);
 const source=(await admin.query('select (pg_control_system()).system_identifier::text as id,host(inet_server_addr()) as address')).rows[0],system=source.id;
 const {privateKey,publicKey}=generateKeyPairSync('ed25519'),pem=publicKey.export({type:'spki',format:'pem'});
 const erased=randomUUID(),subject=randomUUID(),request=randomUUID();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'postgres-restore-'));
 const proof=(tables)=>{
  const now=new Date().toISOString(),payload={format:1,source_project_ref:'abcdefghijklmnopqrst',sequence:1,issued_at:now,erasures:[{request_id:request,kind:'account',subject_ids:[erased],completed_at:now}]};
  const ledgerBytes=Buffer.from(JSON.stringify({...payload,signature:sign(null,Buffer.from(canonical(payload)),privateKey).toString('base64')}));
  const snapshotBytes=Buffer.from(JSON.stringify({project_ref:payload.source_project_ref,tables})),registerFile=path.join(dir,randomUUID()+'.json');fs.writeFileSync(registerFile,ledgerBytes,{mode:0o600});
  const trust={format:1,source_project_ref:payload.source_project_ref,snapshot_sha256:sha256(snapshotBytes),ledger_sha256:sha256(ledgerBytes),ledger_sequence:1,ledger_public_key_pem:pem};
  return{snapshotBytes,registerFile,trust,readCheckpoint:async()=>structuredClone(trust)};
 };
 const tables=()=>[{schema:'recovery',table:'parents',rows:[{id:subject,label:'Synthetic recovery',payload:{amount:'9007199254740993'}}]},
  {schema:'recovery',table:'children',rows:[{id:randomUUID(),parent_id:subject,value:7,large:JSON.rawJSON('9007199254740993'),precise:JSON.rawJSON('0.10000000000000001')}]}];
 const withTarget=async run=>{
  const database='ftk_restore_'+randomUUID().replaceAll('-',''),url=new URL(rootUrl);url.pathname='/'+database;
  await admin.query('create database "'+database+'"');
  const target={database,system_identifier:system,server_address:source.address,tables:[{schema:'recovery',table:'parents'},{schema:'recovery',table:'children'}]};
  const inspect=async sql=>{
   // Only the acceptance harness explicitly opens its throwaway target for readback.
   await admin.query('alter database "'+database+'" allow_connections true');
   const c=new pg.Client({connectionString:url.href});await c.connect();try{return await c.query(sql);}finally{await c.end();}
  };
  try{
   await inspect(`create schema recovery;create table recovery.parents(id uuid primary key,label text not null check(label<>'PRIVATE_SENTINEL_DO_NOT_EXPOSE'),payload jsonb not null);
    alter table recovery.parents enable row level security;
    create table recovery.children(id uuid primary key,parent_id uuid not null references recovery.parents(id) deferrable initially deferred,value integer not null check(value>0),large bigint not null,precise numeric not null);`);
   const load=(rows,extra={})=>restorePostgresSnapshot({...proof(rows),connectionString:url.href,target,...extra});
   const gate=async()=>(await admin.query('select datallowconn from pg_database where datname=$1',[database])).rows[0].datallowconn;
   await run({database,url,target,load,gate,inspect});
  }finally{
   await admin.query('drop database "'+database+'"');
  }
 };
 try{
  await t.test('commit restores exact typed rows, RLS and ACL remain unchanged, new connections stay blocked',()=>withTarget(async({load,gate,inspect,url})=>{
   const securitySQL="select relname,relrowsecurity,relacl::text from pg_class where relnamespace='recovery'::regnamespace order by relname";
   const before=(await inspect(securitySQL)).rows,rows=tables(),result=await load(rows);
   assert.equal(result.result,'isolated_postgres_rows_restored');assert.equal(await gate(),false);
   const denied=new pg.Client({connectionString:url.href});try{await assert.rejects(denied.connect(),e=>e.code==='55000');}finally{await denied.end();}
   assert.deepEqual((await inspect('select id,label,payload from recovery.parents')).rows,rows[0].rows);
   assert.deepEqual((await inspect(securitySQL)).rows,before);
   assert.deepEqual((await inspect('select large::text,precise::text from recovery.children')).rows,[{large:'9007199254740993',precise:'0.10000000000000001'}]);
  }));
  await t.test('late deferred foreign key failure rolls back all earlier inserts',()=>withTarget(async({load,gate,inspect})=>{
   const rows=tables();rows[1].rows[0].parent_id=randomUUID();
   await assert.rejects(load(rows),e=>e.message==='POSTGRES_RESTORE_FAILED'&&e.sqlstate==='23503');assert.equal(await gate(),false);
   assert.equal((await inspect('select count(*)::int as n from recovery.parents')).rows[0].n,0);
   assert.equal((await inspect('select count(*)::int as n from recovery.children')).rows[0].n,0);
  }));
  await t.test('current checkpoint advances after preparation and causes complete rollback',()=>withTarget(async({load,gate,inspect})=>{
   let reads=0;
   const rows=tables(),evidence=proof(rows);
   await assert.rejects(load(rows,{...evidence,readCheckpoint:async()=>({...evidence.trust,ledger_sequence:++reads===1?1:2})}),/CURRENT_CHECKPOINT_CHANGED/);
   assert.equal(reads,2);assert.equal(await gate(),false);
   assert.equal((await inspect('select count(*)::int as n from recovery.parents')).rows[0].n,0);
  }));
  await t.test('nonempty target is preserved without merging or truncating it',()=>withTarget(async({load,gate,inspect})=>{
   await inspect("insert into recovery.parents values ('"+randomUUID()+"','Existing synthetic','{}')");
   await assert.rejects(load(tables()),/RESTORE_TARGET_NOT_EMPTY/);assert.equal(await gate(),false);
   assert.equal((await inspect('select label from recovery.parents')).rows[0].label,'Existing synthetic');
  }));
  await t.test('erased subject and wrong target instance prevent any row load',()=>withTarget(async({load,inspect,target})=>{
   const unsafe=tables();unsafe[0].rows[0].id=erased;
   await assert.rejects(load(unsafe),/ERASED_SUBJECT_PRESENT/);
   await assert.rejects(load(tables(),{target:{...target,system_identifier:system+'0'}}),/RESTORE_TARGET_IDENTITY_MISMATCH/);
   await assert.rejects(load(tables(),{target:{...target,server_address:source.address==='127.0.0.1'?'127.0.0.2':'127.0.0.1'}}),/RESTORE_TARGET_IDENTITY_MISMATCH/);
   assert.equal((await inspect('select count(*)::int as n from recovery.parents')).rows[0].n,0);
  }));
  await t.test('column drift and trigger side effects cannot silently change the snapshot',()=>withTarget(async({load,gate,inspect})=>{
   const malformed=tables();malformed[0].rows[0].unrecognized='must fail';
   await assert.rejects(load(malformed),/RESTORE_COLUMN_SET_MISMATCH/);assert.equal(await gate(),false);
   await inspect(`create function recovery.change_label() returns trigger language plpgsql as $$begin NEW.label:='Changed';return NEW;end$$;
    create trigger change_label before insert on recovery.parents for each row execute function recovery.change_label();`);
   await assert.rejects(load(tables()),/RESTORE_UNSUPPORTED_SIDE_EFFECTS/);assert.equal(await gate(),false);
   assert.equal((await inspect('select count(*)::int as n from recovery.parents')).rows[0].n,0);
  }));
  await t.test('constraint errors expose no row-bearing provider detail',()=>withTarget(async({load,inspect})=>{
   const rows=tables();rows[0].rows[0].label='PRIVATE_SENTINEL_DO_NOT_EXPOSE';rows[1].rows[0].value=-1;
   await assert.rejects(load(rows),e=>{assert.equal(e.message,'POSTGRES_RESTORE_FAILED');assert.equal(e.sqlstate,'23514');assert(!String(e.stack).includes('PRIVATE_SENTINEL'));assert.equal(e.cause,undefined);assert.equal(e.detail,undefined);return true;});
   assert.equal((await inspect('select count(*)::int as n from recovery.parents')).rows[0].n,0);
  }));
  await t.test('RLS-hidden preexisting rows cannot be treated as an empty target',()=>withTarget(async({load,gate,inspect,database,url})=>{
   const role='ftk_restore_role_'+randomUUID().replaceAll('-',''),password=randomUUID();
   await admin.query('create role "'+role+'" login password \''+password+'\'');
   let setupComplete=false,ownerChanged=false;
   try{
    await admin.query('grant "'+role+'" to current_user with inherit true,set true');
    await admin.query('grant execute on function pg_control_system() to "'+role+'"');
    await admin.query('alter database "'+database+'" owner to "'+role+'"');ownerChanged=true;
    await inspect(`grant execute on function pg_control_system() to "${role}";insert into recovery.parents values ('${randomUUID()}','Hidden','{}');
     grant usage on schema recovery to "${role}";grant all on all tables in schema recovery to "${role}";
     create policy visible on recovery.parents to "${role}" using (label='Visible') with check (label='Visible');`);setupComplete=true;
    const restricted=new URL(url);restricted.username=role;restricted.password=password;
    await assert.rejects(load(tables(),{connectionString:restricted.href}),e=>e.message==='POSTGRES_RESTORE_FAILED'&&e.sqlstate==='42501');
    assert.equal(await gate(),false);
    assert.deepEqual((await inspect('select label from recovery.parents')).rows,[{label:'Hidden'}]);
   }finally{
    if(ownerChanged)await admin.query('alter database "'+database+'" owner to current_user');
    if(setupComplete)await inspect('revoke execute on function pg_control_system() from "'+role+'";drop policy visible on recovery.parents;revoke all on all tables in schema recovery from "'+role+'";revoke usage on schema recovery from "'+role+'"');
    await admin.query('revoke execute on function pg_control_system() from "'+role+'"');
    await admin.query('drop role "'+role+'"');
   }
  }));
  await t.test('maintenance recloses the gate even when the data connection dies',()=>withTarget(async({load,gate,inspect,database})=>{
   const rows=tables(),evidence=proof(rows);let reads=0;
   await assert.rejects(load(rows,{...evidence,readCheckpoint:async()=>{
    if(++reads===2){
     await admin.query('alter database "'+database+'" allow_connections true');
     const sessions=(await admin.query('select pid from pg_stat_activity where datname=$1',[database])).rows;
     assert.equal(sessions.length,1);
     assert.equal((await admin.query('select pg_terminate_backend($1,5000) as killed',[sessions[0].pid])).rows[0].killed,true);
     await new Promise(resolve=>setTimeout(resolve,20));
    }
    return evidence.trust;
   }}),/RESTORE_COMMIT_OUTCOME_UNKNOWN/);
   assert.equal(await gate(),false);
   assert.equal((await inspect('select count(*)::int as n from recovery.parents')).rows[0].n,0);
  }));
  await t.test('gate reopened during current checkpoint retrieval cannot commit',()=>withTarget(async({load,gate,inspect,database})=>{
   const rows=tables(),evidence=proof(rows);let reads=0;
   await assert.rejects(load(rows,{...evidence,readCheckpoint:async()=>{if(++reads===2)await admin.query('alter database \"'+database+'\" allow_connections true');return evidence.trust;}}),/RESTORE_COMMIT_OUTCOME_UNKNOWN/);assert.equal(await gate(),false);
   assert.equal((await inspect('select count(*)::int as n from recovery.parents')).rows[0].n,0);
  }));
 }finally{await admin.end();fs.rmSync(dir,{recursive:true,force:true});}
});
