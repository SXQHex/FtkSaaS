import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export const registryPath='docs/documentation.json';
export function livingMarkdown(root){
 return [...new Set(execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0'))]
  .filter(p=>p.endsWith('.md')&&!p.startsWith('docs/history/')&&fs.existsSync(path.join(root,p))).sort();
}
export function validateDocumentRegistry(registry,files,root){
 if(registry.format!==1||!Array.isArray(registry.documents))throw Error('INVALID_DOCUMENT_REGISTRY');
 const paths=new Set(),topics=new Set();
 for(const doc of registry.documents){
  if(typeof doc.path!=='string'||!doc.path.endsWith('.md')||doc.path.startsWith('/')||doc.path.includes('\\')||doc.path.split('/').some(p=>!p||p==='.'||p==='..')||doc.path.startsWith('docs/history/'))throw Error('INVALID_LIVING_DOCUMENT');
  if(paths.has(doc.path))throw Error('DUPLICATE_DOCUMENT '+doc.path);paths.add(doc.path);
  if(!['authority','entry','guide','generated','status','backlog','queue','coordination'].includes(doc.role)||!doc.purpose?.trim()||!Array.isArray(doc.topics)||!doc.topics.length)throw Error('MISSING_DOCUMENT_OWNER '+doc.path);
  if(['status','backlog','queue'].includes(doc.role)&&!/^apps\/(backend|web)\/docs\//.test(doc.path))throw Error('DEVELOPMENT_STATE_OUTSIDE_APP_DOCS '+doc.path);
  if((doc.role==='coordination')!==(doc.path==='docs/requests.md'))throw Error('INVALID_COORDINATION_DOCUMENT '+doc.path);
  for(const topic of doc.topics){
   if(typeof topic!=='string'||!topic.trim()||topics.has(topic))throw Error('DUPLICATE_TOPIC_OWNER '+topic);topics.add(topic);
  }
  let current=root;
  for(const part of doc.path.split('/')){current=path.join(current,part);if(!fs.existsSync(current)||fs.lstatSync(current).isSymbolicLink())throw Error('INVALID_DOCUMENT_FILE '+doc.path);}
  if(!fs.statSync(current).isFile())throw Error('INVALID_DOCUMENT_FILE '+doc.path);
 }
 for(const file of files)if(!paths.has(file))throw Error('UNREGISTERED_DOCUMENT '+file);
 for(const file of paths)if(!files.includes(file))throw Error('STALE_DOCUMENT_REGISTRY '+file);
 return paths.size;
}
export function renderDocumentMap(registry){
 return '# Belge sahipliği haritası\n\nÜretilmiştir: `docs/documentation.json` → `docs:update`. Elle düzenleme. Konu kimliği tek belgeye aittir; özet ve generated görünüm yeni karar kaynağı değildir. Güncel arama/context yalnız bu yaşayan dosyaları seçer. Tarihsel kanıta giriş yalnız [kaynak indeksi](source-index.md) üzerinden yapılır.\n\n| Belge | Rol | Tek sorumluluk | Konu kimlikleri |\n|---|---|---|---|\n'+registry.documents.map(d=>`| [${d.path}](${path.posix.relative('docs',d.path)}) | ${d.role} | ${d.purpose.replaceAll('|','∣')} | ${d.topics.join(', ')} |`).join('\n')+'\n';
}
