import json,re
from pathlib import Path
R=Path(__file__).resolve().parents[1];C=R/'contracts'
p=json.loads((C/'08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json').read_text());d=p['$defs'];c=p['x-contract']
def typ(s):
 if '$ref' in s:return s['$ref'].split('/')[-1]
 if 'anyOf' in s:return '|'.join(typ(x) for x in s['anyOf'])
 if s.get('type')=='array':return typ(s['items'])+'[]'
 if 'const' in s:return str(s['const'])
 if 'enum' in s:return '/'.join(map(str,s['enum']))
 return s.get('type','schema')
def fields(s):return '; '.join(k+('' if k in s.get('required',[]) else '?')+':'+typ(v) for k,v in s.get('properties',{}).items())
def rules():return '\n'.join('**'+r['id']+'.** '+r['rule'] for a in c['amendments'] for r in a['rules'])
old=(C/'04-FtkSaaS-O4-veri-semasi.md').read_text()
# Preserve concurrency/time/privileged-function requirements, removing superseded deficit aggregate key.
section=old.split('## Eşzamanlılık ve indeks planı')[1].split('## 15 Ekim 2026')[0] if '## Eşzamanlılık ve indeks planı' in old else ''
section=section.replace('Org/person koruma kilidi, allocation ve deficit birlikte; farklı program/merkezlerde izinli ortak açık limiti çoğaltılmaz.','İlgili org/person/center/discipline açık kilidi; ayrıca kaynak sale entitlement-account kilidi bütün disiplinlerde ortaktır. Ayrılmış+tüketilmiş açık aynı kapsamda, rezervasyon bir kez sayılır.')
# Keep stable preserved text across reruns.
note=R/'docs/physical-invariants.md'
if not note.exists():note.write_text('## Eşzamanlılık ve indeks planı'+section)
header='# FtkSaaS — O4 fiziksel şema · 2.2-tech.2\n\nD01–D09 ve U01–U08 teknik aktarımı. 89 tablo üç migration ile izole PostgreSQL 17.11 üzerinde uygulandı. İş RPC/RLS yetki politikaları tamamlanmış değildir; core/private istemci erişimi kapalıdır. Makine kaynağı 08 JSON.\n\n'
intro='''## UUID ve alan kuralları

Bütün ID/FK alanları PostgreSQL uuid olarak kalır. Domain ID üretimi backend UUIDv7 adaptöründen gelir. accounts.auth_user_id dış sağlayıcı kimliğidir; aynen korunur. UUID alan eşlemesi 08 x-contract.uuid_field_map içindedir. İstemci operation_key/request_id üretiyorsa aynı UUIDv7 adaptörünü kullanır; retry operation_key değerini korur. Bearer tokenlar UUID değildir.

SQL varsayılanı private.new_uuid_v7() yalnız doğrulanmış native/extension yeteneğini kullanır. Test edilen PostgreSQL 17 ortamında DB üreticisi yoktur: varsayılan üretim UUIDV7_GENERATOR_UNAVAILABLE ile kapalıdır; v4 fallback yoktur. uuid@14.0.3 backend adaptörü test/seed/Edge/worker için seçilmiş ve test edilmiştir; bunu çağıran iş rutinleri henüz yazılmadı.

Disiplin kimliği organizasyona, kullanıma açılması merkez–disiplin ilişkisine aittir. Kişi çoğaltılmaz; person_disciplines ilişkisinden login rolü doğmaz. Normal seans/talep/anlaşma discipline_id taşır. Seans/sınıf/program aynı kapsama bileşik FK ile bağlanır. credit_deficits, kendi reservation/person/session/center/discipline bileşimiyle bağlanır.

Paket kapsamı scope_kind ile dört seçenekten biridir. center_id ve discipline_id null şekli scope_kind ile doğrulanır. usage_targets ders/etkinlik uygunluğunu ayrıca belirtir. Kapsam satırları OR, dolu boyutlar AND; plan, kapasite, kapalı sınıf ve tarih kapıları aynen korunur. Her satışın tek entitlement_account havuzu vardır; kapsam başına hak çoğaltılmaz.

Negatif override tekilliği (org,center,discipline,person), açık sayımı aynı kapsamdadır. allocation/deficit iş akışının yarış güvenliği henüz uygulanmadı. Geniş pakette ortak sale havuz kilidi, uygunluk filtresi ve geçmiş tüketilmiş açık→gelecek ayrılmış açık sırası RPC uygulamasında zorunludur.

## Tablolar

? optional alanı belirtir; null kabulü ayrıca null tipinde gösterilir. Tüm alanlar aşağıdadır; JSONB snapshotın kapalı şekli 08 tanımındadır. Fiziksel baseline scalar/FK/kapsam kısıtlarını taşır; JSONB semantic guardları ve bütün iş invariantları tamamlanmış değildir.

'''
rows=['| Tablo | Modül/kapsam | Alanlar | Zorunlu iş invariantı |','|---|---|---|---|']
for t in c['tables']:rows.append('| '+t['name']+' | '+t['module']+'/'+t['scope']+' | '+fields(d['Table_'+t['name']]).replace('|',' / ')+' | '+t['invariants'].replace('|',' / ')+' |')
(C/'04-FtkSaaS-O4-veri-semasi.md').write_text(header+intro+'\n'.join(rows)+'\n\n'+note.read_text()+'\n\n## Kabul edilmiş üst kararlar\n\n'+rules()+'\n')
old=(C/'05-FtkSaaS-O4-API-katalogu.md').read_text()
preamble=old.split('## Taşıma ve tip kuralları')[1].split('## Operasyonlar')[0] if '## Taşıma ve tip kuralları' in old else ''
pnote=R/'docs/api-invariants.md'
if not pnote.exists():pnote.write_text('## Taşıma ve tip kuralları'+preamble)
out=['# FtkSaaS — O4 API kataloğu · 2.2-tech.2','', '178 operasyon sözleşmesi. Bu katalog uygulanmış endpoint listesi değildir. Aktif domain endpoint yok; sözleşme, ortak tip ve guard tanımları entegrasyon içindir.','',pnote.read_text(),'''## D/U aktarımı

operation_key, request_id ve trace_id: FtkUuid. Yeni üretim UUIDv7; generic UUID kabulü eski/sağlayıcı kimliğini dışlamaz. Auth auth_user_id ProviderUuid, bearer/preview/lease tokenları kendi güvenli token türündedir. lesson_request_withdraw/reject/offer_alternative/approve hedefi lesson_request_id, request_id yalnız izleme başlığıdır.

discipline_save/list organizasyon konfigürasyonu/görüntüleme; center_discipline_set merkez yöneticisi; person_discipline_set merkez kişi yetkisi ve öğrenci aktiflik/limit kapılarıyla. Yeni rol veya login grant yoktur. Owner/OM merkez operasyonu için CM ataması zorunludur.

SessionCreate/SessionView ve özel talep/anlaşma girdileri discipline_id taşır. negative_limit_set ve EligibilitySnapshot merkez–disiplin kapsamını zorunlu taşır. ProductScope dört seçenekli uniondur; usage_targets bağımsızdır. EntitlementView satış havuzu toplamlarını ve limit hesabı için deficit_scopes listesini ayırır. PersonView disiplin ilişkilerini listeler.

Q-D01 kabul edildi: etkinlik 0/1/çok disiplin etiketi taşır; etiket izin değildir. Tek etikette uygun dar/geniş kapsam; 0/çok etikette yalnız center_all_disciplines veya organization_all. usage_targets event açık olmalıdır. Etkinlikte negatif kredi yok; yetersiz kullanılabilir hak ENTITLEMENT_UNAVAILABLE. Diğer plan/merkez/tarih/kapasite/etkinlik koşulları ayrıca korunur.

## Operasyonlar

''','| İşlem | Modül | İzin | Taşıma/transaction | İstek alanları | Yanıt veri tipi |','|---|---|---|---|---|---|']
for o in c['operations']:
 req=d[o['request']['$ref'].split('/')[-1]];success=d[o['success']['$ref'].split('/')[-1]]
 out.append('| '+o['name']+' | '+o['module']+' | '+o['permission']+' | '+o['transport']+'/'+o['transaction_class']+' | '+fields(req).replace('|',' / ')+' | '+typ(success['properties']['data'])+' |')
(C/'05-FtkSaaS-O4-API-katalogu.md').write_text('\n'.join(out)+'\n')
print('Rendered 04/05 from authoritative manifest')
