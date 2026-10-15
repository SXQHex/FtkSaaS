# FtkSaaS backend · 0.2.0-rc.1

Kalıcı kaynak: https://github.com/SXQHex/FtkSaaS — `backend/runtime-v0.2.0`. İnceleme: https://github.com/SXQHex/FtkSaaS/pull/1. Frontend kapsamı yoktur.

Önce [Claude devir notunu](docs/claude-handover.md) okuyun. 180 sözleşmenin 48’i geliştirme ortamında çağrılabilir; kalan 132 işlem yalnız sözleşmedir. [Endpoint envanteri](docs/endpoint-inventory.json) ve [Q-E01 teknik aktarım durumu](docs/decisions/Q-E01.md) kapsam sınırlarını gösterir. Q-D01 kabul edilmiş ve ortak havuz yarışlarıyla doğrulanmıştır. Q-E01 kararı kabul edildi; teknik aktarımı ve yeni finans kabul testleri henüz tamamlanmadı.

```sh
# Node 24.19.0; ya da sabit imajlı Dev Container
npm ci
npm run dev:start
npm run dev:seed
npm run dev:info
npm test
```

Supabase CLI 2.121.0 native runtime experimental; yalnız izole yerel geliştirme. Her checkout kendi stack’ini ve dinamik portlarını oluşturur. Bağlantılar `dev:info`, sentetik kullanıcı bilgileri `.dev/development-users.json` içindedir. `.dev` git/teslimat kapsamına girmez. Dev seed fiyat ve limitleri ticari varsayılan değildir. Kaynak ve CI Box’ın yaşam süresinden bağımsızdır.

`npm run generate` güncel 08 JSON’dan ortak tip/validator/Edge bundle ve katalog üretir; `npm run verify` migration hash, kaynak/çıktı drift, kapalı tip/ref ve UUID denetimini yapar. `test:db` gerçek PostgreSQL bütünlüğünü, `test:api` gerçek Auth → Edge → named RPC → DB akışını sınar. Altı migration sıfırdan tekrar uygulanır. `scripts/generate_schema.historical.py` ve `transfer_contract.py` tarihsel üreticilerdir; güncel sözleşme bunlarla yeniden oluşturulmaz.

Paket, JSON kapalı sözleşmesi, migrationlar, ortak TypeScript/adapter, örnekler, CI ve doğrulama kanıtını içerir. Önceki 09/11 teknik raporları tarihsel snapshot’tır; güncel durum `docs/claude-handover.md` ve `reports/verification.json` ile belirlenir. Üretim dağıtımı, bütün ürün kabulü, harici e-posta sağlayıcısı ve yük/restore testleri bu sürümde tamamlanmış sayılmaz.

Temiz kabul: Node 24.19.0 ile npm ci ve npm run test:clean. Bu komut checkout'a ait sentetik yerel veriyi silerek migrationları ve bütün kabulü tekrarlar; CI da aynı komutu kullanır.
