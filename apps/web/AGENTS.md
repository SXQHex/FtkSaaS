# Frontend ajanı

Önce kök [AGENTS](../../AGENTS.md), [istemci protokolü](../../docs/client-integration.md), kendi [todo](docs/todo.md) ve [sohbet devrin](docs/handover.md) okunur.

## Yetki ve sınır

- Uygulama `apps/web`, ortak UI `packages/ui`; plan, ilerleme, test/kabul ve sohbet devri `apps/web/docs` sahibindedir.
- Backend kodu/belgeleri, ortak sözleşmeler ve backend CI/kabul kapıları salt okunur. Frontend ilerlemesi için kök `/docs` güncellenmez.
- Tek koordinasyon istisnası [ortak talep kaydında](../../docs/requests.md) kendi talep/değerlendirme/onay alanındır. Karşı taraf adına onay verme; kendi todo/devir dosyanda yalnız talep kimliğine bağlan.
- Kapsam dışı veya belirsiz yetkide, dosya/bölüm ve gerekçeyi açıklayıp kullanıcı onayı iste; onaydan önce değiştirme. Aynı görev için verilmiş açık yetkiyi tekrar sorma. Ayrıntının sahibi kök [yazma sınırıdır](../../AGENTS.md#belge-yazma-sınırı).

## Uygulama ve kabul

Todo’daki aktif bölüm bitmeden sonraki bölüme geçilmez. Ekran/API seçmeden önce ilgili [WF](../../docs/workflows.md) ve [API eşlemesi](../../docs/functions.md) okunur. PR; WF kimliği, gerçek okuma→preview→komut sırası, rol/plan/tenant sınırı, hata/kurtarma, başarı sonrası yeniden okuma ve açık gerçek kabulü belirtir. İş kuralı endpoint adı veya mock’tan çıkarılmaz; eksik selector için sahte endpoint/doğrudan tablo erişimi kullanılmaz.

Tasarım ayrı kapsamdır; mevcut taslak, CRM menüsü veya dashboard kendiliğinden kabul edilmiş sayılmaz. Önce shadcn/ui ve hazır blokları kullan; özel bileşen gerekçeli olur, kaynak/lisans izi korunur. [Geliştirme rehberi](docs/development.md).

Tipler `@ftksaas/api-contracts`, transport aynı paketin `/client` export’udur. Ayrıcalıklı anahtar/token/gerçek veri fixture veya log’a yazılmaz; sahte başarı fallback’i ve test Auth bypass’ı eklenmez. Vitest/Testing Library/MSW ile Playwright/axe korunur. Mock başarı gerçek Auth/Edge/DB/hosted kabulü değildir. `pnpm check:frontend` ve `pnpm test:frontend:e2e` frontend doğrulamasıdır; backend komutları otomatik çağrılmaz.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
