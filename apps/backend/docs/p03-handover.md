> Alan devri: teknik tüketim ve kaynağına bağlı eski kabul kayıtları. Güncel kaynak/CI/hosted durum [00 devirde](00-FtkSaaS-yeni-sohbet-devir.md), açık iş [tek backlog’da](../../../docs/remaining-work.md) tutulur. Eski aday/pending ifadeleri yeni görev veya güncel durum değildir.

# P03 finans ve eğitmen ödemeleri devri

Tarihsel geliştirme notudur. P03 PR30/main10710ffa90747a7e35c452c4c07ba59522f50ce3 ve aday39527260056/main39529992556 başarılarıyla kapandı; güncel P04 ve CD durumu source-index.md ile p04-handover.md içindedir. Aşağıdaki Draft/pending ifadeleri o geliştirme snapshot’ını anlatır.

P03, [PR #30](https://github.com/SXQHex/FtkSaaS/pull/30) ve `feature/p03-finance-payments` dalında geliştirilir. Başlangıç main `ce95a9d0d960a201b0488071802dc5db7741caf1`; P02'nin kabulü yeni kaynak için kabul değildir. Üretim kaynağı [kuyruk](../../../docs/production-queue.md).

## Uygulanan kapsam

Yedi API: `finance_get_v1`, `collection_correct_preview_v1`, `collection_correct_apply_v1`, `sale_refund_preview_v1`, `sale_refund_apply_v1`, `instructor_payment_record_v1`, `instructor_payment_correct_v1`. Dal envanteri199 sözleşme/140 runtime/59 contract_only,90 core tablo; P04–P07 açık kalır.

- Finans okuması kişi/merkez/para birimi ve aktör kapsamına bağlı sayfalama kullanır. Tam geçmiş self, org reader veya ilgili CM içindir; finance.collect personel grantı tam finans geçmişi vermez.
- Tahsilat düzeltmesinde tutar yeni toplam değil, yönlü farktır. Önizleme kaynak, yetki, borç ve alacak bağımlılıklarını dondurur. Uygulama nakit ve dağıtımları bağlı hareketle değiştirir; harcanmış alacak silinemez ve rezervasyon kendiliğinden iptal edilmez.
- Borç kalanı `max(0,net−gross_paid+claimed)`: alacağa taşınmış brüt ödeme ikinci kez borç ödemesi sayılmaz. Bağlı alacak geri alma, ilgili dağıtım azalışını aşmaz.
- Ters debt/earning allocation negatif SignedMoney kullanır; API bakiye toplamları nonnegative Money kalır. Her ters tahsis pozitif kaynak satırının açık kalanına kadar bölünür ve previous_id o kaynağı gösterir.
- Paket iadesi satışta sabit yöntemle borç indirimi ve ayrı öğrenci alacağı üretir. Nakit/hak/rezervasyon işlemi değildir. Refund Mutation/audit/receipt gerçek satış ID’sini ve değişmemiş satış sürümünü taşır; private immutable refund fact audit içindeki ayrı refund_fact_id ile izlenir. Immutable P02 hesaplaşması veya P03 iadesi ikinci kez üretilmez; hesaplanan teklif hash'i tarih sınırında da stale kontrolüne bağlıdır.
- Eğitmen ödemesi seçili özgün hakedişlerin düzeltmeler dahil net kalanına dağıtılır. Kısmi ödeme, aggregate version, bağlı düzeltme ve fazla ödeme okunur. Eski ödeme/hakediş silinmez; öğrenci nakdi ayrı kalır. Correction Mutation kök payment ID/version döndürür, yeni immutable fact related içindedir.

## Kaynak ve doğrulama

P03 migration41–49 append-only: finance-payments, guardrails, acceptance, scope, balances, results, integrity, provenance, refund-identity. Önceki migration içerikleri dondurulmuştur; manifest ve source+wrapper eşitlik denetimleri korunur. Makine sözleşmesi, tipler, validator/bundle, katalog/envanter ve etkilenen F01–F33 runtime izi aynı PR'de üretilir. Feature kabulü otomatik tamamlandı sayılmaz.

Geliştirme kabul kaynağı `d3d5ae65d4ed226573cfb7e163cf2be8e0500c5a`; base `ce95a9d0d960a201b0488071802dc5db7741caf1`. [Hedefli39522543011](https://github.com/SXQHex/FtkSaaS/actions/runs/39522543011) completed/success,32:41 run elapsed:96 yapı +37 politika +27 DB +316 API düğümü; tüm15 API suite’i, sıfır fail/skipped. Öncelikli event-payment/instructor-earnings46 düğüm6:13.468, kalan13 suite270 düğüm25:17.243. Aynı kaynağın [workbench39522543060](https://github.com/SXQHex/FtkSaaS/actions/runs/39522543060) completed/success: P03 yeni7 düğüm, bağımlı73 düğüm ve temiz49 migration kurulumu; bunlar aynı hedefli kabuldeki testlerin ek tekrarlarıdır, benzersiz test sayısına eklenmez.

Önceki39494418030 /38af062 kaynağında yeni P03 testleri geçti; bağımlı regresyon73 düğümde60 pass/13 fail olmuştu. Eğitmen fixture’ı planlı aralığı now−1s → now+59m yapınca23:52 TSİ aralığı gece yarısını aşmış, assert_availability doğru olarak reddetmişti. Yardımcı artık planlı saatleri değiştirmeden mevcut attendance_start_v1 ile açık sentetik başlangıç kaydediyor; planlı saatlerin korunması assert ediliyor. Son başarılı hedefli koşu bu düzeltmeyi doğruladı. Runtime/uygunluk kapısı, parasal beklentiler ve testlerin çalıştırılması gevşetilmedi.

Başlangıç kaydı olmadan ücretli kapanış, cross-center-settlement suite’inin DS-SET gerçek tüketim testlerinde ayrıca korunur:75 eğitmen hakedişi,250 A→B payı, hak tüketimi ve receipt tekrarında mükerrerlik olmaması son hedefli koşuda geçti. Son aday hazırlığında bu helper’a başlangıç alanının null kaldığı, ilk ücretli kapanıştan sonra da kaydın null olduğu assertion’ları eklendi; bu yeni assertion’ların CI kabulü bekliyor. Yeni test atlanmadı, beklenen tutarlar değiştirilmedi.

Geçici `.github/p03-bootstrap.py` ve `.github/workflows/p03-workbench.yml` kaldırıldı; `.github/p03-diagnose.mjs` zaten kaynakta yoktur. Generation standart pnpm run generate yoluyla sürer. Trusted workflow/scripts/ci/clean-start blob ve mode kümesi main ile eşit olmalıdır; herhangi bir CI politika kurulumu veya kapı istisnası istenmez. Yerel yapısal kontrol ve son kaynak hedefli kabulü bu temizlik farkına ayrıca uygulanır. Yeni aday/main clean ve hosted eşitlemesi henüz yapılmadı.

## Açık kabul sırası

1. Son temizlik ve açık legacy-kapanış assertion’larını hedefli CI’da doğrula; önceki başarılı kaynağı yeni head kabulü sayma.
2. Yaşayan belgeler/kuyruk eşitlendi ve geçici araçlar kaldırıldı; yeni kaynak doğrulamasını kaydet.
3. Son head bağımsız incelemesi ve main policy eşitliğini doğrula.
4. Draft/development temizlendikten sonra açık ci:full-clean isteğiyle tek son aday tam kapsamını çalıştır; başlayınca kullanıcıya devret.
5. Başarılı kaynak bağlı adaydan sonra koşullu normal merge; aynı main full clean başlayınca yeniden kullanıcıya devret.
6. Aynı main kabulünden sonra geliştirme/test Supabase migration/Edge eşleşmesi ve ayrı uzak smoke; ardından P03 kapanışı. Production, frontend ve Resend kapsam dışıdır.
