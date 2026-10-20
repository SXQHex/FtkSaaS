# FtkSaaS backend

Güncel kaynak merkezi [SXQHex/FtkSaaS main](https://github.com/SXQHex/FtkSaaS). Önce [AGENTS.md](AGENTS.md), [kaynak indeksi](docs/source-index.md), [güncel devir](contracts/00-FtkSaaS-yeni-sohbet-devir.md), [kalan işler](docs/remaining-work.md) ve [üretim kuyruğu](docs/production-queue.md) okunur.

P02 **done**: [PR #28](https://github.com/SXQHex/FtkSaaS/pull/28), kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167`. Envanter **199 sözleşme / 133 runtime / 66 contract_only / 40 migration / 90 core tablo**. Son head `35816cc30a9b28e273e94e6cef86e8b402dbaad0` bağımsız incelemeden geçti; [hedefli39448566998](https://github.com/SXQHex/FtkSaaS/actions/runs/39448566998), [aday39455462417](https://github.com/SXQHex/FtkSaaS/actions/runs/39455462417) ve [aynı main39461804543](https://github.com/SXQHex/FtkSaaS/actions/runs/39461804543) completed/success. Full kapsam:96 sözleşme/yönetişim +37 CI politika +27 DB +309 API =469 test düğümü; fail/skipped0. Core, dört izole API shard, toplayıcı,40 migration, seed/health/advisors geçti. Main clean14:43; önceki43:33 hedefli koşu seri tüm-suite fallback kullandı, aynı çalışma profili değildir. Eski başarı yeni kaynağa taşınmaz.

Starter anlaşmasız yoklama/hak tüketimi, Pro/Business immutable eğitmen anlaşması/hakedişi ve ayrı merkezler arası hesaplaşma uygulanmıştır. P02 paket/seans yaşam döngüsü tamamlandı. Finans düzeltme/ödemeler, CRM, genel belge/bildirim, rapor/import ve hesap/abonelik yaşam döngüsünün açık işlemleri kuyruktadır. İşlem sayısı ürün tamamlanma oranı değildir; [F01–F33](docs/feature-delivery.md) özellik kabulünü ayrı gösterir.

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
