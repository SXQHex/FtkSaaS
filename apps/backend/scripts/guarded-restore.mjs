import fs from 'node:fs';
import path from 'node:path';
function syncDirectory(file){const fd=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
import {inspectRestore,sha256} from './restore-guard.mjs';
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
// The adapter receives only the exact validated snapshot, never an unrelated SQL
// file. Keep service access closed; this primitive does not certify full recovery.
export async function guardedRestore({snapshotBytes,registerFile,trust,apply,now=Date.now()}){
 if(typeof apply!=='function')throw Error('RESTORE_ADAPTER_REQUIRED');
 let fd;const lock=registerFile+'.lock';
 try{
  fd=fs.openSync(lock,'wx',0o600);fs.fsyncSync(fd);syncDirectory(registerFile);
  if(fs.existsSync(registerFile+'.pending'))throw Error('REGISTER_RECOVERY_REQUIRED');
  if(fs.lstatSync(registerFile).isSymbolicLink()||!fs.statSync(registerFile).isFile())throw Error('INVALID_REGISTER_FILE');
  const bytes=Buffer.from(snapshotBytes),ledgerBytes=fs.readFileSync(registerFile);
  const proof=inspectRestore({snapshotBytes:bytes,ledgerBytes,trust,now});
  const snapshot=freeze(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  const checkedHead=proof.ledger_sha256;
  await apply(snapshot,freeze({...proof}));
  if(sha256(fs.readFileSync(registerFile))!==checkedHead)throw Error('REGISTER_CHANGED_DURING_RESTORE');
  return{...proof,result:'validated_snapshot_adapter_completed',scope:'adapter completion only; service access must remain closed pending full recovery checks'};
 }finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);syncDirectory(registerFile);}}
}
