# CI ölçüm temeli ve sonraki performans işi

## 20 Ekim 2026 — yeni performans kararı

Kullanıcı P01 aday ve main full clean sürelerini yaklaşık 30'ar dakika olarak bildirdi; bunlar bu belge çalışmasında loglardan yeniden ölçülmüş süre değildir. [CI-2026-10-20](decisions/CI-2026-10-20.md) ile dört ayrı runner/backend/DB shard'ı kabul edildi; uygulama/ölçüm CI-02'de bekliyor. Eski süreler yeni hız kazancı değildir. Aynı kaynak ve kapsamda seri/parçalı wall süre, shard dağılımı, kurulum/kuyruk ve toplam runner dakikası ölçülmeden 4 kat hızlanma vaat edilmez.


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

[Teşhis kaydı](../reports/p01-a-targeted-diagnosis.json) eski başarısız SHA'yı ve henüz bekleyen yeni runtime kabulünü ayırır.

## İki suite koşusunun gerçek log süresi

Run 39278529991 / head 85e25ec48cfc8f204392a757d333e284b02b6149 loglarında runner 15:30:38 UTC'de başlar, cleanup 15:34:12'de biter: yaklaşık **3 dakika 34 saniye**; önceki 35:52 koşusuyla aynı kapsam değildir (13 yerine 2 API suite). P01 50,18 saniye ve 10/10; ortak API 112,64 saniye ve 39/41 düğüm. Ortak suite'in tek ayrı weekly quota fixture assertion'ı başarısız; hızlanma başarı kabulü değildir. Aynı logda exit 1 varken API run metadata'sı in_progress/öncesinde queued döndü; durum gecikmesi testin hiç başlamadığına kanıt sayılmaz. Yeni saat bağımsız fixture'ın CI sonucu henüz yoktur.

Aynı tree'nin boş commit head 09c9cc321204ca6a1bd3a93866d97d0ed819036e / run 39280209729 logu: 15:44:08–15:49:07 UTC, yaklaşık **4:59**. P01 72,43 saniye/10 başarılı; ortak API 163,33 saniye/aynı tek kota assertion hatası. Bu iki gerçek örnek süre değişkenliğini gösterir; sabit süre garantisi verilmez.

