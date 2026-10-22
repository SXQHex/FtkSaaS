import {publicIngress,verifyPublicBot} from "./public-ingress.ts";
import {documentStorage} from "./document-storage.ts";
import implementation from "./implemented.json" with {type:"json"};
import { v7 } from "uuid";
import * as validators from "./validators.js";
const implemented=new Set(implementation.operations);
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","access-control-allow-origin":"*"}});
const failure=(code:string,status=400)=>json({ok:false,error:{code,retryable:code==="TEMPORARY_FAILURE"||code==="OPERATION_IN_PROGRESS",trace_id:v7()}},status);
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("",{headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type","access-control-allow-methods":"POST,OPTIONS"}});
 if(req.method!=="POST")return failure("VALIDATION_FAILED");
 try{
  const operation=new URL(req.url).pathname.split("/").filter(Boolean).at(-1)!;
  
  if(!implemented.has(operation))return failure("NOT_FOUND",404);
  const body=await req.text();if(body.length>2097152)return failure("VALIDATION_FAILED");
  const request=JSON.parse(body);if(request.client_api_version!==1)return failure("CLIENT_UPDATE_REQUIRED",426);const validate=(validators as any)["request_"+operation];
  if(!validate?.(request))return failure("VALIDATION_FAILED");
  const base=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if(operation==='public_calendar_get_v1'||operation==='public_application_submit_v1'){
   const env=(name:string)=>Deno.env.get(name);
   const rpcPublic=async(aux:unknown)=>{
    const rpc=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:request,p_actor_auth_id:null,p_session_id:null,p_ids:Array.from({length:64},()=>v7()),p_aux:aux})});
    if(!rpc.ok)throw new Error('Public RPC unavailable');return rpc.json();
   };
   let aux:Record<string,unknown>|null=null;
   if(operation==='public_application_submit_v1'){
    if(!env('FTK_TURNSTILE_SECRET')||!env('FTK_TURNSTILE_HOSTNAME'))return failure('SERVICE_UNAVAILABLE',503);
    const ingress=await publicIngress(req,body,env);if(!ingress)return failure('SERVICE_UNAVAILABLE',503);
    aux={phase:'preflight',ip_hash:ingress.ip_hash,target_hash:await ingress.targetHash(request.contact)};
    const preflight=await rpcPublic(aux);
    if(!preflight.ok)return json(preflight);
    if(preflight.data?.accepted===true)return json(preflight);
    if(!await verifyPublicBot(request.bot_proof,ingress.ip,env))return failure('BOT_VERIFICATION_FAILED');
    aux={...aux,phase:'submit',bot_verified:true};
   }
   const result=await rpcPublic(aux);
   if(result.ok&&!(validators as any)['success_'+operation]?.(result))return failure('INTEGRITY_VIOLATION',500);
   return json(result);
  }
  const authorization=req.headers.get("authorization");if(!authorization?.startsWith("Bearer "))return failure("AUTH_REQUIRED",401);
  const userResponse=await fetch(base+"/auth/v1/user",{headers:{authorization,apikey:key}});
  if(!userResponse.ok)return failure("AUTH_REQUIRED",401);
  const user=await userResponse.json();
  const part=authorization.slice(7).split(".")[1].replaceAll("-","+").replaceAll("_","/");
  const claims=JSON.parse(atob(part));if(claims.sub!==user.id||!claims.session_id)return failure("SESSION_REVOKED",401);
  // Authenticated input never controls internal IDs or actor context.
  const readOnly=operation.endsWith("_get_v1")||operation.endsWith("_list_v1")||operation.endsWith("_preview_v1");
  const bulk=["event_attendance_close_v1","event_cancel_apply_v1","sale_apply_v1","program_preview_v1","program_apply_v1","session_change_preview_v1","session_change_apply_v1","class_assignment_set_v1","attendance_close_v1","attendance_correct_apply_v1","reservation_impact_apply_v1","negative_limit_set_v1","policy_publish_v1"].includes(operation);
  const count=(bulk?4096:readOnly?32:512)+2*(request.discipline_ids?.length??0)+3*(request.assignments?.length??0)+2*(request.contacts?.length??0)+2*(request.terms?.scopes?.length??0)+(request.requirements?.length??0);
  
  let invite:null|Record<string,unknown>=null;
  if(operation==="account_access_send_v1"||operation.endsWith("_preview_v1")||operation==="sale_preview_v1"){
   const raw=crypto.getRandomValues(new Uint8Array(32));const token=Array.from(raw,x=>x.toString(16).padStart(2,"0")).join("");
   invite={token};
   if(operation==='account_access_send_v1'){
    const enc=new TextEncoder(),hash=await crypto.subtle.digest('SHA-256',enc.encode(token));
    const token_hash=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
    const aes=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(key)),'AES-GCM',false,['encrypt']);
    const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,enc.encode(token));
    const b64=(x:Uint8Array)=>btoa(String.fromCharCode(...x));
    invite={token_hash,sealed_token:JSON.stringify({iv:b64(iv),cipher:b64(new Uint8Array(cipher))})};
   }
  }
  const storage=documentStorage(base,key);
  if(operation==='file_upload_complete_v1'){
   const contextResponse=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:request,p_actor_auth_id:user.id,p_session_id:claims.session_id,p_ids:Array.from({length:count},()=>v7()),p_aux:{phase:'storage_context'}})});
   if(!contextResponse.ok)return failure('TEMPORARY_FAILURE',503);const context=await contextResponse.json();
   if(!context._internal_storage)return json(context);
   const meta=context._internal_storage;
   if(meta.state==='ready')invite={storage_verified:true,object_key:meta.object_key,bytes:meta.bytes,mime:meta.mime,checksum:meta.checksum};
   else{
    try{const file=await storage.download(meta.object_key,{bytes:meta.bytes,mime:meta.mime});invite={storage_verified:true,object_key:meta.object_key,bytes:file.size,mime:file.mime,checksum:file.checksum};}
    catch{return failure('VALIDATION_FAILED');}
   }
  }
  let requiredCount=count;
  for(let attempt=0;attempt<4;attempt++){
  const ids=Array.from({length:Math.max(count*2**attempt,requiredCount)},()=>v7());
  const rpc=await fetch(base+"/rest/v1/rpc/"+operation,{method:"POST",headers:{authorization:"Bearer "+key,apikey:key,"content-type":"application/json","Content-Profile":"api_v1"},
   body:JSON.stringify({p_request:request,p_actor_auth_id:user.id,p_session_id:claims.session_id,p_ids:ids,p_aux:invite})});
  if(!rpc.ok)return failure("TEMPORARY_FAILURE",503);
  const result=await rpc.json();if(result._internal_retry==="uuid_bank_exhausted"){
   // Trusted RPC preflight derives size from the stored immutable selection.
   const n=result.required_uuid_count;
   if(n!==undefined){if(!Number.isSafeInteger(n)||n<1||n>2*Math.ceil(2097152/36)+64)return failure("INTEGRITY_VIOLATION",500);requiredCount=Math.max(requiredCount,n);}
   continue;
  }if(result.ok){
   if(operation==='document_upload_prepare_v1'){
    if(Date.parse(result.data.expires_at)<=Date.now())return failure('VALIDATION_FAILED');
    result.data.upload_url=await storage.upload(result.data.upload_url);
   }
   if(operation==='document_requirements_get_v1'&&request.content_file_id){
    const item=result.data.find((x:any)=>x.file.id===request.content_file_id);if(!item)return failure('NOT_FOUND',404);
    const file=await storage.download(request.org_id+'/'+item.file.id);if(file.checksum!==item.content_hash)return failure('INTEGRITY_VIOLATION',500);
    let raw='';for(let i=0;i<file.bytes.length;i+=8192)raw+=String.fromCharCode(...file.bytes.slice(i,i+8192));
    item.content={mime:file.mime,encoding:'base64',data:btoa(raw)};
   }
   const success=(validators as any)["success_"+operation];if(!success?.(result))return failure("INTEGRITY_VIOLATION",500);}
  return json(result);
  }
  return failure("TEMPORARY_FAILURE",503);
 }catch{return failure("TEMPORARY_FAILURE",503);}
});
