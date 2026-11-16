import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import {newUuidV7} from '../scripts/uuid.mjs';
const contract=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),a=new Ajv({strict:false,allErrors:true});addFormats(a);a.addSchema(contract,'contract');const v=a.getSchema('contract#/$defs/Request_calendar_get'),id=newUuidV7();
const base={client_api_version:1,request_id:id,org_id:id,interval:{starts_at:'2026-01-01T00:00:00Z',ends_at:'2026-01-08T00:00:00Z'},page:{}};
test('member lesson discovery is opt-in, explicit-center and chronological without management filters',()=>{
 assert(v(base));assert(v({...base,center_id:id,member_discovery:true}));
 for(const extra of [{},{center_id:null},{center_id:id,resource:{kind:'person',id}},{center_id:id,interest_filter:true},{center_id:id,needs_instructor:true},{center_id:id,include_room_labels:true},{center_id:id,page:{sort:'recommendation_desc'}}])assert(!v({...base,member_discovery:true,...extra}));
});
