import {request_public_calendar_get_v1 as validRequest,success_public_calendar_get_v1 as validSuccess} from './spa-validators.mjs';
import {failure_envelope as validFailure} from './spa-validators.mjs';
import {newUuidV7} from '../scripts/uuid.mjs';
const json=(body,status)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const failure=(code,status)=>json({ok:false,error:{code,retryable:code==='TEMPORARY_FAILURE',trace_id:newUuidV7()}},status);
async function readJson(stream,max){
 const reader=stream?.getReader();if(!reader)throw Error();const chunks=[];let length=0;
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw Error();}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));
}
export async function publicCalendarGateway(request,env,fetcher=fetch){
 if(request.method!=='POST'||!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))return failure('VALIDATION_FAILED',400);
 let base;try{base=new URL(env.FTK_PUBLIC_BACKEND_ORIGIN);if(base.protocol!=='https:'||base.origin!==env.FTK_PUBLIC_BACKEND_ORIGIN||!env.FTK_PUBLIC_ANON_KEY)throw Error();}catch{return failure('SERVICE_UNAVAILABLE',503);}
 let body;try{body=await readJson(request.body,65536);if(!validRequest(body))throw Error();}catch{return failure('VALIDATION_FAILED',400);}
 let stage='upstream-fetch',upstreamStatus;
 try{
  const key=env.FTK_PUBLIC_ANON_KEY;
  const upstream=await fetcher(base.origin+'/functions/v1/backend-v1/public_calendar_get_v1',{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
  upstreamStatus=upstream.status;stage='upstream-body';
  const result=await readJson(upstream.body,4194304);
  stage='upstream-envelope';
  if(upstream.status===200&&validSuccess(result))return json(result,200);
  const e=result?.error;
  if(validFailure(result))return json({ok:false,error:{code:e.code,retryable:e.retryable,trace_id:e.trace_id}},upstream.status);
  throw Error();
 }catch{
  const response=failure('TEMPORARY_FAILURE',503);
  if(env.FTK_SPA_DIAGNOSTICS==='1'){response.headers.set('x-ftk-ingress-failure',stage);if(upstreamStatus)response.headers.set('x-ftk-upstream-status',String(upstreamStatus));}
  return response;
 }
}
