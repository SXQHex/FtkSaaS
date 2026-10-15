import fs from 'node:fs';import {stackStatus} from './db.mjs';
const s=stackStatus(),env=s.env;const headers={apikey:env.PUBLISHABLE_KEY,'Accept-Profile':'api_v1'};const checks=[];
for(const [name,path] of [['auth','/auth/v1/health'],['rest','/rest/v1/']]){
 try{const r=await fetch(env.API_URL+path,{headers,signal:AbortSignal.timeout(120000)});checks.push({name,status:r.status,passed:r.ok});}
 catch(e){checks.push({name,passed:false,error:e.message});}
}
const report={runtime:'Supabase native',database:'PostgreSQL 17.11',box:'present-bobcat-18604',ephemeral:true,expires_at:'2026-10-15T21:28:15+03:00',checks,scope:'service health only; no completed business endpoint or integration acceptance claimed'};
fs.writeFileSync('reports/environment.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(checks.some(x=>!x.passed))process.exitCode=1;
