# Claude frontend entegrasyon talimatları

23 Ekim 2026. Belge tabanı main `bfb8ccb29a1e0ca9efde7813dc3af4bbbad8768d`. Frontend tasarım/istemci kodu Claude'un alanıdır; backend bu teslimde tasarıma müdahale etmez. Bu dosya Claude'un açıkça okutulacak başlangıç talimatıdır; repository'de kök `CLAUDE.md` veya `.claude` yapılandırması bulunmuyor. Dosyanın Claude tarafından kendiliğinden yüklendiğini varsayma.

## Önce okunacak kaynaklar

1. [AGENTS](../AGENTS.md), [kaynak indeksi](source-index.md), [tek güncel devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md).
2. [Ürün](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), [teknik sözleşme ve settings](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti), [alan sahipliği](../contracts/03-FtkSaaS-kodlama-sorumluluklari.md), [durum/hata/izin](../contracts/06-FtkSaaS-O4-durum-hata-izin.md).
3. [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json), [üretilmiş TypeScript operasyonları](../packages/contracts/src/operations.ts), [runtime adları](../packages/contracts/src/runtime.ts), [endpoint envanteri](endpoint-inventory.json).
4. [Kalan işler](remaining-work.md), [üretim kuyruğu](production-queue.md), [hosted kurulum](remote-backend-setup.md). Modül devirleri işlem ayrıntısı için kullanılır; eski source/pending etiketleri güncel teslim durumunu belirlemez.

## Mevcut backend ve ortam

200 sözleşme/200 callable runtime/0 contract_only;59 migration/90 core tablo/Edge8. P01–P07'nin kaynak/full-clean/main/CD kabulü kapandı. Son runtime main `4cfc9a55`; PR41 belge main `bfb8ccb2` yalnız belge kabulünden geçti, CD deploy skipped. Ayrıntılı run/tree/receipt kanıtları tek devirdedir. Yerel, henüz yayımlanmamış 208 API/60. migration settings taslağı kullanılmaz.

Paylaşılan **geliştirme/test** hedefi `https://gwyprhenabtpkbojephw.supabase.co`; Edge yolu `/functions/v1/backend-v1/{operation}`. Bu ortamda gerçek ilk kurulum verileri var; reset/seed/test:clean çalıştırma ve gerçek kişiyi test fixture'ı yapma. İzole yerel ortam `npm run dev:start`, sentetik `npm run dev:seed`, bağlantı `npm run dev:info` ile hazırlanır. `docs/development-connection.json` içindeki eski22-migration ve report sayıları ilk kurulum snapshotıdır; güncel durum için kullanılmaz.

İstemciye yalnız proje publishable key ve kullanıcı access tokenı verilir. Publishable key bu belgede yayımlanmaz; ortamın güvenli yapılandırmasından alınır. `service_role`, Management PAT, DB parolası ve public ingress/Turnstile secret'ı istemciye, kaynak koduna veya rapora konmaz. `.dev/frontend.env` ve sentetik giriş dosyaları yerel üretilir; gerçek parola/tokenlar paylaşılmaz.

## Tasarım kararı ile mevcut API ayrımı

| Ayar alanı | Kabul edilmiş hedef | Bugün kullanılabilen yol ve açık sınır |
|---|---|---|
| S01 Profil | Görünen ad, hitap, fotoğraf ve ayrı görünürlük | `account_get_v1` ve `account_profile_update_v1` yalnız display_name; yazma sürümü `management_state_get_v1` ile okunur. Hitap/fotoğraf/görünürlük alanları bu DTO'da yok. |
| S02 Kimlik iletişim | Ad ve doğrulanmış iletişimin aktif bağlı orglara onaysız yansıması | Mevcut display_name komutu bu akışın bütünü değildir. Global yasal ad, e-posta/telefon doğrulama ve yayılma için alan bazlı API/sağlayıcı analizi bekler. |
| S03 Bağlantılar | Güvenli mevcut kişiye bağlama, kaldırma ve yeni yetkiyle yeniden bağlama | `account_access_send/accept/revoke_v1`, `account_link_remove_v1`, `person_merge_*` mevcut komutlarıdır; her biri kendi yetkisine tabidir. Kullanıcının kendi bağlantısını kaldırma hedefi mevcut CM komutuna otomatik eşitlenmez. Abone numarası P08'dir. |
| S04 Şifre | Ekle/değiştir/kurtarma ve kabul edilmiş oturum kapatma | `account_password_change_v1` challenge başlatır; tamamlama native Auth'tadır. `account_password_reset_request_v1` korumalı recover başlatıcısıdır. Kabul edilmiş tüm oturum temizliği ve dış teslim hazır varsayılmaz. |
| S05 Sağlayıcı MFA | Güvenli ekleme/kaldırma, son giriş yöntemi koruması | Google/Apple/passkey/MFA yöntem seçimi ve gerçek sağlayıcı entegrasyonu açık; katalogdaki varlık destek kanıtı değil. |
| S06 Oturumlar | Kendi oturumlarını gör/kapat; güven kaydını ayrı yönet | Mevcut canlı session kapıları oturum listeleme/etiketleme/tüm cihaz yönetimi API'si var anlamına gelmez. Yeni alanlar/sağlayıcı eşlemesi bekler. |
| S07 Dil bölge saat | Hesap manuel/cihaz otomatik tercihleri; iş zamanı sabit | Genel tercih saklama DTO'su yok. İşlem saatleri mevcut Instant ve merkez saat dilimi kurallarıyla okunur; istemci görünüm tercihi iş zamanını değiştiremez. |
| S08–S10 Görünüm ve bağlam | Erişilebilirlik, başlangıç, ekran/takvim tercihleri | Yerel görünüm tasarımı yapılabilir; hesapta kalıcı tercih senkronizasyonu mevcut200 API'de var sayılmaz. Yetki/alan filtreleri backend'den gelir. |
| Bildirim tercihi | Ayrıntılı olay/kanal/sessiz saat grupları henüz açık | `notification_preferences_set_v1` ve yetkili management okuması mevcut. Amaçlar transactional/reminder/marketing; mevcut yol in_app, transactional=false ret. Enum'da email olması dış teslim kanıtı değildir; push/SMS yeni enum gibi eklenmez. |
| Reklam ölçüm ve analitik | Üç ayrı tercih varsayılan açık/kapatılabilir; ayrıntılar açık | Tercih değeri rıza/dayanak değildir. Yeni SDK/toplama entegrasyonu bu belgeyle etkinleştirilmez. İzin, teknik etkinlik ve sağlayıcı desteği ayrı. |
| Merkez/org/platform | Katalog aileleri aday; mevcut ürün korumaları kesin | Mevcut `policies_get/policy_publish`, availability, registry, belge/otomasyon ve abonelik komutları kullanılır. Generic settings read/write endpoint'i yayımlanmadı. |

S01–S10 ürün davranışları kabul edilmiş olmakla birlikte tüm alanlar uygulanmış değildir. Kalan altı kullanıcı teması ve C/O/P grupları tamamlanmadan yeni API alanı, değer veya sağlayıcı davranışı uydurma. Aynı durumun tasarım prototipi ile gerçek API kaydetme başarısını ayır; desteklenmeyen alan için sahte başarılı kayıt üretme.

## İstek yanıt ve sürüm kuralları

İnsan işlemleri `POST {API_URL}/functions/v1/backend-v1/{operation}` üzerinden doğrudan typed Request JSON ile yapılır. Başlıklar `Authorization: Bearer <Supabase access_token>`, `apikey: <publishable key>`, `Content-Type: application/json`. Named `/rest/v1/rpc` backend/service-only'dir; `core/private` tablolara doğrudan yazma veya SQL yoktur. `backend-v1 verify_jwt=true` korunur.

- `request_id` ve gereken `operation_key` doğrulanmış UUIDv7; domain kimliklerini backend üretir, Auth sağlayıcı kimliği aynen kalır. Kullanıcı işlemi retry edildiğinde operation_key korunur; transport request_id değişebilir.
- `expected_version` yalnız ilgili komut istiyorsa kullanılır. Okuma projeksiyonu ve hedef entity bağlamı tamdır. `account_get` bir profil write-version kaynağı değildir; management okuması kullanılır. Append-only policy_publish'e rastgele expected_version eklenmez.
- Başarı yalnız HTTP200 değildir; `ok`, typed `data` ve iş sonucunu kontrol et. Hata `{ok:false,error:{code,retryable,trace_id}}`; metin parse etme. Timeout sonucu bilinmiyor demektir: aynı anahtar/status/replay yolu kullanılır. Yeni anahtarla kör tekrar yoktur.
- Eski preview/sürüm, değişen yetki/plan/tenant, yetersiz hak/kontenjan/politika durumları ayrı ele alınır. Kural hatası otomatik retry ile çözülmez. Page/sort/cursor mevcut DTO sınırlarındadır.
- Tanınmayan alanlar reddedilir; null/optional/false/sıfır aynı değildir. Backend'in döndürmediği yetkisiz alanı istemcide varmış gibi üretme. Sütun gizleme güvenlik değildir.

Profil güncellemenin mevcut örneği (UUID alanları çalışma anında gerçek değerlerle doldurulur):

```json
{
  "client_api_version": 1,
  "request_id": "<UUIDv7>",
  "operation_key": "<işlem boyunca sabit UUIDv7>",
  "expected_version": 1,
  "display_name": "Yeni görünen ad"
}
```

Bu yalnız şema örneğidir; expected_version=1 varsayılmaz, management okumasından gelir. Kullanıcı ad/soyad/iletişim yayılma hedefinin tamamını temsil etmez.

## Yetki zaman ve iş sonuçları

Owner olmak CM operasyon yetkisi vermez. Merkez, disiplin, plan, canlı bağlantı/grant ve alan görünürlüğü her istek için backend'de doğrulanır. Rol/görünüm seçimi veya kayıtlı filtre yeni yetki üretmez. Aynı kişi A ve B merkezlerinde açık yetkiliyse hesaplaşmanın iki tarafını da yapabilir; A-only B onayı vermez.

UTC Instant, merkez iş saati ve kullanıcının görüntüleme saati ayrıdır. Kullanıcının tarih/saat biçimi veya timezone seçimi seansın gerçek zamanını, iptal parasal sınırını veya paket geçerliliğini değiştirmez. Erişim kaybolunca eski ekrandaki veri ve seçenekler kullanılmaz; başka tenantın varlığı hatadan açıklanmaz.

## Sağlayıcı ve yaşam döngüsü sınırları

Dış e-posta/Resend, gerçek frontend entegrasyon kabulü ve yük/restore açık. Native Mailpit kabulü dış teslim kanıtı değildir. Public başvuruda JWT gateway credential, signed ingress, Turnstile hostname/action ve hız kapıları mevcut P04 sözleşmesine tabidir; iki web formu için telefon tabanlı genel CRM kabulü P08'dir. Güvenlik/bot kapıları kaldırılarak demo yapılmaz.

`account_delete_*` ve `organization_*` lifecycle komutları mevcut; fiziksel imha kanıtı eksikse partial/pending ve completed_at=null korunur. Kullanıcının talebi iptal etme veya kişisel veri export akışının tamamı otomatik hazır sayılmaz. Beş Cron'un idle çalışması gerçek iş yükü veya fiziksel imha kanıtı değildir.

## Claude teslim kontrolü

- Tasarımda kullanılan her kayıt yolu için gerçek operation + request/response alanı + permission + sürüm/preview kaynağı yazılır. API boşluğu mevcut iş kuyruğuna sözleşme önerisi olarak iletilir; backend source/migration Claude tarafından değiştirilmez.
- Yalnız callable sözleşmeye uyan mock gerçek entegrasyonun yerine geçmez. Yeni kabul edilmiş ekran davranışı statik tasarımda gösterilebilir; buna hayali endpoint veya başarılı kaydetme yanıtı eklenmez. Üretimde mock fallback yoktur.
- Gerçek testler sentetik kullanıcı/tenant ve yetkili ortamda yapılır; paylaşılan gerçek kurulum verisi resetlenmez. Başarı, ret, erişim geri alma, stale version, timeout/replay ve alan gizliliği kabulü ayrı kanıtlanır.
- Ortak tipler elle kopyalanmaz. Güncel package yolu `packages/contracts` ve üretilmiş operations.ts'dir; kullanıcı tarafından kararlaştırılmış `packages/api-contracts` düzenleme hedefi mevcut dosya yolu gibi import edilmez. Solito kullanılmaz; monorepo reorganizasyonu backend davranışını değiştirmez.
- Kendi frontend tasarımını/istemci kodunu kendi alanında sürdür. Bu backend belge teslimi frontend framework, ekran yerleşimi veya deployment değişikliği yapmaz. Main merge production izni değildir.

## Mevcut finans ve etkinlik entegrasyon ayrıntıları

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


## Organizasyon renk ve font paketleri — frontend ihtiyaç notu

23 Ekim 2026, SaaSPT frontend oturumunda kullanıcı tarafından kabul edildi. İncelenen backend main: `702063807b0a0d09f559f070ffde1b1ae3e7563b`. Bu kayıt backend'e iletilen ürün kararı ve entegrasyon ihtiyacıdır; callable API/DTO, migration veya runtime teslimi değildir. Settings davranış sprinti tamamlanmadan yeni settings runtime/DTO/API geliştirmeme talimatı korunur. Bu dar kabul, diğer aday C/O/P ayar ailelerini topluca onaylamaz.

### Kabul edilen davranış

- Organizasyon kendi marka renk paleti ile başlık/gövde font paketini, sistemin sunduğu hazır paketler arasından seçebilir. Logo marka öğesidir; yükleme/değiştirme hattının mevcut desteği ayrıca eşlenir.
- İlk kapsam serbest renk girişi, rastgele font/CSS/HTML veya özel font yükleme değildir. Paketler kontrast ve desteklenen dillerin glifleri, Türkçe karakterler, LTR/RTL düzeni açısından kontrol edilmiş olmalıdır.
- Hata, uyarı, başarı ve klavye odağı gibi semantik durumların renk/işaretleri sistem denetimindedir. Organizasyon markası erişilebilirliği veya durumun anlamını bozamaz; yalnız renkle bilgi verilmez.
- Organizasyon markası ile kullanıcının açık/koyu/sistem görünüm tercihi ayrı tutulur. Kullanıcının yüksek kontrast, yazı ölçeği ve azaltılmış hareket gereksinimleri marka seçimiyle devre dışı bırakılamaz. S08 hesap/cihaz ayrımı korunur.
- Organizasyon seçimi organizasyona aittir; kişisel tema tercihi başka organizasyonların marka ayarlarını değiştirmez.
- SaaSPT'deki Akış/Sahne/Atölye yalnız yerel tasarım önerileridir. Bu kabul bu isimleri, kesin renkleri veya fontları yayımlanmış katalog olarak onaylamaz.

### Backend'den beklenen sözleşme eşlemesi

Aşağıdaki isimler ihtiyacı anlatan öneri alan adlarıdır; mevcut DTO, enum, tablo veya endpoint adı olarak kullanılmaz.

| İhtiyaç | Beklenen anlam / sınır |
| --- | --- |
| Paket kataloğu | İzin verilen renk ve font paketlerinin kararlı kimliği, görüntüleme adı, sürümü/uyumluluk bilgisi, seçilebilirlik durumu ve güvenli varsayılanı. Renk-font eşleşmelerinin serbest mi yoksa uyumlu kombinasyonlarla mı sınırlı olduğu netleştirilmeli. |
| Organizasyon marka okuması | Yetkili org bağlamında seçili renk paketi (`theme_package_id`), font paketi (`font_package_id`), varsa güvenli logo asset referansı, ayar sürümü ve etkin fallback bilgisi. ID ile bütünlüğü doğrulanan katalog kullanılır; istemci keyfi CSS/font URL'si çalıştırmaz. |
| Marka yazma / sıfırlama | Seçili paketi değiştirme ve sistem varsayılanına dönme ihtiyacı. Null, belirtilmedi ve sıfırlama anlamları açıkça ayrılmalı; kimlik/yetki canlı backend bağlamından alınmalı. |
| Kişisel görünüm okuma / yazma | Açık/koyu/sistem tercihi ve mevcut S08 kapsamı org markasından ayrı; kişisel tercih sıfırlaması org markasını, org marka sıfırlaması kişisel erişilebilirlik/tema tercihini değiştirmez. |
| Sürüm ve çakışma | Eşzamanlı iki yöneticinin değişiklikleri sessizce birbirini ezmemeli. Mevcut sözleşme modeline uygun sürüm/çakışma semantiği belirlenmeli. Kim değiştirdi/ne zaman/sürüm bilgisi ve yetkili audit okuması eşlenmeli. |
| İstemciye yayılım | Yenileme/yeniden giriş ve org değiştirmede doğru marka çözülmeli. Org A'nın önbelleği B'ye taşınmamalı. Cache anahtarı/invalidasyon ve eski istemcinin tanımadığı paket sürümü için güvenli fallback tanımlanmalı; WebSocket zorunluluğu veya anlık yayılım SLA'sı kabul edilmedi. |
| Logo | Mevcut asset/Storage hattı bulunup alan/izin eşlenmeli. Uygun tür/boyut sınırları, kaldırma, tenant sahipliği ve güvenli sunum belirlenmeli; keyfi harici kaynak veya özel font yükleme yetkisi türetilmez. |
| Ortak tipler ve hatalar | Kesin operasyon, Request/Response/Error, permission/scope ve sürüm kaynağı backend'in makine sözleşmesinde belirlenip `packages/contracts` tiplerine üretilmeli. Frontend elle paralel API tipi yazmaz. Geçersiz/kullanımdan kalkmış paket, yetkisiz erişim ve stale sürüm durumları ayırt edilmeli. |

Frontend paketlerin token/font eşlemesini, responsive yerleşimi ve erişilebilir render'ı üstlenir. Backend kalıcı seçimin ve izinli kataloğun sözleşmesini, canlı yetkiyi, tenant izolasyonunu ve sürüm/denetim davranışını sağlar. Katalog dosyasının nerede tutulacağı ve nasıl sürümleneceği uygulama analizinde netleştirilir; yeni veri modeli bu notla dayatılmaz.

### Yetki ve kapsam — backend'de kesinleştirilecek

- Marka değiştirme organizasyon kapsamındadır. Mevcut sözleşmeye göre Owner veya açıkça yetkilendirilmiş OM/ilgili permission eşlemesi backend tarafından belirlenmeli; yeni izin anahtarı bu notta icat edilmez.
- Merkez yöneticisi, öğrenci veya eğitmen rolü tek başına org markasını değiştirmez. Owner'ın marka yetkisi merkez operasyon yetkisi yaratmaz.
- Kişinin yalnız kendi kişisel görünümünü değiştirmesi, başka hesabın tercihlerini değiştirme yetkisi vermez.
- Okuma kitlesi, erişimi geri alınmış bağlamın temizlenmesi ve girişsiz sayfalarda marka gösterimi ayrı karara bağlanmalı. Merkez override'ı, planlara göre paket kilidi ve platform operatörünün org adına değişikliği bu kabulle onaylanmadı.
- Hazır fontların lisans/dağıtım ve dil desteği doğrulanmalı; somut font listesi ile desteklenen dil listesi henüz seçilmedi.

### Kabul senaryoları — uygulama tesliminde kanıtlanacak

1. Yetkili aktör izinli bir paketi seçer; yeniden okuma/yenilemede aynı org markası görülür. Kullanıcının koyu/açık/sistem tercihi korunur.
2. Yetkisiz veya yetkisi geri alınmış aktör kaydı değiştiremez; başka org'un seçimi/logosu okunamaz veya değiştirilemez.
3. A ve B orgları arasında geçişte doğru paket/font/logo gösterilir; önbellek başka org'un markasını taşımadan güncellenir.
4. Eşzamanlı eski sürümlü yazma sessiz veri kaybı üretmez; istemci yeniden okuyarak çakışmayı çözer. Aynı işlem retry'si sözleşmenin operation_key/idempotency kurallarını korur.
5. Geçersiz/kullanımdan kalkmış veya eski istemcinin tanımadığı paket güvenli biçimde ele alınır; okunamayan font yerine erişilebilir fallback kullanılır.
6. Uzun metin, Türkçe karakter, seçilen diller, LTR/RTL, klavye odağı, yüksek kontrast ve büyütme paket kombinasyonlarında korunur.
7. Org varsayılanına dönüş ile kişisel görünüm sıfırlaması birbirinin verisini değiştirmez; logo kaldırma başka org varlığını etkilemez.
8. Desteklenmeyen kayıt yolu frontend'de sahte başarılı kayıt üretmez. Katalog/okuma/yazma/izin/ortak tip eşlemesi yayımlanana kadar yerel önizleme açıkça yerel kalır.

Açık teslim: mevcut alan/API analizi, kesin yetki eşlemesi, katalog yaşam döngüsü ve fallback, logo hattı, ortak tipler, backend kabul testleri ve gerçek frontend entegrasyonu. Bu belgeyle settings API geliştirmesi başlatılmaz; runtime ve üretim kabulü iddia edilmez.
