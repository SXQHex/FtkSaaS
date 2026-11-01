type Env=(name:string)=>string|undefined;
type Fetch=typeof fetch;
type Claim={job_id:string;org_id:string;invitation_id:string;lease_token:string;recipient:string;sealed_token:string;from_email:string;app_origin:string;api_key:string};
const enc=new TextEncoder();
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
async function signature(key:string,value:string){
 const hmac=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',hmac,enc.encode(value)));
}
function equal(a:string,b:string){if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
async function unseal(value:string,serviceKey:string){
 const sealed=JSON.parse(value),decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(serviceKey)),'AES-GCM',false,['decrypt']);
 const token=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(sealed.iv)},key,decode(sealed.cipher)));
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('INVALID_SEALED_TOKEN');return token;
}
function validClaim(x:any):x is Claim{
 return x&&['job_id','org_id','invitation_id'].every(k=>typeof x[k]==='string'&&uuid.test(x[k]))
  &&['lease_token','recipient','sealed_token','from_email','app_origin','api_key'].every(k=>typeof x[k]==='string'&&x[k].length>0)
  &&!/[\r\n]/.test(x.recipient+x.from_email)&&/^https:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?$/.test(x.app_origin);
}
// Native Cron's private operational transport. This does not establish a human
// Auth session or expose a new frontend operation. Request contains no job/PII.
export async function invitationTick(req:Request,env:Env,send:Fetch=fetch,now=Date.now()){
 try{
  const serviceKey=env('SUPABASE_SERVICE_ROLE_KEY'),base=env('SUPABASE_URL'),signingKey=env('FTK_INVITATION_TICK_SECRET');
  if(!serviceKey||!base||!signingKey||!/^[a-f0-9]{64}$/.test(signingKey))return reply(503,{error:'SERVICE_UNAVAILABLE'});
  const raw=await req.text();if(raw.length>256)return reply(400,{error:'VALIDATION_FAILED'});
  const request=JSON.parse(raw);
  if(Object.keys(request).length!==1||typeof request.request_id!=='string'||!uuid.test(request.request_id))return reply(400,{error:'VALIDATION_FAILED'});
  const at=req.headers.get('x-ftk-worker-time')??'',provided=req.headers.get('x-ftk-worker-signature')??'';
  if(!/^\d{10}$/.test(at)||Math.abs(now/1000-Number(at))>30||!/^[a-f0-9]{64}$/.test(provided))return reply(403,{error:'FORBIDDEN'});
  if(!equal(provided,await signature(signingKey,at+'.'+request.request_id)))return reply(403,{error:'FORBIDDEN'});
  const rpc=async(body:unknown,aux:unknown)=>{
   const res=await send(base+'/rest/v1/rpc/outbox_deliver_v1',{method:'POST',headers:{authorization:'Bearer '+serviceKey,apikey:serviceKey,'content-type':'application/json','Content-Profile':'api_v1'},
    body:JSON.stringify({p_request:body,p_actor_auth_id:null,p_session_id:null,p_ids:[],p_aux:aux}),signal:AbortSignal.timeout(10000)});
   if(!res.ok){await res.arrayBuffer();throw Error('DELIVERY_RPC_UNAVAILABLE');}return res.json();
  };
  const claimed=await rpc(request,{invitation_phase:'claim'}),item=claimed._internal_invitation;
  if(item===null)return reply(200,{claimed:0});
  if(!validClaim(item))return reply(503,{error:'TEMPORARY_FAILURE'});
  const command={request_id:request.request_id,job_id:item.job_id,org_id:item.org_id,lease_token:item.lease_token};
  let provider_reference:string|undefined,retryable=true;
  try{
   const token=await unseal(item.sealed_token,serviceKey);
   const link=new URL('/invite',item.app_origin);link.hash=new URLSearchParams({token}).toString();
   // Immutable invitation + frozen sender/origin give byte-identical retry bodies.
   const payload={from:item.from_email,to:[item.recipient],subject:'FtkSaaS hesap erişimi daveti',
    text:'Hesap erişimi davetinizi kabul etmek için bağlantıyı açın:\n'+link.href+'\n\nBu davet yalnız gönderildiği doğrulanmış e-posta hesabıyla kabul edilebilir. Talep etmediyseniz bu e-postayı yok sayabilirsiniz.'};
   const authorized=await rpc(command,{invitation_phase:'authorize'});
   if(authorized.authorized!==true){await rpc(command,{invitation_phase:'finish',retryable:false});return reply(200,{claimed:1});}
   const res=await send('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+item.api_key,'content-type':'application/json','Idempotency-Key':'ftksaas-invitation/'+item.job_id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
   const body=await res.json().catch(()=>null);
   if(res.ok&&typeof body?.id==='string'&&uuid.test(body.id))provider_reference=body.id;
   else retryable=res.ok||res.status>=500||res.status===429||(res.status===409&&body?.name==='concurrent_idempotent_requests');
  }catch{ retryable=true; /* Unknown provider outcome is retried only within the persisted 23h window. */ }
  await rpc(command,{invitation_phase:'finish',provider_reference,retryable});
  return reply(200,{claimed:1,accepted:provider_reference!==undefined});
 }catch{return reply(503,{error:'TEMPORARY_FAILURE'});}
}
