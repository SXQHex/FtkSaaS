// Native durable boundary. Credentials and personal answers never enter the queue.
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {newUuidV7 as key} from './uuid.mjs';
const ajv=new Ajv({strict:false});addFormats(ajv);
ajv.addSchema(JSON.parse(fs.readFileSync(new URL('../../../packages/api-contracts/schema/contract.json',import.meta.url))),'contract');
const validEvent=ajv.getSchema('contract#/$defs/CrmMetaNotification'),validClaim=ajv.getSchema('contract#/$defs/CrmMetaQueueClaim'),validQueueReceipt=ajv.getSchema('contract#/$defs/CrmMetaQueueReceipt'),validReceipt=ajv.getSchema('contract#/$defs/CrmProviderReceipt'),validDelivery=ajv.getSchema('contract#/$defs/CrmProviderDelivery');
export async function enqueueMetaNotifications(client,events){
 if(!Array.isArray(events)||events.length>1000||events.some(e=>!validEvent(e)))throw Error('PROVIDER_PAYLOAD');
 try{const result=(await client.query('select private.crm_meta_enqueue($1,$2) result',[JSON.stringify(events),events.map(()=>key())])).rows[0]?.result;
  if(!validQueueReceipt(result)||result.accepted!==events.length)throw Error();return result;
 }catch{throw Error('PROVIDER_QUEUE');}
}
export async function claimMetaNotification(client,route,leaseSeconds){
 const nonce=key();
 try{const result=(await client.query('select private.crm_meta_claim($1,$2,$3,$4) result',[route.form_id,route.page_id,nonce,leaseSeconds])).rows[0]?.result;
  if(result===null)return null;
  if(!validClaim(result)||result.lease_token!==nonce||result.notification.external_form_id!==route.form_id||result.notification.external_page_id!==route.page_id)throw Error();return result;
 }catch{throw Error('PROVIDER_QUEUE');}
}
export async function completeMetaNotification(client,claim,delivery){
 if(!validDelivery(delivery))throw Error('PROVIDER_PAYLOAD');
 try{const result=(await client.query('select private.crm_meta_complete($1,$2,$3,$4) result',[claim.id,claim.lease_token,delivery,[key(),key()]])).rows[0]?.result;if(!validReceipt(result))throw Error();return result;}
 catch{throw Error('PROVIDER_QUEUE');}
}
export async function retryMetaNotification(client,claim,retrySeconds){
 try{const result=(await client.query('select private.crm_meta_retry($1,$2,$3) result',[claim.id,claim.lease_token,retrySeconds])).rows[0]?.result;if(result!==true)throw Error();}
 catch{throw Error('PROVIDER_QUEUE');}
}
