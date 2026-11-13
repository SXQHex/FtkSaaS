import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {newUuidV7 as key} from '../uuid.mjs';

// Opt-in normal API acceptance against an explicitly synthetic Pro fixture.
// No reset, direct domain writes, real customer file or marketing send.
export async function acceptCrmImport({origin,apikey,email,password,org,center,namespace,advance=async()=>{},onProgress=()=>{},sessionState,saveSessionState,request:send=fetch}){
 const url=new URL(origin);assert(url.origin==='https://gwyprhenabtpkbojephw.supabase.co'||(['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol==='http:'));
 assert(apikey&&email&&password&&org&&center&&namespace?.startsWith('synthetic-p10-'));
 assert(typeof saveSessionState==='function','Private durable session journal required');
 sessionState??={fixture:{origin,org,center,namespace},sessions:[]};assert.deepEqual(sessionState.fixture,{origin,org,center,namespace});
 assert(Array.isArray(sessionState.sessions)&&sessionState.sessions.every(x=>/^[a-f0-9-]{36}$/.test(x.id)&&/^[a-f0-9-]{36}$/.test(x.revokeKey)&&typeof x.cleanupConfirmed==='boolean'&&(x.createdAt===null||Number.isFinite(Date.parse(x.createdAt)))));
 let currentSession,failure,cleanupFailure;
 const receipt={status:'running',namespace,org,center,startedAt:new Date().toISOString(),checks:[],files:[],jobs:[]};let token;
 const save=()=>onProgress(structuredClone(receipt));
 const request=async(path,body,method='POST')=>{
  const r=await send(origin+path,{method,headers:{apikey,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('HTTP_'+r.status);return r.status===204?null:r.json();
 };
 const call=async(op,body={},write=false)=>{
  const r=await request('/functions/v1/backend-v1/'+op,{client_api_version:1,request_id:key(),...(!op.startsWith('account_')?{org_id:org,center_id:center}:{}),...body,...(write?{operation_key:typeof write==='string'?write:key()}:{})});
  if(!r.ok)throw Error(r.error?.code??'INVALID_ENVELOPE');return r.data;
 };
 const wait=async job=>{
  for(let i=0;i<60;i++){
   const result=await call('job_status_get_v1',{job_id:job});
   if(result.state==='succeeded')return result;
   if(result.state==='failed')throw Error(result.safe_error_code??'IMPORT_JOB_FAILED');
   await advance();await new Promise(resolve=>setTimeout(resolve,1000));
  }throw Error('IMPORT_JOB_PENDING');
 };
 const mapping={kind:'crm_applications',columns:['source_key','display_name','phone','email','consents'].map(target=>({source_column:target,target}))};
 const cell=value=>'"'+String(value).replaceAll('"','""')+'"';
 const preview=async(rows,ns=namespace)=>{
  const csv='source_key,display_name,phone,email,consents\r\n'+rows.map(r=>[r.source_key,r.display_name??'Synthetic P10 candidate',r.phone,r.email??'',JSON.stringify(r.consents??[])].map(cell).join(',')).join('\r\n')+'\r\n';
  const checksum=createHash('sha256').update(csv).digest('hex');
  const file=await call('import_upload_prepare_v1',{filename:'synthetic-p10.csv',mime:'text/csv',bytes:Buffer.byteLength(csv),checksum},true);
  receipt.files.push({id:file.file_id,checksum,sourceRows:rows.map(r=>r.source_key)});save();
  const upload=new URL(file.upload_url,origin);assert.equal(upload.origin,origin);
  const r=await send(upload,{method:'PUT',headers:{apikey,'content-type':'text/csv'},body:csv,signal:AbortSignal.timeout(30000)});assert(r.ok,'Synthetic upload');
  await call('file_upload_complete_v1',{file_id:file.file_id,checksum},true);
  const pending=await call('import_preview_v1',{file_id:file.file_id,mapping,source_namespace:ns},true);receipt.jobs.push(pending.job_id);save();
  const ready=await wait(pending.job_id),proof=await call('preview_get_v1',{preview_id:ready.result_reference.id});
  const listed=await call('import_rows_list_v1',{job_id:pending.job_id,page:{limit:100}});
  return {job:pending.job_id,proof,items:listed.items};
 };
 const apply=async(p,selected)=>{const x=await call('import_apply_v1',{preview:{id:p.proof.id,token:p.proof.token},selected_row_numbers:selected},true);assert.equal(x.selected_rows_count,selected.length);await wait(x.job_id);return (await call('import_rows_list_v1',{job_id:x.job_id,page:{limit:100}})).items;};
 const refs=items=>items.filter(x=>x.state==='applied').flatMap(x=>x.created_references).map(x=>x.id).sort();
 const applications=async ns=>{const all=[],seen=new Set();let cursor;do{const page=await call('management_state_get_v1',{operation:'public_application_review_v1',selector:{operation:'public_application_review_v1',key:{}},page:{limit:200,...(cursor?{cursor}:{})}});all.push(...page.items.filter(x=>x.current?.values?.source?.source_namespace===ns));cursor=page.next_cursor;if(cursor){assert(!seen.has(cursor));seen.add(cursor);}}while(cursor);return all;};
 try{
  token=(await request('/auth/v1/token?grant_type=password',{email,password})).access_token;assert(token);
  const identity=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));assert(/^[a-f0-9-]{36}$/.test(identity.session_id));
  if(sessionState.authUserId)assert.equal(sessionState.authUserId,identity.sub);else sessionState.authUserId=identity.sub;
  assert(!sessionState.sessions.some(x=>x.id===identity.session_id));currentSession={id:identity.session_id,createdAt:null,revokeKey:key(),cleanupConfirmed:false};sessionState.sessions.push(currentSession);await saveSessionState(structuredClone(sessionState));
  const sessions=async()=>{let cursor;const all=[],seen=new Set();do{const p=await call('account_sessions_list_v1',cursor?{cursor}:{});all.push(...p.items);cursor=p.next_cursor;if(cursor){assert(!seen.has(cursor));seen.add(cursor);}}while(cursor);return all;};
  let live=await sessions();const own=live.find(x=>x.session_id===currentSession.id&&x.current);assert(own);currentSession.createdAt=own.created_at;await saveSessionState(structuredClone(sessionState));
  for(const prior of sessionState.sessions.filter(x=>x!==currentSession&&!x.cleanupConfirmed)){
   const found=live.find(x=>x.session_id===prior.id);if(found){assert.equal(found.current,false);if(prior.createdAt!==null)assert.equal(found.created_at,prior.createdAt);await call('account_sessions_revoke_v1',{mode:'selected',session_id:prior.id},prior.revokeKey);live=await sessions();assert(!live.some(x=>x.session_id===prior.id));}
   prior.cleanupConfirmed=true;await saveSessionState(structuredClone(sessionState));
  }

  assert.equal((await call('subscription_get_v1')).plan,'pro');
  const contact='synthetic-p10-'+key()+'@ftksaas.invalid';
  const person=(await call('person_create_v1',{display_name:'Synthetic P10 duplicate contact',contacts:[{kind:'email',value:contact},{kind:'phone',value:'+905550000071'}]},true)).primary_id;
  const consent={purpose:'marketing',accepted:true,version:'synthetic-only-v1',occurred_at:'2026-01-01T00:00:00Z'};
  const rows=[{source_key:'no-proof',phone:'+905550000071',email:contact},{source_key:'with-proof',phone:'+905550000072',email:contact,consents:[consent]},{source_key:'invalid-phone',phone:'05550000073'}];
  const p=await preview(rows);assert.equal(p.items[2].state,'invalid');assert.equal(p.items[2].application,null);
  assert(p.items[0].application.phone_matches.some(x=>x.person_id===person));
  assert(p.items[0].application.email_matches?.some(x=>x.person_id===person),'Deployed email-warning support required');
  assert.deepEqual(p.items[0].application.intake.consents,[]);
  const applied=await apply(p,[1,2]);assert.deepEqual(applied.map(x=>x.state),['applied','applied','invalid']);const ids=refs(applied);assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);
  const inbox=await applications(namespace);assert.equal(inbox.length,2);
  for(let i=0;i<2;i++){
   const row=applied[i],app=inbox.find(x=>x.entity.id===row.created_references[0].id)?.current.values;assert(app,'Imported application visible');
   assert.equal(app.person_id,null);assert.equal(app.source.source_namespace,namespace);assert.equal(app.source.source_key,rows[i].source_key);assert.equal(app.source.file_checksum,receipt.files[0].checksum);assert.equal(app.source.row_number,i+1);
   assert.equal(app.intake.phone,rows[i].phone);assert.equal(app.intake.email,rows[i].email);
   if(i===0)assert.deepEqual(app.intake.consents,[]);else{for(const k of Object.keys(consent))assert.equal(app.intake.consents[0][k],consent[k]);assert.equal(app.intake.consents[0].source.source_key,'with-proof');}
  }
  const reread=await call('import_preview_v1',{file_id:receipt.files[0].id,mapping,source_namespace:namespace},true);receipt.jobs.push(reread.job_id);const rereadReady=await wait(reread.job_id),again={job:reread.job_id,proof:await call('preview_get_v1',{preview_id:rereadReady.result_reference.id})};
  assert.equal(again.proof.import_summary.replayed_rows,2);assert.deepEqual(refs(await apply(again,[1,2])),ids);
  receipt.checks.push('selected source rows reconcile with two distinct unlinked applications; empty and proven consent preserved; repeated file returns identical application IDs');save();
  // A normal competing import invalidates an older preview. No SQL fault or
  // hosted trigger is needed; the stale selected set must be rejected whole.
  const atomicNamespace=namespace+'-atomic',atomic=[{source_key:'fresh',phone:'+905550000081'},{source_key:'conflict',phone:'+905550000082'}];
  const stale=await preview(atomic,atomicNamespace),competitor=await preview([{...atomic[1],display_name:'Synthetic competing source'}],atomicNamespace);await apply(competitor,[1]);
  await assert.rejects(()=>apply(stale,[1,2]),error=>error.message==='PREVIEW_STALE');
  const still=await call('import_rows_list_v1',{job_id:stale.job,page:{limit:100}});assert(still.items.every(x=>x.state==='valid'&&x.created_references.length===0));const afterReject=await applications(atomicNamespace);assert.equal(afterReject.length,1);assert.equal(afterReject[0].current.values.source.source_key,'conflict');
  const fresh=await preview(atomic,atomicNamespace);assert.deepEqual(fresh.items.map(x=>x.state),['valid','invalid']);const retried=refs(await apply(fresh,[1]));assert.equal(retried.length,1);
  const repeat=await preview([atomic[0]],atomicNamespace);assert.deepEqual(refs(await apply(repeat,[1])),retried);
  receipt.checks.push('competing source invalidates entire stale selection with zero partial row references; fresh preview excludes invalid row; valid retry does not multiply');
  const finalAtomic=await applications(atomicNamespace);assert.equal(finalAtomic.length,2);assert.deepEqual(finalAtomic.map(x=>x.current.values.source.source_key).sort(),['conflict','fresh']);
  receipt.applicationIds=[...ids,...retried];receipt.sourceFileReadAfterApply=true;receipt.atomicRejectedSetWritten=0;
 }catch(error){failure=error;}finally{
  if(token){try{const logout=await send(origin+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey,authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});await logout.body?.cancel();assert.equal(logout.status,204);const denied=await send(origin+'/functions/v1/backend-v1/account_get_v1',{method:'POST',headers:{apikey,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key()}),signal:AbortSignal.timeout(30000)});assert.equal(denied.status,401,'Only this acceptance session must close');const body=await denied.json();assert(['AUTH_REQUIRED','SESSION_REVOKED'].includes(body.error?.code));if(currentSession){currentSession.cleanupConfirmed=true;await saveSessionState(structuredClone(sessionState));}}catch(error){cleanupFailure=error;}}
 }
 receipt.status=failure||cleanupFailure?'failed':'passed';receipt.sessionCleanupConfirmed=!cleanupFailure&&sessionState.sessions.every(x=>x.cleanupConfirmed);receipt.finishedAt=new Date().toISOString();save();
 if(cleanupFailure)throw Error('P10_SESSION_CLEANUP_UNCONFIRMED');if(failure)throw failure;assert(receipt.sessionCleanupConfirmed);return receipt;
}
