import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {appendAndPublishErasure} from './erasure-register.mjs';
import {createR2ErasureState} from './r2-erasure-state.mjs';
import {createR2S3ObjectStore} from './r2-s3-object-store.mjs';
import {canonical,sha256} from './restore-guard.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const tables=/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/;
const digest=/^[a-f0-9]{64}$/;
const isId=value=>typeof value==='string'&&uuid.test(value);

// Only the committed database and file census receipts are accepted here.
// Partial manifests and application status are not signing inputs.
export async function readOrganizationErasureReceipt({db,requestId,orgId}){
 if(!isId(requestId)||!isId(orgId))throw Error('INVALID_ORGANIZATION_ERASURE_TARGET');
 const {rows}=await db.query(`
  select greatest(d.completed_at,f.completed_at) as completed_at,
   pg_catalog.pg_current_xact_id_if_assigned() is null
    and pg_catalog.current_setting('transaction_isolation')='read committed' as committed_read,
   rb.source_project_ref as register_source_project_ref,rb.register_binding_sha256,
   d.covered_tables,d.census_sha256,f.inventory,b.archive_sha256 as billing_archive_sha256,
   h.archive_sha256 as billing_history_archive_sha256,
   sd.archive_sha256 as signed_document_archive_sha256,
   sa.archive_sha256 as sale_archive_sha256,
   da.archive_sha256 as directory_archive_sha256,
   array(
    select p.org_id
    union
    select subject_id from unnest(d.erased_subject_ids) as subject(subject_id)
    union
    select e.object_id from private.p07_storage_erasures e where e.request_id=p.id
    union
    select e.file_id from private.p07_storage_erasures e where e.request_id=p.id
    union
    select e.file_id from private.p06_export_purges e where e.request_id=p.id and e.reason='organization_delete'
    union
    select a.invoice_id from private.organization_invoice_erasures a where a.request_id=p.id and a.org_id=p.org_id and a.completed_at is not null
    union
    select a.object_id from private.organization_invoice_erasures a where a.request_id=p.id and a.org_id=p.org_id and a.completed_at is not null
    union
    select subject_id from unnest(b.erased_subject_ids) as subject(subject_id)
    union
    select subject_id from unnest(h.erased_subject_ids) as subject(subject_id)
    union
    select subject_id from unnest(sd.erased_subject_ids) as subject(subject_id)
    union
    select subject_id from unnest(sa.erased_subject_ids) as subject(subject_id)
    union
    select subject_id from unnest(da.erased_subject_ids) as subject(subject_id)
    union
    select subject_id from unnest(me.erased_asset_ids) as subject(subject_id)
    order by 1
   ) as subject_ids
  from core.privacy_requests p
  join private.p07_privacy_manifests m on m.request_id=p.id
  join private.organization_live_database_erasure_receipts d on d.request_id=p.id and d.org_id=p.org_id
  join private.organization_managed_file_erasure_receipts f on f.request_id=p.id and f.org_id=p.org_id
  left join private.organization_billing_erasures b on b.request_id=p.id and b.org_id=p.org_id and b.completed_at is not null
  left join private.organization_billing_history_erasures h on h.request_id=p.id and h.org_id=p.org_id and h.completed_at is not null
  left join private.organization_signed_document_erasures sd on sd.request_id=p.id and sd.org_id=p.org_id and sd.completed_at is not null
  left join private.organization_sale_erasures sa on sa.request_id=p.id and sa.org_id=p.org_id and sa.completed_at is not null
  left join private.organization_directory_erasures da on da.request_id=p.id and da.org_id=p.org_id and da.completed_at is not null
  left join private.organization_media_erasures me on me.request_id=p.id and me.org_id=p.org_id and me.completed_at is not null
  join private.organization_r2_erasure_bindings rb on rb.request_id=p.id and rb.org_id=p.org_id
   and rb.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
   and rb.pending_started_at<=least(d.completed_at,f.completed_at)
   and rb.register_binding_sha256 is not null
  where p.id=$1 and p.org_id=$2 and p.kind='organization_delete'
   and p.scope=jsonb_build_object('kind','organization','org_id',p.org_id,'account_id',null,'all_data',true)
   and m.scopes#>>'{database,live_database,state}'='completed'
   and m.scopes#>>'{exports,managed_file_erasure,state}'='completed'
 `,[requestId,orgId]);
 if(rows.length!==1)throw Error('ORGANIZATION_ERASURE_RECEIPT_INCOMPLETE');
 const [proof]=rows;
 if(proof.committed_read!==true)throw Error('ORGANIZATION_ERASURE_COMMITTED_READ_REQUIRED');
 if(!(proof.completed_at instanceof Date)||!Number.isFinite(proof.completed_at.getTime())
  ||!Array.isArray(proof.covered_tables)||!proof.covered_tables.length
  ||proof.covered_tables.some(table=>typeof table!=='string'||!tables.test(table))
  ||typeof proof.census_sha256!=='string'||!digest.test(proof.census_sha256)
  ||typeof proof.register_binding_sha256!=='string'||!digest.test(proof.register_binding_sha256)
  ||proof.billing_archive_sha256!==null&&!digest.test(proof.billing_archive_sha256)
  ||proof.billing_history_archive_sha256!==null&&!digest.test(proof.billing_history_archive_sha256)
  ||proof.signed_document_archive_sha256!==null&&!digest.test(proof.signed_document_archive_sha256)
  ||proof.sale_archive_sha256!==null&&!digest.test(proof.sale_archive_sha256)
  ||proof.directory_archive_sha256!==null&&!digest.test(proof.directory_archive_sha256)
  ||!proof.inventory||typeof proof.inventory!=='object'||Array.isArray(proof.inventory)
  ||!Array.isArray(proof.subject_ids)||!proof.subject_ids.length||!proof.subject_ids.every(isId)){
  throw Error('INVALID_ORGANIZATION_ERASURE_RECEIPT');
 }
 const database={covered_tables:proof.covered_tables,census_sha256:proof.census_sha256,
  register_source_project_ref:proof.register_source_project_ref,register_binding_sha256:proof.register_binding_sha256};
 if(proof.billing_archive_sha256!==null)database.billing_archive_sha256=proof.billing_archive_sha256;
 if(proof.billing_history_archive_sha256!==null)database.billing_history_archive_sha256=proof.billing_history_archive_sha256;
 if(proof.signed_document_archive_sha256!==null)database.signed_document_archive_sha256=proof.signed_document_archive_sha256;
 if(proof.sale_archive_sha256!==null)database.sale_archive_sha256=proof.sale_archive_sha256;
 if(proof.directory_archive_sha256!==null)database.directory_archive_sha256=proof.directory_archive_sha256;
 const evidence={
  database,
  files:proof.inventory
 };
 return {
  entry:{request_id:requestId,kind:'organization',subject_ids:proof.subject_ids,completed_at:proof.completed_at.toISOString(),
   proof_sha256:sha256(canonical(evidence))},
  ...evidence
 };
}

export async function publishOrganizationErasureReceipt({db,requestId,orgId,...publication}){
 const receipt=await readOrganizationErasureReceipt({db,requestId,orgId});
 const head=appendAndPublishErasure({...publication,entry:receipt.entry});
 return {receipt,head};
}

export async function beginOrganizationR2Erasure({db,requestId,orgId,state}){
 if(!isId(requestId)||!isId(orgId))throw Error('INVALID_ORGANIZATION_ERASURE_TARGET');
 const {rows}=await db.query(`select p.id,b.source_project_ref,b.register_binding_sha256,
   pg_catalog.pg_current_xact_id_if_assigned() is null
    and pg_catalog.current_setting('transaction_isolation')='read committed' as committed_read
  from core.privacy_requests p
  join core.organizations o on o.id=p.org_id
  left join private.organization_r2_erasure_bindings b on b.request_id=p.id and b.org_id=p.org_id
   and b.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
  where p.id=$1 and p.org_id=$2 and p.kind='organization_delete'
   and p.scope=jsonb_build_object('kind','organization','org_id',p.org_id,'account_id',null,'all_data',true)
   and p.state in ('requested','running','partial') and o.state='deletion_pending'`,[requestId,orgId]);
 if(rows.length!==1)throw Error('ORGANIZATION_ERASURE_REQUEST_REQUIRED');
 const [binding]=rows;
 if(binding.committed_read!==true)throw Error('ORGANIZATION_ERASURE_COMMITTED_READ_REQUIRED');
 if(!binding.register_binding_sha256||binding.source_project_ref!==state?.sourceProjectRef
  ||binding.register_binding_sha256!==state?.registerBindingSha256)throw Error('ORGANIZATION_ERASURE_REGISTER_BINDING_MISMATCH');
 const intent=await state.begin(requestId);
 const pendingTime=Date.parse(intent?.started_at);
 if(intent?.request_id!==requestId||!Number.isFinite(pendingTime)||new Date(pendingTime).toISOString()!==intent.started_at){
  throw Error('ORGANIZATION_ERASURE_REGISTER_INTENT_MISMATCH');
 }
 const target=[requestId,orgId,binding.source_project_ref,intent.started_at,binding.register_binding_sha256];
 const exactBinding=`request_id=$1 and org_id=$2 and source_project_ref=$3
   and register_binding_sha256=$5 and instance_id=(pg_catalog.pg_control_system()).system_identifier::text`;
 const updated=await db.query(`update private.organization_r2_erasure_bindings set pending_started_at=$4
  where ${exactBinding} and pending_started_at is null`,target);
 if(updated.rowCount===0){
  const recorded=await db.query(`select 1 from private.organization_r2_erasure_bindings
   where ${exactBinding} and pending_started_at=$4`,target);
  if(recorded.rowCount!==1)throw Error('ORGANIZATION_ERASURE_REGISTER_INTENT_MISMATCH');
 }
 return intent;
}

export async function publishOrganizationR2ErasureReceipt({db,requestId,orgId,state,privateKeyPem,publicKeyPem}){
 const receipt=await readOrganizationErasureReceipt({db,requestId,orgId});
 if(receipt.database.register_source_project_ref!==state?.sourceProjectRef
  ||receipt.database.register_binding_sha256!==state?.registerBindingSha256){
  throw Error('ORGANIZATION_ERASURE_REGISTER_BINDING_MISMATCH');
 }
 const head=await state.publish({entry:receipt.entry,privateKeyPem,publicKeyPem});
 return {receipt,head};
}

function readErasureOperatorConfig(configFile){
 if(typeof configFile!=='string'||!path.isAbsolute(configFile))throw Error('PRIVATE_ERASURE_OPERATOR_CONFIG_REQUIRED');
 const fd=fs.openSync(configFile,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
 let config;
 try{
  const info=fs.fstatSync(fd);
  if(!info.isFile()||(info.mode&0o077)!==0||info.size>16384)throw Error('PRIVATE_ERASURE_OPERATOR_CONFIG_REQUIRED');
  config=JSON.parse(fs.readFileSync(fd,'utf8'));
 }finally{fs.closeSync(fd);}
 const {databaseUrl,sourceProjectRef,coordinationDir,trustedPublicKeyPem,endpoint,bucket,writer}=config;
 const store=createR2S3ObjectStore({endpoint,bucket,workDirectory:coordinationDir,
  accessKeyId:writer?.accessKeyId,secretAccessKey:writer?.secretAccessKey});
 const state=createR2ErasureState({store,sourceProjectRef,coordinationDir,trustedPublicKeyPem});
 return {databaseUrl,state};
}

export async function beginConfiguredOrganizationR2Erasure({configFile,requestId,orgId}){
 const {databaseUrl,state}=readErasureOperatorConfig(configFile);
 const url=new URL(databaseUrl);
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname
  ||(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.searchParams.get('sslmode')!=='verify-full')){
  throw Error('ORGANIZATION_ERASURE_VERIFIED_DB_CONNECTION_REQUIRED');
 }
 const db=new pg.Client({connectionString:databaseUrl,connectionTimeoutMillis:10000,statement_timeout:15000});
 try{
  await db.connect();
  return await beginOrganizationR2Erasure({db,requestId,orgId,state});
 }finally{await db.end();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [command,configFile,requestId,orgId]=process.argv.slice(2);
 const describe=command==='binding'&&process.argv.length===4;
 const begin=command==='begin'&&process.argv.length===6;
 if(!describe&&!begin){
  console.error('Usage: node scripts/organization-erasure-receipt.mjs binding CONFIG_FILE | begin CONFIG_FILE REQUEST_ID ORG_ID');
  process.exitCode=2;
 }else{
  try{
   if(describe){
    const {state}=readErasureOperatorConfig(configFile);
    console.log(JSON.stringify({source_project_ref:state.sourceProjectRef,register_binding_sha256:state.registerBindingSha256}));
   }else console.log(JSON.stringify(await beginConfiguredOrganizationR2Erasure({configFile,requestId,orgId})));
  }
  catch(error){
   const message=error instanceof Error?error.message:'';
   console.error(/^(?:ORGANIZATION_ERASURE|INVALID_ORGANIZATION_ERASURE|PRIVATE_ERASURE|R2_ERASURE|R2_S3)_[A-Z_]+$/.test(message)
    ?message:'ORGANIZATION_ERASURE_OPERATOR_FAILED');
   process.exitCode=1;
  }
 }
}
