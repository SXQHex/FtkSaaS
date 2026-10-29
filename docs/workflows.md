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

**Sıra:** Giriş/kayıt/kurtarma/Google/TOTP için native sağlayıcı akışı → native oturum/MFA doğrulama → `account_get_v1` → gereken profil veya güvenlik okuması → ilgili hesap komutu → dönen güncel oturum ve hesap verisini yeniden oku. Profil yazma sürümü için account_get'ten olmayan bir sürüm türetilmez. Oturumlar `account_sessions_list_v1`, güvenlik geçmişi `account_security_history_get_v1` ile okunur; label/revoke açık hedef kimliği kullanır. Native parola/Google işlemi ile Edge hesap politikası aynı endpoint sayılmaz.

**Hata/kurtarma:** Doğrulama bekleyen e-posta giriş yapılmış sayılmaz; provider callback/reauth/MFA başarısızsa özel sahte completion yoktur. Oturum iptali sonrası eski tokenla başarı varsayılmaz. Şifre/reauth kanıtı loglanmaz. **Sonuç/yenileme:** Hesap, güvenlik geçmişi ve etkilenen oturum listesi yenilenir; hesap işlemi kendiliğinden organizasyon, kişi, rol veya satış üretmez.

## WF02

**Amaç/aktör:** Yetkili kullanıcı stüdyo ve işlem yetkisini kurar. Owner/OM ile CM kapsamı ayrıdır.

**Sıra:** `organizations_list_v1` → `organization_get_v1`/`centers_list_v1` → gerekliyse organizasyon ve merkez oluştur → `disciplines_list_v1` ve disiplin tanımı/merkez ilişkisi → oda tanımı → kişi ve eğitmen yetkisi (WF04) → canlı rol okumaları/izinli atamalar. Güncel Starter sınırları backend tarafından uygulanır: bir aktif merkez/oda/disiplin/eğitmen ve100 aktif öğrenci. Süreçte ikinci aktif kaynak oluşturma istemci gizlemesiyle değil backend reddiyle sonuçlanır.

**Hata/kurtarma:** Bootstrap/kapalı kuruluş ile aktif çalışma aynı kabul edilmez; izin yoksa kaynak kimliği uydurulmaz. Limit ve sürüm reddi güncel okumayla çözülür. **Sonuç/yenileme:** Organizasyon/merkez/disiplin/rol listeleri güncellenir; operasyon yetkisi yeniden değerlendirilir. Eksik oda/sınıf katalog okuması sahte endpoint ile doldurulmaz; backend bağımlılığı olarak bildirilir.

## WF03

**Amaç/aktör:** Yetkili merkez operatörü sınıf, sonlu program ve seansları yönetir; öğrenci/eğitmen yetkili görünümü okur.

**Sıra:** `calendar_get_v1` (merkezin IANA zaman dilimi ve filtreleri) → `session_get_v1` → yönetilecek sınıf/kaynaklar için mevcut yetkili okumalar → `class_save_v1` → `program_preview_v1` → somut UTC oluşumlar/engeller → `program_apply_v1` → takvim ve seansları yeniden oku. Tekil seans `session_create_v1`; seans değişikliği `session_change_preview_v1` → `session_change_apply_v1`. Scope `single` veya aynı programdaki uygun `this_and_future` oluşumlarıdır. İptal `session_cancel_preview_v1` → `session_cancel_apply_v1`; yerine seans ayrıca `replacement_session_create_v1` ile oluşturulur.

**Hata/kurtarma:** DST boş saat reddedilir, çift saatte açık offset seçimi gerekir; seri içindeki sonraki çift saatler de açık seçim ister. Kaynak/oda/eğitmen çakışması, politika, sürüm ve rezervasyon engelleri kullanıcıya gösterilir; preview engelliyse apply yapılmaz. Eksik selector veya katalog okuması contract-only/unsupported ise geliştirme bağımlılığıdır. **Sonuç/yan etki:** Kapasite azaltmak mevcut kesin rezervasyonu iptal etmez; saat/kaynak değişikliği mevcut hakları yeniden denetler. Takvim zamanı gerçekleşme/yoklama değildir. Starter tek mantıksal oda kullanır; anlaşmasız çalışır, hakediş üretmez. Başarıda calendar/session/reservation okumaları yenilenir.

## WF04

**Amaç/aktör:** Yetkili merkez kullanıcısı kişi ve öğrencilik ilişkisini yönetir; hesap bağlantısını ayrıca kurar.

**Sıra:** `people_list_v1` (filtre/cursor) → `person_get_v1` → oluşturma/düzeltme → `student_activate_v1` veya gerekçeli `student_deactivate_v1` → kişi/listeleri yeniden oku. Disiplin ilişkisi `person_discipline_set_v1` ile ayrıca yönetilir. Hesap daveti `account_access_send_v1` → doğrulanmış hesabın `account_access_accept_v1`; revoke/link remove bağımsız yetkili işlemdir. Birleştirme ayrı preview/approval/apply zinciridir, aynı iletişimden otomatik çıkarılmaz.

**Hata/kurtarma:** İletişim doğrulaması hesap bağı değildir.101. aktif öğrenci/çözümlenmemiş iş/yanlış merkez reddi otomatik pasifleştirme veya veri silmeyle aşılmaz. **Sonuç/yan etki:** Kişi yaratmak kendiliğinden native hesap, satış veya tahsilat yaratmaz; liste/detay ve etkilenen roller güncellenir. Timeout WF00'a göre takip edilir.

## WF05

**Amaç/aktör:** Satış yetkilisi öğrenciye uygun ürün sürümünü satar; hak yaşam döngüsünü yönetir.

**Sıra:** Kişi/öğrencilik (WF04) → `products_list_v1` → `entitlements_get_v1` ve gerekiyorsa `finance_get_v1` → `sale_preview_v1` → kapsam/tarih/hak/borç/varsa rezervasyon etkisini göster → `sale_apply_v1` → hak, satış ve finans okumalarını yenile. Ürün yayımlama `product_publish_v1` ile sürümlüdür. Starter ürününün seçili merkez/disiplin sınırı ve disiplinle başlayan adı korunur. Kredili/kotalı süreli/sınırsız ürün ile satın alınmış satış/hak aynı nesne değildir.

**Hata/kurtarma:** Tarih, kota, kapsam ve politika istemcide varsayılmaz; uygun ürün bulunamaması başka satış kimliği uydurma izni vermez. Preview bağımlılığı değişirse yenilenir. Kredi/uzatma ve rezervasyon etkisi `reservation_impact_preview_v1` üzerinden onaylanır; ilgili komut veya impact apply alternatif tüketim yollarıdır, ikisi art arda uygulanmaz. Freeze, termination, change, renewal ve refund kendi preview/apply çiftini kullanır; Starter'da her yaşam döngüsü seçeneğinin izinli olduğu varsayılmaz.

**Sonuç/yan etki:** Satışın hak ve borç etkisi backend sonucundan gelir; tahsilat ayrıca WF08'dir. Satış iadesi otomatik nakit çıkışı değildir. Geçmiş katılım/hakediş sonradan ödeme ile yaratılmaz. Kullanılabilir ve ayrılmış hak ayrı gösterilir.

## WF06

**Amaç/aktör:** Yetkili yönetici veya bağlı öğrenci uygun seansa rezervasyon yapar; özel ders talebini yönetir.

**Sıra:** Takvim/seans → ilgili kişinin `entitlements_get_v1` ve `reservation_list_v1` → açık uygun satış-hak seçimi → `reservation_create_v1` → seans/rezervasyon/hakları yeniden oku. İptal `reservation_cancel_v1` ve güncel politika ile yapılır. Özel ders: `lesson_request_create_v1` → yetkili ret/alternatif/approval; talep sahibi withdraw veya alternative accept yapar. Yönetim sürümü yalnız desteklenen selector'dan alınır.

**Hata/kurtarma:** Kapasite, borç/kredi limiti, belge, uygunluk ve politika reddi kullanıcıya taşınır. İstemci sıradaki satışı otomatik seçerek red gerekçesini değiştirmez. **Sonuç/yan etki:** Rezervasyon hak ayırabilir; dersin gerçekleştiğini veya hakkın tüketildiğini göstermez. Yeni üst politika mevcut kesin rezervasyonu otomatik iptal etmez; gerekçeli yetkili çözüm gerekir. Starter'da bekleme listesi/yer teklifi WF19 çağrılmaz.

## WF07

**Amaç/aktör:** Yetkili operatör gerçek katılımı kaydeder ve yoklamayı kapatır.

**Sıra:** `session_get_v1`, `attendance_get_v1`, gerekiyorsa `reservation_list_v1` → fiilî başlangıç için `attendance_start_v1` → taslak `attendance_mark_v1` → kullanıcı kapanışı onaylar → `attendance_close_v1` → seans/yoklama/haklar yeniden okunur. Kapanmış sonuç `attendance_correct_preview_v1` → gerekçeli `attendance_correct_apply_v1` ile düzeltilir; sessizce taslak gibi yazılmaz.

**Hata/kurtarma:** Çakışan sürüm yeniden okunur. Mevcut rezervasyon koruması yeni kayıt veya negatif limit bypass'ı değildir; eksik krediyle katılımı geçmişe dönük ödeme yoluyla hakedişe dönüştürme yoktur. **Sonuç/yan etki:** Kapanış ve düzeltmede hak hareketi backend'de atomiktir. Starter anlaşmasız kapanır, ücret anlaşması/hakediş üretmez. Saatin geçmiş olması yoklama kapanışı sayılmaz.

## WF08

**Amaç/aktör:** Finans yetkilisi borç, ödeme ve öğrenci alacağını yönetir; öğrenci yalnız izinli öz görünümü okur.

**Sıra:** `finance_get_v1` (kişi/merkez/para birimi) → açık borç/tutar/yöntemle `collection_record_v1` → finansı yenile. Düzeltme `collection_correct_preview_v1` → etki onayı → `collection_correct_apply_v1`. İzinli nakit alacak iadesi `student_credit_refund_v1`, mahsup `student_credit_offset_v1`, gerekçeli borç düzeltmesi `debt_adjust_v1` ile ayrı niyetlerdir.

**Hata/kurtarma:** Para birimleri birleştirilmez; tutar string/minor-unit sözleşmesi kullanılır. Düzeltmedeki yönlü fark yeni toplam sayılmaz. Kullanılmış alacak silinemez; başarısız iş otomatik yeni anahtarla denenmez. **Sonuç/yan etki:** Borç, brüt/net tahsilat ve öğrenci alacağı ayrı gösterilir; satış, borç indirimi ve nakit çıkışı eşitlenmez. Düzeltme bağlı hareket üretir, eski finans geçmişini silmez. Başarıda bakiye ve ilgili geçmiş/satış/hak okunur.

## WF09

**Amaç/aktör:** Yetkili yayın yöneticisi dersleri duyurur; anonim başvuru sahibi gerçek public transport'u, hesap sahibi kendi takvim bağlantısını kullanır.

**Sıra:** `publication_set_v1` → `public_calendar_get_v1` → gerçek widget/hostname/action/gateway ile `public_application_submit_v1` → yetkili `public_application_review_v1`. Public bağlam native kullanıcı JWT'si taklit edilerek oluşturulmaz. Kişisel takvimde `calendar_links_get_v1` → `calendar_link_create_v1` → dönen URL'yi güvenli göster; rotate/revoke ayrı komutlardır. Feed, GET/HEAD adapter'ı üzerinden `calendar_feed_get_v1` tüketir; kullanıcı oturumu gerektiren yönetim API'siyle aynı transport değildir.

**Hata/kurtarma:** Bot/action/replay/hostname ve canlı yetki kontrolleri gerçek sağlayıcıda doğrulanır. Yeni URL receipt'ten geri kazanılabilir varsayılmaz; credential kaybı ve rotate davranışı alan devrinden uygulanır. **Sonuç/yan etki:** Başvuru genel CRM kampanyası değildir. Feed yalnız canlı izinli görünümü sunar; revoke/rotate/erişim kaybında eski URL geçersizliği ve ICS→yetkili gerçek seans route'u hosted kabulünde ayrıca denenir. Mock/sentetik route bu kabul değildir.

## WF10

**Amaç/aktör:** Yetkili rapor/import operatörü veriyi okur veya kontrollü toplu aktarır.

**Sıra:** Rapor filtreleri → `report_get_v1`; dosya gerekiyorsa `report_export_start_v1` → `job_status_get_v1` → hazırsa `report_file_get_v1`. Import: `import_upload_prepare_v1` → izinli upload → `file_upload_complete_v1` → `import_preview_v1` → `import_rows_list_v1` ile satır hataları → kullanıcı onayı → `import_apply_v1` → job ve satır sonuçları → ilgili domain okumaları. Upload descriptor gerçek backend'in desteklediği transport ile kullanılır; Storage varsayılmaz.

**Hata/kurtarma:** Import önizlemesi kişi/satış/borç yazımı değildir. Kalıcı namespace/source_key tekilliği korunur; farklı payload aynı kimlikle sessiz yeniden yazılmaz. Başarısız satır ile başarılı satır ayırt edilir, dosya körlemesine tekrar yüklenmez. **Sonuç/yan etki:** Asenkron apply kabulü işin tamamlandığı anlamına gelmez. Export yalnız güncel yetkili istek sahibi tarafından okunur; süresi dolmuş veya erişimi kaldırılmış dosya indirilemez. Starter rapor/import tipleri plan sözleşmesiyle sınırlıdır; genel üst-plan raporları açılmaz.

## WF11

**Amaç/aktör:** Yetkili belge yöneticisi sürüm yayımlar; ilgili kişi gereksinimi görür ve açık kabul verir. Kullanıcı kendi işlemsel inbox'ını okur.

**Sıra:** `document_upload_prepare_v1` → upload/complete → `document_publication_preview_v1` ile mevcut rezervasyon etkisi → izinli `document_version_publish_v1` → `document_requirements_get_v1` → gerçek sürüm için `document_accept_v1`. Inbox: `notifications_list_v1` → `notification_mark_read_v1` → güncel liste.

**Hata/kurtarma:** Belge yok/eksik kabul sonucu istemcide atlanmaz; yeni şart mevcut kesin rezervasyonun korunumu ile birlikte değerlendirilir. **Sonuç/yan etki:** Okuma ve hukuki kabul aynı şey değildir. Sürüm yayımı otomatik toplu onay üretmez. İşlemsel inbox dış e-posta/SMS/reminder yetkisi vermez; Starter F27 kapalı kalır.

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

## WF15

Starter dışında bağımsız etkinlik akışı. Liste/detay → save/publish → `event_registration_preview_v1` → gerekiyorsa `event_payment_prepare_v1` ve `event_payment_get_v1` → `event_register_v1` → kayıt/finans/hakları yeniden oku. Ödeme hazırlığı kesin kayıt veya kontenjan garantisi değildir; son kontenjan yarışı backend'de çözülür. Negatif kredi yasaktır. Fiilî başlangıç, etkinlik yoklaması/kapanış/düzeltmesi ayrı komutlardır. Öğrenci iptali ile merkez iptali aynı finans sonucu değildir: merkez iptal preview/apply tam hak iadesi ve ödenmiş tutarın öğrenci alacağına dönüşmesini sağlar; otomatik nakit çıkışı yapmaz. Başlamış/kısmen gerçekleşmiş etkinlikte öğrenci iptali parasal iade üretmez; planlı saati geçmiş iptali sonradan girilen fiilî başlangıçla geriye dönük erken iptal sayma. Ayrıntılı Q-E01/Q-E02/Q-E03 kararları normatiftir.

## WF16

Starter dışında genel CRM/segment/otomasyon. Lead list/save → faaliyet/takip → izinli trial teklif/kayıt → gerekliyse `lead_convert_v1` → kişi ve CRM durumunu yeniden oku. Public başvuru alımı WF09'dan bağımsız bir genel CRM yetkisi değildir. Segment/automation save worker'ın frontend'den çalıştırılmasını gerektirmez; teslimat ve domain commit farklıdır. Kaynak/onay/hesap bağı ve plan kapıları korunur; doğrulanmamış kişiden otomatik hesap veya satış türetilmez. Rapor/import ile CRM izinleri ayrı değerlendirilir.

## WF17

Kısıtlı yaşam döngüsü ve platform yönetimi. İlgili hesap/organizasyon ve güncel bağımlılıklar → close/delete preview → kullanıcı açık onayı → aynı niyet apply → izinli durum yeniden okunur. Reopen ayrı yetkili işlemdir; kapatmanın silme olduğu varsayılmaz. Platform owner atama/çıkarma, SaaS ödeme doğrulama ve grace yetkileri normal organizasyon yöneticisi menüsüne taşınmaz. Privacy isteğinin alınması fiziksel imha kabulü değildir; retention/legal hold/Auth/Storage/backup non-resurrection ve restore kanıtı ayrı işletim sorumluluğudur. Eski token/hesap/tenant ile replay yetkiyi geri kazandırmaz.

## WF18

Business merkezler arası hesaplaşma. Yetkili A merkezi hareketleri/istekleri/authority okur → açık satış bedeli payı üzerinden `settlement_request_submit_v1` → B yetkilisi dondurulmuş hedefe `settlement_request_decide_v1` ile onay veya gerekçeli ret verir → istek/hareket/bakiye yeniden okunur. Withdraw ayrı komuttur. Aynı insan iki merkezde yetkili olabilir; her adımın farklı merkez yetkisi canlı doğrulanır. Süreli/sınırsız seans bedeli uydurulmaz; sadece A-B satış payı temeli kullanılır. Yetki/delegation değişikliği eski onayı veya finans geçmişini yeniden yazmaz.

## WF19

Üst-plan bekleme/yer teklifi. Seans ve güncel liste/state → waitlist join/leave → worker'ın yetkili FIFO teklifi → kullanıcının offer accept/reject komutu → rezervasyon/teklif/hakları yeniden oku. Listeye girmek veya teklif almak hak tüketimi/kesin rezervasyon değildir. Kabulde canlı kapasite, hak, belge ve politika tekrar denetlenir. Ret/expiry eski sırayı kapatır; yeni başvuru FIFO sonudur. Nominal boşluk, süresi dolmamış teklifler ve aktif kayıtlarla birlikte backend'de hesaplanır; istemci worker issue/expire çağırmaz. Starter'da bu akış kapalıdır.

## WF20

Frontend çağrı zinciri değildir. Ayrı bounded worker kimliği/scope → claim → gerçek iş → fenced lease/receipt/result → gerekirse sınırlı retry/failed → yetkili işletim incelemesi. P01, belge/bildirim, rapor/import, abonelik ve privacy lane'leri aynı insan rolüne indirgenmez. Kullanıcı arayüzü yalnız izinli job/işlem sonucunu okur. Retry domain commit'i çoğaltmaz; lease/scope kaybı yeni yetki sağlamaz. Partial/retry_wait imha sayılmaz; boş worker sağlık sonucu yük/restore/SLA kabulü değildir. Gerçek worker/retention/restore açıkları güncel backlog sahibindedir.
