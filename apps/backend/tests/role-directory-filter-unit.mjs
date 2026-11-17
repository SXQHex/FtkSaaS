import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
const contract=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json'));
const ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(contract,'c');
const valid=ajv.getSchema('c#/$defs/Request_roles_list');
const base={client_api_version:1,request_id:key(),org_id:key(),page:{}};
test('role directory filters use existing closed Role and RecordState without changing legacy requests',()=>{
 assert(valid(base));
 for(const role of contract.$defs.Role.enum)for(const state of contract.$defs.RecordState.enum)assert(valid({...base,role,state}));
 for(const extra of [{role:'manager'},{state:'all'},{role:null},{state:null},{account_id:key()}])assert(!valid({...base,...extra}));
});
test('role filters retain authoritative and generated request validation',async()=>{
 const {request_roles_list_v1:standalone}=await import('../supabase/functions/backend-v1/validators.js');
 for(const value of [base,{...base,role:'org_manager',state:'inactive'},{...base,center_id:key(),role:'center_manager',state:'active'},{...base,role:'manager'},{...base,state:'all'}])assert.equal(standalone(value),valid(value));
 for(const field of contract.$defs.Request_roles_list.required){const changed={...base};delete changed[field];assert(!valid(changed));assert(!standalone(changed));}
});
