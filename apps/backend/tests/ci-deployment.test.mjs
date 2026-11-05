import test from 'node:test';
import assert from 'node:assert/strict';
import {project,unchangedEdge,unchangedResendWebhook,resendWebhookSmoke,hostedSmoke,sameMigration,migrationPlan,migrationBody,migrationBatch} from '../scripts/ci/deploy-development.mjs';
import {deploymentSource,resolveAcceptedSource,revalidateDeployment,trustedDeliveryRun,filterSupabaseDelivery,resolveDeployment,previousReceipt} from '../scripts/ci/deployment-source.mjs';
import fs,{mkdtempSync,rmSync} from 'node:fs';
import {backendUnchanged} from '../scripts/ci/source.mjs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {repositoryRoot} from '../scripts/paths.mjs';
import {valid,scopedGithub,candidateProofFixture} from './ci-fixtures.mjs';
import {webSourceChanged,vercelRequest,validateVercelRun,selectVercelSource,deliverVercel,matchesVercelTarget} from '../scripts/ci/vercel-deployment.mjs';
import {execFileSync} from 'node:child_process';

test('Vercel deployment selection deliberately requires web src, independently of test scope',()=>{
 assert(webSourceChanged(['apps/web/src/app/page.tsx']));
 assert(webSourceChanged(['apps/web/src/app/deleted.tsx','docs/settings.md']));
 for(const p of ['apps/web/public/logo.svg','apps/web/package.json','apps/web/next.config.ts','packages/ui/src/button.tsx','apps/backend/supabase/config.toml','docs/settings.md','.github/workflows/frontend.yml'])assert.equal(webSourceChanged([p]),false);
 assert.equal(webSourceChanged([]),false);
});

test('Vercel API requests pin the project and full tested commit without exposing credentials',()=>{
 const sha='a'.repeat(40),request=vercelRequest({sha,target:'preview',run:42});
 assert.equal(request.gitSource.ref,sha);assert.equal(request.gitSource.sha,sha);
 assert.equal(request.project,'prj_shLMyVjPsCo2QrejlPGJUBKguah2');
 assert.equal(request.target,undefined);assert.equal(vercelRequest({sha,target:'production',run:42}).target,'production');
 for(const source of [{sha:'main',target:'production'},{sha,target:'other'}])assert.throws(()=>vercelRequest(source));
});

test('Vercel only consumes successful same-repository current-attempt checks',()=>{
 const run={id:4,run_attempt:1,path:'.github/workflows/frontend.yml',event:'pull_request',status:'completed',conclusion:'success',repository:{full_name:'SXQHex/FtkSaaS'},head_repository:{full_name:'SXQHex/FtkSaaS'}};
 assert(validateVercelRun(run,1));
 for(const patch of [{run_attempt:2},{conclusion:'failure'},{status:'in_progress'},{path:'.github/workflows/other.yml'},{head_repository:{full_name:'other/repo'}}])assert.throws(()=>validateVercelRun({...run,...patch},1));
});

test('Vercel preview must never report production or a custom environment as success',()=>{
 for(const target of [null,undefined,'preview'])assert(matchesVercelTarget({target},'preview'));
 for(const deployment of [{target:'production'},{target:'staging'},{target:null,customEnvironmentId:'env_other'},{target:null,customEnvironment:{id:'env_other'}}])assert.equal(matchesVercelTarget(deployment,'preview'),false);
 assert(matchesVercelTarget({target:'production'},'production'));
 for(const target of [null,'preview','staging'])assert.equal(matchesVercelTarget({target},'production'),false);
});

function vercelMain(paths=['apps/web/src/app/page.tsx']){
 const sha='a'.repeat(40),base='b'.repeat(40),run={id:4,run_attempt:1,head_sha:sha,head_branch:'main',path:'.github/workflows/backend.yml',event:'push',status:'completed',conclusion:'success',repository:{full_name:'SXQHex/FtkSaaS'},head_repository:{full_name:'SXQHex/FtkSaaS'}};
 const context={repo:{owner:'SXQHex',repo:'FtkSaaS'},eventName:'workflow_run',payload:{workflow_run:run}};
 const jobs=[{name:'source',run_id:4,run_attempt:1,head_sha:sha,status:'completed',conclusion:'success',steps:[{name:'Verify merged candidate relation',conclusion:'success'}]}];
 const github={paginate:async()=>jobs,rest:{git:{getRef:async()=>({data:{object:{sha}}}),getCommit:async()=>({data:{parents:[{sha:base},{sha:'c'.repeat(40)}]}}),getTree:async({tree_sha})=>({data:{tree:paths.map(path=>({path,type:'blob',mode:'100644',sha:tree_sha}))}})},actions:{getWorkflowRun:async()=>({data:run}),listWorkflowRuns:async()=>({data:{workflow_runs:[run]}})}}};
 return {sha,base,run,context,jobs,github};
}
test('Vercel automatic main delivery skips docs and shared changes, while manual deploy uses accepted main',async()=>{
 const f=vercelMain();assert.equal((await selectVercelSource(f.github,f.context)).target,'production');
 for(const [before,after] of [[['apps/web/src/removed.tsx'],[]],[['apps/web/src/old.tsx'],['docs/renamed.md']],[['docs/old.md'],['apps/web/src/new.tsx']]]){
  const v=vercelMain();v.github.rest.git.getTree=async({tree_sha})=>({data:{tree:(tree_sha===v.base?before:after).map(path=>({path,type:'blob',mode:'100644',sha:'file'}))}});
  assert.equal((await selectVercelSource(v.github,v.context)).target,'production');
 }
 for(const paths of [[],['docs/settings.md'],['packages/api-contracts/src/generated.ts'],['apps/backend/tests/registry.test.mjs']]){
  const v=vercelMain(paths);assert.equal(await selectVercelSource(v.github,v.context),null);
  v.context={...v.context,eventName:'workflow_dispatch',ref:'refs/heads/main',sha:v.sha,payload:{inputs:{target:'preview'}}};
  assert.equal((await selectVercelSource(v.github,v.context)).target,'preview');
  v.context.ref='refs/heads/other';await assert.rejects(selectVercelSource(v.github,v.context),/current main/);
 }
 for(const mutate of [v=>v.jobs[0].conclusion='skipped',v=>v.jobs[0].steps=[],v=>v.jobs[0].run_attempt=2,v=>v.github.rest.git.getTree=async()=>({data:{truncated:true,tree:[]}})]){
  const v=vercelMain();mutate(v);await assert.rejects(selectVercelSource(v.github,v.context));
 }
 const stale=vercelMain();stale.run.run_attempt=2;stale.context.payload.workflow_run={...stale.run,run_attempt:1};await assert.rejects(selectVercelSource(stale.github,stale.context));
});

test('Vercel API executes only pinned source and confirms READY project, target and commit',async()=>{
 const f=vercelMain(),expected=await selectVercelSource(f.github,f.context),calls=[],summaries=[];
 const provider=async(url,options)=>{
  calls.push({url,options});let data;
  if(url.includes('/projects/'))data={id:'prj_shLMyVjPsCo2QrejlPGJUBKguah2',accountId:'team_YifcGAWB29vV8ew4TNrHUDG3',rootDirectory:'apps/web',link:{type:'github',repoId:1192151050}};
  else data={id:'dpl_test',projectId:'prj_shLMyVjPsCo2QrejlPGJUBKguah2',readyState:'READY',target:'production',gitSource:{sha:f.sha},url:'ftksaas-test.vercel.app'};
  return {ok:true,json:async()=>data};
 };
 const core={summary:{addRaw(s){summaries.push(s);return this;},async write(){}}};
 const result=await deliverVercel(f.github,f.context,core,expected,{token:'synthetic-test-token',fetcher:provider});
 assert.equal(result.sha,f.sha);assert.equal(result.state,'READY');assert.equal(calls.length,2);
 assert.equal(JSON.parse(calls[1].options.body).gitSource.sha,f.sha);assert(!summaries.join('').includes('synthetic-test-token'));
 let polls=0,posts=0;
 await deliverVercel(f.github,f.context,core,expected,{token:'test',pause:async()=>{},fetcher:async(url,opts)=>{
  const response=await provider(url,opts),data=await response.json();
  if(opts.method==='POST'){posts++;data.readyState='BUILDING';}else if(url.includes('/deployments/'))polls++;
  return {ok:true,json:async()=>data};
 }});assert.equal(posts,1);assert.equal(polls,1);
 await assert.rejects(deliverVercel(f.github,f.context,core,expected,{token:'test',fetcher:async()=>({ok:false,status:401})}),/HTTP 401/);
 await assert.rejects(deliverVercel(f.github,f.context,core,{...expected,sha:'d'.repeat(40)},{token:'test',fetcher:()=>{throw Error('Moved source must not reach Vercel');}}),/moved/);
 for(const patch of [{gitSource:{sha:'d'.repeat(40)}},{target:'preview'},{projectId:'other'},{readyState:'ERROR'},{url:'attacker.example'}]){
  await assert.rejects(deliverVercel(f.github,f.context,core,expected,{token:'test',fetcher:async(url,opts)=>{const response=await provider(url,opts);return {ok:true,json:async()=>({...await response.json(),...(url.includes('/deployments')?patch:{})})};}}));
 }
 f.context={...f.context,eventName:'workflow_dispatch',ref:'refs/heads/main',sha:f.sha,payload:{inputs:{target:'preview'}}};
 const preview=await selectVercelSource(f.github,f.context);
 await assert.rejects(deliverVercel(f.github,f.context,core,preview,{token:'test',fetcher:provider}),/target mismatch/);
});

test('Vercel preview consumes the exact frontend proof, not merely a successful workflow badge',async()=>{
 const f=vercelMain(),head='d'.repeat(40),merge='e'.repeat(40),tree='f'.repeat(40);
 const pr={number:7,state:'open',draft:false,base:{sha:f.base,ref:'main'},head:{sha:head,repo:{full_name:'SXQHex/FtkSaaS'}}};
 const run={...f.run,path:'.github/workflows/frontend.yml',event:'pull_request',head_sha:head};
 f.context.payload.workflow_run=run;f.github.rest.actions.getWorkflowRun=async()=>({data:run});
 f.github.rest.pulls={list:'prs',get:async()=>({data:pr})};
 f.github.rest.git.getRef=async({ref})=>({data:{object:{sha:ref==='heads/main'?f.sha:merge}}});
 f.github.rest.git.getCommit=async()=>({data:{sha:merge,tree:{sha:tree},parents:[{sha:f.base},{sha:head}]}});
 const timestamp='2026-11-05T01:00:00Z';
 const names=['scope','checks',...['chromium','firefox','webkit','mobile'].map(b=>'browsers ('+b+')')];
 const steps={scope:['Select frontend scope','Record candidate source','Upload candidate source'],checks:['Frontend checks, coverage and build','Run pnpm --filter @ftksaas/web test:isolation','Package verified build','Upload verified build']};
 const jobs=names.map(name=>({name,run_id:4,run_attempt:1,head_sha:head,status:'completed',conclusion:'success',steps:(steps[name]??['Install selected browser','Download verified build','Verify and restore build','Test selected browser']).map(name=>({name,conclusion:'success',started_at:timestamp,completed_at:timestamp}))}));
 const binding={version:1,kind:'frontend',repository:'SXQHex/FtkSaaS',pr:7,base:f.base,head,merge,tree,run:4,source_attempt:1};
 const zip=execFileSync('python3',['-c','import io,sys,zipfile;b=io.BytesIO();z=zipfile.ZipFile(b,"w");z.writestr("frontend-source.json",sys.argv[1]);z.close();sys.stdout.buffer.write(b.getvalue())',JSON.stringify(binding)]);
 f.github.rest.actions.downloadArtifact=async()=>({data:zip});
 const artifacts=[{id:1,name:'frontend-source-frontend-1',created_at:timestamp,size_in_bytes:zip.length}];
 f.github.paginate=async method=>method==='prs'?[pr]:method===f.github.rest.actions.listJobsForWorkflowRunAttempt?jobs:artifacts;
 // Distinguish the named artifact and job APIs, as policyMatches uses Git tree reads directly.
 f.github.rest.actions.listJobsForWorkflowRunAttempt='jobs';f.github.rest.actions.listWorkflowRunArtifacts='artifacts';
 assert.equal((await selectVercelSource(f.github,f.context)).sha,merge);
 jobs[2].conclusion='skipped';await assert.rejects(selectVercelSource(f.github,f.context),/JOBS/);
 jobs[2].conclusion='success';pr.head.repo.full_name='fork/repo';assert.equal(await selectVercelSource(f.github,f.context),null);
});
process.chdir(repositoryRoot);

test('unchanged Edge requires both trusted source receipt and live version/JWT match',()=>{
 const previous={success:true,project,edge_version:3,edge_source_sha256:'hash'},edge={version:3,status:'ACTIVE',verify_jwt:true};
 assert(unchangedEdge(previous,edge,'hash'));
 for(const [p,e,h] of [[null,edge,'hash'],[{...previous,success:false},edge,'hash'],[{...previous,project:'other'},edge,'hash'],[previous,{...edge,version:4},'hash'],[previous,{...edge,verify_jwt:false},'hash'],[previous,edge,'changed']])assert(!unchangedEdge(p,e,h));
});

test('Resend deployment reuse requires its own source/version receipt and dedicated non-JWT configuration',()=>{
 const previous={success:true,project,resend_webhook_version:3,resend_webhook_source_sha256:'hash'},edge={version:3,status:'ACTIVE',verify_jwt:false};
 assert(unchangedResendWebhook(previous,edge,'hash'));
 for(const [p,e,h] of [[null,edge,'hash'],[previous,undefined,'hash'],[{...previous,success:false},edge,'hash'],[{...previous,project:'other'},edge,'hash'],[previous,{...edge,version:4},'hash'],[previous,{...edge,verify_jwt:true},'hash'],[previous,{...edge,status:'FAILED'},'hash'],[previous,edge,'changed']])assert(!unchangedResendWebhook(p,e,h));
});

test('hosted webhook smoke rejects the JWT gateway failure and accepts only provider signature rejection without credentials',async()=>{
 for(const status of [403,401,200,503]){
  const checks=[];let calls=0;
  const probe=resendWebhookSmoke((name,passed)=>{checks.push({name,passed});assert(passed);},async(url,options)=>{
   calls++;assert.equal(url,'https://'+project+'.supabase.co/functions/v1/resend-webhook');
   assert.equal(options.headers.authorization,undefined);assert.equal(options.headers.apikey,undefined);
   assert.equal(options.method,'POST');return new Response('{}',{status});
  });
  if(status===403)await probe;else await assert.rejects(probe);
  assert.equal(calls,1);assert.equal(checks.length,1);assert.equal(checks[0].passed,status===403);
 }
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

test('Historical retired V2 marker never deploys or searches historical runtime proofs; malformed markers fail closed',async()=>{
 const sha='a'.repeat(40);
 const run={id:8,path:'.github/workflows/backend.yml',event:'push',head_branch:'main',repository:{full_name:'x/y'},head_repository:{full_name:'x/y'},head_sha:sha,status:'completed',conclusion:'success',run_attempt:2};
 const job=name=>({name,run_id:8,run_attempt:2,head_sha:sha,status:'completed',conclusion:'success',steps:[{name:'V2 development only (no runtime acceptance)',conclusion:'success'}]});
 const jobs=[job('source'),job('v2-development')];
 assert.equal(deploymentSource({run,jobs,currentMain:sha,repository:'x/y'}).deploy,false);
 const unexpected=new Proxy({},{get(){throw Error('Historical search forbidden');}});
 assert.equal((await resolveAcceptedSource(unexpected,{owner:'x',repo:'y'},run,jobs,sha,2)).v2,true);
 const acceptance={...job('acceptance'),steps:[{name:'Main acceptance proof',conclusion:'success'}]};
 const skipped={...job('v2-development'),conclusion:'skipped',steps:[]};
 assert.equal(deploymentSource({run,jobs:[job('source'),acceptance,skipped],currentMain:sha,repository:'x/y'}).deploy,true);
 const frontend={...job('frontend'),steps:[{name:'Backend unchanged (no backend acceptance)',conclusion:'success'}]};
 assert.equal(deploymentSource({run,jobs:[job('source'),frontend,skipped],currentMain:sha,repository:'x/y'}).frontend,true);

 for(const mutate of [x=>x.push(x[1]),x=>x[1].conclusion='failure',x=>x[1].steps=[],x=>x[1].run_attempt=1]){const bad=structuredClone(jobs);mutate(bad);assert.throws(()=>deploymentSource({run,jobs:bad,currentMain:sha,repository:'x/y'}));}
});

test('Supabase delivery compares last successful delivery with accepted main, including deletions, renames and modes',async()=>{
 const base='a'.repeat(40),head='b'.repeat(40),repo={owner:'SXQHex',repo:'FtkSaaS'};
 const proof={deploy:true,sha:head,expected_main:head},previous={source:base};
 const edge={path:'apps/backend/supabase/functions/backend-v1/index.ts',type:'blob',mode:'100644',sha:'edge'};
 const outside={path:'.github/workflows/backend.yml',type:'blob',mode:'100644',sha:'old'};
 const cases=[
  {before:[edge,outside],after:[{...outside,sha:'new'},edge],deploy:false},
  {before:[edge],after:[edge,{...outside,path:'docs/ci-policy.md'}],deploy:false},
  {before:[edge],after:[{...edge,sha:'new'}],deploy:true},
  {before:[edge],after:[],deploy:true},
  {before:[],after:[edge],deploy:true},
  {before:[edge],after:[{...edge,path:'docs/moved.ts'}],deploy:true},
  {before:[outside],after:[{...outside,path:edge.path}],deploy:true},
  {before:[edge],after:[{...edge,mode:'100755'}],deploy:true},
  {before:[edge],after:[{path:'apps/backend/supabase',type:'commit',mode:'160000',sha:'module'}],deploy:true}
 ];
 for(const c of cases){
  const github={rest:{git:{getTree:async({tree_sha})=>({data:{tree:tree_sha===base?c.before:c.after}})}}};
  assert.equal((await filterSupabaseDelivery(github,repo,proof,previous)).deploy,c.deploy);
 }
 const forbidden=new Proxy({},{get(){throw Error('Unexpected API request');}});
 assert.equal(await filterSupabaseDelivery(forbidden,repo,proof,undefined),proof);
 const skipped={deploy:false};assert.equal(await filterSupabaseDelivery(forbidden,repo,skipped,previous),skipped);
 for(const getTree of [async()=>({data:{truncated:true,tree:[]}}),async()=>({data:{}}),async()=>{throw Error('API unavailable');}]){
  await assert.rejects(filterSupabaseDelivery({rest:{git:{getTree}}},repo,proof,previous));
 }
});

test('Supabase source skips CI-only accepted main and preserves pending changes after failed delivery',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ci-supabase-filter-'));
 try{
  const sha='b'.repeat(40),prior='a'.repeat(40),v=valid(),repository='SXQHex/FtkSaaS';
  const main={...v.run,path:'.github/workflows/backend.yml',event:'push',head_branch:'main',head_sha:sha,repository:{full_name:repository},head_repository:{full_name:repository}};
  const jobs=[...v.jobs.map(j=>({...j,head_sha:sha})),{name:'source',status:'completed',conclusion:'success',run_id:main.id,run_attempt:1,head_sha:sha}];
  const delivered={...main,id:8,path:'.github/workflows/cd-development.yml',event:'workflow_run',head_sha:prior};
  const deliveryJob={name:'deploy',run_id:8,run_attempt:1,head_sha:prior,status:'completed',conclusion:'success',steps:[{name:'Deliver accepted source and verify hosted backend',conclusion:'success'}]};
  fs.writeFileSync(join(dir,'development-delivery.json'),JSON.stringify({success:true,project:'gwyprhenabtpkbojephw',source:prior}));
  execFileSync('zip',['-q',join(dir,'receipt.zip'),'development-delivery.json'],{cwd:dir});const zip=fs.readFileSync(join(dir,'receipt.zip'));
  let changed=false,expired=false,missing=false,unavailable=false;
  const failed={...delivered,id:9,conclusion:'failure'};
  const github={rest:{actions:{getWorkflowRun:async({run_id})=>({data:run_id===5?main:run_id===9?failed:delivered}),listWorkflowRuns:async(args)=>{assert.equal(args.status,'success');return {data:{workflow_runs:[failed,delivered]}};},listJobsForWorkflowRun:'jobs',listWorkflowRunArtifacts:'artifacts',downloadArtifact:async()=>({data:zip})},git:{getRef:async()=>({data:{object:{sha}}}),getTree:async({tree_sha})=>{
   if(unavailable)throw Error('Tree unavailable');
   return {data:{tree:[{path:'apps/backend/supabase/config.toml',type:'blob',mode:'100644',sha:changed&&tree_sha===sha?'new':'same'},{path:'docs/ci-policy.md',type:'blob',mode:'100644',sha:tree_sha}]}};
  }}},paginate:async(method,args)=>{
   if(method==='jobs')return args.run_id===5?jobs:[deliveryJob];
   return missing?[]:[{id:10,name:'development-delivery-8-1',expired}];
  }};
  const context={repo:{owner:'SXQHex',repo:'FtkSaaS'},runId:10,payload:{workflow_run:main}};
  const output={};const core={setOutput(k,v){output[k]=v;},summary:{addRaw(){return this;},async write(){}}};
  await resolveDeployment(github,context,core);assert.equal(output.deploy,'false');assert.equal(output.sha,undefined);
  changed=true;await resolveDeployment(github,context,core);assert.equal(output.deploy,'true');assert.equal(output.sha,sha);
  unavailable=true;await assert.rejects(resolveDeployment(github,context,core),/Tree unavailable/);unavailable=false;
  expired=true;await assert.rejects(previousReceipt(github,context),/expired/);expired=false;
  missing=true;await assert.rejects(previousReceipt(github,context),/receipt/);missing=false;
  const originalGet=github.rest.actions.getWorkflowRun,originalPaginate=github.paginate;let pages=[];
  const skipped=Array.from({length:100},(_,i)=>({...delivered,id:100+i}));
  github.rest.actions.listWorkflowRuns=async({page})=>{pages.push(page);return {data:{workflow_runs:page===1?skipped:[delivered]}};};
  github.rest.actions.getWorkflowRun=async(args)=>args.run_id>=100?{data:skipped.find(r=>r.id===args.run_id)}:originalGet(args);
  github.paginate=async(method,args)=>method==='jobs'&&args.run_id>=100?[]:originalPaginate(method,args);
  assert.equal((await previousReceipt(github,context)).source,prior);assert.deepEqual(pages,[1,2]);
  pages=[];github.rest.actions.listWorkflowRuns=async({page})=>{pages.push(page);return {data:{workflow_runs:[delivered]}};};
  assert.equal((await previousReceipt(github,context)).source,prior);assert.deepEqual(pages,[1]);
  github.rest.actions.listWorkflowRuns=async()=>({data:{workflow_runs:[]}});
  assert.equal(await previousReceipt(github,context),undefined);
  await resolveDeployment(github,context,core);assert.equal(output.deploy,'true');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
