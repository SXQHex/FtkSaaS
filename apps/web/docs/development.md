# Web geliştirme

`apps/web` ürün Vite SPA'sıdır. Dosya tabanlı TanStack Router, TanStack Query, native Supabase Auth ve Edge istemcisi kullanır. Türkçe kaynak ve selector tipleri `src/i18n` altındadır. [Tasarım arşivi](../design-reference/README.md) salt okunur uygulama referansıdır.

## Ortak kaynaklar

- `@ftksaas/ui` React Aria/shadcn bileşenlerini ve ortak UI yardımcılarını taşır. Sahiplik `packages/ui` altındadır. Uygulamanın Tailwind giriş dosyası oradaki sınıfları tarar.
- `@ftksaas/api-contracts` DTO, operasyon ve hata tiplerini sağlar. Transport, browser Auth ve uygulamaya özel hata/indirme davranışı için Web'in Edge adapter'ını kullanır. Gerçek yetki, tenant ve plan kararı API'dedir. [İstemci protokolü](../../../docs/client-integration.md)
- TypeScript pin'i kök workspace kataloğundan, ortak seçenekler `@ftksaas/typescript-config` paketinden gelir. pnpm tek kök lockfile ile kurar.

## Router ve Query veri sahipliği

- `beforeLoad` yalnız native oturum, AAL/MFA ve hesap yaşam döngüsü kontrolünden sorumludur. Backend yetki, organizasyon ve merkez kararının tek kaynağı olmaya devam eder.
- Korumalı route loader'ları, Router context'teki **aynı** `QueryClient` üzerinden `accountQuery` okur. Hesap DTO'su Router loader cache'ine dönmez; ekranlar `useAccountProjection()` ile Query cache'ine abone olur. `/account` ve `/platform` ayrı, yetkili platform projeksiyonunu kullanır.
- Yönetim, eğitmen ve üye ekranlarındaki workspace okumaları tek `workspaceQuery` tanımını kullanır. Loader, doğrulanmış hesap projeksiyonundan sonra sorguyu engellemeden başlatır; `WorkspaceLayout` ve `MemberLayout` aynı Query anahtarından tüketir. Organizasyon URL search alanı olan route'larda `loaderDeps.org` bu anahtarla eşleşir; `centerId` workspace keşfinin anahtarı değildir.
- Organizasyon parametresi, route bileşeninin tipini bozmadan ilgili route'un `({ context, params })` veya `({ context, deps })` adapter'ından ortak `loadScopedAccount` fonksiyonuna aktarılır. Paylaşılan loader fonksiyonu `params` veya `deps` tipini kendisi tanımlamaz; TanStack Router bu tipleri her route için üretir.
- `defaultPreloadStaleTime: 0` Router'ın ayrı bir preload tazelik penceresini kapatır. Query tazelik ve yeniden okuma sahibidir; `router.invalidate()` kendi başına Query cache'ini geçersiz kılmaz. Etki oluşturan işlemlerde ilgili sorgu önce açıkça invalid edilir.
- MFA, davet, callback ve silme sonucu gibi kimlik yaşam döngüsü rotaları bu veri loader'ından ayrıdır. `scopedBackend` üzerindeki pinned-bearer / hesap eşleme kontrolü, özellikle komut ve receipt yolları için güvenlik doğrulaması olarak korunur; bir ekran verisi cache'i değildir.

## Geçici tarayıcı CI profili

Refactoring tamamlanana dek otomatik frontend CI'si yalnız **Desktop Chromium** projesinin üç Playwright shard'ını çalıştırır. Diğer tarayıcı profilleri ve senaryoları korunur, fakat CI tarafından seçilmez. Lint, tip, build, birim/coverage, erişilebilirlik kontrolleri ve aynı profilin tam test envanteri geçerlidir. Dört tarayıcı kabulü bu dönemde iddia edilemez; refactoring kapanışında [CI politikasındaki](../../../docs/ci-policy.md) kaynak-özel güvenilir kurulum süreciyle 12 shard geri alınır.

## Yerel çalışma

Repo kökünden `corepack enable`, `pnpm install --frozen-lockfile` ve `pnpm dev:web` çalıştırın. Gerçek geliştirme servisi için `apps/web/.env.example` değişkenlerini Git dışındaki `apps/web/.env.development.local` dosyasında tanımlayın. `VITE_` değerleri tarayıcıya açıktır. Native Auth loopback dönüşü için izinli yerel origin ve `/auth/callback` kullanılır. Test fixture'ları loopback arayüzünde çalışır. Hosted DB'ye reset veya seed uygulanmaz.

| Komut                                                                                                            | İşlev                                                                |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm check:frontend`                                                                                            | Web ve UI lint, format, tip, birim ve build                          |
| `pnpm build:web`                                                                                                 | Üretim SPA ve bundle denetimi · `apps/web/dist`                      |
| `pnpm --filter @ftksaas/web test:e2e:install`                                                                    | Yerel Playwright Chromium                                            |
| `pnpm test:frontend:e2e`                                                                                         | Üretim build'i ve seri Playwright Chromium                           |
| `pnpm --filter @ftksaas/web verify`                                                                              | Lint, format, i18n, build, seri birim/coverage ve Chromium kanıtı    |
| `pnpm --filter @ftksaas/web test:local --unit src/features/member-profile --e2e e2e/auth-member-profile.spec.ts` | Seçili birim ve tarayıcı testlerini tek işçiyle sırayla yürütme      |
| `pnpm --filter @ftksaas/web test:external`                                                                       | Yayımlı SPA/Google yönlendirmesi ve loopback Turnstile test anahtarı |
| `pnpm --filter @ftksaas/web audit:production`                                                                    | Üretim bağımlılıkları için JSON audit                                |
| `pnpm --filter @ftksaas/web audit:all`                                                                           | Kurulu workspace için tam JSON audit                                 |

Testler gerçek ürün davranışı için sentetik fixture, MSW ve Playwright kullanır. Playwright HTML/JSON/JUnit ve accessibility kanıtı uygulama rapor dizininde kalır. Hosted test sonuçlarını yerel senaryo sonuçlarından ayrı kaydet. Üretim release yöntemi [Cloudflare dağıtımı](../../../docs/ci-policy.md#cloudflare-dağıtımı) bölümündedir.
