type Env=(name:string)=>string|undefined;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const kinds:Record<string,string>={'email.sent':'accepted','email.delivered':'delivered','email.delivery_delayed':'delayed','email.bounced':'bounced','email.complained':'complained','email.failed':'failed','email.suppressed':'failed'};
const reply=(status:number)=>new Response(JSON.stringify(status===200?{}:{error:status===503?'TEMPORARY_FAILURE':'INVALID_WEBHOOK'}),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
// Resend/Svix: HMAC of id.timestamp.raw-body. WebCrypto verifies in constant time.
export async function verifyEmailSignature(raw:string,headers:Headers,secret:string,now:number):Promise<boolean>{
 try{
  const id=headers.get('svix-id')??'',at=headers.get('svix-timestamp')??'',signatures=headers.get('svix-signature')??'';
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id)||!/^\d{10}$/.test(at)||Math.abs(now/1000-Number(at))>300||signatures.length>2048||!/^whsec_[a-zA-Z0-9+/]+={0,2}$/.test(secret))return false;
  const bytes=Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0));if(bytes.length<16||bytes.length>128)return false;
  const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const message=new TextEncoder().encode(id+'.'+at+'.'+raw);
  for(const part of signatures.split(' '))if(/^v1,[a-zA-Z0-9+/]{43}=$/.test(part)&&await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(part.slice(3)),c=>c.charCodeAt(0)),message))return true;
  return false;
 }catch{return false;}
}
async function readBody(req:Request):Promise<string>{
 if(!req.body)return '';const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0,timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const reading=(async()=>{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw Error('SIZE');chunks.push(value);}const body=new Uint8Array(size);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.length;}return new TextDecoder('utf-8',{fatal:true}).decode(body);})();
  return await Promise.race([reading,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('TIMEOUT')),3000);})]);
 }finally{clearTimeout(timer);void reader.cancel().catch(()=>undefined);}
}
export async function emailEvents(req:Request,env:Env,send:typeof fetch=fetch,now=Date.now()):Promise<Response>{
 if(req.method!=='POST')return reply(405);
 const secret=env('FTK_RESEND_WEBHOOK_SECRET'),base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
 if(!secret||!base||!key)return reply(503);
 let raw:string;try{raw=await readBody(req);}catch(error){return reply(error instanceof Error&&error.message==='SIZE'?413:400);}
 if(!await verifyEmailSignature(raw,req.headers,secret,now))return reply(403);
 let event;try{event=JSON.parse(raw);}catch{return reply(400);}
 if(!event||typeof event.type!=='string')return reply(400);
 const kind=Object.hasOwn(kinds,event.type)?kinds[event.type]:undefined;if(!kind)return reply(200);
 if(typeof event.data?.email_id!=='string'||!uuid.test(event.data.email_id)||typeof event.created_at!=='string'||!/^\d{4}-\d\d-\d\dT/.test(event.created_at)||!Number.isFinite(Date.parse(event.created_at))||Date.parse(event.created_at)>now+300000)return reply(400);
 try{
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  const request={event_id:req.headers.get('svix-id'),provider_reference:event.data.email_id,kind,occurred_at:new Date(event.created_at).toISOString(),payload_hash:Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')};
  const result=await send(base+'/rest/v1/rpc/outbox_deliver_v1',{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:request,p_actor_auth_id:null,p_session_id:null,p_ids:[],p_aux:{email_event:true}}),signal:AbortSignal.timeout(10000)});
  if(!result.ok){await result.arrayBuffer();return reply(503);}return reply((await result.json())?.accepted===true?200:503);
 }catch{return reply(503);}
}
