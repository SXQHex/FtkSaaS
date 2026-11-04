import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
const c=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json'));
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);const validate=ajv.compile({$defs:c.$defs,...c.$defs.Request_public_application_submit});
const uuid='019a4c1d-7000-7000-8000-000000000001';
test('common application is a form-bound phone intake, not a caller organization/source declaration',()=>{
 const request={client_api_version:1,request_id:uuid,form_id:uuid,client_request_key:uuid,bot_proof:'synthetic',intake:{display_name:'Synthetic person',phone:'+905550000001',consents:[]}};
 assert.equal(validate(request),true,JSON.stringify(validate.errors));
 assert.equal(validate({...request,org_id:uuid}),false);
 assert.equal(validate({...request,publication_id:uuid}),false);
 assert.equal(validate({...request,intake:{...request.intake,source:'facebook'}}),false);
});

test('trusted intake mapping configuration is explicit and does not permit caller SQL or provider shortcuts',async()=>{
 const {intakeFormConfigurationSQL}=await import('../scripts/crm-intake-form-config.mjs');
 const config={id:uuid,org_id:uuid,center_id:null,channel:'web_form',form_key:"Synthetic ' form",source_url:'https://example.invalid/form',enabled:true};
 const sql=intakeFormConfigurationSQL(config);assert(sql.includes("Synthetic '' form"));assert(sql.includes('Form mapping is immutable'));
 assert.throws(()=>intakeFormConfigurationSQL({...config,channel:'facebook'}));
 assert.throws(()=>intakeFormConfigurationSQL({...config,org_id:"'; select 1; --"}));
 assert.throws(()=>intakeFormConfigurationSQL({...config,source_url:'https://user:pass@example.invalid/'}));
 assert.throws(()=>intakeFormConfigurationSQL({...config,center_id:undefined}));
});
