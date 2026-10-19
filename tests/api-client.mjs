import {measured,timedFetch} from '../scripts/ci/timings.mjs';
import {stackStatus,connect} from '../scripts/db.mjs';import {newUuidV7} from '../scripts/uuid.mjs';import {randomBytes} from 'node:crypto';import fs from 'node:fs';
async function responseJson(response,label){const body=await response.text();try{return JSON.parse(body);}catch{throw new Error(label+' returned invalid JSON (HTTP '+response.status+', content-type '+response.headers.get('content-type')+', bytes '+Buffer.byteLength(body)+')');}}
let cachedContext;export function context(){if(!cachedContext){const s=stackStatus();cachedContext={s,env:s.env};}return cachedContext;}
async function createAuthUser(label){const {env}=context();const email='dev+'+label+'-'+newUuidV7()+'@ftksaas.invalid',password=randomBytes(30).toString('base64url');
 const a=await timedFetch('auth.create',env.API_URL+'/auth/v1/admin/users',{method:'POST',headers:{apikey:env.SERVICE_ROLE_KEY,authorization:'Bearer '+env.SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{display_name:label}})});
 if(!a.ok)throw new Error('Auth fixture creation failed: '+a.status);const user=await responseJson(a,'Auth fixture create');
 const t=await timedFetch('auth.password_login',env.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email,password})});const session=await responseJson(t,'Auth fixture login');if(!t.ok)throw new Error('Auth login failed');
 return {id:user.id,email,password,jwt:session.access_token,session_id:JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString()).session_id};
}
const contract=JSON.parse(fs.readFileSync('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json'));
async function apiCall(user,operation,body={},key){const {env}=context();const request={client_api_version:1,request_id:newUuidV7(),...body};if(key&&contract.$defs[contract['x-contract'].operations.find(o=>o.name===operation).request.$ref.split('/').at(-1)].properties.operation_key)request.operation_key=key;
 const res=await timedFetch(operation,env.API_URL+'/functions/v1/backend-v1/'+operation,{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+user.jwt,'content-type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(60000)});
 const result=await responseJson(res,operation);return {result,request,status:res.status};
}
export async function must(user,operation,body={},key){const r=await call(user,operation,body,key);if(!r.result.ok)throw new Error(operation+': '+JSON.stringify(r.result));return r.result.data;}
async function createPlatformFixture(){const platform=await authUser('platform');const db=await connect();try{await db.query('insert into private.platform_operators(auth_user_id) values($1)',[platform.id]);const plan=newUuidV7();
 await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) values($1,'business',now(),1000,'TRY','monthly',$2,$3)",[plan,{entries:[{key:'active_students',value:500},{key:'centers',value:10},{key:'instructors',value:50}]},Array.from({length:33},(_,i)=>'F'+String(i+1).padStart(2,'0'))]);
 return {platform,plan};}finally{await db.end();}}

export const authUser=label=>measured('fixture','authUser',()=>createAuthUser(label));
export const call=(user,operation,body={},key)=>measured('api',operation,()=>apiCall(user,operation,body,key));
export const fixturePlatform=()=>measured('fixture','fixturePlatform',createPlatformFixture);
