import fs from 'node:fs/promises';
import path from 'node:path';
import {createPrivateKey,createPublicKey} from 'node:crypto';
import {appendErasure,rotateErasureRegister,signErasureCheckpointRotation,validateErasureCheckpoint,
 verifyErasureCheckpointRotation} from './erasure-register.mjs';
import {canonical,inspectRestore,sha256} from './restore-guard.mjs';
import {writeR2ImmutableEvidence} from './r2-s3-object-store.mjs';

const projectRef=/^[a-z]{20}$/;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sha=/^[a-f0-9]{64}$/;
const etag=/^"[a-f0-9]{32,64}"$/;
const isoTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const encode=value=>Buffer.from(JSON.stringify(value)+'\n');
const decode=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
const publicIdentity=key=>sha256(createPublicKey(key).export({format:'der',type:'spki'}));

export function erasureRegisterBindingSha256({sourceProjectRef,storeIdentitySha256,trustedPublicKeyPem}){
 if(!projectRef.test(sourceProjectRef)||!sha.test(storeIdentitySha256))throw Error('INVALID_R2_ERASURE_CONFIGURATION');
 return sha256(canonical({source_project_ref:sourceProjectRef,storage_sha256:storeIdentitySha256,
  root_sha256:publicIdentity(trustedPublicKeyPem)}));
}

// All operator entry points share the same dedicated directory on the approved host.
// R2's pending state remains closed across restarts, even after a clean lock release.
export function createR2ErasureState({store,sourceProjectRef,coordinationDir,trustedPublicKeyPem}){
 if(typeof sourceProjectRef!=='string'||!projectRef.test(sourceProjectRef)
  ||typeof coordinationDir!=='string'||!path.isAbsolute(coordinationDir)||typeof store?.get!=='function')throw Error('INVALID_R2_ERASURE_CONFIGURATION');
 if(typeof trustedPublicKeyPem!=='string'||createPublicKey(trustedPublicKeyPem).asymmetricKeyType!=='ed25519'){
  throw Error('R2_ERASURE_TRUST_ANCHOR_REQUIRED');
 }
 const base='erasure/'+sourceProjectRef;
 const currentKey=base+'/current.json';
 const ledgerKey=sequence=>base+'/receipts/'+String(sequence).padStart(16,'0')+'.json';
 const emptySnapshot=encode({project_ref:sourceProjectRef,tables:[{schema:'auth',table:'users',rows:[]}]});
 const emptyDigest=sha256(emptySnapshot);
 let verified;

 async function withLock(run){
  const directory=await fs.realpath(coordinationDir),stat=await fs.stat(directory);
  if(!stat.isDirectory()||(stat.mode&0o077)!==0)throw Error('PRIVATE_ERASURE_COORDINATION_REQUIRED');
  const file=path.join(directory,sourceProjectRef+'.lock');
  let lock;
  try{lock=await fs.open(file,'wx',0o600);}
  catch(error){if(error.code==='EEXIST')throw Error('R2_ERASURE_BUSY');throw error;}
  try{return await run(directory);}
  finally{try{await lock.close();}finally{await fs.unlink(file);}}
 }

 async function readCurrent(){
  const record=await store.get(currentKey);
  if(!record)return null;
  if(!Buffer.isBuffer(record.bytes)||record.bytes.length>16384||!etag.test(record.etag))throw Error('INVALID_R2_ERASURE_STATE');
  const body=decode(record.bytes);
  if(!body||Object.keys(body).sort().join(',')!=='format,head,pending,source_project_ref'||body.format!==1
   ||body.source_project_ref!==sourceProjectRef||(!body.head&&!body.pending))throw Error('INVALID_R2_ERASURE_STATE');
  if(body.head!==null)validateErasureCheckpoint(body.head,sourceProjectRef);
  const pending=body.pending;
  if(pending!==null){
   const fields=pending&&Object.keys(pending).sort().join(',');
   const request=fields==='request_id,started_at'&&typeof pending.request_id==='string'&&uuid.test(pending.request_id);
   const rotation=fields==='next_public_key_sha256,started_at'&&body.head&&typeof pending.next_public_key_sha256==='string'&&sha.test(pending.next_public_key_sha256);
   if((!request&&!rotation)||!isoTime(pending.started_at))throw Error('INVALID_R2_ERASURE_STATE');
  }
  return {...body,etag:record.etag};
 }

 function putCurrent(record,head,pending){
  if(typeof store.put!=='function')throw Error('R2_ERASURE_WRITER_REQUIRED');
  const body=encode({format:1,source_project_ref:sourceProjectRef,head,pending});
  return store.put(currentKey,body,record?{ifMatch:record.etag}:{ifNoneMatch:'*'});
 }

 async function verifiedLedger(head){
  if(verified&&head.ledger_sequence<verified.head.ledger_sequence)throw Error('R2_ERASURE_HEAD_ROLLBACK');
  const remote=await store.get(ledgerKey(head.ledger_sequence));
  if(!Buffer.isBuffer(remote?.bytes)||remote.bytes.length>128*1024*1024)throw Error('R2_ERASURE_LEDGER_REQUIRED');
  if(sha256(remote.bytes)!==head.ledger_sha256)throw Error('R2_ERASURE_LEDGER_DIGEST_MISMATCH');
  if(verified&&head.ledger_sequence===verified.head.ledger_sequence){
   if(canonical(head)!==canonical(verified.head))throw Error('R2_ERASURE_TRUST_CHAIN_MISMATCH');
   return remote.bytes;
  }
  let previous=verified;
  for(let sequence=(previous?.head.ledger_sequence??0)+1;sequence<=head.ledger_sequence;sequence++){
   const stored=sequence===head.ledger_sequence?remote:await store.get(ledgerKey(sequence));
   if(!Buffer.isBuffer(stored?.bytes)||stored.bytes.length>128*1024*1024)throw Error('R2_ERASURE_LEDGER_REQUIRED');
   const proof=await store.get(rotationKey(sequence));
   let key=previous?.head.ledger_public_key_pem??trustedPublicKeyPem;
   let rotation=null;
   if(proof){
    if(!previous||!Buffer.isBuffer(proof.bytes)||proof.bytes.length>16384)throw Error('R2_ERASURE_ROTATION_PROOF_REQUIRED');
    rotation=decode(proof.bytes);
    if(canonical(rotation.previous_head)!==canonical(previous.head)||typeof rotation.next_public_key_pem!=='string'
     ||publicIdentity(rotation.next_public_key_pem)===publicIdentity(key))throw Error('R2_ERASURE_ROTATION_PROOF_REQUIRED');
    key=rotation.next_public_key_pem;
   }
   const candidate={format:1,source_project_ref:sourceProjectRef,ledger_sequence:sequence,
    ledger_sha256:sha256(stored.bytes),ledger_public_key_pem:key};
   if(rotation&&(rotation.next_sha256!==candidate.ledger_sha256||!verifyErasureCheckpointRotation({
    previous:previous.head,next:candidate,signature:rotation.signature
   })))throw Error('R2_ERASURE_ROTATION_PROOF_REQUIRED');
   if(sequence===head.ledger_sequence&&canonical(candidate)!==canonical(head))throw Error('R2_ERASURE_TRUST_CHAIN_MISMATCH');
   inspectRestore({snapshotBytes:emptySnapshot,ledgerBytes:stored.bytes,trust:{...candidate,snapshot_sha256:emptyDigest}});
   const ledger=decode(stored.bytes);
   const priorErasures=previous?.ledger.erasures??[];
   if(ledger.erasures.length!==priorErasures.length+(rotation?0:1)
    ||canonical(ledger.erasures.slice(0,priorErasures.length))!==canonical(priorErasures)
    ||previous&&Date.parse(ledger.issued_at)<Date.parse(previous.ledger.issued_at))throw Error('R2_ERASURE_TRUST_CHAIN_MISMATCH');
   previous={head:candidate,ledger};
  }
  verified=previous;
  return remote.bytes;
 }

 async function readyState(){
  const current=await readCurrent();
  if(current?.pending)throw Error('R2_ERASURE_PENDING');
  if(!current?.head)throw Error('R2_ERASURE_CHECKPOINT_REQUIRED');
  const next=current.head.ledger_sequence+1;
  if(!Number.isSafeInteger(next)||await store.get(ledgerKey(next)))throw Error('R2_ERASURE_HEAD_ROLLBACK');
  return current;
 }

 async function finish(current,head,publicKeyPem,ledgerBytes,rotation){
  const checkpoint={format:1,source_project_ref:sourceProjectRef,ledger_sha256:head.sha256,
   ledger_sequence:head.sequence,ledger_public_key_pem:publicKeyPem};
  await writeR2ImmutableEvidence({store,key:ledgerKey(head.sequence),bytes:ledgerBytes,expectedSha256:head.sha256});
  if(rotation){
   const bytes=encode(rotation);
   await writeR2ImmutableEvidence({store,key:rotationKey(head.sequence),bytes,expectedSha256:sha256(bytes)});
  }
  const previous=verified;
  try{
   await verifiedLedger(checkpoint);
   await putCurrent(current,checkpoint,null);
  }catch(error){
   verified=previous;
   throw error;
  }
  const {head:published}=await readyState();
  if(canonical(published)!==canonical(checkpoint))throw Error('R2_ERASURE_CHECKPOINT_READBACK_FAILED');
  return published;
 }

 const rotationKey=sequence=>ledgerKey(sequence)+'.rotation';

 return Object.freeze({
  sourceProjectRef,
  registerBindingSha256:store.identitySha256&&erasureRegisterBindingSha256({
   sourceProjectRef,storeIdentitySha256:store.identitySha256,trustedPublicKeyPem
  }),
  async begin(requestId,startedAt=new Date().toISOString()){
   if(typeof requestId!=='string'||!uuid.test(requestId)||!isoTime(startedAt)||Date.parse(startedAt)>Date.now())throw Error('INVALID_R2_ERASURE_INTENT');
   return withLock(async()=>{
    const current=await readCurrent();
    if(current?.pending){
     if(current.pending.request_id!==requestId)throw Error('R2_ERASURE_PENDING');
     return current.pending;
    }
    if(current){
     const {head}=await readyState();
     const ledger=JSON.parse(await verifiedLedger(head));
     if(ledger.erasures.some(receipt=>receipt.request_id===requestId))throw Error('R2_ERASURE_ALREADY_PUBLISHED');
    }
    const pending={request_id:requestId,started_at:startedAt};
    await putCurrent(current,current?.head??null,pending);
    if(canonical((await readCurrent())?.pending)!==canonical(pending))throw Error('R2_ERASURE_INTENT_READBACK_FAILED');
    return pending;
   });
  },
  async publish({entry,privateKeyPem,publicKeyPem}){
   if(typeof store.put!=='function')throw Error('R2_ERASURE_WRITER_REQUIRED');
   return withLock(async directory=>{
    const current=await readCurrent();
    if(!entry||entry.kind!=='organization'||!sha.test(entry.proof_sha256))throw Error('INVALID_R2_ERASURE_RECEIPT');
    if(!current?.pending){
     if(!current?.head)throw Error('R2_ERASURE_INTENT_REQUIRED');
     const {head}=await readyState();
     const ledger=JSON.parse(await verifiedLedger(head));
     if(ledger.erasures.some(receipt=>canonical(receipt)===canonical(entry)))return head;
     throw Error('R2_ERASURE_INTENT_REQUIRED');
    }
    if(current.pending.request_id!==entry.request_id)throw Error('R2_ERASURE_INTENT_REQUIRED');
    if(!current.head&&publicIdentity(publicKeyPem)!==publicIdentity(trustedPublicKeyPem))throw Error('R2_ERASURE_TRUST_CHAIN_MISMATCH');
    if(!isoTime(entry.completed_at)||Date.parse(entry.completed_at)<Date.parse(current.pending.started_at)||Date.parse(entry.completed_at)>Date.now())throw Error('INVALID_R2_ERASURE_RECEIPT_TIME');
    const staging=await fs.mkdtemp(path.join(directory,'.sign-'));
    try{
     const file=path.join(staging,'ledger.json'),previous=current.head;
     if(previous){
      if(previous.ledger_public_key_pem!==publicKeyPem)throw Error('R2_ERASURE_SIGNING_KEY_MISMATCH');
      await fs.writeFile(file,await verifiedLedger(previous),{mode:0o600});
     }
     const head=appendErasure({file,entry,sourceProjectRef,privateKeyPem,publicKeyPem,now:entry.completed_at,
      expectedHead:previous?.ledger_sha256??null,expectedSequence:previous?.ledger_sequence??0});
     if(head.replayed)throw Error('R2_ERASURE_UNEXPECTED_REPLAY');
     return await finish(current,head,publicKeyPem,await fs.readFile(file));
    }finally{await fs.rm(staging,{recursive:true,force:true});}
   });
  },
  async rotate({previousPrivateKeyPem,privateKeyPem,publicKeyPem,startedAt=new Date().toISOString()}){
   if(typeof store.put!=='function')throw Error('R2_ERASURE_WRITER_REQUIRED');
   const nextIdentity=publicIdentity(publicKeyPem),previousIdentity=publicIdentity(createPrivateKey(previousPrivateKeyPem));
   if(publicIdentity(createPrivateKey(privateKeyPem))!==nextIdentity)throw Error('R2_ERASURE_SIGNING_KEY_MISMATCH');
   if(!isoTime(startedAt)||Date.parse(startedAt)>Date.now())throw Error('INVALID_R2_ERASURE_ROTATION');
   return withLock(async directory=>{
    let current=await readCurrent();
    const previous=current?.head;
    if(!previous)throw Error('R2_ERASURE_CHECKPOINT_REQUIRED');
    if(current.pending&&current.pending.next_public_key_sha256!==nextIdentity)throw Error('R2_ERASURE_PENDING');
    if(!current.pending&&publicIdentity(previous.ledger_public_key_pem)===nextIdentity){
     await readyState();
     await verifiedLedger(previous);
     const stored=await store.get(rotationKey(previous.ledger_sequence));
     if(stored?.bytes){
      const proof=decode(stored.bytes);
      if(proof.previous_head&&publicIdentity(proof.previous_head.ledger_public_key_pem)===previousIdentity
       &&proof.next_sha256===previous.ledger_sha256
       &&proof.signature===signErasureCheckpointRotation({previous:proof.previous_head,
        head:{sha256:previous.ledger_sha256,sequence:previous.ledger_sequence},publicKeyPem,previousPrivateKeyPem}))return previous;
     }
     throw Error('R2_ERASURE_ROTATION_PROOF_REQUIRED');
    }
    if(publicIdentity(previous.ledger_public_key_pem)!==previousIdentity)throw Error('R2_ERASURE_PRIOR_SIGNING_KEY_MISMATCH');
    const ledger=await verifiedLedger(previous);
    const effectiveAt=current.pending?.started_at??startedAt;
    if(Date.parse(effectiveAt)<Date.parse(decode(ledger).issued_at))throw Error('REGISTER_CLOCK_REGRESSION');
    if(!current.pending){
     await readyState();
     const pending={next_public_key_sha256:nextIdentity,started_at:effectiveAt};
     await putCurrent(current,previous,pending);
     current=await readCurrent();
     if(canonical(current?.pending)!==canonical(pending)||canonical(current?.head)!==canonical(previous))throw Error('R2_ERASURE_INTENT_READBACK_FAILED');
    }
    const staging=await fs.mkdtemp(path.join(directory,'.rotate-'));
    try{
     const file=path.join(staging,'ledger.json');
     await fs.writeFile(file,ledger,{mode:0o600});
     const head=rotateErasureRegister({file,sourceProjectRef,privateKeyPem,publicKeyPem,now:effectiveAt,
      previousPublicKeyPem:previous.ledger_public_key_pem,expectedHead:previous.ledger_sha256,expectedSequence:previous.ledger_sequence});
     const signature=signErasureCheckpointRotation({previous,head,publicKeyPem,previousPrivateKeyPem});
     return await finish(current,head,publicKeyPem,await fs.readFile(file),{
      previous_head:previous,next_sha256:head.sha256,next_public_key_pem:publicKeyPem,signature
     });
    }finally{await fs.rm(staging,{recursive:true,force:true});}
   });
  },
  async withRestoreEvidence(snapshotSha256,restore){
   if(typeof snapshotSha256!=='string'||!sha.test(snapshotSha256)||typeof restore!=='function')throw Error('INVALID_R2_RESTORE_REQUEST');
   return withLock(async directory=>{
    const current=await readyState();
    const trust={...current.head,snapshot_sha256:snapshotSha256};
    const ledgerBytes=await verifiedLedger(current.head);
    let active=true;
    const readCheckpoint=async()=>{
     if(!active)throw Error('R2_ERASURE_GATE_ENDED');
     const latest=await readyState();
     if(latest.etag!==current.etag)throw Error('CURRENT_CHECKPOINT_CHANGED');
     return {...latest.head,snapshot_sha256:snapshotSha256};
    };
    try{return await restore({trust,ledgerBytes,readCheckpoint,coordinationDir:directory});}
    finally{active=false;}
   });
  }
 });
}
