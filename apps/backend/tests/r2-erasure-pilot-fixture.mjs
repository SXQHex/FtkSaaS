import assert from 'node:assert/strict';
import {generateKeyPairSync,randomInt} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createR2ErasureState,erasureRegisterBindingSha256} from '../scripts/r2-erasure-state.mjs';
import {createR2S3ObjectStore,writeR2ImmutableEvidence} from '../scripts/r2-s3-object-store.mjs';
import {beginConfiguredOrganizationR2Erasure,beginOrganizationR2Erasure} from '../scripts/organization-erasure-receipt.mjs';
import {sha256} from '../scripts/restore-guard.mjs';

const localSourceProjectRef='ftknativereceipttest';
const localStoreIdentity=sha256('isolated native acceptance object store');
const localTrustKey=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
const localRegisterBinding=erasureRegisterBindingSha256({sourceProjectRef:localSourceProjectRef,
 storeIdentitySha256:localStoreIdentity,trustedPublicKeyPem:localTrustKey});

// Opt-in hosted evidence for the isolated native test. CI's local acceptance
// never acquires remote credentials or a provider domain.
export function r2ErasurePilot(credentialsFile=process.env.FTK_O06_R2_PILOT_CREDENTIALS,protectedRef=process.env.FTK_O06_R2_PILOT_PROJECT_REF){
 if(credentialsFile===undefined)return null;
 if(!path.isAbsolute(credentialsFile))throw Error('PRIVATE_R2_CREDENTIALS_FILE_REQUIRED');
 if(protectedRef!==undefined&&!/^ftkpilot[a-z]{12}$/.test(protectedRef))throw Error('INVALID_R2_PILOT_PROJECT_REF');
 const fd=fs.openSync(credentialsFile,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
 let config;
 try{
  const info=fs.fstatSync(fd);
  if(!info.isFile()||(info.mode&0o077)!==0||info.size>16384)throw Error('PRIVATE_R2_CREDENTIALS_FILE_REQUIRED');
  config=JSON.parse(fs.readFileSync(fd,'utf8'));
 }finally{fs.closeSync(fd);}
 const permanent=Boolean(config?.registerWriter||config?.registerReader||config?.archiveWriter||config?.archiveReader);
 const registerWriter=permanent?config.registerWriter:config?.writer;
 const registerReader=permanent?config.registerReader:config?.reader;
 const archiveWriter=permanent?config.archiveWriter:registerWriter;
 const archiveReader=permanent?config.archiveReader:registerReader;
 const roles=permanent?[registerWriter,registerReader,archiveWriter,archiveReader]:[registerWriter,registerReader];
 if(roles.some(role=>!role)
  ||new Set(roles.map(role=>role.accessKeyId)).size!==roles.length
  ||new Set(roles.map(role=>role.secretAccessKey)).size!==roles.length)
  throw Error('DISTINCT_R2_PILOT_IDENTITIES_REQUIRED');
 if(permanent&&!/^https:\/\/[a-f0-9]{32}\.eu\.r2\.cloudflarestorage\.com$/.test(config.endpoint))
  throw Error('EU_R2_ACCEPTANCE_ENDPOINT_REQUIRED');

 const coordinationDir=fs.mkdtempSync(path.join(path.dirname(credentialsFile),'.o06-r2-'));
 const suffix=Array.from({length:12},()=>String.fromCharCode(97+randomInt(26))).join('');
 const sourceProjectRef=protectedRef??('ftkpilot'+suffix);
 const archive=permanent?'ftksaas-ops-retention-archive':'ftksaas-ops-pilot-retention-archive';
 const register=permanent?'ftksaas-ops-erasure-register':'ftksaas-ops-pilot-erasure-register';
 const options={endpoint:config.endpoint,bucket:register,workDirectory:coordinationDir};
 const credential=(role,readOnly,bucket=options.bucket)=>createR2S3ObjectStore({...options,bucket,
  accessKeyId:role.accessKeyId,secretAccessKey:role.secretAccessKey,readOnly});
 const writer=credential(registerWriter,false),reader=credential(registerReader,true);
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const initialSigning={privateKeyPem:privateKey.export({type:'pkcs8',format:'pem'}),publicKeyPem:publicKey.export({type:'spki',format:'pem'})};
 const state={sourceProjectRef,coordinationDir,trustedPublicKeyPem:initialSigning.publicKeyPem};

 return {
  sourceProjectRef,
  initialSigning,
  writer:createR2ErasureState({...state,store:writer}),
  reader:createR2ErasureState({...state,store:reader}),
  archiveWriter:credential(archiveWriter,false,archive),
  archiveReader:credential(archiveReader,true,archive),
  async verifyBucketIsolation(){
   if(!permanent)return;
   const probe='pilot-checks/'+sourceProjectRef+'/credential-scope.json';
   for(const role of [registerWriter,registerReader])
    await assert.rejects(()=>credential(role,true,archive).get(probe),/R2_S3_FORBIDDEN/);
   for(const role of [archiveWriter,archiveReader])
    await assert.rejects(()=>credential(role,true,register).get(probe),/R2_S3_FORBIDDEN/);
  },
  async beginConfigured({databaseUrl,requestId,orgId}){
   const configFile=path.join(coordinationDir,'operator.json');
   fs.writeFileSync(configFile,JSON.stringify({databaseUrl,...state,endpoint:config.endpoint,bucket:register,writer:registerWriter}),
    {flag:'wx',mode:0o600});
   try{return await beginConfiguredOrganizationR2Erasure({configFile,requestId,orgId});}
   finally{fs.unlinkSync(configFile);}
  },
  async verifyRolesAndCondition(){
   const current='erasure/'+sourceProjectRef+'/current.json';
   const previous=await reader.get(current);
   assert(previous?.etag);
   const probe=Buffer.from('{"synthetic":"denied write"}');
   const unexpected='"'+(previous.etag==='"'+'0'.repeat(32)+'"'?'1':'0').repeat(32)+'"';
   await assert.rejects(async()=>writer.put(current,probe,{ifMatch:unexpected}),/R2_ERASURE_PRECONDITION_FAILED/);
   const permissionProbe=credential(registerReader,false);
   await assert.rejects(async()=>permissionProbe.put('pilot-checks/'+sourceProjectRef+'/read-only.json',probe,{ifNoneMatch:'*'}),/R2_S3_FORBIDDEN/);
   assert.deepEqual(await reader.get(current),previous);
   if(protectedRef){
    const checkpoint=JSON.parse(previous.bytes);
    const sequence=String(checkpoint.head.ledger_sequence).padStart(16,'0');
    const ledger='erasure/'+sourceProjectRef+'/receipts/'+sequence+'.json';
    const original=await reader.get(ledger);
    assert(original?.etag);
    await assert.rejects(async()=>writer.put(ledger,original.bytes,{ifMatch:original.etag}),/R2_ERASURE_OBJECT_LOCKED/);
   }
   const archiveStore=credential(archiveWriter,false,archive);
   const bytes=Buffer.from('FtkSaaS synthetic archival readback');
   const key='archive/'+sourceProjectRef+'/archived-evidence';
   assert.deepEqual(await writeR2ImmutableEvidence({store:archiveStore,key,bytes,expectedSha256:sha256(bytes)}),
    {sha256:sha256(bytes),bytes:bytes.length});
   const archived=await credential(archiveReader,true,archive).get(key);
   assert.deepEqual(archived?.bytes,bytes);
   if(protectedRef&&permanent)
    await assert.rejects(()=>archiveStore.put(key,bytes,{ifMatch:archived.etag}),/R2_ERASURE_OBJECT_LOCKED/);
   const archivePermissionProbe=credential(archiveReader,false,archive);
   await assert.rejects(async()=>archivePermissionProbe.put('pilot-checks/'+sourceProjectRef+'/read-only.json',probe,{ifNoneMatch:'*'}),/R2_S3_FORBIDDEN/);
  }
 };
}

export async function beginBoundR2PilotErasure({db,requestId,orgId,pilot,databaseUrl}){
 await enrollSyntheticErasure({db,requestId,orgId,pilot});
 const input={db,requestId,orgId};
 if(!pilot)return beginLocalErasure(input);
 await assert.rejects(beginOrganizationR2Erasure({...input,state:{
  sourceProjectRef:'z'.repeat(20),begin:()=>assert.fail('wrong register was opened')
 }}),/ORGANIZATION_ERASURE_REGISTER_BINDING_MISMATCH/);
 await assert.rejects(beginOrganizationR2Erasure({...input,state:{
  sourceProjectRef:pilot.sourceProjectRef,registerBindingSha256:'0'.repeat(64),
  begin:()=>assert.fail('wrong bucket or trust anchor was used')
 }}),/ORGANIZATION_ERASURE_REGISTER_BINDING_MISMATCH/);
 if(!databaseUrl)return beginOrganizationR2Erasure({...input,state:pilot.writer});
 const pending=await pilot.beginConfigured({databaseUrl,requestId,orgId});
 assert.deepEqual(await beginOrganizationR2Erasure({...input,state:pilot.writer}),pending);
 return pending;
}

export async function enrollSyntheticErasure({db,requestId,orgId,pilot}){
 await db.query(`insert into private.organization_r2_erasure_bindings(request_id,org_id,source_project_ref,register_binding_sha256)
  values($1,$2,$3,$4) on conflict(request_id) do nothing`,
 [requestId,orgId,pilot?.sourceProjectRef??localSourceProjectRef,pilot?.writer.registerBindingSha256??localRegisterBinding]);
}

async function beginLocalErasure(input){
 const coordinationDir=fs.mkdtempSync(path.join(os.tmpdir(),'ftk-native-erasure-state-'));
 let item;
 const store={
  identitySha256:localStoreIdentity,
  async get(){return item??null;},
  async put(_key,bytes,condition){
   assert.deepEqual(condition,{ifNoneMatch:'*'});
   assert.equal(item,undefined);
   item={bytes,etag:'"'+sha256(bytes)+'"'};
  }
 };
 const state=createR2ErasureState({store,sourceProjectRef:localSourceProjectRef,coordinationDir,trustedPublicKeyPem:localTrustKey});
 try{return await beginOrganizationR2Erasure({...input,state});}
 finally{fs.rmdirSync(coordinationDir);}
}
