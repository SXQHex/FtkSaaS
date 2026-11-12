import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptAgedPassword} from '../scripts/acceptance/s08-hosted-password.mjs';

const jwt='header.'+Buffer.from(JSON.stringify({session_id:'synthetic-aged'})).toString('base64url')+'.signature';
const input={apikey:'synthetic-key',email:'test@example.invalid',password:'Synthetic!Password',accessToken:jwt,nonce:'synthetic-delivered-proof'};
function fixture({recent=false,lostResponse=false,restoreFails=false,acceptProbe,probeResponseLost=false}={}){
 let password=input.password,changed=false,login=0;const calls=[];
 const request=async(url,options)=>{
  assert.equal(new URL(url).origin,'https://gwyprhenabtpkbojephw.supabase.co');
  const body=options.body?JSON.parse(options.body):null,token=options.headers.authorization;calls.push({url,body,token});
  if(url.endsWith('/account_sessions_list_v1'))return Response.json({ok:true,data:{items:[{session_id:'synthetic-aged',created_at:new Date(Date.now()-(recent?1:25)*3600000).toISOString()}]}});
  if(url.endsWith('/account_get_v1'))return Response.json(changed&&token.includes('synthetic-login-1')?{ok:false,error:{code:'SESSION_REVOKED'}}:{ok:true,data:{}});
  if(url.endsWith('/user')&&options.method==='GET')return Response.json({email:input.email});
  if(url.includes('/token?')){
   if(body.password!==password)return Response.json({error_code:'invalid_credentials'},{status:400});
   return Response.json({access_token:'synthetic-login-'+(++login)});
  }
  if(url.endsWith('/user')&&options.method==='PUT'){
   let code;
   if(token==='Bearer '+jwt&&!body.nonce)code='reauthentication_needed';
   else if(token==='Bearer '+jwt&&(changed||body.nonce!==input.nonce))code='reauthentication_not_valid';
   else if(!body.current_password)code='current_password_required';
   else if(body.current_password!==password)code='current_password_invalid';
   if(code&&code!==acceptProbe)return Response.json({error_code:code},{status:400});
   if(acceptProbe&&code===acceptProbe){password=body.password;changed=true;if(probeResponseLost)throw Error('private response loss');return Response.json({id:'synthetic'});}
   if(changed&&restoreFails)throw Error('sensitive provider payload');
   password=body.password;
   if(!changed){changed=true;if(lostResponse)throw Error('sensitive response loss');}
   return Response.json({id:'synthetic'});
  }
  if(url.endsWith('/logout?scope=local'))return new Response(null,{status:204});
  throw Error('Unexpected call');
 };
 return {request,calls,password:()=>password};
}
test('password runner rejects a recent session without changing its password or revoking the aged checkpoint',async()=>{
 const f=fixture({recent:true});await assert.rejects(acceptAgedPassword({...input,request:f.request}),/session read/);
 assert.equal(f.calls.some(c=>c.options?.method==='PUT'||c.url.includes('/logout')),false);
 assert.equal(f.calls.some(c=>c.body?.password),false);
});
test('expired nonce acceptance runs before any new proof or login and preserves the aged checkpoint',async()=>{
 const f=fixture(),r=await acceptAgedPassword({...input,nonce:undefined,expiredNonce:'synthetic-expired-proof',expiredNonceOnly:true,request:f.request});
 assert.equal(r.status,'passed');assert.equal(r.cleanup,'aged_session_preserved');
 const probes=f.calls.filter(c=>c.url.endsWith('/user')&&c.body?.password);
 assert.equal(probes.length,2);assert.equal(probes[0].body.nonce,'synthetic-expired-proof');
 assert.notEqual(probes[1].body.nonce,'synthetic-expired-proof');
 assert.equal(f.calls.some(c=>c.url.includes('/token?')||c.url.includes('/reauthenticate')||c.url.includes('/logout')),false);
 assert.equal(f.password(),input.password);
});
for(const probeResponseLost of [false,true])test('expired nonce acceptance restores an unexpected write'+(probeResponseLost?' after response loss':''),async()=>{
 const f=fixture({acceptProbe:'reauthentication_not_valid',probeResponseLost});
 await assert.rejects(acceptAgedPassword({...input,nonce:undefined,expiredNonce:'synthetic-expired-proof',expiredNonceOnly:true,request:f.request}),/Hosted password acceptance failed at expired nonce/);
 assert.equal(f.password(),input.password);
});
test('password runner restores the original credential and preserves native current/other-session assertions',async()=>{
 const f=fixture(),r=await acceptAgedPassword({...input,request:f.request});assert.equal(r.status,'passed');assert.equal(f.password(),input.password);
 assert(r.checks.includes('consumed nonce cannot be reused'));assert(f.calls.some(c=>c.url.endsWith('/logout?scope=local')));
 assert.equal(JSON.stringify(r).includes(input.nonce),false);assert.equal(JSON.stringify(r).includes(input.password),false);
});
test('password runner recovers a successful password mutation whose HTTP response was lost',async()=>{
 const f=fixture({lostResponse:true});await assert.rejects(acceptAgedPassword({...input,request:f.request}),/valid aged change/);assert.equal(f.password(),input.password);
 assert(f.calls.some(c=>c.body?.password===input.password&&c.body?.current_password!==input.password));
});
test('password runner reports restoration failure without leaking provider or credential material',async()=>{
 const f=fixture({restoreFails:true});await assert.rejects(acceptAgedPassword({...input,request:f.request}),{message:'Hosted password cleanup requires inspection; credential and provider data withheld'});
});

for(const acceptProbe of ['reauthentication_needed','current_password_required','current_password_invalid','reauthentication_not_valid']){
 for(const probeResponseLost of [false,true])test('password runner restores after unexpected mutation in '+acceptProbe+(probeResponseLost?' with lost response':''),async()=>{
  const f=fixture({acceptProbe,probeResponseLost});await assert.rejects(acceptAgedPassword({...input,request:f.request}),/Hosted password acceptance failed/);assert.equal(f.password(),input.password);
 });
}
