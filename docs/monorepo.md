# Monorepo hazırlığı ve frontend göçü

## Kapsam

Bu değişiklik FtkSaaS’ı frontend göçüne hazırlar. saaspt incelendi; uygulama ve tasarım kaynakları henüz aktarılmadı. Geçiş pnpm/Turbo/ortak API paketi ve belge sahipliğidir; domain davranışı, uygulanmış migration, Edge bundle, production, DNS ve eski studiosaas uygulaması değişmez.

Tek repo hedefi SXQHex/FtkSaaS’tır. Backend’in Supabase CLI/SQL/migration/test yolları kökte korunur: supabase/, database/, scripts/, tests/, contracts/. Bu yolların apps/backend içine taşınması bu hazırlığın şartı değildir; geçmiş migration içeriği ve mevcut source-bound CI kanıtı korunur. Kök paket backend/tooling sahibidir; uygulama ve kütüphaneler pnpm workspace paketleridir. Boş bir backend veya frontend çalışıyor gibi gösteren dummy paket eklenmez.

| Yol | Sahiplik |
|---|---|
| apps/* | Frontend uygulama göçü için ayrılmış workspace deseni; henüz uygulama yok |
| packages/api-contracts | 08 sözleşmesinden üretilen tek typed API paketi ve mevcut client export’u |
| packages/tsconfig.base.json | Ortak TypeScript temeli; uygulama kendi framework eklerini tanımlar |
| contracts/, docs/decisions/ | Normatif ürün/teknik/DTO ve kabul kararları |
| supabase/, database/, scripts/, tests/ | Mevcut backend çalışma/test/dağıtım kaynakları |
| docs/, reports/ | Yaşayan alan devirleri ve değiştirilmeyen tarihsel kanıt |

## Paket yöneticisi ve görevler

package.json içindeki packageManager ve engines ile .nvmrc tek sürüm seçimidir. Node için yayımlanmış güncel LTS yaması; LTS kanalı olmayan ortak araçlarda uyumlu güncel stable sürüm seçilir. Canary/beta/RC veya Node Current otomatik alınmaz. Sürümler exact pin ve frozen lock ile kabul edilir; tarihli karşılaştırma kanıtı raporda tutulur, burada ikinci bir canlı sürüm tablosu oluşturulmaz. pnpm-lock.yaml tek bağımlılık kilididir. package-lock.json ve bağımsız ikinci frontend lockfile kullanılmaz. Backend’in mevcut doğrudan bağımlılıkları aynı exact sürümdedir; frontend paketleri göçte kendi workspace manifestlerine eklenir. CI `corepack enable` ardından `pnpm install --frozen-lockfile` çalıştırır. Sessiz npm install/npx-latest fallback’i yoktur.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run generate
pnpm run verify
pnpm run verify:workspace
pnpm run test:db
pnpm run dev:start
pnpm run dev:info
pnpm run dev:stop
```

verify önceki backend sözleşme/yönetişim/CI kontrollerini korur. verify:workspace Turbo üzerinden paket typecheck’lerini yürütür. `pnpm exec turbo run verify` kök backend doğrulamasını çalıştırır. test:clean açık son aday kabulüdür; geliştirmede rutin çalıştırılmaz. Turbo typecheck, test, kök verify ve test:clean görevleri cache kapalıdır; DB/API test başarısı eski cache’den üretilmez. Gelecek frontend build için yalnız .next çıktısı cache’lenebilir; ortam girdileri ilgili uygulama görevinde açık tanımlanmalıdır.

Üreteçler yalnız packages/api-contracts yoluna yazar. Paket adı `@ftksaas/api-contracts`; tip import’u ve `@ftksaas/api-contracts/client` transport’u kullanılır. Genel API tipi kopyalanmaz. Eski packages/contracts yolu yaşayan koddan kaldırılır; tarihsel raporlardaki eski kaynak yolu yeniden yazılmaz. Uygulanmış Edge dosyasının değişmeyen generated banner’ındaki eski komut tarihsel açıklamadır, çalıştırılan npm kurulumu değildir; sırf banner için hosted yeniden deploy yapılmaz.

## Ortam ve veri ayrımı

| Ortam | API/veri hedefi | Değişiklik sınırı |
|---|---|---|
| Yerel/CI | İzole loopback native Supabase | Test reset/seed yalnız burada; gerçek işletme verisi yok |
| Frontend geliştirme/preview | Kullanıcı seçimi: mevcut geliştirme projesi gwyprhenabtpkbojephw | Gerçek Auth→Edge API, yalnız yetkili hesap/tenant; frontend kullanılırken aynı projeye development CD devam eder |
| Production | Henüz tanımlanmadı | Production veri/dağıtım kabulü ve ayrı yapılandırma olmadan canlı müşteri ortamı sayılmaz |

Aynı geliştirme projesine bağlı frontend ve backend yeni değişiklikleri paylaşır. Monorepo bunu izolasyona dönüştürmez; geriye uyumlu additive API/migration, immutable sürümler ve preview/stale/replay kuralları korunur. Kırıcı değişiklik yayınlanmadan önce istemciyle birlikte sürümlenir ve kabul edilir. Bu hedef gerçek müşteriyi kesintisiz işletme garantisi değildir. Frontend preview yanlışlıkla production secret/veri hedefine bağlanmaz. Publishable key/API URL istemcide olabilir; service_role, DB URL, ingress/Turnstile/hash secret sunucuda kalır ve repoya girmez.

Mevcut development CD yalnız başarılı aynı-main backend clean’e bağlıdır. Yeni frontend dağıtım bağlantısı kurulmaz; Vercel production branch/root/env/DNS bu hazırlıkla değiştirilmez. Sonraki göçte Vercel Root Directory apps/web olmalı, kurulum workspace kök lockfile’ını kullanmalı; framework/preview/production env ayrımı somut proje üzerinde ayrıca doğrulanmalıdır.

## İncelenen frontend ve sonraki göç

Kaynak [SXQHex/saaspt](https://github.com/SXQHex/saaspt/tree/bec7e204e06a813e4907ff012d4bcea783472a15), main `bec7e204e06a813e4907ff012d4bcea783472a15`. apps/web Next.js uygulaması, packages/ui, pnpm/Turbo, Vitest/Playwright testleri ve tasarım skillleri var. React/Next/Tailwind/Turbo/pnpm sürümleri kaynak manifestlerinde pinlidir; taşıma öncesi güncel source SHA ve uyumluluk yeniden doğrulanır. Tasarım fixture verisi kullanır; native Auth/backend bağlantısı ve frontend CI kabulü bu incelemeyle tamamlandı değildir. Kaynak README49 tarayıcı testi bildirir; bu hazırlıkta o testler yeniden çalıştırılmış sayılmaz.

Göçte kaynak TSX/CSS/route/etkileşimleri korunur; frontend testleri uygulama kapsamına alınır. saaspt root README/AGENTS/devir/lockfile’ı kökteki yetkili dosyaların üstüne yazılmaz. Tasarım yönergeleri frontend alanına kapsamlanır; normatif backend belgeleri kopyalanmaz. Kaynak repo/SHA/dosya hash’leriyle import izi tutulur; eski repo silinmez/archived yapılmaz. packages/ui ve uygulama gerçek workspace manifestleriyle eklenir; ortak API paketi workspace bağımlılığı olur. Kök typecheck/frontend build/test ve gerçek API entegrasyon kabulü sonraki kaynakta alınır.

## CI geçiş sınırı

Dört API shard, source/head/base/merge-tree kontrolleri, toplayıcı, bağımsız inceleme ve aynı-main kabulü korunur. Lock/workspace/Turbo/shared tip değişimi dar belge işi değildir; hedefli seçici bu değişiklikleri geniş regresyona gönderir. Güvenli yalnız-belge istisnası tam incelenmiş yol listesiyle devam eder. Yeni belge dosyalarının bu listesi path bazında incelenir; uzantıya genel istisna eklenmez.

Paket yöneticisi ve CI girdi yolları değiştiğinden mevcut trusted-base policyMatches sınırı otomatik merge’i kapatır. Son kaynak incelemesi ve gerçek aday clean sonrası exact-source güvenilir kurulum yetkisi ayrıca gerekir. Kapı gevşetilmez, başarı status’u elle yazılmaz, required check bypass edilmez. Bu hazırlığın eski backend clean/CD başarısıyla kabul edildiği iddia edilmez; güncel kabul [00 devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [tek backlog’da](remaining-work.md).
