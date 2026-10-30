# Monorepo düzeni ve görev sınırları

## Kaynak yerleşimi

Kök dizin yalnız workspace yönetimi ve zorunlu araç yapılandırmalarını içerir. Backend kendi manifesti, bağımlılıkları ve çalışma dizini olan uygulamadır. Frontend apps/web, ortak UI packages/ui içindedir; çalışma rehberi apps/web/docs/development.md sahibindedir.

| Yol | Tek sorumluluk |
|---|---|
| apps/backend | Supabase SQL/migration/Edge, sunucu adapter’ı, backend araçları ve kabul testleri |
| packages/api-contracts/schema/contract.json | Normatif kapalı DTO/operasyon/hata/izin şeması |
| packages/api-contracts/src | Şemadan üretilen tipler, operasyon listesi ve mevcut typed client |
| packages/typescript-config | Paylaşılan TypeScript yapılandırması |
| docs/contracts | Ürün/teknik/durum sözleşmeleri ve üretilmiş referanslar |
| apps/backend/docs | Backend kabul devri, geliştirme ve işletim rehberleri |
| apps/web/docs | Frontend geliştirme ve ekran notları |
| docs/decisions | Kabul edilmiş karar kayıtları |
| docs/history | Değiştirilmeden taşınmış tarihsel raporlar, ilk aktarım raporları ve eski kaynak snapshotları |
| .github/workflows | GitHub Actions kabul ve dağıtım akışı |
| .devcontainer | Workspace geliştirme ortamı |
| .artifacts | İzlenmeyen koşu çıktıları; ci/ ve backend/ altında ayrılır |

Root package.json yalnız workspace komutları ve Turbo bağımlılığını taşır. pg/uuid/Supabase/AJV/esbuild gibi backend bağımlılıkları apps/backend/package.json sahibindedir. Dizinlere göre ikinci backend, sözleşme veya devir ağacı yoktur. İlk aktarımın artık çağrılmayan generate_schema/transfer_contract/ZIP araçları kaldırılmıştır; ilk kurulumun kaynağı değişmez migration zinciri ve Git geçmişidir.

## Sürüm ve paket yönetimi

.nvmrc Node patch seçiminin sahibidir; engines destek aralığını sınırlar. .node-version çiftliği kaldırılmıştır. CI .nvmrc’den okur; devcontainer aynı patch’in resmi Docker image digest’ine sabittir ve eşliği test edilir. package.json packageManager alanı pnpm sürümünü, pnpm-lock.yaml tek çözüm kilidini belirler. Ortak TypeScript sürümü pnpm-workspace.yaml catalog içinde bir kez tanımlanır.

Node için yayımlanmış güncel LTS yaması; ayrı LTS kanalı olmayan ortak araçlarda uyumlu stable sürüm seçilir. Canary/beta/RC veya Node Current otomatik alınmaz. Güncel sürüm pinleri manifestlerin kendisindedir; frontend Next/React/Vitest/Playwright bağımlılıkları kendi paketlerinin sahibidir.

## Çalıştırma

Komutlar repo kökünden:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm generate
pnpm verify
pnpm typecheck
pnpm dev:backend
pnpm --filter @ftksaas/backend dev:info
pnpm stop:backend
```

Backend komutları pnpm filtrelemesiyle apps/backend çalışma dizininde yürür. Backend içinden `pnpm verify`, yalnız kendi yapısal doğrulamasını çalıştırır; kökten `pnpm verify`, Turbo üzerinden backend doğrulaması ve ortak paket typecheck bağımlılığını birlikte çalıştırır. API suite kimlikleri repo-root yollarıdır; Node test süreçleri fixture/config için backend CWD’sini korur. Git diff/tree analizi daima repo kökü üzerinden yapılır; root ve backend CWD eşliği regresyonla doğrulanır.

Tam izole kabul `pnpm test:clean` ile mevcut backend runner’ına gider; GitHub Actions dört API shard ve source-bound collector sahibidir. İstemci ve gerçek DB/API kabulü cache’den üretilmez. Turbo verify/typecheck/test/test:clean görevlerinde cache kapalıdır. Geniş passThroughEnv yıldızı ve backend’i root task gibi gösteren //# görevi yoktur. Frontend build görevleri apps/web/turbo.json içindedir; çıktı/ortam girdisi backend görevine taşınmaz.

## Ortam ve veri sınırı

| Ortam | Hedef | Sınır |
|---|---|---|
| Yerel/CI | İzole loopback native Supabase | Test reset/seed yalnız burada; CLI çalışma dizini apps/backend |
| Frontend geliştirme/preview | Kullanıcı seçimi: mevcut geliştirme Supabase’i gwyprhenabtpkbojephw | Gerçek native Auth→Edge API; yetkili hesap ve tenant sınırları |
| Production | Henüz tanımlanmadı | Ayrı yapılandırma/kabul ve yayın yetkisi gerekir |

Aynı geliştirme projesindeki frontend ve backend değişiklikleri paylaşır. Monorepo veri izolasyonu sağlamaz; additive migration/API, immutable sürüm ve stale/preview/replay davranışları korunur. Hosted gerçek veriye test reset/clean/seed uygulanmaz. Yerel public bağlantı apps/backend/.dev/frontend.env, sentetik girişler aynı paketin private .dev dizinindedir. Bu dosyalar commit edilmez; service-role/DB/ingress/Turnstile/hash secret istemciye verilmez.

Yeni audit/health/CI çıktıları .artifacts/backend ve .artifacts/ci içine yazılır. Tarihsel raporlar yeniden üretilip ezilmez. Taşınmış snapshotların kaynak commit/yol/hash izi kaynak indeksindeki arşiv kapısından izlenir; kesin hash’i eşleşmeyen içerik veya bilinmeyen rapor tarihsel bağlantı istisnası alamaz. Manifest CI güven yüzeyinin parçasıdır.

## GitHub Actions ve Turbo

GitHub Actions kabul ve dağıtımın sahibi kalır. Turbo paket görevlerini çalıştırır; çalışan backend ile frontend arasında bir runtime uyumluluk katmanı değildir. Backend CI/CD’nin dört shard, kaynak/head/base/tree, gerçek job/step/attempt ve main kabulü korunur. CI paket kurulumunu repo kökünde; backend run adımlarını apps/backend içinde yapar. Artifact ve receipt’ler ortak .artifacts/ci yolu kullanır; upload action yolları repo köküne göredir.

Frontend bağımsız test/typecheck/build zincirinin sahibidir. Shared kaynakta backend kabulü de gerekir; aynı main kanıtı sonrası backend CD ve gerçek frontend/Auth/API kabulü ayrıdır. Production/DNS ve eski studiosaas uygulaması ayrı yetki kapsamıdır.

## CI geçiş sınırı

Bu taşıma CI politika yollarını değiştirdiği için trusted-base kurulum sınırına tabidir. Gate gevşetilmez; sahte status/bypass veya repository yönetim ayarı değişikliği yoktur. Güncel kaynak/CI/hosted kabulü [00 devirde](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md), ortak/backend açık iş [proje backlog’unda](../apps/backend/docs/remaining-work.md), frontend bölüm/kabul takibi [web planında](../apps/web/docs/todo.md) tutulur. İptal edilen eski full clean yeni kaynağın kabulü değildir; önce son kaynak incelemesi ve otomatik PR kapsam kabulü alınır; main aday kanıtını test tekrarı olmadan doğrular.
