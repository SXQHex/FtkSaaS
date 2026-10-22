// Runs in the existing isolated registry shard; no extra clean suite or shard.
import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {createHash,randomBytes} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {tick} from '../scripts/p06-worker.mjs';
import * as validators from '../supabase/functions/backend-v1/validators.js';
test('P06 actual Auth/private CSV/preview/ledger/report/recovery/scoped worker acceptance',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('p06-owner'),staff=await authUser('p06-report'),stranger=await authUser('p06-stranger');
 const account=await must(owner,'account_get_v1'),staffAccount=await must(staff,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P06',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'P06',timezone:'UTC'},key())).primary_id;
 const db=await connect(),files=[];let worker,trigger;const role='p06_w_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');
 const rows=async(q,a=[])=>(await db.query(q,a)).rows;const scope=b=>({org_id:org,center_id:center,...b});
 const mut=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const bank=()=>Array.from({length:4096},key);
 const claim=async(limit=1)=>(await worker.query('select private.p06_jobs_claim($1,$2,$3) jobs',[org,bank(),limit])).rows[0].jobs;
 const invoke=async j=>{assert(validators['request_'+j.operation](j.request));const r=(await worker.query('select private.p06_worker_execute($1,$2,$3) result',[j.operation,j.request,bank()])).rows[0].result;if(r.ok)assert(validators['success_'+j.operation](r),JSON.stringify(r));return r;};
 const drain=async()=>{for(let n=0;n<10;n++){const jobs=await claim();if(!jobs.length)return;for(const j of jobs){const r=await invoke(j);assert(r.ok,JSON.stringify(r));}}throw Error('P06 worker did not drain within bounded fixture');};
 const mapping={columns:['source_key','display_name','opening_debt_minor','currency'].map(target=>({source_column:target,target}))};
 let uploaded,job,preview,exportJob,creditProduct,staffPerson;
 const interval={starts_at:new Date(Date.now()-86400000).toISOString(),ends_at:new Date(Date.now()+86400000).toISOString()},filters={interval,center_ids:[center]};
 async function upload(text,checksum=createHash('sha256').update(text).digest('hex')){
  const file=await mut('import_upload_prepare_v1',{filename:'synthetic.csv',mime:'text/csv',bytes:Buffer.byteLength(text),checksum});files.push(file.file_id);
  const sent=await fetch(new URL(file.upload_url,context().env.API_URL),{method:'PUT',headers:{apikey:context().env.ANON_KEY,'content-type':'text/csv'},body:text});assert(sent.ok,'Private CSV upload HTTP '+sent.status);return file;
 }
 async function beginPreview(file,namespace='p06-fixture',map=mapping,k=key()){
  return mut('import_preview_v1',{file_id:file.file_id,mapping:map,source_namespace:namespace},k);
 }
 async function getPreview(id){const s=await must(owner,'job_status_get_v1',scope({job_id:id}));assert.equal(s.state,'succeeded');assert.equal(s.result_reference.type,'previews');return must(owner,'preview_get_v1',scope({preview_id:s.result_reference.id}));}
 try{
 const person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;await mut('center_manager_assign_v1',{person_id:person});
 const payment=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic p06',occurred_at:new Date().toISOString()});await mut('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},key(),platform);
 await db.query(`create role "${role}" login password '${password}'`);await db.query(`grant ftk_p06_worker to "${role}"`);await db.query('insert into private.p06_worker_scopes values($1,$2)',[role,org]);
 const u=new URL(context().env.DB_URL);u.username=role;u.password=password;worker=new pg.Client({connectionString:u.href});await worker.connect();
 await t.test('explicit config, tenant and import permission gates precede file/job writes',async()=>{
  await fail('import_upload_prepare_v1',{filename:'x.csv',mime:'text/csv',bytes:1,checksum:'0'.repeat(64)},'POLICY_NOT_CONFIGURED');
  await db.query('insert into private.p06_configuration values($1,2097152,5000,16777216)',[org]);
  await fail('import_upload_prepare_v1',{filename:'x.csv',mime:'text/csv',bytes:1,checksum:'0'.repeat(64)},'NOT_FOUND',stranger);
  await fail('import_upload_prepare_v1',{filename:'x.csv',mime:'application/pdf',bytes:1,checksum:'0'.repeat(64)},'VALIDATION_FAILED');
  await assert.rejects(worker.query('select * from core.people'),/permission denied/);await assert.rejects(worker.query('select * from private.p06_jobs'),/permission denied/);
  const human=await call(owner,'import_rows_process_v1',scope({job_id:key(),lease_token:'x'.repeat(64)}),key());assert.equal(human.result.error.code,'FORBIDDEN');
 });
 const csv='source_key,display_name,opening_debt_minor,currency\r\n'+Array.from({length:27},(_,i)=>`r${i},"Synthetic ${i}",100,TRY`).join('\r\n')+'\r\ninvalid,"Bad amount",bad,TRY\r\n';
 await t.test('actual bytes/checksum and strict CSV precede an idempotent technical job',async()=>{
  const wrong=await upload(csv,'0'.repeat(64));const before=(await rows('select count(*)::int n from core.import_jobs where org_id=$1',[org]))[0].n;
  await fail('import_preview_v1',{file_id:wrong.file_id,mapping,source_namespace:'bad-checksum'},'VALIDATION_FAILED');assert.equal((await rows('select count(*)::int n from core.import_jobs where org_id=$1',[org]))[0].n,before);
  uploaded=await upload(csv);
  await mut('file_upload_complete_v1',{file_id:uploaded.file_id,checksum:createHash('sha256').update(csv).digest('hex')});
  const complete=await must(owner,'management_state_get_v1',scope({operation:'file_upload_complete_v1',selector:{operation:'file_upload_complete_v1',key:{file_id:uploaded.file_id}}}));assert.equal(complete.items[0].state,'ready');
  const k=key(),a=await beginPreview(uploaded,'p06-fixture',mapping,k);job=a.job_id;assert.equal((await beginPreview(uploaded,'p06-fixture',mapping,k)).job_id,job);
  const status=await must(owner,'operation_status_get_v1',scope({operation:'import_preview_v1',key:k}));assert.equal(status.result_available,true);assert.equal(status.result_reference.id,job);
  await fail('import_preview_v1',{file_id:uploaded.file_id,mapping,source_namespace:'changed'},'IDEMPOTENCY_PAYLOAD_MISMATCH',owner,k);
  const direct=await fetch(context().env.API_URL+'/storage/v1/object/authenticated/ftksaas-imports/'+org+'/'+uploaded.file_id,{headers:{apikey:context().env.ANON_KEY,authorization:'Bearer '+owner.jwt}});assert.equal(direct.ok,false);
  await drain();assert.equal((await rows('select count(*)::int n from core.people where org_id=$1',[org]))[0].n,1);assert.equal((await rows('select count(*)::int n from core.debts where org_id=$1',[org]))[0].n,0);preview=await getPreview(job);assert.equal(preview.import_summary.new_people,27);assert.equal(preview.import_summary.invalid_rows,1);assert.equal(preview.import_summary.opening_debt_totals[0].amount_minor,'2700');
  const list=await must(owner,'import_rows_list_v1',scope({job_id:job,page:{limit:50}}));assert.equal(list.items.length,28);assert.equal(list.items.filter(x=>x.state==='invalid').length,1);assert.equal('payload' in list.items[0],false);
 });
 await t.test('preview dependency changes reject apply; late audit failure rolls back the whole batch',async()=>{
  await db.query('update private.p06_configuration set max_import_rows=4999 where org_id=$1',[org]);await fail('import_apply_v1',{preview:{id:preview.id,token:preview.token}},'PREVIEW_STALE');await db.query('update private.p06_configuration set max_import_rows=5000 where org_id=$1',[org]);
  await mut('import_apply_v1',{preview:{id:preview.id,token:preview.token}});
  const stale=(await claim())[0];await db.query('update private.p06_configuration set max_import_rows=4999 where org_id=$1',[org]);const fenced=await invoke(stale);assert.equal(fenced.error.code,'PREVIEW_STALE');await db.query('update private.p06_configuration set max_import_rows=5000 where org_id=$1',[org]);await db.query('update core.outbox_jobs set next_attempt_at=clock_timestamp() where id=$1',[job]);
  const j=(await claim())[0];assert(j);trigger='p06_fail_'+key().replaceAll('-','');
  await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='import_rows_process_v1' then raise exception 'synthetic late audit failure' using errcode='23514';end if;return new;end$$`);await db.query(`create trigger ${trigger} before insert on core.audit_events for each row execute function private.${trigger}()`);
  try{const r=await invoke(j);assert.equal(r.ok,false);assert.equal(r.error.code,'INTEGRITY_VIOLATION');assert.equal((await rows('select count(*)::int n from core.people where org_id=$1',[org]))[0].n,1);assert.equal((await rows('select count(*)::int n from private.p06_sources where org_id=$1',[org]))[0].n,0);assert.equal((await rows("select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=encode(extensions.digest($2::text,'sha256'),'hex')",[org,j.request.operation_key]))[0].n,0);}
  finally{await db.query(`drop trigger ${trigger} on core.audit_events`);await db.query(`drop function private.${trigger}()`);trigger=null;}
  await db.query('update core.outbox_jobs set next_attempt_at=clock_timestamp() where id=$1',[job]);const fresh=(await claim())[0];await assert.rejects(invoke(j),/FORBIDDEN/);assert((await invoke(fresh)).ok);assert.deepEqual(await invoke(fresh),await invoke(fresh));await drain();
  assert.equal((await rows('select count(*)::int n from core.people where org_id=$1',[org]))[0].n,28);assert.equal((await rows('select count(*)::int n from core.debts where org_id=$1',[org]))[0].n,27);
 });
 await t.test('re-upload dedupe preserves successful rows and rejects changed source payloads',async()=>{
  const repeat=await beginPreview(uploaded);await drain();const p=await getPreview(repeat.job_id);assert.equal(p.import_summary.replayed_rows,27);assert.equal(p.import_summary.new_people,0);await mut('import_apply_v1',{preview:{id:p.id,token:p.token}});await drain();
  assert.equal((await rows('select count(*)::int n from core.people where org_id=$1',[org]))[0].n,28);assert.equal((await rows('select count(*)::int n from core.debts where org_id=$1',[org]))[0].n,27);
  const changed=await upload('source_key,display_name,opening_debt_minor,currency\nr0,Changed,100,TRY\n');const next=await beginPreview(changed);await drain();const rs=await must(owner,'import_rows_list_v1',scope({job_id:next.job_id,page:{}}));assert.equal(rs.items[0].error_code,'IDEMPOTENCY_PAYLOAD_MISMATCH');
 });
 await t.test('opening rights and independent debt use existing ledgers without a cash movement or email merge',async()=>{
  creditProduct=(await mut('product_publish_v1',{terms:{name:'P06 source package',kind:'credits',booking_mode:'flexible',credits:10,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'credit_ratio'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
  const start=new Date(Date.now()-86400000).toISOString().slice(0,10),end=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const headers=['source_key','display_name','email','opening_credits','opening_credit_value_minor','opening_debt_minor','currency','product_version_ref','start_date','end_date'];const opening=await upload(headers.join(',')+'\nopen-1,Opening learner,synthetic@ftksaas.invalid,3,1000,200,TRY,'+creditProduct+','+start+','+end+'\n');
  const before=(await rows('select count(*)::int n from core.cash_movements where org_id=$1',[org]))[0].n;
  const next=await beginPreview(opening,'p06-opening',{columns:headers.map(target=>({source_column:target,target}))});await drain();const p=await getPreview(next.job_id);await mut('import_apply_v1',{preview:{id:p.id,token:p.token}});await drain();
  const rs=await must(owner,'import_rows_list_v1',scope({job_id:next.job_id,page:{}}));assert.equal(rs.items[0].state,'applied',JSON.stringify(rs));const sale=rs.items[0].created_references.find(x=>x.type==='sales');assert(sale);
  assert.equal((await rows("select sum(quantity)::int n from core.entitlement_movements where org_id=$1 and sale_id=$2 and kind='grant'",[org,sale.id]))[0].n,3);assert.equal((await rows('select count(*)::int n from core.cash_movements where org_id=$1',[org]))[0].n,before);
  assert.equal((await rows('select private.credit_available($1,$2)::int n',[org,sale.id]))[0].n,3);assert.equal((await rows('select net_minor::text n from core.sales where id=$1',[sale.id]))[0].n,'1000');
 });
 await t.test('occurred occupancy, working-hours resource denominator and single-center counterpart movement stay visible',async()=>{
  const day=new Date(Date.now()-86400000).toISOString().slice(0,10),next=new Date(Date.parse(day)+86400000).toISOString().slice(0,10),discipline=key(),session=key(),room=key();
  await db.query("insert into core.disciplines(id,org_id,name,state) values($1,$2,'P06 reports','active')",[discipline,org]);await db.query("insert into core.rooms(id,org_id,center_id,name,state) values($1,$2,$3,'P06 room','active')",[room,org,center]);
  await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,4,6,'occurred','closed')",[session,org,center,discipline,day+'T09:00:00Z',day+'T10:00:00Z']);
  await db.query("insert into core.availability_rules(id,org_id,center_id,resource_kind,resource_id,weekdays,local_start,local_end,valid_from) values($1,$2,$3,'room',$4,array[1,2,3,4,5,6,7],'09:00','17:00',$5)",[key(),org,center,room,day]);
  await db.query("insert into core.availability_exceptions(id,org_id,center_id,resource_kind,resource_id,starts_at,ends_at,reason) values($1,$2,$3,'room',$4,$5,$6,'synthetic closure')",[key(),org,center,room,day+'T12:00:00Z',day+'T13:00:00Z']);
  await db.query("insert into core.resource_bookings(id,org_id,center_id,session_id,resource_kind,resource_id,starts_at,ends_at,state) values($1,$2,$3,$4,'room',$5,$6,$7,'active')",[key(),org,center,session,room,day+'T09:00:00Z',day+'T10:00:00Z']);
  const f={interval:{starts_at:day+'T00:00:00Z',ends_at:next+'T00:00:00Z'},center_ids:[center]};
  const occupancy=await must(owner,'report_get_v1',scope({report:'occupancy',filters:f,page:{}}));assert.equal(occupancy.rows.items.length,1);assert.equal(occupancy.rows.items[0].basis_count,4);
  const usage=await must(owner,'report_get_v1',scope({report:'resource_usage',filters:f,page:{}}));const used=usage.rows.items.find(x=>x.group_key==='resource:room:'+room);assert.equal(used.count,3600);assert.equal(used.basis_count,25200);assert.equal(used.ratio_bps,1428);
  const other=(await must(owner,'center_create_v1',{org_id:org,name:'P06 counterpart',timezone:'UTC'},key())).primary_id;
  await db.query("insert into private.settlement_movements(id,org_id,debtor_center_id,creditor_center_id,currency,amount_minor,open_minor,kind,operation_id) values($1,$2,$3,$4,'TRY',100,100,'accrual',$5)",[key(),org,center,other,key()]);
  const cross=await must(owner,'report_get_v1',scope({report:'cross_center_usage',filters,page:{}}));assert(cross.rows.items.some(x=>x.group_key==='outgoing_to:'+other&&x.center_id===center&&x.amount_minor==='100'));
 });
 await t.test('reports cover every authorized row and exact full-result totals; export is complete and authenticated',async()=>{
  const report=await must(owner,'report_get_v1',scope({report:'collections_debts',filters,page:{limit:1}}));assert.equal(report.rows.items.length,1);assert(report.rows.next_cursor);assert.equal(report.totals.find(x=>x.group_key==='outstanding_debt').amount_minor,'2900');
  const page=await must(owner,'report_get_v1',scope({report:'collections_debts',filters,page:{limit:1,cursor:report.rows.next_cursor}}));assert.notDeepEqual(page.rows.items,report.rows.items);
  await fail('report_get_v1',{report:'collections_debts',filters:{...filters,currency:'EUR'},page:{cursor:report.rows.next_cursor}},'VALIDATION_FAILED');
  for(const report of ['lesson_attendance','renewal','occupancy','resource_usage','earnings','crm_conversion','cross_center_usage'])await must(owner,'report_get_v1',scope({report,filters,page:{}}));
  const k=key();exportJob=(await mut('report_export_start_v1',{report:'collections_debts',filters,format:'csv'},k)).job_id;assert.equal((await mut('report_export_start_v1',{report:'collections_debts',filters,format:'csv'},k)).job_id,exportJob);await drain();
  const ref=await mut('report_file_get_v1',{job_id:exportJob});assert(!ref.download_path.includes('token='));
  const response=await fetch(context().env.API_URL+ref.download_path,{method:'POST',headers:{apikey:context().env.ANON_KEY,authorization:'Bearer '+owner.jwt,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key(),org_id:org,center_id:center,operation_key:key(),job_id:exportJob})});assert(response.ok);assert.match(response.headers.get('content-type'),/^text\/csv/);const csv=await response.text();assert.equal(csv.split('\r\n').filter(Boolean).length,29);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal((await rows("select private.p06_csv_cell('=1+1') cell"))[0].cell,"\"'=1+1\"");
  const audit=await must(owner,'audit_list_v1',scope({subject:{type:'import_jobs',id:job},interval,page:{}}));assert(audit.items.length);assert(audit.items.every(x=>!JSON.stringify(x).includes('worker_role')));
 });
 await t.test('opening credits settle consumed negative balances first without recreating attendance, earning or cash',async()=>{
  const target=(await rows("select person_id from private.p06_sources where org_id=$1 and source_namespace='p06-fixture' and source_key='r0'",[org]))[0].person_id,discipline=key();
  await db.query("insert into core.disciplines(id,org_id,name,state) values($1,$2,'P06 negative settlement','active')",[discipline,org]);await db.query("insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values($1,$2,$3,$4,'active')",[key(),org,center,discipline]);
  const policy=(await mut('policy_publish_v1',{center_id:null,key:'student_cancel_group',value:{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}},effective_at:new Date(Date.now()-86400000).toISOString(),mandatory:false})).primary_id;
  const service=(await rows('select id from core.centers where org_id=$1 and id<>$2 order by id limit 1',[org,center]))[0].id;await db.query("insert into core.center_disciplines(id,org_id,center_id,discipline_id,state) values($1,$2,$3,$4,'active')",[key(),org,service,discipline]);await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'student','active',now())",[key(),org,service,target]);
  const oldAttendance=(await rows('select count(*)::int n from core.attendance_entries where org_id=$1',[org]))[0].n,oldEarnings=(await rows('select count(*)::int n from core.earnings where org_id=$1',[org]))[0].n;
  for(let i=0;i<4;i++){const session=key(),reservation=key(),local=i===0?service:center,at=new Date(Date.now()-(8-i)*86400000);await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,10,10,'occurred','closed')",[session,org,local,discipline,at,new Date(+at+3600000)]);await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','completed',$6)",[reservation,org,local,session,target,policy]);await db.query("insert into core.credit_deficits(id,org_id,person_id,reservation_id,quantity,state,center_id,discipline_id,session_id) values($1,$2,$3,$4,1,'consumed',$5,$6,$7)",[key(),org,target,reservation,local,discipline,session]);if(i===0)await db.query("insert into core.attendance_closures(id,org_id,center_id,session_id,revision,closed_by,closed_at,earnings_snapshot) values($1,$2,$3,$4,1,$5,now(),'[{\"performed\":true}]')",[key(),org,local,session,person]);}
  const headers=['source_key','display_name','person_ref','opening_credits','opening_credit_value_minor','opening_debt_minor','currency','product_version_ref','start_date','end_date'];const file=await upload(headers.join(',')+'\nnegative-open,Existing learner,'+target+',5,1000,100,TRY,'+creditProduct+','+new Date().toISOString().slice(0,10)+','+new Date(Date.now()+7*86400000).toISOString().slice(0,10)+'\n');
  const pending=await beginPreview(file,'p06-negative',{columns:headers.map(target=>({source_column:target,target}))});await drain();const p=await getPreview(pending.job_id);await mut('import_apply_v1',{preview:{id:p.id,token:p.token}});await drain();const result=await must(owner,'import_rows_list_v1',scope({job_id:pending.job_id,page:{}}));assert.equal(result.items[0].state,'applied',JSON.stringify(result));const sale=result.items[0].created_references.find(x=>x.type==='sales');assert(sale);assert.equal((await rows('select private.credit_available($1,$2)::int n',[org,sale.id]))[0].n,1);assert.equal((await rows("select amount_minor::text amount from private.settlement_movements where org_id=$1 and source_sale_id=$2 and kind='accrual'",[org,sale.id]))[0].amount,'100');assert.equal((await rows("select count(*)::int n from core.credit_deficits where org_id=$1 and person_id=$2 and state='settled'",[org,target]))[0].n,4);
  assert.equal((await rows('select count(*)::int n from core.attendance_entries where org_id=$1',[org]))[0].n,oldAttendance);assert.equal((await rows('select count(*)::int n from core.earnings where org_id=$1',[org]))[0].n,oldEarnings);assert.equal((await rows('select count(*)::int n from core.cash_movements where org_id=$1',[org]))[0].n,0);
 });
 await t.test('expired lease reclaim fences the old request and a changed replay payload',async()=>{
  const id=(await mut('report_export_start_v1',{report:'collections_debts',filters,format:'csv'})).job_id,old=(await claim())[0];assert.equal(old.request.job_id,id);
  await db.query("update core.outbox_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[id]);const fresh=(await claim())[0];assert.equal(fresh.request.job_id,id);await assert.rejects(invoke(old),/FORBIDDEN/);const result=await invoke(fresh);assert(result.ok);assert.deepEqual(await invoke(fresh),result);
  await assert.rejects(invoke({...fresh,request:{...fresh.request,center_id:null}}),/IDEMPOTENCY_PAYLOAD_MISMATCH/);
 });
 await t.test('financial grant, live plan, account/link and lease fences apply to result recovery',async()=>{
  staffPerson=(await mut('person_create_v1',{display_name:'Scoped report staff',contacts:[]})).primary_id;const link=key();await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[link,org,staffAccount.id,staffPerson]);await db.query("insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values($1,$2,$3,'staff',$4,'active',$5)",[key(),org,staffPerson,center,link]);
  for(const permission of ['report.read','report.export'])await db.query('insert into core.permission_overrides(id,org_id,center_id,person_id,permission,enabled) values($1,$2,$3,$4,$5,true)',[key(),org,center,staffPerson,permission]);
  await fail('report_get_v1',{report:'collections_debts',filters,page:{}},'FORBIDDEN',staff);await fail('import_upload_prepare_v1',{filename:'x.csv',mime:'text/csv',bytes:1,checksum:'0'.repeat(64)},'FORBIDDEN',staff);
  await db.query("insert into core.permission_overrides(id,org_id,center_id,person_id,permission,enabled) values($1,$2,$3,$4,'finance.read',true)",[key(),org,center,staffPerson]);const k=key();const s=(await mut('report_export_start_v1',{report:'collections_debts',filters,format:'csv'},k,staff)).job_id;await drain();await mut('report_file_get_v1',{job_id:s},key(),staff);
  const deniedJob=(await mut('report_export_start_v1',{report:'collections_debts',filters,format:'csv'},key(),staff)).job_id,validJob=(await mut('report_export_start_v1',{report:'collections_debts',filters,format:'csv'})).job_id;
  await db.query("update core.permission_overrides set enabled=false,version=version+1 where org_id=$1 and person_id=$2 and permission='finance.read'",[org,staffPerson]);
  const mixed=await tick(worker,org,{limit:2});assert.equal(mixed.length,2);assert.equal(mixed.filter(x=>x.ok).length,1);assert.equal(mixed.find(x=>!x.ok).error.code,'FORBIDDEN');assert.equal((await rows('select state from core.outbox_jobs where id=$1',[validJob]))[0].state,'succeeded');
  for(let attempt=0;attempt<2;attempt++){await db.query('update core.outbox_jobs set next_attempt_at=clock_timestamp() where id=$1',[deniedJob]);const retry=await tick(worker,org);assert.equal(retry[0].ok,false);}
  assert.equal((await rows('select state,attempts from core.outbox_jobs where id=$1',[deniedJob]))[0].state,'failed');assert.equal((await rows('select attempts from core.outbox_jobs where id=$1',[deniedJob]))[0].attempts,3);
await fail('report_file_get_v1',{job_id:s},'FORBIDDEN',staff);await fail('job_status_get_v1',{job_id:s},'FORBIDDEN',staff);await fail('operation_status_get_v1',{operation:'report_export_start_v1',key:k},'FORBIDDEN',staff);
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);await fail('report_get_v1',{report:'renewal',filters,page:{}},'PLAN_FEATURE_UNAVAILABLE');await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);
  await db.query('delete from private.p06_worker_scopes where db_role=$1',[role]);await assert.rejects(claim(),/FORBIDDEN/);await db.query('insert into private.p06_worker_scopes values($1,$2)',[role,org]);
 });
 }finally{
  if(trigger){await db.query(`drop trigger if exists ${trigger} on core.audit_events`);await db.query(`drop function if exists private.${trigger}()`);}
  if(worker)await worker.end();await db.query('delete from private.p06_worker_scopes where db_role=$1',[role]);await db.query(`drop role if exists "${role}"`);
  if(files.length){const {env}=context();const removed=await fetch(env.API_URL+'/storage/v1/object/ftksaas-imports',{method:'DELETE',headers:{authorization:'Bearer '+env.SERVICE_ROLE_KEY,apikey:env.SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({prefixes:files.map(fid=>org+'/'+fid)})});assert(removed.ok,'P06 synthetic Storage cleanup failed');}
  await db.end();
 }
});
