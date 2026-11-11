import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
test('common CRM phone forms use the same canonical target for equivalent international input',async()=>{
 const out=await build({entryPoints:['supabase/functions/backend-v1/public-ingress.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const {crmIntakePhone}=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
 assert.equal(crmIntakePhone('00 90 (555) 000-00.01'),'+905550000001');
 assert.equal(crmIntakePhone('+90 555 000 00 01'),'+905550000001');
 for(const input of ['05550000001','+0','+90555x0000001',null])assert.throws(()=>crmIntakePhone(input),/VALIDATION_FAILED/);
});

test('CRM form configuration requires explicit scope and rejects credentials or caller-controlled fields',async()=>{
 const {intakeFormConfigurationSQL}=await import('../scripts/crm-intake-form-config.mjs');
 const id='019a4c1d-7000-7000-8000-000000000001';
 const config={id,org_id:id,center_id:null,channel:'web_form',form_key:'synthetic',source_url:'https://example.invalid/contact',enabled:false};
 assert.doesNotThrow(()=>intakeFormConfigurationSQL(config));
 for(const patch of [{source_url:'http://example.invalid'},{source_url:'https://user:pass@example.invalid/'},{channel:'facebook'},{enabled:'true'},{org_id:'invalid'},{tenant_id:id}])assert.throws(()=>intakeFormConfigurationSQL({...config,...patch}));
 const {enabled,...missing}=config;assert.throws(()=>intakeFormConfigurationSQL(missing));
});

test('CRM configuration data cannot terminate its generated PLpgSQL dollar body',async()=>{
 const {intakeFormConfigurationSQL}=await import('../scripts/crm-intake-form-config.mjs');
 const id='019a4c1d-7000-7000-8000-000000000001';
 const sql=intakeFormConfigurationSQL({id,org_id:id,center_id:null,channel:'web_form',form_key:"$intake_setup$;select 'untrusted';--$intake_setup_1$",source_url:'https://example.invalid/$intake_setup$',enabled:false});
 const delimiter=sql.match(/do (\$[a-z0-9_]+\$)/i)[1];
 assert.equal(sql.split(delimiter).length,3,'Only the opening and closing block delimiters may occur');
 assert.notEqual(delimiter,'$intake_setup$');
 assert.notEqual(delimiter,'$intake_setup_1$');
});

test('flexible CRM contact hashing supplies both canonical identities and never fabricates a phone',async()=>{
 const out=await build({entryPoints:['supabase/functions/backend-v1/public-ingress.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const {crmIntakeTargets}=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
 assert.deepEqual(crmIntakeTargets({email:'Applicant@Example.invalid'}),{email:'applicant@example.invalid'});
 assert.deepEqual(crmIntakeTargets({email:'Applicant@Example.invalid',phone:'00 90 (555) 000-00.01'}),{phone:'+905550000001',email:'applicant@example.invalid'});
 for(const value of [{},{phone:null,email:'a@example.invalid'},{email:'bad email'},null])assert.throws(()=>crmIntakeTargets(value),/VALIDATION_FAILED/);
});
