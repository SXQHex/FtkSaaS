import {contentHash} from './document-storage.ts';
export const settingsImageMaxBytes=1048576;
type Image={mime:'image/png'|'image/jpeg'|'image/webp';data_base64:string;checksum:string};
// Check the bounded binary envelope and derive MIME from bytes. This is not a
// raster codec/transcoder; no SVG, HTML, URL or caller-supplied storage path.
export async function verifySettingsImage(image:Image){
 if(typeof image.data_base64!=='string'||image.data_base64.length>1398104)throw Error('VALIDATION_FAILED');
 let raw:string;try{raw=atob(image.data_base64);}catch{throw Error('VALIDATION_FAILED');}
 if(!raw.length||raw.length>settingsImageMaxBytes||btoa(raw)!==image.data_base64)throw Error('VALIDATION_FAILED');
 const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),v=new DataView(bytes.buffer);
 const ascii=(at:number,n:number)=>String.fromCharCode(...bytes.slice(at,at+n));let mime:string|undefined;
 if(bytes.length>=45&&bytes.slice(0,8).every((x,i)=>x===[137,80,78,71,13,10,26,10][i])){
  if(v.getUint32(8)!==13||ascii(12,4)!=='IHDR'||!v.getUint32(16)||!v.getUint32(20)||ascii(bytes.length-8,4)!=='IEND'||v.getUint32(bytes.length-12)!==0)throw Error('VALIDATION_FAILED');mime='image/png';
 }else if(bytes.length>=16&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217){
  let at=2,frame=false,scan=false;
  while(at<bytes.length-2){
   if(bytes[at++]!==255)throw Error('VALIDATION_FAILED');while(bytes[at]===255)at++;
   const marker=bytes[at++];if(marker===undefined||marker===0||marker===216||marker===217)throw Error('VALIDATION_FAILED');
   if(marker===1||marker>=208&&marker<=215)continue;
   if(at+2>bytes.length)throw Error('VALIDATION_FAILED');const n=v.getUint16(at);if(n<2||at+n>bytes.length-2)throw Error('VALIDATION_FAILED');
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
    if(n<8||!v.getUint16(at+3)||!v.getUint16(at+5))throw Error('VALIDATION_FAILED');frame=true;
   }
   if(marker===218){scan=true;break;}at+=n;
  }
  if(!frame||!scan)throw Error('VALIDATION_FAILED');mime='image/jpeg';
 }else if(bytes.length>=20&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'&&v.getUint32(4,true)===bytes.length-8){
  let at=12,frame=false;
  while(at<bytes.length){
   if(at+8>bytes.length)throw Error('VALIDATION_FAILED');const kind=ascii(at,4),n=v.getUint32(at+4,true),end=at+8+n;if(end>bytes.length)throw Error('VALIDATION_FAILED');
   if(kind==='VP8 '){if(n<10||ascii(at+11,3)!=='\x9d\x01\x2a'||!(v.getUint16(at+14,true)&16383)||!(v.getUint16(at+16,true)&16383))throw Error('VALIDATION_FAILED');frame=true;}
   if(kind==='VP8L'){if(n<5||bytes[at+8]!==47)throw Error('VALIDATION_FAILED');frame=true;}
   if(kind==='ANMF'){if(n<16)throw Error('VALIDATION_FAILED');frame=true;}
   at=end+(n%2);if(at>bytes.length)throw Error('VALIDATION_FAILED');
  }
  if(!frame)throw Error('VALIDATION_FAILED');mime='image/webp';
 }
 if(mime!==image.mime||await contentHash(bytes)!==image.checksum)throw Error('VALIDATION_FAILED');
 return {image_verified:true,image_mime:mime,image_bytes:bytes.length,image_checksum:image.checksum};
}
