# CI ölçüm temeli ve sonraki performans işi

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
