// Server-only Storage adapter. No service key or object path is accepted from a client.
const bucket='ftksaas-documents';
const encoded=(path:string)=>path.split('/').map(encodeURIComponent).join('/');
export const contentHash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export function documentStorage(base:string,key:string,fetcher:typeof fetch=fetch){
 const headers={authorization:'Bearer '+key,apikey:key};
 const path=(objectKey:string)=>{if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(objectKey))throw Error('INVALID_STORAGE_PATH');return encoded(objectKey);};
 return {
  async upload(objectKey:string){
   const r=await fetcher(base+'/storage/v1/object/upload/sign/'+bucket+'/'+path(objectKey),{method:'POST',headers:{...headers,'content-type':'application/json','x-upsert':'false'},body:JSON.stringify({upsert:false}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error('STORAGE_UNAVAILABLE');const data=await r.json();
   if(typeof data.url!=='string'||!data.url.startsWith('/object/upload/sign/'+bucket+'/'))throw Error('INVALID_STORAGE_RESPONSE');
   // Resolve against the configured public Supabase API origin on the client;
   // local Edge's SUPABASE_URL can be the private Kong hostname.
   return '/storage/v1'+data.url;
  },
  async download(objectKey:string,expected?:{bytes:number;mime:string;checksum?:string}){
   const r=await fetcher(base+'/storage/v1/object/authenticated/'+bucket+'/'+path(objectKey),{headers,signal:AbortSignal.timeout(15000)});
   if(!r.ok||!r.body)throw Error('STORAGE_UNAVAILABLE');
   const mime=r.headers.get('content-type')?.split(';')[0];if(!mime||!['application/pdf','text/plain'].includes(mime)||expected&&mime!==expected.mime)throw Error('INVALID_FILE_MIME');
   const limit=expected?.bytes??2097152;let size=0;const chunks:Uint8Array[]=[];const reader=r.body.getReader();
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit||size>2097152)throw Error('INVALID_FILE_SIZE');chunks.push(value);}}catch(e){await reader.cancel();throw e;}
   if(expected&&size!==expected.bytes)throw Error('INVALID_FILE_SIZE');
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   if(mime==='application/pdf'&&new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('INVALID_FILE_MIME');
   if(mime==='text/plain'){new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(bytes.includes(0))throw Error('INVALID_FILE_MIME');}
   const checksum=await contentHash(bytes);if(expected?.checksum&&expected.checksum!==checksum)throw Error('INVALID_FILE_CHECKSUM');
   return {bytes,size,mime,checksum};
  }
 };
}
