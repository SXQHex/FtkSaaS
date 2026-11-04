import test from 'node:test';
import assert from 'node:assert/strict';
import {call,must} from '../api-client.mjs';
import {newUuidV7 as key} from '../../scripts/uuid.mjs';
import {roomFixture} from './room-fixture.mjs';

const stableRooms=items=>items.map(item=>({
 operation:item.operation,entity:item.entity,exists:item.exists,state:item.state,current:item.current,versions:item.versions
}));

test('room lifecycle: create, replay, discover, update and reject stale version',{timeout:600000},async t=>{
 const f=await roomFixture(t),operationKey=key(),input={name:'Pilot room',capacity:10};
 const created=await f.save(input,operationKey);
 const replay=await f.save(input,operationKey);
 assert.equal(replay.primary_id,created.primary_id);
 assert.equal(replay.replayed,true);
 assert.equal(created.version,1);
 const list=await f.read();
 assert.deepEqual(list.items.map(item=>item.entity.id),[created.primary_id]);
 const detail=await f.read(created.primary_id),current=detail.items[0];
 assert(Number.isFinite(Date.parse(current.as_of)));
 assert.equal(current.current.values.capacity,10);
 assert.equal(current.versions[0].version,1);
 const change={...current.current.values,name:'Updated pilot room',capacity:7,expected_version:current.versions[0].version};
 const updated=await f.save(change);
 assert.equal(updated.version,2);
 const after=await f.read(created.primary_id);
 assert.equal(after.items[0].current.values.name,'Updated pilot room');
 assert.equal(after.items[0].current.values.capacity,7);
 assert.equal(after.items[0].versions[0].version,2);
 const stale=await call(f.owner,'room_save_v1',f.scope(change),key());
 assert.equal(stale.result.ok,false);
 assert.equal(stale.result.error.code,'VERSION_CONFLICT');
 assert.deepEqual(stableRooms((await f.read(created.primary_id)).items),stableRooms(after.items));
 assert.equal((await f.db.query('select count(*)::int n from core.rooms where org_id=$1',[f.org])).rows[0].n,1);
});

test('invalid physical capacity creates no room',{timeout:600000},async t=>{
 const f=await roomFixture(t);
 for(const capacity of [-1,null]){
  const rejected=await call(f.owner,'room_save_v1',f.scope({name:'Invalid room',capacity}),key());
  assert.equal(rejected.result.ok,false);
  assert.equal(rejected.result.error.code,'VALIDATION_FAILED');
 }
 assert.deepEqual((await f.read()).items,[]);
 assert.equal((await f.db.query('select count(*)::int n from core.rooms where org_id=$1',[f.org])).rows[0].n,0);
});

test('organization ownership does not grant an unassigned center',{timeout:600000},async t=>{
 const f=await roomFixture(t);
 const other=(await must(f.owner,'center_create_v1',{org_id:f.org,name:'Unassigned',timezone:'Europe/Istanbul'},key())).primary_id;
 const denied=await call(f.owner,'room_save_v1',f.scope({center_id:other,name:'Denied room',capacity:10}),key());
 assert.equal(denied.result.ok,false);
 assert.equal(denied.result.error.code,'FORBIDDEN');
 assert.equal((await f.db.query('select count(*)::int n from core.rooms where org_id=$1',[f.org])).rows[0].n,0);
});

test('another real tenant cannot read or mutate a room',{timeout:600000},async t=>{
 const victim=await roomFixture(t),attacker=await roomFixture(t);
 const room=await victim.save({name:'Private room',capacity:8});
 const before=await victim.read(room.primary_id);
 const read=await call(attacker.owner,'management_state_get_v1',victim.scope({
  operation:'room_save_v1',selector:{operation:'room_save_v1',key:{room_id:room.primary_id}},page:{}
 }));
 assert.equal(read.result.ok,false);
 assert.equal(read.result.error.code,'NOT_FOUND');
 const write=await call(attacker.owner,'room_save_v1',victim.scope({
  room_id:room.primary_id,expected_version:1,name:'Tenant escape',capacity:1
 }),key());
 assert.equal(write.result.ok,false);
 assert.equal(write.result.error.code,'NOT_FOUND');
 assert.deepEqual(stableRooms((await victim.read(room.primary_id)).items),stableRooms(before.items));
 assert.deepEqual((await attacker.read()).items,[]);
});
