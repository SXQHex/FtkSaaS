// Candidate test files are data. Only trusted main code parses and validates them.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {repositoryRoot} from '../paths.mjs';
import {buildInventory} from './api-suites.mjs';
export const inventoryPath='apps/backend/scripts/ci/api-suites.json';
export const packagePath='apps/backend/package.json';
const testPath=p=>typeof p==='string'&&/^apps\/backend\/tests\/[a-z0-9-]+(?:\.test)?\.mjs$/.test(p);
const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const contains=(a,b)=>a.every(x=>b.includes(x));
function owned(manifest){
 if(manifest.version!==1||!Array.isArray(manifest.suites)||manifest.suites.length>1000||!Array.isArray(manifest.exclusive))throw Error('Invalid test inventory');
 const paths=[],members=[];
 for(const suite of manifest.suites){
  if(!testPath(suite.path)||!Array.isArray(suite.parts)||!Array.isArray(suite.imports))throw Error('Invalid test inventory path');
  paths.push(suite.path);members.push(...suite.parts.map(p=>[p.id,suite.path]));
  for(const item of suite.imports){
   if(!testPath(item.path))throw Error('Invalid imported test path');
   paths.push(item.path);members.push(...(item.parts?item.parts.map(p=>[p.id,item.path]):[[item.path.split('/').at(-1).replace(/\.mjs$/,''),item.path]]));
  }
 }
 if(paths.length>5000||new Set(paths).size!==paths.length)throw Error('Duplicate test ownership');
 const units=new Map(members);
 if(units.size!==members.length)throw Error('Duplicate test unit');
 if(manifest.exclusive.some(id=>!units.has(id)))throw Error('Unknown exclusive test unit');
 return {paths,units};
}
function inventoryExtension(base,head){
 const prior=owned(base),next=owned(head);
 const policy=m=>{const {suites,measurements,note,exclusive,...rest}=m;return rest;};
 return contains(prior.paths,next.paths)&&contains(base.exclusive,head.exclusive)&&base.exclusive.every(id=>prior.units.get(id)===next.units.get(id))&&canonical(policy(base))===canonical(policy(head));
}
function apiCommand(pkg){
 const command=pkg.scripts?.['test:api'];
 if(typeof command!=='string'||!/^node --test --test-concurrency=2 tests\/[a-z0-9-]+\.test\.mjs(?: tests\/[a-z0-9-]+\.test\.mjs)*$/.test(command))throw Error('Invalid API test command');
 const paths=command.slice('node --test --test-concurrency=2 '.length).split(' ');
 if(new Set(paths).size!==paths.length)throw Error('Duplicate API test command path');
 return paths;
}
function packageExtension(base,head){
 const strip=p=>({...p,scripts:{...p.scripts,'test:api':null}});
 return contains(apiCommand(base),apiCommand(head))&&canonical(strip(base))===canonical(strip(head));
}
function gitBlob(sha){
 try{return execFileSync('git',['cat-file','blob',sha],{cwd:repositoryRoot,maxBuffer:4*1024*1024,timeout:2000,stdio:['ignore','pipe','ignore']});}
 catch{return null;} // Missing local objects are read through the immutable Git API.
}
function reader(github,repo,tree,{localBlob=gitBlob}={}){
 const entries=new Map(tree.map(e=>[e.path,e])),cache=new Map();let bytes=0;
 return async p=>{
  const entry=entries.get(p);
  if(!entry||entry.type!=='blob'||entry.mode!=='100644')throw Error('Missing or non-regular candidate test data: '+p);
  if(!/^[a-f0-9]{40}$/.test(entry.sha))throw Error('Invalid candidate blob SHA');
  if(!cache.has(entry.sha))cache.set(entry.sha,(async()=>{
   let raw=localBlob(entry.sha);
   if(!raw){
    const {data}=await github.rest.git.getBlob({...repo,file_sha:entry.sha});
    if(data.encoding!=='base64'||typeof data.content!=='string'||data.content.length>6*1024*1024)throw Error('Invalid candidate blob');
    raw=Buffer.from(data.content,'base64');
   }
   bytes+=raw.length;
   if(raw.length>4*1024*1024||bytes>32*1024*1024)throw Error('Candidate test data too large');
   const sha=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+raw.length+'\0'),raw])).digest('hex');
   if(sha!==entry.sha)throw Error('Candidate blob hash mismatch');
   return new TextDecoder('utf-8',{fatal:true}).decode(raw);
  })());
  return cache.get(entry.sha);
 };
}
export async function testDataPolicyMatches(github,repo,trees){
 for(const [p,allowed] of [[inventoryPath,inventoryExtension],[packagePath,packageExtension]]){
  const entries=trees.map(tree=>tree.find(e=>e.path===p));
  if(entries.every(e=>!e))continue;
  if(entries.some(e=>!e||e.type!=='blob'||e.mode!=='100644'))return false;
  if(entries[0].sha===entries[1].sha)continue;
  const values=await Promise.all(trees.map(async tree=>JSON.parse(await reader(github,repo,tree)(p))));
  if(!allowed(...values))return false;
 }
 return true;
}
export async function loadCandidateInventory(github,repo,tree_sha,options){
 const {data}=await github.rest.git.getTree({...repo,tree_sha,recursive:'1'});
 if(data.truncated||!Array.isArray(data.tree))throw Error('Incomplete candidate test tree');
 const readRemote=reader(github,repo,data.tree,options);
 const manifest=JSON.parse(await readRemote(inventoryPath));
 const paths=[packagePath,...owned(manifest).paths],files=new Map();
 // Bound concurrent API requests; nothing from the candidate is imported or run.
 for(let i=0;i<paths.length;i+=8)await Promise.all(paths.slice(i,i+8).map(async p=>files.set(p,await readRemote(p))));
 const inventory=buildInventory('',{manifest,read:p=>{if(!files.has(p))throw Error('Undeclared candidate test source');return files.get(p);}});
 return {manifest,inventory};
}
