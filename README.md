# FtkSaaS

Supabase backend ve ortak API sözleşmelerini içeren pnpm/Turborepo monoreposu. Backend apps/backend, ortak paketler packages, belgeler docs altındadır. Web frontend apps/web, hazır shadcn/ui bileşenleri packages/ui altındadır. Ekran tasarımı ayrı aşamadır.

- [Kaynak indeksi](docs/source-index.md): hangi sorunun hangi dosyada cevaplandığı.
- [Güncel kabul](docs/contracts/00-FtkSaaS-yeni-sohbet-devir.md): doğrulanmış backend kaynağı ve hosted sürümü.
- [Monorepo ve ortamlar](docs/monorepo.md): geliştirme, gerçek API bağlantısı ve dağıtım sınırları.
- [Açık işler](docs/remaining-work.md), [aktif sıra](docs/production-queue.md), [ajan kuralları](AGENTS.md).

Web geliştirme ve yalnız frontend doğrulama komutları için [frontend rehberine](apps/web/README.md) bak. Hızlı başlangıç: `pnpm dev:web`; kontrol: `pnpm check:frontend`.

## Çalıştırma

Node sürümü .nvmrc, paket yöneticisi package.json içinde sabittir. Tek lockfile pnpm-lock.yaml kullanılır.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run verify
pnpm typecheck
```

Backend: `pnpm dev:backend`, `pnpm --filter @ftksaas/backend dev:info`, `pnpm stop:backend`. Tam izole kabul `pnpm test:clean`; yalnız loopback veritabanını sıfırlar. Geliştirmede rutin full clean çalıştırılmaz; [CI politikası](docs/ci-policy.md) geçerlidir.

saaspt görünümü sentetik tasarımdır ve bu hazırlıkta henüz taşınmaz. Repo düzeni Auth/API ekran entegrasyonunu tamamlamaz. Gerçek API hedefi kullanıcı seçimiyle mevcut geliştirme Supabase’idir. Production kurulumu ve eski studiosaas/DNS değişikliği yapılmaz.
