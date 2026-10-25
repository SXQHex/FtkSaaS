> 25 Ekim: **FD01–FD12 frontend alan kararları tamamen kabul edildi.** [Kesin seçimler ve beş scope](02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama) önceki açık frontend değerleri bakımından üstündür. Standart negatif başlangıç 0; mevcut kulüp −2 korunur. Yeni API/enum/default uygulaması bu belgeyle yapılmadı.

> 24 Ekim ayar kapanışı: **69 ana grup kabul edildi** (17 kullanıcı/22 merkez/21 organizasyon/9 platform). Somut alan/değer/yetki/sağlayıcı ve API eşlemesi açıktır; runtime/enum/permission bu belgeyle değişmez. [Tek karar ve açık alan matrisi](02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti). Önceki S01–S10/kalan grup ifadeleri 23 Ekim aktarım sınırıdır.

> 23 Ekim 2026 güncel durum: P01–P07 kod/main/geliştirme-test kabulü kapandı; yayımlanmış kapsam **200 API / 0 contract_only / 59 migration / 90 core tablo / Edge8**. P07 runtime kaynağı `4cfc9a55`; güncel belge tabanı `bfb8ccb2`. Beş Cron hattı aktif ve boş kuyrukta healthy/idle; fiziksel imha ve gerçek yük kabulü tamamlanmış değildir. Ayar davranış sprinti ve güncel entegrasyon sınırları [tek devir](00-FtkSaaS-yeni-sohbet-devir.md) ve [ayarlar sözleşmesinde](02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti). Eski tarih/CI/pending snapshotları yeni durum kanıtı değildir; ürün kuralları yalnız son açık kararla değişir.

> Güncel öncelik: [DS-2026-10-17](../docs/decisions/DS-2026-10-17.md). Çelişen eski hükümler yalnız belirtilen kapsamda yürürlükten kalkmıştır. [Hedef sözleşme/runtime ayrımı](../docs/decision-sprint-handover.md).

> **Güncel ek: Q-E03.** Parasal iptal sınırı planlanan başlangıçtır (eşitlik dahil sonrası). Q-E02 merkez iptali korunur. Teknik durum: docs/decisions/Q-E03.md; test/CI kanıtı ayrıca doğrulanır.

# FtkSaaS — Ürün kapsam sözleşmesi

> **Güncel öncelik: Q-E02 · 0.2.0-rc.3.** Kullanıcının 16 Ekim 2026 son iptal kabulü önceki çelişen merkez iptali hükümlerinin yerine geçer. Güncel davranış/kanıt: docs/decisions/Q-E02.md, docs/claude-handover.md ve reports/qe02-verification.json. Aşağıdaki eski durum/test sayıları tarihsel kayıttır; teknik aktarım bekleyen işler tamamlandı sayılmaz.

> **Q-D01 durumu:** Etkinlik disiplin/kapsam matrisi ve negatif kredi yasağı kabul edilmiş ve runtime’a aktarılmıştır. İlk teknik aktarım raporları tarihsel kanıttır; güncel kaynak/kabul [tek devirde](00-FtkSaaS-yeni-sohbet-devir.md) ve işlem envanterindedir.

> **İlk aktarımın tarihsel sınırı:** 2.2-tech.1 döneminin iki migration ve kurulum bekleme notları bugünkü uygulama açığı değildir. D01–D09/U01–U08 aktarımı mevcuttur; bütün ürünün kabulü, hosted ve production durumu bundan çıkarılmaz.

> Güncel UUID üretim standardı: U01–U08, UUIDv7. Sağlayıcı kimlikleri korunur.

> Güncel ek: D01–D09 disiplin revizyonu kabul edilmiştir; aşağıdaki tarihsel teknik tamamlanma ifadeleri yeni kapsamı içermez. Kabul hükümleri belgenin sonundadır; güncel kalan uygulama listesi docs/remaining-work.md üzerinden okunur.

Karar tarihi: 14 Ekim 2026

Son güncelleme: 17 Ekim 2026 — DS-2026-10-17 sözleşme aktarımı; uygulama/kabul ayrı izlenir

## Belgenin durumu

Bu belge, yeni FtkSaaS için açıkça kabul edilmiş ürün kapsamını tanımlar. Önceki kapsam belgesindeki 14 modül ve 33 özellik yeni proje kararları olarak korunur. Eski proje, todo listeleri, kod, tablolar, iş kuralları, garantiler ve geliştirme modeli gereksinim kaynağı değildir. Yeni projenin hiçbir özelliği bu belgeyle uygulanmış sayılmaz.

Bu belge, geliştirme için yazılı kapsam sözleşmesi ve esas başvuru kaynağıdır. Eski todo listeleri bu sözleşmenin kaynağı değildir. Sonradan açıkça kabul edilen değişiklikler bu belgeye işlenir; öneriler tek başına kapsam değişikliği sayılmaz. Fiyatlandırma, teslim tarihi veya hukuki hizmet sözleşmesi yerine geçmez.

- Kapsam durumu: Kabul edildi / Sonraki aşama / Kapsam dışı.
- Uygulama/kabul durumu özellik bazında docs/feature-delivery.md ve makine feature_delivery eşlemesindedir; işlem sayısı ürün tamamlanma oranı değildir.
- Planlar: Starter, Pro ve Business aynı backend iş modelini kullanır; plan farkı erişim ve kullanım limitidir.
- Bu belge fiyat, kesin eğitmen/öğrenci limitleri veya sınırsız kullanım taahhüdü belirlemez. İlk paket şablonundaki sayılar tavsiye olarak kalır.
- Pro özellikleri Business'a da dahildir. Temel güvenlik, veri bütünlüğü ve kayıt geçmişi bütün planlarda geçerlidir.
- Starter'ın ortak temel özellikleri Pro ve Business'a da dahildir. Bir modülün ayarını etkinleştirmek, abonelik planında bulunmayan özelliğe erişim sağlamaz.
- Ayarlanabilir sayısal değerlerin kesinleşmemiş olması ortak altyapı geliştirmesini engellemez. Başlangıç değerleri ve ayrıca karar gerektiren davranışlar aşağıda ayrılmıştır.

## Modüller ve sorumluluk sınırları

| ID | Modül | Sahip olduğu işler | Sınır |
|---|---|---|---|
| M01 | Organizasyon ve merkezler | İşletme, merkez, oda/kaynak, çalışma saatleri; organizasyonun zorunlu ve merkezlerin değiştirebildiği tavsiye ayarları | Kullanıcı yetkisini, abonelik erişimini veya alanların işlem sonuçlarını belirlemez. |
| M02 | Kimlik ve erişim | Hesap, oturum, roller, işletme/merkez kapsamı, personel izinleri | Kişi ilişkilerini, kredi ve borcu yönetmez. |
| M03 | Kişiler ve üyelik ilişkileri | Kişi kaydı, iletişim bilgileri, işletmeyle öğrenci/eğitmen/personel ilişkisi | Oturum, aday takip süreci ve ücretli kullanım hakları burada tutulmaz. |
| M04 | Planlama ve rezervasyon | Grup programları, açık dersler, özel ders talepleri, kesin rezervasyon, kaynak uygunluğu, kontenjan, bekleme listesi, eğitmen değişikliği | Yoklama, kredi hareketi ve tahsilatın sahibi değildir. |
| M05 | Ders gerçekleşmesi ve katılım | Yoklama, gerçekleşen ders, gelmeme, iptal/erteleme ve yerine düzenlenen seans ilişkisi | Kredi ve hakediş kayıtlarını kendi içinde çoğaltmaz. |
| M06 | Ders paketleri, süreli üyelikler ve kullanım hakları | Katalog, öğrenciye tanımlanan hak, geçerlilik, kullanım sınırı, tüketim/iade, dondurma ve plan değişimi | Para hareketi ve işletmenin SaaS aboneliğini yönetmez. |
| M07 | Finans ve tahsilat | Borçlandırma, manuel tahsilat, kısmi ödeme, alacak bakiyesi, iade ve düzeltmeler | Kullanım hakkını doğrudan değiştirmez; tam muhasebe, bordro ve stok kapsam dışıdır. |
| M08 | Eğitmen hakedişleri | Ücret anlaşması, gerçekleşen görevlendirmeye dayalı hakediş, ödeme durumu | Planlama, yoklama, işe alım ve bordro yapmaz. |
| M09 | CRM | Aday kaynağı, ilgi, deneme teklifi, takip, dönüşüm, mevcut öğrenci yenileme/geri kazanma süreçleri | Ayrı kişi veritabanı kurmaz; öğrenci operasyonlarını devralmaz. CRM yönetimi yöneticidedir; günlük aday/takip işlemleri merkez kapsamlı ayrı izinlerle operasyon personeline açılabilir. İndirim yetkisi verilmez. |
| M10 | Bildirimler | İşlemsel iletiler, hatırlatmalar, kanal tercihleri, teslimat durumu | İptal, kredi, rezervasyon veya kampanya hedefleme kararını vermez. |
| M11 | Raporlama | Kaynak modüllerden göstergeler, karşılaştırmalar ve dışa aktarım | Borç, kredi, katılım veya hakediş üretmez. |
| M12 | SaaS aboneliği ve ürün erişimi | İşletme planı, ürün limitleri, modül erişimi ve abonelik durumu | Öğrencilere satılan ders paketlerini yönetmez. |
| M13 | Etkinlik | Atölye/organizasyon tanımı, kayıt, katılım koşulları ve etkinlik yaşam döngüsü | Kaynak rezervasyonunu M04, para hareketini M07 yönetir. Ayrı kişi, takvim ve ödeme sistemi kurulmaz. |
| M14 | Belge ve onay yönetimi | Form, belge sürümü, kabul eden kişi, zaman, ilgili işlem ve gerekli belge kontrolleri | CRM kampanyasını veya ders hakkını yönetmez. |

Bu modüller ayrı servis veya ayrı uygulama zorunluluğu değildir. Yeni backend için sorumluluk alanlarıdır. Supabase üzerinde tek modüler backend ve multi-frontend sözleşmesi kabul edilmiştir; ayrıntıları teknik sözleşmededir. “Üyelik ilişkisi” kişinin işletmeyle ilişkisini; “süreli üyelik” satın alınan kullanım hakkını; “SaaS aboneliği” işletmenin yazılım planını ifade eder.

## Özellik ve plan matrisi

“Temel” ve “gelişmiş” ifadelerinin sınırları aşağıdaki tamamlanma ölçütleriyle belirlenir. Çizgi o planda kapsam dışında demektir. Her satırın uygulama/kabul sınırı feature_delivery haritasında ayrıca izlenir.

| ID | Özellik | Sahip | Starter | Pro | Business | Kapsam durumu |
|---|---|---|---|---|---|---|
| F01 | İşletme, merkez, oda ve kaynak tanımı | M01 | Tek merkez | Tek merkez | Çoklu merkez | Kabul edildi |
| F02 | Çalışma saatleri, izin ve uygunluk | M01/M04 | Temel | Tam | Tam | Kabul edildi |
| F03 | İşletme kuralları ve merkez istisnaları | M01 | İşletme ayarları | İşletme ayarları | Zorunlu/tavsiye merkez hiyerarşisi | Kabul edildi |
| F04 | Hesap eşleştirme, çoklu rol, kapsamlı yetkilendirme | M02/M03 | Var | Var | Merkez kapsamlarıyla | Kabul edildi |
| F05 | Resepsiyon/operasyon personeli izinleri | M02 | — | Var | Var | Kabul edildi |
| F06 | Öğrenci/eğitmen panelleri, profil ve şifre işlemleri | M02 + ilgili alanlar | Var | Var | Var | Kabul edildi |
| F07 | Tek kişi kaydı, adaydan öğrenciye dönüşüm | M03/M09 | Tek kişi altyapısı | CRM dönüşümü | CRM dönüşümü | Kabul edildi |
| F08 | Birleşik takvim ve kaynak çakışma kontrolü | M04 | Temel | Tam | Merkez bazlı | Kabul edildi |
| F09 | Özel ders talep, onay, ret ve alternatif saat | M04 | Var | Var | Var | Kabul edildi |
| F10 | Tekrarlayan grup programı ve sabit gruba kayıt | M04 | Var | Var | Var | Kabul edildi |
| F11 | Kontenjanlı açık grup dersine öğrencinin kaydolması | M04 | — | Var | Var | Kabul edildi |
| F12 | Bekleme listesi ve süreli yer teklifi | M04 | — | Var | Var | Kabul edildi |
| F13 | Eğitmen değişikliği | M04/M08 | — | Var | Var | Kabul edildi |
| F14 | Yoklama, gelmeme, iptal, erteleme ve yerine seans düzenleme | M05 | Var | Var | Var | Kabul edildi |
| F15 | Ders sayılı paket, geçerlilik ve kredi hareketleri | M06 | Temel | Tam | Tam | Kabul edildi |
| F16 | Süreli/sınırsız üyelik, dönemsel kullanım sınırı | M06 | — | Var | Var | Kabul edildi |
| F17 | Üyelik/paket dondurma ve plan değişimi | M06 | — | Var | Var | Kabul edildi |
| F18 | Merkezler arasında kullanım hakkı ve onaylı hesaplaşma | M06/M07 | — | — | Var | Kabul edildi |
| F19 | Manuel tahsilat, kısmi ödeme, iade/düzeltme ve alacak | M07 | Var | Var | Var | Kabul edildi |
| F20 | Eğitmen hakedişi ve ödeme takibi | M08 | — | Var | Var | Kabul edildi |
| F21 | Aday, kaynak, ilgi, takip ve dönüşüm | M09 | — | Temel | Gelişmiş | Kabul edildi |
| F22 | Deneme teklifi ve kontrollü indirim | M09/M06/M07 | — | Var | Var | Kabul edildi |
| F23 | Yenileme ve hareketsiz öğrenci takip listeleri | M09 | — | Var | Var | Kabul edildi |
| F24 | Davranışa dayalı segmentler ve takip otomasyonu | M09/M10 | — | — | Var | Kabul edildi |
| F25 | Paylaşılabilir işletme takvimi ve başvuru/kayıt sayfası | M04/M09/M13 | — | Var | Var | Kabul edildi |
| F26 | Talep sonucu, ders değişikliği ve benzeri işlemsel bildirimler | M10 | Uygulama içi | Var | Var | Kabul edildi |
| F27 | Otomatik yaklaşan ders/paket bitiş hatırlatmaları | M10 | — | Var | Var | Kabul edildi |
| F28 | Operasyon ve finans raporları, tarih filtresi, dışa aktarım | M11 | Temel | Tam | Birleşik ve merkez bazlı | Kabul edildi |
| F29 | Atölye/etkinlik, kontenjan, kayıt ve katılım | M13 | — | Var | Var | Kabul edildi |
| F30 | Temel form ve sürümlü belge onayı | M14 | Var | Var | Var | Kabul edildi |
| F31 | Öğrenci, kalan kredi ve borç için veri içe aktarma | Ortak aktarım + M03/M06/M07 | Var | Var | Var | Kabul edildi |
| F32 | İşletme aboneliği, erişim ve kullanım limitleri | M12 | Var | Var | Var | Kabul edildi |
| F33 | Denetlenebilir geçmiş ve yinelenen işlem koruması | Bütün yazma alanları | Var | Var | Var | Kabul edildi |

## Kritik tamamlanma ölçütleri

### Kimlik, kişiler ve günlük kullanım

- Hesap–kişi eşleştirmesi ve birden fazla rol desteklenir; kişi tekrar oluşturulmaz. İşletmeler arası veriye erişim bu ortak kimlikten dolayı açılmaz.
- Öğrenci yalnızca kendi derslerini, haklarını ve ödeme durumunu görür. Eğitmen kendi programını ve yetkili olduğu öğrencileri görür.
- Operasyon personeline yoklama, rezervasyon veya tahsilat izni ayrı verilebilir. Finansın tamamı ve CRM erişimi otomatik verilmez.
- Tablo arama, sıralama, sayfalama ve kayıt üzerinden işlem başlatma ortak arayüz ihtiyaçlarıdır; yeni backend modülü değildir.

### Planlama, bekleme listesi ve ders gerçekleşmesi

- Bekleyen özel ders talebi odayı bloke etmez. Onay anında oda/eğitmen çakışması yeniden kontrol edilir; planlanan grup kullanımı görünür. Öğrenci bekleyen talebi geri çekebilir; yönetici gerekçeli reddedebilir veya alternatif saat sunabilir.
- Sınıfın dış katılıma açıklığı ile paketin öncelikli/esnek rezervasyon biçimi ayrı boyutlardır. Öncelikli paket ilgili seansları topluca, esnek paket kalan nominal kontenjanı tek tek kullanır; aynı sınıfta iki biçim birlikte bulunabilir. Öğrencinin açık grup dersine kaydolması, özel dersin otomatik onaylanacağı anlamına gelmez.
- Bekleme listesine katılmak kesin rezervasyon oluşturmaz ve kredi tüketmez. Yer açıldığında sıradaki uygun kişiye süreli teklif verilir; kabul edilmezse sıradakine geçilir.
- Teklif edilen yer, teklif süresince başkasına satılmayacak şekilde geçici ayrılır. Bu, bekleyen özel ders talebinin oda bloke etmesinden ayrı bir işlemdir.
- Kabul anında kontenjan, kullanım hakkı, belge ve katılım koşulları kontrol edilir; eşzamanlı işlemler ilgili nominal/maksimum sınırı aşamaz. Öncelikli kayıt maksimum, esnek kayıt/yer teklifi nominal sınıra tabidir; toplam yer tutma ortaktır. Mevcut rezervasyonlar kapasite değişikliğinde otomatik iptal edilmez. Başlangıçta listeye giriş zamanı sırası ve 30 dakika teklif süresi kullanılır; süre dersin başlangıcını veya kayıt kapanışını geçemez.
- Bekleme listesinden otomatik kesin kayıt ilk kabul edilen kapsamda değildir; süreli kabul akışı yeterlidir.
- Öğrenci iptali, eğitmen iptali ve gelmeme ayrı değerlendirilir. Varsayılan 12 saat iptal/kredi sınırı yalnızca özel ders içindir; grup ve etkinliğe kendiliğinden uygulanmaz. Organizasyon/merkez ayarlarıyla yönetilir.
- Ders iptali, yerine seans düzenleme, kredi ve bildirim akışı koordine edilir; aynı işlem tekrarlandığında ikinci kredi hareketi oluşmaz.
- Eğitmen değişikliği dersi yeniden oluşturmaz; gerçekleşen görevlendirme hakedişe esas olur.

### Kullanım hakları ve finans

- Ders sayılı paket ile süreli üyelik aynı kullanım hakları alanında farklı ürün türleridir. Haftalık/dönemsel sınır ve sınırsız kullanım para tahsilatından ayrı tanımlanır.
- Dondurma, geçerlilik uzatma ve plan değişiminin etkileri kayıt geçmişinde izlenir. Dondurma ve kişiler arası devir başlangıçta kapalıdır. Dondurmayı merkez yöneticisi etki önizlemesiyle uygular; süre uzatımı satış koşuluna bağlıdır. Dondurma aralığındaki ilgili rezervasyonlar onaylı işlemin parçası olarak iptal edilir, hak/yer serbest kalır; sonrasında otomatik rezervasyon yapılmaz. Erken bitirme, ürün değişimi ve yenilemede kalan hakların kabul edilmiş kuralları teknik sözleşme bölüm 17’dedir.
- Öğrenci borcu ile kullanım hakkı ayrı kayıt sahipliklerine sahiptir; ilişkili işlemler ortak akışta yürütülür.
- Tahsilat tutarı, tarihi, işlemi yapan kişi ve açıklama saklanır. Kısmi ödeme desteklenir; düzeltme ve iade geçmişi silmez.
- Fazla tahsilat borcu eksi göstermek yerine ayrı öğrenci alacağı olarak izlenir; kalan borç sıfırın altına düşmez.
- Business'ta paketin geçerli olduğu merkezler, tahsilatın ve kullanımın ait olduğu merkez izlenebilir. DS-2026-10-17 ile uygun kredili kullanımın A→B payı ve onaylı hesaplaşması kabul edildi; süreli/sınırsız aktarım üretmez. Otomatik para transferi yoktur; runtime ayrı teslimdir.

### CRM, bildirim ve etkinlik

- CRM yönetimi yöneticidedir; aday, takip ve önceden tanımlı deneme teklifi işlemleri merkez/atanmış aday kapsamıyla operasyon personeline ayrı izinlerle açılabilir. İndirim/fiyat değiştirme, toplu dışa aktarım, segment ve otomasyon yönetimi verilmez. Erişim backend/veri düzeyinde uygulanır. CRM geliştirmesi temel kullanıcı operasyonlarından sonra gelir.
- Pro CRM: aday kaynağı/ilgi, takip görevi, deneme teklifi, dönüşüm, yenilemeyen ve hareketsiz öğrenci listeleri. Business bunlara davranış segmentleri ve otomatik takip ekler.
- Deneme teklifi ve indirim, kullanım hakkını veya para hareketini CRM içinde kopyalamaz; ilgili modüle uygulanır.
- Bildirim modülü teslimatı yönetir; hedef ve iş sonucu ilgili alanın sorumluluğudur. Önce uygulama içi kanal; dış kanallar ve kullanım ücretleri ayrıca belirlenir.
- Etkinlik M13 tarafından yönetilir; oda/eğitmen rezervasyonu M04, ücret/iade M07 üzerinden yürür. Dönemlik grup programı etkinlik modülüne taşınmaz.
- Etkinlik kaydı ve deneme başvurusu paylaşılabilir sayfadan alınabilir. Tam web sitesi oluşturucu kapsamda değildir.

### Belge, aktarım, rapor ve ürün erişimi

- Belge kabulünde sürüm, kabul eden kişi, zaman ve ilgili işlem saklanır. Belgenin gerekli olduğu noktalar tanımlanabilir; dijital kabulün hukuki yeterliliğine ilişkin bir taahhüt verilmez.
- İçe aktarmada alan eşleştirme, önizleme, doğrulama ve hatalı satır raporu bulunur. Açılış kredi/borçları ilgili modüllerde izlenebilir kayıt olarak oluşturulur; yeniden yükleme mükerrer kayıt üretmez.
- Starter raporları temel tahsilat/borç ve ders/katılım özetlerini; Pro paket yenileme, doluluk, kaynak kullanımı, hakediş ve CRM dönüşümlerini; Business merkez bazlı ve birleşik karşılaştırmaları kapsar.
- Kullanım oranında çalışma saatleri ve izinler hesaba katılır. Dışa aktarım yalnızca ekranda görünen sayfayı değil, yetkili ve filtrelenmiş bütün sonucu kapsar.
- Plan erişimi yalnızca menü gizleyerek uygulanmaz; backend doğrular. Plan düşürmede mevcut veriler silinmez. Aktif öğrenci sayımı ve plan geçiş davranışları aşağıdaki kabul edilmiş revizyonlarla belirlenmiştir; kesin sayısal limitler ticari kullanıma açılmadan belirlenir.
- Kritik iş kuralları frontend'e bağlı değildir; web, Android, iOS, macOS ve Windows aynı operasyonları ve yetki kontrollerini kullanır.

## Öncelik sırası

Bu sıralama yapılacak işlerin bağımlılık sırasıdır; mevcut uygulamada tamamlandığına dair beyan değildir.

| Aşama | Kapsam |
|---|---|
| 1 — Ortak temel | Organizasyon/merkez, kişi, hesap/roller, personel izinleri, kural sahipliği ve kayıt bütünlüğü |
| 2 — Günlük operasyon | Paneller, birleşik takvim, özel ders talepleri, grup kaydı, açık ders, bekleme listesi, yoklama ve eğitmen değişikliği |
| 3 — Hak ve para | Paket/süreli üyelik, dondurma, kredi, tahsilat/iade/alacak ve hakediş |
| 4 — Pro operasyon kapsamı | Etkinlik, belge/form, paylaşılabilir kayıt sayfası, veri aktarımı, bildirim/hatırlatma ve operasyon raporları |
| 5 — CRM | Aday ve deneme süreci, kontrollü indirim, dönüşüm, yenileme/geri kazanma takibi |
| 6 — Business kapsamı | Çoklu merkez, ortak kullanım hakları, merkez kuralları, birleşik raporlar ve CRM otomasyonları |

SaaS erişim altyapısı ortak temelle tasarlanır; ticari planların etkinleştirilmesi kapsam ve limit kararlarından sonra yapılır. Her aşamanın tamamlanması yalnızca yeni FtkSaaS üzerinde kabul ölçütleriyle doğrulanır. Eski kod envanteri çıkarılmaz. Bu sıralama ürün önceliğidir; teknik bağımlılık sırası teknik sözleşmede ayrıca netleşecektir.

Pro kapsamının tamamlanması, 5. aşamadaki Pro CRM özelliklerini de gerektirir. Aşama sırası tek başına teslim veya üretime çıkış onayı değildir.

## Sonraki aşama ve kapsam dışı

| Yetenek | Durum |
|---|---|
| Hediye kartı, referans ödülü | Sonraki aşama; Pro için ilk tamamlanma koşulu değil |
| Kiosk/QR check-in, mat veya cihaz seçimi | Sonraki aşama; doğrulanmış ihtiyaca bağlı |
| Markalı uygulama, video içerikleri, AI resepsiyon, müşteri keşif ağı | Sonraki aşama; mevcut kapsamın teslimat koşulu değil |
| Genel API/webhook ve üçüncü taraf entegrasyonlar | Sonraki aşama; ortak çoklu frontend backend'i gerekliliği korunur |
| Online kart ödeme, otomatik kart tahsilatı | Mevcut kapsam dışında; nakit/manuel ödeme tercihi korunur |
| Öğrenci gelişim takibi ve veli hesabı | Kapsam dışında |
| Bordro, işe alım, tam muhasebe, stok/ürün satışı | Kapsam dışında |

## Ayarların sahipliği ve değiştirme yetkisi

Kuralın anlamı ve kayıt etkisi iş modelidir; süre, sayı, oran ve izin gibi değerler ayardır. Ayar değişikliği yeni bir modül veya ayrı bir genel kural motoru gerektirmez. M01 politika değerlerini, M02 değiştirme yetkisini yönetir; ilgili alan modülü kuralı uygular.

| Düzey | Örnekler | Yetki ve sınır |
|---|---|---|
| Ürün/SaaS | Plan fiyatı, plan limitleri, modül erişimi | Bizim ürün yönetimimiz belirler. İşletme veya merkez değiştiremez. |
| Organizasyon/işletme | İptal, rezervasyon, dondurma, borçlu katılım, bildirim politikaları | Yetkili organizasyon yöneticisi belirler. Business'ta zorunlu veya tavsiye olarak yayımlar. |
| Merkez/şube | İzin verilen yerel operasyon değerleri | Yetkili merkez yöneticisi yalnızca tavsiye ayarlarını veya açıkça devredilmiş alanları değiştirir; zorunlu kuralları aşamaz. |
| Paket/üyelik/etkinlik | Geçerlilik, kullanım sınırı, geçerli merkezler, etkinliğe özel katılım/iade koşulları | Yetkili yönetici belirler; ürün erişimini veya organizasyonun zorunlu sınırlarını aşamaz. |

- Starter ve Pro tek merkezli yapı içinde işletme politikalarını kullanır; Business merkezler arası miras ve istisnaları ekler.
- Değerin kaynağı (ürün başlangıcı, organizasyon, merkez veya ilgili paket/etkinlik) ve değiştirilebilirliği ayar ekranında görünür. Geçersiz değerler backend'de de reddedilir.
- Zorunlu üst kurallar bütün alt düzeylerde korunur. İzin verilmiş paket/etkinlik koşulu, yoksa merkez ayarı, yoksa organizasyon ayarı, yoksa ürün başlangıcı kullanılır. Her ayarın hangi düzeylerde tanımlanabildiği açıktır; her ayar her düzeye kopyalanmaz.
- Güvenlik, veri izolasyonu, kayıt geçmişi, yinelenen işlem koruması ve kontenjan/para/kredi bütünlüğü işletmenin kapatabileceği ayarlar değildir.

## Başlangıç değerleri

Aşağıdaki değerler yeni yapılandırmalar için bu sürümün değiştirilebilir başlangıçlarıdır. FtkSaaS içinde sonradan oluşacak satılmış paketleri veya yapılmış rezervasyonları kendiliğinden değiştirmez. Önceki mesajdaki örneklerden bu tabloya alınmayan değerler karar sayılmaz.

| Ayar | Başlangıç değeri | Kapsam/sınır |
|---|---|---|
| Bekleme sırası | Listeye giriş zamanı | İlk kapsamda öncelikli/VIP sıra yoktur. Eşit zamanlarda kararlı sıra korunur. |
| Bekleme teklifi kabul süresi | 30 dakika | Organizasyon/izin verilen merkez ayarı; etkin süre kayıt kapanışı veya ders başlangıcıyla sınırlanır. |
| Teklifin reddedilmesi veya süresinin dolması | Sıradaki uygun kişiye geçiş | M04'ün sabit akış davranışıdır; teklif geçmişi korunur. |
| Bekleme listesinden otomatik kesin kayıt | Kapalı | İlk kapsamda otomatik kayıt özelliği yoktur; ayarı açarak kapsam genişletilemez. |
| Özel ders iptal/kredi sınırı | Dersten 12 saat önce | Yeni kapsam sözleşmesi v1.1 içinde açıkça yer alan başlangıç değeri olarak korunur; eski uygulama garantisi değildir. Grup ve etkinliğe uygulanmaz. |
| Paket/üyelik dondurma | Kapalı | Pro/Business'ta politika ve etkileri tanımlandıktan sonra yönetici etkinleştirir. |
| Kişiler arasında paket devri | Kapalı | Devir açılması ayrıca kapsam ve işlem modeli kararı gerektirir; F17'deki ürün/plan değişimiyle aynı değildir. |
| Etkinlikte ders paketi kullanımı | Kapalı | Etkinliğe uygun paketler açıkça tanımlanarak izin verilebilir. |
| Yaklaşan ders hatırlatması | 24 saat önce | Pro/Business; etkin kanaldan, ilk aşamada uygulama içi. Aynı rezervasyon için aynı hatırlatma tekrar üretilmez. |

Grup/etkinlik iptali, borçlu katılım, paket bitiş hatırlatması, kayıt pencereleri ve geçerlilik süreleri için bu belgede yeni sayısal değer icat edilmez. Eski sistemin politikası alınmaz; yeni yapılandırmada gereken değer işletmenin kurulumunda açıkça girilir. Veri yokluğu otomatik izin veya otomatik ret olarak yorumlanmaz; ilgili işlem açılmadan önce gerekli yapılandırma tamamlanır.

## Ayar değişikliğinin kayıt etkisi

- Her ayar değişikliğinde kim, ne zaman, hangi kapsamda ve hangi eski/yeni değeri değiştirdiği izlenir; yürürlük zamanı bellidir.
- Satışta paket/üyelik koşulları, kesin rezervasyonda rezervasyon/iptal koşulları, etkinlik kaydında ilgili katılım/iade koşulları sürümüyle ilişkilendirilir. Yer teklifi kendi son geçerlilik zamanını korur.
- Sonraki ayar değişikliği bu kayıtların geçmiş koşullarını veya oluşmuş borç/kredi/hakediş hareketlerini yeniden hesaplamaz. Yeni koşullar yürürlükten sonra oluşturulan ilgili kayıtlara uygulanır.
- Mevcut kayıtlara değişiklik uygulamak ayrı ve yetkili bir işlemdir: etkilenecek kayıtlar ve sonuçlar önceden gösterilir, gerekçe ve değişiklik geçmişi saklanır. Finansal/kredi düzeltmeleri geçmişi silerek yapılmaz.
- Kullanım hakkı, kontenjan, güncel erişim yetkisi ve belge uygunluğu işlem anında yeniden kontrol edilir. Tarihsel koşul koruması süresi dolan hakla kullanım veya yetkisiz erişim sağlamaz.
- Henüz gönderilmemiş hatırlatmalar güncel bildirim tercihleriyle yeniden planlanabilir; gönderilmiş bildirim geçmişi korunur. Bu durum sözleşmesel iptal/iade koşullarını değiştirmez.

## Ayrı karar gerektiren konular ve karar zamanı

| Konu | Ne zaman gerekli? | O zamana kadar davranış |
|---|---|---|
| Fiyatlar, ek merkez bedeli, eğitmen/öğrenci sayıları | Ticari planlar kullanıma açılmadan önce | Sayılar tavsiye; satış veya sınırsız kullanım taahhüdü yok. |
| Aktif öğrenci sayımı ve plan geçişi | Davranış kabul edildi; sayısal limitler ticari açılıştan önce | Aşağıdaki kurallar ve teknik sözleşme uygulanır; veri silinmez. |
| Dondurmayı erken bitirme; yenilemede kalan hak; ürün değişiminde hak/fiyat farkı | İş kararları kabul edildi | Teknik sözleşme bölüm 17 uygulanır; API ayrıntıları O4’te hazırlanacak. |
| Etkinlik iptal/iade koşulları | İlgili etkinlik kayda açılmadan önce | Etkinliğe açık politika tanımlanır; özel dersin 12 saat kuralı kopyalanmaz. |
| Merkezler arası hesaplaşma | DS-2026-10-17 ile kabul edildi; runtime ayrı teslim | Kredili gerçek satış bedeli payı, onaylı kısmi ödeme/mahsup; otomatik para transferi yok. Grantor DS-OPEN-01 kapalı; merkez bazlı grant ve iki taraflı hesaplaşma runtime’ı uygulanmıştır; vaka bazlı gerçek kabul hesaplaşma devri ve F01–F33’te ayrılır. |
| Dış bildirim kanalı, sağlayıcı ve kullanım maliyeti | İlgili kanal etkinleştirilmeden önce | Uygulama içi kanal kullanılır; dış kanal teslimatı taahhüt edilmez. |

Bu konuların tamamını şimdi sonuçlandırmak gerekmez. Karar yalnızca ilgili özelliğin belirsiz davranışını engeller; diğer geliştirmeleri durdurmaz.

## 15 Ekim 2026 — Kabul edilmiş kapsam ve davranış revizyonları

Bu bölüm önceki sürümdeki çelişen hükümlerin yerini alır. Uygulama ayrıntılarının tek kaynağı 02-FtkSaaS-teknik-sozlesme.md v2.0'dır; aşağıdaki özet kapsam statüsünü günceller. T01–T12 kabul edilmiştir. Yeni bir kodlama veya dağıtım yetkisi verilmemiştir.

### Organizasyon, kişiler ve yetkiler

- Organizasyon başına tek aktif owner; diğer bütün rollerden birden fazla kişi olabilir. Owner nihai muhatap, abonelik/kapama/organizasyon yöneticisi atama yetkilisidir. Owner atama/kaldırma yalnız FtkSaaS’a aittir, müşteri owner devri yapamaz; owner kendi/başka merkez yöneticisini atayabilir ve kendi merkez yöneticiliğini kaldırabilir. Organizasyon yöneticisi kuralları belirler, bütün merkezleri okur/raporlar. Her ikisi de merkez operasyonu için ilgili merkezde ayrıca yönetici atanmalıdır.
- Merkez yöneticisi kendi merkezinin operasyon, katalog/fiyat ve eğitmen anlaşmalarını yönetir; zorunlu organizasyon sınırlarını aşamaz. Hassas düzeltmeler gerekçeli ve izlenebilirdir. Operasyon personelinin kişi, rezervasyon, yoklama, satış ve tahsilat izinleri ayrıdır; iade, kredi/fiyat/anlaşma düzeltme ve yetki dağıtma yoktur.
- Eğitmen kendi programı/katılımcı bilgisi/hakedişini görür, görevlendirildiği seansın yoklamasını alır/kapatır; operasyon değişikliği yapmaz. Eğitmen asistanı sınıf/seans bazında açık yoklama alır/düzeltir, kapatamaz. Aynı seansta öğrenci ve görevli asistan olamaz; etkinlikte de geçerlidir. Yoklama kapandıktan sonra merkez yöneticisi gerekçeli düzeltir.
- Hesap organizasyonlar arasında ortak, kişi kaydı organizasyon içinde ortaktır. Davet hedef e-postaya bağlı süreli/tek kullanımlıktır; yeni kullanıcı bağlantıyla şifre belirler, mevcut kullanıcı girişle bağlantıyı kabul eder. Hesapsız kişi adına merkez kayıt yapabilir. Güncel erişim backend'de her işlemde kontrol edilir; bağlantı kaldırılması geçmişi silmez.
- Mükerrer kişi birleştirme aynı organizasyonda, kontrol ve denetimle mümkündür. İşlemi yapanın yönetici olmadığı her etkilenen merkezden yönetici onayı gerekir. İletişim bilgisi eşitliği otomatik eşleştirme/birleştirme değildir.

### Hak, rezervasyon ve finans

- Oda kapasitesi varsayılan sağlar; yönetici seansa nominal/maksimum kontenjan belirler. Esnek kayıt nominale, öncelikli kayıt maksimuma kadar alınır. Kesin rezervasyon ve aktif teklifler ortak yer tutar. Mevcut kayıt kapasite değişikliğiyle otomatik iptal edilmez.
- Kredili/süreli hak, öncelikli/esnek rezervasyon ve taahhüt/iade koşulu bağımsızdır. İadeli/iadesiz ve gerekiyorsa hesap yöntemi üründe tanımlanır, satış koşulu korunur. Kullanılmamış hak otomatik para iadesi veya borç silme hakkı değildir.
- Kesin rezervasyonda hak ayrılır. Taslak yoklama tüketmez; kapanışta sonuç/politika uygulanır. Eksik yoklama kendiliğinden noShow olmaz. Talep/rezervasyon/seans/yoklama/teklif durumları teknik sözleşmede ayrıdır.
- İşletme iptalinde ayrılmış kredi serbest kalır; otomatik seans arama/öteleme veya ayrı telafi kredisi yoktur. Yönetici planlamayı yapar. Geçerlilik sorunu gösterilir, yönetici uzatabilir; süreli üyelik otomatik uzamaz.
- Esnek kayıtta uygun kullanılabilir haklardan önce en erken bitecek, eşitlikte önce alınan paket seçilir. Öncelikli kayıt kaynak paketine bağlıdır. Negatif kredi limiti ayrılmış ve tüketilmiş açığı birlikte kapsar; kişisel değer varsayılanın yerine geçer, zorunlu üst sınır korunur. Yeni uygun hak önce açığı kapatır.
- Para borcu ve negatif kredi ayrıdır. Borçlu rezervasyon ve katılım ayrı politikalardır. Borçla katılım engeli ayrı gerekçedir; kredi etkisi tanımlanır, otomatik noShow değildir.
- Bütün öğrenci tahsilatını merkez yapar. Seçilmiş borca, seçim yoksa aynı merkez/para birimindeki en eski vadeli borca dağıtılır. Fazla tahsilat öğrenci alacağıdır. Alacak yönetici tarafından kısmi/tam iade edilebilir veya yetkili personelin açık işlemiyle aynı merkez/para birimindeki borca mahsup edilebilir; mahsup nakit değildir.
- Paket sonlandırmada kullanılmamış serbest haklar açık işlemle kapatılır; DS kararına göre korunan kesin rezervasyon yükümlülükleri korunur. Rezervasyon iptali ayrıca açık ve gerekçeli merkez müdahalesidir. Para iadesi ve borç indirimi ayrı koşullara bağlıdır; geçmiş silinmez.

### Hakediş ve etkinlik

- Eğitmen ücreti merkez anlaşmasına bağlıdır: yüzde, seans sabiti, kişi başı, sabit + kişi başı ve açık karma modeller desteklenir. Yüzde satılmış ders bedeline bağlıdır, tahsilata değil. Eğitmenin yaptığı seans için satış/iptal koşuluyla bedeli korunan katılımlar tabana girer.
- Süreli/sınırsız üründe hesap koşulu anlaşmada açıkça tanımlanır; otomatik kişi başı varsayımı yoktur. Eksiklik sıfır hakediş sayılmaz, ürün ilgili derse açılmadan tamamlanır. Bedelsiz deneme kişi başı/yüzdeye girmez, seans sabitini etkilemez; sonradan dönüşüm geriye hakediş üretmez.
- Hakediş yoklama kapanışında fiilî eğitmenin seans tarihinde geçerli anlaşmasından oluşur. Gerçekleşmeden iptal edilen seans hakediş üretmez. Hakediş/ödeme ayrıdır; kısmi ödeme ve geçmişe bağlı fark düzeltmesi desteklenir.
- Etkinlik merkez dışında olabilir; sorumlu merkez ile fiziksel mekân ayrıdır. En az bir eğitmen veya asistan görevli olmalıdır. Görev ücreti etkinlikte kişi bazlı ücretsiz/tutar olarak açık seçilir; ders anlaşması otomatik uygulanmaz. Etkinlik gerçekleşip merkez yöneticisi görevi doğrulayınca ücretli hakediş oluşur.
- Etkinlikte ödeme ve kesin kayıt ayrıdır; ücret, ödeme şartı, uygun paket ve iptal/iade koşulları kayda açılmadan belirlenir. Eksik ödeme otomatik iptal yapmaz.

### Öğrenci limiti ve abonelik

- Aktif öğrenci ilişkisi sayılır; hesabı olmayanlar dahildir. Aynı organizasyon kişisi birden fazla merkezde aktif olsa da organizasyon limitinde bir kez sayılır. Aday/yöneticilik/eğitmen/personellik tek başına öğrenci sayılmaz.
- Limit doluysa yeni aktif öğrenci ve yeniden aktifleştirme engellenir; mevcut kayıtlar silinmez. Açık talep, rezervasyon, liste/teklif veya etkinlik kaydı pasife almayı engeller; borç/kalan kredi tek başına engel değildir. Pasif adına yeni aktif işlem öncesinde aktifleştirme gerekir.
- Adayın deneme başvurusu/katılımı limitten istisnadır, kişi/organizasyon bazlı tekrar sınırına tabidir. Ücretli öğrenciye dönüşüm limit kontrolüne girer. Etkinlik katılımcıları istisna değildir; aktif öğrenci sayılır.
- Owner plan düşürürse dönem sonunda yeni plan uygulanır; açık işlem engeli aranmaz. Business'tan tek merkeze düşürmede kullanılacak merkez zorunlu seçilir. Veri silinmez; üst plana dönüşte eski veri açılır. Geriye dönük otomasyon/bildirim çalıştırılmaz.
- SaaS ödemesi gecikince yönetim kısıtları başlar; öğrenci 7 takvim günü normal kullanır, zorunlu mevcut seans iptali/yoklama sürer. Sonunda organizasyonun bütün hizmet erişimi kapanır; owner ödeme/abonelik yönetimini kullanabilir. Veri korunur, ödeme tamamlanınca erişim açılır. Kısmi ödeme süreyi başlatmaz; yenileme tarihi uzamaz. İstisna SaaS yönetimindedir.
- Yükseltme ödemeyle hemen yürür; gecikmiş borç kapatılır, kalan dönem için plan fiyat farkı alınır ve yenileme tarihi korunur. İlk aşamada aynı faturalama dönemi içindeki değişimler desteklenir; aylık/yıllık geçiş ayrı karardır.
- Yenilemeyi iptal ödenmiş dönem sonunda erişimi kapatır; 7 gün ek süre verilmez. Dönem bitmeden geri alınabilir, sonradan dönüş yeni abonelik başlangıcıdır; veri korunur.

### Zaman, belge, aktarım ve iletişim

- Takvim merkez yerel saatidir. Tek seans veya o seanstan sonrası ayrı değiştirilir; geçmiş korunur, çakışmalar çözülmeden kesinleşmez. Kayıt/iptal/talep pencereleri ayrı ayarlardır; yönetici istisnası yetkili/izlenebilirdir.
- Belge kabulünde sürüm/kişi/zaman/işlem saklanır; yeni sürüm eskiyi silmez. Yeniden onay gereği ve engellenen işlem açık tanımlanır, rezervasyon kendiliğinden iptal edilmez.
- Herkese açık sayfalarda özel kayıtlar görünmez; hesapsız başvuru mümkündür, kendi kesin rezervasyonu hesap–kişi doğrulaması ister. İçe aktarma özel merkez izni, önizleme, doğrulama ve satır bazlı tekrar koruması gerektirir.
- Raporlar güncel alan/merkez yetkisini korur. İşlemsel uygulama içi bildirimler pazarlama tercihinden bağımsızdır; dış kanallar ve isteğe bağlı bildirimler kendi tercihlerine tabidir.

Güncel durum: O1 iş kararları ve O3 pilot hedefleri kabul edildi; O2 hukuk incelemesi bekleyen geçici saklama varsayılanlarıyla ilerler. O4 yazılı şema/tip/API/durum/hata/izin sözleşmesi04–08 v1.0 ile tamamlandı; gerçek uygulama/test ve hukuki/config kapıları açık. Kodlama/model çalışma düzeni 03 v1.0’da kabul edilmiştir. Ticari limitler pilot yük değerleri değildir.

## Tamamlanma, değişiklik ve teslim sınırı

- Bir özellik ancak kapsamdaki akış, backend yetkileri, veri bütünlüğü, uygulanabilir plan sınırları ve ilgili tamamlanma ölçütleri doğrulanınca “tamamlandı” olarak işaretlenir. Ekranın görünmesi tek başına yeterli değildir.
- Her doğrulamada mevcut durum, kontrol kanıtı ve kalan eksik kaydedilir. Kısmi özellik “tamamlandı” diye sunulmaz.
- Ayar değerini izin verilen sınırda değiştirmek kapsam değişikliği değildir. Yeni işlem türü, yeni modül, plan dağılımı değişikliği veya geçmiş kayıt etkisi değişikliği kapsam değişikliğidir ve belgeye açıkça işlenir.
- FtkSaaS yeni ve bağımsız bir projedir. Eski repository, Supabase projesi, Vercel ayarları veya dağıtım yaklaşımı korunacak diye bir yükümlülük yoktur. Backend için Supabase (başlangıçta Free) ve multi-frontend mimari kabul edilmiştir. İlk istemci mobil öncelikli web/PWA, devamında platforma özel frontendlerdir. Tek yeni repository kararı kabul edilmiştir; repository adresi ve frontend dağıtım seçimi henüz açıktır. Bu çalışma kodlama, veri taşıma veya dağıtım yetkisi vermez.
- Aynı backend'i birden fazla frontend'in kullanabilmesi kapsamdadır; Android, iOS, macOS ve Windows uygulamalarının ayrı ayrı geliştirilmesi bu belgede otomatik teslim yükümlülüğü değildir.

### Değişiklik kaydı

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 1.0 | 14 Ekim 2026 | 14 modül, 33 özellik, plan dağılımı ve tamamlanma ölçütleri. |
| 1.1 | 15 Ekim 2026 | Yazılı kapsam sözleşmesi statüsü; ayar sahipliği, başlangıç değerleri, geçmiş kayıt koruması ve karar zamanları. Kişiler arası devir ile ürün değişimi ayrıldı; Pro tamamlanmasına CRM'in dahil olduğu netleştirildi. |
| 1.2 | 15 Ekim 2026 | FtkSaaS bağımsız proje olarak tanımlandı. Eski sistem incelemesi, mevcut backend/dağıtım koruma ve eski politika devralma hükümleri kaldırıldı. Kabul edilmiş yeni ürün kapsamı korundu. |
| 1.3 | 15 Ekim 2026 | Görüşmedeki kabul edilmiş multi-frontend/Supabase, rol, CRM, rezervasyon/kredi, finans/hakediş, etkinlik, öğrenci limiti, abonelik ve dondurma kararları işlendi; çelişen önceki hükümler güncellendi. |


## 15 Ekim 2026 — İkinci karar oturumu özeti

Bu bölüm önceki açık statülerini günceller; ayrıntı kaynağı teknik sözleşme v2.0 ve kodlama sorumlulukları v1.0’dır.

- O1: Erken dondurma bitişinde fiilî süre; ürün değişiminde bağlantılı yeni satış; yenilemede otomatik devir/uzatma yok; başlangıç dahil/bitiş hariç dönem; kredili, yeniden fiyatlamalı ve süre oranlı iade yöntemleri kabul edildi. Hesaplanan iade önce ilgili satış borcunu azaltır, fazlası alacaktır.
- Hesap silme, abonelik yenilememe, organizasyon kapatma ve kalıcı tüm veri silme ayrı süreçtir. Kalıcı silme sonrası eski veriye yeni abonelik/e-posta ile dönülemez. Hukuki arşiv operasyon uygulamasına bağlanmaz. Uzun saklama varsayılanları geçicidir, hukuk uzmanı incelemesi açıktır.
- Pilot RPO 24 saat/RTO tespitten 8 saat; günlük bağımsız veritabanı/dosya yedeği, 30 gün döngü, aylık geri yükleme testi; izleme ve backend performans hedefleri kabul edildi. Üretim garantisi veya çalıştırılmış test değildir.
- Davet 7 gün/tek kullanım; yeniden gönderim eskisini kapatır. Operasyon personelinde mevcut merkez öğrencilerine davet varsayılan açık ve yönetici kapatabilir; eğitmende kapalı, izinle kendi sınıf/seans öğrencileri; asistanda yok. Davet rol/iletişim değiştirme yetkisi vermez. Güncel kabul kontrolleri ve sıfır organizasyonlu hesap sınırları teknik sözleşmededir.
- İlk 7 gün SaaS gecikmesinin açık/kapalı işlem matrisi, anahtar/tekrar koruması, 90 günlük önceki ana API sürümü desteği, halka açık başvuru koruması, para/yuvarlama/zaman ve eşzamanlı düzenleme davranışları kabul edildi.
- Merkezler arası kullanım satış/tahsilat merkezi ile hizmet/hakediş merkezini ayrı izler; uygun kredili tüketim DS-2026-10-17 payını oluşturur; rapor işlemi para transferi yapmaz.
- Yeni uygun hak önce geçmiş tüketilmiş kredi açığını ders tarihiyle, sonra gelecek rezervasyon açığını seans tarihiyle kapatır. Geçmiş için yeni paket başlangıcının eski dersi kapsaması aranmaz; kapsam/merkez/sınıf kontrolleri sürer. Gelecekte seans tarihinde geçerlilik zorunludur; eski hakediş kendiliğinden yeniden hesaplanmaz.
- Tek repository, alan sahipliği, mock sınırı, branch/PR, merge/üretim onayı ve öneri → kabul → belge → kod → doğrulama → teslim düzeni kabul edildi. Belge kabulü somut üretim işlemi onayı değildir.

1.4 — 15 Ekim 2026: İkinci oturumdaki kabul edilmiş O1–O4 davranışları ve çalışma düzeni kapsam özetiyle eşlendi. Yeni modül/plan kapsamı veya uygulanmış özellik iddiası eklenmedi.

1.5 — 15 Ekim 2026: O4 ilk taslaklarının statüsü ve mevcut O1/merkezler arası hesaplaşma referansları güncellendi. Yeni özellik/plan veya uygulama tamamlandı iddiası eklenmedi.


## 15 Ekim2026 —Son kararlar ve O4 yazılı teslimi

Bu bölüm önceki açık/çelişen satırların üstündedir. Yeni kapsam/F01–F33 sayısı veya plan dağılımı değişmez.

- Owner yalnız FtkSaaS atama/kaldırma; müşteri kendi owner rolünü devredemez. Owner merkez oluşturup kendisini CM atamadan merkez hesap erişimi gönderemez. Diğer CM atama/öz CM kaldırma owner yönetimidir. Hesap bağlanmadan ayrıcalıklı login rolü yok; ilk erişim öğrenci self, sonra yetkili role grant.
- Satış geçerliliği kullanıcıdan açık başlangıç/bitiş sınırı tarihidir, satış merkezinde00:00, [başlangıç,bitiş); bu organizasyonun kabul ettiği sabit FtkSaaS davranışıdır. Otomatik takvim aylık ürün veya ay çıpasından satış bitişi hesaplama yok.
- Süreli haftalık/aylık quota satış başlangıç çıpalı, son kısa dönemde tam kota, deviryok; reserve/cancel/close etkisi açık. Teknik quota aritmetiği satış tarihini değiştirmez.
- Seans başlangıcında negatif kredi sınırını aşan kişi katılamaz, blocked ve yüzde/kişi hakedişi0; sonradan ödeme geçmişe hakediş doğurmaz. Seansın gerçekleşen sabit ücreti diğer katılımcılar varsa korunur. İzinli negatif kredi katılımında kaynak satış yoksa merkez değerleme bedeli rezervasyonda snapshot; sonraki satış yeniden hesaplamaz, ayrıca para borcu yok.
- İlk abonelik ödemesi doğrulandığında operasyon+dönem başlar; ödeme öncesi owner merkez/self-CM kuruluşu mümkün, ücretsiz trial/ilk ödeme grace yok. Yenileme gecikmesi ayrı kabul edilmiş modeldir.
- Org belge/segment/automation Owner/OM, yerel scope CM; executor ayrıca merkez operasyon yetkisine tabi. Etkinlik mark I/A, close yalnız CM; duty fee ayrı gerçekleşme+CM doğrulaması.
-04–08 v1.0 yazılı teknik sözleşme üretildi. Kod/RLS/API veya deployment uygulanmadı. Hukuki saklama teyidi, sayısal ticari/config değerler ve gerçek testler açık.

2.0 —15 Ekim2026: Son karar turu ve O4 yazılı sözleşme tamamlanma kaydı. Somut kodlama/merge/üretim emri değildir.

## 15 Ekim 2026 — D01–D09 disiplin revizyonu (kabul edildi)

Belge paketi revizyonu: 2.1. Bu bölüm önceki çelişen disiplin, paket kapsamı ve negatif kredi hükümlerinin yerini alır. Önceki sürüm numaraları ve denetim sayıları tarihsel tabanı gösterir.

**D01.** Disiplin organizasyon düzeyinde tanımlanır; merkezler sundukları disiplinleri kullanıma açar. Aynı organizasyonun merkezleri aynı disiplin kimliğini kullanır.

**D02.** Eğitmen birden fazla merkez/disiplinde görev alabilir. Öğrenci birden fazla merkez/disipline kayıt olabilir; organizasyon kişi kaydı çoğaltılmaz. Öğrenci eğitmenin alt kaydı değildir; eğitmen değişimi öğrencinin kimliğini veya haklarını değiştirmez.

**D03.** Normal ders/seansın merkezi ve disiplini belirgindir. Merkezlerin program, fiyat ve eğitmen anlaşmaları ayrı kalır. Disiplin ilişkisi yeni uygulama rolü veya operasyon yetkisi vermez.

**D04.** Paket kullanım kapsamları: merkez+disiplin; merkezin bütün disiplinleri; organizasyonun bütün merkezlerinde belirli disiplin; organizasyonun bütün merkez ve disiplinleri. Organizasyon sınırı aşılamaz; mevcut SaaS plan/merkez erişim sınırları korunur.

**D05.** Ders/etkinlik uygunluğu kullanım kapsamından ayrı belirtilir. Organizasyon genelinde etkinlik paketi bütün normal derslerde kendiliğinden geçmez. Geniş kapsam kapalı sınıf, kapasite, tarih ve diğer uygunluk kurallarını aşmaz.

**D06.** Dar kapsamlı disiplin hakları başka disiplinde kullanılamaz; başka disipline ait paket, kapsam dışındaki kredi açığını kapatamaz. Birden fazla disiplinde geçerli 10 kredilik paket toplam 10 kredi sağlar; disiplin başına ayrı 10 kredi oluşmaz.

**D07.** Negatif kredi sınırı öğrenci için merkez–disiplin bazında uygulanır. Aynı kapsamdaki ayrılmış ve tüketilmiş açık birlikte sayılır; mevcut rezervasyon iki kez sayılmaz. Bir disiplindeki kredi açığı diğer disiplinin katılımını engellemez. Organizasyon geneli kişi açığı üzerinden tek katılım sınırı uygulayan eski hükümler bu kararla değiştirilmiştir.

**D08.** Geniş kapsamlı paket, uygun olduğu merkez/disiplinlerdeki açıkları mevcut kapatma sırasıyla karşılayabilir: önce geçmiş tüketilmiş açık, sonra gelecek rezervasyon açığı. Uygun hak seçiminde en erken bitiş, eşitlikte önce satın alma ve mevcut kararlı eşitlik çözümü korunur. Paket kapsamı uygunluk filtresidir.

**D09.** Seans başlangıcındaki limit kontrolü ve sonradan ödemenin geçmiş katılım/hakedişi değiştirmemesi korunur; kontrol artık ilgili merkez–disiplin kapsamındadır. Para borcu ile kredi açığı ayrı kavramlardır.

**Teknik aktarım durumu:** D01–D09 kapsamı şema, API, izin ve ortak tiplerde mevcuttur; Q-D01 etkinlik kapsamı/negatif kredi ve ortak hak akışı uygulanmıştır. İlk aktarım tarihindeki açık listesi güncel iş listesi değildir; bugün kalanlar docs/remaining-work.md ve kaynak bağlı kabul kayıtlarında izlenir.

## 15 Ekim 2026 — U01–U08 UUIDv7 standardı (kabul edildi)

Paket revizyonu: 2.2. D01–D09 disiplin kararları korunur. Bu bölüm önceki çelişen UUID üretim önerilerinin yerini alır.

**U01.** FtkSaaS tarafından üretilen bütün UUID değerleri için UUIDv7 zorunlu standarttır. Domain kayıtları, işlem/idempotency anahtarları, request/trace kimlikleri ve geçici teknik UUID değerleri bu kapsamdadır. UUIDv1/v4/v5 üretimi için önceki öneriler yürürlükte değildir; istisna yeni açık karar gerektirir.

**U02.** Domain kayıt kimlikleri varsayılan olarak backend tarafından üretilir. UUID üretmesi gereken istemci, test verisi, seed, worker, Edge veya diğer FtkSaaS bileşeni de UUIDv7 kullanır. Bu karar istemciye yeni kayıt oluşturma veya operasyon yetkisi vermez.

**U03.** Supabase Auth ve diğer dış sağlayıcıların ürettiği kimlikler aynen korunur; yeniden UUIDv7 yapılmaz. Üretim standardı ile dış kimlik kabulü ayrıdır. Mevcut UUID değerleri sırf sürümü farklı diye yeniden yazılmaz; FK ve dış referanslar bozulmaz.

**U04.** Aynı kişinin farklı organizasyonlardaki kişi kayıtları bağımsız UUIDv7 alır. E-posta/telefon/isimden deterministik kimlik türetilmez; disiplin kayıtları için de aynı üretim standardı geçerlidir.

**U05.** UUIDv7 RFC 9562 uyumlu, güvenli rastgelelik kullanan doğrulanmış üreticiyle üretilir; timestamp eklenmiş özel UUID algoritması yazılmaz. Seçilen Supabase/PostgreSQL ortamındaki yerleşik üretim desteği teknik kurulumda doğrulanır; yoksa denetlenmiş uyumlu üretici seçilir, v4 fallback yapılmaz. Üretici yoksa ilgili üretim açılmaz.

**U06.** UUIDv7 yaklaşık üretim zamanını açığa çıkarabilir. created_at, seans zamanı ve audit zamanı ayrı alanlardır; UUID kesin küresel işlem sırası, iş tarihi veya yetki kanıtı sayılmaz. Sıralama ve eşzamanlılık kuralları açık iş alanlarına dayanır.

**U07.** Davet, hesap erişimi ve benzeri bearer token değerleri UUID kimliği değildir; güvenli rastgele token standardı korunur. Tokenlar UUIDv7 ile değiştirilmez. operation_key UUIDv7 olsa da retry aynı anahtarı yeniden kullanır; her denemede yeni UUID üretmek idempotency kuralını bozar.

**U08.** PostgreSQL alan tipi uuid olarak kalır. UUIDv7 üretim standardı bütün dış UUID girişlerini v7 diye reddetmek anlamına gelmez. FtkSaaS üretimi olan alanlarla sağlayıcı kimliği alanlarının şema/DTO eşlemesi teknik sohbette tamamlanır; yetki ve tenant kontrolü UUID sürümünden bağımsız uygulanır.

**Güncel teknik durum:** UUIDv7 üretim politikası ortak tip, backend üreticisi ve migration/çalışma zamanı yollarına aktarılmıştır. PostgreSQL default üreticisinin kapalı olması doğrulanmış backend UUIDv7 üretimini yok saydırmaz; v4 fallback yoktur. İlk aktarım tarihinin kurulum bekleme notları tarihsel kayıttır. Güncel CI/hosted/production kabulü tek devirde ayrı izlenir.


## Q-D01 — 15 Ekim 2026 kabul edilen etkinlik kuralı

1. Etkinlik tek disiplinli, çok disiplinli veya disiplinsiz olabilir. Disiplin etiketleri tanıtım ve filtreleme içindir; tek başına paket kullanım yetkisi oluşturmaz.
2. Paketle katılımda ders/etkinlik uygunluğu ayrıca açıkça tanımlanır. Etkinliğin Salsa etiketi taşıması, Salsa paketini kendiliğinden geçerli yapmaz.
3. Tek disiplinli etkinlikte, etkinliğe uygun ve ilgili merkez/disiplini kapsayan dar paketler kullanılabilir. Etkinliğe uygun geniş paketler de mevcut kapsam kurallarına göre kullanılabilir.
4. Çok disiplinli veya disiplinsiz etkinlikte yalnız etkinliğe uygun merkezin tamamı (center_all_disciplines) veya organization_all kapsamlı paketler kullanılabilir. center_discipline ve organization_discipline kapsamları kullanılamaz.
5. Etkinliklerde negatif kredi kullanılmaz. Paketle katılımda yeterli kullanılabilir hak bulunmalıdır; aynı hak eşzamanlı işlemlerde ikinci kez kullanılamaz.
6. Manuel ödeme ve etkinliğe özel satış kuralları korunur. Bu karar tahsilat ile kredi üretimini birleştirmez ve yeni bir ödeme zorunluluğu tanımlamaz.
7. Organizasyon izolasyonu, merkez erişimi, kapasite, geçerlilik ve mevcut katılım/iptal/kapanış koşulları korunur. Geniş kapsamlı paket toplam ortak havuzunu kullanır; disiplin başına hak çoğaltılmaz.

Ürün kararı kapalıdır. Teknik aktarımın güncel kanıtı 11 raporundadır; tam kayıt/RPC ve son ortak kredi yarışı henüz tamamlanmadı.


## Q-E01 — Kabul edilmiş etkinlik ödeme ve işletme iptali eki

## 1. Paketsiz, ücretli ve tam ödeme şartlı etkinlik

- Öğrenci adına etkinliğe bağlı ödeme hazırlık kaydı ve borç oluşturulur. Hazırlık kesin kayıt değildir ve kontenjan tutmaz.
- Merkez manuel tahsilatı özellikle bu borca bağlar. Başka borca dağıtılmış ödeme bu etkinliğin ödeme şartını karşılamaz.
- Kesin kayıt sırasında tam ödeme, kapasite ve mevcut diğer uygunluk koşulları yeniden kontrol edilir. Koşullar uygunsa kesin kayıt tamamlanır.
- Ödeme alınmış ancak kontenjan dolmuşsa kesin kayıt oluşmaz. Hazırlık kapatılır, borç ters kayıtla kaldırılır; ödenen tutar öğrenci alacağına dönüşür. Nakit iade veya başka borca mahsup ayrı ve açık işlemdir.
- Kısmi ödeme kesin kayıt oluşturmaz; ödeme geçmişi korunur.

## 2. İşletmenin etkinliği gerçekleşmeden tamamen iptali

- Etkinlik bedeli tamamen geri alınır. Katılımcının iadesiz koşulu bu işletme iptaline uygulanmaz.
- Etkinliğin kalan borcu kaldırılır; ödenmiş tutar öğrenci alacağına dönüşür. Otomatik nakit iade yapılmaz.
- Önceki iade ve borç indirimleri hesaba katılır; aynı tutar ikinci kez iade edilmez veya alacaklaştırılmaz.
- Başka borçlar değişmez. Mahsup ve nakit iade mevcut yetki, merkez, para birimi ve bakiye sınırlarıyla ayrı açık işlemlerdir.
- Paketle katılımda ayrılmış hak serbest bırakılır; ayrıca etkinlik bedeli kadar parasal alacak üretilmez.
- Bu karar başlamış veya kısmen gerçekleşmiş etkinlik için oransal hesap tanımlamaz. Böyle bir durum için varsayım yapılmaz; gereken ürün kararı ayrıca belirtilir.

| Etkinlik bedeli | Ödenen | Gerçekleşmeden işletme iptali |
|---|---:|---|
| 1.000 TL | 0 TL | 1.000 TL kalan borç kaldırılır. |
| 1.000 TL | 400 TL | 600 TL kalan borç kaldırılır; 400 TL öğrenci alacağı oluşur. |
| 1.000 TL | 1.000 TL | Kalan borç yoktur; 1.000 TL öğrenci alacağı oluşur. |

Örnekler önceki iade/indirim bulunmadığı varsayımıyladır.


Teknik karşılık: event_payment_preparations, mevcut debts/debt_allocations/debt_adjustments/student_credit_movements; güncel API/tipler 08 sözleşmesinde. Kanıt: reports/qe01-verification.json. Başlamış veya kısmen gerçekleşmiş etkinliğin parasal iptal hesabı bu kararda tanımlı değildir.

## Q-E02 — 16 Ekim 2026 son kabul (önceki çelişen hükümlerin yerine)

**E02-01.** Katılımcının başlama sonrası kendi kaydını iptali/ayrılması parasal iade, borç indirimi veya öğrenci alacağı üretmez. Mevcut paket iptal koşulları aynen korunur.

**E02-02.** Merkez iptali her aşamada etkinliğe bağlı ücret yükümlülüğünü tamamen kaldırır; kalan borç sıfır, tahsilatın daha önce alacaklaştırılmamış tamamı öğrenci alacağıdır. Nakit iade/mahsup ayrı açık yetkili işlem; otomatik nakit çıkışı yok.

**E02-03.** Merkez iptali tüm ayrılmış hakları serbest bırakır, tüketilmiş hakları previous_id bağlı ters hareketle tamamen geri verir; kısmi tüketim ve paket hakkı için parasal alacak yok.

**E02-04.** Önceki alacak/iade/mahsup/hak dönüşü tekrar üretilmez. Yalnız iptal edilen etkinliğe bağlı kayıtlar; başka borç/geçmiş değişmez. Önizleme+apply sürüm/finans bağımlılıkları, canlı yetki ve tek transaction audit/outbox/receipt ile korunur.

**E02-05.** Etkinlik fiilî başlangıç kaydı/düzeltmesi güncel runtime’da vardır; saat geçmesi tek başına gerçekleşme değildir. Ders anlaşmasının başlangıçta sabitlenmesi DS teknik teslimidir. Merkez iptalinin aşamadan bağımsız sonucu bu tanıma ihtiyaç duymaz; mevcut occurred/attendance evidence korunur.

Teknik aktarım ve test durumu: docs/decisions/Q-E02.md ve reports/qe02-verification.json. Tarihsel test sayıları bu değişikliğin kanıtı değildir.


## Q-E03 — Planlanan başlangıç ve iptalin parasal sınırı · 16 Ekim 2026

**E03-01.** Katılımcı iptalinin parasal sınırı planlanan başlangıçtır. Başlangıç anı dahil sonrasında iade, borç indirimi veya öğrenci alacağı oluşmaz. Öncesindeki iptaller mevcut kabul edilmiş koşullara tabidir.

**E03-02.** Fiilî başlangıcın gecikmesi, sonradan kaydı veya düzeltmesi tamamlanmış katılımcı iptalini yeniden sınıflandırmaz; finansal yeniden hesaplama yapılmaz. Plan 21.00, iptal 21.15, fiilî başlangıç 21.30 başlangıç sonrası iptaldir.

**E03-03.** Planlanan saatin gelmesi tek başına yoklama, hak tüketimi, gerçekleşme veya hakediş oluşturmaz. Katılımcı paket iptal koşulları korunur.

**E03-04.** Merkez iptalinde Q-E02 aynen geçerlidir; ertesi gün kaydı veya aşama tam borç kaldırma ve bağlı para/hak dönüşlerini değiştirmez.

**E03-05.** Başarılı katılımcı iptalinde backend karar zamanı, o andaki planlanan başlangıç ve parasal sınıflandırma participant_cancellation kaydında atomik sabitlenir. Önceki kayıtlara zaman kanıtı uydurulmaz; eski ve merkez iptallerinde alan null kalabilir. İstemci zaman veya sınıflandırma gönderemez.


## Fiilî başlangıç kayıt/düzeltme aktarımı

**AS-01.** Merkez yöneticisi fiilî başlangıcı expected_version ile kaydeder/düzeltir; aktör ve kayıt zamanı backend, gerçek zaman Instant olarak açık girilir. Gelecek fiilî başlangıç reddedilir. İlk kayıt bir kez; düzeltme gerekçeli audit diff ile geçmişi korur, yanlış bilginin kaldırılması null düzeltmesiyle mümkündür.

**AS-02.** Bu kayıt yalnız operasyonel kanıttır; draft kabul edilmez, published/occurred/cancelled durumları değişmeden korunur. Katılımcı iptalinin Q-E03 parasal sınıflandırması, Q-E02 merkez hesaplaşması, yoklama, hak ve hakediş kendiliğinden değişmez.

**AS-03.** İptalden sonra geriye dönük kayıt/düzeltme mümkündür; iptal yeniden açılmaz. Etkinlik sürümü artar; eski önizleme geçersizleşir. event_get mevcut actual_started_at değerini; yönetici/organizasyon okuyucusuna append-only actual_start_history geçmişini döndürür.

Teknik kanıt: docs/actual-start-handover.md, PR son commit CI. Bu aktarım kısmi gerçekleşmeye bağlı yeni parasal veya hak kuralı üretmez.

## Son hesaplaşma revizyonu — DS-2026-10-17

[Yetki ve iki taraflı kesinleştirme kararı](../docs/decisions/DS-2026-10-17-settlement-revision.md) geçerlidir. Owner → OM devretme izni → belirli merkez CM hesaplaşma grantı zinciri uygulanmıştır; Owner CM'ye doğrudan da grant verebilir. OM/CM rolü ve Owner'ın grant yönetimi tek başına merkez finansal operasyon yetkisi değildir. CM yetki devredemez.

A'nın açık yetkili CM'si gerçekleşen ödeme veya önerilen mahsup başvurusu açar; bakiye değişmez. B merkezinde ayrı doğrulanmış güncel CM rolü ve açık hesaplaşma yetkisi olan kişi (başlatanla aynı hesap olabilir) onayı kayıt, seçili bakiye, request, audit/outbox/receipt'i atomik kesinleştirir. Gerekçeli ret bakiye değiştirmez, A'ya uygulama içi gider. Ayrı OM ödeme/mahsup kayıt aşaması yoktur; onay banka transferi değildir. Kısmi, aynı para birimli karşılıklı mahsup ve geçmişi koruyan bağlı düzeltme aynı başvuru/onay zincirindedir. İlgili sürüm değişimi yeni onay ister, alakasız dersler stale yapmaz. Farklı kişi/hesap veya kendi başvurusunu onaylama yasağı yoktur. A’da başvuru ve dondurulmuş B merkezinde onay yetkisi ayrı aranır; istemci center seçimi yetki değildir. Audit her adımın hesap/merkez/CM rol/grant kapsamını kaydeder. Aynı hesap kullanımı çift kapama/sürüm/yarış korumasını aşmaz; receipt replay ve commit dahil canlı yetki aranır.

DS-OPEN-01 karar düzeyinde kapalıdır; hesaplaşma runtime aktarımı uygulanmıştır. [Son merkez yetki düzeltmesi](../docs/decisions/DS-2026-10-17-settlement-center-scope.md) farklı hesap şartını kaldırır; DS-OPEN-02 karar düzeyinde kapalıdır, ayrı istisna/fallback yolu yoktur. Yeni idari grant/read/version/audit scope DTO’ları ve 38 gerçek kabul senaryosu 08’de izlenir: vaka bazlı kanıt durumu makine sözleşmesindedir; [hesaplaşma devri](../docs/settlement-handover.md) ve son head temiz CI gerçek kabulü ayrıca belirler. Main koruması ayrı yönetici işidir. Merge için son açık kullanıcı yetkisi geçerlidir; production dağıtım yetkisi yoktur.

## Starter yoklama/koruma runtime aktarımı

[Starter devri](../docs/starter-attendance-protection-handover.md) kabul edilmiş kararları değiştirmeden dar runtime kapsamını belirtir. Starter F14 kapanışı ve bağlı düzeltme hak hareketi + audit/outbox/receipt ile atomiktir; hakediş üretmez. Ücretli finansal kapanış ve bağlı hakediş düzeltmesi PR #15 ile uygulanmıştır. Koruma yalnız yeni olumsuz etkiye bağlıdır; bağımsız engelleri veya yeni rezervasyon koşullarını kaldırmaz. Taslak başlangıç kanıtı değildir; başlangıç ve belge tüketicileri P01–P05 ile uygulandı; diğer tüketici/kabul açıkları güncel kuyruktadır. 198 işlem/89 canlı/109 contract-only bu Starter tesliminin tarihsel sayısıdır; bu metnin önceki güncel envanteri 199/118/81 ve 34 migration idi; 24 Ekim tabanı 200/200/0 ve 59 migration’dır. İşlem sayısı özellik tamamlama oranı değildir.

## 23 Ekim ayarlar kapsamı ve frontend başlangıcı

[Kabul edilmiş settings davranışları](02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) dört yönetim kapsamını ayrı tutar. 69 ana grup onaylıdır; somut alt alan/default/yetki/sağlayıcı ve API karşılıkları ayrıca açık olarak işaretlidir. Görünen ad ile yasal ad ayrıdır. Ad ve doğrulanmış iletişim aktif güvenli hesap–kişi bağı üzerinden org onayı olmadan yansır; geçmiş belge snapshotları değiştirilmez. Org kişi geçmişi/borç/hak/görev diğer orga taşınmaz. Abone numarası UUID yerine insan tarafından kullanılan org içi sabit takip anahtarıdır; uygulaması P08'dir.

Tema/dil/saat/başlangıç/liste/takvim tercihleri erişim veya iş kuralı üretmez. Bildirim/pazarlama/kişiselleştirme/ölçüm izinleri aynı ayar değildir. Üç reklam/analitik varsayılanı açık/kapatılabilir ürün kararı, işleme dayanağı veya rıza kanıtı değildir. Bu görev sağlayıcı/SDK entegrasyonu açmaz.

Yeni settings alanları yayımlanmış API'lere sessizce eklenmez; callable kapsam200 ve machine DTO'lar sabittir. Frontend tasarımda kabul edilmiş hedefleri dikkate alır, uygulama eksiklerini [entegrasyon devrinden](../docs/claude-handover.md) izler.

