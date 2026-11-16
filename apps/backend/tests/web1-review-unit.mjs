import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as v from '../supabase/functions/backend-v1/validators.js';import {newUuidV7 as key} from '../scripts/uuid.mjs';
const scope=()=>({client_api_version:1,request_id:key(),org_id:key(),center_id:key()});
test('Assigned session room labels are opt-in output, never new resource write fields',()=>{
 const base=scope();
 assert(v.request_session_get_v1({...base,session_id:key(),include_room_labels:true}));
 assert(v.request_calendar_get_v1({...base,interval:{starts_at:'2031-01-01T00:00:00Z',ends_at:'2031-01-02T00:00:00Z'},page:{},include_room_labels:true}));
 assert.equal(v.request_session_get_v1({...base,session_id:key(),include_room_labels:'true'}),false);
 const create={...base,operation_key:key(),class_id:null,discipline_id:key(),format:'group',interval:{starts_at:'2031-01-01T00:00:00Z',ends_at:'2031-01-01T01:00:00Z'},resources:[{kind:'room',id:key()}],assignments:[],capacity:{total:10}};
 assert(v.request_session_create_v1(create));assert.equal(v.request_session_create_v1({...create,resources:[{...create.resources[0],name:'Client label'}]}),false);
});
test('Assigned room label migration exactly matches its reviewed source',()=>{
 assert.equal(fs.readFileSync(new URL('../database/assigned-session-room-labels.sql',import.meta.url),'utf8'),fs.readFileSync(new URL('../supabase/migrations/20261116143645_assigned_session_room_labels.sql',import.meta.url),'utf8'));
});
test('Lesson request directory accepts status/summary only on request discovery, never selection catalogs',()=>{
 const base={...scope(),operation:'lesson_request_create_v1',page:{limit:1}};
 for(const status of ['all','pending','alternative_offered','resolved'])assert(v.request_management_state_get_v1({...base,selector:{operation:base.operation,key:{status,include_summary:true}}}));
 assert(v.request_management_state_get_v1({...base,selector:{operation:base.operation,key:{}}}));
 for(const key of [{status:'cancelled'},{catalog:'instructors',status:'pending'},{catalog:'disciplines',include_summary:true}])assert.equal(v.request_management_state_get_v1({...base,selector:{operation:base.operation,key}}),false);
});
test('Member profile migration exactly composes reviewed lifecycle sources and native wrappers',()=>{
 const parts=['member-time-filter.sql','freeze-cancellation.sql'].map(n=>fs.readFileSync(new URL('../database/'+n,import.meta.url),'utf8').replace(/^begin;\n/,'').replace(/commit;\n$/,''));
 const wrappers=fs.readFileSync(new URL('../database/runtime-wrappers-current.sql',import.meta.url),'utf8').split('\n').filter(l=>l.includes('freeze_cancel_')).join('\n');
 const migration=fs.readFileSync(new URL('../supabase/migrations/20261116013944_member_time_freeze_cancel.sql',import.meta.url),'utf8');
 assert.equal(migration,'-- W1-BE-13/14: cursor-bound start-time partitions and planned freeze cancellation.\nbegin;\n'+parts.join('')+wrappers+"\nnotify pgrst,'reload schema';\ncommit;\n");
});
test('Member reservation time filters are additive and never accept a client clock',()=>{
 const base={...scope(),person_id:key(),page:{limit:1,sort:'starts_at_asc'}};
 assert(v.request_reservation_list_v1(base));
 for(const time_filter of ['all','upcoming','past'])assert(v.request_reservation_list_v1({...base,time_filter}));
 for(const time_filter of ['ongoing',null,1])assert.equal(v.request_reservation_list_v1({...base,time_filter}),false);
 assert.equal(v.request_reservation_list_v1({...base,time_filter:'past',as_of:'2031-01-01T00:00:00Z'}),false);
});
test('Planned freeze cancellation requires its own preview and approval, never a fabricated end date',()=>{
 const preview={...scope(),freeze_id:key(),reason:'Cancel planned interval'};
 assert.equal(typeof v.request_freeze_cancel_preview_v1,'function');
 assert(v.request_freeze_cancel_preview_v1(preview));
 for(const field of ['freeze_id','reason']){const bad={...preview};delete bad[field];assert.equal(v.request_freeze_cancel_preview_v1(bad),false);}
 assert.equal(v.request_freeze_cancel_preview_v1({...preview,end_date:'2031-01-01'}),false);
 assert.equal(v.request_freeze_cancel_preview_v1({...preview,reason:'   '}),false);
 const apply={...scope(),operation_key:key(),preview:{id:key(),token:'synthetic-approval-token'}};
 assert(v.request_freeze_cancel_apply_v1(apply));
 assert.equal(v.request_freeze_cancel_apply_v1({...apply,freeze_id:preview.freeze_id}),false);
 const noApproval={...apply};delete noApproval.preview;assert.equal(v.request_freeze_cancel_apply_v1(noApproval),false);
});
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

test('Session waitlist discovery is typed separately from known-person intent and source summaries are opt-in',()=>{
 const base={...scope(),operation:'waitlist_join_v1',page:{limit:1}};
 for(const view of ['entries','offers'])assert(v.request_management_state_get_v1({...base,selector:{operation:base.operation,key:{directory:'session',session_id:key(),view}}}));
 assert(v.request_management_state_get_v1({...base,selector:{operation:base.operation,key:{person_id:key(),session_id:key()}}}));
 assert.equal(v.request_management_state_get_v1({...base,selector:{operation:base.operation,key:{directory:'session',view:'entries'}}}),false);
 assert(v.request_reservation_list_v1({...scope(),page:{},include_source_summary:true}));
 assert.equal(v.request_reservation_list_v1({...scope(),page:{},include_source_summary:'true'}),false);
});

test('Session discovery append migration preserves its reviewed SQL sources',()=>{
 const sql=['session-waitlist-directory.sql','reservation-source-summary.sql'].map(n=>fs.readFileSync(new URL('../database/'+n,import.meta.url),'utf8').replace(/^begin;\n/,'').replace(/commit;\n$/,''));
 const migration=fs.readFileSync(new URL('../supabase/migrations/20261116111008_session_waitlist_rights.sql',import.meta.url),'utf8');
 assert.equal(migration,'-- W1-BE-15/16: bounded session waitlist discovery and actual reservation source rights.\nbegin;\n'+sql.join('')+"notify pgrst,'reload schema';\ncommit;\n");
});

test('Request status append migration matches its reviewed reader source',()=>{
 assert.equal(fs.readFileSync(new URL('../database/lesson-request-status-summary.sql',import.meta.url),'utf8'),fs.readFileSync(new URL('../supabase/migrations/20261116135202_lesson_request_status_summary.sql',import.meta.url),'utf8'));
});
