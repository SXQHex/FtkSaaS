// ReauthProof is a native access token obtained by a fresh sign-in, not a password
// and not a refreshed token from an old session. Session age is checked by SQL.
export async function lifecycleReauth(base:string,key:string,proof:string,actorId:string,fetcher:typeof fetch=fetch){
 if(typeof proof!=='string'||proof.length>16384)return {error:'AUTH_REQUIRED'};
 try{
  const response=await fetcher(base+'/auth/v1/user',{headers:{authorization:'Bearer '+proof,apikey:key},signal:AbortSignal.timeout(10000)});
  if(!response.ok)return {error:response.status===401?'AUTH_REQUIRED':'TEMPORARY_FAILURE'};
  const user=await response.json();
  const payload=proof.split('.')[1];if(!payload)return {error:'AUTH_REQUIRED'};
  const claims=JSON.parse(atob(payload.replaceAll('-','+').replaceAll('_','/')));
  if(user.id!==actorId||claims.sub!==actorId||typeof claims.session_id!=='string'||!/^[a-f0-9-]{36}$/i.test(claims.session_id))return {error:'AUTH_REQUIRED'};
  if(user.factors?.some((f:any)=>f.status==='verified')&&claims.aal!=='aal2')return {error:'AUTH_REQUIRED'};
  return {context:{reauth_verified:true,reauth_auth_id:actorId,reauth_session_id:claims.session_id,reauth_aal:claims.aal==='aal2'?'aal2':'aal1'}};
 }catch{return {error:'TEMPORARY_FAILURE'};}
}
