from pathlib import Path
import json,hashlib,re,subprocess,time
p=Path('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json')
c=json.loads(p.read_text());d=c['$defs'];x=c['x-contract']
names=['finance_get_v1','collection_correct_preview_v1','collection_correct_apply_v1','sale_refund_preview_v1','sale_refund_apply_v1','instructor_payment_record_v1','instructor_payment_correct_v1']
ref=lambda n:{'$ref':'#/$defs/'+n}
nullable=lambda n:{'anyOf':[ref(n),{'type':'null'}]}
for o in x['operations']:
 if o['name'] not in names:continue
 o['implementation_status']='operational_development_limited'
 o['runtime_required_features']=o['required_features']
 o['decision_delivery']['runtime_conformance']='p03_implemented_acceptance_pending'
 o['runtime_notes']='P03 source implementation; runtime acceptance, candidate and main are tracked separately in docs/production-queue.md.'
 k=o['operation_contract']
 if o['name']=='sale_refund_preview_v1':k['read_operation']='entitlements_get_v1'
 elif o['name']=='collection_correct_preview_v1':k['read_operation']='finance_get_v1'
 elif o['name'].startswith('instructor_payment_'):k['read_operation']='earnings_list_v1'
 if k['kind']!='read':k['read_path_status']='implemented'
if 'correction_subtract' not in d['StudentCreditMove']['enum']:d['StudentCreditMove']['enum'].append('correction_subtract')
d['DebtSummary']['properties'].update({'center_id':ref('FtkUuid'),'version':ref('PositiveInt'),'net_minor':ref('Money'),'paid_minor':ref('Money'),'claimed_minor':ref('Money')})
d['CashSummary']['properties'].update({'center_id':ref('FtkUuid'),'version':ref('PositiveInt'),'previous_id':nullable('FtkUuid')})
d['P03PaymentCorrectionView']={'type':'object','properties':{'id':ref('FtkUuid'),'previous_id':ref('FtkUuid'),'direction':ref('Direction'),'amount_minor':ref('Money'),'occurred_at':ref('Instant'),'reason':ref('Text')},'required':['id','previous_id','direction','amount_minor','occurred_at','reason'],'additionalProperties':False}
d['P03PaymentView']={'type':'object','properties':{'id':ref('FtkUuid'),'version':ref('PositiveInt'),'amount_minor':ref('Money'),'net_minor':ref('Money'),'currency':ref('Currency'),'occurred_at':ref('Instant'),'corrections':{'type':'array','items':ref('P03PaymentCorrectionView')}},'required':['id','version','amount_minor','net_minor','currency','occurred_at','corrections'],'additionalProperties':False}
d['SignedMoney']={'type':'string','pattern':'^(0|-?[1-9][0-9]{0,18})$','x-validation':'-9223372036854775808<=int(value)<=9223372036854775807'}
d['Table_debt_allocations']['properties']['amount_minor']=ref('SignedMoney')
d['Table_earning_allocations']['properties']['amount_minor']=ref('SignedMoney')
d['EarningView']['properties'].update({'overpaid_minor':ref('Money'),'payments':{'type':'array','items':ref('P03PaymentView')}})
d['Table_instructor_payments']['properties'].update({'previous_id':nullable('FtkUuid'),'operation_id':nullable('FtkUuid'),'direction':ref('Direction')})
d['Table_earning_allocations']['properties']['previous_id']=nullable('FtkUuid')
for name,column,target in [('instructor_payments','previous_id','instructor_payments'),('instructor_payments','operation_id','operation_receipts'),('earning_allocations','previous_id','earning_allocations')]:
 table=next(t for t in x['tables'] if t['name']==name)
 if not any(f['column']==column for f in table['foreign_keys']):table['foreign_keys'].append({'column':column,'target':target,'same_tenant':True})
if 'direction' not in d['Table_instructor_payments']['required']:d['Table_instructor_payments']['required'].append('direction')
live=json.loads(Path('supabase/functions/backend-v1/implemented.json').read_text())['operations']
live=list(dict.fromkeys(live+names))
for row in x['feature_delivery'].values():
 if not set(row['technical_operations']).intersection(names):continue
 row['implemented_operations']=[n for n in row['technical_operations'] if n in live]
 row['contract_only_operations']=[n for n in row['technical_operations'] if n not in live]
 row['implementation']='implemented_acceptance_pending' if not row['contract_only_operations'] else ('partial' if row['implemented_operations'] else 'contract_only')
for o in x['operations']:
 k=o['operation_contract']
 if k['kind'] not in ['read','auth','worker'] and k.get('read_operation') in names:k['read_path_status']='implemented'
x['decision_sprint']['new_contract_only_operations']=[n for n in x['decision_sprint']['new_contract_only_operations'] if n not in names]
paths=[]
def walk(v,path=''):
 if isinstance(v,dict):
  if v.get('$ref') in {'#/$defs/FtkUuid','#/$defs/ProviderUuid','#/$defs/FtkGeneratedUuidV7'}:paths.append(('#/$defs'+path,v['$ref']))
  for k,a in v.items():walk(a,path+'/'+k)
 elif isinstance(v,list):
  for k,a in enumerate(v):walk(a,path+'/'+str(k))
walk(d)
old={a['path']:a for a in x['uuid_field_map']}
x['uuid_field_map']=[old.get(path,{'path':path,'origin':'provider' if r=='#/$defs/ProviderUuid' else 'ftksaas','acceptance':'generic_uuid','generation':'external' if r=='#/$defs/ProviderUuid' else 'uuidv7'}) for path,r in paths]
p.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
Path('supabase/functions/backend-v1/implemented.json').write_text(json.dumps({'operations':live},indent=2)+'\n')
wr=['begin;']
for o in x['operations']:
 if o['name'] not in names:continue
 name=o['name'];features=','.join("'"+f+"'" for f in o['runtime_required_features'])
 wr.extend([
 f"insert into private.runtime_operations(name,permission,billing_class,features) values('{name}','{o['permission']}','{o['billing_class']}',array[{features}]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;",
 f"create or replace function api_v1.{name}(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('{name}',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;",
 f"revoke all on function api_v1.{name}(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;",
 f"grant execute on function api_v1.{name}(jsonb,uuid,uuid,uuid[],jsonb) to service_role;"])
wr.extend(["notify pgrst,'reload schema';",'commit;'])
Path('database/p03-finance-payments-wrappers.sql').write_text('\n'.join(wr)+'\n')
sources=[
 ('p03_finance_payments','database/p03-finance-payments.sql','database/p03-finance-payments-wrappers.sql'),
 ('p03_finance_guardrails','database/p03-finance-guardrails.sql',None),
 ('p03_finance_acceptance','database/p03-finance-acceptance.sql',None),
 ('p03_finance_scope','database/p03-finance-scope.sql',None),
 ('p03_finance_balances','database/p03-finance-balances.sql',None),
 ('p03_finance_results','database/p03-finance-results.sql',None),
 ('p03_finance_integrity','database/p03-finance-integrity.sql',None),
 ('p03_finance_provenance','database/p03-finance-provenance.sql',None)]
checks=Path('scripts/check-migrations.py').read_text()
for suffix,source,wrapper in sources:
 content=Path(source).read_text()+(Path(wrapper).read_text() if wrapper else '')
 found=list(Path('supabase/migrations').glob('*_'+suffix+'.sql'))
 if not found:
  time.sleep(1.1)
  subprocess.run(['node_modules/.bin/supabase','migration','new',suffix],check=True)
  found=list(Path('supabase/migrations').glob('*_'+suffix+'.sql'))
 assert len(found)==1
 if found[0].stat().st_size:assert found[0].read_text()==content,'FROZEN_P03_MIGRATION_DRIFT '+str(found[0])
 else:found[0].write_text(content)
 line="\nassert next(Path('supabase/migrations').glob('*_"+suffix+".sql')).read_text()==Path('"+source+"').read_text()"+("+Path('"+wrapper+"').read_text()" if wrapper else "")+",'P03 source drift "+suffix+"'\n"
 if line not in checks:checks+=line
Path('scripts/check-migrations.py').write_text(checks)
migrations=sorted(Path('supabase/migrations').glob('*.sql'))
assert len({p.name.split('_')[0] for p in migrations})==len(migrations),'Duplicate migration version'
Path('database/migrations.sha256.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in migrations},indent=2)+'\n')
print('P03 earning fixture contract',json.dumps(d['EarningBasis']))
print('P03 FK metadata shape',json.dumps(next(t for t in x['tables'] if t['name']=='instructor_payments')['foreign_keys'][:2]))
note=f"P03 ilk uygulama dilimi:7 API uygulandı; dal envanteri199/140 runtime/59 contract_only,{len(migrations)} migration. Tahsilat düzeltmesi ve eğitmen ödemesi geçmişi silmeden bağlı fark hareketi kullanır. Paket iadesi satışta sabit yöntemle borç indirimi ve öğrenci alacağıdır; nakit/hak işlemi değildir. P02/P03 önceki hesaplaşması tekrar üretilmez. Hedefli runtime, bağımsız son inceleme ve aday/main kabulü açık; Draft/development PR30 korunur.\n\n"
for name in ['AGENTS.md','docs/production-queue.md','docs/remaining-work.md','docs/claude-handover.md','contracts/00-FtkSaaS-yeni-sohbet-devir.md','docs/source-index.md']:
 p=Path(name);s=p.read_text()
 s=re.sub(r'^P03 ilk uygulama dilimi:.*?\n\n','',s,flags=re.M|re.S)
 at=s.index('\n\n')+2;s=s[:at]+note+s[at:];p.write_text(s)
p=Path('docs/production-queue.md');s=p.read_text().replace('7 API uygulaması ve hedefli kabul açık','7 API uygulandı;hedefli runtime/son inceleme/aday-main kabulü açık');p.write_text(s)
p=Path('contracts/02-FtkSaaS-teknik-sozlesme.md');s=p.read_text().split('\n## P03 uygulama aktarımı')[0]
s=s.replace('PR #28 Draft/development içinde15 API uygulama adayıdır; hedefli/aday/main kabulü ayrı beklenir.','P02 PR #28 main cc4878d kaynağında15 API ve aynı main39461804543 kabulüyle tamamlandı.')
s+='\n## P03 uygulama aktarımı — kabul bekliyor\n\n'+note
s+='CashCorrection.amount_minor yeni toplam değil, direction yönünde açık farktır. Artış özgün tahsilat borç kapsamını korur; azalış kaynak alacağı/dağıtımlarını bağlı hareketle geri alır. Harcanmış alacak silinemez. Kalan borç=max(0,net−gross_paid+claimed); alacağa taşınmış ödeme ikinci kez borç ödeme sayılmaz. Alacak geri alımı ilgili allocation azalışını aşamaz. Ters tahsisler her pozitif kaynak satırının açık kalanına kadar deterministic bölünür; previous_id tam o kaynağı gösterir. Ters debt/earning allocation SignedMoney, API bakiye toplamları nonnegative Money kalır. Tam finans geçmişi orgreader/CM/self kapsamındadır; finance.collect personel grantı tam geçmiş vermez. Paket iadesi nakit/hak/rezervasyon işlemi değildir; önizlemede borç ve öğrenci alacağı ayrı gösterilir. Eğitmen correction sonucu kök payment ID ve aggregate version döndürür; yeni fact related içindedir. Önceki fact kayıtları immutable kalır.\n'
p.write_text(s)
p=Path('docs/p02-handover.md');s=p.read_text()
mark='P02 kapanış: PR28 main cc4878d09e45204dbc13ccfe1324b38b14548167 ve aynı main39461804543 completed/success ile done;469 test,40 migration. Aşağıdaki geliştirme kaynaklarının pending notları tarihsel snapshot’tır. Güncel P03 değişiklikleri ve kabulü üretim kuyruğunda ayrı izlenir.\n\n'
if mark not in s:
 at=s.index('\n\n')+2;p.write_text(s[:at]+mark+s[at:])

p=Path('docs/remaining-work.md');s=p.read_text()
start=s.index('## Yalnız sözleşme envanteri')
end=s.index('## Operasyonel kabul işleri',start)
pending=[o for o in x['operations'] if o['name'] not in live]
section='## Yalnız sözleşme envanteri — dalda '+str(len(pending))+' işlem\n\nKabul edilmiş main P02 kaynağında133 runtime/66 contract_only kalır. P03 dalında7 API uygulandı,140 runtime/59 contract_only; hedefli/aday/main kabulü ayrıdır. P04–P07 toplam59 işlem uygulama bekler.\n\n| Teslim | Kalan işlem |\n|---|---:|\n| P04 | 11 |\n| P05 | 13 |\n| P06 | 13 |\n| P07 | 22 |\n\n| İşlem | İzin |\n|---|---|\n'
section+=''.join('| '+o['name']+' | '+o['permission']+' |\n' for o in pending)+'\n'
s=s[:start]+section+s[end:]
s=s.replace('P03–P07 toplam66 contract_only işlem sırada.','P03 dalında7 API uygulandı; hedefli/aday/main kabulü açık. P04–P07 toplam59 contract_only işlem sırada.')
s=s.replace('Ödeme komutları açık.','P03 ödeme komutları dalda uygulandı; runtime ve aday/main kabulü ayrı bekler.')
s=s.replace('P03 finans düzeltme/iade çiftleri açık.','P03 finans düzeltme/iade çiftleri dalda uygulandı; hedefli/aday/main kabulü açık.')
p.write_text(s)

p=Path('docs/source-index.md');s=p.read_text()
link='[P03 çalışma devri](p03-handover.md): finans/iade/eğitmen ödeme kapsamı ve son kabul sırası.\n\n'
if link not in s:s=s.replace('## Okuma sırası ve roller',link+'## Okuma sırası ve roller')
p.write_text(s)
