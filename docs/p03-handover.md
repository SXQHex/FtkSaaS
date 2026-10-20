# P03 finans ve eğitmen ödemeleri devri

P03, [PR #30](https://github.com/SXQHex/FtkSaaS/pull/30) ve `feature/p03-finance-payments` dalında geliştirilir. Başlangıç main `ce95a9d0d960a201b0488071802dc5db7741caf1`; P02'nin kabulü yeni kaynak için kabul değildir. Üretim kaynağı [kuyruk](production-queue.md).

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

İzole geliştirme runner'ında yapısal kontroller ve temiz migration kurulumu geçti. 48 migration kaynağında P03 altı test düğümü başarılı (39493630092, priority adımı20:39:16–20:40:25); bağımlı regresyonlar son ek etkinlik senaryosuyla yeniden çalıştırılıyor. Son kaynak hedefli kabulü bekleniyor. Paket değişimi→genel iade çift alacak üretmeme senaryosu önceki ara kaynakta geçti; bu kanıt yeni son kaynağın kabulü değildir.

Yerel executor kullanılamadığı için branch'e geçici generation/test workbench'i eklendi. Son adaydan önce `.github/p03-bootstrap.py`, `.github/p03-diagnose.mjs` ve `.github/workflows/p03-workbench.yml` kaldırılmalı; final trusted policy blob/mode seti main ile birebir doğrulanmalıdır. Geçici SQL tanı aracı yalnız izole DB'de çalışır; runtime hata gizleme veya yetki kapısı değiştirilmez.

## Açık kabul sırası

1. Bütün hedefli yeni davranış ve bağımlı regresyonları geçir; somut hataları yeni migration ile düzelt.
2. Yaşayan belgeleri/kuyruğu son duruma eşitle; geçici runner araçlarını kaldır.
3. Son head bağımsız incelemesi ve main policy eşitliğini doğrula.
4. Draft/development temizlendikten sonra açık ci:full-clean isteğiyle tek son aday tam kapsamını çalıştır; başlayınca kullanıcıya devret.
5. Başarılı kaynak bağlı adaydan sonra koşullu normal merge; aynı main full clean başlayınca yeniden kullanıcıya devret.
6. Aynı main kabulünden sonra geliştirme/test Supabase migration/Edge eşleşmesi ve ayrı uzak smoke; ardından P03 kapanışı. Production, frontend ve Resend kapsam dışıdır.
