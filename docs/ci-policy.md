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

[Seçici](../scripts/ci/select-tests.mjs) açık `modules` kaynak–tüketici haritasını taşır. Yalnız isim benzerliği kullanılmaz. Diff, `origin/main` ile güncel head’in **merge-base’inden itibaren tüm branch değişiklikleridir**; böylece önceki commit işi iptal edildiğinde kapsam sonraki belge commit’inde kaybolmaz. Eksik git geçmişi/head uyuşmazlığı/eşlenmeyen yol tüm DB/API kapsamına düşer. Rename’in eski ve yeni yolu birlikte değerlendirilir; silinen kaynak da kapsamdadır.

| Örnek | Seçim |
|---|---|
| docs/remaining-work.md | CI seçici/kapı testleri + yaşayan Markdown bağlantıları; DB yok |
| tests/governance.test.mjs | Aynısı + npm run verify |
| database/instructor-earnings.sql | API acceptance, eğitmen hakedişi, hesaplaşma, program/seans ve Starter regresyonları + DB testleri/verify |
| database/cross-center-settlement.sql | API acceptance, hesaplaşma, hakediş, Starter + DB testleri/verify |
| tests/cross-center-settlement.test.mjs | İlgili suite + ortak API acceptance; verify/DB |
| contracts, üreticiler, ortak tipler, Auth/tenant, kernel/finans/hak, gateway, migration, test/CI altyapısı veya bilinmeyen dosya | Geniş güvenli DB/API kapsamı + verify |

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
