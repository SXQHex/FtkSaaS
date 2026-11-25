import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createR2ErasureState} from '../scripts/r2-erasure-state.mjs';
import {writeR2ImmutableEvidence} from '../scripts/r2-s3-object-store.mjs';
import {sha256} from '../scripts/restore-guard.mjs';

const sourceProjectRef='ftknativereceipttest';
const initialTime='2026-11-25T00:00:00.000Z';
const requestId='01900000-0000-7000-8000-000000000001';
const anotherRequest='01900000-0000-7000-8000-000000000002';
const subjectId='01900000-0000-7000-8000-000000000003';
const entry={request_id:requestId,kind:'organization',subject_ids:[subjectId],proof_sha256:'a'.repeat(64),completed_at:initialTime};

function objectStore(){
 const data=new Map();
 return {
  data,
  async get(key){
   const bytes=data.get(key);
   return bytes&&{bytes:Buffer.from(bytes),etag:'"'+sha256(bytes)+'"'};
  },
  async put(key,bytes,condition){
   const previous=await this.get(key);
   if(condition.ifNoneMatch==='*'?previous:previous?.etag!==condition.ifMatch)throw Error('R2_ERASURE_PRECONDITION_FAILED');
   data.set(key,Buffer.from(bytes));
  }
 };
}

async function fixture(t){
 const coordinationDir=await mkdtemp(path.join(os.tmpdir(),'r2-erasure-state-'));
 t.after(()=>rm(coordinationDir,{recursive:true,force:true}));
 const store=objectStore(),{privateKey,publicKey}=generateKeyPairSync('ed25519');
 const keys={privateKeyPem:privateKey.export({type:'pkcs8',format:'pem'}),publicKeyPem:publicKey.export({type:'spki',format:'pem'})};
 const config={sourceProjectRef,coordinationDir,store,trustedPublicKeyPem:keys.publicKeyPem};
 return {store,keys,config,state:createR2ErasureState(config)};
}

test('a pending imha survives restart and gates restore until its signed receipt is published',async t=>{
 const {store,keys,config,state}=await fixture(t);
 const source='org-source';
 const digest=sha256(source);
 await assert.rejects(state.withRestoreEvidence(digest,()=>assert.fail('missing checkpoint used')),/R2_ERASURE_CHECKPOINT_REQUIRED/);
 await state.begin(requestId,initialTime);
 const worker=createR2ErasureState(config);
 await assert.rejects(worker.withRestoreEvidence(digest,()=>assert.fail('pending imha bypassed')),/R2_ERASURE_PENDING/);
 await assert.rejects(worker.begin(anotherRequest,initialTime),/R2_ERASURE_PENDING/);
 const input={entry,...keys};
 await assert.rejects(worker.publish({...input,entry:{...entry,request_id:anotherRequest}}),/R2_ERASURE_INTENT_REQUIRED/);
 const published=await worker.publish(input);
 assert.equal(published.ledger_sequence,1);
 assert.deepEqual(await worker.publish(input),published);
 assert.equal(store.data.size,2);
 await worker.withRestoreEvidence(digest,async({trust,ledgerBytes,readCheckpoint})=>{
  assert.deepEqual(trust,await readCheckpoint());
  assert.equal(trust.snapshot_sha256,digest);
  assert.equal(trust.ledger_sha256,sha256(ledgerBytes));
  assert.deepEqual(JSON.parse(ledgerBytes).erasures,[entry]);
 });
});

test('a restore holds the common host lock and an older remote head is rejected',async t=>{
 const {store,keys,config,state}=await fixture(t);
 const publisher=createR2ErasureState(config),digest=sha256('snapshot');
 await state.begin(requestId,initialTime);
 await state.publish({entry,...keys});
 const current=[...store.data.keys()].find(key=>key.endsWith('/current.json'));
 const saved=Buffer.from(store.data.get(current));
 await state.withRestoreEvidence(digest,async()=>{
  await assert.rejects(publisher.begin(anotherRequest,initialTime),/R2_ERASURE_BUSY/);
 });
 await publisher.begin(anotherRequest,initialTime);
 await publisher.publish({entry:{...entry,request_id:anotherRequest},...keys});
 store.data.set(current,saved);
 await assert.rejects(state.withRestoreEvidence(digest,()=>assert.fail('old checkpoint accepted')),/R2_ERASURE_HEAD_ROLLBACK/);
});

test('an interrupted remote checkpoint publication can replay using the identical immutable ledger',async t=>{
 const {store,keys,config,state}=await fixture(t);
 await state.begin(requestId,initialTime);
 const put=store.put.bind(store);
 store.put=async(key,...args)=>{
  if(key.endsWith('/current.json'))throw Error('R2_PUT_OUTCOME_UNKNOWN');
  return put(key,...args);
 };
 await assert.rejects(state.publish({entry,...keys}),/R2_PUT_OUTCOME_UNKNOWN/);
 assert.equal(store.data.size,2);
 await assert.rejects(state.withRestoreEvidence(sha256('snapshot'),()=>assert.fail('old checkpoint resumed')),/R2_ERASURE_PENDING/);
 // A protected R2 object returns its lock error before the create-only condition.
 store.put=async(key,...args)=>{
  if(key.includes('/receipts/')&&store.data.has(key))throw Error('R2_ERASURE_OBJECT_LOCKED');
  return put(key,...args);
 };
 const worker=createR2ErasureState(config);
 assert.equal((await worker.publish({entry,...keys})).ledger_sequence,1);
 assert.equal(store.data.size,2);
});

test('key rotation preserves erasures and fences a restore across interrupted publication',async t=>{
 const {store,keys,config,state}=await fixture(t);
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const next={privateKeyPem:privateKey.export({type:'pkcs8',format:'pem'}),publicKeyPem:publicKey.export({type:'spki',format:'pem'})};
 const rotate={...next,previousPrivateKeyPem:keys.privateKeyPem,startedAt:initialTime};
 await state.begin(requestId,initialTime);
 await state.publish({entry,...keys});
 await assert.rejects(state.rotate({...rotate,previousPrivateKeyPem:next.privateKeyPem}),/R2_ERASURE_PRIOR_SIGNING_KEY_MISMATCH/);
 const put=store.put.bind(store);
 store.put=async(key,bytes,condition)=>{
  if(key.endsWith('/current.json')&&JSON.parse(bytes).pending===null)throw Error('R2_PUT_OUTCOME_UNKNOWN');
  return put(key,bytes,condition);
 };
 await assert.rejects(state.rotate(rotate),/R2_PUT_OUTCOME_UNKNOWN/);
 const restarted=createR2ErasureState(config),digest=sha256('approved snapshot');
 await assert.rejects(restarted.withRestoreEvidence(digest,()=>assert.fail('rotation still pending')),/R2_ERASURE_PENDING/);
 store.put=put;
 const rotated=await restarted.rotate(rotate);
 assert.equal(rotated.ledger_sequence,2);
 assert.equal(rotated.ledger_public_key_pem,next.publicKeyPem);
 assert.deepEqual(await restarted.rotate(rotate),rotated);
 await restarted.withRestoreEvidence(digest,async({ledgerBytes})=>assert.deepEqual(JSON.parse(ledgerBytes).erasures,[entry]));
 const proofKey=[...store.data.keys()].find(key=>key.endsWith('.rotation'));
 store.data.delete(proofKey);
 await assert.rejects(createR2ErasureState(config).withRestoreEvidence(digest,()=>assert.fail('unproved rotation used')),
  /R2_ERASURE_TRUST_CHAIN_MISMATCH/);
});

test('the reader rejects a complete checkpoint and receipt signed by an unrelated root',async t=>{
 const trusted=await fixture(t),replacement=await fixture(t);
 await replacement.state.begin(requestId,initialTime);
 await replacement.state.publish({entry,...replacement.keys});
 for(const [key,bytes] of replacement.store.data)trusted.store.data.set(key,bytes);
 await assert.rejects(trusted.state.withRestoreEvidence(sha256('snapshot'),()=>assert.fail('foreign trust anchor used')),
  /R2_ERASURE_TRUST_CHAIN_MISMATCH/);
});

test('archive evidence only accepts the approved checksum and verifies immutable readback',async()=>{
 const store=objectStore(),key='archive/fixture',bytes=Buffer.from('approved evidence'),different=Buffer.from('different evidence');
 const proof={store,key,bytes,expectedSha256:sha256(bytes)};
 await assert.rejects(writeR2ImmutableEvidence({...proof,bytes:different}),/R2_EVIDENCE_DIGEST_MISMATCH/);
 assert.equal(store.data.size,0);
 assert.deepEqual(await writeR2ImmutableEvidence(proof),{sha256:sha256(bytes),bytes:bytes.length});
 assert.deepEqual(await writeR2ImmutableEvidence(proof),{sha256:sha256(bytes),bytes:bytes.length});
 await assert.rejects(writeR2ImmutableEvidence({...proof,bytes:different,expectedSha256:sha256(different)}),/R2_IMMUTABLE_EVIDENCE_CONFLICT/);
 assert.deepEqual((await store.get(key)).bytes,bytes);
});
