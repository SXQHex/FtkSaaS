import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {readErasureCheckpoint} from '../scripts/erasure-register.mjs';
import {publishOrganizationErasureReceipt,publishOrganizationR2ErasureReceipt} from '../scripts/organization-erasure-receipt.mjs';
import {restorePostgresSnapshot,restorePostgresSnapshotFromR2} from '../scripts/postgres-restore.mjs';
import {canonical,sha256} from '../scripts/restore-guard.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

const localProjectRef='ftknativereceipttest';

export async function readOrganizationRestoreProjection(db,{orgId,personId,objectId,fileId,controlId},includeErased){
 const rows=async(sql,args)=>(await db.query(sql,args)).rows;
 return [
  {schema:'core',table:'organizations',rows:await rows('select id,name from core.organizations where id=$1 and $2',[orgId,includeErased])},
  {schema:'core',table:'people',rows:await rows('select id,org_id,display_name from core.people where id=any($1::uuid[]) order by id',
   [includeErased?[personId,controlId]:[controlId]])},
  {schema:'storage',table:'objects',rows:await rows('select id from storage.objects where id=$1',[objectId])},
  {schema:'private',table:'p05_files',rows:await rows('select file_id,name from private.p05_files where file_id=$1 and $2',[fileId,includeErased])}
 ];
}

export async function verifyCompleteOrganizationErasureRestore({db,dbUrl,requestId,ids,before,r2Pilot,signingContext}){
 const projectRef=r2Pilot?.sourceProjectRef??localProjectRef;
 const {orgId,personId,objectId,fileId,controlId}=ids;
 const url=new URL(dbUrl);
 assert(['localhost','127.0.0.1'].includes(url.hostname));
 const after=await readOrganizationRestoreProjection(db,ids,false);
 assert.deepEqual(before[0].rows.map(row=>row.id),[orgId]);
 assert.deepEqual(before[2].rows,[{id:objectId}]);
 assert.deepEqual(before[3].rows,[{file_id:fileId,name:'Synthetic draft filename'}]);
 assert.deepEqual(after[1].rows,before[1].rows.filter(row=>row.id===controlId));
 assert.equal(after[1].rows.length,1);
 assert.deepEqual(after[2].rows,[]);
 assert.deepEqual(after[3].rows,[]);
 assert.equal((await db.query('select name from private.p05_files where file_id=$1',[fileId])).rows[0].name,fileId);
 assert.deepEqual((await db.query('select id from core.people where id=$1',[personId])).rows,[]);
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const {privateKeyPem,publicKeyPem}=r2Pilot?.initialSigning??
  {privateKeyPem:privateKey.export({type:'pkcs8',format:'pem'}),publicKeyPem:publicKey.export({type:'spki',format:'pem'})};
 const registerDir=fs.mkdtempSync(path.join(os.tmpdir(),'native-org-register-'));
 const checkpointDir=fs.mkdtempSync(path.join(os.tmpdir(),'native-org-checkpoint-'));
 const lockDir=fs.mkdtempSync(path.join(os.tmpdir(),'native-org-lock-'));
 const registerFile=path.join(registerDir,'ledger.json'),checkpointFile=path.join(checkpointDir,'current.json');
 const checkpointLockFile=path.join(lockDir,'checkpoint.lock');
 const checkpoint={checkpointFile,sourceProjectRef:projectRef};
 const database='ftk_restore_'+key().replaceAll('-','');
 url.pathname='/'+database;
 let created=false;
 try{
  const publish={db,requestId,orgId,file:registerFile,privateKeyPem,publicKeyPem,checkpointLockFile,...checkpoint};
  const {receipt,head}=await publishOrganizationErasureReceipt(publish);
  assert.deepEqual(new Set(receipt.entry.subject_ids),new Set([orgId,personId,objectId,fileId]));
  assert.equal(receipt.entry.proof_sha256,sha256(canonical({database:receipt.database,files:receipt.files})));
  assert.deepEqual(JSON.parse(fs.readFileSync(registerFile)).erasures,[receipt.entry]);
  assert.deepEqual(await publishOrganizationErasureReceipt(publish),{receipt,head:{...head,replayed:true}});
  let acceptedHead={ledger_sequence:head.sequence,ledger_sha256:head.sha256};
  let oldRemoteEvidence;
  if(r2Pilot){
   const remoteOptions={db,requestId,orgId,state:r2Pilot.writer,privateKeyPem,publicKeyPem};
   const remote=await publishOrganizationR2ErasureReceipt(remoteOptions);
   assert.deepEqual(remote.receipt,receipt);
   assert.deepEqual(await publishOrganizationR2ErasureReceipt(remoteOptions),remote);
   await r2Pilot.verifyRolesAndCondition();
   const clean=Buffer.from(JSON.stringify({project_ref:projectRef,tables:after}));
   oldRemoteEvidence=await r2Pilot.reader.withRestoreEvidence(sha256(clean),({trust,ledgerBytes})=>({trust,ledgerBytes}));
   const next=generateKeyPairSync('ed25519');
   const rotation={previousPrivateKeyPem:privateKeyPem,privateKeyPem:next.privateKey.export({type:'pkcs8',format:'pem'}),
    publicKeyPem:next.publicKey.export({type:'spki',format:'pem'})};
   acceptedHead=await r2Pilot.writer.rotate(rotation);
   signingContext.current={privateKeyPem:rotation.privateKeyPem,publicKeyPem:rotation.publicKeyPem};
   assert.equal(acceptedHead.ledger_sequence,remote.head.ledger_sequence+1);
   assert.deepEqual(await r2Pilot.writer.rotate(rotation),acceptedHead);
   await r2Pilot.reader.withRestoreEvidence(sha256(clean),({ledgerBytes})=>assert.deepEqual(JSON.parse(ledgerBytes).erasures,[receipt.entry]));
  }
  fs.chmodSync(checkpointFile,0o400);
  fs.chmodSync(checkpointDir,0o500);
  assert.throws(()=>fs.closeSync(fs.openSync(checkpointFile,'r+')),{code:'EACCES'});
  const [identity]=(await db.query('select (pg_control_system()).system_identifier::text as system_identifier,host(inet_server_addr()) as server_address')).rows;
  await db.query('create database "'+database+'"');
  created=true;
  const inspect=async sql=>{
   const client=new pg.Client({connectionString:url.href});
   await client.connect();
   try{return (await client.query(sql)).rows;}finally{await client.end();}
  };
  await inspect(`create schema core; create schema storage; create schema private;
   create table core.organizations(id uuid primary key,name text not null);
   create table core.people(id uuid primary key,org_id uuid not null,display_name text not null);
   create table storage.objects(id uuid primary key);
   create table private.p05_files(file_id uuid primary key,name text not null)`);
  const target={database,...identity,tables:after.map(({schema,table})=>({schema,table}))};
  const load=tables=>{
   const snapshotBytes=Buffer.from(JSON.stringify({project_ref:projectRef,tables}));
   if(r2Pilot)return restorePostgresSnapshotFromR2({connectionString:url.href,target,state:r2Pilot.reader,
    registerBindingSha256:receipt.database.register_binding_sha256,snapshotBytes,snapshotSha256:sha256(snapshotBytes)});
   const trust={...readErasureCheckpoint(checkpoint),snapshot_sha256:sha256(snapshotBytes)};
   return restorePostgresSnapshot({connectionString:url.href,target,registerFile,snapshotBytes,trust,checkpointFile,checkpointLockFile});
  };
  const allowed=async()=>(await db.query('select datallowconn from pg_database where datname=$1',[database])).rows[0].datallowconn;
  await db.query('alter database "'+database+'" allow_connections false');
  if(oldRemoteEvidence){
   const snapshotBytes=Buffer.from(JSON.stringify({project_ref:projectRef,tables:after}));
   const oldRegister=path.join(registerDir,'old-r2-ledger.json');
   fs.writeFileSync(oldRegister,oldRemoteEvidence.ledgerBytes,{mode:0o600});
   await r2Pilot.reader.withRestoreEvidence(sha256(snapshotBytes),async({readCheckpoint})=>{
    await assert.rejects(restorePostgresSnapshot({connectionString:url.href,target,registerFile:oldRegister,snapshotBytes,
     trust:oldRemoteEvidence.trust,readCheckpoint}),/CURRENT_CHECKPOINT_CHANGED/);
   });
   assert.equal(await allowed(),false);
  }
  for(const [index,table] of before.entries()){
   await assert.rejects(load(after.map((clean,i)=>i===index?table:clean)),/ERASED_SUBJECT_PRESENT/);
   assert.equal(await allowed(),false);
  }
  await db.query('alter database "'+database+'" allow_connections true');
  assert.deepEqual(await inspect('select id from core.organizations union all select id from core.people union all select id from storage.objects union all select file_id from private.p05_files'),[]);
  const result=await load(after);
  assert.equal(result.result,'isolated_postgres_rows_restored');
  assert.equal(result.ledger_sequence,acceptedHead.ledger_sequence);
  assert.equal(result.ledger_sha256,acceptedHead.ledger_sha256);
  assert.equal(await allowed(),false);
  await db.query('alter database "'+database+'" allow_connections true');
  assert.deepEqual(await inspect('select id,org_id,display_name from core.people'),after[1].rows);
  assert.deepEqual(await inspect('select id from core.organizations union all select id from storage.objects union all select file_id from private.p05_files'),[]);
  return {ledger_sha256:acceptedHead.ledger_sha256,ledger_sequence:acceptedHead.ledger_sequence,
   proof_sha256:receipt.entry.proof_sha256,erased_subjects:receipt.entry.subject_ids.length,checkpoint:r2Pilot?'r2':'local'};
 }finally{
  if(created)await db.query('drop database "'+database+'"');
  fs.chmodSync(checkpointDir,0o700);
  for(const dir of [registerDir,checkpointDir,lockDir])fs.rmSync(dir,{recursive:true,force:true});
 }
}


export async function readPaidErasureProjection(db,{orgId,invoiceId,controlId}){
 const list=[
  ['core','saas_payment_verifications','select id from core.saas_payment_verifications where org_id=$1 order by id',[orgId]],
  ['core','saas_subscriptions','select id from core.saas_subscriptions where org_id=$1 order by id',[orgId]],
  ['core','audit_events',`select id from core.audit_events where org_id=$1
   and action in ('platform_invoice_publish_v1','platform_invoice_upload_prepare_v1','saas_payment_submit_v1','saas_payment_verify_v1') order by id`,[orgId]],
  ['private','platform_invoices','select id from private.platform_invoices where org_id=$1 and id=$2',[orgId,invoiceId]],
  ['storage','objects',"select id from storage.objects where bucket_id='ftksaas-invoices' and name=$1",[orgId+'/'+invoiceId]],
  ['core','people','select id,org_id,display_name from core.people where id=$1',[controlId]]
 ];
 const tables=[];
 for(const [schema,table,sql,args] of list)tables.push({schema,table,rows:(await db.query(sql,args)).rows});
 return tables;
}

export async function verifyPaidErasureRestore({db,dbUrl,requestId,ids,before,r2Pilot,signingContext,receipt}){
 const after=await readPaidErasureProjection(db,ids);
 const proof=await verifyOrganizationProjectionRestore({
  db,dbUrl,requestId,orgId:ids.orgId,before,after,r2Pilot,signingContext,receipt,expectedRemoteEntries:2
 });
 return {paid_restore_verified:true,...proof};
}

export async function readMixedErasureProjection(db,{orgId,ownerPerson,studentPerson,controlId,controlLink}){
 const list=[
  ['core','account_links','select id from core.account_links where (org_id=$1 and person_id<>$2) or id=$3 order by id',
   [orgId,ownerPerson,controlLink]],
  ['core','centers','select id from core.centers where org_id=$1 order by id',[orgId]],
  ['core','role_assignments','select id from core.role_assignments where org_id=$1 order by id',[orgId]],
  ['core','audit_events',`select id from core.audit_events where org_id=$1 and action not in
   ('organization_create_v1','organization_delete_apply_v1','privacy_execute_v1') order by id`,[orgId]],
  ['core','operation_receipts',`select id from core.operation_receipts where org_id=$1 and operation not in
   ('organization_create_v1','organization_delete_apply_v1','privacy_execute_v1') order by id`,[orgId]],
  ['core','notifications',`select id from core.notifications where org_id=$1 and kind not in
   ('organization_create_v1','organization_delete_apply_v1','privacy_execute_v1') order by id`,[orgId]],
  ['core','sales','select id from core.sales where org_id=$1 order by id',[orgId]],
  ['core','entitlement_movements','select id from core.entitlement_movements where org_id=$1 order by id',[orgId]],
  ['core','saas_payment_verifications','select id from core.saas_payment_verifications where org_id=$1 order by id',[orgId]],
  ['core','document_acceptances','select id from core.document_acceptances where org_id=$1 order by id',[orgId]],
  ['private','frontend_settings_history',`select id from private.frontend_settings_history
   where scope_key='organization:'||$1 or scope_key like 'center:'||$1||':%' order by id`,[orgId]],
  ['private','settings_media_assets',"select id from private.settings_media_assets where scope_key='organization:'||$1 order by id",[orgId]],
  ['storage','objects',"select id from storage.objects where split_part(name,'/',1)=$1 order by id",[orgId]],
  ['core','people','select id,org_id,display_name from core.people where id=any($1::uuid[]) order by id',[[studentPerson,controlId]]]
 ];
 const tables=[];
 for(const [schema,table,sql,args] of list)tables.push({schema,table,rows:(await db.query(sql,args)).rows});
 return tables;
}

export async function verifyOrganizationProjectionRestore({db,dbUrl,requestId,orgId,before,after,r2Pilot,signingContext,
 receipt,expectedRemoteEntries,checkPending=false,previousEvidence}){
 const projectRef=r2Pilot?.sourceProjectRef??localProjectRef;
 const url=new URL(dbUrl);
 assert(['localhost','127.0.0.1'].includes(url.hostname));
 const last=after.length-1,removed=[];
 assert.equal(after[last].rows.length,1);
 assert.equal(after[last].table,'people');
 assert.equal(before.length,after.length);
 for(const [index,table] of before.entries()){
  const clean=after[index],removedRows=table.rows.filter(row=>!clean.rows.some(kept=>kept.id===row.id));
  assert.equal(table.schema,clean.schema);
  assert.equal(table.table,clean.table);
  assert.match(table.schema,/^[a-z_]+$/);
  assert.match(table.table,/^[a-z_]+$/);
  assert(removedRows.every(row=>receipt.entry.subject_ids.includes(row.id)),table.table);
  assert.deepEqual(clean.rows,table.rows.filter(row=>!receipt.entry.subject_ids.includes(row.id)),table.table);
  if(index!==last)assert(removedRows.length>0,table.table);
  if(removedRows.length)removed.push(index);
 }

 const registerDir=fs.mkdtempSync(path.join(os.tmpdir(),'organization-projection-register-'));
 const checkpointDir=fs.mkdtempSync(path.join(os.tmpdir(),'organization-projection-checkpoint-'));
 const lockDir=fs.mkdtempSync(path.join(os.tmpdir(),'organization-projection-lock-'));
 const registerFile=path.join(registerDir,'ledger.json'),checkpointFile=path.join(checkpointDir,'current.json');
 const checkpointLockFile=path.join(lockDir,'checkpoint.lock');
 const checkpoint={checkpointFile,sourceProjectRef:projectRef};
 const database='ftk_restore_org_'+key().replaceAll('-','');
 url.pathname='/'+database;
 let created=false;
 try{
  let head;
  const [identity]=(await db.query('select (pg_control_system()).system_identifier::text as system_identifier,host(inet_server_addr()) as server_address')).rows;
  await db.query('create database "'+database+'"');
  created=true;
  const inspect=async sql=>{
   const client=new pg.Client({connectionString:url.href});
   await client.connect();
   try{return (await client.query(sql)).rows;}finally{await client.end();}
  };
  const tableName=table=>table.schema+'.'+table.table;
  const definitions=after.map(table=>'create table '+tableName(table)+'(id uuid primary key'+
   (table.table==='people'?',org_id uuid not null,display_name text not null':'')+')');
  await inspect(['create schema core','create schema private','create schema storage',...definitions].join(';'));
  const target={database,...identity,tables:after.map(({schema,table})=>({schema,table}))};
  const snapshot=tables=>Buffer.from(JSON.stringify({project_ref:projectRef,tables}));
  const load=tables=>{
   const snapshotBytes=snapshot(tables), digest=sha256(snapshotBytes);
   if(r2Pilot)return restorePostgresSnapshotFromR2({connectionString:url.href,target,state:r2Pilot.reader,
    registerBindingSha256:receipt.database.register_binding_sha256,snapshotBytes,snapshotSha256:digest});
   return restorePostgresSnapshot({connectionString:url.href,target,registerFile,snapshotBytes,
    trust:{...head,snapshot_sha256:digest},checkpointFile,checkpointLockFile});
  };
  const allowed=async()=>(await db.query('select datallowconn from pg_database where datname=$1',[database])).rows[0].datallowconn;
  await db.query('alter database "'+database+'" allow_connections false');
  if(r2Pilot){
   assert(signingContext.current);
   const testSnapshot=snapshot(after);
   await assert.rejects(restorePostgresSnapshotFromR2({connectionString:url.href,target,
    state:{registerBindingSha256:'0'.repeat(64),withRestoreEvidence:()=>assert.fail('unexpected register was read')},
    registerBindingSha256:receipt.database.register_binding_sha256,snapshotBytes:testSnapshot,snapshotSha256:sha256(testSnapshot)}),
    /RESTORE_REGISTER_BINDING_MISMATCH/);
   if(checkPending){
    await assert.rejects(load(after),/R2_ERASURE_PENDING/);
    assert.equal(await allowed(),false);
   }
   const args={db,requestId,orgId,state:r2Pilot.writer,...signingContext.current};
   await assert.rejects(publishOrganizationR2ErasureReceipt({...args,state:{
    sourceProjectRef:'z'.repeat(20),publish:()=>assert.fail('wrong register publication')
   }}),/ORGANIZATION_ERASURE_REGISTER_BINDING_MISMATCH/);
   await assert.rejects(publishOrganizationR2ErasureReceipt({...args,state:{
    sourceProjectRef:r2Pilot.sourceProjectRef,registerBindingSha256:'0'.repeat(64),publish:()=>assert.fail('wrong bucket or root')
   }}),/ORGANIZATION_ERASURE_REGISTER_BINDING_MISMATCH/);
   const published=await publishOrganizationR2ErasureReceipt(args);
   assert.deepEqual(published.receipt,receipt);
   assert.deepEqual(await publishOrganizationR2ErasureReceipt(args),published);
   head=published.head;
   if(checkPending)await r2Pilot.verifyRolesAndCondition();
  }else{
   const signing=generateKeyPairSync('ed25519');
   const published=await publishOrganizationErasureReceipt({
    db,requestId,orgId,file:registerFile,checkpointLockFile,...checkpoint,
    privateKeyPem:signing.privateKey.export({type:'pkcs8',format:'pem'}),
    publicKeyPem:signing.publicKey.export({type:'spki',format:'pem'})
   });
   assert.deepEqual(published.receipt,receipt);
   head=readErasureCheckpoint(checkpoint);
  }
  const cleanSnapshot=snapshot(after),cleanDigest=sha256(cleanSnapshot);
  let signedEvidence;
  if(r2Pilot)await r2Pilot.reader.withRestoreEvidence(cleanDigest,async({ledgerBytes,trust,readCheckpoint})=>{
   const ledger=JSON.parse(ledgerBytes);
   assert.equal(ledger.erasures.length,expectedRemoteEntries);
   assert.deepEqual(ledger.erasures.at(-1),receipt.entry);
   signedEvidence={trust,ledger_utf8:ledgerBytes.toString('utf8')};
   if(previousEvidence){
    const previousFile=path.join(registerDir,'previous-r2-ledger.json');
    fs.writeFileSync(previousFile,previousEvidence.ledgerBytes,{mode:0o600});
    await assert.rejects(restorePostgresSnapshot({connectionString:url.href,target,registerFile:previousFile,
     snapshotBytes:cleanSnapshot,trust:{...previousEvidence.trust,snapshot_sha256:cleanDigest},readCheckpoint}),
    /CURRENT_CHECKPOINT_CHANGED/);
    assert.equal(await allowed(),false);
   }
  });
  if(checkPending){
   await assert.rejects(load(before),/ERASED_SUBJECT_PRESENT/);
   assert.equal(await allowed(),false);
  }
  for(const index of removed){
   await assert.rejects(load(after.map((item,i)=>i===index?before[index]:item)),/ERASED_SUBJECT_PRESENT/);
   assert.equal(await allowed(),false);
  }
  await db.query('alter database "'+database+'" allow_connections true');
  const rowsBeforeRestore=await inspect(after.map(table=>'select id from '+tableName(table)).join(' union all '));
  assert.deepEqual(rowsBeforeRestore,[]);
  const restored=await load(after);
  assert.equal(restored.result,'isolated_postgres_rows_restored');
  assert.equal(restored.ledger_sha256,head.ledger_sha256);
  assert.equal(restored.ledger_sequence,head.ledger_sequence);
  assert.equal(restored.snapshot_sha256,cleanDigest);
  assert.equal(restored.rows,after.reduce((total,table)=>total+table.rows.length,0));
  assert.equal(await allowed(),false);
  const result={ledger_sha256:head.ledger_sha256,ledger_sequence:head.ledger_sequence,snapshot_sha256:cleanDigest,
   proof_sha256:receipt.entry.proof_sha256,rejected_pre_erasure_projections:removed.length,
   stale_checkpoint_rejected:Boolean(previousEvidence),connection_gate_closed:true,checkpoint:r2Pilot?'r2':'local'};
  const output=checkPending&&r2Pilot&&process.env.FTK_O06_R2_SYNTHETIC_PROOF_OUTPUT;
  if(output){
   assert(path.isAbsolute(output));
   fs.writeFileSync(output,JSON.stringify({receipt,restore:result,initial_trusted_public_key_pem:r2Pilot.initialSigning.publicKeyPem,
    ...signedEvidence},null,2)+'\n',{flag:'wx',mode:0o600});
  }
  return result;
 }finally{
  if(created)await db.query('drop database "'+database+'"');
  for(const dir of [registerDir,checkpointDir,lockDir])fs.rmSync(dir,{recursive:true,force:true});
 }
}
