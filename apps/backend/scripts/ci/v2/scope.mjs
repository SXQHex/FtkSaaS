import webTasks from '../../../../web/turbo.json' with {type:'json'};

import {backendShardCount} from './settings.mjs';
export {backendShardCount} from './settings.mjs';
const webServerInputs=webTasks.tasks.build.inputs.filter(input=>input.startsWith('$TURBO_ROOT$/apps/backend/')).map(input=>{
 if(/[?*{}]/.test(input))throw Error('CI_V2_UNSUPPORTED_WEB_INPUT');
 return input.slice('$TURBO_ROOT$/'.length);
});

export function parseNameStatus(raw){
 const fields=raw.split('\0');
 if(fields.pop()!=='')throw Error('CI_V2_INCOMPLETE_DIFF');
 const paths=[];
 while(fields.length){
  const status=fields.shift();
  if(!/^(?:[ADMT]|[RC][0-9]{1,3})$/.test(status))throw Error('CI_V2_INVALID_DIFF');
  const count=/^[RC]/.test(status)?2:1;
  for(let i=0;i<count;i++){
   const file=fields.shift();if(!file)throw Error('CI_V2_INCOMPLETE_DIFF');paths.push(file);
  }
 }
 return paths;
}

export function selectImpact(paths,mode='auto'){
 if(!Array.isArray(paths)||!paths.length||!['auto','backend','full'].includes(mode))throw Error('CI_V2_INVALID_PLAN');
 const plan={common:false,frontend:false,backend:false,compatibility:'none',deploy:{vercel:false,supabase:false},unknown:[]};
 const frontend=deploy=>{plan.frontend=true;plan.deploy.vercel||=deploy;};
 const backend=deploy=>{plan.backend=true;plan.deploy.supabase||=deploy;};
 const shared=deploy=>{plan.common=true;frontend(deploy);backend(deploy);};
 for(const file of paths){
  if(typeof file!=='string'||!file||file.startsWith('/')||/[\x00-\x1f\\]/.test(file)||file.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('CI_V2_INVALID_PATH');
  if(file.startsWith('apps/web1/'))continue;
  if(/(^|\/)AGENTS\.md$/.test(file)||file==='CONSTRAINTS.md'||['docs/workflows.json','docs/documentation.json'].includes(file)){
   plan.common=true;continue;
  }
  if(file.startsWith('.github/')||file.startsWith('apps/backend/scripts/ci/')){
   plan.common=true;
   if(file.startsWith('apps/backend/scripts/ci/'))backend(false);
   else if(file==='.github/workflows/frontend.yml'||file==='.github/workflows/frontend-compatibility.yml'||file==='.github/workflows/ci-v2-frontend.yml')frontend(false);
   else if(['.github/workflows/ci-full.yml','.github/workflows/clean-suite.yml','.github/workflows/ci-fast.yml','.github/workflows/backend-experiment.yml','.github/workflows/ci-v2-backend.yml'].includes(file))backend(false);
   else if(file.startsWith('.github/workflows/')&&!['.github/workflows/ci-v2-pilot.yml','.github/workflows/backend.yml','.github/workflows/ci-gate.yml','.github/workflows/cd-development.yml'].includes(file))shared(false);
   continue;
  }
  if(file==='README.md'||(/^docs\/.+\.md$/.test(file))||/^apps\/(web|backend)\/(docs\/.+|README)\.md$/.test(file)||/^packages\/[^/]+\/(docs\/.+|README)\.md$/.test(file)){
   plan.common=true;continue;
  }
  if(file.startsWith('packages/api-contracts/')){
   plan.common=true;backend(true);plan.compatibility='frontend-delivery';continue;
  }
  if(['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json','.nvmrc','.gitignore'].includes(file)||file.startsWith('packages/typescript-config/')){
   shared(true);continue;
  }
  if(file.startsWith('apps/web/')||file.startsWith('packages/ui/')){
   const testConfig=/(^|\/)(?:vitest|playwright|eslint|oxlint)\.config\.[^/]+$|\/\.oxlintrc\.json$/.test(file);
   frontend(!testConfig&&!/(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[^/]+$/.test(file)&&!file.startsWith('apps/web/scripts/ci-')&&file!=='apps/web/scripts/verify-isolation.mjs');
   continue;
  }
  if(file.startsWith('apps/backend/')){
   backend(/^apps\/backend\/(database|supabase|api|config)\//.test(file)||file==='apps/backend/package.json');
   // Reuse the real Next.js build inputs, including the bridge's imports.
   if(webServerInputs.includes(file)||file==='apps/backend/package.json')frontend(true);
   continue;
  }
  plan.unknown.push(file);shared(true);
 }
 if(mode==='backend'||mode==='full')plan.backend=true;
 if(mode==='full'){plan.frontend=true;plan.common=true;}
 return {...plan,baseline:mode!=='auto'||paths.some(file=>!file.startsWith('apps/web1/')),
  backend_matrix:plan.backend?Array.from({length:backendShardCount},(_,i)=>({shard:i+1})):[]};
}
