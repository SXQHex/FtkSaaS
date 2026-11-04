# CI çalışma politikası

Bu bölüm kullanıcının 28 Ekim 2026 sadeleştirme kararını tarif eder; önceki otomatik targeted, etiketle aday clean ve merge sonrası test tekrarı hükümlerinin yerini alır. Kurulum/kabul durumu yalnız [00 devirde](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [backlog’da](../apps/backend/docs/remaining-work.md) tutulur. Geçmiş koşular yeni kaynak için kanıt değildir.

## Olaylar ve kabul

| Olay | Gerekli işlem |
|---|---|
| Main tabanlı PR açma, kaynak güncelleme, yeniden açma veya main’e retarget | `Backend CI` önce base→head tam ağaç farkını sınıflandırır. Backend/shared kapsamda olayın sabit merge SHA’sında core + sekiz API shard + toplayıcı; saf belgede yalnız belge kontrolü; frontend-only kapsamda backend testi yok. |
| Draft PR | Aynı otomatik test kapsamı çalışabilir; merge kapısı kapalıdır. Hazır duruma geçiş testleri tekrar başlatmaz, mevcut kaynak kanıtını değerlendirir. `development` etiketi artık test/merge kontrolü değildir. |
| PR başlığı/açıklaması/etiketi | Test tetiklemez; GitHub `edited` olayını retarget ile ortak ilettiği için başlık/açıklama olayının workflow zarfı görünebilir, bütün işler atlanır. Eski `ci:full-clean` ve `ci:measure-serial` etiketlerinin kabul yetkisi yoktur. |
| PR dışındaki branch push | Otomatik backend testi yok. |
| Main merge | `Main acceptance` gerçek merge parent/tree ve adayın başarılı run/attempt/job kanıtını doğrular. Aynı full clean veya belge testini tekrarlamaz. |
| Main kabulü tamamlandı | `Development delivery` yalnız doğrulanmış backend kabulünü development ortamına taşır ve hosted kontrolleri çalıştırır. Production yetkisi yoktur. |
| Manuel tanı | `Manual targeted`, yalnız main’den seçilen tam `base_sha`→`tested_sha` aralığını test eder; merge/full/main kabulü veya status üretmez. |

Metadata olayları ayrı concurrency grubundadır; çalışan veya bekleyen kaynak full clean’ini iptal edemez. Aynı PR’nin eski kaynak koşusu iptal edilir; farklı PR ve main kabulü birbirini kesmez. Otomatik PR testinden önce ayrıca targeted koşulmaz. Base retarget gerçek yeni kabul gerektirir; başlık/açıklama/etiket olayları full clean yaratmaz. Yetkili merge doğrulayıcısı kaynak sonucu tamamlandığında ve Draft/hazır durum değişiminde çalışır; PR açılışı/synchronize için ayrıca aynı doğrulamayı başlatmaz. Main değişimi açık PR’lerin kanıtını yeniden değerlendirir. Workflow’nun yeşil olması tek başına required status’un başarılı olduğunu göstermez.

## CI-SPLIT — frontend/backend kaynak sınırı

[Pozitif kaynak kaydı](../apps/backend/scripts/ci/scope.json) backend/shared girdileri, incelenmiş belge listesini ve frontend sahipliğini ayırır. Aday test kapsamları bu kayda göre seçilir. Ortak Main acceptance kapısı yol filtresi olmadan her main push için çalışır. Bütün workflow dosyaları backend politika güven yüzeyidir; yeni/silinen workflow belgesel istisna sayılmaz. Frontend workflow’ları frontend test kapsamındadır ama politika kurulum kontrolünden muaf değildir. Bilinmeyen diğer yol, eksik/truncated ağaç veya boş fark başarılı atlama değildir.

Frontend sahipliği `apps/web/**`, `packages/ui/**`, `vercel.json` ve kayıtlı iki frontend workflow’udur. Frontend-only main değişikliği backend test/CD tetiklemez. Frontend+belge değişikliği gerçek belge kabulü ister. Backend+frontend/belge karmasında backend’in bütün kapsamı korunur. Rename/silmenin iki ucu ve mode değişimi değerlendirilir. Ortak API/TypeScript paketi, root manifest/lock/workspace, Turbo ve Node girdileri shared kapsamdır; frontend lock importer’ı için örtük istisna yoktur.

Buradaki sahiplik test seçimi içindir; ajana yazma yetkisi vermez. Seçici kullanıcı görevinin frontend/backend sınırını doğrulamaz: frontend kodu ile kök belge içeren bir diff uygun testlerle geçebilir. Belge kaydı da dosya/konu tutarlılığını denetler, değişikliği yapan ajanın görev yetkisini değil. Görev kapsamı kök [belge yazma sınırına](../AGENTS.md#belge-yazma-sınırı) göre commit/PR öncesi ve bağımsız incelemede ayrıca kontrol edilir; bu kontrol mevcut CI tarafından otomatik engelleniyormuş gibi raporlanmaz.

Backend verify yalnız `--filter=@ftksaas/backend...` Turbo grafiğini yürütür. Frontend status’u frontend testlerinin yerine geçmez; frontend kendi gerçek test/workflow kabulünün sahibidir. İki zincirin gerçek tek-taraflı ve ortak kaynak örnekleriyle kabulü ayrıca kanıtlanır; yerel sentetik grafik testi uzak kabul sayılmaz.

İki frontend workflow'u main tabanlı PR kaynak olaylarında, ortak Main acceptance kapısı da main push'ta önce dependency kurmadan [kapsam seçicisini](../apps/web/scripts/ci-scope.mjs) çalıştırır. Üst düzey yol filtresi kullanılmaz; büyük farklarda GitHub'ın sınırlı olay diff'i gerekli işi atlayamaz. Başlık/açıklama değişikliği bütün işleri atlar ve ayrı metadata concurrency grubu çalışan kaynak testini iptal etmez; main'e retarget yeni seçim yapar. PR'de event'in base/head parent'ları doğrulanan gerçek merge ağacı, main push'ta event'in tam before→after aralığı kullanılır; checkout SHA eşleşmesi zorunludur. Tam Git farkında silme/taşımanın iki ucu ve mode değerlendirilir. Aynı incelenmiş belge kaydındaki yalnız regular100644, geçerli UTF8 ve NUL içermeyen dosyalar ağır frontend işlerinden muaftır; genel `.md`/`docs/**` istisnası yoktur. Belge-only değişimde build, coverage ve tarayıcı işleri atlanır; bu atlama test kabulü olarak sunulmaz. Belge bağlantı/içerik kabulü mevcut backend belge zincirinin sorumluluğunda kalır.

Frontend kodu/UI/Vercel ayarı veya kendi workflow'u `checks` ve dört tarayıcıyı; ortak API/TypeScript paketi, root dependency/lock/workspace/Turbo/Node girdileri veya compatibility workflow'u typecheck ve isolation kontrolünü seçer. Karma fark gereken kapsamların birleşimidir. Seçici, kapsam testi veya belge izin listesindeki değişiklik iki zinciri de seçer; makine sözleşmeleri belge muafiyeti almaz. Yeni/kayıtsız frontend belgesi ilk değişiminde normal frontend kapsamını çalıştırır. Manuel frontend çalıştırması tam ilgili zinciri seçer; boş fark muhafazakâr olarak iki kapsamı da açar, eksik/geçersiz kaynak veya okunamayan fark açık hatadır.

Frontend testleri yalnız PR adayında veya manuel tanıda yürütülür; compatibility kontrolü PR/manüel tanı sinyalidir. Tek ortak [Main acceptance](../.github/workflows/backend.yml) kapısı bütün main push olaylarında çalışır; frontend workflow’ları main’de ayrıca tetiklenmez. Ortak kapı gerekli frontend test kanıtı ile mevcut backend/belge kanıtlarını birlikte doğrular; gereken kanıtlar geçmeden başarılı olmaz. Sözleşme compatibility sonucu backend merge kabulünün veya main kabulünün şartı değildir: backend sözleşmeyi değiştirebilir, frontend yeni sözleşmeye uyarlanır. Compatibility yalnız PR/manüel tanı sinyalidir; merge sonrasında doğrulanmaz. Main push, kapsam gerekiyorsa [frontend kanıt doğrulayıcısı](../apps/web/scripts/ci-proof.mjs) ile aynı depodaki başarılı PR koşusunun kaynak makbuzunu doğrular. Normal merge'in base/head parent'ları ve tam dosya ağacı adayla eşleşmelidir; aynı head tek başına yeterli değildir. İlgili scope/checks/dört browser işleri ve adımları güncel attempt görünümünde başarılı olmalıdır. Rerun'da devralınan kaynak makbuzu kendi source attempt'ine bağlı kalır; kabul güncel attempt'e göre yapılır ve okuma sonunda run yeniden doğrulanır. Eksik/süresi dolmuş makbuz, iptal/başarısız/atlanmış iş, squash/rebase, toplu push veya değişmiş kaynak açık hatadır; main ağır test başlatmaz. Kanıt kapsamı seçilmemiş işlerin atlanmasını test başarısı saymaz. Workflow değişiklikleri aşağıdaki trusted politika kurulum şartlarına tabidir.

Frontend `checks` işi lint/typecheck, tek coverage koşusu ve tek production build yapar. Dört tarayıcı aynı koşudaki build artifact kimliği ve SHA256 ile doğrulanan çıktıyı kullanır; yeniden build etmez. Build kaynağı, run/üretim attempt'i, Node/platform ve build girdileri doğrulanır. Başarılı üretici işini devralan browser rerun aynı artifact'ı kullanır; eksik veya uyuşmayan artifact yeniden üretimle gizlenmez, kabul başarısız olur. Yerel `check:frontend` geliştirme komutu korunur.

## Ortak kalite kanıtı

[Kalite sözleşmesindeki](../CONSTRAINTS.md) floor ve secret kontrolü her kaynak PR’sinde `Backend CI / quality` işinde çalışır; işin araç sahibi backend, kapsamı iki alandır. Saf belgede dependency/DB/API/build kurulmaz. Frontend-only kaynakta backend full clean gerekmez, fakat ortak kalite kanıtı gerekir. Kalite kanıtı frontend contract compatibility veya frontend’in backend’e adapte olmasını bekleyen bir kapı değildir.

Kalite işi olayın tam merge SHA/parent/tree’sini doğrular. Salt-okuma token ile floor/olumsuz senaryolar ve sabit checksum’lu Gitleaks yeni base→head commit aralığını denetler. Başarılı adımlardan sonra run’a özel `quality-binding` makbuzu yüklenir. Trusted merge/main doğrulayıcısı mevcut head/base/tree/run ve güncel attempt job/step başarısını, ardından canlı run durumunu doğrular. Failed-job rerun’da kaynak makbuzu eski attempt’ten devralınabilir; yanlış kaynak veya atlanan secret adımı başarı sayılmaz. Main tekrar tarama yapmaz.

Kalite sözleşmesi, checker/istisna dosyaları, uygulama/root görev manifestleri, Turbo, frontend/UI lint ve coverage config’leri ile TypeScript/Playwright config’leri (yeni iç klasör config’leri dahil) trusted politika karşılaştırmasına dahildir. Kurulum değişiklikleri mevcut kaynak-özel inceleme/kurulum prosedürünü izler; yeni status veya bypass mekanizması eklenmez. Yerel `pnpm check:quality` Turbo üzerinden çalışır; Git farkına bağlı görev cache kullanmaz. Bütçe ve ölçülmemiş boyutların tek sahibi CONSTRAINTS’tir.

## Manuel targeted

Girdiler tam 40 karakter SHA’dır; base test edilen head’in atası ve checkout birebir head olmalıdır. Son commit için parent→commit, birikimli değişiklik için seçilen ancestor→head kullanılır; origin/main merge-base’i açık aralığın yerine geçmez. Plan ve shard çıktıları kaynak aralığını gösterir; bu tanı mevcut main ile birleşim uygunluğunu kanıtlamaz.

Seçici güvenilir main kodundan çalışır. Kaynak–tüketici ve append-only migration kanıtıyla ilgili API suite’lerini seçer; eksik/açıklanamayan runtime farkı geniş regresyona gider. [Delta analizi](../apps/backend/scripts/ci/delta-analysis.mjs) ortak Auth/tenant/finans/hak/gateway değişikliğini dar modüle sahiplenmez. Kaynağın API envanteri trusted envanterden farklıysa yeni/silinmiş test sessizce atlanmaz; tanı açık hata verir, önce incelenmiş envanter kurulmalıdır.

Seçilen API suite’leri mevcut ölçümlü dört shard planının kesişimine dağıtılır; boş shard açılmaz. Her API shard ayrı runner/backend/DB kullanır; concurrency=2 korunur. İlgili öncelikli test hata verirse aynı shard’daki ertelenmiş regresyon başlamaz. Core/DB ve API işleri ayrı runner kullanır. Belge/frontend-only tanı dependency kurulumu veya DB/API başlatmaz. Plan/timings artifact’leri tanıdır; source-bound kabul makbuzu değildir.

## Güvenli belge kabulü

İncelenmiş tam yol, regular100644 dosya ve UTF8/NUL kontrolü gerekir; `.md`, `docs/` veya etiket yeterli değildir. Workflow, seçici/kapı, dependency/lockfile, migration, makine sözleşmesi ve runtime tipleri istisna değildir. Eski renderer’ın üç incelenmiş açıklama slotu yalnız kendi AST bağlamında belge kanıtı alabilir. Yeni renderer bu istisnayı devralmaz; üreteçteki bütün değişiklikler tam kapsama gider. [Renderer kanıtlayıcısı](../apps/backend/scripts/ci/renderer-proof.py) dosyanın tamamına izin vermez.

PR’nin gerçek merge ağacında [belge kontrolü](../apps/backend/scripts/ci/docs-check.mjs) yaşayan inbound/outgoing bağlantıları ve anchor’ları denetler. Belge-only iş dependency/backend kurulumu yapmaz; DB/API/full clean gibi raporlanmaz. Main aynı parent/tree ve receipt’i doğrular; kontrol tekrarı yoktur. Ayrı eski belge workflow’u ve recovery girişi kaldırılmıştır. Eski başarısız run değiştirilmez; sorun düzeltildiyse yeni gerçek kaynak kanıtı gerekir.

## Tam clean ve kanıt doğrulama

[Ortak clean suite](../.github/workflows/clean-suite.yml) yalnız adayda çalışır. Core ve sekiz API işi ayrı runner/backend/DB’de temiz migration manifesti ve boş Auth/tenant/receipt ile başlar. Core verify/DB/seed/health/advisors’ı, sekiz shard bütün API parçalarını eksiksiz ve tekrarsız taşır. Test gövdelerindeki yarışlar bölünmez; fail-fast:false korunur. Normal parçalar concurrency=2, global fixture yazan parçalar ayrı concurrency=1 fazında çalışır. Üretim envanteri ve parça yükleyicisi `apps/backend/scripts/ci/api-suites.json` ve `api-suites.mjs` sahibindedir; üretim runner’ı deney dizininden kod yüklemez. API job üst sınırı 90 dakikadır; kök/alt testlerde kaynakta tanımlı timeout’lar, istek/SQL deadline’ları ve 3 GiB Edge RSS koruması korunur. Backend clean, targeted ve CD işleri sabit pnpm ile `corepack enable` ve `pnpm --filter @ftksaas/backend... --filter ftksaas install --frozen-lockfile` kullanır; root Turbo ve backend bağımlılıkları kurulur, web/UI runtime bağımlılıkları kurulmaz.

[Toplayıcı](../apps/backend/scripts/ci/collect.mjs), aynı run’ın güncel deneme görünümündeki bütün zorunlu job/step sonuçlarını GitHub API’den doğrular. GitHub’ın failed-job rerun sırasında koruduğu başarılı işler kabul edilir; geçmiş denemelerden elle başarılı iş seçilmez. Güncel görünümde skipped/cancelled/failure/eksik/mükerrer iş veya çalışmamış kaynak/test/baseline-upload adımı kabulü kapatır. Artifact tek başına başarı değildir.

Aday çözümleme değişebilen PR merge ref’i yerine ilk olayın `GITHUB_SHA`, base ve head değerlerine sabittir. Base/head değişmişse yeni koşu gerekir. `eight-isolated-v1` makbuzu PR/head/base/merge/tree/run/coverage bağlarını, kaynak çözümleme denemesini (`source_attempt`) ve kabul denemesini (`attempt`) ayrı taşır. GitHub’ın devralınmış işler için güncel deneme numarası ve yeni job ID vermesi yeniden fiziksel yürütme anlamına gelmez; ölçüm gerçek yürütme zamanlarını saklar. Toplayıcı ve merge/main/CD doğrulayıcısı okuma sonunda canlı run/attempt durumunu yeniden kontrol eder. Geçmiş `four-isolated-v1` ve `four-isolated-v2` makbuzlarının kendi dört shard doğrulaması korunur; yeni kaynak sabitleme garantisi geçmişe varsayılmaz.

Toplayıcı-only rerun yalnız aynı kaynakta bütün zorunlu işler başarılıysa kabul makbuzunu yeniler. Başarısız API job’ı eski bir başarıyla kapatılamaz. Kanıt seçimi her başarılı koşuyu bağımsız doğrular; iptal edilmiş, eski veya makbuzu eksik başka koşu geçerli kanıtı gölgelemez. Kaynak uyumsuzluğu yine kabul edilmez.

Merge normal iki parent’lı merge olmalıdır; squash/rebase’e kanıt taşınmaz. Head/base/tree değişirse yeni kabul gerekir. Main yeniden test yerine gerçek parent/tree’nin test edilen adayla aynılığını ve başarılı adayın güncel attempt/job sonuçlarını doğrular. Böylece test maliyeti tekrarlanmaz; kaynak güveni kaldırılmaz.

İnceleme tamamlandıktan sonra GitHub’ın yerleşik auto-merge özelliği PR üzerinde **merge commit** yöntemiyle etkinleştirilir; CI bitene kadar elle beklemek gerekmez. Açık, Draft olmayan PR’nin incelenmiş güncel head SHA’sı doğrulanır. Auto-merge etkinleştirme inceleme onayı veya başarılı status üretmez; gerekli CI, kaynak kanıtı, review ve trusted politika kurulum şartları korunur. Sonraki kaynak değişikliği yeniden inceleme gerektirir; auto-merge beklerken kaynak güncellemesi yapılacaksa auto-merge önce kapatılır. Ek ayrıcalıklı bot workflow’u, otomatik approval veya bypass kullanılmaz.

[Dependabot](../.github/dependabot.yml) başlangıçta yalnız GitHub Actions minor/patch güncellemelerini haftalık, 7 günlük bekleme ve tek grup ile önerir; en fazla iki açık güncelleme PR’ı vardır. Major güncellemeler ve uygulama paketleri bu otomasyonun dışındadır. Dependabot PR’ları da inceleme sonrası aynı auto-merge akışını kullanır; bot adına otomatik approval veya workflow politika muafiyeti yoktur.

<a id="api-süre-dengesi--zorunlu-kabul"></a>
## API süre dengesi — uyarı ve ölçüm

28 Ekim üretim önceliği kararı önceki zorunlu süre kapısını kaldırır. Süre dengesi fonksiyon doğruluğu veya güvenlik kabulü değildir. Sekiz API gerçek `Clean acceptance` süreleri her koşuda raporlanır; oran1.25 ve fark120sn birlikte aşılırsa GitHub uyarısı oluşur. Eksik/geçersiz ölçüm de görünür uyarıdır. Bu durumlar kendi başlarına full clean, merge veya development CD’yi engellemez; eşikler artırılarak yeşil sonuç üretilmez, optimizasyon üretim dışında değerlendirilir.

Toplayıcı önce kaynak/run/attempt/coverage ve bütün zorunlu core/sekiz API gerçek test başarılarını doğrular. Bunlardan biri eksik/skipped/cancelled/failed veya başka run/head’e veya güncel deneme görünümü dışına aitse binding üretilmez. Bu güvenlik sınırı değişmez. Sonra süre ölçümü ayrı try/catch içinde değerlendirilir; rapor ve varsa uyarı yazılır, fonksiyon/kaynak kabulü başarılıysa binding üretilir. Binding `balance_mode:advisory` taşır; süre politika sürümü veya denge sonucu trusted merge/main/CD kapısının kabul şartı değildir.

Yeni testler eksiksiz suite/parça envanterinde bulunur; kaynak hash’i ve satır sahipliği denetimleri eksik, mükerrer veya değişmiş gövdede kabulü durdurur. Kullanıcının sekiz shard’a geçiş kararıyla mevcut bölünmüş envanter üretim kabulüne taşınır. Geçmiş dört shard planı yalnız tarihsel kanıt ve manuel hedefli suite kesişimleri için korunur. İşlevsel kapsam, test assertion’ları ve kaynak güvenliği gevşetilmez. Failed-job rerun kabulü yukarıdaki sabit kaynak ve güncel GitHub job görünümüne dayanır. İncelemede açıkça istenen attempt API’si kullanılır; güncel görünüm geçmiş denemede yeniden çalıştırılmış test gibi sunulmaz.

## Sekiz shard karşılaştırma deneyi

[Backend experiment](../.github/workflows/backend-experiment.yml) yalnız kurulu main workflow'undan manuel başlatılır. Girdi, mevcut Backend CI'ın başarılı full-clean PR koşu kimliğidir. Referansın candidate ve quality makbuzları, tam head/base/merge/tree, güncel attempt ve zorunlu job/step başarıları doğrulanır; başarısız/eksik belge veya yalnız frontend koşusu referans olamaz. Deney tanımı ile test edilen kaynak ayrı SHA'larla kaydedilir. Referansın tam merge kaynağı ayrı checkout'a alınır; ürün kodu, migration, paket/lockfile, Node ve Supabase sürümleri o kaynaktan gelir.

[Ortak parça envanteri](../apps/backend/scripts/ci/api-suites.json) özgün test dosyalarını değiştirmez. Kaynak hash'i ve açık satır aralıkları her parçanın sahibini gösterir; değişmiş dosya, eksik/mükerrer aralık veya yeni/kayıp suite deney başlamadan reddedilir. Bağımsız kabul modülleri ve tam test kökleri ayrılır; iptal senaryoları para, paket, planlı zaman, gerçek başlangıç ve uzlaşma/yarış gruplarına bölünür. Ortak hazırlık ve finally temizliği korunur; yarış senaryosunun gövdesi bölünmez. Geçici ESM yükleme kancası yalnız seçilen özgün modülün gövdesini değiştirir; özgün URL, göreli import ve import.meta.url korunur. Test gövdeleri ikinci kez elle yazılmaz. Tam gövde derleme ve gerçek modül yükleme eşdeğerliği deneyin ön kontrolündedir. Bir import modülündeki bağımsız native kökler de aynı açık shared/parts satır sahipliğiyle ayrı deney birimlerine alınabilir. Her parça kendi fixture fonksiyonuyla yeni tenant ve bağlantı kurar; önceki kökün sonucunu devralmaz. Global platform settings sürümünü yazan tenant yetkisi ve typed katalog kökleri aynı dosya biriminde özgün sırayla tutulur.

Sekiz API runner'ı ayrı native backend/DB kullanır. `oneshot`, temiz migration/boş Auth/tenant/receipt ve 3 GiB bellek koruması korunur. Normal parçalar runner içinde concurrency2 kullanır; singleton güvenlik/worker/dispatch ayarlarını değiştiren beş açık parça kendi runner'ında diğer dosyalarla çakışmadan ayrı fazda yürütülür. Bu sınır test gövdesindeki gerçek yarışları seri hale getirmez. ST-02 için tek runner tahsisi kaldırılmıştır; bu akış da sekiz runner'ın ortak dağıtımına girer. Tamamlanmış parça process-wall süreleri run/attempt/job ve gövde SHA256 iziyle yalnız planlama girdisidir. Kaynak hash'i eşleşmeyen veya tamamlanmış ölçümü olmayan parça açıkça kaynak boyutu tahmini kullanır; timeout ile kesilen parça tamamlanmış ölçüm sayılmaz. Planlayıcı ayrı fixture fazlarını ve normal testlerin iki yürütme hattını hesaba katar. Parçalanmamış en uzun kök planlanan sürenin alt sınırıdır; dengeli tahmin gerçek hız kazancı değildir.

Ölçüm deneyinde yalnız API test kaydı sınırındaki kök ve alt test `timeout` seçenekleri native `Infinity` ile geçersiz kılınır. ESM çözümleme kancası yalnız kaynak test dizinindeki `node:test` importlarını deney adapter'ına yönlendirir; özgün dosyalar, assertion ve kaynak gövdeleri değişmez. Üretim materialize yolu ve sekiz shard kabulü özgün timeout'larla kalır. Tek istek/SQL/kaynak kapatma deadline'ları, hata yayılımı, temizlik ve bellek koruması korunur. Core ve API job üst sınırı90 dakikadır; sonsuz bekleme yoktur. Kök/alt test sonuçları ve süreleri hata mesajı/payload taşımayan JSONL artifact'ına yazılır; fixture/API zamanları mevcut ölçümden gelir. Timeout politikaları farklı olduğundan başarılı ölçüm, referansla aynı süre kabulü veya merge kanıtı değildir.

Core özgün clean komutunu çalıştırır. Ayrı toplayıcı bütün deney işlerinin aynı kaynak ve güncel attempt'te başarılarını, referansın hâlâ aynı başarılı attempt olmasını doğrular. Kapsam planı, gerçek dosya/istek süreleri, bellek/sinyal kayıtları ve karşılaştırma JSON'u artifact olur. Core+API runner-dakikası ve yürütme aralığı eş kapsamda karşılaştırılır; hazırlık/kuyruk ve diğer workflow maliyetleri ayrı gösterilir. Devralınan eski başarılı işin zamanları yeniden çalıştırılmış gibi sunulmaz.

Deney hiçbir candidate/main/CD kabul makbuzu veya merge status'u üretmez; üretim CI ve development dağıtımı kendi sekiz shard kabul kanıtını kullanır. Ölçüm koşusu bu kanıtın yerine geçmez. Yeni workflow ve CI araçlarının kurulumu mevcut kaynak-özel inceleme/kurulum prosedürüne tabidir; politika muafiyeti eklenmez.

## CI/CD v2 — bağımsız alan planı ve manuel oda pilotu

### Amaç ve sınır

V2'nin ilk dikey dilimi, [WF02](workflows.md#wf02) oda davranışını doğrudan Node test runner ile sınayan bağımsız bir tanı hattıdır. Ürün geliştirmesi ve mevcut sekiz shard kabulü devam eder. Pilotun başarısı mevcut full clean, merge/main kabulü veya development/production dağıtım yetkisi değildir. Yeni hat required check yapılmaz; mevcut workflow, status, trusted politika ve dağıtım kararları bu dilimde değiştirilmez.

[CI V2 Pilot](../.github/workflows/ci-v2-pilot.yml) yalnız `workflow_dispatch` ile seçilen ref'in sabit `github.sha` kaynağını çalıştırır. `operation=plan` yalnız dependency-free etki planı üretir; `operation=room` buna izole oda pilotunu ekler. `base_sha` tam 40 karakterlik ata commit'tir; başka kaynak checkout edilmez. `scope=auto`, `backend` veya `full` doğrulama isteğini seçer. PR/push/schedule tetiklemesi, hosted secret veya status/deployment yazma yetkisi yoktur. İlk GitHub koşusu workflow'un varsayılan dala mevcut trusted kurulum prosedürüyle alınmasını gerektirir; dalda hazırlanmış kaynak çalışmış kabul edilmez. Bu workflow da trusted yüzeydir; yeni bir politika muafiyeti oluşturmaz.

### Hedef kabul: 20 backend shard ve bağımsız alanlar

Kullanıcının 4 Kasım kararıyla V2 backend tam kabulü **20 backend shard** kullanır. Full kabul bu 20 backend shard'ına bağımsız frontend ve ortak kontrolleri ekler; 20 bütün reponun toplam job bütçesi değildir. Frontend-only ve saf belge farkları backend matrix'i açmaz. Bu hedef, mevcut üretim kabulündeki sekiz shard şartını bu PR ile değiştirmez.

| Fark | Doğrulama etkisi | Dağıtım etkisi |
|---|---|---|
| Web/UI kaynağı | Frontend; backend yok | Vercel |
| Backend DB/Edge/runtime | 20 backend shard planı; frontend yok | Supabase |
| Test veya CI kaynağı | İlgili alan ve gerekli ortak kontroller | Uygulama dağıtımı yok |
| Saf belge | Hafif ortak kontroller | Dağıtım yok |
| Ortak paket/lockfile/build config | İki gerçek tüketici; sözleşme uyumluluğu tanı sinyali | Etkilenen iki alan; ilk seçici ortak girdide ihtiyatlı davranır |
| Signup sunucu köprüsü ve gerçek import girdileri | Backend ve Next.js tüketicisi | Vercel; Supabase değil |
| Bilinmeyen kaynak | Geniş ortak/frontend/backend doğrulaması | İhtiyatlı iki alan etkisi |

Karar dal adına değil kaynak/bağımlılık etkisine dayanır. Signup köprüsünün `uuid.mjs` ve `p04-public-ingress.mjs` dahil gerçek backend girdileri mevcut `apps/web/turbo.json` build inputs kaydından okunur; ikinci dosya envanteri tutulmaz. Bu girdilerin dependency manifesti olan backend package.json da web'i etkiler. Temel kaynak bütünlüğü/secret/kalite kontrolleri uygulama alanından bağımsız zorunluluktur; `common=false` bunların kaldırılması değildir. `apps/web1` muafiyeti kendi mevcut sınırında kalır; rename/silmenin eski ucu bu muafiyetle saklanamaz. Lockfile importer/dependency analizi henüz daraltılmadığından ortak lockfile farkı iki alanı seçer; bu ihtiyatlı fazlalık güvenlik gevşetilerek giderilmez.

Test seçimi ve dağıtım etkisi ayrı alanlardır. `backend/full` doğrulama talebi tek başına deploy etkisi eklemez. Vercel kendi otomatik dağıtımının sahibidir; GitHub'da ikinci web deploy hattı kurulmaz. Supabase yalnız kendi gerçek runtime kabulü ve dağıtım girdilerine dayanır. İlgisiz frontend/backend işleri birbirini beklemez veya iptal etmez; ortak kontrol yalnız gerçek tüketicisini engeller. Gerekli web build'i ile kendi tarayıcıları ve aynı ortama yazan migration/dağıtımların sırası korunur.

Kabulün yeniden kullanımı ancak ilgili alanın kaynak, bağımlılık ve test politikası girdileri değişmediyse mümkündür. Repo genelindeki strict-base şartı bu alan ilişkisi kanıtlanmadan kaldırılmaz. Yeşil eski head tek başına kanıt değildir; yeni alan kabul protokolü ve CD devri bu tanı planının dışındadır.

Test kökleri bağımsız çalışabilen en küçük anlamlı davranış/işlem zincirine indirilecek; yarış/atomiklik/rollback senaryosunun iç bütünlüğü bölünmeyecek, önceki kökün fixture çıktısı devralınmayacak. Runtime satır kesme/ESM kancası yerine doğrudan test dosyaları kullanılacak. Test azaltımı yalnız tekrarları kaldırarak ve gerekli katmana taşıyarak, eşdeğer hata yakalama kanıtıyla yapılacak; sayısal test azalması başarı ölçütü değildir.

**Plan ve yürütme ayrımı:** Seçici backend/full için tam 20 kayıtlı matrix planı üretir; plan job'u test yürütmez veya kabul üretmez. Gerçek yirmi işin manuel gölge yürütmesi aşağıdaki ayrı backend workflow'unun sorumluluğudur. Dört köklü oda pilotu 20 boş/tekrarlı iş olarak dağıtılmaz. Mevcut üretim kabulüne devir ayrıca kanıt gerektirir.

### Yapı ve komutlar

| Kaynak | Sorumluluk |
|---|---|
| `apps/backend/tests/v2/room.test.mjs` | Doğrudan keşfedilen gerçek API testleri; başka kabul dosyası import etmez |
| `apps/backend/tests/v2/room-fixture.mjs` | Her köke ayrı tenant ve DB bağlantısı; mevcut API istemcisini kullanır |
| `apps/backend/scripts/ci/v2/safety.mjs` | Tam kaynak, manuel/disposable çalışma ve loopback sınırı |
| `apps/backend/scripts/ci/v2/local.mjs` | İzole kurulum/reset, migration/boş DB kontrolü ve sahipli cleanup |
| `apps/backend/tests/v2/safety.test.mjs` | Yanlış kaynak, otomatik olay ve hosted URL reddi |
| `apps/backend/scripts/ci/v2/scope.mjs` | Frontend/backend/ortak test ve deploy etkisi; sabit 20 backend shard planı |
| `apps/backend/scripts/ci/v2/plan.mjs` | Tam ata→head Git farkı, temiz kaynak ve tanı raporu |
| `apps/backend/tests/v2/scope.test.mjs`, `plan.test.mjs` | Alan izolasyonu, rename/silinme, bilinmeyen kaynak ve gerçek Git kaynak sınırı |

Repo kökünde dependency-free güvenlik testi:

```sh
node --test apps/backend/tests/v2/safety.test.mjs apps/backend/tests/v2/scope.test.mjs apps/backend/tests/v2/plan.test.mjs
```

Plan için `apps/backend` içinden `CI_V2_BASE_SHA` ve `CI_V2_HEAD_SHA` tam SHA, `CI_V2_MODE` auto/backend/full olarak verilerek `node scripts/ci/v2/plan.mjs` çalıştırılır. GitHub'da head sabit `GITHUB_SHA`dır. Dal adı, farklı checkout, ata olmayan taban, boş veya eksik fark ve kirli kaynak reddedilir. Plan artifact'ı `.artifacts/ci-v2-plan` altındadır; job dependency kurulumu, DB/API veya deploy başlatmaz.

Oda workflow'unda temiz checkout ve backend kurulumu sonrasında `apps/backend` içinden:

```sh
node scripts/ci/v2/local.mjs prepare
FTK_EDGE_MEMORY_GUARD=1 node scripts/ci/observe-api.mjs node --test --test-concurrency=1 --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=../../.artifacts/ci-v2/room.junit.xml tests/v2/room.test.mjs
node scripts/ci/v2/local.mjs cleanup
```

Prepare yalnız manuel GitHub Actions bağlamında, tam SHA eşleşen temiz ve `.dev` içermeyen checkout'ta çalışır; mevcut native stack'e bağlanmayı reddeder. Gerçek yerel Auth/Edge/RPC kullanılır; reset yalnız doğrulanmış loopback servisinde `--local --no-seed` ile yapılır. Migration manifesti ve boş Auth/tenant/receipt kontrol edilir. Her test yeni tenant kurar; global ayar/DDL değiştirmez. Native `oneshot`, mevcut istek deadline'ları ve 3 GiB Edge koruması korunur. Kaynak satırı kesme, test gövdesi yükleme kancası ve timeout geçersiz kılma yoktur. Cleanup yalnız aynı SHA/run/attempt'in sahiplik işaretini taşıyan stack'i durdurur; hosted reset/seed veya dış posta gönderimi yoktur.

### Pilot kapsamı ve geçiş kabulü

Pilot dört bağımsız kökte oluşturma/aynı anahtar tekrarı/liste-ayrıntı/sürümle güncelleme/eski sürüm reddini, geçersiz fiziksel kapasiteyi, atanmamış merkez reddini ve iki gerçek tenant arasında okuma/yazma izolasyonunu sınar. Yeni API/ürün kuralı eklemez. Mevcut geniş oda/rol testinin pagination, yarış, geç hata rollback'i, rol/Starter ve migration senaryolarının tamamının yerine geçmez; eski test kaldırılmaz.

JUnit sonuçları ile tam commit/tree/run/attempt ve `full_clean:false` kapsam kaydı `.artifacts/ci-v2` altında yedi günlük tanı artifact'ıdır. `.dev`, bağlantı bilgileri, oturum/fixture ve yerel servis logları artifact'a alınmaz. Yerleşik Node assertion stili kullanılır; küçük, açık testler ve parametrik SQL korunur. İlk dilimde runtime/migration/sözleşme/paket sürümü ve lockfile değiştirilmez.

Sonraki alan bazlı geçiş için aynı tam kaynakta mevcut kabul ile V2 sonuçları karşılaştırılmalı; eski assertion'ların yeni sahipleri ve açık eksikler gösterilmeli; seçilmiş gerçek yetki/veri hatalarıyla hata yakalama kanıtlanmalı; süre ve runner maliyeti ayrı ölçülmelidir. Yalnız hızlı/yeşil pilot alanı devralamaz. Test katmanı veya required-check/CD devri ayrı incelenmiş değişikliktir. Gölge koşuları seçilmiş checkpoint'lerde yürür; her ürün push'unda ikinci full clean oluşturulmaz.

### Yirmi gerçek backend shard — manuel gölge yürütme

[CI V2 Backend](../.github/workflows/ci-v2-backend.yml) yalnız manuel, sabit `github.sha` üzerinde çalışır. Inventory işi `@ftksaas/backend...` ile filtrelenmiş Turbo verify grafiğini (ortak kontrat typecheck dahil) ve V2 kapsam/Git/taşıma testlerini geçirir; backend/full seçildiğinde dinamik matrix tam **20 boş olmayan backend işi** açar. `fail-fast:false` ve `max-parallel:20` kullanılır; gerçek eşzamanlılık sağlayıcı kotasına tabidir. Frontend koşusu veya Vercel/Supabase dağıtımı tetiklemez, status/secret/deploy yetkisi almaz. Mevcut üretim sekiz shard kapısı değişmez.

`tests/v2/backend-suites.json` yalnız id, doğrudan dosya, köken ve açıkça tahmin olan planlama ağırlığını taşır; runtime hash/satır aralığı manifesti değildir. 67 mevcut kabul birimi 34 özgün bağımsız dosya ve 33 normal taşınmış dosya üzerinden yürür. Node test runner dosyaları doğrudan yükler; runtime kaynak kesme, eval veya ESM gövde kancası yoktur. Ayrı migration/parity yardımcıları yalnız doğrulamada eski kapsamla eşdeğerliği denetler, test yürütme yoluna girmez. `es-module-lexer` mevcut lockfile sürümü 2.3.2 ile yalnız geliştirme bağımlılığıdır; gerçek import/import.meta konumlarını ayırarak gövde/assertion byte'larını korur. Bu geçişin 33 dosyalık gölge kopyası kalıcı ikinci test sistemi değildir; devirde eski karşılık ve migration kontrolü birlikte emekli edilir.

Her backend işi kendine ait runner/temiz yerel stack, sıralı migration ve boş Auth/tenant/receipt doğrulaması kullanır. Dosyalar runner içinde concurrency=1 çalışır; global fixture çakışması önlenirken test gövdelerindeki gerçek yarışlar korunur. Oneshot/istek deadline'ları/3 GiB Edge koruması, sahipli cleanup ve dar artifact sınırı korunur. Kaynak kaydı `backend-shadow` kapsamını ve shard numarasını taşır. JUnit sonuçları ve estimated plan bir merge/CD makbuzu değildir. İptal/atlanmış/başarısız matrix tamamlama işi başarı sayılmaz.

Repo kökünde taşıma ve matrix doğrulaması: `node --test apps/backend/tests/v2/backend.test.mjs`. Backend içinden `node scripts/ci/v2/backend.mjs plan` tam, tekrarsız dağılımı üretir; hazır disposable stack'te `node scripts/ci/v2/backend.mjs SHARD` yalnız 1–20 arası seçili işi yürütür. Tahmini süreler güncel ölçüm veya hız kazancı değildir. En uzun program kökü hâlâ ayrı bir darboğazdır; yirmi işin kurulması en küçük anlamlı köklere dönüşümün tamamlandığı anlamına gelmez.

**Manuel yürütme kapsamı:** `scope=backend` varsayılanı tam yirmi API shard'ını çalıştırır. `scope=core` yalnız ayrı core DB/güvenlik işini çalıştırır ve API shard'larını başlatmaz. `scope=full`, aynı envanter doğrulamasından sonra core ve yirmi API işini birbirine bağımlı olmadan çalıştırır. Sonuç işi seçilen işlerin tamamını zorunlu tutar; yalnız seçilmeyen işin skipped sonucu geçerlidir. Bu seçim frontend/backend/ortak kaynak seçicisi değil, manuel gölge tanı kapsamıdır.

Core, V2'nin sahiplik işareti ve loopback denetimiyle hazırladığı boş/migration-manifesti eşlenmiş ayrı ortamda önce pristine şema kataloğunu kaydeder; ardından belge bağlantıları, gerçek PostgreSQL DB bütünlük/RLS/yetki ve event-scope testleri, sentetik seed, Auth/REST sağlığı ve bütün security/performance advisors kontrollerini çalıştırır. Advisors hata seviyesi kabulü düşürmez: sabit CLI 3 yereli varsayılan seçer, `--fail-on error` korunur ve remote seçeneği yoktur. Envanterde yapılan yapısal verify core içinde tekrarlanmaz. Her aşama başarısızsa sonraki aşamaya geçilmez; başarısız core tanısı saklanır.

**Kabul sınırı:** Core JUnit, aşama süreleri ve kaynak/run/attempt bağlı pristine metadata ayrı V2 artifact'ında tutulur; bunlar üretim `documentation-baseline` veya merge/CD makbuzu değildir. Dar observer JSONL tanıları API JUnit ile birlikte saklanır; `.dev`, kullanıcı fixture'ları veya servis logları yüklenmez. Core'un gerçek gölge koşusu ayrıca doğrulanmadan ve V2 kabul bağları tamamlanmadan üretim core+API kabulü devralınmış sayılmaz.

Güncel job/step başarıları, süre/bellek, eksik core yükümlülükleri ve kontrollü hata yakalama kanıtı görülmeden üretim devri yapılmaz. Uzun sıralı kökler bağımsız fixture'lı anlamlı senaryolara dönüştürülecek; yarış/atomiklik/rollback sınırları ve bütün assertion'lar korunacaktır. Bu workflow varsayılan dala kurulmadan gerçek GitHub koşusu yapılmış kabul edilmez.

### V2 kaynak seçimi — bağımsız alanların gölge yürütmesi

`CI V2 Scope` yalnız manuel `base_sha` tam ancestor commit'i ile seçilen ref'in gerçek `github.sha` ağacını karşılaştırır. Kirli checkout, boş/kesik veya geçersiz karşılaştırma, symlink/submodule değişikliği ve ilgisiz geçmiş reddedilir. Taşınan dosyanın eski/yeni yolu birlikte değerlendirilir; bilinmeyen kaynak iki uygulamaya genişler. `auto` mevcut etki seçicisini kullanır; `backend`/`full` seçenekleri kapsamı yalnız genişletebilir. Bu iş otomatik PR kabulü, main proof veya dağıtım değildir.

Planın `baseline` alanı her desteklenen değişiklikte kalite tabanı, secret taraması, belge bağlantıları ve kaynak/kapsam olumsuz testlerini zorunlu tutar. `common=false` olan saf frontend değişikliği bu kontrolleri atlayamaz. Saf belgede uygulama bağımlılığı/build/DB/API açılmaz. Frontend ve backend işleri yalnız bu ortak önkoşuldan sonra, birbirine bağımlı olmadan çalışır. Saf frontend kaynakta backend çağrılmaz; saf backend kaynakta gerçek web build girdisi de değişmedikçe frontend çağrılmaz. Ortak runtime/lock/kontrat kaynağında iki alan çalışır; uyumluluk etkisi tanı bilgisidir.

Backend alanı aynı commit'teki V2 backend workflow'unu açık `scope=full` girdisiyle çağırır: core ve tam yirmi API shard'ı korunur. Frontend alanı ayrı, secrets almayan V2 workflow'unda mevcut lint/typecheck/build/coverage/izolasyon komutlarını çalıştırır; kaynak/run/repository/tree/Node/public-input hash'i ile bağlı tek build'i producer artifact ID, digest ve attempt çıktılarıyla dört tarayıcı projesine aktarır. Tarayıcılar build'i tekrar üretmeden doğrulanmış çıktıyı kullanır. İç workflow'lar manuel olay ve exact source guard'ını yeniden uygular; `workflow_call`, otomatik/ayrıcalıklı bir giriş sağlamaz. Frontend ve backend iptal grupları ayrıdır; yalnız frontend seçen çağrı mevcut backend gölge koşusunu iptal etmez.

Sonuç işi plan başarısını, seçilen bütün alanlarda success ve seçilmeyen alanlarda yalnız skipped sonucunu zorunlu tutar. Artifact'lar plan/build/test tanısıdır; üretim receipt'ı değildir. Vercel/Supabase etki bayrakları rapor olarak kalır, deploy çağrısı veya secret aktarımı yoktur. Üretim workflow'ları ve kaynak bağlı politika incelemesi/kurulum kapıları korunur.

## Güvenilir politika ve dağıtım

`ftksaas/merge-clean` status’unu yalnız main’den çalışan doğrulayıcı üretir. Aday testleri salt-okuma token kullanır, secrets/status-write yetkisi almaz. Yetkili doğrulayıcı aday kodu veya artifact executable’ı çalıştırmaz. Bütün `.github/workflows/*`, `.github/dependabot.yml`, frontend `ci-scope.mjs`/`ci-proof.mjs`, `scripts/ci` ve clean/start/path runner blob/mode kümesi trusted yüzeydir. Frontend-only sınıflandırma dahi workflow politika değişikliğine otomatik izin vermez.

Trusted yüzey değişen PR’de bağımsız son kaynak incelemesi, gerçek aday başarısı ve tam kaynağa özel açık kurulum yetkisi gerekir. Önceki PR izinleri taşınmaz. Sahte status, bypass, direct push veya koruma gevşetme yoktur. Required-check/strict-base/bypass ve review düzeninin son doğrulanmış durumu [güncel kabul kaydındadır](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md); bağımsız ajan incelemesi zorunludur.

CD, başarılı main source/proof job’larını ve dayandığı adayın kanıtını yeniden doğrular. Her yazma öncesi current main/run/attempt ve kaynak eşdeğerliği kontrol edilir. Araya giren yalnız belge/frontend değişimi backend girdilerini değiştirmediyse kabul edilmiş backend dağıtılabilir; shared/backend/bilinmeyen fark bunu reddeder. Belge kanıtı runtime kabulü yerine geçmez. Önceki dağıtım receipt’i yalnız aynı repo güvenilir main CD koşusunun gerçek başarılı aynı-attempt deploy işinden okunur; PR/fork/atlanan deploy makbuzu optimizasyon yetkisi vermez. Hosted Edge kaynak/version/JWT eşleşmesi ayrıca gerekir.

## Ölçüm ve ajan devri

Ölçümlü deterministik shard planı eksik/yeni/mükerrer suite veya geçersiz süreyi reddeder. `refresh-suite-durations.mjs` başarılı aday full-clean (ve tarihsel full-main) job loglarından bilinçli bakım yapar; proof-only main koşusu test ölçümü sayılmaz. Örtüşen process süreleri wall diye toplanmaz; ölçülmemiş hız/maliyet kazancı iddia edilmez. Eski seri reference ölçümleri tarihsel kalır; metadata etiketi yeni otomatik benchmark başlatmaz.

Aday full clean başlayınca run/PR/head/base/tested merge/kuyruk/sonraki adımı bildirip turu bitir. Run henüz listelenmiyorsa workflow ve tetikleme zamanını kaydet; bekleme/polling/log takibi/watch/arka plan otomasyonu yoktur. Kullanıcı dönünce gerçek sonuç ve güncel kaynak bir kez doğrulanır. Sırf durum için çalışan kaynağı değiştirme; kanıt sonraki doğal belge değişikliğinde eşitlenir. Main kanıt kabulü ve gerekli development CD doğrulanmadan teslim kapanmaz.

## Deneysel tasarım alanı

`apps/web1/**` kullanıcının 3 Kasım 2026 kararıyla CI kabul kapsamı dışındadır. pnpm workspace/Turbo grafiğine katılmaz; bağımlılıkları ve lockfile'ı kendi klasöründe yönetilir. Yalnız bu klasör değiştiğinde uygulama kurulumu, build, lint, tip, test, kalite/secret taraması ve belge sicili kontrolü yapılmaz. Korumalı main için kaynak, merge parent'ları ve değişiklik sınırını doğrulayan hafif kapsam işleri kalır; bunlar uygulama kabulü değildir. Development backend dağıtımı başlatılmaz. Harici hosting sağlayıcısının kendi otomasyonu bu GitHub CI muafiyetinden ayrı yönetilir.

Karma değişiklikte klasör dışındaki her yol normal kurallarına tabidir. Kök manifest/lockfile, ortak paketler, workflow'lar ve mevcut uygulamalar muaf değildir; dosyanın bu alana taşınması eski yolun silinmesini gizlemez. Mevcut uygulamalar bu deneysel alanı runtime/build girdisi olarak kullanmaz. Ürün frontend'ine aktarım normal kabul kapsamına girer. Deneysel kaynak ve belgeler ortak ürün/makine sözleşmesinin sahibi olmaz.


### V2 geliştirme kabulü — üretimden ayrı hafif yol

Yalnız `.github/workflows/ci-v2-pilot.yml`, `.github/workflows/ci-v2-backend.yml`, `.github/workflows/ci-v2-frontend.yml`, `.github/workflows/ci-v2-scope.yml`, `apps/backend/scripts/ci/v2/` altındaki doğrudan `.mjs` dosyaları ve `apps/backend/tests/v2/` altındaki doğrudan veya `backend/` içindeki `.mjs`/`.json` dosyaları değişiyorsa kabul türü `v2-development` olur. Kapsam seçicisi bu alanın dışında trusted politika olarak tutulur. Boş/bilinmeyen liste, düzenli dosya olmayan kaynak veya eski/yeni uçtan üretime çıkan taşıma hafif kabul alamaz. Ortak bağımlılık, paket komutu, üretim kaynağı, mevcut kabul politikası veya belge ile karma değişiklik mevcut kapsam kurallarına döner; V2 kaynakları backend etkisini kaybetmez ve eski runtime kanıtına eşdeğerlik sayılmaz.

Bu yol aynı PR head/base/merge tree üzerinde kalite tabanı ve secret taramasını, backend yapısal doğrulamasını, V2 kaynak/plan/güvenlik/göç testlerini ve üretimin V2 dosyalarına literal bağımlılığı bulunmadığı kontrolünü çalıştırır. Hesaplanmış/dinamik bağımlılıklar bağımsız incelemenin yükümlülüğüdür. DB/API ortamı, sekiz üretim API shard'ı veya frontend build kurulmaz. Ayrı `v2-development-binding` makbuzu yalnız geliştirme doğrulamasını kanıtlar; gerçek yirmi shard gölge yürütmesini veya backend runtime kabulünü kanıtlamaz. Yürütme davranışı ayrıca ilgili manuel gölge koşuda doğrulanır; backend/full yürütmesinde yirmi shard korunur.

Kalite/secret ve V2 job/step/upload başarısı, kaynak ağacı, PR, run ve attempt birlikte doğrulanır. Workflow ve CI script değişiklikleri trusted politika olmaya devam eder: bağımsız inceleme ve açık kaynak bağlı kurulum yetkisi gerekliliği kaldırılmaz. Hafif kabul üretim politikasını kendiliğinden kuramaz. Main adayın aynı ağaçtaki geliştirme kanıtını tekrar test etmeden doğrular ve ayrı V2 işareti üretir; Development delivery bu işaretten dağıtım veya geçmiş runtime kabulü araması başlatmaz. V2'yi üretim kapısına bağlayan değişiklik bu dar yolun dışındadır.
