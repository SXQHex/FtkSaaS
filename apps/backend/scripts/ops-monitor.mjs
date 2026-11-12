// Operator-only observations. This module neither reads tenant payloads nor sends
// mail. The caller must durably persist state/events before acknowledging a cycle.
const lanes=['p01','p05','p06','p07','p07_privacy'];
const keys=['availability',...lanes.map(lane=>'worker:'+lane),'worker:invitation','jobs:stuck','jobs:exhausted','jobs:integrity','backup'];
const validIncident=incident=>{
 const reason=incident.key==='availability'?['unavailable']:incident.key.startsWith('worker:')?['stale','claim_error','job_error']:incident.key==='backup'?['failed','missing','old','unavailable']:[incident.key.slice(5)];
 return reason.includes(incident.reason)&&incident.severity===(incident.key==='jobs:integrity'?'critical':'error');
};
const invalid=()=>{throw new Error('INVALID_MONITOR_OBSERVATION_OR_STATE');};
const timestamp=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))invalid();
 return Date.parse(value);
};
const count=value=>{if(!Number.isSafeInteger(value)||value<0)invalid();return value;};

export function validateMonitorEvent(event){
 if(!event||!['alarm','recovery','disabled','acknowledged'].includes(event.kind)||!keys.includes(event.key)||!validIncident(event)||(event.kind==='disabled'&&!event.key.startsWith('worker:'))||(event.kind==='acknowledged'&&!['jobs:exhausted','jobs:integrity'].includes(event.key))||timestamp(event.openedAt)>timestamp(event.checkedAt))invalid();
 const projected={kind:event.kind,key:event.key,reason:event.reason,severity:event.severity,openedAt:event.openedAt,checkedAt:event.checkedAt};
 if(JSON.stringify(event)!==JSON.stringify(projected))invalid();
 return projected;
}

export function evaluateMonitor(previous,observation){
 if(!observation||typeof observation.serviceAvailable!=='boolean')invalid();
 if(observation.telemetryAvailable!==undefined&&typeof observation.telemetryAvailable!=='boolean')invalid();
 const now=timestamp(observation.checkedAt),at=new Date(now).toISOString();
 const prior=previous??{format:1,checkedAt:null,lastProbeAt:null,availabilityFailures:0,active:[]};
 if(prior.format!==1||!Array.isArray(prior.active)||!Number.isSafeInteger(prior.availabilityFailures)||prior.availabilityFailures<0||prior.availabilityFailures>2)invalid();
 if(prior.checkedAt!==null&&timestamp(prior.checkedAt)>now)throw new Error('MONITOR_CLOCK_REVERSED');
 if(prior.lastProbeAt!==null&&(timestamp(prior.lastProbeAt)>now||prior.checkedAt===null||timestamp(prior.lastProbeAt)>timestamp(prior.checkedAt)))invalid();
 if(prior.availabilityFailures>0&&prior.lastProbeAt===null)invalid();
 const old=new Map();
 for(const incident of prior.active){
  if(!incident||!keys.includes(incident.key)||old.has(incident.key)||!validIncident(incident)||prior.checkedAt===null||timestamp(incident.openedAt)>timestamp(prior.checkedAt))invalid();
  old.set(incident.key,{key:incident.key,reason:incident.reason,severity:incident.severity,openedAt:incident.openedAt});
 }
 if(old.has('availability')!==(prior.availabilityFailures===2))invalid();
 const active=[],events=[],disabled=new Set();
 const flags=name=>{
  const values=observation[name]??[];
  if(!Array.isArray(values)||new Set(values).size!==values.length||values.some(value=>!['exhausted','integrity'].includes(value)))invalid();
  return new Set(values.map(value=>'jobs:'+value));
 };
 const acknowledged=flags('acknowledgedJobs'),fresh=flags('newJobIncidents');
 const alarm=(key,reason,severity='error')=>{
  const incident={key,reason,severity,openedAt:old.get(key)?.openedAt??at};active.push(incident);
  if(!old.has(key)||fresh.has(key))events.push({kind:'alarm',...incident,checkedAt:at});
 };
 let lastProbeAt=prior.lastProbeAt,availabilityFailures=prior.availabilityFailures;
 // Technical contract: five-minute probes, two consecutive failures. Extra
 // observations cannot turn a repeated request into a second failed probe.
 if(observation.serviceAvailable){availabilityFailures=0;lastProbeAt=at;}
 else if(availabilityFailures===0||lastProbeAt===null||now-timestamp(lastProbeAt)>=300000){availabilityFailures=Math.min(2,availabilityFailures+1);lastProbeAt=at;}
 if(availabilityFailures>=2)alarm('availability','unavailable');

 const telemetryMissing=observation.telemetryAvailable===false;
 if(telemetryMissing){
  if(observation.serviceAvailable||observation.workers!==null||observation.jobs!==null||acknowledged.size||fresh.size)invalid();
  for(const incident of old.values())if(incident.key.startsWith('worker:')||incident.key.startsWith('jobs:'))active.push({...incident});
 }
 if(!telemetryMissing&&(!Array.isArray(observation.workers)||observation.workers.length!==lanes.length))invalid();
 const inspectHealth=(worker,key)=>{
  if(!worker||typeof worker.enabled!=='boolean'||!['not_started','running','idle','succeeded','claim_error','job_error'].includes(worker.lastStatus))invalid();
  const finished=worker.lastFinishedAt===null?null:timestamp(worker.lastFinishedAt);
  if(finished!==null&&finished>now)invalid();
  if(!worker.enabled){disabled.add(key);return;}
  // Matches ops-cron-health.sql: disabled first, then stale, then last error.
  if(finished===null||now-finished>120000)alarm(key,'stale');
  else if(['claim_error','job_error'].includes(worker.lastStatus))alarm(key,worker.lastStatus);
 };
 const seen=new Set();
 for(const worker of observation.workers??[]){
  if(!worker||!lanes.includes(worker.lane)||seen.has(worker.lane))invalid();seen.add(worker.lane);inspectHealth(worker,'worker:'+worker.lane);
 }
 if(!telemetryMissing){
  if(observation.deliveryWorker)inspectHealth(observation.deliveryWorker,'worker:invitation');
  else if(old.has('worker:invitation'))active.push({...old.get('worker:invitation')});
 }
 if(!telemetryMissing){
  if(!observation.jobs)invalid();
  for(const kind of ['stuck','exhausted','integrity']){
   const amount=count(observation.jobs[kind]),key='jobs:'+kind;
   if((acknowledged.has(key)&&amount!==0)||(fresh.has(key)&&amount===0))invalid();
   if(amount>0)alarm(key,kind,kind==='integrity'?'critical':'error');
  }
 }
 const backup=observation.backup;
 if(!backup||!['usable','failed','missing','unavailable'].includes(backup.state))invalid();
 const usable=backup.usableAt===null?null:timestamp(backup.usableAt);
 if(usable!==null&&usable>now)invalid();
 if(backup.state==='usable'&&usable===null)invalid();
 if(backup.state!=='usable')alarm('backup',backup.state);
 else if(now-usable>86400000)alarm('backup','old');
 const current=new Set(active.map(incident=>incident.key));
 for(const incident of old.values())if(!current.has(incident.key))events.push({kind:disabled.has(incident.key)?'disabled':acknowledged.has(incident.key)?'acknowledged':'recovery',...incident,checkedAt:at});
 return {state:{format:1,checkedAt:at,lastProbeAt,availabilityFailures,active},events};
}
