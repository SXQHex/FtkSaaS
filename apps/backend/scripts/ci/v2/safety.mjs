export function assertPilotSource({actions,event,expected,actual,dirty,existingState}){
 if(actions!=='true'||event!=='workflow_dispatch')throw Error('CI_V2_MANUAL_RUN_REQUIRED');
 if(!/^[a-f0-9]{40}$/.test(expected??'')||actual!==expected)throw Error('CI_V2_EXACT_SOURCE_REQUIRED');
 if(dirty||existingState)throw Error('CI_V2_DISPOSABLE_CHECKOUT_REQUIRED');
}

export function assertLocalServices(env){
 for(const [key,protocols] of [['DB_URL',['postgresql:','postgres:']],['API_URL',['http:','https:']]]){
  const url=new URL(env?.[key]);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||!protocols.includes(url.protocol))throw Error('CI_V2_LOOPBACK_REQUIRED');
 }
}
