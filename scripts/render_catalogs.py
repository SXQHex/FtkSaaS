import json
from pathlib import Path
p=json.loads(Path('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json').read_text());c=p['x-contract'];d=p['$defs'];names=set(json.loads(Path('supabase/functions/backend-v1/implemented.json').read_text())['operations'])
def typ(s):
 if '$ref' in s:return s['$ref'].split('/')[-1]
 if 'anyOf' in s:return ' ∣ '.join(typ(x) for x in s['anyOf'])
 if s.get('type')=='array':return typ(s['items'])+'[]'
 if 'const' in s:return str(s['const'])
 if 'enum' in s:return ' / '.join(map(str,s['enum']))
 return s.get('type','schema')
def fields(s):return '; '.join(k+('' if k in s.get('required',[]) else '?')+': '+typ(v) for k,v in s.get('properties',{}).items())
schema=['# FtkSaaS — fiziksel şema · 0.2.0-rc.3','',f"{len(c['tables'])} domain tablosu; on üç sıralı migration. Kanıt ve kapsam: `docs/claude-handover.md`, `reports/qe02-verification.json`. Aşağıdaki alan listesi makine sözleşmesi 08’den üretilir. Kesin PostgreSQL DDL kaynağı `supabase/migrations`; uygulanan migration değiştirilmez.",'','UUID/FK alanları `uuid`, parasal stringler DB’de `bigint`, Instant `timestamptz`, tarih `date`, kapalı nesneler `jsonb`. Yeni domain kimlikleri Edge içinde doğrulanmış `uuid@14.0.3` v7 üreticisinden gelir. PostgreSQL 17 DB default üreticisi zorunlu değildir; üretici bulunmadığında default kapalıdır ve v4 fallback yoktur. Auth sağlayıcı UUID’leri korunur.','', 'İstemci core/private erişimine kapalıdır. api_v1 RPC’leri yalnız backend service rolüne açıktır; doğrulanmış JWT, canlı Auth oturumu, hesap/bağlantı/rol ve tenant kontrolü gateway + transaction içinde yapılır.','', '| Tablo | Scope | Alanlar | Kural |','|---|---|---|---|']
for t in c['tables']:schema.append('| `'+t['name']+'` | '+t['scope']+' | '+fields(d['Table_'+t['name']]).replace('|','∣')+' | '+t.get('invariants','').replace('|','∣')+' |')
schema+=['','Teknik private tablolar: `platform_operators`, `preview_payloads`, `invitation_deliveries`, `runtime_operations`. Bunlar müşteriye yeni ürün varlığı veya rol vermez.','', 'Kayıt koşulları `event_registrations.terms_snapshot` ile sabitlenir. Etkinlik etiketi/zamanı değişiminde mevcut hak bağlantıları aynı transaction içinde tekrar doğrulanır; otomatik iptal yoktur. Hareket defterleri ve audit satırları append-only trigger ile korunur.','', '## Kabul edilmiş ekler','']
for a in c['amendments']:
 for r in a['rules']:schema.append('**'+r['id']+'.** '+r['rule']+'\n')
Path('contracts/04-FtkSaaS-O4-veri-semasi.md').write_text('\n'.join(schema).rstrip()+'\n')
api=['# FtkSaaS — API kataloğu · 0.2.0-rc.3','',f"{len(c['operations'])} sözleşme; {len(names)} geliştirme ortamında çağrılabilir endpoint, {len(c['operations'])-len(names)} yalnız sözleşme. Çağrılabilir olmak bütün ürün özelliklerinin veya üretim kabulünün tamamlandığı anlamına gelmez. Kapsam sınırları ve Q-E01 `docs/claude-handover.md` içindedir.",'', '`POST {API_URL}/functions/v1/backend-v1/{operation}`; JSON gövde doğrudan typed Request nesnesidir. Header: `Authorization: Bearer <Supabase access_token>`, `apikey: <publishable key>`, `Content-Type: application/json`. Başarı: `ok/data/trace_id`; hata: `ok:false/error:SafeError`. Servis anahtarı frontend’e verilmez.','', 'Named `/rest/v1/rpc/{operation}` yalnız backend içindir; imzası p_request + doğrulanmış actor/session + backend UUID bankasıdır. İstemci bu RPC’ye actor veya ID bankası gönderemez.','', '| İşlem | Durum | İzin | Tür / abonelik | İstek | Yanıt |','|---|---|---|---|---|---|']
for o in c['operations']:
 state='çağrılabilir (kapsam notları geçerli)' if o['name'] in names else 'yalnız sözleşme'
 api.append('| `'+o['name']+'` | '+state+' | `'+o['permission']+'` | '+o['transport']+' / '+o['billing_class']+' | '+fields(d[o['request']['$ref'].split('/')[-1]]).replace('|','∣')+' | '+o['success']['$ref'].split('/')[-1]+' |')
api+=['','Önizleme süre sınırı 15 dakika. Apply canlı aktör/yetki/abonelik ve ilgili satır sürümlerini yeniden denetler. İdempotency kapsamı org + hesap + operasyon; merkez payload içindedir. Aynı anahtar/aynı içerik sonucu tekrarlar, farklı içerik reddedilir. Doğrulanmamış transport sonucunda yeni anahtar üretilmez.','', 'Etkinlik listesinde mevcut desteklenen sıralama `starts_at_asc`; cursor aynı org/merkez/zaman/disiplin filtresine bağlıdır.','']
Path('contracts/05-FtkSaaS-O4-API-katalogu.md').write_text('\n'.join(api))
inventory={'runtime_version':'0.2.0-rc.3','operations':[{'name':o['name'],'status':o['implementation_status'],'external_path':'/functions/v1/backend-v1/'+o['name'] if o['name'] in names else None,'permission':o['permission'],'features':o['features'],'billing_class':o['billing_class'],'limits':o.get('runtime_limits',[])} for o in c['operations']]}
Path('docs/endpoint-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
print('Current schema/API catalogs and explicit endpoint inventory generated')
