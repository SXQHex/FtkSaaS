// Public submission needs a trusted ingress IP, not client-supplied forwarded headers.
// The gateway signs the exact body/path/IP; CAPTCHA tokens remain provider-verified.
export type PublicEnv=(key:string)=>string|undefined;
const enc=new TextEncoder();
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
 const expected=await keyedHash(secret,[req.method,new URL(req.url).pathname,time,ip,digest].join('\n'));
 if(signature.length!==expected.length)return null;
 let diff=0;for(let i=0;i<expected.length;i++)diff|=signature.charCodeAt(i)^expected.charCodeAt(i);
 if(diff)return null;
 return {ip,ip_hash:await keyedHash(salt,'ip:'+ip),targetHash:(contact:string)=>keyedHash(salt,'target:'+contact.trim().toLowerCase())};
}
export async function verifyPublicBot(token:string,ip:string,env:PublicEnv,fetcher:typeof fetch=fetch):Promise<boolean>{
 const secret=env('FTK_TURNSTILE_SECRET'),hostname=env('FTK_TURNSTILE_HOSTNAME');
 if(!secret||!hostname)return false;
 try{
  const res=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:token,remoteip:ip}),signal:AbortSignal.timeout(10000)});
  if(!res.ok)return false;
  const proof=await res.json();
  return proof.success===true&&proof.hostname===hostname&&proof.action==='public_application';
 }catch{return false;}
}
