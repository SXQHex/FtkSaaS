import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as id} from '../scripts/uuid.mjs';
test('Catalog: bounded rendering, immutable publication, exact source translations and data-only language capacity',async()=>{
 const db=await connect();try{await db.query('begin');
 const entries=JSON.parse(fs.readFileSync(new URL('../config/content/platform-v1.json',import.meta.url)));
 const bootstrap=[...fs.readFileSync('database/content-platform-v1.sql','utf8').matchAll(/select private\.content_store\('((?:[^']|'')*)'::jsonb,'[^']+'::uuid\);/g)].map(m=>{const entry=JSON.parse(m[1].replaceAll("''","'"));assert.equal(entry.action,'publish');delete entry.action;return entry;});assert.deepEqual(bootstrap,entries);
 for(const [suffix,names] of [['content_catalog',['content-catalog','content-catalog-api','content-platform-v1']],['content_delivery',['settings-catalog-v23','content-language-settings','content-delivery']],['content_documents',['content-documents','content-source-guards','content-sharing']]]){const expected='begin;\n'+names.map(n=>fs.readFileSync('database/'+n+'.sql','utf8').split('\n').filter(l=>!['begin;','commit;'].includes(l.trim())).join('\n')).join('\n')+'\ncommit;\n';const migration=fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_'+suffix+'.sql'));assert.equal(fs.readFileSync('supabase/migrations/'+migration,'utf8'),expected);}
 const store=async e=>(await db.query('select (private.content_store($1::jsonb,$2)).*',[{...e,action:'publish'},id()])).rows[0];
 for(const entry of entries)await store(entry);
 const seed=entries.find(e=>e.code==='notification.lesson'&&e.channel==='email'&&e.language==='en');
 const first=await store(seed);assert.equal((await store(seed)).id,first.id);
 const rejected=async(sql,args,pattern)=>{await db.query('savepoint reject');await assert.rejects(db.query(sql,args),pattern);await db.query('rollback to savepoint reject');};
 await rejected('select private.content_store($1,$2)',[{...seed,action:'publish',content:{title:'Other',text:'{{app_url}}'}},id()],/VERSION_CONFLICT/);
 await rejected('update private.content_templates set content=content where id=$1',[first.id],/INTEGRITY_VIOLATION/);
 await rejected('select private.content_store($1,$2)',[{...seed,version:2,action:'publish',content:{title:'Test',text:'{{unknown}}'}},id()],/VALIDATION_FAILED/);
 await rejected('select private.content_store($1,$2)',[{...seed,version:2,action:'publish',content:{title:'Test',text:'No required variable'}},id()],/VALIDATION_FAILED/);
 await rejected('select private.content_render(c,$2) from private.content_templates c where id=$1',[first.id,{}],/VALIDATION_FAILED/);
 await rejected('select private.content_store($1,$2)',[{...seed,version:2,action:'publish',content:{title:'{{app_url}}',text:'No body variable'}},id()],/VALIDATION_FAILED/);
 const literal={scope_key:'platform',code:'legacy.literal',channel:'document',language:'tr',version:1,source_version:'1',content:{name:'Legacy {{literal}}',language:'tr',template_id:'legacy',template_version:'1',text:'Literal {{legacy}} and }} bytes'}};const fixed=await store(literal);assert.deepEqual((await db.query('select private.content_render(c,$2) v from private.content_templates c where id=$1',[fixed.id,{}])).rows[0].v,literal.content);
 await db.query("select private.content_validate('legacy.maximum','document','tr',$1)",[{...literal.content,text:'x'.repeat(262144)}]);
 const rendered=(await db.query('select private.content_render(c,$2) v from private.content_templates c where id=$1',[first.id,{app_url:'https://synthetic.invalid/{{literal}}'}])).rows[0].v;
 assert.match(rendered.text,/\{\{literal\}\}/);
 for(const language of ['qaa','qab','qac']){const c=await store({...seed,language});assert.equal(c.language,language);}
 const picked=(await db.query("select (private.content_pick('platform','notification.lesson','email',array['qac','en'],'1')).language language")).rows[0];assert.equal(picked.language,'qac');
 assert.equal((await db.query("select (private.content_pick('platform','notification.lesson','email',array['qac'],'2')).id id")).rows[0].id,null);
 await db.query('insert into private.content_retirements(template_id) values($1)',[first.id]);
 assert.equal((await db.query("select (private.content_pick('platform','notification.lesson','email',array['en'],'1')).id id")).rows[0].id,null);
 }finally{await db.query('rollback');await db.end();}
});
import {fixturePlatform,authUser,must,call} from './api-client.mjs';
import {publishContent} from '../scripts/content-publish.mjs';
test('Catalog native API: operator publishes new language data, user cannot publish, same version cannot change',async()=>{
 const {platform}=await fixturePlatform(),user=await authUser('catalog-unprivileged');await must(user,'account_get_v1');
 const entry=JSON.parse(fs.readFileSync(new URL('../config/content/platform-v1.json',import.meta.url))).find(x=>x.channel==='email');
 const body={...entry,version:100,language:'qad',action:'publish'};
 const created=await must(platform,'content_catalog_save_v1',body,id());assert(created.primary_id);
 const again=await must(platform,'content_catalog_save_v1',body,id());assert.equal(again.primary_id,created.primary_id);
 const denied=await call(user,'content_catalog_save_v1',{...body,version:101},id());assert.equal(denied.result.error.code,'FORBIDDEN');
 const otherSource=await call(platform,'content_catalog_save_v1',{...body,source_version:'other',content:{title:'other',text:'{{app_url}}'}},id());assert.equal(otherSource.result.error.code,'VERSION_CONFLICT');
 const changed=await call(platform,'content_catalog_save_v1',{...body,content:{title:'changed',text:'{{app_url}}'}},id());assert.equal(changed.result.error.code,'VERSION_CONFLICT');
 const read=await must(platform,'content_catalog_get_v1',{scope_key:'platform',code:entry.code,channel:entry.channel});assert(read.items.some(t=>t.id===created.primary_id&&t.language==='qad'));
 // Publication command sends data to the same native API; auth is never bypassed.
 const {context}=await import('./api-client.mjs');const {env}=context();
 await publishContent({url:env.API_URL,key:env.PUBLISHABLE_KEY??env.ANON_KEY,token:platform.jwt,entries:[{...body,version:102}],send:fetch});
});
