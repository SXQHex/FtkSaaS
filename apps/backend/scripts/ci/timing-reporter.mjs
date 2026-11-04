// Test names and durations only; no error messages, payloads or credentials.
export default async function* report(events){
 for await(const {type,data} of events){
  if(!['test:pass','test:fail'].includes(type))continue;
  yield JSON.stringify({type,name:data.name,file:data.file,nesting:data.nesting,duration_ms:data.details?.duration_ms,failure_type:data.details?.error?.failureType})+'\n';
 }
}
