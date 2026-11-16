import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import * as validators from '../supabase/functions/backend-v1/validators.js';

test('Native sale discounts, scoped ledgers, membership dates and center finance preserve independent authorities',async()=>{
 const db=await connect();
 try{
  await db.query('begin');
  await db.query(fs.readFileSync(new URL('./fixtures/sale-discount-acceptance.sql',import.meta.url),'utf8'));
  const {rows}=await db.query('select operation,request,response from pg_temp.sda_responses');
  for(const {operation,request,response} of rows){
   if(!response.ok)continue;
   const requestValidator=validators['request_'+operation],responseValidator=validators['success_'+operation];
   assert.equal(typeof requestValidator,'function',operation);assert.equal(typeof responseValidator,'function',operation);
   assert(requestValidator(request),operation+': '+JSON.stringify(requestValidator.errors));
   assert(responseValidator(response),operation+': '+JSON.stringify(responseValidator.errors));
  }
  for(const operation of ['permission_set_v1','policy_publish_v1','sale_preview_v1','sale_apply_v1','collection_record_v1','sale_refund_preview_v1','sale_refund_apply_v1','entitlements_get_v1','person_get_v1','finance_directory_get_v1']){
   assert(rows.some(r=>r.operation===operation&&r.response.ok),operation+' canonical acceptance missing');
  }
 }finally{await db.query('rollback');await db.end();}
});

test('Scoped read opt-ins require their complete context and preserve exclusive legacy finance requests',()=>{
 const base={client_api_version:1,request_id:key(),org_id:key(),center_id:key()},person={...base,person_id:key()};
 assert(validators.request_entitlements_get_v1(person));
 assert.equal(validators.request_entitlements_get_v1({...person,ledger_sale_id:key()}),false);
 assert.equal(validators.request_entitlements_get_v1({...person,ledger_page:{limit:1}}),false);
 assert(validators.request_entitlements_get_v1({...person,ledger_sale_id:key(),ledger_page:{limit:1}}));
 const unscoped={...person};delete unscoped.center_id;
 assert(validators.request_person_get_v1(unscoped));
 assert.equal(validators.request_person_get_v1({...unscoped,include_membership_date:true}),false);
 assert(validators.request_person_get_v1({...person,include_membership_date:true}));
 const legacy={...person,currency:'USD',page:{limit:1}};
 const directory={...base,view:'movements',interval:{starts_at:'2030-01-01T00:00:00Z',ends_at:'2030-01-02T00:00:00Z'},page:{limit:1}};
 assert(validators.request_finance_get_v1(legacy));assert(validators.request_finance_directory_get_v1(directory));
 assert.equal(validators.request_finance_get_v1(directory),false);assert.equal(validators.request_finance_directory_get_v1(legacy),false);
 for(const mixed of [{...directory,person_id:person.person_id},{...directory,currency:'USD'}])assert.equal(validators.request_finance_directory_get_v1(mixed),false);
 assert.equal(validators.request_finance_get_v1({...legacy,view:'movements'}),false);
});
