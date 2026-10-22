// Existing registry shard: atomic dispatcher regressions plus actual Edge response contracts.
import test from 'node:test';import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from '../scripts/db.mjs';
import * as validators from '../supabase/functions/backend-v1/validators.js';
test('P07 subscription ledger, management scope, lifecycle rollback and strict response contracts',async()=>{
 const db=await connect();try{
  await db.query('begin');await db.query(fs.readFileSync(new URL('./fixtures/p07-subscription-lifecycle.sql',import.meta.url),'utf8'));
  const {rows}=await db.query(`select operation,response,exists(select 1 from private.p07_payment_quotes q where q.payment_id=(s.response#>>'{data,primary_id}')::uuid) quote_payment from pg_temp.p07_response_samples s`);assert(rows.length>0);
  for(const operation of ['saas_payment_submit_v1','saas_payment_verify_v1'])for(const quote_payment of [false,true])assert(rows.some(r=>r.operation===operation&&r.quote_payment===quote_payment),operation+' missing '+(quote_payment?'quoted':'normal')+' response coverage');
  for(const {operation,response} of rows){const validate=validators['success_'+operation];assert.equal(typeof validate,'function',operation);assert.equal(validate(response),true,operation+': '+JSON.stringify(validate.errors));}
 }finally{await db.query('rollback');await db.end();}
});
