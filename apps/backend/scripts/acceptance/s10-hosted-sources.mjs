import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {newUuidV7 as key} from '../uuid.mjs';
import {pathToFileURL} from 'node:url';
const origin='https://gwyprhenabtpkbojephw.supabase.co';
// Real scoped settings commands only. Restore both the original effective value
// and local/inherited/default source; do not overwrite a concurrent field writer.
export async function restoreSettingsField(item,{read,call}){
   const {q,field,before,expected,expectedInherited,expectedOverride}=item,current=await read(q);if(isDeepStrictEqual(current.values[field],before.values[field])&&!!current.inherited_fields?.[field]===!!before.inherited_fields?.[field]&&current.overridden_fields.includes(field)===before.overridden_fields.includes(field))return;assert(isDeepStrictEqual(current.values[field],expected),'Concurrent field change; restoration refused');assert.equal(!!current.inherited_fields?.[field],expectedInherited,'Concurrent inheritance change');assert.equal(current.overridden_fields.includes(field),expectedOverride,'Concurrent override change');
   if(before.inherited_fields?.[field])await call('settings_update_v1',{...q,expected_version:current.version,patch:{},inherit_fields:[field]},key());
   else if(before.overridden_fields.includes(field))await call('settings_update_v1',{...q,expected_version:current.version,patch:{[field]:before.values[field]}},key());
   else{const p=await call('settings_reset_preview_v1',{...q,fields:[field]});assert.equal(p.version,current.version,'Concurrent reset source change');assert.deepEqual(p.before[field],current.values[field]);await call('settings_reset_apply_v1',{...q,expected_version:p.version,preview:{id:p.id,token:p.token}},key());}
   const after=await read(q);if(!before.inherited_fields?.[field])assert.deepEqual(after.values[field],before.values[field]);assert.equal(!!after.inherited_fields?.[field],!!before.inherited_fields?.[field]);assert.equal(after.overridden_fields.includes(field),before.overridden_fields.includes(field));
}

export async function acceptSources({email,password,apikey,org,center,request=fetch}){
 let token,phase='login';const checks=[],restore=[];
 const json=async(path,body)=>{const r=await request(origin+path,{method:'POST',headers:{apikey,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(r.status===204)return null;const value=await r.json();if(!r.ok)throw Error(value.error?.code??'HTTP_'+r.status);return value;};
 const call=async(op,body={},operationKey)=>{const r=await json('/functions/v1/backend-v1/'+op,{client_api_version:1,request_id:key(),...(body.scope==='user'||op==='organizations_list_v1'?{}:{org_id:org}),...body,...(operationKey?{operation_key:operationKey}:{})});if(!r.ok)throw Error(r.error?.code??'INVALID_ENVELOPE');return r.data;};
 const read=q=>call('settings_get_v1',q),write=async(q,patch,version,extra={})=>call('settings_update_v1',{...q,expected_version:version,patch,...extra},key());
 const capture=async(q,field)=>{const before=await read(q),item={q,field,before,expected:before.values[field],expectedInherited:!!before.inherited_fields?.[field],expectedOverride:before.overridden_fields.includes(field)};restore.push(item);return item;};
 try{
  token=(await json('/auth/v1/token?grant_type=password',{email,password})).access_token;assert(token);
  const oq={scope:'organization'},cq={scope:'center',center_id:center},uq={scope:'user'};
  phase='regional defaults';const regional=await capture(oq,'regional_defaults');
  const changed={...regional.expected,public_language:regional.expected.public_language==='tr'?'en':'tr',new_center_timezone:'Europe/London'};
  regional.expected=changed;regional.expectedOverride=true;await write(oq,{regional_defaults:changed},regional.before.version);assert.deepEqual((await read(oq)).values.regional_defaults,changed);
  const orgs=await call('organizations_list_v1',{page:{}});assert.deepEqual(orgs.items.find(o=>o.id===org).regional_defaults,changed);
  await assert.rejects(()=>write(oq,{regional_defaults:{...changed,fallback_language:'xx'}},regional.before.version+1),e=>e.message==='VALIDATION_FAILED');checks.push('typed regional write, organization consumer and invalid fallback rejection');
  phase='eight permissions and live inheritance';const organization=await capture(oq,'permission_templates'),local=await capture(cq,'permission_templates');
  const permissions=['person.manage','person.activate','invite.student','reservation.write','attendance.draft','sale.write','finance.collect','reservation.capacity_override'];
  const template={key:'acceptance_'+key(),name:'Hosted source acceptance',grants:permissions.map((permission,i)=>({permission,enabled:i%2===0})).sort((a,b)=>a.permission.localeCompare(b.permission))};
  organization.expected=[...organization.expected,template];organization.expectedOverride=true;await write(oq,{permission_templates:organization.expected},organization.before.version);
  local.expected=organization.expected;local.expectedInherited=true;local.expectedOverride=false;await write(cq,{},local.before.version+(local.before.inherited_fields?.permission_templates?1:0),{inherit_fields:['permission_templates']});
  const inherited=await read(cq);assert.equal(inherited.inherited_fields.permission_templates.kind,'organization_inherited');assert.deepEqual(inherited.values.permission_templates,organization.expected);
  const source=(await call('settings_catalog_get_v1',cq)).preparation_templates.permissions.find(x=>x.source.scope==='center'&&x.template.key===template.key)?.source;assert(source);
  assert.deepEqual((await call('settings_preparation_resolve_v1',{center_id:center,kind:'permission',source})).permission_requests,template.grants);
  organization.expected=organization.expected.map(x=>x.key===template.key?{...x,name:'Updated inherited acceptance'}:x);local.expected=organization.expected;
  await write(oq,{permission_templates:organization.expected},organization.before.version+1);assert((await read(cq)).version>inherited.version);assert.deepEqual((await read(cq)).values.permission_templates,organization.expected);
  await assert.rejects(()=>call('settings_preparation_resolve_v1',{center_id:center,kind:'permission',source}),e=>e.message==='VERSION_CONFLICT');checks.push('all eight permission proposals, effective inheritance and stale source invalidation');
  phase='same-scope history new version';const theme=await capture(uq,'theme'),first=theme.expected==='dark'?'light':'dark';theme.expected=first;theme.expectedOverride=true;await write(uq,{theme:first},theme.before.version);
  const sourceHistory=(await call('settings_history_get_v1',uq)).items.find(x=>x.after.theme===first);assert(sourceHistory);
  theme.expected=first==='dark'?'light':'dark';await write(uq,{theme:theme.expected},theme.before.version+1);
  const v=await read(uq);assert.equal(v.version,theme.before.version+2);assert.equal(v.values.theme,theme.expected);const body={...uq,patch:{},history_source:{id:sourceHistory.id,fields:['theme']},expected_version:v.version},k=key();theme.expected=first;
  const applied=await call('settings_update_v1',body,k);assert.equal(applied.version,v.version+1);assert.equal((await call('settings_update_v1',body,k)).replayed,true);assert.equal((await read(uq)).values.theme,first);
  await assert.rejects(()=>call('settings_update_v1',body,key()),e=>e.message==='VERSION_CONFLICT');checks.push('immutable history reapplied as new version with replay and stale-write denial');
 }catch(error){const code=/^[A-Z0-9_]+$/.test(error.message)?error.message:(error.code==='ERR_ASSERTION'?'ASSERTION':'UNCLASSIFIED');throw Error('Hosted settings-source acceptance failed at '+phase+'; code='+code+'; provider data withheld');}
 finally{
  let failed=false;
  for(const item of restore.reverse())try{await restoreSettingsField(item,{read,call});}catch{failed=true;}
  for(const {q,field,before} of restore)try{assert.deepEqual((await read(q)).values[field],before.values[field]);}catch{failed=true;}
  if(token)try{await json('/auth/v1/logout?scope=local');}catch{failed=true;}
  if(failed)throw Error('Settings-source cleanup requires inspection; concurrent state was not overwritten');
 }
 checks.push('original effective values and inherited/local/default sources restored');return {status:'passed',checks};
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){try{console.log(JSON.stringify(await acceptSources({email:process.env.FTK_ACCEPTANCE_EMAIL,password:process.env.FTK_ACCEPTANCE_PASSWORD,apikey:process.env.FTK_ACCEPTANCE_APIKEY,org:process.env.FTK_ACCEPTANCE_ORG,center:process.env.FTK_ACCEPTANCE_CENTER})));}catch(e){console.error(e.message);process.exitCode=1;}}
