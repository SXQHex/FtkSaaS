# FtkSaaS backend

Güncel kaynak merkezi [SXQHex/FtkSaaS main](https://github.com/SXQHex/FtkSaaS). Önce [AGENTS.md](AGENTS.md), [kaynak indeksi](docs/source-index.md), [güncel devir](contracts/00-FtkSaaS-yeni-sohbet-devir.md), [kalan işler](docs/remaining-work.md) ve [üretim kuyruğu](docs/production-queue.md) okunur.

20 Ekim uygulama kaynağı main `7577b2f1873c6b1fcf83390bfa94a34374c44082`: **199 sözleşme / 118 çağrılabilir / 81 yalnız sözleşme / 34 migration**. P01 [PR #22](https://github.com/SXQHex/FtkSaaS/pull/22) ile birleşti; talep/rezervasyon/bekleme/yer teklifi ve dar worker zinciri eklendi. Hedefli ve aday CI başarılıdır; main clean bu belge görevinde kullanıcı kararıyla başarılı varsayılmıştır, gerçek sonuç/hata takibi BackendCoder'dadır. Kanıtlar ve hosted/production sınırı güncel devirdedir; varsayım doğrulanmış CI başarısı değildir.

Starter anlaşmasız yoklama/hak tüketimi, Pro/Business immutable eğitmen anlaşması/hakedişi ve ayrı merkezler arası hesaplaşma uygulanmıştır. Paket/seans yaşam döngüsü, finans düzeltme/ödemeler, CRM, genel belge/bildirim, rapor/import ve hesap/abonelik yaşam döngüsünün açık işlemleri kuyruktadır. İşlem sayısı ürün tamamlanma oranı değildir; [F01–F33](docs/feature-delivery.md) özellik kabulünü ayrı gösterir.

## Geliştirme ve CI

Node 24.19.0 ve sabit lockfile kullanılır:

    npm ci
    npm run generate
    npm run verify
    npm run dev:start
    npm run test:clean
    npm run dev:stop

Yerel test:clean yalnız izole loopback DB'sini sıfırlar. Geliştirme push'ları birikimli hedefli CI kullanır; aday clean açık tetiklenir. [CI-2026-10-20](docs/decisions/CI-2026-10-20.md) kararıyla sıradaki **CI-02** dört bağımsız shard, bölüm boyunca Draft/development engeli ve güvenli yalnız-belge PR/main kabulünü uygulayacaktır; bu otomasyon henüz etkin değildir. Mevcut main workflow her main push için tek full clean çalıştırır. Yeni hız kazancı ölçülmedi. Full clean başlayınca ajan sonucu izlemeyi bırakıp kullanıcıya devreder.

[Endpoint envanteri](docs/endpoint-inventory.json), [entegrasyon devri](docs/claude-handover.md), [CI politikası](docs/ci-policy.md), [ölçümler](docs/ci-performance.md) ve [koruma sınırı](docs/branch-protection-review.md) ayrıntıları taşır. Tarihsel reports/ yeni SHA'nın kabulü yerine geçmez.

Frontend tasarımına/istemci koduna müdahale edilmez; production dağıtımı yapılmaz. Dış e-posta ertelenmiştir; Resend başlatılmaz. Hosted güncelleme, frontend gerçek entegrasyonu ve yük/restore ayrı kabul işleridir.
