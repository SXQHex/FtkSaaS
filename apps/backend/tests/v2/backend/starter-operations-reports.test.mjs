// Included by registry.test.mjs: real native Auth/Storage/Edge and dedicated workers.
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createHash,randomBytes} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from '../../api-client.mjs';
import {connect} from '../../../scripts/db.mjs';
import {newUuidV7 as key} from '../../../scripts/uuid.mjs';
import {tick as notificationsTick} from '../../../scripts/p05-worker.mjs';
import {tick as importTick} from '../../../scripts/p06-worker.mjs';

async function operationsFixture(t){
 const {platform,plan}=await fixturePlatform(),owner=await authUser('st02-owner'),student=await authUser('st02-student'),stranger=await authUser('st02-stranger');
 const db=await connect(),rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const workers=[],roles=[],files=[];let org,center,ownerPerson,studentPerson,version,importJob,preview,exportJob,exportFile;
 const scoped=b=>({org_id:org,center_id:center,...b});
 const api=(op,b={},actor=owner,k=key())=>must(actor,op,scoped(b),k);
 const denied=async(op,b,code,actor=owner,k=key())=>{const r=await call(actor,op,scoped(b),k);assert.equal(r.result.ok,false,op);assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const interval={starts_at:new Date(Date.now()-86400000).toISOString(),ends_at:new Date(Date.now()+86400000).toISOString()};
 const filters=()=>({interval,center_ids:[center]});
 const headers=['source_key','display_name','person_ref','opening_credits','opening_credit_value_minor','opening_debt_minor','currency','product_version_ref','start_date','end_date'];
 const mapping={columns:headers.map(target=>({source_column:target,target}))};
 const token=p=>({id:p.id,token:p.token});
 async function dedicated(kind){
  const role='st02_'+kind+'_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');roles.push(role);
  await db.query(`create role "${role}" login password '${password}'`);await db.query(`grant ftk_${kind}_worker to "${role}"`);
  await db.query(`insert into private.${kind}_worker_scopes values($1,$2)`,[role,org]);
  const url=new URL(context().env.DB_URL);url.username=role;url.password=password;
  const c=new pg.Client({connectionString:url.href});await c.connect();workers.push(c);return c;
 }
 async function drain(worker,tick){
  for(let i=0;i<30;i++){const result=await tick(worker,org,{limit:10});assert(result.every(x=>x.ok),JSON.stringify(result));if(!result.length)return;}
  throw Error('ST-02 worker exceeded bounded drain');
 }
 async function upload(csv){
  const checksum=createHash('sha256').update(csv).digest('hex');
  const f=await api('import_upload_prepare_v1',{filename:'starter.csv',mime:'text/csv',bytes:Buffer.byteLength(csv),checksum});files.push(f.file_id);
  const response=await fetch(new URL(f.upload_url,context().env.API_URL),{method:'PUT',headers:{apikey:context().env.ANON_KEY,'content-type':'text/csv'},body:csv});assert(response.ok,'Upload HTTP '+response.status);
  await api('file_upload_complete_v1',{file_id:f.file_id,checksum});return f;
 }
 async function previewFile(f,namespace,k=key(),selectedMapping=mapping){
  const b={file_id:f.file_id,mapping:selectedMapping,source_namespace:namespace};const j=await api('import_preview_v1',b,owner,k);
  assert.equal((await api('import_preview_v1',b,owner,k)).job_id,j.job_id);
  await drain(p06,importTick);const status=await api('job_status_get_v1',{job_id:j.job_id});assert.equal(status.state,'succeeded');
  return {job:j.job_id,preview:await api('preview_get_v1',{preview_id:status.result_reference.id})};
 }
 let p05,p06,uploaded,preparedReport,sharedReportRef;
 const settings=(scope,u=owner)=>must(u,'settings_get_v1',{scope,org_id:org,...(scope==='center'?{center_id:center}:{})});
 const saveSettings=async(scope,patch,u=owner)=>must(u,'settings_update_v1',{scope,org_id:org,...(scope==='center'?{center_id:center}:{}),expected_version:(await settings(scope,u)).version,patch},key());
 const templates=(u=owner)=>must(u,'settings_catalog_get_v1',{scope:'member',org_id:org,template_center_id:center});
 t.after(async()=>{
  try{
  for(const c of workers)await c.end();
  for(const kind of ['p05','p06'])await db.query(`delete from private.${kind}_worker_scopes where org_id=$1`,[org]);
  for(const role of roles)await db.query(`drop role if exists "${role}"`);
  for(const file of files)await fetch(context().env.API_URL+'/storage/v1/object/ftksaas-imports/'+org+'/'+file,{method:'DELETE',headers:{apikey:context().env.SERVICE_ROLE_KEY,authorization:'Bearer '+context().env.SERVICE_ROLE_KEY}});
  }finally{await db.end();}
 });
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  const account=await must(owner,'account_get_v1'),member=await must(student,'account_get_v1');
  org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic ST-02',initial_plan_id:plan},key())).primary_id;
  center=(await api('center_create_v1',{name:'Starter center',timezone:'UTC'})).primary_id;
  ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
  await api('center_manager_assign_v1',{person_id:ownerPerson});
  const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC ST02',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},platform);
  const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Yoga',state:'active'},key())).primary_id;
  await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  version=(await api('product_publish_v1',{terms:{name:'Yoga · imported rights',kind:'credits',booking_mode:'flexible',credits:4,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'credit_ratio'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]}})).primary_id;
  studentPerson=(await api('person_create_v1',{display_name:'Synthetic existing member',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:studentPerson});
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,member.id,studentPerson]);
  p05=await dedicated('p05');p06=await dedicated('p06');
 return {platform,plan,owner,student,stranger,db,rows,workers,roles,files,org,center,ownerPerson,studentPerson,version,scoped,api,denied,interval,filters,headers,mapping,token,drain,upload,previewFile,p05,p06,settings,saveSettings,templates};
}


test('ST-02 work templates, report snapshots, export and transactional inbox',{timeout:300000},async t=>{
 const fixture=await operationsFixture(t);
 const {platform,plan,owner,student,stranger,db,rows,workers,roles,files,org,center,ownerPerson,studentPerson,version,scoped,api,denied,interval,filters,headers,mapping,token,drain,upload,previewFile,p05,p06,settings,saveSettings,templates}=fixture;
 let importJob,preview,exportJob,exportFile,uploaded,preparedReport,sharedReportRef;
 // Native opening balances are fixture prerequisites; their assertions remain in the import root.
 await db.query('insert into private.p06_configuration values($1,2097152,5000,16777216)',[org]);
 const start=new Date(Date.now()-86400000).toISOString().slice(0,10),end=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 const csv=headers.join(',')+'\r\nexisting,"Synthetic, existing",'+studentPerson+',2,1000,200,TRY,'+version+','+start+','+end+'\r\nnew,Synthetic new,,,,100,TRY,,,\r\nbad,Synthetic invalid,,,,bad,TRY,,,\r\n';
 uploaded=await upload(csv);const opening=await previewFile(uploaded,'st02-opening');importJob=opening.job;
 await api('import_apply_v1',{preview:token(opening.preview)});await drain(p06,importTick);
  await t.test('work templates are private unless explicitly shared; copies and resolves retain live domain authority',async()=>{
   assert.deepEqual((await settings('member')).values.report_templates,[]);assert.deepEqual((await settings('member')).values.import_templates,[]);
   const report={key:'private_report',name:'Synthetic private debt report',report:'collections_debts',filters:filters(),columns:['group_key','amount_minor'],report_order:'group_key_desc',group_by:'total'};
   const imp={key:'private_import',name:'Synthetic mapping',center_id:center,source_namespace:'st03-templates',mapping:{delimiter:';',columns:[{source_column:'id',target:'source_key'},{source_column:'name',target:'display_name'},{source_column:'ref',target:'person_ref'}]}};
   await saveSettings('member',{report_templates:[report],import_templates:[imp]});await saveSettings('organization',{report_templates:[{...report,key:'shared_report'}]});
   const available=(await templates()).work_templates;assert.equal(available.reports.length,2);assert.equal(available.imports.length,1);assert.deepEqual((await templates(student)).work_templates,{reports:[],imports:[]});
   const privateRef=available.reports.find(x=>x.source.scope==='member').source;sharedReportRef=available.reports.find(x=>x.source.scope==='organization').source;
   const countJobs=async()=>Number((await rows("select count(*) n from core.outbox_jobs where org_id=$1 and kind in ('p06.report','p06.import')",[org]))[0].n),before=await countJobs();
   preparedReport=await api('settings_template_resolve_v1',{kind:'report',template:privateRef,overrides:{filters:{currency:'TRY'}}});assert.equal(preparedReport.kind,'report');assert.equal(preparedReport.request.filters.currency,'TRY');assert.equal(await countJobs(),before);
   await denied('settings_template_resolve_v1',{kind:'report',template:privateRef},'NOT_FOUND',student);await denied('settings_template_resolve_v1',{kind:'report',template:sharedReportRef},'FORBIDDEN',student);
   const cm=await api('center_manager_assign_v1',{person_id:studentPerson});let sharedPrepared;
   try{
    const peer=(await templates(student)).work_templates;assert.equal(peer.reports.length,1);assert.equal(peer.reports[0].source.scope,'organization');assert.equal(peer.imports.length,0);
    sharedPrepared=await api('settings_template_resolve_v1',{kind:'report',template:sharedReportRef},student);assert.equal((await api('report_get_v1',{...sharedPrepared.request,page:{}},student)).rows.items.length,1);
    await saveSettings('center',{report_templates:[{...report,key:'center_shared'}]});
    const centerSource=(await templates(student)).work_templates.reports.find(x=>x.source.scope==='center').source;assert.equal(centerSource.center_id,center);assert.equal((await api('settings_template_resolve_v1',{kind:'report',template:centerSource},student)).source.scope,'center');
    const otherAccount=await must(stranger,'account_get_v1'),otherOrg=(await must(platform,'organization_create_v1',{verified_account_id:otherAccount.id,name:'Synthetic other template scope',initial_plan_id:plan},key())).primary_id;
    const otherCenter=(await must(stranger,'center_create_v1',{org_id:otherOrg,name:'Other scoped center',timezone:'UTC'},key())).primary_id;
    await denied('settings_template_resolve_v1',{center_id:null,kind:'report',template:{...centerSource,center_id:otherCenter}},'NOT_FOUND',student);
    const foreign=await must(student,'settings_catalog_get_v1',{scope:'member',org_id:org,template_center_id:otherCenter});assert.deepEqual(foreign.work_templates,{reports:[],imports:[]});
    await saveSettings('member',{report_templates:[{...peer.reports[0].template,key:'own_copy'}]},student);assert.equal((await settings('member',student)).values.report_templates[0].key,'own_copy');
   }finally{
    const v=(await rows('select version from core.role_assignments where id=$1',[cm.primary_id]))[0].version;await api('center_manager_revoke_v1',{person_id:studentPerson,expected_version:Number(v),reason:'Synthetic temporary template reader grant ends'});
   }
   await denied('settings_template_resolve_v1',{kind:'report',template:sharedReportRef},'FORBIDDEN',student);await denied('report_get_v1',{...sharedPrepared.request,page:{}},'FORBIDDEN',student);
   const manager=(await rows("select version from core.role_assignments where org_id=$1 and person_id=$2 and role='center_manager' and state='active'",[org,ownerPerson]))[0];
   await api('center_manager_revoke_v1',{person_id:ownerPerson,expected_version:Number(manager.version),reason:'Synthetic org configuration is separate from import execution'});
   try{
    await saveSettings('organization',{import_templates:[{...imp,key:'shared_import'}]});const version=(await settings('organization')).version;
    await denied('settings_template_resolve_v1',{kind:'import',template:{scope:'organization',key:'shared_import',version}},'FORBIDDEN');assert.deepEqual((await templates()).work_templates.imports,[]);
   }finally{await api('center_manager_assign_v1',{person_id:ownerPerson});}
   const current=await settings('member');await denied('settings_update_v1',{scope:'member',org_id:org,center_id:undefined,expected_version:current.version,patch:{report_templates:[report,{...report,name:'Duplicate key'}]}},'VALIDATION_FAILED');
   await denied('settings_template_resolve_v1',{kind:'import',template:available.imports[0].source,overrides:{opening_credits:99}},'VALIDATION_FAILED');
  });
  await t.test('report preparation changes real grouping and CSV columns; later template edits do not rewrite the job',async()=>{
   const view=await api('report_get_v1',{...preparedReport.request,page:{}});assert.equal(view.rows.items.length,1);assert.equal(view.rows.items[0].amount_minor,'300');assert(!('person_id' in view.rows.items[0]));assert.deepEqual(view.columns,['group_key','amount_minor']);
   const counts=await api('report_get_v1',{...preparedReport.request,columns:['count'],group_by:'person',page:{}});assert.equal(counts.rows.items.length,2);for(const row of counts.rows.items)assert.deepEqual(Object.keys(row).sort(),['count','group_key']);
   const job=(await api('report_export_start_v1',{...preparedReport.request,format:'csv'})).job_id;
   const previous=(await templates()).work_templates.reports.find(x=>x.source.scope==='member');await saveSettings('member',{report_templates:[{...previous.template,columns:['count'],group_by:'person'}]});
   await denied('settings_template_resolve_v1',{kind:'report',template:previous.source},'VERSION_CONFLICT');
   await drain(p06,importTick);const file=await api('report_file_get_v1',{job_id:job});
   const response=await fetch(context().env.API_URL+file.download_path,{method:'POST',headers:{apikey:context().env.ANON_KEY,authorization:'Bearer '+owner.jwt,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key(),...scoped({job_id:job}),operation_key:key()})});assert(response.ok);
   const csv=await response.text(),lines=csv.split('\r\n').filter(Boolean);assert.equal(lines[0],'group_key,amount_minor');assert.equal(lines.length,2);assert.match(lines[1],/"300"/);assert(!csv.includes(studentPerson));
   await saveSettings('member',{report_templates:[{...previous.template,key:'subscriber_report',columns:['group_key','subscriber_number'],group_by:'person'}]});
   const subscriberTemplate=(await templates()).work_templates.reports.find(x=>x.source.scope==='member'&&x.template.key==='subscriber_report');assert(subscriberTemplate);
   const resolved=await api('settings_template_resolve_v1',{kind:'report',template:subscriberTemplate.source});assert.deepEqual(resolved.request.columns,['group_key','subscriber_number']);
   const numbered=await api('report_get_v1',{...resolved.request,page:{}});const subscriberNo=numbered.rows.items.find(x=>x.subscriber_number)?.subscriber_number;assert(subscriberNo);
   const numberedJob=(await api('report_export_start_v1',{...resolved.request,format:'csv'})).job_id;await drain(p06,importTick);const numberedFile=await api('report_file_get_v1',{job_id:numberedJob});
   const numberedResponse=await fetch(context().env.API_URL+numberedFile.download_path,{method:'POST',headers:{apikey:context().env.ANON_KEY,authorization:'Bearer '+owner.jwt,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key(),...scoped({job_id:numberedJob}),operation_key:key()})});assert(numberedResponse.ok);
   const numberedCsv=await numberedResponse.text();assert.equal(numberedCsv.split('\r\n')[0],'group_key,subscriber_number');assert(numberedCsv.includes('"'+subscriberNo+'"'));
   const shaped=(await rows('select private.work_report_rows($1,$2) v',[{report:'collections_debts',group_by:'total',report_order:'group_key_desc'},[{group_key:'a',count:1,amount_minor:'9007199254740993',currency:'TRY'},{group_key:'a',count:1,amount_minor:'2',currency:'TRY'},{group_key:'z',count:1,amount_minor:'7',currency:'TRY'},{group_key:'a',count:1,amount_minor:'9',currency:'USD'}]].map(JSON.stringify)))[0].v;
   assert.equal(shaped[0].group_key,'z');assert.equal(shaped.find(x=>x.group_key==='a'&&x.currency==='TRY').amount_minor,'9007199254740995');assert.equal(shaped.find(x=>x.currency==='USD').amount_minor,'9');
   const escaped=(await rows('select private.work_report_csv($1,$2,1024) v',[[{group_key:'=SUM(A1)',amount_minor:'7'}],['group_key','amount_minor']].map(JSON.stringify)))[0].v.toString('utf8');assert.match(escaped,/"'=SUM\(A1\)"/);
  });
  await t.test('import preparation is mapping only; explicit preview/apply retains its snapshot after template reset',async()=>{
   const source=(await templates()).work_templates.imports[0].source,prepared=await api('settings_template_resolve_v1',{kind:'import',template:source});assert.equal(prepared.request.mapping.delimiter,';');
   const f=await upload('id;name;ref\r\nprepared;Synthetic prepared;'+studentPerson+'\r\n'),before=await rows('select (select count(*) from core.people where org_id=$1)::int people,(select count(*) from core.sales where org_id=$1)::int sales,(select count(*) from core.debts where org_id=$1)::int debts',[org]);
   const next=await previewFile(f,prepared.request.source_namespace,key(),prepared.request.mapping);assert.equal(next.preview.import_summary.valid_rows,1);assert.equal(next.preview.import_summary.new_people,0);
   const value=(await settings('member')).values.import_templates[0];await saveSettings('member',{import_templates:[{...value,mapping:{...value.mapping,delimiter:','},source_namespace:'st03-changed-template'}]});await denied('settings_template_resolve_v1',{kind:'import',template:source},'VERSION_CONFLICT');
   await api('import_apply_v1',{preview:token(next.preview)});await drain(p06,importTick);assert.equal((await api('import_rows_list_v1',{job_id:next.job,page:{}})).items[0].state,'applied');
   assert.deepEqual(await rows('select (select count(*) from core.people where org_id=$1)::int people,(select count(*) from core.sales where org_id=$1)::int sales,(select count(*) from core.debts where org_id=$1)::int debts',[org]),before);
   const reset=await must(owner,'settings_reset_preview_v1',{scope:'member',org_id:org,fields:['import_templates']});await must(owner,'settings_reset_apply_v1',{scope:'member',org_id:org,expected_version:reset.version,preview:token(reset)},key());assert.deepEqual((await settings('member')).values.import_templates,[]);assert.equal((await settings('organization')).values.report_templates.length,1);
   assert.equal((await api('job_status_get_v1',{job_id:next.job})).state,'succeeded');
  });
  await t.test('Starter report totals survive pagination and authenticated export; files cannot cross account or expiry',async()=>{
   const b={report:'collections_debts',filters:filters(),page:{limit:1}};const report=await api('report_get_v1',b);assert.equal(report.rows.items.length,1);assert(report.rows.next_cursor);assert.equal(report.totals.find(x=>x.group_key==='outstanding_debt').amount_minor,'300');
   assert.equal((await api('report_get_v1',{...b,page:{limit:1,cursor:report.rows.next_cursor}})).rows.items.length,1);
   assert.equal((await api('report_get_v1',{report:'lesson_attendance',filters:filters(),page:{}})).report_kind,'lesson_attendance');
   const k=key(),body={report:'collections_debts',filters:filters(),format:'csv'};exportJob=(await api('report_export_start_v1',body,owner,k)).job_id;assert.equal((await api('report_export_start_v1',body,owner,k)).job_id,exportJob);await drain(p06,importTick);
   exportFile=await api('report_file_get_v1',{job_id:exportJob});
   const download=actor=>fetch(context().env.API_URL+exportFile.download_path,{method:'POST',headers:{apikey:context().env.ANON_KEY,authorization:'Bearer '+actor.jwt,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key(),...scoped({job_id:exportJob}),operation_key:key()})});
   const response=await download(owner);assert(response.ok);assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('content-type'),/^text\/csv/);assert.equal((await response.text()).split('\r\n').filter(Boolean).length,3);
   const forbidden=await download(student);assert.equal((await forbidden.json()).ok,false);
   await db.query("update core.report_jobs set expires_at=now()-interval '1 second' where id=$1",[exportJob]);await denied('report_file_get_v1',{job_id:exportJob},'OPERATION_RESULT_EXPIRED');
   const expired=await download(owner),expiredBody=await expired.json();assert.equal(expiredBody.ok,false);assert.equal(expiredBody.error.code,'OPERATION_RESULT_EXPIRED');assert.equal(expiredBody.data,undefined);

  });
  await t.test('transactional completion reaches only requester inbox; preferences, read versions and replay never create loops',async()=>{
   await must(owner,'settings_update_v1',{scope:'member',org_id:org,expected_version:(await settings('member')).version,patch:{in_app_reminders:false,in_app_marketing:false}},key());
   const delivery=await rows("select j.id,j.notification_id,j.state,n.kind from core.outbox_jobs j join core.notifications n on n.org_id=j.org_id and n.id=j.notification_id where j.org_id=$1 and j.kind='in_app' and n.recipient_person_id=$2 and ((n.kind='report_build_v1' and n.subject_id=$3) or (n.kind='import_rows_process_v1' and n.subject_id=$4)) order by j.id",[org,ownerPerson,exportJob,importJob]);
   assert(delivery.some(x=>x.kind==='report_build_v1'));assert(delivery.some(x=>x.kind==='import_rows_process_v1'));assert(delivery.every(x=>x.state==='pending'));
   await drain(p05,notificationsTick);
   const delivered=await rows("select j.id,j.notification_id,j.state,p.operation,p.result,(select count(*)::int from core.operation_receipts r where r.org_id=j.org_id and r.operation='outbox_deliver_v1' and r.actor_fingerprint=$3 and r.key_hash=encode(extensions.digest(p.operation_key::text,'sha256'),'hex') and r.state='succeeded' and r.business_reference=j.notification_id and r.result=p.result) receipts from core.outbox_jobs j left join private.p05_jobs p on p.org_id=j.org_id and p.job_id=j.id where j.org_id=$1 and j.id=any($2::uuid[]) order by j.id",[org,delivery.map(x=>x.id),'worker:p05:'+roles[0]]);
   assert.equal(delivered.length,delivery.length);
   for(const job of delivered){assert.equal(job.state,'succeeded');assert.equal(job.operation,'outbox_deliver_v1');assert.equal(job.result?.ok,true);assert.equal(job.result.data.job_id,job.id);assert.deepEqual(job.result.data.result_reference,{type:'notifications',id:job.notification_id});assert.equal(job.receipts,1);}
   const list=()=>api('notifications_list_v1',{page:{limit:200},unread_only:false});
   const inbox=await list(),completion=inbox.items.find(x=>x.kind==='report_build_v1'&&x.payload.subject.id===exportJob);assert(completion);assert(inbox.items.some(x=>x.kind==='import_rows_process_v1'&&x.payload.subject.id===importJob));
   const other=await api('notifications_list_v1',{page:{limit:200},unread_only:false},student);assert(!other.items.some(x=>x.payload.subject.id===exportJob||x.payload.subject.id===importJob));
   await denied('notification_mark_read_v1',{notification_id:completion.id,expected_version:1},'NOT_FOUND',student);
   await denied('notification_preferences_set_v1',{channel:'in_app',purpose:'transactional',enabled:false,expected_version:1},'FORBIDDEN');
   const count=(await rows('select count(*)::int n from core.notifications where org_id=$1',[org]))[0].n;
   const k=key(),b={notification_id:completion.id,expected_version:1};await api('notification_mark_read_v1',b,owner,k);assert.equal((await api('notification_mark_read_v1',b,owner,k)).replayed,true);
   await denied('notification_mark_read_v1',b,'VERSION_CONFLICT');assert((await list()).items.find(x=>x.id===completion.id).read_at);
   assert(!(await api('notifications_list_v1',{page:{limit:200},unread_only:true})).items.some(x=>x.id===completion.id));assert.equal((await rows('select count(*)::int n from core.notifications where org_id=$1',[org]))[0].n,count);
   assert.equal((await rows("select count(*)::int n from core.outbox_jobs where org_id=$1 and kind in ('p05.reminder','p05.automation','email')",[org]))[0].n,0);
  });
});
