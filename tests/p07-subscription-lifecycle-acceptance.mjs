// Existing registry shard; financial/lifecycle dispatcher regressions are atomic and rolled back.
import test from 'node:test';import fs from 'node:fs';import {connect} from '../scripts/db.mjs';
test('P07 subscription ledger, management scope, close/reopen and global deletion rollback regressions',async()=>{
 const db=await connect();try{await db.query('begin');await db.query(fs.readFileSync(new URL('./fixtures/p07-subscription-lifecycle.sql',import.meta.url),'utf8'));}finally{await db.query('rollback');await db.end();}
});
