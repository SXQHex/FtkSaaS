import {createServer} from 'node:http';
import {v7} from 'uuid';
import {pathToFileURL} from 'node:url';
// Calendar applications can poll an ordinary GET URL but cannot attach a Supabase
// JWT header. This adapter uses only the public anon JWT; token authorization and
// live account/org checks remain in backend-v1. Never log the incoming URL.
export function calendarProxy({supabaseUrl,anonKey,fetcher=fetch}){
 const base=new URL(supabaseUrl);
 if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||!(base.protocol==='https:'||base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))||typeof anonKey!=='string'||!anonKey)throw Error('CALENDAR_PROXY_NOT_CONFIGURED');
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
 const fail=(status)=>new Response(null,{status,headers});
 return async request=>{
  if(!['GET','HEAD'].includes(request.method))return fail(405);
  const url=new URL(request.url),match=/^\/calendar\/([a-f0-9]{64})\.ics$/.exec(url.pathname);
  if(!match||url.search)return fail(404);
  try{
   const upstream=await fetcher(base.origin+'/functions/v1/backend-v1/calendar_feed_get_v1',{method:'POST',headers:{apikey:anonKey,authorization:'Bearer '+anonKey,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:v7(),token:match[1]}),signal:AbortSignal.timeout(30000)});
   if(!upstream.ok)return fail(upstream.status===404?404:503);
   // Bounded response consumption: 2 MiB ICS base64 plus the JSON envelope.
   const reader=upstream.body?.getReader();if(!reader)return fail(503);const chunks=[];let count=0;
   for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>Math.ceil(2097152/3)*4+65536){await reader.cancel();return fail(503);}chunks.push(value);}
   const joined=new Uint8Array(count);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
   const result=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(joined));
   if(result.ok!==true)return fail(['NOT_FOUND','FORBIDDEN','AUTH_REQUIRED','SESSION_REVOKED','PLAN_FEATURE_UNAVAILABLE'].includes(result.error?.code)?404:503);
   const encoded=result.data?.ics_base64;if(typeof encoded!=='string'||!encoded.length||encoded.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return fail(503);
   const bytes=Buffer.from(encoded,'base64');if(bytes.length>2097152||bytes.toString('base64')!==encoded)return fail(503);
   return new Response(request.method==='HEAD'?null:bytes,{status:200,headers:{...headers,'content-type':'text/calendar; charset=utf-8','content-disposition':'inline; filename="calendar.ics"','content-length':String(bytes.length)}});
  }catch{return fail(503);}
 };
}
export function startCalendarProxy({port,host='127.0.0.1',...options}){
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('INVALID_CALENDAR_PROXY_PORT');
 const handle=calendarProxy(options);
 const server=createServer(async(req,res)=>{
  try{const response=await handle(new Request('http://calendar.invalid'+req.url,{method:req.method}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(503,{'cache-control':'no-store'});res.end();}
 });server.listen(port,host);return server;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const server=startCalendarProxy({port:Number(process.env.PORT),host:process.env.HOST||'127.0.0.1',supabaseUrl:process.env.SUPABASE_URL,anonKey:process.env.SUPABASE_ANON_KEY});
 server.on('error',()=>{process.stderr.write('Calendar adapter unavailable\n');process.exitCode=1;});
}
