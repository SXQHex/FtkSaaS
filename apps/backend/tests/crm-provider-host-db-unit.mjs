import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeReceiverClient,DB_LIMITS} from '../transports/crm-provider-host-db.mjs';
const good={same_role:true,ingress:true,rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false};
test('native host connection enforces TLS and server timeouts before executing ingress SQL',async()=>{
 let options,queries=0,ended=0;
 class Client{constructor(o){options=o;}on(){}async connect(){}async end(){ended++;}async query(){queries++;return queries===1?{rows:[good]}:{rows:[{result:true}]};}}
 const native=createNativeReceiverClient('postgres://synthetic:synthetic@db.example.invalid/app',{Client});assert.equal((await native.query('select true')).rows[0].result,true);assert.equal(ended,1);assert.deepEqual(options.ssl,{rejectUnauthorized:true});assert.equal(options.statement_timeout,DB_LIMITS.statement_ms);assert.equal(options.lock_timeout,DB_LIMITS.lock_ms);
 for(const search of ['?sslmode=disable','?options=-c%20statement_timeout=0'])assert.throws(()=>createNativeReceiverClient('postgres://synthetic:synthetic@db.example.invalid/app'+search),/CONFIG/);
});
test('elevated, unrelated or switched database roles never execute application SQL',async()=>{
 for(const patch of [{rolsuper:true},{rolbypassrls:true},{rolcreaterole:true},{rolcreatedb:true},{rolreplication:true},{same_role:false},{ingress:false}]){
  let queries=0,ended=0;class Client{on(){}async connect(){}async end(){ended++;}async query(){queries++;return {rows:[{...good,...patch}]};}}
  await assert.rejects(createNativeReceiverClient('postgres://synthetic:synthetic@localhost/app',{Client}).query('select application_data'),error=>error.message==='HOST_DATABASE_UNAVAILABLE');assert.equal(queries,1);assert.equal(ended,1);
 }
});
test('native connection lifetime terminates a stalled client and abort prevents reuse',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let reject,end=0;class Client{on(){}async connect(){await new Promise((_,r)=>{reject=r;});}async end(){end++;reject(Error('Synthetic private network detail'));}async query(){throw Error('Unexpected query');}}
 const native=createNativeReceiverClient('postgres://synthetic:synthetic@localhost/app',{Client}),pending=native.query('select true');t.mock.timers.tick(DB_LIMITS.lifetime_ms);await assert.rejects(pending,/HOST_DATABASE_UNAVAILABLE/);assert(end>=1);native.abort();await assert.rejects(native.query('select true'),/HOST_DATABASE_UNAVAILABLE/);
});
