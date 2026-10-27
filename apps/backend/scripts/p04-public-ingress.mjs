// Server-only adapter. clientIp MUST come from the hosting platform's verified
// connection metadata, never from request JSON or untrusted forwarded headers.
import {createHash,createHmac} from 'node:crypto';
import {isIP} from 'node:net';
export const publicSubmitPath='/functions/v1/backend-v1/public_application_submit_v1';
export function signPublicApplication(body,clientIp,secret,now=Date.now()){
 if(typeof body!=='string'||Buffer.byteLength(body,'utf8')>2097152)throw Error('Invalid raw request body');
 const family=typeof clientIp==='string'?isIP(clientIp):0;
 if(!family)throw Error('Verified connection IP required');
 const ip=family===6?new URL('http://['+clientIp+']/').hostname.slice(1,-1):clientIp;
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)throw Error('Ingress secret must contain at least 32 bytes');
 const time=String(Math.floor(now/1000));if(!/^\d{10}$/.test(time))throw Error('Invalid ingress timestamp');
 const digest=createHash('sha256').update(body,'utf8').digest('hex');
 const signature=createHmac('sha256',secret).update(['POST',publicSubmitPath,time,ip,digest].join('\n'),'utf8').digest('hex');
 return {'x-ftk-client-ip':ip,'x-ftk-ingress-time':time,'x-ftk-ingress-signature':signature};
}
