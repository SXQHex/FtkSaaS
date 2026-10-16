# FtkSaaS backend — güncel Claude devri

Kaynak: https://github.com/SXQHex/FtkSaaS · dal: `main`. Fiilî başlangıç uygulaması [PR #4](https://github.com/SXQHex/FtkSaaS/pull/4) ile birleşti. 184 sözleşme içinde **55 çağrılabilir / 129 yalnız sözleşme** işlemi vardır. Frontend tasarımı değiştirilmedi.

## Kurulum ve gerçek bağlantı

Node 24.19.0 ve sabit lockfile kullanılır:

```sh
git clone --branch main https://github.com/SXQHex/FtkSaaS.git
cd FtkSaaS
npm ci
npm run dev:start
npm run dev:seed
npm run dev:info
npm test
```

`dev:info` her checkout için gerçek loopback API/functions adresi, publishable key ve Mailpit bağlantısını üretir. Süreli eski Box URL'leri veya sabit ortak staging varsayılmaz. Servis anahtarı/secrets frontend'e veya repository'ye konmaz. Geliştirme sentetik veri kullanır; dış e-posta teslimi tamamlanmış değildir. Yerel davet teslimi için `scripts/deliver-dev-invitations.mjs` ve Mailpit kullanılır.

`npm run test:clean` yalnız checkout'ın loopback DB'sini sıfırlar; 11 migration ve boş tenant/Auth/receipt durumu doğrulanır, ardından testler, sentetik seed, sağlık ve DB advisors çalışır. `npm run dev:stop` ortamı durdurur. Özel bağlantı ve reset logları paylaşılmaz.

## Kanıt ve kapsam

İncelenen uygulama commit'i: `6480f966d361552a24cff13b96a512ffb61e2031`. İki temiz CI çalışmasında 148/148 test geçti: 12 sözleşme, 27 PostgreSQL ve 109 gerçek Auth/API; 11 migration, seed/sağlık/advisors başarılı. [PR CI](https://github.com/SXQHex/FtkSaaS/actions/runs/38906093213) ve [bağımsız inceleme](https://github.com/SXQHex/FtkSaaS/pull/4#issuecomment-6216313969).

Her yeni head ve merge için [Actions](https://github.com/SXQHex/FtkSaaS/actions) sonucu ayrıca denetlenir. `reports/actual-start-verification.json` güncel işin kanıt kapsamını, `reports/qe03-verification.json` Q-E03 kapsamını belirtir. Eski verification/resumed/Q-E01/Q-E02/RC3 dosyaları tarihsel snapshot'tır; yeni head kabulünü kanıtlamaz. Makine envanteri `docs/endpoint-inventory.json`, insan okunur API kataloğu `contracts/05-FtkSaaS-O4-API-katalogu.md` ve kapalı tipler `contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json` esas alınır. Yalnız sözleşme işlemleri gateway'de `NOT_FOUND` döner.

## Transport, Auth ve işlem tekrarı

`POST {API_URL}/functions/v1/backend-v1/{operation}`; doğrudan typed Request JSON gövdesi, `Authorization: Bearer <Supabase access_token>`, `apikey: <publishable key>`, `Content-Type: application/json`. Başarı `ok/data/trace_id`, hata `ok:false/error` zarfıdır. Frontend core/private tablolara veya service-only named RPC'lere doğrudan erişmez.

Aktör, canlı Auth oturumu/hesap/organizasyon bağlantısı/rol ve merkez yetkisinden alınır. Request rol veya actor beyanı yetki vermez. Owner tek başına merkez operasyonu yapamaz; merkez yöneticiliği gerekir. Owner atama/devri platform işlemidir. Abonelik, plan ve tenant sınırları her komutta denetlenir.

Frontend `request_id` ve mutasyon `operation_key` üretmek zorundaysa doğrulanmış UUIDv7 kullanır; domain kayıt ID'leri backend'den gelir. Auth sağlayıcı kimlikleri aynen korunur. Aynı kullanıcı işleminin tekrarında operation_key korunur; request_id yenilenebilir. Aynı anahtar/farklı business içerik `IDEMPOTENCY_PAYLOAD_MISMATCH` döner. Belirsiz transport sonucu yeni anahtar üretme nedeni değildir. Retryable geçici hatalarda en fazla üç otomatik retry; sürüm/izin/kontenjan/politika engellerinde kör retry yoktur.

`expected_version` güncel hedef sürümüdür. Stale preview yeniden alınır; başarılı sonuç aynı key ile replay edilir. Domain + audit + receipt + notification/outbox tek transaction'dır. Yeni preview tokenı değişen payload olduğu için yalnız rollback olmuş/receipt yazılmamış işlemde aynı anahtar kullanılabilir. Tüm istemciler ortak üretilmiş tipleri kullanır; mock gerçek entegrasyon değildir.

## Çalışan işlem grupları

Tam adlar ve sınırlar endpoint envanterindedir. Başlıca gruplar:
- Hesap/organizasyon, platform owner devri.
- Merkez, yönetici/rol/permission atama ve geri alma; öğrenci aktivasyonu ve hesap erişimi daveti.
- Disiplin/merkez-disiplin, abonelik ödeme doğrulaması ve erişim kapıları.
- Paket/satış, tahsilat, borç düzeltmesi, öğrenci alacağı iade/mahsup ve ortak hak bakiyesi.
- Ders rezervasyonu ve ortak havuz/kapasite yarışına ilişkin yazma yolları.
- Etkinlik kaydetme/yayınlama/okuma/listeleme, hazırlık/kayıt/iptal, yoklama/kapanış/düzeltme, gerçekleşme ve görev doğrulaması.
- Fiilî başlangıç: `event_actual_start_record_v1`, `event_actual_start_correct_v1`.

Organizasyon kilidi canlı yetki ve ortak havuz mutasyonlarını sıralar; yük testi yerine geçmez. Ortak haklar disiplin başına çoğaltılmaz. Q-D01: tek etikette uygun dar/geniş paket, sıfır/çok etikette yalnız uygun geniş paket; etkinlik negatif kredi yaratmaz. Paket tarihleri merkez saat dilimi snapshot'ında başlangıç dahil/bitiş hariçtir. Satış merkezinin para borcu ile hizmet merkezinin hak/earning aidiyeti ayrıdır.

## Q-E01 — ödeme hazırlığı ve kesin kayıt

1. Ücretli manuel, tam ödeme şartlı katılımda `event_payment_prepare_v1` ile event/person için tek hazırlık ve bağlı borç alınır. Hazırlık yer tutmaz.
2. `collection_record_v1` içinde `debt_ids:[preparation.debt_id]` kullanılır. Başka borca dağıtılmış veya dağıtılmamış para tam ödeme şartını karşılamaz.
3. `event_payment_get_v1` güncel ödenen/kalan tutarı verir. `event_registration_preview_v1` ve `event_register_v1` preparation_id kullanabilir; sale_id ile birlikte gönderilmez.
4. `data.outcome` mutlaka denetlenir: `registered` kesin kayıttır; `capacity_closed` kesin kayıt değildir. İkinci sonuç hazırlığın kapanması, borç ters kaydı ve ilgili öğrenci alacağının atomik kaydıdır.
5. Aynı bağlı borç tekrar kullanılabilir; ikinci borç/tahsilat yaratılmaz. Önceki indirim, refund claim, açık iade ve mahsup tekrar üretilmez.

`student_credit_refund_v1` açık nakit iade, `student_credit_offset_v1` açık mahsuptur. Otomatik nakit çıkışı/başka borca dağıtım yoktur. Fazla tahsilat borcu eksi yapmaz; source_cash_id bağlı surplus_add olur. İptal önce gerçekleşmişse sonraki gerçek tahsilat yine bu mevcut surplus kuralına tabidir; iki işlemin başarılı olması tek başına mükerrerlik değildir.

## Q-E02 — merkez iptali

`event_cancel_preview_v1` → `event_cancel_apply_v1` merkez yetkisiyle çalışır. Draft/published/occurred kapsamı ve ertesi gün kayıt aynı tam sonucu verir: etkinlik borcu sıfır; daha önce alacaklaştırılmamış tahsilat öğrenci alacağı; ayrılmış hak serbest; tüketilmiş hak previous_id bağlı reverse/release ile tamamen geri. Paket hakkı için ayrıca parasal alacak ve kısmi tüketim yoktur.

Önizleme effects: `remaining_debt_removed`, `student_credit_added`, `release`, `reverse`, hazırlık için `close`. Reverse nakit iade anlamına gelmez. Kendi kaydını daha önce iptal etmiş kişinin ilgili borç/tüketimi de kapsanır. Başka borç/satış ve geçmiş yoklama/görev hakedişi değiştirilmez. İptal sonrası attendance close/correct yeniden hak tüketemez. Finans/event/yetki bağımlılıkları değişmişse stale/forbidden sonucu alınır.

## Q-E03 — planlanan parasal sınır

Katılımcı iptalinde **planlanan başlangıç anı dahil sonrası** parasal iade, borç indirimi veya öğrenci alacağı üretmez. Öncesindeki mevcut kabul edilmiş koşullar korunur; yeni iade formülü eklenmedi. Katılımcı paket sonucu mevcut terms_snapshot cancellation koşulundandır, parasal phase'den türetilmez.

`event_get.data.registrations[].participant_cancellation` null veya `{cancelled_at, planned_starts_at, phase, rule}` nesnesidir. Phase `before_planned_start` / `at_or_after_planned_start`, rule `planned_start_v1`. Backend ortak kilit sonrası karar zamanını sabitler; parasal karşılaştırma ve mevcut paket cutoff formülü aynı karar saatini kullanır. İstemci bu zamanları gönderemez. Eski/yalnız merkez iptallerine kanıt uydurulmaz. Başarılı snapshot değiştirilemez.

Plan 21.00, iptal 21.15, fiilî başlangıç 21.30: parasal olarak başlangıç sonrası iptaldir. Fiilî kayıt/düzeltme bunu değiştirmez. Planlanan saatin gelmesi kendi başına occurred, yoklama, hak tüketimi veya earning yazmaz.

## Fiilî başlangıç API'si — artık mevcut

Ayrıntılı request/response ve kurallar: `docs/actual-start-handover.md`. İki işlem de event.manage merkez yöneticisi, event expected_version, açık Instant ve gerekçe ister. İlk kayıt bir kez yapılır. Correct nullable zamanla hatalı bilgiyi kaldırabilir; eski/yeni değerler mevcut append-only audit defterinde kalır. Gelecek fiilî saat ve boş gerekçe reddedilir.

`event_get` current `actual_started_at` döndürür. Yönetici/organizasyon okuyucusu `actual_start_history` içindeki actor/time/reason/diff geçmişini de görür; diğer izinli okuyucular audit gerekçelerini görmez. İptal sonrasında geriye kayıt/düzeltme yapılabilir, state yeniden açılmaz. Published/occurred/cancelled korunur; draft ret. Sürüm artışı eski iptal önizlemesini stale yapar; yeni preview aynı Q-E02 hesabını uygular.

Bu yalnız operasyonel kanıttır. Q-E03 katılımcı sınıflandırması, Q-E02 hesaplaşması, yoklama, haklar ve earning kendiliğinden değişmez. Kısmi gerçekleşmeden yeni parasal kural türetilmez.

## Kaynak üretimi ve kalan işler

`npm run generate` ortak tipleri, minimal Edge contract/validator/bundle ve katalog/endpoint envanterini üretir; `npm run verify` drift'i reddeder. Yeni değişiklik ayrı branch/PR ve append-only migration ile yapılır. Önceki 10 migration korunmuştur; 11. migration fiilî başlangıç aktarımıdır. Eski wrapper kaynağı tarihsel migration ile sabittir; güncel üretilen wrapper `database/runtime-wrappers-current.sql` dosyasındadır. Yeni API'nin DB kurulumu yeni migration ile taşınır. Historical/transfer scriptleri güncel sözleşmeye körlemesine uygulanmaz.

129 işlem yalnız sözleşme düzeyindedir. Kalıcı ortak staging, dış e-posta, yük/restore, frontend gerçek entegrasyon kabulü ve production dağıtımı tamamlanmış değildir. Frontend kodu/tasarımı Claude'un alanıdır. `vercel.json` main otomatik dağıtımını kapalı tutar; merge production izni değildir.
