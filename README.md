# FtkSaaS — backend teknik temel

Kaynak ürün sözleşmesi v2.2; teknik uygulama revizyonu 2.2-tech.2. Frontend kapsamı yoktur.

Önce [teknik aktarım raporunu](contracts/11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md) okuyun. Makine sözleşmesi contracts/08; insan okunur şema/API 04/05; ortak TypeScript packages/contracts içindedir. Source-v2.2 JSON arşivi ve transfer scripti dönüşümün izini korur.

## Kurulum

Node >=22, npm ve Supabase CLI’nin desteklediği native platform veya Docker gerekir. npm ci sürümleri lockfile’dan kurar. Native runtime experimental; CLI sürümü package.json/lockfile içinde sabittir.

```sh
npm ci
npm run dev:start
npm test
npm run dev:health
npm run db:advisors
```

npm run verify yalnız sözleşme/üretim-drift/typecheck/UUID testlerini çalıştırır. npm run test:db çalışan izole local Supabase DB ister. Bütün test verileri sentetik ve rollback kapsamındadır. Üretim ya da uzak DB URL’si test helper tarafından kabul edilmez. npm run generate 08’den ortak tipler ve 04/05 kataloglarını üretir. Uygulanmış baseline migration donuktur; değişiklik için supabase migration new ile yeni migration gerekir.

Domain endpointler henüz uygulanmadı. İstemci core/private DML/okumaya yetkili değildir. Backend UUIDv7 adaptörü hazır; test edilen PG17’de DB varsayılan üreticisi olmadığı için ilgili default kapalıdır. Q-D01 ürün kararı kabul edildi; şema/tip/private kapsam filtresi ve pozitif hak kapısı uygulandı, tam event RPC entegrasyonu ve son ortak hak yarışı açık. Ayrıntılı RPC/RLS/Auth/yarış/yük/restore kabulü yapılmadan ürün tamamlandı sayılmaz.

GitHub remote henüz seçilmedi. Bu snapshot ana branch merge veya üretim dağıtımı değildir. Geçici kurulumun sona erme saati ve tekrar kurulum notları 11 raporundadır.
