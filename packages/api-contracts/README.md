# Ortak API sözleşmesi

`schema/contract.json` normatif DTO/operasyon/hata/izin kaynağıdır. `src/generated.ts`, `src/operations.ts`, `src/runtime.ts` ve index dosyaları backend üreteçleri tarafından oluşturulur; elle düzenlenmez. Repo kökünden `pnpm generate`, ardından `pnpm verify` çalıştırılır.

Workspace tüketicisi `@ftksaas/api-contracts: workspace:*` bağımlılığı kullanır. Tipler `@ftksaas/api-contracts`, mevcut typed transport `@ftksaas/api-contracts/client` üzerinden alınır. TypeScript kaynak paketi tüketicinin compiler/bundler’ıyla işlenir; ikinci bir DTO veya şema kopyası oluşturulmaz. Gateway içindeki embedded kapalı runtime sözleşmesi aynı kaynaktan üretilir.

Paket runtime yetkisi vermez. Native Auth, canlı session/MFA, tenant/rol/plan ve semantic guard denetimleri backend’dedir. [İstemci tüketim kuralları](../../docs/client-integration.md) ve [backend kaynağı](../../apps/backend/README.md).

`x-contract.feature_delivery.plan_scope` ve `plans` kabul edilmiş ürün erişiminin izidir; `accepted_plan_limits` ürün tablosunun hedef limit aktarımıdır. Bunlar uygulanmış plan kapısı veya ortam kabulü değildir. Mevcut kapılar `runtime_required_features`, uygulanan SQL ve davranış testleriyle doğrulanır; Pro/Business limit aktarımının açık işleri [backend backlog](../../apps/backend/docs/remaining-work.md#p01) sahibindedir. Ürün tablosu değiştiğinde makine izi aynı PR’da güncellenir; governance karşılaştırması atlanmaz.
