import {lifecycleReauth} from './lifecycle-auth.ts';
import {passwordChallenge,passwordRecovery} from './account-auth.ts';
import {publicIngress,verifyPublicBot,publicBotHostname} from "./public-ingress.ts";
import {importStorage,parseImportCsv} from "./import-file.ts";
import {documentStorage} from "./document-storage.ts";
import {verifySettingsImage} from './settings-image.ts';
import implementation from "./implemented.json" with {type:"json"};
import { v7 } from "uuid";
import * as validators from "./validators.js";
const implemented=new Set(implementation.operations);
const json=(x:unknown,status=200,noStore=false)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","access-control-allow-origin":"*",...(noStore?{'cache-control':'private, no-store'}:{})}});
const failure=(code:string,status=400)=>json({ok:false,error:{code,retryable:code==="TEMPORARY_FAILURE"||code==="OPERATION_IN_PROGRESS",trace_id:v7()}},status);
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("",{headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-ftk-client-ip,x-ftk-ingress-time,x-ftk-ingress-signature,x-ftk-bot-proof","access-control-allow-methods":"POST,OPTIONS"}});
 if(req.method!=="POST")return failure("VALIDATION_FAILED");
 try{
  const operation=new URL(req.url).pathname.split("/").filter(Boolean).at(-1)!;
  
  if(!implemented.has(operation))return failure("NOT_FOUND",404);
  const body=await req.text();if(body.length>2097152)return failure("VALIDATION_FAILED");
  const request=JSON.parse(body);if(request.client_api_version!==1)return operation==='account_password_reset_request_v1'?failure("VALIDATION_FAILED"):failure("CLIENT_UPDATE_REQUIRED",426);const validate=(validators as any)["request_"+operation];
  if(!validate?.(request))return failure("VALIDATION_FAILED");
  const base=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if(operation==='account_password_reset_request_v1'){
   const result=await passwordRecovery(req,body,request,base,key,n=>Deno.env.get(n),async aux=>{
    const rpc=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:request,p_actor_auth_id:null,p_session_id:null,p_ids:Array.from({length:32},()=>v7()),p_aux:aux})});
    if(!rpc.ok)throw Error('RECOVERY_RPC_UNAVAILABLE');return rpc.json();
   });
   if(result.error)return failure(result.error);if(result.ok===false)return json(result);
   const out={ok:true,data:result.data,trace_id:v7()};if(!(validators as any)['success_'+operation](out))return failure('INTEGRITY_VIOLATION',500);return json(out);
  }
  if(operation==='public_calendar_get_v1'||operation==='public_application_submit_v1'){
   const env=(name:string)=>Deno.env.get(name);
   const rpcPublic=async(aux:unknown)=>{
    const rpc=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:request,p_actor_auth_id:null,p_session_id:null,p_ids:Array.from({length:64},()=>v7()),p_aux:aux})});
    if(!rpc.ok)throw new Error('Public RPC unavailable');return rpc.json();
   };
   let aux:Record<string,unknown>|null=null;
   if(operation==='public_application_submit_v1'){
    if(!env('FTK_TURNSTILE_SECRET')||!publicBotHostname(env))return failure('SERVICE_UNAVAILABLE',503);
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
   return json(result,200,true);
  }
  const authorization=req.headers.get("authorization");if(!authorization?.startsWith("Bearer "))return failure("AUTH_REQUIRED",401);
  const userResponse=await fetch(base+"/auth/v1/user",{headers:{authorization,apikey:key}});
  if(!userResponse.ok)return failure("AUTH_REQUIRED",401);
  const user=await userResponse.json();
  const part=authorization.slice(7).split(".")[1].replaceAll("-","+").replaceAll("_","/");
  const claims=JSON.parse(atob(part));if(claims.sub!==user.id||!claims.session_id)return failure("SESSION_REVOKED",401);
  // Native Auth owns factor state. Never read user_metadata for assurance.
  if(user.factors?.some((f:any)=>f.status==='verified')&&claims.aal!=='aal2'&&!(operation==='account_sessions_revoke_v1'&&request.mode==='current'))return failure('AUTH_REQUIRED',401);
  const authAux={verified_aal:claims.aal==='aal2'?'aal2':'aal1'};
  let imageAux:Record<string,unknown>={};
  const image=operation==='account_profile_update_v1'?request.photo:operation==='settings_update_v1'?request.logo_image:undefined;
  if(image!==undefined&&image!==null){try{imageAux=await verifySettingsImage(image);}catch{return failure('VALIDATION_FAILED');}}
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
  if(operation==='account_delete_apply_v1'||operation==='organization_delete_apply_v1'||operation==='account_totp_remove_v1'||operation==='account_google_link_prepare_v1'||(operation==='account_sessions_revoke_v1'&&request.mode==='others')||(operation==='job_status_get_v1'&&request.org_id===null)){
   const proof=await lifecycleReauth(base,key,(operation==='job_status_get_v1'?authorization.slice(7):request.reauth),user.id);if(proof.error)return failure(proof.error,proof.error==='AUTH_REQUIRED'?401:503);invite=proof.context!;
  }
  const storage=documentStorage(base,key);
  const imports=importStorage(base,key);
  if(operation==='file_upload_complete_v1'){
   const contextResponse=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:request,p_actor_auth_id:user.id,p_session_id:claims.session_id,p_ids:Array.from({length:count},()=>v7()),p_aux:{...authAux,phase:'storage_context'}})});
   if(!contextResponse.ok)return failure('TEMPORARY_FAILURE',503);const context=await contextResponse.json();
   if(!context._internal_storage)return json(context);
   const meta=context._internal_storage;
   if(meta.state==='ready')invite={storage_verified:true,object_key:meta.object_key,bytes:meta.bytes,mime:meta.mime,checksum:meta.checksum};
   else{
    try{
     if(meta.purpose==='import'){await imports.read(meta);invite={storage_verified:true,object_key:meta.object_key,bytes:meta.bytes,mime:meta.mime,checksum:meta.checksum};}
     else{const file=await storage.download(meta.object_key,{bytes:meta.bytes,mime:meta.mime});invite={storage_verified:true,object_key:meta.object_key,bytes:file.size,mime:file.mime,checksum:file.checksum};}
    }
    catch{return failure('VALIDATION_FAILED');}
   }
  }
  const rpcContext=async(aux:unknown)=>{
   const r=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:request,p_actor_auth_id:user.id,p_session_id:claims.session_id,p_ids:Array.from({length:count},()=>v7()),p_aux:{...(aux as object??{}),...authAux}})});
   if(!r.ok)throw Error('RPC_UNAVAILABLE');return r.json();
  };
  if(operation==='account_google_link_prepare_v1'){
   // This parses only a restrictive target. Native Auth must still verify the
   // token's signature, issuer, audience and nonce in the subsequent link call.
   let subject:string;try{const part=request.google_id_token.split('.')[1];subject=JSON.parse(atob(part.replaceAll('-','+').replaceAll('_','/'))).sub;if(typeof subject!=='string'||subject.length<1||subject.length>255)throw Error();}catch{return failure('VALIDATION_FAILED');}
   const prepared=await rpcContext({...invite,google_subject:subject});if(!prepared._internal_google_link)return json(prepared);
   const out={ok:true,data:{provider:'google',status:'ready',expires_in:10},trace_id:v7()};if(!(validators as any)['success_'+operation](out))return failure('INTEGRITY_VIOLATION',500);return json(out);
  }
  if(operation==='account_totp_remove_v1'){
   const prepared=await rpcContext({...invite,phase:'totp_prepare'});
   if(prepared._internal_totp_remove){
    if(prepared._internal_totp_remove.factor_id!==request.factor_id)return failure('INTEGRITY_VIOLATION',500);
    // Even a network timeout may follow a committed native deletion. Confirm its DB intent.
    try{const response=await fetch(base+'/auth/v1/factors/'+encodeURIComponent(request.factor_id),{method:'DELETE',headers:{authorization,apikey:key},signal:AbortSignal.timeout(10000)});await response.body?.cancel();}catch{}
    const completed=await rpcContext({...invite,phase:'totp_complete'});
    if(completed.ok&&!(validators as any)['success_'+operation](completed))return failure('INTEGRITY_VIOLATION',500);return json(completed);
   }
   if(prepared.ok&&!(validators as any)['success_'+operation](prepared))return failure('INTEGRITY_VIOLATION',500);return json(prepared);
  }
  if(operation==='account_password_change_v1'){
   const result=await passwordChallenge(base,key,authorization,n=>Deno.env.get(n),rpcContext);
   if(result.error)return failure(result.error);if(result.ok===false)return json(result);
   const out={ok:true,data:result.data,trace_id:v7()};if(!(validators as any)['success_'+operation](out))return failure('INTEGRITY_VIOLATION',500);return json(out);
  }
  if(operation==='import_preview_v1'){
   const context=await rpcContext({phase:'p06_import_file'});
   if(!context._internal_import){if(context.ok&&!(validators as any)['success_'+operation](context))return failure('INTEGRITY_VIOLATION',500);return json(context);}
   const meta=context._internal_import;
   try{const text=await imports.read(meta);const rows=parseImportCsv(text,request.mapping,meta.max_rows);invite={import_verified:true,checksum:meta.checksum,rows};}
   catch{return failure('VALIDATION_FAILED');}
  }
  if(operation==='report_file_get_v1'&&new URL(req.url).searchParams.get('download')==='csv'){
   const context=await rpcContext({phase:'p06_download'});if(!context._internal_download)return json(context);
   const file=context._internal_download;if(typeof file.body!=='string'||file.body.length>24*1024*1024||!/^report-[a-f0-9-]{36}\.csv$/.test(file.filename))return failure('INTEGRITY_VIOLATION',500);
   const bytes=Uint8Array.from(atob(file.body),x=>x.charCodeAt(0));
   return new Response(bytes,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="'+file.filename+'"','cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':'*'}});
  }
  let requiredCount=count;
  for(let attempt=0;attempt<4;attempt++){
  const ids=Array.from({length:Math.max(count*2**attempt,requiredCount)},()=>v7());
  const rpc=await fetch(base+"/rest/v1/rpc/"+operation,{method:"POST",headers:{authorization:"Bearer "+key,apikey:key,"content-type":"application/json","Content-Profile":"api_v1"},
   body:JSON.stringify({p_request:request,p_actor_auth_id:user.id,p_session_id:claims.session_id,p_ids:ids,p_aux:{...(invite??{}),...authAux,...imageAux}})});
  if(!rpc.ok)return failure("TEMPORARY_FAILURE",503);
  const result=await rpc.json();if(result._internal_retry==="uuid_bank_exhausted"){
   // Trusted RPC preflight derives size from the stored immutable selection.
   const n=result.required_uuid_count;
   if(n!==undefined){if(!Number.isSafeInteger(n)||n<1||n>2*Math.ceil(2097152/36)+64)return failure("INTEGRITY_VIOLATION",500);requiredCount=Math.max(requiredCount,n);}
   continue;
  }if(result.ok){
   if(operation==='import_upload_prepare_v1'){
    if(Date.parse(result.data.expires_at)<=Date.now())return failure('VALIDATION_FAILED');
    result.data.upload_url=await imports.upload(result.data.upload_url);
   }
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
  return json(result,200,operation==='media_get_v1');
  }
  return failure("TEMPORARY_FAILURE",503);
 }catch{return failure("TEMPORARY_FAILURE",503);}
});
