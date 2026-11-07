import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptCalendar} from '../scripts/acceptance/s15-hosted-calendar.mjs';

for(const failure of ['route','calendar_link_create_v1','calendar_link_rotate_v1','calendar_link_revoke_v1'])test('hosted calendar runner recovers '+failure+' without changing unrelated subscriptions',async()=>{
 const origin='https://gwyprhenabtpkbojephw.supabase.co',id='019a0000-0000-7000-8000-000000000001',other='019a0000-0000-7000-8000-000000000002',org='019a0000-0000-7000-8000-000000000003';
 let active=false,version=0,token='1'.repeat(64),failed=false,loggedOut=false;const receipts=new Map(),revoked=[];
 const credential=()=>({link:{id,version},subscription_url:origin+'/functions/v1/personal-calendar/calendar/'+token+'.ics'});
 const ics='BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nURL:https://uye.fethiyetango.com/organizasyon/'+org+'/seans/'+id+'\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
 const request=async(url,options)=>{
  if(url.includes('/calendar/')){assert.equal(options.headers,undefined);assert.equal(options.redirect,'error');const ok=active&&url.includes(token);return new Response(options.method==='HEAD'?null:ok?ics:'Not found',{status:ok?200:404,headers:{'cache-control':'private, no-store','content-type':'text/calendar','content-length':String(Buffer.byteLength(ics))}});}
  if(url.includes('/auth/v1/token?'))return Response.json({access_token:'synthetic-auth-token'});
  if(url.includes('/auth/v1/logout?')){loggedOut=true;return new Response(null,{status:204});}
  const op=url.split('/').at(-1),body=JSON.parse(options.body);let data;
  if(op==='organizations_list_v1')data={items:[{id:org,self_context:{person_id:id,centers:[]}}]};
  else if(op==='calendar_links_get_v1')data={service_ready:true,items:[{id:other},...(active?[{id}]:[])]};
  else if(receipts.has(body.operation_key))data={...receipts.get(body.operation_key),replayed:true};
  else if(op==='calendar_link_create_v1'){active=true;version=1;data=credential();}
  else if(op==='calendar_link_rotate_v1'){
   if(body.expected_version!==version)return Response.json({ok:false,error:{code:'VERSION_CONFLICT'}});
   version++;token='2'.repeat(64);data=credential();
  }else if(op==='calendar_link_revoke_v1'){assert.equal(body.link_id,id);assert.equal(body.expected_version,version);active=false;revoked.push(id);data={replayed:false};}
  else throw Error('Unexpected request');
  if(body.operation_key)receipts.set(body.operation_key,data);
  if(op===failure&&!failed){failed=true;throw Error('Synthetic response loss after commit');}
  return Response.json({ok:true,data});
 };
 await assert.rejects(acceptCalendar({email:'synthetic@example.invalid',password:'synthetic-only',apikey:'synthetic-public',org,request,checkRoute:failure==='route'?async()=>{throw Error('Synthetic route failure');}:undefined}),/Hosted calendar acceptance failed/);
 assert.equal(active,false);assert.deepEqual(revoked,[id]);assert(!revoked.includes(other));assert.equal(loggedOut,true);
});
