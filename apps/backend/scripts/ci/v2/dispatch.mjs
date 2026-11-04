import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {repositoryRoot} from '../../paths.mjs';
import {createPlan} from './plan.mjs';

export function createDispatchPlan(options){
 const plan=createPlan(options),cwd=options.cwd??repositoryRoot;
 const raw=execFileSync('git',['diff','--raw','-z','--no-renames','--no-abbrev',plan.source.base,plan.source.head,'--'],{cwd,encoding:'utf8'}).split('\0');
 if(raw.pop()!==''||raw.length%2)throw Error('CI_V2_INVALID_RAW_DIFF');
 for(let i=0;i<raw.length;i+=2){
  const metadata=/^:(\d{6}) (\d{6}) [a-f0-9]{40} [a-f0-9]{40} [ADMT]$/.exec(raw[i]);
  if(!metadata||metadata.slice(1).some(mode=>!['000000','100644','100755'].includes(mode)))throw Error('CI_V2_UNSAFE_SOURCE_MODE');
 }
 return {...plan,kind:'shadow-dispatch',backend_execution:plan.impact.backend?'selected-core-and-twenty-api':'not-selected',frontend_execution:plan.impact.frontend?'selected':'not-selected'};
}
export function assertShadowResults(impact,results){
 if(!impact||!['baseline','frontend','backend'].every(key=>typeof impact[key]==='boolean')||!Array.isArray(impact.backend_matrix)||impact.backend_matrix.length!==(impact.backend?20:0)||!impact.backend_matrix.every((entry,index)=>entry?.shard===index+1)||(impact.frontend||impact.backend)&&!impact.baseline)throw Error('CI_V2_INVALID_DISPATCH');
 for(const [job,selected] of [['common',impact.baseline],['frontend',impact.frontend],['backend',impact.backend]]){
  if(results[job]!== (selected?'success':'skipped'))throw Error('CI_V2_INCOMPLETE_SHADOW: '+job);
 }
 return true;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 if(process.argv[2]==='plan'){
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_EVENT_NAME!=='workflow_dispatch')throw Error('CI_V2_MANUAL_RUN_REQUIRED');
  const plan=createDispatchPlan({base:process.env.CI_V2_BASE_SHA,head:process.env.GITHUB_SHA,mode:process.env.CI_V2_MODE??'auto'});
  const out=path.join(repositoryRoot,'.artifacts/ci-v2-dispatch');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2)+'\n');
  for(const name of ['baseline','common','frontend','backend'])fs.appendFileSync(process.env.GITHUB_OUTPUT,name+'='+String(plan.impact[name])+'\n');
  const summary='V2 shadow only; no production or deploy acceptance.\n'+JSON.stringify(plan,null,2)+'\n';
  console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 }else if(process.argv[2]==='summary'){
  const boolean=name=>{const value=process.env[name];if(!['true','false'].includes(value))throw Error('CI_V2_INVALID_DISPATCH_OUTPUT');return value==='true';};
  const impact={baseline:boolean('V2_BASELINE'),frontend:boolean('V2_FRONTEND'),backend:boolean('V2_BACKEND')};impact.backend_matrix=impact.backend?Array.from({length:20},(_,index)=>({shard:index+1})):[];
  assertShadowResults(impact,{common:process.env.COMMON_RESULT,frontend:process.env.FRONTEND_RESULT,backend:process.env.BACKEND_RESULT});
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Selected V2 domains succeeded; unselected domains skipped. Shadow execution only: no merge/CD acceptance or deployment.\n');
 }else throw Error('Expected plan or summary');
}
