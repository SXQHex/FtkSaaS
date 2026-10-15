import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import {connect} from '../scripts/db.mjs';import {newUuidV7} from '../scripts/uuid.mjs';
const p=JSON.parse(fs.readFileSync('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json'));const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);ajv.addSchema(p,'contract');
const id=newUuidV7(),when={starts_at:'2026-10-16T15:00:00Z',ends_at:'2026-10-16T17:00:00Z'};
const terms={fee_minor:'1000',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[],cancellation:{before_cutoff:'release',after_cutoff:'consume',no_show:'consume'},refund:{method:'none'}};
const venue={kind:'external',name:'Synthetic venue',address:'Test location',timezone:'Europe/Istanbul'};
test('Q-D01 DTO: explicit empty/single/multiple distinct UUID labels',()=>{
 const validate=ajv.getSchema('contract#/$defs/Request_event_save');
 const req={client_api_version:1,request_id:id,operation_key:id,org_id:id,center_id:id,name:'Event',interval:when,timezone:'Europe/Istanbul',venue,capacity:{nominal:10,maximum:10},terms,assignments:[],discipline_ids:[]};
 assert(validate(req),JSON.stringify(validate.errors));assert(validate({...req,discipline_ids:[id]}));assert(validate({...req,discipline_ids:[id,newUuidV7()]}));assert(!validate({...req,discipline_ids:[id,id]}));assert(!validate({...req,discipline_ids:['salsa']}));const missing={...req};delete missing.discipline_ids;assert(!validate(missing));
});
test('Q-D01 DTO: no negative-credit override can be submitted by event registration',()=>{
 const validate=ajv.getSchema('contract#/$defs/Request_event_register');const req={client_api_version:1,request_id:id,operation_key:id,org_id:id,center_id:id,event_id:id,person_id:id,sale_id:id};
 assert(validate(req));for(const field of ['allow_negative','negative_limit','discipline_id','discipline_ids'])assert(!validate({...req,[field]:field==='discipline_ids'?[id]:true}));
});
test('Q-D01 real PostgreSQL label integrity and scope matrix',async t=>{
 const db=await connect();const ids={};const id=k=>ids[k]??=newUuidV7();
 async function row(table,props){const ks=Object.keys(props);await db.query('insert into core."'+table+'"('+ks.map(k=>'"'+k+'"').join(',')+') values('+ks.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(props));}
 async function reject(name,fn,code,message){await db.query('savepoint bad');try{await fn();await db.query('set constraints all immediate');assert.fail('must reject '+name);}catch(e){assert.equal(e.code,code,e.message);if(message)assert.equal(e.message,message);}finally{await db.query('rollback to bad');await db.query('release bad');}}
 const scope=async(event,product,org='A')=>(await db.query('select private.event_package_scope_matches($1,$2,$3) matched',[id(org),id(event),id(product)])).rows[0].matched;
 try{
 await db.query('begin');
 for(const org of ['A','B']){
  await row('organizations',{id:id(org),org_id:id(org),name:org,owner_person_id:id(org+'owner'),state:'active'});
  await row('people',{id:id(org+'owner'),org_id:id(org),display_name:'synthetic',state:'active'});
  await row('centers',{id:id(org+'center'),org_id:id(org),center_id:id(org+'center'),name:'synthetic',timezone:'Europe/Istanbul',state:'active'});
  for(const tag of ['salsa','tango'])await row('disciplines',{id:id(org+tag),org_id:id(org),name:tag,state:'active'});
 }
 await row('centers',{id:id('Aothercenter'),org_id:id('A'),center_id:id('Aothercenter'),name:'other',timezone:'Europe/Istanbul',state:'active'});
 for(const event of ['single','multi','none','othercenter']){
  await row('events',{id:id(event),org_id:id('A'),center_id:id(event==='othercenter'?'Aothercenter':'Acenter'),name:event,starts_at:when.starts_at,ends_at:when.ends_at,timezone:'Europe/Istanbul',venue,nominal:10,maximum:10,state:'draft',terms,published:false,attendance_state:'open',attendance_revision:0});
 }
 for(const [event,tags] of [['single',['salsa']],['multi',['salsa','tango']],['none',[]],['othercenter',['salsa']]])for(const tag of tags)await row('event_disciplines',{id:newUuidV7(),org_id:id('A'),center_id:id(event==='othercenter'?'Aothercenter':'Acenter'),event_id:id(event),discipline_id:id('A'+tag)});
 const products=[
 ['narrow','center_discipline',id('Acenter'),id('Asalsa'),['event'],null],
 ['orgnarrow','organization_discipline',null,id('Asalsa'),['event'],null],
 ['lessononly','center_discipline',id('Acenter'),id('Asalsa'),['lesson'],null],
 ['wrongtag','organization_discipline',null,id('Atango'),['event'],null],
 ['centerbroad','center_all_disciplines',id('Acenter'),null,['event'],null],
 ['orgbroad','organization_all',null,null,['event'],null],
 ['specific','organization_all',null,null,['event'],id('single')]
 ];
 for(const [name,scope_kind,center_id,discipline_id,usage_targets,event_id] of products){
  await row('products',{id:id(name+'product'),org_id:id('A'),center_id:id('Acenter'),name,state:'active'});
  await row('product_versions',{id:id(name),org_id:id('A'),center_id:id('Acenter'),product_id:id(name+'product'),kind:'credits',booking_mode:'flexible',credits:1,price_minor:'1000',currency:'TRY',refund_method:'none',freeze_terms:{enabled:false,extends_validity:false},effective_at:'2026-01-01T00:00:00Z'});
  await row('product_scopes',{id:newUuidV7(),org_id:id('A'),product_version_id:id(name),scope_kind,center_id,discipline_id,usage_targets,class_id:null,event_id});
 }
 await db.query('set constraints all immediate');
 await t.test('Q-D01-A01 single label + matching narrow event-eligible package passes scope filter',async()=>{assert(await scope('single','narrow'));assert(await scope('single','orgnarrow'));});
 await t.test('Q-D01-A02 lesson-only package rejected despite matching label',async()=>assert(!(await scope('single','lessononly'))));
 await t.test('single label + mismatched discipline rejected',async()=>assert(!(await scope('single','wrongtag'))));
 await t.test('Q-D01-A03 multi label + both narrow scope kinds rejected',async()=>{assert(!(await scope('multi','narrow')));assert(!(await scope('multi','orgnarrow')));});
 await t.test('Q-D01-A04 multi label + broad event-eligible scope passes filter',async()=>{assert(await scope('multi','centerbroad'));assert(await scope('multi','orgbroad'));});
 await t.test('Q-D01-A05 no labels + broad only',async()=>{assert(await scope('none','orgbroad'));assert(await scope('none','centerbroad'));assert(!(await scope('none','narrow')));assert(!(await scope('none','orgnarrow')));});
 await t.test('center-bound package cannot match another service center',async()=>{assert(!(await scope('othercenter','centerbroad')));assert(await scope('othercenter','orgbroad'));});
 await t.test('explicit event selector remains an AND restriction',async()=>{assert(await scope('single','specific'));assert(!(await scope('multi','specific')));});
 await t.test('Q-D01-A08 foreign-organization discipline rejected by physical FK',async()=>reject('foreign tag',()=>row('event_disciplines',{id:newUuidV7(),org_id:id('A'),center_id:id('Acenter'),event_id:id('none'),discipline_id:id('Bsalsa')}),'23503'));
 await t.test('tag duplication and incorrect event center rejected',async()=>{
  await reject('duplicate tag',()=>row('event_disciplines',{id:newUuidV7(),org_id:id('A'),center_id:id('Acenter'),event_id:id('single'),discipline_id:id('Asalsa')}),'23505');
  await reject('event center',()=>row('event_disciplines',{id:newUuidV7(),org_id:id('A'),center_id:id('Aothercenter'),event_id:id('none'),discipline_id:id('Asalsa')}),'23503');
 });
 await t.test('cross-tenant scope filter returns no match',async()=>assert(!(await scope('single','orgbroad','B'))));
 await t.test('Q-D01-A06 kernel rejects zero/negative/unknown availability without a negative-limit bypass',async()=>{
  for(const n of [0,-1,null])await reject('no negative',()=>db.query('select private.require_event_available_credit($1)',[n]),'P0001','ENTITLEMENT_UNAVAILABLE');
  await db.query('select private.require_event_available_credit(1)');
  assert.equal((await db.query('select count(*)::int n from core.credit_deficits')).rows[0].n,0);
 });
 await t.test('private helper and label table are not client APIs',async()=>{
  for(const role of ['anon','authenticated']){assert.equal((await db.query("select has_function_privilege($1,'private.event_package_scope_matches(uuid,uuid,uuid)','EXECUTE') allowed",[role])).rows[0].allowed,false);assert.equal((await db.query("select has_table_privilege($1,'core.event_disciplines','SELECT') allowed",[role])).rows[0].allowed,false);}
 });
 }finally{await db.query('rollback');await db.end();}
});
