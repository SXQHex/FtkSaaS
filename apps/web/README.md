# FtkSaaS web

Vite, React ve TanStack Router ile geliştirilen ürün frontend'i. Uygulama `apps/web`; ortak UI, API tipleri ve TypeScript ayarları `packages` altındadır.

Repo kökünden başlatın.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev:web
```

Yerel public ortam ayarları, test komutları ve statik build için [geliştirme rehberine](docs/development.md) bakın. Uygulama kapsamı ve kabul [todo](docs/todo.md), sohbet devri [handover](docs/handover.md) sahibindedir. Yayını [Cloudflare CD](../../docs/ci-policy.md#cloudflare-dağıtımı) yönetir.
