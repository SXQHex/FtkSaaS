# FtkSaaS kaynak indeksi

21 Ekim CD görevi: mevcut Supabase projesinin platformdaki production branch’i doğrudan geliştirme/test hedefidir; ayrı ücretli preview projesi gerekmez. Kullanıcının bu proje için doğrudan dağıtım yetkisi vardır; gerçek müşteri production kabulü verilmez. CD-01 ayrı altyapı PR’sında hazırlanıyor; aynı main full kabulü → migration/Edge → uzak smoke/cleanup zinciri henüz etkin ve canlı doğrulanmış sayılmaz. P04, CD kapanışından sonra sıradadır.

P03 **done**: [PR #30](https://github.com/SXQHex/FtkSaaS/pull/30), kabul edilmiş main `10710ffa90747a7e35c452c4c07ba59522f50ce3`. Son head2526347 / basece95a9d / tested merge1768fc2 / tree9ac328b aynı kaynak zinciridir. Bağımsız kaynak incelemesi PR review5594023911 içinde kayıtlı; [aday39527260056](https://github.com/SXQHex/FtkSaaS/actions/runs/39527260056) ve [aynı main39529992556](https://github.com/SXQHex/FtkSaaS/actions/runs/39529992556) completed/success.96 yapı +37 CI politika +27 DB +316 API =476 test düğümü; fail/skipped0,49 migration. Main13:18; aday13:34. Envanter199 sözleşme/140 runtime/59 contract_only,90 core tablo. Geliştirme/test Supabase aynı49 migration/Edge3 kaynağına eşitlendi; ayrı dokuz kontrollü Auth→Edge→RPC smoke ve fixture temizliği başarılı. P04 queued, başlamadı.

P02 **done**: [PR #28](https://github.com/SXQHex/FtkSaaS/pull/28), kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167`. Envanter **199 sözleşme / 133 runtime / 66 contract_only / 40 migration / 90 core tablo**. Son head `35816cc30a9b28e273e94e6cef86e8b402dbaad0` bağımsız incelemeden geçti; [hedefli39448566998](https://github.com/SXQHex/FtkSaaS/actions/runs/39448566998), [aday39455462417](https://github.com/SXQHex/FtkSaaS/actions/runs/39455462417) ve [aynı main39461804543](https://github.com/SXQHex/FtkSaaS/actions/runs/39461804543) completed/success. Full kapsam:96 sözleşme/yönetişim +37 CI politika +27 DB +309 API =469 test düğümü; fail/skipped0. Core, dört izole API shard, toplayıcı,40 migration, seed/health/advisors geçti. Main clean14:43; önceki43:33 hedefli koşu seri tüm-suite fallback kullandı, aynı çalışma profili değildir. Eski başarı yeni kaynağa taşınmaz.

Geliştirme/test Supabase `gwyprhenabtpkbojephw`, kabul edilmiş main `10710ffa90747a7e35c452c4c07ba59522f50ce3` kaynağına eşitlendi:49 migration, Edge backend-v1 sürüm3, verify_jwt=true,140 runtime API. Uzak smoke ve geçici fixture temizliği başarılı; ayrıntılar docs/remote-backend-setup.md içindedir. Hosted worker zamanlayıcısı, ortak tenant/kullanıcı kurulumu, frontend gerçek entegrasyonu, yük/restore, dış e-posta ve production kabulü ayrı açık kalır.

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
| 10 | [Endpoint envanteri](endpoint-inventory.json), [runtime listesi](../supabase/functions/backend-v1/implemented.json) | Main:199 işlem/140 çağrılabilir/59 contract_only; son kaynak kabulü yukarıdadır |

## Kabul edilmiş kararlar

Son açık kullanıcı kararı üstündür; sonraki kabul yalnız çelişen hükümleri değiştirir. D01–D09 ve U01–U08 [02 sözleşmesindedir](../contracts/02-FtkSaaS-teknik-sozlesme.md). [Q-D01](../contracts/10-FtkSaaS-Q-D01-kabul-karari.md) etkinlik etiket/paket matrisi ve negatif kredi yasağıdır. [Q-E01 kabulü](decisions/Q-E01-accepted.md) ve [aktarımı](decisions/Q-E01.md) ödeme hazırlığıdır. [Q-E02](decisions/Q-E02.md) merkez iptalinin tam para/hak sonucu; [Q-E03](decisions/Q-E03.md) planlanan başlangıca göre katılımcı parasal sınırıdır. [Fiilî başlangıç devri](actual-start-handover.md) mevcut operasyonel kaydı açıklar; eski kararların “başlangıç API’si yok” durum notu güncel uygulama açığı değildir. Kısmi gerçekleşme için yeni oran/para/hak kuralı türetilmez.

## Kanıtlar ve tarihsel kayıtlar

[Uzak backend kurulumu](remote-backend-setup.md) güncel49 migration/Edge3 smoke kanıtını taşır; [eski smoke raporu](../reports/remote-backend-verification.json)22 migration/65 API snapshot’ıdır. Güncel uzak smoke476 testlik CI’ın tekrarı değildir. Geliştirici beyanı, repository raporu ve bağımsız CI sonucu farklı kanıt türleridir. Tam kaynak SHA’sı ve test kapsamı birlikte okunur.

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

