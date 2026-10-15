import type {Operations} from './operations.js';
import type {FailureEnvelope} from './generated.js';
export class BackendTransportError extends Error {constructor(readonly status:number){super('Backend response was not a valid API envelope');}}
export function createBackendClient(config:{functionsUrl:string;publishableKey:string;getAccessToken:()=>Promise<string|null>}) {
 return {async call<K extends keyof Operations>(operation:K,request:Operations[K]['request']):Promise<Operations[K]['response']|FailureEnvelope>{
  const token=await config.getAccessToken();if(!token)throw new Error('AUTH_REQUIRED');
  const response=await fetch(config.functionsUrl.replace(/\/$/,'')+'/'+operation,{method:'POST',headers:{apikey:config.publishableKey,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(request)});
  let result:unknown;try{result=await response.json();}catch{throw new BackendTransportError(response.status);}
  if(!result||typeof result!=='object'||!('ok' in result)||typeof result.ok!=='boolean')throw new BackendTransportError(response.status);
  return result as Operations[K]['response']|FailureEnvelope;
 }};
}
