import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {newUuidV7} from './uuid.mjs';
// Explicit native operator session, never a service key or a hosted SQL/seed command.
export async function publishContent({url,key,token,entries,send=fetch}){
 const endpoint=new URL(url);
 if(endpoint.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(endpoint.hostname))throw Error('HTTPS_REQUIRED');
 for(const entry of entries){
  const response=await send(new URL('/functions/v1/backend-v1/content_catalog_save_v1',endpoint),{method:'POST',headers:{apikey:key,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({...entry,action:'publish',client_api_version:1,request_id:newUuidV7(),operation_key:newUuidV7()}),signal:AbortSignal.timeout(30000)});
  const result=await response.json();if(!response.ok||result.ok!==true)throw Error('CONTENT_PUBLICATION_FAILED: '+(result.error?.code??response.status));
 }
 return {published:entries.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2];if(!file)throw Error('Usage: node scripts/content-publish.mjs CONTENT.json (FTK_CONTENT_URL / FTK_CONTENT_APIKEY / FTK_CONTENT_TOKEN from environment)');
 console.log(JSON.stringify(await publishContent({url:process.env.FTK_CONTENT_URL,key:process.env.FTK_CONTENT_APIKEY,token:process.env.FTK_CONTENT_TOKEN,entries:JSON.parse(fs.readFileSync(file,'utf8'))})));
}
