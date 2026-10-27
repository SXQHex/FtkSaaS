# FtkSaaS

Supabase backend ve ortak API sözleşmeleri; Next.js frontend göçü için hazırlanmış pnpm/Turborepo workspace.

- [Kaynak indeksi](docs/source-index.md): hangi sorunun hangi dosyada cevaplandığı.
- [Güncel kabul](contracts/00-FtkSaaS-yeni-sohbet-devir.md): doğrulanmış backend kaynağı ve hosted sürümü.
- [Monorepo ve ortamlar](docs/monorepo.md): geliştirme, gerçek API bağlantısı ve dağıtım sınırları.
- [Açık işler](docs/remaining-work.md), [aktif sıra](docs/production-queue.md), [ajan kuralları](AGENTS.md).

## Çalıştırma

Node sürümü .nvmrc, paket yöneticisi package.json içinde sabittir. Tek lockfile pnpm-lock.yaml kullanılır.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run verify
pnpm run verify:workspace
```

Backend: `pnpm dev:start`, `pnpm dev:info`, `pnpm dev:stop`. Tam izole kabul `pnpm test:clean`; yalnız loopback veritabanını sıfırlar. Geliştirmede rutin full clean çalıştırılmaz; [CI politikası](docs/ci-policy.md) geçerlidir.

saaspt görünümü sentetik tasarımdır ve bu hazırlıkta henüz taşınmaz. Repo düzeni Auth/API ekran entegrasyonunu tamamlamaz. Gerçek API hedefi kullanıcı seçimiyle mevcut geliştirme Supabase’idir. Production kurulumu ve eski studiosaas/DNS değişikliği yapılmaz.
