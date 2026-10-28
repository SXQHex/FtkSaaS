import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {parseChanges} from './select-tests.mjs';
import {documentScope} from './document-scope.mjs';
export const ownership=JSON.parse(fs.readFileSync(new URL('./scope.json',import.meta.url)));
const documents=new Set(JSON.parse(fs.readFileSync(new URL('./document-paths.json',import.meta.url))));
export function ownerOf(p){
 if(typeof p!=='string'||!p||p.includes('\\')||p.startsWith('/')||p.split('/').some(s=>!s||s==='.'||s==='..'))throw Error('INVALID_SOURCE_PATH '+p);
 // Reviewed prose wins over its containing application directory.
 if(documents.has(p))return 'documentation';
 for(const owner of ['backend','frontend'])if(ownership[owner+'Files'].includes(p)||ownership[owner+'Prefixes'].some(prefix=>p.startsWith(prefix)))return owner;
 // Generated JSON inventories remain backend inputs, never documentation.
 if(/^docs\/[a-z0-9-]+\.json$/.test(p))return 'backend';
 throw Error('UNCLASSIFIED_SOURCE '+p);
}
export function classifyChanges(changes){
 if(!Array.isArray(changes)||!changes.length)throw Error('EMPTY_SOURCE_DIFF');
 const scope={backend:false,frontend:false,documentation:false,paths:[]};
 for(const c of changes){
  if(!/^[ACDMRT][0-9]*$/.test(c.status))throw Error('INVALID_SOURCE_STATUS');
  const owner=ownerOf(c.path);scope[owner]=true;scope.paths.push({path:c.path,owner});
 }
 scope.kind=scope.backend?'full':scope.documentation?'documentation':'frontend';
 return scope;
}
export function localScope(base,head,cwd=process.cwd()){
 cwd=execFileSync('git',['rev-parse','--show-toplevel'],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const git=(...a)=>execFileSync('git',a,{cwd,encoding:'utf8',maxBuffer:24*1024*1024,stdio:['ignore','pipe','pipe']});
 const changes=parseChanges(git('diff','--name-status','-z','--find-renames',base,head)),scope=classifyChanges(changes);
 const docs=changes.filter(c=>ownerOf(c.path)==='documentation');
 if(docs.length){
  const read=(side,p)=>{try{return git('show',(side==='base'?base:head)+':'+p);}catch{return null;}};
  const mode=(side,p)=>git('ls-tree',side==='base'?base:head,'--',p).split(' ')[0];
  if(!documentScope(docs,read,mode).safe)throw Error('UNSAFE_DOCUMENT_SCOPE');
 }
 return scope;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const head=process.env.HEAD??process.argv[2];
 if(!/^[a-f0-9]{40}$/.test(head??''))throw Error('EXACT_HEAD_REQUIRED');
 const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
 if(git('rev-parse','HEAD')!==head)throw Error('CHECKOUT_HEAD_MISMATCH');
 const base=git('merge-base','origin/main',head),scope=localScope(base,head);
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`backend=${scope.backend}\ndocumentation=${scope.documentation}\nkind=${scope.kind}\n`);
 const summary='Source scope (cumulative branch delta; no test acceptance): '+JSON.stringify(scope)+'\n';
 console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
}
