import {createHash} from 'node:crypto';
const kinds=['exhausted','integrity'];
const digest=/^[a-f0-9]{64}$/;
const fail=code=>{throw new Error(code);};
function keyList(value){
 if(!Array.isArray(value)||value.some(key=>typeof key!=='string'||!digest.test(key))||new Set(value).size!==value.length)fail('INVALID_MONITOR_INCIDENT_KEYS');
 return [...value].sort();
}
function evidence(observation){
 if(observation.telemetryAvailable===false||!observation.incidents||!observation.jobs)fail('MONITOR_INCIDENT_EVIDENCE_REQUIRED');
 const result={};
 for(const kind of kinds){
  const value=observation.incidents[kind];
  if(!value||!Number.isSafeInteger(value.total)||value.total<0||value.total!==observation.jobs[kind])fail('INVALID_MONITOR_INCIDENT_COUNTS');
  const keys=keyList(value.keys);
  if(keys.length>1000||keys.length>value.total)fail('INVALID_MONITOR_INCIDENT_COUNTS');
  result[kind]={keys,total:value.total};
 }
 return result;
}
export function monitorReviewToken(observation){
 return createHash('sha256').update(JSON.stringify(evidence(observation))).digest('hex');
}

// Only the private operator process can supply an acknowledgment. Neither job
// rows nor immutable integrity evidence are changed; acknowledgment is not repair.
export function prepareMonitorObservation(state,observation,acknowledge,now){
 state.acknowledgments??=[];
 if(!Array.isArray(state.acknowledgments))fail('INVALID_MONITOR_ACK_HISTORY');
 const acknowledged={exhausted:new Set(),integrity:new Set()};let last=-Infinity;
 for(const record of state.acknowledgments){
  const at=typeof record?.at==='string'?Date.parse(record.at):NaN;
  if(!Number.isFinite(at)||at>now||at<last||typeof record.snapshot!=='string'||!digest.test(record.snapshot))fail('INVALID_MONITOR_ACK_HISTORY');last=at;
  let size=0;
  for(const kind of kinds)for(const key of keyList(record[kind])){
   if(acknowledged[kind].has(key))fail('INVALID_MONITOR_ACK_HISTORY');acknowledged[kind].add(key);size++;
  }
  if(!size)fail('INVALID_MONITOR_ACK_HISTORY');
 }
 const projected={...observation,acknowledgedJobs:[],newJobIncidents:[]};
 if(observation.telemetryAvailable===false){if(acknowledge)fail('MONITOR_INCIDENT_EVIDENCE_REQUIRED');return projected;}
 if(!observation.incidents){
  if(acknowledge||state.acknowledgments.length||state.seenIncidents)fail('MONITOR_INCIDENT_EVIDENCE_REQUIRED');
  return projected;
 }
 const current=evidence(observation),prior=state.seenIncidents??{exhausted:{keys:[],total:0},integrity:{keys:[],total:0}};
 for(const kind of kinds){
  if(!prior[kind]||!Number.isSafeInteger(prior[kind].total)||prior[kind].total<0||keyList(prior[kind].keys).length>prior[kind].total)fail('INVALID_MONITOR_INCIDENT_HISTORY');
 }
 if(acknowledge){
  if(Object.keys(acknowledge).some(key=>!['expectedSnapshot',...kinds].includes(key)))fail('INVALID_MONITOR_ACK_REQUEST');
  const snapshot=monitorReviewToken(observation);
  if(acknowledge.expectedSnapshot!==snapshot)fail('MONITOR_REVIEW_STALE');
  const record={at:new Date(now).toISOString(),snapshot,exhausted:[],integrity:[]};let selected=0;
  for(const kind of kinds){
   const known=new Set(current[kind].keys);
   for(const key of keyList(acknowledge[kind])){
    selected++;if(!known.has(key))fail('UNKNOWN_MONITOR_INCIDENT');
    if(!acknowledged[kind].has(key)){record[kind].push(key);acknowledged[kind].add(key);}
   }
  }
  if(!selected)fail('MONITOR_ACK_EMPTY');
  if(record.exhausted.length||record.integrity.length)state.acknowledgments.push(record);
 }
 projected.jobs={...observation.jobs};
 for(const kind of kinds){
  const item=current[kind],seen=new Set(prior[kind].keys);
  // A bounded page can never acknowledge unseen rows or turn truncation green.
  const remaining=item.total-item.keys.filter(key=>acknowledged[kind].has(key)).length;
  projected.jobs[kind]=remaining;
  if(item.total>0&&remaining===0)projected.acknowledgedJobs.push(kind);
  if(remaining>0&&(item.total>prior[kind].total||item.keys.some(key=>!acknowledged[kind].has(key)&&!seen.has(key))))projected.newJobIncidents.push(kind);
 }
 state.seenIncidents=current;
 return projected;
}
