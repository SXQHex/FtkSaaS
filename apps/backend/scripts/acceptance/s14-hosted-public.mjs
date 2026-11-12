import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {newUuidV7 as key} from '../uuid.mjs';
import {signPublicApplication,publicSubmitPath} from '../p04-public-ingress.mjs';

const origin='https://gwyprhenabtpkbojephw.supabase.co';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const requireValue=(ok,code)=>{if(!ok)throw Error(code);};

// The caller provisions and later retires its own published lesson. This runner
// owns only its unique synthetic application and the fresh native login session.
// A real visitor proof and trusted visitor IP are operator inputs, never minted.
export async function acceptPublicApplication(config,{state,saveState,request=fetch}={}){
 const {org,center,session,publication,email,password,apikey,ingressSecret,clientIp,botProof}=config;
 for(const id of [org,center,session,publication])requireValue(uuid.test(id??''),'EXPLICIT_FIXTURE_REQUIRED');
 requireValue(typeof email==='string'&&email&&typeof password==='string'&&password,'NATIVE_LOGIN_REQUIRED');
 requireValue(typeof botProof==='string'&&botProof&&botProof.length<=10000,'REAL_PROVIDER_PROOF_REQUIRED');
 requireValue(typeof apikey==='string','LEGACY_ANON_REQUIRED');
 let claims;try{claims=JSON.parse(Buffer.from(apikey.split('.')[1],'base64url').toString());}catch{throw Error('LEGACY_ANON_REQUIRED');}
 requireValue(apikey.split('.').length===3&&claims.role==='anon'&&claims.ref==='gwyprhenabtpkbojephw','LEGACY_ANON_REQUIRED');
 // Validate trust inputs before authenticating or making any network request.
 signPublicApplication('{}',clientIp,ingressSecret);
 requireValue(typeof saveState==='function','DURABLE_STATE_REQUIRED');
 const fixture={org,center,session,publication};
 if(!state)state={fixture,clientRequestKey:key(),reviewKey:key(),baselineChecked:false,sessions:[]};
 assert.deepEqual(state.fixture,fixture,'FIXTURE_CHANGED');
 for(const id of [state.clientRequestKey,state.reviewKey])requireValue(uuid.test(id??''),'INVALID_STATE');
 requireValue(Array.isArray(state.sessions)&&state.sessions.every(s=>uuid.test(s.id??'')&&uuid.test(s.revokeKey??'')&&(s.createdAt===null||typeof s.createdAt==='string'&&Number.isFinite(Date.parse(s.createdAt)))&&typeof s.cleanupConfirmed==='boolean')&&new Set(state.sessions.map(s=>s.id)).size===state.sessions.length,'INVALID_SESSION_STATE');
 const contact='s14-'+state.clientRequestKey+'@example.invalid';
 let token,accountId,currentSession,phase='login',failure,cleanupFailed=false;
 const json=async(path,body,authorization)=>{
  const r=await request(origin+path,{method:'POST',headers:{apikey,'content-type':'application/json',...(authorization?{authorization:'Bearer '+authorization}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});
  let data;try{data=await r.json();}catch{throw Error('INVALID_RESPONSE');}
  requireValue(r.ok,'HTTP_REJECTED');return data;
 };
 const api=async(op,body={},operationKey)=>{
  const out=await json('/functions/v1/backend-v1/'+op,{client_api_version:1,request_id:key(),...body,...(operationKey?{operation_key:operationKey}:{})},token);
  requireValue(out.ok===true&&out.data,'API_REJECTED');return out.data;
 };
 const inbox=async application=>{
  const rows=[],seen=new Set();let cursor;
  do{
   const page=await api('management_state_get_v1',{org_id:org,center_id:center,operation:'public_application_review_v1',selector:{operation:'public_application_review_v1',key:application?{application_id:application}:{}},page:{limit:200,...(cursor?{cursor}:{})}});
   requireValue(Array.isArray(page.items),'INVALID_INBOX');rows.push(...page.items);
   cursor=page.next_cursor;if(cursor){requireValue(typeof cursor==='string'&&!seen.has(cursor),'INVALID_CURSOR');seen.add(cursor);}
  }while(cursor);
  return rows.filter(x=>x.current?.values?.contact===contact);
 };
 const sessions=async()=>{
  const items=[],seen=new Set();let cursor;
  do{
   const page=await api('account_sessions_list_v1',cursor?{cursor}:{});
   requireValue(Array.isArray(page.items),'INVALID_SESSION_LIST');items.push(...page.items);
   cursor=page.next_cursor;if(cursor){requireValue(typeof cursor==='string'&&!seen.has(cursor),'INVALID_SESSION_CURSOR');seen.add(cursor);}
  }while(cursor);
  return items;
 };
 try{
  const login=await json('/auth/v1/token?grant_type=password',{email,password});token=login.access_token;
  requireValue(typeof token==='string'&&token,'LOGIN_SESSION_MISSING');
  const identity=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
  requireValue(uuid.test(identity.session_id??'')&&uuid.test(identity.sub??''),'LOGIN_SESSION_ID_MISSING');
  if(state.authUserId)requireValue(state.authUserId===identity.sub,'NATIVE_ACTOR_CHANGED');else state.authUserId=identity.sub;
  requireValue(!state.sessions.some(s=>s.id===identity.session_id),'FRESH_SESSION_REQUIRED');
  currentSession={id:identity.session_id,revokeKey:key(),createdAt:null,cleanupConfirmed:false};state.sessions.push(currentSession);
  // Persist ownership immediately, before any domain read or write. Only these
  // recorded sessions can be revoked on a later run; never mode=others.
  await saveState(structuredClone(state));
  accountId=(await api('account_get_v1')).id;requireValue(uuid.test(accountId??''),'ACCOUNT_MISSING');
  if(state.accountId)requireValue(state.accountId===accountId,'ACTOR_CHANGED');else state.accountId=accountId;
  phase='recorded session recovery';
  let live=await sessions();const own=live.find(s=>s.session_id===currentSession.id&&s.current===true);
  requireValue(own&&typeof own.created_at==='string'&&Number.isFinite(Date.parse(own.created_at)),'CURRENT_SESSION_NOT_CONFIRMED');
  currentSession.createdAt=own.created_at;await saveState(structuredClone(state));
  for(const previous of state.sessions.filter(s=>s!==currentSession&&!s.cleanupConfirmed)){
   const old=live.find(s=>s.session_id===previous.id);
   if(old){
    requireValue(old.current===false&&(previous.createdAt===null||old.created_at===previous.createdAt),'PRIOR_SESSION_OWNERSHIP_MISMATCH');
    await api('account_sessions_revoke_v1',{mode:'selected',session_id:previous.id},previous.revokeKey);
    live=await sessions();requireValue(!live.some(s=>s.session_id===previous.id),'PRIOR_SESSION_STILL_ACTIVE');
   }
   previous.cleanupConfirmed=true;await saveState(structuredClone(state));
  }
  phase='published lesson verification';
  const published=await api('management_state_get_v1',{org_id:org,center_id:center,operation:'publication_set_v1',selector:{operation:'publication_set_v1',key:{session_id:session}},page:{}});
  const row=published.items?.find(x=>x.entity?.id===publication);
  requireValue(row?.current?.values?.published===true&&row.current.values.session_id===session,'FIXTURE_NOT_PUBLISHED');
  phase='application baseline';
  if(!state.baselineChecked){requireValue((await inbox()).length===0,'APPLICATION_ALREADY_EXISTS');state.baselineChecked=true;await saveState(structuredClone(state));}
  const payload={client_api_version:1,request_id:state.clientRequestKey,publication_id:publication,contact,bot_proof:botProof,client_request_key:state.clientRequestKey};
  const raw=JSON.stringify(payload);
  const submit=async()=>{
   const r=await request(origin+publicSubmitPath,{method:'POST',headers:{apikey,authorization:'Bearer '+apikey,'content-type':'application/json',...signPublicApplication(raw,clientIp,ingressSecret)},body:raw,redirect:'error',signal:AbortSignal.timeout(30000)});
   const out=await r.json();requireValue(r.ok&&out.ok===true&&out.data?.accepted===true,'PUBLIC_SUBMIT_NOT_ACCEPTED');
  };
  phase='real signed submit';await submit();
  phase='accepted intent replay';await submit();
  phase='inbox ownership';
  const matches=await inbox(state.applicationId);requireValue(matches.length===1,'APPLICATION_NOT_UNIQUE');
  const application=matches[0],id=application.entity?.id;
  requireValue(uuid.test(id??'')&&application.current.values.publication_id===publication&&application.current.values.person_id===null,'APPLICATION_OWNERSHIP_MISMATCH');
  if(state.applicationId)requireValue(state.applicationId===id,'APPLICATION_CHANGED');else{state.applicationId=id;await saveState(structuredClone(state));}
  if(!state.reviewRequest){
   requireValue(application.state==='pending','APPLICATION_NOT_PENDING');
   const version=application.versions?.find(x=>x.entity?.type==='public_applications'&&x.entity.id===id)?.version;
   requireValue(Number.isInteger(version)&&version>0,'APPLICATION_VERSION_MISSING');
   state.reviewRequest={org_id:org,center_id:center,application_id:id,expected_version:version,action:'close'};
   await saveState(structuredClone(state));
  }
  requireValue(Object.keys(state.reviewRequest).sort().join(',')==='action,application_id,center_id,expected_version,org_id'
   &&state.reviewRequest.org_id===org&&state.reviewRequest.center_id===center&&state.reviewRequest.application_id===id
   &&state.reviewRequest.action==='close'&&Number.isInteger(state.reviewRequest.expected_version)&&state.reviewRequest.expected_version>0,'REVIEW_STATE_MISMATCH');
  phase='explicit versioned review';
  const closed=await api('public_application_review_v1',state.reviewRequest,state.reviewKey);
  requireValue(closed.primary_id===id,'REVIEW_REFERENCE_MISMATCH');
  const after=await inbox(id);requireValue(after.length===1&&after[0].state==='closed'&&after[0].current.values.person_id===null,'REVIEW_NOT_CONFIRMED');
  state.applicationClosed=true;await saveState(structuredClone(state));
 }catch{failure=phase;}
 finally{
  if(token){
   try{
    const logout=await request(origin+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey,authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(30000)});
    await logout.body?.cancel();requireValue(logout.status===204,'LOGOUT_FAILED');
    const r=await request(origin+'/functions/v1/backend-v1/account_get_v1',{method:'POST',headers:{apikey,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key()}),redirect:'error',signal:AbortSignal.timeout(30000)});
    const denied=await r.json();requireValue(!r.ok&&denied.ok===false&&['AUTH_REQUIRED','SESSION_REVOKED'].includes(denied.error?.code),'SESSION_STILL_USABLE');
    if(currentSession){currentSession.cleanupConfirmed=true;await saveState(structuredClone(state));}
   }catch{cleanupFailed=true;}
  }
 }
 if(cleanupFailed)throw Error('PUBLIC_ACCEPTANCE_SESSION_CLEANUP_UNCONFIRMED');
 if(failure)throw Error('PUBLIC_ACCEPTANCE_FAILED_AT_'+failure.replaceAll(' ','_').toUpperCase());
 requireValue(state.sessions.every(s=>s.cleanupConfirmed),'PUBLIC_ACCEPTANCE_PRIOR_SESSION_CLEANUP_UNCONFIRMED');
 return {status:'passed',checks:['signed HTTP accepted','same intent replay left one scoped application','versioned authorized review closed only synthetic application','no person created; fresh native session closed'],fixtureRetirementRequired:true};
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 let lock,lockPath;
 try{
  const path=process.env.FTK_ACCEPTANCE_STATE;
  requireValue(typeof path==='string'&&path,'PRIVATE_STATE_PATH_REQUIRED');
  const directory=fs.statSync(dirname(path));requireValue(directory.isDirectory()&&(directory.mode&0o077)===0,'PRIVATE_DIRECTORY_REQUIRED');
  lockPath=path+'.lock';lock=fs.openSync(lockPath,'wx',0o600);
  let state;
  if(fs.existsSync(path)){const stat=fs.lstatSync(path);requireValue(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0,'PRIVATE_STATE_PERMISSIONS_REQUIRED');state=JSON.parse(fs.readFileSync(path,'utf8'));}
  const saveState=async next=>{
   const temporary=path+'.pending',fd=fs.openSync(temporary,'wx',0o600);
   try{fs.writeFileSync(fd,JSON.stringify(next)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
   fs.renameSync(temporary,path);const parent=fs.openSync(dirname(path),'r');try{fs.fsyncSync(parent);}finally{fs.closeSync(parent);}
  };
  const c=process.env;
  const result=await acceptPublicApplication({org:c.FTK_ACCEPTANCE_ORG,center:c.FTK_ACCEPTANCE_CENTER,session:c.FTK_ACCEPTANCE_SESSION,publication:c.FTK_ACCEPTANCE_PUBLICATION,email:c.FTK_ACCEPTANCE_EMAIL,password:c.FTK_ACCEPTANCE_PASSWORD,apikey:c.FTK_ACCEPTANCE_APIKEY,ingressSecret:c.FTK_ACCEPTANCE_INGRESS_SECRET,clientIp:c.FTK_ACCEPTANCE_VISITOR_IP,botProof:c.FTK_ACCEPTANCE_BOT_PROOF},{state,saveState});
  console.log(JSON.stringify(result));
 }catch{console.error('Public backend acceptance incomplete; inspect private state and retire only owned fixtures. Credentials and provider responses withheld.');process.exitCode=1;}
 finally{if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(lockPath);}}
}
