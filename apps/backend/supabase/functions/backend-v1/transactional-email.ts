import {sendEmail} from './email-provider.ts';
type Rpc=(body:unknown,aux:unknown)=>Promise<any>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
// Called only after the existing signed tick has claimed through its DB replay fence.
export async function deliverTransactionalEmail(item:any,requestId:string,rpc:Rpc,send:typeof fetch=fetch){
 if(!item||!['job_id','org_id'].every(k=>typeof item[k]==='string'&&uuid.test(item[k]))||typeof item.lease_token!=='string'||!item.lease_token||typeof item.api_key!=='string'||!item.api_key||!item.payload||typeof item.payload.from!=='string'||/[\r\n]/.test(item.payload.from)||!Array.isArray(item.payload.to)||item.payload.to.length!==1||typeof item.payload.to[0]!=='string'||/[\r\n]/.test(item.payload.to[0])||typeof item.payload.subject!=='string'||typeof item.payload.text!=='string')throw Error('INVALID_EMAIL_CLAIM');
 const command={request_id:requestId,job_id:item.job_id,org_id:item.org_id,lease_token:item.lease_token};
 if((await rpc(command,{email_phase:'authorize'})).authorized!==true){await rpc(command,{email_phase:'finish',retryable:false});return {claimed:1,accepted:false};}
 const outcome=await sendEmail({apiKey:item.api_key,idempotencyKey:'ftksaas-notification/'+item.job_id,payload:item.payload},send);
 const reference=outcome.state==='accepted'?outcome.provider_reference:undefined;
 await rpc(command,{email_phase:'finish',provider_reference:reference,retryable:outcome.state!=='rejected'});
 return {claimed:1,accepted:reference!==undefined};
}
