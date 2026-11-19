import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {nativeTotp} from './native-totp-fixture.mjs';
import {success_centers_list_v1} from '../supabase/functions/backend-v1/validators.js';

async function fixture(t,label){
 const {platform,plan}=await fixturePlatform(),owner=await authUser(label+'-owner'),stranger=await authUser(label+'-stranger');
 const db=await connect();t.after(()=>db.end());
 const rows=async(q,a=[])=>(await db.query(q,a)).rows,account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic '+label,initial_plan_id:plan},key())).primary_id;
 const create=name=>must(owner,'center_create_v1',{org_id:org,name,timezone:'UTC'},key());
 const center=(await create('First')).primary_id,other=(await create('Other')).primary_id;
 const person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 const api=(op,b={},u=owner,k=key())=>must(u,op,{org_id:org,center_id:center,...b},k);
 await api('center_manager_assign_v1',{person_id:person});
 await api('center_manager_assign_v1',{center_id:other,person_id:person});
 const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic setup status',occurred_at:new Date().toISOString()});
 await api('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},platform);
 const fail=async(op,b,code,u=owner)=>{const r=await call(u,op,{org_id:org,center_id:center,...b});assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code);};
 const counts=async()=>JSON.stringify(await rows('select (select count(*) from core.audit_events where org_id=$1) a,(select count(*) from core.operation_receipts where org_id=$1) r,(select count(*) from core.outbox_jobs where org_id=$1) o',[org]));
 return {db,rows,org,center,other,owner,stranger,person,api,fail,counts};
}

test('Centers Data API preserves the plain list contract and live authorization',{timeout:300000},async t=>{
 const {db,org,center,other,owner,stranger,api,counts}=await fixture(t,'centers-data-api');
 const {env}=context();
 const read=(user,body={},origin)=>fetch(env.API_URL+'/rest/v1/rpc/centers_list_v1',{
  method:'POST',signal:AbortSignal.timeout(30000),
  headers:{apikey:env.ANON_KEY,authorization:'Bearer '+user.jwt,'content-type':'application/json',
   'content-profile':'api_read',...(origin?{origin}:{})},
  body:JSON.stringify({p_request:{client_api_version:1,request_id:key(),org_id:org,page:{},...body}}),
 });
 const compare=async(user,body={},expected,origin)=>{
  const legacy=await call(user,'centers_list_v1',{org_id:org,page:{},...body});
  const response=await read(user,body,origin),result=await response.json();
  assert.equal(response.status,legacy.status,JSON.stringify(result));
  if(!legacy.result.ok){
   assert.deepEqual(result,{ok:false,error:{...legacy.result.error,trace_id:result.error?.trace_id}});
   assert.match(result.error.trace_id,/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
   assert.equal(result.error.code,expected);
   return;
  }
  assert(success_centers_list_v1(result),JSON.stringify(success_centers_list_v1.errors));
  const businessData=({as_of,items,...rest})=>{
   assert(Number.isFinite(Date.parse(as_of)));
   return {...rest,items:items.toSorted((a,b)=>a.id.localeCompare(b.id))};
  };
  assert.deepEqual(businessData(result.data),businessData(legacy.result.data));
  assert.deepEqual(result.data.items.map(x=>x.id).sort(),expected.toSorted());
 };
 const before=await counts();
 const browserOrigin='https://centers.ftksaas.invalid';
 await db.query('insert into private.centers_read_browser_origins(origin) values($1)',[browserOrigin]);
 try{await compare(owner,{},[center,other],browserOrigin);}
 finally{await db.query('delete from private.centers_read_browser_origins where origin=$1',[browserOrigin]);}
 await compare(owner,{include_setup_status:false,page:{limit:1,cursor:null}},[center,other]);
 await compare(stranger,{},'NOT_FOUND');
 await compare(owner,{center_id:key()},'NOT_FOUND');
 await compare(owner,{org_id:key()},'NOT_FOUND');
 await compare(owner,{page:{limit:0}},'VALIDATION_FAILED');
 await compare(owner,{client_api_version:2,page:null},'CLIENT_UPDATE_REQUIRED');
 assert.equal(await counts(),before);
 const deniedOrigin=await read(owner,{},browserOrigin);
 assert.equal(deniedOrigin.status,403);
 assert.equal((await deniedOrigin.json()).error.code,'FORBIDDEN');
 await db.query("update auth.users set banned_until=now()+interval '1 hour' where id=$1",[owner.id]);
 try{await compare(owner,{},'AUTH_REQUIRED');}
 finally{await db.query('update auth.users set banned_until=null where id=$1',[owner.id]);}
 await db.query("update core.centers set timezone='' where id=$1",[other]);
 try{await compare(owner,{},'INTEGRITY_VIOLATION');}
 finally{await db.query("update core.centers set timezone='UTC' where id=$1",[other]);}

 const member=await authUser('centers-data-api-member'),account=await must(member,'account_get_v1');
 const person=(await api('person_create_v1',{display_name:'Synthetic member',contacts:[]})).primary_id,link=key();
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[link,org,account.id,person]);
 await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'student','active',now())",[key(),org,center,person]);
 await compare(member,{},[center]);
 const strong=await nativeTotp(t,member);
 await compare(member,{},'AUTH_REQUIRED');
 await compare(strong,{},[center]);
 await db.query("update core.account_links set state='revoked' where id=$1",[link]);
 await compare(strong,{},'NOT_FOUND');
 await db.query('delete from auth.sessions where id=$1',[stranger.session_id]);
 await compare(stranger,{},'AUTH_REQUIRED');

 const {rows:[grants]}=await db.query(`select
  has_schema_privilege('anon','api_read','usage') as anon_schema,
  has_function_privilege('anon','api_read.centers_list_v1(jsonb)','execute') as anon_rpc,
  has_any_column_privilege('authenticated','core.centers','select') as core_columns,
  has_function_privilege('authenticated','api_v1.centers_list_v1(jsonb,uuid,uuid,uuid[],jsonb)','execute') as service_rpc,
  has_function_privilege('authenticated','private.centers_read_rows(uuid,uuid,boolean)','execute') as projection,
  (select rolbypassrls from pg_roles where rolname='ftk_centers_read') as bypass_rls`);
 assert(Object.values(grants).every(value=>value===false),JSON.stringify(grants));

 // Shared readers complete concurrently. The existing exclusive writer fence stays in place.
 await db.query('begin');
 try{
  await db.query('select id from core.organizations where id=$1 for share',[org]);
  const response=await read(owner);
  assert.equal(response.status,200);
  assert.equal((await response.json()).ok,true);
 }finally{await db.query('rollback');}
});

test('Center setup summaries expose only scoped publication and provider handoff facts',{timeout:300000},async t=>{
 const f=await fixture(t,'setup-summary'),{db,org,center,other,owner,stranger,person,api,fail,counts}=f;
 const read=(c=center,u=owner)=>api('centers_list_v1',{center_id:c,include_setup_status:true,page:{}},u);
 const status=async(c=center)=>{const page=await read(c);assert.equal(page.items.length,1);assert.equal(page.items[0].id,c);const s=page.items[0].setup_status;assert.deepEqual(Object.keys(s).sort(),['as_of','document_published','member_invitation_sent']);assert(Number.isFinite(Date.parse(s.as_of)));return s;};
 const assertStatus=async(c,document,invitation)=>{const s=await status(c);assert.equal(s.document_published,document);assert.equal(s.member_invitation_sent,invitation);};
 await t.test('opt in is explicit, center bounded, permission checked and read only',async()=>{
  const baseline=await api('centers_list_v1',{page:{}});assert.equal(baseline.items.length,2);assert(baseline.items.every(x=>!Object.hasOwn(x,'setup_status')));
  const disabled=await api('centers_list_v1',{page:{},include_setup_status:false});assert(disabled.items.every(x=>!Object.hasOwn(x,'setup_status')));
  const before=await counts();await assertStatus(center,false,false);await assertStatus(other,false,false);assert.equal(await counts(),before);
  await fail('centers_list_v1',{center_id:null,include_setup_status:true,page:{}},'VALIDATION_FAILED');
  await fail('centers_list_v1',{include_setup_status:true,page:{}},'NOT_FOUND',stranger);
  await api('center_manager_revoke_v1',{person_id:person,expected_version:1,reason:'Synthetic live permission check'});
  await fail('centers_list_v1',{include_setup_status:true,page:{}},'FORBIDDEN');
  await api('center_manager_assign_v1',{person_id:person});
 });
 const source={name:'Synthetic setup document',language:'tr',template_id:'synthetic-setup',template_version:'1',text:'Synthetic setup acceptance terms.'};
 const publish=(scope,requirements)=>api('document_version_publish_v1',{center_id:scope.kind==='organization'?null:scope.center_id,digital_content:source,version_label:key(),scope,requirements});
 await t.test('published center documents stay local; organization documents apply to each center',async()=>{
  await publish({kind:'center',center_id:other},[{gate:'sale',scope:{center_ids:[other]},renewed_acceptance:true}]);
  await assertStatus(center,false,false);await assertStatus(other,true,false);
  await publish({kind:'organization'},[{gate:'sale',scope:{center_ids:[]},renewed_acceptance:true}]);
  await assertStatus(center,true,false);await assertStatus(other,true,false);
 });
 await t.test('queued, failed and unreferenced jobs never count as sent; provider handoff stays center scoped',async()=>{
  const target=(await api('person_create_v1',{display_name:'Synthetic invite target',contacts:[{kind:'email',value:'setup-recipient@ftksaas.invalid'}]})).primary_id;
  const sent=await api('account_access_send_v1',{person_id:target});
  await assertStatus(center,true,false);
  // This fixture isolates persisted handoff facts; invitation-delivery acceptance tests the worker/provider transition.
  await db.query("update core.outbox_jobs set state='failed',provider_reference=$2 where id=$1",[sent.job_id,key()]);await assertStatus(center,true,false);
  await db.query("update core.outbox_jobs set state='succeeded',provider_reference=null where id=$1",[sent.job_id]);await assertStatus(center,true,false);
  await db.query('update core.outbox_jobs set provider_reference=$2 where id=$1',[sent.job_id,key()]);
  const before=await counts();await assertStatus(center,true,true);await assertStatus(other,true,false);assert.equal(await counts(),before);
  await db.query("update core.invitations set state='expired' where id=(select invitation_id from private.invitation_deliveries where job_id=$1)",[sent.job_id]);await assertStatus(center,true,true);
 });
});

test('Instructor reads distinguish offline duty from the exact live verified account binding',{timeout:300000},async t=>{
 const f=await fixture(t,'setup-binding'),{db,rows,org,center,owner,stranger,api,fail,counts}=f;
 const user=await authUser('setup-binding-instructor'),account=await must(user,'account_get_v1');
 const person=(await api('person_create_v1',{display_name:'Synthetic bound instructor',contacts:[]})).primary_id,link=key();
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[link,org,account.id,person]);
 const grant=await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
 const request={operation:'role_assign_v1',selector:{operation:'role_assign_v1',key:{person_id:person,role:'instructor',scope:{center_id:center}}},page:{}};
 const state=async(expected)=>{
  const before=await counts(),page=await api('roles_list_v1',{person_id:person,page:{}}),item=page.items.find(x=>x.id===grant.primary_id);
  const management=(await api('management_state_get_v1',request)).items.find(x=>x.entity.id===grant.primary_id);
  assert(item);assert(management);assert.equal(item.account_access_granted,expected);assert.equal(management.account_access_granted,expected);
  assert.deepEqual(management.current.values,{person_id:person,role:'instructor',scope:{center_id:center}});
  for(const value of [item,management]){const text=JSON.stringify(value);for(const secret of [account.id,user.id,user.jwt,link])assert(!text.includes(secret));}
  assert.equal(await counts(),before);
 };
 await t.test('valid binding is visible without changing command inputs or exposing identity',async()=>{
  await state(true);
  await fail('roles_list_v1',{person_id:person,page:{}},'NOT_FOUND',stranger);
 });
 await t.test('a legacy duty stays offline even when its person has an active verified account',async()=>{
  await db.query('update core.role_assignments set account_link_id=null where id=$1',[grant.primary_id]);await state(false);
  const rebound=await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});assert.equal(rebound.primary_id,grant.primary_id);await state(true);
 });
 await t.test('link verification, revocation and account or Auth restrictions are evaluated live',async()=>{
  const cases=[
   ["update core.account_links set verified_at=null where id=$1",[link],"update core.account_links set verified_at=now() where id=$1"],
   ["update core.account_links set state='revoked' where id=$1",[link],"update core.account_links set state='active' where id=$1"],
   ["update core.accounts set state='pending' where id=$1",[account.id],"update core.accounts set state='active' where id=$1"],
   ["update auth.users set email_confirmed_at=null where id=$1",[user.id],"update auth.users set email_confirmed_at=now() where id=$1"],
   ["update auth.users set banned_until=now()+interval '1 hour' where id=$1",[user.id],"update auth.users set banned_until=null where id=$1"],
   ["update auth.users set deleted_at=now() where id=$1",[user.id],"update auth.users set deleted_at=null where id=$1"],
  ];
  for(const [change,args,restore] of cases){await db.query(change,args);try{await state(false);}finally{await db.query(restore,args);}await state(true);}
 });
 await t.test('inactive role never reports account access and history remains discoverable',async()=>{
  await db.query('delete from auth.sessions where user_id=$1',[user.id]);await state(true);
  const version=(await rows('select version from core.role_assignments where id=$1',[grant.primary_id]))[0].version;
  await api('role_revoke_v1',{assignment_id:grant.primary_id,expected_version:Number(version),reason:'Synthetic revoke binding'});await state(false);
 });
});
