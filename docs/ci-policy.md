# CI çalışma politikası — 19 Ekim 2026

Son kullanıcı talimatı eski her commit/PR güncellemesinde tam temiz kabul kuralının yerini alır. Ürün, runtime, migration, frontend ve deployment davranışı değişmez.

## Tetikleyiciler ve kapsam

| Olay | İş | İptal politikası |
|---|---|---|
| Main dışı branch push | Development targeted: selector testleri, yaşayan belge/bağlantı kontrolü; gerekiyorsa verify ve seçilen DB/API regresyonları | Aynı branch’in eski hızlı işi iptal; diğer branch’ler ayrı |
| PR açılışı/güncellemesi | Ucuz güvenilir merge-kapısı kontrolü; otomatik full clean yok | PR başına değerlendirme; pahalı test tetiklemez |
| Hazır adaya `ci:full-clean` label’ının **eklenmesi** | Candidate full clean: güncel head + base birleşimi üzerinde tam test:clean | PR/head grubu; başka PR/main etkilenmez |
| Main push | Tam temiz kabul ve test edilen birleşim–gerçek merge ilişkisi | Her main SHA ayrı; çalışan kabul iptal edilmez |

Label’ın sürekli durması başarı veya yeni head’e kabul vermez. Tekrar kabul için label kaldırılıp yeniden eklenir. Aynı kaynakta push hedefli test, label son aday full çalıştırır; PR açılışı/synchronize ikinci pahalı kopya başlatmaz. Eski settlement-focused workflow kaldırılmıştır. Başka label’lar full-clean job’unu atlayabilir; atlanmış job merge kapısını açmaz.

## Denetlenebilir seçim

[Seçici](../scripts/ci/select-tests.mjs) açık `modules` kaynak–tüketici haritasını taşır. Yalnız isim benzerliği kullanılmaz. Diff, `origin/main` ile güncel head’in **merge-base’inden itibaren tüm branch değişiklikleridir**; böylece önceki commit işi iptal edildiğinde kapsam sonraki belge commit’inde kaybolmaz. Eksik git geçmişi/head uyuşmazlığı/eşlenmeyen yol tüm DB/API kapsamına düşer. Bilinen modülün sözleşme/üretilmiş çıktı/migration farkı aşağıdaki kaynak kanıtıyla açıklanabiliyorsa bütün API dosyaları yerine o modül ve ortak Auth/hak regresyonu seçilir. Rename’in eski ve yeni yolu birlikte değerlendirilir; silinen kaynak da kapsamdadır.

| Örnek | Seçim |
|---|---|
| docs/remaining-work.md | CI seçici/kapı testleri + yaşayan Markdown bağlantıları; DB yok |
| tests/governance.test.mjs | Aynısı + npm run verify |
| database/instructor-earnings.sql | API acceptance, eğitmen hakedişi, hesaplaşma, program/seans ve Starter regresyonları + DB testleri/verify |
| database/cross-center-settlement.sql | API acceptance, hesaplaşma, hakediş, Starter + DB testleri/verify |
| tests/cross-center-settlement.test.mjs | İlgili suite + ortak API acceptance; verify/DB |
| P01-A okuma SQL + ona bağlı sözleşme/tip/bundle/envanter ve birebir kaynak+wrapper yeni migration | Önce p01-catalog-entitlement-reads; geçerse api-acceptance; DB + verify |
| Açıklanamayan sözleşme/tip/bundle/migration; çalışma zamanı üreticileri; Auth/tenant, kernel/finans/hak, handler; bilinmeyen kaynak | Geniş güvenli DB/API kapsamı + verify |
| Bilinen seçici/runner ve yalnız belge üreten render_catalogs.py | Seçici/runner negatif testleri + verify; diğer değişiklikler ayrıca seçilir |

### Bilinen modülün kaynak farkı kanıtı — 19 Ekim 2026 düzeltmesi

[delta-analysis.mjs](../scripts/ci/delta-analysis.mjs) aynı merge-base/head git snapshot'larını okur. $defs referanslarının eski ve yeni transitive tüketicileri bulunur; her etkilenen operasyon açık modül haritasında yoksa geniş kapsam korunur. Paylaşılan izin/sözleşme kökü/tablo tipi veya eski/yeni kalıcı tablodan dolaylı erişilen tanım değişimi daraltılmaz. Yeni migration yalnız A durumunda, base'te yokken ve içeriği bilinen SQL+wrapper ile birebir eşleşirken açıklanır. Eski migration veya hash değişimi, tanınmayan kardeş dosya ve silme/rename geniş geri dönüşü korur. Migration manifesti yalnız aynı eşlenmiş eklemeleri içerebilir; gerçek tüm SHA-256 değerleri zorunlu check-migrations kontrolünde ayrıca doğrulanır.

Üretilmiş dosya adı tek başına gerekçe değildir: bilinen modül kaynağı/operasyon farkı gerekir; generation/schema/TypeScript kontrolleri API testinden önce geçmelidir. Yalnız package.json test:api envanterine eşlenmiş suite eklemesi dar açıklamadır; dependency, runner flag, test silme veya başka komut değişimi geniştir. Handler/çalışma zamanı üreticileri ve bilinmeyen yollar geniş kalır. Yeni üretim modülü eşlemesi yapılmadıysa ucuz kabul varsayılmaz.

Değişen modül/ilgili test dosyaları öncelikli fazda çalışır; başarısızsa ertelenmiş regresyonlar başlatılmaz ve job başarısız kalır. Başarılı faz bütün seçilmiş kalan testleri tam bir kez çalıştırır. Bu fazlama kabul testlerini eksiltmez; tam aday/main clean bütün envanteri çalıştırmaya devam eder. Bu düzeltme workflow tetikleyicilerini, paralellik=2 sınırını ve kaynak bağlı merge kapısını değiştirmez.

CI özeti her dosyanın gerekçesini ve seçilen bütün suite’leri yazar. Test listesi package.json test:api listesiyle birebir denetlenir. Hedefli DB yolu ayrı hosted runner’da native backend başlatır, loopback dışında reseti reddeder, bütün migration’ları ve boş tenant/Auth/receipt durumunu doğrular. Önceki job’dan veri veya DB cache’i kullanılmaz. Full clean ayrıca seed, sağlık ve advisors içerir; hedefli kabul full yerine sunulmaz.

## Kaynak bağlı merge kapısı

Gerekli durum adı `ftksaas/merge-clean`dir. Trusted verifier yalnız main kodunu çalıştırır; aday kodunu, arşivden scripti veya artifact executable’ını çalıştırmaz. Aday test job’u read-only token/persist-credentials:false ile çalışır. Artifact yalnız veri olarak okunur; tek başına kabul değildir.

Doğrulama: gerçek workflow yolu/event’i, run/attempt, başarılı `full-clean` job’u ve gerçek test adımları; PR numarası/head/base; test edilen merge SHA’sının iki parent’ı ve tree’si; güncel birleşim tree’si; candidate full workflow dosyasının güvenilir base ile aynı blob olması. Güncel head/base status yazılmadan tekrar okunur. Head veya base değişimi eski kabulü reddeder. Main push açık PR kapılarını yeniden değerlendirir. Başarısız/yarım son deneme güvenli ret üretir; aynı kaynak için eski başarıya sessiz fallback yapılmaz, label yeniden tetiklenir.

Workflow politikasını değiştiren PR güvenilir base’le aynı full workflow blob’una sahip olmayacağından otomatik kapı açamaz. İlk kurulum ve sonraki full-workflow politika değişimleri ayrı bağımsız inceleme + açık son aday clean kanıtıyla yönetilen **güvenilir politika kurulumu** gerektirir; sıradan PR için istisna/fallback yoktur. İlk CI PR’sinde yeni workflow_run/PR_target tanımları henüz main’de bulunmadığından otomatik trusted status varmış gibi gösterilmez. Bu PR’nin bağımsız incelemesi, tam aday kabulü ve yönetici sınırı açık raporlanır; mevcut required check bypass edilmez.

Yönetici, GitHub Actions kaynaklı bu status’u zorunlu, base güncelliğini **strict**, PR incelemesini zorunlu ve bypass/direct push’u kapalı tutmalıdır. Yalnız asenkron status invalidasyonu merge yarışını engellemeye yetmez. Yetki API’si 403 verdiği için bu ayarların uygulanması/doğrulanması açık yönetici işidir. [Koruma durumu](branch-protection-review.md).

Merge için normal iki-parent merge commit kullanılır. Main kontrolü artifact’in tested tree’sini actual merge tree’siyle ve parent’larla karşılaştırır; squash/rebase için aynı kanıt otomatik taşınmaz. Sonra main full clean çalışır. Production dağıtım izni değildir.

## Ölçüm ve performans sınırı

[Ölçüm değerlendirmesi](ci-performance.md) eski logların sayısal temelini ve ölçülmemiş alanları ayırır. `FTK_TEST_TIMINGS=1`, yalnız test helper’ında API operation/Auth/fixture toplam–maksimum sürelerini, sayıları ve suite process wall süresini kaydeder. Body, token, e-posta, kişi/tenant kimliği kaydedilmez. İstek başlığına kadar süre ayrıca belirtilir; API/fixture süresi body decode’u kapsar; iç içe süreler toplanıp toplam duvar süresi diye sunulmaz.

Mevcut test-concurrency=2 korunur. Ortak PostgreSQL üzerinde global trigger/function kuran fixture’lar vardır; daha fazla paralellik veya paylaşılan DB shard’ı eklenmedi. İleride shard ancak her shard’a ayrı backend/DB ve suite envanterinin kayıpsız bölündüğünün doğrulanmasıyla değerlendirilebilir.

## Full clean sırasında kullanıcıya devir — 19 Ekim 2026 son talimatı

Bu kural önceki otomatik devam/CI izleme talimatlarını yalnız bekleme davranışı bakımından değiştirir; merge için başarılı kabul şartını kaldırmaz.

- Aday veya main full clean tetiklendiği/çalışmaya başladığı doğrulanınca run URL/ID, head SHA, base SHA ve test edilen merge SHA (uygunsa), PR, kuyruk adımı ve sonraki eylemi son durum mesajında paylaş; turu bitir.
- Full clean bitene kadar polling, sleep/wait döngüsü, log takibi, gh run watch, tarayıcı yenileme, hatırlatıcı/otomasyon veya arka planda izleyici başlatma. Aynı clean'i tekrar tetikleme. Kullanıcı sonucu getirene kadar üretim/merge devamını durdur.
- Tetikleme yanıtında run URL henüz yoksa workflow/PR/head ve tetikleme zamanını kaydet; bekleyerek run arama. Kullanıcı dönüşünde eşleştir.
- Kullanıcı “clean bitti/başarılı” dediğinde yeniden çalışmaya başla; bildirimi tek başına başarı kanıtı sayma. GitHub'dan o run'ın durumunu/sonucunu, güncel head/base ve kaynak bağlı kabulü bir kez doğrula.
- Run hâlâ çalışıyorsa yeniden izlemeye geçme; durumunu bildir ve turu bitir. Başarısızsa ilgili hatayı incele, odaklı düzeltme yap; kaynak değişince eski clean'i yeni kaynağa taşıma.
- Aday kabulü ve inceleme geçerliyse mevcut yetki kapsamında merge et. Main clean başlarsa yeniden aynı kullanıcıya devir kuralını uygula; main kabulü doğrulanmadan işi tamamlandı sayma.
- CI kendi kendine çalışmaya devam eder; duracak olan Work ajanının aktif izlemesidir. Bu talimat workflow iptal etme veya testleri atlama talimatı değildir.

Aktif teslim ve devam noktası [üretim kuyruğunda](production-queue.md) tutulur.
