import test from 'node:test';import assert from 'node:assert/strict';
import {eraseNativeAccount} from '../scripts/native-account-erasure.mjs';
const authId='11111111-1111-4111-8111-111111111111';
function fixture(states=[{state:'ready',auth_user_id:authId,provider_origin:'http://127.0.0.1:54321'},{state:'completed'}],responses=[{ok:true,status:200},{ok:false,status:404}]){
 const events=[];return{events,input:{db:{async query(sql,args){events.push({sql,args});return{rows:[{result:states.shift()}]};}},request:{job_id:'synthetic',lease_token:'synthetic'},apiUrl:'http://127.0.0.1:54321',serviceKey:'synthetic-test-key',async fetcher(url,options){events.push({url,method:options.method,redirect:options.redirect,body:options.body});const answer=responses.shift();if(answer instanceof Error)throw answer;return answer;}}};
}
test('native erasure prepares exact lease, hard deletes, verifies404 and requires native transaction proof',async()=>{
 const f=fixture();assert.deepEqual(await eraseNativeAccount(f.input),{state:'completed'});
 assert.equal(f.events.length,4);assert.match(f.events[0].sql,/private.p07_auth_erasure_prepare/);assert.deepEqual(f.events[0].args,[f.input.request]);
 assert.equal(f.events[1].url,'http://127.0.0.1:54321/auth/v1/admin/users/'+authId);assert.equal(f.events[1].method,'DELETE');assert.deepEqual(JSON.parse(f.events[1].body),{should_soft_delete:false});assert.equal(f.events[1].redirect,'error');assert.equal(f.events[2].method,'GET');
});
test('unbound held profile storage and completed stages never issue native deletion',async()=>{
 for(const state of ['unbound','held','blocked_profile','blocked_storage','completed']){const f=fixture([{state}]);assert.deepEqual(await eraseNativeAccount(f.input),{state});assert.equal(f.events.length,1);}
});
test('provider timeout is ambiguous and cannot become completed or retry blindly',async()=>{
 const f=fixture(undefined,[new Error('sensitive upstream body')]);await assert.rejects(eraseNativeAccount(f.input),/^Error: NATIVE_AUTH_RESULT_UNCONFIRMED$/);assert.equal(f.events.length,2);
});
test('provider rejection and non404 readback cannot certify native absence',async()=>{
 const rejected=fixture(undefined,[{ok:false,status:500}]);await assert.rejects(eraseNativeAccount(rejected.input),/NATIVE_AUTH_DELETE_REJECTED/);assert.equal(rejected.events.length,2);
 const present=fixture(undefined,[{ok:true,status:200},{ok:true,status:200}]);await assert.rejects(eraseNativeAccount(present.input),/NATIVE_AUTH_ABSENCE_NOT_CONFIRMED/);assert.equal(present.events.length,3);
});
test('readback timeout and missing native transaction proof keep completion unconfirmed',async()=>{
 const lost=fixture(undefined,[{ok:true,status:200},new Error('sensitive')]);await assert.rejects(eraseNativeAccount(lost.input),/NATIVE_AUTH_READBACK_UNCONFIRMED/);
 const proof=fixture([{state:'ready',auth_user_id:authId,provider_origin:'http://127.0.0.1:54321'},{state:'ready',auth_user_id:authId,provider_origin:'http://127.0.0.1:54321'}]);await assert.rejects(eraseNativeAccount(proof.input),/NATIVE_AUTH_PROOF_MISSING/);
});
test('invalid provider origin or identity is rejected before credentials leave the process',async()=>{
 for(const apiUrl of ['https://example.invalid','https://user:password@abcdefghijklmnopqrst.supabase.co','https://abcdefghijklmnopqrst.supabase.co/path','http://abcdefghijklmnopqrst.supabase.co']){const f=fixture();f.input.apiUrl=apiUrl;await assert.rejects(eraseNativeAccount(f.input),/UNTRUSTED_AUTH_ORIGIN/);assert.equal(f.events.length,0);}
 const id=fixture([{state:'ready',auth_user_id:'../../other-user'}]);await assert.rejects(eraseNativeAccount(id.input),/INVALID_NATIVE_AUTH_ID/);assert.equal(id.events.length,1);
});

test('different project or absent provider binding cannot receive admin credentials',async()=>{
 for(const provider_origin of [undefined,'https://abcdefghijklmnopqrst.supabase.co']){const f=fixture([{state:'ready',auth_user_id:authId,provider_origin}]);await assert.rejects(eraseNativeAccount(f.input),/AUTH_PROVIDER_BINDING_MISMATCH/);assert.equal(f.events.length,1);}
});
