import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {newUuidV7 as key} from '../uuid.mjs';

const origin='https://gwyprhenabtpkbojephw.supabase.co';
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');

// Opt-in normal-API acceptance. Supply a dedicated synthetic product and an
// existing agreement belonging to this account. Evidence is append-only and
// deliberately retained; this runner never changes agreement terms or roles.
export async function acceptDigital({email,password,apikey,org,center,product,agreement,outsiderEmail,outsiderPassword,request=fetch}){
 assert(email&&password&&apikey&&org&&center&&product&&agreement&&outsiderEmail&&outsiderPassword,'Acceptance inputs required');
 assert.notEqual(email,outsiderEmail,'Distinct native accounts required');
 const sessions=[],checks=[];let phase='login';
 const json=async(path,body,session)=>{
  const response=await request(origin+path,{method:'POST',headers:{apikey,'content-type':'application/json',...(session?{authorization:'Bearer '+session}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('HTTP_'+response.status);
  return response.status===204?null:response.json();
 };
 const login=async(email,password)=>{
  const session=(await json('/auth/v1/token?grant_type=password',{email,password})).access_token;
  assert(session,'Native session required');sessions.push(session);return session;
 };
 const call=async(session,operation,body={},operationKey)=>{
  const result=await json('/functions/v1/backend-v1/'+operation,{client_api_version:1,request_id:key(),org_id:org,center_id:center,...body,...(operationKey?{operation_key:operationKey}:{})},session);
  if(!result.ok)throw Error(result.error?.code??'INVALID_ENVELOPE');return result.data;
 };
 const deny=async(code,session,operation,body)=>assert.rejects(()=>call(session,operation,body,operation==='document_accept_v1'||operation==='instructor_agreement_accept_v1'?key():undefined),error=>error.message===code);
 try{
  const session=await login(email,password),outsider=await login(outsiderEmail,outsiderPassword);
  phase='agreement preflight';
  const initial=await call(session,'instructor_agreement_get_v1',{agreement_id:agreement});
  assert.equal(initial.acceptance,null,'Use a dedicated unaccepted synthetic agreement');
  assert.equal(initial.agreement.id,agreement);assert.equal(initial.agreement.center_id,center);
  // Resolve self authority before any durable publication or consent.
  const selector={operation:'instructor_agreement_accept_v1',selector:{operation:'instructor_agreement_accept_v1',key:{agreement_id:agreement}}};
  const management=await call(session,'management_state_get_v1',selector);
  assert.equal(management.items[0].current.values.source_content_hash,initial.source_content_hash);
  await deny('NOT_FOUND',outsider,'instructor_agreement_get_v1',{agreement_id:agreement});
  phase='publication';
  const source={name:'Synthetic hosted consent',language:'tr',template_id:'hosted-consent',template_version:'1',text:'Sentetik kabul\r\nKoşullar: ı İ ş e\u0301\nOnaylıyorum.\n'};
  const publication={digital_content:source,version_label:'hosted-'+key(),scope:{kind:'center',center_id:center},requirements:[{gate:'sale',scope:{center_ids:[center],product_version_ids:[product]},renewed_acceptance:true}]};
  const preview=await call(session,'document_publication_preview_v1',publication);assert.deepEqual(preview.affected,[]);
  const publishKey=key(),published=await call(session,'document_version_publish_v1',publication,publishKey),version=published.primary_id;
  assert.equal((await call(session,'document_version_publish_v1',publication,publishKey)).replayed,true);
  const context={gate:'sale',subject:{type:'product_versions',id:product}};
  const read=extra=>call(session,'document_requirements_get_v1',{context,...extra});
  const item=(await read()).find(x=>x.version_id===version);assert(item);assert.equal(item.content_kind,'digital');assert.equal(item.accepted,false);assert.equal(item.digital_content,undefined);
  const contents=async()=>(await read({content_file_id:item.file.id})).find(x=>x.version_id===version);
  const shown=await contents();assert.deepEqual(shown.digital_content,source);assert.equal(shown.content_hash,hash(source.text));assert.equal(Buffer.from(shown.content.data,'base64').toString('utf8'),source.text);
  checks.push('product-scoped publication preview, publish replay and exact UTF-8 source read');
  phase='document consent';
  const displayed={...source,language:'en',text:'Synthetic acceptance\r\nDisplayed terms: e\u0301\nI accept.\n'};
  const body={document_version_id:version,context,displayed_content:displayed,displayed_content_hash:hash(displayed.text)};
  await deny('VALIDATION_FAILED',session,'document_accept_v1',{document_version_id:version,context});
  await deny('VALIDATION_FAILED',session,'document_accept_v1',{...body,displayed_content_hash:'0'.repeat(64)});
  await deny('VERSION_CONFLICT',session,'document_accept_v1',{...body,displayed_content:{...displayed,template_version:'2'}});
  const consentKey=key(),accepted=await call(session,'document_accept_v1',body,consentKey);
  assert.equal((await call(session,'document_accept_v1',body,consentKey)).replayed,true);
  const evidence=(await contents()).digital_acceptance;
  assert.equal(evidence.id,accepted.primary_id);assert.equal(evidence.person_id,initial.agreement.person_id);assert.deepEqual(evidence.displayed_content,displayed);assert.equal(evidence.content_hash,hash(displayed.text));assert.equal(evidence.source_content_hash,hash(source.text));assert(Number.isFinite(Date.parse(evidence.accepted_at)));
  await deny('IDEMPOTENCY_PAYLOAD_MISMATCH',session,'document_accept_v1',{...body,displayed_content:{...displayed,text:'Changed'},displayed_content_hash:hash('Changed')});
  const history=await call(session,'management_state_get_v1',{operation:'document_accept_v1',selector:{operation:'document_accept_v1',key:{document_version_id:version}}});
  assert.deepEqual(history.items[0].current.values.digital_acceptance,evidence);
  checks.push('document snapshot/hash/template rejection, self consent, replay and immutable-history read');
  phase='agreement consent';
  const agreementText={name:'Synthetic hosted instructor acceptance',language:'tr',template_id:'hosted-instructor',template_version:'1',text:'Sentetik backend kabulü\n'+JSON.stringify(initial.agreement,null,2)+'\nOnaylıyorum.\n'};
  const b={agreement_id:agreement,expected_version:initial.agreement.version,source_content_hash:initial.source_content_hash,displayed_content:agreementText,displayed_content_hash:hash(agreementText.text)};
  await deny('VERSION_CONFLICT',session,'instructor_agreement_accept_v1',{...b,source_content_hash:'0'.repeat(64)});
  await deny('VERSION_CONFLICT',session,'instructor_agreement_accept_v1',{...b,expected_version:initial.agreement.version+1});
  await deny('VALIDATION_FAILED',session,'instructor_agreement_accept_v1',{...b,displayed_content_hash:'0'.repeat(64)});
  const agreementKey=key();await call(session,'instructor_agreement_accept_v1',b,agreementKey);
  assert.equal((await call(session,'instructor_agreement_accept_v1',b,agreementKey)).replayed,true);
  const done=await call(session,'instructor_agreement_get_v1',{agreement_id:agreement});
  assert.deepEqual(done.agreement,initial.agreement);assert.equal(done.source_content_hash,initial.source_content_hash);assert.equal(done.acceptance.person_id,initial.agreement.person_id);assert.equal(done.acceptance.account_id,evidence.account_id);assert.deepEqual(done.acceptance.displayed_content,agreementText);assert.equal(done.acceptance.content_hash,hash(agreementText.text));assert.equal(done.acceptance.source_content_hash,initial.source_content_hash);assert(Number.isFinite(Date.parse(done.acceptance.accepted_at)));
  await deny('IDEMPOTENCY_PAYLOAD_MISMATCH',session,'instructor_agreement_accept_v1',{...b,displayed_content:{...agreementText,text:'Changed'},displayed_content_hash:hash('Changed')});
  assert.deepEqual((await call(session,'instructor_agreement_get_v1',{agreement_id:agreement})).acceptance,done.acceptance);
  checks.push('agreement source/version/hash rejection, native self consent, replay and unchanged terms');
  phase='tenant isolation';
  // The supplied outsider must have no live link to this organization.
  await deny('NOT_FOUND',outsider,'instructor_agreement_get_v1',{agreement_id:agreement});
  await deny('NOT_FOUND',outsider,'instructor_agreement_accept_v1',b);
  await deny('NOT_FOUND',outsider,'document_requirements_get_v1',{context,content_file_id:item.file.id});
  await deny('NOT_FOUND',outsider,'document_accept_v1',body);
  checks.push('unlinked native account cannot read or accept either resource');
  return {status:'passed',checks};
 }catch{
  throw Error('Hosted digital acceptance failed at '+phase);
 }finally{
  let failed=false;
  for(const session of sessions){try{await json('/auth/v1/logout?scope=local',undefined,session);}catch{failed=true;}}
  if(failed)throw Error('Hosted digital acceptance local-session cleanup failed');
 }
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{console.log(JSON.stringify(await acceptDigital({email:process.env.FTK_ACCEPTANCE_EMAIL,password:process.env.FTK_ACCEPTANCE_PASSWORD,apikey:process.env.FTK_ACCEPTANCE_APIKEY,org:process.env.FTK_ACCEPTANCE_ORG,center:process.env.FTK_ACCEPTANCE_CENTER,product:process.env.FTK_ACCEPTANCE_PRODUCT,agreement:process.env.FTK_ACCEPTANCE_AGREEMENT,outsiderEmail:process.env.FTK_ACCEPTANCE_OUTSIDER_EMAIL,outsiderPassword:process.env.FTK_ACCEPTANCE_OUTSIDER_PASSWORD})));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
