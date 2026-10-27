import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import pg from 'pg';
import {connect,stackStatus} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';

// Exercise the exact migration against pre-migration documents in a separate
// loopback database. The small history dispatcher is only an anchor fixture;
// real Auth/scope/peer consumers are covered by starter-preparation-acceptance.
test('ST-03 canonical settings migration preserves closed views and rolls back ambiguity',{timeout:60000},async t=>{
 const admin=await connect(),name='st03_scope_'+key().replaceAll('-',''),url=new URL(stackStatus().env.DB_URL);
 let db,created=false;
 const migration=fs.readFileSync('database/canonical-settings-scope.sql','utf8');
 const defs=await admin.query("select pg_get_functiondef(x::regprocedure) body from unnest(array['private.append_only()','private.frontend_settings_fields()','private.frontend_settings_defaults(text)']) x");
 const org=key(),account=key(),lower='member:'+org+':'+account,upper='member:'+org.toUpperCase()+':'+account.toUpperCase();
 assert.notEqual(lower,upper);
 async function fixture(){
  await db.query('drop schema if exists private cascade;create schema private');
  for(const {body} of defs.rows)await db.query(body);
  await db.query(`create table private.frontend_settings(scope_key text primary key,scope text not null,values jsonb not null,version bigint not null);
   create table private.frontend_settings_previews(id uuid primary key,scope_key text not null,applied bool not null default false);
   create table private.frontend_settings_history(id uuid primary key,scope_key text not null,at timestamptz not null default now(),marker int not null);
   create trigger history_immutable before update or delete on private.frontend_settings_history for each row execute function private.append_only();
   create function private.frontend_settings_execute(op text,r jsonb,account uuid,person uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
   declare skey text:=r->>'test_scope_key';history_asof timestamptz:=clock_timestamp();v jsonb;
   begin select coalesce(jsonb_agg(marker order by marker),'[]') into v from private.frontend_settings_history where scope_key=skey and at<=history_asof;return v;end$$;`);
 }
 try{
  await admin.query('create database "'+name+'" template template0');created=true;url.pathname='/'+name;db=new pg.Client({connectionString:url.href});await db.connect();
  await t.test('explicit and default closed fields win; versions, previews and immutable histories survive',async()=>{
   await fixture();
   await db.query('insert into private.frontend_settings values($1,$2,$3,3),($4,$2,$5,5)',[lower,'member',{email_visible:true,profile_visible:true},upper,{email_visible:false,phone_visible:true}]);
   for(const [i,k] of [lower,upper].entries()){
    await db.query('insert into private.frontend_settings_previews(id,scope_key) values($1,$2)',[key(),k]);
    await db.query('insert into private.frontend_settings_history(id,scope_key,marker) values($1,$2,$3)',[key(),k,i+1]);
   }
   const before=(await db.query('select * from private.frontend_settings_history order by marker')).rows;
   await db.query(migration);
   const docs=(await db.query('select * from private.frontend_settings')).rows;assert.equal(docs.length,1);assert.equal(docs[0].scope_key,lower);assert.equal(Number(docs[0].version),6);
   for(const field of ['email_visible','profile_visible','phone_visible'])assert.equal(docs[0].values[field],false,field);
   assert.equal((await db.query('select count(*)::int n from private.frontend_settings_previews where applied')).rows[0].n,2);
   assert.equal((await db.query('select count(*)::int n from private.settings_legacy_scope_snapshots')).rows[0].n,2);
   for(const sql of ['update private.settings_legacy_scope_snapshots set version=99','delete from private.settings_legacy_scope_snapshots'])await assert.rejects(db.query(sql),e=>e.message==='INTEGRITY_VIOLATION');
   assert.deepEqual((await db.query('select * from private.frontend_settings_history order by marker')).rows,before);
   const history=await db.query("select private.frontend_settings_execute(null,jsonb_build_object('test_scope_key',$1::text),null,null,null,null,null) v",[lower]);assert.deepEqual(history.rows[0].v,[1,2]);
   const canonical=await db.query("select private.frontend_settings_key(jsonb_build_object('scope','member','org_id',$1::text),$2::uuid,null) v",[org.toUpperCase(),account]);assert.equal(canonical.rows[0].v,lower);
  });
  await t.test('a conflicting non-privacy value stops the whole migration without data loss',async()=>{
   await fixture();const a='organization:'+org,b='organization:'+org.toUpperCase();
   await db.query('insert into private.frontend_settings values($1,$2,$3,2),($4,$2,$5,4)',[a,'organization',{program_duration_minutes:45},b,{program_duration_minutes:90}]);
   await db.query('insert into private.frontend_settings_previews(id,scope_key) values($1,$2)',[key(),a]);
   const before=(await db.query('select * from private.frontend_settings order by scope_key')).rows;
   await assert.rejects(db.query(migration),e=>e.message==='AMBIGUOUS_LEGACY_SETTINGS_SCOPE');await db.query('rollback');
   assert.deepEqual((await db.query('select * from private.frontend_settings order by scope_key')).rows,before);
   assert.equal((await db.query('select applied from private.frontend_settings_previews')).rows[0].applied,false);
   assert.equal((await db.query("select to_regclass('private.settings_legacy_scope_snapshots') v")).rows[0].v,null);
  });
 }finally{
  if(db)await db.end();if(created)await admin.query('drop database "'+name+'" with (force)');await admin.end();
 }
});
