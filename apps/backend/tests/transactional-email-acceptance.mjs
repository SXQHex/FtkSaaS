import test,{resources} from './p07-diagnostics.mjs';import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';import {newUuidV7 as id} from '../scripts/uuid.mjs';import {timedFetch} from './request-diagnostics.mjs';
test('P14 native transactional email: opt-in, source freshness, leases, retry, delivery evidence and scope',async t=>{
 const {env}=context(),guard=resources(t),db=await guard.connect(env.DB_URL),{platform,plan}=await fixturePlatform();
 const owner=await authUser('p14-owner'),foreign=await authUser('p14-other'),account=await must(owner,'account_get_v1');await must(foreign,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P14 synthetic',initial_plan_id:plan},id())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'P14 center',timezone:'UTC'},id())).primary_id;
 const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},id());
 const payment=await must(owner,'saas_payment_submit_v1',{org_id:org,center_id:center,amount_minor:'1000',currency:'TRY',reference:'synthetic P14',occurred_at:new Date().toISOString()},id());await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:payment.primary_id,accepted:true},id());
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'P14 discipline',state:'active'},id())).primary_id;await must(owner,'center_discipline_set_v1',{org_id:org,center_id:center,discipline_id:discipline,state:'active'},id());
 const sid=id(),start=new Date(Date.now()+86400000);await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,10,10,'planned','open')",[sid,org,center,discipline,start,new Date(+start+3600000)]);
 const secret=(await db.query("select vault.create_secret('synthetic-p14-provider-key') id")).rows[0].id;const events=[];
 const list=(user=owner)=>must(user,'notifications_list_v1',{org_id:org,page:{limit:200,sort:'created_at_asc'},unread_only:false});
 const pref=async enabled=>{const current=await list();return must(owner,'notification_preferences_set_v1',{org_id:org,channel:'email',purpose:'transactional',enabled,expected_version:current.email_preference.version},id());};
 const worker=async(r,aux)=>{const response=await timedFetch('p14.worker',env.API_URL+'/rest/v1/rpc/outbox_deliver_v1',{method:'POST',headers:{authorization:'Bearer '+env.SERVICE_ROLE_KEY,apikey:env.SERVICE_ROLE_KEY,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:r,p_actor_auth_id:null,p_session_id:null,p_ids:[],p_aux:aux})});if(!response.ok){await response.arrayBuffer();throw Error('RPC rejected');}return response.json();};
 const claim=async()=>{const r={request_id:id()},result=await worker(r,{invitation_phase:'claim'});assert.equal((await worker(r,{invitation_phase:'claim'}))._internal_invitation,null);return result._internal_email;};
 const notice=async(kind='session_change_apply_v1')=>{const nid=id();await db.query("insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values($1,$2,$3,$4,$5,jsonb_build_object('subject',jsonb_build_object('type','sessions','id',$5::uuid),'template_key',$4::text))",[nid,org,person,kind,sid]);return nid;};
 try{
  await db.query('insert into private.invitation_sender_config(org_id,enabled,transactional_enabled,from_email,app_origin,resend_secret_id) values($1,true,true,$2,$3,$4)',[org,'sender@ftksaas.invalid','https://p14.ftksaas.invalid',secret]);
  await t.test('channel availability and explicit email opt-in never alter mandatory in_app or allow marketing',async()=>{
   assert.equal((await list()).email_preference.enabled,false);const before=await notice();assert.equal((await db.query('select count(*)::int n from private.transactional_email_jobs where job_id=$1',[before])).rows[0].n,0);
   await pref(true);assert.equal((await list()).email_preference.enabled,true);
   const refused=await call(owner,'notification_preferences_set_v1',{org_id:org,channel:'email',purpose:'marketing',enabled:true,expected_version:1},id());assert.equal(refused.result.error.code,'SERVICE_UNAVAILABLE');
   const inapp=await call(owner,'notification_preferences_set_v1',{org_id:org,channel:'in_app',purpose:'transactional',enabled:false,expected_version:1},id());assert.equal(inapp.result.error.code,'FORBIDDEN');
   const ignored=await notice('reminder');assert.equal((await db.query('select count(*)::int n from private.transactional_email_jobs where job_id=$1',[ignored])).rows[0].n,0);
  });
  await t.test('missing catalog closes only the selected job and leaves the next event deliverable',async()=>{
   await db.query('begin');try{
    const missing=await notice(),next=await notice('reservation_create_v1');await db.query('set constraints all immediate');
    await db.query("insert into private.content_retirements(template_id) select id from private.content_templates where scope_key='platform' and code='notification.session_change' and channel='email' on conflict do nothing");
    const direct=async()=> (await db.query("select private.transactional_email_worker($1,'{\"email_phase\":\"claim\"}') value",[{request_id:id()}])).rows[0].value;
    assert.equal((await direct())._internal_invitation,null);const state=(await db.query('select state from core.outbox_jobs where id=$1',[missing])).rows[0];assert.equal(state.state,'failed');
    assert.equal((await db.query('select safe_error_code from private.transactional_email_jobs where job_id=$1',[missing])).rows[0].safe_error_code,'POLICY_NOT_CONFIGURED');
    assert.equal((await direct())._internal_email.job_id,next);
   }finally{await db.query('rollback');}
  });
  await t.test('organization notification language reaches fresh email and retries preserve the first rendered language',async()=>{
   const scope={org_id:org,scope:'organization'},before=await must(owner,'settings_get_v1',scope),regional={...before.values.regional_defaults,notification_language:'en'};
   const save=async value=>{const current=await must(owner,'settings_get_v1',scope);return must(owner,'settings_update_v1',{...scope,expected_version:current.version,patch:{regional_defaults:value}},id());};
   await save(regional);
   const nid=await notice(),english=await claim();assert.equal(english.job_id,nid);assert.equal(english.payload.subject,'[P14 synthetic] Lesson update');
   assert.equal(english.payload.text,'View your new notification in the application: https://p14.ftksaas.invalid');
   await worker(english,{email_phase:'finish',retryable:true});await save(before.values.regional_defaults);
   await db.query('update core.outbox_jobs set next_attempt_at=now() where id=$1',[nid]);
   const retry=await claim();assert.deepEqual(retry.payload,english.payload);await worker(retry,{email_phase:'finish',retryable:false});
   const next=await notice(),turkish=await claim();assert.equal(turkish.job_id,next);assert.equal(turkish.payload.subject,'[P14 synthetic] Ders değişikliği');
   assert.equal(turkish.payload.text,'Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: https://p14.ftksaas.invalid');
   await worker(turkish,{email_phase:'finish',retryable:false});
   const titles=['Rezervasyon sonucu','Ders talebi sonucu','Ders iptali','Ders değişikliği','Yer teklifi sonucu','Tahsilat sonucu','İade sonucu','Erişim değişikliği','Ders hatırlatması','Etkinlik hatırlatması','Paket bitişi hatırlatması','Ödeme vadesi hatırlatması'];
   for(const title of titles){
    const render=async language=>(await db.query('select private.notification_email_copy($1,$2) value',[language,title])).rows[0].value;
    const tr=await render('tr'),en=await render('en');assert.equal(tr.title,title);assert.equal(tr.language,'tr');assert.equal(en.language,'en');assert.notEqual(en.title,title);
    assert.deepEqual(await render('unsupported'),tr);assert.deepEqual(await render(null),tr);
   }
   assert.equal((await db.query("select private.notification_email_copy('en','untrusted payload title') value")).rows[0].value,null);
  });
  await t.test('catalog user/auto/fallback languages work without browser; retry freezes template and payload',async()=>{
   const scope={org_id:org,scope:'organization'},before=await must(owner,'settings_get_v1',scope),userScope={scope:'user'};
   const userLanguage=async language=>{const v=await must(owner,'settings_get_v1',userScope);await must(owner,'settings_update_v1',{...userScope,expected_version:v.version,patch:{language}},id());};
   const regional=async language=>{const v=await must(owner,'settings_get_v1',scope);await must(owner,'settings_update_v1',{...scope,expected_version:v.version,patch:{regional_defaults:{...v.values.regional_defaults,notification_language:language}}},id());};
   const syntheticLanguage='qae-'+id().slice(-8);const template={scope_key:'platform',code:'notification.session_change',channel:'email',language:syntheticLanguage,version:1,source_version:'1',action:'publish',content:{title:'Synthetic title',text:'Synthetic {{app_url}}'}};
   await must(platform,'content_catalog_save_v1',template,id());await userLanguage(syntheticLanguage);
   const nid=await notice(),first=await claim();assert.equal(first.job_id,nid);assert.equal(first.payload.subject,'[P14 synthetic] Synthetic title');
   const metadata=async()=> (await db.query('select content_language,content_version,content_template_id from private.transactional_email_jobs where job_id=$1',[nid])).rows[0];
   const frozen=await metadata();assert.equal(frozen.content_language,syntheticLanguage);assert.equal(Number(frozen.content_version),1);
   await worker(first,{email_phase:'finish',retryable:true});await must(platform,'content_catalog_save_v1',{...template,version:2,content:{title:'Synthetic changed',text:'Changed {{app_url}}'}},id());await userLanguage('en');
   await db.query('update core.outbox_jobs set next_attempt_at=now() where id=$1',[nid]);const retry=await claim();assert.deepEqual(retry.payload,first.payload);assert.deepEqual(await metadata(),frozen);await worker(retry,{email_phase:'finish',retryable:false});
   await regional('en');
   for(const preference of ['auto','qaf']){await userLanguage(preference);const next=await notice(),c=await claim();assert.equal(c.job_id,next);assert.equal(c.payload.subject,'[P14 synthetic] Lesson update');await worker(c,{email_phase:'finish',retryable:false});}
   await regional('qag');await userLanguage('auto');const last=await notice(),fallback=await claim();assert.equal(fallback.job_id,last);assert.equal(fallback.payload.subject,'[P14 synthetic] Ders değişikliği');await worker(fallback,{email_phase:'finish',retryable:false});
   await userLanguage('auto');const current=await must(owner,'settings_get_v1',scope);await must(owner,'settings_update_v1',{...scope,expected_version:current.version,patch:{regional_defaults:before.values.regional_defaults}},id());
  });
  await t.test('fresh notice claims once, frozen content survives configuration changes and old lease is fenced',async()=>{
   const nid=await notice(),c=await claim();assert.equal(c.job_id,nid);assert.equal((await worker(c,{email_phase:'authorize'})).authorized,true);assert.equal((await claim()),undefined);
   await worker(c,{email_phase:'finish',retryable:true});await db.query('update core.outbox_jobs set next_attempt_at=now() where id=$1',[nid]);
   await db.query("update private.invitation_sender_config set from_email='changed@ftksaas.invalid',app_origin='https://changed.ftksaas.invalid' where org_id=$1",[org]);
   const next=await claim();assert.deepEqual(next.payload,c.payload);assert.equal(next.api_key,c.api_key);await assert.rejects(worker(c,{email_phase:'finish',retryable:false}));
   const reference=id();await worker(next,{email_phase:'finish',provider_reference:reference});assert.equal((await db.query('select payload from private.transactional_email_jobs where job_id=$1',[nid])).rows[0].payload,null);const event={event_id:'msg_'+id().replaceAll('-',''),provider_reference:reference,kind:'bounced',occurred_at:new Date().toISOString(),payload_hash:'b'.repeat(64)};events.push(event.event_id);await worker(event,{email_event:true});
   const view=(await list()).items.find(n=>n.id===nid);assert.equal(view.email_job.state,'succeeded');assert.equal(view.email_job.email_delivery.state,'bounced');assert.equal((await claim()),undefined);
   assert.equal((await db.query('select count(*)::int n from core.notifications where id=$1',[nid])).rows[0].n,1);
  });
  await t.test('live preference loss and changed source cancel queued mail',async()=>{
   const nid=await notice(),c=await claim();await pref(false);assert.equal((await worker(c,{email_phase:'authorize'})).authorized,false);assert.equal((await worker(c,{email_phase:'finish',retryable:false})).state,'cancelled');
   await pref(true);const stale=await notice();await db.query('update core.sessions set version=version+1 where id=$1',[sid]);assert.equal(await claim(),undefined);assert.equal((await db.query('select state from core.outbox_jobs where id=$1',[stale])).rows[0].state,'cancelled');
  });
  await t.test('deferred enqueue observes final source state and rollback leaves no notification or email job',async()=>{
   await db.query('begin');const rolled=await notice();await db.query('rollback');assert.equal((await db.query('select count(*)::int n from core.notifications where id=$1',[rolled])).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from core.outbox_jobs where id=$1',[rolled])).rows[0].n,0);
   await db.query('begin');const final=await notice();await db.query('update core.sessions set version=version+1 where id=$1',[sid]);await db.query('commit');
   const c=await claim();assert.equal(c.job_id,final);assert.equal((await worker(c,{email_phase:'authorize'})).authorized,true);await worker(c,{email_phase:'finish',retryable:false});
  });
  await t.test('deferred email enqueue survives a bounded worker commit without table grants',async()=>{
   const role='p14_w_'+id().replaceAll('-',''),fn=role+'_notice',nid=id();
   await db.query('create role "'+role+'" nologin');await db.query('grant "'+role+'" to current_user with inherit false, set true');
   try{
    await db.query(`create function private."${fn}"(n uuid) returns void language plpgsql security definer set search_path='' as $fn$begin insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(n,'${org}','${person}','session_change_apply_v1','${sid}',jsonb_build_object('subject',jsonb_build_object('type','sessions','id','${sid}')));end$fn$`);
    await db.query('revoke all on function private."'+fn+'"(uuid) from public');await db.query('grant usage on schema private to "'+role+'"');await db.query('grant execute on function private."'+fn+'"(uuid) to "'+role+'"');
    assert.equal((await db.query("select has_schema_privilege($1,'core','usage') p",[role])).rows[0].p,false);
    assert.equal((await db.query("select has_table_privilege($1,'core.notifications','insert') p",[role])).rows[0].p,false);
    await db.query('begin');try{await db.query('set local role "'+role+'"');await db.query('select private."'+fn+'"($1)',[nid]);await db.query('commit');}catch(error){await db.query('rollback');throw error;}
    const c=await claim();assert.equal(c.job_id,nid);await worker(c,{email_phase:'finish',retryable:false});
   }finally{await db.query('drop function if exists private."'+fn+'"(uuid)');await db.query('revoke usage on schema private from "'+role+'"');await db.query('drop role "'+role+'"');}
  });
  await t.test('Pro availability and revoked recipient account link are checked live',async()=>{
   await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);assert.equal((await list()).email_preference.available,true);
   const nid=await notice(),c=await claim();const links=(await db.query("update core.account_links set state='revoked' where org_id=$1 and person_id=$2 and state='active' returning id",[org,person])).rows;
   try{assert.equal((await worker(c,{email_phase:'authorize'})).authorized,false);await worker(c,{email_phase:'finish',retryable:false});assert.equal((await db.query('select state from core.outbox_jobs where id=$1',[nid])).rows[0].state,'cancelled');}
   finally{await db.query("update core.account_links set state='active' where id=any($1::uuid[])",[links.map(x=>x.id)]);await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);}
  });
  await t.test('23h unknown outcome closes safely; permanent rejection never re-enters dispatch',async()=>{
   const nid=await notice(),c=await claim();await worker(c,{email_phase:'finish',retryable:true});await db.query("update private.transactional_email_jobs set first_attempt_at=now()-interval '24 hours' where job_id=$1",[nid]);await db.query('update core.outbox_jobs set next_attempt_at=now() where id=$1',[nid]);assert.equal(await claim(),undefined);
   assert.equal((await db.query('select state from core.outbox_jobs where id=$1',[nid])).rows[0].state,'failed');const permanent=await notice(),next=await claim();await worker(next,{email_phase:'finish',retryable:false});assert.equal((await db.query('select state from core.outbox_jobs where id=$1',[permanent])).rows[0].state,'failed');assert.equal(await claim(),undefined);
  });
  await t.test('P15 reminder opt-in is separate; quiet hours defer only email and final checks preserve in_app',async()=>{
   const policy=(await must(owner,'policy_publish_v1',{org_id:org,key:'student_cancel_group',value:{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}},effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false},id())).primary_id;
   const rid=id();await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[rid,org,center,sid,person,policy]);
   const reminder=async()=>{const nid=id(),ctx=(await db.query("select private.reminder_context($1,$2,$3,'lesson',$4) value",[org,center,person,rid])).rows[0].value;assert(ctx);await db.query("insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values($1,$2,$3,'reminder',$4,$5)",[nid,org,person,rid,{template_key:'p05.lesson',reminder_center_id:center,reminder_source_version:ctx.source_version,subject:{type:'reservations',id:rid}}]);return nid;};
   const prefReminder=async enabled=>{const v=(await list()).reminder_email_preference;return must(owner,'notification_preferences_set_v1',{org_id:org,channel:'email',purpose:'reminder',enabled,expected_version:v.version},id());};
   const settings=async patch=>{const v=await must(owner,'settings_get_v1',{scope:'user'});return must(owner,'settings_update_v1',{scope:'user',expected_version:v.version,patch},id());};
   assert.equal((await list()).reminder_email_preference.enabled,false);const off=await reminder();assert.equal((await db.query('select count(*)::int n from private.transactional_email_jobs where job_id=$1',[off])).rows[0].n,0);await prefReminder(true);
   const start=new Date(Date.now()-120000).toISOString().slice(11,16),end=new Date(Date.now()+1800000).toISOString().slice(11,16);
   await settings({timezone_name:'UTC',quiet_hours_enabled:true,quiet_hours_start:start,quiet_hours_end:end,quiet_hours_weekdays:[1,2,3,4,5,6,7]});
   const pending=await reminder();assert.equal(await claim(),undefined);let job=(await db.query('select * from core.outbox_jobs where id=$1',[pending])).rows[0];assert.equal(job.state,'pending');assert.equal(Number(job.attempts),0);assert(job.next_attempt_at>new Date());
   const immediate=await notice(),transactional=await claim();assert.equal(transactional.job_id,immediate);assert.equal((await worker(transactional,{email_phase:'authorize'})).authorized,true);await worker(transactional,{email_phase:'finish',retryable:false});
   await settings({quiet_hours_enabled:false});await db.query('update core.outbox_jobs set next_attempt_at=now() where id=$1',[pending]);let c=await claim();assert.equal(c.job_id,pending);assert.equal((await worker(c,{email_phase:'authorize'})).authorized,true);
   await settings({quiet_hours_enabled:true});assert.equal((await worker(c,{email_phase:'authorize'})).authorized,false);assert.equal((await worker(c,{email_phase:'finish',retryable:false})).state,'retry_wait');job=(await db.query('select * from core.outbox_jobs where id=$1',[pending])).rows[0];assert.equal(Number(job.attempts),0);
   await settings({quiet_hours_enabled:false});await db.query('update core.outbox_jobs set next_attempt_at=now() where id=$1',[pending]);c=await claim();await prefReminder(false);assert.equal((await worker(c,{email_phase:'authorize'})).authorized,false);assert.equal((await worker(c,{email_phase:'finish',retryable:false})).state,'cancelled');
   assert((await list()).items.some(n=>n.id===pending));await prefReminder(true);const stale=await reminder();await db.query("update core.sessions set starts_at=starts_at+interval '1 hour',ends_at=ends_at+interval '1 hour',version=version+1 where id=$1",[sid]);assert.equal(await claim(),undefined);assert.equal((await db.query('select state from core.outbox_jobs where id=$1',[stale])).rows[0].state,'cancelled');
   await prefReminder(false);
  });
  await t.test('Starter and disabled sender close even stored preferences; foreign account cannot read the inbox',async()=>{
   const historicalPlan=id(),historicalSubscription=id();
   await db.query("insert into core.saas_plan_versions select (jsonb_populate_record(null::core.saas_plan_versions,to_jsonb(p)||jsonb_build_object('id',$2::uuid,'name','pro'))).* from core.saas_plan_versions p where p.id=$1",[plan,historicalPlan]);
   await db.query("insert into core.saas_subscriptions select (jsonb_populate_record(null::core.saas_subscriptions,to_jsonb(s)||jsonb_build_object('id',$2::uuid,'created_at',now()-interval '90 days','plan_version_id',$3::uuid,'starts_at',now()-interval '90 days','period_end',now()-interval '60 days','grace_until',now()-interval '59 days','state','ended'))).* from core.saas_subscriptions s where s.org_id=$1 order by s.created_at desc,s.id desc limit 1",[org,historicalSubscription,historicalPlan]);
   const nid=await notice();await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);try{assert.equal(await claim(),undefined);assert.equal((await db.query('select state from core.outbox_jobs where id=$1',[nid])).rows[0].state,'cancelled');assert.equal((await list()).email_preference.available,false);}finally{await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);await db.query('delete from core.saas_subscriptions where id=$1',[historicalSubscription]);await db.query('delete from core.saas_plan_versions where id=$1',[historicalPlan]);}
   const denied=await call(foreign,'notifications_list_v1',{org_id:org,page:{limit:10,sort:'created_at_asc'},unread_only:false});assert.equal(denied.result.ok,false);
   const pending=await notice(),c=await claim();await db.query('update private.invitation_sender_config set transactional_enabled=false where org_id=$1',[org]);assert.equal((await worker(c,{email_phase:'authorize'})).authorized,false);await worker(c,{email_phase:'finish',retryable:false});assert.equal((await db.query('select state from core.outbox_jobs where id=$1',[pending])).rows[0].state,'cancelled');
  });
 }finally{await db.query('delete from private.email_provider_events where event_id=any($1::text[])',[events]);await db.query('delete from private.invitation_sender_config where org_id=$1',[org]);await db.query('delete from vault.secrets where id=$1',[secret]);}
});
