import fs from 'node:fs';
import path from 'node:path';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {canonical,inspectRestore,sha256} from './restore-guard.mjs';

// Independent register adapter. Keep its directory and signing key outside every
// restored database/backup. A locked or ambiguous state requires operator recovery.
export function appendErasure({file,privateKeyPem,publicKeyPem,sourceProjectRef,expectedHead,expectedSequence,entry,now=new Date().toISOString()}){
 if(typeof file!=='string'||!path.isAbsolute(file)||!Number.isSafeInteger(expectedSequence)||expectedSequence<0)throw Error('INVALID_REGISTER_ARGUMENT');
 const secret=createPrivateKey(privateKeyPem),pub=createPublicKey(publicKeyPem);
 if(secret.asymmetricKeyType!=='ed25519'||pub.asymmetricKeyType!=='ed25519'||!createPublicKey(secret).export({type:'spki',format:'der'}).equals(pub.export({type:'spki',format:'der'})))throw Error('REGISTER_KEY_MISMATCH');
 const dir=path.dirname(file);if(!fs.statSync(dir).isDirectory()||fs.lstatSync(dir).isSymbolicLink())throw Error('INVALID_REGISTER_DIRECTORY');
 let lock,temporary;const lockFile=file+'.lock';
 const syncDirectory=()=>{const fd=fs.openSync(dir,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
 const blank=Buffer.from(JSON.stringify({project_ref:sourceProjectRef,tables:[{schema:'auth',table:'users',rows:[]}]}));
 const check=bytes=>inspectRestore({snapshotBytes:blank,ledgerBytes:bytes,trust:{format:1,source_project_ref:sourceProjectRef,snapshot_sha256:sha256(blank),ledger_sha256:sha256(bytes),ledger_sequence:JSON.parse(bytes).sequence,ledger_public_key_pem:publicKeyPem},now:Date.parse(now)});
 try{
  lock=fs.openSync(lockFile,'wx',0o600);fs.fsyncSync(lock);syncDirectory();
  if(fs.existsSync(file+'.pending'))throw Error('REGISTER_RECOVERY_REQUIRED');
  let previous,previousBytes;
  if(fs.existsSync(file)){
   if(fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile())throw Error('INVALID_REGISTER_FILE');
   previousBytes=fs.readFileSync(file);if(sha256(previousBytes)!==expectedHead)throw Error('REGISTER_HEAD_CONFLICT');
   check(previousBytes);previous=JSON.parse(previousBytes);if(previous.sequence!==expectedSequence)throw Error('REGISTER_SEQUENCE_CONFLICT');
   if(Date.parse(now)<Date.parse(previous.issued_at))throw Error('REGISTER_CLOCK_REGRESSION');
   const same=previous.erasures.find(e=>e.request_id===entry?.request_id);
   if(same){if(canonical(same)!==canonical(entry))throw Error('ERASURE_RECEIPT_CONFLICT');return{sequence:previous.sequence,sha256:expectedHead,replayed:true};}
  }else if(expectedHead!==null||expectedSequence!==0)throw Error('REGISTER_HEAD_CONFLICT');
  const payload={format:1,source_project_ref:sourceProjectRef,sequence:expectedSequence+1,issued_at:now,erasures:[...(previous?.erasures??[]),entry]};
  const ledger={...payload,signature:sign(null,Buffer.from(canonical(payload)),secret).toString('base64')};const bytes=Buffer.from(JSON.stringify(ledger));check(bytes);
  temporary=file+'.pending';let fd;
  try{fd=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{if(fd!==undefined)fs.closeSync(fd);}
  fs.renameSync(temporary,file);temporary=undefined;
  const directory=fs.openSync(dir,'r');try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}
  return{sequence:ledger.sequence,sha256:sha256(bytes),replayed:false};
 }finally{
  // Never remove a lock owned by another caller. A leftover .pending file is
  // ambiguous after a crash; do not silently replace it with another head.
  if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(lockFile);syncDirectory();}
 }
}
