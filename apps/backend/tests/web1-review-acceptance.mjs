import test from 'node:test';import fs from 'node:fs';import assert from 'node:assert/strict';
import {connect} from '../scripts/db.mjs';import * as validators from '../supabase/functions/backend-v1/validators.js';
test('Web1 scoped account discovery, merge decisions and resource lifecycle run atomically through native dispatcher',async()=>{
 const db=await connect();try{await db.query('begin');await db.query(fs.readFileSync(new URL('./fixtures/web1-review-lifecycle.sql',import.meta.url),'utf8'));
  const {rows}=await db.query('select operation,response from pg_temp.web1_responses');assert(rows.length>=10);
  for(const {operation,response} of rows){const valid=validators['success_'+operation];assert.equal(typeof valid,'function',operation);assert(valid(response),operation+': '+JSON.stringify(valid.errors));}
 }finally{await db.query('rollback');await db.end();}
});
