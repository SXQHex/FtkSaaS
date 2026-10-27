import {contentHash} from './document-storage.ts';
type Column={source_column:string;target:string};
const targets=new Set(['display_name','email','phone','source_key','person_ref','opening_credits','opening_debt_minor','opening_credit_value_minor','currency','product_version_ref','start_date','end_date']);
// Strict RFC4180, including escaped quotes and quoted line breaks. Headers are
// exact, unique names; malformed structure fails the file, typed values fail a row.
export function parseImportCsv(text:string,mapping:{columns:Column[];delimiter?:','|';'},maxRows:number){
 const delimiter=mapping.delimiter===undefined?',':mapping.delimiter;
 if(delimiter!==','&&delimiter!==';')throw Error('VALIDATION_FAILED');
 if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>5000||text.includes('\0'))throw Error('VALIDATION_FAILED');
 text=text.replace(/^\uFEFF/,'');let cell='',line:string[]=[],lines:string[][]=[],quoted=false,closed=false;
 const field=()=>{line.push(cell);cell='';closed=false;if(line.length>100)throw Error('VALIDATION_FAILED');};
 const row=()=>{field();lines.push(line);line=[];if(lines.length>maxRows+1)throw Error('VALIDATION_FAILED');};
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch===delimiter){field();continue;}
  if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;row();continue;}
  if(ch==='"'&&!cell&&!closed){quoted=true;continue;}
  if(ch==='"'||closed)throw Error('VALIDATION_FAILED');cell+=ch;
 }
 if(quoted)throw Error('VALIDATION_FAILED');if(cell||line.length||closed)row();
 if(lines.length<2)throw Error('VALIDATION_FAILED');const headers=lines.shift()!;
 if(headers.some(x=>!x.trim())||new Set(headers).size!==headers.length)throw Error('VALIDATION_FAILED');
 if(!mapping.columns.length||mapping.columns.length>100)throw Error('VALIDATION_FAILED');
 const source=new Set<string>(),seen=new Set<string>();
 for(const c of mapping.columns){
  if(!targets.has(c.target)||!headers.includes(c.source_column)||source.has(c.source_column)||(seen.has(c.target)&&!['email','phone'].includes(c.target)))throw Error('VALIDATION_FAILED');
  source.add(c.source_column);seen.add(c.target);
 }
 if(!seen.has('source_key')||!seen.has('display_name'))throw Error('VALIDATION_FAILED');
 const keys=new Set<string>();
 return lines.map((cells,index)=>{
  const payload:Record<string,unknown>={},contacts:{kind:string;value:string}[]=[];let error:string|null=cells.length!==headers.length?'VALIDATION_FAILED':null;
  for(const c of mapping.columns){const value=cells[headers.indexOf(c.source_column)]?.trim()??'';if(!value)continue;
   if(c.target==='email'||c.target==='phone'){contacts.push({kind:c.target,value});if(payload[c.target]===undefined)payload[c.target]=value;}
   else if(c.target==='opening_credits'){
    if(!/^(0|[1-9][0-9]*)$/.test(value)||!Number.isSafeInteger(Number(value)))error='VALIDATION_FAILED';else payload[c.target]=Number(value);
   }else if(c.target.endsWith('_minor')){
    if(!/^(0|[1-9][0-9]{0,18})$/.test(value)||BigInt(value)>9223372036854775807n)error='VALIDATION_FAILED';else payload[c.target]=value;
   }else payload[c.target]=value;
  }
  if(contacts.length)payload.contacts=contacts;
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  for(const f of ['person_ref','product_version_ref'])if(payload[f]&&!uuid.test(String(payload[f])))error='VALIDATION_FAILED';
  for(const f of ['start_date','end_date'])if(payload[f]&&(!/^\d{4}-\d{2}-\d{2}$/.test(String(payload[f]))||!Number.isFinite(Date.parse(String(payload[f])))||new Date(String(payload[f])).toISOString().slice(0,10)!==payload[f]))error='VALIDATION_FAILED';
  if(payload.currency&&!/^[A-Z]{3}$/.test(String(payload.currency)))error='VALIDATION_FAILED';
  if(contacts.some(c=>c.value.length>320||(c.kind==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value))))error='VALIDATION_FAILED';
  const key=String(payload.source_key??'');if(!key||!payload.display_name||key.length>500||String(payload.display_name).length>500||keys.has(key))error='VALIDATION_FAILED';keys.add(key);
  return {row_number:index+1,payload,error_code:error};
 });
}
export function importStorage(base:string,key:string,fetcher:typeof fetch=fetch){
 const headers={authorization:'Bearer '+key,apikey:key};const bucket='ftksaas-imports';
 const path=(p:string)=>{if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(p))throw Error('VALIDATION_FAILED');return p;};
 return {
  async upload(objectKey:string){
   const r=await fetcher(base+'/storage/v1/object/upload/sign/'+bucket+'/'+path(objectKey),{method:'POST',headers:{...headers,'content-type':'application/json','x-upsert':'false'},body:JSON.stringify({upsert:false}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error('STORAGE_UNAVAILABLE');const data=await r.json();if(typeof data.url!=='string'||!data.url.startsWith('/object/upload/sign/'+bucket+'/'))throw Error('INVALID_STORAGE_RESPONSE');return '/storage/v1'+data.url;
  },
  async read(meta:{object_key:string;bytes:number;checksum:string;max_rows:number}){
   if(!Number.isSafeInteger(meta.bytes)||meta.bytes<1||meta.bytes>2097152)throw Error('VALIDATION_FAILED');
   const r=await fetcher(base+'/storage/v1/object/authenticated/'+bucket+'/'+path(meta.object_key),{headers,signal:AbortSignal.timeout(15000)});
   if(!r.ok||!r.body||r.headers.get('content-type')?.split(';')[0]!=='text/csv')throw Error('VALIDATION_FAILED');
   const reader=r.body.getReader(),chunks:Uint8Array[]=[];let length=0;
   try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>meta.bytes||length>2097152)throw Error('VALIDATION_FAILED');chunks.push(value);}}catch(e){await reader.cancel();throw e;}
   if(length!==meta.bytes)throw Error('VALIDATION_FAILED');const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
   if(await contentHash(bytes)!==meta.checksum)throw Error('VALIDATION_FAILED');return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  }
 };
}
