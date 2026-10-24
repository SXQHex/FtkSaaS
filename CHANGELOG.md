# Changes

## 24 Ekim 2026 — backend/frontend ayar ayrımı ve eksik karar sırası

69 kabul grubunun alanları backend yapılandırması ile frontend ayarlarına ayrıldı; frontend için user/member/center/organization/platform kapsamları eşlendi. Sabit güvenlik/iş kuralları ve tekil domain komutları genel tercih ayarı sayılmadı. Eksik frontend seçimleri FD01–FD12 paketlerinde toplandı; FD01 değerleri onaylanmamış öneridir. Yeni sıra karar ayrımı/eksik seçimler tamamlandıktan sonra API/ekran teslimidir. Runtime veya default uygulanmadı.

## 24 Ekim 2026 — beş ayar ekranı teslim önceliği

Kullanıcı/üye/merkez/org/platform için ekran bölümleri ve doğrulanmış mevcut read-write/permission matrisi Claude devrine eklendi. Kullanıcı ve org üyeliği ayrıldı. SQL/Cron/DB/worker yönetim ayarları ertelendi; eski 208/60 taslağın UI ihtiyacını karşılamadığı kaydedildi. Eksik API ve sağlayıcı/ürün değerleri hazır gösterilmedi; runtime değişmedi.

## 24 Ekim 2026 — 69 ayar grubu davranış kapanışı

S11–S17, M01–M22, organizasyon O01–O21 ve platform P01–P09 kabulleri tek teknik sözleşmede birleştirildi; ilk S01–S10 korunur. Toplam 69 grup kabul edildi, somut alt alanlar açık. Eski Word aile numaraları, davranış grupları ve üretim P01–P08 ayrıldı. Kaynak indeksi, Claude talimatı, devir, kalan işler ve kuyruk güncellendi. PR42 aynı kaynak belge kabulü ve CD deploy skipped kanıtı kaydedildi. Yeni ana grup veya varsayılan icat edilmedi; runtime, DTO, migration, CI ve üretilmiş dosyalar değişmedi.

## 23 Ekim 2026 frontend başlangıcı ve settings karar eşitlemesi

P01–P07 kaynak/full-clean/main/development CD kapanışı güncel devir ve istemci talimatlarına aktarıldı:200 API/59 migration/Edge8. PR41 belge kabulü, gerçek runtime kabulü ve CD deploy skipped ayrıldı. Beş Cron temel kurulum/idle heartbeat ile3600sn quote/900sn reauth kullanıcı config'i kaydedildi; gerçek yük/fiziksel imha açık.

Settings sözleşmesi teknik sözleşmede Markdown olarak tek otoriteye alındı. On ayrı kabul edilmiş kullanıcı grubu; kalan aday U/C/O/P aileleri; mevcut API alanları ve yayımlanmamış settings taslakları ayrı gösterildi. P08 abone numarası/ortak CRM ve mevcut diğer geliştirmeler korundu. Claude başlangıç talimatları, kaynak önceliği, DTO/rol/zaman/secret/mock sınırları dosya bazında düzeltildi. Runtime, machine DTO, migration, üretilmiş paket ve CI politikası değişmedi; frontend tasarımına müdahale edilmedi.


## 2026-10-20 — P01 main ve CI kararı belge eşitlemesi

P01 PR #22 main 7577b2f1873c6b1fcf83390bfa94a34374c44082 ile birleşti: katalog/seans bağlamlı hak okuması, talep/alternatif/onay, bekleme/teklif/expiry ve dar sistem worker zinciri. 199/118/81 işlem; 34 migration. Son head hedefli 39325878582 ve aday 39327134872 başarılıdır; aynı main clean 39401570751 completed/success doğrulandı; P01 done. Geçici kabul varsayımı kaldırıldı.

CI-2026-10-20: bölüm boyunca Draft/development ve hedefli CI, bitince açık aday + merge sonrası main full clean; güvenli yalnız-belge farkına clean yerine belge kabulü; dört bağımsız backend/DB shard'ı. Karar kabul edildi, otomasyon CI-02'de bekliyor. Workflow/runtime/ürün davranışı bu belge tesliminde değiştirilmedi. Önceki sürüm notları tarihsel kayıttır.


## 0.2.0-rc.3 — 2026-10-16

Q-E02 supersedes the post-start operator cancellation blocker. Center cancellation fully removes linked event obligations, creates only unclaimed student credit, releases reservations and reverses consumed package rights at every existing event stage. Participant cancellation preserves existing package terms and has no monetary journal effect. Preview Effect adds reverse; generated clients and Claude integration notes are updated. Historical occurrence/attendance and unrelated debts remain intact. Actual-start/partial-occurrence classification is still an explicit open decision. No production deployment.


## 0.2.0-rc.2 — 2026-10-16

Implements accepted Q-E01 payment preparation against existing debt/collection/credit journals. Prepared paid registrations atomically register or commit a typed capacity_closed financial resolution. Prestart full operator cancellation reverses obligations and creates only unclaimed student credit; earlier discounts/refunds and explicit offsets/refunds do not duplicate claims. Adds service-only preparation read/write RPCs and activates the existing debt adjustment/student credit refund/offset contracts. Shared DTOs, examples and Claude handover updated. Started/partial event monetary cancellation remains blocked pending a separate product decision.

## Previous continuation — 2026-10-16

Clean acceptance is now one CI command with explicit local migration replay and empty-fixture checks. Race assertions inspect persisted balances, registrations, receipts, debt and allocations. Health JSON output is parsed during clean acceptance. Q-E01 is accepted but its schema/API/shared-type and financial acceptance transfer remains pending.

## 0.2.0-rc.1 — 2026-10-15

Persistent GitHub development branch, pinned CI/devcontainer and reproducible local Supabase stack. Verified Auth gateway creates domain UUIDv7 IDs and calls service-only named transaction RPCs. Identity, billing gates, shared entitlement pool, event save/read/preview/register/cancel/attendance/corrections and duty verification implemented for the explicitly listed runtime capabilities. Runtime schema validators are generated before execution. See docs/claude-handover.md for supported paths, acceptance evidence and unresolved product decisions.

## 0.1.0 / 2.2-tech.2

Historical static contracts, UUID/discipline schema transfer and private Q-D01 scope predicates. No operational endpoint claim for that snapshot.

RC3 temiz kabul: 124/124 test, 20/20 statik kontrol, sekiz migration, Node 24.19.0; reports/qe02-verification.json ve qe02-acceptance.log. PR/CI sonucu yalnız ilgili commit için geçerlidir.

