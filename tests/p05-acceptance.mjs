// Registered through the existing registry API suite; clean shard coverage stays unchanged.
import test from 'node:test';import assert from 'node:assert/strict';import {createHash,randomBytes} from 'node:crypto';
import pg from 'pg';import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';import {tick} from '../scripts/p05-worker.mjs';
test('P05 actual Auth/Storage/documents/inbox/scoped worker acceptance',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('p05-owner'),student=await authUser('p05-student'),otherUser=await authUser('p05-other');
 const account=await must(owner,'account_get_v1'),sa=await must(student,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P05',initial_plan_id:plan},key())).primary_id;
 const db=await connect();let worker;const prepared=[];const role='p05_w_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');
 const rows=async(q,a=[])=>(await db.query(q,a)).rows;const scope=b=>({org_id:org,center_id:center,...b});
 const mut=(op,b={},u=owner,k=key())=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Documents',timezone:'UTC'},key())).primary_id;
 try{
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 await mut('center_manager_assign_v1',{person_id:ownerPerson});
 const payment=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic p05',occurred_at:new Date().toISOString()});await mut('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},platform);
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'P05',state:'active'},key())).primary_id;await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const person=(await mut('person_create_v1',{display_name:'P05 learner',contacts:[]})).primary_id;await mut('student_activate_v1',{person_id:person});
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,sa.id,person]);
 const pub=(policy,value)=>mut('policy_publish_v1',{center_id:null,key:policy,value,effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
 const policy=(await pub('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}})).primary_id;
 await pub('reservation_window',{kind:'window',opens_minutes_before:4320,closes_minutes_before:0,manager_exception:false});await pub('negative_default',{kind:'integer',value:0});await pub('negative_upper',{kind:'integer',value:0});await pub('inactive_student_days',{kind:'integer',value:0});await pub('entitlement_reminder_days',{kind:'integer',value:7});
 const product=(await mut('product_publish_v1',{terms:{name:'P05 rights',kind:'credits',booking_mode:'flexible',credits:30,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
 const salePreview=await must(owner,'sale_preview_v1',scope({person_id:person,product_version_id:product,start_date:new Date(Date.now()-86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+5*86400000).toISOString().slice(0,10)}));await mut('sale_apply_v1',{preview:{id:salePreview.id,token:salePreview.token}});
 let nextSlot=0;async function session(hours=20){const sid=key(),start=new Date(Date.now()+(hours+nextSlot++)*3600000);await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,10,10,'planned','open')",[sid,org,center,discipline,start,new Date(+start+3600000)]);return sid;}
 const sid=await session(),ctx={gate:'reservation',subject:{type:'sessions',id:sid},product_version_id:product};
 const required=(gate='reservation')=>[{gate,scope:{center_ids:[center]},renewed_acceptance:true}];
 const contents='P05 synthetic legal document.\n',checksum=createHash('sha256').update(contents).digest('hex');
 async function upload(name='P05 terms'){
  const f=await mut('document_upload_prepare_v1',{name,mime:'text/plain',bytes:Buffer.byteLength(contents)});prepared.push(f.file_id);
  const sent=await fetch(new URL(f.upload_url,context().env.API_URL),{method:'PUT',headers:{'content-type':'text/plain',apikey:context().env.ANON_KEY},body:contents});assert(sent.ok,'Signed upload failed: HTTP '+sent.status);return f;
 }
 const requirements=(c=ctx,u=student,extra={})=>must(u,'document_requirements_get_v1',scope({person_id:person,context:c,...extra}));
 let file,version,document,reservation;
 await t.test('missing upload config is closed; prepare is not ready and only uploader can complete',async()=>{
  await fail('document_upload_prepare_v1',{name:'missing',mime:'text/plain',bytes:1},'POLICY_NOT_CONFIGURED');
  await db.query("insert into private.p05_upload_configuration values($1,65536,array['text/plain','application/pdf'])",[org]);
  const huge=await mut('document_upload_prepare_v1',{name:'Oversized ingress',mime:'text/plain',bytes:1});prepared.push(huge.file_id);
  const oversized=await fetch(new URL(huge.upload_url,context().env.API_URL),{method:'PUT',headers:{'content-type':'text/plain',apikey:context().env.ANON_KEY},body:'x'.repeat(2097153)});assert.equal(oversized.ok,false,'Storage must reject bytes above the system ceiling');
  file=await upload();assert.equal((await rows('select state from core.files where id=$1',[file.file_id]))[0].state,'pending_upload');
  await fail('document_version_publish_v1',{file_id:file.file_id,version_label:'pending',scope:{kind:'center',center_id:center},requirements:required()},'VALIDATION_FAILED');
  await fail('file_upload_complete_v1',{file_id:file.file_id,checksum},'NOT_FOUND',otherUser);
  await fail('file_upload_complete_v1',{file_id:file.file_id,checksum:'0'.repeat(64)},'VALIDATION_FAILED');
  const k=key();const done=await mut('file_upload_complete_v1',{file_id:file.file_id,checksum},owner,k);assert.equal(done.primary_id,file.file_id);assert.equal((await mut('file_upload_complete_v1',{file_id:file.file_id,checksum},owner,k)).replayed,true);
  const overwritten=await fetch(new URL(file.upload_url,context().env.API_URL),{method:'PUT',headers:{'content-type':'text/plain',apikey:context().env.ANON_KEY},body:'replacement'});assert.equal(overwritten.ok,false);
  const direct=await fetch(context().env.API_URL+'/storage/v1/object/authenticated/ftksaas-documents/'+org+'/'+file.file_id,{headers:{apikey:context().env.ANON_KEY,authorization:'Bearer '+student.jwt}});assert.equal(direct.ok,false);
 });
 await t.test('published bytes are privately read through current context; missing acceptance rolls back booking',async()=>{
  const pub=await mut('document_version_publish_v1',{file_id:file.file_id,version_label:'v1',scope:{kind:'center',center_id:center},requirements:required()});version=pub.primary_id;document=pub.related.find(x=>x.type==='documents').id;
  const list=await requirements(ctx,student,{content_file_id:file.file_id});assert.equal(list[0].accepted,false);assert.equal(Buffer.from(list[0].content.data,'base64').toString(),contents);assert.equal(list[0].content_hash,checksum);
  await fail('document_requirements_get_v1',{person_id:person,context:ctx,content_file_id:key()},'NOT_FOUND',student);
  const k=key();await fail('reservation_create_v1',{session_id:sid,person_id:person,mode:'flexible'},'DOCUMENT_REQUIRED',student,k);
  assert.equal((await rows('select count(*)::int n from core.reservations where org_id=$1 and session_id=$2',[org,sid]))[0].n,0);
  assert.equal((await rows('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')]))[0].n,0);
  await fail('document_accept_v1',{document_version_id:version,context:{...ctx,on_behalf_of_person_id:person}},'FORBIDDEN');
  await mut('document_accept_v1',{document_version_id:version,context:ctx},student);
  assert.equal((await requirements())[0].accepted,true);
  reservation=(await mut('reservation_create_v1',{session_id:sid,person_id:person,mode:'flexible'},student,k)).primary_id;
 });
 await t.test('new version preserves history and explicit renewal rule; existing booking is not cancelled',async()=>{
  let f=await upload('Version 2');await mut('file_upload_complete_v1',{file_id:f.file_id,checksum});
  await mut('document_version_publish_v1',{document_id:document,file_id:f.file_id,version_label:'v2',scope:{kind:'center',center_id:center},requirements:[{...required()[0],renewed_acceptance:false}]});
  assert.equal((await requirements())[0].accepted,true);
  f=await upload('Version 3');await mut('file_upload_complete_v1',{file_id:f.file_id,checksum});
  const published=await mut('document_version_publish_v1',{document_id:document,file_id:f.file_id,version_label:'v3',scope:{kind:'center',center_id:center},requirements:required()});version=published.primary_id;
  assert.equal((await requirements())[0].accepted,false);assert.equal((await rows('select state from core.reservations where id=$1',[reservation]))[0].state,'active');
  assert.equal((await rows('select count(*)::int n from core.document_acceptances where org_id=$1',[org]))[0].n,1);
  const sid2=await session(40);await fail('reservation_create_v1',{session_id:sid2,person_id:person,mode:'flexible'},'DOCUMENT_REQUIRED',student);
  await mut('document_accept_v1',{document_version_id:version,context:ctx},student);
 });
 await t.test('attendance document publication requires exact current impact approval and preserves only existing bookings',async()=>{
  const f=await upload('Attendance terms');await mut('file_upload_complete_v1',{file_id:f.file_id,checksum});
  const historySession=await session(46),history=(await mut('reservation_create_v1',{session_id:historySession,person_id:person,mode:'flexible'},student)).primary_id;
  await db.query("update core.sessions set starts_at=clock_timestamp()-interval '72 hours',ends_at=clock_timestamp()-interval '71 hours' where id=$1",[historySession]);
  await db.query("update core.reservations set state='completed',version=version+1 where id=$1",[history]);
  await db.query("insert into core.attendance_entries(id,org_id,center_id,reservation_id,result) values($1,$2,$3,$4,'no_show')",[key(),org,center,history]);
  const request={file_id:f.file_id,version_label:'attendance-v1',scope:{kind:'center',center_id:center},requirements:required('attendance')};
  await fail('document_version_publish_v1',request,'PREVIEW_STALE');
  const before=await must(owner,'document_publication_preview_v1',scope(request));assert(before.affected.some(x=>x.subject.id===reservation));assert.equal(before.preserves_reservations,true);
  const approval=p=>({preview:{id:p.preview.id,token:p.preview.token},accepted_subjects:p.affected.map(x=>x.subject)});
  await fail('document_version_publish_v1',{...request,impact_approval:{...approval(before),accepted_subjects:[]}},'VALIDATION_FAILED');
  await fail('document_version_publish_v1',{...request,version_label:'changed',impact_approval:approval(before)},'PREVIEW_STALE');
  const preview=await must(owner,'document_publication_preview_v1',scope(request)),k=key();
  const published=await mut('document_version_publish_v1',{...request,impact_approval:approval(preview)},owner,k);assert.equal((await mut('document_version_publish_v1',{...request,impact_approval:approval(preview)},owner,k)).replayed,true);
  const attendance=id=>({gate:'attendance',subject:{type:'reservations',id}});
  await db.query('select private.p05_assert_documents($1,$2,$3,$4)',[org,center,person,attendance(reservation)]);
  assert.equal((await requirements(attendance(reservation)))[0].accepted,false); // protection never invents acceptance evidence
  await db.query("update core.attendance_entries set result='attended',version=version+1 where org_id=$1 and reservation_id=$2",[org,history]);
  const next=(await mut('reservation_create_v1',{session_id:await session(45),person_id:person,mode:'flexible'},student)).primary_id;
  await assert.rejects(db.query('select private.p05_assert_documents($1,$2,$3,$4)',[org,center,person,attendance(next)]),/DOCUMENT_REQUIRED/);
  assert.equal((await rows('select count(*)::int n from private.p05_document_protections where org_id=$1 and document_version_id=$2',[org,published.primary_id]))[0].n,preview.affected.length);
 });
 await t.test('organization catalog sale document is available before purchase and gate commits only after self consent',async()=>{
  const terms={name:'Organization catalog',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
  // Organization-level catalog rows are a supported data shape; product_publish
  // remains center-managed. Seed this shape without broadening that API's authority.
  const pid=key(),pv=key();
  await db.query("insert into core.products(id,org_id,name,state) values($1,$2,'Organization catalog','active')",[pid,org]);
  await db.query("insert into core.product_versions(id,org_id,product_id,kind,booking_mode,credits,price_minor,currency,refund_method,freeze_terms,refund_terms,effective_at) values($1,$2,$3,'credits','flexible',1,0,'TRY','none',$4,$5,clock_timestamp())",[pv,org,pid,terms.freeze,terms.refund]);
  await db.query("insert into core.product_scopes(id,org_id,product_version_id,scope_kind,usage_targets) values($1,$2,$3,'organization_all',array['lesson'])",[key(),org,pv]);
  const f=await upload('Sale terms');await mut('file_upload_complete_v1',{file_id:f.file_id,checksum});
  const published=await mut('document_version_publish_v1',{file_id:f.file_id,version_label:'sale-v1',scope:{kind:'center',center_id:center},requirements:[{gate:'sale',scope:{center_ids:[center],product_version_ids:[pv]},renewed_acceptance:true}]});
  const saleContext={gate:'sale',subject:{type:'product_versions',id:pv}},list=await requirements(saleContext);assert(list.some(x=>x.version_id===published.primary_id&&!x.accepted));
  const request={person_id:person,product_version_id:pv,start_date:new Date().toISOString().slice(0,10),end_date:new Date(Date.now()+5*86400000).toISOString().slice(0,10)};
  const preview=await must(owner,'sale_preview_v1',scope(request));await fail('sale_apply_v1',{preview:{id:preview.id,token:preview.token}},'DOCUMENT_REQUIRED');
  await mut('document_accept_v1',{document_version_id:published.primary_id,context:saleContext},student);
  const fresh=await must(owner,'sale_preview_v1',scope(request));assert((await mut('sale_apply_v1',{preview:{id:fresh.id,token:fresh.token}})).primary_id);
 });
 await t.test('self inbox/version read/replay; transactional notice cannot be disabled; optional default off',async()=>{
  const list=await must(student,'notifications_list_v1',scope({page:{limit:1},unread_only:false}));assert.equal(list.items.length,1);
  const n=list.items[0],state=await must(student,'management_state_get_v1',scope({operation:'notification_mark_read_v1',selector:{operation:'notification_mark_read_v1',key:{notification_id:n.id}}}));const v=state.items[0].versions[0].version;
  await fail('notification_mark_read_v1',{notification_id:n.id,expected_version:v},'NOT_FOUND');
  const k=key();await mut('notification_mark_read_v1',{notification_id:n.id,expected_version:v},student,k);assert.equal((await mut('notification_mark_read_v1',{notification_id:n.id,expected_version:v},student,k)).replayed,true);
  await fail('notification_preferences_set_v1',{channel:'in_app',purpose:'transactional',enabled:false,expected_version:1},'FORBIDDEN',student);
  await fail('notification_preferences_set_v1',{channel:'email',purpose:'reminder',enabled:true,expected_version:1},'SERVICE_UNAVAILABLE',student);
  if(list.next_cursor){const changed=await call(student,'notifications_list_v1',scope({page:{cursor:list.next_cursor},unread_only:true}));assert.equal(changed.result.error.code,'VALIDATION_FAILED');}
 });
 await db.query(`create role "${role}" login password '${password}'`);await db.query(`grant ftk_p05_worker to "${role}"`);await db.query('insert into private.p05_worker_scopes values($1,$2)',[role,org]);
 const url=new URL(context().env.DB_URL);url.username=role;url.password=password;worker=new pg.Client({connectionString:url.toString()});await worker.connect();const ids=()=>Array.from({length:4096},key);
 const claim=async()=>(await worker.query('select private.p05_jobs_claim($1,$2,50) jobs',[org,ids()])).rows[0].jobs;
 const invoke=async({operation,request})=>(await worker.query('select private.p05_worker_execute($1,$2,$3) result',[operation,request,ids()])).rows[0].result;
 const inspect=async jobs=>{const result=[];for(const j of jobs)result.push({j,c:(await rows('select * from private.p05_jobs where job_id=$1',[j.request.job_id]))[0]});return result;};
 const drain=async()=>{for(let i=0;i<10;i++){const results=await tick(worker,org,{limit:50});assert(results.every(r=>r.ok),JSON.stringify(results));if(!results.length)break;}};
 await t.test('dedicated worker cannot read business/Auth tables or change org/operation/token; outbox once',async()=>{
  await assert.rejects(worker.query('select * from core.people'),/permission denied/);await assert.rejects(worker.query('select * from auth.users'),/permission denied/);
  await assert.rejects(worker.query('select private.p05_jobs_claim($1,$2,1)',[key(),ids()]),/FORBIDDEN/);
  const jobs=await claim(),first=jobs.find(x=>x.operation==='outbox_deliver_v1');assert(first);
  await assert.rejects(invoke({...first,request:{...first.request,lease_token:'wrong'}}),/FORBIDDEN/);
  await assert.rejects(invoke({...first,operation:'automation_run_v1'}),/FORBIDDEN/);
  const result=await invoke(first);assert(result.ok,JSON.stringify(result));assert.deepEqual(await invoke(first),result);
  for(const job of jobs.filter(x=>x!==first)){const result=await invoke(job);assert(result.ok,JSON.stringify(result));}
  assert.equal((await rows("select count(*)::int n from core.notifications where org_id=$1 and kind='reminder'",[org]))[0].n,0);
  const human=await call(owner,'outbox_deliver_v1',scope({job_id:first.request.job_id,lease_token:first.request.lease_token}),key());assert.equal(human.result.error.code,'FORBIDDEN');
 });
 await t.test('optional reminder prefs, lease reclaim/fence, repeat and cancellation recheck',async()=>{
  await mut('notification_preferences_set_v1',{channel:'in_app',purpose:'reminder',enabled:true,expected_version:1},student);
  const newSid=await session(10);const booking=(await mut('reservation_create_v1',{session_id:newSid,person_id:person,mode:'flexible'},student)).primary_id;
  let jobs=await claim();const reminder=(await inspect(jobs)).find(x=>x.c.target_id===booking)?.j;assert(reminder);
  for(const j of jobs.filter(x=>x!==reminder))assert((await invoke(j)).ok);
  await db.query("update core.outbox_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[reminder.request.job_id]);
  const fresh=(await claim()).find(j=>j.request.job_id===reminder.request.job_id);assert(fresh);await assert.rejects(invoke(reminder),/FORBIDDEN/);
  const result=await invoke(fresh);assert(result.ok);assert.deepEqual(await invoke(fresh),result);
  const count=(await rows("select count(*)::int n from core.notifications where org_id=$1 and kind='reminder' and subject_id=$2",[org,booking]))[0].n;assert.equal(count,1);await drain();assert.equal((await rows("select count(*)::int n from core.notifications where org_id=$1 and kind='reminder' and subject_id=$2",[org,booking]))[0].n,1);
 });
 await t.test('worker late failure rolls back effects and receipt, then fresh fenced retry recovers',async()=>{
  const booking=(await mut('reservation_create_v1',{session_id:await session(8),person_id:person,mode:'flexible'},student)).primary_id;
  const jobs=await claim(),job=(await inspect(jobs)).find(x=>x.c.target_id===booking)?.j;assert(job);
  for(const j of jobs.filter(x=>x!==job))assert((await invoke(j)).ok);
  const fixture='p05_fail_'+key().replaceAll('-','');
  await db.query(`create function private.${fixture}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='reminder_schedule_v1' then raise exception 'fixture late failure' using errcode='23514';end if;return new;end$$`);
  await db.query(`create trigger ${fixture} before insert on core.audit_events for each row execute function private.${fixture}()`);
  try{
   const failed=await invoke(job);assert.equal(failed.ok,false);assert.equal(failed.error.code,'INTEGRITY_VIOLATION');assert.equal(failed.error.retryable,true);
   assert.equal((await rows("select count(*)::int n from core.notifications where org_id=$1 and kind='reminder' and subject_id=$2",[org,booking]))[0].n,0);
   assert.equal((await rows("select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=encode(extensions.digest($2::text,'sha256'),'hex')",[org,job.request.operation_key]))[0].n,0);
   assert.equal((await rows('select state from core.outbox_jobs where id=$1',[job.request.job_id]))[0].state,'retry_wait');
  }finally{await db.query(`drop trigger ${fixture} on core.audit_events`);await db.query(`drop function private.${fixture}()`);}
  await db.query("update core.outbox_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[job.request.job_id]);
  const fresh=(await claim()).find(j=>j.request.job_id===job.request.job_id);assert(fresh);await assert.rejects(invoke(job),/FORBIDDEN/);assert((await invoke(fresh)).ok);
  assert.equal((await rows("select count(*)::int n from core.notifications where org_id=$1 and kind='reminder' and subject_id=$2",[org,booking]))[0].n,1);
 });
 await t.test('Business segment/automation definition is not center authority; active student without lead gets actionable followup',async()=>{
  const segment=(await mut('segment_save_v1',{name:'Active students',scope:{kind:'organization'},center_id:null,definition:{all:[{field:'active_student',operator:'eq',value:true}]}})).primary_id;
  const secondCenter=(await must(owner,'center_create_v1',{org_id:org,name:'No CM assignment',timezone:'UTC'},key())).primary_id;
  await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'student','active',now()-interval '2 days')",[key(),org,secondCenter,person]);
  const automation=(await mut('automation_save_v1',{scope:{kind:'organization'},center_id:null,definition:{name:'Follow inactive',trigger:{kind:'student_inactive',offset_days:0},segment_id:segment,action:{kind:'create_followup',channel:'in_app',template_key:'followup'},execution_center_ids:[center,secondCenter],enabled:true}})).primary_id;
  let jobs=await claim();const auto=(await inspect(jobs)).find(x=>x.c.automation_id===automation)?.j;assert(auto);
  const result=await invoke(auto);assert(result.ok,JSON.stringify(result));assert.deepEqual(await invoke(auto),result);for(const j of jobs.filter(x=>x!==auto))assert((await invoke(j)).ok);
  const followups=await must(owner,'crm_followup_list_v1',scope({kind:'automation_followup',page:{}}));const task=followups.items.find(x=>x.person_id===person);assert(task);assert.equal(task.lead_id,null);
  assert.equal((await rows('select count(*)::int n from core.leads where org_id=$1 and person_id=$2',[org,person]))[0].n,0);
  const view=await must(owner,'management_state_get_v1',scope({operation:'crm_activity_save_v1',selector:{operation:'crm_activity_save_v1',key:{person_id:person,activity_id:task.id}}}));
  await mut('crm_activity_save_v1',{person_id:person,activity_id:task.id,expected_version:view.items[0].versions[0].version,kind:'outcome',outcome:'contacted',note:'synthetic followup completed'});
  assert(!(await must(owner,'crm_followup_list_v1',scope({kind:'automation_followup',page:{}}))).items.some(x=>x.id===task.id));
  await drain();assert.equal((await rows('select count(*)::int n from core.automation_runs where org_id=$1 and automation_id=$2',[org,automation]))[0].n,1);
  assert.equal((await rows('select count(*)::int n from private.p05_jobs where org_id=$1 and automation_id=$2 and center_id=$3',[org,automation,secondCenter]))[0].n,0);
  await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);await assert.rejects(invoke(auto),/FORBIDDEN|PLAN_FEATURE_UNAVAILABLE/);await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);
  await db.query('delete from private.p05_worker_scopes where db_role=$1',[role]);await assert.rejects(invoke(auto),/FORBIDDEN/);await db.query('insert into private.p05_worker_scopes values($1,$2)',[role,org]);
 });
 }finally{
  if(worker)await worker.end();await db.query('delete from private.p05_worker_scopes where db_role=$1',[role]);await db.query(`drop role if exists "${role}"`);
  if(prepared.length){const {env}=context();const removed=await fetch(env.API_URL+'/storage/v1/object/ftksaas-documents',{method:'DELETE',headers:{authorization:'Bearer '+env.SERVICE_ROLE_KEY,apikey:env.SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({prefixes:prepared.map(fid=>org+'/'+fid)})});assert(removed.ok,'Synthetic Storage fixture cleanup failed');}
  await db.end();
 }
});
