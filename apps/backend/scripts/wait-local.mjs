import {readinessSummary,isLocalReady} from './local-readiness.mjs';
import {stackStatus} from './db.mjs';import {newUuidV7} from './uuid.mjs';
const {env}=stackStatus();let healthy=0;
for(let attempt=0;attempt<30;attempt++){
 const probe={};
 try{
  const options={headers:{apikey:env.ANON_KEY},signal:AbortSignal.timeout(5000)};
  const auth=await fetch(env.API_URL+'/auth/v1/health',options);
  probe.auth=auth.status;
  const rpc=await fetch(env.API_URL+'/rest/v1/',{...options,headers:{...options.headers,'accept-profile':'api_v1'}});
  probe.rpc=rpc.status;
  const edge=await fetch(env.API_URL+'/functions/v1/backend-v1/account_get_v1',{...options,method:'POST',headers:{...options.headers,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:newUuidV7()})});
  probe.edge=edge.status;
  const result=await edge.json();probe.code=result.error?.code;
  if(isLocalReady(readinessSummary(probe)))healthy++;else healthy=0;
  if(healthy>=2){console.log('Auth, Data API and bundled Edge gateway are ready');break;}
 }catch(error){healthy=0;probe.failure=error?.name??'ProbeError';}
 if(attempt===0||attempt===29)console.error('Local readiness probe: '+JSON.stringify(readinessSummary(probe)));
 if(attempt===29)throw new Error('LOCAL_BACKEND_NOT_READY');
 await new Promise(resolve=>setTimeout(resolve,1000));
}
