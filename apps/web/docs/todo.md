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
- [ ] Parola değişikliğini native sağlayıcının güncel ayarıyla tamamla; sağlayıcı bir challenge/nonce istediğinde onun akışını kullan. Mevcut kabulde kapalı olan secure-password/current-password zorunluluğunu frontend ek koşuluyla geri getirme; ayrı lifecycle reauth kuralları korunur. Google hesap bağlama hazırlığını `account_google_link_prepare_v1` ile mevcut native akışa bağla.
- [ ] `account_sessions_list_v1`, `account_session_label_v1`, `account_sessions_revoke_v1`, `account_security_history_get_v1`, `account_totp_remove_v1` için oturum listesi, adlandırma, iptal ve güvenlik görünümü oluştur.
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

Kullanıcının son kararı: **Bir bölüm bitmeden sonraki bölümün uygulamasına geçilmez.** Frontend'in aktif bölümü ve sırası bu bölümde tutulur. **Aktif bölüm: öğrenci yönetimini tamamlama ve gerçek kabul.** Aşağıdaki liste bağımlılık sırasını gösterir. Aynı anda birden çok yarım bölüm veya yeni modül dalı açılmaz.

S01–S13 işlev kapsamını izler. Teslim bölümleri ise kullanıcının baştan sona kullanabildiği akışlardır: örneğin davet kabulü öğrenci bölümünde, satışın zorunlu belge adımı satış bölümünde çalışır. Ortak bir bağımlılık önce kullanılacağı bölümün içinde tamamlanır ve daha sonra yeniden yazılmaz. Bölümün kabulü ileride yazılacak bir ekrana bağlanmaz: gerektiğinde yetkilendirilmiş mevcut kayıt kullanılır; yeni ekranlar arasındaki uçtan uca bağlantı, bağlantıyı kullanan sonraki bölümün açık kabul maddesidir. Gerekli gerçek kayıt/okuma yoksa bölüm engelli kalır, mock ile kapanmaz. Başka bir bölüme ait henüz yapılmamış işlem, mevcut bölümde çalışıyormuş gibi düğme/özet olarak sunulmaz.

| Sıra | Tamamlanacak bölüm | Bölüm kapanışının somut sonucu |
|---|---|---|
| 1 | **Öğrenci yönetimi** — S04 çekirdeği ve gereken S01 davet kabulü | Mevcut liste/profil/oluşturma/düzenleme/öğrencilik akışları; disiplin, birleştirme ve hesap erişimi dahil gerçek kabul. Paket/finans alt görünümü kendi sonraki bölümünün sorumluluğudur; bu aşamada sahte özet eklenmez. |
| 2 | **Hesap ve güvenlik** — S01, kendi tercihleri için S12 | Giriş/kayıt/kurtarma/Google/TOTP, profil, oturumlar, güvenlik ve hesap lifecycle akışları tamam. |
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

Kapsam dışı feature'ların tam listesi bölüm 2'dedir. Yeni karar veya backend yetkisi bu eşlemeyi etkilerse frontend sahibi kendi yetkili görevinde planı günceller. Backend somut tüketim ihtiyacını ortak talep kaydında bildirir; frontend planını kendisi değiştirmez.
