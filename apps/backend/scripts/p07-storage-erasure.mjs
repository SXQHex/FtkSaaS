import {createHash} from 'node:crypto';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const allowedMime={
 'ftksaas-imports':['text/csv'],
 'ftksaas-documents':['text/plain','application/pdf']
};

async function verifyBytes(response,expected,mime){
 if(!response.ok||!response.body||response.headers.get('content-type')?.split(';')[0]!==mime){
  await response.body?.cancel();
  throw Error('STORAGE_TARGET_UNCONFIRMED');
 }
 const reader=response.body.getReader(),hash=createHash('sha256');
 let length=0;
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>expected.bytes)throw Error('STORAGE_TARGET_UNCONFIRMED');
   hash.update(value);
  }
 }catch{
  await reader.cancel();
  throw Error('STORAGE_TARGET_UNCONFIRMED');
 }
 if(length!==expected.bytes||hash.digest('hex')!==expected.checksum)throw Error('STORAGE_TARGET_UNCONFIRMED');
}

async function readJson(response){
 try{return await response.json();}
 catch{return null;}
}

function storageOrigin(apiUrl,serviceKey){
 const origin=new URL(apiUrl);
 if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'
  ||!(origin.protocol==='https:'&&/^[a-z]{20}\.supabase\.co$/.test(origin.hostname)
   ||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname)))throw Error('UNTRUSTED_STORAGE_ORIGIN');
 if(typeof serviceKey!=='string'||!serviceKey)throw Error('STORAGE_ADMIN_KEY_REQUIRED');
 return origin.origin;
}

export async function eraseExpiredImportObject({db,attestor,request,fileId,apiUrl,serviceKey,fetcher=fetch}){
 const origin=storageOrigin(apiUrl,serviceKey);
 if(typeof fileId!=='string'||!uuid.test(fileId))throw Error('INVALID_STORAGE_FILE');
 if(typeof attestor?.query!=='function'||attestor===db)throw Error('STORAGE_ATTESTOR_REQUIRED');
 const args=[request,fileId];
 const prepared=(await db.query('select private.p07_storage_erasure_prepare($1,$2) result',args)).rows[0].result;
 if(['unbound','held','absent','unconfirmed','completed'].includes(prepared?.state))return{state:prepared.state};
 await deletePreparedStorageObject({origin,serviceKey,prepared,fileId,fetcher});
 const proof=(await attestor.query('select private.p07_storage_erasure_confirm($1,$2) result',args)).rows[0].result;
 if(proof?.state!=='completed')throw Error('STORAGE_PROOF_UNCONFIRMED');
 return{state:'completed'};
}

export async function deletePreparedInvoiceObject({apiUrl,serviceKey,prepared,invoiceId,fetcher=fetch}){
 const origin=storageOrigin(apiUrl,serviceKey);
 return deletePreparedStorageObject({origin,serviceKey,prepared,fileId:invoiceId,fetcher,invoice:true});
}

export async function erasePreparedDocumentObject({apiUrl,serviceKey,prepared,fetcher=fetch,acknowledge}){
 const origin=storageOrigin(apiUrl,serviceKey);
 if(prepared?.bucket_id!=='ftksaas-documents'||!['ready','readback'].includes(prepared.state)
  ||typeof acknowledge!=='function')throw Error('INVALID_STORAGE_PREPARATION');
 await deletePreparedStorageObject({origin,serviceKey,prepared,fileId:prepared.file_id,fetcher,acknowledge,
  readbackOnly:prepared.state==='readback'});
}

async function deletePreparedStorageObject({origin,serviceKey,prepared,fileId,fetcher,invoice=false,acknowledge,readbackOnly=false}){
 const objectKey=prepared?.object_key,segments=typeof objectKey==='string'?objectKey.split('/'):[];
 // Older deployed import preparations predate the explicit bucket and MIME.
 const legacy=!invoice&&prepared?.bucket_id===undefined&&prepared?.mime===undefined;
 const bucket=legacy?'ftksaas-imports':prepared?.bucket_id;
 const mime=legacy?'text/csv':prepared?.mime;
 const supported=invoice?bucket==='ftksaas-invoices'&&['application/pdf','application/zip'].includes(mime)
  :Object.hasOwn(allowedMime,bucket)&&allowedMime[bucket].includes(mime);
 if(prepared?.state!==(readbackOnly?'readback':'ready')||segments.length!==2||!uuid.test(segments[0])||!uuid.test(fileId)||segments[1]!==fileId
  ||!supported
  ||!Number.isSafeInteger(prepared.bytes)||prepared.bytes<1||prepared.bytes>2097152||!/^[a-f0-9]{64}$/.test(prepared.checksum??'')){
  throw Error('INVALID_STORAGE_PREPARATION');
 }
 if(prepared.provider_origin!==origin)throw Error('STORAGE_PROVIDER_BINDING_MISMATCH');
 const headers={apikey:serviceKey,authorization:'Bearer '+serviceKey};
 const endpoint=origin+'/storage/v1/object/';
 const download=()=>fetcher(endpoint+'authenticated/'+bucket+'/'+objectKey,{
  method:'GET',headers:{...headers,'cache-control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(8000)
 });
 if(!readbackOnly){
  await verifyBytes(await download(),prepared,mime);
  let removed;
  try{
   removed=await fetcher(endpoint+bucket+'/'+objectKey,{
    method:'DELETE',headers,redirect:'error',signal:AbortSignal.timeout(15000)
   });
  }catch{throw Error('STORAGE_DELETE_UNCONFIRMED');}
  const result=await readJson(removed);
  if(removed.status!==200||result?.message!=='Successfully deleted')throw Error('STORAGE_DELETE_UNCONFIRMED');
  if(acknowledge)await acknowledge();
 }
 let readback;
 try{readback=await download();}
 catch{throw Error('STORAGE_ABSENCE_UNCONFIRMED');}
 const absence=await readJson(readback);
 if(![400,404].includes(readback.status)
  ||!(absence?.code==='NoSuchKey'||absencesMatchLegacyShape(absence))){
  throw Error('STORAGE_ABSENCE_UNCONFIRMED');
 }
}

function absencesMatchLegacyShape(result){
 return String(result?.statusCode)==='404'&&result?.error==='not_found'&&result?.message==='Object not found';
}
