import test from 'node:test';
import assert from 'node:assert/strict';
import {importFixture} from './crm-import-fixture.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('CRM selection, dependency changes, live role loss and late failure reject without partially importing selected rows',{timeout:300000},async t=>{
 const f=await importFixture(t),{db,org,center,owner,api,preview,apply,work,count,denied}=f;
 const p=await preview(Array.from({length:26},(_,i)=>({source_key:'atomic-'+(i+1)})));
 for(const selection of [[],[2,1],[1,1],[27]])await denied('import_apply_v1',{preview:{id:p.preview.id,token:p.preview.token},selected_row_numbers:selection},'VALIDATION_FAILED');assert.equal(await count(),0);
 const selected=Array.from({length:26},(_,i)=>i+1);await apply(p,selected);await db.query('update private.p06_jobs set selected_row_numbers=array[1] where job_id=$1',[p.job]);const stale=await work();assert(stale.some(r=>!r.ok&&r.error.code==='PREVIEW_STALE'));assert.equal(await count(),0);
 await db.query('update private.p06_jobs set selected_row_numbers=$2::int[] where job_id=$1',[p.job,selected]);
 // Force the second source receipt to fail after the first application insert.
 const trigger='crm_import_fail_'+key().replaceAll('-','');
 await db.query(`create function pg_temp.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.source_key='atomic-26' then raise exception using errcode='P0001',message='VALIDATION_FAILED';end if;return new;end$$`);
 await db.query(`create trigger ${trigger} before insert on private.p06_sources for each row execute function pg_temp.${trigger}()`);
 try{await db.query('update core.outbox_jobs set next_attempt_at=clock_timestamp() where id=$1',[p.job]);const failed=await work();assert(failed.some(r=>!r.ok));assert.equal(await count(),0);assert.equal((await db.query('select count(*) n from private.p06_sources where org_id=$1',[org])).rows[0].n,'0');}
 finally{await db.query(`drop trigger ${trigger} on private.p06_sources`);}
 await db.query("update core.outbox_jobs set state='failed',attempts=3,lease_until=null,next_attempt_at=null where id=$1",[p.job]);
 const feature=await preview([{source_key:'feature-revoked'}]);await apply(feature,[1]);await db.query("update core.saas_plan_versions set features=array_remove(features,'F21') where id=$1",[f.plan]);const blockedFeature=await work();assert(blockedFeature.some(r=>!r.ok&&r.error.code==='PLAN_FEATURE_UNAVAILABLE'));assert.equal(await count(),0);
 await db.query("update core.outbox_jobs set state='failed',attempts=3,lease_until=null,next_attempt_at=null where id=$1",[feature.job]);await db.query("update core.saas_plan_versions set features=array_append(features,'F21') where id=$1",[f.plan]);
 const revoked=await preview([{source_key:'revoked'}]);await apply(revoked,[1]);const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await api('center_manager_revoke_v1',{person_id:person,expected_version:1,reason:'Synthetic CRM import authority revoke'});const blocked=await work();assert(blocked.some(r=>!r.ok));assert.equal(await count(),0);assert(owner&&center);
});
