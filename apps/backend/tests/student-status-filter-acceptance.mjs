import test from 'node:test';import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Student status filters selected-center current membership before pagination and binds cursors',{timeout:300000},async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('status-owner'),member=await authUser('status-member'),stranger=await authUser('status-stranger');
 const account=await must(owner,'account_get_v1'),memberAccount=await must(member,'account_get_v1'),db=await connect();t.after(()=>db.end());
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic status filtering',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Status first',timezone:'UTC'},key())).primary_id,other=(await must(owner,'center_create_v1',{org_id:org,name:'Status second',timezone:'UTC'},key())).primary_id;
 const api=(op,b={},u=owner)=>must(u,op,{org_id:org,center_id:center,...b},key());
 const manager=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;await api('center_manager_assign_v1',{person_id:manager});await api('center_manager_assign_v1',{center_id:other,person_id:manager});
 const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic filter',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
 const people=[];for(let i=0;i<7;i++)people.push((await api('person_create_v1',{display_name:'Synthetic status '+i,contacts:[]})).primary_id);
 const relation=async(pid,c,state)=>db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at,ended_at) values($1,$2,$3,$4,'student',$5,now()-interval '1 day',case when $5='inactive' then now() else null end)",[key(),org,c,pid,state]);
 // Persisted membership snapshots isolate the reader. Public activate/deactivate acceptance owns lifecycle writes.
 for(let i=0;i<4;i++)await relation(people[i],center,'inactive');
 await relation(people[4],center,'active');await relation(people[5],center,'inactive');await relation(people[5],center,'active');
 await relation(people[4],other,'inactive');await relation(people[0],other,'active');
 const read=(b={},u=owner)=>api('people_list_v1',{query:'Synthetic status',page:{limit:1},...b},u);
 const all=async b=>{const ids=[];let cursor;do{const p=await read({...b,page:{limit:1,...(cursor?{cursor}:{})}});ids.push(...p.items.map(x=>x.id));cursor=p.next_cursor;}while(cursor);assert.equal(new Set(ids).size,ids.length);return ids.sort();};
 await t.test('organization reads share the row lock and retain the write fence',async()=>{
  const room=(await api('room_save_v1',{name:'Synthetic shared lock room',capacity:10})).primary_id;
  const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Synthetic shared lock discipline',state:'active'},key())).primary_id;
  const reader=await connect();
  const reads=[
   ['people_list_v1',{center_id:center,student_status:'active',page:{limit:1}}],
   ['roles_list_v1',{center_id:center,page:{limit:1}}],
   ['centers_list_v1',{}],
   ['centers_list_v1',{center_id:center,include_setup_status:true}],
   ['subscription_get_v1',{}],
   ['settings_get_v1',{scope:'organization'}],
   ['settings_catalog_get_v1',{scope:'organization'}],
   ['management_state_get_v1',{center_id:center,operation:'availability_exception_save_v1',selector:{operation:'availability_exception_save_v1',key:{resource:{kind:'room',id:room}}}}],
   ['management_state_get_v1',{center_id:center,operation:'center_discipline_set_v1',selector:{operation:'center_discipline_set_v1',key:{discipline_id:discipline}}}],
  ];
  try{
   for(const [operation,body] of reads){
    await db.query('begin');
    await db.query('select id from core.organizations where id=$1 for share',[org]);
    await reader.query('begin');
    await reader.query("set local lock_timeout='250ms'");
    await reader.query("set local request.jwt.claim.role='service_role'");
    const request={client_api_version:1,request_id:key(),org_id:org,...body};
    const {rows:[{result}]}=await reader.query(
     'select private.execute_operation($1,$2,$3,$4,$5,$6) as result',
     [operation,request,owner.id,owner.session_id,Array.from({length:32},key),{verified_aal:'aal1'}],
    );
    assert.equal(result.ok,true,operation+' must finish with another read holding the organization lock');
    await db.query('rollback');
    await assert.rejects(
     db.query('select id from core.organizations where id=$1 for update nowait',[org]),
     {code:'55P03'},
    );
    await reader.query('rollback');
   }
  }finally{
   await db.query('rollback');
   try{await reader.query('rollback');}finally{await reader.end();}
  }
 });
 await t.test('all matching pages are complete despite earlier opposite-state rows',async()=>{
  assert.deepEqual(await all({student_status:'active'}),[people[4],people[5]].sort());assert.deepEqual(await all({student_status:'inactive'}),people.slice(0,4).sort());
  assert.deepEqual(await all({relationship:'student',student_status:'active'}),[people[4],people[5]].sort());
  assert.deepEqual(await all({relationship:'student'}),people.slice(0,6).sort());assert.deepEqual(await all({}),people.slice().sort());
 });
 await t.test('selected center status and name query compose; no unrelated nonstudent becomes inactive',async()=>{
  assert.deepEqual(await all({center_id:other,student_status:'active'}),[people[0]]);assert.deepEqual(await all({center_id:other,student_status:'inactive'}),[people[4]]);
  assert.deepEqual(await all({student_status:'inactive',query:'Synthetic status 6'}),[]);
 });
 await t.test('different status, center or relationship cannot reuse an issued cursor',async()=>{
  const p=await read({student_status:'active'});assert(p.next_cursor);
  for(const patch of [{student_status:'inactive'},{center_id:other},{relationship:'student'}]){const r=await call(owner,'people_list_v1',{org_id:org,center_id:center,query:'Synthetic status',student_status:'active',page:{limit:1,cursor:p.next_cursor},...patch});assert.equal(r.result.ok,false);assert.equal(r.result.error.code,'VALIDATION_FAILED');}
 });
 await t.test('scope and enum validation are typed and existing authority is preserved',async()=>{
  for(const b of [{center_id:null,student_status:'active'},{student_status:'suspended'},{student_status:'inactive',relationship:'instructor'}]){const r=await call(owner,'people_list_v1',{org_id:org,center_id:center,page:{},...b});assert.equal(r.result.ok,false);assert.equal(r.result.error.code,'VALIDATION_FAILED');}
  const r=await call(stranger,'people_list_v1',{org_id:org,center_id:center,page:{},student_status:'inactive'});assert.equal(r.result.ok,false);
 });
 await t.test('active membership on an alias supersedes inactive canonical history',async()=>{
  const alias=key();await db.query("insert into core.people(id,org_id,display_name,state,merged_into_id) values($1,$2,'Synthetic alias snapshot','merged',$3)",[alias,org,people[1]]);
  try{await relation(alias,center,'active');assert.deepEqual(await all({student_status:'active'}),[people[1],people[4],people[5]].sort());assert.deepEqual(await all({student_status:'inactive'}),[people[0],people[2],people[3]].sort());}
  finally{await db.query('delete from core.center_relationships where org_id=$1 and person_id=$2',[org,alias]);await db.query('delete from core.people where id=$1',[alias]);}
 });
 await t.test('filtered reads never create business effects',async()=>{
  const counts=async()=>(await db.query('select (select count(*) from core.audit_events where org_id=$1) a,(select count(*) from core.operation_receipts where org_id=$1) r,(select count(*) from core.outbox_jobs where org_id=$1) o',[org])).rows;const before=await counts();await all({student_status:'active'});await all({student_status:'inactive'});assert.deepEqual(await counts(),before);
 });
 await t.test('self-only fast path uses the same filter without exposing other students',async()=>{
  await db.query("insert into core.account_links(id,org_id,person_id,account_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,people[4],memberAccount.id]);
  assert.deepEqual((await read({query:null,student_status:'active',page:{}},member)).items.map(x=>x.id),[people[4]]);assert.deepEqual((await read({query:null,student_status:'inactive',page:{}},member)).items,[]);
 });
 await t.test('visible-page member summaries preserve native balances, currency precision and future lesson scope',async()=>{
  const target=people[5],day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
  const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Synthetic summary',state:'active'},key())).primary_id;for(const c of [center,other])await api('center_discipline_set_v1',{center_id:c,discipline_id:discipline,state:'active'});
  const terms={name:'Synthetic credits',kind:'credits',booking_mode:'flexible',credits:10,price_minor:'0',currency:'USD',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
  const product=(await api('product_publish_v1',{terms})).primary_id;
  const sale=async(v,c=center,dates={})=>{const p=await api('sale_preview_v1',{center_id:c,person_id:target,product_version_id:v,start_date:day(-2),end_date:day(40),...dates});return (await api('sale_apply_v1',{center_id:c,preview:{id:p.id,token:p.token}})).primary_id;};
  await sale(product);await sale(product,center,{start_date:'2020-01-01',end_date:'2020-02-01'});
  const timedProduct=(await api('product_publish_v1',{terms:{...terms,name:'Synthetic timed',kind:'timed',credits:null,quota:null}})).primary_id;await sale(timedProduct);
  await relation(target,other,'active');const remoteProduct=(await api('product_publish_v1',{center_id:other,terms:{...terms,name:'Synthetic other-center credits'}})).primary_id;await sale(remoteProduct,other);
  for(const [c,currency,amount] of [[center,'USD','9007199254740993'],[center,'USD','12'],[center,'EUR','30'],[other,'USD','999']])await db.query("insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state) values($1,$2,$3,$4,$5,$6,now(),'open')",[key(),org,c,target,amount,currency]);
  const policy=key();await db.query("insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values($1,$2,null,'student_cancel_group',now(),false,$3)",[policy,org,{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'consume',no_show:'consume'}}]);
  const book=async(c,hours,state='active')=>{const id=key(),starts=new Date(Date.now()+hours*3600000),ends=new Date(+starts+3600000);await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,10,10,'planned','open')",[id,org,c,discipline,starts,ends]);await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible',$6,$7)",[key(),org,c,id,target,state,policy]);return {id,starts:starts.toISOString()};};
  await book(center,-5);await book(center,1,'cancelled');await book(other,2);const nearest=await book(center,3);await book(center,8);
  const summary=async(u=owner,b={})=>{const p=await read({query:'Synthetic status 5',include_member_summary:true,page:{limit:1},...b},u);assert.equal(p.items.length,1);return p.items[0].member_summary;};
  const counts=async()=>(await db.query('select (select count(*) from core.audit_events where org_id=$1) a,(select count(*) from core.operation_receipts where org_id=$1) r,(select count(*) from core.outbox_jobs where org_id=$1) o',[org])).rows;const before=await counts(),initial=await summary();assert.deepEqual(await counts(),before);assert.deepEqual(initial.rights,{status:'available',available_credits:'10',available_timed_packages:1});assert.deepEqual(initial.debt,{status:'available',by_currency:[{currency:'EUR',remaining_minor:'30'},{currency:'USD',remaining_minor:'9007199254741005'}]});assert.equal(initial.next_lesson.status,'available');assert.equal(initial.next_lesson.lesson.session_id,nearest.id);assert.equal(Date.parse(initial.next_lesson.lesson.starts_at),Date.parse(nearest.starts));
  assert(!(await read({query:'Synthetic status 5',page:{limit:1}})).items[0].member_summary);
  const defaultPage=await read({query:null,student_status:'active'});assert(defaultPage.next_cursor);const mismatched=await call(owner,'people_list_v1',{org_id:org,center_id:center,query:null,student_status:'active',include_member_summary:true,page:{limit:1,cursor:defaultPage.next_cursor}});assert.equal(mismatched.result.ok,false);assert.equal(mismatched.result.error.code,'VALIDATION_FAILED');
  // The response remains cursor-page bounded when enrichment is requested.
  await db.query("insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state) values($1,$2,$3,$4,5,'EUR',now(),'open')",[key(),org,center,people[0]]);
  const first=await read({include_member_summary:true,page:{limit:1}});assert.equal(first.items.length,1);assert(first.next_cursor);assert(first.items[0].member_summary);
  const staff=await authUser('summary-collection-staff'),staffAccount=await must(staff,'account_get_v1'),staffPerson=(await api('person_create_v1',{display_name:'Synthetic staff summary',contacts:[]})).primary_id;
  await db.query("insert into core.account_links(id,org_id,person_id,account_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,staffPerson,staffAccount.id]);await api('role_assign_v1',{person_id:staffPerson,role:'staff',scope:{center_id:center}});
  for(const permission of ['person.manage','finance.collect'])await db.query("insert into core.permission_overrides(id,org_id,center_id,person_id,permission,enabled) values($1,$2,$3,$4,$5,true)",[key(),org,center,staffPerson,permission]);
  const restricted=await summary(staff);assert.deepEqual(restricted.rights,{status:'restricted'});assert.deepEqual(restricted.debt,{status:'restricted'});assert.deepEqual(restricted.next_lesson,{status:'restricted'});
  const denied=await call(staff,'finance_get_v1',{org_id:org,center_id:center,person_id:target,currency:'USD',page:{}});assert.equal(denied.result.ok,false);assert.equal(denied.result.error.code,'FORBIDDEN');
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F19') where id=$1",[plan]);
  try{assert.deepEqual((await summary()).debt,{status:'not_enabled'});}finally{await db.query("update core.saas_plan_versions set features=features||array['F19'] where id=$1",[plan]);}
  // A downgraded visible non-kept person must not gain summaries through list enrichment.
  const subscription=(await db.query('select id from core.saas_subscriptions where org_id=$1 order by created_at desc,id desc limit 1',[org])).rows[0].id;
  const old=(await db.query('select kept_center_id,starter_scope from private.p07_subscription_scope where subscription_id=$1',[subscription])).rows[0];
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  await db.query('insert into private.p07_subscription_scope(subscription_id,kept_center_id,starter_scope) values($1,$2,$3) on conflict(subscription_id) do update set kept_center_id=excluded.kept_center_id,starter_scope=excluded.starter_scope',[subscription,center,{center_id:center,discipline_id:discipline,student_person_ids:[people[4]]}]);
  try{const blocked=await summary();assert.deepEqual(blocked.rights,{status:'not_enabled'});assert.deepEqual(blocked.debt,{status:'not_enabled'});assert.deepEqual(blocked.next_lesson,{status:'not_enabled'});}finally{await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);if(old)await db.query('update private.p07_subscription_scope set kept_center_id=$2,starter_scope=$3 where subscription_id=$1',[subscription,old.kept_center_id,old.starter_scope]);else await db.query('delete from private.p07_subscription_scope where subscription_id=$1',[subscription]);}
 });

 await t.test('center access directories discover filtered pages and safe counts without prior identities',async()=>{
  const op='account_access_revoke_v1',linkOp='account_link_remove_v1',ids=[],jobs=[];
  for(let i=0;i<3;i++){const p=(await api('person_create_v1',{display_name:'Directory invite '+i,contacts:[{kind:'email',value:'dir-'+i+'@ftksaas.invalid'}]})).primary_id;ids.push(p);jobs.push((await api('account_access_send_v1',{person_id:p})).job_id);}
  const foreignPerson=(await api('person_create_v1',{center_id:other,display_name:'Directory invite foreign',contacts:[{kind:'email',value:'dir-foreign@ftksaas.invalid'}]})).primary_id;await api('account_access_send_v1',{center_id:other,person_id:foreignPerson});
  await db.query("update core.invitations set expires_at=now()-interval '1 second' where org_id=$1 and person_id=$2",[org,ids[2]]);
  const directory=(operation,keyFields={},page={},u=owner)=>api('management_state_get_v1',{operation,selector:{operation,key:{directory:'center',...keyFields}},page},u);
  const first=await directory(op,{query:'Directory invite',status:'pending'},{limit:1});assert.equal(first.items.length,1);assert(first.next_cursor);assert.equal(first.access_summary.total,3);assert.equal(first.access_summary.filtered,2);assert.deepEqual(first.access_summary.by_state,[{state:'expired',count:1},{state:'pending',count:2}]);
  const next=await directory(op,{query:'Directory invite',status:'pending'},{limit:1,cursor:first.next_cursor});assert.equal(next.items.length,1);assert.equal(next.next_cursor,null);assert.notEqual(first.items[0].entity.id,next.items[0].entity.id);
  const wrong=await call(owner,'management_state_get_v1',{org_id:org,center_id:center,operation:op,selector:{operation:op,key:{directory:'center',query:'Directory invite',status:'expired'}},page:{limit:1,cursor:first.next_cursor}});assert.equal(wrong.result.ok,false);assert.equal(wrong.result.error.code,'VALIDATION_FAILED');
  assert.equal((await directory(op,{query:'Directory invite',status:'expired'})).items[0].state,'expired');assert((await directory(op,{query:'No such directory person'})).items.length===0);
  const managerUser=await authUser('directory-manager'),managerAccount=await must(managerUser,'account_get_v1'),managerPerson=(await api('person_create_v1',{display_name:'Directory manager',contacts:[]})).primary_id;
  const managerLink=key();await db.query("insert into core.account_links(id,org_id,person_id,account_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[managerLink,org,managerPerson,managerAccount.id]);await api('center_manager_assign_v1',{person_id:managerPerson});
  const otherView=await directory(op,{query:'Directory invite'},{},managerUser);assert(otherView.items.every(x=>JSON.stringify(x.access_detail.delivery)==='{"visibility":"restricted"}'));
  await db.query('insert into private.invitation_delivery_state(job_id) values($1)',[jobs[0]]);await db.query("update core.outbox_jobs set state='succeeded',provider_reference=$2 where id=$1",[jobs[0],key()]);
  // Old successful persisted state without an observed provider transition remains undated.
  await db.query("update core.outbox_jobs set state='succeeded',provider_reference=$2 where id=$1",[jobs[1],key()]);await db.query('insert into private.invitation_delivery_state(job_id) values($1)',[jobs[1]]);
  const sent=await directory(op,{query:'Directory invite 0'});assert.equal(sent.items[0].access_detail.delivery.visibility,'available');assert(Number.isFinite(Date.parse(sent.items[0].access_detail.delivery.sent_at)));assert.equal(sent.items[0].access_detail.can_resend,true);
  assert.equal((await directory(op,{query:'Directory invite 1'})).items[0].access_detail.delivery.sent_at,null);
  const linked=await authUser('directory-linked'),linkedAccount=await must(linked,'account_get_v1');await db.query("insert into core.account_links(id,org_id,person_id,account_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,ids[0],linkedAccount.id]);
  assert.equal((await directory(op,{query:'directory-linked'})).items[0].access_detail.can_resend,false);
  const links=await directory(linkOp,{query:'directory-manager',status:'active'});assert.equal(links.items.length,1);assert.equal(links.items[0].entity.id,managerLink);assert.equal(links.items[0].access_detail.kind,'account_link');assert.equal(links.access_summary.filtered,1);
  const text=JSON.stringify([links,sent]);for(const secret of [managerAccount.id,managerUser.id,managerUser.jwt,linkedAccount.id,linked.id,linked.jwt,'dir-0@ftksaas.invalid'])assert(!text.includes(secret));assert(!text.includes('provider_reference'));assert(!text.includes('sealed_token'));
  const inviter=await authUser('directory-inviter'),inviterAccount=await must(inviter,'account_get_v1'),inviterPerson=(await api('person_create_v1',{display_name:'Directory inviter',contacts:[]})).primary_id;
  await db.query("insert into core.account_links(id,org_id,person_id,account_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,inviterPerson,inviterAccount.id]);await api('role_assign_v1',{person_id:inviterPerson,role:'staff',scope:{center_id:center}});await api('student_activate_v1',{person_id:ids[1]});
  const hiddenName=await directory(op,{}, {},inviter);assert.equal(hiddenName.items.length,1);assert.equal(hiddenName.items[0].access_detail.display_name,null);assert.deepEqual(hiddenName.items[0].access_detail.delivery,{visibility:'restricted'});
  assert.equal((await directory(op,{query:'Directory invite 1'},{},inviter)).access_summary.total,0);
  const noPerson=await call(inviter,'person_get_v1',{org_id:org,center_id:center,person_id:ids[1]});assert.equal(noPerson.result.ok,false);
  const unauthorized=await call(member,'management_state_get_v1',{org_id:org,center_id:center,operation:linkOp,selector:{operation:linkOp,key:{directory:'center'}},page:{}});assert.equal(unauthorized.result.ok,false);
  const noCenter=await call(owner,'management_state_get_v1',{org_id:org,center_id:null,operation:op,selector:{operation:op,key:{directory:'center'}},page:{}});assert.equal(noCenter.result.ok,false);assert.equal(noCenter.result.error.code,'VALIDATION_FAILED');
 });

});
