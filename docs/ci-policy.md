# CI çalışma politikası — 20 Ekim 2026

CI-02 PR25 kullanıcı onayıyla main a0325d7 kaynağına kuruldu. Aday39412474187 başarılı; main39421388153 yalnız ölçüm toplayıcısında skipped optional serial job nedeniyle başarısız. Dar düzeltme ve yeni kabul bekliyor; belge kabulü/full clean veya required job kapısı gevşetilmez.

## CI-02 belge kabulü dilimi — kurulum bekliyor

Yeni politika kodu ayrı dalda uygulanıyor; main yeni kapıyı kullanır; main kabulü ölçüm düzeltmesini bekler. İncelenmiş tam belge yolları + normal dosya modu zorunlu; makine/envanter/tip/workflow/dependency ve bilinmeyen yollar kapalıdır. Renderer yalnız üç açıklama paragrafının AST string sabitleri değişirse belge sayılır; ifade, import, fonksiyon, emit ve envanter mantığının tamamı aynı kalmalıdır. PR24 bu dar kanıtı sağlar. Belge kabulü `npm run verify` ve bütün yaşayan inbound/outgoing bağlantıları denetler; full clean değildir.

Yeni kaynakta açık `backend.yml` workflow_dispatch + exact `merge_sha`, geçmiş belge merge’ini iki gerçek parent/tree ve birikimli base–head sınıflandırmasıyla ayrıca denetler; salt okuma izinlidir, eski başarısız run/status değiştirilmez. Bu kurtarma kanıtı normal aday proof’un yerine genel fallback değildir. Sonraki belge PR’leri ayrı candidate receipt ve actual main ilişkisi gerektirir. Push main tüm açık PR kapılarını yeniden değerlendirir.

Cleanup ancak start denenmiş ve CLI mevcutsa çalışır. Draft/development aday/merge kapısı kapalıdır; durumdan çıkış kendiliğinden full clean değildir.

## CI-02 dört shard dilimi

[CI-02 devri](ci02-handover.md) güncel uygulama ve açık kabul kaynağıdır. core + api-1…4 ayrı runner/backend/DB kullanır; full-clean toplayıcısı gerçek job/step, head/run/attempt ve coverage kanıtı ister. Aday/main aynı reusable workflow kapsamındadır. Açık ci:measure-serial aynı kaynakta karşılaştırma ekler; istenmişse zorunlu sonuçtur. Eksik/skipped/failure ve önceki attempt karışımı kapalıdır. CI-only hedefli seçim yalnız sonlu incelenmiş harness + kaynak bağlı güvenli belge farkı için verify/politika negatiflerine iner; karma/bilinmeyen fark daraltılmaz.

## Son karar ve uygulama sınırı

[CI-2026-10-20](decisions/CI-2026-10-20.md) kabul edilmiş hedeftir; **CI-02 PR25 uygulandı; hedefli/aday/main ve güvenilir kurulum kabulü bekliyor**. Önceki PR24 belge eşitlemesi workflow/gate değiştirmedi; PR25 aşağıdaki yeni uygulamayı getirir. P01 PR #22 birleşmiştir; durum/kanıt [güncel devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md). Yeni politika önceki her-main-clean ve tek PR'ye özgü belge istisnasını belirtilen kapsamda değiştirir; uygulanmamış kontrol etkin gösterilmez.

| Olay/durum | Kabul edilmiş hedef | Main 7577b2f uygulaması |
|---|---|---|
| Bölüm geliştirmesi | Tek Draft + development PR; birikimli hedefli CI | Hedefli CI var; Draft/development engeli CI-02'de |
| Push / PR güncellemesi / Draft veya development kaldırma | Otomatik full clean yok | Push hedefli, PR ucuz kapı; durum geçişi clean değildir |
| Draft veya development üstünde aday isteği | Clean ve merge kabulü engelli | Yeni engel CI-02'de |
| Hazır runtime/CI adayı | ci:full-clean eklenmesiyle bütün kapsam, dört bağımsız shard | Açık label ile tek full-clean job'u; shard yok |
| Runtime/CI merge'i | Aynı main SHA'sında bütün kapsam, dört bağımsız shard | Main tek clean job'u çalıştırır |
| Güvenli yalnız-belge PR/merge | Belge kabulü; aday/main full clean yok | Hedefli belge yolu var; genel belge merge/main kabulü CI-02'de |
| Karma/bilinmeyen/runtime girdisi | Belge istisnası yok; birikimli kod kapsamı korunur | Mevcut güvenli geniş geri dönüş korunur |

Aynı branch'in eski hızlı işi iptal edilir; farklı PR'ler ve her main SHA ayrı gruptadır. Label'ın sürekli bulunması yeni kabul vermez; skipped job başarı değildir. Head/base değişimi kaynak kanıtını düşürür. Geçişte eski kapı bypass edilmez; yeni belge kabulü ve shard toplayıcısı güvenilir politika kurulumunda doğrulanır.

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

Değişen modül/ilgili test dosyaları öncelikli fazda çalışır; başarısızsa ertelenmiş regresyonlar başlatılmaz ve job başarısız kalır. Başarılı faz bütün seçilmiş kalan testleri tam bir kez çalıştırır. Bu fazlama kabul testlerini eksiltmez; runtime/CI aday ve main clean bütün envanteri çalıştırmaya devam eder. Bu düzeltme workflow tetikleyicilerini, paralellik=2 sınırını ve kaynak bağlı merge kapısını değiştirmez.

CI özeti her dosyanın gerekçesini ve seçilen bütün suite’leri yazar. Test listesi package.json test:api listesiyle birebir denetlenir. Hedefli DB yolu ayrı hosted runner’da native backend başlatır, loopback dışında reseti reddeder, bütün migration’ları ve boş tenant/Auth/receipt durumunu doğrular. Önceki job’dan veri veya DB cache’i kullanılmaz. Full clean ayrıca seed, sağlık ve advisors içerir; hedefli kabul full yerine sunulmaz.

P01-B talep SQL/sözleşme ve birebir migration farkı talep suite'i, katalog/hak okuması ve ortak API regresyonunu seçer. Paylaşılan management_state_get_v1 modüle bütünüyle sahiplenilmez: yalnız talep selector/projection ekleri, değişmeyen diğer alan/required/izin/selector hükümleri kanıtlanırsa dar seçim yapılır. İlgisiz management değişikliği geniş geri dönüş verir; pozitif ve negatif CI testleri bunu denetler.

## Kaynak bağlı merge kapısı

Gerekli durum adı `ftksaas/merge-clean`dir. Trusted verifier yalnız main kodunu çalıştırır; aday kodunu, arşivden scripti veya artifact executable’ını çalıştırmaz. Aday test job’u read-only token/persist-credentials:false ile çalışır. Artifact yalnız veri olarak okunur; tek başına kabul değildir.

Doğrulama: gerçek workflow yolu/event’i, run/attempt, başarılı `full-clean` job’u ve gerçek test adımları; PR numarası/head/base; test edilen merge SHA’sının iki parent’ı ve tree’si; güncel birleşim tree’si; candidate full workflow dosyasının güvenilir base ile aynı blob olması. Güncel head/base status yazılmadan tekrar okunur. Head veya base değişimi eski kabulü reddeder. Main push açık PR kapılarını yeniden değerlendirir. Başarısız/yarım son deneme güvenli ret üretir; aynı kaynak için eski başarıya sessiz fallback yapılmaz, label yeniden tetiklenir.

Workflow politikasını değiştiren PR güvenilir base’le aynı full workflow blob’una sahip olmayacağından otomatik kapı açamaz. İlk kurulum ve sonraki full-workflow politika değişimleri ayrı bağımsız inceleme + açık son aday clean kanıtıyla yönetilen **güvenilir politika kurulumu** gerektirir; sıradan PR için istisna/fallback yoktur. İlk CI PR’sinde yeni workflow_run/PR_target tanımları henüz main’de bulunmadığından otomatik trusted status varmış gibi gösterilmez. Bu PR’nin bağımsız incelemesi, tam aday kabulü ve yönetici sınırı açık raporlanır; mevcut required check bypass edilmez.

Yönetici, GitHub Actions kaynaklı bu status’u zorunlu, base güncelliğini **strict**, PR incelemesini zorunlu ve bypass/direct push’u kapalı tutmalıdır. Yalnız asenkron status invalidasyonu merge yarışını engellemeye yetmez. Yetki API’si 403 verdiği için bu ayarların uygulanması/doğrulanması açık yönetici işidir. [Koruma durumu](branch-protection-review.md).

Merge için normal iki-parent merge commit kullanılır. Main kontrolü artifact’in tested tree’sini actual merge tree’siyle ve parent’larla karşılaştırır; squash/rebase için aynı kanıt otomatik taşınmaz. Sonra main full clean çalışır. Production dağıtım izni değildir.

## Ölçüm ve performans sınırı

[Ölçüm değerlendirmesi](ci-performance.md) eski logların sayısal temelini ve ölçülmemiş alanları ayırır. `FTK_TEST_TIMINGS=1`, yalnız test helper’ında API operation/Auth/fixture toplam–maksimum sürelerini, sayıları ve suite process wall süresini kaydeder. Body, token, e-posta, kişi/tenant kimliği kaydedilmez. İstek başlığına kadar süre ayrıca belirtilir; API/fixture süresi body decode’u kapsar; iç içe süreler toplanıp toplam duvar süresi diye sunulmaz.

PR25 ile dört izole shard main’de kuruludur; ana dal kabulü henüz tamamlanmadı. Mevcut test-concurrency=2 korunur. Ortak PostgreSQL üzerinde global trigger/function kuran fixture’lar nedeniyle CI-02 dört ayrı runner/backend/DB kullanacaktır. Suite envanterinin eksiksiz ve tekrarsız bölünmesi, bütün clean yükümlülükleri ve kaynak bağlı toplayıcı zorunludur. Aday/main aynı kapsamı kullanır; ölçülmemiş hız kazancı vaat edilmez.

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

## Tarihsel Action runtime bakım kaydı — 19 Ekim 2026

Son hedefli run 39281409902 / P01 head 580239075b16f6ac6893d5ac01975d32133d0757 logları 96 sözleşme/yönetişim, 23 CI politika, 27 DB ve 51 API testini başarılı gösterdi. Bu branch dışındaki P01 kaynak kanıtıdır; main kabulü değildir. Önceki Auth/kota assertion hataları bu kaynakta geçmiştir. Geriye kalan Annotations warning'i checkout/setup-node Action'larının Node 20 hedeflemesidir; uygulamanın node-version:24.19.0 ayarı Action'ın kendi runtime'ını değiştirmez.

Bakım branch'i maintenance/actions-node24, main 9ce0a5639417f959111b11f70157156733e3de18 tabanındadır. Ürün/runtime değişikliği içermez. Main'deki aynı saat bağımlı ortak kota fixture'ının düzeltmesi P01 PR'sinden birebir alınır; CI bakımının full clean'i bilinen mevcut fixture hatasında boşa çalıştırılmaz. Yeniden ürün uygulaması yapılmaz. Dört workflow'da yalnız Node 20 Action bağımlılıkları Node 24 kullanan resmi sürümlerin değişmez commit SHA'larına yükseltilir:

| Action | Resmi sürüm | Yeni commit | Runtime |
|---|---|---|---|
| checkout | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | 3d3c42e5aac5ba805825da76410c181273ba90b1 | node24 |
| setup-node | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | 949feb2413d6458794dcd2491c4babbbce0c15c1 | node24 |
| upload-artifact | [v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | cf430e030ddbb5b0abf93d22962f4752f3646cd9 | node24 |

Her resmi tag'in commit'i ve action.yml runs.using değeri doğrulandı. Mevcut github-script ed597411d8f924073f98dfc5c65a23a2325f34cd zaten node24; gereksiz major yükseltmesi yapılmadı. Checkout persist-credentials:false, uygulama Node24.19.0, npm cache, event/permissions/concurrency/test komutları ve gate/binding kodu korunur. upload-artifact v7'nin varsayılan archive:true davranışı açık yazılır; gizli .ci/binding.json, candidate-binding adı ve ZIP receipt uyumu korunur. Uyarı gizleme veya FORCE_* ortam bayrağı yoktur.

ci-full.yml blob'u değiştiği için mevcut güvenilir base denetimi bakım PR'sinin otomatik ftksaas/merge-clean kabulünü reddedecektir. Bu beklenen güven sınırıdır: bağımsız son-head incelemesi ve gerçek aday clean çalıştırılır; normal kabul/merge veya güvenilir politika kurulumunun tamamlandığı iddia edilmez. Gate gevşetilmez, başarı status'u elle yazılmaz, required check bypass edilmez ve repository yönetim ayarı değiştirilmez. Yeni runtime/annotation sonucu ve main kabulü henüz bekler.

### Bakım kurulumu ve main kabulü tamamlandı

PR #23, kullanıcı tarafından açıkça onaylanan tek seferlik güvenilir workflow kurulumu olarak normal merge API'siyle 24007212005d07938fb1265a9f42891f18d7fa09 SHA'sına alındı. Aday full clean 39282766184 / eab732f17d0e2955fb88c5e46354c785da89d845 / base9ce0a5639417f959111b11f70157156733e3de18 başarılıydı: 409 test, sıfır aday annotation warning/error; aday tree2b7a76e73ca1e2efd201b0d9a18bea4afe12007b gerçek merge ile aynıydı. [Main clean 39298247595](https://github.com/SXQHex/FtkSaaS/actions/runs/39298247595) Verify merged candidate relation ve test:clean ile 409 testi geçti; main'de de sıfır annotation warning/error. Önceki bakım adayı kurulum engeli kapanmıştır.

Repository ayarları ve required-check bypass kullanılmadı; gate kodu veya kaynak bağı zayıflatılmadı, sahte status yazılmadı. Tek seferlik kullanıcı yetkisi yeni workflow değişiklikleri veya P01 runtime'ı için otomatik istisna değildir. Güncel main'le aynı ci-full.yml blob'u taşıyan P01 son adayı normal kaynak bağlı kabul kapısından geçer; yeni head/base için eski clean geçerli sayılmaz.

