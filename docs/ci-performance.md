# CI ölçüm temeli ve sonraki performans işi

## P03 geliştirme ölçümü — 21 Ekim 2026

Kaynak `d3d5ae65d4ed226573cfb7e163cf2be8e0500c5a`, [39522543011](https://github.com/SXQHex/FtkSaaS/actions/runs/39522543011) completed/success. Run00:38:33–01:11:14 UTC=32:41; öncelikli2 API suite’i6:13.468, kalan13 suite25:17.243. Seçici P03 SQL, ortak borç hesabı, migration/manifest ve üretilmiş gateway girdilerinde fail-closed geniş geri dönüş kullandı;15 API suite’i seçildi. P03 için yalnız dosya adı eşlemek, paylaşılan finans tüketicilerinin kapsandığını tek başına kanıtlamaz. Hedefli süreç tek backend/DB’de concurrency2 kullanır; aday/main dört izole DB shard’ı ile aynı çalışma profili değildir.

Geçici workbench39522543060 aynı anda19:14 elapsed ile tamamlandı; P03 ve bağımlı suite’leri tekrar çalıştırdı. Temizlikte geçici workflow kaldırıldı. Bu kaldırma ek runner tüketimini önler; normal hedefli32:41 süresinin aynı oranda azalacağı iddiası değildir. Auth/cache veya paralellik/kapsam politikasında değişiklik yapılmadı. Geniş hedefli fallback’in shard ile yürütülmesi ayrı güvenilir CI incelemesi/ölçümü gerektirir; P03 finans tesliminde CI kapısı gevşetilmez.

## Son main kabulü — CI-02 kapandı

Main0ade7877cc16fc121095decbc276f2fbc868607e / [39425915555](https://github.com/SXQHex/FtkSaaS/actions/runs/39425915555) completed/success. Source ilişkisi, core, dört shard ve toplayıcı geçti; 462 test, sıfır fail/skipped. Core1:38; API rollerinin job süreleri9:58 / 10:03 / 11:28 / 9:37. Main'de seri kıyas istenmedi; optional skip artık ölçümü bozmadı. Bu yeni main'deki süreler önceki aynı-kaynak seri karşılaştırmasının yerine karıştırılmaz. İlk başarısız main39421388153 teşhisi ve eski 'bekliyor' notları aşağıda ait oldukları kaynakların tarihsel süreç kayıtlarıdır; güncel açık değildir.

## CI-02 aynı kaynakta gerçek sonuç — 20 Ekim 2026

Aday [39412474187](https://github.com/SXQHex/FtkSaaS/actions/runs/39412474187), head150d9fa / tested merge5148558 / tree4b1d49b, attempt1 completed/success. Artifact12262122881 binding + ölçüm içerir; source değişmedi.

| Aynı kaynak/kapsam | Ölçüm |
|---|---:|
| Core+dört shard, run oluşturma→son rol bitişi | 11:48 |
| En uzun API clean adımı | 11:14 |
| Seri reference job | 38:33 |
| Seri clean adımı | 38:07 |
| Her rol için kuyruk | 3 saniye |
| Checkout/Node/npm hazırlığı | 15–21 saniye |
| Core+dört shard runner toplamı | 43,60 dakika |
| Seri reference runner toplamı | 38,55 dakika |
| Bütün tanısal workflow, resolver/collector/seri dahil | 82,40 runner dakikası; 38:59 elapsed |

Bu tek aynı-kaynak gözleminde bekleme azalırken rol runner maliyeti yaklaşık %13,1 artmıştır. Normal aday/main seri reference istemez. Eski P01 sürelerinden yeni kaynak kazancı çıkarılmadı. Backend reset/migration ve test/seed-health-advisors fazları ayrıca her rolün timings artifact/özetinde tutulur; yukarıdaki hazırlık yalnız checkout/npm'dir.

Main a0325d7 / 39421388153 core+dört shard başarılı, collector ölçümü skipped optional serial job'un olmayan test step'ini okuyarak çöktü. Bu main kabulü değildir. Dar ölçüm filtresi gerçek main metadata’sıyla regresyona alındı; yeni kaynak kabulü bekliyor.

## CI-02 yeni ölçüm düzeni — sonuç bekliyor

[PR25](https://github.com/SXQHex/FtkSaaS/pull/25) dört bağımsız runner/backend/DB uygular. Ölçüm girdisi 7577b2f / 39401570751 logundaki 15 suite process wall süresidir. Deterministik azalan süre dağıtımı:

| Shard | Suite sayısı | Eski ölçüm ağırlığı (saniye; wall tahmini değil) |
|---|---:|---:|
| 1 | 2 | 1073.99 |
| 2 | 4 | 1133.62 |
| 3 | 5 | 1139.87 |
| 4 | 4 | 1064.18 |

En büyük/küçük ağırlık oranı 1.0712. Suite içi yarışlar bütün kalır; process concurrency=2. Eski suite süreleri örtüşür; bu toplamlar runner veya kullanıcı bekleme süresi değildir. Uzun event-cancellation suite'i parçalanmadığı için ideal 4 kat hızlanma iddiası yoktur.

Açık `ci:measure-serial` son adayda aynı tested merge/tree ve kapsamla ek seri reference koşar. Toplayıcı her iş için created→start kuyruk, start→Clean acceptance kurulum, acceptance süresi, runner süresi; en uzun API shard'ı ve sharded run beklemesini `.ci/measurements.json` artifact/özetinde verir. Seri reference ve shard runner dakikaları ayrı tutulur; core ve dört API toplamı full sharded maliyettir. Collector/source overhead ve workflow bitişi ancak run tamamlandıktan sonra Jobs API ile tam ölçülebilir; ilk artifact'in job toplamı bu tamamlanmamış overhead'i içermez. Nihai raporda tüm işler ayrıca sayılır.

68bb98f / 39411398475 targeted job 10:56:39–10:57:01 UTC = 22 saniye, hedefli runner 7 saniye; verify/34 politika testli CI-only kapsamdır, full runtime karşılaştırması değildir. O kaynağın recovery404 hatası27fe070 ile düzeltildi; 39411888033 targeted32 saniye ve recovery42 saniye başarılı. Bu belge kabulüdür; full runtime değildir.

Yeni kaynakta seri/parçalı gerçek koşu henüz yok; kuyruk, kurulum, en uzun shard, toplam bekleme ve toplam runner dakikası bekliyor. 39:00 eski P01 koşusu yeni kaynakta hız kazancı veya kabul kanıtı değildir.

## 20 Ekim 2026 — yeni performans kararı

P01 main [39401570751](https://github.com/SXQHex/FtkSaaS/actions/runs/39401570751), kaynak `7577b2f1873c6b1fcf83390bfa94a34374c44082`, completed/success doğrulandı. GitHub job/step zamanları: main-clean 09:33:46–10:12:46 UTC = **39:00**; test:clean 09:34:04–10:12:41 = **38:37**; run oluşturma–son güncelleme aralığı **39:04**. Kullanıcının yaklaşık 40 dakika bildirimiyle uyumludur. Önceki 30'ar dakika öngörüsü main için bu gerçek ölçümle değiştirildi; aday süre burada yeniden ölçülmedi. [CI-2026-10-20](decisions/CI-2026-10-20.md) ile dört ayrı runner/backend/DB shard'ı kabul edildi; uygulama/ölçüm CI-02'de bekliyor. Bu seri koşu süresi shard hız kazancı değildir. Aynı kaynak ve kapsamda seri/parçalı wall süre, shard dağılımı, kurulum/kuyruk ve toplam runner dakikası ölçülmeden 4 kat hızlanma vaat edilmez.


Kaynak: main d4eff4f00d897364d5f46ee637533deae9adbc29, [39225823561](https://github.com/SXQHex/FtkSaaS/actions/runs/39225823561). Bu eski çalışmanın loglarından ölçülenler; yeni workflow süreleri değildir.

| Ölçüm | Önce, gözlenen | Yeni politika |
|---|---:|---|
| Tam clean step | 35:00 | Son aday ve main’de korunur; yeni süre henüz ölçülmedi |
| API test runner | 2039.251 sn, yaklaşık 33:59 | Aynı suite/paralellik; gerçek yeni ölçüm final CI’da alınır |
| Yapısal test runner | 2.191 sn | Hızlı koşu; ci-policy testleri ayrıca eklenir |
| DB test runner | 1.389 sn | Hedefli DB/API işlerinde çalışır |
| Normal PR açılışı/güncellemesi full clean | Otomatik | 0 otomatik full; açık label tetikleyicisi gerekir |
| backend branch push ve PR kaynaklı full | Aynı head için iki event mümkündü | Push hedefli tek yol; PR ucuz kapı; açık aday clean ayrı |

Bunlar süre kazancı tahmini değildir. İş sayısındaki kaldırılan tetikleyiciler konfigürasyondan doğrulanabilir; toplam dakika tasarrufu değişiklik türü/commit sayısına bağlıdır.

Eski loglarda Q-E02 iptal suite’i yaklaşık 942.220 sn, hesaplaşma 695.537 sn, eğitmen hakedişi 381.784 sn, program/seans 367.187 sn sürmüştür. Suite süreleri iki process altında çakışır; toplanarak wall süre hesaplanmaz. Aynı hesaplaşma dosyasının ayrı odaklı koşusu yaklaşık 284.059 sn idi; bu fark tek başına DB çekişmesinin kanıtı değildir, runner ve iş yükü farklıdır.

İnceleme: authUser her kullanıcı için admin create + password login yapar; fixturePlatform ayrıca Auth + DB kuruluşu yapar. Suite’ler çok sayıda sıralı Edge çağrısı ve bazı kasıtlı kilit/bekleme senaryoları içerir. Ortak global trigger/function enjekte eden testler bulunur. Eski loglar istek/fixture ayrımı içermediğinden Auth’un veya çekişmenin payına sayısal neden atfedilemez.

Yeni helper ölçümü her operation’ın count/total/max değerini; Auth create/login başlık gecikmesini; authUser/fixturePlatform tam süresini; suite process wall süresini CI özetine yazar. İlk final CI sonuçları API/fixture dağılımını sağlayacaktır. Bu PR Auth’u cache’lemez, iş davranışını/timeout’ları değiştirmez ve paralelliği artırmaz. Sonraki optimizasyon işi, gerçek ölçümle en pahalı hazırlıkları ve ardışık çağrıları seçmeli; test izolasyonunu bozmamalıdır.

## PR #22 geliştirme koşusu — 19 Ekim 2026

Kaynak 635e148651b2a85b18f5d40fe1fdea938ea94bf2; [run 39270054878](https://github.com/SXQHex/FtkSaaS/actions/runs/39270054878). Bu çalışma hedefli adını taşımasına rağmen 13 API dosyasının tamamını seçti. Job 35:52; test adımı 35:27; API runner 34:37.165 sürdü. Başlatma/reset/30 migration doğrulaması seçimin ardından bir dakikadan kısaydı. API özeti 282 düğüm, 280 pass/2 fail; iki fail düğümü aynı hatalı Auth hata-kodu beklentisinin alt test+üst test sonucudur.

P01-A suite'i 2:25.181; ortak api-acceptance 5:31.146 idi. Bu süreler önceki iki paralel süreçteki gözlemdir; yeni sıralı fazların süresi veya kazancı diye toplanmaz. Yeni kaynak seçimi P01-A + api-acceptance olarak iki suite'e iner; yeni modül öncelikli çalışır ve hata olursa sonraki regresyon başlamaz. Sağlıklı yeni koşunun süresi ölçülmeden dakika kazancı iddia edilmez. Bilinmeyen/paylaşılan kaynak geniş geri dönüşü, tam aday/main clean, izolasyon ve paralellik=2 korunur.

[Teşhis kaydı](history/reports/p01-a-targeted-diagnosis.json) eski başarısız SHA'yı ve henüz bekleyen yeni runtime kabulünü ayırır.

## İki suite koşusunun gerçek log süresi

Run 39278529991 / head 85e25ec48cfc8f204392a757d333e284b02b6149 loglarında runner 15:30:38 UTC'de başlar, cleanup 15:34:12'de biter: yaklaşık **3 dakika 34 saniye**; önceki 35:52 koşusuyla aynı kapsam değildir (13 yerine 2 API suite). P01 50,18 saniye ve 10/10; ortak API 112,64 saniye ve 39/41 düğüm. Ortak suite'in tek ayrı weekly quota fixture assertion'ı başarısız; hızlanma başarı kabulü değildir. Aynı logda exit 1 varken API run metadata'sı in_progress/öncesinde queued döndü; durum gecikmesi testin hiç başlamadığına kanıt sayılmaz. Yeni saat bağımsız fixture'ın CI sonucu henüz yoktur.

Aynı tree'nin boş commit head 09c9cc321204ca6a1bd3a93866d97d0ed819036e / run 39280209729 logu: 15:44:08–15:49:07 UTC, yaklaşık **4:59**. P01 72,43 saniye/10 başarılı; ortak API 163,33 saniye/aynı tek kota assertion hatası. Bu iki gerçek örnek süre değişkenliğini gösterir; sabit süre garantisi verilmez.


## 23 Ekim P07 ve belge kabulü ayrımı

P07 aday39863852941 yaklaşık18dk59sn workflow wall ile başarılıdır (22 Ekim22:17:30–22:36:29 UTC); bu tüm job CPU/runner dakikalarının toplamı değildir. PR41 belge39872819806/main39873010292 ayrı hafif belge kabulüdür, runtime hızlandırma kıyası değildir. Eski Registry sonrası asıl açık bağlantı P07 lifecycle cleanup DROP OWNED yetki hatasıydı; dar test düzeltmesi ve son gerçek full/main kabulüyle kapandı. P02 dar seçici bakım işi açık; kapsam azaltarak süre kazanılmaz.

## 25 Ekim — CLI2.122 ve güncel ölçümle dört shard dengesi adayı

Kaynak main `9fd084b9ddbbefc225c98adbf3f25ddee85a9b6e`, aynı main clean [40226464989](https://github.com/SXQHex/FtkSaaS/actions/runs/40226464989) attempt1 ve development CD40228555171 success. Bu bakım adayı CLI’ı package.json+lockfile içinde **2.122.0** sürümüne sabitler; otomatik sürüm aralığı/güncelleme PR’ı eklemez. Önceki ağırlık kaynağı P01 main7577b2f/39401570751 idi; sonraki P03–P07 ve settings modülleri aynı test processlerine eklenmişti.

| Shard | Ölçülen job süresi (checkout/npm/backend dahil) | Ölçülen test process duvarı | Yeni plan test modeli |
|---|---:|---:|---:|
| API1 |860 sn |801.29 sn |855.73 sn |
| API2 |699 sn |646.14 sn |831.29 sn |
| API3 |1577 sn |1519.53 sn |820.82 sn |
| API4 |777 sn |723.28 sn |825.38 sn |

Yeni değerler **tahmindir**, yeni CLI ile ölçülmüş başarı değildir. Test kuyruğunda en uzun process registry855.73sn; bu dosyanın içinde P05/P06/P07/ayar kabul modülleri de vardır. Yalnız dosya sayısını veya eski ağırlığı eşitlemek yanlıştı. Mevcut15 API processinin yeni wall ölçümleri başarılı kaynak/attempt/job loglarından çıkarıldı. [Ölçümler ve yeni plan](history/reports/ci-balance-20261025.json).

Dağıtım önce mevcut LPT toplam-ağırlık planını güvenli başlangıç kabul eder; aynı dört shard ve concurrency2 içinde Node’un alfabetik dosya kuyruğunu modelleyen deterministik sınırlı aramayla iyileştirir. Arama250000 düğümle sınırlıdır, duvar saati veya rastgeleliğe bağlı değildir; sonuç cache’ten kopyalanır. Mevcut toplam-ağırlık1.08 denge sınırı ve bütün suite envanter kontrolü korunur; mevcut veriyle tahmini shard duvarları arasındaki fark yaklaşık35sn’dir. Daha hızlı gerçek sonuç ancak yeni aday/main koşularından sonra kabul edilir.

Hiçbir test dosyası/alt testi taşınmadı, kaldırılmadı veya bölünmedi. Assertion ve kapsam azaltılmadı. Core verify/test:db/seed/health/advisors, temiz62 migration ve boş Auth/tenant/receipt şartı, dört zorunlu API shardı, fail-fast=false, aynı run/attempt/head toplayıcı ve merge kapısı korunur. CLI sürümü clean loguna ayrıca yazılır. CLI2.122 binary kurulumu ve kullanılan start/reset/status/stop/advisors CLI yüzeyleri yerelde doğrulandı; gerçek native stack ve tüm regresyon uyumluluğu aday/main clean’de doğrulanacak.

### Sonraki testler ve ölçüm güncellemesi

Yeni API suite’i envanterde ve pozitif ölçüm tablosunda yoksa dağıtım reddedilir; sıfır/negatif/NaN/Infinity süreye veya varsayılan uydurma ağırlığa geçiş yoktur. Yeni `.test.mjs` dosyasının clean envanterinde yer alması CI politikasıyla da zorunludur. Mevcut process içine eklenen alt testin ağırlığı process ölçümüne dahildir; süre büyümesi sonraki başarılı clean’den tekrar ölçülür. Bu bakım her yeni assertion’ın ağırlığını statik olarak ölçtüğünü iddia etmez.

`node scripts/ci/refresh-suite-durations.mjs bundle.json --write` bilinçli bakım komutudur; otomatik workflow/PR/CI tetiklemez. Bundle başarılı exact-source main push run metadata’sı, aynı attempt’in bütün job/step sonuçları ve API1–4’ün decoded loglarıdır (`run`, `jobs`, ID ile eşlenmiş `logs`). Komut önce core/API1–4/full-clean gerçek başarılı adımlarını doğrular; yanlış SHA/attempt, skipped/cancelled/failed job, eksik veya mükerrer timer, karışık CLI, yanlış shard, eksik/fazla suite verisini reddeder. `--write` yoksa yalnız sonucu gösterir. Güncelleme sonrası mevcut yapısal denge/kapsam kontrolleri ve son kaynak inceleme/aday/main kabulü gerekir. Bu araç log verisini tek başına GitHub kabulü yerine geçirmez.
