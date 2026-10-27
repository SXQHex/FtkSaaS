# Ortak API sözleşmesi

`schema/contract.json` normatif DTO/operasyon/hata/izin kaynağıdır. `src/generated.ts`, `src/operations.ts`, `src/runtime.ts` ve index dosyaları backend üreteçleri tarafından oluşturulur; elle düzenlenmez. Repo kökünden `pnpm generate`, ardından `pnpm verify` çalıştırılır.

Workspace tüketicisi `@ftksaas/api-contracts: workspace:*` bağımlılığı kullanır. Tipler `@ftksaas/api-contracts`, mevcut typed transport `@ftksaas/api-contracts/client` üzerinden alınır. TypeScript kaynak paketi tüketicinin compiler/bundler’ıyla işlenir; ikinci bir DTO veya şema kopyası oluşturulmaz. Gateway içindeki embedded kapalı runtime sözleşmesi aynı kaynaktan üretilir.

Paket runtime yetkisi vermez. Native Auth, canlı session/MFA, tenant/rol/plan ve semantic guard denetimleri backend’dedir. [İstemci tüketim kuralları](../../docs/claude-handover.md) ve [backend kaynağı](../../apps/backend/README.md).
