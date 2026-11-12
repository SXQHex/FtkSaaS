# IDE Codex için kişisel skill’ler

ChatGPT ortamındaki 34 kişisel skill, ek kaynakları ve mevcut lisanslarıyla birlikte bu dizine kopyalanmıştır. İş akışı içerikleri korunmuş; beş referans dosyasında yalnız satır sonu boşlukları ve dosya sonundaki fazla boş satırlar temizlenmiştir; klasörler `SKILL.md` içindeki `name` değerine göre adlandırılmıştır. Buluttaki asıllar korunur. Bu aktarım otomatik çift yönlü eşitleme kurmaz.

## Kullanım ve öncelik

Repoyu güncelledikten sonra Codex ile bu repo içinde yeni bir oturum aç. Örneğin `$documentation-and-adrs` veya `$debugging-and-error-recovery` ile doğrudan çağırabilirsin. Repo kökündeki `.agents/skills` altındaki skill’ler alt klasörlerde de keşfedilir.

Skill içeriği genel çalışma rehberidir. Kullanıcının açık kararları, kök ve ilgili alanın `AGENTS.md` talimatları, `CONSTRAINTS.md` ve proje sözleşmeleri önceliklidir. Skill içindeki genel komut örnekleri, PR boyutu önerileri, test/merge/deploy adımları veya veritabanı değişikliği önerileri proje kurallarını değiştirmez ve ek yetki vermez. Özellikle Supabase rehberindeki doğrudan SQL önerileri projenin migration kurallarını geçersiz kılmaz.

## Araç ve ortam bağımlılıkları

Bu kopyalama MCP sunucusu, hesap bağlantısı, kimlik bilgisi veya yerel yazılım kurmaz. Araç gerektiren bir adımı uygulamadan önce IDE oturumunda gereken araca gerçekten erişildiğini doğrula.

| Skill / grup | Gereken ortam |
|---|---|
| `browser-testing-with-devtools` | Chrome DevTools MCP ve uygun Chrome kurulumu. Kaynaktaki `.mcp.json` örneği IDE Codex’e otomatik kurulum değildir; Codex’in kendi MCP yapılandırmasını kullan. |
| `supabase` | İşleme göre Supabase CLI, PostgreSQL araçları veya Supabase MCP ve uygun hesap/proje erişimi. |
| `screencapture` | macOS `screencapture` ve ekran kaydı izinleri; Linux/uzak ortamlarda aynı komut çalışmaz. |
| Docker, GitHub Actions ve CI denetim skill’leri | Göreve göre Docker/BuildKit, GitHub erişimi, CLI ve ilgili denetleyiciler. |
| Diğer geliştirme skill’leri | Reponun ilgili araçları ve test ortamı; öneri metni bir kurulum ya da kabul kanıtı değildir. |

## Aktarım sınırı

Bu dizin kişisel skill koleksiyonunu içerir. ChatGPT’nin sistem/yerleşik skill’leri ve plugin’lerin sağladığı skill’ler bu aktarımda kopyalanmamıştır. GitHub, Cloudflare, Vercel, Resend, Library, Spaces ve benzeri bulut araçlarının bağlantıları da bu dosyalarla taşınmaz. IDE’de kullanılacak karşılıkları ayrıca kurulmalı ve yetkilendirilmelidir. Kişisel koleksiyondaki iki Supabase skill’i dahil edilmiştir; plugin üzerinden görünen aynı skill’ler ikinci kez eklenmemiştir.

## Kaynak

Aktarım tarihi: 12 Kasım 2026. Kişisel koleksiyon kaynak revizyonu: `4d9dfe36ffbf4872dbc8a191fa5f5378a3213d8f`.

Her klasörün `SKILL.md`, `agents`, `assets`, `references`, `scripts` ve varsa `LICENSE` dosyaları birlikte korunur. Güncellemelerde yalnız `SKILL.md` dosyasını kopyalamak yeterli değildir.

## İçerik

| Skill | Dosya sayısı |
|---|---:|
| `api-and-interface-design` | 4 |
| `browser-testing-with-devtools` | 4 |
| `ci-cd-and-automation` | 4 |
| `code-review-and-quality` | 6 |
| `code-simplification` | 4 |
| `constraint-driven-development` | 5 |
| `context-engineering` | 4 |
| `debugging-and-error-recovery` | 4 |
| `deprecation-and-migration` | 4 |
| `docker-pro` | 4 |
| `documentation-and-adrs` | 4 |
| `doubt-driven-development` | 5 |
| `frontend-design-assistant` | 7 |
| `frontend-ui-engineering` | 5 |
| `gha-audit` | 4 |
| `git-workflow-and-versioning` | 4 |
| `github-actions-workflow-pro` | 11 |
| `idea-refine` | 8 |
| `incremental-implementation` | 5 |
| `interview-me` | 4 |
| `k8s-catch-up` | 102 |
| `observability-and-instrumentation` | 5 |
| `performance-optimization` | 6 |
| `planning-and-task-breakdown` | 5 |
| `screencapture` | 4 |
| `security-and-hardening` | 6 |
| `shipping-and-launch` | 8 |
| `source-driven-development` | 4 |
| `spec-driven-development` | 4 |
| `supabase` | 7 |
| `supabase-postgres-best-practices` | 39 |
| `super-linting` | 5 |
| `test-driven-development` | 5 |
| `using-agent-skills` | 5 |
