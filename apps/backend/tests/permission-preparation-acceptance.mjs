import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationFixture} from './starter-preparation-fixture.mjs';
import {authUser,must,call} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('S10 permission templates require explicit per-target grants and preserve live authority',{timeout:300000},async t=>{
 const f=await preparationFixture(),{db,org,center,person,owner,plan,read,change}=f;t.after(()=>db.end());
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
 const scoped=b=>({org_id:org,...(b.scope==='organization'?{}:{center_id:center}),...b});
 const api=(op,b={},u=owner,k=key())=>must(u,op,scoped(b),k);
 const outsider=await authUser('permission-preparation-outsider');await must(outsider,'account_get_v1');
 const denied=async(code,op,b,u=owner,k=key())=>{const r=await call(u,op,scoped(b),k);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const target=(await api('person_create_v1',{display_name:'Synthetic permission target',contacts:[]})).primary_id;
 await api('role_assign_v1',{person_id:target,role:'staff',scope:{center_id:center}});
 const grants=[{permission:'attendance.draft',enabled:true},{permission:'sale.write',enabled:false}],template={key:'desk',name:'Synthetic explicit desk',grants};
 const counts=async()=>{
  const result={};for(const table of ['permission_overrides','role_assignments','operation_receipts','audit_events','notifications'])result[table]=Number((await db.query('select count(*)::int n from core.'+table+' where org_id=$1',[org])).rows[0].n);return result;
 };
 const permissionState=(permission='attendance.draft',u=owner)=>api('management_state_get_v1',{operation:'permission_set_v1',selector:{operation:'permission_set_v1',key:{person_id:target,permission}}},u);
 const readBefore=await counts(),missingOverride=(await permissionState()).items[0];
 assert.equal(missingOverride.entity.type,'people');assert.equal(missingOverride.entity.id,target);assert.equal(missingOverride.current.values.override_exists,false);assert.equal('enabled' in missingOverride.current.values,false);assert.deepEqual(await counts(),readBefore);
 await denied('NOT_FOUND','management_state_get_v1',{operation:'permission_set_v1',selector:{operation:'permission_set_v1',key:{person_id:target,permission:'attendance.draft'}}},outsider);
 const initialGrants=(await counts()).permission_overrides;
 const q={scope:'organization'},v=await read('organization'),save={...q,expected_version:v.version,patch:{permission_templates:[template]}},saveKey=key();
 await api('settings_update_v1',save,owner,saveKey);assert.equal((await api('settings_update_v1',save,owner,saveKey)).replayed,true);
 const catalog=()=>api('settings_catalog_get_v1',{scope:'center'}),entry=(await catalog()).preparation_templates.permissions.find(x=>x.source.scope==='organization'&&x.template.key==='desk');assert(entry);assert.deepEqual(entry.template,template);
 const request={kind:'permission',source:entry.source},before=await counts(),proposal=await api('settings_preparation_resolve_v1',request);
 assert.deepEqual(proposal,{kind:'permission',source:entry.source,permission_requests:grants});assert.deepEqual(await counts(),before);assert.equal(before.permission_overrides,initialGrants);
 await denied('NOT_FOUND','settings_preparation_resolve_v1',request,outsider);
 await denied('VERSION_CONFLICT','settings_preparation_resolve_v1',{...request,source:{...entry.source,version:0}});
 await denied('NOT_FOUND','settings_preparation_resolve_v1',{...request,source:{...entry.source,key:'missing'}});
 await denied('NOT_FOUND','settings_preparation_resolve_v1',{...request,source:{scope:'center',key:'desk',version:0,center_id:key()}});
 const current=await read('organization');
 for(const bad of [{...template,name:' '},{...template,grants:[grants[0],{...grants[0],enabled:false}]}])await denied('VALIDATION_FAILED','settings_update_v1',{...q,expected_version:current.version,patch:{permission_templates:[bad]}});
 await denied('VALIDATION_FAILED','settings_update_v1',{...q,expected_version:current.version,patch:{permission_templates:[template,template]}});
 // Each existing command needs the actual person version, a target, center and
 // its own explicit key. A preparation never supplies or applies any of these.
 let lastCommand,lastCommandKey;
 for(const grant of proposal.permission_requests){
  const state=(await permissionState(grant.permission)).items[0];
  const version=state.versions.find(x=>x.entity.type==='people'&&x.entity.id===target).version;
  assert.equal(version,Number((await db.query('select version from core.people where org_id=$1 and id=$2',[org,target])).rows[0].version));
  const command={person_id:target,expected_version:version,...grant},commandKey=key();
  lastCommand=command;lastCommandKey=commandKey;
  await api('permission_set_v1',command,owner,commandKey);assert.equal((await api('permission_set_v1',command,owner,commandKey)).replayed,true);
 }
 const applied=async()=>(await db.query('select permission,enabled from core.permission_overrides where org_id=$1 and center_id=$2 and person_id=$3 order by permission',[org,center,target])).rows;
 assert.deepEqual(await applied(),grants);
 for(const grant of grants){const state=(await permissionState(grant.permission)).items[0];assert.equal(state.current.values.override_exists,true);assert.equal(state.current.values.enabled,grant.enabled);}
 await denied('VERSION_CONFLICT','permission_set_v1',lastCommand);
 const unassigned=(await api('person_create_v1',{display_name:'Synthetic unassigned permission target',contacts:[]})).primary_id;
 const unassignedVersion=Number((await db.query('select version from core.people where org_id=$1 and id=$2',[org,unassigned])).rows[0].version);
 await denied('ACCOUNT_LINK_REQUIRED','permission_set_v1',{...lastCommand,person_id:unassigned,expected_version:unassignedVersion});
 await api('role_assign_v1',{person_id:unassigned,role:'assistant',scope:{center_id:center}});
 await denied('ACCOUNT_LINK_REQUIRED','management_state_get_v1',{operation:'permission_set_v1',selector:{operation:'permission_set_v1',key:{person_id:unassigned,permission:'attendance.draft'}}});
 assert.deepEqual(await applied(),grants);
 await change('organization',{permission_templates:[{...template,grants:grants.map(g=>({...g,enabled:!g.enabled}))}]});
 await denied('VERSION_CONFLICT','settings_preparation_resolve_v1',request);assert.deepEqual(await applied(),grants);
 await change('center',{permission_templates:[template]});
 const local=(await catalog()).preparation_templates.permissions.find(x=>x.source.scope==='center');assert(local);
 assert.deepEqual((await api('settings_preparation_resolve_v1',{kind:'permission',source:local.source})).permission_requests,grants);
 const reset=await api('settings_reset_preview_v1',{scope:'center',fields:['permission_templates']});assert.deepEqual(reset.after.permission_templates,[]);
 await api('settings_reset_apply_v1',{scope:'center',expected_version:reset.version,preview:{id:reset.id,token:reset.token}});
 assert.deepEqual((await read('center')).values.permission_templates,[]);assert.deepEqual(await applied(),grants);
 const liveRequest={kind:'permission',source:(await catalog()).preparation_templates.permissions.find(x=>x.source.scope==='organization').source};
 await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);assert.equal((await api('settings_preparation_resolve_v1',liveRequest)).permission_requests.length,2);
 const otherCenter=(await api('center_create_v1',{name:'Synthetic unrelated role center',timezone:'UTC'})).primary_id;
 await api('center_manager_assign_v1',{center_id:otherCenter,person_id:person});
 await denied('ACCOUNT_LINK_REQUIRED','management_state_get_v1',{center_id:otherCenter,operation:'permission_set_v1',selector:{operation:'permission_set_v1',key:{person_id:target,permission:'attendance.draft'}}});
 assert.deepEqual((await api('settings_get_v1',{scope:'center',center_id:otherCenter})).values.permission_templates,[]);
 await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
 await denied('PLAN_FEATURE_UNAVAILABLE','settings_preparation_resolve_v1',liveRequest);
 await denied('PLAN_FEATURE_UNAVAILABLE','management_state_get_v1',{operation:'permission_set_v1',selector:{operation:'permission_set_v1',key:{person_id:target,permission:'attendance.draft'}}});
 await denied('PLAN_FEATURE_UNAVAILABLE','permission_set_v1',lastCommand,owner,lastCommandKey);assert.deepEqual(await applied(),grants);
 await denied('PLAN_FEATURE_UNAVAILABLE','settings_update_v1',save,owner,saveKey);
 const starter=await catalog();assert.equal(starter.fields.find(x=>x.key==='permission_templates').writable,false);assert.deepEqual(starter.preparation_templates.permissions,[]);
 await denied('PLAN_FEATURE_UNAVAILABLE','settings_reset_preview_v1',{scope:'center',fields:['permission_templates']});
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
 const role=(await db.query("select version from core.role_assignments where org_id=$1 and scope_center_id=$2 and person_id=$3 and role='center_manager' and state='active'",[org,center,person])).rows[0];
 await api('center_manager_revoke_v1',{person_id:person,expected_version:Number(role.version),reason:'Synthetic preparation authority revocation'});
 await denied('FORBIDDEN','settings_preparation_resolve_v1',liveRequest);
 await denied('FORBIDDEN','management_state_get_v1',{operation:'permission_set_v1',selector:{operation:'permission_set_v1',key:{person_id:target,permission:'attendance.draft'}}});
 await denied('FORBIDDEN','permission_set_v1',lastCommand,owner,lastCommandKey);assert.deepEqual(await applied(),grants);
});
