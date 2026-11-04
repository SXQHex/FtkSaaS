import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

const contract=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json'));
const ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(contract,'contract');
const valid=ajv.getSchema('contract#/$defs/Request_document_requirements_get');
test('document requirements supports explicit target and omitted-person self without permitting unknown selectors',()=>{
 const request={client_api_version:1,request_id:key(),org_id:key(),center_id:key(),context:{gate:'sale',subject:{type:'sales',id:key()}}};
 assert.equal(valid(request),true,JSON.stringify(valid.errors));
 assert.equal(valid({...request,person_id:key(),content_file_id:key()}),true,JSON.stringify(valid.errors));
 assert.equal(valid({...request,person_id:null}),false);
 assert.equal(valid({...request,context:undefined}),false);
 assert.equal(valid({...request,actor_person_id:key()}),false);
});
