import test from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleFixture} from './crm-lifecycle-fixture.mjs';
import {must} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('P11 Pro renewal and inactivity lists include eligible leadless students',{timeout:300000},async t=>{
 const {db,org,owner,api,person}=await lifecycleFixture(t);
 const target=await person('Synthetic eligible student'),excluded=await person('Synthetic excluded student');
 for(const id of [target,excluded]){
  await api('student_activate_v1',{person_id:id});
 }
 await db.query("update core.center_relationships set started_at=now()-interval '2 days' where org_id=$1 and kind='student'",[org]);
 for(const [policy,days] of [['inactive_student_days',1],['entitlement_reminder_days',7],['negative_default',0],['negative_upper',0]])await db.query('insert into core.policy_versions(id,org_id,key,effective_at,mandatory,value) values($1,$2,$3,now(),false,$4)',[key(),org,policy,{kind:'integer',value:days}]);
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Synthetic CRM discipline',state:'active'},key())).primary_id;await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const terms={name:'Synthetic renewal rights',kind:'credits',booking_mode:'flexible',credits:2,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
 const product=(await api('product_publish_v1',{terms})).primary_id;
 const preview=await api('sale_preview_v1',{person_id:target,product_version_id:product,start_date:new Date(Date.now()-86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+5*86400000).toISOString().slice(0,10)});
 await api('sale_apply_v1',{preview:{id:preview.id,token:preview.token}});
 const inactive=await api('crm_followup_list_v1',{kind:'inactive_student',page:{}});assert(inactive.items.some(x=>x.person_id===target));assert(inactive.items.some(x=>x.person_id===excluded));assert(inactive.items.filter(x=>[target,excluded].includes(x.person_id)).every(x=>x.lead_id===null));
 for(const item of inactive.items)assert.equal(item.subscriber_number,(await db.query('select private.subscriber_number($1,$2) n',[org,item.person_id])).rows[0].n);
 const renewal=await api('crm_followup_list_v1',{kind:'renewal_due',page:{}});assert(renewal.items.some(x=>x.person_id===target));assert(!renewal.items.some(x=>x.person_id===excluded));
});
