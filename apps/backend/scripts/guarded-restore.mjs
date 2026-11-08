import fs from 'node:fs';
import path from 'node:path';
import {canonical,inspectRestore,sha256} from './restore-guard.mjs';
function syncDirectory(file){const fd=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
// The callback API remains compatible. A transaction keeps its rollback boundary
// through the last register/checkpoint check. Neither API opens service access.
export async function guardedRestore({snapshotBytes,registerFile,trust,apply,transaction,readCheckpoint,now=Date.now()}){
 if(transaction!==undefined){
  if(apply!==undefined||!transaction||['prepare','commit','rollback'].some(k=>typeof transaction[k]!=='function'))throw Error('RESTORE_TRANSACTION_REQUIRED');
 }else if(typeof apply!=='function')throw Error('RESTORE_ADAPTER_REQUIRED');
 if(readCheckpoint!==undefined&&typeof readCheckpoint!=='function')throw Error('CURRENT_CHECKPOINT_REQUIRED');
 // Capture caller-owned objects and methods before crossing an asynchronous boundary.
 const trusted=freeze(structuredClone(trust)),bytes=Buffer.from(snapshotBytes);
 const expectedCheckpoint=canonical(trusted),tx=transaction&&Object.fromEntries(['prepare','commit','rollback'].map(k=>[k,transaction[k].bind(transaction)]));
 const checkCurrent=async()=>{
  if(readCheckpoint&&canonical(await readCheckpoint())!==expectedCheckpoint)throw Error('CURRENT_CHECKPOINT_CHANGED');
 };
 let fd,prepared=false,commitAttempted=false;const lock=registerFile+'.lock';
 const checkRegister=checkedHead=>{
  if(fs.existsSync(registerFile+'.pending'))throw Error('REGISTER_RECOVERY_REQUIRED');
  if(fs.lstatSync(registerFile).isSymbolicLink()||!fs.statSync(registerFile).isFile())throw Error('INVALID_REGISTER_FILE');
  if(checkedHead&&sha256(fs.readFileSync(registerFile))!==checkedHead)throw Error('REGISTER_CHANGED_DURING_RESTORE');
 };
 try{
  fd=fs.openSync(lock,'wx',0o600);fs.fsyncSync(fd);syncDirectory(registerFile);
  checkRegister();await checkCurrent();
  const proof=freeze(inspectRestore({snapshotBytes:bytes,ledgerBytes:fs.readFileSync(registerFile),trust:trusted,now}));
  const snapshot=freeze(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  if(tx){prepared=true;await tx.prepare(snapshot,proof,Buffer.from(bytes));}else await apply(snapshot,proof);
  // A pending append or an independently advanced checkpoint must abort while
  // the adapter can still roll back. Recheck local bytes after awaiting current head.
  await checkCurrent();checkRegister(proof.ledger_sha256);
  if(tx){commitAttempted=true;await tx.commit();prepared=false;}
  return{...proof,result:tx?'validated_transaction_committed':'validated_snapshot_adapter_completed',scope:'adapter completion only; service access must remain closed pending full recovery checks'};
 }catch(error){
  let rollbackError;
  if(prepared)try{await tx.rollback();}catch(e){rollbackError=e;}
  if(commitAttempted)throw new Error('RESTORE_COMMIT_OUTCOME_UNKNOWN',{cause:error});
  if(rollbackError)throw new Error('RESTORE_ROLLBACK_FAILED',{cause:new AggregateError([error,rollbackError])});
  throw error;
 }finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);syncDirectory(registerFile);}}
}
