import {sendEmail} from './email-provider.ts';
import {isRecord,isUnknownArray,requireRecord} from './edge-json.ts';
type Rpc=(body:unknown,aux:unknown)=>Promise<unknown>;
type EmailClaim={job_id:string;org_id:string;lease_token:string;api_key:string;payload:{from:string;to:string[];subject:string;text:string}};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
// Called only after the existing signed tick has claimed through its DB replay fence.
function validEmailClaim(item:unknown):item is EmailClaim{
 if(!isRecord(item)||!['job_id','org_id'].every(k=>typeof item[k]==='string'&&uuid.test(item[k]))||typeof item.lease_token!=='string'||!item.lease_token||typeof item.api_key!=='string'||!item.api_key||!isRecord(item.payload))return false;
 const payload=item.payload;
 return typeof payload.from==='string'&&!/[\r\n]/.test(payload.from)&&isUnknownArray(payload.to)&&payload.to.length===1&&typeof payload.to[0]==='string'&&!/[\r\n]/.test(payload.to[0])&&typeof payload.subject==='string'&&typeof payload.text==='string';
}
export async function deliverTransactionalEmail(item:unknown,requestId:string,rpc:Rpc,send:typeof fetch=fetch){
 if(!validEmailClaim(item))throw Error('INVALID_EMAIL_CLAIM');
 const command={request_id:requestId,job_id:item.job_id,org_id:item.org_id,lease_token:item.lease_token};
 const authorization=requireRecord(await rpc(command,{email_phase:'authorize'}));
 if(typeof authorization.authorized!=='boolean')throw Error('INVALID_EMAIL_AUTHORIZATION');
 if(authorization.authorized!==true){await rpc(command,{email_phase:'finish',retryable:false});return {claimed:1,accepted:false};}
 const outcome=await sendEmail({apiKey:item.api_key,idempotencyKey:'ftksaas-notification/'+item.job_id,payload:item.payload},send);
 const reference=outcome.state==='accepted'?outcome.provider_reference:undefined;
 await rpc(command,{email_phase:'finish',provider_reference:reference,retryable:outcome.state!=='rejected'});
 return {claimed:1,accepted:reference!==undefined};
}
