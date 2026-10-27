// Produces reviewable SQL only; no network, product creation or default policy.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function trialConfigurationSQL(config){
 const keys=['org_id','center_id','product_version_id','offer_minutes','expected_repeat_limit','enabled'];
 if(!config||Object.keys(config).length!==keys.length||!keys.every(k=>Object.hasOwn(config,k)))throw Error('All six explicit trial configuration fields are required');
 for(const key of keys.slice(0,3))if(typeof config[key]!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(config[key]))throw Error('Invalid '+key);
 if(!Number.isSafeInteger(config.offer_minutes)||config.offer_minutes<1||config.offer_minutes>2147483647||!Number.isSafeInteger(config.expected_repeat_limit)||config.expected_repeat_limit<0||typeof config.enabled!=='boolean')throw Error('Invalid explicit trial limits/enabled');
 const {org_id:o,center_id:c,product_version_id:p,offer_minutes:m,expected_repeat_limit:l,enabled:e}=config;
 return `begin;
do $trial_setup$
begin
perform 1 from core.organizations where id='${o}' and state='active' for update;
if not found then raise exception 'Active organization required';end if;
if not exists(select 1 from core.centers where org_id='${o}' and id='${c}' and state='active') then raise exception 'Active scoped center required';end if;
if not exists(select 1 from core.product_versions v join core.products p on p.org_id=v.org_id and p.id=v.product_id where v.org_id='${o}' and v.center_id='${c}' and v.id='${p}' and v.effective_at<=clock_timestamp() and p.state='active') then raise exception 'Active effective scoped product required';end if;
if (select (p.value->>'value')::bigint from private.policy_at('${o}','${c}','trial_repeat_limit',clock_timestamp()) p) is distinct from ${l}::bigint then raise exception 'Effective repeat policy differs from approved value';end if;
insert into private.p04_trial_configuration(org_id,center_id,product_version_id,offer_minutes,enabled)
values('${o}','${c}','${p}',${m},${e})
on conflict(org_id,product_version_id) do update set center_id=excluded.center_id,offer_minutes=excluded.offer_minutes,enabled=excluded.enabled;
end $trial_setup$;
select org_id,center_id,product_version_id,offer_minutes,enabled from private.p04_trial_configuration where org_id='${o}' and product_version_id='${p}';
commit;
`;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{if(process.argv.length!==3)throw Error('Usage: node scripts/p04-trial-config.mjs explicit-config.json');process.stdout.write(trialConfigurationSQL(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
