import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const built=await build({entryPoints:['supabase/functions/backend-v1/import-file.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {parseImportCsv}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const mapping={kind:'crm_applications',columns:[{source_column:'key',target:'source_key'},{source_column:'name',target:'display_name'},{source_column:'phone',target:'phone'},{source_column:'consents',target:'consents'}]};
const csv=(key,phone,proof='[]')=>'key,name,phone,consents\n'+key+',Synthetic candidate,'+phone+',"'+proof.replaceAll('"','""')+'"\n';
test('CRM CSV mode preserves explicit consent and canonical phone without student fields',()=>{
 const proof=[{purpose:'marketing',accepted:false,version:'synthetic-v1',occurred_at:'2026-01-01T00:00:00Z'}];
 const [row]=parseImportCsv(csv('legacy-a','0090 (555) 000-00-01',JSON.stringify(proof)),mapping,10);assert.equal(row.error_code,null);assert.equal(row.payload.phone,'+905550000001');assert.deepEqual(row.payload.consents,proof);assert(!('contacts' in row.payload));
 assert.equal(parseImportCsv(csv('legacy-b','+905550000001'),mapping,10)[0].payload.consents.length,0);
});
test('CRM CSV rejects inferred phones, malformed consent and financial/person targets',()=>{
 for(const [phone,proof] of [['05550000001','[]'],['+905550000001','{}'],['+905550000001','[{"purpose":"marketing","accepted":true}]']])assert.equal(parseImportCsv(csv('a',phone,proof),mapping,10)[0].error_code,'VALIDATION_FAILED');
 for(const target of ['person_ref','opening_credits','opening_debt_minor','product_version_ref'])assert.throws(()=>parseImportCsv('key,name,phone,x\na,A,+905550000001,1\n',{kind:'crm_applications',columns:[...mapping.columns.slice(0,3),{source_column:'x',target}]},10),/VALIDATION_FAILED/);
});

test('CRM consent evidence is not reconstructed from missing, future or duplicate fields',()=>{
 const proofs=[[{purpose:'privacy',accepted:true,version:'synthetic',occurred_at:'2999-01-01T00:00:00Z'}],[{purpose:'privacy',accepted:true,version:'synthetic',occurred_at:'2026-01-01T00:00:00Z',extra:true}],Array.from({length:2},()=>({purpose:'privacy',accepted:false,version:'synthetic',occurred_at:'2026-01-01T00:00:00Z'}))];
 for(const proof of proofs){const [row]=parseImportCsv(csv('a','+905550000001',JSON.stringify(proof)),mapping,10);assert.equal(row.error_code,'VALIDATION_FAILED');assert(row.field_errors.includes('consents'));}
 const rows=parseImportCsv('key,name,phone,consents\na,A,+905550000001,[]\na,B,+905550000001,[]\n',mapping,10);assert.equal(rows[0].error_code,null);assert.equal(rows[1].error_code,'VALIDATION_FAILED');assert(rows[1].field_errors.includes('source_key'));
});

test('legacy source contract cannot claim a web or provider verification',async()=>{
 const {default:Ajv}=await import('ajv/dist/2020.js'),{default:addFormats}=await import('ajv-formats'),fs=await import('node:fs');const ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),'contract');const valid=ajv.getSchema('contract#/$defs/CrmApplicationSource');
 const source={channel:'legacy_import',form_key:'synthetic-legacy',source_namespace:'synthetic-legacy',source_key:'a',source_url:null,file_checksum:'a'.repeat(64),import_job_id:'019a3d00-0000-7000-8000-000000000001',row_number:1};assert(valid(source));assert(!valid({...source,channel:'web_form'}));assert(!valid({...source,external_lead_id:'300'}));assert(!valid({...source,bot_verified:true}));
});
