import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {newUuidV7 as key} from '../uuid.mjs';
const origin='https://gwyprhenabtpkbojephw.supabase.co';

// The operator supplies this pin independently of the delivered link/provider response.
// No implicit production, historical or loopback callback default is accepted.
function callbackPin(value){
 try{
  assert(value&&typeof value==='object'&&!Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(),['next','origin','path']);
  const url=new URL(value.origin);
  assert(url.origin===value.origin&&!url.username&&!url.password);
  assert(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  const localPath=path=>{
   assert(typeof path==='string'&&path.startsWith('/')&&!path.startsWith('//')&&!path.includes('\\'));
   const parsed=new URL(path,url.origin);assert(parsed.origin===url.origin&&parsed.pathname===path&&!parsed.search&&!parsed.hash);
  };
  localPath(value.path);if(value.next!==null)localPath(value.next);
  return Object.freeze({origin:url.origin,path:value.path,next:value.next});
 }catch{throw Error('Explicit valid recovery callback pin required; provider and credential data withheld');}
}
function verifyLink(link){
 try{
  const url=new URL(link);
  assert(url.origin===origin&&url.pathname==='/auth/v1/verify'&&!url.username&&!url.password&&!url.hash);
  assert.deepEqual(url.searchParams.getAll('type'),['recovery']);return url;
 }catch{throw Error('Invalid native recovery verify link; provider and credential data withheld');}
}
function callbackLocation(response,pin){
 const location=new URL(response.headers.get('location'));
 assert(location.origin===pin.origin&&location.pathname===pin.path&&!location.username&&!location.password);
 assert.deepEqual(location.searchParams.getAll('next'),pin.next===null?[]:[pin.next]);
 const hash=new URLSearchParams(location.hash.slice(1));
 const secrets=new Set(['access_token','refresh_token','id_token','token','token_hash','code_verifier','verifier','provider_token','provider_refresh_token']);
 for(const params of [location.searchParams,hash])for(const name of params.keys())assert(!secrets.has(name.toLowerCase()));
 assert(!hash.has('code')&&!hash.has('next'));return location;
}

export async function acceptExpiredRecovery({link,issuedAt,callback,request=fetch}){
 const pin=callbackPin(callback),url=verifyLink(link),age=Date.now()-Date.parse(issuedAt);
 assert(Number.isFinite(age)&&age>3600000,'Natural recovery proof lifetime has not elapsed');
 try{
  const response=await request(url.href,{redirect:'manual',signal:AbortSignal.timeout(30000)});assert([302,303].includes(response.status));
  const location=callbackLocation(response,pin),hash=new URLSearchParams(location.hash.slice(1));
  assert.deepEqual([...location.searchParams.getAll('error_code'),...hash.getAll('error_code')],['otp_expired']);
  assert(!location.searchParams.has('code'));
 }catch{throw Error('Hosted recovery expiry callback rejected; provider and credential data withheld');}
 return {status:'passed',callback:pin,proof_age_seconds:Math.floor(age/1000),code:'otp_expired'};
}

// A real delivered PKCE link and its originating private verifier are required.
// This runner never creates a provider proof or changes a clock/TTL/Auth row.
export async function acceptNativeRecovery({email,password,apikey,link,verifier,callback,request=fetch}){
 const pin=callbackPin(callback),url=verifyLink(link);
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
  return callbackLocation(r,pin);
 };
 try{
  other=await login(password);
  phase='verification callback';const location=await follow(),code=location.searchParams.get('code');assert(code&&location.searchParams.getAll('code').length===1&&!location.searchParams.has('error')&&!location.searchParams.has('error_code'));assert.equal(location.hash,'');
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
 return {status:'passed',callback:pin,cleanup:'complete',checks};
}

// Private JSON arrives over stdin, never as credentials/proofs in argv. This
// command consumes existing delivered proofs; it never requests or manufactures one.
export async function runRecoveryAcceptance(mode,input){
 assert(input&&typeof input==='object'&&!Array.isArray(input),'Private recovery acceptance input required');
 if(mode==='native')return acceptNativeRecovery(input);
 if(mode==='expired')return acceptExpiredRecovery(input);
 throw Error('Recovery acceptance mode must be native or expired');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  assert(process.argv.length===3&&['native','expired'].includes(process.argv[2]));
  const text=readFileSync(0,'utf8');assert(Buffer.byteLength(text)<=65536);
  const result=await runRecoveryAcceptance(process.argv[2],JSON.parse(text));
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch(error){
  const message=error.message==='Hosted recovery cleanup requires inspection; provider and credential data withheld'?error.message:'Recovery acceptance failed; inspect authorized private input and cleanup; provider and credential data withheld';
  process.stderr.write(message+'\n');
  process.exitCode=1;
 }
}
