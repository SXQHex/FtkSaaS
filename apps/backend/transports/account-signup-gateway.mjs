import {newUuidV7} from '../scripts/uuid.mjs';
import {signPublicRequest} from '../scripts/p04-public-ingress.mjs';
export const signupPath='/functions/v1/backend-v1/account_signup_check_v1';
const codes=new Set(['RATE_LIMITED','TEMPORARY_FAILURE','SERVICE_UNAVAILABLE','VALIDATION_FAILED','CLIENT_UPDATE_REQUIRED']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const json=(value,status)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const failure=(code,status)=>json({ok:false,error:{code,retryable:code==='TEMPORARY_FAILURE',trace_id:newUuidV7()}},status);
async function boundedText(body){
 const reader=body?.getReader();if(!reader)throw Error('EMPTY');const parts=[];let bytes=0;
 for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>65536){await reader.cancel();throw Error('SIZE');}parts.push(value);}
 return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));
}
// Server-only Vercel adapter: the platform must overwrite the connection header.
// This module does not mount a frontend route or change any Auth provider config.
export async function handleAccountSignupCheck(req,env=process.env,fetcher=fetch){
 if(req.method!=='POST')return failure('VALIDATION_FAILED',405);
 const host=env.FTK_SIGNUP_HOSTNAME,secret=env.FTK_PUBLIC_INGRESS_SECRET,key=env.FTK_PUBLIC_ANON_KEY;
 if(!host||host.includes('/')||!secret||!key)return failure('SERVICE_UNAVAILABLE',503);
 let backend;try{backend=new URL(env.FTK_PUBLIC_BACKEND_ORIGIN);if(backend.protocol!=='https:'||backend.origin!==env.FTK_PUBLIC_BACKEND_ORIGIN)throw Error();}catch{return failure('SERVICE_UNAVAILABLE',503);}
 const url=new URL(req.url);if(url.protocol!=='https:'||url.host!==host||req.headers.get('origin')!=='https://'+host)return failure('FORBIDDEN',403);
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??''))return failure('VALIDATION_FAILED',400);
 let body;try{
  const input=JSON.parse(await boundedText(req.body));
  if(!input||input.client_api_version!==1||!uuid(input.request_id)||typeof input.email!=='string'||input.email.length>254||Object.keys(input).some(k=>!['client_api_version','request_id','email'].includes(k)))throw Error('INPUT');
  body=JSON.stringify({client_api_version:1,request_id:input.request_id,email:input.email});
 }catch{return failure('VALIDATION_FAILED',400);}
 try{
  const signed=signPublicRequest(body,req.headers.get('x-vercel-forwarded-for'),secret,signupPath);
  const res=await fetcher(backend.origin+signupPath,{method:'POST',headers:{...signed,apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},body,signal:AbortSignal.timeout(30000),redirect:'error'});
  const out=JSON.parse(await boundedText(res.body));
  if(res.status===200&&out.ok===true&&uuid(out.trace_id)&&['account_exists','available'].includes(out.data?.status))return json({ok:true,data:{status:out.data.status},trace_id:out.trace_id},200);
  if(out.ok===false&&codes.has(out.error?.code)&&uuid(out.error.trace_id))return json({ok:false,error:{code:out.error.code,retryable:out.error.code==='TEMPORARY_FAILURE',trace_id:out.error.trace_id}},res.status);
  throw Error('ENVELOPE');
 }catch{return failure('TEMPORARY_FAILURE',503);}
}
