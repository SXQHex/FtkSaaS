import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {repositoryRoot} from '../scripts/paths.mjs';
import {buildInventory,partition,executionPhases,materialize} from '../scripts/ci/api-suites.mjs';

test('production inventory owns every original line and import once and compiles every payload',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../scripts/ci/api-suites.json',import.meta.url)));
 const inventory=buildInventory(repositoryRoot),bins=partition(inventory.units);
 const added=new Set(['document-self-requirements-acceptance','crm-application-intake-acceptance','crm-application-review-acceptance','starter-operations-report-shaping','starter-operations-import-templates','starter-operations-report-access','starter-operations-inbox','crm-provider-delivery-acceptance','crm-provider-authority-acceptance','crm-provider-webhook-acceptance','crm-meta-queue-acceptance','crm-meta-queue-authority-acceptance']);
 assert.equal(inventory.units.length,64+added.size);
 for(const id of added)assert(inventory.units.some(u=>u.id===id),'Missing new acceptance unit '+id);
 // Keep the original 64 acceptance units and their eight-shard invariant.
 {
  const inventory={units:buildInventory(repositoryRoot).units.filter(u=>!added.has(u.id))};
  const bins=partition(inventory.units);
 assert.equal(bins.length,8);assert.equal(inventory.units.length,64);
 }

 assert.deepEqual(bins.flatMap(b=>b.units.map(u=>u.id)).sort(),inventory.units.map(u=>u.id).sort());
 assert.deepEqual(partition([...inventory.units].reverse()),bins);
 assert.throws(()=>buildInventory(repositoryRoot,{read:p=>fs.readFileSync(path.join(repositoryRoot,p),'utf8')+'\n'}),/source changed/);
 const missing=structuredClone(manifest);missing.suites[0].parts[0].ranges[0][0]++;
 assert.throws(()=>buildInventory(repositoryRoot,{manifest:missing}),/coverage/);
 const duplicate=structuredClone(manifest);duplicate.suites[0].parts.push(structuredClone(duplicate.suites[0].parts[0]));
 assert.throws(()=>buildInventory(repositoryRoot,{manifest:duplicate}),/coverage|Duplicate/);
 const dir=fs.mkdtempSync(path.join(tmpdir(),'ftk-production-suites-'));
 try{for(const unit of inventory.units){const file=path.join(dir,unit.id+'.mjs');fs.writeFileSync(file,unit.code);execFileSync(process.execPath,['--check',file],{stdio:'pipe'});}}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
 const phases=executionPhases(inventory.units);
 assert.equal(inventory.units.filter(u=>u.exclusive).length,5);
 for(const phase of phases){if(phase.units.some(u=>u.exclusive)){assert.equal(phase.units.length,1);assert.equal(phase.concurrency,1);}else assert.equal(phase.concurrency,2);}

});

test('production hook preserves native test deadlines and failure propagation',()=>{
 const dir=fs.mkdtempSync(path.join(tmpdir(),'ftk-production-hook-'));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('NODE_TEST_')));
 try{
  fs.mkdirSync(path.join(dir,'tests'));
  const source='tests/probe.mjs',target=path.join(dir,source);
  const body="import test from 'node:test';import assert from 'node:assert/strict';\ntest('deadline',{timeout:1},async()=>{await new Promise(r=>setTimeout(r,50));assert(true);});\n";
  fs.writeFileSync(target,body);
  const inventory={root:dir,units:[{id:'probe',source,code:body}]};
  const [file]=materialize(inventory,path.join(dir,'wrappers'));
  const wrapper=fs.readFileSync(file,'utf8');assert(!wrapper.includes('measurement'));assert(!wrapper.includes('Infinity'));
  assert.throws(()=>execFileSync(process.execPath,['--test',file],{stdio:'pipe',env}));
  const bad=body.replace("{timeout:1}","{timeout:1000}").replace('assert(true)','assert(false)');
  const [failure]=materialize({...inventory,units:[{id:'failure',source,code:bad}]},path.join(dir,'wrappers'));
  assert.throws(()=>execFileSync(process.execPath,['--test',failure],{stdio:'pipe',env}));
  const good=body.replace('{timeout:1}','{timeout:1000}');
  const [success]=materialize({...inventory,units:[{id:'success',source,code:good}]},path.join(dir,'wrappers'));
  execFileSync(process.execPath,['--test',success],{stdio:'pipe',env});
  assert.equal(fs.readFileSync(target,'utf8'),body);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
