import test from 'node:test';
import assert from 'node:assert/strict';
import {runCoreChecks,coreStages,validateCoreHealth,validatePristineBaseline,validateShadowScope} from '../../scripts/ci/v2/core.mjs';
const source='a'.repeat(40);
const stages=coreStages();

test('core shadow checks capture pristine schema before DB assertions and finish with seed health and advisors',()=>{
 const calls=[],reports=[];let pristine=false;
 const report=runCoreChecks({source,run:(cmd,args)=>{calls.push([cmd,...args]);if(args.includes('--local'))pristine=true;},readBaseline:()=>{assert(pristine);return {format:1,source,structure_sha256:'b'.repeat(64)};},readHealth:()=>({checks:[{name:'auth',passed:true},{name:'rest',passed:true}]}),write:value=>reports.push(structuredClone(value)),now:()=>0});
 assert.equal(calls.length,6);assert.deepEqual(stages.map(s=>s.name),['pristine-schema','documentation-links','database-security','synthetic-seed','service-health','database-advisors']);
 assert.deepEqual(calls[2],['node','--test','--test-concurrency=1','--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter=junit','--test-reporter-destination=../../.artifacts/ci-v2/core.junit.xml','tests/database.test.mjs','tests/event-scope.test.mjs']);
 assert.deepEqual(calls[5],['node_modules/.bin/supabase','db','advisors','--type','all','--level','warn','--fail-on','error']);
 assert.equal(report.acceptance,false);assert.equal(report.passed,true);assert.equal(report.stages.length,6);assert(reports.at(-1).stages.every(s=>s.passed));
});

test('every failed core obligation stops later work and retains a failed diagnostic report',()=>{
 for(let index=0;index<stages.length;index++){
  let count=0;const reports=[];
  assert.throws(()=>runCoreChecks({source,run:()=>{if(count++===index)throw Error('command failure');},readBaseline:()=>({format:1,source,structure_sha256:'b'.repeat(64)}),readHealth:()=>({checks:[{name:'auth',passed:true},{name:'rest',passed:true}]}),write:x=>reports.push(structuredClone(x)),now:()=>0}),/command failure/);
  assert.equal(count,index+1);assert.equal(reports.at(-1).passed,false);assert.equal(reports.at(-1).stages[index].passed,false);
 }
});

test('empty or partial health and mismatched pristine source cannot pass',()=>{
 assert.doesNotThrow(()=>validateCoreHealth({checks:[{name:'auth',passed:true},{name:'rest',passed:true}]}));
 for(const report of [{},{checks:[]},{checks:[{name:'auth',passed:true}]},{checks:[{name:'auth',passed:true},{name:'rest',passed:false}]},{checks:[{name:'auth',passed:true},{name:'auth',passed:true}]}])assert.throws(()=>validateCoreHealth(report));
 assert.doesNotThrow(()=>validatePristineBaseline({format:1,source,structure_sha256:'b'.repeat(64)},source));
 for(const value of [{},{format:1,source:'c'.repeat(40),structure_sha256:'b'.repeat(64)},{format:1,source,structure_sha256:'invalid'}])assert.throws(()=>validatePristineBaseline(value,source));
});

test('shadow scope selection cannot silently omit both execution domains',()=>{
 for(const mode of ['backend','core','full'])assert.equal(validateShadowScope(mode),mode);
 for(const mode of ['',undefined,'frontend','none','FULL'])assert.throws(()=>validateShadowScope(mode));
});
