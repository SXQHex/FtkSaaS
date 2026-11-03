import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const definition=JSON.parse(fs.readFileSync(new URL('./suites.json',import.meta.url)));
const hash=s=>createHash('sha256').update(s).digest('hex');
const sideImports=s=>[...s.matchAll(/^import ['"](.+?)['"];$/gm)].map(m=>m[1]);

export function buildInventory(root,{manifest=definition,read=p=>fs.readFileSync(path.join(root,p),'utf8')}={}){
 const pkg=JSON.parse(read('apps/backend/package.json'));
 const command=pkg.scripts['test:api'],prefix='node --test --test-concurrency=2 ';
 if(!command.startsWith(prefix))throw Error('Unrecognized original API command');
 const original=command.slice(prefix.length).split(/\s+/).map(p=>'apps/backend/'+p).sort();
 const declared=manifest.suites.map(s=>s.path).sort();
 if(JSON.stringify(original)!==JSON.stringify(declared))throw Error('Original suite inventory changed');
 const units=[],owned=new Set(),dedicated=manifest.dedicatedRunners??[];let splitOriginals=0;
 if(!Array.isArray(dedicated)||new Set(dedicated).size!==dedicated.length)throw Error('Invalid dedicated runner inventory');
 const checked=(p,expected)=>{const text=read(p);if(hash(text)!==expected)throw Error('Experiment source changed: '+p);return text;};
 for(const suite of manifest.suites){
  const source=checked(suite.path,suite.sha256),lines=source.match(/[^\n]*\n|[^\n]+$/g),coverage=Array(lines.length).fill(0);
  const take=ranges=>ranges.map(([start,end])=>{
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start||end>lines.length)throw Error('Invalid range coverage');
   for(let i=start-1;i<end;i++)coverage[i]++;
   return lines.slice(start-1,end).join('');
  }).join('');
  take(suite.shared);
  const shared=new Set(suite.shared.flatMap(([a,b])=>Array.from({length:b-a+1},(_,i)=>a+i)));
  const parts=suite.parts.map(part=>{
   take(part.ranges);
   const selected=new Set(part.ranges.flatMap(([a,b])=>Array.from({length:b-a+1},(_,i)=>a+i)));
   return {id:part.id,source:suite.path,code:lines.filter((_,i)=>shared.has(i+1)||selected.has(i+1)).join('')};
  });
  const imports=suite.imports.map(item=>{
   if(!/^apps\/backend\/tests\/[a-z0-9-]+\.mjs$/.test(item.path)||owned.has(item.path))throw Error('Duplicate/invalid imported acceptance');
   owned.add(item.path);
   const target='./'+path.basename(item.path);
   if(lines[item.line-1]?.trim()!==`import '${target}';`)throw Error('Imported acceptance line changed');
   coverage[item.line-1]++;
   const code=checked(item.path,item.sha256);
   if(sideImports(code).length)throw Error('Nested side-effect imports require explicit ownership');
   return {id:path.basename(item.path,'.mjs'),source:item.path,code};
  });
  if(coverage.some(n=>n!==1))throw Error('Incomplete/duplicate source line coverage: '+suite.path);
  if(sideImports(source).length!==imports.length)throw Error('Unowned side-effect import');
  const members=[...parts,...imports];
  // Proportional source size is an explicitly unmeasured scheduling seed.
  // The collector reports real file timings; it never labels estimates as results.
  const size=members.reduce((n,u)=>n+u.code.length,0);
  for(const member of members){
   const exclusive=manifest.exclusive.includes(member.id);
   if(/p07_lifecycle_config|ops_worker_health|invitation_dispatch_config|alter role/i.test(member.code)&&!exclusive)throw Error('Global fixture must run exclusively: '+member.id);
   units.push({...member,exclusive,dedicated:dedicated.includes(member.id),estimated_seconds:suite.estimated_seconds*member.code.length/size});
  }
  if(members.length>1)splitOriginals++;
 }
 if(new Set(units.map(u=>u.id)).size!==units.length)throw Error('Duplicate experimental unit');
 if(dedicated.some(id=>!units.some(u=>u.id===id)))throw Error('Unknown dedicated runner unit');
 return {root,version:manifest.version,originals:manifest.suites.length,splitOriginals,units};
}

export function partition(units){
 if(new Set(units.map(u=>u.id)).size!==units.length)throw Error('Duplicate experimental unit');
 const bins=Array.from({length:8},(_,i)=>({shard:i+1,estimated_seconds:0,units:[]}));
 for(const unit of units)if(!Number.isFinite(unit.estimated_seconds)||unit.estimated_seconds<=0)throw Error('Invalid experiment weight');
 const dedicated=units.filter(u=>u.dedicated).sort((a,b)=>a.id.localeCompare(b.id));
 if(dedicated.length>=bins.length)throw Error('Too many dedicated experiment runners');
 for(const [i,unit] of dedicated.entries()){
  bins[i].units.push(unit);bins[i].estimated_seconds=unit.estimated_seconds;
 }
 const shared=bins.slice(dedicated.length);
 for(const unit of units.filter(u=>!u.dedicated).sort((a,b)=>b.estimated_seconds-a.estimated_seconds||a.id.localeCompare(b.id))){
  const bin=[...shared].sort((a,b)=>a.estimated_seconds-b.estimated_seconds||a.shard-b.shard)[0];
  bin.units.push(unit);bin.estimated_seconds+=unit.estimated_seconds;
 }
 if(bins.some(b=>!b.units.length))throw Error('Empty experiment shard');
 return bins;
}

export function executionPhases(units){
 const exclusive=units.filter(u=>u.exclusive).map(u=>({concurrency:1,units:[u]}));
 const parallel=units.filter(u=>!u.exclusive);
 return [...exclusive,...(parallel.length?[{concurrency:2,units:parallel}]:[])];
}

export function materialize(inventory,directory){
 fs.mkdirSync(directory,{recursive:true});
 return inventory.units.map(unit=>{
  const original=pathToFileURL(path.resolve(inventory.root??process.cwd(),unit.source)).href;
  // Native ESM hooks retain the ORIGINAL module URL. Relative static/dynamic
  // imports and import.meta.url therefore resolve exactly as in the baseline.
  // Only this one module is replaced; helpers and runtime use original sources.
  const wrapper=`import {registerHooks} from 'node:module';\nconst target=${JSON.stringify(original)};\nconst source=${JSON.stringify(unit.code)};\nregisterHooks({load(url,context,next){const result=next(url,context);return url===target?{...result,source}:result;}});\nawait import(target);\n`;
  const file=path.join(directory,unit.id+'.test.mjs');fs.writeFileSync(file,wrapper);return file;
 });
}
