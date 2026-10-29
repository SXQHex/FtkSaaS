# FtkSaaS

Supabase backend ve ortak API sözleşmelerini içeren pnpm/Turborepo monoreposu. Backend apps/backend, ortak paketler packages, belgeler docs altındadır. Web frontend apps/web, hazır shadcn/ui bileşenleri packages/ui altındadır. Ortak ürün iş akışı ve API sözleşmesi backend liderliğinde sürdürülür.

- [Kaynak indeksi](docs/source-index.md): hangi sorunun hangi dosyada cevaplandığı.
- [Güncel kabul](apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md): doğrulanmış backend kaynağı ve hosted sürümü.
- [Monorepo ve ortamlar](docs/monorepo.md): geliştirme, gerçek API bağlantısı ve dağıtım sınırları.
- [Açık işler](docs/remaining-work.md), [aktif sıra](docs/production-queue.md), [ajan kuralları](AGENTS.md).

Web geliştirme ve yalnız frontend doğrulama komutları için [frontend rehberine](apps/web/docs/development.md) bak. Hızlı başlangıç: `pnpm dev:web`; kontrol: `pnpm check:frontend`.

## Çalıştırma

Node sürümü .nvmrc, paket yöneticisi package.json içinde sabittir. Tek lockfile pnpm-lock.yaml kullanılır.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run verify
pnpm typecheck
```

Backend: `pnpm dev:backend`, `pnpm --filter @ftksaas/backend dev:info`, `pnpm stop:backend`. Tam izole kabul `pnpm test:clean`; yalnız loopback veritabanını sıfırlar. Geliştirmede rutin full clean çalıştırılmaz; [CI politikası](docs/ci-policy.md) geçerlidir.

Ekran tasarımı, API entegrasyonu ve gerçek hosted kabul ayrı durumlar olarak izlenir. Gerçek API hedefi kullanıcı seçimiyle mevcut geliştirme Supabase’idir. Production kurulumu ve eski studiosaas/DNS değişikliği yapılmaz.

## İş akışı ve ajanların çalışma sırası

Projenin iş akışının sahibi backend sözleşmesidir. Backend ve frontend ajanı önce [AGENTS](AGENTS.md), [kaynak indeksi](docs/source-index.md) ve [proje iş akışlarını](docs/workflows.md) okur. [API–akış haritası](docs/functions.md) hangi operasyonun hangi amaca ait olduğunu gösterir; API adlarından ürün davranışı çıkarılmaz.

- Backend ajanı değişen davranışın WF kimliğini, okuma/preview/komut sırasını, yetki/planını, yan etkilerini, hata/kurtarma ve başarı sonrası okuma davranışını aynı PR'de günceller. Sözleşme, üretilmiş referans ve test eşlemesi birlikte teslim edilir.
- Frontend ajanı ekranı ilgili WF ve alan devrine göre uygular. PR'de WF kimliği, kullanılan API'ler ve desteklenmeyen bağımlılıklar belirtilir. Bütün API'leri kullanmak hedef değildir; Starter'ın bütün gerekli kullanıcı amaçlarının kapsanması hedeflenir. Mock ve gerçek hosted kabul ayrı kaydedilir.
- `/docs`: ortak ürün/teknik sözleşmeleri, kabul edilmiş proje kararları, iş akışları, API/güvenlik/şema referansı ve ortak yönetişim. `apps/backend/docs`: backend sohbet devri, geliştirme/operasyon notları. `apps/web/docs`: frontend geliştirme/tasarım ve kabul notları. README/AGENTS giriş ve kurallardır; aynı içeriğin kopyası değildir.

Belge üretme/kontrol/bağlam komutları ve CD artifact kapsamı [backend dokümantasyon çalışma rehberindedir](apps/backend/docs/documentation-development.md). Saf incelenmiş Markdown değişikliği hafif kabul alır; script/workflow/eşleme JSON'u saf belge değildir. CD main'e belge commit'i atmaz; gerekli davranış anlatımı kaynak PR'sinde güncellenir, dağıtılan sürümün durumu artifact olarak kaydedilir.
