import fs from 'node:fs';import {stackStatus} from './db.mjs';
const {env,endpoints}=stackStatus();const info={api_url:env.API_URL,functions_url:env.API_URL+'/functions/v1/backend-v1',publishable_key:env.PUBLISHABLE_KEY??env.ANON_KEY,studio_url:endpoints?.['studio.http']?.url,mailpit_url:env.MAILPIT_URL};
fs.mkdirSync('.dev',{recursive:true,mode:0o700});fs.writeFileSync('.dev/frontend.env','FTK_API_URL='+info.api_url+'\nFTK_FUNCTIONS_URL='+info.functions_url+'\nFTK_PUBLISHABLE_KEY='+info.publishable_key+'\n',{mode:0o600});
console.log(JSON.stringify(info,null,2));
