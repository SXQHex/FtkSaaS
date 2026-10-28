import {classifyChanges,ownerOf} from './scope.mjs';
import {coverageHash} from './shards.mjs';
import {documentScope} from './document-scope.mjs';
export function assertReady(pr){
 if(pr.state!=='open'||pr.draft)throw Error('Draft or closed candidate cannot merge');
}
export function assertParents(commit,base,head){
 if(commit.parents.length!==2||commit.parents[0].sha!==base||commit.parents[1].sha!==head)throw Error('Merge parents mismatch');
}
export async function remoteDocumentScope(github,repo,base,head,{allowFrontend=false}={}){
 const trees=await Promise.all([base,head].map(async tree_sha=>{
  const t=(await github.rest.git.getTree({...repo,tree_sha,recursive:'1'})).data;
  if(t.truncated)throw Error('Truncated source tree');
  return new Map(t.tree.filter(x=>x.type==='blob'||x.mode==='160000').map(x=>[x.path,x]));
 }));
 const changes=[...new Set([...trees[0].keys(),...trees[1].keys()])].filter(p=>trees[0].get(p)?.sha!==trees[1].get(p)?.sha||trees[0].get(p)?.mode!==trees[1].get(p)?.mode).map(path=>({path,status:!trees[0].has(path)?'A':!trees[1].has(path)?'D':'M'}));
 if(allowFrontend){for(let i=changes.length-1;i>=0;i--)if(ownerOf(changes[i].path)==='frontend')changes.splice(i,1);}
 const contents=new Map();
 for(const c of changes)for(let i=0;i<2;i++){
  const f=trees[i].get(c.path);if(!f)continue;
  if(c.path==='apps/backend/scripts/render_catalogs.py'){
   const b=(await github.rest.git.getBlob({...repo,file_sha:f.sha})).data;
   if(b.encoding!=='base64')throw Error('Unknown blob encoding');contents.set(i+':'+c.path,Buffer.from(b.content,'base64').toString('utf8'));
  }else contents.set(i+':'+c.path,'regular document');
 }
 const read=(s,p)=>contents.get((s==='base'?0:1)+':'+p)??null,mode=(s,p)=>trees[s==='base'?0:1].get(p)?.mode;
 const preliminary=documentScope(changes,read,mode);
 if(!preliminary.safe)return preliminary;
 for(const c of changes)for(let i=0;i<2;i++){
  const f=trees[i].get(c.path);if(!f||c.path==='apps/backend/scripts/render_catalogs.py')continue;
  const b=(await github.rest.git.getBlob({...repo,file_sha:f.sha})).data;
  if(b.encoding!=='base64')throw Error('Unknown document encoding');
  contents.set(i+':'+c.path,new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(b.content,'base64')));
 }
 return documentScope(changes,read,mode);
}
// Compare full trees instead of a potentially truncated PR-file response. Deletions
// and both ends of a rename remain visible as removed/added tree entries.
export async function remoteSourceScope(github,repo,base,head){
 const trees=await Promise.all([base,head].map(async tree_sha=>{
  const t=(await github.rest.git.getTree({...repo,tree_sha,recursive:'1'})).data;
  if(t.truncated)throw Error('Truncated source tree');
  return new Map(t.tree.filter(x=>x.type==='blob'||x.mode==='160000').map(x=>[x.path,x]));
 }));
 const changes=[...new Set([...trees[0].keys(),...trees[1].keys()])]
  .filter(p=>trees[0].get(p)?.sha!==trees[1].get(p)?.sha||trees[0].get(p)?.mode!==trees[1].get(p)?.mode)
  .map(path=>({path,status:!trees[0].has(path)?'A':!trees[1].has(path)?'D':'M'}));
 const scope=classifyChanges(changes);
 if(!scope.backend&&scope.documentation&&!(await remoteDocumentScope(github,repo,base,head,{allowFrontend:true})).safe)throw Error('Unsafe documentation source');
 return scope;
}
export async function backendUnchanged(github,repo,base,head){
 if(base===head)return true;
 try{return !(await remoteSourceScope(github,repo,base,head)).backend;}catch{return false;}
}
export const policyPath=p=>p==='docs/history/manifest.json'||p.startsWith('.github/workflows/')||p.startsWith('apps/backend/scripts/ci/')||['apps/backend/scripts/test-clean.mjs','apps/backend/scripts/start-dev.mjs','apps/backend/scripts/paths.mjs'].includes(p);
export async function policyMatches(github,repo,base,head){
 const values=await Promise.all([base,head].map(async tree_sha=>{
  const t=(await github.rest.git.getTree({...repo,tree_sha,recursive:'1'})).data;
  if(t.truncated)throw Error('Truncated policy tree');
  return t.tree.filter(x=>x.type==='blob'&&policyPath(x.path)).map(x=>[x.path,x.sha,x.mode]).sort((a,b)=>a[0].localeCompare(b[0]));
 }));
 return JSON.stringify(values[0])===JSON.stringify(values[1]);
}
export async function resolveCandidate(github,context,core,kind){
 const p=(await github.rest.pulls.get({...context.repo,pull_number:context.issue.number})).data;
 if(kind==='auto'){if(p.state!=='open')throw Error('Closed PR cannot be tested');}else assertReady(p);
 if(p.base.ref!=='main')throw Error('Candidate must target main');
 if(p.head.sha!==context.payload.pull_request.head.sha)throw Error('Candidate changed');
 const merge=(await github.rest.git.getRef({...context.repo,ref:`pull/${p.number}/merge`})).data.object.sha;
 const commit=(await github.rest.git.getCommit({...context.repo,commit_sha:merge})).data;
 assertParents(commit,p.base.sha,p.head.sha);
 const sourceScope=await remoteSourceScope(github,context.repo,p.base.sha,p.head.sha);
 core.setOutput('kind',sourceScope.kind);
 if(sourceScope.kind==='frontend'){core.setOutput('eligible','false');return;}
 if(kind==='auto')kind=sourceScope.kind;
 const scope={safe:sourceScope.kind==='documentation'};
 if(kind==='full'&&scope.safe)throw Error('Documentation-only source uses documentation acceptance, not full clean');
 if(kind==='documentation'&&!scope.safe){core.setOutput('eligible','false');return;}
 const binding={kind,coverage:kind==='full'?coverageHash():undefined,pr:p.number,head:p.head.sha,base:p.base.sha,merge,tree:commit.tree.sha,run_id:context.runId,attempt:Number(process.env.GITHUB_RUN_ATTEMPT),benchmark:false};
 core.setOutput('eligible','true');core.setOutput('merge',merge);core.setOutput('binding',JSON.stringify(binding));
}
export async function resolveMerged(github,context){
 const prs=await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit,{...context.repo,commit_sha:context.sha,per_page:100});
 const pr=prs.find(p=>p.merged_at&&p.merge_commit_sha===context.sha);
 if(!pr)throw Error('Main commit must be a PR merge with candidate proof');
 const merged=(await github.rest.git.getCommit({...context.repo,commit_sha:context.sha})).data;
 assertParents(merged,pr.base.sha,pr.head.sha);
 return {pr,merged};
}
