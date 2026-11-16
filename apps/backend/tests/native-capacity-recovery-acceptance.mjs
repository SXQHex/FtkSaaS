import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from '../scripts/db.mjs';
import * as validators from '../supabase/functions/backend-v1/validators.js';

test('Capacity ACK and preview recovery authorize legacy normalized contexts without replaying writes',async()=>{
 const db=await connect();
 try{
  await db.query('begin');
  await db.query(fs.readFileSync(new URL('./fixtures/native-capacity-recovery.sql',import.meta.url),'utf8'));
  const {rows}=await db.query('select operation,request,response from pg_temp.ncr_responses');
  for(const {operation,request,response} of rows){
   const validateRequest=validators['request_'+operation];
   assert.equal(typeof validateRequest,'function',operation);
   assert(validateRequest(request),operation+': '+JSON.stringify(validateRequest.errors));
   const path=operation==='program_preview_v1'?'schedule':operation==='session_change_preview_v1'?'patch':null;
   const capacity=path?request[path]?.capacity:request.capacity;
   if(capacity){
    const canonical={nominal:capacity.total,maximum:capacity.total,categories:capacity.categories??null};
    const privateShape=path?{...request,[path]:{...request[path],capacity:canonical}}:{...request,capacity:canonical};
    assert.equal(validateRequest(privateShape),false,operation+' must not expose its private normalized capacity');
   }
   if(response.ok){
    const validate=validators['success_'+operation];
    assert.equal(typeof validate,'function',operation);
    assert(validate(response),operation+': '+JSON.stringify(validate.errors));
   }
  }
  for(const operation of ['session_create_v1','replacement_session_create_v1','session_capacity_set_v1']){
   assert(rows.some(r=>r.operation==='operation_status_get_v1'&&r.request.operation===operation&&r.response.ok),operation+' ACK recovery missing');
  }
  assert(rows.filter(r=>r.operation==='preview_get_v1'&&r.response.ok).length>=2,'program and patch previews recovered');
 }finally{await db.query('rollback');await db.end();}
});
