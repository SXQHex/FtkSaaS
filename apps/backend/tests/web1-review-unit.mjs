import test from 'node:test';import assert from 'node:assert/strict';
import * as v from '../supabase/functions/backend-v1/validators.js';import {newUuidV7 as key} from '../scripts/uuid.mjs';
const scope=()=>({client_api_version:1,request_id:key(),org_id:key(),center_id:key()});
test('Availability retirement and exception cancellation require explicit source, reason and version; legacy writes remain compatible',()=>{
 const base={...scope(),operation_key:key(),resource:{kind:'room',id:key()}},rule={weekdays:[1],local_start:'09:00:00',local_end:'10:00:00',valid_from:'2026-01-01'};
 assert(v.request_availability_save_v1({...base,rule}));
 const retire={...base,action:'retire',rule_id:key(),expected_version:1,reason:'Explicit retirement'};assert(v.request_availability_save_v1(retire));
 for(const field of ['rule_id','expected_version','reason']){const bad={...retire};delete bad[field];assert.equal(v.request_availability_save_v1(bad),false);}
 assert.equal(v.request_availability_save_v1({...retire,rule}),false);assert.equal(v.request_availability_save_v1({...retire,reason:'   '}),false);
 const cancel={...base,action:'cancel',exception_id:key(),expected_version:1,reason:'Explicit cancellation'};assert(v.request_availability_exception_save_v1(cancel));
 for(const field of ['exception_id','expected_version','reason']){const bad={...cancel};delete bad[field];assert.equal(v.request_availability_exception_save_v1(bad),false);}
 assert.equal(v.request_availability_exception_save_v1({...cancel,interval:{starts_at:'2027-01-01T00:00:00Z',ends_at:'2027-01-02T00:00:00Z'}}),false);
});
test('Merge review is additive: reason and local nonduplicate decision are bound to a technical preview',()=>{
 const base={...scope(),source_id:key(),target_id:key()};assert(v.request_person_merge_preview_v1(base));assert(v.request_person_merge_preview_v1({...base,reason:'Duplicate entry'}));
 const dismiss={...base,decision:'not_duplicate',reason:'Different people'};assert(v.request_person_merge_preview_v1(dismiss));
 for(const bad of [{...dismiss,center_id:null},{...dismiss,reason:''},{...dismiss,decision:'auto_merge'},{...dismiss,reason:'   '}])assert.equal(v.request_person_merge_preview_v1(bad),false);
 const op='person_merge_preview_v1',read={...scope(),operation:op,selector:{operation:op,key:{directory:'center',status:'suggested',query:'Ada'}},page:{limit:1}};assert(v.request_management_state_get_v1(read));
 for(const status of ['all','completed','not_duplicate'])assert(v.request_management_state_get_v1({...read,selector:{operation:op,key:{directory:'center',status}}}));
 assert.equal(v.request_management_state_get_v1({...read,center_id:null}),false);assert.equal(v.request_management_state_get_v1({...read,selector:{operation:op,key:{directory:'center',source_id:key()}}}),false);
});
test('Account directory includes never-linked people and invitation lifecycle groups without weakening legacy reason inputs',()=>{
 const op='account_link_remove_v1',base={...scope(),operation:op,selector:{operation:op,key:{directory:'center',view:'people',status:'unlinked'}},page:{}};
 assert(v.request_management_state_get_v1(base));assert(v.request_management_state_get_v1({...base,selector:{operation:op,key:{directory:'center',status:'active'}}}));
 assert.equal(v.request_management_state_get_v1({...base,selector:{operation:op,key:{directory:'center',view:'people',status:'revoked'}}}),false);
 for(const status of ['open','closed','all']){const operation='account_access_revoke_v1';assert(v.request_management_state_get_v1({...base,operation,selector:{operation,key:{directory:'center',status}}}));}
 assert(v.request_availability_exception_save_v1({...scope(),operation_key:key(),expected_version:1,resource:{kind:'room',id:key()},interval:{starts_at:'2031-01-01T00:00:00Z',ends_at:'2031-01-02T00:00:00Z'},reason:'x'.repeat(2001)}));
});
test('Selected person comparison requests reuse opt-in native summaries with explicit center',()=>{
 const base={...scope(),person_id:key()};delete base.center_id;assert(v.request_person_get_v1(base));assert(v.request_person_get_v1({...base,include_member_summary:false}));assert.equal(v.request_person_get_v1({...base,include_member_summary:true}),false);assert(v.request_person_get_v1({...base,center_id:key(),include_member_summary:true}));
});
