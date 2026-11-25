import fs from 'node:fs';
import path from 'node:path';
import {canonical,inspectRestore,sha256} from './restore-guard.mjs';
import {readErasureCheckpoint,resolveErasureCheckpointFile,resolveErasureCheckpointLock} from './erasure-register.mjs';
function syncDirectory(file){const fd=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
// The callback API remains compatible. A transaction keeps its rollback boundary
// through the last register/checkpoint check. Neither API opens service access.
export async function guardedRestore({snapshotBytes,registerFile,trust,apply,transaction,readCheckpoint,checkpointFile,checkpointLockFile,now=Date.now()}){
 if(transaction!==undefined){
  if(apply!==undefined||!transaction||['prepare','commit','rollback'].some(k=>typeof transaction[k]!=='function'))throw Error('RESTORE_TRANSACTION_REQUIRED');
 }else if(typeof apply!=='function')throw Error('RESTORE_ADAPTER_REQUIRED');
 if(readCheckpoint!==undefined&&typeof readCheckpoint!=='function')throw Error('CURRENT_CHECKPOINT_REQUIRED');
 if(checkpointFile!==undefined&&readCheckpoint!==undefined)throw Error('RESTORE_CHECKPOINT_SOURCE_AMBIGUOUS');
 if(checkpointLockFile!==undefined&&checkpointFile===undefined)throw Error('INDEPENDENT_CHECKPOINT_REQUIRED');
 // Capture caller-owned objects and methods before crossing an asynchronous boundary.
 const trusted=freeze(structuredClone(trust)),bytes=Buffer.from(snapshotBytes);
 const expectedCheckpoint=canonical(trusted),tx=transaction&&Object.fromEntries(['prepare','commit','rollback'].map(k=>[k,transaction[k].bind(transaction)]));
 const checkpoint=checkpointFile===undefined?null:resolveErasureCheckpointFile(registerFile,checkpointFile);
 const readCurrent=checkpoint?()=>({
  ...readErasureCheckpoint({checkpointFile:checkpoint,sourceProjectRef:trusted.source_project_ref}),
  snapshot_sha256:trusted.snapshot_sha256
 }):readCheckpoint;
 const checkCurrent=async()=>{
  if(readCurrent&&canonical(await readCurrent())!==expectedCheckpoint)throw Error('CURRENT_CHECKPOINT_CHANGED');
 };
 let fd,checkpointFd,prepared=false,commitAttempted=false,committed=false,failed=false;
 const lock=registerFile+'.lock',checkpointLock=checkpoint&&resolveErasureCheckpointLock(checkpoint,checkpointLockFile);
 const checkRegister=checkedHead=>{
  if(fs.existsSync(registerFile+'.pending'))throw Error('REGISTER_RECOVERY_REQUIRED');
  if(fs.lstatSync(registerFile).isSymbolicLink()||!fs.statSync(registerFile).isFile())throw Error('INVALID_REGISTER_FILE');
  if(checkedHead&&sha256(fs.readFileSync(registerFile))!==checkedHead)throw Error('REGISTER_CHANGED_DURING_RESTORE');
 };
 try{
  fd=fs.openSync(lock,'wx',0o600);fs.fsyncSync(fd);syncDirectory(registerFile);
  // The publisher uses the same order. A restore using a separate copy of the
  // register still fences publication until its transaction has finished.
  if(checkpointLock){
   try{checkpointFd=fs.openSync(checkpointLock,'wx',0o600);}
   catch(error){
    if(error.code==='EEXIST')throw Error('RESTORE_CHECKPOINT_BUSY');
    throw error;
   }
  }
  checkRegister();await checkCurrent();
  const proof=freeze(inspectRestore({snapshotBytes:bytes,ledgerBytes:fs.readFileSync(registerFile),trust:trusted,now}));
  const snapshot=freeze(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  if(tx){prepared=true;await tx.prepare(snapshot,proof,Buffer.from(bytes));}else await apply(snapshot,proof);
  // A pending append or an independently advanced checkpoint must abort while
  // the adapter can still roll back. Recheck local bytes after awaiting current head.
  await checkCurrent();checkRegister(proof.ledger_sha256);
  if(tx){commitAttempted=true;await tx.commit();prepared=false;committed=true;}
  return{...proof,result:tx?'validated_transaction_committed':'validated_snapshot_adapter_completed',scope:'adapter completion only; service access must remain closed pending full recovery checks'};
 }catch(error){
  failed=true;
  let rollbackError;
  if(prepared)try{await tx.rollback();}catch(e){rollbackError=e;}
  if(commitAttempted)throw new Error('RESTORE_COMMIT_OUTCOME_UNKNOWN',{cause:error});
  if(rollbackError)throw new Error('RESTORE_ROLLBACK_FAILED',{cause:new AggregateError([error,rollbackError])});
  throw error;
 }finally{
  try{
   try{if(checkpointFd!==undefined){fs.closeSync(checkpointFd);fs.unlinkSync(checkpointLock);}}
   finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);syncDirectory(registerFile);}}
  }catch(error){
   if(!failed)throw new Error(committed?'RESTORE_POST_COMMIT_CLEANUP_FAILED':'RESTORE_LOCK_CLEANUP_FAILED',{cause:error});
  }
 }
}
