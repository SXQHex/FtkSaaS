import {ownerOf} from './scope.mjs';
import {ciFile} from '../paths.mjs';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {analyzeDelta} from './delta-analysis.mjs';
import {documentScope} from './document-scope.mjs';
export const apiSuites = [
 'api-acceptance','event-payment','event-cancellation','registry','person-registry',
 'room-role-registry','availability-policies','schedule-reads','program-session-lifecycle',
 'starter-attendance-protection','instructor-earnings','cross-center-settlement','p01-catalog-entitlement-reads','p01-lesson-requests','p01-waitlist-workers'
].map(n=>'apps/backend/tests/'+n+'.test.mjs');
// Economic consumers and reservation readers are explicit dependencies, not filename guesses.
export const modules = [
 {id:'p01-requests', sources:['p01-lesson-requests','p01-waitlist-workers','p01-worker-transport','p01-final-scope-guards'], runtimeSources:['apps/backend/scripts/p01-worker.mjs'], operations:['lesson_request_create_v1','lesson_request_withdraw_v1','lesson_request_reject_v1','lesson_request_offer_alternative_v1','lesson_request_accept_alternative_v1','lesson_request_approve_v1','waitlist_join_v1','waitlist_leave_v1','seat_offer_accept_v1','seat_offer_reject_v1','seat_offer_issue_v1','seat_offer_expire_v1','request_expire_v1'], managementRequestProjection:true, migrationCheckLabel:'P01 requests source drift', migrationCheckLabels:{'p01-waitlist-workers':'P01 waitlist source drift','p01-worker-transport':'P01 worker transport source drift','p01-final-scope-guards':'P01 final scope guards source drift'}, suites:['p01-lesson-requests','p01-catalog-entitlement-reads','p01-waitlist-workers']},
 {id:'p01-reads', sources:['p01-catalog-entitlement-reads'], operations:['products_list_v1','entitlements_get_v1'], migrationCheckLabel:'P01 reads source drift', suites:['p01-catalog-entitlement-reads']},
 {id:'settlement', sources:['cross-center-settlement'], suites:['cross-center-settlement','instructor-earnings','starter-attendance-protection']},
 {id:'earnings', sources:['instructor-earnings'], suites:['instructor-earnings','cross-center-settlement','program-session-lifecycle','starter-attendance-protection']},
 {id:'attendance', sources:['starter-attendance-protection','starter-attendance-privacy-legacy'], suites:['starter-attendance-protection','instructor-earnings','cross-center-settlement','p01-catalog-entitlement-reads']},
 {id:'program', sources:['program-session-lifecycle'], suites:['program-session-lifecycle','schedule-reads','starter-attendance-protection','instructor-earnings','cross-center-settlement','p01-catalog-entitlement-reads']},
 {id:'policy', sources:['availability-policies'], suites:['availability-policies','program-session-lifecycle','starter-attendance-protection','schedule-reads']},
 {id:'schedule', sources:['schedule-reads','runtime-read-projection'], suites:['schedule-reads','program-session-lifecycle','starter-attendance-protection']},
 {id:'people', sources:['person-registry','person-scope-guard'], suites:['person-registry','registry','schedule-reads','instructor-earnings']},
 {id:'registry', sources:['registry-operations','registry-read-versions','active-discipline-projection','discipline-read-scope','deactivate-expired-offers'], suites:['registry','person-registry','room-role-registry','schedule-reads','program-session-lifecycle']},
 {id:'rooms', sources:['room-and-role-registry','role-read-center-access','role-list-snapshot'], suites:['room-role-registry','schedule-reads','program-session-lifecycle']},
 {id:'events', sources:['event-payment-functions','event-payment-dispatch','event-payment-schema','event-cancellation-dispatch','planned-start-cancellation','planned-start-decision-clock','event-actual-start'], suites:['event-payment','event-cancellation','cross-center-settlement']}
];
export function parseChanges(z) {
 const fields=z.split('\0'); if(fields.at(-1)==='')fields.pop();const out=[];
 for(let i=0;i<fields.length;){const status=fields[i++];if(!/^[ACDMRTUXB][0-9]*$/.test(status))throw Error('INVALID_DIFF_STATUS');
  const oldPath=fields[i++];if(!oldPath)throw Error('MISSING_DIFF_PATH');out.push({status,path:oldPath});
  if(/^[RC]/.test(status)){const path=fields[i++];if(!path)throw Error('MISSING_RENAME_PATH');out.push({status,path});}
 }return out;
}
// Finite reviewed CI harness surface. A mixed runtime delta still takes the
// normal dependency graph; an unknown CI-looking path still expands safely.
export const ciSources=new Set([
 'docs/history/manifest.json','apps/backend/scripts/ci/scope.mjs','apps/backend/scripts/ci/scope.json',
 '.github/workflows/cd-development.yml','apps/backend/scripts/ci/deployment-source.mjs','apps/backend/scripts/ci/deploy-development.mjs',
 '.github/workflows/backend.yml','.github/workflows/ci-fast.yml','.github/workflows/ci-full.yml','.github/workflows/ci-gate.yml','.github/workflows/clean-suite.yml',
 'apps/backend/scripts/ci/select-tests.mjs','apps/backend/scripts/ci/delta-analysis.mjs','apps/backend/scripts/ci/run-targeted.mjs','apps/backend/scripts/ci/manual-targeted.mjs','apps/backend/scripts/ci/gate.mjs','apps/backend/scripts/ci/source.mjs','apps/backend/scripts/ci/document-scope.mjs','apps/backend/scripts/ci/document-paths.json','apps/backend/scripts/ci/renderer-proof.py','apps/backend/scripts/ci/cleanup.mjs','apps/backend/scripts/ci/shards.mjs','apps/backend/scripts/ci/suite-durations.json','apps/backend/scripts/ci/collect.mjs','apps/backend/scripts/ci/timings.mjs','apps/backend/scripts/ci/summarize-timings.mjs','apps/backend/scripts/ci/reset-local.mjs','apps/backend/scripts/ci/docs-check.mjs',
 'apps/backend/scripts/test-clean.mjs','apps/backend/scripts/start-dev.mjs','apps/backend/scripts/paths.mjs','apps/backend/tests/ci-policy.test.mjs','apps/backend/tests/ci-selection.test.mjs','apps/backend/tests/ci-documentation.test.mjs','apps/backend/tests/ci-deployment.test.mjs','apps/backend/tests/ci-shards.test.mjs','apps/backend/tests/ci-fixtures.mjs'
]);
export function select(changes,{diffAvailable=true,headMatches=true,evidence,ciOnly=false}={}) {
 const reasons=[],chosen=new Set();let structural=false,broad=false;const docs=[];
 if(ciOnly&&diffAvailable&&headMatches&&changes.length)return {structural:true,db:false,api:[],priority:[],docs:changes.filter(c=>c.path.endsWith('.md')).map(c=>c.path),broad:false,reasons:['Cumulative source proof: only finite reviewed CI harness and documentation; policy/structural negatives, full runtime acceptance at explicit final candidate'],analysis_notes:[]};
 const all=why=>{broad=true;structural=true;reasons.push(why);};
 if(!diffAvailable||!headMatches)all('Missing diff/base or changed head: all DB/API regressions');
 if(!Array.isArray(changes)||!changes.length)all('Empty/unknown change set: all DB/API regressions');
 for(const {path:p,status} of changes??[]){
  if(typeof p!=='string'||!p||p.startsWith('/')||p.split('/').includes('..')){all('Invalid/missing path');continue;}
  if(diffAvailable&&headMatches){try{if(ownerOf(p)==='frontend'){reasons.push(p+': frontend-owned; no backend tests');continue;}}catch{/* Existing conservative selector handles unknown backend inputs. */}}
  if(p.endsWith('.md')||p.endsWith('.txt')){docs.push(p);if(p.startsWith('docs/contracts/')||p.startsWith('docs/decisions/')||p==='docs/feature-delivery.md')structural=true;reasons.push(p+': documentation/link checks'+(structural?' and contract consistency when applicable':''));continue;}
  if(p==='AGENTS.md')continue;
  const proof=diffAvailable&&headMatches&&evidence?.explained[p];
  if(proof){
   structural=true;
   if(!proof.suites.every(p=>apiSuites.includes(p))){all(p+': mapped suite is missing from inventory');continue;}
   chosen.add('apps/backend/tests/api-acceptance.test.mjs');for(const suite of proof.suites)chosen.add(suite);
   reasons.push(p+': '+proof.why);continue;
  }
  if(['apps/backend/scripts/ci/select-tests.mjs','apps/backend/scripts/ci/delta-analysis.mjs','apps/backend/scripts/ci/run-targeted.mjs','apps/backend/scripts/ci/manual-targeted.mjs','apps/backend/scripts/render_catalogs.py'].includes(p)){
   structural=true;reasons.push(p+': selector/runner or documentation renderer checks; no product runtime source');continue;
  }
  if(p==='reports/p01-a-targeted-diagnosis.json'){structural=true;reasons.push(p+': diagnostic evidence; structural checks, no runtime input');continue;}
  if(p.startsWith('docs/contracts/')||p.startsWith('packages/')||p.startsWith('apps/backend/supabase/')||p.startsWith('.github/')||['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json','tsconfig.json'].includes(p)){
   all(p+': shared schema/gateway/migration/build or CI dependency');continue;
  }
  if(/^apps\/backend\/tests\/(contract|governance|ci-policy|ci-selection|ci-documentation|ci-deployment|ci-shards|ci-observer|quality-guard)\.test\.mjs$/.test(p)||p==='apps/backend/tests/types.test.ts'){structural=true;reasons.push(p+': structural checks');continue;}
  if(apiSuites.includes(p)){structural=true;chosen.add(p);chosen.add(apiSuites[0]);reasons.push(p+': explicit API suite + shared authorization/rights regressions');continue;}
  const m=modules.find(m=>(m.sources.some(n=>p==='apps/backend/database/'+n+'.sql'||p==='apps/backend/database/'+n+'-wrappers.sql')||m.runtimeSources?.includes(p)));
  if(m){structural=true;chosen.add(apiSuites[0]);for(const n of m.suites)chosen.add('apps/backend/tests/'+n+'.test.mjs');reasons.push(p+': '+m.id+' dependency graph + shared authorization/rights regressions');continue;}
  if(p.startsWith('docs/')&&p.endsWith('.json')){structural=true;reasons.push(p+': generated inventory consistency');continue;}
  all(p+': unknown/shared dependency ('+status+'), fail closed to all DB/API suites');
 }
 if(broad)for(const p of apiSuites)chosen.add(p);
 const api=apiSuites.filter(p=>chosen.has(p));
 const priority=api.filter(p=>evidence?.priority.includes(p)||changes.some(c=>c.path===p&&/^[AM]$/.test(c.status)));
 return {structural,db:chosen.size>0,api,priority,docs:[...new Set(docs)],broad,reasons,analysis_notes:evidence?.notes??[]};
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 process.chdir(execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim());
 const base=process.argv[2],head=process.argv[3];let changes=[],available=true,matches=false,from;
 try {matches=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===head;
  // Cumulative branch delta survives cancellation of an earlier commit's targeted run.
  from=process.env.FTK_EXPLICIT_RANGE==='1'?base:execFileSync('git',['merge-base','origin/main',head],{encoding:'utf8'}).trim();
  if(process.env.FTK_EXPLICIT_RANGE==='1')execFileSync('git',['merge-base','--is-ancestor',from,head],{stdio:'pipe'});
  if(!/^[a-f0-9]{40}$/.test(from??'')||!head)throw Error('NO_BASE');
  changes=parseChanges(execFileSync('git',['diff','--name-status','-z','--find-renames',from,head],{encoding:'utf8'}));
 }catch{available=false;}
 let evidence,ciOnly=false;
 if(available&&matches){
  const cache=new Map();
  const read=(side,path)=>{const key=side+':'+path;if(!cache.has(key)){try{cache.set(key,execFileSync('git',['show',(side==='base'?from:head)+':'+path],{encoding:'utf8',maxBuffer:20*1024*1024,stdio:['ignore','pipe','pipe']}));}catch{cache.set(key,null);}}return cache.get(key);};
  const remainder=changes.filter(c=>{try{if(ownerOf(c.path)==='frontend')return false;}catch{}return !ciSources.has(c.path);});
  const mode=(side,path)=>{try{return execFileSync('git',['ls-tree',side==='base'?from:head,'--',path],{encoding:'utf8'}).split(' ')[0];}catch{return null;}};
  ciOnly=changes.some(c=>ciSources.has(c.path))&&(!remainder.length||documentScope(remainder,read,mode).safe);
  evidence=analyzeDelta(changes,read,modules.map(p=>({...p,suites:p.suites.map(n=>'apps/backend/tests/'+n+'.test.mjs')})));
 }
 const output=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim()+'/.artifacts/ci';
 const plan=select(changes,{diffAvailable:available,headMatches:matches,evidence,ciOnly});fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/selection.json',JSON.stringify(plan,null,2)+'\n');
 const summary='## Targeted selection\n\n'+plan.reasons.map(x=>'- '+x).join('\n')+'\n\nDB reset: '+plan.db+'\n\nSelected API suites:\n'+(plan.api.map(x=>'- '+x).join('\n')||'- none')+'\n';
 const details='\nPriority API suites (failure stops remaining regressions):\n'+(plan.priority.map(p=>'- '+p).join('\n')||'- none')+'\n'+plan.analysis_notes.map(n=>'- '+n).join('\n')+'\n';
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+details);console.log(summary+details);
}
