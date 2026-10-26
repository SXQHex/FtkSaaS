# Kalan backend ve entegrasyon işleri

## 26 Ekim — planların ticari sınır kararı: teknik aktarım açık

[Karar](decisions/PLANS-2026-10-26.md) kullanıcı tarafından kabul edildi; yazılımda uygulanmış/hosted/CI kabulü değildir. **Kapanış şartları:** (1) plan kataloğunda Starter 1 merkez/oda/disiplin/eğitmen/100 aktif öğrenci, Pro 1 merkez/tam özellik, Business 5 merkez; 5 üzeri sözleşmeli sürümlü istisna; (2) tüm create/activate/assign/program/product/sale/reservation/public/event/CRM/automation/earning ve downgrade yollarında merkezi plan kapıları; (3) tek mantıksal oda çakışması ve 40/5 gibi seans limitleri; (4) disiplin adının zorunlu paket ön eki ve gerçek `discipline_id` guardı; (5) F11/F16/F25 dar Starter ve F24 Pro erişimi, F14 anlaşmasız/hakedişsiz; (6) aktif öğrenci 100 sınırında atomik race/retry/rollback; (7) 5 merkez/6. ret ve özel teklif sınırları; (8) eski aktif kayıt, kesin rezervasyon ve para/hak geçmişini koruyan düşürme; (9) plan sözleşmesi/08 makine/tip/catalog/validator/endpoint/F01–F33/üretim kuyruğu/CI ve gerekli native Auth→Edge→RPC kabulü aynı uygulama PR'sinde. Henüz kesin olmayan Pro/Business diğer sayısal limitleri, özel teklif pricing ve downgrade aktif kapsam çözümünü uydurma. Mevcut P08/PR ve hesap-ayar işi tekrar açılmaz; backend coder uygun sıra/bağımlılıkla uygular. Bu belge PR'si **kod, migration, CI, generated inventory değiştirmez**.


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

24 Ekim 2026 belge tabanı main `702063807b0a0d09f559f070ffde1b1ae3e7563b`. P01–P07 kod/main/geliştirme-test kabulü tamamlandı; **200 API/0 contract_only/59 migration**. Eski178/22 ve PR40 pending listeleri güncel açık API listesi değildir. Kanıt [tek devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md).

## Aktif görev — beş ayar ekranı ve API teslimi

Frontend başlangıcı için belgeler eşitleniyor; [Claude talimatları](claude-handover.md) ve [settings davranışları](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) güncel giriş noktalarıdır. 69 ana grup kabul edildi: 17 kullanıcı, 22 merkez, 21 organizasyon, 9 platform. Grup görüşmesi kapandı. Son talimat kullanıcı–üye–merkez–org–platform ekranları ve gerçek API teslimidir; [somut alan/API matrisi](claude-handover.md) hazır ve eksik yolları ayırır. SQL/Cron/DB/worker teknik yönetim ayarları ertelendi; uygulama verisi kalıcılığı ve kabul kontrolleri ertelenmedi. Yerel feature/platform-settings taslağı208 endpoint/60. migration ile yayımlanmış kaynak değildir; bu belge PR'sine dahil edilmez ve frontend tarafından kullanılmaz.

| İş | Durum ve kapanış koşulu |
|---|---|
| Frontend karar kapanışı | [FD01–FD12](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama) 25 Ekim kullanıcı kabulüyle kapandı. Yeni tur açılmaz; sıradaki iş gerçek alan/DTO/permission/API/sürüm ve kabul açığıdır. Standart negatif limit 0, mevcut kulüp −2. Karar uygulanmış config/API değildir. |
| Beş ekran/API kabulü | Kullanıcı global hesap, üye org person/relationship ve org tercihi; merkez/org/platform scope ayrı. Her ekran alan/tip/default, yetki/miras, gerçek read-write/sürüm, hata ve kabul senaryosuyla teslim edilir. Mevcut API ile eksik alanlar ayrıdır; altı kapalı settings işlemi ilk adayda; diğer özel API/marka/provider/alan boşlukları kapanmadan beş ekranin tamamı çalışıyor denmez. |
| Ertelenmiş altyapı ayarları | Worker/pg_cron/DB bağlantı-RLS-grant/search_path/network/SSL, migration/deploy/yedek-restore motoru ve teknik limit yönetimi ayrı iş. Eski sekiz endpointli 208/60 taslak bu hedefin yerine geçmez. |
| Frontend PR43 renk/font ihtiyacı | [PR43](https://github.com/SXQHex/FtkSaaS/pull/43) okundu; hazır org marka paketi ve S08 kişisel görünüm ayrımı teknik sözleşmede O01/S08/P01/P04 alan eşlemesine bağlandı. Katalog, read/write/reset, logo, canlı yetki, sürüm/cache/fallback, ortak tip ve gerçek E2E açık; isimler öneri, API hazır değil. PR43 ayrı açık branch olarak korunur. |
| Kabul edilmiş ayarların alan eşlemesi | Her alan için mevcut read/write/DTO, izin/plan, sürüm/preview, veri kaynağı, sağlayıcı, cihaz/senkron kapsamı ve kabul senaryosu çıkarılacak. Kabul edilmiş davranış otomatik runtime değil. |
| Açık settings alanları | 69 grup tekrar onaylatılmayacak. Kabul edilmiş süre/default/dil/kitle kararları yeniden açılmaz; kalan kesin wire/provider/domain consumer/miras/yayın/izin eşlemesi tamamlanacak. İlk reset/yerel/default alanları yeni aday devrinde tanımlıdır. API uygunluğu ve runtime testi ayrı kanıtlanacak. |
| P03 eğitmen ödeme doğrulaması | instructor_payment_record_v1 tutarı karşılandıktan sonra kullanılmayan trailing earning_ids için de kişi/merkez/para birimi doğrulaması ve karışık kapsam regresyonu. Review5594023911; başka tenant'a allocation/para sızıntısı tespit edilmedi, iyileştirme henüz uygulanmadı. |
| Güvenlik sertleştirmesi | private.ops_run connection/role search_path sabitlemesi ve public.rls_auto_enable gereksiz EXECUTE izinlerinin kaldırılması kaynak kabulüyle yapılacak. ops_run üzerine SET clause eklenmez: COMMIT bozulur. Event-trigger dönüş tipi doğrudan normal çağrıyı reddeder; uyarılar kanıtlanmış dış saldırı gibi sunulmaz. |
| Parola koruması uyarısı | Kullanıcı Free plan kısıtı nedeniyle kapsam dışında bıraktı; çözülmüş sayılmaz, geliştirme engeli yapılmaz. |
| Fiziksel gizlilik imhası | DB saklama/hukuki bekletme, native Auth, Storage, export/geçici kopya ve backup/restore imha kanıtları gerekir. Eksikte partial/pending/completed_at=null. Hukuki süreler ayrıca teyit edilir. |
| Worker işletimi | Beş Cron/dedicated LOGIN/scope ve idle heartbeat kuruldu, failed0/claimed0. P07 için gerçek iş yükü, hosted kesinti/disable-restart ve erasure kabulü bu boş kuyruk kontrolünden çıkarılmaz. |
| P04 gerçek sağlayıcı kabulü | Yayın hedefli mevcut public başvuru için gerçek hostname/Turnstile/signed gateway ve gerçek deneme ürün/politika/config kanıtı. Genel telefon tabanlı formlar P08'dir. |
| İlk kulüp kurulumunun kalanları | Programlar/ürün kimliği inactive; ürün sürümü/seans/satış/yoklama/anlaşma/etkinlik henüz kurulmadı. Oda ücreti tercihi/dış mekân/etkinlik şartları ve P08 ders tüketmeyen uygunluk bağımlılığı var; yeni varsayılan yaratılmaz. |
| CI dar profil bakımı | P02 ortak kaynak değişimleri güvenli geniş fallback kullanıyor. Dar profil ayrı kanıtlı CI bakımı; full/main kapsamı azaltılmaz. |
| Repository koruması | Required-check/strict-base/bypass yönetici ayarlarının bu bağlantıyla uygulanması/doğrulanması açık. CI kaynak kapısı yönetim ayarı kanıtı değildir. |
| Frontend uçtan uca kabul | Claude alanı; gerçek sentetik Auth/Edge/DTO/rol/plan/stale/replay/hata senaryoları gerekir. Tasarım veya mock başarı kanıtı değildir. |
| Dış e-posta | Ertelendi; Resend/SMTP kurulumu ve gerçek teslim kabulü yok. Yerel Mailpit dış teslim sayılmaz. |
| Yük yedek restore production | Ayrı doğrulama/işletim/izin kapsamı; development CD production yetkisi değildir. |

## P08 geliştirmeler

[Üretim kuyruğu](production-queue.md#p08--geliştirmeler) tam kapsamdır: organizasyon bazlı sabit abone numarası; web/Instagram/Facebook/Google formları için kaynak izlenen ortak CRM başvurusu; PR45 adayında tamamlanan fakat main/CD bekleyen kategori kapasitesi; ayrı sınırsız etkinlik kapasitesi ve Business limit temsili; ders kredisi tüketmeyen pakete bağlı Pratik uygunluğu. Yeni ayar endpoint'iyle bu farklara bypass kurulmaz.

Mevcut kurulum20 kontenjan/100 tekrar/4 ders/2 ay; geçerli ve kullanılabilir ders hakkı birlikte sürerken ücretsiz Pratik hedefi P08'dir. Ayrı4 etkinlik sayacı, sonraki hafta uzatması veya ayrıca süresiz program işi açılmaz. Ayrıntılı gerçek kurulum verileri kuyrukta tarihli aktarım kaydıdır; gerçekleşmiş seans/satış/yoklama kanıtı değildir.

Instagram ile giriş/kayıt/hesap bağlama kapsam dışıdır. Buradaki Instagram/Facebook/Google reklam başvuru kaynakları ayrı ortak CRM/P08 veri alımıdır; sosyal login yöntemi veya kurulmuş entegrasyon değildir.
