import nodeTest from 'node:test';
import pg from 'pg';
import {performance} from 'node:perf_hooks';
const pending=new Map();let sequence=0;
export function event(state,label,extra={}){console.error('[diagnostic] '+JSON.stringify({at:new Date().toISOString(),state,label,...extra}));}
export async function step(label,fn){
 const id=++sequence,started=performance.now();pending.set(id,label);event('start',label,{id});
 try{const result=await fn();event('end',label,{id,ms:Math.round(performance.now()-started)});return result;}
 catch(error){event('error',label,{id,code:error.code??error.name,routine:error.routine});throw error;}
 finally{pending.delete(id);}
}
function wrap(fn){return async t=>{
 const original=t.test.bind(t);t.test=(name,options,body)=>typeof options==='function'?original(name,{timeout:120000},wrap(options)):original(name,{timeout:120000,...options},wrap(body));
 const timer=setInterval(()=>event('pending',t.name,{steps:[...pending.values()],resources:process.getActiveResourcesInfo()}),15000);timer.unref();
 try{return await step('test: '+t.name,()=>fn(t));}finally{clearInterval(timer);}
};}
export default function test(name,fn){return nodeTest(name,{timeout:300000},wrap(fn));}
export function resources(t){
 const clients=new Map();
 async function close(c){
  if(!clients.has(c))return;
  let timer;
  try{await step('pg.close',()=>Promise.race([clients.get(c)(),new Promise((_,reject)=>{timer=setTimeout(()=>{c.connection?.stream?.destroy();reject(new Error('PG_CLOSE_TIMEOUT'));},5000);})]));}
  finally{clearTimeout(timer);clients.delete(c);}
 }
 t.after(async()=>{
  const errors=[];for(const c of clients.keys())try{await close(c);}catch(e){errors.push(e);}
  event('resources.closed',t.name,{clients:clients.size});if(errors.length)throw new AggregateError(errors,'PG_CLOSE_FAILED');
 });
 return {
  track(c){
   if(clients.has(c))return c;clients.set(c,c.end.bind(c));c.end=()=>close(c);const query=c.query.bind(c);
   c.query=(sql,...args)=>{const text=typeof sql==='string'?sql:sql.text;const label=(text.match(/^\s*(\w+)(?:\s+(\w+))?/)??[]).slice(1).filter(Boolean).join(' ').toUpperCase();return step('pg.query: '+label,()=>query(sql,...args));};return c;
  },
  async connect(url){if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw new Error('LOCAL_DB_REQUIRED');const c=this.track(new pg.Client({connectionString:url,connectionTimeoutMillis:10000,statement_timeout:30000,lock_timeout:5000,query_timeout:45000}));await step('pg.connect',()=>c.connect());return c;},
  close
 };
}
