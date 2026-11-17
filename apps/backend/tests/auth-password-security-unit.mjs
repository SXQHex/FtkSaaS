import test from 'node:test';
import assert from 'node:assert/strict';
import {configurePasswordSecurity,developmentProject,passwordSecurityConfigForSite,passwordNotification} from '../scripts/auth-password-security.mjs';

const policy=passwordSecurityConfigForSite('https://account.ftksaas.invalid');

test('password security deployment is development-only, read-only by default and refuses unsafe site origins',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({...policy,site_url:'https://account.ftksaas.invalid'});};
 await assert.rejects(configurePasswordSecurity({project:'another-project',token:'synthetic',fetcher}),/DEVELOPMENT/);assert.equal(calls,0);
 await assert.rejects(configurePasswordSecurity({project:developmentProject,fetcher}),/TOKEN/);assert.equal(calls,0);
 const result=await configurePasswordSecurity({project:developmentProject,token:'synthetic',fetcher});assert(result.verified);assert.equal(calls,1);
 for(const site_url of ['http://account.ftksaas.invalid','https://account.ftksaas.invalid/nested','https://account.ftksaas.invalid/?next=bad','https://user:pass@account.ftksaas.invalid']){
  await assert.rejects(configurePasswordSecurity({project:developmentProject,mode:'apply',token:'synthetic',fetcher:async(url,init)=>{assert.equal(init.method,'GET');return Response.json({site_url});}}),/TRUSTED_SITE/);
 }
});
test('password security applies only owned keys and independently reads back configuration',async()=>{
 const methods=[];let state={site_url:'https://account.ftksaas.invalid',smtp_pass:'must-stay-private'};
 const fetcher=async(url,init)=>{
  methods.push(init.method);assert.equal(url,'https://api.supabase.com/v1/projects/'+developmentProject+'/config/auth');
  if(init.method==='PATCH'){assert.deepEqual(JSON.parse(init.body),policy);state={...state,...JSON.parse(init.body)};return Response.json({});}
  return Response.json(state);
 };
 const result=await configurePasswordSecurity({project:developmentProject,mode:'apply',token:'synthetic',fetcher});assert(result.verified);assert.deepEqual(methods,['GET','PATCH','GET']);assert(!JSON.stringify(result).includes(state.smtp_pass));
 const drift=await configurePasswordSecurity({project:developmentProject,mode:'apply',token:'synthetic',fetcher:async()=>Response.json({site_url:state.site_url})});assert.equal(drift.verified,false);assert(drift.remaining.includes('security_update_password_require_current_password'));
 await assert.rejects(configurePasswordSecurity({project:developmentProject,token:'synthetic',fetcher:async()=>new Response('secret',{status:500})}),/^Error: AUTH_CONFIG_HTTP_500$/);
});
test('security notice is informational with one trusted token-free recovery entry',()=>{
 assert.deepEqual([...passwordNotification.matchAll(/href="([^"]+)"/g)].map(x=>x[1]),['{{ .SiteURL }}/forgot-password']);
 assert.deepEqual([...passwordNotification.matchAll(/{{\s*([^}]+?)\s*}}/g)].map(x=>x[1].trim()),['.SiteURL']);
 assert.equal(policy.security_update_password_require_current_password,true);assert.equal(policy.security_update_password_require_reauthentication,true);assert.equal(policy.mailer_otp_exp,3600);
});

test('development applies a canonical notice URL for either SiteURL form and detects later drift',async()=>{
 const key='mailer_templates_password_changed_notification_content';
 const expectedHref='https://app.fethiyetango.com/forgot-password';
 const origin='https://app.fethiyetango.com';
 for(const site_url of [origin,origin+'/']){
  const uri_allow_list=origin+'/auth/callback,'+origin+'/auth/callback?next=/reset-password';
  let state={...policy,site_url,uri_allow_list,[key]:passwordNotification};
  const fetcher=async(url,init)=>{
   if(init.method==='PATCH'){
    const patch=JSON.parse(init.body);
    assert.deepEqual(Object.keys(patch),[key]);
    assert.deepEqual([...patch[key].matchAll(/href="([^"]+)"/g)].map(match=>match[1]),[expectedHref]);
    assert.doesNotMatch(patch[key],/{{/);
    state={...state,...patch};
   }
   return Response.json(state);
  };
  const input={project:developmentProject,token:'synthetic',fetcher};
  const result=await configurePasswordSecurity({...input,mode:'apply'});
  assert(result.verified);
  assert.deepEqual(result.changed,[key]);
  assert.equal(state.site_url,site_url);
  assert.equal(state.uri_allow_list,uri_allow_list);
  state={...state,site_url:'https://different.ftksaas.invalid/'};
  const drift=await configurePasswordSecurity(input);
  assert.equal(drift.verified,false);
  assert.deepEqual(drift.remaining,[key]);
 }
});
