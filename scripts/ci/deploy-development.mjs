import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {v7 as uuid} from 'uuid';
import {revalidateDeployment} from './deployment-source.mjs';

export const project='gwyprhenabtpkbojephw';
export const sha256=s=>createHash('sha256').update(s).digest('hex');
export function unchangedEdge(previous,edge,hash){return previous?.success===true&&previous.project===project&&previous.edge_source_sha256===hash&&previous.edge_version===edge?.version&&edge.status==='ACTIVE'&&edge.verify_jwt===true;}
// CLI stores verbatim SQL chunks without statement separators. MCP stores one
// complete file. Accept both representations; never normalize quoted contents.
function separator(s,final=false){
 while(s.length){
  const m=/^[\s;]+/.exec(s);if(m){s=s.slice(m[0].length);continue;}
  if(s.startsWith('--')){const n=s.indexOf('\n');if(n<0)return final;s=s.slice(n+1);continue;}
  if(s.startsWith('/*')){let depth=1,i=2;for(;i<s.length&&depth;i++){if(s.slice(i,i+2)==='/*'){depth++;i++;}else if(s.slice(i,i+2)==='*/'){depth--;i++;}}if(depth)return false;s=s.slice(i);continue;}
  return false;
 }return true;
}
export function sameMigration(sql,statements){
 if(!Array.isArray(statements)||!statements.length)return false;
 if(statements.length===1&&statements[0]===sql)return true;
 let cursor=0;
 for(const raw of statements){if(typeof raw!=='string'||!raw.trim())return false;const s=raw.trim(),at=sql.indexOf(s,cursor);if(at<0||!separator(sql.slice(cursor,at)))return false;cursor=at+s.length;}
 return separator(sql.slice(cursor),true);
}
export function migrationPlan(local,remote){
 const byVersion=new Map(local.map(m=>[m.version,m]));
 const seen=new Set();
 for(const r of remote){const m=byVersion.get(r.version);if(!m||seen.has(r.version)||!sameMigration(m.sql,r.statements))throw Error('Remote migration content/history mismatch: '+r.version);seen.add(r.version);}
 return local.filter(m=>!seen.has(m.version));
}
const literal=s=>"'"+s.replaceAll("'","''")+"'";

// One Management API request is one PostgreSQL statement/transaction. Execute
// each file inside that transaction, keeping its original bytes in history.
// Remove every explicit top-level BEGIN/COMMIT envelope (module + wrappers),
// preserving comments, quoted identifiers, strings and function bodies.
export function migrationBody(source){
 let i=0,plain='',positions=[],inside=false,envelopes=0;
 const removed=new Set();
 const finish=end=>{
  const command=plain.trim().toLowerCase();
  if(command==='begin'||command==='commit'){
   if(command==='begin'){if(inside)throw Error('Nested migration transaction envelope');inside=true;envelopes++;}
   else{if(!inside)throw Error('Unmatched migration transaction envelope');inside=false;}
   for(const p of positions)if(!/\s/.test(source[p]))removed.add(p);
   if(end!==undefined)removed.add(end);
  }else if(command&&!inside)throw Error('Migration SQL outside BEGIN/COMMIT envelope');
  plain='';positions=[];
 };
 while(i<source.length){
  if(source.startsWith('--',i)){const end=source.indexOf('\n',i+2);i=end<0?source.length:end;plain+=' ';continue;}
  if(source.startsWith('/*',i)){
   let depth=1;i+=2;
   while(i<source.length&&depth){if(source.startsWith('/*',i)){depth++;i+=2;}else if(source.startsWith('*/',i)){depth--;i+=2;}else i++;}
   if(depth)throw Error('Unterminated migration comment');plain+=' ';continue;
  }
  const c=source[i];
  const dollar=c==='$'&&(i===0||!/[\w$\u0080-\uffff]/.test(source[i-1]))?/^\$(?:[a-zA-Z_\u0080-\uffff][a-zA-Z_0-9\u0080-\uffff]*)?\$/.exec(source.slice(i))?.[0]:null;
  if(dollar){
   const end=source.indexOf(dollar,i+dollar.length);if(end<0)throw Error('Unterminated migration dollar quote');
   i=end+dollar.length;plain+=' quoted ';continue;
  }
  if(c==="'"||c==='"'){
   const escaped=c==="'"&&i>0&&/[eE]/.test(source[i-1])&&(i<2||!/[\w$\u0080-\uffff]/.test(source[i-2]));
   i++;let closed=false;
   while(i<source.length){
    if(escaped&&source[i]==='\\'){i+=2;continue;}
    if(source[i]===c){if(source[i+1]===c){i+=2;continue;}i++;closed=true;break;}i++;
   }
   if(!closed)throw Error('Unterminated migration quote');plain+=' quoted ';continue;
  }
  if(c===';'){finish(i);i++;continue;}
  plain+=c;positions.push(i);i++;
 }
 if(plain.trim())throw Error('Unterminated migration statement');
 if(inside||!envelopes)throw Error('Migration requires a complete BEGIN/COMMIT envelope');
 return source.split('').map((c,p)=>removed.has(p)?' ':c).join('');
}
const sqlText=s=>"pg_catalog.convert_from(pg_catalog.decode('"+Buffer.from(s,'utf8').toString('hex')+"','hex'),'UTF8')";
export function migrationBatch(local,remote){
 const pending=migrationPlan(local,remote);
 if(!pending.length)return null;
 const snapshot=remote.map(r=>({version:r.version,name:r.name??null,hashes:r.statements.map(sha256)})).sort((a,b)=>a.version<b.version?-1:a.version>b.version?1:0);
 const commands=pending.map(m=>{
  if(!/^\d{14}_[a-z0-9_]+\.sql$/.test(m.name)||m.version!==m.name.slice(0,14))throw Error('Unexpected migration identity');
  return `execute ${sqlText(migrationBody(m.sql))};
insert into supabase_migrations.schema_migrations(version,name,statements)
values (${literal(m.version)},${literal(m.name.slice(15,-4))},array[${sqlText(m.sql)}]);`;
 }).join('\n');
 return `do $ftk_delivery$
begin
lock table supabase_migrations.schema_migrations in share row exclusive mode;
if (select coalesce(jsonb_agg(jsonb_build_object('version',h.version,'name',h.name,'hashes',
 (select jsonb_agg(encode(sha256(convert_to(s,'UTF8')),'hex') order by n)
 from unnest(h.statements) with ordinality as x(s,n))) order by h.version),'[]'::jsonb)
 from supabase_migrations.schema_migrations h) is distinct from ${sqlText(JSON.stringify(snapshot))}::jsonb
then raise exception 'Migration history changed since preflight';end if;
${commands}
end $ftk_delivery$;`;
}
// Exercise the pending path even on a no-op delivery. Both attempts are rolled
// back inside subtransactions; no synthetic migration or table survives.
export function migrationTransportProbe(local,remote){
 migrationPlan(local,remote);
 const applied=local.filter(m=>remote.some(r=>r.version===m.version));
 const first={version:'20990101000001',name:'20990101000001_delivery_probe.sql',sql:'begin;\ncreate temporary table ftk_migration_delivery_probe(value integer);\ncommit;\nbegin;\ninsert into ftk_migration_delivery_probe values (1);\ncommit;\n'};
 const failure={version:'20990101000002',name:'20990101000002_delivery_failure.sql',sql:'begin;\nselect 1/0;\ncommit;\n'};
 if(remote.some(r=>r.version===first.version||r.version===failure.version))throw Error('Migration probe identity already exists');
 const cleanup=`if exists(select 1 from supabase_migrations.schema_migrations where version in ('20990101000001','20990101000002')) or to_regclass('pg_temp.ftk_migration_delivery_probe') is not null then raise exception 'Migration probe was not rolled back';end if;`;
 return `do $ftk_probe$
begin
begin
 execute ${sqlText(migrationBatch([...applied,first],remote))};
 if (select value from pg_temp.ftk_migration_delivery_probe)<>1 or not exists(select 1 from supabase_migrations.schema_migrations where version='20990101000001' and statements=array[${sqlText(first.sql)}]) then raise exception 'Migration probe readback failed';end if;
 raise exception using errcode='F0001',message='Rollback successful migration probe';
exception when sqlstate 'F0001' then null;end;
${cleanup}
begin
 execute ${sqlText(migrationBatch([...applied,first,failure],remote))};
 raise exception 'Late migration failure was not rejected';
exception when division_by_zero then null;end;
${cleanup}
end $ftk_probe$;`;
}

export async function deliver(){
 const receipt={project,environment:'development/test (Supabase production branch)',source:process.env.ACCEPTED_SHA,expected_main:process.env.EXPECTED_MAIN_SHA,acceptance_run_id:process.env.ACCEPTANCE_RUN_ID,acceptance_attempt:Number(process.env.ACCEPTANCE_ATTEMPT),checks:[],success:false};
 const record=(name,passed)=>{receipt.checks.push({name,passed:!!passed});if(!passed)throw Error('Verification failed: '+name);};
 let stage='configuration',temp;
 const api=async(route,{method='GET',body}={})=>{
  const r=await fetch('https://api.supabase.com/v1/projects/'+project+route,{method,headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
  if(!r.ok)throw Error('Supabase Management API HTTP '+r.status);return r.status===204?null:r.json();
 };
 const sql=query=>api('/database/query',{method:'POST',body:{query}});
 const gh=async route=>{
  const r=await fetch('https://api.github.com/repos/SXQHex/FtkSaaS/'+route,{headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('Cannot revalidate GitHub acceptance: HTTP '+r.status);return r.json();
 };
 const github={rest:{
  git:{getRef:async()=>({data:await gh('git/ref/heads/main')}),getTree:async a=>({data:await gh('git/trees/'+a.tree_sha+'?recursive=1')}),getBlob:async a=>({data:await gh('git/blobs/'+a.file_sha)})},
  repos:{compareCommitsWithBasehead:async a=>({data:await gh('compare/'+a.basehead)})},
  actions:{getWorkflowRun:async a=>({data:await gh('actions/runs/'+a.run_id)}),listJobsForWorkflowRun:async a=>({data:await gh('actions/runs/'+a.run_id+'/jobs?filter=latest&per_page=100&page='+a.page)})}
 },paginate:async(method,args)=>{const all=[];for(let page=1;;page++){const rows=(await method({...args,page})).data.jobs;all.push(...rows);if(rows.length<100)return all;}}};
 const current=()=>revalidateDeployment(github,{owner:'SXQHex',repo:'FtkSaaS'},{sha:receipt.source,expected_main:receipt.expected_main,run_id:Number(receipt.acceptance_run_id),attempt:receipt.acceptance_attempt});
 const cli=(args)=>{const r=spawnSync(path.resolve('node_modules/.bin/supabase'),args,{encoding:'utf8',timeout:600000,maxBuffer:20*1024*1024,env:process.env});if(r.error||r.status!==0)throw Error('Supabase CLI failed in '+stage+'; output withheld to protect credentials/SQL');};
 try{
  for(const key of ['SUPABASE_ACCESS_TOKEN','GH_TOKEN','ACCEPTED_SHA','ACCEPTANCE_RUN_ID','ACCEPTANCE_ATTEMPT','EXPECTED_MAIN_SHA'])if(!process.env[key])throw Error('Missing required secret/input: '+key);
  if(process.env.SUPABASE_NATIVE_DEPLOY_DISABLED!=='true')throw Error('Native integration deployment must be verified disabled and SUPABASE_NATIVE_DEPLOY_DISABLED=true recorded');
  if(process.env.GITHUB_REPOSITORY!=='SXQHex/FtkSaaS'||!/^\d+$/.test(receipt.acceptance_run_id)||!Number.isSafeInteger(receipt.acceptance_attempt)||receipt.acceptance_attempt<1||!/^[a-f0-9]{40}$/.test(receipt.source)||!/^[a-f0-9]{40}$/.test(receipt.expected_main))throw Error('Unexpected repository/source');
  const head=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});record('checked_out_accepted_source',head.status===0&&head.stdout.trim()===receipt.source);
  await current();
  const manifest=JSON.parse(fs.readFileSync('database/migrations.sha256.json'));
  const local=fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort().map(name=>{
   if(!/^\d{14}_[a-z0-9_]+\.sql$/.test(name))throw Error('Unexpected migration filename');
   const source=fs.readFileSync('supabase/migrations/'+name),sql=source.toString('utf8');
   if(sha256(source)!==manifest[name])throw Error('Frozen migration hash mismatch');
   return {name,version:name.slice(0,14),sql};
  });
  record('complete_migration_manifest',local.length===Object.keys(manifest).length);
  const history=()=>sql('select version, name, statements from supabase_migrations.schema_migrations order by version');
  stage='migration preflight';
  const remote=await history(),pending=migrationPlan(local,remote);receipt.pending_migrations=pending.map(m=>m.name);
  receipt.migration_transport='management-api-atomic-v1';
  await current();stage='migration transport probe';
  await sql(migrationTransportProbe(local,remote));record('migration_transport_apply_and_rollback',true);
  if(pending.length){
   await current();stage='migration deployment';
   await sql(migrationBatch(local,remote));
  }
  stage='migration readback';
  record('all_migration_contents_match',migrationPlan(local,await history()).length===0);receipt.migration_count=local.length;
  await current();stage='edge deployment';
  // Isolate hosted settings from the intentionally different local JWT config.
  temp=fs.mkdtempSync(path.join(os.tmpdir(),'ftk-hosted-'));
  const fn=path.join(temp,'supabase/functions/backend-v1');fs.mkdirSync(fn,{recursive:true});
  const bundle=fs.readFileSync('supabase/functions/backend-v1/index.ts');receipt.edge_source_sha256=sha256(bundle);
  fs.writeFileSync(path.join(fn,'index.ts'),bundle);
  fs.writeFileSync(path.join(temp,'supabase/config.toml'),'project_id = "ftksaas-hosted-development"\n[functions.backend-v1]\nverify_jwt = true\n');
  const previous=fs.existsSync('.ci/previous-development-delivery.json')?JSON.parse(fs.readFileSync('.ci/previous-development-delivery.json')):null;
  const before=await api('/functions/backend-v1');
  receipt.edge_unchanged=unchangedEdge(previous,before,receipt.edge_source_sha256);
  if(!receipt.edge_unchanged)cli(['functions','deploy','backend-v1','--project-ref',project,'--use-api','--workdir',temp,'--yes']);
  const edge=await api('/functions/backend-v1');
  record('edge_active_jwt_required',edge.status==='ACTIVE'&&edge.verify_jwt===true);receipt.edge_version=edge.version;receipt.edge_bundle_sha256=edge.ezbr_sha256??null;
  stage='database permissions';
  const [permissions]=await sql("select (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='core' and c.relkind='r') as core_tables, (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='core' and c.relkind='r' and not c.relrowsecurity) as missing_rls, (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api_v1' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) as exposed_rpc");
  record('core_rls_and_direct_rpc_denied',permissions.core_tables>0&&permissions.missing_rls===0&&permissions.exposed_rpc===0);receipt.permissions=permissions;
  stage='hosted smoke';await current();await hostedSmoke(api,sql,record);
  stage='advisors';receipt.advisors={};
  for(const type of ['security','performance']){const data=await api('/advisors/'+type),lints=data.lints;if(!Array.isArray(lints))throw Error('Unknown advisors response');receipt.advisors[type]=lints.reduce((out,l)=>{out[l.level]=(out[l.level]??0)+1;return out;},{});record(type+'_advisors_no_errors',!lints.some(l=>l.level==='ERROR'));}
  await current();receipt.success=true;
 }catch(e){receipt.failed_stage=stage;receipt.error=e.message;throw e;}
 finally{
  if(temp)fs.rmSync(temp,{recursive:true,force:true});
  fs.mkdirSync('.ci',{recursive:true});fs.writeFileSync('.ci/development-delivery.json',JSON.stringify(receipt,null,2)+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\nDevelopment/test delivery receipt (not full clean):\n```json\n'+JSON.stringify(receipt,null,2)+'\n```\n');
 }
}

export async function hostedSmoke(api,sql,record){
 const keys=await api('/api-keys?reveal=true');
 const publicKey=keys.find(k=>k.type==='publishable')?.api_key??keys.find(k=>k.name==='anon')?.api_key;
 const adminKey=keys.find(k=>k.name==='service_role')?.api_key;
 if(!publicKey||!adminKey)throw Error('Hosted smoke requires publishable/anon and legacy service_role keys');
 const root='https://'+project+'.supabase.co';
 const http=async(route,{body,token,admin=false,method,headers={}}={})=>{
  const r=await fetch(root+route,{method:method??(body===undefined?'GET':'POST'),headers:{apikey:admin?adminKey:publicKey,'Content-Type':'application/json',...(token||admin?{Authorization:'Bearer '+(token??adminKey)}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  const text=await r.text();let data={};try{if(text)data=JSON.parse(text);}catch{}return {status:r.status,data};
 };
 const authId=uuid(),email='cd-'+authId+'@example.invalid',password=randomBytes(32).toString('base64url');
 let token,created=false;
 const edge=(op,body={})=>http('/functions/v1/backend-v1/'+op,{token,body:{client_api_version:1,request_id:uuid(),...body}});
 try{
  // Known ID permits cleanup even when the create request's response is lost.
  created=true;
  const user=await http('/auth/v1/admin/users',{admin:true,body:{id:authId,email,password,email_confirm:true}});
  record('synthetic_user_created',user.status===200&&user.data.id===authId);
  const session=await http('/auth/v1/token?grant_type=password',{body:{email,password}});token=session.data.access_token;
  record('real_auth_login',session.status===200&&!!token);
  const account=await edge('account_get_v1');record('auth_edge_rpc_account',account.status===200&&account.data.ok===true);
  const orgs=await edge('organizations_list_v1',{page:{}});record('organizations_read',orgs.status===200&&orgs.data.ok===true);
  const finance=await edge('finance_get_v1',{org_id:uuid(),center_id:uuid(),person_id:uuid(),currency:'TRY',page:{}});record('finance_tenant_boundary',finance.status===200&&finance.data.ok===false&&finance.data.error?.code==='NOT_FOUND');
  const direct=await http('/rest/v1/rpc/finance_get_v1',{token,headers:{'Content-Profile':'api_v1'},body:{p_request:{},p_actor_auth_id:authId,p_session_id:uuid(),p_ids:[],p_aux:null}});record('direct_rpc_rejected',direct.status===403&&direct.data.code==='42501');
  const invalid=await http('/functions/v1/backend-v1/account_get_v1',{token:'invalid-jwt',body:{client_api_version:1,request_id:uuid()}});record('invalid_jwt_rejected',invalid.status===401);
  const logout=await http('/auth/v1/logout',{token,body:{}});record('logout',logout.status===200||logout.status===204);
  const old=await edge('account_get_v1');record('revoked_session_rejected',old.status===401&&old.data.ok===false&&['AUTH_REQUIRED','SESSION_REVOKED'].includes(old.data.error?.code));
 }finally{
  if(created){
   // Attempt both cleanup operations even if one fails. Never delete by domain.
   const results=[];
   for(const cleanup of [
    ()=>sql('delete from core.accounts where auth_user_id='+literal(authId)),
    ()=>http('/auth/v1/admin/users/'+authId,{admin:true,method:'DELETE'})
   ]){try{results.push({status:'fulfilled',value:await cleanup()});}catch{results.push({status:'rejected'});}}
   const [left]=await sql('select (select count(*)::int from core.accounts where auth_user_id='+literal(authId)+') as accounts, (select count(*)::int from auth.users where id='+literal(authId)+') as users');
   record('synthetic_fixture_removed',left.accounts===0&&left.users===0&&results.every(r=>r.status==='fulfilled'));
  }
 }
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href)deliver().catch(()=>{console.error('Development delivery failed; see sanitized receipt.');process.exitCode=1;});
