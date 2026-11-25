import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {canonical,sha256} from './restore-guard.mjs';

const maxObjectBytes=128*1024*1024;
const strongETag=/^"[a-f0-9]{32,64}"$/;
const r2Endpoint=/^https:\/\/[a-f0-9]{32}(?:\.(?:eu|us|fedramp|fedramp-high))?\.r2\.cloudflarestorage\.com$/;
const bucketName=/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const credential=/^[a-zA-Z0-9_-]{16,256}$/;

export async function writeR2ImmutableEvidence({store,key,bytes,expectedSha256}){
 if(!Buffer.isBuffer(bytes)||sha256(bytes)!==expectedSha256)throw Error('R2_EVIDENCE_DIGEST_MISMATCH');
 try{await store.put(key,bytes,{ifNoneMatch:'*'});}
 catch(error){if(!['R2_ERASURE_PRECONDITION_FAILED','R2_ERASURE_OBJECT_LOCKED'].includes(error.message))throw error;}
 const stored=await store.get(key);
 if(!Buffer.isBuffer(stored?.bytes)||!stored.bytes.equals(bytes))throw Error('R2_IMMUTABLE_EVIDENCE_CONFLICT');
 return {sha256:expectedSha256,bytes:bytes.length};
}

// curl signs the S3 request. The credentials are passed on stdin, never argv,
// and untrusted response bodies or process diagnostics never leave this adapter.
export function createR2S3ObjectStore({endpoint,bucket,accessKeyId,secretAccessKey,workDirectory,readOnly=false}){
 if(typeof endpoint!=='string'||!r2Endpoint.test(endpoint)||typeof bucket!=='string'||!bucketName.test(bucket)
  ||typeof accessKeyId!=='string'||!credential.test(accessKeyId)||typeof secretAccessKey!=='string'||!credential.test(secretAccessKey)
  ||typeof workDirectory!=='string'||!path.isAbsolute(workDirectory)||typeof readOnly!=='boolean')throw Error('INVALID_R2_S3_CONFIGURATION');
 const curlConfig='user = "'+accessKeyId+':'+secretAccessKey+'"\n';

 async function request(method,key,input,precondition){
  if(typeof key!=='string'||key.length>512||key.split('/').some(part=>!(/^[a-z0-9][a-z0-9._-]{0,127}$/).test(part)))throw Error('INVALID_R2_OBJECT_KEY');
  const directory=await fs.mkdtemp(path.join(workDirectory,'.r2-'));
  try{
   const output=path.join(directory,'response');
   const args=['--disable','--config','-','--silent','--proto','=https','--request',method,'--aws-sigv4','aws:amz:auto:s3',
    '--connect-timeout','4','--max-time','20','--max-filesize',String(maxObjectBytes),'--output',output,
    '--write-out','%{http_code}\n%header{etag}',endpoint+'/'+bucket+'/'+key];
   if(input!==undefined){
    const payload=path.join(directory,'payload');
    await fs.writeFile(payload,input,{mode:0o600});
    args.push('--data-binary','@'+payload,'--header','Content-Type: application/octet-stream',
     '--header','x-amz-content-sha256: '+sha256(input),'--header',precondition);
   }
   const result=spawnSync('/usr/bin/curl',args,{input:curlConfig,encoding:'utf8',env:{},maxBuffer:4096,timeout:22000});
   if(result.error||result.status!==0)throw Error(method==='PUT'?'R2_PUT_OUTCOME_UNKNOWN':'R2_GET_FAILED');
   const [status,etag]=result.stdout.split('\n');
   if(status==='200'&&method==='PUT'){
    if(!strongETag.test(etag))throw Error('R2_STRONG_ETAG_REQUIRED');
    return {etag};
   }
   const info=await fs.stat(output);
   if(!info.isFile()||info.size>maxObjectBytes)throw Error('R2_INVALID_OBJECT_RESPONSE');
   const bytes=await fs.readFile(output);
   if(status==='200'){
    if(!strongETag.test(etag))throw Error('R2_STRONG_ETAG_REQUIRED');
    return {bytes,etag};
   }
   const code=bytes.length<=16384?bytes.toString('utf8').match(/<Code>([A-Za-z]+)<\/Code>/)?.[1]:null;
   if(method==='GET'&&status==='404'&&code==='NoSuchKey')return null;
   if(status==='401'||status==='403')throw Error('R2_S3_FORBIDDEN');
   if(method==='PUT'&&status==='412')throw Error('R2_ERASURE_PRECONDITION_FAILED');
   if(method==='PUT'&&status==='409'&&code==='ObjectLockedByBucketPolicy')throw Error('R2_ERASURE_OBJECT_LOCKED');
   throw Error(method==='PUT'?'R2_PUT_REJECTED':'R2_GET_REJECTED');
  }finally{await fs.rm(directory,{recursive:true,force:true});}
 }

 const store={identitySha256:sha256(canonical({endpoint,bucket})),get:key=>request('GET',key)};
 if(!readOnly)store.put=(key,bytes,condition)=>{
  if(!Buffer.isBuffer(bytes)||bytes.length>maxObjectBytes)throw Error('INVALID_R2_OBJECT_BYTES');
  if(condition?.ifNoneMatch==='*'&&Object.keys(condition).length===1)return request('PUT',key,bytes,'If-None-Match: *');
  if(typeof condition?.ifMatch==='string'&&strongETag.test(condition.ifMatch)&&Object.keys(condition).length===1)
   return request('PUT',key,bytes,'If-Match: '+condition.ifMatch);
  throw Error('R2_CONDITIONAL_WRITE_REQUIRED');
 };
 return Object.freeze(store);
}
