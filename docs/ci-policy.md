# CI çalışma politikası

Bu bölüm kullanıcının 28 Ekim 2026 sadeleştirme kararını tarif eder; önceki otomatik targeted, etiketle aday clean ve merge sonrası test tekrarı hükümlerinin yerini alır. Kurulum/kabul durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [backlog’da](remaining-work.md) tutulur. Geçmiş koşular yeni kaynak için kanıt değildir.

## Olaylar ve kabul

| Olay | Gerekli işlem |
|---|---|
| Main tabanlı PR açma, kaynak güncelleme, yeniden açma veya main’e retarget | `Backend CI` önce base→head tam ağaç farkını sınıflandırır. Backend/shared kapsamda gerçek güncel merge ağacında core + dört API shard + toplayıcı; saf belgede yalnız belge kontrolü; frontend-only kapsamda backend testi yok. |
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

Backend verify yalnız `--filter=@ftksaas/backend...` Turbo grafiğini yürütür. Frontend status’u frontend testlerinin yerine geçmez; frontend kendi gerçek test/workflow kabulünün sahibidir. İki zincirin gerçek tek-taraflı ve ortak kaynak örnekleriyle kabulü ayrıca kanıtlanır; yerel sentetik grafik testi uzak kabul sayılmaz.

## Manuel targeted

Girdiler tam 40 karakter SHA’dır; base test edilen head’in atası ve checkout birebir head olmalıdır. Son commit için parent→commit, birikimli değişiklik için seçilen ancestor→head kullanılır; origin/main merge-base’i açık aralığın yerine geçmez. Plan ve shard çıktıları kaynak aralığını gösterir; bu tanı mevcut main ile birleşim uygunluğunu kanıtlamaz.

Seçici güvenilir main kodundan çalışır. Kaynak–tüketici ve append-only migration kanıtıyla ilgili API suite’lerini seçer; eksik/açıklanamayan runtime farkı geniş regresyona gider. [Delta analizi](../apps/backend/scripts/ci/delta-analysis.mjs) ortak Auth/tenant/finans/hak/gateway değişikliğini dar modüle sahiplenmez. Kaynağın API envanteri trusted envanterden farklıysa yeni/silinmiş test sessizce atlanmaz; tanı açık hata verir, önce incelenmiş envanter kurulmalıdır.

Seçilen API suite’leri mevcut ölçümlü dört shard planının kesişimine dağıtılır; boş shard açılmaz. Her API shard ayrı runner/backend/DB kullanır; concurrency=2 korunur. İlgili öncelikli test hata verirse aynı shard’daki ertelenmiş regresyon başlamaz. Core/DB ve API işleri ayrı runner kullanır. Belge/frontend-only tanı dependency kurulumu veya DB/API başlatmaz. Plan/timings artifact’leri tanıdır; source-bound kabul makbuzu değildir.

## Güvenli belge kabulü

İncelenmiş tam yol, regular100644 dosya ve UTF8/NUL kontrolü gerekir; `.md`, `docs/` veya etiket yeterli değildir. Workflow, seçici/kapı, dependency/lockfile, migration, makine sözleşmesi ve runtime tipleri istisna değildir. Renderer’ın yalnız üç açıklama slotu AST ile kanıtlanabilir; executable/f-string/emit değişimi tam kapsama gider. [Eski renderer kanıtı](ci02-handover.md) dosyanın tamamına izin vermez.

PR’nin gerçek merge ağacında [belge kontrolü](../apps/backend/scripts/ci/docs-check.mjs) yaşayan inbound/outgoing bağlantıları ve anchor’ları denetler. Belge-only iş dependency/backend kurulumu yapmaz; DB/API/full clean gibi raporlanmaz. Main aynı parent/tree ve receipt’i doğrular; kontrol tekrarı yoktur. Ayrı eski belge workflow’u ve recovery girişi kaldırılmıştır. Eski başarısız run değiştirilmez; sorun düzeltildiyse yeni gerçek kaynak kanıtı gerekir.

## Tam clean ve kanıt doğrulama

[Ortak clean suite](../.github/workflows/clean-suite.yml) yalnız adayda çalışır. Core ve dört API işi ayrı runner/backend/DB’de temiz migration manifesti ve boş Auth/tenant/receipt ile başlar. Core verify/DB/seed/health/advisors’ı, dört shard bütün API suite’lerini eksiksiz ve tekrarsız taşır. Suite içi yarışlar bölünmez; fail-fast:false ve concurrency=2 korunur. Paketler sabit pnpm ile `corepack enable` ve `pnpm install --frozen-lockfile` kullanır.

[Toplayıcı](../apps/backend/scripts/ci/collect.mjs) gerçek job/step başarısını aynı run/attempt/head içinde doğrular. Coverage/profile, PR/head/base/merge/tree/run/attempt birlikte bağlanır. Skipped/cancelled/failure/eksik/mükerrer iş kabulü kapatır; artifact tek başına başarı değildir. Rerun-failed farklı attempt başarılarını birleştiremez. Kanıt seçimi her başarılı koşuyu bağımsız doğrular; iptal edilmiş, eski veya makbuzu eksik başka koşu geçerli kanıtı gölgelemez. Kaynak uyumsuzluğu yine kabul edilmez.

Merge normal iki parent’lı merge olmalıdır; squash/rebase’e kanıt taşınmaz. Head/base/tree değişirse yeni kabul gerekir. Main yeniden test yerine gerçek parent/tree’nin test edilen adayla aynılığını ve başarılı adayın güncel attempt/job sonuçlarını doğrular. Böylece test maliyeti tekrarlanmaz; kaynak güveni kaldırılmaz.

<a id="api-süre-dengesi--zorunlu-kabul"></a>
## API süre dengesi — uyarı ve ölçüm

28 Ekim üretim önceliği kararı önceki zorunlu süre kapısını kaldırır. Süre dengesi fonksiyon doğruluğu veya güvenlik kabulü değildir. Dört API gerçek `Clean acceptance` süreleri her koşuda raporlanır; oran1.25 ve fark120sn birlikte aşılırsa GitHub uyarısı oluşur. Eksik/geçersiz ölçüm de görünür uyarıdır. Bu durumlar kendi başlarına full clean, merge veya development CD’yi engellemez; eşikler artırılarak yeşil sonuç üretilmez, optimizasyon üretim dışında değerlendirilir.

Toplayıcı önce kaynak/run/attempt/coverage ve bütün zorunlu core/dört API gerçek test başarılarını doğrular. Bunlardan biri eksik/skipped/cancelled/failed veya başka run/attempt/head’e aitse binding üretilmez. Bu güvenlik sınırı değişmez. Sonra süre ölçümü ayrı try/catch içinde değerlendirilir; rapor ve varsa uyarı yazılır, fonksiyon/kaynak kabulü başarılıysa binding üretilir. Binding `balance_mode:advisory` taşır; süre politika sürümü veya denge sonucu trusted merge/main/CD kapısının kabul şartı değildir.

Yeni testler eksiksiz suite/shard envanterinde bulunur, dört bağımsız runner ve concurrency2 korunur. Kullanıcının talimatıyla suite bölme, tekrar denetimi ve fixture optimizasyonu ertelenmiştir; üretim kuyruğunu bloke etmez. İşlevsel kapsam, test assertion’ları ve kaynak güvenliği gevşetilmez. Aynı run’ın failed-job rerun’ında başka attempt’lerin başarılı testleri birleştirilemez; toplayıcı-only rerun eski binding attempt’ini başarılıya çeviremez. İncelemede açıkça istenen attempt API’si kullanılır; latest-job verisi attempt1 kanıtı diye sunulmaz.

## Güvenilir politika ve dağıtım

`ftksaas/merge-clean` status’unu yalnız main’den çalışan doğrulayıcı üretir. Aday testleri salt-okuma token kullanır, secrets/status-write yetkisi almaz. Yetkili doğrulayıcı aday kodu veya artifact executable’ı çalıştırmaz. Bütün `.github/workflows/*`, `scripts/ci` ve clean/start/path runner blob/mode kümesi trusted yüzeydir. Frontend-only sınıflandırma dahi workflow politika değişikliğine otomatik izin vermez.

Trusted yüzey değişen PR’de bağımsız son kaynak incelemesi, gerçek aday başarısı ve tam kaynağa özel açık kurulum yetkisi gerekir. Önceki PR izinleri taşınmaz. Sahte status, bypass, direct push veya koruma gevşetme yoktur. Aktif required-check/strict-base/bypass ve tek-yetkili review0 düzeni [yönetim kaydında](branch-protection-review.md) doğrulanmıştır; bağımsız ajan incelemesi korunur.

CD, başarılı main source/proof job’larını ve dayandığı adayın kanıtını yeniden doğrular. Her yazma öncesi current main/run/attempt ve kaynak eşdeğerliği kontrol edilir. Araya giren yalnız belge/frontend değişimi backend girdilerini değiştirmediyse kabul edilmiş backend dağıtılabilir; shared/backend/bilinmeyen fark bunu reddeder. Belge kanıtı runtime kabulü yerine geçmez. Önceki dağıtım receipt’i yalnız aynı repo güvenilir main CD koşusunun gerçek başarılı aynı-attempt deploy işinden okunur; PR/fork/atlanan deploy makbuzu optimizasyon yetkisi vermez. Hosted Edge kaynak/version/JWT eşleşmesi ayrıca gerekir.

## Ölçüm ve ajan devri

Ölçümlü deterministik shard planı eksik/yeni/mükerrer suite veya geçersiz süreyi reddeder. `refresh-suite-durations.mjs` başarılı aday full-clean (ve tarihsel full-main) job loglarından bilinçli bakım yapar; proof-only main koşusu test ölçümü sayılmaz. Örtüşen process süreleri wall diye toplanmaz; ölçülmemiş hız/maliyet kazancı iddia edilmez. Eski seri reference ölçümleri tarihsel kalır; metadata etiketi yeni otomatik benchmark başlatmaz.

Aday full clean başlayınca run/PR/head/base/tested merge/kuyruk/sonraki adımı bildirip turu bitir. Run henüz listelenmiyorsa workflow ve tetikleme zamanını kaydet; bekleme/polling/log takibi/watch/arka plan otomasyonu yoktur. Kullanıcı dönünce gerçek sonuç ve güncel kaynak bir kez doğrulanır. Sırf durum için çalışan kaynağı değiştirme; kanıt sonraki doğal belge değişikliğinde eşitlenir. Main kanıt kabulü ve gerekli development CD doğrulanmadan teslim kapanmaz.

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



## CD-01 kuruldu ve canlı kabulü tamamlandı — 21 Ekim 2026

PR32 head4e1e25c5 için bağımsız review5597902305 + aday39580259901 + açık exact-source kullanıcı kurulum onayı sonrası normal merge3e2fcd7 yapıldı. Trust kapısı gevşetilmedi; sahte status, bypass, direct push veya yönetim ayarı değişikliği yoktur. İlk main39582760620, Starter testinin3 saniyelik kurulum yarışı nedeniyle API3 başarısız oldu; CD39584677756 doğru biçimde skipped. Tarihsel başarısız sonuç korunur.

Test-only PR33 headfab366c5 bağımsız review5598374267, hedefli39585487735 (iki düzelen vaka dahil60 API+27 DB), aday39587119715 sonrasında normal merge ile `0fabf3a4a605dd6be5a1d358c660021f59406e20` main kaynağına alındı. [Aynı main39588975421](https://github.com/SXQHex/FtkSaaS/actions/runs/39588975421) core/dört API shard/toplayıcı completed/success. Runtime, migration ve CI kapıları test düzeltmesiyle değişmedi.

[CD39590690817 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/1), variable değeri TRUE olduğu için yazma öncesi yapılandırma kontrolünde durdu. Kullanıcı değeri true düzeltti; yalnız başarısız CD işleri yeniden çalıştırıldı, main full CI tekrarlanmadı. [Attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/2) source/deploy success;17 kontrol geçti,49 migration/Edge4 ve fixture temizliği doğrulandı. İlk canlı CD kabulü tamamlandı. Ayrıntı/işletim/token rotasyonu [uzak backend kurulumundadır](remote-backend-setup.md).

CD aynı kaynak bağlı main kabulüne dayanır; belge kabulü full runtime kanıtı yerine geçmez. Kabul edilmiş runtime ile araya giren yalnız-belge main’in SHA’ları ayrı bağlanır; her yazma aşamasında run/attempt/işler ve güvenli belge eşdeğerliği yeniden doğrulanır. Gelecekteki trusted politika değişikliklerine bu PR’nin kurulum izni taşınmaz. Bu 21 Ekim CD-01 kapanışında P04 sıradaydı. Sonradan P01–P07 kaynak ve beş worker temel kurulum kabulü tamamlandı; frontend, dış e-posta ve yük/restore açık kalır.

## 23 Ekim dokümantasyon teslimi

P01–P07 kaynak kabulü kapanmıştır. Frontend/settings belge eşitlemesi yalnız incelenmiş source-bound belge yolundan geçer; yeni runtime kabulü gibi raporlanmaz. PR41 main39873010292 belge kabulü/CD deploy skipped örneğidir. Bilinmeyen/mixed yol aynı kapı tarafından reddedilir; izin listesi/CI workflow bu belge göreviyle değiştirilmez.

## 25 Ekim — ölçüm güncellemesi ve CLI bakımı

Supabase CLI tam2.122.0 sürümüne package+lockfile ile sabitlenir; her koşuda otomatik en son sürüm çekilmez. Dört API shardı, concurrency2 ve bütün full/main clean yükümlülükleri korunur. Süre kaynağı ve sonraki kontrollü ölçüm güncellemesi [performans kaydındadır](ci-performance.md). Yeni suite için gerçek pozitif ölçüm/inventory şartı, kaynak/head/base/merge-tree kabulü ve bağımsız inceleme kaldırılmaz. Tahmini süre gerçek CI sonucu değildir.

Bu bakım scripts/ci ve clean runner güven yüzeyini değiştirir. Mevcut trusted-base policyMatches denetimi aday full clean başarılı olsa bile otomatik merge-clean status’unu reddeder; bu beklenen kurulum sınırıdır. Bağımsız son kaynak incelemesi ve gerçek aday kabulü sonrası exact-source güvenilir politika kurulum yetkisi gerekir. Gate kodu, status, required check ve repository yönetim ayarları değiştirilmeyecek.
