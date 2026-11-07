import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

const token=p=>({id:p.id,token:p.token});
const date=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const interval=(n,hour='10')=>({starts_at:date(n)+'T'+hour+':00:00Z',ends_at:date(n)+'T'+String(Number(hour)+1).padStart(2,'0')+':00:00Z'});
const operation='sale_change_preview_v1';

async function fixture(planName){
 const db=await connect();
 try{
  const {platform,plan}=await fixturePlatform(),owner=await authUser('inventory-'+planName),account=await must(owner,'account_get_v1');
  await db.query('update core.saas_plan_versions set name=$1 where id=$2',[planName,plan]);
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic change inventory '+planName,initial_plan_id:plan},key())).primary_id;
  const center=(await must(owner,'center_create_v1',{org_id:org,name:'Inventory source',timezone:'UTC'},key())).primary_id;
  const scope=b=>({org_id:org,center_id:center,...b}),api=(op,b={},u=owner,k=key())=>must(u,op,scope(b),k);
  const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await api('center_manager_assign_v1',{person_id:person});
  const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic inventory payment',occurred_at:new Date().toISOString()});
  await api('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},platform);
  const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Synthetic inventory discipline',state:'active'},key())).primary_id;
  await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  const policy=(name,value)=>api('policy_publish_v1',{center_id:null,key:name,value,effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
  for(const kind of ['group','private'])await policy('student_cancel_'+kind,{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
  await policy('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
  await policy('negative_default',{kind:'integer',value:0});await policy('negative_upper',{kind:'integer',value:0});
  const linked=async(label,role)=>{
   const user=await authUser('inventory-'+label),a=await must(user,'account_get_v1');
   const id=(await api('person_create_v1',{display_name:'Synthetic inventory '+label,contacts:[]})).primary_id;
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,id]);
   if(role==='student')await api('student_activate_v1',{person_id:id});
   else if(role)await api('role_assign_v1',{person_id:id,role,scope:{center_id:center}});
   return {id,user};
  };
  const student=await linked('student','student');
  const product=(await api('product_publish_v1',{terms:{name:'Synthetic change inventory credits',kind:'credits',booking_mode:'flexible',credits:12,price_minor:'0',currency:'TRY',freeze:{enabled:true,extends_validity:true,max_days:10},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson','event']}]}})).primary_id;
  const sell=async()=>{
   const p=await api('sale_preview_v1',{person_id:student.id,product_version_id:product,start_date:date(0),end_date:date(30)});
   assert.deepEqual(p.blockers,[]);return (await api('sale_apply_v1',{preview:token(p)})).primary_id;
  };
  const session=async(n,extra={})=>(await api('session_create_v1',{discipline_id:discipline,format:'group',interval:interval(n),resources:[],assignments:[],capacity:{total:10},...extra})).primary_id;
  const reserve=(session_id,sale_id,extra={})=>api('reservation_create_v1',{session_id,person_id:student.id,source_sale_id:sale_id,mode:'flexible',...extra});
  const denied=async(code,op,b={},user=owner)=>{const r=await call(user,op,scope(b),key());assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));assert.equal(r.result.data,undefined);};
  const read=(sale_id,page={},extra={},user=owner)=>api('management_state_get_v1',{operation,selector:{operation,key:{sale_id}},page,...extra},user);
  const effects=async()=>{
   const result={};for(const table of ['operation_receipts','audit_events','notifications','previews','entitlement_allocations','cash_movements'])result[table]=Number((await db.query('select count(*)::int n from core.'+table+' where org_id=$1',[org])).rows[0].n);return result;
  };
  return {db,org,center,plan,platform,account,owner,person,student,discipline,product,scope,api,linked,sell,session,reserve,denied,read,effects};
 }catch(error){await db.end();throw error;}
}

for(const planName of ['pro','business'])test('XREQ029 '+planName+' discovers exact source-sale obligations before explicit change',{timeout:300000},async t=>{
 const f=await fixture(planName),{db,org,center,plan,owner,person,student,product,api,sell,session,reserve,denied,read,effects}=f;t.after(()=>db.end());
 const sale=await sell(),otherSale=await sell();
 const empty=await read(sale);assert.deepEqual(empty.items,[]);assert.equal(empty.next_cursor,null);assert.equal(empty.sale_change_context.entity.id,sale);
 const oneSession=await session(1),twoSession=await session(2),otherSession=await session(3),pastSession=await session(4),cancelSession=await session(5);
 const one=await reserve(oneSession,sale),two=await reserve(twoSession,sale),other=await reserve(otherSession,otherSale),past=await reserve(pastSession,sale),cancelled=await reserve(cancelSession,sale);
 await api('reservation_cancel_v1',{reservation_id:cancelled.primary_id,expected_version:cancelled.version,reason:'Synthetic cancelled inventory exclusion'});
 // Only the isolated fixture clock is moved; booking itself used native APIs.
 await db.query("update core.sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',version=version+1 where org_id=$1 and id=$2",[org,pastSession]);
 const input={name:'Synthetic source-sale event',interval:interval(6,'16'),timezone:'UTC',venue:{kind:'external',name:'Synthetic venue',address:'Synthetic',timezone:'UTC'},capacity:{nominal:10,maximum:10},terms:{fee_minor:'0',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[product],cancellation:{before_cutoff:'release',after_cutoff:'release',no_show:'release'},refund:{method:'none'}},discipline_ids:[],assignments:[{person_id:person,duty:'instructor',fee_minor:'0',currency:'TRY'}]};
 const event=(await api('event_save_v1',input)).primary_id;await api('event_publish_v1',{event_id:event,published:true});
 const registration=await api('event_register_v1',{event_id:event,person_id:student.id,sale_id:sale});
 assert.equal((await db.query("select count(*)::int n from core.entitlement_allocations where org_id=$1 and event_registration_id=$2 and sale_id=$3 and state='reserved'",[org,registration.primary_id,sale])).rows[0].n,1);
 const before=await effects(),first=await read(sale,{limit:1});assert.equal(first.items.length,1);assert(first.next_cursor);assert.deepEqual(first.sale_change_context.entity,{type:'sales',id:sale});assert(Number.isInteger(first.sale_change_context.version));
 const collected=[...first.items];let cursor=first.next_cursor;
 while(cursor){const page=await read(sale,{limit:1,cursor});assert.deepEqual(page.sale_change_context,first.sale_change_context);for(const item of page.items)assert.equal(item.as_of,page.as_of);collected.push(...page.items);cursor=page.next_cursor;}
 assert.deepEqual(collected.map(x=>x.entity.id).sort(),[one.primary_id,two.primary_id,registration.primary_id].sort());
 for(const item of collected){
  const detail=item.sale_change_record;assert.equal(item.current.values.sale_id,first.sale_change_context.entity.id);assert.equal(detail.person_id,student.id);assert.equal(detail.center_id,center);assert.equal(item.state,'active');assert(Date.parse(detail.starts_at)>=Date.parse(item.as_of));assert.deepEqual(item.current.values,{sale_id:sale});
  assert(item.versions.some(v=>v.entity.type==='sales'&&v.entity.id===sale&&v.version===first.sale_change_context.version));assert(item.versions.some(v=>v.entity.id===item.entity.id));assert(item.versions.some(v=>v.entity.type===detail.parent.type&&v.entity.id===detail.parent.id));
 }
 assert.equal(collected.filter(x=>x.entity.type==='reservations').length,2);assert.equal(collected.find(x=>x.entity.id===registration.primary_id).sale_change_record.parent.id,event);
 assert(!collected.some(x=>[other.primary_id,past.primary_id,cancelled.primary_id].includes(x.entity.id)));assert.deepEqual(await effects(),before);
 assert.deepEqual((await read(otherSale)).items.map(x=>x.entity.id),[other.primary_id]);
 await denied('VALIDATION_FAILED','management_state_get_v1',{operation,selector:{operation,key:{sale_id:otherSale}},page:{limit:1,cursor:first.next_cursor}});
 await denied('VALIDATION_FAILED','management_state_get_v1',{operation,selector:{operation,key:{sale_id:sale,new_product_version_id:product}},page:{limit:1,cursor:first.next_cursor}});
 await denied('NOT_FOUND','management_state_get_v1',{operation,selector:{operation,key:{sale_id:key()}}});
 await denied('FORBIDDEN','management_state_get_v1',{operation,selector:{operation,key:{sale_id:sale}}},student.user);
 const staff=await f.linked('staff','staff');await denied('FORBIDDEN','management_state_get_v1',{operation,selector:{operation,key:{sale_id:sale}}},staff.user);
 await api('center_manager_assign_v1',{person_id:staff.id});
 await denied('VALIDATION_FAILED','management_state_get_v1',{operation,selector:{operation,key:{sale_id:sale}},page:{limit:1,cursor:first.next_cursor}},staff.user);
 // Same authenticated Owner is authorized in another tenant; the source sale
 // must still be rejected there instead of being resolved by UUID globally.
 const foreignOrg=(await must(f.platform,'organization_create_v1',{verified_account_id:f.account.id,name:'Synthetic foreign inventory scope',initial_plan_id:plan},key())).primary_id;
 const foreignCenter=(await must(owner,'center_create_v1',{org_id:foreignOrg,name:'Foreign inventory center',timezone:'UTC'},key())).primary_id;
 const foreignPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[foreignOrg])).rows[0].owner_person_id;
 await must(owner,'center_manager_assign_v1',{org_id:foreignOrg,center_id:foreignCenter,person_id:foreignPerson},key());
 const foreignPayment=await must(owner,'saas_payment_submit_v1',{org_id:foreignOrg,amount_minor:'1000',currency:'TRY',reference:'Synthetic foreign inventory activation',occurred_at:new Date().toISOString()},key());
 await must(f.platform,'saas_payment_verify_v1',{org_id:foreignOrg,payment_id:foreignPayment.primary_id,accepted:true},key());
 await denied('NOT_FOUND','management_state_get_v1',{org_id:foreignOrg,center_id:foreignCenter,operation,selector:{operation,key:{sale_id:sale}}});
 const fresh=await read(sale,{limit:1});
 await db.query('update core.sessions set version=version+1 where org_id=$1 and id=$2',[org,oneSession]);
 await denied('VERSION_CONFLICT','management_state_get_v1',{operation,selector:{operation,key:{sale_id:sale}},page:{limit:1,cursor:fresh.next_cursor}});
 const bySale=await read(sale,{limit:1});await db.query('update core.sales set version=version+1 where org_id=$1 and id=$2',[org,sale]);
 await denied('VERSION_CONFLICT','management_state_get_v1',{operation,selector:{operation,key:{sale_id:sale}},page:{limit:1,cursor:bySale.next_cursor}});
 const choice={sale_id:sale,new_product_version_id:product,keep_reservation_ids:[one.primary_id,two.primary_id],cancel_reservation_ids:[],start_date:date(0),end_date:date(30),reason:'Synthetic explicit discovered package change',offset_minor:'0'};
 await denied('VALIDATION_FAILED','sale_change_preview_v1',{...choice,keep_reservation_ids:[one.primary_id]});
 const blocked=await api('sale_change_preview_v1',choice);assert(blocked.blockers.some(b=>b.code==='OPEN_OPERATIONS_EXIST'));
 const eventRow=(await api('event_get_v1',{event_id:event})).registrations.find(x=>x.id===registration.primary_id);
 await api('event_registration_cancel_v1',{registration_id:eventRow.id,expected_version:eventRow.version,reason:'Synthetic explicit event cancellation before change'});
 const ready=await api('sale_change_preview_v1',choice);assert.deepEqual(ready.blockers,[]);
 const additionalSession=await session(6),additional=await reserve(additionalSession,sale);
 // The existing writer compares the complete ID partition before dependency hashes.
 await denied('VALIDATION_FAILED','sale_change_apply_v1',{preview:token(ready)});
 const latest=await read(sale);assert(latest.items.some(x=>x.entity.id===additional.primary_id));assert(!latest.items.some(x=>x.entity.id===registration.primary_id));
 const finalChoice={...choice,keep_reservation_ids:[one.primary_id,two.primary_id,additional.primary_id]},confirmed=await api('sale_change_preview_v1',finalChoice);assert.deepEqual(confirmed.blockers,[]);
 const changed=await api('sale_change_apply_v1',{preview:token(confirmed)});
 assert.equal((await db.query('select state from core.sales where org_id=$1 and id=$2',[org,sale])).rows[0].state,'terminated');
 assert.deepEqual((await db.query('select distinct source_sale_id from core.reservations where org_id=$1 and id=any($2::uuid[])',[org,finalChoice.keep_reservation_ids])).rows.map(x=>x.source_sale_id),[changed.primary_id]);
 const activeSale=changed.primary_id;
 const beforeStarter=await read(activeSale);
 await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
 const starter=await read(activeSale);assert.deepEqual(starter.sale_change_context,beforeStarter.sale_change_context);assert.deepEqual(starter.items.map(x=>x.entity.id),beforeStarter.items.map(x=>x.entity.id));
 await db.query('update core.saas_plan_versions set name=$1 where id=$2',[planName,plan]);
 if(planName==='business'){
  const secondCenter=(await api('center_create_v1',{name:'Synthetic remote inventory',timezone:'UTC'})).primary_id;
  await api('center_manager_assign_v1',{center_id:secondCenter,person_id:person});await api('center_discipline_set_v1',{center_id:secondCenter,discipline_id:f.discipline,state:'active'});await api('student_activate_v1',{center_id:secondCenter,person_id:student.id});
  const remote=await session(5,{center_id:secondCenter,interval:interval(5,'14')});await reserve(remote,activeSale,{center_id:secondCenter});
  assert((await read(activeSale)).items.some(x=>x.sale_change_record.center_id===secondCenter));
  await denied('NOT_FOUND','management_state_get_v1',{center_id:secondCenter,operation,selector:{operation,key:{sale_id:activeSale}}});
  const role=(await db.query("select version from core.role_assignments where org_id=$1 and scope_center_id=$2 and person_id=$3 and role='center_manager' and state='active'",[org,secondCenter,person])).rows[0];
  await api('center_manager_revoke_v1',{center_id:secondCenter,person_id:person,expected_version:Number(role.version),reason:'Synthetic remote CM revocation'});
  await denied('FORBIDDEN','management_state_get_v1',{operation,selector:{operation,key:{sale_id:activeSale}},page:{limit:1}});
 }
 const role=(await db.query("select version from core.role_assignments where org_id=$1 and scope_center_id=$2 and person_id=$3 and role='center_manager' and state='active'",[org,center,person])).rows[0];
 await api('center_manager_revoke_v1',{person_id:person,expected_version:Number(role.version),reason:'Synthetic source CM revocation'});
 await denied('FORBIDDEN','management_state_get_v1',{operation,selector:{operation,key:{sale_id:activeSale}}});
});
