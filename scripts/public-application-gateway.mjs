// Public transport only. Business authorization, CAPTCHA and quotas stay in Edge/RPC.
import {signPublicApplication,publicSubmitPath} from './p04-public-ingress.mjs';
const base='https://gwyprhenabtpkbojephw.supabase.co';
const json=(code,status)=>Response.json({error:code},{status,headers:{'cache-control':'no-store'}});
export async function handlePublicApplication(req,env=process.env,fetcher=fetch){
 if(req.method!=='POST')return json('METHOD_NOT_ALLOWED',405);
 const host=env.FTK_PUBLIC_APPLICATION_HOSTNAME,secret=env.FTK_PUBLIC_INGRESS_SECRET,key=env.FTK_PUBLIC_ANON_KEY;
 if(!host||host.includes('/')||!secret||!key)return json('SERVICE_UNAVAILABLE',503);
 const url=new URL(req.url);
 if(url.protocol!=='https:'||url.hostname!==host||req.headers.get('origin')!=='https://'+host)return json('FORBIDDEN',403);
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??''))return json('VALIDATION_FAILED',400);
 // Only Vercel ingress is supported. Vercel overwrites this connection header;
 // no trusted external proxy mode is configured. Never read client x-ftk-* headers.
 const ip=req.headers.get('x-vercel-forwarded-for');
 let body;
 try{
  const reader=req.body?.getReader();if(!reader)return json('VALIDATION_FAILED',400);
  const parts=[];let n=0;
  for(;;){const {value,done}=await reader.read();if(done)break;n+=value.byteLength;if(n>65536){await reader.cancel();return json('PAYLOAD_TOO_LARGE',413);}parts.push(value);}
  const bytes=new Uint8Array(n);let pos=0;for(const part of parts){bytes.set(part,pos);pos+=part.byteLength;}
  body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);JSON.parse(body);
  const signed=signPublicApplication(body,ip,secret);
  const res=await fetcher(base+publicSubmitPath,{method:'POST',headers:{...signed,apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},body,signal:AbortSignal.timeout(15000),redirect:'error'});
  // Do not forward cookies, provider headers, credentials, or an arbitrary upstream URL.
  return new Response(await res.text(),{status:res.status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch{return json('TEMPORARY_FAILURE',503);}
}
