import json,sys
from pathlib import Path
def emit(path,content):
 f=Path(path)
 if '--check' in sys.argv: assert f.read_text()==content,'Generated catalog drift: '+path
 else: f.write_text(content)
p=json.loads(Path('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json').read_text());c=p['x-contract'];d=p['$defs'];names=set(json.loads(Path('supabase/functions/backend-v1/implemented.json').read_text())['operations'])
def typ(s):
 if '$ref' in s:return s['$ref'].split('/')[-1]
 if 'anyOf' in s:return ' ∣ '.join(typ(x) for x in s['anyOf'])
 if s.get('type')=='array':return typ(s['items'])+'[]'
 if 'const' in s:return str(s['const'])
 if 'enum' in s:return ' / '.join(map(str,s['enum']))
 return ' ∣ '.join(s['type']) if isinstance(s.get('type'),list) else s.get('type','schema')
def fields(s):return '; '.join(k+('' if k in s.get('required',[]) else '?')+': '+typ(v) for k,v in s.get('properties',{}).items())
schema=['# FtkSaaS — fiziksel şema · 0.2.0-rc.3','',f"{len(c['tables'])} domain tablosu; {len(list(Path('supabase/migrations').glob('*.sql')))} sıralı migration. Kanıt ve kapsam: `docs/claude-handover.md`, `reports/qe02-verification.json`. Aşağıdaki alan listesi makine sözleşmesi 08’den üretilir. Kesin PostgreSQL DDL kaynağı `supabase/migrations`; uygulanan migration değiştirilmez.",'','UUID/FK alanları `uuid`, parasal stringler DB’de `bigint`, Instant `timestamptz`, tarih `date`, kapalı nesneler `jsonb`. Yeni domain kimlikleri Edge içinde doğrulanmış `uuid@14.0.3` v7 üreticisinden gelir. PostgreSQL 17 DB default üreticisi zorunlu değildir; üretici bulunmadığında default kapalıdır ve v4 fallback yoktur. Auth sağlayıcı UUID’leri korunur.','', 'İstemci core/private erişimine kapalıdır. api_v1 RPC’leri yalnız backend service rolüne açıktır; doğrulanmış JWT, canlı Auth oturumu, hesap/bağlantı/rol ve tenant kontrolü gateway + transaction içinde yapılır.','', '| Tablo | Scope | Alanlar | Kural |','|---|---|---|---|']
for t in c['tables']:schema.append('| `'+t['name']+'` | '+t['scope']+' | '+fields(d['Table_'+t['name']]).replace('|','∣')+' | '+t.get('invariants','').replace('|','∣')+' |')
schema+=['','## DS-2026-10-17 hedef depolama bağımlılıkları','','90 core tablo/27 migration; Starter teslimi iki private teknik tablo ve snapshot alanları ekler. Agreement predecessor/start snapshot ve ürün kimliği override zinciri; Starter causal obligations/approval ve satış blocked snapshot’ları uygulanmıştır; diğer hak değişikliği tüketicileri açıktır. settlement accrual/reversal, immutable request versions/lines, B-confirmed payment/offset/correction records and selected allocations; organization authority aggregate and scoped grants ayrı append-only migration teslimidir. DTO varlığı bu kolon/tabloların kurulduğunu göstermez. Ayrıntı: docs/decision-sprint-handover.md.']
schema+=['','Teknik private tablolar: `platform_operators`, `preview_payloads`, `invitation_deliveries`, `runtime_operations`, `person_origins`, `reservation_protections`, `lesson_deficit_movements`. Bunlar müşteriye yeni ürün varlığı veya rol vermez.','', 'Kayıt koşulları `event_registrations.terms_snapshot` ile sabitlenir. Etkinlik etiketi/zamanı değişiminde mevcut hak bağlantıları aynı transaction içinde tekrar doğrulanır; otomatik iptal yoktur. Hareket defterleri ve audit satırları append-only trigger ile korunur.','', '## Kabul edilmiş ekler','']
for a in c['amendments']:
 for r in a['rules']:schema.append('**'+r['id']+'.** '+r['rule']+'\n')
emit('contracts/04-FtkSaaS-O4-veri-semasi.md','\n'.join(schema).rstrip()+'\n')
api=['# FtkSaaS — API kataloğu · 0.2.0-rc.3','',f"{len(c['operations'])} sözleşme; {len(names)} geliştirme ortamında çağrılabilir endpoint, {len(c['operations'])-len(names)} yalnız sözleşme. Çağrılabilir olmak bütün ürün özelliklerinin veya üretim kabulünün tamamlandığı anlamına gelmez. Kapsam sınırları ve Q-E01 `docs/claude-handover.md` içindedir.",'', '`POST {API_URL}/functions/v1/backend-v1/{operation}`; JSON gövde doğrudan typed Request nesnesidir. Header: `Authorization: Bearer <Supabase access_token>`, `apikey: <publishable key>`, `Content-Type: application/json`. Başarı: `ok/data/trace_id`; hata: `ok:false/error:SafeError`. Servis anahtarı frontend’e verilmez.','', 'Named `/rest/v1/rpc/{operation}` yalnız backend içindir; imzası p_request + doğrulanmış actor/session + backend UUID bankasıdır. İstemci bu RPC’ye actor veya ID bankası gönderemez.','', '| İşlem | Durum | İzin | Tür / abonelik | İstek | Yanıt |','|---|---|---|---|---|---|']
for o in c['operations']:
 state='çağrılabilir (kapsam notları geçerli)' if o['name'] in names else 'yalnız sözleşme'
 api.append('| `'+o['name']+'` | '+state+' | `'+o['permission']+'` | '+o['transport']+' / '+o['billing_class']+' | '+fields(d[o['request']['$ref'].split('/')[-1]]).replace('|','∣')+' | '+o['success']['$ref'].split('/')[-1]+' |')
api+=['','## İşlem bazında hedef sözleşme ve runtime ayrımı','','features ürün referanslarıdır. required_features hedef plan kapısı; runtime_required_features halen uygulanan kapıdır. Karar sprintinin davranış kabulü tamamlanmış değildir.','','| İşlem | Faz | Hedef sürüm / okuma | Atomik etkiler | DS durumu |','|---|---|---|---|---|']
for o in c['operations']:
 k=o['operation_contract']
 api.append('| '+o['name']+' | '+k['kind']+' | '+k['version_mode']+' / '+str(k['read_operation'])+' | '+', '.join(k['atomic_effects'])+' | '+o['decision_delivery']['runtime_conformance']+' |')
api+=['','Önizleme süre sınırı 15 dakika. Apply canlı aktör/yetki/abonelik ve ilgili satır sürümlerini yeniden denetler. İdempotency kapsamı org + hesap + operasyon; merkez payload içindedir. Aynı anahtar/aynı içerik sonucu tekrarlar, farklı içerik reddedilir. Doğrulanmamış transport sonucunda yeni anahtar üretilmez.','', 'Etkinlik listesinde mevcut desteklenen sıralama `starts_at_asc`; cursor aynı org/merkez/zaman/disiplin filtresine bağlıdır.','']
api+=['','## Hesaplaşma adımının sunucu yetki kapsamı','','Hesapların eşit olması hata değildir. Başvuruda A ve kararda dondurulmuş B merkezinin canlı CM rolü/grantı ayrı doğrulanır; client center seçimi yetki değildir. Aşağıdaki audit scope alanları sunucudan üretilir.','','| İşlem | Merkez kaynağı | İzin | Farklı hesap şartı | Audit kapsamı |','|---|---|---|---|---|']
for o in c['operations']:
 if 'authority_binding' in o:
  b=o['authority_binding']
  api.append('| '+o['name']+' | '+b['center']+' | '+b['permission']+' | '+str(b['require_distinct_account'])+' | '+', '.join(b['audit_scope_fields'])+' |')
emit('contracts/05-FtkSaaS-O4-API-katalogu.md','\n'.join(api))
inventory={'runtime_version':'0.2.0-rc.3','operations':[{'name':o['name'],'status':o['implementation_status'],'external_path':'/functions/v1/backend-v1/'+o['name'] if o['name'] in names else None,'permission':o['permission'],'features':o['features'],'required_features':o['required_features'],'runtime_required_features':o['runtime_required_features'],'decision_delivery':o['decision_delivery'],'billing_class':o['billing_class'],'limits':o.get('runtime_limits',[])} for o in c['operations']]}
for source,entry in zip(c['operations'],inventory['operations']):
 if 'authority_binding' in source:entry['authority_binding']=source['authority_binding']
emit('docs/endpoint-inventory.json',json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
print('Current schema/API catalogs and explicit endpoint inventory generated')

feature_doc=['# F01–F33 karar, teknik bağımlılık, runtime ve kabul haritası','','Bu harita 08 makine sözleşmesinden üretilir. İşlem sayısı ürün tamamlanma yüzdesi değildir. 89 çağrılabilir işlem DS davranışlarının tamamlandığını göstermez. Yeni ürün kararlarının gerçek Auth → Edge → RPC kabulü aşağıdaki açık teslim bağımlılıklarında bekler.','','| Özellik / ürün kararı | Plan erişimi | Teknik karşılık | Açık bağımlılıklar | Uygulama | Kabul |','|---|---|---|---|---|---|']
for fid,row in c['feature_delivery'].items():
 plans=', '.join(k for k,v in row['plans'].items() if v)
 ops=', '.join(row['technical_operations']) or 'İlgili modül teslimi'
 feature_doc.append('| '+fid+' '+row['name']+' — '+row['decision']+' | '+plans+' | '+ops+' | '+', '.join(row['dependencies'])+' | '+row['implementation']+' ('+str(len(row['implemented_operations']))+' mevcut runtime / '+str(len(row['contract_only_operations']))+' yalnız sözleşme) | '+row['acceptance']+' |')
feature_doc+=['','Kabul edilmiş DS kuralları ve uçtan uca teslim sınırları: docs/decision-sprint-handover.md. Ücret/finans/koruma/hesaplaşma kabulü yapısal sözleşme testlerinden çıkarılamaz. Frontend, production, dış e-posta ve yük/restore bu haritada tamamlandı sayılmaz.']
feature_doc+=['','## DS davranış kabul kataloğu — yalnız kanıtlı Starter vakası kapalı','','| Senaryo | Açık runtime teslimi | Beklenen uçtan uca davranış | Durum |','|---|---|---|---|']
for v in c['decision_sprint']['acceptance_cases']:
 feature_doc.append('| '+v['id']+' | '+v['delivery_gap']+' | '+v['expected_flow']+' | '+v['status']+' |')
emit('docs/feature-delivery.md','\n'.join(feature_doc)+'\n')
