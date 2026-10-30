import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Existing development project only; production provisioning is outside this task.
export const developmentProject='gwyprhenabtpkbojephw';
export const passwordNotification=fs.readFileSync(new URL('../supabase/templates/password_changed_notification.html',import.meta.url),'utf8');
export const passwordSecurityConfig=Object.freeze({
 security_update_password_require_current_password:true,
 security_update_password_require_reauthentication:false,
 mailer_notifications_password_changed_enabled:true,
 mailer_subjects_password_changed_notification:'Parolanız değiştirildi',
 mailer_templates_password_changed_notification_content:passwordNotification,
 mailer_otp_exp:3600,
});
export function configDifferences(actual){return Object.keys(passwordSecurityConfig).filter(key=>actual[key]!==passwordSecurityConfig[key]);}
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
 const site=new URL(before.site_url);
 if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash||site.pathname!=='/')throw Error('TRUSTED_SITE_ORIGIN_REQUIRED');
 const changed=configDifferences(before);
 if(mode==='apply'&&changed.length)await request('PATCH',passwordSecurityConfig);
 const remaining=configDifferences(mode==='apply'?await request('GET'):before);
 return {project,mode,changed,remaining,verified:remaining.length===0,template_sha256:createHash('sha256').update(passwordNotification).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [mode='--plan',project,...extra]=process.argv.slice(2);
  if(extra.length||!['--plan','--check','--apply'].includes(mode))throw Error('USAGE: --plan | --check PROJECT | --apply PROJECT');
  if(mode==='--plan'){
   if(project)throw Error('PLAN_TAKES_NO_PROJECT');
   console.log(JSON.stringify({project:developmentProject,config:passwordSecurityConfig},null,2));
  }else{
   const result=await configurePasswordSecurity({project,mode:mode.slice(2),token:process.env.SUPABASE_ACCESS_TOKEN});
   console.log(JSON.stringify(result,null,2));if(!result.verified)process.exitCode=1;
  }
 }catch(error){console.error(error.message);process.exitCode=1;}
}
