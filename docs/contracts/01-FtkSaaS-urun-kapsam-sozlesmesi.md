# FtkSaaS — Ürün kapsam sözleşmesi

## Kabul edilmiş SaaS plan sınırları

Plan kapsamı bu belgenin; ayrıntılı davranış, geçiş ve güvenlik kararları [teknik sözleşmenin](02-FtkSaaS-teknik-sozlesme.md) sorumluluğundadır. Kaynak/CI/ortam kabulü [güncel kabul kaydından](../../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md), açık işler [backlog’dan](../../apps/backend/docs/remaining-work.md) okunur.


### Ayrıntılı normatif plan kabulü

Ürün davranışı kabul edilmiştir. Uygulama ve doğrulanmış ortam kabulü bu karardan türetilmez.

#### Ürün konumlandırması

- **Starter:** Sabit yürüyen tek disiplinli ders programını, öğrencilerini, sınıf/seans rezervasyonlarını, paketlerini, yoklama ve temel finansını yöneten bağımsız eğitmen/küçük stüdyo.
- **Pro:** **Bir fiziksel lokasyon** içinde çok oda, çok disiplin ve/veya çok eğitmen, tüm ders/program/etkinlik/CRM/iş otomasyonu/eğitmen hakedişi fonksiyonları olan hareket/eğitim merkezi.
- **Business:** Pro kapsamı + **en fazla beş merkez**; merkezler kendi erişim, operasyon ve finans yetkilerinde izole, organizasyon altında bağlı; mevcut koşullarla merkezler arası kullanım ve onaylı hesaplaşma.
- **Beş merkez üzeri:** Otomatik sınırsızlık veya genel bypass değil, teklif/özel sözleşme kapsamında müşteri başına sürümlü, açıkça kabul edilmiş merkez limitinin ve gerekiyorsa alan davranışlarının ayrı tanımlanması. Tenant izolasyonu, mali bütünlük, gizlilik, kimlik, audit ve güvenlik kapıları özel teklifle devre dışı bırakılamaz. Standart yeni bir dördüncü plan veya fiyat bu kararla oluşturulmadı.

#### Bağlayıcı kapsam

| Kural | Starter | Pro | Business |
|---|---|---|---|
| Aktif merkez | 1 | 1 | 5'e kadar |
| Sisteme tanımlanabilen **aktif ders/aktivite odası** | 1 | Ticari sınırsız | Merkezler içinde ticari sınırsız |
| Aktif disiplin | 1 | Birden fazla | Birden fazla |
| Aktif eğitmen | 1 | Ticari sınırsız | Ticari sınırsız |
| Aktif öğrenci/üye | **100** | **250** | Organizasyon genelinde **1.250**; merkez başına kota yok |
| Düzenli sınıf/program, temel özel ders talebi, öğrenci self rezervasyonu, temel public ders takvimi ve başvuru | Var, aynı tek kaynak/disiplinle | Var | Var |
| Tek disiplinli kredili, süreli/sınırsız paket; uygun rezervasyon, yoklama, borç/tahsilat | Var | Var | Var |
| Bağımsız workshop/parti/atölye/etkinlik yaşam döngüsü (F29) | **Yok** | Var | Var |
| Gelişmiş CRM, reklam/lead kaynakları, kampanya, segment, otomasyon (F21–F24) | **Yok**; yalnız gelen temel ders başvurusunun incelenmesi | Var | Var; merkez bazlı/organizasyon birleşik |
| Bağımsız operasyon personeli yönetimi ve eğitmen anlaşma/hakedişi | Yok | Var | Var |
| Merkezler arası paket kullanımı ve A→B hesaplaşma | Yok | Yok | Var |

**Starter tek oda davranışı:** Yazılım bir aktif mantıksal ders odası tutar; işletmenin gerçek mekânda birden fazla salonu olsa bile bütün sınıf/seans/özel ders rezervasyonları aynı `room_id` üzerinde yürür. Oda eşzamanlı iki seansa atanamaz; ikinci fiziksel alanın varlığı paralel program kapısını açmaz. Odanın tanımlı kapasitesi bir üst sınırdır; her seansın toplam/kategori limiti bunun altında ayrıca belirlenir. Örneğin mantıksal oda kapasitesi 50; büyük fiziksel alandaki seans limiti 40, küçük alandaki özel ders limiti 5 olabilir. Yazılım fiilî salonun fiziksel kapasitesini ayrıca gözlemlemez; doğru seans limiti işletmenin sorumluluğundadır. Var olan oda fiziksel tavanı, toplam/kategori kontenjanı, gerekçeli kontrollü aşım, rezervasyon ve yarış kontrolleri gevşetilmez.

**Starter tek disiplin:** Organizatör/merkezden programa, sınıfa, seansa, pakete ve kesin katılıma dek gerçek disiplin kimliği aynı tek aktif disipline bağlıdır. Starter paketinin kullanıcıya gösterilen ismi **disiplin adıyla başlar** (ör. `Yoga · 8 Ders`); bu ön ek kayıtlı `discipline_id` üzerinden üretilir/doğrulanır, serbest isim hilesi ile ikinci disiplin açılamaz. Kaynağın teknik kimliği ve immutable satış/sürüm geçmişi salt isim değişikliğiyle değiştirilmez. Pro/Business isim politikası bu kararla değiştirilmez.

**Starter tek eğitmen:** Bir etkin öğretmen/görevli eğitim ilişkisi; dersler bu eğitmenle yürür. İkinci aktif eğitmen, paralel eğitmen programı, bağımsız personel yetkisi Pro gerektirir. Önceden önerilen dört yedek seans/30 gün ve ikinci geçici eğitmen istisnası **kabul edilmiş bir kural değildir**. Starter F14 yoklama/hak tüketimi ücret anlaşması olmadan kapanır, F20 hakediş/ücretli görevlendirme üretmez. Pro/Business ücretli görevlendirme ve hakediş için mevcut geçerli anlaşma şartları aynen korunur.

**Starter tek disiplinli sabit program:** Düzenli tekrarlayan grup sınıfları, temel bireysel ders talebi ve bunların değişiklik/iptal/telafi yaşam döngüsü; öncelikli veya esnek hakları, ders sayılı ve süreli/sınırsız paketleri, standart öğrenci self rezervasyonu, yoklama, borç ve manuel tahsilat korunur. Mevcut dersin meşru gerekçeli telafisi ayrı workshop/etkinlik hakkı vermez. Etkinlik/parti/workshop bileti ve `event_*` yaşam döngüsü, CRM satış/deneme/kampanya akışları Starter planında kapalıdır. Tekrarlanan sınıf adını “Workshop” yazmak tek başına kesin teknik sınıflandırma değildir; gerçek işlem türü, kaynak/plan kapısı ve kötüye kullanım politikası birlikte uygulanmalıdır.

**Starter public/self:** Temel halka açık ders takvimi ve yalnız programa ilişkin başvuru; doğrulanmış öğrencinin geçerli hak/katılım koşullarıyla kendi rezervasyon/iptal işlemi. Hesapsız başvuru **kesin rezervasyon, satış, kredi, aktif hesap veya pazarlama rızası yaratmaz**; bot/rate/tenant/yetki doğrulaması korunur. Başvuruyu görme ve gerektiğinde öğrenci ilişkisine bağlama için dar operasyonel değerlendirme sunulur; genel CRM `lead_*`, reklam entegrasyonu, kampanya, segment, otomasyon yetkileri Starter'a bu yüzden açılmaz. Provider ve tarayıcı kabulü backlog’da ayrı izlenir; Native Auth SMTP ile uygulama dış bildirim kanalları farklıdır. Online ödeme/gateway bu plan kararıyla otomatik açılmaz.

**Aktif öğrenci sınırı:** Önceden kabul edilmiş `RelationshipState=active` öğrenci sayımı esas alınır; hesapsız öğrenciler dahildir, aynı organizasyon kişisi bir kez sayılır, yalnız aday/eğitmen/personel olanlar sayılmaz. Seçili planın bağlayıcı tablodaki sınırı yeni aktive/yeniden aktive ve ilgili kesinleştirmede eşzamanlı atomik kontrol edilir. Limit aşıldığında mevcut hak, borç, yoklama ve kesin rezervasyonlar silinmez veya otomatik iptal edilmez. Açık işlemi olan öğrenci kotayı boşaltmak için keyfî pasifleştirilemez. Pro/Business öğrenci sınırları da aynı sayım ve korumayı kullanır. Business’ta farklı merkezlere bağlı aynı kişi organizasyonda bir kez sayılır; merkez başına öğrenci kotası yoktur. Ticari sınırsız oda/eğitmen teknik hız ve iş yükü korumalarını kaldırmaz. Fiyat bu kararla belirlenmez.

#### Plan geçişleri ve kaynak bütünlüğü

Plan değişiminin sürümlü kapsam seçimi, dönem sınırı ve kapalı kaynaklardaki eski işlemlerin davranışı [teknik sözleşmede](02-FtkSaaS-teknik-sozlesme.md#starter-kapsam-seçimi-ve-kapı-uygulaması) tanımlıdır. Geçmiş kayıt korunumu operasyon yetkisi sağlamaz.

#### Lokasyon, özel teklif ve limit temsili

Pro’nun odaları aynı fiziksel işletme lokasyonunun ders alanlarıdır. Ayrı lokasyon ayrı merkezdir ve Business gerektirir; oda adını değiştirmek bu sınırı kaldırmaz. Yazılım oda adından fiziksel adresi kanıtlamaz; aktif öğrenci kotası kötüye kullanımın ölçeğini sınırlar, tek başına lokasyon doğrulaması değildir.

Business standart merkez veya öğrenci sınırının üzeri müşteri başına sürümlü, açıkça kabul edilmiş özel sözleşme gerektirir. Standart dördüncü plan, genel bypass veya otomatik sınırsız merkez yoktur. Oda/eğitmen için sınırsızlık API/DB/okuma/doğrulayıcı/kapılarda açık ve aynı anlamda temsil edilir; 0 veya sihirli büyük sayı kullanılmaz. Ürün kararı runtime/hosted kabulü değildir; aktarım [backend backlog’unun](../../apps/backend/docs/remaining-work.md#p01) sorumluluğundadır.

## Belgenin durumu

Bu belge, yeni FtkSaaS için açıkça kabul edilmiş ürün kapsamını tanımlar. Önceki kapsam belgesindeki 14 modül ve 33 özellik yeni proje kararları olarak korunur. Eski proje, todo listeleri, kod, tablolar, iş kuralları, garantiler ve geliştirme modeli gereksinim kaynağı değildir. Yeni projenin hiçbir özelliği bu belgeyle uygulanmış sayılmaz.

Bu belge, geliştirme için yazılı kapsam sözleşmesi ve esas başvuru kaynağıdır. Eski todo listeleri bu sözleşmenin kaynağı değildir. Sonradan açıkça kabul edilen değişiklikler bu belgeye işlenir; öneriler tek başına kapsam değişikliği sayılmaz. Fiyatlandırma, teslim tarihi veya hukuki hizmet sözleşmesi yerine geçmez.

- Kapsam durumu: Kabul edildi / Sonraki aşama / Kapsam dışı.
- API kaynak kapsamı üretilmiş özellik haritasındadır; işlem sayısı ürün tamamlanma oranı değildir. Kabul, kaynak ve ortam kanıtıyla ayrıca izlenir.
- Planlar: Starter, Pro ve Business aynı backend iş modelini kullanır; plan farkı erişim ve kullanım limitidir.
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

Tablo kabul edilmiş plan erişimini gösterir; aynı plan bayrakları makine sözleşmesiyle CI’da karşılaştırılır. Sayısal/ticari sınırlar yukarıdaki bağlayıcı tablodadır; makine sözleşmesindeki `accepted_plan_limits` bu hedefin denetlenen aktarımıdır, runtime limiti veya teslim kabulü değildir. API kaynak kapsamı üretilmiş [özellik haritasında](../feature-delivery.md), gerçek kabul güncel kabul kaydındadır.

“Temel” ve “gelişmiş” ifadelerinin sınırları teknik sözleşmedeki davranışlarla belirlenir. Çizgi o planda kapsam dışında demektir. Her satırın uygulama/kabul sınırı feature_delivery haritasında ayrıca izlenir.

| ID | Özellik | Sahip | Starter | Pro | Business | Kapsam durumu |
|---|---|---|---|---|---|---|
| F01 | İşletme, merkez, oda ve kaynak tanımı | M01 | Bağlayıcı plan tablosu | Bağlayıcı plan tablosu | Bağlayıcı plan tablosu | Kabul edildi |
| F02 | Çalışma saatleri, izin ve uygunluk | M01/M04 | Temel | Tam | Tam | Kabul edildi |
| F03 | İşletme kuralları ve merkez istisnaları | M01 | İşletme ayarları | İşletme ayarları | Zorunlu/tavsiye merkez hiyerarşisi | Kabul edildi |
| F04 | Hesap eşleştirme, çoklu rol, kapsamlı yetkilendirme | M02/M03 | Var | Var | Merkez kapsamlarıyla | Kabul edildi |
| F05 | Resepsiyon/operasyon personeli izinleri | M02 | — | Var | Var | Kabul edildi |
| F06 | Öğrenci/eğitmen panelleri, profil ve şifre işlemleri | M02 + ilgili alanlar | Var | Var | Var | Kabul edildi |
| F07 | Tek kişi kaydı, adaydan öğrenciye dönüşüm | M03/M09 | Tek kişi altyapısı | CRM dönüşümü | CRM dönüşümü | Kabul edildi |
| F08 | Birleşik takvim ve kaynak çakışma kontrolü | M04 | Temel | Tam | Merkez bazlı | Kabul edildi |
| F09 | Özel ders talep, onay, ret ve alternatif saat | M04 | Var | Var | Var | Kabul edildi |
| F10 | Tekrarlayan grup programı ve sabit gruba kayıt | M04 | Var | Var | Var | Kabul edildi |
| F11 | Kontenjanlı açık grup dersine öğrencinin kaydolması | M04 | Tek disiplinli sabit programın öğrenci self rezervasyonu | Var | Var | Kabul edildi |
| F12 | Bekleme listesi ve süreli yer teklifi | M04 | — | Var | Var | Kabul edildi |
| F13 | Eğitmen değişikliği | M04/M08 | Tek aktif eğitmenin temel görevlendirmesi; ücretli/çoklu görevlendirme kapalı | Var | Var | Kabul edildi |
| F14 | Yoklama, gelmeme, iptal, erteleme ve yerine seans düzenleme | M05 | Var | Var | Var | Kabul edildi |
| F15 | Ders sayılı paket, geçerlilik ve kredi hareketleri | M06 | Temel | Tam | Tam | Kabul edildi |
| F16 | Süreli/sınırsız üyelik, dönemsel kullanım sınırı | M06 | Tek merkez/disiplin süreli veya sınırsız paket | Var | Var | Kabul edildi |
| F17 | Üyelik/paket dondurma ve plan değişimi | M06 | — | Var | Var | Kabul edildi |
| F18 | Merkezler arasında kullanım hakkı ve onaylı hesaplaşma | M06/M07 | — | — | Var | Kabul edildi |
| F19 | Manuel tahsilat, kısmi ödeme, iade/düzeltme ve alacak | M07 | Var | Var | Var | Kabul edildi |
| F20 | Eğitmen hakedişi ve ödeme takibi | M08 | — | Var | Var | Kabul edildi |
| F21 | Aday, kaynak, ilgi, takip ve dönüşüm | M09 | — | Tam | Tam; merkez/organizasyon kapsamıyla | Kabul edildi |
| F22 | Deneme teklifi ve kontrollü indirim | M09/M06/M07 | — | Var | Var | Kabul edildi |
| F23 | Yenileme ve hareketsiz öğrenci takip listeleri | M09 | — | Var | Var | Kabul edildi |
| F24 | Davranışa dayalı segmentler ve takip otomasyonu | M09/M10 | — | Var | Var | Kabul edildi |
| F25 | Paylaşılabilir işletme takvimi ve başvuru/kayıt sayfası | M04/M09/M13 | Yalnız ders takvimi/başvurusu; genel CRM veya etkinlik değil | Var | Var | Kabul edildi |
| F26 | Talep sonucu, ders değişikliği ve benzeri işlemsel bildirimler | M10 | Uygulama içi | Uygulama içi + e-posta | Uygulama içi + e-posta | Kabul edildi |
| F27 | Otomatik yaklaşan ders/paket bitiş hatırlatmaları | M10 | — | Var | Var | Kabul edildi |
| F28 | Operasyon ve finans raporları, tarih filtresi, dışa aktarım | M11 | Temel | Tam | Birleşik ve merkez bazlı | Kabul edildi |
| F29 | Atölye/etkinlik, kontenjan, kayıt ve katılım | M13 | — | Var | Var | Kabul edildi |
| F30 | Temel form ve sürümlü belge onayı | M14 | Var | Var | Var | Kabul edildi |
| F31 | Öğrenci, kalan kredi ve borç için veri içe aktarma | Ortak aktarım + M03/M06/M07 | Var | Var | Var | Kabul edildi |
| F32 | İşletme aboneliği, erişim ve kullanım limitleri | M12 | Var | Var | Var | Kabul edildi |
| F33 | Denetlenebilir geçmiş ve yinelenen işlem koruması | Bütün yazma alanları | Var | Var | Var | Kabul edildi |


## Sonraki aşama ve kapsam dışı

Tam web sitesi oluşturucu kapsam dışıdır; paylaşılabilir takvim/başvuru sayfası bu yeteneği içermez.

| Yetenek | Durum |
|---|---|
| Hediye kartı, referans ödülü | Sonraki aşama; Pro için ilk tamamlanma koşulu değil |
| Kiosk/QR check-in, mat veya cihaz seçimi | Sonraki aşama; doğrulanmış ihtiyaca bağlı |
| Markalı uygulama, video içerikleri, AI resepsiyon, müşteri keşif ağı | Sonraki aşama; mevcut kapsamın teslimat koşulu değil |
| Genel API/webhook ve üçüncü taraf entegrasyonlar | Sonraki aşama; ortak çoklu frontend backend'i gerekliliği korunur |
| Online kart ödeme, otomatik kart tahsilatı | Mevcut kapsam dışında; nakit/manuel ödeme tercihi korunur |
| Öğrenci gelişim takibi ve veli hesabı | Kapsam dışında |
| Bordro, işe alım, tam muhasebe, stok/ürün satışı | Kapsam dışında |


<a id="ilk-tam-sürüm-ve-sonraki-aşama-sınırı"></a>
### İlk tam sürüm ve sonraki aşama sınırı

İlk tam sürümde Pro/Business e-postası işlemsel bildirimler ve hizmet hatırlatmaları içindir. Kampanya/indirim/geri kazanım e-postası ertelidir; F21–F24 segmentleri, deneme, takip listeleri ve CRM görev otomasyonu kapsamda kalır. SMS, WhatsApp ve mobil push ile günlük/haftalık özet sonraki aşamadadır. Starter’ın uygulama içi sınırı korunur; Native Auth e-postaları uygulama dış kanal lisansından ayrıdır. Zamanlama ve sessiz saat davranışının tek sahibi teknik sözleşmedeki FD04’tür.

Lead/follow/switch rol dengesi ve partnerli rezervasyon sonraki aşamadadır; mevcut kategori kontenjanı korunur. Çok aktiviteli/kombine bilet de ertelidir: ilk tam sürümde workshop/parti ayrı etkinlik kaydı ve katılım koşullarıyla yürür. Pakete bağlı kredi tüketmeyen katılım ilk tam sürümdedir; davranış [P08’de](../decisions/P08-accepted-scope.md#pakete-bağlı-kredi-tüketmeyen-etkinlik-katılımı) tanımlıdır. Abone No Starter’dan itibaren bütün planlardadır; yaşam döngüsünün tek sahibi [P08](../decisions/P08-accepted-scope.md#organizasyon-bazında-sabit-abone-numarası).

## Davranış kararlarına geçiş

D01–D09 disiplin, U01–U08 kimlik, Q-D01/Q-E01/Q-E02/Q-E03 etkinlik, DS hesaplaşma, 69 ayar grubu ve FD01–FD12 kararlarının tek normatif ayrıntısı [teknik sözleşmedir](02-FtkSaaS-teknik-sozlesme.md). Bunların API çağrı sırası [ortak iş akışlarında](../workflows.md), durum/hata/izin görünümü [06 sözleşmesinde](06-FtkSaaS-O4-durum-hata-izin.md) bulunur. Burada ikinci karar kopyası tutulmaz.
