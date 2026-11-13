import {newUuidV7} from '../scripts/uuid.mjs';
// Exact origins only. No cookies: callers use native Auth bearer tokens.
const allowedHeaders='authorization,apikey,content-type,x-client-info,x-retry-count,traceparent,tracestate,baggage,x-ftk-bot-proof';
export function browserCors(request,env){
 const origin=request.headers.get('origin');
 const denied=()=>({response:Response.json({ok:false,error:{code:'FORBIDDEN',retryable:false,trace_id:newUuidV7()}},{status:403,headers:{'cache-control':'no-store',vary:'Origin'}})});
 if(origin===null)return request.method==='OPTIONS'?denied():{headers:{vary:'Origin'}};
 const origins=(env.FTK_BROWSER_ORIGINS??'').split(',');
 try{
  if(!origins.every(value=>{const u=new URL(value);return u.origin===value&&(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)));})||!origins.includes(origin))return denied();
 }catch{return denied();}
 const headers={'access-control-allow-origin':origin,vary:'Origin'};
 if(request.method!=='OPTIONS')return {headers};
 const requested=(request.headers.get('access-control-request-headers')??'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
 if(request.headers.get('access-control-request-method')!=='POST'||requested.some(x=>!allowedHeaders.split(',').includes(x)))return denied();
 return {headers,response:new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':allowedHeaders,'cache-control':'no-store'}})};
}
export function applyBrowserCors(response,headers){
 const result=new Response(response.body,response);result.headers.delete('access-control-allow-origin');
 for(const [key,value] of Object.entries(headers??{}))result.headers.set(key,value);
 return result;
}
