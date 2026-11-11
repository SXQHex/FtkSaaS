import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptNativeRecovery,acceptExpiredRecovery} from '../scripts/acceptance/s08-hosted-recovery.mjs';
const origin='https://gwyprhenabtpkbojephw.supabase.co';
const input={email:'test@example.invalid',password:'Synthetic!Password',apikey:'synthetic-key',verifier:'synthetic-private-verifier',link:origin+'/auth/v1/verify?type=recovery&token=pkce_synthetic'};
function fixture({wrongCallback=false,restoreFails=false}={}){
 let login=0,verification=0,exchanged=false,password=input.password,changed=false;const calls=[];
 const request=async(url,options)=>{
  assert.equal(new URL(url).origin,origin);const body=options.body?JSON.parse(options.body):null;calls.push({url,body,token:options.headers?.authorization});
  if(url.includes('/verify?')){
   verification++;const callback=wrongCallback?'https://other.example.invalid/':'https://uye.fethiyetango.com/auth/callback?next=/reset-password';
   return new Response(null,{status:303,headers:{location:callback+(verification===1?'&code=synthetic-code':'&error=access_denied&error_code=otp_expired')}});
  }
  if(url.includes('/token?grant_type=password')){
   assert.equal(body.password,password);return Response.json({access_token:'login-'+(++login)});
  }
  if(url.includes('/token?grant_type=pkce')){
   if(body.code_verifier!==input.verifier)return Response.json({error_code:'bad_code_verifier'},{status:400});
   if(exchanged)return Response.json({error_code:'flow_state_not_found'},{status:400});
   exchanged=true;return Response.json({access_token:'recovery'});
  }
  if(url.endsWith('/user')&&options.method==='GET')return Response.json({email:input.email});
  if(url.endsWith('/user')&&options.method==='PUT'){
   if(options.headers.authorization==='Bearer recovery')assert.equal(Object.hasOwn(body,'current_password'),false);
   if(changed&&restoreFails)throw Error('sensitive provider body');password=body.password;changed=true;return Response.json({id:'synthetic'});
  }
  if(url.endsWith('/account_get_v1'))return Response.json(options.headers.authorization==='Bearer recovery'?{ok:true,data:{}}:{ok:false,error:{code:'SESSION_REVOKED'}});
  if(url.endsWith('/logout?scope=local'))return new Response(null,{status:204});
  throw Error('Unexpected request');
 };
 return {request,calls,password:()=>password};
}
test('recovery acceptance refuses another callback without sending an auth code or changing a password',async()=>{
 const f=fixture({wrongCallback:true});await assert.rejects(acceptNativeRecovery({...input,request:f.request}),/verification callback/);
 assert.equal(f.calls.some(x=>x.url.includes('grant_type=pkce')),false);assert.equal(f.calls.some(x=>x.body?.current_password),false);
});
test('recovery acceptance restores the original password and closes every session including the restoration session',async()=>{
 const f=fixture(),r=await acceptNativeRecovery({...input,request:f.request});assert.equal(r.status,'passed');assert.equal(f.password(),input.password);
 const closed=new Set(f.calls.filter(x=>x.url.includes('/logout?scope=local')).map(x=>x.token));
 assert.deepEqual(closed,new Set(['Bearer login-1','Bearer recovery','Bearer login-2','Bearer login-3']));
 assert.equal(JSON.stringify(r).includes(input.verifier),false);assert.equal(JSON.stringify(r).includes('synthetic-code'),false);
});
test('recovery restoration errors are explicit and contain no credentials or provider response',async()=>{
 const f=fixture({restoreFails:true});await assert.rejects(acceptNativeRecovery({...input,request:f.request}),{message:'Hosted recovery cleanup requires inspection; provider and credential data withheld'});
});
test('recovery acceptance refuses an unrelated provider origin before using any credential',async()=>{
 let calls=0;await assert.rejects(acceptNativeRecovery({...input,link:'https://other.example.invalid/auth/v1/verify?type=recovery&token=pkce_fake',request:async()=>{calls++;}}));assert.equal(calls,0);
});
test('expiry acceptance cannot shorten the natural wait and requires the actual provider expiry response',async()=>{
 let calls=0;
 await assert.rejects(acceptExpiredRecovery({link:input.link,issuedAt:new Date().toISOString(),request:async()=>{calls++;}}),/Natural recovery proof lifetime/);assert.equal(calls,0);
 const issuedAt=new Date(Date.now()-3700000).toISOString();
 const request=async(url,options)=>{assert.equal(options.redirect,'manual');return new Response(null,{status:303,headers:{location:'https://uye.fethiyetango.com/#error=access_denied&error_code=otp_expired'}});};
 assert.equal((await acceptExpiredRecovery({link:input.link,issuedAt,request})).code,'otp_expired');
 await assert.rejects(acceptExpiredRecovery({link:input.link,issuedAt,request:async()=>new Response(null,{status:303,headers:{location:'https://uye.fethiyetango.com/?code=unexpected'}})}));
});
