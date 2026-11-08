import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptDigital} from '../scripts/acceptance/s10-hosted-digital.mjs';

const inputs={email:'owner@example.invalid',password:'synthetic-password',outsiderEmail:'outsider@example.invalid',outsiderPassword:'synthetic-other',apikey:'synthetic-publishable',org:'org',center:'center',product:'product',agreement:'agreement'};
function fixture({accepted=false,affected=[],secondLoginFails=false,logoutFails=false}={}){
 const calls=[];let logins=0;
 const request=async(url,options)=>{
  assert.equal(new URL(url).origin,'https://gwyprhenabtpkbojephw.supabase.co');
  const body=options.body?JSON.parse(options.body):null;calls.push({url,body,token:options.headers.authorization});
  if(url.includes('/token?')){
   logins++;
   if(secondLoginFails&&logins===2)throw Error('sensitive provider response');
   return Response.json({access_token:'synthetic-session-'+logins});
  }
  if(url.includes('/logout?')){
   assert(url.endsWith('scope=local'));
   if(logoutFails)throw Error('sensitive logout response');
   return new Response(null,{status:204});
  }
  const op=url.split('/').at(-1);
  assert.equal(body.operation_key,undefined,'Read operations must not carry mutation keys');
  if(options.headers.authorization==='Bearer synthetic-session-2')return Response.json({ok:false,error:{code:'NOT_FOUND'}});
  const data=op==='instructor_agreement_get_v1'?{agreement:{id:'agreement',center_id:'center',person_id:'self'},source_content_hash:'source',acceptance:accepted?{id:'previous'}:null}
   :op==='management_state_get_v1'?{items:[{current:{values:{source_content_hash:'source'}}}]}
   :op==='document_publication_preview_v1'?{affected}:null;
  assert.notEqual(data,null,'Unexpected durable operation: '+op);
  return Response.json({ok:true,data});
 };
 return {request,calls,logouts:()=>calls.filter(x=>x.url.includes('/logout?'))};
}
test('Digital hosted runner closes a first session when the second login fails and redacts provider errors',async()=>{
 const f=fixture({secondLoginFails:true});
 await assert.rejects(acceptDigital({...inputs,request:f.request}),{message:'Hosted digital acceptance failed at login'});
 assert.equal(f.logouts().length,1);assert.equal(f.logouts()[0].token,'Bearer synthetic-session-1');
 assert.equal(f.calls.some(x=>x.url.includes('/functions/')),false);
});
test('Digital hosted runner refuses an already accepted agreement before creating durable records',async()=>{
 const f=fixture({accepted:true});
 await assert.rejects(acceptDigital({...inputs,request:f.request}),{message:'Hosted digital acceptance failed at agreement preflight'});
 assert.equal(f.logouts().length,2);assert.equal(f.calls.some(x=>x.url.includes('document_')),false);
});
test('Digital hosted publication is confined to one product and refuses affected reservations',async()=>{
 const f=fixture({affected:[{synthetic:'existing reservation'}]});
 await assert.rejects(acceptDigital({...inputs,request:f.request}),{message:'Hosted digital acceptance failed at publication'});
 const preview=f.calls.find(x=>x.url.endsWith('document_publication_preview_v1'));
 assert.deepEqual(preview.body.requirements,[{gate:'sale',scope:{center_ids:['center'],product_version_ids:['product']},renewed_acceptance:true}]);
 assert.equal(preview.body.org_id,'org');assert.equal(preview.body.center_id,'center');
 assert.equal(preview.body.file_id,undefined);assert.equal(f.calls.some(x=>x.url.endsWith('document_version_publish_v1')),false);
 assert.equal(f.logouts().length,2);
});
test('Digital hosted runner attempts both local logouts even if one fails and reports cleanup failure',async()=>{
 const f=fixture({accepted:true,logoutFails:true});
 await assert.rejects(acceptDigital({...inputs,request:f.request}),{message:'Hosted digital acceptance local-session cleanup failed'});
 assert.equal(f.logouts().length,2);
});
test('Digital hosted runner rejects the same native account for the outsider before sending credentials',async()=>{
 let requests=0;
 await assert.rejects(acceptDigital({...inputs,outsiderEmail:inputs.email,request:async()=>{requests++;}}),/Distinct native accounts required/);
 assert.equal(requests,0);
});
