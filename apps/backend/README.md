# FtkSaaS backend

Supabase uygulaması, SQL kaynakları, Edge işlevleri, sunucu adapter’ı ve izole kabul testleri bu pakettedir. [Repo ve ortam düzeni](../../docs/monorepo.md), [kaynak indeksi](../../docs/source-index.md) ve [güncel kabul](../../docs/contracts/00-FtkSaaS-yeni-sohbet-devir.md) esas alınır.

Repo kökünden:

```sh
pnpm dev:backend
pnpm --filter @ftksaas/backend dev:info
pnpm --filter @ftksaas/backend test:db
pnpm --filter @ftksaas/backend test:api
pnpm stop:backend
```

Bu paketin içinden aynı komutlar `pnpm dev:start`, `pnpm dev:info`, `pnpm test:db`, `pnpm test:api`, `pnpm dev:stop` olarak çalışır. Testlerden önce izole native servis hazır olmalıdır. Reset içeren tam kabul yalnız açık son adayda kullanılır; hosted ortam test hedefi değildir.

Normatif makine kaynağı [ortak şema](../../packages/api-contracts/schema/contract.json); TypeScript ve embedded Edge sözleşmesi `pnpm generate` ile üretilir. Uygulanmış migration dosyası değiştirilmez. Runtime çıktısı `.artifacts` ve private yerel durum `.dev` altında kalır; tarihsel raporlar yeniden yazılmaz.
