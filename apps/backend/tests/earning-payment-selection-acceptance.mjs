import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Selected earning IDs remain scoped after the payment amount is exhausted',async()=>{
 const db=await connect();
 try{
  const {platform,plan}=await fixturePlatform(),owner=await authUser('earning-selection'),account=await must(owner,'account_get_v1');
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic payment selection',initial_plan_id:plan},key())).primary_id;
  const api=(op,b={},k=key())=>must(owner,op,{org_id:org,...b},k);
  const center=(await api('center_create_v1',{name:'Payment center',timezone:'Europe/Istanbul'})).primary_id;
  const otherCenter=(await api('center_create_v1',{name:'Other center',timezone:'Europe/Istanbul'})).primary_id;
  const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await api('center_manager_assign_v1',{center_id:center,person_id:person});
  const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic selection',occurred_at:new Date().toISOString()});
  await must(platform,'saas_payment_verify_v1',{org_id:org,payment_id:payment.primary_id,accepted:true},key());
  const otherPerson=(await api('person_create_v1',{center_id:center,display_name:'Synthetic other earning recipient',contacts:[]})).primary_id;
  const operation=(await db.query('select id from core.operation_receipts where org_id=$1 order by created_at,id limit 1',[org])).rows[0].id;
  const earning=async(extra={})=>{
   const id=key();await db.query("insert into core.earnings(id,org_id,center_id,person_id,amount_minor,currency,basis,operation_id,direction,previous_id,created_at) values($1,$2,$3,$4,100,$5,$6,$7,'add',$8,$9)",[id,org,extra.center??center,extra.person??person,extra.currency??'TRY',{source:'event_fee',currency:extra.currency??'TRY',quantity:1,excluded_blocked:0},operation,extra.previous??null,extra.at??'2020-01-02T00:00:00Z']);return id;
  };
  const good=await earning({at:'2020-01-01T00:00:00Z'}),wrongCenter=await earning({center:otherCenter}),wrongPerson=await earning({person:otherPerson}),wrongCurrency=await earning({currency:'USD'}),linked=await earning({previous:good});
  const snapshot=async()=>({
   payments:(await db.query('select * from core.instructor_payments where org_id=$1 order by id',[org])).rows,
   allocations:(await db.query('select * from core.earning_allocations where org_id=$1 order by id',[org])).rows,
   receipts:(await db.query('select id from core.operation_receipts where org_id=$1 order by id',[org])).rows
  });
  const request=bad=>({org_id:org,center_id:center,person_id:person,earning_ids:[good,bad],amount_minor:'100',currency:'TRY',occurred_at:new Date().toISOString()});
  for(const [bad,code] of [[wrongCenter,'NOT_FOUND'],[wrongPerson,'NOT_FOUND'],[wrongCurrency,'CURRENCY_MISMATCH'],[linked,'VALIDATION_FAILED'],[key(),'NOT_FOUND']]){
   const before=await snapshot(),result=await call(owner,'instructor_payment_record_v1',request(bad),key());
   assert.equal(result.result.ok,false);assert.equal(result.result.error.code,code);assert.deepEqual(await snapshot(),before);
  }
  const payload={...request(good),earning_ids:[good]},operationKey=key();
  const paid=await must(owner,'instructor_payment_record_v1',payload,operationKey);
  assert.equal((await must(owner,'instructor_payment_record_v1',payload,operationKey)).replayed,true);
  const allocated=(await db.query('select sum(amount_minor)::text value from core.earning_allocations where org_id=$1 and payment_id=$2',[org,paid.primary_id])).rows[0].value;
  assert.equal(allocated,'100');
 }finally{await db.end();}
});
