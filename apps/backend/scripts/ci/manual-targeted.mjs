import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {repoFile} from '../paths.mjs';
import {apiSuites} from './select-tests.mjs';
import {shardPlan} from './shards.mjs';
import {runApiPhases} from './run-targeted.mjs';
export function targetedPartitions(plan){
 if(!Array.isArray(plan.api)||new Set(plan.api).size!==plan.api.length||plan.api.some(p=>!apiSuites.includes(p)))throw Error('Invalid manual API selection');
 return shardPlan().map(b=>({shard:b.shard,suites:b.suites.filter(p=>plan.api.includes(p))})).filter(b=>b.suites.length);
}
export function assertManualInventory(pkg){
 const command=pkg?.scripts?.['test:api'];
 if(typeof command!=='string'||!command.startsWith('node --test --test-concurrency=2 '))throw Error('Unrecognized source API test command');
 const suites=command.slice('node --test --test-concurrency=2 '.length).trim().split(/\s+/).map(p=>'apps/backend/'+p);
 if(new Set(suites).size!==suites.length||JSON.stringify([...suites].sort())!==JSON.stringify([...apiSuites].sort()))throw Error('Source API inventory differs from trusted policy; install reviewed inventory before manual diagnosis');
}
export function assertManualRange(base,head,git){
 if(![base,head].every(s=>/^[a-f0-9]{40}$/.test(s)))throw Error('Exact base/head SHA required');
 if(git('rev-parse','HEAD').trim()!==head)throw Error('Manual checkout mismatch');
 git('merge-base','--is-ancestor',base,head);
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const sourceRoot=process.env.FTK_MANUAL_SOURCE_ROOT??repoFile();
 const sourceFile=(...p)=>path.join(sourceRoot,...p);
 const sourceCi=(...p)=>sourceFile('.artifacts','ci',...p);
 process.chdir(sourceRoot);
 const [mode,base,head,shard]=process.argv.slice(2);
 const git=(...a)=>execFileSync('git',a,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 assertManualRange(base,head,git);
 assertManualInventory(JSON.parse(fs.readFileSync(sourceFile('apps/backend/package.json'))));
 const run=(cmd,args)=>{const r=spawnSync(cmd,args,{cwd:sourceFile('apps/backend'),stdio:'inherit',env:{...process.env,FTK_TEST_TIMINGS:'1'}});if(r.error||r.status!==0)throw Error('Manual targeted failed');};
 if(mode==='plan'){
  execFileSync(process.execPath,[repoFile('apps/backend/scripts/ci/select-tests.mjs'),base,head],{stdio:'inherit',env:{...process.env,FTK_EXPLICIT_RANGE:'1'}});
  const plan=JSON.parse(fs.readFileSync(sourceCi('selection.json'))),bins=targetedPartitions(plan);
  const matrix={include:bins.length?bins.map(({shard})=>({shard})):[{shard:0}]};
  fs.appendFileSync(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify(matrix)}\nsetup=${plan.structural||plan.db}\n`);
 }else{
  const plan=JSON.parse(fs.readFileSync(sourceCi('selection.json')));
  if(mode==='core'){
   run('node',['scripts/ci/docs-check.mjs']);
   if(plan.structural)run('pnpm',['--dir',sourceRoot,'exec','turbo','run','verify','--filter=@ftksaas/backend...']);
   if(plan.db){run('pnpm',['run','dev:start']);try{run('node',['scripts/ci/reset-local.mjs']);run('pnpm',['run','test:db']);}finally{run('node',['scripts/ci/cleanup.mjs']);}}
  }else if(mode==='api'){
   const bin=targetedPartitions(plan).find(b=>b.shard===Number(shard));
   if(!bin){if(Number(shard)!==0)throw Error('Unknown manual shard');}
   else{run('pnpm',['run','dev:start']);try{run('node',['scripts/ci/reset-local.mjs']);runApiPhases({...plan,api:bin.suites},run,sourceFile);}finally{run('node',['scripts/ci/cleanup.mjs']);}}
  }else throw Error('Unknown manual mode');
 }
 console.log('Manual targeted diagnostic only; not a PR/full/main acceptance receipt.');
}
