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

test('ST-02 work template privacy and live authority',{timeout:300000},async t=>{
 const fixture=await reportFixture(t);
 const {platform,plan,owner,student,stranger,db,rows,workers,roles,files,org,center,ownerPerson,studentPerson,version,scoped,api,denied,interval,filters,headers,mapping,token,drain,upload,previewFile,p05,p06,settings,saveSettings,templates}=fixture;
 let preparedReport,sharedReportRef;
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
});
