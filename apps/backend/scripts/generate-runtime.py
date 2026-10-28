"""Derive the minimal Edge contract and SQL entrypoints from authoritative operations."""
from pathlib import Path
import json,sys
p=json.loads(Path('../../packages/api-contracts/schema/contract.json').read_text())
names=json.loads(Path('supabase/functions/backend-v1/implemented.json').read_text())['operations']
ops=[o for o in p['x-contract']['operations'] if o['name'] in names]
assert len(ops)==len(set(names))
needed=set()
def visit(x):
 if isinstance(x,dict):
  if '$ref' in x:
   n=x['$ref'].split('/')[-1]
   if n not in needed:needed.add(n);visit(p['$defs'][n])
  for v in x.values():visit(v)
 elif isinstance(x,list):
  for v in x:visit(v)
for o in ops:visit(o)
runtime={'$schema':p['$schema'],'$defs':{n:p['$defs'][n] for n in sorted(needed)},'x-contract':{'operations':ops}}
sql=['begin;']
for o in ops:
 def literal(s):return "'"+s.replace("'","''")+"'"
 sql.append("insert into private.runtime_operations(name,permission,billing_class,features) values("+','.join([literal(o['name']),literal(o['permission']),literal(o['billing_class']),"array["+','.join(map(literal,o['runtime_required_features']))+"]::text[]"])+") on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;")
 entry=f"private.p04_public('{o['name']}',p_request,p_ids,p_aux)" if o['name'] in ('public_calendar_get_v1','public_application_submit_v1') else f"private.execute_operation('{o['name']}',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)"
 if o['name']=='calendar_feed_get_v1':entry='private.personal_calendar_feed(p_request,p_ids,p_aux)'
 if o['name']=='account_google_link_prepare_v1':entry='private.account_google_link_prepare(p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)'
 if o['name']=='account_totp_remove_v1':entry='private.account_totp_remove(p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)'
 if o['name']=='account_password_change_v1':entry='private.p07_password_preflight(p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)'
 if o['name']=='account_password_reset_request_v1':entry='private.p07_recovery_gate(p_request,p_ids,p_aux)'
 sql.append(f"create or replace function api_v1.{o['name']}(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select {entry}$$;")
 sql.append(f"revoke all on function api_v1.{o['name']}(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;")
 sql.append(f"grant execute on function api_v1.{o['name']}(jsonb,uuid,uuid,uuid[],jsonb) to service_role;")
sql += ['revoke all on all functions in schema private from public,anon,authenticated;','grant execute on all functions in schema private to service_role;',"notify pgrst,'reload schema';",'commit;']
files={'supabase/functions/backend-v1/contract.json':json.dumps(runtime,separators=(',',':'),ensure_ascii=False),'database/runtime-wrappers-current.sql':'\n'.join(sql)+'\n'}
files['../../packages/api-contracts/src/runtime.ts']='// Generated callable development operations; see endpoint inventory for limits.\nexport const runtimeOperationNames = '+json.dumps(names,indent=2)+' as const;\nexport type RuntimeOperationName = typeof runtimeOperationNames[number];\n'
for name,content in files.items():
 f=Path(name)
 if '--check' in sys.argv:assert f.read_text()==content,'Generated runtime drift: '+name
 else:f.write_text(content)
print(f'Runtime: {len(ops)} entrypoints; {len(needed)} referenced definitions')
