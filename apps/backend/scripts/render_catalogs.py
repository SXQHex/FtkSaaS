import json,sys
from pathlib import Path

def emit(path,content):
 content=content.rstrip()+'\n';f=Path(path)
 if '--check' in sys.argv: assert f.read_text()==content,'Generated catalog drift: '+path
 else: f.write_text(content)
p=json.loads(Path('../../packages/api-contracts/schema/contract.json').read_text());c=p['x-contract'];d=p['$defs']
names=set(json.loads(Path('supabase/functions/backend-v1/implemented.json').read_text())['operations'])
def typ(s):
 if '$ref' in s:return s['$ref'].split('/')[-1]
 if 'anyOf' in s:return ' ∣ '.join(typ(x) for x in s['anyOf'])
 if s.get('type')=='array':return typ(s['items'])+'[]'
 if 'const' in s:return str(s['const'])
 if 'enum' in s:return ' / '.join(map(str,s['enum']))
 return ' ∣ '.join(s['type']) if isinstance(s.get('type'),list) else s.get('type','schema')
def fields(s):return '; '.join(k+('' if k in s.get('required',[]) else '?')+': '+typ(v) for k,v in s.get('properties',{}).items())
def cell(v):return str(v).replace('|','∣').replace('\n',' ')
def worker(o):return o['permission']=='system.worker' or o.get('actor_source')=='server_worker_claim'

schema=['# Domain şema referansı','',
 'Üretilmiştir: `packages/api-contracts/schema/contract.json` → `render_catalogs.py`. Elle düzenleme. Bu görünüm domain alanlarını anlatır; bütün fiziksel/private tabloların nihai DDL dökümü değildir. Kesin DDL [migration zinciri](../database.md), transaction tasarımı [fiziksel değişmezler](../../apps/backend/docs/physical-invariants.md), normatif davranış [teknik sözleşme](02-FtkSaaS-teknik-sozlesme.md) sahibindedir.',
 '',f"Makine sözleşmesinde {len(c['tables'])} domain tablo tanımı. PostgreSQL tür/constraint/owner/ACL karşılığı migration ve kaynak bağlı CD metadata artifact’ından okunur; bu katalog hosted kabulü değildir.",
 '', '| Tablo | Scope | Alanlar | Kural |','|---|---|---|---|']
for t in c['tables']:schema.append('| `'+t['name']+'` | '+t['scope']+' | '+cell(fields(d['Table_'+t['name']]))+' | '+cell(t.get('invariants',''))+' |')
emit('../../docs/contracts/04-FtkSaaS-O4-veri-semasi.md','\n'.join(schema))

api=['# API sözleşmesi referansı','',
 'Üretilmiştir: `packages/api-contracts/schema/contract.json` ve `implemented.json` → `render_catalogs.py`. Elle düzenleme. DTO/enum/izin için makine sözleşmesi tek kaynaktır; çağrı sırası [WF rehberi](../workflows.md), transport [istemci protokolü](../client-integration.md) sahibindedir.',
 '',f"{len(c['operations'])} sözleşme operasyonu; {len(names)} kaynak envanterinde, {len(c['operations'])-len(names)} contract-only. Kaynakta bulunmak tüm selector/provider/özellik veya hosted kabulünün tamamlandığını göstermez. Backend-only worker işlemleri tarayıcı çağrısı değildir.",
 '', '| İşlem | Kaynak durumu / tüketici | İzin | Tür / abonelik | İstek | Yanıt |','|---|---|---|---|---|---|']
for o in c['operations']:
 state=('runtime' if o['name'] in names else 'contract_only')+(' / backend-only' if worker(o) else ' / ilgili WF’yi oku')
 api.append('| `'+o['name']+'` | '+state+' | `'+o['permission']+'` | '+o['transport']+' / '+o['billing_class']+' | '+cell(fields(d[o['request']['$ref'].split('/')[-1]]))+' | '+o['success']['$ref'].split('/')[-1]+' |')
api+=['','## Sürüm ve okuma desteği','','`read_path_status` bir operasyonun read endpoint’inin bulunmasına ek olarak ilgili management selector’ını da denetler. Contract-only okuma yolu için endpoint varlığından destek türetilmez. Atomik etkiler sözleşme tanımıdır; çalıştırılmış CI kanıtı değildir.','','| İşlem | Faz | Sürüm | Okuma | Okuma desteği | Atomik etkiler |','|---|---|---|---|---|---|']
for o in c['operations']:
 k=o['operation_contract']
 api.append('| '+o['name']+' | '+k['kind']+' | '+k['version_mode']+' | '+str(k['read_operation'])+' | '+(k.get('read_path_status') or 'uygulanmaz')+' | '+cell(', '.join(k['atomic_effects']))+' |')
api+=['','## Sunucunun hesaplaşma yetki bağlamı','','Aşağıdaki alanlar makine sözleşmesinin üretilmiş görünümüdür. Tek normatif [hesaplaşma kararı](02-FtkSaaS-teknik-sozlesme.md#hesaplasma) geçerlidir.','','| İşlem | Merkez kaynağı | İzin | Farklı hesap şartı | Audit kapsamı |','|---|---|---|---|---|']
for o in c['operations']:
 if 'authority_binding' in o:
  b=o['authority_binding'];api.append('| '+o['name']+' | '+b['center']+' | '+b['permission']+' | '+str(b['require_distinct_account'])+' | '+', '.join(b['audit_scope_fields'])+' |')
emit('../../docs/contracts/05-FtkSaaS-O4-API-katalogu.md','\n'.join(api))

inventory={'runtime_version':c['runtime']['version'],'operations':[{'name':o['name'],'status':o['implementation_status'],'external_path':'/functions/v1/backend-v1/'+o['name'] if o['name'] in names and not worker(o) else None,'permission':o['permission'],'features':o['features'],'required_features':o['required_features'],'runtime_required_features':o['runtime_required_features'],'decision_delivery':o['decision_delivery'],'billing_class':o['billing_class'],'limits':o.get('runtime_limits',[])} for o in c['operations']]}
for source,entry in zip(c['operations'],inventory['operations']):
 if 'authority_binding' in source:entry['authority_binding']=source['authority_binding']
emit('../../docs/endpoint-inventory.json',json.dumps(inventory,ensure_ascii=False,indent=2))

feature_doc=['# F01–F33 kaynak ve kabul haritası','',
 'Üretilmiştir: makine sözleşmesi ve `implemented.json` → `render_catalogs.py`. API sayıları güncel kaynaktan hesaplanır. Bir özelliğin bütün ekran/selector/provider/ortam kabulleri bu sayımdan çıkmaz. Ürün plan erişimi [01](contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), açık işler [backend backlog](../apps/backend/docs/remaining-work.md), çalıştırılmış kaynak/CI/ortam kanıtı [güncel kabul](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) sahibindedir.',
 '', '| Özellik | Plan erişimi | Teknik API karşılığı | Kaynakta / contract-only | Tam özellik kabulü |','|---|---|---|---|---|']
for fid,row in c['feature_delivery'].items():
 ops=row['technical_operations'];implemented=sum(n in names for n in ops)
 feature_doc.append('| '+fid+' '+row['name']+' | '+', '.join(k for k,v in row['plans'].items() if v)+' | '+', '.join(ops)+' | '+str(implemented)+' / '+str(len(ops)-implemented)+' | '+row['acceptance']+' |')
feature_doc+=['','## DS gerçek davranış vakaları','','Durum makine sözleşmesindeki vaka kaydından gelir; test referansı yeni head’de çalıştırılmış sonuç değildir. Yapısal test veya bu tablo gerçek Auth→Edge→RPC davranış kabulü yerine kullanılamaz.','','| Vaka | Beklenen davranış | Kayıtlı durum | Test kaynağı |','|---|---|---|---|']
for v in c['decision_sprint']['acceptance_cases']:
 feature_doc.append('| '+v['id']+' | '+cell(v['expected_flow'])+' | '+v['status']+' | '+cell(', '.join(v.get('evidence',[])))+' |')
emit('../../docs/feature-delivery.md','\n'.join(feature_doc))
print('Current schema/API/feature views and endpoint inventory generated')
