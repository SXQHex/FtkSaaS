import fs from 'node:fs';import {stackStatus} from './db.mjs';
const s=stackStatus(),env=s.env;const checks=[];
for(const [name,path] of [['auth','/auth/v1/health'],['rest','/rest/v1/']]){try{const r=await fetch(env.API_URL+path,{headers:{apikey:env.PUBLISHABLE_KEY??env.ANON_KEY,'Accept-Profile':'api_v1'},signal:AbortSignal.timeout(15000)});checks.push({name,status:r.status,passed:r.ok});}catch{checks.push({name,passed:false});}}
const report={runtime:'Supabase native',database:'PostgreSQL 17',ephemeral_services:true,source_repository:'https://github.com/SXQHex/FtkSaaS',checks};fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/environment.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(checks.some(x=>!x.passed))process.exitCode=1;
