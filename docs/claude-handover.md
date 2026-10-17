# FtkSaaS backend — güncel Claude devri

## Doğrulanmış başlangıç — 17 Ekim 2026

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
