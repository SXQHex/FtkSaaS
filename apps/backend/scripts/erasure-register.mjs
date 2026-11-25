import fs from 'node:fs';
import path from 'node:path';
import {createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import {canonical,inspectRestore,sha256} from './restore-guard.mjs';

// Independent register adapter. Keep its directory and signing key outside every
// restored database/backup. A locked or ambiguous state requires operator recovery.
export function appendErasure({entry,...options}){
 return updateRegister(options,{entry,rotation:false});
}

// The caller publishes the returned head and new public key to independent trust.
// That publication is separate from changing this signed register file.
export function rotateErasureRegister({previousPublicKeyPem,...options}){
 return updateRegister(options,{previousPublicKeyPem,rotation:true});
}

function syncDirectory(dir){
 const fd=fs.openSync(dir,'r');
 try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}

function withLock(lockFile,run){
 const fd=fs.openSync(lockFile,'wx',0o600),dir=path.dirname(lockFile);
 try{
  fs.fsyncSync(fd);
  syncDirectory(dir);
  return run();
 }finally{
  fs.closeSync(fd);
  fs.unlinkSync(lockFile);
  syncDirectory(dir);
 }
}

function writeExclusive(file,bytes){
 const fd=fs.openSync(file,'wx',0o600);
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
}

function readEvidence(file,maxBytes){
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
 try{
  const info=fs.fstatSync(fd);
  if(!info.isFile()||info.size>maxBytes)throw Error('INVALID_ERASURE_EVIDENCE_FILE');
  return fs.readFileSync(fd);
 }finally{fs.closeSync(fd);}
}

export function readErasureCheckpoint({checkpointFile,sourceProjectRef}){
 if(!path.isAbsolute(checkpointFile))throw Error('INDEPENDENT_CHECKPOINT_REQUIRED');
 ensureCheckpointReadable(checkpointFile);
 const current=validateErasureCheckpoint(JSON.parse(readEvidence(checkpointFile,16384).toString('utf8')),sourceProjectRef);
 ensureCheckpointReadable(checkpointFile);
 return current;
}

export function validateErasureCheckpoint(current,sourceProjectRef){
 if(!current||Object.keys(current).sort().join(',')!=='format,ledger_public_key_pem,ledger_sequence,ledger_sha256,source_project_ref'
  ||current.format!==1||typeof sourceProjectRef!=='string'||!(/^[a-z]{20}$/).test(sourceProjectRef)||current.source_project_ref!==sourceProjectRef
  ||typeof current.ledger_sha256!=='string'||!(/^[a-f0-9]{64}$/).test(current.ledger_sha256)
  ||!Number.isSafeInteger(current.ledger_sequence)||current.ledger_sequence<1
  ||typeof current.ledger_public_key_pem!=='string'||!current.ledger_public_key_pem.startsWith('-----BEGIN PUBLIC KEY-----'))throw Error('INVALID_ERASURE_CHECKPOINT');
 return current;
}

function ensureCheckpointReadable(checkpointFile){
 if(fs.existsSync(checkpointFile+'.pending')||fs.existsSync(checkpointFile+'.receipt-pending'))throw Error('CHECKPOINT_RECOVERY_REQUIRED');
}

function rotationMessage(previous,next){
 return Buffer.from(canonical({purpose:'erasure-checkpoint-key-rotation-v1',previous,next}));
}

export function resolveErasureCheckpointFile(registerFile,checkpointFile){
 if(typeof registerFile!=='string'||typeof checkpointFile!=='string'
  ||!path.isAbsolute(registerFile)||!path.isAbsolute(checkpointFile))throw Error('INDEPENDENT_CHECKPOINT_REQUIRED');
 const registerDir=fs.realpathSync(path.dirname(registerFile)),checkpointDir=fs.realpathSync(path.dirname(checkpointFile));
 const relative=path.relative(registerDir,checkpointDir);
 if(!relative||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep)))throw Error('INDEPENDENT_CHECKPOINT_REQUIRED');
 return path.join(checkpointDir,path.basename(checkpointFile));
}

export function resolveErasureCheckpointLock(checkpoint,lockFile=checkpoint+'.lock'){
 if(typeof lockFile!=='string'||!path.isAbsolute(lockFile))throw Error('INVALID_CHECKPOINT_LOCK');
 const lock=path.join(fs.realpathSync(path.dirname(lockFile)),path.basename(lockFile));
 if([checkpoint,checkpoint+'.pending',checkpoint+'.next',checkpoint+'.receipt-pending'].includes(lock))throw Error('INVALID_CHECKPOINT_LOCK');
 return lock;
}

export function signErasureCheckpointRotation({previous,head,publicKeyPem,previousPrivateKeyPem}){
 const next={...previous,ledger_sha256:head.sha256,ledger_sequence:head.sequence,ledger_public_key_pem:publicKeyPem};
 return sign(null,rotationMessage(previous,next),createPrivateKey(previousPrivateKeyPem)).toString('base64');
}

export function verifyErasureCheckpointRotation({previous,next,signature}){
 if(typeof signature!=='string')return false;
 return verify(null,rotationMessage(previous,next),createPublicKey(previous.ledger_public_key_pem),Buffer.from(signature,'base64'));
}

function withPublicationLocks({registerFile,checkpointFile,checkpointLockFile},run){
 const checkpoint=resolveErasureCheckpointFile(registerFile,checkpointFile);
 const register=path.join(fs.realpathSync(path.dirname(registerFile)),path.basename(registerFile));
 const registerLock=register+'.lock',checkpointLock=resolveErasureCheckpointLock(checkpoint,checkpointLockFile);
 return withLock(registerLock,()=>withLock(checkpointLock,()=>run(register,checkpoint)));
}

function currentCheckpoint(checkpointFile,sourceProjectRef){
 try{return readErasureCheckpoint({checkpointFile,sourceProjectRef});}
 catch(error){if(error.code!=='ENOENT')throw error;return null;}
}

export function publishErasureCheckpoint(options){
 return withPublicationLocks(options,(register,checkpoint)=>{
  const current=currentCheckpoint(checkpoint,options.sourceProjectRef);
  return publishCheckpointLocked(register,checkpoint,current,options);
 });
}

export function appendAndPublishErasure({file,entry,checkpointFile,checkpointLockFile,sourceProjectRef,privateKeyPem,publicKeyPem,now=new Date().toISOString()}){
 return withPublicationLocks({registerFile:file,checkpointFile,checkpointLockFile},(register,checkpoint)=>{
  const current=currentCheckpoint(checkpoint,sourceProjectRef);
  const previousLedgerBytes=current?readEvidence(register,128*1024*1024):undefined;
  const intent=checkpoint+'.receipt-pending',dir=path.dirname(checkpoint);
  const head=updateRegisterLocked({
   file:register,sourceProjectRef,privateKeyPem,publicKeyPem,now,
   expectedHead:current?.ledger_sha256??null,expectedSequence:current?.ledger_sequence??0
  },{entry,rotation:false},()=>{
   writeExclusive(intent,Buffer.from(sha256(canonical(entry))+'\n'));
   syncDirectory(dir);
  });
  publishCheckpointLocked(register,checkpoint,current,{sourceProjectRef,publicKeyPem,head,expected:current,previousLedgerBytes,now:Date.parse(now)});
  if(!head.replayed){
   fs.unlinkSync(intent);
   syncDirectory(dir);
  }
  return head;
 });
}

function publishCheckpointLocked(register,checkpoint,current,{
 sourceProjectRef,expected,head,publicKeyPem,previousLedgerBytes,rotationSignature,now=Date.now()
}){
  const checkpointDir=path.dirname(checkpoint),pending=checkpoint+'.pending',staging=checkpoint+'.next';
  if(fs.existsSync(register+'.pending'))throw Error('REGISTER_RECOVERY_REQUIRED');
  const next={format:1,source_project_ref:sourceProjectRef,ledger_sha256:head.sha256,ledger_sequence:head.sequence,ledger_public_key_pem:publicKeyPem};
  const snapshotBytes=Buffer.from(JSON.stringify({project_ref:sourceProjectRef,tables:[{schema:'auth',table:'users',rows:[]}]}));
  const snapshotHash=sha256(snapshotBytes),ledgerBytes=readEvidence(register,128*1024*1024);
  inspectRestore({snapshotBytes,ledgerBytes,trust:{...next,snapshot_sha256:snapshotHash},now});
  if(canonical(current)===canonical(next)){
   syncDirectory(checkpointDir);
   return current;
  }
  if(canonical(current)!==canonical(expected)||next.ledger_sequence!==(current?.ledger_sequence??0)+1)throw Error('CHECKPOINT_HEAD_CONFLICT');
  if(current){
   if(!Buffer.isBuffer(previousLedgerBytes))throw Error('PREVIOUS_ERASURE_LEDGER_REQUIRED');
   inspectRestore({snapshotBytes,ledgerBytes:previousLedgerBytes,trust:{...current,snapshot_sha256:snapshotHash},now});
   const previousEntries=JSON.parse(previousLedgerBytes).erasures,nextEntries=JSON.parse(ledgerBytes).erasures;
   const previousKey=createPublicKey(current.ledger_public_key_pem),nextKey=createPublicKey(publicKeyPem);
   const rotation=!previousKey.export({type:'spki',format:'der'}).equals(nextKey.export({type:'spki',format:'der'}));
   if(nextEntries.length!==previousEntries.length+(rotation?0:1)
    ||canonical(nextEntries.slice(0,previousEntries.length))!==canonical(previousEntries))throw Error('CHECKPOINT_ERASURE_HISTORY_MISMATCH');
   if(rotation&&(typeof rotationSignature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(rotationSignature)
    ||!verify(null,rotationMessage(current,next),previousKey,Buffer.from(rotationSignature,'base64'))))throw Error('CHECKPOINT_ROTATION_NOT_AUTHORIZED');
  }

  writeExclusive(pending,JSON.stringify(next)+'\n');
  syncDirectory(checkpointDir);
  fs.linkSync(pending,staging);
  fs.renameSync(staging,checkpoint);
  syncDirectory(checkpointDir);
  fs.unlinkSync(pending);
  syncDirectory(checkpointDir);
  return next;
}

function updateRegister(options,mutation){
 const {file}=options;
 if(typeof file!=='string'||!path.isAbsolute(file))throw Error('INVALID_REGISTER_ARGUMENT');
 const dir=path.dirname(file);
 if(!fs.statSync(dir).isDirectory()||fs.lstatSync(dir).isSymbolicLink())throw Error('INVALID_REGISTER_DIRECTORY');
 return withLock(file+'.lock',()=>updateRegisterLocked(options,mutation));
}

function updateRegisterLocked(
 {file,privateKeyPem,publicKeyPem,sourceProjectRef,expectedHead,expectedSequence,now=new Date().toISOString()},
 {entry,previousPublicKeyPem=publicKeyPem,rotation},beforeWrite
){
 if(!Number.isSafeInteger(expectedSequence)||expectedSequence<0)throw Error('INVALID_REGISTER_ARGUMENT');
 const secret=createPrivateKey(privateKeyPem),pub=createPublicKey(publicKeyPem);
 const nextKey=pub.export({type:'spki',format:'der'});
 if(secret.asymmetricKeyType!=='ed25519'||pub.asymmetricKeyType!=='ed25519'||!createPublicKey(secret).export({type:'spki',format:'der'}).equals(nextKey))throw Error('REGISTER_KEY_MISMATCH');
 if(rotation){
  if(expectedSequence===0)throw Error('REGISTER_ROTATION_REQUIRES_HEAD');
  const priorKey=createPublicKey(previousPublicKeyPem);
  if(priorKey.asymmetricKeyType!=='ed25519')throw Error('INVALID_LEDGER_KEY');
  if(priorKey.export({type:'spki',format:'der'}).equals(nextKey))throw Error('REGISTER_ROTATION_SAME_KEY');
 }
 const dir=path.dirname(file),temporary=file+'.pending';
 const blank=Buffer.from(JSON.stringify({project_ref:sourceProjectRef,tables:[{schema:'auth',table:'users',rows:[]}]}));
 const check=(bytes,keyPem)=>inspectRestore({snapshotBytes:blank,ledgerBytes:bytes,trust:{format:1,source_project_ref:sourceProjectRef,snapshot_sha256:sha256(blank),ledger_sha256:sha256(bytes),ledger_sequence:JSON.parse(bytes).sequence,ledger_public_key_pem:keyPem},now:Date.parse(now)});
  if(fs.existsSync(temporary))throw Error('REGISTER_RECOVERY_REQUIRED');
  let previous;
  if(fs.existsSync(file)){
   if(fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile())throw Error('INVALID_REGISTER_FILE');
   const previousBytes=readEvidence(file,128*1024*1024);if(sha256(previousBytes)!==expectedHead)throw Error('REGISTER_HEAD_CONFLICT');
   check(previousBytes,previousPublicKeyPem);previous=JSON.parse(previousBytes);if(previous.sequence!==expectedSequence)throw Error('REGISTER_SEQUENCE_CONFLICT');
   if(Date.parse(now)<Date.parse(previous.issued_at))throw Error('REGISTER_CLOCK_REGRESSION');
   if(!rotation){
    const same=previous.erasures.find(e=>e.request_id===entry?.request_id);
    if(same){if(canonical(same)!==canonical(entry))throw Error('ERASURE_RECEIPT_CONFLICT');return{sequence:previous.sequence,sha256:expectedHead,replayed:true};}
   }
  }else if(expectedHead!==null||expectedSequence!==0)throw Error('REGISTER_HEAD_CONFLICT');
  const erasures=previous?.erasures??[];
  if(!rotation)erasures.push(entry);
  const payload={format:1,source_project_ref:sourceProjectRef,sequence:expectedSequence+1,issued_at:now,erasures};
  const ledger={...payload,signature:sign(null,Buffer.from(canonical(payload)),secret).toString('base64')};const bytes=Buffer.from(JSON.stringify(ledger));check(bytes,publicKeyPem);
  beforeWrite?.();
  writeExclusive(temporary,bytes);
  fs.renameSync(temporary,file);syncDirectory(dir);
  return{sequence:ledger.sequence,sha256:sha256(bytes),replayed:false};
}
