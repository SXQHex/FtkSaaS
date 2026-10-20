import fs from 'node:fs';import {spawnSync} from 'node:child_process';
fs.mkdirSync('.dev',{recursive:true,mode:0o700});const fd=fs.openSync('.dev/native-start.log','w',0o600);
if(process.env.CI)fs.writeFileSync('.dev/ci-stack-attempted','1');
const run=spawnSync('node_modules/.bin/supabase',['start','--runtime','native','--preparation','on-demand','--exclude','analytics,realtime,pooler'],{stdio:['ignore',fd,fd]});fs.closeSync(fd);
if(run.error)throw run.error;if(run.status!==0){console.error('Local stack start failed; inspect .dev/native-start.log locally.');process.exit(run.status??1);}
console.log('Isolated local backend started. Run npm run dev:info for public connection details.');

await import('./wait-local.mjs');
