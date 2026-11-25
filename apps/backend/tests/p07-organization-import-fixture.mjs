import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {context,must} from './api-client.mjs';
import {tick} from '../scripts/p06-worker.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {sha256} from '../scripts/restore-guard.mjs';

export async function seedOrganizationStudentImport({db,org,center,owner}){
 const {API_URL,ANON_KEY,DB_URL}=context().env;
 const filename='Synthetic roster source.csv';
 const bytes=Buffer.from('source_key,display_name\r\nlegacy-student-key,Synthetic imported student\r\ninvalid-row-key,\r\n');
 const checksum=sha256(bytes);
 const call=(operation,args)=>must(owner,operation,{org_id:org,center_id:center,...args},key());
 await db.query('insert into private.p06_configuration values($1,2097152,5000,16777216)',[org]);
 const upload=await call('import_upload_prepare_v1',{filename,mime:'text/csv',bytes:bytes.length,checksum});
 const response=await fetch(new URL(upload.upload_url,API_URL),{method:'PUT',
  headers:{apikey:ANON_KEY,'content-type':'text/csv'},body:bytes,signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200);
 await response.body?.cancel();
 await call('file_upload_complete_v1',{file_id:upload.file_id,checksum});
 const role='import_roster_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');
 const url=new URL(DB_URL);url.username=role;url.password=password;
 const worker=new pg.Client({connectionString:url.href,statement_timeout:10000});
 await db.query(`create role ${role} login password '${password}' in role ftk_p06_worker`);
 try{
  await db.query('insert into private.p06_worker_scopes values($1,$2)',[role,org]);
  await worker.connect();
  const mapping={columns:['source_key','display_name'].map(target=>({source_column:target,target}))};
  const {job_id:jobId}=await call('import_preview_v1',{file_id:upload.file_id,mapping,source_namespace:'synthetic-roster'});
  for(const result of await tick(worker,org))assert.equal(result.ok,true,result.error?.code);
  const status=await must(owner,'job_status_get_v1',{org_id:org,center_id:center,job_id:jobId});
  const preview=await must(owner,'preview_get_v1',{org_id:org,center_id:center,preview_id:status.result_reference.id});
  await call('import_apply_v1',{preview:{id:preview.id,token:preview.token}});
  for(const result of await tick(worker,org))assert.equal(result.ok,true,result.error?.code);
  const {rows}=await db.query('select id,state,created_references from core.import_rows where job_id=$1 order by row_number',[jobId]);
  assert.deepEqual(rows.map(row=>row.state),['applied','invalid']);
  const [{id:objectId}]=(await db.query("select id from storage.objects where bucket_id='ftksaas-imports' and name=$1",
   [org+'/'+upload.file_id])).rows;
  return {jobId,fileId:upload.file_id,previewId:preview.id,objectId,checksum,filename,
   rowIds:rows.map(row=>row.id),importedPerson:rows[0].created_references[0]};
 }finally{
  await worker.end();
  await db.query('delete from private.p06_worker_scopes where db_role=$1',[role]);
  await db.query(`drop role ${role}`);
 }
}
