import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from '../scripts/db.mjs';
import * as validators from '../supabase/functions/backend-v1/validators.js';

test('Member time boundaries and planned freeze cancellation preserve native scope, approvals and confirmed rights',async()=>{
 const db=await connect();
 try{
  await db.query('begin');
  await db.query(fs.readFileSync(new URL('./fixtures/member-profile-lifecycle.sql',import.meta.url),'utf8'));
  const {rows}=await db.query('select operation,request,response from pg_temp.member_responses');
  for(const {operation,request,response} of rows){
   if(!response.ok)continue;
   for(const [prefix,value] of [['request',request],['success',response]]){
    const validate=validators[prefix+'_'+operation];assert.equal(typeof validate,'function',operation);
    assert(validate(value),prefix+' '+operation+': '+JSON.stringify(validate.errors));
   }
  }
  for(const operation of ['reservation_list_v1','freeze_cancel_preview_v1','freeze_cancel_apply_v1','preview_get_v1'])assert(rows.some(r=>r.operation===operation&&r.response.ok),operation+' acceptance missing');
 }finally{await db.query('rollback');await db.end();}
});
