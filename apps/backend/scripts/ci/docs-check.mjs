import {repositoryRoot,repoFile} from '../paths.mjs';
import {ciFile} from '../paths.mjs';
import fs from 'node:fs';
import {updateDocs} from '../update-docs.mjs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Exact relocated source snapshots retain the link context of their source commit.
// The manifest is part of the CI trust surface; unknown reports gain no exception.
const historicalManifest=JSON.parse(fs.readFileSync(repoFile('docs/history/manifest.json'),'utf8'));
if(historicalManifest.format!==1||!Array.isArray(historicalManifest.files))throw Error('INVALID_HISTORICAL_MANIFEST');
const historicalRecords=historicalManifest.files;
if(historicalRecords.some(r=>typeof r.path!=='string'||!r.path.startsWith('docs/history/')||r.path.split('/').includes('..')||typeof r.source_path!=='string'||r.source_path.startsWith('/')||r.source_path.split('/').includes('..')||!/^[a-f0-9]{40}$/.test(r.source_commit)||!/^[a-f0-9]{64}$/.test(r.sha256))||new Set(historicalRecords.map(r=>r.path)).size!==historicalRecords.length)throw Error('INVALID_HISTORICAL_MANIFEST');
const historicalDigests=new Map(historicalRecords.map(r=>[r.path,r.sha256]));
export function historicalSnapshot(file,text){
 const expected=historicalDigests.get(file);if(!expected)return false;
 if(createHash('sha256').update(text).digest('hex')!==expected)throw Error('HISTORICAL_SNAPSHOT_DRIFT '+file);
 return true;
}

export function markdownAnchors(text){
 const anchors=new Set(),counts=new Map();let fence=null;
 for(const line of text.split('\n')){
  const marker=/^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
  if(marker){if(!fence)fence=marker;else if(marker[0]===fence[0]&&marker.length>=fence.length)fence=null;continue;}
  if(fence)continue;
  for(const m of line.matchAll(/\b(?:id|name)=["']([^"']+)["']/g))anchors.add(m[1]);
  const heading=/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)?.[1];if(!heading)continue;
  const slug=heading.replace(/<[^>]*>/g,'').replace(/!?\[([^\]]+)\]\([^)]*\)/g,'$1').toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu,'').replace(/\s/g,'-');
  let unique=slug,n=counts.get(slug)??0;while(anchors.has(unique))unique=slug+'-'+(++n);counts.set(slug,n);anchors.add(unique);
 }
 return anchors;
}
export function checkDocuments(files){
 let count=0;const targets=new Map();
 for(const f of [...new Set(files)]){
  if(!fs.existsSync(f))continue;
  const text=fs.readFileSync(f,'utf8');if(/^(<<<<<<<|=======|>>>>>>>) /m.test(text))throw Error('MERGE_MARKER '+f);
  if(!f.endsWith('.md')||historicalSnapshot(f,text))continue;
  for(const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)){
   const link=m[1];if(/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(link))continue;
   const [location,fragment]=link.split('#');const target=decodeURIComponent(location.split('?')[0]);
   const absolute=path.resolve(path.dirname(f),target||path.basename(f));
   const relative=path.relative(repositoryRoot,absolute).replaceAll(path.sep,'/');
   if(relative.startsWith('docs/history/')&&f!=='docs/source-index.md')throw Error('HISTORICAL_DOCUMENT_AS_CURRENT '+f+' -> '+target);
   if(!fs.existsSync(absolute))throw Error('BROKEN_LOCAL_LINK '+f+' -> '+target);
   if(fragment&&absolute.endsWith('.md')){
    if(!targets.has(absolute))targets.set(absolute,markdownAnchors(fs.readFileSync(absolute,'utf8')));
    if(!targets.get(absolute).has(decodeURIComponent(fragment)))throw Error('BROKEN_LOCAL_ANCHOR '+f+' -> '+link);
   }
   count++;
  }
 }
 return count;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 process.chdir(execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim());
 const args=process.argv.slice(2),changed=args.length?args:JSON.parse(fs.readFileSync(ciFile('selection.json'))).docs;
 // Inbound links, including fragments, survive deletion/move checks. Reports are source snapshots.
 const living=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split('\0').filter(p=>p.endsWith('.md')&&!p.startsWith('docs/history/')&&fs.existsSync(p));
 const files=[...new Set([...changed,...living])];
 for(const retired of Object.keys(JSON.parse(fs.readFileSync(new URL('./document-moves.json',import.meta.url)))))if(fs.existsSync(repoFile(retired)))throw Error('RETIRED_DOCUMENT_PATH '+retired);
 updateDocs({check:true});
 console.log('Documentation checks:',files.length,'files;',checkDocuments(files),'local links');
}
