import {authDeliveryEnabled} from './account-auth.ts';
import {publicIngress,type PublicEnv} from './public-ingress.ts';

type Signup={client_api_version:1;request_id:string;email:string;password:string;code_challenge?:string;code_challenge_method?:'s256';email_redirect_to?:string;captcha_token?:string};
type Rpc=(safeRequest:Record<string,unknown>,aux:Record<string,unknown>)=>Promise<any>;
const error=(code:string)=>({error:code});

// Password, CAPTCHA and PKCE material go only to native Auth, never to SQL,
// operation receipts, audit or logs. The RPC sees an explicit safe DTO.
export async function accountSignup(req:Request,body:string,request:Signup,base:string,anonKey:string|undefined,env:PublicEnv,rpc:Rpc,fetcher:typeof fetch=fetch){
 if(!anonKey||!authDeliveryEnabled(base,env))return error('TEMPORARY_FAILURE');
 const email=request.email.trim().toLowerCase();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return error('VALIDATION_FAILED');
 const ingress=await publicIngress(req,body,env);if(!ingress)return error('TEMPORARY_FAILURE');
 const safeRequest={client_api_version:1,request_id:request.request_id,email};
 const aux={ip_hash:ingress.ip_hash,target_hash:await ingress.targetHash(email)};
 // Check before claiming: this endpoint deliberately supports confirmation-based
 // email signup only. A changed Auth configuration must not silently sign in.
 let settings;
 try{const res=await fetcher(base+'/auth/v1/settings',{headers:{apikey:anonKey},signal:AbortSignal.timeout(10000),redirect:'error'});if(!res.ok)return error('TEMPORARY_FAILURE');settings=await res.json();}catch{return error('TEMPORARY_FAILURE');}
 if(settings.disable_signup!==false||settings.mailer_autoconfirm!==false||settings.external?.email!==true)return error('SERVICE_UNAVAILABLE');
 const claim=await rpc(safeRequest,{...aux,phase:'dispatch'});
 if(claim.error||claim.data)return claim;
 if(!claim._internal_signup_dispatch||typeof claim.attempt_id!=='string')return error('TEMPORARY_FAILURE');
 const owned={...aux,attempt_id:claim.attempt_id};
 const url=new URL(base+'/auth/v1/signup');if(request.email_redirect_to)url.searchParams.set('redirect_to',request.email_redirect_to);
 const payload={email,password:request.password,...(request.code_challenge?{code_challenge:request.code_challenge,code_challenge_method:request.code_challenge_method}:{}),...(request.captcha_token?{gotrue_meta_security:{captcha_token:request.captcha_token}}:{})};
 let res:Response,provider:any;
 try{
  // The durable dispatch claim is committed before this request. Timeout/crash
  // never releases it: aborting fetch does not prove Auth stopped processing.
  res=await fetcher(url.toString(),{method:'POST',headers:{apikey:anonKey,'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000),redirect:'error'});
  provider=await res.json();
 }catch{return error('RESULT_NOT_CONFIRMED');}
 if(!res.ok){
  const code=provider?.error_code??provider?.code;
  // Native password validation and CAPTCHA middleware precede signup writes.
  // Other provider failures, including generic 429, may have an unknown effect.
  if((res.status===422&&code==='weak_password')||([400,422].includes(res.status)&&code==='captcha_failed')){
   try{const released=await rpc(safeRequest,{...owned,phase:'reject',rejection:code});if(released._internal_signup_released!==true)return error('RESULT_NOT_CONFIRMED');}catch{return error('RESULT_NOT_CONFIRMED');}
   return error(code==='weak_password'?'WEAK_PASSWORD':'BOT_VERIFICATION_FAILED');
  }
  if(code==='user_already_exists'||code==='email_exists')return {data:{status:'account_exists'}};
  return error('RESULT_NOT_CONFIRMED');
 }
 if(provider?.access_token||provider?.session||typeof provider?.id!=='string'||!Array.isArray(provider.identities))return error('RESULT_NOT_CONFIRMED');
 if(provider.identities.length===0)return {data:{status:'account_exists'}};
 try{return await rpc(safeRequest,{...owned,phase:'complete',auth_user_id:provider.id});}catch{return error('RESULT_NOT_CONFIRMED');}
}
