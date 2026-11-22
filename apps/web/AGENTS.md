# Frontend ajanı

Önce kök [AGENTS](../../AGENTS.md), [istemci protokolü](../../docs/client-integration.md), [geliştirme rehberi](docs/development.md), [açık işler](docs/remaining-work.md), [çalışma sırası](docs/production-queue.md) ve [devir](docs/handover.md) okunur. [Eski todo](docs/todo.md) yalnız tarihsel bağlantı dizinidir; yeni görev yazılmaz.

- Ürün frontend'i `apps/web` altında Vite SPA'dır. Paylaşılan UI, API tipleri ve TypeScript ayarlarının tek kaynağı `packages` dizinidir. Uygulamaya özgü ekranlar, route ve adapter'lar `apps/web` altında kalır.
- Repo kökünden pnpm workspace ve tek lockfile kullan. Tasarım referansları salt okunur. Frontend açık iş ve kabul ölçütleri yalnız [remaining-work](docs/remaining-work.md), yürütme sırası [production-queue](docs/production-queue.md), son kaynak/CI/ortam durumu [handover](docs/handover.md) sahibindedir. Tamamlanan işleri yeniden anlatma; eski kanıta sabit Git SHA'sıyla bağlan. Yeni ortak talepleri [koordinasyon kaydına](../../docs/requests.md) işle.
- Önce ilgili [WF](../../docs/workflows.md) ve [API eşlemesini](../../docs/functions.md) oku. PR'de native okuma, komut, rol/plan, hata/kurtarma ve başarı sonrası yeniden okuma sınırını göster. İstemci native Auth ve yayımlanmış Edge sözleşmesinden ilerler.
- Yerel doğrulama `pnpm check:frontend` ve `pnpm test:frontend:e2e` ile yapılır. Browser alt kümesi ve seri doğrulama için [geliştirme rehberini](docs/development.md) izle. Cloudflare yayın kanıtının sahibi [CI politikasıdır](../../docs/ci-policy.md#cloudflare-dağıtımı).
