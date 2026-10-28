import test from 'node:test';import assert from 'node:assert/strict';
import {build} from 'esbuild';
const built=await build({entryPoints:['supabase/functions/backend-v1/calendar-feed.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {calendarFeed}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const item={id:'019a1b2c-1234-7000-8000-000000000001',org_id:'019a1b2c-1234-7000-8000-000000000002',version:7,title:'Çağrı, Yoga; \\ '+('İğüş🩰'.repeat(22))+'\r\nBEGIN:VALARM',location:'Salon\nKat 2',starts_at:'2026-10-28T01:30:00+03:00',ends_at:'2026-10-28T02:30:00+03:00',app_url:'https://app.ftksaas.invalid/lesson/019a1b2c-1234-7000-8000-000000000001'};
const stamp='2026-10-27T20:00:00Z',encode=items=>calendarFeed(items,stamp,2097152);
test('personal calendar encoder preserves UTC, UTF-8 folding and a closed privacy projection',()=>{
 const bytes=encode([{...item,email:'must-not-leak@ftksaas.invalid',debt_minor:'12345',attendees:['private']}]),text=new TextDecoder('utf8',{fatal:true}).decode(bytes);
 assert(text.endsWith('END:VCALENDAR\r\n'));for(const line of text.split('\r\n'))assert(Buffer.byteLength(line)<=75);
 const unfolded=text.replace(/\r\n[ \t]/g,'');assert(unfolded.includes('DTSTART:20261027T223000Z\r\n'));assert(unfolded.includes('DTEND:20261027T233000Z\r\n'));assert(unfolded.includes('SEQUENCE:7\r\n'));assert(unfolded.includes('SUMMARY:Çağrı\\, Yoga\\; \\\\ '));assert(unfolded.includes('\\nBEGIN:VALARM\r\n'));assert(!text.includes('\r\nBEGIN:VALARM'));assert(!text.includes('must-not-leak'));assert(!text.includes('12345'));assert(!text.includes('ATTENDEE:'));assert(!text.includes('VALARM\r\nEND:VALARM'));
 assert.equal((unfolded.match(/BEGIN:VEVENT/g)||[]).length,1);assert(unfolded.includes(item.org_id+':'+item.id+'@ftksaas'));
 assert.deepEqual(encode([item]),encode([item]));assert(!new TextDecoder().decode(encode([])).includes('VEVENT'));
});
test('calendar encoder rejects injected links, duplicate identifiers, invalid intervals and overflow without truncation',()=>{
 for(const app_url of ['javascript:alert(1)','https://user:password@example.invalid','https://safe.invalid/\r\nATTENDEE:secret','http://external.invalid/'])assert.throws(()=>encode([{...item,app_url}]),/INVALID_CALENDAR_URL/);
 assert.throws(()=>encode([item,item]),/DUPLICATE_CALENDAR_ITEM/);assert.throws(()=>encode([{...item,ends_at:item.starts_at}]),/INVALID_CALENDAR_INTERVAL/);assert.throws(()=>encode([{...item,starts_at:'not-time'}]),/INVALID_CALENDAR_TIME/);assert.throws(()=>encode([{...item,version:-1}]),/INVALID_CALENDAR_ITEM/);assert.throws(()=>calendarFeed([item],stamp,10),/CALENDAR_TOO_LARGE/);
});
const tokenBuild=await build({entryPoints:['supabase/functions/backend-v1/calendar-token.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {calendarToken,calendarTokenHash,calendarOrigin,calendarSubscriptionUrl,calendarAppUrl}=await import('data:text/javascript;base64,'+Buffer.from(tokenBuild.outputFiles[0].text).toString('base64'));
test('calendar token material is bound to account, organization, command and operation key; origin has no implicit default',async()=>{
 const secret='01'.repeat(32),auth=item.id,org=item.org_id,key='019a1b2c-1234-7000-8000-000000000003';
 const first=await calendarToken(secret,auth,org,'calendar_link_create_v1',key);assert.match(first.token,/^[a-f0-9]{64}$/);assert.notEqual(first.token,first.hash);assert.equal(first.hash,await calendarTokenHash(first.token));assert.deepEqual(first,await calendarToken(secret,auth.toUpperCase(),org.toUpperCase(),'calendar_link_create_v1',key.toUpperCase()));
 for(const args of [[secret,auth,org,'calendar_link_rotate_v1',key],['02'.repeat(32),auth,org,'calendar_link_create_v1',key],[secret,org,auth,'calendar_link_create_v1',key],[secret,auth,org,'calendar_link_create_v1','019a1b2c-1234-7000-8000-000000000004']])assert.notEqual((await calendarToken(...args)).token,first.token);
 for(const origin of [undefined,'javascript:alert(1)','http://external.invalid/','https://user:pass@external.invalid/','https://external.invalid/subpath','https://external.invalid/?secret=x'])assert.throws(()=>calendarOrigin(origin),/CALENDAR_NOT_CONFIGURED/);
 assert.equal(calendarSubscriptionUrl('http://127.0.0.1:1234',first.token),'http://127.0.0.1:1234/calendar/'+first.token+'.ics');await assert.rejects(calendarToken(undefined,auth,org,'calendar_link_create_v1',key),/CALENDAR_NOT_CONFIGURED/);await assert.rejects(calendarToken(secret,auth,org,'settings_update_v1',key),/INVALID_CALENDAR_TOKEN_CONTEXT/);
});
const {calendarProxy}=await import('../transports/calendar-proxy.mjs');
test('calendar HTTP adapter supplies only the public JWT and closes invalid, revoked or oversized feeds',async()=>{
 const token='ab'.repeat(32),ics=Buffer.from(encode([item]));let calls=0;
 const handle=calendarProxy({supabaseUrl:'http://127.0.0.1:54321',anonKey:'synthetic-public-anon-jwt',fetcher:async(url,options)=>{calls++;assert.equal(url,'http://127.0.0.1:54321/functions/v1/backend-v1/calendar_feed_get_v1');assert.equal(options.headers.authorization,'Bearer synthetic-public-anon-jwt');const body=JSON.parse(options.body);assert.equal(body.token,token);assert.deepEqual(Object.keys(body).sort(),['client_api_version','request_id','token']);return Response.json({ok:true,data:{ics_base64:ics.toString('base64')}});}});
 const request=method=>new Request('https://calendar.ftksaas.invalid/calendar/'+token+'.ics',{method});const result=await handle(request('GET'));assert.equal(result.status,200);assert.match(result.headers.get('content-type'),/^text\/calendar/);assert.match(result.headers.get('cache-control'),/no-store/);assert.deepEqual(Buffer.from(await result.arrayBuffer()),ics);assert.equal((await handle(request('HEAD'))).status,200);
 assert.equal((await handle(request('POST'))).status,405);assert.equal((await handle(new Request('https://calendar.ftksaas.invalid/calendar/'+token+'.ics?extra=x'))).status,404);assert.equal(calls,2);
 for(const [reply,status] of [[{ok:false,error:{code:'NOT_FOUND'}},404],[{ok:false,error:{code:'FORBIDDEN'}},404],[{ok:true,data:{ics_base64:'invalid'}},503],[{ok:true,data:{ics_base64:Buffer.alloc(2097153).toString('base64')}},503]]){
  const closed=calendarProxy({supabaseUrl:'https://project.supabase.invalid',anonKey:'synthetic-public-anon-jwt',fetcher:async()=>Response.json(reply)});assert.equal((await closed(request('GET'))).status,status);
 }
});

test('calendar application deep link requires an explicit route template and safe typed identifiers',()=>{
 const template='https://app.ftksaas.invalid/org/{org_id}/session/{session_id}';assert.equal(calendarAppUrl(template,item.org_id,item.id),'https://app.ftksaas.invalid/org/'+item.org_id+'/session/'+item.id);
 for(const value of [undefined,'https://app.ftksaas.invalid/session/{session_id}','javascript:{org_id}{session_id}','https://app.ftksaas.invalid/{org_id}/{session_id}/{actor_id}'])assert.throws(()=>calendarAppUrl(value,item.org_id,item.id),/CALENDAR_NOT_CONFIGURED/);
});
