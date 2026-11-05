import test from 'node:test';
import assert from 'node:assert/strict';
import {cliFailure} from '../scripts/ci/deploy-development.mjs';

test('CLI diagnostics classify provider and local failures without retaining output',()=>{
 for(const [stderr,category,http_status] of [
  ['HTTP 403 Forbidden: token='+'synthetic-private-value','authorization',403],
  ['status code: 413 request too large','request_size',413],
  ['failed to bundle module: source contains private data','bundle',null],
  ['unknown flag: --unsupported','configuration',null],
  ['request failed: ECONNRESET','network',null],
  ['unrecognized provider response','unknown',null],
  [JSON.stringify({_tag:'Failure',error:{_tag:'CliConfigValueError',message:'private config value'}}),'configuration',null],
  [JSON.stringify({_tag:'Failure',error:{_tag:'DbPasswordFlagsError',message:'private database URL'}}),'configuration',null],
  [JSON.stringify({_tag:'Failure',error:{_tag:'HostedMutationConsentRequiredError',message:'private project'}}),'confirmation',null],
  [JSON.stringify({_tag:'Failure',error:{_tag:'HostedMutationDeclinedError',message:'context canceled'}}),'confirmation',null],
 ]){
  const result=cliFailure({status:1,stderr,stdout:'private SQL and credential output'});
  assert.deepEqual(result,{category,exit_code:1,http_status,signal:null,spawn_error:null});
  assert(!JSON.stringify(result).includes('synthetic-private-value'));
  assert(!JSON.stringify(result).includes('private SQL'));
 }
});

test('CLI diagnostics allow only fixed process metadata and bounded exit codes',()=>{
 assert.deepEqual(cliFailure({status:null,signal:'SIGTERM',error:{code:'ETIMEDOUT'}}),
  {category:'network',exit_code:null,http_status:null,signal:'SIGTERM',spawn_error:'ETIMEDOUT'});
 assert.deepEqual(cliFailure({status:null,error:{code:'ENOENT'}}),
  {category:'local_process',exit_code:null,http_status:null,signal:null,spawn_error:'ENOENT'});
 assert.deepEqual(cliFailure({status:999,signal:'private-data',error:{code:'private-data',message:'private-data'},stderr:{secret:'private-data'}}),
  {category:'unknown',exit_code:null,http_status:null,signal:null,spawn_error:null});
});
