import fs from 'node:fs';
import {build} from 'esbuild';
const directory=new URL('../../../.artifacts/spa-ingress/',import.meta.url);
const result=await build({entryPoints:[new URL('../transports/spa-ingress-worker.mjs',import.meta.url).pathname],bundle:true,platform:'browser',external:['node:*'],format:'esm',target:'es2022',minify:true,write:false});
fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(new URL('worker.mjs',directory),result.outputFiles[0].text);
const metadata={main_module:'worker.mjs',compatibility_date:'2026-11-13',compatibility_flags:['nodejs_compat'],observability:{enabled:true,redact_query_string:true,logs:{enabled:true,invocation_logs:false},traces:{enabled:true}},bindings:[{type:'plain_text',name:'FTK_BROWSER_ORIGINS',text:'https://app.fethiyetango.com'},{type:'plain_text',name:'FTK_PUBLIC_BACKEND_ORIGIN',text:'https://gwyprhenabtpkbojephw.supabase.co'}]};
fs.writeFileSync(new URL('metadata.json',directory),JSON.stringify(metadata,null,2)+'\n');
console.log('SPA ingress bundle: '+result.outputFiles[0].contents.length+' bytes. Metadata excludes ingress secret and anon credential.');
