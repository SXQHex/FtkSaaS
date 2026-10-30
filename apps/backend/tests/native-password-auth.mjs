// CLI 2.122 native mode omits current-password enforcement and rejects content_path.
// Run its exact Auth binary with supported native settings; never patch or restart
// a CLI-owned process. Only the local acceptance suite imports this helper.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {passwordNotification,passwordSecurityConfig as policy} from '../scripts/auth-password-security.mjs';

const loopback=host=>['localhost','127.0.0.1','[::1]'].includes(host);
const dbAddress=value=>{const url=new URL(value);if(!loopback(url.hostname))throw Error('LOCAL_DB_REQUIRED');return url.host+url.pathname;};
export function findNativeAuth(status){
 if(process.platform!=='linux')throw Error('LINUX_NATIVE_AUTH_ACCEPTANCE_REQUIRED');
 const target=dbAddress(status.env.DB_URL),smtp=status.endpoints?.['mail.smtp'];
 if(!smtp||!loopback(smtp.address))throw Error('LOCAL_SMTP_REQUIRED');
 const matches=[];
 for(const entry of fs.readdirSync('/proc')){
  if(!/^\d+$/.test(entry))continue;
  try{
   const executable=fs.readlinkSync('/proc/'+entry+'/exe');
   if(!['auth','gotrue'].includes(path.basename(executable)))continue;
   const env=Object.fromEntries(fs.readFileSync('/proc/'+entry+'/environ','utf8').split('\0').filter(Boolean).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
   if(dbAddress(env.GOTRUE_DB_DATABASE_URL)!==target||!loopback(env.GOTRUE_API_HOST)||!loopback(env.GOTRUE_SMTP_HOST)||Number(env.GOTRUE_SMTP_PORT)!==smtp.port)continue;
   const endpoint=status.endpoints?.['auth.http'];
   if(endpoint&&Number(env.GOTRUE_API_PORT)!==endpoint.port)continue;
   matches.push({executable,env});
  }catch{/* Unrelated, inaccessible or already exited processes are not candidates. */}
 }
 if(matches.length!==1)throw Error('EXACT_LOCAL_NATIVE_AUTH_PROCESS_REQUIRED');
 return matches[0];
}
export async function startPasswordAuth(t,status){
 const original=findNativeAuth(status);
 const directory=fs.mkdtempSync(path.resolve('.dev/password-auth-'));fs.chmodSync(directory,0o700);
 const log=fs.openSync(path.join(directory,'auth.log'),'w',0o600);
 const template=createServer((req,res)=>{if(req.url!=='/password-notification'){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(passwordNotification);});
 let child;
 t.after(async()=>{
  if(child?.pid&&child.exitCode===null&&child.signalCode===null){
   const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');
   const timer=setTimeout(()=>child.kill('SIGKILL'),2000);await exited;clearTimeout(timer);
  }
  template.closeAllConnections();await new Promise(resolve=>template.close(resolve));
  fs.closeSync(log);fs.rmSync(directory,{recursive:true,force:true});
 });
 await new Promise((resolve,reject)=>{template.once('error',reject);template.listen(0,'127.0.0.1',resolve);});
 const reserve=createServer();await new Promise((resolve,reject)=>{reserve.once('error',reject);reserve.listen(0,'127.0.0.1',resolve);});
 const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
 const origin='http://127.0.0.1:'+port;
 const env={...original.env,
  GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:String(port),
  GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD:String(policy.security_update_password_require_current_password),
  GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION:String(policy.security_update_password_require_reauthentication),
  GOTRUE_MAILER_NOTIFICATIONS_PASSWORD_CHANGED_ENABLED:String(policy.mailer_notifications_password_changed_enabled),
  GOTRUE_MAILER_SUBJECTS_PASSWORD_CHANGED_NOTIFICATION:policy.mailer_subjects_password_changed_notification,
  GOTRUE_MAILER_TEMPLATES_PASSWORD_CHANGED_NOTIFICATION:'http://127.0.0.1:'+template.address().port+'/password-notification',
  GOTRUE_MAILER_OTP_EXP:String(policy.mailer_otp_exp),
 };
 const version=spawnSync(original.executable,['version'],{env,encoding:'utf8'});
 if(version.status!==0)throw Error('NATIVE_AUTH_VERSION_FAILED');
 t.diagnostic('Native Auth '+version.stdout.trim()+'; sha256='+createHash('sha256').update(fs.readFileSync(original.executable)).digest('hex')+'; current_password=true; reauthentication=true; recovery_ttl='+policy.mailer_otp_exp);
 child=spawn(original.executable,['serve'],{cwd:directory,env,stdio:['ignore',log,log]});
 let spawnError;child.once('error',error=>{spawnError=error;});
 for(let attempt=0;attempt<100;attempt++){
  if(spawnError||child.exitCode!==null)throw Error('NATIVE_AUTH_START_FAILED');
  try{if((await fetch(origin+'/health',{signal:AbortSignal.timeout(500)})).ok)return {origin,siteURL:env.GOTRUE_SITE_URL};}catch{}
  await delay(100);
 }
 throw Error('NATIVE_AUTH_HEALTH_TIMEOUT');
}
