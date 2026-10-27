import {publicIngress,verifyPublicBot,type PublicEnv} from './public-ingress.ts';
type Rpc=(aux:unknown)=>Promise<any>;
export function authDeliveryEnabled(base:string,env:PublicEnv){
 // Only the isolated local Auth SMTP sink is automatic. Hosted external delivery
 // remains explicitly disabled by default; do not infer consent from an API key.
 const u=new URL(base);return (u.protocol==='http:'&&['kong','127.0.0.1','localhost','host.docker.internal'].includes(u.hostname))||env('FTK_P07_AUTH_DELIVERY_ENABLED')==='true';
}
export async function passwordChallenge(base:string,key:string,authorization:string,env:PublicEnv,rpc:Rpc,fetcher:typeof fetch=fetch){
 const checked=await rpc(null);if(!checked._internal_auth_ready)return checked;
 if(!authDeliveryEnabled(base,env))return {error:'TEMPORARY_FAILURE'};
 const res=await fetcher(base+'/auth/v1/reauthenticate',{method:'GET',headers:{authorization,apikey:key},signal:AbortSignal.timeout(10000)});
 if(!res.ok)return {error:res.status===401?'AUTH_REQUIRED':res.status===429?'TEMPORARY_FAILURE':'TEMPORARY_FAILURE'};
 return {data:{provider:'supabase_auth',status:'challenge_required'}};
}
export async function passwordRecovery(req:Request,body:string,request:any,base:string,key:string,env:PublicEnv,rpc:Rpc,fetcher:typeof fetch=fetch){
 if(!authDeliveryEnabled(base,env))return {error:'TEMPORARY_FAILURE'};
 const email=request.email.trim().toLowerCase();if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return {error:'VALIDATION_FAILED'};
 const ingress=await publicIngress(req,body,env);if(!ingress)return {error:'TEMPORARY_FAILURE'};
 const proof=req.headers.get('x-ftk-bot-proof');
 if(!proof||!await verifyPublicBot(proof,ingress.ip,env,fetcher,'password_recovery'))return {error:'VALIDATION_FAILED'};
 const rate=await rpc({ip_hash:ingress.ip_hash,target_hash:await ingress.targetHash(email),bot_verified:true});if(!rate._internal_recovery_ready)return rate;
 // Never query account existence. The provider keeps existing/unknown addresses
 // indistinguishable; a provider outage is never reported as accepted delivery.
 const res=await fetcher(base+'/auth/v1/recover',{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify({email}),signal:AbortSignal.timeout(10000)});
 if(!res.ok)return {error:res.status===429?'RATE_LIMITED':'TEMPORARY_FAILURE'};
 return {data:{accepted:true}};
}
