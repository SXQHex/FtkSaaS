import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {findNativeAuth} from './native-password-auth.mjs';
import {configurePasswordSecurity,developmentProject,passwordSecurityConfig as policy,passwordNotification} from '../scripts/auth-password-security.mjs';

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
 const methods=[];let state={site_url:'https://account.ftksaas.invalid',smtp_pass:'must-stay-private',...policy,security_update_password_require_current_password:false};
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

test('native Auth discovery distinguishes the private listener from the public API proxy and rejects foreign or ambiguous processes',{skip:process.platform!=='linux'},async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'native-auth-discovery-')),executable=path.join(directory,'auth'),children=[];
 // A real /proc process fixture tests discovery only; it does not stand in for Auth acceptance.
 fs.copyFileSync('/bin/sleep',executable);
 const port=40000+Math.floor(Math.random()*10000),database='/discovery_'+path.basename(directory),db='postgresql://fixture:synthetic@127.0.0.1:'+port+database;
 const status={env:{DB_URL:db},endpoints:{'mail.smtp':{address:'127.0.0.1',port:port+1},'auth.http':{address:'127.0.0.1',port:port+2}}};
 const env={...process.env,GOTRUE_DB_DATABASE_URL:db,GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:String(port+3),GOTRUE_SMTP_HOST:'127.0.0.1',GOTRUE_SMTP_PORT:String(port+1)};
 const launch=async()=>{const child=spawn(executable,['60'],{env,stdio:'ignore'});children.push(child);await once(child,'spawn');};
 try{
  await launch();assert.equal(findNativeAuth(status).executable,executable);
  assert.throws(()=>findNativeAuth({...status,env:{DB_URL:db+'-foreign'}}),/EXACT_LOCAL_NATIVE_AUTH_PROCESS_REQUIRED/);
  assert.throws(()=>findNativeAuth({...status,endpoints:{...status.endpoints,'mail.smtp':{address:'127.0.0.1',port:port+4}}}),/EXACT_LOCAL_NATIVE_AUTH_PROCESS_REQUIRED/);
  await launch();assert.throws(()=>findNativeAuth(status),/EXACT_LOCAL_NATIVE_AUTH_PROCESS_REQUIRED/);
 }finally{
  await Promise.all(children.map(async child=>{if(child.exitCode!==null||child.signalCode!==null)return;const exited=once(child,'exit');child.kill();await exited;}));
  fs.rmSync(directory,{recursive:true,force:true});
 }
});
