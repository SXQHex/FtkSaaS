import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPilotSource,assertLocalServices} from '../../scripts/ci/v2/safety.mjs';

const sha='a'.repeat(40);
const source=()=>({actions:'true',event:'workflow_dispatch',expected:sha,actual:sha,dirty:false,existingState:false});

test('pilot refuses automatic events, mutable refs, dirty source and an existing stack',()=>{
 assert.doesNotThrow(()=>assertPilotSource(source()));
 for(const change of [{actions:'false'},{event:'pull_request'},{expected:'main'},{actual:'b'.repeat(40)},{dirty:true},{existingState:true}]){
  assert.throws(()=>assertPilotSource({...source(),...change}));
 }
});

test('pilot requires both database and API services on explicit loopback hosts',()=>{
 const local={DB_URL:'postgresql://fixture@127.0.0.1:54322/postgres',API_URL:'http://127.0.0.1:54321'};
 assert.doesNotThrow(()=>assertLocalServices(local));
 assert.doesNotThrow(()=>assertLocalServices({...local,API_URL:'http://localhost:54321'}));
 for(const env of [undefined,{}, {...local,DB_URL:'postgresql://fixture@db.example.com/postgres'},
  {...local,API_URL:'https://project.supabase.co'}, {...local,API_URL:'http://localhost.example.com'},
  {...local,API_URL:'http://127.0.0.1@evil.example.com'}, {...local,API_URL:'file:///tmp/service'}]){
  assert.throws(()=>assertLocalServices(env));
 }
});
