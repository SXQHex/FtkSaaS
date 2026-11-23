import {calendarFeed,type CalendarFeedItem} from './calendar-feed.ts';
import {nativeUser,sessionClaims} from './auth-payload.ts';
import {isRecord,isUnknownArray,parseJson,requireInteger,requireRecord,requireString,responseJson} from './edge-json.ts';
import {calendarToken,calendarTokenHash,calendarOrigin,calendarSubscriptionUrl,calendarAppUrl} from './calendar-token.ts';
import {lifecycleReauth} from './lifecycle-auth.ts';
import {accountSignupCheck} from './account-signup.ts';
import {browserCors,applyBrowserCors} from '../../../transports/browser-cors.mjs';
import {invitationTick} from './invitation-delivery.ts';
import {crmIntakeTargets,publicIngress,verifyPublicBot,publicBotHostnames} from "./public-ingress.ts";
import {importStorage,parseImportCsv} from "./import-file.ts";
import {documentStorage} from "./document-storage.ts";
import {verifySettingsImage} from './settings-image.ts';
import {noteGatewayError,reportGatewayError} from './ops-errors.ts';
import implementation from "./implemented.json" with {type:"json"};
import { v7 } from "uuid";
import * as validators from "./validators.js";
const implemented=new Set(implementation.operations);
const validatorRegistry: ReadonlyMap<string,(value:unknown)=>boolean>=new Map(Object.entries(validators));
const validate=(kind:'request'|'success',operation:string,data:unknown)=>validatorRegistry.get(kind+'_'+operation)?.(data)===true;
const validFailure=(value:unknown)=>validators.failure_envelope(value);
const arrayLength=(value:unknown)=>isUnknownArray(value)?value.length:0;
function isCalendarItem(value:unknown):value is Omit<CalendarFeedItem,'app_url'>{
 return isRecord(value)&&typeof value.id==='string'&&typeof value.org_id==='string'&&
  typeof value.version==='number'&&typeof value.title==='string'&&typeof value.location==='string'&&
  typeof value.starts_at==='string'&&typeof value.ends_at==='string';
}
function isImage(value:unknown):value is Parameters<typeof verifySettingsImage>[0]{
 return isRecord(value)&&typeof value.mime==='string'&&['image/png','image/jpeg','image/webp'].includes(value.mime)&&
  typeof value.data_base64==='string'&&typeof value.checksum==='string';
}
// The native file row has no checksum until successful Storage verification.
type FileMeta={object_key:string;bytes:number;mime:string;checksum:string|null;state?:string;purpose?:string;published?:boolean;max_rows?:number};
function isFileMeta(value:unknown):value is FileMeta{
 return isRecord(value)&&typeof value.object_key==='string'&&typeof value.bytes==='number'&&Number.isSafeInteger(value.bytes)&&
  value.bytes>0&&value.bytes<=2097152&&typeof value.mime==='string'&&(value.checksum===null||typeof value.checksum==='string'&&/^[a-f0-9]{64}$/.test(value.checksum))&&
  (value.state===undefined||typeof value.state==='string')&&
  (value.purpose===undefined||typeof value.purpose==='string')&&
  (value.published===undefined||typeof value.published==='boolean')&&
  (value.max_rows===undefined||typeof value.max_rows==='number'&&Number.isSafeInteger(value.max_rows));
}
function isImportMeta(value:unknown):value is {object_key:string;bytes:number;checksum:string;max_rows:number}{
 return isRecord(value)&&typeof value.object_key==='string'&&typeof value.bytes==='number'&&Number.isSafeInteger(value.bytes)&&
  value.bytes>0&&value.bytes<=2097152&&typeof value.checksum==='string'&&/^[a-f0-9]{64}$/.test(value.checksum)&&
  typeof value.max_rows==='number'&&Number.isSafeInteger(value.max_rows)&&value.max_rows>0&&value.max_rows<=5000;
}
function isImportMapping(value:unknown):value is Parameters<typeof parseImportCsv>[1]{
 return isRecord(value)&&isUnknownArray(value.columns)&&value.columns.every((entry:unknown)=>
  isRecord(entry)&&typeof entry.source_column==='string'&&typeof entry.target==='string')&&
  (value.delimiter===undefined||value.delimiter===','||value.delimiter===';')&&
  (value.kind===undefined||value.kind==='students'||value.kind==='crm_applications');
}
function validResult(value:unknown,operation:string):boolean{
 return isRecord(value)&&(value.ok===true?validate('success',operation,value):validFailure(value));
}
const json=(x:unknown,status=200,noStore=false)=>{const response=new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json",...(noStore?{'cache-control':'private, no-store'}:{})}});noteGatewayError(response,x);return response;};
const failure=(code:string,status=400,unexpected=false)=>{const payload={ok:false,error:{code,retryable:code==="TEMPORARY_FAILURE"||code==="OPERATION_IN_PROGRESS",trace_id:v7()}},response=json(payload,status);if(unexpected)noteGatewayError(response,payload,true);return response;};
const handleRequest=async(req:Request):Promise<Response>=>{
 if(req.method!=="POST")return failure("VALIDATION_FAILED");
 try{
  const operation=new URL(req.url).pathname.split("/").filter(Boolean).at(-1);
  if(operation==='invitation_delivery_tick')return invitationTick(req,n=>Deno.env.get(n));
  
  if(!operation||!implemented.has(operation))return failure("NOT_FOUND",404);
  const body=await req.text();if(body.length>2097152)return failure("VALIDATION_FAILED");
  const request=parseJson(body);
  if(!isRecord(request))return failure('VALIDATION_FAILED');
  if(request.client_api_version!==1)return failure("CLIENT_UPDATE_REQUIRED",426);
  if(!validate('request',operation,request))return failure("VALIDATION_FAILED");
  const authorization=req.headers.get("authorization");
  if(!['account_signup_check_v1','calendar_feed_get_v1','public_calendar_get_v1','public_application_submit_v1'].includes(operation)&&!authorization?.startsWith('Bearer '))return failure('AUTH_REQUIRED',401);
  const base=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!base||!key)return failure("TEMPORARY_FAILURE",503);
  if(operation==='account_signup_check_v1'){
   if(typeof request.request_id!=='string'||typeof request.email!=='string')return failure('VALIDATION_FAILED');
   const signupRequest={client_api_version:1 as const,request_id:request.request_id,email:request.email};
   const result=await accountSignupCheck(req,body,signupRequest,n=>Deno.env.get(n),async(safeRequest,aux)=>{
    const rpc=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:safeRequest,p_actor_auth_id:null,p_session_id:null,p_ids:[v7(),v7()],p_aux:aux}),signal:AbortSignal.timeout(10000)});
    if(!rpc.ok)throw Error('SIGNUP_RPC_UNAVAILABLE');return responseJson(rpc);
   });
   const out='error' in result?{ok:false,error:{code:result.error,retryable:result.error==='TEMPORARY_FAILURE',trace_id:v7()}}:{ok:true,data:result.data,trace_id:v7()};
   if(!validResult(out,operation))return failure('INTEGRITY_VIOLATION',500);
   return json(out,200,true);
  }
  if(operation==='calendar_feed_get_v1'){
   const appTemplate=Deno.env.get('FTK_CALENDAR_SESSION_URL_TEMPLATE');try{calendarAppUrl(appTemplate,'00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000');}catch{return failure('SERVICE_UNAVAILABLE',503);}
   if(typeof request.request_id!=='string'||typeof request.token!=='string')return failure('VALIDATION_FAILED');
   const rpc=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:{client_api_version:1,request_id:request.request_id},p_actor_auth_id:null,p_session_id:null,p_ids:Array.from({length:32},()=>v7()),p_aux:{calendar_token_hash:await calendarTokenHash(request.token)}})});
   if(!rpc.ok)return failure('TEMPORARY_FAILURE',503);const result=requireRecord(await responseJson(rpc));
   if(result.ok===true){
    const data=requireRecord(result.data);
    if(!isUnknownArray(data.items)||!data.items.every(isCalendarItem)||typeof data.as_of!=='string')return failure('INTEGRITY_VIOLATION',500);
    let bytes:Uint8Array;
    try{
     const items=data.items.map(item=>({...item,starts_at:new Date(item.starts_at).toISOString(),ends_at:new Date(item.ends_at).toISOString(),app_url:calendarAppUrl(appTemplate,item.org_id,item.id)}));
     bytes=calendarFeed(items,new Date(data.as_of).toISOString(),2097152);
    }catch{return failure('INTEGRITY_VIOLATION',500);}
    let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.slice(i,i+8192));result.data={ics_base64:btoa(raw)};
   }
   if(!validResult(result,operation))return failure('INTEGRITY_VIOLATION',500);
   return json(result,200,true);
  }
  if(operation==='public_calendar_get_v1'||operation==='public_application_submit_v1'){
   const env=(name:string)=>Deno.env.get(name);
   const rpcPublic=async(aux:unknown)=>{
    const rpc=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:request,p_actor_auth_id:null,p_session_id:null,p_ids:Array.from({length:64},()=>v7()),p_aux:aux})});
    if(!rpc.ok)throw new Error('Public RPC unavailable');return requireRecord(await responseJson(rpc));
   };
   let aux:Record<string,unknown>|null=null;
   if(operation==='public_application_submit_v1'){
    if(!env('FTK_TURNSTILE_SECRET')||!publicBotHostnames(env).length)return failure('SERVICE_UNAVAILABLE',503);
    const ingress=await publicIngress(req,body,env);if(!ingress)return failure('SERVICE_UNAVAILABLE',503);
    if(request.form_id){
     let targets:Record<string,string>;try{targets=crmIntakeTargets(request.contact_intake??request.intake);}catch{return failure('VALIDATION_FAILED');}
     const targetHashes:Record<string,string>={};for(const [kind,value] of Object.entries(targets))targetHashes[kind]=await ingress.targetHash(value);
     aux={phase:'preflight',ip_hash:ingress.ip_hash,target_hash:targetHashes.phone??targetHashes.email,target_hashes:targetHashes};
    }else{
     if(typeof request.contact!=='string')return failure('VALIDATION_FAILED');
     aux={phase:'preflight',ip_hash:ingress.ip_hash,target_hash:await ingress.targetHash(request.contact)};
    }
    const preflight=await rpcPublic(aux);
    if(preflight.ok!==true){
     if(!validFailure(preflight))return failure('INTEGRITY_VIOLATION',500);
     return json(preflight);
    }
    if(isRecord(preflight.data)&&preflight.data.accepted===true){
     if(!validResult(preflight,operation))return failure('INTEGRITY_VIOLATION',500);
     return json(preflight);
    }
    if(!isRecord(preflight.data)||preflight.data.bot_required!==true)return failure('INTEGRITY_VIOLATION',500);
    if(typeof request.bot_proof!=='string'||!await verifyPublicBot(request.bot_proof,ingress.ip,env))return failure('BOT_VERIFICATION_FAILED');
    aux={...aux,phase:'submit',bot_verified:true};
   }
   const result=await rpcPublic(aux);
   if(!validResult(result,operation))return failure('INTEGRITY_VIOLATION',500);
   return json(result,200,true);
  }
  if(!authorization?.startsWith("Bearer "))return failure("AUTH_REQUIRED",401);
  const userResponse=await fetch(base+"/auth/v1/user",{headers:{authorization,apikey:key}});
  if(!userResponse.ok)return failure("AUTH_REQUIRED",401);
  const user=nativeUser(await responseJson(userResponse));
  if(!user)return failure('AUTH_REQUIRED',401);
  const tokenPart=authorization.slice(7).split('.')[1];
  if(!tokenPart)return failure('SESSION_REVOKED',401);
  const claims=sessionClaims(parseJson(atob(tokenPart.replaceAll('-','+').replaceAll('_','/'))));
  if(!claims||claims.sub!==user.id)return failure('SESSION_REVOKED',401);
  // Native Auth owns factor state. Never read user_metadata for assurance.
  if(user.hasVerifiedFactor&&claims.aal!=='aal2'&&!(operation==='account_sessions_revoke_v1'&&request.mode==='current'))return failure('AUTH_REQUIRED',401);
  const authAux={verified_aal:claims.aal==='aal2'?'aal2':'aal1'};
  let calendarCredential:{token:string;hash:string}|undefined;let calendarPublicOrigin:string|undefined;
  if(operation==='calendar_link_create_v1'||operation==='calendar_link_rotate_v1'){
   try{
    const scope=requireRecord(request.organization_scope),orgId=requireString(scope.org_id),operationKey=requireString(request.operation_key);
    calendarPublicOrigin=calendarOrigin(Deno.env.get('FTK_CALENDAR_ORIGIN'));
    calendarAppUrl(Deno.env.get('FTK_CALENDAR_SESSION_URL_TEMPLATE'),orgId,operationKey);
    calendarCredential=await calendarToken(Deno.env.get('FTK_CALENDAR_SIGNING_KEY'),user.id,orgId,operation,operationKey);
   }catch{return failure('SERVICE_UNAVAILABLE',503);}
  }
  let imageAux:Record<string,unknown>={};
  const image=operation==='account_profile_update_v1'?request.photo:operation==='settings_update_v1'?request.logo_image:undefined;
  if(image!==undefined&&image!==null){if(!isImage(image))return failure('VALIDATION_FAILED');try{imageAux=await verifySettingsImage(image);}catch{return failure('VALIDATION_FAILED');}}
  // Authenticated input never controls internal IDs or actor context.
  const readOnly=operation.endsWith("_get_v1")||operation.endsWith("_list_v1")||operation.endsWith("_preview_v1");
  const bulk=["role_revoke_v1","event_attendance_close_v1","event_cancel_apply_v1","sale_apply_v1","program_preview_v1","program_apply_v1","session_change_preview_v1","session_change_apply_v1","class_assignment_set_v1","attendance_close_v1","attendance_correct_apply_v1","reservation_impact_apply_v1","negative_limit_set_v1","policy_publish_v1"].includes(operation);
  const terms=isRecord(request.terms)?request.terms:null;
  const count=(bulk?4096:readOnly?32:512)+2*arrayLength(request.discipline_ids)+3*arrayLength(request.assignments)+2*arrayLength(request.contacts)+2*arrayLength(terms?.scopes)+arrayLength(request.requirements);
  
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
  if(operation==='account_delete_apply_v1'||operation==='organization_delete_apply_v1'||(operation==='account_sessions_revoke_v1'&&request.mode==='others')||(operation==='job_status_get_v1'&&request.org_id===null)){
   const proof=await lifecycleReauth(base,key,(operation==='job_status_get_v1'?authorization.slice(7):requireString(request.reauth)),user.id);
   if(proof.error)return failure(proof.error,proof.error==='AUTH_REQUIRED'?401:503);
   if(!proof.context)return failure('TEMPORARY_FAILURE',503);
   invite=proof.context;
  }
  const storage=documentStorage(base,key);
  const imports=importStorage(base,key);
  if(operation==='file_upload_complete_v1'){
   const contextResponse=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:request,p_actor_auth_id:user.id,p_session_id:claims.session_id,p_ids:Array.from({length:count},()=>v7()),p_aux:{...authAux,phase:'storage_context'}})});
   if(!contextResponse.ok)return failure('TEMPORARY_FAILURE',503);const context=requireRecord(await responseJson(contextResponse));
   if(!context._internal_storage){
    if(!validResult(context,operation))return failure('INTEGRITY_VIOLATION',500);
    return json(context);
   }
   const meta=context._internal_storage;
   if(!isFileMeta(meta))return failure('INTEGRITY_VIOLATION',500);
   if(meta.state==='ready'){
    if(meta.checksum===null)return failure('INTEGRITY_VIOLATION',500);
    invite={storage_verified:true,object_key:meta.object_key,bytes:meta.bytes,mime:meta.mime,checksum:meta.checksum};
   }else if(meta.state==='pending_upload'){
    try{
     if(meta.purpose==='import'){
      if(meta.checksum===null)return failure('INTEGRITY_VIOLATION',500);
      await imports.read({...meta,checksum:meta.checksum});
      invite={storage_verified:true,object_key:meta.object_key,bytes:meta.bytes,mime:meta.mime,checksum:meta.checksum};
     }else{
      const file=await storage.download(meta.object_key,{bytes:meta.bytes,mime:meta.mime});
      invite={storage_verified:true,object_key:meta.object_key,bytes:file.size,mime:file.mime,checksum:file.checksum};
     }
    }catch{return failure('VALIDATION_FAILED');}
   }else return failure('INTEGRITY_VIOLATION',500);
  }
  const rpcContext=async(aux:unknown)=>{
   const r=await fetch(base+'/rest/v1/rpc/'+operation,{method:'POST',headers:{authorization:'Bearer '+key,apikey:key,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:request,p_actor_auth_id:user.id,p_session_id:claims.session_id,p_ids:Array.from({length:count},()=>v7()),p_aux:{...(isRecord(aux)?aux:{}),...authAux}})});
   if(!r.ok)throw Error('RPC_UNAVAILABLE');return requireRecord(await responseJson(r));
  };
  if(operation==='import_preview_v1'){
   const context=await rpcContext({phase:'p06_import_file'});
   if(!context._internal_import){
    if(!validResult(context,operation))return failure('INTEGRITY_VIOLATION',500);
    return json(context);
   }
   const meta=context._internal_import;
   if(!isImportMeta(meta)||!isImportMapping(request.mapping))return failure('INTEGRITY_VIOLATION',500);
   try{const text=await imports.read(meta);const rows=parseImportCsv(text,request.mapping,meta.max_rows);invite={import_verified:true,checksum:meta.checksum,rows};}
   catch{return failure('VALIDATION_FAILED');}
  }
  const download=new URL(req.url).searchParams.get('download');
  if(operation==='platform_invoice_publish_v1'||(operation==='organization_invoice_file_get_v1'&&download==='original')){
   const publishing=operation==='platform_invoice_publish_v1';
   const context=await rpcContext({phase:publishing?'invoice_upload_context':'invoice_download'});
   if(!context._internal_invoice){
    if(!validResult(context,operation))return failure('INTEGRITY_VIOLATION',500);
    const code=isRecord(context.error)?context.error.code:undefined;
    return json(context,publishing?200:code==='NOT_FOUND'?404:code==='AUTH_REQUIRED'||code==='SESSION_REVOKED'?401:403,true);
   }
   const invoiceMeta=context._internal_invoice;
   if(!isFileMeta(invoiceMeta)||invoiceMeta.checksum===null||typeof invoiceMeta.published!=='boolean')return failure('INTEGRITY_VIOLATION',500);
   const object_key=invoiceMeta.object_key,meta={bytes:invoiceMeta.bytes,mime:invoiceMeta.mime,checksum:invoiceMeta.checksum,published:invoiceMeta.published};
   const invoices=documentStorage(base,key,fetch,'ftksaas-invoices');
   if(publishing){
    if(!meta.published){
     try{await invoices.download(object_key,meta);}catch{return failure('VALIDATION_FAILED');}
    }
    invite={invoice_verified:true,checksum:meta.checksum};
   }else{
    const file=await invoices.download(object_key,meta);
    const extension=file.mime==='application/zip'?'zip':'pdf';
    return new Response(file.bytes,{headers:{
     'content-type':file.mime,'content-disposition':'attachment; filename="invoice-'+requireString(request.invoice_id)+'.'+extension+'"',
     'cache-control':'private, no-store','x-content-type-options':'nosniff','access-control-expose-headers':'Content-Disposition'
    }});
   }
  }
  const importDownload=operation==='import_rows_list_v1'&&download==='skipped_csv';
  if(importDownload||(operation==='report_file_get_v1'&&download==='csv')){
   const context=await rpcContext({phase:importDownload?'p06_import_skipped_download':'p06_download'});
   if(!context._internal_download){
    if(!validResult(context,operation))return failure('INTEGRITY_VIOLATION',500);
    if(!importDownload)return json(context);
    const code=isRecord(context.error)?context.error.code:undefined;
    return json(context,code==='NOT_FOUND'?404:code==='AUTH_REQUIRED'||code==='SESSION_REVOKED'?401:403,true);
   }
   const file=context._internal_download,filename=importDownload?/^import-skipped-[a-f0-9-]{36}\.csv$/:/^report-[a-f0-9-]{36}\.csv$/;
   if(!isRecord(file)||typeof file.body!=='string'||file.body.length>24*1024*1024||typeof file.filename!=='string'||!filename.test(file.filename))return failure('INTEGRITY_VIOLATION',500);
   const bytes=Uint8Array.from(atob(file.body),x=>x.charCodeAt(0));
   return new Response(bytes,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="'+file.filename+'"','cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':'*'}});
  }
  let requiredCount=count;
  for(let attempt=0;attempt<4;attempt++){
  const ids=Array.from({length:Math.max(count*2**attempt,requiredCount)},()=>v7());
  const rpc=await fetch(base+"/rest/v1/rpc/"+operation,{method:"POST",headers:{authorization:"Bearer "+key,apikey:key,"content-type":"application/json","Content-Profile":"api_v1"},
   body:JSON.stringify({p_request:request,p_actor_auth_id:user.id,p_session_id:claims.session_id,p_ids:ids,p_aux:{...(invite??{}),...authAux,...imageAux,...(calendarCredential?{calendar_token_hash:calendarCredential.hash}:{})}})});
  if(!rpc.ok)return failure("TEMPORARY_FAILURE",503);
  const result=requireRecord(await responseJson(rpc));if(result._internal_retry==="uuid_bank_exhausted"){
   // Trusted RPC preflight derives size from the stored immutable selection.
   const n=result.required_uuid_count;
   if(n!==undefined){if(typeof n!=='number'||!Number.isSafeInteger(n)||n<1||n>2*Math.ceil(2097152/36)+64)return failure("INTEGRITY_VIOLATION",500);requiredCount=Math.max(requiredCount,n);}
   continue;
  }if(result.ok===true){
   const data=isRecord(result.data)?result.data:null;
   if(operation==='import_upload_prepare_v1'){
    if(!data)return failure('INTEGRITY_VIOLATION',500);
    if(Date.parse(requireString(data.expires_at))<=Date.now())return failure('VALIDATION_FAILED');
    data.upload_url=await imports.upload(requireString(data.upload_url));
   }
   if(operation==='platform_invoice_upload_prepare_v1'){
    if(!data)return failure('INTEGRITY_VIOLATION',500);
    const invoices=documentStorage(base,key,fetch,'ftksaas-invoices'),objectKey=requireString(data.upload_url);
    try{data.upload_url=await invoices.upload(objectKey);}
    catch(error){
     try{await invoices.download(objectKey,{bytes:requireInteger(request.bytes),mime:requireString(request.mime),checksum:requireString(request.checksum)});}
     catch{throw error;}
     data.upload_url=null;
    }
   }
   if(operation==='document_upload_prepare_v1'){
    if(!data)return failure('INTEGRITY_VIOLATION',500);
    if(Date.parse(requireString(data.expires_at))<=Date.now())return failure('VALIDATION_FAILED');
    data.upload_url=await storage.upload(requireString(data.upload_url));
   }
   if(operation==='document_requirements_get_v1'&&request.content_file_id){
    if(!isUnknownArray(result.data))return failure('INTEGRITY_VIOLATION',500);
    const item=result.data.find((x:unknown)=>isRecord(x)&&isRecord(x.file)&&x.file.id===request.content_file_id);
    if(item===undefined)return failure('NOT_FOUND',404);
    if(!isRecord(item)||!isRecord(item.file))return failure('INTEGRITY_VIOLATION',500);
    if(!item.digital_content){
     const file=await storage.download(requireString(request.org_id)+'/'+requireString(item.file.id));
     if(file.checksum!==item.content_hash)return failure('INTEGRITY_VIOLATION',500);
     let raw='';for(let i=0;i<file.bytes.length;i+=8192)raw+=String.fromCharCode(...file.bytes.slice(i,i+8192));
     item.content={mime:file.mime,encoding:'base64',data:btoa(raw)};
    }
   }
   if(operation==='calendar_links_get_v1'){
    if(!data)return failure('INTEGRITY_VIOLATION',500);
    let ready=false;try{calendarOrigin(Deno.env.get('FTK_CALENDAR_ORIGIN'));calendarAppUrl(Deno.env.get('FTK_CALENDAR_SESSION_URL_TEMPLATE'),'00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000');ready=/^[a-f0-9]{64}$/.test(Deno.env.get('FTK_CALENDAR_SIGNING_KEY')??'');}catch{ready=false;}
    data.service_ready=ready;data.supported_kinds=['lessons','duties'];
   }
   if(calendarCredential&&calendarPublicOrigin){
    if(!data)return failure('INTEGRITY_VIOLATION',500);
    data.subscription_url=calendarSubscriptionUrl(calendarPublicOrigin,calendarCredential.token);
   }
  }
  if(!validResult(result,operation))return failure("INTEGRITY_VIOLATION",500);
  return json(result,200,operation.includes('_invoice')||operation==='audit_center_export_v1'||operation==='media_get_v1'||operation.startsWith('calendar_'));
  }
  return failure("TEMPORARY_FAILURE",503);
 }catch{return failure("TEMPORARY_FAILURE",503,true);}
};
Deno.serve(async req=>{
 const cors=browserCors(req,{FTK_BROWSER_ORIGINS:Deno.env.get('FTK_BROWSER_ORIGINS')});
 if(cors.response)return cors.response;
 const response=await handleRequest(req),operation=new URL(req.url).pathname.split('/').filter(Boolean).at(-1);
 await reportGatewayError(response,operation&&implemented.has(operation)?operation:undefined,name=>Deno.env.get(name));
 return applyBrowserCors(response,cors.headers);
});
