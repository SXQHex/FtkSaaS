// Transport doubles verify runner safety, not hosted Turnstile acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {acceptPublicApplication} from '../scripts/acceptance/s14-hosted-public.mjs';
import {signPublicApplication} from '../scripts/p04-public-ingress.mjs';
const id=n=>'019a4c1d-7000-7000-8000-'+String(n).padStart(12,'0');
const config={org:id(1),center:id(2),session:id(3),publication:id(4),email:'owner@example.invalid',password:'synthetic-password',apikey:'header.'+Buffer.from(JSON.stringify({role:'anon',ref:'gwyprhenabtpkbojephw'})).toString('base64url')+'.signature',ingressSecret:randomBytes(32).toString('hex'),clientIp:'192.0.2.17',botProof:'synthetic-unit-proof'};
let nativeSequence=100;
function fixture(fault={}){
 const data={calls:[],states:[],submitted:0,reviewed:0,logout:0,revoked:false,application:null,sessions:new Map(),loginCount:0,current:null,revokedIds:[]};
 const row=()=>({entity:{type:'public_applications',id:id(5)},state:data.application,versions:[{entity:{type:'public_applications',id:id(5)},version:1}],current:{values:{publication_id:config.publication,contact:data.contact,person_id:null}}});
 const request=async(url,options)=>{
  const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):{};data.calls.push({path,body});
  if(path==='/auth/v1/token'){data.revoked=false;data.loginCount++;data.current=id(++nativeSequence);data.sessions.set(data.current,{session_id:data.current,created_at:'2026-11-12T13:00:00Z'});return Response.json({access_token:'header.'+Buffer.from(JSON.stringify({session_id:data.current,sub:id(7)})).toString('base64url')+'.signature'});}
  if(path==='/auth/v1/logout'){data.logout++;if(!fault.logout){data.revoked=true;data.sessions.delete(data.current);}return new Response(null,{status:fault.logout?500:204});}
  const op=path.split('/').at(-1);
  if(op==='account_get_v1')return data.revoked?Response.json({ok:false,error:{code:'AUTH_REQUIRED'}},{status:401}):Response.json({ok:true,data:{id:id(6)}});
  if(op==='account_sessions_list_v1')return Response.json({ok:true,data:{items:[...data.sessions.values()].map(s=>({...s,current:s.session_id===data.current})),next_cursor:null}});
  if(op==='account_sessions_revoke_v1'){assert.equal(body.mode,'selected');assert.notEqual(body.session_id,data.current);data.revokedIds.push(body.session_id);if(!fault.revokeStaysActive)data.sessions.delete(body.session_id);return Response.json({ok:true,data:{}});}
  if(op==='management_state_get_v1'){
   if(body.operation==='publication_set_v1')return Response.json({ok:true,data:{items:[{entity:{id:config.publication},current:{values:{published:!fault.unpublished,session_id:config.session}}}]}});
   const items=data.application?[row()]:[];
   if(fault.duplicate&&items.length)items.push(row());
   if(fault.foreign&&items.length)items[0].current.values.publication_id=id(99);
   return Response.json({ok:true,data:{items,next_cursor:null}});
  }
  if(op==='public_application_submit_v1'){
   assert.equal(options.headers.authorization,'Bearer '+config.apikey);
   assert.equal(body.bot_proof,config.botProof);
   const expected=signPublicApplication(options.body,config.clientIp,config.ingressSecret);
   assert.equal(options.headers['x-ftk-ingress-signature'],expected['x-ftk-ingress-signature']);
   if(fault.submit)return Response.json({ok:false,error:{code:'BOT_VERIFICATION_FAILED'}});
   if(!data.application){data.submitted++;data.contact=body.contact;data.application='pending';}
   return Response.json({ok:true,data:{accepted:true}});
  }
  if(op==='public_application_review_v1'){
   assert.equal(body.application_id,id(5));assert.equal(body.action,'close');assert.equal(body.expected_version,1);
   if(data.application!=='closed'){data.reviewed++;data.application='closed';if(fault.reviewResponseLost){fault.reviewResponseLost=false;throw Error('private provider response must not escape');}}
   return Response.json({ok:true,data:{primary_id:fault.wrongReview?id(99):id(5),replayed:data.reviewed>0}});
  }
  throw Error('Unexpected operation');
 };
 const options={request,saveState:async s=>{if(fault.save)throw Error('private state failure');data.states.push(structuredClone(s));}};
 return {data,options};
}
test('S14 runner completes signed transport, one inbox row, guarded close and local logout',async()=>{
 const {data,options}=fixture();const result=await acceptPublicApplication(config,options);
 assert.equal(result.status,'passed');assert.equal(result.fixtureRetirementRequired,true);
 assert.equal(data.submitted,1);assert.equal(data.reviewed,1);assert.equal(data.logout,1);
 assert.equal(data.states.at(-1).applicationClosed,true);
 assert.equal(JSON.stringify(result).includes(config.password),false);
});
test('S14 runner requires explicit real proof, trusted signing inputs and durable state before network',async()=>{
 for(const patch of [{botProof:''},{clientIp:'1.2.3.4, 5.6.7.8'},{ingressSecret:'short'},{apikey:'sb_publishable_synthetic'},{publication:null}]){
  const {data,options}=fixture();await assert.rejects(acceptPublicApplication({...config,...patch},options));assert.equal(data.calls.length,0);
 }
 const {data,options}=fixture();await assert.rejects(acceptPublicApplication(config,{...options,saveState:undefined}),/DURABLE_STATE/);assert.equal(data.calls.length,0);
});
test('S14 runner preserves failed provider, duplicate/foreign inbox, wrong review and cleanup failures',async()=>{
 for(const fault of [{unpublished:true},{submit:true},{duplicate:true},{foreign:true},{wrongReview:true},{logout:true},{save:true}]){
  const {data,options}=fixture(fault);await assert.rejects(acceptPublicApplication(config,options),/PUBLIC_ACCEPTANCE_/);
  assert.equal(data.logout,1);
  if(fault.unpublished||fault.save)assert.equal(data.submitted,0);
  if(fault.duplicate||fault.foreign)assert.equal(data.reviewed,0);
 }
});
test('S14 runner resumes response-lost review with the same intent and review key',async()=>{
 const {data,options}=fixture({reviewResponseLost:true});await assert.rejects(acceptPublicApplication(config,options),/EXPLICIT_VERSIONED_REVIEW/);
 const state=structuredClone(data.states.at(-1));assert(state.reviewRequest);
 const result=await acceptPublicApplication(config,{...options,state});assert.equal(result.status,'passed');
 assert.equal(data.submitted,1);assert.equal(data.reviewed,1);assert.equal(data.logout,2);
 const keys=data.calls.filter(x=>x.path.endsWith('/public_application_review_v1')).map(x=>x.body.operation_key);assert.equal(keys[0],keys[1]);
});
test('S14 runner rejects resumed state redirected to another fixture or review target',async()=>{
 const first=fixture({reviewResponseLost:true});await assert.rejects(acceptPublicApplication(config,first.options));
 const state=structuredClone(first.data.states.at(-1));state.reviewRequest.application_id=id(99);
 const next=fixture();next.data.application='closed';next.data.contact='s14-'+state.clientRequestKey+'@example.invalid';
 await assert.rejects(acceptPublicApplication(config,{...next.options,state}),/EXPLICIT_VERSIONED_REVIEW|INBOX_OWNERSHIP/);
 assert.equal(next.data.reviewed,0);
 const changed={...state,fixture:{...state.fixture,org:id(99)}};const guard=fixture();
 await assert.rejects(acceptPublicApplication(config,{...guard.options,state:changed}),/FIXTURE_CHANGED/);assert.equal(guard.data.calls.length,0);
});
test('S14 runner recovers logout500 by revoking only its recorded prior session',async()=>{
 const fault={logout:true},{data,options}=fixture(fault);
 await assert.rejects(acceptPublicApplication(config,options),/SESSION_CLEANUP_UNCONFIRMED/);
 const state=structuredClone(data.states.at(-1)),old=data.current;
 assert.equal(state.applicationClosed,true);assert.equal(state.sessions[0].cleanupConfirmed,false);assert(data.sessions.has(old));
 const untouched=id(999);data.sessions.set(untouched,{session_id:untouched,created_at:'2026-11-12T04:40:12.1928Z'});
 fault.logout=false;
 const result=await acceptPublicApplication(config,{...options,state});assert.equal(result.status,'passed');
 assert.deepEqual(data.revokedIds,[old]);assert.deepEqual([...data.sessions.keys()],[untouched]);
 assert(data.states.at(-1).sessions.every(s=>s.cleanupConfirmed));
 assert.equal(data.submitted,1);assert.equal(data.reviewed,1);
});
test('S14 runner cannot pass while a prior recorded session remains active after revoke',async()=>{
 const fault={logout:true},{data,options}=fixture(fault);
 await assert.rejects(acceptPublicApplication(config,options),/SESSION_CLEANUP_UNCONFIRMED/);
 const state=structuredClone(data.states.at(-1)),old=data.current;fault.logout=false;fault.revokeStaysActive=true;
 await assert.rejects(acceptPublicApplication(config,{...options,state}),/RECORDED_SESSION_RECOVERY/);
 assert(data.sessions.has(old));assert.equal(data.states.at(-1).sessions.find(s=>s.id===old).cleanupConfirmed,false);
 assert.equal(data.submitted,1);assert.equal(data.reviewed,1);
});
