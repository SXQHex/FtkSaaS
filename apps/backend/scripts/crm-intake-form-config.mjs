// Produces reviewable configuration SQL only; never connects to hosted data.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function intakeFormConfigurationSQL(config){
 const keys=['id','org_id','center_id','channel','form_key','source_url','enabled'];
 if(!config||Object.keys(config).length!==keys.length||!keys.every(k=>Object.hasOwn(config,k)))throw Error('All seven explicit intake form fields are required');
 const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
 if(!uuid(config.id)||!uuid(config.org_id)||config.center_id!==null&&!uuid(config.center_id))throw Error('Invalid explicit form scope');
 if(config.channel!=='web_form'||typeof config.enabled!=='boolean'||typeof config.form_key!=='string'||!config.form_key.trim()||config.form_key.length>256)throw Error('Invalid form channel/key/enabled');
 let url;try{url=new URL(config.source_url);}catch{throw Error('Invalid source URL');}
 if(typeof config.source_url!=='string'||config.source_url.length>2048||url.protocol!=='https:'||url.username||url.password||/[\s\u0000-\u001f]/.test(config.source_url))throw Error('Invalid source URL');
 const quote=x=>"'"+x.replaceAll("'","''")+"'";
 const {id,org_id:org,center_id:center,form_key:form,source_url:source,enabled}=config,c=center?quote(center)+'::uuid':'null::uuid';
 let delimiter='$intake_setup$',counter=0;
 while([form,source].some(value=>value.includes(delimiter)))delimiter='$intake_setup_'+(++counter)+'$';
 return `begin;
do ${delimiter}
begin
 perform 1 from core.organizations where id='${org}' and state='active' for update;
 if not found then raise exception 'Active organization required';end if;
 if ${c} is not null and not exists(select 1 from core.centers where org_id='${org}' and id=${c} and state='active') then raise exception 'Active scoped center required';end if;
 if exists(select 1 from private.crm_intake_forms where id='${id}' and (org_id<>'${org}' or center_id is distinct from ${c} or channel<>'web_form' or form_key<>${quote(form)} or source_url<>${quote(source)})) then raise exception 'Form mapping is immutable: use a new form id';end if;
 insert into private.crm_intake_forms(id,org_id,center_id,channel,form_key,source_url,enabled) values('${id}','${org}',${c},'web_form',${quote(form)},${quote(source)},${enabled})
 on conflict(id) do update set enabled=excluded.enabled;
end ${delimiter};
select id,org_id,center_id,channel,form_key,source_url,enabled from private.crm_intake_forms where id='${id}';
commit;
`;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{if(process.argv.length!==3)throw Error('Usage: node scripts/crm-intake-form-config.mjs explicit-config.json');process.stdout.write(intakeFormConfigurationSQL(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
