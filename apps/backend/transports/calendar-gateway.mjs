import {v7} from 'uuid';
// Shared Fetch adapter for Node and the native Supabase GET/HEAD gateway.
export function calendarProxy({supabaseUrl,anonKey,fetcher=fetch,pathPrefix='',diagnostics=false}){
 const base=new URL(supabaseUrl);
 if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||!(base.protocol==='https:'||base.protocol==='http:'&&(['localhost','127.0.0.1','[::1]'].includes(base.hostname)||base.origin==='http://kong:8000'))||typeof anonKey!=='string'||!anonKey)throw Error('CALENDAR_PROXY_NOT_CONFIGURED');
 if(!['','/personal-calendar','/functions/v1/personal-calendar'].includes(pathPrefix))throw Error('CALENDAR_PROXY_NOT_CONFIGURED');
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
 const fail=(status,reason,upstream,worker)=>new Response(null,{status,headers:diagnostics&&status===503?{...headers,'x-ftk-calendar-failure':reason,...(upstream?{'x-ftk-calendar-upstream-status':String(upstream)}:{}),...(worker?{'x-ftk-calendar-worker':worker}:{})}:headers});
 return async request=>{
  if(!['GET','HEAD'].includes(request.method))return fail(405);
  const url=new URL(request.url),match=/^\/calendar\/([a-f0-9]{64})\.ics$/.exec(url.pathname.startsWith(pathPrefix)?url.pathname.slice(pathPrefix.length):'');
  if(!match||url.search)return fail(404);
  let stage='upstream-fetch';
  try{
   const upstream=await fetcher(base.origin+'/functions/v1/backend-v1/calendar_feed_get_v1',{method:'POST',redirect:'error',headers:{apikey:anonKey,authorization:'Bearer '+anonKey,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:v7(),token:match[1]}),signal:AbortSignal.timeout(30000)});
   if(!upstream.ok){
    let worker;
    if(diagnostics&&upstream.body){
     const reader=upstream.body.getReader(),parts=[];let size=0;
     try{
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();break;}parts.push(value);}
      if(size<=2048){const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}const code=JSON.parse(new TextDecoder().decode(bytes))?.code;if(['BOOT_ERROR','WORKER_ERROR','WORKER_LIMIT','WORKER_TIMEOUT'].includes(code))worker=code;}
     }catch{worker=undefined;}
    }
    return fail(upstream.status===404?404:503,'upstream-http',upstream.status,worker);
   }
   // Bounded response consumption: 2 MiB ICS base64 plus the JSON envelope.
   stage='upstream-body';
   const reader=upstream.body?.getReader();if(!reader)return fail(503,'upstream-body');const chunks=[];let count=0;
   for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>Math.ceil(2097152/3)*4+65536){await reader.cancel();return fail(503,'upstream-size');}chunks.push(value);}
   const joined=new Uint8Array(count);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
   stage='upstream-json';
   const result=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(joined));
   if(result.ok!==true)return fail(['NOT_FOUND','FORBIDDEN','AUTH_REQUIRED','SESSION_REVOKED','PLAN_FEATURE_UNAVAILABLE'].includes(result.error?.code)?404:503,'upstream-application');
   stage='ics-base64';
   const encoded=result.data?.ics_base64;if(typeof encoded!=='string'||!encoded.length||encoded.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return fail(503,'ics-base64');
   const decoded=atob(encoded);if(decoded.length>2097152||btoa(decoded)!==encoded)return fail(503,'ics-base64');
   const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
   return new Response(request.method==='HEAD'?null:bytes,{status:200,headers:{...headers,'content-type':'text/calendar; charset=utf-8','content-disposition':'inline; filename="calendar.ics"','content-length':String(bytes.length)}});
  }catch(error){return fail(503,stage==='upstream-fetch'&&['TimeoutError','AbortError'].includes(error?.name)?'upstream-fetch-timeout':stage);}
 };
}
