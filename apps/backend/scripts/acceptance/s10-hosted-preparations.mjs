import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {newUuidV7 as key} from '../uuid.mjs';

// Opt-in acceptance against the existing development project. No provider keys,
// role changes, agreement publication, or direct database writes are involved.
const origin='https://gwyprhenabtpkbojephw.supabase.co';
export async function acceptPreparations({email,password,apikey,org,center,discipline,request=fetch}){
 assert(email&&password&&apikey&&org&&center&&discipline,'Acceptance inputs required');
 let token,phase='login';const restores=[],checks=[];
 const json=async(path,body,method='POST')=>{
  const response=await request(origin+path,{method,headers:{apikey,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('HTTP_'+response.status);
  return response.status===204?null:response.json();
 };
 const call=async(operation,body={},operationKey)=>{
  const result=await json('/functions/v1/backend-v1/'+operation,{client_api_version:1,request_id:key(),org_id:org,...body,...(operationKey?{operation_key:operationKey}:{})});
  if(!result.ok)throw Error(result.error?.code??'INVALID_ENVELOPE');return result.data;
 };
 const denied=async(code,body)=>{
  await assert.rejects(()=>call('settings_preparation_resolve_v1',body),error=>error.message===code);
 };
 const restoreValue=async restore=>{
  const current=await call('settings_get_v1',restore.scope);
  if(JSON.stringify(current.values[restore.field])===JSON.stringify(restore.prior))return;
  await call('settings_update_v1',{...restore.scope,expected_version:restore.version,patch:{[restore.field]:restore.prior}},key());
 };
 try{
  token=(await json('/auth/v1/token?grant_type=password',{email,password})).access_token;
  assert(token,'Native session required');
  const grants=[{permission:'attendance.draft',enabled:true},{permission:'sale.write',enabled:false}];
  const permission={key:'acceptance_'+key(),name:'Hosted acceptance preparation',grants};
  const agreement={key:'acceptance_'+key(),name:'Hosted acceptance agreement',discipline_id:discipline,format:'group',terms:{model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'25000'}],room_fee:{kind:'free',order:'after_instructor_share'}}};
  for(const [field,template,kind] of [['permission_templates',permission,'permission'],['agreement_templates',agreement,'agreement']]){
   phase=kind+' save';const scope={scope:'organization'};
   const before=await call('settings_get_v1',scope),prior=before.values[field];assert(Array.isArray(prior));
   const patch={[field]:[...prior,template]},saveKey=key();
   const save={...scope,expected_version:before.version,patch};
   // Register before the request: a timeout may happen after the server commits.
   const restore={scope,field,prior,version:before.version+1};restores.push(restore);
   await call('settings_update_v1',save,saveKey);
   const saved=await call('settings_get_v1',scope);
   // Do not restore over another writer. All later commands use our saved version.
   assert.equal(saved.version,before.version+1);
   assert.deepEqual(saved.values[field],patch[field]);
   assert.equal((await call('settings_update_v1',save,saveKey)).replayed,true);
   checks.push(kind+' saved, reread and replayed');
   phase=kind+' resolve';const catalog=await call('settings_catalog_get_v1',{scope:'center',center_id:center});
   const source=catalog.preparation_templates[kind==='permission'?'permissions':'agreements'].find(item=>item.source.scope==='organization'&&item.template.key===template.key)?.source;
   assert(source,'Real organization source required');
   const resolve={center_id:center,kind,source};
   const proposal=await call('settings_preparation_resolve_v1',resolve);
   assert.deepEqual(kind==='permission'?proposal.permission_requests:proposal.agreement_request,kind==='permission'?grants:{discipline_id:discipline,format:'group',terms:agreement.terms});
   await denied('VERSION_CONFLICT',{...resolve,source:{...source,version:source.version-1}});
   await denied('NOT_FOUND',{...resolve,source:{...source,key:'missing_'+key()}});
   checks.push(kind+' source resolved; stale and missing sources rejected');
   phase=kind+' restore';await restoreValue(restore);
   restores.pop();const after=await call('settings_get_v1',scope);assert.deepEqual(after.values[field],prior);
   await denied('VERSION_CONFLICT',resolve);
   checks.push(kind+' prior value restored with a new version; old proposal rejected');
  }
  phase='history';const history=await call('settings_history_get_v1',{scope:'organization'});
  assert(history.items.some(item=>item.after.permission_templates?.some(value=>value.key===permission.key)));
  assert(history.items.some(item=>item.after.agreement_templates?.some(value=>value.key===agreement.key)));
  checks.push('immutable history contains both explicit preparations');
  return {status:'passed',checks};
 }catch{
  // Never include provider errors, locators, payloads or credentials in reports.
  throw Error('Hosted preparations acceptance failed at '+phase);
 }finally{
  let cleanupFailed=false;
  for(const restore of restores.reverse()){
   try{await restoreValue(restore);}
   catch{cleanupFailed=true;}
  }
  if(token){try{await json('/auth/v1/logout?scope=local',undefined);}catch{cleanupFailed=true;}}
  if(cleanupFailed)throw Error('Hosted acceptance cleanup requires inspection; no forced overwrite attempted');
 }
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{console.log(JSON.stringify(await acceptPreparations({email:process.env.FTK_ACCEPTANCE_EMAIL,password:process.env.FTK_ACCEPTANCE_PASSWORD,apikey:process.env.FTK_ACCEPTANCE_APIKEY,org:process.env.FTK_ACCEPTANCE_ORG,center:process.env.FTK_ACCEPTANCE_CENTER,discipline:process.env.FTK_ACCEPTANCE_DISCIPLINE})));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
