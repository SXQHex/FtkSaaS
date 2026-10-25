# FtkSaaS sıralı üretim kuyruğu

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


25 Ekim uzlaştırması: FD01–FD12 kararları kapalı; [kaynak/main/PR43–45 kabul tablosu](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) ve [tek kapasite/giriş kararı](../contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari) geçerlidir. Main PR46 sonrası 206/60; birleşik PR45 adayı207/61 yeni kabul bekler.

23 Ekim güncel durum: P01–P07 kod/main/geliştirme-test kabulü kapandı. Yayımlanmış200 API/59 migration; kaynak ve run kanıtı [tek devirdedir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md). Beş hosted worker kurulu/idle/hata0; gerçek yük ve fiziksel imha ayrı açık. 69 ana settings grubu kabul edildi; açık alan/değer/yetki/API eşlemesi sıradadır, yeni runtime uygulaması bu belgeyle başlatılmaz. [Davranış sprinti](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) 69 grup kabulünü ve kalan alt alanları taşır. Settings platform P01–P09, bu üretim tablosundaki P01–P08 teslimleri değildir.

| Sıra | Teslim | İşlem | Durum | Kanıt / sonraki adım |
|---|---|---:|---|---|
| P00 | İlk CI ayrımı | — | done | #19; sonraki Action bakımı #23 kapalı |
| P01 | Talep, rezervasyon ve bekleme | 14 | done | #22; aday 39327134872 ve aynı main 39401570751 completed/success doğrulandı |
| CI-02 | Dört shard, bölüm/Draft/development, yalnız-belge kabulü | — | done | #25/#26; main0ade787 / 39425915555 completed/success; 462 test, 34 migration |
| P02 | Paket ve seans yaşam döngüsü | 15 | done | #28; main cc4878d /39461804543 completed/success;469 test,40 migration; hosted Edge2 eşitlendi |
| P03 | Finans ve eğitmen ödemeleri | 7 | done | #30; main10710ffa /39529992556 completed/success;476 test,49 migration; hosted Edge3 ve ayrı smoke başarılı |
| CD-01 | Geliştirme/test Supabase CD | — | done | PR32+33; main0fabf3a /39588975421 success; CD39590690817 attempt2 success,49 migration/Edge4/17 kontrol, fixture temiz |
| P04 | CRM ve public başvuru | 11 | done | PR35; main7b96d88, aday39630534660/main39633243405/CD39635569033 attempt2 success; hedef gerektiren kurulumlar kullanıcı kararıyla ertelendi |
| P05 | Belge, bildirim ve otomasyon | 14 | done | PR37; main8364144, aday39745672815/main39748053581/CD39750264949 success; Edge6/53 migration |
| P06 | Rapor, import ve işlem izleme | 13 | done | PR38/main006ad36; aday39779013518/main39782197422/CD39785146645 success;54 migration/Edge7 |
| OPS-W01 | Hosted worker işletimi | — | done | d1830c8 main/CD kabulü; Cron2/3/4 healthy idle ve disable-restart geçti; tenant kapsamı3 bağlı |
| P07 | Hesap, organizasyon ve abonelik yaşam döngüsü | 22 | done (kod/main/development) | PR40/main4cfc9a55; aday39863852941/main39866466608/CD39869023193 success; hosted temel kurulum ve idle heartbeat geçti; fiziksel imha/yük ayrı |
| P08 | Geliştirmeler | — | in_progress (kapasite dilimi) | Ayrı kontenjanlar, sınırsız etkinlik ve paket ders/etkinlik kapsamları; mevcut kurulum20 kontenjan/100 tekrar; paket süresi+bakiye ile ücretsiz etkinlik uygunluğu; sabit abone no ve ortak çok kaynaklı CRM |

## FD01–FD12 tamamlandı — sonraki iş API/ekran teslimi

[Backend/frontend sınıflaması ve FD01–FD12](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama) kabulü beş scope ile tamamlandı. Yeni frontend karar turu açma. Standart negatif kredi başlangıcı 0; mevcut kulübün −2 ayarı korunur. Sonraki adım alan/DTO/permission/read-write/sürüm/API/kabul eşlemesi; SQL/işletim parametreleri sonraki backlog. Eski 208/60 taslak beş ekran yerine geçmez.

## Aktif öncelik — beş ayar ekranının API teslimi

Son kullanıcı talimatı: [kullanıcı–üye–merkez–org–platform alan/API matrisi](claude-handover.md) üzerinden mevcut yolları kullan, eksik typed ekran API ihtiyaçlarını tamamla. Yeni ana ayar gruplarıyla kapsamı uzatma. SQL/Cron/worker/DB işletim ayarları ayrı sonraki iş; eski 208/60 taslak otomatik taşınmaz. Frontend tasarım/istemci sahipliği Claude’da kalır.

## Ajanın kuyruk bakımı

1. Başlangıçta bu dosyayı, kaynak indeksini, güncel devir/kalan işleri ve envanteri oku. İlk açık satırı al; kapanmış promptu yeniden çalıştırma. Aynı teslimin ikinci branch/PR'sini mükerrer açma.
2. Başlarken durum/PR/head ve gerçek teknik engeli güncelle. Sözleşme adı var diye uygulanmış varsayma.
3. Durumlar: queued → in_progress → awaiting_candidate_clean → awaiting_main_clean → done. blocked gerçek bağımlılık için; failed test başarısızlığı için. Clean başlatıldığında aşağıdaki devir kuralıyla turu bitir.
4. Kaynak dondurulmadan önce kuyruk değişikliğini ilgili uygulama PR'sine dahil et. Çalışan clean'in head'ini sırf durum yazmak için değiştirme; run/head/base/sonraki eylemi sohbet kapanışında kaydet. Kullanıcı döndüğünde bu kanıtı kullan.
5. Uygulama PR'si incelemeye hazır olduğunda biten alt promptları kısa “uygulandı, main kabulü bekliyor” notuna indir; kalan API/görevleri aktif bırak. Kabul tamamlanmadan done veya promptun bütünü silindi durumu verme.
6. Merge ve aynı main kabulü doğrulanınca bitiren ajan aktif prompt gövdesini kaldırır, tabloyu done yapar; yalnız PR, kaynak/main SHA, CI ve kalan istisnaların kısa kapanış kaydını tutar. Bunu sonraki doğal kuyruk/uygulama commit'inde yapabilir; sırf kanıt yazmak için sonsuz belge commit/clean döngüsü kurma. Aradaki doğrulanmış kapanışı sohbette bildir; sonraki ajan kanıttan teyit edip kuyruğu eşitler.
7. Kısmi grupta tamamlananları çıkar, kalanları açık bırak. Başka gruptan zorunlu işlem öne alındıysa sahibini/kanıtını göster; sonraki grupta ikinci kez sayma.
8. Bitirilen promptun eski hali Git geçmişindedir. Tarihsel reports/ dosyalarını yeniden yazma. Bu sıra yeni ürün davranışı icat etme yetkisi değildir.

## Full clean sırasında kullanıcıya devir — 19 Ekim 2026 son talimatı

Bu kural önceki otomatik devam/CI izleme talimatlarını yalnız bekleme davranışı bakımından değiştirir; merge için başarılı kabul şartını kaldırmaz.

- Aday veya main full clean tetiklendiği/çalışmaya başladığı doğrulanınca run URL/ID, head SHA, base SHA ve test edilen merge SHA (uygunsa), PR, kuyruk adımı ve sonraki eylemi son durum mesajında paylaş; turu bitir.
- Full clean bitene kadar polling, sleep/wait döngüsü, log takibi, gh run watch, tarayıcı yenileme, hatırlatıcı/otomasyon veya arka planda izleyici başlatma. Aynı clean'i tekrar tetikleme. Kullanıcı sonucu getirene kadar üretim/merge devamını durdur.
- Tetikleme yanıtında run URL henüz yoksa workflow/PR/head ve tetikleme zamanını kaydet; bekleyerek run arama. Kullanıcı dönüşünde eşleştir.
- Kullanıcı “clean bitti/başarılı” dediğinde yeniden çalışmaya başla; bildirimi tek başına başarı kanıtı sayma. GitHub'dan o run'ın durumunu/sonucunu, güncel head/base ve kaynak bağlı kabulü bir kez doğrula.
- Run hâlâ çalışıyorsa yeniden izlemeye geçme; durumunu bildir ve turu bitir. Başarısızsa ilgili hatayı incele, odaklı düzeltme yap; kaynak değişince eski clean'i yeni kaynağa taşıma.
- Aday kabulü ve inceleme geçerliyse mevcut yetki kapsamında merge et. Main clean başlarsa yeniden aynı kullanıcıya devir kuralını uygula; main kabulü doğrulanmadan işi tamamlandı sayma.
- CI kendi kendine çalışmaya devam eder; duracak olan Work ajanının aktif izlemesidir. Bu talimat workflow iptal etme veya testleri atlama talimatı değildir.


## Ortak üretim promptu

20 Ekim son kullanıcı talimatı: her main birleşmesinin aynı kaynak kabulü doğrulandıktan sonra `gwyprhenabtpkbojephw` FtkSaaS **geliştirme/test** ortamını da o main ile eşitle. Önce migration geçmişi ve içerik eşleşmesini doğrula; yalnız eksik migration’ları sırasıyla uygula, değişen Edge bundle’ını yayımla, JWT/izin kapılarını koru; aynı içerik varsa yeniden kurulum yapmadan eşleşmeyi kaydet. Ardından uzak Auth→Edge→RPC smoke, RLS/EXECUTE ve advisors doğrulaması yap; kaynak SHA/migration/Edge sürümü/sonucu kaydet. Bu talimat başlangıçta manuel teslim kapanışıydı; sonraki CD-01 ile otomatik gelişim/test CD workflow’u kurulup kabul edildi. Kabul edilmiş aynı içerik yeniden uygulanmaz; güvenli yalnız-belge main’i deploy skipped sonucuyla kapanabilir. Production yetkisi değildir. Testler yalnız ayrılmış sentetik verilerle yapılır; mevcut gerçek veriyi reset etme. `npm run test:clean` loopback kabulünde kalır; hosted smoke onun yerine geçmez. Full clean çalışırken izleme/yayın devamı durur; kullanıcı dönüşünde gerçek main kabulü sonrası bu adıma geçilir.


Aşağıdaki kurallarla sıradaki açık teslimi uygula; kullanıcı her teslim için yeniden “devam” demek zorunda değildir. **Full clean bekleme noktasında kullanıcıya devir bunun açık istisnasıdır.**

- Bölümün Draft/development, açık son aday ve yalnız-belge kuralları için CI-2026-10-20 kararını uygula; kurulmuş otomasyonun güncel kaynakta bu kuralları koruduğunu doğrula.
- AGENTS.md ve docs/source-index.md okuma sırasını izle; güncel main SHA/CI, PR, ilgili sözleşme/DS kararları ve envanteri doğrula. Kaynak durumunu önceki sohbetten varsayma.
- Bağımlılık incelemesi → uygulama → hedefli test → bağımsız inceleme → açık son aday full clean → kullanıcıya devir → doğrulanmış merge → main clean → kullanıcıya devir → doğrulanmış kapanış.
- Rutin teknik karar/uygulama hatasını bağımsız çöz. Yalnız gerçek yeni ürün belirsizliğini somut senaryo/seçenek/etkiyle bildir; clean bekleme dışında bağımsız işleri sürdürebilirsin.
- Dar zorunlu bağımlılıkları gerekçeyle öne al; başka teslimin tamamını sessizce ekleme. Okuma/alan görünürlüğü/sürüm yolları olmadan yazmayı tamamlandı sayma.
- Worker dar sistem yetkisi/claim/lease/tekrar/sınırlı hata yolu kullansın. Kullanıcı aktöründen worker yetkisi türetme.
- Tenant/merkez/plan/rol, canlı yetki geri alma, idempotency, sürüm/stale preview, yarış ve geç hata rollback'i gerçek Auth→Edge→RPC ile doğrulansın.
- Önizleme/taslak iş sonucunu kesinleştirmesin; hak/para/hakediş geçmişi bağlı ters/fark hareketiyle korunsun.
- Yapısal test/mevcut regresyon/yeni davranış kabulü ayrı raporlansın. Yapılmayan runtime/pending vakayı passed yapma.
- Etkilenen sözleşme, üretilmiş tip/katalog/envanter, F01–F33, kalan işler, devir ve bu kuyruk aynı PR'de güncellensin; tarihsel raporlar korunur.
- Kullanıcının yedi teslim için branch/PR ve son aday inceleme/CI başarılıysa koşullu merge yetkisi geçerlidir. Yeni ürün kapsamı, repository yönetimi, frontend, production veya Resend yetkisi verilmez. Başarısız main kabulünde sonraki teslimi ilerletmeden çöz.
- İncelemeye sığmayan teslimi bağlantılı PR'lere böl; kısmi sonucu bütün grup tamamlandı diye sunma.

## Sıralı teslim promptları

### P01 — kapanış kaydı

14 API ve dar sistem worker zinciri PR #22 ile main'e alındı. Hedefli 39325878582 ve aday 39327134872 başarılıdır. Aynı main clean 39401570751 completed/success doğrulandı; P01 done, geçici kabul varsayımı kaldırıldı. Aktif uygulama promptu kaldırıldı; eski prompt Git geçmişindedir. Hosted/production worker işletimi ve P05 genel belge/bildirim işleri kapanmadı.

### CI-02 — kapanış kaydı

PR25 dört izole shard/belge kabulü/Draft-development politikasını kurdu; PR26 skipped optional serial ölçüm hatasını kapattı. Kaynak bazlı bağımsız incelemeler ve açık kurulum onayları alındı. Son aday39423719153 başarılı; aynı actual main0ade7877cc16fc121095decbc276f2fbc868607e / [39425915555](https://github.com/SXQHex/FtkSaaS/actions/runs/39425915555) completed/success: gerçek merge kanıtı, core/dört shard/toplayıcı ve 462 test, 34 migration, seed/health/advisors. CI-02 done; aktif uygulama promptu kaldırıldı. [Devir](ci02-handover.md), [ölçüm](ci-performance.md). Repository yönetim ayarları, production/Resend/frontend/yük-restore ve P02 geliştirmesi bu kapanışa dahil değildir.

### P02 — kapanış kaydı

15 API PR #28 ile kabul edilmiş main cc4878d09e45204dbc13ccfe1324b38b14548167 kaynağına birleşti. Son-head bağımsız inceleme, hedefli39448566998, tek son aday39455462417 ve aynı main39461804543 completed/success doğrulandı;469 test düğümü,40 migration, seed/health/advisors. Hosted geliştirme/test ortamı aynı migration/Edge kaynağına eşitlendi; uzak smoke ayrı geçti. P02 done; aktif prompt kaldırıldı, eski prompt Git geçmişindedir. P03 genel iadesinde immutable private.p02_sale_settlements ve önceki borç/alacak hareketleri zorunlu bağımlılıktır. Hosted worker işletimi, frontend, dış e-posta ve yük/restore kapanmadı.

### P03 — kapanış kaydı

Yedi API PR30 ile main10710ffa90747a7e35c452c4c07ba59522f50ce3 kaynağına alındı. Son head2526347 bağımsız incelemesi review5594023911 içinde kayıtlıdır; aday39527260056 ve aynı main39529992556 completed/success.476 test düğümü,49 migration, dört izole API shard ve kaynak bağlı toplayıcı geçti. Geliştirme/test Supabase49/49 migration içerik eşleşmesi,140 runtime API, Edge3/JWT ve ayrı dokuz kontrollü Auth→Edge→RPC smoke ile eşitlendi; sentetik fixture temizlendi. Aktif P03 promptu kaldırıldı; eski metin Git geçmişindedir. Bloklayıcı olmayan seçili hakediş doğrulama takip notu remaining-work.md içinde açık kalır. P04 queued; frontend, hosted worker işletimi, dış e-posta, yük/restore ve production açık kalır.

### P04 — kapanış kaydı ve operasyonel takip

11 API PR35 ile main7b96d8866abb2c056d1b59a96afee0696a1187d6 kaynağında kabul edildi; son inceleme, aday39630534660 ve aynı main39633243405 başarılı. CD39635569033 attempt2:52 migration, Edge5/JWT ve17 kontrol başarılı; sentetik fixture temiz. Aktif P04 ürün promptu kaldırıldı; eski metin Git geçmişindedir.

21 Ekim kullanıcı kararı: henüz başvuru alan adı/tenant/ürün/config hedefi yok; bot/gateway ve gerçek deneme kurulumu hedef oluşana kadar ertelenir, kapılar gevşetilmez. Kurulum yordamı p04-handover.md'dedir. PR36 transport düzeltmesi kabul edildi; yukarıdaki main/CD kanıtı geçerlidir. P05 bu kabulden sonra başlatıldı.

### P05 — Belge, bildirim ve otomasyon

14 API PR37/main8364144 ile kabul edildi; aday39745672815/main39748053581/CD39750264949 success.53 migration, Edge6,18 CD kontrolü ve fixture temizliği doğrulandı. P05 done; aktif prompt kaldırıldı, eski prompt Git geçmişindedir. [P05 devri](p05-handover.md). Hosted worker işletimi OPS-W01'de ayrı izlenir.

### P06 — Rapor, import ve işlem izleme

PR38/main006ad36, aday39779013518/main39782197422/CD39785146645 başarılarıyla13 API kabul edildi.178 runtime/22 contract_only,54 migration/Edge7. Aktif eski prompt Git geçmişindedir. [P06 devri](p06-handover.md).

### OPS-W01 — Supabase Cron worker işletimi

22 Ekim Supabase içi p01/p05/p06 dedicated LOGIN kurulum/kaynak/main/CD kabulü tamamlandı. Üç lane için boş kuyruk heartbeat ve p06 disable-restart kanıtı [OPS devrindedir](ops-w01-handover.md). Gerçek organizasyona üç binding sonradan bağlandı. P07 lane/privacy kurulumu ise PR40 kabulünden sonra yapıldı; eski Draft/CI bekletme talimatı kapanmış kaynak geçmişidir. Gerçek iş yükü ve fiziksel imha ayrıca açıktır.

### P07 kapanış kaydı

22 API PR40/main4cfc9a55 ile kabul edildi; aday39863852941/main39866466608/CD39869023193 success.200 runtime/0 contract_only/59 migration/Edge8. Aktif A→B→C promptu kaldırıldı; önceki hali Git geçmişinde. Beş Cron ve scope kurulumu tamam; quote3600sn/reauth900sn kullanıcı seçimi. Gerçek P07 iş yükü/kesinti/kalıcı imha kanıtları [kalan işlerde](remaining-work.md). [P07 geliştirme devri](p07-a-handover.md) kendi source snapshotıdır; eski pending sınırları kapanışı yeniden açmaz.

### P08 — Geliştirmeler

#### Organizasyon bazında sabit abone numarası

23 Ekim kullanıcı kararı: organizasyonun ekran/arama/rapor ve tarihsel takip anahtarı abone numarasıdır; platform UUID kimliği ve ilişkileri korunur. Numara organizasyon içinde benzersiz, değişmez ve yeniden kullanılmaz. Aynı kişinin başka organizasyondaki numarası farklı olabilir; global izleme numarası değildir. Ad veya doğrulanmış iletişim değişikliği numarayı, üyeliği, hakları veya finans bağlantılarını değiştirmez. Numara tek başına kimlik doğrulama/erişim yetkisi sağlamaz.

Format, başlangıç, adaya hangi aşamada tahsis, mevcut kayıt aktarımı ve kişi birleşiminde geçerli/eski numara alias davranışı uygulamadan önce netleştirilir. Eşzamanlı tekillik, idempotent tahsis, tenant izolasyonu, silme/yeniden katılımda yeniden kullanmama ve tarihsel izlenebilirlik kabul edilir. Bu yalnız P08 kaydıdır; migration/API/canlı veri değişmez.


22 Ekim kullanıcı kararı: mevcut kurulum mevcut API’lerle ilerler; aşağıdaki genişletmeler P08 kapsamındadır, şimdi uygulanmaz ve P07’ye eklenmez. API sayısı/DTO/runtime/migration bu kayıtla değişmez.

#### Çok kaynaklı ortak CRM başvuru toplama — 23 Ekim 2026 kullanıcı kararı

- Farklı formlar için ayrı başvuru tabloları açılmaz; birden çok form aynı ortak başvuru tablosuna alınır. Organizasyon/merkez kapsamı korunur; Fethiye Tango Kulübü kayıtları yalnız kendi CRM yetkililerine görünür. Mevcut public_applications modelinin genişletilmesi veya ortak modele taşınması uygulama bağımlılık incelemesinde seçilir; ikinci paralel başvuru deposu kurulmaz.
- Ortak alanlar kullanılır ve zorunlu bir kaynak sütunu ile kaydın hangi form/kanaldan geldiği izlenir. İlk kaynaklar: fethiyetango.com/tr/iletisim, fethiyetango.com/tr/kayit, Instagram, Facebook ve Google reklam formları. Kanal ile belirli formun kimliği karıştırılmaz; sağlayıcı/form kimliği ve mevcutsa kampanya/reklam kimliği, UTM ve sayfa adresi kaynak ayrıntısı olarak korunur. Kaynak bilgisi güvenilir entegrasyon eşlemesinden gelir; istemcinin gönderdiği organizasyon/kaynak beyanı tek başına yetki sağlamaz.
- Web formları curl ile HTTP 200 ve istemci JavaScript üzerinden incelendi: iletişim POST /api/contact ile name/phone/level/consent/marketingConsent gönderir; kayıt POST /api/kayit ile fullName/phone/level/mode/partnerName/consent/marketingConsent gönderir. Kayıt formunda partnerli seçimde partner adı vardır. İkisinde e-posta ve serbest mesaj alanı yoktur. Ad, normalize telefon, seviye ve ayrı zorunlu onay/pazarlama izni ortak modele eşlenir; partner ve kayıt biçimi gibi forma özgü alanlar kaybolmadan saklanır. Nihai şema/DTO adları bu kuyruk kaydıyla belirlenmiş sayılmaz.
- Kullanıcı mevcut sitede Upstash'ın hız sınırlama yaptığını doğruladı. Mevcut site sunucu uç noktaları ve Upstash koruması korunarak FtkSaaS başvuru API'sine bağlantı planlanır. Mevcut ayrı Supabase projesi fethiyetango (tycmjtboljppdwvgqagy) erişilebilir; ancak tabloları, sunucu handler'ları ve mevcut verinin aktarım ihtiyacı henüz incelenmedi. Eski kayıtlar kendiliğinden taşınmaz veya silinmez.
- Instagram/Facebook/Google reklamlarındaki yerel formlardan da aynı tabloya alım desteklenmeli. Her sağlayıcı için gerekli hesap erişimi, webhook veya çekme yolu, doğrulanmış gönderici, izin kapsamı ve alan eşlemesi ayrıca doğrulanır; entegrasyonların bugün kurulmuş olduğu varsayılmaz. Reklamdan web formuna yönlendirme ile sağlayıcının kendi formundan alım ayrı giriş yollarıdır.
- Mevcut public_application_submit_v1 yayın kimliği ve e-posta ister; bu telefon tabanlı genel CRM başvurusunu bugün karşılamaz. Genel başvuru kabulü, yetkili inbox/liste/inceleme ve mevcut kişi/aday eşlemesi birlikte ele alınır. Başvuru otomatik öğrenci, kullanıcı hesabı, satış, rezervasyon veya pazarlama onayı üretmez.
- Kabul: tenant/merkez izolasyonu, yetkisiz doğrudan tablo/RPC yazımının reddi, web hız/bot koruması ve sağlayıcı doğrulaması, aynı dış başvuru/form gönderiminin tekrarında tek kayıt, aynı kişinin farklı gerçek başvurularının kaynak geçmişini kaybetmemesi, telefon normalizasyonu, ayrı onayların sürüm/zaman/kaynak kanıtı, webhook tekrarları ve geç hata rollback'i. Genel kişi eşleme politikası doğrulanmış iletişim/izin kapılarını aşmaz.
- Bu madde P08 plan kaydıdır: kod, migration, DTO/envanter, site tasarımı, canlı entegrasyon veya veri aktarımı şimdi değiştirilmez; CI/CD tetiklenmez.



- Ders kategori kontenjanı PR45 adayıdır: tek toplam/erkek-kadın ve fiziksel oda sınırı, ayrı kontrollü kayıt aşımı. Son head149be4f4 inceleme/full clean geçti; merge/main/CD bekler. Mevcut kurulum toplam20 ve önceki veri değişmedi; bu aday tamamlanmadan yeni DTO çalışıyor sayılmaz.
- Sınırsız etkinlik kapasitesinin açık temsili: sihirli büyük sayı veya0 ile taklit edilmemeli. Mevcut kurulumda etkinlik dahil sonlu kontenjan20 kullanılır.
- Pakete bağlı, ders kredisi tüketmeyen etkinlik katılımı: bu paket4 ders sağlar; etkinlik için ayrıca4 hak veya sayaç yoktur. İzin verilen “Pratik” etkinliğine ücretsiz katılım, etkinlik tarihinde paketin iki aylık geçerliliği VE kullanılabilir ders hakkı sürerken mümkündür; süre veya ders hakkı hangisi önce biterse uygunluk kapanır. Etkinlik kaydı yalnız etkinliğin kontenjanından yer ayırır; ders kredisini reserve/consume etmez. Etkinlik yoklaması alınabilir ve ders bakiyesini değiştirmez. Diğer paketler için ayrı etkinlik hak sayacı seçeneği ayrıca tartışılabilir; bu pakete zorunlu değildir. Mevcut event_register/reserve_right ortak havuzdan1 kredi ayırdığından bu davranış uygulanmış değildir. “Pratik” etkinliğin adıdır; mevcut core.events modeli kullanılır, yeni pratik modülü açılmaz.
- Uygunluk ve paket hareketleri: her harekette bütün etkinlik kayıtlarına durum kopyalamak yerine güncel paket/kapsam/bakiye/geçerlilikten uygunluk hesaplanmalı; kayıt ve katılım kapılarında atomik tekrar kontrolü/yarışlar doğrulanmalı. Hak tüketimi/iadesi, süre uzatma/kısaltma, dondurma/sonlandırma gibi değişiklikler hesabı etkiler. Geçmiş yoklama ve kesin kayıtlar sessizce silinmez/iptal edilmez; mevcut kesin rezervasyon koruması ve açık yönetici çözümü korunur. İlk kayıt, katılım anı ve önceden kesinleşmiş kayıtların korunması birlikte kabul senaryolarına bağlanmalı.
- Tartışılacak: Business için sınırsız öğrenci/eğitmen/merkez kullanımının uçtan uca temsili. Mevcut private.plan_limit unlimited=true okur; PlanLimit API sözleşmesi ise yalnız key/value kabul eder ve ek alanı reddeder. Sözleşme, okuma yanıtları, doğrulayıcılar ve limit kapılarının ortak modeli P08’de kararlaştırılacak; şimdi runtime değişikliği yapılmaz. Mevcut kurulum sonlu sınırlarla ilerler: aktif öğrenci1000, eğitmen50, merkez5. Bu geçici kurulum değerleri Business için genel sınırsızlık kararının yerine geçmez.
- İlk kurulumdaki doğrulanmış owner Auth hesabı ve Business planının fiyat/dönem/limit tanımı operasyonel ön koşullardır; yeni geliştirme gibi veya hazırmış gibi gösterilmez. Gerçek doğrulama/konfigürasyon olmadan hesap doğrulanmış, ödeme yapılmış veya ücretsiz Business planı var sayılmaz.

Mevcut kurulum kararı: sonlu100 haftalık tekrar, toplam kontenjan20, paket başına4 ders; paket geçerliliği2 ay; geçerli ve ders bakiyesi olan pakete bağlı ücretsiz Pratik katılımı (ayrı sayaç yok). Bu kurulumdaki ikinci paket henüz sipariş aşamasındadır; kendiliğinden ikinci satış/borç/hak değildir. Bu örnek mevcut borçlu satış kurallarını genel olarak kaldırmaz. Gerçek ödenmemiş borç katılımı engeller; ders için negatif hak alt sınırı−2, etkinlikte negatif kredi yasağı korunur. Kapalı grupta öğrenci iptali hak iadesi sağlamaz; fiilî yoklama gerçeği kaydedilir.

“Sonraki hafta” ek pratik süresi kaldırılmıştır ve açık iş değildir. Süresiz tekrar isteği mevcut kurulumda100 tekrar ile karşılanır; bu nedenle ayrıca süresiz program geliştirmesi açılmaz. Son kaynak incelemesi ve full/main clean kapıları hiçbir P08 maddesiyle gevşetilmez.

Güncel operasyonel kurulum girdileri: Business aylık5000 TRY/yıllık50000 TRY; kullanıcı yıllık satın aldığını bildirdi. Dönem Europe/Istanbul ile1 Eylül2026–1 Eylül2027; mevcut kurulum limitleri aktif öğrenci1000/eğitmen50/merkez5. Owner Auth hesabının e-posta onayı hosted okuma ile doğrulandı. Hosted ilerleme: aylık5000 TRY ve yıllık50000 TRY Business katalog sürümleri1000 aktif öğrenci/50 eğitmen/5 merkez limiti veF01–F33 kapsamıyla oluşturuldu, geri okuma doğrulandı. Plan effective_at1 Eylül2026 00:00 Europe/Istanbul; bu bir abonelik başlangıcı değildir. Son açık kullanıcı onayıyla tek işlemde1 organizasyon, doğrulanmış Auth’a bağlı1 aktif owner hesabı/kişi/bağlantısı ve1 aktif yıllık abonelik oluşturuldu. Abonelik1 Eylül2026 00:00–1 Eylül2027 00:00 Europe/Istanbul; access_mode=normal ve üç limit geri okundu. Satın alma kullanıcı beyanından tarihsel abonelik hakkı olarak aktarıldı; ödeme tarihi/referansı bilinmediğinden ayrı tahsilat/ödeme doğrulaması kaydı uydurulmadı. Mevcut ilk ödeme onayı dönemi now() ile başlatır; istenen1 Eylül2026–1 Eylül2027 dönemi mevcut API ile geriye tarihli başlatılamaz. Owner Auth onaylı olsa da canlı uygulama oturumu yok; platform operatör kaydı yok. Kullanıcı kimliği/oturumu taklit edilmez, kişiye kendiliğinden platform yetkisi verilmez. Bu işlem kullanıcı tarafından mevcut API talimatına verilen açık, tek seferlik yönetici aktarımı istisnasıdır. admin_initial_organization_subscription_import makbuzu succeeded ve append-only audit1; aktör database-admin:postgres, owner gibi davranılmış sayılmaz. Oturum0/platform operatörü0, core RLS kapalı0/client RPC EXECUTE0. Kök aktarım sonrası son kullanıcı oluştur talimatıyla idempotency makbuzu ve audit içeren ikinci yönetici aktarımı yapıldı:2 aktif merkez/1 Tango disiplini/1 merkez-disiplin bağı/1 oda (Tango kapasitesi50), OM+FTK CM+FTK eğitmen rolleri (aynı mevcut owner kişisi),1 aktif öğrenci ilişkisi ve2 kapalı sınıf oluşturuldu. İki haftalık program100 tekrar/20 kontenjan ile inactive; ürün kimliği inactive, ürün sürümü0/seans0/etkinlik0/satış0. Anlaşma için oda ücreti seçimi eksik; ders kredisi tüketmeyen pakete bağlı etkinlik uygunluğu P08 sınırı; etkinliğin gerçek dış mekânı ve kayıt koşulları tamam değil. Yüzde60,2600 TRY/2 ay ve bilinen katılım/ödeme geçmişi audit pending_configuration içinde korundu; finansal satış/yoklama/hakediş olarak uygulanmış sayılmaz. Negatif varsayılan/üst sınır2 ve borçlu katılım engeli=true organizasyon politikaları doğrulandı. Migration/Edge/runtime/CI değişmedi.

Worker işletim kapanışı: son kullanıcı talimatıyla mevcut organizasyon p01/p05/p06 kapsamlarına yalnız kendi LOGIN karşılıklarıyla bağlandı (gerçek rol adları ftk_ops_p01/ftk_ops_p05/ftk_ops_p06). Üç Cron5sn/active, üç lane enabled/healthy ve last_org gerçek organizasyona bağlı; ticks1397/1397/1392 okumasında hata0. Kuyruk boş olduğundan idle/claim0; bu gerçek iş yükü veya henüz oluşturulmamış satış/seans/etkinlik kabulü değildir. Tenant worker kurulumu P07’yi bekletmez. P07-B/C kaynakları PR40 ile kabul edildi; ayrıntılı source/CI tek devirdedir. Fiziksel imha ve gerçek iş yükü kabulü ayrı kalır.


P07'nin sonraki tamamlanmış kaynak ve hosted temel kurulum kanıtı yukarıdaki kapanış kaydındadır. Gizlilik partial/pending ve fiziksel imha kanıtı sınırı sürer. 69 ana ayar davranışı tamamlandı. Sonraki adım tek alan/değer/yetki/API matrisi; yeni ayar API geliştirmesi bu kapanışla başlamaz.

Instagram ile giriş/kayıt/hesap bağlama kapsam dışıdır. Buradaki Instagram/Facebook/Google reklam başvuru kaynakları ayrı ortak CRM/P08 veri alımıdır; sosyal login yöntemi veya kurulmuş entegrasyon değildir.


### Backend ürün kapanışının teslim sırası — 26 Ekim

1. **Hesap ve kişisel kullanım:** mevcut PR50 düzeltmesini; profil/iletişim güncelleme ve doğrulanmış projeksiyon, desteklenen oturum/güvenlik yolları ve kullanıcı/üye tercihlerinin gerçek API tüketimiyle birlikte kapat. Sahte provider başarısı yok; desteklenmeyen yöntem kapalı/nedeni açık. Yazı ölçeği gibi tekil tercihler ayrı full-clean teslimi yapılmaz.
2. **İşletme yapılandırması:** merkez/organizasyon/platform alanlarının typed read-write/reset/sürüm/yetki ve domain komutlarıyla eşlemesini; marka/medya/katalog, miras/default/şablon ve bildirim/takvim seçeneklerini ilgili kullanım akışları halinde bitir. Genel JSON saklama, çalışan tüketici yerine kabul edilmez. Ürün davranış kararları yeniden açılmaz.
3. **İşletilebilir backend kabulü:** gerçek native öğrenci/eğitmen/yönetici aktörleriyle kayıt→paket satın alma/tahsilat→rezervasyon→yoklama→hakediş→rapor zincirini, erişim/plan/tekrar/yarış sınırları ve operasyon geri dönüşüyle kapat. Kalıcı dummy kurulum projesi açılmaz; mevcut sentetik veriler kullanılabilir. İzole restore sahiplik/izin kanıtı korunur; hosted tam geri dönüş/secret/config/Storage envanteri ve RPO/RTO doğrulanmadan kapatılmaz.

Her paket kalan alan listesini azaltmalı; kodlama, sözleşme, alan/API matrisi ve kanıt birlikte teslim edilir. Frontend ekranı bulunmaması backend API kabulünü bekletmez; frontend entegrasyonu ayrı tüketici kabulüdür.
