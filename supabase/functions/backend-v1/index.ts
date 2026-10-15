import implementation from "./implemented.json" with {type:"json"};
import { v7 } from "npm:uuid@14.0.3";
import Ajv from "npm:ajv@8.20.0/dist/2020.js";
import addFormats from "npm:ajv-formats@3.0.1";
import contract from "../../../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json" with {type:"json"};
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);ajv.addSchema(contract,"contract");
const ops=new Map(contract["x-contract"].operations.map((o:any)=>[o.name,o]));
const implemented=new Set(implementation.operations);
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","access-control-allow-origin":"*"}});
const failure=(code:string,status=400)=>json({ok:false,error:{code,retryable:false,trace_id:v7()}},status);
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("",{headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type","access-control-allow-methods":"POST,OPTIONS"}});
 if(req.method!=="POST")return failure("VALIDATION_FAILED");
 try{
  const operation=new URL(req.url).pathname.split("/").filter(Boolean).at(-1)!;
  const op:any=ops.get(operation);
  if(!op||!implemented.has(operation))return failure("NOT_FOUND",404);
  const body=await req.text();if(body.length>2097152)return failure("VALIDATION_FAILED");
  const request=JSON.parse(body);const validate=ajv.getSchema("contract"+op.request.$ref);
  if(!validate?.(request))return failure("VALIDATION_FAILED");
  const base=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization=req.headers.get("authorization");if(!authorization?.startsWith("Bearer "))return failure("AUTH_REQUIRED",401);
  const userResponse=await fetch(base+"/auth/v1/user",{headers:{authorization,apikey:key}});
  if(!userResponse.ok)return failure("AUTH_REQUIRED",401);
  const user=await userResponse.json();
  const part=authorization.slice(7).split(".")[1].replaceAll("-","+").replaceAll("_","/");
  const claims=JSON.parse(atob(part));if(claims.sub!==user.id||!claims.session_id)return failure("SESSION_REVOKED",401);
  // Authenticated input never controls internal IDs or actor context.
  const count=4096+2*(request.discipline_ids?.length??0)+3*(request.assignments?.length??0)+2*(request.contacts?.length??0)+2*(request.terms?.scopes?.length??0);
  const ids=Array.from({length:count},()=>v7());
  let invite:null|Record<string,string>=null;
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
  const rpc=await fetch(base+"/rest/v1/rpc/"+operation,{method:"POST",headers:{authorization:"Bearer "+key,apikey:key,"content-type":"application/json","Content-Profile":"api_v1"},
   body:JSON.stringify({p_request:request,p_actor_auth_id:user.id,p_session_id:claims.session_id,p_ids:ids,p_aux:invite})});
  if(!rpc.ok)return failure("TEMPORARY_FAILURE",503);
  const result=await rpc.json();if(result.ok){const success=ajv.getSchema("contract"+op.success.$ref);if(!success?.(result))return failure("INTEGRITY_VIOLATION",500);}
  return json(result);
 }catch{return failure("TEMPORARY_FAILURE",503);}
});
