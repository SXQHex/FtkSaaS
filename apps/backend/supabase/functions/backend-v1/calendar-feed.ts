// RFC 5545 sections 3.1, 3.3.11, 3.8.4.7. The caller supplies a live,
// authorized projection. This encoder does not authorize a feed or create links.
export interface CalendarFeedItem {
 id:string; org_id:string; version:number; title:string; location:string;
 starts_at:string; ends_at:string; app_url:string;
}
const encoder=new TextEncoder();
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function utc(value:string):string {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw Error('INVALID_CALENDAR_TIME');
 const date=new Date(value);if(!Number.isFinite(+date))throw Error('INVALID_CALENDAR_TIME');
 return date.toISOString().slice(0,19).replaceAll('-','').replaceAll(':','')+'Z';
}
function text(value:string):string {
 if(typeof value!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw Error('INVALID_CALENDAR_TEXT');
 return value.replaceAll('\\','\\\\').replace(/\r\n|\r|\n/g,'\\n').replaceAll(';','\\;').replaceAll(',','\\,');
}
function fold(value:string):string {
 let out='',line='',bytes=0;
 for(const point of value){const size=encoder.encode(point).length;if(bytes+size>75){out+=line+'\r\n';line=' ';bytes=1;}line+=point;bytes+=size;}
 return out+line+'\r\n';
}
function link(value:string):string {
 if(/[\u0000-\u0020\u007f]/.test(value))throw Error('INVALID_CALENDAR_URL');
 const url=new URL(value);if(url.username||url.password||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('INVALID_CALENDAR_URL');
 return url.href;
}
export function calendarFeed(items:readonly CalendarFeedItem[],asOf:string,maxBytes:number):Uint8Array {
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('INVALID_CALENDAR_LIMIT');
 const stamp=utc(asOf),seen=new Set<string>();
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FtkSaaS//Personal Calendar//EN','CALSCALE:GREGORIAN'];
 for(const item of items){
  if(!uuid.test(item.id)||!uuid.test(item.org_id)||!Number.isInteger(item.version)||item.version<0||item.version>2147483647)throw Error('INVALID_CALENDAR_ITEM');
  const uid=item.org_id.toLowerCase()+':'+item.id.toLowerCase()+'@ftksaas';if(seen.has(uid))throw Error('DUPLICATE_CALENDAR_ITEM');seen.add(uid);
  const start=utc(item.starts_at),end=utc(item.ends_at);if(Date.parse(item.starts_at)>=Date.parse(item.ends_at))throw Error('INVALID_CALENDAR_INTERVAL');
  lines.push('BEGIN:VEVENT','UID:'+uid,'SEQUENCE:'+item.version,'DTSTAMP:'+stamp,'DTSTART:'+start,'DTEND:'+end,'SUMMARY:'+text(item.title),'LOCATION:'+text(item.location),'URL:'+link(item.app_url),'END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 const result=encoder.encode(lines.map(fold).join(''));if(result.length>maxBytes)throw Error('CALENDAR_TOO_LARGE');return result;
}
