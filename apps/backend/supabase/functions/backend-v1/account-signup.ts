import {publicIngress,type PublicEnv} from './public-ingress.ts';
type SignupCheck={client_api_version:1;request_id:string;email:string};
type Rpc=(request:SignupCheck,aux:{ip_hash:string})=>Promise<any>;
// Advisory lookup only. Native Auth owns signup, credentials, CAPTCHA and PKCE.
export async function accountSignupCheck(req:Request,body:string,request:SignupCheck,env:PublicEnv,rpc:Rpc){
 const email=request.email.trim().toLowerCase();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return {error:'VALIDATION_FAILED'};
 const ingress=await publicIngress(req,body,env);
 if(!ingress)return {error:'TEMPORARY_FAILURE'};
 return rpc({client_api_version:1,request_id:request.request_id,email},{ip_hash:ingress.ip_hash});
}
