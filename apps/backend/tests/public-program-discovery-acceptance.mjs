import test from 'node:test';import assert from 'node:assert/strict';import {preparationFixture} from './starter-preparation-fixture.mjs';import {context,must} from './api-client.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';import {publicCalendarGateway} from '../transports/public-calendar-gateway.mjs';
test('W1-BE-25 anonymous discovery keeps old publications private and uses an explicit active form with real consent source',async t=>{
 const f=await preparationFixture({schedule:true}),{db,org,center,room,discipline,person,api}=f;t.after(()=>db.end());const {env}=context(),at=Date.parse(f.day(3)+'T12:00:00Z'),interval={starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()};
 const session=(await api('session_create_v1',{discipline_id:discipline,format:'group',interval,resources:[{kind:'room',id:room}],assignments:[{person_id:person,duty:'instructor'}],capacity:{total:10}})).primary_id,details={title:'Explicit public lesson',venue_public_label:'Public room',fee_minor:'0',currency:'TRY',public_conditions:'Application only'};
 let publication=await api('publication_set_v1',{session_id:session,published:true,public_details:details});
 const read=async extra=>{const res=await publicCalendarGateway(new Request('https://public.invalid/api/public/calendar',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key(),slug:org,center_id:center,interval,page:{},...extra})}),{FTK_PUBLIC_BACKEND_ORIGIN:'https://native-public.invalid',FTK_PUBLIC_ANON_KEY:env.ANON_KEY},(url,init)=>fetch(env.API_URL+new URL(url).pathname,init));const result=await res.json();assert.equal(result.ok,true,JSON.stringify(result));return result.data;};
 const legacy=await read({}),initial=await read({include_details:true});assert.equal(legacy.items[0].kind,undefined);assert.equal(initial.items[0].kind,'lesson');assert.equal(initial.items[0].occupancy,null);assert.equal(initial.items[0].instructors,null);assert.equal(initial.application.state,'closed');assert.equal(initial.publication_state,'available');assert.equal((await db.query('select public_details ? $2 as flag from core.publications where id=$1',[publication.primary_id,'show_occupancy'])).rows[0].flag,false);
 publication=await api('publication_set_v1',{session_id:session,published:true,expected_version:publication.version,public_details:{...details,show_occupancy:true,show_instructors:false}});let shown=(await read({include_details:true})).items[0];assert.deepEqual(shown.occupancy,{registered:0,capacity:10});assert.equal(shown.instructors,null);
 publication=await api('publication_set_v1',{session_id:session,published:true,expected_version:publication.version,public_details:{...details,show_occupancy:false,show_instructors:true}});shown=(await read({include_details:true})).items[0];assert.equal(shown.occupancy,null);assert.equal(shown.instructors.length,1);assert.equal(shown.timezone,'UTC');assert.equal((await read({include_details:true,discipline_id:key()})).items.length,0);
 assert.equal((await read({include_details:true,interval:{starts_at:'2100-01-01T00:00:00Z',ends_at:'2100-01-02T00:00:00Z'}})).publication_state,'available');assert.equal((await read({include_details:true,slug:key()})).publication_state,'unavailable');
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[f.plan]);
 const event=key(),eventTerms={fee_minor:'0',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[],cancellation:{before_cutoff:'release',after_cutoff:'consume',no_show:'consume'},refund:{method:'none'}};await db.query("insert into core.events(id,org_id,center_id,name,starts_at,ends_at,timezone,venue,nominal,maximum,state,terms,published,attendance_state,attendance_revision) values($1,$2,$3,'Explicit public event',$4,$5,'UTC',$6,6,6,'published',$7,true,'open',0)",[event,org,center,interval.starts_at,interval.ends_at,{kind:'external',timezone:'UTC',name:'Synthetic event venue',address:'Synthetic event address'},eventTerms]);await db.query('insert into core.event_disciplines(id,org_id,center_id,event_id,discipline_id) values($1,$2,$3,$4,$5)',[key(),org,center,event,discipline]);await db.query("insert into core.event_assignments(id,org_id,center_id,event_id,person_id,duty,fee_minor,currency) values($1,$2,$3,$4,$5,'instructor',0,'TRY')",[key(),org,center,event,person]);
 let eventPublication=await api('publication_set_v1',{event_id:event,published:true,public_details:{...details,title:'Explicit event'}});let publicEvent=(await read({include_details:true})).items.find(x=>x.kind==='event');assert.equal(publicEvent.occupancy,null);assert.equal(publicEvent.instructors,null);eventPublication=await api('publication_set_v1',{event_id:event,published:true,expected_version:eventPublication.version,public_details:{...details,title:'Explicit event',show_occupancy:true,show_instructors:true}});publicEvent=(await read({include_details:true})).items.find(x=>x.kind==='event');assert.deepEqual(publicEvent.occupancy,{registered:0,capacity:6});assert.equal(publicEvent.instructors.length,1);assert.equal((await read({})).items.find(x=>x.publication_id===eventPublication.primary_id).occupancy,undefined);
 const form=key();await db.query("insert into private.crm_intake_forms(id,org_id,center_id,channel,form_key,source_url,enabled) values($1,$2,$3,'web_form','explicit-public','https://public.invalid/application',true)",[form,org,center]);assert.equal((await read({include_details:true})).application.state,'closed','A private enabled form is not implicitly published');
 const content={name:'Synthetic public consent',language:'tr',template_id:'synthetic-public-form',template_version:'1',text:'Synthetic explicit application consent text.'},doc=await api('document_version_publish_v1',{digital_content:content,version_label:'public-form-1',scope:{kind:'center',center_id:center},requirements:[]}),document=doc.related.find(x=>x.type==='documents').id;
 const catalog=await api('content_catalog_get_v1',{scope_key:'center:'+org+':'+center,code:'document.'+document,channel:'document'}),source=catalog.items.find(x=>x.source_version===doc.primary_id),binding={form_id:form,consents:[{purpose:'application',version:doc.primary_id,required:true,content_template_id:source.id}]};assert(source.id);
 await f.change('center',{public_application_form:binding});const opened=(await read({include_details:true})).application;assert.equal(opened.state,'open');assert.equal(opened.form.form_id,form);assert.deepEqual(opened.form.consents[0].content,content);assert.equal(opened.form.consents[0].source_version,doc.primary_id);assert.match(opened.form.consents[0].content_hash,/^[a-f0-9]{64}$/);assert(!JSON.stringify(opened).includes('source_url'));
 const contextOnly={mode:'context',interval:undefined};
 const publicContext=await read(contextOnly);
 assert.deepEqual(publicContext.items,[]);
 assert.deepEqual(publicContext.application,opened);
 const eventOnly={mode:'event',interval:undefined,publication_id:eventPublication.primary_id};
 const eventPage=await read(eventOnly);
 assert.deepEqual(eventPage.items,[publicEvent]);
 assert.deepEqual(eventPage.application,opened);
 for(const selector of [{center_id:key()},{slug:key()},{publication_id:publication.primary_id}]){
  const hidden=await read({...eventOnly,...selector});
  assert.deepEqual(hidden.items,[]);
  assert.equal(hidden.publication_state,'unavailable');
  assert.equal(hidden.application.form,null);
 }
 const evidence=(await db.query('select private.public_form_consent_evidence($1,$2,$3) data',[org,form,JSON.stringify([{purpose:'application',version:doc.primary_id,accepted:true,occurred_at:new Date().toISOString()}])])).rows[0].data;assert.equal(evidence.public_consents[0].content_template_id,source.id);await assert.rejects(db.query('select private.public_form_consent_evidence($1,$2,$3)',[org,form,JSON.stringify([{purpose:'application',version:'invented',accepted:true,occurred_at:new Date().toISOString()}])]),/VALIDATION_FAILED/);
 await db.query("select set_config('request.jwt.claim.role','service_role',false)");const proof={purpose:'application',version:doc.primary_id,accepted:true,occurred_at:new Date().toISOString()},submission={client_api_version:1,request_id:key(),form_id:form,client_request_key:key(),contact_intake:{display_name:'Synthetic public applicant',phone:'+12025550101',consents:[proof]}};
 const submit=async body=>(await db.query('select private.crm_intake_submit($1,$2,$3) result',[JSON.stringify(body),Array.from({length:4096},key),{ip_hash:'b'.repeat(64),target_hash:'c'.repeat(64),bot_verified:true}])).rows[0].result;
 for(const consents of [[],[{...proof,accepted:false}],[{...proof,version:'invented'}]]){const rejected=await submit({...submission,client_request_key:key(),contact_intake:{...submission.contact_intake,consents}});assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'VALIDATION_FAILED');}
 assert.equal((await db.query('select count(*)::int n from core.public_applications where org_id=$1',[org])).rows[0].n,0);assert.equal((await submit(submission)).data.accepted,true);assert.equal((await submit(submission)).data.accepted,true);
 const received=(await db.query('select id,created_at,source_snapshot,intake from core.public_applications where org_id=$1',[org])).rows[0];assert.equal(received.source_snapshot.public_consents[0].content_template_id,source.id);assert.equal(received.intake.consents[0].source.public_consents[0].content_hash,opened.form.consents[0].content_hash);
 const inbox=await api('management_state_get_v1',{operation:'public_application_review_v1',selector:{operation:'public_application_review_v1',key:{application_id:received.id,include_contact_intake:true}},page:{}});assert.equal(Date.parse(inbox.items[0].current.values.received_at),+received.created_at);
 const foreignFixture=await preparationFixture();try{const foreignForm=key();await db.query("insert into private.crm_intake_forms(id,org_id,center_id,channel,form_key,source_url,enabled) values($1,$2,$3,'web_form','foreign-public','https://foreign.invalid/application',true)",[foreignForm,foreignFixture.org,foreignFixture.center]);await assert.rejects(f.change('center',{public_application_form:{...binding,form_id:foreignForm}}),/POLICY_NOT_CONFIGURED/);}finally{await foreignFixture.db.end();}

 await t.test('W1-BE-55/56 event application follows the current address and page visibility',async()=>{
  const first='studio-'+key().slice(-10),second='studio-'+key().slice(-10);
  const atAddress=slug=>read({include_details:true,slug});
  await f.change('organization',{public_page:{slug:first,enabled:true}});
  assert.equal((await read({include_details:true})).publication_state,'unavailable');
  assert((await atAddress(first)).items.some(row=>row.publication_id===eventPublication.primary_id));
  const body={client_api_version:1,request_id:key(),client_request_key:key(),publication_id:eventPublication.primary_id,
   center_id:center,event_application:true,page_slug:first,contact:'visit@example.invalid',bot_proof:'synthetic'};
  const submitEvent=async change=>(await db.query("select private.p04_public('public_application_submit_v1',$1,$2,$3) result",
   [{...body,...change},Array.from({length:60},key),{ip_hash:'a'.repeat(64),target_hash:'d'.repeat(64),phase:'submit',bot_verified:true}])).rows[0].result;
  assert.equal((await submitEvent({publication_id:publication.primary_id})).error.code,'SERVICE_UNAVAILABLE');
  assert.equal((await submitEvent({})).data.application_state,'pending');
  assert.equal((await submitEvent({})).data.application_state,'pending');
  const {rows:[outcome]}=await db.query("select (select count(*)::int from core.public_applications where publication_id=$1 and state='pending') as pending,(select count(*)::int from core.event_registrations where event_id=$2) as registrations",[eventPublication.primary_id,event]);
  assert.deepEqual(outcome,{pending:1,registrations:0});
  await f.change('organization',{public_page:{slug:second,enabled:true}});
  assert.equal((await atAddress(first)).publication_state,'unavailable');
  assert.equal((await submitEvent({})).error.code,'SERVICE_UNAVAILABLE');
  assert.equal((await atAddress(second)).application.state,'open');
  await f.change('organization',{public_page:{slug:second,enabled:false}});
  const hidden=await atAddress(second);
  assert.equal(hidden.publication_state,'unavailable');assert.deepEqual(hidden.items,[]);assert.equal(hidden.application.form,null);
  assert.deepEqual((await read({...eventOnly,slug:second})).items,[]);
  assert.equal((await submit({...submission,client_request_key:key()})).error.code,'SERVICE_UNAVAILABLE');
  assert.equal((await submit(submission)).error.code,'SERVICE_UNAVAILABLE');
  assert.equal((await submitEvent({page_slug:second,client_request_key:key()})).error.code,'SERVICE_UNAVAILABLE');
  await f.change('organization',{public_page:{slug:second,enabled:true}});
  assert.equal((await atAddress(second)).application.state,'open');
  const {rows:[beforeSuspend]}=await db.query('select version::int from core.organizations where id=$1',[org]);
  const suspension={org_id:org,expected_version:beforeSuspend.version,suspended:true,reason:'Synthetic public route pause'};
  const stopped=await must(f.platform,'platform_organization_suspension_set_v1',suspension,key());
  const pausedPage=await atAddress(second);
  assert.equal(pausedPage.publication_state,'unavailable');assert.deepEqual(pausedPage.items,[]);assert.equal(pausedPage.application.form,null);
  assert.equal((await submitEvent({page_slug:second,client_request_key:key()})).error.code,'SERVICE_UNAVAILABLE');
  await must(f.platform,'platform_organization_suspension_set_v1',{...suspension,expected_version:stopped.version,suspended:false},key());
  assert.equal((await atAddress(second)).publication_state,'available');
  // Restore the synthetic fixture's legacy address for the older source-retirement assertions.
  await db.query("update private.frontend_settings set values=values-'public_page' where scope_key=$1",['organization:'+org]);
  await db.query("delete from private.public_page_addresses where org_id=$1 and slug in ($2,$3)",[org,first,second]);
 });

 await db.query('update private.crm_intake_forms set enabled=false where id=$1',[form]);const disabled=(await read({include_details:true})).application;assert.equal(disabled.state,'unavailable');assert.equal(disabled.form,null);await db.query('update private.crm_intake_forms set enabled=true where id=$1',[form]);
 await api('content_catalog_save_v1',{scope_key:'center:'+org+':'+center,code:'document.'+document,channel:'document',language:'tr',version:source.version,source_version:doc.primary_id,action:'invalidate'});const retired=(await read({include_details:true})).application;assert.equal(retired.state,'unavailable');assert.equal(retired.form,null);const rejected=await submit({...submission,client_request_key:key()});assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'SERVICE_UNAVAILABLE');
});
