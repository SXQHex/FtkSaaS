import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {context} from './api-client.mjs';

// Use native enrollment and proof; never manufacture AAL or edit Auth rows.
export async function nativeTotp(t,user){
 const {env}=context();let strong=user;
 const native=async(path,method,body)=>{
  const response=await fetch(env.API_URL+'/auth/v1'+path,{method,headers:{apikey:env.ANON_KEY,authorization:'Bearer '+strong.jwt,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
  const data=await response.json();assert.equal(response.ok,true,'native TOTP '+method+' '+path);return data;
 };
 const enrolled=await native('/factors','POST',{factor_type:'totp',friendly_name:'Settings acceptance',issuer:'FtkSaaS'});
 t.after(async()=>{await native('/factors/'+enrolled.id,'DELETE');});
 const challenge=await native('/factors/'+enrolled.id+'/challenge','POST',{});
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
 for(const c of enrolled.totp.secret.toUpperCase().replace(/=+$/,'')){const n=alphabet.indexOf(c);assert(n>=0);bits+=n.toString(2).padStart(5,'0');}
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const hash=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=hash.at(-1)&15;
 const code=((hash.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
 const proof=await native('/factors/'+enrolled.id+'/verify','POST',{challenge_id:challenge.id,code});
 const claims=JSON.parse(Buffer.from(proof.access_token.split('.')[1],'base64url').toString());assert.equal(claims.aal,'aal2');
 strong={...user,jwt:proof.access_token,session_id:claims.session_id};return strong;
}
