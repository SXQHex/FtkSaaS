import test from 'node:test';import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';
test('Starter daily availability joins explicit midnight splits and adjacent intervals without DST shifting',{timeout:180000},async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('availability-midnight-owner'),db=await connect();let org,center,person,room,discipline;
 const api=(op,b={},u=owner)=>must(u,op,{org_id:org,center_id:center,...b},key());
 const rule=(start,end)=>({weekdays:[1,2,3,4,5,6,7],local_start:start,local_end:end,valid_from:'2020-01-01'});
 const resources=()=>[{kind:'room',id:room},{kind:'person',id:person}];
 const session=(date,start,end)=>({discipline_id:discipline,format:'group',interval:{starts_at:date+'T'+start+'Z',ends_at:end},resources:[resources()[0]],assignments:[{person_id:person,duty:'instructor'}],capacity:{total:4}});
 const denied=async(op,b,code)=>{const r=await call(owner,op,{org_id:org,center_id:center,...b},key());assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code);};
 try{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);const account=await must(owner,'account_get_v1');org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic midnight availability',initial_plan_id:plan},key())).primary_id;
  center=(await api('center_create_v1',{name:'Midnight center',timezone:'UTC'})).primary_id;const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC midnight',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
  person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;await api('center_manager_assign_v1',{person_id:person});discipline=(await api('discipline_save_v1',{name:'Yoga',state:'active'})).primary_id;await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});room=(await api('room_save_v1',{name:'Midnight room',capacity:10})).primary_id;await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
  const morning=[];
  for(const resource of resources()){await api('availability_save_v1',{resource,rule:rule('22:00:00','24:00:00')});morning.push({resource,saved:await api('availability_save_v1',{resource,rule:rule('00:00:00','02:00:00')})});}
  await t.test('actual session command accepts a gapless split across midnight and the exact exclusive end',async()=>{
   const made=await api('session_create_v1',session('2031-01-01','23:00:00','2031-01-02T01:00:00Z'));const read=await api('session_get_v1',{session_id:made.primary_id});assert.equal(Date.parse(read.ends_at)-Date.parse(read.starts_at),7200000);
   await api('session_create_v1',session('2031-01-03','23:00:00','2031-01-04T00:00:00Z'));
   await denied('session_create_v1',session('2031-01-05','23:00:00','2031-01-06T02:00:01Z'),'RESOURCE_CONFLICT');
  });
  await t.test('one missing second is a real gap; invalid 24-hour starts and end minutes never persist',async()=>{
   const m=morning[0];await api('availability_save_v1',{resource:m.resource,rule_id:m.saved.primary_id,expected_version:m.saved.version,rule:rule('00:00:01','02:00:00')});
   await denied('session_create_v1',session('2031-01-07','23:00:00','2031-01-08T01:00:00Z'),'RESOURCE_CONFLICT');
   await api('availability_save_v1',{resource:m.resource,rule_id:m.saved.primary_id,expected_version:m.saved.version+1,rule:rule('00:00:00','02:00:00')});
   const before=(await db.query('select count(*)::int n from core.availability_rules where org_id=$1',[org])).rows[0].n;
   for(const invalid of [rule('24:00:00','24:00:00'),rule('22:00:00','24:00:01'),rule('22:00:00','24:01:00')])await denied('availability_save_v1',{resource:m.resource,rule:invalid},'VALIDATION_FAILED');
   assert.equal((await db.query('select count(*)::int n from core.availability_rules where org_id=$1',[org])).rows[0].n,before);
  });
  await t.test('adjacent daytime rules jointly cover a real session; explicit closure still wins',async()=>{
   for(const resource of resources())for(const [start,end] of [['08:00:00','10:00:00'],['10:00:00','12:00:00']])await api('availability_save_v1',{resource,rule:rule(start,end)});
   await api('session_create_v1',session('2031-01-09','09:00:00','2031-01-09T11:00:00Z'));
   await db.query("insert into core.availability_exceptions(id,org_id,center_id,resource_kind,resource_id,starts_at,ends_at,reason) values($1,$2,$3,'room',$4,'2031-01-10T10:00:00Z','2031-01-10T10:15:00Z','Synthetic explicit closure')",[key(),org,center,room]);
   await denied('session_create_v1',session('2031-01-10','09:00:00','2031-01-10T11:00:00Z'),'RESOURCE_CONFLICT');
  });
  await t.test('native DST windows cover real fold/gap instants; ambiguous or absent boundaries never pick offsets',async()=>{
   const q=await db.query("select private.availability_day_window('2030-10-27','00:00:00','04:00:00','Europe/Berlin') @> tstzrange('2030-10-27T00:30:00Z','2030-10-27T02:30:00Z','[)') fold,private.availability_day_window('2030-03-31','00:00:00','04:00:00','Europe/Berlin') @> tstzrange('2030-03-31T00:30:00Z','2030-03-31T01:30:00Z','[)') gap,private.availability_day_window('2030-10-27','02:15:00','02:45:00','Europe/Berlin') is null ambiguous,private.availability_day_window('2030-03-31','02:15:00','02:45:00','Europe/Berlin') is null absent");assert.deepEqual(q.rows[0],{fold:true,gap:true,ambiguous:true,absent:true});
   const basis=(await db.query("select private.p06_available_seconds($1,$2,'room',$3,'2031-01-10T09:00:00Z','2031-01-10T11:00:00Z')::int n",[org,center,room])).rows[0].n;assert.equal(basis,6300);
   await api('availability_save_v1',{resource:resources()[0],rule:rule('00:00:00','04:00:00')});await db.query("update core.centers set timezone='Europe/Berlin' where id=$1",[center]);
   try{for(const [start,end,seconds] of [['2030-10-27T00:30:00Z','2030-10-27T02:30:00Z',7200],['2030-03-31T00:30:00Z','2030-03-31T01:30:00Z',3600]]){await db.query("select private.assert_availability($1,$2,'room',$3,$4,$5)",[org,center,room,start,end]);assert.equal((await db.query("select private.p06_available_seconds($1,$2,'room',$3,$4,$5)::int n",[org,center,room,start,end])).rows[0].n,seconds);}}finally{await db.query("update core.centers set timezone='UTC' where id=$1",[center]);}
   // PostgreSQL's process timezone must not change the generated daily calendar.
   const bounds=async()=>(await db.query("select extract(epoch from lower(w))::text lo,extract(epoch from upper(w))::text hi from (select private.availability_day_window('2030-10-27','00:00:00','04:00:00','Europe/Berlin') w) x")).rows[0];
   await db.query("set timezone='Pacific/Honolulu'");const a=await bounds();await db.query("set timezone='UTC'");assert.deepEqual(await bounds(),a);
  });
 }finally{await db.end();}
});
