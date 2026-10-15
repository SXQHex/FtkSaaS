import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {connect} from '../scripts/db.mjs';import {newUuidV7} from '../scripts/uuid.mjs';
const p=JSON.parse(fs.readFileSync('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json'));
test('real PostgreSQL physical baseline and D/U integrity',async t=>{
 const db=await connect();const ids={};const id=k=>ids[k]??=newUuidV7();const results=[];
 async function row(table,props){const keys=Object.keys(props);await db.query('insert into core."'+table+'" ('+keys.map(x=>'"'+x+'"').join(',')+') values ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(props));}
 async function reject(name,fn,code){await db.query('savepoint negative_case');try{await fn();await db.query('set constraints all immediate');assert.fail('must reject '+name);}catch(e){assert.equal(e.code,code,name+': '+e.message);}finally{await db.query('rollback to negative_case');await db.query('release negative_case');}}
 try{
 await t.test('catalog and DB column coverage / UUID storage / RLS / deny client DML',async()=>{
  const cols=(await db.query("select table_name,column_name,data_type from information_schema.columns where table_schema='core'")).rows;
  for(const table of p['x-contract'].tables)for(const col of Object.keys(p.$defs['Table_'+table.name].properties))assert(cols.some(c=>c.table_name===table.name&&c.column_name===col),table.name+'.'+col);
  const tables=(await db.query("select tablename,rowsecurity from pg_tables where schemaname='core'")).rows;assert.equal(tables.length,p['x-contract'].tables.length);assert(tables.every(x=>x.rowsecurity));
  const grants=(await db.query("select table_name from information_schema.role_table_grants where table_schema='core' and grantee in ('anon','authenticated','PUBLIC')")).rows;assert.equal(grants.length,0);
  for(const role of ['anon','authenticated']){await db.query('begin');await db.query('set local role '+role);await assert.rejects(db.query('select * from core.people'),e=>e.code==='42501');await db.query('rollback');}
 });
 await db.query('begin');
 for(const org of ['A','B']){
  await row('organizations',{id:id(org),org_id:id(org),name:org,owner_person_id:id(org+'owner'),state:'active'});
  await row('people',{id:id(org+'owner'),org_id:id(org),display_name:org+' owner',state:'active'});
  await row('centers',{id:id(org+'center'),center_id:id(org+'center'),org_id:id(org),name:'center',timezone:'Europe/Istanbul',state:'active'});
  await row('disciplines',{id:id(org+'salsa'),org_id:id(org),name:'Salsa',state:'active'});
  await row('center_disciplines',{id:newUuidV7(),org_id:id(org),center_id:id(org+'center'),discipline_id:id(org+'salsa'),state:'active'});
 }
 await row('disciplines',{id:id('Ayoga'),org_id:id('A'),name:'Yoga',state:'active'});
 await row('center_disciplines',{id:newUuidV7(),org_id:id('A'),center_id:id('Acenter'),discipline_id:id('Ayoga'),state:'active'});
 await db.query('set constraints all immediate');
 await t.test('D01/D02 one person, multiple disciplines without person/role duplication',async()=>{
  for(const discipline of ['Asalsa','Ayoga'])await row('person_disciplines',{id:newUuidV7(),org_id:id('A'),center_id:id('Acenter'),person_id:id('Aowner'),discipline_id:id(discipline),kind:'student',state:'active'});
  assert.equal((await db.query('select count(*)::int n from core.people where org_id=$1',[id('A')])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from core.person_disciplines where org_id=$1',[id('A')])).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int n from core.role_assignments')).rows[0].n,0);
 });
 await t.test('D01 cross-tenant center discipline FK rejects',async()=>reject('tenant',()=>row('center_disciplines',{id:newUuidV7(),org_id:id('A'),center_id:id('Acenter'),discipline_id:id('Bsalsa'),state:'active'}),'23503'));
 await t.test('D02 duplicate active relationship rejects',async()=>reject('duplicate relation',()=>row('person_disciplines',{id:newUuidV7(),org_id:id('A'),center_id:id('Acenter'),person_id:id('Aowner'),discipline_id:id('Asalsa'),kind:'student',state:'active'}),'23505'));
 await t.test('D07 independent per-center-discipline override unique key',async()=>{
  for(const discipline of ['Asalsa','Ayoga'])await row('negative_limit_overrides',{id:newUuidV7(),org_id:id('A'),center_id:id('Acenter'),discipline_id:id(discipline),person_id:id('Aowner'),limit_count:2,reason:'synthetic test'});
  await reject('duplicate override',()=>row('negative_limit_overrides',{id:newUuidV7(),org_id:id('A'),center_id:id('Acenter'),discipline_id:id('Asalsa'),person_id:id('Aowner'),limit_count:3,reason:'test'}),'23505');
 });

 await t.test('D03 session cannot disagree with its class discipline',async()=>{
  await row('classes',{id:id('class'),org_id:id('A'),center_id:id('Acenter'),discipline_id:id('Asalsa'),name:'Salsa',external_open:true,state:'active'});
  await reject('session-class discipline',()=>row('sessions',{id:newUuidV7(),org_id:id('A'),center_id:id('Acenter'),discipline_id:id('Ayoga'),class_id:id('class'),format:'group',starts_at:'2026-10-17T15:00:00Z',ends_at:'2026-10-17T16:00:00Z',nominal:10,maximum:12,state:'planned',attendance_state:'open'}),'23503');
 });
 await t.test('D03/D07 deficit scope is bound to exact reservation/person/session',async()=>{
  await row('policy_versions',{id:id('policy'),org_id:id('A'),key:'negative_default',effective_at:'2026-01-01T00:00:00Z',mandatory:false,value:{kind:'integer',value:2}});
  for(const discipline of ['Asalsa','Ayoga'])await row('sessions',{id:id(discipline+'session'),org_id:id('A'),center_id:id('Acenter'),discipline_id:id(discipline),format:'group',starts_at:'2026-10-16T15:00:00Z',ends_at:'2026-10-16T16:00:00Z',nominal:10,maximum:12,state:'planned',attendance_state:'open'});
  await row('reservations',{id:id('reservation'),org_id:id('A'),center_id:id('Acenter'),session_id:id('Asalsasession'),person_id:id('Aowner'),mode:'flexible',state:'active',policy_version_id:id('policy')});
  const deficit={id:newUuidV7(),org_id:id('A'),center_id:id('Acenter'),discipline_id:id('Ayoga'),session_id:id('Asalsasession'),person_id:id('Aowner'),reservation_id:id('reservation'),quantity:1,state:'reserved'};
  await reject('wrong discipline',()=>row('credit_deficits',deficit),'23503');
  await row('credit_deficits',{...deficit,id:newUuidV7(),discipline_id:id('Asalsa')});
  await reject('same reservation counted twice',()=>row('credit_deficits',{...deficit,id:newUuidV7(),discipline_id:id('Asalsa')}),'23505');
 });
 await t.test('D04/D05 physical package scope variants and explicit target eligibility',async()=>{
  await row('products',{id:id('product'),org_id:id('A'),center_id:id('Acenter'),name:'10 shared credits',state:'active'});
  await row('product_versions',{id:id('productversion'),org_id:id('A'),center_id:id('Acenter'),product_id:id('product'),kind:'credits',booking_mode:'flexible',credits:10,price_minor:'1000',currency:'TRY',refund_method:'none',freeze_terms:{enabled:false,extends_validity:false},effective_at:'2026-01-01T00:00:00Z'});
  const base={org_id:id('A'),product_version_id:id('productversion'),class_id:null,event_id:null,usage_targets:['lesson']};
  for(const [scope_kind,center_id,discipline_id] of [['center_discipline',id('Acenter'),id('Asalsa')],['center_all_disciplines',id('Acenter'),null],['organization_discipline',null,id('Asalsa')],['organization_all',null,null]])await row('product_scopes',{...base,id:newUuidV7(),scope_kind,center_id,discipline_id});
  await reject('scope discriminator',()=>row('product_scopes',{...base,id:newUuidV7(),scope_kind:'organization_all',center_id:id('Acenter'),discipline_id:null}),'23514');
  await reject('empty eligibility',()=>row('product_scopes',{...base,id:newUuidV7(),scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:[]}),'23514');
  assert.equal((await db.query('select count(*)::int n from core.product_versions where id=$1',[id('productversion')])).rows[0].n,1);
 });
 await t.test('U03 external UUIDv4 remains unchanged',async()=>{
  const provider='550e8400-e29b-41d4-a716-446655440000';await row('accounts',{id:id('account'),auth_user_id:provider,state:'active'});
  assert.equal((await db.query('select auth_user_id::text from core.accounts where id=$1',[id('account')])).rows[0].auth_user_id,provider);
 });
 await t.test('U05 database default generation fails closed with no audited DB generator',async()=>reject('no v4 fallback',()=>db.query("insert into core.accounts(state) values('active')"),'0A000'));
 await db.query('rollback');
 }finally{await db.query('rollback');await db.end();}
});
