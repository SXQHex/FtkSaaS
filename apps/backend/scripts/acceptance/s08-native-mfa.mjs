import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {newUuidV7 as key} from '../uuid.mjs';

function totp(secret){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
 for(const character of secret.replace(/=+$/,''))bits+=alphabet.indexOf(character).toString(2).padStart(5,'0');
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const hash=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=hash.at(-1)&15;
 return ((hash.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}

// Opt-in, development-only. No pre-existing verified factor is changed. All
// credentials, TOTP secrets and bearer tokens remain in process memory.
export async function acceptNativeMfa(input){
 const base='https://gwyprhenabtpkbojephw.supabase.co';
 let token,strong,phase='login',failure;const factors=[],checks=[];
 const native=async(path,method='GET',body,accessToken=token)=>{
  const response=await fetch(base+'/auth/v1'+path,{method,headers:{apikey:input.apikey,'content-type':'application/json',...(accessToken?{authorization:'Bearer '+accessToken}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const data=await response.json().catch(()=>null);return {ok:response.ok,status:response.status,data};
 };
 const login=async()=>{
  const result=await native('/token?grant_type=password','POST',{email:input.email,password:input.password},null);
  assert(result.ok);return result.data.access_token;
 };
 const backend=async accessToken=>{
  const response=await fetch(base+'/functions/v1/backend-v1/account_get_v1',{method:'POST',headers:{apikey:input.apikey,authorization:'Bearer '+accessToken,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key()}),signal:AbortSignal.timeout(30000)});
  return response.json();
 };
 const prove=async(factor,accessToken)=>{
  const challenge=await native('/factors/'+factor.id+'/challenge','POST',{},accessToken);assert(challenge.ok);
  const proof=await native('/factors/'+factor.id+'/verify','POST',{challenge_id:challenge.data.id,code:totp(factor.secret)},accessToken);assert(proof.ok);
  factor.counter=Math.floor(Date.now()/30000);return proof.data.access_token;
 };
 try{
  token=await login();strong=token;
  const account=await native('/user');assert(account.ok);
  assert(!(account.data.factors??[]).some(factor=>factor.status==='verified'));
  assert((await backend(token)).ok);
  for(const label of ['primary','backup']){
   phase=label+' enrollment';
   const enrolled=await native('/factors','POST',{factor_type:'totp',friendly_name:'Backend acceptance '+label+' '+key(),issuer:'FtkSaaS'},strong);assert(enrolled.ok);
   const factor={id:enrolled.data.id,secret:enrolled.data.totp.secret};factors.push(factor);
   strong=await prove(factor,strong);checks.push(label+' native factor verified');
  }
  phase='weak token denial';const weak=await login(),denied=await backend(weak);
  assert.equal(denied.ok,false);assert.equal(denied.error.code,'AUTH_REQUIRED');
  checks.push('fresh password-only session denied by backend MFA gate');
  phase='primary device removal';
  assert((await native('/factors/'+factors[0].id,'DELETE',undefined,strong)).ok);factors.shift();
  checks.push('primary factor removed with native AAL2');
  phase='backup device proof';const backup=factors[0];
  if(Math.floor(Date.now()/30000)===backup.counter)await new Promise(resolve=>setTimeout(resolve,31000-Date.now()%30000));
  strong=await prove(backup,weak);
  assert.equal(JSON.parse(Buffer.from(strong.split('.')[1],'base64url')).aal,'aal2');assert((await backend(strong)).ok);
  checks.push('independent backup restores native AAL2 access after primary loss');
 }catch{
  failure='Hosted MFA acceptance failed at '+phase;
 }finally{
  let cleanupFailed=false;
  for(const factor of factors.reverse()){
   try{if(!(await native('/factors/'+factor.id,'DELETE',undefined,strong)).ok)cleanupFailed=true;}
   catch{cleanupFailed=true;}
  }
  for(const accessToken of new Set([strong,token].filter(Boolean))){
   try{
    const logout=await native('/logout?scope=local','POST',undefined,accessToken);
    if(!logout.ok&&logout.status!==401)cleanupFailed=true;
    const result=await backend(accessToken);
    if(result.ok||!['AUTH_REQUIRED','SESSION_REVOKED'].includes(result.error?.code))cleanupFailed=true;
   }catch{cleanupFailed=true;}
  }
  if(failure||cleanupFailed)throw Error(failure??'Hosted MFA cleanup requires inspection');
 }
 return {status:'passed',cleanup:'complete',checks};
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{console.log(JSON.stringify(await acceptNativeMfa({email:process.env.FTK_ACCEPTANCE_EMAIL,password:process.env.FTK_ACCEPTANCE_PASSWORD,apikey:process.env.FTK_ACCEPTANCE_APIKEY})));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
