# Belge sahipliği haritası

Üretilmiştir: `docs/documentation.json` → `docs:update`. Elle düzenleme. Konu kimliği tek belgeye aittir; özet ve generated görünüm yeni karar kaynağı değildir. Güncel arama/context yalnız bu yaşayan dosyaları seçer. Tarihsel kanıta giriş yalnız [kaynak indeksi](source-index.md) üzerinden yapılır.

| Belge | Rol | Tek sorumluluk | Konu kimlikleri |
|---|---|---|---|
| [AGENTS.md](../AGENTS.md) | authority | Alan, karar, kaynak seçimi ve işlem yetkisi | agent-policy |
| [CONSTRAINTS.md](../CONSTRAINTS.md) | authority | İki alanın ortak kalite tabanı, mekanizmaları ve sınırları | shared-quality-constraints |
| [README.md](../README.md) | entry | Proje başlangıcı | project-entry |
| [apps/backend/AGENTS.md](../apps/backend/AGENTS.md) | authority | Backend ajan çalışma yükümlülükleri | backend-agent |
| [apps/backend/README.md](../apps/backend/README.md) | entry | Backend komut girişleri | backend-entry |
| [apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) | status | Repo/backend kaynak, CI ve ortam kabul snapshot’ı | current-acceptance |
| [apps/backend/docs/documentation-development.md](../apps/backend/docs/documentation-development.md) | guide | Belge üretim ve kaynak inceleme prosedürü | documentation-tooling |
| [apps/backend/docs/physical-invariants.md](../apps/backend/docs/physical-invariants.md) | guide | Transaction, kilit ve veri bütünlüğü tasarımı | physical-integrity-design |
| [apps/backend/docs/production-queue.md](../apps/backend/docs/production-queue.md) | queue | Backend geliştirme sırası ve koordinasyon | active-order |
| [apps/backend/docs/remaining-work.md](../apps/backend/docs/remaining-work.md) | backlog | Backend açık işleri ve alanlar arası bağımlılıkları | open-work |
| [apps/backend/docs/remote-backend-setup.md](../apps/backend/docs/remote-backend-setup.md) | guide | Dağıtım, worker ve restore işletimi | backend-operations |
| [apps/web/AGENTS.md](../apps/web/AGENTS.md) | authority | Frontend ajan çalışma yükümlülükleri | frontend-agent |
| [apps/web/README.md](../apps/web/README.md) | entry | Frontend başlangıcı | frontend-entry |
| [apps/web/docs/development.md](../apps/web/docs/development.md) | guide | Vite SPA geliştirme, ortak paketler ve yerel doğrulama | frontend-development |
| [apps/web/docs/handover.md](../apps/web/docs/handover.md) | status | Frontend son kaynak, PR, CI ve ortam devri | frontend-handover |
| [apps/web/docs/todo.md](../apps/web/docs/todo.md) | entry | Geçmiş frontend teslim ve kabul kayıtlarına sabit Git bağlantıları | frontend-legacy-delivery-index |
| [docs/ci-policy.md](ci-policy.md) | authority | Kaynak bağlı CI ve teslim kapıları | ci-acceptance-policy |
| [docs/client-integration.md](client-integration.md) | guide | Ortak istemci transport ve wire tüketimi | client-protocol |
| [docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md](contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) | authority | Modül ve plan erişimi | product-scope |
| [docs/contracts/02-FtkSaaS-teknik-sozlesme.md](contracts/02-FtkSaaS-teknik-sozlesme.md) | authority | Yürürlükteki domain ve ayar kararları | domain-decisions |
| [docs/contracts/04-FtkSaaS-O4-veri-semasi.md](contracts/04-FtkSaaS-O4-veri-semasi.md) | generated | Makine sözleşmesinden domain tablo görünümü | domain-schema-view |
| [docs/contracts/05-FtkSaaS-O4-API-katalogu.md](contracts/05-FtkSaaS-O4-API-katalogu.md) | generated | Makine sözleşmesinden DTO ve operasyon görünümü | api-contract-view |
| [docs/contracts/06-FtkSaaS-O4-durum-hata-izin.md](contracts/06-FtkSaaS-O4-durum-hata-izin.md) | guide | Wire durum, hata ve izin açıklamaları | state-error-permission |
| [docs/database.md](database.md) | generated | Migration kaynağı ve içerik hash’leri | migration-inventory |
| [docs/decisions/P08-accepted-scope.md](decisions/P08-accepted-scope.md) | authority | Abone No, ortak başvuru ve etkinlik davranışının kabul edilmiş kapsamı | p08-product-scope |
| [docs/documentation-map.md](documentation-map.md) | generated | Makine sahiplik envanterinin görünümü | documentation-map |
| [docs/feature-delivery.md](feature-delivery.md) | generated | F01–F33 kaynak/API ve gerçek test referansları | feature-api-coverage |
| [docs/functions.md](functions.md) | generated | Her API’nin birincil WF sahibi | api-workflow-map |
| [docs/monorepo.md](monorepo.md) | guide | Repo, paket ve ortam yerleşimi | workspace-architecture |
| [docs/requests.md](requests.md) | coordination | Backend/frontend alanlar arası talep, onay ve teslim kabulü | cross-area-requests |
| [docs/security.md](security.md) | generated | Güvenlik DDL kaynak envanteri | security-source-inventory |
| [docs/settings.md](settings.md) | guide | Typed ayar ve native hesap tüketimi | settings-consumers |
| [docs/source-index.md](source-index.md) | entry | Başlangıç, konu seçimi ve arşiv sınırı | source-routing |
| [docs/workflows.md](workflows.md) | guide | Kullanıcı amacından API sırasına ortak akışlar | project-workflows |
| [packages/api-contracts/README.md](../packages/api-contracts/README.md) | entry | Ortak sözleşme paketi kullanımı | contract-package-entry |
| [apps/web/docs/production-queue.md](../apps/web/docs/production-queue.md) | queue | Frontend aktif geliştirme sırası, bağımlılıklar ve kontrol noktaları | frontend-active-order |
| [apps/web/docs/remaining-work.md](../apps/web/docs/remaining-work.md) | backlog | Frontend açık işler, ölçülebilir kabul ve kapanış koşulları | frontend-open-work |
| [apps/web/docs/request.md](../apps/web/docs/request.md) | guide | Taşınan W1-BE frontend entegrasyon kanıtı | frontend-integration-evidence |
| [apps/web/design-reference/README.md](../apps/web/design-reference/README.md) | guide | Salt okunur frontend tasarım kaynakları | frontend-design-references |
| [apps/web/design-reference/revisions/2026-11-18/GECIS.md](../apps/web/design-reference/revisions/2026-11-18/GECIS.md) | guide | 18 Kasım çizim revizyonu ve izlenebilirlik kaydı | frontend-design-revision-2026-11-18-gecis |
| [apps/web/design-reference/revisions/2026-11-18/ILERLEME.md](../apps/web/design-reference/revisions/2026-11-18/ILERLEME.md) | guide | 18 Kasım çizim revizyonu ve izlenebilirlik kaydı | frontend-design-revision-2026-11-18-ilerleme |
| [apps/web/design-reference/revisions/2026-11-18/README.md](../apps/web/design-reference/revisions/2026-11-18/README.md) | guide | 18 Kasım çizim revizyonu ve izlenebilirlik kaydı | frontend-design-revision-2026-11-18-readme |
