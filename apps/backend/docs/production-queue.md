# Backend geliştirme sırası ve koordinasyon

Bu dosya **sıra, bağımlı teslim paketleri ve kontrol noktalarının** sahibidir. Görevlerin kabul ölçütleri [remaining-work.md](remaining-work.md), kaynak/CI/development/hosted sonuçları [00 devir](00-FtkSaaS-yeni-sohbet-devir.md) sahibindedir. Ürün teslim hedefi [ana sözleşmeden](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md#proje-teslim-hedefi), backend çalışma modeli [yol haritasından](remaining-work.md#backend-çalışma-modeli) okunur.

## Uygulama sırası

Öncelik Pro'nun ortak uygulamasını tamamlamak ve [G02](remaining-work.md#g02) backend kabulünü kapatmaktır. Sonraki paket [G01](remaining-work.md#g01) ile aynı uygulamanın Starter kısıtları, ardından [G03](remaining-work.md#g03) ile Business ekleridir. S/P/B görev kimlikleri korunur; bu harfler ayrı kod tabanları veya bağımsız ürün geliştirme programları değildir.

**Aktif sıra:** S08 → Pro'ya uygulanabilir kalan S/P, O01/O02 ve O11 kabulleri → G02 → G01 → G03; ardından ayrı O03–O10 altyapı projesi. Görevlerin güncel açık/kapalı durumu yalnız [backlog](remaining-work.md), doğrulanmış sonuçları yalnız [devir](00-FtkSaaS-yeni-sohbet-devir.md) üzerinden alınır. S08'in doğal süre sınırı beklenirken bağımsız kalan Pro ve işletim işleri ilerler; süre kısaltılmaz ve eksik kanıt tamamlandı sayılmaz.

| Öncelik | Paket | Bağımlılık ve kontrol noktası |
|---|---|---|
| 1 | [S08](remaining-work.md#s08) hesap/güvenlik | Kalan native/hosted Auth kanıtı ve kabul oturumunun kapatılması; frontend ekran onayı backend'i bekletmez. |
| 2 | Pro ortak akışlarının kalan kabulleri | [S01–S16](remaining-work.md#ortak-uygulama-temeli) ve [P01–P16](remaining-work.md#pro-işlevleri) içindeki yürürlükteki, Pro'ya uygulanabilir açıkları kapat. |
| 3 | [O01/O02](remaining-work.md#ortak-üretim-işletimi), [O11](remaining-work.md#o11) ve [G02](remaining-work.md#g02) | Mevcut worker kanıtı, tek gerçek alarm/toparlanma kontrolü ve asgari yedek→izole restore→uygulama/temel okuma kontrolüyle Pro backend kabulünü kapat. |
| 4 | [G01](remaining-work.md#g01) Starter kısıt kabulü | Kabul edilmiş ortak temelde Starter'ın izinli akışlarını, limitlerini ve kapalı özelliklere API reddini doğrula. |
| 5 | [B01–B04](remaining-work.md#business-işlevleri) ve [G03](remaining-work.md#g03) | Mevcut Business kaynak/alt kabul kanıtını kullan; çok merkez, izolasyon ve ortak kullanım/hesaplaşma işlevlerini doğrula. |

Teslim paketinde kullanıcının istediği genel backend belge tutarlılığı taraması tamamlanır: mevcut backlog/teslim kuyruğu/devir ile main'deki yayın farkları ve eski açık/kapalı anlatımlar aynı kaynak kanıtına göre uzlaştırılır. Bu teslim kontrolüdür; yeni roadmap veya ikinci durum listesi açılmaz.

Tamamlanmış bir S/P/B görevi sıra değişti diye yeniden açılmaz. Ortak kaynakta güvenlik veya veri tutarlılığı hatası bulunursa hangi plan testinde görüldüğüne bakılmadan düzeltilir ve etkilenen plan regresyonları çalışır. Starter veya Business testlerinin mevcut CI kapsamından çıkarılması bu sıralamanın sonucu değildir.

### CRM paketinin kalan gerçek kabulleri

Pro için [P05–P07](remaining-work.md#p05), [P10–P11](remaining-work.md#p10) ve ilgili bildirim/otomasyon akışlarının yürürlükteki backend kapsamı değerlendirilir. Mevcut kişi, başvuru, onay, lead ve finans kaynakları yeniden kurulmaz. Starter temel lead/not/takip aynı uygulamadaki dar yetki kapsamıdır; ayrı CRM motoru yapılmaz.

[S14](remaining-work.md#s14) uygulamanın kendi public backend kabulüdür; kapanan işi yeniden açmadan uygulama tüketici devri kendi alanında sürer. [P07](remaining-work.md#p07) dış site contact/kayit bağlantısı ve onun gerçek form kabulü son kullanıcı kararıyla V1 kapsamı dışındadır; mevcut adaptör kaynak teslimi korunur. Eksik bir backend girdisi somut olarak kaydedilir; site sahibinin geliştirme sırası veya son ekran onayı genel backend kapanış koşulu yapılmaz.

[P08](remaining-work.md#p08)/[P09](remaining-work.md#p09) sağlayıcı işleri yalnız [yürürlükteki kapsam](remaining-work.md#ertelenmiş-ve-kapsam-dışı) gerektiriyorsa aktif sıraya girer. İptal/erteli Meta/Google bağlantıları Pro tesliminin önüne yeniden alınmaz. Tarihsel kaynak, test ve açık sağlayıcı adımları korunur; kapsam dışı olmak başarı kanıtı değildir.

## CRM paketinin iç sırası

1. Mevcut P05/P06 ortak alım, inceleme/eşleme ve Starter temel alt kümesinin kaynağını koru.
2. Uygulama widget/gateway tüketici devrini [XREQ-042](../../../docs/requests.md#xreq-042) üzerinden bağımsız sürdür; frontend kuyruğu kapanmış S14 backend kabulünü yeniden açmaz. V1'den çıkarılmış P07 dış site bağlantısını yeniden etkinleştirme.
3. P10.3 sentetik hosted dosya/önizleme/seçim/aktarım/mutabakat ile P11 deneme/takip/segment için kalan uygulanabilir backend kabullerini doğrula. İşletmeye özel gerçek veri aktarımını Pro önkoşulu yapma.
4. P14 → P15 → P16 bağımlılıklarında gerçek teslim, zamanlama ve otomasyon sonuçlarını uzlaştır; sağlayıcı kabulü gelen kutusuna teslim veya ekran kabulü değildir.
5. P08/P09 ve genişletilmiş reklam/pazarlama işleri için yalnız normatif kapsamın verdiği sırayı uygula.

## Ortak işletim hattı

[O01](remaining-work.md#o01) → [O02](remaining-work.md#o02) asgari mevcut sağlık/gerçek uyarı kontrolü ile [O11](remaining-work.md#o11) asgari veri güvenliği kontrolü mevcut teslimde yürür. Planlar arasında aynı kaynak/ortam için ortak kanıt kullanılır; Starter ve Business adına ayrı işletim, yük veya tam restore kabulü üretilmez. İşlev/yetki/limit regresyonları korunur.

[O03–O10](remaining-work.md#business-sonrası-ayrı-altyapı-projesi), G03/Business tesliminden sonra ayrı altyapı projesidir. Bu işlerin iç bağımlılıkları kendi kayıtlarında korunur; Pro/Starter/Business teslimine doğrudan veya O02 üzerinden dolaylı kapı yapılmaz. Mevcut hesap silme, erişim engelleme, dosya temizliği ve testler bu ertelemeyle değiştirilmez.

Aynı migration veya ortak sözleşmeye yazan işler seri yönetilir. Bağımsız kaynak ve kanıt işleri eşzamanlı ilerleyebilir; kesin bağımlılık görevin kendi kaydındadır. Her ilişkili pakette olumsuz senaryolar, açık ortam girdileri ve son kaynak incelemesi tamamlanır. PR bir anlamlı teslim paketidir; her fonksiyon için ayrı push veya full clean üretilmez.

## Plan bazlı kapanış

Kapanış ölçütleri [G02 Pro](remaining-work.md#g02), [G01 Starter](remaining-work.md#g01) ve [G03 Business](remaining-work.md#g03) görevlerinde tutulur. Her backend kapısı kendi gerekli kaynak/CI/development/hosted kanıtı tamamlanınca kapanır. Frontend'in ekranı veya onayı bu kapılara ek önkoşul değildir; bütünleşik ürün teslimi ve frontend kabulü kendi sahiplerinde ayrıca yürür.

Kaynak hazır, test geçti, main'e birleşti, development dağıtıldı ve hosted kabul edildi ayrı sonuçlardır. [AGENTS](../../../AGENTS.md) ve [CI politikası](../../../docs/ci-policy.md) kaynak/merge/full-clean kurallarının sahibidir; bu kuyruk yeni istisna veya kalite muafiyeti vermez.
