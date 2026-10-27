import fs from 'node:fs';import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export function runApiPhases(plan,run){
 const priority=plan.api.filter(p=>plan.priority?.includes(p)),regressions=plan.api.filter(p=>!priority.includes(p));
 if(priority.length){console.log('Priority API acceptance:',priority.join(', '));run('node',['--test','--test-concurrency=2',...priority]);}
 if(regressions.length){console.log('Selected API regressions:',regressions.join(', '));run('node',['--test','--test-concurrency=2',...regressions]);}
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const plan=JSON.parse(fs.readFileSync('.ci/selection.json'));
 const run=(cmd,args)=>{const r=spawnSync(cmd,args,{stdio:'inherit',env:{...process.env,FTK_TEST_TIMINGS:'1'}});if(r.error||r.status!==0)throw Error('TARGETED_FAILED '+cmd);};
 run('node',['--test','tests/ci-policy.test.mjs']);run('node',['scripts/ci/docs-check.mjs']);
 if(plan.structural)run('pnpm',['run','verify']);
 if(plan.db){run('pnpm',['run','dev:start']);try{
  run('node',['scripts/ci/reset-local.mjs']);run('pnpm',['run','test:db']);runApiPhases(plan,run);
 }finally{run('node',['scripts/ci/cleanup.mjs']);}}
}
