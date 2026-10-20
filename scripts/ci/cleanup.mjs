import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
// Marker is written BEFORE start, so partially initialized stacks are cleaned too.
// A preflight failure must not run a missing CLI and obscure the real failure.
if(fs.existsSync('.dev/ci-stack-attempted')&&fs.existsSync('node_modules/.bin/supabase')){
 const r=spawnSync('node_modules/.bin/supabase',['stop'],{stdio:'inherit'});
 if(r.error||r.status!==0)process.exitCode=1;
}else console.log('Cleanup: no initialized local backend; nothing to stop');
