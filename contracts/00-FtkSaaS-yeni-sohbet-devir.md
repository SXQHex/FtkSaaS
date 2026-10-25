# FtkSaaS güncel devir

## 26 Ekim — PR48 kabulü ve ürün önceliği

Main `34aac276ba124405cc99129a354ff61c376977d1`:207 API/62 migration. PR48 head0397d8ba için bağımsız review5645032155 + aday40230141266 ve exact-source kullanıcı kurulum onayı sonrası normal merge yapıldı. Aynı main [clean40232332540](https://github.com/SXQHex/FtkSaaS/actions/runs/40232332540) ve [development CD40234018404](https://github.com/SXQHex/FtkSaaS/actions/runs/40234018404) başarılı; deploy adımı gerçekten çalıştı. CLI tam2.122.0; dört shard ve full/main assertionları korunur.

Son kullanıcı kararı: yeni altyapı/otomatik süre ölçüm sistemi geliştirilmez. Ayrı kalıcı dummy/pilot organizasyon oluşturma işi iptal edildi; yalnız mevcut sentetik verilerin her seferinde silinmesi gerekmiyor. Önce restore sahiplik/izin denemesi, ardından kalan ürün/ayar API’leri. Alttaki eski kalıcı pilot ve bakım önceliği notları tarihsel snapshot’tır; açık kurulum görevi olarak uygulanmaz. [Güncel kabul sınırı](../docs/remote-backend-setup.md#restore-20261026).


## 25 Ekim — PR47 kabulü ve öncelikli CI bakımı

Main `9fd084b9ddbbefc225c98adbf3f25ddee85a9b6e`:207 API/62 migration. PR47 aday40218840402, aynı main40226464989 ve development CD40228555171 başarılı; önceki PR47 aday/pending notları snapshot’tır. Worker session pin ve dar EXECUTE kaynağı yayımlandı; hosted advisors’ta public.rls_auto_enable iki client EXECUTE uyarısı kalktı. COMMIT yapan ops_run için kalan search_path linter uyarısı güvenli session pin/role defaultu sınırıyla belgeli istisnadır; parola uyarısı önceki Free-plan kararıyla kapsam dışıdır. Son kullanıcı talimatı CLI tam2.122.0 ve gerçek sürelere göre dört shard dengelemesidir; full/main clean ve assertionlar korunur. [Bakım kaynağı ve ölçümler](../docs/ci-performance.md). Kalan ayar alanları, kalıcı hosted dummy pilot ve restore/managed sahiplik kabulü açık iş olarak sürer. Veriler için kullanıcı teknik karar yetkisi verdi; bu bakımda hosted veri silinmez/değiştirilmez.

## 25 Ekim — aktif backend ve kalıcı pilot teslimi

Main `d6b67139445f2b88298fc0ee6e1f5c476f3586b7`:207 API/61 migration; PR45 main clean40206350648 ve development CD40207909599 başarılı. Aşağıdaki eski PR45 pending notları önceki aday snapshotıdır. Son kullanıcı talimatı beş ayar kapsamının backend/API kabulü, pilot zinciri ve restore/operasyon güvenliği teslimidir. Frontend için yeni alt alan kullanılacak; önce backend hazır edilir. Sentetik pilot verileri ayrı organizasyonda geliştirme Supabase’inde kalıcı tutulabilir; her koşuda silinmez. Dağıtım öncesi sıfırlama ayrıca yapılır; mevcut gerçek kulüp verileri şimdi silinmez. [Teslim sırası, kapsam ve kanıt sınırı](../docs/pilot-readiness.md). Bu ilk aday207/62 olup bütün ayar/hosted pilot/restore kabulü değildir.

## 25 Ekim — PR45 kapasite ve main ayarları uzlaştırması

Başlangıç main `3456050a3061d7bf5dc2ce8898b82c5cfe84e773`: **206 callable API / 60 migration**; PR46 ayarları birleşti, aynı main clean [40200716603](https://github.com/SXQHex/FtkSaaS/actions/runs/40200716603) ve development CD [40202862244](https://github.com/SXQHex/FtkSaaS/actions/runs/40202862244) başarılı. Bu PR45 birleşim adayı kapasite işlemini ekler: **207 callable API / 61 migration**. Altı ayar işlemi ve kapasite davranışı birlikte korunur. Henüz uygulanmamış kapasite migration’ı main’deki ayar migration’ından sonra sıralandı; SQL içeriği ve mevcut 60 migration değişmedi. Önceki PR45 clean yalnız eski tabana aittir; bu birleşik kaynak için bağımsız inceleme ve yeni aday/main clean gerekir. Kapasite henüz main/hosted kabulü değildir.

[Alanlar, API'ler ve kesin destek sınırı](../docs/frontend-settings-handover.md). Teknik SQL/worker yönetimi erteli; beş ekranın bütün 69 davranış grubu tamamlandı denmez. Hazır renk/font/logo, native provider/MFA/oturum ve diğer özel yaşam döngüsü açıkları bu genel tercihlere dönüştürülmez.


## 25 Ekim kaynaklar arası uzlaştırma

| Kaynak | Durum |
|---|---|
| Main `3456050a3061d7bf5dc2ce8898b82c5cfe84e773` |206 callable API/60 migration/90 core tablo. PR46 aday40183389440 ve main40200716603 clean success; development CD40202862244 success. |
| PR44 |69 ana grup +12 FD belge kaynağı PR46 içinde main’e taşındı; ayrı runtime teslimi değildir. |
| PR43 |Hazır org renk/font ihtiyacı; FD02 ile seçilen yetki/public okuma/merkez override sınırları günceldir. Eski açık seçenek notları yeni kararları geri açmaz; branch merge edilmedi. |
| PR45 |Main3456050a ile uzlaştırılan207 API/61 migration kapasite adayı; yeni son kaynak inceleme/aday/main clean bekler. Eski head149be4f4 review5641685684/full clean40164825351 yalnız eski tabana ait kanıttır. |

Güncel kararlar: FD01–FD12 kapalı; standart negatif limit 0/mevcut kulüp −2. E-posta+parola ve Google kayıt/giriş kabul; Apple/Instagram login/bağlama kapsam dışı, passkey erteli. Instagram reklam lead alımı ayrı üretim P08 işi olarak kalır. Seans tek toplam/kategori ve oda fiziksel sınırı; kontrollü tek kayıt aşımı ayrı. [Tek karar](02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari), [frontend devri](../docs/claude-handover.md). Ürün kararı, mevcut main API ve başarılı PR adayı aynı teslim durumu değildir.

## 25 Ekim — frontend karar sprinti tamamlandı

69 ana grubun backend/frontend alan ayrımı ve beş scope sınıflaması tamamlandı; **FD01–FD12 kullanıcı tarafından kabul edildi**. [Kesin alan/default/kapsam kararları](02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama) tek kaynaktır. Standart yeni org negatif kredi limiti 0; mevcut kulüp −2 ve diğer gerçek ayarlar korunur. Yeni ana/FD karar turu açılmaz. Sıradaki iş mevcut 200 işlemle alan/DTO/permission/sürüm/API açığını eşlemek, gerekli runtime ve kabulünü ayrı teslim etmektir. Bu belge kapanışında hiçbir default/API/sağlayıcı/canlı veri uygulanmadı; PR43/44 merge/deploy sayılmaz. Backend işletim ayarları ertelenmiş kalır.

## Son öncelik — frontend beş ekran teslimi

Kullanıcı–üye–merkez–org–platform ayar ekranlarının alanları, gerçek API ve ortak tipleri frontend’e teslim edilecek. Kullanıcı global hesap; üye org person/relationship ve org tercihi. [Alan/API matrisi](../docs/claude-handover.md) mevcut 200 işlemdeki gerçek desteği, eksik marka/tercih/katalog yollarını ve kabul şartını ayırır. SQL/Cron/DB/worker teknik işletim yönetimi ertelendi. Bu yeni öncelik önceki salt belge kapanışı sınırından sonra verilmiştir; belgede API adının yazılması uygulama kabulü değildir. PR43 veya PR44 henüz merge/deploy edildi sayılmaz.

## 24 Ekim 2026 — ayar davranış sprinti kapanışı

69 ana grup kullanıcı tarafından kabul edildi: S01–S17 kullanıcı, M01–M22 merkez, O01–O21 organizasyon ve P01–P09 platform. [Tek settings sözleşmesi](02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) grup bazlı kararı ve açık alan/değer/yetki/API matrisini taşır. Yeni ana grup eklenmez; henüz seçilmemiş default/limit/sağlayıcı veya permission uydurulmaz. Eski Word O/P aileleri ve üretim P01–P08 numaraları ayrı kapsamdır. Yerel 208/60 taslak kullanılmaz; kod/şema/API geliştirmesi bu kapanışla başlamaz.

Belge tabanı `702063807b0a0d09f559f070ffde1b1ae3e7563b` (PR42), tree `272a4d968a90d450d98078040025d48b6db6417d`. [Aday belge39889500257](https://github.com/SXQHex/FtkSaaS/actions/runs/39889500257), kaynak bağlı merge kapısı ve [aynı main39890889184](https://github.com/SXQHex/FtkSaaS/actions/runs/39890889184) success. Main documentation success, runtime clean skipped: bu yeni full clean değildir. [CD39890983257](https://github.com/SXQHex/FtkSaaS/actions/runs/39890983257) source success/deploy skipped. Runtime 200/59 ve aşağıdaki P07 kabulü değişmedi. Aynı main'in sonraki cancelled targeted koşusu bu kaynak bağlı belge kabulünü başarısız yapmaz ve ek kabul kanıtı sayılmaz.

Açık PR43 `3eaa0cff6173a81db97d779c8f2ba679f124a869` organizasyon renk/font paketleri frontend ihtiyaç notu okundu; katalog/kalıcı seçim/logo/izin/sürüm-cache-fallback/ortak tip beklentileri teknik sözleşmede O01/S08/P01/P04 alan eşlemesine kaydedildi. PR43 merge edilmedi ve mevcut API kabulüne dahil sayılmaz; ayrı branch üzerine yazılmadı.

## 23 Ekim 2026 güncel kaynak ve kabul

- Belge tabanı main `bfb8ccb29a1e0ca9efde7813dc3af4bbbad8768d` (PR41); 200 yayımlanmış operasyon, 0 yalnız sözleşme, 59 migration, 90 core tablo. P08 veya yeni settings API’si yayımlanmadı.
- P07 PR40 son head `5e5bec8beb9fa0d0990ff32f4bad7a9115124e28`, aynı incelenmiş/test edilmiş tree `49214064f8325dd8da121e24aa2d55004a3e1669`; [aday39863852941](https://github.com/SXQHex/FtkSaaS/actions/runs/39863852941) success sonrası normal merge `4cfc9a55ca8ff8ccf723d91d98abe33e47311d54`.
- [Aynı runtime main39866466608](https://github.com/SXQHex/FtkSaaS/actions/runs/39866466608): gerçek core/API1–4/toplayıcı success. [CD39869023193](https://github.com/SXQHex/FtkSaaS/actions/runs/39869023193): 18 kontrol, 59 migration içerik eşleşmesi, Edge8 ACTIVE/JWT, 90 core tabloda eksik RLS0/uygulama RPC client EXECUTE0, gerçek Auth→Edge→RPC ve sentetik fixture temizliği. Receipt artifact12465975149 SHA256 `964841e1b0ccc0623c63f966b63976da745b95592ace300478ddeb93ecb3c106`. Receipt pending_migrations listesi dağıtım öncesi dört dosyadır; başarılı readback sonrasında kalan eksik migration anlamına gelmez.
- PR41 [belge39872819806](https://github.com/SXQHex/FtkSaaS/actions/runs/39872819806), [main39873010292](https://github.com/SXQHex/FtkSaaS/actions/runs/39873010292) success: kaynak bağlı yalnız-belge kabulüdür; yeni runtime full clean değildir. [CD39873101014](https://github.com/SXQHex/FtkSaaS/actions/runs/39873101014) source success/deploy skipped; yeni dağıtım sayılmaz. Aynı head'deki targeted39877930243 cancelled; kabul kanıtı değildir.
- 23 Ekim 05:04 Türkiye hosted salt-okuma kontrolü: p01/p05/p06/p07/p07_privacy beş Cron5sn/active; beşi enabled/idle, failed0/claimed0. p07 ticks1620, privacy ticks1620; p07 bir gerçek org scope, privacy aynı org + global null scope. Quote TTL3600sn/reauth900sn kullanıcı seçimiyle kuruldu. Yeni P07 hatlarında temel kurulum/heartbeat doğrulandı; gerçek iş yükü, yeni hosted kesinti/disable-restart ve fiziksel imha kanıtı bununla kapanmaz.

## Frontend başlangıcı

[Ayarlar sözleşmesi](02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) 69 ana ayar grubunun ürün davranışlarını taşır. [Entegrasyon devri](../docs/claude-handover.md) callable alanları ve açık bağımlılıkları ayırır. Ana gruplar kapandı; kullanıcı odağı ayarlar ve alan ayrıntılarıdır. Bu teslim yalnız belgeleri günceller; yeni runtime geliştirmesi başlamaz. 208 API/60. migration içeren yerel ayar taslağı kaynak kabulü değildir ve yayımlanmamıştır.

## Önceki devir snapshotları

Aşağıdaki eski geliştirme/CI durumları kendi tarihlerine aittir; yukarıdaki kapanışı yeniden açmaz. Kabul edilmiş ürün hükümleri son kararlarla çelişmediği ölçüde geçerlidir.


22 Ekim API-3 teşhisi: [aday39852699702](https://github.com/SXQHex/FtkSaaS/actions/runs/39852699702) kullanıcı tarafından iptal edildi; kabul değildir. Registry sonrasında açık kalan PostgreSQL bağlantısının nedeni P07 lifecycle fixture cleanup’ındaki `DROP OWNED` yetki hatasıdır. Dar düzeltme ve süre sınırlı tanılama yalnız ilgili suite üzerinde doğrulanır; [kanıt ve kapsam](../docs/p07-a-handover.md#api-3-registry-sonrası-kapanış-teşhisi). Profil/merge iki test beklentisi de ürün/SQL kodu değiştirilmeden düzeltildi; temiz59 migration ve gerçek Auth→Edge→RPC ile9/9 native test95.887s’de geçti, kalan PG bağlantısı0. Kullanıcı yeni aday full clean istedi; son kaynak incelemesi sonrası tek koşu başlatılır, merge/main clean/CD kabulü ayrıca bekler. Eski iptal edilmiş koşuyu rerun etmek yeni test kaynağını kullanmaz.

22 Ekim son kullanıcı kararı: P07-A+B+C tek Draft PR40 içinde bağımlılık sırasıyla geliştirilir ve birlikte merge edilir. Ayrı A/B/C merge/kabul döngüleri kaldırıldı. GitHub servisleri normale dönene kadar manuel CI, rerun, aday label ve merge başlatılmaz; geliştirme commitlerinde geçici `[skip ci]` kullanılarak push kaynaklı pahalı CI ertelenir. Workflow veya kabul kapısı değiştirilmez. Yerel odaklı doğrulamalar sürer. Servisler normale dönünce PR39 main39809302120 attempt6/CD39820836027 attempt2/OPS hosted kapanışı doğrulanmıştır; sırada tamamlanmış P07 için son kaynak bağımsız inceleme, tek aday full clean, merge ve aynı main clean/CD sırasıyla yapılır. Eski/skipped CI kabul değildir; P07 A8+B6+C8 kaynakları aynı Draft PR40 içinde uygulanmıştır. Son kaynak bağımsız inceleme ve gerçek Auth/Edge/worker aday/main clean kabulü ayrıca bekler; kaynak tamamlanması işletim kabulü değildir.

22 Ekim güncel durum: OPS-W01 PR39, `d1830c89e3d5e7f3c90db7ef0953cc264b35205f` ile main’e birleşti. Aday39795678387 attempt5 kabulü doğrulandı; aynı main [39809302120 attempt6](https://github.com/SXQHex/FtkSaaS/actions/runs/39809302120/attempts/6) completed/success: source, core, API1–4 ve toplayıcı gerçek kabul adımları başarılıdır. Main retry işi kapandı. [CD39820836027 attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39820836027/attempts/2) completed/success:18 kontrol,55/55 migration içeriği, pending[], Edge7 değişmeden ACTIVE/verify_jwt=true, RLS/EXECUTE, gerçek Auth→Edge→RPC smoke/advisors ve fixture temizliği geçti. Receipt artifact12445920610 SHA256 `a1261502037363f5bf77fdc2a714eb780f9ec42012484104bd53f6e922d87cb5`. Kullanıcı yetkisiyle22 Ekim20:32–20:33 (Türkiye) Cron2/3/4 kuruldu: p01/p05/p06 kendi LOGIN kimlikleriyle5sn çalışır; üçü healthy/idle, hata0. P06 disable sırasında tick4 sabit kaldı, enable sonrası6 oldu; açık tenant binding0/org0 olduğundan iş claim0. OPS-W01 kaynak/main/CD ve boş kuyruk hosted işletim kabulü kapandı. P07 taslak kaynakları hosted uygulanmadı. Yeni CI/CD koşusu şimdi tetiklenmez. P07 Draft PR40 kaynak envanteri: **200 sözleşme/200 geliştirme runtime/0 contract_only/59 migration/90 core tablo**. A8+B6+C8 kod yolları, typed DTO/validator/Edge ve append-only migration içinde uygulanmıştır. Fiziksel imha kanıtı eksikse gizlilik partial kalır; gerçek Auth→Edge/dedicated LOGIN/aday/main kabulü ayrıca bekler. Full clean/merge şimdi tetiklenmez; kapılar gevşetilmez. [P07-A devri](../docs/p07-a-handover.md).

P05 **done (kod, main ve geliştirme/test kabulü)**: [PR37](https://github.com/SXQHex/FtkSaaS/pull/37), kabul edilmiş main `83641447b29e459236aea1a9a4379b5d19825af6`;200 sözleşme/165 runtime/35 contract_only,53 migration/90 core tablo. Son head15e2126/base16cb570/tested merge2ebe087/tree736a75b; bağımsız son kaynak incelemesi5611074233, [aday39745672815](https://github.com/SXQHex/FtkSaaS/actions/runs/39745672815) ve [aynı main39748053581](https://github.com/SXQHex/FtkSaaS/actions/runs/39748053581) completed/success. [CD39750264949 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39750264949) success:18 kontrol,53/53 içerik eşleşmesi, P05 migration uygulandı, Edge6 ACTIVE/verify_jwt=true, RLS kapalı0/client RPC EXECUTE0 ve sentetik fixture temizliği. Receipt artifact12412499512 SHA256 `a41a8448c0a1b9dfdf853b58bea7cd56525fd8ede14812684b12619c3c8ee04e`. Eski aday hata kayıtları tarihsel kanıttır; bu kabulün kaynağı değildir.

P06 **done (kod, main ve geliştirme/test kabulü)**: [PR38](https://github.com/SXQHex/FtkSaaS/pull/38), main `006ad36918ae823bc10fbdefa2d48901e193121c`;200 sözleşme/178 runtime/22 contract_only,54 migration/90 core tablo. Son headf2f9d6c/base8364144/tested merge1901fc6/treeb486ffe; bağımsız review5614150102, [aday39779013518](https://github.com/SXQHex/FtkSaaS/actions/runs/39779013518), [aynı main39782197422](https://github.com/SXQHex/FtkSaaS/actions/runs/39782197422) ve [CD39785146645 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39785146645) success. CD18 kontrol/54 içerik eşleşmesi/Edge7 ACTIVE/verify_jwt=true/RLS kapalı0/client RPC EXECUTE0 ve fixture temizliği geçti; receipt12428881259 SHA256 `bcd1ab3255c1808982de76c3d09d47d5eaa95c5fb2e8f9f870d3fedc9ce93b65`. Önceki aday hataları tarihsel kanıttır. OPS-W01 PR39 main’e birleşti; aynı main clean attempt6/CD attempt2 ve hosted boş kuyruk işletim kabulü kapandı. P07-A Draft geliştirmesi son kullanıcı talimatıyla sürer; tenant config/binding uydurulmaz.

PR36 operasyonel takip kapandı: aynı main [39644044693](https://github.com/SXQHex/FtkSaaS/actions/runs/39644044693) success; [CD39646391222](https://github.com/SXQHex/FtkSaaS/actions/runs/39646391222) success,18 kontrol,52/52 migration, pending[], Edge5 değişmeden ACTIVE/verify_jwt=true. Atomik Management API transport yeni migration olmadan da rollback probe ile doğrulandı. Bot/deneme hedefi hâlâ kullanıcı kararıyla ertelendi; hosted P05 worker kurulmuş değildir.

P04 **done (kod ve kaynak kabulü)**: [PR35](https://github.com/SXQHex/FtkSaaS/pull/35), kabul edilmiş main `7b96d8866abb2c056d1b59a96afee0696a1187d6`;199 sözleşme/151 runtime/48 contract_only,52 migration/90 core tablo. Son head55c23dd, base920cdbb, tested merge901c64a, treee2011a6 kaynak zinciri; bağımsız son kaynak incelemesi ve [aday39630534660](https://github.com/SXQHex/FtkSaaS/actions/runs/39630534660) ile [aynı main39633243405](https://github.com/SXQHex/FtkSaaS/actions/runs/39633243405) completed/success doğrulandı. [CD39635569033 attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39635569033/attempts/2) success:52/52 içerik eşleşmesi, Edge5 ACTIVE/verify_jwt=true,17 kontrol ve sentetik fixture temizliği. İlk CD'deki CLI migration hatası aşağıdaki operasyonel takipten ayrıdır; ikinci denemede eksik migration kalmadığı için o yol sınanmadı.

21 Ekim bot/deneme hedefi kararı sürer: alan adı/tenant/ürün/süre/tekrar limiti uydurulmaz. PR36 transport kapanışı ve yeni P05 kabul sınırı yukarıdadır; eski P04/CD-01 metinleri yeni kaynağa başarı taşımaz.

CD-01 **done**: PR32 kurulum + PR33 test fixture düzeltmesi sonrası kabul edilmiş main `0fabf3a4a605dd6be5a1d358c660021f59406e20`. [Main39588975421](https://github.com/SXQHex/FtkSaaS/actions/runs/39588975421) ve [ilk canlı CD39590690817/attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/2) completed/success. CD receipt aynı source/main/run kabulünü bağlar;17 kontrol başarılı,49 migration içerik eşleşmesi,90 core tablo/RLS, anon/authenticated EXECUTE0, Edge backend-v1 v4 ACTIVE/verify_jwt=true. Gerçek Auth→Edge→RPC, oturum reddi ve fixture temizliği geçti; ayrıca uzak son0 hesap/0 Auth kullanıcısı/0 organizasyon doğrulandı. Envanter199/140 runtime/59 contract_only değişmedi. P04 CRM/public başvuru queued; başlamadı. Hosted worker işletimi, frontend, dış e-posta ve yük/restore bu kapanışla tamamlanmaz.

P03 **done**: [PR #30](https://github.com/SXQHex/FtkSaaS/pull/30), kabul edilmiş main `10710ffa90747a7e35c452c4c07ba59522f50ce3`. Son head2526347 / basece95a9d / tested merge1768fc2 / tree9ac328b aynı kaynak zinciridir. Bağımsız kaynak incelemesi PR review5594023911 içinde kayıtlı; [aday39527260056](https://github.com/SXQHex/FtkSaaS/actions/runs/39527260056) ve [aynı main39529992556](https://github.com/SXQHex/FtkSaaS/actions/runs/39529992556) completed/success.96 yapı +37 CI politika +27 DB +316 API =476 test düğümü; fail/skipped0,49 migration. Main13:18; aday13:34. Envanter199 sözleşme/140 runtime/59 contract_only,90 core tablo. Geliştirme/test Supabase aynı49 migration/Edge3 kaynağına eşitlendi; ayrı dokuz kontrollü Auth→Edge→RPC smoke ve fixture temizliği başarılı. P04 queued, başlamadı.

P02 **done**: [PR #28](https://github.com/SXQHex/FtkSaaS/pull/28), kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167`. Envanter **199 sözleşme / 133 runtime / 66 contract_only / 40 migration / 90 core tablo**. Son head `35816cc30a9b28e273e94e6cef86e8b402dbaad0` bağımsız incelemeden geçti; [hedefli39448566998](https://github.com/SXQHex/FtkSaaS/actions/runs/39448566998), [aday39455462417](https://github.com/SXQHex/FtkSaaS/actions/runs/39455462417) ve [aynı main39461804543](https://github.com/SXQHex/FtkSaaS/actions/runs/39461804543) completed/success. Full kapsam:96 sözleşme/yönetişim +37 CI politika +27 DB +309 API =469 test düğümü; fail/skipped0. Core, dört izole API shard, toplayıcı,40 migration, seed/health/advisors geçti. Main clean14:43; önceki43:33 hedefli koşu seri tüm-suite fallback kullandı, aynı çalışma profili değildir. Eski başarı yeni kaynağa taşınmaz.

Geliştirme/test Supabase `gwyprhenabtpkbojephw`, kabul edilmiş main `0fabf3a4a605dd6be5a1d358c660021f59406e20` kaynağına otomatik CD ile eşitlendi:49 migration, Edge backend-v1 sürüm4, verify_jwt=true,140 runtime API. Uzak smoke ve geçici fixture temizliği başarılı; ayrıntılar docs/remote-backend-setup.md içindedir. Hosted worker zamanlayıcısı, ortak tenant/kullanıcı kurulumu, frontend gerçek entegrasyonu, yük/restore, dış e-posta ve production kabulü ayrı açık kalır.

P01, CI-02, P02 ve P03 done; sıradaki teslim P04 (11 API), üretim kaynağı [kuyruk](../docs/production-queue.md). P02’nin geliştirme ayrıntıları [P02 çalışma snapshot’ında](../docs/p02-handover.md) bulunur; oradaki son-head öncesi bekleme ifadeleri tarihsel kaynak durumudur, yukarıdaki doğrulanmış kapanış üstündür. P03 genel iadesi `private.p02_sale_settlements` ve bağlı borç/alacak hareketlerini tüketerek çift iade/alacak üretimini önlüyor. P03 çalışma devrindeki pending ifadeleri PR30 geliştirme snapshot’ıdır; yukarıdaki kaynak/run kapanışı üstündür.

Kabul ilişkisi: base `f6afef4bdc4ef1bcbf37697ae771fef04a9fb455`, head `35816cc30a9b28e273e94e6cef86e8b402dbaad0`, tested merge `d3234925b7e6919472ced1dd6486c57891a5c216`; actual main iki parent ile aynı tree `b9df0dc03d030eab934a70c7299a906a0f4217d7` taşır. Main binding artifact12283767893 / run39461804543 / attempt1 aynı kapsam ve actual kaynağı doğrular. Belge kapanış commit’i bu runtime kabulünün kaynağı değildir; kendi belge kabulü ayrıca doğrulanır.

<details>
<summary>Önceki uygulama ve teşhis kayıtları — tarihsel</summary>

## 20 Ekim 2026 — son kapsam incelemesi düzeltmeleri

Kaynak `c62106b77717d6c1b1129fe7fa8eca6060d05826` / [hedefli CI 39323812801](https://github.com/SXQHex/FtkSaaS/actions/runs/39323812801) başarılıdır: 120 yapı/politika + 27 DB + 67 API test düğümü (P01 26, ortak 41), toplam 214. Worker CLI/loop, minimal DB yetkileri ve üç denemelik hata yolu bu kaynakta geçti; önceki Auth transport hatası kapandı. Bu başarı yeni kaynağa taşınmaz.

Bütün P01 son incelemesi iki sözleşme eksiği buldu; yeni append-only migration34 ile düzeltildi: ayrı request_window tüketicisi ve worker'ın canlı merkez erişimi. Yeni hedefli runtime kabulü bekliyor; full clean/merge/main kabulü yapılmadı. Güncel geliştirme envanteri 199 / 118 çağrılabilir / 81 contract_only / 34 migration.

Talep oluşturma, alternatif sunma ve alternatif kabulü etkin org/merkez request_window politikasını private.policy_at ile okur; eksik yapılandırma kapalıdır, açılış dahil/kapanış hariçtir. Mevcut kabul edilmiş yönetici süre istisnasının DTO karşılığı window_exception:true ve nonempty reason'dır: politika manager_exception izni + canlı CM yetkisi + açık seçim/gerekçe birlikte gerekir. Sırf CM olmak veya politika bayrağı tek başına bypass değildir; gerekçe mevcut audit'te tutulur, CM yetkisi receipt replay öncesi tekrar denetlenir. Rezervasyon onayı kendi reservation_window kapısını korur; geri çekme/ret gibi temizleme bu yeni niyet kapısından bağımsızdır. Yeni sayısal politika veya ürün yetkisi eklenmedi.

Worker yeni teklif için merkez erişimini discovery limitinden önce ve executor/replay'de yeniden denetler; kapalı/plan dışında merkezde yeni hold/bildirim oluşmaz. Expiry temizliği açık kalır. Claim sonrası merkez kapanırsa runner NOT_FOUND için o fenced lease'i bounded reclaim'e bırakıp diğer merkezleri işlemeye devam eder; gerçek worker yetkisi iptalinde durur. Testler ayrıca çökmüş running lease geri alma ve kabulden sonra geç gelen expiry sırasını, önceki expiry-kazanır vakasına ekler.


## P01-C worker transport düzeltmesi — hedefli kabul bekliyor

Kaynak `4e3c5f11bd70e0e99885beffa41849727f170379` / [run 39322550067](https://github.com/SXQHex/FtkSaaS/actions/runs/39322550067) başarısızdır. 32 migration ve 120 yapı/politika + 27 DB + önceki A/B'nin 17 API test düğümü geçti. C'nin sekiz alt vakası aynı worker giriş hatasında kırıldı: genel execute_operation fonksiyonunun auth.users türünü içeren DECLARE bölümü, worker yönlendirmesinden önce derlenir; dar DB worker rolünün Auth şema erişimi yoktur. Bu, C davranış kabulü değildir.

Runner ve worker kabul testleri doğrudan mevcut private.p01_worker_execute(operation,request,ids) girişini kullanır; parametreler bound SQL'dir. Mevcut org/rol/job/op/lease/payload ve replay kontrolleri korunur. Yeni append-only migration 33 worker'ın gereksiz insan dispatcher/named API wrapper EXECUTE ve core USAGE yetkilerini kaldırır. Auth erişimi veya tablo DML yetkisi verilmez; uygulanmış önceki migration'lar değişmez. Negatif privilege testi Auth/core/human dispatcher erişiminin kapalı kaldığını, gerçek CLI/loop testleri doğru yolu doğrular. Doğrudan private helper yetki hataları SQL exception'dır; insan Edge zarfıyla karıştırılmaz.

Envanter 199 / 118 çağrılabilir / 81 contract_only / 33 migration; üretilmiş katalogdaki worker transport açıklaması eşitlendi. Yeni runtime kabulü bekler; P01 son bağımsız inceleme ve toplu aday/main clean henüz yapılmadı.


## P01-C uygulama dilimi — runtime kabulü bekliyor

P01-B kaynak `78d68653e903d9764264f1fe8d73dfb9d9de7f49` için [hedefli CI 39319195689](https://github.com/SXQHex/FtkSaaS/actions/runs/39319195689) başarılı: 120 yapı/politika + 27 DB + 58 API test düğümü (A/B 17, ortak 41); pg concurrent-query uyarısı logda yok. Bu sonuç yeni C kaynağına taşınmaz. P01-C yedi API, kapsamlı okuma ve gerçek worker runner uygulandı; yeni runtime kabulü bekliyor. Geliştirme envanteri 199 sözleşme / 118 çağrılabilir / 81 contract_only / 32 migration. P01 merge/main kabulü yok; bütün P01 sonunda toplu clean alınır.

Sistem worker DB kimliği/claim/lease/tekrar ve kabul sınırları [P01 devrinde](../docs/p01-handover.md); seri üretimin sonraki adımı [kuyruktadır](../docs/production-queue.md). Aşağıdaki eski pending/hata notları ait oldukları önceki kaynakların kayıtlarıdır.

P01-B son hedefli kaynak 7ef51f2b3c6b791eec27acbfb648b7c23b6e2b74 / run 39317251796 başarısızdır: organizasyon disiplini fixture'ının fazladan center_id alanı DTO reddi verdi; B davranış vakaları başlamadı. 31 migration, 120 yapı/politika ve 27 DB testi geçti. Fixture ve pg sayaç sorgusu uyarısı odaklı düzeltildi; yeni head hedefli kabulü bekler. Runtime sözleşmesi gevşetilmedi; [teşhis](../docs/p01-handover.md).

## 19 Ekim 2026 — P01 ayrı dalda bütün olarak geliştiriliyor

Main `24007212005d07938fb1265a9f42891f18d7fa09` ve main clean [39298247595](https://github.com/SXQHex/FtkSaaS/actions/runs/39298247595) başarılıdır. Mevcut ayrı dal `feature/p01-request-reservation-flow`, draft PR #22 korunur; mükerrer dal/PR açılmaz. P01-A head `b8d9adcff3607d7e055c5c71a9d4f8d5ca3a6013` hedefli [39303865804](https://github.com/SXQHex/FtkSaaS/actions/runs/39303865804) ve aday [39304797200](https://github.com/SXQHex/FtkSaaS/actions/runs/39304797200) başarılıdır; henüz merge edilmedi. Bu başarı sonraki kaynak değişikliklerine taşınmaz.

Son kullanıcı kararı: her commit hedefli doğrulanır; ara P01 dilimlerinde aday clean/merge yoktur. Bütün P01 bittiğinde son-head bağımsız incelemesi, toplu aday full clean ve merge; ardından aynı main kabulü gerekir. P01 done değildir.

P01-B altı talep komutu, ebeveyn sürüm okumaları ve dar rezervasyon-belge tüketicisi uygulandı; geliştirme kaynakları 199 sözleşme / 111 çağrılabilir / 88 contract_only / 31 migration içerir. Yerel generation/TypeScript ve 120 yapı/politika testi geçti; yeni Auth→Edge→RPC kabulü bekliyor. B'nin çalışma zamanı kabulü veya main kurulumu tamamlandı sayılmaz. Kalan P01-C yedi bekleme/teklif/expiry API'si ve gerçek worker işletimidir. [Ayrıntılı devir](../docs/p01-handover.md).


## 19 Ekim 2026 — CI bakımı kapalı, P01-A yeni aday

PR #23 tek seferlik güvenilir workflow kurulumu kullanıcı onayıyla normal merge yolundan 24007212005d07938fb1265a9f42891f18d7fa09 main SHA'sına alındı. [Aynı main clean 39298247595](https://github.com/SXQHex/FtkSaaS/actions/runs/39298247595) başarılı: 409 test (110 yapı/politika + 27 DB + 272 API), sıfır annotation warning/error; Verify merged candidate relation başarılı. Aday clean 39282766184 ile main tree 2b7a76e73ca1e2efd201b0d9a18bea4afe12007b ve iki parent ilişkisi doğrulandı. Repository ayarı, sahte başarı status'u veya required-check bypass yapılmadı; tek seferlik kurulum yetkisi sıradan P01 kabulüne taşınmaz.

Mevcut PR #22 aynı main ile birleştirilir; Node24 Action pinleri ve deterministik ortak kota fixture'ı korunur. P01 önceki head 580239075b16f6ac6893d5ac01975d32133d0757 / hedefli run 39281409902: 119 yapı/politika + 27 DB + 51 API geçti. Bu eski head kanıtıdır; yeni birleşik head hedefli/son inceleme/adayı ve main kabulü bekler. P01-A uygulanmış, P01-B/C 13 API açık; P01 done değildir.

## P01-A başlangıç ve önceki geliştirme kanıtları

Main 9ce0a5639417f959111b11f70157156733e3de18 ve [aynı SHA clean 39252687560](https://github.com/SXQHex/FtkSaaS/actions/runs/39252687560) başarılıdır. PR #21 kurtarması kapandı; PR #20'nin eski başarısızlığı yeni kabul yerine sunulmaz.

[P01-A devri](../docs/p01-handover.md): katalog ve seans bağlamında satın alınmış hak okuması uygulandı. 199 sözleşme / 105 çağrılabilir / 94 yalnız sözleşme; 30 migration. Yeni kaynak hedefli test/son inceleme/adayı ve main kabulü henüz bekliyor. P01'in 13 komutu, gerçek worker ve talep/bekleme uçtan uca kabulü açık.

PR #22 ilk head 635e148651b2a85b18f5d40fe1fdea938ea94bf2, run 39270054878: başarısız. Tek başarısız alt vaka Auth reddinin hata-kodu beklentisidir; test ve hedefli seçim düzeltiliyor. [Teşhis](../reports/p01-a-targeted-diagnosis.json), [CI politika düzeltmesi](../docs/ci-policy.md). Yeni kaynak runtime kabulü ve aday/main clean henüz yoktur.

İkinci koşu 39278529991 / head 85e25ec48cfc8f204392a757d333e284b02b6149 logunda P01 10/10, DB 27/27, yapı 96+23 geçti; ortak API weekly quota fixture assertion'ı başarısızdır. Logdaki yürütme yaklaşık 3:34; metadata durum gecikmesi ayrı engeldir. Aynı satış haftasını garanti eden fixture ve sonraki hafta bağımsız kota kontrolü uygulandı; runtime değişmedi. [Güncel teşhis](../docs/p01-handover.md). Yeni head hedefli kabul ve aday/main clean bekliyor.

P01 öncesi snapshot:

Üçüncü teslimin uygulama kapsamı: **199 sözleşme / 104 çağrılabilir / 95 yalnız sözleşme; 90 core tablo / 29 migration**. [Hesaplaşma devri](../docs/settlement-handover.md) çalışan akışı ve kabul sınırlarını tanımlar. Son head incelemesi ve tam temiz CI aynı SHA için ayrıca doğrulanır; işlem sayısı ürün tamamlanma yüzdesi değildir.

Başlangıç main: `bd4b6335904047f071556e5df35a982a71012c6e`; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39055469993) başarılıydı: 364 test, 28 migration. Bu eski başarı yeni teslimin CI kanıtı değildir. Son PR head/merge kanıtı PR üzerinde bağlanır. Hesaplaşma kaynak SHA’sı `3aa5effa0fe48ab7dc4c8d4ca97754b5392fa0ad` için [temiz CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39198323012) başarılı: 394 test (95 yapısal/sözleşme + 27 DB + 272 Auth/API), 29 migration, seed/sağlık/advisors. Sonraki commit ve merge main CI ayrıca doğrulanır.

Starter anlaşmasız program/yoklama/koruma ve Pro/Business immutable anlaşma, açık başlangıç, hakediş/bağlı düzeltme korunur. Üçüncü teslim ayrı hesaplaşma ledger'ı, dokuz API, Owner/delege OM/CM grant zinciri, A başvurusu/B onayı ve ders/satış tüketicilerini ekler. [Anlaşma/hakediş devri](../docs/instructor-earnings-handover.md), [kalan işler](../docs/remaining-work.md), [entegrasyon devri](../docs/claude-handover.md).

Eğitmen ödeme komutları; otomatik başlangıç gözlemi, belge ve diğer hak değişikliği koruma tüketicileri açıktır. Dış e-posta ertelendi; frontend gerçek entegrasyonu ve yük/restore kanıtsız kapatılmaz. Production dağıtımı yapılmaz. Son açık kullanıcı kararı ve AGENTS.md kuralları geçerlidir.

## Tarihsel devir kayıtları

Aşağıdaki önceki teslim metinleri yalnız ait oldukları kaynak snapshot'ını anlatır. İçlerindeki “güncel”, “açık” veya “merge yetkisi” ifadeleri bugünkü durum/yetki değildir. Güncel durum yukarıda, açık işler bağlantılı listededir; tarihsel reports/ dosyaları değiştirilmez.

<details>
<summary>Önceki devir metinleri (tarihsel)</summary>

# Eğitmen anlaşması ve hakediş — güncel geliştirme kapsamı

Başlangıç main: `ab3fca4af47b71b34a4a7b6d0df5211ad1e41141`; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39042108296) başarılı: 27 migration, 341 test. Yeni kaynak için önceki başarı taşınmaz; son head inceleme/temiz CI ve merge main CI ayrıca doğrulanır.

199 sözleşme, 95 çağrılabilir, 104 contract-only; 90 core tablo, 28 append-only migration. [Güncel anlaşma/hakediş devri](../docs/instructor-earnings-handover.md) yeni akışı ve sınırları tanımlar. Eğitmen ödeme komutları ve merkezler arası hesaplaşma runtime'ı bu teslim değildir. Önceki snapshot sayıları aşağıda tarihsel bağlamdır.

# DS-2026-10-17 — güncel sözleşme ve CI devri

## Starter yoklama/koruma teslimi — güncel kapsam

[Starter devri](../docs/starter-attendance-protection-handover.md) zorunlu bağımlılıkları ve kalan tüketicileri tanımlar. 198 işlem / 89 canlı / 109 contract-only; 90 core tablo / 27 migration. Starter program → rezervasyon → etki/onay → korunan katılım → kapanış → gerekçeli düzeltme uygulanır. Ücretli finansal kapanış açıkça kapalı; başlangıç/belge ve diğer hak değişikliği tüketicileri pending. Son SHA’nın kanıtı PR’dedir; eski başarı taşınmaz.

Doğrulanmış başlangıç: main `5265a70a0d29f91b9081a1ecbc2a8f0ff78668ee`; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39030586306) başarılı: 322 test, 25 migration. Bu teslim yeni Starter runtime ve 26–27. migration’ı ekler; 198 sözleşmeli işlem, 89 canlı / 109 yalnız sözleşme. Başlangıcın başarısı yeni head’e taşınmaz; son CI/inceleme PR üzerinde aynı tam SHA’ya bağlıdır.

[Karar sprinti devri](../docs/decision-sprint-handover.md), [kabul edilmiş kararlar](../docs/decisions/DS-2026-10-17.md), [F01–F33 haritası](../docs/feature-delivery.md), [main koruma denetimi](../docs/branch-protection-review.md). Yeni DS davranışları gerçek Auth → Edge → RPC kabulü bekler; sözleşme negatif testleri ve mevcut runtime regresyonu ayrı kanıttır. Son revizyon: docs/decisions/DS-2026-10-17-settlement-center-scope.md; kaynak/kanıt raporu: reports/settlement-center-scope-verification.json; son PR head inceleme ve tam temiz CI ayrıca doğrulanır.

Mevcut runtime anlaşma/plan/koruma farkları açıkça delivery_gaps olarak kaydedildi. DS-OPEN-01 grantor konusu son revizyonla karar düzeyinde kapalıdır: Owner delege OM iznini yönetir; Owner veya delege OM merkez CM grantını yönetir. B onayı kayıt/bakiyeyi atomik kesinleştirir; ayrı OM kayıt adımı kaldırıldı. DS-OPEN-02 son merkez yetki düzeltmesiyle karar düzeyinde kapalıdır: aynı hesap gerekli A/B merkez yetkileriyle iki adımı yapabilir; A-only yetki B onayı sağlamaz. Audit her adımın merkez/rol/grant kapsamını kaydeder, fallback yoktur. Runtime pending. Klasik main koruması API 403 nedeniyle doğrulanamıyor; rulesets boş, yönetim yazması yapılmadı. PR #13 tarihsel merge yetkisi bu yeni PR’yi kapsamaz; repository yönetimi ayrı iştir; frontend, production ve Resend'e müdahale edilmez.

---

Aşağıdaki önceki teslim kapsamları kendi kaynak snapshot’larıdır; güncel açık iş olarak yorumlanmaz.

# FtkSaaS — güncel başlangıç

Takvim/seans/rezervasyon okuma geliştirme kapsamı: **72/112**, 24 migration. [Okuma devri](../docs/schedule-read-handover.md); ürün kataloğu/uygun hak seçimi ayrı açık iştir. Son head CI ayrıca doğrulanır. Aşağıdaki 69/115 ve PR #8 sayıları tarihsel snapshot'tır.

Uygunluk/politika geliştirme kapsamı: **69/115**, 23 migration. [Güncel entegrasyon devri](../docs/claude-handover.md) bu dört işlemin sürüm/yetki/tüketici sınırlarını ve açık bağımlılıkları tanımlar. Bu yeni kaynak kabulü son PR/main SHA CI sonucundan ayrıca doğrulanır. Aşağıdaki PR #8 kanıtı tarihsel başlangıçtır.

Önce [kaynak indeksi](../docs/source-index.md), [AGENTS](../AGENTS.md), [kalan işler](../docs/remaining-work.md) ve [entegrasyon devrini](../docs/claude-handover.md) okuyun.

## Doğrulanmış başlangıç — 17 Ekim 2026

Kaynak main `b9bd9c110f0cf4a121eac6ef0752945de99b10ac`; [PR #8](https://github.com/SXQHex/FtkSaaS/pull/8) birleşmiş; [aynı SHA’nın main CI’ı](https://github.com/SXQHex/FtkSaaS/actions/runs/38993548576) başarılı. 22 migration, 181 test (12 sözleşme + 27 DB + 142 Auth/API); 184 operasyonun 65’i çalışan geliştirme uygulaması, 119’u yalnız sözleşme. Bu kanıt belirtilen kaynak içindir; sonraki commit’in CI sonucu ayrıca doğrulanır.

Uzak geliştirme/test Auth → Edge → RPC smoke [ayrı rapordadır](../reports/remote-backend-verification.json); 181 testin uzak projede tekrarı değildir. Geçici fixture temizlendi; ortak tenant/kullanıcı girişi sağlanmadı. Dış e-posta ertelendi; Resend entegrasyonu başlatılmayacak. Yük/restore ve frontend gerçek entegrasyon kabulü açık; production dağıtımı yok.

Q-D01 atomik kayıt/ortak hak yarışları ve fiilî başlangıç kayıt/düzeltme artık uygulanmıştır; aşağıdaki eski açık ifadeleri güncel açığa dönüştürmeyin. D01–D09, U01–U08, Q-D01, Q-E02, Q-E03 hükümleri korunur.

## Tarihsel devir ve kabul metinleri

Aşağıdaki metin önceki teslimlerden korunmuştur. “Güncel” başlıkları, eski sayılar ve kurulum/uygulama açıkları kendi tarihine aittir; bugünkü durum yukarıdaki kaynaklar ve yeni SHA’nın kanıtıyla belirlenir. Sonraki kabul yalnız çelişen hükümleri değiştirir.

> **Güncel ek: Q-E03.** Parasal iptal sınırı planlanan başlangıçtır (eşitlik dahil sonrası). Q-E02 merkez iptali korunur. Teknik durum: docs/decisions/Q-E03.md; test/CI kanıtı ayrıca doğrulanır.

# FtkSaaS —Yeni sohbet devir paketi

> **Güncel öncelik: Q-E02 · 0.2.0-rc.3.** Kullanıcının 16 Ekim 2026 son iptal kabulü önceki çelişen merkez iptali hükümlerinin yerine geçer. Güncel davranış/kanıt: docs/decisions/Q-E02.md, docs/claude-handover.md ve reports/qe02-verification.json. Aşağıdaki eski durum/test sayıları tarihsel kayıttır; teknik aktarım bekleyen işler tamamlandı sayılmaz.

> **Güncel 2.2-tech.2 / Q-D01:** Etkinlik 0/1/çok disiplin etiketini destekler. Tek etikette etkinliğe uygun dar/geniş paket, 0/çok etikette yalnız uygun geniş paket; etkinliklerde negatif kredi yok. Q-D01 ürün kararı kapalı, tam olay kayıt/RPC entegrasyonu ve son ortak kredi yarışı açık. Güncel durum 11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md.

> **Güncel teknik uygulama kaydı — 2.2-tech.1, 15 Ekim 2026:** D01–D09/U01–U08, 04–08 kataloglarına ve ortak tiplere aktarıldı. İki migration izole geliştirme DB’sinde uygulandı. Aşağıdaki eski “kod/kurulum yapılmadı” ve “teknik aktarım bekliyor” ifadeleri tarihsel kayıt olarak okunur. İş RPC’leri, ayrıntılı izin RLS politikaları ve gerçek iş akışı kabul testleri açık; Q-D01 yeni ürün kararı bekliyor. Güncel durum 09 teknik aktarım raporundadır.

> Güncel UUID üretim standardı: U01–U08, UUIDv7. Sağlayıcı kimlikleri korunur.

> Güncel ek: D01–D09 disiplin revizyonu kabul edilmiştir; aşağıdaki tarihsel teknik tamamlanma ifadeleri yeni kapsamı içermez. Ayrıntı ve açık teknik aktarım listesi belgenin sonundadır.

15 Ekim2026 · v3.0 · Karar turu ve yazılı teknik sözleşme tamamlandı; kod/üretim uygulanmadı.

## Kaynaklar ve sıra

Kullanıcının son açık kararı üstündür.01 ürün kapsamı,02 kabul edilmiş iş/teknik davranışı,03 çalışma yetkisi,04–08 teknik sözleşme ve doğrulama envanteridir. Eski sohbete/eski studioSaaS’a ihtiyaç yoktur. Alt belgeler üst kabulü sessiz değiştiremez. Fiyat/limit bilinmiyorsa değer uydurulmaz.

| Dosya | Sürüm / rol |
|---|---|
|01-FtkSaaS-urun-kapsam-sozlesmesi.md |2.0;14 modül/33 özellik ve plan dağılımı, son ürün kararları |
|02-FtkSaaS-teknik-sozlesme.md |2.0;T01–T12 ve O1–O4 iş kararları;23 son düzeltmeler |
|03-FtkSaaS-kodlama-sorumluluklari.md |1.0;ChatGPT backend, Claude frontend; branch/PR/merge/üretim yetkileri |
|04-FtkSaaS-O4-veri-semasi.md |1.0;85 tablo tasarımı, alan/FK/kısıt/indeks/kilit/RLS hedefleri |
|05-FtkSaaS-O4-API-katalogu.md |1.0;174 operasyonun insan okunur indeksi/atomiklik/guardlar |
|06-FtkSaaS-O4-durum-hata-izin.md |1.0;durum, alan/rol ve sabit hata sözlüğü |
|07-FtkSaaS-O4-denetim-ve-aciklar.md |1.0;K bulguları kapanışı,31 belge/tip kontrolü,55 uygulanacak kabul senaryosu |
|08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json |1.0;665 kapalı tip/şema,operation→request/response/error/permission/transition/transaction/guard/senaryo eşlemesi |

## Değişmez yön

FtkSaaS bağımsız yeni proje; eski studioSaaS repository/tablo/kod/kural/garantileri incelenmez, devralınmaz, karşılaştırılmaz, yamalanmaz. Supabase başlangıç Free hedefi; ortak multi-frontend backend, ilk istemci mobil web/PWA. RPC iş kuralları, Edge dış servis/gizli işler, her RPC’ye Edge zorunluluğu yok. Tek yeni repository; adres/framework/hosting henüz seçilmedi.

Frontend ekran/görsel/kullanıcı akışı/kod Claude; ChatGPT frontend’e müdahale etmez. Backend/sözleşme/izin/veri/RPC/Edge/test ChatGPT. Ortak tipler08’den üretilecek; mock gerçek entegrasyon değildir. Modeller ayrı branch/PR. Kod görevi verilince kendi alanında çalışabilir; somut merge/üretim kullanıcı onayı, destructive üretim ayrıca kapsamlı onay gerektirir. Mevcut belgelerin hazırlanması kodlama emri değildir.

## Son kararlarda kaçırılmaması gerekenler

- Hesap orglar arası ortak, kişi orga ait; e-posta identity değildir. Hesapsız kişi/görev/öğrenci kaydı işletilir. Mevcut kişiye hesap erişimi gönderilir, yeni org daveti ayrı özellik diye icat edilmez. İlk bağ student-self; privileged login grant ancak sonra. Offline görev otomatik login grant olmaz.
- Owner yalnız FtkSaaS atar/kaldırır. Owner CM değilse invite/tahsilat/rezervasyon yapamaz; merkez kurar/self-CM atar, sonra operasyon. Diğer CM atayıp öz CM rolünü owner yetkisiyle kaldırır. Müşteri owner devredemez. Org-manager eski self-center atama hakkı ve owner’ın org-manager yönetimi korunur.
- İlk ödeme doğrulaması dönem+operasyon başı; ödeme öncesi kuruluş/ödeme/center+self-CM, trial/ilk-payment grace yok. Yenileme gecikmesi ilk7gün matris, sonra bütün hizmet kapalı/owner subscription. Downgrade dönem sonu/veri korunur; Business merkez seçimi zorunlu.
- Bu tarihsel kaynakta reservation atomik yer+hak ve nominal esnek/offer–maximum priority idi. 25 Ekim kabulü bu farklı tavanı kaldırır; güncel ürün tek toplam/kategori ve fiziksel oda sınırıdır, PR45 uygulama adayı ayrıdır. Allocation consume değil; taslak attendance consume etmez; close atomik hak+earning+outbox. Assistant-participant iki yönlü conflict.
- Negative izinli limit reserved+consumed ortak, kişisel override default yerine/mandatory upper. Başlangıç limit aşımı blocked, bu katılımdan yüzde/kişi earning yok; geç ödeme geçmişi değiştirmez. Gerçekleşen seans sabiti korunur; gerçekleşmeyen özel seans0. Kaynak satışsız izinli negative için merkez değeri reservation snapshot; yeni sale eski earning’i değiştirmez veya ek nakit borcu doğurmaz.
- Satış start/end tarihleri açık girilir, center00:00 snapshot→UTC, start dahil/end hariç. End son kullanım günü değildir; takvim aylık ürün/satış bitişi otomatik ay kaydırma yok. Quota week/month başlangıç çıpalı, son kısa dönem tam, carryyok.
- Business ortak hakta satış/para satış merkezinde, hizmet/earning hizmet merkezinde; rapor transfer/merkezler arası borç yaratmaz. Fiilî instructor ve açık agreement, timed için otomatik person-fee yok. Trial bedelsiz kişi/yüzdeye girmez. Event aktif öğrenci/limit istisnası değil, harici venue olabilir.
- Event duty I/A mark, CM full-results close; hak etkisi event kayıt koşulundan, sabit duty fee ayrı gerçekleşme+CM verify. Org belge/CRM configuration O/OM, yerel CM, automation execution ayrıca center operation yetkisi.
- Para borcu/credit ayrı, fazla tahsilat alacak. Offset cash değil. İade önce aynı satış borç indirimi, sonra alacak; cash refund ayrı. Append-only linked düzeltme, hukuki imha bundan ayrı.
- Hesap silme/org kapama/yenilememe/kalıcı silme ayrı. Kalıcı silmede yeni abonelik eski dataya bağlanamaz; minimal hukuki arşiv uygulamadan ayrı. Backup restore imha listesini uygulamadan veri açamaz.

## Tamamlanan ve açık kalan

Yazılı iş kararı turu kapandı; O4 yazılı kataloglar tamamlandı.31 belge/tip kontrolü geçti; bunlar gerçek backend/RLS/Auth/yük/restore testi değil.08 JSON standardı için yerel kullanılan alt-küme kontrolleri yapıldı, harici tam dialect validator iddiası yok.

Açık kapılar: kullanıcının hukuk uzmanı saklama teyidi; ticari fiyat/limit ve gerekli politika değerleri; repository/CI/ortam/provider/secrets kurulumu; kod/migration ve gerçek kabul/yarış/yük/restore testleri; ücretli üretim RPO/RTO değerlendirmesi ve somut deployment onayı. Pilot RPO24h/RTOtespitten8h/günlükDB+dosya/30gün/aylıkrestore hedef, SLA değil. Sayısal kurulum eksiği tüm yazılı modelin yeniden tartışılması değildir.

Yeni sohbet başlangıcı:

>00–08 güncel belgelerini oku.02 bölüm23 son kararlar esastır: owner yalnız FtkSaaS, hesabı bağlamadan ayrıcalık yok, tüm hak tarihleri center00:00, negative katılım başlangıç kapısı/late-payment no retro earning. Eski studioSaaS’a başvurma ve frontend tasarımına karışma. Yazılı sözleşme tamam; yeni iş kararı icat etme. Kullanıcının sonraki somut görevine göre08 manifestini ve55 kabul senaryosunu kullan. Kodlama/merge/üretim izni verilmiş gibi davranma. Hukuki/config/üretim doğrulama kapılarını açık göster.

3.0 —15 Ekim2026: Son kararlar ve O4 yazılı v1.0 tamamlandı; eski çok-rol-davet/owner-transfer/otomatik ay bitişi önerileri kaldırıldı. Yalnız belge teslimidir.

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

**Teknik aktarım durumu:** Ürün kararı kabul edildi; kaynak karar sohbetinde kurulum, fiziksel tablo/API dönüşümü veya kodlama yapılmamıştı. Kaynak v2.2 katalogları o tarihte bu revizyonu bütünüyle temsil etmiyordu; güncel aktarım 09 raporundadır. Disiplin kimlikleri/merkez ilişkileri, öğrenci-eğitmen disiplin ilişkileri, paket kapsam tipleri, kredi açığı anahtarı, işlem izinleri ve ortak tiplerin dönüşümü ayrı teknik sohbette tamamlanıp doğrulanacaktır. Önceki 31 kontrol ve 55 senaryo bu yeni revizyonun geçtiği testler değildir. Disiplin revizyonu için O4 teknik katalog kapanışı yeniden açıktır.

Yeni sohbet talimatı: Önce D01–D09 revizyonunu oku. Eski “yazılı kataloglar tamamlandı” ifadelerini 2.1 için kullanma. Kabul edilmiş davranışı teknik kataloglara aktar; yeni ürün kararı icat etme. Bu kabul kodlama/kurulum/dağıtım yetkisi değildir.

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

**Durum:** Belge ve makine sözleşmesine üretim politikası işlendi. Ortam/üretici seçimi, alan bazlı ortak tip aktarımı, migration ve gerçek üretim/yarış testleri ayrı teknik sohbette yapılacaktır. Kodlama, kurulum veya dağıtım yapılmadı.


## Güncel backend devamı — 0.2.0-rc.2

Q-E01 kabul belgesi ana ürün/teknik sözleşmeye, fiziksel şema/API/ortak tiplere aktarıldı. Hazırlık kontenjan tutmaz; güncel borca bağlı tahsilatla kesin kayıt veya capacity_closed finansal düzeltmesi uygulanır. Gerçek kabulün yetkili güncel kaydı reports/qe01-verification.json, entegrasyon notu docs/claude-handover.md. 53 çağrılabilir işlem ve 129 yalnız sözleşme; üretim veya bütün ürün tamamlandı sayılmaz. Eski raporlar tarihsel snapshot olarak kalır.

## Q-E02 — 16 Ekim 2026 son kabul (önceki çelişen hükümlerin yerine)

**E02-01.** Katılımcının başlama sonrası kendi kaydını iptali/ayrılması parasal iade, borç indirimi veya öğrenci alacağı üretmez. Mevcut paket iptal koşulları aynen korunur.

**E02-02.** Merkez iptali her aşamada etkinliğe bağlı ücret yükümlülüğünü tamamen kaldırır; kalan borç sıfır, tahsilatın daha önce alacaklaştırılmamış tamamı öğrenci alacağıdır. Nakit iade/mahsup ayrı açık yetkili işlem; otomatik nakit çıkışı yok.

**E02-03.** Merkez iptali tüm ayrılmış hakları serbest bırakır, tüketilmiş hakları previous_id bağlı ters hareketle tamamen geri verir; kısmi tüketim ve paket hakkı için parasal alacak yok.

**E02-04.** Önceki alacak/iade/mahsup/hak dönüşü tekrar üretilmez. Yalnız iptal edilen etkinliğe bağlı kayıtlar; başka borç/geçmiş değişmez. Önizleme+apply sürüm/finans bağımlılıkları, canlı yetki ve tek transaction audit/outbox/receipt ile korunur.

**E02-05.** Fiilî başlangıç/kısmi gerçekleşme ayrı alan veya durum olarak tanımlı değildir; saat geçmesi tek başına gerçekleşme değildir. Bu tanım karar konusu olarak açık. Merkez iptalinin aşamadan bağımsız sonucu bu tanıma ihtiyaç duymaz; mevcut occurred/attendance evidence korunur.

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

</details>


</details>
