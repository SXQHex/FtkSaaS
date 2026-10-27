import fs from 'node:fs';import assert from 'node:assert/strict';import {build} from 'esbuild';
const result=await build({entryPoints:['supabase/functions/backend-v1/handler.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,legalComments:'inline',write:false});
const code='// Generated, dependency-complete Edge runtime. Edit handler.ts and run npm run generate.\n'+result.outputFiles[0].text;
const path='supabase/functions/backend-v1/index.ts';if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path,'utf8'),code,'Edge bundle drift');else fs.writeFileSync(path,code);
assert(!/from[ \t]*[\"\']npm:/.test(code));console.log('Dependency-complete Edge bundle: '+Buffer.byteLength(code)+' bytes');
