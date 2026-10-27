import {isDeepStrictEqual as same} from 'node:util';

const contractPath='contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json';
const generatedPaths=new Set([
 'packages/api-contracts/src/generated.ts','packages/api-contracts/src/operations.ts',
 'packages/api-contracts/src/index.ts','packages/api-contracts/src/runtime.ts',
 'supabase/functions/backend-v1/contract.json','supabase/functions/backend-v1/index.ts',
 'supabase/functions/backend-v1/validators.js','database/runtime-wrappers-current.sql'
]);
const omit=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const names=(a,b)=>[...new Set([...Object.keys(a),...Object.keys(b)])];
const parse=s=>{if(s==null)throw Error('Missing source');return JSON.parse(s);};

function references(op,defs){
 const found=new Set();
 const visit=v=>{
  if(!v||typeof v!=='object')return;
  if(typeof v.$ref==='string'){
   if(!v.$ref.startsWith('#/$defs/'))throw Error('External reference');
   const n=v.$ref.slice(8);if(!defs[n])throw Error('Missing definition '+n);
   if(!found.has(n)){found.add(n);visit(defs[n]);}
  }
  for(const child of Object.values(v))visit(child);
 };
 visit(op);return found;
}

// Shared management is never owned wholesale by a module. Only additive P01
// request projection/selector changes may use its focused regression profile.
function managementRequestDelta(base,head,oldOp,newOp,changed,profile){
 if(!profile?.managementRequestProjection||!oldOp||!newOp)return false;
 const ops=profile.operations;
 const allowed=new Set(['Request_management_state_get','ManagementStateView','LessonRequestView','LessonRequestAlternativeView','WaitlistEntryView','SeatOfferView',...ops.map(n=>'ManagementSelector_'+n),...ops.map(n=>'Request_'+n.replace(/_v1$/,''))]);
 if(changed.some(n=>!allowed.has(n)))return false;
 const normalizeOp=o=>({...omit(o,['runtime_limits']),runtime_selectors:o.runtime_selectors?.filter(n=>!ops.includes(n)),features:o.features?.filter(n=>n!=='F09'&&!(ops.includes('waitlist_join_v1')&&n==='F12')),conditional_features:o.conditional_features?.filter(x=>!(((x.feature==='F09'&&x.when==='lesson_request_selector')||(ops.includes('waitlist_join_v1')&&x.feature==='F12'&&x.when==='waitlist_selector'))&&x.mode==='required_if_selected'))});
 if(!same(normalizeOp(oldOp),normalizeOp(newOp)))return false;
 // Existing management fields and non-request selector clauses must be equal.
 const view=d=>({...d,properties:omit(d.properties,ops.includes('waitlist_join_v1')?['request_detail','waitlist_detail']:['request_detail'])});
 if(!same(view(base.$defs.ManagementStateView),view(head.$defs.ManagementStateView)))return false;
 const projection=head.$defs.ManagementStateView.properties.request_detail;
 if(projection&&!same(projection,{$ref:'#/$defs/LessonRequestView'}))return false;
 if(ops.includes('waitlist_join_v1')&&head.$defs.ManagementStateView.properties.waitlist_detail&&!same(head.$defs.ManagementStateView.properties.waitlist_detail,{$ref:'#/$defs/WaitlistEntryView'}))return false;
 const request=d=>({...d,allOf:d.allOf.filter(x=>!ops.includes(x.if?.properties?.operation?.const))});
 if(!same(request(base.$defs.Request_management_state_get),request(head.$defs.Request_management_state_get)))return false;
 // Request-specific arms may evolve; no unrelated referenced definitions may.
 return true;
}

// Evidence is derived from BOTH git snapshots. A filename alone never narrows
// contracts, bundles, package scripts, manifests or appended migrations.
export function analyzeDelta(changes,read,profiles){
 const explained={},notes=[],priority=new Set(),selected=new Set();
 const usable=c=>/^[AM]$/.test(c.status)&&read('head',c.path)!=null;
 const moduleForOperation=n=>profiles.find(p=>p.operations?.includes(n));
 const touched=new Map();
 for(const c of changes){
  const p=profiles.find(p=>p.sources.some(n=>c.path==='database/'+n+'.sql'||c.path==='database/'+n+'-wrappers.sql'));
  if(p&&usable(c))touched.set(p.id,p);
  if(c.path.startsWith('tests/')&&c.path.endsWith('.test.mjs')&&usable(c))priority.add(c.path);
 }
 const explain=(path,why,owners)=>{
  const suites=[...new Set(owners.flatMap(p=>p.suites))];
  explained[path]={why,suites};for(const s of suites)selected.add(s);
 };
 let contractSafe=false,affected=[];
 try{
  const base=parse(read('base',contractPath)),head=parse(read('head',contractPath));
  if(!same(omit(base,['$defs','x-contract']),omit(head,['$defs','x-contract'])))throw Error('Root contract changed');
  const a=base['x-contract'],b=head['x-contract'];
  if(!same(omit(a,['operations','uuid_field_map','feature_delivery']),omit(b,['operations','uuid_field_map','feature_delivery'])))throw Error('Shared contract metadata changed');
  const oldOps=Object.fromEntries(a.operations.map(o=>[o.name,o])),newOps=Object.fromEntries(b.operations.map(o=>[o.name,o]));
  if(Object.keys(oldOps).length!==a.operations.length||Object.keys(newOps).length!==b.operations.length)throw Error('Duplicate operation');
  const changedDefs=new Set(names(base.$defs,head.$defs).filter(n=>!same(base.$defs[n],head.$defs[n])));
  if([...changedDefs].some(n=>n.startsWith('Table_')))throw Error('Persistent table contract changed');
  for(const snapshot of [base,head])for(const [name,definition] of Object.entries(snapshot.$defs)){
   if(name.startsWith('Table_')&&[...references(definition,snapshot.$defs)].some(n=>changedDefs.has(n)))throw Error('Persistent table dependency changed');
  }
  const covered=new Set();
  for(const n of names(oldOps,newOps)){
   const refs=new Set([
    ...(oldOps[n]?references(oldOps[n],base.$defs):[]),
    ...(newOps[n]?references(newOps[n],head.$defs):[])
   ]);
   const changed=[...changedDefs].filter(d=>refs.has(d));for(const d of changed)covered.add(d);
   if(!same(oldOps[n],newOps[n])||changed.length){
    const owner=moduleForOperation(n)??(n==='management_state_get_v1'?profiles.find(p=>managementRequestDelta(base,head,oldOps[n],newOps[n],changed,p)):null);if(!owner)throw Error('Unmapped operation/definition consumer '+n);
    affected.push(n);touched.set(owner.id,owner);
   }
  }
  if([...changedDefs].some(n=>!covered.has(n)))throw Error('Unmapped definition');
  contractSafe=true;
  if(touched.size&&changes.some(c=>c.path===contractPath&&usable(c)))explain(contractPath,'operation and transitive definition consumers mapped: '+affected.join(', '),[...touched.values()]);
 }catch(e){notes.push('Contract analysis did not establish a narrow scope: '+e.message);}

 // Validate appended migration content, not just its suffix. Old migrations
 // remain unexplainable here and therefore retain the broad fallback.
 const migrations=new Map();
 for(const c of changes.filter(c=>c.path.startsWith('supabase/migrations/'))){
  if(!usable(c)||c.status!=='A'||read('base',c.path)!=null)continue;
  for(const p of profiles)for(const source of p.sources){
   const suffix='_'+source.replaceAll('-','_')+'.sql';
   const sql=read('head','database/'+source+'.sql'),wrappers=read('head','database/'+source+'-wrappers.sql');
   if(c.path.endsWith(suffix)&&sql!=null&&wrappers!=null&&read('head',c.path)===sql+wrappers){
    migrations.set(c.path.split('/').at(-1),p);touched.set(p.id,p);
    explain(c.path,'new migration exactly matches mapped source + wrappers',[p]);
   }
  }
 }
 if(migrations.size&&changes.some(c=>c.path==='database/migrations.sha256.json'&&usable(c))){
  try{
   const a=parse(read('base','database/migrations.sha256.json')),b=parse(read('head','database/migrations.sha256.json'));
   if(!Object.keys(a).every(n=>a[n]===b[n]))throw Error('Historical migration digest changed');
   const added=Object.keys(b).filter(n=>!(n in a));
   if(!added.length||!added.every(n=>migrations.has(n)))throw Error('Unmapped migration digest');
   // The existing mandatory check-migrations.py also verifies all actual hashes.
   explain('database/migrations.sha256.json','append-only manifest for content-matched migrations',[...new Set(added.map(n=>migrations.get(n)))]);
  }catch(e){notes.push(e.message);}
 }
 if(migrations.size&&changes.some(c=>c.path==='scripts/check-migrations.py'&&usable(c))){
  const old=read('base','scripts/check-migrations.py'),head=read('head','scripts/check-migrations.py');
  const tails=[...migrations].map(([file,p])=>{
   if(!p.migrationCheckLabel)return null;
   const source=p.sources.find(s=>file.endsWith('_'+s.replaceAll('-','_')+'.sql'));
   return "\nassert next(Path('supabase/migrations').glob('*_"+source.replaceAll('-','_')+".sql')).read_text()==Path('database/"+source+".sql').read_text()+Path('database/"+source+"-wrappers.sql').read_text(),'"+(p.migrationCheckLabels?.[source]??p.migrationCheckLabel)+"'\n";
  });
  if(old!=null&&tails.every(t=>t!=null)&&head===old+tails.join(''))explain('scripts/check-migrations.py','only append exact mapped migration/source check',[...new Set(migrations.values())]);
 }
 const owners=[...touched.values()];
 if(contractSafe&&owners.length){
  for(const c of changes.filter(usable))if(generatedPaths.has(c.path))explain(c.path,'derived artifact; mandatory generation/TypeScript/contract verification before runtime tests',owners);
  const impl='supabase/functions/backend-v1/implemented.json';
  if(changes.some(c=>c.path===impl&&usable(c))){
   try{
    const a=parse(read('base',impl)),b=parse(read('head',impl));
    if(!same(omit(a,['operations']),omit(b,['operations'])))throw Error('Implementation metadata changed');
    if(!a.operations.every(n=>b.operations.includes(n)))throw Error('Runtime registration removed');
    const changed=[...new Set([...a.operations,...b.operations])].filter(n=>a.operations.includes(n)!==b.operations.includes(n));
    if(!changed.length||!changed.every(n=>moduleForOperation(n)))throw Error('Unmapped runtime registration');
    explain(impl,'runtime registration delta matches mapped operation consumers',owners);
   }catch(e){notes.push(e.message);}
  }
  if(changes.some(c=>c.path==='package.json'&&usable(c))){
   try{
    const a=parse(read('base','package.json')),b=parse(read('head','package.json'));
    if(!same(omit(a,['scripts']),omit(b,['scripts']))||!same(omit(a.scripts,['test:api']),omit(b.scripts,['test:api'])))throw Error('Shared package/scripts changed');
    const list=s=>{const prefix='node --test --test-concurrency=2 ';if(!s.startsWith(prefix))throw Error('API runner flags changed');const paths=s.slice(prefix.length).split(' ');if(!paths.every(p=>/^tests\/[\w-]+\.test\.mjs$/.test(p))||new Set(paths).size!==paths.length)throw Error('Invalid API suite inventory');return paths;};
    const old=list(a.scripts['test:api']),head=list(b.scripts['test:api']);
    if(!old.every(p=>head.includes(p))||!head.filter(p=>!old.includes(p)).every(p=>owners.some(o=>o.suites.includes(p))))throw Error('Unmapped API suite change');
    explain('package.json','only additive mapped API test inventory; dependencies/other commands unchanged',owners);
   }catch(e){notes.push(e.message);}
  }
 }
 for(const p of touched.values())for(const s of p.suites)priority.add(s);
 return {explained,notes,priority:[...priority],selected:[...selected]};
}
