# Markdown sahipliği ve saklama haritası

SSoT her bilgiyi tek sahibinde tutmaktır. [Kaynak indeksi](source-index.md) önceliği belirler. Güncel kaynak/CI/CD yalnız00 devirde, açık iş remaining-work’te, aktif sıra production-queue’da tutulur. Alan devirleri bu sahipleri referans verir; kopya durum kronolojisi eklenmez.

## Saklama ve konsolidasyon

Backend uygulama kodu apps/backend, ortak runtime şeması packages/api-contracts/schema, üretilmiş tipler aynı paketin src/ dizinindedir. Yaşayan insan sözleşmeleri docs/contracts; kararlar docs/decisions altındadır. Root yalnız workspace yönetir.

Eski root/devir/kuyruk kopya kronolojileri Git geçmişinde korunur. Q-D01 yalnız-link köprüsü kaldırılmıştır. Pilot/PR45 kayıtları ile ilk07/09/11 aktarım raporları, mevcut raporlar ve eski source-v2.2 kaynakları docs/history altında kendi byte’larıyla korunur. Kaynak commit/yol/hash izi [tarihsel manifestte](history/manifest.json) tutulur; tarihsel outgoing bağlantıların bağlamı kaynak commit’tir. Yeni rapor kendiliğinden istisna almaz. Manifest CI güven yüzeyinin parçasıdır; yaşayan bağlantı ve başlık kontrolleri korunur.

Kuyruktaki eşsiz P08 kararları [P08 kararının](decisions/P08-accepted-scope.md), izinli operasyonel kurulum snapshotları [hosted runbook’un](remote-backend-setup.md#p08-kurulum-kaydı) sahibindedir. Yeni çalışma çıktıları .artifacts/ci ve .artifacts/backend içine yazılır; tarihsel JSON/raporların üstüne audit/health çıktısı yazılmaz.

## Yaşayan dosyalar

| Dosya | Tek sorumluluk |
|---|---|
| [AGENTS.md](../AGENTS.md) | Çalışma/alan/güvenlik/clean kuralları |
| [CHANGELOG.md](../CHANGELOG.md) | Tarihsel değişiklik dizini |
| [README.md](../README.md) | Repo girişi ve kök komutları |
| [apps/backend/README.md](../apps/backend/README.md) | Backend paket komutları ve çalışma dizini |
| [docs/actual-start-handover.md](actual-start-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/api-invariants.md](api-invariants.md) | API bütünlük/tüketim değişmezleri |
| [docs/branch-protection-review.md](branch-protection-review.md) | Tarihsel yönetim koruması incelemesi |
| [docs/ci-performance.md](ci-performance.md) | Kaynağa bağlı performans ölçümleri |
| [docs/ci-policy.md](ci-policy.md) | CI/kabul ve test süreci |
| [docs/ci02-handover.md](ci02-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/claude-handover.md](claude-handover.md) | İstemci protokolü ve gerçek tüketim devri |
| [docs/contracts/00-FtkSaaS-yeni-sohbet-devir.md](contracts/00-FtkSaaS-yeni-sohbet-devir.md) | Güncel kabul/SHA/CI/CD/hosted durumun tek sahibi |
| [docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md](contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) | Normatif ürün/plan kapsamı |
| [docs/contracts/02-FtkSaaS-teknik-sozlesme.md](contracts/02-FtkSaaS-teknik-sozlesme.md) | Normatif teknik/ayar davranışı |
| [docs/contracts/03-FtkSaaS-kodlama-sorumluluklari.md](contracts/03-FtkSaaS-kodlama-sorumluluklari.md) | Değişiklik ve kodlama sorumlulukları |
| [docs/contracts/04-FtkSaaS-O4-veri-semasi.md](contracts/04-FtkSaaS-O4-veri-semasi.md) | Üretilmiş fiziksel şema görünümü; DDL kaynağı backend migrations |
| [docs/contracts/05-FtkSaaS-O4-API-katalogu.md](contracts/05-FtkSaaS-O4-API-katalogu.md) | Üretilmiş API görünümü; wire kaynağı ortak JSON şema |
| [docs/contracts/06-FtkSaaS-O4-durum-hata-izin.md](contracts/06-FtkSaaS-O4-durum-hata-izin.md) | Durum/hata/izin semantik devri |
| [docs/contracts/10-FtkSaaS-Q-D01-kabul-karari.md](contracts/10-FtkSaaS-Q-D01-kabul-karari.md) | Kabul edilmiş Q-D01 kararı |
| [docs/contracts/12-FtkSaaS-Q-E02-kabul-karari.md](contracts/12-FtkSaaS-Q-E02-kabul-karari.md) | Kabul edilmiş Q-E02/Q-E03 kararı |
| [docs/decision-sprint-handover.md](decision-sprint-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/decisions/CI-2026-10-20.md](decisions/CI-2026-10-20.md) | Kabul edilmiş karar; sonraki çelişen kabul öncelikli |
| [docs/decisions/DS-2026-10-17-settlement-center-scope.md](decisions/DS-2026-10-17-settlement-center-scope.md) | Kabul edilmiş karar; sonraki çelişen kabul öncelikli |
| [docs/decisions/DS-2026-10-17-settlement-revision.md](decisions/DS-2026-10-17-settlement-revision.md) | Kabul edilmiş karar; sonraki çelişen kabul öncelikli |
| [docs/decisions/DS-2026-10-17.md](decisions/DS-2026-10-17.md) | Kabul edilmiş karar; sonraki çelişen kabul öncelikli |
| [docs/decisions/DS-2026-10-25-session-capacity.md](decisions/DS-2026-10-25-session-capacity.md) | Kabul edilmiş karar; sonraki çelişen kabul öncelikli |
| [docs/decisions/P08-accepted-scope.md](decisions/P08-accepted-scope.md) | Kabul edilmiş karar; sonraki çelişen kabul öncelikli |
| [docs/decisions/Q-E01-accepted.md](decisions/Q-E01-accepted.md) | Kabul edilmiş karar; sonraki çelişen kabul öncelikli |
| [docs/decisions/Q-E01.md](decisions/Q-E01.md) | Kabul edilmiş karar; sonraki çelişen kabul öncelikli |
| [docs/decisions/Q-E02.md](decisions/Q-E02.md) | Kabul edilmiş karar; sonraki çelişen kabul öncelikli |
| [docs/decisions/Q-E03.md](decisions/Q-E03.md) | Kabul edilmiş karar; sonraki çelişen kabul öncelikli |
| [docs/documentation-map.md](documentation-map.md) | Yaşayan Markdown sahipliği ve saklama envanteri |
| [docs/feature-delivery.md](feature-delivery.md) | Üretilmiş operasyon/özellik görünümü |
| [docs/frontend-settings-handover.md](frontend-settings-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/instructor-earnings-handover.md](instructor-earnings-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/monorepo.md](monorepo.md) | Paket/çalışma dizini/ortam/CI görev sınırları |
| [docs/ops-w01-handover.md](ops-w01-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/p01-handover.md](p01-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/p02-handover.md](p02-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/p03-handover.md](p03-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/p04-handover.md](p04-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/p05-handover.md](p05-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/p06-handover.md](p06-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/p07-a-handover.md](p07-a-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/physical-invariants.md](physical-invariants.md) | Fiziksel bütünlük ve kilit/indeks devri |
| [docs/production-queue.md](production-queue.md) | Yalnız aktif iş sırası |
| [docs/program-session-handover.md](program-session-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/remaining-work.md](remaining-work.md) | Açık iş ve kapanış ölçütlerinin tek sahibi |
| [docs/remote-backend-setup.md](remote-backend-setup.md) | Hosted/restore runbook ve tarihli işletim kanıtları |
| [docs/schedule-read-handover.md](schedule-read-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/settlement-handover.md](settlement-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/source-index.md](source-index.md) | Kaynak önceliği ve bilgi sahipliği |
| [docs/starter-attendance-protection-handover.md](starter-attendance-protection-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [docs/starter-plan-gates-handover.md](starter-plan-gates-handover.md) | Alan tüketim devri ve kaynağına bağlı eski kabul; güncel durum sahibi00 |
| [packages/api-contracts/README.md](../packages/api-contracts/README.md) | Ortak şema/üreteç/typed tüketim arayüzü |
| [docs/frontend-development.md](frontend-development.md) | Frontend araçları, hazır blok seçimi, iki dil ve doğrulama komutları |
| [apps/web/AGENTS.md](../apps/web/AGENTS.md) | Frontend dosya sahipliği ve hazır bileşen kuralları |

## Tarihsel dosyalar

[Arşiv manifesti](history/manifest.json) taşınan rapor/snapshotların tam envanteridir. Yeni kaynak bağlı inceleme raporları docs/history/reports altında kendi commit’ine ait kanıttır; bugünün durumunu takip etmez. İlk aktarım araçları artık build/test/CI tarafından çağrılmadığı için kaldırılmıştır; Git geçmişi ve immutable migration zinciri korunur.

## Bakım

Yeni yaşayan belge eklemeden önce mevcut sahibindeki bir bölümün yeterli olup olmadığını değerlendir. Dosya ekleme/silme/birleştirmede bu envanteri, kaynak indeksini ve inbound/outgoing bağlantıları aynı PR’da güncelle.04/05/feature-delivery üreteçten yenilenir. Tarihsel rapora güncel statü ekleme. Yalnız-belge kabulü bu tablodan otomatik türetilmez; ayrı incelenmiş tam yol listesine bağlıdır.
