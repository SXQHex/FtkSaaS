// Meta Page leadgen verification only. Instagram lead ads also belong to a
// Page. Do not confuse this with Instagram profile/message/comment webhooks.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const configured=value=>{if(typeof value!=='string'||!value.length||value.length>4096)throw Error('PROVIDER_CONFIG');};
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
const identifierKeys=new Set(['id','page_id','form_id','leadgen_id','ad_id','adgroup_id']);
function identifier(value){
 if(typeof value==='number'){if(!Number.isSafeInteger(value))throw Error('PROVIDER_PAYLOAD');value=String(value);}
 if(typeof value!=='string'||!/^[1-9][0-9]{0,31}$/.test(value))throw Error('PROVIDER_PAYLOAD');
 return value;
}
function timestamp(value){
 if(value===undefined)return null;
 if(!Number.isSafeInteger(value)||value<0||!Number.isFinite(new Date(value*1000).getTime()))throw Error('PROVIDER_PAYLOAD');
 return new Date(value*1000).toISOString();
}
export function metaWebhookChallenge(url,verifyToken){
 configured(verifyToken);
 let q;try{q=new URL(url).searchParams;}catch{throw Error('PROVIDER_AUTH');}
 if(['hub.mode','hub.verify_token','hub.challenge'].some(k=>q.getAll(k).length!==1)||q.get('hub.mode')!=='subscribe'||!equal(q.get('hub.verify_token'),verifyToken)||!/^\d{1,128}$/.test(q.get('hub.challenge')))throw Error('PROVIDER_AUTH');
 return q.get('hub.challenge');
}
export function parseMetaLeadNotifications(raw,signature,appSecret){
 configured(appSecret);
 if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>1048576)throw Error('PROVIDER_PAYLOAD');
 if(typeof signature!=='string'||!/^sha256=[a-fA-F0-9]{64}$/.test(signature))throw Error('PROVIDER_AUTH');
 const expected=createHmac('sha256',appSecret).update(raw,'utf8').digest();
 if(!timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex')))throw Error('PROVIDER_AUTH');
 let body;
 try{
  body=JSON.parse(raw,(key,value,context)=>{
   if(identifierKeys.has(key)&&typeof value==='number'){
    return context.source; // Consumed IDs are validated below; ignore unrelated extensions.
   }
   return value;
  });
 }catch{throw Error('PROVIDER_PAYLOAD');}
 if(!object(body)||body.object!=='page'||!Array.isArray(body.entry)||body.entry.length>1000)throw Error('PROVIDER_PAYLOAD');
 const result=[];let updates=0;
 for(const entry of body.entry){
  if(!object(entry)||!Array.isArray(entry.changes))throw Error('PROVIDER_PAYLOAD');
  const page=identifier(entry.id),sent=timestamp(entry.time);updates+=entry.changes.length;if(updates>1000)throw Error('PROVIDER_PAYLOAD');
  for(const change of entry.changes){
   if(!object(change)||change.field!=='leadgen')continue;
   const v=change.value;if(!object(v)||identifier(v.page_id)!==page)throw Error('PROVIDER_PAYLOAD');
   const attribution={};for(const key of ['ad_id','adgroup_id'])if(v[key]!==undefined)attribution[key]=identifier(v[key]);
   result.push({provider:'meta',external_page_id:page,external_form_id:identifier(v.form_id),external_lead_id:identifier(v.leadgen_id),notification_sent_at:sent,lead_created_at:timestamp(v.created_time),attribution});
  }
 }
 // No implicit acknowledgement or durable dedupe: the receiver must persist
 // verified identities and retrieve actual field/disclaimer data before ack.
 return result;
}
