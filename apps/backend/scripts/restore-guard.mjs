import fs from 'node:fs';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digest=/^[0-9a-f]{64}$/;
const ref=/^[a-z]{20}$/;
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
function fail(code){throw new Error(code);}
function keys(value,expected){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join(',')!==[...expected].sort().join(','))fail('INVALID_RESTORE_EVIDENCE');}
function timestamp(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail('INVALID_RESTORE_EVIDENCE');return Date.parse(value);}

// Trust is supplied by the independent current erasure register, never by the
// backup being checked. This function does not delete, restore, or open access.
export function inspectRestore({snapshotBytes,ledgerBytes,trust,now=Date.now()}){
 keys(trust,['format','source_project_ref','snapshot_sha256','ledger_sha256','ledger_sequence','ledger_public_key_pem']);
 if(trust.format!==1||!ref.test(trust.source_project_ref)||!digest.test(trust.snapshot_sha256)||!digest.test(trust.ledger_sha256)||!Number.isSafeInteger(trust.ledger_sequence)||trust.ledger_sequence<1)fail('INVALID_RESTORE_TRUST');
 if(sha256(snapshotBytes)!==trust.snapshot_sha256)fail('SNAPSHOT_DIGEST_MISMATCH');
 if(sha256(ledgerBytes)!==trust.ledger_sha256)fail('LEDGER_DIGEST_MISMATCH');
 let snapshot,ledger;try{snapshot=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(snapshotBytes));ledger=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(ledgerBytes));}catch{fail('INVALID_RESTORE_EVIDENCE');}
 keys(ledger,['format','source_project_ref','sequence','issued_at','erasures','signature']);
 if(ledger.format!==1||ledger.source_project_ref!==trust.source_project_ref||ledger.sequence!==trust.ledger_sequence||!Array.isArray(ledger.erasures))fail('LEDGER_CHECKPOINT_MISMATCH');
 const issued=timestamp(ledger.issued_at);if(issued>now)fail('FUTURE_LEDGER');
 if(typeof trust.ledger_public_key_pem!=='string'||!trust.ledger_public_key_pem.startsWith('-----BEGIN PUBLIC KEY-----'))fail('INVALID_LEDGER_KEY');
 let key;try{key=createPublicKey(trust.ledger_public_key_pem);}catch{fail('INVALID_LEDGER_KEY');}
 if(key.asymmetricKeyType!=='ed25519')fail('INVALID_LEDGER_KEY');
 if(typeof ledger.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(ledger.signature))fail('INVALID_LEDGER_SIGNATURE');
 const signature=Buffer.from(ledger.signature,'base64');const {signature:ignored,...payload}=ledger;
 if(signature.length!==64||signature.toString('base64')!==ledger.signature||!verify(null,Buffer.from(canonical(payload)),key,signature))fail('INVALID_LEDGER_SIGNATURE');
 const erased=new Set(),requests=new Set();
 for(const e of ledger.erasures){
  keys(e,['request_id','kind','subject_ids','completed_at']);
  if(typeof e.request_id!=='string'||!uuid.test(e.request_id)||requests.has(e.request_id)||!['account','organization'].includes(e.kind)||!Array.isArray(e.subject_ids)||!e.subject_ids.length||e.subject_ids.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(e.subject_ids).size!==e.subject_ids.length||timestamp(e.completed_at)>issued)fail('INVALID_ERASURE_ENTRY');
  requests.add(e.request_id);for(const id of e.subject_ids)erased.add(id);
 }
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||Object.keys(snapshot).some(k=>!['project_ref','tables','snapshot','captured_at'].includes(k))||snapshot.project_ref!==trust.source_project_ref||!Array.isArray(snapshot.tables)||!snapshot.tables.length)fail('INVALID_SNAPSHOT');
 if('snapshot' in snapshot&&(typeof snapshot.snapshot!=='string'||!/^\d+:\d+:(?:\d+(?:,\d+)*)?$/.test(snapshot.snapshot)))fail('INVALID_SNAPSHOT');
 if('captured_at' in snapshot&&(typeof snapshot.captured_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(snapshot.captured_at)||!Number.isFinite(Date.parse(snapshot.captured_at))))fail('INVALID_SNAPSHOT');
 const tables=new Set();let rows=0,blockedRows=0;
 const mentions=(value,depth=0)=>{
  if(depth>100)fail('SNAPSHOT_DEPTH_EXCEEDED');
  if(typeof value==='string')return [...value.toLowerCase().matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)].some(m=>erased.has(m[0]));
  if(value&&typeof value==='object')return Object.entries(value).some(([k,v])=>mentions(k,depth+1)||mentions(v,depth+1));
  return false;
 };
 for(const t of snapshot.tables){
  keys(t,['schema','table','rows']);
  if(typeof t.schema!=='string'||typeof t.table!=='string'||!t.schema||!t.table||!Array.isArray(t.rows)||tables.has(t.schema+'.'+t.table))fail('INVALID_SNAPSHOT');
  tables.add(t.schema+'.'+t.table);
  for(const row of t.rows){if(!row||Array.isArray(row)||typeof row!=='object')fail('INVALID_SNAPSHOT');rows++;if(mentions(row))blockedRows++;}
 }
 if(blockedRows)fail('ERASED_SUBJECT_PRESENT');
 return {format:1,result:'no_erased_subject_reference',source_project_ref:trust.source_project_ref,snapshot_sha256:trust.snapshot_sha256,ledger_sha256:trust.ledger_sha256,ledger_sequence:ledger.sequence,tables:tables.size,rows,erased_subjects:erased.size,checked_at:new Date(now).toISOString(),scope:'JSON database snapshot references only; not a Storage/config/WAL/backup-expiry or completed-purge receipt'};
}
function readBounded(file){const stat=fs.statSync(file);if(!stat.isFile()||stat.size>128*1024*1024)fail('INVALID_EVIDENCE_FILE');return fs.readFileSync(file);}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{
  const args=process.argv.slice(2);if(args.length!==6||args[0]!=='--snapshot'||args[2]!=='--ledger'||args[4]!=='--trust')fail('USAGE: restore-guard --snapshot FILE --ledger FILE --trust INDEPENDENT_CURRENT_TRUST_FILE');
  const files=[args[1],args[3],args[5]].map(f=>fs.realpathSync(f));if(new Set(files).size!==3)fail('EVIDENCE_FILES_MUST_DIFFER');
  const result=inspectRestore({snapshotBytes:readBounded(files[0]),ledgerBytes:readBounded(files[1]),trust:JSON.parse(readBounded(files[2]).toString('utf8'))});
  console.log(JSON.stringify(result));
 }catch(error){const code=typeof error.message==='string'&&/^[A-Z_]+(?::.*)?$/.test(error.message)?error.message:'RESTORE_GUARD_FAILED';console.error(code);process.exitCode=1;}
}
