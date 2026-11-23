import type {RuntimeOperationName} from './runtime.js';
import type {Operations} from './operations.js';
import type {FailureEnvelope} from './generated.js';
import {fetchBackendOperation} from './read-transport.js';
import * as validators from './validators.js';

function isSuccessResponse<K extends keyof Operations>(
  operation: K,
  value: unknown,
): value is Operations[K]['response'] {
  return validators[`success_${operation}`]?.(value) === true;
}
export class BackendTransportError extends Error {constructor(readonly status:number){super('Backend response was not a valid API envelope');}}
export function createBackendClient(config:{functionsUrl:string;publishableKey:string;getAccessToken:()=>Promise<string|null>}) {
 return {async call<K extends keyof Operations & RuntimeOperationName>(operation:K,request:Operations[K]['request']):Promise<Operations[K]['response']|FailureEnvelope>{
  const token=await config.getAccessToken();if(!token)throw new Error('AUTH_REQUIRED');
  const response=await fetchBackendOperation(config.functionsUrl,operation,request,{method:'POST',headers:{apikey:config.publishableKey,authorization:'Bearer '+token,'content-type':'application/json'}});
  let result:unknown;try{result=await response.json();}catch{throw new BackendTransportError(response.status);}
  if(validators.failure_envelope(result)||isSuccessResponse(operation,result))return result;
  throw new BackendTransportError(response.status);
 }};
}
