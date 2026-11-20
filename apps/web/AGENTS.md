# Frontend ajanı

Önce kök [AGENTS](../../AGENTS.md), [istemci protokolü](../../docs/client-integration.md), [geliştirme rehberi](docs/development.md), [todo](docs/todo.md) ve [devir](docs/handover.md) okunur.

- Ürün frontend'i `apps/web` altında Vite SPA'dır. Paylaşılan UI, API tipleri ve TypeScript ayarlarının tek kaynağı `packages` dizinidir. Uygulamaya özgü ekranlar, route ve adapter'lar `apps/web` altında kalır.
- Repo kökünden pnpm workspace ve tek lockfile kullan. Tasarım referansları salt okunur. Frontend planı ve kabul ölçütleri [todo](docs/todo.md) sahibindedir. Yeni ortak talepleri [koordinasyon kaydına](../../docs/requests.md) işle.
- Önce ilgili [WF](../../docs/workflows.md) ve [API eşlemesini](../../docs/functions.md) oku. PR'de native okuma, komut, rol/plan, hata/kurtarma ve başarı sonrası yeniden okuma sınırını göster. İstemci native Auth ve yayımlanmış Edge sözleşmesinden ilerler.
- Yerel doğrulama `pnpm check:frontend` ve `pnpm test:frontend:e2e` ile yapılır. Browser alt kümesi ve seri doğrulama için [geliştirme rehberini](docs/development.md) izle. Cloudflare yayın kanıtının sahibi [CI politikasıdır](../../docs/ci-policy.md#cloudflare-dağıtımı).
