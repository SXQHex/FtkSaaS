import test,{resources} from './p07-diagnostics.mjs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';import {newUuidV7 as id} from '../scripts/uuid.mjs';
test('XREQ-020 normal sale projects debt, rights, deficits and binds approval to live sources',async t=>{
 const guard=resources(t),db=await guard.connect(context().env.DB_URL),{platform,plan}=await fixturePlatform(),owner=await authUser('sale-impact-owner'),student=await authUser('sale-impact-student'),stranger=await authUser('sale-impact-other');
 const source=(await db.query("select pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure) body")).rows[0].body;assert.equal(source.match(/terms:=private.sale_impact/g).length,2,'Only sale preview and apply may call sale_impact; event preview branches stay intact');
 const account=await must(owner,'account_get_v1'),member=await must(student,'account_get_v1');await must(stranger,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic sale impact',initial_plan_id:plan},id())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Sale impact',timezone:'Europe/Istanbul'},id())).primary_id;
 const scope=b=>({org_id:org,center_id:center,...b}),api=(op,b={},u=owner,k=id())=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=id())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 // Owner creates the center, then explicitly assumes its manager role before sale/person commands.
 await api('center_manager_assign_v1',{person_id:ownerPerson});
 const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic sale projection',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},platform);
 const person=(await api('person_create_v1',{display_name:'Synthetic buyer',contacts:[]})).primary_id;
 await api('student_activate_v1',{person_id:person});
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[id(),org,member.id,person]);

 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Sale impact',state:'active'},id())).primary_id;await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const date=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10),quote=(product,extra={})=>api('sale_preview_v1',{person_id:person,product_version_id:product,start_date:date(-2),end_date:date(30),...extra}),apply=(p,k=id())=>api('sale_apply_v1',{preview:{id:p.id,token:p.token}},owner,k);
 const product=async(kind='credits',quota=null,credits=5)=> (await api('product_publish_v1',{terms:{name:'Synthetic '+kind,kind,booking_mode:'flexible',...(kind==='credits'?{credits}:{}),price_minor:'1700',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},quota,scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
 const counts=async()=> (await db.query("select (select count(*) from core.sales where org_id=$1) sales,(select count(*) from core.debts where org_id=$1) debts,(select count(*) from core.entitlement_movements where org_id=$1) movements,(select count(*) from core.operation_receipts where org_id=$1) receipts,(select count(*) from core.notifications where org_id=$1) notices,(select count(*) from core.outbox_jobs where org_id=$1) jobs",[org])).rows[0];
 let credits,timed;const timedProducts=[];
 await t.test('credits, quota timed and unlimited timed: normal/past/future quotes leave no business writes and match applied debt/rights',async()=>{
  const variants=[['credits',null],['timed',{period:'week',limit:2}],['timed',null]];
  for(const [kind,quota] of variants){const pv=await product(kind,quota);if(kind==='credits')credits=pv;else{timed=pv;timedProducts.push(pv);}
   for(const offset of [-20,0,20]){const before=await counts(),p=await quote(pv,{start_date:date(offset),end_date:date(offset+10)});assert.deepEqual(await counts(),before);assert.deepEqual(p.blockers,[]);assert.equal(p.sale.debt_minor,'1700');assert.equal(p.sale.granted,kind==='credits'?5:0);assert.equal(p.sale.available,p.sale.granted);assert.deepEqual(p.sale.quota,quota);assert.equal(p.sale.timezone,'Europe/Istanbul');
    const k=id(),done=await apply(p,k);assert.equal((await apply(p,k)).replayed,true);
    const actual=(await db.query('select s.*,d.amount_minor,private.credit_available(s.org_id,s.id) available from core.sales s join core.debts d on d.org_id=s.org_id and d.sale_id=s.id where s.id=$1',[done.primary_id])).rows[0];assert.equal(actual.amount_minor,p.sale.debt_minor);assert.equal(actual.valid_from.toISOString(),new Date(p.sale.valid_from).toISOString());assert.equal(actual.valid_until.toISOString(),new Date(p.sale.valid_until).toISOString());assert.equal(Number(actual.available),p.sale.available);
   }
  }
 });
 await t.test('consumed deficits settle first; future reservation deficits follow; first unaffordable item stops the chain',async()=>{
  const deficits=[];const cancellation=(await api('policy_publish_v1',{center_id:null,key:'student_cancel_group',value:{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}},effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false})).primary_id;
  for(const [days,state,quantity] of [[-3,'consumed',2],[3,'reserved',2],[4,'reserved',2],[5,'reserved',1]]){const session=id(),reservation=id(),deficit=id(),start=new Date(Date.now()+days*86400000);
   await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,10,10,'planned','open')",[session,org,center,discipline,start,new Date(+start+3600000)]);
   await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,state,mode,policy_version_id) values($1,$2,$3,$4,$5,'active','flexible',$6)",[reservation,org,center,session,person,cancellation]);
   await db.query("insert into core.credit_deficits(id,org_id,person_id,reservation_id,quantity,state,center_id,discipline_id,session_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",[deficit,org,person,reservation,quantity,state,center,discipline,session]);deficits.push({deficit,reservation,session});
  }
  for(const pv of timedProducts){const timedQuote=await quote(pv);assert.equal(timedQuote.sale.granted,0);assert.equal(timedQuote.sale.reserved,0);assert.equal(timedQuote.sale.consumed,0);assert.equal(timedQuote.sale.available,0);assert(timedQuote.sale.deficits.every(x=>!x.settles));}
  const p=await quote(credits);assert.deepEqual(p.sale.deficits.map(x=>x.settles),[true,true,false,false]);assert.equal(p.sale.consumed,2);assert.equal(p.sale.reserved,2);assert.equal(p.sale.available,1);assert.equal(p.effects.length,2);
  const done=await apply(p);assert.equal(Number((await db.query('select private.credit_available($1,$2) n',[org,done.primary_id])).rows[0].n),1);
  for(const [i,d] of deficits.entries()){const actual=(await db.query('select state,settled_sale_id from core.credit_deficits where id=$1',[d.deficit])).rows[0];assert.equal(actual.state,i<2?'settled':'reserved');if(i<2)assert.equal(actual.settled_sale_id,done.primary_id);}
  const scopeQuote=await quote(credits);await db.query("update core.product_scopes set usage_targets=array['event'] where org_id=$1 and product_version_id=$2",[org,credits]);try{await fail('sale_apply_v1',{preview:{id:scopeQuote.id,token:scopeQuote.token}},'PREVIEW_STALE');assert.deepEqual((await quote(credits)).sale.deficits,[]);}finally{await db.query("update core.product_scopes set usage_targets=array['lesson'] where org_id=$1 and product_version_id=$2",[org,credits]);}
  const stale=await quote(credits);await db.query('update core.reservations set version=version+1 where id=$1',[deficits[2].reservation]);await fail('sale_apply_v1',{preview:{id:stale.id,token:stale.token}},'PREVIEW_STALE');
 });
 await t.test('source, policy, plan, permission and tenant changes cannot silently apply an old approval',async()=>{
  for(const [table,where,args] of [['people','id=$1',[person]],['product_versions','id=$1',[credits]],['centers','id=$1',[center]]]){const p=await quote(credits);await db.query('update core.'+table+' set version=version+1 where '+where,args);await fail('sale_apply_v1',{preview:{id:p.id,token:p.token}},'PREVIEW_STALE');}
  let p=await quote(credits);await api('policy_publish_v1',{center_id:null,key:'negative_default',value:{kind:'integer',value:0},effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});await fail('sale_apply_v1',{preview:{id:p.id,token:p.token}},'PREVIEW_STALE');
  p=await quote(credits);await db.query('update core.saas_plan_versions set version=version+1 where id=$1',[plan]);await fail('sale_apply_v1',{preview:{id:p.id,token:p.token}},'PREVIEW_STALE');
  p=await quote(timed);await db.query("update core.saas_plan_versions set features=array_remove(features,'F16') where id=$1",[plan]);try{await fail('sale_apply_v1',{preview:{id:p.id,token:p.token}},'PLAN_FEATURE_UNAVAILABLE');}finally{await db.query("update core.saas_plan_versions set features=array_append(features,'F16') where id=$1",[plan]);}
  p=await quote(credits);await fail('sale_apply_v1',{preview:{id:p.id,token:p.token}},'FORBIDDEN',student);const foreign=await call(stranger,'sale_apply_v1',scope({preview:{id:p.id,token:p.token}}),id());assert.equal(foreign.result.ok,false);
  const role=(await db.query("update core.role_assignments set state='inactive',version=version+1 where org_id=$1 and person_id=$2 and role='center_manager' and state='active' returning id",[org,ownerPerson])).rows;
  try{await fail('sale_apply_v1',{preview:{id:p.id,token:p.token}},'FORBIDDEN');}finally{await db.query("update core.role_assignments set state='active',version=version+1 where id=any($1::uuid[])",[role.map(x=>x.id)]);}
 });
 await t.test('sale document context is read and accepted by the buyer before a fresh preview; renewed document requirement blocks stale apply',async()=>{
  const p=await quote(credits),file=id(),document=id(),version=id(),requirement=id(),hash=createHash('sha256').update('synthetic legal terms').digest('hex');
  await db.query("insert into core.files(id,org_id,center_id,object_key,state,mime,size_bytes,checksum,purpose) values($1,$2,$3,'synthetic-sale-impact','ready','text/plain',21,$4,'document')",[file,org,center,hash]);
  await db.query("insert into core.documents(id,org_id,scope_center_id,name,state) values($1,$2,$3,'Synthetic sale terms','active')",[document,org,center]);
  await db.query("insert into core.document_versions(id,org_id,document_id,file_id,version_label,content_hash,effective_at) values($1,$2,$3,$4,'v1',$5,now())",[version,org,document,file,hash]);
  await db.query("insert into core.document_requirements(id,org_id,document_version_id,operation,scope,renewed_acceptance) values($1,$2,$3,'sale',$4,true)",[requirement,org,version,{product_version_ids:[credits]}]);
  await fail('sale_apply_v1',{preview:{id:p.id,token:p.token}},'PREVIEW_STALE');const blocked=await quote(credits),recovery=id();assert.equal(blocked.blockers[0].code,'DOCUMENT_REQUIRED');await fail('sale_apply_v1',{preview:{id:blocked.id,token:blocked.token}},'DOCUMENT_REQUIRED',owner,recovery);
  const ctx={gate:'sale',subject:{type:'product_versions',id:credits}},requirements=await api('document_requirements_get_v1',{context:ctx},student);assert.equal(requirements[0].accepted,false);
  await fail('document_accept_v1',{document_version_id:version,context:{...ctx,on_behalf_of_person_id:person}},'FORBIDDEN');await api('document_accept_v1',{document_version_id:version,context:ctx},student);
  await fail('sale_apply_v1',{preview:{id:blocked.id,token:blocked.token}},'PREVIEW_STALE');const current=await quote(credits);assert.deepEqual(current.blockers,[]);
  const renewed=id();await db.query("insert into core.document_versions(id,org_id,document_id,file_id,version_label,content_hash,effective_at) values($1,$2,$3,$4,'v2',$5,now())",[renewed,org,document,file,hash]);await db.query("insert into core.document_requirements(id,org_id,document_version_id,operation,scope,renewed_acceptance) values($1,$2,$3,'sale',$4,true)",[id(),org,renewed,{product_version_ids:[credits]}]);await fail('sale_apply_v1',{preview:{id:current.id,token:current.token}},'PREVIEW_STALE');
  await api('document_accept_v1',{document_version_id:renewed,context:ctx},student);const fresh=await quote(credits);await apply(fresh,recovery);assert.equal((await apply(fresh,recovery)).replayed,true);
 });
});
