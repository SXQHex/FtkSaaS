import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
process.chdir(root);
const deadline = Date.now() + 90000;
for(const args of [
  ['apps/backend/scripts/ci/floor-guard.mjs','--base',process.env.QUALITY_BASE || 'origin/main'],
  ['--test','apps/backend/tests/quality-guard.test.mjs'],
]) {
  const remaining = deadline - Date.now();
  if(remaining <= 0) {console.error('Quality check exceeded 90-second local budget'); process.exit(2);}
  const result = spawnSync(process.execPath,args,{stdio:'inherit',timeout:remaining,killSignal:'SIGKILL'});
  if(result.error || result.status !== 0) process.exit(result.status || 2);
}
