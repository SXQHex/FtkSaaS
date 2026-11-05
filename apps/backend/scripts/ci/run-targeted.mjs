import {repoFile} from '../paths.mjs';
export function runApiPhases(plan,run,resolvePath=repoFile){
 const exclusive=plan.api.filter(p=>plan.exclusive?.includes(p));
 for(const suite of exclusive)run('node',['--test','--test-concurrency=1',resolvePath(suite)]);
 const parallel=plan.api.filter(p=>!exclusive.includes(p));
 const priority=parallel.filter(p=>plan.priority?.includes(p)),regressions=parallel.filter(p=>!priority.includes(p));
 if(priority.length){console.log('Priority API acceptance:',priority.join(', '));run('node',['--test','--test-concurrency=2',...priority.map(p=>resolvePath(p))]);}
 if(regressions.length){console.log('Selected API regressions:',regressions.join(', '));run('node',['--test','--test-concurrency=2',...regressions.map(p=>resolvePath(p))]);}
}
