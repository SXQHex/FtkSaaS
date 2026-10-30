// Public submission needs a trusted ingress IP, not client-supplied forwarded headers.
// The gateway signs the exact body/path/IP; CAPTCHA tokens remain provider-verified.
export type PublicEnv=(key:string)=>string|undefined;
const enc=new TextEncoder();
// Supabase's hosted gateway removes /functions/v1 before dispatch. Keep the
// public signing protocol unchanged and canonicalize only these exact routes.
const forwardedPublicPaths=new Set(['/backend-v1/public_application_submit_v1','/backend-v1/account_password_reset_request_v1','/backend-v1/account_signup_request_v1']);
const hex=(x:ArrayBuffer)=>Array.from(new Uint8Array(x),b=>b.toString(16).padStart(2,'0')).join('');
export async function keyedHash(secret:string,value:string):Promise<string>{
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,enc.encode(value)));
}
export async function publicIngress(req:Request,body:string,env:PublicEnv,now=Date.now()){
 const secret=env('FTK_PUBLIC_INGRESS_SECRET'),salt=env('FTK_PUBLIC_HASH_SECRET');
 const ip=req.headers.get('x-ftk-client-ip'),time=req.headers.get('x-ftk-ingress-time'),signature=req.headers.get('x-ftk-ingress-signature');
 if(!secret||!salt)return null;
 if(!ip||!time||!signature||!/^\d{10}$/.test(time)||Math.abs(now/1000-Number(time))>60||ip.length>64||!/^([0-9a-fA-F:.]+)$/.test(ip))return null;
 const digest=hex(await crypto.subtle.digest('SHA-256',enc.encode(body)));
 const receivedPath=new URL(req.url).pathname;
 const signingPath=forwardedPublicPaths.has(receivedPath)?'/functions/v1'+receivedPath:receivedPath;
 const expected=await keyedHash(secret,[req.method,signingPath,time,ip,digest].join('\n'));
 if(signature.length!==expected.length)return null;
 let diff=0;for(let i=0;i<expected.length;i++)diff|=signature.charCodeAt(i)^expected.charCodeAt(i);
 if(diff)return null;
 return {ip,ip_hash:await keyedHash(salt,'ip:'+ip),targetHash:(contact:string)=>keyedHash(salt,'target:'+contact.trim().toLowerCase())};
}
export function publicBotHostname(env:PublicEnv,action:string='public_application'){return (action==='public_application'?env('FTK_PUBLIC_APPLICATION_HOSTNAME'):undefined)??env('FTK_TURNSTILE_HOSTNAME');}
export async function verifyPublicBot(token:string,ip:string,env:PublicEnv,fetcher:typeof fetch=fetch,action:string='public_application'):Promise<boolean>{
 const secret=env('FTK_TURNSTILE_SECRET'),hostname=publicBotHostname(env,action);
 if(!secret||!hostname)return false;
 try{
  const res=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:token,remoteip:ip}),signal:AbortSignal.timeout(10000)});
  if(!res.ok)return false;
  const proof=await res.json();
  return proof.success===true&&proof.hostname===hostname&&proof.action===action;
 }catch{return false;}
}
