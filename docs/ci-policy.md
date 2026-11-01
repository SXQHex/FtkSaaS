# CI çalışma politikası

Bu bölüm kullanıcının 28 Ekim 2026 sadeleştirme kararını tarif eder; önceki otomatik targeted, etiketle aday clean ve merge sonrası test tekrarı hükümlerinin yerini alır. Kurulum/kabul durumu yalnız [00 devirde](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [backlog’da](../apps/backend/docs/remaining-work.md) tutulur. Geçmiş koşular yeni kaynak için kanıt değildir.

## Olaylar ve kabul

| Olay | Gerekli işlem |
|---|---|
| Main tabanlı PR açma, kaynak güncelleme, yeniden açma veya main’e retarget | `Backend CI` önce base→head tam ağaç farkını sınıflandırır. Backend/shared kapsamda olayın sabit merge SHA’sında core + dört API shard + toplayıcı; saf belgede yalnız belge kontrolü; frontend-only kapsamda backend testi yok. |
| Draft PR | Aynı otomatik test kapsamı çalışabilir; merge kapısı kapalıdır. Hazır duruma geçiş testleri tekrar başlatmaz, mevcut kaynak kanıtını değerlendirir. `development` etiketi artık test/merge kontrolü değildir. |
| PR başlığı/açıklaması/etiketi | Test tetiklemez; GitHub `edited` olayını retarget ile ortak ilettiği için başlık/açıklama olayının workflow zarfı görünebilir, bütün işler atlanır. Eski `ci:full-clean` ve `ci:measure-serial` etiketlerinin kabul yetkisi yoktur. |
| PR dışındaki branch push | Otomatik backend testi yok. |
| Main merge | `Main acceptance` gerçek merge parent/tree ve adayın başarılı run/attempt/job kanıtını doğrular. Aynı full clean veya belge testini tekrarlamaz. |
| Main kabulü tamamlandı | `Development delivery` yalnız doğrulanmış backend kabulünü development ortamına taşır ve hosted kontrolleri çalıştırır. Production yetkisi yoktur. |
| Manuel tanı | `Manual targeted`, yalnız main’den seçilen tam `base_sha`→`tested_sha` aralığını test eder; merge/full/main kabulü veya status üretmez. |

Metadata olayları ayrı concurrency grubundadır; çalışan veya bekleyen kaynak full clean’ini iptal edemez. Aynı PR’nin eski kaynak koşusu iptal edilir; farklı PR ve main kabulü birbirini kesmez. Otomatik PR testinden önce ayrıca targeted koşulmaz. Base retarget gerçek yeni kabul gerektirir; başlık/açıklama/etiket olayları full clean yaratmaz. Yetkili merge doğrulayıcısı kaynak sonucu tamamlandığında ve Draft/hazır durum değişiminde çalışır; PR açılışı/synchronize için ayrıca aynı doğrulamayı başlatmaz. Main değişimi açık PR’lerin kanıtını yeniden değerlendirir. Workflow’nun yeşil olması tek başına required status’un başarılı olduğunu göstermez.

## CI-SPLIT — frontend/backend kaynak sınırı

[Pozitif kaynak kaydı](../apps/backend/scripts/ci/scope.json) backend/shared girdileri, incelenmiş belge listesini ve frontend sahipliğini ayırır. Main tetikleme yolları bu kayıtla test edilir; frontend workflow’ları iki açık negatif yolla dışlanır. Bütün workflow dosyaları backend politika güven yüzeyidir; yeni/silinen workflow belgesel istisna sayılmaz. Frontend workflow’ları frontend test kapsamındadır ama politika kurulum kontrolünden muaf değildir. Bilinmeyen diğer yol, eksik/truncated ağaç veya boş fark başarılı atlama değildir.

Frontend sahipliği `apps/web/**`, `packages/ui/**`, `vercel.json` ve kayıtlı iki frontend workflow’udur. Frontend-only main değişikliği backend test/CD tetiklemez. Frontend+belge değişikliği gerçek belge kabulü ister. Backend+frontend/belge karmasında backend’in bütün kapsamı korunur. Rename/silmenin iki ucu ve mode değişimi değerlendirilir. Ortak API/TypeScript paketi, root manifest/lock/workspace, Turbo ve Node girdileri shared kapsamdır; frontend lock importer’ı için örtük istisna yoktur.

Buradaki sahiplik test seçimi içindir; ajana yazma yetkisi vermez. Seçici kullanıcı görevinin frontend/backend sınırını doğrulamaz: frontend kodu ile kök belge içeren bir diff uygun testlerle geçebilir. Belge kaydı da dosya/konu tutarlılığını denetler, değişikliği yapan ajanın görev yetkisini değil. Görev kapsamı kök [belge yazma sınırına](../AGENTS.md#belge-yazma-sınırı) göre commit/PR öncesi ve bağımsız incelemede ayrıca kontrol edilir; bu kontrol mevcut CI tarafından otomatik engelleniyormuş gibi raporlanmaz.

Backend verify yalnız `--filter=@ftksaas/backend...` Turbo grafiğini yürütür. Frontend status’u frontend testlerinin yerine geçmez; frontend kendi gerçek test/workflow kabulünün sahibidir. İki zincirin gerçek tek-taraflı ve ortak kaynak örnekleriyle kabulü ayrıca kanıtlanır; yerel sentetik grafik testi uzak kabul sayılmaz.

İki frontend workflow'u main tabanlı PR kaynak olaylarında ve main push'ta önce dependency kurmadan [kapsam seçicisini](../apps/web/scripts/ci-scope.mjs) çalıştırır. Üst düzey yol filtresi kullanılmaz; büyük farklarda GitHub'ın sınırlı olay diff'i gerekli işi atlayamaz. Başlık/açıklama değişikliği bütün işleri atlar ve ayrı metadata concurrency grubu çalışan kaynak testini iptal etmez; main'e retarget yeni seçim yapar. PR'de event'in base/head parent'ları doğrulanan gerçek merge ağacı, main push'ta event'in tam before→after aralığı kullanılır; checkout SHA eşleşmesi zorunludur. Tam Git farkında silme/taşımanın iki ucu ve mode değerlendirilir. Aynı incelenmiş belge kaydındaki yalnız regular100644, geçerli UTF8 ve NUL içermeyen dosyalar ağır frontend işlerinden muaftır; genel `.md`/`docs/**` istisnası yoktur. Belge-only değişimde build, coverage ve tarayıcı işleri atlanır; bu atlama test kabulü olarak sunulmaz. Belge bağlantı/içerik kabulü mevcut backend belge zincirinin sorumluluğunda kalır.

Frontend kodu/UI/Vercel ayarı veya kendi workflow'u `checks` ve dört tarayıcıyı; ortak API/TypeScript paketi, root dependency/lock/workspace/Turbo/Node girdileri veya compatibility workflow'u typecheck ve isolation kontrolünü seçer. Karma fark gereken kapsamların birleşimidir. Seçici, kapsam testi veya belge izin listesindeki değişiklik iki zinciri de seçer; makine sözleşmeleri belge muafiyeti almaz. Yeni/kayıtsız frontend belgesi ilk değişiminde normal frontend kapsamını çalıştırır. Manuel frontend çalıştırması tam ilgili zinciri seçer; boş fark muhafazakâr olarak iki kapsamı da açar, eksik/geçersiz kaynak veya okunamayan fark açık hatadır.

## Manuel targeted

Girdiler tam 40 karakter SHA’dır; base test edilen head’in atası ve checkout birebir head olmalıdır. Son commit için parent→commit, birikimli değişiklik için seçilen ancestor→head kullanılır; origin/main merge-base’i açık aralığın yerine geçmez. Plan ve shard çıktıları kaynak aralığını gösterir; bu tanı mevcut main ile birleşim uygunluğunu kanıtlamaz.

Seçici güvenilir main kodundan çalışır. Kaynak–tüketici ve append-only migration kanıtıyla ilgili API suite’lerini seçer; eksik/açıklanamayan runtime farkı geniş regresyona gider. [Delta analizi](../apps/backend/scripts/ci/delta-analysis.mjs) ortak Auth/tenant/finans/hak/gateway değişikliğini dar modüle sahiplenmez. Kaynağın API envanteri trusted envanterden farklıysa yeni/silinmiş test sessizce atlanmaz; tanı açık hata verir, önce incelenmiş envanter kurulmalıdır.

Seçilen API suite’leri mevcut ölçümlü dört shard planının kesişimine dağıtılır; boş shard açılmaz. Her API shard ayrı runner/backend/DB kullanır; concurrency=2 korunur. İlgili öncelikli test hata verirse aynı shard’daki ertelenmiş regresyon başlamaz. Core/DB ve API işleri ayrı runner kullanır. Belge/frontend-only tanı dependency kurulumu veya DB/API başlatmaz. Plan/timings artifact’leri tanıdır; source-bound kabul makbuzu değildir.

## Güvenli belge kabulü

İncelenmiş tam yol, regular100644 dosya ve UTF8/NUL kontrolü gerekir; `.md`, `docs/` veya etiket yeterli değildir. Workflow, seçici/kapı, dependency/lockfile, migration, makine sözleşmesi ve runtime tipleri istisna değildir. Eski renderer’ın üç incelenmiş açıklama slotu yalnız kendi AST bağlamında belge kanıtı alabilir. Yeni renderer bu istisnayı devralmaz; üreteçteki bütün değişiklikler tam kapsama gider. [Renderer kanıtlayıcısı](../apps/backend/scripts/ci/renderer-proof.py) dosyanın tamamına izin vermez.

PR’nin gerçek merge ağacında [belge kontrolü](../apps/backend/scripts/ci/docs-check.mjs) yaşayan inbound/outgoing bağlantıları ve anchor’ları denetler. Belge-only iş dependency/backend kurulumu yapmaz; DB/API/full clean gibi raporlanmaz. Main aynı parent/tree ve receipt’i doğrular; kontrol tekrarı yoktur. Ayrı eski belge workflow’u ve recovery girişi kaldırılmıştır. Eski başarısız run değiştirilmez; sorun düzeltildiyse yeni gerçek kaynak kanıtı gerekir.

## Tam clean ve kanıt doğrulama

[Ortak clean suite](../.github/workflows/clean-suite.yml) yalnız adayda çalışır. Core ve dört API işi ayrı runner/backend/DB’de temiz migration manifesti ve boş Auth/tenant/receipt ile başlar. Core verify/DB/seed/health/advisors’ı, dört shard bütün API suite’lerini eksiksiz ve tekrarsız taşır. Suite içi yarışlar bölünmez; fail-fast:false ve concurrency=2 korunur. Paketler sabit pnpm ile `corepack enable` ve `pnpm install --frozen-lockfile` kullanır.

[Toplayıcı](../apps/backend/scripts/ci/collect.mjs), aynı run’ın güncel deneme görünümündeki bütün zorunlu job/step sonuçlarını GitHub API’den doğrular. GitHub’ın failed-job rerun sırasında koruduğu başarılı işler kabul edilir; geçmiş denemelerden elle başarılı iş seçilmez. Güncel görünümde skipped/cancelled/failure/eksik/mükerrer iş veya çalışmamış kaynak/test/baseline-upload adımı kabulü kapatır. Artifact tek başına başarı değildir.

Aday çözümleme değişebilen PR merge ref’i yerine ilk olayın `GITHUB_SHA`, base ve head değerlerine sabittir. Base/head değişmişse yeni koşu gerekir. `four-isolated-v2` makbuzu PR/head/base/merge/tree/run/coverage bağlarını, kaynak çözümleme denemesini (`source_attempt`) ve kabul denemesini (`attempt`) ayrı taşır. GitHub’ın devralınmış işler için güncel deneme numarası ve yeni job ID vermesi yeniden fiziksel yürütme anlamına gelmez; ölçüm gerçek yürütme zamanlarını saklar. Toplayıcı ve merge/main/CD doğrulayıcısı okuma sonunda canlı run/attempt durumunu yeniden kontrol eder. Geçmiş `four-isolated-v1` makbuzlarının eski doğrulaması korunur; yeni kaynak sabitleme garantisi geçmişe varsayılmaz.

Toplayıcı-only rerun yalnız aynı kaynakta bütün zorunlu işler başarılıysa kabul makbuzunu yeniler. Başarısız API job’ı eski bir başarıyla kapatılamaz. Kanıt seçimi her başarılı koşuyu bağımsız doğrular; iptal edilmiş, eski veya makbuzu eksik başka koşu geçerli kanıtı gölgelemez. Kaynak uyumsuzluğu yine kabul edilmez.

Merge normal iki parent’lı merge olmalıdır; squash/rebase’e kanıt taşınmaz. Head/base/tree değişirse yeni kabul gerekir. Main yeniden test yerine gerçek parent/tree’nin test edilen adayla aynılığını ve başarılı adayın güncel attempt/job sonuçlarını doğrular. Böylece test maliyeti tekrarlanmaz; kaynak güveni kaldırılmaz.

İnceleme tamamlandıktan sonra GitHub’ın yerleşik auto-merge özelliği PR üzerinde **merge commit** yöntemiyle etkinleştirilir; CI bitene kadar elle beklemek gerekmez. Açık, Draft olmayan PR’nin incelenmiş güncel head SHA’sı doğrulanır. Auto-merge etkinleştirme inceleme onayı veya başarılı status üretmez; gerekli CI, kaynak kanıtı, review ve trusted politika kurulum şartları korunur. Sonraki kaynak değişikliği yeniden inceleme gerektirir; auto-merge beklerken kaynak güncellemesi yapılacaksa auto-merge önce kapatılır. Ek ayrıcalıklı bot workflow’u, otomatik approval veya bypass kullanılmaz.

[Dependabot](../.github/dependabot.yml) başlangıçta yalnız GitHub Actions minor/patch güncellemelerini haftalık, 7 günlük bekleme ve tek grup ile önerir; en fazla iki açık güncelleme PR’ı vardır. Major güncellemeler ve uygulama paketleri bu otomasyonun dışındadır. Dependabot PR’ları da inceleme sonrası aynı auto-merge akışını kullanır; bot adına otomatik approval veya workflow politika muafiyeti yoktur.

<a id="api-süre-dengesi--zorunlu-kabul"></a>
## API süre dengesi — uyarı ve ölçüm

28 Ekim üretim önceliği kararı önceki zorunlu süre kapısını kaldırır. Süre dengesi fonksiyon doğruluğu veya güvenlik kabulü değildir. Dört API gerçek `Clean acceptance` süreleri her koşuda raporlanır; oran1.25 ve fark120sn birlikte aşılırsa GitHub uyarısı oluşur. Eksik/geçersiz ölçüm de görünür uyarıdır. Bu durumlar kendi başlarına full clean, merge veya development CD’yi engellemez; eşikler artırılarak yeşil sonuç üretilmez, optimizasyon üretim dışında değerlendirilir.

Toplayıcı önce kaynak/run/attempt/coverage ve bütün zorunlu core/dört API gerçek test başarılarını doğrular. Bunlardan biri eksik/skipped/cancelled/failed veya başka run/head’e veya güncel deneme görünümü dışına aitse binding üretilmez. Bu güvenlik sınırı değişmez. Sonra süre ölçümü ayrı try/catch içinde değerlendirilir; rapor ve varsa uyarı yazılır, fonksiyon/kaynak kabulü başarılıysa binding üretilir. Binding `balance_mode:advisory` taşır; süre politika sürümü veya denge sonucu trusted merge/main/CD kapısının kabul şartı değildir.

Yeni testler eksiksiz suite/shard envanterinde bulunur, dört bağımsız runner ve concurrency2 korunur. Kullanıcının talimatıyla suite bölme, tekrar denetimi ve fixture optimizasyonu ertelenmiştir; üretim kuyruğunu bloke etmez. İşlevsel kapsam, test assertion’ları ve kaynak güvenliği gevşetilmez. Failed-job rerun kabulü yukarıdaki sabit kaynak ve güncel GitHub job görünümüne dayanır. İncelemede açıkça istenen attempt API’si kullanılır; güncel görünüm geçmiş denemede yeniden çalıştırılmış test gibi sunulmaz.

## Güvenilir politika ve dağıtım

`ftksaas/merge-clean` status’unu yalnız main’den çalışan doğrulayıcı üretir. Aday testleri salt-okuma token kullanır, secrets/status-write yetkisi almaz. Yetkili doğrulayıcı aday kodu veya artifact executable’ı çalıştırmaz. Bütün `.github/workflows/*`, `.github/dependabot.yml`, `scripts/ci` ve clean/start/path runner blob/mode kümesi trusted yüzeydir. Frontend-only sınıflandırma dahi workflow politika değişikliğine otomatik izin vermez.

Trusted yüzey değişen PR’de bağımsız son kaynak incelemesi, gerçek aday başarısı ve tam kaynağa özel açık kurulum yetkisi gerekir. Önceki PR izinleri taşınmaz. Sahte status, bypass, direct push veya koruma gevşetme yoktur. Required-check/strict-base/bypass ve review düzeninin son doğrulanmış durumu [güncel kabul kaydındadır](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md); bağımsız ajan incelemesi zorunludur.

CD, başarılı main source/proof job’larını ve dayandığı adayın kanıtını yeniden doğrular. Her yazma öncesi current main/run/attempt ve kaynak eşdeğerliği kontrol edilir. Araya giren yalnız belge/frontend değişimi backend girdilerini değiştirmediyse kabul edilmiş backend dağıtılabilir; shared/backend/bilinmeyen fark bunu reddeder. Belge kanıtı runtime kabulü yerine geçmez. Önceki dağıtım receipt’i yalnız aynı repo güvenilir main CD koşusunun gerçek başarılı aynı-attempt deploy işinden okunur; PR/fork/atlanan deploy makbuzu optimizasyon yetkisi vermez. Hosted Edge kaynak/version/JWT eşleşmesi ayrıca gerekir.

## Ölçüm ve ajan devri

Ölçümlü deterministik shard planı eksik/yeni/mükerrer suite veya geçersiz süreyi reddeder. `refresh-suite-durations.mjs` başarılı aday full-clean (ve tarihsel full-main) job loglarından bilinçli bakım yapar; proof-only main koşusu test ölçümü sayılmaz. Örtüşen process süreleri wall diye toplanmaz; ölçülmemiş hız/maliyet kazancı iddia edilmez. Eski seri reference ölçümleri tarihsel kalır; metadata etiketi yeni otomatik benchmark başlatmaz.

Aday full clean başlayınca run/PR/head/base/tested merge/kuyruk/sonraki adımı bildirip turu bitir. Run henüz listelenmiyorsa workflow ve tetikleme zamanını kaydet; bekleme/polling/log takibi/watch/arka plan otomasyonu yoktur. Kullanıcı dönünce gerçek sonuç ve güncel kaynak bir kez doğrulanır. Sırf durum için çalışan kaynağı değiştirme; kanıt sonraki doğal belge değişikliğinde eşitlenir. Main kanıt kabulü ve gerekli development CD doğrulanmadan teslim kapanmaz.
