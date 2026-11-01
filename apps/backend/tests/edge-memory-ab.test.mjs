import test from 'node:test';
import assert from 'node:assert/strict';
import {pressure,loopback} from '../scripts/ci/edge-memory-ab.mjs';
test('memory experiment stops before Edge or host exhaustion, including multiple Edge processes',()=>{
 const sample=(rss,available=3*1024*1024)=>({memory:{MemAvailable_kib:available},processes:rss.map((n,i)=>({name:'.edge-runtime-w',pid:i+1,rss_kib:n}))});
 assert.equal(pressure(sample([100])).stop,null);
 assert.equal(pressure(sample([1024*1024,1024*1024])).stop,'edge_rss_limit');
 assert.equal(pressure(sample([100],1024*1024-1)).stop,'host_memory_limit');
 assert.equal(pressure({memory:{MemAvailable_kib:3*1024*1024},processes:[{name:'postgres',rss_kib:3*1024*1024}]}).rss,0);
});
test('memory experiment rejects remote, credential-bearing and non-HTTP origins',()=>{
 assert.equal(loopback('http://127.0.0.1:54321'),'http://127.0.0.1:54321');
 for(const value of ['https://example.com','http://127.0.0.1.example.com','http://user:password@localhost','file:///tmp/socket','https://localhost'])assert.throws(()=>loopback(value));
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {memorySnapshot} from '../scripts/ci/observe-api.mjs';
test('memory cap includes Edge workers outside the default top fifteen processes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'edge-proc-'));
 try{
  fs.writeFileSync(path.join(root,'meminfo'),'MemAvailable: 9000000 kB\n');
  for(let i=1;i<=40;i++){const dir=path.join(root,String(i));fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'status'),'Name:\t.edge-runtime-w\nPPid:\t1\nVmRSS:\t65536 kB\n');}
  assert.equal(memorySnapshot(root).processes.length,15);
  const full=memorySnapshot(root,Infinity);
  assert.equal(full.processes.length,40);
  assert.equal(pressure(full).rss,40*65536);
  assert.equal(pressure(full).stop,'edge_rss_limit');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
