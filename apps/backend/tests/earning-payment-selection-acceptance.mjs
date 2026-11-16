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

test('W1-BE-19 native self payment period, method evidence, live authority and bound cursor',async t=>{
 const db=await connect();t.after(()=>db.end());
 const {platform,plan}=await fixturePlatform(),owner=await authUser('self-earning-owner'),teacher=await authUser('self-earning-teacher');
 const ownerAccount=await must(owner,'account_get_v1'),teacherAccount=await must(teacher,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:ownerAccount.id,name:'Synthetic instructor self ledger',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Self ledger',timezone:'Europe/Istanbul'},key())).primary_id;
 const manager=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 const api=(op,b={},k=key(),user=owner)=>must(user,op,{org_id:org,center_id:center,...b},k);
 await api('center_manager_assign_v1',{person_id:manager});
 const subscription=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic self ledger',occurred_at:new Date().toISOString()});
 await must(platform,'saas_payment_verify_v1',{org_id:org,payment_id:subscription.primary_id,accepted:true},key());
 const person=(await api('person_create_v1',{display_name:'Synthetic self instructor',contacts:[]})).primary_id;
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,teacherAccount.id,person]);
 const role=await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Synthetic self agreement',state:'active'},key())).primary_id;
 await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const agreementBody={person_id:person,discipline_id:discipline,format:'group',valid:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},terms:{model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'100'}],room_fee:{kind:'free',order:'before_instructor_share'}},reason:'Synthetic self agreement'};
 const oldAgreement=await api('instructor_agreement_publish_v1',agreementBody);
 const currentAgreement=await api('instructor_agreement_publish_v1',{...agreementBody,supersedes_id:oldAgreement.primary_id,expected_version:1,valid:{starts_at:'2025-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'}});
 const futureAgreement=await api('instructor_agreement_publish_v1',{...agreementBody,supersedes_id:currentAgreement.primary_id,expected_version:2,valid:{starts_at:'2028-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'}});
 const privateAgreement=await api('instructor_agreement_publish_v1',{...agreementBody,format:'private'});
 const operation=(await db.query('select id from core.operation_receipts where org_id=$1 order by created_at,id limit 1',[org])).rows[0].id;
 const earning=key();await db.query("insert into core.earnings(id,org_id,center_id,person_id,amount_minor,currency,basis,operation_id,direction,created_at) values($1,$2,$3,$4,100,'TRY',$5,$6,'add','2020-01-01T00:00:00Z')",[earning,org,center,person,{source:'event_fee',currency:'TRY',quantity:1,excluded_blocked:0},operation]);
 const body={person_id:person,earning_ids:[earning],amount_minor:'60',currency:'TRY',occurred_at:'2026-01-03T00:00:00Z',payment:{method:'bank_transfer',reference:'synthetic-private-reference'}};
 const paymentKey=key(),paid=await api('instructor_payment_record_v1',body,paymentKey);
 assert.equal((await api('instructor_payment_record_v1',body,paymentKey)).replayed,true);
 const mismatch=await call(owner,'instructor_payment_record_v1',{org_id:org,center_id:center,...body,payment:{method:'cash'}},paymentKey);assert.equal(mismatch.result.error.code,'IDEMPOTENCY_PAYLOAD_MISMATCH');
 const corrected=await api('instructor_payment_correct_v1',{payment_id:paid.primary_id,expected_version:1,correction:{amount_minor:'10',currency:'TRY',direction:'decrease',occurred_at:'2026-01-04T00:00:00Z'},reason:'Synthetic linked adjustment'});
 const read={person_id:person,view:'payments',interval:{starts_at:'2026-01-01T00:00:00Z',ends_at:'2026-02-01T00:00:00Z'},page:{limit:1}};
 const page=await api('instructor_account_get_v1',read,undefined,teacher);
 assert.equal(page.items.length,1);assert.equal(page.items[0].id,paid.primary_id);assert.equal(page.items[0].method,'bank_transfer');assert(page.next_cursor);
 assert.equal(page.totals.find(x=>x.currency==='TRY').earned_minor,'0');assert.equal(page.totals[0].paid_minor,'50');assert.equal(page.totals[0].remaining_minor,'0');
 const second=await api('instructor_account_get_v1',{...read,page:{limit:1,cursor:page.next_cursor}},undefined,teacher);
 assert.equal(corrected.primary_id,paid.primary_id);assert.equal(corrected.version,2);assert.equal(corrected.related.length,1);assert.deepEqual(corrected.related[0],{type:'instructor_payments',id:second.items[0].id});assert.equal(second.items[0].root_payment_id,paid.primary_id);assert.equal(second.items[0].method,'bank_transfer');assert.equal(second.next_cursor,null);
 assert(!JSON.stringify([page,second]).includes('synthetic-private-reference'));
 const all=await api('instructor_account_get_v1',{person_id:person,view:'payments',page:{}},undefined,teacher);assert.equal(all.totals[0].earned_minor,'100');assert.equal(all.totals[0].remaining_minor,'50');
 const agreements=await api('instructor_account_get_v1',{person_id:person,view:'agreements',page:{limit:1}},undefined,teacher);assert.equal(agreements.items[0].id,currentAgreement.primary_id);assert(agreements.next_cursor);
 const agreementNext=await api('instructor_account_get_v1',{person_id:person,view:'agreements',page:{limit:1,cursor:agreements.next_cursor}},undefined,teacher);assert.equal(agreementNext.items[0].id,privateAgreement.primary_id);assert.equal(agreementNext.next_cursor,null);
 assert(!JSON.stringify([agreements.items,agreementNext.items]).includes(futureAgreement.primary_id));assert.notEqual(agreements.items[0].id,oldAgreement.primary_id);
 const detail=await api('instructor_agreement_get_v1',{agreement_id:currentAgreement.primary_id},undefined,teacher);assert.equal(detail.agreement.id,currentAgreement.primary_id);
 const historicalPerson=(await api('person_create_v1',{display_name:'Synthetic merged earning history',contacts:[]})).primary_id;
 await api('student_activate_v1',{person_id:historicalPerson});
 const aliasDiscipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Synthetic alias agreement',state:'active'},key())).primary_id;await api('center_discipline_set_v1',{discipline_id:aliasDiscipline,state:'active'});
 const aliasAgreement=await api('instructor_agreement_publish_v1',{...agreementBody,person_id:historicalPerson,discipline_id:aliasDiscipline});
 await db.query('update core.people set merged_into_id=$1 where org_id=$2 and id=$3',[person,org,historicalPerson]);
 const aliasPage=await api('instructor_account_get_v1',{person_id:person,view:'agreements',page:{}},undefined,teacher);assert(aliasPage.items.some(x=>x.id===aliasAgreement.primary_id));
 const aliasInitial=await api('instructor_agreement_get_v1',{agreement_id:aliasAgreement.primary_id},undefined,teacher);assert.equal(aliasInitial.agreement.person_id,historicalPerson);
 await api('content_catalog_save_v1',{scope_key:'center:'+org+':'+center,code:'instructor.agreement',channel:'document',language:'tr',version:1,source_version:aliasAgreement.primary_id,content:{name:'Synthetic alias terms',language:'tr',template_id:'instructor',template_version:'1',text:'Synthetic terms\n{{facts}}'},action:'publish'});
 const rendered=await api('instructor_agreement_get_v1',{agreement_id:aliasAgreement.primary_id},undefined,teacher);assert(rendered.rendered_document);
 const acceptanceBody={agreement_id:aliasAgreement.primary_id,rendered_document_id:rendered.rendered_document.id};const acceptanceKey=key();await api('instructor_agreement_accept_v1',acceptanceBody,acceptanceKey,teacher);assert.equal((await api('instructor_agreement_accept_v1',acceptanceBody,acceptanceKey,teacher)).replayed,true);
 const accepted=await api('instructor_agreement_get_v1',{agreement_id:aliasAgreement.primary_id},undefined,teacher);assert.equal(accepted.acceptance.person_id,person);assert.deepEqual(accepted.agreement,aliasInitial.agreement);assert.equal(accepted.source_content_hash,aliasInitial.source_content_hash);
 const unrelated=await authUser('unrelated-self-instructor'),unrelatedAccount=await must(unrelated,'account_get_v1'),unrelatedPerson=(await api('person_create_v1',{display_name:'Synthetic unrelated instructor',contacts:[]})).primary_id;
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,unrelatedAccount.id,unrelatedPerson]);await api('role_assign_v1',{person_id:unrelatedPerson,role:'instructor',scope:{center_id:center}});
 for(const op of ['instructor_agreement_get_v1','instructor_agreement_accept_v1']){const denied=await call(unrelated,op,{org_id:org,center_id:center,...(op==='instructor_agreement_get_v1'?{agreement_id:aliasAgreement.primary_id}:acceptanceBody)},key());assert.equal(denied.result.error.code,'FORBIDDEN');}

 const historicalEarning=key(),historicalPayment=key();
 await db.query("insert into core.earnings(id,org_id,center_id,person_id,amount_minor,currency,basis,operation_id,direction,created_at) values($1,$2,$3,$4,20,'USD',$5,$6,'add','2020-01-01T00:00:00Z')",[historicalEarning,org,center,historicalPerson,{source:'event_fee',currency:'USD',quantity:1,excluded_blocked:0},operation]);
 await db.query("insert into core.instructor_payments(id,org_id,center_id,person_id,amount_minor,currency,occurred_at,operation_id) values($1,$2,$3,$4,5,'USD','2026-01-05T00:00:00Z',$5)",[historicalPayment,org,center,historicalPerson,operation]);
 await db.query('insert into core.earning_allocations(id,org_id,center_id,payment_id,earning_id,amount_minor) values($1,$2,$3,$4,$5,5)',[key(),org,center,historicalPayment,historicalEarning]);
 const history=await api('instructor_account_get_v1',{person_id:person,view:'payments',page:{}},undefined,teacher);assert.equal(history.items.find(x=>x.id===historicalPayment).method,null);assert.deepEqual(history.totals.map(x=>x.currency),['TRY','USD']);assert.equal(history.totals.find(x=>x.currency==='USD').earned_minor,'20');assert.equal(history.totals.find(x=>x.currency==='USD').paid_minor,'5');assert.equal(history.totals.find(x=>x.currency==='USD').remaining_minor,'15');
 const explicit=await api('instructor_payment_correct_v1',{payment_id:paid.primary_id,expected_version:2,correction:{amount_minor:'5',currency:'TRY',direction:'increase',occurred_at:'2026-01-06T00:00:00Z'},payment:{method:'cash'},reason:'Synthetic explicit method'});
 const methods=await api('instructor_account_get_v1',{person_id:person,view:'payments',page:{}},undefined,teacher);assert.equal(methods.items.find(x=>x.id===explicit.related[0].id).method,'cash');assert.equal(methods.items.find(x=>x.id===paid.primary_id).method,'bank_transfer');
 for(const changed of [{person_id:manager},{view:'agreements'},{interval:{starts_at:'2025-01-01T00:00:00Z',ends_at:'2026-02-01T00:00:00Z'}}]){
  const r=await call(teacher,'instructor_account_get_v1',{org_id:org,center_id:center,...read,...changed,page:{cursor:page.next_cursor}});assert.equal(r.result.ok,false);
 }
 const foreign=await call(owner,'instructor_account_get_v1',{org_id:org,center_id:center,...read});assert.equal(foreign.result.error.code,'FORBIDDEN');
 const revokeImpact=await api('role_revoke_preview_v1',{assignment_id:role.primary_id,expected_version:role.version});
 await api('role_revoke_v1',{assignment_id:role.primary_id,expected_version:role.version,impact_approval:{id:revokeImpact.id,token:revokeImpact.token},reason:'Synthetic live revoke'});
 const revoked=await call(teacher,'instructor_account_get_v1',{org_id:org,center_id:center,...read});assert.equal(revoked.result.ok,false);
});
