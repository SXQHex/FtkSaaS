# FtkSaaS — güncel entegrasyon devri

P03 ilk uygulama dilimi:7 API uygulandı; dal envanteri199/140 runtime/59 contract_only,46 migration. Tahsilat düzeltmesi ve eğitmen ödemesi geçmişi silmeden bağlı fark hareketi kullanır. Paket iadesi satışta sabit yöntemle borç indirimi ve öğrenci alacağıdır; nakit/hak işlemi değildir. P02/P03 önceki hesaplaşması tekrar üretilmez. Hedefli runtime, bağımsız son inceleme ve aday/main kabulü açık; Draft/development PR30 korunur.

P03 başladı: tek feature/p03-finance-payments Draft/development PR,7 API. Başlangıç main ce95a9d0d960a201b0488071802dc5db7741caf1 / belge kabulü39487599217; P02 runtime kabulü ve hosted eşleşmesi korunur. Uygulama ve yeni runtime kabulü açık; bütün P03 sonunda tek aday clean alınır.

P02 **done**: [PR #28](https://github.com/SXQHex/FtkSaaS/pull/28), kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167`. Envanter **199 sözleşme / 133 runtime / 66 contract_only / 40 migration / 90 core tablo**. Son head `35816cc30a9b28e273e94e6cef86e8b402dbaad0` bağımsız incelemeden geçti; [hedefli39448566998](https://github.com/SXQHex/FtkSaaS/actions/runs/39448566998), [aday39455462417](https://github.com/SXQHex/FtkSaaS/actions/runs/39455462417) ve [aynı main39461804543](https://github.com/SXQHex/FtkSaaS/actions/runs/39461804543) completed/success. Full kapsam:96 sözleşme/yönetişim +37 CI politika +27 DB +309 API =469 test düğümü; fail/skipped0. Core, dört izole API shard, toplayıcı,40 migration, seed/health/advisors geçti. Main clean14:43; önceki43:33 hedefli koşu seri tüm-suite fallback kullandı, aynı çalışma profili değildir. Eski başarı yeni kaynağa taşınmaz.

Geliştirme/test Supabase `gwyprhenabtpkbojephw`, aynı kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167` kaynağına eşitlendi:40 migration, Edge backend-v1 sürüm2, verify_jwt=true,133 runtime API. Uzak smoke ve geçici fixture temizliği başarılı; ayrıntılar docs/remote-backend-setup.md içindedir. Hosted worker zamanlayıcısı, ortak tenant/kullanıcı kurulumu, frontend gerçek entegrasyonu, yük/restore, dış e-posta ve production kabulü ayrı açık kalır.

[Hesaplaşma entegrasyonu](settlement-handover.md): dokuz yeni API, ayrı A/B yetki kapsamı, yalnız B onayında finansal commit ve bağlı düzeltme.

## İstemci entegrasyonu için yaşayan kaynaklar

- [Starter yoklama/koruma](starter-attendance-protection-handover.md): anlaşmasız Starter, etki/onay, kapanış ve düzeltme.
- [Anlaşma/hakediş](instructor-earnings-handover.md): güncel Pro/Business kapanışı, açık fiilî başlangıç, immutable ücret ve bağlı fark.
- [Takvim/seans/rezervasyon okumaları](schedule-read-handover.md) ve [program/seans](program-session-handover.md): DTO, zaman, görünürlük ve sürüm sınırları; eski teslim açıkları güncel envanterle karşılaştırılır.
- [API kataloğu](../contracts/05-FtkSaaS-O4-API-katalogu.md), [makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) ve [endpoint envanteri](endpoint-inventory.json): kesin işlem adları ve uygulama durumları.
- [Kalan işler](remaining-work.md): eğitmen ödeme komutları ve tamamlanmamış tüketiciler.

Transport: POST {API_URL}/functions/v1/backend-v1/{operation}; typed request JSON, Authorization: Bearer Supabase access_token ve apikey: publishable key kullanılır. Yanıt ok/data/trace_id veya ok:false/error zarfıdır. Service-only RPC/core/private doğrudan istemci erişimi değildir. Tekrar gönderimde aynı business işlem anahtarı korunur; sürüm ve önizleme bağımlılıkları yeniden doğrulanır.

Yerel bağlantı: Node 24.19.0, npm ci, npm run dev:start, npm run dev:seed, npm run dev:info. Adres ve publishable key bu checkout'tan alınır; eski Box adresleri ortak ortam değildir. npm run test:clean yalnız izole loopback kabul ortamı içindir. [Hosted kurulum kaydı](remote-backend-setup.md) aynı P02 main kaynağının40 migration/Edge2 eşleşmesini ve ayrı smoke kapsamını gösterir.

Frontend gerçek uçtan uca kabulü ve yük/restore açık; mock kabul değildir. Dış e-posta ertelendi; Resend başlatılmaz. Production dağıtımı yapılmaz.

## Tarihsel entegrasyon notları

Aşağıdaki metinler önceki teslim snapshot'larıdır. Kurulum/transport ayrıntıları güncel typed sözleşmeyle doğrulanır; eski işlem sayıları ve kapanmış açıklar bugünkü durum değildir.


[P01 devri](p01-handover.md): bütün P01 PR #22 ile main’e alındı; son hedefli ve aday clean başarılı. Aynı main clean 39401570751 completed/success doğrulandı; P01 done. Hosted/production worker kabulü ayrıdır.

<details>
<summary>Önceki entegrasyon notları (tarihsel)</summary>

# Eğitmen anlaşması ve hakediş — güncel geliştirme kapsamı

Başlangıç main: `ab3fca4af47b71b34a4a7b6d0df5211ad1e41141`; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39042108296) başarılı: 27 migration, 341 test. Yeni kaynak için önceki başarı taşınmaz; son head inceleme/temiz CI ve merge main CI ayrıca doğrulanır.

199 sözleşme, 95 çağrılabilir, 104 contract-only; 90 core tablo, 28 append-only migration. [Güncel anlaşma/hakediş devri](instructor-earnings-handover.md) yeni akışı ve sınırları tanımlar. Eğitmen ödeme komutları ve merkezler arası hesaplaşma runtime'ı bu teslim değildir. Önceki snapshot sayıları aşağıda tarihsel bağlamdır.

# DS-2026-10-17 — güncel sözleşme ve CI devri

## Starter yoklama/koruma teslimi — güncel kapsam

[Starter devri](starter-attendance-protection-handover.md) zorunlu bağımlılıkları ve kalan tüketicileri tanımlar. 198 işlem / 89 canlı / 109 contract-only; 90 core tablo / 27 migration. Starter program → rezervasyon → etki/onay → korunan katılım → kapanış → gerekçeli düzeltme uygulanır. Ücretli finansal kapanış açıkça kapalı; başlangıç/belge ve diğer hak değişikliği tüketicileri pending. Son SHA’nın kanıtı PR’dedir; eski başarı taşınmaz.

Doğrulanmış başlangıç: main `5265a70a0d29f91b9081a1ecbc2a8f0ff78668ee`; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39030586306) başarılı: 322 test, 25 migration. Bu teslim yeni Starter runtime ve 26–27. migration’ı ekler; 198 sözleşmeli işlem, 89 canlı / 109 yalnız sözleşme. Başlangıcın başarısı yeni head’e taşınmaz; son CI/inceleme PR üzerinde aynı tam SHA’ya bağlıdır.

[Karar sprinti devri](decision-sprint-handover.md), [kabul edilmiş kararlar](decisions/DS-2026-10-17.md), [F01–F33 haritası](feature-delivery.md), [main koruma denetimi](branch-protection-review.md). Yeni DS davranışları gerçek Auth → Edge → RPC kabulü bekler; sözleşme negatif testleri ve mevcut runtime regresyonu ayrı kanıttır. Son revizyon: docs/decisions/DS-2026-10-17-settlement-center-scope.md; kaynak/kanıt raporu: reports/settlement-center-scope-verification.json; son PR head inceleme ve tam temiz CI ayrıca doğrulanır.

Mevcut runtime anlaşma/plan/koruma farkları açıkça delivery_gaps olarak kaydedildi. DS-OPEN-01 grantor konusu son revizyonla karar düzeyinde kapalıdır: Owner delege OM iznini yönetir; Owner veya delege OM merkez CM grantını yönetir. B onayı kayıt/bakiyeyi atomik kesinleştirir; ayrı OM kayıt adımı kaldırıldı. DS-OPEN-02 son merkez yetki düzeltmesiyle karar düzeyinde kapalıdır: aynı hesap gerekli A/B merkez yetkileriyle iki adımı yapabilir; A-only yetki B onayı sağlamaz. Audit her adımın merkez/rol/grant kapsamını kaydeder, fallback yoktur. Runtime pending. Klasik main koruması API 403 nedeniyle doğrulanamıyor; rulesets boş, yönetim yazması yapılmadı. PR #13 tarihsel merge yetkisi bu yeni PR’yi kapsamaz; repository yönetimi ayrı iştir; frontend, production ve Resend'e müdahale edilmez.

---

Aşağıdaki önceki teslim kapsamları kendi kaynak snapshot’larıdır; güncel açık iş olarak yorumlanmaz.

# Takvim/seans/rezervasyon okumaları — geliştirme uygulaması

72 çağrılabilir / 112 yalnız sözleşme; 24 migration. `calendar_get_v1`, `session_get_v1`, `reservation_list_v1` kapsamı, canlı görünürlük, UTC aralık, cursor ve entegrasyon sınırları [okuma devrinde](schedule-read-handover.md). `products_list_v1` ürün kataloğudur; uygun satın alınmış paket seçimi için seans/kişi/sale bağlamı ayrıca aktarılmalıdır ve bu teslimin dışında kalır. Kaynak `9a5b2bd7ba71d25a259bf96851c2829bc4782c7c` üzerinde tam `npm run test:clean` geçti: 12 sözleşme + 27 DB + 182 Auth/API = 221 test, 24 migration, seed/health/advisors başarılı. [Kaynak raporu](../reports/schedule-read-verification.json). Son head temiz CI ayrıca doğrulanır. Aşağıdaki uygunluk/politika uygulama sayıları kendi kaynak snapshot'ıdır.

---

## Uygunluk ve politikalar — geliştirme uygulaması

Bu PR dört işlemi ekler: `availability_save_v1`, `availability_exception_save_v1`, `policies_get_v1`, `policy_publish_v1`. Toplam 184 işlemin 69'u geliştirme ortamında çağrılabilir, 115'i yalnız sözleşmedir; 23 append-only migration vardır. Kabul sonucu bu PR'nin son SHA'sının CI'ından ayrıca okunur. [Kaynak kapsam raporu](../reports/availability-policy-verification.json): a031f8142da4a2959232644c88fc911278ac5d06 üzerinde 12 sözleşme + 27 DB + 27 odaklı Auth/API testi, temiz 23 migration ve advisor kontrolü geçti; tam temiz PR/main CI ile aynı kanıt değildir.

- Uygunluk kuralı oluşturma sürümsüz, güncelleme `rule_id + availability_rules.version` ister; kaynak türü/kimliği/merkezi değiştirilemez. Yerel saatler 00:00:00–23:59:59, başlangıç bitişten küçüktür; gece aralığı açıkça bölünür. Günler ISO 1–7; geçerlilik başlangıç dahil/bitiş hariçtir. UTC seans zamanları yerel uygunlukla karşılaştırılır; saat kaydırılmaz.
- İstisna komutu mevcut istisnayı değiştirmez; yeni [starts_at,ends_at) engeli ekler. `expected_version`, seçili merkezin `centers_list.version` değeridir; merkez yapılandırma aggregate sürümü atomik artırılır. Mutation sürümü bu aggregate'in yeni sürümüdür, yeni istisna satırının sürümü değildir. İstisna mevcut seansı/rezervasyonu kendiliğinden iptal etmez.
- Organizasyon politikası Owner/OM tarafından yayımlanır. Business merkez istisnası CM veya organizasyon okuyucusu tarafından yalnız mevcut tavsiye organizasyon politikası altında yayımlanabilir; merkez kendini zorunlu üst otorite yapamaz. Değerler açık typed input'tur; sayısal başlangıç uydurulmaz.
- Politika sürümü org/merkez/key zincirinde append-only'dir. `expected_version` alanı bu istekte yoktur; organizasyon kilidi eşzamanlı yayınları sıralayıp `previous_id/version` zinciri üretir. Etkin zamanda her scope'un en yeni satırı alınır; zorunlu organizasyon sürümü, aksi hâlde merkez sürümü, ardından organizasyon sürümü uygulanır. Hâlen zorunlu organizasyon kuralı geçmiş effective_at ile de merkezden değiştirilemez. Gelecek yayın bugünkü sonucu değiştirmez; eski zorunlu sürüm daha yeni tavsiye sürümünü sonsuza kadar kilitlemez.
- `policies_get_v1` etkin çözümlenmiş değerleri ve kaynak scope'u döndürür; `keys:[]` mevcut anahtarları listeler. Eksik politika listede yoktur; zorunlu tüketici eksik yapılandırmayı ayrıca reddeder. Owner/OM organizasyon okur, CM yalnız açıkça seçilmiş yetkili merkezi okur; öğrenci/personel için genel politika kataloğu erişimi verilmez.

Mevcut tüketiciler:
- `session_create_v1` kaynakları ve görevli kişileri uygunluk/istisna açısından denetler. Kaynak yapılandırılmamışsa `POLICY_NOT_CONFIGURED`, uygun değilse `RESOURCE_CONFLICT`; hiçbir kısmi seans/kaynak kaydı oluşmaz.
- `reservation_create_v1` seansın etkin kaynak/görevlilerinin güncel uygunluğunu tekrar denetler. Esnek rezervasyonun açıkça yayımlanmış kayıt penceresi gerekir; pencere dışı `FORBIDDEN`. İstek ayrı yönetici istisnası/gerekçesi taşımadığı için `manager_exception:true` sessiz bypass açmaz.
- Yeni rezervasyonun iptal politikası ortak zorunlu/miras çözümleyicisiyle seçilip ID ile sabitlenir. İptal eski snapshot'ı kullanır; typed `cancellation.terms` ve tarihsel düzleştirilmiş fixture biçimi desteklenir. Negatif kredi limitleri ve blocked etkinlik kredi politikası aynı hiyerarşiyi kullanır.

Açık bağımlılıklar ve sınırlar:
- Program önizleme/uygulama, seans değişiklik/atama ve talep/bekleme/yer teklifi API'leri hâlâ yalnız sözleşmedir; bu PR onları uygulamaz.
- Yapılandırma değişikliği mevcut rezervasyonu iptal etmez, geçmiş hak/borç/hakediş hesaplamaz. Etkilenen mevcut kayıtları gösterip yetkili düzeltme uygulayan akış henüz yoktur.
- Süre dışı gerekçeli yönetici rezervasyonu için mevcut istek yetersizdir; ayrı teknik aktarım gerekir. Genel `request_window`, borçlu rezervasyon/katılım, belgeler, bildirim/CRM, dondurma ve hassas işlem eşikleri için tüketici kabulü bu dört API'nin kaydedebilmesinden çıkarılamaz.
- Yapılandırma okuması politika için mevcuttur; uygunluk listesi/istisna düzenleme API'si bu dört işlem arasında yoktur. Birden fazla kuralın birleştirilmesiyle gece/gün aşan seans uygunluğu bu uygulamada desteklenmez.
- Hosted geliştirme backend'inin önceki 65 işlem smoke'u tarihsel kanıttır; bu PR'nin 69 işlemli temiz kabulüyle karıştırılmaz. Frontend gerçek entegrasyon ve yük/restore açık; dış e-posta ertelendi, Resend başlatılmadı; production dağıtımı yok.

---

# FtkSaaS backend — tarihsel Claude devri

## Önceki doğrulanmış başlangıç — PR #8

Kaynak main `b9bd9c110f0cf4a121eac6ef0752945de99b10ac`; [PR #8](https://github.com/SXQHex/FtkSaaS/pull/8) birleşmiş; [aynı SHA’nın main CI’ı](https://github.com/SXQHex/FtkSaaS/actions/runs/38993548576) başarılı. 22 migration, 181 test (12 sözleşme + 27 DB + 142 Auth/API); 184 operasyonun 65’i çalışan geliştirme uygulaması, 119’u yalnız sözleşme. Bu kanıt belirtilen kaynak içindir; sonraki commit’in CI sonucu ayrıca doğrulanır.

Uzak geliştirme/test Auth → Edge → RPC smoke [ayrı rapordadır](../reports/remote-backend-verification.json); 181 testin uzak projede tekrarı değildir. Geçici fixture temizlendi; ortak tenant/kullanıcı girişi sağlanmadı. Dış e-posta ertelendi; Resend entegrasyonu başlatılmayacak. Yük/restore ve frontend gerçek entegrasyon kabulü açık; production dağıtımı yok.

184 sözleşmeden **65 çağrılabilir / 119 yalnız sözleşme**. `room_save_v1` atomik kapasite, sürüm, tekrar ve rollback; `roles_list_v1` canlı organizasyon/merkez yetkisi, plan erişimi, cursor kapsamı ve `as_of` snapshot sözleşmesiyle çalışır. Owner sanal rol satırı değildir. Mevcut seans/etkinlik kapasitesi yeniden yazılmaz. Önceki 18 migration korunur; 19–21 oda/rol uygulaması ve iki düzeltmedir. Kanıt: `reports/room-role-verification.json`.

## Kullanıcının bildirdiği kalıcı backend hedefi

Supabase `gwyprhenabtpkbojephw` (FtkSaaS, eu-central-1) kullanıcı tarafından geliştirme/test olarak doğrulandı. 21 uygulama migration’ı kuruldu; 22. migration hosted PostgREST’i yerel `api_v1` şema ayarıyla eşleştirir. `core/private` dışarı açılmaz; 65 wrapper yalnız service_role içindir. `backend-v1` Edge Function, doğrulanan main bundle’ından JWT kontrolü açık olarak kuruldu. 90 core tabloda RLS açık; anon/authenticated EXECUTE sıfır. Gerçek Auth → Edge → RPC smoke sonuçları `reports/remote-backend-verification.json` içindedir. Bu smoke 181 testlik yerel/CI kabulünün uzaktan tekrarı değildir; frontend, dış e-posta ve yük/restore kabulü açıktır. Production dağıtımı yasağı sürer. Ayrıntı: `docs/remote-backend-setup.md`.


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

`npm run test:clean` yalnız checkout'ın loopback DB'sini sıfırlar; 22 migration ve boş tenant/Auth/receipt durumu doğrulanır, ardından testler, sentetik seed, sağlık ve DB advisors çalışır. `npm run dev:stop` ortamı durdurur. Özel bağlantı ve reset logları paylaşılmaz.

## Tarihsel uygulama kanıtları ve kapsam

Yeni kişi/merkez/disiplin uygulaması [PR #6](https://github.com/SXQHex/FtkSaaS/pull/6) içindedir. İncelenen uygulama `e4252981871f3aa911257342cde6ebf5f79f82c1`: iki temiz CI çalışmasında 169/169 test (12 sözleşme + 27 DB + 130 gerçek Auth/API), 18 migration, seed/sağlık/advisors başarılı; son inceleme bulgusuz. Kanıt `reports/registry-verification.json` dosyasındadır. Her sonraki belge head’i ve main merge CI’ı ayrıca doğrulanır. Önceki fiilî başlangıç kabulü 148/148 testi kapsıyordu; yeni head için kanıt yerine kullanılamaz.

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

`npm run generate` ortak tipleri, minimal Edge contract/validator/bundle ve katalog/endpoint envanterini üretir; `npm run verify` drift'i reddeder. Yeni değişiklik ayrı branch/PR ve append-only migration ile yapılır. Önceki 11 migration korunmuştur; 12–18. migration yeni registry işlemleri, kişi görünürlüğü ve okuma sürümlerini taşır. Eski wrapper kaynağı tarihsel migration ile sabittir; güncel üretilen wrapper `database/runtime-wrappers-current.sql` dosyasındadır. Yeni API'nin DB kurulumu yeni migration ile taşınır. Historical/transfer scriptleri güncel sözleşmeye körlemesine uygulanmaz.

119 işlem yalnız sözleşme düzeyindedir; tam liste ve bağımlılık sırası `docs/remaining-work.md` içindedir. Kalıcı geliştirme/test backend kurulmuştur; ortak tenant/kullanıcı erişimi sağlanmadı. Dış e-posta ertelendi; Resend başlatılmayacak. Yük/restore ve frontend gerçek entegrasyon kabulü açıktır; production dağıtımı yapılmadı. Frontend kodu/tasarımı Claude'un alanıdır. `vercel.json` main otomatik dağıtımını kapalı tutar; merge production izni değildir.

## Yeni kişi/merkez/disiplin entegrasyonu

- `organization_update_v1`: org.manage; organizasyonun güncel `expected_version` değeri. `organization_get` ve `organizations_list` artık `version` döndürür.
- `center_update_v1`: seçili merkez yöneticisi; güncel merkez sürümü, ad ve IANA saat dilimi. `centers_list` artık `version` döndürür. Değişiklik geçmiş seansların UTC zamanlarını veya satış saat dilimi snapshot’larını yeniden hesaplamaz.
- `disciplines_list_v1`: owner/OM organizasyon kataloğu; CM yalnız erişilebilir atanmış merkezlerinde aktif olarak sunulan aktif disiplinlerin projeksiyonu; diğer roller reddedilir; `page` zorunlu; desteklenen sıralama `created_at_asc`. Yanıt `items/next_cursor`, `as_of` içermez.
- `person_discipline_set_v1`: aynı organizasyon/merkez/disiplin; aktif ilişki için aynı merkezde eşleşen öğrenci/eğitmen ilişkisi gerekir. Öğrenci aktifleştirme veya login/rol grantı yerine geçmez. Güncelleme güncel ilişki sürümünü ister; `person_get.discipline_relationships[].version` ile okunur.
- `student_deactivate_v1`: mevcut merkez öğrenci ilişkisini kapatır. Açık talep/alternatif, rezervasyon, bekleme/yer teklifi, etkinlik kaydı veya hazırlanmış ödeme engeldir. Süresi dolmuş aktif yer teklifi ve bağlı offered liste kaydı aynı kilit/transaction içinde kapanır; geciken worker tek başına pasifliği engellemez. Borç/hak ve hesap/rol bağları silinmez. Başka merkez öğrenci ilişkisi bu komutla kapatılmaz.
- `person_get_v1` / `people_list_v1`: owner/OM organizasyon okumaları; merkez operasyon okuyucuları seçili merkezle ilişkili kişiler; öğrenci yalnız kendi kaydı; canlı görevlendirmesi olan I/A gerekli katılımcı alanları. I/A iletişim alanını alamaz. Merkez seçiliyse başka merkez ilişkileri yanıta konmaz. Mevcut kişilerde aktif merkez ilişkisi aranır. İlk ilişki kurulmadan önce yalnız teknik oluşturma kaydıyla aynı merkeze ait kişi açılır; kökeni bilinmeyen ilişkisiz kayıtlar kapalı kalır. Pasif ilişki operasyon okuma/yazma yetkisi vermez. Kişi listesi `created_at_asc`; cursor aynı filtre/kapsama bağlıdır.
- `person_update_v1`: CM veya açık person.manage personel grantı; hedef kişinin aktif merkez ilişkisi (ilk ilişki öncesinde aynı oluşturma merkezi) ve güncel kişi sürümü gerekir. Contacts patch’i listeyi değiştirir; aynı kind/value kanıtı korunur, yeni adres doğrulanmış sayılmaz. Auth kimliği veya hesap bağlantısı değiştirilmez.

İşlem adı ortak tiplerden seçilir. Yeni yazmalar da aynı receipt/audit/outbox transaction ve canlı yetki kontrolünden geçer. Görünürlükte rol/bağ geri alma bir sonraki istekte geçerlidir. Yeni bir ürün iptal, para veya hakediş kuralı eklenmedi.

</details>

P01 request_window istisna DTO'su create/offer_alternative/accept_alternative için optional window_exception ve reason içerir. True yalnız politika izinli canlı CM'nin açık, gerekçeli işlemidir; varsayılan false, eksik politika kapalı. Son kapsam ve yeni runtime kabulü docs/p01-handover.md içindedir.

