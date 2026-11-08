import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('S10 agreement templates prepare explicit immutable publications with live plan and center authority',{timeout:300000},async()=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('agreement-preparation'),other=await authUser('agreement-preparation-outsider');
 const account=await must(owner,'account_get_v1');await must(other,'account_get_v1');const db=await connect();
 try{
  await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic agreement preparation',initial_plan_id:plan},key())).primary_id;
  const api=(op,b={},k=key(),u=owner)=>must(u,op,{org_id:org,...b},k);
  const denied=async(code,op,b,k=key(),u=owner)=>{const r=await call(u,op,{org_id:org,...b},k);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);};
  const center=(await api('center_create_v1',{name:'Preparation center',timezone:'UTC'})).primary_id;
  const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await api('center_manager_assign_v1',{center_id:center,person_id:person});
  const payment=(await api('saas_payment_submit_v1',{center_id:center,amount_minor:'1000',currency:'TRY',reference:'Synthetic agreement preparation',occurred_at:new Date().toISOString()})).primary_id;
  await api('saas_payment_verify_v1',{payment_id:payment,accepted:true},key(),platform);
  const discipline=(await api('discipline_save_v1',{name:'Synthetic preparation discipline',state:'active'})).primary_id;
  await api('center_discipline_set_v1',{center_id:center,discipline_id:discipline,state:'active'});
  await api('role_assign_v1',{center_id:center,person_id:person,role:'instructor',scope:{center_id:center}});
  const terms={model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'25000'}],room_fee:{kind:'free',order:'after_instructor_share'}};
  const template={key:'fixed',name:'Synthetic explicit fee',discipline_id:discipline,format:'group',terms};
  const q={scope:'organization'},read=()=>api('settings_get_v1',q);
  let v=await read();const save={...q,expected_version:v.version,patch:{agreement_templates:[template]}},saveKey=key();
  await api('settings_update_v1',save,saveKey);assert.equal((await api('settings_update_v1',save,saveKey)).replayed,true);
  const catalog=await api('settings_catalog_get_v1',{scope:'center',center_id:center});
  const selected=catalog.preparation_templates.agreements.find(x=>x.template.key==='fixed'&&x.source.scope==='organization');assert(selected);assert.deepEqual(selected.template,template);
  const request={center_id:center,kind:'agreement',source:selected.source};
  const count=async()=>Number((await db.query('select count(*)::int n from core.instructor_agreements where org_id=$1',[org])).rows[0].n);
  const effects=async()=>{
   const result={};for(const table of ['operation_receipts','audit_events','notifications','earnings','previews'])result[table]=Number((await db.query('select count(*)::int n from core.'+table+' where org_id=$1',[org])).rows[0].n);return result;
  };
  const before=await count(),priorEffects=await effects(),resolved=await api('settings_preparation_resolve_v1',request);assert.deepEqual(resolved.agreement_request,{discipline_id:discipline,format:'group',terms});assert.equal(await count(),before);assert.deepEqual(await effects(),priorEffects);
  await denied('NOT_FOUND','settings_preparation_resolve_v1',request,key(),other);
  await denied('VERSION_CONFLICT','settings_preparation_resolve_v1',{...request,source:{...selected.source,version:0}});
  await denied('NOT_FOUND','settings_preparation_resolve_v1',{...request,source:{...selected.source,key:'missing'}});
  await denied('NOT_FOUND','settings_preparation_resolve_v1',{...request,source:{scope:'center',key:'fixed',version:0,center_id:key()}});
  v=await read();await denied('VALIDATION_FAILED','settings_update_v1',{...q,expected_version:v.version,patch:{agreement_templates:[template,template]}});
  await denied('VALIDATION_FAILED','settings_update_v1',{...q,expected_version:v.version,patch:{agreement_templates:[{...template,terms:{...terms,model:'percentage'}}]}});
  await denied('NOT_FOUND','settings_update_v1',{...q,expected_version:v.version,patch:{agreement_templates:[{...template,discipline_id:key()}]}});
  await denied('NOT_FOUND','settings_update_v1',{...q,expected_version:v.version,patch:{agreement_templates:[{...template,terms:{...terms,package_overrides:[{product_id:key(),components:[{kind:'per_person',amount_minor:'100'}]}]}}]}});
  const published=(await api('instructor_agreement_publish_v1',{center_id:center,person_id:person,...resolved.agreement_request,reason:'Explicit synthetic publication',valid:{starts_at:'2030-01-01T00:00:00Z',ends_at:'2031-01-01T00:00:00Z'}})).primary_id;
  assert.equal(await count(),before+1);
  v=await read();await api('settings_update_v1',{...q,expected_version:v.version,patch:{agreement_templates:[{...template,name:'Changed preparation',terms:{...terms,components:[{kind:'session_fixed',amount_minor:'30000'}]}}]}});
  await denied('VERSION_CONFLICT','settings_preparation_resolve_v1',request);
  assert.deepEqual((await db.query('select terms from core.instructor_agreements where id=$1',[published])).rows[0].terms,terms);
  const cq={scope:'center',center_id:center},cv=await api('settings_get_v1',cq),local={...cq,expected_version:cv.version,patch:{agreement_templates:[template]}},localKey=key();
  await api('settings_update_v1',local,localKey);const localRead=await api('settings_get_v1',cq);assert.deepEqual(localRead.values.agreement_templates,[template]);
  const reset=await api('settings_reset_preview_v1',{...cq,fields:['agreement_templates']});assert.deepEqual(reset.after.agreement_templates,[]);
  await api('settings_reset_apply_v1',{...cq,expected_version:reset.version,preview:{id:reset.id,token:reset.token}});
  assert.deepEqual((await api('settings_get_v1',cq)).values.agreement_templates,[]);assert.equal(await count(),before+1);
  const currentCatalog=await api('settings_catalog_get_v1',cq),currentSource=currentCatalog.preparation_templates.agreements.find(x=>x.source.scope==='organization').source;
  await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);
  assert.equal((await api('settings_preparation_resolve_v1',{...request,source:currentSource})).agreement_request.terms.components[0].amount_minor,'30000');
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  await denied('PLAN_FEATURE_UNAVAILABLE','settings_preparation_resolve_v1',{...request,source:currentSource});
  await denied('PLAN_FEATURE_UNAVAILABLE','settings_update_v1',save,saveKey);
  const starterCatalog=await api('settings_catalog_get_v1',cq);assert.equal(starterCatalog.fields.find(f=>f.key==='agreement_templates').writable,false);assert.deepEqual(starterCatalog.preparation_templates.agreements,[]);
  await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
  const role=(await db.query("select version from core.role_assignments where org_id=$1 and scope_center_id=$2 and person_id=$3 and role='center_manager' and state='active'",[org,center,person])).rows[0];
  await api('center_manager_revoke_v1',{center_id:center,person_id:person,expected_version:Number(role.version),reason:'Synthetic preparation authority revocation'});
  await denied('FORBIDDEN','settings_preparation_resolve_v1',{...request,source:currentSource});
  await denied('FORBIDDEN','settings_update_v1',local,localKey);
  assert.equal(await count(),before+1);
 }finally{await db.end();}
});

test('Pro workflow templates resolve real versioned defaults without creating domain actions',{timeout:300000},async t=>{
 const {preparationFixture}=await import('./starter-preparation-fixture.mjs');
 const f=await preparationFixture({schedule:true}),{db,org,center,owner,plan}=f;t.after(()=>db.end());
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
 const api=(op,b={},k=key())=>must(owner,op,{org_id:org,...b},k);
 const denied=async(code,op,b)=>{const r=await call(owner,op,{org_id:org,...b},key());assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);};
 const q={scope:'organization'},cq={scope:'center',center_id:center};
 const templates={
  program_templates:[{key:'weekly',name:'Weekly class',defaults:{weekdays:[1,3],local_start:'10:00:00',duration_minutes:50,capacity:{total:8}}}],
  event_templates:[{key:'event',name:'Explicit event',defaults:{capacity:{nominal:20,maximum:20},terms:{fee_minor:'0',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[],cancellation:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'},refund:{method:'none'}}}}],
  collection_templates:[{key:'cash',name:'Cash in TRY',defaults:{currency:'TRY',payment_method:'cash'}}],
  crm_templates:[{key:'manual',name:'Incoming enquiry',defaults:{source:'manual',interest:'Explicit class interest'}}],
  automation_templates:[{key:'inactive',name:'Inactive followup',defaults:{trigger:{kind:'student_inactive',offset_days:7},action:{kind:'create_followup',channel:'in_app',template_key:'crm_followup'}}}]
 };
 const before=(await api('settings_get_v1',q)).version;
 await denied('VALIDATION_FAILED','settings_update_v1',{...q,expected_version:before,patch:{program_templates:[{...templates.program_templates[0],defaults:{...templates.program_templates[0].defaults,local_start:'99:99:99'}}]}});
 await api('settings_update_v1',{...q,expected_version:before,patch:templates});
 const counts=async()=>{const out={};for(const name of ['automations','outbox_jobs','program_versions','events','cash_movements','leads','operation_receipts'])out[name]=Number((await db.query('select count(*)::int n from core.'+name+' where org_id=$1',[org])).rows[0].n);return out;};
 await api('instructor_agreement_publish_v1',{center_id:center,person_id:f.person,discipline_id:f.discipline,format:'group',terms:{model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'10000'}],room_fee:{kind:'free',order:'before_instructor_share'}},valid:{starts_at:new Date(Date.now()-86400000).toISOString(),ends_at:new Date(Date.now()+60*86400000).toISOString()},reason:'Explicit synthetic program preparation agreement'});
 const effects=await counts(),catalog=await api('settings_catalog_get_v1',cq),resolved={};
 for(const [kind,plural] of [['program','programs'],['event','events'],['collection','collections'],['crm','crm'],['automation','automations']]){
  const chosen=catalog.preparation_templates[plural].find(x=>x.source.scope==='organization');assert(chosen);
  const r=await api('settings_preparation_resolve_v1',{center_id:center,kind,source:chosen.source});resolved[kind]=r;
  assert.deepEqual(r.defaults,templates[kind+'_templates'][0].defaults);
  await denied('VERSION_CONFLICT','settings_preparation_resolve_v1',{center_id:center,kind,source:{...chosen.source,version:0}});
 }
 assert.deepEqual(await counts(),effects);
 const program=await api('program_preview_v1',{center_id:center,class_id:f.classId,schedule:{...resolved.program.defaults,room_id:f.room,assignments:[{person_id:f.person,duty:'instructor'}],starts_on:f.day(2),ends_on:f.day(16)}});assert(program.id);assert.equal((await db.query('select count(*)::int n from core.program_versions where org_id=$1',[org])).rows[0].n,effects.program_versions);
 const cv=await api('settings_get_v1',cq);await api('settings_update_v1',{...cq,expected_version:cv.version,patch:{},inherit_fields:['event_templates','collection_templates','crm_templates','automation_templates']});
 const inherited=await api('settings_get_v1',cq);assert.equal(inherited.inherited_fields.crm_templates.kind,'organization_inherited');assert.deepEqual(Object.keys(inherited.inherited_fields).sort(),['event_templates','collection_templates','crm_templates','automation_templates'].sort());
 const oldSource=(await api('settings_catalog_get_v1',cq)).preparation_templates.crm.find(x=>x.source.scope==='center').source;
 const ov=await api('settings_get_v1',q);await api('settings_update_v1',{...q,expected_version:ov.version,patch:{crm_templates:[{...templates.crm_templates[0],name:'Changed shared draft'}]}});
 await denied('VERSION_CONFLICT','settings_preparation_resolve_v1',{center_id:center,kind:'crm',source:oldSource});
 await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);
 const created=(await api('center_create_v1',{name:'Program startup copy',timezone:'UTC'})).primary_id;
 await api('center_manager_assign_v1',{center_id:created,person_id:f.person});
 assert.deepEqual((await api('settings_get_v1',{scope:'center',center_id:created})).values.program_templates,templates.program_templates);
 await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
 await denied('PLAN_FEATURE_UNAVAILABLE','settings_preparation_resolve_v1',{center_id:center,kind:'program',source:resolved.program.source});
 assert.equal((await api('settings_catalog_get_v1',cq)).fields.find(x=>x.key==='program_templates').writable,false);
});

test('Instructor accepts the exact frontend agreement text bound to immutable backend terms',{timeout:300000},async t=>{
 const {preparationFixture}=await import('./starter-preparation-fixture.mjs');const {createHash}=await import('node:crypto');
 const {db,org,center,owner,student,studentPerson,plan}=await preparationFixture({studentUser:true,studentMembership:true});t.after(()=>db.end());
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
 const api=(op,b={},u=owner,k=key())=>must(u,op,{org_id:org,center_id:center,...b},k);
 const deny=async(code,op,b,u=owner,k=key())=>{const r=await call(u,op,{org_id:org,center_id:center,...b},k);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);};
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Digital agreement',state:'active'},key())).primary_id;await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 await api('role_assign_v1',{person_id:studentPerson,role:'instructor',scope:{center_id:center}});
 const terms={model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'20000'}],room_fee:{kind:'free',order:'before_instructor_share'}};
 const agreement=(await api('instructor_agreement_publish_v1',{person_id:studentPerson,discipline_id:discipline,format:'group',terms,valid:{starts_at:'2030-01-01T00:00:00Z',ends_at:'2031-01-01T00:00:00Z'},reason:'Synthetic digital agreement'})).primary_id;
 const management=await api('management_state_get_v1',{operation:'instructor_agreement_accept_v1',selector:{operation:'instructor_agreement_accept_v1',key:{agreement_id:agreement}}},student);assert.equal(management.items[0].versions[0].version,1);
 const read=()=>api('instructor_agreement_get_v1',{agreement_id:agreement},student),initial=await read();assert.equal(initial.acceptance,null);assert.deepEqual(initial.agreement.terms,terms);
 const displayed={name:'Instructor agreement',language:'en',template_id:'instructor',template_version:'1',text:'Instructor agreement\nSession fee: TRY 200.00\nI accept.\n'},hash=createHash('sha256').update(displayed.text).digest('hex');
 const b={agreement_id:agreement,expected_version:initial.agreement.version,source_content_hash:initial.source_content_hash,displayed_content:displayed,displayed_content_hash:hash};
 await deny('FORBIDDEN','instructor_agreement_accept_v1',b);
 await deny('VERSION_CONFLICT','instructor_agreement_accept_v1',{...b,source_content_hash:'0'.repeat(64)},student);
 const k=key(),accepted=await api('instructor_agreement_accept_v1',b,student,k);assert.deepEqual(accepted.related,[{type:'instructor_agreements',id:agreement}]);assert.equal((await api('instructor_agreement_accept_v1',b,student,k)).replayed,true);
 assert.equal((await db.query('select state from core.operation_receipts where org_id=$1 and id=$2',[org,accepted.operation_id])).rows[0].state,'succeeded');
 assert.equal((await db.query('select count(*)::int n from private.digital_agreement_acceptances where org_id=$1 and agreement_id=$2',[org,agreement])).rows[0].n,1);
 const done=await read();assert.deepEqual(done.acceptance.displayed_content,displayed);assert.equal(done.acceptance.content_hash,hash);assert.equal(done.acceptance.source_content_hash,initial.source_content_hash);assert.equal(done.acceptance.person_id,studentPerson);assert.deepEqual(done.agreement,initial.agreement);
 assert.equal((await db.query('select count(*)::int n from core.earnings where org_id=$1',[org])).rows[0].n,0);
 await assert.rejects(db.query('delete from private.digital_agreement_acceptances where agreement_id=$1',[agreement]),/INTEGRITY_VIOLATION/);
 await db.query("update core.role_assignments set state='inactive',version=version+1 where org_id=$1 and person_id=$2 and role='instructor'",[org,studentPerson]);
 await deny('FORBIDDEN','instructor_agreement_accept_v1',b,student,k);
});
