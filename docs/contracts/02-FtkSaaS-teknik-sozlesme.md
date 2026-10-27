# FtkSaaS — Teknik sözleşme

Normatif davranış ve teknik aktarımın sahibidir. Güncel kaynak/envanter/CI/CD [00 devirde](00-FtkSaaS-yeni-sohbet-devir.md); alan bazlı gerçek istemci tüketimi [API devrinde](../claude-handover.md) tutulur. Tarihli aktarım bölümleri kendi kaynağına aittir, güncel kabul veya iş listesi değildir.

## Starter başlangıç ayarları ve self/public

Güncel kaynak/CI/hosted kabulü [00 devirde](00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

| Alan | API ve gerçek tüketici |
|---|---|
| FD07 başlangıcı | Yeni Starter organization_create_v1 aynı transaction’da org scope’lu sürüm1 negative_default=0, debt_booking=true, debt_participation=true üretir. Oluşum audit’i politika kimliklerini taşır; receipt replay yeni sürüm üretmez. Mevcut org/merkez/kişi/politika kayıtlarına backfill yok. |
| Miras ve yetki | policies_get_v1 ile merkezden org politikası okunur; policy_at/lesson_limits/rezervasyon/yoklama tüketir. Starter merkez override’ı açılmaz; org yöneticisinin mevcut policy_publish/impact yolları kullanılır. Genel settings patch’i bu iş politikalarının yerine geçmez. |
| Eksik yapılandırma | Merkez timezone’u açık seçilir. Oda/eğitmen uygunluğu, pencere, iptal/no-show, ürün hak/fiyat/süre/iade şartları açık domain komutlarıyla kurulur. Tanımsız değer, sahte çalışma saati veya ücretsiz hak üretilmez. Otomatik public yayın yok; publication_set_v1 açık hedef ve public_details ister. |
| Public başlangıç | Public takvim yalnız yayın allowlist’ini verir. Geçerli hizmet+imza+bot bağlamında submit yalnız intent üretir. CM review ile kişi/aday oluşturur/eşler; Starter genel CRM lead’i, satış, rezervasyon veya yönetim rolü oluşturmaz. |
| Öğrenciye geçiş | student_activate_v1, account_access_send_v1/accept_v1 ve doğrulanmış native hesap bağı; sonra ayrı sale/collection ve kendi reservation_create_v1. Yanlış hesap daveti alamaz; borç engeli yeni rezervasyonda gerçekten uygulanır. |

Frontend tasarımı/işleyişi, studiosaas dağıtımı ve DNS değişmedi. Hedef uye.fethiyetango.com; mevcut managed widget’a yalnız bu alan eklendi, eski alanlar/mode korundu. Gerçek istemcinin widget tokenı/siteverify kabulü bu backend/native bağlam testiyle kapanmış sayılmaz.

Public server adapter api/public-application.js, scripts/public-application-gateway.mjs ve mevcut signer’ı kullanır. Web Request/Response POST; exact HTTPS host/origin; Vercel’in overwrite ettiği tek x-vercel-forwarded-for IP’si; sabit Edge submit path;64KiB istek/yanıt; caller imza/auth/cookie’leri taşınmaz. Upstream yalnız kapalı accepted veya SafeError allowlist envelope’uyla döner; bozuk/taşan yanıt503, bozuk istemci JSON/UTF8 girdisi400’dür. Kodlar kanonik08 sözleşmesinden okunur; server dağıtımı bu sözleşme dosyasını da içermelidir. Bu adapter mevcut frontend’e dağıtılmadı.

Sunucu config’i: FTK_PUBLIC_APPLICATION_HOSTNAME, FTK_PUBLIC_INGRESS_SECRET (en az32bayt), FTK_PUBLIC_ANON_KEY (legacy anon JWT); isteğe bağlı FTK_PUBLIC_BACKEND_ORIGIN yalnız sunucuda HTTPS origin’dir, default mevcut geliştirme Supabase’idir. Edge’de FTK_PUBLIC_INGRESS_SECRET/FTK_PUBLIC_HASH_SECRET/FTK_TURNSTILE_SECRET gerekir. Public hostname FTK_PUBLIC_APPLICATION_HOSTNAME, yoksa legacy FTK_TURNSTILE_HOSTNAME olur. Handler erken kapısı ve siteverify aynı resolver’ı kullanır; recovery action legacy hostname’inde kalır. Sırlar istemciye/kaynağa/rapora yazılmaz.

Kabul kanıtı ve sağlayıcı sınırı yalnız [00 devirde](00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

## 26 Ekim — Starter kapsam seçimi ve kapı uygulaması

Son kullanıcı kararı: Starter’a geçişte seçilmeyen oda/disiplin/eğitmen ve öğrenci kapsamının operasyon erişimi kapanır. Geçmiş seans, kesin rezervasyon, hak/para ve denetim kaydı silinmez; üst plana dönüşte erişim açılır. Seçim ödenmiş dönem sonunda uygulanır, yürürlükten önce sürümlü istekle değiştirilebilir. Başlamış/eski rezervasyonları tamamlama istisnası verilmez. Bu revizyon önceki açık seçim/operasyon sorusunun çelişen kısmının yerine geçer. [Typed alanlar, kaynak ve doğrulama sınırı](../starter-plan-gates-handover.md). Uygulama/dağıtım kabulü00 devirde izlenir.

## 26 Ekim — satır1 kapanışı ve Turnstile kapsam düzeltmesi

Son kullanıcı kararı: Turnstile yalnız hesapsız public başvuru/giriş yollarında uygulanır; native Supabase Auth CAPTCHA etkinleştirmesi satır1 şartı değildir. Native Auth mevcut sağlayıcı davranışıyla çalışır. Kurtarma sonrası current session korunur, diğer oturumlar kapanır; ek all-session reset trigger'ı/marker/tamamlama API'si kurulmaz. Secure email change iki adres doğrulamasını ister. Hosted native secure password change/current-password zorunluluğu kapalıdır; eski uygulama challenge komutu doğrudan native endpoint'e zorunluluk getirmez. Canlı session/MFA ve tenant/rol kontrolleri backend'de sürer.

Native limitler: giriş/kayıt30/5dk/IP, token verification30/5dk/IP, refresh150/5dk/IP ve kullanıcı başına SMTP minimum60sn;900sn/IP10/adres3 eski custom recovery sayacıdır ve native garanti değildir. Yalnız sayısal eşitlik için gateway eklenmez. Gerçek SMS dış entegrasyon, public başvuru sağlayıcı/hostname kabulü ve frontend/production ayrı kalır.

## 26 Ekim — SMS dış entegrasyon kararı (son kullanıcı kabulü)

Telefon numarası kaydedilebilir; gerçek SMS proof tamamlanmadıkça doğrulanmamış kalır. Numaranın kaydedilmesi, doğrulanmış iletişim yayılımı, hesap sahipliği kanıtı veya telefonla giriş yetkisi değildir. Ücretsiz geliştirme testlerinde yalnız izole yerel test OTP kodları kullanılabilir; bunlar gerçek SMS gönderimi/teslimi veya hosted provider kabulü sayılmaz. Sabit test kodları hosted ortama uygulanmaz.

E-posta/parola, gerçek Google giriş/bağlama ve doğrulayıcı uygulama TOTP ile ilerlenir. Gerçek SMS sağlayıcısı kurulumu ayrı dış entegrasyon statüsündedir; birinci satırın diğer backend işlerini ve backend kapanışını engellemez. SMS'in gerçek sağlayıcı kabulü tamamlandı işaretlenmez. Doğrulanmamış telefon kaydetme/okuma yolu ile yerel proof/test-code davranışının uygulama kabulü backend kapsamındadır; bu karar tek başına yeni alan/API'nin uygulanmış olduğu kanıtı değildir.


## 26 Ekim 2026 — SaaS plan güvenlik ve kullanım sınırı (normatif hedef)

[Plan kapsamı kabul kararı](01-FtkSaaS-urun-kapsam-sozlesmesi.md) eski F01/F11/F16/F21–F25 plan dağılımındaki çelişen hükümleri değiştirir; Starter runtime/API uyarlaması PR56 ile kabul edildi. Pro/Business diğer limit/özel teklif işleri ayrı kalır. **Starter**: tek merkez, tek aktif oda kaynağı, tek disiplin, tek aktif eğitmen ve en fazla 100 aktif öğrenci. Bütün ders/seans/kayıtlar aynı `room_id` ve `discipline_id` ile sınırlandırılır; ikinci oda veya disiplin oluşturma/aktifleştirme; ikinci aktif eğitmen görevlendirme; 101. öğrenci aktifleştirme atomik plan kapısından reddedilir. Öğrenci aktifliğinin mevcut organizasyon tekil sayımı korunur.

Oda fiziksel kapasitesi (örn. 50) seans toplam/kategori kapasitesinden (örn. aynı mantıksal odada ayrı saatlerde 40 ve 5) ayrıdır. Tek odada eşzamanlı iki seans, gerçek işletmede farklı fiziksel mekânlar olsa bile çakışır; gerçek fiziksel salon kapasitesini işletme doğru seans limitiyle beyan eder, sistem tek başına bilemez. Mevcut fiziksel oda tavanı ve kontrollü aşım korumaları korunur.

Starter ürün/paket isminin **kayıtlı disiplin adıyla başlayan** gösterimi/saklama doğrulaması ve gerçek disiplin kimliği bağlaması zorunludur; isim tek başına disiplin yetkisi oluşturmaz. Düzenli grup programı, sınırlı özel ders, tek disiplinli kredili/süreli/sınırsız hak, F11 self rezervasyon, F25 temel public ders takvimi/başvurusu ve F14 kapanış korunur. Starter'da ikinci aktif eğitmen, ayrı etkinlik (F29), CRM/lead/otomasyon (F21–F24) ve hakediş (F20) kapalıdır. Starter'ın temel başvuru değerlendirmesi CRM veya kesin yer/satış yaratmaz. F12/F17/F22 ve gelişmiş plan işlevleri önceki izin sınırlarını korur. Pro bütün tek merkezli program/etkinlik/CRM/otomasyon/hakediş işlevlerini açar. Business beş merkez ve A→B hesaplaşmayı açar; 5 üstü ayrı sözleşmeli özel limit, genel bypass değildir.

Önceki **plan düşürmede veri korunur** hükmü geçerlidir; mevcut rezervasyon/hak/satış geçmişi otomatik silinmez. Üst plan kayıtlarının tek merkez/oda/disiplin/eğitmen/üye kapsamına geçişi `expected_version`, `kept_center_id` ve `kept_scope` ile açıkça seçilir; abonelik dönem sınırında atomik uygulanır. Typed alanlar ve korunmuş geçmiş davranışı PR56 ile kabul edilmiştir. Starter kararının makine sözleşmesi, `PlanLimit`, DTO/validator, Edge/RPC, etkili limit/özellik kataloğu, paket guardları, F01–F33 plan izi ve gerçek test eşlemesi PR56 tesliminde birlikte güncellendi. Pro/Business diğer sayısal limit/özel teklif aktarımı ayrı kalır. Yeni enum/limit anahtarı veya izin adı bu belgeyle icat edilmez.


<a id="oda-seans-kapasite-karari"></a>

## 25 Ekim — güncel oda/seans kapasitesi kararı ve kaynak sınırı

Oda fiziksel kapasitesi ve seans kayıt kapasitesi ayrı girilir. Seanslarda nominal/maksimum ayrımı kaldırılmıştır. Tek toplam ve varsa erkek/kadın kategori kontenjanları normal kayıtta birlikte denetlenir; öncelikli/esnek kayıt farklı tavan veya aşım yetkisi vermez. Kesin kayıt + süresi dolmamış bekleme/deneme teklifleri ortak yer tutar. Seans toplamı fiziksel oda kapasitesini geçemez.

Canlı yetkili görevli eğitmen, açık merkez izni olan personel veya canlı merkez yöneticisi yalnız ayrı ve gerekçeli tek kayıt işlemiyle toplam/kategori kontenjanını kontrollü aşabilir. Fiziksel oda sınırı, hak/borç/belge/zaman/plan/tenant/merkez ve tekrar kapıları aşılmaz. Aktör, gerekçe, aşılan sınır ve miktar audit'e yazılır. Tek kayıt aşımı kalıcı seans kapasitesini artırmaz; kalıcı değişiklik ayrı sürümlü komuttur. Kategori kişi profilinden tahmin edilmez, kayıt isteğinde açık seçilir.

Kapasite küçültme mevcut kesin kayıtları sessiz iptal etmez. Oda küçültmesi açık seans veya fiilî yer tutmayı fiziksel sınırın dışına çıkaramaz. Eski odanın gerçek fiziksel kapasitesi disiplin değerlerinden tahmin edilmez; eksikse yeni oda bağlı işlemler için açık yapılandırma gerekir. Seans revizyonu etkinlik kapasite DTO'sunu veya sınırsız etkinlik geliştirmesini değiştirmez.

[Kapasite kararı ve istemci DTO geçişi](../decisions/DS-2026-10-25-session-capacity.md) normatif kaynaktır; uygulama/CI/hosted kabulü 00 devirden okunur.

## 25 Ekim — giriş yöntemlerinde son kullanıcı kararı

FD03'teki Google'ı erteleme hükmü son karar sohbetiyle değişmiştir: **e-posta + parola ana kayıt/giriş; Google ek kayıt ve giriş yöntemidir. Apple kapsam dışıdır. Instagram ile kayıt/giriş, hesap bağlama ve bunlara yönelik Graph/Basic Display entegrasyonu kapsam dışıdır; önceki IG akışı iptal edilmiştir.** Passkey ertelidir. İlk MFA doğrulayıcı uygulama kodu olarak kalır. Provider seçimi gerçek entegrasyonun kurulduğu veya test edildiği anlamına gelmez.

Bu son karar kişisel Instagram login bağlamındadır; reklam/lead/P08 iptali ayrıca söylenmemiştir. Bu nedenle önceki ortak CRM kaynak modelindeki Instagram reklam başvuruları sessizce silinmez; kaynak alımı ayrı P08 entegrasyon/kabul işidir. Reklam kaynağı bulunması Instagram hesabıyla oturum açma veya hesap bağlama yeteneği vermez.


> **Güncel öncelik: Q-E02 · 0.2.0-rc.3.** Kullanıcının 16 Ekim 2026 son iptal kabulü önceki çelişen merkez iptali hükümlerinin yerine geçer. Güncel davranış/kanıt: docs/decisions/Q-E02.md, docs/claude-handover.md ve reports/qe02-verification.json. Aşağıdaki eski durum/test sayıları tarihsel kayıttır; teknik aktarım bekleyen işler tamamlandı sayılmaz.

> **Q-D01 durumu:** Etkinlik disiplin/kapsam matrisi ve negatif kredi yasağı kabul edilmiş ve runtime’a aktarılmıştır. İlk teknik aktarım raporları tarihsel kanıttır; güncel kaynak/kabul [tek devirde](00-FtkSaaS-yeni-sohbet-devir.md) ve işlem envanterindedir.

> **İlk aktarımın tarihsel sınırı:** 2.2-tech.1 döneminin iki migration ve kurulum bekleme notları bugünkü uygulama açığı değildir. D01–D09/U01–U08 aktarımı mevcuttur; bütün ürünün kabulü, hosted ve production durumu bundan çıkarılmaz.

> Güncel UUID üretim standardı: U01–U08, UUIDv7. Sağlayıcı kimlikleri korunur.

> Güncel ek: D01–D09 disiplin revizyonu kabul edilmiştir; aşağıdaki tarihsel teknik tamamlanma ifadeleri yeni kapsamı içermez. Kabul hükümleri belgenin sonundadır; güncel kalan uygulama listesi docs/remaining-work.md üzerinden okunur.

Tarih: 17 Ekim 2026 · Sürüm: DS-2026-10-17 aktarımı · Durum: İş kararları ve O4 yazılı teknik sözleşmesi tamamlandı; uygulama/üretim ve hukuki doğrulama açık

## 1. Bağlayıcılık, kaynak ve sınır

Ürün kapsamının kaynağı 01-FtkSaaS-urun-kapsam-sozlesmesi.md; çalışma sorumluluklarının kaynağı 03-FtkSaaS-kodlama-sorumluluklari.md dosyasıdır. Bu sürüm, 15 Ekim 2026 görüşmesindeki açık kabulleri ve son kullanıcı düzeltmelerini birleştirir. Konuşmada terk edilmiş seçenekler yürürlükte değildir.

FtkSaaS bağımsız yeni projedir. Eski studioSaaS kodu, tabloları, frontendleri, iş kuralları, garantileri ve geliştirme modeli kaynak alınmaz. Eski sistem incelemesi, karşılaştırması, migration veya yama çalışması yapılmaz.

14 modül/33 özellik ve Starter/Pro/Business dağılımı, ürün sözleşmesindeki açık revizyonlarla korunur. Modüller ayrı servis zorunluluğu değildir. Kabul edilen sözleşme, özelliğin uygulanmış veya test edilmiş olduğu anlamına gelmez. Fiziksel şema, tam API kataloğu ve kodlama/dağıtım izni bu belgeyle kendiliğinden oluşmaz.

## 2. Kabul edilmiş teknik kararlar: T01–T12

| ID | Kabul edilen hüküm |
|---|---|
| T01 | Supabase üzerinde tek modüler backend. Başlangıçta Supabase Free hedeflenir; Auth, PostgreSQL ve ihtiyaç oldukça Storage/Edge Functions kullanılır. Ayrı mikroservis veya bağımsız uygulama sunucusu zorunlu değildir. |
| T02 | Mimari baştan multi-frontend: web/PWA, Android, iOS, macOS ve Windows aynı sürümlü veri/işlem sözleşmelerini kullanır. Mobil öncelikli web/PWA yalnızca ilk istemcidir; sonraki istemciler için iş modeli yeniden kurulmaz. |
| T03 | Okumalar tanımlı, yetkilendirilmiş API yüzeylerinden yapılır. Supabase Data API üzerinden doğrudan okuma mümkündür; fiziksel tabloların tamamı API sayılmaz. Açık şema, görünüm/fonksiyon erişimi, alan görünürlüğü, grants ve RLS tasarlanır. |
| T04 | İş verisi yazmaları adlandırılmış ortak backend operasyonlarından, ağırlıkla PostgreSQL RPC üzerinden geçer. Edge Functions dış servis, gizli anahtar ve gerekli sunucu işleri içindir; her RPC önüne zorunlu Edge Function konulmaz. Auth ve dosya yükleme kendi güvenli API'lerini kullanır. Kurallar frontend veya web sunucusuna bağlanmaz; SQL ve Edge içinde aynı iş kuralı çoğaltılmaz. |
| T05 | Organizasyona ait kişi kaydı ile organizasyonlar arasında kullanılabilen ortak oturum hesabı ayrıdır. Aynı kişi farklı organizasyonlarda farklı kişi ID'leri alır. Aynı organizasyonda aday/öğrenci/eğitmen/personel ilişkileri için kişi çoğaltılmaz. |
| T06 | Kesin rezervasyonda hak ayrılır; tüketim değildir. Katılımın taslak yoklaması hakkı ayrılmış tutar. Yoklama kapatıldığında katıldı/noShow ve geçerli politikaya göre tüketim veya serbest bırakma kesinleşir. Rezervasyon iptalinde kendi politikası uygulanır. |
| T07 | Rezervasyon, gerekli kontenjan/kaynak kontrolü ve hak ayırma tek atomik işlemde tamamlanır. Eşzamanlı istekler normal toplam/kategori kontenjanını, fiziksel oda kapasitesini veya kredi açığı sınırını aşamaz. Yöneticinin birden fazla operasyon adımından oluşan bütün iş akışı tek işlem olmak zorunda değildir. |
| T08 | Kritik işlemlerde aynı işlem anahtarı + aynı içerik aynı sonucu döndürür; aynı anahtar + farklı içerik reddedilir. Farklı anahtarlarla yinelenen aynı rezervasyon da iş kurallarıyla engellenir. Anahtar kapsamı ve saklama davranışı bölüm 21’de kabul edilmiştir. |
| T09 | Kesinleşmiş para/kredi ve bunlara bağlı hakediş düzeltmeleri önceki kayda bağlantılı hareketlerle yapılır; geçmiş silinmez. Basit profil alanı değişikliği için gereksiz hareket sistemi kurulmaz. |
| T10 | Gerekli bildirim işi iş işlemiyle birlikte kalıcı kaydedilir; gönderim ayrı yürür. Teslimat hatası başarılı işi geri almaz, yeniden deneme izlenir. |
| T11 | Operasyonların tam tipli istek/yanıtları, sabit hata kodları ve sürüm uyumu tanımlanır. Frontend yerelleştirilmiş hata metnini ayrıştırmaz. Eski istemciyi bozan değişiklik sessizce yapılmaz. |
| T12 | Hak kapsamı/geçerliliği dersin gerçekleşeceği tarih/saat için değerlendirilir. Tarih değişiminde uygunluk tekrar kontrol edilir; mevcut rezervasyon otomatik iptal edilmez. İşletme iptali nedeniyle kullanılamayan hak yöneticiye gösterilir; yetkili yönetici süre uzatabilir, sistem kendiliğinden uzatmaz. |

Free plan limitlerinin güncel rakamları değişebilir; kalıcı iş kuralı olarak sabitlenmez. Ücretli altyapıya geçiş mimariyi değiştirmez. FtkSaaS'ın Starter/Pro/Business planları ile Supabase altyapı planı farklı kavramlardır. Tek yeni repository ve dosya sahipliği 03 sözleşmesinde kabul edilmiştir. Repository kaynağı SXQHex/FtkSaaS main’dir. Frontend framework/hosting durumu backend kurulumu veya bu sözleşme güncellemesinden türetilmez; istemci kapsamı ayrıdır.

## 3. Kimlik, davet ve erişim yaşam döngüsü

- Kişi kaydı organizasyona aittir ve birden fazla merkezle ilişkilenebilir. Ortak hesap, her organizasyondaki ayrı kişi kaydına doğrulanmış bağlantıyla erişir. Organizasyonlar birbirinin verisini göremez.
- Hesabı olmayan kişi merkez tarafından kaydedilebilir; paket, ödeme ve rezervasyonları hesap açmasını beklemez.
- Yetkili merkez, belirli kişi kaydına ve hedef e-postaya bağlı, süreli/tek kullanımlık davet başlatır. Yeni kullanıcı için davet bekleyen hesap oluşturulur; kullanıcı geçerli e-posta bağlantısıyla şifresini belirler, hesabını etkinleştirir ve kişi kaydına bağlanır. E-postanın gönderilmiş olması tek başına doğrulama değildir.
- Mevcut hesapta ikinci hesap veya yeniden şifre oluşturulmaz; giriş yapılıp organizasyon bağlantısı kabul edilir. Davet hedefi doğrulanmış hesap adresiyle eşleşmelidir. Aynı e-posta/telefon kendi başına eşleştirme veya erişim hakkı vermez.
- Ortak uygulamada backend erişilebilen organizasyonları döndürür. Tek organizasyonda seçimin atlanması kabul edilmiş istemci davranışıdır; birden fazlasında organizasyon değiştirilebilir. Sıfır organizasyonlu hesap yönetimi ve davet kabulü bölüm 21’de tanımlıdır. Frontend tasarımı ChatGPT'nin alanı değildir.
- Merkez görevi kaldırıldığında yalnızca ilgili yetkiler kalkar. Hesap–kişi bağlantısı kaldırıldığında o organizasyon kaydına erişim biter; diğer organizasyonlar, roller ve geçmiş silinmez. Yanlış bağlantı kaldırılıp doğru hesaba yeni davet verilebilir.
- Backend her işlemde güncel rol/bağlantı durumunu kontrol eder. Açık oturum veya eski bağlantı kaldırılmış yetkiyi sürdürmez. Değişiklikler yapan kişi ve zamanla kaydedilir.

### Mükerrer kişi birleştirme

Aynı organizasyondaki mükerrer kayıtlar otomatik değil, yetkili yönetici işlemiyle birleştirilir. Hesap bağlantıları, rezervasyonlar, kullanım hakları ve finans kayıtları önceden kontrol edilir; geçmiş ve merkez aidiyeti korunur. Organizasyonlar arası birleştirme yoktur.

İşlemi yapan kişi bütün etkilenen merkezlerde yöneticiyse tamamlayabilir. Yönetici olmadığı her etkilenen merkezden bir yetkili merkez yöneticisinin aynı kapsama onayı gerekir. Kapsam değişirse onay yenilenir. Gerekli onaylar tamamlanmadan kayıtlar değişmez; başlatan ve onaylayan kişiler izlenir. Hesap çatışması ACCOUNT_LINK_CONFLICT, ilgili sürüm değişimi VERSION_CONFLICT/PREVIEW_STALE;05/06/08 sözleşmesi uygulanır.

## 4. Rol ve kapsam matrisi

Tek aktif owner bulunur; atama/kaldırma yalnız FtkSaaS platform yetkisidir. Diğer roller birden fazla kişiye atanabilir; bir kişi farklı kapsamlarla birden fazla rol taşıyabilir. Yetki, rol + kapsam + işlem iznidir; genel bir üst rol operasyon kapsamını otomatik aşmaz.

| Rol | Kabul edilmiş yetkiler ve sınırlar |
|---|---|
| Owner | Uygulama nezdinde nihai yetkili/ana muhatap; organizasyon kapatma, SaaS aboneliği, organizasyon yöneticisi atama/kaldırma. Organizasyon kuralları ile tüm merkezlerde görüntüleme/raporlama yetkisi var. Merkez operasyonu için ayrıca ilgili merkezde yönetici atanmalıdır. Owner rolünü verme/kaldırma yalnız FtkSaaS’a aittir; müşteri doğrudan owner devredemez. Owner merkez oluşturup kendisini/başkasını merkez yöneticisi atayabilir, kendi merkez yöneticiliğini owner yetkisiyle kaldırabilir. Canlı organizasyon ownersız bırakılamaz. |
| Organizasyon yöneticisi | Organizasyon kurallarını ve zorunlu/tavsiye sınırlarını yönetir; bütün merkezlerin verilerini görür, raporlar. Yönetici atanmadığı merkezde operasyonel değişiklik yapamaz. Kendisini merkeze yetkili atayabilir; atama/kaldırma izlenir. Başka organizasyon yöneticisi atama/kaldırma owner'a aittir. |
| Merkez yöneticisi | Atandığı merkezde oda/sınıf/seans/kontenjan, görevlendirme, rezervasyon/talep/iptal, yoklama kapatma/düzeltme, katalog/fiyat, paket satışı, kredi düzeltme, süre uzatma, kişisel negatif limit, tahsilat/iade, eğitmen anlaşması/hakedişi, yerel CRM/rapor ve personel/asistan yetkilendirmesi. Organizasyonun zorunlu sınırlarını aşamaz; diğer merkezler, owner, organizasyon yöneticiliği ve SaaS üzerinde yetki doğmaz. Hassas düzeltmeler gerekçeli/izlenebilir olur; organizasyon tutar/miktar sınırları koyabilir. |
| Operasyon personeli | Merkez yöneticisi kişi kaydı, rezervasyon, açık yoklama, paket satışı ve tahsilat izinlerini ayrı ayrı verir. İade, kredi düzeltme, süre/negatif limit değişikliği, fiyat/anlaşma değiştirme veya yetki dağıtma yoktur. Günlük CRM aşağıdaki dar kapsamla ayrıca verilebilir. Yoklama kapatma yetkisi bu role verilmemiştir. |
| Eğitmen | Kendi programı, gerekli katılımcı bilgileri ve kendi hakedişlerini okur; görevlendirildiği seansların açık yoklamasını düzenler ve kapatabilir. Seans iptali/saat değişikliği, rezervasyon, finans ve kredi düzeltmesi yapmaz; merkeze değişiklik talebi iletir. |
| Eğitmen asistanı | Sınıf veya seans bazlı atama; ilgili katılımcıların gerekli bilgilerini görür, açık yoklamada katıldı/gelmedi kaydeder ve düzeltir. Yoklamayı kapatamaz; kapalı yoklamayı değiştiremez. Rezervasyon, iptal, paket, finans, CRM ve hakediş yönetimi yoktur. |
| Öğrenci | Kendi rezervasyon/yoklama/paket/kredi/borç/ödeme geçmişini görür. Plan, paket, sınıf, kontenjan ve politika uygunsa kendi rezervasyon/iptal işlemini yapar. Özel ders talebi ve bekleyen talebi geri çekme mümkündür; kesin onayı merkez verir. Kendi yoklama/kredi/borç/ödeme kaydını doğrudan değiştiremez; başkalarının özel kayıtlarına erişemez. |

Asistan, öğrenci olarak katıldığı seansa atanamaz. Ters yönde de asistan ataması kaldırılmadan öğrenci kaydı yapılamaz. Sınıf düzeyindeki atama bu seans kontrolünü aşmaz. Aynı kural etkinlik katılımcısı/görevli asistan için geçerlidir.

CRM yönetimi yöneticide kalır; operasyon personeline merkez ve atanmış aday kapsamında aday oluşturma/güncelleme, kaynak/ilgi, takip/görüşme/sonuç ve önceden tanımlı sabit koşullarla deneme teklifi izinleri verilebilir. İndirim/fiyat değiştirme verilmez. Toplu dışa aktarım, segment ve otomasyon yönetimi verilmez. CRM izni satış/tahsilat izni doğurmaz; Pro/Business sınırları korunur.

Rapor ve dışa aktarım güncel veri/alan/merkez yetkilerine tabidir. Sınırlı işlem izni rapor üzerinden tam finans/kişisel veri erişimi vermez. Owner/organizasyon yöneticisi tüm merkezleri raporlar; çok merkezli özelliklerin ticari plan erişimi ayrıca uygulanır. Kayıt kapsamına etkisi olmayan organizasyon politikası yönetimi, geçmiş merkez kayıtlarını değiştirme yetkisi değildir.

## 5. Sınıf, paket, seans ve kontenjan

Sınıfın dış katılıma açık/kapalı olması ile paketin öncelikli/esnek olması ayrı boyutlardır. Aynı açık sınıf düzenli ve esnek katılımcıları birlikte barındırabilir. Kapalı sınıfa, o sınıfa erişim vermeyen paketle kredi olsa da kayıt yapılamaz.

- Öncelikli paket başlangıcından itibaren tanımlı kredileri ilgili seanslara topluca ayırır. Kalan kredi başka programa serbest kredi varsayılmaz; ayrılmış ve kullanılabilir ayrıdır.
- Esnek paket, uygun seansa tek tek kesin kayıtla hak ayırır.
- Satış/kesin kayıtta kapsanan seans doluysa işlem sessizce eksik rezervasyonla tamamlanmaz. Öncelikli biçim kapasite aşımı sağlamaz.
- Oda fiziksel kapasitesi ile tek seans toplamı ayrı girilir. İsteğe bağlı erkek/kadın limitleri bağımsız kayıt sınırlarıdır; toplam sınır da birlikte uygulanır. Nominal/maksimum ayrımı kaldırılmıştır.

| İşlem | Kabul sınırı |
|---|---|
| Normal esnek/öncelikli kayıt, bekleme/deneme teklifi | Toplam ve ilgili kategori kontenjanında boşluk ve fiziksel odada yer |
| Açık yetkili tek kayıt aşımı | Gerekçeli ayrı komut; toplam/kategori aşılabilir, fiziksel oda sınırı aşılamaz |
| Kalıcı kapasite/kategori değişimi | Ayrı yönetici komutu, sürüm ve gerekçe; fiziksel oda sınırı korunur |

Kesin kayıtlar ve süresi dolmamış bekleme/deneme teklifleri ortak yer tutar. Kontrollü aşımın hesap/kişi, gerekçe, kontenjan ve aşım miktarı audit'e kaydedilir; hak, borç, belge, zaman, plan, tenant ve merkez kapıları korunur. Mevcut kesin kayıtlar kapasite düşüşünde otomatik iptal edilmez; odanın fiziksel sınırı altına düşüş mevcut açık seans/kayıtlar çözülmeden tamamlanmaz. [25 Ekim kapasite kararı](#oda-seans-kapasite-karari) eski çelişen kapasite hükümlerinin yerini alır. Ürün kabulü, bu branch'in uygulaması ve aday/main kabulü ayrı durumlardır.

## 6. Kullanım hakları ve paket yaşam döngüsü

### Ürünün bağımsız boyutları

1. Hak türü: kredili veya süreli/sınırsız; varsa dönemsel kullanım sınırı.
2. Rezervasyon biçimi: öncelikli veya esnek.
3. Ticari koşul: kullanım taahhüdü, iadeli/iadesiz ve iadeli ise hesap yöntemi.

Paket adındaki “4 hafta” hak türünü belirlemez. Haftada bir seans/4 kredi tanımlı kur kredili üründür; aylık süreli ürün dönemle sınırlıdır. Taahhütlü paket indirimli çok ders/dönem satın alımıdır; tek ders veya kullanım kredisiyle aynı iade koşulu varsayılmaz. Esneklik otomatik iade hakkı, öncelik otomatik iadesizlik değildir. Satış koşulları sürümlenir; sonraki katalog değişikliği geçmiş satışı yeniden fiyatlandırmaz.

### Hak seçimi ve kredi açığı

Öncelikli rezervasyon kaynak paketine bağlıdır. Esnek rezervasyonda ders tarihinde kapsam/merkez/sınıf bakımından uygun paketlerin kullanılabilir hakları arasından önce en erken süresi dolacak paket, eşitlikte önce satın alınan kullanılır. Başka rezervasyona ayrılmış hak tekrar kullanılamaz. Bitişi olmayan hak sıralamada en son; tam eşitlikte satın alınma anı ve değişmez UUID kullanılır.

Uygun kullanılabilir hak yoksa geçerli negatif kredi limiti değerlendirilir. Kişiye özel limit varsa organizasyon varsayılanının yerine geçer, toplanmaz; organizasyonun zorunlu üst sınırı korunur. Kullanılmış açık ve rezervasyonlara ayrılmış açık birlikte sayılır; farklı ders/gruplarda limit çoğaltılmaz. Negatif kredi para borcu değildir.

Yeni uygun paket önce mevcut kredi açığını kapatır. Gelecek rezervasyon açığı hak ayrılarak, sonuçlanmış hak tüketen ders açığı hak tüketilerek kapatılır. İlgisiz ürün/merkez kredisi düşülmez. Örnek: uygun 8 kredilik satın alım, 2 kredilik açığı kapattıktan sonra 6 kullanılabilir hak bırakır; ayrıca para borcu oluşturmaz. Sonuçlanmış geçmiş açığın yeni paketle kapatılması, geçmiş derse yeni rezervasyon açmak değildir; tarih/kapsam eşlemesi21 ve23 bölümleriyle04/08’de tanımlıdır.

### İptal, sonuçlandırma ve borçlu katılım

- Katılımda taslak yoklama tüketim üretmez. Kapanışta katıldı/noShow sonucuna göre politika uygulanır. Öğrenci iptalinde kimin/ne zaman iptal ettiği ve rezervasyona bağlı koşullar değerlendirilir. Özel dersin başlangıç 12 saat kuralı grup/etkinliğe kopyalanmaz.
- İşletme seansı iptal ettiğinde ilgili rezervasyon kapanır, ayrılmış kredi kullanılabilir olur. Ayrı telafi bakiyesi veya otomatik başka seans arama/öteleme yoktur. Yönetici yeni seansı/katılımcıları hazırlar. Geçerli negatif limit varsa eski iptalden önce yeni kayıt açabilir; eski hak serbest kaldığında geçici açık kapanır. Her adım kendi kurallarına tabidir.
- İşletme iptalinde kredinin geçerlilik sorunu yöneticiye gösterilir; yönetici uzatabilir. Süreli ürünün dönemi kendiliğinden uzamaz; dönem sonrasına hak üretilmez.
- Borçlu öğrencinin yeni rezervasyon ve katılımı ayrı politikadır. Para borcu ve negatif kredi ayrı kontrol edilir; yeni kayıt engeli mevcut rezervasyonu otomatik iptal etmez.
- Borç/kredi nedeniyle engel ayrı blocked sonucudur, otomatik noShow değildir; kredi etkisi açık politikaya bağlıdır. DS onayıyla korunan kesin rezervasyonlar hariç, seans başlangıcında izinli negatif kredi sınırını aşan katılım engellenir ve bu öğrenciden yüzde/kişi hakedişi doğmaz; geç ödeme geçmiş sonucu değiştirmez.

### Dondurma ve sonlandırma

Dondurma başlangıçta kapalıdır. İzin verilen plan ve ürün koşullarında yalnız merkez yöneticisi uygular; etkilenen kayıt/tarihler önceden gösterilir. Süre uzatma satış koşuluna bağlıdır. DS hedefinde finansal olmayan hak değişikliğinde kesin rezervasyonlar etki onayıyla korunur. Açık merkez rezervasyon iptali ayrıca seçilmiş/gerekçeli müdahaledir; o durumda hak/yer/açık serbest kalır. Dondurma sonrasında otomatik rezervasyon yapılmaz. Erken bitirme/değişim/yenileme davranışları bölüm 17’de kabul edilmiştir.

Para iadesi tek başına hak değiştirmez. Paket sonlandırmada kullanılmamış serbest haklar kapatılır, geçmiş ve korunan yükümlülükler korunur. Rezervasyon iptali ayrıca açık merkez müdahalesi olarak onaylanır; sonlandırma tek başına sessiz iptal değildir. Kullanılmamış hak kendiliğinden iade alacağı doğurmaz, kalan para borcu otomatik silinmez. İade/borç indirimi satış koşuluna göre ayrı ve gerekçeli yetkili işlemidir. İadeli ürünün hesabı satışta seçilir; bölüm17’deki üç yöntem kabul edilmiştir. Bunlardan biri bütün ürünlere evrensel varsayılan değildir.

## 7. Durumlar ve zaman yönetimi

| Kayıt | Kabul edilmiş durumlar |
|---|---|
| Özel ders talebi | Bekliyor; alternatif sunuldu; onaylandı; reddedildi; geri çekildi; süresi doldu |
| Kesin rezervasyon | Aktif; iptal edildi; sonuçlandı |
| Seans | Planlandı; gerçekleşti; iptal edildi |
| Yoklama | Henüz işaretlenmedi; katıldı; gelmedi; katılım engellendi |
| Yoklama kapanışı | Açık; kapalı |
| Bekleme listesi kaydı | Bekliyor; teklif verildi; rezervasyona dönüştü; ayrıldı; kapandı |
| Yer teklifi | Aktif; kabul edildi; reddedildi; süresi doldu; geri çekildi |

İş anlamları bu bölümde, kesin API kod adları06/08’dedir. İptal/katılım engel gerekçesi ayrı tutulur, yoklama yerine cancel yazılmaz.

Özel ders talebi ve bekleme listesine giriş yer/kredi tutmaz. Talep onayında uygunluk ve kaynaklar kontrol edilip kesin rezervasyon oluşur. Zamanın geçmesi seansı otomatik gerçekleştirmez veya kişiyi noShow saymaz. İptal rezervasyonu yeniden açılmaz; güncel kontrollerle eskiye bağlantılı yeni kayıt oluşturulur.

Yoklama kapanabilmesi için iptal edilmemiş bütün rezervasyonların sonucu girilmelidir. Eğitmen/merkez yöneticisi kapatır, asistan kapatamaz. Açıkken atanmış eğitmen/asistan ve izinli operasyon personeli düzenleyebilir. Kapalı düzeltmeyi yalnız merkez yöneticisi gerekçeyle yapar; bağlı kredi/hakediş düzeltmesi geçmişi silmez. İşaretlenmemiş yoklama eksik işlem olarak kalır.

### Bekleme listesi

Teklif yalnız toplam ve ilgili kategori kontenjanında boş yer varsa verilir; süre boyunca yeri tutar, hak tutmaz. Başlangıç sıra listeye giriş zamanı, eşitlikte kararlı sıra; teklif süresi FD06 gereği orgdan/izinli merkezden açıkça yapılandırılır; tanımsızsa yeni hedef akış teklif üretmez. Geçmiş 30 dakika fallback yeni ürün varsayılanı değildir; mevcut kulüp 3600 sn korunur. Etkin süre kayıt kapanışı/ders başlangıcını aşamaz. Kabul, mevcut yer tutmayı rezervasyona dönüştürür; hak, erişim, belge ve koşullar tekrar kontrol edilir. Geçici hata süreyi bitirmez; kalan sürede yeniden denenebilir.

Ret/süre dolumunda yer serbest kalır, önceki kişinin liste kaydı kapanır, sıradaki uyguna geçilir. Yeniden katılım sıranın sonundandır. Otomatik kesin kayıt yoktur. Seans iptalinde teklifler geri çekilir ve liste kayıtları kapanır. Kabul ve süre dolumu yarışında tek sonuç geçerlidir.

### Takvim ve kayıt pencereleri

Her merkezin saat dilimi vardır; tekrarlayan program merkez yerel saatiyle oluşturulur. Tek seans değişikliği kalan programı değiştirmez. “Yalnız bu seans” ve “bu seans ve sonrası” ayrı kapsamlardır; geçmiş/sonuçlanmış seanslar korunur. Erteleme aynı seansın tarih/saat değişikliğidir; geçmiş değerler izlenir.

Gelecek seanslarda kaynak ve hak uygunluğu kontrol edilir; çakışmalar çözülmeden değişiklik kesinleşmez, rezervasyonlar otomatik iptal edilmez. Esnek rezervasyon, öğrenci iptali ve özel ders talebinin açılış/kapanış ayarları ayrıdır; backend merkez saat dilimini uygular. Yönetici süre dışı işlemleri ayrıca yetkilendirilip kaydedilir. Geçersiz yerel saat sessiz kaydırılmaz; çift saat açık offset doğrulaması ister. Saat dilimi ve tarih normalizasyonu04/08 teknik sözleşmesindedir.

## 8. Finans, tahsilat, alacak ve iade

Bütün öğrenci tahsilatını merkez yapar; eğitmenin doğrudan tahsil ettiği model yoktur. Öğrenci kendi ödeme geçmişinin tamamına erişir. Öğrenci–merkez hesabı ve merkez–eğitmen hesabı ayrıdır. Fazla tahsilat kalan borcu eksi yapmaz, ayrı öğrenci alacağıdır.

- Seçilmiş borç varsa tahsilat ona uygulanır. Seçim yoksa aynı merkez/para biriminde en eski vadeli borçtan başlanır. Başka merkeze otomatik aktarılmaz. Açık aynı merkez/para birimi borçları due_at artan sırada (gelecek vadeliler dahil), eşitlikte değişmez ID ile dağıtılır.
- Kullanılabilir öğrenci alacağı kısmen/tamamen iade edilebilir. Yetkili merkez yöneticisi yapar; operasyon personeli yapamaz. Alacak aşılamaz; tutar/tarih/gerekçe/yapan kişi saklanır. Eski tahsilat silinmez, yeni borç veya hak değişikliği oluşmaz.
- Alacak aynı merkez/para birimindeki borca yetkili personelin açık mahsup işlemiyle uygulanır. Otomatik harcanmaz, yeni nakit tahsilat sayılmaz; kapatılan borca bağlanır.
- Para iadesi ile paket sonlandırma ayrıdır. İadesiz ürünün kullanılmamış kredisi iade gerekçesi değildir; şartlara göre yönetici istisnası gerekçeli izlenir. Paket sonlandırma kalan borcu otomatik kaldırmaz.
- Merkezler arası tahsilat/kullanım aidiyeti korunur. DS-2026-10-17 kapsamındaki kredili A→B kullanım payı ve onaylı hesaplaşma kabul edilmiştir; otomatik para transferi yoktur, runtime ayrı teslimdir.

## 9. Eğitmen anlaşmaları, hakediş ve ödeme

Katalog/fiyat ve eğitmen ücret anlaşmaları merkezindir; organizasyon ortak oran dayatmaz, bütün koşulları/sonuçları denetler. Aynı eğitmen merkez, ders biçimi ve geçerlilik dönemine göre farklı anlaşma taşıyabilir. Oran kimin payı, hangi taban üzerinden ve varsa salon bedeliyle hangi sırada hesaplanacağı açık olmalıdır. Salon kullanım bedeli ücretsiz, sabit veya yüzdelik olabilir; aynı kesinti iki kez yapılmaz, öğrenciye kendiliğinden ek borç yaratılmaz.

| Model | İşleyiş |
|---|---|
| Yüzde | Hakedişe esas satılmış ders bedeli üzerinden anlaşılmış pay |
| Seans sabiti | Gerçekleştirilen seans için sabit ücret |
| Kişi başı | Hesaba dahil kişi başına sabit ücret |
| Sabit + kişi başı | Seans sabiti ve kişi başı bileşen |
| Açık karma koşul | Katılım/ürün grubuna göre anlaşmada açıkça farklı hesap; otomatik varsayılan değil |

Tahsilat sorumluluğu/risk merkezindir. Eğitmenin gerçekleştirdiği işin hakedişi öğrencinin ödeyip ödememesine bağlı değildir. Kredili paketin ders bedeli öğrencinin satış fiyatından gelir; güncel katalog fiyatı kullanılmaz. Gelmeyen/iptal eden öğrencinin bedeli satış/iptal koşuluyla korunmuşsa ve eğitmen seansı gerçekleştirmişse tabana dahil edilir, aynı bedel iki kez sayılmaz. Kişi başı hesapta da bedeli korunan sonuçlar dikkate alınır.

Süreli/sınırsız üyeliğin seans satış bedeli belirsizdir. Sistem bu üyeliği kendiliğinden yüzde dışına atıp kişi başına geçmez. İlgili üyeliği karşılayan açık anlaşma koşulu bulunmalıdır; eksiklik sıfır ücret sayılmaz, ürün ilgili derse açılmadan merkez tamamlar. “Krediliye yüzde, süreliye kişi başı” mümkün bir karma modeldir, evrensel kural değildir.

Bedelsiz denemeler kişi başı/yüzdelik hakedişe girmez; seans sabitini değiştirmez. Ücretliye dönüşüm geçmiş denemeye hakediş üretmez.

Hakediş yoklama kapanışında oluşur. Seansı fiilen gerçekleştiren eğitmenin merkez/ders biçimi için seans tarihinde geçerli anlaşması uygulanır. İlk planlanan eğitmene otomatik hakediş yoktur. Starter F14 yoklama/hak tüketimi için anlaşma istemez ve hakediş üretmez. Pro/Business ücretli görevlendirme/hakediş için geçerli açık anlaşma gerekir; eksik tutara otomatik ücret atanmaz. Gerçekleşmeden iptal edilen seans hakediş üretmez; iptal ücreti istisnası yoktur. Sonraki düzeltme önceki hakedişe bağlıdır.

Hakediş ile ödeme ayrıdır; kısmi ödeme ve kalan tutar izlenir. Ödeme aynı merkez/para biriminde seçilmiş hakedişlere dağıtılır. Sonraki hakediş düzeltmesi eski ödemeyi silmez; fark sonraki hesaplaşma için ayrıca izlenir.

## 10. Etkinlik

Etkinlik ortak kişi, kontenjan/rezervasyon, finans, belge ve hakediş altyapısını kullanır; ayrı takvim/para sistemi kurulmaz. Etkinlikten sorumlu merkez yetki/tahsilat/rapor sahibidir; fiziksel mekân merkez odası veya harici yer olabilir. Harici mekân için ad/adres/konum ve saat dilimi tutulur, yeni merkez açılması gerekmez. İç oda kullanılmıyorsa oda ataması zorunlu değildir.

En az bir eğitmen veya asistan görevlendirilir; eğitmen bulunması şart değildir. Görevli zaman çakışması kontrol edilir. Aynı etkinlikte katılımcı olan kişi asistan olarak görev alamaz.

Görev ücreti etkinlik oluşturulurken kişi bazında açıkça ücretsiz veya tutar olarak tanımlanır; boş değer ücretsiz sayılmaz, ders anlaşması otomatik uygulanmaz. Ücretli görev hakedişi etkinlik gerçekleştikten ve merkez yöneticisi görevin yapıldığını doğruladıktan sonra oluşur. İptal veya yapılmayan görev hakediş üretmez; ödeme ortak altyapıdadır.

Etkinlik kaydı ve ödeme ayrıdır. Kesin kayıt yer kullanır; tam ödeme gerekip gerekmediği, ücret, paket uygunluğu ve katılımcı/işletme iptal-iade koşulu kayda açılmadan tanımlanır. Kısmi ödeme desteklenir; eksik ödeme kaydı otomatik iptal etmez. Ders/paket koşulları otomatik kopyalanmaz.

Etkinlik katılımcısı aktif öğrenci ilişkisi gerektirir ve SaaS öğrenci limitine dahildir. Açık etkinlik kaydı pasife almayı engeller; aday deneme istisnası buraya genişletilmez.

## 11. Öğrenci aktifliği ve SaaS limit sayımı

Aktif öğrenci ilişkisi esas alınır; oturum hesabı olması şart değildir. Aynı organizasyon kişisi birçok merkezde aktif olsa da organizasyon limitinde bir kez sayılır; merkez raporları yerel aktif ilişkileri gösterir. Yalnız eğitmen/personel olan kişiler ve adaylar sayılmaz.

Limit aşımında veri silinmez veya mevcut öğrenciler rastgele kapatılmaz; yeni öğrenci ilişkisi ve yeniden aktifleştirme engellenir. Pasif öğrenci adına talep/bekleme/rezervasyon/etkinlik kaydı öncesinde aktifleştirme ve limit kontrolü gerekir.

Açık işlem bulunan öğrenci pasife alınamaz: bekleyen talep/alternatif yanıtı, aktif rezervasyon, açık bekleme/yer teklifi ve etkinlik kaydı dahildir. Borç veya kullanılmamış hak bakiyesi tek başına engel değildir; silinmez. Liste örnekleri kapalı bir API kataloğu değildir; sonuçlanmamış diğer işlem türleri durum kataloğunda eşlenir.

Adayın deneme başvurusu/katılımı aday ilişkisiyle yürür, öğrenci limitine girmez. Ücretli öğrenciye dönüşümde aktif ilişki/limit kontrol edilir. Deneme tekrarı kişi ve organizasyon bazında sınırlanır; sayısal sınır henüz belirlenmiş değildir. Bu istisna etkinlik kullanımına kaçış yolu değildir.

## 12. SaaS abonelik yaşam döngüsü

### Plan düşürme

Owner'ın bilinçli talebi ödenmiş dönem sonunda uygulanır; açık operasyonlar geçişi engellemez. Yalnız yeni planın özellik/limitleri sunulur, plan dışı özellikler açık işlem gerekçesiyle sürdürülmez. Veri silinmez/dönüştürülmez; uygun üst plana dönülünce eski verilere aynen erişilir. Arada çalışmamış otomasyon/bildirimler geriye dönük kendiliğinden çalışmaz.

Business'tan tek merkeze geçiş talebi, owner aktif kalacak merkezi seçmeden tamamlanmaz. Seçim yürürlük tarihine kadar değiştirilebilir. Diğer merkezlerin erişimi kapanır, verileri korunur; Business'a dönüşte yeniden açılır.

### Ödeme gecikmesi

Plan kendiliğinden düşürülmez. Son kabul edilen politika, önceki “7 gün bütün yönetim açık” önerisinin yerini alır:

| Dönem | Davranış |
|---|---|
| Gecikmeden itibaren ilk 7 takvim günü | Owner/yönetim işlemlerinde kısıtlar başlar; aynı kapalı işlem operasyon personeli üzerinden aşılamaz. Öğrenci mevcut haklarıyla normal rezervasyon/iptal/görüntüleme yapar. Mevcut seans iptali ve yoklama gibi zorunlu işlemler sürer. Owner SaaS ödeme/abonelik işlemlerine erişir. |
| Süre sonu, ödeme tamamlanmamış | Organizasyon hizmet erişimi bütün roller için kapanır. Owner yalnız ödeme/abonelik yönetimine erişir. Veri korunur; diğer organizasyonlar etkilenmez. Öğrenciye borç açıklanmaz, hizmetin geçici kullanılamadığı belirtilir. |
| Ödeme tamamlanır | Abonelik erişimi yeniden açılır. |

İlk aşamada yeni satış/program, fiyat/ayar ve personel yönetimi kısıtlanır; işlem grupları21’de, API eşlemesi05/08’dedir. Öğrencinin açık bırakılan işlemleri ile onları destekleyen zorunlu operasyonlar listede birlikte kontrol edilir. Bilinçli hata veya tutarsızlık üretilmez.

Ek süre yenileme tarihini uzatmaz, kısmi ödeme yeniden başlatmaz. İstisnai uzatma yalnız SaaS yönetiminindir. Yedi gün sonrasında öğrencinin de etkilenmesi kabul edilmiştir.

### Yükseltme ve yenilemeyi durdurma

Yükseltme, ödeme doğrulanıp gecikmiş SaaS borcu kapatıldığında hemen açılır. Fiyat farkı kalan dönem oranıyla hesaplanır: (yeni dönem fiyatı − mevcut dönem fiyatı) × kalan dönem oranı. Dönem zamanları esas alınır; yenileme tarihi korunur. Sonraki yenilemede yeni tam bedel alınır. Teklif süreli korunur, ödeme anında sessizce değişmez. İlk kapsam aynı faturalama dönemi içindeki plan değişimleridir; aylık/yıllık dönüşüm ayrıca karardır.

Owner yenilemeyi durdurursa ödenmiş dönem sonuna kadar kullanım sürer; sonra organizasyon hizmeti kapanır, veri korunur. Gönüllü iptale ödeme gecikmesi ek süresi uygulanmaz. Dönem bitmeden talep geri çekilebilir; yeni abonelik/ek ücret oluşmaz. Dönem bittikten sonraki dönüş yeni abonelik başlangıcıdır; seçilen plan kapsamında eski verilere erişim açılır.

## 13. Belge, paylaşım, aktarım ve bildirim

- Gerekli belge, işlem noktası ve sürüm tanımlıdır; kabul eden kişi/zaman/işlem bağlantısı saklanır. Yeni sürüm eski onayı silmez; yeniden kabul şartı ayrıca belirtilir. Eksik onay mevcut rezervasyonu otomatik iptal etmez; işlem/katılım tanımlı kuralla engellenir. Hukuki yeterlilik taahhüdü verilmez.
- Herkese açık takvim/kayıt yalnız yayımlanmış ders/etkinlik, ücret/koşulları sunar. Katılımcı listeleri, iletişim, borç/kredi ve iç notlar açılmaz. Hesapsız başvuru alınabilir; kullanıcının kendi kesin rezervasyonu doğrulanmış hesap–kişi bağı gerektirir. Merkezin hesapsız kişi adına işlem yapması engellenmez.
- Aktarım önizleme, doğrulama, alan eşleme ve satır sonucu içerir. Kişi/açılış kredisi/açılış borcu ilgili modüllerde izlenebilir oluşturulur. Tekrar çalışma mükerrer kayıt oluşturmaz; başarılı satırlar yeniden işlenmez, hatalılar gerekçeli raporlanır. Merkez kapsamlı özel içe aktarma izni gerekir; sıradan kişi ekleme izni yeterli değildir.
- Rapor/dışa aktarım yetkili ve filtrelenmiş bütün sonucu kapsar; yalnız açık sayfa değildir. Kaynak modül yerine para/kredi/hakediş üretmez.
- Gerekli işlem bildirimlerinin uygulama içinde görünmesi pazarlama tercihine bağlı değildir. İsteğe bağlı hatırlatma/pazarlama ve dış kanallar kendi izin/tercihlerine tabidir. Dış kanal/sağlayıcı/maliyeti seçilmemiştir; kabul edilmiş e-posta davet ihtiyacı için sağlayıcı kurulumu ayrıca yapılacaktır.

## 14. Operasyon sözleşmesi ve doğrulama

Her operasyon frontend entegrasyonuna hazır sayılmadan şunları tanımlar:

1. Ad, sürüm, modül sahibi ve ürün özelliği.
2. Tam tipli istek/yanıt, zorunluluk/doğrulama, okuma alanları ve sayfalama.
3. Hesap, organizasyon, merkez, rol/izin ve plan kapsamı.
4. Ön koşul, başlangıç/sonuç durumu, geçerli politika/anlaşma sürümü.
5. Atomik kayıtlar, değişmez kurallar, kilitleme/eşzamanlılık.
6. İşlem anahtarı kapsamı/süresi, belirsiz sonuç sorgulama ve tekrar davranışı.
7. Sabit hata kodları, tekrar denenebilirlik ve anlamı.
8. Denetim, bildirim/arka plan işleri, onay gereksinimi.
9. Kabul/başarısızlık senaryoları ve doğrulama kanıtı.

Kesin teknik hata/izin/durum ve tip sözlüğü06/08’dedir; işlem bazlı eşleme08 operations/errors alanındadır.

Asgari doğrulama konuları:

- Tenant/merkez izolasyonu; owner/organizasyon yöneticisi merkez ataması olmadan operasyon yapamaz.
- Kaldırılmış rol/bağlantı açık oturumla çalışmaz; asistan–katılımcı çakışması iki yönde engellenir.
- Son toplam/kategori/fiziksel oda yeri ve son hak/açık limiti yarışlarında fazla ayırma oluşmaz.
- Teklif kabul/süre dolumu tek sonuç verir; teklif yeri ikinci kez sayılmaz.
- İşlem tekrarı çift tahsilat/iptal/kredi/hakediş üretmez; taslak yoklama tüketmez.
- Öğrenci alacağı iade/mahsup yarışında bakiye aşılamaz, mahsup nakit sayılmaz.
- Kişi birleştirmede gerekli merkez onayları tamamlanmadan değişiklik yapılmaz.
- Dondurma/sonlandırma önizlemesi ile onay kapsamı tutarlıdır; geçmiş korunur.
- Yükseltme/düşürme/gecikme/iptal sınır anları doğru uygulanır; diğer organizasyon etkilenmez.
- Aktif öğrenci tekil sayılır; deneme istisnası etkinliğe taşınmaz; açık işlem pasife almayı engeller.
- Bildirim hatası işi geri almaz; politika/anlaşma değişikliği geçmişi yeniden hesaplamaz.

Bu liste hedef kabul başlıklarıdır; maddelerin tamamı topluca passed veya hiç çalıştırılmadı sayılmaz. Gerçek vaka bazlı durum makine sözleşmesi/F01–F33’te, son kaynak CI’ı güncel devirde izlenir.

## 15. Güncel tamamlanma ve açık doğrulama listesi

20 Ekim uygulama envanteri 199/118/81, 34 migration’dır. Aşağıdaki başlıklar hedef/kalan iş ayrımıdır; ilk O4 yazılı teslimindeki tüm SQL/RPC/Edge uygulamasının beklediği yorumu geçerli değildir. P01 sonrası sıra CI-02 → P02–P07; kaynak ve CI tek devirdedir.

| Alan | Yazılı karar/sözleşme | Kalan |
|---|---|---|
| O1 — Paket yaşam döngüsü | Kabul edildi;17,23 ve04–08 | Gerçek uygulama/kabul testleri |
| O2 — Veri yaşam döngüsü | Hesap/organizasyon/imha ayrımı kabul;18–19 | Hukuki uzman saklama teyidi, sözleşme, gerçek imha/yedek testi |
| O3 — İşletim | Pilot hedefler kabul;20 | Yedek/sorumlu/kanal kurulumu, restore/load testi, ücretli üretim hedefi |
| O4 — Teknik sözleşme |04–08 v1.0 yazılı şema/tip/API/durum/hata/izin/atomiklik/guard/kabul envanteri tamamlandı | 118 çağrılabilir işlemde uygulama vardır; kalan 81 sözleşme işlemi ve açık vaka/işletim kabulleri envanter/kuyrukta izlenir; yazılı tamamlama tüm ürün garantisi değildir |

İki son iş tercihi de kabul: ilk ödeme doğrulamasında hizmet/dönem başlangıcı ve ücretsiz deneme olmaması; org belge/segment/automation Owner/OM konfigürasyonu, yerel CM kapsamı ve ayrı operasyon yetkisi. K01–K16’nın karar/teknik kapanışı07’de; K06 hukuki inceleme daha önce ertelendiği statüde kalır. Yeni varsayılmış ürün kararı yoktur; son kullanıcı düzeltmeleri eski hükmün üstündedir.

Fiyatlar, kesin ticari öğrenci/eğitmen/merkez sayıları, deneme tekrar sayısı, gerekli diğer politika değerleri, aylık/yıllık SaaS dönüşümü, dış kanal/provider-maliyeti, henüz eksik ortam/provider ve güvenli secret işletimi yapılandırma/sonraki kapsam işidir; repository ve mevcut CI kurulmuştur. Gerekli değer yokken ilgili operasyon açılmaz, keyfî izin/ret icat edilmez. Pilot yük sayıları ticari plan limitleri değildir. Merkezler arası kullanım payı/hesaplaşma DS-2026-10-17 ile kabul edildi; otomatik para transferi veya kur dönüşümü yoktur.

03’teki çalışma düzeni kabul edilmiştir. Bu belge somut repository oluşturma, kodlama, merge veya üretim dağıtımı emri değildir.

## 16. Sürüm ve terk edilmiş yaklaşımlar

| Sürüm | Tarih | İçerik |
|---|---|---|
| 0.1 | 15 Ekim 2026 | Kabul edilmiş temeller ve henüz kabul edilmemiş T01–T12 taslağı. |
| 1.0 | 15 Ekim 2026 | T01–T12 ve görüşmede kabul edilen kimlik, rol, kapasite, durum, kredi, finans, hakediş, etkinlik, abonelik, aktif öğrenci ve dondurma kuralları derlendi. Açıklar O1–O4 olarak toplandı. |

Artık geçerli olmayanlar: sınırsız öncelikli kontenjan aşımı; otomatik seans/hak öteleme; ayrı süresiz telafi kredi ürünü; CRM'in yalnız yöneticiye açık olması; eşit organizasyon yöneticilerinin birbirini görevden alması; owner'ın merkez operasyonunu atamasız yapabilmesi; süreli üyelikte otomatik kişi başı hakediş; etkinlik katılımcısını öğrenci limitinden çıkarma; gecikmede 7 gün bütün yönetim yetkilerinin açık kalması. Bunlar yeniden öneri sayılarak sessizce uygulanamaz.


## 17. 15 Ekim 2026 — Kabul edilen O1 kararları

Bu bölüm önceki sürümde açık gösterilen O1 hükümlerini tamamlar.

### Dondurmayı erken bitirme

Yalnız merkez yöneticisi sonuç önizlemesiyle yapar. Süre uzatan üründe yalnız fiilen kullanılan dondurma süresi kadar uzatma korunur; süre uzatmayan üründe bitiş değişmez. İptal edilmiş rezervasyonlar geri açılmaz; yeni kayıt güncel kontenjan/hak kontrolüne tabidir. Geçmişe dönük erken bitirme yoktur; hatalı kayıt gerekçeli düzeltmeyle ele alınır.

### Paket/ürün değişimi

Eski satış sonlandırılır, bağlantılı yeni satış oluşturulur. Kullanım ve hareket geçmişi korunur. Kalan hak otomatik yeni ürün kredisine dönüşmez; eski satış koşuluyla parasal hesaplaşma çıkarılır. Oluşan alacak yeni satışa açık mahsupla uygulanabilir. Eski paketin gelecek rezervasyonları önizlenir; yönetici seçimiyle yeni ürünün uygun olduğu kayıtlar yer kaybetmeden atomik olarak yeni hakka bağlanır. Yeni ürünün karşılamadığı rezervasyonlar açıkça iptal edilmeden değişim tamamlanmaz. Fark borç/alacak olarak izlenir, otomatik nakit iade yapılmaz.

### Yenileme

Eski pakete bağlı yeni satış oluşturulur. Eski kullanılabilir kredi kendi süresinde geçerli kalır; otomatik taşıma, uzatma veya süresi dolmuş hakkı canlandırma yoktur. Yetkili gerekçeli süre uzatma ayrıdır. Süreli üründe kullanılmayan gün/dönem kotası devretmez. Rezervasyon kaynak pakette kalır, mükerrer rezervasyon oluşmaz. Yeni paket eski dönem sonundan veya açık seçilen tarihten başlar; örtüşme önceden gösterilir. Yeni uygun hak mevcut kredi açığını kapatma kuralına tabidir.

### Dönem sınırları

Satış başlangıç ve bitiş sınırı tarihleri açıkça girilir. Her ikisi satış merkezinin snapshot saat diliminde00:00 olarak yorumlanır, UTC karşılığı saklanır. Başlangıç dahil/bitiş hariç:15Şubat→15Mart,15Mart00:00 başlayan dersi kapsamaz. Bitiş son kullanım günü değildir. Takvim ayına sabitleme, ayrı takvim aylık ürün biçimi veya satış bitişini ay aritmetiğiyle otomatik üretme yoktur. Bu FtkSaaS standart davranışıdır; organizasyon tarafından kabul edilir, organizasyon değiştiremez. Seansın başlangıcı esas, bitişinin dönem dışına taşması tek başına engel değil. Yenilemede de girilen kesin tarihler esastır; sistem boşluk/örtüşmeyi önizlemede gösterir, otomatik tarihle karar vermez.

### İadeli ürünlerde kesin yöntem kataloğu

- Kredi oranında: net satış bedeli × kullanılmamış kredi / satılan toplam kredi.
- Kullanılanları yeniden fiyatlandırma: en az sıfır olacak şekilde net satış bedeli − tüketilmiş kredi × satışta belirlenmiş tek ders bedeli.
- Süre oranında: net satış bedeli × kullanılmamış ücretli süre / toplam ücretli süre.

Yöntem/değerler satışta sabitlenir. Politika gereği tüketen noShow/geç iptal kullanılmış sayılır; sonlandırmada serbest bırakılan gelecek hak kullanılmamıştır. Ücretsiz dondurma uzatması iade bedelini artırmaz. Hesaplanan tutar önce aynı satışın kalan borcunu azaltır, fazlası öğrenci alacağıdır; tahsil edilmemiş para iade edilmez. Nakit iade ayrı yetkili işlemdir. Standart dışı yönetici istisnası gerekçeli kaydedilir. İadesiz ürün ayrı seçenektir. Bunlar yazılım hesap yöntemleridir; emredici tüketici haklarını ortadan kaldırmaz.

## 18. 15 Ekim 2026 — Kabul edilen O2 yaşam döngüsü

### Hesap silme

Ortak hesabın silinmesi bütün oturum/davet ve organizasyon hesap bağlantılarını geçersizleştirir. İşletmenin kişi, ders, hak, borç ve ödeme kayıtları ayrı saklama/silme politikasına tabidir; hesap silme borcu/alacağı kaldırmaz. Aktif owner, FtkSaaS tarafından owner değişimi tamamlanmadan veya organizasyon kapatma süreci tamamlanmadan hesabını silemez; müşteri kendi owner rolünü kaldırmaz. Aynı e-postayla yeni hesap eski bağları canlandırmaz; yeniden doğrulanmış davet gerekir.

### Organizasyon kapatma ve geri dönüş

Yenilememe dönem sonunda hizmeti kapatır; yeni abonelik plan kapsamında geri erişim sağlar. Owner’ın organizasyonu kapatma işlemi hizmeti hemen kapatır, yeni işlem/yenilemeyi durdurur; yeniden açma açık owner işlemi ve geçerli abonelik ister. Veri her iki durumda saklama politikasına tabidir. Kalıcı tüm veri silme ayrı işlemdir; tamamlanınca eski organizasyon geri açılamaz, yeni kuruluş yeni kimlik alır. Kapatma öncesi açık ders/talep/rezervasyon, borç/alacak ve dışa aktarım imkânı gösterilir; kapatma bunları gerçekleşmiş/iade edilmiş/borcu silinmiş saymaz. Yeniden açmada kaçırılmış ders/bildirim/otomasyon geriye çalışmaz; çözülmemiş işler yöneticiye gösterilir.

### Kalıcı silme kapsamı

Yalnız owner yeniden kimlik doğrulaması ve açık kapsam onayıyla başlatır. Erişim, davet, paylaşım bağlantıları, bildirimler ve otomasyonlar devre dışıdır. Veritabanı, yüklenen dosyalar, üretilmiş raporlar ve geçici kopyalar kapsanır; diğer organizasyon etkilenmez. Ayrı hukuki gerekçeyle saklanan kayıtlar sınırlı arşivdedir; uygulamaya veya yeni organizasyona geri bağlanmaz. Yedek geri yükleme silinmiş veriyi kullanıma açamaz. Bütün ilgili sistemlerde doğrulanmadan tamamlandı denmez; hatalı adımlar izlenir/yeniden denenir. Aynı e-posta, işletme adı veya yeni abonelik eski veriyi canlandırmaz.

## 19. Geçici uzun saklama varsayılanları — hukuk incelemesi açık

Kullanıcı 15 Ekim 2026’da uzun saklama varsayılanları belirlenmesini, hukuki uzman incelemesini daha sonra kendisinin yaptıracağını belirtti. Aşağıdaki sayılar bütün veri türleri için kanunun izin verdiği kesin azami süreler değildir. Kanuni süre, zamanaşımı ve ürün politika üst sınırı ayrıdır. Hukuki amaç/gerekçe bulunmayan verinin sırf tabloda süre var diye tutulmasına izin vermez. Hukuki inceleme bu bölümün ayrı açık işidir; mevcut yazılım uygulaması veya mevzuata uygunluk onayı değildir.

| Veri grubu | Geçici varsayılan | Süre başlangıcı / kapsam |
|---|---|---|
| FtkSaaS’ın kendi ticari/mali belgeleri | 10 yıl | TTK m.82 kapsamındaki belge için ilgili takvim yılı sonu. VUK’un 5 yıllık süresi ayrıca izlenir; aynı belgeye daha uzun uygulanabilir yükümlülük esas alınır. |
| Satış, tahsilat/iade, kredi hareketi, hakediş ve hizmet ifasının gerekli kanıtları | 10 yıl | İlgili işlem/hizmet ilişkisinin tamamlanması; zamanaşımı başlangıcı ve özel hükümler hukuk incelemesinde kesinleştirilir. Müşteri işletme verilerinde veri sorumlusunun sözleşmeli talimatı ve saklama amacı gerekir; sağlayıcının kendi faturasıyla aynı kapsam sayılmaz. |
| Sözleşme ve sürümlü belge kabul kanıtları, kritik yetki/değişiklik denetimi | 10 yıl | İlgili sözleşmenin/ilişkinin sona ermesi veya ilgili işlem; yalnız kanıt için gerekli alanlar. Genel profilin tamamını arşivleme gerekçesi değildir. |
| Satışa dönüşmemiş aday ve takip kayıtları | 2 yıl | Son anlamlı temas; sırf otomatik mesajla süre yenilenmez. Kanuni azami değil geçici ürün politikasıdır. |
| Bağımsız profil, iletişim ve serbest operasyon notları | İhtiyaç sürdüğü müddetçe; sona erince en fazla 2 yıl | İlişkinin bitişi. Daha uzun saklanan bir kanıtın zorunlu alanları ayrı arşivlenir; tüm profil 10 yıla taşınmaz. Geçerli silme talebi/amaç yokluğu daha erken imha gerektirebilir. |
| Güvenlik/erişim logları | 2 yıl | Kayıt anı; genel bir 5651 yükümlülüğü varsayılmaz. Önceki 90 gün önerisinin yerine geçen geçici politika; gereklilik/orantılılık hukuk incelemesinde değerlendirilecek. Parola/token kaydedilmez. |
| Bildirim gönderim/teslim teknik kayıtları | 1 yıl | Kayıt anı. İspat için zorunlu içerik ilgili kanıt sınıfına ayrılır; pazarlama onayı ve ileti mevzuatı ayrıca incelenir. |
| Silme/imha işlem kanıtları | 3 yıl | İşlem anı; yönetmelikte asgari 3 yıldır, kanuni azami diye etiketlenmez. Silinen içeriğin kopyası tutulmaz. |
| Geçici dışa aktarım dosyaları | 7 gün | Oluşturulma anı; kaynak kayıt süresini değiştirmez. |
| Yedek kopyalar | 30 gün döngü hedefi | Yedek oluşturulma anı; O3’te altyapı ve geri yükleme koşulları doğrulanacak. Hukuki arşiv yedek rotasyonu değildir. |

Kalıcı silme isteği, yukarıdaki operasyon saklama varsayılanlarından önceliklidir; yalnız belgelenmiş hukuki saklama gerekçesi bulunan gerekli kayıtlar istisnadır. Erişim hemen kapanır; hukuki saklama istisnası dışındaki veriler için operasyonel silme hedefi 30 gündür. Yedekler de bu süreyi aşmayacak biçimde O3’te doğrulanmalıdır; tamamlanma bilgisi gerçek imha durumuna göre verilir. Somut uyuşmazlık/resmî yükümlülükte yalnız ilgili kayıtlar gerekçeli saklama blokajına alınır. Yeni hukuki değerlendirme süresi dolmuş veriyi kendiliğinden geri getiremez. Süreler kayıt sınıfına göre sürümlü, merkezi yapılandırma olarak yönetilir; satış/paket ayarı değildir.

### Resmî kaynaklar ve sınır

- KVKK Silme/Yok Etme/Anonimleştirme Yönetmeliği, m.7, 11–12: https://www.kvkk.gov.tr/Icerik/5441/KISISEL-VERILERIN-SILINMESI-YOK-EDILMESI-VEYA-ANONIM-HALE-GETIRILMESI-HAKKINDA-YONETMELIK
- KVKK 2021/847: Belirli fatura/adres kayıtları için on yıllık süre değerlendirmesi; tüm verilere genel saklama izni değildir: https://www.kvkk.gov.tr/Icerik/7140/2021-847
- TTK m.82, Ticaret Bakanlığı metni: https://mugla.ticaret.gov.tr/data/5f46170213b8760fa8ff967a/TTK.pdf
- VUK saklama özeti, GİB: https://gib.gov.tr/vergi-konulari/2_isletme_ve_girisimci/13_mukelleflerin_ise_baslama_ve_isi_birakma_odevleri/13

1.1 — 15 Ekim 2026 (önceki güncelleme): Bu görüşmede kabul edilmiş O1 ve O2 yaşam döngüsü kararları işlendi; uzun saklama varsayılanları kullanıcı talimatıyla geçici belirlendi. Hukuki uzman incelemesi, yedek/O3 ve API/O4 ayrıntıları açık tutuldu. 00/01/03 dosyaları bu işlemde değiştirilmedi; önceki O1/O2 açık listeleri bakımından bu teknik sözleşmenin yeni sürümü esas alınır.


## 20. Kabul edilmiş O3 pilot işletim hedefleri

### Yedekleme ve kurtarma

- Pilot RPO en fazla 24 saat, RTO olayın tespitinden itibaren 8 saattir. Bunlar testle kanıtlanacak tasarım hedefidir; mevcut garanti/SLA değildir. Ücretli üretim için ayrıca değerlendirilecektir.
- Her gün veritabanı ve dosyalar birbiriyle tutarlı kurtarma noktası oluşturacak biçimde yedeklenir; canlı projeden bağımsız, şifreli, erişimi sınırlı 30 günlük döngü tutulur. Veritabanı yedeği Storage nesnelerinin içeriğini tek başına kapsamaz.
- Üretim öncesinde ve sonrasında ayda bir izole geri yükleme testi yapılır. Kimlik/erişim, veri bütünlüğü, kod/yapılandırma ile dosya eşleşmesi ve silinen verinin açılmaması doğrulanır. Gerekli kapsamın tam envanteri uygulama öncesi hazırlanır.
- Başarısız/gecikmiş yedek otomatik alarm üretir. RPO, yalnız işin zamanlanmasıyla değil son kullanılabilir kurtarma noktasıyla değerlendirilir.
- Geri yükleme sonrası erişimden önce bütünlük, silme kayıtları ve bekleyen işler denetlenir; eski bildirimler topluca yeniden gönderilmez.
- Yedek yaşı döngüsü ile kalıcı silme talebinden itibaren imha son tarihi aynı şey değildir. Bölüm 19’daki 30 günlük silme hedefinin bütün yedeklerde sağlanması tasarım/test gereğidir; 30 günlük rotasyon bunu tek başına kanıtlamaz.

### İzleme

| Durum | Kabul edilmiş davranış |
|---|---|
| Hizmete erişilemiyor | 5 dakikada bir dış kontrol; art arda 2 başarısızlıkta alarm. |
| Yedek başarısız / kurtarma noktası 24 saatten eski | Beklemeden alarm. |
| Tahsilat/kredi/rezervasyon bütünlük ihlali | Tek olayda kritik alarm; ilgili işlem güvenli biçimde durur. |
| Bildirim/arka plan işi başarısız | Sınırlı otomatik tekrar; denemeler tükenince alarm. İş türü sayıları katalogda belirlenecek. |
| Beklenmeyen backend hatası | Merkezi kayıt, işlem/izleme kimliği; hassas içerik loglanmaz. |

Alarmlar SaaS işletim sorumlusunadır; müşteri owner’ına teknik müdahale yükümlülüğü verilmez. Sorumlu kişi/kanal seçimi açıktır. Alarmın oluşması müdahale edildiğini göstermez; 7/24 insan desteği taahhüt edilmemiştir. RTO hedefinin işletim kapasitesiyle sağlanması test ve üretim değerlendirmesinde ele alınır.

### Performans

| İşlem | İsteklerin %95’i için backend hedefi |
|---|---|
| Sayfalı liste / kişi-paket detayı | 1 saniye |
| Merkezin bir haftalık takvimi | 2 saniye |
| Rezervasyon/iptal/tahsilat/yoklama kapatma | 2 saniye |
| Büyük rapor/dışa aktarım/toplu içe aktarma | Arka plan; başlatma yanıtı 2 saniye |

Ölçüm backend’e varıştan yanıt çıkışına kadardır; istemci interneti ve ekran çizimi dahil değildir. Geçici pilot yük profili 10 organizasyon × organizasyon başına 500 aktif öğrenci, toplam 50 eşzamanlı kullanıcıdır; ticari plan limiti değildir. Gerçek istek karışımı ve veri hacmi yük testinde belgelenecek. Hız için bütünlük gevşetilmez; doğru ret geçerli sonuçtur. Büyük işler ilerleme/sonuç durumuyla sorgulanır, bağlantı kopması işi yeniden başlatmaz. Sağlanmazsa sorgu/indeks/işlem tasarımı iyileştirilir, gerekirse altyapı yükseltilir.

Resmî dayanak (15 Ekim 2026’da kontrol edildi): https://supabase.com/docs/guides/platform/backups — Free için düzenli dışa aktarım ve bağımsız yedek önerilir; Storage içeriği ayrıca yedeklenir. Bu doküman bizim RPO/RTO hedefimizi kendiliğinden garanti etmez.

## 21. Kabul edilmiş O4 davranış kararları

### İşlem tekrarı ve çoklu istemci

Kritik işlemlerde istemci işlem anahtarı üretir, tekrar aynı anahtarla yapılır. Kapsam organizasyon + işlemi yapan hesap + operasyondur; merkez ve diğer istek alanları içeriktedir. Aynı anahtar/aynı içerik tamamlanmış sonucu döndürür; farklı içerik reddedilir. Sürüyorsa ikinci kez çalıştırılmaz, durum sorgulanır. Tam sonuç 30 gün tutulur, sonra anahtarın kullanılmış olduğuna ilişkin asgari kayıt ilgili iş kaydının saklama süresince korunur; eski anahtar yeni iş başlatmaz. Sonucu okumak güncel erişim kontrolüne tabidir. Anahtar kaydı kişisel veri silme/saklama politikasını aşan istisna değildir.

Farklı anahtarlarla aynı öğrenci/seans için iki aktif rezervasyon atomik iş kuralıyla engellenir; ikinci istek yetkisi kapsamında zaten rezervasyon bulunduğu sonucunu alır. Aynı/farklı frontend veya eşzamanlılık bu kuralı değiştirmez; ikinci yer/hak ayrılmaz. Aynı öğrenci/tutarlı iki tahsilat gerçek ayrı ödeme olabileceğinden salt tutar eşitliğiyle mükerrer sayılmaz.

### Sürüm desteği

Uyumlu yeni alan eklenebilir; mevcut alan anlamı sessizce değişmez. Bozucu değişiklik yeni ana API sürümüdür. Önceki ana sürüm yenisinin yayımlanmasından itibaren en az 90 gün desteklenir; kapanış tarihi sorgulanabilir sözleşmede yayımlanır. Kritik güvenlik/bütünlük sorunu erken engelleme gerekçesidir; gerekçe/asgari sürüm bildirilir. Desteklenmeyen istemci hiçbir iş kaydı üretmeden sabit güncelleme-gerekli hatası alır. Her sürüm güncel rol/plan/bütünlük kontrollerine tabidir.

### Davet ve sıfır organizasyon

Davet 7 gün geçerli, tek kullanımlık, hedef e-postaya bağlıdır. Aynı kişi/hedef adres için tek aktif davet vardır; yeniden gönderim eskisini geçersizleştirir, yeni 7 günlük süre başlar. Süre dolumu kişi/paket/rezervasyonu silmez. Kabulde güncel organizasyon erişimi ve başlatanın ilgili yetki/kapsamı kontrol edilir; kaldırılmış yetki veya kapalı hizmet erişim kazandırmaz. Gecikmenin ilk 7 günündeki açık davet istisnası aşağıdaki matrise tabidir.

| Rol | Davet kapsamı |
|---|---|
| Merkez yöneticisi | Kendi merkezindeki kişi kayıtları; mevcut rol/bağlantı sınırları korunur. |
| Operasyon personeli | Yetkili merkezde mevcut öğrenci hesabı daveti varsayılan açık; merkez yöneticisi kapatabilir. |
| Eğitmen | Varsayılan kapalı, yönetici izniyle yalnız görevlendirildiği sınıf/seans öğrencileri. |
| Asistan | Yok. |

Öğrenci daveti rol/yöneticilik veya iletişim değiştirme yetkisi vermez. Eğitmen kayıtlı adrese gönderebilir, adresi değiştiremez; tamamını görmesi gerekmez. Gönderen/öğrenci/zaman izlenir. Yetki kalktıysa yönetici yeni davet başlatır. Hesap erişimi mevcut kişiye, ilk kabulde öğrenci self erişimidir. Ayrıcalıklı login rolü yalnız aktif hesap bağı kurulduktan sonra yetkili atamasıyla verilir. Offline görev/ilişki kaydı rol grantı değildir; otomatik ayrıcalık açmaz.

Sıfır organizasyonlu hesap açık kalabilir, hesap yönetimi/davet kabulü yapabilir, organizasyon verisine erişemez. Hesap açmak organizasyon yaratmaz; yeni organizasyon oluşturma ayrı işlemdir.

### SaaS ödeme gecikmesinin ilk 7 günü

| İşlem grubu | Durum |
|---|---|
| Öğrencinin mevcut hakla rezervasyon/iptal/talep/görüntülemesi | Açık |
| Mevcut programda talepleri sonuçlandırma, rezervasyon/iptal, yer teklifi kabulü | Açık |
| Mevcut seansın yoklaması/kapanışı ve gerekçeli düzeltme | Açık |
| Mevcut seans iptali, zorunlu saat/oda/eğitmen değişikliği | Açık |
| Mevcut öğrenci borcu tahsilatı, gerekli iade/mahsup | Açık |
| Mevcut öğrenci hesabı daveti gönderme/kabul | Açık |
| Yeni öğrenci aktifleştirme, paket satışı/yenileme, yeni program/seans/etkinlik | Kapalı |
| Fiyat/katalog/politika/personel/yetki yönetimi | Kapalı |
| Yeni CRM kampanyası/otomasyonu ve toplu içe aktarma | Kapalı |
| Yetkili mevcut kayıt okuma/dışa aktarım | Açık |
| Owner SaaS ödeme/abonelik işlemleri | Açık |

Açık işlem rol yetkisini genişletmez. Düzeltme/başka personel hesabıyla kapalı işlem aşılamaz. Yedi gün sonunda hizmet bütün rollere kapanır, owner yalnız ödeme/abonelik yönetimine erişir. Özel ders talebi mevcut uygun seansa bağlanabiliyorsa onaylanır; yeni seans gerektiriyorsa gecikme kısıtı nedeniyle bekler, reddedilebilir/geri çekilebilir. Mevcut seans değişimi/kopyalama yeni ders yasağını aşamaz.

### Merkezler arası hak kullanımı

Yalnız paketin izin verdiği merkezlerde, ortak bakiye atomik kontrolüyle mümkündür. Satış/borç/tahsilat/iade satış merkezinde kalır; her kullanımda satış ve hizmet merkezi ayrı izlenir. Fiilî dersin hakedişi hizmet merkezinin anlaşmasıyla o merkezde oluşur; yüzdelik hesap kaynak paketin satış bedeline dayanır. Süreli ürünün açık anlaşma koşulu zorunluluğu korunur. DS-2026-10-17: uygun kredili tüketimde gerçek satış bedeli payı A→B alacağını oluşturur; süreli/sınırsız için transfer yoktur. Kapanış/tüketim veya sonradan uygun kredili paketle geçmiş açık kapatma tetikler; ilgili iade bağlı ters kayıt üretir. Otomatik para transferi yoktur; çift onay ve ayrı yetkili ödeme/mahsup kaydı gerekir.

### Halka açık başvuru koruması

Hesapsız başvuru yalnız talep oluşturur; yer/hak ayırmaz, hesap-kişi bağlantısı/rol vermez. İlk kabulde bot doğrulaması zorunludur. IP/hedef adres/organizasyon sınırları birlikte uygulanır, IP kimlik sayılmaz. Başlangıç: IP başına 15 dakikada 5, aynı organizasyon/hedef adrese saatte 3 başarılı başvuru. Bunlar ayarlanabilir güvenlik değeridir. Aynı hedef/ders-etkinlik için açık başvuruda ikinci kayıt oluşmaz. Yanıt adresin öğrenci veya hesap olduğunu açıklamaz; iletişim doğrulanmamıştır, eski kişi bilgisi otomatik değiştirilmez. Hizmeti kapalı organizasyonda veri toplamadan kullanılamadığı bildirilir. Açık başvuru öğrenci limitini veya etkinlikte aktif öğrenci koşulunu aşmaz.

### Para, zaman ve sıra

Para biriminin en küçük biriminde tam sayı kullanılır; kayan noktalı para hesabı yoktur. Para birimi zorunlu, farklı para birimi mahsup/otomatik kur dönüşümü yoktur. Ara hesap hassastır; sonuç en küçük birime, yarım değerler sıfırdan uzağa yuvarlanır. Satır dağıtım toplamı kaynağa eşittir; fark en büyük küsurata, eşitlikte kararlı sıraya dağıtılır. Düzeltme/iade önceki hareketin kayıtlı tutarını esas alır; yeniden yuvarlamayla fark üretmez.

Gerçekleşen an UTC, takvim merkez saat dilimidir. Takvim günü ve 24 saat ayrı tanımlanır. Eşit iş zamanında değişmez kayıt kimliği kararlı sıra sağlar. API tipleri ve yaz saati doğrulaması04–08’de; desteklenen para birimi/exponent allowlist’i kurulumda sürümlenir, unsupported para birimi işleme açılmaz.

### Eşzamanlı düzenleme ve önizleme

Düzenlenebilir kayıt sürüm taşır; istemci okuduğu sürümle yazar. Arada değişmişse sabit sürüm-çatışması hatasıyla ret, güncel kayıt okuma ve yeniden değerlendirme gerekir; eski değişiklik otomatik tekrarlanmaz. Yetki/kontenjan/bakiye kontrolleri ayrıca sürer. Finans/kredi geçmişi değiştirilmez, bağlı düzeltme eklenir. Önizlemede ilgili kayıt değişmişse eski kapsam/onay uygulanmaz, yeni önizleme gerekir. İlgisiz değişikliklerle tüm işlemleri gereksiz kilitlememek için bağımlılık kapsamı katalogda tanımlanacak.

### Yeni paketle geçmiş kredi açığı kapatma

Önce geçmiş tüketilmiş açıklar ders tarihi sırasıyla, sonra gelecek rezervasyon açıkları seans tarihi sırasıyla kapatılır. Geçmiş tüketilmiş açık için yeni paketin başlangıcının eski dersi kapsaması aranmaz; ders/sınıf/merkez uygunluğu korunur. Yeni geçmiş rezervasyon yaratılmaz, eski açık hareketine bağlı kapatma kaydı oluşur. Gelecek açıkta paketin seans tarihinde geçerliliği zorunludur. Eski yoklama/satış koşulları/oluşmuş hakediş kendiliğinden yeniden hesaplanmaz. Yeni para borcu yalnız yeni satıştan doğar; kapatma ek borç yaratmaz. Kaynak satışsız negatif kredi katılımında yüzdelik hakediş tabanı merkezce tanımlanır ve rezervasyonda sabitlenir; sonraki paket/ödeme geçmişi yeniden fiyatlandırmaz veya ayrıca para borcu üretmez.

### Hata ve tekrar deneme

Kontenjan/hak/yetki/politika engellerinde otomatik tekrar yoktur. Sürüm çatışmasında güncel kayıt alınır, eski değişiklik otomatik uygulanmaz. Bağlantı kopması/zaman aşımı başarısızlık kanıtı değildir; aynı işlem anahtarıyla sorgu/tekrar gerekir. Backend tekrar denenebilir dediğinde geçici hatada artan aralıklarla en fazla 3 otomatik yeniden deneme vardır. Hız sınırında bildirilen bekleme süresi uygulanır. Sonuç hâlâ belirsizse doğrulanamadı denir; yeni anahtarla ikinci iş başlatılmaz. Hata sabit kod/tekrar bilgisi/izleme kimliği taşır; teknik sır ve başka organizasyon verisi açılmaz.

1.2 — 15 Ekim 2026: O3 ve O4 davranış kararları, personelde varsayılan açık davet ve kabul edilmiş çalışma düzeniyle kaynak ilişkileri işlendi. O4 teknik katalogları, hukuki inceleme, üretim hedefleri ve gerçek doğrulamalar açık kaldı. Bu sürüm 00/01/03 belgeleriyle eşzamanlı güncellenmiştir; önceki 1.1’deki dosyalar değiştirilmedi notu yalnız o tarihsel güncellemeye aittir.


## 22. O4 yazılı teknik sözleşmesi —15 Ekim2026

04 veri şeması,05 API,06 durum/hata/izin,07 denetim/kabul ve08 JSON tip/operasyon sözleşmesi v1.0’dır.85 tablo adayı,174 operasyon,665 tip/şema tanımı ve55 kabul/başarısızlık senaryosu envanteri vardır. Sayılar mimari servis veya modül zorunluluğu değildir.08 JSON’da her operasyona request/response/error/permission/transition/transaction/semantic guard ve senaryo referansları bağlıdır; her typed snapshot kapalı alan şemasıdır. Uygulama bu kuralları gerçekleştirecek, yalnız JSON doğrulaması semantic guardları ispatlamaz.

Belge kontrolleri: referans hedefleri, kapalı nesneler, required alanları, FK adları, feature coverage ve izin/hata eşlemeleri; örnek olumlu/olumsuz payloadlar. Bu yerel alt-küme doğrulaması harici tam dialect validator veya backend testi değildir. RLS/race/Auth/provider/load/restore testleri çalıştırılmadı. Kod/migration dağıtılmadı. FtkSaaS production hazır/SLA iddiası yoktur.

## 23. Son açık kullanıcı kararları —önceki çelişen hükümleri değiştirir

### Owner ve hesap erişimi

Owner rolünü yalnız FtkSaaS doğrulanmış hesaba organizasyon kapsamında atar/kaldırır. Müşteri owner devir/kendi owner rolünü kaldırma yapamaz. Canlı org ownersız bırakılamaz; platform değişimde yeni owner atomik atanır. Owner merkez oluşturur, kendisini CM atar, sonra CM operasyon yetkisiyle hesap erişimi gönderir. Başka CM atayıp kendi CM rolünü owner yetkisiyle kaldırabilir. OM’nin önce kabul edilmiş kendi merkezine atanma hakkı korunur; bu owner rolü verme yetkisi değildir. CM/staff diğer CM/OM/owner atayamaz.

Hesap erişimi bağlantısı organizasyonda mevcut kişi/öğrenci kaydı içindir; orgda olmayan kişiyi çağırma ayrı yeni özellik olarak eklenmez. İlk bağ öğrenci self erişimiyle, rol ataması sonra yetkili tarafından yapılır. Aktif öğrenci ilişkisi ve SaaS sayımı ayrı, hesap erişimi yeni öğrenci kaydı çoğaltmaz. Offline eğitmen/personel/görev kaydı login grantı değildir. Owner CM değilse hesap erişimi gönderemez. Personelde mevcut öğrenci erişimi varsayılan açık, eğitmende izinle kendi öğrencileri, asistanda yok. Yanlış bağ kaldırılıp yeniden kurulması eski grantı otomatik canlandırmaz.

### Negatif kredi, başlangıç kapısı ve hakediş

İzinli negatif limitte/tam sınırda katılım planın izin verdiği koşullarla mümkündür. DS etki onayıyla korunan kesin rezervasyon sırf sonraki limit/politika/hak değişikliği nedeniyle engellenmez; diğer kayıtların sınır aşımı engellenir. Ayrılmış+tüketilmiş açık ortak hesaptır, mevcut rezervasyonun ayrılmış açığı ikinci kez sayılmaz. Seans başlangıcından önce ödeme ve ilgili hak işlemi açığı izinli seviyeye getirmiş olmalıdır; tahsilat tek başına kredi üretmez. DS koruması dışındaki başlangıç limit aşımı blocked sonucudur, CM kaydeder; I/A hassas finans detayı görmez. Sonraki ödeme veya yeni paket geçmiş blocked katılımdan hakediş doğurmaz. Bu kalıcı kayıp öğrenci/pasiflik değildir. Kredi consume/release satıştaki açık blocked politikasındandır.

Blocked kişi yüzde/kişi hakedişine dahil değildir. Diğerleriyle gerçekleşen seans sabiti korunur; hiç gerçekleşmeyen özel ders hakediş oluşturmaz. Kaynak satışsız fakat limite uygun negatif krediyle katılımda merkez hakediş değerleme bedelini rezervasyonda sabitler.500TRY/%40→200TRY, sonraki paket bu tutarı değiştirmez; ayrıca öğrenci para borcu yaratmaz. Bu yalnız kaynak satışı bulunmayan negatif yüzdelik için açık gerçek-satış-bedeli istisnasıdır.

### Süreli kota

Hafta/ay kota üyelik başlangıcına bağlıdır; hafta7 yerel gün. Aylık quota sınırı başlangıç gününden üretilir, olmayan gün o ay sonuna sıkışır; sonraki sınır ilk gün çıpasından, satış end_date değişmeden. Son kısa pencere tam kota, devir yok. Rezervasyon quota ayırır; yoklama/iptal koşuluna göre consume/release. Bu satış geçerliliğini otomatik aylık hesaplamak değildir.

### Kuruluş ve abonelik

Platform doğrulanmış hesaba owner atar. Owner ilk merkez/self-CM kurabilir. Öğrenci, satış ve ders operasyonu ilk abonelik ödemesi doğrulandığında açılır; dönem o anda başlar. İlk ödeme öncesine7gün grace uygulanmaz, ücretsiz trial yoktur. Kuruluş taslağı ödeme öncesi sadece bu bootstrap/abonelik yetkilerine sahiptir. Yenileme gecikmesinin mevcut kabul edilmiş7gün modeli sürer.

### Org konfigürasyonu ve otomasyon

Ortak belge yayını, org segment/automation tanımı Owner/OM; CM kendi merkez kapsamını yönetir. Org tanım yetkisi merkez operasyonu vermez. Automation tanımı execute center scope ve güncel operasyon yetkisi gerektirir; rol/plan/zorunlu kuralı aşamaz. Gönderim sağlayıcısı seçimi/kullanım maliyeti ayrıca yapılandırılır.

### Etkinlik kapanışı

Atanmış I/A mark edebilir, kapanış yalnız sorumlu CM’dedir; iptal edilmemiş bütün katılımların sonucu girilmiş olmalı. Paket reserve consume/release kayıt sırasında kabul edilen etkinlik koşuluyla kapanışta atomik sonuçlanır. Saatin geçmesi auto attendance/no_show değildir. Görev ücreti event gerçekleşme+CM görev doğrulamasında, katılımcı sayısı/eksik tahsilat fee’yi kendiliğinden değiştirmez. CM gerekçeli kapalı düzeltmesi bağlı hak hareketleriyle geçmişi korur.

2.0 —15 Ekim2026: Son kullanıcı düzeltmeleri ve son iki kabul işlendi. O4 yazılı katalogları/tip/operasyon eşlemeleri tamamlandı. Hukuki teyit, sayısal kurulum ve gerçek uygulama/üretim doğrulamaları açık tutuldu.

## 15 Ekim 2026 — D01–D09 disiplin revizyonu (kabul edildi)

Belge paketi revizyonu: 2.1. Bu bölüm önceki çelişen disiplin, paket kapsamı ve negatif kredi hükümlerinin yerini alır. Önceki sürüm numaraları ve denetim sayıları tarihsel tabanı gösterir.

**D01.** Disiplin organizasyon düzeyinde tanımlanır; merkezler sundukları disiplinleri kullanıma açar. Aynı organizasyonun merkezleri aynı disiplin kimliğini kullanır.

**D02.** Eğitmen birden fazla merkez/disiplinde görev alabilir. Öğrenci birden fazla merkez/disipline kayıt olabilir; organizasyon kişi kaydı çoğaltılmaz. Öğrenci eğitmenin alt kaydı değildir; eğitmen değişimi öğrencinin kimliğini veya haklarını değiştirmez.

**D03.** Normal ders/seansın merkezi ve disiplini belirgindir. Merkezlerin program, fiyat ve eğitmen anlaşmaları ayrı kalır. Disiplin ilişkisi yeni uygulama rolü veya operasyon yetkisi vermez.

**D04.** Paket kullanım kapsamları: merkez+disiplin; merkezin bütün disiplinleri; organizasyonun bütün merkezlerinde belirli disiplin; organizasyonun bütün merkez ve disiplinleri. Organizasyon sınırı aşılamaz; mevcut SaaS plan/merkez erişim sınırları korunur.

**D05.** Ders/etkinlik uygunluğu kullanım kapsamından ayrı belirtilir. Organizasyon genelinde etkinlik paketi bütün normal derslerde kendiliğinden geçmez. Geniş kapsam kapalı sınıf, kapasite, tarih ve diğer uygunluk kurallarını aşmaz.

**D06.** Dar kapsamlı disiplin hakları başka disiplinde kullanılamaz; başka disipline ait paket, kapsam dışındaki kredi açığını kapatamaz. Birden fazla disiplinde geçerli 10 kredilik paket toplam 10 kredi sağlar; disiplin başına ayrı 10 kredi oluşmaz.

**D07.** Negatif kredi sınırı öğrenci için merkez–disiplin bazında uygulanır. Aynı kapsamdaki ayrılmış ve tüketilmiş açık birlikte sayılır; mevcut rezervasyon iki kez sayılmaz. Bir disiplindeki kredi açığı diğer disiplinin katılımını engellemez. Organizasyon geneli kişi açığı üzerinden tek katılım sınırı uygulayan eski hükümler bu kararla değiştirilmiştir.

**D08.** Geniş kapsamlı paket, uygun olduğu merkez/disiplinlerdeki açıkları mevcut kapatma sırasıyla karşılayabilir: önce geçmiş tüketilmiş açık, sonra gelecek rezervasyon açığı. Uygun hak seçiminde en erken bitiş, eşitlikte önce satın alma ve mevcut kararlı eşitlik çözümü korunur. Paket kapsamı uygunluk filtresidir.

**D09.** Seans başlangıcındaki limit kontrolü ve sonradan ödemenin geçmiş katılım/hakedişi değiştirmemesi korunur; kontrol artık ilgili merkez–disiplin kapsamındadır. Para borcu ile kredi açığı ayrı kavramlardır.

**Teknik aktarım durumu:** D01–D09 kapsamı şema, API, izin ve ortak tiplerde mevcuttur; Q-D01 etkinlik kapsamı/negatif kredi ve ortak hak akışı uygulanmıştır. İlk aktarım tarihindeki açık listesi güncel iş listesi değildir; bugün kalanlar docs/remaining-work.md ve kaynak bağlı kabul kayıtlarında izlenir.

## 15 Ekim 2026 — U01–U08 UUIDv7 standardı (kabul edildi)

Paket revizyonu: 2.2. D01–D09 disiplin kararları korunur. Bu bölüm önceki çelişen UUID üretim önerilerinin yerini alır.

**U01.** FtkSaaS tarafından üretilen bütün UUID değerleri için UUIDv7 zorunlu standarttır. Domain kayıtları, işlem/idempotency anahtarları, request/trace kimlikleri ve geçici teknik UUID değerleri bu kapsamdadır. UUIDv1/v4/v5 üretimi için önceki öneriler yürürlükte değildir; istisna yeni açık karar gerektirir.

**U02.** Domain kayıt kimlikleri varsayılan olarak backend tarafından üretilir. UUID üretmesi gereken istemci, test verisi, seed, worker, Edge veya diğer FtkSaaS bileşeni de UUIDv7 kullanır. Bu karar istemciye yeni kayıt oluşturma veya operasyon yetkisi vermez.

**U03.** Supabase Auth ve diğer dış sağlayıcıların ürettiği kimlikler aynen korunur; yeniden UUIDv7 yapılmaz. Üretim standardı ile dış kimlik kabulü ayrıdır. Mevcut UUID değerleri sırf sürümü farklı diye yeniden yazılmaz; FK ve dış referanslar bozulmaz.

**U04.** Aynı kişinin farklı organizasyonlardaki kişi kayıtları bağımsız UUIDv7 alır. E-posta/telefon/isimden deterministik kimlik türetilmez; disiplin kayıtları için de aynı üretim standardı geçerlidir.

**U05.** UUIDv7 RFC 9562 uyumlu, güvenli rastgelelik kullanan doğrulanmış üreticiyle üretilir; timestamp eklenmiş özel UUID algoritması yazılmaz. Seçilen Supabase/PostgreSQL ortamındaki yerleşik üretim desteği teknik kurulumda doğrulanır; yoksa denetlenmiş uyumlu üretici seçilir, v4 fallback yapılmaz. Üretici yoksa ilgili üretim açılmaz.

**U06.** UUIDv7 yaklaşık üretim zamanını açığa çıkarabilir. created_at, seans zamanı ve audit zamanı ayrı alanlardır; UUID kesin küresel işlem sırası, iş tarihi veya yetki kanıtı sayılmaz. Sıralama ve eşzamanlılık kuralları açık iş alanlarına dayanır.

**U07.** Davet, hesap erişimi ve benzeri bearer token değerleri UUID kimliği değildir; güvenli rastgele token standardı korunur. Tokenlar UUIDv7 ile değiştirilmez. operation_key UUIDv7 olsa da retry aynı anahtarı yeniden kullanır; her denemede yeni UUID üretmek idempotency kuralını bozar.

**U08.** PostgreSQL alan tipi uuid olarak kalır. UUIDv7 üretim standardı bütün dış UUID girişlerini v7 diye reddetmek anlamına gelmez. FtkSaaS üretimi olan alanlarla sağlayıcı kimliği alanlarının şema/DTO eşlemesi teknik sohbette tamamlanır; yetki ve tenant kontrolü UUID sürümünden bağımsız uygulanır.

**Güncel teknik durum:** UUIDv7 üretim politikası ortak tip, backend üreticisi ve migration/çalışma zamanı yollarına aktarılmıştır. PostgreSQL default üreticisinin kapalı olması doğrulanmış backend UUIDv7 üretimini yok saydırmaz; v4 fallback yoktur. İlk aktarım tarihinin kurulum bekleme notları tarihsel kayıttır. Güncel CI/hosted/production kabulü tek devirde ayrı izlenir.


## Q-D01 — 15 Ekim 2026 kabul edilen etkinlik kuralı

1. Etkinlik tek disiplinli, çok disiplinli veya disiplinsiz olabilir. Disiplin etiketleri tanıtım ve filtreleme içindir; tek başına paket kullanım yetkisi oluşturmaz.
2. Paketle katılımda ders/etkinlik uygunluğu ayrıca açıkça tanımlanır. Etkinliğin Salsa etiketi taşıması, Salsa paketini kendiliğinden geçerli yapmaz.
3. Tek disiplinli etkinlikte, etkinliğe uygun ve ilgili merkez/disiplini kapsayan dar paketler kullanılabilir. Etkinliğe uygun geniş paketler de mevcut kapsam kurallarına göre kullanılabilir.
4. Çok disiplinli veya disiplinsiz etkinlikte yalnız etkinliğe uygun merkezin tamamı (center_all_disciplines) veya organization_all kapsamlı paketler kullanılabilir. center_discipline ve organization_discipline kapsamları kullanılamaz.
5. Etkinliklerde negatif kredi kullanılmaz. Paketle katılımda yeterli kullanılabilir hak bulunmalıdır; aynı hak eşzamanlı işlemlerde ikinci kez kullanılamaz.
6. Manuel ödeme ve etkinliğe özel satış kuralları korunur. Bu karar tahsilat ile kredi üretimini birleştirmez ve yeni bir ödeme zorunluluğu tanımlamaz.
7. Organizasyon izolasyonu, merkez erişimi, kapasite, geçerlilik ve mevcut katılım/iptal/kapanış koşulları korunur. Geniş kapsamlı paket toplam ortak havuzunu kullanır; disiplin başına hak çoğaltılmaz.

Ürün kararı ve Q-D01 çalışma zamanı aktarımı kapalıdır; tam etkinlik kayıt/RPC ve ortak hak yarışlarının kaynak kanıtları tek devir ve ilgili CI’dadır. 11 raporu ilk aktarımın tarihsel snapshot’ıdır; güncel açık iş kaynağı değildir.


## Q-E01 — Kabul edilmiş etkinlik ödeme ve işletme iptali eki

## 1. Paketsiz, ücretli ve tam ödeme şartlı etkinlik

- Öğrenci adına etkinliğe bağlı ödeme hazırlık kaydı ve borç oluşturulur. Hazırlık kesin kayıt değildir ve kontenjan tutmaz.
- Merkez manuel tahsilatı özellikle bu borca bağlar. Başka borca dağıtılmış ödeme bu etkinliğin ödeme şartını karşılamaz.
- Kesin kayıt sırasında tam ödeme, kapasite ve mevcut diğer uygunluk koşulları yeniden kontrol edilir. Koşullar uygunsa kesin kayıt tamamlanır.
- Ödeme alınmış ancak kontenjan dolmuşsa kesin kayıt oluşmaz. Hazırlık kapatılır, borç ters kayıtla kaldırılır; ödenen tutar öğrenci alacağına dönüşür. Nakit iade veya başka borca mahsup ayrı ve açık işlemdir.
- Kısmi ödeme kesin kayıt oluşturmaz; ödeme geçmişi korunur.

## 2. İşletmenin etkinliği gerçekleşmeden tamamen iptali

- Etkinlik bedeli tamamen geri alınır. Katılımcının iadesiz koşulu bu işletme iptaline uygulanmaz.
- Etkinliğin kalan borcu kaldırılır; ödenmiş tutar öğrenci alacağına dönüşür. Otomatik nakit iade yapılmaz.
- Önceki iade ve borç indirimleri hesaba katılır; aynı tutar ikinci kez iade edilmez veya alacaklaştırılmaz.
- Başka borçlar değişmez. Mahsup ve nakit iade mevcut yetki, merkez, para birimi ve bakiye sınırlarıyla ayrı açık işlemlerdir.
- Paketle katılımda ayrılmış hak serbest bırakılır; ayrıca etkinlik bedeli kadar parasal alacak üretilmez.
- Bu karar başlamış veya kısmen gerçekleşmiş etkinlik için oransal hesap tanımlamaz. Böyle bir durum için varsayım yapılmaz; gereken ürün kararı ayrıca belirtilir.

| Etkinlik bedeli | Ödenen | Gerçekleşmeden işletme iptali |
|---|---:|---|
| 1.000 TL | 0 TL | 1.000 TL kalan borç kaldırılır. |
| 1.000 TL | 400 TL | 600 TL kalan borç kaldırılır; 400 TL öğrenci alacağı oluşur. |
| 1.000 TL | 1.000 TL | Kalan borç yoktur; 1.000 TL öğrenci alacağı oluşur. |

Örnekler önceki iade/indirim bulunmadığı varsayımıyladır.


Teknik karşılık: event_payment_preparations, mevcut debts/debt_allocations/debt_adjustments/student_credit_movements; güncel API/tipler 08 sözleşmesinde. Kanıt: reports/qe01-verification.json. Başlamış veya kısmen gerçekleşmiş etkinliğin parasal iptal hesabı bu kararda tanımlı değildir.

## Q-E02 — 16 Ekim 2026 son kabul (önceki çelişen hükümlerin yerine)

**E02-01.** Katılımcının başlama sonrası kendi kaydını iptali/ayrılması parasal iade, borç indirimi veya öğrenci alacağı üretmez. Mevcut paket iptal koşulları aynen korunur.

**E02-02.** Merkez iptali her aşamada etkinliğe bağlı ücret yükümlülüğünü tamamen kaldırır; kalan borç sıfır, tahsilatın daha önce alacaklaştırılmamış tamamı öğrenci alacağıdır. Nakit iade/mahsup ayrı açık yetkili işlem; otomatik nakit çıkışı yok.

**E02-03.** Merkez iptali tüm ayrılmış hakları serbest bırakır, tüketilmiş hakları previous_id bağlı ters hareketle tamamen geri verir; kısmi tüketim ve paket hakkı için parasal alacak yok.

**E02-04.** Önceki alacak/iade/mahsup/hak dönüşü tekrar üretilmez. Yalnız iptal edilen etkinliğe bağlı kayıtlar; başka borç/geçmiş değişmez. Önizleme+apply sürüm/finans bağımlılıkları, canlı yetki ve tek transaction audit/outbox/receipt ile korunur.

**E02-05.** Etkinlik fiilî başlangıç kaydı/düzeltmesi güncel runtime’da vardır; saat geçmesi tek başına gerçekleşme değildir. Ders anlaşmasının başlangıçta sabitlenmesi DS teknik teslimidir. Merkez iptalinin aşamadan bağımsız sonucu bu tanıma ihtiyaç duymaz; mevcut occurred/attendance evidence korunur.

Teknik aktarım ve test durumu: docs/decisions/Q-E02.md ve reports/qe02-verification.json. Tarihsel test sayıları bu değişikliğin kanıtı değildir.


## Q-E03 — Planlanan başlangıç ve iptalin parasal sınırı · 16 Ekim 2026

**E03-01.** Katılımcı iptalinin parasal sınırı planlanan başlangıçtır. Başlangıç anı dahil sonrasında iade, borç indirimi veya öğrenci alacağı oluşmaz. Öncesindeki iptaller mevcut kabul edilmiş koşullara tabidir.

**E03-02.** Fiilî başlangıcın gecikmesi, sonradan kaydı veya düzeltmesi tamamlanmış katılımcı iptalini yeniden sınıflandırmaz; finansal yeniden hesaplama yapılmaz. Plan 21.00, iptal 21.15, fiilî başlangıç 21.30 başlangıç sonrası iptaldir.

**E03-03.** Planlanan saatin gelmesi tek başına yoklama, hak tüketimi, gerçekleşme veya hakediş oluşturmaz. Katılımcı paket iptal koşulları korunur.

**E03-04.** Merkez iptalinde Q-E02 aynen geçerlidir; ertesi gün kaydı veya aşama tam borç kaldırma ve bağlı para/hak dönüşlerini değiştirmez.

**E03-05.** Başarılı katılımcı iptalinde backend karar zamanı, o andaki planlanan başlangıç ve parasal sınıflandırma participant_cancellation kaydında atomik sabitlenir. Önceki kayıtlara zaman kanıtı uydurulmaz; eski ve merkez iptallerinde alan null kalabilir. İstemci zaman veya sınıflandırma gönderemez.


## Fiilî başlangıç kayıt/düzeltme aktarımı

**AS-01.** Merkez yöneticisi fiilî başlangıcı expected_version ile kaydeder/düzeltir; aktör ve kayıt zamanı backend, gerçek zaman Instant olarak açık girilir. Gelecek fiilî başlangıç reddedilir. İlk kayıt bir kez; düzeltme gerekçeli audit diff ile geçmişi korur, yanlış bilginin kaldırılması null düzeltmesiyle mümkündür.

**AS-02.** Bu kayıt yalnız operasyonel kanıttır; draft kabul edilmez, published/occurred/cancelled durumları değişmeden korunur. Katılımcı iptalinin Q-E03 parasal sınıflandırması, Q-E02 merkez hesaplaşması, yoklama, hak ve hakediş kendiliğinden değişmez.

**AS-03.** İptalden sonra geriye dönük kayıt/düzeltme mümkündür; iptal yeniden açılmaz. Etkinlik sürümü artar; eski önizleme geçersizleşir. event_get mevcut actual_started_at değerini; yönetici/organizasyon okuyucusuna append-only actual_start_history geçmişini döndürür.

Teknik kanıt: docs/actual-start-handover.md, PR son commit CI. Bu aktarım kısmi gerçekleşmeye bağlı yeni parasal veya hak kuralı üretmez.


## Program/seans teknik aktarımı — 17 Ekim 2026

Yeni ürün kuralı eklemeden mevcut program/saat/kaynak/kapasite/görev kuralları sonlu materialize edilmiş oluşumlara aktarılır. Ayrıntılı DTO, bağımlılık, miras/override ve hata davranışı [program/seans devrindedir](../program-session-handover.md). Yerel tarihler [başlangıç,bitiş), DST çift saatinde açık date/offset_minutes; gap reddi. this_and_future aynı programın gelecekteki planned/open oluşumlarını kapsar; geçmiş/sonuçlanmış korunur. Mevcut rezervasyon/hak kimliği kapasite indirimiyle iptal edilmez; saat değişikliği mevcut sabit hakkı geçersiz kılıyorsa transaction reddedilir. DS hedefi: Starter kapanışı/hak tüketimi anlaşmasız ve hakedişsizdir; Pro/Business ücretli görev açık anlaşma gerektirir. Starter’ın gereksiz anlaşma bağımlılığı giderildi. Ücretli anlaşma sürüm/başlangıç/hakediş motoru ve ücretli finansal kapanış ayrı açık teslimdir.

Sınıf atama güncellemesi hedef atama satır sürümünü, seans kapasite/görev güncellemesi seans sürümünü ister. Inactive açık görev kaldırmasıdır; sınıf varsayılanı açık oluşum override'ını geri getirmez. Önizleme dependency değişimi PREVIEW_STALE, komut sürüm yarışı VERSION_CONFLICT, kaynak/uygunluk çakışması RESOURCE_CONFLICT, eksik yapılandırma POLICY_NOT_CONFIGURED üretir. Yetki geri alınması receipt replay öncesinde denetlenir. İptal/yerine seans/bekleme/yoklama/paket seçimi bu aktarımın kapsamı değildir.

## Son hesaplaşma revizyonu — DS-2026-10-17

[Yetki ve iki taraflı kesinleştirme kararı](../decisions/DS-2026-10-17-settlement-revision.md) geçerlidir. Owner → OM devretme izni → belirli merkez CM hesaplaşma grantı zinciri uygulanmıştır; Owner CM'ye doğrudan da grant verebilir. OM/CM rolü ve Owner'ın grant yönetimi tek başına merkez finansal operasyon yetkisi değildir. CM yetki devredemez.

A'nın açık yetkili CM'si gerçekleşen ödeme veya önerilen mahsup başvurusu açar; bakiye değişmez. B merkezinde ayrı doğrulanmış güncel CM rolü ve açık hesaplaşma yetkisi olan kişi (başlatanla aynı hesap olabilir) onayı kayıt, seçili bakiye, request, audit/outbox/receipt'i atomik kesinleştirir. Gerekçeli ret bakiye değiştirmez, A'ya uygulama içi gider. Ayrı OM ödeme/mahsup kayıt aşaması yoktur; onay banka transferi değildir. Kısmi, aynı para birimli karşılıklı mahsup ve geçmişi koruyan bağlı düzeltme aynı başvuru/onay zincirindedir. İlgili sürüm değişimi yeni onay ister, alakasız dersler stale yapmaz. Farklı kişi/hesap veya kendi başvurusunu onaylama yasağı yoktur. A’da başvuru ve dondurulmuş B merkezinde onay yetkisi ayrı aranır; istemci center seçimi yetki değildir. Audit her adımın hesap/merkez/CM rol/grant kapsamını kaydeder. Aynı hesap kullanımı çift kapama/sürüm/yarış korumasını aşmaz; receipt replay ve commit dahil canlı yetki aranır.

DS-OPEN-01 karar düzeyinde kapalıdır; hesaplaşma runtime aktarımı uygulanmıştır. [Son merkez yetki düzeltmesi](../decisions/DS-2026-10-17-settlement-center-scope.md) farklı hesap şartını kaldırır; DS-OPEN-02 karar düzeyinde kapalıdır, ayrı istisna/fallback yolu yoktur. Yeni idari grant/read/version/audit scope DTO’ları ve 38 gerçek kabul senaryosu 08’de izlenir: vaka bazlı kanıt durumu makine sözleşmesindedir; [hesaplaşma devri](../settlement-handover.md) ve son head temiz CI gerçek kabulü ayrıca belirler. Main koruması ayrı yönetici işidir. Merge için son açık kullanıcı yetkisi geçerlidir; production dağıtım yetkisi yoktur.

## Starter yoklama/koruma runtime aktarımı

[Starter devri](../starter-attendance-protection-handover.md) kabul edilmiş kararları değiştirmeden dar runtime kapsamını belirtir. Starter F14 kapanışı ve bağlı düzeltme hak hareketi + audit/outbox/receipt ile atomiktir; hakediş üretmez. Ücretli finansal kapanış ve bağlı hakediş düzeltmesi PR #15 ile uygulanmıştır. Koruma yalnız yeni olumsuz etkiye bağlıdır; bağımsız engelleri veya yeni rezervasyon koşullarını kaldırmaz. Taslak başlangıç kanıtı değildir; başlangıç ve belge tüketicileri P01–P05 ile uygulandı; diğer tüketici/kabul açıkları güncel kuyruktadır. 198 işlem/89 canlı/109 contract-only bu Starter tesliminin tarihsel sayısıdır; güncel envanter 199/118/81 ve 34 migration’dır. İşlem sayısı özellik tamamlama oranı değildir.

## Eğitmen anlaşması/hakediş teknik aktarımı

Kabul edilmiş ücret kuralları immutable zincir, açık fiilî başlangıç kimlik snapshot'ı ve ücretli kapanışa aktarılmıştır. Yeni ürün ücreti/politika değeri türetilmedi. CM yayımlar; canlı görevlendirilmiş eğitmen/CM gerçek başlangıcı açıkça kaydeder. Kapanış gerçekleşme ve fiilî görev beyanını ister; saat tek başına hakediş değildir. Gerekçeli düzeltme sabit eski koşuldan bağlı fark üretir, ödemeyi silmez. Uygulama/kabul sınırları: [güncel devir](../instructor-earnings-handover.md).

## P01-A teknik okuma aktarımı — 19 Ekim 2026

Katalog ürün sürümü rezervasyon kaynak satışı değildir. products_list_v1 etkin son katalog sürümünü canlı yetkili merkez kapsamında sayfalar. entitlements_get_v1 optional session_id/booking_mode ile mevcut lesson_scope_matches ve available_for kurallarına göre uygun satın alınmış kaynak satışlarını okur; hak veya yer ayırmaz. include_timed_products/include_timed_rights açık seçimi F16 gerektirir; varsayılan kredili projeksiyondur. Geçerlilik ve en erken bitiş/satın alma/id sırası değişmez. Kesin kayıt guardları yazma anında yeniden çalışır. P01 talep/bekleme/worker kabulü bu okuma dilimiyle tamamlanmaz. DTO ve sınırlar: docs/p01-handover.md.

## P01-B talep akışı teknik aktarımı — 19 Ekim 2026

Talep/alternatif niyettir; yer, kaynak veya hak ayırmaz. Alternatif seçimi merkez onayı değildir. Altı komut açık center_id; create dışındakiler lesson_request_id/expected_version ister. management_state_get_v1 aynı işlem selector'ıyla ebeveyn/alternatif sürümünü canlı kapsamda okur. Kesin onay var olan session_create/reservation_create guardlarını yeniden çalıştırır; mevcut yayımlanmış rezervasyon belge kabulünü de tüketir. Geç hata tüm talep/seans/rezervasyon/hak ve iç receipt/audit sonuçlarını atomik geri alır. Belge API'leri P05/PR37, bekleme/teklif/worker P01/PR22 ile kabul edildi; hosted worker işletimi ayrı açıktır. Sayısal expiry politikası eklenmedi. Uygulama ve runtime kabul sınırları docs/p01-handover.md içindedir.

## P01-C teknik aktarımı — bekleme ve worker

Bekleme niyeti yer/hak ayırmaz; uygun kategori içinde FIFO joined_at/id, toplam/kategori boşluğu ve aktif rezervasyon+geçerli teklif ortak kapasitesi korunur. Kabul held seat'i aynı transaction'da guarded rezervasyona dönüştürür; geç hata teklif süresini uzatmaz/bitirmez. Ret/expiry kapanmış entry sonrasında yeniden giriş yeni sıradır. İptal durumu teklifleri ve waiting-only entry'leri kapatır. Hedef waitlist_offer_minutes FD06 gereği açık yapılandırmadır; geçmiş runtime30dk fallback yeni organizasyon defaultu değildir. Mevcut kulüp 3600 sn korunur; süre kayıt kapanışı/seans başlangıcını aşmaz. Worker insan yetkisinden bağımsız DB rol+org bağında, değişmez iş/op/target, lease ve bounded retry ile yürür. Request expiry kayıtlı son tarih veya geçerli gelecek alternatifi kalmamış başlangıç üzerinden; keyfi TTL/otomatik katılım yoktur. Uygulama/runtime/production işletim sınırları docs/p01-handover.md içindedir.

## P01 son pencere/merkez teknik aktarımı

Ayrı request_window, talep create/alternatif offer/accept sırasında etkin org/merkez politikasından tüketilir. Açılış dahil/kapanış hariç; eksik yapılandırma POLICY_NOT_CONFIGURED. Kabul edilmiş yönetici süre dışı yetkisinin teknik isteği window_exception:true + nonempty reason, politika manager_exception:true ve canlı CM kontrolüdür; gerekçe audit'e yazılır. İşaretli istekte CM receipt replay öncesi de denetlenir; otomatik CM bypass yoktur. Worker yeni teklif discovery ve executor/replay'inde center_accessible uygular; kapalı veya plan dışı merkezde hold üretmez, expiry temizliği engellenmez. Kaynak/runtime kabul sınırları docs/p01-handover.md içindedir.



### P02 geliştirme aktarımı — 20 Ekim 2026

P02 PR #28 main cc4878d kaynağında15 API ve aynı main39461804543 kabulüyle tamamlandı. `entitlements_get_v1` account sürümü/id, satış sürümü/durumu ve freeze kayıtlarını sağlar. `freeze_end_preview_v1` gerekçe ister. `sale_change_preview_v1` bütün gelecek rezervasyonların açık `keep_reservation_ids` ve `cancel_reservation_ids` seçimini, gerekçeyi ve isteğe bağlı açık `offset_minor` tutarını alır. Yeni ürüne uygun olmayan seçili kayıt blocker üretir; aktif gelecek etkinlik kaydı ayrı açık iptal edilmeden ürün değişimi tamamlanmaz. Önizlemede gerçek satış/hak yazarının rollback-only simülasyonu çalışır; kalıcı satış/borç/receipt/katılım üretmez. `Preview.sale_lifecycle` açık tarihler, boşluk/örtüşme ve dondurulmuş iade hesabını gösterir. Sonlandırma ve hak düzeltme otomatik rezervasyon/para işlemi değildir. P03 genel iade uygulaması private.p02_sale_settlements ve bağlı borç/alacak kayıtlarını yeniden alacak üretmemek için tüketmelidir.

## P03 uygulama aktarımı — geliştirme kabulü doğrulandı

P03 kaynak kabulü [00 devirde](00-FtkSaaS-yeni-sohbet-devir.md); işlem tüketimi [P03 devrindedir](../p03-handover.md).

CashCorrection.amount_minor yeni toplam değil, direction yönünde açık farktır. Artış özgün tahsilat borç kapsamını korur; azalış kaynak alacağı/dağıtımlarını bağlı hareketle geri alır. Harcanmış alacak silinemez. Kalan borç=max(0,net−gross_paid+claimed); alacağa taşınmış ödeme ikinci kez borç ödeme sayılmaz. Alacak geri alımı ilgili allocation azalışını aşamaz. Ters tahsisler her pozitif kaynak satırının açık kalanına kadar deterministic bölünür; previous_id tam o kaynağı gösterir. Ters debt/earning allocation SignedMoney, API bakiye toplamları nonnegative Money kalır. Tam finans geçmişi orgreader/CM/self kapsamındadır; finance.collect personel grantı tam geçmiş vermez. Paket iadesi nakit/hak/rezervasyon işlemi değildir; önizlemede borç ve öğrenci alacağı ayrı gösterilir. Eğitmen correction sonucu kök payment ID ve aggregate version döndürür; yeni fact related içindedir. Önceki fact kayıtları immutable kalır.

## P06 teknik uygulama — PR38/main006ad36 kabulü tamamlandı

Rapor okumaları ve CSV dışa aktarımı aynı yetkili tam sonuç projeksiyonunu kullanır. Toplamlar bütün filtreli sonuçtan, para birimi ve metrik ayrı hesaplanır. Sayfa kursörü aktör/filtre/sıra/tam sonuç hash'ine bağlıdır; değişen projeksiyon VERSION_CONFLICT verir. Desteklenen sıra created_at_asc'dir; rapor grupları metrik/merkez/kişi/para birimi sırasında sunulur. Aralık yarı açık, en çok366 gündür. Aktif çalışma saatleri ve istisnalar kaynak kullanım paydasını belirler. Gerçekleşmiş seans dolulukta kalır. Business tek merkez seçiminde karşı merkezli hareketin yalnız seçilen tarafı gösterilir; iki taraf seçilirse outgoing/incoming metrikleri ayrı kalır.

Import özel izninin makine adı import.execute'dur; ürün kararındaki merkez kapsamlı imports.write yetkisinin teknik eşlemesidir. people.write/person.manage yeterli değildir. CSV checksum/UTF-8/yapı/eşleme Edge'de doğrulanır; satır hataları güvenli kodla görünürdür. Mevcut kişi yalnız person_ref ile seçilir; e-posta otomatik birleştirme yapmaz. Yeni kişiler oturum/hesap/davet üretmez. Başarılı org/source_namespace/source_key kalıcı tekilleştirilir; değişen payload aynı kaynak anahtarında reddedilir. Önizleme işinin kişi/hak/borç/nakit etkisi yoktur; canlı izin ve bağımlılığa bağlı onay uygulama kuyruğunu açar. Satır kendi atomik alt işlemiyle uygulanır; geç audit/receipt hatası bütün batch'i geri alır.

opening_credit_value_minor özgün tam paket net değeridir; kalan kredi miktarının fiyatı veya tahsilat değildir. Kalan miktar özgün paket miktarını aşamaz; açılış borcu ayrıca açıkça verilir. Geçmiş tüketim yeniden yaratılmaz. Açılış kredi importunda desteklenen iade yöntemleri none/credit_ratio; kullanılan birim fiyatı veya zaman oranı geçmişi eksikse POLICY_NOT_CONFIGURED verilir. Kısmi kalan kredi için özgün tutar paket kredisine tam bölünmüyorsa eski kuruş dilimleri tahmin edilmez, satır POLICY_NOT_CONFIGURED verir. Mevcut uygun negatif kredi açıkları kabul edilmiş satış kuralıyla geçmiş tüketim önce, gelecek rezervasyon sonra kapatılır; eski yoklama/hakediş snapshot'ları değişmez.

Rapor dosyası private DB byte nesnesidir (core.files + private.p06_export_files), Storage public linki değildir.7 gün sonra indirme kapanır; her authenticated Edge POST güncel özgün rapor/merkez/alan/plan yetkisini kontrol eder. Upload bucket'ı özel,2MiB teknik tavanlı CSV'dir; tenant limitleri private.p06_configuration'da açık kurulum değerleri ister.5000 satır/16MiB export teknik tavanları iş/ücret politikası değildir. Büyük sonuç kesilmez; belirlenmiş byte sınırını aşarsa iş açık hata verir.

İşlem/önizleme kurtarma, bu migration'dan sonra yakalanan özgün yetki bağlamına dayanır. Eski kayıtta bağlam yoksa fail-closed NOT_FOUND; aynı hesapta olmak tek başına sonuç yetkisi değildir. Önizleme tokenı yalnız private,15 dakika süreli kurtarma bağlamında bulunur; audit diff kapalı güvenli alan listesidir. Worker dedicated LOGIN + org binding, claim/60sn lease, en çok3 art arda başarısız deneme ve25 satırlık batch kullanır. Hosted zamanlayıcı ve kesinti işletim kabulü OPS-W01 olarak ayrıca gereklidir.

<a id="ayarlar-sozlesmesi-ve-davranis-sprinti"></a>

## Ayarlar sözleşmesi ve davranış sprinti

24 Ekim 2026 davranış sprinti kapanışı. Bu bölüm dört kapsamın tek settings sözleşmesidir; Word v0.1 inceleme taslağı bundan sonra ayrı otorite değildir. Kaynak API/belge tabanı: `702063807b0a0d09f559f070ffde1b1ae3e7563b`; son runtime tam kabulü `4cfc9a55ca8ff8ccf723d91d98abe33e47311d54`. Davranış kararı, callable API, native sağlayıcı desteği ve işletim kabulü ayrı durumlardır. 200 mevcut endpoint'in tamamlanması yeni ayar alanlarının uygulanmış olduğu anlamına gelmez.

### Durumların anlamı

- **Kabul edildi:** Kullanıcının açık kararı; aşağıdaki 69 S/M/O/P grubunun davranışı kesinleşti; ilk frontend alt alanları FD01–FD12 ile seçildi; kapsam dışı seçenekler ve teknik backend alanları ayrıca ayrıdır. API/DTO/istemci desteği ayrıca eşlenecek.
- **Kabul edilmiş tasarım kuralı:** Sözleşme incelemesinde kabul edilen koruma/analiz gereksinimi; seçenek içeren ayrıntılar ayrıca kararlaştırılır.
- **Aday:** Word U/C/O/P kataloğunda yer alıp 69 kabul grubunda seçilmeyen alt seçenek veya alternatif. Özellik veya sağlayıcı geliştirme taahhüdü değildir.
- **Açık:** Varsayılan, sağlayıcı, alan veya uygulama seçimi henüz sonuçlanmadı. Sayısal değer veya davranış uydurulmaz.
- **Mevcut API:** Yalnız 08 makine sözleşmesi, implemented.json ve endpoint envanterinde yayımlanmış 200 operasyon. Ayrı yerel settings taslağındaki 208 operasyon/60. migration yayımlanmadı; kullanılmaz.

### Native sağlayıcı önceliği — 26 Ekim son karar

Supabase Auth ve yerleşik Turnstile entegrasyonu kayıt/giriş/kurtarma ve native güvenlik yaşam döngüsünün ana yoludur. Native davranış belirgin bir güvenlik açığı veya bağlayıcı ürün gereksinimini karşılamama durumu oluşturmuyorsa aynı işi tekrar eden function/gateway veya sağlayıcı iç şemasına/sorgu sırasına bağlı özel bakım alınmaz. İstisna somut risk ve dar zorunlu gereksinimle açıklanır; sırf daha katı göründüğü için ek katman eklenmez. Bu tercih canlı oturum doğrulamasını, zorunlu MFA'yı, tenant/rol/yetki izolasyonunu veya mevcut full/main clean assertionlarını kaldırmaz. Pazarlama izni ile güvenlik iletişimi ayrımı korunur.

### Kabul edilmiş kullanıcı davranışları

| Grup | Durum | Bağlayıcı davranış |
|---|---|---|
| S01 Profil | Kabul edildi | Görünen ad hesap genelindedir; organizasyonun ad/soyad veya geçmiş belge alanı yerine geçmez. Tercih edilen hitap isteğe bağlı ve kaldırılabilir. Fotoğraf yüklenir/değiştirilir/kaldırılır; platform dosya sınırları korunur. Yükleme diğer katılımcılara görünürlük izni vermez. |
| S02 Kimlik ve iletişim | Kabul edildi | Ad/soyad kaydetmeyle güncellenir. Yeni e-posta/telefon doğrulanana kadar eski doğrulanmış değer geçerlidir; bekleyen değer yayılmaz. Aynı alandaki yeni talep eski bekleyen talebi/kodu geçersizleştirir; e-posta ve telefon ayrı izlenir. Giriş/kurtarma sağlayan iletişim başka hesaba bağlıysa ret; otomatik hesap/CRM birleştirme yoktur. Aktif güvenli hesap–kişi bağı güncel ad/doğrulanmış iletişim kaynağıdır; org onayı aranmaz. Kopya zorunluysa sürümlü yayılma/tekrar denenir, eksik yayılma tamamlandı gösterilmez. Eski/yeni değer denetimi korunur. Tamamlanan iletişim değişikliği eski doğrulanmış kanala güvenlik bildirimi üretir; teslimat hatası değişikliği geri almaz. |
| S03 Hesap–kişi bağlantısı | Kabul edildi | Hesapsız kişi güvenli davet/doğrulamayla mevcut kişi kaydına bağlanır; ikinci kişi yaratılmaz. Güncel hesap bilgisi esas alınır, önceki bilgiler geçmişte kalır. İç not/öğrenci durumu/borç/hak/görev org içinde kalır. Bağ kaldırılınca org erişimi ve gelecekteki otomatik yayılma durur; kişi/abone/iş geçmişi silinmez. Yeniden bağlanma yeni güvenli işlem ister; aynı kişi doğrulanırsa numara korunur, eski yetkiler canlanmaz. Birden fazla aday kayıt varsa yetkili inceleme/birleştirme gerekir. Bağ kaldırma, üyelik sonlandırma ve hesap silme ayrıdır. |
| S04 Şifre ve kurtarma | Kabul edildi | Şifresiz giriş hesabı desteklenen güvenli yeniden doğrulama sonrası şifre ekleyebilir. Şifre değişiminde mevcut oturum korunur, diğerleri kapatılır. Kurtarma yalnız mevcut doğrulanmış kanala tek kullanımlık/süreli kanıtla gider; yanıt hesabın varlığını açıklamaz. 26 Ekim son kullanıcı kararı: native Supabase parola sıfırlama davranışı esas alınır; yeni parola kaydedilince mevcut kurtarma oturumu korunur, diğer native oturumlar kapatılır. Kurtarma oturumunu ayrıca kapatma veya zorunlu yeniden giriş için sağlayıcının iç SQL davranışına bağlı özel trigger/ek tamamlama işlemi kurulmaz. Canlı oturum, MFA, tenant/rol/yetki kontrolleri korunur. Native Auth kendi sağlayıcı limitlerini kullanır: giriş/kayıt30/5dk/IP, token doğrulama30/5dk/IP, refresh150/5dk/IP ve aynı kullanıcıya SMTP minimum60sn. Önceki15 dakika/IP10/e-posta3 yalnız eski uyumluluk kurtarma endpoint'inin sayacıdır; native garanti değildir. Bu sayıları kopyalamak için yeni auth gateway kurulmaz. Native Auth için Turnstile zorunluluğu yoktur; hesapsız public başvuru koruması ayrı kalır. Diğer süre/deneme değerleri seçilmedikçe uydurulmaz. Tamamlanan işlem pazarlamadan bağımsız güvenlik bildirimi üretir; dış teslimat ayrı kanıttır. |
| S05 Giriş yöntemleri ve MFA | Kabul edildi; son giriş seçimi aşağıda kesin | Eklemede mevcut hesap yeniden doğrulanır ve yeni sağlayıcı hesabı doğrulanır; aynı e-posta bağlama kanıtı değildir. Başka hesaba bağlı yöntem reddedilir. Son kullanılabilir giriş yöntemi kaldırılamaz. Desteklenirse passkey ekle/adlandır/kaldır; MFA kurulum kanıtıyla etkinleşir, değiştirme/kaldırma mevcut güvenlik doğrulamasını ister. Platform zorunluluğu aşılamaz; orgun rol şartı diğer orglara kendiliğinden taşınmaz. Desteklenirse kurtarma kodları tek kullanımlıktır; yenilemede eskiler geçersiz, sırlar log/audit dışıdır. Erişim kaybında ayrı kurtarma; org yöneticisi global güvenliği sıfırlayamaz. Son karar: e-posta/parola ve Google kayıt/giriş; Apple ve Instagram login/bağlama kapsam dışı, passkey erteli, ilk MFA doğrulayıcı kodu. Provider uygulama kabulü ayrı. |
| S06 Cihaz ve oturum | Kabul edildi | Mevcut oturum, başlangıç/son etkinlik ve bilinen cihaz/tarayıcı gösterilir; tahmin kesinlik gibi sunulmaz. Etiket yetki/kanıt değildir. Seçili oturum ve yenilemesi iptal edilir, eski token sonraki korumalı istekte reddedilir. Diğer tüm oturumları kapatmada yeniden doğrulama gerekir, mevcut oturum korunur. Bu cihazdan çıkış sunucu oturumunu ve yerel hesap verisi/oturum push bağını temizler; diğer hesap/cihaz etkilenmez. Güvenilen cihaz kaldırma aktif oturum kapatmadan ayrıdır; birlikte seçilebilir. Kullanıcı yalnız kendisininkini yönetir; org yöneticisi yalnız kendi org erişimini kaldırır. Token/sır içermeyen denetim tutulur. |
| S07 Dil bölge saat | Kabul edildi | Desteklenen dil veya cihaz dili seçilir; desteklenmeyende platform fallback dili kullanılır, somut dil listesi açık. Bölgesel tarih/sayı/12–24 saat/hafta başlangıcı desteklendiği ölçüde ayrı seçilir. Otomatik saat dilimi her cihazdan, manuel tercih hesaptan gelir. Merkez/kullanıcı saati farklıysa ikisi açık ayırt edilir; gün değişimi ve DST doğru gösterilir. Görünüm iş zamanını, iptal sınırını, paket/finans tarihini veya para birimi/tutarını değiştirmez. Manuel tercihler cihazlara yansır; otomatik tercihler cihazda çözülür. |
| S08 Tema ve erişilebilirlik | Kabul edildi | Açık/koyu/sistem teması; cihaz yazı ölçeği ve uygulama ölçeği, büyütmede içerik/düğmelerin korunması; yüksek kontrast, renk dışı durum anlatımı ve azaltılmış hareket. Ses/titreşim cihaz bazında ve OS izinleri içindedir. Ekran okuyucu/klavye/odak/etiket temel davranıştır. Tema/kontrast/uygulama yazı ölçeği hesapta, sistemden alınan tercihler cihazdadır. Görünüm sıfırlaması bildirim/pazarlama/reklam/ölçüm seçimini değiştirmez. |
| S09 Başlangıç ve bağlam | Kabul edildi | Son bağlam veya sabit başlangıç seçilir. Sabit org/merkez/disiplin ve yetkili başlangıç ekranı hesapta; son kullanılan bağlam cihazda tutulur. Üst seçim uyumsuz alt seçimi temizler. Görünüm/rol seçimi yetki vermez. Erişim kaybında veri açıklamayan yeniden seçim; yetkili deep link başlangıç tercihini değiştirmez. Çıkış cihaz son bağlamını temizler; grup sıfırlaması diğer tercihlere/yetkilere dokunmaz. |
| S10 Liste ekran ve takvim | Kabul edildi | Desteklenen liste/kart/yoğunluk/sütun/sayfa boyutu ve ekran bazlı filtre/sıralama; takvim gün/hafta/ay/ajanda/hafta sonu/renk/görünür saat. Sayfalama teknik üst sınırı korunur. Filtreler gerektiğinde org bağlamına ayrılır; yetkisiz/eski alanlar çıkarılır. Görünüm dışında kalan kayıtlar silinmez/iptal olmaz, renk tek anlam taşıyıcısı değildir. Kayıtlı görünüm hesapta, anlık arama/açık kayıt/sayfa yereldir. Ekran sıfırlaması diğer tercih ve izinleri değiştirmez. API'de yetkisiz alanı döndürmek sütun gizleyerek meşrulaştırılmaz. |

Yukarıdaki ilk **10 kullanıcı grubu** 23 Ekim belge tabanında kayıtlıydı; sekiz grup sayımı eksikti. Devamındaki S11–S17 ve diğer kapsamların kabulü aşağıdaki 24 Ekim kapanışında birleştirilmiştir. Ürün davranışı istemci/API uygulama kabulü değildir.

### İnceleme önerilerinden kabul edilen tasarım kuralları

Kimlik değişiminde bekleyen/doğrulanmış değer, yarış ve çatışma açık durumlarla yönetilir. Bağlanma ve ayrılmada verinin kaynağı ve yayılma sınırı bellidir. Hesap/cihaz/işletim sistemi tercihi ayrı çözülür; çevrimdışı eski değer sunucudaki kapatmayı ezemez. Kullanıcının kapatması giriş, uygulama veya varsayılan güncellemesiyle geri açılmaz. Her bildirim olayı için kanal/zorunluluk/sessiz saat/özet/son kullanım matrisi hazırlanır; süresi dolmuş teklif sonradan gönderilmez. İleri tarihli ayar, iptal, plan düşüşü ve eski değere dönüş ayrı sürümlü davranış ister. Yüksek etkili banka/sağlayıcı/operatör/worker işlemlerinde ek güvenlik gereksinimi alan bazında belirlenir; FD11 ile ilk teslimde yeni genel ikinci-onay mekanizması eklenmemesi seçildi; mevcut özel onaylar korunur. Kullanıcı güvenlik geçmişi ve resetin ilk kapsamı FD03/FD11 ile seçildi; gerçek DTO ve uygulama eşlemesi ayrı.

### Son öncelik — beş kapsamda ekran ve API teslimi

Kullanıcının son talimatıyla kullanıcı–üye–merkez–org–platform ayar değiştirme ekranlarının alanları ve gerçek API'leri frontend'e teslim edilecektir. Kullanıcı global hesap, üye org person/relationship kaydı ve org bazlı self tercihleridir; altıncı grup/yeni hesap türü eklenmez. Backend alan/Request-Response/permission/sürüm/kabul paketini sağlar, frontend tasarım ve istemci uygulamasını yürütür. [Beş ekran kapsamı ve mevcut API matrisi](../claude-handover.md) bağlayıcı teslim listesidir.

SQL/Cron/worker teknik işletimi, DB yönetimi, migration/deployment yönetim ekranları ve benzeri altyapı ayarları ayrı backlog'a ertelenir. Platform ekranında uygulama kimliği/dil/marka katalogları, plan-fiyat-limit seçenekleri, desteklenen alan default/mirasları, hazır kanal/şablon/entegrasyon ve yönetim tercihleri önceliklidir. Erteleme normal uygulama verisinin güvenli kalıcılığını veya CI kapılarını kaldırmaz. 69 grup yeniden onaylatılmaz; yalnız gerçek belirsiz alan kararı sorulur. Yeni genel endpoint veya alan uydurulup mevcut gibi gösterilmez.

### 24 Ekim 2026 — davranış sprintinin kapanışı

Kullanıcı S11–S17, M01–M22, O01–O21 ve platform P01–P09 gruplarını tek tek onayladı; son P08/P09 birlikte onaylandı. **17 kullanıcı + 22 merkez + 21 organizasyon + 9 platform = 69 ana grup kabul edildi.** S01–S10 yukarıdaki hükümlerle korunur. Yeni ana grup açılmaz; FD01–FD12 açık frontend seçimleri de 25 Ekim kabulüyle kapandı. Sonraki iş API karşılıkları ve uygulama boşluklarını tek matriste tamamlamaktır. Bu kapanış runtime geliştirmesini veya yayımlanmamış yerel taslağın kullanımını başlatmaz.

**Kimlik alanları:** Buradaki S/M/O/P numaraları davranış sprintine aittir. Word kataloğundaki U/C/O/P aile numaralarıyla ve üretim kuyruğunun P01–P08 teslim numaralarıyla aynı kimlik değildir. Örneğin platform P08, reklam/CRM geliştirmelerinin tutulduğu üretim P08 değildir. Aşağıdaki tabloların kapsam başlığı numaranın namespace'idir.

#### Kullanıcı S11–S17 — kabul edilmiş devam grupları

| Grup | Kabul edilen seçenek ve davranış sınırı | Kapanış / kalan teknik iş |
|---|---|---|
| S11 Kişisel takvim bağlantısı | Kullanıcı/org özel salt okunur bağlantı; ders/etkinlik/görev türlerini seçme, kaldırma/yenileme. Yalnız yetkili kayıtlar, saat/yer/iptal değişiklikleri yansır; harici yenileme gecikebilir. Borç/ödeme/iç not/başka katılımcı iletişimi aktarılmaz. Yenileme eski bağlantıyı, org erişim kaybı ilgili bağlantıyı kapatır. Harici düzenleme rezervasyon/yoklama işlemi yapmaz. Önceden dışarı kopyalanmış veri silinmiş sayılamaz; harici hatırlatmalar bağımsız. | FD05/FD12 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| S12 Bildirim kanalları ve olaylar | Platform ve her org ayrı; güvenlik/işlem/hatırlatma/pazarlama ayrılır. Rezervasyon/talep, iptal/değişiklik/teklif, paket/hak/finans/belge olayları seçilebilir. Zorunlu in_app işlem bildirimi kapanmaz; bütün dış kanallar topluca zorunlu yapılmaz. Kanal gerçek destek, doğrulanmış iletişim ve cihaz iznine bağlıdır. Yeni cihaz/kanal kapatılmış tercihi açmaz. Alternatif kanalda da amaç/kanal izni gerekir; tercih iş kaydını değiştirmez. | FD04 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| S13 Hatırlatma sıklık ve sessiz saat | Ders/etkinlik/paket/ödeme hatırlatması org bazında ayrı. Desteklenen zamanlar, uygun olaylarda anlık/günlük/haftalık özet. Zaman duyarlı teklif/iptal/yakın değişiklik özete bırakılmaz. Sessiz saat hesap genelinde gün/aralık/timezone ve gece aşımı destekler; dış teslim ertelenir, in_app kayıt/okunmamış görünür. Güvenlik ve zaman duyarlı olay istisnaları açıklanır. Teslim öncesi güncellik denetimi; geçersiz/expired olay gönderilmez, tekrarlar birleştirilir. | FD04 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| S14 Pazarlama ilgi ve kişiselleştirme | Platform/her org ve kanal ayrı; kampanya işlem bildirimi olamaz. İlgi alanı düzenlenir/silinir, kayıt/satış/izin oluşturmaz. Geçmişten öneri ayrı açılır/kapanır; kapalıysa davranışa göre sıralama yok, açık filtreyle genel öneri olabilir. Reklam kişiselleştirme/takip/isteğe bağlı analitik üç ayrı varsayılan açık-kapatılabilir tercih; hukuki izin/teknik toplama kanıtı değildir. Kapatma yeni işlemlere ve teslim öncesi kuyruğa uygulanır; giriş/default güncellemesi yeniden açmaz. Geçmiş iş kayıtları silinmez veya yeni amaç yetkisi doğmaz. | FD04/FD05 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| S15 Görünürlük paylaşım ve izin geçmişi | Her org ayrı. Katılımcılara profil varsayılan kapalı; ad/fotoğraf ayrı seçim. Telefon/e-posta ayrı ve varsayılan kapalı. İlgili yetkili katılımcı kapsamı, herkese açık profil/arama motoru yayını değil. İş gereği yetkili personel erişimi ayrı; mesleki görev bilgisi kişisel iletişimi açmaz. İzin amaç/kapsam/kanal/tarih/metin sürümüyle görülür; geri çekme yeni değişmez kayıt. Amaçlar toplu onayda birleştirilmez. Kapatma sonraki erişimde uygulanır, uygulama eski görünür kopyaları temizler; dış kopyalar için silme garantisi yok. | FD05 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| S16 Veri talepleri ve hesap silme | Platform hesabı/org kayıtları ayrı kapsamlı veri kopyası; başkası/iç gizli not otomatik eklenmez. Talep/indirme hassas doğrulama, özel süreli iptal edilebilir dosya. Alındı/işleniyor/ek bilgi/tamamlandı/gerekçeli karşılanamadı ve kısmi sonuç ayrımı. Güncel kimlik önceki kabulden, tarihsel belge hatası bağlı düzeltmeden giderilir. Silme preview bağlantı/sahiplik/işler/korunan kategorileri gösterir; org silme değildir. Owner engeli çözülmeden silme/otomatik devir yok. İmha doğrulanmadan completed yok; geri döndürülemez aşamaya kadar iptal. Borç/iş geçmişi kendiliğinden yok olmaz; durum bildirimi pazarlamadan ayrı. | FD12 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| S17 Güvenlik geçmişi ve sıfırlama | Kendi giriş/oturum/iletişim/parola/yöntem/kurtarma hareketlerinde zaman/sonuç/bilinen cihaz; sırlar yok, geçmiş salt okunur. İlgili güvenlik akışına geçiş. Sıfırlama ekran/grup/cihaz/hesap kapsamı ve etki gösterimiyle; görünüm reset bildirim/pazarlama/reklam/izinleri değiştirmez. Genel reset kapatılmış izinleri açmaz. Cache temizliği sunucu verisini silmez; gönderilmemiş değişiklik kaybı açıklanır. Cihaz çıkışı yalnız ilgili hesap yerel veri/push bağını temizler. Rol/bağ/borç/hak/rezervasyon/güvenlik yöntemi resetlenmez. | FD03/FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |

#### Merkez M01–M22 — kabul edilmiş ayar grupları

Merkez yetkisi yalnız kendi canlı kapsamıdır. Organizasyonun zorunlu değeri ve platform güvenlik/plan sınırı aşılamaz. İşlem komutları genel ayar anahtarlarıyla ikame edilmez.

| Grup | Kabul edilen ayar alanları ve sınırlar | Kapanış / kalan teknik iş |
|---|---|---|
| M01 Kimlik iletişim konum | Ad/açıklama/işletme iletişimi/adres/harita/ulaşım ve alan bazında dış görünürlük. UUID/org bağı değişmez; kişisel hesap iletişimi ayrı. İletişim kaydı gönderim doğrulaması değildir. Adres değişimi mevcut seans konumunu veya geçmiş belgeyi sessiz değiştirmez; org zorunlu alanı kaldırılamaz. | FD08/FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M02 Saat dilimi ve iş takvimi | Merkez iş timezone'u kullanıcı görüntüsünden ayrı; çok aralıklı haftalık ve gece aşan çalışma, açık tatil/kapanış/özel saat. Resmî tatil otomatik kapanış değil; kaynak uygunluğunun yerine geçmez. Daraltma/kapanış etkilenen seansları gösterir, aykırılığa açık çözüm olmadan tamamlanmaz. İstisna varsa ayrı yetki/gerekçe; diğer kapıları aşmaz. Timezone değişiminde mevcut UTC/satış snapshotları korunur; gelecek tekrar düzenlemesi ayrı preview/onay. DST sessiz kaydırılmaz, geçmiş ücret/yoklama değişmez. | FD06 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M03 Oda kaynak kapasite | Oda kimlik/açıklama/konum/aktiflik, tek fiziksel oda kapasitesi ve seansın ayrı toplam/kategori kapasitesi, uygunluk ve istisna. Aynı fiziksel oda disiplin için çoğaltılmaz. Seans kontenjanı ayrıca ve oda maksimumu içinde. Oda değişimi seansları otomatik değiştirmez; maksimum düşüşünde çelişen gelecek seanslara açık çözüm gerekir. Pasifleştirmede taşıma/açık iptal, geçmiş korunur. Kaynak çakışması disiplin/sınıfla aşılamaz; oda değişimi rezervasyonu sessiz düşürmez. Dış etkinlik için sahte oda gerekmez. | 25 Ekim kapasite kararı/PR45 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M04 Sunulan disiplinler | Org disiplini etkinleştirme, yerel açıklama/görünürlük; org kimliği/adı değişmez ve ikinci disiplin yok. Etkinlik otomatik program/paket/görev/kayıt üretmez. Dış görünürlük ve sunum aktifliği ayrı. Pasifleştirmede seans/rezervasyon/talep/liste/paket etkisi açık çözülür, hak silinmez. Yeniden açma eski işleri/grantları canlandırmaz. | FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M05 Görevler ve izinler | Mevcut org kişisinden merkez/disiplin görev ve izin seçimi. Eğitmen/personel/login/operasyon ayrı; varsayılan sınıf görevi ile seans override ayrı. Starter anlaşmasız/hakedişsiz, ücretli Pro/Business anlaşmalı. Görev kaldırmada gelecek işler gösterilir; güvenlik erişimi hemen kesilebilir. Canlı geri alma, başka merkez/global hesap/geçmiş ücret silinmez. Hesaplaşma özel zincirden. | FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M06 Program seans varsayılanları | Disiplin/biçime göre süre/saat adımı/oda/kontenjan/görevli. Varsayılan zorunlu kural veya otomatik program değil; kaydetmeden gösterilir. Kapalı sınıf/dış katılım/rezervasyon ayrı. Başlangıç/tekrar/son sınır açık; mevcut 100 tekrar, süresiz geliştirme yok. Default değişimi mevcut programı değiştirmez; gelecek değişimi preview/onay, seans override korunur. Program gerçekleşme/hakediş/yoklama üretmez; iptal/yerine seans katılımcıyı otomatik taşımaz. | FD06 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M07 Rezervasyon talep bekleme | Açılış/kapanış ve izinli yönetici zaman istisnası, ayrı doğrudan/talep/kapalı sınıf akışı. Talep/alternatif yer tutmaz; kesin onayda canlı kapılar. Liste açık seçilir, mevcut kararlı sıra; keyfî/ücretli öne alma yok. Teklif süreli kapasite tutar, kabulde yeniden uygunluk; dolumda sıradaki uygun kişi. Liste kapamada mevcut liste/teklif sonucu seçilir, kesin rezervasyon korunur. Olumsuz politika etki/onay ve mevcut koruma; paket iptal/no-show snapshotı ezilmez. | FD06 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M08 Katılım borç negatif hak | Üst politika içinde borç engeli/kapsamı, ayrı merkez–disiplin negatif ders hakkı ve kişisel limit. Ayrılmış+tüketilmiş tek sayılır; event negatif yasak. Kesin rezervasyon koruma/onayı; yeni işlem güncel politika. Başlangıç uygunluğu sonradan ödeme ile yeniden yazılmaz. Tahsilat kredi üretmez; uygun yeni paket tüketilmiş sonra ayrılmış açığı kapatır. | FD07 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M09 Yoklama gerçekleşme | Başlat/işaretle/kapat/düzelt yetkileri görev kapsamıyla. Saat geçişi auto gerçekleşme/no-show değil; açık fiilî başlangıç, gerekçeli geçmiş ve gelecek zaman ret. Taslak tüketmez; kapanış atomik hak/rezervasyon/ücret. Sonuçlar ayrı, tüketim frozen satıştan; engelli katılım ücretli katılım sayılmaz. Starter/ücretli ayrımı, closure silinmez, bağlı düzeltme. | FD10 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M10 Paket fiyat satış | Paket kataloğu, hak/geçerlilik/kapsam, sürümlü koşullar; iptal/no-show/dondurma/uzatma/iade açık. Varsayılan belirsiz tarih yok. İndirim yetkili, liste/gerçek fiyat ayrı. Sipariş hak değildir; mevcut açık borçlu satış ayrı. Backdate gerekçeli/geçmiş tüketim üretmez. Yenileme linked bağımsız, değişim preview/onay; para/hak/rezervasyon komutları ayrı. | FD07 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M11 Tahsilat iade finans | Tahsilat/read/düzeltme/iade/mahsup ayrı yetkiler ve kişi/merkez/currency. Desteklenen ödeme yöntemleri; seçim banka entegrasyonu değil. Gerçek tutar/zaman/referans ve açık borç dağılımı. Fazla ödeme alacak, otomatik iade yok; bağlı düzeltme ve tekrar koruması. Eğitmen ödemesi ayrı, otomatik transfer/döviz dönüşümü yok. | FD07/FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M12 Anlaşma koşulları | Merkez/disiplin/biçim, açık sabit/kişi/yüzde/karma bileşen, paket özel/genel yerine geçme, tek seans sabiti ve tek salon kesintisi. Süreli/sınırsız temel öneri sabit; diğerleri açık seçim. Immutable sürüm/yürürlük, başlamış/kapanmış ücret korunur; açık gerçekleşme, bağlı fark düzeltmesi. A→B payı ayrı, Starter anlaşmasız. | FD07/FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M13 Etkinlik dış katılım | Event dersten ayrı; 0/1/çok disiplin ilişki hakkı tek başına vermez. Yer/saat/kayıt/kapasite/görünürlük, paket/ücretsiz/ücretli yol ayrı. Tam ödeme hazırlığı yer tutmaz; yoklama ders kredisi/ücret talimatı değil. Q-E03 planlanan parasal sınır, Q-E02 her aşama tam dönüş, event negatif yasak. Koşul değişimi mevcut kayıtları yeniden fiyatlandırmaz. | FD06/FD08 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M14 Bildirim hatırlatma | Tür, desteklenen zaman/kanal, izinli gönderici/yanıt adresi, şablon alanı, personel uyarı alıcısı, yönetim özeti ve hata sorumlusu. Kullanıcı amaç/kanal/sessiz saat aşılmaz, zorunlu olay kapanmaz. | FD04 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M15 Belge onay | İzinli şablon/yerel ek/kapsam/zorunluluk, yürürlük, yeniden onay, takip ve hatırlatma. Org zorunlu belge kapanmaz; yayımlanmış metin/geçmiş onay değişmez. Yeni gerekliliğin etkisi gösterilir, geçmiş onay üretilmez. | FD08 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M16 Dış görünürlük başvuru | Merkez yayını/tanıtım/görseller/bağlantı, alan görünürlüğü, başvuruya açık seçenekler, başvuru aç/kapat/metin, form alanı/zorunluluk, sorumlu ve kaynak. Görünürlük otomatik rezervasyon/deneme değil; güvenlik/izin alanı kaldırılamaz, pazarlama başvuru şartına birleştirilemez. | FD08/FD09 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M17 Otomasyon | Hazır otomasyon aç/kapat, kapsam, desteklenen zaman/koşul/eylem, sorumlu, duraklatma ve etki preview. Serbest SQL/kod/teknik worker ayarı yok. Durdurma yeni isteğe bağlı işleri engeller, çalışan iş ayrı gösterilir; yeniden açma geriye kör çalıştırmaz. Zorunlu sistem temizliği kapatılamaz. | FD10 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M18 Rapor export | Ortak şablon, yetkili filtre/sütun/gruplama/sıralama, paylaşım ve desteklenen format. Kişisel görünüm ayrı; paylaşım erişim vermez, çalıştır/indir canlı yetki. Teknik limit büyütülemez; otomatik zamanlama/dış gönderim açılmadı. | FD10 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M19 Import eşleme | Desteklenen tür için sütun şablonu, dosya/tarih/sayı biçimi, hedef merkez/disiplin, kaynak/tekilleştirme anahtarı, yetkili paylaşım ve sonuç sorumlusu. Her dosya preview/açık apply; boş alana borç/hak/ödeme/izin defaultu yok. İsim/telefon/e-posta benzerliği otomatik merge değil. | FD10 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M20 Miras sıfırlama | Desteklenen alanda orgdan al/yerel değer, etkin kaynak/kilit nedeni, mirasa dön ve grup reset/etki preview. Org değişimi mirası izler, izinli yerel değer korunur. Olumsuz etkiye koruma/onay; geçmiş/izinler resetlenmez. Eskiye dönüş yeni sürüm; plan geri dönüşü riskli özelliği sessiz açmaz. | FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M21 CRM | Yetkili sorumlu/atama kuralı, org izinli aşamalar/sıra, etiket, takip hatırlatması, kapanış nedeni, ortak görünüm. Aşama/etiket satış/öğrenci/izin oluşturmaz; atama erişim genişletmez. Kaldırmada açık yeniden eşleme, geçmiş korunur; ortak başvuru deposu bölünmez. | FD09 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| M22 Ayar yetkisi geçmiş | Grup bazlı gör/değiştir ve yalnız devredilebilir izinler, değişiklik alıcıları, yetkili geçmiş ve eski değere yeni sürümle dönüş. Yönetmek devretmek değildir, üst scope verilemez. Hassas reauth/ek onay kapatılamaz; sırlar gizli, rollback canlı kapılardan geçer. | FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |

#### Organizasyon O01–O21 — kabul edilmiş ayar grupları

Her alan ilgili organizasyon yetkisiyle yönetilir. Owner unvanı toplu merkez operasyon yetkisi değildir; kesin permission adları alan eşlemesinde belirlenir.

| Grup | Kabul edilen ayar alanları ve sınırlar | Kapanış / kalan teknik iş |
|---|---|---|
| O01 Kimlik iletişim | Görünen ad/logo/açıklama/marka, tanımlı hukuki-fatura alanları, kurumsal iletişim/web/destek ve dış görünürlük, merkez başlangıç değerleri. UUID/sahiplik değişmez; kişisel hesap ayrı; gönderim doğrulaması ayrı; yerel açık değer ve geçmiş belge ezilmez. | FD02/FD08 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O02 Ortak merkez politikaları | Desteklenen ortak default/zorunlu değer, yerel değişiklik izni, sayısal aralık, merkez şablonu/hedef merkez/etki preview. Kopyalama canlı mirastan ayrı; şablon güncellemesi eski merkezi değiştirmez. Yereli zorunluya çevirme etki/onay; geçmiş satış/anlaşma ve kesin rezervasyon korunur. | FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O03 Roller yetki devri | Devredilebilir izin şablonları, yeni görevde önerilen izinler, açık merkez kapsamı, davet/erişim ve ayar yönetimi, uyarı alıcıları. Şablon yeni rol/sınırsız yetki değil, güncellemesi mevcut izinleri sessiz değiştirmez; toplu apply etki/onay. Kendi yetkisini genişletme yok; platform/Owner ve hesaplaşma özel zinciri ayrı. | FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O04 Güvenlik | Desteklenen rol MFA şartı, daha sık hassas reauth, desteklenen işlem ek onayı, yetkili uyarı ve yürürlük/etki. Platform asgarisi gevşetilmez, org şartı başka orga taşınmaz; global parola/MFA/kod org yöneticisinde değil. A/B aynı hesap ayrı yetki kabulü genel ikinci onayla bozulmaz; güvenlik geçmişi topluca orga açılmaz. | FD03/FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O05 Disiplin kataloğu | Ad/açıklama/simge/renk/aktiflik, sunabilecek merkezler, dış görünürlük/sıra, yerel alan izni. Kimlik aynı, renk tek anlam değil; pasifleştirme hak/geçmiş silmez ve etkisi gösterilir. | FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O06 Dil bölge gösterim | Desteklenen varsayılan uygulama/dış sayfa/belge-bildirim dili ve fallback, ortak çıktı tarih/saat/sayı/hafta başlangıcı, yeni merkez için önerilen timezone. Kişisel ekran tercihi korunur; para/iş zamanı/mevcut merkez timezone/geçmiş belge değişmez. | FD01 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O07 Bildirim | Kurulu kanalların merkezlere açılması, doğrulanmış gönderici/yanıt, ortak metin/logo/destek, yerel şablon alanı, hatırlatma defaultu, yönetim alıcısı/özet/teslimat sorumlusu. Kullanıcı tercihleri aşılmaz, olay sınıfı platformdan; dış e-posta ertelendi. | FD04 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O08 Belge onay | Ortak şablon/kurumsal alan/dil, desteklenen işlem-kitle kapsamı/zorunluluk, merkez ek/düzenleme kilidi, yayın-yürürlük/hedef, yeniden onay/takip. Geçmiş onay immutable, etkiler gösterilir; pazarlama hizmet belgesine tek zorunlu onay olarak birleştirilmez. | FD08 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O09 CRM başvuru | Ortak aşama/sıra/yerel düzenleme, alan/zorunluluk, etiket/sonuç, kaynak/kampanya, merkeze yönlendirme/atama/takip ve ekip görünürlüğü. Kaynak geçmişi korunur; eşleşmeyen başvuru rastgele değil yetkili incelemeye gider. Öğrenci/satış/izin otomatik oluşmaz. | FD09 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O10 Paket satış | Ortak yeni ürün şablonu, desteklenen hak/süre/kapsam/iptal/no-show/dondurma/uzatma/iade seçenekleri, indirim sınırı/ek onay ve yerel kilit. Yeni hazırlıkta koşul gösterilir, şablon yayın değil; mevcut satış/sürüm değişmez ve kullanım yetkisi doğmaz. | FD07 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O11 Katılım politikası | Borç engeli/kapsamı, negatif ders default/üst sınır, kişisel limit izni, rezervasyon/talep penceresi ve zaman istisnası, bekleme/teklif süre sınırları ve yerel izin. Merkez–disiplin/event yasağı ve kesin rezervasyon koruma etkisi korunur. | FD06/FD07 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O12 Finans | Desteklenen ödeme yöntemi, kullanılabiliyorsa ortak banka/yerel bilgi izni, referans/açıklama zorunluluğu, indirim yetkisi, desteklenen tutar ek onayı, finans alıcısı/özet/yerel alan. Banka kaydı otomatik transfer değil; hassas değişim reauth/audit, döviz dönüşümü yok, özel hesaplaşma yetkisi aşılmaz. | FD07/FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O13 Otomasyon | Plan destekli hazır liste, ortak koşul/eylem/zaman şablonu, merkez kapsamı/yerel alan, sonuç alıcısı, isteğe bağlı işleri toplu duraklatma, yetkili geçmiş. Şablon etkinleştirme değil; worker teknik sınırı platformda, zorunlu temizleme kapanmaz ve kör catch-up yok. | FD10 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O14 Rapor aktarım | Ortak rapor filtre/sütun/grup/sıra, merkez/karşılaştırma kapsamı, kullanım-düzenleme paylaşımı, desteklenen export/import eşleme/biçim/kaynak ve yerel kopya izni. Paylaşım yetki değil; canlı çalıştır/indir, import onayı ve teknik tavan korunur. | FD10 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O15 Entegrasyon | Hazır sağlayıcı bağla/kaldır/yenile, amaç/merkez/kullanım ve veri eşleme, isteğe bağlı aktarımı duraklat, sağlık/son başarı/yetki süresi, sorumlu ve merkez kullanım izni. Sırlar normal read'de yok; hassas bağlantı yetkisi, kaldırma dış veriyi silmez, yeniden bağlama otomatik backfill değil. | FD12 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O16 Gizlilik paylaşım | Desteklenen katılımcı profil/iletişim paylaşım kapsamı, merkez daraltma izni, pazarlama amaç/kanal, sürümlü açıklama-izin metni, veri talebi sorumlusu ve uyarı. Org paylaşımı mümkün kılar, kullanıcı yerine açmaz. Orglar arası paylaşım otomatik değil; saklama serbest merkez ayarı değil. | FD05/FD08/FD12 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O17 SaaS aboneliği | Tanımlı fatura alanı, doğrulanmış fatura adresi/yetkili ek alıcı, dönem sonu yenileme tercihi, desteklenen gelecek dönem aylık/yıllık-plan seçimi/etki. Mevcut kullanım/limit/plan/dönem/ödeme bilgi alanı, serbest yazılamaz. Yenilememe hemen org kapatmaz; sağlayıcı yoksa auto ödeme sunulmaz; geçmiş fatura/dönem korunur. | FD12 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O18 Program takvim defaultları | Disiplin/biçim süreleri, saat adımı, sonlu tekrar, yeni merkez çalışma/özel gün kopya şablonu, ortak takvim görünüm/renk ve yerel aralıklar. Mevcut program değişmez, özel gün auto iptal değil; kişisel görünüm korunur. | FD06 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O19 Anlaşma şablonu | Ortak şablon, desteklenen ücret modelleri/bileşen defaultu, paket özel koşul izni, salon kesintisi, yerel sınır ve şablon yetkileri. Şablon anlaşma yayınlamaz veya eski ücreti değiştirmez; süreli/sınırsız temel öneri sabit, diğerleri açık seçim. | FD07/FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O20 Etkinlik defaultları | Ortak şablon, desteklenen ücretsiz/ücretli/paket kayıt, pencere/yerel sınır, dış katılım izni, konum alanları, görünürlük/yoklama ve zorunlu alanlar. Eski event/ücret/koşul değişmez; yoklama ders kredisi açmaz. | FD06/FD08 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| O21 Yayın geçmiş sıfırlama | İlgili yetkilerle desteklenen taslak, hemen/ileri yürürlük, değişiklik alıcısı, yetkili gizli-sırsız geçmiş, önceki değere yeni sürümle dönüş ve seçili grubun platform defaultuna etki gösterimli reseti. Taslak auto yayınlanmaz; başka grup/kişisel izin değişmez, default olmayan zorunlu alan boşaltılmaz. | FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |

#### Platform P01–P09 — dokuz kabul grubu

Platform ayarı yalnız ilgili yapılandırma/güvenlik/işletim/plan/entegrasyon/veri yetkilisince, kaynakta hazırlanmış alan ve doğrulanmış sınırlar içinde yönetilir. Hiçbir grup keyfî kod/anahtar/permission veya kabul kapısı istisnası vermez.

| Grup | Kabul edilen ayar alanları ve sınırlar | Kapanış / kalan teknik iş |
|---|---|---|
| P01 Kimlik dil başlangıç | Platform ad/logo/destek, hazır diller/fallback, yeni hesap bölgesel görünüm/tema, yeni org/merkez şablonu ve desteklenen liste yoğunluk/sayfa seçenekleri. Mevcut kişisel tercihler/iş zamanları ezilmez; erişilebilirlik/teknik tavan korunur, kapatılmış izin açılmaz. | FD01/FD02 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| P02 Giriş hesap güvenliği | Hazır login sağlayıcıları, desteklenen parola kontrolü/MFA-rol şartı, amaç bazlı davet/doğrulama/kurtarma süreleri, giriş/rate/yeniden gönderim sınırları, gerçek sağlayıcı destekli session süresi/hareketsizlik, işlem bazlı reauth, güvenlik olay-kanal/alıcı. Son giriş yöntemi kaldırılamaz, asgari güvenlik ve etki preview; hassas değişim reauth, ek onay alanları ayrı. | FD03/FD11 ve son giriş kararı kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| P03 SaaS plan fiyat limit | Plan katalog/yeni satış aktifliği, desteklenen feature, sayım yöntemi sabit limitler, model destekli sınırsızlık, dönem/currency fiyat sürümleri, satış dönemleri, yenileme ve desteklenen plan değişim yolları. Geçmiş abonelik/fiyat sessiz değişmez, limit/veri etkisi preview; ticari başlangıç/gecikme serbest düğme değil. | FD07/FD12 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| P04 Ayar tanım miras yayın | Kaynakta tanımlı scope, default, güvenli seçenek/aralık, miras/yerel izin, kaynak plan-yetki eşlemesi, hemen/ileri yayın, rollback/reset ve alıcı. Tip/teknik tavan/yeni key eklenmez, kullanıcı kapatması/üst zorunlu aşılmaz; geçmiş korunur, sır loglanmaz. | FD11 kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| P05 Worker zamanlayıcı | Desteklenen isteğe bağlı hatları duraklat/aç, doğrulanmış zamanlama/batch/concurrency/timeout/retry, açık tenant binding, heartbeat/hata/gecikme eşikleri ve alıcı, etkisi gösterilen yetkili bakım stop/start. Zorunlu işler ayrı; lease/fencing/idempotency/yetki kapatılamaz, sır normal alan olmaz; kör catch-up yok. | Backend B02/B09 erteli kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| P06 Bildirim sağlayıcı | Hazır kanal/sağlayıcı, doğrulanmış gönderici-org izni, kaynak olay-kanal zorunluluk, şablon/dil/güvenli değişken, hız/retry/TTL, izinli fallback, hata alıcıları. Kullanıcı amaç/kanal/sessiz saat korunur, kampanya zorunlu olamaz; expired yeniden canlanmaz, sır normal read'de yok. | FD04; provider kurulumu ayrı kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| P07 Veri gizlilik dosya aktarım | Doğrulanmış veri kategori/amaç saklama sürümü, talep yönlendirme/durum/takip, izin metni/dil/yürürlük, dosya tür/boyut/imzalı erişim, import/export tür/format/satır/byte/indirme süresi, desteklenen yedek/restore politikası ve işletim alıcıları. Özel dosya public olmaz, canlı erişim/preview/apply korunur; ayar auto toplu silme veya restore kanıtı değil, imha kanıtsız completed yok. | FD08/FD10/FD12; backend B05/B06 erteli kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| P08 Entegrasyon API dış başvuru | Hazır sağlayıcı katalog/plan-org kullanımı, desteklenen veri yönü/izin, doğrulanmış site-form-kaynak, bot hostname/action eşlemesi, güvenli rate, desteklenen webhook olay/doğrulanmış hedef ve sorumlular. İmza/tekrar/tenant kapıları korunur; eksik config güvenlik bypass değil, sır gizli. | FD09/FD12; backend B07 erteli kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |
| P09 İşletim operatör denetim | Kaynaktaki operatör görev/kapsamları, desteklenen süreli gerekçeli support erişimi, hata/gecikme/alıcılar, bakım metni-hedef-zaman, kontrollü servis/isteğe bağlı iş pause, kaynakta hazır feature kullanılabilirliği, desteklenen yüksek etkili ek onay, denetim/eskiye dönüş. Kendi yetkisini artırma/kullanıcıya bürünme/sınırsız veri erişimi yok. Bakım bildirimi auto stop değil; feature flag plan/yetki/kabul bypass değil. | FD11/FD12; backend B08/B09 erteli kapsamında frontend kararı kapalı; gerçek DTO/permission/runtime/kabul eşlemesi ve ayrı aday işler açık. |


### Karar kapanışı sonrası API aktarım matrisi

69 ana grup ve aşağıdaki FD01–FD12 frontend seçimleri kabul edilmiştir. Önceki grup tablolarındaki açık alan sütunları 24 Ekim ilk aktarımının eksik seçimlerini gösterir; 25 Ekim FD kabulü çelişen frontend değerleri bakımından üstündür. Seçilmemiş Word örnekleri, katalog assetleri ve backend teknik parametreleri topluca onaylanmaz. Alan matrisi yeni seçim icat etmeden doldurulur:

`davranış grubu + FD + alan | kabul/aday/erteli | yazabilen aktör ve gerçek permission | user/member/center/organization/platform scope | tip/seçenek | kabul edilen default ve uygulanma durumu | miras/kopya/override/kilit | gerçek read/write DTO alanı | sürüm/preview/idempotency | provider/cihaz desteği | runtime kanıt SHA | gap | kabul ölçütü`.

| Küme | Karar / kalan uygulama işi |
|---|---|
| Frontend değerleri | Dil/bölge/tema, bildirim zamanları ve istisnaları, member kitlesi, CRM, ilk dosya/ödeme yöntemleri ve standart negatif limit 0 FD01–FD12'de kesinleşti; tekrar onay istenmez. Mevcut ayarlar ezilmez. |
| Yetki/miras/reset | FD11 aktör ve ilk kapsamı belirler; kesin permission/selector ve alan bazlı güvenli uygulama analizi yapılır. Yeni genel ikinci onay ilk teslimde yok. A/B aynı hesap ayrı canlı merkez yetkisi korunur. |
| Teknik alanlar | Auth/rate/worker/file tavanı/saklama/restore ve DB işletimi backend B01–B09 backlog'unda; bu tur değer atanmadı. 100 tekrar/20 kontenjan/−2/3600sn/900sn/5sn/Business1000-50-5 mevcut kurulum kayıtlarıdır. |
| Provider ve asset | Hazır çeviri, somut renk-font paketleri, katalog sürüm/compatibility, logo hattı ve entegrasyon desteği uygulama bağımlılığıdır; desteklenmeyen seçenek hazır gösterilmez. |
| Ayrı işler | Üretim P08 abone/alias, ortak form CRM, kategori kontenjanı/sınırsız model/paket etkinlik uygunluğu, dış e-posta, frontend E2E, load/restore ve fiziksel imha kendi kaynak kabulüne tabidir. |
| Mevcut kaynak | 200 operasyon/59 migration kabulü yeni settings alanlarının desteği değildir. Yerel 208/60 taslak otomatik taşınmaz. Sıradaki iş beş scope için gerçek DTO/permission/read-write/sürüm/kabul eşlemesidir. |

<a id="ayarlar-backend-frontend-siniflama"></a>

### Kararların backend/frontend ayrımı ve beş frontend kapsamı

Son kullanıcı sırası uygulandı: backend/frontend alan ayrımı ve user/member/center/organization/platform sınıflaması yapıldı; FD01–FD12 açık frontend seçimleri kullanıcı tarafından tamamıyla kabul edildi. Bu sınıflama 69 grup kabulünü iptal etmez ve yeni ana grup eklemez. API uygulaması bu karar turunun önüne geçirilmez.

**Sınıflama ölçütü:** Verinin DB'de saklanması onu backend ayarı yapmaz. Yetkili insan uygulama ekranından bir iş tercihini/değerini değiştirecekse frontend ayarıdır; platform yöneticisinin ekranı da frontend'dir. Altyapının nasıl çalışacağını belirleyen ve mevcut UI teslimine açılmayan teknik yapılandırma backend'dir. Grup karma olabilir; ayrım alan bazındadır.

#### Backend ayarları — ayrı işe ertelendi

| Küme | Backend'de kalan yapılandırma | Kaynak gruplar / frontend'de kalan bölüm |
|---|---|---|
| B01 DB ve erişim altyapısı | RLS/grant/fonksiyon sahibi/search_path, connection pool, ağ/SSL, teknik SQL güvenlik kapıları | Sabit güvenlik kuralları; ayar ekranı, rol veya paylaşım tercihiyle kapatılamaz. |
| B02 Worker zamanlayıcı | pg_cron, teknik LOGIN/scope binding, tick sıklığı, batch/concurrency, lease/fencing, executor timeout/retry | Platform P05'in teknik kısmı. M17/O13'teki hazır iş otomasyonunun kapsamı/zamanı/aç-kapatı frontend'de kalır. |
| B03 Auth motoru | Provider credentials, signing/JWT secrets, session token altyapısı, teknik rate/kanıt TTL tavanları | P02'nin altyapısı. Kullanıcının hazır giriş yöntemi seçimi/MFA yönetimi ve org rol güvenlik şartı frontend özel akışlarıdır. |
| B04 Mesaj teslim motoru | SMTP/push servis kurulumu, provider sırları, transport retry/backoff, iş kuyruğu delivery TTL/hız tavanı | P06. Kullanıcı kanal/olay tercihleri, iş hatırlatma zamanı, şablon ve alıcı seçimi frontend'dir. |
| B05 Dosya ve iş tavanları | Storage ingress/izin altyapısı, imzalı erişim motoru, teknik MIME/byte/satır/job limitleri | P07 ve eski 208/60 taslağı. Hazır dosya türlerinden iş belgesine uygun seçim ve aktarım şablonu frontend olabilir; teknik tavan artırılmaz. |
| B06 Saklama imha ve restore | Onaylanmış saklama politikalarının teknik uygulanması, fiziksel imha/hold kanıtı, backup/restore motoru | P07. Kendi veri talebini başlatma/durum görme ve yetkili talep takip alıcısı frontend özel akışıdır. |
| B07 Entegrasyon güvenliği | İmza/secret saklama, bot hostname/action doğrulama altyapısı, webhook retry/dedupe ve teknik abuse limitleri | P08. Hazır sağlayıcı bağlama/kapsam/alan eşleme ve yönlendirme frontend'de, sırlar genel read'de yok. |
| B08 Dağıtım ve kabul | Migration, CI/full/main clean, deploy, ortam kimlik bilgileri ve teknik geri alma | P09. Kullanıcıya gösterilen bakım açıklaması/planı ve yetkili iş uyarısı alıcıları frontend olabilir; deploy düğmesi değildir. |
| B09 Teknik gözlem | Backend log/metric retention, alarm motoru ve düşük seviye kaynak eşikleri | P05/P09. Yetkili uygulama takip sorumlusu seçimi ve kendi yetkili değişiklik geçmişini görme frontend'de kalır. |

UUID standardı, tenant izolasyonu, kapasite/para/hak atomikliği, canlı yetki, idempotency, Q-E02/E03, Starter/ücretli plan ayrımı gibi **sabit ürün/güvenlik hükümleri ayar değildir**. Para tahsil et, yoklamayı kapat, hesaplaşmayı onayla gibi tekil domain komutları da genel tercih kaydetme işlemine çevrilmez. İlgili ekrandan ayrı eylem olarak açılabilirler.

#### Frontend ayarları — user/member/center/organization/platform

Aynı konunun üç düzeyde görünmesi aynı değerin üç kez tutulması değildir: platform izinli katalog/defaultu, organizasyon ortak politika/mirası, merkez izinli yerel değeri; user global tercihi, member ilgili org tercihini yönetir. Kullanıcı arayüzünde org bağlamı seçili olsa da global alan user olarak kalır.

| Kapsam | Düzenleyen | Frontend'de değiştirilecek ayar aileleri | Salt okunur veya ayrı eylem |
|---|---|---|---|
| **user** | Kendi global hesabı | Görünen ad/hitap/fotoğraf; güncel kimlik ve doğrulanmış iletişim; dil/format/timezone/görünüm/erişilebilirlik; başlangıç/liste/takvim; hesap sessiz saatleri; platform pazarlama ve üç reklam/analitik tercihi | Login/MFA/session, kimlik doğrulama, veri talebi/silme/reset özel komut. İş geçmişi ve güvenlik geçmişi salt okunur; cihaz ses/push/cache alanı yerel. |
| **member** | Kendi org tercihinde bağlı hesap sahibi; org kişi/operasyon alanında mevcut yetkili personel/CM | Org bildirim/hatırlatma/pazarlama; org ilgi/öneri; katılımcı profil/iletişim paylaşımı; org kişisel takvim türleri. Yetkili yönetimde hesapsız kişinin iletişimi/ilişkileri ve kişisel merkez–disiplin limit istisnası | Global doğrulanmış ad/iletişim yerel override edilmez. Abone no/kimlik/bakiye salt okunur; ilişki/rol/bağlantı/limit değişimi kendi domain yetki/onayına tabidir. |
| **center** | İlgili merkez/alan yetkilisi | İşletme kimlik/iletişim/konum/görünürlük; iş takvimi/oda/disiplin; program/paket/etkinlik/anlaşma hazırlık defaultları; izinli rezervasyon/borç/hak politikası; görev/izin; bildirim/belge/form/CRM; iş otomasyonu; ortak rapor/import; yerel miras/reset | Mevcut satış/yoklama/finans/hakediş tekil işlemleri ayrı. Worker, DB ve teknik limit yönetimi yok. |
| **organization** | İlgili org alan yetkilisi | Kurumsal/fatura bilgileri ve PR43 hazır marka; ortak dil/format/disiplin/katalog/şablon; merkez default/kilit/yerel sınır; rol/delegasyon ve org güvenlik gereksinimi; bildirim/belge/CRM/gizlilik; iş otomasyonu/rapor/import/bağlantı; SaaS yenileme ve desteklenen plan tercihi; yayın/geçmiş/reset | Owner atama platformda; mevcut abonelik dönemi/limit/ödeme durumu salt okunur. Geçmiş kayıtların yeniden yazılması ayar değildir. |
| **platform** | İlgili uygulama/plan/güvenlik/entegrasyon yetkilisi | Uygulama kimlik/destek; hazır dil/format/tema/renk-font katalogları; yeni hesap/org/merkez defaultları; plan/fiyat/özellik/limit kataloğu; kaynakta tanımlı alanların izinli default/miras/aralıkları; hazır login/MFA kullanılabilirliği; olay/kanal/şablon katalogları; iş otomasyonu/form/CRM/rapor-import seçenekleri; hazır entegrasyon kullanılabilirliği; operatör görev kapsamı/uyarı alıcıları/bakım metni ve yayın/reset | Yeni key/tip/kod/permission yaratma, DB/worker/secret/migration/deploy yönetimi yok. Plan/fiyat API'si hazır değilse mevcut subscriber komutu yerine kullanılamaz. |

#### 69 karar grubunun izlenebilir sınıflaması

Aşağıdaki tablo kapsam eşlemesidir; o gruptaki her alt seçeneğin değeri veya API'si hazır demek değildir. Eski S/M/O/P kararları ilgili alt alanları ve korumalarıyla önceki tablolarda korunur.

| Kabul grubu | Frontend kapsamı | Backend ayrımı / sınır |
|---|---|---|
| S01 Profil | user | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S02 Kimlik ve iletişim | user | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S03 Hesap–kişi bağlantısı | user, member | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S04 Şifre ve kurtarma | user | Backend: teknik kurtarma TTL/rate; frontend: parola işlemleri. |
| S05 Giriş yöntemleri ve MFA | user | Backend: sağlayıcı sırları; frontend: destekli yöntem seçme/MFA. |
| S06 Cihaz ve oturum | user | Backend: token/session motoru; frontend: kendi cihaz/oturum yönetimi. |
| S07 Dil bölge saat | user | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S08 Tema ve erişilebilirlik | user | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S09 Başlangıç ve bağlam | user | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S10 Liste ekran ve takvim | user | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S11 Kişisel takvim bağlantısı | member | Backend: güvenli takvim beslemesi; frontend: bağlantı/filtre seçimi. |
| S12 Bildirim kanalları ve olaylar | user, member | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S13 Hatırlatma sıklık ve sessiz saat | user, member | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S14 Pazarlama ilgi ve kişiselleştirme | user, member | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S15 Görünürlük paylaşım ve izin geçmişi | member | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| S16 Veri talepleri ve hesap silme | user, member | Backend: saklama/imha motoru; frontend: talep ve durum akışı. |
| S17 Güvenlik geçmişi ve sıfırlama | user | Backend: teknik log saklama; frontend: izinli geçmiş ve kapsamlı reset. |
| M01 Kimlik iletişim konum | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M02 Saat dilimi ve iş takvimi | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M03 Oda kaynak kapasite | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M04 Sunulan disiplinler | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M05 Görevler ve izinler | center; member yönetim eylemleri | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M06 Program seans varsayılanları | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M07 Rezervasyon talep bekleme | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M08 Katılım borç negatif hak | center; member limit istisnası | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M09 Yoklama gerçekleşme | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M10 Paket fiyat satış | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M11 Tahsilat iade finans | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M12 Anlaşma koşulları | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M13 Etkinlik dış katılım | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M14 Bildirim hatırlatma | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M15 Belge onay | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M16 Dış görünürlük başvuru | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M17 Otomasyon | center | Teknik worker parametreleri B02; hazır iş otomasyonu frontend. |
| M18 Rapor export | center | Teknik tavanlar B05; rapor/şablon seçenekleri frontend. |
| M19 Import eşleme | center | Teknik tavanlar B05; import eşleme/paylaşım frontend. |
| M20 Miras sıfırlama | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M21 CRM | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| M22 Ayar yetkisi geçmiş | center | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O01 Kimlik iletişim | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O02 Ortak merkez politikaları | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O03 Roller yetki devri | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O04 Güvenlik | organization | Auth motoru B03; organizasyon rol güvenlik şartları frontend. |
| O05 Disiplin kataloğu | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O06 Dil bölge gösterim | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O07 Bildirim | organization | Teslim motoru B04; kanal/şablon/alıcı frontend. |
| O08 Belge onay | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O09 CRM başvuru | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O10 Paket satış | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O11 Katılım politikası | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O12 Finans | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O13 Otomasyon | organization | Worker B02; iş otomasyonu tanımı frontend. |
| O14 Rapor aktarım | organization | Teknik tavan B05; rapor/import şablonu frontend. |
| O15 Entegrasyon | organization | Bağlantı sırları/transport B07; hazır bağlantı ve kapsam frontend. |
| O16 Gizlilik paylaşım | organization | Saklama/imha B06; paylaşım, metin ve talep alıcısı frontend. |
| O17 SaaS aboneliği | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O18 Program takvim defaultları | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O19 Anlaşma şablonu | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O20 Etkinlik defaultları | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| O21 Yayın geçmiş sıfırlama | organization | İş ayarı frontend; sabit ürün/yetki/transaction kuralları ayar değildir. |
| P01 Kimlik dil başlangıç | platform | Hazır katalog/default seçimi frontend; katalog asset hazırlığı uygulama bağımlılığı. |
| P02 Giriş hesap güvenliği | platform | Kullanılabilir login/MFA seçenekleri frontend; secrets/teknik TTL/rate B03. |
| P03 SaaS plan fiyat limit | platform | Plan/fiyat/iş limiti frontend; sayım ve güvenlik motoru sabit uygulama. |
| P04 Ayar tanım miras yayın | platform | Kaynakta tanımlı değer/miras frontend; yeni key/tip/schema kod geliştirmesi. |
| P05 Worker zamanlayıcı | platform | Teknik worker/scheduler kısmı backend B02/B09; uygulama sorumlu seçimi platform frontend. |
| P06 Bildirim sağlayıcı | platform | Hazır kanal/şablon/gönderici/alıcı frontend; transport/credentials B04. |
| P07 Veri gizlilik dosya aktarım | platform | İzin metni/talep sorumlusu ve hazır iş seçenekleri frontend; file/job tavanı/saklama/restore B05/B06. |
| P08 Entegrasyon API dış başvuru | platform | Hazır entegrasyon ve kaynak/alan seçimi frontend; imza/secret/bot/rate motoru B07. |
| P09 İşletim operatör denetim | platform | Operatör uygulama kapsamı/uyarı/bakım metni/yayın frontend; altyapı bakım/CI/deploy B08/B09. |

#### FD01–FD12 — frontend alan kararları tamamlandı

25 Ekim 2026: kullanıcı FD01–FD12 paketlerinin tamamını onayladı. FD07 için standart başlangıç negatif kredi limiti **0** ayrıca teyit edildi; diğer FD07 maddeleri de kabul edildi. Bu paketler 69 ana grubun açık frontend seçimlerini kapatır, yeni 12 ana grup değildir. Backend/altyapı ayarları ertelenmiş kalır. Aşağıdaki kabuller ürün/ekran sözleşmesidir; API, sağlayıcı veya migration uygulanmış sayılmaz.

| Paket | Frontend kapsamı | Durum / kesinleşen alan |
|---|---|---|
| FD01 | user; platform default/katalog | Kabul edildi — dil/bölge/görünüm başlangıçları. |
| FD02 | organization; platform marka kataloğu | Kabul edildi — hazır renk/font/logo, yetki ve bağımsız reset. |
| FD03 | user; org/platform yöntem kullanılabilirliği | Kabul edildi — profil alanları, ilk login/MFA ve güvenlik görünümü. |
| FD04 | user/member; center/org/platform kanal-şablon | Kabul edildi — bildirim matrisi, hatırlatma seçenekleri, özet/sessiz saat ve pazarlama defaultları. |
| FD05 | member; organization izinli kitle | Kabul edildi — katılımcı görünürlüğü, ilgi/öneri ve takvim türleri. |
| FD06 | center/organization; platform seçenekler | Kabul edildi — iş takvimi/program ve rezervasyon başlangıçları. |
| FD07 | center/organization; member yetkili istisna; platform katalog | Kabul edildi — paket/finans seçenekleri, standart negatif limit 0. |
| FD08 | center/organization; platform şablon | Kabul edildi — belge, yeniden onay ve dış görünürlük. |
| FD09 | center/organization; platform CRM kataloğu | Kabul edildi — CRM aşama/form/kaynak/yönlendirme başlangıçları. |
| FD10 | center/organization; platform hazır iş seçenekleri | Kabul edildi — iş otomasyonu, rapor/CSV ve import eşleme. |
| FD11 | user/member/center/organization/platform, aktöre göre | Kabul edildi — yetki, canlı miras/kopya, yayın ve reset. |
| FD12 | user/member/organization/platform, yetkili eylemler | Kabul edildi — veri talebi, bağlantı ve abonelik ekranı. |

##### FD01 — dil bölge ve görünüm (kabul edildi)

| Alan | Kabul edilen ilk seçenek/default |
|---|---|
| İlk dil hedefi | Türkçe/İngilizce; yalnız hazır çeviri açılır. Cihaz dili destekleniyorsa onu kullan, değilse Türkçe. |
| Bölgesel başlangıç | tr-TR; kullanıcı desteklenen biçimleri ayrı değiştirebilir. Tarih gün.ay.yıl (24.10.2026), 24 saat, sayı 1.234,56, hafta başlangıcı Pazartesi. |
| Görüntüleme timezone'u | Otomatik cihaz; desteklenen IANA listesinden manuel seçim mümkün. Merkez iş timezone'u etkilenmez. |
| Tema | Sistem temasını izle; açık/koyu seçilebilir, org markası ayrı. |
| Erişilebilirlik | Cihaz yazı ölçeği/azaltılmış hareketi izle; açık uygulama tercihi S08 hesabı/cihaz ayrımıyla. |
| Takvim başlangıcı | Hafta görünümü, hafta sonu görünür; kullanıcı değiştirebilir. |

##### FD02 — hazır marka (kabul edildi)

| Alan | Kabul edilen seçenek/default |
|---|---|
| Seçim | Renk paketi ve başlık/gövde font paketi ayrı; yalnız platformun uyumlu sunduğu birleşimler. Başlangıç sistem varsayılanı. |
| İlk özelleştirme | Hazır paket; serbest renk/CSS/özel font yükleme yok. Somut renk/font/adları frontend hazırlar, erişilebilirlik/dil kontrolü sonrası platform kataloğuna alınır; Akış/Sahne/Atölye kesinleşmedi. |
| Yazma yetkisi | Owner ve açık yetkilendirilmiş OM. İlk teslimde ayrı merkez markası yok; merkez org markasını kullanır. |
| Kullanıcı tercihi | Açık/koyu/sistem, ölçek ve erişilebilirlik markadan bağımsız. |
| Logo | PNG/JPEG/WebP yükle-değiştir-kaldır; ilk kapsamda SVG/animasyon yok. Kaldırınca org adı ve sistem yedek simgesi. Teknik boyut limitleri backend'de. |
| Reset ve katalog ömrü | Renk/font ayrı ayrı sistem defaultuna döner; logo ayrı kaldırılır. Katalogdan kaldırma yeni seçimleri kapatır; mevcut kullanım destek/fallback durumu açık yönetilir. |
| Public okuma | Yalnız yayımlanmış org bağlamında marka/logo; iç ayar bilgileri açılmaz. |

##### FD03 — profil giriş ve güvenlik (kabul edildi)

ST-03 medya eşlemesi: profil komutunun opsiyonel photo alanı ve org settings komutunun organization-only logo_image alanı kapalı PNG/JPEG/WebP byte nesnesi veya açık null kabul eder; gönderilmeyen değer korunur. Güncel metadata/null ayrı read projeksiyonudur. Typed `media_get_v1` own/organization/lesson_participant bağlamlarında güncel pointer'ı ve canlı yetkiyi yeniden denetler; peer fotoğrafı FD05 photo_visible ve kesin ortak katılımına tabidir. Ham byte özel kayıttadır, audit/receipt/context'e taşınmaz. Boyut/format teknik sınırı, reset/kaldırma, fallback ve public sınırı [ayar devrinde](../frontend-settings-handover.md#özel-fotoğraf-ve-logo-tüketicisi--aday) eşlenir; native kaynak kabulü ayrı kalır.

| Alan | Kabul edilen seçenek/default |
|---|---|
| Profil | Görünen ad, ad, soyad, isteğe bağlı kısa serbest hitap ve fotoğraf ayrı; zorunlu unvan listesi yok. Fotoğraf PNG/JPEG/WebP, kaldırılınca baş harfler. |
| İlk login | E-posta + şifre ana; 25 Ekim son kararıyla Google ek kayıt/giriş. Apple ve Instagram login/bağlama kapsam dışı, passkey sonraya. Bu revizyon FD03 ilk Google ertelemesini değiştirir. |
| İlk MFA | Doğrulayıcı uygulama kodu; SMS MFA ilk kapsamda yok. Kullanıcıya isteğe bağlı, org belirli rollere şart koyabilir. |
| İletişim | E-posta/telefon ayrı pending/confirm akışı; doğrulanmadan güncel değer olmaz. Provider hazır değilse ilgili seçenek kapalı/nedeni görünür. |
| Session görünümü | Bu oturum, başlangıç/son etkinlik ve bilinen cihaz/tarayıcı; tek oturum veya diğerlerini kapatma. |
| Güvenlik geçmişi | İşlem türü/zaman/sonuç/bilinen cihaz. İlk ekranda IP/konum yok; parola/kod/sırlar profil alanı değildir. |

Teknik süre/rate backend işidir. Dış e-posta teslimi ertelenmiş kalır; ürün kabulü native Auth/dış teslim desteği kanıtı değildir.

##### FD04 — bildirim hatırlatma ve pazarlama (kabul edildi)

| Alan | Kabul edilen seçenek/default |
|---|---|
| İlk çalışan kanal | in_app. E-posta/push entegrasyon hazır olduğunda seçilir; enum veya ürün onayı dış teslim kanıtı değil. |
| Zorunlu olaylar | Güvenlik; rezervasyon/talep sonucu; iptal/değişiklik; yer teklifi; tahsilat/iade; erişim değişikliği in_app zorunlu. Diğer olayların zorunluluğu bu listeye sessiz eklenmez. |
| Hatırlatma | Organizasyon bazında ayrı, başlangıç açık. Ders/etkinlik: 1/3/24 saat, default 24 saat. Paket bitişi: 3/7/14 gün, default 7 gün. Ödeme vadesi: 1/3/7 gün, default 3 gün. |
| Pazarlama | Platform ve her org ayrı, default kapalı; kanal bazında açılır. Üç reklam/analitik açık-kapatılabilir tercihi ayrı korunur. |
| Bilgilendirme sıklığı | Uygun olaylarda anlık/günlük/haftalık; default anlık. Günlük 18.00, haftalık pazar 18.00; seçili kullanıcı timezone'unda. |
| Sessiz saat | Default kapalı; kullanıcı gün/aralık seçer. Güvenlik, merkez iptali, sonraki 24 saatteki ders/event değişimi ve süreli yer teklifi istisna. İstisna kapatılmış dış kanalı açmaz; in_app görünür. |
| Tekrar/özet | in_app kaydı korunur; hazır dış kanallar ayrı seçilir. Zaman duyarlı olay özete bırakılmaz; geçersiz hatırlatma gönderilmez. |

##### FD05 — member görünürlük ilgi ve takvim (kabul edildi)

| Alan | Kabul edilen seçenek/default |
|---|---|
| Görünürlük kitlesi | Yalnız aynı gelecek/devam eden ders/event'te kesin kayıtlı kişiler; başvuru/bekleme hariç. Bitişte katılımcılar arası görünürlük biter; personelin yetkili erişimi ayrı. |
| Görünen içerik | Açılmışsa display_name ve fotoğraf; hukuki ad/soyad ayrıca açılmaz. Telefon/e-posta ayrı açılmışsa aynı kitleye, bütün org üyelerine değil. Profil/fotoğraf/telefon/e-posta default kapalı. |
| İlgi | Org disiplin/merkez/event türlerinden çoklu seçim, default boş. Açık ilgi filtresi geçmiş kişiselleştirmesinden bağımsız. |
| Geçmişten öneri | Org bazında default kapalı; kullanıcı açabilir. |
| Kişisel takvim | Kesin ders, kesin event ve yetkili eğitmen/personel görevleri ayrı seçilir. Bağlantı kendiliğinden oluşturulmaz; oluştururken tür seçilir. İçerik başlık/tarih-saat/yer/uygulama bağlantısı; başkaları/borç/ödeme yok. |

##### FD06 — iş takvimi program rezervasyon (kabul edildi)

ST-03 teknik eşleme adayı: organization/center `program_duration_minutes` kapalı integer önerisi sistem60'tır. Yeni merkez o anki org önerisini ve sürümünü kopyalar; mevcut merkez/programlar taşınmaz. Açık yerel seçim eşit değerde de yereldir. `SettingsView.program_duration_source` kaynak bilgisidir, yazılamaz. `ProgramSpec.duration_minutes` gönderilmezse merkezin hazırlık değeri preview spec'ine açık olarak alınır; gönderilirse açık değer üstündür. Sonraki ayar değişimi preview/program snapshot'ını değiştirmez. Seçili reset org şablonuna değil sistem60'a döner. Yetki/sürüm/replay mevcut settings ve program komutlarında korunur.

| Alan | Kabul edilen seçenek/default |
|---|---|
| Yeni merkez timezone'u | Europe/Istanbul önerisi; oluştururken açık onay/değişiklik. User görüntüleme timezone'u ayrı. |
| Çalışma saatleri | Default tanımsız; org şablonundan al veya merkez belirle. Yeni seans ve saat/oda/eğitmen değişiminde kontrol; görüntüleme/iptal/yoklama düzeltmesini engellemez. |
| Zaman istisnası | Default kapalı; org izin verirse yetkili yönetici gerekçeyle kullanır. Diğer kapılar aşılmaz. |
| Yeni program | Ders süresi önerisi 60 dakika, değiştirilebilir. Saat seçici adımı 15 dakika; elle geçerli saat desteklenir. Default tek seans; tekrar açılırsa bitiş tarihi veya sayı açık. |
| Rezervasyon/talep | Açılış/kapanış ayrı, orgdan miras; tanımsızsa yetkili yapılandırma gerekir. Otomatik pencere değeri uydurulmaz. |
| Bekleme/teklif | Yeni sınıfta liste default kapalı. Teklif süresi orgdan miras; değer yoksa teklif üretimi başlamaz. |
| Yerel değişiklik | Org zorunlu alan kilitli, serbest alan yerel değiştirilebilir. Mevcut 100 tekrar/3600sn kulüp seçimi korunur, yeni orglara yayılmaz. |

##### FD07 — paket katılım finans (kabul edildi, standart negatif limit 0)

| Alan | Kabul edilen seçenek/default |
|---|---|
| Yeni paket | Org şablonu; yoksa hak miktarı/geçerlilik/fiyat açık girilir. İptal/no-show/dondurma ayrı; şablonda yoksa yayın öncesi seçilir. İade yöntemi açık seçim, eksiklik none sayılmaz. |
| Para birimi | Yeni taslakta TRY önerisi; desteklenen başka currency seçilebilir. Mevcut satış/fiyat değiştirilmez. |
| Standart negatif limit | Yeni org için **0**. Kullanıcı ayrıca teyit etti. Mevcut kulüp −2 ve diğer politikalar aynen korunur; mevcut org ayarları defaultla ezilmez. |
| Kişisel istisna | Default kapalı; org açarsa yetkili merkez aktörü org sınırı içinde düzenler. Event negatif yasağı korunur. |
| Borç engeli | Yeni orgda rezervasyon ve katılım ayrı, başlangıçta açık; mevcut borç denetimi kapsamı korunur. |
| İndirim | Ayrı yetkisi olmayana kapalı; yetkiliye org sınırı. Yeni sayısal indirim sınırı bu kararda atanmadı. |
| İlk ödeme yöntemi listesi | Manuel nakit, banka transferi, kart/POS kaydı. Auto tahsilat/ödeme entegrasyonu değildir. Banka/kart referansı zorunlu; nakit isteğe bağlı. |
| Ek onay eşiği | Ayrı alan olarak modellenebilir ama tutar defaultu yok; desteklenmeyen mekanizma etkinleştirilemez. FD11 ilk teslimde yeni genel ikinci-onay mekanizması eklemez. |

##### FD08 — belge onay dış görünürlük (kabul edildi)

| Alan | Kabul edilen seçenek/default |
|---|---|
| İlk belge | Yayımlanmış/zorunlu hazır belge atanmaz; org kendi şablonunu hazırlar/seçer. Başlık/dil/sürüm/içerik-dosya/kapsam/zorunluluk açık. Default taslak, açık yayın olmadan kullanıcıya gösterilmez. |
| Zorunluluk/yerel alan | Org belirler, merkez kapatamaz. İlk yerel düzenleme merkez adı/adres/iletişim gibi tanımlı alan ve ayrı ek; ortak metin doğrudan değiştirilmez. |
| Yeni sürüm | Yayında yeniden onay gerekliliği açık seçilir, mevcut kayda etki gösterilir; geriye onay üretilmez. Pazarlama ayrı. |
| Yeni org/merkez | Dış yayın default kapalı. Ad/açıklama/logo/adres/iletişim/çalışma saatleri ayrı seçilir. |
| Kamusal takvim | Merkez görünürlüğünden ayrı açılır; açık yayımlanmış ders/event. Üye/yoklama/borç/kişisel iletişim listesi yok. Mevcut yayınlar değişmez. |

##### FD09 — CRM başvuru (kabul edildi)

| Alan | Kabul edilen seçenek/default |
|---|---|
| İlk aşamalar | Yeni → İletişime geçildi → Görüşme/deneme planlandı → Değerlendiriyor → Kazanıldı/Kaybedildi. Org ad/sıra/ara aşama düzenler; merkez ortak listeyi kullanır. |
| Ortak alanlar | Ad, telefon, e-posta, ilgili disiplin/merkez, seviye, açıklama. Ad + en az bir iletişim zorunlu; form bazında telefon veya e-posta şartı seçilir. Mevcut telefon formlarına e-posta zorunluluğu eklenmez. |
| Forma özel | İzinli ek alanlar; partnerli katılım/partner adı gibi değerler kaybolmaz. |
| Kaynak | Form/sağlayıcı/kampanya/varsa UTM otomatik korunur, normal form düzenlemesinden değiştirilmez. |
| Atama | İlk kapsam belirli kişi/ekip veya merkez kuralı; eşleşmeyen yetkili inceleme kuyruğunda. |
| Takip | Hatırlatma default kapalı; açılırsa 1/3/7 gün seçilir. |
| Kapanış/etiket | Kaybedildi için neden zorunlu: ulaşılamadı, zaman uygun değil, fiyat, başka tercih, diğer. Ortak etiket orgdan; yerel ek ancak izinli. Kazanıldı öğrenci/satış/ödeme yaratmaz. |

Web/reklam ortak CRM entegrasyonu üretim P08'dir; yukarıdaki kabul mevcut public_application_submit DTO'sunun telefonla çalıştığı anlamına gelmez.

##### FD10 — iş otomasyonu rapor import (kabul edildi)

ST-03 teknik eşleme adayı: `ImportMapping.delimiter` opsiyonel kapalı virgül/noktalı virgül seçimidir; yokluğu eski virgül davranışını korur. Seçim tahmin edilmez, eşlemenin parçası olarak preview/bağımlılık/receipt istek hash'ine girer. Quoted separator, escaped quote, CRLF ve quoted newline aynı parser kurallarını kullanır; hatalı yapı/eşleme reddedilir. Hak/borç veya kişi birleştirme defaultu üretmez. Kaynak/native kabulü [alan devrinden](../frontend-settings-handover.md#st-03--starter-tüketici-kapsamı) izlenir.

| Alan | Kabul edilen seçenek/default |
|---|---|
| İlk hazır işler | Bekleyen talep, kapanmamış yoklama ve CRM takip uyarısı; yalnız gerçek destekli kural. Bu ek otomasyonlar default kapalı, yetkili kapsam/sorumlu seçerek açar. FD04 kişisel hatırlatması değişmez. |
| Zaman/eylem | Desteklenen olay sonrası süre veya günlük saat; serbest cron/kod yok. İlk eylem in_app uyarı; auto satış/tahsilat/yoklama/hak değişimi yok. |
| Rapor | Gerçek destekli rapor filtre/sütun/sıra/gruplama şablona kaydedilir. İlk export CSV; PDF/XLSX zorunlu ilk kapsam değil. Zamanlı dış gönderim ilk kapsamda yok. |
| Şablon | Default yalnız oluşturan; yetkili merkez/org kapsamında paylaşır. Ortak şablonu merkezde yetkili CM, orgda ilgili yönetici düzenler; diğer kullanıcı yetkili verilerle kendi kopyasını oluşturabilir. |
| Import | UTF-8 CSV, virgül/noktalı virgül seçimi/örnek satır preview. Otomatik sütun önerisi kullanıcı onayından geçer. Eksik zorunlu alan satır hatası, otomatik borç/hak/izin defaultu yok. Kaynak sistem/kayıt anahtarı; benzer isim/telefon auto merge değil. |

##### FD11 — yetki miras yayın reset (kabul edildi)

| Alan | Kabul edilen seçenek/default |
|---|---|
| user/member | Kendi global tercihleri user; kendi org tercihleri member. Yönetim alanı mevcut person/center yetkisinden; org yöneticisi global hesaba yazamaz. |
| center/organization/platform | CM kendi izinli merkez alanı, açık devredilebilir alan personel/eğitmen; Owner ve açık ilgili yetkili OM org alanı; ilgili platform görev yetkilisi platform alanı. Bu unvanlar yeni permission enumu veya otomatik merkez finans yetkisi değildir. |
| Canlı miras | İzinli ortak görünüm, şablon ve politika değeri orgdan izlenebilir. Yeni merkez çalışma takvimi/program-paket hazırlık/timezone başlangıçları şablondan kopya; şablon değişimi eski merkezi taşımaz. Merkez ad/adres yerel kimlik alanıdır, canlı miras değildir. |
| Yazma semantiği | Alanı göndermemek dokunma; yerel değer kaldırma açık organizasyondan al eylemi. null/reset/inherit wire karşılığı ayrıca typed sözleşmede belirlenecek. |
| Yayın | Genel tercih kayıt anında uygulanır. Belge/politika ileri yürürlüğü mevcut destekli domain akışında kalır. |
| Reset | Alan/grup seçimi ve somut sonuç preview; ilk teslimde bütün scope'ları tek düğmeyle reset yok. Eskiye dönüş yeni sürüm; kapatılmış izin açılmaz. |
| Geçmiş/ek onay | Yetkiliye eski-yeni/aktör/zaman/gerekçe; sırlar gizli. İlk teslimde yeni genel ikinci-onay mekanizması yok; mevcut özel onaylar ve A/B aynı hesap ayrı yetki kararı korunur, desteklenmeyen finans eşiği açılamaz. |

##### FD12 — talep bağlantı abonelik ekranı (kabul edildi)

| Alan | Kabul edilen seçenek/default |
|---|---|
| Talep türleri/kapsam | Veri kopyası, kayıt düzeltme talebi, hesap silme ayrı. Platform hesabı/org kayıtları ayrı gösterilir, kullanıcı kapsamı görerek başlatır. |
| Veri kopyası | İlk çıktı JSON; tablo raporu CSV FD10. Kullanıcıya özel dosya, hazır bildirimi ve erişim bitişi gösterilir. Teknik süre backend'de. |
| Talep takibi | Alındı, işleniyor, ek bilgi bekleniyor, kısmen tamamlandı, tamamlandı, gerekçeli karşılanamadı ürün durumları. Bunlar yeni API enumu olarak sessiz eklenmez; typed eşleme gerekir. |
| Hesap silme | Preview/reauth, sahiplik/korunacak kayıt/sonuç açıklaması. İptal yalnız sistemin geri döndürülebilir bildirdiği aşamada; sonrasında seçenek kapalı. İmha kanıtsız completed yok. |
| Bağlantılar | Org bağlantı kaldırma, üyelik sonlandırma ve hesap silme ayrı eylem. Hazır entegrasyonlar seçilebilir; hazır olmayan hizmet etkinleştirilemez. |
| Destek erişimi | İlk teslimde org adına oturum açma/kimliğe bürünme yok; mevcut açık yetkiler korunur. Önceki aday destek erişimi bu kapsama göre daraltılmıştır. |
| Abonelik | Fatura iletişimi/yenileme tercihi; plan/dönem yalnız destekli teklif akışıyla. Mevcut plan/fiyat/dönem/kullanım/limit salt okunur, ücret/yürürlük etki onaydan önce gösterilir; yeni fiyatlama kuralı yok. |

#### Karar kapanışı ile uygulama açığının ayrımı

**Frontend karar turu kapandı.** Açık kalanlar yeniden ana grup onayı değil; kesin DTO/permission/selector/version/reset/proof eşlemesi, hazır katalog asset ve çevirileri, provider/cihaz desteği, runtime/migration, kabul testleri ve frontend E2E'dir. API/sağlayıcı hazır değilse alan destek durumunu doğru gösterir; sahte kayıt/doğrulama başarısı yoktur.

Henüz seçilmemiş somut marka paket adları/font/renk assetleri frontend hazırlığıdır; serbest renk veya keyfî font/CSS yetkisi değildir. Onaylanmış yeni hesap/org defaultları mevcut kişilerin/kurumların açık değerlerini ezmez. Backend B01–B09 ertelemesi ve üretim P08 işleri korunur. Bu belge güncellemesinde **hiçbir runtime, default veya canlı veri değişmedi**.


### Frontend PR43 — organizasyon renk ve font paketleri

[PR43](https://github.com/SXQHex/FtkSaaS/pull/43), `3eaa0cff6173a81db97d779c8f2ba679f124a869` kaynağında frontend oturumunda kabul edilmiş hazır marka paketi ihtiyacını iletiyor. Yeni bir 70. ana grup değildir; organizasyon O01 kimlik/marka, S08 kişisel görünüm ve platform P01/P04 katalog/default sınırlarıyla eşlenir. Bu not PR43'ün merge edildiği veya API'sinin hazır olduğu anlamına gelmez; başka branch'in değişikliği bu teslimde üzerine yazılmaz.

- Organizasyon hazır renk paleti ve başlık/gövde font paketini seçer; ilk kapsam serbest renk, özel font yükleme veya rastgele CSS/HTML değildir.
- Marka ile kullanıcının açık/koyu/sistem ve erişilebilirlik tercihleri ayrıdır. Semantik hata/uyarı/başarı/odak ve renk dışı anlatım sistem denetiminde kalır; kontrast/dil glifleri/Türkçe/LTR-RTL kontrolü gerekir.
- Frontend paket token/font eşlemesi ve render'ı; backend izinli katalog/kalıcı seçim/canlı org yetkisi/sürüm/denetim sözleşmesini sağlar. Mevcut organization_update yalnız name alanını yazar; hazır theme/font read-write veya logo desteği buradan türetilemez.
- Alan matrisi; kararlı paket kimlik/sürüm/seçilebilirlik/default, org seçimi okuma-yazma-reset, logo sahipliği/tür/boyut/kaldırma, stale/idempotency ve ortak Request/Response/Error/permission eşlemesini içermelidir. theme_package_id/font_package_id öneri adlarıdır; gerçek DTO değildir.
- Org değiştirme/yenileme/girişte doğru marka, tenant'a bağlı cache temizliği, eski istemci veya tanınmayan paket için güvenli fallback doğrulanır. WebSocket/anlık yayılım SLA'sı kabul edilmedi. Org reseti kişisel tercihi, kişisel reset org markasını değiştirmez.
- FD02 ile Owner/açık yetkili OM yazması, yalnız yayımlanmış org bağlamında public marka okuması, ilk kapsamda merkez override olmaması ve hazır uyumlu kombinasyon seçimi kesinleşti. Somut paket/font/renk assetleri, lisans/dil kontrolleri, kesin permission eşlemesi ve ilk kapsam dışı plan kilidi/platformun org adına değişikliği ayrıca uygulanacak veya açık aday olarak kalır. Akış/Sahne/Atölye adları yalnız frontend tasarım önerisidir.
- Uygulama kabulü yetkili/yetkisiz/geri alınmış erişim, A/B org geçişi, sürüm yarışı/retry, fallback/erişilebilirlik, bağımsız reset/logo kaldırma ve desteklenmeyen kayıtta sahte başarı üretmemeyi kapsar. Backend API ve gerçek frontend E2E ayrı kanıtlanır.

### Frontend için geliştirme sınırı

Mevcut callable DTO'lar `08` ve üretilmiş TypeScript üzerinden kullanılır. Kabul edilmiş fakat API eşlemesi tamamlanmamış ayarlar tasarımda taslak/bağımlı durum olarak gösterilir; bilinmeyen endpoint çağrılmaz, kayıt başarılı taklidi yapılmaz. İstemci tasarımı bu belgeyle değiştirilmez. Generic settings endpoint'i, yeni tablo/DTO veya yerel settings taslağı bu metinle yayımlanmış sayılmaz. Tasarımcı kapalı/yetersiz yetki/sağlayıcı yok/doğrulama bekliyor/sürüm çatışması ve kısmi yayılma durumlarını birbirinden ayırmalıdır.

### Ayrıntılı dört kapsam kataloğu

Aşağıdaki katalog Word v0.1 içeriğinin Markdown aktarımıdır. 69 kabul grubu ve kabul edilmiş tasarım kurallarıyla çelişen aday/X notları yalnız ilgili davranış bakımından yukarıdaki kararlara tabidir. Henüz seçilmemiş alan/sağlayıcı/sayılar aday kalır.

#### 4. Ortak kapsam ve yetki kuralları

| Kapsam | Değerin sahibi / yazabilen | Sınır |
| --- | --- | --- |
| Kullanıcı | Hesap sahibi; teknik işlem hesabın kendisi olarak doğrulanır. | Kişisel görünüm ve tercih; başka hesabın veya organizasyonun kuralını değiştirmez. |
| Hesap–org | İlgili bağlı kişi, izin verilen tercih alanlarında. | Org amaçlı bildirim/izinler organizasyonlar arasında taşınmaz. |
| Cihaz | Kullanıcı ve cihaz/işletim sistemi. | Push izni, yerel görünüm veya cihaz oturumu; işletim sistemi reddi aşılamaz. |
| Merkez | İlgili komutun canlı merkez yetkisine sahip aktör. | Org sınırı, zorunlu politika, plan ve disiplin kapsamı korunur. |
| Organizasyon | Komuta göre Owner veya yetkili OM/diğer açık izin. | Owner unvanı CM operasyon yetkisi vermez. Her satırın kesin izni API analizinde atanır. |
| Platform | İlgili platform operatör iznine sahip aktör. | Müşteri organizasyonu adına operasyon veya kullanıcı adına rıza verme yetkisi türemez. |

##### 4.1 Miras ve öncelik

K — İş politikalarında ilgili anahtarın mevcut resolver’ı esas alınır: kapsam/zaman için geçerli sürüm seçilir; zorunlu organizasyon politikası merkez ayarını sınırlar. Danışma niteliğindeki organizasyon ayarına yerel istisna yalnız sözleşme, plan ve izin açıkça destekliyorsa uygulanır. Bütün ayarlara tek bir platform → org → merkez → kullanıcı zinciri uygulanmaz.

T — Her ayar tanımı, canlı miras mı yoksa oluşturma anında kopyalanan şablon mu olduğunu belirtir. Üst şablon değişimi geçmiş kayıtları sessizce güncellemez. Kişisel reklam/ölçüm tercihinde merkez veya org kullanıcı yerine “açık” kararı veremez.

T — “Belirtilmedi/miras al”, false, sıfır, boş liste ve null ayrı anlamlardır. Varsayılana dön komutu yalnız izin verilen override’ı kaldırır. Varsayılanı bulunmayan zorunlu iş politikası, keyfi bir değerle işletilmez.

##### 4.2 Değişiklik ve geçmiş

K — Satış, anlaşma, politika, seans ve finans alanlarının mevcut immutable sürüm ve snapshot kuralları korunur. Politika/kişisel limit değişiminde etkilenen kesin rezervasyonlar için mevcut etki önizlemesi, açık yönetici onayı ve koruma yükümlülükleri uygulanır. Sessiz otomatik iptal yoktur; yeni işlemler güncel kurallardan geçer.

T — Yazma sırasında canlı yetki, plan, kapsam ve bağımlılıklar yeniden doğrulanır. Geri alınmış yetki eski ekran veya tekrar isteğiyle canlanmaz. Gizli değerler, parolalar ve sağlayıcı anahtarları genel settings yanıtında veya audit diff’inde bulunmaz.

#### 5. Kullanıcı ayar kataloğu — hesap ve deneyim

69 grupta açıkça kabul edilmiş alt alanlar K, seçilmemiş diğer Word katalog seçenekleri A statüsündedir. Word aile numaraları davranış sprinti numaraları değildir. Seçilmemiş varsayılanlar X kalır. Hesap güvenliği işlemleri kendi doğrulama akışında yürür.

| ID | Ayar ailesi | Alanlar ve sözleşme sınırı |
| --- | --- | --- |
| U01 | Profil ve kimlik | Görünen ad, hitap, profil fotoğrafı/kaldırma; ad-soyad ve doğrulanmış iletişim ayrı alanlardır. Mevcut profil API’si yalnız display_name kapsamındadır. |
| U02 | İletişim | E-posta/telefon değişimi, doğrulama ve birincil iletişim seçimi. Hesap kimliği e-posta değildir. Org kişi iletişimiyle senkronizasyonun teknik aktarımı ayrıca incelenir. |
| U03 | Parola ve giriş | Parola oluşturma/değiştirme, kurtarma, bağlı giriş sağlayıcıları ve varsa passkey yönetimi. Hassas komutlar yeniden doğrulama ister; düz ayar yazımı değildir. |
| U04 | İki aşamalı güvenlik | MFA yöntemleri, kurtarma kodları, güvenilen cihazlar; ekle/kaldır akışları ve zorunluluklar platform güvenlik politikasına tabidir. |
| U05 | Oturumlar | Cihaz/oturum listesi, tek veya tüm oturumları kapatma, hatırlanan cihaz iznini kaldırma; hesap silmeyle karıştırılmaz. |
| U06 | Dil ve bölge | Arayüz dili, tarih/saat ve sayı biçimi, 12/24 saat, hafta başlangıcı. Para veya ürünün ticari birimini kendiliğinden değiştirmez. |
| U07 | Görüntüleme saati | Otomatik/manuel saat dilimi. Merkezin iş zamanı, satış tarih sınırı ve seans Instant değeri değişmez. |
| U08 | Erişilebilirlik | Tema, metin büyüklüğü, kontrast, azaltılmış hareket, ses/titreşim; desteklenen istemci yetenekleriyle sınırlı. |
| U09 | Başlangıç bağlamı | Varsayılan org/merkez/disiplin, son bağlam, rol bazlı açılış. Erişim yoksa güvenli yeniden seçim; gizli bağlam açıklanmaz. |
| U10 | Liste ve takvim | Liste/kart, yoğunluk, sütun, filtre, sıralama; takvim gün/hafta/ay/ajanda, hafta sonu, renk ve görünür saat aralığı. |
| U11 | Takvim paylaşımı | Kişisel takvim aboneliği oluşturma, kapsam daraltma, iptal/anahtar yenileme. Yetki geri alındığında yeni veri servis edilmez. |

##### 5.1 Kimlik ve kişi kaydı

K — Hesap organizasyonlar arasında ortak, kişi organizasyona aittir; hesabı olmayan kişi kaydı mümkündür. Profil adı değişikliği otomatik rol veya kişi birleştirme değildir. Geçmiş finansal/hukuki kayıtların kimlik snapshot’ları yeniden yazılmaz.

K — Güncel ad ve doğrulanmış e-posta/telefon aktif güvenli hesap–kişi bağlantısından org onayı olmadan yansır; aynı alanın yeni talebi eski bekleyen doğrulamayı geçersizleştirir, başka hesaba bağlı giriş/kurtarma iletişimi reddedilir. Bağı kaldırılmış org gelecekteki değişiklikleri almaz; eski belge snapshotları değişmez. Teknik API/DTO ve veri aktarımı ayrı iştir. Org abone numarası P08 kapsamındadır; UUID ilişki kimliği kalır.

#### 6. Kullanıcı ayar kataloğu — iletişim ve veri

| ID | Ayar ailesi | Alanlar ve sözleşme sınırı |
| --- | --- | --- |
| U12 | Bildirim kanalları | Uygulama içi, push, e-posta ve olası SMS; güvenlik, işlem, hatırlatma ve pazarlama amaçları ayrı. Mevcut in_app transactional kapatma yasağı korunur. |
| U13 | Operasyon bildirimleri | Rezervasyon/onay/iptal, saat/oda/eğitmen değişimi, merkez iptali, talep/alternatif/bekleme/yer teklifi ve teklif bitişi için olay tercihleri. |
| U14 | Finans ve belgeler | Hak bitişi/düşük bakiye, borç/tahsilat/iade, belge bekleme/yayın, hesap bağlantısı ve yetki değişimi bildirimleri; zorunlu olaylar ayrıca sınıflanır. |
| U15 | Hatırlatma düzeni | Ders/paket/ödeme hatırlatmaları, anlık/özet sıklığı, mükerrer kanal azaltma; sessiz saatler, günler ve kişisel saat dilimi. |
| U16 | Cihaz bildirimleri | Push aboneliği, ses/titreşim, kilit ekranında içerik gizleme. Kritik istisnaların kapsamı ve kullanıcıya açıklanması X’tir. |
| U17 | Pazarlama | Platform ve her org için ayrı amaç/kanal tercihleri; kampanya ve bültenler. Reklam/analitik tercihi pazarlama izni yerine geçmez. |
| U18 | İlgi ve öneriler | Disiplin, merkez ve etkinlik ilgileri; öneri kişiselleştirmesi. Erişim veya otomatik kayıt yaratmaz. |
| U19 | Reklam kişiselleştirme | K: Varsayılan açık, kapatılabilir. Önerilen teknik anahtar ad_personalization; nihai DTO anahtarı henüz kabul edilmiş değildir. |
| U20 | Reklam amaçlı takip | K: Varsayılan açık, kapatılabilir. Önerilen teknik anahtar ad_tracking; kaynak/sağlayıcı ve amaç kapsamı ayrıca tanımlanır. |
| U21 | İsteğe bağlı analitik | K: Varsayılan açık, kapatılabilir. Önerilen teknik anahtar optional_analytics; zorunlu güvenlik/işletim kayıtlarından ayrılır. |
| U22 | Görünürlük ve izinler | Diğer kullanıcılara ad/fotoğraf/iletişim görünürlüğü yalnız ilgili özellik varsa; izin geçmişini görme ve geri çekme. |
| U23 | Veri ve hesap yaşamı | Veri dışa aktarma/düzeltme talepleri, org bağlantısı talepleri, hesabı silme önizlemesi/başvurusu; yerel cihaz verisini temizleme ayrı. |
| U24 | Role özgü tercihler | Öğrenci özetleri; eğitmen görev/yoklama/hakediş uyarıları; personel iş/CRM uyarıları; CM onayları; Owner abonelik özetleri. Tercih yeni yetki vermez. |

##### 6.1 Tercih, onay ve fiilî işleme

K/T — Saklanan tercih, hukuki izin/işleme dayanağı ve teknik etkinlik ayrı gösterilmelidir. “Açık tercih” tek başına veri toplamayı başlatmaz. Hukuki değerlendirme tamamlanıncaya kadar bu belgeye dayanarak rıza kaydı üretilemez veya geçerli dayanak gerektiren takip açılmaz. Dayanak alanlarının nihai şeması X’tir.

T — Kullanıcının kapatması gelecekteki isteğe bağlı toplama/gönderime uygulanır; gönderim anında kuyruktaki işler tekrar kontrol edilir. Geçmiş kanıt ve hukuken tutulması gereken kayıtların silinmesi ayrı süreçtir. Kapatma temel SaaS erişimini veya zorunlu işlem kayıtlarını bozmaz.

#### 7. Merkez ayar kataloğu — işletim

Word kataloğunun ilk A statüsü tarihsel sınıflamadır; güncel kabul M01–M22 ve açık alan matrisiyle belirlenir. Merkez komutları, ilgili merkez ve disiplinin canlı yetkisi ile çalışır. Organizasyon kataloğunun kullanıma açılması, organizasyon genelini değiştirme yetkisi vermez.

| ID | Ayar ailesi | Alanlar ve sözleşme sınırı |
| --- | --- | --- |
| C01 | Kimlik ve ulaşım | Merkez adı/kodu, açıklama, logo, adres/harita, telefon/e-posta/web/sosyal bağlantılar; ticari ve kamusal gösterim ayrı. |
| C02 | İş takvimi | Merkez saat dilimi, çalışma saatleri, tatil/istisna günleri, bakım ve geçici kapanış. Mevcut seansları taşıma/iptal ayrı etki komutu. |
| C03 | Disiplinler | Org disiplinlerinden sunulanları etkinleştirme, görüntüleme sırası ve yerel açıklama; aynı org disiplin kimliği korunur. |
| C04 | Oda ve kaynaklar | Mekân/oda/kaynak, ayrı fiziksel oda kapasitesi, kullanım saatleri ve bakım blokları. Kapasite düşüşünde mevcut kesin kayıtlar korunur. |
| C05 | Eğitmen ve görev | Eğitmen/asistan uygunluğu, disiplin/merkez ilişkileri, müsaitlik ve izin takvimi. Görevlendirme ve login grant ayrı. |
| C06 | Personel yetkileri | Merkez personeli kapsamı, açık delegasyonlar ve izin sınırları. Owner atama veya org yetkisi merkez ayarıyla yapılamaz. |
| C07 | Program ve seans | Süre/saat adımı, varsayılan oda/görevli, tek toplam ve isteğe bağlı kategori kontenjanları, kapalı sınıf ve dış görünürlük; program sürüm kuralları korunur. |
| C08 | Talep ve rezervasyon | Talep/rezervasyon pencereleri, alternatif sunumu ve izin verilen yönetici istisnaları. Plan/kapasite/hak kapıları atlanamaz. |
| C09 | Bekleme ve teklif | Bekleme kullanımı, yer teklifi süresi ve bildirimleri; yarışta tek kesin yer/hak, süre dolumu ve idempotency korunur. |
| C10 | İptal ve yoklama | Özel/grup iptal politikası, gelmeme ve yoklama hatırlatmaları; Q-E02/E03 parasal sonuçları serbest ayar değildir. |
| C11 | Borç ve kredi | Borçlu rezervasyon/katılım politikaları; kişi–merkez–disiplin negatif limit istisnası. Event negatif kredi yasağı değiştirilemez. |
| C12 | Etkinlikler | Varsayılan mekân, kapasite, kayıt/hak/ücret koşulları ve görünürlük. P08 sınırsız kapasite ve ders tüketmeyen katılım tasarımları uygulanmış sayılmaz. |

##### 7.1 Operasyonel durdurma

T — Yeni rezervasyonu, satışı veya kamusal yayını durdurmak ayrı anahtar/komut olmalıdır. Merkezin pasifleşmesi, plandaki aktif merkez sayımı, mevcut seansların iptali ve organizasyon kapanışı aynı anahtara bağlanmamalıdır. Kesin mevcut API davranışı eşleme sırasında korunur.

#### 8. Merkez ayar kataloğu — ticari ve iletişim

| ID | Ayar ailesi | Alanlar ve sözleşme sınırı |
| --- | --- | --- |
| C13 | Ürün ve fiyat | Ürün sürümü, fiyat/para birimi, merkez/disiplin kullanım kapsamı, paket yaşam koşulları; geçmiş satış snapshot’ı korunur. |
| C14 | Paket işlemleri | Dondurma/uzatma/değişim/yenileme/sonlandırma/iade koşulları; tekil satış işlemi ayrı komuttur, genel ayarla geçmiş değiştirilmez. |
| C15 | İndirim ve kampanya | Yetki dahilinde fiyat/indirim sınırları, geçerlilik ve uygun kitle. Org/plan sınırını veya izin gereksinimini aşmaz. |
| C16 | Ödeme ve banka | Desteklenen ödeme yöntemleri, vade/taksit seçeneği varsa koşulları, banka/hesap bilgileri ve makbuz gösterimi. Otomatik banka entegrasyonu varsayılmaz. |
| C17 | Eğitmen anlaşmaları | Ücret modeli, genel/özel anlaşma sürümü ve varsa oda ücreti koşulu. Fiilî hakediş ve ödeme komutları ayrı; eski anlaşma yeniden yazılmaz. |
| C18 | Hesaplaşma yetkisi | Merkez bazlı hesaplaşma yetkileri mevcut Owner/delege OM zinciriyle atanır. CM unvanı ve tercih ekranı tek başına grant değildir. |
| C19 | Deneme | Org deneme uygunluğu ve tekrar politikası içindeki yerel uygulama; süre/sayı varsayılmaz, planın ilk ödeme kuralı aşılmaz. |
| C20 | CRM | Kaynak, sorumlu atama, ilgi/seviye alanları, takip düzeni; org ortak kişi/form modelinden kopuk kopya kayıt kurulmaz. |
| C21 | Kamusal yayın ve form | Kamusal takvim/alan görünürlüğü, form alanları, yerel zorunlu/isteğe bağlı ekler; ayrı form kaynakları ve onay kanıtları kaybolmaz. |
| C22 | Belge ve bildirim | Org belge zorunlulukları altında yerel ekler; işlem/hatırlatma şablonları, izin verilen kanal ve gönderici gösterimi. Kullanıcı izinleri aşılamaz. |
| C23 | Otomasyon | Plan destekliyorsa yerel otomasyon koşulları ve çalışma izni. Org tanımı ile merkezde çalıştırma yetkisi ayrı doğrulanır. |
| C24 | Rapor ve aktarım | Varsayılan rapor filtreleri, yetkili alıcılar, import eşleştirme/şablonları, export kapsamı. Alan/tenant izni, dosya ve iş sınırları korunur. |

##### 8.1 Sabit iş sonuçları

K — Merkez iptalinde Q-E02’nin tam borç kaldırma, tekrar üretmeyen para/hak dönüşü ve ayrı nakit iade kuralları korunur. Katılımcı iptalinin parasal sınırı Q-E03’e göre planlanan başlangıçtır. Sonradan fiilî başlangıç düzeltmesi bu sınıflandırmayı veya geçmiş hakedişi yeniden hesaplamaz.

K — Negatif kredi para borcu değildir. İlgili merkez–disiplin açıkları ayrılmış+tüketilmiş toplam üzerinden kontrol edilir; başka disiplindeki hak sınır dışı açığı kapatamaz. Sonradan ödeme geçmiş katılım/hakediş yaratmaz. Starter ve ücretli plan anlaşma/hakediş ayrımı bir tercih düğmesiyle değiştirilemez.

#### 9. Organizasyon ayar kataloğu — yapı ve politika

Word kataloğunun ilk A statüsü tarihsel sınıflamadır; güncel kabul organizasyon O01–O21 ve açık alan matrisiyle belirlenir. Her satır için komut bazında yazma izni kesinleştirilir; “Owner her işlemi yapar” şeklinde toplu izin verilmez.

| ID | Ayar ailesi | Alanlar ve sözleşme sınırı |
| --- | --- | --- |
| O01 | Kurumsal kimlik | Org adı/markası, ticari unvan, vergi/fatura bilgileri, resmî/iletişim adresleri, destek kanalları ve logo. |
| O02 | Merkez yönetimi | Merkez kurma, aktiflik, plan içi merkez seçimi ve yaşam döngüsü. Merkez kapatma geçmiş borç/hak kayıtlarını silmez. |
| O03 | Disiplin ve sözlükler | Org disiplinleri, ortak kategori/seviye/kaynak sözlükleri, yerel merkezde kullanıma açılabilirlik. |
| O04 | OM/CM ve personel | Mevcut atama/delegasyon akışları, merkez/işlem kapsamları; Owner atama/kaldırma yalnız platformda kalır. |
| O05 | Hesap erişimi | Davet/bağlama tercihleri, izin verilen erişim kanalları, personel görev kaydı ile login grant ayrımı. İlk student-self sınırı korunur. |
| O06 | Abone gösterimi | Org operasyonunda kullanıcıya gösterilecek abone numarası ve UUID ayrımı. K: Organizasyon içinde benzersiz, değişmez, tekrar kullanılmaz; UUID bağlantıları korunur. Format/tahsis/merge ayrıntıları X ve uygulama P08 kapsamındadır. |
| O07 | Güvenlik gereksinimi | Plan/ürün destekliyorsa belirli rollerde MFA veya oturum gereksinimi. Kullanıcı kurtarma ve platform güvenlik kapıları aşılamaz. |
| O08 | Politika yetkisi | Anahtar bazında zorunlu/danışma niteliği, izin verilen yerel istisna ve sayısal sınırlar; tüm politikalar otomatik override edilemez. |
| O09 | Yeni merkez şablonu | İş takvimi, saat dilimi, varsayılan görünüm/iletişim ve yerel politika başlangıçları. Kopya/miras modeli açıkça belirtilir. |
| O10 | Operasyon politikaları | Talep/rezervasyon/iptal/bekleme, borç/negatif kredi, katılım/yoklama ve hatırlatma politikalarının org sürümleri. |
| O11 | Ürün ve satış | Ortak ürün katalogları, fiyat/indirim yetkileri, merkezler arası/disiplinler arası kullanım kapsamları; plan kapıları ve satış snapshot’ı korunur. |
| O12 | Paket ve deneme | Dondurma/uzatma/yenileme/sonlandırma varsayılanları, deneme tekrar sınırı; bilinmeyen sayı/süre veya ücretsiz ilk ödeme grace’i icat edilmez. |

##### 9.1 Veri sahipliği

K — Org içindeki kişi aynı kişi kaydı olarak birden fazla merkez/disipline bağlanır. Ayrı organizasyonların kişi kayıtları ayrıdır. Hesap erişimi kaldırma, kişi birleştirme ve kişi iletişim düzeltme işlemleri birbirinin yerine geçmez. Başka orgdaki profil/tercih/kayıt bilgisi yanıt içinde açılmaz.

#### 10. Organizasyon ayar kataloğu — finans ve yönetişim

| ID | Ayar ailesi | Alanlar ve sözleşme sınırı |
| --- | --- | --- |
| O13 | Finans sözlükleri | Desteklenen ödeme yöntemleri, vade/taksit varsa koşulları, banka bilgileri, mali gösterim ve rapor birimleri. |
| O14 | Anlaşma şablonları | Eğitmen anlaşma modelleri ve kullanılabilir sürümler; merkez anlaşması, satış ve gerçekleşmiş hakedişin yerine geçmez. |
| O15 | Hesaplaşma delegasyonu | Owner/delege OM merkez bazlı grant zinciri, okuma ve geri alma. A/B onayında her tarafın canlı yetkisi ayrı aranır. |
| O16 | CRM ve formlar | Ortak alanlar, seviye/ilgi/kaynak sözlükleri, segment ve takip kuralları; form özgü alanlar korunarak ortak başvuru modeline eşlenir. |
| O17 | Kamusal görünürlük | Org/merkez rehberi, kamusal takvim, iletişim ve yayınlanabilir alanlar; kişi verisinin görünürlüğü ayrıca sınırlandırılır. |
| O18 | Belge yönetişimi | Şablon/sürüm, hangi hedefte zorunlu olduğu, yayın/kanıt koşulları, yerel eklerin sınırları. Geçmiş kabul sürümü korunur. |
| O19 | Bildirim düzeni | İşlem/hatırlatma şablonları, desteklenen kanallar, gönderici kimliği ve org sessiz saat önerileri. Zorunlu in_app kayıtları ve kişisel tercihler korunur. |
| O20 | Pazarlama | İzinli amaç/kitle/kanal ve kampanya düzeni; org yöneticisi kişi yerine izin veremez. Platform pazarlama izniyle birleştirilmez. |
| O21 | Business otomasyonu | Desteklenen otomasyon tanımları, tetikleyici/koşul/aksiyon ve etkinlik; merkezde çalışma ayrıca o merkezin operasyon iznine bağlı. |
| O22 | Rapor ve veri aktarımı | Org raporları, erişimli alıcılar, export/import şablonları ve alan eşlemeleri; herkese açık dosya veya kapsam genişlemesi yaratılmaz. |
| O23 | Saklama ve entegrasyon | İzin verilen saklama yapılandırması, entegrasyon/webhook anahtar referansları ve kapsamları. Hukuki saklama süreleri ve dış servisler ayrıca değerlendirilir. |
| O24 | Abonelik ve kapanış | Plan/değişim/yenileme tercihleri; org kapatma/yeniden açma/kalıcı silme ayrı sürümlü komutlardır. Fiyat/dönem ve grace kuralları serbest ayar değildir. |

##### 10.1 Abonelik ve kalıcı imha

K — İlk ödeme, dönem başlangıcı, yenileme gecikmesi, düşürmede merkez seçimi ve gönüllü yenilememe mevcut abonelik sözleşmesine tabidir. Kullanıcının ayar değiştirmesi tek başına ödeme doğrulaması değildir. Plan veya fiyat sürümü geçmiş satın alımı sessizce değiştirmez.

K — Hesap silme, org kapanışı, abonelik bitişi ve kalıcı imha ayrı durumlardır. Hukuki arşiv/borç/alacak kanıtı keyfi silinmez. Fiziksel imha kanıtı eksikse işlem tamamlanmış gösterilmez; backup restore imha listesini uygulamadan veriyi yeniden açamaz.

#### 11. Platform ayar kataloğu — ürün ve güvenlik

A statüsü. Platform ayarları yalnız yetkili operatör komutlarıyla değişir; müşteri kullanıcılarına genel config yazımı açılmaz.

| ID | Ayar ailesi | Alanlar ve sözleşme sınırı |
| --- | --- | --- |
| P01 | Platform kimliği | Ürün markası, destek/iletişim, hukuki metin bağlantı ve sürümleri, bakım duyuruları. |
| P02 | Operatör yönetimi | Platform rolleri, işlem kapsamları ve yetki geri alma; MFA/yeniden doğrulama gereksinimleri ve audit. |
| P03 | Owner yönetimi | Org Owner atama/kaldırma yalnız mevcut platform akışıyla. Müşteri kendi Owner’ını devredemez. |
| P04 | Kuruluş ve abone kimliği | Kuruluş/ilk ödeme akışı ve abone numarası üretim politikası; mevcut UUIDv7 standardı korunur, dış sağlayıcı kimlikleri dönüştürülmez. |
| P05 | Plan kataloğu | Starter/Pro/Business özellikleri, fiyat/dönem/limit sürümleri. Kuruluma özgü değerler genelleştirilmez; unlimited temsili P08’de X. |
| P06 | Abonelik işletimi | Ödeme doğrulama, plan değişimi, yenileme/grace ve istisna uzatma yetkileri; müşteri tercihinden ve tahsilat kanıtından ayrılır. |
| P07 | SaaS ticari araçlar | Desteklenen ödeme/fiş/fatura akışları ve varsa platform kampanya/kuponları. Ticari değerler ve sağlayıcılar ayrıca kararlaştırılır. |
| P08 | Özellik yayını | Özellik bayrağı, kademeli açılış ve acil yeni işlem durdurma; kazanılmış hak, snapshot, plan ve yetki kontrollerini aşamaz. |
| P09 | Settings tanım kaydı | İzinli anahtarlar, tip, kapsam, varsayılanın kaynağı, miras/override, sürüm, plan/izin ve etki sınıfları. Keyfi anahtar kabul edilmez. |
| P10 | Dil ve kimlik sağlayıcı | Desteklenen dil/bölge; Auth sağlayıcıları, iletişim doğrulama, hesap kurtarma ve oturum güvenliği. Gizli anahtar yerine güvenli referans tutulur. |
| P11 | Erişim davetleri | Desteklenen kanallar ve açık config’li süre/rate sınırları. Bearer token UUID değildir; sırlar ayar okumasına dönmez. |
| P12 | Gizlilik ve bildirim | Kullanıcı tercih/amaç/kanal kataloğu, izin kanıt şeması, sağlayıcı uygunluğu ve şablonları. Varsayılan açık değeri rıza kaydı üretmez. |

##### 11.1 Değiştirilemeyen korumalar

K/T — Tenant izolasyonu, RLS/EXECUTE sınırları, canlı aktör yetkisi, transaction/idempotency, worker lease/fencing ve kayıt geçmişini koruma ilkeleri müşteri ayarıyla kapatılamaz. Platformda da bu korumalar genel settings anahtarı olarak sunulmaz; kaynak/sözleşme değişimi ve uygun kabul gerektirir.

#### 12. Platform ayar kataloğu — işletim ve veri

| ID | Ayar ailesi | Alanlar ve sözleşme sınırı |
| --- | --- | --- |
| P13 | Kötüye kullanım | Bot/hız sınırı sağlayıcı ve kuralları, engelleme/inceleme akışları; desteklenmeyen hedef/süre veya ayrıcalık uydurulmaz. |
| P14 | Dosya ve belgeler | Boyut/tür sınırları, imzalı erişim, tarama/karantina ve kanıt gereksinimleri; güvenlik ve belge kabulü atlanamaz. |
| P15 | Import/export ve rapor | Satır/dosya/iş boyutu, eşzamanlılık ve erişim süresi; değerler ölçülüp kabul edilir. Kaynakta sabit güvenlik limitleri keyfi ayara çevrilmez. |
| P16 | Worker işletimi | İzinli job türünde schedule/tick, batch, concurrency, retry ve çalışma config’i. Dedicated kimlik, tenant binding, lease ve atomiklik korunur. |
| P17 | İş müdahalesi | Yetkili retry/cancel/başarısız iş incelemesi; neden, güncel sürüm/kapsam ve replay kapıları. Genel SQL çalıştırma ayarı değildir. |
| P18 | Bakım ve kısıtlama | Bakım duyurusu, yeni işlem durdurma ve desteklenen org kısıtlama/geri açma; sebep ve audit. Mevcut mali sonuçları yeniden yazmaz. |
| P19 | Gözlemlenebilirlik | Log seviyesi, maskeleme, metrik/uyarı eşikleri ve güvenlik alıcıları; parola/token/kişisel veri sızıntısı yaratılmaz. |
| P20 | Audit ve saklama | Audit erişimi, saklama/imha kuralları ve hukuki bekletmeler; sayısal süreler ve dayanaklar ayrıca karara bağlanır. |
| P21 | Yedek ve geri yükleme | Yedek/restore hedefleri, doğrulama ve imha listesi uygulaması. Ayar kaydı gerçek restore veya SLA kabulü değildir. |
| P22 | Destek erişimi | Varsa süre/kapsam/gerekçeyle sınırlı destek yetkisi; gizli kullanıcı taklidi veya genel tenant erişimi oluşturulmaz. |
| P23 | Entegrasyon ve API | Sağlayıcı kullanılabilirliği, secret referansları, webhook sınırları; API sürüm/istemci uyumu ve deprecation ilkeleri. |
| P24 | Dağıtım ve mahremiyet | Kaynak/migration/Edge/worker durumu görüntüleme; hesap/org gizlilik işi ilerleme ve kanıtları. Deploy/reset/kalıcı imha ayrı yetkili işlemdir. |

##### 12.1 Ortamlar ve CI/CD

K — Kaynak main, geliştirme/test ortamı ve production birbirinden ayrıdır. Main merge production izni değildir. Frontend/Vercel uygulaması bu sözleşmenin değişiklik kapsamına girmez; dış e-posta ve gerçek yük/restore kabulü ayrı kalır.

K — Geliştirme commitlerinde hızlı ve birikimli değişikliklere göre hedefli CI; son runtime/CI adayında açık full clean; merge sonrası aynı main SHA için full clean. Güvenli yalnız-belge değişikliği mevcut CI politikasının kaynak bağlı yolundan geçer. Bir dosyanın belge olması tek başına onu güvenli izin listesine eklemez; workflow/kapılar bu teslimle değiştirilmez.

#### 13. Önerilen teknik sözleşme

Bu bölüm T statüsündedir. Mevcut typed domain komutları korunur. Yeni ortak settings read/write endpoint’i kabul edilmiş değildir; API analizi sonunda ortak okuma modeli veya domain komutları arasında seçim yapılacaktır.

| Alan grubu | Asgari tanım |
| --- | --- |
| Kimlik ve kapsam | Sabit setting_key; definition_version; scope_type; kapsam için gereken account/org/center/disiplin veya cihaz referansları. Key adları bu taslakta kavramsaldır. |
| Değer ve tip | Kapalı şema, veri tipi, izinli enum/aralık, null/unset/false anlamları; hassas alan sınıfı. Bilinmeyen anahtar ve alan reddedilir. |
| Varsayılan ve miras | default_value veya kararsız; default_source; canlı miras/kopya/yerel sabit modu; izinli override kapsamları ve anahtara özgü çözümleme. |
| Etkin sonuç | Yetkili okuyucuya stored_value, effective_value, effective_source, inherited_from ve overridden/locked bilgisi; yazılamama nedeni gerektiği kadar açıklanır. |
| Yetki ve özellik | read_permission, write_permission; gerekli plan/özellik, canlı tenant/merkez/disiplin ve hesap sahipliği kontrolleri. Rol adı yeterli değildir. |
| Sürüm ve zaman | İlgili mevcut row version veya append-only zincir; effective_at, changed_at, changed_by ve gerekçe. Geçmişe uygulama yalnız mevcut açık komutla. |
| Etki ve kanıt | Etki sınıfı, gerekli preview/onay, bağımlılık sürümleri, audit/receipt ve bildirim sonucu. Hukuki tercih ve onay kanıtı ayrı alan ailesi. |
| Uygulama durumu | Sözleşme kabulü, API eşlemesi, runtime kapsamı, son doğrulanan kaynak ve kabul kanıtı ayrı sütunlar; görünüm özelliği runtime kabulü değildir. |

##### 13.1 Okuma ve yazma davranışı

T — Okuma yan etkisizdir; yalnız yetkili alanlar döner. Mevcut bir anahtarın etkili kaynağı ve kullanıcıya görünen değeri çelişmez. Secret değerler dönmez; yalnız maskeli durum/referans sunulur. Diğer tenant veya kullanıcının varlığı hata/yanıt üzerinden açılmaz.

K/T — Güncelleme, mevcut komutun sürüm ve operation_key sözleşmesini izler. Row-version komutlarında eski sürüm kazanamaz; append-only policy_publish gibi komutlara gelişigüzel expected_version eklenmez. Aynı anahtar ve aynı iş yükü mükerrer yan etki üretmez; farklı yükle replay reddedilir. Bağlı iş etkisi, audit ve receipt gerektiği yerde aynı transaction içinde geri alınır.

T — Çoklu ayar kaydetme özelliği sunulursa atomik mi alan bazlı mı olduğu açıkça tanımlanır; kısmi başarı tam başarı gösterilmez. Önizleme, tam değişiklik kümesine ve bağımlılıklarına bağlanır; yetki/plan/sürüm/zaman değiştiğinde yeniden doğrulanır. Sayısal config yoksa güvenli ve açıklanabilir hata verilir.

#### 14. API uygunluğu ve açık iş analizi

Aşağıdakiler mevcut kaynakta doğrulanan başlangıç eşlemeleridir; tüm katalog için API denetimi tamamlandı iddiası değildir. Eski decision_delivery notları tek başına güncel eksik ilan etmek için kullanılmamıştır.

| Kapsam | Mevcut kaynak / eşleme | Sonuç veya analiz gereği |
| --- | --- | --- |
| U01 | account_get_v1; account_profile_update_v1; management_state_get_v1 | Display_name okuma/yazma ve sürüm yolu var. Fotoğraf, doğrulanmış iletişim ve orga yayılma aynı DTO’da yok; ayrı eşleme gerekir. |
| U03 | account_password_change_v1; account_password_reset_request_v1 | Başlatıcı ve native Auth tamamlama akışları ayrıdır. Başlatma yanıtı, parola değişti veya dış e-posta ulaştı kanıtı değildir. |
| U12–17 | notification_preferences_set_v1; management_state_get_v1; database/p05-notifications.sql | Amaçlar transactional/reminder/marketing. Şemada in_app/email olsa da mevcut geliştirme yolu in_app ile sınırlı; transactional=false reddedilir. |
| U19–21 | Yeni tercih alanları için eşleme bekler | NotificationPurpose enum’una reklam/analitik amaçlarını kendiliğinden ekleme. Ayrı amaç/dayanak, provider ve kuyruk kapısı analizi gerekir. |
| C08–11 / O08–10 | policies_get_v1; policy_publish_v1; negative_limits_get_v1; negative_limit_set_v1 | Mevcut anahtar/sürüm/koruma akışı kullanılmalı; bu belge alternatif politika motoru oluşturmaz. İlgili DTO ve tüketiciler alan bazında incelenecek. |
| U23 / O24 | account_delete_preview/apply_v1; organization_close_preview/apply_v1; organization_reopen_v1; organization_delete_preview/apply_v1 | Ayrı lifecycle komutları korunur. Gerçek imha tamamlanması kanıt koşullarına tabidir. |
| Diğer aileler | 08 makine sözleşmesi; endpoint-inventory; implemented.json | Her ailenin alanları mevcut komutlara tek tek eşlenecek. Genel ayarlar endpoint’i veya desteklenmeyen iş akışı var sayılmayacak. |

##### 14.1 Her alan için doldurulacak analiz kaydı

setting_id + field_key | karar durumu | kapsam | tip/varsayılan kaynağı | read operation + response alanı | write operation + request alanı | permission/feature | sürüm/etki/snapshot | mevcut runtime sınırı | doğrulama SHA/kanıt | gap türü | bağımlılık | iş sahibi/kabul ölçütü.

Gap türleri T önerisidir: ürün kararı; sözleşme/DTO; runtime; yetki/plan; okuma projeksiyonu; veri aktarımı; istemci/cihaz; sağlayıcı; doğrulama/işletim. “Eşleme bekliyor” ile “eksik API doğrulandı” ayrı statülerdir.

##### 14.2 İşe dönüşüm

Önce K hükümleri mevcut sözleşme ve runtime ile karşılaştırılır; sonra A aileleri alanlara ayrılır. Yalnız doğrulanan fark için iş açılır. Yeni API gerekirse tip, izin, guard, hata, idempotency, sürüm/preview ve kabul senaryoları birlikte tanımlanır. Uygulama tesliminde etkilenmiş sözleşmeler, makine kontratı, envanter ve devir birlikte güncellenir.

#### 15. Açık kararlar ve kabul ölçütleri

| ID | Karar / takip | Kapanış ölçütü |
| --- | --- | --- |
| X01 | Katalog onayı | A ailelerinden hedef sürüme alınacak alanlar ve ertelenenler seçilir; hepsi otomatik taahhüt sayılmaz. |
| X02 | Varsayılanlar ve sınırlar | Üç K tercih dışındaki değerler; sessiz saat/özet, kritik istisna, görünürlük, limit ve süreler kaynak kararıyla atanır. |
| X03 | Hukuki aktarım | Amaç, dayanak, rıza gerekiyorsa kanıt/geri çekme, saklama ve sağlayıcı kapsamı ayrıca değerlendirilir; ürün varsayılanı onay sayılmaz. |
| X04 | Kimlik ve abone | Ad ve doğrulanmış iletişimin onaysız yayılımı, bağlantı kaldırmada durması ve organizasyon içinde sabit tekil abone numarası K. Kalan API/veri aktarımı, alias/merge ve format/tahsis ayrıntıları açık olarak alan bazında aktarılır. |
| X05 | P08 ve plan temsili | Sınırsız Business limiti, ayrı kontenjan/sınırsız etkinlik ve ders tüketmeyen paket katılımı mevcut P08 sırasında çözülür; settings ile geçici bypass kurulmaz. |
| X06 | API ve istemci | Her alanın mevcut DTO/runtime eşlemesi; yeni ihtiyaç varsa sözleşmesi; cihazda yerel/senkron kapsamı ve gerçek entegrasyon kanıtı belirlenir. |

##### 15.1 Asgari davranış kabulü

- Yetkisiz kullanıcı başka hesap/org/merkez değerini okuyamaz veya yazamaz; Owner olup CM olmayan aktör merkez operasyonu yapamaz.
- Zorunlu org politikası yerel ayarla aşılamaz; izinli istisna yalnız kendi anahtarı/kapsamında çalışır. Mirası sıfırlamak false yazmaktan farklıdır.
- Eski sürüm/önizleme ve geri alınmış yetki reddedilir; aynı işlemin tekrarı tek sonuç üretir. Geç audit/outbox hatası bağlı yazımları geri alır.
- Olumsuz politika/limit değişimi mevcut kesin rezervasyonu sessiz iptal etmez; önizleme/onay ve koruma kanıtı korunur. Geçmiş satış/anlaşma/finans snapshot’ı değişmez.
- Üç reklam/ölçüm tercihi ilk varsayılanda açık, ayrı ayrı kapatılabilir ve yeniden girişte korunur. Org/platform kullanıcı yerine yeniden açamaz; açık tercih rıza kaydı oluşturmaz.
- Kapatma sonrası isteğe bağlı kuyruk/SDK/veri toplama yolları etkin tercihi ve gerekli hukuki kapıyı yeniden kontrol eder; zorunlu işlem kayıtları ve diğer amaçlar yanlışlıkla kapanmaz.
- Mevcut in_app transactional kapatma yasağı korunur. Ertelenmiş email veya henüz desteklenmeyen push/SMS başarılı teslim gibi gösterilmez.
- Kullanıcı görüntüleme saat dilimi satış/seans iş zamanını değiştirmez. Profil/iletişim değişimi grant veya geçmiş hukuki belgeyi değiştirmez.
- Hesap/org silme, yenilememe ve kapatma farklı komut/durumlar olarak kalır. Eksik fiziksel imha kanıtı partial/pending kalır; yeniden canlanma engellenir.

### Ek kullanıcı aileleri

U25 Güvenlik hareketleri: kullanıcıya kendi giriş, iletişim değişikliği ve kurtarma olaylarını sır/token göstermeden sunma; ayrıntılar açık. U26 Tercih sıfırlama: alan/grup/ekran/cihaz/hesap kapsamı; kabul edilmiş görünüm grubu sıfırlaması izin ve bildirimleri değiştirmez. Diğer kapsamların ayrıntıları açık.

## Pilot operasyonel güvenlik aktarımı — 25 Ekim

Yeni kullanıcı talimatı beş ayar API/alan kabulü ve gerçek pilot zinciri/restore hazırlığıdır. İlk207/62 adayı davranış kararı eklemez: worker connection/session search_path sabitlemesi ve platform event-trigger EXECUTE daraltması. COMMIT yapabilen ops_run üzerine SET clause eklenmez. [Yöntem ve açık kabul sınırı](../remaining-work.md). Sentetik pilot verisinin geliştirme ortamında kalıcı tutulması kabul edildi; gerçek kayıtlar korunur, dağıtım öncesi reset şimdi yapılmaz.


### 26 Ekim — S08/S09 uygulama alan eşlemesi

Kullanıcı uygulama yazı ölçeği font_scale:number0.75–2|null; null OS/cihaz tercihini izler. Sabit başlangıç startup_context:null|{org_id,center_id,discipline_id}; alt iki ID nullable, disiplinde merkez gerekir. remember_context=true son bağlamı cihazda kullanır; false sabit bağlamı seçer. Üst seçimde uyumsuz alt seçimler istemcide temizlenir ve nesne atomik kaydedilir. Canlı link/kişi/org/merkez-plan/rol-ilişki ve merkez-disiplin denetimi yazma/tekrarda korunur; kayıp erişimde okuma null ile yeniden seçime döner. Geçersiz kayıt domain yetkisi yaratmaz. Bu teknik aralıklar ve wire eşlemesi yeni ana davranış grubu değildir; S08/S09’un ekran/rol ve gerçek frontend kabulü dahil tamamı kapanmış sayılmaz. [Güncel API aktarımı](../frontend-settings-handover.md#kullanici-gorunum-baslangic-20261026).

## PR50 S04–S06 güvenlik uygulama eşlemesi

Kararlar yeniden açılmaz: ilk MFA doğrulayıcı uygulama TOTP, native kayıt/challenge/verify; verified factor sonrası uygulamada hem signed JWT aal2 hem exact live native session aal2 zorunlu. Current logout kullanılabilir. Hassas others logout ve TOTP kaldırma aynı mevcut taze native sign-in session proof’u gerektirir; eski refresh token yeni sign-in sayılmaz. account_totp_remove_v1 yalnız exact own factor için kısa10sn intent, transactional native DELETE/history ve tamamlanmış sonuç okuması sunar; verified factor doğrudan native kaldırma backend intent olmadan yasaktır. Bu intent authorization’dır, native isteğin JWT’sini SQL’de doğrulama değildir. Bir faktor olayı bütün MFA durumuyla eşitlenmez. Ayrıntılı alan ve consumer devri docs/frontend-settings-handover.md içindedir; bu kaynak adayının native/CI/hosted kabulü ayrı izlenir. Google/passkey/trusted-device/recovery ve rol zorunlu MFA politikası bu eşlemeyle uygulanmış sayılmaz.

## 26 Ekim teslim1 — Resend ve güncel kimlik uygulama aktarımı

Son kullanıcı talimatıyla platform e-postalarında Resend kullanılacaktır; önceki dış e-posta ertelemesi bu kapsamda kaldırılmıştır. Native Auth email-change/password/recovery proof üretimi ve doğrulaması korunur; custom SMTP sağlayıcısı Resend’dir. Hazır olmayan provider veya delivery başarı taklidiyle kapatılamaz. Google ve telefon gerçek sağlayıcı aktivasyonu ayrıca gerekir. SMTP kurulum kararı pazarlama rızası veya kampanya gönderim yetkisi değildir.

Global current kimlik, aktif/doğrulanmış linkli org kişisine otomatik yansır; UUID ve tarihsel belge snapshot’ı korunur. Link kaldırma gelecekteki yayılımı durdurur; reopen catch-up ve alias mapping yaşam döngüsü birlikte uygulanır. Doğrulanmış iletişim kaynağı native Auth confirmed alanlarıdır, user_metadata veya org görevlisinin verdiği verified flag değildir. Ters org row-lock sıralı yarışlarda account sync try-lock kaybedeni TEMPORARY_FAILURE ile bütün transaction’ı geri alır; receipt/name/contact/inbox kısmi başarı bırakılmaz. Son-source/native/hosted/CI kabulü production-queue kaydında ayrı izlenir.

Başlangıç görünen adı hesap oluşturulurken native kayıt metadata/adres değerinden bir kez private profile kaynağına alınır; mevcut açıkça yazılmış profil korunur. Sonraki ham user_metadata veya e-posta değişiklikleri görünen ad için ikinci canlı kaynak değildir. Profil API’si değişikliği aktif güvenli bağlantılara aynı transaction’da yayar. Bu65. migration taslağıdır; native/aday/main/CD kabulü ayrıca bekler.

Doğrulanmamış telefon yerel65 adayında account_profile_update_v1.unverified_phone ile E.164 biçiminde kaydedilir; null yalnız bu doğrulanmamış kaydı temizler, alanın gönderilmemesi mevcut değeri korur. account_get_v1.identity.unverified_phone ayrı döner; identity.phone/phone_verified_at yalnız native doğrulama kaynağındandır. Aynı numaranın doğrulanmış native değer olması halinde doğrulanmamış kopya gösterilmez. Org canonical iletişimlerine otomatik yayılmaz, giriş/sahiplik kanıtı değildir. Native SMS pending_phone ile aynı alan değildir. Sürüm/receipt/profile audit mevcut yol üzerinden korunur. Yerel149 yapısal kontrol geçti; eklenen native regression henüz koşulmadı, önceki10/10 sonucu bu yeni alana taşınmaz.
