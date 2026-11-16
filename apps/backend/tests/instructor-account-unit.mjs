import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {newUuidV7} from '../scripts/uuid.mjs';
const schema=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json'));
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);ajv.addSchema(schema,'contract');
const valid=(name,data)=>ajv.getSchema('contract#/$defs/'+name)?.(data)===true;
const id=newUuidV7(),base={client_api_version:1,request_id:id,org_id:id,center_id:id,person_id:id,view:'payments',page:{}};
test('instructor self discovery supports explicit interval or all periods with bound cursor paging',()=>{
 assert(valid('Request_instructor_account_get',base));
 assert(valid('Request_instructor_account_get',{...base,view:'agreements',interval:{starts_at:'2026-01-01T00:00:00Z',ends_at:'2026-02-01T00:00:00Z'}}));
 for(const extra of [{view:'all_people'},{center_id:null},{person_id:null},{view:'payments',page:{limit:201}}]) assert(!valid('Request_instructor_account_get',{...base,...extra}));
});
test('instructor payments accept existing manual methods without fabricating historical methods',()=>{
 const request={client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,person_id:id,earning_ids:[id],amount_minor:'10',currency:'TRY',occurred_at:'2026-01-01T00:00:00Z'};
 assert(valid('Request_instructor_payment_record',request));
 for(const payment of [{method:'cash'},{method:'bank_transfer',reference:'synthetic'},{method:'card_pos',reference:'synthetic'}]) assert(valid('Request_instructor_payment_record',{...request,payment}));
 for(const payment of [{method:'bank_transfer'},{method:'card_pos',reference:' '},{method:'guess'}]) assert(!valid('Request_instructor_payment_record',{...request,payment}));
});
test('instructor self migration matches reviewed source and remains service-only',()=>{
 const source=fs.readFileSync('database/instructor-self-account.sql','utf8');
 assert.equal(fs.readFileSync('supabase/migrations/20261116194343_instructor_self_account.sql','utf8'),source);
 assert(source.includes('security invoker'));assert(source.includes('from public,anon,authenticated'));
});
