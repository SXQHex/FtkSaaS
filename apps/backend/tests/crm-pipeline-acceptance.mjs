import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('S10 CRM pipeline settings drive real leads without creating students, finance or consent',async t=>{
 const guard=resources(t),{platform,plan}=await fixturePlatform(),owner=await authUser('pipeline-owner'),other=await authUser('pipeline-other');
 const db=await guard.connect(context().env.DB_URL),account=await must(owner,'account_get_v1');await must(other,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Pipeline settings',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Pipeline center',timezone:'UTC'},key())).primary_id;
 const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 const scope={org_id:org,center_id:center},oq={scope:'organization',org_id:org},cq={scope:'center',...scope};
 const api=(op,b={},k=key())=>must(owner,op,{...scope,...b},k);
 const denied=async(code,op,b={},u=owner,k=key())=>{const r=await call(u,op,{...scope,...b},k);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);};
 const settings=q=>must(owner,'settings_get_v1',q);
 const patch=async(q,value)=>must(owner,'settings_update_v1',{...q,expected_version:(await settings(q)).version,patch:value},key());
 const list=(include=true)=>api('leads_list_v1',{page:{},...(include?{include_pipeline:true}:{})});
 let lead,target,config,oldKey,oldBody;
 await api('center_manager_assign_v1',{person_id:person});
 const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic',occurred_at:new Date().toISOString()});await must(platform,'saas_payment_verify_v1',{...scope,payment_id:payment.primary_id,accepted:true},key());
 await t.test('legacy requests retain their response shape and six accepted stages are discoverable',async()=>{
  target=(await api('person_create_v1',{display_name:'Pipeline applicant',contacts:[]})).primary_id;
  lead=(await api('lead_save_v1',{person_id:target,source:'manual',interest:'Dance'})).primary_id;
  const legacy=await list(false);assert.equal('pipeline_catalog' in legacy,false);assert.equal('pipeline' in legacy.items[0],false);
  const current=await list();config=current.pipeline_catalog;assert.deepEqual(config.stages.map(s=>s.key),['new','contacted','scheduled','considering','won','lost']);assert.equal(current.items[0].pipeline,null);
  await denied('NOT_FOUND','leads_list_v1',{page:{},include_pipeline:true},other);
 });
 await t.test('organization stages and explicitly allowed center tags have separate live authority',async()=>{
  const catalog=await must(owner,'settings_catalog_get_v1',cq);assert.equal(catalog.fields.find(f=>f.key==='crm_local_tags').writable,false);
  await denied('FORBIDDEN','settings_update_v1',{scope:'center',expected_version:(await settings(cq)).version,patch:{crm_local_tags:[]}});
  config={...config,stages:[...config.stages.slice(0,2),{key:'callback',name:'Tekrar ara',kind:'open'},...config.stages.slice(2)],tags:[{key:'warm',name:'İlgili'}],allow_center_tags:true};
  await patch(oq,{crm_pipeline:config});await patch(cq,{crm_local_tags:[{key:'evening',name:'Akşam'}]});
  const read=await list();assert(read.pipeline_catalog.stages.some(s=>s.key==='callback'));assert.deepEqual(read.pipeline_catalog.tags.map(x=>x.key),['warm','evening']);
  await denied('NOT_FOUND','settings_update_v1',{scope:'organization',center_id:undefined,expected_version:(await settings(oq)).version,patch:{crm_pipeline:config}},other);
  await denied('VALIDATION_FAILED','settings_update_v1',{scope:'organization',center_id:undefined,expected_version:(await settings(oq)).version,patch:{crm_pipeline:{...config,stages:[...config.stages,config.stages[0]]}}});
  await denied('VALIDATION_FAILED','settings_update_v1',{scope:'center',expected_version:(await settings(cq)).version,patch:{crm_local_tags:[{key:'warm',name:'Collision'}]}});
 });
 await t.test('lost reason is mandatory and won neither activates a student nor creates a sale',async()=>{
  const base={lead_id:lead,person_id:target,expected_version:(await list()).items[0].version,source:'manual',interest:'Dance'};
  await denied('VALIDATION_FAILED','lead_save_v1',{...base,pipeline:{stage_key:'lost',tag_keys:[],loss_reason:null}});
  oldKey=key();oldBody={...base,pipeline:{stage_key:'callback',tag_keys:['warm','evening'],loss_reason:null}};
  await api('lead_save_v1',oldBody,oldKey);assert.equal((await api('lead_save_v1',oldBody,oldKey)).replayed,true);
  const read=(await list()).items[0];assert.equal(read.pipeline.stage.key,'callback');assert.equal(read.pipeline.tags.length,2);
  await api('lead_save_v1',{...base,expected_version:read.version,pipeline:{stage_key:'won',tag_keys:['warm','evening'],loss_reason:null}});
  const won=(await list()).items[0];assert.equal(won.pipeline.stage.kind,'won');assert.equal(won.state,'open');
  assert.equal((await db.query("select count(*)::int n from core.center_relationships where org_id=$1 and person_id=$2 and kind='student'",[org,target])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from core.sales where org_id=$1 and person_id=$2',[org,target])).rows[0].n,0);
  await api('lead_save_v1',{...base,expected_version:won.version,pipeline:{stage_key:'lost',tag_keys:['warm','evening'],loss_reason:'price'}});
  assert.equal((await list()).items[0].pipeline.loss_reason,'price');
 });
 await t.test('in-use tags require explicit remapping; reset and old receipt cannot restore a removed stage',async()=>{
  await denied('INVALID_STATE_TRANSITION','settings_update_v1',{scope:'organization',center_id:undefined,expected_version:(await settings(oq)).version,patch:{crm_pipeline:{...config,tags:[]}}});
  await denied('INVALID_STATE_TRANSITION','settings_update_v1',{scope:'organization',center_id:undefined,expected_version:(await settings(oq)).version,patch:{crm_pipeline:{...config,allow_center_tags:false}}});
  const v=(await list()).items[0];await api('lead_save_v1',{lead_id:lead,person_id:target,expected_version:v.version,source:'manual',interest:'Dance',pipeline:{stage_key:'callback',tag_keys:[],loss_reason:null}});
  await denied('INVALID_STATE_TRANSITION','settings_reset_preview_v1',{...oq,center_id:undefined,fields:['crm_pipeline']});
  const current=(await list()).items[0];await api('lead_save_v1',{lead_id:lead,person_id:target,expected_version:current.version,source:'manual',interest:'Dance',pipeline:{stage_key:'new',tag_keys:[],loss_reason:null}});
  const preview=await must(owner,'settings_reset_preview_v1',{...oq,fields:['crm_pipeline']});
  const defaultStage=(await list()).items[0];await api('lead_save_v1',{lead_id:lead,person_id:target,expected_version:defaultStage.version,source:'manual',interest:'Dance',pipeline:{stage_key:'callback',tag_keys:[],loss_reason:null}});
  await denied('INVALID_STATE_TRANSITION','settings_reset_apply_v1',{...oq,center_id:undefined,expected_version:preview.version,preview:{id:preview.id,token:preview.token}});
  const changed=(await list()).items[0];await api('lead_save_v1',{lead_id:lead,person_id:target,expected_version:changed.version,source:'manual',interest:'Dance',pipeline:{stage_key:'new',tag_keys:[],loss_reason:null}});
  config={...config,stages:config.stages.filter(s=>s.key!=='callback')};await patch(oq,{crm_pipeline:config});
  await denied('NOT_FOUND','lead_save_v1',oldBody,owner,oldKey);
  assert.equal((await list()).items[0].pipeline.stage.key,'new');
 });
 await t.test('version races and late audit failure preserve a single atomic pipeline result',async()=>{
  const before=(await list()).items[0],base={...scope,lead_id:lead,person_id:target,expected_version:before.version,source:'manual',interest:'Dance'};
  const attempts=await Promise.all(['contacted','considering'].map(stage_key=>call(owner,'lead_save_v1',{...base,pipeline:{stage_key,tag_keys:[],loss_reason:null}},key())));
  assert.equal(attempts.filter(x=>x.result.ok).length,1);assert.equal(attempts.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');
  const current=(await list()).items[0],trigger='pipeline_fault_'+key().replaceAll('-','');
  await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='lead_save_v1' then raise exception using errcode='23514',message='synthetic pipeline audit failure';end if;return new;end$$`);
  await db.query(`create trigger ${trigger} before insert on core.audit_events for each row execute function private.${trigger}()`);
  try{await denied('INTEGRITY_VIOLATION','lead_save_v1',{...base,expected_version:current.version,pipeline:{stage_key:'lost',tag_keys:[],loss_reason:'other'}});assert.deepEqual((await list()).items[0],current);}
  finally{await db.query(`drop trigger ${trigger} on core.audit_events`);await db.query(`drop function private.${trigger}()`);}
 });
 await t.test('converted history retains its original stage and tag snapshot after catalog key reuse',async()=>{
  const current=(await list()).items[0];
  await api('lead_save_v1',{lead_id:lead,person_id:target,expected_version:current.version,source:'manual',interest:'Dance',pipeline:{stage_key:'lost',tag_keys:['warm'],loss_reason:'price'}});
  const snapshot=(await list()).items[0].pipeline;
  await api('lead_convert_v1',{lead_id:lead});
  config={...config,stages:config.stages.map(s=>s.key==='lost'?{...s,name:'Reused semantic key',kind:'won'}:s.key==='won'?{...s,kind:'lost'}:s),tags:[]};
  await patch(oq,{crm_pipeline:config});
  const converted=(await list()).items[0];assert.equal(converted.state,'converted');assert.deepEqual(converted.pipeline,snapshot);
 });
});
