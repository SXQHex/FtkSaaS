// Public submission needs a trusted ingress IP, not client-supplied forwarded headers.
// The gateway signs the exact body/path/IP; CAPTCHA tokens remain provider-verified.
export type PublicEnv=(key:string)=>string|undefined;
const enc=new TextEncoder();
// Supabase's hosted gateway removes /functions/v1 before dispatch. Keep the
// public signing protocol unchanged and canonicalize only these exact routes.
const forwardedPublicPaths=new Set(['/backend-v1/public_application_submit_v1','/backend-v1/account_signup_check_v1']);
const hex=(x:ArrayBuffer)=>Array.from(new Uint8Array(x),b=>b.toString(16).padStart(2,'0')).join('');
export async function keyedHash(secret:string,value:string):Promise<string>{
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,enc.encode(value)));
}
export async function publicIngress(req:Request,body:string,env:PublicEnv,now=Date.now()){
 const secrets=[env('FTK_PUBLIC_INGRESS_SECRET'),env('FTK_SPA_INGRESS_SECRET')].filter((value):value is string=>!!value),salt=env('FTK_PUBLIC_HASH_SECRET');
 const ip=req.headers.get('x-ftk-client-ip'),time=req.headers.get('x-ftk-ingress-time'),signature=req.headers.get('x-ftk-ingress-signature');
 if(!secrets.length||!salt)return null;
 if(!ip||!time||!signature||!/^\d{10}$/.test(time)||Math.abs(now/1000-Number(time))>60||ip.length>64||!/^([0-9a-fA-F:.]+)$/.test(ip))return null;
 const digest=hex(await crypto.subtle.digest('SHA-256',enc.encode(body)));
 const receivedPath=new URL(req.url).pathname;
 const signingPath=forwardedPublicPaths.has(receivedPath)?'/functions/v1'+receivedPath:receivedPath;
 if(!/^[a-f0-9]{64}$/.test(signature))return null;
 let accepted=false;
 for(const secret of secrets){
  const expected=await keyedHash(secret,[req.method,signingPath,time,ip,digest].join('\n'));
  let diff=0;for(let i=0;i<expected.length;i++)diff|=signature.charCodeAt(i)^expected.charCodeAt(i);
  accepted=diff===0||accepted;
 }
 if(!accepted)return null;
 return {ip,ip_hash:await keyedHash(salt,'ip:'+ip),targetHash:(contact:string)=>keyedHash(salt,'target:'+contact.trim().toLowerCase())};
}
export function publicBotHostname(env:PublicEnv,action:string='public_application'){return (action==='public_application'?env('FTK_PUBLIC_APPLICATION_HOSTNAME'):undefined)??env('FTK_TURNSTILE_HOSTNAME');}
// Additive explicit host policy preserves existing consumers during SPA rollout.
export function publicBotHostnames(env:PublicEnv,action:string='public_application'):string[]{
 const single=publicBotHostname(env,action),extra=action==='public_application'?env('FTK_PUBLIC_APPLICATION_HOSTNAMES'):undefined;
 const hosts=[...(single?[single]:[]),...(extra!==undefined?extra.split(','):[])];
 try{if(!hosts.every(host=>{const url=new URL('https://'+host);return url.hostname===host&&url.origin==='https://'+host&&!host.includes('*');}))return [];}catch{return [];}
 return [...new Set(hosts)];
}
export async function verifyPublicBot(token:string,ip:string,env:PublicEnv,fetcher:typeof fetch=fetch,action:string='public_application'):Promise<boolean>{
 const secret=env('FTK_TURNSTILE_SECRET'),hostnames=publicBotHostnames(env,action);
 if(!secret||!hostnames.length)return false;
 try{
  const res=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:token,remoteip:ip}),signal:AbortSignal.timeout(10000)});
  if(!res.ok)return false;
  const proof=await res.json();
  return proof.success===true&&hostnames.includes(proof.hostname)&&proof.action===action;
 }catch{return false;}
}

// The normalized application phone is contact evidence, never Auth verification.
export function crmIntakePhone(value:unknown):string{
 if(typeof value!=='string')throw Error('VALIDATION_FAILED');
 const phone=value.trim().replace(/[\s().-]/g,'').replace(/^00/,'+');
 if(!/^\+[1-9][0-9]{6,14}$/.test(phone))throw Error('VALIDATION_FAILED');
 return phone;
}

// Hash both supplied contacts; SQL chooses the authoritative form requirement
// under the organization lock. Optional alternate contacts cannot rotate quotas.
export function crmIntakeTargets(value:unknown):Record<string,string>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('VALIDATION_FAILED');
 const intake=value as Record<string,unknown>,targets:Record<string,string>={};
 if(intake.phone!==undefined)targets.phone=crmIntakePhone(intake.phone);
 if(intake.email!==undefined){
  if(typeof intake.email!=='string'||intake.email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intake.email))throw Error('VALIDATION_FAILED');
  targets.email=intake.email.trim().toLowerCase();
 }
 if(!targets.phone&&!targets.email)throw Error('VALIDATION_FAILED');
 return targets;
}
