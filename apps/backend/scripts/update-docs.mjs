import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {repositoryRoot,repoFile} from './paths.mjs';
import {registryPath,livingMarkdown,validateDocumentRegistry,renderDocumentMap} from './document-registry.mjs';

export const workflowPath='docs/workflows.json';
export const generatedPaths=['docs/database.md','docs/security.md','docs/functions.md','docs/documentation-map.md'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const cell=s=>String(s??'—').replaceAll('|','∣').replaceAll('\n',' ');
const link=(from,to)=>path.relative(path.dirname(from),to).replaceAll(path.sep,'/');
export function regular(root,p){
 if(typeof p!=='string'||!p||p.includes('\\')||p.startsWith('/')||p.split('/').some(s=>!s||s==='.'||s==='..'))throw Error('INVALID_DOC_SOURCE');
 const absolute=path.join(root,p);
 // No symlink traversal into env, external paths or local private state.
 let current=root;for(const part of p.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('SYMLINK_DOC_SOURCE '+p);}
 if(!fs.statSync(absolute).isFile())throw Error('MISSING_DOC_SOURCE '+p);
 return fs.readFileSync(absolute,'utf8');
}
export function workflowFingerprint(flow,operations,root){
 return sha(JSON.stringify({operations:flow.operations.map(n=>operations.get(n)),sources:[...flow.sources,...flow.tests].filter(p=>!p.endsWith('.md')).map(p=>[p,sha(regular(root,p))])}));
}
export function validateWorkflows(manifest,contract,root,{allowStale=false}={}){
 if(manifest.format!==1||!Array.isArray(manifest.flows)||!manifest.flows.length)throw Error('INVALID_WORKFLOW_MANIFEST');
 const operations=new Map(contract['x-contract'].operations.map(o=>[o.name,o])),seen=new Set(),ids=new Set();
 for(const flow of manifest.flows){
  if(!/^WF\d{2}$/.test(flow.id)||ids.has(flow.id)||!['starter','common','upper-plan','restricted','backend-only'].includes(flow.audience))throw Error('INVALID_WORKFLOW '+flow.id);ids.add(flow.id);
  if(flow.guide!==`docs/workflows.md#${flow.id.toLowerCase()}`)throw Error('INVALID_WORKFLOW_GUIDE');
  const content=regular(root,flow.guide.split('#')[0]);
  if(!content.split('\n').includes('## '+flow.id))throw Error('MISSING_WORKFLOW_SECTION '+flow.id);
  for(const name of content.match(/\b[a-z][a-z0-9_]*_v1\b/g)??[])if(!operations.has(name))throw Error('UNKNOWN_WORKFLOW_API '+name);
  if(!Array.isArray(flow.tests)||!flow.tests.length||!Array.isArray(flow.sources)||!flow.sources.length||!Array.isArray(flow.operations))throw Error('MISSING_WORKFLOW_EVIDENCE '+flow.id);
  for(const p of flow.tests){if(!/^apps\/backend\/tests\/.+\.(?:mjs|sql)$/.test(p))throw Error('INVALID_WORKFLOW_TEST');regular(root,p);}
  for(const p of flow.sources){if(!/^(apps\/backend\/(database|supabase|scripts|docs|api|transports|config|tests)\/|docs\/|packages\/api-contracts\/)/.test(p)||/\.env|\.dev\//.test(p))throw Error('UNSAFE_WORKFLOW_SOURCE '+p);regular(root,p);}
  regular(root,flow.detail);
  for(const n of flow.operations){
   if(!operations.has(n)||seen.has(n))throw Error('UNKNOWN_OR_DUPLICATE_WORKFLOW_API '+n);seen.add(n);
   const op=operations.get(n);if((op.permission==='system.worker'||op.actor_source==='server_worker_claim')&&flow.audience!=='backend-only')throw Error('WORKER_IS_NOT_FRONTEND '+n);
  }
  if(!flow.review?.reason?.trim())throw Error('MISSING_WORKFLOW_REVIEW '+flow.id);
  if(!allowStale&&flow.review.fingerprint!==workflowFingerprint(flow,operations,root))throw Error('WORKFLOW_REVIEW_REQUIRED '+flow.id+'; read changed sources and guide, then docs:review with a reason');
 }
 const covered=new Set(manifest.flows.flatMap(f=>[...f.sources,...f.tests]));
 for(const file of contextFiles(root))if(!covered.has(file.path))throw Error('UNASSIGNED_WORKFLOW_SOURCE '+file.path);
 const missing=[...operations.keys()].filter(n=>!seen.has(n));if(missing.length)throw Error('UNMAPPED_WORKFLOW_API '+missing.join(','));
 return operations;
}
export function contextFiles(root){
 const files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0');
 return [...new Set(files)].filter(p=>p&&fs.existsSync(path.join(root,p))&&(
  /^apps\/backend\/(database\/.*\.sql|supabase\/(migrations\/.*\.sql|functions\/.*\.(ts|json)|config\.toml)|tests\/.*\.(mjs|sql)|scripts\/.*\.(mjs|sql|py|json)|transports\/.*\.mjs|api\/.*\.js|config\/.*\.json)$/.test(p)||
  /^packages\/api-contracts\/(schema\/.*\.json|src\/.*\.ts)$/.test(p)
 )).sort().map(p=>({path:p,sha256:sha(regular(root,p))}));
}
export function renderReferences(root,manifest,contract){
 const ops=validateWorkflows(manifest,contract,root),out={};
 const registry=json(path.join(root,registryPath));
 validateDocumentRegistry(registry,livingMarkdown(root),root);
 out['docs/documentation-map.md']=renderDocumentMap(registry);
 const base='docs/',migrationDir=path.join(root,'apps/backend/supabase/migrations');
 const migrations=fs.readdirSync(migrationDir).filter(n=>n.endsWith('.sql')).sort();
 const files=contextFiles(root),digest=sha(JSON.stringify(files));
 const intro=title=>`# ${title}\n\nÜretilmiştir: \`node apps/backend/scripts/update-docs.mjs --write\`. Elle düzenleme. Kaynak içerik özeti: \`${digest}\`. Bu özet CI/hosted kabulü değildir; dağıtılan SHA ve ortam CD artifact'ında bulunur.\n\n`;
 out[base+'database.md']=intro('Veritabanı kaynak referansı')+
  'Alan/scope/değişmez görünümü [fiziksel şema kataloğundadır](contracts/04-FtkSaaS-O4-veri-semasi.md). Bu dosya ikinci DDL sözleşmesi değildir. Etkin PostgreSQL şeması migration zincirinin uygulanmasıyla oluşur; dosyaları regex ile birleştirmek nihai şema çıkarımı sayılmaz.\n\n'+
  `Sıralı migration: ${migrations.length}. Uygulanmış içerik manifesti: [migrations.sha256.json](../apps/backend/database/migrations.sha256.json). CD, migration içeriklerini canlı geçmişle doğrular; dokümantasyon capture adımı ayrıca read-only pg_catalog snapshot ve Supabase CLI DB tiplerini alır. İş verisi/Auth satırı/secret toplanmaz.\n\n`+
  '| Migration | SHA256 |\n|---|---|\n'+migrations.map(n=>`| [${n}](../apps/backend/supabase/migrations/${n}) | \`${sha(fs.readFileSync(path.join(migrationDir,n)))}\` |`).join('\n')+'\n';
 const security=files.filter(f=>f.path.endsWith('.sql')&&/\b(?:policy|row level security|grant|revoke|security definer)\b/i.test(regular(root,f.path)));
 out[base+'security.md']=intro('Güvenlik kaynak referansı')+
  'İnsan istemci native Auth → JWT doğrulanan Edge → service-only RPC yolunu kullanır. Canlı oturum/MFA/tenant/rol/plan kontrolü tekrar denetlenir; core/private erişimi istemciye açılmaz. Worker ve public credential transport ayrı yetki yollarıdır. RLS tek başına Edge iş yetkisi değildir. [İstemci değişmezleri](client-integration.md), [teknik sözleşme](contracts/02-FtkSaaS-teknik-sozlesme.md) ve [iş akışları](workflows.md#wf00) normatif ayrıntıyı taşır.\n\n'+
  'Aşağıdaki liste güvenlik DDL içeren kaynak dosyalarıdır; son policy/grant kümesi veya başarılı güvenlik denetimi olduğu iddia edilmez. Etkin RLS/ACL/fonksiyon security flag/policy ifadeleri CD pg_catalog artifact\'ından okunur. Auth/public/storage şemaları bu uygulama katalog snapshot\'ına dahil değildir; sağlayıcı ayarları ayrıca kabul edilir.\n\n'+
  '| Güvenlik kaynağı | SHA256 |\n|---|---|\n'+security.map(f=>`| [${path.basename(f.path)}](${link(base+'security.md',f.path)}) | \`${f.sha256}\` |`).join('\n')+'\n';
 const owners=new Map(manifest.flows.flatMap(f=>f.operations.map(n=>[n,f])));
 const implemented=new Set(json(path.join(root,'apps/backend/supabase/functions/backend-v1/implemented.json')).operations);
 out[base+'functions.md']=intro('API ve iş akışı haritası')+
  'DTO/izin/hata/yan etkiler [üretilmiş API kataloğu](contracts/05-FtkSaaS-O4-API-katalogu.md) ve [makine sözleşmesinden](../packages/api-contracts/schema/contract.json) gelir. Edge kodu [backend-v1](../apps/backend/supabase/functions/backend-v1/index.ts) altındadır; SQL domain davranışını Edge dosyasından tek başına çıkarma. `implemented.json` içindeki varlık tüm selector/provider/ürün kabulünün tamamlandığı anlamına gelmez. Backend-only satırları tarayıcı endpoint önerisi değildir.\n\n'+
  '| API | Çağrılabilir envanter | Faz | İzin | Akış / kapsam |\n|---|---|---|---|---|\n'+[...ops.values()].map(o=>{const f=owners.get(o.name);return `| \`${o.name}\` | ${implemented.has(o.name)?'runtime (sınırları oku)':'contract_only'} | ${cell(o.operation_contract.kind)} | ${cell(o.permission)} | [${f.id}](${link(base+'functions.md',f.guide)}) / ${f.audience} |`;}).join('\n')+
  '\n\n## Akış kanıt kaynakları\n\nTest dosyası bağlantısı çalıştırılmış test başarısı değildir. Kaynak bağlı CI/hosted sonuçları güncel kabul belgesinin sahibidir.\n\n'+manifest.flows.map(f=>`- [${f.id} — ${f.title}](${link(base+'functions.md',f.guide)}): [alan devri](${link(base+'functions.md',f.detail)}); ${f.tests.map(t=>`[${path.basename(t)}](${link(base+'functions.md',t)})`).join(', ')}`).join('\n')+'\n';
 return {outputs:out,context:{format:1,documents:registry.documents,excluded_documents:['docs/history/**'],source_files:files,source_sha256:digest,flows:manifest.flows.map(f=>({id:f.id,guide:f.guide,sources:f.sources,tests:f.tests,operations:f.operations}))}};
}
export function updateDocs({root=repositoryRoot,check=false}={}){
 const manifest=json(path.join(root,workflowPath)),contract=json(path.join(root,'packages/api-contracts/schema/contract.json'));
 const result=renderReferences(root,manifest,contract);
 for(const [p,content] of Object.entries(result.outputs)){
  if(check){if(!fs.existsSync(path.join(root,p))||fs.readFileSync(path.join(root,p),'utf8')!==content)throw Error('GENERATED_DOCS_DRIFT '+p);}
  else fs.writeFileSync(path.join(root,p),content);
 }
 return result;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const args=process.argv.slice(2);
 if(args[0]==='--review'){
  const manifest=json(repoFile(workflowPath)),contract=json(repoFile('packages/api-contracts/schema/contract.json'));
  const ops=validateWorkflows(manifest,contract,repositoryRoot,{allowStale:true});
  const flow=manifest.flows.find(f=>f.id===args[1]),reason=args.slice(2).join(' ').trim();
  if(!flow||reason.length<12)throw Error('Usage: --review WFxx reason (after reviewing guide and changed sources)');
  flow.review={fingerprint:workflowFingerprint(flow,ops,repositoryRoot),reason};
  fs.writeFileSync(repoFile(workflowPath),JSON.stringify(manifest,null,2)+'\n');
 }else{
  if(args.length!==1||!['--check','--write','--context'].includes(args[0]))throw Error('Usage: --check | --write | --context | --review WFxx reason');
  const result=updateDocs({check:args[0]!=='--write'});
  if(args[0]==='--context'){
   const dir=repoFile('.artifacts/docs');fs.mkdirSync(dir,{recursive:true});
   fs.writeFileSync(path.join(dir,'context.json'),JSON.stringify({...result.context,source_sha:execFileSync('git',['rev-parse','HEAD'],{cwd:repositoryRoot,encoding:'utf8'}).trim()},null,2)+'\n');
  }
  console.log('Workflow coverage and generated documentation: OK');
 }
}
