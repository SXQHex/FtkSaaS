import test from 'node:test';
import assert from 'node:assert/strict';
import {importFixture} from './crm-import-fixture.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('CRM file preview and selected import preserve provenance/onay and never create students or duplicate prior source',{timeout:300000},async t=>{
 const f=await importFixture(t),{db,org,center,api,preview,apply,work,count,counts}=f;
 const existing=(await api('person_create_v1',{display_name:'Synthetic existing contact',contacts:[{kind:'phone',value:'+905550000003'}]})).primary_id;
 const baseline=await counts(),proof=[{purpose:'marketing',accepted:false,version:'synthetic-v1',occurred_at:'2026-01-01T00:00:00Z'}],rows=[{source_key:'legacy-a',consents:proof},{source_key:'legacy-b'},{source_key:'legacy-c',phone:'05550000003'}];
 const p=await preview(rows);assert.equal(await count(),0);assert.equal(p.preview.import_summary.new_people,0);assert.equal(p.preview.import_summary.new_applications,2);
 const mapped=await api('import_rows_list_v1',{job_id:p.job,page:{limit:100}});assert.equal(mapped.items[0].application.source.channel,'legacy_import');assert.equal(mapped.items[0].application.phone_matches[0].person_id,existing);assert.equal(mapped.items[0].application.intake.consents[0].accepted,false);assert.equal(mapped.items[2].application,null);assert(mapped.items[2].field_errors.includes('phone'));
 const k=key();assert.equal((await apply(p,[1],k)).selected_rows_count,1);assert.equal((await apply(p,[1],k)).job_id,p.job);await work();assert.equal(await count(),1);assert.deepEqual(await counts(),baseline);
 const result=await api('import_rows_list_v1',{job_id:p.job,page:{limit:100}});assert.equal(result.items[0].state,'applied');assert.equal(result.items[1].state,'valid');
 const inbox=await api('management_state_get_v1',{operation:'public_application_review_v1',selector:{operation:'public_application_review_v1',key:{}},page:{limit:100}});const app=inbox.items[0].current.values;assert.equal(app.person_id,null);assert.equal(app.source.channel,'legacy_import');assert.equal(app.intake.consents[0].version,'synthetic-v1');assert.equal(app.intake.consents[0].source.channel,'legacy_import');
 assert.equal((await db.query('select bot_verified_at,crm_form_id,publication_id from core.public_applications where org_id=$1',[org])).rows[0].bot_verified_at,null);
 const replay=await preview(rows.slice(0,2),p.namespace);assert.equal(replay.preview.import_summary.replayed_rows,1);await apply(replay,[1,2]);await work();assert.equal(await count(),2);assert.deepEqual(await counts(),baseline);
 const crossKind=await preview(rows.slice(0,1),p.namespace,{kind:'students',columns:['source_key','display_name','phone'].map(target=>({source_column:target,target}))});assert.equal(crossKind.preview.import_summary.invalid_rows,1);assert.deepEqual(await counts(),baseline);
 const altered=await preview([{source_key:'legacy-a',display_name:'Changed synthetic row'}],p.namespace);assert.equal(altered.preview.import_summary.invalid_rows,1);
 await f.denied('import_apply_v1',{preview:{id:p.preview.id,token:p.preview.token},selected_row_numbers:[2]},'IDEMPOTENCY_PAYLOAD_MISMATCH',k);
 assert.equal((await db.query('select count(*) n from core.import_rows where org_id=$1 and job_id=$2',[org,p.job])).rows[0].n,'3');assert(center);
});

test('P10 runner reconciles real Auth/Edge/worker import and scoped duplicate warnings',{timeout:300000},async t=>{
 const {acceptCrmImport}=await import('../scripts/acceptance/p10-hosted-import.mjs');
 const {context,authUser,must,call}=await import('./api-client.mjs');
 const f=await importFixture(t),{db,org,center,owner,api}=f;
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[f.plan]);
 const config={origin:context().env.API_URL,apikey:context().env.ANON_KEY,email:owner.email,password:owner.password,org,center,namespace:'synthetic-p10-'+key(),advance:f.work};
 let journal,writes=0;const observed=[];
 await assert.rejects(()=>acceptCrmImport({...config,onProgress:x=>observed.push(x.status),saveSessionState:async state=>{journal=structuredClone(state);if(++writes===2)throw Error('Controlled journal failure');},request:async(url,options)=>{if(String(url).includes('/auth/v1/logout'))return new Response(null,{status:500});return fetch(url,options);}}),/P10_SESSION_CLEANUP_UNCONFIRMED/);
 assert(!observed.includes('passed'));assert.equal(journal.sessions[0].cleanupConfirmed,false);
 const receipt=await acceptCrmImport({...config,sessionState:journal,saveSessionState:async state=>{journal=structuredClone(state);}});
 assert(journal.sessions.every(x=>x.cleanupConfirmed));assert.equal(journal.sessions.length,2);
 const ownerSessions=await must(owner,'account_sessions_list_v1');assert(ownerSessions.items.some(x=>x.session_id===owner.session_id&&x.current));assert(!ownerSessions.items.some(x=>journal.sessions.some(s=>s.id===x.session_id)));
 assert.equal(receipt.status,'passed');assert.equal(receipt.checks.length,2);assert.equal(receipt.applicationIds.length,3);assert.equal(receipt.sessionCleanupConfirmed,true);
 // Cross-center warning checks use Business after the Pro runner has finished.
 await db.query("update core.saas_plan_versions set name='business' where id=$1",[f.plan]);
 assert.equal((await db.query('select count(*)::int n from core.public_applications where org_id=$1',[org])).rows[0].n,4);
 for(const file of receipt.files)assert.equal((await db.query('select checksum from core.files where id=$1',[file.id])).rows[0].checksum,file.checksum);
 const cm=await authUser('p10-cm'),outsider=await authUser('p10-outsider'),account=await must(cm,'account_get_v1');
 const cmPerson=(await api('person_create_v1',{display_name:'Synthetic P10 scoped manager',contacts:[]})).primary_id;
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,cmPerson]);
 await api('center_manager_assign_v1',{person_id:cmPerson});
 const other=(await api('center_create_v1',{name:'Synthetic P10 other center',timezone:'UTC'})).primary_id;
 const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await api('center_manager_assign_v1',{center_id:other,person_id:ownerPerson});
 const hidden=(await api('person_create_v1',{center_id:other,display_name:'Synthetic hidden contact',contacts:[{kind:'email',value:'hidden-p10@ftksaas.invalid'},{kind:'phone',value:'+905550000090'}]})).primary_id;
 const scopedRows=[{source_key:'scope',email:'hidden-p10@ftksaas.invalid',phone:'+905550000090'}];
 const ownerPreview=await f.preview(scopedRows);
 const p=await f.preview(scopedRows,undefined,undefined,cm);
 const listed=await must(cm,'import_rows_list_v1',{org_id:org,center_id:center,job_id:p.job,page:{limit:100}});
 assert.deepEqual(listed.items[0].application.email_matches,[]);assert.deepEqual(listed.items[0].application.phone_matches,[]);
 const own=await api('import_rows_list_v1',{job_id:ownerPreview.job,page:{limit:100}});assert(own.items[0].application.email_matches.some(x=>x.person_id===hidden));
 for(const [actor,scope] of [[outsider,center],[cm,other]])assert.equal((await call(actor,'import_rows_list_v1',{org_id:org,center_id:scope,job_id:p.job,page:{limit:100}})).result.ok,false);
 const grants=(await db.query("select has_function_privilege('anon','private.crm_import_email_matches(uuid,uuid,uuid,text)','execute') anon,has_function_privilege('authenticated','private.crm_import_email_matches(uuid,uuid,uuid,text)','execute') authenticated")).rows[0];
 assert.deepEqual(grants,{anon:false,authenticated:false});
 assert.equal((await db.query("select count(*)::int n from private.transactional_email_jobs where org_id=$1",[org])).rows[0].n,0);
});


test('CRM email duplicates are scoped warnings and absent marketing proof remains empty after selected import',{timeout:300000},async t=>{
 const f=await importFixture(t),{db,org,api,preview,apply,work,count}=f;
 const email='synthetic-duplicate@ftksaas.invalid';
 const person=(await api('person_create_v1',{display_name:'Synthetic email match',contacts:[{kind:'email',value:email}]})).primary_id;
 const before=(await db.query('select to_jsonb(p) value from core.people p where id=$1',[person])).rows[0].value;
 const evidence={purpose:'marketing',accepted:true,version:'synthetic-preserved-v1',occurred_at:'2026-01-01T00:00:00Z'};
 const rows=[{source_key:'email-a',phone:'+905550000031',email:email.toUpperCase()},{source_key:'email-b',phone:'+905550000032',email,consents:[evidence]}];
 const p=await preview(rows),list=await api('import_rows_list_v1',{job_id:p.job,page:{limit:100}});
 assert.deepEqual(list.items[0].application.email_matches.map(x=>x.person_id),[person]);
 assert.equal(list.items[0].application.email_matches_truncated,false);
 assert.deepEqual(list.items[0].application.phone_matches,[]);
 assert.deepEqual(list.items[0].application.intake.consents,[]);
 await apply(p,[1,2]);await work();assert.equal(await count(),2);
 assert.deepEqual((await db.query('select to_jsonb(p) value from core.people p where id=$1',[person])).rows[0].value,before);
 const apps=(await db.query("select intake,source_snapshot,person_id from core.public_applications where org_id=$1 order by source_snapshot->>'source_key'",[org])).rows;
 assert.equal(apps[0].person_id,null);assert.equal(apps[1].person_id,null);assert.deepEqual(apps[0].intake.consents,[]);
 assert.deepEqual(Object.fromEntries(Object.keys(evidence).map(k=>[k,apps[1].intake.consents[0][k]])),evidence);
 assert.equal(apps[1].intake.consents[0].source.source_key,'email-b');
 assert.equal((await db.query('select state from core.files where id=$1',[p.file])).rows[0].state,'ready');
 const replay=await preview(rows,p.namespace);await apply(replay,[1,2]);await work();assert.equal(await count(),2);
});
