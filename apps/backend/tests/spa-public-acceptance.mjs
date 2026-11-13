import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {authUser,fixturePlatform,must,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as id} from '../scripts/uuid.mjs';
import {spaIngress} from '../transports/spa-ingress-worker.mjs';

test('static SPA public ingress uses native publication routing, counted limits and one application per retry',{timeout:180000},async t=>{
 const db=await connect();t.after(()=>db.end());
 const originalDeno=globalThis.Deno,originalFetch=globalThis.fetch;
 const {env}=context(),{platform,plan}=await fixturePlatform(),owner=await authUser('spa-public-owner');
 const cfg={SUPABASE_URL:env.API_URL,SUPABASE_SERVICE_ROLE_KEY:env.SERVICE_ROLE_KEY,FTK_BROWSER_ORIGINS:'https://spa.ftksaas.invalid',FTK_PUBLIC_BACKEND_ORIGIN:'https://local.invalid',FTK_PUBLIC_ANON_KEY:env.ANON_KEY,FTK_PUBLIC_INGRESS_SECRET:'synthetic-legacy-native-ingress-secret-32',FTK_SPA_INGRESS_SECRET:'synthetic-spa-native-ingress-secret-32',FTK_PUBLIC_HASH_SECRET:randomBytes(32).toString('hex'),FTK_TURNSTILE_SECRET:'synthetic-provider-secret',FTK_PUBLIC_APPLICATION_HOSTNAME:'spa.ftksaas.invalid'};
 let handler,proof={success:true,hostname:cfg.FTK_PUBLIC_APPLICATION_HOSTNAME,action:'public_application'},botCalls=0;
 try{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  const account=await must(owner,'account_get_v1');
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic static SPA',initial_plan_id:plan},id())).primary_id;
  const center=(await must(owner,'center_create_v1',{org_id:org,name:'SPA center',timezone:'UTC'},id())).primary_id;
  const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  const api=(op,body={})=>must(owner,op,{org_id:org,center_id:center,...body},id());
  await api('center_manager_assign_v1',{person_id:person});
  const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic SPA',occurred_at:new Date().toISOString()});await must(platform,'saas_payment_verify_v1',{org_id:org,payment_id:payment.primary_id,accepted:true},id());
  const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Yoga',state:'active'},id())).primary_id;await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  const room=(await api('room_save_v1',{name:'SPA room',capacity:10})).primary_id;await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
  for(const resource of [{kind:'room',id:room},{kind:'person',id:person}])await api('availability_save_v1',{resource,rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
  const starts=new Date();starts.setUTCDate(starts.getUTCDate()+2);starts.setUTCHours(10,0,0,0);
  const interval={starts_at:starts.toISOString(),ends_at:new Date(+starts+3600000).toISOString()};
  const session=(await api('session_create_v1',{discipline_id:discipline,format:'group',interval,resources:[{kind:'room',id:room}],assignments:[{person_id:person,duty:'instructor'}],capacity:{total:10}})).primary_id;
  const publication=(await api('publication_set_v1',{session_id:session,published:true,public_details:{title:'Synthetic SPA Yoga',venue_public_label:'Public room',fee_minor:'1000',currency:'TRY',public_conditions:'Application only'}})).primary_id;
  const compiled=await build({entryPoints:['supabase/functions/backend-v1/handler.ts'],bundle:true,platform:'browser',format:'esm',write:false});
  globalThis.Deno={serve:f=>{handler=f;},env:{get:name=>cfg[name]}};
  globalThis.fetch=async(url,init)=>{
   if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify'){botCalls++;assert.equal(init.body.get('remoteip'),'192.0.2.94');return Response.json(proof);}
   return originalFetch(url,init);
  };
  await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64')+'#spa-native');
  const transport=(url,init)=>handler(new Request(url,init));
  const send=async(path,body,headers={})=>{
   const req=new Request('https://ingress.invalid/api/'+path,{method:'POST',body:JSON.stringify(body),headers:{origin:'https://spa.ftksaas.invalid','content-type':'application/json','cf-connecting-ip':'192.0.2.94','x-vercel-forwarded-for':'198.51.100.8','x-ftk-client-ip':'198.51.100.9',...headers}});Object.defineProperty(req,'cf',{value:{colo:'native-fixture'}});
   const res=await spaIngress(req,{...cfg,FTK_PUBLIC_INGRESS_SECRET:cfg.FTK_SPA_INGRESS_SECRET},transport);return {status:res.status,result:await res.json()};
  };
  const calendar={client_api_version:1,request_id:id(),slug:org,interval,page:{}};
  const listed=await send('public/calendar',calendar);assert.equal(listed.result.ok,true);assert.deepEqual(listed.result.data.items.map(x=>x.publication_id),[publication]);
  const body={client_api_version:1,request_id:id(),publication_id:publication,contact:'spa-student@ftksaas.invalid',bot_proof:'synthetic-provider-proof',client_request_key:id()};
  for(const invalid of [{success:false},{success:true,hostname:'evil.invalid',action:'public_application'},{success:true,hostname:cfg.FTK_PUBLIC_APPLICATION_HOSTNAME,action:'wrong_action'}]){proof=invalid;assert.equal((await send('public/application',body)).result.error.code,'BOT_VERIFICATION_FAILED');}
  assert.equal((await db.query('select count(*)::int n from core.public_applications where org_id=$1',[org])).rows[0].n,0);
  proof={success:true,hostname:cfg.FTK_PUBLIC_APPLICATION_HOSTNAME,action:'public_application'};
  assert.equal((await send('public/application',{...body,center_id:id()})).result.error.code,'SERVICE_UNAVAILABLE');
  assert.equal((await send('public/application',body,{origin:'https://evil.invalid'})).status,403);
  assert.equal((await send('public/application',body)).result.data.accepted,true);const afterFirst=botCalls;
  assert.equal((await send('public/application',{...body,request_id:id(),bot_proof:'expired-retry-token'})).result.data.accepted,true);assert.equal(botCalls,afterFirst,'A committed replay does not consume another CAPTCHA');
  assert.equal((await db.query('select count(*)::int n from core.public_applications where org_id=$1',[org])).rows[0].n,1);
  const mismatch=await send('public/application',{...body,contact:'changed@ftksaas.invalid'});assert.equal(mismatch.result.ok,false);
  const ingress=await import('../scripts/p04-public-ingress.mjs');const raw=JSON.stringify({...body,client_request_key:id()});const signed=ingress.signPublicApplication(raw,'192.0.2.94',cfg.FTK_PUBLIC_INGRESS_SECRET);
  for(const headers of [{...signed,'x-ftk-client-ip':'198.51.100.1'},{...signed,'x-ftk-ingress-time':'1000000000'}]){const denied=await handler(new Request('https://local.invalid/functions/v1/backend-v1/public_application_submit_v1',{method:'POST',body:raw,headers}));assert.equal((await denied.json()).error.code,'SERVICE_UNAVAILABLE');}
  const ipHash=createHashForRate(cfg.FTK_PUBLIC_HASH_SECRET,'ip:192.0.2.94');
  await db.query("update core.rate_limit_windows set attempt_count=(select ip_max+1 from private.p04_public_security where singleton) where dimension='ip' and key_hash=$1",[ipHash]);
  const limited=await send('public/application',{...body,client_request_key:id()});assert.equal(limited.result.error.code,'RATE_LIMITED');assert.equal(botCalls,afterFirst);
 }finally{globalThis.fetch=originalFetch;globalThis.Deno=originalDeno;}
});
import {createHmac,randomBytes} from 'node:crypto';
const createHashForRate=(secret,value)=>createHmac('sha256',secret).update(value).digest('hex');
