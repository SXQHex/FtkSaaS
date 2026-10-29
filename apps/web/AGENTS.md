# Frontend kuralları

Kapsam yalnız FtkSaaS'tır. Önce kök AGENTS ve docs/client-integration.md okunur.
Ekran tasarımı ayrı çalışmadır; mevcut taslak kabul edilmez, CRM menüsü veya dashboard varsayılmaz.
Önce shadcn/ui ve ondan türetilmiş hazır bloklar kullanılır; özel bileşen ancak mevcut seçenekler yetmediğinde yazılır. Kaynak ve lisans izi korunur.
Frontend/test değişiklikleri apps/backend veya mevcut backend CI/kabul kaynaklarını değiştirme yetkisi vermez. Bu sınırdaki ihtiyaç docs/remaining-work.md içinde bildirilir.
Vitest/Testing Library/MSW bileşen testleri ve Playwright/axe tarayıcı testleri ilk günden tutulur. Mock kabulü gerçek Auth/Edge/DB kabulü değildir. Teste özel Auth bypass'ı uygulamaya eklenmez.
API tipleri @ftksaas/api-contracts, transport aynı paketin /client export'undan gelir. Ayrıcalıklı anahtar, token veya gerçek veri fixture/log'a yazılmaz. Hiçbir hata sahte başarıya dönüşmez.
pnpm check:frontend ve pnpm test:frontend:e2e frontend doğrulamasıdır. Backend komutları burada otomatik çağrılmaz.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## İş akışı önkoşulu

Ekran/API seçmeden önce proje [iş akışlarını](../../docs/workflows.md), [API–akış haritasını](../../docs/functions.md) ve ilgili alan devrini oku. PR'de WF kimliği, okuma→preview→komut sırası, rol/plan/tenant sınırı, hata ve sonucu bilinmeyen işlem kurtarması, başarı sonrası yeniden okuma ve gerçek kabul eksikleri belirtilir. Yeni ekran iş kuralını endpoint isminden veya mock fixture'dan çıkaramaz. Eksik katalog/selector/backend davranışı bağımlılık olarak kaydedilir; doğrudan tabloya veya uydurulmuş endpoint'e geçilmez.

Geliştirme/tasarım/kabul notları `apps/web/docs`, teknik kullanım [development.md](docs/development.md) içindedir. Proje iş akışı ve normatif kararlar kök `/docs` sahibindedir. Runtime consumer/hosted kanıtı tamamlanmadan yalnız tasarım veya MSW başarısıyla iş akışı kapatılmaz.
