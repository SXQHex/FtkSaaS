# Backend geliştirme sırası ve koordinasyon

Bu dosya **sıra, bağımlı teslim paketleri ve kontrol noktalarının** sahibidir. Görevlerin kabul ölçütleri [remaining-work.md](remaining-work.md), kaynak/CI/development/hosted sonuçları [00 devir](00-FtkSaaS-yeni-sohbet-devir.md) sahibindedir. Ürün teslim hedefi [ana sözleşmeden](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md#proje-teslim-hedefi), backend çalışma modeli [yol haritasından](remaining-work.md#backend-çalışma-modeli) okunur.

## Uygulama sırası

Öncelik Pro'nun ortak uygulamasını tamamlamak ve [G02](remaining-work.md#g02) backend kabulünü kapatmaktır. Sonraki paket [G01](remaining-work.md#g01) ile aynı uygulamanın Starter kısıtları, ardından [G03](remaining-work.md#g03) ile Business ekleridir. S/P/B görev kimlikleri korunur; bu harfler ayrı kod tabanları veya bağımsız ürün geliştirme programları değildir.

**Aktif sıra:** S08 → S14 → Pro'ya uygulanabilir kalan S/P ve O kabulleri → G02. Görevlerin güncel açık/kapalı durumu yalnız [backlog](remaining-work.md), doğrulanmış sonuçları yalnız [devir](00-FtkSaaS-yeni-sohbet-devir.md) üzerinden alınır. S08'in doğal süre sınırı beklenirken S14 ve bağımsız işletim işleri ilerler; süre kısaltılmaz ve eksik kanıt tamamlandı sayılmaz.

| Öncelik | Paket | Bağımlılık ve kontrol noktası |
|---|---|---|
| 1 | [S08](remaining-work.md#s08) hesap/güvenlik | Kalan native/hosted Auth kanıtı ve kabul oturumunun kapatılması; frontend ekran onayı backend'i bekletmez. |
| 2 | [S14](remaining-work.md#s14) public backend | Gerçek sağlayıcı/hostname/config ve HTTP kabulü; kaynak testini veya frontend görünümünü hosted backend kanıtı sayma. |
| 3 | Pro ortak akışlarının kalan kabulleri | [S01–S16](remaining-work.md#ortak-uygulama-temeli) ve [P01–P16](remaining-work.md#pro-işlevleri) içindeki yürürlükteki, Pro'ya uygulanabilir açıkları kapat. |
| 4 | [O01–O10](remaining-work.md#ortak-üretim-işletimi) ve [G02](remaining-work.md#g02) | Pro kapsamındaki worker, alarm, saklama/imha, restore ve yük kanıtı tamamlanınca Pro backend kabulünü kapat. |
| 5 | [G01](remaining-work.md#g01) Starter kısıt kabulü | Kabul edilmiş ortak temelde Starter'ın izinli akışlarını, limitlerini ve kapalı özelliklere API reddini doğrula. |
| 6 | [B01–B04](remaining-work.md#business-işlevleri) ve [G03](remaining-work.md#g03) | Mevcut Business kaynak/alt kabul kanıtını kullan; çok merkez, izolasyon, ortak kullanım/hesaplaşma ve ek yük kapsamını doğrula. |

Tamamlanmış bir S/P/B görevi sıra değişti diye yeniden açılmaz. Ortak kaynakta güvenlik veya veri tutarlılığı hatası bulunursa hangi plan testinde görüldüğüne bakılmadan düzeltilir ve etkilenen plan regresyonları çalışır. Starter veya Business testlerinin mevcut CI kapsamından çıkarılması bu sıralamanın sonucu değildir.

### CRM paketinin kalan gerçek kabulleri

Pro için [P05–P07](remaining-work.md#p05), [P10–P11](remaining-work.md#p10) ve ilgili bildirim/otomasyon akışlarının yürürlükteki backend kapsamı değerlendirilir. Mevcut kişi, başvuru, onay, lead ve finans kaynakları yeniden kurulmaz. Starter temel lead/not/takip aynı uygulamadaki dar yetki kapsamıdır; ayrı CRM motoru yapılmaz.

[S14](remaining-work.md#s14) altında uygulamanın kendi public başvurusunun gerçek sağlayıcı/config/HTTP kanıtı tamamlanır. [P07](remaining-work.md#p07) dış site contact/kayit bağlantısı ve onun gerçek form kabulü son kullanıcı kararıyla V1 kapsamı dışındadır; mevcut adaptör kaynak teslimi korunur. Eksik bir backend girdisi somut olarak kaydedilir; site sahibinin geliştirme sırası veya son ekran onayı genel backend kapanış koşulu yapılmaz.

[P08](remaining-work.md#p08)/[P09](remaining-work.md#p09) sağlayıcı işleri yalnız [yürürlükteki kapsam](remaining-work.md#ertelenmiş-ve-kapsam-dışı) gerektiriyorsa aktif sıraya girer. İptal/erteli Meta/Google bağlantıları Pro tesliminin önüne yeniden alınmaz. Tarihsel kaynak, test ve açık sağlayıcı adımları korunur; kapsam dışı olmak başarı kanıtı değildir.

## CRM paketinin iç sırası

1. Mevcut P05/P06 ortak alım, inceleme/eşleme ve Starter temel alt kümesinin kaynağını koru.
2. S14'ün uygulama içi public başvuru config/gerçek HTTP kabul boşluklarını kapat; ilgili tüketici devrini [ortak talep](../../../docs/requests.md) üzerinden sürdür. V1'den çıkarılmış P07 dış site bağlantısını yeniden etkinleştirme.
3. P10 kontrollü aktarım ve P11 deneme/takip/segment için kalan uygulanabilir backend kabullerini doğrula.
4. P14 → P15 → P16 bağımlılıklarında gerçek teslim, zamanlama ve otomasyon sonuçlarını uzlaştır; sağlayıcı kabulü gelen kutusuna teslim veya ekran kabulü değildir.
5. P08/P09 ve genişletilmiş reklam/pazarlama işleri için yalnız normatif kapsamın verdiği sırayı uygula.

## Ortak işletim hattı

[A03](remaining-work.md#a03) kaynak/kanıt eşlemesinden sonra [O01](remaining-work.md#o01) worker ve [O03](remaining-work.md#o03) saklama/imha kapsamı hazırlanabilir. O01 → [O02](remaining-work.md#o02) alarm; O03 → [O04](remaining-work.md#o04)/[O05](remaining-work.md#o05) fiziksel imha → [O06](remaining-work.md#o06) bağımsız sicil → [O07](remaining-work.md#o07) guarded loader → [O08](remaining-work.md#o08) tam restore → [O09](remaining-work.md#o09) non-resurrection bağımlılıkları korunur. [O10](remaining-work.md#o10) yük/kurtarma kabulü kendi O02/O08 önkoşullarıyla yürür. E-posta yükü ilgili P14–P16 kaynağını kullanır.

Önce Pro'nun kullandığı veri yüzeyleri ve worker'lar için gereken kanıt tamamlanır. Ortak güvenlik/imha/restore sorumluluğu plan küçüldü diye kaldırılmaz. Starter aynı mekanizmaları kendi izin ve limitleri altında doğrular; Business çok merkez ve birleşik yük için ek kanıt üretir. Planlar arasında geçerli kanıt yalnız aynı kaynak, ortam, config ve yetki kapsamı için yeniden kullanılabilir.

Aynı migration veya ortak sözleşmeye yazan işler seri yönetilir. Bağımsız kaynak ve kanıt işleri eşzamanlı ilerleyebilir; kesin bağımlılık görevin kendi kaydındadır. Her ilişkili pakette olumsuz senaryolar, açık ortam girdileri ve son kaynak incelemesi tamamlanır. PR bir anlamlı teslim paketidir; her fonksiyon için ayrı push veya full clean üretilmez.

## Plan bazlı kapanış

Kapanış ölçütleri [G02 Pro](remaining-work.md#g02), [G01 Starter](remaining-work.md#g01) ve [G03 Business](remaining-work.md#g03) görevlerinde tutulur. Her backend kapısı kendi gerekli kaynak/CI/development/hosted kanıtı tamamlanınca kapanır. Frontend'in ekranı veya onayı bu kapılara ek önkoşul değildir; bütünleşik ürün teslimi ve frontend kabulü kendi sahiplerinde ayrıca yürür.

Kaynak hazır, test geçti, main'e birleşti, development dağıtıldı ve hosted kabul edildi ayrı sonuçlardır. [AGENTS](../../../AGENTS.md) ve [CI politikası](../../../docs/ci-policy.md) kaynak/merge/full-clean kurallarının sahibidir; bu kuyruk yeni istisna veya kalite muafiyeti vermez.
