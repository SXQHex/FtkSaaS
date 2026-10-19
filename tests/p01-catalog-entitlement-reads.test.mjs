import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('P01-A catalog and purchased-right reads through real Auth -> Edge -> RPC',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('p01-owner'),stranger=await authUser('p01-foreign');
 const account=await must(owner,'account_get_v1'),org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P01 reads',initial_plan_id:plan},key())).primary_id;
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 const scope=b=>({org_id:org,...b}),mut=(op,b={},u=owner)=>must(u,op,scope(b),key());
 const fail=async(u,op,b,code)=>{const v=await call(u,op,scope(b));assert.equal(v.result.ok,false,JSON.stringify(v.result));assert.equal(v.result.error.code,code,JSON.stringify(v.result));};
 try{
 const c1=(await mut('center_create_v1',{name:'One',timezone:'Europe/Istanbul'})).primary_id;
 const c2=(await mut('center_create_v1',{name:'Two',timezone:'UTC'})).primary_id;
 const person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 for(const c of [c1,c2])await mut('center_manager_assign_v1',{center_id:c,person_id:person});
 const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic P01',occurred_at:new Date().toISOString()});
 await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
 const d1=(await mut('discipline_save_v1',{name:'Salsa',state:'active'})).primary_id;
 const d2=(await mut('discipline_save_v1',{name:'Yoga',state:'active'})).primary_id;
 for(const c of [c1,c2])for(const discipline_id of [d1,d2])await mut('center_discipline_set_v1',{center_id:c,discipline_id,state:'active'});
 async function linked(label,role){
  const p=(await mut('person_create_v1',{center_id:c1,display_name:label,contacts:[]})).primary_id;
  const u=await authUser(label),a=await must(u,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
  if(role==='student')await mut('student_activate_v1',{center_id:c1,person_id:p});
  if(role==='center_manager')await mut('center_manager_assign_v1',{center_id:c1,person_id:p});
  if(role==='staff')await mut('role_assign_v1',{center_id:c1,person_id:p,role,scope:{center_id:c1}});
  return {p,u,a};
 }
 const self=await linked('p01-self','student'),other=await linked('p01-other','student'),cm=await linked('p01-cm','center_manager'),staff=await linked('p01-staff','staff');
 const now=new Date(),start=new Date(+now+86400000);start.setUTCHours(9,0,0,0);
 const startDate=new Date(+now-2*86400000).toISOString().slice(0,10),endDate=new Date(+now+40*86400000).toISOString().slice(0,10);
 async function session(c=c1,d=d1){
  const s=key();await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,10,10,'planned','open')",[s,org,c,d,start,new Date(+start+3600000)]);return s;
 }
 const ses=await session(),foreignCenterSession=await session(c2);
 const base={name:'P01 credits',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
 const versions=[];
 async function product(extra={},c=c1,product_id){
  const v=(await mut('product_publish_v1',{center_id:c,terms:{...base,...extra},...(product_id?{product_id}:{})})).primary_id;
  versions.push(v);return v;
 }
 async function sale(v,p=self.p,c=c1,dates={}){
  const preview=await must(owner,'sale_preview_v1',scope({center_id:c,person_id:p,product_version_id:v,start_date:startDate,end_date:endDate,...dates}));
  return (await mut('sale_apply_v1',{center_id:c,preview:{id:preview.id,token:preview.token}})).primary_id;
 }
 const version=await product(),sold=await sale(version);
 const secondVersion=await product({name:'P01 two'}),secondSale=await sale(secondVersion);
 const productId=(await rows('select product_id from core.product_versions where id=$1',[version]))[0].product_id;
 const updated=await product({name:'P01 latest',price_minor:'500'},c1,productId);
 await mut('student_activate_v1',{center_id:c2,person_id:self.p});
 const remoteVersion=await product({name:'Other center'},c2),remoteSale=await sale(remoteVersion,self.p,c2);
 await db.query("update core.center_relationships set state='inactive' where org_id=$1 and center_id=$2 and person_id=$3",[org,c2,self.p]);
 const narrowVersion=await product({name:'Wrong discipline',scopes:[{scope_kind:'center_discipline',center_id:c1,discipline_id:d2,usage_targets:['lesson']}]}),narrowSale=await sale(narrowVersion);
 const timedVersion=await product({name:'Timed weekly',kind:'timed',credits:null,quota:{period:'week',limit:1}}),timedSale=await sale(timedVersion);
 const expiredSale=await sale(secondVersion,self.p,c1,{start_date:'2020-01-01',end_date:'2020-02-01'});
 const anotherSale=await sale(secondVersion,other.p);
 const read=(u=self.u,b={})=>must(u,'entitlements_get_v1',scope({person_id:self.p,...b}));
 const catalog=(u=self.u,b={})=>must(u,'products_list_v1',scope({page:{},...b}));
 const ids=a=>a.map(v=>v.sale_id);
 await t.test('catalog shows latest effective version; sold source remains immutable',async()=>{
  const list=await catalog(),item=list.items.find(x=>x.id===productId);
  assert.equal(item.version_id,updated);assert.equal(item.terms.price_minor,'500');
  assert.equal(item.terms.name,base.name); // Existing publisher retains the product identity name.
  assert(!list.items.some(x=>x.version_id===version||x.version_id===remoteVersion||x.version_id===timedVersion));
  assert.equal((await read()).find(x=>x.sale_id===sold).product_version_id,version);
  const price=(await rows('select net_minor::text amount from core.sales where id=$1',[sold]))[0].amount;assert.equal(price,'0');
  const saved=await rows('select effective_at from core.product_versions where id=$1',[updated]);
  await db.query("update core.product_versions set effective_at=now()+interval '1 day' where id=$1",[updated]);
  assert.equal((await catalog()).items.find(x=>x.id===productId).version_id,version);
  await db.query('update core.product_versions set effective_at=$2 where id=$1',[updated,saved[0].effective_at]);
 });
 await t.test('catalog pagination is stable on ties and binds actor, center, sort and timed selection',async()=>{
  await db.query("update core.products set created_at='2020-01-01T00:00:00Z' where org_id=$1",[org]);
  const all=await catalog(),seen=[];let cursor;
  do{const page=await catalog(self.u,{page:{limit:1,...(cursor?{cursor}:{})}});seen.push(...page.items.map(x=>x.id));cursor=page.next_cursor;}while(cursor);
  assert.deepEqual(seen,all.items.map(x=>x.id));assert.equal(new Set(seen).size,seen.length);
  const page=await catalog(self.u,{page:{limit:1}});assert(page.next_cursor);
  for(const b of [{center_id:c1},{include_timed_products:true},{page:{sort:'created_at_desc',cursor:page.next_cursor}}])
   await fail(self.u,'products_list_v1',{page:{cursor:page.next_cursor},...b},'VALIDATION_FAILED');
  await fail(cm.u,'products_list_v1',{page:{cursor:page.next_cursor}},'VALIDATION_FAILED');
  await fail(self.u,'products_list_v1',{page:{cursor:'malformed'}},'VALIDATION_FAILED');
  await fail(self.u,'products_list_v1',{page:{sort:'display_name_asc'}},'VALIDATION_FAILED');
  assert.deepEqual((await catalog(self.u,{page:{sort:'created_at_desc'}})).items.map(x=>x.id),[...seen].reverse());
 });
 await t.test('validity boundaries, account state and expiry order match the allocation kernel',async()=>{
  const saved=await rows('select id,valid_from,valid_until,created_at from core.sales where org_id=$1 and id=any($2::uuid[])',[org,[sold,secondSale,remoteSale]]);
  const restore=async()=>{for(const r of saved)await db.query('update core.sales set valid_from=$2,valid_until=$3,created_at=$4 where id=$1',[r.id,r.valid_from,r.valid_until,r.created_at]);};
  try{
   await db.query("update core.sales set valid_from=$2,valid_until=$2::timestamptz+interval '3 days',created_at='2020-01-01' where id=any($1::uuid[])",[[sold,secondSale],start]);
   await db.query('update core.sales set valid_until=null where id=$1',[remoteSale]);
   const list=await read(self.u,{session_id:ses});
   assert.deepEqual(ids(list),[sold,secondSale].sort().concat(remoteSale));
   await db.query('update core.sales set valid_until=$2 where id=$1',[sold,start]);
   assert(!ids(await read(self.u,{session_id:ses})).includes(sold));
   await db.query("update core.sales set valid_from=$2::timestamptz+interval '1 second' where id=$1",[secondSale,start]);
   assert(!ids(await read(self.u,{session_id:ses})).includes(secondSale));
   await db.query("update core.entitlement_accounts set state='suspended' where sale_id=$1",[remoteSale]);
   assert(!ids(await read(self.u,{session_id:ses})).includes(remoteSale));
  }finally{await restore();await db.query("update core.entitlement_accounts set state='active' where sale_id=$1",[remoteSale]);}
 });
 await t.test('session context filters date, discipline and shared pool using actual source sale ids',async()=>{
  const list=await read(self.u,{session_id:ses});
  assert.deepEqual(new Set(ids(list)),new Set([sold,secondSale,remoteSale]));
  assert(list.every(x=>x.available_at_session===1));assert(!ids(list).includes(narrowSale));assert(!ids(list).includes(expiredSale));assert(!ids(list).includes(anotherSale));
  assert.equal(list.find(x=>x.sale_id===sold).booking_mode,'flexible');
  assert.deepEqual(await read(self.u,{session_id:ses,booking_mode:'priority'}),[]);
  await fail(self.u,'entitlements_get_v1',{person_id:self.p,booking_mode:'flexible'},'VALIDATION_FAILED');
  await fail(self.u,'entitlements_get_v1',{person_id:self.p,center_id:c2,session_id:ses},'NOT_FOUND');
  await db.query("update core.sessions set state='cancelled' where id=$1",[ses]);
  assert.deepEqual(await read(self.u,{session_id:ses}),[]);
  await db.query("update core.sessions set state='planned' where id=$1",[ses]);
 });
 await t.test('center scope, tenant and person ownership cannot be expanded by identifiers',async()=>{
  await fail(self.u,'entitlements_get_v1',{person_id:other.p,session_id:ses},'FORBIDDEN');
  await fail(staff.u,'entitlements_get_v1',{person_id:self.p,session_id:ses},'FORBIDDEN');
  await fail(cm.u,'products_list_v1',{center_id:c2,page:{}},'FORBIDDEN');
  await fail(self.u,'products_list_v1',{center_id:c2,page:{}},'FORBIDDEN');
  await fail(self.u,'entitlements_get_v1',{person_id:self.p,session_id:foreignCenterSession},'FORBIDDEN');
  for(const op of ['products_list_v1','entitlements_get_v1']){
   const b=op==='products_list_v1'?{page:{}}:{person_id:self.p,session_id:ses};
   await fail(stranger,op,b,'NOT_FOUND');await fail(owner,op,{...b,org_id:key()},'NOT_FOUND');
  }
  const ownCenter=await read(cm.u,{center_id:c1});assert(!ids(ownCenter).includes(remoteSale));
  assert(ids(await read(cm.u,{session_id:ses})).includes(remoteSale));
  await mut('permission_set_v1',{center_id:c1,person_id:staff.p,permission:'reservation.write',expected_version:1,enabled:true});
  assert(ids(await read(staff.u,{session_id:ses})).includes(sold));
  await db.query("update core.permission_overrides set enabled=false where org_id=$1 and person_id=$2 and permission='reservation.write'",[org,staff.p]);
  await fail(staff.u,'entitlements_get_v1',{person_id:self.p,session_id:ses},'FORBIDDEN');
 });
 await t.test('credit and timed capabilities are separate and timed quota exhaustion is projected',async()=>{
  const full=await read(self.u,{session_id:ses,include_timed_rights:true});assert(ids(full).includes(timedSale));
  assert((await catalog(self.u,{include_timed_products:true})).items.some(x=>x.version_id===timedVersion));
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F16') where id=$1",[plan]);
  assert(ids(await read(self.u,{session_id:ses})).includes(sold));assert((await catalog()).items.length>0);
  await fail(self.u,'entitlements_get_v1',{person_id:self.p,session_id:ses,include_timed_rights:true},'PLAN_FEATURE_UNAVAILABLE');
  await fail(self.u,'products_list_v1',{page:{},include_timed_products:true},'PLAN_FEATURE_UNAVAILABLE');
  await db.query("update core.saas_plan_versions set features=array_append(features,'F16') where id=$1",[plan]);
  const res=key(),policy=key();
  await db.query("insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values($1,$2,$3,'student_cancel_group',now(),false,$4)",[policy,org,c1,{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}}]);
  await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[res,org,c1,ses,self.p,policy]);
  await db.query("insert into core.entitlement_allocations(id,org_id,sale_id,reservation_id,quantity,state) values($1,$2,$3,$4,1,'reserved')",[key(),org,timedSale,res]);
  assert(!ids(await read(self.u,{session_id:ses,include_timed_rights:true})).includes(timedSale));
  await db.query("update core.entitlement_allocations set state='released' where reservation_id=$1",[res]);
  await db.query("update core.reservations set state='cancelled' where id=$1",[res]);
 });
 await t.test('read is advisory: concurrent last-right booking rechecks and cannot double-spend',async()=>{
  const s2=await session();
  await mut('policy_publish_v1',{key:'reservation_window',value:{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false},effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
  const before=await read(self.u,{session_id:ses});assert(ids(before).includes(sold));
  const out=await Promise.all([call(owner,'reservation_create_v1',scope({center_id:c1,session_id:ses,person_id:self.p,mode:'flexible',source_sale_id:sold}),key()),call(owner,'reservation_create_v1',scope({center_id:c1,session_id:s2,person_id:self.p,mode:'flexible',source_sale_id:sold}),key())]);
  assert.equal(out.filter(x=>x.result.ok).length,1,JSON.stringify(out.map(x=>x.result)));
  assert.equal(out.filter(x=>!x.result.ok)[0].result.error.code,'ENTITLEMENT_UNAVAILABLE');
  assert(!ids(await read(self.u,{session_id:s2})).includes(sold));
  assert.equal((await rows("select count(*)::int n from core.entitlement_allocations where org_id=$1 and sale_id=$2 and state='reserved'",[org,sold]))[0].n,1);
 });
 await t.test('read paths do not allocate, create receipts or mutate finance/audit/outbox',async()=>{
  const names=['entitlement_allocations','entitlement_movements','operation_receipts','audit_events','outbox_jobs','notifications','cash_movements'];
  const counts=async()=>Promise.all(names.map(async n=>(await rows('select count(*)::int n from core.'+n+' where org_id=$1',[org]))[0].n));
  const before=await counts();await catalog();await read(self.u,{session_id:ses});await read(self.u,{include_timed_rights:true});assert.deepEqual(await counts(),before);
 });
 await t.test('role, student link and Auth session revocations apply on the next read',async()=>{
  await db.query("update core.role_assignments set state='inactive' where org_id=$1 and person_id=$2 and role='center_manager'",[org,cm.p]);
  await fail(cm.u,'products_list_v1',{center_id:c1,page:{}},'FORBIDDEN');
  await db.query("update core.center_relationships set state='inactive' where org_id=$1 and person_id=$2",[org,self.p]);
  await fail(self.u,'products_list_v1',{page:{}},'FORBIDDEN');
  await db.query("update core.center_relationships set state='active' where org_id=$1 and person_id=$2",[org,self.p]);
  await db.query("update core.account_links set state='revoked' where org_id=$1 and person_id=$2",[org,self.p]);
  await fail(self.u,'entitlements_get_v1',{person_id:self.p},'NOT_FOUND');
  await db.query("update core.account_links set state='active' where org_id=$1 and person_id=$2",[org,self.p]);
  // Application-side revocation is checked by the RPC even while Auth still
  // accepts the token. A deleted Auth session may instead be rejected earlier
  // by /auth/v1/user, which the existing Edge adapter maps to AUTH_REQUIRED.
  await db.query("update core.accounts set state='deletion_pending' where id=$1",[self.a.id]);
  await fail(self.u,'products_list_v1',{page:{}},'SESSION_REVOKED');
  await db.query("update core.accounts set state='active' where id=$1",[self.a.id]);
  await db.query('delete from auth.sessions where id=$1',[self.u.session_id]);
  const denied=await call(self.u,'products_list_v1',scope({page:{}}));
  assert.equal(denied.result.ok,false);
  assert(['AUTH_REQUIRED','SESSION_REVOKED'].includes(denied.result.error.code),JSON.stringify(denied.result));
  assert.equal((await rows('select count(*)::int n from auth.sessions where id=$1',[self.u.session_id]))[0].n,0);
 });
 }finally{await db.end();}
});
