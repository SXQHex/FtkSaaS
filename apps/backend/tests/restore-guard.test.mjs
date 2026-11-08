import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,sign} from 'node:crypto';
import {inspectRestore,canonical,sha256} from '../scripts/restore-guard.mjs';
const erased='01900000-0000-7000-8000-000000000001',request='01900000-0000-7000-8000-000000000002',other='01900000-0000-7000-8000-000000000003';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');const pem=publicKey.export({type:'spki',format:'pem'});const now=Date.parse('2026-10-29T12:00:00.000Z');
function fixture(row={id:other}){
 const payload={format:1,source_project_ref:'abcdefghijklmnopqrst',sequence:2,issued_at:'2026-10-29T11:00:00.000Z',erasures:[{request_id:request,kind:'account',subject_ids:[erased],completed_at:'2026-10-29T10:00:00.000Z'}]};
 const ledger={...payload,signature:sign(null,Buffer.from(canonical(payload)),privateKey).toString('base64')};
 const snapshot={project_ref:payload.source_project_ref,tables:[{schema:'auth',table:'users',rows:[row]}]};const snapshotBytes=Buffer.from(JSON.stringify(snapshot)),ledgerBytes=Buffer.from(JSON.stringify(ledger));
 return {snapshotBytes,ledgerBytes,trust:{format:1,source_project_ref:payload.source_project_ref,snapshot_sha256:sha256(snapshotBytes),ledger_sha256:sha256(ledgerBytes),ledger_sequence:2,ledger_public_key_pem:pem},now};
}
test('restore guard accepts authenticated clean snapshot references without exposing rows',()=>{const x=inspectRestore(fixture());assert.equal(x.rows,1);assert.equal(x.erased_subjects,1);assert.equal(x.result,'no_erased_subject_reference');assert(!JSON.stringify(x).includes(other));});
for(const [name,row]of [['root',{id:erased}],['foreign key',{actor_account_id:erased}],['nested payload',{detail:{owner:erased}}],['embedded uppercase',{detail:'reference '+erased.toUpperCase()}],['JSON key',{[erased]:'value'}]])test('restore guard blocks erased subject in '+name,()=>assert.throws(()=>inspectRestore(fixture(row)),/ERASED_SUBJECT_PRESENT/));
test('modified snapshot cannot use the original trusted digest',()=>{const x=fixture();x.snapshotBytes=Buffer.from('{}');assert.throws(()=>inspectRestore(x),/SNAPSHOT_DIGEST_MISMATCH/);});
test('modified ledger cannot use the original trusted digest',()=>{const x=fixture();x.ledgerBytes=Buffer.from('{}');assert.throws(()=>inspectRestore(x),/LEDGER_DIGEST_MISMATCH/);});
test('old signed ledger cannot match a newer independent checkpoint',()=>{const x=fixture();x.trust.ledger_sequence=3;assert.throws(()=>inspectRestore(x),/LEDGER_CHECKPOINT_MISMATCH/);});
test('rehashed forged ledger still fails signature verification',()=>{const x=fixture();const l=JSON.parse(x.ledgerBytes);l.erasures=[];x.ledgerBytes=Buffer.from(JSON.stringify(l));x.trust.ledger_sha256=sha256(x.ledgerBytes);assert.throws(()=>inspectRestore(x),/INVALID_LEDGER_SIGNATURE/);});
test('key substitution cannot verify signed erasure register',()=>{const x=fixture();x.trust.ledger_public_key_pem=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});assert.throws(()=>inspectRestore(x),/INVALID_LEDGER_SIGNATURE/);});
test('future ledger and missing trust fail closed',()=>{assert.throws(()=>inspectRestore({...fixture(),now:0}),/FUTURE_LEDGER/);assert.throws(()=>inspectRestore({...fixture(),trust:{}}),/INVALID_RESTORE_EVIDENCE/);});

test('unknown top-level snapshot payload fails closed',()=>{const x=fixture();const data=JSON.parse(x.snapshotBytes);data.hidden_rows=[{id:erased}];x.snapshotBytes=Buffer.from(JSON.stringify(data));x.trust.snapshot_sha256=sha256(x.snapshotBytes);assert.throws(()=>inspectRestore(x),/INVALID_SNAPSHOT/);});
test('invalid UTF8 evidence is not silently replaced',()=>{const x=fixture();x.snapshotBytes=Buffer.concat([Buffer.from('{"invalid":"'),Buffer.from([0xff]),Buffer.from('"}')]);x.trust.snapshot_sha256=sha256(x.snapshotBytes);assert.throws(()=>inspectRestore(x),/INVALID_RESTORE_EVIDENCE/);});
test('signed malformed request ID array is rejected',()=>{const x=fixture();const l=JSON.parse(x.ledgerBytes);l.erasures[0].request_id=[request];const {signature,...payload}=l;l.signature=sign(null,Buffer.from(canonical(payload)),privateKey).toString('base64');x.ledgerBytes=Buffer.from(JSON.stringify(l));x.trust.ledger_sha256=sha256(x.ledgerBytes);assert.throws(()=>inspectRestore(x),/INVALID_ERASURE_ENTRY/);});

for(const name of ['snapshot','captured_at'])test('snapshot metadata cannot hide structured payload in '+name,()=>{const x=fixture();const data=JSON.parse(x.snapshotBytes);data[name]={hidden_rows:[{id:erased}]};x.snapshotBytes=Buffer.from(JSON.stringify(data));x.trust.snapshot_sha256=sha256(x.snapshotBytes);assert.throws(()=>inspectRestore(x),/INVALID_SNAPSHOT/);});

// Real disk + Ed25519 adapter tests: no database/provider substitutes.
const {appendErasure}=await import('../scripts/erasure-register.mjs');
const fs=await import('node:fs');const path=await import('node:path');const os=await import('node:os');
function diskFixture(run){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'erasure-register-'));try{return run(path.join(dir,'ledger.json'));}finally{fs.rmSync(dir,{recursive:true,force:true});}}
function appendArgs(file){return{file,privateKeyPem:privateKey.export({type:'pkcs8',format:'pem'}),publicKeyPem:pem,sourceProjectRef:'abcdefghijklmnopqrst',expectedHead:null,expectedSequence:0,entry:{request_id:request,kind:'account',subject_ids:[erased],completed_at:'2026-10-29T10:00:00.000Z'},now:'2026-10-29T11:00:00.000Z'};}
test('durable register signs a verifiable head and replay is byte-identical',()=>diskFixture(file=>{const args=appendArgs(file),first=appendErasure(args),bytes=fs.readFileSync(file);assert.equal(fs.statSync(file).mode&0o777,0o600);assert.equal(first.sequence,1);const replay=appendErasure({...args,expectedHead:first.sha256,expectedSequence:1});assert.equal(replay.replayed,true);assert(bytes.equals(fs.readFileSync(file)));const x=fixture({id:erased});x.ledgerBytes=bytes;x.trust.ledger_sha256=first.sha256;x.trust.ledger_sequence=1;assert.throws(()=>inspectRestore(x),/ERASED_SUBJECT_PRESENT/);}));
test('stale writer and conflicting receipt cannot overwrite register',()=>diskFixture(file=>{const args=appendArgs(file),first=appendErasure(args);assert.throws(()=>appendErasure(args),/REGISTER_HEAD_CONFLICT/);assert.throws(()=>appendErasure({...args,expectedHead:first.sha256,expectedSequence:1,entry:{...args.entry,subject_ids:[other]}}),/ERASURE_RECEIPT_CONFLICT/);assert.equal(sha256(fs.readFileSync(file)),first.sha256);}));
test('another writer lock is not removed and crash pending file is not overwritten',()=>diskFixture(file=>{const args=appendArgs(file);fs.writeFileSync(file+'.lock','');assert.throws(()=>appendErasure(args),/EEXIST/);assert(fs.existsSync(file+'.lock'));fs.unlinkSync(file+'.lock');fs.writeFileSync(file+'.pending','ambiguous');assert.throws(()=>appendErasure(args),/REGISTER_RECOVERY_REQUIRED/);assert.equal(fs.readFileSync(file+'.pending','utf8'),'ambiguous');assert(!fs.existsSync(file));}));
test('invalid receipt cannot create a head or leave a normal-call lock',()=>diskFixture(file=>{const args=appendArgs(file);assert.throws(()=>appendErasure({...args,entry:{...args.entry,subject_ids:[]}}),/INVALID_ERASURE_ENTRY/);assert(!fs.existsSync(file));assert(!fs.existsSync(file+'.lock'));}));
const {guardedRestore}=await import('../scripts/guarded-restore.mjs');
async function restoreFixture(run){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'guarded-restore-'));try{const x=fixture();const file=path.join(dir,'ledger.json');fs.writeFileSync(file,x.ledgerBytes,{mode:0o600});return await run(x,file);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('guarded adapter receives frozen validated snapshot under register lock',()=>restoreFixture(async(x,file)=>{let called=false;const result=await guardedRestore({...x,registerFile:file,apply:async(snapshot,proof)=>{called=true;assert(fs.existsSync(file+'.lock'));assert(Object.isFrozen(snapshot.tables[0].rows[0]));assert.equal(snapshot.tables[0].rows[0].id,other);assert.equal(proof.snapshot_sha256,x.trust.snapshot_sha256);}});assert(called);assert.equal(result.result,'validated_snapshot_adapter_completed');assert(!fs.existsSync(file+'.lock'));}));
test('erased snapshot cannot invoke restore adapter',()=>restoreFixture(async(x,file)=>{const unsafe=fixture({id:erased});let called=false;await assert.rejects(guardedRestore({...unsafe,registerFile:file,apply:async()=>{called=true;}}),/ERASED_SUBJECT_PRESENT/);assert.equal(called,false);assert(!fs.existsSync(file+'.lock'));}));
test('adapter failure propagates and releases only its own lock',()=>restoreFixture(async(x,file)=>{await assert.rejects(guardedRestore({...x,registerFile:file,apply:async()=>{throw Error('SYNTHETIC_RESTORE_FAILURE')}}),/SYNTHETIC_RESTORE_FAILURE/);assert(!fs.existsSync(file+'.lock'));fs.writeFileSync(file+'.lock','writer');await assert.rejects(guardedRestore({...x,registerFile:file,apply:async()=>{}}),/EEXIST/);assert.equal(fs.readFileSync(file+'.lock','utf8'),'writer');}));

test('mutable caller trust cannot bless a changed head after await',()=>restoreFixture(async(x,file)=>{await assert.rejects(guardedRestore({...x,registerFile:file,apply:async()=>{const changed=Buffer.from('{}');fs.writeFileSync(file,changed);x.trust.ledger_sha256=sha256(changed);}}),/REGISTER_CHANGED_DURING_RESTORE/);}));

test('pending crash state blocks even identical receipt replay',()=>diskFixture(file=>{const args=appendArgs(file),head=appendErasure(args);fs.writeFileSync(file+'.pending','ambiguous');assert.throws(()=>appendErasure({...args,expectedHead:head.sha256,expectedSequence:1}),/REGISTER_RECOVERY_REQUIRED/);}));
test('pending crash state blocks restore without invoking adapter',()=>restoreFixture(async(x,file)=>{fs.writeFileSync(file+'.pending','ambiguous');let called=false;await assert.rejects(guardedRestore({...x,registerFile:file,apply:async()=>{called=true;}}),/REGISTER_RECOVERY_REQUIRED/);assert.equal(called,false);}));

// Transactional recovery must retain a rollback boundary until the last guard.
test('transactional restore commits only after the final register check',()=>restoreFixture(async(x,file)=>{
 const events=[];
 const result=await guardedRestore({...x,registerFile:file,transaction:{
  prepare:async(snapshot)=>{events.push('prepared');assert(Object.isFrozen(snapshot));},
  commit:async()=>{assert(fs.existsSync(file+'.lock'));events.push('committed');},
  rollback:async()=>events.push('rolled_back')
 }});
 assert.deepEqual(events,['prepared','committed']);assert.equal(result.result,'validated_transaction_committed');
}));
test('register mutation rolls back prepared data before commit',()=>restoreFixture(async(x,file)=>{
 const events=[];
 await assert.rejects(guardedRestore({...x,registerFile:file,transaction:{
  prepare:async()=>{events.push('prepared');fs.writeFileSync(file,'{}');},
  commit:async()=>events.push('committed'),rollback:async()=>events.push('rolled_back')
 }}),/REGISTER_CHANGED_DURING_RESTORE/);
 assert.deepEqual(events,['prepared','rolled_back']);
}));
test('late pending journal prevents transaction commit',()=>restoreFixture(async(x,file)=>{
 let committed=false,rolled=false;
 await assert.rejects(guardedRestore({...x,registerFile:file,transaction:{
  prepare:async()=>fs.writeFileSync(file+'.pending','uncertain'),
  commit:async()=>{committed=true;},rollback:async()=>{rolled=true;}
 }}),/REGISTER_RECOVERY_REQUIRED/);
 assert.equal(committed,false);assert.equal(rolled,true);
}));
test('partial prepare failure invokes rollback and preserves original error',()=>restoreFixture(async(x,file)=>{
 let rolled=false;
 await assert.rejects(guardedRestore({...x,registerFile:file,transaction:{
  prepare:async()=>{throw Error('PARTIAL_LOAD');},commit:async()=>{},rollback:async()=>{rolled=true;}
 }}),/PARTIAL_LOAD/);assert.equal(rolled,true);
}));
test('ambiguous commit cannot produce a successful recovery result',()=>restoreFixture(async(x,file)=>{
 let rolled=false;
 await assert.rejects(guardedRestore({...x,registerFile:file,transaction:{
  prepare:async()=>{},commit:async()=>{throw Error('CONNECTION_LOST');},rollback:async()=>{rolled=true;}
 }}),/RESTORE_COMMIT_OUTCOME_UNKNOWN/);assert.equal(rolled,true);
}));
test('independent current checkpoint is reread before committing',()=>restoreFixture(async(x,file)=>{
 let reads=0,committed=false,rolled=false;
 await assert.rejects(guardedRestore({...x,registerFile:file,readCheckpoint:async()=>{
  reads++;return {...x.trust,ledger_sequence:reads===1?2:3};
 },transaction:{prepare:async()=>{},commit:async()=>{committed=true;},rollback:async()=>{rolled=true;}}}),/CURRENT_CHECKPOINT_CHANGED/);
 assert.equal(reads,2);assert.equal(committed,false);assert.equal(rolled,true);
}));
test('stale independent checkpoint prevents any data preparation',()=>restoreFixture(async(x,file)=>{
 let prepared=false;
 await assert.rejects(guardedRestore({...x,registerFile:file,readCheckpoint:async()=>({...x.trust,ledger_sha256:'0'.repeat(64)}),transaction:{
  prepare:async()=>{prepared=true;},commit:async()=>{},rollback:async()=>{}
 }}),/CURRENT_CHECKPOINT_CHANGED/);assert.equal(prepared,false);
}));

const {validateRestoreTarget,restorePostgresSnapshot}=await import('../scripts/postgres-restore.mjs');
const restoreTarget={database:'ftk_restore_probe',system_identifier:'123456',tables:[{schema:'core',table:'people'}]};
test('PostgreSQL loader only accepts explicitly bound loopback recovery databases',()=>{
 assert.deepEqual(validateRestoreTarget('postgresql://localhost:54322/ftk_restore_probe',restoreTarget),restoreTarget);
 for(const url of ['postgresql://example.com/ftk_restore_probe','postgresql://localhost/postgres','postgresql://localhost/ftk_restore_probe?host=example.com','postgresql://localhost/ftk_restore_probe#x'])assert.throws(()=>validateRestoreTarget(url,restoreTarget),/ISOLATED_RESTORE_TARGET_REQUIRED/);
 for(const target of [{...restoreTarget,system_identifier:'unknown'},{...restoreTarget,tables:[{schema:'pg_catalog',table:'pg_authid'}]},{...restoreTarget,tables:[...restoreTarget.tables,...restoreTarget.tables]}])assert.throws(()=>validateRestoreTarget('postgresql://localhost/ftk_restore_probe',target),/ISOLATED_RESTORE_TARGET_REQUIRED/);
});
test('PostgreSQL loader requires independently supplied current head before connecting',async()=>{
 await assert.rejects(restorePostgresSnapshot({connectionString:'postgresql://localhost:1/ftk_restore_probe',target:restoreTarget}),/CURRENT_CHECKPOINT_REQUIRED/);
});
test('erased PostgreSQL snapshot is rejected without connecting to a target',()=>restoreFixture(async(x,file)=>{
 const unsafe=fixture({id:erased});
 await assert.rejects(restorePostgresSnapshot({...unsafe,registerFile:file,connectionString:'postgresql://localhost:1/ftk_restore_probe',target:{...restoreTarget,tables:[{schema:'auth',table:'users'}]},readCheckpoint:async()=>unsafe.trust}),/ERASED_SUBJECT_PRESENT/);
}));
