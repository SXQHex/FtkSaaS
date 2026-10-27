# Frontend geliştirme

Kapsam yalnız FtkSaaS'tır. Web uygulaması apps/web, ortak arayüz packages/ui sahibindedir. Kök [AGENTS](../AGENTS.md), [istemci protokolü](claude-handover.md) ve [API sözleşme paketi](../packages/api-contracts/README.md) önceliklidir. Güncel kabul [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [tek backlog'dadır](remaining-work.md).

## Bileşen ve araç kuralları

Önce shadcn/ui ve ondan türetilmiş hazır bloklar değerlendirilir. Özel bileşen yalnız hazır seçenek ihtiyacı karşılamadığında yazılır. packages/ui/registry-sources.json resmî registry adreslerini, alınan kaynakların SHA256 değerlerini ve login-01 uyarlamasını kaydeder; aynı paketin LICENSE dosyası MIT bildirimini korur. Kullanılan bileşenler React 19 ve Tailwind 4 ile çalışır.

Build önbelleği apps/web/turbo.json içinde .next çıktıları, açık NEXT_PUBLIC_* girdileri ve .env* dosya hash’leriyle tanımlıdır; yerel bağlantı değişince önceki build cache’i kullanılmaz.

TypeScript sürümü kök pnpm-workspace.yaml katalogundaki 7.0.2'dir. Next.js 16.4.3 varsayılan proje-yerel tsc CLI yoluyla build sırasında tip kontrolü yapar; ignoreBuildErrors veya TypeScript 6 fallback'i yoktur. JavaScript compiler API'si isteyen typescript-eslint yerine Biome lint kullanılır. Vitest/MSW ve Playwright sürümleri manifestlerde tam sabittir. Node .nvmrc, pnpm kök packageManager kaynağından seçilir.

## Çalıştırma

Repo kökünde:

```sh
corepack enable
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
# Development publishable key değerini yalnız .env.local içine yerleştir.
pnpm dev:web
```

Uygulama adresi http://127.0.0.1:3000. NEXT_PUBLIC_APP_ORIGIN OAuth ve kurtarma callback'inin güvenilen origin'idir. Development Supabase projesi docs/development-connection.json ile tanımlıdır; yalnız URL ve publishable key istemciye gider. .env.local Git dışında kalır. Auth/Google izinli callback adreslerinin backend/platform sahibi tarafından doğrulanması gerekir; frontend görevi hosted Auth config değiştirme yetkisi vermez.

## Test komutları

```sh
pnpm check:frontend
pnpm test:frontend
pnpm test:frontend:coverage
pnpm --filter @ftksaas/web test:isolation
pnpm --filter @ftksaas/web test:e2e:install
pnpm test:frontend:e2e
```

Vitest/Testing Library etkileşimleri, MSW gerçek shared transport'un DTO/hata/sayfalama tüketimini doğrular. Playwright varsayılan olarak public giriş/kurtarma, korumalı yönlendirme, klavye erişimi, yüzde 200 metin ve axe kontrollerini Chromium/Firefox/WebKit/mobil projelerinde çalıştırır. Otomatik testte production uygulamasına Auth bypass veya demo fallback eklenmez. Coverage raporu ilgili paketin coverage dizininde; Playwright HTML/trace/başarısızlık ekran görüntüsü .artifacts/frontend altında tutulur. Gerçek API/E2E kabulü Turbo cache'inden gelmez.

Canlı development giriş testi ayrı ve açıktır:

```sh
# FTK_E2E_EMAIL ve FTK_E2E_PASSWORD mevcut yetkili test hesabından güvenli ortamda verilir.
pnpm --filter @ftksaas/web test:e2e:live
```

Bu komut mevcut hesabın native girişi→Edge account/organization okumaları→çıkış akışını test eder. Yeni hesap/kuruluş oluşturmaz; reset/seed yapmaz. Trace, video ve ekran görüntüsü canlı testte kapalıdır. TOTP ve Google'ın gerçek sağlayıcı dönüşü yetkili hesapla ayrıca tarayıcıda doğrulanır. Bu kabul gerçekleşmeden mock/public testleri gerçek giriş kanıtı sayılmaz.

## Paket ve CI ayrımı

Frontend komutları yalnız @ftksaas/web, @ftksaas/ui ve gerekli ortak tip kontrollerini seçer. test:backend yalnız backend paketini seçer. Mevcut genel pnpm test tüm workspace testlerini manuel çalıştırabilir; frontend CI bunu kullanmaz. verify-isolation.mjs gerçek Turbo dry-run grafiğinde iki yönlü ayrımı kontrol eder, backend testini çalıştırmaz.

Frontend checks workflow'u yalnız apps/web, packages/ui ve kendi workflow değişiklikleriyle PR/main'de veya manuel başlar. Backend-only değişiklik frontend testlerini başlatmaz. Ortak sözleşme/TypeScript ayarı/kök manifest/lockfile/Turbo değişiklikleri ayrı Frontend contract compatibility workflow'unda kurulum, frontend typecheck ve görev grafiği denetimi çalıştırır; tam frontend/backend test zinciri başlatmaz. Workflow'ların concurrency grupları ve artifact adları backend'den ayrıdır.

Ters yöndeki backend tetikleme ve merge-kabul geçişi [backend ekibine devir](frontend-backend-ci-handover.md) kapsamındadır; mevcut backend workflow/gate kaynakları frontend tarafından değiştirilmez. Yerel görev ayrımı, bu devrin uygulanmış olduğuna kanıt değildir.
