import {resolveMerged,remoteDocumentScope} from './source.mjs';
export async function resolveRecovery(github,context,core,requested=context.payload.inputs.merge_sha){
 const sha=requested;
 if(!/^[a-f0-9]{40}$/.test(sha??''))throw Error('Exact merge SHA required');
 const {pr,merged}=await resolveMerged(github,{repo:context.repo,sha});
 const scope=await remoteDocumentScope(github,context.repo,pr.base.sha,pr.head.sha);
 if(!scope.safe)throw Error('Recovery is documentation-only: '+scope.reason);
 const binding={kind:'documentation-recovery',actual:sha,pr:pr.number,base:pr.base.sha,head:pr.head.sha,merge:sha,tree:merged.tree.sha,policy_sha:context.sha,run_id:context.runId,attempt:Number(process.env.GITHUB_RUN_ATTEMPT)};
 core.setOutput('merge',sha);core.setOutput('binding',JSON.stringify(binding));
}
