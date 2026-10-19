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

## Action runtime bakım adayı — 19 Ekim 2026

Son hedefli run 39281409902 / P01 head 580239075b16f6ac6893d5ac01975d32133d0757 logları 96 sözleşme/yönetişim, 23 CI politika, 27 DB ve 51 API testini başarılı gösterdi. Bu branch dışındaki P01 kaynak kanıtıdır; main kabulü değildir. Önceki Auth/kota assertion hataları bu kaynakta geçmiştir. Geriye kalan Annotations warning'i checkout/setup-node Action'larının Node 20 hedeflemesidir; uygulamanın node-version:24.19.0 ayarı Action'ın kendi runtime'ını değiştirmez.

Bakım branch'i maintenance/actions-node24, main 9ce0a5639417f959111b11f70157156733e3de18 tabanındadır. Ürün/runtime değişikliği içermez. Main'deki aynı saat bağımlı ortak kota fixture'ının düzeltmesi P01 PR'sinden birebir alınır; CI bakımının full clean'i bilinen mevcut fixture hatasında boşa çalıştırılmaz. Yeniden ürün uygulaması yapılmaz. Dört workflow'da yalnız Node 20 Action bağımlılıkları Node 24 kullanan resmi sürümlerin değişmez commit SHA'larına yükseltilir:

| Action | Resmi sürüm | Yeni commit | Runtime |
|---|---|---|---|
| checkout | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | 3d3c42e5aac5ba805825da76410c181273ba90b1 | node24 |
| setup-node | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | 949feb2413d6458794dcd2491c4babbbce0c15c1 | node24 |
| upload-artifact | [v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | cf430e030ddbb5b0abf93d22962f4752f3646cd9 | node24 |

Her resmi tag'in commit'i ve action.yml runs.using değeri doğrulandı. Mevcut github-script ed597411d8f924073f98dfc5c65a23a2325f34cd zaten node24; gereksiz major yükseltmesi yapılmadı. Checkout persist-credentials:false, uygulama Node24.19.0, npm cache, event/permissions/concurrency/test komutları ve gate/binding kodu korunur. upload-artifact v7'nin varsayılan archive:true davranışı açık yazılır; gizli .ci/binding.json, candidate-binding adı ve ZIP receipt uyumu korunur. Uyarı gizleme veya FORCE_* ortam bayrağı yoktur.

ci-full.yml blob'u değiştiği için mevcut güvenilir base denetimi bakım PR'sinin otomatik ftksaas/merge-clean kabulünü reddedecektir. Bu beklenen güven sınırıdır: bağımsız son-head incelemesi ve gerçek aday clean çalıştırılır; normal kabul/merge veya güvenilir politika kurulumunun tamamlandığı iddia edilmez. Gate gevşetilmez, başarı status'u elle yazılmaz, required check bypass edilmez ve repository yönetim ayarı değiştirilmez. Yeni runtime/annotation sonucu ve main kabulü henüz bekler.
