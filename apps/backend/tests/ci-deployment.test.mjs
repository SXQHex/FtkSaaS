import test from 'node:test';
import assert from 'node:assert/strict';
import {project,unchangedEdge,hostedSmoke,sameMigration,migrationPlan,migrationBody,migrationBatch} from '../scripts/ci/deploy-development.mjs';
import {deploymentSource,resolveAcceptedSource,revalidateDeployment,trustedDeliveryRun} from '../scripts/ci/deployment-source.mjs';
import fs,{mkdtempSync,rmSync} from 'node:fs';
import {backendUnchanged} from '../scripts/ci/source.mjs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {repositoryRoot} from '../scripts/paths.mjs';
import {valid,scopedGithub,candidateProofFixture} from './ci-fixtures.mjs';
process.chdir(repositoryRoot);

test('unchanged Edge requires both trusted source receipt and live version/JWT match',()=>{
 const previous={success:true,project,edge_version:3,edge_source_sha256:'hash'},edge={version:3,status:'ACTIVE',verify_jwt:true};
 assert(unchangedEdge(previous,edge,'hash'));
 for(const [p,e,h] of [[null,edge,'hash'],[{...previous,success:false},edge,'hash'],[{...previous,project:'other'},edge,'hash'],[previous,{...edge,version:4},'hash'],[previous,{...edge,verify_jwt:false},'hash'],[previous,edge,'changed']])assert(!unchangedEdge(p,e,h));
});

test('hosted smoke checks real request sequence and cleans its exact UUID even on a failed assertion',async()=>{
 const original=globalThis.fetch;
 const expected=['synthetic_user_created','public_invalid_login_rejected','trusted_invalid_password_rejected','real_auth_login','auth_edge_rpc_account','organizations_read','nonexistent_finance_resource_rejected','direct_rpc_rejected','invalid_jwt_rejected','logout','revoked_session_rejected'];
 try{for(const captchaEnabled of [false,true])for(const failure of [null,...expected]){
  let id,password,deleted=false,loggedOut=false,accountRemoved=false;const checks=[];
  globalThis.fetch=async(url,options)=>{
   const body=options.body?JSON.parse(options.body):null;
   const response=(check,status,data)=>({status:failure===check?500:status,text:async()=>JSON.stringify(data)});
   if(url.endsWith('/auth/v1/admin/users')){id=body.id;password=body.password;assert.equal(body.email_confirm,true);return response('synthetic_user_created',200,{id});}
   if(url.includes('/auth/v1/admin/users/')){assert(url.endsWith(id));assert(accountRemoved);deleted=true;return response('cleanup',200,{});}
   if(url.includes('/auth/v1/token?')){
    assert.equal(body.email,'cd-'+id+'@example.invalid');
    if(options.headers.apikey==='synthetic-public'){
     assert.equal(options.headers.Authorization,undefined);assert(body.password!==password);
     return response('public_invalid_login_rejected',400,{error_code:captchaEnabled?'captcha_failed':'invalid_credentials'});
    }
    assert.equal(options.headers.apikey,'synthetic-admin');assert.equal(options.headers.Authorization,'Bearer synthetic-admin');
    return body.password===password?response('real_auth_login',200,{access_token:'synthetic-jwt',user:{id}}):response('trusted_invalid_password_rejected',400,{error_code:'invalid_credentials'});
   }
   if(url.endsWith('/auth/v1/logout')){loggedOut=true;return response('logout',204,{});}
   if(url.includes('/rest/v1/rpc/'))return response('direct_rpc_rejected',403,{code:'42501'});
   if(options.headers.Authorization==='Bearer invalid-jwt')return response('invalid_jwt_rejected',401,{});
   if(url.endsWith('/account_get_v1')){
    assert.equal(options.headers.Authorization,'Bearer synthetic-jwt');assert.equal(options.headers.apikey,'synthetic-public');
    return loggedOut?response('revoked_session_rejected',401,{ok:false,error:{code:'AUTH_REQUIRED'}}):response('auth_edge_rpc_account',200,{ok:true,data:{id:'synthetic-account'}});
   }
   if(url.endsWith('/organizations_list_v1'))return response('organizations_read',200,{ok:true});
   if(url.endsWith('/finance_get_v1'))return response('nonexistent_finance_resource_rejected',200,{ok:false,error:{code:'NOT_FOUND'}});
   throw Error('Unexpected hosted request');
  };
  const api=async()=>[{type:'publishable',api_key:'synthetic-public'},{name:'service_role',api_key:'synthetic-admin'}];
  const sql=async(query)=>{assert(query.includes(id));if(query.startsWith('do $ftk_smoke_cleanup$')){assert(query.includes('delete from private.p07_profiles where account_id in (select id from core.accounts where auth_user_id='));assert(query.indexOf('delete from private.p07_profiles')<query.indexOf('delete from core.accounts'));assert.equal(query.split(id).length-1,2);accountRemoved=true;return [];}assert(deleted);return [{accounts:0,users:0}];};
  const record=(name,passed)=>{checks.push({name,passed});assert(passed,name);};
  if(failure)await assert.rejects(hostedSmoke(api,sql,record),new RegExp(failure));else await hostedSmoke(api,sql,record);
  assert(accountRemoved&&deleted);
  const executed=failure?expected.slice(0,expected.indexOf(failure)+1):expected;
  assert.deepEqual(checks.map(c=>c.name),[...executed,'synthetic_fixture_removed']);
  assert.deepEqual(checks.filter(c=>!c.passed).map(c=>c.name),failure?[failure]:[]);
 }}finally{globalThis.fetch=original;}
});

test('CD accepts only current successful main full acceptance with every executed job',()=>{
 const v=valid();v.run={...v.run,path:'.github/workflows/backend.yml',event:'push',head_branch:'main',head_sha:'a'.repeat(40),repository:{full_name:'SXQHex/FtkSaaS'},head_repository:{full_name:'SXQHex/FtkSaaS'}};
 v.jobs=v.jobs.map(j=>({...j,head_sha:v.run.head_sha}));
 v.jobs.push({name:'source',status:'completed',conclusion:'success',run_id:5,run_attempt:1,head_sha:v.run.head_sha});
 const x={run:v.run,jobs:v.jobs,currentMain:v.run.head_sha,repository:'SXQHex/FtkSaaS',attempt:1};
 assert.equal(deploymentSource(x).deploy,true);
 assert.equal(deploymentSource({...x,currentMain:'b'.repeat(40)}).deploy,false);
 for(const mutate of [z=>z.run.event='pull_request',z=>z.run.path='.github/workflows/ci-full.yml',z=>z.run.head_repository.full_name='fork/repo',z=>z.run.conclusion='failure',z=>z.run.head_branch='feature',z=>z.attempt=2,z=>z.jobs.splice(2,1),z=>z.jobs[0].conclusion='skipped',z=>z.jobs.at(-1).head_sha='other']){const z=structuredClone(x);mutate(z);assert.throws(()=>deploymentSource(z));}
 const doc={name:'documentation',status:'completed',conclusion:'success',run_id:5,run_attempt:1,head_sha:v.run.head_sha,steps:[{name:'Documentation main acceptance (no full clean)',conclusion:'success'}]};
 assert.equal(deploymentSource({...x,jobs:[v.jobs.at(-1),doc]}).deploy,false);
});

test('CD catches up accepted runtime through docs-only main in either completion order and rejects runtime supersession',async()=>{
 const repo={owner:'SXQHex',repo:'FtkSaaS'},a='a'.repeat(40),b='b'.repeat(40),v=valid();
 const run={...v.run,path:'.github/workflows/backend.yml',event:'push',head_branch:'main',head_sha:a,repository:{full_name:'SXQHex/FtkSaaS'},head_repository:{full_name:'SXQHex/FtkSaaS'}};
 const source={name:'source',status:'completed',conclusion:'success',run_id:5,run_attempt:1,head_sha:a};
 const jobs=[...v.jobs.map(j=>({...j,head_sha:a})),source];
 const docs={...run,id:6,head_sha:b},docJobs=[{...source,run_id:6,head_sha:b},{name:'documentation',status:'completed',conclusion:'success',run_id:6,run_attempt:1,head_sha:b,steps:[{name:'Documentation main acceptance (no full clean)',conclusion:'success'}]}];
 let fullFinished=false,runtimeChanged=false,liveAttempt=1,conclusion='success';
 const github={rest:{
  git:{getRef:async()=>({data:{object:{sha:b}}}),getTree:async({tree_sha})=>({data:{tree:[{path:'README.md',mode:'100644',type:'blob',sha:tree_sha+'doc'},{path:'apps/backend/database/kernel.sql',mode:'100644',type:'blob',sha:runtimeChanged&&tree_sha===b?'changed':'same'}]}}),getBlob:async()=>({data:{encoding:'base64',content:Buffer.from('Safe documentation').toString('base64')}})},
  repos:{compareCommitsWithBasehead:async()=>({data:{status:'ahead'}})},
  actions:{getWorkflowRun:async()=>({data:{...run,run_attempt:liveAttempt,conclusion}}),listJobsForWorkflowRun:'jobs',listWorkflowRuns:async()=>({data:{workflow_runs:fullFinished?[run]:[]}})}},paginate:async()=>jobs};
 assert.equal((await resolveAcceptedSource(github,repo,docs,docJobs,b)).deploy,false);
 fullFinished=true;
 const afterFull=await resolveAcceptedSource(github,repo,run,jobs,b,1);
 assert.equal(afterFull.deploy,true);assert.equal(afterFull.sha,a);assert.equal(afterFull.expected_main,b);
 const afterDocs=await resolveAcceptedSource(github,repo,docs,docJobs,b);
 assert.equal(afterDocs.deploy,true);assert.equal(afterDocs.run_id,5);assert.equal(afterDocs.documentation_run_id,6);
 assert.equal((await revalidateDeployment(github,repo,afterDocs)).sha,a);
 liveAttempt=2;await assert.rejects(revalidateDeployment(github,repo,afterDocs),/attempt changed/);
 liveAttempt=1;conclusion='failure';await assert.rejects(revalidateDeployment(github,repo,afterDocs),/acceptance failed/);
 conclusion='success';runtimeChanged=true;
 assert.equal((await resolveAcceptedSource(github,repo,run,jobs,b,1)).deploy,false);
 await assert.rejects(revalidateDeployment(github,repo,afterDocs),/equivalence/);
});

test('migration readback accepts verbatim CLI chunks and MCP file but rejects drift or hidden SQL',()=>{
 const sql="-- frozen\nbegin;\nselect 'a; b';\n/* between */ select 2;\ncommit;\n";
 assert(sameMigration(sql,[sql]));
 const chunks=["-- frozen\nbegin","select 'a; b'","/* between */ select 2","commit"];
 assert(sameMigration(sql,chunks));
 for(const changed of [["begin","select 'a;b'","select 2","commit"],["begin","select 'a; b'","commit"],["begin","select 'a; b'","select 2","drop table x","commit"],[],null])assert(!sameMigration(sql,changed));
 const local=[{version:'1',sql},{version:'2',sql:'select 3;'}];
 assert.deepEqual(migrationPlan(local,[{version:'1',statements:chunks}]),[local[1]]);
 assert.throws(()=>migrationPlan(local,[{version:'3',statements:['select 3']}]),/mismatch/);
 assert.throws(()=>migrationPlan(local,[{version:'1',statements:['select 2']}]),/mismatch/);
 assert.throws(()=>migrationPlan(local,[{version:'1',statements:[sql]},{version:'1',statements:[sql]}]),/mismatch/);
});

test('atomic migration preparation keeps source bytes and rejects missing envelopes or changed history',()=>{
 const sql="-- frozen\nbegin;\nselect 'commit; and \\n';\ncommit;\n";
 assert.equal(migrationBody(sql),"-- frozen\n      \nselect 'commit; and \\n';\n       \n");
 for(const s of ['select 1;','begin;select 1;','select 1;commit;'])assert.throws(()=>migrationBody(s),/envelope/);
 const local=[{name:'20261021190000_probe.sql',version:'20261021190000',sql}];
 assert.equal(migrationBatch(local,[{version:local[0].version,name:'probe',statements:[sql]}]),null);
 assert.throws(()=>migrationBatch(local,[{version:local[0].version,statements:['select 2']}]),/mismatch/);
 assert.throws(()=>migrationBatch([{...local[0],name:'other.sql'}],[]),/identity/);
 // Every frozen repository migration must support the atomic transport.
 for(const name of fs.readdirSync('apps/backend/supabase/migrations'))if(name.endsWith('.sql'))assert(migrationBody(fs.readFileSync('apps/backend/supabase/migrations/'+name,'utf8')).trim(),name);
 const complex="-- 😀 Türkçe\nbegin;select 'begin;commit;it''s';commit;/* nested /* commit; */ begin; */begin;do $tag$begin perform 'commit;';end$tag$;select E'escaped\\\'commit;', \"commit;\";commit;";
 const transformed=migrationBody(complex);
 for(const preserved of ["-- 😀 Türkçe","'begin;commit;it''s'","/* nested /* commit; */ begin; */",'do $tag$begin perform \'commit;\';end$tag$;',"E'escaped\\\'commit;'",'"commit;"'])assert(transformed.includes(preserved),preserved);
 for(const invalid of ['begin;begin;commit;commit;','commit;','begin;select 1;commit;select 2;','begin;select $$unterminated;commit;','begin;/* unfinished','begin;select \'unfinished'])assert.throws(()=>migrationBody(invalid));
});

test('CD source equivalence accepts frontend progress only with unchanged backend and complete trees',async()=>{
 for(const [paths,options,expected] of [
  [['apps/web/page.tsx'],{},true],
  [['apps/web/page.tsx','README.md'],{},true],
  [['apps/web/page.tsx','apps/backend/database/kernel.sql'],{},false],
  [['pnpm-lock.yaml'],{},false],
  [['apps/web/page.tsx'],{truncated:true},false],
  [['packages/unknown/a.ts'],{},false]
 ]){const {github}=scopedGithub(paths,options);assert.equal(await backendUnchanged(github,{},'B','H'),expected);}
});

test('frontend scope marker cannot authorize CD or substitute for missing executed full jobs',()=>{
 const v=valid(),sha='a'.repeat(40),run={...v.run,path:'.github/workflows/backend.yml',event:'push',head_branch:'main',head_sha:sha,repository:{full_name:'SXQHex/FtkSaaS'},head_repository:{full_name:'SXQHex/FtkSaaS'}};
 const source={name:'source',status:'completed',conclusion:'success',run_id:run.id,run_attempt:run.run_attempt,head_sha:sha};
 const marker={...source,name:'frontend',steps:[{name:'Backend unchanged (no backend acceptance)',conclusion:'success'}]};
 const input={run,jobs:[source,marker],currentMain:sha,repository:'SXQHex/FtkSaaS'};
 assert.equal(deploymentSource(input).deploy,false);
 for(const mutate of [x=>x.jobs[1].conclusion='skipped',x=>x.jobs[1].run_attempt=9,x=>x.jobs[1].head_sha='other',x=>x.jobs[1].steps[0].conclusion='skipped']){
  const x=structuredClone(input);mutate(x);assert.throws(()=>deploymentSource(x));
 }
});

test('an accepted backend finishing after a frontend-only merge keeps its full proof and revalidates before CD writes',async()=>{
 const repo={owner:'SXQHex',repo:'FtkSaaS'},a='a'.repeat(40),b='b'.repeat(40),v=valid();
 const run={...v.run,path:'.github/workflows/backend.yml',event:'push',head_branch:'main',head_sha:a,repository:{full_name:'SXQHex/FtkSaaS'},head_repository:{full_name:'SXQHex/FtkSaaS'}};
 const jobs=[...v.jobs.map(j=>({...j,head_sha:a})),{name:'source',status:'completed',conclusion:'success',run_id:run.id,run_attempt:run.run_attempt,head_sha:a}];
 let backendChanged=false;
 const {github}=scopedGithub(['apps/web/page.tsx']);
 github.rest.git.getRef=async()=>({data:{object:{sha:b}}});
 github.rest.git.getTree=async({tree_sha})=>({data:{tree:[{path:'apps/web/page.tsx',type:'blob',mode:'100644',sha:tree_sha+'web'},{path:'apps/backend/database/kernel.sql',type:'blob',mode:'100644',sha:backendChanged&&tree_sha===b?'changed':'same'}]}});
 github.rest.repos.compareCommitsWithBasehead=async()=>({data:{status:'ahead'}});
 github.rest.actions.getWorkflowRun=async()=>({data:run});github.rest.actions.listJobsForWorkflowRun='jobs';github.paginate=async()=>jobs;
 const proof=await resolveAcceptedSource(github,repo,run,jobs,b,1);assert.equal(proof.deploy,true);assert.equal(proof.sha,a);assert.equal(proof.expected_main,b);
 assert.equal((await revalidateDeployment(github,repo,proof)).sha,a);
 backendChanged=true;await assert.rejects(revalidateDeployment(github,repo,proof),/equivalence/);
});

test('previous delivery receipts require a trusted main run and executed same-attempt deploy',()=>{
 const run={id:8,run_attempt:2,path:'.github/workflows/cd-development.yml',event:'workflow_run',head_branch:'main',head_sha:'a'.repeat(40),repository:{full_name:'SXQHex/FtkSaaS'},head_repository:{full_name:'SXQHex/FtkSaaS'},status:'completed',conclusion:'success'};
 const jobs=[{name:'deploy',run_id:8,run_attempt:2,head_sha:run.head_sha,status:'completed',conclusion:'success',steps:[{name:'Deliver accepted source and verify hosted backend',conclusion:'success'}]}];
 const v={run,jobs};assert(trustedDeliveryRun(run,jobs,'SXQHex/FtkSaaS'));
 for(const mutate of [v=>v.run.event='pull_request',v=>v.run.head_repository.full_name='fork/FtkSaaS',v=>v.run.repository.full_name='fork/FtkSaaS',v=>v.run.head_branch='feature',v=>v.jobs[0].conclusion='skipped',v=>v.jobs[0].run_attempt=1,v=>v.jobs[0].head_sha='other',v=>v.jobs[0].steps[0].conclusion='skipped',v=>v.jobs.push(structuredClone(v.jobs[0]))]){const x=structuredClone(v);mutate(x);assert(!trustedDeliveryRun(x.run,x.jobs,'SXQHex/FtkSaaS'));}
});

test('proof-only main authorizes CD only after candidate jobs are independently revalidated',async()=>{
 for(const rerun of [false,true]){
 const dir=mkdtempSync(join(tmpdir(),'ci-main-proof-'));
 try{
  const f=candidateProofFixture(dir,{rerun}),sha='a'.repeat(40),repository='synthetic/test';f.pr.merge_commit_sha=sha;
  const main={...f.v.run,id:20,run_attempt:1,path:'.github/workflows/backend.yml',event:'push',head_branch:'main',head_sha:sha,repository:{full_name:repository},head_repository:{full_name:repository}};
  const mainJobs=['source','acceptance'].map(name=>({name,run_id:20,run_attempt:1,head_sha:sha,status:'completed',conclusion:'success',steps:name==='acceptance'?[{name:'Main acceptance proof',conclusion:'success'}]:[]}));
  f.github.rest.actions.getWorkflowRun=async({run_id})=>({data:run_id===20?main:f.v.run});f.github.rest.git.getRef=async()=>({data:{object:{sha}}});
  const original=f.github.paginate;let broken=false;
  f.github.paginate=async(method,args)=>{
   if(method==='jobs'&&args.run_id===20)return mainJobs;
   const rows=await original(method,args);
   return broken&&method==='jobs'?rows.map(j=>j.name==='api-3'?{...j,conclusion:'skipped'}:j):rows;
  };
  const proof=await resolveAcceptedSource(f.github,f.repo,main,mainJobs,sha,1);assert(proof.deploy);assert(proof.proofRequired);assert.equal(proof.sha,sha);
  assert.equal((await revalidateDeployment(f.github,f.repo,proof)).sha,sha);
  broken=true;await assert.rejects(revalidateDeployment(f.github,f.repo,proof),/job/);
  const cd=fs.readFileSync('.github/workflows/cd-development.yml','utf8');assert(cd.includes('pull-requests: read'));assert(!cd.includes('statuses: write'));assert(!cd.includes('contents: write'));
 }finally{rmSync(dir,{recursive:true,force:true});}
 }
});
