# FtkSaaS backend · 0.2.0-rc.2

Kalıcı kaynak: https://github.com/SXQHex/FtkSaaS — `backend/runtime-v0.2.0`. İnceleme: https://github.com/SXQHex/FtkSaaS/pull/1. Frontend kapsamı yoktur.

Önce [Claude devir notunu](docs/claude-handover.md) okuyun. 182 sözleşmenin 53’ü geliştirme ortamında çağrılabilir; kalan 129 işlem yalnız sözleşmedir. [Endpoint envanteri](docs/endpoint-inventory.json) ve [Q-E01 teknik aktarım durumu](docs/decisions/Q-E01.md) kapsam sınırlarını gösterir. Q-D01 kabul edilmiş ve ortak havuz yarışlarıyla doğrulanmıştır. Q-E01 ana sözleşme, şema/API/ortak tip ve finans yazma yoluna aktarıldı. Güncel temiz kabul kanıtı reports/qe01-verification.json içindedir.

```sh
# Node 24.19.0; ya da sabit imajlı Dev Container
npm ci
npm run dev:start
npm run dev:seed
npm run dev:info
npm test
```

Supabase CLI 2.121.0 native runtime experimental; yalnız izole yerel geliştirme. Her checkout kendi stack’ini ve dinamik portlarını oluşturur. Bağlantılar `dev:info`, sentetik kullanıcı bilgileri `.dev/development-users.json` içindedir. `.dev` git/teslimat kapsamına girmez. Dev seed fiyat ve limitleri ticari varsayılan değildir. Kaynak ve CI Box’ın yaşam süresinden bağımsızdır.

`npm run generate` güncel 08 JSON’dan ortak tip/validator/Edge bundle ve katalog üretir; `npm run verify` migration hash, kaynak/çıktı drift, kapalı tip/ref ve UUID denetimini yapar. `test:db` gerçek PostgreSQL bütünlüğünü, `test:api` gerçek Auth → Edge → named RPC → DB akışını sınar. Yedi migration sıfırdan tekrar uygulanır. `scripts/generate_schema.historical.py` ve `transfer_contract.py` tarihsel üreticilerdir; güncel sözleşme bunlarla yeniden oluşturulmaz.

Paket, JSON kapalı sözleşmesi, migrationlar, ortak TypeScript/adapter, örnekler, CI ve doğrulama kanıtını içerir. Önceki 09/11 teknik raporları tarihsel snapshot’tır; güncel durum `docs/claude-handover.md` ve `reports/qe01-verification.json` ile belirlenir. Üretim dağıtımı, bütün ürün kabulü, harici e-posta sağlayıcısı ve yük/restore testleri bu sürümde tamamlanmış sayılmaz.

Temiz kabul: Node 24.19.0 ile npm ci ve npm run test:clean. Bu komut checkout'a ait sentetik yerel veriyi silerek migrationları ve bütün kabulü tekrarlar; CI da aynı komutu kullanır.

RC2 temiz kabul: 20 statik kontrol, 95 test (12 sözleşme + 27 DB + 56 Auth/API), yedi migration; Q-E01 için 17 gerçek API kabul senaryosu. Son kanıt reports/qe01-verification.json; CI sonucu ilgili commit üzerinden ayrıca denetlenir.
