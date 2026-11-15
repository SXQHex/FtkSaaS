import test from 'node:test';
import assert from 'node:assert/strict';
import * as validators from '../supabase/functions/backend-v1/validators.js';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Person field ownership is additive, closed, and never a writable account or command input',()=>{
 const person={id:key(),display_name:'Synthetic',relationships:[],version:1,discipline_relationships:[],contacts:[{kind:'email',value:'synthetic@ftksaas.invalid',verified_at:null}]};
 const response=data=>({ok:true,trace_id:key(),data}),valid=validators.success_person_get_v1;
 assert(valid(response(person))); // Existing consumers retain their previous response shape.
 const local={source:'person',person_update_writable:true},profile={source:'account_profile',person_update_writable:false},native={source:'native_auth',person_update_writable:false};
 const enriched={...person,field_policy:{display_name:profile,given_name:profile,family_name:profile},contacts:[{...person.contacts[0],field_policy:native}]};
 assert(valid(response(enriched)));assert(valid(response({...enriched,field_policy:{display_name:local,given_name:{...local,person_update_writable:false},family_name:{...local,person_update_writable:false}}})));
 for(const policy of [{source:'native_auth',person_update_writable:true},{source:'account_profile',person_update_writable:true},{source:'unknown',person_update_writable:false},{...local,account_id:key()},{source:'person'},{person_update_writable:true}])assert.equal(valid(response({...enriched,contacts:[{...person.contacts[0],field_policy:policy}]})),false);
 const command={client_api_version:1,request_id:key(),org_id:key(),center_id:key(),person_id:person.id,operation_key:key(),expected_version:1,patch:{display_name:'Updated',contacts:[{kind:'email',value:person.contacts[0].value}]}};
 assert(validators.request_person_update_v1(command));
 assert.equal(validators.request_person_update_v1({...command,patch:{...command.patch,field_policy:enriched.field_policy}}),false);
 assert.equal(validators.request_person_update_v1({...command,patch:{contacts:enriched.contacts}}),false);
});
