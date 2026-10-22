import {measured as aggregate,timedFetch as fetchWithTiming} from '../scripts/ci/timings.mjs';
const enabled=process.env.FTK_TEST_DIAGNOSTICS==='1'||!!process.env.CI;let sequence=0;
async function traced(kind,name,fn){
 const id=++sequence;
 const log=(state,extra={})=>{if(enabled)console.error('[request] '+JSON.stringify({at:new Date().toISOString(),state,kind,name,id,...extra}));};
 log('start');try{const result=await fn();log('end');return result;}catch(e){log('error',{code:e.code??e.name});throw e;}
}
export const measured=(kind,name,fn)=>traced(kind,name,()=>aggregate(kind,name,fn));
// The signal remains attached through response.text/json, bounding body reads too.
export const timedFetch=(name,url,options={})=>traced('http_headers',name,()=>fetchWithTiming(name,url,{...options,signal:options.signal??AbortSignal.timeout(60000)}));
