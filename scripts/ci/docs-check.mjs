import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2);const changed=args.length?args:JSON.parse(fs.readFileSync('.ci/selection.json')).docs;
// Inbound links must also be checked after a target is deleted or renamed. Historical reports are immutable snapshots.
const living=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(p=>p.endsWith('.md')&&!p.startsWith('reports/')&&!p.startsWith('contracts/source-v2.2/'));
const files=[...new Set([...changed,...living])];
let count=0;
for(const f of files){if(!fs.existsSync(f))continue; // Deleted documents have no outgoing links.
 const text=fs.readFileSync(f,'utf8');if(/^(<<<<<<<|=======|>>>>>>>) /m.test(text))throw Error('MERGE_MARKER '+f);
 if(!f.endsWith('.md'))continue;
 for(const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)){
  const link=m[1];if(/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(link))continue;
  const target=decodeURIComponent(link.split('#')[0].split('?')[0]);if(!target)continue;
  if(!fs.existsSync(path.resolve(path.dirname(f),target)))throw Error('BROKEN_LOCAL_LINK '+f+' -> '+target);count++;
 }
}console.log('Documentation checks:',files.length,'files;',count,'local links');
