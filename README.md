# FtkSaaS backend

Güncel kaynak merkezi [SXQHex/FtkSaaS main](https://github.com/SXQHex/FtkSaaS). Önce [AGENTS.md](AGENTS.md), [kaynak indeksi](docs/source-index.md), [güncel devir](contracts/00-FtkSaaS-yeni-sohbet-devir.md), [kalan işler](docs/remaining-work.md) ve [üretim kuyruğu](docs/production-queue.md) okunur.

P05 **done (kod, main ve geliştirme/test kabulü)**: [PR37](https://github.com/SXQHex/FtkSaaS/pull/37), kabul edilmiş main `83641447b29e459236aea1a9a4379b5d19825af6`;200 sözleşme/165 runtime/35 contract_only,53 migration/90 core tablo. Son head15e2126/base16cb570/tested merge2ebe087/tree736a75b; bağımsız son kaynak incelemesi5611074233, [aday39745672815](https://github.com/SXQHex/FtkSaaS/actions/runs/39745672815) ve [aynı main39748053581](https://github.com/SXQHex/FtkSaaS/actions/runs/39748053581) completed/success. [CD39750264949 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39750264949) success:18 kontrol,53/53 içerik eşleşmesi, P05 migration uygulandı, Edge6 ACTIVE/verify_jwt=true, RLS kapalı0/client RPC EXECUTE0 ve sentetik fixture temizliği. Receipt artifact12412499512 SHA256 `a41a8448c0a1b9dfdf853b58bea7cd56525fd8ede14812684b12619c3c8ee04e`. Eski aday hata kayıtları tarihsel kanıttır; bu kabulün kaynağı değildir.

P01–P05 kod kabulü kapandı. P06 rapor/import/izleme kod adayı hazır, son kaynak clean/CD kabulü bekleniyor; P07 hesap/organizasyon/abonelik yaşam döngüsü sırada. P06 sonunda hosted worker işletim kabulü planlanır. İşlem sayısı ürün tamamlanma oranı değildir; [F01–F33](docs/feature-delivery.md) kabulü ayrı gösterir.

## Geliştirme ve CI

Node 24.19.0 ve sabit lockfile kullanılır:

    npm ci
    npm run generate
    npm run verify
    npm run dev:start
    npm run test:clean
    npm run dev:stop

Yerel test:clean yalnız izole loopback DB'sini sıfırlar. Geliştirme push'ları birikimli hedefli CI kullanır; aday clean açık tetiklenir. [CI-2026-10-20](docs/decisions/CI-2026-10-20.md) dört bağımsız shard, bölüm boyunca Draft/development engeli ve kaynak bağlı yalnız-belge PR/main kabulüyle uygulanmıştır. Runtime/CI son aday ve main tam kapsamdan geçer; güvenli belge değişimi ayrı kabul kullanır. Her kabul edilmiş main sonrası [geliştirme/test Supabase eşitlemesi](docs/remote-backend-setup.md) teslim kapanışının parçasıdır. Full clean başlayınca ajan sonucu izlemeyi bırakıp kullanıcıya devreder.

[Endpoint envanteri](docs/endpoint-inventory.json), [entegrasyon devri](docs/claude-handover.md), [CI politikası](docs/ci-policy.md), [ölçümler](docs/ci-performance.md) ve [koruma sınırı](docs/branch-protection-review.md) ayrıntıları taşır. Tarihsel reports/ yeni SHA'nın kabulü yerine geçmez.

Frontend tasarımına/istemci koduna müdahale edilmez; production dağıtımı yapılmaz. Dış e-posta ertelenmiştir; Resend başlatılmaz. Hosted güncelleme, frontend gerçek entegrasyonu ve yük/restore ayrı kabul işleridir.

[P06 rapor/import/izleme devri](docs/p06-handover.md):200 sözleşme,178 runtime,22 yalnız sözleşme; final clean/CD kabulü beklenir. Hosted worker işletimi OPS-W01 olarak ayrıca izlenir.
