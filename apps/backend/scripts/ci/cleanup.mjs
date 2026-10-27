import {backendRoot} from '../paths.mjs';
import path from 'node:path';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
// Marker is written BEFORE start, so partially initialized stacks are cleaned too.
// A preflight failure must not run a missing CLI and obscure the real failure.
if(fs.existsSync(path.join(backendRoot,'.dev/ci-stack-attempted'))&&fs.existsSync(path.join(backendRoot,'node_modules/.bin/supabase'))){
 const r=spawnSync(path.join(backendRoot,'node_modules/.bin/supabase'),['stop'],{stdio:'inherit',cwd:backendRoot});
 if(r.error||r.status!==0)process.exitCode=1;
}else console.log('Cleanup: no initialized local backend; nothing to stop');
