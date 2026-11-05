import {buildInventory} from './api-suites.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {repoFile,repositoryRoot} from '../paths.mjs';
import {apiSuites} from './select-tests.mjs';
import {shardPlan} from './shards.mjs';
import {runApiPhases} from './run-targeted.mjs';
export function targetedPartitions(plan,{root=repositoryRoot}={}){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'apps/backend/scripts/ci/api-suites.json')));
 const units=buildInventory(root,{manifest}).units,roots=manifest.suites.map(s=>s.path);
 if(!Array.isArray(plan.api)||new Set(plan.api).size!==plan.api.length||plan.api.some(p=>!roots.includes(p)))throw Error('Invalid manual API selection');
 const seconds=Object.fromEntries(manifest.suites.map(s=>[s.path.split('/').at(-1).replace(/\.test\.mjs$/,''),units.filter(u=>u.source===s.path||s.imports.some(i=>i.path===u.source)).reduce((sum,u)=>sum+u.estimated_seconds,0)]));
 return shardPlan(roots,seconds).map(b=>({shard:b.shard,suites:b.suites.filter(p=>plan.api.includes(p))})).filter(b=>b.suites.length);
}
export function assertManualInventory(pkg,expected=apiSuites){
 const command=pkg?.scripts?.['test:api'];
 if(typeof command!=='string'||!/^node --test --test-concurrency=2 tests\/[a-z0-9-]+\.test\.mjs(?: tests\/[a-z0-9-]+\.test\.mjs)*$/.test(command))throw Error('Unrecognized source API test command');
 const suites=command.slice('node --test --test-concurrency=2 '.length).trim().split(/\s+/).map(p=>'apps/backend/'+p);
 if(new Set(suites).size!==suites.length||JSON.stringify([...suites].sort())!==JSON.stringify([...expected].sort()))throw Error('Source API inventory differs from trusted policy; test source inventory is inconsistent');
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
 const sourceManifest=JSON.parse(fs.readFileSync(sourceFile('apps/backend/scripts/ci/api-suites.json')));
 assertManualInventory(JSON.parse(fs.readFileSync(sourceFile('apps/backend/package.json'))),sourceManifest.suites.map(s=>s.path));
 const run=(cmd,args)=>{const r=spawnSync(cmd,args,{cwd:sourceFile('apps/backend'),stdio:'inherit',env:{...process.env,FTK_TEST_TIMINGS:'1'}});if(r.error||r.status!==0)throw Error('Manual targeted failed');};
 if(mode==='plan'){
  execFileSync(process.execPath,[repoFile('apps/backend/scripts/ci/select-tests.mjs'),base,head],{stdio:'inherit',env:{...process.env,FTK_EXPLICIT_RANGE:'1'}});
  const plan=JSON.parse(fs.readFileSync(sourceCi('selection.json'))),bins=targetedPartitions(plan,{root:sourceRoot});
  const matrix={include:bins.length?bins.map(({shard})=>({shard})):[{shard:0}]};
  fs.appendFileSync(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify(matrix)}\nsetup=${plan.structural||plan.db}\n`);
 }else{
  const plan=JSON.parse(fs.readFileSync(sourceCi('selection.json')));
  if(mode==='core'){
   run('node',['scripts/ci/docs-check.mjs']);
   if(plan.structural)run('pnpm',['--dir',sourceRoot,'exec','turbo','run','verify','--filter=@ftksaas/backend...']);
   if(plan.db){run('pnpm',['run','dev:start']);try{run('node',['scripts/ci/reset-local.mjs']);run('pnpm',['run','test:db']);}finally{run('node',['scripts/ci/cleanup.mjs']);}}
  }else if(mode==='api'){
   const bin=targetedPartitions(plan,{root:sourceRoot}).find(b=>b.shard===Number(shard));
   if(!bin){if(Number(shard)!==0)throw Error('Unknown manual shard');}
   else{run('pnpm',['run','dev:start']);try{run('node',['scripts/ci/reset-local.mjs']);
    const units=buildInventory(sourceRoot,{manifest:sourceManifest}).units;
    const exclusive=sourceManifest.suites.filter(s=>units.some(u=>u.exclusive&&(u.source===s.path||s.imports.some(i=>i.path===u.source)))).map(s=>s.path);
    runApiPhases({...plan,api:bin.suites,exclusive},run,sourceFile);}finally{run('node',['scripts/ci/cleanup.mjs']);}}
  }else throw Error('Unknown manual mode');
 }
 console.log('Manual targeted diagnostic only; not a PR/full/main acceptance receipt.');
}
