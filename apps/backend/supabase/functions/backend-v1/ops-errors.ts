type Env=(name:string)=>string|undefined;
type Trace={critical:boolean;trace_id:string};
type Log=(event:{event:string;operation:string;trace_id:string})=>void;
const recorded=new WeakMap<Response,Trace>();
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

// Retain only server trace metadata, never request/response payloads or errors.
export function noteGatewayError(response:Response,payload:unknown,unexpected=false):void{
 if(!payload||typeof payload!=='object'||!('ok' in payload)||payload.ok!==false||!('error' in payload))return;
 const error=payload.error;
 if(!error||typeof error!=='object'||!('code' in error)||!('trace_id' in error)||typeof error.trace_id!=='string'||!uuid.test(error.trace_id))return;
 const critical=error.code==='INTEGRITY_VIOLATION';
 if(critical||unexpected)recorded.set(response,{critical,trace_id:error.trace_id});
}

export async function reportGatewayError(response:Response,operation:string|undefined,env:Env,send:typeof fetch=fetch,log:Log=event=>console.error(JSON.stringify(event))):Promise<void>{
 const trace=recorded.get(response);if(!trace)return;recorded.delete(response);
 const context={operation:operation??'unresolved',trace_id:trace.trace_id};
 log({event:trace.critical?'backend_integrity_violation':'backend_unexpected_error',...context});
 if(!trace.critical)return;
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!base||!key||!operation)throw new Error('REPORT_CONFIG_REQUIRED');
  const attempt=(async()=>{
   const rpc=await send(base+'/rest/v1/rpc/outbox_deliver_v1',{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:{operation,trace_id:trace.trace_id},p_actor_auth_id:null,p_session_id:null,p_ids:[],p_aux:{ops_integrity_event:true}}),signal:controller.signal});
   if(!rpc.ok||(await rpc.json())?.accepted!==true)throw new Error('REPORT_UNAVAILABLE');
  })();
  await Promise.race([attempt,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('REPORT_DEADLINE'));},1500);})]);
 }catch{log({event:'backend_integrity_report_failed',...context});}
 finally{clearTimeout(timer);controller.abort();}
}
