import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptNativeRecovery,acceptExpiredRecovery as runExpiredRecovery} from '../scripts/acceptance/s08-hosted-recovery.mjs';
import {spawnSync} from 'node:child_process';
const origin='https://gwyprhenabtpkbojephw.supabase.co';
const callback={origin:'https://app.fethiyetango.com',path:'/auth/callback',next:'/reset-password'};
const callbackUrl=pin=>pin.origin+pin.path+(pin.next===null?'':'?'+new URLSearchParams({next:pin.next}));
// Historical expiry fixture is an explicitly pinned root error route, never a runner default.
const acceptExpiredRecovery=options=>runExpiredRecovery({callback:{origin:'https://uye.fethiyetango.com',path:'/',next:null},...options});
const input={callback,email:'test@example.invalid',password:'Synthetic!Password',apikey:'synthetic-key',verifier:'synthetic-private-verifier',link:origin+'/auth/v1/verify?type=recovery&token=pkce_synthetic'};
function fixture({wrongCallback=false,restoreFails=false,redirect=callbackUrl(callback)}={}){
 let login=0,verification=0,exchanged=false,password=input.password,changed=false;const calls=[];
 const request=async(url,options)=>{
  assert.equal(new URL(url).origin,origin);const body=options.body?JSON.parse(options.body):null;calls.push({url,body,token:options.headers?.authorization});
  if(url.includes('/verify?')){
   verification++;const callback=wrongCallback?'https://other.example.invalid/':redirect;
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

test('recovery accepts only its explicitly pinned app or loopback callback',async()=>{
 for(const pin of [callback,{origin:'http://localhost:5173',path:'/auth/callback',next:'/reset-password'},{origin:'http://127.0.0.1:4173',path:'/auth/callback',next:'/reset-password'}]){
  const f=fixture({redirect:callbackUrl(pin)});const result=await acceptNativeRecovery({...input,callback:pin,request:f.request});
  assert.equal(result.status,'passed');assert.equal(f.password(),input.password);
 }
});
test('callback path, next and duplicate next mismatches never reach PKCE or password changes',async()=>{
 for(const redirect of [callback.origin+'/different?next=/reset-password',callback.origin+'/auth/callback?next=/account',callbackUrl(callback)+'&next=/account',callbackUrl(callback)+'&access_token=private-callback-token']){
  const f=fixture({redirect});await assert.rejects(acceptNativeRecovery({...input,request:f.request}),/verification callback/);
  assert(!f.calls.some(x=>x.url.includes('grant_type=pkce')));assert(!f.calls.some(x=>x.body?.password&&x.url.endsWith('/user')));
  assert(f.calls.some(x=>x.url.endsWith('/logout?scope=local')));
 }
});
test('missing or malformed callback pin fails before credentials or any network request',async()=>{
 for(const pin of [undefined,{...callback,origin:'http://remote.example.invalid'},{...callback,origin:callback.origin+'/'},{...callback,path:'//foreign.invalid'},{...callback,next:'//foreign.invalid'},{...callback,next:'https://foreign.invalid/reset'},{origin:callback.origin,path:callback.path}]){
  let calls=0;const request=async()=>{calls++;throw Error('private-provider-payload');};
  await assert.rejects(acceptNativeRecovery({...input,callback:pin,request}));
  await assert.rejects(runExpiredRecovery({link:input.link,issuedAt:new Date(Date.now()-3700000).toISOString(),callback:pin,request}));
  assert.equal(calls,0);
 }
});
test('expiry checks the exact pinned app or local error callback and never accepts code or credentials',async()=>{
 const issuedAt=new Date(Date.now()-3700000).toISOString();
 for(const pin of [callback,{origin:'http://localhost:5173',path:'/auth/callback',next:'/reset-password'}]){
  const target=callbackUrl(pin)+'&error=access_denied&error_code=otp_expired';
  const request=async()=>new Response(null,{status:303,headers:{location:target}});
  assert.equal((await runExpiredRecovery({link:input.link,issuedAt,callback:pin,request})).code,'otp_expired');
  for(const location of [target.replace('/auth/callback','/wrong'),target.replace(encodeURIComponent('/reset-password'),encodeURIComponent('/wrong')),target+'&code=private-code',target+'#access_token=private-token',target.replace('otp_expired','unexpected')]){
   await assert.rejects(runExpiredRecovery({link:input.link,issuedAt,callback:pin,request:async()=>new Response(null,{status:303,headers:{location}})}),error=>!String(error.stack).includes('private-code')&&!String(error.stack).includes('private-token'));
  }
 }
});
test('CLI rejects missing or malformed private input without echoing proof or credentials',()=>{
 for(const inputText of ['{"password":"private-password","link":"private-proof",',JSON.stringify(input)]){
  const result=spawnSync(process.execPath,['scripts/acceptance/s08-hosted-recovery.mjs','expired'],{input:inputText,encoding:'utf8',timeout:5000});
  assert.equal(result.status,1);assert(!result.stdout.includes('private-password'));assert(!result.stderr.includes('private-proof'));assert(!result.stderr.includes(input.verifier));
 }
});

test('expiry refuses mixed error codes and fragment next or code even beside a real expiry error',async()=>{
 const issuedAt=new Date(Date.now()-3700000).toISOString(),target=callbackUrl(callback)+'&error=access_denied&error_code=otp_expired';
 for(const location of [target+'&error_code=otp_expired',target+'#error_code=other',target+'#next=/other',target+'#code=private-code']){
  await assert.rejects(runExpiredRecovery({link:input.link,issuedAt,callback,request:async()=>new Response(null,{status:303,headers:{location}})}));
 }
});

test('native runner entry routes private input and never executes on import',async()=>{
 const {runRecoveryAcceptance}=await import('../scripts/acceptance/s08-hosted-recovery.mjs');
 const f=fixture();assert.equal((await runRecoveryAcceptance('native',{...input,request:f.request})).cleanup,'complete');
 await assert.rejects(runRecoveryAcceptance('unrecognized',input),/native or expired/);
});
