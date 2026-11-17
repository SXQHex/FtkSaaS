import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Existing development project only; production provisioning is outside this task.
export const developmentProject='gwyprhenabtpkbojephw';
export const passwordNotification=fs.readFileSync(new URL('../supabase/templates/password_changed_notification.html',import.meta.url),'utf8');
export const passwordSecurityConfig=Object.freeze({
 security_update_password_require_current_password:true,
 security_update_password_require_reauthentication:true,
 mailer_notifications_password_changed_enabled:true,
 mailer_subjects_password_changed_notification:'Parolanız değiştirildi',
 mailer_otp_exp:3600,
});
const templateKey='mailer_templates_password_changed_notification_content';

export function passwordSecurityConfigForSite(siteUrl){
 const site=URL.parse(siteUrl);
 if(!site||site.protocol!=='https:'||site.username||site.password||site.search||site.hash||site.pathname!=='/')throw Error('TRUSTED_SITE_ORIGIN_REQUIRED');
 const recoveryUrl=new URL('/forgot-password',site).href;
 const template=passwordNotification.replace('href="{{ .SiteURL }}/forgot-password"',()=>`href="${recoveryUrl}"`);
 return {...passwordSecurityConfig,[templateKey]:template};
}

function configDifferences(actual,desired){
 return Object.keys(desired).filter(key=>actual[key]!==desired[key]);
}
export async function configurePasswordSecurity({project,mode='check',token,fetcher=fetch}){
 if(project!==developmentProject)throw Error('DEVELOPMENT_PROJECT_REQUIRED');
 if(!['check','apply'].includes(mode))throw Error('INVALID_MODE');
 if(!token)throw Error('SUPABASE_ACCESS_TOKEN_REQUIRED');
 const endpoint='https://api.supabase.com/v1/projects/'+project+'/config/auth';
 const request=async(method,body)=>{
  const res=await fetcher(endpoint,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw Error('AUTH_CONFIG_HTTP_'+res.status); // Never print a config response or secret.
  return res.json();
 };
 const before=await request('GET');
 const desired=passwordSecurityConfigForSite(before.site_url);
 const changed=configDifferences(before,desired);
 if(mode==='apply'&&changed.length){
  await request('PATCH',Object.fromEntries(changed.map(key=>[key,desired[key]])));
 }
 const after=mode==='apply'?await request('GET'):before;
 const expected=passwordSecurityConfigForSite(after.site_url);
 const remaining=configDifferences(after,expected);
 return {project,mode,changed,remaining,verified:remaining.length===0,template_sha256:createHash('sha256').update(expected[templateKey]).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [mode='--plan',project,...extra]=process.argv.slice(2);
  if(extra.length||!['--plan','--check','--apply'].includes(mode))throw Error('USAGE: --plan | --check PROJECT | --apply PROJECT');
  if(mode==='--plan'){
   if(project)throw Error('PLAN_TAKES_NO_PROJECT');
   console.log(JSON.stringify({project:developmentProject,config:passwordSecurityConfig,template_source:passwordNotification},null,2));
  }else{
   const result=await configurePasswordSecurity({project,mode:mode.slice(2),token:process.env.SUPABASE_ACCESS_TOKEN});
   console.log(JSON.stringify(result,null,2));if(!result.verified)process.exitCode=1;
  }
 }catch(error){console.error(error.message);process.exitCode=1;}
}
