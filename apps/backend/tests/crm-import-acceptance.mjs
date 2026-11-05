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
