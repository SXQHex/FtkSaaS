import assert from 'node:assert/strict';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// The DB creates an expiring permit; the native provider's DELETE transaction
// checks the lease and live hold again. No provider data or credential is logged.
export async function eraseNativeAccount({db,request,apiUrl,serviceKey,fetcher=fetch}){
 const origin=new URL(apiUrl);
 if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'
  ||!(origin.protocol==='https:'&&/^[a-z]{20}\.supabase\.co$/.test(origin.hostname)
   ||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname)))throw Error('UNTRUSTED_AUTH_ORIGIN');
 if(typeof serviceKey!=='string'||!serviceKey)throw Error('AUTH_ADMIN_KEY_REQUIRED');
 const prepare=async()=>{
  const result=await db.query('select private.p07_auth_erasure_prepare($1) result',[request]);
  return result.rows[0].result;
 };
 const before=await prepare();
 if(['unbound','held','blocked_profile','blocked_storage','completed'].includes(before?.state))return{state:before.state};
 assert.equal(before?.state,'ready','INVALID_AUTH_PREPARATION');
 assert.match(before.auth_user_id,uuid,'INVALID_NATIVE_AUTH_ID');
 if(before.provider_origin!==origin.origin)throw Error('AUTH_PROVIDER_BINDING_MISMATCH');
 const endpoint=origin.origin+'/auth/v1/admin/users/'+before.auth_user_id;
 const headers={apikey:serviceKey,authorization:'Bearer '+serviceKey,'content-type':'application/json'};
 let deleted;
 try{deleted=await fetcher(endpoint,{method:'DELETE',headers,redirect:'error',body:JSON.stringify({should_soft_delete:false}),signal:AbortSignal.timeout(15000)});}
 catch{throw Error('NATIVE_AUTH_RESULT_UNCONFIRMED');}
 await deleted.body?.cancel();
 if(!deleted.ok)throw Error('NATIVE_AUTH_DELETE_REJECTED');
 let readback;
 try{readback=await fetcher(endpoint,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(5000)});}
 catch{throw Error('NATIVE_AUTH_READBACK_UNCONFIRMED');}
 await readback.body?.cancel();
 if(readback.status!==404)throw Error('NATIVE_AUTH_ABSENCE_NOT_CONFIRMED');
 const after=await prepare();
 if(after?.state!=='completed')throw Error('NATIVE_AUTH_PROOF_MISSING');
 return{state:'completed'};
}
