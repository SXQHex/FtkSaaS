import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const apiSuites = [
 'api-acceptance','event-payment','event-cancellation','registry','person-registry',
 'room-role-registry','availability-policies','schedule-reads','program-session-lifecycle',
 'starter-attendance-protection','instructor-earnings','cross-center-settlement'
].map(n=>'tests/'+n+'.test.mjs');
// Economic consumers and reservation readers are explicit dependencies, not filename guesses.
export const modules = [
 {id:'settlement', sources:['cross-center-settlement'], suites:['cross-center-settlement','instructor-earnings','starter-attendance-protection']},
 {id:'earnings', sources:['instructor-earnings'], suites:['instructor-earnings','cross-center-settlement','program-session-lifecycle','starter-attendance-protection']},
 {id:'attendance', sources:['starter-attendance-protection','starter-attendance-privacy-legacy'], suites:['starter-attendance-protection','instructor-earnings','cross-center-settlement']},
 {id:'program', sources:['program-session-lifecycle'], suites:['program-session-lifecycle','schedule-reads','starter-attendance-protection','instructor-earnings','cross-center-settlement']},
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
export function select(changes,{diffAvailable=true,headMatches=true}={}) {
 const reasons=[],chosen=new Set();let structural=false,broad=false;const docs=[];
 const all=why=>{broad=true;structural=true;reasons.push(why);};
 if(!diffAvailable||!headMatches)all('Missing diff/base or changed head: all DB/API regressions');
 if(!Array.isArray(changes)||!changes.length)all('Empty/unknown change set: all DB/API regressions');
 for(const {path:p,status} of changes??[]){
  if(typeof p!=='string'||!p||p.startsWith('/')||p.split('/').includes('..')){all('Invalid/missing path');continue;}
  if(p.endsWith('.md')||p.endsWith('.txt')){docs.push(p);if(p.startsWith('contracts/')||p.startsWith('docs/decisions/')||p==='docs/feature-delivery.md')structural=true;reasons.push(p+': documentation/link checks'+(structural?' and contract consistency when applicable':''));continue;}
  if(p==='AGENTS.md')continue;
  if(p.startsWith('contracts/')||p.startsWith('packages/')||p.startsWith('supabase/')||p.startsWith('.github/')||['package.json','package-lock.json','tsconfig.json'].includes(p)){
   all(p+': shared schema/gateway/migration/build or CI dependency');continue;
  }
  if(/^tests\/(contract|governance|ci-policy)\.test\.mjs$/.test(p)||p==='tests/types.test.ts'){structural=true;reasons.push(p+': structural checks');continue;}
  if(apiSuites.includes(p)){structural=true;chosen.add(p);chosen.add(apiSuites[0]);reasons.push(p+': explicit API suite + shared authorization/rights regressions');continue;}
  const m=modules.find(m=>m.sources.some(n=>p==='database/'+n+'.sql'||p==='database/'+n+'-wrappers.sql'));
  if(m){structural=true;chosen.add(apiSuites[0]);for(const n of m.suites)chosen.add('tests/'+n+'.test.mjs');reasons.push(p+': '+m.id+' dependency graph + shared authorization/rights regressions');continue;}
  if(p.startsWith('docs/')&&p.endsWith('.json')){structural=true;reasons.push(p+': generated inventory consistency');continue;}
  all(p+': unknown/shared dependency ('+status+'), fail closed to all DB/API suites');
 }
 if(broad)for(const p of apiSuites)chosen.add(p);
 return {structural,db:chosen.size>0,api:apiSuites.filter(p=>chosen.has(p)),docs:[...new Set(docs)],broad,reasons};
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const base=process.argv[2],head=process.argv[3];let changes=[],available=true,matches=false;
 try {matches=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===head;
  // Cumulative branch delta survives cancellation of an earlier commit's targeted run.
  const from=execFileSync('git',['merge-base','origin/main',head],{encoding:'utf8'}).trim();
  if(!/^[a-f0-9]{40}$/.test(from??'')||!head)throw Error('NO_BASE');
  changes=parseChanges(execFileSync('git',['diff','--name-status','-z','--find-renames',from,head],{encoding:'utf8'}));
 }catch{available=false;}
 const plan=select(changes,{diffAvailable:available,headMatches:matches});fs.mkdirSync('.ci',{recursive:true});fs.writeFileSync('.ci/selection.json',JSON.stringify(plan,null,2)+'\n');
 const summary='## Targeted selection\n\n'+plan.reasons.map(x=>'- '+x).join('\n')+'\n\nDB reset: '+plan.db+'\n\nSelected API suites:\n'+(plan.api.map(x=>'- '+x).join('\n')||'- none')+'\n';
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);console.log(summary);
}
