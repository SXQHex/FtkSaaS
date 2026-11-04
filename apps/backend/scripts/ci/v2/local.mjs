import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {backendRoot,repoFile} from '../../paths.mjs';
import {assertPilotSource,assertLocalServices} from './safety.mjs';

process.chdir(backendRoot);
const cli=path.join(backendRoot,'node_modules/.bin/supabase');
const marker='.dev/ci-v2-owner.json';
const identity={sha:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
function run(command,args,options={}){
 const result=spawnSync(command,args,{stdio:'inherit',...options});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('CI_V2_COMMAND_FAILED: '+command+' (exit '+result.status+')');
}
function preflight(){
 assertPilotSource({actions:process.env.GITHUB_ACTIONS,event:process.env.GITHUB_EVENT_NAME,
  expected:identity.sha,actual:git('rev-parse','HEAD'),dirty:!!git('status','--porcelain'),existingState:fs.existsSync('.dev')});
}
const command=process.argv[2];
if(command==='preflight')preflight();
else if(command==='prepare'){
 preflight();
 // A fresh checkout must not attach to an already running native project.
 const status=spawnSync(cli,['status','--output-format','json'],{stdio:'ignore'});
 if(status.error)throw status.error;
 if(status.status===0)throw Error('CI_V2_EXISTING_STACK');
 fs.mkdirSync('.dev',{mode:0o700});
 fs.writeFileSync(marker,JSON.stringify(identity),{mode:0o600});
 const output=repoFile('.artifacts','ci-v2');fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'source.json'),JSON.stringify({
  ...identity,tree:git('rev-parse','HEAD^{tree}'),mode:'shadow',scope:'room-pilot',full_clean:false
 },null,2)+'\n');
 run('pnpm',['run','dev:start']);
 const {stackStatus,connect}=await import('../../db.mjs');
 assertLocalServices(stackStatus().env);
 const fd=fs.openSync('.dev/ci-v2-reset.log','w',0o600);
 try{run(cli,['db','reset','--local','--no-seed','--yes'],{stdio:['ignore',fd,fd]});}
 finally{fs.closeSync(fd);}
 // start-dev checked readiness before reset; verify it again after reset.
 const ready=path.join(backendRoot,'scripts/wait-local.mjs');run('node',[ready]);
 const db=await connect();
 try{
  const expected=Object.keys(JSON.parse(fs.readFileSync('database/migrations.sha256.json'))).map(name=>name.split('_')[0]).sort();
  const actual=(await db.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(row=>row.version);
  assert.deepEqual(actual,expected);
  for(const table of ['core.organizations','core.operation_receipts','auth.users']){
   assert.equal((await db.query('select count(*)::int n from '+table)).rows[0].n,0);
  }
 }finally{await db.end();}
 console.log('CI v2 room pilot: clean loopback services ready; no merge or deployment acceptance');
}else if(command==='cleanup'){
 if(fs.existsSync(marker)){
  assert.deepEqual(JSON.parse(fs.readFileSync(marker,'utf8')),identity);
  run(cli,['stop']);
 }else console.log('CI v2 cleanup: no stack owned by this run');
}else throw Error('Expected preflight, prepare or cleanup');
