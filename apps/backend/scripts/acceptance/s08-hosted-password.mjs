import assert from 'node:assert/strict';
import {randomBytes,randomInt} from 'node:crypto';
import {newUuidV7 as key} from '../uuid.mjs';

const origin='https://gwyprhenabtpkbojephw.supabase.co';
// The aged session must be an actual previously opened test session. Its age is
// read through the native actor's backend session projection, never injected.
export async function acceptAgedPassword({apikey,email,password,accessToken,nonce,expiredNonce,expiredNonceOnly=false,request=fetch}){
 let current=accessToken,fresh,changed=false,uncertain=false,mutated=false,phase='session read';const checks=[],candidates=[],opened=new Set();
 const temporary='Acceptance!'+randomBytes(30).toString('base64url');
 const native=async(path,method,body,token=current)=>{
  const response=await request(origin+'/auth/v1'+path,{method,headers:{apikey,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  return {status:response.status,data:await response.json().catch(()=>null)};
 };
 const backend=async(op,token=current)=>{
  const response=await request(origin+'/functions/v1/backend-v1/'+op,{method:'POST',headers:{apikey,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key()}),signal:AbortSignal.timeout(30000)});
  return response.json();
 };
 const login=async value=>{const r=await native('/token?grant_type=password','POST',{email,password:value},null);assert.equal(r.status,200);opened.add(r.data.access_token);return r.data.access_token;};
 const change=async(body,token=current)=>{candidates.push(body.password);uncertain=true;const r=await native('/user','PUT',body,token);uncertain=false;if(r.status===200){changed=true;mutated=true;}return r;};
 const rejected=async(body,codes,token=current)=>{const r=await change(body,token);assert.notEqual(r.status,200);if(!codes.includes(r.data?.error_code))throw Error('PROVIDER_'+r.status+'_'+String(r.data?.error_code).replace(/[^a-z_]/g,''));};
 let failed=false;
 try{
  assert(apikey&&email&&password&&accessToken,'Authorized aged session required');
  assert(expiredNonceOnly?expiredNonce&&!nonce:nonce&&!expiredNonce,'Expired proof must be tested separately before requesting a fresh nonce');
  const identity=await native('/user','GET');assert.equal(identity.status,200);assert.equal(identity.data.email,email);
  const claims=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url'));
  const sessions=await backend('account_sessions_list_v1');assert.equal(sessions.ok,true);
  const own=sessions.data.items.find(s=>s.session_id===claims.session_id);assert(own);
  assert(Date.now()-Date.parse(own.created_at)>24*3600000,'Natural 24-hour session required');
  checks.push('actual native session older than 24 hours');
  if(expiredNonceOnly){
   phase='expired nonce';
   await rejected({password:temporary,current_password:password,nonce:expiredNonce},['reauthentication_not_valid']);
   checks.push('previously delivered unused nonce rejected after natural expiry');
   phase='wrong nonce';let wrongNonce;
   do{wrongNonce=String(randomInt(1000000)).padStart(6,'0');}while(wrongNonce===expiredNonce);
   await rejected({password:temporary,current_password:password,nonce:wrongNonce},['reauthentication_not_valid']);
   checks.push('different incorrect nonce rejected without requesting new proof');
  }else{
  phase='missing nonce';
  await rejected({password:temporary,current_password:password},['reauthentication_needed']);
  checks.push('missing nonce rejected after native refresh');
  phase='current password enforcement';fresh=await login(password);
  // Native verification consumes a valid nonce even if a later password check
  // rejects the request. Test current-password failures on the recent session.
  await rejected({password:temporary},['current_password_required'],fresh);
  await rejected({password:temporary,current_password:'Incorrect!'+randomBytes(24).toString('base64url')},['current_password_invalid'],fresh);
  checks.push('missing and incorrect current password rejected in a recent native session');
  phase='valid aged change';
  const result=await change({password:temporary,current_password:password,nonce});assert.equal(result.status,200);
  assert.equal((await backend('account_get_v1')).ok,true);
  const old=await backend('account_get_v1',fresh);assert.equal(old.ok,false);assert(['AUTH_REQUIRED','SESSION_REVOKED'].includes(old.error?.code));
  checks.push('valid native nonce changes password, preserves current session and revokes another session');
  phase='consumed nonce';
  await rejected({password:'Unused!'+randomBytes(30).toString('base64url'),current_password:temporary,nonce},['reauthentication_not_valid']);
  checks.push('consumed nonce cannot be reused');
  }
 }catch(error){failed=/^PROVIDER_/.test(error.message)?error.message:'ASSERTION';}
 finally{
  let cleanupFailed=false;
  if(changed||uncertain)try{
   let activePassword;
   for(const candidate of [...new Set(candidates)].reverse()){
    const r=await native('/token?grant_type=password','POST',{email,password:candidate},null);
    if(r.status===200){current=r.data.access_token;opened.add(current);activePassword=candidate;mutated=true;break;}
    assert.equal(r.data?.error_code,'invalid_credentials');
   }
   if(activePassword){
    const restored=await native('/user','PUT',{password,current_password:activePassword});assert.equal(restored.status,200);changed=false;
   }
   // Response loss may have left the original credential intact. Verify it too.
   await login(password);
   checks.push('recent native session needs no nonce; original password restored and verified');
  }catch{cleanupFailed=true;}
  for(const token of new Set([...(mutated?[current,accessToken]:[]),...opened].filter(Boolean)))try{
   const r=await native('/logout?scope=local','POST',null,token);assert([200,204,401,403].includes(r.status));
  }catch{cleanupFailed=true;}
  if(cleanupFailed)throw Error('Hosted password cleanup requires inspection; credential and provider data withheld');
 }
 if(failed)throw Error('Hosted password acceptance failed at '+phase+'; code='+failed+'; credential and provider data withheld');
 return {status:'passed',cleanup:expiredNonceOnly?'aged_session_preserved':'complete',checks};
}
