from pathlib import Path
import hashlib,json
expected=json.loads(Path('database/migrations.sha256.json').read_text())
actual={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path('supabase/migrations').glob('*.sql'))}
assert actual==expected,'Migration history changed: append a new migration and explicitly update the review manifest.'
parts=[]
for name in ['runtime.sql','kernel.sql','dispatch.sql','wrappers.sql']:
 s=Path('database',name).read_text();parts.append('\n'.join(l for l in s.splitlines() if l.strip() not in ['begin;','commit;']))
expected_runtime='-- FtkSaaS authenticated runtime v0.2.0-rc.1; backend-generated UUIDv7.\nbegin;\n'+'\n'.join(parts)+'\ncommit;\n'
assert next(Path('supabase/migrations').glob('*_runtime_foundation.sql')).read_text()==expected_runtime,'Runtime source and frozen migration differ'
print('Frozen migration history and runtime source agree:',len(actual),'migrations')

assert next(Path('supabase/migrations').glob('*_runtime_read_projection.sql')).read_text()==Path('database/runtime-read-projection.sql').read_text(),'Read projection migration source drift'

qe_parts=['event-payment-schema.sql','event-payment-functions.sql','event-payment-dispatch.sql','runtime-wrappers.sql']
qe_sql='-- Q-E01 accepted payment preparation and financial cancellation.\nbegin;\n'+'\n'.join('\n'.join(x for x in Path('database',n).read_text().splitlines() if x.strip() not in ['begin;','commit;']) for n in qe_parts)+'\ncommit;\n'
assert next(Path('supabase/migrations').glob('*_event_payment_finance.sql')).read_text()==qe_sql,'Q-E01 migration source drift'

assert next(Path('supabase/migrations').glob('*_event_operator_cancellation.sql')).read_text()=="-- Q-E02 final center cancellation acceptance; prior seven migrations remain immutable.\nbegin;\n"+Path('database/event-cancellation-dispatch.sql').read_text()+"\ncommit;\n",'Q-E02 migration source drift'
