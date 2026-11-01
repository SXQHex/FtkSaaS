# Starter frontend geliştirme yol haritası

Amaç: Bir Starter stüdyosunun kuruluşundan günlük ders, öğrenci, satış, rezervasyon, yoklama ve tahsilat yönetimine; öğrencinin kendi hesabından işlem yapmasına kadar bütün izinli akışları web arayüzünde tamamlamak.

Bu belge Starter frontend'in uygulama ve takip planıdır. Modül adımları, aktif bölüm, sıra, bağımlılıklar ve frontend kabul kanıtları burada tutulur. Frontend bölüm planı ve kabul takibinin sahibi bu dosyadır; ürün kararı, proje iş akışı ve API sözleşmesi kök `/docs` kaynaklarından tüketilir. Frontend planlama işi backend kodu veya ortak ürün kararı değiştirme yetkisi vermez. Bu dosya frontend bağımlılık gözlemlerini tutar. Karşı alana somut talep, değerlendirme/onay ve teslim durumu yalnız [ortak talep kaydında](../../../docs/requests.md) tutulur; burada ilgili talep kimliği ve frontend etkisi bulunur. Talep kaydı backend işini kendiliğinden başlatmaz. İşaretli bir ekran veya başarılı mock testi, modülün canlı kabulü değildir.

## 1. Kaynak ve değerlendirme yöntemi

Plan, mevcut `src/app`, `src/components`, `src/lib/api.ts` ile aşağıdaki ürün ve backend kaynakları birlikte incelenerek hazırlanmıştır. Kaynak envanteri PR91'in bulunduğu main `5455ba824868e30adac131993608e81477a3b461` ile karşılaştırılmıştır; bu envanter tek başına canlı kabul kanıtı değildir. Repo/backend kaynak ve CI snapshot'ı [00 devirde](../../backend/docs/00-FtkSaaS-yeni-sohbet-devir.md), frontend bölüm kabulü burada tutulur. Backend değiştiğinde geliştirmeye başlamadan ilgili DTO, selector ve yetki tekrar okunur.

| Konu | Yetkili kaynak |
|---|---|
| Ürün kapsamı ve Starter sınırları | [Ürün sözleşmesi](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), [WF00](../../../docs/workflows.md#wf00) |
| İstek/yanıt, hata, sürüm, plan ve izin | [Makine sözleşmesi](../../../packages/api-contracts/schema/contract.json), [üretilmiş tipler](../../../packages/api-contracts/src), [operasyon envanteri](../../../docs/endpoint-inventory.json) |
| İstemci ve veri bütünlüğü | [İstemci protokolü](../../../docs/client-integration.md), [durum/hata/izin](../../../docs/contracts/06-FtkSaaS-O4-durum-hata-izin.md) |
| Program, rezervasyon ve haklar | [WF03 program](../../../docs/workflows.md#wf03), [WF05 satış/hak](../../../docs/workflows.md#wf05), [WF06 rezervasyon/talep](../../../docs/workflows.md#wf06), [WF07 yoklama](../../../docs/workflows.md#wf07) |
| Finans, belge, rapor ve import | [WF08 finans](../../../docs/workflows.md#wf08), [WF11 belge](../../../docs/workflows.md#wf11), [WF10 rapor/import](../../../docs/workflows.md#wf10) |
| Public, hesap ve abonelik | [WF09 public](../../../docs/workflows.md#wf09), [WF17 hesap/abonelik](../../../docs/workflows.md#wf17) |
| Ayar alanları ve tüketiciler | [Ayar rehberi](../../../docs/settings.md) |
| UI ve kabul araçları | [Web geliştirme rehberi](development.md), [CI politikası](../../../docs/ci-policy.md) |

Emekli alan devirleri güncel kaynak değildir; WF rehberi ve makine sözleşmesi kullanılır. “Aday”, “contract_only” veya tarihli test sayıları güncel kaynak/kabul kontrolünün yerine geçmez. Endpoint adının envanterde bulunması, bütün selector'larının çalıştığı veya frontend'in bağlı olduğu anlamına gelmez. Özellikle `management_state_get_v1` her işlem için ayrı değerlendirilir.

## 2. Ürün sınırları

Bu liste [01 ürün kapsamının](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) frontend plana yansımasıdır; ikinci ürün kararı kaynağı değildir. Davranış ayrıntısının sahibi [02 teknik sözleşme](../../../docs/contracts/02-FtkSaaS-teknik-sozlesme.md) ve [WF rehberidir](../../../docs/workflows.md).

- Starter: 1 aktif merkez, 1 aktif oda, 1 aktif disiplin, 1 aktif eğitmen ve 100 aktif öğrenci. Aynı kişinin mükerrer sayılması ve eşzamanlı son slot yarışı backend'in sorumluluğudur.
- Tüm seanslar tek mantıksal oda ve geçerli eğitmen kapsamında yürür. Seans/kategori kontenjanı fiziksel oda kapasitesiyle tutarlı olmalıdır.
- Kredili, dönemsel kotalı ve sınırsız süreli ürünler desteklenir. Paket seçili merkez/disiplin kapsamındadır; adı kayıtlı disiplin adıyla başlar. Eski satışın koşulları yeni ürün sürümüyle değiştirilmez.
- Öğrenci self rezervasyonu, özel ders talebi, dar public ders başvurusu, anlaşmasız/hakedişsiz yoklama ve manuel finans akışları kapsamdadır.
- Starter'a personel izin yönetimi (F05), bekleme/yer teklifi (F12), paket dondurma/değişim (F17), merkezler arası hesaplaşma (F18), hakediş (F20), genel CRM/deneme kampanyası/takip/otomasyon (F21–F24), otomatik hatırlatmalar (F27) ve etkinlik/workshop/parti (F29) eklenmez. Ortak API ailesindeki alt işlem ayrıca plan kapısından geçirilir.
- SaaS planı yükseltme/düşürme F32'dir; öğrenci paketinin F17 kapsamındaki değişimiyle karıştırılmaz. F25 ders başvurusu da genel CRM yetkisi değildir.
- Fiyat, çalışma saati, iptal penceresi, vade, hukuki metin, özel limit ve sağlayıcı ayarı uydurulmaz. Backend'in açık defaultu dışında eksik değer kurulum gerektirir.
- Syncfusion `SessionCalendar` içinde kalır. Yeni modülleri somut geliştirme faydası varsa değerlendirilir; tek ürün ailesini kullanmak teslim koşulu değildir. Expo bu planın dışındadır.

## 3. Mevcut kaynaktan devralınacak temel

Bu tablo kodun başlangıç envanteridir; canlı kabul kaydı değildir.

| Alan | Kaynakta bulunan temel | Tamamlama işi |
|---|---|---|
| Kimlik | Giriş, kayıt, kurtarma, Google dönüşü, TOTP ve korumalı route | Gerçek sağlayıcı kabulü; hesap/oturum/güvenlik/davet kabulü ve lifecycle ekranları |
| Kabuk | Gerçek hesap/organizasyon/merkez okumaları, mobil menü, TR/EN ve tema | Role uygun başlangıç, işlem bağlantıları, yenilemede korunabilen gezinme ve erişim kaybı |
| Takvim | Gün/hafta/liste, gerçek seans detayı, korumalı doğrudan seans route'u | Sınıf/program/tek seans oluşturma, tam kaynak ataması, iptal/telafi ve lisanslı Scheduler kabulü |
| Seans değişikliği | Saat ve kontenjan preview/apply, sonuç kurtarma | Oda/eğitmen ve seri DST seçimleri, yetkili eylem görünürlüğü, hosted kabul |
| Öğrenci | Arama/sayfalama, kişi oluşturma/düzenleme, öğrencilik, davet işi | Disiplin ilişkisi, kişi birleştirme, davet/link yönetimi ve diğer modüllere gerçek bağlantı |
| Paket, finans, rapor, inbox | Kabukta hazırlık görünümü; tasarımda sentetik örnekler | Canlı okuma ve bütün izinli yazma akışları |
| Ayarlar | Kullanıcı ayarını okuma ve bazı görünüm tercihleri | Scope/sürüm/default/miras/reset ve gerçek alan tüketicileri |

`/tasarim`, `/tasarim/seans` ve `/tasarim/ogrenciler` referans/fixture alanlarıdır. Bu alanların etkileşimleri canlı iş tamamlanması olarak işaretlenmez. Yeni ekranlar mevcut bileşenleri geliştirir; çalışan Auth/takvim/öğrenci temeli yeniden yazılmaz.

## 4. Ortak uygulama koşulları

Her modül aşağıdaki koşullarla tasarlanır; bunlar en sonda eklenecek ayrı bir cilalama işi değildir.

### Kimlik, rol ve gezinme

- Yönetici, atanmış eğitmen ve öğrenci için görev odaklı giriş görünümü; aynı hesap birden çok role sahipken açık bağlam. Owner/OM olmak CM işletim yetkisi olarak yorumlanmaz.
- Mevcut `/organizasyon/[orgId]/seans/[sessionId]` route'u ve Auth dönüşü korunur. Yeni detay/işlem bağlantıları yenileme, geri/ileri, giriş sonrası dönüş ve erişim kaybı senaryolarına sahip olur. Yeni route adları uygulama diliminde kararlaştırılır.
- Menü/görünürlük gerçek hesap, rol, abonelik ve desteklenen yetki projeksiyonlarından beslenir. Eksik capability okuması frontend'de tahmin edilmez; bağımlılık kaydı açılır. Her yazmada backend yetkiyi tekrar denetler.
- Başka kullanıcı/merkez bağlamına geçişte eski sonuç, cursor, seçili kişi ve form taşınmaz. Çıkışta hassas istemci durumu temizlenir; geç gelen istek yeni oturumu etkileyemez.

### Veri ve yazma davranışı

- Üretilmiş DTO + mevcut typed transport kullanılır. Core/private tablo veya service-only RPC istemciye açılmaz.
- Yükleniyor, boş, arama sonucu yok, kısmi sayfa, hata, yetki kaybı, kapalı plan ve yeniden deneme ayrı durumlardır. Hatalı yenilemede eski veri güncel gibi görünmez.
- Sadece sözleşmenin istediği komuta gerçek `expected_version` gönderilir. Sürüm istemcide artırılmaz; başka varlığın sürümü yerine kullanılmaz.
- Preview sonuçları etki/engel ve süre bilgisiyle gösterilir. Form değişince eski preview geçersizdir; apply ayrı kullanıcı onayı ister. Tek adımlı komuta sahte preview endpoint'i eklenmez.
- Aynı işte aynı `operation_key` ve aynı payload; her transport denemesinde yeni `request_id`. Çift tıklama, kayıp yanıt, remount, `NOT_FOUND`, erişim kaybı, süre dolması ve payload uyuşmazlığında güvenli kurtarma bulunur. Belirsizlik yeni anahtarla kapatılmaz.
- İş tamamlandı, worker işi tamamlandı, e-posta teslim edildi ve kullanıcı daveti kabul etti durumları ayrı gösterilir. Worker endpoint'leri tarayıcıdan çağrılmaz.
- Para minor-unit/string sözleşmesine uygun tutulur; JavaScript kayan nokta aritmetiğiyle mali sonuç hesaplanmaz. Para birimleri birleştirilmez. Tarihler cihaz/merkez saat dilimi açıkça belirtilerek sunulur; iş kuralları backend saatindedir.
- Takip kayıtlarında Auth tokenı, imzalı dosya URL'si veya medya bytes'ı tutulmaz. Kurtarma için zorunlu kişisel veri en dar sekme/hesap bağlamında tutulur, kesin sonuçta kaldırılır ve log'a yazılmaz.

### UI/UX ve erişilebilirlik

- Mevcut shadcn/ui tabanı, nötr tema ve bilgi hiyerarşisi korunur. Liste → detay → ilgili işlem; uzun işlemlerde adımlı form ve son kontrol özeti. Küçük ekranda temel eylemler erişilebilir kalır.
- TR/EN hata, başarı, boş durum, tarih/sayı ve sayfa başlığı; açık/koyu/sistem tema. Çeviri anahtarı kullanıcıya sızmaz.
- 320px ve %200 metinde içerik/eylemler kırpılmaz. Klavye sırası, görünür odak, panel kapanışında odak dönüşü, form etiketi ve hata ilişkisi, canlı durum duyurusu ve tam axe kontrolü gerekir.
- Kullanıcıya teknik operation key/selector/SQL ayrıntıları gösterilmez. Desteğe iletilecek hata referansı gerektiğinde güvenli biçimde sunulur.

## 5. Backend ve ortam bağımlılıkları

| Kimlik | Gereksinim / gözlenen sınır | Sahip ve kapanış kanıtı | Etkilenen iş |
|---|---|---|---|
| B01 | Mevcut oda/sınıf/program seçimi için canlı liste/detay ve gereken sürüm okumaları | Backend: desteklenen typed okuma, tenant/rol/plan/cursor/sürüm davranışı. Formlar mevcut kayıtlarla yeniden açılabilmeli; UUID elle girme veya sentetik fallback kabul edilmez. | S02, S03, sabit grup ataması |
| B02 | Bağlamsız kişi hesabı bağlantı özeti ve belge özeti mevcut kişi DTO'sunda yok | Profilde yalnız dönen veri kullanılır. Genel özet istenirse backend okuması ayrı tanımlanır. Belge gerekliliği gerçek işlem bağlamından okunur. | S04, S11 |
| B03 | Davet/kayıt/kurtarma için dış e-posta ve Google/TOTP sağlayıcı kabulü | Ortam sahibi + frontend: mevcut yapılandırma yeniden doğrulanır, gerçek teslim/dönüş denenir. Önceki sentetik SMTP veya job success dış teslim kanıtı değildir. Native Auth SMTP/Resend’in geçmiş kabulü mevcut kabul kaydından doğrulanır; uygulama davet/bildirim göndericisinin kabulü değildir. Ertelenen yeni dış e-posta/Resend entegrasyonu veya gönderimi bu planla başlatılmaz; bu ayrım mevcut native Auth kabulünü geri almaz ve uygulama kanalının eksik kabulünü kapatmaz. | S01, S04 |
| B04 | Public signed ingress, gerçek hostname/action/Turnstile; ICS origin/host/template/signing hazırlığı | Backend/ortam sahibi sağlar; frontend gerçek sağlayıcı ve yetkili seans hedefiyle kabul eder. `service_ready` tek başına kullanıcı yetkisi veya servis kabulü değildir. | S09 |
| B05 | Rapor/import/belge için tenant teknik limit/config ve çalışan iş hatları | Backend/ortam sahibi: private yükleme, checksum, worker ve indirme yetkisi kanıtı. Eksik config güvenli kurulum mesajı olur. | S10, S11 |
| B06 | Eylem izinleri ve bazı yönetim/detail selector'ları işlem bazında doğrulanmalı | Her modülün ilk işi gerçek okuma→sürüm→komut matrisi. Eksik projection somutlaştığında ortak talep kaydı açılır, bu plana yalnız talep kimliği bağlanır; “endpoint var” kabulü yetmez. | Tüm modüller |
| B07 | Kurulu sürüme uygun Syncfusion anahtarı ve gerçek Scheduler tarayıcı kabulü | Ortam sahibi + frontend: anahtarın build'de kullanımı, TR/EN/timezone/mobil kabulü. Liste fallback'i çalışmaya devam eder. | S03 |

Availability için `management_state_get_v1(operation: availability_save_v1)` okuması vardır; B01 bütün yönetim okumalarının eksik olduğu anlamına gelmez. Şablon resolve sonucu güncelleme sürümü yerine geçmez. Platform yetkili organizasyon yaratma ve SaaS ödeme doğrulama işleri sıradan kullanıcı self-service ekranı olarak varsayılmaz.

## 6. Modül planları

Her modülün “bitti” ölçütü kendi aşağıdaki kabul senaryosu **ve** bölüm 8'deki ortak teslim kapısıdır. API listeleri ana bağlantılardır; tam request/response tanımı ortak paketten alınır.

<a id="web-s01"></a>

### WEB-S01 — Kimlik, hesap ve güvenlik

**Ekranlar:** Mevcut Auth ekranları; davet kabulü; hesabım; iletişim/kimlik; aktif oturumlar; güvenlik geçmişi; hesap kapatma/silme etki ve takip ekranı.

- [ ] Gerçek e-posta kayıt/doğrulama/kurtarma, Google girişi, TOTP kurulumu/doğrulaması ve güvenli dönüşü kabul et. Süresi dolmuş/kullanılmış bağlantı, yanlış kod, tekrar gönderim ve kayıp oturum durumlarını tamamla.
- [ ] `account_access_accept_v1` ile giriş yapmış doğru hesabın davet kabulünü bağla; yanlış hesap, süresi dolma, iptal ve mevcut bağlantı çakışmasını açık göster.
- [ ] Hesap profili ile organizasyon kişi kaydını ayrı düzenle. `account_profile_update_v1` için kendi profil sürümünü gerçek management okumasından al; fotoğrafı özel medya hattıyla yükle/kaldır/oku.
- [ ] E-posta/telefon değişikliğinde native kimlik, bekleyen doğrulama ve doğrulanmış iletişim durumlarını ayır; kişi iletişimi güncellemesini global Auth kimliği değişikliği sayma.
- [ ] Native parola değişimi/current_password ve gerektiğinde reauthenticate/nonce; native Google linkIdentity/unlinkIdentity ve TOTP challenge/verify/unenroll tüketicilerini settings.md sözleşmesine göre gerçek ortamda kabul et. Uygulama prepare/challenge/remove/completion endpoint’i yoktur.
- [ ] `account_sessions_list_v1`, `account_session_label_v1`, `account_sessions_revoke_v1`, `account_security_history_get_v1` için oturum listesi, adlandırma, iptal ve güvenlik görünümü oluştur.
- [ ] `account_delete_preview_v1` → `account_delete_apply_v1`: taze doğrulama, sahiplik engelleri, açık etkiler, iş durumu ve kayıp yanıtı tamamla. Talep kabulünü fiziksel imha tamamlandı olarak gösterme.

**Kabul:** Öğrenci daveti doğru hesapla kabul eder, korumalı hedefe döner; iptal edilen oturum yeniden veri okuyamaz; başka hesaba ait oturum/kişi erişilemez. Silme/reauth ve sağlayıcı kabulü gerçek ortam kanıtıyla kapanır. **Bağımlılık:** B03, S13'ün erişim durumları.

<a id="web-s02"></a>

### WEB-S02 — Stüdyo kurulumu ve kaynaklar

**Ekranlar:** Stüdyo kurulum kontrol listesi; organizasyon/merkez bilgisi; oda; disiplin; tek eğitmen ve yönetici kapsamı; haftalık uygunluk/istisnalar.

- [ ] Organizasyon bulunmaması, bootstrap/kapalı organizasyon, CM atanmaması ve eksik işletim ayarlarını ayrı kurulum adımları göster. Kayıt olan hesaba otomatik owner/organizasyon yaratma.
- [ ] `organization_get_v1`/`organization_update_v1`, `centers_list_v1`/`center_create_v1`/`center_update_v1` ile izinli kurulum ve düzenleme. Organizasyon yaratma mevcut platform yetkisine bağlı kalır.
- [ ] `room_save_v1`, `disciplines_list_v1`, `discipline_save_v1`, `center_discipline_set_v1`: oda kapasitesi, disiplin ve merkez kapsamını gerçek kayıt/sürümle yönet.
- [ ] `roles_list_v1`, izinli `role_assign_v1`/`role_revoke_v1`, CM atama/kaldırma ve `manager_self_assign_center_v1` akışlarını role uygun sun. Tek eğitmen seçimini uygula; personel izin matrisi açma.
- [ ] `availability_save_v1`/`availability_exception_save_v1`: günlük aralıklar, kapalı gün/istisna, gece aşımı ve DST sınırlarını göster; mevcut kural sürümünü desteklenen management selector'ından oku.
- [ ] Kurulum tamamlanması için oda/disiplin/eğitmen, saat dilimi, uygunluk ve gerekli politikaları gerçek okumalardan doğrula. Sadece sihirbazın son adımına ulaşmak “hazır” sayılmaz.

**Kabul:** Yetkili kullanıcı boş stüdyoyu ilk program için hazırlar; ikinci aktif kaynak ve 101. öğrenci backend reddi anlaşılırdır. Owner'ın CM olmadan domain yazması reddedilir. **Bağımlılık:** B01/B06, S12 politika tüketimi, S13 plan okuması.

<a id="web-s03"></a>

### WEB-S03 — Program, takvim ve seans yaşam döngüsü

**Ekranlar:** Mevcut takvim/detay; sınıflar ve sabit grup; program oluşturma; tek seans; değişiklik/iptal/telafi etki özeti.

- [ ] Mevcut takvimde gerçek lisanslı Scheduler, liste, saat dilimi, filtre/sayfalama ve güncel detay kabulünü tamamla. Syncfusion dahili editörü iş kurallarının sahibi olmaz.
- [ ] `class_save_v1`: açık/sabit grup sınıfı ve tek disiplin kapsamı. `class_assignment_set_v1`: sınıfın eğitmen/asistan varsayılan görevlendirmesini ve uygun gelecek seanslara etkisini yönet; Starter tek aktif eğitmen sınırı korunur. Bu komut öğrenci sabit grup kaydı değildir; öğrenci kaydı gerçek satış/hak ve rezervasyon zincirinden yürür.
- [ ] `program_preview_v1` → `program_apply_v1`: tekrar kuralı, açık tarih aralığı, süre, oda/eğitmen, kontenjan, tatil/istisna ve DST seçimleri. Önizlemede oluşacak/engellenen seansları göster; hata varken başarı üretme.
- [ ] `session_create_v1` ile tek seans oluştur; bağlı sınıf/oda/eğitmen seçicilerini B01 tamamlandıktan sonra gerçek katalogdan besle.
- [ ] Mevcut `session_change_preview_v1`/`session_change_apply_v1` formuna kaynak ataması ve seri içindeki sonraki DST tekrarları için gereken `offset_choices` ekle. Tek seans/bu ve sonrası etkisini görünür yap.
- [ ] İzinli `session_assignment_set_v1` ve `session_capacity_set_v1` akışlarını değişiklik ekranına bağla; tek aktif eğitmen ve mevcut rezervasyon/oda tavanı korunur.
- [ ] `session_cancel_preview_v1` → `session_cancel_apply_v1`, `replacement_session_create_v1`: iptal gerekçesi, hak/finans/rezervasyon etkileri, telafinin kaynak seans bağlantısı ve yeni rezervasyon davranışı.
- [ ] Sürükle-bırak/resize ancak aynı preview/onay/kurtarma akışına bağlandığında açılır; doğrudan yerel başarı üretmez. Klavyeyle eşdeğer düzenleme her zaman bulunur.

**Kabul:** Tekrarlayan program oluştur → bir seansı değiştir → gelecek seriyi değiştir → iptal/telafi oluştur; oda/eğitmen çakışması, mevcut rezervasyonlu seansın korunması, stale preview ve DST sınırı gerçek backend'de sınanır. **Bağımlılık:** S02, B01/B07; rezervasyonlu sınamalar için yetkilendirilmiş mevcut kabul kaydı. Yeni rezervasyonu UI'dan oluşturma yolculuğu S06'nın kabulündedir.

<a id="web-s04"></a>

### WEB-S04 — Öğrenci ve kişi yönetimi

**Ekranlar:** Mevcut liste/profil; disiplin ilişkisi; hesap erişimi; kişi birleştirme etki/onay ekranı; öğrencinin paket/rezervasyon/finans bağlantıları.

- [ ] Mevcut arama/cursor/detay/oluşturma/düzenleme/etkinleştirme/pasifleştirme akışını gerçek yetkili hesapla kabul et; yeni kişi ile aktif öğrencilik ayrımını koru.
- [ ] `person_discipline_set_v1` ile seçili merkez/disiplin ilişkisini düzenle; kişi ve ilişki durumlarını ayrı göster.
- [ ] Davet gönderme/iş takibine davet kabulü sonrası taze veri, `account_access_revoke_v1` ve `account_link_remove_v1` için mevcut izinli yönetim akışını ekle. B02 çözülmeden profilin hesap bağlı etiketini tahmin etme.
- [ ] `person_merge_preview_v1` → gereken `person_merge_approve_v1` → `person_merge_apply_v1`: kaynak/hedef seçimi, etkiler, gereken merkez onayları, hesap/rezervasyon/limit çakışmaları ve süresi dolan onay. Tarihsel borç ve satışın görünürlüğünü doğrula.
- [ ] Profilde gerçek haklar, borç/alacak, rezervasyonlar ve geçmişe bağlantı kur. Her bölüm kendi yetkili okumasıyla yüklenir; bir bölüm hatası diğerine sahte veri koymaz.
- [ ] Profil adı/iletişim değişikliğinden sonra detay ve ilgili liste satırını tazele; oluşturulan kişinin yenileme/etkinleştirme sonrası bulunabilirliğini tamamla.

**Kabul:** Aynı kişi oluşturulur/düzenlenir/etkinleştirilir; açık işlemi varken pasifleştirme reddedilir; birleştirme sonrası eski hak/borç kaybolmaz; kayıp yanıtta mükerrer kişi veya davet oluşmaz. **Bağımlılık:** S01, B02/B03; profil alt bölümleri S05/S06/S08.

<a id="web-s05"></a>

### WEB-S05 — Paket kataloğu, satış ve haklar

**Ekranlar:** Paket listesi; ürün sürümü oluşturma; satış adımları; satın alınmış hak ve hareketleri; yenileme/düzeltme.

- [ ] `products_list_v1` ile kredili ve `include_timed_products` kapsamındaki süreli ürünleri getir. Katalog, satış ve hak bakiyesi ayrı görünür.
- [ ] `product_publish_v1`: disiplin ön eki, açık fiyat/para birimi, kredi veya süre/kota, geçerlilik ve izinli kullanım/refund koşulları. Yeni sürüm geçmiş satışı değiştirmez; şablon yalnız form hazırlığıdır.
- [ ] `sale_preview_v1` → `sale_apply_v1`: öğrenci, ürün sürümü, tarihler, kapsam, gerçek borç/hak/rezervasyon etkisi ve gerekli belge kabulü. Geri tarih/ileriye tarih kararlarını backend yanıtından göster.
- [ ] `entitlements_get_v1`: toplam/ayrılmış/kullanılabilir hak, dönemsel kota ve geçerlilik; seans bağlamında kullanılabilirlik. Süreli hakkı sahte kredi sayısına dönüştürme.
- [ ] `sale_renew_preview_v1` → `sale_renew_apply_v1`, `entitlement_extend_v1`, `credit_adjust_v1`, `negative_limits_get_v1`/`negative_limit_set_v1` ve `negcredit_valuation_set_v1` için izinli, gerekçeli düzenlemeler.
- [ ] `reservation_impact_preview_v1`/`reservation_impact_apply_v1` gereken değişikliklerde korunacak rezervasyon ve açık engelleri göster. Genel politika değişikliğiyle kesin rezervasyonu otomatik iptal etme.
- [ ] F17 isteyen `freeze`, `sale_change` ve `sale_terminate` akışlarını Starter teslim listesine katma; isim benzerliğinden F15 izni türetme. İade S08'in gerçek finans akışıdır.

**Kabul:** Kredili, kotalı süreli ve sınırsız ürünün her biri için yayın → satış → hak/borç okuma → izinli yenileme/düzeltme; eski satış snapshot'ı yeni ürün sürümünden etkilenmez. Rezervasyon ve yoklamada bu hakların tüketimi sırasıyla S06/S07 kabulünde tamamlanır. **Bağımlılık:** S04, S02 disiplin okuması, S11 belge kabulü, B06.

<a id="web-s06"></a>

### WEB-S06 — Rezervasyon ve özel ders talepleri

**Ekranlar:** Seans katılımcıları; kayıt ol/iptal; uygun hak seçimi; özel ders talebim; yönetici talep listesi ve alternatif önerisi.

- [ ] `reservation_list_v1`, `reservation_create_v1`, `reservation_cancel_v1`: yönetici ve öğrenci self akışları; gerçek durum/iptal sonucu ve seçilen hak kaynağı.
- [ ] `entitlements_get_v1` çağrısını seans ve booking mode ile yap; yanlış disiplin, süre, kota, borç, negatif limit ve belge engellerini ayrı açıkla.
- [ ] Kontenjan ve kategori uygunluğunu backend'den tüket. `reservation_capacity_override_v1` yalnız desteklenen yönetici yetkisi ve açık onayla; öğrenciye limit aşma yolu açma.
- [ ] `lesson_request_create_v1`/`lesson_request_withdraw_v1`: açık talep, geri çekme ve süre aşımı. Talep kesin rezervasyon gibi gösterilmez.
- [ ] `lesson_request_reject_v1`, `lesson_request_offer_alternative_v1`, `lesson_request_accept_alternative_v1`, `lesson_request_approve_v1`: güncel sürüm, gerçek uygunluk ve açık karar özeti. P01'in desteklenen management selector'larıyla liste/detayı oku.
- [ ] Bekleme listesi veya süreli yer teklifi yerine Starter'ın gerçek dolu/uygunsuz durumunu göster. Başka kişinin son slotu alması sonrası formu taze duruma geçir.

**Kabul:** İki kişinin son yer yarışında tek kesin kayıt; iptalde doğru hak bırakma; aynı isteğin tekrarı tek rezervasyon; alternatif kabulünde çakışma/erişim/preview değişimi güvenli reddedilir. **Bağımlılık:** S03/S05/S11; yönetici/self kabuk.

<a id="web-s07"></a>

### WEB-S07 — Eğitmen paneli ve yoklama

**Ekranlar:** Eğitmenin kendi görev takvimi; seans yoklaması; kapatma özeti; gerekçeli düzeltme.

- [ ] Atanmış eğitmenin kendi seanslarını ve izinli katılımcı alanlarını göster; finans ve kişi yönetim yetkisini atamadan türetme.
- [ ] `attendance_get_v1`, `attendance_start_v1`: planlanan ve fiilî başlangıcı ayır; başlatma için gerçek yetki ve backend zaman kuralını kullan.
- [ ] `attendance_mark_v1`/`attendance_block_v1`: izinli katılım/gelmeme/engel durumları, gerekçe, güncel sürüm ve satır bazlı başarısızlık. Toplu iş ancak sözleşme destekliyorsa kullanılır.
- [ ] `attendance_close_v1`: sonuç ve hak tüketimi özeti; taslak işareti kesin katılım sayılmaz. Starter'da anlaşma/hakediş ekranı gerekmez ve ücret oluşturulmaz.
- [ ] `attendance_correct_preview_v1` → `attendance_correct_apply_v1`: kapalı yoklamanın önce/sonra hak etkisi ve gerekçesi; eski kayıt geçmişi korunur.
- [ ] Seans iptali, erişim kaybı, borç/negatif limit ve belge engelinde uygulanabilir sonraki adımı sun; sonradan ödeme ile geçmiş seans için yeni hakediş üretildiği izlenimi verme.

**Kabul:** Gerçek atamalı eğitmen taslak kaydeder; yetkili kapatır/düzeltir; hak yalnız beklenen miktarda değişir, çift gönderim tüketimi tekrarlamaz. **Bağımlılık:** S03/S06/S11.

<a id="web-s08"></a>

### WEB-S08 — Manuel finans ve öğrenci alacağı

**Ekranlar:** Öğrenci finans özeti; borç detayları; tahsilat; düzeltme/iade/mahsup; hareket geçmişi.

- [ ] `finance_get_v1`: borç, ödenen, açık bakiye ve öğrenci alacağını ayrı sun; yetkili kişi/merkez/para birimi filtreleri ve sayfalama.
- [ ] `collection_record_v1`: açık tutar, para birimi, izinli ödeme yöntemi, referans, tarih ve tahsis. Kısmi ödeme ile borcun tamamen kapanmasını ayır.
- [ ] `collection_correct_preview_v1` → `collection_correct_apply_v1`: geri alma/yeniden dağılım ve oluşacak borç/alacak etkisini onaylat.
- [ ] `sale_refund_preview_v1` → `sale_refund_apply_v1`: backend'in izin verdiği iade tutarı ve hak/rezervasyon etkisi; UI kendi iade formülünü çalıştırmaz.
- [ ] `student_credit_refund_v1`, `student_credit_offset_v1`, `debt_adjust_v1`: nakit iade, borca mahsup ve borç düzeltmesini farklı eylemler yap; gerekçe ve kaynak kaydı göster.
- [ ] Öğrenci self panelinde yalnız kendi izinli özeti; yönetici işlemlerine bağlantı verme. Para birimi, sınır/büyük tutar ve küsurat görüntülemesini ortak güvenli yardımcılarla yap.

**Kabul:** Satış → kısmi tahsilat → düzeltme → alacak → mahsup/iade zinciri gerçek bakiyeler ve geçmişle tutarlı; çift onay/bağlantı kaybı mükerrer para hareketi oluşturmaz. **Bağımlılık:** S04/S05/S12; rapor karşılaştırması S10.

<a id="web-s09"></a>

### WEB-S09 — Öğrenci paneli, public ders başvurusu ve kişisel takvim

**Ekranlar:** Öğrencinin dersleri/hakları/borcu/talepleri; paylaşılan ders takvimi ve başvuru; yönetici başvuru kutusu; kişisel takvim bağlantıları.

- [ ] Öğrenci ana ekranında sıradaki ders, kendi kesin kayıtları, uygun dersler, hakları, borç/alacak ve işlem bildirimlerini gerçek self okumalarla birleştir. Başka öğrencilerin özel alanları görünmez.
- [ ] `publication_set_v1`: ders yayını, kamuya açık başlık/mekan/ücret/koşul ve yayından kaldırma. Public bilgi seçimi S12'deki izinli alanlarla tutarlı olur.
- [ ] `public_calendar_get_v1` ve `public_application_submit_v1`: gerçek public giriş yolu, widget tokenı, amaç/hostname ve hata/tekrar davranışı. Anonim çağrıyı Auth tokenı varmış gibi modelleme.
- [ ] `public_application_review_v1` ve ilgili management okumasıyla dar ders başvurusunu değerlendir; kişi/aday eşlemesi ve sonuç. Genel lead/CRM/deneme kampanyası oluşturma.
- [ ] `calendar_links_get_v1`, `calendar_link_create_v1`, `calendar_link_rotate_v1`, `calendar_link_revoke_v1`: kendi hesabında açık organizasyon ve `lessons`/`duties` seçimi, kopyalama, yenileme/iptal; URL'yi log/analytics'e gönderme.
- [ ] ICS bağlantısını gerçek GET/HEAD servisinden takvim istemcisine ekle; her seans mevcut korumalı seans route'una gider. Rotate/revoke, üyelik/abonelik kaybı ve iptal edilen seans görünürlüğünü kabul et.
- [ ] Kesin ortak ders katılımcıları için izinli profil/fotoğraf/iletişim paylaşımını canlı tercihlerle uygula; ilgi filtresi yeni erişim yetkisi yaratmaz.

**Kabul:** Anonim gerçek başvuru → yetkili inceleme → kişinin izinli takip akışı; öğrenci self rezervasyon/iptal; gerçek takvim aboneliği ve iptal edilmiş URL'nin erişim kaybı. **Bağımlılık:** S01/S03–S06/S08/S11/S12, B04. Public ve ICS alt teslimleri ayrı modül PR'si olabilir.

<a id="web-s10"></a>

### WEB-S10 — Raporlar, CSV ve import

**Ekranlar:** Tahsilat/borç ve ders/katılım raporları; dışa aktarma işi; dosya yükleme/eşleme/önizleme/uygulama/sonuç sihirbazı.

- [ ] `report_get_v1`: yalnız Starter `collections_debts` ve `lesson_attendance`, açık tarih/merkez filtreleri, sayfalama, para birimi ve tüm filtre sonucunun toplamı. Sayfa toplamını genel toplam sayma.
- [ ] `report_export_start_v1` → `job_status_get_v1` → `report_file_get_v1`: authenticated CSV indirme, bekleme/başarısızlık/süre dolma, kayıp yetki ve aynı anahtar kurtarma. Export yetkisini rapor okumasından türetme.
- [ ] `import_upload_prepare_v1` → private signed upload → gereken tamamlanma doğrulaması → `import_preview_v1`; `job_status_get_v1`/`preview_get_v1` ile teknik sonucu göster.
- [ ] Virgül/noktalı virgül, açık sütun eşlemesi, `source_namespace`/`source_key`, mevcut `person_ref`, kişi/iletişim, açılış kredi ve borç alanları. Dosyadan hesap/davet veya nakit tahsilat üretme.
- [ ] `import_apply_v1` → `import_rows_list_v1`: satır sonucu, kısmi hata, yeniden okuma ve desteklenen tekrar. Başarılı kaynak anahtarı tekrar uygulanmaz; önizleme kendi başına kayıt oluşturmaz.
- [ ] Kendi ve yetkili ortak rapor/import şablonlarını `settings_template_resolve_v1` ile açık kaynak/sürümle hazırla; otomatik job/apply yoktur.

**Kabul:** Rapor sayfaları/toplam/CSV tutarlı; dosyada hatalı satır doğru gösterilir; son öğrenci slotu yarışında başarısız import satırı yarım kişi/hak/borç bırakmaz; başka hesabın dosyası indirilemez. **Bağımlılık:** S02/S04–S08/S11/S12, B05.

<a id="web-s11"></a>

### WEB-S11 — Belge, işlemsel inbox ve denetim geçmişi

**Ekranlar:** Belge yükleme/yayınlama; işlem içi zorunlu belge okuma/kabul; kişisel bildirim kutusu; yetkili kayıt geçmişi.

- [ ] `document_upload_prepare_v1`, `file_upload_complete_v1`, `document_publication_preview_v1`, `document_version_publish_v1`: private dosya, checksum/MIME/byte sınırı, sürüm ve yeniden kabul etkisi.
- [ ] `document_requirements_get_v1` → `document_accept_v1`: satış, rezervasyon, talep veya yoklama gibi gerçek kişi/işlem bağlamında gereken sürümü göster. Yönetici, açık vekalet kararı yoksa başkası adına onaylayamaz.
- [ ] Belge dosyasını yetkili bytes cevabından göster; public dosya URL'si veya bağımsız kişi belge özeti uydurma. Eski kabul ile yeni zorunlu sürümü ayrı sun.
- [ ] `notifications_list_v1`/`notification_mark_read_v1`: cursor, okunmuş/okunmamış, güvenli hedef bağlantısı, işlem sonrası taze veri ve erişimi kalkmış hedef durumu.
- [ ] Bildirim tercihlerinde yalnız desteklenen kanalları sun. Mandatory işlemsel teslim pazarlama tercihine bağlanmaz; Starter hatırlatma/sessiz saat/özet/dış kanal vaat etmez.
- [ ] `audit_list_v1`: desteklenen varlık/filtrelerle güvenli geçmiş; ham payload, token, özel iletişim ve yetkisiz mali alan açılmaz. İş geçmişi ile kullanıcıya gönderilen inbox kaydı karıştırılmaz.

**Kabul:** Yetkilendirilmiş mevcut işlem bağlamında eksik belge gerekliliği okunur; doğru kişi doğru sürümü açar/kabul eder; yeni sürüm yeniden kabul gerektirdiğinde eski onay yeterli olmaz. Başka kullanıcının inbox/audit bilgisi okunamaz. Satış/rezervasyon/yoklama formundaki belge kapısının uçtan uca kabulü o formun teslimindedir. **Bağımlılık:** B05/B06 ve gerçek işlem bağlamı; bağlamsız kişi belge özeti oluşturulmaz.

<a id="web-s12"></a>

### WEB-S12 — Ayarlar ve gerçek davranış tüketicileri

**Ekranlar:** Kendi görünüm/mahremiyet tercihleri; organizasyon ve merkez ayarları; politika yayını; marka/medya; şablonlar; seçili alan reseti ve geçmiş.

- [ ] `settings_catalog_get_v1`, `settings_get_v1`, `settings_update_v1`, `settings_reset_preview_v1`, `settings_reset_apply_v1`, `settings_history_get_v1` ile scope, salt okunur/unsupported, mevcut sürüm, kaynak/default/miras ve açık override göster.
- [ ] FD01: dil, tarih/sayı/saat biçimi, cihaz/manual timezone, hafta başlangıcı, takvim görünümü, tema, ölçek, kontrast ve hareket gerçek tüketicilere bağlanır. Kişisel görüntüleme timezone'u işletim timezone'unu değiştirmez.
- [ ] FD02/FD03: üç organizasyon rengi, logo ve kendi fotoğrafı; `media_get_v1`, private okuma ve açık kaldırma. Null-only renk/font paket alanlarına çalışmayan katalog ekranı ekleme.
- [ ] FD04/FD05: kullanılabilir bildirim tercihleri, profil/fotoğraf/e-posta/telefon görünürlüğü, ilgi filtresi ve izinli geçmiş önerileri. Üye kendi ayarını değiştirir; yönetici başkasının tercihlerini yazmaz.
- [ ] FD06/FD07: `policies_get_v1`/`policy_publish_v1`, uygunluk, rezervasyon/iptal/katılım/negatif limit davranışı ve manuel tahsilat yöntem/reference tüketimi. Yeni organizasyon defaultlarını mevcut kurumlara geri doldurma.
- [ ] FD08/FD09: belge/public alan yayını ve dar ders başvurusu tercihleri; Starter dışı CRM tüketicisini açma.
- [ ] FD10: rapor/import ve availability/paket hazırlık şablonları. `settings_preparation_resolve_v1` yalnız typed taslak üretir; gerçek komut ve onay ayrıca gerekir. Kaynak sürümü değişince yeniden çöz.
- [ ] FD11: seçili alan reset önizlemesi, kapsam/sürüm/expiry, değişim geçmişi. Reset yayınlanmış ürün, başlamış iş veya önceki satış koşulunu değiştirmez.
- [ ] FD12: hesap/organizasyon lifecycle ekranlarına doğru bağlan; desteklenmeyen ayarın kaydedildiği veya fiziksel imhanın bittiği izlenimini verme.

**Kabul:** Bir ayarı kaydet → ilgili ekranda etkisini göster → kaynak/mirası kontrol et → seçili alanı resetle; başka scope veya yayınlanmış kayıt etkilenmez. Görünürlük kapandığında yeni katılımcı/medya okumaları kesilir. **Bağımlılık:** İlgili alanla birlikte geliştirilir; bütün ayarlar en sona bırakılmaz.

<a id="web-s13"></a>

### WEB-S13 — Plan, erişim ve organizasyon yaşam döngüsü

**Ekranlar:** Aboneliğim; plan/kullanım/erişim; teklif ve ödeme bildirimi; bekleyen değişiklik; kapsam seçimi; kapatma/yeniden açma/silme etki ve takip.

- [ ] `subscription_get_v1`: gerçek dönem, plan, erişim modu, kullanım limitleri ve `starter_scope_required`/seçilmiş kapsam. Kotaları tasarım örneklerinden veya listelenen ilk sayfadan hesaplama.
- [ ] Yetkisiz role finans/abonelik owner görünümü sunma; kapalı erişim ekranında backend'in izin verdiği kurtarma/hesap işlemlerini göster.
- [ ] `subscription_upgrade_quote_v1`, `saas_payment_submit_v1`, `subscription_renewal_set_v1`: gerçek teklif/tutar/para birimi/expiry, yenileme tercihi ve ödeme bildirimi. Platformun ödeme doğrulama veya grace komutları kullanıcı paneline taşınmaz; online ödeme sağlayıcısı icat edilmez.
- [ ] `subscription_downgrade_request_v1`/`subscription_change_cancel_v1`: açık sürümle merkez/oda/disiplin/eğitmen/en fazla 100 öğrenci seçimi ve dönem sınırı. Kaynaklar otomatik ilk kayıt seçimiyle daraltılmaz; geçmiş/veri silinmez.
- [ ] `organization_close_preview_v1`/`organization_close_apply_v1`/`organization_reopen_v1`: açık işler, abonelik/yenileme ve yeniden açılma koşulları. UI hizmet tarihini kendi hesabıyla ileri taşımaz.
- [ ] `organization_delete_preview_v1`/`organization_delete_apply_v1`: taze yetki/reauth, iki aşamalı açık etki/onay, export bağlantısı ve gerçek job/progress. `partial`, hukuki saklama ve `retry_wait` tamamlandı sayılmaz.

**Kabul:** Limit/kapalı erişim doğrudan route ve işlemde de korunur; dönem sınırı/iptal edilmiş değişiklik doğru görünür; lifecycle talebi kayıp yanıtta tekrarlanmaz. **Bağımlılık:** B06, S01/S02/S10; Starter'a dönüş seçicileri B01 ve ilgili kişi okumalarını ister.

## 7. Bölüm bölüm teslim: tek aktif bölüm

Kullanıcının son kararı: **Bir bölüm bitmeden sonraki bölümün uygulamasına geçilmez.** Frontend'in aktif bölümü ve sırası bu bölümde tutulur. **Aktif bölüm: WEB-S01 — kimlik, hesap ve güvenlik.** Kullanıcının 30 Ekim kararıyla bu bölüm öne alınmıştır; öğrenci yönetiminin kalan kabulü açık kalır. Aşağıdaki liste bağımlılık sırasını gösterir. Aynı anda birden çok yarım bölüm veya yeni modül dalı açılmaz.

S01–S13 işlev kapsamını izler. Teslim bölümleri ise kullanıcının baştan sona kullanabildiği akışlardır: örneğin davet kabulü öğrenci bölümünde, satışın zorunlu belge adımı satış bölümünde çalışır. Ortak bir bağımlılık önce kullanılacağı bölümün içinde tamamlanır ve daha sonra yeniden yazılmaz. Bölümün kabulü ileride yazılacak bir ekrana bağlanmaz: gerektiğinde yetkilendirilmiş mevcut kayıt kullanılır; yeni ekranlar arasındaki uçtan uca bağlantı, bağlantıyı kullanan sonraki bölümün açık kabul maddesidir. Gerekli gerçek kayıt/okuma yoksa bölüm engelli kalır, mock ile kapanmaz. Başka bir bölüme ait henüz yapılmamış işlem, mevcut bölümde çalışıyormuş gibi düğme/özet olarak sunulmaz.

| Sıra | Tamamlanacak bölüm | Bölüm kapanışının somut sonucu |
|---|---|---|
| 1 | **Hesap ve güvenlik** — S01, kendi tercihleri için S12 | Giriş/kayıt/kurtarma/Google/TOTP, profil, oturumlar, güvenlik ve hesap lifecycle akışları tamam. |
| 2 | **Öğrenci yönetimi** — S04 çekirdeği ve gereken S01 davet kabulü | Mevcut liste/profil/oluşturma/düzenleme/öğrencilik akışları; disiplin, birleştirme ve hesap erişimi dahil gerçek kabul. Paket/finans alt görünümü kendi sonraki bölümünün sorumluluğudur; bu aşamada sahte özet eklenmez. |
| 3 | **Stüdyo kurulumu ve işletme erişimi** — S02, gereken S12 politikaları ve S13 temel plan görünümü | Gerçek kaynak katalogları, merkez/oda/disiplin/eğitmen/uygunluk ve plan sınırlarıyla stüdyo program oluşturmaya hazır. B01 burada çözülür. |
| 4 | **Belgeler ve işlemsel bildirimler** — S11 | Özel yükleme/yayın, bağlamsal okuma/onay, inbox ve izinli geçmiş tamam; sonraki iş formlarına bağlanacak çalışan bileşenler hazır. |
| 5 | **Program ve seanslar** — S03 | Sınıf/program/tek seans oluşturma; kaynak ataması, değişiklik, iptal/telafi, Scheduler ve gerçek çakışma kabulü tamam. |
| 6 | **Paket, satış ve hak yönetimi** — S05 | Üç ürün türünde yayın/satış/yenileme/hak düzeltmesi, zorunlu belge adımı ve öğrenci profilindeki hak görünümü tamam. |
| 7 | **Tahsilat ve finans** — S08 | Kısmi ödeme/düzeltme/iade/mahsup ve öğrenci finans görünümü tamam. Rapor ekranına ait toplu karşılaştırma sonraki rapor bölümünde eklenir. |
| 8 | **Rezervasyon ve özel ders talepleri** — S06, S09 self eylemleri | Yönetici ve öğrenci için kayıt/iptal/hak seçimi; talep/alternatif/onay; son kontenjan ve açık işlem reddi tamam. |
| 9 | **Eğitmen paneli ve yoklama** — S07 | Kendi görevleri, başlangıç/taslak/kapatma/düzeltme ve hak tüketimi tamam; ücret/hakediş üretimi yok. |
| 10 | **Öğrenci paneli ve public ders başvurusu** — S09 günlük panel/public | Önceki tamamlanmış self işlemler tek panelde birleşir; gerçek widget/gateway ile başvuru ve yönetici değerlendirmesi tamam. |
| 11 | **Kişisel takvim aboneliği** — S09 ICS | Gerçek takvim istemcisi → GET/HEAD → ICS → yetkili seans; rotate/revoke ve erişim kaybı tamam. |
| 12 | **Raporlar ve veri aktarımı** — S10 | Finans/katılım raporu ve CSV; öğrenci/kredi/borç import'unda dosya→preview→apply→worker→satır sonucu tamam. |
| 13 | **Ayarlar ve abonelik yaşam döngüsü** — kalan S12/S13 | Önceki bölümlerde kullanılan ayarlara ek kalan FD tüketicileri, şablon/reset, plan geçişi, ödeme bildirimi, kuruluş kapanış/silme ve takip tamam. |
| 14 | **Bütün Starter kabulü** | Bölüm 9'daki gerçek kullanıcı yolculuğu, tüm roller/plan sınırları, erişilebilirlik ve ilgili yayın kanıtları tamam. |

**Bölüm çalışma döngüsü:** mevcut kaynak/eksik kontrolü → gerekiyorsa backend/ortam bağımlılığını çözme → UI/UX ve gerçek API → hata/kurtarma → anlamlı testler → gerçek ortam kabulü → tek modül PR'sini son inceleme/merge'e sunma → aynı main ve ilgili dağıtım sonucunu doğrulama → sonraki bölüm.

CI veya hosted kabul bekleyen bölüm aktif kalır. Engelde kalan somut okuma/config/yetki, sahibi ve kapanış kanıtı yazılır; engel gizlenerek başka modüle geçilmez. Sıra değişikliği ancak kullanıcının açık kararıyla yapılır ve aktif kayıt güncellenir. Kullanıcı açıkça erken merge isterse kaynak main'e alınabilir; bu, eksik kabulü kapatmaz ve bölüm tamamlandı sayılmaz.

Aynı bölümdeki küçük düzeltmeler aynı dal/PR'de sürer. Önceki bölüm PR'si birleşmişse kalan kabul veya tamamlayıcı iş için tek devam PR'si kullanılır; her commit ayrı PR/merge talebi oluşturmaz. Takvim tarihi veya süre tahmini, ilgili backend/sağlayıcı bağımlılığının eforu doğrulanmadan verilmez.

## 8. Her modülün teslim kapısı

1. **Kapsam:** Kullanıcı rolü, ekranlar, izinli/kapalı eylemler ve kullanılan gerçek DTO/selector listesi belli.
2. **İşlev:** Başarılı ana yol, boş/yükleniyor/hata/erişim/plan durumları; tüm görünür eylemler çalışır. Demo veya hazırlık kartı canlı işin yerine geçmez.
3. **Bütünlük:** Gereken preview/version, aynı anahtar kurtarma, çift tıklama, stale veri, sayfa/hesap bağlamı ve yeniden okuma davranışı doğrulanmış.
4. **Anlamlı frontend testleri:** UI davranışı ve hata/yarış koşulları Vitest/Testing Library/MSW ile; modülün kritik kullanıcı yolculuğu ve erişilebilirliği Playwright/axe ile. Backend ürün kurallarını istemcide tekrar uygulayan test katmanı kurulmaz.
5. **Kontroller:** `pnpm check:frontend`, frontend isolation ve gerekli coverage; değişen akışın tarayıcı kabulü. Mevcut CI dört tarayıcı matrisini korur. Kural/timeout/retry gevşetme başarı yöntemi değildir.
6. **Gerçek ortam:** Yetkili yönetici/eğitmen/öğrenci hesabıyla izinli okuma/yazma; yanlış rol, org/merkez, plan ve erişim kaybı. Gerçek veri üzerinde reset/seed yoktur; yalnız yetkilendirilmiş kabul kayıtlarıyla çalışılır.
7. **Kaynak ve yayın:** Son kaynak incelemesi, aynı head/base/merge için CI; merge sonrası main kanıtı ve ilgili dağıtım. Frontend kanıtı bu dosyada ilgili bölümün kapanış kaydında tutulur; eski head'in başarısı yeni head'e taşınmaz.
8. **Doküman:** Modül adımları, kalan bağımlılıklar, açık kabul ve sıradaki frontend işi bu dosyada güncellenir. Kapanış kaydı kaynak SHA'sını, ilgili CI/dağıtım bağlantılarını ve gerçek ortam kabul sonucunu içerir. Ürün/DTO değişikliği ihtiyacı ortak talep kaydına yazılır ve yetkili kapsamda ele alınır; bu dosya talep kimliğine bağlanır. Talep kaydının kendi alanları dışında ortak `/docs` sözleşmeleri frontend planı/ilerlemesi için güncellenmez.

## 9. Starter'ın bütününe ait son kabul zinciri

- [ ] Yetkili işletmeci tek merkez/oda/disiplin/eğitmen kurar; eksik config ve ikinci kaynak reddi doğru görünür.
- [ ] Kişi oluşturulur, öğrenci etkinleştirilir, disipline bağlanır, davet doğru hesapla kabul edilir.
- [ ] Kredili, kotalı süreli ve sınırsız ürün yayımlanır; satış ve gereken belge kabulü yapılır; hak ve borç ayrı oluşur.
- [ ] Tekrarlayan program oluşturulur; açık ve sabit grup kayıtları, öğrenci self kaydı ve özel ders alternatif/onay akışı tamamlanır.
- [ ] Oda/eğitmen çakışması, kontenjan/borç/negatif limit/belge reddi ve mevcut kesin rezervasyon koruması gösterilir.
- [ ] Fiilî başlangıç → yoklama taslağı → kapatma → gerekçeli düzeltme hakları doğru etkiler; Starter'da hakediş oluşmaz.
- [ ] Tahsilat → kısmi ödeme → düzeltme/iade/mahsup zinciri; finans ekranı, rapor ve CSV aynı sonuçları verir.
- [ ] Öğrenci/kredi/borç import'u preview/apply/worker/sonuç ve tekrar senaryosuyla tamamlanır; hesap/davet/nakit otomatik üretilmez.
- [ ] Public ders başvurusu gerçek widget/gateway ile; ICS gerçek istemcide, yetkili seans hedefi ve rotate/revoke ile kabul edilir.
- [ ] TR/EN, açık/koyu, telefon/masaüstü, klavye, 320px/%200, yanlış rol/tenant, oturum iptali, stale preview ve kayıp yanıt zincirin tamamında doğrulanır.
- [ ] Abonelik/yenileme/kapanış ve izinli hesap/organizasyon yaşam döngüsü doğru durumları gösterir; fiziksel imha beklemesi sahte başarıya çevrilmez.
- [ ] Canlı menüde bitmiş gibi duran placeholder, kopuk hedef, yalnız sentetik verili modül veya çözümsüz zorunlu backend/sağlayıcı bağımlılığı kalmaz.

## 10. Ürün kapsamı izlenebilirliği

Bu eşleme bütün Starter özelliklerinin bir teslim sahibine sahip olmasını sağlar. Başarı yüzdesi endpoint veya çizilmiş ekran sayısından hesaplanmaz.

| Ürün özelliği | Frontend teslimi |
|---|---|
| F01 işletme/merkez/oda | S02; lifecycle S13 |
| F02 çalışma saatleri/uygunluk | S02 + S12 |
| F03 kurallar/istisnalar | S12; etkiler S03/S05/S06/S07 |
| F04 hesap eşleştirme/roller | S01/S02/S04; plan ayrımı S13 |
| F06 öğrenci/eğitmen/hesap | S01/S07/S09 |
| F07 kişi/öğrencilik/birleştirme | S04; import S10 |
| F08 takvim/kaynak | S03; kişisel abonelik S09 |
| F09 özel ders talebi | S06 |
| F10 program/sabit grup | S03/S05/S06 |
| F11 öğrenci self rezervasyonu | S06/S09 |
| F13 eğitmen ataması/değişimi | S02/S03; tek aktif eğitmen sınırı |
| F14 yoklama/iptal/telafi | S03/S06/S07 |
| F15 kredi/geçerlilik/hareket | S05/S06/S07/S10 |
| F16 süreli/sınırsız üyelik | S05/S06/S07 |
| F19 manuel finans | S08 |
| F25 dar public ders başvurusu | S09 |
| F26 işlemsel bildirim | S11; sonuç bağlantıları ilgili modülde |
| F28 Starter temel rapor/export | S10 |
| F30 belge/onay | S11; gerçek işlem kapıları S05/S06/S07 |
| F31 import | S10 |
| F32 abonelik/erişim/limit | S13 + bütün modüllerde ret durumları |
| F33 geçmiş/idempotency | Ortak yazma koşulları, S11/S13 |
| FD01–FD12 Starter tüketicileri | S12 ve ilgili iş modülleri |

Kapsam dışı feature'ların tam listesi bölüm 2'dedir. Yeni karar veya backend yetkisi bu eşlemeyi değiştirirse ilgili modül planı aynı değişiklikte güncellenir.

## 11. WEB-S01 güncel kabul durumu

**S01 açık; aktif iş davet dışındaki gerçek sağlayıcı ve hesap güvenliği kabulüdür.** S02 ayrı [Draft PR93](https://github.com/SXQHex/FtkSaaS/pull/93) içinde bekler. Uygulanan ekranlar ve başarılı CI, aşağıdaki açık gerçek kabulün yerine geçmez. WF00/WF01/WF04/WF12/WF17/WF20 sınırları korunur.

### Kaynak ve dağıtım

[PR111](https://github.com/SXQHex/FtkSaaS/pull/111) main `67d61da93a0972b58f14ca635be1196ace3ecaf5` kaynağına birleşti. Aday `890960f0bf3670c12e2b2120c66848efab1d64d6` için [frontend ve dört tarayıcı](https://github.com/SXQHex/FtkSaaS/actions/runs/41268706753) başarılı; [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41269047453), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41269047503) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41269088028) başarılıdır. Kullanıcının frontend tasarım değişiklikleri korunmuştur. Sonraki QR uygulaması `fix/web-s01-completion` dalındadır; önceki CI bu yeni farkı kabul etmez.

- PR103 head `d9e6a74d18c1512e0111c444491b153420be6c13`, base `35218844948b186f71836e7d5cee0f8065d49d69`, tested merge `36b677c940bfb6fca7132291e76d82cecca27e1b`. [Aday kaynak kabulü](https://github.com/SXQHex/FtkSaaS/actions/runs/41220085478), [uyumluluk](https://github.com/SXQHex/FtkSaaS/actions/runs/41220085382) ve [dört tarayıcılı frontend](https://github.com/SXQHex/FtkSaaS/actions/runs/41220085433) başarılıdır; kabul edilen ağaç PR103 main kaynağıyla aynıdır.
- PR103 main `fd410ba8224983b47fe62db67639750063ec6d0a` için [frontend](https://github.com/SXQHex/FtkSaaS/actions/runs/41220735720), [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41220735699), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41220735649), [uyumluluk](https://github.com/SXQHex/FtkSaaS/actions/runs/41220735626) ve [development delivery](https://github.com/SXQHex/FtkSaaS/actions/runs/41220763324) başarılıdır.
- Vercel production [EJ37SMcDzMyrJ4CNU29QtMDFq46m](https://vercel.com/erkinkunbuk-4818/ftksaas-web/EJ37SMcDzMyrJ4CNU29QtMDFq46m) PR103 main SHA'sında READY; `uye.fethiyetango.com` alias'ı doğrulandı.
- PR104 için aday kabulü ve main [frontend kapsamı](https://github.com/SXQHex/FtkSaaS/actions/runs/41225768563), [uyumluluk kapsamı](https://github.com/SXQHex/FtkSaaS/actions/runs/41225768590), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41225768557) ve [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41225768576) başarılıdır. Belge kapsamındaki test atlamaları runtime kabulü sayılmaz.
- PR105 head `1cf763eb2117c41f894df8c4a5be6f7b306a4d0d`, base `89f9e099a7424d99065eb7f6791ae486f0d8fa50`, tested merge `1a132a9ab1ae8628b9948bf9ad2cbbd17e42ce0a`. [Dört tarayıcılı frontend](https://github.com/SXQHex/FtkSaaS/actions/runs/41227424270), [aday kaynak kabulü](https://github.com/SXQHex/FtkSaaS/actions/runs/41227424267) ve [uyumluluk kapsamı](https://github.com/SXQHex/FtkSaaS/actions/runs/41227424271) başarılıdır; frontend-only kapsamda backend clean çalışmadı.
- PR105 main için [frontend](https://github.com/SXQHex/FtkSaaS/actions/runs/41228179052), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41228179037), [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41228179118), [uyumluluk kapsamı](https://github.com/SXQHex/FtkSaaS/actions/runs/41228179018) ve [development delivery](https://github.com/SXQHex/FtkSaaS/actions/runs/41228210899) başarılıdır. Vercel production [5ftpSQa1Fbmvuckv1QHUYDm7AQ1C](https://vercel.com/erkinkunbuk-4818/ftksaas-web/5ftpSQa1Fbmvuckv1QHUYDm7AQ1C) aynı main SHA'sında READY; `uye.fethiyetango.com` alias'ı doğrulandı.

- Fotoğraf otomatik kayıt dalında `pnpm check:frontend` geçti: 220 web + 1 UI testi, lint/typecheck/build. Frontend isolation başarılı. 13 fotoğraf regresyonu dosya seçimi/silme, hata/sonuç kurtarma, taslak korunması, erişim kaybı ve çakışan yeniden okumayı kapsar. Bağımsız incelemedeki iki bulgu regresyonları önce kırmızı, düzeltmeden sonra yeşildir; son kaynakta açık zorunlu bulgu yoktur. Eski sürüm anahtarıyla formu yeniden mount eden mutasyon taslak testini kırdı; kaynak birebir geri alındı. `pnpm test:frontend:e2e` içinde 4 HTTP testi geçti, 88 tarayıcı testi eksik Playwright binary nedeniyle başlayamadı. PR106 aday [dört tarayıcı CI](https://github.com/SXQHex/FtkSaaS/actions/runs/41231898721) ve main [frontend kontrolü](https://github.com/SXQHex/FtkSaaS/actions/runs/41233714326) başarılıdır. Vercel production `dpl_HtFNdsKii4KVuRNaAHEBEZHa9qDY`, aynı main SHA'sında READY; `uye.fethiyetango.com` alias'ı doğrulandı. Yeni otomatik fotoğraf akışının aşağıdaki hosted kabulü bu kaynağa aittir.

### Uygulanan tüketiciler ve yapılandırma

Native kayıt ön kontrolü/sunucu route'u, Google link/unlink, TOTP kaldırma, parola current_password/hata/nonce ve PKCE kurtarma tüketicileri [settings.md](../../../docs/settings.md) sözleşmesine bağlıdır. Kaldırılmış uygulama Auth operasyonları için uyumluluk yolu yoktur. Profil/oturum/silme uygulama komutları korunur.

Ortak next-intl sağlayıcısı tarayıcı saat dilimini uygular; açık merkez takvimi saat dilimi korunur. Boş kimlik satırları ve genel hesap açıklamaları kaldırıldı. Formlarda zorunlu alan işareti, placeholder ve alan altı hata vardır. Telefon doğrulama/E.164 dönüşümü `libphonenumber-js/max`, varsayılan ülke `TR` ile yapılır; özel biçim dönüştürücü yoktur.

PR106 fotoğraf değişikliğinde kullanıcı eki `noneProfile.svg`, byte'ları korunarak `public/images/default-profile.svg` olarak eklenir. Küçük düzenle/kaldır düğmeleri görselin üzerindedir. Dosya seçimi `imageUpload` doğrulaması → sürümlü `account_profile_update_v1` → taze profil/sürüm ve özel `media_get_v1` okumasıyla otomatik kaydolur; kaldırma `photo: null` ile aynı hattı kullanır. Preview gerektirmeyen WF01 profil komutu korunur. Yükleniyor/kaydedildi/kaldırılıyor/kaldırıldı durumları TR/EN gösterilir; yüklenen kullanıcı dosyaları hâlâ yalnız PNG/JPEG/WebP ve en fazla 1 MB'dır. Fotoğraf isteği kayıtlı görünen adı kullanır, ad/telefon taslağını göndermez veya silmez. Ortak komut kilidi, aynı operation key ile sonuç kontrolü/replay ve yeniden okuma tamamlanmadan yeni yazmayı engelleme korunur; idempotent tekrarın sürümü değiştirmemesi kilidi takılı bırakmaz. Geçici yeniden okuma hatasında taslak korunur, erişim kaybında eski hesap temizlenir.

Vercel Production'da `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_ORIGIN` ve yalnız sunucuda kullanılan `FTK_PUBLIC_INGRESS_SECRET` vardır. Mükerrer FTK hostname/backend origin/anon key değişkenleri oluşturulmaz; route mevcut değerleri backend transport'una eşler. Eski S01 dalına özel Preview kayıtları kaldırıldı. Vercel–Supabase ingress değerlerinin eşleşmesi doğrulandı; hash secret değiştirilmedi. Supabase Turnstile hostname/secret çifti public başvuru içindir, native Auth kaydı için değildir.

Gerçek production route'una platform IP'siyle gönderilen ön kontrol yeni test adresinde HTTP200 `available`, mevcut hesapta HTTP200 `account_exists`, yabancı Origin'de HTTP403 `FORBIDDEN` döndürdü; yanıtlar `no-store`. İsteklere sahte forwarding/IP başlığı eklenmedi. Ön kontrol hesap veya e-posta üretmedi. Signed ingress hazırlığı kapalıdır; signup ekranı/sağlayıcı kabulü ayrıca izlenir. Secret/parola/token ve gerçek adresler kaynak veya kabul raporuna alınmaz.

### Native Auth arayüz düzeltmeleri

Kullanıcının native Supabase Auth davranışını koruma kararıyla çift onay, PKCE exchange ve oturum/kimlik yazımı sağlayıcıda kalır. Native [verify.go](https://github.com/supabase/auth/blob/master/internal/api/verify.go) ilk onayda `code` yerine fragment mesajı döndürür. Frontend `/auth/confirmation` ekranı bu bilinen mesajı yalnız diğer adresi onaylama yönergesi olarak gösterir; oturum oluşturmaz veya değişiklik tamamlandı demez. Fragment hataları önceliklidir, bilinmeyen/eksik mesaj hata gösterir ve ayrıntılar URL'den temizlenir. İlk callback dönüş çerezini korur; ikinci PKCE callback mevcut doğrulama ve yerel hedef denetimini kullanır. Recovery ve açık provider hataları eski hata yollarını korur. Provider callback URL/izin listesi, e-posta şablonları ve backend değişmedi. `8179cf3` S01 kaynağında `pnpm check:frontend` geçti: 256 web + 1 UI testi, lint/typecheck/build. Sonraki PR109/PR110 main birleşimi frontend runtime/test, UI, API tipleri, TypeScript ayarları ve workspace bağımlılık girdilerini değiştirmedi; bunların önce test edilen kaynakla eşitliği doğrulandı. Bu nedenle aynı yerel testler tekrarlanmadı; PR111 aday CI kabulü kaynak bölümünde, kalan hosted adımlar aşağıdadır. Frontend isolation ve `git diff --check` başarılı; bağımsız son kaynak incelemesinde Critical/Required bulgu yok. İlk-onay regresyonları eski route üzerinde kırmızı, düzeltmeden sonra yeşildir. Fragment hata önceliğini kaldıran mutasyon üç testi kırdı; kaynak byte-for-byte geri alındı ve hedef testler tekrar geçti. Google bağlılık koşulunu ters çeviren mutasyon beş testi kırdı; kaynak geri alındı. İncelemede bulunan eski boş kimlik listesinin başarısız yeniden okumada korunması, yeniden okumayı başlatan iki olayda listeyi temizleyerek düzeltildi; deferred retry regresyonu önce kırmızı sonra yeşildir. Main birleşiminden önceki `pnpm test:frontend:e2e` dört HTTP testini geçti; 96 browser testi eksik Playwright binary nedeniyle başlayamadı. Resmî tarayıcı kurulum komutu geçersiz/eksik indirme arşivi nedeniyle başarısız oldu; testler veya sürümler gevşetilmedi. PR111 dört tarayıcı CI kabulü geçti; hosted ilk/ikinci onay kabulü açık kalır.

Kullanıcının ek isteğiyle mevcut Google kimliği varken “Google hesabını bağla” gizlenir; bağlı hesap ve kaldırma seçeneği korunur. Düğme yalnız native kimlik okuması başarılı ve Google kimliği yoksa görünür. Her yeniden okuma önce önceki kimlik listesini temizler; hata durumunda eski boş liste bağlama düğmesini açamaz. Başarılı kaldırma sonrası güncel okuma düğmeyi yeniden açar; son-kimlik reddi mevcut bağlantıyı ve gizli bağlama durumunu korur. Native [kimlik bağlama kaynak kodu](https://github.com/supabase/auth/blob/master/internal/api/identity.go) farklı provider subject kimliklerine izin verir; yeni sunucu/kimlik kısıtı eklenmedi. 1 Kasım yeni Google girişinde bağlı kimlik ve kaldırma düğmesi görünürken yeniden bağlama düğmesinin gizli olduğu canlıda doğrulandı.

### Gerçek ortamda doğrulananlar

31 Ekim–1 Kasım 2026 Chrome eklentisiyle `uye.fethiyetango.com` üzerinde test hesapları kullanıldı. SQL yalnız sonucu okumak için kullanıldı; kullanıcı akışlarının yerine doğrudan tablo yazma, reset veya seed yapılmadı.

| Akış | Kanıt ve sınır |
|---|---|
| Yeni kayıt ve doğrulama | Ayrı test hesabının 30 Ekim 08:19:46Z doğrulama postası Resend'de delivered; kullanıcı bağlantıyı onayladı, native doğrulama ve giriş kabul edildi. Otomatik merkez/rol oluşmadı. PR103 sonrası yeni signup/resend ekran kabulü henüz tekrarlanmadı. |
| Profil ve alan doğrulama | Profil adı yazma/yeniden okuma/geri alma kabul edildi. Boş görünen ad alanı zorunlu hatası, geçersiz telefon alan altı hatası verdi. Yerel TR test numarası profil komutuyla E.164 kaydedildi; DB okuması doğruladı. Test numarası formdan temizlendi ve null yeniden okundu. Fotoğrafın önceki ve yeni akış kabulü ayrı satırdadır. |
| Oturum etiketi ve geçmiş | Geçici ad kaydedildi, taze listede ve güvenlik geçmişinde görüldü; etiket temizlendi. Saatler cihazın TR görünümüyle tutarlıydı. |
| Diğer oturumları kapatma | İkinci bağımsız native parola oturumu açıldı; Edge account_get önce başarılıydı. Chrome'da mevcut parola ile taze doğrulama ve others komutu sonrası yalnız yeni Chrome oturumu kaldı. Eski bearer ile account_get HTTP401 AUTH_REQUIRED, eski refresh isteği HTTP400 döndü. Güvenlik geçmişi olayı gösterdi. |
| Mevcut ve seçili oturumu kapatma | Current UI onayı sonrası giriş ekranına döndü. Sonraki doğru parola girişi çalıştı; yanlış parola anlaşılır hata verdi. Bağımsız native test oturumu Chrome listesinden selected komutuyla kapatıldı; mevcut Chrome korundu, geçmiş olayı ve eski bearer için HTTP401 AUTH_REQUIRED doğrulandı. |
| Başka hesaba ait oturum | Aktif yabancı session referansına label ve selected revoke, bağımsız native admin oturumuyla Edge üzerinden ayrı çağrıldı; ikisi de NOT_FOUND döndü. Salt okunur DB kontrolü yabancı oturumun korunduğunu ve etiket yazılmadığını doğruladı. Tanılama oturumu native logout ile kapatıldı. Sayfalama ayrıca açık. |
| Google girişi ve hesap değiştirme | Önceden bağlı Google kimliği doğru mevcut hesaba ve korumalı `/account` hedefine döndü; yeni hesap oluşturulmadı. Davet ekranındaki yeniden giriş bağlantısından farklı test hesabına geçildi, `/invite` dönüşü ve yeni hesap adı doğrulandı; eski form değeri taşınmadı. |
| Google bağlantısını kaldırma | Kullanıcının istediği test adresini serbest bırakmak için admin hesabındaki Google kimliği UI'dan kaldırıldı. Native kimlik okumasında Google bağı yok, e-posta kimliği korunmuştu. Chrome oturumu yenilendi; güvenlik geçmişinde kaldırma olayı görüldü. Kayıtlı ana adrese 31 Ekim 17:36:17Z güvenlik bildirimi Resend'de delivered. Test adresi admin hesabına geri bağlanmadı. Ayrı Google-only hesapta son kimliği kaldırma native sağlayıcı tarafından reddedildi ve kimlik korundu. PR105 sonrasında native `single_identity_not_deletable` kodunun anlaşılır mesajı canlıda doğrulandı. Google-only hesaba parola eklenip parolayla giriş yapıldıktan sonra da native kimlik listesi yalnız Google kaldı ve kaldırma reddi korundu; sağlayıcının [auth#2085](https://github.com/supabase/auth/issues/2085) kısıtıyla uyumludur. Doğrudan Auth tablo yazması yapılmadı; yeni bağlama/kaldırma kabulü açık. |
| Ayrı Google hesabı ve TOTP | Serbest bırakılan test adresiyle ayrı, e-postası doğrulanmış Google hesabı oluştu; merkez/rol atanmadı. PR105 sonrası bekleyen kurulumları UI'dan iptal etme ve faktörün kaldırılması kabul edildi. 1 Kasımda yeni kurulumda yanlış kod reddedildi; doğru kodla faktör doğrulandı, anahtar ekrandan kalktı ve yenilemede korundu. Kullanıcı Google hesabını seçtikten sonra yeni giriş `/mfa` kapısına geldi; doğrudan `/account` açma da aynı kapıya döndü. Yanlış kod reddedildi, doğru kodla hesap açıldı. Doğrulanmış faktörü kaldırmada yanlış kod faktörü korudu; doğru kodla native kaldırma başarılı oldu. Oturum yenilemesi ve sayfa yenilemesinden sonra hesap erişimi korundu, faktör listesi boştu. Ekleme 31 Ekim 22:45:09Z ve kaldırma 22:52:34Z güvenlik bildirimleri Resend'de delivered, Gmail'de görüldü. Son durumda etkin TOTP yok; geçici anahtar temizlendi. 1 Kasımda yeni Google girişi hesap ekranına ulaştı; faktör listesi boştu. |
| Native e-posta değişimi | Aynı gelen kutusuna ulaşan geçici alias ile UI'dan değişiklik istendi; eski doğrulanmış adres ve yeni pending adres birlikte göründü. Her iki adrese native doğrulama postaları delivered oldu. İlk bağlantı sonrası eski adres korundu ve değişiklik pending kaldı; ikinci bağlantı sonrası yeni adres doğrulanmış göründü. Aynı çift onay zinciriyle ilk adrese geri dönüldü; son durumda başlangıç adresi doğrulanmış, pending değişiklik yoktur. Canlı callback ilk onayı yanlışlıkla geçersiz bağlantı olarak gösterdi ve dönüş çerezini erken sildiği için ikinci onay `/account` yerine `/` açtı. Yerel düzeltme ve hosted kabul ayrı izlenir; native çift onay kapısı değiştirilmedi. |
| İlk parola ekleme ve bildirimi | Kullanıcı Google-only hesapta 31 Ekim 18:19:48Z ilk parolayı kaydetti; native parola varlığı doğrulandı. 18:19:50Z password-changed güvenlik bildirimi Resend'de delivered ve doğru Gmail kutusunda görüldü. Kullanıcı yeni parolayla tekrar giriş yaptı; korumalı hesap ekranı doğrulandı. Native bildirim ek onay/undo bağlantısı içermiyor. Bu kanıt mevcut parolayı değiştirme veya kurtarma formunda kaydetme kabulü değildir. |
| Fotoğrafın önceki kaydetme akışı | Kullanıcının seçtiği 1920×1920 JPEG, Profili kaydet ile özel medya hattına yazıldı; görsel UI'da ve sayfa yenilemesinden sonra tekrar okundu. Kaldır → Profili kaydet sonrası ve yeniden yüklemede görsel yoktu. Son durumda test fotoğrafı kaldırıldı. Bu önceki akışın kabulü, aşağıdaki PR106 otomatik akışından ayrıdır. |
| Fotoğrafın otomatik akışı — PR106 | 1 Kasımda kullanıcı JPEG seçti; Profili kaydet kullanılmadan Fotoğraf kaydedildi mesajı ve 1920×1920 görsel doğrulandı. Sayfa yenilemesinde özel medya yeniden yüklendi. Kaldırma sırasında Kaldırılıyor ve ardından Fotoğraf kaldırıldı mesajları görüldü; SVG varsayılan geri geldi ve kaldır düğmesi kapandı. Kaydedilmemiş ad taslağı işlem boyunca korundu; yenilemede ad/telefon taslaklarının sunucuya yazılmadığı ve varsayılan görselin kalıcı olduğu doğrulandı. Telefon taslağının ekrandaki birebir değeri araç maskelemesi nedeniyle ayrıca kanıtlanmadı. 320px görünümde yatay taşma yok; Tab/Enter ile düzenle düğmesi ve dosya seçici erişimi doğrulandı. Gerçek yükleme anındaki geçici mesaj gözlenmedi; bunun otomatik regresyon kabulü ayrı kalır. |
| Kurtarma bağlantısı | UI'dan istenen posta 31 Ekim 17:02:37Z Resend'de delivered. Gerçek bağlantı aynı tarayıcıda PKCE üzerinden `/reset-password` formunu açtı. Aynı bağlantının ikinci kullanımı `/forgot-password` üzerinde geçersiz/süresi dolmuş bağlantı hatası verdi. Yeni parola girilmedi; parola güncelleme/bildirim kabulü buradan çıkarılmaz. Gerçek süre aşımı ve yeni isteğin eski bağlantıyı geçersiz kılması ayrı açık. |
| Davet | Geçersiz kod anlaşılır INVITATION_UNAVAILABLE mesajı verdi. Kullanıcının belirlediği test adresi için gerçek kişi/davet oluşturuldu; önceki yanlış alıcılı davet yeni komutla iptal edildi. Gerçek teslim ve iş takibi engeli [XREQ-003](../../../docs/requests.md#xreq-003-gerçek-davet-teslimi-ve-iş-takibi) kapsamındadır. Doğru/yanlış hesap, expired/revoked token ve link çakışması kabulü açık kalır. |
| Hesap silme ve takip | Owner hesap önizlemesinde sahiplik devri engeli daha önce doğrulandı. Kullanıcının 31 Ekim açık izniyle ayrı, bağlantısız test hesabında preview → mevcut parolayla taze proof → apply tamamlandı. 17:04:47Z talep kabul edildi; DB'de account `deletion_pending`, tüm o andaki native oturumlar kapalıydı. Yeniden native girişle kendi takip sayfası okunabildi; normal `/account` verisi reddedildi. Başka hesap aynı job referansını UI'dan sorgulayınca NOT_FOUND mesajı aldı. |
| İmha durumu | Worker talebi `partial`, işi `retry_wait` durumuna getirdi. UI kimlik sağlayıcısı, yedekler, veritabanı, dışa aktarılan dosyalar ve özel dosyaların beklediğini gösterdi. Fiziksel imha tamamlandı denmedi. Backend OPS-01/REL-01 kapsamı frontend tarafından kapatılmaz. Kayıp yanıt/replay ayrıca açık. |
| Görünüm | Hesap ekranı TR/EN ve açık/sistem-koyu görünümde okundu. 320px'de document scrollWidth/clientWidth eşit, taşan öğe yoktu; viewport ve tercihler geri alındı. Tab ile dil seçimine erişim, Enter/Escape ile açma/kapatma ve odak dönüşü doğrulandı. Boş ad formunu Enter ile gönderince alan odağı, aria-invalid ve hata açıklaması ilişkisi doğrulandı. Ayrı Google hesabında skip link ana içeriğe odaklandı; Tab ile profil, iletişim, parola, oturum, TOTP, Google ve silme kontrollerine sıralı erişimde odak kapanı görülmedi. Boş parola formunda yeni parola alanına odak, aria-invalid ve hata açıklaması ilişkisi doğrulandı. Bütün durumların klavye/axe ve gerçek %200 kabulü açık; önceki CI kanıtı ayrı kalır. |

### Kalan kapanış kapıları

- Mevcut parola değişimi kullanıcının 1 Kasım teyidiyle tamamlandı; tekrar açık iş değildir. Kurtarma formunda gerçek güncelleme, yeni parola ile giriş, süre aşımı ve tekrar gönderim ayrı kabul adımlarıdır. Kullanıcının verdiği test parolası belgeye/fixture’a yazılmaz. Son tarayıcı denemesinde Google test hesabı bu parolayla girişte native hatalı kimlik bilgisi sonucu verdi; tekrar denenmedi.

- TOTP kurulum/giriş kapısı/yanlış-doğru kod/kaldırma ve kaldırma sonrası oturum yenilemesi kabul edildi; 1 Kasım Google ile tamamen yeni girişte MFA kapısı olmadan hesap erişimi ve boş faktör listesi doğrulandı. Google bağlı kimliği ekranda görünürken tekrar bağlama düğmesi gizliydi; PR111 bu canlı kabulü geçti. Yeni bağlama/kaldırma ayrı açık kalır. E-posta pending/çift onay/confirmed ve geri alma kabul edildi; callback düzeltmesinin hosted ilk/ikinci onay, süresi dolmuş/kullanılmış bağlantı ve kayıp oturum kabulü açık. Gerçek SMS ayrı ve ertelenmiş sağlayıcı entegrasyonudur; numara kaydı teslim kanıtı değildir.
- Fotoğrafın otomatik kayıt/kaldırma, SVG default, kalıcılık, ad taslağı ve dar ekran/klavye kabulü tamamlandı; gerçek yükleme sırasındaki geçici mesaj ve bütün ekranın %200/axe kabulü ayrı kalır. Oturum sayfalama; [XREQ-003](../../../docs/requests.md#xreq-003-gerçek-davet-teslimi-ve-iş-takibi) tesliminden sonra gerçek davet kabulü/yanlış hesap/expiry/revoke/link çakışması; silme kayıp yanıt/replay ve güncel ekranın tam klavye/%200 kabulü.
- TOTP kurulum UX: native SDK QR verisi doğrudan, optimizasyon servisine gönderilmeden gösterilir; TR/EN uygulama yönergesi ve elle anahtar seçeneği vardır. İptalde QR/anahtar kaldırma regresyonu geçti; yanlış kodda kurulumun korunması ve başarılı doğrulamada temizlenmesi ek regresyonla geçti (account-flows: 26 test). Yerel frontend kontrolleri 256 web + 1 UI testi, lint/typecheck/build ile başarılı. Yeni QR ekranının CI/dağıtım ve gerçek tarama kabulü açıktır.

Davet kullanıcı isteğiyle bu devam turunun dışındadır; XREQ-003 ve davet kabulü açık kalır. S01 kapanmadı. Bir test hesabında silme talebi uygulanmıştır; fiziksel imha ve bütün sağlayıcı akışlarının kabulü tamamlanmamıştır.
