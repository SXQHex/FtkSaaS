import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {performance} from 'node:perf_hooks';
fs.mkdirSync('.dev',{recursive:true,mode:0o700});const fd=fs.openSync('.dev/native-start.log','w',0o600);
if(process.env.CI)fs.writeFileSync('.dev/ci-stack-attempted','1');
// Native calendar acceptance uses only an isolated loopback origin and an
// ephemeral local signing key. Hosted configuration is never generated here.
if(process.env.CI||process.env.FTK_CALENDAR_TEST_FIXTURE==='1'){
 const marker='.dev/calendar-fixture.json',envPath='supabase/functions/.env';
 if(!(fs.existsSync(marker)&&fs.existsSync(envPath))){
  if(fs.existsSync(envPath))throw Error('Calendar fixture will not replace existing function environment');
  const {createServer}=await import('node:net'),{randomBytes}=await import('node:crypto');
  const reserve=createServer();await new Promise((resolve,reject)=>{reserve.once('error',reject);reserve.listen(0,'127.0.0.1',resolve);});
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));const origin='http://127.0.0.1:'+port;
  fs.writeFileSync(envPath,'FTK_CALENDAR_ORIGIN='+origin+'\nFTK_CALENDAR_SESSION_URL_TEMPLATE=https://calendar-app.ftksaas.invalid/org/{org_id}/session/{session_id}\nFTK_CALENDAR_SIGNING_KEY='+randomBytes(32).toString('hex')+'\n',{mode:0o600});
  fs.writeFileSync(marker,JSON.stringify({origin,port}),{mode:0o600});
 }
}
const nativeStart=performance.now();
const run=spawnSync('node_modules/.bin/supabase',['start','--runtime','native','--preparation','on-demand','--exclude','analytics,realtime,pooler'],{stdio:['ignore',fd,fd]});fs.closeSync(fd);
if(run.error)throw run.error;if(run.status!==0){console.error('Local stack start failed; inspect .dev/native-start.log locally.');process.exit(run.status??1);}
console.log('Isolated local backend started. Run pnpm run dev:info for public connection details.');

const nativeReady=performance.now();
await import('./wait-local.mjs');
fs.writeFileSync('.dev/start-timings.json',JSON.stringify({native_start_s:(nativeReady-nativeStart)/1000,initial_readiness_s:(performance.now()-nativeReady)/1000}));
