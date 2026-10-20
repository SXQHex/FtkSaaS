from pathlib import Path
import json,hashlib
p=Path('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json');c=json.loads(p.read_text())
names=['finance_get_v1','collection_correct_preview_v1','collection_correct_apply_v1','sale_refund_preview_v1','sale_refund_apply_v1','instructor_payment_record_v1','instructor_payment_correct_v1']
for o in c['x-contract']['operations']:
 if o['name'] in names:
  o['implementation_status']='operational_development_limited'
  o['runtime_required_features']=o['required_features']
  o['decision_delivery']['runtime_conformance']='p03_implemented_acceptance_pending'
  o['runtime_notes']='P03 linked finance implementation; targeted and final source acceptance tracked separately in production-queue.'
  k=o['operation_contract']
  if o['name']=='sale_refund_preview_v1':k['read_operation']='entitlements_get_v1'
  elif o['name']=='collection_correct_preview_v1':k['read_operation']='finance_get_v1'
  elif o['name'].startswith('instructor_payment_'):k['read_operation']='earnings_list_v1'
  if k['kind']!='read':k['read_path_status']='implemented'
d=c['$defs'];ref=lambda n:{'$ref':'#/$defs/'+n};nullable=lambda n:{'anyOf':[ref(n),{'type':'null'}]}
if 'correction_subtract' not in d['StudentCreditMove']['enum']:d['StudentCreditMove']['enum'].append('correction_subtract')
for k,v in {'center_id':ref('FtkUuid'),'version':ref('PositiveInt'),'net_minor':ref('Money'),'paid_minor':ref('Money'),'claimed_minor':ref('Money')}.items():d['DebtSummary']['properties'][k]=v
for k,v in {'center_id':ref('FtkUuid'),'version':ref('PositiveInt'),'previous_id':nullable('FtkUuid')}.items():d['CashSummary']['properties'][k]=v
d['P03PaymentCorrectionView']={'type':'object','properties':{'id':ref('FtkUuid'),'previous_id':ref('FtkUuid'),'direction':ref('Direction'),'amount_minor':ref('Money'),'occurred_at':ref('Instant'),'reason':ref('Text')},'required':['id','previous_id','direction','amount_minor','occurred_at','reason'],'additionalProperties':False}
d['P03PaymentView']={'type':'object','properties':{'id':ref('FtkUuid'),'version':ref('PositiveInt'),'amount_minor':ref('Money'),'net_minor':ref('Money'),'currency':ref('Currency'),'occurred_at':ref('Instant'),'corrections':{'type':'array','items':ref('P03PaymentCorrectionView')}},'required':['id','version','amount_minor','net_minor','currency','occurred_at','corrections'],'additionalProperties':False}
d['EarningView']['properties'].update({'overpaid_minor':ref('Money'),'payments':{'type':'array','items':ref('P03PaymentView')}})
d['Table_instructor_payments']['properties'].update({'previous_id':nullable('FtkUuid'),'operation_id':nullable('FtkUuid'),'direction':ref('Direction')})
d['Table_earning_allocations']['properties']['previous_id']=nullable('FtkUuid')
# A read is now implemented; recompute actual read-path availability without declaring behavior passed.
live=json.loads(Path('supabase/functions/backend-v1/implemented.json').read_text())['operations']
live=list(dict.fromkeys(live+names))
for o in c['x-contract']['operations']:
 k=o['operation_contract']
 if k['kind'] not in ['read','auth','worker'] and k.get('read_operation') in names:k['read_path_status']='implemented'
c['x-contract']['decision_sprint']['new_contract_only_operations']=[n for n in c['x-contract']['decision_sprint']['new_contract_only_operations'] if n not in names]
# Preserve prior classifications and classify new backend-produced/reference UUIDs.
paths=[]
def walk(v,path=''):
 if isinstance(v,dict):
  if v.get('$ref') in {'#/$defs/FtkUuid','#/$defs/ProviderUuid','#/$defs/FtkGeneratedUuidV7'}:paths.append(('#/$defs'+path,v['$ref']))
  for k,x in v.items():walk(x,path+'/'+k)
 elif isinstance(v,list):
  for k,x in enumerate(v):walk(x,path+'/'+str(k))
walk(d)
old={x['path']:x for x in c['x-contract']['uuid_field_map']}
c['x-contract']['uuid_field_map']=[old.get(path,{'path':path,'origin':'provider' if ref_value=='#/$defs/ProviderUuid' else 'ftksaas','acceptance':'generic_uuid','generation':'external' if ref_value=='#/$defs/ProviderUuid' else 'uuidv7'}) for path,ref_value in paths]
assert len(c['x-contract']['uuid_field_map'])==len(paths)
p.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
Path('supabase/functions/backend-v1/implemented.json').write_text(json.dumps({'operations':live},ensure_ascii=False,indent=2)+'\n')
wr=['begin;']
for o in c['x-contract']['operations']:
 if o['name'] not in names:continue
 name=o['name'];features=','.join("'"+f+"'" for f in o['runtime_required_features'])
 wr += [f"insert into private.runtime_operations(name,permission,billing_class,features) values('{name}','{o['permission']}','{o['billing_class']}',array[{features}]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;",
 f"create or replace function api_v1.{name}(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('{name}',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;",
 f"revoke all on function api_v1.{name}(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;",f"grant execute on function api_v1.{name}(jsonb,uuid,uuid,uuid[],jsonb) to service_role;"]
wr+=["notify pgrst,'reload schema';",'commit;']
Path('database/p03-finance-payments-wrappers.sql').write_text('\n'.join(wr)+'\n')
migration=Path('supabase/migrations/20261020200347_p03_finance_payments.sql');migration.write_text(Path('database/p03-finance-payments.sql').read_text()+Path('database/p03-finance-payments-wrappers.sql').read_text())
# Guardrail migration is created by the CLI and frozen on first source commit.
import subprocess
guard_source=Path('database/p03-finance-guardrails.sql')
if guard_source.exists():
 guards=list(Path('supabase/migrations').glob('*_p03_finance_guardrails.sql'))
 if not guards:
  subprocess.run(['node_modules/.bin/supabase','migration','new','p03_finance_guardrails'],check=True)
  guards=list(Path('supabase/migrations').glob('*_p03_finance_guardrails.sql'))
 assert len(guards)==1
 guards[0].write_text(guard_source.read_text())
Path('database/migrations.sha256.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path('supabase/migrations').glob('*.sql'))},indent=2)+'\n')
p=Path('scripts/check-migrations.py');line="\nassert next(Path('supabase/migrations').glob('*_p03_finance_payments.sql')).read_text()==Path('database/p03-finance-payments.sql').read_text()+Path('database/p03-finance-payments-wrappers.sql').read_text(),'P03 finance source drift'\n"
if line not in p.read_text():p.write_text(p.read_text()+line)
note='P03 ilk uygulama dilimi:7 API uygulandı;199/140 runtime/59 contract_only,41 migration. Tahsilat düzeltmesi ve eğitmen ödemesi geçmişi silmeden bağlı fark hareketi kullanır. Paket iadesi satışta sabit yöntemle borç indirimi ve öğrenci alacağıdır; nakit/hak işlemi değildir. P02/P03 önceki hesaplaşması tekrar üretilmez. Hedefli runtime, bağımsız inceleme ve aday/main kabulü açık; Draft/development PR30 korunur.\n\n'
for n in ['docs/production-queue.md','docs/remaining-work.md','docs/claude-handover.md','contracts/00-FtkSaaS-yeni-sohbet-devir.md','docs/source-index.md']:
 p=Path(n);s=p.read_text()
 if note not in s:
  i=s.index('\n\n')+2;s=s[:i]+note+s[i:];p.write_text(s)
p=Path('docs/production-queue.md');s=p.read_text().replace('7 API uygulaması ve hedefli kabul açık','7 API uygulandı;hedefli runtime/son inceleme/aday-main kabulü açık');p.write_text(s)
p=Path('contracts/02-FtkSaaS-teknik-sozlesme.md')
if '## P03 uygulama aktarımı' not in p.read_text():p.write_text(p.read_text()+'\n## P03 uygulama aktarımı — kabul bekliyor\n\n'+note+'CashCorrection.amount_minor yeni toplam değil, direction yönünde açık farktır. Tahsilat artışı özgün borç kapsamını korur; azalış kaynak alacağı ve dağıtımlarını geri alır, harcanmış alacağı silemez. Genel iade hak veya rezervasyonu değiştirmez. Eğitmen düzeltmesi kök ödeme ve earnings_list içindeki güncel payment version ister.\n')

p=Path('scripts/check-migrations.py')
line="\nassert next(Path('supabase/migrations').glob('*_p03_finance_guardrails.sql')).read_text()==Path('database/p03-finance-guardrails.sql').read_text(),'P03 finance guardrails source drift'\n"
if line not in p.read_text():p.write_text(p.read_text()+line)
