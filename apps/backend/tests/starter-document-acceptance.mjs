// Existing registry shard owns this Starter-only Auth/Storage acceptance.
import test,{resources,step} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Starter private document lifecycle through native Auth and Storage',async t=>{
 const guard=resources(t),{platform,plan}=await fixturePlatform(),owner=await authUser('starter-doc-owner'),student=await authUser('starter-doc-student'),stranger=await authUser('starter-doc-outsider');
 const {env}=context(),db=await guard.connect(env.DB_URL),files=[];
 const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
 const account=await must(owner,'account_get_v1'),member=await must(student,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Starter document acceptance',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Documents',timezone:'UTC'},key())).primary_id;
 const scope=b=>({org_id:org,center_id:center,...b}),api=(op,b={},u=owner,k=key())=>must(u,op,scope(b),k);
 const denied=async(op,b,code,u=student,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);assert.equal(r.result.data,undefined);return r;};
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 await api('center_manager_assign_v1',{person_id:ownerPerson});
 const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC DOCUMENT FIXTURE',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},platform);
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Starter documents',state:'active'},key())).primary_id;await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const person=(await api('person_create_v1',{display_name:'Synthetic document member',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:person});
 const link=key();await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[link,org,member.id,person]);
 await api('role_assign_v1',{person_id:ownerPerson,role:'instructor',scope:{center_id:center}});
 await api('availability_save_v1',{resource:{kind:'person',id:ownerPerson},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
 const room=(await api('room_save_v1',{name:'Document room',capacity:2})).primary_id;
 await api('availability_save_v1',{resource:{kind:'room',id:room},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
 await api('policy_publish_v1',{center_id:null,key:'reservation_window',value:{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false},effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
 await api('policy_publish_v1',{center_id:null,key:'student_cancel_group',value:{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}},effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
 const product=(await api('product_publish_v1',{terms:{name:'Starter documents · two rights',kind:'credits',booking_mode:'flexible',credits:2,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]}})).primary_id;
 const quote=await api('sale_preview_v1',{person_id:person,product_version_id:product,start_date:new Date().toISOString().slice(0,10),end_date:new Date(Date.now()+7*86400000).toISOString().slice(0,10)});
 const sale=(await api('sale_apply_v1',{preview:{id:quote.id,token:quote.token}})).primary_id;
 const sessions=[];for(const hour of [9,11]){const start=new Date(Date.now()+86400000);start.setUTCHours(hour,0,0,0);sessions.push((await api('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:start.toISOString(),ends_at:new Date(+start+3600000).toISOString()},resources:[{kind:'room',id:room}],assignments:[{person_id:ownerPerson,duty:'instructor'}],capacity:{total:2}})).primary_id);}
 const ctx=id=>({gate:'reservation',subject:{type:'sessions',id},product_version_id:product}),requirements=(id,extra={},u=student)=>api('document_requirements_get_v1',{person_id:person,context:ctx(id),...extra},u);
 const upload=async(text,label)=>{
  const bytes=Buffer.from(text),checksum=createHash('sha256').update(bytes).digest('hex');
  const f=await api('document_upload_prepare_v1',{name:label,mime:'text/plain',bytes:bytes.length});files.push(f.file_id);
  const r=await fetch(new URL(f.upload_url,env.API_URL),{method:'PUT',headers:{apikey:env.ANON_KEY,'content-type':'text/plain'},body:bytes,signal:AbortSignal.timeout(15000)});assert.equal(r.ok,true);
  await api('file_upload_complete_v1',{file_id:f.file_id,checksum});return {...f,bytes,checksum};
 };
 const publish=(file,label,document_id)=>api('document_version_publish_v1',{file_id:file.file_id,version_label:label,...(document_id?{document_id}:{}),scope:{kind:'center',center_id:center},requirements:[{gate:'reservation',scope:{center_ids:[center]},renewed_acceptance:true}]});
 let first,second,v1,v2,document,reservation;
 try{
  await db.query("insert into private.p05_upload_configuration values($1,65536,array['text/plain'])",[org]);
  await step('published content comes from real private bytes; viewing never supplies consent',async()=>{
   first=await upload('Sürüm 1 — özgün şartlar.\n','Starter terms');
   const result=await publish(first,'starter-v1');v1=result.primary_id;document=result.related.find(x=>x.type==='documents').id;
   const read=await requirements(sessions[0],{content_file_id:first.file_id});assert.equal(read.length,1);assert.equal(read[0].version_id,v1);assert.equal(read[0].content_hash,first.checksum);assert.deepEqual(Buffer.from(read[0].content.data,'base64'),first.bytes);assert.equal(read[0].accepted,false);
   const raw=await fetch(env.API_URL+'/storage/v1/object/authenticated/ftksaas-documents/'+org+'/'+first.file_id,{headers:{apikey:env.ANON_KEY,authorization:'Bearer '+student.jwt},signal:AbortSignal.timeout(15000)});assert.equal(raw.ok,false);await raw.arrayBuffer();
   await denied('document_requirements_get_v1',{person_id:person,context:ctx(sessions[0]),content_file_id:first.file_id},'NOT_FOUND',stranger);
   const k=key(),booking={session_id:sessions[0],person_id:person,source_sale_id:sale,mode:'flexible'};
   await denied('reservation_create_v1',booking,'DOCUMENT_REQUIRED',student,k);
   assert.equal((await rows('select count(*)::int n from core.reservations where org_id=$1',[org]))[0].n,0);
   assert.equal((await rows("select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=encode(extensions.digest($2,'sha256'),'hex')",[org,k]))[0].n,0);
   await api('document_accept_v1',{document_version_id:v1,context:ctx(sessions[0])},student);
   assert.equal((await requirements(sessions[0]))[0].accepted,true);
   reservation=(await api('reservation_create_v1',booking,student,k)).primary_id;
  });
  await step('a new byte version retains history, preserves the old booking and gates a new booking',async()=>{
   second=await upload('Sürüm 2 — değiştirilmiş şartlar.\n','Starter amended terms');assert.notEqual(second.checksum,first.checksum);
   v2=(await publish(second,'starter-v2',document)).primary_id;
   const read=await requirements(sessions[1],{content_file_id:second.file_id});assert.equal(read[0].version_id,v2);assert.equal(read[0].accepted,false);assert.equal(read[0].content_hash,second.checksum);assert.deepEqual(Buffer.from(read[0].content.data,'base64'),second.bytes);
   assert.equal((await rows('select state from core.reservations where id=$1',[reservation]))[0].state,'active');
   assert.deepEqual((await rows('select document_version_id from core.document_acceptances where org_id=$1',[org])).map(x=>x.document_version_id),[v1]);
   await denied('document_accept_v1',{document_version_id:v1,context:ctx(sessions[1])},'NOT_FOUND');
   await denied('document_requirements_get_v1',{person_id:person,context:ctx(sessions[1]),content_file_id:first.file_id},'NOT_FOUND');
   const booking={session_id:sessions[1],person_id:person,mode:'flexible'},k=key();await denied('reservation_create_v1',booking,'DOCUMENT_REQUIRED',student,k);
   const acceptKey=key(),acceptBody={document_version_id:v2,context:ctx(sessions[1])};await api('document_accept_v1',acceptBody,student,acceptKey);assert.equal((await api('document_accept_v1',acceptBody,student,acceptKey)).replayed,true);
   await api('reservation_create_v1',booking,student,k);
   assert.equal((await rows('select count(*)::int n from core.document_acceptances where org_id=$1',[org]))[0].n,2);
   assert.equal((await rows("select count(*)::int n from core.entitlement_allocations where org_id=$1 and state='reserved'",[org]))[0].n,2);
   const historical=await fetch(env.API_URL+'/storage/v1/object/ftksaas-documents/'+org+'/'+first.file_id,{headers:{apikey:env.SERVICE_ROLE_KEY,authorization:'Bearer '+env.SERVICE_ROLE_KEY},signal:AbortSignal.timeout(15000)});assert.equal(historical.ok,true);assert.deepEqual(Buffer.from(await historical.arrayBuffer()),first.bytes);
   assert.equal((await rows('select checksum from core.files where id=$1',[first.file_id]))[0].checksum,first.checksum);
  });
  await step('revoking only the membership link closes content and old acceptance replay without erasing evidence',async()=>{
   const acceptKey=key(),body={document_version_id:v2,context:ctx(sessions[1])};await api('document_accept_v1',body,student,acceptKey);
   await db.query("update core.account_links set state='revoked',version=version+1 where id=$1",[link]);
   await denied('document_requirements_get_v1',{person_id:person,context:ctx(sessions[1]),content_file_id:second.file_id},'NOT_FOUND');
   await denied('document_accept_v1',body,'NOT_FOUND',student,acceptKey);
   assert.equal((await rows('select count(*)::int n from core.document_versions where org_id=$1',[org]))[0].n,2);
   assert.equal((await rows('select count(*)::int n from core.document_acceptances where org_id=$1',[org]))[0].n,2);
   assert.equal((await rows("select count(*)::int n from core.reservations where org_id=$1 and state='active'",[org]))[0].n,2);
  });
 }finally{
  if(files.length){const cleanup=await fetch(env.API_URL+'/storage/v1/object/ftksaas-documents',{method:'DELETE',headers:{apikey:env.SERVICE_ROLE_KEY,authorization:'Bearer '+env.SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({prefixes:files.map(id=>org+'/'+id)}),signal:AbortSignal.timeout(15000)});assert.equal(cleanup.ok,true);}
  await db.end();
 }
});

test('Digital documents freeze frontend text and consent without Storage objects',async t=>{
 const {preparationFixture}=await import('./starter-preparation-fixture.mjs');
 const f=await preparationFixture({studentUser:true,studentMembership:true}),{db,org,center,owner,student,studentPerson}=f;t.after(()=>db.end());
 const api=(op,b={},u=owner,k=key())=>must(u,op,{org_id:org,center_id:center,...b},k);
 const deny=async(code,op,b,u=student,k=key())=>{const r=await call(u,op,{org_id:org,center_id:center,...b},k);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);};
 const discipline=(await api('discipline_save_v1',{name:'Digital evidence',state:'active'})).primary_id;
 await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const product=(await api('product_publish_v1',{terms:{name:'Digital evidence · terms',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]}})).primary_id;
 const ctx={gate:'sale',subject:{type:'product_versions',id:product}},source={name:'Synthetic digital consent',language:'tr',template_id:'service-terms',template_version:'v1',text:'Başlık\nKoşullar: ı İ ş\nOnaylıyorum.\n'};
 const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
 const publication={digital_content:source,version_label:'digital-v1',scope:{kind:'center',center_id:center},requirements:[{gate:'sale',scope:{center_ids:[center]},renewed_acceptance:true}]};
 const count=async()=>Number((await db.query("select count(*) n from storage.objects where bucket_id='ftksaas-documents' and name like $1",[org+'/%'])).rows[0].n),before=await count();
 await deny('FORBIDDEN','document_version_publish_v1',publication);
 const preview=await api('document_publication_preview_v1',publication);assert.deepEqual(preview.affected,[]);
 const published=await api('document_version_publish_v1',publication),version=published.primary_id;
 const read=(extra={})=>api('document_requirements_get_v1',{context:ctx,...extra},student);
 const list=await read(),item=list.find(x=>x.version_id===version);assert(item);assert.equal(item.content_kind,'digital');assert.equal(item.digital_content,undefined);assert.equal(item.accepted,false);
 const contents=()=>read({content_file_id:item.file.id});
 const shown=(await contents()).find(x=>x.version_id===version);assert.deepEqual(shown.digital_content,source);assert.equal(shown.content_hash,sha(source.text));assert.equal(Buffer.from(shown.content.data,'base64').toString('utf8'),source.text);
 await deny('VALIDATION_FAILED','document_accept_v1',{document_version_id:version,context:ctx});
 const displayed={...source,language:'en',text:'Title\nTerms shown in English.\nI accept.\n'},body={document_version_id:version,context:ctx,displayed_content:displayed,displayed_content_hash:sha(displayed.text)};
 await deny('VALIDATION_FAILED','document_accept_v1',{...body,displayed_content_hash:'0'.repeat(64)});
 await deny('VERSION_CONFLICT','document_accept_v1',{...body,displayed_content:{...displayed,template_version:'v2'}});
 const k=key(),accepted=await api('document_accept_v1',body,student,k);assert.equal((await api('document_accept_v1',body,student,k)).replayed,true);
 const evidence=(await contents()).find(x=>x.version_id===version).digital_acceptance;
 assert.equal(evidence.id,accepted.primary_id);assert.equal(evidence.person_id,studentPerson);assert.deepEqual(evidence.displayed_content,displayed);assert.equal(evidence.content_hash,sha(displayed.text));assert.equal(evidence.source_content_hash,sha(source.text));assert(Number.isFinite(Date.parse(evidence.accepted_at)));
 await deny('IDEMPOTENCY_PAYLOAD_MISMATCH','document_accept_v1',{...body,displayed_content:{...displayed,text:'Changed'},displayed_content_hash:sha('Changed')});
 await assert.rejects(db.query('update private.digital_document_acceptances set content_hash=$1 where acceptance_id=$2',['0'.repeat(64),accepted.primary_id]),/INTEGRITY_VIOLATION/);
 await assert.rejects(db.query('delete from private.digital_document_contents where file_id=$1',[item.file.id]),/INTEGRITY_VIOLATION/);
 const history=await api('management_state_get_v1',{operation:'document_accept_v1',selector:{operation:'document_accept_v1',key:{document_version_id:version}}},student);assert.deepEqual(history.items[0].current.values.digital_acceptance,evidence);
 assert.equal(await count(),before);
 const stranger=await authUser('digital-document-outsider');await must(stranger,'account_get_v1');await deny('NOT_FOUND','document_requirements_get_v1',{context:ctx,content_file_id:item.file.id},stranger);
 await db.query("update core.account_links set state='revoked',version=version+1 where org_id=$1 and person_id=$2",[org,studentPerson]);
 await deny('NOT_FOUND','document_accept_v1',body,student,k);assert.equal((await db.query('select count(*)::int n from private.digital_document_acceptances where org_id=$1',[org])).rows[0].n,1);
});
