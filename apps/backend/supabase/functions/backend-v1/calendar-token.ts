// Technical configuration, not a user-selectable origin or a business default.
const hex=/^[a-f0-9]{64}$/;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const encoder=new TextEncoder();
const toHex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export async function calendarTokenHash(token:string):Promise<string> {
 if(!hex.test(token))throw Error('INVALID_CALENDAR_TOKEN');
 return toHex(await crypto.subtle.digest('SHA-256',encoder.encode(token)));
}
export function calendarOrigin(value:string|undefined):string {
 if(!value||/[\u0000-\u0020\u007f]/.test(value))throw Error('CALENDAR_NOT_CONFIGURED');
 let url:URL;try{url=new URL(value);}catch{throw Error('CALENDAR_NOT_CONFIGURED');}
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('CALENDAR_NOT_CONFIGURED');
 return url.origin;
}
export async function calendarToken(secret:string|undefined,authId:string,orgId:string,operation:string,operationKey:string):Promise<{token:string;hash:string}> {
 if(!secret||!hex.test(secret))throw Error('CALENDAR_NOT_CONFIGURED');
 if(!uuid.test(authId)||!uuid.test(orgId)||!uuid.test(operationKey)||!['calendar_link_create_v1','calendar_link_rotate_v1'].includes(operation))throw Error('INVALID_CALENDAR_TOKEN_CONTEXT');
 const key=await crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g)!,x=>parseInt(x,16)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const token=toHex(await crypto.subtle.sign('HMAC',key,encoder.encode(JSON.stringify(['FtkSaaS personal calendar v1',authId.toLowerCase(),orgId.toLowerCase(),operation,operationKey.toLowerCase()]))));
 return {token,hash:await calendarTokenHash(token)};
}
export function calendarSubscriptionUrl(origin:string,token:string):string {
 if(!hex.test(token))throw Error('INVALID_CALENDAR_TOKEN');return calendarOrigin(origin)+'/calendar/'+token+'.ics';
}
export function calendarAppUrl(template:string|undefined,orgId:string,sessionId:string):string {
 if(!template||!template.includes('{org_id}')||!template.includes('{session_id}')||!uuid.test(orgId)||!uuid.test(sessionId)||/[\u0000-\u0020\u007f]/.test(template))throw Error('CALENDAR_NOT_CONFIGURED');
 const expanded=template.replaceAll('{org_id}',orgId.toLowerCase()).replaceAll('{session_id}',sessionId.toLowerCase());
 if(/[{}]/.test(expanded))throw Error('CALENDAR_NOT_CONFIGURED');
 let url:URL;try{url=new URL(expanded);}catch{throw Error('CALENDAR_NOT_CONFIGURED');}
 if(url.username||url.password)throw Error('CALENDAR_NOT_CONFIGURED');calendarOrigin(url.origin);return url.href;
}
