import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {newUuidV7 as key} from '../uuid.mjs';
const origin='https://gwyprhenabtpkbojephw.supabase.co';

export async function acceptExpiredRecovery({link,issuedAt,request=fetch}){
 const url=new URL(link),age=Date.now()-Date.parse(issuedAt);
 assert.equal(url.origin,origin);assert.equal(url.pathname,'/auth/v1/verify');assert.equal(url.searchParams.get('type'),'recovery');
 assert(Number.isFinite(age)&&age>3600000,'Natural recovery proof lifetime has not elapsed');
 const response=await request(url.href,{redirect:'manual',signal:AbortSignal.timeout(30000)});assert([302,303].includes(response.status));
 const location=new URL(response.headers.get('location'));assert.equal(location.origin,'https://uye.fethiyetango.com');
 const hash=new URLSearchParams(location.hash.slice(1));assert.equal(location.searchParams.get('error_code')??hash.get('error_code'),'otp_expired');
 assert.equal(location.searchParams.has('code'),false);
 return {status:'passed',proof_age_seconds:Math.floor(age/1000),code:'otp_expired'};
}

// A real delivered PKCE link and its originating private verifier are required.
// This runner never creates a provider proof or changes a clock/TTL/Auth row.
export async function acceptNativeRecovery({email,password,apikey,link,verifier,request=fetch}){
 const url=new URL(link);assert.equal(url.origin,origin);assert.equal(url.pathname,'/auth/v1/verify');assert.equal(url.searchParams.get('type'),'recovery');
 assert(url.searchParams.get('token')?.startsWith('pkce_'));assert(verifier&&email&&password&&apikey);
 let current,other,verified,restoration,changed=false,uncertain=false,phase='login',failure;const checks=[];
 const temporary='Recovery!'+randomBytes(30).toString('base64url');
 const native=async(path,body,token,method='POST')=>{
  const r=await request(origin+'/auth/v1'+path,{method,headers:{apikey,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  return {status:r.status,data:await r.json().catch(()=>null)};
 };
 const login=async value=>{const r=await native('/token?grant_type=password',{email,password:value});assert.equal(r.status,200);return r.data.access_token;};
 const backend=async token=>{const r=await request(origin+'/functions/v1/backend-v1/account_get_v1',{method:'POST',headers:{apikey,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key()}),signal:AbortSignal.timeout(30000)});return r.json();};
 const follow=async()=>{
  const r=await request(url.href,{redirect:'manual',signal:AbortSignal.timeout(30000)});assert([302,303].includes(r.status));
  const location=new URL(r.headers.get('location'));assert.equal(location.origin,'https://uye.fethiyetango.com');assert.equal(location.pathname,'/auth/callback');assert.equal(location.searchParams.get('next'),'/reset-password');return location;
 };
 try{
  other=await login(password);
  phase='verification callback';const location=await follow(),code=location.searchParams.get('code');assert(code);assert.equal(location.hash,'');
  checks.push('real delivered recovery link redirects only an auth code to the allowed callback');
  phase='wrong verifier';const wrong=await native('/token?grant_type=pkce',{auth_code:code,code_verifier:randomBytes(48).toString('base64url')});assert.notEqual(wrong.status,200);assert.equal(wrong.data?.error_code,'bad_code_verifier');
  phase='PKCE exchange';const exchange=await native('/token?grant_type=pkce',{auth_code:code,code_verifier:verifier});assert.equal(exchange.status,200);current=exchange.data.access_token;
  const identity=await native('/user',null,current,'GET');assert.equal(identity.status,200);assert.equal(identity.data.email,email);
  checks.push('incorrect verifier rejected; matching private verifier opens the actual recovery session');
  phase='recovery password';uncertain=true;
  const updated=await native('/user',{password:temporary},current,'PUT');uncertain=false;assert.equal(updated.status,200);changed=true;
  assert.equal((await backend(current)).ok,true);const denied=await backend(other);assert.equal(denied.ok,false);assert(['AUTH_REQUIRED','SESSION_REVOKED'].includes(denied.error?.code));
  checks.push('native recovery preserves its current session and rejects the previous session at Edge');
  phase='used proofs';const reused=await native('/token?grant_type=pkce',{auth_code:code,code_verifier:verifier});assert.notEqual(reused.status,200);
  const used=await follow();assert.equal(used.searchParams.has('code'),false);assert(used.searchParams.has('error')||used.hash.includes('error='));
  checks.push('consumed recovery link and auth code cannot open another session');
 }catch{failure='Hosted recovery acceptance failed at '+phase+'; provider and credential data withheld';}
 finally{
  let cleanupFailed=false;
  if(changed||uncertain)try{
   restoration=await login(temporary);
   const restored=await native('/user',{password,current_password:temporary},restoration,'PUT');assert.equal(restored.status,200);changed=false;
   verified=await login(password);checks.push('original password restored and independently verified');
  }catch{cleanupFailed=true;}
  for(const token of new Set([current,other,restoration,verified].filter(Boolean)))try{const r=await native('/logout?scope=local',null,token);assert([200,204,401,403].includes(r.status));}catch{cleanupFailed=true;}
  if(cleanupFailed)throw Error('Hosted recovery cleanup requires inspection; provider and credential data withheld');
 }
 if(failure)throw Error(failure);
 return {status:'passed',cleanup:'complete',checks};
}
