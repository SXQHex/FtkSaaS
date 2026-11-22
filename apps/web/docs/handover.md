# Web sohbet ve teslim devri

**Alan:** `apps/web` (Vite SPA). **Aktif çalışma:** [Router + Query birleşik veri yaşam döngüsü](remaining-work.md#router-query-birlesik); 1/2 aşama ayrımı kaldırıldı. **Uygulama sırası:** [production-queue.md](production-queue.md), **açık iş/kabul:** [remaining-work.md](remaining-work.md), **teknik gerekçe:** [development.md](development.md#router--query-birleşik-veri-yaşam-döngüsü). Eski uzun [todo.md](todo.md) aktif backlog değil, sabit geçmiş kaydına bağlantıdır.

## Kaynak ve kontrol noktası

- **Kod denetimi tabanı:** `main` `8a5efbb0c14ea259246ca9d07f1fb92948007557` (22 Kasım 2026). Bu SHA üzerine yapılan kod odaklı geniş tarama M01–M14 açıklarını çıkardı; rapor ve statik tarama tek başına test/geçmiş kabulü değildir.
- **Tespit edilen mevcut sağlıklı kaynak:** TanStack Router/Query tek QueryClient, shared account/workspace, tenant key ve ACK/receipt/readback komut koruması. Bunları yeniden kurma. Öncelik 5 cache/cursor doğruluğu, oturum/erişim kapsamı, ardından ağ/iptal ölçümü.
- **Main kanıtı:** [Main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/45021043713) ve [Development delivery](https://github.com/SXQHex/FtkSaaS/actions/runs/45021085083) bu tabanda başarılıdır. Bu sonuçlar henüz yazılmamış M01–M14 düzeltmelerinin kabulü değildir.
- **Belge düzenleme görevi:** `docs/web-router-query-consolidated-audit-20261122` dalında; kaynak kodu/BE runtime/test/CI eşiği değiştirilmez. Yeni PR aday CI sonucuna göre bu kayıt sonraki doğal değişimde güncellenir.
- **Dış bağımlılık:** Yalnız eksik native API varsa frontend tüketici kanıtıyla [ortak talep](../../../docs/requests.md) açılır; backend dokümanı frontend tarafından güncellenmez.

## Devam

Kaynak değiştiyse `main` ve aktif dalın tam farkını incele. [İlk açık ve önkoşulu karşılanan iş](production-queue.md#aktif-sıra) ile devam et. Aynı SHA'nın unit/MSW, tarayıcı, kalite, merge/main ve gerekli hosted kanıtlarını birbirinden ayır. Başarısız test için assertion/timeout/politika gevşetme; bilinmeyen ACK için ikinci native writer açma. Yalnız gerçek yeni kaynak veya ortam kanıtıyla kayıt güncelle; mikro adım günlükleri ve tekrar eden kabul metni üretme.

## 22 Kasım 2026 · Frontend genelinde M01 kaynak taraması (aday)

- Tekil özel ders düzeltmesinden önce bütün mutation / Query key sahipleri tarandı: `apps/web/src/features` içindeki 36 alanın key, refetch, invalidation, cursor ve onRefresh arayüzleri; 605 feature TypeScript kaynak yolu üzerinden doğrudan etkilenen ekran kodları denetlendi. Bu kaynak taraması otomatik veya gerçek tarayıcı kabulü değildir.
- **Kök desen:** filtre/cursor Query ailesi ile native receipt/readback sonrasındaki sadece aktif sayfa `refetch` işlemi ayrık bırakılıyor; eski continuation cursor'ı mutation sonrası geçersiz olabilir. Doğru mevcut uygulamalar (`peopleKeys`, `productsKeys`, `leadsKeys`, `memberReservationKeys`) korunuyor, eksik readback'ler ve ilişki sorguları hedefli düzeltiliyor.
- **Aday:** [PR #374](https://github.com/SXQHex/FtkSaaS/pull/374) genişletildi. Ortak `lib/cache-invalidation.ts` yalnız etkilenmiş key ailelerini stale işaretler; ilk sayfa readback başarısızsa `saved` ilan edilemez. Native komut ve receipt kodu, test/CI eşikleri, backend alanı değiştirilmedi.
- **Kapanış sınırı:** PR'ın son SHA'sında unit/coverage/typecheck/lint/format/build, tam Desktop Chromium shard, sayfa-2→write/receipt→ilk sayfa→eski cursor olumsuz örneği ve tenant izolasyonu doğrulanana kadar M01–M05/A kutuları **açık**. Merge/main, dört tarayıcı ve hosted kabulü ayrı kaydedilecek.
