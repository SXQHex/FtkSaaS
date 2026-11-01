import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const project='gwyprhenabtpkbojephw'; // accepted development/test project only
const literal=s=>"pg_catalog.convert_from(pg_catalog.decode('"+Buffer.from(s,'utf8').toString('hex')+"','hex'),'UTF8')";
export function configurationSql({org,origin,from,providerKey,anonKey,signingKey}){
 if(typeof org!=='string'||typeof origin!=='string'||typeof from!=='string'||!/^[a-f0-9-]{36}$/.test(org)||!/^https:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?$/.test(origin)||/[\r\n]/.test(from)||!from.includes('@'))throw Error('INVALID_INVITATION_CONFIGURATION');
 if(!providerKey.startsWith('re_')||!anonKey||typeof signingKey!=='string'||!/^[a-f0-9]{64}$/.test(signingKey))throw Error('INVITATION_CREDENTIALS_REQUIRED');
 const providerName='ftk_invitation_resend_'+org+'_'+createHash('sha256').update(providerKey).digest('hex');
 const secrets=[[providerName,providerKey],['ftk_invitation_anon',anonKey],['ftk_invitation_signing',signingKey]];
 return `do $config$ declare sid uuid; begin
 if to_regprocedure('private.invitation_dispatch()') is null or not exists(select 1 from core.organizations where id=${literal(org)}::uuid) then raise exception 'ACCEPTED_INVITATION_SOURCE_AND_ORG_REQUIRED';end if;
 ${secrets.map(([name,value])=>`select id into sid from vault.secrets where name=${literal(name)};
 if sid is null then perform vault.create_secret(${literal(value)},${literal(name)});else perform vault.update_secret(sid,${literal(value)});end if;`).join('\n')}
 insert into private.invitation_sender_config(org_id,enabled,from_email,app_origin,resend_secret_id)
 values(${literal(org)}::uuid,true,${literal(from)},${literal(origin)},(select id from vault.secrets where name=${literal(providerName)}))
 on conflict(org_id) do update set enabled=true,from_email=excluded.from_email,app_origin=excluded.app_origin,resend_secret_id=excluded.resend_secret_id;
 insert into private.invitation_dispatch_config(singleton,enabled,backend_origin,anon_secret_id,signing_secret_id)
 values(true,false,'https://${project}.supabase.co',(select id from vault.secrets where name='ftk_invitation_anon'),(select id from vault.secrets where name='ftk_invitation_signing'))
 on conflict(singleton) do update set (enabled,backend_origin,anon_secret_id,signing_secret_id) = (false,excluded.backend_origin,excluded.anon_secret_id,excluded.signing_secret_id);
 end $config$;`;
}
export async function configure({org,origin,from,apply=false,token=process.env.SUPABASE_ACCESS_TOKEN,providerKey=process.env.FTK_INVITATION_RESEND_API_KEY,signingKey=process.env.FTK_INVITATION_TICK_SECRET,request=fetch}={}){
 if(!token||!org||!origin)throw Error('SUPABASE_ACCESS_TOKEN, --org and --app-origin required');
 const api=async(route,body)=>{
  const res=await request('https://api.supabase.com/v1/projects/'+project+route,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!res.ok){await res.arrayBuffer();throw Error('Invitation management API HTTP '+res.status);}return res.json();
 };
 const auth=providerKey&&from?{}:await api('/config/auth'),keys=await api('/api-keys?reveal=true');
 // Reuse an explicitly supplied sending key, or the already configured Resend
 // SMTP credential. Never print credentials, SQL text, recipient or token.
 if(!providerKey&&auth.smtp_host==='smtp.resend.com')providerKey=auth.smtp_pass;
 const source={org,origin,from:from??auth.smtp_admin_email,providerKey,anonKey:keys.find(k=>k.name==='anon')?.api_key,signingKey};
 const sql=configurationSql(source);
 if(!apply)return {project,mode:'read-only',configuration_valid:true};
 await api('/database/query',{query:sql});
 await api('/secrets',[{name:'FTK_INVITATION_TICK_SECRET',value:signingKey}]);
 await api('/database/query',{query:fs.readFileSync(new URL('./invitation-cron-install.sql',import.meta.url),'utf8')});
 const rows=await api('/database/query',{query:"select c.enabled,(select count(*)::int from private.invitation_sender_config where enabled) enabled_tenants,(select count(*)::int from cron.job where jobname='ftksaas-invitations' and username='ftk_ops_invitation' and active) scheduler_count from private.invitation_dispatch_config c where singleton"});
 if(rows.length!==1||rows[0].enabled!==true||rows[0].scheduler_count!==1)throw Error('INVITATION_CONFIGURATION_READBACK_FAILED');
 return {project,mode:'applied',enabled_tenants:rows[0].enabled_tenants,scheduler_count:1};
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const args=process.argv.slice(2),value=k=>{const at=args.indexOf(k);return at<0?undefined:args[at+1];};
 try{console.log(JSON.stringify(await configure({org:value('--org'),origin:value('--app-origin'),from:value('--from'),apply:args.includes('--apply')})));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
