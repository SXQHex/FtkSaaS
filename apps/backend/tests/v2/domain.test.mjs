import test from 'node:test';
import assert from 'node:assert/strict';
import {selectImpact} from '../../scripts/ci/v2/scope.mjs';
import {evaluateDomain} from '../../scripts/ci/v2/domain.mjs';

test('backend shadow decision is independent of failed frontend and retains deployment impact',()=>{
 const impact=selectImpact(['pnpm-lock.yaml']);
 const results={plan:'success',common:'success',backend:'success',frontend:'failure'};
 const decision=evaluateDomain(impact,'backend',results);
 assert.equal(decision.checks,'passed');assert.equal(decision.deployment,'required');
 assert.equal(decision.acceptance,false);assert.equal(decision.deploy_authorized,false);
 assert.throws(()=>evaluateDomain(impact,'frontend',results));
 assert.equal(evaluateDomain(impact,'frontend',{...results,frontend:'success',backend:'failure'}).checks,'passed');
});

test('CI-only success needs no deployment and unselected domain cannot claim passed checks',()=>{
 const impact=selectImpact(['apps/backend/scripts/ci/v2/settings.mjs']);
 assert.equal(evaluateDomain(impact,'backend',{plan:'success',common:'success',backend:'success'}).deployment,'not-required');
 const frontend=selectImpact(['apps/web/src/page.tsx']);
 assert.equal(evaluateDomain(frontend,'backend',{plan:'success',common:'success',backend:'skipped'}).checks,'not-selected');
 assert.throws(()=>evaluateDomain(frontend,'backend',{plan:'success',common:'success',backend:'success'}));
});

test('missing failed cancelled or skipped required obligations never authorize a domain',()=>{
 const impact=selectImpact(['apps/backend/database/kernel.sql']);
 for(const key of ['plan','common','backend'])for(const result of [undefined,'failure','cancelled','skipped']){
  assert.throws(()=>evaluateDomain(impact,'backend',{plan:'success',common:'success',backend:'success',[key]:result}));
 }
 for(const broken of [{...impact,deploy:{}},{...impact,backend_matrix:[]},{...impact,baseline:false}])assert.throws(()=>evaluateDomain(broken,'backend',{plan:'success',common:'success',backend:'success'}));
 assert.throws(()=>evaluateDomain(impact,'unknown',{}));
});
