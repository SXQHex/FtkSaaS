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
def fields(s):
 def field_type(key,value):
  if value:return typ(value)
  # Closed scope branches carry the validation once; render their real types
  # instead of mistaking the base key allowlist for an untyped payload.
  variants=[typ(branch['properties'][key]) for branch in s.get('oneOf',[]) if key in branch.get('properties',{})]
  return ' ∣ '.join(dict.fromkeys(variants)) if variants else typ(value)
 return '; '.join(k+('' if k in s.get('required',[]) else '?')+': '+field_type(k,v) for k,v in s.get('properties',{}).items())
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

product_scope=Path('../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md').read_text()
delivery_policy=product_scope.split('\n## Genel teslim sırası\n',1)[1].split('\n## ',1)[0].strip()
feature_doc=['# F01–F33 teslim, kaynak ve kabul haritası','',
 'Üretilmiştir: ürün kapsam sözleşmesi, makine sözleşmesi ve `implemented.json` → `render_catalogs.py`. Elle düzenleme. Teslim kararı aşağıda ürün sahibinden aktarılır; API ve DS tabloları makine kaynağının görünümüdür. Bu belge ikinci backlog veya kabul kaydı değildir.',
 '', '## Genel teslim sırası','',
 'Tek normatif kaynak: [ürün kapsam sözleşmesi](contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md#genel-teslim-sırası).','',delivery_policy,
 '', '## Teslim ve kanıt sahipleri','',
 '| Konu | Tek sahibi |','|---|---|',
 '| Ürün kapsamı, plan erişimi ve teslim kararı | [01 ürün sözleşmesi](contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) |',
 '| Backend görevleri ve plan kabul ölçütleri | [Backlog](../apps/backend/docs/remaining-work.md); Pro [G02](../apps/backend/docs/remaining-work.md#g02), Starter [G01](../apps/backend/docs/remaining-work.md#g01), Business [G03](../apps/backend/docs/remaining-work.md#g03) |',
 '| Backend teknik bağımlılık ve paket sırası | [Üretim kuyruğu](../apps/backend/docs/production-queue.md) |',
 '| Frontend bölüm sırası ve gerçek ekran kabulü | [Frontend planı](../apps/web/docs/todo.md) |',
 '| Kaynak, çalıştırılmış CI ve hosted kanıtı | [Backend kabulü](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md); frontend sonucu kendi planındadır |',
 '| Alanlar arası talep ve değerlendirme | [Ortak talepler](requests.md) |',
 '', 'G/S/P/B/R kimlikleri mevcut kayıtlara bağlantıdır; alfabetik veya sayısal sıraları ürün teslim önceliği değildir. Kaynak hazır, test başarılı, merge edilmiş, hosted kabul edilmiş ve bütün ürün teslim edilmiş ayrı sonuçlardır.',
 '', '## F01–F33 API kapsamı','',
 'Plan erişimi sütunu teslim sırası değildir. Bir planın özellik ailesine erişmesi bütün alt işlemleri açmaz: Starter F21 yalnız elle aday/not/takiptir, F25 yalnız temel ders takvimi/başvurusudur. Business genişlemeleri yalnız F18 değildir; ortak özelliklerin merkez/organizasyon davranışları da kendi kabulünü gerektirir. Kesin kapsam [ürün matrisinden](contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md#özellik-ve-plan-matrisi) ve operasyon kapılarından okunur.',
 '', 'API sayıları güncel kaynaktan hesaplanır. Ortak operasyon birden fazla özellikte sayılabilir; satır toplamları benzersiz API sayısı değildir. `Kaynakta` envanterde bulunmayı, `contract-only` yalnız sözleşmede bulunmayı gösterir. `pending_feature_acceptance` makine kaydındaki tam özellik kabulünün açık olduğunu belirtir; tekil kaynak/ekran kabullerini geçersiz kılmaz ve uygulamanın eksik olduğu sonucunu tek başına vermez.',
 '', '| Özellik | Plan erişimi | Teknik API karşılığı | Kaynakta / contract-only | Makinedeki tam özellik kabul kaydı |','|---|---|---|---|---|']
for fid,row in c['feature_delivery'].items():
 ops=row['technical_operations'];implemented=sum(n in names for n in ops)
 feature_doc.append('| '+fid+' '+row['name']+' | '+', '.join(k for k,v in row['plans'].items() if v)+' | '+', '.join(ops)+' | '+str(implemented)+' / '+str(len(ops)-implemented)+' | '+row['acceptance']+' |')
feature_doc+=['','## DS gerçek davranış vakaları','','Durum makine sözleşmesindeki vaka kaydından gelir; test referansı yeni head’de çalıştırılmış sonuç değildir. `passed_runtime` kayıtlı bir davranış kanıtını, `pending_runtime` henüz kayda geçirilmemiş kabulü gösterir. İkisi de güncel kaynak/CI/hosted sonucunun yerine geçmez. Yapısal test veya bu tablo gerçek Auth→Edge→RPC davranış kabulü yerine kullanılamaz. Test yolları backend paketine göredir; dosya içindeki vaka adlarıdır, Markdown bölüm bağlantısı değildir.','','| Vaka | Beklenen davranış | Kayıtlı durum | Test kaynağı |','|---|---|---|---|']
for v in c['decision_sprint']['acceptance_cases']:
 feature_doc.append('| '+v['id']+' | '+cell(v['expected_flow'])+' | '+v['status']+' | '+cell(', '.join(v.get('evidence',[])))+' |')
emit('../../docs/feature-delivery.md','\n'.join(feature_doc))
print('Current schema/API/feature views and endpoint inventory generated')
