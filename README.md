# FtkSaaS

Dans ve fitness stüdyolarının organizasyon, merkez, ders, öğrenci, üyelik ve finans operasyonları için SaaS uygulaması. Backend ve web frontend aynı pnpm/Turborepo monoreposunda geliştirilir.

## Proje yapısı

| Konum | Sorumluluk | Başlangıç |
|---|---|---|
| `apps/backend` | Supabase, SQL/migration, Edge, backend test ve işletim araçları | [README](apps/backend/README.md) · [AGENTS](apps/backend/AGENTS.md) |
| `apps/web` | Next.js uygulaması, ekranlar ve frontend testleri | [README](apps/web/README.md) · [AGENTS](apps/web/AGENTS.md) |
| `packages/api-contracts` | Ortak makine sözleşmesi, üretilmiş tipler ve istemci transport’u | [README](packages/api-contracts/README.md) |
| `packages/ui` | Paylaşılan UI bileşenleri | [Frontend rehberi](apps/web/docs/development.md) |
| `packages/typescript-config` | Ortak TypeScript ayarları | [Monorepo rehberi](docs/monorepo.md) |
| `docs` | Yalnız iki alanı ilgilendiren ürün/API sözleşmeleri, iş akışları ve ortak kurallar | [Kaynak indeksi](docs/source-index.md) |

## Başlangıç

Node sürümü `.nvmrc`, pnpm sürümü `package.json` içinde sabittir. Tek lockfile kullanılır.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check:quality
```

Uygulamayı çalıştırma ve alan testleri ilgili README’de anlatılır. Ortak komutlar Turborepo üzerinden alan filtreleriyle yürütülür; kalite kanıtı cache başarısıyla ikame edilmez.

## Ortak çalışma

- Backend sözleşmeyi geliştirir, frontend ona adapte olur. Uyumluluk sinyali backend teslimini frontend uyarlaması bitene kadar bekletmez.
- Her alan kendi planını, ilerlemesini, kabulünü ve sohbet devrini kendi `apps/.../docs` klasöründe yürütür. Ortak belgeler bu kayıtların kopyası değildir.
- SSoT: Her bilginin tek sahibi vardır; diğer belgeler sahibine bağlanır. Ayrıntılı yetki ve çalışma kuralları [AGENTS](AGENTS.md), kalite sınırları [CONSTRAINTS](CONSTRAINTS.md), kabul ve CI işleyişi [CI politikasında](docs/ci-policy.md) tutulur.
