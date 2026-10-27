## 27 Ekim — güncel Starter kapanışı ve sıradaki teslim

Kabul edilmiş main `fc96dc15f336abed20cd0a6c73d84a5b0e3b08b0`:213 API/67 migration/90 core tablo/Edge21 ACTIVE/JWT açık. [PR58](https://github.com/SXQHex/FtkSaaS/pull/58) tek-stüdyo runtime kabulünü, [PR59](https://github.com/SXQHex/FtkSaaS/pull/59) belge kapanışını taşır. [Main40483793353](https://github.com/SXQHex/FtkSaaS/actions/runs/40483793353) ve [development CD40487227365](https://github.com/SXQHex/FtkSaaS/actions/runs/40487227365) başarılıdır.

Kimlik/iletişim/oturum güvenliği, Starter plan kapıları ve sürümlü downgrade, tek-stüdyo40/5 kapasite ve50 fiziksel tavan, kredili/kotalı süreli/sınırsız satış→tahsilat→self rezervasyon→yoklama/hak tüketimi kapalı teslimlerdir. Disiplin ön eki/ad değişikliği ve eski satış sürüm bütünlüğü kabul edilmiştir. Bu alanlar eski aday notları yüzünden yeniden açılmaz.

Aktif kullanıcı talimatı: önce mevcut belge kabul yolunda güncel durum eşitlenir; sonra yeni işletmenin başlangıç ayarları (default/miras/yetki/domain tüketicileri) ve öğrenci self/public başlangıç akışı tek Draft PR içinde tamamlanır. Geliştirme sırasında odaklı testler; son kaynak bağımsız incelemesi sonrası tek aday full clean. Main kabulü ve development CD korunur. Genel ayar JSON’u, mock Turnstile veya kod varlığı gerçek domain/sağlayıcı kabulü değildir. Gerçek hostname/widget/gateway/tenant/config önkoşulları mevcut bağlı kaynaklardan incelenir; eksik ticari değer veya sağlayıcı kanıtı uydurulmaz.

Bu belge eşitlemesi runtime/migration/CI/izin listesi değiştirmez ve full-clean label’ı istemez. Tarihsel raporlar korunur. Aşağıdaki önceki tarihli kayıtlar kendi kaynaklarının geçmişidir; güncel açık iş için remaining-work.md esas alınır.

## 27 Ekim — tek stüdyo kurulum ve ürün adı sürümü kabul edildi

Dar native tek-stüdyo7/7 ve seri Starter kapı9/9 geçti; kaynak hashleri ve başarısız ilk koşular [kabul kaydındadır](reports/starter-studio-20261027.md). [PR #58](https://github.com/SXQHex/FtkSaaS/pull/58) main `5639783b5dcd963d84bb76ec7bdf75d65a75ced5` üzerinde kabul edildi: **213 API / 67 migration / 90 core tablo**. Son head `a9a09c8685d706d6f9abab842aeb10c7c90b565d` bağımsız incelemesi5662350042, [aday full clean40452100471](https://github.com/SXQHex/FtkSaaS/actions/runs/40452100471), [aynı main full clean40476673333](https://github.com/SXQHex/FtkSaaS/actions/runs/40476673333) ve [development CD40479412819](https://github.com/SXQHex/FtkSaaS/actions/runs/40479412819) başarılı. Aday ve main tree `3d1fc9d98c6eea8864c7bb99e9d7515200a86a74` aynıdır. CD67 migration içerik eşliğini ve20/20 kontrolü doğruladı;67 gerçekten uygulandı. Edge kaynağı değişmediği için yeniden deploy edilmedi; mevcut backend-v1 Edge21 ACTIVE ve `verify_jwt=true` korundu.

Başlangıç main `5892b3cb729d62a045358ffdc588a66361331537`; aynı kaynak main clean40430528120 ve development CD40432912898 başarılı. Kabul edilen kapsam **213 API / 67 migration / 90 core tablo**; önceki66 migration değişmez. Güncel F16 plan izi zaten Starter/Pro/Business’tır; eski Pro/Business-only etiketleri yeniden uygulanmaz. Başlangıç kaynağının kabulü ile yukarıdaki67 migration kabulü ayrı kaynaklara aittir.

Mevcut merkez/oda/disiplin/eğitmen/uygunluk/politika/program/paket/satış/rezervasyon/yoklama komutları kullanılır; yeni kurulum modülü veya endpoint yoktur. `core.product_versions.published_name` sürüme bağlı ad snapshot’ıdır. Eski sürümler yalnız migration öncesinde gerçekten saklanan ürün adıyla doldurulur; bilinmeyen eski adlar uydurulmaz. Starter yayını `terms.name` değerini kendi sürümüne kaydeder; güncel katalog etiketi de güncellenir. Diğer planlarda mevcut ürün kimliği adı davranışı korunur. Eski satışın product_version_id/tarih/bedel/kapsam/hakları yeniden yazılmaz.

Yeni yayın güncel disiplin adı ön ekini ister. Disiplin adı değiştikten sonra eski ön ekli sürümle yeni satış yapılmaz; aynı ürün kimliğinde doğru yeni adla yeni sürüm yayımlanabilir. Eski satışın uygun seçili kapsamındaki rezervasyon ve hak tüketimi devam eder. Canlı plan/yetki, scope, kapasite, borç, belge, kota ve receipt denetimleri korunur; genel JSON settings bu domain komutlarının yerine geçmez.

Kabul kaynağı `tests/starter-studio-acceptance.mjs` mevcut registry shard’ına bağlıdır: gerçek Starter kuruluşu; tek odada40 kişilik tekrarlı program ve ayrı saatte5 kişilik özel seans; eşzamanlı oda reddi ve fiziksel50 tavanı; kredili/kotalı süreli/sınırsız ürün satış-tahsilat-self rezervasyon-kapanış; ad/disciplin değişimi, immutable eski satış/sürüm ve sıfır hakediş. Test config/fiyatları yalnız sentetik kabul verisidir; yeni ticari/politika defaultu değildir. Bu alt teslim native kabul, bağımsız inceleme, aday/main full clean ve development CD ile kapandı. Bütün Starter dağıtım yol haritası veya production hazırlığı tamamlandı sayılmaz. Hedefli40436211363 öncelikli94 testi geçti, sonraki geniş regresyonda45 dakika sınırında iptal edildi; başarılı kabul sayılmadı. Son aday/main tam kapsamı ayrıca başarıyla geçti. Bu belge eşitlemesi yeni runtime test/deploy icrası değildir; tarihsel raporlar korunur.

## 27 Ekim — Starter plan kapıları teslimi kapandı

[PR #56](https://github.com/SXQHex/FtkSaaS/pull/56) main `ed747324f7d008b24103d4fd2eba503791c70a93` üzerinde kabul edildi: **213 callable API / 0 contract_only / 66 migration / 90 core tablo**. [Aday full clean40419827224](https://github.com/SXQHex/FtkSaaS/actions/runs/40419827224), [aynı main full clean40422823564](https://github.com/SXQHex/FtkSaaS/actions/runs/40422823564) ve [development CD40425584520](https://github.com/SXQHex/FtkSaaS/actions/runs/40425584520) başarılı. CD gerçek deploy ve20/20 hosted kontrol içerir; backend-v1 Edge21 ACTIVE, `verify_jwt=true`. JWT doğrulaması son kullanıcı kararıyla açık kalır.

Starter limitleri **1 merkez / 1 aktif oda / 1 disiplin / 1 aktif eğitmen / 100 aktif öğrenci**; tek mantıksal oda, seçili merkez-disiplin paketi ve disiplin adı ön eki uygulanır. Genel CRM/etkinlik/personel/hakediş kapalı; yoklama anlaşmasız ve hakedişsiz çalışır. Canlı plan/kapsam kapıları eski receipt/preview/grant ve doğrudan RPC ile aşılamaz. Pro→Starter kapsam seçimi sürümlüdür; seçilmeyen operasyon kapanır, geçmiş seans/kesin rezervasyon/hak/finans kayıtları korunur. [DTO, kapsam ve kabul kanıtları](docs/starter-plan-gates-handover.md).

Bu kapanış yalnız plan kapıları ve sürümlü kapsam düşürme teslimidir; bütün Starter dağıtım yol haritası, gerçek public hostname/Turnstile, Pro/Business ayrı limit/özel teklif veya production hazırlığı tamamlandı sayılmaz. Aşağıdaki önceki kaynaklara ait tarihli aday/bekleme/envanter notları tarihsel checkpointlerdir; güncel kabul veya açık iş olarak kullanılmaz. Tarihsel `reports/` dosyaları ve eski kaynak snapshotları korunur. Bu belge eşitlemesi yeni runtime testi veya deploy değildir.

## 26 Ekim — satır 1 runtime ve hosted kabulü tamamlandı

Kimlik, doğrulanmış iletişim ve hesap güvenliği tesliminin backend/hosted kabulü tamamlandı. Runtime kaynak main `7464383802deb8322e14a5ebec7d5e2ef650e436`: bağımsız review5656369798, PR54 aday [40370157098](https://github.com/SXQHex/FtkSaaS/actions/runs/40370157098), aynı main [40374760224](https://github.com/SXQHex/FtkSaaS/actions/runs/40374760224) ve gerçek development CD [40378100016](https://github.com/SXQHex/FtkSaaS/actions/runs/40378100016) başarılı. CD receipt20/20; canlı213 API/65 migration/Edge20 ACTIVE/verify_jwt=true. İlgili14 SQL fonksiyon gövdesi kaynakla aynı; aktif ad/iletişim projeksiyon farkı0. [Native kurtarma, sağlayıcı ve temizlik kanıtı](docs/remote-backend-setup.md#teslim1-native-kurtarma-kabul-20261026). Bu kapanış belgesinin kendi kaynak bağlı belge CI/merge kabulü runtime kabulünden ayrıdır; belge değişikliği yeni full-clean veya deploy icrası sayılmaz.

Son kullanıcı kapsamı: native Supabase Auth ana yoldur; Turnstile yalnız hesapsız public başvuru/giriş yollarındadır. Native Auth CAPTCHA etkinleştirmesi ve geçici özel kurtarma gateway testi satır1 kapanış şartı değildir. Canlı Auth CAPTCHA kapalı; Email/Google/manual linking/confirmed email/TOTP açık, phone login kapalı. Son kararla özel66 reset SQL/marker/trigger iptal edildi; kurtarma oturumu korunur, diğer native oturumlar kapanır. Yeni Auth tüketicisi native SDK/endpoint kullanır; yayınlanmış eski API uyumluluğu korunur. Belirgin güvenlik veya fonksiyon zafiyeti yoksa sağlayıcı davranışını tekrar eden bakım katmanı eklenmez.

Gerçek sentetik hosted kabul18/18 geçti: native signup ve e-posta proof/replay, iki kullanıcı oturumu ile Auth→Edge→RPC, native recover ve gerçek recovery proof/replay, yeni parola, kurtarma oturumunun korunması, iki eski oturumun Edge+refresh reddi, eski parolanın reddi, yeni parolayla Auth→Edge→RPC. testin exact-ID hesabı/profili/native oturumları temizlendi ve yokluk geri okuması yapıldı. Gerçek kullanıcı parolası veya kurum verisi değiştirilmedi. Parola/token/proof/kişisel adresler kaynaklara kaydedilmez.

Native hız limitleri sağlayıcı ayarlarıdır; IP başına giriş/kayıt30/5dk, token doğrulama30/5dk, refresh150/5dk, aynı kullanıcıya SMTP e-postası minimum60sn. Eski900sn/IP10/adres3 sayacı yalnız uyumluluk kurtarma endpoint'ine aittir; native Auth'a uygulanmış sayılmaz. Secure email change açık; native secure password change ve current-password zorunluluğu kapalıdır. Özel account_password_change_v1 challenge'ı native endpoint için zorunlu ön kapı değildir. Bu mevcut sağlayıcı davranışı ek function ile değiştirilmiyor.

Gerçek SMS sağlayıcısı, public başvuru alanının Turnstile/siteverify kabulü, frontend ekranları ve genel production/yük/afet dönüşü ayrı kapsamdır; tamamlandı gösterilmez. Önceki13 Google/hosted TOTP/iletişim/native yarış-rollback kabulü kaynak/main kanıtlarıyla korunur. Aşağıdaki eski taslak, bekliyor ve CAPTCHA-kurtarma şartları tarihsel checkpointlerdir; satır1'i yeniden açmaz. Tarihsel reports dosyaları değiştirilmez.

## 26 Ekim — PR53 ve gerçek Google kabulü; S04 kapanış adayı

Güncel main `7086d7e00c142b9049e3d76cb8ac2f587fdaa5b6`: PR53 aday full clean40314333376, aynı main clean40318033261 ve gerçek development CD40320789568 başarılı. Yayımlanmış kapsam213 API/65 migration/Edge12. Önceki PR52 CD cleanup hatası dar fixture düzeltmesiyle kapandı; aşağıdaki eski pending/draft kayıtları kaynaklarına ait tarihsel checkpointlerdir.

Gerçek Google kimliği mevcut hesaba native ID-token yoluyla bağlandı: hazırlıksız bağlama ve yanlış nonce reddi dahil13 kontrol geçti; native kullanıcı/core UUID ve birincil doğrulanmış e-posta değişmedi, ikinci hesap yaratılmadı. Manual linking açık ve yeniden yüklemeyle doğrulandı. Bağlama güvenlik e-postası Resend'de delivered; yalnız kabul testinde oluşan native oturumlar ve refresh kayıtları kapatıldı. Sağlayıcı tokenı, parola ve kişisel iletişim bilgileri bu kayda alınmadı.

**Birinci satır hâlâ aktiftir.** Kalanlar: native Auth/Turnstile gerçek sağlayıcı kabulü ve son kaynak/adayı/main/CD. Özel66 taslağı son kararla iptal edilmiştir; mevcut65 migration değiştirilmez. Yeni full clean henüz başlatılmadı. Gerçek SMS dış entegrasyondur ve backend kapanış kapısı değildir.

Kullanıcının seçtiği kurtarma istek limiti:15 dakika içinde IP başına10 ve normalize e-posta başına3; adres yerine anahtarlı hash saklanır. Hosted kurulum ve gerçek kapı kabulü bu kararın kaydedilmesiyle tamamlanmış sayılmaz. Kanıt ayrıntısı [kimlik ilerleme raporundadır](reports/account-identity-progress-20261026.md).

## 26 Ekim — PR52 main kabulü ve CD cleanup düzeltmesi

PR52 main043347e8e23e671059285f5f20d86f1c0fafe9ad: aday40302913868 ve aynı main40309879942 full clean başarılı;213 API/65 migration. CD40312648189 migration65 ve Edgev12’yi uyguladı; Auth→Edge→RPC, tenant/direct-RPC/JWT/session kontrolleri geçti fakat synthetic_fixture_removed başarısız. Yeni otomatik p07_profiles FK’si CD’nin eski hesap temizliğini engelledi; CD başarılı sayılmaz. Yalnız CD fixture UUID’sine bağlı profil+hesap temizliğini atomik yapan dar script/test düzeltmesi hazırlanıyor; kalıcı FK/retention/ürün API davranışı değiştirilmez. Gerçek Google bağlama ve başarılı CD kabulü hâlâ açık; birinci satır kapanmadı. Ayrıntı account-identity-progress-20261026 raporundadır.

26 Ekim son kabul:213/65 adayı için dar kimlik+profil/merge native22/22,0fail/skip/cancel (132.473sn) geçti; yerel SMS proof ve retired alias yeniden ekleme dahil. Gerçek SMS dış entegrasyon, Google gerçek bağlama/final kaynak incelemesi/aday/main clean/CD açık. Önceki503 bu koşuda tekrarlanmadı, kök neden iddiası yok. Kanıt ve kaynak hashleri account-identity-progress-20261026 raporundadır. Sandbox kanıt alınınca durduruldu.

26 Ekim devam checkpoint: yerel teslim1 adayı213 API/65 migration. Native kimlik/iletişim suite10/10 geçti; mevcut profil/merge tekrarında boş503 nedeniyle9node7pass2fail, temiz kabul yok. Google fresh reauth exact-subject/10sn hazırlık API’si ve native INSERT fence eklendi; gerçek provider binding, eski-kanal güvenlik teslimi/SMS ve son kaynak/CI açık. Hosted7 security mail bildirim ayarı açıldı. Main hâlâ212/64, uygulama taslağı push/PR/merge edilmedi. Ayrıntı production-queue ve ara rapordadır.

## 26 Ekim — SMS dış entegrasyon kararı (son kullanıcı kabulü)

Telefon numarası kaydedilebilir; gerçek SMS proof tamamlanmadıkça doğrulanmamış kalır. Numaranın kaydedilmesi, doğrulanmış iletişim yayılımı, hesap sahipliği kanıtı veya telefonla giriş yetkisi değildir. Ücretsiz geliştirme testlerinde yalnız izole yerel test OTP kodları kullanılabilir; bunlar gerçek SMS gönderimi/teslimi veya hosted provider kabulü sayılmaz. Sabit test kodları hosted ortama uygulanmaz.

E-posta/parola, gerçek Google giriş/bağlama ve doğrulayıcı uygulama TOTP ile ilerlenir. Gerçek SMS sağlayıcısı kurulumu ayrı dış entegrasyon statüsündedir; birinci satırın diğer backend işlerini ve backend kapanışını engellemez. SMS'in gerçek sağlayıcı kabulü tamamlandı işaretlenmez. Doğrulanmamış telefon kaydetme/okuma yolu ile yerel proof/test-code davranışının uygulama kabulü backend kapsamındadır; bu karar tek başına yeni alan/API'nin uygulanmış olduğu kanıtı değildir.


# FtkSaaS çalışma kuralları

## 26 Ekim — sıralı backend kapanışı: yalnız teslim1 aktif

Kullanıcı her satır eksiksiz tamamlanınca yalnız sonraki işin satırının gösterilmesini istedi. Aktif teslim kimlik, doğrulanmış iletişim ve hesap güvenliğidir; ikinci pakete geçilmez. **Platform e-postaları için Resend kullanımına açık yetki verildi.** Önceki dış e-posta/Resend ertelemesi bu teslim bakımından kaldırıldı; marketing veya diğer organizasyonlara rastgele gönderim yetkisi değildir. Google ve telefon sağlayıcısı hosted public Auth ayarlarında kapalıdır; eksik gerçek sağlayıcı kabulü kod/fixture başarısıyla kapatılmaz.

Başlangıç main26e7091cd73482a623839266324b049d617fe9c2: PR50 main clean40246191868 ve development CD40247685028 başarılı, gerçek deploy/hosted kontrol yapıldı;212 API/64 migration. Önceki PR50 aday/bekliyor kayıtları tarihsel snapshot’tır. Aktif65. migration henüz yerel taslak; source review/native/aday/main/CD kabulü yoktur. [Aktif teslim ve kanıtlar](docs/production-queue.md#teslim1-kimlik-iletisim).


## 26 Ekim — PR50 hesap ve güvenlik teslim paketi

PR50 yerel kapsamı **212 callable API / 64 migration**,46 ayar alanı/44 writable; başlangıç main `a7569bbb11353dc342804eb5050800d77a31a8e9`. İlk207/63 iki alan adayı aşağıda tarihsel snapshot’tır. Yeni beş işlem kendi oturumlarını listeleme/etiketleme/kapatma, güvenlik geçmişi ve güçlü doğrulanmış TOTP kaldırmayı kapsar. Native TOTP enrollment/challenge/verify sağlayıcıda kalır; verified factor varsa uygulama ve SQL hem doğrulanmış JWT aal2 hem canlı native session aal2 ister. Genel tercih patch’i güvenlik işlemlerini değiştirmez.

Oturum/refresh iptali ve geç hata rollback’i dar native testte geçti. Native sağlayıcının eski aal1 token ile aynı-session factor kaldırmasını kabul ettiği görüldü; bu negatif assertion korunarak10 saniyelik, yalnız aynı faktöre ait güçlü yeniden doğrulanmış kaldırma niyeti ve transactional native DELETE koruması eklendi. Son koruma gerçek native Auth üzerinde4/4 geçti (23.229sn); resetin ilk üç özgün akışı4/4 (44.889sn), ayrılan başlangıç grubu2/2 (51.937sn) geçti. Bağımsız incelemede bloklayıcı bulgu kalmadı; son commit/tree bağı ve aday/main clean/CD bekler. Eski başarısız aday40237107409 bu genişleyen kaynağın kabulü değildir; yeni full clean başlatılmadı. Uygulanmış62 migration değişmez;63–64 henüz adaydır.

Bu paket beş ekranın/69 grubun tümü değildir. Global ad/doğrulanmış iletişim yayılımı, avatar/logo, gerçek Google sağlayıcısı, takvim bağlantısı ve diğer özel consumer açıkları korunur. Hosted TOTP yapılandırması, yeni Auth trigger’larıyla hosted restore ve aynı-main CD kabulü kanıtsız kapatılmaz. Ayrı dummy organizasyon veya yeni CI altyapısı kurulmaz.


## 26 Ekim — frontendten bağımsız backend ürün kapanışı

Son kullanıcı hedefi frontend ekranlarını bitirmek değil, backend ürününü kullanıma hazır hale getirmektir. Gerçek ekran/render/tasarım kabulü backend kapanış şartı değildir; öğrenci/eğitmen/yönetici yetkili native Auth→Edge→RPC akışları ve typed API davranışı backend kapsamındadır. Ekran ihtiyacı veya onaylı renk/font dosyası yokluğu desteklenebilir backend API/alan yaşam döngüsünü topluca erteleme nedeni yapılmaz; gerçek provider/asset gerektiren kabul ayrıca açık tutulur.

İlerleme küçük alan çiftleri yerine tamamlanan kullanım akışlarıyla raporlanır. Geliştirmede değişen akışa odaklı doğrulama, son kaynak bağımsız incelemesi ve tamamlanmış teslim paketinde tek aday full clean uygulanır; merge sonrası aynı main clean/CD korunur. Assertion, envanter, tenant/rol ve kaynak bağı gevşetilmez. Yeni CI altyapısı kurulmaz.

PR50 head94316373 aday40237107409 başarısız: core/API2/API3/API4 geçti; API1’de ayar parent testi300000ms sınırında kesildi, son alan matrisi parent iptali aldı. İş kuralı assertion hatası kaydedilmedi; bu başarılı kabul sayılmaz. Yerel düzeltme yeni başlangıç akışını ayrı Auth/org fixture’lı, aynı300s parent/120s child sınırları olan gruba ayırır; mevcut assertion ifadeleri aynen korunur. Bu değişiklik için yeni full clean henüz istenmedi; dar runtime kabulü ve teslim paketi kapanışı bekler.

## 26 Ekim — kullanıcı görünüm ve başlangıç ayarı adayı

Başlangıç main `a7569bbb11353dc342804eb5050800d77a31a8e9`: PR49 belge kabulü40235383940 ve development CD40235449919 başarılı; runtime kaynağı PR48/34aac276 için full clean40232332540 ve CD40234018404 kabulü korunur. Bu uygulama adayı **207 API/63 migration**,46 genel ayar alanı/44 writable içerir; kullanıcı alanı18’den20’ye çıkar. Aynı altı settings API’sine font_scale ve startup_context eklenir, katalog sürümü2’dir. Eski62 migration değiştirilmez; yeni migration20261025213014.

Yazı ölçeği ve sabit org/merkez/disiplin seçimi kullanıcı hesabına aittir; yetki/plan veya merkez iş timezone’u değişmez. Canlı erişim kaybında başlangıç bağlamı null döner, aynı yazma receipt’i yetki denetimini atlayamaz. UI tasarımı değiştirilmedi; ekran/rol başlangıcı, kayıtlı filtreler ve kalan69 grup bu iki alanla tamamlanmış sayılmaz. [Alanlar ve tüketici sınırı](docs/frontend-settings-handover.md#kullanici-gorunum-baslangic-20261026). Son aday inceleme/full clean/main/CD kabulü henüz bekler.

## 26 Ekim — PR48 kabulü ve ürün önceliği

Main `34aac276ba124405cc99129a354ff61c376977d1`:207 API/62 migration. PR48 head0397d8ba için bağımsız review5645032155 + aday40230141266 ve exact-source kullanıcı kurulum onayı sonrası normal merge yapıldı. Aynı main [clean40232332540](https://github.com/SXQHex/FtkSaaS/actions/runs/40232332540) ve [development CD40234018404](https://github.com/SXQHex/FtkSaaS/actions/runs/40234018404) başarılı; deploy adımı gerçekten çalıştı. CLI tam2.122.0; dört shard ve full/main assertionları korunur.

Son kullanıcı kararı: yeni altyapı/otomatik süre ölçüm sistemi geliştirilmez. Ayrı kalıcı dummy/pilot organizasyon oluşturma işi iptal edildi; yalnız mevcut sentetik verilerin her seferinde silinmesi gerekmiyor. Önce restore sahiplik/izin denemesi, ardından kalan ürün/ayar API’leri. Alttaki eski kalıcı pilot ve bakım önceliği notları tarihsel snapshot’tır; açık kurulum görevi olarak uygulanmaz. [Güncel kabul sınırı](docs/remote-backend-setup.md#restore-20261026).


## 25 Ekim — PR47 kabulü ve öncelikli CI bakımı

Main `9fd084b9ddbbefc225c98adbf3f25ddee85a9b6e`:207 API/62 migration. PR47 aday40218840402, aynı main40226464989 ve development CD40228555171 başarılı; önceki PR47 aday/pending notları snapshot’tır. Worker session pin ve dar EXECUTE kaynağı yayımlandı; hosted advisors’ta public.rls_auto_enable iki client EXECUTE uyarısı kalktı. COMMIT yapan ops_run için kalan search_path linter uyarısı güvenli session pin/role defaultu sınırıyla belgeli istisnadır; parola uyarısı önceki Free-plan kararıyla kapsam dışıdır. Son kullanıcı talimatı CLI tam2.122.0 ve gerçek sürelere göre dört shard dengelemesidir; full/main clean ve assertionlar korunur. [Bakım kaynağı ve ölçümler](docs/ci-performance.md). Kalan ayar alanları, kalıcı hosted dummy pilot ve restore/managed sahiplik kabulü açık iş olarak sürer. Veriler için kullanıcı teknik karar yetkisi verdi; bu bakımda hosted veri silinmez/değiştirilmez.

## 25 Ekim — aktif backend ve kalıcı pilot teslimi

Main `d6b67139445f2b88298fc0ee6e1f5c476f3586b7`:207 API/61 migration; PR45 main clean40206350648 ve development CD40207909599 başarılı. Aşağıdaki eski PR45 pending notları önceki aday snapshotıdır. Son kullanıcı talimatı beş ayar kapsamının backend/API kabulü, pilot zinciri ve restore/operasyon güvenliği teslimidir. Frontend için yeni alt alan kullanılacak; önce backend hazır edilir. Sentetik pilot verileri ayrı organizasyonda geliştirme Supabase’inde kalıcı tutulabilir; her koşuda silinmez. Dağıtım öncesi sıfırlama ayrıca yapılır; mevcut gerçek kulüp verileri şimdi silinmez. [Teslim sırası, kapsam ve kanıt sınırı](docs/pilot-readiness.md). Bu ilk aday207/62 olup bütün ayar/hosted pilot/restore kabulü değildir.

## 25 Ekim — PR45 kapasite ve main ayarları uzlaştırması

Başlangıç main `3456050a3061d7bf5dc2ce8898b82c5cfe84e773`: **206 callable API / 60 migration**; PR46 ayarları birleşti, aynı main clean [40200716603](https://github.com/SXQHex/FtkSaaS/actions/runs/40200716603) ve development CD [40202862244](https://github.com/SXQHex/FtkSaaS/actions/runs/40202862244) başarılı. Bu PR45 birleşim adayı kapasite işlemini ekler: **207 callable API / 61 migration**. Altı ayar işlemi ve kapasite davranışı birlikte korunur. Henüz uygulanmamış kapasite migration’ı main’deki ayar migration’ından sonra sıralandı; SQL içeriği ve mevcut 60 migration değişmedi. Önceki PR45 clean yalnız eski tabana aittir; bu birleşik kaynak için bağımsız inceleme ve yeni aday/main clean gerekir. Kapasite henüz main/hosted kabulü değildir.

[Alanlar, API'ler ve kesin destek sınırı](docs/frontend-settings-handover.md). Teknik SQL/worker yönetimi erteli; beş ekranın bütün 69 davranış grubu tamamlandı denmez. Hazır renk/font/logo, native provider/MFA/oturum ve diğer özel yaşam döngüsü açıkları bu genel tercihlere dönüştürülmez.


25 Ekim uzlaştırması: son kararlar Google ek kayıt/girişini kabul eder; Apple/Instagram login/bağlama kapsam dışı, passkey erteli. Kapasite hedefi nominal/maksimum değil tek seans toplam/kategori ve fiziksel oda tavanıdır. PR45’in `149be4f4` inceleme/full clean kanıtı eski taban içindir; bu kaynak main ayarlarıyla uzlaştırılmış 207/61 adayıdır, yeni kabul bekler. FD01–FD12 tekrar onaylatılmaz. PR43/44/45 kaynakları birleşirken son karar ve kaynak ayrımı korunur.

25 Ekim son kullanıcı kabulü: 17 kullanıcı/22 merkez/21 organizasyon/9 platform olmak üzere 69 ana ayar grubu tamamlandı. Backend/frontend ayrımı ve user/member/center/organization/platform scope sınıflaması yapıldı; FD01–FD12 frontend kararlarının tamamı kabul edildi. Standart başlangıç negatif limit 0, mevcut kulüp −2 korunur. Sonraki iş gerçek alan/DTO/permission/sürüm/API/kabul eşlemesi ve beş ekran teslimidir; kararları tekrar onaylatma, desteklenmeyen alanı hazır gösterme. SQL/Cron/DB/worker teknik işletim ayarları ertelenir; frontend beş ekranının alan/typed API/kabul boşlukları tamamlanır. Bu belge değişikliği tek başına yeni endpoint uygulandığı anlamına gelmez. Mevcut yerel platform-settings taslağı yayımlanmış sayılmaz. Frontend tasarımına müdahale etme.

P01–P07/PR40 kod/main/development kabulü kapandı; runtime main4cfc9a55, belge main7020638;200 API/0 contract_only/59 migration/90 core tablo/Edge8. Beş hosted worker temel kurulum ve idle heartbeat doğrulaması geçti. Fiziksel imha/yük/restore ve ek işletim kabulü açık; ayrıntılar [güncel devir](contracts/00-FtkSaaS-yeni-sohbet-devir.md). Eski GitHub ertelemesi ve PR40 pending notları tarihsel sınırdır; o kaynakta yalnız belge eşitlemesi yapılmıştı; yeni kullanıcı talimatı API/uygulama ve koşullu main teslimidir.

[Ayarlar sözleşmesi](contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) 69 S/M/O/P kabul grubunu, kapanmış FD alan kararlarını ve kalan teknik eşlemeyi ayırır. Davranış grubu numaraları eski Word aileleri ve üretim P01–P08 kuyruğuyla karıştırılmaz. Yeni davranış kararı otomatik runtime kabulü değildir. Word dosyası ayrı otorite değildir.

Vercel Sandbox yalnız yerelde çalıştırmanın mümkün olmadığı zorunlu dar doğrulamada kullanılabilir; kanıt alınınca durdurulur. Önceki salt belge tesliminin sınırı yeni uygulama görevine uygulanmaz; runtime değişikliğinde odaklı doğrulama, bağımsız inceleme ve gerçek aday/main clean gerekir. Mevcut CI kapıları/izin listesi değiştirilmez; güvenli yalnız-belge yolu kaynak bağlı olarak doğrulanır.

## Başlangıç ve kaynak önceliği

İşe başlarken çalışılan tam SHA’yı belirt. Önce [kaynak indeksini](docs/source-index.md), [güncel devri](contracts/00-FtkSaaS-yeni-sohbet-devir.md), [kalan işleri](docs/remaining-work.md), [entegrasyon devrini](docs/claude-handover.md), sonra görevle ilgili sözleşme ve kararları oku. GitHub’dan güncel main/PR ve aynı SHA’nın CI durumunu doğrula; eski başarıyı yeni SHA’ya taşıma.

Son açık kullanıcı kararı üstündür. D01–D09, U01–U08, Q-D01, Q-E02 ve Q-E03 korunur. Sonraki kabul edilmiş karar yalnız çelişen hükümleri değiştirir. Alt katalog veya uygulama üst kararı sessizce değiştiremez; bilinmeyen ürün/config değerlerini uydurma.

Ürün kararı, teknik aktarım, çalışan uygulama ve doğrulanmış kabul ayrı durumlardır. Geliştirici beyanı, repository raporu ve bağımsız CI kanıtını ayrı belirt. Raporun kaynak SHA’sını/kapsamını kontrol et. Eski raporlardaki açıkları güncel runtime/karar/CI ile karşılaştırmadan yeniden açık ilan etme. Uzak Auth → Edge → RPC smoke temiz CI kabulünün yerine geçmez.

## Alan ve güvenlik sınırları

Frontend tasarımına/istemci koduna müdahale etme. Production dağıtımı yapma; main merge dağıtım izni değildir. Secrets, tokenlar, parolalar ve kişisel verileri kaynaklara/raporlara yazma; sentetik test verisi kullan. Uygulanmış migration değiştirilmez. Dış e-posta ertelendi; uygulanmış sayma ve Resend entegrasyonu başlatma. Yük/restore ve frontend gerçek entegrasyon kabulünü kanıtsız kapatma.

## Her uygulama PR’sinin kapanışı

Etkilenen sözleşme/karar aktarımını, işlem envanterini, kalan işleri ve devir notlarını aynı PR içinde güncelle. Etkilenmeyen belgeleri gereksiz değiştirme; ikinci paralel belge ağacı oluşturma. İşlem durumunu makine sözleşmesi, runtime listesi ve üretilmiş endpoint envanteriyle karşılaştır. Üretilen dosyalar için mevcut üretim komutlarını kullan.

Belge bağlantılarını, kaynak önceliğini ve envanter tutarlılığını kontrol et. [CI politikası](docs/ci-policy.md) geçerlidir: geliştirme push’unda hızlı doğrulama ve merge-base’ten itibaren birikimli değişikliklere göre hedefli testler; PR açılışı/güncellemesi full clean tetiklemez. Runtime/CI içeren son merge adayında `ci:full-clean` label’ını açıkça ekleyerek tam `npm run test:clean` çalıştır. Label varlığı/skipped job kabul değildir. Mevcut `ftksaas/merge-clean` başarılı kaynak-head/base/merge-tree ve gerçek full-clean kanıtına dayanır; güvenli yalnız-belge için ayrı kaynak bağlı kabul yolu kuruludur; head/base değişimi kabulü düşürür. Bağımsız incelemeyi son adayda doğrula. Merge sonrası aynı main SHA’sı ve full clean sonucunu paylaş. Yönetici erişimi olmayan required-check/strict-base ayarını uygulanmış sayma; mevcut required check’i bypass etme. İlk güvenilir workflow politika kurulumu ve koruma sınırı CI belgesinde açıkça ayrılır.

Test raporu doğrulanan kaynak SHA’sını ve kapsamını belirtir. Raporun bulunduğu commit’in kendi SHA’sını içine yazması veya henüz çalışmamış merge CI’ını başarılı göstermesi gerekmez. Merge kanıtı gerekiyorsa sonraki doğal belge güncellemesinde kaydedilir; sırf CI bağlantısı için sonsuz belge commit’i döngüsü oluşturma. Önceki tarihsel raporları yeniden yazma.

## Sıralı üretim ve clean bekleme

Aktif prompt/sıra [üretim kuyruğundadır](docs/production-queue.md). Bitiren ajan tamamlanan promptu oradaki kuralla kısaltır/kaldırır; kalan işleri ve kanıtları günceller.

## Full clean sırasında kullanıcıya devir — 19 Ekim 2026 son talimatı

Bu kural önceki otomatik devam/CI izleme talimatlarını yalnız bekleme davranışı bakımından değiştirir; merge için başarılı kabul şartını kaldırmaz.

- Aday veya main full clean tetiklendiği/çalışmaya başladığı doğrulanınca run URL/ID, head SHA, base SHA ve test edilen merge SHA (uygunsa), PR, kuyruk adımı ve sonraki eylemi son durum mesajında paylaş; turu bitir.
- Full clean bitene kadar polling, sleep/wait döngüsü, log takibi, gh run watch, tarayıcı yenileme, hatırlatıcı/otomasyon veya arka planda izleyici başlatma. Aynı clean'i tekrar tetikleme. Kullanıcı sonucu getirene kadar üretim/merge devamını durdur.
- Tetikleme yanıtında run URL henüz yoksa workflow/PR/head ve tetikleme zamanını kaydet; bekleyerek run arama. Kullanıcı dönüşünde eşleştir.
- Kullanıcı “clean bitti/başarılı” dediğinde yeniden çalışmaya başla; bildirimi tek başına başarı kanıtı sayma. GitHub'dan o run'ın durumunu/sonucunu, güncel head/base ve kaynak bağlı kabulü bir kez doğrula.
- Run hâlâ çalışıyorsa yeniden izlemeye geçme; durumunu bildir ve turu bitir. Başarısızsa ilgili hatayı incele, odaklı düzeltme yap; kaynak değişince eski clean'i yeni kaynağa taşıma.
- Aday kabulü ve inceleme geçerliyse mevcut yetki kapsamında merge et. Main clean başlarsa yeniden aynı kullanıcıya devir kuralını uygula; main kabulü doğrulanmadan işi tamamlandı sayma.
- CI kendi kendine çalışmaya devam eder; duracak olan Work ajanının aktif izlemesidir. Bu talimat workflow iptal etme veya testleri atlama talimatı değildir.

