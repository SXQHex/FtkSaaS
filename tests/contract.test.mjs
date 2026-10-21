import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import {validate,version} from 'uuid';import {newUuidV7,newOperation} from '../scripts/uuid.mjs';
const p=JSON.parse(fs.readFileSync('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json'));const a=new Ajv({strict:false,allErrors:true});addFormats(a);a.addSchema(p,'contract');const valid=(n,x)=>a.getSchema('contract#/$defs/'+n)(x);const id=newUuidV7();
test('UUIDv7 generator: RFC version/variant, uniqueness, current approximate timestamp',()=>{const before=Date.now();const ids=Array.from({length:20000},newUuidV7);const after=Date.now();assert.equal(new Set(ids).size,ids.length);for(const x of ids){assert(validate(x));assert.equal(version(x),7);const ms=parseInt(x.replaceAll('-','').slice(0,12),16);assert(ms>=before&&ms<=after);}});
test('retry preserves frozen operation key',()=>{const operation=newOperation();const attempt2={...operation,request_id:newUuidV7()};assert.equal(operation.operation_key,attempt2.operation_key);assert.notEqual(operation.request_id,attempt2.request_id);});
test('external/provider and existing UUIDv4 acceptance retained, v7 production validator distinct',()=>{const existing='550e8400-e29b-41d4-a716-446655440000';assert(valid('ProviderUuid',existing));assert(valid('FtkUuid',existing));assert(!valid('FtkGeneratedUuidV7',existing));assert(valid('FtkGeneratedUuidV7',id));});
for(const [kind,center,discipline] of [['center_discipline',id,id],['center_all_disciplines',id,null],['organization_discipline',null,id],['organization_all',null,null]]){
 test('package scope valid '+kind,()=>{const s={scope_kind:kind,center_id:center,discipline_id:discipline,usage_targets:['lesson']};assert(valid('ProductScope',s));assert(!valid('ProductScope',{...s,center_id:center?null:id}));assert(!valid('ProductScope',{...s,discipline_id:discipline?null:id}));assert(!valid('ProductScope',{...s,usage_targets:[]}));});
}
test('event-only scope does not accept class selector',()=>{assert(!valid('ProductScope',{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['event'],class_id:id}));});
test('no unknown field / free-text discipline / actor spoof',()=>{const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,name:'Salsa',discipline_id:id,external_open:true};assert(valid('Request_class_save',r));assert(!valid('Request_class_save',{...r,discipline:'Salsa'}));assert(!valid('Request_class_save',{...r,actor_role:'owner'}));});
test('lesson request target is required separately from request trace',()=>{const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,lesson_request_id:id,expected_version:1};assert(valid('Request_lesson_request_withdraw',r));delete r.lesson_request_id;assert(!valid('Request_lesson_request_withdraw',r));});
test('money string and positive collection constraints retained',()=>{assert(valid('Money','100'));assert(!valid('Money',100));assert(!valid('PositiveMoney','0'));});
test('negative limit requires explicit center and discipline',()=>{const r={client_api_version:1,request_id:id,org_id:id,operation_key:id,expected_version:1,person_id:id,allowed_negative_credits:2,impact_approval:{id,token:'test-opaque-token'},accepted_reservation_ids:[],reason:'test',center_id:id,discipline_id:id};assert(valid('Request_negative_limit_set',r));delete r.discipline_id;assert(!valid('Request_negative_limit_set',r));});

test('P04 public ingress binds exact body/path/IP and provider hostname/action; no missing-secret bypass',async()=>{
 const {build}=await import('esbuild');
 const compiled=await build({entryPoints:['supabase/functions/backend-v1/public-ingress.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const {publicIngress,keyedHash,verifyPublicBot}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 const cfg={FTK_PUBLIC_INGRESS_SECRET:'synthetic-ingress',FTK_PUBLIC_HASH_SECRET:'synthetic-hash',FTK_TURNSTILE_SECRET:'synthetic-provider',FTK_TURNSTILE_HOSTNAME:'public.ftksaas.invalid'},env=k=>cfg[k];
 const now=Date.now(),time=String(Math.floor(now/1000)),body=JSON.stringify({contact:'prospect@ftksaas.invalid'}),ip='192.0.2.15',path='/functions/v1/backend-v1/public_application_submit_v1';
 const digest=(await import('node:crypto')).createHash('sha256').update(body).digest('hex');
 const signature=await keyedHash(cfg.FTK_PUBLIC_INGRESS_SECRET,['POST',path,time,ip,digest].join('\n'));
 const headers={'x-ftk-client-ip':ip,'x-ftk-ingress-time':time,'x-ftk-ingress-signature':signature};
 const req=new Request('https://example.invalid'+path,{method:'POST',headers});
 const accepted=await publicIngress(req,body,env,now);assert(accepted);assert.equal(accepted.ip,ip);assert.match(accepted.ip_hash,/^[a-f0-9]{64}$/);
 assert.equal(await accepted.targetHash(' X@EXAMPLE.INVALID '),await accepted.targetHash('x@example.invalid'));
 for(const [r,b,e,n] of [[req,body,()=>undefined,now],[req,body+' ',env,now],[req,body,env,now+61000],[new Request('https://example.invalid/other',{method:'POST',headers}),body,env,now],[new Request(req,{headers:{...headers,'x-ftk-client-ip':'192.0.2.16'}}),body,env,now]])assert.equal(await publicIngress(r,b,e,n),null);
 const provider=proof=>async(url,options)=>{assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.equal(options.body.get('remoteip'),ip);return Response.json(proof);};
 assert.equal(await verifyPublicBot('proof',ip,env,provider({success:true,hostname:cfg.FTK_TURNSTILE_HOSTNAME,action:'public_application'})),true);
 for(const proof of [{success:false},{success:true,hostname:'foreign.invalid',action:'public_application'},{success:true,hostname:cfg.FTK_TURNSTILE_HOSTNAME,action:'other'}])assert.equal(await verifyPublicBot('proof',ip,env,provider(proof)),false);
 assert.equal(await verifyPublicBot('proof',ip,()=>undefined,()=>{throw Error('must not call provider');}),false);
 assert.equal(await verifyPublicBot('proof',ip,env,async()=>{throw Error('provider unavailable');}),false);
 const {signPublicApplication}=await import('../scripts/p04-public-ingress.mjs');
 cfg.FTK_PUBLIC_INGRESS_SECRET='synthetic-32-byte-ingress-secret-for-tests';
 for(const clientIp of [ip,'2001:0DB8:0000:0000:0000:0000:0000:0001']){
  const signed=signPublicApplication(body,clientIp,cfg.FTK_PUBLIC_INGRESS_SECRET,now);
  assert(await publicIngress(new Request(req.url,{method:'POST',headers:signed}),body,env,now));
 }
 for(const invalid of ['192.0.2.15, 192.0.2.16','not-an-ip','192.0.2.999','[2001:db8::1]'])assert.throws(()=>signPublicApplication(body,invalid,cfg.FTK_PUBLIC_INGRESS_SECRET,now),/IP/);
 assert.throws(()=>signPublicApplication(body,ip,'short',now),/32 bytes/);
});
test('P04 trial setup has explicit limits and no implicit product or repeat policy mutation',async()=>{
 const {trialConfigurationSQL}=await import('../scripts/p04-trial-config.mjs');
 const cfg={org_id:id,center_id:newUuidV7(),product_version_id:newUuidV7(),offer_minutes:15,expected_repeat_limit:1,enabled:true};
 assert.match(trialConfigurationSQL(cfg),/Effective repeat policy differs/);
 for(const key of Object.keys(cfg)){const missing={...cfg};delete missing[key];assert.throws(()=>trialConfigurationSQL(missing),/explicit/);}
 for(const bad of [{offer_minutes:0},{expected_repeat_limit:-1},{enabled:'true'},{org_id:"';drop table core.people;--"}])assert.throws(()=>trialConfigurationSQL({...cfg,...bad}));
});
