// Public transport only. Business authorization, CAPTCHA and quotas stay in Edge/RPC.
import fs from 'node:fs';
import {newUuidV7} from './uuid.mjs';
import {signPublicApplication,publicSubmitPath} from './p04-public-ingress.mjs';
const base='https://gwyprhenabtpkbojephw.supabase.co';
const codes=new Set(JSON.parse(fs.readFileSync(new URL('../../../packages/api-contracts/schema/contract.json',import.meta.url),'utf8')).$defs.SafeError.properties.code.enum);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const json=(code,status)=>Response.json({ok:false,error:{code,retryable:code==='TEMPORARY_FAILURE',trace_id:newUuidV7()}},{status,headers:{'cache-control':'no-store'}});
async function boundedBody(body){
 const reader=body?.getReader();if(!reader)throw Error('EMPTY');const parts=[];let n=0;
 for(;;){const {value,done}=await reader.read();if(done)break;n+=value.byteLength;if(n>65536){await reader.cancel();throw Error('SIZE');}parts.push(value);}
 const bytes=new Uint8Array(n);let pos=0;for(const part of parts){bytes.set(part,pos);pos+=part.byteLength;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
function publicEnvelope(x,status){
 if(!x||typeof x!=='object'||Array.isArray(x))return null;
 if(status===200&&x.ok===true&&Object.keys(x).length===3&&uuid(x.trace_id)&&x.data?.accepted===true&&Object.keys(x.data).length===1)return {ok:true,data:{accepted:true},trace_id:x.trace_id};
 const e=x.error;
 if(x.ok===false&&Object.keys(x).length===2&&e&&Object.keys(e).every(k=>['code','retryable','trace_id','retry_after_ms','field_paths'].includes(k))&&codes.has(e.code)&&typeof e.retryable==='boolean'&&uuid(e.trace_id))return {ok:false,error:{code:e.code,retryable:e.retryable,trace_id:e.trace_id}};
 return null;
}
export async function handlePublicApplication(req,env=process.env,fetcher=fetch){
 if(req.method!=='POST')return json('VALIDATION_FAILED',405);
 const host=env.FTK_PUBLIC_APPLICATION_HOSTNAME,secret=env.FTK_PUBLIC_INGRESS_SECRET,key=env.FTK_PUBLIC_ANON_KEY;
 if(!host||host.includes('/')||!secret||!key)return json('SERVICE_UNAVAILABLE',503);
 const url=new URL(req.url);let backend;
 try{backend=new URL(env.FTK_PUBLIC_BACKEND_ORIGIN??base);if(backend.protocol!=='https:'||backend.origin!==(env.FTK_PUBLIC_BACKEND_ORIGIN??base))throw Error();}catch{return json('SERVICE_UNAVAILABLE',503);}
 if(url.protocol!=='https:'||url.hostname!==host||req.headers.get('origin')!=='https://'+host)return json('FORBIDDEN',403);
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??''))return json('VALIDATION_FAILED',400);
 let body;try{body=await boundedBody(req.body);JSON.parse(body);}catch(e){return json('VALIDATION_FAILED',e.message==='SIZE'?413:400);}
 try{
  // Vercel overwrites this connection header. External proxy mode is unsupported.
  // Caller x-ftk-*, cookies and authorization are never forwarded.
  const signed=signPublicApplication(body,req.headers.get('x-vercel-forwarded-for'),secret);
  const res=await fetcher(backend.origin+publicSubmitPath,{method:'POST',headers:{...signed,apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},body,signal:AbortSignal.timeout(15000),redirect:'error'});
  const output=publicEnvelope(JSON.parse(await boundedBody(res.body)),res.status);if(!output)throw Error('ENVELOPE');
  return Response.json(output,{status:res.status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch{return json('TEMPORARY_FAILURE',503);}
}
