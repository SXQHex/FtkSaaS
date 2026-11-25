import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {eraseExpiredImportObject} from '../scripts/p07-storage-erasure.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

const bucket='ftksaas-documents';

export async function seedManagedDraftDocument({db,org,center,person,account,apiUrl,serviceKey}){
 const url=new URL(apiUrl);
 assert.equal(url.protocol,'http:');
 assert(['localhost','127.0.0.1'].includes(url.hostname));
 const fileId=key(),objectKey=org+'/'+fileId,raw=Buffer.from('Synthetic disposable document draft\n');
 const checksum=createHash('sha256').update(raw).digest('hex');
 const bytes=raw.byteLength,mime='text/plain';
 const objectApi=url.origin+'/storage/v1/object/';
 const headers={apikey:serviceKey,authorization:'Bearer '+serviceKey};
 await db.query("insert into core.files(id,org_id,center_id,owner_person_id,object_key,mime,size_bytes,checksum,purpose,state) values($1,$2,$3,$4,$5,$6,$7,$8,'document','ready')",
  [fileId,org,center,person,objectKey,mime,bytes,checksum]);
 await db.query('insert into private.p05_files(file_id,account_id,name) values($1,$2,$3)',[fileId,account,'Synthetic draft filename']);
 const uploaded=await fetch(objectApi+bucket+'/'+objectKey,{
  method:'POST',headers:{...headers,'content-type':mime,'x-upsert':'false'},body:raw
 });
 assert.equal(uploaded.ok,true,'Native unpublished draft upload failed');
 await uploaded.body?.cancel();
 const signing=await fetch(objectApi+'sign/'+bucket+'/'+objectKey,{
  method:'POST',headers:{...headers,'content-type':'application/json'},body:'{"expiresIn":600}'
 });
 assert.equal(signing.ok,true);
 const signedUrl=url.origin+'/storage/v1'+(await signing.json()).signedURL;
 const download=await fetch(signedUrl);
 assert.equal(download.ok,true);
 assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'),checksum);
 const result=await db.query('select id from storage.objects where bucket_id=$1 and name=$2',[bucket,objectKey]);
 assert.equal(result.rows.length,1);
 return {fileId,objectId:result.rows[0].id,objectKey,signedUrl,checksum,bytes};
}

export async function eraseManagedDraftDocument({db,worker,attestor,request,requestId,apiUrl,serviceKey,draft}){
 const workerRole=(await worker.query('select session_user as role')).rows[0].role;
 const attestorRole=(await attestor.query('select session_user as role')).rows[0].role;
 await db.query('insert into private.p07_storage_erasure_scopes(db_role,request_id,file_id,provider_origin,attestor_role) values($1,$2,$3,$4,$5)',
  [workerRole,requestId,draft.fileId,new URL(apiUrl).origin,attestorRole]);
 assert.deepEqual(await eraseExpiredImportObject({db:worker,attestor,request,fileId:draft.fileId,apiUrl,serviceKey}),{state:'completed'});
 const prior=await fetch(draft.signedUrl);
 assert.equal(prior.ok,false);
 await prior.body?.cancel();
 assert.deepEqual((await db.query('select id from storage.objects where id=$1',[draft.objectId])).rows,[]);
 const [evidence]=(await db.query('select object_id,removed_bytes,checksum from private.p07_storage_erasures where request_id=$1 and file_id=$2',
  [requestId,draft.fileId])).rows;
 assert.deepEqual(evidence,{object_id:draft.objectId,removed_bytes:String(draft.bytes),checksum:draft.checksum});
 return evidence;
}
