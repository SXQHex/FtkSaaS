# Proje iş akışları

Frontend için başlangıç noktası budur. API seçmeden önce kullanıcı amacını aşağıdaki akışla eşleştir; sonra alan devrini ve üretilmiş [operasyon haritasını](functions.md) oku. DTO alanları burada tekrar edilmez: `packages/api-contracts/schema/contract.json` ve üretilmiş `@ftksaas/api-contracts` kullanılır. Ortak ürün/plan kararları kök `docs/contracts` ve `docs/decisions` sahibindedir.

Bu rehber ekran tasarımı veya yeni ürün kararı değildir. Akışın belgelenmesi, test dosyasının bulunması, yerel test başarısı ve gerçek hosted ekran kabulü farklıdır. Güncel kabul ve açık işler kök kaynak indeksinden okunur. Her API'nin birincil akışı [açık eşlemede](workflows.json) yer alır; bir ekran birden fazla akış kullanabilir. Bütün API'leri bir Starter ekranında kullanmak hedef değildir.

## WF00

### Amaç ve önkoşullar

Bütün akışların ortak istemci protokolü. Native Supabase Auth ile doğrulanmış kullanıcı, gerekli MFA, güncel organizasyon/merkez kapsamı ve çağrılabilir API gerekir. Owner olmak merkez işlemi yetkisi vermez. İnsan istemci service-only RPC veya core/private tabloya bağlanmaz; worker işlemleri kullanıcı butonuna dönüştürülmez.

### Çağrı sırası

Ekranın gerekli okumalarını yap → güncel sürüm/izin/plan bilgisini kullan → gerekiyorsa preview al → kullanıcı gerçek etkiyi onaylasın → aynı payload ve operation_key ile komutu gönder → typed iş sonucunu değerlendir → ilgili okumaları yenile. Önizlemede alan/dependency değişirse yeni önizleme gerekir. Bir API'nin `operation_contract.read_operation` alanı bütün selector'ların uygulanmış olduğunu kanıtlamaz; runtime sınırları da okunur.

### Hata ve kurtarma

HTTP200 tek başına başarı değildir; `ok`, typed data ve SafeError değerlendirilir. Hata metni parse edilmez. VERSION_CONFLICT/PREVIEW_STALE durumunda güncel kaynak yeniden okunur ve yeni onay alınır. FORBIDDEN/NOT_FOUND/plan reddi güncel erişimi gösterir; daha önce sonucu kaybolmuş komutun geri alındığını kanıtlamaz. Zaman aşımında yeni operation_key üretilmez; `operation_status_get_v1` ve orijinal istekle replay kullanılır. `preview_get_v1` teknik önizleme okumadır; `job_status_get_v1` asenkron iş durumudur, birbirinin yerine geçmez. Sonuç saklama süresi bittiyse otomatik yeni işlem başlatılmaz; ilgili domain verisi ve yetkili incelemeyle uzlaştırılır. Hesap/tenant değişiminde eski yanıt veya takip kaydı yeni kapsamda kullanılmaz.

### Sonuç ve yan etkiler

request_id transport denemesine, operation_key tek iş niyetine aittir. Preview iş verisini kesinleştirmez. Domain değişikliği, receipt, audit ve gerekli outbox atomiktir; dış teslimat iş başarısının koşulu değildir. Başarılı komuttan sonra yalnız etkilenen liste/detay/bakiye yeniden okunur. Cursor farklı filtre/aktör/kapsama taşınmaz. DTO, sürüm ve yeniden deneme ayrıntısı alan devrindedir; test dosyası çalıştırılmış kabul yerine geçmez.

## WF01

**Amaç/aktör:** Kendi hesabına giriş, profil ve güvenlik yönetimi. Hesap ile stüdyodaki kişi/öğrencilik aynı varlık değildir.

**Sıra:** E-posta/parola kaydı için güvenilir sunucu transport’u → `account_signup_request_v1` → `account_exists` veya `confirmation_required`. Mevcut adreste kayıt/posta çağrısı yapılmaz; yeni adreste native Auth doğrulaması sürer. Alanlar, PKCE ve hata kurtarması [kayıt tüketicisinde](settings.md#e-posta-parola-kayıt-tüketicisi) tanımlıdır. Giriş/kurtarma/Google/TOTP için native sağlayıcı akışı → native oturum/MFA doğrulama → `account_get_v1` → gereken profil veya güvenlik okuması → ilgili hesap komutu → dönen güncel oturum ve hesap verisini yeniden oku. Profil yazma sürümü için account_get'ten olmayan bir sürüm türetilmez. Oturumlar `account_sessions_list_v1`, güvenlik geçmişi `account_security_history_get_v1` ile okunur; label/revoke açık hedef kimliği kullanır. Native parola/Google işlemi ile Edge hesap politikası aynı endpoint sayılmaz.

**Hata/kurtarma:** Doğrulama bekleyen e-posta giriş yapılmış sayılmaz; provider callback/reauth/MFA başarısızsa özel sahte completion yoktur. Oturum iptali sonrası eski tokenla başarı varsayılmaz. Şifre/reauth kanıtı loglanmaz. **Sonuç/yenileme:** Hesap, güvenlik geçmişi ve etkilenen oturum listesi yenilenir; hesap işlemi kendiliğinden organizasyon, kişi, rol veya satış üretmez.

Hesap kimliği, native provider ve oturum komutlarının alan/sürüm ayrıntıları [ayar ve hesap tüketicilerinde](settings.md#hesap-oturum-ve-totp-api-devri) tek yerde tutulur. Hesap içi parola değişiminde native mevcut parola kontrolü ve eski oturum için native nonce doğrulaması, kayıtlı adrese güvenlik bildirimi ve “Bu işlemi ben yapmadım” bağlantısından süreli/tek kullanımlık native kurtarma sırası [parola tüketicisindedir](settings.md#parola-değişimi-ve-güvenlik-bildirimi). Kişi iletişimi doğrulanmış olsa da hesap bağlantısı ayrıca gerekir. Native `others` revoke tekrarında sonradan açılmış oturumlar kapatılmaz.

## WF02

**Amaç/aktör:** Yetkili kullanıcı stüdyo ve işlem yetkisini kurar. Owner/OM ile CM kapsamı ayrıdır.

**Sıra:** `organizations_list_v1` → `organization_get_v1`/`centers_list_v1` → gerekliyse organizasyon ve merkez oluştur → `disciplines_list_v1` ve disiplin tanımı/merkez ilişkisi → oda tanımı → kişi ve eğitmen yetkisi (WF04) → canlı rol okumaları/izinli atamalar. Güncel Starter sınırları backend tarafından uygulanır: bir aktif merkez/oda/disiplin/eğitmen ve100 aktif öğrenci. Süreçte ikinci aktif kaynak oluşturma istemci gizlemesiyle değil backend reddiyle sonuçlanır.

**Hata/kurtarma:** Bootstrap/kapalı kuruluş ile aktif çalışma aynı kabul edilmez; izin yoksa kaynak kimliği uydurulmaz. Limit ve sürüm reddi güncel okumayla çözülür. **Sonuç/yenileme:** Organizasyon/merkez/disiplin/rol listeleri güncellenir; operasyon yetkisi yeniden değerlendirilir. Eksik oda/sınıf katalog okuması sahte endpoint ile doldurulmaz; backend bağımlılığı olarak bildirilir.

## WF03

**Amaç/aktör:** Yetkili merkez operatörü sınıf, sonlu program ve seansları yönetir; öğrenci/eğitmen yetkili görünümü okur.

**Sıra:** `calendar_get_v1` (merkezin IANA zaman dilimi ve filtreleri) → `session_get_v1` → yönetilecek sınıf/kaynaklar için mevcut yetkili okumalar → `class_save_v1` → `program_preview_v1` → somut UTC oluşumlar/engeller → `program_apply_v1` → takvim ve seansları yeniden oku. Tekil seans `session_create_v1`; seans değişikliği `session_change_preview_v1` → `session_change_apply_v1`. Scope `single` veya aynı programdaki uygun `this_and_future` oluşumlarıdır. İptal `session_cancel_preview_v1` → `session_cancel_apply_v1`; yerine seans ayrıca `replacement_session_create_v1` ile oluşturulur.

**Hata/kurtarma:** DST boş saat reddedilir, çift saatte açık offset seçimi gerekir; seri içindeki sonraki çift saatler de açık seçim ister. Kaynak/oda/eğitmen çakışması, politika, sürüm ve rezervasyon engelleri kullanıcıya gösterilir; preview engelliyse apply yapılmaz. Eksik selector veya katalog okuması contract-only/unsupported ise geliştirme bağımlılığıdır. **Sonuç/yan etki:** Kapasite azaltmak mevcut kesin rezervasyonu iptal etmez; saat/kaynak değişikliği mevcut hakları yeniden denetler. Takvim zamanı gerçekleşme/yoklama değildir. Starter tek mantıksal oda kullanır; anlaşmasız çalışır, hakediş üretmez. Başarıda calendar/session/reservation okumaları yenilenir.

Program aralığı `[starts_on, ends_on)` ve ISO haftanın günü 1–7 ile sonludur; sonsuz tekrar üretilmez. `offset_choices`, ilk oluşum dahil aralıktaki her çift DST saati için açık seçim taşır. `this_and_future` aynı programın uygun, materialize edilmiş planned/open oluşumlarını kapsar.

Sınıf görevlendirmesi eğitmen/asistan duty atamasıdır; öğrenci sabit grup kaydı değildir. `expected_version` sınıfın değil assignment satırının sürümüdür; seans görevlendirmesi seans sürümünü kullanır. Açık pasif override sınıf görevi kaldırılıp yeniden eklenince canlanmaz. Seans patch'indeki assignments tam değiştirme listesidir; `inherit_defaults` açıkça seçilir. Yalnız kapasite değişikliği kaynak/görevleri yeniden yazmaz veya ilgisiz anlaşma/uygunluk düzeltmesini zorlamaz. Saat/kaynak değişiminde mevcut rezervasyonun seçili satış kaynağı yeniden doğrulanır; alternatif satışa sessiz geçilmez.

Takvim aralığı UTC overlap ile, merkez IANA saat dilimi korunarak okunur. CM kendi merkezini, eğitmen/asistan canlı görevlendirmesini, öğrenci kendi yetkili kayıtlarını görür. Cursor filtre/scope'a bağlı keyset ve `as_of` taşır; dondurulmuş veri snapshot'ı değildir. `session_get_v1` merkez kapsamını seans üzerinden çözer. Kapasite alanları ve ayrı kontrollü aşımın tek normatif kaynağı [kapasite bölümü](contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari).

## WF04

**Amaç/aktör:** Yetkili merkez kullanıcısı kişi ve öğrencilik ilişkisini yönetir; hesap bağlantısını ayrıca kurar.

**Sıra:** `people_list_v1` (filtre/cursor) → `person_get_v1` → oluşturma/düzeltme → `student_activate_v1` veya gerekçeli `student_deactivate_v1` → kişi/listeleri yeniden oku. Disiplin ilişkisi `person_discipline_set_v1` ile ayrıca yönetilir. Hesap daveti `account_access_send_v1` → doğrulanmış hesabın `account_access_accept_v1`; revoke/link remove bağımsız yetkili işlemdir. Birleştirme ayrı preview/approval/apply zinciridir, aynı iletişimden otomatik çıkarılmaz.

**Hata/kurtarma:** İletişim doğrulaması hesap bağı değildir.101. aktif öğrenci/çözümlenmemiş iş/yanlış merkez reddi otomatik pasifleştirme veya veri silmeyle aşılmaz. **Sonuç/yan etki:** Kişi yaratmak kendiliğinden native hesap, satış veya tahsilat yaratmaz; liste/detay ve etkilenen roller güncellenir. Timeout WF00'a göre takip edilir.

## WF05

**Amaç/aktör:** Satış yetkilisi öğrenciye uygun ürün sürümünü satar; hak yaşam döngüsünü yönetir.

**Sıra:** Kişi/öğrencilik (WF04) → `products_list_v1` → `entitlements_get_v1` ve gerekiyorsa `finance_get_v1` → `sale_preview_v1` → kapsam/tarih/hak/borç/varsa rezervasyon etkisini göster → `sale_apply_v1` → hak, satış ve finans okumalarını yenile. Ürün yayımlama `product_publish_v1` ile sürümlüdür. Starter ürününün seçili merkez/disiplin sınırı ve disiplinle başlayan adı korunur. Kredili/kotalı süreli/sınırsız ürün ile satın alınmış satış/hak aynı nesne değildir.

**Hata/kurtarma:** Tarih, kota, kapsam ve politika istemcide varsayılmaz; uygun ürün bulunamaması başka satış kimliği uydurma izni vermez. Preview bağımlılığı değişirse yenilenir. Kredi/uzatma ve rezervasyon etkisi `reservation_impact_preview_v1` üzerinden onaylanır; ilgili komut veya impact apply alternatif tüketim yollarıdır, ikisi art arda uygulanmaz. Freeze, termination, change, renewal ve refund kendi preview/apply çiftini kullanır; Starter'da her yaşam döngüsü seçeneğinin izinli olduğu varsayılmaz.

**Sonuç/yan etki:** Satışın hak ve borç etkisi backend sonucundan gelir; tahsilat ayrıca WF08'dir. Satış iadesi otomatik nakit çıkışı değildir. Geçmiş katılım/hakediş sonradan ödeme ile yaratılmaz. Kullanılabilir ve ayrılmış hak ayrı gösterilir.

`CatalogProductView.version_id` ürün sürümüdür; `source_sale_id` olarak kullanılamaz. Seans bağlamındaki hak okuması yazarla aynı uygunluk ve `valid_until NULLS LAST / created_at / id` sırasını kullanır. Sınırsız hakta `available_at_session: 1` sayısal kredi değil uygunluk göstergesidir.

Freeze bitişi yerel gün sınırlarını ve fiilen kullanılan dondurma süresini korur; geçmiş süre uydurulmaz. Sonlandırma yalnız serbest kullanılmamış hakkı kapatır. Ürün değişimi bütün gelecek rezervasyonları açık keep/cancel listelerine ayırır; tutulanlar aynı transaction'da uygun yeni kaynağa bağlanır. Gelecek etkinlik kayıtları desteklenen ayrı iptalden geçmeden değişim tamamlanmaz. Renewal bağlı yeni satıştır; eski kredi/süreyi taşımaz veya iptal edilmiş kaydı canlandırmaz; eski satışın para birimi yenisine kendiliğinden zorunlu değildir. Dondurulmuş iade hesabı önce ilgili borcu azaltır, yalnız ödenmiş fazlayı öğrenci alacağına taşır; P03 aynı iadeyi ikinci kez claim edemez.

## WF06

**Amaç/aktör:** Yetkili yönetici veya bağlı öğrenci uygun seansa rezervasyon yapar; özel ders talebini yönetir.

**Sıra:** Takvim/seans → ilgili kişinin `entitlements_get_v1` ve `reservation_list_v1` → açık uygun satış-hak seçimi → `reservation_create_v1` → seans/rezervasyon/hakları yeniden oku. İptal `reservation_cancel_v1` ve güncel politika ile yapılır. Özel ders: `lesson_request_create_v1` → yetkili ret/alternatif/approval; talep sahibi withdraw veya alternative accept yapar. Yönetim sürümü yalnız desteklenen selector'dan alınır.

**Hata/kurtarma:** Kapasite, borç/kredi limiti, belge, uygunluk ve politika reddi kullanıcıya taşınır. İstemci sıradaki satışı otomatik seçerek red gerekçesini değiştirmez. **Sonuç/yan etki:** Rezervasyon hak ayırabilir; dersin gerçekleştiğini veya hakkın tüketildiğini göstermez. Yeni üst politika mevcut kesin rezervasyonu otomatik iptal etmez; gerekçeli yetkili çözüm gerekir. Starter'da bekleme listesi/yer teklifi WF19 çağrılmaz.

Özel ders talebi ve alternatif yanıtı yer/hak tutmaz; alternatif kabulü merkez onayı değildir. Aynı açık talep çoğaltılmaz. Onay tam eşleşen uygun özel seansı seçer veya mevcut seans/rezervasyon yazarlarıyla atomik oluşturur. Süre dışı yönetici işlemi açık `window_exception: true`, boş olmayan gerekçe, `manager_exception` politikası ve canlı CM yetkisi ister; rol tek başına bypass değildir.

## WF07

**Amaç/aktör:** Yetkili operatör gerçek katılımı kaydeder ve yoklamayı kapatır.

**Sıra:** `session_get_v1`, `attendance_get_v1`, gerekiyorsa `reservation_list_v1` → fiilî başlangıç için `attendance_start_v1` → taslak `attendance_mark_v1` → kullanıcı kapanışı onaylar → `attendance_close_v1` → seans/yoklama/haklar yeniden okunur. Kapanmış sonuç `attendance_correct_preview_v1` → gerekçeli `attendance_correct_apply_v1` ile düzeltilir; sessizce taslak gibi yazılmaz.

**Hata/kurtarma:** Çakışan sürüm yeniden okunur. Mevcut rezervasyon koruması yeni kayıt veya negatif limit bypass'ı değildir; eksik krediyle katılımı geçmişe dönük ödeme yoluyla hakedişe dönüştürme yoktur. **Sonuç/yan etki:** Kapanış ve düzeltmede hak hareketi backend'de atomiktir. Starter anlaşmasız kapanır, ücret anlaşması/hakediş üretmez. Saatin geçmiş olması yoklama kapanışı sayılmaz.

Taslak yoklama hak tüketmez. `attendance_start_v1` gerçek başlangıç snapshot'ıdır; planlı saat veya `occurred` etiketi yerine varsayılmaz. Starter kapanışında ücret temeli üretilmez; sonradan plan yükseltmek geçmiş Starter kapanışına hakediş eklemez. Gerçekleşme için otomatik gözlemci/zamanlayıcı varsayılmaz.

## WF08

**Amaç/aktör:** Finans yetkilisi borç, ödeme ve öğrenci alacağını yönetir; öğrenci yalnız izinli öz görünümü okur.

**Sıra:** `finance_get_v1` (kişi/merkez/para birimi) → açık borç/tutar/yöntemle `collection_record_v1` → finansı yenile. Düzeltme `collection_correct_preview_v1` → etki onayı → `collection_correct_apply_v1`. İzinli nakit alacak iadesi `student_credit_refund_v1`, mahsup `student_credit_offset_v1`, gerekçeli borç düzeltmesi `debt_adjust_v1` ile ayrı niyetlerdir.

**Hata/kurtarma:** Para birimleri birleştirilmez; tutar string/minor-unit sözleşmesi kullanılır. Düzeltmedeki yönlü fark yeni toplam sayılmaz. Kullanılmış alacak silinemez; başarısız iş otomatik yeni anahtarla denenmez. **Sonuç/yan etki:** Borç, brüt/net tahsilat ve öğrenci alacağı ayrı gösterilir; satış, borç indirimi ve nakit çıkışı eşitlenmez. Düzeltme bağlı hareket üretir, eski finans geçmişini silmez. Başarıda bakiye ve ilgili geçmiş/satış/hak okunur.

Kalan borç `max(0, net − gross_paid + claimed)` üzerinden okunur; alacağa aktarılmış ödeme ikinci kez borcu kapatmaz. `CashCorrection.amount_minor` yönlü farktır, yeni toplam değildir. Ters tahsisler SignedMoney, bakiye toplamları nonnegative Money'dir. Satış iadesinin aggregate sürümü gerçek satış kimliğine aittir; yeni refund fact ayrı referanstır. Tahsilat yöntemlerinin typed seçimi ve zorunlu referansı [ayar tüketicisinde](settings.md) tanımlıdır.

## WF09

**Amaç/aktör:** Yetkili yayın yöneticisi dersleri duyurur; anonim başvuru sahibi gerçek public transport'u, hesap sahibi kendi takvim bağlantısını kullanır.

**Sıra:** `publication_set_v1` → `public_calendar_get_v1` → gerçek widget/hostname/action/gateway ile `public_application_submit_v1` → yetkili `public_application_review_v1`. Public bağlam native kullanıcı JWT'si taklit edilerek oluşturulmaz. Kişisel takvimde `calendar_links_get_v1` → `calendar_link_create_v1` → dönen URL'yi güvenli göster; rotate/revoke ayrı komutlardır. Feed, GET/HEAD adapter'ı üzerinden `calendar_feed_get_v1` tüketir; kullanıcı oturumu gerektiren yönetim API'siyle aynı transport değildir.

**Hata/kurtarma:** Bot/action/replay/hostname ve canlı yetki kontrolleri gerçek sağlayıcıda doğrulanır. Yeni URL receipt'ten geri kazanılabilir varsayılmaz; credential kaybı ve rotate davranışı alan devrinden uygulanır. **Sonuç/yan etki:** Başvuru genel CRM kampanyası değildir. Feed yalnız canlı izinli görünümü sunar; revoke/rotate/erişim kaybında eski URL geçersizliği ve ICS→yetkili gerçek seans route'u hosted kabulünde ayrıca denenir. Mock/sentetik route bu kabul değildir.

Public adapter native kullanıcıyı taklit etmez: gateway doğrulaması açıkken anon credential legacy JWT'dir; publishable key'i Bearer JWT yerine koyma. HMAC kanonik method/path/time/IP/body hash alanlarını newline ile bağlar, 60 saniyelik pencereyi ve güvenilen sunucu IP kaynağını kullanır. Turnstile `public_application` action'ı ve tam hostname ile doğrulanır; preflight rate-limit provider hatasını da sayar, ham IP saklanmaz. Bilinen iletişimde CM açık eşleme yapar; otomatik kişi birleştirme yoktur.

Public deneme açık ürün/teklif/limit konfigürasyonu ister, ücretsiz fallback üretmez. Süresi dolmamış deneme hold'ları normal rezervasyon ve bekleme teklifleriyle aynı kapasiteyi kullanır. Kişisel takvim credential ve ayar ayrıntıları [takvim tüketicisindedir](settings.md).

## WF10

**Amaç/aktör:** Yetkili rapor/import operatörü veriyi okur veya kontrollü toplu aktarır.

**Sıra:** Rapor filtreleri → `report_get_v1`; dosya gerekiyorsa `report_export_start_v1` → `job_status_get_v1` → hazırsa `report_file_get_v1`. Import: `import_upload_prepare_v1` → izinli upload → `file_upload_complete_v1` → `import_preview_v1` → job/worker → `preview_get_v1` → `import_rows_list_v1` ile satır hataları → kullanıcı onayı → `import_apply_v1` → job ve satır sonuçları → ilgili domain okumaları. Upload descriptor gerçek backend'in desteklediği transport ile kullanılır; Storage varsayılmaz.

**Hata/kurtarma:** Import önizlemesi kişi/satış/borç yazımı değildir. Kalıcı namespace/source_key tekilliği korunur; farklı payload aynı kimlikle sessiz yeniden yazılmaz. Başarısız satır ile başarılı satır ayırt edilir, dosya körlemesine tekrar yüklenmez. **Sonuç/yan etki:** Asenkron apply kabulü işin tamamlandığı anlamına gelmez. Export yalnız güncel yetkili istek sahibi tarafından okunur; süresi dolmuş veya erişimi kaldırılmış dosya indirilemez. Starter rapor/import tipleri plan sözleşmesiyle sınırlıdır; genel üst-plan raporları açılmaz.

Rapor toplamları sayfanın değil bütün filtreli sonucun toplamıdır; para birimleri birleştirilmez. Cursor tam sonuç hash'ine bağlıdır; değişim `VERSION_CONFLICT` verir. Doluluk mevcut fiziksel şema alanını kullanır, renewal bağlı aktif satışı; kaynak kullanımı çalışma aralıklarının birleşimini kullanır. Kullanım `ratio_bps` değeri 10000'i geçebilir; finansal RateBps üst sınırı uygulanmaz.

Export çıktısı private DB byte nesnesidir; public Storage yolu değildir. Job hazır olunca dosya descriptor'ı, sonra authenticated Edge POST ile CSV alınır; `no-store`, 7 günlük erişim süresi ve özgün istek sahibinin canlı yetkileri korunur. Import preview önce job döndürür: worker tamamlandıktan sonra `job.result_reference` ile `preview_get_v1`, ardından satırlar okunur. Apply da job'dır. Upload izni kalıcı domain yazma yetkisi değildir.

Mevcut kişi yalnız `person_ref` ile seçilir; e-postadan otomatik merge yoktur. `opening_credit_value_minor` kalan kredinin değil özgün tüm paketin net bedelidir; açılış borcu ayrı girilir. Geçmiş veri yoksa yalnız desteklenen none/credit_ratio iade yöntemi kullanılabilir; eski katılım/hakediş veya kuruş dilimleri tahmin edilmez. Kalıcı org/namespace/source_key tekilliği, 25 satırlık fenced batch ve satır alt transaction'ı korunur; geç batch hatası bütün batch'i geri alır, başarılı kaynak yeniden uygulanmaz.

## WF11

**Amaç/aktör:** Yetkili belge yöneticisi sürüm yayımlar; ilgili kişi gereksinimi görür ve açık kabul verir. Kullanıcı kendi işlemsel inbox'ını okur.

**Sıra:** `document_upload_prepare_v1` → upload/complete → `document_publication_preview_v1` ile mevcut rezervasyon etkisi → izinli `document_version_publish_v1` → `document_requirements_get_v1` → gerçek sürüm için `document_accept_v1`. Inbox: `notifications_list_v1` → `notification_mark_read_v1` → güncel liste.

**Hata/kurtarma:** Belge yok/eksik kabul sonucu istemcide atlanmaz; yeni şart mevcut kesin rezervasyonun korunumu ile birlikte değerlendirilir. **Sonuç/yan etki:** Okuma ve hukuki kabul aynı şey değildir. Sürüm yayımı otomatik toplu onay üretmez. İşlemsel inbox dış e-posta/SMS/reminder yetkisi vermez; Starter F27 kapalı kalır.

Belge dosyası private, en çok 2 MiB plain text/PDF'dir; organizasyonun açık upload konfigürasyonu gerekir. Prepare iki saatlik yalnız yazma yetkisi verir; göreli signed URL doğru Storage origin'iyle çözülür, overwrite yapılmaz. Completion gerçek byte/sınır/checksum doğrular. İçerik yetkili authenticated dosya okumasından gelir, public link üretilmez.

Gereksinim sorgusu gerçek rezervasyon/satış/katılım bağlamı ister; bağlamsız kişi belge özeti yoktur. Yayın preview'ının bütün etkilenen kayıtları açık onaylanır. Koruma yalnız o belge sürümü/kişi/rezervasyonun mevcut kesin kaydı ve ilgili katılımı içindir; yeni kayıt/başka engel için genel bypass veya sahte kabul değildir.

Bildirim opt-in default ve miras kuralları [ayar sözleşmesinden](contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti), gerçek kanal tüketimi [ayar rehberinden](settings.md) okunur. Native Auth SMTP kurulumu uygulama daveti/pazarlama/push sağlayıcısının teslim kabulü değildir.

## WF12

**Amaç/aktör:** Kullanıcı kendi, yetkili yönetici organizasyon/merkez kapsamındaki desteklenen ayarları yönetir.

**Sıra:** `settings_catalog_get_v1` → `settings_get_v1` → supported/izin/default/miras ve typed alanları göster → `settings_update_v1` → etkili değerleri ve `settings_history_get_v1` oku. Reset `settings_reset_preview_v1` → etki onayı → `settings_reset_apply_v1`. Medya `media_get_v1`; template/preparation resolve domain komutunun yerine geçmez.

**Hata/kurtarma:** Unsupported alan yazılabilir gibi sunulmaz. `null`, miras, false ve sıfır farklıdır. Gerçek provider/domain politikası bir görünüm tercihiyle kurulmuş sayılmaz. **Sonuç/yan etki:** Organizasyonun üç isteğe bağlı #RRGGBB ana/ikincil/vurgu rengi vardır; font paketi seçimi ve merkez özel renk yoktur. Kontrast, açık/koyu ve hata/başarı renkleri sistemce yönetilir. Ayarın davranış etkisi alan tüketici devrinden izlenir; generic ayar yazımı keyfî ürün kuralı oluşturmaz.

## WF13

**Amaç/aktör:** Yetkili abone mevcut planı ve izinli abonelik değişikliğini yönetir.

**Sıra:** `subscription_get_v1` → uygun upgrade quote veya downgrade request → gerekiyorsa `saas_payment_submit_v1` → abonelik ve değişiklik durumunu yeniden oku. Cancel ve renewal tercihi ayrı komutlardır. Platform ödeme doğrulaması/ek süre WF17'dir; müşteri tarafı kendi ödemesini doğrulayamaz.

**Hata/kurtarma:** Yeni işlem, düzeltme, okuma ve worker için billing sınıfı aynı değildir; bütün API'ler tek abonelik boolean'ıyla açılmaz. **Sonuç/yan etki:** Ödeme bildirimi doğrulanmış abonelik değildir. Plan/quota değişimi yeni işlemde canlı denetlenir; mevcut kesin rezervasyon koruması dikkate alınır. Sadece Starter özelliği olan akışlarla üst-plan menüleri karıştırılmaz.

## WF14

Pro/Business ücretli eğitmen görevlendirmesi içindir; Starter'da çağrılmaz. `instructor_agreements_list_v1` → yeni ileri yürürlük sürümü yayımla → görev/yoklama (WF03/WF07) → `earnings_list_v1` → seçili hakedişlere ödeme/düzeltme → hakediş/ödeme geçmişini yeniden oku. Kapalı hakediş eski şartlarını korur; ücret koşulları yerinde değiştirilmez. Geçersiz anlaşma veya fazla ödeme reddi istemcide hesaplanarak aşılmaz. Kişi başı/yüzde ücret açık anlaşma olmadan varsayılmaz.

Yayımlanmış anlaşma zinciri immutable'dır; yerine geçen sürüm açık predecessor/version ile bağlanır, bağımsız çakışan yürürlük reddedilir. Henüz başlamamış seans yürürlükteki yeni şartı, fiilî başlangıcı kaydedilmiş seans sabitlenen anlaşmayı kullanır. Kapanışta fiilen görev yapan eğitmenler açık seçilir. Paket override'ı genel bileşenin yerine geçer, sabit seans ücreti bir kez hesaplanır. Tüketen no-show/geç iptal ilgili tabana girer; blocked/deneme girmez. Kaynaksız negatif katılım önceden sabitlenen değerlemeyi kullanır; sonraki tahsilat geçmiş hakedişi fiyatlandırmaz.

## WF15

Starter dışında bağımsız etkinlik akışı. Liste/detay → save/publish → `event_registration_preview_v1` → gerekiyorsa `event_payment_prepare_v1` ve `event_payment_get_v1` → `event_register_v1` → kayıt/finans/hakları yeniden oku. Ödeme hazırlığı kesin kayıt veya kontenjan garantisi değildir; son kontenjan yarışı backend'de çözülür. Negatif kredi yasaktır. Fiilî başlangıç, etkinlik yoklaması/kapanış/düzeltmesi ayrı komutlardır. Öğrenci iptali ile merkez iptali aynı finans sonucu değildir: merkez iptal preview/apply tam hak iadesi ve ödenmiş tutarın öğrenci alacağına dönüşmesini sağlar; otomatik nakit çıkışı yapmaz. Başlamış/kısmen gerçekleşmiş etkinlikte öğrenci iptali parasal iade üretmez; planlı saati geçmiş iptali sonradan girilen fiilî başlangıçla geriye dönük erken iptal sayma. İlgili teknik sözleşme kararları normatiftir.

Fiilî başlangıç kayıt/düzeltmesi gerekçe ve sürüm ister; draft veya gelecekte başlangıç kabul edilmez. Published/occurred/cancelled kayıtta izinli düzeltme yapılabilir; nullable kaldırma geçmişi silmez. CM audit ayrıntısını, diğer yetkili okuyucular yalnız izinli zamanı görür. Merkezce iptal edilen etkinliğin sonraki mark/close/correct işlemi hakkı yeniden tüketemez. Tahsilat–iptal yarışının iki seri sonucu da tutarlıdır; fazlalık öğrenci alacağında kalır. Etkinlik kararlarının tek normatif sahibi [teknik sözleşmedir](contracts/02-FtkSaaS-teknik-sozlesme.md#etkinlik-kararlari).

## WF16

Starter dışında genel CRM/segment/otomasyon. Lead list/save → faaliyet/takip → izinli trial teklif/kayıt → gerekliyse `lead_convert_v1` → kişi ve CRM durumunu yeniden oku. Public başvuru alımı WF09'dan bağımsız bir genel CRM yetkisi değildir. Segment/automation save worker'ın frontend'den çalıştırılmasını gerektirmez; teslimat ve domain commit farklıdır. Kaynak/onay/hesap bağı ve plan kapıları korunur; doğrulanmamış kişiden otomatik hesap veya satış türetilmez. Rapor/import ile CRM izinleri ayrı değerlendirilir.

Lead mevcut kişi + aday ilişkisiyle kurulur; merkezde ikinci açık lead üretilmez. Personel yalnız kendi atanmış kaydını işler ve atamayı değiştiremez. Conversion ayrı öğrenci yetkisi ister; satış, nakit veya hesap bağlantısı üretmez. Lead'siz öğrenciye izinli follow-up için uydurma lead oluşturulmaz.

## WF17

Kısıtlı yaşam döngüsü ve platform yönetimi. İlgili hesap/organizasyon ve güncel bağımlılıklar → close/delete preview → kullanıcı açık onayı → aynı niyet apply → izinli durum yeniden okunur. Reopen ayrı yetkili işlemdir; kapatmanın silme olduğu varsayılmaz. Platform owner atama/çıkarma, SaaS ödeme doğrulama ve grace yetkileri normal organizasyon yöneticisi menüsüne taşınmaz. Privacy isteğinin alınması fiziksel imha kabulü değildir; retention/legal hold/Auth/Storage/backup non-resurrection ve restore kanıtı ayrı işletim sorumluluğudur. Eski token/hesap/tenant ile replay yetkiyi geri kazandırmaz.

Kişi merge önizlemesi bütün etkilenen merkez onaylarını ve bağımlılıkları sabitler; alias/geçmiş silinmez. Hesap–kişi bağı kaldırma organizasyondaki ilgili CM kapsamlarını denetler, rol/override/grantları kapatır; yeniden bağlama eski yetkiyi canlandırmaz.

Abonelik quote açık TTL/dönem/para birimi taşır. Doğrulanmış ödeme aynı finansman kaynağıyla iki kez kullanılmaz; sıfır tutarlı quote da açık confirm ister. Erken renewal ödemesi dönem sınırını erkene çekmez. Starter'a downgrade tutulacak kapsamı açık seçer; seçilmeyen kaynakların operasyon erişimi kapanır, geçmiş silinmez. Privacy güçlü native yeniden doğrulama ister; aktif owner önce devir yapar. DB/Auth/Storage/export/geçici kopya/yedek kanıtı tamamlanmadan purge tamamlandı denmez. Restore araçları ve imza/head güveni [işletim rehberindedir](../apps/backend/docs/remote-backend-setup.md#restore-ve-yeniden-canlanma-engeli).

## WF18

Business merkezler arası hesaplaşma. Yetkili A merkezi hareketleri/istekleri/authority okur → açık satış bedeli payı üzerinden `settlement_request_submit_v1` → B yetkilisi dondurulmuş hedefe `settlement_request_decide_v1` ile onay veya gerekçeli ret verir → istek/hareket/bakiye yeniden okunur. Withdraw ayrı komuttur. Aynı insan iki merkezde yetkili olabilir; her adımın farklı merkez yetkisi canlı doğrulanır. Süreli/sınırsız seans bedeli uydurulmaz; sadece A-B satış payı temeli kullanılır. Yetki/delegation değişikliği eski onayı veya finans geçmişini yeniden yazmaz.

A→B kullanım payı, kullanılmış diğer dilimler dahil gerçek net satış bedelinin sabit kuruş dilimlerinden hesaplanır; eğitmen maliyeti veya güncel katalog fiyatı değildir. Süreli/sınırsız/ücretsiz ve ilk kaynaksız negatif katılımda transfer bedeli uydurulmaz. Sonradan A'nın uygun kredili satışı B açığını kapatırsa pay oluşur; eğitmen geçmişi değişmez. İade özgün payı bağlı ters hareketle geri alır, eski ödemeyi silmez.

Kısmi düzeltmede özgün record ve allocation ID/sürümleri, açık amount ve unreversed tutarlar kullanılır. Mahsupta seçili karşı iki toplam aynı para biriminde eşittir. A başvurusu bakiyeyi değiştirmez; B onayı kaydı/bakiyeleri/audit/outbox/receipt'i atomik kesinleştirir. Canlı A/B yetkileri ayrı doğrulanır; aynı kişi iki kapsamda da yetkili olabilir. Tek normatif karar [hesaplaşma bölümündedir](contracts/02-FtkSaaS-teknik-sozlesme.md#hesaplasma).

## WF19

Üst-plan bekleme/yer teklifi. Seans ve güncel liste/state → waitlist join/leave → worker'ın yetkili FIFO teklifi → kullanıcının offer accept/reject komutu → rezervasyon/teklif/hakları yeniden oku. Listeye girmek veya teklif almak hak tüketimi/kesin rezervasyon değildir. Kabulde canlı kapasite, hak, belge ve politika tekrar denetlenir. Ret/expiry eski sırayı kapatır; yeni başvuru FIFO sonudur. Seans toplam/kategori boşluğu, süresi dolmamış teklifler ve aktif kayıtlarla birlikte backend'de hesaplanır; istemci worker issue/expire çağırmaz. Starter'da bu akış kapalıdır.

FIFO yalnız uygun kategoride işler; dolu kategorinin bekleyeni diğer kategoriyi bloke etmez. Worker otomatik kontrollü kapasite aşımı kullanmaz. Keşif parmak izi oda kapasitesi ve kategori doluluğunu içerir; toplam boşluk değişmeden kategori boşluğu açılması yeniden keşif üretir.

## WF20

Frontend çağrı zinciri değildir. Ayrı bounded worker kimliği/scope → claim → gerçek iş → fenced lease/receipt/result → gerekirse sınırlı retry/failed → yetkili işletim incelemesi. P01, belge/bildirim, rapor/import, abonelik ve privacy lane'leri aynı insan rolüne indirgenmez. Kullanıcı arayüzü yalnız izinli job/işlem sonucunu okur. Retry domain commit'i çoğaltmaz; lease/scope kaybı yeni yetki sağlamaz. Partial/retry_wait imha sayılmaz; boş worker sağlık sonucu yük/restore/SLA kabulü değildir. Gerçek worker/retention/restore açıkları güncel backlog sahibindedir.

Beş lane: p01, p05, p06, p07 ve p07_privacy. Dedicated LOGIN/org binding ve gerçek `session_user` gerekir; insan rolü veya yalnız SET ROLE yeterli değildir. Beş saniyelik Cron tick bir organizasyon/claim işler; 60 saniye lease, beş saniye retry ve üç art arda hata sınırı vardır. Privacy partial ilerleme hata bütçesiyle imha tamamlandıya çevrilmez. `ops_run` claim commit'i nedeniyle tek başına autocommit CALL ile çalışır; transaction bloğuna sarılmaz. Health iki dakikalık stale sınırını izler. Cron'un yedi günlük bounded log temizliği yasal veri saklama/imha kuralının yerine geçmez. Kurulum ve kesinti/restore talimatları [backend işletim rehberindedir](../apps/backend/docs/remote-backend-setup.md).
