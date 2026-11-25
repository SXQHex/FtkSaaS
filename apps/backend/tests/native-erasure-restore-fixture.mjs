import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {appendErasure,publishErasureCheckpoint,readErasureCheckpoint} from '../scripts/erasure-register.mjs';
import {restorePostgresSnapshot} from '../scripts/postgres-restore.mjs';
import {sha256} from '../scripts/restore-guard.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

// Only physically removed records with committed source evidence go into this
// acceptance register. The organization's full request remains independent.
export async function verifyErasureReceiptRestore({db,dbUrl,requestId,orgId,contactId,objectIds,controlId,exportId,before}){
 const url=new URL(dbUrl);
 assert(['localhost','127.0.0.1'].includes(url.hostname));
 const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const [contactReceipt]=await query(`select c.completed_at
  from private.organization_contact_erasures c
  join core.privacy_requests p on p.id=c.request_id and p.org_id=c.org_id
  where c.request_id=$1 and c.org_id=$2 and p.kind='organization_delete'
   and c.removed_rows=1`,[requestId,orgId]);
 const storageReceipts=await query(`select object_id,completed_at from private.p07_storage_erasures
  where request_id=$1 and object_id=any($2::uuid[])`,[requestId,objectIds]);
 assert.deepEqual(new Set(storageReceipts.map(row=>row.object_id)),new Set(objectIds));
 const [exportReceipt]=await query(`select purged_at as completed_at from private.p06_export_purges
  where request_id=$1 and file_id=$2 and reason='organization_delete'`,[requestId,exportId]);
 const timestamps=[contactReceipt,...storageReceipts,exportReceipt].map(row=>row?.completed_at);
 assert(timestamps.every(timestamp=>timestamp instanceof Date),'Committed contact, Storage and export receipts are required');
 const completedAt=new Date(Math.max(...timestamps)).toISOString();
 assert.deepEqual(before.contacts,[{id:contactId}]);
 assert.deepEqual(new Set(before.objects.map(row=>row.id)),new Set([...objectIds,controlId]));
 assert.deepEqual(before.exports,[{file_id:exportId}]);
 const contacts=await query('select id from core.person_contacts where id=$1',[contactId]);
 const objects=await query('select id from storage.objects where id=any($1::uuid[])',[[...objectIds,controlId]]);
 const exports=await query('select file_id from private.p06_export_files where file_id=$1',[exportId]);
 assert.deepEqual(contacts,[]);
 assert.deepEqual(objects,[{id:controlId}]);
 assert.deepEqual(exports,[]);

 const sourceProjectRef='ftknativereceipttest';
 const snapshot=(contactRows,objectRows,exportRows)=>Buffer.from(JSON.stringify({
  project_ref:sourceProjectRef,tables:[
   {schema:'core',table:'person_contacts',rows:contactRows},
   {schema:'storage',table:'objects',rows:objectRows},
   {schema:'private',table:'p06_export_files',rows:exportRows}
  ]
 }));
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const privateKeyPem=privateKey.export({type:'pkcs8',format:'pem'}),publicKeyPem=publicKey.export({type:'spki',format:'pem'});
 const registerDir=fs.mkdtempSync(path.join(os.tmpdir(),'native-erasure-ledger-'));
 const checkpointDir=fs.mkdtempSync(path.join(os.tmpdir(),'native-erasure-checkpoint-'));
 const lockDir=fs.mkdtempSync(path.join(os.tmpdir(),'native-erasure-lock-'));
 const registerFile=path.join(registerDir,'ledger.json');
 const checkpoint={checkpointFile:path.join(checkpointDir,'current.json'),sourceProjectRef};
 const checkpointLockFile=path.join(lockDir,'checkpoint.lock');
 const database='ftk_restore_'+key().replaceAll('-','');
 url.pathname='/'+database;
 let created=false;
 try{
  const entry={request_id:requestId,kind:'organization',subject_ids:[contactId,...objectIds,exportId],completed_at:completedAt};
  const registration={entry,file:registerFile,privateKeyPem,publicKeyPem,sourceProjectRef,expectedHead:null,expectedSequence:0};
  const head=appendErasure(registration);
  publishErasureCheckpoint({...checkpoint,checkpointLockFile,registerFile,head,publicKeyPem,expected:null});
  fs.chmodSync(checkpoint.checkpointFile,0o400);
  fs.chmodSync(checkpointDir,0o500);
  assert.equal(fs.statSync(checkpoint.checkpointFile).mode&0o777,0o400);
  assert.throws(()=>fs.closeSync(fs.openSync(checkpoint.checkpointFile,'r+')),{code:'EACCES'});
  assert.deepEqual(appendErasure({...registration,expectedHead:head.sha256,expectedSequence:head.sequence}),{...head,replayed:true});

  const [identity]=await query(`select (pg_control_system()).system_identifier::text as system_identifier,
   host(inet_server_addr()) as server_address`);
  await db.query('create database "'+database+'"');
  created=true;
  const connect=async sql=>{
   const client=new pg.Client({connectionString:url.href});
   await client.connect();
   try{return (await client.query(sql)).rows;}finally{await client.end();}
  };
  const access=async()=> (await query('select datallowconn from pg_database where datname=$1',[database]))[0].datallowconn;
  await connect(`create schema core; create schema storage; create schema private;
   create table core.person_contacts(id uuid primary key); create table storage.objects(id uuid primary key);
   create table private.p06_export_files(file_id uuid primary key)`);
  const target={database,...identity,tables:[
   {schema:'core',table:'person_contacts'},{schema:'storage',table:'objects'},{schema:'private',table:'p06_export_files'}
  ]};
  const load=async snapshotBytes=>{
   const trust={...readErasureCheckpoint(checkpoint),snapshot_sha256:sha256(snapshotBytes)};
   return restorePostgresSnapshot({connectionString:url.href,target,registerFile,snapshotBytes,trust,checkpointFile:checkpoint.checkpointFile,checkpointLockFile});
  };
  await db.query('alter database "'+database+'" allow_connections false');
  await assert.rejects(load(snapshot(before.contacts,objects,exports)),/ERASED_SUBJECT_PRESENT/);
  for(const row of before.objects.filter(row=>objectIds.includes(row.id))){
   await assert.rejects(load(snapshot(contacts,[...objects,row],exports)),/ERASED_SUBJECT_PRESENT/);
  }
  await assert.rejects(load(snapshot(contacts,objects,before.exports)),/ERASED_SUBJECT_PRESENT/);
  assert.equal(await access(),false);
  await db.query('alter database "'+database+'" allow_connections true');
  assert.deepEqual(await connect('select id from core.person_contacts union all select id from storage.objects union all select file_id from private.p06_export_files'),[]);
  const result=await load(snapshot(contacts,objects,exports));
  assert.equal(result.result,'isolated_postgres_rows_restored');
  assert.equal(result.ledger_sequence,head.sequence);
  assert.equal(await access(),false);
  await db.query('alter database "'+database+'" allow_connections true');
  assert.deepEqual(await connect('select id from core.person_contacts'),[]);
  assert.deepEqual(await connect('select id from storage.objects'),[{id:controlId}]);
  assert.deepEqual(await connect('select file_id from private.p06_export_files'),[]);
 }finally{
  if(created)await db.query('drop database "'+database+'"');
  fs.chmodSync(checkpointDir,0o700);
  fs.rmSync(registerDir,{recursive:true,force:true});
  fs.rmSync(checkpointDir,{recursive:true,force:true});
  fs.rmSync(lockDir,{recursive:true,force:true});
 }
}
