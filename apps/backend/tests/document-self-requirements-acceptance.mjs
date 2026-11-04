import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

async function fixture(t,{starterCompatible=false}={}){
 const db=await connect(),files=[];const {platform,plan}=await fixturePlatform(),owner=await authUser('self-doc-owner'),student=await authUser('self-doc-student'),stranger=await authUser('self-doc-stranger');
 const account=await must(owner,'account_get_v1'),member=await must(student,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic self document context',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Self documents',timezone:'UTC'},key())).primary_id;
 const scope=b=>({org_id:org,center_id:center,...b}),api=(op,b={},u=owner,k=key())=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=student,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));assert.equal(r.result.data,undefined);};
 t.after(async()=>{try{if(files.length){const {env}=context(),r=await fetch(env.API_URL+'/storage/v1/object/ftksaas-documents',{method:'DELETE',headers:{apikey:env.SERVICE_ROLE_KEY,authorization:'Bearer '+env.SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({prefixes:files.map(id=>org+'/'+id)}),signal:AbortSignal.timeout(15000)});assert.equal(r.ok,true);}}finally{await db.end();}});
 const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await api('center_manager_assign_v1',{person_id:ownerPerson});
 const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic self documents',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
 const person=(await api('person_create_v1',{display_name:'Synthetic self document student',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:person});
 const link=key();await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[link,org,member.id,person]);
 let discipline;
 if(starterCompatible){discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Self document discipline',state:'active'},key())).primary_id;await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});}
 const product=(await api('product_publish_v1',{terms:{name:starterCompatible?'Self document discipline · package':'Self document package',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[starterCompatible?{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}:{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
 const quote=await api('sale_preview_v1',{person_id:person,product_version_id:product,start_date:new Date().toISOString().slice(0,10),end_date:new Date(Date.now()+7*86400000).toISOString().slice(0,10)});
 const sale=(await api('sale_apply_v1',{preview:{id:quote.id,token:quote.token}})).primary_id;
 const saleContext={gate:'sale',subject:{type:'sales',id:sale}},productContext={gate:'sale',subject:{type:'product_versions',id:product}};
 await db.query("insert into private.p05_upload_configuration values($1,65536,array['text/plain'])",[org]);
 async function publish(text,label,document){
  const bytes=Buffer.from(text),checksum=createHash('sha256').update(bytes).digest('hex');
  const f=await api('document_upload_prepare_v1',{name:'Self-only terms',mime:'text/plain',bytes:bytes.length});files.push(f.file_id);
  const {env}=context(),r=await fetch(new URL(f.upload_url,env.API_URL),{method:'PUT',headers:{apikey:env.ANON_KEY,'content-type':'text/plain'},body:bytes,signal:AbortSignal.timeout(15000)});assert.equal(r.ok,true);
  await api('file_upload_complete_v1',{file_id:f.file_id,checksum});
  const v=await api('document_version_publish_v1',{file_id:f.file_id,version_label:label,...(document?{document_id:document}:{}),scope:{kind:'center',center_id:center},requirements:[{gate:'sale',scope:{center_ids:[center],product_version_ids:[product]},renewed_acceptance:true}]});
  return {bytes,checksum,file:f.file_id,version:v.primary_id,document:v.related.find(x=>x.type==='documents').id};
 }
 return {db,api,fail,publish,person,student,owner,stranger,link,org,center,ownerPerson,saleContext,productContext,plan,discipline};
}

test('XREQ-016 self requirement and private bytes use the same person/context/version as self acceptance',{timeout:300000},async t=>{
 const f=await fixture(t),first=await f.publish('Synthetic original terms.','self-v1');
 const read=await f.api('document_requirements_get_v1',{context:f.saleContext,content_file_id:first.file},f.student);
 assert.equal(read.length,1);assert.equal(read[0].version_id,first.version);assert.equal(read[0].accepted,false);assert.deepEqual(Buffer.from(read[0].content.data,'base64'),first.bytes);
 const explicit=await f.api('document_requirements_get_v1',{person_id:f.person,context:f.saleContext},f.owner);assert.equal(explicit[0].version_id,first.version);
 await f.fail('document_requirements_get_v1',{context:f.saleContext,content_file_id:first.file},'NOT_FOUND',f.owner);
 const own=await f.api('document_requirements_get_v1',{context:f.productContext},f.owner);assert.equal(own[0].accepted,false);
 await f.fail('document_accept_v1',{document_version_id:first.version,context:{...f.saleContext,on_behalf_of_person_id:f.person}},'FORBIDDEN',f.owner);
 const acceptKey=key(),accept={document_version_id:first.version,context:f.saleContext};await f.api('document_accept_v1',accept,f.student,acceptKey);assert.equal((await f.api('document_accept_v1',accept,f.student,acceptKey)).replayed,true);
 assert.equal((await f.api('document_requirements_get_v1',{context:f.saleContext},f.student))[0].accepted,true);
 assert.equal((await f.api('document_requirements_get_v1',{context:f.productContext},f.owner))[0].accepted,false);
 const second=await f.publish('Synthetic renewed terms.','self-v2',first.document);
 const fresh=await f.api('document_requirements_get_v1',{context:f.saleContext,content_file_id:second.file},f.student);assert.equal(fresh[0].version_id,second.version);assert.equal(fresh[0].accepted,false);assert.deepEqual(Buffer.from(fresh[0].content.data,'base64'),second.bytes);
 await f.fail('document_requirements_get_v1',{context:f.saleContext,content_file_id:first.file},'NOT_FOUND');
 await f.fail('document_accept_v1',{document_version_id:first.version,context:f.saleContext},'NOT_FOUND');
 assert.equal((await f.db.query('select count(*)::int n from core.document_acceptances where org_id=$1',[f.org])).rows[0].n,1);
});

test('XREQ-016 missing or revoked self identity and wrong lifecycle/context never yield empty success or private bytes',{timeout:300000},async t=>{
 const f=await fixture(t),published=await f.publish('Synthetic lifecycle terms.','self-live');
 const body={context:f.saleContext,content_file_id:published.file};
 await f.fail('document_requirements_get_v1',body,'NOT_FOUND',f.stranger);
 await f.fail('document_requirements_get_v1',{...body,context:{gate:'sale',subject:{type:'sales',id:key()}}},'NOT_FOUND');
 await f.fail('document_requirements_get_v1',{...body,center_id:key()},'NOT_FOUND');
 await f.db.query("update core.people set state='inactive',version=version+1 where id=$1",[f.person]);await f.fail('document_requirements_get_v1',body,'NOT_FOUND');
 await f.db.query("update core.people set state='active',version=version+1 where id=$1",[f.person]);
 await f.db.query("update core.center_relationships set state='inactive',version=version+1 where org_id=$1 and person_id=$2 and kind='student'",[f.org,f.person]);await f.fail('document_requirements_get_v1',body,'FORBIDDEN');
 await f.db.query("update core.center_relationships set state='active',version=version+1 where org_id=$1 and person_id=$2 and kind='student'",[f.org,f.person]);
 const accept={document_version_id:published.version,context:f.saleContext},acceptKey=key();await f.api('document_accept_v1',accept,f.student,acceptKey);
 await f.db.query("update core.account_links set state='revoked',version=version+1 where id=$1",[f.link]);
 await f.fail('document_requirements_get_v1',body,'NOT_FOUND');await f.fail('document_accept_v1',accept,'NOT_FOUND',f.student,acceptKey);
 assert.equal((await f.db.query('select count(*)::int n from core.document_acceptances where org_id=$1',[f.org])).rows[0].n,1);
});

test('XREQ-016 organization manager and instructor self reads never inherit another person from management authority',{timeout:300000},async t=>{
 const f=await fixture(t),published=await f.publish('Synthetic role-isolated terms.','self-roles');
 await f.api('document_accept_v1',{document_version_id:published.version,context:f.productContext},f.student);
 for(const role of ['org_manager','instructor']){
  const user=await authUser('self-doc-'+role),account=await must(user,'account_get_v1');
  const person=(await f.api('person_create_v1',{display_name:'Synthetic self document '+role,contacts:[]})).primary_id;
  await f.api('student_activate_v1',{person_id:person});
  await f.db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),f.org,account.id,person]);
  await f.api('role_assign_v1',{person_id:person,role,scope:{center_id:role==='org_manager'?null:f.center}});
  const own=await f.api('document_requirements_get_v1',{context:f.productContext,content_file_id:published.file},user);
  assert.equal(own[0].accepted,false);assert.equal(own[0].version_id,published.version);assert.deepEqual(Buffer.from(own[0].content.data,'base64'),published.bytes);
  await f.fail('document_requirements_get_v1',{context:f.saleContext,content_file_id:published.file},'NOT_FOUND',user);
 }
});


test('XREQ-016 Starter closed selection treats omitted-person and explicit-person document reads equally',{timeout:300000},async t=>{
 const f=await fixture(t,{starterCompatible:true}),published=await f.publish('Synthetic selected-scope terms.','self-selected');
 const scope={room_id:null,discipline_id:f.discipline,instructor_id:null,student_person_ids:[f.person]};
 await f.db.query("insert into private.p07_subscription_scope(subscription_id,kept_center_id,starter_scope) select id,$2,$3 from core.saas_subscriptions where org_id=$1 on conflict(subscription_id) do update set kept_center_id=excluded.kept_center_id,starter_scope=excluded.starter_scope",[f.org,f.center,scope]);
 await f.db.query("update core.saas_plan_versions set name='starter' where id=$1",[f.plan]);
 const body={context:f.productContext,content_file_id:published.file};
 const self=await f.api('document_requirements_get_v1',body,f.student),explicit=await f.api('document_requirements_get_v1',{...body,person_id:f.person},f.student);
 assert.equal(self[0].version_id,published.version);assert.deepEqual(self,explicit);
 // Model the applied downgrade's excluded historical student, preserving all rows.
 await f.db.query("update private.p07_subscription_scope set starter_scope=jsonb_set(starter_scope,'{student_person_ids}','[]'::jsonb) where subscription_id=(select id from core.saas_subscriptions where org_id=$1)",[f.org]);
 await f.fail('document_requirements_get_v1',{...body,person_id:f.person},'PLAN_FEATURE_UNAVAILABLE');
 await f.fail('document_requirements_get_v1',body,'PLAN_FEATURE_UNAVAILABLE');
 assert.equal((await f.db.query("select state from core.center_relationships where org_id=$1 and person_id=$2 and kind='student'",[f.org,f.person])).rows[0].state,'active');
});
