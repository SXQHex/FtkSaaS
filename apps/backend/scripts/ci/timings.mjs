import {ciFile} from '../paths.mjs';
import fs from 'node:fs';import path from 'node:path';import {performance} from 'node:perf_hooks';
const enabled=process.env.FTK_TEST_TIMINGS==='1',rows=new Map(),started=performance.now();
export function record(kind,name,ms){if(!enabled)return;const key=kind+':'+name;const r=rows.get(key)??{kind,name,count:0,total_ms:0,max_ms:0};r.count++;r.total_ms+=ms;r.max_ms=Math.max(r.max_ms,ms);rows.set(key,r);}
export async function measured(kind,name,fn){const t=performance.now();try{return await fn();}finally{record(kind,name,performance.now()-t);}}
export async function timedFetch(name,...args){const t=performance.now();try{const r=await fetch(...args); // Headers latency; body decode remains in caller.
 record('http_headers',name,performance.now()-t);return r;
}catch(e){record('http_error',name,performance.now()-t);throw e;}}
if(enabled)process.on('exit',()=>{try{fs.mkdirSync(ciFile('timings'),{recursive:true});fs.writeFileSync(ciFile('timings',process.pid+'.json'),JSON.stringify({suite:path.basename(process.argv[1]??'unknown'),wall_ms:performance.now()-started,rows:[...rows.values()]}));}catch{ /* Measurement must not alter test results. */ }});
