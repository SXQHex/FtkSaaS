import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Abone No allocation, backfill, alias merge and scoped discovery through real Auth/API',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('subscriber-owner'),outsider=await authUser('subscriber-outsider');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Subscriber numbers',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Numbers',timezone:'UTC'},key())).primary_id;
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'Other numbers',timezone:'UTC'},key())).primary_id;
 const db=await connect();
 const scope=b=>({org_id:org,center_id:center,...b}),mut=(op,b,k=key())=>must(owner,op,scope(b),k);
 const person=label=>mut('person_create_v1',{display_name:label,contacts:[]}).then(x=>x.primary_id);
 const get=person_id=>must(owner,'person_get_v1',scope({person_id}));
 const find=query=>must(owner,'people_list_v1',scope({query,page:{limit:200}}));
 const number=async pid=>(await get(pid)).subscriber_number;
 const ledger=async()=> (await db.query('select number::text,person_id from private.subscriber_numbers where org_id=$1 order by number',[org])).rows;
 const counter=async()=> (await db.query('select last_number::text n from private.subscriber_counters where org_id=$1',[org])).rows[0]?.n;
 const preview=(source_id,target_id)=>must(owner,'person_merge_preview_v1',scope({source_id,target_id}));
 const apply=(p,k=key())=>mut('person_merge_apply_v1',{preview:{id:p.id,token:p.token}},k);
 let first,second;
 try{
  const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await mut('center_manager_assign_v1',{person_id:ownerPerson});
  const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic subscriber acceptance',occurred_at:new Date().toISOString()});
  await must(platform,'saas_payment_verify_v1',scope({payment_id:pay.primary_id,accepted:true}),key());
  await t.test('candidates and instructors do not allocate; concurrent first student intents allocate exactly once',async()=>{
   first=await person('First numbered candidate');second=await person('Second numbered candidate');
   assert.equal(await number(first),null);assert.deepEqual(await ledger(),[]);
   await db.query("insert into core.role_assignments(id,org_id,scope_center_id,person_id,role,state,account_link_id) values($1,$2,$3,$4,'instructor','active',null)",[key(),org,center,second]);
   assert.equal(await number(second),null);assert.deepEqual(await ledger(),[]);
   const k=key(),body={person_id:first};const responses=await Promise.all([mut('student_activate_v1',body,k),mut('student_activate_v1',body,k)]);
   assert.equal(responses[0].primary_id,responses[1].primary_id);assert(responses.some(x=>x.replayed));assert.equal(await number(first),'1001');
   const attempts=await Promise.all([call(owner,'student_activate_v1',scope({person_id:second}),key()),call(owner,'student_activate_v1',scope({person_id:second}),key())]);
   assert(attempts.some(x=>x.result.ok));assert.equal(await number(second),'1002');assert.equal((await ledger()).length,2);
  });
  await t.test('CRM lead projection reads numbered and unnumbered people without allocation',async()=>{
   const before=await counter();
   for(const pid of [first,ownerPerson]){
    const view=(await db.query("select private.p04_lead_view(jsonb_populate_record(null::core.leads,jsonb_build_object('id',$1::uuid,'org_id',$2::uuid,'person_id',$3::uuid,'state','open','version',1))) v",[key(),org,pid])).rows[0].v;
    assert.equal(view.subscriber_number,await number(pid));
   }
   assert.equal(await counter(),before);
  });
  await t.test('different people allocate uniquely in parallel and reactivation keeps the original number',async()=>{
   const persons=await Promise.all([person('Concurrent A'),person('Concurrent B')]);await Promise.all(persons.map(person_id=>mut('student_activate_v1',{person_id})));
   assert.deepEqual((await Promise.all(persons.map(number))).sort(),['1003','1004']);
   await mut('student_deactivate_v1',{person_id:first,reason:'Synthetic reactivation'});await mut('student_activate_v1',{person_id:first});assert.equal(await number(first),'1001');
   const before=await counter();await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'student','inactive',now())",[key(),org,other,first]);assert.equal(await counter(),before);
  });
  await t.test('number search uses existing permission and tenant scope, never an access grant',async()=>{
   const view=await find('1001');assert.equal(view.items.length,1);assert.equal(view.items[0].id,first);assert.equal(view.items[0].subscriber_number,'1001');
   const denied=await call(outsider,'people_list_v1',scope({query:'1001',page:{limit:10}}));assert.equal(denied.result.ok,false);
   const foreignAccount=await must(outsider,'account_get_v1'),foreignOrg=(await must(platform,'organization_create_v1',{verified_account_id:foreignAccount.id,name:'Independent numbers',initial_plan_id:plan},key())).primary_id;
   const foreignCenter=(await must(outsider,'center_create_v1',{org_id:foreignOrg,name:'Foreign',timezone:'UTC'},key())).primary_id;
   const foreignPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[foreignOrg])).rows[0].owner_person_id;
   await must(outsider,'center_manager_assign_v1',{org_id:foreignOrg,center_id:foreignCenter,person_id:foreignPerson},key());
   const p=await must(outsider,'saas_payment_submit_v1',{org_id:foreignOrg,center_id:foreignCenter,amount_minor:'1000',currency:'TRY',reference:'Synthetic independent numbers',occurred_at:new Date().toISOString()},key());
   await must(platform,'saas_payment_verify_v1',{org_id:foreignOrg,center_id:foreignCenter,payment_id:p.primary_id,accepted:true},key());
   const foreign=(await must(outsider,'person_create_v1',{org_id:foreignOrg,center_id:foreignCenter,display_name:'Foreign student',contacts:[]},key())).primary_id;
   await must(outsider,'student_activate_v1',{org_id:foreignOrg,center_id:foreignCenter,person_id:foreign},key());
   const found=await must(outsider,'people_list_v1',{org_id:foreignOrg,center_id:foreignCenter,query:'1001',page:{limit:10}});assert.deepEqual(found.items.map(x=>x.id),[foreign]);
  });
  await t.test('numbered source into an unnumbered target transfers a single allocation before relationship moves',async()=>{
   const source=await person('One numbered source'),target=await person('Unnumbered target');await mut('student_activate_v1',{person_id:source});
   const no=await number(source),before=await ledger(),seq=await counter(),p=await preview(source,target);assert.deepEqual(p.blockers,[]);
   const k=key();await apply(p,k);assert((await apply(p,k)).replayed);assert.equal(await number(target),no);assert.equal(await number(source),no);
   assert.equal((await ledger()).length,before.length);assert.equal(await counter(),seq);assert.deepEqual((await find(no)).items.map(x=>x.id),[target]);
  });
  await t.test('two numbered people keep the earliest allocation, both aliases and chained identity without rewriting history',async()=>{
   const source=await person('Early allocation'),target=await person('Later allocation');await mut('student_activate_v1',{person_id:source});await mut('student_activate_v1',{person_id:target});
   const sourceNo=await number(source),targetNo=await number(target),before=await counter();
   const debt=key();await db.query("insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state) values($1,$2,$3,$4,100,'TRY',now(),'open')",[debt,org,center,source]);
   const history=(await db.query('select * from core.debts where id=$1',[debt])).rows[0];await apply(await preview(source,target));
   assert.equal(await number(target),sourceNo);assert.equal(await counter(),before);assert.deepEqual((await db.query('select * from core.debts where id=$1',[debt])).rows[0],history);
   const next=await person('Chain target');await apply(await preview(target,next));
   for(const no of [sourceNo,targetNo]){const result=await find(no);assert.deepEqual(result.items.map(x=>x.id),[next]);assert.equal(result.items[0].subscriber_number,sourceNo);}
   const unnamed=await person('Unnumbered source');await apply(await preview(unnamed,next));assert.equal(await counter(),before);assert.equal(await number(next),sourceNo);
   const aliasPerson=(await find(targetNo)).items[0];
   const currentFinance=await must(owner,'finance_get_v1',scope({person_id:aliasPerson.id,currency:'TRY',page:{}}));
   assert.equal(currentFinance.subscriber_number,sourceNo);assert.equal(await counter(),before);
   const report=await must(owner,'report_get_v1',scope({report:'collections_debts',filters:{center_ids:[center],interval:{starts_at:new Date(Date.now()-86400000).toISOString(),ends_at:new Date(Date.now()+86400000).toISOString()}},page:{limit:200}}));
   assert.equal(report.rows.items.find(x=>x.person_id===source&&x.group_key==='outstanding_debt').subscriber_number,sourceNo);
   assert(report.columns.includes('subscriber_number'));
   const selected=await must(owner,'report_get_v1',scope({report:'collections_debts',filters:report.filters,columns:['group_key','subscriber_number'],page:{limit:200}}));assert(selected.rows.items.some(x=>x.subscriber_number===sourceNo));assert(selected.rows.items.every(x=>Object.keys(x).every(k=>['group_key','subscriber_number'].includes(k))));
   const csv=(await db.query("select convert_from(private.work_report_csv($1,$2,100000),'UTF8') body",[JSON.stringify(report.rows.items),JSON.stringify(['group_key','subscriber_number'])])).rows[0].body;assert(csv.startsWith('group_key,subscriber_number\r\n'));assert(csv.includes(',\"'+sourceNo+'\"'));
   const aggregate=await must(owner,'report_get_v1',scope({report:'collections_debts',filters:report.filters,group_by:'center',page:{limit:200}}));assert(aggregate.rows.items.every(x=>!('subscriber_number' in x)));
  });
  await t.test('private number state participates in merge preview freshness and stays inaccessible to clients',async()=>{
   for(const role of ['anon','authenticated']){
    const privileges=(await db.query("select has_table_privilege($1,'private.subscriber_numbers','select') table_read,has_function_privilege($1,'private.subscriber_allocate(uuid,uuid)','execute') allocate",[role])).rows[0];assert.deepEqual(privileges,{table_read:false,allocate:false});
   }
   const source=await person('Snapshot source'),target=await person('Snapshot target');await mut('student_activate_v1',{person_id:source});
   const no=await number(source),p=await preview(source,target);
   await db.query('update private.subscriber_numbers set person_id=$3 where org_id=$1 and number=$2',[org,no,target]);
   try{const result=await call(owner,'person_merge_apply_v1',scope({preview:{id:p.id,token:p.token}}),key());assert.equal(result.result.error.code,'PREVIEW_STALE');}
   finally{await db.query('update private.subscriber_numbers set person_id=$3 where org_id=$1 and number=$2',[org,no,source]);}
  });
  await t.test('late merge audit failure rolls back aliases, numbers and counter with the existing transaction',async()=>{
   const source=await person('Rollback number source'),target=await person('Rollback number target');await mut('student_activate_v1',{person_id:source});await mut('student_activate_v1',{person_id:target});
   const p=await preview(source,target),before=await ledger(),seq=await counter(),trigger='subscriber_failure_'+key().replaceAll('-','');
   await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='person_merge_apply_v1' then raise exception using errcode='23514',message='synthetic subscriber merge failure';end if;return new;end$$`);
   await db.query(`create trigger ${trigger} before insert on core.audit_events for each row execute function private.${trigger}()`);
   try{const failed=await call(owner,'person_merge_apply_v1',scope({preview:{id:p.id,token:p.token}}),key());assert.equal(failed.result.error.code,'INTEGRITY_VIOLATION');assert.deepEqual(await ledger(),before);assert.equal(await counter(),seq);}
   finally{await db.query(`drop trigger ${trigger} on core.audit_events`);await db.query(`drop function private.${trigger}()`);}
  });
  await t.test('account linking keeps numbers and person erasure leaves a reserved non-reusable tombstone',async()=>{
   const linked=await authUser('subscriber-account-link'),account=await must(linked,'account_get_v1'),before=await number(first),seq=await counter();
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,first]);assert.equal(await number(first),before);assert.equal(await counter(),seq);
   const erased=key(),relationship=key();await db.query("insert into core.people(id,org_id,display_name,state) values($1,$2,'Synthetic erasure fixture','active')",[erased,org]);
   await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'student','inactive',now())",[relationship,org,center,erased]);
   const tombstone=await number(erased);await db.query('delete from core.center_relationships where id=$1',[relationship]);await db.query('delete from core.people where id=$1',[erased]);
   assert.equal((await ledger()).find(x=>x.number===tombstone).person_id,null);
   const next=await person('After erased number');await mut('student_activate_v1',{person_id:next});assert(BigInt(await number(next))>BigInt(tombstone));assert.deepEqual((await find(tombstone)).items,[]);
  });
  await t.test('legacy backfill orders active and inactive canonical students by first relationship time and UUID',async()=>{
   const legacyOrg=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Legacy subscriber order',initial_plan_id:plan},key())).primary_id;
   const legacyCenter=(await must(owner,'center_create_v1',{org_id:legacyOrg,name:'Legacy',timezone:'UTC'},key())).primary_id;
   const people=[key(),key(),key()].sort();
   await db.query('begin');
   try{
    // Transactional DDL holds the fixture lock; no other session can observe a disabled trigger.
    await db.query('alter table core.center_relationships disable trigger subscriber_student');
    for(const id of people)await db.query("insert into core.people(id,org_id,display_name,state) values($1,$2,'Legacy synthetic student','active')",[id,legacyOrg]);
    for(const [index,created,state] of [[1,'2020-01-02','inactive'],[0,'2020-01-02','active'],[2,'2020-01-03','inactive']])await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,created_at,started_at) values($1,$2,$3,$4,'student',$5,$6,$6)",[key(),legacyOrg,legacyCenter,people[index],state,created]);
    const alias=key();await db.query("insert into core.people(id,org_id,display_name,state,merged_into_id) values($1,$2,'Legacy alias','merged',$3)",[alias,legacyOrg,people[2]]);
    await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,created_at,started_at) values($1,$2,$3,$4,'student','inactive','2019-01-01','2019-01-01')",[key(),legacyOrg,legacyCenter,alias]);
    await db.query('select private.subscriber_backfill($1)',[legacyOrg]);
    await db.query('set constraints all immediate');await db.query('alter table core.center_relationships enable trigger subscriber_student');await db.query('commit');
   }catch(error){await db.query('rollback');throw error;}
   const read=async()=>(await db.query('select person_id,number::text from private.subscriber_numbers where org_id=$1 order by number',[legacyOrg])).rows;
   assert.deepEqual(await read(),[{person_id:people[2],number:'1001'},{person_id:people[0],number:'1002'},{person_id:people[1],number:'1003'}]);
   const concurrent=await connect();
   try{
    await db.query('begin');await db.query('select id from core.organizations where id=$1 for update',[legacyOrg]);
    const pending=concurrent.query('select private.subscriber_backfill($1)',[legacyOrg]);
    const fresh=key();await db.query("insert into core.people(id,org_id,display_name,state) values($1,$2,'Concurrent new student','active')",[fresh,legacyOrg]);
    await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'student','active',now())",[key(),legacyOrg,legacyCenter,fresh]);
    await db.query('commit');await pending;assert.equal((await read()).find(x=>x.person_id===fresh).number,'1004');
   }finally{await db.query('rollback');await concurrent.end();}
   const missing=key(),newStudent=key();await db.query('begin');
   try{
    await db.query('alter table core.center_relationships disable trigger subscriber_student');
    for(const id of [missing,newStudent])await db.query("insert into core.people(id,org_id,display_name,state) values($1,$2,'Backfill race fixture','active')",[id,legacyOrg]);
    await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,created_at,started_at) values($1,$2,$3,$4,'student','inactive','2018-01-01','2018-01-01')",[key(),legacyOrg,legacyCenter,missing]);
    await db.query('set constraints all immediate');await db.query('alter table core.center_relationships enable trigger subscriber_student');await db.query('commit');
   }catch(error){await db.query('rollback');throw error;}
   const backfill=await connect();let enrolling;
   try{
    await backfill.query('begin');await backfill.query('select private.subscriber_backfill($1)',[legacyOrg]);
    enrolling=db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'student','active',now())",[key(),legacyOrg,legacyCenter,newStudent]);
    await backfill.query('commit');await enrolling;
    const assigned=await read();assert.equal(assigned.find(x=>x.person_id===missing).number,'1005');assert.equal(assigned.find(x=>x.person_id===newStudent).number,'1006');
   }finally{await backfill.query('rollback');if(enrolling)await enrolling;await backfill.end();}
  });
  await t.test('backfill is repeatable; numbers and assignment timestamps are immutable',async()=>{
   const before=await ledger(),seq=await counter();await db.query('select private.subscriber_backfill($1)',[org]);await db.query('select private.subscriber_backfill($1)',[org]);assert.deepEqual(await ledger(),before);assert.equal(await counter(),seq);
   await assert.rejects(db.query('update private.subscriber_numbers set number=number+10000 where org_id=$1 and number=1001',[org]),/INVALID_STATE_TRANSITION/);
   const beforeNo=await number(first);await assert.rejects(db.query('update core.people set display_name=$2,version=version+1 where id=$1',[first,'Renamed subscriber']),/FORBIDDEN/);assert.equal(await number(first),beforeNo);
   const unlinked=await get(second),beforeUnlinked=await number(second);await mut('person_update_v1',{person_id:second,expected_version:unlinked.version,patch:{display_name:'Renamed unlinked subscriber'}});assert.equal(await number(second),beforeUnlinked);
  });
  await t.test('offline instructor membership survives person merge without becoming an account capability',async()=>{
   for(const scenario of ['unlinked','linked-source','duplicate-target']){
    const source=await person('Offline merge source '+scenario),target=await person('Offline merge target '+scenario);
    await db.query("insert into core.role_assignments(id,org_id,scope_center_id,person_id,role,state,account_link_id) values($1,$2,$3,$4,'instructor','active',null)",[key(),org,center,source]);
    if(scenario==='duplicate-target')await db.query("insert into core.role_assignments(id,org_id,scope_center_id,person_id,role,state,account_link_id) values($1,$2,$3,$4,'instructor','active',null)",[key(),org,center,target]);
    if(scenario==='linked-source'){
     const user=await authUser('offline-linked-source'),account=await must(user,'account_get_v1');
     await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,source]);
    }
    const p=await preview(source,target);assert.deepEqual(p.blockers,[],scenario);const mergeKey=key();await apply(p,mergeKey);
    assert.equal((await apply(p,mergeKey)).replayed,true);
    const active=(await db.query("select person_id,account_link_id from core.role_assignments where org_id=$1 and scope_center_id=$2 and person_id=any($3::uuid[]) and role='instructor' and state='active'",[org,center,[source,target]])).rows;
    assert.deepEqual(active,[{person_id:target,account_link_id:null}],scenario);
    assert.equal((await db.query("select private.has_role($1,$2,'instructor',$3) allowed",[org,target,center])).rows[0].allowed,false,scenario);
    const personView=await get(target);assert.deepEqual(personView.relationships.filter(x=>x.kind==='instructor'&&x.state==='active'),[{center_id:center,kind:'instructor',state:'active'}],scenario);
    assert.equal((await db.query("select count(*)::int n from private.person_center_relationships where org_id=$1 and center_id=$2 and person_id=$3 and kind='instructor' and state='active'",[org,center,target])).rows[0].n,1,scenario);
    if(scenario==='linked-source')assert.equal((await db.query("select count(*)::int n from core.account_links where org_id=$1 and person_id=$2 and state='active' and verified_at is not null",[org,target])).rows[0].n,1);
   }
  });
  await t.test('merging a former instructor into a normal student preserves inactive history without promoting a role',async()=>{
   const source=await person('Former instructor merge source'),target=await person('Normal student merge target'),role=key();
   await mut('student_activate_v1',{person_id:target});
   await db.query("insert into core.role_assignments(id,org_id,scope_center_id,person_id,role,state,account_link_id) values($1,$2,$3,$4,'instructor','inactive',null)",[role,org,center,source]);
   const historical=(await db.query('select * from core.role_assignments where id=$1',[role])).rows;
   const p=await preview(source,target);assert.deepEqual(p.blockers,[]);await apply(p);
   assert.deepEqual((await db.query('select * from core.role_assignments where id=$1',[role])).rows,historical);
   assert.deepEqual((await db.query('select state,merged_into_id from core.people where id=$1',[source])).rows,[{state:'merged',merged_into_id:target}]);
   assert.equal((await db.query('select private.p07_same_person($1,$2,$3) same',[org,source,target])).rows[0].same,true);
   assert.equal((await db.query("select count(*)::int n from core.role_assignments where org_id=$1 and person_id=any($2::uuid[]) and role='instructor' and state='active'",[org,[source,target]])).rows[0].n,0);
   const view=await get(target);assert(view.relationships.some(x=>x.kind==='student'&&x.state==='active'));assert(!view.relationships.some(x=>x.kind==='instructor'&&x.state==='active'));
   assert.equal((await db.query("select private.has_role($1,$2,'instructor',$3) allowed",[org,target,center])).rows[0].allowed,false);
  });
 }finally{await db.end();}
});
