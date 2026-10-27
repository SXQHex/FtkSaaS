# Changes

## 27 Ekim — tek stüdyo kurulum ve sürümlü ürün adı adayı

Mevcut domain komutlarında tek oda40/5 kapasite, süreli/sınırsız satış→rezervasyon→hakedişsiz kapanış için bütünleşik native kabul eklendi.67 migration `product_versions.published_name` snapshotı ve mevcut ProductTerms.name okumasını sürüme bağlar; doğru disiplin ön ekiyle aynı ürüne yeni yayın yapılabilir, eski satış/sürüm/hak değişmez.213 API/90 core tablo korunur; aday/main/CD kabulü bekler.

## 27 Ekim 2026 — Starter plan kapıları kabulü ve belge kapanışı

PR56 normal merge main `ed747324f7d008b24103d4fd2eba503791c70a93`:213 callable API/0 contract_only/66 migration/90 core tablo. Starter kaynak ve100 öğrenci sınırları, tek oda, disiplin paket kapsamı/adı, CRM/etkinlik/personel/hakediş retleri ve eski receipt/preview denetimi kabul edildi. Pro→Starter açık sürümlü kaynak seçimiyle geçmiş/kesin rezervasyon/hak/finans korunur. Aday40419827224, aynı main40422823564 ve gerçek development CD40425584520 başarılı; hosted20/20, Edge21 ACTIVE/verify_jwt=true. [Kapanış kanıtları](docs/starter-plan-gates-handover.md). Güncel devir/kuyruk/durum belgeleri eşitlendi; tarihsel raporlar ve aşağıdaki eski sürüm kayıtları korunur. Bu kapanış bütün Starter yol haritası veya production kabulü değildir.

## 26 Ekim 2026 — hesap oturum ve TOTP güvenliği adayı

Beş kendi-hesap API’siyle212/64 aday: canlı session listesi, sürümlü etiket, seçili/current/others iptali ve refresh sonlandırma, değişmez güvenlik geçmişi, taze güçlü proof’la TOTP kaldırma köprüsü. Native JWT/session çift aal2 kontrolü eski aal1 erişimini engeller. Sağlayıcıdaki zayıf doğrudan factor kaldırma davranışı exact-factor kısa intent ve transactional fence ile sınırlandı; dar native doğrulama ve bağımsız kod incelemesi geçti; son kaynak/aday/main/CD kabulü bekler. Full/main scope/assertion/süre sınırları korunur.


## 26 Ekim 2026 — kullanıcı yazı ölçeği ve sabit bağlam

Aynı altı settings API’sine nullable font_scale ve startup_context eklendi; katalog2,20 user/46 toplam alan,44 writable. Yeni63. migration; önceki62 değişmedi. Sabit bağlam yetki vermez; kayıp erişimde read null, retry canlı denetimlidir. UI/başlangıç ekran-rol/kayıtlı filtre ve diğer69 grup kabulü ayrı kalır.


## 26 Ekim 2026 — izole restore sahiplik/izin kanıtı

PR48 aynı-main clean/CD kabulü kaydedildi. İki izole native Supabase stack’inde uygulama sahipliği/ACL/RLS,178 tablo/1.025 satır, aynı UUID/parola Auth→Edge, private Storage bayt aktarımı ve beş dedicated worker idle geri dönüşü doğrulandı. Hosted afet kurtarma/RPO/RTO açık; yeni runtime/API/migration veya rutin CI testi eklenmedi. Ayrı hosted dummy kurulum işi iptal edildi. Ayrıntı [geri dönüş kaydında](docs/remote-backend-setup.md#restore-20261026).


## 2026-10-25 — CLI2.122 ve ölçümlü shard dengesi adayı

Supabase CLI tam2.122.0 package/lock pin; aynı başarılı main40226464989 ölçümleriyle15 suite ağırlığı güncellendi. Dört shard/iki process içinde alfabetik kuyruk modeline göre sınırlı deterministik dengeleme; kaynak/attempt bağlı manuel ölçüm yenileme ve ek negatif CI politika regresyonları. Full/main scope, assertionlar, migration/API ve gateway değişmedi. Yeni süreler aday/main ölçümünden önce modeldir.

## 2026-10-25 — pilot operasyon ön koşulları adayı

62. migration worker role/session lookup ve rls_auto_enable EXECUTE sertleştirmesi. Mevcut beş scope44 alanın native read/write/replay matrisi; aynı orgda öğrenci satın alma→rezervasyon→eğitmen yoklama→hakediş→yönetici rapor regresyonu. İzole restore deneyi managed ACL nedeniyle başarısız; prototip bu teslimden çıkarıldı, restore kabulü açık. Bu kısmi aday tüm ayar alanları, kalıcı hosted pilot veya tam hosted restore kabulü değildir.

## 2026-10-25 — beş kapsamlı kapalı ayar API adayı

- Altı typed ayar işlemi; user/member/center/organization/platform kalıcılık, sürüm/receipt, reset preview/apply, kendi kapsam geçmişi ve alan destek kataloğu.
- Member tercihi org+hesap kimliğiyle sabit; eski notification API değişikliği aynı ayar sürümünü ilerletir. Yeni üye hatırlatma defaultu açık; mevcut bağlı üyelerin eski kapalı defaultu korunur. Pazarlama kapalı; consent ayrı.
- 60. yeni migration, private/RLS/service-only kapılar; domain/finans/politika/worker ayarlarına genel yazma yok. Henüz inceleme/gerçek Auth/aday/main/CD kabulü yok; main200/59 ve ayrı PR45 korunur.


## 25 Ekim 2026 — sözleşmeler arası karar/kaynak uzlaştırması

Son Google kayıt/giriş kabulü, Apple/Instagram login dışlaması ve reklam CRM kaynağı ayrımı işlendi. Aktif ürün metinlerinden nominal/maksimum farkı ve yeni default gibi duran30dk teklif fallback kaldırıldı; FD06 açık yapılandırma, standart negatif0 ve kulüp−2 korundu. PR45 son inceleme/aday başarı kanıtı mevcut main200/59 ve belge PR44'ten ayrıldı. Tarihsel raporlar/uygulanmış migration'lar değiştirilmedi; canlı default veya runtime yayımlanmadı.

## 25 Ekim 2026 — FD01–FD12 frontend kararları kabul edildi

User/member/center/organization/platform frontend seçimlerinin tamamı kullanıcı onayıyla kesinleştirildi; 69 ana gruba yeni grup eklenmedi. Standart negatif kredi limiti 0 ayrıca teyit edildi, mevcut kulüp −2 ve eski ayarlar korunur. İlk kapsam/ertelemeler, marka-login-MFA, bildirim zamanları, görünürlük, program/finans/belge/CRM, CSV/JSON, miras/reset ve yetki sınırları teknik sözleşmeye işlendi. Claude/kuyruk/kalan işler/devir eşitlendi. Runtime, DTO, migration, CI ve canlı default uygulanmadı.

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

