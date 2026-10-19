import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const plan=JSON.parse(fs.readFileSync('.ci/selection.json'));const run=(cmd,args)=>{const r=spawnSync(cmd,args,{stdio:'inherit',env:{...process.env,FTK_TEST_TIMINGS:'1'}});if(r.error||r.status!==0)throw Error('TARGETED_FAILED '+cmd);};
run('node',['--test','tests/ci-policy.test.mjs']);run('node',['scripts/ci/docs-check.mjs']);
if(plan.structural)run('npm',['run','verify']);
if(plan.db){run('npm',['run','dev:start']);try{run('node',['scripts/ci/reset-local.mjs']);run('npm',['run','test:db']);run('node',['--test','--test-concurrency=2',...plan.api]);}finally{run('npm',['run','dev:stop']);}}
