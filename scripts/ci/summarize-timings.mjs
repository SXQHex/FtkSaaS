import fs from 'node:fs';
const dir='.ci/timings';const suites=fs.existsSync(dir)?fs.readdirSync(dir).filter(p=>p.endsWith('.json')).map(p=>JSON.parse(fs.readFileSync(dir+'/'+p))):[];
let s='## API measurements\n\n';
if(!suites.length)s+='No API request timing sample in this run. No speedup is claimed.\n';
for(const suite of suites){s+='### '+suite.suite+'\n\nProcess wall: '+(suite.wall_ms/1000).toFixed(2)+' s (includes setup/waits); sums overlap across fixtures/HTTP.\n\n| Kind | Operation | Count | Sum ms | Max ms |\n|---|---|---:|---:|---:|\n';
 for(const r of suite.rows.sort((a,b)=>b.total_ms-a.total_ms))s+='| '+[r.kind,r.name,r.count,r.total_ms.toFixed(1),r.max_ms.toFixed(1)].join(' | ')+' |\n';
}s+='\nHTTP measures response headers; API command/fixture timers include body decoding. No credentials, request bodies or identities recorded. Concurrency remains 2; shared global trigger/function fixtures preclude unverified parallelism.\n';
console.log(s);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,s);
