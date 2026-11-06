import './reminder-contract-unit.mjs';
import './transactional-email-unit.mjs';
import './email-events-unit.mjs';
import './resend-webhook-unit.mjs';
import './email-provider-unit.mjs';
import './edge-bundle-unit.mjs';
import './deployment-cli-unit.mjs';
import './crm-meta-lead-unit.mjs';
import './crm-meta-graph-unit.mjs';
import './crm-provider-intake-unit.mjs';
import './crm-provider-mapping-unit.mjs';
import './crm-provider-webhook-unit.mjs';
import './crm-google-lead-unit.mjs';
import './crm-web-form-unit.mjs';
import './document-self-contract-unit.mjs';
import './crm-ingress-unit.mjs';
import './crm-application-contract-unit.mjs';
import './auth-password-security-unit.mjs';
import './invitation-delivery-unit.mjs';
import './account-signup-adapter.mjs';
import './calendar-feed-unit.mjs';
import './p06-parser.mjs';
import './settings-media-unit.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import {validate,version} from 'uuid';import {newUuidV7,newOperation} from '../scripts/uuid.mjs';
test('P05 Storage adapter checks actual bytes/hash/mime/size and returns no internal origin',async()=>{
 const {build}=await import('esbuild');const built=await build({entryPoints:['supabase/functions/backend-v1/document-storage.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const {documentStorage,contentHash}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const bytes=new TextEncoder().encode('P05 synthetic body'),checksum=await contentHash(bytes),object=newUuidV7()+'/'+newUuidV7();
 const storage=documentStorage('http://private-kong.invalid','synthetic-service-key',async(url,options)=>{
  assert.equal(options.headers.authorization,'Bearer synthetic-service-key');
  if(options.method==='POST'){assert.equal(JSON.parse(options.body).upsert,false);return Response.json({url:'/object/upload/sign/ftksaas-documents/'+object+'?token=synthetic-upload-token'});}
  return new Response(bytes,{headers:{'content-type':'text/plain'}});
 });
 assert((await storage.upload(object)).startsWith('/storage/v1/object/upload/sign/'));assert.equal((await storage.download(object,{bytes:bytes.length,mime:'text/plain',checksum})).checksum,checksum);
 await assert.rejects(storage.download(object,{bytes:1,mime:'text/plain'}),/SIZE/);
 await assert.rejects(storage.download(object,{bytes:bytes.length,mime:'text/plain',checksum:'0'.repeat(64)}),/CHECKSUM/);
 await assert.rejects(storage.download(object,{bytes:bytes.length,mime:'application/pdf'}),/MIME/);
 await assert.rejects(storage.upload('../other-org'),/PATH/);
 const fakePdf=documentStorage('http://private-kong.invalid','synthetic',async()=>new Response('not a pdf',{headers:{'content-type':'application/pdf'}}));await assert.rejects(fakePdf.download(object),/MIME/);
});
const p=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json'));const a=new Ajv({strict:false,allErrors:true});addFormats(a);a.addSchema(p,'contract');const valid=(n,x)=>a.getSchema('contract#/$defs/'+n)(x);const id=newUuidV7();
test('agreement preparations are typed proposals without instructor, dates or publication authority',async()=>{
 const terms={model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'25000'}],room_fee:{kind:'free',order:'after_instructor_share'}};
 const template={key:'fixed',name:'Explicit fixed fee',discipline_id:id,format:'group',terms};
 for(const scope of ['Center','Organization']){
  assert(valid(scope+'SettingsValues',{agreement_templates:[template]}));
  for(const addition of [{person_id:id},{valid:{starts_at:'2030-01-01T00:00:00Z'}},{published:true}])assert(!valid(scope+'SettingsValues',{agreement_templates:[{...template,...addition}]}));
 }
 assert(!valid('UserSettingsValues',{agreement_templates:[template]}));assert(!valid('MemberSettingsValues',{agreement_templates:[]}));
 const operation=p['x-contract'].operations.find(o=>o.name==='settings_preparation_resolve_v1');
 assert(operation.features.includes('F20'));assert(operation.conditional_features.some(c=>c.feature==='F20'&&c.when==='agreement_preparation'&&c.mode==='required_if_selected'));
 assert(!operation.required_features.includes('F20'));assert(!operation.runtime_required_features.includes('F20'));
 const source={scope:'organization',key:'fixed',version:2};
 const request={client_api_version:1,request_id:id,org_id:id,center_id:id,kind:'agreement',source};
 assert(valid('Request_settings_preparation_resolve',request));assert(!valid('Request_settings_preparation_resolve',{...request,person_id:id}));
 const result={kind:'agreement',source,agreement_request:{discipline_id:id,format:'group',terms}};
 assert(valid('ResolvedDomainPreparation',result));assert(!valid('ResolvedDomainPreparation',{...result,operation_id:id}));
 const generated=await import('../supabase/functions/backend-v1/validators.js');
 assert(generated.request_settings_preparation_resolve_v1(request));assert(!generated.request_settings_preparation_resolve_v1({...request,person_id:id}));
 const update={client_api_version:1,request_id:id,operation_key:id,org_id:id,center_id:id,scope:'center',expected_version:0,patch:{agreement_templates:[template]}};
 assert(generated.request_settings_update_v1(update));assert(!generated.request_settings_update_v1({...update,patch:{agreement_templates:[{...template,published:true}]}}));
 assert(generated.success_settings_preparation_resolve_v1({ok:true,data:result,trace_id:id}));
 const publish={client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,...result.agreement_request};
 assert(!valid('Request_instructor_agreement_publish',publish));
 assert(valid('Request_instructor_agreement_publish',{...publish,person_id:id,reason:'Explicit publication',valid:{starts_at:'2030-01-01T00:00:00Z',ends_at:'2031-01-01T00:00:00Z'}}));
 const config=JSON.parse(fs.readFileSync('config/frontend-settings.json'));
 for(const scope of ['user','member','center','organization','platform']){
  const fields=config.fields.filter(f=>f.scope===scope);
  const data={scope,catalog_version:config.version,fields:fields.map(f=>({key:f.key,group:f.group,consumer:f.consumer,writable:true})),defaults:Object.fromEntries(fields.map(f=>[f.key,f.default])),brand_packages:[],limitations:[]};
  assert(valid('SettingsCatalog',data));assert(generated.success_settings_catalog_get_v1({ok:true,data,trace_id:id}));
  for(const patch of [{fields:[{}]},{brand_packages:[null]},{limitations:[4]}]){
   assert(!valid('SettingsCatalog',{...data,...patch}));assert(!generated.success_settings_catalog_get_v1({ok:true,data:{...data,...patch},trace_id:id}));
  }
 }
 const inline=s=>{
  if(Array.isArray(s))return s.map(inline);
  if(!s||typeof s!=='object')return s;
  if(s.$ref&&s.$ref!=='#/$defs/FtkUuid')return inline(p.$defs[s.$ref.split('/').at(-1)]);
  const result=Object.fromEntries(Object.entries(s).map(([k,v])=>[k,inline(v)]));
  if(s.enum&&!s.type)result.type='string';return result;
 };
 for(const scope of ['organization','center']){const f=config.fields.find(f=>f.scope===scope&&f.key==='agreement_templates');assert(f);assert.equal(f.group,scope==='organization'?'O19':'M12');assert.deepEqual(f.default,[]);}
 for(const f of config.fields.filter(f=>f.key==='agreement_templates'))assert.deepEqual(f.schema.items.properties.terms,{$ref:'#/$defs/PayTerms'});
 const sqlSchema=JSON.parse(fs.readFileSync('database/agreement-preparations.sql','utf8').split("$schema$select '")[1].split("'::jsonb$schema$")[0].replaceAll("''","'"));
 assert.deepEqual(sqlSchema,inline(p.$defs.PayTerms));
 const migration=fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_agreement_preparations.sql'));assert(migration);
 const catalog=fs.readFileSync('database/settings-catalog-v13.sql','utf8'),impl=fs.readFileSync('database/agreement-preparations.sql','utf8');
 assert.equal(fs.readFileSync('supabase/migrations/'+migration,'utf8'),catalog.replace('commit;\n',()=>impl.replace('begin;\n','')));
});
test('Starter instructor discovery exposes assignment versions without broadening writes',()=>{
 const reader=p['x-contract'].operations.find(o=>o.name==='management_state_get_v1');
 assert(reader.runtime_selectors.includes('role_assign_v1'));
 const key={role:'instructor',scope:{center_id:id}};
 const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation:'role_assign_v1',selector:{operation:'role_assign_v1',key},page:{limit:1}};
 assert(valid('Request_management_state_get',r));
 assert(valid('Request_management_state_get',{...r,selector:{...r.selector,key:{...key,person_id:id}}}));
 assert(!valid('Request_management_state_get',{...r,center_id:null}));
 assert(!valid('Request_management_state_get',{...r,selector:{...r.selector,key:{role:'instructor'}}}));
 assert(!valid('Request_role_assign',{client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,...key}));
 const entity={type:'role_assignments',id};
 const item={operation:'role_assign_v1',entity,exists:true,state:'inactive',versions:[{entity,version:2}],as_of:new Date().toISOString(),current:{operation:'role_assign_v1',values:{person_id:id,...key}}};
 assert(valid('ManagementStateView',item));
 assert(!valid('ManagementStateView',{...item,current:{...item.current,values:{...item.current.values,account_link_id:id}}}));
});
test('room editing advertises its discoverable management reader with typed values and row version',()=>{
 const write=p['x-contract'].operations.find(o=>o.name==='room_save_v1');
 assert.equal(write.operation_contract.read_operation,'management_state_get_v1');
 assert.equal(write.operation_contract.read_path_status,'implemented');
 const request={client_api_version:1,request_id:id,org_id:id,center_id:id,operation:'room_save_v1',selector:{operation:'room_save_v1',key:{}},page:{limit:1}};
 assert(valid('Request_management_state_get',request));
 assert(valid('Request_management_state_get',{...request,selector:{operation:'room_save_v1',key:{room_id:id}}}));
 const item={operation:'room_save_v1',entity:{type:'rooms',id},exists:true,state:'active',versions:[{entity:{type:'rooms',id},version:4}],as_of:new Date().toISOString(),current:{operation:'room_save_v1',values:{room_id:id,name:'Studio',capacity:10}}};
 assert(valid('ManagementStateView',item));
 assert(valid('Request_room_save',{client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,...item.current.values,expected_version:item.versions[0].version}));
});
test('studio discovery accepts class filters and program identity without a previous write response',()=>{
 const request=(operation,key)=>({client_api_version:1,request_id:id,org_id:id,center_id:id,operation,selector:{operation,key},page:{limit:1}});
 for(const key of [{},{class_id:id},{discipline_id:id},{class_id:id,discipline_id:id}])assert(valid('Request_management_state_get',request('class_save_v1',key)));
 assert(valid('Request_management_state_get',request('program_preview_v1',{class_id:id,program_id:id})));
 assert(!valid('Request_management_state_get',request('program_preview_v1',{program_id:id})));
 assert(!valid('Request_management_state_get',request('class_save_v1',{untrusted_filter:id})));
 const reader=p['x-contract'].operations.find(o=>o.name==='management_state_get_v1');
 for(const operation of ['class_save_v1','program_preview_v1'])assert(reader.runtime_selectors.includes(operation));
 assert.equal(p['x-contract'].operations.find(o=>o.name==='class_save_v1').operation_contract.read_path_status,'implemented');
});
test('saved program management projection uses wire capacity and leaves unavailable legacy schedule absent',()=>{
 const values={class_id:id,program_id:id,timezone:'Europe/Istanbul'};
 const item={operation:'program_preview_v1',entity:{type:'program_versions',id},exists:true,state:'active',versions:[{entity:{type:'program_versions',id},version:1}],as_of:new Date().toISOString(),current:{operation:'program_preview_v1',values}};
 assert(valid('ManagementStateView',item));
 const schedule={weekdays:[1],local_start:'12:00:00',duration_minutes:60,starts_on:'2027-01-04',ends_on:'2027-02-01',assignments:[],capacity:{total:8}};
 assert(valid('ManagementStateView',{...item,current:{...item.current,values:{...values,schedule}}}));
 assert(!valid('ManagementStateView',{...item,current:{...item.current,values:{...values,schedule:{...schedule,capacity:{nominal:8,maximum:8}}}}}));
});
test('Starter resource discovery exposes only implemented typed selectors and requires a center',()=>{
 const reader=p['x-contract'].operations.find(o=>o.name==='management_state_get_v1');
 for(const operation of ['center_discipline_set_v1','availability_exception_save_v1']){
  assert(reader.runtime_selectors.includes(operation));
  assert.equal(p['x-contract'].operations.find(o=>o.name===operation).operation_contract.read_path_status,'implemented');
  const key=operation==='center_discipline_set_v1'?{discipline_id:id}:{resource:{kind:'room',id}};
  const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation,selector:{operation,key}};
  assert(valid('Request_management_state_get',r));
  assert(!valid('Request_management_state_get',{...r,center_id:null}));
 }
 const absence={operation:'center_discipline_set_v1',entity:null,exists:false,state:null,versions:[],as_of:new Date().toISOString(),current:{operation:'center_discipline_set_v1',values:{discipline_id:id}}};
 assert(valid('ManagementStateView',absence));
 const closure={...absence,operation:'availability_exception_save_v1',entity:{type:'availability_exceptions',id},exists:true,state:'active',versions:[{entity:{type:'centers',id},version:5}],current:{operation:'availability_exception_save_v1',values:{resource:{kind:'room',id},interval:{starts_at:'2030-01-01T00:00:00Z',ends_at:'2030-01-02T00:00:00Z'}}}};
 assert(valid('ManagementStateView',closure));
 assert(!valid('ManagementStateView',{...closure,current:{...closure.current,values:{...closure.current.values,reason:'private'}}}));
});
test('subscriber numbers are lossless decimal identifiers on person and report projections',()=>{
 for(const n of ['1001','9223372036854775807'])assert(valid('SubscriberNumber',n));
 for(const n of ['1000','001001','1e3',1001,'-1001'])assert(!valid('SubscriberNumber',n));
 const person={id,display_name:'Synthetic student',relationships:[],subscriber_number:'1001'};
 assert(valid('PersonSummary',person));assert(valid('PersonSummary',{...person,subscriber_number:null}));
 assert(valid('PersonView',{...person,version:1,discipline_relationships:[]}));
 assert(valid('ReportRow',{group_key:'outstanding_debt',person_id:id,subscriber_number:'1001'}));
 assert(valid('ReportColumns',['group_key','subscriber_number']));
 assert(!valid('PersonSummary',{...person,subscriber_number:1001}));
});
test('settings catalogue groups isolate calendar display, reminders and package preparation without changing stored fields',()=>{
 const fields=JSON.parse(fs.readFileSync('config/frontend-settings.json')).fields.filter(f=>f.key!=='agreement_templates');
 for(const f of fields){
  if(f.consumer==='reminder_settings')assert.equal(f.group,{organization:'O07',center:'M14',member:'S13'}[f.scope],f.scope+'.'+f.key);
  if(f.consumer==='reminder_quiet_until')assert.equal(f.group,'S13',f.key);
  if(f.key==='package_templates')assert.equal(f.group,{organization:'O10',center:'M10'}[f.scope],f.scope);
 }
 assert.deepEqual(fields.filter(f=>f.scope==='user'&&f.group==='S10').map(f=>f.key).sort(),['calendar_view','show_weekends']);
 const previous=JSON.parse(fs.readFileSync('database/settings-catalog-v11.sql','utf8').split("$fields$select '")[1].split("'::jsonb$fields$")[0].replaceAll("''","'"));
 const withoutGroups=xs=>xs.map(({group,...rest})=>rest);assert.deepEqual(withoutGroups(fields),withoutGroups(previous));
 const config={version:12};const sql=fs.readFileSync('database/settings-catalog-v'+config.version+'.sql');
 const migration=fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_settings_behavior_groups.sql'));assert(migration);assert.equal(fs.readFileSync('supabase/migrations/'+migration,'utf8'),sql.toString().replace('commit;\n',fs.readFileSync('database/settings-behavior-groups.sql','utf8')+'commit;\n'));
});
test('subscriber report column is supported by every persisted template catalogue',()=>{
 const config=JSON.parse(fs.readFileSync('config/frontend-settings.json'));
 const fields=config.fields.filter(x=>x.key==='report_templates');assert.equal(fields.length,3);
 for(const field of fields){const columns=field.schema.items.properties.columns;assert(columns.items.enum.includes('subscriber_number'),field.scope);assert.equal(columns.maxItems,p.$defs.ReportColumns.maxItems);assert.deepEqual(new Set(columns.items.enum),new Set(p.$defs.ReportColumns.items.enum));}
});
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
 cfg.FTK_PUBLIC_APPLICATION_HOSTNAME='uye.fethiyetango.com';
 assert.equal(await verifyPublicBot('proof',ip,env,provider({success:true,hostname:cfg.FTK_PUBLIC_APPLICATION_HOSTNAME,action:'public_application'})),true);
 assert.equal(await verifyPublicBot('proof',ip,env,provider({success:true,hostname:cfg.FTK_TURNSTILE_HOSTNAME,action:'public_application'})),false);
 assert.equal(await verifyPublicBot('proof',ip,env,provider({success:true,hostname:cfg.FTK_TURNSTILE_HOSTNAME,action:'password_recovery'}),'password_recovery'),true);

 const {signPublicApplication}=await import('../scripts/p04-public-ingress.mjs');
 cfg.FTK_PUBLIC_INGRESS_SECRET='synthetic-32-byte-ingress-secret-for-tests';
 for(const clientIp of [ip,'2001:0DB8:0000:0000:0000:0000:0000:0001']){
  const signed=signPublicApplication(body,clientIp,cfg.FTK_PUBLIC_INGRESS_SECRET,now);
  assert(await publicIngress(new Request(req.url,{method:'POST',headers:signed}),body,env,now));
  assert(await publicIngress(new Request(req.url.replace('/functions/v1',''),{method:'POST',headers:signed}),body,env,now),'Hosted gateway removes the external functions prefix');
  for(const changed of ['/backend-v1/account_get_v1','/other/public_application_submit_v1','/backend-v1/public_application_submit_v1/','/functions/v1/backend-v1/account_get_v1'])assert.equal(await publicIngress(new Request('https://example.invalid'+changed,{method:'POST',headers:signed}),body,env,now),null,'Only exact known gateway route equivalents may share a signature');
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
import './p07-auth-adapter.mjs';

test('public gateway uses only trusted Vercel IP, exact origin and fixed Edge route; no headers or credentials forwarded',async()=>{
 const {handlePublicApplication}=await import('../scripts/public-application-gateway.mjs');
 const env={FTK_PUBLIC_APPLICATION_HOSTNAME:'uye.fethiyetango.com',FTK_PUBLIC_INGRESS_SECRET:'synthetic-32-byte-gateway-ingress-secret',FTK_PUBLIC_ANON_KEY:'synthetic-anon-jwt'};
 const body=JSON.stringify({client_api_version:1,contact:'synthetic@ftksaas.invalid'});
 const headers={origin:'https://uye.fethiyetango.com','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.30','x-ftk-client-ip':'203.0.113.99','x-ftk-ingress-signature':'attacker',cookie:'secret-cookie',authorization:'Bearer caller-secret'};
 let calls=0;const provider=async(url,options)=>{calls++;assert.equal(url,'https://gwyprhenabtpkbojephw.supabase.co/functions/v1/backend-v1/public_application_submit_v1');assert.equal(options.body,body);assert.equal(options.headers['x-ftk-client-ip'],'192.0.2.30');assert.notEqual(options.headers['x-ftk-ingress-signature'],'attacker');assert.equal(options.headers.authorization,'Bearer synthetic-anon-jwt');assert.equal(options.headers.cookie,undefined);return Response.json({ok:true,data:{accepted:true},trace_id:id},{headers:{'set-cookie':'secret'}});};
 const make=(h={},data=body)=>new Request('https://uye.fethiyetango.com/api/public-application',{method:'POST',headers:{...headers,...h},body:data});
 const ok=await handlePublicApplication(make(),env,provider);assert.equal(ok.status,200);assert.equal(ok.headers.get('set-cookie'),null);
 for(const h of [{origin:'https://foreign.invalid'},{'x-vercel-forwarded-for':''},{'x-vercel-forwarded-for':'192.0.2.30, 192.0.2.31'},{'content-type':'text/plain'}])assert.notEqual((await handlePublicApplication(make(h),env,provider)).status,200);
 assert.equal((await handlePublicApplication(make(),{},provider)).status,503);
 assert.equal((await handlePublicApplication(make({},'x'.repeat(65537)),env,provider)).status,413);
 assert.equal(calls,1);
 assert.equal((await handlePublicApplication(make({},'{'),env,provider)).status,400);
 for(const response of [new Response('<html>bad</html>'),Response.json({diagnostic:'private'}),new Response('x'.repeat(65537)),Response.json({ok:true,data:{accepted:true},trace_id:id,secret:'private'})]){
  const failed=await handlePublicApplication(make(),env,async()=>response);assert.equal(failed.status,503);const failure=await failed.json();assert.equal(failure.error.code,'TEMPORARY_FAILURE');assert(valid('FailureEnvelope',failure));
 }
 const denied=await handlePublicApplication(make(),env,async()=>Response.json({ok:false,error:{code:'RATE_LIMITED',retryable:false,trace_id:id,retry_after_ms:1000}}));assert.equal(denied.status,200);assert.equal((await denied.json()).error.code,'RATE_LIMITED');

});

test('public-only hostname configuration reaches handler preflight, siteverify and submit without legacy recovery hostname',async()=>{
 const {build}=await import('esbuild');
 const built=await build({entryPoints:['supabase/functions/backend-v1/handler.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const {signPublicApplication}=await import('../scripts/p04-public-ingress.mjs');
 const env={SUPABASE_URL:'https://supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',FTK_PUBLIC_INGRESS_SECRET:'synthetic-32-byte-ingress-handler-secret',FTK_PUBLIC_HASH_SECRET:'synthetic-hash',FTK_TURNSTILE_SECRET:'synthetic-provider',FTK_PUBLIC_APPLICATION_HOSTNAME:'uye.fethiyetango.com'};
 const body=JSON.stringify({client_api_version:1,request_id:id,publication_id:id,contact:'synthetic@ftksaas.invalid',bot_proof:'synthetic-provider-proof',client_request_key:id});
 const originalDeno=globalThis.Deno,originalFetch=globalThis.fetch;let handler;const phases=[];
 try{
  globalThis.Deno={serve:f=>{handler=f;},env:{get:k=>env[k]}};
  globalThis.fetch=async(url,options)=>{
   if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify')return Response.json({success:true,hostname:env.FTK_PUBLIC_APPLICATION_HOSTNAME,action:'public_application'});
   assert.equal(url,'https://supabase.invalid/rest/v1/rpc/public_application_submit_v1');const phase=JSON.parse(options.body).p_aux.phase;phases.push(phase);
   return Response.json({ok:true,data:phase==='preflight'?{bot_required:true}:{accepted:true},trace_id:id});
  };
  await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  const response=await handler(new Request('https://edge.invalid/functions/v1/backend-v1/public_application_submit_v1',{method:'POST',headers:signPublicApplication(body,'192.0.2.30',env.FTK_PUBLIC_INGRESS_SECRET),body}));
  assert.equal(response.status,200);assert.equal((await response.json()).data.accepted,true);assert.deepEqual(phases,['preflight','submit']);
 }finally{globalThis.fetch=originalFetch;if(originalDeno===undefined)delete globalThis.Deno;else globalThis.Deno=originalDeno;}
});


test('center preparation provenance accepts source objects and rejects template arrays',()=>{
 const scope={availability_templates:{kind:'organization_copy',organization_version:3},package_templates:{kind:'system_default'}};
 assert(valid('PreparationSources',scope));
 assert(valid('PreparationSources',{availability_templates:{kind:'center_local'},package_templates:{kind:'organization_copy',organization_version:0}}));
 for(const field of ['availability_templates','package_templates']){
  assert(!valid('PreparationSources',{...scope,[field]:[]}));
  assert(!valid('PreparationSources',{...scope,[field]:{kind:'unrecognized'}}));
  assert(!valid('PreparationSources',{...scope,[field]:{kind:'center_local',account_id:id}}));
 }
 const values=Object.fromEntries(JSON.parse(fs.readFileSync('config/frontend-settings.json')).fields.filter(f=>f.scope==='center').map(f=>[f.key,f.default]));
 assert(valid('SettingsView',{scope:'center',version:0,values,as_of:new Date().toISOString(),overridden_fields:[],program_duration_source:{kind:'system_default'},preparation_sources:scope}));
});


test("every settings catalog consumer has a closed descriptor in the response contract",()=>{
 const fields=JSON.parse(fs.readFileSync("config/frontend-settings.json")).fields;
 for(const field of fields)assert(valid("SettingsFieldDescriptor",{key:field.key,group:field.group,consumer:field.consumer,writable:true}),field.scope+":"+field.key);
});

test('organization brand colors validate exact hex or null and cannot appear in center settings',()=>{
 const props=p.$defs.OrganizationSettingsValues.properties;
 assert(valid('OrganizationSettingsValues',{description:'Legacy history'}));assert(valid('OrganizationSettingsValues',{primary_color:null}));
 for(const key of ['primary_color','secondary_color','accent_color']){
  const check=a.compile(props[key]);for(const value of [null,'#123456','#aBcDeF','#000000'])assert(check(value));
  for(const value of ['', '#fff','#12345678',' #123456','#12345G',12])assert.equal(check(value),false);
  assert.equal(p.$defs.CenterSettingsValues.properties[key],undefined);
 }
 assert.deepEqual(props.theme_package_id,{type:'null'});assert.deepEqual(props.font_package_id,{type:'null'});
});

test('person access discovery has exclusive typed selectors',()=>{
 for(const op of ['account_access_revoke_v1','account_link_remove_v1']){
  assert(valid('ManagementSelector_'+op,{operation:op,key:{person_id:id}}));
  assert(!valid('ManagementSelector_'+op,{operation:op,key:{}}));
  assert(!valid('ManagementSelector_'+op,{operation:op,key:{person_id:id,...(op==='account_access_revoke_v1'?{invitation_id:id}:{link_id:id})}}));
 }
});
test('instructor revoke requires a typed impact preview and manager attention is separate from session lifecycle',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,center_id:id,assignment_id:id,expected_version:1};
 assert(valid('Request_role_revoke_preview',r));
 assert(!valid('Request_role_revoke_preview',{...r,center_id:null}));
 assert(valid('Request_role_revoke',{...r,operation_key:id,reason:'Explicit confirmation',impact_approval:{id,token:'a'.repeat(64)}}));
 const interval={starts_at:'2030-01-01T00:00:00Z',ends_at:'2030-02-01T00:00:00Z'};
 assert(valid('Request_calendar_get',{client_api_version:1,request_id:id,org_id:id,center_id:id,interval,page:{},needs_instructor:true}));
 assert(valid('CalendarItem',{id,type:'session',center_id:id,...interval,discipline_id:id,title:'Synthetic',management_attention:'instructor_required'}));
 assert(!valid('CalendarItem',{id,type:'session',center_id:id,...interval,discipline_id:id,title:'Synthetic',management_attention:'unknown'}));
});

test('unassigned session work list has no calendar horizon and requires explicit center',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation:'session_assignment_set_v1',selector:{operation:'session_assignment_set_v1',key:{}},page:{sort:'starts_at_asc'}};
 assert(valid('Request_management_state_get',r));assert(!valid('Request_management_state_get',{...r,center_id:null}));
 assert(p['x-contract'].operations.find(o=>o.name==='management_state_get_v1').runtime_selectors.includes('session_assignment_set_v1'));
});

test('operational student views expose optional org subscriber numbers without accepting them as command identities',()=>{
 for(const name of ['ReservationView','AttendanceEntryView','EntitlementView','FinanceView','NegativeLimitsView','RoleView','ClassAssignmentView','ProtectedObligationView','LessonRequestView','SeatOfferView','WaitlistEntryView']){
  assert.deepEqual(p.$defs[name].properties.subscriber_number,p.$defs.PersonSummary.properties.subscriber_number,name);
 }
 const base={id,session_id:id,person_id:id,state:'active',mode:'flexible',version:1};
 assert(valid('ReservationView',{...base,subscriber_number:'1001'}));
 assert(valid('ReservationView',{...base,subscriber_number:null}));
 assert(!valid('ReservationView',{...base,subscriber_number:'student-1001'}));
 assert(!valid('Request_reservation_create',{client_api_version:1,request_id:id,operation_key:id,org_id:id,center_id:id,session_id:id,subscriber_number:'1001',mode:'flexible'}));
});

test('offline instructor membership uses the canonical role without granting an account capability',()=>{
 const role={id,created_at:'2026-11-02T00:00:00Z',org_id:id,person_id:id,role:'instructor',scope_center_id:id,state:'active',account_link_id:null};
 assert.equal(valid('Table_role_assignments',role),true);
 const relationship={id,created_at:'2026-11-02T00:00:00Z',org_id:id,center_id:id,person_id:id,kind:'student',state:'active',started_at:'2026-11-02T00:00:00Z'};
 assert.equal(valid('Table_center_relationships',relationship),true);
 assert.equal(valid('Table_center_relationships',{...relationship,kind:'instructor',state:'inactive'}),false);
 assert.equal(valid('RelationshipView',{center_id:id,kind:'instructor',state:'inactive'}),true);
});

test('subscription period changes require explicit accepted terms and expose a versioned billing read',()=>{
 const operation=p['x-contract'].operations.find(o=>o.name==='subscription_period_change_request_v1');
 assert(operation,'period changes must be a callable owner operation');
 assert.equal(operation.permission,'subscription.owner');assert.equal(operation.billing_class,'exempt');
 const body={client_api_version:1,request_id:id,org_id:id,operation_key:id,target_plan_id:id,expected_version:3,amount_minor:'12000',currency:'TRY',effective_at:'2027-01-01T00:00:00Z'};
 assert(valid('Request_subscription_period_change_request',body));
 for(const field of ['expected_version','amount_minor','currency','effective_at']){const incomplete={...body};delete incomplete[field];assert(!valid('Request_subscription_period_change_request',incomplete));}
 assert(!valid('Request_subscription_period_change_request',{...body,amount_minor:12000}));
 const terms={id,period:'yearly',amount_minor:'12000',currency:'TRY'};
 assert(valid('SubscriptionBillingView',{current:terms,period_change_options:[terms],pending_period_change:{id,version:1,target:terms,effective_at:body.effective_at}}));
 assert(!valid('SubscriptionBillingView',{current:terms,period_change_options:[],pending_period_change:{id,target:terms,effective_at:body.effective_at}}));
});

test('schedule configuration requirements identify the first blocker without extending generic errors',()=>{
 const requirement={blocker_index:0,kind:'instructor_agreement',person_id:id,discipline_id:id,format:'group',starts_at:'2027-01-04T09:00:00Z'};
 assert(p.$defs.ScheduleConfigurationRequirement);
 assert(valid('ScheduleConfigurationRequirement',requirement));
 assert(!valid('ScheduleConfigurationRequirement',{...requirement,kind:'arbitrary_policy'}));
 assert(!valid('ScheduleConfigurationRequirement',{...requirement,blocker_index:1}));
 assert(!valid('ScheduleConfigurationRequirement',{...requirement,terms:{amount_minor:'1'}}));
 const preview={id,token:'synthetic-preview-token',scope_hash:'synthetic-scope',dependencies:{versions:[],policy_hashes:[],permission_hash:'permission'},effects:[],blockers:[{code:'POLICY_NOT_CONFIGURED',retryable:false,trace_id:id}],expires_at:'2027-01-04T10:00:00Z',configuration_requirement:requirement};
 assert(valid('Preview',preview));
 assert(!valid('Preview',{...preview,blockers:[]}));
 assert(!valid('Preview',{...preview,blockers:[{...preview.blockers[0],code:'RESOURCE_CONFLICT'}]}));
 assert(!valid('SafeError',{...preview.blockers[0],configuration_requirement:requirement}));
});

test('commercial limits distinguish explicit unlimited from finite usage without numeric sentinels',()=>{
 assert(valid('PlanLimit',{key:'rooms',unlimited:true}));
 assert(valid('PlanLimit',{key:'instructors',unlimited:true}));
 assert(valid('PlanLimit',{key:'active_students',value:250}));
 assert(!valid('PlanLimit',{key:'rooms',unlimited:true,value:0}));
 assert(!valid('PlanLimit',{key:'rooms',unlimited:false}));
 assert(!valid('PlanLimit',{key:'centers',unlimited:true}));
 assert(valid('PlanUsage',{entries:[{key:'rooms',value:2}]}));
 assert(!valid('PlanUsage',{entries:[{key:'rooms',unlimited:true}]}));
});

test('class duty management requires explicit center scope and exposes assignment selector values',()=>{
 const op=p['x-contract'].operations.find(x=>x.name==='class_assignment_set_v1');
 assert.equal(op.operation_contract.read_path_status,'implemented');
 assert(p['x-contract'].operations.find(x=>x.name==='management_state_get_v1').runtime_selectors.includes('class_assignment_set_v1'));
 const request={client_api_version:1,request_id:id,org_id:id,center_id:id,operation:'class_assignment_set_v1',selector:{operation:'class_assignment_set_v1',key:{class_id:id,person_id:id,duty:'instructor'}}};
 assert(valid('Request_management_state_get',request));
 const {center_id,...unscoped}=request;assert(!valid('Request_management_state_get',unscoped));
 assert(valid('ManagementProjection_class_assignment_set_v1',{operation:'class_assignment_set_v1',values:request.selector.key}));
 assert(!valid('ManagementProjection_class_assignment_set_v1',{operation:'class_assignment_set_v1',values:{}}));
});

test('class duty management migration matches its reviewed native source',()=>{
 const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_class_duty_management.sql'));
 assert(migration);assert.equal(fs.readFileSync('supabase/migrations/'+migration,'utf8'),fs.readFileSync('database/class-duty-management.sql','utf8'));
});

test('P12 event capacity is explicitly finite or unlimited without changing lesson capacity',()=>{
 assert(valid('EventCapacity',{nominal:4,maximum:4}));
 assert(valid('EventCapacity',{kind:'unlimited'}));
 assert(!valid('EventCapacity',{kind:'unlimited',nominal:0,maximum:0}));
 assert(!valid('Capacity',{kind:'unlimited'}));
 assert(!valid('EventCapacity',{nominal:null,maximum:null}));
});
test('P13 package eligibility mode and factual ineligible attendance are closed typed inputs',()=>{
 const terms={fee_minor:'0',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[id],cancellation:{before_cutoff:'release',after_cutoff:'release',no_show:'release'},refund:{method:'none'},package_usage:'eligibility_only'};
 assert(valid('EventTerms',terms));
 assert(!valid('EventTerms',{...terms,package_usage:'unknown'}));
 const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,registration_id:id,expected_version:1,result:'attended',record_ineligible_attendance:true,reason:'Observed actual attendance'};
 assert(valid('Request_event_attendance_mark',r));
 assert(!valid('Request_event_attendance_mark',{...r,reason:undefined}));
});

test('P05 Starter basic CRM is explicit and person-only followups retain the advanced gate',()=>{
 const f=p['x-contract'].feature_delivery.F21;
 assert.equal(f.plans.starter,true);
 assert.equal(f.plan_scope.starter,'Temel aday takibi');
 const activity=p['x-contract'].operations.find(o=>o.name==='crm_activity_save_v1');
 assert.deepEqual(activity.runtime_required_features,['F21']);
 assert(activity.conditional_features.some(v=>v.feature==='F23'&&v.when==='person_only_followup'));
 const scope=p['x-contract'].starter_plan_policy.basic_crm;
 assert.deepEqual(scope.operations,['leads_list_v1','lead_save_v1','crm_activity_save_v1']);
 assert.equal(scope.activity_target,'lead_only');
 assert.equal(scope.read_operation,'management_state_get_v1');
 assert.deepEqual(scope.sources,['manual','phone','whatsapp']);
 assert.equal(fs.readFileSync('database/starter-basic-crm.sql','utf8'),fs.readFileSync('supabase/migrations/20261104111220_starter_basic_crm.sql','utf8'));
});

import './crm-meta-queue-unit.mjs';

import './crm-provider-host-unit.mjs';
import './crm-provider-host-db-unit.mjs';

import './crm-import-parser-unit.mjs';

test('XREQ-020 normal sale response requires authoritative debt/rights/deficit projection',()=>{
 const schema=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(schema,'sale-contract');const validate=ajv.getSchema('sale-contract#/$defs/Success_sale_preview');
 const data={id:newUuidV7(),token:'synthetic-token',scope_hash:'synthetic-hash',dependencies:{versions:[],policy_hashes:[],permission_hash:'synthetic'},effects:[],blockers:[],expires_at:new Date().toISOString(),sale:{person_id:newUuidV7(),product_version_id:newUuidV7(),kind:'credits',booking_mode:'flexible',start_date:'2026-11-01',end_date:'2026-12-01',timezone:'Europe/Istanbul',valid_from:'2026-10-31T21:00:00Z',valid_until:'2026-11-30T21:00:00Z',debt_minor:'1700',currency:'TRY',granted:5,reserved:2,consumed:2,available:1,quota:null,deficits:[{deficit_id:newUuidV7(),reservation_id:newUuidV7(),session_id:newUuidV7(),version:1,reservation_version:1,session_version:1,state:'consumed',quantity:2,settles:true}]}};
 const response={ok:true,data,trace_id:newUuidV7()};assert.equal(validate(response),true,JSON.stringify(validate.errors));
 for(const mutate of [x=>delete x.data.sale,x=>delete x.data.sale.deficits[0].reservation_version,x=>x.data.sale.debt_minor=1700,x=>x.data.sale.available=-1,x=>x.data.sale.deficits[0].settles='true',x=>x.data.sale.extra='untrusted']){const bad=structuredClone(response);mutate(bad);assert.equal(validate(bad),false);}
 const generic=ajv.getSchema('sale-contract#/$defs/Preview'),legacy=structuredClone(data);delete legacy.sale;assert.equal(generic(legacy),true,'Other preview consumers retain their existing shape');
});

test('XREQ-021 catalogs are closed optional lesson-request selectors with minimal display fields',()=>{
 const schema=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(schema,'catalog');const selector=ajv.getSchema('catalog#/$defs/ManagementSelector_lesson_request_create_v1'),projection=ajv.getSchema('catalog#/$defs/ManagementProjection_lesson_request_create_v1');
 const value={operation:'lesson_request_create_v1',key:{person_id:newUuidV7(),catalog:'disciplines'}};assert(selector(value));assert(selector({...value,key:{person_id:value.key.person_id}}));assert(!selector({...value,key:{...value.key,catalog:'contacts'}}));
 const item={operation:'lesson_request_create_v1',values:{discipline_id:newUuidV7(),display_name:'Synthetic discipline'}};assert(projection(item));assert(!projection({...item,values:{...item.values,email:'private@example.invalid'}}));
});

test('upper-plan person projections preserve the nullable decimal subscriber identifier',()=>{
 for(const name of ['EarningView','LeadView','EventRegistrationView','EventDutyView','EventPaymentPreparationView','AgreementVersionView','SettlementAuthorityView','CrmFollowupView']){
  assert.deepEqual(p.$defs[name].properties.subscriber_number,p.$defs.PersonSummary.properties.subscriber_number,name);
  assert(!p.$defs[name].required.includes('subscriber_number'),`${name}: additive response field`);
 }
});

test('action discovery declares six supported typed management selectors without inventing write values',()=>{
 const op=p['x-contract'].operations.find(x=>x.name==='management_state_get_v1');
 for(const name of ['collection_record_v1','reservation_capacity_override_v1','student_credit_refund_v1','student_credit_offset_v1','debt_adjust_v1','sale_refund_preview_v1']){
  assert(op.runtime_selectors.includes(name),name);
  assert(valid('ManagementProjection_'+name,{operation:name,values:{}}));
 }
});
