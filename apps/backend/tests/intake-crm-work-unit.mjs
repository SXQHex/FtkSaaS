import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import {newUuidV7 as id} from '../scripts/uuid.mjs';
const c=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(c,'c');const valid=(name,data)=>ajv.getSchema('c#/$defs/'+name)(data),uuid=id(),base={client_api_version:1,request_id:uuid,org_id:uuid,center_id:uuid};
test('CRM discovery has explicit stage/assignee scope and closed read selectors',()=>{
 assert(valid('Request_leads_list',{...base,page:{},stage_key:'new',assigned_to:null,include_summary:true,include_details:true}));
 const read=(operation,key)=>({...base,operation,selector:{operation,key},page:{}});
 assert(valid('Request_management_state_get',read('lead_save_v1',{directory:'assignees'})));
 assert(valid('Request_management_state_get',read('crm_activity_save_v1',{directory:'followups',state:'pending'})));
 assert(valid('Request_management_state_get',read('trial_offer_create_v1',{lead_id:uuid,directory:'history'})));
 assert(valid('Request_management_state_get',read('trial_offer_create_v1',{lead_id:uuid,directory:'products'})));
 assert(!valid('Request_management_state_get',read('trial_offer_create_v1',{directory:'history'})));
});
test('public publication visibility is explicit and form discovery binds real consent sources',()=>{
 const details={title:'Published',venue_public_label:'Public room',fee_minor:'0',currency:'TRY',public_conditions:'Explicit published conditions'};
 assert(valid('PublicPublicationDetails',details));assert(valid('PublicPublicationDetails',{...details,show_occupancy:false,show_instructors:false}));assert(!valid('PublicPublicationDetails',{...details,show_occupancy:'yes'}));
 assert(valid('PublicFormBinding',{form_id:uuid,consents:[{purpose:'application',version:'real-source-v1',required:true,content_template_id:uuid}]}));assert(!valid('PublicFormBinding',{form_id:uuid,consents:[]}));
});
test('management work discovery is an explicit center read with native source targets',()=>{
 assert(valid('Request_management_work_list',{...base,page:{}}));assert(!valid('Request_management_work_list',{...base,center_id:null,page:{}}));assert(!valid('Request_management_work_list',{...base,page:{},kind:'debt_due'}));
});
