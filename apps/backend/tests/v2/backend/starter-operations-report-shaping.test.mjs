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


async function reportFixture(t){
 const fixture=await operationsFixture(t);
 const {db,org,headers,studentPerson,version,upload,previewFile,api,token,drain,p06}=fixture;
 // Native opening balances are fixture prerequisites; their assertions remain in the import root.
 await db.query('insert into private.p06_configuration values($1,2097152,5000,16777216)',[org]);
 const start=new Date(Date.now()-86400000).toISOString().slice(0,10),end=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 const csv=headers.join(',')+'\r\nexisting,"Synthetic, existing",'+studentPerson+',2,1000,200,TRY,'+version+','+start+','+end+'\r\nnew,Synthetic new,,,,100,TRY,,,\r\nbad,Synthetic invalid,,,,bad,TRY,,,\r\n';
 const uploaded=await upload(csv);const opening=await previewFile(uploaded,'st02-opening');
 await api('import_apply_v1',{preview:token(opening.preview)});await drain(p06,importTick);
 return {...fixture,importJob:opening.job};
}

function workTemplateDefinitions({filters,center}){
 return {
  report:{key:'private_report',name:'Synthetic private debt report',report:'collections_debts',filters:filters(),columns:['group_key','amount_minor'],report_order:'group_key_desc',group_by:'total'},
  imp:{key:'private_import',name:'Synthetic mapping',center_id:center,source_namespace:'st03-templates',mapping:{delimiter:';',columns:[{source_column:'id',target:'source_key'},{source_column:'name',target:'display_name'},{source_column:'ref',target:'person_ref'}]}}
 };
}

test('ST-02 report shaping and immutable export snapshots',{timeout:300000},async t=>{
 const fixture=await reportFixture(t);
 const {platform,plan,owner,student,stranger,db,rows,workers,roles,files,org,center,ownerPerson,studentPerson,version,scoped,api,denied,interval,filters,headers,mapping,token,drain,upload,previewFile,p05,p06,settings,saveSettings,templates}=fixture;
 const {report}=workTemplateDefinitions(fixture);
 await saveSettings('member',{report_templates:[report]});
 const source=(await templates()).work_templates.reports.find(x=>x.source.scope==='member').source;
 const preparedReport=await api('settings_template_resolve_v1',{kind:'report',template:source,overrides:{filters:{currency:'TRY'}}});
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
});
