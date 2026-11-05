// Reviewable routing SQL only. Credentials never belong in this configuration.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function providerFormConfigurationSQL(config){
 const keys=['id','org_id','center_id','channel','form_key','source_url','enabled','external_form_id','external_page_id','db_role'];
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value),id=value=>typeof value==='string'&&/^[1-9][0-9]{0,31}$/.test(value);
 if(!config||Object.keys(config).length!==keys.length||!keys.every(k=>Object.hasOwn(config,k))||!uuid(config.id)||!uuid(config.org_id)||config.center_id!==null&&!uuid(config.center_id))throw Error('PROVIDER_CONFIG');
 if(!['meta','google_ads'].includes(config.channel)||!id(config.external_form_id)||typeof config.enabled!=='boolean'||typeof config.form_key!=='string'||!config.form_key.trim()||config.form_key.length>256||typeof config.db_role!=='string'||!/^[_a-zA-Z][_a-zA-Z0-9]{0,62}$/.test(config.db_role))throw Error('PROVIDER_CONFIG');
 if(config.channel==='meta'?!id(config.external_page_id):config.external_page_id!==null||BigInt(config.external_form_id)>9223372036854775807n)throw Error('PROVIDER_CONFIG');
 let url;try{url=new URL(config.source_url);}catch{throw Error('PROVIDER_CONFIG');}
 if(typeof config.source_url!=='string'||config.source_url.length>2048||url.protocol!=='https:'||url.username||url.password||/[\s\u0000-\u001f]/.test(config.source_url))throw Error('PROVIDER_CONFIG');
 const quote=value=>value===null?'null':"'"+value.replaceAll("'","''")+"'";
 const {id:form,org_id:org,center_id:center,channel,form_key:label,source_url:source,enabled,external_form_id:externalForm,external_page_id:page,db_role:role}=config;
 let delimiter='$provider_setup$',n=0;while([label,source].some(value=>value.includes(delimiter)))delimiter='$provider_setup_'+(++n)+'$';
 return `begin;
do ${delimiter}
begin
 perform 1 from core.organizations where id=${quote(org)} and state='active' for update;
 if not found then raise exception 'Active organization required';end if;
 if ${quote(center)}::uuid is not null and not exists(select 1 from core.centers where org_id=${quote(org)} and id=${quote(center)}::uuid and state='active') then raise exception 'Active scoped center required';end if;
 if not exists(select 1 from pg_roles where rolname=${quote(role)} and rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication) or not pg_has_role(${quote(role)}::name,'ftk_crm_ingress_worker','member') then raise exception 'Dedicated receiver login required';end if;
 if exists(select 1 from private.crm_intake_forms where id=${quote(form)} and (org_id<>${quote(org)} or center_id is distinct from ${quote(center)}::uuid or channel<>${quote(channel)} or form_key<>${quote(label)} or source_url<>${quote(source)} or external_form_id is distinct from ${quote(externalForm)} or external_page_id is distinct from ${quote(page)})) then raise exception 'Form mapping is immutable: use a new form id';end if;
 insert into private.crm_intake_forms(id,org_id,center_id,channel,form_key,source_url,enabled,external_form_id,external_page_id) values(${quote(form)},${quote(org)},${quote(center)}::uuid,${quote(channel)},${quote(label)},${quote(source)},${enabled},${quote(externalForm)},${quote(page)}) on conflict(id) do update set enabled=excluded.enabled;
 insert into private.crm_provider_receiver_scopes(db_role,form_id) values(${quote(role)},${quote(form)}) on conflict do nothing;
end ${delimiter};
select id,org_id,center_id,channel,external_form_id,external_page_id,enabled from private.crm_intake_forms where id=${quote(form)};
commit;
`;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{if(process.argv.length!==3)throw Error('PROVIDER_CONFIG');process.stdout.write(providerFormConfigurationSQL(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))));}
 catch{console.error('PROVIDER_CONFIG');process.exitCode=1;}
}
