import {repoFile} from '../paths.mjs';
export function runApiPhases(plan,run,resolvePath=repoFile){
 const priority=plan.api.filter(p=>plan.priority?.includes(p)),regressions=plan.api.filter(p=>!priority.includes(p));
 if(priority.length){console.log('Priority API acceptance:',priority.join(', '));run('node',['--test','--test-concurrency=2',...priority.map(p=>resolvePath(p))]);}
 if(regressions.length){console.log('Selected API regressions:',regressions.join(', '));run('node',['--test','--test-concurrency=2',...regressions.map(p=>resolvePath(p))]);}
}
