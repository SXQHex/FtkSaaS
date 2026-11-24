import fs from 'node:fs';
import path from 'node:path';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
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

function updateRegister(
 {file,privateKeyPem,publicKeyPem,sourceProjectRef,expectedHead,expectedSequence,now=new Date().toISOString()},
 {entry,previousPublicKeyPem=publicKeyPem,rotation}
){
 if(typeof file!=='string'||!path.isAbsolute(file)||!Number.isSafeInteger(expectedSequence)||expectedSequence<0)throw Error('INVALID_REGISTER_ARGUMENT');
 const secret=createPrivateKey(privateKeyPem),pub=createPublicKey(publicKeyPem);
 const nextKey=pub.export({type:'spki',format:'der'});
 if(secret.asymmetricKeyType!=='ed25519'||pub.asymmetricKeyType!=='ed25519'||!createPublicKey(secret).export({type:'spki',format:'der'}).equals(nextKey))throw Error('REGISTER_KEY_MISMATCH');
 if(rotation){
  if(expectedSequence===0)throw Error('REGISTER_ROTATION_REQUIRES_HEAD');
  const priorKey=createPublicKey(previousPublicKeyPem);
  if(priorKey.asymmetricKeyType!=='ed25519')throw Error('INVALID_LEDGER_KEY');
  if(priorKey.export({type:'spki',format:'der'}).equals(nextKey))throw Error('REGISTER_ROTATION_SAME_KEY');
 }
 const dir=path.dirname(file);if(!fs.statSync(dir).isDirectory()||fs.lstatSync(dir).isSymbolicLink())throw Error('INVALID_REGISTER_DIRECTORY');
 let lock;const lockFile=file+'.lock',temporary=file+'.pending';
 const syncDirectory=()=>{const fd=fs.openSync(dir,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
 const blank=Buffer.from(JSON.stringify({project_ref:sourceProjectRef,tables:[{schema:'auth',table:'users',rows:[]}]}));
 const check=(bytes,keyPem)=>inspectRestore({snapshotBytes:blank,ledgerBytes:bytes,trust:{format:1,source_project_ref:sourceProjectRef,snapshot_sha256:sha256(blank),ledger_sha256:sha256(bytes),ledger_sequence:JSON.parse(bytes).sequence,ledger_public_key_pem:keyPem},now:Date.parse(now)});
 try{
  lock=fs.openSync(lockFile,'wx',0o600);fs.fsyncSync(lock);syncDirectory();
  if(fs.existsSync(temporary))throw Error('REGISTER_RECOVERY_REQUIRED');
  let previous;
  if(fs.existsSync(file)){
   if(fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile())throw Error('INVALID_REGISTER_FILE');
   const previousBytes=fs.readFileSync(file);if(sha256(previousBytes)!==expectedHead)throw Error('REGISTER_HEAD_CONFLICT');
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
  let fd;
  try{fd=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{if(fd!==undefined)fs.closeSync(fd);}
  fs.renameSync(temporary,file);syncDirectory();
  return{sequence:ledger.sequence,sha256:sha256(bytes),replayed:false};
 }finally{
  // Never remove a lock owned by another caller. A leftover .pending file is
  // ambiguous after a crash; do not silently replace it with another head.
  if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(lockFile);syncDirectory();}
 }
}
