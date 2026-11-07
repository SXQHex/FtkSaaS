import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {project} from './ci/deploy-development.mjs';
// Operator-only setup planning. This module has no network or CI dependency.
export function missingCalendarConfiguration(secrets){
 if(!Array.isArray(secrets)||secrets.some(s=>typeof s?.name!=='string'))throw Error('Invalid calendar configuration inventory');
 const names=new Set(secrets.map(s=>s.name));
 const defaults={FTK_CALENDAR_ORIGIN:'https://'+project+'.supabase.co/functions/v1/personal-calendar',FTK_CALENDAR_SESSION_URL_TEMPLATE:'https://ftksaas-web.vercel.app/organizasyon/{org_id}/seans/{session_id}'};
 const missing=Object.entries(defaults).filter(([name])=>!names.has(name)).map(([name,value])=>({name,value}));
 if(!names.has('FTK_CALENDAR_SIGNING_KEY'))missing.push({name:'FTK_CALENDAR_SIGNING_KEY',value:randomBytes(32).toString('hex')});
 return missing;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const plan=missingCalendarConfiguration([]).map(s=>({...s,value:s.name==='FTK_CALENDAR_SIGNING_KEY'?'<generate 32 random bytes as 64 lowercase hex>':s.value}));
 console.log(JSON.stringify(plan,null,2));
}
