import {publicIngress,type PublicEnv} from './public-ingress.ts';
import {isRecord} from './edge-json.ts';
type SignupCheck={client_api_version:1;request_id:string;email:string};
type Rpc=(request:SignupCheck,aux:{ip_hash:string})=>Promise<unknown>;
type SignupResult={error:string}|{data:{status:'account_exists'|'available'}};
// Advisory lookup only. Native Auth owns signup, credentials, CAPTCHA and PKCE.
export async function accountSignupCheck(req:Request,body:string,request:SignupCheck,env:PublicEnv,rpc:Rpc):Promise<SignupResult>{
 const email=request.email.trim().toLowerCase();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return {error:'VALIDATION_FAILED'};
 const ingress=await publicIngress(req,body,env);
 if(!ingress)return {error:'TEMPORARY_FAILURE'};
 const response=await rpc({client_api_version:1,request_id:request.request_id,email},{ip_hash:ingress.ip_hash});
 if(!isRecord(response))throw Error('INVALID_SIGNUP_RPC');
 if(typeof response.error==='string'&&['TEMPORARY_FAILURE','VALIDATION_FAILED','RATE_LIMITED'].includes(response.error))return {error:response.error};
 if(isRecord(response.data)&&(response.data.status==='account_exists'||response.data.status==='available'))return {data:{status:response.data.status}};
 throw Error('INVALID_SIGNUP_RPC');
}
