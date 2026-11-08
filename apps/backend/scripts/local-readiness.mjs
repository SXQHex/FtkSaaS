// Never include upstream bodies, URLs, headers or exception messages in CI logs.
export function readinessSummary({auth,rpc,edge,code,failure}) {
 const status=value=>Number.isInteger(value)&&value>=100&&value<=599?value:null;
 return {auth:status(auth),rpc:status(rpc),edge:status(edge),auth_required:code==='AUTH_REQUIRED',failure:['TimeoutError','AbortError','SyntaxError','TypeError'].includes(failure)?failure:failure?'ProbeError':null};
}
export function isLocalReady(probe) {
 return probe.auth>=200&&probe.auth<300&&probe.rpc>=200&&probe.rpc<300&&probe.edge===401&&probe.auth_required&&probe.failure===null;
}

export function nativeFailureSummary(log) {
 const classes=[
  ['artifact_download',/Unable to (?:download|prepare).*artifact|Unable to download the slim-services archive/i],
  ['dns',/EAI_AGAIN|ENOTFOUND/],['ownership',/chown exited|PostgreSQL cannot be run as root/],
  ['permission',/EACCES|EPERM|permission denied/i],['port_busy',/EADDRINUSE|address already in use/i],
  ['disk_full',/ENOSPC|no space left/i],['migration',/migration.*(?:fail|error)|(?:fail|error).*migration/i],
  ['deadline',/TimeoutError|timed out|deadline exceeded/i],
 ].filter(([,pattern])=>pattern.test(log)).map(([name])=>name);
 return {classes:classes.length?classes:['unclassified']};
}
