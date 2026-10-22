# FtkSaaS sıralı üretim kuyruğu

22 Ekim son kullanıcı kararı: P07-A+B+C tek Draft PR40 içinde bağımlılık sırasıyla geliştirilir ve birlikte merge edilir. Ayrı A/B/C merge/kabul döngüleri kaldırıldı. GitHub servisleri normale dönene kadar manuel CI, rerun, aday label ve merge başlatılmaz; geliştirme commitlerinde geçici `[skip ci]` kullanılarak push kaynaklı pahalı CI ertelenir. Workflow veya kabul kapısı değiştirilmez. Yerel odaklı doğrulamalar sürer. Servisler normale dönünce önce d1830c8 main39809302120 retry ve PR39 main/CD/OPS kapanışı, ardından tamamlanmış P07 için son kaynak bağımsız inceleme, tek aday full clean, merge ve aynı main clean/CD sırasıyla yapılır. Eski/skipped CI kabul değildir; bütün22 API tamamlanmış sayılmaz: A8 kaynak hazır, B6/C8 geliştirme sırasındadır.

22 Ekim güncel durum: OPS-W01 PR39, `d1830c89e3d5e7f3c90db7ef0953cc264b35205f` ile main’e birleşti. Aday39795678387 attempt5 kabulü doğrulandı; aynı main [39809302120](https://github.com/SXQHex/FtkSaaS/actions/runs/39809302120) başarısızdır. Kullanıcının son talimatıyla bu SHA için yeniden çalıştırma **açık iş** tutulur, şimdi tetiklenmez; main/CD ve hosted worker kabulü kapanmadı. Son kabul edilmiş hosted kaynak P06 `006ad36918ae823bc10fbdefa2d48901e193121c`,54 migration/Edge7 olarak kalır. P07-A Draft PR40 geliştirmesi sürer: **200 sözleşme/186 geliştirme runtime/14 contract_only/57 migration/90 core tablo**. Sekiz A işleminin kaynağı uygulandı; gerçek Auth→Edge/aday/main kabulü bekler. B6 ve C8 aynı Draft PR40 geliştirme sırasındadır. Full clean/merge şimdi tetiklenmez; kapılar gevşetilmez.

P05 **done (kod, main ve geliştirme/test kabulü)**: [PR37](https://github.com/SXQHex/FtkSaaS/pull/37), kabul edilmiş main `83641447b29e459236aea1a9a4379b5d19825af6`;200 sözleşme/165 runtime/35 contract_only,53 migration/90 core tablo. Son head15e2126/base16cb570/tested merge2ebe087/tree736a75b; bağımsız son kaynak incelemesi5611074233, [aday39745672815](https://github.com/SXQHex/FtkSaaS/actions/runs/39745672815) ve [aynı main39748053581](https://github.com/SXQHex/FtkSaaS/actions/runs/39748053581) completed/success. [CD39750264949 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39750264949) success:18 kontrol,53/53 içerik eşleşmesi, P05 migration uygulandı, Edge6 ACTIVE/verify_jwt=true, RLS kapalı0/client RPC EXECUTE0 ve sentetik fixture temizliği. Receipt artifact12412499512 SHA256 `a41a8448c0a1b9dfdf853b58bea7cd56525fd8ede14812684b12619c3c8ee04e`. Eski aday hata kayıtları tarihsel kanıttır; bu kabulün kaynağı değildir.

P06 **done (kod, main ve geliştirme/test kabulü)**: [PR38](https://github.com/SXQHex/FtkSaaS/pull/38), main `006ad36918ae823bc10fbdefa2d48901e193121c`;200 sözleşme/178 runtime/22 contract_only,54 migration/90 core tablo. Son headf2f9d6c/base8364144/tested merge1901fc6/treeb486ffe; bağımsız review5614150102, [aday39779013518](https://github.com/SXQHex/FtkSaaS/actions/runs/39779013518), [aynı main39782197422](https://github.com/SXQHex/FtkSaaS/actions/runs/39782197422) ve [CD39785146645 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39785146645) success. CD18 kontrol/54 içerik eşleşmesi/Edge7 ACTIVE/verify_jwt=true/RLS kapalı0/client RPC EXECUTE0 ve fixture temizliği geçti; receipt12428881259 SHA256 `bcd1ab3255c1808982de76c3d09d47d5eaa95c5fb2e8f9f870d3fedc9ce93b65`. Önceki aday hataları tarihsel kanıttır. OPS-W01 PR39 main’e birleşti; aynı main clean başarısız, retry/CD/hosted kabulü açıktır. P07-A Draft geliştirmesi son kullanıcı talimatıyla sürer; tenant config/binding uydurulmaz.

PR36 operasyonel takip kapandı: aynı main [39644044693](https://github.com/SXQHex/FtkSaaS/actions/runs/39644044693) success; [CD39646391222](https://github.com/SXQHex/FtkSaaS/actions/runs/39646391222) success,18 kontrol,52/52 migration, pending[], Edge5 değişmeden ACTIVE/verify_jwt=true. Atomik Management API transport yeni migration olmadan da rollback probe ile doğrulandı. Bot/deneme hedefi hâlâ kullanıcı kararıyla ertelendi; hosted P05 worker kurulmuş değildir.

P01–P06 ve PR36 kabulü kapandı. OPS-W01 PR39 birleşti; main retry/CD/hosted kabulü açık. P07-A sekiz API Draft PR40 altında geliştirilir; kabul sırası PR39 kapanışı→PR40.

CD-01 **done**: PR32 kurulum + PR33 test fixture düzeltmesi sonrası kabul edilmiş main `0fabf3a4a605dd6be5a1d358c660021f59406e20`. [Main39588975421](https://github.com/SXQHex/FtkSaaS/actions/runs/39588975421) ve [ilk canlı CD39590690817/attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/2) completed/success. CD receipt aynı source/main/run kabulünü bağlar;17 kontrol başarılı,49 migration içerik eşleşmesi,90 core tablo/RLS, anon/authenticated EXECUTE0, Edge backend-v1 v4 ACTIVE/verify_jwt=true. Gerçek Auth→Edge→RPC, oturum reddi ve fixture temizliği geçti; ayrıca uzak son0 hesap/0 Auth kullanıcısı/0 organizasyon doğrulandı. Envanter199/140 runtime/59 contract_only değişmedi. P04 CRM/public başvuru queued; başlamadı. Hosted worker işletimi, frontend, dış e-posta ve yük/restore bu kapanışla tamamlanmaz.

P03 **done**: [PR #30](https://github.com/SXQHex/FtkSaaS/pull/30), kabul edilmiş main `10710ffa90747a7e35c452c4c07ba59522f50ce3`. Son head2526347 / basece95a9d / tested merge1768fc2 / tree9ac328b aynı kaynak zinciridir. Bağımsız kaynak incelemesi PR review5594023911 içinde kayıtlı; [aday39527260056](https://github.com/SXQHex/FtkSaaS/actions/runs/39527260056) ve [aynı main39529992556](https://github.com/SXQHex/FtkSaaS/actions/runs/39529992556) completed/success.96 yapı +37 CI politika +27 DB +316 API =476 test düğümü; fail/skipped0,49 migration. Main13:18; aday13:34. Envanter199 sözleşme/140 runtime/59 contract_only,90 core tablo. Geliştirme/test Supabase aynı49 migration/Edge3 kaynağına eşitlendi; ayrı dokuz kontrollü Auth→Edge→RPC smoke ve fixture temizliği başarılı. P04 queued, başlamadı.

P02 **done**: [PR #28](https://github.com/SXQHex/FtkSaaS/pull/28), kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167`. Envanter **199 sözleşme / 133 runtime / 66 contract_only / 40 migration / 90 core tablo**. Son head `35816cc30a9b28e273e94e6cef86e8b402dbaad0` bağımsız incelemeden geçti; [hedefli39448566998](https://github.com/SXQHex/FtkSaaS/actions/runs/39448566998), [aday39455462417](https://github.com/SXQHex/FtkSaaS/actions/runs/39455462417) ve [aynı main39461804543](https://github.com/SXQHex/FtkSaaS/actions/runs/39461804543) completed/success. Full kapsam:96 sözleşme/yönetişim +37 CI politika +27 DB +309 API =469 test düğümü; fail/skipped0. Core, dört izole API shard, toplayıcı,40 migration, seed/health/advisors geçti. Main clean14:43; önceki43:33 hedefli koşu seri tüm-suite fallback kullandı, aynı çalışma profili değildir. Eski başarı yeni kaynağa taşınmaz.

Geliştirme/test Supabase `gwyprhenabtpkbojephw`, kabul edilmiş main `006ad36918ae823bc10fbdefa2d48901e193121c` kaynağına CD39785146645 ile eşitlendi:54 migration/Edge7/178 runtime,18 kontrol ve fixture temizliği. OPS-W01 native worker kaynağı55 migration taşır; kaynak ve hosted kabulü henüz beklenir. Frontend/dış e-posta/yük/restore ayrı kalır.

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
| OPS-W01 | Hosted worker işletimi | — | in_progress | Supabase Cron seçildi; native kaynak55 migration; son kaynak/hosted işletim kabulü beklenir |
| P07 | Hesap, organizasyon ve abonelik yaşam döngüsü | 22 | in_progress (Draft P07-A 8/8 kaynak) | PR39 kabulü sonrası PR40 clean |

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

20 Ekim son kullanıcı talimatı: her main birleşmesinin aynı kaynak kabulü doğrulandıktan sonra `gwyprhenabtpkbojephw` FtkSaaS **geliştirme/test** ortamını da o main ile eşitle. Önce migration geçmişi ve içerik eşleşmesini doğrula; yalnız eksik migration’ları sırasıyla uygula, değişen Edge bundle’ını yayımla, JWT/izin kapılarını koru; aynı içerik varsa yeniden kurulum yapmadan eşleşmeyi kaydet. Ardından uzak Auth→Edge→RPC smoke, RLS/EXECUTE ve advisors doğrulaması yap; kaynak SHA/migration/Edge sürümü/sonucu kaydet. Bu, ajanın teslim kapanış adımıdır; otomatik CD workflow’u kurulduğu anlamına gelmez. Production yetkisi değildir. Testler yalnız ayrılmış sentetik verilerle yapılır; mevcut gerçek veriyi reset etme. `npm run test:clean` loopback kabulünde kalır; hosted smoke onun yerine geçmez. Full clean çalışırken izleme/yayın devamı durur; kullanıcı dönüşünde gerçek main kabulü sonrası bu adıma geçilir.


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

Kullanıcı22 Ekim Supabase içi barındırmayı seçti. Native p01/p05/p06 dedicated session_user, açık tenant binding, ayrı claim/execute commit'leri, sınırlı bank/retry, heartbeat/durdurma ve kesinti sonrası lease reclaim. [OPS devri](ops-w01-handover.md). Önce son kaynak bağımsız inceleme ve full/main clean/CD; sonra kabul edilmiş install SQL ve hosted heartbeat/durdurma/yeniden başlatma doğrulaması.0 tenant için izin/ürün/config uydurulmaz; işletim boş kuyrukta idle olabilir. P07 kabulü bu kapanıştan sonradır. Kullanıcı22 Ekim istisnasıyla geliştirme Draft PR40 altında ilerler; full clean/merge bekletilir.

### P07 — Hesap, organizasyon ve abonelik yaşam döngüsü

Draft PR40 A kapsamının sekiz API kaynağını ve yönetim okumalarını taşır. Parola API’si gerçek sağlayıcı challenge başlatıcısıdır; parola tamamlaması native Supabase Auth yoludur. A kaynak kabulü bekler; B/C aynı PR40 içinde tamamlanır. [Taslak devir](p07-a-handover.md).

Ortak üretim promptunu uygula. Durum: in_progress; A kaynak hazır, B/C aynı Draft PR40 içinde sıradadır.

**Mevcut sözleşme API'leri (22):**

- `account_profile_update_v1`
- `account_password_change_v1`
- `account_password_reset_request_v1`
- `account_access_revoke_v1`
- `account_link_remove_v1`
- `person_merge_preview_v1`
- `person_merge_approve_v1`
- `person_merge_apply_v1`
- `subscription_upgrade_quote_v1`
- `subscription_downgrade_request_v1`
- `subscription_change_cancel_v1`
- `subscription_renewal_set_v1`
- `saas_grace_extend_v1`
- `subscription_boundary_apply_v1`
- `account_delete_preview_v1`
- `account_delete_apply_v1`
- `organization_close_preview_v1`
- `organization_close_apply_v1`
- `organization_reopen_v1`
- `organization_delete_preview_v1`
- `organization_delete_apply_v1`
- `privacy_execute_v1`

**Görev ve kabul:**

Bu grubu bağımlılık sıralı A→B→C geliştir; son kullanıcı kararıyla üçü tek Draft PR40 ve tek merge/kabul zinciridir.
A: account_profile_update/password_change/password_reset_request, account_access_revoke, account_link_remove, person_merge_preview/approve/apply. Canlı geri alma/oturum, yeniden bağlamada eski grantın canlanmaması ve etkilenen merkez onayları. Profil değişimi rol/iletişim yetkisini aşmasın.
B: subscription_upgrade_quote/downgrade_request/change_cancel/renewal_set, saas_grace_extend, subscription_boundary_apply. Kabul edilmiş fiyat farkı/dönem sonu düşürme/merkez seçimi/yenilememe/gecikme ayrımı; sayısal değer icat etme, aylık-yıllık dönüşüm ekleme, kaçırılmış otomasyonu topluca çalıştırma.
C: account_delete_preview/apply, organization_close_preview/apply/reopen/delete_preview/delete_apply, privacy_execute. Hesap silme, org kapatma, abonelik bitişi ve imha ayrı kalsın. Owner engelleri, reauth ve kapsam onayı uygulansın; borç/alacak/hukuki kanıt kendiliğinden silinmesin.
Saklama süreleri geçici/hukuk teyidi açık kalır. DB/dosya/rapor/geçici kopya/yedek gerçek imhası doğrulanmadan completed verme; eksik altyapıda partial/pending açık kalsın.
Dış e-posta sağlayıcısı gerektiren parola sıfırlama akışında erteleme sınırını aşma; mevcut güvenli test yolu ile dış teslim kanıtını ayır.
Kabul: eski oturumun reddi; abonelik sınır anları; kapatma/izinli geri dönüş; silme sonrası yeniden canlanmama/tenant izolasyonu.


