## 26 Ekim — satır 1 runtime ve hosted kabulü tamamlandı

Kimlik, doğrulanmış iletişim ve hesap güvenliği tesliminin backend/hosted kabulü tamamlandı. Runtime kaynak main `7464383802deb8322e14a5ebec7d5e2ef650e436`: bağımsız review5656369798, PR54 aday [40370157098](https://github.com/SXQHex/FtkSaaS/actions/runs/40370157098), aynı main [40374760224](https://github.com/SXQHex/FtkSaaS/actions/runs/40374760224) ve gerçek development CD [40378100016](https://github.com/SXQHex/FtkSaaS/actions/runs/40378100016) başarılı. CD receipt20/20; canlı213 API/65 migration/Edge20 ACTIVE/verify_jwt=true. İlgili14 SQL fonksiyon gövdesi kaynakla aynı; aktif ad/iletişim projeksiyon farkı0. [Native kurtarma, sağlayıcı ve temizlik kanıtı](remote-backend-setup.md#teslim1-native-kurtarma-kabul-20261026). Bu kapanış belgesinin kendi kaynak bağlı belge CI/merge kabulü runtime kabulünden ayrıdır; belge değişikliği yeni full-clean veya deploy icrası sayılmaz.

Son kullanıcı kapsamı: native Supabase Auth ana yoldur; Turnstile yalnız hesapsız public başvuru/giriş yollarındadır. Native Auth CAPTCHA etkinleştirmesi ve geçici özel kurtarma gateway testi satır1 kapanış şartı değildir. Canlı Auth CAPTCHA kapalı; Email/Google/manual linking/confirmed email/TOTP açık, phone login kapalı. Son kararla özel66 reset SQL/marker/trigger iptal edildi; kurtarma oturumu korunur, diğer native oturumlar kapanır. Yeni Auth tüketicisi native SDK/endpoint kullanır; yayınlanmış eski API uyumluluğu korunur. Belirgin güvenlik veya fonksiyon zafiyeti yoksa sağlayıcı davranışını tekrar eden bakım katmanı eklenmez.

Gerçek sentetik hosted kabul18/18 geçti: native signup ve e-posta proof/replay, iki kullanıcı oturumu ile Auth→Edge→RPC, native recover ve gerçek recovery proof/replay, yeni parola, kurtarma oturumunun korunması, iki eski oturumun Edge+refresh reddi, eski parolanın reddi, yeni parolayla Auth→Edge→RPC. testin exact-ID hesabı/profili/native oturumları temizlendi ve yokluk geri okuması yapıldı. Gerçek kullanıcı parolası veya kurum verisi değiştirilmedi. Parola/token/proof/kişisel adresler kaynaklara kaydedilmez.

Native hız limitleri sağlayıcı ayarlarıdır; IP başına giriş/kayıt30/5dk, token doğrulama30/5dk, refresh150/5dk, aynı kullanıcıya SMTP e-postası minimum60sn. Eski900sn/IP10/adres3 sayacı yalnız uyumluluk kurtarma endpoint'ine aittir; native Auth'a uygulanmış sayılmaz. Secure email change açık; native secure password change ve current-password zorunluluğu kapalıdır. Özel account_password_change_v1 challenge'ı native endpoint için zorunlu ön kapı değildir. Bu mevcut sağlayıcı davranışı ek function ile değiştirilmiyor.

Gerçek SMS sağlayıcısı, public başvuru alanının Turnstile/siteverify kabulü, frontend ekranları ve genel production/yük/afet dönüşü ayrı kapsamdır; tamamlandı gösterilmez. Önceki13 Google/hosted TOTP/iletişim/native yarış-rollback kabulü kaynak/main kanıtlarıyla korunur. Aşağıdaki eski taslak, bekliyor ve CAPTCHA-kurtarma şartları tarihsel checkpointlerdir; satır1'i yeniden açmaz. Tarihsel reports dosyaları değiştirilmez.

## 26 Ekim — PR53 ve gerçek Google kabulü; S04 kapanış adayı

Güncel main `7086d7e00c142b9049e3d76cb8ac2f587fdaa5b6`: PR53 aday full clean40314333376, aynı main clean40318033261 ve gerçek development CD40320789568 başarılı. Yayımlanmış kapsam213 API/65 migration/Edge12. Önceki PR52 CD cleanup hatası dar fixture düzeltmesiyle kapandı; aşağıdaki eski pending/draft kayıtları kaynaklarına ait tarihsel checkpointlerdir.

Gerçek Google kimliği mevcut hesaba native ID-token yoluyla bağlandı: hazırlıksız bağlama ve yanlış nonce reddi dahil13 kontrol geçti; native kullanıcı/core UUID ve birincil doğrulanmış e-posta değişmedi, ikinci hesap yaratılmadı. Manual linking açık ve yeniden yüklemeyle doğrulandı. Bağlama güvenlik e-postası Resend'de delivered; yalnız kabul testinde oluşan native oturumlar ve refresh kayıtları kapatıldı. Sağlayıcı tokenı, parola ve kişisel iletişim bilgileri bu kayda alınmadı.

**Birinci satır hâlâ aktiftir.** Kalanlar: native Auth/Turnstile gerçek sağlayıcı kabulü ve son kaynak/adayı/main/CD. Özel66 taslağı son kararla iptal edilmiştir; mevcut65 migration değiştirilmez. Yeni full clean henüz başlatılmadı. Gerçek SMS dış entegrasyondur ve backend kapanış kapısı değildir.

Kullanıcının seçtiği kurtarma istek limiti:15 dakika içinde IP başına10 ve normalize e-posta başına3; adres yerine anahtarlı hash saklanır. Hosted kurulum ve gerçek kapı kabulü bu kararın kaydedilmesiyle tamamlanmış sayılmaz. Kanıt ayrıntısı [kimlik ilerleme raporundadır](../reports/account-identity-progress-20261026.md).

# FtkSaaS kaynak indeksi

## 26 Ekim — main uzlaştırması ve sağlayıcı kabul sırası

Güncel remote main18a151adf3f1519395dc1c539beacd6bf003ada3: PR51 yalnız plan karar belgelerini birleştirdi; Main clean40254883988 ve CD40254953023 success. Bu belge-only kabul yeni kimlik kaynağının runtime kabulü değildir; backend hâlâ212 API/64 migration. Yerel teslim1 adayı213/65 yeni main plan kararlarını koruyarak uzlaştırıldı. Kullanıcı gerçek bağlama kabulü için kullanılmamış bir Google hesabı sağladı; önce yeni API/fence için inceleme/aday/main/development kabulü gerekir, ardından kullanıcı gerçek Google kimliğini test hesabına bağlar. Bu amaçla bağımsız Google signup yapılıp kimlik tüketilmez. SMS dış entegrasyondur ve backend kapısı değildir.

## 26 Ekim güncel kabul ve aktif teslim

PR50 main `26e7091cd73482a623839266324b049d617fe9c2`:212 API/64 migration; main40246191868 ve gerçek Supabase CD40247685028 başarılı. Aşağıdaki önceki aday/pending kayıtları tarihsel kapsamdır. Kullanıcı sıralı kapanış istiyor: yalnız kimlik/doğrulanmış iletişim/hesap güvenliği satırı aktif, bitmeden sonraki satıra geçilmez. Platform e-postaları için Resend ertelemesi kaldırıldı. [Tek aktif sıra ve kalan sağlayıcı kabulü](production-queue.md#teslim1-kimlik-iletisim).

## 26 Ekim — normatif plan paketi kararı / kaynak önceliği

[Ürün planı kabulü](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), [01 ürün](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), [02 teknik](../contracts/02-FtkSaaS-teknik-sozlesme.md) ve [06 plan erişim notu](../contracts/06-FtkSaaS-O4-durum-hata-izin.md) birlikte okunur. Starter 1 merkez/1 aktif oda/1 disiplin/1 eğitmen/100 aktif öğrenci; Pro tüm tek merkezli fonksiyonlar; Business 5 merkez; 5 üzeri sözleşmeli özel teklif. Önceki F01–F33 üretim haritası/08 makine plan etiketleri, `docs/endpoint-inventory.json`, paket tipleri ve runtime **henüz bu kabul kararına eşitlenmedi**; eski etiketleri yeni çalışır plan desteği sanma. Önce [kalan işler](remaining-work.md), [kuyruk](production-queue.md) ve [frontend devri](claude-handover.md) içindeki açık kabul ayrımına bak. Ana başlangıç kaynak SHA `26e7091cd73482a623839266324b049d617fe9c2`, [aynı SHA main clean](https://github.com/SXQHex/FtkSaaS/actions/runs/40246191868)/[CD](https://github.com/SXQHex/FtkSaaS/actions/runs/40247685028) başarılı; bu yeni belge kararının veya yeni plan gate'in CI kanıtı değildir.


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

Yazı ölçeği ve sabit org/merkez/disiplin seçimi kullanıcı hesabına aittir; yetki/plan veya merkez iş timezone’u değişmez. Canlı erişim kaybında başlangıç bağlamı null döner, aynı yazma receipt’i yetki denetimini atlayamaz. UI tasarımı değiştirilmedi; ekran/rol başlangıcı, kayıtlı filtreler ve kalan69 grup bu iki alanla tamamlanmış sayılmaz. [Alanlar ve tüketici sınırı](frontend-settings-handover.md#kullanici-gorunum-baslangic-20261026). Son aday inceleme/full clean/main/CD kabulü henüz bekler.

## 26 Ekim — PR48 kabulü ve ürün önceliği

Main `34aac276ba124405cc99129a354ff61c376977d1`:207 API/62 migration. PR48 head0397d8ba için bağımsız review5645032155 + aday40230141266 ve exact-source kullanıcı kurulum onayı sonrası normal merge yapıldı. Aynı main [clean40232332540](https://github.com/SXQHex/FtkSaaS/actions/runs/40232332540) ve [development CD40234018404](https://github.com/SXQHex/FtkSaaS/actions/runs/40234018404) başarılı; deploy adımı gerçekten çalıştı. CLI tam2.122.0; dört shard ve full/main assertionları korunur.

Son kullanıcı kararı: yeni altyapı/otomatik süre ölçüm sistemi geliştirilmez. Ayrı kalıcı dummy/pilot organizasyon oluşturma işi iptal edildi; yalnız mevcut sentetik verilerin her seferinde silinmesi gerekmiyor. Önce restore sahiplik/izin denemesi, ardından kalan ürün/ayar API’leri. Alttaki eski kalıcı pilot ve bakım önceliği notları tarihsel snapshot’tır; açık kurulum görevi olarak uygulanmaz. [Güncel kabul sınırı](remote-backend-setup.md#restore-20261026).


## 25 Ekim — PR47 kabulü ve öncelikli CI bakımı

Main `9fd084b9ddbbefc225c98adbf3f25ddee85a9b6e`:207 API/62 migration. PR47 aday40218840402, aynı main40226464989 ve development CD40228555171 başarılı; önceki PR47 aday/pending notları snapshot’tır. Worker session pin ve dar EXECUTE kaynağı yayımlandı; hosted advisors’ta public.rls_auto_enable iki client EXECUTE uyarısı kalktı. COMMIT yapan ops_run için kalan search_path linter uyarısı güvenli session pin/role defaultu sınırıyla belgeli istisnadır; parola uyarısı önceki Free-plan kararıyla kapsam dışıdır. Son kullanıcı talimatı CLI tam2.122.0 ve gerçek sürelere göre dört shard dengelemesidir; full/main clean ve assertionlar korunur. [Bakım kaynağı ve ölçümler](ci-performance.md). Kalan ayar alanları, kalıcı hosted dummy pilot ve restore/managed sahiplik kabulü açık iş olarak sürer. Veriler için kullanıcı teknik karar yetkisi verdi; bu bakımda hosted veri silinmez/değiştirilmez.

## 25 Ekim — aktif backend ve kalıcı pilot teslimi

Main `d6b67139445f2b88298fc0ee6e1f5c476f3586b7`:207 API/61 migration; PR45 main clean40206350648 ve development CD40207909599 başarılı. Aşağıdaki eski PR45 pending notları önceki aday snapshotıdır. Son kullanıcı talimatı beş ayar kapsamının backend/API kabulü, pilot zinciri ve restore/operasyon güvenliği teslimidir. Frontend için yeni alt alan kullanılacak; önce backend hazır edilir. Sentetik pilot verileri ayrı organizasyonda geliştirme Supabase’inde kalıcı tutulabilir; her koşuda silinmez. Dağıtım öncesi sıfırlama ayrıca yapılır; mevcut gerçek kulüp verileri şimdi silinmez. [Teslim sırası, kapsam ve kanıt sınırı](pilot-readiness.md). Bu ilk aday207/62 olup bütün ayar/hosted pilot/restore kabulü değildir.

## 25 Ekim — PR45 kapasite ve main ayarları uzlaştırması

Başlangıç main `3456050a3061d7bf5dc2ce8898b82c5cfe84e773`: **206 callable API / 60 migration**; PR46 ayarları birleşti, aynı main clean [40200716603](https://github.com/SXQHex/FtkSaaS/actions/runs/40200716603) ve development CD [40202862244](https://github.com/SXQHex/FtkSaaS/actions/runs/40202862244) başarılı. Bu PR45 birleşim adayı kapasite işlemini ekler: **207 callable API / 61 migration**. Altı ayar işlemi ve kapasite davranışı birlikte korunur. Henüz uygulanmamış kapasite migration’ı main’deki ayar migration’ından sonra sıralandı; SQL içeriği ve mevcut 60 migration değişmedi. Önceki PR45 clean yalnız eski tabana aittir; bu birleşik kaynak için bağımsız inceleme ve yeni aday/main clean gerekir. Kapasite henüz main/hosted kabulü değildir.

[Alanlar, API'ler ve kesin destek sınırı](frontend-settings-handover.md). Teknik SQL/worker yönetimi erteli; beş ekranın bütün 69 davranış grubu tamamlandı denmez. Hazır renk/font/logo, native provider/MFA/oturum ve diğer özel yaşam döngüsü açıkları bu genel tercihlere dönüştürülmez.


25 Ekim uzlaştırması: FD01–FD12 kararları kapalı; [kaynak/main/PR43–45 kabul tablosu](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) ve [tek kapasite/giriş kararı](../contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari) geçerlidir. Main PR46 sonrası 206/60; birleşik PR45 adayı 207/61, yeni kaynak inceleme/aday/main/CD bekler.

24 Ekim 2026 inceleme tabanı main `702063807b0a0d09f559f070ffde1b1ae3e7563b`. Yayımlanmış kapsam **200 sözleşme / 200 runtime / 0 contract_only / 59 migration / 90 core tablo / Edge8**. P01–P07 kod/main/geliştirme-test kabulü kapandı. Ürün, işletim ve frontend kabulü API sayısından türetilmez.

Öncelik artık beş ayar ekranı ve typed API teslimidir: kullanıcı/global hesap, üye/org person ve tercihi, merkez, org, platform. SQL/Cron/DB işletim ayarları ayrı backlog. [Somut ekran/alan/API matrisi](claude-handover.md) mevcut desteği ve açıkları gösterir.

Önce [backend/frontend ayrımı, 69 kararın beş frontend scope eşlemesi ve FD01–FD12 kabulü](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama) okunur. Sınıflama ve FD01–FD12 karar turu tamamlandı. Sıradaki iş gerçek typed API/ekran teslimi ve uygulama açığıdır; backend işletim ayarları ayrı kalır.

## Başlangıç sırası

1. [AGENTS](../AGENTS.md): alan sahipliği, kaynak kanıtı ve full clean sırasında kullanıcıya devir.
2. [00 güncel devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md): kaynak/run/tree/CD receipt ve hosted temel kurulum kanıtı.
3. [Kalan işler](remaining-work.md) ve [üretim kuyruğu](production-queue.md): gerçek açıklar; P08 abone numarası ve ortak çok kaynaklı CRM.
4. [Claude frontend talimatları](claude-handover.md): gerçek API/DTO, istek, sürüm, ortam, güvenlik ve tasarım sınırları. Kökte otomatik yüklenen CLAUDE.md bulunmadığından bu dosya açıkça okutulur.
5. [02 ayarlar sözleşmesi](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti): S01–S17, M01–M22, organizasyon O01–O21 ve platform P01–P09: 69 ana grup kabul edildi; FD01–FD12 ilk frontend seçenekleri kesin, yalnız asset/teknik DTO/permission/provider/uygulama eşlemesi açık. Yeni ayar davranışlarının tümü mevcut API'de var değildir. Yerel 208 API/60. migration taslağı yayımlanmamıştır.
6. Görevle ilgili ürün/teknik sözleşme, kabul edilmiş karar ve gerçek makine/TypeScript DTO'su.

Son açık kullanıcı kararı üstündür; sonraki kabul yalnız çelişen hükümleri değiştirir. Kabul edilmiş ürün davranışı, teknik aktarım, callable uygulama ve doğrulanmış kabul ayrı tutulur. Eski bir rapor veya modül devrindeki pending notu güncel kaynak kanıtından üstün değildir.

## Sözleşmelerin ayrı inceleme kaydı

| Belge | Rol ve inceleme sonucu |
|---|---|
| [00 devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) | Güncel başlangıç. P07 aday/main/CD, PR41 belge kabulü ve beş Cron heartbeat kanıtı eklendi; önceki kaynaklar tarihsel bölümde. |
| [01 ürün](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) | Normatif ürün kapsamı. Ayar davranış kabulü/uygulama ayrımı, güncel kişi verisi ve P08 abone numarası sınırı eşitlendi. |
| [02 teknik](../contracts/02-FtkSaaS-teknik-sozlesme.md) | Normatif teknik davranış. Word v0.1 settings kataloğu tek Markdown kaynağına aktarıldı; 69 ana grup ve FD01–FD12 kapanışı, eski Word aileleri ve kalan teknik eşleme ayrı; numara kapsamları karıştırılmaz. |
| [03 sorumluluklar](../contracts/03-FtkSaaS-kodlama-sorumluluklari.md) | ChatGPT backend / Claude frontend sınırı, ortak tiplerin gerçek yolu ve durdurulmuş settings geliştirmesi güncellendi. |
| [04 şema](../contracts/04-FtkSaaS-O4-veri-semasi.md) | Üretilmiş katalog; 90 core tablo; bu aday61 migration/main60 doğrulanır. Kesin DDL migrations içindedir. Yeni settings alanı elle eklenmedi. |
| [05 API](../contracts/05-FtkSaaS-O4-API-katalogu.md) | Üretilmiş207 callable operasyon aday kataloğu; main206. DTO kaynağı 08; kapsam notu gerçek sağlayıcı kabulünün yerine geçmez. |
| [06 durum/hata/izin](../contracts/06-FtkSaaS-O4-durum-hata-izin.md) | Yeni ayarlar için uydurma enum/izin eklenmedi. Global kimlik, oturum ve görünüm yetki sınırları eşitlendi. |
| [07 denetim](../contracts/07-FtkSaaS-O4-denetim-ve-aciklar.md) | İlk tasarım denetimi; tarihsel açık listesi güncel teslim listesi olarak kullanılmaz. Değiştirilmedi. |
| [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) | Callable DTO/izin/guard/faz/sürüm kaynağı. Bu aday207/207/0, main206/206/0. Eski decision_delivery/feature_delivery notları ürünün tüm kabulü değildir; değişiklik yapılmadı. |
| [09 aktarım](../contracts/09-FtkSaaS-teknik-aktarim-raporu.md) | İlk aktarımın kaynak raporu; bugünün CI/hosted kabulü yerine kullanılmaz. Değiştirilmedi. |
| [10 Q-D01](../contracts/10-FtkSaaS-Q-D01-kabul-karari.md) | Etkinlik disiplin/kapsam ve negatif kredi yasağı kabulü; ürün hükmü korundu. |
| [11 Q-D01 aktarım](../contracts/11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md) | Kaynağına ait tarihsel aktarım raporu; yeniden yazılmadı. |
| [12 Q-E02](../contracts/12-FtkSaaS-Q-E02-kabul-karari.md) | Merkez iptalinin her aşamada tam para/hak sonucu; Q-E03 ve fiilî başlangıç ayrımı korunur. |
| [source-v2.2](../contracts/source-v2.2/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) | Eski makine sözleşmesi snapshotı; aktif istemci üretim kaynağı değildir. |

## Entegrasyon ve işletim belgelerinin ayrı incelemesi

| Belge | Rol ve inceleme sonucu |
|---|---|
| [Claude devri](claude-handover.md) | Baştan güncellendi. Eski 119 işlem/eksik backend yönlendirmesi kaldırıldı; mevcut API ile kabul edilmiş gelecek ayarlar ayrıldı. |
| [API invariants](api-invariants.md) | Canlı yetki, idempotency, sürüm/preview ve gizli alan sınırları korundu; profil sürüm okuması ve Auth tamamlama ayrımı eklendi. |
| [Fiziksel invariants](physical-invariants.md) | Kilit/indeks, hak/zaman ve migration kabul ilkeleri incelendi; SQL uygulama kanıtı olmadığı açıklaması korunur; eski kapasite alanlarının tarihsel sınırı güncel karar bağlantısıyla açıklandı. |
| [Hosted kurulum](remote-backend-setup.md) | 59 migration/Edge8, beş dedicated LOGIN Cron ve 23 Ekim health kaydı. 3600sn quote/900sn reauth kullanıcı seçimi; evrensel varsayılan değil. |
| [Bağlantı JSON'u](development-connection.json) | URL/yerel hazırlık yönergesi kullanılabilir; 0 observed/22 migration ve ilk rapor alanları tarihsel kurulum snapshotıdır. Güncel hosted envanter olarak kullanılmaz. Runtime/CI girdisi olabileceği için bu prose tesliminde değiştirilmedi. |
| [Endpoint envanteri](endpoint-inventory.json) | Üretilmiş aday207/207/0 callable envanteri; generate --check ile eşleşmesi doğrulanır, elle değiştirilmedi. |
| [Özellik haritası](feature-delivery.md) | Üretilmiş F01–F33 eşlemesi. İşlem varlığı gerçek sağlayıcı/operasyonel/üretim kabulü değildir; ilk DS metadata partial/pending satırlarının tarihsel snapshot olduğu üretici prose içinde açıklandı; güncel runtime/açık iş kaynağına yönlendirildi. |
| [Kalan işler](remaining-work.md) | Baştan güncellendi; kapanan API'ler açık listeden çıkarıldı, settings/P08/sağlayıcı/güvenlik/işletim açıkları ayrıldı. |
| [Üretim kuyruğu](production-queue.md) | P01–P07 ve OPS kaynak kapanışı; P08 ortak CRM/abone no/etkinlik hakkı. Eski Draft/CI bekletme aktif talimat olmaktan çıkarıldı. |
| [CI politikası](ci-policy.md) | Kurulu yalnız-belge kabulü ile full/main clean ayrımı korunur; tarihsel bakım/CD anlatımı güncel kuyruk sayılmaz. |
| [CI-02 devri](ci02-handover.md) | Kaynak bazlı kurulum/tam shard kanıtı korunur; P02 başlamadı ifadesinin tarihsel sınırı düzeltildi. |
| [CI performansı](ci-performance.md) | Eski kaynak ölçümleri değiştirilmedi. Son P07 süresi ayrı; belge kabulü runtime performans kıyası değildir. |
| [Branch koruması](branch-protection-review.md) | Kaynak kapısı kuruludur; yönetici required-check/strict-base ayarları bu bağlantıyla doğrulanmış sayılmaz. |
| [README](../README.md), [AGENTS](../AGENTS.md), [CHANGELOG](../CHANGELOG.md) | Frontend başlangıcı, durdurulmuş settings taslağı, kapsam ve doğrulama yolu eşitlendi. |

## Modül devirlerinin ayrı incelemesi

Bu belgelerin eski SHA/test/migration sayıları ilk teslimlerinin kanıtıdır. Yeni kaynak için eski başarı taşınmaz; güncel kaynak/main/CD kaydı 00 devirde aranır.

| Belge | İnceleme sonucu |
|---|---|
| [Fiilî başlangıç](actual-start-handover.md) | Event record/correct, Q-E03 parasal sınır ve audit ayrımı doğru; eski aktif envanter başlığı güncellendi. |
| [Takvim okumaları](schedule-read-handover.md) | Interval/cursor/görünürlük korunur. Public discovery P04 ile uygulanmış; gerçek sağlayıcı kabulü ve frontend/yük ayrıldı. |
| [Program/seans](program-session-handover.md) | Immutable program/override/sürüm kuralları korunur. P02 seans iptali/yerine seans artık açık gösterilmez; gece/gün aşan birleşik uygunluk sınırı korunur. |
| [Starter koruma](starter-attendance-protection-handover.md) | P02 hak koruma, P03 ödeme ve P05 belge tüketicileri güncellendi; ilk PR'nin test kanıtı değiştirilmedi. |
| [Anlaşma/hakediş](instructor-earnings-handover.md) | P03 ödeme artık contract_only gösterilmez. Frozen değerleme ve açık başlangıç korunur; trailing earning_ids iyileştirmesi ayrı açık. |
| [Hesaplaşma](settlement-handover.md) | A/B bağımsız canlı yetki ve ledger korunur. Sonradan tamamlanan P02/P03 bağımlılıkları açık listeden çıkarıldı. |
| [DS sprint devri](decision-sprint-handover.md) | İlk aktarımın hedef/runtime farkları tarihsel ayrıldı; güncel hak/belge/CI-02 uygulaması düzeltildi. Yeni ayar sprintinin normatif kaynağı 02'dir. |
| [P01](p01-handover.md) | Kaynak/main kabulü tamam; dedicated worker/scope kurulumu ve boş kuyruk sınırı eklendi. |
| [P02](p02-handover.md) | PR28/main kabulü kapanmış, geliştirme pending notları snapshot. Güncel ödeme entegrasyonu P03 ile tamam; dosya ilk teslim kanıtı olarak korunur. |
| [P03](p03-handover.md) | PR30/main kabulü kapanmış tarihsel geliştirme notu. Açık trailing earning_ids doğrulaması kalan işlerde; yedi API kapalı sayılmaz. |
| [P04](p04-handover.md) | CRM/public API kaynak/CD kabulü kapalı. Gerçek hostname/bot/gateway/deneme kurulumu ayrı; telefon tabanlı ortak reklam/web CRM P08'dir. |
| [P05](p05-handover.md) | Belge/in-app/otomasyon kaynak/main/CD kabulü kapalı. İlk aday hataları kaynak tarihçesi; dış e-posta teslimi kabul edilmiş değil. |
| [P06](p06-handover.md) | PR38/main/CD kabulü kapalı. OPS/P07 queued notu kendi tarihine ait; bugün aktif sıra değildir. |
| [OPS-W01](ops-w01-handover.md) | Üç lane kurulum/disable-restart boş kuyruk kanıtı korunur. Sonradan tenant bağlandı, P07 iki lane eklendi; güncel beş lane için hosted kurulum okunur. |
| [P07 A+B+C](p07-a-handover.md) | İlk Draft/pending/GitHub erteleme ve dar teşhis kayıtları tarihsel. Son PR40 aday/main/CD tamamlandı; eski belge yeniden CI tetikleme talimatı değildir. |

## Karar belgeleri

| Kaynak | Güncel anlamı |
|---|---|
| [Q-D01 köprüsü](karar-sohbetine-Q-D01.md) | Etkinlik kapsamı/negatif kredi kabul ve runtime bağlantısı; açık yeniden açılmaz. |
| [Q-E01 kabulü](decisions/Q-E01-accepted.md) ve [aktarımı](decisions/Q-E01.md) | Ödeme hazırlığı ve kesin kayıt; eski aktarım bekliyor sayısı düzeltildi. Merkez iptalinde Q-E02 üstündür. |
| [Q-E02](decisions/Q-E02.md) | Her aşamada tam merkez iptali sonucu; fiilî başlangıç mevcut. Tarihsel sekiz migration kabulü güncel main sayısı değildir. |
| [Q-E03](decisions/Q-E03.md) | Planlanan başlangıç dahil sonrası katılımcı parasal sınır; fiilî başlangıç bu sınıflandırmayı değiştirmez. |
| [DS-2026-10-17](decisions/DS-2026-10-17.md) | Plan/yoklama, rezervasyon koruması, anlaşma, A→B hesaplaşma ve geçmiş satış ürün kararları. |
| [Hesaplaşma revizyonu](decisions/DS-2026-10-17-settlement-revision.md) | OM üçüncü kayıt aşaması yerine iki taraflı başvuru/onay; sonraki merkez kapsam kararı uygulanır. |
| [Merkez kapsamı](decisions/DS-2026-10-17-settlement-center-scope.md) | Aynı hesap A ve B'de ayrı canlı yetkiliyse iki adımı yapabilir. A yetkisi B yerine geçmez; fallback yoktur. |
| [CI-2026-10-20](decisions/CI-2026-10-20.md) | Dört bağımsız shard, kaynak bağlı belge kabulü ve açık full clean. Kurulum bekleme ifadesi güncel kapanışa bağlandı; kapı gevşetilmedi. |

## Kanıt ve değişiklik sınırı

`reports/` ve `contracts/source-v2.2/` kaynağına bağlı tarihsel kanıttır; yeniden yazılmaz. Geliştirici yerel kontrolü, bağımsız kaynak incelemesi, aday/main CI ve hosted smoke farklı kanıt türleridir. Fiziksel imha, gerçek worker yükü, frontend entegrasyonu, dış e-posta, yük/restore ve production kabulü kapanmış sayılmaz.

Üretilmiş katalog/tip/validator/Edge/makine sözleşmesi bu belge güncellemesinde değiştirilmez. Gelecekte davranış/API geliştirmesi yapıldığında ilgili kaynak ve kabul senaryolarıyla birlikte güncellenir. Güvenli yalnız-belge yolu mevcut CI izin listesi üzerinden doğrulanır; bu teslim için izin listesi veya full/main testleri değiştirilmez.
