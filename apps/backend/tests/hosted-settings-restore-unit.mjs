import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreSettingsField} from '../scripts/acceptance/s10-hosted-sources.mjs';
const item={q:{scope:'center',center_id:'synthetic'},field:'permission_templates',before:{values:{permission_templates:[]},inherited_fields:{},overridden_fields:[]},expected:[{key:'probe'}],expectedInherited:true,expectedOverride:false};
const checked={version:3,values:{permission_templates:item.expected},inherited_fields:{permission_templates:{kind:'organization_inherited'}},overridden_fields:[]};
test('settings restoration refuses a changed reset preview before applying',async()=>{
 let applied=false;
 await assert.rejects(restoreSettingsField(item,{read:async()=>structuredClone(checked),call:async op=>{if(op==='settings_reset_preview_v1')return {version:4,before:checked.values};applied=true;}}),/Concurrent reset source change/);
 assert.equal(applied,false);
});
test('settings restoration preserves a concurrent source switch with the same effective value',async()=>{
 let calls=0;
 await assert.rejects(restoreSettingsField(item,{read:async()=>({...checked,inherited_fields:{},overridden_fields:['permission_templates']}),call:async()=>{calls++;}}),/Concurrent inheritance change/);
 assert.equal(calls,0);
});
test('explicit restoration uses the guarded version and never adopts a subsequent read',async()=>{
 let reads=0,version;
 const local={...item,expectedInherited:false,expectedOverride:true,before:{...item.before,overridden_fields:['permission_templates']}};
 await assert.rejects(restoreSettingsField(local,{read:async()=>{reads++;return {...checked,version:reads===1?3:4,inherited_fields:{},overridden_fields:['permission_templates']};},call:async(op,body)=>{assert.equal(op,'settings_update_v1');version=body.expected_version;throw Error('VERSION_CONFLICT');}}),/VERSION_CONFLICT/);
 assert.equal(reads,1);assert.equal(version,3);
});
