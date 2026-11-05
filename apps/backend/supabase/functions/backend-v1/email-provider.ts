type Email={from:string;to:string[];subject:string;text:string};
type EmailInput={apiKey:string;idempotencyKey:string;payload:Email};
type Outcome={state:'accepted';provider_reference:string}|{state:'rejected'|'retryable'|'unknown'};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

// One attempt only. The caller owns authorization, frozen content, durable leases
// and retry expiry (provider keys expire after 24h). Accepted is not delivered.
export async function sendEmail(input:EmailInput,send:typeof fetch=fetch):Promise<Outcome>{
 if(!input.apiKey||/[\r\n]/.test(input.apiKey)||!/^[-a-zA-Z0-9_/:.]{1,256}$/.test(input.idempotencyKey))return {state:'rejected'};
 try{
  const res=await send('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+input.apiKey,'content-type':'application/json','Idempotency-Key':input.idempotencyKey},body:JSON.stringify(input.payload),signal:AbortSignal.timeout(15000)});
  const body=await res.json().catch(()=>null);
  if(res.ok)return typeof body?.id==='string'&&uuid.test(body.id)?{state:'accepted',provider_reference:body.id}:{state:'unknown'};
  return {state:res.status>=500||res.status===429||(res.status===409&&body?.name==='concurrent_idempotent_requests')?'retryable':'rejected'};
 }catch{return {state:'unknown'};}
}
