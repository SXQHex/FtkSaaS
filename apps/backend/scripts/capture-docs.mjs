import fs from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {repoFile,backendRoot,repositoryRoot} from './paths.mjs';
import {updateDocs} from './update-docs.mjs';

export const appSchemas='core,private,api_v1';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const canonical=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value);
// Environment worker LOGIN memberships/ACL can differ. Report grants verbatim
// as metadata, but structural drift checks use only app-owned schema objects.
export function structure(catalog){const {grants,...rest}=catalog;return canonical(rest);}
export function validateCapture(receipt,source){
 if(receipt.success!==true||receipt.project!=='gwyprhenabtpkbojephw'||receipt.source!==source||!/^[a-f0-9]{40}$/.test(source??''))throw Error('DOCS_REQUIRE_SUCCESSFUL_EXACT_DELIVERY');
}
const sql=fs.readFileSync(new URL('./documentation-catalog.sql',import.meta.url),'utf8');
export async function captureLocal(){
 const {connect}=await import('./db.mjs');const client=await connect();
 try{
  await client.query('begin isolation level repeatable read read only');
  const result=await client.query(sql),catalog=result.rows[0].catalog;
  await client.query('rollback');
  const source=execFileSync('git',['rev-parse','HEAD'],{cwd:repositoryRoot,encoding:'utf8'}).trim();
  const dir=repoFile('.artifacts/docs');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(dir+'/schema-baseline.json',JSON.stringify({format:1,source,structure_sha256:sha(structure(catalog)),catalog},null,2)+'\n');
 }finally{await client.end();}
}
export async function captureHosted(){
 const source=execFileSync('git',['rev-parse','HEAD'],{cwd:repositoryRoot,encoding:'utf8'}).trim();
 const receipt=JSON.parse(fs.readFileSync(repoFile('.artifacts/ci/development-delivery.json'),'utf8'));
 validateCapture(receipt,source);
 const expected=JSON.parse(fs.readFileSync(repoFile('.artifacts/docs/schema-baseline.json'),'utf8'));
 if(expected.format!==1||expected.source!==process.env.DOCS_BASELINE_SHA||!/^([a-f0-9]{40})$/.test(expected.source??''))throw Error('DOCS_BASELINE_SOURCE_MISMATCH');
 const generated=updateDocs({check:true});
 const token=process.env.SUPABASE_ACCESS_TOKEN;if(!token)throw Error('DOCS_ACCESS_TOKEN_REQUIRED');
 const response=await fetch(`https://api.supabase.com/v1/projects/${receipt.project}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:true}),signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error('DOCS_CATALOG_HTTP_'+response.status);
 const rows=await response.json(),catalog=rows?.[0]?.catalog;
 if(catalog?.format!==1||!catalog.relations?.length||!catalog.functions?.length)throw Error('DOCS_INVALID_CATALOG');
 const dir=repoFile('.artifacts/docs');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(dir+'/schema-hosted.json',JSON.stringify(catalog,null,2)+'\n');
 const matching=structure(expected.catalog)===structure(catalog)&&expected.structure_sha256===sha(structure(expected.catalog));
 const report={format:1,source,baseline_source:expected.source,project:receipt.project,acceptance_run_id:receipt.acceptance_run_id,acceptance_attempt:receipt.acceptance_attempt,delivery_run_id:process.env.GITHUB_RUN_ID,delivery_attempt:process.env.GITHUB_RUN_ATTEMPT,structural_match:matching,scope:appSchemas,acl_comparison:'metadata only; environment worker ACL differs',provider_schemas:'excluded: public/auth/storage',source_sha256:generated.context.source_sha256};
 fs.writeFileSync(dir+'/documentation-delivery.json',JSON.stringify(report,null,2)+'\n');
 if(!matching)throw Error('DOCS_HOSTED_SCHEMA_DRIFT; inspect source-bound metadata artifact; no source rewrite');
 // Pinned workspace CLI was already installed by frozen pnpm install. Never
 // install latest, print stdout/stderr or include provider/Auth schemas.
 const cli=repoFile('apps/backend/node_modules/.bin/supabase');
 const result=spawnSync(cli,['gen','types','--lang','typescript','--project-id',receipt.project,'--schema',appSchemas],{cwd:backendRoot,encoding:'utf8',timeout:180000,maxBuffer:20*1024*1024,env:process.env});
 if(result.error||result.status!==0||!result.stdout.includes('export type Database'))throw Error('DOCS_TYPES_GENERATION_FAILED; CLI output withheld');
 fs.writeFileSync(dir+'/database.types.ts',result.stdout);
 fs.writeFileSync(dir+'/context.json',JSON.stringify({...generated.context,source,receipt:report},null,2)+'\n');
 // Bundle only deterministic references; agent instructions receive paths and
 // hashes, never environment files, credentials, live rows or remote code.
 for(const [p,text] of Object.entries(generated.outputs))fs.writeFileSync(dir+'/'+p.split('/').at(-1),text);
 const summary=`# Backend documentation delivery\n\nSource: \`${source}\`. App schema matches the isolated accepted migration baseline.\n\nDatabase TypeScript types are backend reference artifacts; frontend uses packages/api-contracts. Provider Auth/Storage/public, ACL parity and product/hosted workflow acceptance are separate.\n`;
 fs.writeFileSync(dir+'/README.md',summary);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\n'+summary);
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 if(process.argv[2]==='--local')await captureLocal();
 else if(process.argv[2]==='--hosted')await captureHosted();
 else throw Error('Use --local (existing isolated DB) or --hosted (successful source-bound CD only)');
}
