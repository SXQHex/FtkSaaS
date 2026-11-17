import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
const c=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),a=new Ajv({strict:false});addFormats(a);a.addSchema(c,'c');
const valid=(name,value)=>a.getSchema('c#/$defs/'+name)?.(value)===true,id=key(),base={client_api_version:1,request_id:id,org_id:id,center_id:id,page:{}};
test('manager instructor discovery is explicit and leaves native self contracts unchanged',()=>{
 assert(valid('Request_instructor_finance_directory_get',{...base,view:'payments'}));
 assert(valid('Request_instructor_finance_directory_get',{...base,view:'earnings',person_id:id}));
 assert(!valid('Request_instructor_finance_directory_get',{...base,center_id:null,view:'instructors'}));
 assert(!valid('Request_earnings_list',{...base,person_id:id}));
 assert(!valid('Request_instructor_finance_directory_get',{...base,view:'payments',include_tokens:true}));
});
test('report kinds and import discovery preserve explicit native scopes',()=>{
 for(const report of ['sales','session_metrics','collection_breakdown','instructor_balances'])assert(valid('Request_report_get',{...base,report,filters:{center_ids:[id],interval:{starts_at:'2026-01-01T00:00:00Z',ends_at:'2026-02-01T00:00:00Z'}}}));
 assert(valid('Request_report_get',{...base,report:'sales',filters:{center_ids:[id],interval:{starts_at:'2026-01-01T00:00:00Z',ends_at:'2026-02-01T00:00:00Z'}},columns:['product_name']}));
 assert(!valid('Request_report_get',{...base,report:'collections_debts',filters:{center_ids:[id],interval:{starts_at:'2026-01-01T00:00:00Z',ends_at:'2026-02-01T00:00:00Z'}},columns:['product_name']}));
 assert(valid('Request_import_directory_get',{...base}));assert(!valid('Request_import_directory_get',{...base,account_id:id}));
 assert(valid('Request_import_rows_list',{...base,job_id:id,state:'invalid',query:'Synthetic',include_details:true}));
});
test('audit discovery and own tracking directory do not request secrets or another account',()=>{
 assert(valid('Request_audit_list',base));assert(valid('Request_audit_list',{...base,query:'Synthetic',module:'M08',result:'recorded'}));
 assert(valid('Request_audit_list',{...base,module:'X'}));assert(!valid('Request_audit_list',{...base,module:'M99'}));
 const mapping=JSON.parse(fs.readFileSync('database/tracking-discovery.sql','utf8').split("as $$select '")[1].split("'::jsonb->>op")[0]);for(const [operation,module] of Object.entries(mapping))assert.equal(module,c['x-contract'].operations.find(o=>o.name===operation)?.module);for(const operation of c['x-contract'].operations.filter(o=>o.audit))assert.equal(mapping[operation.name],operation.module);
 assert(!valid('Request_audit_list',{...base,result:'failed'}));
 assert(valid('Request_tracking_directory_get',{...base,kind:'preview'}));
 assert(!valid('Request_tracking_directory_get',{...base,account_id:id}));
});
