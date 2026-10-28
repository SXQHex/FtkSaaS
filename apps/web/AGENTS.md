# Frontend kuralları

Kapsam yalnız FtkSaaS'tır. Önce [kök kuralları](../../AGENTS.md), [plan ve ilerlemeyi](PLAN.md), [teknik kullanımı](README.md) oku; API tüketimi gerektiğinde [istemci protokolünü](../../docs/claude-handover.md) kullan.
Frontend planı, açık işleri, sırası ve kabul durumu yalnız PLAN.md içinde tutulur. README kurulum/komutlar, AGENTS çalışma kuralları içindir; buralara ikinci görev listesi yazılmaz. Genel docs listeleri frontend günlük işlerini taşımaz; ortak belgelerde yalnız iki tarafı etkileyen sözleşme/entegrasyon bilgisi bulunur.
Ekran tasarımı ayrı çalışmadır; mevcut taslak kabul edilmez, CRM menüsü veya dashboard varsayılmaz.
Önce shadcn/ui ve ondan türetilmiş hazır bloklar kullanılır; özel bileşen ancak mevcut seçenekler yetmediğinde yazılır. Kaynak ve lisans izi korunur.
Frontend/test değişiklikleri apps/backend veya mevcut backend CI/kabul kaynaklarını değiştirme yetkisi vermez. Frontend’e ait ihtiyaç PLAN.md içinde tutulur; backend değişikliği gerektiren gerçek ortak entegrasyon ihtiyacı ilgili alan belgesine bağlanır.
Vitest/Testing Library/MSW bileşen testleri ve Playwright/axe tarayıcı testleri ilk günden tutulur. Mock kabulü gerçek Auth/Edge/DB kabulü değildir. Teste özel Auth bypass'ı uygulamaya eklenmez.
API tipleri @ftksaas/api-contracts, transport aynı paketin /client export'undan gelir. Ayrıcalıklı anahtar, token veya gerçek veri fixture/log'a yazılmaz. Hiçbir hata sahte başarıya dönüşmez.
pnpm check:frontend ve pnpm test:frontend:e2e frontend doğrulamasıdır. Backend komutları burada otomatik çağrılmaz.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
