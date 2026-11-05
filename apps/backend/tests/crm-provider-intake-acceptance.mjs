import test from 'node:test';
import assert from 'node:assert/strict';
import {must} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {providerFixture} from './crm-provider-fixture.mjs';

test('P08/P09 providers share the real CRM inbox with atomic external delivery identity',{timeout:300000},async t=>{
 const {db,org,owner,center,meta,google,client,worker,submit,count}=await providerFixture(t);
 const second=await worker(),outcomes=await Promise.all([submit(meta,client),submit(meta,second)]);
 assert.equal(outcomes[0].application_id,outcomes[1].application_id);assert.deepEqual(outcomes.map(x=>x.replayed).sort(),[false,true]);assert.equal(await count(),1);
 assert.equal((await submit()).replayed,true);
 await assert.rejects(submit({...meta,intake:{...meta.intake,message:'Changed same external delivery'}}),/IDEMPOTENCY_PAYLOAD_MISMATCH/);
 const next=await submit({...meta,external_lead_id:meta.external_lead_id+'1'}),other=await submit(google);assert.notEqual(next.application_id,outcomes[0].application_id);assert.notEqual(other.application_id,next.application_id);assert.equal(await count(),3);
 const rows=(await db.query('select * from core.public_applications where org_id=$1',[org])).rows;
 assert.deepEqual(rows.map(x=>x.source_snapshot.channel).sort(),['google_ads','meta','meta']);
 for(const row of rows){assert.equal(row.person_id,null);assert.equal(row.bot_verified_at,null);assert.equal(row.target_contact,meta.intake.phone);assert.equal(row.intake.consents.length,2);assert.equal(row.intake.consents[1].accepted,false);assert.equal(row.intake.consents[0].source.channel,row.source_snapshot.channel);assert(row.intake.consents[0].received_at);assert(row.provider_payload_hash);assert(row.request_reference);assert.equal(row.source_snapshot.is_test,row.source_snapshot.channel==='meta'?null:true);}
 const inbox=await must(owner,'management_state_get_v1',{org_id:org,center_id:center,operation:'public_application_review_v1',selector:{operation:'public_application_review_v1',key:{}},page:{limit:100}});
 for(const row of rows){const item=inbox.items.find(x=>x.entity.id===row.id);assert(item);assert.equal(item.current.values.source.channel,row.source_snapshot.channel);assert.equal(item.current.values.intake.consents[0].source.external_lead_id,row.provider_lead_id);}
 const untouched=(await db.query('select (select count(*) from core.leads where org_id=$1)::int leads,(select count(*) from core.sales where org_id=$1)::int sales,(select count(*) from core.reservations where org_id=$1)::int reservations',[org])).rows[0];assert.deepEqual(untouched,{leads:0,sales:0,reservations:0});
});

test('P08/P09 receiver scopes, live plan and late failure protect the shared intake',{timeout:300000},async t=>{
 const {db,org,plan,role,metaForm,meta,client,submit,count}=await providerFixture(t);
 await assert.rejects(client.query('select * from core.public_applications'),/permission denied/);
 await assert.rejects(client.query('select * from private.crm_intake_forms'),/permission denied/);
 const raw=value=>client.query('select private.crm_provider_submit($1,$2)',[value,[key(),key()]]);
 for(const intake of [...['a(comment)@b.c','a@b..com','a<name>@example.com'].map(email=>({...meta.intake,email})),{...meta.intake,display_name:123},{...meta.intake,extra:'not allowed'},{...meta.intake,interest:'x'.repeat(1001)},{...meta.intake,message:'x'.repeat(10001)},{...meta.intake,consents:[{purpose:123,accepted:true,version:42,occurred_at:'2026-01-01T00:00:00Z'}]}])await assert.rejects(raw({...meta,intake}),/VALIDATION_FAILED/);
 for(const submitted_at of ['now','epoch','2026-02-30T00:00:00Z'])await assert.rejects(raw({...meta,submitted_at}),/VALIDATION_FAILED/);
 assert.equal(await count(),0);
 for(const who of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'private.crm_provider_submit(jsonb,uuid[])','EXECUTE') allowed",[who])).rows[0].allowed,false);
 for(const broken of [{...meta,external_page_id:meta.external_page_id+'1'},{...meta,external_form_id:meta.external_form_id+'1'}])await assert.rejects(submit(broken),/FORBIDDEN/);
 await assert.rejects(submit({...meta,org_id:org}),/PROVIDER_PAYLOAD/);
 await client.query("select set_config('request.jwt.claim.role','service_role',false)");
 await db.query('delete from private.crm_provider_receiver_scopes where db_role=$1',[role]);await assert.rejects(submit(),/FORBIDDEN/);assert.equal(await count(),0);
 await db.query('insert into private.crm_provider_receiver_scopes values($1,$2)',[role,metaForm]);
 await db.query('update private.crm_intake_forms set enabled=false where id=$1',[metaForm]);await assert.rejects(submit(),/FORBIDDEN/);await db.query('update private.crm_intake_forms set enabled=true where id=$1',[metaForm]);
 const name=(await db.query('select name from core.saas_plan_versions where id=$1',[plan])).rows[0].name;
 await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);await assert.rejects(submit(),/PLAN_FEATURE_UNAVAILABLE/);await db.query('update core.saas_plan_versions set name=$2 where id=$1',[plan,name]);
 // Force a route change after the receiver's first lookup but before its locked recheck.
 const pid=(await client.query('select pg_backend_pid() pid')).rows[0].pid;
 let pending;
 await db.query('begin');
 try{
  await db.query('select 1 from core.organizations where id=$1 for update',[org]);
  pending=submit().then(value=>({value}),error=>({error}));
  let blocked=false;
  for(let n=0;n<50;n++){
   await db.query('select pg_stat_clear_snapshot()');
   blocked=(await db.query("select wait_event_type='Lock' blocked from pg_stat_activity where pid=$1",[pid])).rows[0]?.blocked===true;
   if(blocked)break;await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert(blocked,'Receiver reached the organization lock');
  await db.query('update private.crm_intake_forms set external_form_id=$2 where id=$1',[metaForm,meta.external_form_id+'1']);await db.query('commit');
  assert.equal((await pending).error?.message,'FORBIDDEN');assert.equal(await count(),0);
 }finally{
  await db.query('rollback');if(pending)await pending;await db.query('update private.crm_intake_forms set external_form_id=$2 where id=$1',[metaForm,meta.external_form_id]);
 }
 const trigger='crm_late_'+key().replaceAll('-','');
 try{
  await db.query(`create function private."${trigger}"() returns trigger language plpgsql set search_path='' as $$begin if new.org_id='${org}'::uuid then raise exception 'Synthetic provider late failure';end if;return new;end$$; create trigger "${trigger}" after insert on core.public_applications for each row execute function private."${trigger}"()`);
  await assert.rejects(submit(),/PROVIDER_PERSISTENCE/);assert.equal(await count(),0);
 }finally{await db.query(`drop trigger if exists "${trigger}" on core.public_applications;drop function private."${trigger}"()`);}
 const result=await submit();assert.equal(result.replayed,false);assert.equal(await count(),1);
 await db.query("select set_config('request.jwt.claim.role','service_role',false)");
 const web=(await db.query('select private.crm_intake_submit($1,$2,$3) result',[{form_id:metaForm,client_request_key:key(),intake:meta.intake},[key(),key()],{bot_verified:true,phase:'submit'}])).rows[0].result;
 assert.equal(web.ok,false);assert.equal(web.error.code,'SERVICE_UNAVAILABLE');assert.equal(await count(),1);
});
