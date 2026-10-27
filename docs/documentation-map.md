# Markdown sahipliği ve saklama haritası

SSoT her bilgiyi tek sahibinde tutmaktır; bütün bilgiyi tek dev dosyada toplamak değildir. [Kaynak indeksi](source-index.md) önceliği, aşağıdaki tablo dosya rolünü belirler. Güncel sayı/SHA/CI/CD yalnız00 devirde, açık iş remaining-work’te, sıra production-queue’da güncellenir. Modül belgeleri teknik tüketim/DTO örneğini korur ve bu üç sahibine bağlanır.

## Konsolidasyon kararı

- AGENTS/README/indeks/devir/kuyruktaki kopya durum kronolojileri kaldırıldı; eski içerik kabul edilmiş af06a64 Git sürümünde korunur.
- docs/karar-sohbetine-Q-D01.md yalnız bağlantı köprüsüydü; doğrudan10 kabul kararına bağlanılır ve köprü silinir.
- docs/pr45-main-integration.md ve docs/pilot-readiness.md güncel runbook değildi; eşsiz eski ölçüm/başarısızlık kanıtları aynı dosya adıyla reports/ içine byte düzeyinde taşınır. Aktif bağlantılar gerçek bilgi sahibine gider.
- Kuyruktaki eşsiz P08 kararları decisions/P08-accepted-scope.md içine, kurulum snapshotları remote-backend-setup.md içine ayrıldı; ürün/operasyon bilgisi silinmedi.
- Mevcut reports/ ve contracts/source-v2.2/ değiştirilmedi. Üretilmiş04/05/feature-delivery elle düzenlenmez; runtime/DTO JSON ve üreteçler Markdown otoritesi değildir, kendi alanlarının kaynağıdır.
- saaspt frontend aktarımı bu hazırlığın dışında sonraki adımdır. Frontend göçünde kaynak SHA/hash izi ve uygulama/tasarım belgeleri bu haritaya eklenir; paralel backend devir ağacı kopyalanmaz.

## Dosya envanteri

| Dosya | Tek sorumluluk / saklama nedeni |
|---|---|
| [AGENTS.md](../AGENTS.md) | Çalışma kuralları ve yetki; güncel statü taşımaz |
| [CHANGELOG.md](../CHANGELOG.md) | Tarihsel değişiklik dizini; güncel statü değildir |
| [README.md](../README.md) | Repo girişi ve çalıştırma; otoritelere bağlantı |
| [contracts/00-FtkSaaS-yeni-sohbet-devir.md](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) | Güncel kabul/SHA/CI/CD/hosted durumun tek sahibi |
| [contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) | Normatif ürün kapsamı/plan davranışı |
| [contracts/02-FtkSaaS-teknik-sozlesme.md](../contracts/02-FtkSaaS-teknik-sozlesme.md) | Normatif teknik davranış/ayar kararları |
| [contracts/03-FtkSaaS-kodlama-sorumluluklari.md](../contracts/03-FtkSaaS-kodlama-sorumluluklari.md) | Kodlama ve değişiklik sorumlulukları |
| [contracts/04-FtkSaaS-O4-veri-semasi.md](../contracts/04-FtkSaaS-O4-veri-semasi.md) | Üretilmiş fiziksel şema kataloğu; DDL sahibi migration |
| [contracts/05-FtkSaaS-O4-API-katalogu.md](../contracts/05-FtkSaaS-O4-API-katalogu.md) | Üretilmiş API kataloğu; DTO sahibi08 JSON |
| [contracts/06-FtkSaaS-O4-durum-hata-izin.md](../contracts/06-FtkSaaS-O4-durum-hata-izin.md) | Durum/hata/izin semantik devri; wire sahibi08 JSON |
| [contracts/07-FtkSaaS-O4-denetim-ve-aciklar.md](../contracts/07-FtkSaaS-O4-denetim-ve-aciklar.md) | Tarihsel ilk tasarım denetimi |
| [contracts/09-FtkSaaS-teknik-aktarim-raporu.md](../contracts/09-FtkSaaS-teknik-aktarim-raporu.md) | Tarihsel teknik aktarım |
| [contracts/10-FtkSaaS-Q-D01-kabul-karari.md](../contracts/10-FtkSaaS-Q-D01-kabul-karari.md) | Kabul edilmiş Q-D01 karar kaydı |
| [contracts/11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md](../contracts/11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md) | Tarihsel Q-D01 aktarım raporu |
| [contracts/12-FtkSaaS-Q-E02-kabul-karari.md](../contracts/12-FtkSaaS-Q-E02-kabul-karari.md) | Kabul edilmiş Q-E02/Q-E03 karar kaydı |
| [docs/actual-start-handover.md](actual-start-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/api-invariants.md](api-invariants.md) | API bütünlük/tüketim değişmezleri |
| [docs/branch-protection-review.md](branch-protection-review.md) | Tarihsel koruma incelemesi; yönetici kurulum kanıtı değildir |
| [docs/ci-performance.md](ci-performance.md) | Kaynağına bağlı performans ölçümleri |
| [docs/ci-policy.md](ci-policy.md) | CI/kabul/clean süreci |
| [docs/ci02-handover.md](ci02-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/claude-handover.md](claude-handover.md) | İstemci protokolü ve entegrasyon tüketimi |
| [docs/decision-sprint-handover.md](decision-sprint-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
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
| [docs/documentation-map.md](documentation-map.md) | Markdown envanteri/saklama ve birleştirme kararı |
| [docs/feature-delivery.md](feature-delivery.md) | Üretilmiş özellik/operasyon haritası; kabul statüsü değil |
| [docs/frontend-settings-handover.md](frontend-settings-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/instructor-earnings-handover.md](instructor-earnings-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/monorepo.md](monorepo.md) | Repo/göç/paket yöneticisi ve ortam işletimi |
| [docs/ops-w01-handover.md](ops-w01-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/p01-handover.md](p01-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/p02-handover.md](p02-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/p03-handover.md](p03-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/p04-handover.md](p04-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/p05-handover.md](p05-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/p06-handover.md](p06-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/p07-a-handover.md](p07-a-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/physical-invariants.md](physical-invariants.md) | Kilit/indeks/fiziksel bütünlük devirleri |
| [docs/production-queue.md](production-queue.md) | Yalnız aktif sıra; backlog veya durum kopyası yok |
| [docs/program-session-handover.md](program-session-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/remaining-work.md](remaining-work.md) | Açık iş ve kapanış ölçütlerinin tek sahibi |
| [docs/remote-backend-setup.md](remote-backend-setup.md) | Hosted runbook ve tarihli işletim/restore kayıtları |
| [docs/schedule-read-handover.md](schedule-read-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/settlement-handover.md](settlement-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/source-index.md](source-index.md) | Kaynak önceliği ve bilgi sahipliği |
| [docs/starter-attendance-protection-handover.md](starter-attendance-protection-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [docs/starter-plan-gates-handover.md](starter-plan-gates-handover.md) | Alan tüketim devri ve kaynağına bağlı geçmiş kabul; statü sahibi00 |
| [reports/account-identity-progress-20261026.md](../reports/account-identity-progress-20261026.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/account-security-native-20261026.md](../reports/account-security-native-20261026.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/cancellation-race-review.md](../reports/cancellation-race-review.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/decision-sprint-review.md](../reports/decision-sprint-review.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/pilot-readiness.md](../reports/pilot-readiness.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/pr45-main-integration.md](../reports/pr45-main-integration.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/qe02-review.md](../reports/qe02-review.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/session-capacity-independent-review.md](../reports/session-capacity-independent-review.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/settlement-center-scope-review.md](../reports/settlement-center-scope-review.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/settlement-revision-review.md](../reports/settlement-revision-review.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/starter-onboarding-20261027.md](../reports/starter-onboarding-20261027.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/starter-plan-gates-20261026.md](../reports/starter-plan-gates-20261026.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/starter-plan-gates-role-read-ci-fix-20261027.md](../reports/starter-plan-gates-role-read-ci-fix-20261027.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/starter-plan-gates-takeover-20261027.md](../reports/starter-plan-gates-takeover-20261027.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |
| [reports/starter-studio-20261027.md](../reports/starter-studio-20261027.md) | Değiştirilmeyen tarihsel kaynak/kanıt; yaşayan iş listesi değil |

| [reports/monorepo-preparation-20261027.md](../reports/monorepo-preparation-20261027.md) | Değiştirilmeyen tarihsel hazırlık/yerel doğrulama kanıtı; güncel statü değil |

| [reports/monorepo-preparation-ci-fix-20261027.md](../reports/monorepo-preparation-ci-fix-20261027.md) | İlk hedefli CI hatası ve tarihsel snapshot bağlam düzeltmesi |

## Bakım

Yeni yaşayan belge eklerken önce mevcut sahibinde bir bölümün yeterli olup olmadığını değerlendir. Dosya ekleme/silme/birleştirmede bu envanteri, kaynak indeksini ve inbound/outgoing anchor bağlantılarını aynı PR’da güncelle. Belge kontrolü silinen hedef ve bulunmayan başlıkları reddeder. Tarihsel rapor içeriklerine güncel statü ekleme; eski modül pending notları görev üretmez. Yalnız-belge CI istisnası bu haritadan otomatik türetilmez; ayrı incelenmiş tam yol listesine bağlıdır.
