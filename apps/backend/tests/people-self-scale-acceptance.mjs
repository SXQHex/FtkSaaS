import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {newUuidV7 as id} from '../scripts/uuid.mjs';

test('XREQ-021 native self discovery remains isolated with 10000 unrelated people',async t=>{
 const db=await resources(t).connect(context().env.DB_URL),{platform,plan}=await fixturePlatform();
 const owner=await authUser('scale-owner'),student=await authUser('scale-student'),foreign=await authUser('scale-foreign');
 const account=await must(owner,'account_get_v1'),member=await must(student,'account_get_v1');await must(foreign,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic people scale',initial_plan_id:plan},id())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Scale center',timezone:'UTC'},id())).primary_id;
 const api=(op,body={},user=owner)=>must(user,op,{org_id:org,center_id:center,...body},id());
 const manager=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await api('center_manager_assign_v1',{person_id:manager});const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic scale',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},platform);
 const person=(await api('person_create_v1',{display_name:'Scale self student',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:person});
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[id(),org,member.id,person]);
 // These are valid independent people read snapshots, not student activation
 // or merge lifecycle simulations. No artificial plan quota is bypassed.
 const people=Array.from({length:10000},id);
 await db.query("insert into core.people(id,org_id,display_name,state) select p,$2,'Scale unrelated person','active' from unnest($1::uuid[]) p",[people,org]);
 const before=(await db.query('select count(*)::int people,(select count(*)::int from core.operation_receipts where org_id=$1) receipts from core.people where org_id=$1',[org])).rows[0];
 const read=(user,extra={})=>must(user,'people_list_v1',{org_id:org,center_id:center,page:{limit:25,sort:'created_at_asc'},...extra});
 const own=await read(student);assert.deepEqual(own.items.map(p=>p.id),[person]);assert.equal(own.next_cursor,null);
 const filtered=await read(student,{relationship:'student',query:'Scale self'});assert.deepEqual(filtered.items.map(p=>p.id),[person]);
 assert.deepEqual((await read(student,{query:'unrelated'})).items,[]);
 const denied=await call(foreign,'people_list_v1',{org_id:org,center_id:center,page:{limit:25,sort:'created_at_asc'}});assert.equal(denied.result.ok,false);
 const first=await read(owner),second=await read(owner,{page:{limit:25,sort:'created_at_asc',cursor:first.next_cursor}});assert.equal(first.items.length,25);assert.equal(second.items.length,25);assert(first.next_cursor);assert.equal(new Set([...first.items,...second.items].map(p=>p.id)).size,50);
 assert.deepEqual((await db.query('select count(*)::int people,(select count(*)::int from core.operation_receipts where org_id=$1) receipts from core.people where org_id=$1',[org])).rows[0],before);
 // Snapshot of a valid alias chain; source ledger rows are intentionally absent.
 const aliases=[id(),id()];await db.query("insert into core.people(id,org_id,display_name,state,merged_into_id) values($1,$3,'Scale alias one','merged',$4),($2,$3,'Scale alias two','merged',$1)",[...aliases,org,person]);
 const members=(await db.query('select private.p07_person_members($1,$2) ids',[org,aliases[1]])).rows[0].ids;assert.deepEqual(members,[person,...aliases].sort());
 const again=await read(student);assert.deepEqual(again.items.map(p=>p.id),[person]);assert.deepEqual([...again.items[0].linked_person_ids].sort(),[person,...aliases].sort());
});
