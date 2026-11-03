import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Commercial plan limits preserve history and serialize real capacity consumption',async t=>{
 const db=await connect();
 try{
  for(const [name,cap,centerCap] of [['starter',100,1],['pro',250,1],['business',1250,5]])await t.test(name,async()=>{
   const {platform,plan}=await fixturePlatform(),owner=await authUser('commercial-'+name),account=await must(owner,'account_get_v1');
   await db.query('update core.saas_plan_versions set name=$1 where id=$2',[name,plan]);
   const historical=(await db.query('select to_jsonb(p) data from core.saas_plan_versions p where id=$1',[plan])).rows[0].data;
   const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic commercial '+name,initial_plan_id:plan},key())).primary_id;
   const api=(op,b={},k=key(),u=owner)=>must(u,op,{org_id:org,...b},k);
   const center=(await api('center_create_v1',{name:'First center',timezone:'Europe/Istanbul'})).primary_id;
   const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
   await api('center_manager_assign_v1',{center_id:center,person_id:person});
   const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic commercial acceptance',occurred_at:new Date().toISOString()});
   await api('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},key(),platform);
   const read=()=>api('subscription_get_v1'),limits=(await read()).limits.entries,limit=k=>limits.find(x=>x.key===k);
   const annual=key();await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) select $1,name,now(),2000,currency,'yearly',$2,features from core.saas_plan_versions where id=$3",[annual,{entries:[{key:'active_students',value:1}]},plan]);
   const subscription=await read();assert(subscription.billing.period_change_options.some(x=>x.id===annual));
   const pending=await api('subscription_period_change_request_v1',{target_plan_id:annual,expected_version:subscription.subscription_version,amount_minor:'2000',currency:'TRY',effective_at:subscription.period_end});
   assert.equal((await read()).billing.pending_period_change.id,pending.primary_id);
   assert.deepEqual(limit('active_students'),{key:'active_students',value:cap});
   assert.deepEqual(limit('centers'),{key:'centers',value:centerCap});
   if(name==='starter')assert.deepEqual(limit('rooms'),{key:'rooms',value:1});
   else{
    assert.deepEqual(limit('rooms'),{key:'rooms',unlimited:true});
    assert.deepEqual(limit('instructors'),{key:'instructors',unlimited:true});
    assert.equal(limit('disciplines'),undefined);
    for(let i=0;i<3;i++){
     await api('room_save_v1',{center_id:center,name:'Independent room '+i,capacity:8});
     const p=(await api('person_create_v1',{center_id:center,display_name:'Synthetic linked instructor '+i,contacts:[]})).primary_id;
     const instructor=await authUser('commercial-instructor-'+name+'-'+i),instructorAccount=await must(instructor,'account_get_v1');
     await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,instructorAccount.id,p]);
     await api('role_assign_v1',{center_id:center,person_id:p,role:'instructor',scope:{center_id:center}});
    }
    const usage=(await read()).usage.entries;assert.equal(usage.find(x=>x.key==='rooms').value,3);assert.equal(usage.find(x=>x.key==='instructors').value,3);assert(usage.every(x=>Number.isSafeInteger(x.value)&&!('unlimited' in x)));
   }
   const people=Array.from({length:cap-1},key),relations=people.map(key);
   // Bulk setup only; all capacity-consuming assertions below use normal APIs.
   await db.query("insert into core.people(id,org_id,display_name,state) select id,$1,'Synthetic capacity student','active' from unnest($2::uuid[]) id",[org,people]);
   await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) select id,$1,$2,person_id,'student','active',now() from unnest($3::uuid[],$4::uuid[]) x(id,person_id)",[org,center,relations,people]);
   assert.equal((await read()).usage.entries.find(x=>x.key==='active_students').value,cap-1);
   const candidates=[];for(let i=0;i<2;i++)candidates.push((await api('person_create_v1',{center_id:center,display_name:'Synthetic capacity contender '+i,contacts:[]})).primary_id);
   const activate=p=>call(owner,'student_activate_v1',{org_id:org,center_id:center,person_id:p},key());
   const results=await Promise.all(candidates.map(activate));assert.equal(results.filter(x=>x.result.ok).length,1);
   assert.equal(results.find(x=>!x.result.ok).result.error.code,'PLAN_LIMIT_REACHED');
   assert.equal((await read()).usage.entries.find(x=>x.key==='active_students').value,cap);
   const blocked=candidates[results.findIndex(x=>!x.result.ok)],firstActive=people[0];
   await api('student_deactivate_v1',{center_id:center,person_id:firstActive,reason:'Synthetic quota release'});
   await api('student_activate_v1',{center_id:center,person_id:blocked});
   const denied=await activate(firstActive);assert.equal(denied.result.error.code,'PLAN_LIMIT_REACHED');
   if(name==='business'){
    const second=(await api('center_create_v1',{name:'Second center',timezone:'Europe/Istanbul'})).primary_id;
    await api('center_manager_assign_v1',{center_id:second,person_id:person});
    await api('student_activate_v1',{center_id:second,person_id:blocked});
    assert.equal((await read()).usage.entries.find(x=>x.key==='active_students').value,cap);
    await api('student_deactivate_v1',{center_id:center,person_id:blocked,reason:'Synthetic center link release'});
    assert.equal((await read()).usage.entries.find(x=>x.key==='active_students').value,cap);
    await api('student_activate_v1',{center_id:center,person_id:blocked});
    for(let i=0;i<2;i++)await api('center_create_v1',{name:'Center '+i,timezone:'Europe/Istanbul'});
    const race=await Promise.all([0,1].map(i=>call(owner,'center_create_v1',{org_id:org,name:'Final center '+i,timezone:'Europe/Istanbul'},key())));
    assert.equal(race.filter(x=>x.result.ok).length,1);assert.equal(race.find(x=>!x.result.ok).result.error.code,'PLAN_LIMIT_REACHED');
   }else{
    const result=await call(owner,'center_create_v1',{org_id:org,name:'Denied second center',timezone:'Europe/Istanbul'},key());
    assert.equal(result.result.error.code,'PLAN_LIMIT_REACHED');
   }
   const merge=await api('person_merge_preview_v1',{source_id:people[1],target_id:people[2]});
   assert.deepEqual(merge.blockers,[]);await api('person_merge_apply_v1',{preview:{id:merge.id,token:merge.token}});
   assert.equal((await read()).usage.entries.find(x=>x.key==='active_students').value,cap-1);
   await api('student_activate_v1',{center_id:center,person_id:firstActive});
   assert.equal((await read()).usage.entries.find(x=>x.key==='active_students').value,cap);
   assert.deepEqual((await db.query('select to_jsonb(p) data from core.saas_plan_versions p where id=$1',[plan])).rows[0].data,historical);
   const before=(await read()).usage;
   await db.query('select private.p06_import_row_check($1,$2,$3,$4)',[org,center,{source_key:'blocked-import',display_name:'Synthetic over-cap import'},'commercial-'+name]).then(()=>assert.fail('Import must enforce the same cap'),e=>assert.match(e.message,/PLAN_LIMIT_REACHED/));
   assert.deepEqual((await read()).usage,before);
  });
 }finally{await db.end();}
});
