import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import pg from 'pg';
import {preparationFixture} from './starter-preparation-fixture.mjs';
import {authUser,context,must} from './api-client.mjs';
import {eraseExpiredImportObject} from '../scripts/p07-storage-erasure.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

export async function verifyNativeStorageErasure(){
 const {db,org,center,owner,account,platform,plan,person}=await preparationFixture();
 const {API_URL,ANON_KEY,SERVICE_ROLE_KEY,DB_URL}=context().env;
 const headers={apikey:SERVICE_ROLE_KEY,authorization:'Bearer '+SERVICE_ROLE_KEY};
 const bucket='ftksaas-imports';
 const base=API_URL+'/storage/v1/object/';
 const bytes=Buffer.from('source_key,display_name\r\nfixture,Synthetic import\r\n');
 const checksum=createHash('sha256').update(bytes).digest('hex');
 const role='storage_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');
 const attestorRole='attestor_'+key().replaceAll('-',''),attestorPassword=randomBytes(24).toString('hex');
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const bank=()=>Array.from({length:512},key);
 let worker,attestor,requestId;
 const cleanup=[];
 const upload=async(tenant,location,ownerPerson,uploader=account.id)=>{
  const id=key(),path=tenant+'/'+id;
  await db.query("insert into core.files(id,org_id,center_id,owner_person_id,object_key,mime,size_bytes,checksum,purpose,state,expires_at) values($1,$2,$3,$4,$5,'text/csv',$6,$7,'import','pending_upload',clock_timestamp()+interval '2 hours')",[id,tenant,location,ownerPerson,path,bytes.length,checksum]);
  await db.query('insert into private.p06_files values($1,$2,$3)',[id,uploader,'synthetic.csv']);
  const signed=await fetch(base+'upload/sign/'+bucket+'/'+path,{
   method:'POST',headers:{...headers,'content-type':'application/json','x-upsert':'false'},body:'{"upsert":false}'
  });
  assert.equal(signed.ok,true,'Native upload signing failed');
  const {url}=await signed.json(),uploadUrl=API_URL+'/storage/v1'+url;
  const write=()=>fetch(uploadUrl,{method:'PUT',headers:{apikey:ANON_KEY,'content-type':'text/csv'},body:bytes});
  const response=await write();
  assert.equal(response.ok,true,'Native upload failed');
  await response.body?.cancel();
  cleanup.push(path);
  const download=await fetch(base+'sign/'+bucket+'/'+path,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{"expiresIn":600}'});
  assert.equal(download.ok,true);
  const {signedURL}=await download.json();
  const downloadUrl=API_URL+'/storage/v1'+signedURL;
  const object=(await q('select id from storage.objects where bucket_id=$1 and name=$2',[bucket,path]))[0];
  assert(object?.id);
  return {id,path,objectId:object.id,write,downloadUrl};
 };
 const read=({path})=>fetch(base+'authenticated/'+bucket+'/'+path,{headers});
 const byteHash=async response=>{assert.equal(response.ok,true);return createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');};
 try{
  await db.query('insert into private.p07_lifecycle_config values(true,300) on conflict(singleton) do update set reauth_max_age_seconds=excluded.reauth_max_age_seconds');
  const target=await upload(org,center,person);
  const unknown=await upload(org,center,person);
  const foreignOwner=await authUser('p07-storage-control'),foreignAccount=await must(foreignOwner,'account_get_v1');
  const foreignOrg=(await must(platform,'organization_create_v1',{verified_account_id:foreignAccount.id,name:'Synthetic O05 control tenant',initial_plan_id:plan},key())).primary_id;
  const foreignCenter=(await must(foreignOwner,'center_create_v1',{org_id:foreignOrg,name:'O05 control center',timezone:'UTC'},key())).primary_id;
  const foreignPerson=(await q('select owner_person_id from core.organizations where id=$1',[foreignOrg]))[0].owner_person_id;
  const control=await upload(foreignOrg,foreignCenter,foreignPerson,foreignAccount.id);
  assert.equal(await byteHash(await fetch(target.downloadUrl)),checksum);
  assert.equal(await byteHash(await read(control)),checksum);
  await db.query("update core.files set expires_at=clock_timestamp()-interval '3 hours' where id=any($1::uuid[])",[[target.id,unknown.id,control.id]]);
  const contactPerson=(await must(owner,'person_create_v1',{
   org_id:org,center_id:center,display_name:'Synthetic O04 and O05 rehearsal',contacts:[]
  },key())).primary_id;
  const contactId=key();
  await db.query("insert into core.person_contacts(id,org_id,person_id,kind,value) values($1,$2,$3,'email',$4)",
   [contactId,org,contactPerson,'rehearsal-'+contactId+'@ftksaas.invalid']);

  const preview=await must(owner,'organization_delete_preview_v1',{org_id:org,reason:'synthetic O05 restore acceptance',all_data:true});
  const {job_id}=await must(owner,'organization_delete_apply_v1',{org_id:org,all_data:true,preview:{id:preview.id,token:preview.token},reauth:owner.jwt},key());
  requestId=(await q('select request_id from private.p07_privacy_jobs where id=$1',[job_id]))[0].request_id;
  await db.query(`create role ${role} login password '${password}' in role ftk_p07_privacy_worker`);
  await db.query(`create role ${attestorRole} login password '${attestorPassword}' in role ftk_p07_storage_attestor`);
  await db.query('insert into private.p07_privacy_worker_scopes values($1,$2)',[role,org]);
  await db.query('insert into private.organization_contact_erasure_scopes values($1,$2)',[role,org]);
  const url=new URL(DB_URL);url.username=role;url.password=password;
  worker=new pg.Client({connectionString:url.href,statement_timeout:10000});await worker.connect();
  url.username=attestorRole;url.password=attestorPassword;
  attestor=new pg.Client({connectionString:url.href,statement_timeout:10000});await attestor.connect();
  const claim=async()=> (await worker.query('select private.p07_privacy_claim($1,$2,1) jobs',[org,bank()])).rows[0].jobs[0].request;
  let request=await claim();
  const invoke=(fileId,fetcher)=>eraseExpiredImportObject({db:worker,attestor,request,fileId,serviceKey:SERVICE_ROLE_KEY,apiUrl:API_URL,fetcher});
  const proof=()=>q('select file_id,object_id,removed_bytes,checksum from private.p07_storage_erasures where request_id=$1',[requestId]);
  assert.deepEqual(await invoke(target.id),{state:'unbound'});
  for(const file of [target,unknown,control]){
   await db.query('insert into private.p07_storage_erasure_scopes(db_role,request_id,file_id,provider_origin,attestor_role) values($1,$2,$3,$4,$5)',[role,requestId,file.id,new URL(API_URL).origin,attestorRole]);
  }
  await assert.rejects(invoke(control.id),/FORBIDDEN/);
  await assert.rejects(worker.query('select private.p07_storage_erasure_confirm($1,$2)',[request,target.id]),/permission denied/);
  await assert.rejects(attestor.query('select private.p07_storage_erasure_prepare($1,$2)',[request,target.id]),/permission denied/);
  await assert.rejects(attestor.query('select private.p07_storage_erasure_confirm($1,$2)',[request,target.id]),/RESULT_NOT_CONFIRMED/);
  const h=key();
  const hold=()=>db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,$2,'storage.objects',$3,'Synthetic O05 hold','isolated acceptance',clock_timestamp()-interval '1 day')",[h,org,target.objectId]);
  const release=()=>db.query('delete from core.retention_holds where id=$1',[h]);
  await hold();
  try{assert.deepEqual(await invoke(target.id),{state:'held'});}finally{await release();}
  await assert.rejects(invoke(target.id,async(url,options)=>{
   if(options.method!=='DELETE')return fetch(url,options);
   await hold();
   try{return await fetch(url,options);}finally{await release();}
  }),/STORAGE_DELETE_UNCONFIRMED/);
  assert.equal(await byteHash(await read(target)),checksum);
  assert.deepEqual(await proof(),[]);
  await assert.rejects(invoke(target.id,(url,options)=>{
   if(options.method==='DELETE')throw Error('Synthetic interruption before provider request');
   return fetch(url,options);
  }),/STORAGE_DELETE_UNCONFIRMED/);
  assert.equal(await byteHash(await read(target)),checksum);
  await db.query("update private.p07_privacy_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[job_id]);
  const expired=request;
  request=await claim();
  await assert.rejects(worker.query('select private.p07_storage_erasure_prepare($1,$2)',[expired,target.id]),/FORBIDDEN/);
  assert.deepEqual(await invoke(target.id),{state:'completed'});
  assert.deepEqual(await invoke(target.id),{state:'completed'});
  for(const response of [await read(target),await fetch(target.downloadUrl),await target.write()]){
   assert.equal(response.ok,false);await response.body?.cancel();
  }
  const expected=[{file_id:target.id,object_id:target.objectId,removed_bytes:String(bytes.length),checksum}];
  assert.deepEqual(await proof(),expected);
  await assert.rejects(db.query('delete from private.p07_storage_erasures where file_id=$1',[target.id]),/INTEGRITY_VIOLATION/);
  await assert.rejects(invoke(unknown.id,async(url,options)=>{
   const result=await fetch(url,options);
   if(options.method!=='DELETE')return result;
   assert.equal(result.ok,true);await result.body?.cancel();
   throw Error('Synthetic loss of native acknowledgement');
  }),/STORAGE_DELETE_UNCONFIRMED/);
  assert.deepEqual(await invoke(unknown.id),{state:'unconfirmed'});
  assert.deepEqual(await proof(),expected);
  assert.equal(await byteHash(await read(control)),checksum);
  const stage=(await worker.query('select private.p07_privacy_execute($1,$2) result',[request,bank()])).rows[0].result;
  assert.equal(stage.ok,true,stage.error?.code);
  assert.deepEqual(await invoke(target.id),{state:'completed'});
  const manifest=(await q('select scopes from private.p07_privacy_manifests where request_id=$1',[requestId]))[0].scopes;
  assert.equal(manifest.database.organization_contacts.state,'completed');
  assert.equal((await q('select removed_rows from private.organization_contact_erasures where request_id=$1',[requestId]))[0].removed_rows,'1');
  assert.deepEqual(await q('select id from core.person_contacts where id=$1',[contactId]),[]);
  assert.equal(manifest.storage.state,'pending');
  assert.equal(manifest.storage.import_uploads.confirmed_objects,1);
 }finally{
  if(worker)await worker.end();
  if(attestor)await attestor.end();
  if(requestId)await db.query('delete from private.p07_storage_erasure_scopes where db_role=$1',[role]);
  await db.query('delete from private.organization_contact_erasure_scopes where db_role=$1',[role]);
  await db.query('delete from private.p07_privacy_worker_scopes where db_role=$1',[role]);
  await db.query(`drop role if exists ${role}`);
  await db.query(`drop role if exists ${attestorRole}`);
  for(const path of cleanup){
   const response=await fetch(base+bucket+'/'+path,{method:'DELETE',headers});
   await response.body?.cancel();
  }
  await db.end();
 }
}
