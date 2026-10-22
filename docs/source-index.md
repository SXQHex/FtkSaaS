# FtkSaaS kaynak indeksi

22 Ekim güncel durum: OPS-W01 PR39, `d1830c89e3d5e7f3c90db7ef0953cc264b35205f` ile main’e birleşti. Aday39795678387 attempt5 kabulü doğrulandı; aynı main [39809302120](https://github.com/SXQHex/FtkSaaS/actions/runs/39809302120) başarısızdır. Kullanıcının son talimatıyla bu SHA için yeniden çalıştırma **açık iş** tutulur, şimdi tetiklenmez; main/CD ve hosted worker kabulü kapanmadı. Son kabul edilmiş hosted kaynak P06 `006ad36918ae823bc10fbdefa2d48901e193121c`,54 migration/Edge7 olarak kalır. P07-A Draft PR40 geliştirmesi sürer: **200 sözleşme/186 geliştirme runtime/14 contract_only/57 migration/90 core tablo**. Sekiz A işleminin kaynağı uygulandı; gerçek Auth→Edge/aday/main kabulü bekler. B6 ve C8 queued. Full clean/merge şimdi tetiklenmez; kapılar gevşetilmez. [P07-A devri](p07-a-handover.md).

P05 **done (kod, main ve geliştirme/test kabulü)**: [PR37](https://github.com/SXQHex/FtkSaaS/pull/37), kabul edilmiş main `83641447b29e459236aea1a9a4379b5d19825af6`;200 sözleşme/165 runtime/35 contract_only,53 migration/90 core tablo. Son head15e2126/base16cb570/tested merge2ebe087/tree736a75b; bağımsız son kaynak incelemesi5611074233, [aday39745672815](https://github.com/SXQHex/FtkSaaS/actions/runs/39745672815) ve [aynı main39748053581](https://github.com/SXQHex/FtkSaaS/actions/runs/39748053581) completed/success. [CD39750264949 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39750264949) success:18 kontrol,53/53 içerik eşleşmesi, P05 migration uygulandı, Edge6 ACTIVE/verify_jwt=true, RLS kapalı0/client RPC EXECUTE0 ve sentetik fixture temizliği. Receipt artifact12412499512 SHA256 `a41a8448c0a1b9dfdf853b58bea7cd56525fd8ede14812684b12619c3c8ee04e`. Eski aday hata kayıtları tarihsel kanıttır; bu kabulün kaynağı değildir.

P06 **done (kod, main ve geliştirme/test kabulü)**: [PR38](https://github.com/SXQHex/FtkSaaS/pull/38), main `006ad36918ae823bc10fbdefa2d48901e193121c`;200 sözleşme/178 runtime/22 contract_only,54 migration/90 core tablo. Son headf2f9d6c/base8364144/tested merge1901fc6/treeb486ffe; bağımsız review5614150102, [aday39779013518](https://github.com/SXQHex/FtkSaaS/actions/runs/39779013518), [aynı main39782197422](https://github.com/SXQHex/FtkSaaS/actions/runs/39782197422) ve [CD39785146645 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39785146645) success. CD18 kontrol/54 içerik eşleşmesi/Edge7 ACTIVE/verify_jwt=true/RLS kapalı0/client RPC EXECUTE0 ve fixture temizliği geçti; receipt12428881259 SHA256 `bcd1ab3255c1808982de76c3d09d47d5eaa95c5fb2e8f9f870d3fedc9ce93b65`. Önceki aday hataları tarihsel kanıttır. OPS-W01 PR39 main’e birleşti; aynı main clean başarısız, retry/CD/hosted kabulü açıktır. P07-A Draft geliştirmesi son kullanıcı talimatıyla sürer; tenant config/binding uydurulmaz.

PR36 operasyonel takip kapandı: aynı main [39644044693](https://github.com/SXQHex/FtkSaaS/actions/runs/39644044693) success; [CD39646391222](https://github.com/SXQHex/FtkSaaS/actions/runs/39646391222) success,18 kontrol,52/52 migration, pending[], Edge5 değişmeden ACTIVE/verify_jwt=true. Atomik Management API transport yeni migration olmadan da rollback probe ile doğrulandı. Bot/deneme hedefi hâlâ kullanıcı kararıyla ertelendi; hosted P05 worker kurulmuş değildir.

P04 **done (kod ve kaynak kabulü)**: [PR35](https://github.com/SXQHex/FtkSaaS/pull/35), kabul edilmiş main `7b96d8866abb2c056d1b59a96afee0696a1187d6`;199 sözleşme/151 runtime/48 contract_only,52 migration/90 core tablo. Son head55c23dd, base920cdbb, tested merge901c64a, treee2011a6 kaynak zinciri; bağımsız son kaynak incelemesi ve [aday39630534660](https://github.com/SXQHex/FtkSaaS/actions/runs/39630534660) ile [aynı main39633243405](https://github.com/SXQHex/FtkSaaS/actions/runs/39633243405) completed/success doğrulandı. [CD39635569033 attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39635569033/attempts/2) success:52/52 içerik eşleşmesi, Edge5 ACTIVE/verify_jwt=true,17 kontrol ve sentetik fixture temizliği. İlk CD'deki CLI migration hatası aşağıdaki operasyonel takipten ayrıdır; ikinci denemede eksik migration kalmadığı için o yol sınanmadı.

21 Ekim bot/deneme hedefi kararı sürer: alan adı/tenant/ürün/süre/tekrar limiti uydurulmaz. PR36 transport kapanışı ve yeni P05 kabul sınırı yukarıdadır; eski P04/CD-01 metinleri yeni kaynağa başarı taşımaz.

CD-01 **done**: PR32 kurulum + PR33 test fixture düzeltmesi sonrası kabul edilmiş main `0fabf3a4a605dd6be5a1d358c660021f59406e20`. [Main39588975421](https://github.com/SXQHex/FtkSaaS/actions/runs/39588975421) ve [ilk canlı CD39590690817/attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/2) completed/success. CD receipt aynı source/main/run kabulünü bağlar;17 kontrol başarılı,49 migration içerik eşleşmesi,90 core tablo/RLS, anon/authenticated EXECUTE0, Edge backend-v1 v4 ACTIVE/verify_jwt=true. Gerçek Auth→Edge→RPC, oturum reddi ve fixture temizliği geçti; ayrıca uzak son0 hesap/0 Auth kullanıcısı/0 organizasyon doğrulandı. Envanter199/140 runtime/59 contract_only değişmedi. P04 CRM/public başvuru queued; başlamadı. Hosted worker işletimi, frontend, dış e-posta ve yük/restore bu kapanışla tamamlanmaz.

P03 **done**: [PR #30](https://github.com/SXQHex/FtkSaaS/pull/30), kabul edilmiş main `10710ffa90747a7e35c452c4c07ba59522f50ce3`. Son head2526347 / basece95a9d / tested merge1768fc2 / tree9ac328b aynı kaynak zinciridir. Bağımsız kaynak incelemesi PR review5594023911 içinde kayıtlı; [aday39527260056](https://github.com/SXQHex/FtkSaaS/actions/runs/39527260056) ve [aynı main39529992556](https://github.com/SXQHex/FtkSaaS/actions/runs/39529992556) completed/success.96 yapı +37 CI politika +27 DB +316 API =476 test düğümü; fail/skipped0,49 migration. Main13:18; aday13:34. Envanter199 sözleşme/140 runtime/59 contract_only,90 core tablo. Geliştirme/test Supabase aynı49 migration/Edge3 kaynağına eşitlendi; ayrı dokuz kontrollü Auth→Edge→RPC smoke ve fixture temizliği başarılı. P04 queued, başlamadı.

P02 **done**: [PR #28](https://github.com/SXQHex/FtkSaaS/pull/28), kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167`. Envanter **199 sözleşme / 133 runtime / 66 contract_only / 40 migration / 90 core tablo**. Son head `35816cc30a9b28e273e94e6cef86e8b402dbaad0` bağımsız incelemeden geçti; [hedefli39448566998](https://github.com/SXQHex/FtkSaaS/actions/runs/39448566998), [aday39455462417](https://github.com/SXQHex/FtkSaaS/actions/runs/39455462417) ve [aynı main39461804543](https://github.com/SXQHex/FtkSaaS/actions/runs/39461804543) completed/success. Full kapsam:96 sözleşme/yönetişim +37 CI politika +27 DB +309 API =469 test düğümü; fail/skipped0. Core, dört izole API shard, toplayıcı,40 migration, seed/health/advisors geçti. Main clean14:43; önceki43:33 hedefli koşu seri tüm-suite fallback kullandı, aynı çalışma profili değildir. Eski başarı yeni kaynağa taşınmaz.

Geliştirme/test Supabase `gwyprhenabtpkbojephw`, kabul edilmiş main `006ad36918ae823bc10fbdefa2d48901e193121c` kaynağına CD39785146645 ile eşitlendi:54 migration/Edge7/178 runtime,18 kontrol ve fixture temizliği. OPS-W01 native worker kaynağı55 migration taşır; kaynak ve hosted kabulü henüz beklenir. Frontend/dış e-posta/yük/restore ayrı kalır.

Repository’nin güncel dalı `main`dir. Başlarken GitHub main SHA’sını ve aynı SHA’nın CI’ını doğrulayın; bu dosyalardaki son doğrulanmış snapshot yeni commit’e otomatik başarı vermez. Yerel/ZIP kopyaları alındıkları SHA’nın snapshot’ıdır. İkinci belge ağacı kullanılmaz.

Güncel uygulama SHA/CI ve teslim durumu için [tek devir özeti](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) esas alınır. Önceki teslim sayıları tarihsel bağlamdır.

[P03 çalışma devri](p03-handover.md) PR30 geliştirme snapshot’ıdır: içindeki Draft/pending, hedefli/aday/main/hosted henüz yapılmadı ifadeleri o kaynak anına aittir. Yukarıdaki doğrulanmış P03 kapanışı ve [güncel uzak kurulum](remote-backend-setup.md) bu durum notlarının yerine geçer. Bu dosya mevcut yalnız-belge izin listesinde olmadığı için sırf durum eşitlemesiyle yeni full clean döngüsü oluşturulmadı; sonraki doğal uygulama/generation commit’inde eşitlenir.

## Okuma sırası ve roller

| Sıra | Kaynak | Rol |
|---|---|---|
| 1 | [AGENTS.md](../AGENTS.md) | Tüm ajanların başlangıç, alan, kanıt ve iş kapanış kuralları |
| 2 | [00 güncel devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) | Kısa doğrulanmış başlangıç ve tarihsel metin sınırı |
| 3 | [Kalan işler](remaining-work.md) | Yalnız sözleşme işlemleri ve operasyonel kabul açıkları |
| 4 | [Claude devri](claude-handover.md) | Gerçek bağlantı, istekler, mevcut uygulama sınırları |
| 5 | [01 ürün kapsamı](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) | Ürün kapsamı; eski teknik durum sayıları tarihsel |
| 6 | [02 teknik sözleşme](../contracts/02-FtkSaaS-teknik-sozlesme.md) | Kabul edilmiş davranış; D01–D09 ve U01–U08 değişiklikleri |
| 7 | [03 sorumluluklar](../contracts/03-FtkSaaS-kodlama-sorumluluklari.md) | Backend/frontend alan sahipliği; güncel çalışma düzeni kök AGENTS’ta |
| 8 | [04 şema](../contracts/04-FtkSaaS-O4-veri-semasi.md), [05 API](../contracts/05-FtkSaaS-O4-API-katalogu.md), [06 durum/hata/izin](../contracts/06-FtkSaaS-O4-durum-hata-izin.md) | Fiziksel/API sözlükleri; kesin DDL supabase/migrations, işlem tipleri 08 |
| 9 | [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) | Tipler, işlem/izin/guard ve implementation_status; katalog varlığı runtime kabulü değildir |
| 10 | [Endpoint envanteri](endpoint-inventory.json), [runtime listesi](../supabase/functions/backend-v1/implemented.json) | Kabul edilmiş P06 main200/178/22 ve54 migration; OPS-W01 kaynağı55 migration, aynı API sayısı, kaynak/hosted kabulü beklenir |

## Kabul edilmiş kararlar

Son açık kullanıcı kararı üstündür; sonraki kabul yalnız çelişen hükümleri değiştirir. D01–D09 ve U01–U08 [02 sözleşmesindedir](../contracts/02-FtkSaaS-teknik-sozlesme.md). [Q-D01](../contracts/10-FtkSaaS-Q-D01-kabul-karari.md) etkinlik etiket/paket matrisi ve negatif kredi yasağıdır. [Q-E01 kabulü](decisions/Q-E01-accepted.md) ve [aktarımı](decisions/Q-E01.md) ödeme hazırlığıdır. [Q-E02](decisions/Q-E02.md) merkez iptalinin tam para/hak sonucu; [Q-E03](decisions/Q-E03.md) planlanan başlangıca göre katılımcı parasal sınırıdır. [Fiilî başlangıç devri](actual-start-handover.md) mevcut operasyonel kaydı açıklar; eski kararların “başlangıç API’si yok” durum notu güncel uygulama açığı değildir. Kısmi gerçekleşme için yeni oran/para/hak kuralı türetilmez.

## Kanıtlar ve tarihsel kayıtlar

[Uzak backend kurulumu](remote-backend-setup.md) kabul edilmiş P05 main53 migration/Edge6 ve18 kontrollü CD receipt kanıtını taşır; [eski smoke raporu](../reports/remote-backend-verification.json)22 migration/65 API snapshot’ıdır. Güncel uzak smoke476 testlik CI’ın tekrarı değildir. Geliştirici beyanı, repository raporu ve bağımsız CI sonucu farklı kanıt türleridir. Tam kaynak SHA’sı ve test kapsamı birlikte okunur.

[Oda/rol raporu](../reports/room-role-verification.json), [registry raporu](../reports/registry-verification.json), [fiilî başlangıç raporu](../reports/actual-start-verification.json), [Q-E03 raporu](../reports/qe03-verification.json), [Q-E02 raporu](../reports/qe02-verification.json), [Q-E01 raporu](../reports/qe01-verification.json) ait oldukları uygulama snapshot’larının kayıtlarıdır. Son main CI yerine kullanılmaz.

[07 denetim](../contracts/07-FtkSaaS-O4-denetim-ve-aciklar.md), [09 ilk aktarım](../contracts/09-FtkSaaS-teknik-aktarim-raporu.md), [11 Q-D01 aktarımı](../contracts/11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md) ve [eski kaynak JSON’u](../contracts/source-v2.2/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) tarihsel kanıt/tasarım kayıtlarıdır. Açıklarını güncel karar, envanter, devir ve aynı SHA’nın CI’ıyla karşılaştırmadan yeniden açmayın. reports/ tarihsel kayıtları yeniden yazılmaz.

## Kalıcı kapanış kuralı

Her uygulama PR’si etkilediği sözleşmeleri, envanteri, kalan işleri ve devri aynı PR’de günceller; etkilenmeyen belgelere dokunmaz. [AGENTS.md](../AGENTS.md) kanıt/SHA ve merge sonrası CI teslimini tanımlar. Yeni ürün kararı, teknik aktarım, uygulama ve kabul ayrı izlenir. Dış e-posta ertelendi; Resend başlatılmaz. Yük/restore ve frontend gerçek kabulü açıktır. Production dağıtımı yapılmaz.

[Uygunluk/politika kapsam raporu](../reports/availability-policy-verification.json) yeni kaynak SHA ve odaklı test kapsamını belirtir. Son PR/main temiz CI ve hosted smoke ayrı kanıtlardır.

[Takvim/seans/rezervasyon okuma devri](schedule-read-handover.md) üç işlemin görünürlük/zaman/cursor sözleşmesini ve ayrı bırakılan ürün/uygun hak seçimi bağımlılığını belirtir. [Okuma kapsam raporu](../reports/schedule-read-verification.json) kaynak ve test kanıtıdır; son head CI ayrıca denetlenir.

[Program/seans devri](program-session-handover.md) yedi yeni komutun immutable program, oluşum değişikliği, miras/override, DST, sürüm ve rezervasyon koruma sözleşmesini açıklar. [Kaynak raporu](../reports/program-session-verification.json) geliştirme kanıtıdır; son head temiz CI ayrıca denetlenir.


[DS-2026-10-17](decisions/DS-2026-10-17.md) son kabul edilmiş plan/yoklama, rezervasyon koruması, anlaşma, A→B hesaplaşma ve geçmiş satış hükümleridir. [Sprint devri](decision-sprint-handover.md) hedef sözleşme/runtime/kanıt ayrımını; [F01–F33 haritası](feature-delivery.md) ürün–teknik–bağımlılık–uygulama–kabul eşlemesini; [koruma denetimi](branch-protection-review.md) yönetici erişim sınırını belirtir. İlk DS aktarımında 184 başlangıç işlemine 13 sözleşme eklenerek toplam 197 olmuştu; bu tarihsel aktarım sayısıdır. Kabul edilmiş P03 main envanteri199/140/59; önceki P02 snapshot’ı199/133/66’dır.

[Son hesaplaşma yetki/iki taraflı akış kararı](decisions/DS-2026-10-17-settlement-revision.md) önceki OM kayıt/fallback hükümlerini değiştirir. DS-OPEN-01 karar düzeyinde kapalı; DS-OPEN-02 [son merkez bazlı yetki kararıyla](decisions/DS-2026-10-17-settlement-center-scope.md) karar düzeyinde kapalıdır. Aynı hesap ayrı A/B yetkileriyle başvuru/onay yapabilir; farklı hesap şartı ve fallback yoktur. Üç contract-only üçüncü-aşama/düzeltme uç çıkarıldı, üç authority read/set sözleşmesi eklendi; o revizyonun tarihsel toplamı 197/79/118 olarak aynı kalmıştı; güncel toplam değildir. Son revizyon raporu: reports/settlement-center-scope-verification.json; eski SHA raporu/CI yeni head kabulü değildir.

[Starter yoklama/koruma devri](starter-attendance-protection-handover.md) yeni runtime sınırını belirtir.

[Anlaşma/hakediş devri](instructor-earnings-handover.md) immutable ücret zinciri, açık fiilî başlangıç kaydı, Pro/Business kapanışı, frozen değerleme ve bağlı düzeltmeyi tanımlar. Son head/merge CI ayrıca doğrulanır; ödeme ve merkezler arası hesaplaşma ayrı teslimdir.

[Hesaplaşma devri](settlement-handover.md) dokuz API, sabit kredi dilimi, geç kaynak bağlama, ayrı A/B yetkisi ve atomik onayı tanımlar. Son kaynak kabulü PR head/merge CI ile doğrulanır.

[CI çalışma politikası](ci-policy.md): hızlı/hedefli geliştirme, açık son aday clean’i, kaynak bağlı merge kapısı ve main clean. [Performans ölçümü](ci-performance.md) eski log temeli ile yeni ölçüm alanlarını ayırır. Bu politika önceki otomatik her commit/PR clean ifadelerinin yerine geçer.

[CI-02 teknik devri](ci02-handover.md) belge kurtarma, dar renderer kanıtı, dört shard/toplayıcı, ölçüm ve güvenilir kurulum sınırını taşır.

## Aktif üretim sırası

[Sıralı üretim kuyruğu](production-queue.md) yedi teslimin API grupları, ortak üretim promptu, durum ve kapanan promptların kaldırılma kuralıdır. Her geliştirme görevinde devir/kalan işlerden sonra okunur. Full clean başlayınca ajan run/kaynak/sonraki adımı bildirip turu bitirir; kullanıcı sonucu getirene kadar polling/izleme yapmaz. Başarı kullanıcı dönüşünde GitHub kanıtıyla doğrulanır.

[P01 devri](p01-handover.md): bütün P01 PR #22 ile main’e alındı; son hedefli ve aday clean başarılı. Aynı main clean 39401570751 completed/success doğrulandı; P01 done. Hosted/production worker kabulü ayrıdır.

P01 sistem worker transport'u insan Auth dispatcher'ından bağımsız private.p01_worker_execute girişidir; aynı scope/job/lease kapıları korunur. Son düzeltmelerin kabulü ve işletim sınırları docs/p01-handover.md içindedir.


[P06 devri](p06-handover.md) sekiz raporun metriklerini, özel import/izleme güvenlik sınırlarını, yerel/rollback doğrulamasını ve bekleyen kaynak kabulünü taşır.

[OPS-W01 devri](ops-w01-handover.md), native Cron kurulum/sağlık SQL ve kaynak/hosted kabul sınırını taşır.
