import test from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleFixture} from './crm-lifecycle-fixture.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('P11 CRM conversion enforces Pro quota and rolls back numbered identity atomically',{timeout:300000},async t=>{
 const {db,org,center,api,denied,person}=await lifecycleFixture(t);
 const target=await person('Synthetic conversion candidate');
 const lead=(await api('lead_save_v1',{person_id:target,source:'phone',interest:'Synthetic conversion'})).primary_id;
 const counts=async()=> (await db.query("select (select count(*) from private.subscriber_numbers where org_id=$1 and person_id=$2) numbers,(select count(*) from core.center_relationships where org_id=$1 and person_id=$2 and kind='student') students,(select count(*) from core.sales where org_id=$1 and person_id=$2) sales,(select count(*) from core.debts where org_id=$1 and person_id=$2) debts,(select count(*) from core.account_links where org_id=$1 and person_id=$2) accounts,(select count(*) from core.reservations where org_id=$1 and person_id=$2) reservations",[org,target])).rows[0];
 assert.deepEqual(await counts(),{numbers:'0',students:'0',sales:'0',debts:'0',accounts:'0',reservations:'0'});
 const used=Number((await db.query('select private.starter_student_count($1) n',[org])).rows[0].n),fillers=Array.from({length:250-used},key),relationships=fillers.map(key);
 await db.query("insert into core.people(id,org_id,display_name,state) select id,$1,'Synthetic Pro quota','active' from unnest($2::uuid[]) id",[org,fillers]);
 await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) select id,$1,$2,person_id,'student','active',now() from unnest($3::uuid[],$4::uuid[]) x(id,person_id)",[org,center,relationships,fillers]);
 try{await denied('lead_convert_v1',{lead_id:lead},'PLAN_LIMIT_REACHED');assert.equal((await counts()).numbers,'0');}
 finally{await db.query("update core.center_relationships set state='inactive',ended_at=now() where org_id=$1 and id=any($2)",[org,relationships]);}
 const trigger='crm_convert_'+key().replaceAll('-','');
 await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='lead_convert_v1' then raise exception 'synthetic late conversion failure' using errcode='23514';end if;return new;end$$`);
 await db.query(`create trigger ${trigger} before insert on core.audit_events for each row execute function private.${trigger}()`);
 try{await denied('lead_convert_v1',{lead_id:lead},'INTEGRITY_VIOLATION');assert.equal((await counts()).numbers,'0');assert.equal((await counts()).students,'0');assert.equal((await db.query('select state from core.leads where id=$1',[lead])).rows[0].state,'open');}
 finally{await db.query(`drop trigger ${trigger} on core.audit_events`);await db.query(`drop function private.${trigger}()`);}
 const conversionKey=key();await api('lead_convert_v1',{lead_id:lead},conversionKey);assert.equal((await api('lead_convert_v1',{lead_id:lead},conversionKey)).replayed,true);
 assert.deepEqual(await counts(),{numbers:'1',students:'1',sales:'0',debts:'0',accounts:'0',reservations:'0'});
 const number=(await db.query('select private.subscriber_number($1,$2) n',[org,target])).rows[0].n;assert(BigInt(number)>=1001n);
 await denied('lead_convert_v1',{lead_id:lead},'INVALID_STATE_TRANSITION');assert.equal((await db.query('select private.subscriber_number($1,$2) n',[org,target])).rows[0].n,number);
});
