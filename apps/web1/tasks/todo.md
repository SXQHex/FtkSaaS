# FtkSaaS · Frontend geliştirme ve kabul listesi

**Sıradaki iş** · E10 özel fotoğraf: taslak seçimi/kaldırma ve authenticated medya okuma; E03/E04/E05 yerel görsel ve SDK zinciri doğrulandı, gerçek posta kabulü P01’de açık; E02 kullanıcı kararıyla Pro teslimine açık istisna olarak ertelendi.
**Aktif hedef** · Çalışan Pro kabulü.  
**Sonraki teslimler** · Starter → Business; bu goal kapsamında başlatılmaz.  
**Çalışma alanı** · `apps/web1`, kendi npm kurulumu, testleri ve yayın süreci olan bağımsız uygulamadır. Üç plan aynı uygulamayı ve ortak backend sözleşmelerini kullanır.

[Ön tarama](#on-tarama) · [Sayfa kabulü](#sayfa-kabulu) · [Başlangıç](#baslangic) · [Pro](#pro) · [Pro kabulü](#pro-kabulu) · [Starter](#starter) · [Business](#business) · [Kaynaklar](#kaynaklar)

## /goal yürütme talimatı

Bu çalışmanın hedefi yalnız Pro işlevlerini uygulamak ve gerçek backend ile Pro kabul ölçütlerini karşılamaktır. Starter ve Business sonraki teslimlerin takip kayıtlarıdır; aktif goal bunları otomatik başlatmaz. Business ekranları daha sonra eklenecektir; şimdi çizim veya yeni ekran kompozisyonu üretme. Çalışmayı GPT-Sol 6.1 Medium ile, bu dosyadan iş seçerek sürdür. İlk açık ve önkoşulları karşılanmış işi uygula, doğrula, kaydet ve sıradakine devam et. Teknik olarak karara bağlanabilen ayrıntıları mevcut kaynaklardan çöz.

### Başlangıç ve devam kaydı

| Aktif adım | Plan | Sayfa/işlev           | Durum | Son doğrulama veya engel                                                                                                                    | Sonraki eylem                                                                                                                                                                |
| ---------- | ---- | --------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E10        | Pro  | Özel profil fotoğrafı | Hazır | Yerel verify 95 test/18 Chromium/3 politika; profil metinleri gerçek development’ta yazıldı, reload doğrulandı ve eski değerlere döndürüldü | Mevcut profil formunda fotoğrafı aynı sürümlü kaydın taslağı olarak tut; CLI Avatar ile göster, 1MiB PNG/JPEG/WebP ve checksum protokolünü/private media_get okumasını bağla |

Kullanıcı gerekli soruların açık WhatsApp uygulamasındaki kendine mesaj sohbetine gönderilmesini ve yanıtların oradan okunmasını istedi; yalnız bu görev soruları/teyitleri o kanaldan gönderilir. Son yeniden denemede WhatsApp `cgWindowNotFound`, başka uygulama penceresi seçimi timeout verdi; pencere yeniden erişilebilir olduğunda yanıt kontrol edilir. E02 erteleme cevabı bu hata öncesinde okundu ve teyit edildi.

Her başarılı dilimden veya somut engelden sonra bu satırı güncelle. Yeni oturumda önce satırı, aktif sayfanın alt adımlarını ve yalnız ilgili sözleşme/kodu oku. Tamamlanmış maddeleri yeni kaynağa etkisi gerektirmedikçe yeniden uygulama. Mevcut Git değişikliklerini incele, başkasının çalışmasını koru.

### Dosya yerleşimi

Hibrit feature-based düzeni kullan. Her sayfayı kendi E maddesiyle teslim et, dosyalarını ise ilgili iş alanında tut. Giriş, kayıt ve parola kurtarma aynı `auth` alanına aittir.

| Konum                  | Sorumluluk                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/`          | TanStack Router girişleri. URL parametrelerini, route düzeyindeki erişim kontrolünü ve yönlendirmeyi bağlar, ilgili feature sayfasını açar.              |
| `src/features/<alan>/` | Alana ait sayfalar, hazır bloklardan gelen formlar, sorgular ve kullanıcı işlemleri birlikte durur. Alana özel test, sınadığı dosyanın yanında yer alır. |
| `src/components/ui/`   | shadcn registry’sinden gelen ortak UI bileşenleri. Mevcut `components.json` eşlemelerini kullan.                                                         |
| `src/components/`      | Uygulama genelinde paylaşılan kabuk ve yerleşim. Yönetici ve öğrenciye özgü gezinmeyi gerektiğinde burada hazır parçalarla birleştir.                    |
| `src/lib/`             | Mevcut Supabase istemcisi, ortak API taşıma kodu ve alandan bağımsız teknik yardımcılar.                                                                 |
| `src/test/`, `e2e/`    | Ortak test kurulumu ve MSW sunucusu `src/test/` içinde, tarayıcı senaryoları `e2e/` içinde yer alır.                                                     |

Klasörü ilk dosyası gerektiğinde aç. Mevcut boilerplate’i koru. Ekran envanteri veya plan başına klasör açma. Bir iş alanı düz bir klasörle başlar, alt klasörler içerik büyüdüğünde eklenir. Tam FSD katmanları kurmak için hazırlık görevi açma.

Ortak kullanılan bir işin sahibi kendi alanıdır. Örneğin öğrenci profili ve finans ekranı aynı tahsilat işlemini `features/billing/` üzerinden kullanır. Pro, Starter ve Business aynı alan kodunu kullanır. Ekranda hangi eylemlerin açılacağını güncel backend yetkisi ve plan kapsamı belirler.

### İlerleme döngüsü

1. Ürün geneli taraması aşağıda tamamlandı. T01 ile yerel temeli, T02/T03 ile kaynak sürümü ve taşınan referansları doğrula. Yeni baştan ürün/bileşen taraması yapma; yalnız aktif sayfanın kaynağını ve değişen sözleşmeyi kontrol et.
2. Aşağıdaki çalışma sırasından uygulanabilir ilk sayfayı seç. Sayfanın E alt adımlarını sırayla işle. Bir anda tek bir görsel parça veya kullanıcı işlemi geliştir.
3. E*.5 birden çok kullanıcı işlemi içeriyorsa ilgili açık P alt maddelerinden tek birini seç. O işlemde okuma → kullanıcı eylemi → sonuç okumasını tamamla ve odaklı doğrulamayı yap. Sonraki işleme bu sonuç kaydedildikten sonra geç.
4. Tüketici ekranın ihtiyacı kadar ortak kabuk, erişim ve ayar işini birlikte tamamla. İşlev önkoşulu bir başka ekrandaysa o ekrandaki gerekli dilimi öne al. Tablolardaki paket önkoşulları, o paketin tüm sayfalarının önceden kapanmasını gerektirmez.
5. İlgili kontrolleri çalıştır. Hata varsa nedenini düzelt ve etkilenen kontrolü yeniden çalıştır. Test, izin veya görsel kabul ölçütünü başarılı sonuç üretmek amacıyla gevşetme.
6. Doğrulanan E/P/S/B maddesine kaynak, ortam ve sonucu ekle. Kullanıcı kararıyla izin verilen görsel fark varsa aynı sayfada gerekçesini kaydet. Sayfa tamamlandığında E kutusunu kapat.
7. Geçerli repo Git/PR ve kabul kurallarını izleyerek ilerlemeyi kaydet. Aynı mantıksal teslimde birkaç doğrulanmış dilim bulunabilir. Dosyanın çalışma sırasından devam et.

### İş seçimi ve bağımlılıklar

| Sıra                     | Yapılacak sayfa veya dilim                                                                                        | Gerçek önkoşul                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0                        | T01 → T02 → T03                                                                                                   | Güncel repo, yerel kurulum, çizim kaynakları                                                                                                           |
| 1                        | E01 → E02 → E03 → E04 → E05 → E06                                                                                 | Her akış için mevcut Auth/transport desteği ve gereken test hesabı. Eksik dış bağımlılıkta hazır görsel adımları tamamla, entegrasyonu engelli kaydet. |
| 2                        | E10 ve E32’nin hesap/güvenlik dilimleri → E09                                                                     | Native oturum. Hesap silme sonucu, izinli silme/durum akışını izler.                                                                                   |
| 3                        | P02’nin asgari rol/merkez gezinmesi → E12’nin kurulum/kaynak/ekip dilimleri → E13                                 | Mevcut veya UI üzerinden oluşturulabilen yetkili organizasyon/merkez                                                                                   |
| 4                        | E15 → E07 → E08 → E16                                                                                             | Kişi ve davet oluşturma dilimi. Davet sayfalarının gerçek kabulü test daveti hazırlandıktan sonra yapılır.                                             |
| 5                        | E22’nin gerekli belge kaynağı → E23’ün anlaşma dilimi → E17                                                       | İlgili kişi/eğitmen ve kaynaklar. Dijital anlaşma için WF14’ün kendi belge kaynağını doğrula.                                                          |
| 6                        | E19 → E20 → E18’in rezervasyon ve yoklama dilimleri → E23’ün hakediş/ödeme dilimi                                 | Uygun ürün, öğrenci, seans, gereken belge ve anlaşma. Gerekli P17 ayarı ilk tüketici işlemde bağlanır.                                                 |
| 7                        | E14’ün hak/finans dilimleri → E21 → E24 → E25 → E26 → E27 → E28 → E29 → E30 → E31 → E32’nin kalan dilimleri → E11 | İlgili ders günü ve kişisel erişim kayıtları                                                                                                           |
| 8                        | E33 → E34 → E35 → E36 → E37 → E38                                                                                 | CRM/public için gereken kaynaklar ve public transport, etkinlikte ilgili kayıt/finans akışı                                                            |
| 9                        | E39 → E40 → E41 → E42’nin kalan dilimleri → E43 → E44                                                             | İlgili kaynak olayları, worker/dosya hizmetleri ve güncel yetki                                                                                        |
| Ortak                    | E45/E46                                                                                                           | İlk sayfanın durum görünümüne ihtiyacı olduğunda gereken hazır durum bileşenini burada doğrula.                                                        |
| Pro kapanışı             | Açık Pro E/P maddeleri → G-PRO maddeleri                                                                          | Kaynak, build ve gerçek ortam kanıtları                                                                                                                |
| Sonraki teslim: Starter  | S01 → S02 → S03 → S04 → S05 → G-STARTER maddeleri                                                                 | G-PRO-05 ve bu teslimin ayrıca başlatılması                                                                                                            |
| Sonraki teslim: Business | B01 → B02 → B03 → B04 → B05 → B06 → G-BUSINESS maddeleri                                                          | G-STARTER, sonradan sağlanacak Business ekranları ve bu teslimin ayrıca başlatılması                                                                   |

Kısmi sayfa çalışmasında biten alt adımlar işaretli kalır. Örneğin E23 anlaşmalarıyla programı mümkün kıldıktan sonra E17’ye geç, E23 hakedişini yoklama hazır olduğunda bitir. Sayfanın üst kutusu bütün uygulanabilir alt işler doğrulanınca kapanır. E numarası çizim kimliğidir, mutlak yürütme sırası yukarıdaki tablodan gelir.

### Engel ve durma davranışı

- Engeli aktif kayıtla birlikte ilgili E/P/S/B maddesinde tut. Türünü, eksik API/config/hazır bileşen/kararı, sorumlu tarafı, gözlenen hatayı ve devam koşulunu yaz.
- Yetkili kapsamda çözülebilen kod, kurulum veya test hatasını çöz. Backend değişikliği gerektiren konuda somut istek hazırla ve alan koordinasyon kurallarını izle.
- Çizim veya hazır bileşen eksiğinde mevcut dosyaları/registry’yi kontrol et. Elle UI bileşeni üretme. Teknik olarak uygun hazır alternatifleri değerlendir, gereken ürün/görsel kararını açık kaydet.
- Engellenen işlemin bağımsız alt adımlarını, ardından aynı planın sıradaki uygulanabilir sayfasını tamamla. Yeniden kontrol için yeni kaynak/config/erişim kanıtı gerektiğini kaydet. Değişiklik olmadan aynı başarısız işlemi döngüde tekrarlama.
- Yalnız gerçek bir eksik karar/yetki/girdi veya dış hizmet engeli kaldığında kullanıcıya devret. Gerekli kararın hangi işi açacağını açıkla. Mevcut yetki sınırları ve repo kuralları uygulanır.
- Pro kabulü karşılanmadan Starter kabulüne, Starter karşılanmadan Business kabulüne geçme. Plan kapanışı bu dosyadaki ölçülebilir teknik kabul ve gerçek ortam kanıtlarına dayanır. İnsan değerlendirmesi veya gereken işlem anı onayı ayrıca kaydedilir, verilmemiş onay varsayılmaz.

### Kutuları kapatma ve hedefin bitişi

Her işaretli madde ilgili kaynak/PR veya test koşusuna, ortamına ve gözlenen sonuca bağlanır. Görsel adımın tamamlanması ve gerçek entegrasyon kabulü kendi kutularında kaydedilir. Yerel odaklı doğrulamada `npm test -- <test-yolu>` veya `npm run test:e2e -- <spec-yolu>`, teslim adayında `npm run verify` kullan. Komutları `apps/web1` içinde çalıştır. Ortak izolasyon kurallarını koruyarak gerçek backend kabulünü yetkili ortamda yap.

Aktif goal, E01–E46 kapsamındaki Pro ekranlarının uygulanabilir alt işleri, P01–P17 ve G-PRO-01–G-PRO-05 kabul kanıtları tamamlandığında biter. G-PRO-05 sonrasında sonucu kaydet ve teslim et; Starter/Business geliştirmesine kendiliğinden geçme. Dış engel nedeniyle bitmiyorsa açık maddelerin kimliğini, yapılan işi ve devam için eksik girdiyi son kayıtta bırak. Her turun sonunda yeni genel prompt beklemek yerine bu dosyadaki devam kaydını esas al.

<a id="on-tarama"></a>

## Tamamlanan ürün geneli kaynak taraması

**İnceleme tarihi:** 13 Kasım 2026. **Repo tabanı:** `1249532c0abe8d340b268b3d5dff33a547fea9e5` (main, PR303). İncelenenler: özgün dört çizim dosyasının tamamı ve arşiv eşitliği; uygulama manifesti, router/form/UI/i18n/test/CI temeli; ürün F01–F33 matrisi; WF00–WF20; API haritası/makine sözleşmesi; istemci protokolü/ayarlar; backend'in güncel S18 devri. Bu kayıt kaynak ve tasarım eşlemesidir. Tarayıcıda bütün etkileşimlerin çalıştığı, tüm adayların kurulup uyumlu olduğu veya canlı ürün kabulünün tamamlandığı iddia edilmez.

### Kaynakların neyi sağladığı

- `index.html`: 47 `data-view`; 46 envanter ekranı ve bir `taslak` yer tutucusu. Yönetici, eğitmen, öğrenci, anonim Auth ve public akışları var. Global arama, iç içe çekmeceler ve işlem diyalogları ana ekran sayısından bağımsızdır; yalnız ekranın ilk görünümünü uygulayıp işi kapatma.
- `app.css` ve `tokens.css`: renk/ölçü/tema ve responsive görsel kaynak. HTML yalnız `app.css` ile `app.js` yükler; token dosyasını ikinci defa enjekte etme. Referans Geist, başlangıç uygulaması Inter kullanır; font ve token eşitliğini K01’de ele al.
- `app.js`: fixture, yerel durum, hash gezinmesi ve demo etkileşimleri. Gerçek fetch/Supabase entegrasyonu sağlamaz. Satış, hak, çakışma, yoklama, iade, hakediş, davet ve CRM için buradaki hesaplama/durum kodu üretime kopyalanmaz.
- Çizim `login-02 / signup-02` düzenini açık yorumla belirtir. Diğer parçalar hazır registry kimlikleriyle etiketlenmemiştir; aşağıdaki eşleme bu incelemede çıkarılmıştır.
- Mevcut uygulama çalışan araç zinciri ve örnek ekran/form temelidir. Çizim envanterindeki gerçek uygulama akışları henüz teslim edilmiş sayılmaz. Başka frontend'in veya backend'in kabulü bu uygulamanın kabulü değildir.
- Çizimler ayrı bir Business organizasyon/hesaplaşma görünümü sağlamaz. Bu boşluk Business teslimine ertelenmiştir; “tüm ekranlar hazır” ifadesi Business işlev kapsamının görsel olarak tamamlandığı anlamına gelmez.

### Hazır kaynak kararı ve seçim sınırları

| Kod | Kaynak / kullanım                                                                                                                                                                                                                   | Bu taramanın sonucu                                                                                                                                                                                                                                                                             | Uygulamada yapılacak dar kontrol                                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K01 | [shadcn bileşenleri](https://ui.shadcn.com/docs/components), [login blokları](https://ui.shadcn.com/blocks/login), [signup blokları](https://ui.shadcn.com/blocks/signup), [sidebar blokları](https://ui.shadcn.com/blocks/sidebar) | Ana kaynak mevcut `aria-rhea`, React Aria, Lucide düzeni. E01 `login-02`, E02 `signup-02`; kabuk için Sidebar/Sheet, Breadcrumb, Command, DropdownMenu, Avatar, Tooltip, ScrollArea. Tam sidebar bloğunu görseli değiştirecek şekilde zorla alma; hazır parçalarla çizimdeki kompozisyonu koru. | Repo kökündeki `.agents/skills/shadcn/SKILL.md` rehberini oku; CLI/registry ile gerçek uyumlu varyantı incele/ekle. Projenin preset'ini veya primitive tabanını değiştirme. Listedeki isimlerin tümü başlangıçta kurulu değildir.                                                                                                                                             |
| K02 | [FullCalendar React](https://fullcalendar.io/docs/react), [plugin listesi](https://fullcalendar.io/docs/plugin-index), [lisans](https://fullcalendar.io/license); mevcut Syncfusion Community seçeneği                              | Shadcn Calendar/DatePicker yalnız tarih seçimi sağlar; ders haftası/olay sürükleme/zaman ızgarası için yeterli değildir. FullCalendar Standard hazır adaydır, kurulum ve görsel eşitlik doğrulanmadı. Syncfusion için önce mevcut lisans ve modül kapsamını doğrula.                            | E17.2'de hafta/gün, responsive, erişilebilir olay açma, saat dilimi, çizimdeki kaynak kolonları ve gerekli sürükleme/resize davranışını matrise bağla. Standard'ın karşılamadığı kaynak görünümünü özel grid yazarak tamamlama; lisanslı hazır seçeneği değerlendir. Uygun seçeneği kaydet, ücretli modülü yetkisiz ekleme. İş çakışması/tekrar kurallarını backend belirler. |
| K03 | [Dice UI Kanban Base](https://www.diceui.com/docs/components/base/kanban), [Radix varyantı](https://www.diceui.com/docs/components/radix/kanban)                                                                                    | E33 için gerçek hazır pano adayı bulundu; React Aria varyantı ve proje uyumu bu incelemeyle doğrulanmış değildir.                                                                                                                                                                               | E33.2'de registry içeriği, lisans, bağımlılık/primitive uyumu, klavye ve dokunmatik davranışı incelenir. Mevcut primitive tabanı değiştirilmez. Uygun hazır kaynak yoksa pano alt parçası engeldir; elle drag/drop bileşeni yazma. Diğer CRM dilimleri sürdürülebilir.                                                                                                        |
| K04 | Resmi Chart/Tablo/Dosya parçaları; resmi Turnstile widget                                                                                                                                                                           | E20/E23/E27/E41/E43 tabloları çizimde gereken yerde kullanılır; genel yerleşim card-first kalır. Grafik resmi Chart kaynağından, dosya seçimi Field/Input ile sağlanabilir. Public bot doğrulaması hazır resmi widget kullanır.                                                                 | Resmi Aria Chart/Sheet/InputOTP varyantını ve gerçek importları kontrol et. Belge görüntüleme için formatın hazır tarayıcı görüntüleyicisini/uyumlu hazır kütüphaneyi kullan; özel editör/uploader üretme. Dosya/rapor için API imzalı yol ve yetki korunur.                                                                                                                  |

Bütün sayfalarda ortak hazır durum parçaları E45/E46'dan gelir. Sheet/Drawer, Dialog/AlertDialog, Popover/Combobox, Command, Tabs ve DropdownMenu davranışlarını CSS sınıflarıyla yeniden yazma. Resmi kaynağı kurup görünümünü uyarlamak ve bu parçaları sayfada birleştirmek serbesttir. Uygun hazır bileşen yoksa bu dosyada somut eksik olarak kalır.

**İlk Auth sayfasının kaynağı doğrulandı.** Resmî [login-02](https://ui.shadcn.com/r/styles/aria-rhea/login-02.json) ve [signup-02](https://ui.shadcn.com/r/styles/aria-rhea/signup-02.json) kayıtları projenin `aria-rhea` stilinde bir sayfa ve bir form sağlıyor. Her iki kaydın bağımlılıkları `button`, `input`, `label` ve `field`. E01/E02'de projenin kilitli CLI sürümüyle hedef dosya farkını incele. Bloğun sayfa yerleşimini ve formunu koruyarak registry'nin `app/login/page.tsx` ve `app/signup/page.tsx` girişlerini projenin TanStack Router route'larına uyarla. Form alanlarının ve izinli giriş yöntemlerinin kaynağı P01'dir. Tarayıcıda görsel ve gerçek Auth kabulü E01/E02'de yapılır.

### İşlevlerin ekranlara tamamlanan eşlemesi

Bu tablo gezinme/uygulama izidir; plan erişimi ve DTO'nun ikinci tanımı değildir. Normatif plan matrisi ve güncel action/permission bilgisi ortak sözleşmeden okunur.

| Özellik | Ekran / ortak tüketici                | İşlev işi               | Özel farkın kabulü           |
| ------- | ------------------------------------- | ----------------------- | ---------------------------- |
| F01     | E12                                   | P03                     | S01; B01                     |
| F02     | E12, E17, E42                         | P03, P06, P17           | S01/S02; B01                 |
| F03     | E12, E42 ve ilk ayar tüketicisi       | P17                     | B01                          |
| F04     | E01–E10, E12–E16, ortak kabuk         | P01, P02, P03, P04      | B01/B02/B06                  |
| F05     | E12, E42                              | P03, P17                | S04; B01                     |
| F06     | E10, E24–E32                          | P01, P11                | S03                          |
| F07     | E13–E16, E33, E41                     | P04, P12, P16           | S03; B02                     |
| F08     | E17, E25, E28, E34                    | P06, P11, P12           | S01/S02                      |
| F09     | E21, E31                              | P06                     | S02                          |
| F10     | E17, E18, E28                         | P06, P09                | S02                          |
| F11     | E18, E28, E29                         | P09, P11                | S03                          |
| F12     | E18, E29, E39                         | P09, P14                | S04                          |
| F13     | E12, E17, E18, E23                    | P03, P05, P06           | S02/S04                      |
| F14     | E17, E18, E24–E26                     | P06, P10                | S02                          |
| F15     | E14, E19, E28–E30                     | P07, P09, P10           | S02; B03                     |
| F16     | E14, E19, E30                         | P07                     | S02; B03                     |
| F17     | E14, E19                              | P07                     | S04/S05                      |
| F18     | E19/E20/E41 Business genişletmeleri   | B03, B04                | B03–B06; ayrı çizim eksik    |
| F19     | E14, E19, E20, E30, E38               | P07, P08, P13           | S02; B04                     |
| F20     | E23, E27, E38                         | P05, P10, P13           | S02/S04                      |
| F21     | E33, E35, E41                         | P12                     | S03/S04; B02                 |
| F22     | E33, E19                              | P12, P07                | S04                          |
| F23     | E33, E39, E40                         | P12, P14                | S04; B02                     |
| F24     | E33, E40                              | P12, P14                | S04; B02                     |
| F25     | E34–E36                               | P12                     | S03; B02                     |
| F26     | E15, E39, E42                         | P04, P14                | S03/S04                      |
| F27     | E39, E40, E42                         | P14, P17                | S04                          |
| F28     | E20, E23, E27, E41                    | P16                     | S03; B05                     |
| F29     | E37, E38                              | P13                     | S04                          |
| F30     | E22, E32 ve gereken işlem diyalogları | P15                     | S03                          |
| F31     | E41                                   | P16                     | S03                          |
| F32     | E12, E42 ve limitli işlemler          | P03, P17                | S01/S05; B01/B05/B06         |
| F33     | E43 ve bütün yazma akışları           | P02, P07, P08, P10, P17 | G kabulü; tekrar/yanıt kaybı |

### Çizim ile gerçek ürün arasındaki tespitler

| Tespit                                                                                                              | Etkilenen iş                 | Bağlayıcı uygulama yönü                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kayıt sayfasındaki “stüdyonu oluştur/kart gerekmez” anlatımı kayıtla otomatik işletme yaratıldığı izlenimi veriyor. | E02, P01.1, P03.1            | Native hesap kaydı, hesap/rol okuması ve yetkili işletme oluşturma ayrı işlemlerdir. Metni gerçek akışa uydur; görünüm istisnasını kaydet.                        |
| Demo MFA kurtarma kodu, önizleme/davet süreleri, yeniden gönderim sınırı ve 1 MB görsel limitleri sabit.            | E06/E10/E12/E15/E32          | Native sağlayıcı ve yayımlanmış DTO/ayar geçerli. Desteklenmeyen recovery-code UX'i çalışıyormuş gibi sunma; süre/limit uydurma.                                  |
| Abonelik çiziminde örnek ₺990 ve sabit gelecek fatura tarihi var.                                                   | E42, P17                     | Güncel abonelik/plan/etkili tarih backend'den okunur. Çizim tutarı üretim fiyatı değildir.                                                                        |
| Satış, dondurma, iptal/iade, yoklama ve hakediş demo JS'sinde hesaplanıyor.                                         | E14/E17–E20/E23/E27/E30/E38  | Yetkili önizleme → açık kullanıcı işlemi → uygulama → yeniden okuma. Aynı iş anahtarıyla tekrar ikinci etki yaratmaz; finans değeri istemcide yeniden türetilmez. |
| Bildirim, otomasyon ve belge görselleri bütün sağlayıcı işlerinin kanıtı değil.                                     | E22/E23/E32/E39/E40          | Cron/teslim backend'de; dil ve metin kaynağı güncel WF11/WF12/WF14/S17'ye uyar. Tarayıcıdan alınan metni yetkili sözleşme gibi imzalatma.                         |
| Gezinme hash tabanlı ve rol değiştirme demo seçicisidir.                                                            | P02 ve bütün E sayfaları     | TanStack route, native session ve canlı rol/merkez kapsamı; URL yenileme, geri dönüş ve cache ayrımı. Demo rol seçimi yetki vermez.                               |
| Ortak komut araması ve birden çok Sheet/Dialog ana ekran dışında tanımlı.                                           | P02, E14/E17–E23/E33/E38/E41 | İlgili eylemde açılan her panel ve iç durum, aynı sayfanın görsel/işlev kabulüne dahildir. İç içe odak/escape/klavye hazır bileşenden gelir.                      |
| Business merkez kapsamı, ortak başvuru/kişi, kullanıma açık merkezler ve hesaplaşma için ayrı çizim yok.            | B01–B06                      | Business ekranları sonradan sağlanacak. Şimdi route, ekran veya kompozisyon üretme; Business geliştirmesi için Pro kabulünü bekletme.                             |
| Yardım ve durum kataloğu örnekleri gerçek destek/operasyon hizmeti değildir.                                        | E44–E46                      | Geçerli içerik/kanala bağla; sahte gönderildi/başarılı sonucu verme. Durum kataloğu geliştirme kaynağıdır.                                                        |

### Statik SPA bağlantısında mevcut durum

S18 backend transport ve hosted kabulü main'de kapanmıştır. Backend'e aynı taşıma işini yeniden açma. Frontend'in kalan işi yayımlanmış protokolü tüketmek ve kendi ekran kabulünü yapmaktır. Güncel değerlerin tek sahibi [istemci protokolü](https://github.com/SXQHex/FtkSaaS/blob/main/docs/client-integration.md#statik-spa-transportu) ve [backend devri](https://github.com/SXQHex/FtkSaaS/blob/main/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md#statik-spa).

- Oturumlu çağrılar native Supabase JWT/AAL ile Edge `backend-v1/{operation}`; tablo/private RPC veya frontend sunucusu kullanılmaz.
- Signup ön kontrolü `VITE_PUBLIC_GATEWAY_URL/api/auth/signup-check`; public takvim/başvuru `/api/public/calendar` ve `/api/public/application`. IP, ingress imzası ve sırlar tarayıcıya taşınmaz. Worker'ın hazır olması Turnstile/Google/posta tarayıcı kabulünü kapatmaz.
- Tek SDK callback sahibi: native PKCE, `detectSessionInUrl:false` ve callback'te yalnız bir `exchangeCodeForSession`. Redirect allowlist, `next` allowlist'i ve recovery route'ları protokole uyar; eski tüketicilerin callback/config'ini kendiliğinden değiştirme.
- Ayar şekilleri kanonik backend üretiminden gelen dört statik JSON'dur; canlı ayar değeri/action izni API'den okunur. Mevcut üretici dış dizine yazıyorsa uygulama sınırını aşarak çalıştırma; hazır üretilmiş artifact'ı al veya somut artifact isteğini T02.2'de kaydet. Tarayıcıda ayrı izin kataloğu üretme.
- ICS endpoint'i Supabase Edge'dedir. Mevcut seans linki eski frontend'i hedefler; yeni route + login + canlı yetki kabulünden sonra ilgili backend config sahibine hedef değişikliği devredilir. E32/P11.3 kapanışında gerçek takvim istemcisi kabulü gerekir.
- Development public env ve origin hazırlanmıştır. Bu dosya DNS/production yayınının yapıldığı iddiasını taşımaz. `app.fethiyetango.com` statik dağıtım, SPA fallback ve environment kabulü T02.3/G-PRO-04'te kanıtlanır.

### Business ekranlarının ertelenmesi

Business merkez kapsamı, ortak kişi/başvuru, merkezler arası kullanım, hesaplaşma ve birleşik rapor ekranları **daha sonra eklenecek**. Bu tarama yalnız eksik görsel kapsamı kaydeder; bu alanlara ekran tasarlamaz veya uygulama route'u atamaz. B01–B06 sonraki teslimin işlev kabul kayıtları olarak korunur. Business tasarımları geldiğinde yalnız yeni ekranlar hazır bileşenlerle eşlenir. Pro'nun mevcut 46 ekranı ve P01–P17 işleri bu girdiyi beklemez.

<a id="sayfa-kabulu"></a>

## Sayfa sayfa geliştirme ve görsel kabul

### Bağlayıcı uygulama kararı

- Her sayfa, hazır çizimin birebir görünümünü hedefler. Yerleşim, ölçüler, boşluklar, tipografi, renkler, ikonlar, metinler, çekmece/diyaloglar ve mobil davranış çizimden alınır.
- Elle UI bileşeni yazılması yasaktır. Her görsel/etkileşimli bileşen mevcut proje bileşeninden veya uygun hazır kütüphane/registry kaynağından sağlanır. Button, Input, Select, Sheet, Dialog, Sidebar ve benzeri yapılar için özel karşılık üretilmez.
- Sayfa kodu, hazır bileşenlerin kompozisyonunu, yerleşim/tema uyarlamasını, TanStack Router/Form/Query bağlantısını ve gerçek API entegrasyonunu içerir. Hazır bloğun alanları ve içeriği çizime göre uyarlanır. Özel CSS/HTML ile hazır bileşenin davranışını yeniden kurmak yasaktır.
- Çizimdeki eksik/fazla erişim veya bileşen nedeniyle gereken fark, sayfanın kendi kaydında açıklanır. Yetki ve ürün sözleşmesine uyan alan/eylem gösterilir. Bu istisnalar dışında görsel yeniden tasarım yapılmaz.
- Uygun hazır bileşen bulunamazsa ilgili parça engel olarak kaydedilir ve hazır alternatifler değerlendirilir. Sayfa bu boşlukla tamamlandı olarak işaretlenmez. Özel UI bileşeni yazmak çözüm olarak uygulanmaz.

### Her sayfanın yedi adımı

Her sayfa için aşağıda yedi ayrı kutu hazırdır. Önce kapsam ve hazır kaynak seçimi, ardından görsel uygulama ve karşılaştırma, sonra tek tek işlev bağlantıları, doğrulama ve kayıt yapılır. Büyük sayfanın backend adımında yalnız bir P alt maddesini ele al. Aynı E*.5 altında işlem bazlı alt kutular açıp bu dilimleri tek tek takip et.

Görsel karşılaştırmada kaynak çizimi ve uygulamayı aynı viewport, tema, içerik ve ekran durumunda aç. Başlangıçta 1440×900 masaüstü ve 390×844 mobil görünümü kullan, kaynakta ek breakpoint varsa onu da kontrol et. Referansta bulunan temaları ve ilgili etkileşim durumlarını karşılaştır. Boşluk, ölçü, tipografi, renk, ikon, taşma ve açılan panellerde açıklanmamış fark bırakma. Bu ölçüler ürün cihaz sınırı değil, tekrarlanabilir karşılaştırma başlangıcıdır.

### Sayfa kayıt biçimi

Her aktif sayfanın altına şu alanları doldur. Durum ve kanıt ilerledikçe aynı kaydı güncelle.

| Alan            | Kaydedilecek bilgi                                                                  |
| --------------- | ----------------------------------------------------------------------------------- |
| Çizim ve hedef  | Dosya/bölüm, route, rol, plan ve karşılaştırma viewport/tema/durumları              |
| Hazır kaynak    | Blok/bileşen adı, resmî veya seçilmiş registry URL’si, sürüm, React Aria/Rhea uyumu |
| Aktif işlem     | E alt adımı ve varsa tek P/S/B alt maddesi, okuma → eylem → yeniden okuma sırası    |
| Doğrulama       | Kaynak/build, test/ortam sonucu, referans ve uygulama karşılaştırması               |
| Fark veya engel | İzinli farkın gerekçesi veya eksik girdinin devam koşulu                            |

### Sayfa envanteri

Aşağıdaki route'lar frontend için bu taramada önerilen uygulama yollarıdır; mevcut çalışan route kabulü değildir. `$orgId/$centerId` kapsam parametreleri backend verisinden gelir. `/auth/callback`, `/forgot-password` ve `/reset-password` mevcut SPA protokolünün yollarıdır; callback ortak teknik route olarak E01–E05 ile birlikte uygulanır. Route adları yeni API veya izin üretmez.

İlk uygulama sayfası **E01 giriş**. İş seçimi /goal çalışma tablosunu izler. Ortak kabuk ilk tüketici sayfada kurulur. Her sayfanın seçilen hazır kaynakları ve işlem bazlı ilerlemesi kendi maddesinde tutulur.

- [ ] **E01** · **Giriş** — çizim `data-view="a-giris"` · İşlev P01.2, P01.3 · Route `/login` · Rol/kapsam: Anonim · Hazır kaynak: login-02; Field, Input, Button, Separator · Bağ: Native parola/Google; tek callback sahibi.
  - [x] **E01.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [x] **E01.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [x] **E01.3** · `src/routes/login.tsx` üzerinden `src/features/auth/login-page.tsx` sayfasını aç. Resmî `login-02` bloğundan gelen `login-form.tsx` dosyasını sayfanın yanında tut. Hazır bloğun metnini, temasını ve yerleşimini çizime uyarla.
  - [x] **E01.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E01.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E01.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E01.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.

  **E01 kayıt · 13 Kasım 2026:** `src/features/auth/login-form.tsx`, resmî `@shadcn/login-02` / `aria-rhea` bloğundan shadcn 4.23.0 CLI ile alındı; kurulu Button overwrite edilmedi. Field/Input/Label/Separator, Alert/Card ve ilk MFA tüketicisi için InputOTP de resmî CLI kaynaklarıdır. Form TanStack Form + Zod, sayfa TanStack Router kullanır. Kaynak `design-reference/index.html` içindeki `a-giris`; 1440×900 ve 390×844, açık/koyu temada yerel Chromium görüntüleri `.tmp/e01-{app,reference}-<genişlik>-<tema>.png` altında karşılaştırıldı. Font ailesi, 24px/30px başlık, 36px kontrol, 8px kontrol radius'u, 22rem form, 900px yan panel breakpoint'i ve tokenlar referansa uyar. Dört durumda taşma yok; E01 klavye/validation/Axe testleri 4/4 geçti. Çizimin önizleme barı, demo hesap/parola notu ve kurgusal stüdyo markası ürün arayüzüne taşınmadı; giriş öncesi organizasyon bilinmediğinden FtkSaaS adı kullanılır. Bu demo parçalarının çıkarılması merkezlenen formun dikey konumunu etkiler. Özgün çizim JS’sinde `SHARED.authRender is not a function` gözlendi; salt okunur kaynak değiştirilmedi, uygulamada bu hata yok.

  **İşlev dilimi:** Native parola → AAL kontrolü → `account_get_v1`; tek manual PKCE callback sahibi ve allowlist next; native oturum değişiminde eski UI/cache saklanmadan route yeniden değerlendirmesi. İlk salt okunur `/account` ve TOTP `/mfa` tüketicileri E01 önkoşulu olarak bağlandı; E06/E10 tam görsel/işlev kabulü değildir. Google gerçek provider/posta callback kabulü ve P01 kimlik yönetimi açık.

  **Gerçek ortam kanıtı (T02.3/E01.5–6/P01.2):** 13 Kasım 2026, mevcut development Supabase ve `http://127.0.0.1:5173`, headless Chromium, mevcut synthetic owner fixture. İlk denemedeki CORS403 sonrasında kullanıcı Edge/Worker allowlist’ine bu origin’i mevcut kayıtları koruyarak ekledi. Yeniden denemede native parola HTTP200 → `account_get_v1` HTTP200 → `/account` → sayfa yenileme → ikinci sekmede aynı hesap → native local çıkış → iki sekmede `/login` → korumalı adrese yeniden girişin reddi geçti. Browser pageerror sıfır. Kimlik bilgisi/token kaydedilmedi; maskesiz yalnız path/status içeren yerel sonuç `.tmp/e01-hosted-result.json`. Kullanıcının ayrıca okuttuğu `test-dummy-data/test-accounts.md` içindeki sabit Pro Org. Owner ile native giriş → Edge hesap → çıkış da geçti (`.tmp/e01-pro-owner-result.json`); bu klasör salt okunur fixture kaynağıdır, cleanup çalıştırılmaz. P01.2 kapandı; rol bazlı diğer hesaplar, Google/posta/MFA ve gerçek statik yayın kabulü kendi açık maddelerinde kalır.

  **Son dilim doğrulaması:** `npm run verify` (macOS, Node 24.22.1/npm 11) geçti: 37/37 birim/bileşen testi, 9/9 Chromium testi, tip/lint/format/i18n, production build ve 3/3 politika testi. Son graph 290 modül/22 JS chunk; etkin Devtools, UI/event-bus işareti, backend/shared veya çizim import’u yok. Yerel log `.tmp/e01-final-verify.log`. Callback bootstrap/single-exchange ve public formun oturum geçişinde korunması regresyonları eklendi. Farklı modelle bağımsız son kaynak incelemesinde gerekli bulgu kalmadı; bu inceleme gerçek Google/posta sağlayıcı kabulü değildir.

  **Bundle kararı:** Kullanıcı resmî production no-op çözümünü açıkça seçti. TanStack Form’un altındaki etkin 0.4.4 yerine exact 0.5.1 npm override kullanıldı; yalnız kaynak hash'i doğrulanan `noop.js` ve root selector modülü izinli. Etkin plugin/panel/event-bus yasak; değiştirilmiş byte/sürüm ve aktif plugin olumsuz testleri 3/3 geçti. Production graph/JS denetimi etkin Devtools veya olay veri yolu bulmadı. [Resmî davranış](https://tanstack.com/devtools/latest/docs/production#event-client-in-production).

- [ ] **E02** · **Kayıt** — çizim `data-view="a-kayit"` · İşlev P01.1 · Route `/signup` · Rol/kapsam: Anonim · Hazır kaynak: signup-02; Field, Input, Checkbox, Alert · Bağ: Signup-check → native kayıt; otomatik işletme vaadi yok.
  - [ ] **E02.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E02.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E02.3** · `src/routes/signup.tsx` üzerinden `src/features/auth/signup-page.tsx` sayfasını aç. Resmî `signup-02` bloğundan gelen `signup-form.tsx` dosyasını sayfanın yanında tut. Hazır bloğun metnini, temasını ve yerleşimini çizime uyarla.
  - [ ] **E02.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E02.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E02.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E02.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
        **Kullanıcı ertelemesi · 13 Kasım 2026, 21:27, yetkilendirilmiş WhatsApp kendine mesaj kanalı:** E02 sayfası şimdilik atlanır; Pro tesliminde açık iş olarak bırakılır, en son teslimde tamamlanması yeniden istenir. Onaylı kullanım şartları/gizlilik metninin URL/kaynağı henüz yok; metin veya hukuki kabul alanı uydurulmaz. Bu sayfa tamamlandı sayılmaz. Hazır `signup-02` bloğu CLI ile incelendi, kullanılmayan üretilmiş taslak üretim kaynağına alınmadı. Pro kapanışında bu açık kullanıcı istisnası görünür tutulur.

- [ ] **E03** · **E-posta doğrulama** — çizim `data-view="a-dogrula"` · İşlev P01.1 · Route `/verify-email` · Rol/kapsam: Anonim veya kendi hesap · Hazır kaynak: Card, Alert, Button · Bağ: Doğrulama/dönüş; süreli link ve yeniden gönderim.
  - [x] **E03.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [x] **E03.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [x] **E03.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [x] **E03.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E03.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E03.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E03.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
        **E03 kayıt · 13 Kasım 2026:** `verify-email-page.tsx` ve `verification.ts`; kaynak `a-dogrula`, hazır ortak `login-02` Auth yerleşimi ile CLI’den gelen Button/Field/Input/Alert kompozisyonu. 1440×900 ve 390×844 açık/koyu dört durum `.tmp/e03-{app,reference}-<genişlik>-<tema>.png` ile karşılaştırıldı; ilgili Axe durumları sıfır ihlal. Ortak demo kabuğu/marka farkının sahibi E01 kaydıdır. Demo “bağlantıyı aç” eylemi taşınmaz. Doğrudan route açılışında gönderim olmuş varsayılmadığından açıklama nötrdür; yeniden gönderimde adres bilinmiyorsa hazır e-posta alanı kullanıcı eylemiyle açılır. Native `resend(type:signup)` yalnız açık submit ile, yapılandırılmış callback’e gider; gerçek doğrulanmış hesap gibi gösterilmez. Resend ve gerçek SDK/yerel HTTP fixture tarayıcı senaryosu geçti. Gerçek posta ve tüketilmiş/expired link kabulü açık.

- [ ] **E04** · **Parola kurtarma** — çizim `data-view="a-parola"` · İşlev P01.4 · Route `/forgot-password` · Rol/kapsam: Anonim · Hazır kaynak: Card, Field, Input, Button, Alert · Bağ: Native recovery başlatma.
  - [x] **E04.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [x] **E04.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [x] **E04.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [x] **E04.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E04.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E04.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E04.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
        **E04 kayıt · 13 Kasım 2026:** `forgot-password-page.tsx`, `password-recovery.ts`, `/forgot-password`; kaynak `a-parola`, E01’den yeniden kullanılan hazır Auth yerleşimi ve mevcut CLI Field/Input/Button/Alert. E-posta doğrulaması, hata sonrası adresin korunması ve nötr başarı mesajı bileşen testleriyle geçti. Native `resetPasswordForEmail` açık `VITE_APP_ORIGIN/auth/callback?next=/reset-password` kullanır, mevcut native oturumu zorunlu kapatmaz ve otomatik resend yapmaz. Dört viewport/tema `.tmp/e04-{app,reference}-<genişlik>-<tema>.png` ile karşılaştırıldı; Axe sıfır ihlal. Gönderim sonucu adres varlığı veya posta teslimi kanıtı gibi sunulmaz; demo link açma eylemi yoktur. Gerçek posta teslimi/dönüş kabulü P01.4’te açık.

- [ ] **E05** · **Yeni parola** — çizim `data-view="a-yeni-parola"` · İşlev P01.4 · Route `/reset-password` · Rol/kapsam: Kurtarma oturumu · Hazır kaynak: Card, Field, Input, Button, Alert · Bağ: Geçerli recovery oturumu; parola güncelleme.
  - [x] **E05.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [x] **E05.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [x] **E05.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [x] **E05.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E05.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E05.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E05.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
        **E05 kayıt · 13 Kasım 2026:** `reset-password-page.tsx`, `/reset-password`; kaynak `a-yeni-parola`, aynı hazır Auth/Field/Input/Button/Alert kompozisyonu. Dört viewport/tema `.tmp/e05-{app,reference}-<genişlik>-<tema>.png` ile karşılaştırıldı; Axe sıfır ihlal. Çizimdeki sabit 10 karakter/harf-rakam demo kuralları doğrulanmış hosted config olmadığı için üretim kuralı yapılmadı; istemci boşluk/eşleşme kontrolü, native sağlayıcı kendi parola politikasını uygular. Kurtarma UI kanıtı native `PASSWORD_RECOVERY` olayı ve SDK `getClaims` ile doğrulanmış account/session UUID’sine bağlanır; JWT kopyalanmaz. Aynı session’ın sekme odağı `SIGNED_IN` bildirimi kanıtı korur; aynı hesaptaki başka native session eski kanıtı kullanamaz. `updateUser` sonrası kurtarma oturumu korunur; hesap okuması başarısızsa “parola kaydedildi, hesap yenilenemedi” sonucu verilir, parola kör tekrar gönderilmez. Yerel gerçek SDK + sentetik HTTP tarayıcı zinciri callback’in tek tüketimini, URL temizliğini, reload/sekme dönüşünü, uyumsuz parolanın engelini, başarılı native write ve tekrar recovery route’unun kapanmasını doğruladı. Gerçek mail/recovery/password/provider kabulü P01.4’te açık; mock bu kutuyu kapatmaz. Son dilim `npm run verify` ile geçti: 15 dosyada 50 birim/bileşen, 12 Chromium ve 3 production politika testi; 303 modül/28 JS parçasında etkin Devtools yok. Bağımsız son kaynak incelemesinin zorunlu bulguları düzeltildi; aynı session odağı ve farklı session kimliği regresyonları doğrulandı. Kanıt `.tmp/auth-recovery-verify.log`; bu yerel sonuç hosted kabul değildir.

- [ ] **E06** · **İki adımlı doğrulama** — çizim `data-view="a-mfa"` · İşlev P01.5 · Route `/mfa` · Rol/kapsam: Kendi hesap · Hazır kaynak: Card, InputOTP, Field, Alert, Button · Bağ: Native TOTP; kurtarma kodu çizimi destek kanıtı bekler.
  - [x] **E06.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [x] **E06.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [x] **E06.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [x] **E06.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E06.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E06.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E06.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
        **E06 kayıt · 13 Kasım 2026:** `mfa-page.tsx`, `mfa.ts`, `/mfa`; kaynak `a-mfa`. Mevcut resmî `login-02` Auth yerleşimi ve CLI Field/Input/Button/Alert yeniden kullanıldı. Çizim tek tam genişlikli kod alanı kullandığı için InputOTP yerine kurulu hazır Input seçildi. Birden çok verified TOTP için `npx shadcn@latest add @shadcn/native-select` (aria-rhea, 4.23.0) alındı; varsayılan tek faktör dışında açık kullanıcı seçimi gerekir. Faktör gönderimde yeniden okunur; native challengeAndVerify → güncel AAL2 kontrolü → account_get → kurtarma/hesap hedefi. Yanlış kodda hesap okunmaz; doğrulama sonrası hesap ağı hatasında kod tekrarlanmaz, yalnız okuma denenir. 1440×900 ve 390×844 açık/koyu `.tmp/e06-{app,reference}-<genişlik>-<tema>.png` karşılaştırıldı, Axe/taşma sıfır. Ortak demo kabuğu/marka farkı E01 kaydındadır; desteklenmeyen “Kurtarma kodu kullan” kaldırılır, satır yüksekliği/dikey konum buna göre değişir. Resmî [TOTP rehberi](https://supabase.com/docs/guides/auth/auth-mfa/totp) ve [challengeAndVerify](https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify) incelendi. Native sağlayıcı yerine deneme limiti veya recovery-code kuralı icat edilmedi. `npm run verify`: 17 dosya/58 test, 13 Chromium, 3 politika testi; 305 modül/29 JS parçası, etkin Devtools yok (`.tmp/e06-verify.log`). Dört Auth tarayıcı zinciri gerçek SDK + yalnız loopback sentetik HTTP'dir; canlı TOTP kabulü P01.5’te E10 kurulumunu bekler. Bağımsız incelemede fixture ret şekli kanonik AUTH_REQUIRED/SafeError’a düzeltildi ve FailureEnvelope ile tiplendi; AAL1 hesap çağrısının sıfır olması assertion’ı korundu. Diğer zorunlu bulgu yok.

- [ ] **E07** · **Davet kabulü** — çizim `data-view="a-davet"` · İşlev P04.3 · Route `/invite` · Rol/kapsam: Davet edilen hesap · Hazır kaynak: Card, Alert, Button · Bağ: Fragment/token işleme; yanlış hesap ve tekrar.
  - [ ] **E07.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E07.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E07.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E07.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E07.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E07.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E07.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E08** · **Süresi dolan davet** — çizim `data-view="a-davet-bitti"` · İşlev P04.3 · Route `/invite/expired` · Rol/kapsam: Anonim veya davet edilen · Hazır kaynak: Card, Empty, Button · Bağ: Geçersiz/sona ermiş davet; yeniden davet gerçek yetkiden.
  - [ ] **E08.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E08.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E08.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E08.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E08.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E08.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E08.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E09** · **Hesap silme sonucu** — çizim `data-view="a-silindi"` · İşlev P01.8 · Route `/account/deletion` · Rol/kapsam: Kendi hesap veya işlem sonucu · Hazır kaynak: Card, Alert, Progress, Button · Bağ: Silme izin/hold/sonuç; geçmişi varsayarak silme yok.
  - [ ] **E09.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E09.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E09.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E09.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E09.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E09.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E09.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E10** · **Yönetici hesabı ve güvenlik** — çizim `data-view="hesap"` · İşlev P01.6–P01.8 · Route `/account` · Rol/kapsam: Kendi hesap · Hazır kaynak: Tabs, Avatar, Field, Input, Switch, Dialog, AlertDialog, Item · Bağ: Profil, fotoğraf, kimlik, oturum, TOTP, silme.
  - [x] **E10.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E10.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E10.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E10.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E10.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E10.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E10.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
        **E10 TOTP/güvenlik dilimi · 13 Kasım 2026:** `features/account/{security,security-panel,totp-setup,totp-remove}`; E10 `hesap`/güvenlik ve `ax-sheet` kaynakları, WF01 ve `docs/settings.md` native TOTP/session devri. Tabs, Dialog, Badge, Item, Sheet ve use-mobile resmî `npx shadcn@latest add @shadcn/<ad>` CLI’sinden (`aria-rhea`, 4.23.0) alındı; mevcut Button/Separator overwrite reddedildi. Card/Tabs/Sheet teması referanstaki 12px kart, 11rem alt menü, 900px kırılım, 26rem sağ panel, 132px QR ve header/body/footer ölçülerine uyarlandı. QR/secret yalnız açık kurulum state’indedir, kapanışta temizlenir; resmî native enroll→challengeAndVerify→güncel AAL2→hesap/faktör/geçmiş okuması bağlandı. Desteklenmeyen demo recovery-code ikinci adımı taşınmaz. Açık panel pending faktör keşfeden veya hata veren arka plan yenilemesinde korunur. Vazgeç yalnız yerel kapanıştır; native silmez. Faktör kaldırma açık seçili faktör onayıyla native unenroll yapar; sağlayıcı AAL/sahipliği uygular. Ardından refreshSession başarıyla tamamlanınca hesap/faktör/geçmiş okunur; refresh başarısızlığında niyet korunur ve retry silmeyi tekrarlamaz. Native hata/belirsizlik başarı sayılmaz ve durum yeniden okunur. Güvenlik geçmişi typed cursor okuyucusudur; fixture IP/konum veya sahte parola değişim zamanı taşınmadı.

  Yerel kanıt: `npm run verify` 21 dosya/69 birim-bileşen, 14 Chromium, 3 production politika testi geçti; 427 modül/28 JS parçasında etkin Devtools yok (`.tmp/e10-totp-verify.log`). Feature testleri 11/11; başkasının doğruladığı faktörün iptalde silinmemesi, arka plan refetch’inde panelin korunması ve deferred refresh/retry sırası bağımsız inceleme sonrası doğrulandı. Gerçek SDK + yalnız loopback HTTP tarayıcı zinciri enroll→yerel iptal→açık kaldırma→yeniden enroll→verify→okuma503→yalnız yeniden okuma→reload geçti. 1440×900/390×844 açık/koyu security ve kurulum paneli karşılaştırmaları `.tmp/e10-{security,totp-dialog}-{app,reference}-<genişlik>-<tema>.png`; taranan sekiz durumda Axe ve taşma sıfır, pageerror sıfır. QR/anahtar screenshot’ları yalnız açıkça sentetik loopback fixture’dır. **E10 görsel/kapsam kabulü tamamlanmadı:** ortak yönetici kabuğu, fotoğraf, native iletişim/Google/parola ve hesap silme sonraki uygulanacak dilimlerdir; çizimin bütünü kapatılmadı. P01.5 gerçek native provider/TOTP kabulü açık kalır; mevcut canlı fixture hesaplarında TOTP değişikliği henüz yapılmadı.

  **E10 oturum dilimi · 13 Kasım 2026:** `sessions.ts`, `sessions-panel.tsx`, `session-label.tsx`; resmî `npx shadcn@latest add @shadcn/table` (aria-rhea, 4.23.0), mevcut Card/Badge/Button/Dialog/Field/Input. Typed cursor liste, exact ProviderUuid, sürümlü nullable etiket ve açık seçili revoke bağlandı. Aynı payload’ın ağ retry’si aynı operation_key kullanır; VERSION_CONFLICT sonrası liste yeniden okunur, eski dialog kapanır ve güncel satırla yeni onay istenir. Client’ın last_refreshed_at değeri çizimin “Son etkinlik/Şu an” demosu yerine “Son yenilenme” olarak gösterilir; UA/etiket backend’den gelir. Desteklenen etiket düzenleme hazır kalem düğmesiyle açılır; mobilde ek eylem satır yüksekliğini etkiler. Kullanıcı eyleminden sonra hesap, session listesi ve güvenlik geçmişi yenilenir. current_revoked bildiriminde native local çıkış/cache temizliği/login yapılır; sonrasında protected read başlatılmaz. Mode:others uygulaması ve ek kabulü aşağıdaki taze doğrulama dilimindedir.

  Bu dilimin `npm run verify` sonucu: 24 dosya/78 test, 15 Chromium, 3 production politika testi; 535 modül/28 JS parçasında etkin Devtools yok (`.tmp/e10-sessions-verify.log`). Yeni dokuz odaklı test ve SDK/loopback tarayıcı zinciri cursor sayfasını, ProviderUuid4 korunmasını, label503/aynı key retry’sini, conflict/yeni sürüm-yeni intent’i, revoke403/aynı key retry’sini ve native current_revoked çıkışını doğruladı. Tablonun 1440×900/390×844 açık/koyu dört karşılaştırması `.tmp/e10-sessions-{app,reference}-<genişlik>-<tema>.png`; Axe/taşma ve pageerror sıfır. Referanstaki 34rem iç tablo kaydırması korunur. Tema yardımcısı iptal olabilen animation.finished promise’i yerine çalışan/pending animasyon sayısının sıfır olmasını bekler; Axe ve taşma assertion’ları değişmedi. Bağımsız incelemedeki conflict bulgusu kapandı. Gerçek ortam kabulünün tek kaydı P01.7’dir; bütün E10 ekranı kapanmadı.

  **E10 diğer oturumlar/taze doğrulama · 13 Kasım 2026:** `fresh-session.ts`, `revoke-others.tsx`; mevcut resmî Dialog/Field/Input/Button, WF01 ve hesap session devri. Parola yolu native getUser→aynı kullanıcı signInWithPassword ile yeni oturumu benimser; native session’ın exact access_token’ı `getAuthenticatorAssuranceLevel(token)` ile denetlenir. TOTP gerekirse mevcut `/mfa` akışına dönülür, query cache temizlenir. Google veya tamamlanmış native TOTP girişinden sonra “Yeni giriş yaptım” mevcut session proof’unu alır; tazelik ve aynı-session şartını backend uygular, istemci süre/config uydurmaz. Final onayından sonra mode:others gönderilir. Proof/key yalnız açık eylemin belleğindedir; belirsiz retry aynı token/key’i, expired/auth ret sonrası yeni doğrulama yeni intent’i kullanır. İptal proof’u temizler. Native girişin AAL’yi değiştirmiş olabileceği belirsiz sonuçta protected route/cache yeniden değerlendirilir. Kök callback allowlist’i genişletilmedi veya özel token storage kurulmadı. Başarı/ret sonrası hesap/session/geçmiş yeniden okunur.

  Son kaynak `npm run verify`: 26 dosya/87 test, 17 Chromium, 3 politika; 537 modül/28 JS parçasında etkin Devtools yok (`.tmp/e10-others-verify.log`). Dokuz odaklı test ve iki ek gerçek SDK/loopback browser akışı native yeni session_id’yi, bearer/proof eşleşmesini, 503 exact token/key retry’sini ve MFA’dan sonra explicit onay dönüşünü doğruladı; bağımsız incelemede zorunlu bulgu yok. `e10-others-{fresh,confirm}-app-<genişlik>-<tema>.png` dört viewport/tema boyunca incelendi; sekiz taranan durumda Axe/taşma ve iki browser akışında pageerror sıfır. Çizimdeki “Diğerlerini kapat” başlık eylemi korunur; demoda olmayan yeniden giriş/final onay UI’si backend’in taze native proof şartı için hazır Dialog kompozisyonudur. Gerçek mode:others kabulü P01.7 ek kaydındadır. TOTP/Google sağlayıcılarının kendi canlı kabulleri açık P01.3/P01.5’tedir.

  **E10 profil metin dilimi · 13 Kasım 2026:** `profile.ts`, `profile-panel.tsx`; `hesap`/profil çizimi, WF01, `settings.md` hesap kimlik devri ve kanonik Request_account_profile_update. İlk okuma account_get + management_state_get(operation=account_profile_update_v1, selector.key={}) kullanır; sürüm yalnız eşleşen `accounts` entity/versions kaydından alınır. Eksik/çapraz sürümde form açılmaz, ilk sürüm uydurulmaz. Hazır Card/Field/Input/Badge ile ad/soyad/görünen ad ve ayrı unverified_phone bağlandı; native doğrulanmış/pending iletişim salt okunur ve ayrı gösterilir. Boş opsiyonel alan null, verilmemiş photo korunur. Taslak arka plan sürüm değişiminde silinmez; conflict açık “Güncel verileri yükle” onayı ister. Belirsiz aynı payload retry’si aynı key’i korur. Başarılı yazma sonrası okuma hatasında ikinci yazma kapanır; yalnız yeniden okuma denenir. Formdaki taslak, sürüm ve veri aynı hesap key’ine bağlıdır. İletişim telefonu native doğrulanmış telefon gibi sunulmaz; K02 kapsamındaki tema uyarlamaları readonly muted görünüm, 22px success/hint Badge, kart başlık/altlık ve label hizasını çizime bağlar. Fotoğraf için resmî CLI Avatar alındı; bu dilimde fotoğraf veya görünüm tercihleri tamamlandı sayılmaz.

  `npm run verify` 28 dosya/95 test, 18 Chromium, 3 politika; 540 modül/28 JS parçasında etkin Devtools yok (`.tmp/e10-profile-verify.log`). Sekiz odaklı helper/form testi; browser zinciri yönetim sürümü, 503 aynı key retry, conflict’te taslağın korunması/açık yükleme, write200/read503 sonrası yalnız read retry ve reload’u doğruladı. Önceki sekiz Auth browser senaryosu korunarak ortak fixture/capture kaynağı `e2e/auth-fixture.ts` içine taşındı; yeni fixture başarı/ret şekilleri kanonik tiplerle bağlıdır. 1440×900/390×844 açık/koyu `.tmp/e10-profile-text-{app,reference}-<genişlik>-<tema>.png` karşılaştırıldı, Axe/taşma ve pageerror sıfır. **Bu metin formu dilimidir:** fotoğraf satırı, görünüm kartı ve ortak yönetici kabuğu eksik olduğundan bütün E10 görsel kutusu açık kalır. Bağımsız incelemede zorunlu bulgu yok. Gerçek metin yazma/geri yükleme kabulünün sahibi P01.6 alt kaydıdır.

- [ ] **E11** · **Genel bakış** — çizim `data-view="genel-bakis"` · İşlev P02, P06, P10 · Route `/o/$orgId/c/$centerId/overview` · Rol/kapsam: Yönetici/personel izinli · Hazır kaynak: Card, Badge, Item, Progress, Empty · Bağ: Özet kaynak okumaları; türetilmiş finans hesabı yok.
  - [ ] **E11.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E11.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E11.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E11.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E11.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E11.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E11.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E12** · **Stüdyo ve ekip** — çizim `data-view="studyo"` · İşlev P03, P05 · Route `/o/$orgId/c/$centerId/studio` · Rol/kapsam: Yönetici/personel izinli · Hazır kaynak: Tabs, Card, Item, Field, Select, Dialog, Sheet, Avatar · Bağ: Kaynaklar, saatler, ekip, merkez kurulum; P03/P05 ayrımı.
  - [ ] **E12.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E12.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E12.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E12.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E12.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E12.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E12.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E13** · **Üyeler** — çizim `data-view="uyeler"` · İşlev P04 · Route `/o/$orgId/c/$centerId/people` · Rol/kapsam: Kişi okuma/yazma izinli · Hazır kaynak: Card, InputGroup, Tabs, Badge, DropdownMenu, Sheet, Pagination · Bağ: Kişi listesi/oluşturma; kapsam ve cursor.
  - [ ] **E13.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E13.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E13.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E13.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E13.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E13.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E13.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E14** · **Üye profili** — çizim `data-view="uye"` · İşlev P04, P07, P08 · Route `/o/$orgId/c/$centerId/people/$personId` · Rol/kapsam: İzinli kişi kapsamı · Hazır kaynak: Tabs, Card, Avatar, Badge, Sheet, Dialog, AlertDialog · Bağ: Kişi, hak, borç, geçmiş; işlemler ayrı P dilimleri.
  - [ ] **E14.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E14.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E14.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E14.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E14.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E14.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E14.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E15** · **Davetler ve hesaplar** — çizim `data-view="uye-hesaplar"` · İşlev P04.3 · Route `/o/$orgId/c/$centerId/access` · Rol/kapsam: Davet yönetimi izinli · Hazır kaynak: Tabs, Card, Badge, Input, Sheet, AlertDialog · Bağ: Davet gönder/iptal; süre ve yeniden gönderim API'den.
  - [ ] **E15.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E15.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E15.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E15.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E15.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E15.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E15.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E16** · **Kişileri birleştir** — çizim `data-view="uye-birlestir"` · İşlev P04.4 · Route `/o/$orgId/c/$centerId/people/merge` · Rol/kapsam: Birleştirme izinli · Hazır kaynak: Card, Combobox, Alert, Dialog, Button · Bağ: Önizleme → yetkili onay → uygulama → okuma.
  - [ ] **E16.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E16.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E16.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E16.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E16.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E16.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E16.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E17** · **Ders programı** — çizim `data-view="program"` · İşlev P06 · Route `/o/$orgId/c/$centerId/schedule` · Rol/kapsam: Program izinli · Hazır kaynak: Hazır scheduler K02; Tabs, Select, Sheet, DatePicker, AlertDialog · Bağ: Program/tekrar/çakışma/iptal; frontend karar motoru yok.
  - [ ] **E17.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E17.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E17.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E17.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E17.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E17.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E17.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E18** · **Seans detayı** — çizim `data-view="seans"` · İşlev P06, P09, P10 · Route `/o/$orgId/c/$centerId/sessions/$sessionId` · Rol/kapsam: Seans/katılım izinli · Hazır kaynak: Tabs, Card, Badge, Checkbox, Select, Sheet, Dialog, AlertDialog · Bağ: Rezervasyon, bekleme/teklif, yoklama; ayrı yetkiler.
  - [ ] **E18.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E18.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E18.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E18.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E18.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E18.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E18.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E19** · **Paketler** — çizim `data-view="paketler"` · İşlev P07 · Route `/o/$orgId/c/$centerId/products` · Rol/kapsam: Ürün/satış izinli · Hazır kaynak: Tabs, Card, Field, Select, Switch, Sheet, Dialog · Bağ: Ürün/satış/dondurma/değişim; gerçek önizleme tutarı.
  - [ ] **E19.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E19.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E19.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E19.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E19.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E19.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E19.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E20** · **Finans** — çizim `data-view="finans"` · İşlev P08 · Route `/o/$orgId/c/$centerId/finance` · Rol/kapsam: Finans izinli · Hazır kaynak: Card, Tabs, DatePicker, Table, Sheet, Dialog, AlertDialog · Bağ: Tahsilat/kısmi/iade; kaynak hareketi ve izinli dışa aktarım.
  - [ ] **E20.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E20.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E20.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E20.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E20.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E20.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E20.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E21** · **Özel ders talepleri** — çizim `data-view="talepler"` · İşlev P06.5 · Route `/o/$orgId/c/$centerId/requests` · Rol/kapsam: Talep çözümleme izinli · Hazır kaynak: Tabs, Card, Badge, Sheet, DatePicker, Dialog · Bağ: Özel ders onay/ret/alternatif.
  - [ ] **E21.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E21.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E21.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E21.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E21.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E21.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E21.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E22** · **Belgeler** — çizim `data-view="belgeler"` · İşlev P15 · Route `/o/$orgId/c/$centerId/documents` · Rol/kapsam: Belge yönetimi izinli · Hazır kaynak: Tabs, Card, Badge, Field, Textarea, Sheet, Dialog, ScrollArea · Bağ: Yetkili sürümlü içerik/kaynak; açık onay bağlamı.
  - [ ] **E22.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E22.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E22.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E22.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E22.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E22.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E22.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E23** · **Eğitmen anlaşmaları ve hakediş** — çizim `data-view="hakedis"` · İşlev P05, P10 · Route `/o/$orgId/c/$centerId/earnings` · Rol/kapsam: Anlaşma/hakediş izinli · Hazır kaynak: Tabs, Card, Select, DatePicker, Table, Sheet, Dialog · Bağ: Anlaşma önce; hakediş/yoklama/ödeme sonra.
  - [ ] **E23.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E23.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E23.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E23.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E23.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E23.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E23.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E24** · **Eğitmen bugünü** — çizim `data-view="egt-bugun"` · İşlev P11.2 · Route `/instructor/today` · Rol/kapsam: İlişkili eğitmen · Hazır kaynak: Card, Badge, Item, Button · Bağ: Atanan ders günü; merkez ilişkisi global rol değildir.
  - [ ] **E24.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E24.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E24.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E24.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E24.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E24.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E24.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E25** · **Eğitmen programı** — çizim `data-view="egt-program"` · İşlev P11.2 · Route `/instructor/schedule` · Rol/kapsam: İlişkili eğitmen · Hazır kaynak: Hazır scheduler K02; Tabs, Select, Card · Bağ: Yalnız atanan program; yönetici sürükleme yetkisi taşınmaz.
  - [ ] **E25.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E25.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E25.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E25.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E25.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E25.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E25.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E26** · **Eğitmen seans/yoklama** — çizim `data-view="egt-seans"` · İşlev P10, P11.2 · Route `/instructor/sessions/$sessionId` · Rol/kapsam: Atanan eğitmen/katılım izinli · Hazır kaynak: Card, Badge, Checkbox, Select, AlertDialog · Bağ: Taslak/yoklama kapama; izinli düzeltme ayrı.
  - [ ] **E26.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E26.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E26.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E26.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E26.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E26.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E26.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E27** · **Eğitmenin kendi hakedişi** — çizim `data-view="egt-hakedis"` · İşlev P10, P11.2 · Route `/instructor/earnings` · Rol/kapsam: Kendi hakedişini okuma izinli · Hazır kaynak: Card, Tabs, DatePicker, Table, Sheet · Bağ: Kendi anlaşma/ödeme; yönetici finans yetkisi yok.
  - [ ] **E27.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E27.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E27.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E27.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E27.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E27.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E27.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E28** · **Öğrenci dersleri** — çizim `data-view="m-dersler"` · İşlev P09, P11.1 · Route `/member/classes` · Rol/kapsam: Kendi öğrencilik kapsamı · Hazır kaynak: Tabs, Card, Badge, Select, Sheet, DatePicker · Bağ: Self ders/rezervasyon; borç/hak kontrolleri backend'de.
  - [ ] **E28.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E28.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E28.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E28.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E28.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E28.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E28.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E29** · **Öğrenci rezervasyonları** — çizim `data-view="m-rez"` · İşlev P09, P11.1 · Route `/member/reservations` · Rol/kapsam: Kendi öğrencilik kapsamı · Hazır kaynak: Tabs, Card, Badge, AlertDialog · Bağ: İptal, bekleme ve teklif sonuçları.
  - [ ] **E29.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E29.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E29.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E29.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E29.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E29.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E29.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E30** · **Öğrenci hakları** — çizim `data-view="m-haklarim"` · İşlev P07, P08, P11.1 · Route `/member/entitlements` · Rol/kapsam: Kendi öğrencilik kapsamı · Hazır kaynak: Tabs, Card, Badge, Progress, Item · Bağ: Hak/geçerlilik/borç; tutarlar gerçek okuma.
  - [ ] **E30.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E30.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E30.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E30.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E30.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E30.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E30.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E31** · **Öğrenci özel ders talebi** — çizim `data-view="m-ozel"` · İşlev P06.5, P11.1 · Route `/member/private-lessons` · Rol/kapsam: Kendi öğrencilik kapsamı · Hazır kaynak: Card, Field, Combobox, DatePicker, Sheet, AlertDialog · Bağ: Talep/geri çekme/alternatifi kabul.
  - [ ] **E31.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E31.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E31.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E31.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E31.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E31.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E31.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E32** · **Öğrenci hesabı** — çizim `data-view="m-hesap"` · İşlev P01, P11.1, P15 · Route `/member/account` · Rol/kapsam: Kendi hesap · Hazır kaynak: Tabs, Avatar, Field, Switch, Dialog, AlertDialog, ScrollArea · Bağ: Hesap/tercih/onay/ICS; ortak P01 işlemlerini yeniden yazma.
  - [ ] **E32.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E32.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E32.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E32.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E32.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E32.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E32.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E33** · **Adaylar ve takip** — çizim `data-view="adaylar"` · İşlev P12 · Route `/o/$orgId/c/$centerId/leads` · Rol/kapsam: CRM izinli · Hazır kaynak: Hazır Kanban K03; Card, Tabs, Badge, Sheet, Combobox, DatePicker · Bağ: Aday/aşama/not/takip/deneme; durum değişimi API'den.
  - [ ] **E33.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E33.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E33.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E33.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E33.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E33.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E33.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E34** · **Public takvim** — çizim `data-view="p-takvim"` · İşlev P12.5 · Route `/public/$slug/calendar` · Rol/kapsam: Anonim · Hazır kaynak: Card, Tabs, Select, DatePicker, Sheet · Bağ: Public izinli DTO; kimlikli endpoint'e anonim fallback yok.
  - [ ] **E34.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E34.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E34.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E34.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E34.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E34.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E34.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E35** · **Public başvuru** — çizim `data-view="p-basvuru"` · İşlev P12.5 · Route `/public/$slug/apply` · Rol/kapsam: Anonim · Hazır kaynak: Card, Field, Input, Checkbox, Alert; resmi Turnstile widget · Bağ: Yayımlı hedef, explicit izin, client_request_key/replay.
  - [ ] **E35.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E35.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E35.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E35.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E35.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E35.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E35.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E36** · **Public yayın kapalı** — çizim `data-view="p-kapali"` · İşlev P12.5 · Route `/public/$slug/unavailable` · Rol/kapsam: Anonim · Hazır kaynak: Card, Empty, Button · Bağ: Kapalı/geçersiz yayın; özel veri yok.
  - [ ] **E36.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E36.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E36.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E36.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E36.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E36.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E36.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E37** · **Etkinlik listesi** — çizim `data-view="etkinlikler"` · İşlev P13 · Route `/o/$orgId/c/$centerId/events` · Rol/kapsam: Etkinlik izinli · Hazır kaynak: Tabs, Card, Badge, Sheet, Field, DatePicker · Bağ: Etkinlik yaşam döngüsü; Starter'da kapalı.
  - [ ] **E37.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E37.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E37.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E37.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E37.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E37.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E37.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E38** · **Etkinlik detayı** — çizim `data-view="etkinlik"` · İşlev P13 · Route `/o/$orgId/c/$centerId/events/$eventId` · Rol/kapsam: Etkinlik/finans/katılım izinli · Hazır kaynak: Tabs, Card, Badge, Sheet, Dialog, AlertDialog · Bağ: Kayıt/manuel ödeme/katılım/iptal; kart ödeme ekleme.
  - [ ] **E38.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E38.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E38.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E38.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E38.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E38.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E38.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E39** · **Gelen kutusu** — çizim `data-view="gelen-kutusu"` · İşlev P14 · Route `/inbox` · Rol/kapsam: Kendi bildirim kapsamı · Hazır kaynak: Tabs, Card, Item, Badge, DropdownMenu · Bağ: Bildirim/okundu; kaynak işleme yetkili derin bağlantı.
  - [ ] **E39.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E39.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E39.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E39.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E39.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E39.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E39.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E40** · **Otomasyon** — çizim `data-view="otomasyon"` · İşlev P14.4 · Route `/o/$orgId/c/$centerId/automation` · Rol/kapsam: CRM/ayar izinli · Hazır kaynak: Tabs, Card, Field, Select, Switch, Sheet, Alert · Bağ: Kural/hatırlatma/teslim; Cron backend'de.
  - [ ] **E40.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E40.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E40.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E40.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E40.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E40.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E40.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E41** · **Raporlar ve import** — çizim `data-view="raporlar"` · İşlev P16 · Route `/o/$orgId/c/$centerId/reports` · Rol/kapsam: Rapor/import izinli · Hazır kaynak: Tabs, Card, Chart, DatePicker, Select, Table, Progress, Sheet · Bağ: Yetkili rapor/CSV/import önizleme+sonuç; dosya boyutu API'den.
  - [ ] **E41.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E41.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E41.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E41.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E41.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E41.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E41.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E42** · **Ayarlar ve abonelik** — çizim `data-view="ayarlar"` · İşlev P17 · Route `/o/$orgId/c/$centerId/settings` · Rol/kapsam: Etkin scope ayar/abonelik izinli · Hazır kaynak: Tabs, Card, Field, Switch, Select, Sheet, Dialog, AlertDialog · Bağ: Ayar şekli/scope/değişim/plan/yaşam döngüsü.
  - [ ] **E42.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E42.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E42.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E42.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E42.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E42.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E42.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E43** · **Denetim ve işlem durumu** — çizim `data-view="denetim"` · İşlev P02, P14, P16, P17 · Route `/o/$orgId/c/$centerId/audit` · Rol/kapsam: Yönetim inceleme izinli · Hazır kaynak: Tabs, Card, Badge, DatePicker, Table, Sheet · Bağ: Denetim ve işlem durumu; kaynak yetki korunur.
  - [ ] **E43.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E43.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E43.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E43.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E43.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E43.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E43.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E44** · **Yardım** — çizim `data-view="yardim"` · İşlev T02, P02 · Route `/help` · Rol/kapsam: Oturumlu kullanıcı · Hazır kaynak: Card, Accordion, Input, Item, Button · Bağ: Yardım içeriği; çalışmayan sahte destek gönderimi yok.
  - [ ] **E44.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E44.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E44.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E44.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E44.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E44.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E44.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E45** · **Ortak durum görünümü** — çizim `data-view="durum"` · İşlev İlk ilgili sayfa · Route `Ortak route durum bileşimi` · Rol/kapsam: Geçerli sayfanın kapsamı · Hazır kaynak: Empty, Alert, Skeleton, Spinner, Button · Bağ: Loading/empty/error/forbidden/not-found/offline.
  - [ ] **E45.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E45.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E45.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E45.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E45.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E45.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E45.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.
- [ ] **E46** · **Durum örnekleri** — çizim `data-view="durumlar"` · İşlev İlk ilgili sayfa · Route `Yalnız yerel geliştirme örnekleri` · Rol/kapsam: Üretimde ayrı menü yok · Hazır kaynak: Empty, Alert, Skeleton, Spinner, Card, Button · Bağ: Durum kataloğu; ürün sayfası veya sahte canlı veri sayılmaz.
  - [ ] **E46.1** · Bu taramadaki sayfa satırını esas al; yalnız aktif çizim bölümü ve ilgili WF/işlem sözleşmesini aç. Kaynak değişmişse etkilenen eşlemeyi güncelle, ürün geneli taramayı tekrarlama.
  - [ ] **E46.2** · Yukarıda eşlenen hazır kaynakları mevcut proje envanteriyle karşılaştır. Eksik olanın resmi registry/CLI kaynağını, sürümünü ve React Aria/Rhea uyumunu doğrula; kurulu bileşeni yeniden üretme. K02/K03 varsa seçim ölçütünü uygula.
  - [ ] **E46.3** · Seçilen hazır kaynaklarla sayfanın görsel kompozisyonunu oluştur. Metin, tema, ikon ve yerleşimi çizime göre uygula. Elle UI bileşeni yazma.
  - [ ] **E46.4** · Aynı viewport, tema ve durumdaki çizimle tarayıcı karşılaştırması yap. Açıklanmamış görsel farkları düzelt, karşılaştırma sonucunu kaydet.
  - [ ] **E46.5** · Sayfanın gerçek işlevlerini ilgili P alt maddelerine göre tek tek bağla. Her işlemde yetkili okuma → kullanıcı eylemi → sonucu yeniden okuma yolunu tamamla. Birden çok işlemde ayrı alt kutular kullan.
  - [ ] **E46.6** · Bağlanan işlemler için ilgili başarı/ret/hata-kurtarma senaryosunu ve klavye/mobil davranışını doğrula. Gerçek ortam gerektiren açık kontrolleri kendi işlev maddesine bağla.
  - [ ] **E46.7** · Kaynak, test ve görsel kanıtı kaydet. Bu sayfadaki bütün uygulanabilir işlemler ve izinli farklar doğrulanınca üst kutuyu kapat, devam kaydını güncelle.

Çizimdeki `taslak` bölümü gezinme prototipinin yer tutucusudur. E45/E46 durum çalışmasında ele alınır. Business’ın ek ekranları ve Starter erişim farkları ilgili S/B paketinde bu envantere bağlanır. Çizimde karşılığı bulunmayan ek ekranın kapsamı ve hazır blok/bileşen eşlemesi geliştirme öncesinde kaydedilir.

<a id="baslangic"></a>

## Başlangıç

### T01 · Mevcut temeli çalıştır

| Önkoşul | Sözleşme  | Doğrulama                       |
| ------- | --------- | ------------------------------- |
| —       | Başlangıç | Yerel kurulum ve kalite çıktısı |

- [x] **T01.1** · README’ye göre Node/npm ve uygulamaya özel cache/geçici dizinlerle temiz kurulum yap. `npm ci --ignore-scripts` yalnız uygulamanın kilit dosyasını kullanarak tamamlanır.
- [x] **T01.2** · Playwright tarayıcısını kur ve `npm run verify` çalıştır. Kaynak SHA’sı ile sonucu kaydet. Hata varsa ilk başarısız komutu ve nedenini işaretle.
- [x] **T01.3** · Uygulamanın build çıktısını önizle. İlk ekran tarayıcıdan açılır ve yenilemede tekrar yüklenir.

**Başlangıç doğrulaması** · 13 Kasım 2026, Linux, Node 24.22.1 / npm 11.9.0. Taban `91af14abc2584af9977fe64e40e5e01e9fbeaa2a` ve bu hazırlık düzeltmeleriyle temiz kurulum, tam `npm run verify` (10 birim, 4 Playwright testi, production build) ve build önizlemesinde açılış/yenileme geçti. Dört özgün referans byte düzeyinde eşleşti. Ayrı yerel portta 47 çizim görünümü açıldı. Bu ortamda Playwright'ın kilitlediği Chrome for Testing 158.0.8127.18 headless shell resmi Google dağıtımından alındı. MSW testleri Node ortam proxy'si kapalı çalıştırıldı. Yeni VS Code checkout'unda uygulama README'sine göre yerel kurulumu yap, ardından devam kaydındaki ilk işten ilerle.

### T02 · Tamamlanan ürün taramasının uygulama hazırlığı

| Önkoşul                                | Kaynak                                                   | Doğrulama                                     |
| -------------------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| Taramada kaynak okundu; uygulamada T01 | Aşağıdaki tarama kaydı, ürün sözleşmesi, WF/API haritası | Yalnız sürüm farkı ve aktif tüketici denetimi |

- [x] **T02.1** · Ürün kapsamı F01–F33, 46 ekran, P01–P17 ve Starter/Business farkları önden eşlendi. Kanıt: bu dosyanın tarama kaydı ve E satırları; başlangıç kaynak SHA’sı `1249532c0abe8d340b268b3d5dff33a547fea9e5`. Bu iş kaynak incelemesidir; canlı kabul değildir.
- [x] **T02.2** · Mevcut `src/lib/supabase.ts` istemcisini kullan. Ortak Edge/Worker taşıma kodunu `src/lib/` içinde tut ve makine kaynağından gelen tipleri bağımsız build'e bağla. `@ftksaas/api-contracts` private pakettir, workspace bağımlılıkları vardır; dış klasöre `file:/link:/workspace:` bağlantı ekleme. Kanonik üretilmiş `src` dosyalarının gereken bütün göreli bağımlılıklarını uygulama içi üretilmiş snapshot olarak kaynak SHA/hash iziyle taşı; elle DTO türetme. Import kapanışını ve üretim bundle’ında private/server kodu bulunmadığını doğrula. Güncelleme yalnız kanonik üretimden yapılır; snapshot ikinci sözleşme sahibi değildir.
      **T02.2 kanıtı · 13 Kasım 2026:** Taban `89fec00ac9d289073efc99a33741f59e563cc389`; aynı SHA [Main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/43475477455) başarılı. macOS yerel npm: `src/lib/backend.ts`, `public-gateway.ts`, `account.ts` ve native PKCE istemcisi hazır. `npm test -- src/lib/` 10/10, strict typecheck/lint ve production build geçti. HTTP200 SafeError, bozuk/non-JSON/non-2xx yanıt, oturumsuz istek ve anonim Worker payload/credentials sınırı test edildi. MSW 3 handler Request metadata’sı credentials değerini yeniden kurduğu için omit assertion’ı gerçek fetch sınırında korunur. `node scripts/snapshot-api-contracts.mjs --check` dört kanonik dosyanın byte/hash ve yerel import kapanışını doğruladı; kaynak SHA/schema hash `src/lib/api-contracts/manifest.json` içinde. Yalnız byte korunan snapshot format dışıdır, lint ve strict tip denetimi açıktır. Bundle kontrolü backend/web/shared workspace ve özgün çizim import’unu reddeder. Public değerler hazır `.artifacts/spa-client/integration.env.example` içinden yalnız izinli VITE anahtarları seçilerek Git dışı yerel env’ye alındı; hosted hesap/Google/posta kabulü değildir.

- [ ] **T02.3** · Rol bazlı test hesaplarının erişimini, güncel public env değerlerini ve gerçek build/yayın ortamını doğrula. Uygulama altındaki CI şablonları etkin workflow değildir. Dış kapsam değişikliği gerekiyorsa ihtiyacı kaydet; bu görev kök CI, backend, DNS veya production dağıtım yetkisi vermez. Yerel önizleme ve izinli development kabulüyle bağımsız sayfalara devam et.

### T03 · Salt okunur tasarım referansını kullanıma hazırla

- [x] **T03.1** · Özgün HTML/CSS/JS ve arşiv tarandı, 47 `data-view` içinden 46 ekran eşlendi; `taslak` ürün ekranı sayılmadı. Dört dosyanın arşiv içeriğiyle birebir eşitliği doğrulandı. Hazır kaynak adayları bütün E satırlarına işlendi. Kaynak kimlikleri ve SHA-256 değerleri [referans kaydında](../design-reference/README.md).
- [x] **T03.2** · Uygulamaya başlamadan referans hash'lerini doğrula. Referansı yalnız yerel HTTP önizlemesiyle ayrı portta aç; `src`/`public` altına taşıma veya bundle'a import etme. Kaynak dosyalarını biçimlendirme/yeniden yazma. Referans demo JS’si test backend'i değildir.
- [ ] **T03.3** · Aktif sayfada kullanılan token, tipografi ve durumları hazır tema/bileşenlere uygula. Ortak ilk ihtiyaçta kabuk K01'i kur. E01’de `login-02` ile başla; tüm ürünü yeniden tasarlama veya bütün bileşenleri peşinen kurma.

<a id="pro"></a>

## Pro geliştirmesi

Paket numaraları sabittir. Sayfa uygulama sırası E envanterindeki ilk uygun sayfayı izler. İlk Auth sayfası P01.2/P01.3 kapsamındaki giriştir, ardından P01.1 kayıt akışına geçilir. P15.1’i ilk belge gerektiren işlemden önce ele al. P15.2–P15.4’ü ilgili tüketiciyle birlikte doğrula. P17.1’deki ayarları da ilk kullanıldıkları pakette bağla.

### P01 · Kimlik, hesap ve güvenlik

| Önkoşul                                | Sözleşme                                                                              | Doğrulama                     |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------- |
| T02.2 · ekran için ilgili T03 eşlemesi | F04, F06 · [WF01](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf01) | Native Auth ve hesap akışları |

- [ ] **P01.1** · E-posta ile kayıtta sözleşmedeki ön kontrolü ve native doğrulama dönüşünü bağla. Yeni doğrulanmış hesap giriş yapabilir, bağlı merkez ve rolü backend’den okunur.
- [x] **P01.2** · Parolalı giriş, çıkış ve korumalı sayfayı yenileme akışını tamamla. Çıkıştan sonra aynı adresi açan kullanıcı giriş ekranına ulaşır.
- [ ] **P01.3** · Google giriş/dönüşünü ve mevcut hesapta kimlik bağlama/kaldırmayı tamamla. Kullanıcı kendi hesabına döner ve kalan giriş yöntemleri güncel okunur.
- [ ] **P01.4** · Parola kurtarma ve hesap içi parola değişikliğini tamamla. Geçerli bağlantıyla yeni parola kullanılabilir, tüketilmiş bağlantı anlaşılır hata verir.
- [ ] **P01.5** · TOTP kurulumunu, native doğrulamayı ve korumalı hedefe dönüşü tamamla. Yanlış kodda hedef kapalı kalır, doğru koddan sonra erişim yeniden okunur.
- [ ] **P01.6** · Profil, iletişim bilgisi ve fotoğrafı güncelle. Yenileme sonrasında kayıtlı değer ve sağlayıcının bekleyen/doğrulanmış iletişim durumu doğru görünür.
  - [x] Profil ad/soyad/görünen ad: mevcut Pro öğrenci synthetic fixture, gerçek development Auth/Edge, headless Chromium ve local5173. account_get + management_state_get HTTP200 → doğru sürümlü profile_update HTTP200 → yeniden okuma → reload’da üç metin alanının korunması geçti. Telefon başlangıç değeri korundu, e-posta readonly kaldı; e-posta/telefon sağlayıcı değişimi yapılmadı. Metinler ardından başlangıç değerlerine aynı UI akışıyla döndürüldü ve reload’da eşitlik doğrulandı; test native local çıkışla temizlendi. Pageerror sıfır. Profil sürümü/audit kayıtları geri sarılmadı; reset/seed/SQL yok. Rol/adım/HTTP status ve restored:true dışında değer/kimlik bilgisi kaydetmeyen kanıt `.tmp/e10-profile-hosted-result.json`.
  - [ ] İletişim telefonu ve native güncel/pending iletişim değişimi/sağlayıcı kabulü.
  - [ ] Özel fotoğraf seçimi/kaldırma, authenticated byte okuması ve gerçek ortam kabulü.
- [x] **P01.7** · Oturum listesinden izinli oturumu kapat ve güvenlik geçmişini oku. Kapatılan oturumun önceki erişimi sona erer.
      **P01.7 gerçek development kabulü · 13 Kasım 2026:** `test-dummy-data/test-accounts.md` sabit Pro Org. Owner; yerel `http://127.0.0.1:5173`, gerçek native Auth/Edge, iki bağımsız headless Chromium context’i. Bu run’ın A/B oturumları native giriş ve typed session listesini HTTP200 okudu. Yalnız B’nin kendi current satırına benzersiz geçici etiket yazıldı ve yeniden okundu; A bu etiketle yalnız sahip olunan B oturumunu seçip HTTP200 kapattı. A güncel current olarak kaldı; B’nin reload/protected account_get isteği HTTP401 ve `/login` verdi. A’nın gerçek güvenlik geçmişi HTTP200’de session_revoked olayını gösterdi. Pageerror sıfır; A native local çıkışla, B seçili revoke ile temizlendi; bu kabul dışında kalan mevcut session’lara dokunulmadı. Veri/reset/seed/cleanup SQL yok. Kimlik bilgisi/token/UA/kişisel içerik kaydı veya canlı ekran görüntüsü yok; yalnız rol, adım ve işlem HTTP status sonucu `.tmp/e10-sessions-hosted-result.json`. Uygulanan frontend zinciri E10 oturum kaydındadır.
      **P01.7 mode:others ek kabulü · 13 Kasım 2026:** `accounts.json` içindeki aktif Pro öğrenci fixture’ında, ilk yeni A native girişinden sonra listede yalnız A olduğunu ve cursor devamı bulunmadığını doğruladım. Ayrı B context’i açıldığında yalnız A/B vardı; ikisinin kendi current satırına bu run’a özgü geçici etiketler kondu. UI parola doğrulaması yeni C native session’ını benimsedi. Final onayı öncesinde tüm liste yalnız etiketli A/B ve current C’den oluşuyordu; başka session/cursor olsaydı mode:others çalıştırılmayacaktı. Gerçek Edge others HTTP200 ile yalnız C kaldı; B reload/account_get HTTP401→login verdi, C’nin güvenlik geçmişi “other_sessions_revoked” olayını HTTP200 okudu. C native local çıkışla temizlendi; eski A/B domain komutuyla kapandı. Pageerror sıfır; reset/seed/SQL veya mevcut başkaca session’a işlem yok. Kimlik bilgisi/proof/UUID/UA kaydetmeyen rol/adım/status kanıtı `.tmp/e10-others-hosted-result.json`.
- [ ] **P01.8** · Hesap silme önizlemesinde engeli veya izinli sonucu göster. İzinli test hesabında açık onay sonrası durum takibi doğru hesaba açılır.

### P02 · Rol, organizasyon ve gezinme

| Önkoşul         | Sözleşme                                                                                                                                                                    | Doğrulama                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| P01 giriş akışı | F04, F06, F32, F33 · [WF00](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf00), [WF02](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf02) | Ayrı hesaplar ve tarayıcı bağlamları |

- [ ] **P02.1** · Yönetici ve öğrenci kabuklarını güncel rol/kapsamdan aç. Eğitmen için atandığı derslere erişim, öğrenci için kendi kayıtları görünür.
- [ ] **P02.2** · Çok rollü kullanıcı rol veya organizasyon değiştirdiğinde menü, açık kayıt ve sorgu önbelleği yeni kapsama geçer. Geri tuşu eski veriyi göstermez.
- [ ] **P02.3** · Doğrudan URL, oturum kaybı ve izin kaybını dene. Yetkisiz okuma/yazma reddedilir, arayüz kullanıcıyı erişilebilir hedefe taşır.

### P03 · Tek merkez kurulumu, kaynak ve ekip

| Önkoşul | Sözleşme                                                                                                                                                                                                                                                | Doğrulama                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| P02     | F01, F02, F05, F13 · [WF02](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf02), [WF03](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf03), [WF12](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf12) | Yönetici ve sınırlı personel oturumları |

- [ ] **P03.1** · Organizasyon ve ilk merkez kurulumunu tamamla. Yeniden girişte merkez doğru kapsamda açılır, Pro hesap ikinci aktif merkez açamaz.
- [ ] **P03.2** · Birden çok oda ve disiplin tanımla. Güncel seçim listelerinde gerçek kaynaklar ve tanımlı kapasite görünür.
- [ ] **P03.3** · Çalışma saati, izin ve uygunluğu kaydet. İlgili takvim seçicisinde kullanılabilir aralıklar backend sonucuna uyar.
- [ ] **P03.4** · Eğitmen ilişkisini merkezde oluştur ve kaldır. Güncel görevlendirme seçicisi değişir, başka merkezin ilişkisi etkilenmez.
- [ ] **P03.5** · Operasyon personeline belirli bir izin ver, sonra kaldır. Personel oturumunda izinli işlem çalışır ve geri alındığında reddedilir.

### P04 · Kişi, öğrencilik ve davet

| Önkoşul        | Sözleşme                                                                                                                                                          | Doğrulama                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| P03 ilk merkez | F04, F07 · [WF02](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf02), [WF04](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf04) | Kişi detayı, ilişki ve finans/hak geçmişi okumaları |

- [ ] **P04.1** · Kişi oluştur ve detayını düzenle. İletişim bilgisinin kaydı ile öğrencilik ilişkisinin açılması ayrı sonuçlar olarak görünür.
- [ ] **P04.2** · Öğrenciliği etkinleştir, disipline bağla ve izin verilen koşulda gerekçeyle pasifleştir. Liste filtresi ve detay aynı durumu gösterir.
- [ ] **P04.3** · Doğru hesaba daveti kabul ettir. Yeniden açıldığında ikinci bağ oluşmaz, yanlış hesapla kabul reddedilir.
- [ ] **P04.4** · İzinli kişi birleştirmesini önizleyip uygula. Ortaya çıkan tek kişi üzerinden eski hak ve borçlar aynı tutarla okunur.

### P05 · Eğitmen anlaşması ve görevlendirme

| Önkoşul  | Sözleşme                                                                                                                                                          | Doğrulama                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| P03, P04 | F13, F20 · [WF03](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf03), [WF14](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf14) | Anlaşma sürümü ve program önizlemesi |

- [ ] **P05.1** · Eğitmen, disiplin, yürürlük ve ücret şartlarını seçip anlaşmayı yayımla. Güncel listede yayımlanan sürüm ve tarihler okunur.
- [ ] **P05.2** · Anlaşmayı yeni sürümle değiştir. Eski şartlar geçmişte korunur, geçerli sürüm yeni program önizlemesine yansır.
- [ ] **P05.3** · Özne eğitmen yayımlı dijital metni görüp açıkça onaylar. Kaynak eksikken belge onayı oluşmaz, finansal şartlar sözleşmenin izin verdiği ölçüde okunur.
- [ ] **P05.4** · Ücretli görevlendirmeyi geçersiz veya eksik anlaşmayla dene. Ret nedenini göster, geçerli anlaşmayla yeni önizleme al.

### P06 · Program, takvim ve özel ders

| Önkoşul                  | Sözleşme                                                                                                                                                                              | Doğrulama                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| P03, ücretli atamada P05 | F02, F08, F09, F10, F13, F14 · [WF03](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf03), [WF06](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf06) | Takvimde seans, kaynak, saat ve durum okumaları |

- [ ] **P06.1** · Tekrarlayan grup programını önizle ve yayımla. Tekrar tarihleri, oda, disiplin ve atanan eğitmen takvimde doğru görünür.
- [ ] **P06.2** · Aynı oda veya eğitmene çakışan seans açmayı dene. Reddedilen işlem takvime ikinci seans eklemez.
- [ ] **P06.3** · Eğitmen veya seans zamanı değiştiğinde yeni önizlemeyi uygula. İlgili oluşumlarda doğru yerel saat ve görevlendirme görünür.
- [ ] **P06.4** · Seansı iptal et veya ertele ve gerektiğinde telafi seansını oluştur. Eski durum ve bağlı telafi birlikte okunur.
- [ ] **P06.5** · Öğrenciden özel ders talebi gönder. Yetkili kullanıcı onay, ret veya alternatif saat verdiğinde öğrenci güncel sonucu görür.

### P15 · Sürümlü belge ve açık onay

| Önkoşul                                           | Sözleşme                                                                              | Doğrulama                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| P02 · ilk satış, rezervasyon veya katılım bağlamı | F30, F33 · [WF11](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf11) | Gerçek sürüm, kişi, işlem ve geçmiş kaydı |

- [ ] **P15.1** · Yetkili kullanıcı belge kaynağını hazırlar, etkiyi önizler ve sürümü yayımlar. Yeni sürüm yetkili listeden geri okunur.
- [ ] **P15.2** · İlk tüketici akışında gerekli metin veya özel dosyayı güncel işlem bağlamında aç. İlgili kişi açıkça kabul edince aynı bağlamda kişi ve sürümle eşleşen onay görünür.
- [ ] **P15.3** · Eski sürüm, yabancı kişi ve eksik onayı dene. Yetkisiz dosya okunamaz, zorunlu onay eksikken ilgili yeni işlem ilerlemez. Mevcut rezervasyon sözleşmedeki korumayı sürdürür.
- [ ] **P15.4** · Sonraki satış, rezervasyon ve katılım tüketicilerinde ilgili gereksinim okumasını bağla. Kayıt geçmişi yetkili kullanıcıya gösterilir.

### P07 · Ürün, satış ve paket hakları

| Önkoşul                                                | Sözleşme                                                                                        | Doğrulama                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| P04 · program bağlantısı için P06 · gereken onayda P15 | F15, F16, F17, F19 · [WF05](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf05) | Satış, hak ve finans okumaları |

- [ ] **P07.1** · Ders sayılı ve süreli/sınırsız ürünü yayımla. Satış seçicisinde doğru ürün sürümü, kapsam ve geçerlilik görünür.
- [ ] **P07.2** · Yetkili kullanıcı indirimli satışın bedel, hak ve borç etkisini önizleyip uygular. Öğrencinin satış, hak ve finans kayıtları önizlemeyle eşleşir.
- [ ] **P07.3** · Sabit grup kaydını uygun ürün ve programla tamamla. Hak ve kesin rezervasyonlar güncel okumalarda sözleşmedeki etkiyi gösterir.
- [ ] **P07.4** · Uygun paketi dondur ve dondurmayı bitir. Geçerlilik ve etkilenen rezervasyonlar yeni okumada önizlemeyle uyuşur.
- [ ] **P07.5** · Değişim, yenileme ve sonlandırma işlemlerini uygun satışlarda ayrı ayrı uygula. Her sonucun hak hareketleri ve eski satış geçmişi izlenebilir.

### P08 · Manuel tahsilat ve öğrenci alacağı

| Önkoşul   | Sözleşme                                                                              | Doğrulama                                       |
| --------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| P07 satış | F19, F33 · [WF08](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf08) | Finans ekranı ve kaynak hareket karşılaştırması |

- [ ] **P08.1** · Borçlu satışa kısmi tahsilat gir. 1.000 TL borca 400 TL tahsilat örneğinde kalan borç 600 TL görünür.
- [ ] **P08.2** · Kalan borcu kapat. Tahsilat sonrası aynı işlem yanıtı kaybolup aynı niyet tekrarlandığında tek tahsilat kaydı bulunur.
- [ ] **P08.3** · Yetkili düzeltmenin önizleme/uygula akışını tamamla. Eski ve yeni hareketler izlenir, toplamlar onaylanan etkiye uyar.
- [ ] **P08.4** · Öğrenci alacağını ve izinli iadesini göster. Öğrencinin kendi görünümü ve yetkilinin finans okuması aynı bakiyeyi gösterir.

### P09 · Rezervasyon, bekleme ve teklif

| Önkoşul                                              | Sözleşme                                                                                                                                                                    | Doğrulama                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| P06, P07 · borçlu senaryoda P08 · gereken onayda P15 | F09, F11, F12, F15 · [WF06](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf06), [WF19](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf19) | İki öğrenci oturumu ve yetkili liste okuması |

- [ ] **P09.1** · Yönetici ve öğrenci kendi izinli yollarından rezervasyon oluşturup iptal eder. Kontenjan ile ayrılmış/kullanılabilir hak yeniden okumada tutarlıdır.
- [ ] **P09.2** · Hak, borç ve belge koşullarını ayrı test verileriyle dene. Uygulama reddin nedenini gösterir, başarısız istekte hak veya yer ayrılmaz.
- [ ] **P09.3** · Son yer için iki uygun oturumdan istek gönder. Kesin rezervasyon sayısı izinli kapasiteyle sınırlı kalır.
- [ ] **P09.4** · Dolu seansta beklemeye katıl ve ayrıl. Sıraya girişte kesin rezervasyon oluşmaz. Yer açılınca uygun kişiye süreli teklif görünür.
- [ ] **P09.5** · Teklif kabulünü, reddini ve süre dolmasını ayrı örneklerde çalıştır. Kabulde güncel uygunluk denetlenir ve liste, hak ve rezervasyon sonuçları uyuşur.

### P10 · Yoklama, hakediş ve eğitmen ödemesi

| Önkoşul  | Sözleşme                                                                                                                                                               | Doğrulama                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| P05, P09 | F14, F15, F20 · [WF07](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf07), [WF14](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf14) | Aynı seans için yoklama, hak ve hakediş karşılaştırması |

- [ ] **P10.1** · Eğitmen kendi seansında hazır/gelmedi durumlarını taslak kaydeder. Taslakta kapanışa ait tüketim oluşmaz.
- [ ] **P10.2** · Seansı fiilen görev alan eğitmenle kapat. Hak hareketi ve hakediş, katılım politikasına ve geçerli anlaşmaya uyar.
- [ ] **P10.3** · Gerekçeli yoklama düzeltmesini uygula. Değişen hak ve hakediş etkileri kaynak kapanışla ilişkilidir.
- [ ] **P10.4** · Seçili hakedişe ödeme gir ve izinli düzeltmeyi yap. Bekleyen ve ödenen tutarlar hareketlerle mutabıktır, fazla ödeme reddedilir.

### P11 · Günlük paneller ve kişisel takvim

| Önkoşul            | Sözleşme                                                                                                                                                                                                                                           | Doğrulama                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| P06, P08, P09, P10 | F06, F08, F11 · [WF07](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf07), [WF08](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf08), [WF09](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf09) | Öğrenci, eğitmen ve gerçek takvim istemcisi |

- [ ] **P11.1** · Öğrenci kendi yaklaşan dersini, haklarını ve borcunu görür. Rezervasyon iptali paneli yeniler.
- [ ] **P11.2** · Eğitmen kendi programından seansı açar ve yetkili yoklamaya ulaşır. Başka eğitmenin kapalı görevine doğrudan erişim reddedilir.
- [ ] **P11.3** · Kişisel takvim aboneliğini bir takvim istemcisinde aç. Yetkili ders ve saat görünür, iptal edilen erişim eski bağlantıyla kullanılamaz.

### P12 · Manuel CRM, deneme ve public başvuru

| Önkoşul                         | Sözleşme                                                                                                                                                                         | Doğrulama                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| P04 · deneme için P06, P07, P09 | F07, F21, F22, F23, F25 · [WF09](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf09), [WF16](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf16) | Aday, öğrenci ve public ziyaretçi akışları |

- [ ] **P12.1** · Telefon veya WhatsApp’tan gelen adayı elle kaydet, not ve takip tarihi ekle. Tarihli takip işi aynı kişi ve merkezle yeniden açılır.
- [ ] **P12.2** · Adayı yetkili aşamaya taşı ve personel erişimini dene. Atanmış kullanıcı kendi adayının faaliyetini görebilir, kapsam dışı kayda erişemez.
- [ ] **P12.3** · Uygun adaya deneme teklif et ve sonucunu işle. Kontrollü indirim yetkisi satışta denetlenir, ücretsiz denemede borç oluşmaz.
- [ ] **P12.4** · Adayı açık işlemle öğrenciliğe dönüştür. Aynı kişi korunur, ikinci kişi veya otomatik satış oluşmaz. Yenileme ve hareketsiz öğrenci listeleri kaynak duruma uyar.
- [ ] **P12.5** · Paylaşılan ders takviminden test başvurusu gönder ve merkez gelen kutusunda değerlendir. Hesapsız başvuru kesin rezervasyon yaratmaz. Geçerli sağlayıcı doğrulaması ve ret durumu yetkili ortamda denenir.

### P13 · Etkinlik, atölye ve Pratik

| Önkoşul                                 | Sözleşme                                                                              | Doğrulama                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- |
| P06, P07, P08, P10 · gereken onayda P15 | F29, F30 · [WF15](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf15) | Etkinlik kaydı, katılım ve finans hareketleri |

- [ ] **P13.1** · Kontenjanlı atölye yayımla, uygun katılımcıyı kaydet. Liste ve boş yer sayısı güncellenir, dolu etkinlikte izin dışı kayıt reddedilir.
- [ ] **P13.2** · Katılımı işle ve ayrı örnekte etkinliği iptal et. Durum, belge ve varsa finans etkisi kaynak işlemlerden doğrulanır.
- [ ] **P13.3** · Pakete bağlı Pratik katılımını kapat. Uygun paketle katılım kaydedilir, ders kredisi bakiyesi aynı kalır.

### P14 · Bildirimler, hatırlatmalar ve CRM otomasyonu

| Önkoşul                           | Sözleşme                                                                                                                                                                                                                                                                                                                       | Doğrulama                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| P09 veya P13 olayı · CRM için P12 | F24, F26, F27 · [WF11](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf11), [WF12](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf12), [WF16](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf16), [WF20](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf20) | Inbox, iş sonucu ve yetkili test alıcısında teslim |

- [ ] **P14.1** · Ders değişikliğiyle uygulama içi bildirim üret. Doğru kişinin gelen kutusunda okunmuş işareti yenilemede korunur.
- [ ] **P14.2** · Pro kullanıcının işlemsel e-posta tercihini değiştir. Açık tercihte yetkili test alıcısına gerçekleşen teslimi, kapalı tercihte uygulanan kanal davranışını doğrula.
- [ ] **P14.3** · Yaklaşan ders veya paket bitişi hatırlatmasını test verisiyle izle. Etkili tercih, dil ve sessiz saat politikasıyla gönderim zamanı ve içerik eşleşir. Teslim hatasında yalnız izinli yeniden deneme seçeneği görünür.
- [ ] **P14.4** · Güncel segmentten takip otomasyonu oluştur. Aynı kaynak olayı yeniden işlendiğinde yetkili merkezde tek takip görevi okunur.

### P16 · Rapor, CSV ve kontrollü içe aktarma

| Önkoşul                                     | Sözleşme                                                                              | Doğrulama                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| P07, P08, P10 · yetkili dosya ve iş hizmeti | F28, F31 · [WF10](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf10) | Rapor/hareket mutabakatı ve örnek içe aktarma dosyası |

- [ ] **P16.1** · Dönem ve merkez seçerek hak, borç, tahsilat ve hakediş raporlarını aç. Seçili test hareketleriyle rapor toplamlarını karşılaştır.
- [ ] **P16.2** · Aynı filtrelerle CSV dışa aktar. İş tamamlanınca yetkili kullanıcı dosyayı indirir, tarih aralığı ve toplamlar raporla eşleşir.
- [ ] **P16.3** · Öğrenci, kalan kredi ve borç içeren küçük bir dosyayı yükleyip önizle. Hatalı satır anlaşılır şekilde görünür, önizlemede iş kaydı dışında iş verisi değişmez.
- [ ] **P16.4** · Onaylanabilir dosyayı uygula ve işi yeniden aç. Öğrenci, hak ve borç sonuçları önizlemeyle eşleşir, aynı işlem tekrarında mükerrer kayıt oluşmaz.

### P17 · İşletme ayarları, abonelik ve yaşam döngüsü

| Önkoşul                                                 | Sözleşme                                                                                                                                                                                                                                           | Doğrulama                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| P02 · ayarın ilk tüketicisi · kapanışta ilgili kayıtlar | F03, F32, F33 · [WF12](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf12), [WF13](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf13), [WF17](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf17) | Güncel ayar, abonelik ve etkilenen gerçek işlem |

- [ ] **P17.1** · İlgili akış geliştirilirken program, rezervasyon, etkinlik, finans ve CRM/otomasyon ayarlarını yetkili ekrana bağla. Seçilen değerin etkisini ilgili kullanıcı işlemiyle doğrula, kanıtı ayar grubuyla ilişkilendir.
- [ ] **P17.2** · Yetkili kullanıcı planı, aylık/yıllık dönemi, yenileme tercihini ve kullanım limitini okur. İzinli değişiklikten sonra geçerli ve bekleyen durumlar sözleşmedeki tarihlerle görünür.
- [ ] **P17.3** · Daralma önizlemesini aç, kaynak seçimini ve dönem sınırını kontrol et. Geçiş tamamlanınca eski planın açık sekmesi yeni bir yetkisiz işlem başlatamaz.
- [ ] **P17.4** · Organizasyon kapanış/silme önizlemesinde engelleri göster. İzinli test senaryosunda açık onay sonrası durum ve erişim güncel okumayla eşleşir.

<a id="pro-kabulu"></a>

## Pro kabulü

Aşağıdaki senaryoları gerçek backend’e bağlı uygulama build’iyle çalıştır. İzole limit veya yarış testinin kanıtını kullandığın satıra bağla. Test verisi yüksek olan sınırlar için yetkili, izole ortam kullan.

- [ ] **G-PRO-01** · Tek merkezde aynı kayıt zincirini tamamla. Kurulum → kişi ve eğitmen anlaşması → program → paket satışı → tahsilat → öğrenci rezervasyonu → eğitmen yoklaması → hakediş → rapor. Son hak, borç, tahsilat ve hakediş değerlerini kaynaklarıyla karşılaştır.
- [ ] **G-PRO-02.1** · Günlük panel ve kişisel takvim için öğrenci, eğitmen ve izinli personel senaryolarının gerçek ortam sonuçlarını bağla. Rol değişiminde görüntülenen veri doğru kişiye ait olmalı.
- [ ] **G-PRO-02.2** · CRM dönüşümü, public başvuru, etkinlik/Pratik, sürümlü belge, gerçek bildirim ve import için P11–P16 ile kayıtlı kabul sonuçlarını bağla. Her akışın gözlenen sonucu ilgili işlemle eşleşmeli.
- [ ] **G-PRO-03.1** · Tek merkezli Pro organizasyonunda 249’dan 250 aktif öğrenciye çık. Son yer yarışında yalnız bir etkinleştirme başarılı olsun. 251’inci öğrenci ve ikinci aktif merkez reddedilsin.
- [ ] **G-PRO-03.2** · Ağ kesilmesi sonrası aynı işlem anahtarıyla güvenli devamı ve eski sürümle yazma reddini doğrula. Oturum/izin kaybında işlem durmalı, eski organizasyon verisi görünmemeli.
- [ ] **G-PRO-04.1** · Teslim kaynağında uygulamanın kalite zincirini doğrula. Gerçek koşu, test sonuçları ve ilgili kaynak SHA’sını bağla.
- [ ] **G-PRO-04.2** · Yayına aday statik build’i tarayıcıda aç. Doğrudan URL ve sayfa yenileme çalışmalı. Temel akışları mobil görünümde, klavyeyle ve erişilebilirlik taramasıyla doğrula. Takvimde saat ve tarih seçilen bağlama uymalı.
- [ ] **G-PRO-05** · P01–P17 ile yukarıdaki Pro senaryolarının açıklarını kontrol et. Kullanılan backend/ortamın ilgili kabul kaydını, frontend build’ini ve ölçütlerin sağlandığı tarihi bu maddeye ekle. İnsan değerlendirmesi ayrıca varsa kaydedilir; verilmiş sayılmaz.

<a id="starter"></a>

## Starter

Bu bölüm sonraki teslimdir, aktif Pro goal kapsamında yürütülmez. Başlangıç koşulu **G-PRO-05** ve Starter tesliminin başlatılmasıdır. Aynı uygulamadaki ortak akışları Starter hesabıyla çalıştır, planın getirdiği farkları aşağıdaki senaryolarla doğrula.

### S01 · Starter kaynak ve öğrenci limitleri

| Önkoşul  | Sözleşme                                                                                                                                                                                                                                           | Doğrulama                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| G-PRO-05 | F01, F08, F32 · [WF02](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf02), [WF03](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf03), [WF04](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf04) | Starter yetkilisi ve limit sınırındaki test organizasyonu |

- [ ] **S01.1** · Tek aktif merkez, oda, disiplin ve eğitmenle kurulum yap. Her türde ikinci aktif kaynak girişimi reddedilir, ilk kayıt kullanılabilir kalır.
- [ ] **S01.2** · Aynı mantıksal odada çakışan iki seans dene. İkinci seans reddedilir, oda kapasitesi ve seans kontenjanı ayrı görünür.
- [ ] **S01.3** · 99 aktif öğrenciden 100’e geçişi dene. Son yer için eşzamanlı etkinleştirmede en fazla 100 aktif öğrenci kalır, sonraki etkinleştirme reddedilir.

### S02 · Starter stüdyoda bir ders günü

| Önkoşul | Sözleşme                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Doğrulama                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| S01     | F09, F10, F11, F13, F14, F15, F16, F19 · [WF03](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf03), [WF04](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf04), [WF05](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf05), [WF06](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf06), [WF07](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf07), [WF08](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf08) | Aynı öğrenci ve seans üzerinden son okumalar |

- [ ] **S02.1** · Tek disiplinli sabit programı ve özel ders talebini tamamla. Programdaki bütün dersler doğru oda, disiplin ve eğitmene bağlıdır.
- [ ] **S02.2** · Ders sayılı ve süreli/sınırsız paketleri ilgili disiplinle göster. Paket adı disiplinle başlar, satıştan sonra hak ve borç doğru okunur.
- [ ] **S02.3** · Borçlu öğrencide varsayılan rezervasyon ve katılım engellerini dene. Borç kapandıktan sonra geçerli hakkıyla rezervasyon yapabilir.
- [ ] **S02.4** · Ücret anlaşması bulunmadan yetkili eğitmen yoklamayı kapatır. Hak sözleşmeye göre tüketilir, hakediş oluşmaz. Tahsilat ve kalan borç temel raporla uyuşur.

### S03 · Starter öğrenci, aday ve destek akışları

| Önkoşul                         | Sözleşme                                                                                                                                                                                                                                                                                                                                           | Doğrulama                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| S01 · ders günü verisi için S02 | F06, F21, F25, F26, F28, F30, F31 · [WF09](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf09), [WF10](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf10), [WF11](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf11), [WF16](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf16) | Starter öğrenci, eğitmen, yönetici ve public ziyaretçi |

- [ ] **S03.1** · Öğrenci kendi rezervasyonunu oluşturur veya iptal eder. Eğitmen günlük panelden aynı seansı açabilir.
- [ ] **S03.2** · Public ders başvurusunu al ve dar kapsamlı başvuru değerlendirmesini tamamla. Başvuru kendiliğinden hesap, satış, rezervasyon veya pazarlama izni oluşturmaz.
- [ ] **S03.3** · Elle aday, not ve tekrar arama tarihi gir. Takip tarihini güncelle ve kişinin geçmişinden doğrula.
- [ ] **S03.4** · İşlemsel bildirimi uygulama içinde oku ve gerekiyorsa sürümlü belgeyi açıkça onayla. Onay yalnız doğru kişinin ilgili işlemine yazılır.
- [ ] **S03.5** · Temel raporu satış/tahsilatla karşılaştır. İzinli öğrenci/hak/borç dosyasını içe aktar ve sonuçları kaynak kayıtlardan doğrula.

### S04 · Starter üst plan erişim retleri

| Önkoşul | Sözleşme                                                                                                                     | Doğrulama                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| S01     | F05, F12, F17, F18, F20, F22–F24, F26, F27, F29 · [WF00](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf00) | Her satır için gezinme, doğrudan URL ve backend yetki sonucu |

- [ ] **S04.1** · Bağımsız personel yönetimi, ücret anlaşması ve eğitmen hakedişi işlemlerini kontrol et. Starter oturumu kapalı işlemleri çalıştıramaz.
- [ ] **S04.2** · Bekleme/teklif, paket dondurma/değişimi ve bağımsız etkinliği kontrol et. İşlem reddedildiğinde haklar ve rezervasyonlar korunur.
- [ ] **S04.3** · Gelişmiş CRM, deneme/dönüşüm, segment/otomasyon ve hatırlatmaları kontrol et. Temel elle takip kullanılabilir kalır.
- [ ] **S04.4** · Merkezler arası kullanım ve uygulama işlemsel e-posta tercihi için plan sınırını doğrula. Native Auth e-posta doğrulaması kendi akışında çalışır.

### S05 · Pro’dan Starter’a geçiş

| Önkoşul  | Sözleşme                                                                                                                                                                    | Doğrulama                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| P17, S01 | F03, F17, F32, F33 · [WF12](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf12), [WF13](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf13) | Dönem sınırından önce ve sonra aynı kayıtların karşılaştırması |

- [ ] **S05.1** · Çok kaynaklı Pro organizasyonunu Starter’a daraltırken kullanılacak kaynakları seç. Geçişin etkili tarihi ve seçilen kaynaklar güncel okumada görünür.
- [ ] **S05.2** · Geçiş sonrası kapalı kaynakta yeni işlemi dene. Eski hak, borç, yoklama ve kesin rezervasyonlar sözleşmedeki korumayı sürdürür.

### Starter kabulü

- [ ] **G-STARTER.1** · Starter hesabıyla kayıtlı bir öğrenciye paket sat, manuel tahsilat al, rezervasyon yap ve yoklamayı kapat. Gerçek ortamda hak tüketilir, doğru bakiye görünür, eğitmen hakedişi üretilmez.
- [ ] **G-STARTER.2** · S01–S05 kanıtlarını Starter kaynağına bağla. Özellikle 100 aktif öğrenci, her kaynak türünden bir tane, kapalı özelliklerin reddi ve plan geçişi ayrı ayrı izlenebilir olmalı.
- [ ] **G-STARTER** · Ortak Pro akışlarının etkilenen regresyonlarını ve Starter build/ortam kaydını doğrula. Ölçütlerin sağlandığı tarihi kaydet; ayrıca verilmiş insan değerlendirmesi varsa ilişkilendir.

<a id="business"></a>

## Business

Bu bölüm sonraki teslimdir, aktif Pro goal kapsamında yürütülmez. Başlangıç koşulu **G-STARTER**, sonradan eklenecek Business ekranları ve Business tesliminin başlatılmasıdır. Çizim/ekran üretimini Pro çalışmasına ekleme. Çok merkezli işlemleri A ve B merkezlerinde farklı izinleri olan test hesaplarıyla çalıştır.

### B01 · Merkezler, yönetici kapsamı ve politikalar

| Önkoşul   | Sözleşme                                                                                                                                                                                                                                                     | Doğrulama                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| G-STARTER | F01, F03, F04, F05, F32 · [WF02](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf02), [WF12](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf12), [WF13](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf13) | Organizasyon ve merkez bazlı ayrı test oturumları |

- [ ] **B01.1** · A ve B merkezlerini oluştur. Merkez değişince oda, disiplin, görev ve sorgular doğru merkeze geçer.
- [ ] **B01.2** · Organizasyonun zorunlu ve tavsiye ayarını iki merkezde dene. Yalnız izinli ayar merkezde değiştirilebilir, etkili değer ilgili işlemde kullanılır.
- [ ] **B01.3** · Beşinci aktif merkezi aç, altıncıyı dene. Aktif merkez sayısı beşte kalır ve sonuç gerekçesiyle gösterilir.

### B02 · Birleşik kişi ve CRM

| Önkoşul | Sözleşme                                                                                                                                                                                                                                                | Doğrulama                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| B01     | F04, F07, F21, F25 · [WF04](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf04), [WF09](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf09), [WF16](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf16) | A, B ve organizasyon gelen kutularının karşılaştırılması |

- [ ] **B02.1** · Organizasyon gelen kutusundaki başvuruyu yetkili merkeze yönlendir veya izinli aktarımı yap. Kaynak ve karar geçmişi korunur.
- [ ] **B02.2** · Merkezlerin ilgili kayıtları için yetkili kişi birleştirmesini tamamla. Tek organizasyon kişisi ve Abone No üzerinden ilişkiler izlenir.
- [ ] **B02.3** · A merkezinin personeliyle yalnız B’ye ait kişi, CRM ve finans kaydını doğrudan açmayı dene. Yetkisiz sonuçta kişisel bilgi görünmez.

### B03 · Merkezler arası kullanım hakkı

| Önkoşul                               | Sözleşme                                                                                                                                                                                                                                                                                                                       | Doğrulama                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| B01 ve Pro satış/rezervasyon akışları | F15, F16, F18 · [WF05](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf05), [WF06](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf06), [WF07](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf07), [WF18](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf18) | A’da satılan paketin B’de kullanımı |

- [ ] **B03.1** · Yalnız A’da geçerli paketle B’de kullanım dene. Ret sonrası öğrencinin kredi ve bakiye hareketleri aynı kalır.
- [ ] **B03.2** · A ve B’de geçerli uygun paketi B’de kullan. Tüketimi hak hareketinden, varsa merkez payını kaynak satıştan doğrula.
- [ ] **B03.3** · Katılımı sözleşmeye uygun gerekçeyle düzelt. İade özgün harekete bağlanır, aynı düzeltme iki iade yaratmaz.

### B04 · Merkezler arası hesaplaşma

| Önkoşul | Sözleşme                                                                                   | Doğrulama                                                 |
| ------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| B03     | F18, F19, F33 · [WF18](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf18) | A ve B için bağımsız finans yetkileri ve bakiye okumaları |

- [ ] **B04.1** · A’nın yetkilisi güncel A→B hareketi için talep oluşturur. Talep beklerken bakiyeler korunur, A yetkilisinin B adına karar yetkisi ayrıca denetlenir.
- [ ] **B04.2** · B’nin yetkilisi talebi onaylar. Her iki merkezin hareket ve bakiye sonuçları aynı talebe bağlanır, yanıt kaybında yeniden gönderim ikinci hareket üretmez.
- [ ] **B04.3** · Ayrı örneklerde gerekçeli ret ve geri çekmeyi dene. İlgili son durum iki tarafta okunur ve onaylanmış finans etkisi oluşmaz.
- [ ] **B04.4** · Devredilmiş finans yetkisini geri çek ve açık talebi yeniden aç. Eski yetkiyle karar verilemez, güncel izin arayüze yansır.

### B05 · Birleşik rapor ve öğrenci kotası

| Önkoşul       | Sözleşme                                                                                                                                                                                                                                           | Doğrulama                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| B02, B03, B04 | F18, F28, F32 · [WF04](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf04), [WF10](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf10), [WF18](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf18) | Merkez ve organizasyon raporları, sınır testi |

- [ ] **B05.1** · Merkez ve organizasyon raporlarını aynı dönem, filtre ve para birimiyle karşılaştır. Merkezler arası kullanım ve ilgili toplamlar kaynak hareketlerle tutar.
- [ ] **B05.2** · İki merkezde ilişkisi olan aynı öğrenciyi organizasyon genelinde say. Tek kişi kotada bir kez yer alır, merkez başına ayrı kota uygulanmaz.
- [ ] **B05.3** · 1.249’dan 1.250 aktif öğrenciye geç. Son kontenjan için yarışta toplam 1.250’yi aşmaz, 1.251’inci etkinleştirme reddedilir.

### B06 · Plan daralması ve erişim değişikliği

| Önkoşul            | Sözleşme                                                                                                                                                                                                                                                | Doğrulama                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| B01, B03, P17, S05 | F03, F18, F32, F33 · [WF00](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf00), [WF13](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf13), [WF18](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md#wf18) | Geçiş öncesi/sonrası geçmiş ve aktif izin karşılaştırması |

- [ ] **B06.1** · Business→Pro ve Business→Starter geçişlerini ayrı test organizasyonlarında çalıştır. Seçilen kaynaklar, yürürlük ve yeni işlem izinleri hedef plana uyar.
- [ ] **B06.2** · Merkez yetkisini açık oturumda kaldır. Önceki detay ve önbellek artık erişim sağlamaz, korunması gereken geçmiş yetkili rolde okunur.

### Business kabulü

- [ ] **G-BUSINESS.1** · Gerçek iki merkezli organizasyonda A’da satılan uygun paketi B’de kullandır. A’nın başvurusu ve B’nin onayı sonrasında yetkili hesaplar aynı harekete bağlı tutarları görmeli.
- [ ] **G-BUSINESS.2** · Yetkisiz merkez erişimi, beş merkez, 1.250 tekil aktif öğrenci, hesaplaşmada tekrar ve hedef plana daralma kanıtlarını B01–B06 üzerinden bağla.
- [ ] **G-BUSINESS** · Ortak Pro ve Starter akışlarında etkilenen regresyonları doğrula. Kaynak, build, ortam ve ölçütlerin sağlandığı tarihi kaydet; varsa insan değerlendirmesini ayrıca ilişkilendir.

<a id="kaynaklar"></a>

## Kapsam ve kaynaklar

- Özgün çizimler `design-reference` altında salt okunur görsel örnektir. Ürün geneli kaynak taraması tamamlandı; E satırları sayfa bazlı uygulama girdisidir. Runtime ve gerçek görsel/işlev kabulü açık kutularda izlenir.
- Kaynak kodu, testler ve çıktılar `apps/web1` içinde tutulur. Bağımsız uygulama tanımıyla çelişen repo talimatları ve etkin CI/yayın düzeni T02.3 kapsamında kayıt altına alınır. [Uygulama kuralları](https://github.com/SXQHex/FtkSaaS/blob/main/apps/web1/AGENTS.md) · [Kurulum](https://github.com/SXQHex/FtkSaaS/blob/main/apps/web1/README.md)
- F kimlikleri ürün kapsamını, WF kimlikleri aktör, işlem sırası ve ret/kurtarma davranışını gösterir. Her paketin başlığındaki referanslar geliştirme öncesi kontrol edilir. Ortak davranışta aynı kaynağa ait kanıt tekrar kullanılabilir. [Ürün sözleşmesi](https://github.com/SXQHex/FtkSaaS/blob/main/docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) · [İş akışları](https://github.com/SXQHex/FtkSaaS/blob/main/docs/workflows.md)
- Alan, sürüm ve eylem izinleri için makine sözleşmesi esas alınır. Eksik okuma veya sağlayıcı desteği, ilgili işin engel kaydına yazılır. [İstemci protokolü](https://github.com/SXQHex/FtkSaaS/blob/main/docs/client-integration.md) · [Makine sözleşmesi](https://github.com/SXQHex/FtkSaaS/blob/main/packages/api-contracts/schema/contract.json) · [Ayar davranışları](https://github.com/SXQHex/FtkSaaS/blob/main/docs/settings.md)
- Dil çalışmasının temeli mevcut Türkçe katalogdur. Ek dillerin teslim kapsamı ayrıca belirlenir. Zamanlanmış iletinin dilini ve onaylanan metnin yetkili sürümünü ilgili backend sözleşmesinden doğrula.
- Ertelenen veya kapsam dışı işler arasında dış reklam/site bağlantıları, online kart tahsilatı, SMS doğrulama, özel limitler ve beş merkezi aşma bulunur. Kapsamlı yük, kurtarma ve imha altyapısı Business sonrasındaki ayrı çalışmaya aittir. Uygulanabilir asgari işletim kabulü için backend kaydını kullan. [Plan hedefi ve kapsam](https://github.com/SXQHex/FtkSaaS/blob/main/docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md#proje-teslim-hedefi)
