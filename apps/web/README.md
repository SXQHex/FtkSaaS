# FtkSaaS web

Vite, React ve TanStack Router ile geliştirilen ürün frontend'i. Uygulama `apps/web`; ortak UI, API tipleri ve TypeScript ayarları `packages` altındadır.

Repo kökünden başlatın.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev:web
```

Yerel public ortam ayarları, test komutları ve statik build için [geliştirme rehberine](docs/development.md) bakın. Açık kapsam ve kabul [remaining-work](docs/remaining-work.md), uygulama sırası [production-queue](docs/production-queue.md), kaynak/CI/ortam durumu [handover](docs/handover.md) sahibindedir. Önceki teslimlerin [tarihsel indeksi](docs/todo.md) aktifleştirilmez. Yayını [Cloudflare CD](../../docs/ci-policy.md#cloudflare-dağıtımı) yönetir.
