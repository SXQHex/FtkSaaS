import {isIP} from 'node:net';
import {newUuidV7} from '../scripts/uuid.mjs';
import {forwardAccountSignupCheck} from './account-signup-gateway.mjs';
import {forwardPublicApplication} from '../scripts/public-application-gateway.mjs';
import {publicCalendarGateway} from './public-calendar-gateway.mjs';
import {request_public_application_submit_v1 as validApplication} from './spa-validators.mjs';
import {browserCors,applyBrowserCors} from './browser-cors.mjs';
const failure=(code,status)=>Response.json({ok:false,error:{code,retryable:code==='TEMPORARY_FAILURE',trace_id:newUuidV7()}},{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
// Deploy only at Cloudflare's external ingress. request.cf is runtime metadata.
// Reject Worker subrequests and never fall back to caller-supplied proxy headers.
function connectionIp(request){
 const ip=request.headers.get('cf-connecting-ip');
 if(!request.cf||request.headers.has('cf-worker')||!isIP(ip??'')||ip==='2a06:98c0:3600::103')return null;
 return ip;
}
export async function spaIngress(request,env,fetcher=fetch){
 const cors=browserCors(request,env);if(cors.response)return cors.response;
 const reply=response=>applyBrowserCors(response,cors.headers);
 const url=new URL(request.url);
 if(!['/api/auth/signup-check','/api/public/calendar','/api/public/application'].includes(url.pathname)||url.search)return reply(failure('NOT_FOUND',404));
 if(request.method!=='POST')return reply(failure('VALIDATION_FAILED',405));
 // Workers support manual/follow, but not Fetch's redirect:error. Refuse every
 // relocation before a credential-bearing upstream response can be forwarded.
 const upstreamFetch=async(target,init)=>{
  const response=await fetcher(target,{...init,redirect:'manual'});
  if(response.status>=300&&response.status<400){await response.body?.cancel();throw Error('UPSTREAM_REDIRECT');}
  return response;
 };
 if(url.pathname==='/api/public/calendar')return reply(await publicCalendarGateway(request,env,upstreamFetch));
 const ip=connectionIp(request);if(!ip)return reply(failure('SERVICE_UNAVAILABLE',503));
 if(url.pathname==='/api/public/application')return reply(await forwardPublicApplication(request,env,upstreamFetch,ip,input=>{if(!validApplication(input))throw Error('VALIDATION_FAILED');return input;}));
 return reply(await forwardAccountSignupCheck(request,env,upstreamFetch,ip));
}
export default {fetch(request,env){return spaIngress(request,env);}};
