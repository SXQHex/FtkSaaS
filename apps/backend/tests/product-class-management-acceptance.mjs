import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from '../scripts/db.mjs';
import * as validators from '../supabase/functions/backend-v1/validators.js';

test('Native product lifecycle preserves published history and group discovery projects only scoped priority reservations',async()=>{
 const db=await connect();
 try{
  await db.query('begin');
  await db.query(fs.readFileSync(new URL('./fixtures/product-class-management-acceptance.sql',import.meta.url),'utf8'));
  const {rows}=await db.query('select operation,request,response from pg_temp.pcm_responses');
  for(const {operation,request,response} of rows){
   if(!response.ok)continue;
   const requestValidator=validators['request_'+operation],responseValidator=validators['success_'+operation];
   assert.equal(typeof requestValidator,'function',operation);assert.equal(typeof responseValidator,'function',operation);
   assert(requestValidator(request),operation+': '+JSON.stringify(requestValidator.errors));
   assert(responseValidator(response),operation+': '+JSON.stringify(responseValidator.errors));
  }
  for(const operation of ['product_publish_v1','products_management_list_v1','product_state_set_v1','sale_preview_v1','sale_apply_v1','management_state_get_v1'])assert(rows.some(r=>r.operation===operation&&r.response.ok),operation+' native acceptance missing');
 }finally{await db.query('rollback');await db.end();}
});
