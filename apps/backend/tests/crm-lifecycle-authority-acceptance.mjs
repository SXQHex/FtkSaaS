import test from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleFixture} from './crm-lifecycle-fixture.mjs';
import {authUser,must} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('P11 CRM contact outcomes keep stale-version and live staff-grant checks',{timeout:300000},async t=>{
 const {db,org,center,api,denied,managed,person}=await lifecycleFixture(t);
 const target=await person('Synthetic lifecycle candidate'),staff=await authUser('crm-lifecycle-staff'),staffPerson=await person('Synthetic CRM operator');
 const account=await must(staff,'account_get_v1');
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,staffPerson]);
 await api('role_assign_v1',{person_id:staffPerson,role:'staff',scope:{center_id:center}});
 const grant=async enabled=>api('permission_set_v1',{person_id:staffPerson,permission:'crm.daily',enabled,expected_version:Number((await db.query('select version from core.people where id=$1',[staffPerson])).rows[0].version)});
 await grant(true);
 const lead=(await api('lead_save_v1',{person_id:target,source:'phone',interest:'Synthetic lesson',assigned_to:staffPerson})).primary_id;
 const followup={lead_id:lead,kind:'followup',due_at:new Date().toISOString(),note:'Synthetic callback'},followKey=key();
 const activity=await api('crm_activity_save_v1',followup,followKey,staff);assert.equal((await api('crm_activity_save_v1',followup,followKey,staff)).replayed,true);
 await grant(false);await denied('crm_activity_save_v1',followup,'FORBIDDEN',followKey,staff);await grant(true);
 const view=(await managed('crm_activity_save_v1',{lead_id:lead,activity_id:activity.primary_id})).items[0];
 const outcome={lead_id:lead,activity_id:activity.primary_id,expected_version:view.versions[0].version,kind:'outcome',outcome:'interested',note:'Synthetic completed callback'};
 await api('crm_activity_save_v1',outcome,key(),staff);await denied('crm_activity_save_v1',outcome,'VERSION_CONFLICT',key(),staff);
 await denied('lead_convert_v1',{lead_id:lead},'FORBIDDEN',key(),staff);
});
