import {createHash} from 'node:crypto';
import {providerFixture} from './crm-provider-fixture.mjs';
import {must,call,context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {tick} from '../scripts/p06-worker.mjs';
export async function importFixture(t){
 const f=await providerFixture(t),{db,org,center,owner,role,client}=f;
 await db.query('insert into private.p06_configuration values($1,2097152,100,2097152)',[org]);await db.query(`grant ftk_p06_worker to "${role}"`);await db.query('insert into private.p06_worker_scopes values($1,$2)',[role,org]);
 const api=(op,body={},operationKey=key())=>must(owner,op,{org_id:org,center_id:center,...body},operationKey);
 const denied=async(op,body,code,operationKey=key())=>{const result=await call(owner,op,{org_id:org,center_id:center,...body},operationKey);if(result.result.ok||result.result.error.code!==code)throw Error('Unexpected import error '+op+' '+JSON.stringify(result.result));};
 const mapping={kind:'crm_applications',columns:['source_key','display_name','phone','email','consents'].map(target=>({source_column:target,target}))};
 const cell=value=>'"'+String(value).replaceAll('"','""')+'"';
 async function preview(rows,namespace=key(),selectedMapping=mapping,actor=owner){
  const invoke=(op,body)=>must(actor,op,{org_id:org,center_id:center,...body},key());
  const csv='source_key,display_name,phone,email,consents\r\n'+rows.map(r=>[r.source_key,r.display_name??'Synthetic legacy candidate',r.phone??'+905550000003',r.email??'',JSON.stringify(r.consents??[])].map(cell).join(',')).join('\r\n')+'\r\n',checksum=createHash('sha256').update(csv).digest('hex');
  const file=await invoke('import_upload_prepare_v1',{filename:'synthetic-crm.csv',mime:'text/csv',bytes:Buffer.byteLength(csv),checksum});
  const uploaded=await fetch(new URL(file.upload_url,context().env.API_URL),{method:'PUT',headers:{apikey:context().env.ANON_KEY,'content-type':'text/csv'},body:csv});if(!uploaded.ok)throw Error('Synthetic CRM upload failed');await invoke('file_upload_complete_v1',{file_id:file.file_id,checksum});
  const job=await invoke('import_preview_v1',{file_id:file.file_id,mapping:selectedMapping,source_namespace:namespace});
  for(let i=0;i<5;i++){const status=await invoke('job_status_get_v1',{job_id:job.job_id});if(status.state==='succeeded'){return {job:job.job_id,preview:await invoke('preview_get_v1',{preview_id:status.result_reference.id}),file:file.file_id,namespace};}const results=await tick(client,org);if(results.some(r=>!r.ok))throw Error('Synthetic CRM preview worker failed');}throw Error('Synthetic CRM preview did not finish');
 }
 const apply=(p,selected,operationKey=key())=>api('import_apply_v1',{preview:{id:p.preview.id,token:p.preview.token},selected_row_numbers:selected},operationKey);
 const work=()=>tick(client,org);
 const counts=async()=>{const rows=(await db.query("select (select count(*) from core.people where org_id=$1) people,(select count(*) from core.center_relationships where org_id=$1 and kind='student') students,(select count(*) from core.sales where org_id=$1) sales,(select count(*) from core.debts where org_id=$1) debts",[org])).rows[0];return rows;};
 return {...f,api,denied,preview,apply,work,counts,mapping};
}
