# FtkSaaS backend

Kalıcı kaynak [SXQHex/FtkSaaS main](https://github.com/SXQHex/FtkSaaS). Başlangıç sırası ve kaynak önceliği: [AGENTS.md](AGENTS.md), [kaynak indeksi](docs/source-index.md), [güncel devir](contracts/00-FtkSaaS-yeni-sohbet-devir.md).

Son doğrulanmış başlangıç main c231ab5526854ed62445613467649e1b0bf960bb; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39010419849) başarılı: 25 migration, 241 test (12 sözleşme + 27 DB + 202 Auth/API). Sonraki kaynak için CI ayrıca doğrulanır.

Bu PR [karar sprintini](docs/decisions/DS-2026-10-17.md) sözleşme/DTO/izin/guard/sürüm-okuma bağımlılıklarına aktarır ve CI denetimini güçlendirir. 197 sözleşme = 184 mevcut + 13 yeni contract_only; 79 çağrılabilir, 118 yalnız sözleşme. Yeni runtime veya migration eklenmez. İşlem sayısı ürün tamamlanma oranı değildir.

[Karar/teknik/runtime/kabul ayrımı](docs/decision-sprint-handover.md), [F01–F33 teslim haritası](docs/feature-delivery.md), [endpoint envanteri](docs/endpoint-inventory.json), [açık işler](docs/remaining-work.md), [main koruma denetimi](docs/branch-protection-review.md) ve [entegrasyon devri](docs/claude-handover.md) güncel kapsamı belirtir.

Node 24.19.0 ve sabit lockfile kullanılır:

    npm ci
    npm run generate
    npm run verify
    npm run dev:start
    npm run test:clean
    npm run dev:stop

Geliştirmede odaklı sözleşme denetimi npm run test:governance'dır. Son kapsam CI'ında npm run test:clean, yalnız checkout loopback DB'sini sıfırlayıp bütün migration/test/seed/health/advisors adımlarını çalıştırır. Sözleşme bozma testleri yeni iş akışlarının gerçek Auth → Edge → RPC kabulü değildir; DS davranış kataloğu pending_runtime olarak açıktır.

Production dağıtımı yapılmaz; vercel.json main otomatik dağıtımını kapalı tutar. Frontend alanına müdahale edilmez. Dış e-posta ertelenmiştir; Resend başlatılmaz. Hosted geliştirme smoke'u, frontend gerçek entegrasyonu ve yük/restore ayrı kanıtlardır. Tarihsel raporlar ait oldukları kaynak snapshot'ını kanıtlar; yeni SHA'nın kabulü yerine geçmez.

Son hesaplaşma revizyonu: [yetki zinciri ve iki taraflı kesinleştirme](docs/decisions/DS-2026-10-17-settlement-revision.md). DS-OPEN-01 karar düzeyinde kapalı; runtime pending. Üç ayrı kayıt/düzeltme taslak ucu üç authority read/set sözleşmesiyle değişti; 197/79/118 toplamı aynı. 34 yeni davranış senaryosu pending; son revizyon SHA/CI/inceleme PR #13 konuşmasından doğrulanır.
