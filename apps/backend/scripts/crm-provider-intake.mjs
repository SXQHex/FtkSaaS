// Internal native receiver boundary; no human JWT, service key, HTTP ack or retry.
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {newUuidV7 as key} from './uuid.mjs';
const ajv=new Ajv({strict:false});addFormats(ajv);
ajv.addSchema(JSON.parse(fs.readFileSync(new URL('../../../packages/api-contracts/schema/contract.json',import.meta.url))),'contract');
const validDelivery=ajv.getSchema('contract#/$defs/CrmProviderDelivery');
export async function submitProviderApplication(client,verifiedLead){
 if(!verifiedLead||!validDelivery(verifiedLead)||Buffer.byteLength(verifiedLead.external_lead_id)>2048||verifiedLead.submitted_at!==null&&!Number.isFinite(Date.parse(verifiedLead.submitted_at)))throw Error('PROVIDER_PAYLOAD');
 // The database binds the real session_user to an explicit form scope and
 // rechecks plan, route and replay atomically. It never accepts a tenant input.
 try{return (await client.query('select private.crm_provider_submit($1,$2) result',[verifiedLead,[key(),key()]])).rows[0].result;}
 catch(error){const code=error.code==='P0001'&&['FORBIDDEN','VALIDATION_FAILED','PLAN_FEATURE_UNAVAILABLE','SERVICE_UNAVAILABLE','NOT_FOUND','IDEMPOTENCY_PAYLOAD_MISMATCH','POLICY_NOT_CONFIGURED'].includes(error.message)?error.message:'PROVIDER_PERSISTENCE';throw Error(code);}
}
