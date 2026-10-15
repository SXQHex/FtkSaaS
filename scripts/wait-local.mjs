import {stackStatus} from './db.mjs';import {newUuidV7} from './uuid.mjs';
const {env}=stackStatus();let healthy=0;
for(let attempt=0;attempt<30;attempt++){
 try{
  const options={headers:{apikey:env.ANON_KEY},signal:AbortSignal.timeout(5000)};
  const auth=await fetch(env.API_URL+'/auth/v1/health',options);
  const rpc=await fetch(env.API_URL+'/rest/v1/',{...options,headers:{...options.headers,'accept-profile':'api_v1'}});
  const edge=await fetch(env.API_URL+'/functions/v1/backend-v1/account_get_v1',{...options,method:'POST',headers:{...options.headers,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:newUuidV7()})});
  const result=await edge.json();if(auth.ok&&rpc.ok&&edge.status===401&&result.error?.code==='AUTH_REQUIRED')healthy++;else healthy=0;
  if(healthy>=2){console.log('Auth, Data API and bundled Edge gateway are ready');break;}
 }catch{healthy=0;}
 if(attempt===29)throw new Error('LOCAL_BACKEND_NOT_READY');
 await new Promise(resolve=>setTimeout(resolve,1000));
}
