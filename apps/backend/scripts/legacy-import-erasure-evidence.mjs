import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {importStorage,parseImportCsv} from '../supabase/functions/backend-v1/import-file.ts';

const sha256=value=>createHash('sha256').update(value).digest('hex');
const reference=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const referenceHash=(requestId,value)=>reference.test(value??'')?sha256(`${requestId}:${value.toLowerCase()}`):null;

const sourceQuery=lock=>`select j.id as job_id,p.id as request_id,f.org_id,i.id as import_job_id,i.mapping,
 f.object_key,f.size_bytes::int as bytes,f.checksum,s.id as object_id,to_jsonb(s)->>'version' as object_version
 from private.p07_storage_erasure_job($1) j
 join core.privacy_requests p on p.id=j.request_id and p.org_id=j.org_id
 join core.organizations o on o.id=j.org_id and o.state='deletion_pending'
 join core.files f on f.id=$2 and f.org_id=o.id
 join private.p06_files u on u.file_id=f.id
 join core.accounts account on account.id=u.account_id
 join private.organization_import_source_erasure_approvals a on a.request_id=p.id and a.org_id=o.id
  and a.file_id=f.id and a.checksum=f.checksum and a.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
 join core.import_jobs i on i.id=a.import_job_id and i.org_id=o.id and i.center_id=f.center_id
  and i.file_id=f.id and i.file_checksum=f.checksum and i.requester_account_id=u.account_id and i.state='succeeded'
 join private.p06_jobs w on w.job_id=i.id and w.org_id=o.id and w.phase='apply'
  and w.operation='import_rows_process_v1' and w.account_id=u.account_id and w.center_id=i.center_id
  and w.request->>'file_id'=f.id::text and w.request->>'source_namespace'=i.source_namespace
  and w.request->'mapping'=i.mapping
 join core.previews preview on preview.id=i.preview_id and preview.org_id=o.id and preview.actor_account_id=u.account_id
  and preview.operation='import_apply_v1' and preview.state='applied' and preview.scope_hash=md5(w.request::text)
 join storage.objects s on s.bucket_id='ftksaas-imports' and s.name=f.object_key
 join storage.buckets b on b.id=s.bucket_id and not b.public
 where j.state='running' and j.operation_key is not null and j.lease_hash is not null
  and j.lease_until>clock_timestamp()
  and p.kind='organization_delete' and p.state in ('requested','running','partial')
  and p.scope->>'org_id'=o.id::text and p.scope->'all_data'='true'::jsonb
  and f.purpose='import' and f.state='ready' and f.expires_at is null and f.mime='text/csv'
  and f.object_key=o.id::text||'/'||f.id::text and f.size_bytes between 1 and 2097152
  and coalesce(i.mapping->>'kind','students')='students'
  and coalesce(to_jsonb(b)->>'versioning_status','DISABLED')='DISABLED'
  and coalesce(to_jsonb(s)->>'owner_id',to_jsonb(s)->>'owner',account.auth_user_id::text)
      is not distinct from account.auth_user_id::text
  and private.organization_erasure_fence_ready(p.id,o.id)
  and exists(select 1 from private.p07_storage_erasure_scopes scope
   where scope.request_id=p.id and scope.file_id=f.id and scope.provider_origin=$3
    and scope.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
    ${lock?'for share of scope nowait':''})
 ${lock?'for share of p,o,f,u,a,account,i,w,preview,s,b nowait':''}`;

// A previously scrubbed row has one extra version, except a parser-rejected
// row that was born empty. An unmatched row invalidates the entire file.
const witnessQuery=`with parsed as (
 select * from jsonb_to_recordset($5::jsonb) as x(row_number bigint, source_key_hash text,
  parser_invalid boolean, empty_payload boolean, person_hash text, product_hash text)
), matched as materialized (
 select r.id,r.version,r.state,x.person_hash,x.product_hash,
  r.id is not null and x.row_number is not null
  and r.org_id=$2 and r.center_id=i.center_id and r.source_namespace=i.source_namespace
  and encode(extensions.digest(r.source_key,'sha256'),'hex')=x.source_key_hash
  and r.payload='{}'::jsonb
  and case r.state
   when 'applied' then not x.parser_invalid and r.version=4
   when 'invalid' then r.version=(case when x.parser_invalid then 1 else 2 end)
    +(case when x.empty_payload then 0 else 1 end)
    and (not x.parser_invalid or r.error_code='VALIDATION_FAILED')
   when 'failed' then not x.parser_invalid and r.version=4
   else false
  end and (e.import_row_id is null or (e.file_id=$3 and e.org_id=$2 and e.import_job_id=$4
    and e.file_checksum=$6 and e.row_version=r.version and e.row_state=r.state
    and e.person_reference_sha256 is not distinct from x.person_hash
    and e.product_reference_sha256 is not distinct from x.product_hash)) as valid,
  e.import_row_id is null as missing
 from (select * from core.import_rows where job_id=$4) r
 full join parsed x on x.row_number=r.row_number
 join core.import_jobs i on i.id=$4
 left join private.organization_import_rejected_row_evidence e on e.request_id=$1 and e.import_row_id=r.id
), inserted as (
 insert into private.organization_import_rejected_row_evidence(request_id,org_id,import_job_id,file_id,
  import_row_id,file_checksum,row_version,row_state,person_reference_sha256,product_reference_sha256)
 select $1,$2,$4,$3,id,$6,version,state,person_hash,product_hash from matched
 where missing and state in ('invalid','failed') and not exists(select 1 from matched where valid is not true)
 returning 1
)
select exists(select 1 from matched) and not exists(select 1 from matched where valid is not true) as confirmed,
 count(*)::int as recovered from inserted`;

// Uses a dedicated, privileged operator connection and the existing scoped
// lease. The source and parsed payloads live only in memory. The normal
// worker and separate attestor still own the actual Storage deletion.
export async function recoverLegacyImportEvidence({db,request,fileId,apiUrl,serviceKey,fetcher=fetch}){
 const origin=new URL(apiUrl).origin;
 const sourceArgs=[request,fileId,origin];
 const {rows:sources}=await db.query(sourceQuery(false),sourceArgs);
 if(sources.length!==1)throw Error('IMPORT_EVIDENCE_SOURCE_UNCONFIRMED');
 const [source]=sources;
 let parsed;
 try{
  const storage=importStorage(origin,serviceKey,(url,options)=>fetcher(url,{...options,redirect:'error'}));
  parsed=parseImportCsv(await storage.read(source),source.mapping,5000);
 }catch{
  throw Error('IMPORT_EVIDENCE_SOURCE_UNCONFIRMED');
 }
 const witnesses=parsed.map(({row_number,payload,error_code})=>({
  row_number,source_key_hash:sha256(String(payload.source_key??'')),parser_invalid:error_code!==null,
  empty_payload:Object.keys(payload).length===0,person_hash:referenceHash(source.request_id,payload.person_ref),
  product_hash:referenceHash(source.request_id,payload.product_version_ref)
 }));

 await db.query('begin isolation level read committed');
 try{
  const {rows:current}=await db.query(sourceQuery(true),sourceArgs);
  if(!isDeepStrictEqual(current,sources))throw Error('IMPORT_EVIDENCE_SOURCE_UNCONFIRMED');
  await db.query(`lock table core.retention_holds,core.import_jobs,core.import_rows,core.outbox_jobs,core.previews,
   core.operation_receipts,core.public_applications,core.person_contacts,private.p06_jobs,private.p06_previews,
   private.p06_sources,private.p06_contexts,private.preview_payloads in share mode nowait`);
  const [{confirmed,recovered}]=(await db.query(witnessQuery,[source.request_id,source.org_id,fileId,source.import_job_id,
   JSON.stringify(witnesses),source.checksum])).rows;
  if(!confirmed)throw Error('IMPORT_EVIDENCE_ROWS_UNCONFIRMED');
  await db.query('select (private.p07_storage_import_target(j,$2)).id from private.p07_privacy_jobs j where id=$1',[source.job_id,fileId]);
  const [{active}]=(await db.query('select lease_until>clock_timestamp() as active from private.p07_privacy_jobs where id=$1',[source.job_id])).rows;
  if(!active)throw Error('OPERATION_IN_PROGRESS');
  await db.query('commit');
  return {recovered};
 }catch(error){
  await db.query('rollback');
  throw error;
 }
}
