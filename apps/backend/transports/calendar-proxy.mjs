import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
// Calendar applications can poll an ordinary GET URL but cannot attach a Supabase
// JWT header. This adapter uses only the public anon JWT; token authorization and
// live account/org checks remain in backend-v1. Never log the incoming URL.
export {calendarProxy} from './calendar-gateway.mjs';
import {calendarProxy} from './calendar-gateway.mjs';
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
