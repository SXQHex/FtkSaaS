# Web sohbet ve teslim devri

**Alan:** `apps/web` (Vite SPA). **Aktif çalışma:** [Router + Query birleşik veri yaşam döngüsü](remaining-work.md#router-query-birlesik); 1/2 aşama ayrımı kaldırıldı. **Uygulama sırası:** [production-queue.md](production-queue.md), **açık iş/kabul:** [remaining-work.md](remaining-work.md), **teknik gerekçe:** [development.md](development.md#router--query-birleşik-veri-yaşam-döngüsü). Eski uzun [todo.md](todo.md) aktif backlog değil, sabit geçmiş kaydına bağlantıdır.

## Kaynak ve kontrol noktası

- **Kod denetimi tabanı:** İlk frontend genel taraması `main` `8a5efbb0c14ea259246ca9d07f1fb92948007557` (22 Kasım 2026) üzerinde M01–M14 alanlarını ortaya çıkardı; **güncel doğrulanmış M01 teslimi** `main` `c7f95dc6d7ba374189b1b420dbf6182a79e7ac69` üzerindedir. İlk tarama tek başına kabul kanıtı değildir.
- **Tespit edilen mevcut sağlıklı kaynak:** TanStack Router/Query tek QueryClient, shared account/workspace, tenant key ve ACK/receipt/readback komut koruması. Bunları yeniden kurma. M01 kapandı; öncelik kalan M02–M05/A alan kabulleri, oturum/erişim kapsamı, ardından ağ/iptal ölçümü.
- **M01 main/CI kanıtı:** [PR #375](https://github.com/SXQHex/FtkSaaS/pull/375) `1ecf0f73d112b3a31baac793018597500ec56c03` → merge commit `c7f95dc6d7ba374189b1b420dbf6182a79e7ac69`; [frontend CI #45050876444](https://github.com/SXQHex/FtkSaaS/actions/runs/45050876444) (12/12 Desktop Chromium, unit/coverage, lint/format/typecheck/build/izolasyon) ve [merge proof #45051862222](https://github.com/SXQHex/FtkSaaS/actions/runs/45051862222) başarılı. Diğer açık maddelerin kanıtı değildir.
- **Belge güncelliği:** M01 bağımsız kapanış kanıtı bu kayıttadır. Açık maddeler yalnız `remaining-work.md` içinde, yürütme sırası `production-queue.md` içindedir.
- **Dış bağımlılık:** Yalnız eksik native API varsa frontend tüketici kanıtıyla [ortak talep](../../../docs/requests.md) açılır; backend dokümanı frontend tarafından güncellenmez.

## Devam

Kaynak değiştiyse `main` ve aktif dalın tam farkını incele. [İlk açık ve önkoşulu karşılanan iş](production-queue.md#aktif-sıra) ile devam et. Aynı SHA'nın unit/MSW, tarayıcı, kalite, merge/main ve gerekli hosted kanıtlarını birbirinden ayır. Başarısız test için assertion/timeout/politika gevşetme; bilinmeyen ACK için ikinci native writer açma. Yalnız gerçek yeni kaynak veya ortam kanıtıyla kayıt güncelle; mikro adım günlükleri ve tekrar eden kabul metni üretme.

## 22 Kasım 2026 · M01 bağımsız kapanışı

- **Kapsam ve düzeltme:** Frontend genelinde 36 feature alanının mutation/Query key, `refetch`, cursor ve `onRefresh` akışları denetlendi. [PR #374](https://github.com/SXQHex/FtkSaaS/pull/374) tenant/kişi kapsamlı `refetchType: "none"` invalidation, ilk sayfa native readback ve eski continuation zincirini atma yöntemini taşıdı. [PR #375](https://github.com/SXQHex/FtkSaaS/pull/375) seans detayında kalmış `refetchType: "active"` kaynaklı eski katılımcı/bekleme cursor yeniden okumasını giderdi; ayrı Query family ve geri dönüş ilk sayfa doğrulaması ekledi.
- **Son kaynak:** PR #375 `1ecf0f73d112b3a31baac793018597500ec56c03` → `main` merge `c7f95dc6d7ba374189b1b420dbf6182a79e7ac69`. PR #374 daha önce `cf97d4acae622e0a16f93ebcfbb0431894f1b5bc` commit'iyle birleştirildi.
- **Kabul:** [Frontend Checks #45050876444](https://github.com/SXQHex/FtkSaaS/actions/runs/45050876444) **success**; lint, format, typecheck, build, coverage/unit, izolasyon ve **12/12 Desktop Chromium** başarılı. Eski katılımcı cursor'ı → native yoklama write/receipt → ilk sayfa → yeni cursor, tek writer ve farklı tenant cache izolasyonu testleri aynı SHA'da koştu. [Merge proof #45051862222](https://github.com/SXQHex/FtkSaaS/actions/runs/45051862222) **success**.
- **Sınır:** **M01 bağımsız olarak kapandı.** M02 belge, M03 erişim dizinleri, M04 hakediş, M05 finans ve A-ortak kabulü hâlâ açık; bu işlerin domain-özel olumlu/olumsuz testleri M01 kabulüyle otomatik kapanmaz. M06–M14, D01–D05, dört tarayıcı profili ve gerçek hosted/provider kabulü ayrıca açıktır. Test/eşik/CI politikası gevşetilmedi.

## 22 Kasım 2026 · M02 kod adayı (kabul bekliyor)

- **Başlangıç:** `main` `19fa974d64983c01c642dd1adf4011cc77b364de`; çalışma dalı [feat/web-m02-document-cache](https://github.com/SXQHex/FtkSaaS/tree/feat/web-m02-document-cache). Önce belge dizini, catalog/versions, native çeviri, yayın komutu ve ortak TanStack Query/cursor yardımcıları tarandı; M03–M05'in ayrı alan kabulleri üstlenilmedi.
- **Kod adayı:** Doğrulanmış native yayın scope'u cache invalidation'a taşınır; etkilenen tüm aktif/pasif belge katalog ve sürüm zincirleri ilk sayfaya daraltıldıktan sonra `refetchType: "none"` ile stale işaretlenir. Organizasyon yayını aynı aktör/organizasyondaki farklı merkezleri, merkez yayını yalnız ilgili merkezi etkiler; diğer aktör/organizasyon korunur. Görünür ilk sayfa ve mevcut ACK/receipt/readback kurtarması korunur; açık çeviri paneli değişen belge sürümü için yeni query key kullanır.
- **Regresyon adayı:** [belge Query birim testleri](../src/features/documents/documents-query.test.ts), native yayın scope [testleri](../src/features/documents/document-publication.test.ts) ve [eski cursor/filtre Playwright testi](../e2e/auth-documents-directory.spec.ts) eklendi. Bu kayıt **testlerin çalıştığına veya geçtiğine dair kanıt değildir**.
- **Kapanış durumu:** M02 ve A-ortak açık; aynı adayın unit/coverage, typecheck, lint/format/build/quality, Desktop Chromium CI, bağımsız inceleme ve merge/main sonuçları doğrulanmadan `[x]` yapılmaz. Diğer tarayıcılar, hosted ve sağlayıcı kabulü ileri sürülmez.
