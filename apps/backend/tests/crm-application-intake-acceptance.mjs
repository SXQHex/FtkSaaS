import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('P05 common intake normalizes phone and preserves distinct form delivery and separate consent evidence',async()=>{
 const db=await connect();
 try{
  const {platform,plan}=await fixturePlatform(),owner=await authUser('crm-intake');
  const account=await must(owner,'account_get_v1');
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic intake',initial_plan_id:plan},key())).primary_id;
  const center=(await must(owner,'center_create_v1',{org_id:org,name:'Intake center',timezone:'UTC'},key())).primary_id;
  const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:ownerPerson},key());
  const payment=(await must(owner,'saas_payment_submit_v1',{org_id:org,amount_minor:'1000',currency:'TRY',reference:'Synthetic CRM',occurred_at:new Date().toISOString()},key())).primary_id;
  await must(platform,'saas_payment_verify_v1',{org_id:org,payment_id:payment,accepted:true},key());
  const form=key();await db.query("insert into private.crm_intake_forms(id,org_id,center_id,channel,form_key,source_url,enabled) values($1,$2,$3,'web_form','synthetic-contact','https://example.invalid/contact',true)",[form,org,center]);
  const validators=await import('../supabase/functions/backend-v1/validators.js');
  const request={client_api_version:1,request_id:key(),form_id:form,client_request_key:key(),bot_proof:'synthetic',intake:{display_name:'Synthetic candidate',phone:'0090 (555) 000-0001',email:'intake@ftksaas.invalid',partner_name:'Synthetic partner',mode:'couple',attribution:{utm_campaign:'unverified-campaign'},consents:[{purpose:'privacy',accepted:true,version:'notice-v1',occurred_at:'2026-01-01T00:00:00Z'},{purpose:'marketing',accepted:false,version:'marketing-v2',occurred_at:'2026-01-01T00:00:00Z'}]}};
  const hash=s=>createHash('sha256').update(s).digest('hex');
  const rpc=async(r=request,aux={})=>{assert.equal(validators.request_public_application_submit_v1(r),true,JSON.stringify(validators.request_public_application_submit_v1.errors));await db.query("select set_config('request.jwt.claim.role','service_role',false)");return (await db.query('select api_v1.public_application_submit_v1($1,null,null,$2,$3) result',[r,Array.from({length:64},key),{ip_hash:hash('ip:'+r.client_request_key),target_hash:hash('+905550000001'),phase:'submit',bot_verified:true,...aux}])).rows[0].result;};
  assert.equal((await rpc(request,{bot_verified:false})).error.code,'BOT_VERIFICATION_FAILED');
  assert.equal((await rpc(request,{phase:'preflight',bot_verified:false})).data.bot_required,true);
  const racers=await Promise.all([connect(),connect()]);
  try{
   const outcomes=await Promise.all(racers.map(async connection=>{
    await connection.query("select set_config('request.jwt.claim.role','service_role',false)");
    return (await connection.query('select api_v1.public_application_submit_v1($1,null,null,$2,$3) result',[request,Array.from({length:64},key),{ip_hash:hash('ip:'+request.client_request_key),target_hash:hash('+905550000001'),phase:'submit',bot_verified:true}])).rows[0].result;
   }));
   assert.equal(outcomes.every(x=>x.ok===true),true,JSON.stringify(outcomes));
   assert.equal((await db.query('select count(*)::int n from core.public_applications where org_id=$1',[org])).rows[0].n,1);
  }finally{await Promise.all(racers.map(connection=>connection.end()));}
  assert.equal((await rpc()).ok,true);assert.equal((await rpc()).ok,true);
  assert.equal((await rpc({...request,intake:{...request.intake,message:'Different payload'}})).error.code,'IDEMPOTENCY_PAYLOAD_MISMATCH');
  assert.equal((await rpc({...request,client_request_key:key()})).ok,true);
  const rows=(await db.query('select * from core.public_applications where org_id=$1 order by id',[org])).rows;
  assert.equal(rows.length,2);assert.notEqual(rows[0].id,rows[1].id);
  for(const app of rows){assert.equal(app.target_contact,'+905550000001');assert.equal(app.person_id,null);assert.equal(app.source_snapshot.channel,'web_form');assert.equal(app.source_snapshot.form_key,'synthetic-contact');assert.equal(app.intake.partner_name,'Synthetic partner');assert.equal(app.intake.mode,'couple');assert.equal(app.intake.consents.length,2);assert.equal(app.intake.consents[1].accepted,false);assert.equal(app.intake.consents[0].version,'notice-v1');assert.equal(app.intake.consents[0].source.form_id,form);assert(app.intake.consents[0].received_at);}
  const counts=(await db.query("select (select count(*) from core.leads where org_id=$1)::int leads,(select count(*) from core.sales where org_id=$1)::int sales,(select count(*) from core.reservations where org_id=$1)::int reservations",[org])).rows[0];assert.deepEqual(counts,{leads:0,sales:0,reservations:0});
  assert.equal((await rpc({...request,client_request_key:key(),center_id:key()})).error.code,'NOT_FOUND');
  assert.equal((await rpc({...request,client_request_key:key(),form_id:key()})).error.code,'SERVICE_UNAVAILABLE');
  await db.query("update private.crm_intake_forms set enabled=false where id=$1",[form]);assert.equal((await rpc()).error.code,'SERVICE_UNAVAILABLE');
  await db.query("update private.crm_intake_forms set enabled=true where id=$1",[form]);
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);assert.equal((await rpc()).error.code,'PLAN_FEATURE_UNAVAILABLE');
 }finally{await db.end();}
});
