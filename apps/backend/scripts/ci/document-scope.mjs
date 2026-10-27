import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseChanges} from './select-tests.mjs';

const documents = new Set(JSON.parse(fs.readFileSync(new URL('./document-paths.json', import.meta.url))));
const renderer = 'apps/backend/scripts/render_catalogs.py';
export function rendererOnlyProse(base,head) {
 try { return JSON.parse(execFileSync('python3',[fileURLToPath(new URL('./renderer-proof.py',import.meta.url))],{input:JSON.stringify({base,head}),encoding:'utf8',stdio:['pipe','pipe','pipe']})).safe; }
 catch { return false; }
}
export function documentScope(changes,read,mode) {
 if(!changes.length)return {safe:false,reason:'Empty/unknown cumulative diff'};
 for(const c of changes){
  if(!/^[AMDR][0-9]*$/.test(c.status))return {safe:false,reason:'Unknown diff status'};
  // Exact reviewed paths, not an extension/prefix or a user-controlled label.
  if(!documents.has(c.path)&&c.path!==renderer)return {safe:false,reason:'Unreviewed or executable input: '+c.path};
  for(const side of ['base','head']){
   const content=read(side,c.path);
   if(content!==null&&(mode(side,c.path)!=='100644'||content.includes('\0')))return {safe:false,reason:'Non-regular/text document: '+c.path};
  }
  if(c.path===renderer&&(c.status!=='M'||!rendererOnlyProse(read('base',renderer),read('head',renderer))))return {safe:false,reason:'Renderer executable/unknown delta'};
 }
 return {safe:true,reason:'Reviewed documentation paths and narrowly proven renderer prose only'};
}
export function gitDocumentScope(base,head,cwd=process.cwd()) {
 const root=execFileSync('git',['rev-parse','--show-toplevel'],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:24*1024*1024,stdio:['ignore','pipe','pipe']});
 const cache=new Map();
 const read=(side,p)=>{const key=side+':'+p;if(!cache.has(key)){try{cache.set(key,git('show',(side==='base'?base:head)+':'+p));}catch{cache.set(key,null);}}return cache.get(key);};
 const mode=(side,p)=>git('ls-tree',side==='base'?base:head,'--',p).split(' ')[0];
 return documentScope(parseChanges(git('diff','--name-status','-z','--find-renames',base,head)),read,mode);
}
